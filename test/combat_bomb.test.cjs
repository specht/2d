const test = require('node:test');
const assert = require('node:assert/strict');
const { CombatSystem } = require('../src/static/combat.js');
const { register_projectile } = require('../src/static/combat_projectile.js');
const { default_ranged_attack } = require('../src/static/combat_melee_trait.js');

function fixture() {
    const previous = global.THREE;
    global.THREE = {
        DoubleSide: 2,
        PlaneGeometry: class { translate() { return this; } dispose() { this.disposed = true; } },
        MeshBasicMaterial: class { dispose() { this.disposed = true; } },
        Mesh: class {
            constructor(geometry, material) {
                this.geometry = geometry; this.material = material;
                this.position = { x: 0, y: 0, z: 0,
                    set(x, y, z) { Object.assign(this, { x, y, z }); } };
                this.rotation = { z: 0 };
                this.scale = { x: 1, y: 1, z: 1 };
            }
        },
    };
    const attack = default_ranged_attack();
    attack.delivery.detonation = { fuse_s: 2, radius_px: 48, shake_strength: 0 };
    attack.delivery.speed_px_s = 0;
    attack.delivery.gravity_px_s2 = 500;
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, data: { sprites: [] }, baddies: [],
        active_level_sprites: [], update_stats() {},
        scene: { objects: [], add(mesh) { this.objects.push(mesh); },
            remove(mesh) { this.objects = this.objects.filter(item => item !== mesh); } },
    };
    const actor = {
        game, active: true, mesh: { position: { x: 0, y: 0 } },
        sprite: { width: 20, height: 20 }, character_trait: 'actor',
        last_horizontal_facing: 'right', traits: { attacks: [attack] },
        invincible() { return this.immune ?? false; }, dead() { return false; }, die() {},
    };
    game.player_character = actor;
    function enemy(x, y = 0) {
        const baddie = {
            game, active: true, mesh: { position: { x, y } },
            sprite: { width: 20, height: 20 }, character_trait: 'baddie',
            last_horizontal_facing: 'left', energy: 100,
            traits: { attacks: [structuredClone(attack)] },
            take_damage(amount) { this.energy -= amount; if (this.energy <= 0) this.active = false; },
        };
        game.baddies.push(baddie);
        return baddie;
    }
    const combat = new CombatSystem(game);
    register_projectile(combat);
    return { game, actor, enemy, combat, attack,
        restore() { if (previous === undefined) delete global.THREE;
            else global.THREE = previous; } };
}

function floor(f) {
    f.game.data.sprites = [{ width: 300, height: 16, traits: { block_above: {} } }];
    f.game.active_level_sprites.push({ sprite_index: 0, mesh: { position: { x: 0, y: -16 } } });
}

test('dropped bomb rests on ground, waits for fuse, hits nearby enemies once', () => {
    const f = fixture();
    try {
        floor(f);
        const near = f.enemy(25), far = f.enemy(150);
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        assert.ok(shot);
        f.combat.step(0.5);
        assert.equal(shot.projectile_resting, true);
        assert.equal(near.energy, 100);
        f.combat.step(1.9);
        assert.equal(near.energy, 100);
        f.combat.step(2);
        assert.equal(near.energy, 85);
        assert.equal(far.energy, 100);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.scene.objects.length, 0);
        f.combat.step(2.05);
        assert.equal(near.energy, 85);
    } finally { f.restore(); }
});

test('thrown bomb can explode in the air before hitting a target', () => {
    const f = fixture();
    try {
        f.attack.delivery.speed_px_s = 240;
        f.attack.delivery.gravity_px_s2 = 0;
        f.attack.delivery.detonation.fuse_s = 0.15;
        const near = f.enemy(60), far = f.enemy(180);
        const shot = f.combat.request_attack(f.actor, 'ranged', 0, { x: 1 });
        f.combat.step(0.1);
        assert.equal(near.energy, 100); // No damage on direct contact while flying.
        assert.equal(shot.projectile_resting, false);
        f.combat.step(0.15);
        assert.equal(near.energy, 85);
        assert.equal(far.energy, 100);
        assert.equal(f.combat.active.length, 0);
    } finally { f.restore(); }
});

test('same bomb delivery hits the player from an enemy but respects invincibility', () => {
    const f = fixture();
    try {
        f.actor.mesh.position.x = 35;
        const baddie = f.enemy(0);
        baddie.traits.attacks[0].delivery.gravity_px_s2 = 0;
        baddie.traits.attacks[0].delivery.detonation.fuse_s = 0.2;
        assert.ok(f.combat.request_attack(baddie, 'ranged', 0));
        f.combat.step(0.2);
        assert.equal(f.game.energy, 85);
        f.combat.reset();
        f.actor.immune = true;
        f.game.energy = 100;
        f.combat.request_attack(baddie, 'ranged', 1);
        f.combat.step(1.205);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.energy, 100);
    } finally { f.restore(); }
});

test('bomb uses dedicated Zündschnur and Explosion states from its sprite', () => {
    const f = fixture();
    try {
        const mk = id => ({ geometry: { id }, material: { id } });
        const frames = [[mk('normal')], [mk('fuse0'), mk('fuse1')], [mk('explosion0'), mk('explosion1')]];
        f.game.data.sprites = [{ width: 16, height: 16,
            states: [
                { properties: { name: '', fps: 8 }, frames: [{}] },
                { properties: { name: 'Zündschnur', fps: 8 }, frames: [{}, {}] },
                { properties: { name: 'Explosion', fps: 8 }, frames: [{}, {}] },
            ] }];
        f.game.geometry_and_material_for_frame = [frames];
        f.attack.visual.projectile_sprite_index = 0;
        f.attack.delivery.gravity_px_s2 = 0;
        f.attack.delivery.detonation.fuse_s = 0.2;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        assert.equal(shot.projectile_mesh.geometry, frames[1][0].geometry);
        f.combat.step(0.13);
        assert.equal(shot.projectile_mesh.geometry, frames[1][1].geometry);
        f.combat.step(0.2);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.scene.objects.length, 1);
        assert.equal(f.game.scene.objects[0].geometry, frames[2][0].geometry);
        f.combat.step(0.33);
        assert.equal(f.game.scene.objects[0].geometry, frames[2][1].geometry);
        f.combat.reset();
        assert.equal(f.game.scene.objects.length, 0);
    } finally { f.restore(); }
});

test('shake is optional and does not alter blast damage or flight', () => {
    const f = fixture();
    try {
        f.game.clock = { getElapsedTime() { return 10; } };
        f.attack.delivery.gravity_px_s2 = 0;
        f.attack.delivery.detonation.fuse_s = 0.2;
        f.combat.request_attack(f.actor, 'ranged', 0);
        f.combat.step(0.2);
        assert.equal(f.game.ts_camera_shake, undefined);
        f.combat.reset();
        f.attack.delivery.detonation.shake_strength = 8;
        f.combat.request_attack(f.actor, 'ranged', 1);
        f.combat.step(1.205);
        assert.equal(f.game.ts_camera_shake, 10);
        assert.ok(f.game.camera_shake_strength > 0);
    } finally { f.restore(); }
});

test('invalid bomb settings reject activation and existing shots keep their defaults', () => {
    const f = fixture();
    try {
        f.attack.delivery.detonation.fuse_s = -1;
        assert.equal(f.combat.request_attack(f.actor, 'ranged', 0), null);
        delete f.attack.delivery.detonation;
        f.attack.delivery.speed_px_s = 240;
        assert.ok(f.combat.request_attack(f.actor, 'ranged', 0));
        f.combat.step(1.5);
        assert.equal(f.combat.active.length, 0);
    } finally { f.restore(); }
});

test('a large bomb thrown while standing on the floor clears the floor and moves outward', () => {
    const f = fixture();
    try {
        floor(f);
        f.game.data.sprites.push({ width: 32, height: 32, traits: {}, states: [] });
        f.attack.visual.projectile_sprite_index = 1;
        f.attack.delivery.speed_px_s = 160;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0, { x: 1, y: 0 });
        assert.ok(shot.projectile_y >= 18);
        const startX = shot.projectile_x;
        f.combat.step(0.1);
        assert.ok(shot.projectile_x > startX + 10);
        assert.equal(shot.projectile_resting, false);
        f.combat.step(0.4);
        assert.equal(shot.projectile_resting, true);
        assert.ok(shot.projectile_x > startX + 20);
    } finally { f.restore(); }
});

test('a bomb hits a vertical wall, slides down, and rests only when it reaches the floor', () => {
    const f = fixture();
    try {
        f.game.data.sprites = [
            { width: 12, height: 200, traits: { block_sides: {} } },
            { width: 300, height: 16, traits: { block_above: {} } },
        ];
        f.game.active_level_sprites = [
            { sprite_index: 0, mesh: { position: { x: 64, y: -80 } } },
            { sprite_index: 1, mesh: { position: { x: 0, y: -80 } } },
        ];
        f.attack.delivery.speed_px_s = 100;
        f.attack.delivery.gravity_px_s2 = 400;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0, { x: 1, y: 0 });
        f.combat.step(0.6);
        const wallX = shot.projectile_x;
        const wallY = shot.projectile_y;
        assert.equal(shot.projectile_resting, false);
        assert.ok(wallX < 64);
        f.combat.step(0.8);
        assert.equal(shot.projectile_x, wallX);
        assert.ok(shot.projectile_y < wallY);
        assert.equal(shot.projectile_resting, true);
        assert.ok(Math.abs(shot.projectile_y - (-64 + shot.projectile_radius)) < 1e-7);
    } finally { f.restore(); }
});

test('non-blocking artwork is transparent to bombs and only the relevant block face stops one', () => {
    const f = fixture();
    try {
        f.game.data.sprites = [{ width: 10, height: 100, traits: {} }];
        f.game.active_level_sprites = [{ sprite_index: 0,
            mesh: { position: { x: 64, y: -10 } } }];
        f.attack.delivery.speed_px_s = 100;
        f.attack.delivery.gravity_px_s2 = 0;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        f.combat.step(0.7);
        assert.ok(shot.projectile_x > 64);
        f.combat.reset();
        f.game.data.sprites[0].traits = { block_above: {} };
        const over = f.combat.request_attack(f.actor, 'ranged', 1);
        f.combat.step(1.7);
        assert.ok(over.projectile_x > 64, 'a floor-only trait must not be a vertical wall');
        f.combat.reset();
        f.game.data.sprites[0].traits = { block_sides: {} };
        const wall = f.combat.request_attack(f.actor, 'ranged', 2);
        f.combat.step(2.7);
        assert.ok(wall.projectile_x < 64);
        assert.equal(wall.projectile_vx, 0);
    } finally { f.restore(); }
});

test('the bomb fuse holds its last frame until the separate explosion state plays', () => {
    const f = fixture();
    try {
        const mk = id => ({ geometry: { id }, material: { id } });
        f.game.data.sprites = [{ width: 12, height: 12, traits: {}, states: [
            { properties: { name: 'Bombe', fps: 4 }, frames: [{}] },
            { properties: { name: 'Zündschnur', fps: 4 }, frames: [{}, {}, {}] },
            { properties: { name: 'Explosion', fps: 4 }, frames: [{}, {}] },
        ] }];
        f.game.geometry_and_material_for_frame = [
            [[mk('bomb')], [mk('fuse0'), mk('fuse1'), mk('fuse2')], [mk('bang0'), mk('bang1')]],
        ];
        f.attack.visual.projectile_sprite_index = 0;
        f.attack.delivery.gravity_px_s2 = 0;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        f.combat.step(0.8);
        assert.equal(shot.projectile_mesh.geometry.id, 'fuse2');
        f.combat.step(1.7);
        assert.equal(shot.projectile_mesh.geometry.id, 'fuse2');
        f.combat.step(2);
        assert.equal(f.game.scene.objects[0].geometry.id, 'bang0');
    } finally { f.restore(); }
});


test('tagged Zündschnur and Explosion states work without special state titles', () => {
    const f = fixture();
    try {
        const mk = id => ({ geometry: { id }, material: { id } });
        f.game.data.sprites = [{ width: 12, height: 12, traits: { bomb: {} }, states: [
            { properties: { name: 'Bombe' }, frames: [{}] },
            { properties: { name: 'Funke', fps: 4 }, traits: { bomb: { fuse: {} } },
                frames: [{}, {}] },
            { properties: { name: 'Knall', fps: 4 }, traits: { bomb: { explosion: {} } },
                frames: [{}, {}] },
        ] }];
        f.game.geometry_and_material_for_frame = [
            [[mk('normal')], [mk('fuse0'), mk('fuse1')], [mk('bang0'), mk('bang1')]],
        ];
        f.attack.visual.projectile_sprite_index = 0;
        f.attack.delivery.gravity_px_s2 = 0;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        assert.equal(shot.projectile_mesh.geometry.id, 'fuse0');
        f.combat.step(1.5);
        assert.equal(shot.projectile_mesh.geometry.id, 'fuse1');
        f.combat.step(2);
        assert.equal(f.game.scene.objects[0].geometry.id, 'bang0');
    } finally { f.restore(); }
});

test('owner self-damage requires explicit opt-in and respects invincibility', () => {
    const f = fixture();
    try {
        f.attack.delivery.gravity_px_s2 = 0;
        f.attack.delivery.detonation.fuse_s = 0.2;
        f.combat.request_attack(f.actor, 'ranged', 0);
        f.combat.step(0.2);
        assert.equal(f.game.energy, 100);
        f.combat.reset();
        f.attack.delivery.detonation.self_damage = true;
        f.combat.request_attack(f.actor, 'ranged', 1);
        f.combat.step(1.205);
        assert.equal(f.game.energy, 85);
        f.combat.reset();
        f.actor.immune = true;
        f.combat.request_attack(f.actor, 'ranged', 2);
        f.combat.step(2.205);
        assert.equal(f.game.energy, 85);
    } finally { f.restore(); }
});

test('a rising thrown bomb cannot tunnel through a side-blocking wall', () => {
    const f = fixture();
    try {
        f.attack.delivery.speed_px_s = 120;
        f.attack.delivery.gravity_px_s2 = 0;
        f.attack.delivery.detonation.fuse_s = 1;
        f.game.data.sprites = [{ width: 8, height: 100, traits: { block_sides: {} } }];
        f.game.active_level_sprites.push({ sprite_index: 0,
            mesh: { position: { x: 40, y: 18 } } });
        const shot = f.combat.request_attack(f.actor, 'ranged', 0, { x: 2, y: 1 });
        assert.ok(shot);
        f.combat.step(0.5);
        assert.equal(shot.projectile_x, 34); // x0 of wall (36) minus 2px radius
        assert.equal(shot.projectile_vx, 0);
        assert.equal(shot.projectile_resting, false); // wall is not a floor
    } finally { f.restore(); }
});

test('a decorative sprite does not stop a thrown bomb', () => {
    const f = fixture();
    try {
        f.attack.delivery.speed_px_s = 120;
        f.attack.delivery.gravity_px_s2 = 0;
        f.game.data.sprites = [{ width: 8, height: 100, traits: {} }];
        f.game.active_level_sprites.push({ sprite_index: 0,
            mesh: { position: { x: 40, y: 18 } } });
        const shot = f.combat.request_attack(f.actor, 'ranged', 0, { x: 2, y: 1 });
        f.combat.step(0.5);
        assert.ok(shot.projectile_x > 50);
    } finally { f.restore(); }
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { CombatSystem } = require('../src/static/combat.js');
const { register_projectile } = require('../src/static/combat_projectile.js');
const { default_ranged_attack, resolved_character_attacks } =
    require('../src/static/combat_melee_trait.js');

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
                this.scale = { x: 1, y: 1, z: 1 };
            }
        },
    };
    const attack = default_ranged_attack();
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

test('a miss flies independently of artwork and disappears at range', () => {
    const f = fixture();
    try {
        f.attack.delivery.range_px = 50;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        assert.ok(shot);
        assert.equal(f.game.scene.objects.length, 1);
        const mesh = shot.projectile_mesh;
        f.combat.step(0.1);
        assert.ok(mesh.position.x > 10);
        f.combat.step(0.25);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.scene.objects.length, 0);
        assert.equal(mesh.geometry.disposed, true);
        assert.equal(mesh.material.disposed, true);
    } finally { f.restore(); }
});

test('fast swept shots hit exactly one enemy before another, and not through a wall', () => {
    const f = fixture();
    try {
        f.attack.delivery.speed_px_s = 1200;
        const one = f.enemy(100), two = f.enemy(135);
        f.combat.request_attack(f.actor, 'ranged', 0);
        f.combat.step(0.11);
        assert.equal(one.energy, 85);
        assert.equal(two.energy, 100);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.scene.objects.length, 0);
        f.combat.reset();
        const wall = { sprite_index: 0, mesh: { position: { x: 60, y: 0 } } };
        f.game.data.sprites = [{ width: 12, height: 20, traits: { block_sides: {} } }];
        f.game.active_level_sprites.push(wall);
        f.combat.request_attack(f.actor, 'ranged', 1);
        f.combat.step(1.11);
        assert.equal(one.energy, 85); // the wall intercepted the next shot
    } finally { f.restore(); }
});

test('actor and enemy use the same delivery, with mirrored direction and separate cooldowns', () => {
    const f = fixture();
    try {
        f.actor.mesh.position.x = 100;
        const baddie = f.enemy(0);
        assert.ok(f.combat.request_attack(baddie, 'ranged', 0, { x: 1 }));
        assert.equal(f.combat.request_attack(baddie, 'ranged', 0.1), null);
        f.combat.step(0.5);
        assert.equal(f.game.energy, 85);
        f.actor.last_horizontal_facing = 'left';
        assert.ok(f.combat.request_attack(f.actor, 'ranged', 0.5));
        assert.equal(f.combat.active[0].direction, -1);
        f.combat.step(0.9);
        assert.equal(baddie.energy, 85);
    } finally { f.restore(); }
});

test('closed doors block projectiles; open doors let them pass', () => {
    const f = fixture();
    try {
        const victim = f.enemy(100);
        f.game.data.sprites = [{ width: 12, height: 20, traits: { door: {} } }];
        const door = { sprite_index: 0, mesh: { position: { x: 60, y: 0 } }, door_closed: true };
        f.game.active_level_sprites.push(door);
        f.combat.request_attack(f.actor, 'ranged', 0);
        f.combat.step(0.5);
        assert.equal(victim.energy, 100);
        door.door_closed = false;
        f.combat.request_attack(f.actor, 'ranged', 1);
        f.combat.step(1.5);
        assert.equal(victim.energy, 85);
    } finally { f.restore(); }
});

test('selected projectile animates using the shared atlas; reset removes it without disposing atlas', () => {
    const f = fixture();
    try {
        const frames = [{ geometry: { id: 0 }, material: { id: 'atlas' } },
            { geometry: { id: 1 }, material: { id: 'atlas' } }];
        f.game.data.sprites = [{ width: 16, height: 8,
            states: [{ properties: { fps: 10 }, frames: [{}, {}] }] }];
        f.game.geometry_and_material_for_frame = [[frames]];
        f.attack.visual.projectile_sprite_index = 0;
        f.actor.last_horizontal_facing = 'left';
        const shot = f.combat.request_attack(f.actor, 'ranged', 0);
        assert.equal(shot.projectile_mesh.geometry, frames[0].geometry);
        assert.equal(shot.projectile_mesh.scale.x, -1);
        f.combat.step(0.11);
        assert.equal(shot.projectile_mesh.geometry, frames[1].geometry);
        f.combat.reset();
        assert.equal(f.game.scene.objects.length, 0);
        assert.equal(frames[0].material.id, 'atlas');
    } finally { f.restore(); }
});

test('resolved ranged trait is opt-in and never mutates legacy game data', () => {
    const traits = { actor: { attacks: [{ id: 'old', slot: 'other' }] } };
    const original = JSON.stringify(traits);
    assert.equal(resolved_character_attacks(traits, 'actor'), traits.actor.attacks);
    traits.ranged_attack = { attack: default_ranged_attack() };
    assert.deepEqual(resolved_character_attacks(traits, 'actor').map(a => a.id), ['ranged', 'old']);
    assert.equal(traits.actor.attacks[0].id, 'old');
    assert.equal(JSON.stringify(traits.actor.attacks), JSON.stringify(JSON.parse(original).actor.attacks));
});

test('an invincible player consumes the enemy shot without losing energy', () => {
    const f = fixture();
    try {
        f.actor.mesh.position.x = 100;
        f.actor.immune = true;
        const attacker = f.enemy(0);
        f.combat.request_attack(attacker, 'ranged', 0, { x: 1 });
        f.combat.step(0.5);
        assert.equal(f.game.energy, 100);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.scene.objects.length, 0);
    } finally { f.restore(); }
});

test('projectile art references survive reorder and clear when a sprite is deleted', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/static/game.js'), 'utf8');
    const begin = source.indexOf('    remap_hit_sprite_references(translation, deletedIndex = null) {');
    const end = source.indexOf('    add_sprite_trait(trait) {', begin);
    assert.ok(begin >= 0 && end > begin);
    const Editor = new Function(`return class Editor { ${source.slice(begin, end)} };`)();
    const ranged = { visual: { projectile_sprite_index: 2, hit_sprite_index: 1 } };
    const editor = new Editor();
    editor.data = { sprites: [{ traits: { ranged_attack: { attack: ranged } } },
        { traits: {} }, { traits: {} }] };
    editor.remap_hit_sprite_references([1, 2, 0]);
    assert.deepEqual(ranged.visual, { projectile_sprite_index: 0, hit_sprite_index: 2 });
    editor.data.sprites = [editor.data.sprites[0], editor.data.sprites[2]];
    editor.remap_hit_sprite_references([0, 0, 1], 0);
    assert.deepEqual(ranged.visual, { hit_sprite_index: 1 });
});

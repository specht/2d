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
                this.geometry = geometry;
                this.material = material;
                this.position = { x: 0, y: 0, z: 0,
                    set(x, y, z) { Object.assign(this, { x, y, z }); } };
                this.rotation = { z: 0 };
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
        invincible() { return false; }, dead() { return false; }, die() {},
    };
    game.player_character = actor;
    function enemy(x, y = 0) {
        const baddie = {
            game, active: true, mesh: { position: { x, y } },
            sprite: { width: 20, height: 20 }, character_trait: 'baddie',
            last_horizontal_facing: 'left', energy: 100,
            traits: { attacks: [structuredClone(attack)] },
            take_damage(amount) { this.energy -= amount; if (this.energy <= 0) this.active = false; },
            invincible() { return false; }, dead() { return false; }, die() {},
        };
        game.baddies.push(baddie);
        return baddie;
    }
    const combat = new CombatSystem(game);
    register_projectile(combat);
    return { game, actor, enemy, combat, attack,
        restore() { if (previous === undefined) delete global.THREE; else global.THREE = previous; } };
}

test('gravity pulls a horizontal projectile downward and rotates its artwork', () => {
    const f = fixture();
    try {
        f.attack.delivery.gravity_px_s2 = 300;
        const shot = f.combat.request_attack(f.actor, 'ranged', 0, { x: 1, y: 0 });
        const startY = shot.projectile_y;
        f.combat.step(0.2);
        assert.ok(shot.projectile_y < startY);
        assert.ok(shot.projectile_mesh.rotation.z < -0.3);
    } finally { f.restore(); }
});

test('angled aim can hit a target above without changing damage rules', () => {
    const f = fixture();
    try {
        const victim = f.enemy(70, 40);
        const dx = victim.mesh.position.x - f.actor.mesh.position.x;
        const dy = victim.mesh.position.y + victim.sprite.height / 2 -
            (f.actor.mesh.position.y + f.actor.sprite.height / 2);
        f.combat.request_attack(f.actor, 'ranged', 0, { x: dx, y: dy });
        f.combat.step(0.4);
        assert.equal(victim.energy, 85);
        assert.equal(f.combat.active.length, 0);
    } finally { f.restore(); }
});

test('projectile collision follows the arc and can hit the floor before reaching the full range', () => {
    const f = fixture();
    try {
        f.attack.delivery.range_px = 300;
        f.attack.delivery.speed_px_s = 120;
        f.attack.delivery.gravity_px_s2 = 400;
        f.game.data.sprites = [{ width: 200, height: 16, traits: { block_above: {} } }];
        f.game.active_level_sprites.push({ sprite_index: 0, mesh: { position: { x: 120, y: -16 } } });
        f.combat.request_attack(f.actor, 'ranged', 0, { x: 1, y: 0.2 });
        f.combat.step(1.0);
        assert.equal(f.combat.active.length, 0);
        assert.equal(f.game.scene.objects.length, 0);
    } finally { f.restore(); }
});

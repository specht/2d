const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { CombatSystem } = require('../src/static/combat.js');
const { register_swing } = require('../src/static/combat_swing.js');

function graphics() {
    const previous = global.THREE;
    global.THREE = {
        Mesh: class {
            constructor(geometry, material) {
                this.geometry = geometry;
                this.material = material;
                this.scale = { x: 1, y: 1, z: 1 };
                this.position = { set: (...values) => { this.coords = values; } };
            }
        },
    };
    return () => {
        if (previous === undefined) delete global.THREE;
        else global.THREE = previous;
    };
}

function fixture() {
    const atlas = { name: 'shared atlas' };
    const geometry = [{ name: 'frame 0' }, { name: 'frame 1' }, { name: 'frame 2' }];
    const slash = { width: 18, height: 12,
        states: [{ properties: { name: 'Schwung', fps: 10 }, frames: [{}, {}, {}] }] };
    const spark = { width: 12, height: 12,
        states: [{ properties: { name: 'Funken', fps: 10 }, frames: [{}, {}, {}] }] };
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], active_level_sprites: [], update_stats() {},
        data: { sprites: [slash, spark] },
        geometry_and_material_for_frame: [[geometry.map(frame => ({ geometry: frame, material: atlas }))],
            [geometry.map(frame => ({ geometry: frame, material: atlas }))]],
        scene: { objects: [], add(mesh) { this.objects.push(mesh); },
            remove(mesh) { this.objects = this.objects.filter(item => item !== mesh); } },
    };
    const attack = {
        id: 'melee', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
        visual: { kind: 'none', attack_sprite_index: 0, hit_sprite_index: 1 },
    };
    const actor = {
        game, active: true, character_trait: 'actor', energy: 100,
        mesh: { position: { x: 0, y: 0 } }, sprite: { width: 20, height: 20 },
        traits: { attacks: [attack] }, last_horizontal_facing: 'right', direction: 'right',
        take_damage(amount) { this.energy -= amount; },
        invincible() { return false; }, dead() { return false; }, die() {},
    };
    game.player_character = actor;
    function baddie(x) {
        const enemy = {
            game, active: true, character_trait: 'baddie', energy: 100,
            mesh: { position: { x, y: 0 } }, sprite: { width: 20, height: 20 },
            traits: { attacks: [attack] }, last_horizontal_facing: 'left',
            take_damage(amount) { this.energy -= amount; },
            invincible() { return false; }, dead() { return false; }, die() {},
        };
        game.baddies.push(enemy);
        return enemy;
    }
    const combat = new CombatSystem(game);
    register_swing(combat);
    return { game, actor, baddie, combat, atlas, geometry };
}

test('drawn attack sprite appears on swing start, mirrors left, and outlives the hitbox', () => {
    const restore = graphics();
    try {
        const { game, actor, combat, atlas, geometry } = fixture();
        const swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(game.scene.objects.length, 1);
        combat.step(0);
        assert.equal(game.scene.objects.length, 1);
        const mesh = game.scene.objects[0];
        assert.equal(mesh.geometry, geometry[0]);
        assert.equal(mesh.material, atlas);
        assert.ok(mesh.coords[0] > 0);
        assert.deepEqual(mesh.scale, { x: 1, y: 1, z: 1 });
        assert.equal(swing.expires_at, 0.15);
        combat.step(0.11);
        assert.equal(mesh.geometry, geometry[1]);
        combat.step(0.16);
        assert.equal(combat.active.length, 0);
        assert.deepEqual(game.scene.objects, [mesh]);
        combat.step(0.31);
        assert.deepEqual(game.scene.objects, []);

        actor.last_horizontal_facing = 'left';
        actor.direction = 'left';
        combat.request_attack(actor, 'melee', 1);
        combat.step(1);
        assert.equal(game.scene.objects.length, 1);
        const left = game.scene.objects[0];
        assert.ok(left.coords[0] < 0);
        assert.equal(left.scale.x, -1);
    } finally { restore(); }
});

test('attack sprite is independent from hit effects and does not change damage', () => {
    const restore = graphics();
    try {
        const { game, actor, baddie, combat } = fixture();
        const enemy = baddie(35);
        combat.request_attack(actor, 'melee', 0);
        assert.equal(enemy.energy, 80);
        assert.equal(game.scene.objects.length, 2); // hit and attack effects spawn immediately
        combat.step(0);
        assert.equal(game.scene.objects.length, 2); // both animate separately
        combat.step(0.31);
        assert.equal(enemy.energy, 80);
    } finally { restore(); }
});

test('reordering or deleting sprites remaps both hit and attack effect references', () => {
    const source = fs.readFileSync(require.resolve('../src/static/game.js'), 'utf8');
    const start = source.indexOf('remap_hit_sprite_references(translation, deletedIndex = null) {');
    const end = source.indexOf('\n    }\n\n    add_sprite_trait(trait) {', start);
    assert.ok(start >= 0 && end > start);
    const method = vm.runInNewContext(
        `({${source.slice(start, end)}\n    }}).remap_hit_sprite_references`);

    const game = {
        attack_sprite_picker: { refresh() {} },
        hit_sprite_picker: { refresh() {} },
        data: { sprites: [
            { traits: { actor: { attacks: [{ visual: { attack_sprite_index: 2, hit_sprite_index: 1 } }] } } },
            { traits: { melee_attack: { attack: { visual: { attack_sprite_index: 0, hit_sprite_index: 2 } } } } },
            { traits: { baddie: { attacks: [{ visual: { attack_sprite_index: 1 } }] } } },
        ] },
    };

    method.call(game, { 0: 2, 1: 0, 2: 1 });
    assert.deepEqual(game.data.sprites[0].traits.actor.attacks[0].visual,
        { attack_sprite_index: 1, hit_sprite_index: 0 });
    assert.deepEqual(game.data.sprites[1].traits.melee_attack.attack.visual,
        { attack_sprite_index: 2, hit_sprite_index: 1 });
    assert.deepEqual(game.data.sprites[2].traits.baddie.attacks[0].visual,
        { attack_sprite_index: 0 });

    method.call(game, { 0: 0, 2: 1 }, 1);
    assert.deepEqual(game.data.sprites[0].traits.actor.attacks[0].visual,
        { hit_sprite_index: 0 });
    assert.deepEqual(game.data.sprites[1].traits.melee_attack.attack.visual,
        { attack_sprite_index: 1 });
    assert.deepEqual(game.data.sprites[2].traits.baddie.attacks[0].visual,
        { attack_sprite_index: 0 });
});

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { CombatSystem } = require('../src/static/combat.js');
const { register_swing } = require('../src/static/combat_swing.js');

function fixture() {
    const atlas = { name: 'shared atlas', dispose() { throw Error('shared material disposed'); } };
    const geometry = [{ name: 'frame 0' }, { name: 'frame 1' }, { name: 'frame 2' }];
    const effect = { width: 16, height: 12,
        states: [{ properties: { name: 'Funken', fps: 10 }, frames: [{}, {}, {}] }] };
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], active_level_sprites: [],
        data: { sprites: [effect] }, update_stats() {},
        geometry_and_material_for_frame: [[geometry.map(frame => ({ geometry: frame, material: atlas }))]],
        scene: { objects: [], add(mesh) { this.objects.push(mesh); },
            remove(mesh) { this.objects = this.objects.filter(item => item !== mesh); } },
    };
    const attack = () => ({
        id: 'melee', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
        visual: { kind: 'none', hit_sprite_index: 0 },
    });
    const actor = {
        game, active: true, character_trait: 'actor',
        mesh: { position: { x: 0, y: 0 } }, sprite: { width: 20, height: 20 },
        traits: { attacks: [attack()] }, last_horizontal_facing: 'right',
        invincible() { return Boolean(this.no_damage); }, dead() { return false; }, die() {},
    };
    game.player_character = actor;
    function baddie(x, y = 0) {
        const enemy = {
            game, active: true, character_trait: 'baddie', energy: 100,
            mesh: { position: { x, y } }, sprite: { width: 20, height: 20 },
            traits: { attacks: [attack()] }, last_horizontal_facing: 'left',
            take_damage(amount) { this.energy -= amount;
                if (this.energy <= 0) this.active = false; },
        };
        game.baddies.push(enemy);
        return enemy;
    }
    const combat = new CombatSystem(game);
    register_swing(combat);
    return { game, actor, baddie, combat, atlas, geometry };
}

function graphics() {
    const previous = global.THREE;
    global.THREE = {
        Mesh: class {
            constructor(geometry, material) {
                this.geometry = geometry; this.material = material;
                this.scale = { x: 1, y: 1, z: 1 };
                this.position = { set: (...values) => { this.coords = values; } };
            }
        },
    };
    return () => { if (previous === undefined) delete global.THREE; else global.THREE = previous; };
}

test('a drawn hit sprite appears only after an accepted hit, aligned to game pixels', () => {
    const restore = graphics();
    try {
        const { game, actor, baddie, combat, atlas, geometry } = fixture();
        let swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(game.scene.objects.length, 0); // a miss has no impact sprite
        assert.equal(swing.expires_at, 0.15);
        combat.reset();
        const enemy = baddie(35.2, 0.5);
        swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(enemy.energy, 80);
        assert.equal(swing.expires_at, 0.15); // visuals do not prolong the attack
        assert.equal(combat.impacts.active.length, 1);
        const mesh = game.scene.objects[0];
        assert.deepEqual(mesh.coords, [35, 5, 3]);
        assert.equal(mesh.geometry, geometry[0]);
        assert.equal(mesh.material, atlas); // native-size atlas art, not a cloned texture
        assert.deepEqual(mesh.scale, { x: 1, y: 1, z: 1 }); // native sprite size
        combat.step(0.11);
        assert.equal(mesh.geometry, geometry[1]);
        combat.step(0.16);
        assert.equal(combat.active.length, 0);
        assert.deepEqual(game.scene.objects, [mesh]); // impact persists independently
        combat.step(0.23);
        assert.equal(mesh.geometry, geometry[2]);
        assert.equal(enemy.energy, 80); // animation does not deal extra damage
        combat.step(0.30);
        assert.deepEqual(game.scene.objects, []);
        assert.equal(combat.impacts.active.length, 0);
    } finally { restore(); }
});

test('one hit on two enemies creates two independent visuals; reset clears both', () => {
    const restore = graphics();
    try {
        const { game, actor, baddie, combat, atlas } = fixture();
        const one = baddie(35), two = baddie(39);
        const swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(one.energy, 80);
        assert.equal(two.energy, 80);
        assert.equal(swing.expires_at, 0.15);
        assert.equal(combat.impacts.active.length, 2);
        assert.notEqual(game.scene.objects[0], game.scene.objects[1]);
        assert.deepEqual(game.scene.objects.map(mesh => mesh.coords), [[35, 4, 3], [39, 4, 3]]);
        combat.reset();
        assert.equal(combat.impacts.active.length, 0);
        assert.equal(game.scene.objects.length, 0);
        assert.equal(atlas.name, 'shared atlas'); // never disposed
    } finally { restore(); }
});

test('both sides get effects, including lethal hits; rejection or missing art never changes damage', () => {
    const restore = graphics();
    try {
        const { game, actor, baddie, combat } = fixture();
        const enemy = baddie(35);
        enemy.energy = 10;
        combat.request_attack(actor, 'melee', 0);
        assert.equal(enemy.energy, -10);
        assert.equal(enemy.active, false);
        assert.equal(combat.impacts.active.length, 1); // death still has an impact
        combat.reset();
        const attacker = baddie(30);
        actor.no_damage = true;
        combat.request_attack(attacker, 'melee', 0);
        assert.equal(game.energy, 100);
        assert.equal(combat.impacts.active.length, 0);
        combat.reset();
        actor.no_damage = false;
        combat.request_attack(attacker, 'melee', 0);
        assert.equal(game.energy, 80);
        assert.equal(combat.impacts.active.length, 1);
        combat.reset();
        attacker.traits.attacks[0].visual.hit_sprite_index = 999;
        combat.request_attack(attacker, 'melee', 0);
        assert.equal(game.energy, 60);
        assert.equal(combat.impacts.active.length, 0);
        combat.reset();
        delete global.THREE;
        combat.request_attack(attacker, 'melee', 0);
        assert.equal(game.energy, 40);
        assert.equal(combat.impacts.active.length, 0);
    } finally { restore(); }
});

test('a blocked attack never spawns an impact; disabling combat clears the visual', () => {
    const restore = graphics();
    try {
        const { game, actor, baddie, combat } = fixture();
        const enemy = baddie(35);
        game.data.sprites.push({ width: 8, height: 24, traits: { door: {} } });
        const door = { sprite_index: 1, mesh: { position: { x: 20, y: 0 } }, door_closed: true };
        game.active_level_sprites = [door];
        combat.request_attack(actor, 'melee', 0);
        assert.equal(enemy.energy, 100);
        assert.equal(game.scene.objects.length, 0);
        door.door_closed = false;
        combat.request_attack(actor, 'melee', 0.7);
        assert.equal(enemy.energy, 80);
        assert.equal(game.scene.objects.length, 1);
        game.curtain.showing = true;
        combat.step(0.8);
        assert.equal(game.scene.objects.length, 0);
        assert.equal(combat.impacts.active.length, 0);
    } finally { restore(); }
});

test('sprite selector does not mutate saved attacks on opening and leaves the swoosh independent', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/static/game.js'), 'utf8');
    const start = source.indexOf('    add_melee_attack_trait_controls(div, si) {');
    const end = source.indexOf('    add_trait_help(div, label, explanation = null) {', start);
    assert.ok(start >= 0 && end > start);
    const fields = [];
    const Widget = class { constructor(options) { fields.push(options); } };
    const $ = () => ({ addClass() { return this; }, text() { return this; }, appendTo() { return this; } });
    const Editor = new Function('LineEditWidget', 'NumberWidget', 'SelectWidget', 'melee_attack_for_editor', '$',
        `return class Editor { ${source.slice(start, end)} };`)(Widget, Widget, Widget,
        (traits) => traits.melee_attack.attack, $);
    const attack = {
        id: 'melee', slot: 'nah', label: 'Faustschlag',
        delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
        visual: { kind: 'swoosh', sweep: 'down', reach_px: 29 },
    };
    const editor = new Editor();
    editor.data = { sprites: [
        { traits: { actor: {}, melee_attack: { attack } }, states: [{ properties: { name: '' } }] },
        { traits: {}, states: [{ properties: { name: 'Funken' } }] },
    ] };
    editor.add_trait_help = () => {};
    editor.build_sprite_traits_menu = () => {};
    const before = JSON.stringify(attack);
    editor.add_melee_attack_trait_controls({}, 0);
    assert.equal(JSON.stringify(attack), before);
    const hit = fields.find(field => field.label === 'Treffereffekt:');
    assert.deepEqual(hit.options, { none: 'aus', 0: 'Sprite 1', 1: 'Sprite 2 · Funken' });
    assert.equal(hit.get(), 'none');
    hit.set('1');
    assert.equal(hit.get(), '1');
    assert.equal(attack.visual.hit_sprite_index, 1);
    assert.equal(attack.visual.kind, 'swoosh');
    assert.equal(attack.visual.sweep, 'down');
    hit.set('none');
    assert.equal(hit.get(), 'none');
    assert.ok(!Object.hasOwn(attack.visual, 'hit_sprite_index'));
});

test('sprite reordering and deletion update modern and existing attack references', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/static/game.js'), 'utf8');
    const start = source.indexOf('    remap_hit_sprite_references(translation, deletedIndex = null) {');
    const end = source.indexOf('    add_sprite_trait(trait) {', start);
    assert.ok(start >= 0 && end > start);
    const Editor = new Function(`return class Editor { ${source.slice(start, end)} };`)();
    const editor = new Editor();
    const modern = { visual: { kind: 'swoosh', hit_sprite_index: 2 } };
    const legacy = { visual: { kind: 'none', hit_sprite_index: 1 } };
    const first = { traits: { melee_attack: { attack: modern } } };
    const second = { traits: { actor: { attacks: [legacy] } } };
    const third = { traits: {} };
    editor.data = { sprites: [third, first, second] }; // old index 2 moved to 0
    editor.remap_hit_sprite_references([1, 2, 0]);
    assert.equal(modern.visual.hit_sprite_index, 0);
    assert.equal(legacy.visual.hit_sprite_index, 2);
    editor.data.sprites = [first, second]; // old index 0 was deleted
    editor.remap_hit_sprite_references([0, 0, 1], 0);
    assert.ok(!Object.hasOwn(modern.visual, 'hit_sprite_index'));
    assert.equal(legacy.visual.hit_sprite_index, 1);
});

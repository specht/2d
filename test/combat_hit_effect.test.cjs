const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { CombatSystem } = require('../src/static/combat.js');
const { register_swing } = require('../src/static/combat_swing.js');

function fixture() {
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], active_level_sprites: [],
        data: { sprites: [] }, update_stats() {},
        scene: { objects: [], add(object) { this.objects.push(object); },
            remove(object) { this.objects = this.objects.filter(item => item !== object); } },
    };
    const attack = (hit_kind = 'none') => ({
        id: 'melee', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
        visual: { kind: 'none', hit_kind },
    });
    const actor = {
        game, active: true, character_trait: 'actor',
        mesh: { position: { x: 0, y: 0 } }, sprite: { width: 20, height: 20 },
        traits: { attacks: [attack()] }, last_horizontal_facing: 'right',
        invincible() { return Boolean(this.no_damage); }, dead() { return false; }, die() {},
    };
    game.player_character = actor;
    function baddie(x) {
        const enemy = {
            game, active: true, character_trait: 'baddie', energy: 100,
            mesh: { position: { x, y: 0 } }, sprite: { width: 20, height: 20 },
            traits: { attacks: [attack()] }, last_horizontal_facing: 'left',
            take_damage(amount) { this.energy -= amount; },
        };
        game.baddies.push(enemy);
        return enemy;
    }
    const combat = new CombatSystem(game);
    register_swing(combat);
    return { game, actor, baddie, combat };
}

function graphics() {
    const oldThree = global.THREE;
    const oldDocument = global.document;
    const text = [];
    const ctx = { translate() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
        fill() {}, stroke() {}, strokeText(...args) { text.push(args); },
        fillText(...args) { text.push(args); } };
    global.document = {
        createElement(tag) {
            assert.equal(tag, 'canvas');
            return { width: 0, height: 0, getContext(type) {
                assert.equal(type, '2d'); return ctx;
            } };
        },
    };
    global.THREE = {
        CanvasTexture: class { constructor(canvas) { this.canvas = canvas; }
            dispose() { this.disposed = true; } },
        SpriteMaterial: class { constructor(options) { Object.assign(this, options); }
            dispose() { this.disposed = true; } },
        Sprite: class {
            constructor(material) { this.material = material;
                this.position = { set: (...values) => { this.coords = values; } };
                this.scale = { set: (...values) => { this.dimensions = values; } };
            }
        },
    };
    return {
        text,
        restore() {
            if (oldThree === undefined) delete global.THREE; else global.THREE = oldThree;
            if (oldDocument === undefined) delete global.document; else global.document = oldDocument;
        },
    };
}

test('POW is shown only after an accepted hit, without requiring a swoosh or character art', () => {
    const gfx = graphics();
    try {
        const { game, actor, baddie, combat } = fixture();
        actor.traits.attacks[0].visual.hit_kind = 'pow';
        let swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(swing.expires_at, 0.15);
        assert.equal(game.scene.objects.length, 0); // swinging into empty space
        combat.reset();
        const enemy = baddie(35);
        swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(enemy.energy, 80);
        assert.equal(game.scene.objects.length, 1);
        assert.equal(swing.hit_effects.length, 1);
        assert.ok(gfx.text.some(args => args[0] === 'POW'));
        assert.equal(swing.visual_mesh, undefined); // no swoosh
        assert.equal(swing.expires_at, 0.28);
        const sprite = game.scene.objects[0];
        assert.deepEqual(sprite.coords, [35, 10, 3]);
        combat.step(0.17);
        assert.equal(game.scene.objects.length, 1);
        assert.equal(enemy.energy, 80); // effect never reapplies damage
        combat.step(0.29);
        assert.equal(game.scene.objects.length, 0);
        assert.equal(sprite.material.disposed, true);
        assert.equal(sprite.material.map.disposed, true);
    } finally { gfx.restore(); }
});

test('Trefferstern works for enemy attacks, multiple targets and combat reset', () => {
    const gfx = graphics();
    try {
        const { game, actor, baddie, combat } = fixture();
        const one = baddie(35);
        const two = baddie(39);
        actor.traits.attacks[0].visual.hit_kind = 'star';
        let swing = combat.request_attack(actor, 'melee', 0);
        assert.equal(one.energy, 80);
        assert.equal(two.energy, 80);
        assert.equal(swing.hit_effects.length, 2);
        assert.equal(game.scene.objects.length, 2);
        assert.equal(gfx.text.length, 0); // star is an image without lettering
        combat.reset();
        assert.equal(game.scene.objects.length, 0);
        one.traits.attacks[0].visual.hit_kind = 'pow';
        swing = combat.request_attack(one, 'melee', 0);
        assert.equal(game.energy, 80);
        assert.equal(swing.hit_effects.length, 1);
        game.curtain.showing = true;
        combat.step(0.05);
        assert.equal(game.scene.objects.length, 0);
        assert.equal(combat.active.length, 0);
    } finally { gfx.restore(); }
});

test('Swoosh keeps its original timing while POW persists and cleans up separately', () => {
    const gfx = graphics();
    Object.assign(global.THREE, {
        DoubleSide: 2,
        BufferAttribute: class { constructor(array) { this.array = array; } },
        BufferGeometry: class {
            constructor() { this.attributes = {}; }
            setAttribute(name, value) { this.attributes[name] = value; }
            setIndex() {}
            dispose() { this.disposed = true; }
        },
        MeshBasicMaterial: class {
            constructor(options) { Object.assign(this, options); }
            dispose() { this.disposed = true; }
        },
        Mesh: class {
            constructor(geometry, material) { this.geometry = geometry; this.material = material; }
        },
    });
    try {
        const { game, actor, baddie, combat } = fixture();
        baddie(35);
        actor.traits.attacks[0].visual = { kind: 'swoosh', sweep: 'up', hit_kind: 'pow' };
        const swing = combat.request_attack(actor, 'melee', 0);
        assert.ok(swing.visual_mesh);
        assert.equal(game.scene.objects.length, 2);
        const swoosh = swing.visual_mesh;
        const hit = swing.hit_effects[0].sprite;
        combat.step(0.10);
        assert.ok(swoosh.material.opacity > 0);
        combat.step(0.16);
        assert.equal(swing.visual_mesh, null);
        assert.equal(swoosh.geometry.disposed, true);
        assert.deepEqual(game.scene.objects, [hit]);
        combat.reset();
        assert.equal(game.scene.objects.length, 0);
        assert.equal(hit.material.map.disposed, true);
    } finally { gfx.restore(); }
});

test('Blocked and invincible targets have no hit effect; missing renderer never changes damage', () => {
    const gfx = graphics();
    try {
        const { game, actor, baddie, combat } = fixture();
        const enemy = baddie(35);
        actor.traits.attacks[0].visual.hit_kind = 'pow';
        const door = { sprite_index: 0, mesh: { position: { x: 20, y: 0 } }, door_closed: true };
        game.data.sprites.push({ width: 8, height: 24, traits: { door: {} } });
        game.active_level_sprites = [door];
        combat.request_attack(actor, 'melee', 0);
        assert.equal(game.scene.objects.length, 0);
        assert.equal(enemy.energy, 100);
        door.door_closed = false;
        combat.request_attack(actor, 'melee', 0.7);
        assert.equal(game.scene.objects.length, 1);
        assert.equal(enemy.energy, 80);
        combat.reset();
        enemy.traits.attacks[0].visual.hit_kind = 'pow';
        actor.no_damage = true;
        combat.request_attack(enemy, 'melee', 0);
        assert.equal(game.scene.objects.length, 0);
        assert.equal(game.energy, 100);
        combat.reset();
        actor.no_damage = false;
        delete global.document;
        combat.request_attack(enemy, 'melee', 0);
        assert.equal(game.energy, 80);
        assert.equal(game.scene.objects.length, 0);
    } finally { gfx.restore(); }
});

test('Treffereffekt editor preserves independent existing swoosh and legacy data', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/static/game.js'), 'utf8');
    const start = source.indexOf('    add_melee_attack_trait_controls(div, si) {');
    const end = source.indexOf('    add_trait_help(div, label, explanation = null) {', start);
    assert.ok(start >= 0 && end > start);
    const fields = [];
    const widget = class { constructor(options) { fields.push(options); } };
    const $ = () => ({ text() { return this; }, appendTo() { return this; } });
    const Editor = new Function('LineEditWidget', 'NumberWidget', 'SelectWidget', 'melee_attack_for_editor', '$',
        `return class Editor { ${source.slice(start, end)} };`)(widget, widget, widget,
        (traits) => traits.melee_attack.attack, $);
    const attack = {
        id: 'sword', slot: 'nah', label: 'Faustschlag',
        delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
        visual: { kind: 'swoosh', sweep: 'down', reach_px: 29 },
    };
    const editor = new Editor();
    editor.data = { sprites: [{ traits: { actor: {}, melee_attack: { attack } } }] };
    editor.add_trait_help = () => {};
    editor.build_sprite_traits_menu = () => {};
    const before = JSON.stringify(attack);
    editor.add_melee_attack_trait_controls({}, 0);
    assert.equal(JSON.stringify(attack), before); // merely opening does not migrate JSON
    const hit = fields.find(field => field.label === 'Treffereffekt:');
    assert.ok(hit);
    assert.deepEqual(hit.options, { none: 'aus', star: 'Trefferstern', pow: 'POW' });
    assert.equal(hit.get(), 'none');
    hit.set('pow');
    assert.equal(hit.get(), 'pow');
    assert.deepEqual(attack.visual, { kind: 'swoosh', sweep: 'down', reach_px: 29, hit_kind: 'pow' });
    hit.set('star');
    assert.equal(hit.get(), 'star');
    hit.set('none');
    assert.equal(hit.get(), 'none');
    assert.equal(attack.visual.sweep, 'down');
    assert.equal(attack.visual.reach_px, 29);
});

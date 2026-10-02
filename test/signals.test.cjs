const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const signals = require('../src/static/signals.js');
const { SignalBus, SIGNAL_MAX_DEPTH, door_signal_action, layer_reacts_to_signals,
    layer_visible_at_start, layer_visible_after, switch_flipped } = signals;

// ------------------------------------------------------------ pure helpers

test('a door without door_reaction unlocks on "an", like a key always did', () => {
    assert.equal(door_signal_action(undefined, true, true), 'unlock');
    assert.equal(door_signal_action(undefined, false, true), null);
    assert.equal(door_signal_action('something new', true, true), 'unlock');
});

test('door reactions', () => {
    assert.equal(door_signal_action('open', true, true), 'open');
    assert.equal(door_signal_action('open', false, true), null);
    assert.equal(door_signal_action('close', true, false), 'close');
    assert.equal(door_signal_action('follow', true, true), 'open');
    assert.equal(door_signal_action('follow', false, false), 'close');
    // "wechseln" reacts to every signal, "an" or "aus"
    assert.equal(door_signal_action('toggle', true, true), 'open');
    assert.equal(door_signal_action('toggle', false, false), 'close');
});

test('layer reactions', () => {
    assert.equal(layer_reacts_to_signals(undefined), false);
    assert.equal(layer_reacts_to_signals({}), false);
    assert.equal(layer_reacts_to_signals({ signal_reaction: 'none' }), false);
    assert.equal(layer_reacts_to_signals({ signal_reaction: 'unknown' }), false);
    assert.equal(layer_reacts_to_signals({ signal_reaction: 'appear', signal_code: 3 }), true);
    assert.equal(layer_visible_at_start('appear'), false);
    assert.equal(layer_visible_at_start('while_on'), false);
    assert.equal(layer_visible_at_start('disappear'), true);
    assert.equal(layer_visible_at_start('while_off'), true);
    assert.equal(layer_visible_at_start('toggle'), true);
    // appear / disappear happen once and stay
    assert.equal(layer_visible_after('appear', true, false), true);
    assert.equal(layer_visible_after('appear', false, true), true);
    assert.equal(layer_visible_after('disappear', true, true), false);
    assert.equal(layer_visible_after('disappear', false, false), false);
    assert.equal(layer_visible_after('while_on', false, true), false);
    assert.equal(layer_visible_after('while_off', true, true), false);
    assert.equal(layer_visible_after('while_off', false, false), true);
    assert.equal(layer_visible_after('toggle', false, true), false);
    assert.equal(layer_visible_after('toggle', true, false), true);
});

test('a layer fades, and a fade reversed halfway goes on from where it is', () => {
    const { signal_fade_alpha, SIGNAL_LAYER_FADE_SECONDS: T } = signals;
    assert.equal(signal_fade_alpha({ from: 0, to: 1, started_at: 2 }, 2), 0);
    assert.ok(Math.abs(signal_fade_alpha({ from: 0, to: 1, started_at: 2 }, 2 + T / 2) - 0.5) < 1e-9);
    assert.equal(signal_fade_alpha({ from: 0, to: 1, started_at: 2 }, 2 + T * 3), 1);
    // back to 0 from 0.5 takes half the time
    assert.ok(signal_fade_alpha({ from: 0.5, to: 0, started_at: 3 }, 3 + T / 2) < 1e-9);
    assert.equal(signal_fade_alpha({ from: 1, to: 1, started_at: 0 }, 5), 1);
    assert.equal(signal_fade_alpha(undefined, 5), 1);
});

test('a switch flips when the key goes down, not while it is held', () => {
    assert.equal(switch_flipped(true, false), true);
    assert.equal(switch_flipped(true, true), false);
    assert.equal(switch_flipped(false, true), false);
    assert.equal(switch_flipped(false, undefined), false);
});

test('the bus delivers to every receiver of a Code, in order', () => {
    const bus = new SignalBus();
    const heard = [];
    bus.connect(3, (value) => heard.push(['a', value]));
    bus.connect('3', (value) => heard.push(['b', value]));
    bus.connect(4, () => heard.push(['other']));
    bus.emit(3, 1);
    bus.emit(3.0, false);
    bus.emit(5, true); // nobody listens: nothing happens
    assert.deepEqual(heard, [['a', true], ['b', true], ['a', false], ['b', false]]);
    assert.deepEqual(bus.sent, [[3, true], [3, false], [5, true]]);
    assert.equal(bus.emit(undefined, true), false);
    assert.equal(bus.emit('kein Code', true), false);
});

test('a receiver that sends again cannot loop forever', () => {
    const bus = new SignalBus();
    let calls = 0;
    bus.connect(1, (value) => { calls++; bus.emit(1, !value); });
    bus.emit(1, true);
    assert.equal(calls, SIGNAL_MAX_DEPTH);
    assert.equal(bus.depth, 0);
    // and the bus still works afterwards
    calls = 0;
    bus.connect(2, () => calls++);
    bus.emit(2, true);
    assert.equal(calls, 1);
});

// ------------------------------------------- the runtime parts of app.js
// The signal methods of Game, taken from app.js as they are, on a small level.

const static_dir = path.join(__dirname, '../src/static');
const app = fs.readFileSync(path.join(static_dir, 'app.js'), 'utf8');
function slice(from, to) {
    const begin = app.indexOf(from);
    const end = app.indexOf(to, begin);
    assert.ok(begin >= 0 && end > begin, `${from} … ${to}`);
    return app.slice(begin, end);
}
const methods = [
    slice('\t// Level sprites whose rectangle overlaps', '\n\thas_baddie_at('),
    slice('\tupdate_layer_visibility(', '\n\trender() {'),
    slice('\t// force: moved by a signal', '\n};\n\nclass TouchControl'),
].join('\n');
// in this realm: the tree checks `instanceof Array` on the intervals it gets
const IntervalTree = new Function(
    fs.readFileSync(path.join(static_dir, 'interval_tree.js'), 'utf8') + '\nreturn IntervalTree;')();
const LayerFade = require('../src/static/layer_fade.js');
const quiet = { log() {}, warn() {} };
const GameSignals = new Function('SignalBus', 'door_signal_action', 'layer_reacts_to_signals',
    'layer_visible_at_start', 'layer_visible_after', 'signal_fade_alpha', 'layer_fade_seconds',
    'valid_signal_rect', 'point_in_signal_rects', 'LayerFade', 'console',
    `return class { ${methods} };`)(SignalBus, door_signal_action, layer_reacts_to_signals,
    layer_visible_at_start, layer_visible_after, signals.signal_fade_alpha, signals.layer_fade_seconds,
    signals.valid_signal_rect, signals.point_in_signal_rects, LayerFade, quiet);

const state = (trait, name, frames = 1) => ({ traits: { [trait]: { [name]: {} } }, properties: { fps: 8 }, frames: Array(frames).fill({}) });
const SPRITES = [
    { width: 24, height: 24, traits: { block_above: {}, block_sides: {} }, states: [{ traits: {}, frames: [{}] }] }, // 0 Block
    { width: 24, height: 24, traits: { door: { lockable: false, closable: false } },
        states: [state('door', 'closed'), state('door', 'open')] }, // 1 Tür ohne Übergang
    { width: 24, height: 24, traits: { switch: {} }, states: [state('switch', 'off'), state('switch', 'on')] }, // 2 Schalter
    { width: 24, height: 6, traits: { pressure_plate: {} }, states: [state('pressure_plate', 'up'), state('pressure_plate', 'down')] }, // 3 Druckplatte
    { width: 24, height: 24, traits: { door: { lockable: true } },
        states: [state('door', 'closed'), state('door', 'open'), state('door', 'transition', 4)] }, // 4 Tür mit Übergang
    { width: 24, height: 24, traits: { actor: {} }, states: [{ traits: {}, frames: [{}] }] }, // 5 Spielfigur
    { width: 24, height: 24, traits: { baddie: {} }, states: [{ traits: {}, frames: [{}] }] }, // 6 Gegner
];

// layers: [{ properties, sprites: [[si, x, y, entry props]] }]; every sprite of
// a layer with collision becomes an entry, as in Game.setup().
function level_game(layers, level_properties = {}) {
    const game = new GameSignals();
    let uuid = 0;
    Object.assign(game, {
        data: { sprites: SPRITES },
        interval_tree_x: new IntervalTree(), interval_tree_y: new IntervalTree(),
        active_level_sprites: [], state_for_mesh: {}, transitioning_sprites: {}, found_keys: {},
        layers: [], player_character: null, baddies: [],
        now: 0, clock: { getElapsedTime: () => game.now },
    });
    layers.forEach((layer, li) => {
        game.layers.push({ visible: true });
        for (const [si, x, y, props] of layer.sprites ?? []) {
            const sprite = SPRITES[si];
            const mesh = { uuid: `m${uuid++}`, position: { x, y }, userData: {} };
            game.state_for_mesh[mesh.uuid] = { state_index: 0, frame_index: 0 };
            if ('actor' in sprite.traits) {
                game.player_character = { layer_index: li, mesh, sprite: { width: 24, height: 24 } };
                continue;
            }
            if ('baddie' in sprite.traits) {
                game.baddies.push({ layer_index: li, mesh, active: true, placed_signal: props?.baddie ?? null });
                continue;
            }
            const index = game.active_level_sprites.length;
            game.interval_tree_x.insert([x - sprite.width / 2, x + sprite.width / 2], index);
            game.interval_tree_y.insert([y, y + sprite.height], index);
            game.active_level_sprites.push({ layer_index: li, sprite_index: si, mesh, door_state: 'idle', ...props });
        }
    });
    game.setup_signals({ layers, properties: level_properties });
    return game;
}
const entry_state = (game, index) => game.state_for_mesh[game.active_level_sprites[index].mesh.uuid].state_index;
const figure = (x, y) => ({ mesh: { position: { x, y } }, sprite: { width: 24, height: 24 },
    traits: { ex_left: 1, ex_right: 1, ex_top: 1 }, dead: () => false });

test('a switch opens a door and lets a bridge appear, and the bridge then carries', () => {
    const game = level_game([
        { properties: {}, sprites: [
            [1, 200, 0, { signal_code: 7, door_closed: true, door_reaction: 'follow' }],
            [2, 100, 0, { signal_code: 7, switch_on: false }],
        ] },
        { properties: { signal_code: 7, signal_reaction: 'while_on' }, sprites: [[0, 300, 0, {}]] },
    ]);
    const bridge_hits = () => game.collision_candidates(290, 310, 5, 10);
    // the bridge starts away: not drawn and not there
    assert.equal(game.layers[1].visible, false);
    assert.deepEqual(bridge_hits(), []);
    assert.equal(entry_state(game, 1), 0); // Schalter ist aus

    game.flip_switch(1, 1.0);
    assert.equal(game.active_level_sprites[1].switch_on, true);
    assert.equal(entry_state(game, 1), 1); // Schalter ist an
    assert.equal(game.active_level_sprites[0].door_closed, false);
    // the bridge carries at once; its drawing fades in
    assert.deepEqual(bridge_hits(), [2]);
    game.now = signals.SIGNAL_LAYER_FADE_SECONDS / 2;
    game.update_layer_visibility();
    assert.equal(game.layers[1].visible, true);
    assert.ok(Math.abs(game.signal_layer_fades.get(1).alpha - 0.5) < 1e-9);
    game.now = 1;
    game.update_layer_visibility();
    assert.equal(game.signal_layer_fades.get(1).alpha, 1);

    game.flip_switch(1, 2.0);
    assert.equal(game.active_level_sprites[0].door_closed, true);
    assert.deepEqual(bridge_hits(), []); // gone at once, while it fades out
    game.update_layer_visibility();
    assert.equal(game.layers[1].visible, true);
    game.now = 2;
    game.update_layer_visibility();
    assert.equal(game.layers[1].visible, false);
    assert.deepEqual(game.signals.sent, [[7, true], [7, false]]);
});

test('a door without door_reaction behaves exactly like before: a key unlocks it', () => {
    const game = level_game([{ properties: {}, sprites: [
        [4, 200, 0, { signal_code: 2, door_closed: true }],
    ] }]);
    game.signals.emit(2, true, 1.0); // a key with Code 2 was collected
    assert.equal(game.found_keys[2], true);
    assert.equal(game.active_level_sprites[0].door_closed, true); // it waits for the figure
    assert.equal(game.transitioning_sprites.transition, undefined);
});

test('a Druckplatte sends an and aus, and a door follows it', () => {
    const game = level_game([{ properties: {}, sprites: [
        [3, 100, 0, { signal_code: 5 }],
        [1, 200, 0, { signal_code: 5, door_closed: true, door_reaction: 'follow' }],
    ] }]);
    game.update_pressure_plates(figure(40, 0), 0.1);
    assert.deepEqual(game.signals.sent, []);
    game.update_pressure_plates(figure(100, 0), 0.2);
    assert.equal(entry_state(game, 0), 1);
    assert.equal(game.active_level_sprites[1].door_closed, false);
    game.update_pressure_plates(figure(102, 0), 0.3); // still on it: nothing new
    game.update_pressure_plates(figure(160, 0), 0.4);
    assert.equal(entry_state(game, 0), 0);
    assert.equal(game.active_level_sprites[1].door_closed, true);
    assert.deepEqual(game.signals.sent, [[5, true], [5, false]]);
});

test('a moving door does the last signal when it is done', () => {
    const game = level_game([{ properties: {}, sprites: [
        [4, 200, 0, { signal_code: 1, door_closed: true, door_reaction: 'follow' }],
    ] }]);
    const door = game.active_level_sprites[0];
    game.signals.emit(1, true, 0.0); // locked door, but a signal moves it anyway
    assert.equal(door.door_state, 'opening');
    game.signals.emit(1, false, 0.1); // stepped off again at once
    assert.equal(door.door_signal_pending, 'close');
    // what render() does when the animation is over
    game.transitioning_sprites.transition[0].done();
    delete game.transitioning_sprites.transition[0];
    game.move_door_by_signal(0, door.door_signal_pending, 1.0);
    assert.equal(door.door_closed, false);
    assert.equal(door.door_state, 'closing');
    assert.equal(door.door_signal_pending, null);
});

test('"wechseln" goes by where a moving door is heading', () => {
    const game = level_game([{ properties: {}, sprites: [
        [4, 200, 0, { signal_code: 1, door_closed: true, door_reaction: 'toggle' }],
    ] }]);
    const door = game.active_level_sprites[0];
    game.signals.emit(1, true, 0.0);
    assert.equal(door.door_state, 'opening');
    game.signals.emit(1, true, 0.1);
    assert.equal(door.door_signal_pending, 'close');
    game.signals.emit(1, true, 0.2);
    assert.equal(door.door_signal_pending, 'open');
});

test('a layer with the figure on it does not react', () => {
    const game = level_game([
        { properties: { signal_code: 1, signal_reaction: 'appear' }, sprites: [[5, 0, 0, {}], [0, 50, 0, {}]] },
    ]);
    assert.equal(game.layers[0].visible, true);
    assert.deepEqual(game.collision_candidates(45, 55, 5, 10), [0]);
});

test('a Bereich sends an and aus; a roof is away while the figure is inside, at once at the start', () => {
    const area = { type: 'signal_area', properties: { signal_code: 4 }, sprites: [],
        rects: [{ left: 100, bottom: 0, width: 100, height: 100 }] };
    const roof = { properties: { signal_code: 4, signal_reaction: 'while_off', signal_fade: 0.5 }, sprites: [[0, 150, 48, {}]] };
    // the figure starts inside the house
    const game = level_game([{ properties: {}, sprites: [[5, 150, 0, {}]] }, area, roof]);
    game.update_layer_visibility();
    assert.equal(game.layers[2].visible, false); // no fade at the start
    assert.deepEqual(game.signals.sent, [[4, true]]);
    // out of the house: the roof fades in over 0.5 s and is there at once
    game.player_character.mesh.position.x = 20;
    game.now = 1;
    game.update_signal_areas(1);
    assert.deepEqual(game.signals.sent, [[4, true], [4, false]]);
    assert.deepEqual(game.collision_candidates(145, 155, 50, 60), [0]);
    game.now = 1.25;
    game.update_layer_visibility();
    assert.ok(Math.abs(game.signal_layer_fades.get(2).alpha - 0.5) < 1e-9);
    game.update_signal_areas(1.3); // still outside: nothing new
    assert.equal(game.signals.sent.length, 2);
});

test('a defeated enemy sends its Code; "alle Gegner besiegt" counts only enemies that are there', () => {
    const game = level_game([
        { properties: {}, sprites: [[5, 0, 0, {}],
            [6, 100, 0, { baddie: { signal_on_defeat: true, signal_code: 2 } }],
            [6, 140, 0, {}]] },
        // the second wave waits on a layer that appears on Code 9
        { properties: { signal_code: 9, signal_reaction: 'appear', signal_fade: 0 }, sprites: [[6, 200, 0, {}]] },
    ], { signal_all_defeated: 9 });
    const [first, second, wave] = game.baddies;
    assert.equal(wave.signal_hidden, true);
    first.active = false; game.baddie_defeated(first, 1);
    assert.deepEqual(game.signals.sent, [[2, true]]);
    second.active = false; game.baddie_defeated(second, 2); // sends nothing itself
    // no enemy left that is there: the level sends 9, and the wave appears
    assert.deepEqual(game.signals.sent, [[2, true], [9, true]]);
    assert.equal(wave.signal_hidden, false);
    wave.active = false; game.baddie_defeated(wave, 3);
    assert.deepEqual(game.signals.sent, [[2, true], [9, true], [9, true]]);
});

test('an enemy on a layer that is away fades with it', () => {
    const game = level_game([
        { properties: {}, sprites: [[5, 0, 0, {}]] },
        { properties: { signal_code: 1, signal_reaction: 'appear' }, sprites: [[6, 100, 0, {}]] },
    ]);
    assert.equal(game.baddies[0].mesh.userData.signal_layer, 1);
    assert.equal(game.baddies[0].signal_hidden, true);
});

// ------------------------------------------------- the editor's code line

test('the editor tells what else in the level has a Code', () => {
    const { signal_partners, describe_signal_partners } = signals;
    const traits = { k: { key: {} }, s: { switch: {} }, p: { pressure_plate: {} }, d: { door: {} }, b: { block_above: {} } };
    const level = { layers: [
        { type: 'sprites', properties: {}, sprites: [
            ['s', 0, 0, { switch: { signal_code: 3 } }],
            ['d', 0, 0, { door: { signal_code: 3 } }],
            ['d', 0, 0, { door: { signal_code: 3, door_reaction: 'open' } }],
            ['k', 0, 0], // no Code stored: 0
            ['d', 0, 0, { door: { signal_code: 0 } }],
            ['b', 0, 0],
        ] },
        { type: 'sprites', properties: { name: 'Brücke', signal_code: 3, signal_reaction: 'appear' }, sprites: [] },
        { type: 'sprites', properties: { signal_code: 3, signal_reaction: 'none' }, sprites: [] },
        { type: 'sprites', properties: { signal_code: 3, signal_reaction: 'toggle' }, sprites: [] },
        { type: 'backdrop', properties: {} },
    ] };
    const of = (code) => signal_partners(level, code, ref => traits[ref]);
    assert.deepEqual(of(3), { counts: { switch: 1, door: 2 }, layers: ['Brücke', 'Ebene 4'], areas: [], all_defeated: false });
    assert.equal(describe_signal_partners(3, of(3)),
        'Code 3 in diesem Level – sendet: 1 Schalter · reagiert: 2 Türen, Ebene »Brücke«, Ebene »Ebene 4«');
    assert.equal(describe_signal_partners(0, of(0)), 'Code 0 in diesem Level – sendet: 1 Schlüssel · reagiert: 1 Tür');
    assert.equal(describe_signal_partners(9, of(9)), 'Code 9 in diesem Level – noch nichts sendet diesen Code');
    const plate_only = signal_partners({ layers: [{ type: 'sprites', properties: {}, sprites: [['p', 0, 0, { pressure_plate: { signal_code: 5 } }]] }] }, 5, ref => traits[ref]);
    assert.equal(describe_signal_partners(5, plate_only), 'Code 5 in diesem Level – sendet: 1 Druckplatte · noch nichts reagiert darauf');
});

// ------------------------------------------------------- older games

test('door codes of older games become signal_code; a new Code wins', () => {
    const { promote_legacy_signals } = signals;
    const data = {
        sprites: [{ traits: { baddie: { drop: { sprite_id: 's1', door_code: 3 } } } }, { traits: {} }],
        levels: [{ layers: [{ type: 'sprites', properties: {}, sprites: [
            ['k', 0, 0, { key: { door_code: 7 } }],
            ['d', 0, 0, { door: { door_code: 7, door_closed: true } }],
            ['d', 0, 0, { door: { door_code: 1, signal_code: 5 } }],
            ['b', 0, 0],
        ] }] }],
    };
    promote_legacy_signals(data);
    assert.deepEqual(data.sprites[0].traits.baddie.drop, { sprite_id: 's1', signal_code: 3 });
    assert.deepEqual(data.levels[0].layers[0].sprites.map(p => p[3]), [
        { key: { signal_code: 7 } }, { door: { signal_code: 7, door_closed: true } }, { door: { signal_code: 5 } }, undefined]);
    const again = JSON.stringify(data);
    promote_legacy_signals(data);
    assert.equal(JSON.stringify(data), again);
});

test('a Sichtbarkeitsbereich becomes a Bereich with a free Code and its target reacts to it', () => {
    const { promote_legacy_signals } = signals;
    const rect = { left: 0, bottom: 0, width: 50, height: 50 };
    const level = () => ({ layers: [
        { type: 'sprites', id: 'fassade', properties: { name: 'Fassade' }, sprites: [['k', 0, 0, { key: { door_code: 1 } }]] },
        { type: 'backdrop', id: 'dunkel', properties: {} },
        { type: 'sprites', id: 'leer', properties: {}, sprites: [] },
        { type: 'visibility_region', properties: { name: 'Haus' }, target_layer_id: 'fassade', rects: [rect], inside_visible: false, fade_seconds: 0.6 },
        { type: 'visibility_region', properties: {}, target_layer_id: 'dunkel', rects: [rect], inside_visible: true },
        { type: 'visibility_region', properties: {}, target_layer_id: 'nirgends', rects: [rect] },
        { type: 'visibility_region', properties: {}, target_layer_id: 'leer', rects: [] },
    ] });
    const data = { sprites: [], levels: [level()] };
    promote_legacy_signals(data);
    const [fassade, dunkel, leer, haus, b2, b3, b4] = data.levels[0].layers;
    // Code 1 is taken by the key: the Bereiche get 2, 3, 4, 5
    assert.deepEqual(haus, { type: 'signal_area', properties: { name: 'Haus', signal_code: 2 }, rects: [rect] });
    assert.deepEqual(fassade.properties, { name: 'Fassade', signal_code: 2, signal_reaction: 'while_off', signal_fade: 0.6 });
    assert.deepEqual(dunkel.properties, { signal_code: 3, signal_reaction: 'while_on', signal_fade: 0 });
    assert.equal(b3.type, 'signal_area');
    assert.equal(b3.properties.signal_code, 4);
    assert.equal(b4.properties.signal_code, 5);
    assert.deepEqual(leer.properties, {}); // a region without rectangles never showed anything
    assert.equal(b2.target_layer_id, undefined);
    // deterministic: the same JSON always becomes the same
    const other = { sprites: [], levels: [level()] };
    promote_legacy_signals(other);
    assert.equal(JSON.stringify(other), JSON.stringify(data));
});

test('the editor line knows Bereiche, enemies and "alle Gegner besiegt"', () => {
    const { signal_partners, describe_signal_partners, free_signal_code } = signals;
    const traits = { g: { baddie: {} }, d: { door: {} } };
    const level = { properties: { signal_all_defeated: 6 }, layers: [
        { type: 'sprites', properties: {}, sprites: [
            ['g', 0, 0, { baddie: { signal_on_defeat: true, signal_code: 6 } }],
            ['g', 0, 0, { baddie: { signal_code: 6 } }], // does not send
            ['d', 0, 0, { door: { signal_code: 6 } }],
        ] },
        { type: 'signal_area', properties: { name: 'Haus', signal_code: 6 }, rects: [] },
    ] };
    assert.equal(describe_signal_partners(6, signal_partners(level, 6, ref => traits[ref])),
        'Code 6 in diesem Level – sendet: 1 Gegner, Bereich »Haus«, alle Gegner besiegt · reagiert: 1 Tür');
    assert.equal(free_signal_code(level), 1);
    level.layers[0].sprites.push(['d', 0, 0, { door: { signal_code: 1 } }]);
    assert.equal(free_signal_code(level), 2);
});

// ------------------------------------------- level editor: see and connect

const editor_traits = { s: { switch: {} }, p: { pressure_plate: {} }, d: { door: {} }, k: { key: {} },
    g: { baddie: {} }, b: { block_above: {} }, P: { actor: {} } };
const editor_size = (ref) => (ref in editor_traits ? { width: 24, height: 24 } : null);
const editor_level = () => ({ properties: {}, layers: [
    { type: 'sprites', properties: {}, sprites: [['P', 12, 0], ['s', 60, 0], ['d', 200, 0], ['g', 120, 0]] },
    { type: 'sprites', properties: { name: 'Brücke' }, sprites: [['b', 300, 0], ['b', 324, 0]] },
    { type: 'signal_area', properties: { name: 'Haus', signal_code: 9 }, rects: [{ left: 400, bottom: 0, width: 50, height: 50 }] },
    { type: 'sprites', properties: { name: 'Dach', signal_code: 9, signal_reaction: 'while_off' }, sprites: [['b', 420, 60]] },
] });

test('the editor finds what sends and reacts, and links senders to receivers', () => {
    const { signal_objects, signal_links } = signals;
    const objects = signal_objects(editor_level(), r => editor_traits[r], editor_size);
    assert.deepEqual(objects.map(o => [o.kind, o.layer_index, o.placed_index, o.code, o.sends]), [
        ['sprite', 0, 1, 0, true], ['sprite', 0, 2, 0, false], // the enemy does not send yet
        ['area', 2, undefined, 9, true], ['layer', 3, undefined, 9, false]]);
    assert.deepEqual(objects[3].rect, { x0: 408, x1: 432, y0: 60, y1: 84 });
    const links = signal_links(objects);
    assert.deepEqual(links.map(l => [l.from.kind, l.to.kind, l.code]), [['sprite', 'sprite', 0], ['area', 'layer', 9]]);
    assert.deepEqual(signal_links(objects, new Set([9])).length, 1);
});

test('picking: a sprite that sends or reacts first, else its layer, else a Bereich', () => {
    const { pick_signal_object } = signals;
    const pick = (x, y) => pick_signal_object(editor_level(), x, y, r => editor_traits[r], editor_size, 0);
    assert.deepEqual([pick(60, 10).kind, pick(60, 10).trait], ['sprite', 'switch']);
    assert.deepEqual([pick(120, 10).trait, pick(120, 10).code], ['baddie', null]);
    assert.deepEqual([pick(310, 10).kind, pick(310, 10).layer_index, pick(310, 10).code], ['layer', 1, null]);
    assert.equal(pick(12, 10), null); // the player's layer is never a target
    assert.deepEqual([pick(440, 10).kind, pick(440, 10).code], ['area', 9]);
    assert.equal(pick(-100, -100), null);
});

test('connecting: a free Code, sensible reactions, and a Code in use is kept', () => {
    const { pick_signal_object, connect_signal_objects } = signals;
    const level = editor_level();
    const t = r => editor_traits[r];
    const pick = (x, y) => pick_signal_object(level, x, y, t, editor_size, 0);
    // Schalter → Brücke: both get a free Code (0 is left to old key/door pairs)
    assert.equal(connect_signal_objects(level, pick(60, 10), pick(310, 10), t, editor_size), 1);
    assert.deepEqual(level.layers[0].sprites[1][3], { switch: { signal_code: 1 } });
    assert.deepEqual(level.layers[1].properties, { name: 'Brücke', signal_code: 1, signal_reaction: 'appear' });
    // the door joins the Schalter's Code and follows it
    assert.equal(connect_signal_objects(level, pick(60, 10), pick(200, 10), t, editor_size), 1);
    assert.deepEqual(level.layers[0].sprites[2][3], { door: { signal_code: 1, door_reaction: 'follow' } });
    // the enemy joins the Bereich's Code 9 and sends when defeated
    assert.equal(connect_signal_objects(level, pick(120, 10), pick(440, 10), t, editor_size), 9);
    assert.deepEqual(level.layers[0].sprites[3][3], { baddie: { signal_code: 9, signal_on_defeat: true } });
    // the same thing twice: nothing
    assert.equal(connect_signal_objects(level, pick(60, 10), pick(60, 10), t, editor_size), null);
});

test('picking looks for a sender first and for a receiver second', () => {
    const { pick_signal_object } = signals;
    const level = { layers: [
        { type: 'signal_area', properties: { signal_code: 3 }, rects: [{ left: 0, bottom: 0, width: 100, height: 100 }] },
        { type: 'sprites', properties: { name: 'Wand' }, sprites: [['b', 50, 0]] },
    ] };
    const t = r => editor_traits[r];
    assert.equal(pick_signal_object(level, 50, 10, t, editor_size, null, 'sender').kind, 'area');
    assert.equal(pick_signal_object(level, 50, 10, t, editor_size, null, 'receiver').kind, 'layer');
    assert.equal(pick_signal_object(level, 90, 90, t, editor_size, null, 'receiver').kind, 'area');
});

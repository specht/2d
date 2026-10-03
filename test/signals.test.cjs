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
    'valid_signal_rect', 'point_in_signal_rects', 'door_setting', 'signal_delay_seconds',
    'door_auto_close_step', 'LayerFade', 'console', 'stored_signal_code',
    `return class { ${methods} };`)(SignalBus, door_signal_action, layer_reacts_to_signals,
    layer_visible_at_start, layer_visible_after, signals.signal_fade_alpha, signals.layer_fade_seconds,
    signals.valid_signal_rect, signals.point_in_signal_rects, signals.door_setting, signals.signal_delay_seconds,
    signals.door_auto_close_step, LayerFade, quiet, signals.stored_signal_code);

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
    assert.deepEqual(of(3), { counts: { switch: 1, door: 2 }, layers: ['Brücke', 'Ebene 4'], areas: [], all_defeated: false, level_complete: false, level_start: false });
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

// ------------------------------- what belongs to the drawing, what to the copy

test('Beute: the loot key Code belongs to the placed enemy, else the drawing', () => {
    const { loot_key_code, effective_loot_code, placed_signal_roles, signal_partners, describe_signal_partners,
        signal_objects, signal_codes_in_level } = signals;
    const traits = {
        k: { key: {} }, c: { pickup: {} }, d: { door: {} },
        dieb: { baddie: { drop: { sprite_id: 'k', signal_code: 2 } } },
        alt: { baddie: { drop: { sprite_id: 'k' } } }, // older games: no Code at all
        muenze: { baddie: { drop: { sprite_id: 'c', signal_code: 2 } } },
    };
    const t = ref => traits[ref];
    assert.equal(loot_key_code(undefined, traits.dieb.baddie, t), 2);
    assert.equal(loot_key_code({ drop_code: 5 }, traits.dieb.baddie, t), 5);
    assert.equal(loot_key_code({ drop_code: 0 }, traits.dieb.baddie, t), 0); // 0 typed in on purpose
    assert.equal(loot_key_code(undefined, traits.alt.baddie, t), 0);
    assert.equal(loot_key_code({ drop_code: 5 }, traits.muenze.baddie, t), null); // a coin is no key
    assert.equal(effective_loot_code({ signal_on_defeat: true }, { signal_code: 4 }), 4);
    // the runtime resolves sprite ids to indices
    assert.equal(loot_key_code({ drop_code: 3 }, { drop: { sprite_index: 0 } }, i => [{ key: {} }][i]), 3);
    // an enemy can send when defeated and leave a key behind
    const both = ['dieb', 0, 0, { baddie: { signal_on_defeat: true, signal_code: 7, drop_code: 5 } }];
    assert.deepEqual(placed_signal_roles(both, traits.dieb, t).map(r => [r.role.id ?? r.role.trait, r.code]),
        [['baddie', 7], ['loot', 5]]);
    const level = { layers: [{ type: 'sprites', properties: {}, sprites: [
        both, ['dieb', 30, 0], ['d', 60, 0, { door: { signal_code: 5 } }],
    ] }] };
    assert.equal(describe_signal_partners(5, signal_partners(level, 5, t)),
        'Code 5 in diesem Level – sendet: 1 Gegner mit Schlüssel · reagiert: 1 Tür');
    assert.equal(describe_signal_partners(2, signal_partners(level, 2, t)),
        'Code 2 in diesem Level – sendet: 1 Gegner mit Schlüssel · noch nichts reagiert darauf');
    const objects = signal_objects(level, t, () => ({ width: 24, height: 24 }));
    assert.deepEqual(objects.map(o => [o.placed_index, o.role, o.code, o.sends]),
        [[0, 'baddie', 7, true], [0, 'loot', 5, true], [1, 'loot', 2, true], [2, 'door', 5, false]]);
    assert.ok(signal_codes_in_level({ layers: [{ type: 'sprites', sprites: [['dieb', 0, 0, { baddie: { drop_code: 8 } }]] }] }).has(8));
});

test('new Schalter and Druckplatten get a free Code; keys and doors keep 0', () => {
    const { give_new_senders_codes, give_defeat_sender_code } = signals;
    const traits = { s: { switch: {} }, p: { pressure_plate: {} }, k: { key: {} }, d: { door: {} } };
    const level = { properties: {}, layers: [{ type: 'sprites', properties: {}, sprites: [
        ['s', 0, 0, { switch: { signal_code: 1 } }],
    ] }] };
    const fresh = [['s', 24, 0], ['p', 48, 0], ['k', 72, 0], ['d', 96, 0], ['s', 120, 0, { switch: { signal_code: 0 } }]];
    give_new_senders_codes(level, fresh, ref => traits[ref]);
    assert.deepEqual(fresh.map(p => p[3]), [
        { switch: { signal_code: 2 } }, { pressure_plate: { signal_code: 3 } }, undefined, undefined,
        { switch: { signal_code: 0 } }]); // a Code that is there stays
    const enemy = { signal_on_defeat: true };
    give_defeat_sender_code(level, enemy);
    assert.equal(enemy.signal_code, 2); // nothing in the level uses 2 yet (fresh is not placed)
    const chosen = { signal_on_defeat: true, signal_code: 0 };
    give_defeat_sender_code(level, chosen);
    assert.equal(chosen.signal_code, 0);
    const silent = {};
    give_defeat_sender_code(level, silent);
    assert.deepEqual(silent, {});
});

test('a placed door may open differently from its drawing', () => {
    const { door_setting } = signals;
    assert.equal(door_setting(undefined, true), true);
    assert.equal(door_setting(undefined, undefined), false);
    assert.equal(door_setting(false, true), false);
    assert.equal(door_setting(true, false), true);
    assert.equal(door_setting('ja', false), false); // only true/false count
    // in the game: the drawn door 4 is locked, door 1 is not
    const game = level_game([{ properties: { collision_detection: true }, sprites: [
        [4, 0, 0, { door_closed: true }],
        [4, 48, 0, { door_closed: true, lockable: false }],
        [1, 96, 0, { door_closed: true, lockable: true, signal_code: 2 }],
    ] }]);
    for (const i of [0, 1, 2]) game.open_door_intent(i, 0);
    assert.deepEqual(game.active_level_sprites.map(e => e.door_state), ['idle', 'opening', 'idle']);
    assert.equal(game.active_level_sprites[2].door_closed, true);
    game.found_keys[2] = true;
    game.open_door_intent(2, 0);
    assert.equal(game.active_level_sprites[2].door_closed, false);
});

// ------------------------------------------- Verzögerung, "schließt wieder nach"

test('a Verzögerung is a number of seconds from 0 to the maximum; anything else is 0', () => {
    const { signal_delay_seconds, SIGNAL_DELAY_MAX_SECONDS } = signals;
    for (const value of [undefined, null, 0, -1, '2', NaN, Infinity, true]) assert.equal(signal_delay_seconds(value), 0);
    assert.equal(signal_delay_seconds(1.5), 1.5);
    assert.equal(signal_delay_seconds(SIGNAL_DELAY_MAX_SECONDS + 5), SIGNAL_DELAY_MAX_SECONDS);
});

test('the bus delivers delayed signals when they are due, in time order, then in the order sent', () => {
    const bus = new SignalBus();
    const got = [];
    for (const code of [1, 2, 3]) bus.connect(code, (value, time) => got.push([code, value, time]));
    bus.send(1, true, 0, { delay: 2 });
    bus.send(2, true, 0, { delay: 1 });
    bus.send(3, false, 0, { delay: 1 });
    bus.send(1, false, 0.5); // no delay: at once
    assert.deepEqual(got, [[1, false, 0.5]]);
    assert.equal(bus.deliver_due(0.99), 0);
    assert.equal(bus.deliver_due(1), 2);
    assert.equal(bus.deliver_due(5), 1);
    // each one at its own moment
    assert.deepEqual(got, [[1, false, 0.5], [2, true, 1], [3, false, 1], [1, true, 2]]);
    assert.deepEqual(bus.sent, [[1, false], [2, true], [3, false], [1, true]]);
    assert.equal(bus.send('kein Code', true, 0, { delay: 1 }), false);
    assert.equal(bus.pending.length, 0);
});

test('deciding at once ignores the Verzögerung and takes back what that sender still has on its way', () => {
    const bus = new SignalBus();
    const got = [];
    bus.connect(4, (value) => got.push(value));
    const area = {}, other = {};
    bus.send(4, true, 0, { delay: 2, from: area });
    bus.send(4, true, 0, { delay: 2, from: other });
    bus.immediate = true;
    bus.send(4, false, 1, { delay: 2, from: area });
    bus.immediate = false;
    assert.deepEqual(got, [false]);
    bus.deliver_due(10);
    assert.deepEqual(got, [false, true]); // only the other sender's signal arrives
});

test('a Schalter with a Verzögerung shows "an" at once and opens the door later', () => {
    const game = level_game([{ properties: {}, sprites: [
        [1, 200, 0, { signal_code: 7, door_closed: true, door_reaction: 'follow' }],
        [2, 100, 0, { signal_code: 7, switch_on: false, signal_delay: 1.5 }],
    ] }]);
    game.flip_switch(1, 1.0);
    assert.equal(entry_state(game, 1), 1);
    assert.equal(game.active_level_sprites[0].door_closed, true);
    assert.deepEqual(game.signals.sent, []);
    game.signals.deliver_due(2.4);
    assert.equal(game.active_level_sprites[0].door_closed, true);
    game.signals.deliver_due(2.5);
    assert.equal(game.active_level_sprites[0].door_closed, false);
    assert.deepEqual(game.signals.sent, [[7, true]]);
});

test('a Druckplatte with a Verzögerung: an and aus both arrive later, like an echo', () => {
    const game = level_game([{ properties: {}, sprites: [
        [3, 100, 0, { signal_code: 5, signal_delay: 1 }],
        [1, 200, 0, { signal_code: 5, door_closed: true, door_reaction: 'follow' }],
    ] }]);
    const door = game.active_level_sprites[1];
    game.update_pressure_plates(figure(100, 0), 0.2);
    game.update_pressure_plates(figure(160, 0), 0.4);
    assert.equal(entry_state(game, 0), 0); // the plate itself is up again at once
    game.signals.deliver_due(1.2);
    assert.equal(door.door_closed, false);
    game.signals.deliver_due(1.4);
    assert.equal(door.door_closed, true);
    assert.deepEqual(game.signals.sent, [[5, true], [5, false]]);
});

test('a Bereich with a Verzögerung sends later, but decides at once at the start and after dying', () => {
    const area = { type: 'signal_area', properties: { signal_code: 4, signal_delay: 2 }, sprites: [],
        rects: [{ left: 100, bottom: 0, width: 100, height: 100 }] };
    const roof = { properties: { signal_code: 4, signal_reaction: 'while_off', signal_fade: 0 }, sprites: [[0, 150, 48, {}]] };
    // starting inside: the roof is away at once, Verzögerung or not
    const inside = level_game([{ properties: {}, sprites: [[5, 150, 0, {}]] }, area, roof]);
    assert.deepEqual(inside.signals.sent, [[4, true]]);
    assert.equal(inside.signal_hidden_layers.has(2), true);

    const game = level_game([{ properties: {}, sprites: [[5, 20, 0, {}]] }, area, roof]);
    assert.deepEqual(game.signals.sent, []);
    game.player_character.mesh.position.x = 150;
    game.update_signal_areas(1);
    game.signals.deliver_due(2.9);
    assert.deepEqual(game.signals.sent, []);
    game.signals.deliver_due(3);
    assert.deepEqual(game.signals.sent, [[4, true]]);
    // out again (aus is on its way), then dying brings the figure back inside:
    // what is on its way is taken back, the level decides at once
    game.player_character.mesh.position.x = 20;
    game.update_signal_areas(4);
    game.player_character.mesh.position.x = 150;
    game.signals.immediate = true;
    game.update_signal_areas(4.5);
    game.signals.immediate = false;
    game.signals.deliver_due(100);
    assert.deepEqual(game.signals.sent, [[4, true], [4, true]]);
    assert.equal(game.signal_hidden_layers.has(2), true);
});

test('a defeated enemy and "alle Gegner besiegt" may send later', () => {
    const game = level_game([{ properties: {}, sprites: [[5, 0, 0, {}],
        [6, 100, 0, { baddie: { signal_on_defeat: true, signal_code: 2, signal_delay: 1 } }]] }],
    { signal_all_defeated: 9, signal_all_defeated_delay: 3 });
    const [enemy] = game.baddies;
    enemy.active = false; game.baddie_defeated(enemy, 1);
    assert.deepEqual(game.signals.sent, []);
    game.signals.deliver_due(2);
    assert.deepEqual(game.signals.sent, [[2, true]]);
    game.signals.deliver_due(3.9);
    assert.deepEqual(game.signals.sent, [[2, true]]);
    game.signals.deliver_due(4);
    assert.deepEqual(game.signals.sent, [[2, true], [9, true]]);
});

test('"schließt wieder nach": an open door closes by itself and waits for whoever is in it', () => {
    const game = level_game([{ properties: {}, sprites: [
        [5, 0, 0, {}],
        [1, 200, 0, { signal_code: 3, door_closed: true, door_reaction: 'open', close_after: 2 }],
        [1, 300, 0, { signal_code: 3, door_closed: true, door_reaction: 'open' }],
    ] }]);
    const [door, plain] = game.active_level_sprites;
    assert.deepEqual(game.auto_closing_doors, [0]);
    game.signals.emit(3, true, 1);
    assert.equal(door.door_closed, false);
    game.update_auto_closing_doors(1); // fully open: the 2 s start now
    assert.equal(door.close_at, 3);
    game.update_auto_closing_doors(2.9);
    assert.equal(door.door_closed, false);
    // the figure stands in the door: it waits
    game.player_character.mesh.position.x = 200;
    game.update_auto_closing_doors(3);
    assert.equal(door.door_closed, false);
    game.player_character.mesh.position.x = 0;
    game.update_auto_closing_doors(3.1);
    assert.equal(door.door_closed, true); // although its drawing cannot be closed
    assert.equal(door.close_at, null);
    // opened again: the time starts again; asked to open while open (the
    // figure in front of an automatic door), it starts again, too
    game.signals.emit(3, true, 5);
    game.update_auto_closing_doors(5);
    assert.equal(door.close_at, 7);
    game.open_door_intent(0, 6);
    assert.equal(door.close_at, 8);
    // without "schließt wieder nach" a door stays open, as always
    game.update_auto_closing_doors(100);
    assert.equal(plain.door_closed, false);
    assert.equal(plain.close_at, null);
});

test('"schließt wieder nach" counts from when a door with Übergang is fully open', () => {
    const game = level_game([{ properties: {}, sprites: [
        [4, 200, 0, { signal_code: 1, door_closed: true, door_reaction: 'open', close_after: 1 }],
    ] }]);
    const door = game.active_level_sprites[0];
    game.signals.emit(1, true, 0);
    assert.equal(door.door_state, 'opening');
    game.update_auto_closing_doors(0.3);
    assert.equal(door.close_at, null);
    game.transitioning_sprites.transition[0].done();
    delete game.transitioning_sprites.transition[0];
    game.update_auto_closing_doors(0.5);
    assert.equal(door.close_at, 1.5);
    game.update_auto_closing_doors(1.5);
    assert.equal(door.door_state, 'closing');
});

test('"alle Gegner besiegt" does not wait for an enemy that cannot be defeated', () => {
    const game = level_game([{ properties: {}, sprites: [[5, 0, 0, {}], [6, 100, 0, {}], [6, 140, 0, {}]] }],
        { signal_all_defeated: 9 });
    const [slime, cat] = game.baddies;
    cat.traits = { invincible: true };
    slime.active = false; game.baddie_defeated(slime, 1);
    assert.deepEqual(game.signals.sent, [[9, true]]);
});

// ------------------------------------------------ Signale-Übersicht (rules)

test('signal_rules: one card per Code, "Wenn … dann …", with warnings', () => {
    const sprites = { sch: { switch: {} }, tor: { door: { lockable: true, automatic: true } }, tuer: { door: { lockable: false } },
        gl: { baddie: {} }, pl: { pressure_plate: {} } };
    const names = { sch: 'Schalter', tor: 'Gittertor', tuer: 'Tür', gl: 'Glibber', pl: 'Druckplatte' };
    const level = { properties: { signal_all_defeated: 2 }, layers: [
        { type: 'sprites', properties: { name: 'Welt' }, sprites: [
            ['sch', 0, 0, { switch: { signal_code: 1 } }],
            ['tor', 50, 0, { door: { signal_code: 2, door_reaction: 'open' } }],
            ['tuer', 80, 0, {}],                                  // a plain door waits for nothing
            ['gl', 90, 0, { baddie: {} }],                        // does not send
            ['pl', 9, 0, { pressure_plate: { signal_code: 5, signal_delay: 1.5 } }],
            ['pl', 19, 0, { pressure_plate: { signal_code: 5, signal_delay: 1.5 } }]] },
        { type: 'sprites', properties: { name: 'Rot', signal_code: 1, signal_reaction: 'while_off' }, sprites: [] },
        { type: 'signal_area', properties: { name: 'Arena', signal_code: 3 }, rects: [] },
        { type: 'backdrop', properties: { name: 'Nebel', signal_code: 7, signal_reaction: 'appear' } },
    ] };
    const cards = signals.signal_rules(level, r => sprites[r], r => names[r]);
    assert.deepEqual(cards.map(c => c.code), [1, 2, 3, 5, 7]);
    const [one, two, three, five, seven] = cards;
    assert.deepEqual(one.senders.map(l => l.text), ['»Schalter« umgelegt wird']);
    assert.deepEqual(one.receivers.map(l => l.text), ['verschwindet die Ebene »Rot« (bei „aus“ wieder da)']);
    assert.deepEqual(one.receivers[0].objects, [{ kind: 'layer', layer_index: 1 }]);
    // "aus" is explained only where something reacts to it
    assert.deepEqual(one.off, ['Zurücklegen schickt „aus“']);
    assert.equal(one.problem, null);
    assert.deepEqual(two.senders.map(l => l.text), ['alle Gegner besiegt sind']);
    assert.deepEqual(two.receivers.map(l => l.text), ['öffnet sich »Gittertor«']);
    assert.deepEqual(two.off, []);
    assert.equal(three.problem, 'no_receiver');
    // two equal senders are one line, counted, both selectable
    assert.equal(five.senders.length, 1);
    assert.equal(five.senders[0].text, 'die Spielfigur auf »Druckplatte« tritt (kommt nach 1,5 s an)');
    assert.equal(five.senders[0].count, 2);
    assert.equal(five.senders[0].objects.length, 2);
    assert.deepEqual(seven.receivers.map(l => l.text), ['erscheint der Hintergrund »Nebel«']);
    assert.equal(seven.problem, 'no_sender');
    // no Code 0 card: the plain door is not a receiver
    assert.ok(!cards.some(c => c.code === 0));
});

test('signal_rules: an empty level has no cards', () => {
    assert.deepEqual(signals.signal_rules({ layers: [] }, () => ({}), () => ''), []);
    assert.deepEqual(signals.signal_rules(null, () => ({}), () => ''), []);
});

// ------------------------------------------------------------- Namen

test('names: cleaned, at most SIGNAL_NAME_MAX_LENGTH characters, anything else is no name', () => {
    const { clean_signal_name, SIGNAL_NAME_MAX_LENGTH } = signals;
    assert.equal(clean_signal_name('  Große \n  Brücke  '), 'Große Brücke');
    assert.equal(clean_signal_name('x'.repeat(40)).length, SIGNAL_NAME_MAX_LENGTH);
    // characters, not UTF-16 units: an emoji is not cut in half
    assert.equal([...clean_signal_name('🌉'.repeat(30))].length, SIGNAL_NAME_MAX_LENGTH);
    for (const value of [undefined, null, 4, {}, [], '   ']) assert.equal(clean_signal_name(value), '');
});

test('names: a level without signal_names has numbers only, as before', () => {
    const { signal_name, signal_code_text } = signals;
    assert.equal(signal_name({ properties: {} }, 4), '');
    assert.equal(signal_name({}, 4), '');
    assert.equal(signal_name(null, 4), '');
    // nonsense in the JSON is no name
    assert.equal(signal_name({ properties: { signal_names: ['Brücke'] } }, 0), '');
    assert.equal(signal_name({ properties: { signal_names: { 4: 7 } } }, 4), '');
    assert.equal(signal_name({ properties: { signal_names: { 4: ' Brücke ' } } }, 4), 'Brücke');
    assert.equal(signal_code_text(4), 'Code 4');
    assert.equal(signal_code_text(4, 'Brücke'), '»Brücke« (Code 4)');
});

test('names: set, rename, remove; two Codes never share a name', () => {
    const { set_signal_name, signal_name, signal_code_named } = signals;
    const level = { properties: {}, layers: [] };
    assert.deepEqual(set_signal_name(level, 4, ' Brücke '), { ok: true, name: 'Brücke' });
    assert.deepEqual(level.properties.signal_names, { 4: 'Brücke' });
    assert.equal(signal_code_named(level, 'BRÜCKE'), 4);
    // the same name for another Code is refused, whatever its case
    assert.deepEqual(set_signal_name(level, 5, 'brücke'), { ok: false, taken_by: 4 });
    assert.equal(signal_name(level, 5), '');
    // renaming a Code to its own name (another case) is fine
    assert.deepEqual(set_signal_name(level, 4, 'BRÜCKE'), { ok: true, name: 'BRÜCKE' });
    assert.deepEqual(set_signal_name(level, 5, 'Tor'), { ok: true, name: 'Tor' });
    // removing the last name leaves the level as it was before names
    set_signal_name(level, 4, '');
    set_signal_name(level, 5, '   ');
    assert.deepEqual(level, { properties: {}, layers: [] });
    // a level that had no properties gets them only when a name is set
    const bare = { layers: [] };
    set_signal_name(bare, 0, '');
    assert.deepEqual(bare, { layers: [], properties: {} });
});

test('names: a named Code stays taken, so a new sender never inherits an old name', () => {
    const { free_signal_code, signal_codes_in_level } = signals;
    const level = { properties: { signal_names: { 1: 'Brücke', 2: 'Tor', x: 'Unsinn' } }, layers: [] };
    assert.equal(free_signal_code(level), 3);
    assert.ok(!signal_codes_in_level(level).has(NaN));
    // without names: exactly as before
    assert.equal(free_signal_code({ properties: {}, layers: [] }), 1);
});

test('names appear on the overview cards and in the editor\'s code line', () => {
    const { signal_rules, signal_partners, describe_signal_partners, signal_name } = signals;
    const traits = { s: { switch: {} }, d: { door: { lockable: true } } };
    const level = { properties: { signal_names: { 3: 'Brücke' } }, layers: [
        { type: 'sprites', properties: {}, sprites: [
            ['s', 0, 0, { switch: { signal_code: 3 } }],
            ['d', 0, 0, { door: { signal_code: 3, door_reaction: 'open' } }],
            ['s', 0, 0, { switch: { signal_code: 4 } }]] },
    ] };
    const cards = signal_rules(level, r => traits[r], () => 'Schalter');
    assert.deepEqual(cards.map(c => [c.code, c.name]), [[3, 'Brücke'], [4, '']]);
    const partners = signal_partners(level, 3, r => traits[r]);
    assert.equal(describe_signal_partners(3, partners, signal_name(level, 3)),
        '»Brücke« (Code 3) in diesem Level – sendet: 1 Schalter · reagiert: 1 Tür');
    // without a name: unchanged
    assert.equal(describe_signal_partners(3, partners), 'Code 3 in diesem Level – sendet: 1 Schalter · reagiert: 1 Tür');
});

test('names are never read by the game: the bus still meets by the number', () => {
    const bus = new SignalBus();
    const got = [];
    bus.connect(4, (value) => got.push(value));
    bus.send('Brücke', true);
    bus.send(4, true);
    assert.deepEqual(got, [true]);
});

test('unique_signal_name: the suggestion, or with a number when that name is taken', () => {
    const { unique_signal_name, SIGNAL_NAME_MAX_LENGTH } = signals;
    const level = { properties: { signal_names: { 1: 'Schalter → Tor', 2: 'Schalter → Tor 2' } }, layers: [] };
    assert.equal(unique_signal_name({ properties: {} }, ' Schalter  →  Tor '), 'Schalter → Tor');
    assert.equal(unique_signal_name(level, 'schalter → tor'), 'Schalter → Tor 3'.replace('Schalter → Tor', 'schalter → tor'));
    // long suggestions are shortened before the number, so the number stays visible
    const long = 'Druckplatte → Gittertor am Ausgang';
    level.properties.signal_names[3] = signals.clean_signal_name(long);
    const name = unique_signal_name(level, long);
    assert.ok(name.endsWith(' 2'));
    assert.ok([...name].length <= SIGNAL_NAME_MAX_LENGTH);
    assert.equal(unique_signal_name(level, ''), '');
});

// --------------------------------- copying between levels: names travel

test('signal_names_for_placed: the names of the Codes the copied sprites use', () => {
    const { signal_names_for_placed } = signals;
    const level = { properties: { signal_names: { 3: 'Brücke', 5: 'Tor', 8: 'Unbenutzt' } }, layers: [] };
    const items = [
        ['s', 0, 0, { switch: { signal_code: 3 } }],
        ['b', 0, 0, { baddie: { signal_on_defeat: true, signal_code: 4, drop_code: 5 } }],
        ['x', 0, 0],
    ];
    assert.deepEqual(signal_names_for_placed(level, items), { 3: 'Brücke', 5: 'Tor' });
    assert.equal(signal_names_for_placed({ properties: {} }, items), null);
});

test('carry_signal_names: the name wins', () => {
    const { carry_signal_names } = signals;
    const target = () => ({ properties: { signal_names: { 2: 'Brücke', 3: 'Falle' } }, layers: [
        { type: 'sprites', properties: {}, sprites: [['d', 0, 0, { door: { signal_code: 3 } }], ['k', 0, 0, { key: { signal_code: 7 } }]] },
    ] });
    // 1. the name exists here on another Code: the pasted sprites join it
    let level = target();
    let items = [['s', 0, 0, { switch: { signal_code: 4 } }]];
    assert.deepEqual(carry_signal_names(level, items, { 4: 'Brücke' }), { 4: 2 });
    assert.equal(items[0][3].switch.signal_code, 2);
    assert.deepEqual(level.properties.signal_names, { 2: 'Brücke', 3: 'Falle' });
    // 2. the same number is unnamed here: it gets the name, the number stays
    level = target();
    items = [['s', 0, 0, { switch: { signal_code: 7 } }]];
    assert.deepEqual(carry_signal_names(level, items, { 7: 'Schatz' }), {});
    assert.equal(items[0][3].switch.signal_code, 7);
    assert.equal(level.properties.signal_names[7], 'Schatz');
    // 3. the same number has another name here: a free Code with the name
    level = target();
    items = [['s', 0, 0, { switch: { signal_code: 3 } }], ['d', 0, 0, { door: { signal_code: 3 } }]];
    assert.deepEqual(carry_signal_names(level, items, { 3: 'Tor' }), { 3: 1 });
    assert.deepEqual(items.map(p => Object.values(p[3])[0].signal_code), [1, 1]);
    assert.equal(level.properties.signal_names[1], 'Tor');
    assert.equal(level.properties.signal_names[3], 'Falle');
    // 4. unnamed Codes keep their number, exactly as before
    level = target();
    items = [['s', 0, 0, { switch: { signal_code: 3 } }]];
    assert.deepEqual(carry_signal_names(level, items, null), {});
    assert.equal(items[0][3].switch.signal_code, 3);
    assert.deepEqual(level.properties.signal_names, { 2: 'Brücke', 3: 'Falle' });
});

test('carry_signal_names: pasted into its own level nothing changes', () => {
    const { carry_signal_names } = signals;
    const level = { properties: { signal_names: { 4: 'Brücke' } }, layers: [] };
    const items = [['s', 0, 0, { switch: { signal_code: 4 } }]];
    assert.deepEqual(carry_signal_names(level, items, { 4: 'Brücke' }), {});
    assert.equal(items[0][3].switch.signal_code, 4);
    assert.deepEqual(level.properties.signal_names, { 4: 'Brücke' });
});

test('carry_signal_names: new Codes are distinct and avoid the pasted unnamed numbers; drop_code moves too', () => {
    const { carry_signal_names } = signals;
    const level = { properties: { signal_names: { 1: 'A', 2: 'B' } }, layers: [] };
    const items = [
        ['s', 0, 0, { switch: { signal_code: 1 } }],
        ['b', 0, 0, { baddie: { signal_on_defeat: true, signal_code: 3, drop_code: 2 } }],  // 3 is unnamed
    ];
    const changed = carry_signal_names(level, items, { 1: 'X', 2: 'Y' });
    // 1 and 2 are named differently here; 3 is taken by the pasted enemy
    assert.deepEqual(changed, { 1: 4, 2: 5 });
    assert.equal(items[0][3].switch.signal_code, 4);
    assert.equal(items[1][3].baddie.drop_code, 5);
    assert.equal(items[1][3].baddie.signal_code, 3);
    assert.deepEqual(level.properties.signal_names, { 1: 'A', 2: 'B', 4: 'X', 5: 'Y' });
});

test('carry_signal_names: no swapping chains (a Code moved onto another pasted Code is mapped once)', () => {
    const { carry_signal_names } = signals;
    // here: "Tor" is 1 and "Brücke" is 2; pasted: Brücke = 1, Tor = 2
    const level = { properties: { signal_names: { 1: 'Tor', 2: 'Brücke' } }, layers: [] };
    const items = [['s', 0, 0, { switch: { signal_code: 1 } }], ['p', 0, 0, { pressure_plate: { signal_code: 2 } }]];
    assert.deepEqual(carry_signal_names(level, items, { 1: 'Brücke', 2: 'Tor' }), { 1: 2, 2: 1 });
    assert.equal(items[0][3].switch.signal_code, 2);
    assert.equal(items[1][3].pressure_plate.signal_code, 1);
});

// --------------------------------- a sign that speaks, the level that is done

test('a sign takes part only with "spricht bei Signal"', () => {
    const { placed_signal_role, signal_partners, describe_signal_partners } = signals;
    const traits = { t: { text: {} }, s: { switch: {} } };
    assert.equal(placed_signal_role(['t', 0, 0, { text: { text: 'Hallo', signal_code: 3 } }], traits.t), null);
    const found = placed_signal_role(['t', 0, 0, { text: { text: 'Hallo', speaks_on_signal: true, signal_code: 3 } }], traits.t);
    assert.equal(found.role.trait, 'text');
    assert.equal(found.code, 3);
    const level = { properties: {}, layers: [{ type: 'sprites', properties: {}, sprites: [
        ['s', 0, 0, { switch: { signal_code: 3 } }],
        ['t', 0, 0, { text: { speaks_on_signal: true, signal_code: 3 } }]] }] };
    assert.equal(describe_signal_partners(3, signal_partners(level, 3, r => traits[r])),
        'Code 3 in diesem Level – sendet: 1 Schalter · reagiert: 1 Hinweistext');
});

test('signal_rules: a speaking sign and "geschafft bei Signal" are receivers', () => {
    const traits = { t: { text: {} }, a: { baddie: {} } };
    const names = { t: 'Schild', a: 'Glibber' };
    const level = { properties: { signal_all_defeated: 2, signal_level_complete: 2 }, layers: [
        { type: 'sprites', properties: {}, sprites: [
            ['t', 0, 0, { text: { speaks_on_signal: true, signal_code: 1 } }],
            ['t', 30, 0, { text: { speaks_on_signal: true, signal_code: 1, speaker: 'self' } }],
            ['t', 60, 0, { text: { signal_code: 1 } }]] },        // only with F: no receiver
        { type: 'signal_area', properties: { name: 'Vorplatz', signal_code: 1 }, rects: [] },
    ] };
    const cards = signals.signal_rules(level, r => traits[r], r => names[r]);
    assert.deepEqual(cards.map(c => c.code), [1, 2]);
    assert.deepEqual(cards[0].receivers.map(l => l.text), ['liest die Spielfigur »Schild« vor', 'spricht »Schild«']);
    assert.deepEqual(cards[0].receivers[0].objects, [{ kind: 'sprite', layer_index: 0, placed_index: 0, role: 'text' }]);
    assert.deepEqual(cards[1].senders.map(l => l.text), ['alle Gegner besiegt sind']);
    assert.deepEqual(cards[1].receivers.map(l => l.text), ['ist das Level geschafft']);
    assert.equal(cards[1].problem, null);
    // the level's Code counts as used, and its partners say so
    assert.ok(signals.signal_codes_in_level({ properties: { signal_level_complete: 9 }, layers: [] }).has(9));
    assert.equal(signals.describe_signal_partners(2, signals.signal_partners(level, 2, r => traits[r])),
        'Code 2 in diesem Level – sendet: alle Gegner besiegt · reagiert: Level geschafft');
});

test('Verbinden: a sign it connects starts speaking on the Signal', () => {
    const traits = { s: { switch: {} }, t: { text: {} } };
    const size = { width: 16, height: 16 };
    const level = { properties: {}, layers: [{ type: 'sprites', properties: {}, sprites: [
        ['s', 0, 0, { switch: { signal_code: 4 } }],
        ['t', 50, 0, { text: { text: 'Das Tor ist offen!' } }]] }] };
    const of = r => traits[r], size_of = () => size;
    const sw = signals.pick_signal_object(level, 0, 8, of, size_of, 0, 'sender');
    const sign = signals.pick_signal_object(level, 50, 8, of, size_of, 0, 'receiver');
    assert.equal(sign.trait, 'text');
    assert.equal(sign.code, null);   // not a receiver yet
    const code = signals.connect_signal_objects(level, sw, sign, of, size_of);
    assert.equal(level.layers[0].sprites[1][3].text.speaks_on_signal, true);
    assert.equal(level.layers[0].sprites[1][3].text.signal_code, code);
    assert.equal(level.layers[0].sprites[1][3].text.text, 'Das Tor ist offen!');
});

// ------------------------------------------------- "kein Signal" (null)

test('stored_signal_code: absent is 0 as always, null is "kein Signal"', () => {
    const { stored_signal_code } = signals;
    assert.equal(stored_signal_code(undefined), 0);
    assert.equal(stored_signal_code(4), 4);
    assert.equal(stored_signal_code('4'), 4);
    assert.equal(stored_signal_code(null), null);
});

test('the bus ignores "kein Signal": nothing is sent, nothing listens', () => {
    const bus = new SignalBus();
    const got = [];
    bus.connect(null, (value) => got.push(['null', value]));
    bus.connect(0, (value) => got.push([0, value]));
    assert.equal(bus.send(null, true), false);
    assert.equal(bus.send(null, true, 0, { delay: 2 }), false);
    bus.deliver_due(10);
    assert.deepEqual(got, []);
    assert.deepEqual(bus.sent, []);
    bus.send(0, true);
    assert.deepEqual(got, [[0, true]]);
});

test('"kein Signal" leaves the overview, the lines and the Code line', () => {
    const traits = { s: { switch: {} }, d: { door: { lockable: true } }, k: { key: {} } };
    const size_of = () => ({ width: 16, height: 16 });
    const level = { properties: {}, layers: [
        { type: 'sprites', properties: {}, sprites: [
            ['s', 0, 0, { switch: { signal_code: null } }],
            ['d', 40, 0, { door: { signal_code: null, door_reaction: 'open' } }],
            ['k', 80, 0, { key: { signal_code: null } }],
            ['k', 120, 0]] },                                     // absent: still 0
        { type: 'signal_area', properties: { name: 'Leer', signal_code: null }, rects: [{ left: 0, bottom: 0, width: 10, height: 10 }] },
    ] };
    const of = r => traits[r];
    assert.equal(signals.placed_signal_role(level.layers[0].sprites[0], traits.s), null);
    const cards = signals.signal_rules(level, of, () => 'X');
    // only the key without a stored Code is left, on 0
    assert.deepEqual(cards.map(c => c.code), [0]);
    assert.equal(cards[0].senders.length, 1);
    assert.deepEqual(signals.signal_objects(level, of, size_of).map(o => [o.kind, o.code]), [['sprite', 0]]);
    const zero = signals.signal_partners(level, 0, of);
    assert.deepEqual(zero.counts, { key: 1 });
    assert.deepEqual(zero.areas, []);
    // Verbinden still finds them and connects them again
    const sw = signals.pick_signal_object(level, 0, 8, of, size_of, 0, 'sender');
    assert.equal(sw.trait, 'switch');
    const door = signals.pick_signal_object(level, 40, 8, of, size_of, 0, 'receiver');
    const code = signals.connect_signal_objects(level, sw, door, of, size_of);
    assert.equal(level.layers[0].sprites[0][3].switch.signal_code, code);
    assert.equal(level.layers[0].sprites[1][3].door.signal_code, code);
    assert.ok(code > 0);
});

test('a door with "kein Signal" reacts to nothing in the game', () => {
    const game = level_game([{ properties: {}, sprites: [[1, 0, 0, { signal_code: null, door_reaction: 'open', door_closed: true }]] }]);
    game.setup_signals({ properties: {}, layers: [{ properties: {}, sprites: [] }] });
    game.signals.send(0, true);
    assert.equal(game.active_level_sprites[0].door_closed, true);
    assert.equal(game.active_level_sprites[0].door_signal_pending ?? null, null);
    // the same door on Code 0 does react
    const zero = level_game([{ properties: {}, sprites: [[1, 0, 0, { signal_code: 0, door_reaction: 'open', door_closed: true }]] }]);
    zero.setup_signals({ properties: {}, layers: [{ properties: {}, sprites: [] }] });
    zero.signals.send(0, true);
    const entry = zero.active_level_sprites[0];
    assert.ok(entry.door_closed === false || entry.door_state === 'opening' || entry.door_signal_pending === 'open',
        `door on 0 should start opening: ${JSON.stringify({ closed: entry.door_closed, state: entry.door_state })}`);
});

// ------------------------------- anything collected, and the level's start

test('a collected sprite sends only with "sendet, wenn eingesammelt"; a key that is also a pickup stays a key', () => {
    const { placed_signal_role } = signals;
    const traits = { g: { pickup: {} }, kp: { key: {}, pickup: {} } };
    assert.equal(placed_signal_role(['g', 0, 0, { pickup: { signal_code: 3 } }], traits.g), null);
    const gem = placed_signal_role(['g', 0, 0, { pickup: { signal_on_collect: true, signal_code: 3 } }], traits.g);
    assert.deepEqual([gem.role.trait, gem.code], ['pickup', 3]);
    const key = placed_signal_role(['kp', 0, 0, { key: { signal_code: 7 }, pickup: { signal_on_collect: true, signal_code: 3 } }], traits.kp);
    assert.deepEqual([key.role.trait, key.code], ['key', 7]);
});

test('signal_rules: a collected sprite and the level start are senders; Verbinden switches a pickup on', () => {
    const traits = { g: { pickup: {} }, d: { door: { lockable: true } } };
    const level = { properties: { signal_level_start: 2, signal_level_start_delay: 30 }, layers: [
        { type: 'sprites', properties: {}, sprites: [
            ['g', 0, 0, { pickup: { signal_on_collect: true, signal_code: 1, signal_delay: 1 } }],
            ['d', 40, 0, { door: { signal_code: 1, door_reaction: 'open' } }],
            ['d', 80, 0, { door: { signal_code: 2, door_reaction: 'close' } }]] },
    ] };
    const cards = signals.signal_rules(level, r => traits[r], () => 'Edelstein');
    assert.deepEqual(cards[0].senders.map(l => l.text), ['»Edelstein« eingesammelt wird (kommt nach 1 s an)']);
    assert.deepEqual(cards[0].senders[0].objects, [{ kind: 'sprite', layer_index: 0, placed_index: 0, role: 'pickup' }]);
    assert.deepEqual(cards[1].senders.map(l => l.text), ['das Level startet (kommt nach 30 s an)']);
    assert.deepEqual(cards[1].senders[0].objects, [{ kind: 'level', setting: 'signal_level_start' }]);
    assert.equal(signals.describe_signal_partners(2, signals.signal_partners(level, 2, r => traits[r])),
        'Code 2 in diesem Level – sendet: Levelstart · reagiert: 1 Tür');
    assert.ok(signals.signal_codes_in_level({ properties: { signal_level_start: 9 }, layers: [] }).has(9));
    // Verbinden onto a plain pickup
    const plain = { properties: {}, layers: [{ type: 'sprites', properties: {}, sprites: [
        ['g', 0, 0, {}], ['d', 40, 0, { door: { door_reaction: 'open' } }]] }] };
    const size_of = () => ({ width: 16, height: 16 }), of = r => traits[r];
    const a = signals.pick_signal_object(plain, 0, 8, of, size_of, 0, 'sender');
    const b = signals.pick_signal_object(plain, 40, 8, of, size_of, 0, 'receiver');
    assert.equal(a.trait, 'pickup');
    const code = signals.connect_signal_objects(plain, a, b, of, size_of);
    assert.deepEqual(plain.layers[0].sprites[0][3].pickup, { signal_code: code, signal_on_collect: true });
});

test('"sendet beim Start": at once without a Verzögerung, a timer with one', () => {
    const door = () => [[1, 0, 0, { signal_code: 5, door_reaction: 'open', door_closed: true }]];
    const opening = (entry) => entry.door_closed === false || entry.door_state === 'opening' || entry.door_signal_pending === 'open';
    const at_once = level_game([{ properties: {}, sprites: door() }]);
    at_once.setup_signals({ properties: { signal_level_start: 5 }, layers: [{ properties: {}, sprites: [] }] });
    assert.deepEqual(at_once.signals.sent, [[5, true]]);
    assert.ok(opening(at_once.active_level_sprites[0]));
    const timer = level_game([{ properties: {}, sprites: door() }]);
    timer.setup_signals({ properties: { signal_level_start: 5, signal_level_start_delay: 2 }, layers: [{ properties: {}, sprites: [] }] });
    assert.deepEqual(timer.signals.sent, []);
    timer.signals.deliver_due(1.9);
    assert.deepEqual(timer.signals.sent, []);
    timer.signals.deliver_due(2);
    assert.deepEqual(timer.signals.sent, [[5, true]]);
    assert.ok(opening(timer.active_level_sprites[0]));
    // a respawn (deciding at once again) does not take the timer back
    const again = level_game([{ properties: {}, sprites: door() }]);
    again.setup_signals({ properties: { signal_level_start: 5, signal_level_start_delay: 2 }, layers: [{ properties: {}, sprites: [] }] });
    again.signals.immediate = true; again.update_signal_areas(1); again.signals.immediate = false;
    again.signals.deliver_due(2);
    assert.deepEqual(again.signals.sent, [[5, true]]);
});

test('a door told to close waits while somebody stands in it, then closes', () => {
    const game = level_game([{ properties: {}, sprites: [
        [5, 200, 0, {}],                                                          // the figure in the doorway
        [1, 200, 0, { signal_code: 3, door_closed: false, door_reaction: 'follow' }],
    ] }]);
    const door = game.active_level_sprites[0];
    game.signals.emit(3, false, 1);                // "aus": close – but the figure is in it
    assert.equal(door.door_closed, false);
    assert.equal(door.door_signal_pending, 'close');
    game.update_waiting_doors(1.5);
    assert.equal(door.door_closed, false);
    game.player_character.mesh.position.x = 240;   // out of the doorway (the door spans 188 … 212)
    game.update_waiting_doors(2);
    assert.equal(door.door_closed, true);
    assert.equal(door.door_signal_pending, null);
    assert.equal(game.doors_waiting_to_close.size, 0);
});

test('a waiting door opens again on "an", and "wechseln" counts the waiting as closing', () => {
    const follow = level_game([{ properties: {}, sprites: [
        [5, 200, 0, {}], [1, 200, 0, { signal_code: 3, door_closed: false, door_reaction: 'follow' }]] }]);
    const door = follow.active_level_sprites[0];
    follow.signals.emit(3, false, 1);
    follow.signals.emit(3, true, 1.2);             // open again before the doorway is free
    follow.player_character.mesh.position.x = 240;
    follow.update_waiting_doors(2);
    assert.equal(door.door_closed, false);         // it does not close after all
    assert.equal(door.door_signal_pending, null);
    const toggle = level_game([{ properties: {}, sprites: [
        [5, 200, 0, {}], [1, 200, 0, { signal_code: 3, door_closed: false, door_reaction: 'toggle' }]] }]);
    const t_door = toggle.active_level_sprites[0];
    toggle.signals.emit(3, true, 1);               // close: waits
    toggle.signals.emit(3, true, 1.2);             // the next signal opens again (it was heading closed)
    toggle.player_character.mesh.position.x = 240;
    toggle.update_waiting_doors(2);
    assert.equal(t_door.door_closed, false);
});

test('F never closes a door onto whoever stands in it', () => {
    const game = level_game([{ properties: {}, sprites: [
        [5, 205, 0, {}],                                                          // half in the doorway
        [1, 200, 0, { door_closed: false }],
    ] }]);
    const door = game.active_level_sprites[0];
    game.data.sprites[1].traits.door.closable = true;
    game.toggle_door_intent(0, 1);
    assert.equal(door.door_closed, false);
    game.player_character.mesh.position.x = 240;
    game.toggle_door_intent(0, 2);
    assert.equal(door.door_closed, true);
    game.data.sprites[1].traits.door.closable = false;
});

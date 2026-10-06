// Turned gravity: a Bewegungsbereich that pulls left, up or right
// (src/static/movement_regions.js direction, app.js Character gravity_k)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MovementRegions = require('../src/static/movement_regions.js');
const ai = require('../src/static/companion_ai.js');

const STATIC = path.join(__dirname, '../src/static');
const signals = vm.runInNewContext(fs.readFileSync(path.join(STATIC, 'signals.js'), 'utf8') + '\n({ stored_signal_code, signal_rules });');
// eslint-disable-next-line no-new-func
const IntervalTree = new Function(fs.readFileSync(path.join(STATIC, 'interval_tree.js'), 'utf8') + '\nreturn IntervalTree;')();

const rect = (left, bottom, width, height) => ({ left, bottom, width, height });
const region = (movement, rects, properties = {}) => ({ type: 'movement_region', properties: { name: 'Bereich', ...properties }, rects, movement });

test('a figure\'s own coordinates: quarter turns there and back', () => {
    // gravity to the right: the figure's down is the world's right, its right is the world's up
    // (no -0: a zero is a zero)
    const plain = (a) => a.map(v => v + 0);
    assert.deepEqual(plain(MovementRegions.to_world(1, 0, -1)), [1, 0]);
    assert.deepEqual(plain(MovementRegions.to_world(1, 1, 0)), [0, 1]);
    assert.deepEqual(plain(MovementRegions.to_world(2, 3, 4)), [-3, -4]);
    for (const k of [0, 1, 2, 3]) {
        assert.deepEqual(plain(MovementRegions.to_local(k, ...MovementRegions.to_world(k, 5, -7))), [5, -7]);
    }
    // a rectangle stays a rectangle
    assert.deepEqual(plain(MovementRegions.box_to_world(1, 0, 10, 0, 20)), [-20, 0, 0, 10]);
    assert.deepEqual(plain(MovementRegions.box_to_local(1, -20, 0, 0, 10)), [0, 10, 0, 20]);
    assert.equal(MovementRegions.direction_k('left'), 3);
    assert.equal(MovementRegions.direction_k('down'), 0);
    assert.equal(MovementRegions.direction_k('sideways'), 0);
    // the short way round; half a turn goes counter-clockwise
    assert.equal(MovementRegions.turn_delta(0, 1), Math.PI / 2);
    assert.equal(MovementRegions.turn_delta(0, 3), -Math.PI / 2);
    assert.equal(MovementRegions.turn_delta(3, 0), Math.PI / 2);
    assert.equal(MovementRegions.turn_delta(1, 3), Math.PI);
});

test('which sides of a block stop a turned figure', () => {
    const solid = { block_above: {}, block_sides: {}, block_below: {} };
    for (const k of [0, 1, 2, 3]) assert.deepEqual(MovementRegions.local_faces(solid, k), { up: true, down: true, left: true, right: true });
    // a board one stands on from above: to a figure on the right wall it is entered from one side only
    assert.deepEqual(MovementRegions.local_faces({ block_above: {} }, 0), { up: true, down: false, left: false, right: false });
    assert.deepEqual(MovementRegions.local_faces({ block_above: {} }, 1), { up: false, down: false, left: false, right: true });
    assert.deepEqual(MovementRegions.local_faces({ block_above: {} }, 2), { up: false, down: true, left: false, right: false });
    // a slope is a block to a turned figure
    assert.deepEqual(MovementRegions.local_faces({ slope: {} }, 3), { up: true, down: true, left: true, right: true });
});

test('a region\'s gravity direction and Drehdauer; absent: down, as always', () => {
    const level = { properties: {}, layers: [
        region({ mode: 'normal', direction: 'up', turn_seconds: 1.5 }, [rect(0, 0, 100, 100)]),
        region({ mode: 'normal' }, [rect(200, 0, 100, 100)]),
        region({ mode: 'normal', direction: 'right', turn_seconds: 9 }, [rect(400, 0, 100, 100)]),
    ] };
    const resolved = MovementRegions.resolve(level);
    assert.equal(resolved.turns, true);
    assert.equal(MovementRegions.at(resolved, 50, 50).direction, 2);
    assert.equal(MovementRegions.at(resolved, 50, 50).turn_seconds, 1.5);
    // normal gravity, no current: nothing changes (as before)
    assert.equal(MovementRegions.at(resolved, 250, 50), null);
    // the Drehdauer is kept within 0 … 3 s
    assert.equal(MovementRegions.at(resolved, 450, 50).turn_seconds, 3);
    assert.equal(MovementRegions.resolve({ properties: {}, layers: [region({ mode: 'swim' }, [rect(0, 0, 10, 10)])] }).turns, false);
    // "wie darunter" only adds its current: it does not turn gravity
    assert.equal(MovementRegions.settings({ mode: 'inherit', direction: 'up' }).direction, undefined);
});

test('a region a Signal has taken away does not count', () => {
    const resolved = MovementRegions.resolve({ properties: {}, layers: [
        { type: 'sprites', sprites: [] },
        region({ mode: 'normal', direction: 'up' }, [rect(0, 0, 100, 100)], { signal_code: 1, signal_reaction: 'appear' }),
    ] });
    assert.equal(MovementRegions.at(resolved, 50, 50, new Set([1])), null);
    assert.equal(MovementRegions.at(resolved, 50, 50, new Set()).direction, 2);
    assert.equal(MovementRegions.at(resolved, 50, 50).direction, 2);
});

test('the Signale overview names a region a Schalter switches', () => {
    const level = { properties: {}, layers: [
        { type: 'sprites', properties: { name: 'Welt' }, sprites: [['s', 0, 0, { switch: { signal_code: 1 } }]] },
        region({ mode: 'normal', direction: 'up' }, [rect(0, 0, 100, 100)], { name: 'Decke', signal_code: 1, signal_reaction: 'toggle' }),
    ] };
    const [card] = signals.signal_rules(level, (ref) => ref === 's' ? { switch: {} } : {}, () => 'Schalter');
    assert.deepEqual([...card.receivers.map(r => r.text)], ['erscheint oder verschwindet der Bewegungsbereich »Decke« bei jedem Signal']);
});

// ------------------------------------------------------- the real figure
const source = fs.readFileSync(path.join(STATIC, 'app.js'), 'utf8');
const begin = source.indexOf('class Character {');
const end = source.indexOf('\nclass VariableClock {', begin);
// eslint-disable-next-line no-new-func
const Character = new Function('resolved_character_attacks', 'baddie_behavior', 'MovementRegions', 'stored_signal_code',
    'door_setting', 'switch_flipped', 'companion_abilities', 'companion_decide', 'companion_lost_step', 'companion_returned',
    'companion_return_xs', 'companion_pick_spot', 'COMPANION',
    `const SIMULATION_RATE = 60, KEY_UP = 'up', KEY_DOWN = 'down', KEY_LEFT = 'left', KEY_RIGHT = 'right', KEY_JUMP = 'jump', KEY_ACTION = 'action';
     Number.prototype.clamp ??= function (a, b) { return Math.min(Math.max(this, a), b); };
     ${source.slice(begin, end)}\nreturn Character;`)(
    () => [], () => null, MovementRegions, signals.stored_signal_code, (a, b) => typeof a === 'boolean' ? a : Boolean(b),
    (a, b) => a && !b, ai.companion_abilities, ai.companion_decide, ai.companion_lost_step, ai.companion_returned,
    ai.companion_return_xs, ai.companion_pick_spot, ai.COMPANION);

const ACTOR = { vrun: 3, vjump: 7, can_jump: true, affected_by_gravity: true, force_non_controllable: true,
    ex_left: 0.5, ex_right: 0.5, ex_top: 0.9 };
const BLOCK = { width: 24, height: 24, traits: { block_above: {}, block_sides: {}, block_below: {} } };

// A room of blocks (24 × 24, centre x = column × 24, bottom y = row × 24), the
// player, a coin, and Bewegungsbereiche (layers after the blocks' layer 0).
function room({ blocks, player, regions = [], coins = [] }) {
    const states = (role) => [{ traits: role ? { [role]: { right: {} } } : {}, properties: { fps: 8 }, frames: [{}] }];
    const sprites = [{ ...BLOCK, states: states() }, { width: 20, height: 20, traits: { actor: { ...ACTOR } }, states: states('actor') },
        { width: 24, height: 24, traits: { pickup: { points: 10 } }, states: states() }];
    const entries = [];
    const tree_x = new IntervalTree(), tree_y = new IntervalTree();
    const add = (si, x, y) => {
        const sprite = sprites[si];
        tree_x.insert([x - sprite.width / 2, x + sprite.width / 2], entries.length);
        tree_y.insert([y, y + sprite.height], entries.length);
        entries.push({ sprite_index: si, layer_index: 0, mesh: { position: { x, y }, uuid: `e${entries.length}` } });
    };
    for (const [c, r] of blocks) add(0, c * 24, r * 24);
    for (const [c, r] of coins) add(2, c * 24, r * 24);
    let now = 0;
    const level = { properties: {}, layers: [{ type: 'sprites', sprites: [] }, ...regions] };
    const game = {
        data: { sprites, properties: { gravity: 0.5, coyote_time: 50, energy_at_begin: 100, max_lives: 3, max_energy: 100 } },
        clock: { getElapsedTime: () => now }, running: true, curtain: { showing: false, show() {} }, pressed_keys: {},
        active_level_sprites: entries, interval_tree_x: tree_x, interval_tree_y: tree_y,
        geometry_and_material_for_frame: new Proxy([], { get: (a, k) => k === 'length' ? sprites.length : [[{ geometry: 'g', material: 'm' }]] }),
        movement_regions: MovementRegions.resolve(level), signal_hidden_layers: new Set(),
        minx: -1000, maxx: 1000, miny: -1000, maxy: 1000, screen_pixel_height: 240,
        camera: { left: -1e6, right: 1e6, bottom: -1e6, top: 1e6 },
        state_for_mesh: {}, future_event_list: { insert() {} }, falling_sprite_indices: {},
        transitioning_sprites: { pickup: {} }, found_keys: {}, overlay_meshes: [], action_key_targets: {}, ts_zoom_actor: -1, reached_flag: false,
        update_stats() {}, update_pressure_plates() {}, update_dynamic_interval_tree_if_necessary() {}, has_baddie_at: () => null,
        speech_action() {}, lives: 3, energy: 100, points: 0, baddies: [], companions: [],
    };
    game.collision_candidates = (x0, x1, y0, y1) => {
        const ys = new Set(tree_y.search([y0, y1]));
        return [...new Set(tree_x.search([x0, x1]))].filter(i => ys.has(i) && !entries[i]?.signal_hidden && !entries[i]?.collected);
    };
    const log = console.log;
    console.log = () => { };
    const pc = new Character(game, 1, { position: { x: player[0], y: player[1] }, scale: { x: 1 }, rotation: { z: 0 } });
    // a coin collected: gone (app.js collect_pickup does more – here, enough to count it)
    pc.collect_pickup = (entry) => { entries[entry.entry_index].collected = true; game.points += 10; };
    console.log = log;
    game.player_character = pc;
    const run = (seconds, keys = () => []) => {
        for (const stop = now + seconds; now < stop - 1e-9; now += 1 / 60) {
            game.pressed_keys = Object.fromEntries(keys(Math.round(now * 60)).map(k => [k, true]));
            pc.simulation_step(now);
        }
    };
    return { game, pc, run, time: () => now };
}

// a closed room: columns 0 … 12, rows 0 … 12
const walls = () => {
    const b = [];
    for (let i = 0; i <= 12; i++) b.push([i, 0], [i, 12], [0, i], [12, i]);
    return b;
};

test('without a turned gravity the figure walks as always', () => {
    const { pc, run } = room({ blocks: walls(), player: [48, 24] });
    run(1.0, () => ['right']);
    assert.equal(pc.gravity_k, 0);
    assert.equal(pc.mesh.position.y, 24);
    assert.ok(pc.mesh.position.x > 200);
});

test('walking into a region with gravity to the right: on the wall, "right" walks up it', () => {
    // the right part of the room pulls to the right; the inner side of the right wall is at x = 276
    const { pc, run, game } = room({ blocks: walls(), player: [48, 24], coins: [[11, 8]],
        regions: [region({ mode: 'normal', direction: 'right', turn_seconds: 0.4 }, [rect(180, 12, 96, 276)])] });
    let turned_at = null, switched_at = null;
    for (let step = 0; step < 4 * 60; step++) {
        run(1 / 60, () => ['right']);
        if (turned_at === null && pc.gravity_turn) turned_at = pc.gravity_turn.at;
        if (switched_at === null && pc.gravity_k === 1) switched_at = step / 60;
    }
    assert.equal(pc.gravity_k, 1, 'gravity pulls to the right');
    // gravity changes halfway through the turn
    assert.ok(switched_at - turned_at >= 0.19 && switched_at - turned_at <= 0.25, `${turned_at} → ${switched_at}`);
    // feet on the right wall, high up: it walked up it, never through it
    assert.ok(Math.abs(pc.mesh.position.x - 276) < 0.01, `x = ${pc.mesh.position.x}`);
    assert.ok(pc.mesh.position.y > 150, `y = ${pc.mesh.position.y}`);
    assert.equal(game.points, 10, 'the coin up on the wall');
    // drawn turned a quarter, like the camera
    assert.equal(pc.visual_angle(100), Math.PI / 2);
});

test('gravity up by a Signal: the figure falls to the ceiling and stands there', () => {
    const { pc, run, game } = room({ blocks: walls(), player: [48, 24],
        regions: [region({ mode: 'normal', direction: 'up', turn_seconds: 0 }, [rect(-1000, -1000, 3000, 3000)], { signal_code: 1, signal_reaction: 'appear' })] });
    // taken away at the start ("erscheint")
    game.signal_hidden_layers.add(1);
    run(0.5);
    assert.equal(pc.gravity_k, 0);
    game.signal_hidden_layers.delete(1);
    run(2.0, () => ['left']);
    assert.equal(pc.gravity_k, 2);
    // feet against the ceiling's underside (y = 288), the figure hanging below it
    assert.ok(Math.abs(pc.mesh.position.y - 288) < 0.01, `y = ${pc.mesh.position.y}`);
    // upside down "left" is the world's right
    assert.ok(pc.mesh.position.x > 48 + 100, `x = ${pc.mesh.position.x}`);
});

test('changing its mind before halfway: no change of gravity, the figure turns back', () => {
    const { pc, run, time } = room({ blocks: walls(), player: [48, 24],
        regions: [region({ mode: 'normal', direction: 'left', turn_seconds: 2 }, [rect(100, 12, 20, 100)])] });
    // into the narrow region and straight out again (well before halfway: 1 s)
    run(0.75, () => ['right']);
    assert.ok(pc.gravity_turn, 'turning');
    run(0.8, () => ['right']);
    assert.equal(pc.gravity_k, 0, 'never changed');
    run(3);
    assert.equal(pc.visual_angle(time()), 0);
    assert.equal(pc.gravity_turn, null);
});

// Bewegte Plattformen und Aufzüge (src/static/platforms.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MovementRegions = require('../src/static/movement_regions.js');
const ai = require('../src/static/companion_ai.js');
const { PLATFORM, platform_settings, platform_end, platform_new_state, platform_plan, MovingPlatforms } =
    require('../src/static/platforms.js');

const STATIC = path.join(__dirname, '../src/static');
const signals = vm.runInNewContext(fs.readFileSync(path.join(STATIC, 'signals.js'), 'utf8') +
    '\n({ SignalBus, placed_signal_role, signal_rules, set_signal_object_code, stored_signal_code });');
const traits = vm.runInNewContext(
    fs.readFileSync(path.join(STATIC, 'platforms.js'), 'utf8') + fs.readFileSync(path.join(STATIC, 'traits.js'), 'utf8') +
    '\n({ SPRITE_TRAITS, SPRITE_TRAITS_ORDER });');
// in this realm: the tree tells intervals by `instanceof Array`
// eslint-disable-next-line no-new-func
const IntervalTree = new Function(fs.readFileSync(path.join(STATIC, 'interval_tree.js'), 'utf8') + '\nreturn IntervalTree;')();

// ---------------------------------------------------------------- the plan

// run the plan alone: returns s per step
function plan(settings, steps, player_on = () => false, state = platform_new_state(settings)) {
    const out = [];
    for (let i = 0; i < steps; i++) {
        state = platform_plan(state, settings, { t: i / 60, player_on: player_on(i, state) });
        out.push(state.s);
    }
    return { out, state };
}

test('platform settings: absent placed values are the defaults, odd ones are ignored', () => {
    assert.deepEqual(platform_settings({}, {}), { speed: PLATFORM.SPEED, pause: PLATFORM.PAUSE,
        path_x: 96, path_y: 0, start: 'always', length: 96 });
    const s = platform_settings({ speed: 2, pause: 0 }, { path_x: -48, path_y: 36, start: 'ride' });
    assert.equal(s.length, 60);
    assert.equal(s.start, 'ride');
    assert.equal(platform_settings({ speed: 'fast' }, { start: 'hop', path_x: NaN }).start, 'always');
    assert.equal(platform_settings({ speed: 'fast' }, { path_x: NaN }).path_x, 96);
    assert.deepEqual(platform_end(10, 20, s), { x: -38, y: 56 });
    // the editor offers it as its own trait: speed and pause at the drawing, the rest per copy
    assert.deepEqual(Object.keys(traits.SPRITE_TRAITS.moving.properties), ['speed', 'pause']);
    assert.deepEqual(Object.keys(traits.SPRITE_TRAITS.moving.placed_properties), ['path_x', 'path_y', 'start', 'signal_code']);
    assert.equal(traits.SPRITE_TRAITS.moving.placed_properties.path_x.default, PLATFORM.PATH_X);
    assert.deepEqual(Object.keys(traits.SPRITE_TRAITS.moving.placed_properties.start.options), ['always', 'ride', 'signal']);
    assert.ok(traits.SPRITE_TRAITS_ORDER.some(([, list]) => list.includes('moving')));
});

test('platform "immer hin und her": to the end, a pause, back, a pause, again', () => {
    const settings = platform_settings({ speed: 2, pause: 0.5 }, { path_x: 60 });
    const { out } = plan(settings, 200);
    // 30 steps out (2 px of 60), 30 steps waiting, 30 back
    assert.equal(out[29], 1);
    assert.equal(out[30], 1);
    assert.equal(out[59], 1);
    assert.ok(out[62] < 1);
    assert.equal(out[90], 0);
    assert.ok(out[125] > 0);
    // never beyond its ends
    assert.ok(out.every(s => s >= 0 && s <= 1));
});

test('platform as an Aufzug: waits, goes when the player steps on, stays while it is on, comes back alone', () => {
    const settings = platform_settings({ speed: 4, pause: 1 }, { path_y: 120, start: 'ride' });
    // nobody: it stays at the start
    assert.ok(plan(settings, 120).out.every(s => s === 0));
    // the player steps on at step 10 and stays on
    let r = plan(settings, 120, i => i >= 10);
    assert.equal(r.out[9], 0);
    assert.ok(r.out[11] > 0);
    assert.equal(r.out[119], 1);
    // ...and steps off at step 60: back down after the pause (1 s)
    r = plan(settings, 200, i => i >= 10 && i < 60);
    assert.equal(r.out[100], 1);
    assert.ok(r.out[125] < 1);
    assert.equal(r.out[199], 0);
    // stepping back on at the top within the pause takes it down at once
    r = plan(settings, 120, i => (i >= 10 && i < 50) || i >= 60);
    assert.ok(r.out[70] < 1);
    // stepping onto it while it comes back alone: up again
    r = plan(settings, 220, i => (i >= 10 && i < 50) || i >= 125);
    assert.ok(r.out[124] < 1);
    assert.equal(r.out[219], 1);
});

test('platform "bei Signal": "an" to the end, "aus" back', () => {
    const settings = platform_settings({ speed: 3 }, { path_x: 30, start: 'signal' });
    let { out, state } = plan(settings, 30);
    assert.ok(out.every(s => s === 0));
    state.signal_on = true;
    ({ out, state } = plan(settings, 20, () => false, state));
    assert.equal(out.at(-1), 1);
    state.signal_on = false;
    ({ out } = plan(settings, 20, () => false, state));
    assert.equal(out.at(-1), 0);
});

test('signals: a platform "bei Signal" is a receiver with its own sentence; connecting makes it one', () => {
    const traits_of = (ref) => ref === 'p' ? { block_above: {}, moving: {} } : ref === 's' ? { switch: {} } : {};
    const level = { layers: [{ type: 'sprites', sprites: [
        ['s', 0, 0, { switch: { signal_code: 4 } }],
        ['p', 48, 0, { moving: { start: 'signal', signal_code: 4 } }],
        ['p', 96, 0],
    ] }] };
    assert.equal(signals.placed_signal_role(level.layers[0].sprites[1], traits_of('p')).role.one, 'Plattform');
    // without "bei Signal" it takes no part (also not on Code 0)
    assert.equal(signals.placed_signal_role(level.layers[0].sprites[2], traits_of('p')), null);
    const [card] = signals.signal_rules(level, traits_of, (ref) => ref === 'p' ? 'Plattform' : 'Schalter');
    assert.equal(card.receivers[0].text, 'fährt »Plattform« ans Ende (bei „aus“ zurück)');
    assert.ok(card.off.length > 0, 'the switch\'s "aus" matters');
    signals.set_signal_object_code(level, { kind: 'sprite', layer_index: 0, placed_index: 2, trait: 'moving' }, 4, null);
    assert.equal(JSON.stringify(level.layers[0].sprites[2][3]), '{"moving":{"signal_code":4,"start":"signal"}}');
});

// --------------------------------------------------------- the real game

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

// blocks: [column, row] (24 × 24, centre x = column × 24, bottom y = row × 24)
// platforms: { x, y, width, height, traits, placed } – placed: like placed[3].moving
// figures: { kind: 'baddie' | 'companion', x, y, traits }
function level({ blocks = [], platforms = [], player = [0, 24], figures = [] }) {
    const states = (role) => [{ traits: role ? { [role]: { right: {} } } : {}, properties: { fps: 8 }, frames: [{}] }];
    const sprites = [{ ...BLOCK, states: states() }, { width: 20, height: 20, traits: { actor: { ...ACTOR } }, states: states('actor') }];
    const entries = [];
    const tree_x = new IntervalTree(), tree_y = new IntervalTree();
    const add = (si, x, y, extra = {}) => {
        const sprite = sprites[si];
        tree_x.insert([x - sprite.width / 2, x + sprite.width / 2], entries.length);
        tree_y.insert([y, y + sprite.height], entries.length);
        entries.push({ sprite_index: si, mesh: { position: { x, y }, uuid: `e${entries.length}` }, ...extra });
    };
    for (const [c, r] of blocks) add(0, c * 24, r * 24);
    for (const p of platforms) {
        sprites.push({ width: p.width ?? 72, height: p.height ?? 12, traits: { block_above: {}, moving: { speed: 2, pause: 0.5 }, ...(p.traits ?? {}) },
            states: states() });
        // what the game makes of the placed settings (app.js setup)
        add(sprites.length - 1, p.x, p.y, { path_x: p.placed?.path_x ?? 96, path_y: p.placed?.path_y ?? 0,
            platform_start: p.placed?.start ?? 'always', platform_code: p.placed?.signal_code ?? 0 });
    }
    let now = 0;
    const game = {
        data: { sprites, properties: { gravity: 0.5, coyote_time: 50, energy_at_begin: 100, max_lives: 3, max_energy: 100 } },
        clock: { getElapsedTime: () => now }, running: true, curtain: { showing: false, show() {} }, pressed_keys: {},
        active_level_sprites: entries, interval_tree_x: tree_x, interval_tree_y: tree_y,
        // every sprite (also the figures added below) has one picture
        geometry_and_material_for_frame: new Proxy([], { get: (a, k) => k === 'length' ? sprites.length : [[{ geometry: 'g', material: 'm' }]] }),
        movement_regions: null, miny: -200, screen_pixel_height: 240, camera: { left: -1e6, right: 1e6, bottom: -1e6, top: 1e6 },
        state_for_mesh: {}, future_event_list: { insert() {} }, falling_sprite_indices: {},
        transitioning_sprites: {}, found_keys: {}, overlay_meshes: [], action_key_targets: {}, ts_zoom_actor: -1, reached_flag: false,
        update_stats() {}, update_pressure_plates() {}, update_dynamic_interval_tree_if_necessary() {}, has_baddie_at: () => null,
        speech_action() {}, lives: 3, energy: 100, points: 0, baddies: [], companions: [],
    };
    // the engine's own lookup (app.js Game.collision_candidates)
    game.collision_candidates = (x0, x1, y0, y1) => {
        const ys = new Set(tree_y.search([y0, y1]));
        return [...new Set(tree_x.search([x0, x1]))].filter(i => ys.has(i) && !entries[i]?.signal_hidden);
    };
    const log = console.log;
    console.log = () => { };
    const pc = new Character(game, 1, { position: { x: player[0], y: player[1] }, scale: { x: 1 } });
    game.player_character = pc;
    for (const f of figures) {
        sprites.push({ width: 20, height: 20, traits: { [f.kind]: { ...(f.traits ?? {}) } }, states: states(f.kind) });
        const c = new Character(game, sprites.length - 1, { position: { x: f.x, y: f.y }, scale: { x: 1 } });
        (f.kind === 'baddie' ? game.baddies : game.companions).push(c);
    }
    game.moving_platforms = MovingPlatforms.setup(game);
    console.log = log;
    const platform = (i = 0) => game.moving_platforms[i];
    const at = (i = 0) => entries[game.moving_platforms[i].entry_index].mesh.position;
    // keys: (step) => ['right', ...]
    const run = (seconds, keys = () => []) => {
        for (const stop = now + seconds; now < stop - 1e-9; now += 1 / 60) {
            game.pressed_keys = Object.fromEntries(keys(Math.round(now * 60)).map(k => [k, true]));
            MovingPlatforms.step(game, now);
            pc.simulation_step(now);
            for (const c of [...game.baddies, ...game.companions]) c.simulation_step(now);
        }
    };
    return { game, pc, run, platform, at, entries, tree_x, tree_y };
}

const ground = (from, to, row = 0) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, row]);

test('platform: the player standing on it rides along and stays on top', () => {
    // a platform over a pit, the player on it
    const { pc, run, at } = level({ blocks: [...ground(-6, -2), ...ground(10, 16)], platforms: [{ x: 0, y: 12 }], player: [0, 24] });
    run(0.2);
    assert.equal(pc.mesh.position.y, 24, 'on top');
    run(0.75);
    // the platform went 96 px (2 px per step) and the player with it
    assert.equal(at().x, 96);
    assert.ok(Math.abs(pc.mesh.position.x - 96) < 0.01, `x ${pc.mesh.position.x}`);
    assert.equal(pc.mesh.position.y, 24);
    // ...and back again after the pause
    run(1.4);
    assert.equal(at().x, 0);
    assert.ok(Math.abs(pc.mesh.position.x) < 0.01);
});

test('platform: the collision trees follow it – the player can land on it where it is now', () => {
    const { pc, run, at, tree_x } = level({ blocks: ground(-6, -2), platforms: [{ x: 0, y: -60, placed: { path_x: 0, path_y: 48, start: 'signal' } }],
        player: [0, 100] });
    // the player falls past where the platform was, and lands where it is
    run(2);
    assert.equal(at().y, -60);
    assert.equal(pc.mesh.position.y, -48);
    assert.ok(tree_x.search([-36, 36]).length > 0);
});

test('Aufzug: the player steps on, rides up to the ledge, walks off; it comes back down alone', () => {
    // floor at row 0, a ledge 5 blocks up on the right; the lift is flush with the floor in a gap
    const blocks = [...ground(-6, -2), ...ground(2, 4), ...ground(2, 12, 5)];
    const { pc, run, at } = level({ blocks, platforms: [{ x: 0, y: 12, placed: { path_x: 0, path_y: 120, start: 'ride' } }], player: [-72, 24] });
    run(0.5);
    assert.equal(at().y, 12, 'waits for the player');
    // onto the lift
    run(0.4, () => ['right']);
    run(1.6);
    assert.equal(at().y, 132);
    assert.equal(pc.mesh.position.y, 144, 'up with it');
    // off to the right onto the ledge
    run(1.0, () => ['right']);
    assert.ok(pc.mesh.position.x > 120 && pc.mesh.position.y === 144, `x ${pc.mesh.position.x} y ${pc.mesh.position.y}`);
    // the lift waits its pause (0.5 s) and goes down alone
    run(2.0);
    assert.equal(at().y, 12);
    assert.equal(pc.mesh.position.y, 144);
});

test('platform: sliding out of a cliff level with its top, it does not take along who stands on the cliff', () => {
    const { pc, run, at } = level({ blocks: [...ground(-6, 1), ...ground(5, 9)],
        platforms: [{ x: 0, y: 12, placed: { path_x: 72 } }], player: [0, 24] });
    run(0.6);
    assert.equal(at().x, 72);
    assert.equal(pc.mesh.position.x, 0);
    assert.equal(pc.mesh.position.y, 24);
});

test('platform: a rising one-way platform picks up a figure whose feet it passes', () => {
    // the platform starts inside the floor (only "von oben") and rises through it
    const { pc, run, at } = level({ blocks: ground(-6, 6), platforms: [{ x: 0, y: 0, placed: { path_x: 0, path_y: 72 } }], player: [0, 24] });
    run(0.55);
    assert.equal(at().y, 66);
    assert.equal(pc.mesh.position.y, 78);
});

test('platform: a solid one waits for a figure in its way and never pushes it', () => {
    const solid = { block_sides: {}, block_below: {} };
    const { pc, run, at, platform } = level({ blocks: ground(-6, 12),
        platforms: [{ x: -24, y: 24, height: 24, traits: solid, placed: { path_x: 120 } }], player: [48, 24] });
    run(1);
    // it stopped in front of the player
    assert.ok(at().x + 36 <= pc.mesh.position.x - 5 + 0.01, `platform ${at().x} player ${pc.mesh.position.x}`);
    assert.equal(pc.mesh.position.x, 48);
    assert.equal(platform().waiting, true);
    // the player jumps onto it: now it goes on, with the player on top
    run(0.4, (i) => i % 60 < 4 ? ['jump', 'left'] : ['left']);
    run(0.5);
    assert.equal(at().x, 96);
    assert.equal(pc.mesh.position.y, 48);
});

test('platform: a lift never pushes its rider into the ceiling – it waits below', () => {
    const blocks = [...ground(-6, 6), [0, 4], [1, 4], [-1, 4]];
    const { pc, run, at, platform } = level({ blocks, platforms: [{ x: 0, y: 24, placed: { path_x: 0, path_y: 96, start: 'signal' } }], player: [0, 36] });
    MovingPlatforms.signal(platform(), true);
    run(2);
    // the head (0.9 × 20 = 18 px) stays below the ceiling at 96
    assert.ok(pc.mesh.position.y + 18 <= 96 + 0.01, `head at ${pc.mesh.position.y + 18}`);
    assert.ok(at().y < 120);
    assert.equal(platform().waiting, true);
    // the player steps off: on it goes
    run(1, () => ['right']);
    run(1);
    assert.equal(at().y, 120);
});

test('platform: enemies and Begleiter ride along, but only the player starts an Aufzug', () => {
    const { game, run, at } = level({ blocks: ground(-12, -4),
        platforms: [{ x: 0, y: 12 }, { x: 240, y: 12, placed: { path_x: 0, path_y: 96, start: 'ride' } }],
        player: [-200, 24],
        figures: [
            { kind: 'baddie', x: 0, y: 24, traits: { vrun: 0, energy: 10, ex_left: 1, ex_right: 1, ex_top: 1, wait_until_seen: false } },
            { kind: 'companion', x: 240, y: 24, traits: { can_jump: false, vrun: 0.01 } },
        ] });
    run(0.5);
    // the enemy went along on the first platform
    assert.ok(Math.abs(game.baddies[0].mesh.position.x - at(0).x) < 1, `${game.baddies[0].mesh.position.x} vs ${at(0).x}`);
    assert.equal(game.baddies[0].mesh.position.y, 24);
    // the Begleiter stands on the lift: it does not start
    assert.equal(at(1).y, 12);
});

test('platform "bei Signal": the signal moves it, its riders go along', () => {
    const { pc, run, at, platform } = level({ blocks: ground(-6, -2), platforms: [{ x: 0, y: 12, placed: { path_x: 48, start: 'signal' } }], player: [0, 24] });
    const bus = new signals.SignalBus();
    bus.connect(5, (value) => MovingPlatforms.signal(platform(), value));
    run(0.5);
    assert.equal(at().x, 0);
    bus.send(5, true, 0);
    run(0.5);
    assert.equal(at().x, 48);
    assert.ok(Math.abs(pc.mesh.position.x - 48) < 0.01);
    bus.send(5, false, 0);
    run(0.5);
    assert.equal(at().x, 0);
});

test('platform: a game without moving sprites has no platforms and nothing changes', () => {
    const { game, pc, run } = level({ blocks: ground(-6, 6) });
    assert.deepEqual(game.moving_platforms, []);
    run(0.5, () => ['right']);
    assert.ok(pc.mesh.position.x > 30);
    // a moving sprite without a Weg does not move either
    const still = level({ blocks: ground(-6, 6), platforms: [{ x: 0, y: 24, placed: { path_x: 0, path_y: 0 } }] });
    assert.deepEqual(still.game.moving_platforms, []);
});

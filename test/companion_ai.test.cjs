// Begleiter: the decisions (src/static/companion_ai.js) and the real
// Character class of app.js moving a companion through small block worlds.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ai = require('../src/static/companion_ai.js');
const MovementRegions = require('../src/static/movement_regions.js');
const { COMPANION, companion_abilities, companion_keeps_following, companion_jump_height, companion_decide,
    companion_lost_step, companion_returned, companion_return_xs, companion_pick_spot } = ai;

const STATIC = path.join(__dirname, '../src/static');

// ------------------------------------------------ pure decisions

test('Begleiter: abilities with defaults, flying excludes jumping and swimming', () => {
    assert.deepEqual(companion_abilities({}), { fly: false, jump: true, swim: false, vrun: 3, vjump: 6 });
    assert.deepEqual(companion_abilities({ can_jump: false, can_swim: true, vrun: 2 }), { fly: false, jump: false, swim: true, vrun: 2, vjump: 6 });
    const bird = companion_abilities({ can_fly: true, can_jump: true, can_swim: true });
    assert.equal(bird.fly, true);
    assert.equal(bird.jump, false);
    assert.equal(bird.swim, false);
});

test('Begleiter: following has hysteresis between stopping and starting again', () => {
    assert.equal(companion_keeps_following(false, COMPANION.FOLLOW + 1), true);
    assert.equal(companion_keeps_following(true, COMPANION.STOP - 1), false);
    // in between it keeps what it did
    const middle = (COMPANION.STOP + COMPANION.FOLLOW) / 2;
    assert.equal(companion_keeps_following(true, middle), true);
    assert.equal(companion_keeps_following(false, middle), false);
});

test('Begleiter: its jump height follows its own Sprungkraft', () => {
    assert.ok(companion_jump_height(5.5, 0.5) > 24 && companion_jump_height(5.5, 0.5) < 48);
    assert.ok(companion_jump_height(7, 0.5) > 48);
});

const flat = (player, extra = {}) => ({
    now: 0, on_ground: true, fluid: null, near_surface: false, player,
    wall: () => false, clearable: () => true, ground: () => true, landing: () => true,
    safe_drop: () => true, water: () => false, ...extra,
});

test('Begleiter: walks towards the player, stops nearby, does not push into it', () => {
    const a = companion_abilities({});
    const mem = {};
    assert.equal(companion_decide(a, mem, flat({ dx: 100, dy: 0 })).keys.right, true);
    const near = companion_decide(a, mem, flat({ dx: 20, dy: 0 }));
    assert.equal(near.keys.right || near.keys.left, false);
    assert.equal(near.face, 'right');
    // the player right above it (on a ledge): it does not run back and forth
    assert.equal(companion_decide(a, {}, flat({ dx: 3, dy: 60 })).keys.left, false);
});

test('Begleiter: a wall it cannot jump over, a gap it cannot jump across, water without swimming – it waits', () => {
    const a = companion_abilities({});
    let out = companion_decide(a, {}, flat({ dx: 100, dy: 48 }, { wall: () => true, clearable: () => false }));
    assert.equal(out.keys.right || out.keys.jump, false);
    out = companion_decide(a, {}, flat({ dx: 100, dy: 48 }, { wall: () => true, clearable: () => true }));
    assert.deepEqual([out.keys.right, out.keys.jump], [true, true]);
    out = companion_decide(a, {}, flat({ dx: 100, dy: 0 }, { ground: () => false, landing: () => false }));
    assert.equal(out.keys.right, false);
    out = companion_decide(a, {}, flat({ dx: 100, dy: 0 }, { ground: () => false, landing: () => true }));
    assert.deepEqual([out.keys.right, out.keys.jump], [true, true]);
    // a robot that cannot jump stays in front of every step
    out = companion_decide(companion_abilities({ can_jump: false }), {}, flat({ dx: 100, dy: 0 }, { wall: () => true }));
    assert.equal(out.keys.jump, false);
    // water ahead: a swimmer goes on, everybody else waits at the shore
    out = companion_decide(a, {}, flat({ dx: 100, dy: -30 }, { water: () => true }));
    assert.equal(out.keys.right, false);
    out = companion_decide(companion_abilities({ can_swim: true }), {}, flat({ dx: 100, dy: -30 }, { water: () => true }));
    assert.equal(out.keys.right, true);
});

test('Begleiter: a second one keeps a place farther back instead of piling up', () => {
    const a = companion_abilities({});
    const at = 40;   // between the first one's stop and the second one's
    const first = companion_decide(a, { moving: true }, flat({ dx: at, dy: 0 }));
    const second = companion_decide(a, { moving: true }, flat({ dx: at, dy: 0 }, { slot: 1 }));
    assert.equal(first.keys.right, true);
    assert.equal(second.keys.right, false);
});

test('Begleiter: a flyer heads for a spot behind and above the player, without gravity', () => {
    const a = companion_abilities({ can_fly: true, vrun: 3 });
    const out = companion_decide(a, {}, flat({ dx: 200, dy: 40, facing: 'right' }, { on_ground: false }));
    assert.equal(out.no_gravity, true);
    assert.equal(out.keys.right, true);
    assert.equal(out.keys.jump, false);
    assert.ok(out.dy > 0);
    // arrived behind the player: it hovers
    const mem = {};
    const hover = companion_decide(a, mem, flat({ dx: COMPANION.FLY_SIDE, dy: -COMPANION.FLY_ABOVE, facing: 'right' }));
    assert.equal(hover.keys.right || hover.keys.left, false);
    assert.ok(Math.abs(hover.dy) < 0.5);
});

test('Begleiter: lost only when far, out of sight and getting no closer for a while', () => {
    const mem = {};
    const step = (now, distance, visible = false, extra = {}) => companion_lost_step(mem, { now, distance, visible, busy: false, fell_out: false, ...extra });
    // far but visible: never lost
    for (let t = 0; t <= 10; t += 0.5) assert.equal(step(t, 400, true), 'following');
    // far, out of sight, but getting closer: not lost
    for (let t = 10, d = 600; t <= 20; t += 0.5, d -= 30) assert.equal(step(t, Math.max(d, 200)), 'following');
    // far, out of sight, stuck: lost after STUCK_SECONDS …
    const t0 = 30;
    step(t0, 300, true);
    assert.equal(step(t0 + COMPANION.STUCK_SECONDS - 0.5, 300), 'following');
    assert.equal(step(t0 + COMPANION.STUCK_SECONDS, 300), 'lost');
    // … and comes back only RETURN_DELAY later – no instant teleport
    assert.equal(step(t0 + COMPANION.STUCK_SECONDS + COMPANION.RETURN_DELAY - 0.1, 300), 'lost');
    assert.equal(step(t0 + COMPANION.STUCK_SECONDS + COMPANION.RETURN_DELAY, 300), 'return');
    companion_returned(mem, 40, 60);
    assert.equal(step(40.5, 60), 'following');
});

test('Begleiter: seen again while lost, it simply follows on; fallen out of the level, it is lost at once', () => {
    const mem = {};
    companion_lost_step(mem, { now: 0, distance: 300, visible: false });
    companion_lost_step(mem, { now: COMPANION.STUCK_SECONDS, distance: 300, visible: false });
    assert.equal(mem.state, 'lost');
    assert.equal(companion_lost_step(mem, { now: COMPANION.STUCK_SECONDS + 0.5, distance: 300, visible: true }), 'following');
    const fell = {};
    assert.equal(companion_lost_step(fell, { now: 1, distance: 50, visible: true, fell_out: true }), 'lost');
    assert.equal(companion_lost_step(fell, { now: 1 + COMPANION.RETURN_DELAY, distance: 50, visible: true, fell_out: true }), 'return');
});

test('Begleiter: comes back outside the screen, behind the player first, at the player\'s height', () => {
    const xs = companion_return_xs({ left: 100, right: 400 }, 250, 'left', 20, 2, 10);
    assert.deepEqual(xs, [80, 70, 420, 430]);
    const spot = companion_pick_spot([{ x: 80, y: 0, order: 0 }, { x: 420, y: 48, order: 2 }, { x: 70, y: 48, order: 1 }], 48);
    assert.deepEqual(spot, { x: 70, y: 48, order: 1 });
    assert.equal(companion_pick_spot([], 0), null);
});

// ------------------------------------------------ the real Character in a block world

const source = fs.readFileSync(path.join(STATIC, 'app.js'), 'utf8');
const begin = source.indexOf('class Character {');
const end = source.indexOf('\nclass VariableClock {', begin);
// eslint-disable-next-line no-new-func
const Character = new Function('resolved_character_attacks', 'baddie_behavior', 'MovementRegions',
    'companion_abilities', 'companion_decide', 'companion_lost_step', 'companion_returned',
    'companion_return_xs', 'companion_pick_spot', 'COMPANION',
    `const SIMULATION_RATE = 60, KEY_UP = 'up', KEY_DOWN = 'down', KEY_LEFT = 'left', KEY_RIGHT = 'right', KEY_JUMP = 'jump', KEY_ACTION = 'action';
     Number.prototype.clamp ??= function (a, b) { return Math.min(Math.max(this, a), b); };
     ${source.slice(begin, end)}\nreturn Character;`)(
    () => [], () => null, MovementRegions, companion_abilities, companion_decide, companion_lost_step,
    companion_returned, companion_return_xs, companion_pick_spot, COMPANION);

const traits = vm.runInNewContext(fs.readFileSync(path.join(STATIC, 'traits.js'), 'utf8') + '\n({ SPRITE_TRAITS, STATE_TRAITS_ORDER });');

// blocks: [column, row] (24 × 24, centre x = column × 24, bottom y = row × 24)
function world({ blocks, companion = {}, regions = [], player = [0, 24], start = [0, 24], view = 1e6 }) {
    const block = { width: 24, height: 24, traits: { block_above: {}, block_sides: {}, block_below: {} },
        states: [{ traits: {}, properties: { fps: 8 }, frames: [{}] }] };
    const sprite = { width: 20, height: 20, traits: { companion },
        states: [{ traits: { companion: { right: {} } }, properties: { fps: 8 }, frames: [{}] }] };
    const entries = blocks.map(([c, r]) => ({ sprite_index: 0, mesh: { position: { x: c * 24, y: r * 24 } } }));
    const overlaps = (a0, a1, b0, b1) => a0 <= b1 && b0 <= a1;
    const search = axis => ({ search: ([a, b]) => entries.map((e, i) => i).filter(i => axis === 'x' ?
        overlaps(entries[i].mesh.position.x - 12, entries[i].mesh.position.x + 12, a, b) :
        overlaps(entries[i].mesh.position.y, entries[i].mesh.position.y + 24, a, b)) });
    let now = 0;
    const p = { mesh: { position: { x: player[0], y: player[1] } }, dead: () => false, last_horizontal_facing: 'right', fluid_mode: null };
    const game = {
        data: { sprites: [block, sprite], properties: { gravity: 0.5, coyote_time: 50 } },
        clock: { getElapsedTime: () => now }, running: true, curtain: { showing: false },
        active_level_sprites: entries, interval_tree_x: search('x'), interval_tree_y: search('y'),
        collision_candidates: (x0, x1, y0, y1) => entries.map((e, i) => i).filter(i =>
            overlaps(entries[i].mesh.position.x - 12, entries[i].mesh.position.x + 12, x0, x1) &&
            overlaps(entries[i].mesh.position.y, entries[i].mesh.position.y + 24, y0, y1)),
        geometry_and_material_for_frame: [null, [[{ geometry: 'g', material: 'm' }]]],
        movement_regions: MovementRegions.resolve({ layers: regions.map(rects => ({ type: 'movement_region', rects, movement: { mode: 'swim' } })) }),
        player_character: p, miny: -96, screen_pixel_height: 240,
        camera: { left: -1e6, right: 1e6, bottom: -1e6, top: 1e6 },
    };
    // the camera follows the player (a window of `view` px around it)
    const follow = () => Object.assign(game.camera, { left: p.mesh.position.x - view / 2, right: p.mesh.position.x + view / 2,
        bottom: p.mesh.position.y - view / 3, top: p.mesh.position.y + view / 3 });
    const log = console.log;
    console.log = () => { };
    const c = new Character(game, 1, { position: { x: start[0], y: start[1] }, scale: { x: 1 } });
    console.log = log;
    const trace = [];
    const run = (seconds) => {
        for (const stop = now + seconds; now < stop - 1e-9; now += 1 / 60) {
            follow();
            c.simulation_step(now);
            trace.push({ t: now, x: c.mesh.position.x, y: c.mesh.position.y, state: c.state, fluid: c.fluid_mode });
        }
    };
    return { c, p, game, run, trace };
}

const ground = (from, to, row = 0) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, row]);

test('Begleiter is its own role: not an enemy, saved traits untouched, no health', () => {
    const saved = { vjump: 4 };
    const { c } = world({ blocks: ground(-5, 20), companion: saved });
    assert.equal(c.character_trait, 'companion');
    assert.equal(c.energy, undefined);
    assert.deepEqual(saved, { vjump: 4 });
    c.take_damage(100);
    assert.equal(c.active, true);
    // the editor offers it as its own trait with child-level settings only
    assert.deepEqual(Object.keys(traits.SPRITE_TRAITS.companion.properties), ['vrun', 'can_fly', 'can_jump', 'vjump', 'can_swim']);
    assert.ok(traits.STATE_TRAITS_ORDER.companion);
});

test('Begleiter never acts on the level: crumbling blocks under it stay where they are', () => {
    // a crumbling block (falls_down) under the companion's way: only the player
    // (and enemies that may) make it fall – the game's state for it is never touched
    const { c, game, run } = world({ blocks: ground(-5, 20), player: [300, 24] });
    game.data.sprites[0].traits.falls_down = { timeout: 0.5, accumulates: false, falls_on_baddie: true, damage: 0 };
    game.future_event_list = { insert() { throw new Error('a Begleiter made a block fall'); } };
    run(3);
    assert.ok(c.mesh.position.x > 200);
    assert.ok(game.active_level_sprites.every(e => !e.falling));
});

test('Begleiter on flat ground: follows, stops at a comfortable distance, stays put for small moves', () => {
    const { c, p, run, trace } = world({ blocks: ground(-5, 40), player: [300, 24] });
    run(4);
    const gap = p.mesh.position.x - c.mesh.position.x;
    assert.ok(gap > 0 && gap <= COMPANION.FOLLOW, `gap ${gap}`);
    assert.ok(gap >= COMPANION.STOP - 8, `gap ${gap}`);
    // a small step of the player: it stays where it is (no jitter)
    const x = c.mesh.position.x;
    p.mesh.position.x += 10;
    run(1);
    assert.equal(c.mesh.position.x, x);
    // a big step: it follows again
    p.mesh.position.x += 80;
    run(2);
    assert.ok(c.mesh.position.x > x + 50);
    // it never passed the player
    assert.ok(trace.every(s => s.x < p.mesh.position.x));
});

test('Begleiter with a weak jump: over the small step, but not up the high ledge Pip climbs', () => {
    const blocks = [...ground(-5, 40), [5, 1], ...ground(10, 40, 1), ...ground(10, 40, 2)];
    const weak = world({ blocks, companion: { vjump: 5.5 }, player: [15 * 24, 72] });
    weak.run(6);
    assert.ok(weak.c.mesh.position.x > 5 * 24, 'over the small step');
    assert.ok(weak.c.mesh.position.x < 10 * 24 - 12 && weak.c.mesh.position.y < 72, 'still below the ledge');
    // the same companion with Pip's jump makes it
    const strong = world({ blocks, companion: { vjump: 7 }, player: [15 * 24, 72] });
    strong.run(6);
    assert.equal(strong.c.mesh.position.y, 72);
    // without a jump at all it stays in front of the first step
    const robot = world({ blocks, companion: { can_jump: false }, player: [15 * 24, 72] });
    robot.run(6);
    assert.ok(robot.c.mesh.position.x < 5 * 24 - 12);
});

test('Begleiter that flies crosses a gap without jumping and follows the player up', () => {
    const blocks = [...ground(-5, 5), ...ground(15, 30), ...ground(15, 30, 1)];
    const { c, p, run, trace } = world({ blocks, companion: { can_fly: true }, player: [22 * 24, 48] });
    run(7);
    assert.ok(trace.every(s => s.y > 0), 'never fell into the gap');
    assert.ok(Math.abs(c.mesh.position.x - (p.mesh.position.x - COMPANION.FLY_SIDE)) < 12);
    assert.ok(c.mesh.position.y > 48 + 10, 'above the player');
});

test('Begleiter that got stuck is lost after a while and comes back – not at once, and behind the player', () => {
    const blocks = [...ground(-5, 60), ...ground(10, 60, 1), ...ground(10, 60, 2)];
    const { c, p, run, trace } = world({ blocks, companion: { vjump: 5.5 }, player: [30 * 24, 72], view: 300 });
    run(COMPANION.STUCK_SECONDS + 1.5);
    assert.equal(c.companion_stats.returned, 0, 'no return before the lost delay');
    assert.ok(c.mesh.position.y < 72);
    run(COMPANION.RETURN_DELAY + 3);
    assert.equal(c.companion_stats.lost, 1);
    assert.equal(c.companion_stats.returned, 1);
    // it came back up on the player's level, outside the screen, and walked in
    const back = trace.find(s => s.y === 72);
    assert.ok(back.x < p.mesh.position.x - 150, `came back at ${back.x}`);
    assert.ok(p.mesh.position.x - c.mesh.position.x <= COMPANION.FOLLOW + 1);
});

test('Begleiter that is merely behind, but catching up, is never declared lost', () => {
    const { c, run } = world({ blocks: ground(-5, 80), player: [70 * 24, 24], view: 300 });
    run(12);
    assert.equal(c.companion_stats.lost, 0);
    assert.equal(c.companion_stats.returned, 0);
});

test('Begleiter in the water: a swimmer follows the player in, a non-swimmer waits at the shore', () => {
    // land up to column 7, a pool from column 8 with its floor two blocks lower
    const blocks = [...ground(-5, 7), ...ground(8, 25, -2), ...ground(26, 30)];
    const water = [[{ left: 7.5 * 24, bottom: -24, width: 18 * 24, height: 48 }]];
    const swimmer = world({ blocks, regions: water, companion: { can_swim: true }, player: [14 * 24, 0] });
    swimmer.p.fluid_mode = 'swim';
    swimmer.run(6);
    assert.ok(swimmer.trace.some(s => s.fluid === 'swim'));
    assert.ok(swimmer.c.mesh.position.x > 9 * 24);
    // … and climbs out on the far bank after the player (a leap as high as its jump)
    const bank = [...ground(-5, 7), ...ground(8, 15, -3), ...ground(16, 30), [7, -2], [7, -1], [16, -2], [16, -1]];
    const lake = [[{ left: 7.5 * 24, bottom: -48, width: 8 * 24, height: 66 }]];
    const out = world({ blocks: bank, regions: lake, companion: { can_swim: true, vjump: 5 }, player: [20 * 24, 24], start: [12 * 24, -20] });
    out.run(5);
    assert.equal(out.c.mesh.position.y, 24);
    assert.ok(out.c.mesh.position.x > 16 * 24 - 12);
    const walker = world({ blocks, regions: water, player: [14 * 24, 0] });
    walker.run(6);
    assert.ok(walker.trace.every(s => s.fluid !== 'swim'));
    assert.ok(walker.c.mesh.position.x < 8 * 24 - 10 && walker.c.mesh.position.y === 24);
});

test('old games are unaffected: fix_game_data adds no Begleiter to sprites without it', () => {
    const ctx = { console, DEFAULT_WIDTH: 24, DEFAULT_HEIGHT: 24, createDataUrlForImageSize: () => undefined };
    vm.createContext(ctx);
    for (const f of ['signals.js', 'traits.js', 'baddie_ai.js', 'game_ids.js', 'game.js'])
        vm.runInContext(fs.readFileSync(path.join(STATIC, f), 'utf8'), ctx, { filename: f });
    vm.runInContext('globalThis.__fix = (d) => { const g = { data: d }; Game.prototype.fix_game_data.call(g); return g.data; };', ctx);
    const old = { sprites: [{ traits: { actor: {} }, states: [{ frames: [{ src: 'x' }] }] }, { traits: { baddie: {} }, states: [{ frames: [{ src: 'x' }] }] }] };
    const fixed = JSON.stringify(ctx.__fix(old));
    assert.ok(!fixed.includes('companion'));
    // a new Begleiter gets exactly its child-level defaults
    const fresh = ctx.__fix({ sprites: [{ traits: { companion: {} }, states: [{ frames: [{ src: 'x' }] }] }] });
    assert.deepEqual(JSON.parse(JSON.stringify(fresh.sprites[0].traits.companion)), { vrun: 3, can_fly: false, can_jump: true, vjump: 6, can_swim: false });
});

test('companion states: every menu entry has a label, and the figure states a companion can show are all offered', () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const { STATE_TRAITS_ORDER, STATE_TRAITS } = vm.runInNewContext(
        fs.readFileSync(require.resolve('../src/static/traits.js'), 'utf8') + '\n({ STATE_TRAITS_ORDER, STATE_TRAITS });');
    const keys = (order) => order.flatMap(entry => typeof entry === 'string' ? [entry]
        : entry[1].flatMap(sub => typeof sub === 'string' ? [sub] : Array.isArray(sub) ? sub[1] : []));
    for (const role of ['actor', 'baddie', 'companion']) {
        for (const key of keys(STATE_TRAITS_ORDER[role])) {
            assert.ok(STATE_TRAITS[role][key]?.label, `${role}.${key} has a label`);
        }
    }
    const companion = new Set(keys(STATE_TRAITS_ORDER.companion));
    const actor = new Set(keys(STATE_TRAITS_ORDER.actor));
    // what a companion does not have: no ladders, no combat, no health
    const missing = [...actor].filter(key => !companion.has(key)).map(key => key.replace(/_(front|back|left|right)$/, ''));
    assert.deepEqual([...new Set(missing)].sort(), ['attack', 'climb', 'dead', 'hit']);
    for (const dir of ['front', 'back', 'left', 'right']) assert.ok(companion.has(`fly_${dir}`));
});

test('Begleiter "kommt erst bei Signal mit": waits where it stands, looks at the player, then follows', () => {
    const { c, p, run } = world({ blocks: ground(-5, 40), player: [120, 24], start: [0, 24] });
    c.companion_waiting = true;
    run(2);
    assert.equal(c.mesh.position.x, 0);
    assert.equal(c.direction, 'right', 'it looks at the player');
    assert.equal(c.companion_stats.lost, 0);
    // the signal arrives (Game.setup_signals sets the flag back)
    c.companion_waiting = false;
    run(2);
    assert.ok(c.mesh.position.x > 60, `x ${c.mesh.position.x}`);
    assert.ok(p.mesh.position.x - c.mesh.position.x <= COMPANION.FOLLOW);
});

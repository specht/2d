const test = require('node:test');
const assert = require('node:assert/strict');
const { baddie_moves, baddie_behavior, baddie_behavior_type, behavior_uses_patrol, baddie_decide } = require('../src/static/baddie_ai.js');

// A flat world without walls: the enemy stands at x = 0 on endless ground.
function world(extra = {}) {
    return {
        now: 0, on_ground: true, facing: 'right', x: 0, y: 0, x0: 0, y0: 0, half_width: 12,
        on_ladder: false, player: null, clear: () => true, wall: () => false, ground: () => true, landing: () => true,
        ...extra,
    };
}

test('games without a behaviour keep the classic enemy', () => {
    assert.equal(baddie_behavior({}), null);
    assert.equal(baddie_behavior({ behavior: { type: 'unknown' } }), null);
    assert.equal(baddie_behavior_type({}), 'guard');
    assert.equal(behavior_uses_patrol({}), true);
    assert.equal(behavior_uses_patrol({ behavior: { type: 'stomper' } }), false);
});

test('settings get defaults and are clamped', () => {
    const b = baddie_behavior({ behavior: { type: 'hunter', sight: 99999 } });
    assert.equal(b.sight, 1000);
    assert.equal(b.chase, 2.0);
    assert.deepEqual(baddie_decide({ type: 'guard', range: 3 }, {}, world()), { patrol: true });
});

test('a hunter notices the player in front, chases and gives up later', () => {
    const b = baddie_behavior({ behavior: { type: 'hunter' } });
    const mem = {};
    assert.equal(baddie_decide(b, mem, world({ player: { dx: -80, dy: 0 } })).patrol, true, 'behind him: not seen');
    const seen = baddie_decide(b, mem, world({ player: { dx: 80, dy: 0 } }));
    assert.equal(seen.alert, true);
    assert.equal(seen.keys.right, true);
    assert.equal(seen.speed, 2.0);
    const again = baddie_decide(b, mem, world({ now: 0.1, player: { dx: -80, dy: 0 } }));
    assert.equal(again.keys.left, true, 'once chasing he turns around');
    assert.equal(again.alert, false, 'the "!" appears only once');
    const hidden = world({ now: 0.2, player: { dx: 300, dy: 0 } });
    assert.equal(baddie_decide(b, mem, hidden).keys.right, true, 'still searching');
    assert.equal(baddie_decide(b, mem, { ...hidden, now: 5 }).patrol, true, 'gave up');
});

test('a hunter jumps at walls and waits at ledges', () => {
    const b = baddie_behavior({ behavior: { type: 'hunter' } });
    const wall = baddie_decide(b, {}, world({ player: { dx: 60, dy: 0 }, wall: () => true }));
    assert.equal(wall.keys.jump, true);
    const ledge = baddie_decide(b, {}, world({ player: { dx: 60, dy: 0 }, ground: () => false }));
    assert.equal(ledge.keys.right, false);
    assert.equal(ledge.face, 'right');
});

test('walls block the sight', () => {
    const b = baddie_behavior({ behavior: { type: 'hunter' } });
    assert.equal(baddie_decide(b, {}, world({ player: { dx: 60, dy: 0 }, clear: () => false })).patrol, true);
});

test('a coward runs away and trembles when cornered', () => {
    const b = baddie_behavior({ behavior: { type: 'coward' } });
    const mem = {};
    const run = baddie_decide(b, mem, world({ player: { dx: 40, dy: 0 } }));
    assert.equal(run.keys.left, true);
    assert.equal(run.alert, true);
    const cornered = baddie_decide(b, mem, world({ now: 0.1, player: { dx: 40, dy: 0 }, wall: d => d === 'left' }));
    assert.equal(cornered.keys.left, false);
    assert.equal(cornered.face, 'right');
    assert.equal(run.pose, 'flee');
    assert.equal(cornered.pose, 'flee', 'trembling in the corner');
    assert.equal(baddie_decide(b, mem, world({ now: 3, player: { dx: 500, dy: 0 } })).patrol, true);
});

test('a lurker winds up, charges and is stunned by a wall', () => {
    const b = baddie_behavior({ behavior: { type: 'lurker' } });
    const mem = {};
    assert.equal(baddie_decide(b, mem, world()).keys.right, false, 'waits');
    const spotted = baddie_decide(b, mem, world({ player: { dx: -100, dy: 0 } }));
    assert.equal(spotted.alert, true);
    assert.equal(spotted.face, 'left');
    assert.equal(baddie_decide(b, mem, world({ now: 0.2 })).keys.left, false, 'still winding up');
    const charge = baddie_decide(b, mem, world({ now: 0.4 }));
    assert.equal(charge.keys.left, true);
    assert.equal(charge.speed, 5.0);
    const bump = baddie_decide(b, mem, world({ now: 0.8, wall: () => true }));
    assert.equal(bump.stun, 1.5);
});

test('a hopper only moves by jumping and turns before a gap', () => {
    const b = baddie_behavior({ behavior: { type: 'hopper', interval: 1.0 } });
    const mem = {};
    assert.equal(baddie_decide(b, mem, world()).keys.jump, false, 'first hop after half an interval');
    const hop = baddie_decide(b, mem, world({ now: 0.5 }));
    assert.deepEqual(hop.keys, { left: false, right: true, jump: true });
    assert.deepEqual(baddie_decide(b, mem, world({ now: 0.6, on_ground: false })).keys, hop.keys, 'keeps going in the air');
    const turn = baddie_decide(b, mem, world({ now: 1.6, landing: d => d === 'left' }));
    assert.equal(turn.keys.left, true);
});

test('a flutterer patrols and flies in waves', () => {
    const b = baddie_behavior({ behavior: { type: 'flutter', height: 10, period: 2 } });
    const mem = {};
    baddie_decide(b, mem, world());
    const quarter = baddie_decide(b, mem, world({ now: 0.5 }));
    assert.equal(quarter.patrol, true);
    assert.ok(Math.abs(quarter.dy - 10) < 1e-9);
});

test('a stomper drops when the player passes below and rises again', () => {
    const b = baddie_behavior({ behavior: { type: 'stomper', wait: 1, rise: 60 } });
    const mem = {};
    assert.equal(baddie_decide(b, mem, world({ player: { dx: 100, dy: -50 } })).dy, 0, 'too far away');
    baddie_decide(b, mem, world({ player: { dx: 5, dy: -50 } }));
    baddie_decide(b, mem, world({ now: 0.3 }));                 // end of the shake
    const drop = baddie_decide(b, mem, world({ now: 0.31 }));
    assert.ok(drop.dy < 0 && drop.no_gravity);
    mem.blocked = true;                                          // the engine: hit the ground
    assert.equal(baddie_decide(b, mem, world({ now: 0.4, y: -48 })).dy, 0);
    baddie_decide(b, mem, world({ now: 1.5, y: -48 }));
    assert.equal(baddie_decide(b, mem, world({ now: 1.6, y: -48 })).dy, 1, '60 px/s = 1 px per step');
});

test('the "!" is optional and off by default', () => {
    assert.equal(baddie_behavior({ behavior: { type: 'hunter' } }).alert, false);
    assert.equal(baddie_behavior({ behavior: { type: 'hunter', alert: true } }).alert, true);
    assert.equal(baddie_behavior({ behavior: { type: 'hunter', alert: 'yes' } }).alert, false, 'only real booleans');
    assert.equal('alert' in baddie_behavior({ behavior: { type: 'stomper' } }), false);
});

test('hunters do not hop up ladders', () => {
    const b = baddie_behavior({ behavior: { type: 'hunter' } });
    const out = baddie_decide(b, {}, world({ on_ladder: true, player: { dx: -30, dy: 0 }, facing: 'left', wall: () => true }));
    assert.equal(out.keys.jump, false);
});

const { promote_baddie_behavior, set_baddie_behavior_type, behavior_uses } = require('../src/static/baddie_ai.js');

test('old enemies are promoted to the type they already have', () => {
    const walker = { patrols: true, start_dir: 'left' };
    assert.equal(promote_baddie_behavior(walker), true);
    assert.deepEqual(walker.behavior, { type: 'guard' });
    assert.equal(walker.patrols, true, 'classic fields stay');
    const turret = { patrols: false };
    promote_baddie_behavior(turret);
    assert.equal(turret.behavior.type, 'still');
    const flyer = { patrols: true, affected_by_gravity: false };
    promote_baddie_behavior(flyer);
    assert.equal(flyer.behavior.type, 'guard', 'a flying patrol stays the classic flying patrol');
    // idempotent: loading, saving and loading again changes nothing
    const again = JSON.parse(JSON.stringify(turret));
    assert.equal(promote_baddie_behavior(again), false);
    assert.deepEqual(again, turret);
    const hunter = { behavior: { type: 'hunter', sight: 100 } };
    assert.equal(promote_baddie_behavior(hunter), false);
    assert.equal(hunter.behavior.sight, 100);
});

test('switching the type keeps the classic patrol consistent', () => {
    const t = { patrols: true, behavior: { type: 'guard' } };
    set_baddie_behavior_type(t, 'still');
    assert.equal(t.patrols, false);
    set_baddie_behavior_type(t, 'guard');
    assert.equal(t.patrols, true);
    assert.equal(behavior_uses({ behavior: { type: 'stomper' } }, 'speed'), false);
    assert.equal(behavior_uses({ behavior: { type: 'hopper' } }, 'jump'), true);
    assert.equal(behavior_uses({ patrols: false }, 'patrol'), false, 'an old turret hides the patrol settings');
});

test('stomper: warning time, fall speed, landed pose and "fällt nur einmal"', () => {
    const b = baddie_behavior({ behavior: { type: 'stomper', warn: 0.5, fall: 300, once: true } });
    const mem = {};
    baddie_decide(b, mem, world({ player: { dx: 0, dy: -40 } }));
    assert.equal(baddie_decide(b, mem, world({ now: 0.4 })).dy, 0, 'still warning');
    let out;
    for (let i = 0; i < 20; i++) out = baddie_decide(b, mem, world({ now: 0.5 + i / 60 }));
    assert.ok(out.dy >= -5 - 1e-9, 'never faster than 300 px/s = 5 px per step');
    mem.blocked = true;
    assert.equal(baddie_decide(b, mem, world({ now: 1 })).pose, 'landed');
    assert.equal(baddie_decide(b, mem, world({ now: 30 })).pose, 'landed', 'stays down');
    assert.equal(mem.mode, 'done');
});

test('hunter and lurker poses', () => {
    const h = baddie_behavior({ behavior: { type: 'hunter' } });
    assert.equal(baddie_decide(h, {}, world({ player: { dx: 60, dy: 0 } })).pose, 'hunt');
    const l = baddie_behavior({ behavior: { type: 'lurker' } });
    const mem = {};
    baddie_decide(l, mem, world({ player: { dx: -100, dy: 0 } }));
    assert.equal(baddie_decide(l, mem, world({ now: 0.4 })).pose, 'hunt');
    assert.equal(baddie_decide(l, mem, world({ now: 0.8, wall: () => true })).pose, 'stunned');
    assert.equal(baddie_decide(l, mem, world({ now: 1.0 })).pose, 'stunned', 'still dazed');
});

test('"Intelligenz": all abilities are off in old games', () => {
    const none = { slopes: false, obstacles: false, gaps: false, drop: false, ladders: false };
    assert.deepEqual(baddie_moves(undefined), none);
    assert.deepEqual(baddie_moves({}), none);
    assert.deepEqual(baddie_behavior({ behavior: { type: 'hunter' }, jumps_gaps: true }).moves, none, 'only the Intelligenz trait counts');
    const b = baddie_behavior({ behavior: { type: 'hunter' } }, { jumps_gaps: true, climbs_ladders: true });
    assert.equal(b.moves.gaps, true);
    assert.equal(b.moves.ladders, true);
    assert.equal(b.moves.drop, false);
});

test('a hunter jumps a gap, climbs ladders – only when it may', () => {
    const plain = baddie_behavior({ behavior: { type: 'hunter' } });
    const smart = baddie_behavior({ behavior: { type: 'hunter' } }, { jumps_gaps: true, climbs_ladders: true });
    const at_ledge = { player: { dx: 80, dy: 0 }, ground: () => false, landing: () => true };
    assert.equal(baddie_decide(plain, { mode: 'chase', last_seen: 0 }, world(at_ledge)).keys.right, false, 'waits at the ledge');
    const hop = baddie_decide(smart, { mode: 'chase', last_seen: 0 }, world(at_ledge));
    assert.equal(hop.keys.right && hop.keys.jump, true, 'jumps across');
    const above = { player: { dx: 30, dy: 60 }, ladder_up: true };
    assert.equal(baddie_decide(plain, { mode: 'chase', last_seen: 0 }, world(above)).keys.up, undefined);
    assert.equal(baddie_decide(smart, { mode: 'chase', last_seen: 0 }, world(above)).keys.up, true, 'climbs up');
    const below = { player: { dx: 30, dy: -60 }, ladder_down: true };
    assert.equal(baddie_decide(smart, { mode: 'chase', last_seen: 0 }, world(below)).keys.down, true, 'climbs down');
});

test('a cornered coward escapes only with the right ability', () => {
    const cornered = { player: { dx: 40, dy: 0 }, wall: d => d === 'left', clearable: () => true };
    const plain = baddie_behavior({ behavior: { type: 'coward' } });
    const jumper = baddie_behavior({ behavior: { type: 'coward' } }, { jumps_obstacles: true });
    assert.equal(baddie_decide(plain, {}, world(cornered)).keys.jump, false);
    assert.equal(baddie_decide(jumper, {}, world(cornered)).keys.jump, true);
    const ledge = { player: { dx: 40, dy: 0 }, ground: d => d !== 'left', landing: () => false, safe_drop: () => true };
    const dropper = baddie_behavior({ behavior: { type: 'coward' } }, { drops_down: true });
    assert.equal(baddie_decide(plain, {}, world(ledge)).keys.left, false, 'trembles at the ledge');
    assert.equal(baddie_decide(dropper, {}, world(ledge)).keys.left, true, 'drops down');
});

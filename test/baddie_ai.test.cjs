const test = require('node:test');
const assert = require('node:assert/strict');
const { baddie_behavior, baddie_behavior_type, behavior_uses_patrol, baddie_decide } = require('../src/static/baddie_ai.js');

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

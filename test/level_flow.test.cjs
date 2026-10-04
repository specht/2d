const test = require('node:test');
const assert = require('node:assert/strict');
const flow = require('../src/static/level_flow.js');

const level = (id, props = {}) => ({ id, properties: { name: '', use_level: true, ...props } });

test('without targets the levels stay a sequence, exactly as before', () => {
    const levels = [level('l0'), level('l1', { use_level: false }), level('l2'), level('l3')];
    assert.deepEqual(flow.resolve_level_exit(levels, 0, {}), { index: 2 });          // unused level skipped
    assert.deepEqual(flow.resolve_level_exit(levels, 0, { delta: 3 }), { index: 3 });
    assert.deepEqual(flow.resolve_level_exit(levels, 3, {}), { end: true });           // after the last: THE END
    assert.deepEqual(flow.resolve_level_exit(levels, 0, { delta: -1 }), { end: true }); // below 0: THE END, as before
    assert.deepEqual(flow.resolve_level_exit(levels, 2, { delta: -2 }), { index: 0 });
    // an empty or odd target is no target
    assert.deepEqual(flow.resolve_level_exit(levels, 0, { target: '' }), { index: 2 });
    assert.deepEqual(flow.resolve_level_exit(levels, 0, { target: 7 }), { index: 2 });
    assert.equal(flow.first_level_index(levels), 0);
});

test('an exit can lead to a chosen level, back, or to the end', () => {
    const levels = [level('l0'), level('hub'), level('shop', { side_level: true }), level('l3')];
    assert.deepEqual(flow.resolve_level_exit(levels, 1, { target: 'shop' }), { index: 2 });
    assert.deepEqual(flow.resolve_level_exit(levels, 1, { target: '@end' }), { end: true });
    // the target wins over Delta
    assert.deepEqual(flow.resolve_level_exit(levels, 0, { target: 'l3', delta: 2 }), { index: 3 });
    // a target level that is gone: like no target
    assert.deepEqual(flow.resolve_level_exit(levels, 0, { target: 'gone' }), { index: 1 });
    // back: where the figure came from
    assert.deepEqual(flow.resolve_level_exit(levels, 3, { target: '@back' }, ['l0', 'hub']), { index: 1, back: true });
    // nothing to go back to (a test run started here): on in the order
    assert.deepEqual(flow.resolve_level_exit(levels, 1, { target: '@back' }, []), { index: 3 });
});

test('Nebenlevel are skipped by the order and lead back by themselves', () => {
    const levels = [level('l0'), level('bonus', { side_level: true }), level('l2')];
    assert.deepEqual(flow.resolve_level_exit(levels, 0, {}), { index: 2 });
    assert.deepEqual(flow.resolve_level_exit(levels, 1, {}, ['l0']), { index: 0, back: true });
    // Delta means nothing there
    assert.deepEqual(flow.resolve_level_exit(levels, 1, { delta: 5 }, ['l0']), { index: 0, back: true });
    // a chosen target still counts
    assert.deepEqual(flow.resolve_level_exit(levels, 1, { target: 'l2' }, ['l0']), { index: 2 });
    // a game never starts in one, nor in an unused level
    assert.equal(flow.first_level_index([level('s', { side_level: true }), level('u', { use_level: false }), level('real')]), 2);
    assert.equal(flow.first_level_index([level('s', { side_level: true })]), 0);
    assert.equal(flow.first_level_index([]), 0);
});

test('the trail remembers where to go back to and stays short', () => {
    let trail = [];
    trail = flow.next_level_trail(trail, 'hub', { index: 2 }, 'shop');           // hub → shop
    assert.deepEqual(trail, ['hub']);
    trail = flow.next_level_trail(trail, 'shop', { index: 1, back: true }, 'hub'); // back
    assert.deepEqual(trail, []);
    trail = flow.next_level_trail(['town'], 'house', { index: 0 }, 'cellar');      // town → house → cellar
    assert.deepEqual(trail, ['town', 'house']);
    // the cellar's door leads to the house by name: the trail is cut there, so "zurück" in the house leads to town
    trail = flow.next_level_trail(trail, 'cellar', { index: 1 }, 'house');
    assert.deepEqual(trail, ['town']);
    let long = [];
    for (let i = 0; i < 100; i++) long = flow.next_level_trail(long, `l${i}`, { index: i + 1 }, `l${i + 1}`);
    assert.equal(long.length, flow.LEVEL_TRAIL_MAX);
    assert.equal(long[long.length - 1], 'l99');
});

test('the figure arrives at the exit that leads back', () => {
    const levels = [level('a'), level('b'), level('shop', { side_level: true })];
    // b has an exit on to the next level, one back to a, and one to the shop
    const exits = [{}, { target: 'shop' }, { target: 'a' }, { target: '@back' }];
    assert.equal(flow.arrival_exit_index(levels, 1, exits, 'a'), 2);        // exactly there wins
    assert.equal(flow.arrival_exit_index(levels, 1, exits, 'shop'), 1);
    assert.equal(flow.arrival_exit_index(levels, 1, [{}, { target: '@back' }], 'a'), 1);
    // old exits without a target never move the start
    assert.equal(flow.arrival_exit_index(levels, 1, [{}, { delta: -1 }], 'a'), -1);
    assert.equal(flow.arrival_exit_index(levels, 1, exits, null), -1);
    // in a Nebenlevel an exit without a target leads back, so the figure arrives there
    assert.equal(flow.arrival_exit_index(levels, 2, [{}], 'b'), 0);
});

test('the editor describes and offers targets', () => {
    const levels = [level('a', { name: 'Wiese' }), level('b'), level('c', { use_level: false, name: 'Alt' }), level('s', { side_level: true })];
    assert.equal(flow.describe_level_target(levels, 0, undefined), 'zum nächsten Level');
    assert.equal(flow.describe_level_target(levels, 1, 'a'), 'zu »Wiese«');
    assert.equal(flow.describe_level_target(levels, 0, 'b'), 'zu »Level 2«');
    assert.equal(flow.describe_level_target(levels, 0, '@back'), 'zurück, woher man kam');
    assert.equal(flow.describe_level_target(levels, 0, '@end'), 'zum Spielende');
    assert.equal(flow.describe_level_target(levels, 0, 'x'), 'zu einem Level, das es nicht mehr gibt');
    assert.equal(flow.describe_level_target(levels, 3, undefined), 'zurück, woher man kam');
    const options = flow.level_target_options(levels, 0);
    assert.deepEqual(options.map(o => o[0]), ['', '@back', 'b', 'c', 's', '@end']);
    assert.equal(options[3][1], 'Alt – nicht verwendet');
    // in a Nebenlevel "nothing chosen" already means back
    assert.deepEqual(flow.level_target_options(levels, 3).map(o => o[0]), ['', 'a', 'b', 'c', '@end']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(globalThis, require('../src/static/level_flow.js'));
const { level_map, level_map_exits } = require('../src/static/level_map.js');

const traits = { exit: { level_complete: {} }, ground: { block_above: {} } };
const traits_of = ref => traits[ref] ?? null;
const layer = (sprites, props = { collision_detection: true, parallax: 0 }) => ({ type: 'sprites', properties: props, sprites });
const level = (id, sprites, props = {}) => ({ id, properties: { use_level: true, name: '', ...props }, layers: [layer(sprites)] });
const exit = (target, more = {}) => ['exit', 0, 0, target === undefined && !Object.keys(more).length ? undefined : { level_complete: { ...(target !== undefined ? { target } : {}), ...more } }]
    .filter(x => x !== undefined);

test('a game that chose nothing is a row that ends', () => {
    const map = level_map([level('a', [exit()]), level('b', [exit()]), level('c', [exit()])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 1, 'next'], [1, 2, 'next'], [2, 'end', 'end']]);
    assert.deepEqual(map.nodes.map(n => [n.column, n.row]), [[0, 0], [1, 0], [2, 0]]);
    assert.equal(map.end_reachable, true);
    assert.equal(map.end.column, 3);
    assert.ok(map.nodes.every(n => n.reachable && !n.warnings.length));
    assert.ok(map.nodes[0].start);
});

test('a hub with a shop, a forest and the way back', () => {
    const levels = [
        level('hub', [exit('shop'), exit('wald', { action_key: true })]),
        level('wald', [exit('hub'), exit('@end')]),
        level('shop', [exit()], { side_level: true }),
    ];
    const map = level_map(levels, traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]).sort(), [[0, 1, 'target'], [0, 2, 'target'], [1, 0, 'target'], [1, 'end', 'end'], [2, 0, 'back']].sort());
    assert.equal(map.edges.find(e => e.to === 1).exits[0].action_key, true);
    assert.deepEqual(map.nodes.map(n => [n.column, n.row]), [[0, 0], [1, 0], [1, 1]]);
    assert.ok(map.nodes[2].side);
    assert.ok(map.nodes.every(n => !n.warnings.length), JSON.stringify(map.nodes.map(n => n.warnings)));
});

test('warnings: no exit, a lonely side level, a lost target, a broken layer, nowhere back', () => {
    const levels = [
        level('a', [exit('gone')]),
        level('b', []),
        level('s', [exit()], { side_level: true }),
        { id: 'c', properties: { use_level: true, name: 'Kaputt' }, layers: [layer([exit()], { collision_detection: false, parallax: 0 })] },
        level('draft', [], { use_level: false }),
    ];
    const map = level_map(levels, traits_of);
    assert.match(map.nodes[0].warnings[0], /nicht mehr gibt/);
    assert.equal(map.edges.find(e => e.from === 0).to, 1);       // falls back to the next level
    assert.match(map.nodes[1].hints[0], /Noch kein Ausgang/);
    assert.deepEqual(map.nodes[1].warnings, []);
    assert.ok(map.nodes[2].warnings.some(w => /Nebenlevel/.test(w)));
    assert.ok(map.nodes[2].warnings.some(w => /„zurück“/.test(w)));
    assert.ok(map.nodes[3].warnings.some(w => /Kollisionen/.test(w)));
    // reached along the order (Kein Ausgang in b yet: the arrow shows where it will lead)
    assert.ok(map.nodes[3].reachable);
    assert.deepEqual(map.nodes[4].warnings, []);                  // a draft says nothing
    assert.equal(map.end_reachable, false);
    assert.ok(!map.nodes[2].reachable && map.nodes[2].row === 1);
});

test('exits: placed settings and "geschafft bei Signal"', () => {
    const lv = level('a', [exit(undefined, { delta: 2 }), ['ground', 0, 0]], { signal_level_complete: 4, signal_level_complete_target: '@end' });
    assert.deepEqual(level_map_exits(lv, traits_of), [
        { layer: 0, index: 0, target: null, delta: 2, action_key: false, working: true },
        { signal: true, target: '@end', delta: 1, action_key: false, working: true },
    ]);
    const map = level_map([lv, level('b', [exit()]), level('c', [exit()])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 2, 'next'], [0, 'end', 'end'], [1, 2, 'next'], [2, 'end', 'end']]);
    assert.match(map.nodes[1].warnings[0], /nie in dieses Level/);
});

test('a new game is a connected row: levels without an exit show where it will lead', () => {
    // one empty level: on to the end, no alarm
    let map = level_map([level('a', [])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 'end', 'order']]);
    assert.equal(map.end_reachable, true);
    assert.deepEqual(map.nodes[0].warnings, []);
    assert.match(map.nodes[0].hints[0], /Noch kein Ausgang/);
    // three levels, the middle one already has an exit; Nebenlevel are no part of the order
    map = level_map([level('a', []), level('s', [], { side_level: true }), level('b', [exit()]), level('c', [])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 2, 'order'], [2, 3, 'next'], [3, 'end', 'order']]);
    assert.equal(map.end_reachable, true);
    assert.deepEqual(map.nodes[1].hints.length, 1);       // the Nebenlevel: a hint, no arrow
});

const test = require('node:test');
const assert = require('node:assert/strict');
const sel = require('../src/static/level_selection.js');

const layer = () => [['a', 0, 0], ['b', 24, 0], ['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 24]];

test('moving: the moved sprites win where they land, the rest stays', () => {
    const { sprites, selection } = sel.move_placed(layer(), [0, 1], 24, 0);
    // a moved onto b's old place, b onto c (c is replaced)
    assert.deepEqual(sprites, [['d', 24, 24], ['a', 24, 0], ['b', 48, 0]]);
    assert.deepEqual(selection, [1, 2]);
    const same = layer();
    assert.equal(sel.move_placed(same, [0], 0, 0).sprites, same);
});

test('copy keeps placed properties, paste puts the lower left corner where wanted', () => {
    const clip = sel.copy_placed(layer(), [2, 3]);
    assert.deepEqual(clip, { items: [['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 24]], x: 24, y: 0 });
    const { sprites, selection } = sel.paste_placed(layer(), clip, 100, 48);
    assert.deepEqual(sprites.slice(4), [['c', 124, 48, { key: { signal_code: 3 } }], ['d', 100, 72]]);
    assert.deepEqual(selection, [4, 5]);
    // a copy is a copy
    sprites[4][3].key.signal_code = 9;
    assert.equal(clip.items[0][3].key.signal_code, 3);
    assert.equal(sel.copy_placed(layer(), []), null);
    assert.deepEqual(sel.paste_placed(layer(), null, 0, 0).selection, []);
});

test('pasting over sprites replaces them', () => {
    const clip = sel.copy_placed(layer(), [0]);
    const { sprites } = sel.paste_placed(layer(), clip, 24, 0);
    assert.deepEqual(sprites, [['a', 0, 0], ['c', 48, 0, { key: { signal_code: 3 } }], ['d', 24, 24], ['a', 24, 0]]);
});

test('removing and moving to another layer', () => {
    assert.deepEqual(sel.remove_placed(layer(), [1, 3]).sprites, [['a', 0, 0], ['c', 48, 0, { key: { signal_code: 3 } }]]);
    const moved = sel.move_placed_to_layer(layer(), [0, 3], [['x', 0, 0], ['y', 96, 0]]);
    assert.deepEqual(moved.from, [['b', 24, 0], ['c', 48, 0, { key: { signal_code: 3 } }]]);
    assert.deepEqual(moved.to, [['y', 96, 0], ['a', 0, 0], ['d', 24, 24]]);
    assert.deepEqual(moved.selection, [1, 2]);
});

test('filling a rectangle on the grid, corners included', () => {
    const grid = { width: 24, height: 24 };
    const { sprites, selection } = sel.fill_placed([['old', 24, 0]], 's1', 0, 0, 48, 24, grid);
    assert.equal(sprites.length, 6);
    assert.deepEqual(sprites.map(p => p.slice(1)), [[0, 0], [24, 0], [48, 0], [0, 24], [24, 24], [48, 24]]);
    assert.ok(sprites.every(p => p[0] === 's1'));
    assert.deepEqual(selection, [0, 1, 2, 3, 4, 5]);
    // dragged the other way round: the same
    assert.deepEqual(sel.fill_placed([], 's1', 48, 24, 0, 0, grid).sprites.length, 6);
    // far too big: nothing happens
    assert.equal(sel.fill_placed([], 's1', 0, 0, 24 * 1000, 24 * 1000, grid).sprites.length, 0);
});

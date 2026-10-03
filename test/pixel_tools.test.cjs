const test = require('node:test');
const assert = require('node:assert/strict');
const { mirror_points, mirror_axis, replace_color_in, rgba_of } = require('../src/static/pixel_tools.js');

test('mirrored drawing: every point and its mirror image, each once', () => {
    assert.deepEqual(mirror_points([[0, 0], [1, 2]], 8), [[0, 0], [7, 0], [1, 2], [6, 2]]);
    // the middle column of an odd width is its own mirror image
    assert.deepEqual(mirror_points([[2, 1]], 5), [[2, 1]]);
    // a point and its mirror image both drawn already: no duplicates
    assert.deepEqual(mirror_points([[0, 0], [3, 0]], 4), [[0, 0], [3, 0]]);
    assert.equal(mirror_axis(24), 12);
    assert.equal(mirror_axis(13), 6.5);
});

test('replacing a colour changes exactly that colour', () => {
    const red = [255, 0, 0, 255], blue = [0, 0, 255, 255], half = [255, 0, 0, 128];
    const data = [...red, ...half, ...red, ...blue];
    assert.equal(replace_color_in(data, red, [0, 255, 0, 255]), 2);
    assert.deepEqual(data, [0, 255, 0, 255, ...half, 0, 255, 0, 255, ...blue]);
    // all fully transparent pixels count as one colour, whatever their RGB
    const clear = [0, 0, 0, 0, 9, 9, 9, 0, ...red];
    assert.equal(replace_color_in(clear, [0, 0, 0, 0], blue), 2);
    assert.deepEqual(clear, [...blue, ...blue, ...red]);
    assert.deepEqual(rgba_of(0xff8000ff | 0), [255, 128, 0, 255]);
    assert.deepEqual(rgba_of(0x00000000), [0, 0, 0, 0]);
});

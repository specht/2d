const test = require('node:test');
const assert = require('node:assert/strict');
const { mirror_points, mirror_axis, replace_color_in, outline_pixels, rgba_of } = require('../src/static/pixel_tools.js');

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

test('an outline goes around everything drawn, left, right, above and below', () => {
    // 3 × 3, one pixel in the middle
    const data = new Array(3 * 3 * 4).fill(0);
    data[(1 * 3 + 1) * 4 + 3] = 255;
    assert.equal(outline_pixels(data, 3, 3, [1, 2, 3, 255]), 4);
    const alpha = (x, y) => data[(y * 3 + x) * 4 + 3];
    assert.deepEqual([alpha(1, 0), alpha(0, 1), alpha(2, 1), alpha(1, 2)], [255, 255, 255, 255]);
    assert.deepEqual([alpha(0, 0), alpha(2, 2)], [0, 0]);   // no corners
    assert.deepEqual(data.slice((0 * 3 + 1) * 4, (0 * 3 + 1) * 4 + 4), [1, 2, 3, 255]);
    // drawn pixels stay as they are; nothing to outline, nothing changes
    assert.equal(outline_pixels(new Array(16).fill(0), 2, 2, [1, 2, 3, 255]), 0);
});

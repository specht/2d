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

test('selections: copy, clear, paste, move and flip work on the selected pixels only', () => {
    const px = require('../src/static/pixel_tools.js');
    const w = 4, h = 3;
    // pixels: red at (1,1) and (2,1), blue at (0,0)
    const pixels = new Uint8ClampedArray(w * h * 4);
    const set = (x, y, rgba) => pixels.set(rgba, (y * w + x) * 4);
    set(1, 1, [255, 0, 0, 255]); set(2, 1, [255, 0, 0, 255]); set(0, 0, [0, 0, 255, 255]);
    const mask = new Uint8ClampedArray(w * h * 4);
    mask[(1 * w + 1) * 4 + 3] = 1; mask[(1 * w + 2) * 4 + 3] = 1; mask[(2 * w + 2) * 4 + 3] = 1;
    assert.deepEqual(px.selection_box(mask, w, h), { x: 1, y: 1, width: 2, height: 2 });
    assert.equal(px.selection_box(new Uint8ClampedArray(w * h * 4), w, h), null);
    const clip = px.copy_selected(pixels, mask, w, h);
    assert.deepEqual([...clip.selected], [1, 1, 0, 1]);
    assert.deepEqual([...clip.data.slice(0, 4)], [255, 0, 0, 255]);
    const cleared = px.clear_selected(pixels, mask);
    assert.equal(cleared[(1 * w + 1) * 4 + 3], 0);
    assert.equal(cleared[3], 255, 'what is not selected stays');
    // moved one to the left: the red pair now at (0,1) and (1,1), the blue stays
    const moved = px.move_selected(pixels, mask, w, h, -1, 0);
    assert.equal(moved.pixels[(1 * w + 0) * 4], 255);
    assert.equal(moved.pixels[(1 * w + 2) * 4 + 3], 0);
    assert.equal(moved.mask[(2 * w + 1) * 4 + 3], 1, 'the selection moves along');
    assert.equal(moved.pixels[3], 255);
    // pasted transparent pixels do not erase what is there
    const pasted = px.paste_selected(pixels, w, h, clip, 0, 0);
    assert.equal(pasted.pixels[2], 0, 'blue under red got covered');
    assert.equal(pasted.pixels[0], 255);
    // flipped left ↔ right inside its box: the selected but empty corner moves to the left
    const flipped = px.flip_selected(pixels, mask, w, h, 'x');
    assert.equal(flipped.mask[(2 * w + 1) * 4 + 3], 1);
    assert.equal(flipped.mask[(2 * w + 2) * 4 + 3], 0);
    assert.equal(flipped.pixels[(1 * w + 1) * 4], 255);
});

test('shades like in pixel art: darker cooler, lighter warmer, the colour itself in the middle', () => {
    const px = require('../src/static/pixel_tools.js');
    const ramp = px.shade_ramp({ h: 20, s: 0.7, l: 0.5 }, 5);
    assert.equal(ramp.length, 11);
    assert.deepEqual(ramp[5], { h: 20, s: 0.7, l: 0.5 });
    assert.ok(ramp[0].l < ramp[4].l && ramp[4].l < 0.5 && ramp[10].l > ramp[6].l);
    // orange: the dark end moves towards blue (down through red, 20 → 352), the light end towards yellow
    assert.ok(ramp[0].h > 300 || ramp[0].h < 20);
    assert.ok(ramp[10].h > 20 && ramp[10].h <= 60);
    assert.equal(px.hue_toward(350, 10, 5), 355);
    assert.equal(px.hue_toward(100, 60, 100), 60);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { mirror_points, mirror_axis, replace_color_in, outline_pixels, rgba_of } = require('../src/static/pixel_tools.js');
const px = require('../src/static/pixel_tools.js');

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

test('hue_toward moves the short way round, at most so far', () => {
    assert.equal(px.hue_toward(350, 10, 5), 355);
    assert.equal(px.hue_toward(100, 60, 100), 60);
});

test('OKLCH: a colour comes back exactly, and nothing leaves the screen', () => {
    for (const c of [[255, 230, 23], [13, 96, 174], [234, 40, 48], [0, 0, 0], [255, 255, 255], [71, 77, 77]]) {
        const o = px.srgb_to_oklch(c);
        assert.deepEqual(px.oklch_to_srgb(o.L, o.C, o.h), c);
    }
    // more chroma than the screen can show: lightness and hue stay, chroma shrinks
    const rgb = px.oklch_to_srgb(0.9, 0.4, 150);
    assert.ok(rgb.every(v => v >= 0 && v <= 255));
    assert.ok(Math.abs(px.srgb_to_oklch(rgb).L - 0.9) < 0.01);
    assert.ok(px.oklch_max_chroma(0.5, 30) > px.oklch_max_chroma(0.97, 30));
    const s = px.steps_around(0.92, 0.15, 0.97);
    assert.equal(s.values.length, 11);
    assert.equal(s.values[s.base_index], 0.92);
    assert.equal(s.base_index, 9);      // a light colour: more room to get darker
});

test('colour variations: the colour is in every row, rows differ and keep what they promise', () => {
    const dist = (a, b) => { const p = px.srgb_to_oklch(a), q = px.srgb_to_oklch(b);
        const ap = p.C * Math.cos(p.h * Math.PI / 180), bp = p.C * Math.sin(p.h * Math.PI / 180);
        const aq = q.C * Math.cos(q.h * Math.PI / 180), bq = q.C * Math.sin(q.h * Math.PI / 180);
        return Math.hypot(p.L - q.L, ap - aq, bp - bq); };
    for (const c of [[255, 230, 23], [13, 96, 174], [234, 40, 48], [233, 212, 167], [74, 160, 63], [71, 77, 77]]) {
        const v = px.color_variations(c);
        assert.deepEqual(v.similar[v.similar_index], c);
        assert.deepEqual(v.light_shadow[v.light_shadow_index], c);
        assert.deepEqual(v.grid[v.grid_index[0]][v.grid_index[1]], c);
        assert.equal(v.grid.length, 3);
        for (const row of [v.similar, v.light_shadow, ...v.grid]) assert.equal(row.length, 11);
        const L = px.srgb_to_oklch(c).L;
        // similar hues: as light as the colour (within rounding and the screen's limits)
        for (const s of v.similar) assert.ok(Math.abs(px.srgb_to_oklch(s).L - L) < 0.03, `${c} → ${s}`);
        // light and shadow: from dark to light, every swatch visibly different from its neighbour
        for (let i = 1; i < 11; i++) {
            assert.ok(px.srgb_to_oklch(v.light_shadow[i]).L > px.srgb_to_oklch(v.light_shadow[i - 1]).L - 0.005);
            assert.ok(dist(v.light_shadow[i], v.light_shadow[i - 1]) >= 0.02, `${c}: Licht und Schatten ${i}`);
        }
        // the grid: top row at least as colourful as the bottom one
        for (let i = 0; i < 11; i++) assert.ok(px.srgb_to_oklch(v.grid[0][i]).C >= px.srgb_to_oklch(v.grid[2][i]).C - 0.005);
    }
    // a light yellow has most of its room below: its place is near the right end
    assert.ok(px.color_variations([255, 230, 23]).light_shadow_index >= 8);
});

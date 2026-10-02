const test = require('node:test');
const assert = require('node:assert/strict');
const ii = require('../src/static/image_import.js');

// A small animation: 3 frames of 12×10, a figure that moves its "arm".
function art_strip() {
    const fw = 12, fh = 10, img = ii.rgba_image(fw * 3, fh);
    const set = (x, y, c) => { const i = (y * img.width + x) * 4; img.data.set([...c, 255], i); };
    for (let f = 0; f < 3; f++) {
        for (let y = 2; y < 10; y++) for (let x = 3; x < 9; x++) set(f * fw + x, y, [239, 125, 87]);   // body
        for (let x = 4; x < 8; x++) set(f * fw + x, 1, [56, 183, 100]);                                // leaf
        set(f * fw + 4, 4, [26, 28, 44]); set(f * fw + 7, 4, [26, 28, 44]);                            // eyes
        set(f * fw + 2, 5 + f, [26, 28, 44]);                                                          // arm moves
    }
    return img;
}

// …as found on the web: every pixel s×s, on a grey-white checkerboard, a
// margin around it, with a little JPEG-like noise.
function web_picture(art, s, margin = 9) {
    const W = art.width * s + 2 * margin, H = art.height * s + 2 * margin;
    const img = ii.rgba_image(W, H);
    let seed = 7;
    const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed % 13) - 6; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let c = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) ? [204, 204, 204] : [255, 255, 255];
        const ax = Math.floor((x - margin) / s), ay = Math.floor((y - margin) / s);
        if (x >= margin && y >= margin && ax < art.width && ay < art.height) {
            const j = (ay * art.width + ax) * 4;
            if (art.data[j + 3]) c = [art.data[j], art.data[j + 1], art.data[j + 2]];
        }
        img.data.set([...c.map(v => Math.max(0, Math.min(255, v + noise()))), 255], (y * W + x) * 4);
    }
    return img;
}

test('a strip found on the web: checkerboard removed, pixel size and frames found', () => {
    const art = art_strip();
    const img = web_picture(art, 7);
    const analysis = ii.analyze_pasted_image(img, 12, 10);
    assert.equal(analysis.background.colors.length, 2);
    assert.equal(analysis.settings.scale, 7);
    const { frames, layout } = ii.process_pasted_image(img, analysis.settings, analysis.background, 12, 10);
    assert.equal(frames.length, 3);
    assert.deepEqual([layout.width, layout.height], [12, 10]);
    const originals = ii.split_frames(art, { cols: 3, rows: 1, x0: 0, y0: 0, width: 12, height: 10 });
    frames.forEach((f, i) => {
        for (let p = 0; p < f.data.length; p += 4) {
            const a = f.data, b = originals[i].data;
            if (b[p + 3] === 0) { assert.equal(a[p + 3], 0, `frame ${i}: pixel ${p / 4} should be transparent`); continue; }
            assert.ok(Math.abs(a[p] - b[p]) + Math.abs(a[p + 1] - b[p + 1]) + Math.abs(a[p + 2] - b[p + 2]) <= 24, `frame ${i}: pixel ${p / 4}`);
        }
    });
});

test('a picture that is not enlarged pixel art keeps its size', () => {
    const w = 120, h = 80, img = ii.rgba_image(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        img.data.set([(x * 2) & 255, (y * 3) & 255, (x * y) & 255, 255], (y * w + x) * 4);
    assert.equal(ii.detect_pixel_scale(img).scale, 1);
});

test('a white eye inside the figure stays when the white background goes', () => {
    const img = ii.rgba_image(10, 10);
    for (let i = 0; i < 100; i++) img.data.set([255, 255, 255, 255], i * 4);
    for (let y = 3; y < 8; y++) for (let x = 3; x < 8; x++) img.data.set([0, 0, 0, 255], (y * 10 + x) * 4);
    img.data.set([255, 255, 255, 255], (5 * 10 + 5) * 4);   // the eye
    const bg = ii.detect_background(img);
    const out = ii.remove_background(img, bg.colors).image;
    assert.equal(out.data[(5 * 10 + 5) * 4 + 3], 255);
    assert.equal(out.data[3], 0);
});

test('a frame in another size stands bottom-centred; what does not fit is cut off', () => {
    const f = ii.rgba_image(2, 2, new Uint8ClampedArray([1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255]));
    const big = ii.place_frame(f, 4, 3);
    assert.deepEqual([...big.data.slice((1 * 4 + 1) * 4, (1 * 4 + 1) * 4 + 4)], [1, 1, 1, 255]);
    assert.deepEqual([...big.data.slice((2 * 4 + 2) * 4, (2 * 4 + 2) * 4 + 4)], [4, 4, 4, 255]);
    const small = ii.place_frame(f, 1, 1);
    assert.deepEqual([...small.data], [4, 4, 4, 255]);   // like Größe ändern: Math.floor((new - old) / 2)
});

test('several pictures: sorted by the number in their names', () => {
    const names = ['monster_10.png', 'monster_2.png', 'titel.png', 'monster_1.png', 'Monster 3.PNG', 'lauf-frame-4-final.png'];
    assert.deepEqual(ii.sort_by_frame_number(names.map(name => ({ name }))).map(x => x.name),
        ['monster_1.png', 'monster_2.png', 'Monster 3.PNG', 'lauf-frame-4-final.png', 'monster_10.png', 'titel.png']);
});

test('several pictures become the frames of one animation, aligned like the pictures', () => {
    const art = art_strip();
    const frames = ii.split_frames(art, { cols: 3, rows: 1, x0: 0, y0: 0, width: 12, height: 10 });
    const pictures = frames.map(f => web_picture(f, 6));
    const analysis = ii.analyze_image_series(pictures);
    assert.equal(analysis.settings.scale, 6);
    const result = ii.process_image_series(pictures, analysis.settings, analysis.backgrounds, 12, 10);
    assert.equal(result.frames.length, 3);
    assert.deepEqual([result.layout.width, result.layout.height], [12, 10]);
    result.frames.forEach((f, i) => {
        for (let p = 0; p < f.data.length; p += 4) {
            const b = frames[i].data;
            if (b[p + 3] === 0) assert.equal(f.data[p + 3], 0, `frame ${i}: pixel ${p / 4}`);
            else assert.ok(Math.abs(f.data[p] - b[p]) + Math.abs(f.data[p + 1] - b[p + 1]) + Math.abs(f.data[p + 2] - b[p + 2]) <= 24, `frame ${i}: pixel ${p / 4}`);
        }
    });
});

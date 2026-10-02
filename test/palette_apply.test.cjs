const test = require('node:test');
const assert = require('node:assert/strict');
const { nearest_palette_hex, palettize_level_colors, palettize_pixels_nearest } = require('../src/static/palette_apply.js');

const palette = [[0, 0, 0], [255, 255, 255], [200, 30, 30], [20, 40, 160]];

test('the nearest palette colour; the alpha of a colour stays', () => {
    assert.equal(nearest_palette_hex('#e01010', palette), '#c81e1e');
    assert.equal(nearest_palette_hex('#10203080', palette), '#00000080');
    assert.equal(nearest_palette_hex('nonsense', palette), 'nonsense');
});

test('a level: background colour, gradient points and effect colours', () => {
    const level = {
        properties: { background_color: '#fafafa' },
        layers: [
            { type: 'backdrop', backdrop_type: 'color', colors: [['#3050c0', 0.5, 1], ['#f0f0f0', 0.5, 0]] },
            { type: 'backdrop', backdrop_type: 'effect', effect: 'snow', color: '#eeeeeeff' },
            { type: 'sprites', sprites: [] },
        ],
    };
    assert.equal(palettize_level_colors(level, palette), 4);
    assert.equal(level.properties.background_color, '#ffffff');
    assert.deepEqual(level.layers[0].colors.map(c => c[0]), ['#1428a0', '#ffffff']);
    assert.equal(level.layers[1].color, '#ffffffff');
});

test('pixels without a pattern: each to its nearest colour, transparent stays', () => {
    const data = new Uint8ClampedArray([250, 250, 250, 255, 190, 40, 40, 200, 1, 2, 3, 0]);
    palettize_pixels_nearest(data, palette);
    assert.deepEqual([...data], [255, 255, 255, 255, 200, 30, 30, 200, 1, 2, 3, 0]);
});

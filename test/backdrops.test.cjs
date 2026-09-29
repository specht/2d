const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    BACKDROP_EFFECTS, BLEND_MODES, BACKDROP_DENSITY_EFFECTS, blend_mode_of, premultiplied_shader, backdrop_density,
    backdrop_dither_mode, backdrop_dither_levels, backdrop_pixel_size, backdrop_fragment_shader,
} = require('../src/static/backdrops.js');

const shader_dir = path.join(__dirname, '../src/static/shaders');

test('old backdrops keep the smooth look', () => {
    const old = { backdrop_type: 'color', colors: [['#000000', 0.5, 1], ['#ffffff', 0.5, 0]] };
    assert.equal(backdrop_pixel_size(old), 0);
    assert.equal(backdrop_dither_mode(old), 0);
    assert.equal(backdrop_pixel_size({ backdrop_type: 'effect', effect: 'snow' }), 0);
});

test('pixel grid and dithering settings', () => {
    assert.equal(backdrop_pixel_size({ backdrop_type: 'effect', pixelated: true }), 1);
    // dithering always works on the game-pixel grid
    assert.equal(backdrop_pixel_size({ backdrop_type: 'color', dither: 'noise' }), 1);
    assert.equal(backdrop_dither_mode({ dither: 'noise' }), 1);
    assert.equal(backdrop_dither_mode({ dither: 'bayer' }), 2);
    assert.equal(backdrop_dither_mode({ dither: 'sparkle' }), 0);
    assert.equal(backdrop_dither_levels({}), 8);
    assert.equal(backdrop_dither_levels({ dither_levels: 1 }), 2);
    assert.equal(backdrop_dither_levels({ dither_levels: 99 }), 32);
});

test('every effect has a shader, and every shader gets the pixel grid', () => {
    const files = [...Object.keys(BACKDROP_EFFECTS).map(e => `${e}.fs`), 'gradient.fs'];
    for (const file of files) {
        const source = fs.readFileSync(path.join(shader_dir, file), 'utf8');
        const out = backdrop_fragment_shader(source);
        assert.match(out, /uniform float pixel_size;/, file);
        assert.match(out, /#define vuv vuv_grid/, file);
        // the real varying is read once, inside main, before the macro is set again
        assert.match(out, /void\s+main\s*\(\s*(?:void)?\s*\)\s*\{\n#undef vuv\n\s+vuv_grid = pixel_size > 0\.0/, file);
    }
});

test('shaders.js loads every effect shader', () => {
    const shaders_js = fs.readFileSync(path.join(__dirname, '../src/static/shaders.js'), 'utf8');
    for (const effect of Object.keys(BACKDROP_EFFECTS)) {
        assert.ok(shaders_js.includes(`'${effect}.fs'`), `${effect}.fs in the file list`);
        assert.ok(shaders_js.includes(`'${effect}': [[`), `${effect} control points`);
    }
});

test('Mischmodus: absent or normal means ordinary transparency', () => {
    assert.equal(blend_mode_of(undefined), null);
    assert.equal(blend_mode_of('normal'), null);
    assert.equal(blend_mode_of('bogus'), null);
    assert.equal(blend_mode_of('add'), 'add');
    assert.deepEqual(Object.keys(BLEND_MODES), ['normal', 'add', 'screen', 'multiply']);
});

test('Mischmodus: the shader output is premultiplied, after the pixel grid', () => {
    for (const file of ['texture.fs', 'snow.fs', 'dust.fs', 'gradient.fs']) {
        const source = fs.readFileSync(path.join(shader_dir, file), 'utf8');
        const out = premultiplied_shader(file === 'texture.fs' ? source : backdrop_fragment_shader(source));
        assert.equal((out.match(/void\s+main\s*\(/g) ?? []).length, 1, file);
        assert.match(out, /void blend_main\(\)/, file);
        assert.match(out, /blend_main\(\);\n\s+gl_FragColor\.rgb \*= gl_FragColor\.a;\n\}\n$/, file);
        // wrapping twice changes nothing
        assert.equal(premultiplied_shader(out), out, file);
    }
});

test('Menge: absent = 1 (the old amount), clamped otherwise', () => {
    assert.equal(backdrop_density({}), 1);
    assert.equal(backdrop_density({ density: 'x' }), 1);
    assert.equal(backdrop_density({ density: 0 }), 0.1);
    assert.equal(backdrop_density({ density: 9 }), 3);
    assert.equal(backdrop_density({ density: 1.5 }), 1.5);
    for (const effect of BACKDROP_DENSITY_EFFECTS) {
        const source = fs.readFileSync(path.join(shader_dir, `${effect}.fs`), 'utf8');
        assert.match(source, /uniform float density;/, effect);
    }
});

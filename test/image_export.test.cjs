const test = require('node:test');
const assert = require('node:assert/strict');
const ie = require('../src/static/image_export.js');

test('file names: lower case, umlauts spelled out, dashes between parts', () => {
    assert.equal(ie.export_file_name(['Kacheln', 'Zustand 1']), 'kacheln-zustand-1.png');
    assert.equal(ie.export_file_name(['Grüner Bär', 'Läuft', '3']), 'gruener-baer-laeuft-3.png');
    assert.equal(ie.export_file_name(['Straße!!', '  ']), 'strasse.png');
    assert.equal(ie.export_file_name([undefined, null, '']), 'sprite.png');
});

test('a strip: cells side by side, as large as the largest frame', () => {
    const layout = ie.export_layout([[{ width: 16, height: 16 }, { width: 16, height: 16 }, { width: 16, height: 16 }]]);
    assert.equal(layout.width, 48);
    assert.equal(layout.height, 16);
    assert.deepEqual(layout.positions[0].map(p => p.x), [0, 16, 32]);
});

test('a sprite: one row per state, the longest row sets the width, empty frames keep their place', () => {
    const layout = ie.export_layout([
        [{ width: 24, height: 24 }, null],
        [{ width: 24, height: 24 }, { width: 24, height: 24 }, { width: 24, height: 24 }],
    ]);
    assert.equal(layout.width, 72);
    assert.equal(layout.height, 48);
    assert.deepEqual(layout.positions[0][1], { x: 24, y: 0 });
    assert.deepEqual(layout.positions[1][2], { x: 48, y: 24 });
});

test('the frames to save: the frame on the canvas comes from the canvas', () => {
    const data = { sprites: [{ states: [
        { frames: [{ src: 'a' }, { src: 'b' }] },
        { frames: [{ src: 'c' }, { src: '' }] },
    ] }] };
    const at = { sprite_index: 0, state_index: 1, frame_index: 0, current_src: 'C' };
    assert.deepEqual(ie.export_rows(data, at, 'frame'), [['C']]);
    assert.deepEqual(ie.export_rows(data, at, 'state'), [['C', null]]);
    assert.deepEqual(ie.export_rows(data, at, 'sprite'), [['a', 'b'], ['C', null]]);
    assert.deepEqual(ie.export_rows(data, { ...at, sprite_index: 5 }, 'frame'), []);
});

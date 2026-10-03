const test = require('node:test');
const assert = require('node:assert/strict');
const { sprite_preview_scale, sprite_preview_frame, sprite_preview_fps } = require('../src/static/sprite_preview.js');

test('the preview shows the sprite as big as fits, pixel-sharp', () => {
    assert.equal(sprite_preview_scale(24, 24), 5);      // 120 of 128
    assert.equal(sprite_preview_scale(13, 24), 5);
    assert.equal(sprite_preview_scale(64, 32), 2);
    assert.equal(sprite_preview_scale(128, 16), 1);
    assert.equal(sprite_preview_scale(256, 128), 0.5);  // big sprites get smaller
    assert.equal(sprite_preview_scale(0, 10), 1);
});

test('the animation runs at the state\'s Framerate and loops', () => {
    assert.equal(sprite_preview_frame(0, 8, 4), 0);
    assert.equal(sprite_preview_frame(0.13, 8, 4), 1);
    assert.equal(sprite_preview_frame(0.5, 8, 4), 0);   // 4 frames at 8 fps: half a second
    assert.equal(sprite_preview_frame(0.99, 2, 3), 1);
    assert.equal(sprite_preview_frame(5, 8, 1), 0);
    assert.equal(sprite_preview_frame(1, 0, 3), 1);      // no Framerate: 1 fps
    assert.equal(sprite_preview_frame(1, 8, 0), 0);
});

test('− and + change the Framerate within 1 … 60', () => {
    assert.equal(sprite_preview_fps(8, 1), 9);
    assert.equal(sprite_preview_fps(1, -1), 1);
    assert.equal(sprite_preview_fps(60, 1), 60);
    assert.equal(sprite_preview_fps(undefined, 1), 9);
});

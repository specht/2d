const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../src/static/level_rects.js');

const rect = { left: 0, bottom: 0, width: 240, height: 120 };

test('eight handles: corners and the middle of every edge', () => {
    assert.equal(Object.keys(r.RECT_HANDLES).length, 8);
    assert.deepEqual(Object.keys(r.RECT_HANDLE_CURSORS).sort(), Object.keys(r.RECT_HANDLES).sort());
    assert.deepEqual(r.rect_handle_point(rect, r.RECT_HANDLES.bl), [0, 0]);
    assert.deepEqual(r.rect_handle_point(rect, r.RECT_HANDLES.tr), [240, 120]);
    assert.deepEqual(r.rect_handle_point(rect, r.RECT_HANDLES.t), [120, 120]);
    assert.deepEqual(r.rect_handle_point(rect, r.RECT_HANDLES.l), [0, 60]);
    // an inside-out rectangle from an older game: the same handles
    assert.deepEqual(r.rect_handle_point({ left: 240, bottom: 120, width: -240, height: -120 }, r.RECT_HANDLES.bl), [0, 0]);
});

test('a handle moves only its own edges', () => {
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.r, 30, 999), { left: 0, bottom: 0, width: 270, height: 120 });
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.t, 999, -20), { left: 0, bottom: 0, width: 240, height: 100 });
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.l, 24, 0), { left: 24, bottom: 0, width: 216, height: 120 });
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.bl, -24, -48), { left: -24, bottom: -48, width: 264, height: 168 });
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.tr, 10, 10), { left: 0, bottom: 0, width: 250, height: 130 });
});

test('the moved corner snaps, and the rectangle never turns inside out', () => {
    const snap = (x, y) => [Math.round(x / 24) * 24, Math.round(y / 24) * 24];
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.br, 13, -13, snap), { left: 0, bottom: -24, width: 264, height: 144 });
    // dragged past the other edge: it stops min_size before it
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.l, 500, 0, undefined, 24), { left: 216, bottom: 0, width: 24, height: 120 });
    assert.deepEqual(r.resized_rect(rect, r.RECT_HANDLES.t, 0, -500), { left: 0, bottom: 0, width: 240, height: 1 });
});

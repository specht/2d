// When the graphics fail (webgl_recovery.js): wait for the browser, then a new
// renderer, and when that keeps happening a reload that keeps the work.
const test = require('node:test');
const assert = require('node:assert/strict');
const { watch_webgl_canvas, webgl_may_renew, WEBGL_RESTORE_WAIT_MS, WEBGL_MAX_RENEWALS } = require('../src/static/webgl_recovery.js');

function fake_canvas() {
    const listeners = {};
    return {
        addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
        removeEventListener(type, fn) { listeners[type] = (listeners[type] ?? []).filter(f => f !== fn); },
        fire(type) {
            let prevented = false;
            for (const fn of listeners[type] ?? []) fn({ preventDefault: () => { prevented = true; } });
            return prevented;
        },
    };
}

function fake_timers() {
    const timers = new Map();
    let next = 1;
    return {
        set_timer: (fn, ms) => { timers.set(next, { fn, ms }); return next++; },
        clear_timer: (id) => timers.delete(id),
        run_all() { for (const [id, t] of [...timers]) { timers.delete(id); t.fn(); } },
        pending: () => [...timers.values()].map(t => t.ms),
    };
}

test('a context the browser gives back in time: drawn again, nothing renewed', () => {
    const canvas = fake_canvas(), timers = fake_timers();
    const calls = [];
    watch_webgl_canvas(canvas, { on_restored: () => calls.push('restored'), on_given_up: () => calls.push('given up'), ...timers });
    assert.equal(canvas.fire('webglcontextlost'), true, 'the default is prevented, else the browser never gives it back');
    assert.deepEqual(timers.pending(), [WEBGL_RESTORE_WAIT_MS]);
    canvas.fire('webglcontextrestored');
    assert.deepEqual(timers.pending(), []);
    timers.run_all();
    assert.deepEqual(calls, ['restored']);
});

test('a context that does not come back: given up once, after the wait', () => {
    const canvas = fake_canvas(), timers = fake_timers();
    const calls = [];
    const stop = watch_webgl_canvas(canvas, { on_restored: () => calls.push('restored'), on_given_up: () => calls.push('given up'), ...timers });
    canvas.fire('webglcontextlost');
    canvas.fire('webglcontextlost');
    assert.equal(timers.pending().length, 1);
    timers.run_all();
    // a restore that comes too late changes nothing any more
    canvas.fire('webglcontextrestored');
    assert.deepEqual(calls, ['given up']);
    stop();
    canvas.fire('webglcontextlost');
    assert.deepEqual(timers.pending(), []);
});

test('a few new renderers, then a reload (the browser blocks WebGL for the page)', () => {
    const now = 1_000_000;
    const recent = Array.from({ length: WEBGL_MAX_RENEWALS - 1 }, (_, i) => now - 1000 * i);
    assert.equal(webgl_may_renew(recent, now), true);
    assert.equal(webgl_may_renew([...recent, now], now), false);
    // long ago does not count
    assert.equal(webgl_may_renew(Array(10).fill(now - 60 * 60 * 1000), now), true);
});

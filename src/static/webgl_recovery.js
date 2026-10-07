// When the graphics fail (WebGL "context lost": the graphics card was reset,
// the driver gave up, the computer woke from sleep …), the level editor stays
// black and a game stops – and children reloaded the page by hand. Now, for
// the level editor's canvas and the game frame's (Spielen, Level testen):
//   1. the browser usually gives the context back after a moment: three.js
//      builds everything again by itself, and the level editor draws at once
//      (it draws only when something happens);
//   2. no context after WEBGL_RESTORE_WAIT_MS: the level editor gets a new
//      renderer (a new canvas, a new context), the game frame is loaded again
//      and the same game or test run starts afresh;
//   3. that fails too, or it keeps happening (the browser has blocked WebGL
//      for the page): the work is kept (rescue.js) and the studio reloads.
// Every incident is reported ('webgl_context_lost': where and what helped,
// details.recovered when the studio got over it by itself – the moderation
// page shows those apart from the crashes). Editor-only: the engine (app.js)
// and the recipes are untouched.
//
// While a game runs (Spielen, Level testen) the level editor gives its
// context back on purpose (release_level_editor) and gets a new one when the
// Level tab is shown again: two contexts that each hold every sprite sheet
// were too much for school computers with big games (two losses within a
// minute right after T, 80 sprites, October 2026).

const WEBGL_RESTORE_WAIT_MS = 3000;
// this many new renderers within WEBGL_RENEW_WINDOW_MS: reload instead
const WEBGL_MAX_RENEWALS = 3;
const WEBGL_RENEW_WINDOW_MS = 10 * 60 * 1000;

// A renderer that draws nothing: while the level editor's context is given
// back, everything that still calls it (pressing T draws the level once
// more, a session update …) does no harm. three.js only learns of the loss
// a moment later and would compile shaders on the lost context meanwhile.
function renderer_asleep(renderer) {
    return new Proxy(renderer, {
        get(target, key) {
            const value = target[key];
            if (typeof value !== 'function' || key === 'getContext') return typeof value === 'function' ? value.bind(target) : value;
            return () => undefined;
        },
        set(target, key, value) { target[key] = value; return true; },
    });
}

// Calls on_restored when the browser gives the context back in time, else
// on_given_up. Returns a function that stops watching.
function watch_webgl_canvas(canvas, { on_restored, on_given_up, wait_ms = WEBGL_RESTORE_WAIT_MS, set_timer = setTimeout, clear_timer = clearTimeout }) {
    let timer = null;
    const lost = (e) => {
        // three.js prevents the default too: without it the browser never gives it back
        e.preventDefault();
        if (timer !== null) return;
        timer = set_timer(() => { timer = null; on_given_up(); }, wait_ms);
    };
    const restored = () => {
        if (timer === null) return;
        clear_timer(timer);
        timer = null;
        on_restored();
    };
    canvas.addEventListener('webglcontextlost', lost, false);
    canvas.addEventListener('webglcontextrestored', restored, false);
    return () => {
        if (timer !== null) clear_timer(timer);
        canvas.removeEventListener('webglcontextlost', lost, false);
        canvas.removeEventListener('webglcontextrestored', restored, false);
    };
}

// The times of earlier new renderers: is one more still a good idea?
function webgl_may_renew(times, now, max = WEBGL_MAX_RENEWALS, window_ms = WEBGL_RENEW_WINDOW_MS) {
    return times.filter(t => now - t < window_ms).length < max;
}

class WebGLRecovery {
    constructor() {
        this.renewals = [];
        this.reloading = false;
    }

    // one report per place and outcome (the reporter sends each message once a
    // page); recovered: the child had to do nothing (only 'reload' is felt)
    report(where, outcome) {
        try {
            window.crash_reporter?.report?.({ kind: 'webgl_context_lost', message: `WebGL context lost: ${where}, ${outcome}`,
                details: { where, outcome, recovered: outcome !== 'reload' } }, false);
        } catch (e) { }
    }

    notice(text) {
        if (typeof $ !== 'function') return;
        let box = $('#webgl_notice');
        if (!box.length) box = $('<div id="webgl_notice" role="status">').appendTo('body');
        box.text(text).addClass('showing');
        clearTimeout(this.notice_timer);
        this.notice_timer = setTimeout(() => box.removeClass('showing'), 5000);
    }

    // the last way out: keep the work, load the studio again
    reload(where) {
        if (this.reloading) return;
        this.reloading = true;
        this.report(where, 'reload');
        this.notice('Die Grafik ist ausgefallen. Deine Arbeit ist gesichert – das Studio lädt neu.');
        setTimeout(() => {
            if (typeof studio_reload_keeping_work === 'function') studio_reload_keeping_work();
            else window.location.reload();
        }, 1500);
    }

    // ------------------------------------------------ the level editor
    watch_level_editor(editor) {
        this.level_editor = editor;
        this.stop_level_editor?.();
        this.stop_level_editor = watch_webgl_canvas(editor.renderer.domElement, {
            on_restored: () => {
                this.report('level', 'restored');
                editor.render?.();
            },
            on_given_up: () => this.renew_level_editor(editor),
        });
    }

    renew_level_editor(editor) {
        const now = Date.now();
        if (!webgl_may_renew(this.renewals, now)) return this.reload('level');
        this.renewals.push(now);
        if (this.replace_level_editor_renderer(editor)) this.report('level', 'new_renderer');
    }

    // A new renderer in the old one's place; false (and a reload) when the
    // browser gives no context any more.
    replace_level_editor_renderer(editor) {
        let fresh;
        try {
            fresh = new THREE.WebGLRenderer({ antialias: true });
            if (fresh.getContext().isContextLost()) throw new Error('lost at once');
        } catch (e) {
            try { fresh?.dispose(); } catch (_) { }
            this.reload('level');
            return false;
        }
        const old = editor.renderer;
        fresh.setClearColor('#000');
        // the editor listens on its element, not on the canvas: the new one takes its place
        old.domElement.replaceWith(fresh.domElement);
        editor.renderer = fresh;
        try { old.dispose(); } catch (e) { }
        this.watch_level_editor(editor);
        try { editor.render(); } catch (e) { this.reload('level'); return false; }
        return true;
    }

    // While a game runs, the hidden level editor gives its context – and with
    // it every sprite sheet on the graphics card – back; three.js draws
    // nothing on a lost context, so what still calls render() meanwhile
    // does no harm. Planned: not reported, not counted as a renewal.
    release_level_editor() {
        const editor = this.level_editor;
        if (!editor || this.level_editor_released) return;
        this.stop_level_editor?.();
        this.stop_level_editor = null;
        this.level_editor_released = true;
        this.asleep = editor.renderer;
        editor.renderer = renderer_asleep(this.asleep);
        try { this.asleep.forceContextLoss(); } catch (e) { }
    }

    // the Level tab again: a new context, the level drawn as before
    restore_level_editor() {
        const editor = this.level_editor;
        if (!editor || !this.level_editor_released) return;
        this.level_editor_released = false;
        const asleep = this.asleep;
        this.asleep = null;
        this.replace_level_editor_renderer(editor);
        try { asleep?.dispose(); } catch (e) { }
    }

    // studio.js show_pane: Spielen gives the level editor's context back,
    // the Level tab takes a new one
    pane_shown(key) {
        if (key === 'play') this.release_level_editor();
        else if (key === 'level') this.restore_level_editor();
    }

    // ------------------------------------------------ the game frame
    // The frame's game makes its renderer once (app.js Game): watched after
    // every load of the frame, as soon as the game is there.
    watch_play_frame(iframe) {
        const attach = () => {
            let tries = 0;
            const look = () => {
                let game = null;
                try { game = iframe.contentWindow?.game ?? null; } catch (e) { return; }
                const canvas = game?.renderer?.domElement;
                if (!canvas) {
                    if (++tries < 100) setTimeout(look, 100);
                    return;
                }
                this.stop_play_frame?.();
                this.stop_play_frame = watch_webgl_canvas(canvas, {
                    on_restored: () => this.report('play', 'restored'),
                    on_given_up: () => this.renew_play_frame(iframe),
                });
            };
            look();
        };
        iframe.addEventListener('load', attach);
        attach();
    }

    // the frame loads anew; on Spielen the same game (or test run) starts again
    renew_play_frame(iframe) {
        const now = Date.now();
        if (!webgl_may_renew(this.renewals, now)) return this.reload('play');
        this.renewals.push(now);
        this.report('play', 'new_frame');
        const playtest = window.studio_last_playtest ?? null;
        const restart = () => {
            iframe.removeEventListener('load', restart);
            if (typeof current_pane === 'undefined' || current_pane !== 'play') return;
            this.notice('Die Grafik ist kurz ausgefallen – das Spiel startet neu.');
            // the frame's game is made after its shaders have loaded
            let tries = 0;
            const start = () => {
                let ready = false;
                try { ready = !!iframe.contentWindow?.game; } catch (e) { }
                if (!ready) return ++tries < 100 ? setTimeout(start, 100) : null;
                if (current_pane !== 'play') return;
                window.studio_pending_playtest = playtest;
                window.studio_show_pane?.('play');
            };
            start();
        };
        iframe.addEventListener('load', restart);
        try { iframe.contentWindow.location.reload(); } catch (e) { iframe.src = iframe.src; }
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.webgl_recovery = new WebGLRecovery();
    document.addEventListener('DOMContentLoaded', () => {
        const iframe = document.getElementById('play_iframe');
        if (iframe) window.webgl_recovery.watch_play_frame(iframe);
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { watch_webgl_canvas, webgl_may_renew, renderer_asleep, WEBGL_RESTORE_WAIT_MS, WEBGL_MAX_RENEWALS };
}

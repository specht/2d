// Plays the steps of an Erste-Schritte guide in the real studio (studio.mjs)
// and records them: videos (animated WebP) with a visible mouse pointer,
// clicks, the keys pressed and short captions, and pictures with numbered
// marks. The steps say what a child would do – click this button, paint
// these pixels, press T – never how the studio does it inside, so a guide
// keeps working when the layout changes, and a button that is gone fails
// the build instead of producing a wrong picture.
import sharp from 'sharp';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { STEP_MS } from './record.mjs';

const controls = createRequire(import.meta.url)('../../src/static/controls.js');

// One frame of a video lasts this many 60 Hz steps (4: 15 frames per second).
const FRAME_STEPS = 4;
const SELECTOR_TIMEOUT = 6000;
// While a game runs on film, it plays this much slower (studio.mjs gives the
// game frame a clock the recorder can slow down): a screenshot takes longer
// than a frame of the game, and at full speed a jump fell between two
// screenshots. The film shows it at its real speed again (a frame lasts as
// much game time as passed). ANLEITUNG_ZEITLUPE=1 switches it off.
const ZEITLUPE = Number(process.env.ANLEITUNG_ZEITLUPE ?? 0.12);

export class StepError extends Error { }

// Pointer, click ripple and marks are drawn into the page itself
// (pointer-events: none), so they are in every screenshot but never get in
// the studio's way. The caption of the step and the keys pressed are not part
// of the picture: they are a timeline (note_band) that the Hilfe tab shows
// beside the video and over it, crisp at every size.
const OVERLAY = () => {
    if (window.__guide) return;
    const style = document.createElement('style');
    style.textContent = `
        .guide-layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
        .guide-pointer { position: fixed; left: 0; top: 0; width: 26px; height: 30px; pointer-events: none;
            z-index: 2147483647; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); display: none; }
        .guide-ripple { position: fixed; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
            border: 3px solid #ffcd75; box-sizing: border-box; pointer-events: none; z-index: 2147483646; }
        .guide-ripple.right { border-color: #73eff7; }
        .guide-held { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%;
            background: rgba(255, 205, 117, 0.45); pointer-events: none; z-index: 2147483646; display: none; }
        .guide-mark { position: fixed; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
            background: #ffcd75; color: #1a1c2c; font: bold 17px/30px 'IBM Plex Sans', sans-serif; text-align: center;
            box-shadow: 0 0 0 3px #1a1c2c, 0 2px 8px rgba(0,0,0,0.6); pointer-events: none; z-index: 2147483646; }
        .guide-frame { position: fixed; border: 3px solid #ffcd75; border-radius: 8px; pointer-events: none;
            box-shadow: 0 0 0 2px rgba(26,28,44,0.8); z-index: 2147483645; }`;
    document.head.appendChild(style);
    const pointer = document.createElement('div');
    pointer.className = 'guide-pointer';
    // the usual arrow, white with a dark edge, tip at (2, 2)
    pointer.innerHTML = '<svg width="26" height="30" viewBox="0 0 26 30"><path d="M2 2 L2 24 L8 18.5 L12.2 27.5 L16 25.8 L11.8 17 L19.5 17 Z" fill="#fff" stroke="#111" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    const held = document.createElement('div'); held.className = 'guide-held';
    const layer = document.createElement('div'); layer.className = 'guide-layer';
    for (const el of [layer, held, pointer]) document.documentElement.appendChild(el);
    window.__guide = {
        move(x, y, down) {
            pointer.style.display = 'block';
            pointer.style.transform = `translate(${x - 2}px, ${y - 2}px)`;
            held.style.display = down ? 'block' : 'none';
            held.style.left = `${x}px`; held.style.top = `${y}px`;
        },
        hide_pointer() { pointer.style.display = 'none'; held.style.display = 'none'; },
        ripple(x, y, t, right) {
            // t: 0 … 1 of the ripple, drawn by the recorder frame by frame
            let r = document.querySelector('.guide-ripple');
            if (t >= 1) { r?.remove(); return; }
            if (!r) { r = document.createElement('div'); r.className = 'guide-ripple'; document.documentElement.appendChild(r); }
            r.classList.toggle('right', !!right);
            const s = 1 + t * 2.6;
            r.style.left = `${x}px`; r.style.top = `${y}px`;
            r.style.transform = `scale(${s})`; r.style.opacity = String(1 - t * 0.85);
        },
        marks(list) {
            layer.innerHTML = '';
            for (const m of list ?? []) {
                if (m.frame) {
                    const f = document.createElement('div'); f.className = 'guide-frame';
                    Object.assign(f.style, { left: `${m.frame.x - 4}px`, top: `${m.frame.y - 4}px`, width: `${m.frame.w + 2}px`, height: `${m.frame.h + 2}px` });
                    layer.appendChild(f);
                }
                const d = document.createElement('div'); d.className = 'guide-mark';
                d.textContent = m.nr; d.style.left = `${m.x}px`; d.style.top = `${m.y}px`;
                layer.appendChild(d);
            }
        },
    };
};

// German key caps: Control+KeyZ → Strg + Z (controls.js, as the studio shows them)
export function key_caps(combo) {
    return String(combo).split('+').map(part => {
        if (part === 'Control') return 'Strg';
        if (part === 'Shift') return 'Shift';
        if (part === 'Alt') return 'Alt';
        if (part === 'Escape') return 'Esc';
        if (part === 'Enter') return 'Enter';
        if (/^Key[A-Z]$/.test(part)) return part.slice(3);
        if (/^[A-Za-z]$/.test(part)) return part.toUpperCase();
        return controls.key_label(part) || part;
    });
}

const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// A recorded frame keeps its pixels deflated: a guide with several long films
// would otherwise hold gigabytes of raw screenshots until it is encoded.
// `data` inflates them when they are needed (the last two are kept, since the
// film encoder compares neighbours and copies a frame row by row).
const inflated = [];
function packed_frame(w, h, raw) {
    const f = { w, h, z: zlib.deflateSync(raw, { level: 1 }) };
    Object.defineProperty(f, 'data', {
        get() {
            const hit = inflated.find(e => e.frame === f);
            if (hit) return hit.raw;
            const raw = zlib.inflateSync(f.z);
            inflated.unshift({ frame: f, raw });
            inflated.length = Math.min(inflated.length, 2);
            return raw;
        },
    });
    return f;
}

export class GuidePlayer {
    constructor(page, id) {
        this.page = page;
        this.id = id;
        this.x = 1450; this.y = 600;     // the pointer starts beside the middle
        this.down = false;
        this.recording = null;     // { clip, frames } while a video is recorded
        this.step_no = 0;
        // What goes with the picture, as a timeline beside it (anleitungen.mjs
        // writes it to the film, the Hilfe tab shows it): the step's number and
        // caption, the keys held or pressed and what the mouse does
        // (Rechtsklick, ziehen). Never drawn into the picture: the player lists
        // the steps beside the video and shows the keys over it.
        this.band = { nr: null, text: '', mehr: '', keys: [], maus: '' };
    }

    async init() {
        await this.page.evaluate(OVERLAY);
        await this.page.evaluate(([x, y]) => window.__guide.move(x, y, false), [this.x, this.y]);
        // screenshots through the DevTools protocol: PNG made for speed, still lossless
        this.cdp = await this.page.context().newCDPSession(this.page);
    }

    async set_band(change) {
        Object.assign(this.band, change);
    }

    // the band at this moment of the video, once per change
    note_band() {
        const r = this.recording;
        const state = JSON.stringify(this.band);
        if (r.last_band === state) return;
        r.last_band = state;
        const t = Math.round(r.frames.length * STEP_MS);
        // two changes at the same moment: the later one counts
        if (r.timeline.at(-1)?.t === t) r.timeline.pop();
        r.timeline.push({ t, ...JSON.parse(state) });
    }

    fail(message) {
        throw new StepError(`${this.id}, Schritt ${this.step_no}: ${message}`);
    }

    // ── where things are ────────────────────────────────────────────────
    async box(selector, which = 'first') {
        const locator = this.page.locator(selector)[which]();
        try {
            await locator.waitFor({ state: 'visible', timeout: SELECTOR_TIMEOUT });
        } catch {
            this.fail(`„${selector}“ ist nicht zu sehen (umbenannt oder verschoben?)`);
        }
        await locator.scrollIntoViewIfNeeded().catch(() => { });
        const b = await locator.boundingBox();
        if (!b) this.fail(`„${selector}“ hat keine Größe`);
        return b;
    }

    // A target: a selector, { ziel, x, y } (share of its box), { pixel: [x, y] }
    // on the sprite canvas, { feld: [spalte, zeile] } in the level (zeile 0 =
    // the lowest row; cells of 24 × 24 as in the recipes' maps) or { punkt: [x, y] }.
    async point(target) {
        if (typeof target === 'string') {
            const b = await this.box(target);
            return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }
        if (target?.ziel) {
            const b = await this.box(target.ziel);
            return { x: b.x + b.width * (target.x ?? 0.5), y: b.y + b.height * (target.y ?? 0.5) };
        }
        if (target?.pixel) {
            const p = await this.page.evaluate(([px, py]) => {
                const c = window.canvas;
                if (!c?.element) return null;
                const r = $(c.element)[0].getBoundingClientRect();
                const half = ((c.pen_width + 1) % 2) * 0.5;
                return { x: r.left + c.offset_x + (px + 0.5 + half) * c.scale, y: r.top + c.offset_y + (py + 0.5 + half) * c.scale };
            }, target.pixel);
            if (!p) this.fail('Die Zeichenfläche ist nicht da');
            return p;
        }
        if (target?.feld) {
            // a cell of the current layer – or, with `ebene: n`, of layer n
            // (a layer with Parallaxe sits elsewhere on screen than the others)
            const p = await this.page.evaluate(([c, r, li]) => {
                const le = window.game?.level_editor;
                if (!le?.element) return null;
                const rect = $(le.element)[0].getBoundingClientRect();
                const current = le.layer_index;
                if (li !== null) le.layer_index = li;
                try {
                    const [x, y] = le.world_to_ui([c * 24, r * 24 + 12]);
                    return { x: rect.left + x, y: rect.top + y };
                } finally {
                    le.layer_index = current;
                }
            }, [target.feld[0], target.feld[1], target.ebene ?? null]);
            if (!p) this.fail('Der Level-Editor ist nicht da');
            return p;
        }
        if (target?.punkt) return { x: target.punkt[0], y: target.punkt[1] };
        this.fail(`unbekanntes Ziel ${JSON.stringify(target)}`);
    }

    // ── recording ───────────────────────────────────────────────────────
    async frame(steps = FRAME_STEPS) {
        if (!this.recording) return;
        const t0 = Date.now(), tm = [];
        const { clip } = this.recording;
        // Headless Chromium (software WebGL) may show the level view empty
        // after it was hidden while the Spielen pane was recorded: the level
        // editor draws only on changes. Drawing the same picture once more
        // makes the screenshot show what a screen shows.
        // (only for a few frames after the level pane came back: drawing it
        // for every frame would make every screenshot slow)
        const pane = await this.page.evaluate(() => window.current_pane);
        if (pane === 'level' && this.last_pane !== 'level') this.redraw_frames = 8;
        this.last_pane = pane;
        if (this.redraw_frames > 0) {
            this.redraw_frames--;
            await this.page.evaluate(() => window.game?.level_editor?.render?.());
        }
        tm.push(Date.now() - t0);
        const shot = await this.cdp.send('Page.captureScreenshot', {
            format: 'png', optimizeForSpeed: true, clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 },
        });
        const png = Buffer.from(shot.data, 'base64');
        tm.push(Date.now() - t0);
        const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        // the same picture as before (nothing moved): the same frame again
        const last = this.recording.frames.at(-1);
        const f = last && this.last_raw && last.w === info.width && last.h === info.height && this.last_raw.equals(data)
            ? last : packed_frame(info.width, info.height, data);
        this.last_raw = data;
        this.note_band();
        tm.push(Date.now() - t0);
        if (process.env.ANLEITUNG_DEBUG && tm[tm.length - 1] > 400) console.log('   slow frame', tm.join(' '));
        for (let i = 0; i < steps; i++) this.recording.frames.push(f);
    }

    // The game frame while a game runs in it (Spielen, Level testen) – in
    // slow motion from now on (ZEITLUPE) – or null.
    async slow_game() {
        if (!this.recording || !(ZEITLUPE > 0 && ZEITLUPE < 1)) return null;
        try {
            const frame = await (await this.page.$('#play_iframe'))?.contentFrame();
            if (!frame) return null;
            const running = await frame.evaluate((s) => {
                if (!window.__guide_time || window.game?.running !== true) return false;
                if (window.__guide_time.speed() !== s) window.__guide_time.set(s);
                return true;
            }, ZEITLUPE);
            return running ? frame : null;
        } catch (e) {
            return null;
        }
    }

    // the game frame at its real speed again
    async full_speed() {
        try {
            const frame = await (await this.page.$('#play_iframe'))?.contentFrame();
            await frame?.evaluate(() => { if (window.__guide_time?.speed() !== 1) window.__guide_time?.set(1); });
        } catch (e) { /* no game frame */ }
    }

    // Time passes as it does in the studio: frames as fast as they come, each
    // as long as it really took. While a game runs, it runs in slow motion
    // and the time is the game's (so a test run plays at its speed on film,
    // with every jump). keep_slow: the caller sets the speed back.
    async live(seconds, { keep_slow = false } = {}) {
        if (!this.recording) { await this.page.waitForTimeout(seconds * 1000); return; }
        const game = await this.slow_game();
        const clock = game
            ? async () => game.evaluate(() => window.__guide_time.now()).catch(() => Date.now())
            : async () => Date.now();
        let last = await clock();
        let passed = 0;
        while (passed < seconds * 1000) {
            const before = this.recording.frames.length;
            await this.frame(1);
            const now = await clock();
            passed += now - last;
            const steps = Math.max(1, Math.round((now - last) / STEP_MS));
            const f = this.recording.frames[before];
            for (let i = 1; i < steps; i++) this.recording.frames.push(f);
            last = now;
        }
        if (game && !keep_slow) await this.full_speed();
    }

    // A still moment (nothing moves): one frame, held.
    async hold(seconds) {
        if (!this.recording) return;
        await this.frame(Math.max(1, Math.round(seconds * 1000 / STEP_MS)));
    }

    async start_video(clip) {
        this.recording = { clip, frames: [], timeline: [], last_band: null };
        this.last_raw = null;
        await this.page.evaluate(([x, y]) => window.__guide.move(x, y, false), [this.x, this.y]);
    }

    // { frames (one per 60 Hz step), timeline: [{ t (ms), nr, text, keys, maus }] }
    stop_video() {
        const r = this.recording;
        this.recording = null;
        return { frames: r.frames, timeline: r.timeline };
    }

    // ── what a child does ───────────────────────────────────────────────
    async move_to(p, ms) {
        const page = this.page;
        const dist = Math.hypot(p.x - this.x, p.y - this.y);
        if (dist < 0.5) { await page.mouse.move(p.x, p.y); return; }
        const duration = ms ?? Math.min(1100, 260 + dist * 0.75);
        const n = this.recording ? Math.max(2, Math.round(duration / (FRAME_STEPS * STEP_MS))) : Math.max(2, Math.round(dist / 40));
        const x0 = this.x, y0 = this.y;
        for (let i = 1; i <= n; i++) {
            // while a button is held (painting), the way is even and the mouse
            // passes every few pixels – the pen must not skip a cell
            const t = this.down ? i / n : ease(i / n);
            const px = this.x, py = this.y;
            this.x = x0 + (p.x - x0) * t; this.y = y0 + (p.y - y0) * t;
            await page.mouse.move(this.x, this.y, { steps: this.down ? Math.max(1, Math.ceil(Math.hypot(this.x - px, this.y - py) / 6)) : 1 });
            await page.evaluate(([x, y, d]) => window.__guide.move(x, y, d), [this.x, this.y, this.down]);
            await this.frame();
        }
    }

    async ripple(right = false) {
        const n = this.recording ? 5 : 0;
        for (let i = 0; i <= n; i++) {
            await this.page.evaluate(([x, y, t, r]) => window.__guide.ripple(x, y, t, r), [this.x, this.y, n ? i / n : 1, right]);
            if (i < n) await this.frame(2);
        }
    }

    // mit: keys held during a click or a drag (Strg + ziehen, Shift + Klick)
    async modifiers(mit, down) {
        const keys = [].concat(mit ?? []);
        for (const k of down ? keys : [...keys].reverse()) await (down ? this.page.keyboard.down(k) : this.page.keyboard.up(k));
        await this.set_band({ keys: down ? keys.flatMap(k => key_caps(k)) : [] });
    }

    async click(target, { button = 'left', count = 1, mit } = {}) {
        // the keys first: some targets only appear while a key is held (H: the ?)
        if (mit) await this.modifiers(mit, true);
        await this.move_to(await this.point(target));
        if (button === 'right') await this.set_band({ maus: 'Rechtsklick' });
        else if (mit) await this.set_band({ maus: 'Klick' });
        await this.frame(4);
        for (let i = 0; i < count; i++) {
            await this.page.mouse.down({ button, clickCount: i + 1 });
            await this.page.mouse.up({ button, clickCount: i + 1 });
        }
        await this.ripple(button === 'right');
        await this.page.waitForTimeout(150);
        await this.frame(6);
        if (mit) await this.modifiers(mit, false);
        await this.set_band({ maus: '' });
    }

    async drag(points, ms, mit) {
        const ps = [];
        for (const t of points) ps.push(await this.point(t));
        await this.move_to(ps[0]);
        if (mit) { await this.modifiers(mit, true); await this.set_band({ maus: 'ziehen' }); }
        await this.frame(3);
        this.down = true;
        await this.page.mouse.down();
        await this.page.evaluate(([x, y]) => window.__guide.move(x, y, true), [this.x, this.y]);
        await this.frame(3);
        for (const p of ps.slice(1)) {
            const dist = Math.hypot(p.x - this.x, p.y - this.y);
            await this.move_to(p, ms ?? Math.min(1400, 200 + dist * 2.2));
        }
        await this.frame(3);
        await this.page.mouse.up();
        this.down = false;
        await this.page.evaluate(([x, y]) => window.__guide.move(x, y, false), [this.x, this.y]);
        if (mit) { await this.modifiers(mit, false); await this.set_band({ maus: '' }); }
        await this.page.waitForTimeout(120);
        await this.frame(6);
    }

    // The mouse wheel over a target: `um` notches, negative = towards you
    // (in the level: zoom in), one notch every few frames
    async wheel(target, notches) {
        await this.move_to(await this.point(target));
        await this.set_band({ maus: 'Mausrad' });
        await this.frame(3);
        const n = Math.round(Number(notches) || 0);
        for (let i = 0; i < Math.abs(n); i++) {
            await this.page.mouse.wheel(0, Math.sign(n) * 100);
            await this.page.waitForTimeout(60);
            await this.frame(4);
        }
        await this.frame(4);
        await this.set_band({ maus: '' });
    }

    async key(combo, hold_seconds, show = true) {
        const caps = key_caps(combo);
        // a game looks at the keys once per frame: a press as short as a
        // script makes it (down and up at once) can be missed – a jump that
        // never happens. While a game runs, a key is held like a quick finger.
        if (!hold_seconds && await this.slow_game()) hold_seconds = 0.12;
        // a game looks at the keys once per frame: a press as short as a
        // script makes it (down and up at once) would be missed – a jump
        // that never happens. While a game runs, a key is held like a quick
        // finger would.
        if (!hold_seconds && await this.slow_game()) hold_seconds = 0.12;
        if (show) await this.set_band({ keys: caps });
        if (hold_seconds) {
            // held for exactly this long: the key goes up on a timer of its
            // own, not after a screenshot that may still be on its way (the
            // figure would walk too far)
            // (in slow motion while a game runs: then the timer waits as much
            // longer, and the game sees the key held for hold_seconds)
            const game = await this.slow_game();
            const parts = String(combo).split('+');
            for (const p of parts) await this.page.keyboard.down(p);
            const released = new Promise(resolve => setTimeout(async () => {
                for (const p of [...parts].reverse()) await this.page.keyboard.up(p);
                resolve();
            }, hold_seconds * 1000 / (game ? ZEITLUPE : 1)));
            await this.live(hold_seconds, { keep_slow: true });
            await released;
            await this.full_speed();
        } else {
            await this.frame(6);
            await this.page.keyboard.press(combo);
            await this.page.waitForTimeout(200);
            await this.frame(14);
        }
        if (show) await this.set_band({ keys: [] });
        await this.frame(2);
    }

    // A path through a menu (right-click menus, Eigenschaft hinzufügen,
    // Funktionen, dropdowns): the entries by their label, the last is clicked.
    async menu(labels) {
        labels = [].concat(labels);
        await this.page.evaluate(() => document.querySelectorAll('[data-guide-entry]').forEach(el => delete el.dataset.guideEntry));
        let entry = null;
        for (let i = 0; i < labels.length; i++) {
            const label = String(labels[i]).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            const has = `:has(> .context-menu-label:text-is("${label}"))`;
            // the first in the deepest open menu that has it (a submenu lies
            // after its parent), the next ones in the submenu of the one before
            const cls = c => `contains(concat(" ", @class, " "), " ${c} ")`;
            entry = entry ? entry.locator(`xpath=./div[${cls('context-menu-sub')}]/div[${cls('context-menu-item')}]` +
                `[span[${cls('context-menu-label')}][normalize-space(.)="${label}"]]`).first()
                : this.page.locator(`.context-menu-item:visible${has}`).last();
            try {
                await entry.waitFor({ state: 'visible', timeout: SELECTOR_TIMEOUT });
            } catch {
                this.fail(`Im Menü steht kein „${labels[i]}“ (umbenannt oder verschoben?)`);
            }
            // pinned to this element: a locator is looked up again on every use,
            // and "the last visible one" changes as soon as its submenu opens
            await entry.evaluate((el, n) => { el.dataset.guideEntry = n; }, String(i));
            entry = this.page.locator(`[data-guide-entry="${i}"]`);
            const b = await entry.boundingBox();
            const p = { x: b.x + Math.min(b.width / 2, 60), y: b.y + b.height / 2 };
            // into a submenu sideways first: it spans its entry's height, so the
            // pointer crosses no other entry of the menu before (recording is
            // slower than real time – resting on a neighbour would open its submenu)
            if (i > 0 && Math.abs(p.y - this.y) > 4) await this.move_to({ x: p.x, y: this.y });
            if (i < labels.length - 1) {
                await this.move_to(p);
                // a submenu opens at once – or, when another one of that menu is
                // open, after the mouse rested a moment (widgets.js SUBMENU_SWITCH_MS)
                for (let n = 0; n < 60 && !(await entry.evaluate(el => el.classList.contains('open'))); n++)
                    await (this.recording ? this.frame(2) : this.page.waitForTimeout(40));
                await this.frame(5);
            } else await this.click({ punkt: [p.x, p.y] });
        }
    }

    // The level editor shows these cells, [spalte0, zeile0, spalte1, zeile1]
    // (zeile 0 = the lowest row), as big as they fit – like the view jumps to
    // a Code in the Signale-Übersicht (view_signal_rects).
    async view(cells) {
        const ok = await this.page.evaluate(([c0, r0, c1, r1]) => {
            const le = window.game?.level_editor;
            if (!le?.element) return false;
            const x0 = Math.min(c0, c1) * 24 - 12, x1 = Math.max(c0, c1) * 24 + 12;
            const y0 = Math.min(r0, r1) * 24, y1 = Math.max(r0, r1) * 24 + 24;
            const need = Math.min(le.height / (y1 - y0), le.width / (x1 - x0));
            le.visible_pixels = le.height / need;
            le.fix_scale();
            le.camera_x = (x0 + x1) / 2;
            le.camera_y = (y0 + y1) / 2;
            le.auto_adjust_camera = false;
            le.handleResize();
            le.refresh();
            le.render();
            return true;
        }, cells);
        if (!ok) this.fail('ansicht: Der Level-Editor ist nicht da');
        await this.frame(2);
    }

    async type(text) {
        for (const ch of String(text)) {
            await this.page.keyboard.type(ch);
            await this.frame(2);
        }
        await this.frame(6);
    }

    // One step of the guide's YAML: { klick: … }, { malen: […] }, { taste: … } …
    async step(s) {
        this.step_no++;
        if (process.env.ANLEITUNG_DEBUG) {
            const t0 = Date.now();
            try { return await this.step_inner(s); } finally { console.log(`  ${this.step_no} ${Date.now() - t0} ms ${JSON.stringify(s).slice(0, 90)}`); }
        }
        return this.step_inner(s);
    }

    async step_inner(s) {
        // every key must mean something: a YAML slip (a comma in a caption
        // without quotes) would otherwise pass silently
        const actions = ['bewegen', 'klick', 'doppelklick', 'rechtsklick', 'ziehen', 'malen', 'taste', 'tippen', 'warten', 'pause', 'js', 'pruefen', 'menue', 'ansicht', 'rad'];
        const extras = ['hinweis', 'nr', 'mehr', 'mit', 'dauer', 'halten', 'zeigen', 'meldung', 'um', 'bis'];
        const unknown = Object.keys(s ?? {}).filter(k => !actions.includes(k) && !extras.includes(k));
        if (unknown.length) this.fail(`unbekannt: ${unknown.join(', ')} (Komma in einem Text ohne Anführungszeichen?)`);
        if (Object.keys(s).filter(k => actions.includes(k)).length > 1) this.fail(`mehrere Aktionen in einem Schritt: ${JSON.stringify(s)}`);
        const page = this.page;
        if (s.hinweis !== undefined) {
            await this.set_band({ text: s.hinweis || '', nr: s.nr ?? null, mehr: s.mehr ?? '' });
            if (Object.keys(s).every(k => ['hinweis', 'nr', 'mehr'].includes(k))) { await this.frame(10); return; }
        }
        if (s.bewegen !== undefined) await this.move_to(await this.point(s.bewegen), s.dauer ? s.dauer * 1000 : undefined);
        else if (s.klick !== undefined) await this.click(s.klick, { mit: s.mit });
        else if (s.doppelklick !== undefined) await this.click(s.doppelklick, { count: 2 });
        else if (s.rechtsklick !== undefined) await this.click(s.rechtsklick, { button: 'right' });
        else if (s.ziehen !== undefined) await this.drag([s.ziehen.von, s.ziehen.nach], s.dauer ? s.dauer * 1000 : undefined, s.mit);
        else if (s.malen !== undefined) await this.drag(s.malen, s.dauer ? s.dauer * 1000 : undefined, s.mit);
        else if (s.rad !== undefined) await this.wheel(s.rad, s.um ?? -3);
        else if (s.taste !== undefined) await this.key(s.taste, s.halten, s.zeigen !== false);
        else if (s.tippen !== undefined) {
            // `tippen: { js: … }`: what the page knows only during the run (a code that was just saved)
            let text = s.tippen;
            if (text && typeof text === 'object') {
                try { text = await page.evaluate(text.js); } catch (e) { this.fail(`tippen: ${e.message}`); }
                if (typeof text !== 'string' || !text) this.fail(`tippen: ${s.tippen.js} ergab keinen Text`);
            }
            await this.type(text);
        }
        else if (s.menue !== undefined) await this.menu(s.menue);
        else if (s.ansicht !== undefined) await this.view(s.ansicht);
        else if (s.warten !== undefined) {
            await this.live(Number(s.warten));
            // `bis: <js>`: then on until it is true (a test run has started, a
            // signal has arrived …) – a slower or faster computer gets the same film
            if (s.bis !== undefined) {
                const until = Date.now() + 10000;
                while ((await page.evaluate(s.bis).catch(() => false)) !== true) {
                    if (Date.now() > until) this.fail(`${s.meldung ?? 'Es kam nicht so weit'} (bis: ${s.bis})`);
                    await this.live(0.1);
                }
            }
        }
        else if (s.pause !== undefined) await this.hold(Number(s.pause));
        else if (s.js !== undefined) {
            try { await page.evaluate(s.js); } catch (e) { this.fail(`js: ${e.message}`); }
            await page.waitForTimeout(200);
        } else if (s.pruefen !== undefined) {
            const ok = await page.evaluate(s.pruefen).catch(e => `Fehler: ${e.message}`);
            if (ok !== true) this.fail(`${s.meldung ?? 'Prüfung fehlgeschlagen'} (${s.pruefen} → ${JSON.stringify(ok)})`);
        } else if (s.hinweis === undefined) this.fail(`unbekannter Schritt ${JSON.stringify(s)}`);
    }

    async steps(list) {
        for (const s of list ?? []) await this.step(s);
    }

    // The part of the screen a video or picture shows: a selector, several
    // (their common box), [x, y, w, h], or 'ganz'; `rand` pixels around it.
    async clip(spec, rand = 12) {
        const vw = 1600, vh = 900;
        let b;
        if (!spec || spec === 'ganz') b = { x: 0, y: 0, width: vw, height: vh };
        else if (Array.isArray(spec) && typeof spec[0] === 'number') b = { x: spec[0], y: spec[1], width: spec[2], height: spec[3] };
        else {
            const boxes = [];
            for (const sel of [].concat(spec)) boxes.push(await this.box(sel));
            const x0 = Math.min(...boxes.map(q => q.x)), y0 = Math.min(...boxes.map(q => q.y));
            const x1 = Math.max(...boxes.map(q => q.x + q.width)), y1 = Math.max(...boxes.map(q => q.y + q.height));
            b = { x: x0 - rand, y: y0 - rand, width: x1 - x0 + 2 * rand, height: y1 - y0 + 2 * rand };
        }
        const x = Math.max(0, Math.floor(b.x)), y = Math.max(0, Math.floor(b.y));
        // even sizes: friendlier to every encoder
        const w = Math.min(vw - x, Math.ceil(b.width)) & ~1, h = Math.min(vh - y, Math.ceil(b.height)) & ~1;
        return { x, y, width: w, height: h, w, h };
    }

    // Numbered marks for a picture: [{ ziel, nr, rahmen: true }]
    async place_marks(marks) {
        const list = [];
        for (const m of marks ?? []) {
            const b = m.ziel ? await this.box(m.ziel) : null;
            const p = m.ziel ? { x: b.x + b.width * (m.x ?? 0), y: b.y + b.height * (m.y ?? 0) } : await this.point(m);
            list.push({ nr: m.nr, x: p.x, y: p.y, frame: m.rahmen && b ? { x: b.x, y: b.y, w: b.width, h: b.height } : null });
        }
        await this.page.evaluate(l => window.__guide.marks(l), list);
    }

    async picture(clip) {
        const png = await this.page.screenshot({ clip, animations: 'allow' });
        const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        return { w: info.width, h: info.height, data };
    }
}

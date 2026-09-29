// Records a recipe scene with the real engine (standalone.html + app.js) in
// headless Chromium. Nothing in the engine is modified: we replace the game
// clock with a manual one, seed Math.random, feed key presses through the
// game's own handle_key_down/up and read back only the recorded area.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

export const SCALE = 3;          // screen pixels per game pixel in the GIF
// One GIF frame per simulation step (60 Hz), shown for 20 ms: GIFs cannot do
// 60 fps and uneven 30/30/40 ms delays judder. The GIF therefore plays at 5/6 of
// real time, but every step is visible and the motion is perfectly even.
export const FRAME_MS = 20;

const KEYS = {
    rechts: 'ArrowRight', links: 'ArrowLeft', hoch: 'ArrowUp', runter: 'ArrowDown',
    springen: 'Space', aktion: 'KeyF', nahkampf: 'KeyJ', fernkampf: 'KeyK',
};

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.fs': 'text/plain', '.vs': 'text/plain',
};

export async function launch() {
    return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

// Expand the recipe's input script into sorted key events.
export function key_events(script) {
    const events = [];
    for (const step of script ?? []) {
        const t = Number(step.t ?? 0);
        const hold = step.halten ?? step.drücken ?? step.druecken;
        if (!hold) throw new Error(`Ablauf: Schritt ohne "halten"/"drücken": ${JSON.stringify(step)}`);
        const names = Array.isArray(hold) ? hold : [hold];
        const duration = step.halten ? Number(step.dauer ?? 0.5) : Number(step.dauer ?? 0.1);
        for (const name of names) {
            // A name (rechts, springen …) or a key code such as ControlLeft.
            const code = KEYS[name] ?? (/^(Key[A-Z]|Digit\d|Arrow\w+|Control\w+|Shift\w+|Alt\w+|Space|Enter|Tab)$/.test(name) ? name : null);
            if (!code) throw new Error(`Ablauf: unbekannte Taste "${name}" (erlaubt: ${Object.keys(KEYS).join(', ')} oder ein Tastencode)`);
            // Snap to whole simulation steps (60 per second): no float surprises.
            const s0 = Math.round(t * 60), s1 = Math.round((t + duration) * 60);
            events.push({ t: s0 / 60, step: s0, down: true, code }, { t: s1 / 60, step: s1, down: false, code });
        }
    }
    return events.sort((a, b) => a.t - b.t || (a.down ? 1 : -1));
}

export async function record(browser, repo, game, recipe) {
    const sph = game.screen_pixel_height;
    const scale = recipe.skala ?? SCALE;
    const height = sph * scale, width = Math.round(height * 16 / 9);
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const static_root = path.join(repo, 'src/static');
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'rezepte.local') return route.abort();
        const p = decodeURIComponent(url.pathname);
        const reply = (body, type) => route.fulfill({ status: 200, body, contentType: type });
        if (p === `/gen/games/${game.tag}.json`) return reply(JSON.stringify(game.data), MIME['.json']);
        if (p === `/gen/spritesheets/${game.tag}.json`) return reply(JSON.stringify(game.sheet.info), MIME['.json']);
        if (p === `/gen/spritesheets/${game.sheet.name}`) return reply(game.sheet.png, MIME['.png']);
        let file = path.join(static_root, p === '/' ? 'standalone.html' : p);
        if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
        if (!file.startsWith(static_root) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
            return route.fulfill({ status: 404, body: '' });
        let body = fs.readFileSync(file);
        if (file.endsWith('.html')) body = body.toString().replace(/#\{@@cache_buster\}/g, 'rezepte');
        return reply(body, MIME[path.extname(file)] ?? 'application/octet-stream');
    });
    await page.addInitScript(() => {
        // Deterministic randomness (patrols, animation phases, camera shake).
        let s = 0x2d2d2d;
        Math.random = () => {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    });
    await page.goto('http://rezepte.local/standalone');
    await page.waitForFunction(() => window.game && typeof shaders !== 'undefined' && shaders?.shaders?.['texture.fs']);
    await page.evaluate(async (tag) => {
        window.requestAnimationFrame = () => 0;      // we call render() ourselves
        const g = window.game;
        await g.load(tag);
        g.level_index = 0;
        g.reset();
        g.setup();
        let now = 0;
        g.clock = { getElapsedTime: () => now, start() { }, getSpeed: () => 1, setSpeed() { }, delta() { } };
        window.__set_time = t => { now = t; };
        g.frame = 0;
        g.running = true;
        $('#overlay').hide(); $('#screen').show(); $('#stats').hide();
    }, game.tag);

    const events = key_events(recipe.ablauf);
    const duration = Number(recipe.dauer ?? 4);
    const frames = [];
    let ei = 0;
    const steps = recipe.schritte ?? 1;             // simulation steps per GIF frame
    for (let i = 0; i * steps / 60 < duration - 1e-9; i++) {
        const t = i * steps / 60;
        const due = [];
        while (ei < events.length && events[ei].step <= i * steps) due.push(events[ei++]);
        const shot = await page.evaluate(({ t, due, view }) => {
            const g = window.game;
            for (const e of due) e.down ? g.handle_key_down(e.code) : g.handle_key_up(e.code);
            window.__set_time(t);
            g.render();
            const gl = g.renderer.getContext();
            const cam = g.camera;
            if (view === 'kamera') view = { x0: cam.left, x1: cam.right, y0: cam.bottom, y1: cam.top };
            const sx = gl.drawingBufferWidth / (cam.right - cam.left);
            const sy = gl.drawingBufferHeight / (cam.top - cam.bottom);
            const x = Math.round((view.x0 - cam.left) * sx);
            const y = Math.round((view.y0 - cam.bottom) * sy);
            const w = Math.round((view.x1 - view.x0) * sx);
            const h = Math.round((view.y1 - view.y0) * sy);
            const buf = new Uint8Array(w * h * 4);
            gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            let bin = '';
            for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
            const pc = g.player_character;
            const player_x = pc ? Math.round((pc.mesh.position.x - view.x0) * sx) : null;
            const dbg = pc ? `${pc.mesh.position.x.toFixed(1)},${pc.mesh.position.y.toFixed(1)} ${pc.state}/${pc.direction} keys=${Object.keys(g.pressed_keys).filter(k => g.pressed_keys[k]).join('+')}` +
                g.baddies.map(b => ` | gegner ${b.mesh.position.x.toFixed(0)},${b.mesh.position.y.toFixed(0)} e=${b.energy}${b.hit_paused?.() ? ' pause' : ''}`).join('') : '';
            return { w, h, data: btoa(bin), dbg, player_x };
        }, { t, due, view: game.view });
        if (process.env.REZEPT_DEBUG && i % 6 === 0) console.log(`  t=${t.toFixed(2)} ${shot.dbg}`);
        const raw = Buffer.from(shot.data, 'base64');
        // WebGL rows start at the bottom.
        const flipped = Buffer.alloc(raw.length);
        const row = shot.w * 4;
        for (let y = 0; y < shot.h; y++) raw.copy(flipped, (shot.h - 1 - y) * row, y * row, (y + 1) * row);
        for (let p = 3; p < flipped.length; p += 4) flipped[p] = 255;
        frames.push({ w: shot.w, h: shot.h, data: flipped, player_x: shot.player_x });
    }

    const state = await page.evaluate(() => {
        const g = window.game;
        const doors = g.active_level_sprites.filter(e => 'door' in (g.data.sprites[e.sprite_index].traits ?? {}));
        const pc = g.player_character;
        return {
            player: pc ? { x: pc.mesh.position.x, y: pc.mesh.position.y, dead: pc.dead() } : null,
            energy: g.energy, points: g.points, lives: g.lives,
            found_keys: Object.keys(g.found_keys ?? {}).map(Number),
            doors_open: doors.map(d => d.door_closed === false),
            checkpoints_active: g.active_level_sprites.filter(e => {
                const sp = g.data.sprites[e.sprite_index];
                const st = sp.states[g.state_for_mesh[e.mesh.uuid]?.state_index ?? 0];
                return 'checkpoint' in (sp.traits ?? {}) && 'active' in (st?.traits?.checkpoint ?? {});
            }).length,
            baddies: g.baddies.map(b => ({ energy: b.energy, active: b.active })),
        };
    });
    await context.close();
    return { frames, state, errors };
}

// Frames -> looping GIF. Identical consecutive frames are merged.
// tolerance: pixels that changed less than this (colour distance) are kept from the previous
// frame – much smaller files for scenes where effects shimmer across the whole picture.
export async function write_gif(frames, file, colours = 128, delay_ms = FRAME_MS, tolerance = 0) {
    const merged = [];
    for (let i = 0; i < frames.length; i++) {
        const delay = delay_ms;
        const last = merged[merged.length - 1];
        if (last && last.frame.data.equals(frames[i].data)) last.delay += delay;
        else merged.push({ frame: frames[i], delay });
    }
    const { w, h } = frames[0];
    const pngs = await Promise.all(merged.map(m =>
        sharp(m.frame.data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()));
    await sharp(pngs, { join: { animated: true } })
        .gif({ delay: merged.map(m => m.delay), loop: 0, dither: 0, effort: 7, colours,
            ...(tolerance ? { interFrameMaxError: tolerance } : {}) })
        .toFile(file);
    return { width: w, height: h, frames: merged.length };
}

// Checks from the recipe's "erwartet" block. Returns a list of failures.
export function check(expect, state) {
    const fail = [];
    const e = expect ?? {};
    if (e.gegner_besiegt !== undefined) {
        const n = state.baddies.filter(b => !b.active || b.energy <= 0).length;
        if (n < e.gegner_besiegt) fail.push(`gegner_besiegt: ${n} statt ${e.gegner_besiegt}`);
    }
    if (e.gegner_leben !== undefined) {
        const n = state.baddies.filter(b => b.active && b.energy > 0).length;
        if (n !== e.gegner_leben) fail.push(`gegner_leben: ${n} statt ${e.gegner_leben}`);
    }
    for (const code of e.schluessel ?? [])
        if (!state.found_keys.includes(code)) fail.push(`Schlüssel ${code} nicht eingesammelt`);
    if (e.tuer_offen !== undefined) {
        const open = state.doors_open.some(Boolean);
        if (open !== e.tuer_offen) fail.push(`tuer_offen: ${open} statt ${e.tuer_offen}`);
    }
    if (e.figur_rechts_von !== undefined && !(state.player?.x > e.figur_rechts_von * 24))
        fail.push(`Figur steht bei x=${state.player?.x?.toFixed(1)}, erwartet rechts von Spalte ${e.figur_rechts_von}`);
    if (e.figur_hoeher_als !== undefined && !(state.player?.y >= e.figur_hoeher_als * 24))
        fail.push(`Figur steht bei y=${state.player?.y?.toFixed(1)}, erwartet mindestens auf Höhe ${e.figur_hoeher_als}`);
    if (e.checkpoint_aktiv && !state.checkpoints_active) fail.push('Checkpoint wurde nicht aktiviert');
    if (e.energie_gleich !== undefined && state.energy !== e.energie_gleich)
        fail.push(`energie: ${state.energy} statt ${e.energie_gleich}`);
    if (e.punkte !== undefined && state.points < e.punkte) fail.push(`punkte: ${state.points} statt ${e.punkte}`);
    if (e.energie_unter !== undefined && !(state.energy < e.energie_unter))
        fail.push(`energie: ${state.energy}, erwartet weniger als ${e.energie_unter}`);
    if (e.lebt !== undefined && state.player && state.player.dead === e.lebt) fail.push(`Figur lebt: ${!state.player.dead}`);
    return fail;
}

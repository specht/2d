// Records a recipe scene with the real engine (standalone.html + app.js) in
// headless Chromium. Nothing in the engine is modified: we replace the game
// clock with a manual one, seed Math.random, feed key presses through the
// game's own handle_key_down/up and read back only the recorded area.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';

// Screen pixels per game pixel in a recording (recipes may set `skala`). The
// recording keeps this scale: sub-pixel scrolling and camera shake look as in the game.
export const RENDER_SCALE = 3;
// One frame per simulation step (60 Hz). WebP delays are whole milliseconds, so
// they are rounded cumulatively (17, 17, 16, …): real speed, no drift.
export const STEP_MS = 1000 / 60;

const KEYS = {
    rechts: 'ArrowRight', links: 'ArrowLeft', hoch: 'ArrowUp', runter: 'ArrowDown',
    springen: 'Space', aktion: 'KeyF', nahkampf: 'KeyJ', fernkampf: 'KeyK',
    // ".": the next sentence of what somebody says (speech.js)
    weiter: 'Period',
};

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
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
            const code = KEYS[name] ?? (/^(Key[A-Z]|Digit\d|Arrow\w+|Control\w+|Shift\w+|Alt\w+|Space|Enter|Tab|Period)$/.test(name) ? name : null);
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
    const scale = recipe.skala ?? RENDER_SCALE;
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
        // the server's template placeholders: #{@@cache_buster}, and any other
        // (#{DEVELOPMENT …}) as nothing – a Ruby expression is no JavaScript
        if (file.endsWith('.html')) body = body.toString().replace(/#\{@@cache_buster\}/g, 'rezepte').replace(/#\{[^}]*\}/g, '');
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
    await page.evaluate(async ({ tag, lift, start_items, start_points, hud }) => {
        window.requestAnimationFrame = () => 0;      // we call render() ourselves
        const g = window.game;
        await g.load(tag);
        g.level_index = 0;
        g.reset();
        // szene.inventar: what the figure brings along from another level (inventory.js)
        for (const si of start_items) g.keep_item(si, 0);
        // szene.punkte: brought along from a level before
        g.points = start_points;
        g.setup();
        // the game's speech font, before the first frame (speech.js)
        await g.speech_fonts_ready?.();
        let now = 0;
        g.clock = { getElapsedTime: () => now, start() { }, getSpeed: () => 1, setSpeed() { }, delta() { } };
        window.__set_time = t => { now = t; };
        g.frame = 0;
        g.running = true;
        $('#overlay').hide(); $('#screen').show();
        // no HUD (hud.js) in recordings: they show a part of the level, not the screen –
        // unless the recipe is about it (hud: true, with kamera: the whole screen)
        g.hud_off = !hud;
        // bild_hoch with kamera: the engine centres the camera on the level's
        // bounds (when they fit on the screen) – lift them, and the camera with them
        if (lift) { g.miny += lift; g.maxy += lift; }
    }, { tag: game.tag, lift: game.camera_lift ?? 0, start_items: game.start_items ?? [], start_points: game.start_points ?? 0, hud: recipe.hud === true });

    const events = key_events(recipe.ablauf);
    const duration = Number(recipe.dauer ?? 4);
    const frames = [];
    const foes = [];
    const pals = [];      // every Begleiter's way through the recording
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
            // The camera without its shake: the recorded area follows the camera,
            // but not the shake – so the shake stays visible in the recording.
            const cw = cam.right - cam.left, ch = cam.top - cam.bottom;
            const left = g.camera_x - cw / 2, bottom = g.camera_y - ch / 2;
            if (view === 'kamera') view = { x0: left, x1: left + cw, y0: bottom, y1: bottom + ch };
            const sx = gl.drawingBufferWidth / cw;
            const sy = gl.drawingBufferHeight / ch;
            let w = Math.round((view.x1 - view.x0) * sx);
            let h = Math.round((view.y1 - view.y0) * sy);
            // fixed on the screen: where the area would be without the shake
            let x = Math.max(0, Math.min(gl.drawingBufferWidth - w, Math.round((view.x0 - left) * sx)));
            let y = Math.max(0, Math.min(gl.drawingBufferHeight - h, Math.round((view.y0 - bottom) * sy)));
            // A completed level: the game zooms onto the figure (app.js complete_level,
            // ts_zoom_actor). The recording keeps the same part of the screen as just
            // before – what a player sees there – instead of the scene's world area,
            // which no longer fits the zoomed picture.
            if (g.reached_flag && g.ts_zoom_actor >= 0 && window.__last_shot_rect) ({ x, y, w, h } = window.__last_shot_rect);
            else window.__last_shot_rect = { x, y, w, h };
            const buf = new Uint8Array(w * h * 4);
            gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
            let bin = '';
            for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(k, k + 0x8000));
            const pc = g.player_character;
            const player_x = pc ? Math.round((pc.mesh.position.x - view.x0) * sx) : null;
            const dbg = pc ? `${pc.mesh.position.x.toFixed(1)},${pc.mesh.position.y.toFixed(1)} ${pc.state}/${pc.direction} keys=${Object.keys(g.pressed_keys).filter(k => g.pressed_keys[k]).join('+')}` +
                g.baddies.map(b => ` | gegner ${b.mesh.position.x.toFixed(0)},${b.mesh.position.y.toFixed(0)} e=${b.energy}${b.hit_paused?.() ? ' pause' : ''}${b.ai_memory?.mode ? ' ' + b.ai_memory.mode : ''}`).join('') +
                (g.companions ?? []).map(c => ` | begleiter ${c.mesh.position.x.toFixed(0)},${c.mesh.position.y.toFixed(0)} ${c.state}${c.fluid_mode ? ' ' + c.fluid_mode : ''} ${c.companion_memory?.state ?? ''}`).join('') +
                (g.moving_platforms ?? []).map(p => { const m = g.active_level_sprites[p.entry_index].mesh.position;
                    return ` | plattform ${m.x.toFixed(0)},${m.y.toFixed(0)}${p.waiting ? ' wartet' : ''}`; }).join('') : '';
            // where each Begleiter is (companion_ai.js), for the begleiter_* checks
            const pals = (g.companions ?? []).map(c => ({ name: c.sprite?.properties?.name ?? '', x: c.mesh.position.x, y: c.mesh.position.y,
                swim: c.fluid_mode === 'swim', lost: c.companion_stats?.lost ?? 0, returned: c.companion_stats?.returned ?? 0,
                // the picture it shows (sit / busy while keeping busy), and a flyer standing on the ground
                state: c.state ?? null, landed: Boolean(c.companion?.fly && !c.ai_no_gravity && c.touching_ground?.()),
                dist: pc ? Math.hypot(pc.mesh.position.x - c.mesh.position.x, pc.mesh.position.y - c.mesh.position.y) : null }));
            // what each enemy did: position, behaviour mode, "!" shown
            const foes = g.baddies.map(b => ({ x: b.mesh.position.x, y: b.mesh.position.y,
                mode: b.ai_memory?.mode ?? null, alert: b.alert_mesh?.visible === true }));
            return { w, h, data: btoa(bin), dbg, player_x, foes, pals };
        }, { t, due, view: game.view });
        if (process.env.REZEPT_DEBUG && i % (process.env.REZEPT_DEBUG === 'alle' ? 1 : 6) === 0) console.log(`  t=${t.toFixed(2)} ${shot.dbg}`);
        const raw = Buffer.from(shot.data, 'base64');
        // WebGL rows start at the bottom.
        const flipped = Buffer.alloc(raw.length);
        const row = shot.w * 4;
        for (let y = 0; y < shot.h; y++) raw.copy(flipped, (shot.h - 1 - y) * row, y * row, (y + 1) * row);
        for (let p = 3; p < flipped.length; p += 4) flipped[p] = 255;
        frames.push({ w: shot.w, h: shot.h, data: flipped, player_x: shot.player_x });
        shot.pals.forEach((c, k) => (pals[k] ??= []).push({ t, ...c }));
        shot.foes.forEach((f, k) => {
            const t = (foes[k] ??= { modes: new Set(), alert: false, x0: f.x, x1: f.x, y0: f.y, y1: f.y });
            if (f.mode) t.modes.add(f.mode);
            t.alert ||= f.alert;
            t.x0 = Math.min(t.x0, f.x); t.x1 = Math.max(t.x1, f.x);
            t.y0 = Math.min(t.y0, f.y); t.y1 = Math.max(t.y1, f.y);
        });
    }

    const state = await page.evaluate(() => {
        const g = window.game;
        const doors = g.active_level_sprites.filter(e => 'door' in (g.data.sprites[e.sprite_index].traits ?? {}));
        const pc = g.player_character;
        return {
            // schwerkraft: where gravity pulls the figure at the end (movement_regions.js direction)
            player: pc ? { x: pc.mesh.position.x, y: pc.mesh.position.y, dead: pc.dead(),
                schwerkraft: ['unten', 'rechts', 'oben', 'links'][pc.gravity_k ?? 0] } : null,
            energy: g.energy, points: g.points, lives: g.lives,
            // the inventory (inventory.js): { Titel: count }, and the chosen weapons' Titel
            inventory: Object.fromEntries((g.inventory ?? []).map(item =>
                [g.data.sprites[item.sprite_index]?.properties?.name ?? `Sprite ${item.sprite_index + 1}`, item.count])),
            weapons: [...new Set([g.weapon_choice?.nah, g.weapon_choice?.fern].filter(si => Number.isInteger(si)))]
                .map(si => g.data.sprites[si]?.properties?.name ?? `Sprite ${si + 1}`),
            found_keys: Object.keys(g.found_keys ?? {}).map(Number),
            // every signal of the level in order (signals.js), e.g. '7 an'
            signals: (g.signals?.sent ?? []).map(([code, on]) => `${code} ${on ? 'an' : 'aus'}`),
            // every sentence that was said, in order (speech.js)
            spoken: [...(g.speech?.log ?? [])],
            doors_open: doors.map(d => d.door_closed === false),
            // the level is done (the exit, or "geschafft bei Signal": app.js complete_level)
            level_done: g.reached_flag === true,
            checkpoints_active: g.active_level_sprites.filter(e => {
                const sp = g.data.sprites[e.sprite_index];
                const st = sp.states[g.state_for_mesh[e.mesh.uuid]?.state_index ?? 0];
                return 'checkpoint' in (sp.traits ?? {}) && 'active' in (st?.traits?.checkpoint ?? {});
            }).length,
            baddies: g.baddies.map(b => ({ energy: b.energy, active: b.active })),
            companions: (g.companions ?? []).length,
            // Bewegte Plattformen (platforms.js): how far each went, how far the player rode
            // on it, how many steps it waited for somebody
            platforms: (g.moving_platforms ?? []).map(p => ({ weg: p.travelled, mitgefahren: p.player_ridden, gewartet: p.waited })),
        };
    });
    state.companions = pals;
    await context.close();
    state.baddies.forEach((b, k) => {
        const t = foes[k];
        if (t) Object.assign(b, { modes: [...t.modes], alert: t.alert, weg: t.x1 - t.x0, hub: t.y1 - t.y0 });
    });
    return { frames, state, errors };
}

// Fallback for scenes full of shader noise (weather), where lossless WebP gets
// big: a GIF with a limited palette. GIFs cannot do 60 fps, so every step is
// shown for 20 ms (5/6 of real speed, but even). tolerance: ignore tiny colour
// changes between frames.
export async function write_gif(frames, file, colours = 128, steps = 1, tolerance = 0) {
    const merged = [];
    for (const frame of frames) {
        const last = merged[merged.length - 1];
        if (last && last.frame.data.equals(frame.data)) last.delay += 20 * steps;
        else merged.push({ frame, delay: 20 * steps });
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

// Frames -> looping, lossless animated WebP (exact colours, exact timing). Identical
// consecutive frames are merged; `steps` simulation steps per frame.
export async function write_webp(frames, file, steps = 1) {
    const merged = [];
    for (let i = 0; i < frames.length; i++) {
        const last = merged[merged.length - 1];
        if (last && last.frame.data.equals(frames[i].data)) last.steps += steps;
        else merged.push({ frame: frames[i], start: i * steps, steps });
    }
    // cumulative rounding: every frame ends at the exact millisecond of its step
    const delay = merged.map(m => Math.round((m.start + m.steps) * STEP_MS) - Math.round(m.start * STEP_MS));
    const { w, h } = frames[0];
    const pngs = await Promise.all(merged.map(m =>
        sharp(m.frame.data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer()));
    if (merged.length === 1) {
        await sharp(pngs[0]).webp({ lossless: true, effort: 6 }).toFile(file);
        return { width: w, height: h, frames: 1 };
    }
    // libvips joins all frames into one tall image; beyond about 65,000 rows the
    // later frames come out garbled (in browsers, too). So: encode chunks that
    // stay well below that, then join their frames (ANMF chunks) into one file.
    const per_chunk = Math.max(2, Math.floor(32000 / h));
    const parts = [];
    for (let i = 0; i < pngs.length; i += per_chunk) {
        const chunk = pngs.slice(i, i + per_chunk);
        const image = chunk.length === 1 ? sharp(chunk[0]) : sharp(chunk, { join: { animated: true } });
        parts.push(await image.webp({ lossless: true, effort: 6, loop: 0, delay: delay.slice(i, i + per_chunk) }).toBuffer());
    }
    fs.writeFileSync(file, join_animated_webp(parts, delay.slice(-1)[0]));
    return { width: w, height: h, frames: merged.length };
}

// RIFF chunks of a WebP file: [{ id, data }]
function webp_chunks(buf) {
    if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new Error('keine WebP-Datei');
    const chunks = [];
    for (let p = 12; p + 8 <= buf.length;) {
        const id = buf.toString('ascii', p, p + 4), size = buf.readUInt32LE(p + 4);
        chunks.push({ id, data: buf.subarray(p + 8, p + 8 + size) });
        p += 8 + size + (size & 1);
    }
    return chunks;
}

// One animation from several: header (VP8X, ANIM) of the first part, then the
// frames of all parts in order. A part with a single frame is a plain image
// (VP8L), which becomes one full-size frame with the given duration.
function join_animated_webp(parts, last_delay) {
    const first = webp_chunks(parts[0]);
    const head = first.filter(c => c.id === 'VP8X' || c.id === 'ANIM');
    const frames = [];
    for (const part of parts) {
        const chunks = webp_chunks(part);
        const anmf = chunks.filter(c => c.id === 'ANMF');
        if (anmf.length) { frames.push(...anmf.map(c => c.data)); continue; }
        const image = chunks.find(c => c.id === 'VP8L' || c.id === 'VP8 ');
        const [cw, ch] = [head[0].data.readUIntLE(4, 3) + 1, head[0].data.readUIntLE(7, 3) + 1];
        const header = Buffer.alloc(16);
        header.writeUIntLE(0, 0, 3); header.writeUIntLE(0, 3, 3);
        header.writeUIntLE(cw - 1, 6, 3); header.writeUIntLE(ch - 1, 9, 3);
        header.writeUIntLE(last_delay, 12, 3);
        header[15] = 0b10;   // do not blend, keep the canvas
        frames.push(Buffer.concat([header, riff_chunk(image.id, image.data)]));
    }
    const body = Buffer.concat([Buffer.from('WEBP'), ...head.map(c => riff_chunk(c.id, c.data)), ...frames.map(f => riff_chunk('ANMF', f))]);
    return Buffer.concat([Buffer.from('RIFF'), u32(body.length), body]);
}

function riff_chunk(id, data) {
    return Buffer.concat([Buffer.from(id, 'ascii'), u32(data.length), data, Buffer.alloc(data.length & 1)]);
}

function u32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n);
    return b;
}

// Begleiter (companion_ai.js): what the recipe promises about them. Each check
// passes if some Begleiter in the scene did it (most scenes have one).
// trace: [{ t, x, y, swim, lost, returned, dist }] per Begleiter, one per frame.
function check_companions(e, traces) {
    const fail = [];
    // begleiter_einzeln: { Hund: { schwimmt: false }, Otter: { schwimmt: true } } – the same
    // checks for the Begleiter whose sprite Titel starts with that name only
    for (const [name, checks] of Object.entries(e.begleiter_einzeln ?? {})) {
        const mine = traces.filter(tr => tr[0]?.name?.startsWith(name));
        if (!mine.length) { fail.push(`Kein Begleiter „${name}“ in der Szene`); continue; }
        const prefixed = Object.fromEntries(Object.entries(checks).map(([k, v]) => [`begleiter_${k}`, v]));
        fail.push(...check_companions(prefixed, mine).map(f => `${name}: ${f}`));
    }
    const keys = Object.keys(e).filter(k => k.startsWith('begleiter_') && k !== 'begleiter_einzeln');
    if (!keys.length) return fail;
    if (!traces.length) return ['Kein Begleiter in der Szene'];
    const some = test => traces.some(tr => tr.length && test(tr));
    const last = tr => tr[tr.length - 1];
    const range = (tr, k) => Math.max(...tr.map(s => s[k])) - Math.min(...tr.map(s => s[k]));
    // it moved from its start and ends close to the player
    if (e.begleiter_folgt !== undefined && !some(tr => Math.hypot(last(tr).x - tr[0].x, last(tr).y - tr[0].y) >= 48 && last(tr).dist <= e.begleiter_folgt))
        fail.push(`Begleiter ist nicht mitgekommen (Abstand am Ende ${traces.map(tr => last(tr)?.dist?.toFixed(0)).join(', ')} px, erwartet höchstens ${e.begleiter_folgt})`);
    if (e.begleiter_weg !== undefined && !some(tr => range(tr, 'x') >= e.begleiter_weg))
        fail.push(`Begleiter ist nur ${Math.max(...traces.map(tr => range(tr, 'x'))).toFixed(0)} px zur Seite gekommen, erwartet ${e.begleiter_weg}`);
    if (e.begleiter_hub !== undefined && !some(tr => range(tr, 'y') >= e.begleiter_hub))
        fail.push(`Begleiter ist nur ${Math.max(...traces.map(tr => range(tr, 'y'))).toFixed(0)} px auf und ab gekommen, erwartet ${e.begleiter_hub}`);
    // { links_von: column, bis: seconds } – it stayed behind (e.g. below a ledge) at least until then
    if (e.begleiter_bleibt_zurueck !== undefined) {
        const { links_von, bis } = e.begleiter_bleibt_zurueck;
        if (!some(tr => tr.filter(s => s.t <= bis).every(s => s.x < links_von * 24 - 12)))
            fail.push(`Begleiter war vor ${bis} s schon rechts von Spalte ${links_von} – er sollte zurückbleiben`);
    }
    // it got lost and found the player again (at least so many times)
    if (e.begleiter_verloren !== undefined && !some(tr => last(tr).lost >= e.begleiter_verloren && last(tr).returned >= e.begleiter_verloren))
        fail.push(`Begleiter hat ${traces.map(tr => `${last(tr).lost}× verloren, ${last(tr).returned}× wiedergefunden`).join('; ')}, erwartet ${e.begleiter_verloren}×`);
    if (e.begleiter_nie_verloren && some(tr => last(tr).lost > 0))
        fail.push('Begleiter hat den Anschluss verloren, sollte aber mitkommen');
    if (e.begleiter_schwimmt !== undefined && some(tr => tr.some(s => s.swim)) !== e.begleiter_schwimmt)
        fail.push(`Begleiter schwimmt: ${!e.begleiter_schwimmt} statt ${e.begleiter_schwimmt}`);
    if (e.begleiter_rechts_von !== undefined && !some(tr => last(tr).x > e.begleiter_rechts_von * 24 - 12))
        fail.push(`Begleiter steht am Ende bei x=${traces.map(tr => last(tr).x.toFixed(0)).join(', ')}, erwartet rechts von Spalte ${e.begleiter_rechts_von}`);
    // keeping busy (companion_ai.js COMPANION_IDLE): it showed these pictures (sit, busy, …)
    for (const pose of e.begleiter_zeigt ?? [])
        if (!some(tr => tr.some(s => s.state === pose))) fail.push(`Begleiter hat „${pose}“ nie gezeigt`);
    // a flyer landed on the ground and flew up again
    if (e.begleiter_landet && !some(tr => tr.some(s => s.landed) && tr.findIndex(s => s.landed) < tr.findLastIndex(s => !s.landed)))
        fail.push('Der fliegende Begleiter ist nie gelandet und wieder aufgeflogen');
    // a flyer never came down into the gap: always at least so many tiles high
    if (e.begleiter_immer_hoeher_als !== undefined && !some(tr => tr.every(s => s.y >= e.begleiter_immer_hoeher_als * 24)))
        fail.push(`Begleiter war tiefer als Höhe ${e.begleiter_immer_hoeher_als} (y=${Math.min(...traces.flat().map(s => s.y)).toFixed(0)})`);
    return fail;
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
    if (e.gesagt !== undefined) {
        const want = e.gesagt.map(String);
        if (JSON.stringify(state.spoken) !== JSON.stringify(want))
            fail.push(`gesagt: [${state.spoken.join(' | ')}] statt [${want.join(' | ')}]`);
    }
    if (e.signale !== undefined) {
        const want = e.signale.map(String);
        if (JSON.stringify(state.signals) !== JSON.stringify(want))
            fail.push(`signale: [${state.signals.join(', ')}] statt [${want.join(', ')}]`);
    }
    if (e.tuer_offen !== undefined) {
        const open = state.doors_open.some(Boolean);
        if (open !== e.tuer_offen) fail.push(`tuer_offen: ${open} statt ${e.tuer_offen}`);
    }
    // column N starts at x = N × 24 − 12 (game.mjs X0)
    if (e.figur_rechts_von !== undefined && !(state.player?.x > e.figur_rechts_von * 24 - 12))
        fail.push(`Figur steht bei x=${state.player?.x?.toFixed(1)}, erwartet rechts von Spalte ${e.figur_rechts_von}`);
    // figur_schwerkraft: links | oben | rechts | unten – where gravity pulls the figure at the end
    if (e.figur_schwerkraft !== undefined && state.player?.schwerkraft !== e.figur_schwerkraft)
        fail.push(`Schwerkraft zieht die Figur nach ${state.player?.schwerkraft}, erwartet nach ${e.figur_schwerkraft}`);
    if (e.figur_hoeher_als !== undefined && !(state.player?.y >= e.figur_hoeher_als * 24))
        fail.push(`Figur steht bei y=${state.player?.y?.toFixed(1)}, erwartet mindestens auf Höhe ${e.figur_hoeher_als}`);
    if (e.checkpoint_aktiv && !state.checkpoints_active) fail.push('Checkpoint wurde nicht aktiviert');
    if (e.geschafft !== undefined && state.level_done !== e.geschafft) fail.push(`geschafft: ${state.level_done} statt ${e.geschafft}`);
    if (e.energie_gleich !== undefined && state.energy !== e.energie_gleich)
        fail.push(`energie: ${state.energy} statt ${e.energie_gleich}`);
    if (e.punkte !== undefined && state.points < e.punkte) fail.push(`punkte: ${state.points} statt ${e.punkte}`);
    if (e.punkte_gleich !== undefined && state.points !== e.punkte_gleich) fail.push(`punkte: ${state.points} statt genau ${e.punkte_gleich}`);
    // leben: exactly so many lives at the end (e.g. one more, bought in a shop)
    if (e.leben !== undefined && state.lives !== e.leben) fail.push(`leben: ${state.lives} statt ${e.leben}`);
    // inventar: { Titel: Anzahl } – what stays for the whole game (a Titel by its beginning);
    // waffe: Titel – the weapon chosen at the end
    const held = (name) => Object.entries(state.inventory ?? {}).find(([title]) => title.startsWith(name))?.[1] ?? 0;
    for (const [name, count] of Object.entries(e.inventar ?? {}))
        if (held(name) !== count) fail.push(`inventar: ${held(name)}× „${name}“ statt ${count}× (${JSON.stringify(state.inventory)})`);
    if (e.waffe !== undefined && !(state.weapons ?? []).some(title => title.startsWith(e.waffe)))
        fail.push(`waffe: [${(state.weapons ?? []).join(', ')}] statt „${e.waffe}“`);
    if (e.energie_unter !== undefined && !(state.energy < e.energie_unter))
        fail.push(`energie: ${state.energy}, erwartet weniger als ${e.energie_unter}`);
    if (e.lebt !== undefined && state.player && state.player.dead === e.lebt) fail.push(`Figur lebt: ${!state.player.dead}`);
    // Enemy behaviours: some enemy must have gone through these modes, shown
    // the "!", moved at least so far sideways (weg) or up and down (hub).
    const foes = state.baddies;
    const seen_modes = [...new Set(foes.flatMap(b => b.modes ?? []))];
    for (const mode of e.gegner_modi ?? [])
        if (!seen_modes.includes(mode)) fail.push(`Kein Gegner war im Modus "${mode}" (${seen_modes.join(', ') || 'keine'})`);
    const alerted = foes.some(b => b.alert);
    if (e.gegner_ausrufezeichen !== undefined && alerted !== e.gegner_ausrufezeichen)
        fail.push(`Ausrufezeichen: ${alerted} statt ${e.gegner_ausrufezeichen}`);
    const weg = Math.max(0, ...foes.map(b => b.weg ?? 0)), hub = Math.max(0, ...foes.map(b => b.hub ?? 0));
    if (e.gegner_weg !== undefined && !(weg >= e.gegner_weg))
        fail.push(`Gegner sind nur ${weg.toFixed(0)} px zur Seite gekommen, erwartet ${e.gegner_weg}`);
    if (e.gegner_hub !== undefined && !(hub >= e.gegner_hub))
        fail.push(`Gegner sind nur ${hub.toFixed(0)} px auf und ab gekommen, erwartet ${e.gegner_hub}`);
    fail.push(...check_companions(e, state.companions ?? []));
    // Bewegte Plattformen (platforms.js): some platform went at least so far (px),
    // the player rode at least so far on platforms (px), some platform had to wait
    const platforms = state.platforms ?? [];
    const weg_max = Math.max(0, ...platforms.map(p => p.weg));
    if (e.plattform_weg !== undefined && !(weg_max >= e.plattform_weg))
        fail.push(`Plattformen sind nur ${weg_max.toFixed(0)} px gefahren, erwartet ${e.plattform_weg}`);
    const ridden = platforms.reduce((sum, p) => sum + p.mitgefahren, 0);
    if (e.figur_mitgefahren !== undefined && !(ridden >= e.figur_mitgefahren))
        fail.push(`Figur ist nur ${ridden.toFixed(0)} px mitgefahren, erwartet ${e.figur_mitgefahren}`);
    const waited = platforms.some(p => p.gewartet > 0);
    if (e.plattform_wartet !== undefined && waited !== e.plattform_wartet)
        fail.push(`Plattform hat gewartet: ${waited} statt ${e.plattform_wartet}`);
    return fail;
}

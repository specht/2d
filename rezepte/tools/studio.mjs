// The real studio (src/static/studio.html) in headless Chromium, for the
// Erste-Schritte guides (anleitung.mjs). Nothing of the studio is changed:
// its files are served from src/static, the server's API is stubbed here
// (a test run saves a temporary game like /api/save_game_temp, and the game
// frame loads it with its sprite sheet like the server renders it).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.eot': 'application/vnd.ms-fontobject',
    '.fs': 'text/plain', '.vs': 'text/plain', '.txt': 'text/plain',
};

export const HOST = 'studio.local';
// Chromium draws the same pixels every time: one raster thread, whole tiles,
// software raster, a fixed colour profile and text without hinting (with
// several threads or partial tiles, an edge here and there came out a shade
// different from run to run – and the film files with it)
export const BROWSER_ARGS = ['--num-raster-threads=1', '--disable-partial-raster', '--disable-gpu-rasterization',
    '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--disable-threaded-animation',
    '--disable-threaded-scrolling', '--disable-checker-imaging'];
// what a save shows (src/static/noto/<icon>.png) and when it happened: fixed,
// so the same guide always looks the same
const SAVE_ICON = '114g99w';
const SAVE_TIME = Date.UTC(2026, 9, 5, 8, 0, 0);


// Packs frames like the server (Main.render_spritesheet_for_tag): a replicated
// 1 px border around every frame, rows of the tallest frames first, then 4×.
// The same layout as build_spritesheet in game.mjs (kept apart: game.mjs is
// part of the recipes' fingerprint).
const SHEET_WIDTH = 1024, SHEET_FACTOR = 4;
async function build_spritesheet(frames_by_state, sprites) {
    const items = [];
    let state_i = 0;
    for (let si = 0; si < sprites.length; si++)
        for (let sti = 0; sti < sprites[si].states.length; sti++, state_i++)
            frames_by_state[state_i].forEach((frame, fi) => items.push({ si, sti, fi, frame }));
    const order = [...items].sort((a, b) => b.frame.h - a.frame.h);
    let x = 0, y = 0, row_h = 0;
    for (const it of order) {
        const cw = it.frame.w + 2, ch = it.frame.h + 2;
        if (x + cw > SHEET_WIDTH) { x = 0; y += row_h; row_h = 0; }
        it.x = x; it.y = y;
        x += cw; row_h = Math.max(row_h, ch);
    }
    const height = Math.max(1, y + row_h);
    const sheet = Buffer.alloc(SHEET_WIDTH * height * 4);
    const tiles = sprites.map(sp => sp.states.map(() => []));
    for (const it of items) {
        const { w, h, raw } = it.frame;
        for (let yy = -1; yy <= h; yy++) for (let xx = -1; xx <= w; xx++) {
            const sx = Math.min(w - 1, Math.max(0, xx)), sy = Math.min(h - 1, Math.max(0, yy));
            raw.copy(sheet, ((it.y + 1 + yy) * SHEET_WIDTH + it.x + 1 + xx) * 4, (sy * w + sx) * 4, (sy * w + sx) * 4 + 4);
        }
        tiles[it.si][it.sti][it.fi] = [0, (it.x + 1) * SHEET_FACTOR, (it.y + 1) * SHEET_FACTOR];
    }
    const png = await sharp(sheet, { raw: { width: SHEET_WIDTH, height, channels: 4 } })
        .resize(SHEET_WIDTH * SHEET_FACTOR, height * SHEET_FACTOR, { kernel: 'nearest' })
        .png({ compressionLevel: 3 }).toBuffer();
    const name = crypto.createHash('sha1').update(png).digest('hex').slice(0, 16) + '.png';
    return { png, name, info: { spritesheets: [name], tiles, width: SHEET_WIDTH * SHEET_FACTOR, height: height * SHEET_FACTOR } };
}

// A temporary game as the server keeps it: the JSON with frame tags, the
// frames' pictures and a sprite sheet laid out like Main.render_spritesheet_for_tag.
async function temp_game(data) {
    const game = JSON.parse(JSON.stringify(data));
    const pngs = new Map();
    const frames_by_state = [];
    for (const sprite of game.sprites ?? [])
        for (const state of sprite.states ?? []) {
            const frames = [];
            for (const frame of state.frames ?? []) {
                const src = String(frame.src ?? '');
                const png = Buffer.from(src.replace(/^data:image\/png;base64,/, ''), 'base64');
                const tag = crypto.createHash('sha1').update(png).digest('hex').slice(0, 16);
                const { data: raw, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
                pngs.set(tag, png);
                frames.push({ w: info.width, h: info.height, raw, tag });
                frame.tag = tag;
                delete frame.src;
            }
            frames_by_state.push(frames);
        }
    const sheet = await build_spritesheet(frames_by_state, game.sprites ?? []);
    const tag = 'an' + crypto.createHash('sha1').update(JSON.stringify(game)).digest('hex').slice(0, 6);
    return { tag, game, sheet, pngs };
}

// Serves the studio at http://studio.local/. Returns the page and a list of
// JavaScript errors (a guide whose steps cause one fails the build).
export async function open_studio(browser, repo, { width = 1600, height = 900 } = {}) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'de-DE' });
    const page = await context.newPage();
    const errors = [];
    // Known and harmless: Game._load (game.js) asks the game frame for the
    // parent version even when it is null (a recipe scene, a new game), and
    // the frame's fetch of /gen/games/null.json fails. Not counted as a fault
    // of the guide.
    let null_loads = 0;
    page.on('pageerror', e => {
        if (null_loads > 0 && /Unexpected end of JSON input/.test(e.message)) { null_loads--; return; }
        errors.push(`${e.message} (${String(e.stack ?? '').split('\n').find(l => l.includes('studio.local'))?.trim() ?? ''})`);
    });
    const root = path.join(repo, 'src/static');
    const temp = new Map();
    // the saved versions of this run, like the server's GameIndex: every
    // version knows the one it was loaded from (parent)
    const saved = new Map();
    const originals = new Map();
    const root_of = (tag) => {
        const seen = new Set();
        while (saved.get(tag)?.parent && !seen.has(tag)) { seen.add(tag); tag = saved.get(tag).parent; }
        return tag;
    };
    const family_of = (tag) => {
        const root = root_of(tag);
        return [...saved.values()].filter(n => root_of(n.tag) === root);
    };
    const tips = () => {
        const roots = [...new Set([...saved.keys()].map(root_of))];
        return roots.map(root => {
            const family = family_of(root);
            const leaves = family.filter(n => !family.some(c => c.parent === n.tag));
            const tip = leaves.sort((a, b) => b.ts_created - a.ts_created)[0];
            const others = [...new Set(family.flatMap(n => [n.title, n.author]).filter(Boolean))]
                .filter(x => x !== tip.title && x !== tip.author);
            return { ...tip, relatives_count: family.length, ...(others.length ? { others } : {}) };
        }).sort((a, b) => b.ts_created - a.ts_created);
    };
    // requests still being answered (the film waits for them before a frame)
    const pending = new Set();
    const handler = async route => {
        const entry = { url: route.request().url() };
        pending.add(entry);
        try { return await answer(route); } finally { pending.delete(entry); }
    };
    const answer = async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname !== HOST) return route.abort();
        const p = decodeURIComponent(url.pathname);
        const reply = (body, type = MIME['.json']) => route.fulfill({ status: 200, body, contentType: type });
        if (p.startsWith('/api/')) {
            if (process.env.ANLEITUNG_DEBUG) console.log(`api ${p}`);
            if (p === '/api/save_game_temp') {
                const t = await temp_game(JSON.parse(request.postData() ?? '{}').game ?? {});
                temp.set(t.tag, t);
                return reply(JSON.stringify({ tag: t.tag }));
            }
            // Saving: the game gets a code like on the server, and Laden lists
            // exactly what was saved in this run (nothing made up)
            if (p === '/api/save_game') {
                const game = JSON.parse(request.postData() ?? '{}').game ?? {};
                const tag = crypto.createHash('sha1').update(JSON.stringify(game)).digest('hex').replace(/[^a-z0-9]/g, '').slice(0, 7);
                if (!originals.has(tag)) originals.set(tag, game);
                // the game frame loads the saved version, too (Game._load)
                const t = await temp_game(game);
                temp.set(tag, { ...t, tag });
                const states = (game.sprites ?? []).flatMap(sp => sp.states ?? []);
                // saved again unchanged: the same version (it keeps its time)
                if (!saved.has(tag)) saved.set(tag, {
                    tag, parent: saved.has(game.parent) ? game.parent : null,
                    icon: SAVE_ICON, author: game.properties?.author ?? '', title: game.properties?.title ?? '',
                    ts_created: Math.floor(SAVE_TIME / 1000) + saved.size * 60, size: JSON.stringify(game).length,
                    sprite_count: (game.sprites ?? []).length, state_count: states.length,
                    frame_count: states.reduce((n, st) => n + (st.frames ?? []).length, 0),
                });
                return reply(JSON.stringify({ tag, icon: SAVE_ICON }));
            }
            if (p === '/api/load_game') {
                const tag = JSON.parse(request.postData() ?? '{}').tag;
                if (!originals.has(tag)) return route.fulfill({ status: 404, body: '{}', contentType: MIME['.json'] });
                return reply(JSON.stringify({ game: { ...originals.get(tag), parent: tag } }));
            }
            if (p.startsWith('/api/get_games')) return reply(JSON.stringify({ nodes: tips() }));
            if (p === '/api/family') {
                const tag = JSON.parse(request.postData() ?? '{}').tag;
                const nodes = saved.has(tag) ? family_of(tag).sort((a, b) => a.ts_created - b.ts_created) : [];
                return reply(JSON.stringify({ tag, nodes }));
            }
            if (p === '/api/game_info') {
                const tag = JSON.parse(request.postData() ?? '{}').tag;
                const node = saved.get(tag);
                return reply(JSON.stringify({ tag, exists: !!node, node: node ? { ...node, relatives_count: family_of(tag).length } : null }));
            }
            // the server is there (server_watch.js), playtesting is off
            if (p === '/api/ping') return reply(JSON.stringify({ pong: true, version: null, playtest: false }));
            // nothing else is needed for the guides: no saved games, no server
            return reply('{}');
        }
        let m;
        if ((m = p.match(/^\/gen\/games\/(\w+)\.json$/)) && temp.has(m[1])) return reply(JSON.stringify(temp.get(m[1]).game));
        if ((m = p.match(/^\/gen\/spritesheets\/(\w+)\.json$/)) && temp.has(m[1])) return reply(JSON.stringify(temp.get(m[1]).sheet.info));
        if ((m = p.match(/^\/gen\/spritesheets\/(\w+\.png)$/))) {
            for (const t of temp.values()) if (t.sheet.name === m[1]) return reply(t.sheet.png, MIME['.png']);
        }
        if (p === '/gen/games/null.json') { null_loads++; return route.fulfill({ status: 404, body: '' }); }
        let file = path.join(root, p === '/' ? 'studio.html' : p);
        if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            if (process.env.ANLEITUNG_DEBUG) console.log(`404 ${p}`);
            return route.fulfill({ status: 404, body: '' });
        }
        let body = fs.readFileSync(file);
        // the server's template placeholders (#{@@cache_buster}, #{DEVELOPMENT …})
        if (file.endsWith('.html')) body = body.toString().replace(/#\{[^}]*\}/g, '');
        return reply(body, MIME[path.extname(file)] ?? 'application/octet-stream');
    };
    await context.route('**/*', handler);
    await page.addInitScript(() => {
        // the same randomness every time (new IDs, Phase Zufall …)
        let s = 0x2d2d2d;
        Math.random = () => {
            s |= 0; s = s + 0x6D2B79F5 | 0;
            let t = Math.imul(s ^ s >>> 15, 1 | s);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
        // IDs come from crypto (game_ids.js): the same ones every time, too
        if (globalThis.crypto) {
            crypto.getRandomValues = (array) => {
                const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
                for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
                return array;
            };
            crypto.randomUUID = () => {
                const b = crypto.getRandomValues(new Uint8Array(16));
                b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
                const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
                return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
            };
        }
    });
    // The guide clock: in the studio and in the game frame, time passes only
    // when the recorder moves it on (pass_time below, anleitung.mjs) – from
    // the first line of the page on, never by itself. performance.now, Date,
    // requestAnimationFrame, setTimeout, setInterval and the CSS transitions
    // and animations (paused and stepped by hand) all follow it. So a guide
    // does the same thing in every run, however fast the computer or a
    // screenshot is: the same steps give the same films, byte for byte (git
    // sees no change when nothing changed), and a game runs on film as fast
    // as in real life, every jump included.
    await page.addInitScript((epoch) => {
        const real = {
            setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
            raf: window.requestAnimationFrame.bind(window),
        };
        let virtual = 0;
        const now = () => virtual;
        // the date is the same in every run, too
        const RealDate = Date;
        class GuideDate extends RealDate {
            constructor(...args) { if (args.length) super(...args); else super(GuideDate.now()); }
            static now() { return Math.round(epoch + virtual); }
        }
        window.Date = GuideDate;
        performance.now = now;
        // what the page is still loading (requests, pictures): time moves on
        // only when it is all there, so an answer never arrives a step earlier
        // or later from one run to the next
        let loading = 0;
        const send = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function (...args) {
            loading++;
            this.addEventListener('loadend', () => { loading--; }, { once: true });
            return send.apply(this, args);
        };
        const real_fetch = window.fetch.bind(window);
        window.fetch = (...args) => {
            loading++;
            return real_fetch(...args).then(async (response) => {
                // the body is read later: keep it, so reading it is part of the request
                const body = await response.clone().arrayBuffer().catch(() => null);
                loading--;
                return body === null ? response : new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
            }, (e) => { loading--; throw e; });
        };
        const image_src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
        const images_loading = new WeakSet();
        Object.defineProperty(HTMLImageElement.prototype, 'src', {
            configurable: true, enumerable: image_src.enumerable,
            get() { return image_src.get.call(this); },
            set(value) {
                if (!images_loading.has(this)) {
                    images_loading.add(this);
                    loading++;
                    const finish = () => {
                        this.removeEventListener('load', finish);
                        this.removeEventListener('error', finish);
                        images_loading.delete(this);
                        loading--;
                    };
                    this.addEventListener('load', finish);
                    this.addEventListener('error', finish);
                }
                image_src.set.call(this, value);
            },
        });
        // requestAnimationFrame: the callbacks run when the clock says (drawn),
        // not with the screen's own frames – so code that looks at another
        // frame of the page (the Signale watch reads the game) always sees the
        // same moment
        const frame_callbacks = new Map();
        let frame_id = 0;
        window.requestAnimationFrame = (callback) => { frame_callbacks.set(++frame_id, callback); return frame_id; };
        window.cancelAnimationFrame = (id) => { frame_callbacks.delete(id); };
        const run_frame_callbacks = () => {
            const due = [...frame_callbacks.values()];
            frame_callbacks.clear();
            for (const callback of due) {
                try { callback(virtual); } catch (e) { real.setTimeout(() => { throw e; }); }
            }
        };
        const timers = new Map();       // id → { due, fn, args, every, seq }
        let seq = 0;
        const add_timer = (fn, ms, args, every) => {
            const id = ++seq;
            const delay = Math.max(0, Number(ms) || 0);
            timers.set(id, { id, due: virtual + delay, fn: typeof fn === 'function' ? fn : () => {}, args, every: every ? Math.max(4, delay) : 0, seq });
            return id;
        };
        window.setTimeout = (fn, ms, ...args) => add_timer(fn, ms, args, false);
        window.setInterval = (fn, ms, ...args) => add_timer(fn, ms, args, true);
        window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
        // the text cursor blinks on the real clock (the browser's own): it is
        // left out of the films
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = '*, *::before, *::after { caret-color: transparent !important; }';
            document.head.appendChild(style);
        });
        const animations = new WeakSet();   // CSS animations under the clock
        const step_animations = (ms) => {
            for (const a of document.getAnimations?.() ?? []) {
                try {
                    // a new one starts now (it may have run a few real ms already)
                    if (!animations.has(a)) { animations.add(a); a.pause(); a.currentTime = 0; }
                    if (ms) a.currentTime = (a.currentTime ?? 0) + ms;
                } catch (e) { /* finished or removed */ }
            }
        };
        // caught as soon as the browser starts one (a short transition could
        // otherwise be over before the next step looks)
        window.addEventListener('transitionrun', () => step_animations(0), true);
        window.addEventListener('animationstart', () => step_animations(0), true);
        window.__guide_time = {
            now,
            loading: () => {
                if (loading > 0 || document.readyState !== 'complete') return true;
                // pictures from the page's HTML: a lazy one loads now (when it would
                // load depends on the screen's frames), and each must be there
                let waiting = false;
                for (const image of document.images) {
                    if (image.loading === 'lazy') image.loading = 'eager';
                    if (image.getAttribute('src') && !image.complete) waiting = true;
                }
                return waiting;
            },
            // the page has drawn what the time shows: one real frame, so every
            // requestAnimationFrame callback has seen the new time (a hidden
            // frame does not draw, there is nothing to wait for)
            drawn: () => new Promise((resolve) => {
                // what started since the last step (a class changed by a key or
                // a click) waits for the clock, too
                step_animations(0);
                let hidden = false;
                try { hidden = !!window.frameElement && window.frameElement.getClientRects().length === 0; } catch (e) { /* other origin */ }
                // a hidden frame gets no frames (like in a browser)
                if (hidden || document.hidden) { resolve(); return; }
                run_frame_callbacks();
                // what they started waits for the clock, too
                step_animations(0);
                real.raf(() => resolve());
            }),
            // one step of the clock and the frame drawn with it; says whether a
            // game runs here (then the steps are short: a game moves in small ones)
            async step(ms) {
                this.advance(ms);
                await this.drawn();
                return window.game?.running === true;
            },
            // time moves on by ms: the timers due until then run in order
            advance(ms) {
                const end = virtual + ms;
                for (let guard = 0; guard < 100000; guard++) {
                    let next = null;
                    for (const t of timers.values())
                        if (t.due <= end && (!next || t.due < next.due || (t.due === next.due && t.seq < next.seq))) next = t;
                    if (!next) break;
                    virtual = Math.max(virtual, next.due);
                    if (next.every) { next.due += next.every; next.seq = ++seq; } else timers.delete(next.id);
                    try { next.fn(...next.args); } catch (e) { real.setTimeout(() => { throw e; }); }
                }
                virtual = end;
                step_animations(ms);
            },
        };
    }, SAVE_TIME);
    page.guide_pending = () => pending.size;
    page.guide_pending_urls = () => [...pending].map(e => e.url);
    await page.goto(`http://${HOST}/`);
    // the studio sets itself up (its timers run as the clock moves on)
    for (let waited = 0; ; waited += 100) {
        await pass_time(page, 100);
        const ready = await page.evaluate(() => !!(window.game && typeof menus !== 'undefined' && menus.level && menus.sprites && $('#status-bar').children().length > 0));
        if (ready) break;
        if (waited > 30000) throw new Error('Das Studio startet nicht');
    }
    await pass_time(page, 500);
    return { context, page, errors };
}

// Moves the guide clock on by ms (studio.mjs init script): while a game runs,
// in steps of two 60 Hz frames (it moves in small steps, as on a screen),
// otherwise at once. After each step every frame of the page has drawn once
// and every request is answered, so the page does the same in every run.
export const CLOCK_STEP_MS = 1000 / 30;
export async function pass_time(page, ms) {
    await answered(page);
    for (let left = ms; left > 0.01;) {
        const step = page.guide_game_running ? Math.min(CLOCK_STEP_MS, left) : left;
        left -= step;
        let running = false;
        for (const f of page.frames()) {
            try { running = (await f.evaluate((m) => window.__guide_time?.step(m), step)) || running; } catch (e) { /* a frame going away */ }
        }
        page.guide_game_running = running;
        // a request was answered: the page handles the answer before time moves on
        if (await answered(page)) await drawn(page);
    }
}

async function drawn(page) {
    for (const f of page.frames()) {
        try { await f.evaluate(() => window.__guide_time?.drawn()); } catch (e) { /* a frame going away */ }
    }
}

// every request answered (they are served by this harness) and every frame
// of the page done with what it loads – twice in a row, a moment apart, so
// a request that an answer starts is caught, too
async function answered(page) {
    let waited = false, quiet = 0;
    for (let i = 0; i < 400 && quiet < 2; i++) {
        let busy = (page.guide_pending?.() ?? 0) > 0;
        for (const f of busy ? [] : page.frames()) {
            try { if (await f.evaluate(() => window.__guide_time?.loading() ?? false)) { busy = true; break; } } catch (e) { /* a frame going away */ }
        }
        if (busy) { waited = true; quiet = 0; } else quiet++;
        if (busy || quiet < 2) await new Promise(r => setTimeout(r, busy ? 10 : 2));
    }
    if (process.env.ANLEITUNG_DEBUG && page.guide_pending?.() > 0) console.log('   still pending', page.guide_pending_urls());
    return waited;
}

// the requests answered, every frame drawn
export async function settle(page) {
    await answered(page);
    await drawn(page);
}

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
// what a save shows (src/static/noto/<icon>.png) and when it happened: fixed,
// so the same guide always looks the same
const SAVE_ICON = '114g99w';
const SAVE_TIME = Date.UTC(2026, 9, 5, 8, 0, 0);

const BAND_HTML = `<!doctype html><html><head><meta charset="utf-8"><link href="/fonts.css" rel="stylesheet">
<style>
html, body { margin: 0; background: transparent; }
#band { box-sizing: border-box; height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 14px;
    background: #1a1c2c; border-bottom: 2px solid #3b5dc9; color: #f4f4f4; font: 600 19px 'IBM Plex Sans', sans-serif; white-space: nowrap; overflow: hidden; }
#band .nr { flex: none; min-width: 28px; height: 28px; line-height: 28px; border-radius: 14px; background: #ffcd75; color: #1a1c2c; text-align: center; font-weight: 700; }
#band .text { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; }
#band .keys { flex: none; display: flex; align-items: center; gap: 6px; color: #ffcd75; font-size: 17px; }
#band .cap { min-width: 18px; padding: 2px 9px; text-align: center; border-radius: 6px; background: #222; color: #fff;
    font: 700 16px 'IBM Plex Mono', monospace; border: 1px solid rgba(255,255,255,0.25); border-bottom-width: 3px; }
#band .maus { font-weight: 600; color: #73eff7; }
</style></head><body><div id="band"></div></body></html>`;

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
    const saved = [];
    const originals = new Map();
    const handler = async route => {
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
                originals.set(tag, game);
                // the game frame loads the saved version, too (Game._load)
                const t = await temp_game(game);
                temp.set(tag, { ...t, tag });
                const states = (game.sprites ?? []).flatMap(sp => sp.states ?? []);
                saved.push({
                    tag, icon: SAVE_ICON, author: game.properties?.author ?? '', title: game.properties?.title ?? '',
                    ts_created: Math.floor(SAVE_TIME / 1000) + saved.length * 60, size: JSON.stringify(game).length,
                    sprite_count: (game.sprites ?? []).length, state_count: states.length,
                    frame_count: states.reduce((n, st) => n + (st.frames ?? []).length, 0), relatives_count: 0,
                });
                return reply(JSON.stringify({ tag, icon: SAVE_ICON }));
            }
            if (p === '/api/load_game') {
                const tag = JSON.parse(request.postData() ?? '{}').tag;
                if (!originals.has(tag)) return route.fulfill({ status: 404, body: '{}', contentType: MIME['.json'] });
                return reply(JSON.stringify({ game: { ...originals.get(tag), parent: tag } }));
            }
            if (p.startsWith('/api/get_games')) return reply(JSON.stringify({ nodes: [...saved].reverse() }));
            // the server is there (server_watch.js), playtesting is off
            if (p === '/api/ping') return reply(JSON.stringify({ pong: true, version: null, playtest: false }));
            // nothing else is needed for the guides: no saved games, no server
            return reply('{}');
        }
        // the caption band above a guide's videos (anleitung.mjs), in the studio's fonts
        if (p === '/__anleitung_band.html') return reply(BAND_HTML, MIME['.html']);
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
    });
    await page.goto(`http://${HOST}/`);
    await page.waitForFunction(() => window.game && typeof menus !== 'undefined' && menus.level && menus.sprites && $('#status-bar').children().length > 0, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    return { context, page, errors };
}

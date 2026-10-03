#!/usr/bin/env node
// Builds src/static/rezepte/: one animated WebP per recipe (recorded from the
// real engine), the catalogue sprites at native size and rezepte.json for the
// help tab. File URLs carry a content hash (cache busting).
//
//   node build.mjs            build everything
//   node build.mjs leiter     build only the named recipe(s)
//   node build.mjs --check    record and check, but write nothing
//   node build.mjs --force    record everything again, even unchanged recipes
//
// Like make: a recipe is only recorded again when something it depends on has
// changed – its scene and settings, the sprites it uses, or the engine files
// the player loads. The fingerprint (`quelle` in rezepte.json) is made from
// the contents, not the timestamps, so a git checkout does not rebuild it all.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';
import sharp from 'sharp';
import { load_catalog, load_strip, build_game, studio_game_file, TILE } from './game.mjs';
import { launch, record, write_webp, write_gif, check, key_events } from './record.mjs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const controls = createRequire(import.meta.url)('../../src/static/controls.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');            // rezepte/
const repo = path.resolve(root, '..');
const out_dir = path.join(repo, 'src/static/rezepte');
const args = process.argv.slice(2);
const check_only = args.includes('--check');
const only = args.filter(a => !a.startsWith('--'));
const force = args.includes('--force');

// Everything of the engine that can change a recording: the scripts
// standalone.html loads, the shaders, the files game.mjs runs, and the tools.
let engine_hash_cache = null;
function engine_hash() {
    if (engine_hash_cache) return engine_hash_cache;
    const static_dir = path.join(repo, 'src/static');
    const html = fs.readFileSync(path.join(static_dir, 'standalone.html'), 'utf8');
    const scripts = [...html.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]).filter(f => !/^https?:/.test(f));
    const files = [...new Set([
        'standalone.html', ...scripts, 'traits.js', 'baddie_ai.js', 'game_ids.js', 'game.js',
        ...fs.readdirSync(path.join(static_dir, 'shaders')).map(f => `shaders/${f}`),
    ])].map(f => path.join(static_dir, f));
    files.push(...['build.mjs', 'record.mjs', 'game.mjs'].map(f => path.join(here, f)));
    const h = crypto.createHash('sha1');
    for (const f of files.sort()) h.update(f).update(fs.existsSync(f) ? fs.readFileSync(f) : '');
    h.update(process.env.REZEPT_FORMAT ?? '');
    engine_hash_cache = h.digest('hex');
    return engine_hash_cache;
}

// Fingerprint of one recording: the recipe settings (not its text), the built
// games (scene, sprites and sprite sheets) and the engine.
function fingerprint(recipe, games) {
    const { body, ...meta } = recipe;
    const h = crypto.createHash('sha1').update(engine_hash()).update(JSON.stringify(meta));
    for (const g of games) {
        h.update(JSON.stringify(g.data)).update(JSON.stringify(g.sheet.info)).update(g.sheet.png)
            .update(JSON.stringify(g.view)).update(String(g.screen_pixel_height));
    }
    return h.digest('hex').slice(0, 16);
}

const KATEGORIEN = ['Loslegen', 'Figuren animieren', 'Welt bauen', 'Level gestalten', 'Türen & Schlüssel', 'Signale', 'Kampf', 'Gegner', 'Begleiter', 'Wasser & Weltall'];

function read_recipe(file) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${path.basename(file)}: YAML-Kopf (--- … ---) fehlt`);
    const meta = YAML.parse(m[1]);
    meta.id ??= path.basename(file, '.md').replace(/^\d+-/, '');
    meta.body = m[2];
    for (const key of ['titel', 'kategorie', 'kurz'])
        if (!meta[key]) throw new Error(`${meta.id}: "${key}" fehlt`);
    if (!KATEGORIEN.includes(meta.kategorie))
        throw new Error(`${meta.id}: unbekannte Kategorie "${meta.kategorie}" (${KATEGORIEN.join(', ')})`);
    return meta;
}

// Short content hash for cache busting: /rezepte/leiter.webp?3f9a0c1b2d
function content_hash(buffer) {
    return crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
}

// Every file the build writes (relative to out_dir): a full build removes the rest.
const written = new Set();
function write_output(rel, buffer) {
    written.add(rel);
    if (check_only) return content_hash(buffer);
    const file = path.join(out_dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    return content_hash(buffer);
}

// A sprite from the catalogue at its real size, with real transparency: whoever
// copies or saves it gets exactly the pixels to paste into the sprite editor.
// Animations: one animated WebP plus every frame as its own PNG. Scaling, the
// checkerboard and the dashed outline are CSS only (see styles.css).
let catalog_for_strips = null;
async function catalogue_images(strip, fps) {
    const name = strip.replace('/', '_');
    // Big sprites (groesse: [w, h]) are cut with their own frame size.
    const owner = Object.values(catalog_for_strips?.sprites ?? {}).find(sp => sp.states.some(st => st.strip === strip));
    const [fw, fh] = owner?.groesse ?? [TILE, TILE];
    const frames = await load_strip(root, strip, fw, fh);
    const pngs = await Promise.all(frames.map(f =>
        sharp(f.raw, { raw: { width: fw, height: fh, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer()));
    const result = { w: fw, h: fh, frames: [], anzahl: frames.length,
        // glowing sprites (Mischmodus Leuchten) are shown on a dark background
        dunkel: owner?.mischmodus === 'add' || owner?.mischmodus === 'screen' };
    if (frames.length === 1) {
        result.bild = `katalog/${name}.png`;
        result.version = write_output(result.bild, pngs[0]);
    } else {
        const delay = Math.round(1000 / (fps ?? 8));
        const webp = await sharp(pngs, { join: { animated: true } })
            .webp({ lossless: true, effort: 6, loop: 0, delay: pngs.map(() => delay) }).toBuffer();
        result.bild = `katalog/${name}.webp`;
        result.version = write_output(result.bild, webp);
        pngs.forEach((png, i) => {
            const rel = `katalog/${name}_${i + 1}.png`;
            result.frames.push({ bild: rel, version: write_output(rel, png) });
        });
    }
    return result;
}

// Markdown with two small extensions:
//   ![Laufen](katalog:pip/laufen 10)   animation from the catalogue (fps optional)
//   > **Tipp:** … / > **Achtung:** …    styled hint boxes
async function render_body(md, id, scenes = []) {
    // ![Nyx8: Nacht](variante:2) – the recording (0) or a variant (1, 2 …) as a
    // picture of its own in the text, for recipes with `einzelbilder: true`
    for (const [all, label, n] of [...md.matchAll(/!\[([^\]]*)\]\(variante:(\d+)\)/g)]) {
        const b = scenes[Number(n)];
        if (!b) throw new Error(`${id}: variante:${n} gibt es nicht (einzelbilder: true und genug varianten?)`);
        md = md.replace(all, `<figure class="rezept-szene"><img src="/rezepte/${b.bild}?${b.version}" width="${b.breite}" height="${b.hoehe}" ` +
            `loading="lazy" decoding="async" alt="${label}"><figcaption>${label}</figcaption></figure>`);
    }
    const refs = [...md.matchAll(/!\[([^\]]*)\]\(katalog:([^\s)]+)(?:\s+(\d+))?\)/g)];
    for (const [all, label, strip, fps] of refs) {
        const c = await catalogue_images(strip, fps ? Number(fps) : undefined);
        // shown 4× (big sprites 2×); the frames below at half that size
        const S = c.w > TILE || c.h > TILE ? 2 : 4;
        const img = (src, version, scale, cls, alt) =>
            `<img class="pixel${cls}" loading="lazy" decoding="async" src="/rezepte/${src}?${version}" width="${c.w * scale}" height="${c.h * scale}" ` +
            `style="--pixel: ${scale}px" alt="${alt}">`;
        const html = `<figure class="rezept-katalog${c.dunkel ? ' dunkel' : ''}">` + img(c.bild, c.version, S, '', label) +
            (c.frames.length ? `<span class="bilder">${c.frames.map((f, i) =>
                img(f.bild, f.version, S / 2, ' bild', `${label}, Bild ${i + 1}`)).join('')}</span>` : '') +
            `<figcaption>${label} · ${c.anzahl} ${c.anzahl === 1 ? 'Bild' : 'Bilder'}</figcaption></figure>`;
        md = md.replace(all, html);
    }
    let html = marked.parse(md);
    html = html.replace(/<blockquote>\s*<p><strong>(Tipp|Achtung|Profi-Tipp):<\/strong>/g,
        (_, kind) => `<blockquote class="rezept-${kind === 'Achtung' ? 'achtung' : 'tipp'}"><p><strong>${kind}:</strong>`);
    return html;
}

// karte_unten: 1 – the gallery card leaves out this many map rows at the
// bottom (and shows more at the top), for tall scenes whose interesting part is
// up high. Stored as a share of the recording's height; the recipe itself
// always shows the whole recording.
function card_crop(recipe, height) {
    const rows = Number(recipe.karte_unten);
    if (!(rows > 0) || !(height > 0)) return {};
    return { karte_unten: Math.min(0.5, rows * 24 * (recipe.skala ?? 3) / height) };
}

// The still frame of a recording: `standbild: 2.5` picks the moment in seconds, else 60 %.
function still_frame(frames, recipe) {
    const steps = recipe.schritte ?? 1;
    return frames[Math.max(0, Math.min(frames.length - 1, recipe.standbild !== undefined ?
        Math.round(Number(recipe.standbild) * 60 / steps) : Math.floor(frames.length * 0.6)))];
}

// A short recording of its own (einzelbilder): WebP, or GIF with `format: gif`.
async function write_clip(rel, frames, recipe, ext) {
    const tmp = path.join(here, `.${path.basename(rel)}`);
    if (ext === 'gif') await write_gif(frames, tmp, recipe.farben ?? 128, recipe.schritte ?? 1, recipe.toleranz ?? 0);
    else await write_webp(frames, tmp, recipe.schritte ?? 1);
    const version = write_output(rel, fs.readFileSync(tmp));
    fs.rmSync(tmp, { force: true });
    return { bild: rel, version, breite: frames[0].w, hoehe: frames[0].h };
}

async function write_still(rel, f) {
    const version = write_output(rel, await sharp(f.data, { raw: { width: f.w, height: f.h, channels: 4 } })
        .webp({ lossless: true, effort: 6 }).toBuffer());
    return { bild: rel, version, breite: f.w, hoehe: f.h };
}

// raster: the recording and its variants side by side, `columns` per row, all
// playing at once (so the moods can be compared), with a thin dark gap.
function grid_frames(parts, columns, scale) {
    const { w, h } = parts[0][0];
    const cols = Math.max(1, Math.min(parts.length, Math.round(columns)));
    const rows = Math.ceil(parts.length / cols);
    const gap = 2 * scale;
    const W = cols * w + (cols - 1) * gap, H = rows * h + (rows - 1) * gap;
    const n = Math.min(...parts.map(p => p.length));
    const out = [];
    for (let i = 0; i < n; i++) {
        const data = Buffer.alloc(W * H * 4);
        for (let p = 0; p < data.length; p += 4) { data[p] = 0x1a; data[p + 1] = 0x1c; data[p + 2] = 0x2c; data[p + 3] = 255; }
        parts.forEach((part, k) => {
            const f = part[i], x0 = (k % cols) * (w + gap), y0 = Math.floor(k / cols) * (h + gap);
            for (let y = 0; y < h; y++) f.data.copy(data, ((y0 + y) * W + x0) * 4, y * w * 4, (y + 1) * w * 4);
        });
        out.push({ ...parts[0][i], w: W, h: H, data });
    }
    return out;
}

// "ohne": the same scene without decoration/supports, recorded with the same
// input. Left of Pip the finished world is shown, right of him the bare one, so
// the world changes where he walks. A narrow dithered seam hides the edge.
function reveal_frames(plain, full) {
    return full.map((f, i) => {
        const p = plain[i] ?? plain[plain.length - 1];
        const data = Buffer.from(p.data);
        const edge = f.player_x ?? 0;
        for (let y = 0; y < f.h; y++)
            for (let x = 0; x < f.w; x++) {
                const d = edge - x;
                const take = d > 3 || (d > -4 && (x + y) % 2 === 0);
                if (take) f.data.copy(data, (y * f.w + x) * 4, (y * f.w + x) * 4, (y * f.w + x) * 4 + 4);
            }
        return { ...f, data };
    });
}

// tasten_zeigen: keycaps of the keys held down, bottom left (German labels).
async function keycap_frames(frames, recipe) {
    const events = key_events(recipe.ablauf);
    const steps = recipe.schritte ?? 1;
    const held = new Set();
    let ei = 0;
    const cache = new Map();
    const out = [];
    for (let i = 0; i < frames.length; i++) {
        const t = i * steps / 60;
        while (ei < events.length && events[ei].step <= i * steps) {
            const e = events[ei++];
            if (e.down) held.add(e.code); else held.delete(e.code);
        }
        const f = frames[i];
        const keys = [...held];
        if (!keys.length) { out.push(f); continue; }
        const id = keys.join('+');
        if (!cache.has(id)) {
            const size = Math.round(f.h / 16), pad = Math.round(size * 0.45);
            let x = pad, parts = '';
            for (const code of keys) {
                const label = controls.key_label(code);
                // a key with one symbol (arrows, letters) is square, longer labels grow sideways
                const h = size * 1.9;
                const w = [...label].length === 1 ? h : Math.max(h, label.length * size * 0.62 + 2 * pad);
                const y = f.h - pad - h;
                parts += `<rect x="${x}" y="${y}" rx="${pad * 0.8}" width="${w}" height="${h}" fill="#1a1c2c" fill-opacity="0.82" stroke="#ffcd75" stroke-width="${Math.max(1, size / 12)}"/>` +
                    `<text x="${x + w / 2}" y="${y + size * 1.3}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="${size}" fill="#ffcd75">${label}</text>`;
                x += w + pad;
            }
            const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}">${parts}</svg>`);
            cache.set(id, await sharp(svg).ensureAlpha().raw().toBuffer());
        }
        const overlay = cache.get(id);
        const data = Buffer.from(f.data);
        for (let p = 0; p < data.length; p += 4) {
            const a = overlay[p + 3] / 255;
            if (!a) continue;
            for (let k = 0; k < 3; k++) data[p + k] = Math.round(overlay[p + k] * a + data[p + k] * (1 - a));
        }
        out.push({ ...f, data });
    }
    return out;
}

// beschriftung: [{ text, spalte, zeile }] – fixed labels over the scene, centred
// on that tile (columns and rows as in the map; halves allowed). Only for scenes
// that do not scroll. A variant (varianten) may bring its own.
async function label_frames(frames, recipe) {
    const labels = recipe.beschriftung ?? [];
    if (!labels.length) return frames;
    const scene = recipe.szene ?? {};
    const first = (scene.ebenen?.[0]?.karte ?? scene.ebenen?.[0] ?? scene.karte ?? '');
    const map_rows = String(first).split('\n').filter(l => l.trim()).length;
    const [ax, ay, , ah] = scene.ausschnitt ?? [0, 0, 0, map_rows];
    const f = frames[0];
    const tile = f.h / ah;
    const size = Math.round(f.h / 18);
    const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let parts = '';
    for (const l of labels) {
        const x = (l.spalte - ax + 0.5) * tile, y = (l.zeile - ay + 0.5) * tile + size * 0.35;
        parts += `<text x="${x}" y="${y}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" ` +
            `font-size="${size}" fill="#f4f4f4" stroke="#1a1c2c" stroke-width="${Math.max(2, size / 5)}" paint-order="stroke">${esc(l.text)}</text>`;
    }
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${f.w}" height="${f.h}">${parts}</svg>`);
    const overlay = await sharp(svg).ensureAlpha().raw().toBuffer();
    return frames.map(fr => {
        const data = Buffer.from(fr.data);
        for (let p = 0; p < data.length; p += 4) {
            const a = overlay[p + 3] / 255;
            if (!a) continue;
            for (let k = 0; k < 3; k++) data[p + k] = Math.round(overlay[p + k] * a + data[p + k] * (1 - a));
        }
        return { ...fr, data };
    });
}

// Share of pixels that differ between two frames (for the loop check).
function frame_difference(a, b) {
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4)
        if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) n++;
    return n / (a.data.length / 4);
}

// The Sprite-Katalog of the sprite basket (src/static/sprite_basket.js): every
// sprite of katalog.yaml's `sammlung` as one game the studio can open (frames
// inside, like spiele/<id>.json), and its groups by the sprites' IDs in that game.
// Written by every build, also a partial one; it needs no browser.
async function write_catalogue(catalog) {
    const ids = catalog.collection.flatMap(group => group.ids);
    const game = await build_game(catalog, { id: 'katalog', titel: 'Sprite-Katalog', szene: { karte: 'P\n#', zusaetzlich: ids } }, repo);
    const data = JSON.parse(studio_game_file(game).toString());
    const id_in_game = new Map(game.used.map((id, i) => [id, data.sprites[i].id]));
    const file = {
        gruppen: catalog.collection.map(group => ({ name: group.name, sprites: group.ids.map(id => id_in_game.get(id)) })),
        spiel: data,
    };
    write_output('katalog.json', Buffer.from(JSON.stringify(file) + '\n'));
    console.log(`✓ Sprite-Katalog (${ids.length} Sprites in ${catalog.collection.length} Gruppen)`);
}

async function main() {
    const catalog = load_catalog(root);
    catalog_for_strips = catalog;
    await write_catalogue(catalog);
    const dir = path.join(root, 'texte');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    // `entwurf: true` hides a recipe (kept in texte/, not built or shown).
    const recipes = files.map(f => read_recipe(path.join(dir, f))).filter(r => {
        if (r.entwurf) console.log(`– ${r.id} (Entwurf, nicht veröffentlicht)`);
        return !r.entwurf;
    });
    const ids = new Set();
    for (const r of recipes) {
        if (ids.has(r.id)) throw new Error(`Rezept-ID doppelt: ${r.id}`);
        ids.add(r.id);
    }
    fs.mkdirSync(out_dir, { recursive: true });
    const index_file = path.join(out_dir, 'rezepte.json');
    const previous = fs.existsSync(index_file) ? JSON.parse(fs.readFileSync(index_file, 'utf8')) : { rezepte: [] };
    const browser = await launch();
    const entries = [];
    let failed = 0;
    try {
        for (const r of recipes) {
            const skip = only.length && !only.includes(r.id);
            const old = previous.rezepte.find(e => e.id === r.id);
            if (skip && old) {
                // kept from the last build: its files stay as they are
                entries.push(old);
                for (const m of (old.html ?? '').matchAll(/\/rezepte\/([^"?]+)\?/g)) written.add(m[1]);
                if (old.bild) written.add(old.bild);
                if (old.standbild) written.add(old.standbild);
                if (old.spiel) written.add(old.spiel);
                continue;
            }
            const t0 = Date.now();
            const game = await build_game(catalog, r, repo);
            const variant_recipes = (r.varianten ?? []).map(v => ({ ...r, ...v, szene: { ...r.szene, ...(v.szene ?? {}) } }));
            const variant_games = [];
            for (const vr of variant_recipes) variant_games.push(await build_game(catalog, vr, repo));
            const plain_recipe = r.ohne ? { ...r, szene: { ...r.szene, ...(r.ohne.szene ?? {}) } } : null;
            const plain_game = plain_recipe ? await build_game(catalog, plain_recipe, repo) : null;
            const quelle = fingerprint(r, [game, ...variant_games, ...(plain_game ? [plain_game] : [])]);
            // The scene as a game to open in the studio (Hilfe → "Im Studio
            // ausprobieren"): cheap, so written for unchanged recipes, too.
            const spiel = { spiel: `spiele/${r.id}.json`, spiel_version: write_output(`spiele/${r.id}.json`, studio_game_file(game)) };
            // Unchanged since the last build (and not asked for by name): keep the recording.
            const media_ok = f => f && fs.existsSync(path.join(out_dir, f));
            if (!force && !check_only && !only.includes(r.id) && old?.quelle === quelle &&
                media_ok(old.bild) && (!old.standbild || media_ok(old.standbild)) &&
                (!r.einzelbilder || (old.einzelbilder?.length && old.einzelbilder.every(b => media_ok(b.bild))))) {
                written.add(old.bild);
                if (old.standbild) written.add(old.standbild);
                for (const b of old.einzelbilder ?? []) written.add(b.bild);
                entries.push({
                    id: r.id, titel: r.titel, kategorie: r.kategorie, stufe: r.stufe ?? 1, kurz: r.kurz,
                    bild: old.bild, version: old.version, standbild: old.standbild, standbild_version: old.standbild_version,
                    breite: old.breite, hoehe: old.hoehe, himmel: old.himmel,
                    ...card_crop(r, old.hoehe),
                    ...(r.schleife ? { schleife: true } : {}),
                    ...(r.einzelbilder ? { einzelbilder: old.einzelbilder } : {}),
                    ...spiel,
                    html: await render_body(r.body, r.id, old.einzelbilder), quelle,
                });
                console.log(`= ${r.id} (unverändert)`);
                continue;
            }
            let { frames, state, errors } = await record(browser, repo, game, r);
            const main_count = frames.length;   // beschriftung: each part gets its own labels
            const problems = [...errors.map(e => `JavaScript-Fehler: ${e}`), ...check(r.erwartet, state)];
            // varianten: the same scene again with other settings, played one after
            // another – or, with `raster: <columns>`, side by side at the same time –
            // or, with `einzelbilder: true`, as recordings of their own in the text.
            // Lossless WebP (default) or, for scenes full of shader noise, `format: gif`.
            // REZEPT_FORMAT=gif forces GIFs (to compare with older builds)
            const ext = (process.env.REZEPT_FORMAT ?? r.format) === 'gif' ? 'gif' : 'webp';
            const parts = [];
            const scenes = [null];   // 0: the recording itself (below)
            for (const [vi, v] of (r.varianten ?? []).entries()) {
                const vr = variant_recipes[vi];
                const res = await record(browser, repo, variant_games[vi], vr);
                problems.push(...res.errors.map(e => `JavaScript-Fehler (Variante ${vi + 1}): ${e}`),
                    ...check(v.erwartet, res.state).map(p => `Variante ${vi + 1}: ${p}`));
                if (res.frames[0].w !== frames[0].w || res.frames[0].h !== frames[0].h)
                    throw new Error(`${r.id}: Varianten brauchen denselben Ausschnitt`);
                const labelled = await label_frames(res.frames, vr);
                if (r.einzelbilder) scenes.push(await write_clip(`varianten/${r.id}-${vi + 1}.${ext}`, labelled, vr, ext));
                else parts.push(labelled);
            }
            if (r.raster) frames = grid_frames([await label_frames(frames, r), ...parts], r.raster, r.skala ?? 3);
            else frames = [...frames, ...parts.flat()];
            if (r.ohne) {
                const plain = await record(browser, repo, plain_game, plain_recipe);
                problems.push(...plain.errors.map(e => `JavaScript-Fehler (ohne): ${e}`));
                if (plain.frames[0].w !== frames[0].w || plain.frames[0].h !== frames[0].h)
                    throw new Error(`${r.id}: "ohne" braucht denselben Ausschnitt`);
                frames = reveal_frames(plain.frames, frames);
            }
            if (!r.raster) frames = [...(await label_frames(frames.slice(0, main_count), r)), ...frames.slice(main_count)];
            if (r.tasten_zeigen) frames = await keycap_frames(frames, r);
            if (r.schleife) {
                // A looping recipe must end exactly as it began.
                const diff = frame_difference(frames[0], frames[frames.length - 1]);
                if (diff > 0.004) problems.push(`Schleife: letztes Bild weicht zu ${(diff * 100).toFixed(1)} % vom ersten ab`);
                frames = frames.slice(0, -1);
            }
            const size = { width: frames[0].w, height: frames[0].h };
            const sky = frames[0].data;   // top-left pixel: sky colour for the card background
            const top_colour = '#' + [sky[0], sky[1], sky[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            const tmp = path.join(here, `.${r.id}.${ext}`);
            if (ext === 'gif') await write_gif(frames, tmp, r.farben ?? 128, r.schritte ?? 1, r.toleranz ?? 0);
            else await write_webp(frames, tmp, r.schritte ?? 1);
            const version = write_output(`${r.id}.${ext}`, fs.readFileSync(tmp));
            // Still frame for the gallery cards (the recording only plays while a card
            // is on screen).
            const main_still = await write_still(`standbild/${r.id}.webp`, still_frame(frames, r));
            const standbild = main_still.bild, standbild_version = main_still.version;
            scenes[0] = { bild: `${r.id}.${ext}`, version, breite: size.width, hoehe: size.height };
            if (check_only && problems.length) fs.renameSync(tmp, path.join(here, `fehler-${r.id}.${ext}`));
            else fs.rmSync(tmp, { force: true });
            const ms = Date.now() - t0;
            if (problems.length) {
                failed++;
                console.log(`✗ ${r.id} (${ms} ms)\n  ${problems.join('\n  ')}\n  Zustand: ${JSON.stringify(state)}`);
            } else {
                console.log(`✓ ${r.id} (${frames.length} Bilder, ${ms} ms)`);
            }
            entries.push({
                id: r.id, titel: r.titel, kategorie: r.kategorie, stufe: r.stufe ?? 1, kurz: r.kurz,
                bild: `${r.id}.${ext}`, version, standbild, standbild_version,
                breite: size.width, hoehe: size.height, himmel: top_colour,
                ...card_crop(r, size.height),
                ...(r.schleife ? { schleife: true } : {}),
                ...(r.einzelbilder ? { einzelbilder: scenes } : {}),
                ...spiel,
                html: await render_body(r.body, r.id, scenes), quelle,
            });
        }
    } finally {
        await browser.close();
    }
    entries.sort((a, b) => KATEGORIEN.indexOf(a.kategorie) - KATEGORIEN.indexOf(b.kategorie));
    if (!check_only) {
        fs.writeFileSync(index_file, JSON.stringify({ kategorien: KATEGORIEN, rezepte: entries }, null, 1) + '\n');
    }
    if (!check_only && !only.length) {
        // Full build: remove what no recipe uses any more (old GIFs, renamed sprites …).
        written.add('rezepte.json');
        const stale = [];
        const walk = (dir, rel = '') => {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                const r = rel ? `${rel}/${f.name}` : f.name;
                if (f.isDirectory()) walk(path.join(dir, f.name), r);
                else if (!written.has(r)) stale.push(r);
            }
        };
        walk(out_dir);
        for (const r of stale) fs.rmSync(path.join(out_dir, r));
        if (stale.length) console.log(`${stale.length} alte Datei(en) entfernt (${stale.slice(0, 3).join(', ')}${stale.length > 3 ? ', …' : ''})`);
    }
    if (failed) {
        console.log(`\n${failed} Rezept(e) zeigen nicht, was sie versprechen. Siehe oben.`);
        process.exitCode = 1;
    }
}

main().catch(e => { console.error(e.message ?? e); process.exitCode = 1; });

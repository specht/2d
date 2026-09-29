#!/usr/bin/env node
// Builds src/static/rezepte/: one animated WebP per recipe (recorded from the
// real engine), the catalogue sprites at native size and rezepte.json for the
// help tab. File URLs carry a content hash (cache busting).
//
//   node build.mjs            build everything
//   node build.mjs leiter     build only the named recipe(s)
//   node build.mjs --check    record and check, but write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';
import sharp from 'sharp';
import { load_catalog, load_strip, build_game, TILE } from './game.mjs';
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

const KATEGORIEN = ['Loslegen', 'Figuren animieren', 'Welt bauen', 'Level gestalten', 'Türen & Schlüssel', 'Kampf', 'Gegner'];

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
async function render_body(md, id) {
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
                const w = Math.max(size * 1.6, label.length * size * 0.62 + 2 * pad);
                const y = f.h - pad - size * 1.9;
                parts += `<rect x="${x}" y="${y}" rx="${pad * 0.8}" width="${w}" height="${size * 1.9}" fill="#1a1c2c" fill-opacity="0.82" stroke="#ffcd75" stroke-width="${Math.max(1, size / 12)}"/>` +
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

// Share of pixels that differ between two frames (for the loop check).
function frame_difference(a, b) {
    let n = 0;
    for (let i = 0; i < a.data.length; i += 4)
        if (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]) > 24) n++;
    return n / (a.data.length / 4);
}

async function main() {
    const catalog = load_catalog(root);
    catalog_for_strips = catalog;
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
                continue;
            }
            const t0 = Date.now();
            const game = await build_game(catalog, r, repo);
            let { frames, state, errors } = await record(browser, repo, game, r);
            const problems = [...errors.map(e => `JavaScript-Fehler: ${e}`), ...check(r.erwartet, state)];
            // varianten: the same scene again with other settings, joined without labels.
            for (const [vi, v] of (r.varianten ?? []).entries()) {
                const vr = { ...r, ...v, szene: { ...r.szene, ...(v.szene ?? {}) } };
                const res = await record(browser, repo, await build_game(catalog, vr, repo), vr);
                problems.push(...res.errors.map(e => `JavaScript-Fehler (Variante ${vi + 1}): ${e}`),
                    ...check(v.erwartet, res.state).map(p => `Variante ${vi + 1}: ${p}`));
                if (res.frames[0].w !== frames[0].w || res.frames[0].h !== frames[0].h)
                    throw new Error(`${r.id}: Varianten brauchen denselben Ausschnitt`);
                frames = [...frames, ...res.frames];
            }
            if (r.ohne) {
                const plain_recipe = { ...r, szene: { ...r.szene, ...(r.ohne.szene ?? {}) } };
                const plain = await record(browser, repo, await build_game(catalog, plain_recipe, repo), plain_recipe);
                problems.push(...plain.errors.map(e => `JavaScript-Fehler (ohne): ${e}`));
                if (plain.frames[0].w !== frames[0].w || plain.frames[0].h !== frames[0].h)
                    throw new Error(`${r.id}: "ohne" braucht denselben Ausschnitt`);
                frames = reveal_frames(plain.frames, frames);
            }
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
            // Lossless WebP (default) or, for scenes full of shader noise, `format: gif`.
            // REZEPT_FORMAT=gif forces GIFs (to compare with older builds)
            const ext = (process.env.REZEPT_FORMAT ?? r.format) === 'gif' ? 'gif' : 'webp';
            const tmp = path.join(here, `.${r.id}.${ext}`);
            if (ext === 'gif') await write_gif(frames, tmp, r.farben ?? 128, r.schritte ?? 1, r.toleranz ?? 0);
            else await write_webp(frames, tmp, r.schritte ?? 1);
            const version = write_output(`${r.id}.${ext}`, fs.readFileSync(tmp));
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
                bild: `${r.id}.${ext}`, version, breite: size.width, hoehe: size.height, himmel: top_colour,
                ...(r.schleife ? { schleife: true } : {}),
                html: await render_body(r.body, r.id),
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

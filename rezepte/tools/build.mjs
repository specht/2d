#!/usr/bin/env node
// Builds src/static/rezepte/: one GIF per recipe (recorded from the real
// engine), animation-catalogue GIFs and rezepte.json for the help tab.
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
import { launch, record, write_gif, check, FRAME_MS, key_events } from './record.mjs';
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

// An animation from the catalogue as a big looping GIF plus its frame strip,
// so recipes can show "these are the frames you draw".
let catalog_for_strips = null;
// [top, bottom] colour of a recipe's sky, for the catalogue pictures.
const DEFAULT_SKY = ['#73eff7', '#f4f4f4'];
function sky_pair(himmel) {
    if (!himmel) return DEFAULT_SKY;
    if (Array.isArray(himmel)) return [himmel[0], himmel[1]];
    const points = [...himmel.farben].sort((a, b) => b[2] - a[2]);
    return [points[0][0], points[points.length - 1][0]];
}

async function catalogue_gif(strip, fps, sky = DEFAULT_SKY) {
    // Frame strips have the sky painted in; recipes with another sky get their own copy.
    const own_sky = sky.join() !== DEFAULT_SKY.join();
    const name = strip.replace('/', '_');
    const strip_name = own_sky ? `${name}_${sky.map(c => c.slice(1, 7)).join('_')}` : name;
    // Big sprites (groesse: [w, h]) are cut with their own frame size.
    const owner = Object.values(catalog_for_strips?.sprites ?? {}).find(sp => sp.groesse && sp.states.some(st => st.strip === strip));
    const [fw, fh] = owner?.groesse ?? [TILE, TILE];
    const frames = await load_strip(root, strip, fw, fh);
    const S = fw > TILE || fh > TILE ? 2 : 4;   // big background sprites: 2×
    const scaled = await Promise.all(frames.map(f =>
        sharp(f.raw, { raw: { width: fw, height: fh, channels: 4 } })
            .resize(fw * S, fh * S, { kernel: 'nearest' }).png().toBuffer()));
    // GIFs know only "see-through or not". Sprites with half-transparent pixels
    // (water, light, ghosts) therefore get the recipe's sky painted in.
    const translucent = frames.some(f => { for (let i = 3; i < f.raw.length; i += 4) if (f.raw[i] > 0 && f.raw[i] < 255) return true; return false; });
    const gif_name = translucent ? strip_name : name;
    const gif = path.join(out_dir, 'katalog', `${gif_name}.gif`);
    const delay = Math.round(1000 / (fps ?? 8));
    const W = fw * S, H = fh * S;
    const sky_svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/>` +
        `<stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);
    if (!check_only) {
        fs.mkdirSync(path.dirname(gif), { recursive: true });
        const one = scaled.length === 1;
        const shown = translucent ? await Promise.all(scaled.map(png =>
            sharp(sky_svg).composite([{ input: png }]).png().toBuffer())) : scaled;
        await (one ? sharp(shown[0]) : sharp(shown, { join: { animated: true } }))
            .gif({ delay: shown.map(() => delay), loop: 0, dither: 0 }).toFile(gif);
        // The frame strip is only shown for real animations. Every frame gets a
        // thin outline: children see where the drawing sits inside the sprite.
        if (!one) {
            const b = 2;
            const outline = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
                `<rect x="${b / 2}" y="${b / 2}" width="${W - b}" height="${H - b}" fill="none" stroke="#1a1c2c" stroke-opacity="0.5" stroke-width="${b}" stroke-dasharray="${b * 2} ${b * 2}"/></svg>`);
            const framed = await Promise.all(scaled.map(png =>
                sharp(sky_svg).composite([{ input: png }, { input: outline }]).png().toBuffer()));
            await sharp(framed, { join: { across: framed.length, shim: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
                .png().toFile(path.join(out_dir, 'katalog', `${strip_name}_bilder.png`));
        }
    }
    return { gif: `katalog/${gif_name}.gif`, bilder: `katalog/${strip_name}_bilder.png`, anzahl: frames.length };
}

// Markdown with two small extensions:
//   ![Laufen](katalog:pip/laufen 10)   animation from the catalogue (fps optional)
//   > **Tipp:** … / > **Achtung:** …    styled hint boxes
async function render_body(md, id, himmel) {
    const sky = sky_pair(himmel);
    const refs = [...md.matchAll(/!\[([^\]]*)\]\(katalog:([^\s)]+)(?:\s+(\d+))?\)/g)];
    for (const [all, label, strip, fps] of refs) {
        const c = await catalogue_gif(strip, fps ? Number(fps) : undefined, sky);
        // the recipe's own sky behind the sprite, so see-through pixels look like in the recording
        const style = sky === DEFAULT_SKY ? '' : ` style="background: linear-gradient(${sky[0]}, ${sky[1]})"`;
        const html = `<figure class="rezept-katalog"><img class="pixel"${style} src="/rezepte/${c.gif}" alt="${label}">` +
            (c.anzahl > 1 ? `<img class="pixel bilder" src="/rezepte/${c.bilder}" alt="Einzelbilder: ${label}">` : '') +
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
            if (skip && old) { entries.push(old); continue; }
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
            const gif_file = path.join(out_dir, `${r.id}.gif`);
            let size = { width: frames[0].w, height: frames[0].h };
            const sky = frames[0].data;   // top-left pixel: sky colour for the card background
            const top_colour = '#' + [sky[0], sky[1], sky[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            if (!check_only) size = await write_gif(frames, gif_file, r.farben ?? 128, FRAME_MS * (r.schritte ?? 1), r.toleranz ?? 0);
            else if (problems.length) await write_gif(frames, path.join(here, `fehler-${r.id}.gif`));
            const ms = Date.now() - t0;
            if (problems.length) {
                failed++;
                console.log(`✗ ${r.id} (${ms} ms)\n  ${problems.join('\n  ')}\n  Zustand: ${JSON.stringify(state)}`);
            } else {
                console.log(`✓ ${r.id} (${frames.length} Bilder, ${ms} ms)`);
            }
            entries.push({
                id: r.id, titel: r.titel, kategorie: r.kategorie, stufe: r.stufe ?? 1, kurz: r.kurz,
                gif: `${r.id}.gif`, breite: size.width, hoehe: size.height, himmel: top_colour, ...(r.schleife ? { schleife: true } : {}),
                html: await render_body(r.body, r.id, r.szene?.himmel),
            });
        }
    } finally {
        await browser.close();
    }
    entries.sort((a, b) => KATEGORIEN.indexOf(a.kategorie) - KATEGORIEN.indexOf(b.kategorie));
    if (!check_only)
        fs.writeFileSync(index_file, JSON.stringify({ kategorien: KATEGORIEN, rezepte: entries }, null, 1) + '\n');
    if (failed) {
        console.log(`\n${failed} Rezept(e) zeigen nicht, was sie versprechen. Siehe oben.`);
        process.exitCode = 1;
    }
}

main().catch(e => { console.error(e.message ?? e); process.exitCode = 1; });

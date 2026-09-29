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
import { launch, record, write_gif, check } from './record.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');            // rezepte/
const repo = path.resolve(root, '..');
const out_dir = path.join(repo, 'src/static/rezepte');
const args = process.argv.slice(2);
const check_only = args.includes('--check');
const only = args.filter(a => !a.startsWith('--'));

const KATEGORIEN = ['Loslegen', 'Figuren animieren', 'Welt bauen', 'Level gestalten', 'Türen & Schlüssel', 'Kampf'];

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
async function catalogue_gif(strip, fps) {
    const name = strip.replace('/', '_');
    // Big sprites (groesse: [w, h]) are cut with their own frame size.
    const owner = Object.values(catalog_for_strips?.sprites ?? {}).find(sp => sp.groesse && sp.states.some(st => st.strip === strip));
    const [fw, fh] = owner?.groesse ?? [TILE, TILE];
    const frames = await load_strip(root, strip, fw, fh);
    const S = fw > TILE || fh > TILE ? 2 : 4;   // big background sprites: 2×
    const scaled = await Promise.all(frames.map(f =>
        sharp(f.raw, { raw: { width: fw, height: fh, channels: 4 } })
            .resize(fw * S, fh * S, { kernel: 'nearest' }).png().toBuffer()));
    const gif = path.join(out_dir, 'katalog', `${name}.gif`);
    const delay = Math.round(1000 / (fps ?? 8));
    if (!check_only) {
        fs.mkdirSync(path.dirname(gif), { recursive: true });
        const one = scaled.length === 1;
        await (one ? sharp(scaled[0]) : sharp(scaled, { join: { animated: true } }))
            .gif({ delay: scaled.map(() => delay), loop: 0, dither: 0 }).toFile(gif);
        // The frame strip is only shown for real animations.
        if (!one) await sharp(scaled, { join: { across: scaled.length, shim: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
            .png().toFile(path.join(out_dir, 'katalog', `${name}_bilder.png`));
    }
    return { gif: `katalog/${name}.gif`, bilder: `katalog/${name}_bilder.png`, anzahl: frames.length };
}

// Markdown with two small extensions:
//   ![Laufen](katalog:pip/laufen 10)   animation from the catalogue (fps optional)
//   > **Tipp:** … / > **Achtung:** …    styled hint boxes
async function render_body(md, id) {
    const refs = [...md.matchAll(/!\[([^\]]*)\]\(katalog:([^\s)]+)(?:\s+(\d+))?\)/g)];
    for (const [all, label, strip, fps] of refs) {
        const c = await catalogue_gif(strip, fps ? Number(fps) : undefined);
        const html = `<figure class="rezept-katalog"><img class="pixel" src="/rezepte/${c.gif}" alt="${label}">` +
            (c.anzahl > 1 ? `<img class="pixel bilder" src="/rezepte/${c.bilder}" alt="Einzelbilder: ${label}">` : '') +
            `<figcaption>${label} · ${c.anzahl} ${c.anzahl === 1 ? 'Bild' : 'Bilder'}</figcaption></figure>`;
        md = md.replace(all, html);
    }
    let html = marked.parse(md);
    html = html.replace(/<blockquote>\s*<p><strong>(Tipp|Achtung|Profi-Tipp):<\/strong>/g,
        (_, kind) => `<blockquote class="rezept-${kind === 'Achtung' ? 'achtung' : 'tipp'}"><p><strong>${kind}:</strong>`);
    return html;
}

// Small caption in the top left corner of every frame.
async function label_frames(frames, text) {
    const { w, h } = frames[0];
    const size = Math.round(h / 12);
    const pad = Math.round(size * 0.5);
    const box_w = Math.round(text.length * size * 0.62 + 2 * pad);
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<rect x="${pad}" y="${pad}" rx="${pad}" width="${box_w}" height="${size + pad * 1.4}" fill="#1a1c2c" fill-opacity="0.8"/>` +
        `<text x="${2 * pad}" y="${pad + size}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" ` +
        `font-size="${size}" fill="#ffcd75">${text}</text></svg>`);
    const overlay = await sharp(svg).ensureAlpha().raw().toBuffer();
    return frames.map(f => {
        const data = Buffer.from(f.data);
        for (let i = 0; i < data.length; i += 4) {
            const a = overlay[i + 3] / 255;
            if (!a) continue;
            for (let k = 0; k < 3; k++) data[i + k] = Math.round(overlay[i + k] * a + data[i + k] * (1 - a));
        }
        return { ...f, data };
    });
}

async function main() {
    const catalog = load_catalog(root);
    catalog_for_strips = catalog;
    const dir = path.join(root, 'texte');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    const recipes = files.map(f => read_recipe(path.join(dir, f)));
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
            if (r.vorher) {
                // Before/after: record the "vorher" scene with the same input and play it first.
                const before_recipe = { ...r, ...r.vorher, szene: { ...r.szene, ...(r.vorher.szene ?? {}),
                    ...(r.vorher.parallaxe_aus ? { parallaxe_aus: true } : {}) } };
                const before = await record(browser, repo, await build_game(catalog, before_recipe, repo), before_recipe);
                problems.push(...before.errors.map(e => `JavaScript-Fehler (vorher): ${e}`),
                    ...check(r.vorher.erwartet, before.state).map(p => `vorher: ${p}`));
                if (before.frames[0].w !== frames[0].w || before.frames[0].h !== frames[0].h)
                    throw new Error(`${r.id}: "vorher" und "nachher" brauchen denselben Ausschnitt`);
                frames = [...await label_frames(before.frames, 'Vorher'), ...await label_frames(frames, 'Nachher')];
            }
            const gif_file = path.join(out_dir, `${r.id}.gif`);
            let size = { width: frames[0].w, height: frames[0].h };
            const sky = frames[0].data;   // top-left pixel: sky colour for the card background
            const top_colour = '#' + [sky[0], sky[1], sky[2]].map(v => v.toString(16).padStart(2, '0')).join('');
            if (!check_only) size = await write_gif(frames, gif_file, r.farben ?? 128, r.bildrate ?? 30);
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
                gif: `${r.id}.gif`, breite: size.width, hoehe: size.height, himmel: top_colour, ...(r.vorher ? { vergleich: true } : {}),
                html: await render_body(r.body, r.id),
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

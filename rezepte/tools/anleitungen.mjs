#!/usr/bin/env node
// Builds src/static/anleitungen/: the Erste-Schritte guides of the Hilfe tab,
// recorded from the real studio (studio.mjs, anleitung.mjs) – videos with a
// visible mouse pointer and pictures with numbered marks – and
// anleitungen.json, which rezepte.js shows before the recipes.
//
//   node anleitungen.mjs             every guide that changed
//   node anleitungen.mjs signale     only the named guide(s)
//   node anleitungen.mjs --check     record and check, write nothing
//   node anleitungen.mjs --force     record everything again
//
// Like build.mjs: a guide is recorded again only when something it depends
// on has changed – its YAML head, its starting scene, or any file of the
// studio (src/static, apart from the generated rezepte/ and anleitungen/).
// The fingerprint (`quelle`) is made from the contents, not the timestamps.
// Kept apart from build.mjs on purpose: the tools build.mjs uses are part of
// the recipes' fingerprint, and the guides must not re-record the recipes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { marked } from 'marked';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { write_webp } from './record.mjs';
import { load_catalog, build_game, studio_game } from './game.mjs';
import { open_studio } from './studio.mjs';
import { GuidePlayer, StepError } from './anleitung.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');            // rezepte/
const repo = path.resolve(root, '..');
const static_dir = path.join(repo, 'src/static');
const out_dir = path.join(static_dir, 'anleitungen');
const args = process.argv.slice(2);
const check_only = args.includes('--check');
const force = args.includes('--force');
const only = args.filter(a => !a.startsWith('--'));
export const KATEGORIE = 'Erste Schritte';

// Everything the studio shows: every file below src/static except what the
// builds generate, plus these tools.
let studio_hash_cache = null;
function studio_hash() {
    if (studio_hash_cache) return studio_hash_cache;
    const h = crypto.createHash('sha1');
    const walk = (dir, rel) => {
        for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const r = rel ? `${rel}/${f.name}` : f.name;
            if (!rel && (f.name === 'rezepte' || f.name === 'anleitungen')) continue;
            if (f.isDirectory()) walk(path.join(dir, f.name), r);
            else h.update(r).update(fs.readFileSync(path.join(dir, f.name)));
        }
    };
    walk(static_dir, '');
    for (const f of ['anleitungen.mjs', 'anleitung.mjs', 'studio.mjs', 'record.mjs', 'game.mjs'])
        h.update(f).update(fs.readFileSync(path.join(here, f)));
    studio_hash_cache = h.digest('hex');
    return studio_hash_cache;
}

function read_guide(file) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${path.basename(file)}: YAML-Kopf (--- … ---) fehlt`);
    const meta = YAML.parse(m[1]);
    meta.id ??= path.basename(file, '.md').replace(/^\d+-/, '');
    meta.body = m[2];
    for (const key of ['titel', 'kurz', 'aufnahmen'])
        if (!meta[key]) throw new Error(`${meta.id}: "${key}" fehlt`);
    const names = new Set();
    for (const a of meta.aufnahmen) {
        if (!a.name || !['video', 'bild'].includes(a.art)) throw new Error(`${meta.id}: jede Aufnahme braucht name und art (video | bild)`);
        if (names.has(a.name)) throw new Error(`${meta.id}: Aufnahme ${a.name} doppelt`);
        names.add(a.name);
    }
    for (const [, , name] of meta.body.matchAll(/!\[([^\]]*)\]\(aufnahme:([\w-]+)\)/g))
        if (!names.has(name)) throw new Error(`${meta.id}: aufnahme:${name} steht im Text, aber nicht unter aufnahmen`);
    return meta;
}

// The game the guide starts with: an empty one (Neues Spiel), a scene like a
// recipe's (`szene`, sprites from katalog.yaml) or a recipe's scene (`rezept`).
// eine_ebene: true – as in a child's own game: every sprite on one layer
// "Ebene 1" (the scene's backdrop layers stay), the level without a name.
export function one_layer(data) {
    for (const level of data.levels) {
        const sprite_layers = level.layers.filter(l => l.type !== 'backdrop' && Array.isArray(l.sprites));
        if (!sprite_layers.length) continue;
        const main = sprite_layers.find(l => l.properties?.name === 'Welt') ?? sprite_layers[0];
        for (const l of sprite_layers) if (l !== main) main.sprites.push(...l.sprites);
        level.layers = level.layers.filter(l => l === main || !sprite_layers.includes(l));
        main.properties.name = 'Ebene 1';
        delete level.properties.name;
    }
    return data;
}

async function start_game(guide, catalog) {
    const start = guide.start ?? {};
    if (start.szene) {
        const data = studio_game(await build_game(catalog, { id: guide.id, titel: guide.titel, szene: start.szene }, repo));
        // a child's own game: no title, no author yet
        data.properties.title = '';
        data.properties.author = '';
        return start.eine_ebene ? one_layer(data) : data;
    }
    if (start.rezept) {
        const file = fs.readdirSync(path.join(root, 'texte')).find(f => f.replace(/^\d+-/, '') === `${start.rezept}.md`);
        if (!file) throw new Error(`${guide.id}: Rezept ${start.rezept} gibt es nicht`);
        const text = fs.readFileSync(path.join(root, 'texte', file), 'utf8').replace(/\r/g, '');
        const recipe = YAML.parse(text.match(/^---\n([\s\S]*?)\n---\n/)[1]);
        recipe.id ??= start.rezept;
        return studio_game(await build_game(catalog, recipe, repo));
    }
    return null;
}

function content_hash(buffer) {
    return crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
}

const written = new Set();
function write_output(rel, buffer) {
    written.add(rel);
    if (check_only) return content_hash(buffer);
    const file = path.join(out_dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, buffer);
    return content_hash(buffer);
}

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ![Was man sieht](aufnahme:name) → the video or picture, with its caption.
// Videos start again with a click (kids want to see a step twice).
// [Text](rezept:leiter) – a link to a recipe or another guide (rezepte.js opens it).
let known_ids = new Set();
function render_body(md, media, id = '') {
    md = md.replace(/\[([^\]]+)\]\(rezept:([\w-]+)\)/g, (_, text, target) => {
        if (!known_ids.has(target)) throw new Error(`${id}: rezept:${target} gibt es nicht`);
        return `<a href="#hilfe/${target}" data-rezept="${target}">${text}</a>`;
    });
    md = md.replace(/!\[([^\]]*)\]\(aufnahme:([\w-]+)\)/g, (_, label, name) => {
        const m = media[name];
        if (!m) return '';      // not recorded (the guide failed before it)
        const kind = m.art === 'video' ? 'anleitung-video' : 'anleitung-bild';
        return `<figure class="anleitung-medium ${kind}"><img src="/anleitungen/${m.bild}?${m.version}" width="${m.breite}" height="${m.hoehe}" ` +
            `loading="lazy" decoding="async" alt="${esc(label)}">` +
            (label ? `<figcaption>${label}</figcaption>` : '') + `</figure>`;
    });
    let html = marked.parse(md);
    html = html.replace(/<blockquote>\s*<p><strong>(Tipp|Achtung|Profi-Tipp):<\/strong>/g,
        (_, kind) => `<blockquote class="rezept-${kind === 'Achtung' ? 'achtung' : 'tipp'}"><p><strong>${kind}:</strong>`);
    return html;
}

async function record_guide(browser, guide, start) {
    const { context, page, errors } = await open_studio(browser, repo);
    const player = new GuidePlayer(page, guide.id);
    const media = {};
    const problems = [];
    try {
        await player.init();
        if (start) {
            await page.evaluate((data) => {
                // no parent: _load would ask the game frame for game "null" (game.js)
                delete data.parent;
                game.data = data;
                game._load();
                game.saved_state = JSON.stringify(game.data);
            }, start);
            await page.waitForTimeout(400);
        }
        for (const a of guide.aufnahmen) {
            await player.steps(a.vorher);
            const clip = await player.clip(a.ausschnitt, a.rand ?? 12);
            if (a.art === 'bild') {
                await player.steps(a.schritte);
                await page.evaluate(() => window.__guide.hide_pointer());
                await player.place_marks(a.marken);
                await page.waitForTimeout(150);
                const f = await player.picture(clip);
                await page.evaluate(() => window.__guide.marks([]));
                media[a.name] = { art: 'bild', frames: [f] };
            } else {
                await player.set_band({ nr: null, text: a.titel ?? '', keys: [], maus: '' });
                await player.start_video(clip);
                await player.hold(0.6);
                await player.steps(a.schritte);
                await player.hold(a.ende ?? 1.6);
                await player.set_band({ nr: null, text: '', keys: [], maus: '' });
                media[a.name] = { art: 'video', frames: player.stop_video(), standbild: a.standbild };
            }
            await player.steps(a.nachher);
        }
    } catch (e) {
        if (e instanceof StepError) problems.push(e.message);
        else throw e;
        // what was recorded up to the failing step, to look at
        const partial = player.recording ? player.stop_video() : null;
        if (partial?.length) {
            await write_webp(partial, path.join(here, `fehler-${guide.id}.webp`), 1);
            problems.push(`Aufnahme bis zum Fehler: rezepte/tools/fehler-${guide.id}.webp`);
        }
    } finally {
        await context.close();
    }
    problems.push(...errors.map(e => `JavaScript-Fehler: ${e}`));
    return { media, problems };
}

async function main() {
    const dir = path.join(root, 'anleitungen');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
    const guides = files.map(f => read_guide(path.join(dir, f))).filter(g => {
        if (g.entwurf) console.log(`– ${g.id} (Entwurf, nicht veröffentlicht)`);
        return !g.entwurf;
    });
    const catalog = load_catalog(root);
    const recipe_ids = fs.readdirSync(path.join(root, 'texte')).filter(f => f.endsWith('.md')).map(f => f.replace(/^\d+-/, '').replace(/\.md$/, ''));
    for (const g of guides) if (recipe_ids.includes(g.id)) throw new Error(`${g.id}: so heißt schon ein Rezept – eine Anleitung braucht einen eigenen Namen`);
    known_ids = new Set([...recipe_ids, ...guides.map(g => g.id)]);
    // links first: a wrong one should not cost a recording
    for (const g of guides) render_body(g.body.replace(/!\[[^\]]*\]\(aufnahme:[\w-]+\)/g, ''), {}, g.id);
    const index_file = path.join(out_dir, 'anleitungen.json');
    const previous = fs.existsSync(index_file) ? JSON.parse(fs.readFileSync(index_file, 'utf8')) : { anleitungen: [] };
    const entries = [];
    let failed = 0;
    let browser = null;
    try {
        for (const g of guides) {
            const old = previous.anleitungen.find(e => e.id === g.id);
            const keep_files = (e) => {
                for (const m of (e.html ?? '').matchAll(/\/anleitungen\/([^"?]+)\?/g)) written.add(m[1]);
                if (e.bild) written.add(e.bild);
                if (e.standbild) written.add(e.standbild);
            };
            if (only.length && !only.includes(g.id) && old) { entries.push(old); keep_files(old); continue; }
            const start = await start_game(g, catalog);
            const { body, ...meta } = g;
            const quelle = crypto.createHash('sha1').update(studio_hash()).update(JSON.stringify(meta))
                .update(JSON.stringify(start ?? null)).digest('hex').slice(0, 16);
            const files_ok = e => [e.bild, e.standbild, ...[...(e.html ?? '').matchAll(/\/anleitungen\/([^"?]+)\?/g)].map(m => m[1])]
                .every(f => !f || fs.existsSync(path.join(out_dir, f)));
            if (!force && !check_only && !only.includes(g.id) && old?.quelle === quelle && files_ok(old)) {
                keep_files(old);
                const media = {};
                for (const m of old.medien ?? []) media[m.name] = m;
                entries.push({ ...old, titel: g.titel, kurz: g.kurz, html: render_body(g.body, media, g.id) });
                console.log(`= ${g.id} (unverändert)`);
                continue;
            }
            // the studio's WebGL (level editor, Spielen) works with the default headless Chromium
            browser ??= await chromium.launch();
            const t0 = Date.now();
            const { media, problems } = await record_guide(browser, g, start);
            const medien = [];
            const by_name = {};
            for (const a of g.aufnahmen) {
                const m = media[a.name];
                if (!m) continue;
                const { w, h } = m.frames[0];
                let rel, version;
                if (m.art === 'video') {
                    const tmp = path.join(here, `.${g.id}-${a.name}.webp`);
                    await write_webp(m.frames, tmp, 1);
                    rel = `${g.id}-${a.name}.webp`;
                    version = write_output(rel, fs.readFileSync(tmp));
                    fs.rmSync(tmp, { force: true });
                } else {
                    const f = m.frames[0];
                    rel = `${g.id}-${a.name}.webp`;
                    version = write_output(rel, await sharp(f.data, { raw: { width: w, height: h, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer());
                }
                const entry = { name: a.name, art: m.art, bild: rel, version, breite: w, hoehe: h };
                medien.push(entry);
                by_name[a.name] = entry;
                m.entry = entry;
            }
            // the gallery card: a moment of the first video (`standbild` seconds, else 60 %)
            // or the first picture
            const first = g.aufnahmen.map(a => media[a.name]).find(m => m?.art === 'video') ?? Object.values(media)[0];
            let card = {};
            if (first) {
                const n = first.frames.length;
                const i = first.standbild !== undefined ? Math.round(first.standbild * 60) : Math.floor(n * 0.6);
                const f = first.frames[Math.max(0, Math.min(n - 1, i))];
                const standbild = `standbild/${g.id}.webp`;
                card = {
                    bild: first.entry.bild, version: first.entry.version, breite: first.entry.breite, hoehe: first.entry.hoehe,
                    standbild, standbild_version: write_output(standbild, await sharp(f.data, { raw: { width: f.w, height: f.h, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer()),
                    himmel: '#' + [f.data[0], f.data[1], f.data[2]].map(v => v.toString(16).padStart(2, '0')).join(''),
                };
            }
            const ms = Date.now() - t0;
            if (problems.length) {
                failed++;
                console.log(`✗ ${g.id} (${ms} ms)\n  ${problems.join('\n  ')}`);
            } else {
                const sizes = medien.map(m => `${m.name} ${Math.round(fs.existsSync(path.join(out_dir, m.bild)) ? fs.statSync(path.join(out_dir, m.bild)).size / 1024 : 0)} kB`);
                console.log(`✓ ${g.id} (${medien.length} Aufnahmen, ${ms} ms${check_only ? '' : ': ' + sizes.join(', ')})`);
            }
            entries.push({
                id: g.id, titel: g.titel, kategorie: KATEGORIE, kurz: g.kurz, anleitung: true,
                ...card, medien, html: render_body(g.body, by_name, g.id), quelle,
            });
        }
    } finally {
        await browser?.close();
    }
    if (!check_only) {
        fs.mkdirSync(out_dir, { recursive: true });
        fs.writeFileSync(index_file, JSON.stringify({ kategorie: KATEGORIE, anleitungen: entries }, null, 1) + '\n');
    }
    if (!check_only && !only.length) {
        // everything a guide no longer uses goes
        written.add('anleitungen.json');
        const stale = [];
        const walk = (d, rel = '') => {
            for (const f of fs.readdirSync(d, { withFileTypes: true })) {
                const r = rel ? `${rel}/${f.name}` : f.name;
                if (f.isDirectory()) walk(path.join(d, f.name), r);
                else if (!written.has(r)) stale.push(r);
            }
        };
        if (fs.existsSync(out_dir)) walk(out_dir);
        for (const r of stale) fs.rmSync(path.join(out_dir, r));
        if (stale.length) console.log(`${stale.length} alte Datei(en) entfernt`);
    }
    if (failed) {
        console.log(`\n${failed} Anleitung(en) zeigen nicht, was sie versprechen. Siehe oben.`);
        process.exitCode = 1;
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.stack ?? e.message ?? e); process.exitCode = 1; });

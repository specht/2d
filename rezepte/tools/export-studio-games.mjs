#!/usr/bin/env node
// Builds local, editable copies of the recipe scenes for the DEVELOPMENT studio.
// These files are ignored by git; production only needs the normal recipe media.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import sharp from 'sharp';
import { load_catalog, build_game } from './game.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '..');
const out_dir = path.join(repo, 'src/static/rezepte/spiele');
const requested = new Set(process.argv.slice(2).filter(a => !a.startsWith('--')));
const SHEET_FACTOR = 4; // must match game.mjs / Main.render_spritesheet_for_tag

function read_recipe(file) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${path.basename(file)}: YAML-Kopf (--- … ---) fehlt`);
    const meta = YAML.parse(m[1]);
    meta.id ??= path.basename(file, '.md').replace(/^\d+-/, '');
    return meta;
}

async function studio_data(game) {
    const data = JSON.parse(JSON.stringify(game.data));
    const sheet = sharp(game.sheet.png);
    const sources = new Map();

    for (let si = 0; si < data.sprites.length; si++) {
        const sprite = data.sprites[si];
        for (let sti = 0; sti < sprite.states.length; sti++) {
            const state = sprite.states[sti];
            for (let fi = 0; fi < state.frames.length; fi++) {
                const frame = state.frames[fi];
                const key = frame.tag ?? `${si}/${sti}/${fi}`;
                if (!sources.has(key)) {
                    const [sheet_index, x, y] = game.sheet.info.tiles[si][sti][fi];
                    if (sheet_index !== 0)
                        throw new Error(`Mehrere Spritesheets werden noch nicht unterstützt (${game.tag})`);
                    const png = await sheet.clone()
                        .extract({
                            left: x, top: y,
                            width: sprite.width * SHEET_FACTOR,
                            height: sprite.height * SHEET_FACTOR,
                        })
                        .resize(sprite.width, sprite.height, { kernel: 'nearest' })
                        .png({ compressionLevel: 9 })
                        .toBuffer();
                    sources.set(key, `data:image/png;base64,${png.toString('base64')}`);
                }
                frame.src = sources.get(key);
            }
        }
    }
    data.parent = null;
    return data;
}

async function main() {
    const catalog = load_catalog(root);
    const dir = path.join(root, 'texte');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    const recipes = files.map(f => read_recipe(path.join(dir, f))).filter(r => !r.entwurf);
    const available = new Set(recipes.map(r => r.id));
    for (const id of requested) if (!available.has(id)) throw new Error(`Unbekanntes Rezept: ${id}`);

    fs.mkdirSync(out_dir, { recursive: true });
    const written = new Set();
    for (const recipe of recipes) {
        if (requested.size && !requested.has(recipe.id)) continue;
        const game = await build_game(catalog, recipe, repo);
        const file = `${recipe.id}.json`;
        fs.writeFileSync(path.join(out_dir, file), JSON.stringify(await studio_data(game)) + '\n');
        written.add(file);
        console.log(`✓ ${recipe.id} (Studio-Spiel)`);
    }

    if (!requested.size) {
        for (const file of fs.readdirSync(out_dir))
            if (file.endsWith('.json') && !written.has(file)) fs.rmSync(path.join(out_dir, file));
    }
}

main().catch(e => { console.error(e.message ?? e); process.exitCode = 1; });

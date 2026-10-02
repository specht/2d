#!/usr/bin/env node
// Writes only the studio scenes of the recipes (src/static/rezepte/spiele/),
// without recording anything. The normal build (build.mjs) writes them too,
// so this is only a shortcut while working on a recipe's scene:
//
//   npm run studio               every recipe
//   npm run studio -- leiter     only these
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { load_catalog, build_game, studio_game_file } from './game.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '..');
const static_dir = path.join(repo, 'src/static/rezepte');
const out_dir = path.join(static_dir, 'spiele');
const requested = new Set(process.argv.slice(2).filter(a => !a.startsWith('--')));

function read_recipe(file) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${path.basename(file)}: YAML-Kopf (--- … ---) fehlt`);
    const meta = YAML.parse(m[1]);
    meta.id ??= path.basename(file, '.md').replace(/^\d+-/, '');
    return meta;
}

async function main() {
    const catalog = load_catalog(root);
    const dir = path.join(root, 'texte');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    const recipes = files.map(f => read_recipe(path.join(dir, f))).filter(r => !r.entwurf);
    const available = new Set(recipes.map(r => r.id));
    for (const id of requested) if (!available.has(id)) throw new Error(`Unbekanntes Rezept: ${id}`);

    fs.mkdirSync(out_dir, { recursive: true });
    const versions = {};
    for (const recipe of recipes) {
        if (requested.size && !requested.has(recipe.id)) continue;
        const buffer = studio_game_file(await build_game(catalog, recipe, repo));
        fs.writeFileSync(path.join(out_dir, `${recipe.id}.json`), buffer);
        versions[recipe.id] = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
        console.log(`✓ ${recipe.id} (Studio-Spiel)`);
    }

    // The gallery finds a scene (and its cache-busting version) in rezepte.json.
    const index_file = path.join(static_dir, 'rezepte.json');
    if (fs.existsSync(index_file)) {
        const index = JSON.parse(fs.readFileSync(index_file, 'utf8'));
        for (const entry of index.rezepte ?? []) {
            if (!(entry.id in versions)) continue;
            entry.spiel = `spiele/${entry.id}.json`;
            entry.spiel_version = versions[entry.id];
        }
        fs.writeFileSync(index_file, JSON.stringify(index, null, 1) + '\n');
    }

    if (!requested.size) {
        for (const file of fs.readdirSync(out_dir))
            if (file.endsWith('.json') && !(file.replace(/\.json$/, '') in versions)) fs.rmSync(path.join(out_dir, file));
    }
}

main().catch(e => { console.error(e.message ?? e); process.exitCode = 1; });

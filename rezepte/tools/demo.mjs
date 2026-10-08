#!/usr/bin/env node
// Builds a demo game with several levels from a scene file in rezepte/demo/
// (the recipe scenes' format, one `szene` per level) and the Sprite-Katalog.
// Nothing is recorded: it writes the game as the studio opens it and, with
// --speichern, saves it on a running server like the studio's Speichern does
// (a new game with its own Spiel-Code).
//
//   npm run demo                                   rezepte/demo/letztes-licht.yaml
//   npm run demo -- --speichern http://localhost:8025
//   node demo.mjs ../demo/anderes.yaml --ausgabe /tmp/spiel.json
//
// The scene file:
//   titel, autor        the game's title and author
//   eigenschaften       the game's settings (Einstellungen), e.g. { max_lives: 5 }
//   anpassen            catalogue sprites changed for the whole game (as in a recipe)
//   level: [ { id, name, nebenlevel?, szene } ]
//       id      the level's id – what an exit's `target` names (level_flow.js)
//       szene   a recipe scene (README.md "Writing a recipe"): karte or ebenen,
//               legende, himmel, effekte, bereiche, bewegung …
// A sprite is in the game once, however many levels use it.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { load_catalog, build_game, studio_game, TILE } from './game.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const repo = path.resolve(root, '..');

const clone = x => JSON.parse(JSON.stringify(x));
const is_object = x => x && typeof x === 'object' && !Array.isArray(x);

// The studio's own fix_game_data (as game.mjs): the game gets exactly the
// defaults and IDs a child's saved game would have.
let fixer = null;
function fix_game_data(data) {
    if (!fixer) {
        const ctx = { console, DEFAULT_WIDTH: TILE, DEFAULT_HEIGHT: TILE, createDataUrlForImageSize: () => undefined };
        vm.createContext(ctx);
        for (const f of ['signals.js', 'traits.js', 'baddie_ai.js', 'game_ids.js', 'game.js'])
            vm.runInContext(fs.readFileSync(path.join(repo, 'src/static', f), 'utf8'), ctx, { filename: f });
        vm.runInContext('globalThis.__fix = (d) => { const g = { data: d }; Game.prototype.fix_game_data.call(g); return g.data; };', ctx);
        fixer = ctx.__fix;
    }
    return clone(fixer(data));
}

// Every sprite reference outside the placed sprites (game_ids.js): attack
// pictures (hit/attack/projectile_sprite_id), enemy drops and the level's
// items (sprite_id). map(id) gives the new one.
function rename_references(value, map) {
    if (Array.isArray(value)) return value.forEach(v => rename_references(v, map));
    if (!is_object(value)) return;
    for (const [key, v] of Object.entries(value)) {
        if ((key === 'sprite_id' || key.endsWith('_sprite_id')) && typeof v === 'string') value[key] = map(v);
        else rename_references(v, map);
    }
}

function parse_args(argv) {
    const args = { file: path.join(root, 'demo', 'letztes-licht.yaml'), save: null, out: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--speichern') args.save = argv[++i];
        else if (argv[i] === '--ausgabe') args.out = argv[++i];
        else args.file = path.resolve(argv[i]);
    }
    if (args.save === undefined) throw new Error('--speichern braucht die Adresse des Servers, z. B. http://localhost:8025');
    return args;
}

export async function build_demo(file) {
    const spec = YAML.parse(fs.readFileSync(file, 'utf8'));
    const name = path.basename(file).replace(/\.ya?ml$/, '');
    if (!Array.isArray(spec.level) || !spec.level.length) throw new Error(`${name}: level fehlt`);
    const catalog = load_catalog(root);
    const level_ids = new Set();
    const sprites = [];               // the game's sprites, in order of first use
    const by_catalog_id = new Map();  // catalogue id → { index, json }
    const pngs = new Map();
    const levels = [];
    for (const def of spec.level) {
        const where = `${name}, Level ${def.id}`;
        if (typeof def.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(def.id)) throw new Error(`${where}: id fehlt oder ist ungültig`);
        if (level_ids.has(def.id)) throw new Error(`${where}: id doppelt`);
        level_ids.add(def.id);
        if (def.szene?.anpassen) throw new Error(`${where}: anpassen gilt fürs ganze Spiel – oben in der Datei, nicht im Level`);
        // every level follows the figure with the game's screen height (the
        // parallax layers are placed for it)
        const height = spec.eigenschaften?.screen_pixel_height ?? 216;
        const recipe = { id: def.id, titel: def.name ?? def.id,
            szene: { kamera: { bildhoehe: height }, ...def.szene, anpassen: spec.anpassen ?? {} } };
        const built = await build_game(catalog, recipe, repo);
        for (const [tag, png] of built.pngs) pngs.set(tag, png);
        // the scene's sprite ids (s0, s1 …) → catalogue ids → the game's ids
        const catalog_id_of = new Map(built.data.sprites.map((s, i) => [s.id, built.used[i]]));
        const to_catalog = id => catalog_id_of.get(id) ?? (() => { throw new Error(`${where}: unbekannte Sprite-ID ${id}`); })();
        built.data.sprites.forEach((sprite, i) => {
            const json = clone(sprite);
            delete json.id;
            rename_references(json, to_catalog);
            const known = by_catalog_id.get(built.used[i]);
            if (known) {
                if (JSON.stringify(known.json) !== JSON.stringify(json)) throw new Error(`${where}: ${built.used[i]} ist anders als in einem Level davor`);
                return;
            }
            by_catalog_id.set(built.used[i], { index: sprites.length, json });
            sprites.push(json);
        });
        const level = clone(built.data.levels[0]);
        rename_references(level, to_catalog);
        for (const layer of level.layers) if (layer.type === 'sprites') for (const placed of layer.sprites) placed[0] = to_catalog(placed[0]);
        level.id = def.id;
        level.properties.name = def.name ?? def.id;
        level.properties.use_level = true;
        if (def.nebenlevel) level.properties.side_level = true;
        levels.push(level);
    }
    // catalogue ids → the game's sprite ids (s0, s1 … in order of first use)
    const game_id = cid => `s${by_catalog_id.get(cid).index}`;
    sprites.forEach((sprite, i) => { sprite.id = `s${i}`; rename_references(sprite, game_id); });
    for (const level of levels) {
        rename_references(level, game_id);
        for (const layer of level.layers) if (layer.type === 'sprites') for (const placed of layer.sprites) placed[0] = game_id(placed[0]);
        // exits name levels by id: every target must exist
        for (const layer of level.layers) if (layer.type === 'sprites') for (const placed of layer.sprites) {
            const target = placed[3]?.level_complete?.target;
            if (typeof target === 'string' && !target.startsWith('@') && !level_ids.has(target))
                throw new Error(`${name}, Level ${level.id}: Ausgang führt zu unbekanntem Level "${target}"`);
        }
    }
    let data = {
        properties: {
            title: spec.titel ?? name, author: spec.autor ?? '2D Game Studio',
            screen_pixel_height: 216, show_energy: false, lives_at_begin: 3, max_lives: 5,
            ...(spec.eigenschaften ?? {}),
        },
        sprites, levels,
    };
    data = fix_game_data(data);
    // the catalogue's sprites behind each id (for checks and the README)
    const catalog_ids = [...by_catalog_id.keys()];
    return { name, data, pngs, catalog_ids };
}

async function main() {
    const args = parse_args(process.argv.slice(2));
    const demo = await build_demo(args.file);
    const game = studio_game({ tag: demo.name, data: demo.data, pngs: demo.pngs });
    const out = args.out ?? path.join(repo, 'src/static/rezepte/spiele', `demo-${demo.name}.json`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(game) + '\n');
    console.log(`✓ ${demo.data.properties.title}: ${demo.data.levels.length} Level, ${demo.data.sprites.length} Sprites → ${path.relative(process.cwd(), out)}`);
    if (args.save) {
        const base = args.save.replace(/\/+$/, '');
        const response = await fetch(`${base}/api/save_game`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.tag) throw new Error(`Speichern ging nicht (HTTP ${response.status}): ${JSON.stringify(result).slice(0, 200)}`);
        console.log(`✓ gespeichert – Spiel-Code ${result.tag}: ${base}/?${result.tag}`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(e => { console.error(`✗ ${e.message}`); process.exit(1); });
}

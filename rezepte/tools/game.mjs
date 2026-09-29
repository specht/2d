// Turns the animation catalogue and a recipe scene into a real game: the
// same JSON the studio saves and the same sprite-sheet layout the server
// renders (see Main.render_spritesheet_for_tag in src/ruby/main.rb).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import sharp from 'sharp';
import YAML from 'yaml';

export const TILE = 24;
const SHEET_WIDTH = 1024;       // MAX_SPRITESHEET_WIDTH
const SHEET_FACTOR = 4;         // SPRITESHEET_FACTOR

const clone = x => JSON.parse(JSON.stringify(x));
const is_object = x => x && typeof x === 'object' && !Array.isArray(x);

function deep_merge(base, extra) {
    const out = is_object(base) ? clone(base) : {};
    for (const [k, v] of Object.entries(extra ?? {})) {
        out[k] = is_object(v) && is_object(out[k]) ? deep_merge(out[k], v) : clone(v);
    }
    return out;
}

// ------------------------------------------------------------ catalogue
export function load_catalog(root) {
    const catalog = YAML.parse(fs.readFileSync(path.join(root, 'katalog.yaml'), 'utf8'));
    const resolved = {};
    const resolve = (id, stack = []) => {
        if (resolved[id]) return resolved[id];
        const def = catalog.sprites[id];
        if (!def) throw new Error(`Katalog: unbekannter Sprite "${id}"`);
        if (stack.includes(id)) throw new Error(`Katalog: Zyklus bei ${[...stack, id].join(' → ')}`);
        let sprite = { id, label: def.label ?? id, traits: clone(def.traits ?? {}), states: clone(def.states ?? []) };
        if (def.extends) {
            const parent = resolve(def.extends, [...stack, id]);
            const states = clone(parent.states);
            for (const st of sprite.states) {
                const i = states.findIndex(s => s.strip === st.strip);
                if (i >= 0) states[i] = st; else states.push(st);
            }
            sprite = { ...sprite, traits: deep_merge(parent.traits, sprite.traits), states };
        }
        if (!sprite.states.length) throw new Error(`Katalog: Sprite "${id}" hat keine Zustände`);
        resolved[id] = sprite;
        return sprite;
    };
    for (const id of Object.keys(catalog.sprites)) resolve(id);
    return { root, tile: catalog.tile ?? TILE, legend: catalog.legende ?? {}, sprites: resolved };
}

const strip_cache = new Map();
export async function load_strip(root, name) {
    if (strip_cache.has(name)) return strip_cache.get(name);
    const file = path.join(root, 'sprites', `${name}.png`);
    if (!fs.existsSync(file)) throw new Error(`Bild fehlt: sprites/${name}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.height !== TILE || info.width % TILE !== 0)
        throw new Error(`sprites/${name}.png: erwartet ${TILE} px hoch und ein Vielfaches von ${TILE} px breit (ist ${info.width}×${info.height})`);
    const frames = [];
    for (let fi = 0; fi < info.width / TILE; fi++) {
        const raw = Buffer.alloc(TILE * TILE * 4);
        for (let y = 0; y < TILE; y++)
            data.copy(raw, y * TILE * 4, (y * info.width + fi * TILE) * 4, (y * info.width + (fi + 1) * TILE) * 4);
        const png = await sharp(raw, { raw: { width: TILE, height: TILE, channels: 4 } }).png().toBuffer();
        // Same frame naming scheme as the server: sha1 in base 36, 7 characters.
        const tag = BigInt('0x' + crypto.createHash('sha1').update(png).digest('hex')).toString(36).slice(0, 7);
        frames.push({ raw, png, tag });
    }
    strip_cache.set(name, frames);
    return frames;
}

// ---------------------------------------------------- normalisation
// Run the studio's own fix_game_data() so the recorded game has exactly the
// defaults a child's saved game would have.
let fixer = null;
function fix_game_data(data, repo) {
    if (!fixer) {
        const ctx = { console, DEFAULT_WIDTH: TILE, DEFAULT_HEIGHT: TILE, createDataUrlForImageSize: () => undefined };
        vm.createContext(ctx);
        for (const f of ['traits.js', 'game.js'])
            vm.runInContext(fs.readFileSync(path.join(repo, 'src/static', f), 'utf8'), ctx, { filename: f });
        vm.runInContext('globalThis.__fix = (d) => { const g = { data: d }; Game.prototype.fix_game_data.call(g); return g.data; };', ctx);
        fixer = ctx.__fix;
    }
    return JSON.parse(JSON.stringify(fixer(data)));
}

// ------------------------------------------------------------- scenes
function parse_map(text) {
    const lines = String(text).replace(/\r/g, '').split('\n');
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    while (lines.length && !lines[0].trim()) lines.shift();
    return lines;
}

function replace_sprite_refs(value, index_of) {
    if (Array.isArray(value)) return value.map(v => replace_sprite_refs(v, index_of));
    if (is_object(value)) {
        const keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === 'sprite') return index_of(value.sprite);
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = replace_sprite_refs(v, index_of);
        return out;
    }
    return value;
}

function sprite_refs(value, out = []) {
    if (Array.isArray(value)) value.forEach(v => sprite_refs(v, out));
    else if (is_object(value)) {
        const keys = Object.keys(value);
        if (keys.length === 1 && keys[0] === 'sprite') out.push(value.sprite);
        else Object.values(value).forEach(v => sprite_refs(v, out));
    }
    return out;
}

/**
 * Build the game JSON, sprite sheet and scene geometry for one recipe.
 * recipe.szene: { karte | ebenen, legende?, anpassen?, ausschnitt?, himmel?, bereiche? }
 * An `ebenen` entry is a map string or { karte, name?, kollision?, id? }.
 */
export async function build_game(catalog, recipe, repo) {
    const scene = recipe.szene ?? {};
    const layer_defs = (scene.ebenen ?? [scene.karte]).map(e => typeof e === 'string' ? { karte: e } : e ?? {});
    if (!layer_defs[0]?.karte) throw new Error(`${recipe.id}: szene.karte fehlt`);
    const maps = layer_defs.map(e => parse_map(e.karte));
    const rows = Math.max(...maps.map(m => m.length));
    const cols = Math.max(...maps.flat().map(l => l.length));
    const legend = { ...catalog.legend, ...(scene.legende ?? {}) };
    const lookup = ch => {
        const entry = legend[ch];
        if (!entry) throw new Error(`${recipe.id}: Zeichen "${ch}" steht nicht in der Legende`);
        return typeof entry === 'string' ? { sprite: entry } : entry;
    };

    // Sprites in order of first use, plus everything referenced by attacks.
    const used = [];
    const use = id => {
        if (used.includes(id)) return;
        const sprite = catalog.sprites[id];
        if (!sprite) throw new Error(`${recipe.id}: unbekannter Sprite "${id}"`);
        used.push(id);
        const traits = deep_merge(sprite.traits, scene.anpassen?.[id] ?? {});
        sprite_refs(traits).forEach(use);
    };
    for (const map of maps) for (const line of map) for (const ch of line) if (ch !== '.' && ch !== ' ') use(lookup(ch).sprite);
    for (const id of scene.zusaetzlich ?? []) use(id);
    const index_of = id => {
        const i = used.indexOf(id);
        if (i < 0) throw new Error(`${recipe.id}: Sprite "${id}" wird nicht benutzt`);
        return i;
    };

    const sprites = [];
    const frames_by_key = [];
    for (const id of used) {
        const def = catalog.sprites[id];
        const traits = replace_sprite_refs(deep_merge(def.traits, scene.anpassen?.[id] ?? {}), index_of);
        const states = [];
        for (const st of def.states) {
            let frames = await load_strip(catalog.root, st.strip);
            if (st.frames) frames = st.frames.map(i => frames[i]);
            const state_traits = {};
            for (const [trait, names] of Object.entries(st.traits ?? {})) {
                state_traits[trait] = {};
                for (const n of names) state_traits[trait][n] = {};
            }
            states.push({
                properties: { name: path.basename(st.strip), fps: st.fps ?? 8 },
                traits: state_traits,
                frames: frames.map(f => ({ tag: f.tag })),
            });
            frames_by_key.push(frames);
        }
        sprites.push({ width: TILE, height: TILE, traits, states });
    }

    // Placements: characters go to the front layer, maps back-to-front.
    const figures = [];
    const tile_layers = maps.map(() => []);
    maps.forEach((map, li) => map.forEach((line, r) => [...line].forEach((ch, c) => {
        if (ch === '.' || ch === ' ') return;
        const entry = lookup(ch);
        const si = index_of(entry.sprite);
        const placed = [si, c * TILE + TILE / 2, (rows - 1 - r) * TILE];
        if (entry.platziert) placed.push(clone(entry.platziert));
        const traits = sprites[si].traits;
        if ('actor' in traits || 'baddie' in traits) figures.push(placed);
        else tile_layers[li].push(placed);
    })));

    // Recorded area in world pixels (y grows upwards, like the engine).
    const [ax, ay, aw, ah] = scene.ausschnitt ?? [0, 0, cols, rows];
    const view = {
        x0: ax * TILE, x1: (ax + aw) * TILE,
        y0: (rows - ay - ah) * TILE, y1: (rows - ay) * TILE,
    };
    // The engine centres the camera on the bounding box of everything placed
    // in collision layers (when that box fits on screen). Choose the screen
    // height so that the box fits and the recorded area is fully visible.
    const all = [...figures, ...tile_layers.filter((_, i) => layer_defs[i].kollision !== false).flat()];
    const bx0 = Math.min(...all.map(p => p[1] - TILE / 2)), bx1 = Math.max(...all.map(p => p[1] + TILE / 2));
    const by0 = Math.min(...all.map(p => p[2])), by1 = Math.max(...all.map(p => p[2] + TILE));
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    const half_h = Math.max(cy - view.y0, view.y1 - cy, (by1 - by0) / 2);
    const half_w = Math.max(cx - view.x0, view.x1 - cx, (bx1 - bx0) / 2);
    const need = 2 * Math.max(half_h, half_w * 9 / 16) + 2 * TILE;
    const screen_pixel_height = Math.ceil(need / 9) * 9;

    const sky = scene.himmel ?? ['#73eff7', '#f4f4f4'];
    const layer = (name, placed, def = {}) => ({
        type: 'sprites', ...(def.id ? { id: def.id } : {}),
        properties: { name, collision_detection: def.kollision !== false }, sprites: placed,
    });
    // Sichtbarkeitsbereiche: rectangles in tiles [column, row from top, width, height].
    const regions = (scene.bereiche ?? []).map((b, i) => {
        if (!layer_defs.some(d => d.id === b.ziel)) throw new Error(`${recipe.id}: Bereich zielt auf unbekannte Ebene "${b.ziel}"`);
        return {
            type: 'visibility_region', properties: { name: b.name ?? `Sichtbarkeitsbereich ${i + 1}` },
            target_layer_id: b.ziel, inside_visible: b.im_bereich === 'sichtbar',
            ...(b.ueberblendung ? { fade_seconds: b.ueberblendung } : {}),
            rects: b.rechtecke.map(([c, r, w, h]) => ({ left: c * TILE, bottom: (rows - r - h) * TILE, width: w * TILE, height: h * TILE })),
        };
    });
    const level = {
        properties: { name: recipe.titel, background_color: sky[1] },
        layers: [
            ...regions,
            layer('Figuren', figures),
            ...tile_layers.map((p, i) => layer(layer_defs[i].name ?? `Ebene ${i + 1}`, p, layer_defs[i])).reverse(),
            {
                type: 'backdrop', backdrop_type: 'color', properties: { name: 'Himmel' },
                colors: [[sky[0], 0.5, 1.0], [sky[1], 0.5, 0.0]],
                rects: [{ left: -TILE * 4, bottom: -TILE * 4, width: (cols + 8) * TILE, height: (rows + 8) * TILE }],
            },
        ],
    };
    let data = {
        properties: {
            title: recipe.titel, author: '2D Game Studio Rezepte',
            screen_pixel_height, show_energy: false, lives_at_begin: 3, max_lives: 3,
            ...(scene.eigenschaften ?? {}),
        },
        sprites, levels: [level],
    };
    data = fix_game_data(data, repo);
    const sheet = await build_spritesheet(frames_by_key, sprites);
    const tag = 'rz' + crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 5);
    return { tag, data, sheet, view, screen_pixel_height, rows, cols };
}

// Packs frames like the Ruby renderer: 1 px replicated border, then 4x.
async function build_spritesheet(frames_by_state, sprites) {
    const cell = TILE + 2;
    const per_row = Math.floor(SHEET_WIDTH / cell);
    const count = frames_by_state.reduce((n, f) => n + f.length, 0);
    const height = Math.ceil(count / per_row) * cell;
    const sheet = Buffer.alloc(SHEET_WIDTH * height * 4);
    const put = (x, y, src, sx, sy) => src.copy(sheet, (y * SHEET_WIDTH + x) * 4, (sy * TILE + sx) * 4, (sy * TILE + sx) * 4 + 4);
    const tiles = [];
    let k = 0, state_i = 0;
    for (let si = 0; si < sprites.length; si++) {
        tiles.push([]);
        for (let sti = 0; sti < sprites[si].states.length; sti++, state_i++) {
            tiles[si].push([]);
            for (const frame of frames_by_state[state_i]) {
                const x = (k % per_row) * cell, y = Math.floor(k / per_row) * cell;
                for (let yy = -1; yy <= TILE; yy++) for (let xx = -1; xx <= TILE; xx++)
                    put(x + 1 + xx, y + 1 + yy, frame.raw,
                        Math.min(TILE - 1, Math.max(0, xx)), Math.min(TILE - 1, Math.max(0, yy)));
                tiles[si][sti].push([0, (x + 1) * SHEET_FACTOR, (y + 1) * SHEET_FACTOR]);
                k++;
            }
        }
    }
    const png = await sharp(sheet, { raw: { width: SHEET_WIDTH, height, channels: 4 } })
        .resize(SHEET_WIDTH * SHEET_FACTOR, height * SHEET_FACTOR, { kernel: 'nearest' })
        .png({ compressionLevel: 3 }).toBuffer();
    const name = crypto.createHash('sha1').update(png).digest('hex').slice(0, 16) + '.png';
    return {
        png, name,
        info: { spritesheets: [name], tiles, width: SHEET_WIDTH * SHEET_FACTOR, height: height * SHEET_FACTOR },
    };
}

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
        let sprite = { id, label: def.label ?? id, traits: clone(def.traits ?? {}), states: clone(def.states ?? []),
            ...(def.groesse ? { groesse: def.groesse } : {}) };
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
// A strip is a row of frames of size fw×fh (24×24 unless the sprite says
// otherwise with `groesse: [w, h]`).
export async function load_strip(root, name, fw = TILE, fh = TILE) {
    const key = `${name}@${fw}x${fh}`;
    if (strip_cache.has(key)) return strip_cache.get(key);
    const file = path.join(root, 'sprites', `${name}.png`);
    if (!fs.existsSync(file)) throw new Error(`Bild fehlt: sprites/${name}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.height !== fh || info.width % fw !== 0)
        throw new Error(`sprites/${name}.png: erwartet ${fh} px hoch und ein Vielfaches von ${fw} px breit (ist ${info.width}×${info.height})`);
    const frames = [];
    for (let fi = 0; fi < info.width / fw; fi++) {
        const raw = Buffer.alloc(fw * fh * 4);
        for (let y = 0; y < fh; y++)
            data.copy(raw, y * fw * 4, (y * info.width + fi * fw) * 4, (y * info.width + (fi + 1) * fw) * 4);
        const png = await sharp(raw, { raw: { width: fw, height: fh, channels: 4 } }).png().toBuffer();
        // Same frame naming scheme as the server: sha1 in base 36, 7 characters.
        const tag = BigInt('0x' + crypto.createHash('sha1').update(png).digest('hex')).toString(36).slice(0, 7);
        frames.push({ raw, png, tag, w: fw, h: fh });
    }
    strip_cache.set(key, frames);
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
        const [sw, sh] = def.groesse ?? [TILE, TILE];
        for (const st of def.states) {
            let frames = await load_strip(catalog.root, st.strip, sw, sh);
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
        sprites.push({ width: sw, height: sh, traits, states });
    }

    // Placements: characters go to the front layer, maps back-to-front.
    const figures = [];
    const tile_layers = maps.map(() => []);
    maps.forEach((map, li) => map.forEach((line, r) => [...line].forEach((ch, c) => {
        if (ch === '.' || ch === ' ') return;
        const entry = lookup(ch);
        const si = index_of(entry.sprite);
        // Big sprites start at their map cell (left edge) and stand on its bottom.
        const placed = [si, c * TILE + sprites[si].width / 2, (rows - 1 - r) * TILE];
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
    const parallax = i => scene.parallaxe_aus ? 0 : Number(layer_defs[i].parallaxe ?? 0);
    // Layers with parallax never collide and do not count for the level bounds.
    const all = [...figures, ...tile_layers.filter((_, i) => layer_defs[i].kollision !== false && !parallax(i)).flat()];
    const bx0 = Math.min(...all.map(p => p[1] - TILE / 2)), bx1 = Math.max(...all.map(p => p[1] + TILE / 2));
    const by0 = Math.min(...all.map(p => p[2])), by1 = Math.max(...all.map(p => p[2] + TILE));
    const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
    const half_h = Math.max(cy - view.y0, view.y1 - cy, (by1 - by0) / 2);
    const half_w = Math.max(cx - view.x0, view.x1 - cx, (bx1 - bx0) / 2);
    const need = 2 * Math.max(half_h, half_w * 9 / 16) + 2 * TILE;
    let screen_pixel_height = Math.ceil(need / 9) * 9;
    // kamera: { bildhoehe } — a level wider than the screen: the camera follows
    // the player and the whole screen is recorded.
    const follow = scene.kamera?.bildhoehe;
    let view_out = view;
    if (follow) {
        if (follow % 9) throw new Error(`${recipe.id}: kamera.bildhoehe muss durch 9 teilbar sein`);
        screen_pixel_height = follow;
        view_out = 'kamera';
    }
    // The engine shifts a layer by camera × parallax. Place those layers so that
    // they look exactly like their map when the level starts.
    const half_screen_w = screen_pixel_height * 16 / 9 / 2;
    const actor = figures.find(p => 'actor' in sprites[p[0]].traits);
    let cam_x = actor ? actor[1] : cx;
    if (bx1 - bx0 > 2 * half_screen_w) cam_x = Math.min(Math.max(cam_x, bx0 + half_screen_w), bx1 - half_screen_w);
    else cam_x = cx;
    const cam_y = cy;   // levels here are never taller than the screen
    tile_layers.forEach((placed, i) => {
        const p = parallax(i);
        if (!p) return;
        for (const pl of placed) { pl[1] -= cam_x * p; pl[2] -= cam_y * p; }
    });

    // himmel: two colours (top, bottom) or { farben: [[colour, u, v], …] } with
    // 1, 2 or 4 points like the editor's Hintergrund layer. Never a sprite.
    const sky_def = scene.himmel ?? ['#73eff7', '#f4f4f4'];
    const sky_colors = Array.isArray(sky_def) ? [[sky_def[0], 0.5, 1.0], [sky_def[1], 0.5, 0.0]] : sky_def.farben;
    if (![1, 2, 4].includes(sky_colors?.length)) throw new Error(`${recipe.id}: himmel braucht 1, 2 oder 4 Farben`);
    const sky = [sky_colors[0][0], sky_colors[sky_colors.length - 1][0]];
    // effekte: shader backdrops (snow, smoke, fire, lightrays) over the scene.
    const EFFECT_POINTS = {
        snow: [[0.5, 0.0], [0.5, -0.1]], smoke: [[0.5, 0.0], [0.5, -0.1]], fire: [[0.5, 0.0], [0.5, -0.1]],
        lightrays: [[0.5, 0.0], [0.5, -0.1], [0.45, 1.1], [0.55, 1.2]],
    };
    const effect_layer = e => {
        if (!EFFECT_POINTS[e.effekt]) throw new Error(`${recipe.id}: unbekannter Effekt "${e.effekt}"`);
        return {
            type: 'backdrop', backdrop_type: 'effect', effect: e.effekt,
            properties: { name: e.name ?? e.effekt }, scale: e.skala ?? 1.0, speed: e.tempo ?? 1.0,
            color: e.farbe ?? '#ffffffff', control_points: e.punkte ?? EFFECT_POINTS[e.effekt],
            rects: [{ left: -TILE * 4, bottom: 0, width: (cols + 8) * TILE, height: rows * TILE }],
        };
    };
    const effects_front = (scene.effekte ?? []).filter(e => e.vorne !== false).map(effect_layer);
    const effects_back = (scene.effekte ?? []).filter(e => e.vorne === false).map(effect_layer);
    const layer = (name, placed, def = {}) => ({
        type: 'sprites', ...(def.id ? { id: def.id } : {}),
        properties: { name, collision_detection: def.kollision !== false,
            ...(def.parallaxe && !scene.parallaxe_aus ? { parallax: Number(def.parallaxe) } : {}) },
        sprites: placed,
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
    const tile_layer_list = tile_layers.map((p, i) => ({
        vorne: Boolean(layer_defs[i].vorne),
        layer: layer(layer_defs[i].name ?? `Ebene ${i + 1}`, p, layer_defs[i]),
    })).reverse();
    const level = {
        properties: { name: recipe.titel, background_color: sky[1] },
        layers: [
            ...regions,
            ...effects_front,
            // `vorne: true` puts a layer in front of the characters (e.g. water Pip wades through)
            ...tile_layer_list.filter(l => l.vorne).map(l => l.layer),
            layer('Figuren', figures),
            ...tile_layer_list.filter(l => !l.vorne).map(l => l.layer),
            ...effects_back,
            {
                type: 'backdrop', backdrop_type: 'color', properties: { name: 'Himmel' },
                colors: clone(sky_colors),
                // exactly the scene's height: colour positions (0 = bottom, 1 = top) match the picture
                rects: [{ left: -TILE * 4, bottom: 0, width: (cols + 8) * TILE, height: rows * TILE }],
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
    return { tag, data, sheet, view: view_out, screen_pixel_height, rows, cols };
}

// Packs frames like the Ruby renderer: 1 px replicated border, then 4x.
// Frames are laid out in rows (tallest first); with only 24x24 frames this is
// the same grid the recorder has always used.
async function build_spritesheet(frames_by_state, sprites) {
    const items = [];
    let state_i = 0;
    for (let si = 0; si < sprites.length; si++)
        for (let sti = 0; sti < sprites[si].states.length; sti++, state_i++)
            frames_by_state[state_i].forEach((frame, fi) => items.push({ si, sti, fi, frame }));
    const order = [...items].sort((a, b) => b.frame.h - a.frame.h);   // stable
    let x = 0, y = 0, row_h = 0;
    for (const it of order) {
        const cw = it.frame.w + 2, ch = it.frame.h + 2;
        if (x + cw > SHEET_WIDTH) { x = 0; y += row_h; row_h = 0; }
        it.x = x; it.y = y;
        x += cw; row_h = Math.max(row_h, ch);
    }
    const height = y + row_h;
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
    return {
        png, name,
        info: { spritesheets: [name], tiles, width: SHEET_WIDTH * SHEET_FACTOR, height: height * SHEET_FACTOR },
    };
}

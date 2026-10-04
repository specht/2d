// Turns the animation catalogue and a recipe scene into a real game: the
// same JSON the studio saves and the same sprite-sheet layout the server
// renders (see Main.render_spritesheet_for_tag in src/ruby/main.rb).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import sharp from 'sharp';
import YAML from 'yaml';
import { createRequire } from 'node:module';
// the studio's own conversion of level colours (Ganzes Spiel an Palette anpassen)
const { palettize_level_colors } = createRequire(import.meta.url)('../../src/static/palette_apply.js');

export const TILE = 24;
// World x of the left edge of map column 0. The studio's level editor puts the
// centre of a 24-pixel sprite on multiples of 24, so a map cell's centre is
// c × 24: whatever a child paints into a recipe scene lines up with it.
export const X0 = -TILE / 2;
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

// mischmodus: leuchten | aufhellen | abdunkeln (or the engine's add | screen | multiply)
const BLEND = { leuchten: 'add', aufhellen: 'screen', abdunkeln: 'multiply', add: 'add', screen: 'screen', multiply: 'multiply' };
export // A Code in a scene: a whole number 0 … 1000.
function code_of(value, where) {
    if (!Number.isInteger(value) || value < 0 || value > 1000) throw new Error(`${where}: ein Code ist eine ganze Zahl von 0 bis 1000, nicht ${JSON.stringify(value)}`);
    return value;
}

// beim_start: { code, verzoegerung } → signal_level_start (+ _delay)
function level_start_of(value, where) {
    if (value === undefined) return {};
    const code = code_of(value?.code, where);
    const delay = value.verzoegerung ?? 0;
    if (typeof delay !== 'number' || delay < 0 || delay > 60) throw new Error(`${where}: verzoegerung in Sekunden, 0 bis 60`);
    return { signal_level_start: code, ...(delay > 0 ? { signal_level_start_delay: delay } : {}) };
}

// signale: { 3: Tor auf } → signal_names { "3": "Tor auf" } – as the studio stores them
// (signals.js clean_signal_name: at most 24 characters; two Codes never share a name)
function signal_names_of(value, where) {
    if (value === undefined) return {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${where}: Code → Name, z. B. { 3: Tor auf }`);
    const names = {}, seen = new Set();
    for (const [key, raw] of Object.entries(value)) {
        const code = code_of(Number(key), where);
        const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
        if (!name || [...name].length > 24) throw new Error(`${where}: Name für Code ${code} fehlt oder ist länger als 24 Zeichen`);
        if (seen.has(name.toLocaleLowerCase('de'))) throw new Error(`${where}: zwei Codes heißen »${name}«`);
        seen.add(name.toLocaleLowerCase('de'));
        names[String(code)] = name;
    }
    return { signal_names: names };
}

function blend_of(value, where = '') {
    if (value === undefined || value === null || value === 'normal') return undefined;
    if (!BLEND[value]) throw new Error(`${where}unbekannter Mischmodus "${value}" (leuchten, aufhellen, abdunkeln)`);
    return BLEND[value];
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
            ...(def.groesse ? { groesse: def.groesse } : {}),
            ...(def.schwebt ? { schwebt: true } : {}),
            ...(def.mischmodus ? { mischmodus: blend_of(def.mischmodus, `Katalog ${id}: `) } : {}) };
        if (def.extends) {
            const parent = resolve(def.extends, [...stack, id]);
            if (parent.mischmodus && !('mischmodus' in def)) sprite.mischmodus = parent.mischmodus;
            if (parent.schwebt && !('schwebt' in def)) sprite.schwebt = true;
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
    return { root, tile: catalog.tile ?? TILE, legend: catalog.legende ?? {}, sprites: resolved,
        collection: catalogue_collection(catalog) };
}

// The Sprite-Katalog of the sprite basket (sprite_basket.js): every catalogue
// sprite in exactly one group (`sammlung`), or named in `nicht_in_sammlung`
// (sprites made for one recipe only, e.g. the palette demo). A new sprite that
// is in neither stops the build, so nothing is forgotten.
function catalogue_collection(catalog) {
    const seen = new Map();
    const groups = (catalog.sammlung ?? []).map(group => {
        const [name, ids] = Object.entries(group ?? {})[0] ?? [];
        if (!name || !Array.isArray(ids) || !ids.length) throw new Error(`Katalog: Gruppe der Sammlung ohne Namen oder Sprites`);
        for (const id of ids) {
            if (!catalog.sprites[id]) throw new Error(`Katalog: Sammlung „${name}“ nennt unbekannten Sprite "${id}"`);
            if (seen.has(id)) throw new Error(`Katalog: "${id}" steht in „${seen.get(id)}“ und in „${name}“`);
            seen.set(id, name);
        }
        return { name, ids };
    });
    const left_out = new Set(catalog.nicht_in_sammlung ?? []);
    for (const id of left_out) if (seen.has(id)) throw new Error(`Katalog: "${id}" steht in der Sammlung und in nicht_in_sammlung`);
    const missing = Object.keys(catalog.sprites).filter(id => !seen.has(id) && !left_out.has(id));
    if (missing.length) throw new Error(`Katalog: nicht in der Sammlung: ${missing.join(', ')} (in eine Gruppe von sammlung oder in nicht_in_sammlung eintragen)`);
    return groups;
}

// Figures stand on the bottom row of their sprite (see katalog.yaml): the engine
// puts the bottom of the sprite on the ground, so an empty last row makes a
// figure hover in every game it is used in. Flyers and `schwebt: true` are exempt.
const FIGURE_TRAITS = ['actor', 'baddie', 'companion'];
const GROUND_ROLE = /^(right|left|front|back|walk_.*|hunt_.*|flee_.*|landed_.*)$/;
export async function catalogue_grounding_problems(catalog) {
    const problems = [];
    for (const [id, sprite] of Object.entries(catalog.sprites)) {
        const t = sprite.traits;
        if (!FIGURE_TRAITS.some(name => t[name]) || sprite.schwebt) continue;
        if (t.companion?.can_fly || t.baddie?.affected_by_gravity === false) continue;
        const [w, h] = sprite.groesse ?? [TILE, TILE];
        for (const st of sprite.states) {
            const roles = FIGURE_TRAITS.flatMap(name => st.traits?.[name] ?? []);
            if (!roles.some(role => GROUND_ROLE.test(role))) continue;
            let frames = await load_strip(catalog.root, st.strip, w, h);
            const picked = st.frames ?? frames.map((_, i) => i);
            for (const i of picked) {
                const raw = frames[i].raw;
                let touches = false;
                for (let x = 0; x < w && !touches; x++) touches = raw[((h - 1) * w + x) * 4 + 3] > 0;
                if (!touches) problems.push(`${id}: ${st.strip} Bild ${i + 1} steht nicht auf der untersten Pixelreihe`);
            }
        }
    }
    return problems;
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

// ------------------------------------------------------------ palettes
// szene.palette: a palette of the studio (palettes.js, by name) – every sprite is
// converted like "Palette → Sprite an Palette anpassen" does it (DitherJS), and
// the sky gets the nearest palette colours. { name, dithering: ordered |
// diffusion | atkinson } picks the method (default: ordered, the first entry).
let palette_list = null, DitherJS = null;
function studio_palette(repo, spec, where) {
    const name = typeof spec === 'string' ? spec : spec?.name;
    palette_list ??= vm.runInNewContext(fs.readFileSync(path.join(repo, 'src/static/palettes.js'), 'utf8') + ';palettes', {});
    const found = palette_list.find(p => p.name === name);
    if (!found) throw new Error(`${where}unbekannte Palette "${name}" (Namen wie in palettes.js)`);
    const algorithm = { ordered: 'ordered', diffusion: 'diffusion', atkinson: 'atkinson' }[spec?.dithering ?? 'ordered'];
    if (!algorithm) throw new Error(`${where}dithering: ordered, diffusion oder atkinson`);
    const rgb = found.colors.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
    return { name, algorithm, rgb };
}

async function palettize_frames(repo, frames, palette) {
    if (!DitherJS) {
        const { createRequire } = await import('node:module');
        DitherJS = createRequire(import.meta.url)(path.join(repo, 'src/static/ditherjs.dist.js'));
    }
    const out = [];
    for (const f of frames) {
        const img = { width: f.w, height: f.h, data: new Uint8ClampedArray(f.raw) };
        new DitherJS().ditherImageData(img, { step: 1, algorithm: palette.algorithm, palette: palette.rgb });
        const raw = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length);
        const png = await sharp(raw, { raw: { width: f.w, height: f.h, channels: 4 } }).png().toBuffer();
        const tag = BigInt('0x' + crypto.createHash('sha1').update(png).digest('hex')).toString(36).slice(0, 7);
        out.push({ raw, png, tag, w: f.w, h: f.h });
    }
    return out;
}

function nearest_colour(hex, palette) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    let best = palette.rgb[0], bd = Infinity;
    for (const p of palette.rgb) {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = p; }
    }
    return '#' + best.map(v => v.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------- normalisation
// Run the studio's own fix_game_data() so the recorded game has exactly the
// defaults a child's saved game would have.
let fixer = null;
function fix_game_data(data, repo) {
    if (!fixer) {
        const ctx = { console, DEFAULT_WIDTH: TILE, DEFAULT_HEIGHT: TILE, createDataUrlForImageSize: () => undefined };
        vm.createContext(ctx);
        for (const f of ['signals.js', 'traits.js', 'baddie_ai.js', 'game_ids.js', 'game.js'])
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

// signal: { code: 3, reaktion: erscheint, ueberblendung: 0.6 } – how a layer
// or effect reacts to signals (signals.js, "Bei Signal"): erscheint |
// verschwindet | solange_an | solange_aus | wechselt, or the engine's names.
// ueberblendung: seconds (0 … 2), absent = the default fade.
const LAYER_SIGNAL_REAKTIONEN = {
    erscheint: 'appear', verschwindet: 'disappear', solange_an: 'while_on',
    solange_aus: 'while_off', wechselt: 'toggle',
};
function layer_signal_of(signal, where) {
    if (!signal) return {};
    const reaction = LAYER_SIGNAL_REAKTIONEN[signal.reaktion] ?? signal.reaktion;
    if (!Object.values(LAYER_SIGNAL_REAKTIONEN).includes(reaction))
        throw new Error(`${where}unbekannte Signal-Reaktion "${signal.reaktion}"`);
    if (!Number.isInteger(signal.code)) throw new Error(`${where}signal.code fehlt`);
    return { signal_code: signal.code, signal_reaction: reaction,
        ...(signal.ueberblendung !== undefined ? { signal_fade: Number(signal.ueberblendung) } : {}) };
}

/**
 * Build the game JSON, sprite sheet and scene geometry for one recipe.
 * recipe.szene: { karte | ebenen, legende?, anpassen?, ausschnitt?, himmel?, bereiche?, bewegung?, bewegungsbereiche?, alle_besiegt? }
 * An `ebenen` entry is a map string or { karte, name?, kollision?, id?, signal? }.
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

    const palette = scene.palette ? studio_palette(repo, scene.palette, `${recipe.id}: `) : null;
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
            if (palette) frames = await palettize_frames(repo, frames, palette);
            const state_traits = {};
            for (const [trait, names] of Object.entries(st.traits ?? {})) {
                state_traits[trait] = {};
                for (const n of names) state_traits[trait][n] = {};
            }
            states.push({
                properties: { name: path.basename(st.strip), fps: st.fps ?? 8,
                    // phase_r: 0 = all copies animate in step (conveyor belts)
                    ...Object.fromEntries(['phase_x', 'phase_y', 'phase_r'].filter(k => k in st).map(k => [k, st[k]])) },
                traits: state_traits,
                frames: frames.map(f => ({ tag: f.tag })),
            });
            frames_by_key.push(frames);
        }
        const blend = def.mischmodus;
        // the catalogue's label as the sprite's Titel: the studio scene and
        // "Sprites aus einem anderen Spiel holen" show "Pip", not "Sprite 1"
        const title = typeof def.label === 'string' && def.label.trim() ? { properties: { name: def.label.trim() } } : {};
        sprites.push({ width: sw, height: sh, ...(blend ? { blend } : {}), ...title, traits, states });
    }

    // Placements: characters go to the front layer, maps back-to-front.
    const figures = [];
    const tile_layers = maps.map(() => []);
    maps.forEach((map, li) => map.forEach((line, r) => [...line].forEach((ch, c) => {
        if (ch === '.' || ch === ' ') return;
        const entry = lookup(ch);
        const si = index_of(entry.sprite);
        // Big sprites start at their map cell (left edge) and stand on its bottom.
        const placed = [si, c * TILE + X0 + sprites[si].width / 2, (rows - 1 - r) * TILE];
        if (entry.platziert) placed.push(clone(entry.platziert));
        const traits = sprites[si].traits;
        // A key, door, Schalter or Druckplatte without a Code in the recipe takes
        // no part in the Signale: "Kein Signal" (signal_code: null), not 0 – the
        // opened scene shows "kein Signal" instead of a Code nothing else has.
        for (const role of ['key', 'switch', 'pressure_plate', 'door']) {
            if (!(role in traits)) continue;
            placed[3] ??= {};
            placed[3][role] ??= {};
            if (!('signal_code' in placed[3][role])) placed[3][role].signal_code = null;
        }
        // figuren: true keeps characters in their own map layer (e.g. behind a window)
        // (a Begleiter is a character, too)
        if (('actor' in traits || 'baddie' in traits || 'companion' in traits) && !layer_defs[li].figuren) figures.push(placed);
        else tile_layers[li].push(placed);
    })));

    // Recorded area in world pixels (y grows upwards, like the engine).
    const [ax, ay, aw, ah] = scene.ausschnitt ?? [0, 0, cols, rows];
    // bild_hoch: the picture moves up by so many tiles (less floor, more sky)
    const lift = Number(recipe.bild_hoch ?? 0) * TILE;
    const view = {
        x0: ax * TILE + X0, x1: (ax + aw) * TILE + X0,
        y0: (rows - ay - ah) * TILE + lift, y1: (rows - ay) * TILE + lift,
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
    // levels here are never taller than the screen; with kamera the recorder
    // lifts the camera by `lift` (record.mjs)
    const cam_y = cy + (follow ? lift : 0);
    tile_layers.forEach((placed, i) => {
        const p = parallax(i);
        if (!p) return;
        for (const pl of placed) { pl[1] -= cam_x * p; pl[2] -= cam_y * p; }
    });

    // himmel: two colours (top, bottom) or { farben: [[colour, u, v], …] } with
    // 1, 2 or 4 points like the editor's Hintergrund layer. Never a sprite.
    const sky_def = scene.himmel ?? ['#73eff7', '#f4f4f4'];
    let sky_colors = Array.isArray(sky_def) ? [[sky_def[0], 0.5, 1.0], [sky_def[1], 0.5, 0.0]] : sky_def.farben;
    if (palette) sky_colors = sky_colors?.map(([c, u, v]) => [nearest_colour(c, palette), u, v]);
    if (![1, 2, 4].includes(sky_colors?.length)) throw new Error(`${recipe.id}: himmel braucht 1, 2 oder 4 Farben`);
    const sky = [sky_colors[0][0], sky_colors[sky_colors.length - 1][0]];
    // effekte: shader backdrops (snow, smoke, fire, lightrays) over the scene.
    const EFFECT_POINTS = {
        snow: [[0.5, 0.0], [0.5, -0.1]], smoke: [[0.5, 0.0], [0.5, -0.1]], fire: [[0.5, 0.0], [0.5, -0.1]],
        lightrays: [[0.5, 0.0], [0.5, -0.1], [0.45, 1.1], [0.55, 1.2]],
        stars: [[0.5, 1.0], [0.5, 0.25]], aurora: [[0.5, 0.35], [0.5, 1.0]],
        rain: [[0.5, 0.0], [0.5, -0.1]], clouds: [[0.5, 0.0], [0.5, -0.1]],
        fireflies: [[0.5, 0.0], [0.5, -0.1]], bubbles: [[0.5, 0.0], [0.5, -0.1]],
        dust: [[0.5, 0.0], [0.5, -0.1]],
        lightning: [[0.5, 1.0], [0.5, 0.15]],
        current: [[0.5, 0.0], [0.5, -0.1]],
    };
    const effect_layer = e => {
        // effekt: farbe – a colour backdrop in front, e.g. with mischmodus: abdunkeln
        // as a tint over the whole scene. farben: [top, bottom] or [[colour, x, y], …]
        if (e.effekt === 'farbe') {
            const f = e.farben ?? ['#8d9bb5', '#8d9bb5'];
            const colors = typeof f[0] === 'string' ? [[f[0], 0.5, 1.0], [f[f.length - 1], 0.5, 0.0]] : f;
            if (![1, 2, 4].includes(colors.length)) throw new Error(`${recipe.id}: effekt farbe braucht 1, 2 oder 4 Farben`);
            return {
                type: 'backdrop', backdrop_type: 'color', ...(e.id ? { id: e.id } : {}),
                properties: { name: e.name ?? 'Tönung', ...(e.mischmodus ? { blend: blend_of(e.mischmodus, `${recipe.id}: `) } : {}),
                    ...layer_signal_of(e.signal, `${recipe.id}: `) },
                colors: clone(colors),
                // bereich: [column, row from top, width, height] in tiles – e.g. only over a cave
                rects: [e.bereich ?
                    { left: e.bereich[0] * TILE + X0, bottom: (rows - e.bereich[1] - e.bereich[3]) * TILE, width: e.bereich[2] * TILE, height: e.bereich[3] * TILE } :
                    { left: -TILE * 4 + X0, bottom: 0, width: (cols + 8) * TILE, height: rows * TILE }],
            };
        }
        if (!EFFECT_POINTS[e.effekt]) throw new Error(`${recipe.id}: unbekannter Effekt "${e.effekt}"`);
        // parallaxe: the effect moves with the camera by that share (stars far away: 0.9);
        // placed like a parallax map layer, and wide enough for the whole way of the camera
        const p = scene.parallaxe_aus ? 0 : Number(e.parallaxe ?? 0);
        const parallax_props = p ? { parallax: p } : {};
        const whole = { left: -TILE * 4 + X0, bottom: 0, width: (cols + 8) * TILE, height: rows * TILE };
        const level_rect = p ? { left: whole.left - cam_x * p - cols * TILE * p, bottom: whole.bottom - cam_y * p - rows * TILE * p,
            width: whole.width + 2 * cols * TILE * p, height: whole.height + 2 * rows * TILE * p } : whole;
        return {
            type: 'backdrop', backdrop_type: 'effect', effect: e.effekt, ...(e.id ? { id: e.id } : {}),
            properties: { name: e.name ?? e.effekt, ...parallax_props, ...layer_signal_of(e.signal, `${recipe.id}: `) },
            scale: e.skala ?? 1.0, speed: e.tempo ?? 1.0,
            color: e.farbe ?? '#ffffffff', control_points: e.punkte ?? EFFECT_POINTS[e.effekt],
            ...(e.pixel ? { pixelated: true } : {}),
            ...(e.menge !== undefined ? { density: Number(e.menge) } : {}),
            // Gewitter: blitz_alle (s), himmel_leuchtet (0…1), blitze (false = Wetterleuchten)
            ...(e.blitz_alle !== undefined ? { lightning_interval: Number(e.blitz_alle) } : {}),
            ...(e.himmel_leuchtet !== undefined ? { lightning_glow: Number(e.himmel_leuchtet) } : {}),
            ...(e.blitze !== undefined ? { lightning_bolts: Boolean(e.blitze) } : {}),
            ...(e.blitz_aufbau !== undefined ? { lightning_rise: Number(e.blitz_aufbau) } : {}),
            // Strömung: the direction of the streaks in degrees (0 right, 90 up)
            ...(e.richtung !== undefined ? { current_angle: Number(e.richtung) } : {}),
            ...(e.mischmodus ? { properties: { name: e.name ?? e.effekt, ...parallax_props, blend: blend_of(e.mischmodus, `${recipe.id}: `),
                ...layer_signal_of(e.signal, `${recipe.id}: `) } } : {}),
            // bereich: [column, row from top, width, height] in tiles – e.g. only the air above the ground
            rects: [e.bereich ?
                { left: e.bereich[0] * TILE + X0 - cam_x * p, bottom: (rows - e.bereich[1] - e.bereich[3]) * TILE - cam_y * p, width: e.bereich[2] * TILE, height: e.bereich[3] * TILE } :
                level_rect],
        };
    };
    // vorne: false = behind all layers; hinter: <Ebene> = right behind that layer
    // (its name or id, or 'Figuren'); otherwise in front of everything.
    const effects_front = (scene.effekte ?? []).filter(e => e.vorne !== false && !e.hinter).map(effect_layer);
    const effects_back = (scene.effekte ?? []).filter(e => e.vorne === false && !e.hinter).map(effect_layer);
    const effects_between = (scene.effekte ?? []).filter(e => e.hinter);
    const layer = (name, placed, def = {}) => ({
        type: 'sprites', ...(def.id ? { id: def.id } : {}),
        properties: { name, collision_detection: def.kollision !== false,
            ...(def.parallaxe && !scene.parallaxe_aus ? { parallax: Number(def.parallaxe) } : {}),
            ...(def.mischmodus ? { blend: blend_of(def.mischmodus, `${recipe.id}: `) } : {}),
            ...layer_signal_of(def.signal, `${recipe.id}: `) },
        sprites: placed,
    });
    // Bereiche (signals.js): rectangles in tiles [column, row from top, width,
    // height] that send their Code while the figure's centre is inside.
    const regions = (scene.bereiche ?? []).map((b, i) => {
        if (b.ziel !== undefined) throw new Error(`${recipe.id}: Sichtbarkeitsbereiche gibt es nicht mehr – ein Signalbereich hat einen code, die Ebene bekommt signal: { code, reaktion: solange_aus }`);
        if (!Number.isInteger(b.code)) throw new Error(`${recipe.id}: Signalbereich ${i + 1}: code fehlt`);
        return {
            type: 'signal_area', properties: { name: b.name ?? `Signalbereich ${i + 1}`, signal_code: b.code },
            rects: b.rechtecke.map(([c, r, w, h]) => ({ left: c * TILE + X0, bottom: (rows - r - h) * TILE, width: w * TILE, height: h * TILE })),
        };
    });
    // Bewegungsbereiche (movement_regions.js): swimming, floating, other gravity,
    // currents – for the whole level (bewegung) or in rectangles (bewegungsbereiche,
    // later entries lie in front).
    const movement_of = (b, where) => {
        const modes = { schwimmen: 'swim', schweben: 'float', laufen: 'normal', wie_darunter: 'inherit' };
        const mode = modes[b.art];
        if (!mode) throw new Error(`${recipe.id}: ${where}: art muss schwimmen, schweben, laufen oder wie_darunter sein`);
        const out = { mode };
        for (const [de, en] of [['schwerkraft', 'gravity'], ['gleiten', 'glide'], ['tempo', 'speed'], ['schwimmzug', 'stroke']])
            if (b[de] !== undefined) out[en] = Number(b[de]);
        // stroemung: [px/s, Richtung in Grad (0 rechts, 90 oben, 270 unten)]
        if (b.stroemung) out.current = { speed: Number(b.stroemung[0]), angle: Number(b.stroemung[1] ?? 0) };
        return out;
    };
    const movement_regions = (scene.bewegungsbereiche ?? []).map((b, i) => ({
        type: 'movement_region', properties: { name: b.name ?? `Bewegungsbereich ${i + 1}` },
        movement: movement_of(b, `Bewegungsbereich ${i + 1}`),
        rects: b.rechtecke.map(([c, r, w, h]) => ({ left: c * TILE + X0, bottom: (rows - r - h) * TILE, width: w * TILE, height: h * TILE })),
    })).reverse();
    const tile_layer_list = tile_layers.map((p, i) => ({
        vorne: Boolean(layer_defs[i].vorne),
        // a scene with one map (karte) calls it "Welt", like the scenes with several layers do
        layer: layer(layer_defs[i].name ?? (scene.ebenen ? `Ebene ${i + 1}` : 'Welt'), p, layer_defs[i]),
    })).reverse();
    const figure_layers = [layer('Figuren', figures)];
    const level = {
        properties: { name: recipe.titel, background_color: sky[1],
            ...(scene.bewegung ? { movement: movement_of(scene.bewegung, 'bewegung') } : {}),
            // alle_besiegt: 9 – the level sends Code 9 once no enemy is left
            ...(Number.isInteger(scene.alle_besiegt) ? { signal_all_defeated: scene.alle_besiegt } : {}),
            // beim_start: { code: 3, verzoegerung: 30 } – the level sends Code 3 when it starts (a timer)
            ...level_start_of(scene.beim_start, `${recipe.id}: beim_start`),
            // geschafft_bei: 7 – Code 7 completes the level, like the exit
            ...(scene.geschafft_bei !== undefined ? { signal_level_complete: code_of(scene.geschafft_bei, `${recipe.id}: geschafft_bei`) } : {}),
            // signale: { 3: Tor auf } – names of the level's Codes (what the Code fields and the overview show)
            ...signal_names_of(scene.signale, `${recipe.id}: signale`) },
        layers: [
            ...movement_regions,
            ...regions,
            ...effects_front,
            // `vorne: true` puts a layer in front of the characters (e.g. water Pip wades through)
            ...tile_layer_list.filter(l => l.vorne).map(l => l.layer),
            ...figure_layers,
            ...tile_layer_list.filter(l => !l.vorne).map(l => l.layer),
            ...effects_back,
            {
                type: 'backdrop', backdrop_type: 'color', properties: { name: 'Himmel' },
                colors: clone(sky_colors),
                // optional pixel look: himmel: { farben: […], pixel: true, dither: noise | bayer, stufen: 8 }
                ...(sky_def.pixel ? { pixelated: true } : {}),
                ...(sky_def.dither ? { dither: sky_def.dither, dither_levels: sky_def.stufen ?? 8 } : {}),
                // exactly the scene's height: colour positions (0 = bottom, 1 = top) match the picture
                // (and above it, when the picture is lifted: bild_hoch)
                rects: [{ left: -TILE * 4 + X0, bottom: 0, width: (cols + 8) * TILE, height: rows * TILE + (follow ? 0 : Math.max(0, view.y1 - rows * TILE)) }],
            },
        ],
    };
    for (const e of effects_between) {
        const i = level.layers.findIndex(l => l.type === 'sprites' && (l.id === e.hinter || l.properties.name === e.hinter));
        if (i < 0) throw new Error(`${recipe.id}: Effekt ${e.effekt}: unbekannte Ebene "${e.hinter}" bei hinter`);
        level.layers.splice(i + 1, 0, effect_layer(e));
    }
    // szene.palette: the backgrounds' and effects' colours, too (like the studio)
    if (palette) palettize_level_colors(level, palette.rgb);
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
    const pngs = new Map(frames_by_key.flat().map(f => [f.tag, f.png]));
    // used: the catalogue id of every sprite, in the game's order
    return { tag, data, sheet, pngs, view: view_out, screen_pixel_height, rows, cols, camera_lift: follow ? lift : 0, used };
}

// The recipe's scene as a game the studio can open (Hilfe → "Im Studio
// ausprobieren", rezepte.js): the saved-game JSON with every frame's picture
// inside, as /api/load_game returns a game. No parent: it is nobody's version.
export function studio_game(game) {
    const data = JSON.parse(JSON.stringify(game.data));
    for (const sprite of data.sprites) for (const state of sprite.states) for (const frame of state.frames) {
        const png = game.pngs.get(frame.tag);
        if (!png) throw new Error(`${game.tag}: Bild für Frame ${frame.tag} fehlt`);
        frame.src = `data:image/png;base64,${png.toString('base64')}`;
        delete frame.tag;
    }
    data.parent = null;
    return data;
}

// …as the file the build writes (src/static/rezepte/spiele/<id>.json).
export function studio_game_file(game) {
    return Buffer.from(JSON.stringify(studio_game(game)) + '\n');
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

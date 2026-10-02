// Signale: "wenn das passiert, mach das".
//
// A sender sends its Code together with "an" (true) or "aus" (false):
// - a key, when it is collected: an
// - a Schalter, when it is flipped with the action key: an or aus
// - a Druckplatte, when the player steps on it (an) and off it again (aus)
// - a Bereich (layer type signal_area), when the player's centre enters one
//   of its rectangles (an) and leaves them again (aus)
// - an enemy that is defeated (placed baddie.signal_on_defeat): an
// - the level when no enemy is left (properties.signal_all_defeated): an
//
// Receivers with the same Code react, each in its own way:
// - a door: placed property door_reaction (default: unlock, exactly what a
//   key has always done)
// - a layer: properties.signal_code and properties.signal_reaction (it can
//   appear or disappear, fading over properties.signal_fade seconds; a layer
//   that is gone also loses its collisions, and enemies on it wait)
//
// Every Code is stored as signal_code. Keys and doors of older games kept
// theirs as door_code, and Sichtbarkeitsbereiche linked a layer by its id:
// promote_legacy_signals() turns both into the same thing, when the studio
// normalizes a game and when the game runtime loads one.
//
// Signals exist within one level only: every level starts with a new
// SignalBus. The bus remembers nothing; receivers keep their own state (an
// opened door stays open, also when the player dies).

const SIGNAL_MAX_DEPTH = 16;
// A layer that appears or disappears fades in or out this long. Only the
// drawing fades: it collides (or not) from the moment of the signal.
const SIGNAL_LAYER_FADE_SECONDS = 0.3;
const SIGNAL_LAYER_FADE_MAX_SECONDS = 2;

// Überblendung of a layer (properties.signal_fade, 0 … 2 s); absent: the default.
function layer_fade_seconds(properties) {
    const value = properties?.signal_fade;
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
        value <= SIGNAL_LAYER_FADE_MAX_SECONDS ? value : SIGNAL_LAYER_FADE_SECONDS;
}

// Reactions of a door to a signal with its Code (short: the panel is
// narrow; the hint of door_reaction in traits.js explains them).
const DOOR_SIGNAL_REACTIONS = {
    unlock: 'aufschließen',
    open: 'öffnen',
    close: 'schließen',
    follow: 'offen, solange an',
    toggle: 'wechseln',
};

// Reactions of a layer (short: the layer panel is narrow; the hint in
// level_editor.js explains them). appear and while_on start away.
const LAYER_SIGNAL_REACTIONS = {
    none: 'reagiert nicht',
    appear: 'erscheint',
    disappear: 'verschwindet',
    while_on: 'da, solange an',
    while_off: 'weg, solange an',
    toggle: 'wechselt',
};

function signal_key(code) {
    const number = Number(code);
    return Number.isFinite(number) ? String(Math.trunc(number)) : null;
}

class SignalBus {
    constructor() {
        this.receivers = new Map();
        this.depth = 0;
        this.sent = []; // [code, value] in order, for tests and the recipe checks
    }

    connect(code, receiver) {
        const key = signal_key(code);
        if (key === null || typeof receiver !== 'function') return;
        if (!this.receivers.has(key)) this.receivers.set(key, []);
        this.receivers.get(key).push(receiver);
    }

    // Delivers the signal to every receiver of this Code, in the order they
    // were connected. A receiver that sends signals itself cannot start an
    // endless chain: deeper than SIGNAL_MAX_DEPTH, signals are dropped.
    emit(code, value, time = 0) {
        const key = signal_key(code);
        if (key === null || this.depth >= SIGNAL_MAX_DEPTH) return false;
        this.sent.push([Number(key), Boolean(value)]);
        this.depth += 1;
        try {
            for (const receiver of this.receivers.get(key) ?? []) receiver(Boolean(value), time);
        } finally {
            this.depth -= 1;
        }
        return true;
    }
}

// What a door does with a signal: 'unlock', 'open', 'close' or null.
function door_signal_action(reaction, value, closed) {
    switch (reaction ?? 'unlock') {
        case 'unlock': return value ? 'unlock' : null;
        case 'open': return value ? 'open' : null;
        case 'close': return value ? 'close' : null;
        case 'follow': return value ? 'open' : 'close';
        case 'toggle': return closed ? 'open' : 'close';
        default: return value ? 'unlock' : null;
    }
}

function layer_reacts_to_signals(properties) {
    const reaction = properties?.signal_reaction;
    return typeof reaction === 'string' && reaction !== 'none' && reaction in LAYER_SIGNAL_REACTIONS;
}

function layer_visible_at_start(reaction) {
    return !(reaction === 'appear' || reaction === 'while_on');
}

function layer_visible_after(reaction, value, visible) {
    switch (reaction) {
        case 'appear': return value ? true : visible;
        case 'disappear': return value ? false : visible;
        case 'while_on': return Boolean(value);
        case 'while_off': return !value;
        case 'toggle': return !visible;
        default: return visible;
    }
}

// fade: { from, to, started_at, seconds } with opacities 0 … 1. A fade
// reversed halfway goes on from where it is (set from to the current alpha).
function signal_fade_alpha(fade, time) {
    const seconds = fade?.seconds ?? SIGNAL_LAYER_FADE_SECONDS;
    if (!fade || fade.from === fade.to || !Number.isFinite(time) || !Number.isFinite(fade.started_at) ||
        !(seconds > 0))
        return fade?.to ?? 1;
    const progress = Math.max(0, Math.min(1,
        (time - fade.started_at) / (seconds * Math.abs(fade.to - fade.from))));
    // soft start and end (smoothstep)
    return fade.from + (fade.to - fade.from) * progress * progress * (3 - 2 * progress);
}

// Only the moment the action key goes down flips a switch, not every frame
// it is held (a tap on a touch screen holds it for a moment, too).
function switch_flipped(pressed_now, pressed_before) {
    return Boolean(pressed_now) && !pressed_before;
}

// Which placed sprites send or receive a Code. Every Code is stored as
// placed[3][trait].signal_code (absent = 0, the default). An enemy only sends
// when signal_on_defeat is set.
const SIGNAL_SPRITE_ROLES = [
    { trait: 'key', sends: true, one: 'Schlüssel', many: 'Schlüssel' },
    { trait: 'switch', sends: true, one: 'Schalter', many: 'Schalter' },
    { trait: 'pressure_plate', sends: true, one: 'Druckplatte', many: 'Druckplatten' },
    { trait: 'baddie', sends: true, one: 'Gegner', many: 'Gegner',
        active: (props) => props?.signal_on_defeat === true },
    { trait: 'door', sends: false, one: 'Tür', many: 'Türen' },
];

// The role of a placed sprite in the Signale (or null), and its Code.
function placed_signal_role(placed, traits) {
    for (const role of SIGNAL_SPRITE_ROLES) {
        if (!(role.trait in (traits ?? {}))) continue;
        const props = placed?.[3]?.[role.trait];
        if (role.active && !role.active(props)) continue;
        return { role, code: Number(props?.signal_code ?? 0) };
    }
    return null;
}

function valid_signal_rect(rect) {
    return !!rect && ['left', 'bottom', 'width', 'height'].every(key =>
        typeof rect[key] === 'number' && Number.isFinite(rect[key])) && rect.width > 0 && rect.height > 0;
}

// A Bereich: is the point (the player's centre) in one of its rectangles?
// The edges belong to it.
function point_in_signal_rects(rects, x, y) {
    return (rects ?? []).some(rect => valid_signal_rect(rect) &&
        x >= rect.left && x <= rect.left + rect.width && y >= rect.bottom && y <= rect.bottom + rect.height);
}

// For the editor: everything in a level that has this Code.
// traits_of(placed[0]) gives the traits of a placed sprite's sprite.
function signal_partners(level, code, traits_of) {
    const wanted = Number(code);
    const counts = {};
    const layers = [];
    const areas = [];
    (level?.layers ?? []).forEach((layer, li) => {
        const name = layer?.properties?.name || `Ebene ${li + 1}`;
        if (layer?.type === 'sprites') {
            for (const placed of layer.sprites ?? []) {
                const found = placed_signal_role(placed, traits_of(placed[0]));
                if (found && found.code === wanted)
                    counts[found.role.trait] = (counts[found.role.trait] ?? 0) + 1;
            }
        }
        if (layer?.type === 'signal_area' && Number(layer.properties?.signal_code ?? 0) === wanted)
            areas.push(layer.properties?.name || `Bereich ${li + 1}`);
        else if (layer_reacts_to_signals(layer?.properties) && Number(layer.properties.signal_code ?? 0) === wanted)
            layers.push(name);
    });
    const all_defeated = Number.isInteger(level?.properties?.signal_all_defeated) &&
        level.properties.signal_all_defeated === wanted;
    return { counts, layers, areas, all_defeated };
}

// "Code 7 in diesem Level – sendet: 1 Schalter · reagiert: 2 Türen, Ebene »Brücke«"
function describe_signal_partners(code, partners) {
    const list = (sends) => SIGNAL_SPRITE_ROLES.filter(role => role.sends === sends && partners.counts[role.trait])
        .map(role => `${partners.counts[role.trait]} ${partners.counts[role.trait] === 1 ? role.one : role.many}`);
    const senders = [...list(true), ...(partners.areas ?? []).map(name => `Bereich »${name}«`),
        ...(partners.all_defeated ? ['alle Gegner besiegt'] : [])];
    const receivers = [...list(false), ...partners.layers.map(name => `Ebene »${name}«`)];
    const parts = [];
    if (senders.length) parts.push(`sendet: ${senders.join(', ')}`);
    if (receivers.length) parts.push(`reagiert: ${receivers.join(', ')}`);
    if (!senders.length) parts.push('noch nichts sendet diesen Code');
    else if (!receivers.length) parts.push('noch nichts reagiert darauf');
    return `Code ${Number(code)} in diesem Level – ${parts.join(' · ')}`;
}

// ------------------------------------------------- level editor: see and connect
// Everything in a level that sends or receives, with where it is (world
// coordinates, y up). size_of(ref) gives { width, height } of a placed
// sprite's sprite (or null). Kinds: 'sprite' (key, Schalter, Druckplatte,
// Gegner, Tür), 'layer' (a layer that reacts; its box surrounds what is on
// it) and 'area' (a Bereich).
function signal_rect_union(a, b) {
    if (!a) return b;
    if (!b) return a;
    return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

function signal_rect_centre(rect) {
    return { x: (rect.x0 + rect.x1) / 2, y: (rect.y0 + rect.y1) / 2 };
}

function placed_signal_rect(placed, size) {
    return { x0: placed[1] - size.width / 2, x1: placed[1] + size.width / 2, y0: placed[2], y1: placed[2] + size.height };
}

function layer_signal_box(layer, size_of) {
    let box = null;
    if (layer?.type === 'sprites') {
        for (const placed of layer.sprites ?? []) {
            const size = size_of(placed[0]);
            if (size) box = signal_rect_union(box, placed_signal_rect(placed, size));
        }
    } else {
        for (const rect of (layer?.rects ?? []).filter(valid_signal_rect))
            box = signal_rect_union(box, { x0: rect.left, y0: rect.bottom, x1: rect.left + rect.width, y1: rect.bottom + rect.height });
    }
    return box;
}

function signal_objects(level, traits_of, size_of) {
    const objects = [];
    (level?.layers ?? []).forEach((layer, li) => {
        if (layer?.type === 'sprites') {
            (layer.sprites ?? []).forEach((placed, pi) => {
                const size = size_of(placed[0]);
                const found = size && placed_signal_role(placed, traits_of(placed[0]));
                if (!found) return;
                const rect = placed_signal_rect(placed, size);
                objects.push({ kind: 'sprite', layer_index: li, placed_index: pi, trait: found.role.trait,
                    code: found.code, sends: found.role.sends, rect, anchor: signal_rect_centre(rect) });
            });
        }
        const is_area = layer?.type === 'signal_area';
        if (!is_area && !layer_reacts_to_signals(layer?.properties)) return;
        const box = layer_signal_box(layer, size_of);
        if (!box) return;
        objects.push({ kind: is_area ? 'area' : 'layer', layer_index: li, code: Number(layer.properties?.signal_code ?? 0),
            sends: is_area, rect: box, anchor: signal_rect_centre(box),
            rects: is_area ? layer.rects.filter(valid_signal_rect) : null });
    });
    return objects;
}

// Every sender to every receiver of the same Code. codes: a Set, or null for all.
function signal_links(objects, codes = null) {
    const links = [];
    for (const from of objects) {
        if (!from.sends || (codes && !codes.has(from.code))) continue;
        for (const to of objects)
            if (!to.sends && to.code === from.code) links.push({ from, to, code: from.code });
    }
    return links;
}

function same_signal_object(a, b) {
    return !!a && !!b && a.kind === b.kind && a.layer_index === b.layer_index && a.placed_index === b.placed_index;
}

const signal_rect_contains = (rect, x, y) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;

// What the "Verbinden" tool means at a point. Sprites that send or react
// come first (the current layer before the others, front layers first); then,
// looking for a sender, a Bereich before the layer of whatever sprite is
// there – looking for a receiver, that layer before a Bereich. Layers with the
// player character are never a target.
function pick_signal_object(level, x, y, traits_of, size_of, current_layer = null, prefer = 'sender') {
    const layers = level?.layers ?? [];
    const order = [...layers.keys()];
    if (Number.isInteger(current_layer)) order.sort((a, b) => (b === current_layer) - (a === current_layer));
    const visible = li => layers[li]?.properties?.visible !== false;
    const sprites = [], plain_layers = [], areas = [];
    for (const li of order) {
        const layer = layers[li];
        if (!visible(li)) continue;
        if (layer?.type === 'signal_area') {
            const rects = (layer.rects ?? []).filter(valid_signal_rect);
            if (!point_in_signal_rects(rects, x, y)) continue;
            const box = layer_signal_box(layer, size_of);
            areas.push({ kind: 'area', layer_index: li, code: Number(layer.properties?.signal_code ?? 0), sends: true,
                rect: box, anchor: signal_rect_centre(box), rects });
            continue;
        }
        if (layer?.type !== 'sprites') continue;
        let plain_hit = Infinity; // the smallest plain sprite there (the most specific)
        for (let pi = (layer.sprites ?? []).length - 1; pi >= 0; pi--) {
            const placed = layer.sprites[pi];
            const size = size_of(placed[0]);
            if (!size || !signal_rect_contains(placed_signal_rect(placed, size), x, y)) continue;
            const traits = traits_of(placed[0]) ?? {};
            const role = SIGNAL_SPRITE_ROLES.find(role => role.trait in traits);
            if (!role) {
                plain_hit = Math.min(plain_hit, size.width * size.height);
                continue;
            }
            // an enemy that does not send yet has no Code yet
            const found = placed_signal_role(placed, traits);
            const rect = placed_signal_rect(placed, size);
            sprites.push({ kind: 'sprite', layer_index: li, placed_index: pi, trait: role.trait,
                code: found ? found.code : null, sends: role.sends, rect, anchor: signal_rect_centre(rect) });
        }
        if (plain_hit === Infinity || (layer.sprites ?? []).some(placed => 'actor' in (traits_of(placed[0]) ?? {}))) continue;
        const box = layer_signal_box(layer, size_of);
        plain_layers.push({ kind: 'layer', layer_index: li, code: layer_reacts_to_signals(layer.properties) ?
            Number(layer.properties.signal_code ?? 0) : null, sends: false, rect: box, anchor: signal_rect_centre(box),
            hit_area: plain_hit });
    }
    // a small sprite under the pointer is meant rather than a big picture behind or over it
    plain_layers.sort((a, b) => a.hit_area - b.hit_area);
    const wanted = prefer !== 'receiver';
    const candidates = [
        ...sprites.filter(o => o.sends === wanted), ...sprites.filter(o => o.sends !== wanted),
        ...(wanted ? [...areas, ...plain_layers] : [...plain_layers, ...areas]),
    ];
    return candidates[0] ?? null;
}

// Connects two objects (the "Verbinden" tool) and returns the Code they now
// share. A Code that already connects one of them to something else is kept
// (0, the default, does not count: it stays with the old key/door pairs);
// otherwise both get a free Code. What reacts gets a sensible reaction if it
// had none: a door follows a Schalter, a Druckplatte or a Bereich, opens for
// an enemy and stays a lock for a key; a layer appears.
function connect_signal_objects(level, a, b, traits_of, size_of) {
    if (!a || !b || same_signal_object(a, b)) return null;
    const objects = signal_objects(level, traits_of, size_of);
    const shared = (o) => Number.isInteger(o.code) && o.code !== 0 &&
        objects.some(other => other.code === o.code && !same_signal_object(other, o) && !same_signal_object(other, o === a ? b : a));
    const code = shared(a) ? a.code : shared(b) ? b.code :
        (Number.isInteger(a.code) && a.code !== 0 && a.code === b.code) ? a.code : free_signal_code(level);
    const sender = a.sends ? a : b.sends ? b : a;
    for (const o of [a, b]) set_signal_object_code(level, o, code, o === sender ? null : sender);
    return code;
}

function set_signal_object_code(level, object, code, sender) {
    const layer = level.layers[object.layer_index];
    if (object.kind === 'sprite') {
        const placed = layer.sprites[object.placed_index];
        if (!placed[3] || typeof placed[3] !== 'object') placed[3] = {};
        const props = placed[3][object.trait] ??= {};
        props.signal_code = code;
        if (object.trait === 'baddie') props.signal_on_defeat = true;
        if (object.trait === 'door' && sender && (props.door_reaction ?? 'unlock') === 'unlock') {
            const reaction = sender.kind === 'area' || ['switch', 'pressure_plate'].includes(sender.trait) ? 'follow' :
                sender.trait === 'baddie' ? 'open' : null;
            if (reaction) props.door_reaction = reaction;
        }
        return;
    }
    if (!layer.properties || typeof layer.properties !== 'object') layer.properties = {};
    layer.properties.signal_code = code;
    if (object.kind === 'layer' && !layer_reacts_to_signals(layer.properties)) layer.properties.signal_reaction = 'appear';
}

// ---------------------------------------------------------- older games
// Every Code the level uses, so a new one can be found (a free Code).
function signal_codes_in_level(level) {
    const used = new Set([0]);
    const add = (value) => { const number = Number(value); if (Number.isInteger(number)) used.add(number); };
    for (const layer of level?.layers ?? []) {
        add(layer?.properties?.signal_code);
        if (layer?.type !== 'sprites') continue;
        for (const placed of layer.sprites ?? []) {
            const props = placed?.[3];
            if (!props || typeof props !== 'object') continue;
            for (const trait of Object.keys(props)) {
                add(props[trait]?.signal_code);
                add(props[trait]?.door_code);
            }
        }
    }
    add(level?.properties?.signal_all_defeated);
    return used;
}

// The smallest Code from 1 on that nothing in the level uses.
function free_signal_code(level, also_taken = new Set()) {
    const used = signal_codes_in_level(level);
    let code = 1;
    while (used.has(code) || also_taken.has(code)) code++;
    return code;
}

function promote_door_code(props) {
    if (!props || typeof props !== 'object' || !('door_code' in props)) return;
    // a Code stored the new way wins
    if (!('signal_code' in props)) props.signal_code = props.door_code;
    delete props.door_code;
}

// Old games, silently and deterministically (the same JSON always becomes
// the same): door_code becomes signal_code, and a Sichtbarkeitsbereich
// becomes a Bereich with a free Code, its target layer reacting to that Code
// ("da/weg, solange an", with the old Überblendung). Unlike a
// Sichtbarkeitsbereich, a layer that is away does not collide either; facades
// and roofs never did.
function promote_legacy_signals(data) {
    if (!data || typeof data !== 'object') return data;
    for (const sprite of Array.isArray(data.sprites) ? data.sprites : [])
        promote_door_code(sprite?.traits?.baddie?.drop);
    for (const level of Array.isArray(data.levels) ? data.levels : []) {
        const layers = Array.isArray(level?.layers) ? level.layers : [];
        for (const layer of layers) {
            if (layer?.type !== 'sprites' || !Array.isArray(layer.sprites)) continue;
            for (const placed of layer.sprites) {
                promote_door_code(placed?.[3]?.key);
                promote_door_code(placed?.[3]?.door);
            }
        }
        if (!layers.some(layer => layer?.type === 'visibility_region')) continue;
        // targets exactly as Sichtbarkeitsbereiche found them: a unique layer id,
        // targeted by exactly one region with at least one valid rectangle
        const ids = new Map();
        layers.forEach((layer, i) => {
            if (!layer || layer.type === 'visibility_region' || typeof layer.id !== 'string' || !layer.id) return;
            ids.set(layer.id, ids.has(layer.id) ? null : i);
        });
        const targeted = new Map();
        for (const layer of layers) {
            if (layer?.type === 'visibility_region' && typeof layer.target_layer_id === 'string')
                targeted.set(layer.target_layer_id, (targeted.get(layer.target_layer_id) ?? 0) + 1);
        }
        const taken = new Set();
        for (const layer of layers) {
            if (layer?.type !== 'visibility_region') continue;
            const code = free_signal_code(level, taken);
            taken.add(code);
            const index = ids.get(layer.target_layer_id);
            const target = Number.isInteger(index) && targeted.get(layer.target_layer_id) === 1 ? layers[index] : null;
            const rects = Array.isArray(layer.rects) ? layer.rects.filter(valid_signal_rect) : [];
            if (target && rects.length && !layer_reacts_to_signals(target.properties)) {
                if (!target.properties || typeof target.properties !== 'object') target.properties = {};
                target.properties.signal_code = code;
                target.properties.signal_reaction = layer.inside_visible === true ? 'while_on' : 'while_off';
                const fade = layer.fade_seconds;
                target.properties.signal_fade = typeof fade === 'number' && Number.isFinite(fade) &&
                    fade >= 0 && fade <= SIGNAL_LAYER_FADE_MAX_SECONDS ? fade : 0;
            }
            layer.type = 'signal_area';
            if (!layer.properties || typeof layer.properties !== 'object') layer.properties = {};
            layer.properties.signal_code = code;
            delete layer.target_layer_id;
            delete layer.inside_visible;
            delete layer.fade_seconds;
        }
    }
    return data;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SIGNAL_MAX_DEPTH, SIGNAL_LAYER_FADE_SECONDS, SIGNAL_LAYER_FADE_MAX_SECONDS, signal_fade_alpha,
        layer_fade_seconds, DOOR_SIGNAL_REACTIONS, LAYER_SIGNAL_REACTIONS, SignalBus,
        door_signal_action, layer_reacts_to_signals, layer_visible_at_start, layer_visible_after,
        switch_flipped, SIGNAL_SPRITE_ROLES, placed_signal_role, valid_signal_rect, point_in_signal_rects,
        signal_partners, describe_signal_partners, signal_codes_in_level, free_signal_code,
        signal_objects, signal_links, same_signal_object, pick_signal_object, connect_signal_objects,
        promote_legacy_signals,
    };
}

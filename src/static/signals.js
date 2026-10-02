// Signale: "wenn das passiert, mach das".
//
// A sender sends its Code together with "an" (true) or "aus" (false):
// - a key, when it is collected: an (also a key an enemy leaves behind; its
//   Code is the placed enemy's baddie.drop_code, see loot_key_code)
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
// SignalBus. The bus remembers nothing but signals that are still on their
// way; receivers keep their own state (an opened door stays open, also when
// the player dies).
//
// Verzögerung: a sender may send later (placed signal_delay of a key,
// Schalter, Druckplatte or enemy; properties.signal_delay of a Bereich;
// level.properties.signal_all_defeated_delay; absent or 0 = at once). Every
// signal arrives that much later, "an" and "aus" alike and in the order they
// were sent – like an echo, not a timer that starts again.
// A door can also close again by itself (placed door.close_after).
//
// Namen: a level may give its Codes names (level.properties.signal_names,
// e.g. { "4": "Brücke" }; absent = numbers only). Editor-only: the game never
// reads them, and the Code itself stays the number everywhere, so a typo in a
// name can never split one signal into two.

const SIGNAL_MAX_DEPTH = 16;
// Verzögerung and "schließt wieder nach": 0 … 60 s
const SIGNAL_DELAY_MAX_SECONDS = 60;
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

// Seconds of a Verzögerung (or of "schließt wieder nach"): anything that is
// not a positive number is 0 (at once / never), more than the maximum is the
// maximum.
function signal_delay_seconds(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ?
        Math.min(value, SIGNAL_DELAY_MAX_SECONDS) : 0;
}

// ------------------------------------------------------------- Namen
// A name is a label for a Code in one level, nothing more: senders and
// receivers still meet by the number. Absent or empty = no name.
const SIGNAL_NAME_MAX_LENGTH = 24;

// What is stored: trimmed, inner whitespace as single spaces, at most
// SIGNAL_NAME_MAX_LENGTH characters. Anything that is not a string is ''.
function clean_signal_name(text) {
    if (typeof text !== 'string') return '';
    return [...text.replace(/\s+/g, ' ').trim()].slice(0, SIGNAL_NAME_MAX_LENGTH).join('').trim();
}

function signal_names_of(level) {
    const names = level?.properties?.signal_names;
    return names && typeof names === 'object' && !Array.isArray(names) ? names : null;
}

// The name of a Code in this level, or ''.
function signal_name(level, code) {
    const key = signal_key(code);
    const names = signal_names_of(level);
    return key === null || !names ? '' : clean_signal_name(names[key]);
}

// The Code that already has this name (compared without case and outer
// spaces), or null. except: a Code to leave out (the one being renamed).
function signal_code_named(level, name, except = null) {
    const wanted = clean_signal_name(name).toLocaleLowerCase('de');
    const names = signal_names_of(level);
    if (!wanted || !names) return null;
    for (const [key, value] of Object.entries(names)) {
        if (signal_key(key) !== key || (except !== null && signal_key(except) === key)) continue;
        if (clean_signal_name(value).toLocaleLowerCase('de') === wanted) return Number(key);
    }
    return null;
}

// Gives a Code a name ('' removes it). Two Codes of one level never share a
// name – that would be as confusing as two signals with one name. Returns
// { ok: true, name } or { ok: false, taken_by: code }. The last name removed
// also removes signal_names, so a level without names saves as before.
function set_signal_name(level, code, name) {
    const key = signal_key(code);
    if (key === null || !level || typeof level !== 'object') return { ok: false, taken_by: null };
    const clean = clean_signal_name(name);
    const taken_by = signal_code_named(level, clean, Number(key));
    if (taken_by !== null) return { ok: false, taken_by };
    if (!level.properties || typeof level.properties !== 'object') level.properties = {};
    const names = signal_names_of(level);
    if (clean) {
        if (!names) level.properties.signal_names = {};
        level.properties.signal_names[key] = clean;
    } else if (names) {
        delete names[key];
        if (!Object.keys(names).length) delete level.properties.signal_names;
    }
    return { ok: true, name: clean };
}

// A suggestion that no Code of the level has yet: "Schalter → Tor", else
// "Schalter → Tor 2", "… 3" (cleaned and shortened like every name).
function unique_signal_name(level, suggestion) {
    const base = clean_signal_name(suggestion);
    if (!base || signal_code_named(level, base) === null) return base;
    for (let n = 2; ; n++) {
        const suffix = ` ${n}`;
        const name = clean_signal_name([...base].slice(0, SIGNAL_NAME_MAX_LENGTH - suffix.length).join('').trim() + suffix);
        if (signal_code_named(level, name) === null) return name;
    }
}

// »Brücke« (Code 4) or Code 4: how a Code is written in sentences.
function signal_code_text(code, name = '') {
    return name ? `»${name}« (Code ${Number(code)})` : `Code ${Number(code)}`;
}

class SignalBus {
    constructor() {
        this.receivers = new Map();
        this.depth = 0;
        this.sent = []; // [code, value] in order of arrival, for tests and the recipe checks
        // signals on their way: { code, value, at, seq, from }, sorted by at, then seq
        this.pending = [];
        this.seq = 0;
        // set while the level decides "at once" (start, respawn): no delays, no fades
        this.immediate = false;
    }

    // What senders call. delay: seconds (absent/0: at once). from: whoever
    // sent it (any object), so that deciding at once (immediate) can take back
    // what that sender still has on its way – otherwise a Bereich left by dying
    // would say "an" again a moment after the respawn.
    send(code, value, time = 0, { delay = 0, from = null } = {}) {
        const seconds = signal_delay_seconds(delay);
        if (this.immediate && from !== null)
            this.pending = this.pending.filter(item => item.from !== from);
        if (seconds === 0 || this.immediate) return this.emit(code, value, time);
        if (signal_key(code) === null) return false;
        const item = { code, value: Boolean(value), at: time + seconds, seq: this.seq++, from };
        let i = this.pending.length;
        while (i > 0 && this.pending[i - 1].at > item.at) i--;
        this.pending.splice(i, 0, item);
        return true;
    }

    // Delivers every signal that is due by this time (call once per step).
    // A signal arrives at its own moment (at), as if it had just been sent.
    deliver_due(time) {
        let count = 0;
        while (this.pending.length && this.pending[0].at <= time) {
            const item = this.pending.shift();
            this.emit(item.code, item.value, item.at);
            count++;
        }
        return count;
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

// How a door opens: set at the drawing (traits.door.lockable / automatic /
// ...); a placed door may decide otherwise (placed door.lockable / automatic,
// true or false; absent = as drawn). So one door drawing can be a plain door
// in one place and a gate that only a Schalter opens in another.
function door_setting(placed_value, drawn_value) {
    return typeof placed_value === 'boolean' ? placed_value : Boolean(drawn_value);
}

// "schließt wieder nach" (placed door.close_after, absent/0 = stays open): one
// step for one door. The time starts when the door is fully open (open and
// not moving); whatever opens it again while it is open (a signal, or the
// figure in front of an automatic door) starts it again (open_door_intent).
// When the time is up but somebody stands in the door, it waits.
// occupied: a function, asked only when the time is up.
// Returns { close_at, close }: the new time to close (or null) and whether
// to close now.
function door_auto_close_step(close_after, close_at, open_and_still, occupied, time) {
    const seconds = signal_delay_seconds(close_after);
    if (seconds === 0 || !open_and_still) return { close_at: null, close: false };
    if (close_at === null || close_at === undefined) return { close_at: time + seconds, close: false };
    if (time < close_at || (typeof occupied === 'function' && occupied())) return { close_at, close: false };
    return { close_at: null, close: true };
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

// Which placed sprites send or receive a Code. Their Code is stored as
// placed[3][trait].signal_code (absent = 0, the default). An enemy only sends
// when signal_on_defeat is set. What a sprite is (a key, a Schalter, a door)
// belongs to its drawing; what it is connected to belongs to each placed copy,
// so one drawing can be used for different connections.
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

// Beute: an enemy that leaves a key behind sends that key's Code when the key
// is collected. The Code belongs to the placed enemy (placed baddie.drop_code);
// absent = the Code set at the drawing (traits.baddie.drop.signal_code, which is
// all that older games have), and 0 without either.
const SIGNAL_LOOT_ROLE = { trait: 'baddie', id: 'loot', sends: true, one: 'Gegner mit Schlüssel', many: 'Gegner mit Schlüssel' };

// The loot key's Code of a placed enemy, or null if it does not leave a key.
// traits_of(ref) gives the traits of a sprite (ref: its id, or its index in
// the game runtime).
function loot_key_code(placed_props, baddie_traits, traits_of) {
    const drop = baddie_traits?.drop;
    if (!drop || typeof drop !== 'object' || typeof traits_of !== 'function') return null;
    const loot = traits_of(drop.sprite_id ?? drop.sprite_index);
    if (!loot || !('key' in loot)) return null;
    return effective_loot_code(placed_props, drop);
}

// The Code a dropped key gets: the placed enemy's own, else the drawing's.
function effective_loot_code(placed_props, drop) {
    const own = placed_props?.drop_code;
    if (Number.isInteger(own)) return own;
    return Number.isInteger(drop?.signal_code) ? drop.signal_code : 0;
}

// Every role of a placed sprite (an enemy may send when defeated and also
// leave a key behind), each with its Code.
function placed_signal_roles(placed, traits, traits_of = null) {
    const roles = [];
    const found = placed_signal_role(placed, traits);
    if (found) roles.push(found);
    if (traits && 'baddie' in traits) {
        const code = loot_key_code(placed?.[3]?.baddie, traits.baddie, traits_of);
        if (code !== null) roles.push({ role: SIGNAL_LOOT_ROLE, code });
    }
    return roles;
}

// Newly placed Schalter and Druckplatten get a free Code, so they never start
// something by accident (0 stays with the key/door pairs of older games, where
// it has always been the default). Keys and doors keep 0: a key and a door
// placed without a Code still belong together. placed_list: placed sprites
// that are already in the level (or about to be added: also_taken).
const NEW_SENDER_TRAITS = ['switch', 'pressure_plate'];

function give_new_senders_codes(level, placed_list, traits_of) {
    const taken = new Set();
    for (const placed of placed_list ?? []) {
        const traits = traits_of(placed?.[0]) ?? {};
        const trait = NEW_SENDER_TRAITS.find(trait => trait in traits);
        if (!trait) continue;
        if (!placed[3] || typeof placed[3] !== 'object') placed[3] = {};
        const props = placed[3][trait] ??= {};
        if ('signal_code' in props) continue;
        props.signal_code = free_signal_code(level, taken);
        taken.add(props.signal_code);
    }
}

// "sendet, wenn besiegt" switched on: an enemy without a Code yet gets a free
// one. A Code that is already there (also 0, typed in on purpose) stays.
function give_defeat_sender_code(level, baddie_props) {
    if (!baddie_props || baddie_props.signal_on_defeat !== true || 'signal_code' in baddie_props) return;
    baddie_props.signal_code = free_signal_code(level);
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
                for (const found of placed_signal_roles(placed, traits_of(placed[0]), traits_of)) {
                    const id = found.role.id ?? found.role.trait;
                    if (found.code === wanted) counts[id] = (counts[id] ?? 0) + 1;
                }
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
// (with a name: "»Brücke« (Code 7) in diesem Level – …")
function describe_signal_partners(code, partners, name = '') {
    const list = (sends) => [...SIGNAL_SPRITE_ROLES, SIGNAL_LOOT_ROLE]
        .filter(role => role.sends === sends && partners.counts[role.id ?? role.trait])
        .map(role => {
            const count = partners.counts[role.id ?? role.trait];
            return `${count} ${count === 1 ? role.one : role.many}`;
        });
    const senders = [...list(true), ...(partners.areas ?? []).map(name => `Bereich »${name}«`),
        ...(partners.all_defeated ? ['alle Gegner besiegt'] : [])];
    const receivers = [...list(false), ...partners.layers.map(name => `Ebene »${name}«`)];
    const parts = [];
    if (senders.length) parts.push(`sendet: ${senders.join(', ')}`);
    if (receivers.length) parts.push(`reagiert: ${receivers.join(', ')}`);
    if (!senders.length) parts.push('noch nichts sendet diesen Code');
    else if (!receivers.length) parts.push('noch nichts reagiert darauf');
    return `${signal_code_text(code, clean_signal_name(name))} in diesem Level – ${parts.join(' · ')}`;
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
                if (!size) return;
                // an enemy can be there twice: sends when defeated, and leaves a key
                for (const found of placed_signal_roles(placed, traits_of(placed[0]), traits_of)) {
                    const rect = placed_signal_rect(placed, size);
                    objects.push({ kind: 'sprite', layer_index: li, placed_index: pi, trait: found.role.trait,
                        role: found.role.id ?? found.role.trait,
                        code: found.code, sends: found.role.sends, rect, anchor: signal_rect_centre(rect) });
                }
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

// ------------------------------------------- level editor: the overview
// Every Code of a level as a rule card: "Wenn … dann …" (Signale-Übersicht in
// the level editor). traits_of(ref) gives a sprite's traits, name_of(ref) its
// label ("Schalter", "Sprite 3"). A card: { code, name, senders, receivers, problem }
// with lines { text, count, objects } (objects to select: { kind, layer_index,
// placed_index }), problem 'no_receiver' | 'no_sender' | null. Doors that only
// open like a plain door (not verschließbar, Bei Signal: aufschließen) are no
// receivers here: they do not wait for anything.
function signal_seconds_text(seconds) {
    return `${String(Math.round(seconds * 10) / 10).replace('.', ',')} s`;
}

const SIGNAL_SENDER_TEXT = {
    key: (n) => `»${n}« eingesammelt wird`,
    switch: (n) => `»${n}« umgelegt wird`,
    pressure_plate: (n) => `die Spielfigur auf »${n}« tritt`,
    baddie: (n) => `»${n}« besiegt ist`,
    loot: (n) => `der Schlüssel von »${n}« eingesammelt wird`,
};
// what "aus" means for a sender that also sends it
const SIGNAL_SENDER_OFF_TEXT = {
    switch: 'Zurücklegen schickt „aus“',
    pressure_plate: 'Heruntergehen schickt „aus“',
    area: 'Hinausgehen schickt „aus“',
};
const SIGNAL_DOOR_TEXT = {
    unlock: (n) => `ist »${n}« aufgeschlossen`,
    open: (n) => `öffnet sich »${n}«`,
    close: (n) => `schließt sich »${n}«`,
    follow: (n) => `öffnet sich »${n}« (bei „aus“ wieder zu)`,
    toggle: (n) => `geht »${n}« bei jedem Signal auf oder zu`,
};
const SIGNAL_LAYER_TEXT = {
    appear: (w) => `erscheint ${w}`,
    disappear: (w) => `verschwindet ${w}`,
    while_on: (w) => `erscheint ${w} (bei „aus“ wieder weg)`,
    while_off: (w) => `verschwindet ${w} (bei „aus“ wieder da)`,
    toggle: (w) => `erscheint oder verschwindet ${w} bei jedem Signal`,
};
// receivers that do something with "aus", too
const SIGNAL_OFF_REACTIONS = new Set(['follow', 'toggle', 'while_on', 'while_off']);

function signal_rules(level, traits_of, name_of) {
    const cards = new Map();
    const card = (code) => {
        if (!cards.has(code)) cards.set(code, { code, senders: [], receivers: [], off: new Set(), reacts_to_off: false });
        return cards.get(code);
    };
    const add = (list, text, object) => {
        const line = list.find(line => line.text === text);
        if (line) { line.count++; if (object) line.objects.push(object); return; }
        list.push({ text, count: 1, objects: object ? [object] : [] });
    };
    const delay_text = (value) => {
        const seconds = signal_delay_seconds(value);
        return seconds > 0 ? ` (kommt nach ${signal_seconds_text(seconds)} an)` : '';
    };
    (level?.layers ?? []).forEach((layer, li) => {
        const layer_name = layer?.properties?.name || `Ebene ${li + 1}`;
        if (layer?.type === 'sprites') {
            (layer.sprites ?? []).forEach((placed, pi) => {
                const traits = traits_of(placed?.[0]) ?? {};
                const name = name_of(placed?.[0]) || 'Sprite';
                const object = { kind: 'sprite', layer_index: li, placed_index: pi };
                for (const found of placed_signal_roles(placed, traits, traits_of)) {
                    const id = found.role.id ?? found.role.trait;
                    const props = placed?.[3]?.[found.role.trait] ?? {};
                    if (found.role.sends) {
                        const target = card(found.code);
                        add(target.senders, SIGNAL_SENDER_TEXT[id](name) + (id === 'loot' ? '' : delay_text(props.signal_delay)), object);
                        if (SIGNAL_SENDER_OFF_TEXT[id]) target.off.add(SIGNAL_SENDER_OFF_TEXT[id]);
                        continue;
                    }
                    // a door
                    const reaction = props.door_reaction ?? 'unlock';
                    if (reaction === 'unlock' && !door_setting(props.lockable, traits.door?.lockable)) continue;
                    const target = card(found.code);
                    add(target.receivers, (SIGNAL_DOOR_TEXT[reaction] ?? SIGNAL_DOOR_TEXT.unlock)(name), object);
                    if (SIGNAL_OFF_REACTIONS.has(reaction)) target.reacts_to_off = true;
                }
            });
        }
        const code = Number(layer?.properties?.signal_code ?? 0);
        if (layer?.type === 'signal_area') {
            const target = card(code);
            add(target.senders, `die Spielfigur in den Bereich »${layer.properties?.name || `Bereich ${li + 1}`}« läuft` +
                delay_text(layer.properties?.signal_delay), { kind: 'area', layer_index: li });
            target.off.add(SIGNAL_SENDER_OFF_TEXT.area);
        } else if (layer_reacts_to_signals(layer?.properties)) {
            const reaction = layer.properties.signal_reaction;
            const what = layer.type === 'sprites' ? `die Ebene »${layer_name}«` : `der Hintergrund »${layer_name}«`;
            const target = card(code);
            add(target.receivers, SIGNAL_LAYER_TEXT[reaction](what), { kind: 'layer', layer_index: li });
            if (SIGNAL_OFF_REACTIONS.has(reaction)) target.reacts_to_off = true;
        }
    });
    const all = level?.properties?.signal_all_defeated;
    if (Number.isInteger(all))
        add(card(all).senders, 'alle Gegner besiegt sind' + delay_text(level.properties.signal_all_defeated_delay), null);
    return [...cards.values()].sort((a, b) => a.code - b.code).map(c => ({
        code: c.code,
        name: signal_name(level, c.code), // '' without a name
        senders: c.senders,
        receivers: c.receivers,
        // "aus" only where something does something with it
        off: c.reacts_to_off ? [...c.off] : [],
        problem: !c.receivers.length ? 'no_receiver' : !c.senders.length ? 'no_sender' : null,
    }));
}

// ------------------------------------- copying between levels: names travel
// Every Code a placed sprite stores: [props, key] for the signal_code of
// each trait and an enemy's drop_code (integers only).
function placed_signal_fields(placed) {
    const fields = [];
    const all = placed?.[3];
    if (!all || typeof all !== 'object') return fields;
    for (const props of Object.values(all)) {
        if (!props || typeof props !== 'object') continue;
        for (const key of ['signal_code', 'drop_code'])
            if (Number.isInteger(props[key])) fields.push([props, key]);
    }
    return fields;
}

// The names of the Codes these placed sprites use, { "4": "Brücke" }, or
// null without any (what the clipboard takes along from its level).
function signal_names_for_placed(level, items) {
    let names = null;
    for (const placed of items ?? [])
        for (const [props, key] of placed_signal_fields(placed)) {
            const name = signal_name(level, props[key]);
            if (name) (names ??= {})[String(props[key])] = name;
        }
    return names;
}

// Pasted into a level, a named Code keeps its name – the name wins:
// - the level has that name already (on any Code): the pasted sprites join
//   that Code ("Brücke" is "Brücke")
// - else, the level has the same number without a name: it gets the name
//   (the pasted sprites join that number, as unnamed Codes always have)
// - else (the same number has another name here): a free Code with the name
// Unnamed Codes keep their number, exactly as before. items: the pasted
// copies (changed in place). names: from signal_names_for_placed. Returns
// { from: to } for every Code that changed.
function carry_signal_names(level, items, names) {
    const changed = {};
    if (!level || !names || typeof names !== 'object') return changed;
    const taken = new Set();
    for (const placed of items ?? []) for (const [props, key] of placed_signal_fields(placed)) taken.add(props[key]);
    const plan = new Map();
    const keys = Object.keys(names).filter(key => signal_key(key) === key).sort((a, b) => Number(a) - Number(b));
    for (const key of keys) {
        const from = Number(key);
        const name = clean_signal_name(names[key]);
        if (!name) continue;
        let to = signal_code_named(level, name);
        if (to === null) {
            if (!signal_name(level, from)) to = from;
            else { to = free_signal_code(level, taken); taken.add(to); }
        }
        plan.set(from, { to, name });
    }
    for (const placed of items ?? [])
        for (const [props, key] of placed_signal_fields(placed)) {
            const step = plan.get(props[key]);
            if (step && step.to !== props[key]) props[key] = step.to;
        }
    for (const [from, { to, name }] of plan) {
        if (!signal_name(level, to)) set_signal_name(level, to, name);
        if (to !== from) changed[from] = to;
    }
    return changed;
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
                add(props[trait]?.drop_code);
            }
        }
    }
    add(level?.properties?.signal_all_defeated);
    // a named Code stays taken even when nothing uses it right now, so a new
    // Schalter never turns up with somebody else's old name
    for (const key of Object.keys(signal_names_of(level) ?? {}))
        if (signal_key(key) === key) add(key);
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
        SIGNAL_DELAY_MAX_SECONDS, signal_delay_seconds, door_auto_close_step,
        layer_fade_seconds, DOOR_SIGNAL_REACTIONS, LAYER_SIGNAL_REACTIONS, SignalBus,
        door_signal_action, layer_reacts_to_signals, layer_visible_at_start, layer_visible_after,
        switch_flipped, SIGNAL_SPRITE_ROLES, placed_signal_role, valid_signal_rect, point_in_signal_rects,
        SIGNAL_LOOT_ROLE, loot_key_code, effective_loot_code, placed_signal_roles, NEW_SENDER_TRAITS,
        give_new_senders_codes, give_defeat_sender_code, door_setting,
        signal_partners, describe_signal_partners, signal_codes_in_level, free_signal_code,
        signal_objects, signal_links, same_signal_object, pick_signal_object, connect_signal_objects,
        promote_legacy_signals, signal_rules,
        SIGNAL_NAME_MAX_LENGTH, clean_signal_name, signal_name, signal_code_named, set_signal_name, signal_code_text, unique_signal_name,
        placed_signal_fields, signal_names_for_placed, carry_signal_names,
    };
}

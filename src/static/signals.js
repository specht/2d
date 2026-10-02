// Signale: "wenn das passiert, mach das".
//
// A sender sends its Code together with "an" (true) or "aus" (false):
// - a key, when it is collected: an
// - a Schalter, when it is flipped with the action key: an or aus
// - a Druckplatte, when the player steps on it (an) and off it again (aus)
//
// Receivers with the same Code react, each in its own way:
// - a door: placed property door_reaction (default: unlock, exactly what a
//   key has always done)
// - a layer: properties.signal_code and properties.signal_reaction (it can
//   appear or disappear; a layer that is gone also loses its collisions)
//
// The Code is the same number keys and doors have always had, so old games
// behave exactly as before. Signals exist within one level only: every level
// starts with a new SignalBus. The bus remembers nothing; receivers keep their
// own state (an opened door stays open, also when the player dies).

const SIGNAL_MAX_DEPTH = 16;

// Reactions of a door to a signal with its Code.
const DOOR_SIGNAL_REACTIONS = {
    unlock: 'aufschließen (wie ein Schlüssel)',
    open: 'öffnen',
    close: 'schließen',
    follow: 'offen, solange das Signal an ist',
    toggle: 'wechseln (auf ↔ zu) bei jedem Signal',
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

// Only the moment the action key goes down flips a switch, not every frame
// it is held (a tap on a touch screen holds it for a moment, too).
function switch_flipped(pressed_now, pressed_before) {
    return Boolean(pressed_now) && !pressed_before;
}

// Which placed sprites send or receive a Code, and under which key their
// Code is stored (placed[3][trait][key]; absent = 0, the default).
const SIGNAL_SPRITE_ROLES = [
    { trait: 'key', key: 'door_code', sends: true, one: 'Schlüssel', many: 'Schlüssel' },
    { trait: 'switch', key: 'signal_code', sends: true, one: 'Schalter', many: 'Schalter' },
    { trait: 'pressure_plate', key: 'signal_code', sends: true, one: 'Druckplatte', many: 'Druckplatten' },
    { trait: 'door', key: 'door_code', sends: false, one: 'Tür', many: 'Türen' },
];

// For the editor: everything in a level that has this Code.
// traits_of(placed[0]) gives the traits of a placed sprite's sprite.
function signal_partners(level, code, traits_of) {
    const wanted = Number(code);
    const counts = {};
    const layers = [];
    (level?.layers ?? []).forEach((layer, li) => {
        if (layer?.type === 'sprites') {
            for (const placed of layer.sprites ?? []) {
                const traits = traits_of(placed[0]) ?? {};
                for (const role of SIGNAL_SPRITE_ROLES) {
                    if (role.trait in traits && Number(placed[3]?.[role.trait]?.[role.key] ?? 0) === wanted)
                        counts[role.trait] = (counts[role.trait] ?? 0) + 1;
                }
            }
        }
        if (layer_reacts_to_signals(layer?.properties) && Number(layer.properties.signal_code ?? 0) === wanted)
            layers.push(layer.properties.name || `Ebene ${li + 1}`);
    });
    return { counts, layers };
}

// "Code 7 in diesem Level – sendet: 1 Schalter · reagiert: 2 Türen, Ebene »Brücke«"
function describe_signal_partners(code, partners) {
    const list = (sends) => SIGNAL_SPRITE_ROLES.filter(role => role.sends === sends && partners.counts[role.trait])
        .map(role => `${partners.counts[role.trait]} ${partners.counts[role.trait] === 1 ? role.one : role.many}`);
    const senders = list(true);
    const receivers = [...list(false), ...partners.layers.map(name => `Ebene »${name}«`)];
    const parts = [];
    if (senders.length) parts.push(`sendet: ${senders.join(', ')}`);
    if (receivers.length) parts.push(`reagiert: ${receivers.join(', ')}`);
    if (!senders.length) parts.push('noch nichts sendet diesen Code');
    else if (!receivers.length) parts.push('noch nichts reagiert darauf');
    return `Code ${Number(code)} in diesem Level – ${parts.join(' · ')}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SIGNAL_MAX_DEPTH, DOOR_SIGNAL_REACTIONS, LAYER_SIGNAL_REACTIONS, SignalBus,
        door_signal_action, layer_reacts_to_signals, layer_visible_at_start, layer_visible_after,
        switch_flipped, signal_partners, describe_signal_partners,
    };
}

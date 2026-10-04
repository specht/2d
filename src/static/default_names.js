// Names for new things in the editors, so children see that things have names
// and can be renamed: a new sprite is "Sprite 4", a new state "Zustand 2", a
// new layer "Ebene 3". Only things created now get one (never fix_game_data:
// old games keep what they have). A level is never given a stored default,
// because its name is shown to the player (start screen, HUD); the editor
// shows "Level 3" for it instead (level_display_name).
//
// While a name is still such a default, the editors may replace it with a
// better one: a state with a role is called after it ("laufen"), a sprite
// after what it is ("Gegner"). A name the child typed is never replaced.
//
// Pure, tested in test/default_names.test.cjs.

// "Sprite 4", "Zustand 2" … (also "Sprite 4 (Kopie)"): a name nobody chose.
function is_default_name(name, word) {
    const text = String(name ?? '').trim();
    if (!text) return true;
    return new RegExp(`^${word} \\d+( \\(Kopie\\))?$`).test(text);
}

// The next free "word N" among names: one more than the highest number used,
// and at least the count + 1 ("Sprite 4" for the fourth sprite).
function next_default_name(names, word, count = names.length + 1) {
    let highest = 0;
    for (const name of names) {
        const m = new RegExp(`^${word} (\\d+)`).exec(String(name ?? '').trim());
        if (m) highest = Math.max(highest, parseInt(m[1], 10));
    }
    return `${word} ${Math.max(highest + 1, count)}`;
}

// base, or "base 2", "base 3" … if base is taken (case-insensitive).
function unique_default_name(base, names) {
    const taken = new Set(names.map(n => String(n ?? '').trim().toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

// What a figure's state shows, as a word (actor / baddie / companion roles).
const ROLE_WORDS = {
    stand: 'stehen', walk: 'laufen', jump: 'springen', fall: 'fallen', climb: 'klettern',
    attack: 'Angriff', hit: 'Treffer', dead: 'tot', swim: 'schwimmen', float: 'schweben',
    drift: 'treiben', dive: 'abtauchen', rise: 'auftauchen', hunt: 'jagen', flee: 'fliehen',
    stunned: 'benommen', landed: 'gelandet', fly: 'fliegen', sit: 'sitzen', busy: 'beschäftigt',
};
const ROLE_DIRECTIONS = { left: 'links', front: 'vorn', back: 'hinten' };

// A name for a state from one of its roles: sprite_trait ('actor', 'door', …)
// and role ('walk_right', 'open', …); label: the role's label from traits.js
// for everything that is not a figure ("geöffnet", "Schalter ist an").
function role_state_name(sprite_trait, role, label = null) {
    if (['actor', 'baddie', 'companion'].includes(sprite_trait)) {
        const m = /^(?:([a-z]+)_)?(front|back|left|right)$/.exec(role);
        if (m) {
            const word = ROLE_WORDS[m[1] ?? 'stand'];
            if (word) return ROLE_DIRECTIONS[m[2]] ? `${word} ${ROLE_DIRECTIONS[m[2]]}` : word;
        }
        if (role === 'dead') return 'tot';
    }
    return label ? String(label) : null;
}

// What a sprite is called after its first trait that says what it is.
const TRAIT_SPRITE_NAMES = {
    actor: 'Spielfigur', baddie: 'Gegner', companion: 'Begleiter', door: 'Tür', key: 'Schlüssel',
    switch: 'Schalter', pressure_plate: 'Druckplatte', counter: 'Zähler', level_complete: 'Ausgang',
    checkpoint: 'Checkpoint', ladder: 'Leiter', moving: 'Plattform', text: 'Schild', trap: 'Falle',
    conveyor: 'Förderband', slope: 'Schräge', bomb: 'Bombe',
};

function trait_sprite_name(trait) {
    return TRAIT_SPRITE_NAMES[trait] ?? null;
}

// The start of a new game, before fix_game_data fills in the rest.
function fresh_game_data() {
    return {
        sprites: [{ properties: { name: 'Sprite 1' }, states: [{ properties: { name: 'Zustand 1' } }] }],
        levels: [{ layers: [{ properties: { name: 'Ebene 1' } }] }],
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fresh_game_data, is_default_name, next_default_name, unique_default_name, role_state_name, trait_sprite_name, ROLE_WORDS };
}

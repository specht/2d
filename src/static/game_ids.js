// Stable identities for sprites and levels.
//
// Every sprite and every level carries a durable `id` that stays the same when
// the object is moved around in its list. Two rules keep this predictable:
//
// - ensure_game_ids() is part of normalization (fix_game_data). It is
//   deterministic and idempotent: the same JSON always receives the same IDs.
//   Old games without IDs therefore get the same IDs every time they are
//   opened, and re-saving an unchanged game does not produce a new tag just
//   because IDs were generated. Existing valid IDs are never changed; only
//   missing, invalid or duplicate ones are filled in.
// - assign_new_game_id() is used by the editor when the user creates a new
//   sprite or level. It picks a random ID, so a newly created object can never
//   inherit the ID of an object that was deleted earlier.
//
// IDs only need to be unique within their own list (sprites or levels).

const GAME_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const GAME_ID_PREFIXES = { sprites: 's', levels: 'l' };
const GAME_ID_RANDOM_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const GAME_ID_RANDOM_LENGTH = 10;

function valid_game_id(id) {
    return typeof id === 'string' && GAME_ID_PATTERN.test(id);
}

function random_game_id(prefix) {
    const n = GAME_ID_RANDOM_LENGTH;
    const alphabet = GAME_ID_RANDOM_ALPHABET;
    const bytes = new Uint8Array(n);
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let id = prefix;
    // 256 is a multiple of the alphabet length (32), so this is unbiased.
    for (let i = 0; i < n; i++) id += alphabet[bytes[i] % alphabet.length];
    return id;
}

function used_game_ids(list, except = null) {
    const used = new Set();
    for (const item of Array.isArray(list) ? list : []) {
        if (item && item !== except && valid_game_id(item.id)) used.add(item.id);
    }
    return used;
}

function ensure_game_ids(data) {
    if (!data || typeof data !== 'object') return data;
    for (const [key, prefix] of Object.entries(GAME_ID_PREFIXES)) {
        const list = data[key];
        if (!Array.isArray(list)) continue;

        // First pass: keep every valid ID at its first occurrence.
        const used = new Set();
        const missing = [];
        list.forEach((item, index) => {
            if (!item || typeof item !== 'object') return;
            if (valid_game_id(item.id) && !used.has(item.id)) used.add(item.id);
            else missing.push(index);
        });

        // Second pass: derive IDs from the position, avoiding all kept IDs.
        for (const index of missing) {
            let id = `${prefix}${index}`;
            for (let n = 2; used.has(id); n++) id = `${prefix}${index}_${n}`;
            list[index].id = id;
            used.add(id);
        }
    }
    return data;
}

function assign_new_game_id(data, key, item, random = random_game_id) {
    const prefix = GAME_ID_PREFIXES[key];
    if (!prefix) throw new Error(`unknown game id collection: ${key}`);
    const used = used_game_ids(data?.[key], item);
    for (let attempt = 0; attempt < 100; attempt++) {
        const id = random(prefix);
        if (valid_game_id(id) && !used.has(id)) {
            item.id = id;
            return id;
        }
    }
    throw new Error('could not generate a unique game id');
}

// ---------------------------------------------------------------------------
// References to sprites
//
// In saved games and in the studio, references point at sprites by ID:
//
// - placed sprites in level layers: [sprite_id, x, y, properties?]
// - attack visuals: hit_sprite_id, attack_sprite_id, projectile_sprite_id
// - enemy drops: traits.baddie.drop.sprite_id
// - need_sprite level conditions: properties.sprite_id
//
// Old games store array indices instead (slot 0 of a placed sprite, and the
// *_sprite_index / sprite_index fields). convert_sprite_references_to_ids()
// turns them into IDs during normalization. If both fields exist, the ID wins.
//
// The game engine keeps working with indices: before a game is played,
// resolve_sprite_references_to_indices() writes the legacy index fields back.
// References to sprites that no longer exist are dropped there. The studio
// keeps unknown IDs until a sprite is deleted (remove_sprite_references), so
// an edit that arrives before the sprite it refers to is not lost.

const ATTACK_SPRITE_REFERENCES = ['hit', 'attack', 'projectile'];

function attack_definitions(sprite) {
    const traits = sprite?.traits;
    if (!traits || typeof traits !== 'object') return [];
    const attacks = [traits.melee_attack?.attack, traits.ranged_attack?.attack];
    for (const role of ['actor', 'baddie']) {
        if (Array.isArray(traits[role]?.attacks)) attacks.push(...traits[role].attacks);
    }
    return attacks.filter(attack => attack && typeof attack === 'object');
}

// Calls visit(container, index_key, id_key, clear) for every keyed sprite
// reference. clear() removes the reference in the way the editor always has
// (an enemy drop without a sprite is removed entirely).
function for_each_keyed_sprite_reference(data, visit) {
    for (const sprite of Array.isArray(data?.sprites) ? data.sprites : []) {
        for (const attack of attack_definitions(sprite)) {
            const visual = attack.visual;
            if (!visual || typeof visual !== 'object') continue;
            for (const name of ATTACK_SPRITE_REFERENCES) {
                const index_key = `${name}_sprite_index`;
                const id_key = `${name}_sprite_id`;
                visit(visual, index_key, id_key, () => {
                    delete visual[index_key];
                    delete visual[id_key];
                });
            }
        }
        const baddie = sprite?.traits?.baddie;
        if (baddie?.drop && typeof baddie.drop === 'object') {
            visit(baddie.drop, 'sprite_index', 'sprite_id', () => { delete baddie.drop; });
        }
    }
    for (const level of Array.isArray(data?.levels) ? data.levels : []) {
        for (const condition of Array.isArray(level?.conditions) ? level.conditions : []) {
            const properties = condition?.properties;
            if (condition?.type !== 'need_sprite' || !properties || typeof properties !== 'object') continue;
            visit(properties, 'sprite_index', 'sprite_id', () => {
                delete properties.sprite_index;
                delete properties.sprite_id;
            });
        }
    }
}

function for_each_sprite_layer(data, visit) {
    for (const level of Array.isArray(data?.levels) ? data.levels : []) {
        for (const layer of Array.isArray(level?.layers) ? level.layers : []) {
            if (layer?.type === 'sprites' && Array.isArray(layer.sprites)) visit(layer);
        }
    }
}

// Removes entries in place, so the array keeps its identity and the positions
// of the remaining entries only change where something was actually removed.
function filter_in_place(list, keep) {
    let write = 0;
    for (let read = 0; read < list.length; read++) {
        if (keep(list[read])) list[write++] = list[read];
    }
    list.length = write;
    return list;
}

function sprite_index_by_id(data) {
    const result = new Map();
    (Array.isArray(data?.sprites) ? data.sprites : []).forEach((sprite, index) => {
        if (valid_game_id(sprite?.id) && !result.has(sprite.id)) result.set(sprite.id, index);
    });
    return result;
}

function convert_sprite_references_to_ids(data) {
    if (!data || typeof data !== 'object') return data;
    const sprites = Array.isArray(data.sprites) ? data.sprites : [];
    const id_at = index => Number.isInteger(index) && valid_game_id(sprites[index]?.id) ? sprites[index].id : null;

    for_each_keyed_sprite_reference(data, (container, index_key, id_key, clear) => {
        if (id_key in container) {
            if (typeof container[id_key] === 'string') delete container[index_key];
            else clear();
            return;
        }
        if (!Number.isInteger(container[index_key])) return;
        const id = id_at(container[index_key]);
        if (id === null) {
            clear();
            return;
        }
        delete container[index_key];
        container[id_key] = id;
    });

    for_each_sprite_layer(data, layer => {
        filter_in_place(layer.sprites, entry => {
            if (!Array.isArray(entry)) return false;
            if (typeof entry[0] === 'string') return true;
            const id = id_at(entry[0]);
            if (id === null) return false;
            entry[0] = id;
            return true;
        });
    });
    return data;
}

function resolve_sprite_references_to_indices(data) {
    if (!data || typeof data !== 'object') return data;
    const index_of = sprite_index_by_id(data);

    for_each_keyed_sprite_reference(data, (container, index_key, id_key, clear) => {
        if (!(id_key in container)) return;
        const index = index_of.get(container[id_key]);
        if (index === undefined) {
            clear();
            return;
        }
        delete container[id_key];
        container[index_key] = index;
    });

    for_each_sprite_layer(data, layer => {
        filter_in_place(layer.sprites, entry => {
            if (!Array.isArray(entry) || typeof entry[0] !== 'string') return true;
            const index = index_of.get(entry[0]);
            if (index === undefined) return false;
            entry[0] = index;
            return true;
        });
    });
    return data;
}

// Used when a sprite is deleted in the studio: every reference to it goes.
function remove_sprite_references(data, id) {
    if (!data || typeof data !== 'object' || !valid_game_id(id)) return data;
    for_each_keyed_sprite_reference(data, (container, _index_key, id_key, clear) => {
        if (container[id_key] === id) clear();
    });
    for_each_sprite_layer(data, layer => {
        filter_in_place(layer.sprites, entry => !(Array.isArray(entry) && entry[0] === id));
    });
    return data;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_ID_PATTERN, GAME_ID_PREFIXES,
        valid_game_id, random_game_id, ensure_game_ids, assign_new_game_id,
        sprite_index_by_id, convert_sprite_references_to_ids,
        resolve_sprite_references_to_indices, remove_sprite_references,
    };
}

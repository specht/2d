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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_ID_PATTERN, GAME_ID_PREFIXES,
        valid_game_id, random_game_id, ensure_game_ids, assign_new_game_id,
    };
}

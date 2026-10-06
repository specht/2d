// Things that stay for the whole game, weapons and the shop (app.js).
//
// A sprite with "man kann es einsammeln" may also "bleibt fürs ganze Spiel"
// (traits.pickup.keep: true; absent = collected and gone, as always). Collected,
// it goes into the game's Inventar: it survives level changes and lost lives
// and is emptied only by a new game (Game.reset). The HUD shows it (hud.js).
//
// A kept sprite that also has Nahkampfangriff or Fernkampfangriff is a Waffe:
// whoever holds it attacks with it – a melee weapon on the melee key (J), a
// ranged one on the ranged key (K), so a sword and a bow work side by side.
// Several weapons of one kind: the number keys 1–9 choose. Which number a
// weapon has is the author's choice (traits.pickup.weapon_key, 1…9; absent =
// the next free number in the order collected), and the HUD prints it next to
// the weapon's picture. A newly collected weapon is chosen at once.
//
// The figure's own attacks stay: a chosen weapon only replaces the attack of
// its kind while it is chosen. Attack ids are given a prefix per weapon, so
// cooldowns of different weapons never mix.
//
// The inventory: [{ sprite_index, count }] in the order collected. The choice:
// { nah: sprite index | null, fern: sprite index | null }.

const WEAPON_KEYS_MAX = 9;

function kept_item(sprite) {
    return sprite?.traits?.pickup?.keep === true;
}

// The attacks a weapon gives (new melee/ranged traits only; a weapon has no
// actor or baddie role, so there are no old-style attack lists to look at).
function weapon_attacks(sprite) {
    if (!kept_item(sprite)) return [];
    const traits = sprite.traits;
    return [traits.melee_attack?.attack, traits.ranged_attack?.attack]
        .filter(attack => attack && typeof attack === 'object');
}

function is_weapon(sprite) {
    return weapon_attacks(sprite).length > 0;
}

// The key an attack is used with: 'nah' (swing) or 'fern' (projectile); null
// for anything the player could not use.
function weapon_attack_slot(attack) {
    if (attack?.slot === 'nah' && attack.delivery?.kind === 'swing') return 'nah';
    if (attack?.slot === 'fern' && attack.delivery?.kind === 'projectile') return 'fern';
    return null;
}

function weapon_slots(sprite) {
    return [...new Set(weapon_attacks(sprite).map(weapon_attack_slot).filter(Boolean))];
}

// The author's number for a weapon (1…9), or null.
function authored_weapon_key(sprite) {
    const n = sprite?.traits?.pickup?.weapon_key;
    return Number.isInteger(n) && n >= 1 && n <= WEAPON_KEYS_MAX ? n : null;
}

function inventory_count(inventory, si) {
    return (inventory ?? []).find(item => item.sprite_index === si)?.count ?? 0;
}

// One more of this sprite; returns its count now.
function inventory_add(inventory, si) {
    const item = inventory.find(item => item.sprite_index === si);
    if (item) return ++item.count;
    inventory.push({ sprite_index: si, count: 1 });
    return 1;
}

// The weapons held and their numbers: [{ sprite_index, key }] in the order
// collected. A number the author chose is kept (the first weapon collected
// wins if two have the same one); the others get the smallest free number.
// More than nine weapons: the rest have none (null).
function weapon_keys(inventory, sprites) {
    const weapons = (inventory ?? []).filter(item => is_weapon(sprites?.[item.sprite_index]));
    const taken = new Set();
    const keys = new Map();
    for (const item of weapons) {
        const n = authored_weapon_key(sprites[item.sprite_index]);
        if (n !== null && !taken.has(n)) { keys.set(item.sprite_index, n); taken.add(n); }
    }
    for (const item of weapons) {
        if (keys.has(item.sprite_index)) continue;
        let n = 1;
        while (taken.has(n)) n++;
        keys.set(item.sprite_index, n <= WEAPON_KEYS_MAX ? n : null);
        if (n <= WEAPON_KEYS_MAX) taken.add(n);
    }
    return weapons.map(item => ({ sprite_index: item.sprite_index, key: keys.get(item.sprite_index) }));
}

// The weapon with this number (1…9), or null.
function weapon_for_key(inventory, sprites, n) {
    return weapon_keys(inventory, sprites).find(w => w.key === n)?.sprite_index ?? null;
}

// Choosing a weapon: it takes every kind it has (a sword the melee key, a
// magic staff with both: both keys). Returns a new choice.
function choose_weapon(choice, sprites, si) {
    const next = { nah: choice?.nah ?? null, fern: choice?.fern ?? null };
    for (const slot of weapon_slots(sprites?.[si])) next[slot] = si;
    return next;
}

// The attacks the figure has with this choice: the weapons' attacks first (the
// game uses the first attack of a kind), then its own. own: the figure's own
// attack list (may be empty). The result is new; nothing is changed.
function attacks_with_weapons(own, sprites, choice) {
    const chosen = [];
    for (const slot of ['nah', 'fern']) {
        const si = choice?.[slot];
        if (!Number.isInteger(si)) continue;
        for (const attack of weapon_attacks(sprites?.[si])) {
            if (weapon_attack_slot(attack) !== slot) continue;
            chosen.push({ ...attack, id: `waffe${si}:${attack.id}` });
        }
    }
    const list = Array.isArray(own) ? own : [];
    return chosen.length ? [...chosen, ...list] : list;
}

// A number key: Digit1 … Digit9 or Numpad1 … Numpad9 → 1…9, else null.
function weapon_key_number(code) {
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(String(code ?? ''));
    return m ? Number(m[1]) : null;
}

// ------------------------------------------------------------ the shop
// A placed pickup with a Preis (placed pickup.price; absent or 0 = free and
// collected on touch, as always) is bought with the action key. What speaks
// against buying it, as the figure says it – or null.
function shop_refusal({ price, points, sprite, held, lives, max_lives }) {
    const pickup = sprite?.traits?.pickup ?? {};
    // a weapon that is already held: buying it again would change nothing
    if (is_weapon(sprite) && held > 0) return 'Das hast du schon.';
    // only lives, and there is no room for more
    const gives_lives = (Number(pickup.lives) || 0) > 0;
    const gives_more = ['points', 'energy', 'invincible', 'speed_boost_duration'].some(k => (Number(pickup[k]) || 0) > 0) || kept_item(sprite);
    if (gives_lives && !gives_more && lives >= max_lives) return 'Du hast schon alle Leben.';
    const missing = price - points;
    if (missing > 0) return missing === 1 ? 'Dafür fehlt dir noch 1 Münze.' : `Dafür fehlen dir noch ${missing} Münzen.`;
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        WEAPON_KEYS_MAX, kept_item, weapon_attacks, is_weapon, weapon_attack_slot, weapon_slots,
        authored_weapon_key, inventory_count, inventory_add, weapon_keys, weapon_for_key, choose_weapon,
        attacks_with_weapons, weapon_key_number, shop_refusal,
    };
}

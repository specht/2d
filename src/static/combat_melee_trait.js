// The sprite's Nahkampfangriff trait is an authoring capability, not a new
// damage implementation. Old actor/baddie `attacks` remain readable as-is.
function default_melee_attack() {
    return {
        id: 'melee', slot: 'nah', label: 'Nahkampfangriff',
        delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 },
        timing: { cooldown_s: 0.6 },
        visual: { kind: 'swoosh', sweep: 'up' },
    };
}

function default_ranged_attack() {
    return {
        id: 'ranged', slot: 'fern', label: 'Fernkampfangriff',
        delivery: { kind: 'projectile', range_px: 280, speed_px_s: 240 },
        effect: { kind: 'damage', amount: 15 },
        timing: { cooldown_s: 0.8 },
        visual: {},
    };
}

function add_ranged_trait(sprite_traits) {
    if (sprite_traits.ranged_attack) return false;
    sprite_traits.ranged_attack = { attack: default_ranged_attack() };
    return true;
}

function remove_ranged_trait(sprite_traits) {
    delete sprite_traits.ranged_attack;
}

function melee_owner_role(sprite_traits) {
    if (!sprite_traits || typeof sprite_traits !== 'object') return null;
    if (sprite_traits.actor) return 'actor';
    if (sprite_traits.baddie) return 'baddie';
    return null;
}

function is_legacy_sword_attack(attack) {
    return attack?.id === 'sword' && attack.slot === 'nah' &&
        attack.delivery?.kind === 'swing';
}

function legacy_melee_attack(sprite_traits) {
    const role = melee_owner_role(sprite_traits);
    const attacks = role && sprite_traits[role]?.attacks;
    return Array.isArray(attacks) ? attacks.find(is_legacy_sword_attack) ?? null : null;
}

function melee_attack_for_editor(sprite_traits) {
    return sprite_traits?.melee_attack?.attack ?? legacy_melee_attack(sprite_traits);
}

// Called only when a child explicitly adds Nahkampfangriff. Merely opening
// an old game does not rewrite its saved attack definition.
function add_melee_trait(sprite_traits) {
    if (sprite_traits.melee_attack) return false;
    const old = legacy_melee_attack(sprite_traits);
    sprite_traits.melee_attack = { attack: old ?? default_melee_attack() };
    if (old) {
        const owner = sprite_traits[melee_owner_role(sprite_traits)];
        owner.attacks = owner.attacks.filter(attack => attack !== old);
        if (!owner.attacks.length) delete owner.attacks;
    }
    return true;
}

// Removing the trait means removing the whole melee capability, including a
// shadowed old sword when both formats were present in hand-edited JSON.
function remove_melee_trait(sprite_traits) {
    delete sprite_traits.melee_attack;
    for (const role of ['actor', 'baddie']) {
        const owner = sprite_traits[role];
        if (!Array.isArray(owner?.attacks)) continue;
        owner.attacks = owner.attacks.filter(attack => !is_legacy_sword_attack(attack));
        if (!owner.attacks.length) delete owner.attacks;
    }
}

// Only invoked for sprites with the NEW trait. The trait takes precedence over
// an old sword, but unrelated legacy attacks remain available. The result is
// transient; neither the original actor/baddie data nor the trait is mutated.
function resolved_character_attacks(sprite_traits, role) {
    const saved = sprite_traits?.[role]?.attacks;
    const legacy = Array.isArray(saved) ? saved : [];
    const melee = sprite_traits?.melee_attack?.attack;
    const ranged = sprite_traits?.ranged_attack?.attack;
    const modern = [melee, ranged].filter(attack => attack && typeof attack === 'object');
    if (!modern.length) return legacy;
    return [...modern, ...legacy.filter(attack =>
        !(melee && is_legacy_sword_attack(attack)) &&
        !modern.some(selected => selected.id === attack?.id))];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        default_melee_attack, default_ranged_attack,
        add_ranged_trait, remove_ranged_trait,
        melee_owner_role, legacy_melee_attack,
        melee_attack_for_editor, add_melee_trait, remove_melee_trait,
        resolved_character_attacks,
    };
}

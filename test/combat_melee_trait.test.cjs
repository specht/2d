const assert = require('node:assert/strict');
const test = require('node:test');
const {
    default_melee_attack, legacy_melee_attack, melee_attack_for_editor,
    add_melee_trait, remove_melee_trait, resolved_character_attacks,
} = require('../src/static/combat_melee_trait.js');

const oldSword = () => ({
    id: 'sword', slot: 'nah', label: 'Meine Kralle', preset: 'sword',
    delivery: { kind: 'swing', range_px: 71, future_option: 7 },
    effect: { kind: 'damage', amount: 9 },
    timing: { cooldown_s: 1.4 },
    visual: { kind: 'swoosh', sweep: 'down', reach_px: 83 },
    custom: { do_not_lose: true },
});

test('Old games without attacks keep their exact data and no new attack', () => {
    const traits = { actor: { vrun: 3 } };
    const before = JSON.stringify(traits);
    assert.equal(legacy_melee_attack(traits), null);
    assert.equal(melee_attack_for_editor(traits), null);
    assert.deepEqual(resolved_character_attacks(traits, 'actor'), []);
    assert.equal(JSON.stringify(traits), before);
});

test('Legacy sword appears virtually as melee without changing its JSON on inspection', () => {
    for (const role of ['actor', 'baddie']) {
        const original = oldSword();
        const traits = { [role]: { attacks: [original] } };
        const before = JSON.stringify(traits);
        assert.equal(legacy_melee_attack(traits), original);
        assert.equal(melee_attack_for_editor(traits), original);
        assert.deepEqual(resolved_character_attacks(traits, role), [original]);
        assert.equal(JSON.stringify(traits), before);
    }
});

test('Adding the new trait transfers an old sword with all custom fields and no duplicate', () => {
    for (const role of ['actor', 'baddie']) {
        const old = oldSword();
        const other = { id: 'other', slot: 'fern', delivery: { kind: 'projectile' } };
        const traits = { [role]: { attacks: [old, other] } };
        const serializedOld = JSON.stringify(old);
        assert.equal(add_melee_trait(traits), true);
        assert.equal(traits.melee_attack.attack, old);
        assert.equal(JSON.stringify(traits.melee_attack.attack), serializedOld);
        assert.deepEqual(traits[role].attacks, [other]);
        assert.deepEqual(resolved_character_attacks(traits, role), [old, other]);
        assert.equal(add_melee_trait(traits), false);
        assert.deepEqual(resolved_character_attacks(traits, role), [old, other]);
    }
});

test('Adding a new trait creates a generic attack; the result is available for both owner roles', () => {
    for (const role of ['actor', 'baddie']) {
        const traits = { [role]: { vrun: 3 } };
        assert.equal(add_melee_trait(traits), true);
        assert.equal(traits.melee_attack.attack.id, 'melee');
        assert.equal(traits.melee_attack.attack.label, 'Nahkampfangriff');
        assert.equal(traits.melee_attack.attack.preset, undefined);
        assert.equal(traits.melee_attack.attack.slot, 'nah');
        assert.equal(traits.melee_attack.attack.delivery.kind, 'swing');
        assert.equal(traits.melee_attack.attack.effect.amount, 20);
        assert.equal(traits.melee_attack.attack.timing.cooldown_s, 0.6);
        assert.equal(traits[role].attacks, undefined);
        assert.deepEqual(resolved_character_attacks(traits, role), [traits.melee_attack.attack]);
    }
    assert.notEqual(default_melee_attack().delivery, default_melee_attack().delivery);
});

test('A modern trait takes precedence over a shadowed old sword without altering saved data', () => {
    for (const role of ['actor', 'baddie']) {
        const old = oldSword();
        const other = { id: 'other', slot: 'fern', delivery: { kind: 'ray' } };
        const modern = default_melee_attack();
        const traits = { [role]: { attacks: [old, other] }, melee_attack: { attack: modern } };
        const saved = JSON.stringify(traits);
        assert.equal(melee_attack_for_editor(traits), modern);
        assert.deepEqual(resolved_character_attacks(traits, role), [modern, other]);
        assert.equal(JSON.stringify(traits), saved);
        assert.equal(old.effect.amount, 9);
    }
});

test('Removing a melee trait removes its legacy shadow but preserves unrelated attacks', () => {
    const other = { id: 'other', slot: 'fern', delivery: { kind: 'projectile' } };
    const traits = {
        actor: { attacks: [oldSword(), other] },
        melee_attack: { attack: default_melee_attack() },
    };
    remove_melee_trait(traits);
    assert.equal(traits.melee_attack, undefined);
    assert.equal(melee_attack_for_editor(traits), null);
    assert.deepEqual(traits.actor.attacks, [other]);
    assert.deepEqual(resolved_character_attacks(traits, 'actor'), [other]);
    remove_melee_trait(traits);
    assert.deepEqual(traits.actor.attacks, [other]);
});

test('An incomplete new trait is ignored safely and does not mutate legacy JSON', () => {
    const old = oldSword();
    const traits = { baddie: { attacks: [old] }, melee_attack: {} };
    const before = JSON.stringify(traits);
    assert.deepEqual(resolved_character_attacks(traits, 'baddie'), [old]);
    assert.equal(JSON.stringify(traits), before);
});

test('Runtime character adapter leaves old traits untouched and projects new traits for either role', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/static/app.js'), 'utf8');
    const start = source.indexOf('        // Normalize the new optional melee trait only in this character');
    const end = source.indexOf("\t\tlet state_prefixes = ['stand', 'walk', 'jump', 'fall'];", start);
    assert.ok(start > 0 && end > start, 'Character runtime adapter missing');
    const normalize = new Function('resolved_character_attacks',
        `return function normalize() { ${source.slice(start, end)} };`)(resolved_character_attacks);
    for (const role of ['actor', 'baddie']) {
        const old = oldSword();
        const legacy = { [role]: { attacks: [old], vrun: 3 } };
        const oldOwner = { character_trait: role, sprite: { traits: legacy }, traits: legacy[role] };
        normalize.call(oldOwner);
        assert.equal(oldOwner.traits, legacy[role]);
        assert.equal(oldOwner.traits.attacks[0], old);
        const modern = { [role]: { attacks: [old], vrun: 3 },
            melee_attack: { attack: default_melee_attack() } };
        const before = JSON.stringify(modern);
        const newOwner = { character_trait: role, sprite: { traits: modern }, traits: modern[role] };
        normalize.call(newOwner);
        assert.notEqual(newOwner.traits, modern[role]);
        assert.equal(newOwner.traits.vrun, 3);
        assert.equal(newOwner.traits.attacks.length, 1);
        assert.equal(newOwner.traits.attacks[0], modern.melee_attack.attack);
        assert.equal(JSON.stringify(modern), before);
    }
});

test('Both owners use the identical swing delivery with a newly configured generic melee attack', () => {
    const { CombatSystem } = require('../src/static/combat.js');
    const { register_swing } = require('../src/static/combat_swing.js');
    const game = { running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], active_level_sprites: [],
        data: { sprites: [] }, update_stats() {} };
    const attackFor = (role) => {
        const traits = { [role]: {}, melee_attack: { attack: default_melee_attack() } };
        traits.melee_attack.attack.visual.kind = 'none';
        traits.melee_attack.attack.effect.amount = 12;
        traits.melee_attack.attack.timing.cooldown_s = 1.5;
        return { attacks: resolved_character_attacks(traits, role) };
    };
    const actor = { game, active: true, character_trait: 'actor',
        mesh: { position: { x: 0, y: 0 } }, sprite: { width: 20, height: 20 },
        traits: attackFor('actor'), last_horizontal_facing: 'right',
        dead() { return false; }, invincible() { return false; }, die() {} };
    const enemy = { game, active: true, character_trait: 'baddie', energy: 50,
        mesh: { position: { x: 35, y: 0 } }, sprite: { width: 20, height: 20 },
        traits: attackFor('baddie'), last_horizontal_facing: 'left',
        take_damage(amount) { this.energy -= amount; } };
    game.player_character = actor;
    game.baddies.push(enemy);
    const combat = new CombatSystem(game);
    register_swing(combat);
    assert.ok(combat.request_attack(actor, 'melee', 0));
    assert.equal(enemy.energy, 38);
    assert.equal(combat.request_attack(actor, 'melee', 0.5), null);
    assert.ok(combat.request_attack(enemy, 'melee', 0));
    assert.equal(game.energy, 88);
    assert.equal(combat.request_attack(enemy, 'melee', 0.5), null);
    assert.ok(combat.request_attack(actor, 'melee', 1.6));
    assert.equal(enemy.energy, 26);
    assert.ok(combat.request_attack(enemy, 'melee', 1.6));
    assert.equal(game.energy, 76);
});

test('Old swords appear as a virtual sprite trait, without being added twice or rewriting JSON', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/static/game.js'), 'utf8');
    const start = source.indexOf('    build_sprite_traits_menu() {');
    const end = source.indexOf('    add_sprite_trait_controls(trait, element) {', start);
    assert.ok(start >= 0 && end > start);
    const $ = () => ({ empty() { return this; }, nextAll() { return this; },
        remove() { return this; }, css() { return this; },
        appendTo() { return this; } });
    const canvas = { sprite_index: 0 };
    const Editor = new Function('$', 'canvas', 'SPRITE_TRAITS_ORDER',
        'setupDropdownMenu', 'legacy_melee_attack',
        `return class Editor { ${source.slice(start, end)} };`)(
            $, canvas, [], () => {}, legacy_melee_attack);
    const old = oldSword();
    const sprites = [
        { traits: { actor: { attacks: [old] } } },
        { traits: { actor: {}, melee_attack: { attack: default_melee_attack() } } },
        { traits: { baddie: {} } },
    ];
    const editor = new Editor();
    editor.data = { sprites };
    editor.build_sprite_traits_submenu = () => [];
    editor.build_state_traits_menu = () => {};
    editor.add_sprite_trait_controls = (trait) => editor.shown.push(trait);
    const before = JSON.stringify(sprites);
    const show = (si) => {
        editor.shown = [];
        canvas.sprite_index = si;
        editor.build_sprite_traits_menu();
        return editor.shown;
    };
    assert.deepEqual(show(0), ['actor', 'melee_attack']);
    assert.deepEqual(show(1), ['melee_attack', 'actor']);
    assert.deepEqual(show(2), ['baddie']);
    assert.equal(JSON.stringify(sprites), before);
});

test('A different delivery is not shadowed merely because its ID happens to be sword', () => {
    const other = { id: 'sword', slot: 'fern', delivery: { kind: 'ray' } };
    const modern = default_melee_attack();
    const traits = { actor: { attacks: [other] }, melee_attack: { attack: modern } };
    assert.deepEqual(resolved_character_attacks(traits, 'actor'), [modern, other]);
    remove_melee_trait(traits);
    assert.deepEqual(traits.actor.attacks, [other]);
});

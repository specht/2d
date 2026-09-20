const assert = require('node:assert/strict');
const test = require('node:test');
const { CombatSystem } = require('../src/static/combat.js');

const sword = (id = 'sword') => ({
    id, slot: 'nah', label: 'Schwert', preset: 'sword',
    delivery: { kind: 'swing', range_px: 40 },
    effect: { kind: 'damage', amount: 20 },
    timing: { cooldown_s: 0.6 },
    visual: { kind: 'slash' },
});

function fixture() {
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], stats_updates: 0,
        update_stats() { this.stats_updates++; },
    };
    const actor = {
        game, active: true, mesh: {}, character_trait: 'actor',
        traits: { attacks: [sword()] },
        dead() { return this.died === true; },
        invincible() { return this.invulnerable === true; },
        die() { this.died = true; },
    };
    game.player_character = actor;
    const baddie = (energy = 60) => {
        const enemy = {
            game, active: true, mesh: {}, character_trait: 'baddie', energy,
            traits: { attacks: [sword()] },
            take_damage(amount) {
                this.energy = Math.max(0, this.energy - amount);
                if (this.energy === 0) this.active = false;
            },
        };
        game.baddies.push(enemy);
        return enemy;
    };
    const combat = new CombatSystem(game);
    combat.register_delivery('swing', {
        validate: (attack) => Number.isFinite(attack.delivery.range_px) &&
            attack.delivery.range_px > 0 && attack.delivery.range_px <= 500,
        start: (instance) => { instance.expires_at = instance.started_at + 0.15; },
    });
    return { game, actor, baddie, combat };
}

test('No attacks and unsupported deliveries are inert', () => {
    const { actor, combat } = fixture();
    delete actor.traits.attacks;
    assert.equal(combat.request_attack(actor, 'sword', 0), null);
    actor.traits.attacks = [{ ...sword(), delivery: { kind: 'laser' } }];
    assert.equal(combat.request_attack(actor, 'sword', 0), null);
    assert.equal(combat.active.length, 0);
});

test('Both sides request the same delivery and damage opposite teams', () => {
    const { game, actor, baddie, combat } = fixture();
    const enemy = baddie();
    const player_swing = combat.request_attack(actor, 'sword', 0);
    const enemy_swing = combat.request_attack(enemy, 'sword', 0);
    assert.ok(player_swing && enemy_swing);
    assert.equal(combat.apply_hit(player_swing, enemy, 0.01), true);
    assert.equal(enemy.energy, 40);
    assert.equal(combat.apply_hit(enemy_swing, actor, 0.01), true);
    assert.equal(game.energy, 80);
    assert.equal(game.stats_updates, 1);
    assert.equal(combat.apply_hit(player_swing, actor, 0.02), false);
    assert.equal(combat.apply_hit(enemy_swing, enemy, 0.02), false);
});

test('One swing hits each target once; distinct enemy instances stay independent', () => {
    const { actor, baddie, combat } = fixture();
    const a = baddie();
    const b = baddie();
    const swing = combat.request_attack(actor, 'sword', 0);
    assert.equal(combat.apply_hit(swing, a, 0.01), true);
    assert.equal(combat.apply_hit(swing, a, 0.02), false);
    assert.equal(combat.apply_hit(swing, b, 0.02), true);
    assert.equal(a.energy, 40);
    assert.equal(b.energy, 40);
    assert.notEqual(combat.request_attack(a, 'sword', 0), null);
    assert.notEqual(combat.request_attack(b, 'sword', 0), null);
});

test('Cooldown belongs to an owner and attack ID, not the sprite', () => {
    const { actor, baddie, combat } = fixture();
    const enemy = baddie();
    assert.ok(combat.request_attack(actor, 'sword', 0));
    assert.ok(combat.request_attack(enemy, 'sword', 0));
    assert.equal(combat.request_attack(actor, 'sword', 0.1), null);
    combat.step(0.2);
    assert.ok(combat.request_attack(actor, 'sword', 0.6));
});

test('Dead, invulnerable, paused and foreign characters are rejected', () => {
    const { game, actor, baddie, combat } = fixture();
    const enemy = baddie(20);
    const swing = combat.request_attack(enemy, 'sword', 0);
    actor.invulnerable = true;
    assert.equal(combat.apply_hit(swing, actor, 0.01), false);
    actor.invulnerable = false;
    assert.equal(combat.apply_hit(swing, actor, 0.02), true);
    game.curtain.showing = true;
    assert.equal(combat.request_attack(actor, 'sword', 0.3), null);
    game.curtain.showing = false;
    const player_swing = combat.request_attack(actor, 'sword', 0.3);
    const foreign_enemy = { ...enemy };
    assert.equal(combat.apply_hit(player_swing, foreign_enemy, 0.31), false);
    assert.equal(combat.apply_hit(player_swing, enemy, 0.31), true);
    assert.equal(enemy.active, false);
    assert.equal(combat.request_attack(enemy, 'sword', 0.7), null);
});

test('Bad numbers, missing art and rejected delivery are handled safely', () => {
    const { actor, combat } = fixture();
    actor.traits.attacks = [{ ...sword(), effect: { kind: 'damage', amount: Infinity } }];
    assert.equal(combat.request_attack(actor, 'sword', 0), null);
    actor.traits.attacks = [{ ...sword(), delivery: { kind: 'swing', range_px: NaN } }];
    assert.equal(combat.request_attack(actor, 'sword', 0), null);
    actor.traits.attacks = [{ ...sword(), visual: undefined }];
    assert.ok(combat.request_attack(actor, 'sword', 0));
    const other = new CombatSystem(actor.game);
    other.register_delivery('swing', {
        validate: () => true, start: () => false,
    });
    assert.equal(other.request_attack(actor, 'sword', 0), null);
    assert.equal(other.active.length, 0);
});

test('Reset and expiration clear old hits and cooldowns', () => {
    const { actor, baddie, combat } = fixture();
    const enemy = baddie();
    const old = combat.request_attack(actor, 'sword', 0);
    assert.equal(combat.apply_hit(old, enemy, 0.01), true);
    combat.step(0.2);
    assert.equal(combat.active.length, 0);
    assert.equal(combat.apply_hit(old, enemy, 0.2), false);
    combat.reset();
    assert.equal(combat.active.length, 0);
    assert.ok(combat.request_attack(actor, 'sword', 0));
});


test('Instant delivery can apply a hit as soon as it starts', () => {
    const { actor, baddie, combat } = fixture();
    const enemy = baddie();
    actor.traits.attacks = [{ ...sword(), delivery: { kind: 'ray' } }];
    combat.register_delivery('ray', {
        validate: () => true,
        start: (instance, system) => system.apply_hit(instance, enemy, instance.started_at),
    });
    assert.ok(combat.request_attack(actor, 'sword', 0));
    assert.equal(enemy.energy, 40);
});


test('Periodic hits require an explicit bounded interval', () => {
    const { actor, baddie, combat } = fixture();
    const enemy = baddie(100);
    actor.traits.attacks = [{ ...sword(), hit: { rehit_interval_s: 0.1 } }];
    const attack = combat.request_attack(actor, 'sword', 0);
    assert.equal(combat.apply_hit(attack, enemy, 0), true);
    assert.equal(combat.apply_hit(attack, enemy, 0.05), false);
    assert.equal(combat.apply_hit(attack, enemy, 0.1), true);
    assert.equal(enemy.energy, 60);
    actor.traits.attacks = [{ ...sword(), hit: { rehit_interval_s: 0 } }];
    assert.equal(combat.request_attack(actor, 'sword', 1), null);
});

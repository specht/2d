const assert = require('node:assert/strict');
const test = require('node:test');
const { CombatSystem } = require('../src/static/combat.js');
const { register_swing } = require('../src/static/combat_swing.js');

function fixture() {
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], active_level_sprites: [],
        data: { sprites: [] }, update_stats() { this.updates = (this.updates ?? 0) + 1; },
    };
    const sword = () => ({
        id: 'sword', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
    });
    const actor = {
        game, active: true, character_trait: 'actor',
        mesh: { position: { x: 0, y: 0 } },
        sprite: { width: 20, height: 20 }, traits: { attacks: [sword()] },
        last_horizontal_facing: 'right',
        dead() { return this.died === true; },
        invincible() { return false; },
        die() { this.died = true; },
    };
    game.player_character = actor;
    const baddie = (x, traits = {}) => {
        let enemy = {
            game, active: true, character_trait: 'baddie', energy: 60,
            mesh: { position: { x, y: 0 } }, sprite: { width: 20, height: 20 },
            traits: { attacks: [sword()], ...traits }, last_horizontal_facing: 'left',
            take_damage(amount) {
                this.energy = Math.max(0, this.energy - amount);
                if (!this.energy) this.active = false;
            },
        };
        game.baddies.push(enemy);
        return enemy;
    };
    const combat = new CombatSystem(game);
    register_swing(combat);
    return { game, actor, baddie, combat };
}

test('Actor sword hits forward once without any animation or weapon sprite', () => {
    const { actor, baddie, combat } = fixture();
    const near = baddie(35);
    const far = baddie(100);
    const behind = baddie(-35);
    const swing = combat.request_attack(actor, 'sword', 0);
    assert.ok(swing);
    assert.equal(near.energy, 40);
    assert.equal(far.energy, 60);
    assert.equal(behind.energy, 60);
    combat.step(0.1);
    assert.equal(near.energy, 40);
    combat.step(0.2);
    assert.equal(combat.active.length, 0);
});

test('Baddie sword uses the identical delivery and damages player', () => {
    const { game, actor, baddie, combat } = fixture();
    const enemy = baddie(35);
    assert.ok(combat.request_attack(enemy, 'sword', 0));
    assert.equal(game.energy, 80);
    assert.equal(actor.died, undefined);
    assert.equal(combat.request_attack(enemy, 'sword', 0.1), null);
    assert.ok(combat.request_attack(enemy, 'sword', 0.7));
    assert.equal(game.energy, 60);
});

test('Both enemies have independent health and cooldowns', () => {
    const { game, baddie, combat } = fixture();
    const one = baddie(35);
    const two = baddie(38);
    assert.ok(combat.request_attack(one, 'sword', 0));
    assert.ok(combat.request_attack(two, 'sword', 0));
    assert.equal(game.energy, 60);
    assert.equal(one.energy, 60);
    assert.equal(two.energy, 60);
});

test('Walls and closed doors block swings; open doors do not', () => {
    const { game, actor, baddie, combat } = fixture();
    const target = baddie(35);
    const obstacle = { sprite_index: 0, mesh: { position: { x: 20, y: 0 } }, door_closed: true };
    game.active_level_sprites = [obstacle];
    game.data.sprites.push({ width: 8, height: 30, traits: { door: {} } });
    combat.request_attack(actor, 'sword', 0);
    assert.equal(target.energy, 60);
    obstacle.door_closed = false;
    combat.request_attack(actor, 'sword', 0.7);
    assert.equal(target.energy, 40);
});

test('Reset removes active swings without sprite art or THREE', () => {
    const { actor, baddie, combat } = fixture();
    baddie(35);
    combat.request_attack(actor, 'sword', 0);
    assert.equal(combat.active.length, 1);
    combat.reset();
    assert.equal(combat.active.length, 0);
    assert.ok(combat.request_attack(actor, 'sword', 0));
});

test('Invalid melee reach is safely rejected', () => {
    const { actor, combat } = fixture();
    actor.traits.attacks[0].delivery.range_px = Infinity;
    assert.equal(combat.request_attack(actor, 'sword', 0), null);
});

test('Stopping gameplay retires active swings', () => {
    const { game, actor, baddie, combat } = fixture();
    baddie(35);
    combat.request_attack(actor, 'sword', 0);
    game.curtain.showing = true;
    combat.step(0.01);
    assert.equal(combat.active.length, 0);
});

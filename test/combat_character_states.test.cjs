const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { CombatSystem } = require('../src/static/combat.js');

// Exercise the real browser Character class without booting the WebGL game.
const source = fs.readFileSync(require.resolve('../src/static/app.js'), 'utf8');
const begin = source.indexOf('class Character {');
const end = source.indexOf('\nclass VariableClock {', begin);
assert.ok(begin >= 0 && end > begin);
const Character = new Function('resolved_character_attacks',
    `${source.slice(begin, end)}\nreturn Character;`)(() => []);
const stateTraits = vm.runInNewContext(
    fs.readFileSync(require.resolve('../src/static/traits.js'), 'utf8') +
    '\n({ STATE_TRAITS_ORDER, STATE_TRAITS });');

function fixture(role, extraStates = [], attack = null) {
    const basic = { traits: { [role]: { front: {} } }, properties: { fps: 8 }, frames: [{}] };
    const sprite = {
        width: 20, height: 20,
        traits: { [role]: { energy: 30, ex_top: 1, ex_left: 1, ex_right: 1,
            ...(attack ? { attacks: [attack] } : {}) } },
        states: [basic, ...extraStates.map(({ tags, frames = 1, fps = 8 }) => ({
            traits: { [role]: Object.fromEntries(tags.map(tag => [tag, {}])) },
            properties: { fps }, frames: Array.from({ length: frames }, () => ({})),
        }))],
    };
    let now = 0;
    const game = {
        data: { sprites: [sprite] }, energy: 100, lives: 3, running: true,
        reached_flag: false, ts_zoom_actor: -1,
        clock: { getElapsedTime: () => now },
        geometry_and_material_for_frame: [sprite.states.map((state, si) =>
            state.frames.map((_, fi) => ({ geometry: `${si}:${fi}`, material: `${si}:${fi}` })))],
        update_stats() {}, curtain: { showing: false, show() {} }, baddies: [],
    };
    function addCharacter() {
        const character = new Character(game, 0, {
            position: { x: 0, y: 0 }, scale: { x: 1 },
        });
        if (role === 'actor') game.player_character = character;
        else game.baddies.push(character);
        return character;
    }
    return { game, sprite, addCharacter, advance: seconds => { now += seconds; } };
}

const pose = (tags, frames = 1, fps = 8) => ({ tags, frames, fps });
const sword = () => ({
    id: 'sword', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
    effect: { kind: 'damage', amount: 10 }, timing: { cooldown_s: 0.6 },
});

test('both character roles offer optional Angriff/Treffer states without new saved defaults', () => {
    for (const role of ['actor', 'baddie']) {
        const menu = stateTraits.STATE_TRAITS_ORDER[role].flatMap(entry =>
            typeof entry === 'string' ? [entry] : entry[1]);
        for (const [name, prefix] of [['Angriff', 'attack'], ['Treffer', 'hit']]) {
            const group = stateTraits.STATE_TRAITS_ORDER[role].find(entry => entry[0] === name);
            assert.deepEqual(Array.from(group[1]),
                ['front', 'back', 'left', 'right'].map(dir => `${prefix}_${dir}`));
            for (const [direction, label] of Object.entries({
                front: 'vorn', back: 'hinten', left: 'links', right: 'rechts',
            })) assert.equal(stateTraits.STATE_TRAITS[role][`${prefix}_${direction}`].label, label);
            assert.ok(!menu.includes(prefix)); // no extra generic menu entry
            assert.ok(!Object.hasOwn(stateTraits.STATE_TRAITS[role], prefix));
        }
        const { addCharacter, sprite } = fixture(role);
        const before = JSON.stringify(sprite);
        const character = addCharacter();
        character.show_combat_visual('attack');
        character.show_combat_visual('hit');
        assert.equal(character.combat_visual, null);
        assert.equal(character.sti_for_state.attack, undefined);
        assert.equal(JSON.stringify(sprite), before);
    }
});

test('abandoned generic tags do not create combat poses', () => {
    for (const role of ['actor', 'baddie']) {
        const { addCharacter } = fixture(role, [pose(['attack']), pose(['hit'])]);
        const c = addCharacter();
        assert.equal(c.sti_for_state.attack, undefined);
        assert.equal(c.sti_for_state.hit, undefined);
        c.show_combat_visual('attack');
        c.show_combat_visual('hit');
        assert.equal(c.combat_visual, null);
    }
});

test('one optional drawing flips horizontally and several frames play once at their own FPS', () => {
    for (const role of ['actor', 'baddie']) {
        const { addCharacter, advance } = fixture(role, [pose(['attack_right'], 3, 10)]);
        const c = addCharacter();
        c.show_combat_visual('attack');
        assert.equal(c.combat_visual.kind, 'attack');
        assert.equal(c.combat_visual.until, 0.3);
        c.update_state_and_direction('attack', 'left');
        assert.equal(c.mesh.scale.x, -1);
        assert.equal(c.mesh.geometry, '1:0');
        advance(0.12);
        c.update_state_and_direction('attack', 'left');
        assert.equal(c.mesh.geometry, '1:1');
        advance(0.4);
        c.update_state_and_direction('attack', 'left');
        assert.equal(c.mesh.geometry, '1:2'); // holds final frame, never loops
    }
});

test('one directional drawing mirrors left/right without a generic pose', () => {
    for (const role of ['actor', 'baddie']) {
        const { addCharacter } = fixture(role, [
            pose(['attack_right']), pose(['hit_left']),
        ]);
        const c = addCharacter();
        assert.equal(c.sti_for_state.attack.right.sti, 1);
        assert.equal(c.sti_for_state.attack.left.sti, 1);
        assert.equal(c.sti_for_state.attack.left.flipped, true);
        assert.equal(c.sti_for_state.hit.left.sti, 2);
        assert.equal(c.sti_for_state.hit.right.sti, 2);
        assert.equal(c.sti_for_state.hit.right.flipped, true);
    }
});

test('Treffer takes priority, death clears poses, and two placed enemies have isolated reactions', () => {
    const { game, addCharacter, advance } = fixture('baddie', [pose(['attack_right']), pose(['hit_left'])]);
    const one = addCharacter(), two = addCharacter();
    one.show_combat_visual('attack');
    assert.equal(two.combat_visual, null);
    one.show_combat_visual('hit');
    one.show_combat_visual('attack');
    assert.equal(one.combat_visual.kind, 'hit');
    advance(0.2);
    one.show_combat_visual('attack');
    assert.equal(one.combat_visual.kind, 'attack');
    one.take_damage(30);
    assert.equal(one.active, false);
    assert.equal(one.state, 'dead');
    assert.equal(one.combat_visual, null);
    one.show_combat_visual('hit');
    assert.equal(one.state, 'dead');
    assert.equal(two.active, true);
    assert.equal(two.energy, 30);
    assert.equal(game.baddies.length, 2);
});

test('a dying player cannot show Treffer or Angriff over the dead state', () => {
    const { addCharacter } = fixture('actor', [pose(['attack_right']), pose(['hit_left'])]);
    const actor = addCharacter();
    actor.show_combat_visual('attack');
    actor.die(null, null);
    assert.equal(actor.dead(), true);
    assert.equal(actor.combat_visual, null);
    actor.show_combat_visual('hit');
    assert.equal(actor.combat_visual, null);
    actor.update_state_and_direction('dead', 'front');
    assert.equal(actor.state, 'dead');
});

test('shared combat notifies only accepted attacks/hits; absent pose methods never block damage', () => {
    const attack = sword();
    const { game, addCharacter } = fixture('actor', [pose(['attack_right']), pose(['hit_left'])], attack);
    const owner = addCharacter();
    const enemy = {
        game, character_trait: 'baddie', active: true, mesh: {}, energy: 20,
        take_damage(amount) { this.energy -= amount; if (this.energy <= 0) this.active = false; },
        show_combat_visual(kind) { this.events.push(kind); }, events: [],
    };
    game.baddies.push(enemy);
    const combat = new CombatSystem(game);
    combat.register_delivery('swing', {
        validate: () => true,
        start: instance => { instance.expires_at = instance.started_at + 0.15; },
    });
    const first = combat.request_attack(owner, 'sword', 0);
    assert.ok(first);
    assert.equal(owner.combat_visual.kind, 'attack');
    assert.equal(combat.request_attack(owner, 'sword', 0.1), null);
    assert.equal(combat.apply_hit(first, enemy, 0.1), true);
    assert.deepEqual(enemy.events, ['hit']);
    assert.equal(combat.apply_hit(first, enemy, 0.1), false);
    assert.equal(enemy.energy, 10);
    assert.equal(combat.request_attack(owner, 'sword', 0.6) !== null, true);
    const second = combat.active.at(-1);
    assert.equal(combat.apply_hit(second, enemy, 0.6), true);
    assert.equal(enemy.active, false);
    assert.deepEqual(enemy.events, ['hit']); // no nonlethal pose on death

    // Neither owner nor target needs an animation callback for combat to work.
    const bareEnemy = {
        game, character_trait: 'baddie', active: true, mesh: {}, energy: 20,
        traits: { attacks: [attack] },
        take_damage(amount) { this.energy -= amount; },
    };
    game.baddies.push(bareEnemy);
    const bareAttack = combat.request_attack(bareEnemy, 'sword', 0);
    assert.ok(bareAttack);
    assert.equal(combat.apply_hit(bareAttack, owner, 0), true);
    assert.equal(game.energy, 90);
});

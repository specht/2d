const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { CombatSystem } = require('../src/static/combat.js');

// The browser uses shared atlas ShaderMaterials. These small stand-ins check
// that the flash clones a material rather than recolouring the shared atlas.
class AtlasMaterial {
    constructor(texture = { atlas: true }) {
        this.uniforms = { texture1: { value: texture } };
        this.fragmentShader = 'original texture shader';
        this.disposed = false;
    }
    // A cloned ShaderMaterial receives a *different* texture object by default.
    clone() { return new AtlasMaterial({ ...this.uniforms.texture1.value }); }
    dispose() { this.disposed = true; }
}
const source = fs.readFileSync(require.resolve('../src/static/app.js'), 'utf8');
const begin = source.indexOf('class Character {');
const end = source.indexOf('\nclass VariableClock {', begin);
assert.ok(begin >= 0 && end > begin);
const Character = new Function('resolved_character_attacks',
    `${source.slice(begin, end)}\nreturn Character;`)(() => []);
const metadata = vm.runInNewContext(
    fs.readFileSync(require.resolve('../src/static/traits.js'), 'utf8') +
    '\n({ STATE_TRAITS_ORDER, STATE_TRAITS });');
const attack = () => ({
    id: 'sword', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
    effect: { kind: 'damage', amount: 10 }, timing: { cooldown_s: 0.6 },
});

function world(withHitArt = false) {
    const material = new AtlasMaterial();
    const sprite = role => ({
        width: 20, height: 20,
        traits: { [role]: { energy: 30, ex_top: 1, ex_left: 1, ex_right: 1,
            attacks: [attack()] } },
        states: [
            { traits: { [role]: { right: {} } }, properties: { fps: 8 }, frames: [{}] },
            ...(withHitArt ? [{ traits: { [role]: { hit_right: {} } },
                properties: { fps: 8 }, frames: [{}, {}] }] : []),
        ],
    });
    const actor = sprite('actor'), baddie = sprite('baddie');
    let now = 0;
    const game = {
        data: { sprites: [actor, baddie] },
        energy: 100, lives: 3, running: true, reached_flag: false,
        ts_zoom_actor: -1, curtain: { showing: false, show() {} },
        clock: { getElapsedTime: () => now },
        geometry_and_material_for_frame: [actor, baddie].map(s => s.states.map(
            (state, si) => state.frames.map((_, fi) => ({ geometry: `${si}:${fi}`, material })))),
        update_stats() {}, baddies: [],
    };
    const mesh = () => ({ position: { x: 0, y: 0 }, scale: { x: 1 }, material });
    game.player_character = new Character(game, 0, mesh());
    const spawnBaddie = () => {
        const enemy = new Character(game, 1, mesh());
        game.baddies.push(enemy);
        return enemy;
    };
    const combat = new CombatSystem(game);
    combat.register_delivery('swing', {
        validate: () => true,
        start: instance => { instance.expires_at = instance.started_at + 0.15; },
    });
    return { game, material, combat, spawnBaddie, advance: delta => { now += delta; } };
}

test('applied state tags are descriptive for both roles', () => {
    for (const role of ['actor', 'baddie']) {
        for (const [name, prefix] of [
            ['Stehen', ''], ['Laufen', 'walk_'], ['Springen', 'jump_'],
            ['Fallen', 'fall_'], ['Angriff', 'attack_'], ['Treffer', 'hit_'],
        ]) {
            const group = metadata.STATE_TRAITS_ORDER[role].find(row => row[0] === name);
            assert.ok(group, `${role}: ${name}`);
            for (const [direction, label] of Object.entries({
                front: 'vorn', back: 'hinten', left: 'links', right: 'rechts',
            })) {
                assert.ok(group[1].includes(`${prefix}${direction}`));
                assert.ok(metadata.STATE_TRAITS[role][`${prefix}${direction}`].label.includes(
                    role === 'actor' ? 'Spielfigur' : 'Gegner'));
            }
        }
    }
});

test('accepted hit flashes only the struck placed enemy, even without Treffer artwork', () => {
    const { game, material, combat, spawnBaddie, advance } = world();
    const one = spawnBaddie(), two = spawnBaddie();
    const shot = combat.request_attack(game.player_character, 'sword', 0);
    assert.ok(shot);
    assert.equal(combat.apply_hit(shot, one, 0), true);
    one.update_state_and_direction('stand', 'right');
    two.update_state_and_direction('stand', 'right');
    assert.notEqual(one.mesh.material, material);
    assert.equal(two.mesh.material, material);
    assert.equal(material.fragmentShader, 'original texture shader');
    assert.match(one.mesh.material.fragmentShader, /vec3\(1\.0000, 0\.2510, 0\.2510\)/);
    assert.equal(one.mesh.material.uniforms.texture1.value, material.uniforms.texture1.value);
    assert.equal(one.energy, 20);
    const red = one.mesh.material;
    advance(0.05);
    one.update_state_and_direction('stand', 'right');
    assert.equal(one.mesh.material, red); // shader is cached rather than recompiled per frame
    advance(0.2);
    one.update_state_and_direction('stand', 'right');
    assert.equal(one.mesh.material, material);
    assert.equal(two.energy, 30);
    assert.equal(one.combat_visual, null); // no Treffer state required
    one.dispose_hit_flash();
    assert.equal(red.disposed, true);
});

test('a drawn Treffer state plays while red feedback stays independent of frame count', () => {
    const { game, combat, spawnBaddie, advance, material } = world(true);
    const enemy = spawnBaddie();
    const shot = combat.request_attack(game.player_character, 'sword', 0);
    assert.equal(combat.apply_hit(shot, enemy, 0), true);
    assert.equal(enemy.combat_visual.kind, 'hit');
    enemy.update_state_and_direction('hit', 'left');
    assert.equal(enemy.state, 'hit');
    assert.notEqual(enemy.mesh.material, material);
    assert.equal(enemy.mesh.scale.x, -1); // right-facing hit art mirrors to the left
    advance(0.2);
    enemy.update_state_and_direction('hit', 'left');
    assert.equal(enemy.mesh.material, material); // flash ended, hit animation may continue
    assert.equal(enemy.energy, 20);
});

test('misses, rejected re-hits and lethal hits never restart the flash', () => {
    const { game, combat, spawnBaddie, material, advance } = world();
    const enemy = spawnBaddie();
    const shot = combat.request_attack(game.player_character, 'sword', 0);
    assert.equal(enemy.hit_flash_until, 0);
    assert.equal(combat.apply_hit(shot, enemy, 0), true);
    const until = enemy.hit_flash_until;
    advance(0.05);
    assert.equal(combat.apply_hit(shot, enemy, 0.05), false);
    assert.equal(enemy.hit_flash_until, until);
    const shot2 = combat.request_attack(game.player_character, 'sword', 0.6);
    assert.ok(shot2);
    advance(0.55);
    assert.equal(combat.apply_hit(shot2, enemy, 0.6), true);
    assert.equal(enemy.energy, 10);
    const shot3 = combat.request_attack(game.player_character, 'sword', 1.2);
    assert.ok(shot3);
    advance(0.6);
    assert.equal(combat.apply_hit(shot3, enemy, 1.2), true);
    assert.equal(enemy.active, false);
    assert.equal(enemy.state, 'dead');
    assert.equal(enemy.hit_flash_until, 0);
    enemy.update_state_and_direction('dead', 'front');
    assert.equal(enemy.mesh.material, material);
});

test('baddie attacks trigger a player-only flash; invincibility and fatal hits do not', () => {
    const { game, combat, spawnBaddie, material, advance } = world();
    const enemy = spawnBaddie(), actor = game.player_character;
    const shot = combat.request_attack(enemy, 'sword', 0);
    assert.equal(combat.apply_hit(shot, actor, 0), true);
    assert.equal(game.energy, 90);
    actor.update_state_and_direction('stand', 'right');
    assert.notEqual(actor.mesh.material, material);
    assert.equal(enemy.mesh.material, material);
    actor.invincible_until = 1;
    const second = combat.request_attack(enemy, 'sword', 0.6);
    assert.ok(second);
    advance(0.6);
    assert.equal(combat.apply_hit(second, actor, 0.6), false);
    assert.equal(game.energy, 90);
    actor.invincible_until = 0;
    game.energy = 10;
    const fatal = combat.request_attack(enemy, 'sword', 1.2);
    assert.ok(fatal);
    advance(0.6);
    assert.equal(combat.apply_hit(fatal, actor, 1.2), true);
    assert.equal(actor.dead(), true);
    assert.equal(actor.hit_flash_until, 0);
    actor.update_state_and_direction('dead', 'front');
    assert.equal(actor.mesh.material, material);
});

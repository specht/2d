const test = require('node:test');
const assert = require('node:assert/strict');
const n = require('../src/static/default_names.js');

test('default names: the next free number, never a name a child chose', () => {
    assert.equal(n.next_default_name(['Sprite 1', 'Pip', 'Sprite 4'], 'Sprite'), 'Sprite 5');
    assert.equal(n.next_default_name(['Pip', 'Glibber'], 'Sprite'), 'Sprite 3');
    assert.equal(n.next_default_name([], 'Zustand'), 'Zustand 1');
    assert.ok(n.is_default_name('', 'Sprite'));
    assert.ok(n.is_default_name('Sprite 12', 'Sprite'));
    assert.ok(n.is_default_name('Sprite 2 (Kopie)', 'Sprite'));
    assert.ok(!n.is_default_name('Sprite für Pip', 'Sprite'));
    assert.ok(!n.is_default_name('Pip', 'Sprite'));
    assert.equal(n.unique_default_name('laufen', ['stehen', 'Laufen']), 'laufen 2');
});

test('a state is named after its role, a sprite after what it is', () => {
    assert.equal(n.role_state_name('actor', 'walk_right'), 'laufen');
    assert.equal(n.role_state_name('actor', 'walk_left'), 'laufen links');
    assert.equal(n.role_state_name('baddie', 'right'), 'stehen');
    assert.equal(n.role_state_name('companion', 'sit_right'), 'sitzen');
    assert.equal(n.role_state_name('actor', 'dead'), 'tot');
    assert.equal(n.role_state_name('door', 'open', 'geöffnet'), 'geöffnet');
    assert.equal(n.trait_sprite_name('baddie'), 'Gegner');
    assert.equal(n.trait_sprite_name('block_above'), null);
});

test('a fresh game has names to start with', () => {
    const data = n.fresh_game_data();
    assert.equal(data.sprites[0].properties.name, 'Sprite 1');
    assert.equal(data.sprites[0].states[0].properties.name, 'Zustand 1');
    assert.equal(data.levels[0].layers[0].properties.name, 'Ebene 1');
    assert.equal(data.levels[0].properties, undefined, 'a level keeps no default name: the player would see it');
});

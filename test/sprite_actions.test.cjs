const test = require('node:test');
const assert = require('node:assert/strict');
const { copy_state_without_role, copy_state_for_sprite } = require('../src/static/sprite_actions.js');

const state = () => ({
    properties: { name: 'laufen', fps: 10 },
    traits: { actor: { walk_right: {} }, ranged_attack: { attack: {} } },
    frames: [{ src: 'a', tag: 'x1' }, { src: 'b' }],
});

test('a duplicated state keeps its pictures and settings, but takes no role', () => {
    const original = state();
    const copy = copy_state_without_role(original);
    assert.deepEqual(copy.traits, { actor: {}, ranged_attack: {} });
    assert.deepEqual(copy.frames, [{ src: 'a' }, { src: 'b' }]);
    assert.equal(copy.properties.fps, 10);
    assert.deepEqual(original.traits.actor, { walk_right: {} });   // the original keeps its role
});

test('a state copied to another sprite keeps the roles that sprite can have', () => {
    const copy = copy_state_for_sprite(state(), { traits: { actor: {} } });
    assert.deepEqual(copy.traits, { actor: { walk_right: {} } });
    assert.deepEqual(copy.frames, [{ src: 'a' }, { src: 'b' }]);
});

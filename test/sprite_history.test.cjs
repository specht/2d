const test = require('node:test');
const assert = require('node:assert/strict');
const { sprite_same_structure } = require('../src/static/sprite_history.js');

test('undo only reloads pictures when nothing but pixels changed', () => {
    const sprite = () => ({ id: 's0', width: 24, height: 24, traits: { actor: {} },
        states: [{ properties: { name: 'laufen', fps: 8 }, traits: {}, frames: [{ src: 'a' }, { src: 'b' }] }] });
    const pixels = sprite(); pixels.states[0].frames[1].src = 'c';
    assert.equal(sprite_same_structure(sprite(), pixels), true);
    const fps = sprite(); fps.states[0].properties.fps = 9;
    assert.equal(sprite_same_structure(sprite(), fps), false);
    const frames = sprite(); frames.states[0].frames.push({ src: 'd' });
    assert.equal(sprite_same_structure(sprite(), frames), false);
    const traits = sprite(); delete traits.traits.actor;
    assert.equal(sprite_same_structure(sprite(), traits), false);
    assert.equal(sprite_same_structure(null, sprite()), false);
});

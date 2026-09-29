const assert = require('node:assert/strict');
const test = require('node:test');
const c = require('../src/static/controls.js');

test('games without custom controls keep the established keys', () => {
    const map = c.controls_key_map(undefined);
    assert.deepEqual(map.get('ArrowLeft'), ['left']);
    assert.deepEqual(map.get('KeyA'), ['left']);
    assert.deepEqual(map.get('Space'), ['jump']);
    assert.deepEqual(map.get('KeyF'), ['action']);
    assert.deepEqual(map.get('KeyJ'), ['melee']);
    assert.deepEqual(map.get('KeyK'), ['ranged']);
    assert.equal(map.get('ControlLeft'), undefined);
});

test('custom keys replace only the changed actions', () => {
    const controls = c.resolve_controls({ controls: { melee: ['ControlLeft'], jump: ['Space', 'ArrowUp'] } });
    assert.deepEqual(controls.melee, ['ControlLeft']);
    assert.deepEqual(controls.left, ['ArrowLeft', 'KeyA']);
    const map = c.controls_key_map({ controls: { jump: ['Space', 'ArrowUp'] } });
    assert.deepEqual(map.get('ArrowUp'), ['up', 'jump']);
});

test('invalid, empty and reserved keys fall back to defaults', () => {
    const controls = c.resolve_controls({ controls: { left: [], right: ['Escape'], up: 'KeyW', down: [42] } });
    assert.deepEqual(controls.left, ['ArrowLeft', 'KeyA']);
    assert.deepEqual(controls.right, ['ArrowRight', 'KeyD']);
    assert.deepEqual(controls.up, ['ArrowUp', 'KeyW']);
    assert.deepEqual(controls.down, ['ArrowDown', 'KeyS']);
    assert.equal(c.valid_key_code('F11'), false);
});

test('German labels and warnings', () => {
    assert.equal(c.key_label('KeyZ'), 'Y');
    assert.equal(c.key_label('Space'), 'Leertaste');
    assert.match(c.key_warning('ShiftLeft'), /Einrastfunktionen/);
    assert.match(c.key_warning('ControlLeft'), /Strg\+W/);
    assert.equal(c.key_warning('KeyJ'), null);
});

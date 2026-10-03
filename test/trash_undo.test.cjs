const test = require('node:test');
const assert = require('node:assert/strict');
const { trash_undo_target } = require('../src/static/trash_undo.js');

test('a deleted sprite or level is offered back, with its name', () => {
    global.sprite_label = (sprite, index) => sprite.properties?.name ?? `Sprite ${index + 1}`;
    assert.deepEqual(trash_undo_target('menu_sprites', [{}, { properties: { name: 'Boden' } }], 1),
        { kind: 'sprite', index: 1, text: 'Sprite »Boden« gelöscht.' });
    assert.deepEqual(trash_undo_target('menu_levels', [{ properties: { name: ' Höhle ' } }], 0),
        { kind: 'level', index: 0, text: 'Level »Höhle« gelöscht.' });
    assert.equal(trash_undo_target('menu_levels', [{ properties: {} }], 0).text, 'Level »Level 1« gelöscht.');
    delete global.sprite_label;
});

test('other lists have their own undo; nothing to offer for a missing item', () => {
    // frames and states: Strg+Z in the sprite editor; layers: the level history
    assert.equal(trash_undo_target('menu_frames', [{}], 0), null);
    assert.equal(trash_undo_target('menu_layers', [{}], 0), null);
    assert.equal(trash_undo_target('menu_sprites', [{}], 3), null);
    assert.equal(trash_undo_target('menu_sprites', undefined, 0), null);
});

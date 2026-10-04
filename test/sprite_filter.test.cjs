const test = require('node:test');
const assert = require('node:assert/strict');
const f = require('../src/static/sprite_filter.js');

const sprites = [
    { id: 'a', properties: { name: 'Pip' }, traits: { actor: {} } },
    { id: 'b', properties: { name: 'Glibber' }, traits: { baddie: {} } },
    { id: 'c', traits: { block_above: {}, block_sides: {} } },
    { id: 'd', properties: { name: 'Wolke' }, traits: {} },
    { id: 'e', properties: { name: 'Münze' }, traits: { pickup: {} } },
];

test('sprite kinds come from the traits; a sprite without any is Deko', () => {
    assert.deepEqual(f.sprite_kinds(sprites[0]), ['figur']);
    assert.deepEqual(f.sprite_kinds(sprites[2]), ['block']);
    assert.deepEqual(f.sprite_kinds(sprites[3]), ['deko']);
    assert.deepEqual(f.sprite_filter_kinds_in(sprites).map(k => [k.id, k.count]),
        [['figur', 1], ['gegner', 1], ['block', 1], ['sammeln', 1], ['deko', 1]]);
});

test('the search matches the Titel ("Sprite 3" without one), the kind and ignores case and accents', () => {
    const pass = (filter) => sprites.map((s, i) => f.sprite_filter_matches(s, i, filter) ? s.id : null).filter(Boolean);
    assert.deepEqual(pass({ query: 'glib' }), ['b']);
    assert.deepEqual(pass({ query: 'sprite 3' }), ['c']);
    assert.deepEqual(pass({ query: 'MUNZE' }), ['e']);
    assert.deepEqual(pass({ query: 'gegner' }), ['b']);
    assert.deepEqual(pass({ kind: 'block' }), ['c']);
    assert.deepEqual(pass({ kind: 'used', ids: new Set(['a', 'd']) }), ['a', 'd']);
    assert.deepEqual(pass({ query: '' }), ['a', 'b', 'c', 'd', 'e']);
});

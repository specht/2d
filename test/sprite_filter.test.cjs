const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(globalThis, require('../src/static/game_ids.js'));
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

test('what the game uses: placed in a level, or needed by another sprite or a level setting', () => {
    const data = {
        sprites: [
            { id: 'pip', traits: { actor: {}, melee_attack: { attack: { visual: { hit_sprite_id: 'spark' } } } } },
            { id: 'spark', traits: {} },                                   // Pip's hit picture
            { id: 'glib', traits: { baddie: { drop: { sprite_id: 'gem' } } } },
            { id: 'gem', traits: { pickup: {} } },                         // only the Beute of Glibber
            { id: 'key', traits: { pickup: { keep: true } } },             // "sendet, wenn … hat"
            { id: 'self', traits: { melee_attack: { attack: { visual: { attack_sprite_id: 'self' } } } } },
            { id: 'cloud', traits: {} },
            { id: 'old', traits: {} },                                     // an old game: placed by index
        ],
        levels: [
            { properties: { item_signals: [{ sprite_id: 'key', signal_code: 3 }] },
              layers: [{ type: 'sprites', sprites: [['pip', 0, 0], ['glib', 24, 0], ['glib', 48, 0]] }, { type: 'backdrop' }] },
            { properties: {}, layers: [{ type: 'sprites', sprites: [['glib', 0, 0], [7, 24, 0]] }] },
        ],
    };
    const usage = f.sprite_usage(data);
    assert.equal(usage.get('glib').placed, 3);
    assert.deepEqual([...usage.get('glib').levels], [[0, 2], [1, 1]]);
    assert.equal(usage.get('old').placed, 1);
    for (const id of ['spark', 'gem', 'key']) assert.ok(usage.get(id).needed, id);
    // a sprite that only names itself is not needed by that
    assert.deepEqual([...f.unused_sprite_ids(data)].sort(), ['cloud', 'self']);
    // the chip "Unbenutzt" keeps exactly those
    const shown = data.sprites.filter((s, i) => f.sprite_filter_matches(s, i, { kind: 'unused', ids: f.unused_sprite_ids(data) }));
    assert.deepEqual(shown.map(s => s.id), ['self', 'cloud']);
});

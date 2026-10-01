const assert = require('node:assert/strict');
const test = require('node:test');
const ids = require('../src/static/game_ids.js');

function legacy_game() {
    return {
        sprites: [{ width: 24 }, { width: 16 }, { width: 8 }],
        levels: [{ properties: { name: 'Eins' } }, { properties: { name: 'Zwei' } }],
    };
}

test('old games get position-derived IDs for sprites and levels', () => {
    const data = ids.ensure_game_ids(legacy_game());
    assert.deepEqual(data.sprites.map(s => s.id), ['s0', 's1', 's2']);
    assert.deepEqual(data.levels.map(l => l.id), ['l0', 'l1']);
});

test('normalization is deterministic and idempotent', () => {
    const a = ids.ensure_game_ids(legacy_game());
    const b = ids.ensure_game_ids(legacy_game());
    assert.deepEqual(a, b);
    const before = JSON.stringify(a);
    ids.ensure_game_ids(a);
    assert.equal(JSON.stringify(a), before);
});

test('existing IDs are kept and travel with their object when it is moved', () => {
    const data = ids.ensure_game_ids(legacy_game());
    const [first] = data.sprites.splice(0, 1);
    data.sprites.push(first);
    ids.ensure_game_ids(data);
    assert.deepEqual(data.sprites.map(s => s.id), ['s1', 's2', 's0']);
    assert.equal(data.sprites[2].width, 24);
});

test('missing IDs never take an ID that a later object already has', () => {
    const data = { sprites: [{}, { id: 's0' }, {}], levels: [] };
    ids.ensure_game_ids(data);
    assert.equal(data.sprites[1].id, 's0');
    assert.equal(data.sprites[0].id, 's0_2');
    assert.equal(data.sprites[2].id, 's2');
});

test('duplicate and invalid IDs are repaired, first occurrence wins', () => {
    const data = {
        sprites: [{ id: 'same' }, { id: 'same' }, { id: 'has space' }, { id: 42 }],
        levels: [{ id: '' }],
    };
    ids.ensure_game_ids(data);
    assert.deepEqual(data.sprites.map(s => s.id), ['same', 's1', 's2', 's3']);
    assert.equal(data.levels[0].id, 'l0');
});

test('sprites and levels are separate ID spaces', () => {
    const data = { sprites: [{ id: 'x1' }], levels: [{ id: 'x1' }] };
    ids.ensure_game_ids(data);
    assert.equal(data.sprites[0].id, 'x1');
    assert.equal(data.levels[0].id, 'x1');
});

test('data without sprite or level lists is left alone', () => {
    assert.deepEqual(ids.ensure_game_ids({ properties: {} }), { properties: {} });
    assert.equal(ids.ensure_game_ids(null), null);
});

test('new objects get random IDs that avoid every existing ID', () => {
    const data = ids.ensure_game_ids(legacy_game());
    const queue = ['s1', 's2', 'snew'];
    const sprite = {};
    const id = ids.assign_new_game_id(data, 'sprites', sprite, () => queue.shift());
    assert.equal(id, 'snew');
    assert.equal(sprite.id, 'snew');
});

test('a new object never reuses the ID of a deleted one', () => {
    const data = ids.ensure_game_ids(legacy_game());
    data.sprites.splice(2, 1); // delete s2
    const sprite = {};
    ids.assign_new_game_id(data, 'sprites', sprite);
    data.sprites.push(sprite);
    ids.ensure_game_ids(data);
    assert.notEqual(sprite.id, 's2');
    assert.match(sprite.id, /^s[a-z2-9]{10}$/);
});

test('random IDs are valid and use the collection prefix', () => {
    for (let i = 0; i < 200; i++) {
        assert.ok(ids.valid_game_id(ids.random_game_id('s')));
        assert.match(ids.random_game_id('l'), /^l[a-z2-9]{10}$/);
    }
});

test('unknown collections are rejected', () => {
    assert.throws(() => ids.assign_new_game_id({}, 'frames', {}), /unknown game id collection/);
});

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

// ------------------------------------------------------------ references

function legacy_game_with_references() {
    return {
        sprites: [
            { width: 24, traits: { actor: { attacks: [{ visual: { hit_sprite_index: 2 } }] } } },
            { width: 16, traits: { melee_attack: { attack: { visual: { kind: 'swoosh', attack_sprite_index: 2 } } } } },
            { width: 8, traits: { baddie: { drop: { sprite_index: 1, door_code: 3 },
                attacks: [{ visual: { kind: 'none', projectile_sprite_index: 0 } }] },
                ranged_attack: { attack: { visual: { projectile_sprite_index: 1, hit_sprite_index: 0 } } } } },
        ],
        levels: [{
            layers: [
                { type: 'sprites', sprites: [[0, 12, 0], [2, 36, 0, { door: { code: 3 } }], [1, 60, 24]] },
                { type: 'backdrop', rects: [] },
            ],
            conditions: [{ type: 'touching_level_complete' }, { type: 'need_sprite', properties: { sprite_index: 2 } }],
        }],
    };
}

function normalized(data) {
    ids.ensure_game_ids(data);
    return ids.convert_sprite_references_to_ids(data);
}

test('old index references become sprite IDs', () => {
    const data = normalized(legacy_game_with_references());
    assert.deepEqual(data.levels[0].layers[0].sprites,
        [['s0', 12, 0], ['s2', 36, 0, { door: { code: 3 } }], ['s1', 60, 24]]);
    assert.deepEqual(data.sprites[0].traits.actor.attacks[0].visual, { hit_sprite_id: 's2' });
    assert.deepEqual(data.sprites[1].traits.melee_attack.attack.visual, { kind: 'swoosh', attack_sprite_id: 's2' });
    assert.deepEqual(data.sprites[2].traits.baddie.drop, { door_code: 3, sprite_id: 's1' });
    assert.deepEqual(data.sprites[2].traits.baddie.attacks[0].visual, { kind: 'none', projectile_sprite_id: 's0' });
    assert.deepEqual(data.sprites[2].traits.ranged_attack.attack.visual,
        { projectile_sprite_id: 's1', hit_sprite_id: 's0' });
    assert.deepEqual(data.levels[0].conditions[1].properties, { sprite_id: 's2' });
});

test('an old game played after conversion sees exactly its old indices', () => {
    const original = legacy_game_with_references();
    const played = ids.resolve_sprite_references_to_indices(normalized(legacy_game_with_references()));
    for (const sprite of played.sprites) delete sprite.id;
    for (const level of played.levels) delete level.id;
    assert.deepEqual(played, original);
});

test('conversion is idempotent and keeps the placed-sprite array itself', () => {
    const data = normalized(legacy_game_with_references());
    const list = data.levels[0].layers[0].sprites;
    const before = JSON.stringify(data);
    ids.convert_sprite_references_to_ids(data);
    assert.equal(JSON.stringify(data), before);
    assert.equal(data.levels[0].layers[0].sprites, list);
});

test('references follow their sprite when sprites are reordered', () => {
    const data = normalized(legacy_game_with_references());
    data.sprites.reverse(); // s2, s1, s0
    const played = ids.resolve_sprite_references_to_indices(data);
    assert.deepEqual(played.levels[0].layers[0].sprites.map(p => p[0]), [2, 0, 1]);
    assert.equal(played.sprites[2].traits.actor.attacks[0].visual.hit_sprite_index, 0);
    assert.equal(played.sprites[0].traits.baddie.drop.sprite_index, 1);
});

test('invalid old indices are dropped, like a reference to a deleted sprite', () => {
    const data = normalized({
        sprites: [{ traits: { baddie: { drop: { sprite_index: 7 } },
            melee_attack: { attack: { visual: { kind: 'swoosh', hit_sprite_index: -1 } } } } }],
        levels: [{ layers: [{ type: 'sprites', sprites: [[0, 1, 2], [5, 3, 4], 'junk'] }] }],
    });
    assert.equal(data.sprites[0].traits.baddie.drop, undefined);
    assert.deepEqual(data.sprites[0].traits.melee_attack.attack.visual, { kind: 'swoosh' });
    assert.deepEqual(data.levels[0].layers[0].sprites, [['s0', 1, 2]]);
});

test('an ID reference wins over an index reference', () => {
    const data = normalized({
        sprites: [{}, { traits: { melee_attack: { attack: { visual: { hit_sprite_id: 's0', hit_sprite_index: 1 } } } } }],
        levels: [],
    });
    assert.deepEqual(data.sprites[1].traits.melee_attack.attack.visual, { hit_sprite_id: 's0' });
});

test('the studio keeps unknown IDs; playing drops them', () => {
    const data = normalized({
        sprites: [{ traits: { baddie: { drop: { sprite_id: 'gone' } } } }],
        levels: [{ layers: [{ type: 'sprites', sprites: [['gone', 1, 2], ['s0', 3, 4]] }],
            conditions: [{ type: 'need_sprite', properties: { sprite_id: 'gone' } }] }],
    });
    assert.deepEqual(data.levels[0].layers[0].sprites, [['gone', 1, 2], ['s0', 3, 4]]);
    assert.deepEqual(data.sprites[0].traits.baddie.drop, { sprite_id: 'gone' });
    const played = ids.resolve_sprite_references_to_indices(data);
    assert.deepEqual(played.levels[0].layers[0].sprites, [[0, 3, 4]]);
    assert.equal(played.sprites[0].traits.baddie.drop, undefined);
    assert.deepEqual(played.levels[0].conditions[0].properties, {});
});

test('resolving leaves old index games untouched', () => {
    const data = legacy_game_with_references();
    assert.deepEqual(ids.resolve_sprite_references_to_indices(data), legacy_game_with_references());
});

test('deleting a sprite removes exactly the references to it', () => {
    const data = normalized(legacy_game_with_references());
    data.sprites.splice(2, 1);
    ids.remove_sprite_references(data, 's2');
    assert.deepEqual(data.levels[0].layers[0].sprites, [['s0', 12, 0], ['s1', 60, 24]]);
    assert.deepEqual(data.sprites[0].traits.actor.attacks[0].visual, {});
    assert.deepEqual(data.sprites[1].traits.melee_attack.attack.visual, { kind: 'swoosh' });
    assert.deepEqual(data.levels[0].conditions[1].properties, {});
});

test('deleting a dropped sprite removes the drop', () => {
    const data = normalized(legacy_game_with_references());
    ids.remove_sprite_references(data, 's1');
    assert.equal(data.sprites[2].traits.baddie.drop, undefined);
    assert.deepEqual(data.sprites[2].traits.ranged_attack.attack.visual, { hit_sprite_id: 's0' });
});

test('sprite_index_by_id maps IDs to positions', () => {
    const map = ids.sprite_index_by_id({ sprites: [{ id: 'a' }, {}, { id: 'c' }] });
    assert.deepEqual([...map], [['a', 0], ['c', 2]]);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function sandbox() {
    const ctx = { console, crypto: require('node:crypto').webcrypto };
    vm.createContext(ctx);
    for (const f of ['game_ids.js', 'sprite_basket.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/static', f), 'utf8'), ctx, { filename: f });
    return ctx;
}

const frame = (src) => ({ src, tag: 'abc1234' });
const source = () => ({
    sprites: [
        { id: 's0', properties: { name: 'Pip mit Bogen' }, traits: { actor: { attacks: [{ visual: { projectile_sprite_id: 's1', hit_sprite_id: 's2' } }] } }, states: [{ frames: [frame('a')] }] },
        { id: 's1', properties: { name: 'Pfeil' }, traits: {}, states: [{ frames: [frame('b')] }] },
        { id: 's2', properties: { name: 'Funke' }, traits: {}, states: [{ frames: [frame('c')] }] },
        { id: 's3', traits: { baddie: { drop: { sprite_id: 's4', signal_code: 3 } } }, states: [{ frames: [frame('d')] }] },
        { id: 's4', traits: { key: {} }, states: [{ frames: [frame('e')] }] },
        { id: 's5', traits: {}, states: [{ frames: [frame('f')] }] },
    ],
});

test('what a sprite needs comes along, in the order of the other game', () => {
    const ctx = sandbox();
    const r = vm.runInContext('sprites_with_dependencies', ctx)(source(), ['s3', 's0']);
    assert.deepEqual([...r.ids], ['s0', 's1', 's2', 's3', 's4']);
    assert.deepEqual([...r.needed], ['s1', 's2', 's4']);
    const none = vm.runInContext('sprites_with_dependencies', ctx)(source(), ['s5']);
    assert.deepEqual([...none.ids], ['s5']);
    assert.deepEqual([...none.needed], []);
});

test('copies get new IDs and refer to each other; frames keep only their picture', () => {
    const ctx = sandbox();
    const target = { sprites: [{ id: 's0' }, { id: 's1' }] };   // same IDs as the other game
    const src = source();
    const copies = vm.runInContext('copy_sprites_for', ctx)(target, src.sprites.slice(0, 3), { drop_other_references: true });
    const ids = copies.map(c => c.id);
    assert.equal(new Set([...ids, 's0', 's1']).size, 5);
    const visual = copies[0].traits.actor.attacks[0].visual;
    assert.equal(visual.projectile_sprite_id, ids[1]);
    assert.equal(visual.hit_sprite_id, ids[2]);
    assert.deepEqual(JSON.parse(JSON.stringify(copies[1].states[0].frames)), [{ src: 'b' }]);
    // the other game is untouched
    assert.equal(src.sprites[0].id, 's0');
    assert.equal(src.sprites[0].traits.actor.attacks[0].visual.projectile_sprite_id, 's1');
});

test('a reference to a sprite that is not copied: kept in the same game, dropped from another', () => {
    const ctx = sandbox();
    const copy = vm.runInContext('copy_sprites_for', ctx);
    const src = source();
    const same = copy(src, [src.sprites[3]]);
    assert.equal(same[0].traits.baddie.drop.sprite_id, 's4');
    const other = copy({ sprites: [] }, [src.sprites[3]], { drop_other_references: true });
    assert.equal(other[0].traits.baddie.drop, undefined);
});

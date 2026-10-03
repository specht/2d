// Rückgängig for whole sprites in the sprite list (src/static/sprite_list_history.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { SpriteListHistory, next_undo_seq } = require('../src/static/sprite_list_history.js');

// a game with sprites and levels that place them, and the list operations
function fixture(ids) {
    const data = {
        sprites: ids.map(id => ({ id, pixels: `${id}-pixels` })),
        levels: [{ layers: [{ sprites: [] }] }],
    };
    const ops = {
        index_of: (id) => data.sprites.findIndex(s => s.id === id),
        take(id) {
            const index = this.index_of(id);
            const levels_before = JSON.stringify(data.levels);
            const [sprite] = data.sprites.splice(index, 1);
            for (const level of data.levels) for (const layer of level.layers) layer.sprites = layer.sprites.filter(p => p[0] !== id);
            return { json: JSON.stringify(sprite), index, levels_before, levels_after: JSON.stringify(data.levels) };
        },
        put(json, index) { data.sprites.splice(index, 0, JSON.parse(json)); },
        move(id, to) { const [s] = data.sprites.splice(this.index_of(id), 1); data.sprites.splice(to, 0, s); },
        levels_json: () => JSON.stringify(data.levels),
        set_levels(json) { data.levels = JSON.parse(json); },
    };
    return { data, ops, order: () => data.sprites.map(s => s.id).join(',') };
}

test('sprite list: a new sprite is taken out by undo and comes back by redo, with its later changes', () => {
    const { data, ops, order } = fixture(['a', 'b']);
    const h = new SpriteListHistory();
    data.sprites.push({ id: 'c' });
    h.record_insert(['c'], 2, data);
    // drawn on and placed after it was added
    data.sprites[2].pixels = 'drawn';
    data.levels[0].layers[0].sprites.push(['c', 0, 0]);
    assert.equal(h.undo(ops, data), 'Neues Sprite rückgängig gemacht.');
    assert.equal(order(), 'a,b');
    assert.equal(data.levels[0].layers[0].sprites.length, 0);
    assert.equal(h.redo(ops, data), 'Neues Sprite wiederhergestellt.');
    assert.equal(order(), 'a,b,c');
    assert.equal(data.sprites[2].pixels, 'drawn');
    // nothing changed the levels in between: its placed copy is back, too
    assert.deepEqual(data.levels[0].layers[0].sprites, [['c', 0, 0]]);
});

test('sprite list: several sprites at once (basket, Duplizieren) are one step and keep their places', () => {
    const { data, ops, order } = fixture(['a', 'b', 'c']);
    const h = new SpriteListHistory();
    data.sprites.splice(1, 0, { id: 'x' }, { id: 'y' });
    h.record_insert(['x', 'y'], 1, data);
    h.undo(ops, data);
    assert.equal(order(), 'a,b,c');
    h.redo(ops, data);
    assert.equal(order(), 'a,x,y,b,c');
});

test('sprite list: moving a sprite is undone and redone; a new change ends the redo chain', () => {
    const { data, ops, order } = fixture(['a', 'b', 'c']);
    const h = new SpriteListHistory();
    ops.move('a', 2);
    h.record_move('a', 0, 2, data);
    assert.equal(order(), 'b,c,a');
    h.undo(ops, data);
    assert.equal(order(), 'a,b,c');
    h.redo(ops, data);
    assert.equal(order(), 'b,c,a');
    h.undo(ops, data);
    ops.move('c', 0);
    h.record_move('c', 2, 0, data);
    assert.equal(h.redo(ops, data), null);
    // moving to the same place is no step
    h.record_move('c', 0, 0, data);
    assert.equal(h.undo_steps.length, 1);
});

test('sprite list: a new game starts a new history; steps are numbered with the shared counter', () => {
    const { data, ops } = fixture(['a']);
    const h = new SpriteListHistory();
    const before = next_undo_seq();
    data.sprites.push({ id: 'b' });
    h.record_insert(['b'], 1, data);
    assert.ok(h.last_undo_seq(data) > before);
    // undone now: its redo number is newer than anything before
    h.undo(ops, data);
    assert.ok(h.last_redo_seq(data) > before + 1);
    assert.equal(h.last_undo_seq({ sprites: [] }), 0);
});

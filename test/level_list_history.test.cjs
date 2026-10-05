const test = require('node:test');
const assert = require('node:assert/strict');
const { LevelListHistory } = require('../src/static/level_list_history.js');
const { LevelHistory } = require('../src/static/level_history.js');

// a level list and the ops the history works with
function setup(ids) {
    const data = { levels: ids.map(id => ({ id, properties: { name: id } })) };
    const ops = {
        index_of: (id) => data.levels.findIndex(l => l.id === id),
        take(id) { const [l] = data.levels.splice(this.index_of(id), 1); return JSON.stringify(l); },
        put(json, index) { data.levels.splice(Math.min(index, data.levels.length), 0, JSON.parse(json)); },
        move(id, to) { const [l] = data.levels.splice(this.index_of(id), 1); data.levels.splice(to, 0, l); },
    };
    return { data, ops, order: () => data.levels.map(l => l.id).join(' ') };
}

test('a new level is taken out again and comes back with redo', () => {
    const { data, ops, order } = setup(['a', 'b']);
    const h = new LevelListHistory();
    data.levels.push({ id: 'c', properties: { name: 'neu' } });
    h.record_insert('c', 2, data);
    assert.deepEqual(h.undo(ops, data), { text: 'Neues Level rückgängig gemacht.', show_index: 1 });
    assert.equal(order(), 'a b');
    assert.equal(h.redo(ops, data).show, 'c');
    assert.equal(order(), 'a b c');
    assert.equal(data.levels[2].properties.name, 'neu');
});

test('a deleted level comes back at its place, with its id', () => {
    const { data, ops, order } = setup(['a', 'b', 'c']);
    const h = new LevelListHistory();
    const json = JSON.stringify(data.levels[1]);
    data.levels.splice(1, 1);
    h.record_remove('b', 1, json, data);
    assert.equal(h.undo(ops, data).show, 'b');
    assert.equal(order(), 'a b c');
    h.redo(ops, data);
    assert.equal(order(), 'a c');
});

test('moving is undone and redone', () => {
    const { data, ops, order } = setup(['a', 'b', 'c']);
    const h = new LevelListHistory();
    ops.move('a', 2);
    h.record_move('a', 0, 2, data);
    h.undo(ops, data);
    assert.equal(order(), 'a b c');
    h.redo(ops, data);
    assert.equal(order(), 'b c a');
    assert.equal(h.record_move('a', 1, 1, data), undefined);
    assert.equal(h.undo_steps.length, 1);
});

test('another game starts afresh; a new step ends the redo chain', () => {
    const { data, ops } = setup(['a']);
    const h = new LevelListHistory();
    data.levels.push({ id: 'b' });
    h.record_insert('b', 1, data);
    h.undo(ops, data);
    assert.ok(h.last_redo_seq(data) > 0);
    data.levels.push({ id: 'c' });
    h.record_insert('c', 1, data);
    assert.equal(h.last_redo_seq(data), 0);
    assert.equal(h.last_undo_seq({ levels: [] }), 0);
});

test('level steps and list steps are numbered in the order they happen', () => {
    const { data } = setup(['a']);
    global.next_undo_seq = (() => { let n = 0; return () => ++n; })();
    try {
        const list = new LevelListHistory();
        const levels = new LevelHistory();
        levels.observe('a', '0');
        levels.observe('a', '1');
        list.record_insert('b', 1, data);
        assert.ok(list.last_undo_seq(data) > levels.last_undo_seq('a'));
        levels.observe('a', '2');
        assert.ok(levels.last_undo_seq('a') > list.last_undo_seq(data));
        levels.undo('a', '2');
        assert.ok(levels.last_redo_seq('a') > 0);
        assert.equal(levels.last_undo_seq('a'), 1);
    } finally {
        delete global.next_undo_seq;
    }
});

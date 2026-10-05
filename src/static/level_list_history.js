// Rückgängig / Wiederholen for whole levels in the level list: a new level
// (+), a duplicated level, a deleted level and a level dragged to another
// place.
//
// The per-level history (level_history.js) compares versions of the level
// being shown; the list itself is not part of it. This history records the
// operations, like the sprite list's (sprite_list_history.js):
//   insert { id, at }        undo: take the level out again; redo: put it back
//   remove { id, at, json }  undo: put it back (same id, so exits that lead
//                            there work again); redo: take it out again
//   move { id, from, to }    undo: back to `from`; redo: to `to`
// Strg+Z in the level pane undoes what happened last – a list change or a
// step of the level being shown: both number their steps with one counter
// (next_undo_seq in sprite_list_history.js). Right after deleting, the trash's
// own offer (trash_undo.js) comes first; it brings back the whole game, and
// both histories start afresh with it. Not in a live session.
//
// Pure apart from the ops it is given (tested in test/level_list_history.test.cjs).

const LEVEL_LIST_HISTORY_MAX_STEPS = 50;

let level_list_local_seq = 0;
function level_list_seq() {
    return typeof next_undo_seq === 'function' ? next_undo_seq() : ++level_list_local_seq;
}

class LevelListHistory {
    constructor() {
        this.data = null;
        this.undo_steps = [];
        this.redo_steps = [];
    }

    // a new game (or a game restored from the trash) starts afresh
    sync(data) {
        if (this.data !== data) {
            this.data = data;
            this.undo_steps = [];
            this.redo_steps = [];
        }
    }

    record(step, data) {
        this.sync(data);
        this.undo_steps.push({ ...step, seq: level_list_seq() });
        if (this.undo_steps.length > LEVEL_LIST_HISTORY_MAX_STEPS) this.undo_steps.shift();
        this.redo_steps = [];
    }

    record_insert(id, at, data) { if (id) this.record({ kind: 'insert', id, at }, data); }
    record_remove(id, at, json, data) { if (id && json) this.record({ kind: 'remove', id, at, json }, data); }
    record_move(id, from, to, data) { if (id && from !== to) this.record({ kind: 'move', id, from, to }, data); }

    last_undo_seq(data) { this.sync(data); return this.undo_steps.at(-1)?.seq ?? 0; }
    last_redo_seq(data) { this.sync(data); return this.redo_steps.at(-1)?.seq ?? 0; }

    // ops: index_of(id), take(id) → json, put(json, index), move(id, to)
    // Returns { text, show } – a short German text and the id of the level to
    // show afterwards (null: the one at `at`) – or null when there was nothing.
    undo(ops, data) {
        this.sync(data);
        const step = this.undo_steps.pop();
        if (!step) return null;
        let result = null;
        if (step.kind === 'insert') {
            if (ops.index_of(step.id) >= 0) step.json = ops.take(step.id);
            result = { text: 'Neues Level rückgängig gemacht.', show_index: Math.max(0, step.at - 1) };
        } else if (step.kind === 'remove') {
            if (ops.index_of(step.id) < 0) ops.put(step.json, step.at);
            result = { text: 'Gelöschtes Level ist wieder da.', show: step.id };
        } else if (step.kind === 'move') {
            if (ops.index_of(step.id) >= 0) ops.move(step.id, step.from);
            result = { text: 'Verschieben rückgängig gemacht.', show: step.id };
        }
        this.redo_steps.push({ ...step, seq: level_list_seq() });
        return result;
    }

    redo(ops, data) {
        this.sync(data);
        const step = this.redo_steps.pop();
        if (!step) return null;
        let result = null;
        if (step.kind === 'insert') {
            if (ops.index_of(step.id) < 0 && step.json) ops.put(step.json, step.at);
            result = { text: 'Neues Level wiederhergestellt.', show: step.id };
        } else if (step.kind === 'remove') {
            if (ops.index_of(step.id) >= 0) step.json = ops.take(step.id);
            result = { text: 'Level wieder gelöscht.', show_index: Math.max(0, step.at - 1) };
        } else if (step.kind === 'move') {
            if (ops.index_of(step.id) >= 0) ops.move(step.id, step.to);
            result = { text: 'Verschieben wiederholt.', show: step.id };
        }
        this.undo_steps.push({ ...step, seq: level_list_seq() });
        return result;
    }
}

// The game's level list as the operations the history needs (the level
// editor rebuilds its list afterwards).
function game_level_list_ops(game) {
    const levels = () => game.data.levels;
    return {
        index_of: (id) => levels().findIndex(l => l.id === id),
        take(id) {
            const index = this.index_of(id);
            const [level] = levels().splice(index, 1);
            window.collaboration?.structure_changed?.('level', 'delete', id);
            return JSON.stringify(level);
        },
        put(json, index) {
            const level = JSON.parse(json);
            levels().splice(Math.min(index, levels().length), 0, level);
            game.fix_game_data();
            window.collaboration?.structure_changed?.('level', 'insert', level.id);
        },
        move(id, to) {
            const from = this.index_of(id);
            const [level] = levels().splice(from, 1);
            levels().splice(Math.min(to, levels().length), 0, level);
            window.collaboration?.structure_changed?.('level', 'move', id);
        },
    };
}

if (typeof window !== 'undefined') window.level_list_history = new LevelListHistory();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LevelListHistory, game_level_list_ops, LEVEL_LIST_HISTORY_MAX_STEPS };
}

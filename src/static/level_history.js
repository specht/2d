// Rückgängig / Wiederholen im Level-Editor.
//
// The history does not know about individual editor actions. It keeps, per
// level (by its stable id), the level as it was after the last completed
// edit (`baseline`, serialized JSON) and the versions before it. The level
// editor calls observe() whenever an edit may just have been completed (mouse
// button released, key released, a field changed): if the level now differs
// from the baseline, the baseline becomes an undo step. So every way of
// changing a level is covered, also ones added later, and a whole drag is
// one step.
//
// Undoing is just another local edit: the editor puts the older version into
// the game, and a live collaboration session sends it like any other change.
// When somebody else changes a level (collaboration), its history is
// forgotten, so nobody can undo somebody else's work.

const LEVEL_HISTORY_MAX_STEPS = 100;
// All steps of one level together: big levels keep fewer steps.
const LEVEL_HISTORY_MAX_CHARS = 32 * 1024 * 1024;

class LevelHistory {
    constructor({ max_steps = LEVEL_HISTORY_MAX_STEPS, max_chars = LEVEL_HISTORY_MAX_CHARS } = {}) {
        this.max_steps = max_steps;
        this.max_chars = max_chars;
        this.levels = new Map(); // id → { baseline, undo: [], redo: [] }
    }

    entry(id) {
        if (!this.levels.has(id)) this.levels.set(id, { baseline: null, undo: [], redo: [] });
        return this.levels.get(id);
    }

    // Returns 'baseline' (first look at this level), 'same' or 'step'.
    observe(id, serialized) {
        if (typeof id !== 'string' || typeof serialized !== 'string') return 'same';
        const entry = this.entry(id);
        if (entry.baseline === null) {
            entry.baseline = serialized;
            return 'baseline';
        }
        if (serialized === entry.baseline) return 'same';
        entry.undo.push(entry.baseline);
        entry.redo = [];
        entry.baseline = serialized;
        this.trim(entry);
        return 'step';
    }

    // The level changed without an edit (shown for the first time, normalized
    // while being displayed): take it as it is, without an undo step.
    rebase(id, serialized) {
        if (typeof id !== 'string' || typeof serialized !== 'string') return;
        this.entry(id).baseline = serialized;
    }

    // The version to show instead of `serialized`, or null. An edit that was
    // not observed yet becomes a step first, so it is what gets undone.
    undo(id, serialized) {
        this.observe(id, serialized);
        const entry = this.levels.get(id);
        if (!entry?.undo.length) return null;
        entry.redo.push(entry.baseline);
        entry.baseline = entry.undo.pop();
        return entry.baseline;
    }

    redo(id, serialized) {
        // A new edit after undoing ends the redo chain (observe clears it).
        this.observe(id, serialized);
        const entry = this.levels.get(id);
        if (!entry?.redo.length) return null;
        entry.undo.push(entry.baseline);
        entry.baseline = entry.redo.pop();
        this.trim(entry);
        return entry.baseline;
    }

    can_undo(id) {
        return (this.levels.get(id)?.undo.length ?? 0) > 0;
    }

    can_redo(id) {
        return (this.levels.get(id)?.redo.length ?? 0) > 0;
    }

    forget(id) {
        this.levels.delete(id);
    }

    clear() {
        this.levels.clear();
    }

    // Oldest steps go first. The current version and the redo steps stay.
    trim(entry) {
        let chars = entry.undo.reduce((sum, s) => sum + s.length, 0) +
            entry.redo.reduce((sum, s) => sum + s.length, 0);
        while (entry.undo.length > 0 &&
            (entry.undo.length > this.max_steps || chars > this.max_chars)) {
            chars -= entry.undo.shift().length;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LevelHistory, LEVEL_HISTORY_MAX_STEPS, LEVEL_HISTORY_MAX_CHARS };
}

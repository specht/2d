// Rückgängig / Wiederholen for whole sprites in the sprite list: a new sprite
// (+), sprites added by Duplizieren, the sprite basket or a picture import
// (Game.add_sprites), and a sprite dragged to another place.
//
// The per-sprite history (sprite_history.js) compares versions of the sprite
// on the drawing area; whole sprites are not part of it. This list history
// records the operations themselves instead of copies of the game, so undoing
// one never throws away later work on other sprites:
//   insert { ids, at }   undo: take these sprites out again (with their placed
//                        copies, like the trash); redo: put them back
//   move { id, from, to } undo: back to `from`; redo: to `to`
// Strg+Z in the sprite pane undoes what happened last – a list change or a
// step of the sprite on the drawing area: both histories number their steps
// with one counter (next_undo_seq). Deleting a sprite has its own offer
// (trash_undo.js). Not in a live session: there the change has reached the
// others already.

let undo_seq_counter = 0;
function next_undo_seq() { return ++undo_seq_counter; }

const SPRITE_LIST_HISTORY_MAX_STEPS = 50;

class SpriteListHistory {
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
        this.undo_steps.push({ ...step, seq: next_undo_seq() });
        if (this.undo_steps.length > SPRITE_LIST_HISTORY_MAX_STEPS) this.undo_steps.shift();
        this.redo_steps = [];
    }

    record_insert(ids, at, data) { if (ids.length) this.record({ kind: 'insert', ids: [...ids], at }, data); }
    record_move(id, from, to, data) { if (from !== to) this.record({ kind: 'move', id, from, to }, data); }

    last_undo_seq(data) { this.sync(data); return this.undo_steps.at(-1)?.seq ?? 0; }
    last_redo_seq(data) { this.sync(data); return this.redo_steps.at(-1)?.seq ?? 0; }

    // ops: what the game can do with its sprite list (see game_sprite_list_ops):
    //   index_of(id), take(id) → { json, index, levels_before, levels_after },
    //   put(json, index), move(id, to), levels_json(), set_levels(json)
    // Returns a short German text of what was undone, or null.
    undo(ops, data) {
        this.sync(data);
        const step = this.undo_steps.pop();
        if (!step) return null;
        let text = null;
        if (step.kind === 'insert') {
            // the newest first, so the others keep their places
            step.taken = [];
            for (const id of [...step.ids].reverse()) {
                if (ops.index_of(id) < 0) continue;
                step.taken.unshift(ops.take(id));
            }
            text = step.ids.length === 1 ? 'Neues Sprite rückgängig gemacht.' : `${step.ids.length} neue Sprites rückgängig gemacht.`;
        } else if (step.kind === 'move') {
            if (ops.index_of(step.id) >= 0) ops.move(step.id, step.from);
            text = 'Verschieben rückgängig gemacht.';
        }
        // undone now: redone first (the most recently undone)
        this.redo_steps.push({ ...step, seq: next_undo_seq() });
        return text;
    }

    redo(ops, data) {
        this.sync(data);
        const step = this.redo_steps.pop();
        if (!step) return null;
        let text = null;
        if (step.kind === 'insert') {
            const levels_now = ops.levels_json();
            for (const taken of step.taken ?? []) ops.put(taken.json, taken.index);
            // their placed copies come back, unless the levels changed in between
            const first = step.taken?.[0];
            const last = step.taken?.at(-1);
            if (first && last && levels_now === last.levels_after) ops.set_levels(first.levels_before);
            text = step.ids.length === 1 ? 'Neues Sprite wiederhergestellt.' : `${step.ids.length} neue Sprites wiederhergestellt.`;
        } else if (step.kind === 'move') {
            if (ops.index_of(step.id) >= 0) ops.move(step.id, step.to);
            text = 'Verschieben wiederholt.';
        }
        const { taken, ...rest } = step;
        this.undo_steps.push({ ...rest, seq: next_undo_seq() });
        return text;
    }
}

// The game's sprite list, as the operations the history needs. Everything
// the list does when a sprite is added, deleted or moved by hand happens here
// too (references, placed copies, materials, titles, the level editor).
function game_sprite_list_ops(game) {
    const sprites = () => game.data.sprites;
    const refresh = () => {
        if (typeof canvas !== 'undefined') canvas.detachSprite?.();
        for (let si = 0; si < sprites().length; si++) game.create_geometry_and_material_for_sprite(si);
        game.refresh_frames_on_screen?.();
        game.sprites_widget?.rebuild?.();
        game.refresh_sprite_reference_pickers?.();
        game.refresh_sprite_titles?.();
        const le = game.level_editor;
        if (le) {
            le.sprite_index = Math.max(0, Math.min(le.sprite_index ?? 0, sprites().length - 1));
            le.refresh_sprite_widget?.();
            const level = game.data.levels[le.level_index];
            if (level) le.layer_structs?.[le.layer_index]?.apply_layer?.(level.layers[le.layer_index]);
            le.render?.();
        }
    };
    return {
        index_of: (id) => sprites().findIndex(s => s.id === id),
        take(id) {
            const index = this.index_of(id);
            const levels_before = JSON.stringify(game.data.levels);
            const [sprite] = sprites().splice(index, 1);
            remove_sprite_references(game.data, sprite.id);
            const levels_after = JSON.stringify(game.data.levels);
            refresh();
            return { json: JSON.stringify(sprite), index, levels_before, levels_after };
        },
        put(json, index) {
            sprites().splice(Math.min(index, sprites().length), 0, JSON.parse(json));
            game.fix_game_data();
            refresh();
        },
        move(id, to) {
            const from = this.index_of(id);
            const [sprite] = sprites().splice(from, 1);
            sprites().splice(Math.min(to, sprites().length), 0, sprite);
            refresh();
        },
        levels_json: () => JSON.stringify(game.data.levels),
        set_levels(json) {
            game.data.levels = JSON.parse(json);
            game.level_history?.clear?.();
            refresh();
        },
    };
}

if (typeof window !== 'undefined') {
    window.sprite_list_history = new SpriteListHistory();
    window.next_undo_seq = next_undo_seq;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpriteListHistory, next_undo_seq, SPRITE_LIST_HISTORY_MAX_STEPS };
}

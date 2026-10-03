// "Rückgängig" for a sprite or a level dragged into the trash.
//
// Deleting a sprite also removes every placed copy of it from the levels
// and every reference to it (game_ids.js remove_sprite_references), and the
// sprite and level histories do not cover whole sprites and levels. A sprite
// dragged into the trash by accident was gone for good. Now the trash keeps
// the game as it was just before, and a notice offers to bring it back:
// "»Pip« gelöscht. [Rückgängig]" – or Strg+Z.
//
// The offer lasts until the next click or key anywhere else (or 20 s): after
// that, putting the old game back would also undo newer work, so it is gone.
// Restoring loads the game as it was (like after a reload) and keeps whether
// it is saved and whether it is a recipe scene. Not during a live session:
// there the deletion has already reached the others. Frames and states have
// Strg+Z in the sprite editor (sprite_history.js), layers in the level editor.

const TRASH_UNDO_MS = 20000;

// Which list it is and how the deleted item is called; null: not offered.
function trash_undo_target(container_id, items, index) {
    const item = items?.[index];
    if (!item) return null;
    if (container_id === 'menu_sprites') {
        const name = typeof sprite_label === 'function' ? sprite_label(item, index) : `Sprite ${index + 1}`;
        return { kind: 'sprite', index, text: `Sprite »${name}« gelöscht.` };
    }
    if (container_id === 'menu_levels') {
        const name = String(item.properties?.name ?? '').trim() || `Level ${index + 1}`;
        return { kind: 'level', index, text: `Level »${name}« gelöscht.` };
    }
    return null;
}

class TrashUndo {
    constructor() {
        this.offer = null;
        // anything else done in the studio ends the offer
        document.addEventListener('mousedown', (e) => {
            if (this.offer && !e.target?.closest?.('.trash-undo')) this.end();
        }, true);
        // on window, capturing, and loaded before the level and sprite
        // editors: their Strg+Z must not run while this offer stands
        window.addEventListener('keydown', (e) => {
            if (!this.offer) return;
            const key = (e.key ?? '').toLowerCase();
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && key === 'z' &&
                !e.target?.closest?.('input, textarea, select, [contenteditable]')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                this.restore();
                return;
            }
            if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) this.end();
        }, true);
    }

    // DragAndDropWidget, right before delete_item(index)
    before(options, index) {
        if (window.collaboration?.code || !window.game?.data) return null;
        const target = trash_undo_target(options?.container?.attr?.('id'), options?.items, index);
        if (!target) return null;
        return {
            ...target,
            json: JSON.stringify(game.data),
            saved_state: game.saved_state,
            from_recipe: game.from_recipe ?? null,
        };
    }

    // ... and after everything the list does afterwards
    after(snapshot) {
        this.end();
        this.offer = snapshot;
        const box = $('<div class="trash-undo studio-notice showing">').appendTo('body');
        $('<span>').text(`${snapshot.text} `).appendTo(box);
        $('<button>').text('Rückgängig').on('click', () => this.restore()).appendTo(box);
        $('<span class="trash-undo-key">').text(' (Strg+Z)').appendTo(box);
        this.box = box;
        this.timer = setTimeout(() => this.end(), TRASH_UNDO_MS);
    }

    end() {
        clearTimeout(this.timer);
        this.offer = null;
        const box = this.box;
        this.box = null;
        if (box) { box.removeClass('showing'); setTimeout(() => box.remove(), 400); }
    }

    restore() {
        const snapshot = this.offer;
        this.end();
        if (!snapshot) return;
        game.data = JSON.parse(snapshot.json);
        game._load();
        // as unsaved (or saved) as it was, and still the recipe scene it was
        game.saved_state = snapshot.saved_state;
        if (snapshot.from_recipe) game.from_recipe = snapshot.from_recipe;
        game.refresh_own_game_button?.();
        if (snapshot.kind === 'sprite') {
            if (current_pane !== 'sprites') window.studio_show_pane?.('sprites');
            $('#menu_sprites > ._dnd_item').eq(snapshot.index).children().eq(0).trigger('click');
        } else {
            if (current_pane !== 'level') window.studio_show_pane?.('level');
            $('#menu_levels > ._dnd_item').eq(snapshot.index).children().eq(0).trigger('click');
        }
        window.studio_rescue && (window.studio_rescue.dirty = true);
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.trash_undo = new TrashUndo();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { trash_undo_target, TRASH_UNDO_MS };
}

// Rückgängig / Wiederholen im Sprite-Editor (Strg+Z, Strg+Y).
//
// Like the level editor (level_history.js, whose LevelHistory it reuses with
// sprite ids instead of level ids), it compares versions instead of recording
// actions: the sprite on the drawing area as JSON, before every mouse press
// and key press and after every release and field change in the sprite pane.
// So pixels, frames and states (added, duplicated, moved, deleted, pasted),
// Framerate, Titel and the sprite's properties are all undone the same way,
// and every way of changing a sprite added later is covered, too. A whole
// stroke or drag is one step.
//
// Undoing is just another local edit: the older version is put into the game
// (the same way a live session shows somebody else's change, keeping the
// zoom), and a session sends it like any other change; it is refused while
// somebody else holds the sprite. Changes from a session forget the sprite's
// steps (collaboration.js), so nobody undoes somebody else's work. Adding,
// deleting and reordering whole sprites is not part of it (like levels).

const SPRITE_HISTORY_MAX_STEPS = 100;
const SPRITE_HISTORY_MAX_CHARS = 32 * 1024 * 1024;

// The same sprite except for the pixels of its frames (same states, frame
// counts, settings and traits): an undo only has to reload pictures.
function sprite_same_structure(a, b) {
    const shape = (sprite) => JSON.stringify({
        ...sprite,
        states: (sprite?.states ?? []).map(state => ({ ...state, frames: (state?.frames ?? []).length })),
    });
    return !!a && !!b && shape(a) === shape(b);
}

class SpriteHistory {
    constructor() {
        this.data = null;
        this.history = null;
    }

    // a new game (or another session's copy) starts a new history
    steps() {
        const data = window.game?.data ?? null;
        if (!this.history || this.data !== data) {
            this.history = new LevelHistory({ max_steps: SPRITE_HISTORY_MAX_STEPS, max_chars: SPRITE_HISTORY_MAX_CHARS });
            this.data = data;
        }
        return this.history;
    }

    current() {
        const index = window.canvas?.sprite_index;
        const sprite = Number.isInteger(index) ? window.game?.data?.sprites?.[index] : null;
        return sprite && typeof sprite.id === 'string' ? { index, sprite, id: sprite.id } : null;
    }

    active() {
        return typeof current_pane !== 'undefined' && current_pane === 'sprites';
    }

    observe() {
        if (!this.active()) return;
        const current = this.current();
        if (!current) return;
        this.steps().observe(current.id, JSON.stringify(current.sprite));
        this.update_buttons();
    }

    // shown for the first time or tidied up without an edit: no step
    rebase() {
        const current = this.current();
        if (!current) return;
        this.steps().rebase(current.id, JSON.stringify(current.sprite));
        this.update_buttons();
    }

    undo() { this.step('undo'); }
    redo() { this.step('redo'); }

    step(direction) {
        const current = this.current();
        // not in the middle of a stroke, and not while somebody else holds it
        if (!current || window.canvas?.mouse_down) return;
        if (window.collaboration?.can_edit_current?.() === false) return;
        const serialized = this.steps()[direction](current.id, JSON.stringify(current.sprite));
        if (serialized !== null) {
            this.restore(current.index, JSON.parse(serialized));
            // the shown version is the step's version (nothing tidied on the way)
            this.steps().rebase(current.id, JSON.stringify(window.game.data.sprites[current.index]));
        }
        this.update_buttons();
    }

    // Puts an older version of the sprite into the game and shows it, on the
    // same state and frame and with the same zoom (like a session's change in
    // collaboration.js, which does not exist when live sessions are off).
    restore(index, sprite) {
        const game = window.game, canvas = window.canvas;
        const list = game.data.sprites;
        const attached = canvas?.sprite_index === index;
        const state_index = attached ? canvas.state_index : 0;
        const frame_index = attached ? canvas.frame_index : 0;
        const view = attached ? { visible_pixels: canvas.visible_pixels, offset_x: canvas.offset_x, offset_y: canvas.offset_y,
            width: canvas.bitmap?.width, height: canvas.bitmap?.height } : null;
        const keep_view = () => {
            if (!view || canvas.bitmap?.width !== view.width || canvas.bitmap?.height !== view.height) return;
            canvas.visible_pixels = view.visible_pixels;
            canvas.offset_x = view.offset_x;
            canvas.offset_y = view.offset_y;
            canvas.handleResize?.();
        };
        if (sprite_same_structure(list[index], sprite)) {
            // only pixels: the frames are updated in place, the lists stay
            sprite.states.forEach((state, si) => state.frames.forEach((frame, fi) => { list[index].states[si].frames[fi].src = frame.src; }));
            game.update_material_for_sprite(index);
            game.refresh_frames_on_screen();
            game.level_editor?.render?.();
            const src = attached ? list[index].states[state_index]?.frames[frame_index]?.src : null;
            if (src) canvas.loadFromUrl(src, false, keep_view);
        } else {
            if (attached) canvas.detachSprite();
            list[index] = sprite;
            game.create_geometry_and_material_for_sprite(index);
            game.update_material_for_sprite(index);
            game.refresh_frames_on_screen();
            game.refresh_sprite_titles?.();
            game.level_editor?.refresh_blend_materials?.();
            if (attached && sprite.states?.length) {
                const si = Math.max(0, Math.min(Number.isInteger(state_index) ? state_index : 0, sprite.states.length - 1));
                const frames = sprite.states[si].frames ?? [];
                const fi = Math.max(0, Math.min(Number.isInteger(frame_index) ? frame_index : 0, Math.max(0, frames.length - 1)));
                canvas.attachSprite(index, si, fi, () => {
                    keep_view();
                    game.build_sprite_traits_menu?.();
                    game.build_state_traits_menu?.();
                    window.sprite_preview?.update?.();
                });
            }
        }
        setTimeout(() => window.sprite_preview?.update?.(), 0);
    }

    forget(id) {
        this.history?.forget(id);
        this.update_buttons();
    }

    update_buttons() {
        if (typeof $ === 'undefined') return;
        const id = this.current()?.id;
        $('#status-bar .sprite-history-undo').toggleClass('disabled', !this.history?.can_undo(id));
        $('#status-bar .sprite-history-redo').toggleClass('disabled', !this.history?.can_redo(id));
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.sprite_history = new SpriteHistory();
    const history = window.sprite_history;
    const is_field = (target) => !!target?.closest?.('input, textarea, select, [contenteditable]');
    const in_sprites = () => typeof current_pane !== 'undefined' && current_pane === 'sprites';
    let timer = null;
    const observe_soon = (delay) => {
        clearTimeout(timer);
        timer = setTimeout(() => { timer = null; history.observe(); }, delay);
    };
    const flush = () => {
        if (!in_sprites()) return;
        clearTimeout(timer);
        timer = null;
        history.observe();
    };
    // before something can change: whatever happened so far is one step
    document.addEventListener('mousedown', flush, true);
    document.addEventListener('touchstart', flush, true);
    document.addEventListener('keydown', (e) => { if (!is_field(e.target)) flush(); }, true);
    // after it: the change becomes a step (once the editor has written it)
    document.addEventListener('mouseup', () => { if (in_sprites()) observe_soon(0); }, true);
    document.addEventListener('touchend', () => { if (in_sprites()) observe_soon(0); }, true);
    document.addEventListener('keyup', (e) => { if (in_sprites()) observe_soon(is_field(e.target) ? 800 : 0); }, true);
    document.addEventListener('change', (e) => { if (in_sprites()) observe_soon(is_field(e.target) ? 800 : 0); }, true);

    // Strg+Z / Strg+Y (or Strg+Umschalt+Z) by the printed letter, like in the
    // level editor; inside text fields the browser's own undo applies
    window.addEventListener('keydown', (e) => {
        if (!in_sprites() || !(e.ctrlKey || e.metaKey) || e.altKey || is_field(e.target)) return;
        const key = (e.key ?? '').toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        e.preventDefault();
        e.stopPropagation();
        if (key === 'z' && !e.shiftKey) history.undo();
        else history.redo();
    }, true);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SpriteHistory, sprite_same_structure, SPRITE_HISTORY_MAX_STEPS };
}

// Right-click menus of the sprite editor: sprites, states (Zustände) and frames.
//
// Duplizieren for sprites and states, and moving animations around: frames can
// be copied, cut and pasted (also into another state or sprite of the same
// size), a single frame can be moved to another state, and two states can swap
// their animations – for the classic mistake of drawing a walk into "stehen".
//
// States are referred to by their position inside a sprite (door states and
// the like), so a new state is always added at the end and states are never
// reordered here. The copy of a state does not take over its role ("läuft nach
// rechts" and so on): two states with the same role would compete.

// Frames on the clipboard: { frames: [src, …], width, height } – lives as long
// as the studio page, so frames can travel between sprites of the same size.
let frame_clipboard = null;

function frame_clipboard_fits(sprite) {
    return !!frame_clipboard && frame_clipboard.width === sprite.width && frame_clipboard.height === sprite.height;
}

function frame_clipboard_hint(sprite) {
    if (!frame_clipboard) return 'Kopiere zuerst Frames (Rechtsklick auf einen Frame oder Zustand).';
    if (!frame_clipboard_fits(sprite))
        return `Die kopierten Frames sind ${frame_clipboard.width}×${frame_clipboard.height} groß, dieses Sprite ${sprite.width}×${sprite.height}.`;
    return null;
}

function copy_frames_to_clipboard(sprite, srcs) {
    frame_clipboard = { frames: [...srcs], width: sprite.width, height: sprite.height };
}

function state_label_for(state, index) {
    return String(state?.properties?.name ?? '').trim() || `Zustand ${index + 1}`;
}

// A state's copy: the same pictures and settings, but no role.
function copy_state_without_role(state) {
    const copy = JSON.parse(JSON.stringify(state));
    for (const trait of Object.keys(copy.traits ?? {})) copy.traits[trait] = {};
    copy.frames = (copy.frames ?? []).map(frame => ({ src: frame.src }));
    return copy;
}

// A state for another sprite: roles only for the traits that sprite has.
function copy_state_for_sprite(state, sprite) {
    const copy = JSON.parse(JSON.stringify(state));
    for (const trait of Object.keys(copy.traits ?? {}))
        if (!(trait in (sprite.traits ?? {}))) delete copy.traits[trait];
    copy.frames = (copy.frames ?? []).map(frame => ({ src: frame.src }));
    return copy;
}

// Shows the sprite again after its states or frames changed (both lists).
function show_sprite_again(si, sti, fi) {
    const sprite = game.data.sprites[si];
    sti = Math.max(0, Math.min(sti, sprite.states.length - 1));
    fi = Math.max(0, Math.min(fi, sprite.states[sti].frames.length - 1));
    canvas.detachSprite();
    canvas.attachSprite(si, sti, fi, () => {
        game.build_state_traits_menu();
        game.update_material_for_sprite(si);
        game.refresh_frames_on_screen();
        game.level_editor?.refresh_sprite_widget?.();
        mark_frame_selection();
    });
}

// ------------------------------------------------------------ sprites

function sprite_context_menu(si) {
    const sprite = game.data.sprites[si];
    if (!sprite) return [];
    // a right click on one of several selected sprites: the menu for all of them
    const chosen = selected_sprites();
    if (chosen.length > 1 && chosen.includes(si)) return sprite_selection_menu(chosen);
    const can_delete = game.data.sprites.length > 1 && (window.collaboration?.can_delete?.('sprite', sprite.id) ?? true);
    return [
        { header: sprite_label(sprite, si) },
        { label: 'Umbenennen', icon: 'fa-pencil', hint: 'Der Titel steht oben bei „Sprite“.', callback: () => rename_sprite(si) },
        { label: 'Duplizieren', icon: 'fa-clone', callback: () => duplicate_sprite(si),
            hint: 'Eine Kopie mit allen Zuständen, Frames und Eigenschaften – gleich dahinter in der Liste.' },
        show_in_level_item(si),
        '-',
        { label: 'Sprites holen (Katalog oder anderes Spiel) …', icon: 'fa-shopping-basket', callback: () => { if (typeof show_sprite_basket === 'function') show_sprite_basket(); } },
        '-',
        { label: 'Löschen', icon: 'fa-trash', disabled: !can_delete,
            hint: can_delete ? 'Auch aus allen Levels. Gleich danach kannst du es mit „Rückgängig“ zurückholen. Mehrere auf einmal: mit Shift oder Strg anklicken.' : 'Das letzte Sprite bleibt.',
            callback: () => game.sprites_widget?.delete_index?.(si) },
        select_unused_item(),
    ];
}

// ------------------------------------------------------------ tidying up
// "Im Level zeigen": the level editor marks every copy (level_editor.js
// find_sprite) – in the level shown if it is there, else in the first level
// that has it.
function show_in_level_item(si) {
    const sprite = game.data.sprites[si];
    const entry = typeof sprite_usage === 'function' ? sprite_usage(game.data).get(sprite?.id) : null;
    const placed = entry?.placed ?? 0;
    return { label: placed ? `Im Level zeigen (${placed}×)` : 'Im Level zeigen', icon: 'fa-crosshairs', disabled: !placed,
        hint: placed ? `In ${entry.levels.size === 1 ? '1 Level' : `${entry.levels.size} Leveln`} – der Level-Editor markiert jedes Exemplar.` :
            entry?.needed ? 'In keinem Level gesetzt – aber ein anderes Sprite braucht es (Angriffsbild, Beute …).' : 'In keinem Level gesetzt.',
        callback: () => {
            const editor = game.level_editor;
            if (window.studio_show_pane?.('level')) studio_history_push?.({ pane: 'level' });
            if (!editor) return;
            const here = entry.levels.has(editor.level_index) ? editor.level_index : Math.min(...entry.levels.keys());
            if (here !== editor.level_index) editor.levels_widget?.select_index(here);
            editor.find_sprite(si);
        } };
}

// "Unbenutzte zeigen und auswählen": the list shows only what no level has
// and nothing else needs (sprite_filter.js), all of it selected – a right
// click deletes them at once (with one Rückgängig).
function select_unused_item() {
    const unused = typeof unused_sprite_ids === 'function' ? unused_sprite_ids(game.data) : new Set();
    if (!unused.size) return null;
    return { label: `Unbenutzte zeigen und auswählen (${unused.size})`, icon: 'fa-filter',
        hint: 'Alle Sprites, die in keinem Level vorkommen und die kein anderes Sprite braucht. Danach: Rechtsklick → löschen. Gelöschtes holt „Rückgängig“ zurück.',
        callback: () => select_unused_sprites() };
}

function select_unused_sprites() {
    const unused = unused_sprite_ids(game.data);
    const indices = game.data.sprites.map((s, i) => unused.has(s.id) ? i : -1).filter(i => i >= 0);
    if (!indices.length) return;
    game.sprite_list_filter?.set_kind?.('unused');
    // the sprite shown always belongs to the selection: one of them is shown
    if (!indices.includes(canvas.sprite_index)) game.sprites_widget?.select_index?.(indices[0]);
    set_sprite_selection(indices);
}

// ------------------------------------------------------------ several sprites
// In the sprite list, as in the frame list: Shift + click selects every
// sprite from the one shown to the clicked one, Strg + click adds or removes
// one; a plain click selects nothing but the sprite it shows. A right click on
// a selected sprite then deletes all of them at once (with one Rückgängig).
// The selection is kept by sprite ID, so it survives the list being sorted;
// the sprite shown always belongs to it. Only sprites the search shows can be
// selected: a range never takes hidden ones along. Marked: .sprite-selected.

let sprite_selection = new Set();

// The indices of a range, only those the list shows (pure; tests).
function visible_range(a, b, shown) {
    return frame_range(a, b).filter(i => shown(i));
}

// What may go: never every sprite (one stays), never one somebody else is
// editing in a session. Returns { indices, kept_last, locked } (pure; tests).
function sprites_to_delete(indices, count, can_delete) {
    let chosen = valid_frame_indices(indices, count);
    const locked = chosen.filter(i => !can_delete(i));
    chosen = chosen.filter(i => can_delete(i));
    let kept_last = false;
    if (count > 0 && chosen.length >= count) {
        chosen = chosen.slice(1);
        kept_last = true;
    }
    return { indices: chosen, kept_last, locked };
}

function sprite_item_shown(i) {
    const item = document.querySelectorAll('#menu_sprites > ._dnd_item:not(.add):not(.placeholder)')[i];
    return !!item && item.style.display !== 'none';
}

function selected_sprites() {
    if (!sprite_selection.size) return [];
    const sprites = game?.data?.sprites ?? [];
    const indices = sprites.map((s, i) => sprite_selection.has(s.id) ? i : -1).filter(i => i >= 0);
    if (Number.isInteger(canvas?.sprite_index)) indices.push(canvas.sprite_index);
    return valid_frame_indices(indices, sprites.length);
}

function set_sprite_selection(indices) {
    sprite_selection = new Set(indices.map(i => game.data.sprites[i]?.id).filter(Boolean));
    mark_sprite_selection();
}

function clear_sprite_selection() {
    if (!sprite_selection.size) return;
    sprite_selection = new Set();
    mark_sprite_selection();
}

function mark_sprite_selection() {
    if (typeof $ === 'undefined') return;
    const chosen = new Set(selected_sprites().length > 1 ? selected_sprites() : []);
    $('#menu_sprites > ._dnd_item').not('.add, .placeholder').each((i, el) => $(el).toggleClass('sprite-selected', chosen.has(i)));
}

function sprite_selection_menu(chosen) {
    const plan = sprites_to_delete(chosen, game.data.sprites.length,
        (i) => window.collaboration?.can_delete?.('sprite', game.data.sprites[i]?.id) ?? true);
    const n = plan.indices.length;
    const hint = plan.kept_last ? 'Ein Sprite bleibt – das erste der Auswahl wird nicht gelöscht.' :
        plan.locked.length ? `${plan.locked.length} bearbeitet gerade jemand anderes – die bleiben.` :
        'Auch aus allen Levels. Gleich danach kannst du sie mit „Rückgängig“ zurückholen.';
    return [
        { header: `${chosen.length} Sprites ausgewählt` },
        { label: n === 1 ? '1 Sprite löschen' : `${n} Sprites löschen`, icon: 'fa-trash', disabled: n === 0, hint,
            callback: () => delete_sprites(plan.indices) },
        '-',
        { label: 'Auswahl aufheben', icon: 'fa-times', callback: () => clear_sprite_selection() },
    ];
}

// One action: the list loses them all, and one Rückgängig brings them back.
function delete_sprites(indices) {
    const widget = game.sprites_widget;
    if (!widget || !indices.length) return;
    const undo = window.trash_undo?.before?.(widget.options, indices[0]) ?? null;
    if (undo && indices.length > 1) undo.text = `${indices.length} Sprites gelöscht.`;
    const items = widget.options.container.children('._dnd_item').not('.add, .placeholder');
    // from the back, so that the indices in front stay right
    for (const i of [...indices].sort((a, b) => b - a)) {
        items.eq(i).remove();
        widget.options.delete_item(i);
    }
    clear_sprite_selection();
    const left = widget.options.container.children('._dnd_item').not('.add, .placeholder');
    const select = Math.max(0, Math.min(indices[0], left.length - 1));
    if (left.length) widget.options.onclick(left.eq(select).children().eq(0)[0], select);
    game.refresh_frames_on_screen?.();
    if (undo) window.trash_undo.after(undo);
}

// Shift / Strg + click in the sprite list: caught before the list's own click.
if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', (e) => {
        const item = e.target?.closest?.('#menu_sprites > ._dnd_item');
        if (!item || item.classList.contains('add') || e.button !== 0) return;
        const items = [...item.parentNode.children].filter(el => el.classList.contains('_dnd_item') && !el.classList.contains('add') && !el.classList.contains('placeholder'));
        const index = items.indexOf(item);
        if (index < 0) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const current = canvas.sprite_index ?? index;
            if (e.shiftKey) set_sprite_selection(visible_range(current, index, sprite_item_shown));
            else {
                const known = selected_sprites();
                const set = new Set(known.length ? known : [current]);
                if (set.has(index) && index !== current) set.delete(index); else set.add(index);
                set_sprite_selection([...set]);
            }
        } else if (!selected_sprites().includes(index)) {
            clear_sprite_selection();
        }
    }, true);
    document.addEventListener('click', (e) => {
        if (!e.target?.closest?.('#menu_sprites > ._dnd_item:not(.add)')) return;
        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) { clear_sprite_selection(); return; }
        e.preventDefault();
        e.stopPropagation();
    }, true);
    // the list is rebuilt after many actions: the marks follow
    document.addEventListener('mouseup', () => setTimeout(mark_sprite_selection, 0), true);
}

// Umbenennen: the sprite is shown and its Titel field gets the focus.
function rename_sprite(si) {
    const focus = () => {
        const input = $('#menu_sprite_properties .item').first().find('input');
        input.focus();
        input[0]?.select();
    };
    if (canvas.sprite_index !== si) {
        $('#menu_sprites > ._dnd_item').eq(si).children().eq(0).trigger('click');
        setTimeout(focus, 50);
    } else focus();
}

function duplicate_sprite(si) {
    const original = game.data.sprites[si];
    const [copy] = copy_sprites_for(game.data, [original]);
    set_sprite_title(copy, `${sprite_label(original, si)} (Kopie)`);
    game.add_sprites([copy], { at: si + 1 });
}

// ------------------------------------------------------------ states

function state_context_menu(sti) {
    const si = canvas.sprite_index;
    const sprite = game.data.sprites[si];
    const state = sprite?.states?.[sti];
    if (!state) return [];
    const others = sprite.states.map((s, i) => i).filter(i => i !== sti);
    const same_size = game.data.sprites.map((s, i) => i).filter(i => i !== si &&
        game.data.sprites[i].width === sprite.width && game.data.sprites[i].height === sprite.height);
    const paste_hint = frame_clipboard_hint(sprite);
    return [
        { header: state_label_for(state, sti) },
        { label: 'Umbenennen', icon: 'fa-pencil', hint: 'Auch mit einem Doppelklick auf den Zustand.', callback: () => canvas.states_widget?.start_rename?.(sti) },
        { label: 'Duplizieren', icon: 'fa-clone', callback: () => duplicate_state(si, sti),
            hint: 'Eine Kopie dieses Zustands am Ende der Liste – mit allen Frames, aber noch ohne Rolle (zum Beispiel „läuft nach links“).' },
        '-',
        { label: 'Animation kopieren', icon: 'fa-copy', callback: () => copy_frames_to_clipboard(sprite, state.frames.map(f => f.src)),
            hint: 'Kopiert alle Frames dieses Zustands. Einfügen kannst du sie in jedem Zustand eines Sprites mit derselben Größe.' },
        { label: 'Frames einfügen (am Ende)', icon: 'fa-paste', disabled: !!paste_hint, hint: paste_hint ?? 'Hängt die kopierten Frames hinten an.',
            callback: () => paste_frames(si, sti, state.frames.length - 1) },
        { label: 'Animation tauschen mit', icon: 'fa-exchange', empty: 'Das Sprite hat nur diesen Zustand.',
            hint: 'Tauscht die Frames (und die Framerate) der beiden Zustände – Titel und Rollen bleiben, wo sie sind.',
            children: others.map(i => ({ label: state_label_for(sprite.states[i], i), callback: () => swap_animations(si, sti, i) })) },
        { label: 'In anderes Sprite kopieren', icon: 'fa-share', empty: 'Kein anderes Sprite hat dieselbe Größe.',
            // in a live session only the sprite one is working on is sent: there, open
            // the other sprite and paste the copied animation into it
            disabled: !!window.collaboration?.code,
            hint: window.collaboration?.code
                ? 'Während ihr gemeinsam bearbeitet: Animation kopieren, das andere Sprite öffnen und dort Frames einfügen.'
                : 'Kopiert diesen Zustand ans Ende eines anderen Sprites mit derselben Größe.',
            children: same_size.map(i => ({ label: sprite_label(game.data.sprites[i], i), callback: () => copy_state_to_sprite(si, sti, i) })) },
        '-',
        { label: 'Löschen', icon: 'fa-trash', disabled: sprite.states.length < 2,
            hint: sprite.states.length < 2 ? 'Ein Sprite braucht mindestens einen Zustand.' : 'Strg+Z holt ihn zurück.',
            callback: () => canvas.states_widget?.delete_index?.(sti) },
    ];
}

function duplicate_state(si, sti) {
    const sprite = game.data.sprites[si];
    const copy = copy_state_without_role(sprite.states[sti]);
    copy.properties = { ...(copy.properties ?? {}), name: `${state_label_for(sprite.states[sti], sti)} (Kopie)` };
    sprite.states.push(copy);
    game.fix_game_data();
    show_sprite_again(si, sprite.states.length - 1, 0);
}

function swap_animations(si, a, b) {
    const sprite = game.data.sprites[si];
    const sa = sprite.states[a], sb = sprite.states[b];
    [sa.frames, sb.frames] = [sb.frames, sa.frames];
    [sa.properties.fps, sb.properties.fps] = [sb.properties.fps, sa.properties.fps];
    show_sprite_again(si, a, 0);
}

function copy_state_to_sprite(si, sti, target) {
    const sprite = game.data.sprites[target];
    sprite.states.push(copy_state_for_sprite(game.data.sprites[si].states[sti], sprite));
    game.fix_game_data();
    game.update_material_for_sprite(target);
    game.refresh_frames_on_screen();
    show_state_notice(`„${state_label_for(game.data.sprites[si].states[sti], sti)}“ ist jetzt auch in ${sprite_label(sprite, target)} (ganz unten).`);
}

// ------------------------------------------------------------ several frames
//
// In the frame list, Shift + click selects every frame from the one being
// drawn to the clicked one, Strg + click adds or removes one frame; a plain
// click selects nothing but the frame it shows. A right click on a selected
// frame then works on all of them: duplicate, copy, cut, delete, reverse
// their order, move them to another state. The frame being drawn always
// belongs to the selection. Selected frames are outlined (.frame-selected).

let frame_selection = { si: null, sti: null, set: new Set() };

// Pure helpers on a state's frames (tests: sprite_actions.test.cjs).
function frame_range(a, b) {
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

function valid_frame_indices(indices, count) {
    return [...new Set(indices)].filter(i => Number.isInteger(i) && i >= 0 && i < count).sort((a, b) => a - b);
}

// Copies of the selected frames right after the last of them, in order.
// Returns the new frames and the indices of the copies.
function duplicate_frames_in(frames, indices) {
    const chosen = valid_frame_indices(indices, frames.length);
    if (!chosen.length) return { frames, selection: [] };
    const at = chosen[chosen.length - 1] + 1;
    const copies = chosen.map(i => ({ src: frames[i].src }));
    return { frames: [...frames.slice(0, at), ...copies, ...frames.slice(at)], selection: copies.map((_, k) => at + k) };
}

// Never every frame: a state keeps at least one.
function remove_frames_from(frames, indices) {
    const chosen = new Set(valid_frame_indices(indices, frames.length));
    if (!chosen.size || chosen.size >= frames.length) return { frames, removed: [] };
    return { frames: frames.filter((_, i) => !chosen.has(i)), removed: frames.filter((_, i) => chosen.has(i)) };
}

// The selected frames in reverse order, each in one of their places: a
// movement played backwards (for example to make a ping-pong animation).
function reverse_frames_in(frames, indices) {
    const chosen = valid_frame_indices(indices, frames.length);
    const result = [...frames];
    chosen.forEach((index, k) => { result[index] = frames[chosen[chosen.length - 1 - k]]; });
    return result;
}

// Several selected frames dragged together: the frame list moved the one
// that was dragged (from → to); the others follow it as a block, in their
// order, so that the block lands where that frame was dropped. Returns the
// new frames and the indices of the block.
function move_frames_block(frames, indices, from, to) {
    const chosen = new Set(valid_frame_indices(indices, frames.length));
    const single = [...frames];
    const [dragged] = single.splice(from, 1);
    single.splice(to, 0, dragged);
    // how many unselected frames come before the dropped one
    const before = single.slice(0, to).filter(frame => !frames.some((f, i) => f === frame && chosen.has(i))).length;
    const others = frames.filter((_, i) => !chosen.has(i));
    const block = frames.filter((_, i) => chosen.has(i));
    return {
        frames: [...others.slice(0, before), ...block, ...others.slice(before)],
        selection: block.map((_, k) => before + k),
    };
}

// The frame list (canvas.js) asks before it moves or deletes a frame:
// the selection, if that frame belongs to one of several frames.
function selection_for_list_action(index) {
    const chosen = selected_frames();
    return chosen.length > 1 && chosen.includes(index) ? chosen : null;
}

// After the list moved the dragged frame: the rest of the selection follows.
function finish_block_move(si, sti, before, chosen, from, to) {
    const state = game.data.sprites[si]?.states?.[sti];
    if (state) {
        const result = move_frames_block(before, chosen, from, to);
        state.frames = result.frames;
        show_frames_again(si, sti, result.selection);
    }
    block_action_done();
}

// The list's own step and the rest of the selection: one undo step.
function block_action_done() {
    canvas.working = false;
    window.sprite_history?.observe?.();
}

// After the list deleted the dragged frame (into the trash): the rest of
// the selection goes, too – a state keeps at least one frame.
function finish_block_delete(si, sti, chosen, deleted) {
    const state = game.data.sprites[si]?.states?.[sti];
    if (state) {
        const rest = chosen.filter(i => i !== deleted).map(i => i > deleted ? i - 1 : i);
        const result = remove_frames_from(state.frames, rest);
        if (result.removed.length) state.frames = result.frames;
        clear_frame_selection();
        show_sprite_again(si, sti, Math.min(Math.min(...chosen), state.frames.length - 1));
    }
    block_action_done();
}

function selected_frames() {
    const si = canvas?.sprite_index, sti = canvas?.state_index;
    const frames = game?.data?.sprites?.[si]?.states?.[sti]?.frames ?? [];
    if (frame_selection.si !== si || frame_selection.sti !== sti || !frame_selection.set.size) return [];
    return valid_frame_indices([...frame_selection.set, canvas.frame_index], frames.length);
}

function set_frame_selection(indices) {
    frame_selection = { si: canvas.sprite_index, sti: canvas.state_index, set: new Set(indices) };
    mark_frame_selection();
}

function clear_frame_selection() {
    if (!frame_selection.set.size) return;
    frame_selection = { si: null, sti: null, set: new Set() };
    mark_frame_selection();
}

function mark_frame_selection() {
    // (a page whose studio.js never arrived has neither: studio.html reloads it)
    if (typeof $ === 'undefined' || typeof game === 'undefined' || typeof canvas === 'undefined') return;
    const chosen = new Set(selected_frames().length > 1 ? selected_frames() : []);
    $('#menu_frames > ._dnd_item').each((i, el) => $(el).toggleClass('frame-selected', chosen.has(i)));
}

// Shift / Strg + click in the frame list: caught before the list's own
// click (which would show the frame and start a drag).
if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', (e) => {
        const item = e.target?.closest?.('#menu_frames > ._dnd_item');
        if (!item || item.classList.contains('add') || e.button !== 0) return;
        const index = Array.prototype.indexOf.call(item.parentNode.children, item);
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            const current = canvas.frame_index;
            const known = selected_frames();
            if (e.shiftKey) set_frame_selection(frame_range(current, index));
            else {
                const set = new Set(known.length ? known : [current]);
                if (set.has(index) && index !== current) set.delete(index); else set.add(index);
                set_frame_selection([...set]);
            }
        } else if (!selected_frames().includes(index)) {
            clear_frame_selection();
        }
        // a selected frame keeps the selection while it may be dragged (the
        // others follow it); a plain click on it ends the selection below
    }, true);
    // ... and the click that follows must not show the clicked frame; a
    // plain click (not a drag) selects nothing but the frame it shows
    document.addEventListener('click', (e) => {
        if (!e.target?.closest?.('#menu_frames > ._dnd_item:not(.add)')) return;
        if (!(e.shiftKey || e.ctrlKey || e.metaKey)) { clear_frame_selection(); return; }
        e.preventDefault();
        e.stopPropagation();
    }, true);
    // the list is rebuilt after many actions: the outlines follow
    document.addEventListener('mouseup', () => setTimeout(mark_frame_selection, 0), true);
}

// ------------------------------------------------------------ frames

function frame_context_menu(fi) {
    const si = canvas.sprite_index, sti = canvas.state_index;
    const sprite = game.data.sprites[si];
    const state = sprite?.states?.[sti];
    const frame = state?.frames?.[fi];
    if (!frame) return [];
    const chosen = selected_frames();
    if (chosen.length > 1 && chosen.includes(fi)) return frames_context_menu(si, sti, chosen);
    clear_frame_selection();
    const only = state.frames.length < 2;
    const paste_hint = frame_clipboard_hint(sprite);
    const others = sprite.states.map((s, i) => i).filter(i => i !== sti);
    return [
        { label: 'Duplizieren', icon: 'fa-clone', callback: () => duplicate_frame(si, sti, fi),
            hint: 'Eine Kopie dieses Frames direkt dahinter. Für mehrere Frames: erst mit Shift oder Strg anklicken, dann Rechtsklick.' },
        '-',
        { label: 'Kopieren', icon: 'fa-copy', callback: () => copy_frames_to_clipboard(sprite, [frame.src]) },
        { label: 'Ausschneiden', icon: 'fa-scissors', disabled: only, hint: only ? 'Ein Zustand braucht mindestens einen Frame.' : null,
            callback: () => { copy_frames_to_clipboard(sprite, [frame.src]); remove_frame(si, sti, fi); } },
        { label: 'Einfügen (dahinter)', icon: 'fa-paste', disabled: !!paste_hint, hint: paste_hint,
            callback: () => paste_frames(si, sti, fi) },
        '-',
        { label: 'In anderen Zustand verschieben', icon: 'fa-share', empty: 'Das Sprite hat nur diesen Zustand.',
            disabled: only, hint: only ? 'Ein Zustand braucht mindestens einen Frame.' : 'Der Frame kommt ans Ende des anderen Zustands.',
            children: others.map(i => ({ label: state_label_for(sprite.states[i], i), callback: () => move_frame_to_state(si, sti, fi, i) })) },
        '-',
        { label: 'Löschen', icon: 'fa-trash', disabled: only, hint: only ? 'Ein Zustand braucht mindestens einen Frame.' : 'Strg+Z holt ihn zurück.',
            callback: () => remove_frame(si, sti, fi) },
    ];
}

// The right-click menu for several selected frames.
function frames_context_menu(si, sti, chosen) {
    const sprite = game.data.sprites[si];
    const state = sprite.states[sti];
    const n = chosen.length;
    const all = n >= state.frames.length;
    const all_hint = all ? 'Ein Zustand braucht mindestens einen Frame – lass einen übrig.' : null;
    const others = sprite.states.map((s, i) => i).filter(i => i !== sti);
    const paste_hint = frame_clipboard_hint(sprite);
    return [
        { label: `${n} Frames duplizieren`, icon: 'fa-clone', callback: () => duplicate_selected_frames(si, sti, chosen),
            hint: 'Kopien der ausgewählten Frames direkt hinter dem letzten von ihnen, in derselben Reihenfolge.' },
        { label: 'Reihenfolge umkehren', icon: 'fa-exchange', callback: () => reverse_selected_frames(si, sti, chosen),
            hint: 'Die ausgewählten Frames laufen rückwärts. Mit Duplizieren und Umkehren wird aus „hin“ ein „hin und zurück“.' },
        '-',
        { label: `${n} Frames kopieren`, icon: 'fa-copy', callback: () => copy_frames_to_clipboard(sprite, chosen.map(i => state.frames[i].src)) },
        { label: `${n} Frames ausschneiden`, icon: 'fa-scissors', disabled: all, hint: all_hint,
            callback: () => { copy_frames_to_clipboard(sprite, chosen.map(i => state.frames[i].src)); remove_selected_frames(si, sti, chosen); } },
        { label: 'Einfügen (dahinter)', icon: 'fa-paste', disabled: !!paste_hint, hint: paste_hint,
            callback: () => paste_frames(si, sti, chosen[n - 1]) },
        { label: `${n} Frames löschen`, icon: 'fa-trash', disabled: all, hint: all_hint,
            callback: () => remove_selected_frames(si, sti, chosen) },
        '-',
        { label: 'In anderen Zustand verschieben', icon: 'fa-share', empty: 'Das Sprite hat nur diesen Zustand.',
            disabled: all, hint: all_hint ?? 'Die Frames kommen ans Ende des anderen Zustands, in derselben Reihenfolge.',
            children: others.map(i => ({ label: state_label_for(sprite.states[i], i), callback: () => move_selected_frames_to_state(si, sti, chosen, i) })) },
    ];
}

function duplicate_selected_frames(si, sti, chosen) {
    const state = game.data.sprites[si].states[sti];
    const result = duplicate_frames_in(state.frames, chosen);
    state.frames = result.frames;
    show_frames_again(si, sti, result.selection);
}

function reverse_selected_frames(si, sti, chosen) {
    const state = game.data.sprites[si].states[sti];
    state.frames = reverse_frames_in(state.frames, chosen);
    show_frames_again(si, sti, chosen);
}

function remove_selected_frames(si, sti, chosen) {
    const state = game.data.sprites[si].states[sti];
    const result = remove_frames_from(state.frames, chosen);
    if (!result.removed.length) return;
    state.frames = result.frames;
    clear_frame_selection();
    show_sprite_again(si, sti, Math.min(chosen[0], state.frames.length - 1));
}

function move_selected_frames_to_state(si, sti, chosen, target) {
    const sprite = game.data.sprites[si];
    const result = remove_frames_from(sprite.states[sti].frames, chosen);
    if (!result.removed.length) return;
    sprite.states[sti].frames = result.frames;
    const start = sprite.states[target].frames.length;
    sprite.states[target].frames.push(...result.removed.map(frame => ({ src: frame.src })));
    clear_frame_selection();
    show_sprite_again(si, target, start);
}

// After an action on several frames: shown again, the same frames (or their
// copies) still selected, the first of them on the drawing area.
function show_frames_again(si, sti, selection) {
    frame_selection = { si, sti, set: new Set(selection) };
    show_sprite_again(si, sti, selection[0] ?? 0);
}

function duplicate_frame(si, sti, fi) {
    const frames = game.data.sprites[si].states[sti].frames;
    frames.splice(fi + 1, 0, { src: frames[fi].src });
    show_sprite_again(si, sti, fi + 1);
}

function remove_frame(si, sti, fi) {
    const frames = game.data.sprites[si].states[sti].frames;
    if (frames.length < 2) return;
    frames.splice(fi, 1);
    show_sprite_again(si, sti, Math.min(fi, frames.length - 1));
}

function paste_frames(si, sti, after) {
    const sprite = game.data.sprites[si];
    if (!frame_clipboard_fits(sprite)) return;
    const frames = sprite.states[sti].frames;
    frames.splice(after + 1, 0, ...frame_clipboard.frames.map(src => ({ src })));
    show_sprite_again(si, sti, after + 1);
}

function move_frame_to_state(si, sti, fi, target) {
    const sprite = game.data.sprites[si];
    const frames = sprite.states[sti].frames;
    if (frames.length < 2) return;
    const [frame] = frames.splice(fi, 1);
    sprite.states[target].frames.push({ src: frame.src });
    show_sprite_again(si, target, sprite.states[target].frames.length - 1);
}

function show_state_notice(text) {
    let notice = $('#canvas').find('.level-notice');
    if (!notice.length) notice = $('<div class="level-notice">').appendTo($('#canvas'));
    notice.text(text).addClass('showing');
    clearTimeout(show_state_notice.timer);
    show_state_notice.timer = setTimeout(() => notice.removeClass('showing'), 4000);
}

if (typeof module !== 'undefined') module.exports = { visible_range, sprites_to_delete,
    copy_state_without_role, copy_state_for_sprite,
    frame_range, valid_frame_indices, duplicate_frames_in, remove_frames_from, reverse_frames_in, move_frames_block,
};

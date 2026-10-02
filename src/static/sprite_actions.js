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
    });
}

// ------------------------------------------------------------ sprites

function sprite_context_menu(si) {
    const sprite = game.data.sprites[si];
    if (!sprite) return [];
    return [
        { label: 'Duplizieren', icon: 'fa-clone', callback: () => duplicate_sprite(si),
            hint: 'Eine Kopie mit allen Zuständen, Frames und Eigenschaften – gleich dahinter in der Liste.' },
        '-',
        { label: 'Sprites aus anderem Spiel holen …', icon: 'fa-shopping-basket', callback: () => { if (typeof show_sprite_basket === 'function') show_sprite_basket(); } },
    ];
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

// ------------------------------------------------------------ frames

function frame_context_menu(fi) {
    const si = canvas.sprite_index, sti = canvas.state_index;
    const sprite = game.data.sprites[si];
    const state = sprite?.states?.[sti];
    const frame = state?.frames?.[fi];
    if (!frame) return [];
    const only = state.frames.length < 2;
    const paste_hint = frame_clipboard_hint(sprite);
    const others = sprite.states.map((s, i) => i).filter(i => i !== sti);
    return [
        { label: 'Duplizieren', icon: 'fa-clone', callback: () => duplicate_frame(si, sti, fi),
            hint: 'Eine Kopie dieses Frames direkt dahinter.' },
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
    ];
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

if (typeof module !== 'undefined') module.exports = { copy_state_without_role, copy_state_for_sprite };

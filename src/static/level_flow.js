// Which level comes next. Levels are a list, and that stays the default: an
// exit (Levelwechsel) without a target leads to the next level that is used
// (placed Delta: 2 skips one, as always). Only a child who chooses something
// else gets a level graph:
//
//   placed level_complete.target   absent      the next level (Delta)
//                                  '<level id>' that level (by its stable id, game_ids.js)
//                                  '@back'      back where the figure came from
//                                  '@end'       the end of the game (THE END)
//   level.properties.side_level    true: a Nebenlevel (a shop, a bonus level) –
//                                  "next level" never lands there, and its exits
//                                  without a target lead back
//   level.properties.signal_level_complete_target
//                                  the same choice for "geschafft bei Signal"
//
// A level that is reached through a chosen target places the figure at the
// exit that leads back to where it came from (if there is one), so two doors
// that lead into each other's levels work without any setting. Old exits
// without a target never move the start: older games play as before.
//
// Pure functions on the game's levels (shared by app.js and the level editor).

const LEVEL_TARGET_BACK = '@back';
const LEVEL_TARGET_END = '@end';
// the editor's choice for an older exit's Delta (never stored: it is the stored delta)
const LEVEL_TARGET_DELTA = '@delta';
// how many levels "zurück" remembers (a hub visited again and again stays short anyway)
const LEVEL_TRAIL_MAX = 32;
// how many signals a level remembers for when it is entered again (app.js
// remember_send); a Schalter flipped a thousand times stops being remembered
const LEVEL_MEMORY_MAX_SENDS = 2000;

// Is this level part of the order of levels? (Level verwenden, and not a Nebenlevel)
function level_in_sequence(level) {
    return Boolean(level?.properties?.use_level) && level?.properties?.side_level !== true;
}

function level_is_side(level) {
    return level?.properties?.side_level === true;
}

// The level a game starts with: the first one in the order (an unused level
// at the front was played anyway before, which nobody wanted).
function first_level_index(levels) {
    const i = (levels ?? []).findIndex(level_in_sequence);
    return i >= 0 ? i : 0;
}

// The legacy rule (app.js get_next_level_index): Delta levels on, then on to
// the next level that is used. Nebenlevel are skipped like unused ones.
function next_level_in_sequence(levels, from_index, delta = 1) {
    let li = from_index + (Number.isFinite(delta) ? delta : 1);
    while (li >= 0 && li < levels.length && !level_in_sequence(levels[li])) li += 1;
    return li;
}

function level_index_by_id(levels, id) {
    if (typeof id !== 'string' || !id) return -1;
    return (levels ?? []).findIndex(level => level?.id === id);
}

// A stored target means something only if it is a string; '' and anything else
// count as absent.
function clean_level_target(target) {
    return typeof target === 'string' && target.length > 0 ? target : null;
}

// What an exit without a target of its own means in this level.
function effective_level_target(levels, current_index, target) {
    const t = clean_level_target(target);
    if (t !== null) return t;
    return level_is_side(levels?.[current_index]) ? LEVEL_TARGET_BACK : null;
}

// Where an exit leads: { index, back } or { end: true }. trail: the ids of the
// levels the figure came from (newest last).
function resolve_level_exit(levels, current_index, { target = null, delta = 1 } = {}, trail = []) {
    let t = effective_level_target(levels, current_index, target);
    if (t === LEVEL_TARGET_END) return { end: true };
    if (t === LEVEL_TARGET_BACK) {
        const from = level_index_by_id(levels, trail[trail.length - 1]);
        if (from >= 0) return { index: from, back: true };
        // nowhere to go back to (a test run started here): on in the order
        t = null;
        delta = 1;
    } else if (t !== null) {
        const i = level_index_by_id(levels, t);
        if (i >= 0) return { index: i };
        // the level is gone: like an exit without a target
        t = null;
    }
    const i = next_level_in_sequence(levels, current_index, delta);
    return i >= 0 && i < levels.length ? { index: i } : { end: true };
}

// The trail after moving from one level to another. Going back takes the last
// step away; going to a level that is already in the trail cuts it there (the
// figure walked back the long way); anything else adds the level it left.
function next_level_trail(trail, from_id, result, to_id) {
    trail = Array.isArray(trail) ? trail : [];
    if (result?.back) return trail.slice(0, -1);
    const at = trail.indexOf(to_id);
    if (at >= 0) return trail.slice(0, at);
    return [...trail, from_id].slice(-LEVEL_TRAIL_MAX);
}

// Does an exit of this level lead back to the level the figure comes from?
// 2: exactly there (its target is that level), 1: "zurück", 0: no. Exits
// without a chosen target only count in a Nebenlevel (where they mean "zurück").
function arrival_rank(levels, level_index, target, from_id) {
    const t = effective_level_target(levels, level_index, target);
    if (t === null || !from_id) return 0;
    if (t === from_id) return 2;
    return t === LEVEL_TARGET_BACK ? 1 : 0;
}

// Of a level's exits ({ target }), the one the figure arrives at when it comes
// from from_id: the best rank, the first of equal ones; -1 for none.
function arrival_exit_index(levels, level_index, exits, from_id) {
    let best = -1, best_rank = 0;
    (exits ?? []).forEach((exit, i) => {
        const rank = arrival_rank(levels, level_index, exit?.target, from_id);
        if (rank > best_rank) { best = i; best_rank = rank; }
    });
    return best;
}

// The level's name for the player and the editor ("Level 3" without one).
function level_display_name(levels, index) {
    const name = (levels?.[index]?.properties?.name ?? '').trim();
    return name || `Level ${index + 1}`;
}

// Where a target leads, in words for the editor.
function describe_level_target(levels, current_index, target) {
    const t = effective_level_target(levels, current_index, target);
    if (t === null) return 'zum nächsten Level';
    if (t === LEVEL_TARGET_BACK) return 'zurück, woher man kam';
    if (t === LEVEL_TARGET_END) return 'zum Spielende';
    const i = level_index_by_id(levels, t);
    return i >= 0 ? `zu »${level_display_name(levels, i)}«` : 'zu einem Level, das es nicht mehr gibt';
}

// The choices of the "führt zu" field: [value, label]. '' is "nothing chosen".
function level_target_options(levels, current_index) {
    const side = level_is_side(levels?.[current_index]);
    const options = [['', side ? 'zurück, woher man kam (Nebenlevel)' : 'zum nächsten Level']];
    if (!side) options.push([LEVEL_TARGET_BACK, 'zurück, woher man kam']);
    (levels ?? []).forEach((level, i) => {
        // into the same level again would only start it anew
        if (!level?.id || i === current_index) return;
        const unused = level.properties?.use_level ? '' : ' – nicht verwendet';
        options.push([level.id, `${level_display_name(levels, i)}${unused}`]);
    });
    options.push([LEVEL_TARGET_END, 'zum Spielende (THE END)']);
    return options;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LEVEL_TARGET_BACK, LEVEL_TARGET_END, LEVEL_TARGET_DELTA, LEVEL_TRAIL_MAX, LEVEL_MEMORY_MAX_SENDS,
        level_in_sequence, level_is_side, first_level_index, next_level_in_sequence, level_index_by_id,
        clean_level_target, effective_level_target, resolve_level_exit, next_level_trail,
        arrival_rank, arrival_exit_index, level_display_name, describe_level_target, level_target_options,
    };
}

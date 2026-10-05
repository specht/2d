// "Wer zeigt was?" in the sprite editor: for a figure (Spielfigur, Gegner,
// Begleiter), which state the game shows for Stehen, Laufen, Springen … to
// the left, to the right and from the front – drawn for it, the other side
// mirrored, another role's picture, or nothing (then the first state). For
// other sprites (Tür, Schalter, Zähler …): which state shows each of their
// states, or that it is missing.
//
// figure_state_table rebuilds exactly the table the game builds in the
// Character constructor (app.js, sti_for_state), without the game: the test
// (test/who_shows_what.test.cjs) compares both for many sprites, so the
// overview cannot drift from what the game does. The studio does not load
// app.js, and app.js stays untouched (the recipes' engine fingerprint).

const WSW_DIRECTIONS = ['front', 'back', 'left', 'right'];
const WSW_MOVEMENT = ['stand', 'walk', 'jump', 'fall'];
const WSW_POSES = ['attack', 'hit', 'hunt', 'flee', 'stunned', 'landed', 'swim', 'float', 'drift', 'dive', 'rise', 'fly', 'sit', 'busy'];

// The character trait the game uses for a sprite (actor before baddie before companion).
function figure_trait(sprite) {
    const traits = sprite?.traits ?? {};
    if ('actor' in traits) return 'actor';
    if ('baddie' in traits) return 'baddie';
    if ('companion' in traits) return 'companion';
    return null;
}

// { stand: { left: { sti, confidence, flipped }, … }, …, attack: { … } | absent, climb: … | absent }
function figure_state_table(sprite, trait = figure_trait(sprite)) {
    const states = sprite?.states ?? [];
    const table = {};
    const tags_of = (sti) => (states[sti]?.traits ?? {})[trait] ?? {};
    const assign = (kind, d, sti, confidence, flipped) => {
        table[kind] ??= {};
        table[kind][d] ??= { sti, confidence, flipped };
        if (confidence > table[kind][d].confidence) table[kind][d] = { sti, confidence, flipped };
    };
    for (const kind of WSW_MOVEMENT) table[kind] ??= {};
    WSW_MOVEMENT.forEach((kind, ki) => {
        const later = WSW_MOVEMENT.slice(ki + 1);
        const prefix = kind === 'stand' ? '' : `${kind}_`;
        for (let sti = 0; sti < states.length; sti++) {
            const tags = tags_of(sti);
            for (const d of WSW_DIRECTIONS) {
                if (`${prefix}${d}` in tags) {
                    assign(kind, d, sti, 100, false);
                    for (const other of later) assign(other, d, sti, 10, false);
                }
            }
        }
    });
    for (const kind of [...WSW_MOVEMENT, 'dead'])
        for (const d of WSW_DIRECTIONS) assign(kind, d, 0, 0, false);
    for (const kind of WSW_MOVEMENT) {
        assign(kind, 'left', table[kind].right.sti, 1, true);
        assign(kind, 'right', table[kind].left.sti, 1, true);
    }
    for (let sti = 0; sti < states.length; sti++)
        if ('dead' in tags_of(sti)) for (const d of WSW_DIRECTIONS) assign('dead', d, sti, 200, false);
    for (const kind of WSW_POSES) {
        const poses = {};
        for (let sti = 0; sti < states.length; sti++) {
            const tags = tags_of(sti);
            for (const d of WSW_DIRECTIONS) if (`${kind}_${d}` in tags) poses[d] = { sti, flipped: false };
        }
        if (!Object.keys(poses).length) continue;
        for (const [d, opposite] of [['left', 'right'], ['right', 'left']])
            if (!poses[d] && poses[opposite]) poses[d] = { ...poses[opposite], flipped: true };
        const fallback = poses.right ?? poses.left ?? poses.front ?? poses.back;
        for (const d of WSW_DIRECTIONS) poses[d] ??= { ...fallback };
        table[kind] = poses;
    }
    for (let sti = 0; sti < states.length; sti++) {
        if ('climb' in tags_of(sti)) {
            table.climb = {};
            for (const d of WSW_DIRECTIONS) table.climb[d] = { sti, confidence: 300, flipped: false };
            break;
        }
    }
    return table;
}

const WSW_KIND_LABELS = {
    stand: 'Stehen', walk: 'Laufen', jump: 'Springen', fall: 'Fallen', climb: 'Klettern', dead: 'Tot',
    attack: 'Angriff', hit: 'Treffer', hunt: 'Jagen', flee: 'Fliehen', stunned: 'Benommen', landed: 'Aufgeschlagen',
    swim: 'Schwimmen', float: 'Schweben', drift: 'Treiben', dive: 'Abtauchen', rise: 'Auftauchen',
    fly: 'Fliegen', sit: 'Sitzen', busy: 'Beschäftigt',
};
const WSW_DIRECTION_LABELS = { left: 'links', right: 'rechts', front: 'vorn', back: 'hinten' };

// The role words of a state's tag ("walk_left" → Laufen links).
function wsw_tag_text(tag) {
    const m = /^(?:([a-z]+)_)?(front|back|left|right)$/.exec(tag);
    if (!m) return WSW_KIND_LABELS[tag] ?? tag;
    return `${WSW_KIND_LABELS[m[1] ?? 'stand'] ?? m[1]} ${WSW_DIRECTION_LABELS[m[2]]}`;
}

// The rows of the overview for a figure:
//   [{ kind, label, cells: [{ dir, sti, flipped, how, text }] }]
//   how: 'drawn' (its own picture), 'mirrored' (the other side, mirrored),
//        'other' (another role's or direction's picture), 'missing' (the first
//        state, because nothing fits)
// Stehen, Laufen, Springen, Fallen always; Klettern and Tot for Spielfigur
// and Gegner; the other poses only once one of their states exists (without
// them the game simply shows the movement picture).
function who_shows_what(sprite) {
    const trait = figure_trait(sprite);
    if (!trait) return null;
    const table = figure_state_table(sprite, trait);
    const name_of = (sti) => typeof state_label_for === 'function' ? state_label_for(sprite.states[sti], sti) :
        (String(sprite.states[sti]?.properties?.name ?? '').trim() || `Zustand ${sti + 1}`);
    const tags = (sti) => Object.keys((sprite.states[sti]?.traits ?? {})[trait] ?? {});
    const rows = [];
    const movement_cell = (kind, d) => {
        const cell = table[kind][d];
        const out = { dir: d, sti: cell.sti, flipped: cell.flipped };
        const label = `${WSW_KIND_LABELS[kind]} ${WSW_DIRECTION_LABELS[d]}`;
        if (cell.confidence >= 100) return { ...out, how: 'drawn', text: `${label}: »${name_of(cell.sti)}«` };
        if (cell.confidence === 10) {
            const shown = tags(cell.sti).find(t => WSW_MOVEMENT.some(k => t === (k === 'stand' ? d : `${k}_${d}`)));
            return { ...out, how: 'other', text: `${label} fehlt – zeigt ${wsw_tag_text(shown ?? d)} (»${name_of(cell.sti)}«)` };
        }
        if (cell.confidence === 1) {
            const other = d === 'left' ? 'right' : 'left';
            const source = table[kind][other];
            if (source.confidence >= 100)
                return { ...out, how: 'mirrored', text: `${label}: ${WSW_KIND_LABELS[kind]} ${WSW_DIRECTION_LABELS[other]}, gespiegelt` };
            if (source.confidence === 10 || (source.confidence === 1 && source.sti !== 0))
                return { ...out, how: 'other', text: `${label} fehlt – zeigt »${name_of(cell.sti)}«, gespiegelt` };
        }
        return { ...out, how: 'missing', text: `${label} fehlt – zeigt den ersten Zustand »${name_of(cell.sti)}«${cell.flipped ? ', gespiegelt' : ''}` };
    };
    for (const kind of WSW_MOVEMENT)
        rows.push({ kind, label: WSW_KIND_LABELS[kind], cells: ['left', 'right', 'front'].map(d => movement_cell(kind, d)) });
    if (trait === 'actor' || trait === 'baddie') {
        if (trait === 'actor') {
            const climb = table.climb?.back;
            rows.push({ kind: 'climb', label: 'Klettern', cells: [climb ?
                { dir: 'all', sti: climb.sti, flipped: false, how: 'drawn', text: `Klettern: »${name_of(climb.sti)}«` } :
                { ...movement_cell('stand', 'back'), dir: 'all', how: table.stand.back.confidence >= 100 ? 'other' : 'missing',
                    text: `Klettern fehlt – zeigt ${table.stand.back.confidence >= 100 ? `Stehen hinten (»${name_of(table.stand.back.sti)}«)` : `den ersten Zustand »${name_of(table.stand.back.sti)}«`}` }] });
        }
        const dead = table.dead.left;
        rows.push({ kind: 'dead', label: 'Tot', cells: [dead.confidence >= 200 ?
            { dir: 'all', sti: dead.sti, flipped: false, how: 'drawn', text: `Tot: »${name_of(dead.sti)}«` } :
            { dir: 'all', sti: 0, flipped: false, how: 'missing', text: `Tot fehlt – zeigt den ersten Zustand »${name_of(0)}«` }] });
    }
    for (const kind of WSW_POSES) {
        const poses = table[kind];
        if (!poses) continue;
        rows.push({ kind, label: WSW_KIND_LABELS[kind], cells: ['left', 'right', 'front'].map(d => {
            const p = poses[d];
            const own = tags(p.sti).includes(`${kind}_${d}`);
            const label = `${WSW_KIND_LABELS[kind]} ${WSW_DIRECTION_LABELS[d]}`;
            const how = own ? 'drawn' : p.flipped && d !== 'front' ? 'mirrored' : 'other';
            return { dir: d, sti: p.sti, flipped: p.flipped, how,
                text: how === 'drawn' ? `${label}: »${name_of(p.sti)}«` :
                    `${label} fehlt – zeigt »${name_of(p.sti)}«${p.flipped ? ', gespiegelt' : ''}` };
        }) });
    }
    return { trait, rows };
}

// The states of the other sprites with roles: [{ trait, role, label, sti|null }]
// (the first state with that role; Checkpoint and Zerbröseln: the last, as in the game).
const WSW_OBJECT_ROLES = {
    door: [['closed', 'geschlossen'], ['open', 'offen'], ['transition', 'Übergang']],
    switch: [['off', 'aus'], ['on', 'an']],
    pressure_plate: [['up', 'oben'], ['down', 'gedrückt']],
    counter: [['waiting', 'wartet'], ['done', 'fertig']],
    checkpoint: [['active', 'aktiviert']],
    falls_down: [['crumbling', 'zerbröselt']],
    bomb: [['fuse', 'Zündschnur'], ['explosion', 'Explosion']],
    text: [['speaking', 'spricht']],
};
const WSW_TRAIT_LABELS = { door: 'Tür', switch: 'Schalter', pressure_plate: 'Druckplatte', counter: 'Zähler',
    checkpoint: 'Checkpoint', falls_down: 'Bröckelt', bomb: 'Bombe', text: 'Schild' };

function object_state_roles(sprite) {
    const states = sprite?.states ?? [];
    const out = [];
    for (const [trait, roles] of Object.entries(WSW_OBJECT_ROLES)) {
        if (!(trait in (sprite?.traits ?? {}))) continue;
        for (const [role, label] of roles) {
            const has = (sti) => role in ((states[sti]?.traits ?? {})[trait] ?? {});
            let sti = null;
            if (trait === 'checkpoint' || trait === 'falls_down') { for (let i = states.length - 1; i >= 0 && sti === null; i--) if (has(i)) sti = i; }
            else for (let i = 0; i < states.length && sti === null; i++) if (has(i)) sti = i;
            out.push({ trait, role, label: `${WSW_TRAIT_LABELS[trait]}: ${label}`, sti });
        }
    }
    return out;
}

// ------------------------------------------------------------ the panel
// Under the list of Zustände (#who_shows_what), folded or open as the child
// left it. A click on a picture chooses that state. The pictures follow the
// drawing (refresh_who_shows_what_pictures from Game.refresh_frames_on_screen).
const WSW_HOW = {
    drawn: 'eigenes Bild', mirrored: 'die andere Seite, gespiegelt', other: 'ein anderes Bild', missing: 'fehlt',
};

function wsw_picture(sprite, sti) {
    const frames = sprite?.states?.[sti]?.frames ?? [];
    return frames[Math.max(0, Math.floor(frames.length / 2 - 0.5))]?.src ?? '';
}

function refresh_who_shows_what() {
    const box = typeof $ === 'function' ? $('#who_shows_what') : null;
    if (!box?.length || typeof game === 'undefined' || typeof canvas === 'undefined') return;
    const sprite = game?.data?.sprites?.[canvas?.sprite_index];
    const figure = sprite ? who_shows_what(sprite) : null;
    const objects = sprite && !figure ? object_state_roles(sprite) : [];
    box.empty().toggle(Boolean(figure || objects.length));
    if (!figure && !objects.length) return;
    let open = true;
    try { open = localStorage.getItem('who_shows_what_open') !== '0'; } catch { }
    const details = $('<details class="who-shows-what">').prop('open', open).appendTo(box)
        .on('toggle', () => { try { localStorage.setItem('who_shows_what_open', details.prop('open') ? '1' : '0'); } catch { } });
    const summary = $('<summary>').text('Wer zeigt was?').appendTo(details)
        .attr('title', 'Welcher Zustand im Spiel zu sehen ist – für jede Bewegung und Richtung');
    const table = $('<div class="wsw-table">').appendTo(details);
    const cell_for = (cell, wide) => {
        const div = $('<div class="wsw-cell">').addClass(`wsw-${cell.how}`).toggleClass('wsw-wide', wide)
            .toggleClass('current', cell.sti === canvas.state_index)
            .attr('title', `${cell.text} – ${WSW_HOW[cell.how]}. Klicken: diesen Zustand zeigen.`)
            .on('click', () => canvas.states_widget?.select_index?.(cell.sti));
        $('<img>').attr('src', wsw_picture(sprite, cell.sti)).attr('data-sti', cell.sti).toggleClass('flipped', !!cell.flipped).appendTo(div);
        if (cell.how === 'mirrored') $('<span class="wsw-mark">').text('⇄').appendTo(div);
        if (cell.how === 'missing') $('<span class="wsw-mark">').text('?').appendTo(div);
        return div;
    };
    let missing = 0;
    if (figure) {
        const head = $('<div class="wsw-row wsw-head">').appendTo(table);
        for (const text of ['', 'links', 'rechts', 'vorn']) $('<span>').text(text).appendTo(head);
        head.children().last().attr('title', 'Vorn: so steht die Figur ganz am Anfang da, bevor sie sich zum ersten Mal bewegt.');
        for (const row of figure.rows) {
            const line = $('<div class="wsw-row">').appendTo(table);
            $('<span class="wsw-label">').text(row.label).appendTo(line);
            for (const cell of row.cells) {
                line.append(cell_for(cell, row.cells.length === 1));
                // vorn is only seen at the very start, before the figure moves: not counted
                if (cell.how === 'missing' && cell.dir !== 'front') missing++;
            }
        }
    } else {
        for (const role of objects) {
            const line = $('<div class="wsw-row">').appendTo(table);
            $('<span class="wsw-label wsw-label-wide">').text(role.label).appendTo(line);
            const cell = role.sti === null ? { sti: 0, flipped: false, how: 'missing',
                text: `${role.label} fehlt – das Sprite bleibt bei dem Bild, das es gerade zeigt` } :
                { sti: role.sti, flipped: false, how: 'drawn', text: `${role.label}: »${state_label_for(sprite.states[role.sti], role.sti)}«` };
            if (cell.how === 'missing') missing++;
            line.append(cell_for(cell, false));
        }
    }
    if (missing) $('<span class="wsw-count">').text(missing === 1 ? '1 fehlt' : `${missing} fehlen`).appendTo(summary);
    const legend = $('<div class="wsw-legend">').appendTo(details);
    for (const how of ['drawn', 'mirrored', 'other', 'missing'])
        $('<span>').append($('<i>').addClass(`wsw-${how}`)).append(document.createTextNode(WSW_HOW[how])).appendTo(legend);
    if (missing) $('<div class="wsw-hint">').text('Was fehlt, zeigt ein anderes Bild. Leg einen Zustand an und gib ihm unten bei „Rolle zuweisen“ die Rolle, die fehlt.').appendTo(details);
}

function refresh_who_shows_what_pictures() {
    if (typeof $ !== 'function' || typeof game === 'undefined' || typeof canvas === 'undefined') return;
    const sprite = game?.data?.sprites?.[canvas?.sprite_index];
    $('#who_shows_what img[data-sti]').each((_, img) => { img.src = wsw_picture(sprite, Number(img.dataset.sti)); });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { figure_trait, figure_state_table, who_shows_what, object_state_roles, wsw_tag_text };
}

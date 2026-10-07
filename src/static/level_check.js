// Spiel-Check: mistakes children make again and again, found before the game
// runs. Shown beside the game (Spielen: the whole game, Level testen: that
// level) and, for a sprite's own Eigenschaften, in the sprite editor. Every
// rule below was played in the engine (app.js) first, October 2026:
//
//   - When the figure touches something, "man kann es einsammeln" is looked
//     at first, then "ist ein Schlüssel", and only later Checkpoint, Falle and
//     Levelwechsel. Collected, the sprite is gone: an exit that can be
//     collected never changes the level, a key that can be collected opens no
//     door, a checkpoint never becomes active, a trap never hurts.
//   - Solid from every side (the three "man kann nicht … rein…"), a sprite is
//     never touched – the figure stands on it or beside it: a solid coin is
//     never collected, a solid exit never reached. A trap with "man kann
//     nicht von oben reinfallen" hurts only from the side, never when the
//     figure lands on it.
//   - Spielfigur, Gegner and Begleiter are figures: what makes an object
//     (einsammeln, Levelwechsel, Block, Falle, Tür …) does nothing on them.
//   - In a layer without Kollisionen (or with Parallaxe) nothing takes part:
//     a Spielfigur there never plays, a coin there is only a picture.
//   - A level without a Spielfigur has nothing to play; with two, only the
//     one placed last moves.
//   - A sprite that gives Leben is not collected while the figure has
//     max_lives already (and the figure starts with lives_at_begin).
// Plus what the Levelübersicht (level_map.js) and the Signale-Übersicht
// (signals.js signal_rules) already warn about, so it is all in one place.
//
// While the game runs (PlayCheck) the studio watches the game frame, as the
// Signale beside a test run do: nothing in the game changes, the studio only
// reads it. It explains what the child sees right now – a Leben that stays
// where it is, an exit that is still closed.
//
// Editor-only: the engine (app.js), game.js and the recipes are untouched.

// Order matters: what the engine collects first takes the others with it.
const LEVEL_CHECK_TAKERS = ['pickup', 'key'];
const LEVEL_CHECK_TOUCHED = ['key', 'checkpoint', 'trap', 'level_complete'];
const LEVEL_CHECK_FIGURES = ['actor', 'baddie', 'companion'];
// what does nothing on a figure (Spielfigur, Gegner, Begleiter)
const LEVEL_CHECK_OBJECT_TRAITS = ['pickup', 'key', 'level_complete', 'checkpoint', 'trap', 'door', 'switch',
    'pressure_plate', 'block_above', 'block_sides', 'block_below', 'slope', 'ladder', 'conveyor', 'moving', 'falls_down'];
// what is only a picture in a layer without Kollisionen (an exit: level_map.js says so already)
const LEVEL_CHECK_PLAYING_TRAITS = ['pickup', 'key', 'checkpoint', 'trap', 'door', 'switch', 'pressure_plate', 'baddie', 'companion'];

const LEVEL_CHECK_FIGURE_WORDS = { actor: 'die Spielfigur', baddie: 'ein Gegner', companion: 'ein Begleiter' };
const LEVEL_CHECK_TRAIT_FALLBACK = {
    pickup: 'man kann es einsammeln', key: 'ist ein Schlüssel', level_complete: 'Levelwechsel', checkpoint: 'Checkpoint',
    trap: 'Falle', actor: 'Spielfigur', baddie: 'Gegner', companion: 'Begleiter',
};
// what never happens, after "darum"
const LEVEL_CHECK_TAKEN = {
    key: 'zählt es nicht als Schlüssel und öffnet keine Tür',
    checkpoint: 'wird der Checkpoint nie aktiv',
    trap: 'schadet die Falle nie',
    level_complete: 'wechselt das Level nie',
};
const LEVEL_CHECK_UNTOUCHED = {
    pickup: 'kann man es nie einsammeln',
    key: 'findet die Spielfigur den Schlüssel nie',
    checkpoint: 'wird der Checkpoint nie aktiv',
    trap: 'schadet die Falle nie',
    level_complete: 'wechselt das Level nie',
};

function level_check_trait_word(trait) {
    const label = (typeof SPRITE_TRAITS !== 'undefined' && SPRITE_TRAITS[trait]?.label) || LEVEL_CHECK_TRAIT_FALLBACK[trait] || trait;
    return `„${label}“`;
}

// "a, b und c"
function level_check_and(words) {
    if (words.length < 2) return words.join('');
    return `${words.slice(0, -1).join(', ')} und ${words[words.length - 1]}`;
}

function level_check_label(sprite, index) {
    if (typeof sprite_label === 'function') return sprite_label(sprite, index);
    const name = sprite?.properties?.name;
    return (typeof name === 'string' && name.trim()) || `Sprite ${index + 1}`;
}

// Does a layer take part in the game (collisions on, no Parallaxe)? As app.js.
function level_check_layer_plays(layer) {
    return Boolean(layer?.properties?.collision_detection) && Math.abs(Number(layer?.properties?.parallax) || 0) < 0.0001;
}

// The mistakes in one sprite's Eigenschaften: [{ id, severity, text }].
// severity 'problem': it does not work as meant; 'hint': worth knowing.
// game_properties (the game's settings): for the hint about Leben.
function sprite_pitfalls(sprite, name = 'Dieses Sprite', game_properties = null) {
    const traits = sprite?.traits ?? {};
    const has = (trait) => Object.prototype.hasOwnProperty.call(traits, trait);
    const it = `»${name}«`;
    const out = [];

    const figure = LEVEL_CHECK_FIGURES.find(has);
    if (figure) {
        const others = LEVEL_CHECK_FIGURES.filter(t => t !== figure && has(t));
        if (others.length)
            out.push({ id: 'two_figures', severity: 'problem',
                text: `${it} hat ${level_check_and([figure, ...others].map(level_check_trait_word))}. Im Spiel ist es nur ${LEVEL_CHECK_FIGURE_WORDS[figure]} – nimm ${others.length > 1 ? 'die anderen' : 'die andere'} weg.` });
        const objects = LEVEL_CHECK_OBJECT_TRAITS.filter(has);
        if (objects.length)
            out.push({ id: 'figure_object', severity: 'problem',
                text: `${it} ist ${LEVEL_CHECK_FIGURE_WORDS[figure]}. ${level_check_and(objects.map(level_check_trait_word))} ${objects.length > 1 ? 'wirken' : 'wirkt'} bei einer Figur nicht – nur bei Sprites, die keine Figur sind. Nimm ${objects.length > 1 ? 'sie' : 'es'} weg oder mach dafür ein eigenes Sprite.` });
        // the rest is about objects
        return out;
    }

    const taker = LEVEL_CHECK_TAKERS.find(has);
    if (taker) {
        const taken = LEVEL_CHECK_TOUCHED.filter(t => t !== taker && has(t));
        if (taken.length) {
            const first = taker === 'pickup'
                ? 'Die Spielfigur sammelt es ein, sobald sie es berührt, und dann ist es weg'
                : 'Die Spielfigur nimmt den Schlüssel, sobald sie ihn berührt, und dann ist er weg';
            const fix = taker === 'pickup'
                ? (taken.length === 1 && taken[0] === 'key' ? 'Ein Schlüssel wird ohnehin eingesammelt: Nimm „man kann es einsammeln“ weg.' : 'Nimm „man kann es einsammeln“ weg.')
                : `Mach daraus zwei Sprites: einen Schlüssel und ${taken.includes('level_complete') ? 'einen Ausgang' : taken.includes('checkpoint') ? 'einen Checkpoint' : 'eine Falle'}.`;
            out.push({ id: taker === 'pickup' ? 'collected_first' : 'key_first', severity: 'problem',
                text: `${it} hat ${level_check_and([taker, ...taken].map(level_check_trait_word))}. ${first} – darum ${level_check_and(taken.map(t => LEVEL_CHECK_TAKEN[t]))}. ${fix}` });
        }
    }

    const solid = has('block_above') && has('block_sides') && has('block_below');
    const touched = ['pickup', ...LEVEL_CHECK_TOUCHED].filter(has);
    if (solid && touched.length) {
        out.push({ id: 'solid_untouched', severity: 'problem',
            text: `${it} ist von allen Seiten fest. Die Spielfigur steht darauf oder daneben, aber sie berührt es nie – darum ${level_check_and(touched.map(t => LEVEL_CHECK_UNTOUCHED[t]))}. Nimm die drei „man kann nicht … rein…“ weg.` });
    } else if (has('trap') && has('block_above')) {
        out.push({ id: 'trap_stand_on', severity: 'hint',
            text: `${it} ist eine Falle, auf der man stehen kann („man kann nicht von oben reinfallen“). Wer darauf landet, bekommt keinen Schaden – nur wer von der Seite hineinläuft. Soll sie auch beim Draufspringen schaden, nimm „man kann nicht von oben reinfallen“ weg.` });
    }

    const lives = Number(traits.pickup?.lives) || 0;
    if (lives > 0 && game_properties) {
        // game.js: absent = 5 and 5
        const start = Number(game_properties.lives_at_begin ?? 5);
        const max = Number(game_properties.max_lives ?? 5);
        if (start >= max)
            out.push({ id: 'lives_full', severity: 'hint',
                text: `${it} gibt Leben – aber die Spielfigur hat schon am Anfang ${start} Leben, und mehr als ${max} kann sie nicht haben. Solange sie alle hat, bleibt ${it} liegen. Erst wenn sie ein Leben verloren hat, kann sie es einsammeln. Soll das gleich gehen: Stell bei den Einstellungen „Leben maximal“ höher.` });
    }
    return out;
}

// The mistakes in one level (not in its sprites' Eigenschaften): Spielfigur,
// layers, and what the Levelübersicht and the Signale-Übersicht warn about.
// map: level_map(levels, traits_of) of the whole game (or null).
// Returns [{ id, severity, text, place }] – place: { layer_index, placed_index } or null.
function level_pitfalls(levels, level_index, { traits_of, name_of, map = null }) {
    const level = levels?.[level_index];
    const out = [];
    if (!level) return out;
    const players = [];
    const lost_players = [];
    (level.layers ?? []).forEach((layer, li) => {
        if (layer?.type !== 'sprites' || !Array.isArray(layer.sprites)) return;
        const plays = level_check_layer_plays(layer);
        const lost = new Map();   // sprite ref → count, in a layer that does not play
        let first_lost = null;
        // only figures (a bird in the backdrop): maybe meant as a picture – a hint
        let only_figures = true;
        layer.sprites.forEach((placed, pi) => {
            const traits = traits_of(placed?.[0]);
            if (!traits) return;
            if ('actor' in traits) (plays ? players : lost_players).push({ layer_index: li, placed_index: pi });
            if (!plays && LEVEL_CHECK_PLAYING_TRAITS.some(t => t in traits) && !('actor' in traits)) {
                lost.set(placed[0], (lost.get(placed[0]) ?? 0) + 1);
                first_lost ??= { layer_index: li, placed_index: pi };
                if (!('baddie' in traits || 'companion' in traits)) only_figures = false;
            }
        });
        if (lost.size) {
            const what = [...lost].map(([ref, n]) => `»${name_of(ref)}«${n > 1 ? ` (${n}×)` : ''}`);
            const why = Boolean(layer.properties?.collision_detection) ? 'eine Parallaxe' : 'keine Kollisionen';
            out.push({ id: 'layer_without_play', severity: only_figures ? 'hint' : 'problem', place: first_lost,
                text: `In der Ebene »${layer.properties?.name || `Ebene ${li + 1}`}« ${what.length > 1 ? 'liegen' : 'liegt'} ${level_check_and(what)}. Die Ebene hat ${why} – dort ist alles nur ein Bild: Man kann nichts einsammeln, und nichts bewegt sich. Setz es in die Ebene, in der auch die Spielfigur ist.` });
        }
    });
    if (!players.length) {
        out.push(lost_players.length
            ? { id: 'player_in_picture', severity: 'problem', place: lost_players[0],
                text: `Die Spielfigur liegt in einer Ebene ohne Kollisionen (oder mit Parallaxe) – dort spielt sie nicht mit, und es gibt nichts zu spielen. Setz sie in eine Ebene mit Kollisionen.` }
            : { id: 'no_player', severity: 'problem', place: null,
                text: 'In diesem Level gibt es keine Spielfigur – im Spiel passiert hier nichts. Setz ein Sprite mit der Eigenschaft „Spielfigur“ hinein.' });
    } else if (players.length > 1) {
        // app.js: the one placed last becomes the player (layers back to front, then in order)
        out.push({ id: 'two_players', severity: 'problem', place: players[0],
            text: `In diesem Level gibt es ${players.length} Spielfiguren. Bewegen lässt sich nur die, die zuletzt gesetzt wurde – die anderen stehen nur da. Lösch die übrigen.` });
    }
    // the Levelübersicht's warnings (a draft – Level verwenden off – has none)
    for (const text of map?.nodes?.[level_index]?.warnings ?? [])
        out.push({ id: 'level_map', severity: 'problem', place: null, text });
    // the Signale-Übersicht's: something waits for a Code nothing sends,
    // something sends what nothing reacts to (exits waiting: the Levelübersicht said so)
    if (typeof signal_rules === 'function') {
        for (const card of signal_rules(level, traits_of, (ref) => name_of(ref))) {
            const code_text = typeof signal_code_text === 'function' ? signal_code_text(card.code, card.name) : `Code ${card.code}`;
            const place = (line) => {
                const object = line?.objects?.find(o => o.kind === 'sprite');
                return object ? { layer_index: object.layer_index, placed_index: object.placed_index } : null;
            };
            if (card.problem === 'no_sender') {
                const waiting = card.receivers.filter(line => !line.objects.every(o => o.role === 'level_complete' || o.setting === 'signal_level_complete'));
                if (!waiting.length) continue;
                out.push({ id: 'signal_no_sender', severity: 'problem', place: place(waiting[0]),
                    text: `Auf ${code_text} wartet etwas, aber nichts in diesem Level sendet ihn. Darum passiert nie: ${waiting[0].text}. Gib einem Schalter, Schlüssel oder Signalbereich denselben Code.` });
            } else if (card.problem === 'no_receiver' && card.senders.length) {
                out.push({ id: 'signal_no_receiver', severity: 'hint', place: place(card.senders[0]),
                    text: `Wenn ${card.senders[0].text}, wird ${code_text} gesendet – aber nichts in diesem Level reagiert darauf. Gib einer Tür, Ebene oder einem Ausgang denselben Code.` });
            }
        }
    }
    return out;
}

// Everything the Spiel-Check finds. level_indices: only these levels (Level
// testen), else every level. index_of(ref): a placed ref's sprite index (the
// studio: game.sprite_index_for_ref); absent: by id or index.
//   finding: { id, severity, text, sprite_index | null, level_index | null, place | null }
// A sprite is checked once, if it is placed in a level checked (that is
// where it would go wrong); level findings follow, level by level. Drafts
// (Level verwenden off) are not checked.
function game_pitfalls(data, { index_of = null, level_indices = null } = {}) {
    const sprites = data?.sprites ?? [];
    const levels = data?.levels ?? [];
    const index = (ref) => {
        if (index_of) return index_of(ref);
        if (Number.isInteger(ref)) return ref >= 0 && ref < sprites.length ? ref : null;
        const i = sprites.findIndex(s => s?.id === ref);
        return i >= 0 ? i : null;
    };
    const traits_of = (ref) => { const i = index(ref); return Number.isInteger(i) ? sprites[i]?.traits ?? null : null; };
    const name_of = (ref) => { const i = index(ref); return Number.isInteger(i) && sprites[i] ? level_check_label(sprites[i], i) : 'Sprite'; };
    const checked = (level_indices ?? levels.map((_, i) => i)).filter(i => levels[i]?.properties?.use_level);
    const findings = [];
    const seen = new Map();   // sprite index → where it is placed first
    for (const li of checked) {
        (levels[li].layers ?? []).forEach((layer, lyi) => {
            if (layer?.type !== 'sprites' || !Array.isArray(layer.sprites)) return;
            layer.sprites.forEach((placed, pi) => {
                const si = index(placed?.[0]);
                if (Number.isInteger(si) && !seen.has(si)) seen.set(si, { level_index: li, layer_index: lyi, placed_index: pi });
            });
        });
    }
    for (const [si] of [...seen].sort((a, b) => a[0] - b[0])) {
        for (const finding of sprite_pitfalls(sprites[si], level_check_label(sprites[si], si), data?.properties ?? {}))
            findings.push({ ...finding, sprite_index: si, level_index: null, place: null });
    }
    const map = typeof level_map === 'function' ? level_map(levels, traits_of) : null;
    for (const li of checked) {
        for (const finding of level_pitfalls(levels, li, { traits_of, name_of, map }))
            findings.push({ ...finding, sprite_index: null, level_index: li });
    }
    return findings;
}

// --------------------------------------------------- while the game runs
// The rules of app.js Character.update for the player character, read from
// outside (the figure's box as the engine uses it). Each returns a hint
// { key, text } or null; key: one hint per thing (counted while it lasts).
function play_check_box(player) {
    const w = player.sprite.width * 0.5;
    return [-player.traits.ex_left * w + 0.1, player.traits.ex_right * w - 0.1, 0.1, player.traits.ex_top * player.sprite.height - 0.1];
}

function play_check_live(game, name_of) {
    const player = game?.player_character;
    if (!player || !game.running || player.dead?.() || typeof player.has_trait_at !== 'function') return [];
    const out = [];
    const box = play_check_box(player);
    const props = game.data?.properties ?? {};
    // a Leben the figure cannot take (app.js: not collected while lives >= max_lives)
    const pickup = player.has_trait_at(['pickup'], ...box, (e) => !(e.shop_price > 0));
    if (pickup) {
        const sprite = game.data.sprites[pickup.sprite_index];
        if ((Number(sprite?.traits?.pickup?.lives) || 0) > 0 && game.lives >= props.max_lives) {
            const it = `»${name_of(pickup.sprite_index)}«`;
            out.push({ key: `lives_full:${pickup.sprite_index}`,
                text: `${it} gibt Leben, aber die Spielfigur hat schon ${game.lives} – mehr als ${props.max_lives} geht nicht („Leben maximal“ in den Einstellungen). Darum bleibt ${it} liegen, bis sie ein Leben verloren hat.` });
        }
    }
    // an exit that is still closed ("öffnet erst bei Signal")
    if (!game.reached_flag) {
        const exit = player.has_trait_at(['level_complete'], ...box);
        if (exit && exit.exit_open === false) {
            const level = game.data.levels?.[game.level_index];
            const code = exit.exit_gate_code;
            const name = typeof signal_name === 'function' ? signal_name(level, code) : '';
            const code_text = typeof signal_code_text === 'function' ? signal_code_text(code, name) : `Code ${code}`;
            out.push({ key: `exit_closed:${game.level_index}:${exit.entry_index}`,
                text: `Der Ausgang »${name_of(exit.sprite_index)}« ist noch zu. Er öffnet sich erst, wenn ${code_text} ankommt.` });
        }
    }
    return out;
}

// The panel beside the game (Spielen, Level testen): the Spiel-Check's
// findings, and below, what happened in the game. Shares the column at the
// right with the Signale beside a test run (play_side_column).
function play_side_column() {
    if (typeof $ !== 'function') return null;
    let column = $('#play_side');
    if (!column.length) column = $('<div id="play_side" class="play-side">').appendTo('#main_div_play');
    $('#main_div_play').addClass('with-play-side');
    return column;
}

function play_side_tidy() {
    if (typeof $ !== 'function') return;
    const column = $('#play_side');
    if (column.length && !column.children().length) {
        column.remove();
        $('#main_div_play').removeClass('with-play-side');
    }
}

class PlayCheck {
    constructor() {
        this.run = null;
    }

    // level_index: Level testen (that level only), null: Spielen (every level)
    start(studio_game, level_index = null) {
        this.stop();
        if (!studio_game?.data) return;
        const data = studio_game.data;
        const findings = game_pitfalls(data, {
            index_of: (ref) => studio_game.sprite_index_for_ref?.(ref) ?? null,
            level_indices: Number.isInteger(level_index) ? [level_index] : null,
        });
        const run = this.run = { studio_game, level_index, findings, panel: null, live: new Map(), touching: new Set(), frame: null, closed: false };
        if (findings.length) this.build(run);
        const tick = () => {
            if (this.run !== run) return;
            this.tick(run);
            run.frame = requestAnimationFrame(tick);
        };
        run.frame = requestAnimationFrame(tick);
    }

    stop() {
        const run = this.run;
        if (!run) return;
        this.run = null;
        cancelAnimationFrame(run.frame);
        run.panel?.remove();
        play_side_tidy();
    }

    build(run) {
        if (run.panel || run.closed) return;
        const column = play_side_column();
        if (!column) return;
        const panel = run.panel = $('<div class="signal-overview play-check">').prependTo(column);
        const head = $('<div class="signal-overview-head">').appendTo(panel);
        $('<span>').append($('<i class="fa fa-stethoscope">'), document.createTextNode(Number.isInteger(run.level_index) ? ' Level-Check' : ' Spiel-Check')).appendTo(head);
        $('<button class="signal-overview-close" title="Ausblenden">').append($('<i class="fa fa-times">'))
            .on('click', () => {
                run.closed = true;
                panel.remove();
                run.panel = null;
                play_side_tidy();
                window.focus_play_frame?.();
            }).appendTo(head);
        const body = $('<div class="signal-overview-body">').appendTo(panel);
        run.live_box = $('<div class="play-check-live">').appendTo(body);
        if (run.live.size) for (const hint of run.live.values()) this.show_live(run, hint);
        this.build_findings(run, body);
        // the game must keep the keys: clicks on the panel give them back
        panel.on('mouseup', (e) => { if (!$(e.target).closest('.play-check-show').length) window.focus_play_frame?.(); });
    }

    build_findings(run, body) {
        const data = run.studio_game.data;
        const groups = new Map();
        const order = (f) => (f.severity === 'problem' ? 0 : 1);
        for (const finding of [...run.findings].sort((a, b) => order(a) - order(b))) {
            const key = finding.level_index ?? 'sprites';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(finding);
        }
        const keys = [...groups.keys()].sort((a, b) => (a === 'sprites' ? -1 : b === 'sprites' ? 1 : a - b));
        for (const key of keys) {
            const name = String(data.levels?.[key]?.properties?.name ?? '').trim();
            const title = key === 'sprites' ? 'Eigenschaften von Sprites' : name ? `Level »${name}«` : `Level ${key + 1}`;
            $('<div class="play-check-group">').text(title).appendTo(body);
            for (const finding of groups.get(key)) this.build_finding(body, finding);
        }
    }

    build_finding(body, finding) {
        const box = $('<div class="play-check-item">').addClass(`play-check-${finding.severity}`).appendTo(body);
        $('<i class="fa">').addClass(finding.severity === 'problem' ? 'fa-exclamation-triangle' : 'fa-info-circle').appendTo(box);
        const text = $('<div class="play-check-text">').text(finding.text).appendTo(box);
        const target = Number.isInteger(finding.sprite_index) ? 'Sprite zeigen' : Number.isInteger(finding.level_index) ? 'Im Level zeigen' : null;
        if (target)
            $('<button class="play-check-show">').append($('<i class="fa fa-crosshairs">'), document.createTextNode(` ${target}`))
                .on('click', () => this.show_in_editor(finding)).appendTo(text);
    }

    // "Sprite zeigen": the sprite in the sprite editor; "Im Level zeigen": the level, the placed sprite selected
    show_in_editor(finding) {
        const studio_game = this.run?.studio_game;
        if (!studio_game) return;
        if (Number.isInteger(finding.sprite_index)) {
            window.studio_show_pane?.('sprites');
            studio_game.sprites_widget?.select_index?.(finding.sprite_index);
            return;
        }
        window.studio_show_pane?.('level');
        const editor = studio_game.level_editor;
        if (!editor) return;
        if (finding.level_index !== editor.level_index) editor.levels_widget?.select_index(finding.level_index);
        if (finding.place) editor.pick_signal_overview_object?.({ kind: 'sprite', ...finding.place });
    }

    tick(run) {
        let game = null;
        try { game = $('#play_iframe')[0]?.contentWindow?.game ?? null; } catch (e) { return; }
        if (!game) return;
        const sprites = run.studio_game.data?.sprites ?? [];
        const name_of = (si) => level_check_label(sprites[si] ?? game.data?.sprites?.[si], si);
        let hints = [];
        try { hints = play_check_live(game, name_of); } catch (e) { return; }
        const now = new Set(hints.map(h => h.key));
        for (const hint of hints) {
            // counted once each time the figure gets there
            if (run.touching.has(hint.key)) continue;
            const known = run.live.get(hint.key);
            const entry = known ?? { ...hint, count: 0, box: null };
            entry.count++;
            run.live.set(hint.key, entry);
            if (!run.panel && !run.closed) this.build(run);
            else this.show_live(run, entry);
        }
        run.touching = now;
    }

    // a hint from the game: on top, it flashes each time it happens again
    show_live(run, entry) {
        if (!run.panel) return;
        if (!run.live_box.children('.play-check-live-head').length)
            $('<div class="play-check-group play-check-live-head">').text('Gerade im Spiel').appendTo(run.live_box);
        if (!entry.box || !entry.box.closest('body').length) {
            entry.box = $('<div class="play-check-item play-check-hint play-check-now">')
                .append($('<i class="fa fa-lightbulb-o">'), $('<div class="play-check-text">').text(entry.text))
                .insertAfter(run.live_box.children('.play-check-live-head'));
        }
        let count = entry.box.find('.play-check-count');
        if (entry.count > 1) {
            if (!count.length) count = $('<span class="play-check-count">').appendTo(entry.box);
            count.text(`${entry.count}×`);
        }
        entry.box.removeClass('play-check-flash');
        void entry.box[0].offsetWidth;   // the flash starts again
        entry.box.addClass('play-check-flash');
        run.panel.find('.signal-overview-body').scrollTop(0);
    }
}

// The sprite editor: the sprite's own mistakes on top of its Eigenschaften.
// Kept out of game.js (every recipe recording depends on it): the panel is
// built by Game.build_sprite_traits_menu, and this adds the box after it.
function show_sprite_pitfalls(studio_game) {
    if (typeof $ !== 'function') return;
    const anchor = $('#menu_sprite_properties_variable_part_following');
    anchor.siblings('.trait-pitfalls').remove();
    const si = typeof canvas !== 'undefined' ? canvas.sprite_index : null;
    const sprite = studio_game?.data?.sprites?.[si];
    if (!anchor.length || !sprite) return;
    const found = sprite_pitfalls(sprite, level_check_label(sprite, si), studio_game.data.properties ?? {});
    if (!found.length) return;
    const box = $('<div class="trait-pitfalls">');
    for (const finding of found) {
        $('<div class="play-check-item">').addClass(`play-check-${finding.severity}`)
            .append($('<i class="fa">').addClass(finding.severity === 'problem' ? 'fa-exclamation-triangle' : 'fa-info-circle'))
            .append($('<div class="play-check-text">').text(finding.text)).appendTo(box);
    }
    box.insertAfter(anchor);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.play_check = new PlayCheck();
    window.play_side_column = play_side_column;
    window.play_side_tidy = play_side_tidy;
    if (typeof Game !== 'undefined' && typeof Game.prototype.build_sprite_traits_menu === 'function') {
        const build = Game.prototype.build_sprite_traits_menu;
        Game.prototype.build_sprite_traits_menu = function (...args) {
            const result = build.apply(this, args);
            try { show_sprite_pitfalls(this); } catch (e) { }
            return result;
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sprite_pitfalls, level_pitfalls, game_pitfalls, play_check_live, play_check_box };
}

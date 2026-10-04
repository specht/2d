// The Levelübersicht of the level editor: how the levels of a game are connected,
// made from their exits (level_flow.js) – nothing to set up, a game that
// never chose a target is a simple row. Pure here (layout and warnings); the
// editor (level_editor.js refresh_level_map) draws it.
//
// traits_of(sprite ref) → the traits of a placed sprite's drawing, or null.

// Every exit of a level: placed sprites with "Levelwechsel" and, as one
// more, "geschafft bei Signal". working: false for an exit the game never
// sees (a layer without Kollisionen or with Parallaxe).
function level_map_exits(level, traits_of) {
    const exits = [];
    (level?.layers ?? []).forEach((layer, li) => {
        if (layer?.type !== 'sprites' || !Array.isArray(layer.sprites)) return;
        const working = Boolean(layer.properties?.collision_detection) && Math.abs(Number(layer.properties?.parallax) || 0) < 0.0001;
        layer.sprites.forEach((placed, si) => {
            if (!Array.isArray(placed) || !traits_of(placed[0])?.level_complete) return;
            const props = placed[3]?.level_complete ?? {};
            exits.push({ layer: li, index: si, target: props.target ?? null, delta: Number.isFinite(props.delta) ? props.delta : 1,
                action_key: props.action_key === true, working });
        });
    });
    if (Number.isInteger(level?.properties?.signal_level_complete))
        exits.push({ signal: true, target: level.properties.signal_level_complete_target ?? null, delta: 1, action_key: false, working: true });
    return exits;
}

// Nodes (one per level, plus the end), edges and warnings.
//   node: { index, id, name, side, used, start, reachable, column, row, warnings, hints }
//   edge: { from, to (level index or 'end'), kind: 'next' | 'target' | 'back' | 'end' | 'order',
//           exits: [exit …] }    – exits that lead the same way share one edge
// A level of the order that has no exit yet gets an 'order' edge: where its
// exit will lead when it gets one (the next level, after the last one the
// end). So a new game is a connected row from the start, and a missing exit
// is a hint, not an alarm.
function level_map(levels, traits_of) {
    levels = levels ?? [];
    const start = first_level_index(levels);
    const nodes = levels.map((level, index) => ({
        index, id: level?.id ?? null, name: level_display_name(levels, index),
        side: level_is_side(level), used: Boolean(level?.properties?.use_level), start: index === start,
        reachable: false, column: 0, row: 0, warnings: [], hints: [],
    }));
    const edges = [];
    const edge_to = (from, to, kind, exit) => {
        let edge = edges.find(e => e.from === from && e.to === to && e.kind === kind);
        if (!edge) edges.push(edge = { from, to, kind, exits: [] });
        edge.exits.push(exit);
    };
    const back_exits = [];
    levels.forEach((level, i) => {
        const exits = level_map_exits(level, traits_of);
        if (!exits.length) {
            nodes[i].hints.push('Noch kein Ausgang: Setz ein Sprite mit der Eigenschaft „Levelwechsel“ ins Level. Ohne eigenes Ziel führt es zum nächsten Level.');
            // where it will lead: the order of the levels (a Nebenlevel leads back once it has an exit)
            if (level_in_sequence(level)) {
                const to = next_level_in_sequence(levels, i, 1);
                edge_to(i, to >= 0 && to < levels.length ? to : 'end', 'order', { order: true });
            }
        }
        if (exits.some(e => !e.working))
            nodes[i].warnings.push('Ein Ausgang liegt in einer Ebene ohne Kollisionen (oder mit Parallaxe) und funktioniert im Spiel nicht.');
        for (const exit of exits.filter(e => e.working)) {
            const t = effective_level_target(levels, i, exit.target);
            if (t === LEVEL_TARGET_END) { edge_to(i, 'end', 'end', exit); continue; }
            if (t === LEVEL_TARGET_BACK) { back_exits.push({ from: i, exit }); continue; }
            if (t !== null) {
                const to = level_index_by_id(levels, t);
                if (to >= 0) {
                    edge_to(i, to, 'target', exit);
                    if (!levels[to]?.properties?.use_level)
                        nodes[i].warnings.push(`Ein Ausgang führt zu »${nodes[to].name}«, aber dort ist „Level verwenden“ aus.`);
                    continue;
                }
                nodes[i].warnings.push('Ein Ausgang führt zu einem Level, das es nicht mehr gibt – er führt jetzt zum nächsten Level.');
            }
            const to = next_level_in_sequence(levels, i, exit.delta);
            if (to >= 0 && to < levels.length) edge_to(i, to, 'next', exit);
            else edge_to(i, 'end', 'end', exit);
        }
    });
    // "zurück": back to every level that leads here
    for (const { from, exit } of back_exits) {
        const sources = [...new Set(edges.filter(e => e.to === from && e.kind !== 'back' && e.from !== from).map(e => e.from))];
        if (!sources.length) {
            if (!nodes[from].warnings.some(w => w.startsWith('„zurück“')))
                nodes[from].warnings.push('„zurück“ führt nirgendwohin: Kein Ausgang führt in dieses Level.');
            continue;
        }
        for (const to of sources) edge_to(from, to, 'back', exit);
    }

    // Columns: steps from the first level (the shortest way); rows: in the
    // order of the level list. Levels nobody reaches go into a row of their own.
    const depth = new Map([[start, 0]]);
    const queue = levels.length ? [start] : [];
    while (queue.length) {
        const i = queue.shift();
        for (const e of edges) {
            if (e.from !== i || e.to === 'end' || depth.has(e.to)) continue;
            depth.set(e.to, depth.get(i) + 1);
            queue.push(e.to);
        }
    }
    const end_reachable = edges.some(e => e.to === 'end' && depth.has(e.from));
    let columns = 0;
    const rows_in = [];
    for (const node of nodes) {
        if (!depth.has(node.index)) continue;
        node.reachable = true;
        node.column = depth.get(node.index);
        node.row = rows_in[node.column] = (rows_in[node.column] ?? -1) + 1;
        columns = Math.max(columns, node.column + 1);
    }
    const reached_rows = Math.max(0, ...rows_in.map(r => r + 1));
    let loose = 0;
    for (const node of nodes) {
        if (node.reachable) continue;
        node.column = loose++;
        node.row = reached_rows;
        if (node.used) node.warnings.push(node.side ? 'Kein Ausgang führt in dieses Nebenlevel.' : 'Man kommt im Spiel nie in dieses Level.');
    }
    // a level that is not used is a draft: no warnings about it
    for (const node of nodes) if (!node.used) { node.warnings = []; node.hints = []; }
    const end = { column: Math.max(columns, 1), row: 0 };
    return { nodes, edges, end, end_reachable, rows: reached_rows + (loose ? 1 : 0), columns: Math.max(columns + 1, loose) };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { level_map_exits, level_map };
}

const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(globalThis, require('../src/static/level_flow.js'));
const { level_map, level_map_exits } = require('../src/static/level_map.js');

const traits = { exit: { level_complete: {} }, ground: { block_above: {} } };
const traits_of = ref => traits[ref] ?? null;
const layer = (sprites, props = { collision_detection: true, parallax: 0 }) => ({ type: 'sprites', properties: props, sprites });
const level = (id, sprites, props = {}) => ({ id, properties: { use_level: true, name: '', ...props }, layers: [layer(sprites)] });
const exit = (target, more = {}) => ['exit', 0, 0, target === undefined && !Object.keys(more).length ? undefined : { level_complete: { ...(target !== undefined ? { target } : {}), ...more } }]
    .filter(x => x !== undefined);

test('a game that chose nothing is a row that ends', () => {
    const map = level_map([level('a', [exit()]), level('b', [exit()]), level('c', [exit()])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 1, 'next'], [1, 2, 'next'], [2, 'end', 'end']]);
    assert.deepEqual(map.nodes.map(n => [n.column, n.row]), [[0, 0], [1, 0], [2, 0]]);
    assert.equal(map.end_reachable, true);
    assert.equal(map.end.column, 3);
    assert.ok(map.nodes.every(n => n.reachable && !n.warnings.length));
    assert.ok(map.nodes[0].start);
});

test('a hub with a shop, a forest and the way back', () => {
    const levels = [
        level('hub', [exit('shop'), exit('wald', { action_key: true })]),
        level('wald', [exit('hub'), exit('@end')]),
        level('shop', [exit()], { side_level: true }),
    ];
    const map = level_map(levels, traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]).sort(), [[0, 1, 'target'], [0, 2, 'target'], [1, 0, 'target'], [1, 'end', 'end'], [2, 0, 'back']].sort());
    assert.equal(map.edges.find(e => e.to === 1).exits[0].action_key, true);
    assert.deepEqual(map.nodes.map(n => [n.column, n.row]), [[0, 0], [1, 0], [1, 1]]);
    assert.ok(map.nodes[2].side);
    assert.ok(map.nodes.every(n => !n.warnings.length), JSON.stringify(map.nodes.map(n => n.warnings)));
});

test('warnings: no exit, a lonely side level, a lost target, a broken layer, nowhere back', () => {
    const levels = [
        level('a', [exit('gone')]),
        level('b', []),
        level('s', [exit()], { side_level: true }),
        { id: 'c', properties: { use_level: true, name: 'Kaputt' }, layers: [layer([exit()], { collision_detection: false, parallax: 0 })] },
        level('draft', [], { use_level: false }),
    ];
    const map = level_map(levels, traits_of);
    assert.match(map.nodes[0].warnings[0], /nicht mehr gibt/);
    assert.equal(map.edges.find(e => e.from === 0).to, 1);       // falls back to the next level
    assert.match(map.nodes[1].hints[0], /Noch kein Ausgang/);
    assert.deepEqual(map.nodes[1].warnings, []);
    assert.ok(map.nodes[2].warnings.some(w => /Nebenlevel/.test(w)));
    assert.ok(map.nodes[2].warnings.some(w => /„zurück“/.test(w)));
    assert.ok(map.nodes[3].warnings.some(w => /Kollisionen/.test(w)));
    // reached along the order (Kein Ausgang in b yet: the arrow shows where it will lead)
    assert.ok(map.nodes[3].reachable);
    assert.deepEqual(map.nodes[4].warnings, []);                  // a draft says nothing
    assert.equal(map.end_reachable, false);
    assert.ok(!map.nodes[2].reachable && map.nodes[2].row === 1);
});

test('exits: placed settings and "geschafft bei Signal"', () => {
    const lv = level('a', [exit(undefined, { delta: 2 }), ['ground', 0, 0]], { signal_level_complete: 4, signal_level_complete_target: '@end' });
    const exits = level_map_exits(lv, traits_of);
    assert.deepEqual(exits.map(({ gate, ...rest }) => rest), [
        { layer: 0, index: 0, target: null, delta: 2, action_key: false, working: true },
        { signal: true, target: '@end', delta: 1, action_key: false, working: true },
    ]);
    assert.equal(exits[0].gate, null);
    assert.equal(exits[1].gate.code, 4);
    assert.equal(exits[1].gate.closed, true);
    const map = level_map([lv, level('b', [exit()]), level('c', [exit()])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 2, 'next'], [0, 'end', 'end'], [1, 2, 'next'], [2, 'end', 'end']]);
    assert.match(map.nodes[1].warnings[0], /nie in dieses Level/);
});

test('a new game is a connected row: levels without an exit show where it will lead', () => {
    // one empty level: on to the end, no alarm
    let map = level_map([level('a', [])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 'end', 'order']]);
    assert.equal(map.end_reachable, true);
    assert.deepEqual(map.nodes[0].warnings, []);
    assert.match(map.nodes[0].hints[0], /Noch kein Ausgang/);
    // three levels, the middle one already has an exit; Nebenlevel are no part of the order
    map = level_map([level('a', []), level('s', [], { side_level: true }), level('b', [exit()]), level('c', [])], traits_of);
    assert.deepEqual(map.edges.map(e => [e.from, e.to, e.kind]), [[0, 2, 'order'], [2, 3, 'next'], [3, 'end', 'order']]);
    assert.equal(map.end_reachable, true);
    assert.deepEqual(map.nodes[1].hints.length, 1);       // the Nebenlevel: a hint, no arrow
});

// ------------------------------------------------ what opens an exit
test('an exit on a layer that appears at a Signal waits for it, and says who sends it', () => {
    const signals = require('../src/static/signals.js');
    Object.assign(globalThis, signals);
    const all_traits = { ...traits, schalter: { switch: {} } };
    const t = ref => all_traits[ref] ?? null;
    const exit_layer = { type: 'sprites', properties: { collision_detection: true, parallax: 0, name: 'Tor', signal_code: 4, signal_reaction: 'appear' },
        sprites: [['exit', 0, 0]] };
    const world = layer([['schalter', 0, 0, { switch: { signal_code: 4 } }]]);
    const lvl = { id: 'a', properties: { use_level: true, name: '', signal_names: { 4: 'Tor' } }, layers: [world, exit_layer] };
    const [e] = level_map_exits(lvl, t);
    assert.equal(e.gate.code, 4);
    assert.equal(e.gate.closed, true);
    assert.deepEqual(e.gate.senders, ['1 Schalter']);
    assert.match(e.gate.text, /erscheint erst bei »Tor« \(Code 4\).*sendet: 1 Schalter/);
    assert.equal(level_map([lvl], t).nodes[0].warnings.length, 0);
    // nobody sends 4: the exit never opens
    world.sprites = [];
    const map = level_map([lvl], t);
    assert.match(map.nodes[0].warnings[0], /wartet auf »Tor« \(Code 4\), aber nichts/);
    // a layer that disappears at the Signal is there from the start: no warning
    exit_layer.properties.signal_reaction = 'disappear';
    assert.equal(level_map([lvl], t).nodes[0].warnings.length, 0);
    assert.match(level_map_exits(lvl, t)[0].gate.text, /verschwindet bei/);
    // a layer that does not react: no gate
    exit_layer.properties.signal_reaction = 'none';
    assert.equal(level_map_exits(lvl, t)[0].gate, null);
});

test('„geschafft bei Signal“ names its Code and its senders', () => {
    Object.assign(globalThis, require('../src/static/signals.js'));
    const lvl = { id: 'a', properties: { use_level: true, name: '', signal_level_complete: 2, signal_all_defeated: 2 }, layers: [layer([])] };
    const exits = level_map_exits(lvl, traits_of);
    assert.equal(exits.length, 1);
    assert.deepEqual(exits[0].gate.senders, ['alle Gegner besiegt']);
    assert.match(exits[0].gate.text, /^„geschafft bei Signal“ wartet auf Code 2 – sendet: alle Gegner besiegt$/);
});

test('"Level geschafft": every exit and "geschafft bei Signal" is a line, with where it leads', () => {
    Object.assign(globalThis, require('../src/static/signals.js'));
    const { level_complete_rule } = require('../src/static/level_map.js');
    const names = { exit: 'Fahne' };
    const plain = level('a', [exit(), exit(), exit('b', { action_key: true })]);
    const rule = level_complete_rule(plain, traits_of, r => names[r]);
    assert.equal(rule.problem, null);
    assert.deepEqual(rule.lines.map(l => [l.kind, l.text, l.count, l.target, l.action_key, l.gate]), [
        ['exit', 'die Spielfigur »Fahne« erreicht', 2, null, false, null],
        ['exit', 'die Spielfigur »Fahne« erreicht und F drückt', 1, 'b', true, null],
    ]);
    assert.deepEqual(rule.lines[0].objects, [
        { kind: 'sprite', layer_index: 0, placed_index: 0, role: 'level_complete' },
        { kind: 'sprite', layer_index: 0, placed_index: 1, role: 'level_complete' }]);
    // a locked exit and "geschafft bei Signal"
    const more = level('a', [exit(undefined, { opens_on_signal: true, signal_code: 3 })],
        { signal_level_complete: 7, signal_level_complete_target: '@end', signal_names: { 3: 'Tor auf' } });
    const lines = level_complete_rule(more, traits_of, r => names[r]).lines;
    assert.deepEqual(lines.map(l => [l.kind, l.text, l.target, l.gate?.code ?? null]), [
        ['exit', 'die Spielfigur »Fahne« erreicht', null, 3],
        ['signal', 'das Signal Code 7 ankommt', '@end', null],
    ]);
    // nothing ends the level
    assert.equal(level_complete_rule(level('a', []), traits_of, r => names[r]).problem, 'no_exit');
    // a locked exit nothing opens is a warning in the Levelübersicht
    const map = level_map([level('a', [exit(undefined, { opens_on_signal: true, signal_code: 3 })])], traits_of);
    assert.ok(map.nodes[0].warnings.some(w => w.includes('Tor auf') || w.includes('Code 3')));
});

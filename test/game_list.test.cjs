const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('../src/static/game_list.js');

const node = (tag, parent, ts, more = {}) => ({ tag, parent, ts_created: ts, ...more });

test('a code is found in what was typed or pasted', () => {
    assert.equal(g.game_list_code('abc1234'), 'abc1234');
    assert.equal(g.game_list_code('  ABC1234 '), 'abc1234');
    assert.equal(g.game_list_code('https://2d.hackschule.de/play/abc1234'), 'abc1234');
    assert.equal(g.game_list_code('https://2d.hackschule.de/standalone#abc1234'), 'abc1234');
    assert.equal(g.game_list_code('abc123'), null);
    assert.equal(g.game_list_code('Pip springt'), null);
});

test('the search finds every word in code, title, author and older names', () => {
    const pip = { tag: 'k3x9a1b', title: 'Pip springt', author: 'Ada Müller', others: ['Pip'] };
    assert.ok(g.game_list_matches(pip, ''));
    assert.ok(g.game_list_matches(pip, 'springt'));
    assert.ok(g.game_list_matches(pip, 'MULLER pip'));
    assert.ok(g.game_list_matches(pip, 'müller'));
    assert.ok(g.game_list_matches(pip, 'k3x'));
    assert.ok(!g.game_list_matches(pip, 'pip bo'));
    assert.ok(g.game_list_matches({ tag: 'x', title: 'Neu', others: ['Alter Name'] }, 'alter'));
});

test('sorting: newest first, text alphabetically, empty values last', () => {
    const nodes = [node('a', null, 3, { title: 'Zebra' }), node('b', null, 9, { title: 'apfel' }), node('c', null, 5)];
    assert.deepEqual(g.game_list_sort(nodes, 'ts_created').map(n => n.tag), ['b', 'c', 'a']);
    assert.deepEqual(g.game_list_sort(nodes, 'title', false).map(n => n.tag), ['b', 'a', 'c']);
    assert.deepEqual(g.game_list_sort(nodes, 'title', true).map(n => n.tag), ['a', 'b', 'c']);
});

test('rows are escaped', () => {
    const html = g.game_list_row_html({ tag: 'abc1234', title: '<b>x</b>', author: 'A & B', relatives_count: 3 }, g.GAME_LIST_COLUMNS);
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
    assert.ok(html.includes('A &amp; B'));
    assert.ok(html.includes('3 Versionen'));
    assert.ok(!html.includes('<b>'));
});

//  r ── a ── b ── c          (main: c, the newest)
//            └── d ── e
//  r ── f
const family = [
    node('r', null, 1), node('a', 'r', 2), node('b', 'a', 3), node('c', 'b', 9),
    node('d', 'a', 4), node('e', 'd', 5), node('f', 'r', 6),
];

test('the family tree: the newest branch straight through, the others around it', () => {
    const layout = g.game_family_layout(family);
    const at = Object.fromEntries(layout.nodes.map(n => [n.tag, [n.x, n.y]]));
    assert.equal(layout.main_tag, 'c');
    // d leaves further right: placed first, below; f does not fit beside it: above
    assert.deepEqual(at, { r: [0, 1], a: [1, 1], b: [2, 1], c: [3, 1], d: [2, 2], e: [3, 2], f: [1, 0] });
    assert.equal(layout.rows, 3);
    assert.equal(layout.columns, 4);
    assert.deepEqual(layout.nodes.filter(n => n.tip).map(n => n.tag).sort(), ['c', 'e', 'f']);
    assert.equal(layout.edges.length, 6);
});

test('another main version moves its branch onto the straight line', () => {
    const layout = g.game_family_layout(family, { main_tag: 'e' });
    const at = Object.fromEntries(layout.nodes.map(n => [n.tag, [n.x, n.y]]));
    assert.deepEqual(at.e, [3, 1]);
    assert.deepEqual(at.c, [3, 2]);
});

test('long straight stretches are folded in big families', () => {
    const chain = [node('v0', null, 0)];
    for (let i = 1; i < 40; i++) chain.push(node(`v${i}`, `v${i - 1}`, i));
    chain.push(node('w', 'v10', 100));
    const layout = g.game_family_layout(chain);
    const tags = layout.nodes.map(n => n.tag);
    assert.ok(tags.includes('v0') && tags.includes('v10') && tags.includes('v39') && tags.includes('w'));
    assert.ok(!tags.includes('v5') && !tags.includes('v20'));
    const folded = layout.edges.reduce((s, e) => s + e.folded, 0);
    assert.equal(folded + layout.nodes.length, chain.length);
    // a version that is kept is drawn
    assert.ok(g.game_family_layout(chain, { keep: ['v20'] }).nodes.some(n => n.tag === 'v20'));
    // small families are never folded
    assert.equal(g.game_family_layout(family).nodes.length, family.length);
});

test('ancestors: the version and everything before it', () => {
    assert.deepEqual(g.game_family_ancestors(family, 'e').map(n => n.tag), ['e', 'd', 'a', 'r']);
    assert.deepEqual(g.game_family_ancestors(family, 'nope'), []);
});

test('the SVG highlights the way to the selected version', () => {
    const layout = g.game_family_layout(family);
    const svg = g.game_family_svg(layout, 'e');
    assert.ok(svg.startsWith('<svg'));
    const highlighted = [...svg.matchAll(/class="family-node highlight[^"]*" data-tag="(\w+)"/g)].map(m => m[1]).sort();
    assert.deepEqual(highlighted, ['a', 'd', 'e', 'r']);
    assert.equal((svg.match(/family-edge highlight/g) || []).length, 3);
    assert.ok(svg.includes('family-node highlight selected" data-tag="e"'));
});

test('a broken family (loop, unknown parent) still draws', () => {
    const layout = g.game_family_layout([node('x', 'y', 1), node('y', 'x', 2), node('z', 'gone', 3)]);
    assert.deepEqual(layout.nodes.map(n => n.tag).sort(), ['x', 'y', 'z']);
    const folded_loop = Array.from({ length: 40 }, (_, i) => node(`l${i}`, `l${(i + 1) % 40}`, i));
    assert.ok(g.game_family_layout(folded_loop).nodes.length > 0);
});

test('a branch tip shows its date, and its title only when it differs from the family', () => {
    const nodes = [node('r', null, 1000, { title: 'Pip' }), node('a', 'r', 2000, { title: 'Pip' }), node('b', 'r', 3000, { title: 'Pip im Schnee' })];
    const svg = g.game_family_svg(g.game_family_layout(nodes), 'b', { title: 'Pip im Schnee' });
    const labels = [...svg.matchAll(/<text x="[\d.]+" y="[\d.]+">([^<]*)<\/text>/g)].map(m => m[1]);
    assert.equal(labels.length, 2);
    assert.ok(labels.some(l => l.startsWith('Pip · ')));
    assert.ok(labels.every(l => !l.includes('Pip im Schnee')));
});

test('short branches far apart share a row, branches never overlap', () => {
    const chain = ['r', 'a', 'b', 'c', 'd', 'e', 'f', 'g'].map((t, i, all) => node(t, i ? all[i - 1] : null, i * 10));
    const nodes = [...chain, node('s1', 'a', 100), node('s2', 'f', 101), node('s3', 'b', 102)];
    const layout = g.game_family_layout(nodes, { main_tag: 'g' });
    const at = Object.fromEntries(layout.nodes.map(n => [n.tag, [n.x, n.y]]));
    assert.deepEqual(at.g, [7, 1]);
    assert.deepEqual(at.s2, [7, 2]);
    assert.deepEqual(at.s3, [3, 2]);   // far enough from s2: the same row
    assert.deepEqual(at.s1, [2, 0]);   // would meet s3: above the main line
    assert.equal(layout.rows, 3);
    // no two drawn versions in the same place
    assert.equal(new Set(layout.nodes.map(n => `${n.x},${n.y}`)).size, layout.nodes.length);
});

test('a big random family: every version drawn once, rows packed', () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const nodes = [node('v0', null, 0)];
    for (let i = 1; i < 300; i++) {
        // mostly going on from the newest, sometimes from an older version
        const parent = rand() < 0.85 ? nodes[nodes.length - 1].tag : nodes[Math.floor(rand() * nodes.length)].tag;
        nodes.push(node(`v${i}`, parent, i));
    }
    const layout = g.game_family_layout(nodes);
    const folded = layout.edges.reduce((s, e) => s + e.folded, 0);
    assert.equal(folded + layout.nodes.length, nodes.length);
    assert.equal(new Set(layout.nodes.map(n => `${n.x},${n.y}`)).size, layout.nodes.length);
    const tips = layout.nodes.filter(n => n.tip).length;
    assert.ok(layout.rows < tips, `${layout.rows} rows for ${tips} branches`);
});

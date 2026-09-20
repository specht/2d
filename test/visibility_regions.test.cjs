const test = require('node:test');
const assert = require('node:assert/strict');
const VisibilityRegions = require('../src/static/visibility_regions.js');

const rect = (left, bottom, width = 10, height = 10) => ({ left, bottom, width, height });
const region = (target_layer_id, rects, inside_visible = false) =>
    ({ type: 'visibility_region', target_layer_id, rects, inside_visible });
const player = (x, y, height = 2) =>
    ({ mesh: { position: { x, y } }, sprite: { height } });
const group = () => ({ visible: true, children: [{ visible: true }] });

test('entering/leaving, spawn inside, and respawn use the player centre', () => {
    const layers = [{ type: 'sprites', id: 'facade' }, region('facade', [rect(0, 0)])];
    const rules = VisibilityRegions.resolve(layers);
    const facade = group();
    VisibilityRegions.apply(rules, [facade, group()], player(-1, 1));
    assert.equal(facade.visible, true);
    VisibilityRegions.apply(rules, [facade, group()], player(5, 1));
    assert.equal(facade.visible, false);
    VisibilityRegions.apply(rules, [facade, group()], player(5, -2)); // centre outside
    assert.equal(facade.visible, true);
    VisibilityRegions.apply(rules, [facade, group()], player(5, 5)); // spawn/respawn inside
    assert.equal(facade.visible, false);
    assert.equal(facade.children[0].visible, true); // no mutation of sprite meshes/collision
});

test('two houses and multiple rectangles do not affect unrelated layers', () => {
    const layers = [
        { type: 'sprites', id: 'a' }, { type: 'sprites', id: 'b' },
        region('a', [rect(0, 0), rect(10, 0)]), region('b', [rect(40, 0)]),
    ];
    const groups = layers.map(group);
    const rules = VisibilityRegions.resolve(layers);
    VisibilityRegions.apply(rules, groups, player(12, 2));
    assert.equal(groups[0].visible, false);
    assert.equal(groups[1].visible, true);
    VisibilityRegions.apply(rules, groups, player(44, 2));
    assert.equal(groups[0].visible, true);
    assert.equal(groups[1].visible, false);
});

test('inside visible is the inverse policy; boundaries belong to the region', () => {
    const groups = [group(), group()];
    const rules = VisibilityRegions.resolve([{ type: 'backdrop', id: 'roof' }, region('roof', [rect(0, 0)], true)]);
    VisibilityRegions.apply(rules, groups, player(-1, 0));
    assert.equal(groups[0].visible, false);
    VisibilityRegions.apply(rules, groups, player(0, -1)); // centre at y=0
    assert.equal(groups[0].visible, true);
});

test('stable IDs survive rename/reorder; only a selected legacy target gets an ID', () => {
    const facade = { type: 'sprites', properties: { name: 'Fassade' } };
    const other = { type: 'sprites', properties: { name: 'Alt' } };
    const layers = [facade, other];
    const id = VisibilityRegions.uniqueTargetId(layers, facade);
    assert.ok(id.startsWith('layer-'));
    assert.equal(other.id, undefined);
    facade.properties.name = 'Neuer Name';
    layers.reverse();
    layers.push(region(id, [rect(0, 0)]));
    assert.equal(VisibilityRegions.uniqueTargetId(layers, facade), id);
    assert.equal(VisibilityRegions.resolve(layers)[0].targetIndex, 1);
});

test('invalid references, duplicate targets, duplicate IDs and invalid rectangles are inert', () => {
    const cases = [
        [{ type: 'sprites', id: 'a' }, region('missing', [rect(0, 0)])],
        [{ type: 'sprites', id: 'a' }, region('a', [rect(0, 0)]), region('a', [rect(20, 0)])],
        [{ type: 'sprites', id: 'a' }, { type: 'sprites', id: 'a' }, region('a', [rect(0, 0)])],
        [{ type: 'sprites', id: 'a' }, region('a', [rect(0, 0, -1)])],
        [{ type: 'sprites', id: 'a' }, region('a', [])],
    ];
    for (const layers of cases) {
        const groups = layers.map(group);
        assert.deepEqual(VisibilityRegions.resolve(layers), []);
        VisibilityRegions.apply(VisibilityRegions.resolve(layers), groups, player(5, 5));
        assert.ok(groups.every(g => g.visible));
    }
});

test('restart/level changes rebuild rules and groups; legacy levels do nothing', () => {
    const oldGroups = [group(), group()];
    const layers = [{ type: 'sprites', id: 'a' }, region('a', [rect(0, 0)])];
    VisibilityRegions.apply(VisibilityRegions.resolve(layers), oldGroups, player(5, 0));
    assert.equal(oldGroups[0].visible, false);
    const restartedGroups = [group(), group()];
    VisibilityRegions.apply(VisibilityRegions.resolve(layers), restartedGroups, player(-5, 0));
    assert.equal(restartedGroups[0].visible, true);
    const newLevelGroups = [group()];
    VisibilityRegions.apply(VisibilityRegions.resolve([{ type: 'sprites' }]), newLevelGroups, player(5, 0));
    assert.equal(newLevelGroups[0].visible, true);
});

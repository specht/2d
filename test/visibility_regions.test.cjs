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


test('fade defaults to immediate; invalid durations cannot affect saved games', () => {
    for (const fade_seconds of [undefined, -1, 2.1, NaN, '1']) {
        const layers = [{ type: 'sprites', id: 'facade' },
            { ...region('facade', [rect(0, 0)]), fade_seconds }];
        const rules = VisibilityRegions.resolve(layers);
        assert.equal(rules[0].fadeSeconds, 0);
        const groups = layers.map(group);
        VisibilityRegions.apply(rules, groups, player(-1, 0), 1, true);
        VisibilityRegions.apply(rules, groups, player(5, 0), 1.01);
        assert.equal(groups[0].visible, false);
    }
});

test('fade reverses smoothly and is immediately correct on spawn and respawn', () => {
    const layers = [{ type: 'sprites', id: 'facade' },
        { ...region('facade', [rect(0, 0)]), fade_seconds: 1 }];
    const rules = VisibilityRegions.resolve(layers);
    const groups = layers.map(group);
    const facade = groups[0];
    // In the absence of a material, group visibility alone still follows the rule.
    VisibilityRegions.prepare(rules, groups);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0, true);
    assert.equal(rules[0].alpha, 1);
    VisibilityRegions.apply(rules, groups, player(5, 0), 0.1);
    VisibilityRegions.apply(rules, groups, player(5, 0), 0.6);
    assert.ok(Math.abs(rules[0].alpha - 0.5) < 1e-8);
    assert.equal(facade.visible, true);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0.6);
    assert.ok(Math.abs(rules[0].alpha - 0.5) < 1e-8);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0.85);
    assert.ok(Math.abs(rules[0].alpha - 0.75) < 1e-8);
    VisibilityRegions.apply(rules, groups, player(5, 0), 0.85, true); // respawn
    assert.equal(rules[0].alpha, 0);
    assert.equal(facade.visible, false);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 1.0, true); // restart
    assert.equal(rules[0].alpha, 1);
    assert.equal(facade.visible, true);
});

test('fade uses private material clones, preserving other houses, children and collisions', () => {
    const shared = {
        isShaderMaterial: true, transparent: true,
        uniforms: { texture1: { value: 'shared image' } },
        fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
        clone() { return { ...this, uniforms: { ...this.uniforms } }; },
    };
    const visibleChild = { material: shared, visible: true, children: [] };
    const hiddenChild = { material: shared, visible: false, children: [] };
    const houseA = { visible: true, children: [visibleChild, hiddenChild] };
    const houseB = { visible: true, children: [{ material: shared, visible: true }] };
    const layers = [
        { type: 'sprites', id: 'a' }, { type: 'sprites', id: 'b' },
        { ...region('a', [rect(0, 0)]), fade_seconds: 1 },
    ];
    const rules = VisibilityRegions.resolve(layers);
    const groups = [houseA, houseB, group()];
    const collisions = [1, 2, 3];
    VisibilityRegions.prepare(rules, groups);
    assert.notEqual(visibleChild.material, shared);
    assert.equal(visibleChild.material.depthWrite, false);
    assert.equal(visibleChild.material, hiddenChild.material); // one clone per source material and layer
    assert.equal(houseB.children[0].material, shared);
    assert.equal(visibleChild.material.uniforms.texture1.value, shared.uniforms.texture1.value);
    assert.match(visibleChild.material.fragmentShader, /gl_FragColor\.a \*= visibilityRegionOpacity/);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0, true);
    VisibilityRegions.apply(rules, groups, player(5, 0), 0.1);
    VisibilityRegions.apply(rules, groups, player(5, 0), 0.6);
    assert.ok(Math.abs(visibleChild.material.uniforms.visibilityRegionOpacity.value - 0.5) < 1e-8);
    assert.equal(shared.uniforms.visibilityRegionOpacity, undefined);
    assert.equal(hiddenChild.visible, false);
    assert.equal(houseB.visible, true);
    assert.deepEqual(collisions, [1, 2, 3]);
});

test('non-shader materials retain original opacity when a fade is prepared', () => {
    const material = { opacity: 0.6, clone() { return { ...this }; } };
    const child = { material, children: [] };
    const groups = [{ visible: true, children: [child] }, group()];
    const rules = VisibilityRegions.resolve([
        { type: 'backdrop', id: 'a' },
        { ...region('a', [rect(0, 0)]), fade_seconds: 2 },
    ]);
    VisibilityRegions.prepare(rules, groups);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0, true);
    VisibilityRegions.apply(rules, groups, player(5, 0), 1);
    VisibilityRegions.apply(rules, groups, player(5, 0), 2);
    assert.ok(Math.abs(child.material.opacity - 0.3) < 1e-8);
    assert.equal(material.opacity, 0.6);
});

// Three.js clones textures when it clones ShaderMaterial uniforms. An atlas
// copy is not the already uploaded texture; the facade would stay invisible
// even when the fade opacity becomes positive.
test('a fading sprite layer retains the uploaded texture instead of the cloned texture', () => {
    const atlas = { isTexture: true, image: { uploaded: true } };
    const source = {
        isShaderMaterial: true, transparent: true,
        uniforms: { texture1: { value: atlas } },
        fragmentShader: 'uniform sampler2D texture1; void main() { gl_FragColor = texture2D(texture1, vec2(0.5)); }',
        clone() {
            return { ...this, uniforms: { texture1: { value: { isTexture: true, image: null } } } };
        },
    };
    const facade = { visible: true, children: [{ material: source, visible: true }] };
    const neighbor = { visible: true, children: [{ material: source, visible: true }] };
    const layers = [{ type: 'sprites', id: 'facade' }, { type: 'sprites', id: 'neighbor' },
        { ...region('facade', [rect(0, 0)]), fade_seconds: 1 }];
    const rules = VisibilityRegions.resolve(layers);
    const groups = [facade, neighbor, group()];
    VisibilityRegions.prepare(rules, groups);
    const fadingMaterial = facade.children[0].material;
    assert.notStrictEqual(fadingMaterial, source);
    assert.strictEqual(fadingMaterial.uniforms.texture1.value, atlas);
    assert.strictEqual(neighbor.children[0].material, source);
    VisibilityRegions.apply(rules, groups, player(5, 0), 0, true);
    assert.equal(facade.visible, false);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0.1);
    VisibilityRegions.apply(rules, groups, player(-1, 0), 0.6);
    assert.equal(facade.visible, true);
    assert.ok(Math.abs(fadingMaterial.uniforms.visibilityRegionOpacity.value - 0.5) < 1e-8);
    assert.strictEqual(fadingMaterial.uniforms.texture1.value, atlas);
    assert.strictEqual(neighbor.children[0].material.uniforms.texture1.value, atlas);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const LayerFade = require('../src/static/layer_fade.js');

test('a fade uses private material copies; other layers, children and the original stay as they are', () => {
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
    const fade = LayerFade.materials(houseA, 'signalOpacity');
    assert.notEqual(visibleChild.material, shared);
    assert.equal(visibleChild.material.depthWrite, false);
    assert.equal(visibleChild.material, hiddenChild.material); // one copy per source material and layer
    assert.equal(houseB.children[0].material, shared);
    assert.equal(visibleChild.material.uniforms.texture1.value, shared.uniforms.texture1.value);
    assert.match(visibleChild.material.fragmentShader, /gl_FragColor\.a \*= signalOpacity/);
    LayerFade.set(fade, 0.5);
    assert.equal(visibleChild.material.uniforms.signalOpacity.value, 0.5);
    assert.equal(shared.uniforms.signalOpacity, undefined);
    assert.equal(hiddenChild.visible, false);
});

test('non-shader materials keep their own opacity as the full value', () => {
    const material = { opacity: 0.6, clone() { return { ...this }; } };
    const child = { material, children: [] };
    const fade = LayerFade.materials({ visible: true, children: [child] });
    LayerFade.set(fade, 0.5);
    assert.ok(Math.abs(child.material.opacity - 0.3) < 1e-8);
    assert.equal(material.opacity, 0.6);
});

// Three.js clones textures when it clones ShaderMaterial uniforms. An atlas
// copy is not the already uploaded texture; the layer would stay invisible.
test('a fading sprite layer keeps the uploaded texture instead of a cloned one', () => {
    const atlas = { isTexture: true, image: { uploaded: true } };
    const source = {
        isShaderMaterial: true, transparent: true,
        uniforms: { texture1: { value: atlas } },
        fragmentShader: 'uniform sampler2D texture1; void main() { gl_FragColor = texture2D(texture1, vec2(0.5)); }',
        clone() { return { ...this, uniforms: { texture1: { value: { isTexture: true, image: null } } } }; },
    };
    const layer = { visible: true, children: [{ material: source, visible: true }] };
    LayerFade.materials(layer);
    assert.notStrictEqual(layer.children[0].material, source);
    assert.strictEqual(layer.children[0].material.uniforms.texture1.value, atlas);
});

test('materials used later (a character switching frames) get their copy on first use', () => {
    const fade = LayerFade.materials({ children: [] }, 'signalOpacity');
    const frame = { opacity: 1, clone() { return { ...this }; } };
    const copy = LayerFade.copy_for(fade, frame, 0.25);
    assert.notStrictEqual(copy, frame);
    assert.equal(copy.opacity, 0.25);
    assert.strictEqual(LayerFade.copy_for(fade, frame), copy);
    LayerFade.set(fade, 1);
    assert.equal(copy.opacity, 1);
    assert.equal(LayerFade.copy_for(fade, null), null);
});

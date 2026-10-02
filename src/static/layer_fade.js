// Fading a whole layer in and out (Signale: a layer that appears or
// disappears, signals.js). A Three.js group has no opacity, so the meshes of
// ONE layer get their own copies of their materials; shared spritesheets,
// other layers and child visibility stay intact. Only the drawing fades –
// collisions are decided elsewhere.
const LayerFade = (() => {
    // A copy of one material whose opacity can be set (or null if it cannot
    // fade). uniform: the name of the opacity uniform added to shader materials.
    function copy(original, uniform = 'layerOpacity') {
        if (!original?.clone) return null;
        const material = original.clone();
        let entry;
        if (material.isShaderMaterial) {
            // ShaderMaterial.clone() clones THREE.Texture uniforms too. That copy
            // is not the uploaded atlas texture and may render transparent/empty:
            // share the ORIGINAL texture, just as the character hit-flash
            // materials do in app.js.
            if (original.uniforms?.texture1 && material.uniforms?.texture1)
                material.uniforms.texture1.value = original.uniforms.texture1.value;
            // Keep the original shader (and its animation uniforms) but multiply
            // its final alpha by this layer's opacity.
            if (!/}\s*$/.test(material.fragmentShader)) return null;
            // Mischmodus (backdrops.js): the colour is premultiplied and must
            // fade as well, not only the alpha.
            const fade = material.userData?.blend ? 'gl_FragColor' : 'gl_FragColor.a';
            material.fragmentShader = `uniform float ${uniform};\n` +
                material.fragmentShader.replace(/}\s*$/, `    ${fade} *= ${uniform};\n}`);
            material.uniforms[uniform] = { value: 1 };
            material.needsUpdate = true;
            entry = { material, shader: true, uniform };
        } else {
            entry = { material, opacity: material.opacity ?? 1 };
        }
        material.transparent = true;
        material.depthWrite = false; // a fading layer must not hide what is behind it
        return entry;
    }

    // Gives the meshes of a group their own fading materials (one copy per
    // source material). Returns { entries, copies } for set() and copy_for().
    function materials(group, uniform = 'layerOpacity') {
        const fade = { entries: [], copies: new Map(), uniform };
        function visit(node) {
            if (node.material) {
                const originals = Array.isArray(node.material) ? node.material : [node.material];
                const replaced = originals.map(original => copy_for(fade, original) ?? original);
                node.material = Array.isArray(node.material) ? replaced : replaced[0];
            }
            for (const child of node.children ?? []) visit(child);
        }
        if (group) visit(group);
        return fade;
    }

    // The fading copy of a material, made on first use (characters switch
    // their material every frame, app.js material_for_frame).
    function copy_for(fade, original, alpha = null) {
        if (!fade || !original) return null;
        if (!fade.copies.has(original)) {
            const entry = copy(original, fade.uniform);
            fade.copies.set(original, entry?.material ?? null);
            if (entry) {
                fade.entries.push(entry);
                if (alpha !== null) set_entry(entry, alpha);
            }
        }
        return fade.copies.get(original);
    }

    function set_entry(entry, alpha) {
        if (entry.shader) entry.material.uniforms[entry.uniform].value = alpha;
        else entry.material.opacity = entry.opacity * alpha;
    }

    function set(fade, alpha) {
        for (const entry of fade?.entries ?? []) set_entry(entry, alpha);
    }

    return { copy, materials, copy_for, set };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LayerFade;

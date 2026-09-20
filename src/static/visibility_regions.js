// Sichtbarkeitsbereiche steuern ausschließlich die Darstellung eines Layers.
// Diese Funktionen verändern weder das gespeicherte Spiel noch Kollisionsdaten.
const VisibilityRegions = (() => {
    function uniqueTargetId(layers, target) {
        if (typeof target.id === 'string' && target.id.length > 0 &&
            layers.filter(layer => layer.id === target.id).length === 1) return target.id;
        let id;
        do {
            id = `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        } while (layers.some(layer => layer.id === id));
        target.id = id; // Nur beim ausdrücklichen Auswählen eines Ziels, niemals beim Laden.
        return id;
    }

    function validRectangle(rect) {
        return rect && ['left', 'bottom', 'width', 'height'].every(key =>
            typeof rect[key] === 'number' && Number.isFinite(rect[key])) &&
            rect.width > 0 && rect.height > 0;
    }

    function resolve(layers) {
        if (!Array.isArray(layers)) return [];
        const targets = new Map();
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (!layer || layer.type === 'visibility_region' ||
                typeof layer.id !== 'string' || !layer.id) continue;
            // Doppelte IDs sind mehrdeutig: keinem dieser Layer wird eine Regel zugeordnet.
            if (targets.has(layer.id)) targets.set(layer.id, null);
            else targets.set(layer.id, i);
        }
        const counts = new Map();
        for (const layer of layers) {
            if (layer?.type !== 'visibility_region' || typeof layer.target_layer_id !== 'string') continue;
            counts.set(layer.target_layer_id, (counts.get(layer.target_layer_id) ?? 0) + 1);
        }
        const rules = [];
        for (const layer of layers) {
            if (layer?.type !== 'visibility_region') continue;
            const targetIndex = targets.get(layer.target_layer_id);
            const rects = Array.isArray(layer.rects) ? layer.rects.filter(validRectangle) : [];
            if (targetIndex === undefined || targetIndex === null ||
                counts.get(layer.target_layer_id) !== 1 || rects.length === 0) continue;
            // Optional; saved games without the setting retain immediate visibility changes.
            const fadeSeconds = typeof layer.fade_seconds === 'number' &&
                Number.isFinite(layer.fade_seconds) && layer.fade_seconds >= 0 &&
                layer.fade_seconds <= 2 ? layer.fade_seconds : 0;
            rules.push({ targetIndex, rects, insideVisible: layer.inside_visible === true, fadeSeconds });
        }
        return rules;
    }

    // A group has no opacity in Three.js. Give ONLY controlled meshes their own
    // materials; shared spritesheets, other layers and child visibility stay intact.
    function prepare(rules, groups) {
        for (const rule of rules) {
            if (!rule.fadeSeconds || !groups[rule.targetIndex]) continue;
            const copies = new Map();
            rule.fadeMaterials = [];
            function visit(node) {
                if (node.material) {
                    const originals = Array.isArray(node.material) ? node.material : [node.material];
                    const materials = originals.map(original => {
                        if (!original?.clone) return original;
                        if (!copies.has(original)) {
                            const copy = original.clone();
                            if (copy.isShaderMaterial) {
                                // Keep the original shader (and its animation uniforms)
                                // but multiply its final alpha by this layer's opacity.
                                if (!/}\s*$/.test(copy.fragmentShader)) return original;
                                copy.fragmentShader = 'uniform float visibilityRegionOpacity;\n' +
                                    copy.fragmentShader.replace(/}\s*$/, '    gl_FragColor.a *= visibilityRegionOpacity;\n}');
                                copy.uniforms.visibilityRegionOpacity = { value: 1 };
                                copy.needsUpdate = true;
                                rule.fadeMaterials.push({ material: copy, shader: true });
                            } else {
                                rule.fadeMaterials.push({ material: copy, opacity: copy.opacity ?? 1 });
                            }
                            copy.transparent = true;
                            copy.depthWrite = false; // Das transparente Dach darf den Innenraum nicht verdecken.
                            copies.set(original, copy);
                        }
                        return copies.get(original);
                    });
                    node.material = Array.isArray(node.material) ? materials : materials[0];
                }
                for (const child of node.children ?? []) visit(child);
            }
            visit(groups[rule.targetIndex]);
        }
    }

    function apply(rules, groups, player, time, immediate = false) {
        if (!player?.mesh?.position || !player.sprite || !Array.isArray(groups)) return;
        const x = player.mesh.position.x;
        const y = player.mesh.position.y + player.sprite.height / 2;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        for (const rule of rules) {
            const group = groups[rule.targetIndex];
            if (!group) continue;
            const inside = rule.rects.some(rect =>
                x >= rect.left && x <= rect.left + rect.width &&
                y >= rect.bottom && y <= rect.bottom + rect.height);
            const desired = (inside ? rule.insideVisible : !rule.insideVisible) ? 1 : 0;
            const duration = rule.fadeSeconds ?? 0;
            let alpha;
            if (!duration || immediate || !Number.isFinite(time) || !Number.isFinite(rule.alpha)) {
                alpha = desired;
                rule.from = rule.to = desired;
                rule.startedAt = time;
            } else {
                const progress = rule.from === rule.to ? 1 :
                    Math.max(0, Math.min(1, (time - rule.startedAt) /
                        (duration * Math.abs(rule.to - rule.from))));
                alpha = rule.from + (rule.to - rule.from) * progress;
                if (desired !== rule.to) {
                    // Reversing a fade continues from its current opacity.
                    rule.from = alpha;
                    rule.to = desired;
                    rule.startedAt = time;
                }
            }
            rule.alpha = alpha;
            group.visible = alpha > 0;
            for (const entry of rule.fadeMaterials ?? []) {
                if (entry.shader) entry.material.uniforms.visibilityRegionOpacity.value = alpha;
                else entry.material.opacity = entry.opacity * alpha;
            }
        }
    }

    return { uniqueTargetId, validRectangle, resolve, prepare, apply };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VisibilityRegions;

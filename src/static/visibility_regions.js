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
            rules.push({ targetIndex, rects, insideVisible: layer.inside_visible === true });
        }
        return rules;
    }

    function apply(rules, groups, player) {
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
            group.visible = inside ? rule.insideVisible : !rule.insideVisible;
        }
    }

    return { uniqueTargetId, validRectangle, resolve, apply };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = VisibilityRegions;

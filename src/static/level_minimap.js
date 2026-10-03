// The Übersichtskarte of the level editor: a small map of the whole level in
// a corner of the level view, with a frame for what the view shows; clicking
// or dragging on it moves the view there. Pure geometry here, the editor
// (level_editor.js) draws the map and handles the mouse.
//
// World coordinates as in the level (y up); map coordinates in CSS pixels
// from the map's top left corner (y down).

// The part of the world the map shows: every placed sprite of the layers
// that scroll with the level (Parallaxe 0), or of every sprite layer if none
// of those has sprites. A placed sprite stands on its point (x is its middle,
// y its bottom), like in the game. size_of(sprite ref) → { width, height }
// or null. A margin all around; null for an empty level.
function minimap_bounds(layers, size_of, margin = 24) {
    const sprite_layers = (layers ?? []).filter(layer => layer?.type === 'sprites' && Array.isArray(layer.sprites));
    const scrolling = sprite_layers.filter(layer => Math.abs(Number(layer.properties?.parallax) || 0) < 1e-6);
    const box_of = (list) => {
        let box = null;
        for (const layer of list) {
            for (const placed of layer.sprites) {
                if (!Array.isArray(placed)) continue;
                const size = size_of(placed[0]);
                if (!size) continue;
                const x = Number(placed[1]) || 0, y = Number(placed[2]) || 0;
                const x0 = x - size.width / 2, x1 = x + size.width / 2, y1 = y + size.height;
                if (!box) box = { x0, y0: y, x1, y1 };
                else {
                    box.x0 = Math.min(box.x0, x0); box.x1 = Math.max(box.x1, x1);
                    box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y1);
                }
            }
        }
        return box;
    };
    const box = box_of(scrolling) ?? box_of(sprite_layers);
    if (!box) return null;
    return { x0: box.x0 - margin, y0: box.y0 - margin, x1: box.x1 + margin, y1: box.y1 + margin };
}

// The map's size in pixels: as big as fits into max_width × max_height with
// the level's proportions, but never thinner than min_size.
// scale: map pixels per world pixel.
function minimap_layout(bounds, max_width, max_height, min_size = 24) {
    const w = Math.max(1, bounds.x1 - bounds.x0), h = Math.max(1, bounds.y1 - bounds.y0);
    const scale = Math.min(max_width / w, max_height / h);
    return {
        width: Math.max(min_size, Math.round(w * scale)),
        height: Math.max(min_size, Math.round(h * scale)),
        scale,
    };
}

// The map is centred on the level's middle (a very flat level gets
// min_size, and stays in the middle of it).
function minimap_world_to_map(bounds, layout, x, y) {
    const cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
    return [layout.width / 2 + (x - cx) * layout.scale, layout.height / 2 - (y - cy) * layout.scale];
}

function minimap_map_to_world(bounds, layout, mx, my) {
    const cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
    return [cx + (mx - layout.width / 2) / layout.scale, cy - (my - layout.height / 2) / layout.scale];
}

// The frame of the visible part (view: world x0 y0 x1 y1), in map pixels,
// cut to the map so that it stays visible at the edge.
function minimap_view_frame(bounds, layout, view) {
    const [a0, b0] = minimap_world_to_map(bounds, layout, view.x0, view.y1);
    const [a1, b1] = minimap_world_to_map(bounds, layout, view.x1, view.y0);
    const left = Math.max(0, Math.min(layout.width, a0)), right = Math.max(0, Math.min(layout.width, a1));
    const top = Math.max(0, Math.min(layout.height, b0)), bottom = Math.max(0, Math.min(layout.height, b1));
    return { left, top, width: right - left, height: bottom - top };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { minimap_bounds, minimap_layout, minimap_world_to_map, minimap_map_to_world, minimap_view_frame };
}

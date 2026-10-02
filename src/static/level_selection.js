// Working with a selection of placed sprites in the level editor: moving,
// copying, pasting, duplicating, deleting, moving to another layer and
// filling a rectangle. Pure functions on a layer's `sprites` array (placed
// sprites: [sprite id, x, y, placed properties?]); the editor shows the result.
//
// A layer holds at most one sprite per position (LayerStruct in
// level_editor.js keys its meshes by "x/y"). Whatever is moved, pasted or
// filled in wins: a sprite that was there before is replaced, exactly like
// painting over it with the pen.

function placed_position_key(placed) {
    return `${placed[1]}/${placed[2]}`;
}

function clone_placed(placed) {
    return JSON.parse(JSON.stringify(placed));
}

// Adds `incoming` to `kept`, replacing sprites of `kept` at the same
// positions. Returns { sprites, selection }: the indices of `incoming`.
function merge_placed(kept, incoming) {
    const taken = new Set(incoming.map(placed_position_key));
    const sprites = kept.filter(placed => !taken.has(placed_position_key(placed)));
    // two incoming sprites on one position: the later one wins
    const unique = new Map();
    for (const placed of incoming) unique.set(placed_position_key(placed), placed);
    const start = sprites.length;
    sprites.push(...unique.values());
    return { sprites, selection: [...unique.values()].map((_, i) => start + i) };
}

function split_selection(sprites, indices) {
    const chosen = new Set(indices.filter(i => Number.isInteger(i) && i >= 0 && i < sprites.length));
    return {
        selected: sprites.filter((_, i) => chosen.has(i)),
        rest: sprites.filter((_, i) => !chosen.has(i)),
    };
}

function move_placed(sprites, indices, dx, dy) {
    const { selected, rest } = split_selection(sprites, indices);
    if (!selected.length || (!dx && !dy)) return { sprites, selection: [...indices] };
    return merge_placed(rest, selected.map(placed => {
        const moved = clone_placed(placed);
        moved[1] = placed[1] + dx;
        moved[2] = placed[2] + dy;
        return moved;
    }));
}

function remove_placed(sprites, indices) {
    return { sprites: split_selection(sprites, indices).rest, selection: [] };
}

// The clipboard: copies of the selected sprites and their lower left corner.
function copy_placed(sprites, indices) {
    const { selected } = split_selection(sprites, indices);
    if (!selected.length) return null;
    return {
        items: selected.map(clone_placed),
        x: Math.min(...selected.map(placed => placed[1])),
        y: Math.min(...selected.map(placed => placed[2])),
    };
}

// Puts the clipboard's lower left corner at (x, y).
function paste_placed(sprites, clipboard, x, y) {
    if (!clipboard?.items?.length) return { sprites, selection: [] };
    return merge_placed(sprites, clipboard.items.map(placed => {
        const copy = clone_placed(placed);
        copy[1] = placed[1] - clipboard.x + x;
        copy[2] = placed[2] - clipboard.y + y;
        return copy;
    }));
}

// Moves the selected sprites from one layer's array to another's.
function move_placed_to_layer(from_sprites, indices, to_sprites) {
    const { selected, rest } = split_selection(from_sprites, indices);
    const merged = merge_placed(to_sprites, selected);
    return { from: rest, to: merged.sprites, selection: merged.selection };
}

// Fills the grid cells of a rectangle (corners included) with a sprite.
// grid: { width, height, x, y } as the level editor snaps to it.
function fill_placed(sprites, sprite_id, x0, y0, x1, y1, grid, max_cells = 4096) {
    const gw = grid.width, gh = grid.height;
    if (!(gw > 0) || !(gh > 0)) return { sprites, selection: [] };
    const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
    const incoming = [];
    for (let y = ya; y <= yb + 1e-9; y += gh) {
        for (let x = xa; x <= xb + 1e-9; x += gw) {
            incoming.push([sprite_id, Math.round(x), Math.round(y)]);
            if (incoming.length > max_cells) return { sprites, selection: [] };
        }
    }
    return merge_placed(sprites, incoming);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        placed_position_key, merge_placed, move_placed, remove_placed, copy_placed, paste_placed,
        move_placed_to_layer, fill_placed,
    };
}

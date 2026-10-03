// Working with a selection of placed sprites in the level editor: moving,
// copying, pasting, duplicating, deleting, moving to another layer, filling a
// rectangle (or drawing just its edge, or a line), selecting all copies of a
// sprite, replacing the selected sprites with another one and finding what
// is under a point in any layer.
// Pure functions on a layer's `sprites` array (placed
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

// Where copies go: half a grid step to the right and up, so they lie
// visibly on top of the originals without replacing any sprite (a layer
// holds one sprite per position). If that spot is taken too (a copy of a
// copy), the next half step, and so on. `layer`: the sprites already there,
// `items`: the copies at their original positions, step: half the grid,
// first: 1 for duplicating, 0 for pasting (the same spot when it is free).
function duplicate_offset(layer, items, step_x, step_y, first = 1, tries = 8) {
    const taken = new Set(layer.map(placed_position_key));
    let offset = [first * step_x, first * step_y];
    for (let k = first; k <= first + tries; k++) {
        offset = [k * step_x, k * step_y];
        const [dx, dy] = offset;
        if (!items.some(placed => taken.has(`${placed[1] + dx}/${placed[2] + dy}`))) return offset;
    }
    return offset;
}

// The lower left corner of the selected sprites (their smallest x and y).
function selection_anchor(sprites, indices) {
    const { selected } = split_selection(sprites, indices);
    if (!selected.length) return null;
    return [Math.min(...selected.map(placed => placed[1])), Math.min(...selected.map(placed => placed[2]))];
}

// On the grid, sprites stand at x = k · width + offset (their middle) and
// y = k · height + offset (their bottom), as the pen places them.
function grid_point(v, size, offset) {
    if (!(size > 0)) return Math.round(v);
    const o = ((offset % size) + size) % size;
    return Math.round((v - o) / size) * size + o;
}

// Dragging the selection by (dx, dy): its lower left corner lands on the
// grid, so a selection that is off the grid (a duplicate, or sprites placed
// with Shift) snaps back onto it. On the grid already: whole grid steps.
// grid: { width, height, x, y }.
function snapped_selection_delta(sprites, indices, dx, dy, grid) {
    const anchor = selection_anchor(sprites, indices);
    if (!anchor) return [dx, dy];
    return [grid_point(anchor[0] + dx, grid.width, grid.x ?? 0) - anchor[0],
        grid_point(anchor[1] + dy, grid.height, grid.y ?? 0) - anchor[1]];
}

// An arrow key (dir_x, dir_y: -1, 0 or 1): to the next grid position in that
// direction – a whole step on the grid, less when the selection is off it.
function grid_step_delta(sprites, indices, dir_x, dir_y, grid) {
    const anchor = selection_anchor(sprites, indices);
    if (!anchor) return [dir_x * grid.width, dir_y * grid.height];
    const next = (v, dir, size, offset) => {
        if (!dir || !(size > 0)) return 0;
        const o = ((offset % size) + size) % size;
        const k = (v - o) / size;
        const target = dir > 0 ? (Math.floor(k + 1e-9) + 1) * size + o : (Math.ceil(k - 1e-9) - 1) * size + o;
        return target - v;
    };
    return [next(anchor[0], dir_x, grid.width, grid.x ?? 0), next(anchor[1], dir_y, grid.height, grid.y ?? 0)];
}

// Moves the selected sprites from one layer's array to another's, shifted by
// (dx, dy): the level editor passes the difference in parallax offset so the
// sprites stay where they are on screen.
function move_placed_to_layer(from_sprites, indices, to_sprites, dx = 0, dy = 0) {
    const { selected, rest } = split_selection(from_sprites, indices);
    const merged = merge_placed(to_sprites, (dx || dy) ? selected.map(placed => {
        const moved = clone_placed(placed);
        moved[1] = placed[1] + dx;
        moved[2] = placed[2] + dy;
        return moved;
    }) : selected);
    return { from: rest, to: merged.sprites, selection: merged.selection };
}

// How far a sprite has to move when it goes from a layer with parallax
// p_from into one with p_to, so it stays where it is on screen: a layer is
// drawn shifted by camera × parallax. Rounded to whole grid steps, so the
// sprites stay on the grid (and to whole pixels without a grid).
function parallax_layer_offset(camera_x, camera_y, p_from, p_to, grid_width = 1, grid_height = 1) {
    const d = (p_from || 0) - (p_to || 0);
    const step = (v, g) => (g > 0 ? Math.round(v / g) * g : Math.round(v)) || 0;
    return [step(camera_x * d, grid_width), step(camera_y * d, grid_height)];
}

// The grid cells of a shape dragged from (x0, y0) to (x1, y1), both on the
// grid: 'rect' every cell of the rectangle (corners included), 'frame' only
// its edge, 'line' a straight line of cells (Bresenham, one cell per column
// or row, diagonal steps where needed). grid: { width, height } as the level
// editor snaps to it. null when there would be more than max_cells.
function shape_cells(shape, x0, y0, x1, y1, grid, max_cells = 4096) {
    const gw = grid.width, gh = grid.height;
    if (!(gw > 0) || !(gh > 0)) return [];
    const cells = [];
    if (shape === 'line') {
        const nx = Math.round((x1 - x0) / gw), ny = Math.round((y1 - y0) / gh);
        const steps = Math.max(Math.abs(nx), Math.abs(ny));
        if (steps + 1 > max_cells) return null;
        let cx = 0, cy = 0, err = Math.abs(nx) - Math.abs(ny);
        const sx = Math.sign(nx), sy = Math.sign(ny);
        for (let i = 0; i <= steps; i++) {
            cells.push([Math.round(x0 + cx * gw), Math.round(y0 + cy * gh)]);
            const e2 = 2 * err;
            if (e2 > -Math.abs(ny)) { err -= Math.abs(ny); cx += sx; }
            if (e2 < Math.abs(nx)) { err += Math.abs(nx); cy += sy; }
        }
        return cells;
    }
    const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
    const columns = Math.round((xb - xa) / gw) + 1, rows = Math.round((yb - ya) / gh) + 1;
    for (let row = 0; row < rows; row++) {
        // the edge: inside rows only have their first and last cell
        const inside = shape === 'frame' && row > 0 && row < rows - 1;
        for (let column = 0; column < columns; column += (inside && column === 0) ? Math.max(1, columns - 1) : 1) {
            cells.push([Math.round(xa + column * gw), Math.round(ya + row * gh)]);
            if (cells.length > max_cells) return null;
        }
    }
    return cells;
}

// Fills the cells of a shape (see shape_cells) with a sprite. Nothing
// happens when there are too many cells.
function place_shape(sprites, sprite_id, shape, x0, y0, x1, y1, grid, max_cells = 4096) {
    const cells = shape_cells(shape, x0, y0, x1, y1, grid, max_cells);
    if (!cells?.length) return { sprites, selection: [] };
    return merge_placed(sprites, cells.map(([x, y]) => [sprite_id, x, y]));
}

// Fills the grid cells of a rectangle (corners included) with a sprite.
function fill_placed(sprites, sprite_id, x0, y0, x1, y1, grid, max_cells = 4096) {
    return place_shape(sprites, sprite_id, 'rect', x0, y0, x1, y1, grid, max_cells);
}

// "Gleiche auswählen": every placed sprite of the layer that shows one of
// the sprites already selected (placed[0]: its sprite id). Sorted indices.
function same_sprite_indices(sprites, indices) {
    const { selected } = split_selection(sprites, indices);
    const wanted = new Set(selected.map(placed => String(placed[0])));
    const result = [];
    sprites.forEach((placed, i) => { if (wanted.has(String(placed[0]))) result.push(i); });
    return result;
}

// "Ersetzen durch": the selected sprites show another sprite, each where it
// was (the same anchor the pen uses: bottom centre on the grid point) and in
// the same place of the layer's array, so the selection stays the same.
// Placed settings stay for the traits the new sprite has too (a door that
// becomes another door keeps its Code and how it reacts) and are dropped
// for the others. keeps_trait(trait): does the new sprite have this trait?
// Returns { sprites, selection, changed }: changed are the indices that now
// show the new sprite and did not before.
function replace_placed(sprites, indices, sprite_id, keeps_trait) {
    const { selected } = split_selection(sprites, indices);
    const selection = [...new Set(indices)].filter(i => Number.isInteger(i) && i >= 0 && i < sprites.length);
    if (!selected.length || sprite_id === null || sprite_id === undefined) return { sprites, selection, changed: [] };
    const changed = [];
    const result = sprites.map((placed, i) => {
        if (!selection.includes(i) || String(placed[0]) === String(sprite_id)) return placed;
        changed.push(i);
        const replaced = [sprite_id, placed[1], placed[2]];
        const props = placed[3];
        if (props && typeof props === 'object') {
            const kept = {};
            for (const trait of Object.keys(props))
                if (typeof keeps_trait === 'function' && keeps_trait(trait)) kept[trait] = JSON.parse(JSON.stringify(props[trait]));
            if (Object.keys(kept).length) replaced.push(kept);
        }
        return replaced;
    });
    return changed.length ? { sprites: result, selection, changed } : { sprites, selection, changed };
}

// Double-click with the select tool: every placed sprite under a point, in
// every visible sprite layer, front to back – layer 0 is drawn in front, and
// within a layer the sprite drawn last comes first. point_of(li) gives the
// point in that layer's coordinates (each layer moves with its own Parallaxe);
// size_of(ref) gives { width, height } of a placed sprite's sprite, or null.
// Returns [{ layer_index, placed_index }].
function placed_sprites_at(layers, point_of, size_of) {
    const hits = [];
    (layers ?? []).forEach((layer, li) => {
        if (layer?.type !== 'sprites' || layer.properties?.visible === false) return;
        const [x, y] = point_of(li);
        for (let pi = (layer.sprites ?? []).length - 1; pi >= 0; pi--) {
            const placed = layer.sprites[pi];
            const size = size_of(placed[0]);
            if (size && x >= placed[1] - size.width / 2 && x <= placed[1] + size.width / 2 &&
                y >= placed[2] && y <= placed[2] + size.height)
                hits.push({ layer_index: li, placed_index: pi });
        }
    });
    return hits;
}

// Which of those hits a double-click picks: the front one, or – double-clicked
// again at the same spot – the one behind the last pick (and round again), so
// that something hidden behind a big picture can be reached too.
function next_pick(hits, last) {
    if (!hits.length) return null;
    const at = last ? hits.findIndex(h => h.layer_index === last.layer_index && h.placed_index === last.placed_index) : -1;
    return hits[at < 0 ? 0 : (at + 1) % hits.length];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        placed_position_key, merge_placed, move_placed, remove_placed, copy_placed, paste_placed,
        move_placed_to_layer, parallax_layer_offset, duplicate_offset, selection_anchor, grid_point,
        snapped_selection_delta, grid_step_delta, shape_cells, place_shape, fill_placed, same_sprite_indices, replace_placed,
        placed_sprites_at, next_pick,
    };
}

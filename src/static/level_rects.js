// Resizing a rectangle of a Hintergrund, Bereich or Bewegungsbereich in the
// level editor: eight handles, one at each corner and one in the middle of
// each edge. Pure geometry here; level_editor.js shows the handles.
//
// A rectangle is { left, bottom, width, height } in world coordinates (y up).
// A handle moves the edges it names: l(eft), r(ight), b(ottom), t(op).

const RECT_HANDLES = {
    tl: 'lt', t: 't', tr: 'rt',
    l: 'l', r: 'r',
    bl: 'lb', b: 'b', br: 'rb',
};

// The CSS cursor of each handle (y points up in the world, down on screen).
const RECT_HANDLE_CURSORS = {
    tl: 'nwse-resize', t: 'ns-resize', tr: 'nesw-resize',
    l: 'ew-resize', r: 'ew-resize',
    bl: 'nesw-resize', b: 'ns-resize', br: 'nwse-resize',
};

// Older games may hold a rectangle with a negative width or height (it was
// dragged inside out): the same area, the right way round.
function normalized_rect(rect) {
    const left = Math.min(rect.left, rect.left + rect.width), bottom = Math.min(rect.bottom, rect.bottom + rect.height);
    return { left, bottom, width: Math.abs(rect.width), height: Math.abs(rect.height) };
}

// Where a handle sits: on the edges it moves, in the middle of the others.
function rect_handle_point(rect, sides) {
    rect = normalized_rect(rect);
    const x = sides.includes('l') ? rect.left : sides.includes('r') ? rect.left + rect.width : rect.left + rect.width / 2;
    const y = sides.includes('b') ? rect.bottom : sides.includes('t') ? rect.bottom + rect.height : rect.bottom + rect.height / 2;
    return [x, y];
}

// The rectangle after its handle (sides) was dragged by (dx, dy) from `old`.
// snap(x, y) → [x, y] puts the moved corner on the grid (or leaves it).
// Edges that are not dragged stay exactly where they were, and the
// rectangle never gets smaller than min_size: a dragged edge stops there
// instead of turning the rectangle inside out.
function resized_rect(old, sides, dx, dy, snap = (x, y) => [x, y], min_size = 1) {
    old = normalized_rect(old);
    let x0 = old.left, x1 = old.left + old.width;
    let y0 = old.bottom, y1 = old.bottom + old.height;
    const moving_x = sides.includes('l') ? x0 : sides.includes('r') ? x1 : null;
    const moving_y = sides.includes('b') ? y0 : sides.includes('t') ? y1 : null;
    const [sx, sy] = snap((moving_x ?? 0) + dx, (moving_y ?? 0) + dy);
    if (sides.includes('l')) x0 = Math.min(sx, x1 - min_size);
    if (sides.includes('r')) x1 = Math.max(sx, x0 + min_size);
    if (sides.includes('b')) y0 = Math.min(sy, y1 - min_size);
    if (sides.includes('t')) y1 = Math.max(sy, y0 + min_size);
    return { left: x0, bottom: y0, width: x1 - x0, height: y1 - y0 };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RECT_HANDLES, RECT_HANDLE_CURSORS, normalized_rect, rect_handle_point, resized_rect };
}

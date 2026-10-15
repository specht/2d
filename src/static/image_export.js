// A sprite's pictures as a PNG file (Funktionen › Sprite › Als Bild
// speichern, or a right click on a sprite in the list): one frame, the
// frames of a state side by side, or every state of the sprite as one row. Pixel for pixel, with
// transparency, so the picture can be used elsewhere (a texture, a website)
// and read back with »Bilder öffnen« (image_import.js finds the frames of a
// strip). Only reads the game; editor-only, the engine never loads this file.

// A file name from a few parts (sprite, state, frame number): lower case,
// umlauts spelled out, everything else that is not a letter or digit becomes
// a dash.
function export_file_name(parts) {
    const words = parts
        .filter(p => p !== undefined && p !== null)
        .map(p => String(p).trim().toLowerCase()
            .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
        .filter(Boolean);
    return (words.join('-') || 'sprite') + '.png';
}

// Where each picture goes: rows of sizes ({ width, height }, or null for an
// empty frame) in cells as large as the largest picture, one row per entry.
function export_layout(rows) {
    let cell_width = 1, cell_height = 1, columns = 1;
    for (const row of rows) {
        columns = Math.max(columns, row.length);
        for (const size of row) {
            if (!size) continue;
            cell_width = Math.max(cell_width, size.width);
            cell_height = Math.max(cell_height, size.height);
        }
    }
    return {
        width: cell_width * columns,
        height: cell_height * Math.max(1, rows.length),
        cell_width, cell_height,
        positions: rows.map((row, r) => row.map((_, c) => ({ x: c * cell_width, y: r * cell_height }))),
    };
}

// The frames to save, as rows of data URLs: scope 'frame', 'state' or 'sprite'.
// The frame on the canvas comes from the canvas, so a stroke in progress is in.
function export_rows(game_data, canvas_state, scope) {
    const { sprite_index: si, state_index: sti, frame_index: fi } = canvas_state;
    const sprite = game_data?.sprites?.[si];
    if (!sprite) return [];
    const src = (s, f) => (s === sti && f === fi && canvas_state.current_src)
        ? canvas_state.current_src
        : (sprite.states[s]?.frames?.[f]?.src || null);
    if (scope === 'frame') return [[src(sti, fi)]];
    if (scope === 'state') return [sprite.states[sti].frames.map((_, f) => src(sti, f))];
    return sprite.states.map((state, s) => state.frames.map((_, f) => src(s, f)));
}

function export_load_image(src) {
    return new Promise((resolve) => {
        if (!src) { resolve(null); return; }
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = src;
    });
}

// scope: 'frame', 'state' or 'sprite'. at: { sprite_index, state_index,
// frame_index } of another sprite (the list's right-click menu); without it,
// what the canvas shows.
async function export_sprite_images(scope, at = null) {
    const on_canvas = !at || (at.sprite_index === canvas?.sprite_index &&
        at.state_index === canvas?.state_index && at.frame_index === canvas?.frame_index);
    const si = at?.sprite_index ?? canvas?.sprite_index;
    const sti = at?.state_index ?? canvas?.state_index;
    const fi = at?.frame_index ?? canvas?.frame_index;
    const sprite = game?.data?.sprites?.[si];
    if (!sprite || sti === null || sti === undefined || fi === null || fi === undefined) return;
    const rows = export_rows(game.data, {
        sprite_index: si, state_index: sti, frame_index: fi,
        current_src: on_canvas && typeof canvas.toUrl === 'function' ? canvas.toUrl() : null,
    }, scope);
    const images = await Promise.all(rows.map(row => Promise.all(row.map(export_load_image))));
    const layout = export_layout(images.map(row => row.map(image => image ? { width: image.naturalWidth, height: image.naturalHeight } : null)));

    const target = document.createElement('canvas');
    target.width = layout.width;
    target.height = layout.height;
    const context = target.getContext('2d');
    context.imageSmoothingEnabled = false;
    images.forEach((row, r) => row.forEach((image, c) => {
        if (image) context.drawImage(image, layout.positions[r][c].x, layout.positions[r][c].y);
    }));

    const name = sprite_label(sprite, si);
    const state_name = sprite.states[sti]?.properties?.name;
    const parts = scope === 'frame' ? [name, state_name, `${fi + 1}`]
        : scope === 'state' ? [name, state_name] : [name];
    const blob = await new Promise(resolve => target.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = $('<a>').attr({ href: url, download: export_file_name(parts) }).css('display', 'none').appendTo(document.body);
    link[0].click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

if (typeof module !== 'undefined') module.exports = { export_file_name, export_layout, export_rows };

// Ein ganzes Spiel an eine Palette anpassen (Funktionen → Palette, and the
// checkbox in "Palette wählen").
//
// "Sprite an Palette anpassen" changes the frame that is being drawn. For one
// style everywhere, the whole game is converted: every frame of every sprite
// (dithered like that command, or each pixel to its nearest colour) and every
// colour of the levels – the background colour, the Hintergrund layers' colours
// and gradients and the colour of effects (snow, stars, light rays …). Flat
// colours always take the nearest palette colour (no pattern); their alpha
// stays. The recipe build converts recipe scenes with `szene.palette` the same
// way (rezepte/tools/game.mjs).

function palette_hex_to_rgb(hex) {
    const h = String(hex ?? '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return null;
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

// The palette colour nearest to a colour (#rrggbb or #rrggbbaa: the alpha stays).
function nearest_palette_hex(hex, rgb_list) {
    const c = palette_hex_to_rgb(hex);
    if (!c || !rgb_list?.length) return hex;
    let best = rgb_list[0], bd = Infinity;
    for (const p of rgb_list) {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bd) { bd = d; best = p; }
    }
    const alpha = String(hex).replace('#', '').slice(6, 8);
    return '#' + best.map(v => v.toString(16).padStart(2, '0')).join('') + alpha;
}

// Every colour a level stores itself; returns how many changed.
function palettize_level_colors(level, rgb_list) {
    let changed = 0;
    const swap = (hex) => {
        const out = nearest_palette_hex(hex, rgb_list);
        if (out !== hex) changed++;
        return out;
    };
    if (level?.properties?.background_color) level.properties.background_color = swap(level.properties.background_color);
    for (const layer of level?.layers ?? []) {
        if (layer?.type !== 'backdrop') continue;
        if (Array.isArray(layer.colors))
            for (const point of layer.colors) if (Array.isArray(point) && typeof point[0] === 'string') point[0] = swap(point[0]);
        if (typeof layer.color === 'string') layer.color = swap(layer.color);
    }
    return changed;
}

// Pixels to their nearest palette colour (no pattern); transparent stays.
function palettize_pixels_nearest(data, rgb_list) {
    const cache = new Map();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        let best = cache.get(key);
        if (!best) {
            let bd = Infinity;
            for (const p of rgb_list) {
                const d = (p[0] - data[i]) ** 2 + (p[1] - data[i + 1]) ** 2 + (p[2] - data[i + 2]) ** 2;
                if (d < bd) { bd = d; best = p; }
            }
            cache.set(key, best);
        }
        data[i] = best[0]; data[i + 1] = best[1]; data[i + 2] = best[2];
    }
}

// ------------------------------------------------------------ the studio

const PALETTE_METHODS = {
    ordered: 'mit gleichmäßigem Muster (Ordered)',
    diffusion: 'mit verteiltem Muster (Diffusion)',
    atkinson: 'mit verteiltem Muster (Atkinson)',
    nearest: 'ohne Muster – jede Farbe zur ähnlichsten',
};

async function palettize_frame_src(src, method, rgb_list) {
    const image = await load_img_from_src(src);
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    if (method === 'nearest') palettize_pixels_nearest(data.data, rgb_list);
    else new DitherJS().ditherImageData(data, { step: 1, algorithm: method, palette: rgb_list });
    ctx.putImageData(data, 0, 0);
    return c.toDataURL('image/png');
}

function palette_progress_modal() {
    window.paletteProgressModal ??= new ModalDialog({
        title: 'Spiel umfärben',
        width: '420px',
        max_width: '90vw',
        body: `<div class="collab-dialog"><p id="palette_progress_text" class="collab-lead"></p></div>`,
        footer: [
            { type: 'button', label: 'Rückgängig machen', enter: false, callback: (modal) => { undo_game_palette(); modal.dismiss(); } },
            { type: 'button', label: 'Fertig', color: 'green', callback: (modal) => modal.dismiss() },
        ],
    });
    return window.paletteProgressModal;
}

// Converts the whole game to the palette that is chosen for drawing.
async function apply_palette_to_game(method = 'ordered') {
    if (window.collaboration?.code) {
        const modal = palette_progress_modal();
        modal.show();
        $('#palette_progress_text').text('Während ihr gemeinsam bearbeitet, kann nicht das ganze Spiel auf einmal umgefärbt werden. Färbe die Sprites einzeln um (Sprite an Palette anpassen).');
        modal.dialog.find('.modal-footer button').first().hide();
        return;
    }
    const rgb_list = window.current_palette_rgb;
    if (!rgb_list?.length) return;
    // one step back: everything as it was
    game.palette_undo = JSON.stringify({ sprites: game.data.sprites.map(s => s.states.map(st => st.frames.map(f => f.src))), levels: game.data.levels });
    const modal = palette_progress_modal();
    modal.show();
    const buttons = modal.dialog.find('.modal-footer button').hide();
    const frames = [];
    game.data.sprites.forEach((sprite, si) => sprite.states.forEach(state => state.frames.forEach(frame => frames.push({ si, frame }))));
    for (let i = 0; i < frames.length; i++) {
        if (i % 8 === 0) $('#palette_progress_text').text(`Die Sprites werden umgefärbt … (${i} von ${frames.length} Bildern)`);
        frames[i].frame.src = await palettize_frame_src(frames[i].frame.src, method, rgb_list);
    }
    let colors = 0;
    for (const level of game.data.levels) colors += palettize_level_colors(level, rgb_list);
    refresh_after_recolor();
    $('#palette_progress_text').text(`Fertig: ${frames.length === 1 ? '1 Bild' : `${frames.length} Bilder`} und ${colors === 1 ? '1 Farbe' : `${colors} Farben`} der Hintergründe haben jetzt Farben aus der Palette. Gefällt es dir nicht, mach es rückgängig.`);
    buttons.show();
}

function undo_game_palette() {
    if (!game.palette_undo) return;
    const before = JSON.parse(game.palette_undo);
    game.palette_undo = null;
    game.data.sprites.forEach((sprite, si) => sprite.states.forEach((state, sti) => state.frames.forEach((frame, fi) => {
        const src = before.sprites[si]?.[sti]?.[fi];
        if (src) frame.src = src;
    })));
    before.levels.forEach((level, li) => {
        const now = game.data.levels[li];
        if (!now) return;
        now.properties = level.properties;
        now.layers = level.layers;
    });
    refresh_after_recolor();
}

function refresh_after_recolor() {
    for (let si = 0; si < game.data.sprites.length; si++) game.update_material_for_sprite(si);
    game.refresh_frames_on_screen();
    const { sprite_index: si, state_index: sti, frame_index: fi } = canvas;
    if (si !== null && sti !== null && fi !== null) {
        canvas.detachSprite();
        canvas.attachSprite(si, sti, fi, () => { });
    }
    const editor = game.level_editor;
    if (editor) {
        editor.refresh_sprite_widget?.();
        editor.reload_level_keeping_view?.(editor.level_index);
    }
}

if (typeof module !== 'undefined') module.exports = { nearest_palette_hex, palettize_level_colors, palettize_pixels_nearest };

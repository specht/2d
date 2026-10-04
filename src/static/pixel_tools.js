// Pure pixel helpers for the sprite editor (canvas.js), tested in
// test/pixel_tools.test.cjs.
//
// Spiegelnd zeichnen (M): everything the pen and the shape tools draw is
// drawn a second time, mirrored at the middle of the sprite – for faces,
// figures, vehicles that look the same on both sides.
//
// Farbe ersetzen (fill tool with Shift or Strg): every pixel of exactly the
// clicked colour gets the new one – in the frame, or in every frame of the
// sprite – to make a blue variant of a red enemy in one click.
//
// Umriss (Funktionen → Sprite): a one-pixel outline in the current colour
// around everything drawn, in one frame, a state or the whole sprite.

// The points of a mask and their mirror images (x → width − 1 − x), each once.
function mirror_points(mask, width) {
    const seen = new Set();
    const result = [];
    const add = (x, y) => {
        const key = `${x}|${y}`;
        if (seen.has(key)) return;
        seen.add(key);
        result.push([x, y]);
    };
    for (const [x, y] of mask) {
        add(x, y);
        add(width - 1 - x, y);
    }
    return result;
}

// Where the mirror axis lies, in pixels from the left edge (between two
// columns for an even width, through the middle column for an odd one).
function mirror_axis(width) {
    return width / 2;
}

// RGBA pixel data (Uint8ClampedArray or Array): every pixel equal to `from`
// becomes `to`. Returns how many pixels changed.
function replace_color_in(data, from, to) {
    let count = 0;
    for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i] === from[0] && data[i + 1] === from[1] && data[i + 2] === from[2] && data[i + 3] === from[3]) {
            // fully transparent pixels are all the same, whatever their RGB
            data[i] = to[0]; data[i + 1] = to[1]; data[i + 2] = to[2]; data[i + 3] = to[3];
            count += 1;
        } else if (from[3] === 0 && data[i + 3] === 0) {
            data[i] = to[0]; data[i + 1] = to[1]; data[i + 2] = to[2]; data[i + 3] = to[3];
            count += 1;
        }
    }
    return count;
}

// Umriss: every empty (fully transparent) pixel next to a drawn one – left,
// right, above or below – gets the colour: a one-pixel outline around
// everything in the picture. Returns how many pixels changed.
function outline_pixels(data, width, height, rgba) {
    const drawn = (x, y) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] > 0;
    const targets = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (drawn(x, y)) continue;
            if (drawn(x - 1, y) || drawn(x + 1, y) || drawn(x, y - 1) || drawn(x, y + 1)) targets.push((y * width + x) * 4);
        }
    }
    for (const i of targets) {
        data[i] = rgba[0]; data[i + 1] = rgba[1]; data[i + 2] = rgba[2]; data[i + 3] = rgba[3];
    }
    return targets.length;
}

// 0xRRGGBBAA (the editor's colour format) → [r, g, b, a]
function rgba_of(color) {
    return [(color >>> 24) & 0xff, (color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff];
}

// ------------------------------------------------------------ colour ramps
// Shades as pixel artists make them: darker shades turn cooler (the hue moves
// towards blue), lighter ones warmer (towards yellow) and a little paler –
// a ramp looks alive instead of grey. hsl: { h: 0…360, s: 0…1, l: 0…1 };
// returns 2·steps + 1 colours from the darkest to the lightest, hsl in the middle.
function hue_toward(h, target, amount) {
    const d = ((target - h + 540) % 360) - 180;
    return (h + Math.sign(d) * Math.min(Math.abs(d), amount) + 360) % 360;
}

function shade_ramp(hsl, steps = 5) {
    const out = [];
    for (let k = -steps; k <= steps; k++) {
        const t = Math.abs(k) / steps;
        if (k < 0) out.push({ h: hue_toward(hsl.h, 240, 28 * t), s: Math.min(1, hsl.s + 0.15 * t), l: hsl.l * (1 - 0.82 * t) });
        else if (k > 0) out.push({ h: hue_toward(hsl.h, 60, 22 * t), s: hsl.s * (1 - 0.35 * t), l: hsl.l + (1 - hsl.l) * 0.85 * t });
        else out.push({ ...hsl });
    }
    return out;
}

// ------------------------------------------------------------ selections
// A selection is a mask: one flag per pixel (alpha > 0 of the selection
// bitmap). The pixels are RGBA arrays of width × height (ImageData.data).
// Every function returns new arrays and leaves its input alone.

function selected_at(mask, i) {
    return mask[i * 4 + 3] > 0;
}

// The smallest box around the selection, or null when nothing is selected.
function selection_box(mask, width, height) {
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            if (selected_at(mask, y * width + x)) {
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
    return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

// The selected pixels as a clipboard: the box, its pixels (transparent
// outside the selection) and which of them are selected.
function copy_selected(pixels, mask, width, height) {
    const box = selection_box(mask, width, height);
    if (!box) return null;
    const data = new Uint8ClampedArray(box.width * box.height * 4);
    const selected = new Uint8Array(box.width * box.height);
    for (let y = 0; y < box.height; y++)
        for (let x = 0; x < box.width; x++) {
            const from = (box.y + y) * width + box.x + x, to = y * box.width + x;
            if (!selected_at(mask, from)) continue;
            selected[to] = 1;
            for (let k = 0; k < 4; k++) data[to * 4 + k] = pixels[from * 4 + k];
        }
    return { x: box.x, y: box.y, width: box.width, height: box.height, data, selected };
}

// The selected pixels made transparent.
function clear_selected(pixels, mask) {
    const out = new Uint8ClampedArray(pixels);
    for (let i = 0; i < out.length / 4; i++)
        if (selected_at(mask, i)) out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = out[i * 4 + 3] = 0;
    return out;
}

// A clipboard put down with its corner at (x, y): its drawn pixels cover
// what is there (transparent ones do not erase), and the selection is
// exactly the pasted area. Returns { pixels, mask } (mask as RGBA, alpha 1).
function paste_selected(pixels, width, height, clip, x, y) {
    const out = new Uint8ClampedArray(pixels);
    const mask = new Uint8ClampedArray(width * height * 4);
    for (let cy = 0; cy < clip.height; cy++)
        for (let cx = 0; cx < clip.width; cx++) {
            const px = x + cx, py = y + cy;
            if (px < 0 || py < 0 || px >= width || py >= height) continue;
            const from = cy * clip.width + cx, to = py * width + px;
            if (!clip.selected[from]) continue;
            mask[to * 4 + 3] = 1;
            if (clip.data[from * 4 + 3] === 0) continue;
            for (let k = 0; k < 4; k++) out[to * 4 + k] = clip.data[from * 4 + k];
        }
    return { pixels: out, mask };
}

// The selected pixels moved by (dx, dy): lifted, the place cleared, put down.
function move_selected(pixels, mask, width, height, dx, dy) {
    const clip = copy_selected(pixels, mask, width, height);
    if (!clip) return { pixels: new Uint8ClampedArray(pixels), mask: new Uint8ClampedArray(mask) };
    return paste_selected(clear_selected(pixels, mask), width, height, clip, clip.x + dx, clip.y + dy);
}

// The selection mirrored inside its box: axis 'x' (left ↔ right) or 'y'.
function flip_selected(pixels, mask, width, height, axis) {
    const clip = copy_selected(pixels, mask, width, height);
    if (!clip) return { pixels: new Uint8ClampedArray(pixels), mask: new Uint8ClampedArray(mask) };
    const flipped = { ...clip, data: new Uint8ClampedArray(clip.data.length), selected: new Uint8Array(clip.selected.length) };
    for (let y = 0; y < clip.height; y++)
        for (let x = 0; x < clip.width; x++) {
            const from = y * clip.width + x;
            const to = axis === 'y' ? (clip.height - 1 - y) * clip.width + x : y * clip.width + (clip.width - 1 - x);
            flipped.selected[to] = clip.selected[from];
            for (let k = 0; k < 4; k++) flipped.data[to * 4 + k] = clip.data[from * 4 + k];
        }
    return paste_selected(clear_selected(pixels, mask), width, height, flipped, clip.x, clip.y);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mirror_points, mirror_axis, replace_color_in, outline_pixels, rgba_of,
        shade_ramp, hue_toward, selection_box, copy_selected, clear_selected, paste_selected, move_selected, flip_selected };
}

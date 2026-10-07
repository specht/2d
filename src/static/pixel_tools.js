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

// ------------------------------------------------------------ hue
// The hue h (0 … 360) moved by at most `amount` degrees towards `target`, the short way round.
function hue_toward(h, target, amount) {
    const d = ((target - h + 540) % 360) - 180;
    return (h + Math.sign(d) * Math.min(Math.abs(d), amount) + 360) % 360;
}

// ------------------------------------------------------------ OKLCH
// The colour variations under the palette (studio.js setCurrentColor) are made
// in OKLCH: L is how light a colour looks (0 … 1), C how colourful (0 = grey),
// h its hue in degrees. Unlike HSL, changing one of them leaves the others as
// they look: "paler" does not make a colour lighter, a darker step looks as
// much darker for every hue. Colours are [r, g, b] with 0 … 255.

const OKLCH_GREY = 0.02;     // below this chroma a colour counts as grey (no hue to speak of)

function srgb_to_linear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linear_to_srgb(c) {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

function srgb_to_oklch([r, g, b]) {
    const R = srgb_to_linear(r), G = srgb_to_linear(g), B = srgb_to_linear(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return { L, C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360 };
}

// linear sRGB, possibly outside 0 … 1 (a colour the screen cannot show)
function oklch_to_linear(L, C, h) {
    const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}

// The most chroma the screen can show at this lightness and hue.
function oklch_max_chroma(L, h) {
    const inside = (C) => oklch_to_linear(L, C, h).every(v => v >= -1e-5 && v <= 1 + 1e-5);
    let lo = 0, hi = 0.4;
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (inside(mid)) lo = mid; else hi = mid;
    }
    return lo;
}

// The lightness at which this hue can be most colourful (the tip of the
// screen's colours: a yellow's is light, a blue's dark), and how colourful.
// The most chroma rises with the lightness up to the tip and falls after it.
function oklch_cusp(h) {
    let lo = 0.05, hi = 0.995;
    for (let i = 0; i < 40; i++) {
        const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
        if (oklch_max_chroma(a, h) < oklch_max_chroma(b, h)) lo = a; else hi = b;
    }
    const L = (lo + hi) / 2;
    return { L, C: oklch_max_chroma(L, h) };
}

// The lightness nearest to L at which hue h can be C colourful: L itself where
// it can; an orange as colourful as a bright yellow has to be darker, a cyan
// as colourful as a blue lighter (toward the tip, as little as needed).
function lightness_for_chroma(L, C, h) {
    if (oklch_max_chroma(L, h) >= C) return L;
    const cusp = oklch_cusp(h);
    if (cusp.C <= C) return cusp.L;
    let short = L, enough = cusp.L;
    for (let i = 0; i < 24; i++) {
        const mid = (short + enough) / 2;
        if (oklch_max_chroma(mid, h) >= C) enough = mid; else short = mid;
    }
    return enough;
}

// [r, g, b] of an OKLCH colour; a colour the screen cannot show keeps its
// lightness and hue and loses chroma until it can (as CSS Color 4 maps colours).
function oklch_to_srgb(L, C, h) {
    L = Math.min(1, Math.max(0, L));
    C = Math.min(Math.max(0, C), oklch_max_chroma(L, h));
    return oklch_to_linear(L, C, h).map(linear_to_srgb);
}

// n positions from lo to hi in even steps; the one nearest to `base` becomes
// `base` itself, so the colour that was chosen is part of the row (not always
// in the middle: a light colour has more room to get darker than lighter).
// Returns { values, base_index }.
function steps_around(base, lo, hi, n = 11) {
    const values = Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
    let base_index = 0;
    values.forEach((v, i) => { if (Math.abs(v - base) < Math.abs(values[base_index] - base)) base_index = i; });
    values[base_index] = base;
    return { values, base_index };
}

const VARIATION_L_MIN = 0.15, VARIATION_L_MAX = 0.97;

// The variations of a colour ([r, g, b]); every row has 11 colours, and
// *_index says where the colour itself is:
//   similar        the hue a little to either side, as colourful as the colour
//                  and as light where the screen allows: a bright yellow's
//                  neighbours on the way to red are darker oranges and reds, not
//                  pale peach (keeping the lightness made them all alike).
//                  The hue step grows as the colour gets greyer, so neighbours
//                  always look different (a grey gets cooler and warmer tints)
//   light_shadow   from dark to light in even steps, as pixel artists shade:
//                  darker turns cooler (towards blue-violet), lighter warmer
//                  (towards yellow) and paler
//   grid           3 rows × 11 columns: the same lightness steps, from the most
//                  colourful the screen can show (top) to pale (bottom) –
//                  darker and duller (the usual shadow) is one click
function color_variations(rgb) {
    const base = srgb_to_oklch(rgb);
    const grey = base.C < OKLCH_GREY;
    // a grey has (almost) no hue of its own: its tints go warm
    const tint_hue = base.C < 0.005 ? 75 : base.h;

    const similar = [];
    for (let k = -5; k <= 5; k++) {
        if (k === 0) { similar.push([...rgb]); continue; }
        if (grey) similar.push(oklch_to_srgb(base.L, 0.011 * Math.abs(k), k < 0 ? 250 : 70));
        else {
            // five steps reach the neighbouring colour family (yellow → red)
            const step = Math.min(30, Math.max(8, (0.05 / base.C) * 180 / Math.PI));
            const h = base.h + step * k;
            similar.push(oklch_to_srgb(lightness_for_chroma(base.L, base.C, h), base.C, h));
        }
    }

    const lightness = steps_around(base.L, VARIATION_L_MIN, VARIATION_L_MAX);
    const light_shadow = lightness.values.map((L, i) => {
        if (i === lightness.base_index) return [...rgb];
        const darker = L < base.L;
        const t = darker ? (base.L - L) / Math.max(0.01, base.L - VARIATION_L_MIN)
            : (L - base.L) / Math.max(0.01, VARIATION_L_MAX - base.L);
        if (grey) return oklch_to_srgb(L, 0.025 * t, darker ? 265 : 85);
        const h = hue_toward(base.h, darker ? 275 : 95, (darker ? 30 : 25) * t);
        return oklch_to_srgb(L, darker ? base.C * (1 + 0.1 * t) : base.C * (1 - 0.6 * t), h);
    });

    // colourfulness relative to what the screen can show at each lightness;
    // three levels from pale to the most, the colour's own one among them
    const relative = grey ? 0 : Math.min(1, base.C / Math.max(1e-6, oklch_max_chroma(base.L, base.h)));
    const levels = steps_around(relative, 0.2, 1, 3);
    const grid = [2, 1, 0].map(li => lightness.values.map((L, ci) => {
        const own_row = li === levels.base_index;
        if (own_row && ci === lightness.base_index) return [...rgb];
        // greys: their own row stays grey, the rows above are warmer tints
        if (grey) return oklch_to_srgb(L, own_row ? base.C : 0.03 * levels.values[li], tint_hue);
        return oklch_to_srgb(L, levels.values[li] * oklch_max_chroma(L, base.h), base.h);
    }));

    return {
        similar, similar_index: 5,
        light_shadow, light_shadow_index: lightness.base_index,
        grid, grid_index: [2 - levels.base_index, lightness.base_index],
    };
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
        hue_toward, srgb_to_oklch, oklch_to_srgb, oklch_max_chroma, oklch_cusp, lightness_for_chroma, steps_around, color_variations,
        selection_box, copy_selected, clear_selected, paste_selected, move_selected, flip_selected };
}

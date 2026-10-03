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

// 0xRRGGBBAA (the editor's colour format) → [r, g, b, a]
function rgba_of(color) {
    return [(color >>> 24) & 0xff, (color >>> 16) & 0xff, (color >>> 8) & 0xff, color & 0xff];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mirror_points, mirror_axis, replace_color_in, rgba_of };
}

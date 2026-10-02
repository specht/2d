// Bilder einfügen (sprite editor: Strg+V, or dropping an image file).
//
// Children often paste pixel art they found on the web: a big JPEG in which
// every art pixel is a 10×10 square, on a white or grey-white checkerboard
// background that only pretends to be transparent, sometimes a whole film
// strip of an animation. Pasting that as it is gives a huge, blurry sprite.
// So the picture is analysed first and a dialog shows the guess, which the
// child can correct before anything is imported:
//
// - the background: one colour (or the two of a fake checkerboard) all around
//   the border, removed by flood fill from the border (white eyes inside the
//   figure stay)
// - the pixel size: how many screen pixels make one art pixel (edges of the
//   art lie on a regular grid; the guess must reproduce the picture)
// - the frames: a strip or grid of frames (the sprite's size fits, or empty
//   columns between figures, or square frames side by side)
//
// Nothing is scaled except by the detected whole art pixels, and nothing is
// cut off without saying so: when the frames do not match the sprite's size,
// the dialog warns and offers to enlarge the sprite, to place the frames
// bottom-centred, or to make a new sprite.
//
// The analysis works on plain RGBA arrays ({ width, height, data }), so it
// can be tested without a browser.

const IMAGE_IMPORT_MAX_PIXELS = 4096 * 4096;
const IMAGE_IMPORT_EDGE = 60;        // colour difference (sum of RGBA) that counts as an edge
const IMAGE_IMPORT_BG_TOLERANCE = 56;

function rgba_image(width, height, data = null) {
    return { width, height, data: data ?? new Uint8ClampedArray(width * height * 4) };
}

function pixel_difference(d, i, j) {
    // fully transparent pixels are all the same, whatever their colour
    if (d[i + 3] < 16 && d[j + 3] < 16) return 0;
    return Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) + Math.abs(d[i + 3] - d[j + 3]);
}

function color_difference(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs((a[3] ?? 255) - (b[3] ?? 255));
}

// ------------------------------------------------------------ background

// The colours around the border: one (a plain background) or two (a fake
// checkerboard). null if the border is transparent already or too colourful.
function detect_background(img) {
    const { width: w, height: h, data: d } = img;
    const ring = [];
    const add = (x, y) => ring.push((y * w + x) * 4);
    for (let x = 0; x < w; x++) { add(x, 0); if (h > 1) add(x, h - 1); }
    for (let y = 1; y < h - 1; y++) { add(0, y); if (w > 1) add(w - 1, y); }
    const transparent = ring.filter(i => d[i + 3] < 16).length;
    if (transparent > ring.length * 0.5) return null;
    const clusters = [];
    for (const i of ring) {
        if (d[i + 3] < 16) continue;
        const c = [d[i], d[i + 1], d[i + 2], d[i + 3]];
        const found = clusters.find(k => color_difference(k.color, c) <= IMAGE_IMPORT_BG_TOLERANCE);
        if (found) found.count++;
        else clusters.push({ color: c, count: 1 });
    }
    clusters.sort((a, b) => b.count - a.count);
    const opaque = ring.length - transparent;
    const one = clusters[0]?.count ?? 0, two = one + (clusters[1]?.count ?? 0);
    if (one >= opaque * 0.85) return { colors: [clusters[0].color] };
    if (two >= opaque * 0.85 && clusters[1].count >= opaque * 0.15) return { colors: [clusters[0].color, clusters[1].color] };
    return null;
}

// Makes the background transparent: a flood fill from the border through
// every pixel close to one of its colours.
function remove_background(img, colors, tolerance = IMAGE_IMPORT_BG_TOLERANCE) {
    const { width: w, height: h } = img;
    const d = new Uint8ClampedArray(img.data);
    const near = (i) => d[i + 3] < 16 || colors.some(c => Math.abs(d[i] - c[0]) + Math.abs(d[i + 1] - c[1]) + Math.abs(d[i + 2] - c[2]) <= tolerance);
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (x, y) => {
        const p = y * w + x;
        if (seen[p]) return;
        seen[p] = 1;
        if (near(p * 4)) stack.push(p);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    let removed = 0;
    while (stack.length) {
        const p = stack.pop();
        d[p * 4 + 3] = 0;
        removed++;
        const x = p % w, y = (p - x) / w;
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
    }
    return { image: rgba_image(w, h, d), removed };
}

// ------------------------------------------------------------ pixel size

// How many edges lie between column x-1 and x (and row y-1 and y).
function edge_profiles(img) {
    const { width: w, height: h, data: d } = img;
    const px = new Float64Array(w), py = new Float64Array(h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (x > 0 && pixel_difference(d, i, i - 4) > IMAGE_IMPORT_EDGE) px[x]++;
            if (y > 0 && pixel_difference(d, i, i - w * 4) > IMAGE_IMPORT_EDGE) py[y]++;
        }
    }
    return { px, py };
}

// The share of all edges that lie on a grid with spacing s (best offset).
function grid_capture(profile, s) {
    let total = 0;
    for (const v of profile) total += v;
    if (total === 0) return { fraction: 1, offset: 0, total };
    const window = s >= 5 ? 1 : 0;
    let best = { fraction: -1, offset: 0, total };
    for (let o = 0; o < Math.ceil(s); o++) {
        let captured = 0, last = -1;
        for (let k = 0; ; k++) {
            const c = Math.round(o + k * s);
            if (c - window >= profile.length) break;
            for (let p = Math.max(c - window, last + 1); p <= c + window && p < profile.length; p++) {
                captured += profile[p];
                last = p;
            }
        }
        if (captured / total > best.fraction) best = { fraction: captured / total, offset: o, total };
    }
    return best;
}

// Cell boundaries along one axis: 0, the grid lines, size. Slices at the
// ends narrower than half a cell are dropped (a few pixels of margin).
function cell_bounds(size, s, offset) {
    const lines = [];
    for (let k = 0; ; k++) {
        const c = Math.round(offset + k * s);
        if (c >= size) break;
        if (c > 0) lines.push(c);
    }
    let bounds = [0, ...lines, size];
    if (bounds.length > 2 && bounds[1] - bounds[0] < s * 0.5) bounds = bounds.slice(1);
    if (bounds.length > 2 && bounds[bounds.length - 1] - bounds[bounds.length - 2] < s * 0.5) bounds = bounds.slice(0, -1);
    return bounds;
}

// One art pixel per cell: the median colour of the cell's inside (JPEG noise
// sits at the cell's edges); transparent if most of it is.
function downsample(img, sx, sy, ox, oy) {
    const { width: w, data: d } = img;
    const bx = cell_bounds(img.width, sx, ox), by = cell_bounds(img.height, sy, oy);
    const out = rgba_image(bx.length - 1, by.length - 1);
    const values = [[], [], [], []];
    for (let cy = 0; cy < by.length - 1; cy++) {
        for (let cx = 0; cx < bx.length - 1; cx++) {
            const x0 = bx[cx], x1 = bx[cx + 1], y0 = by[cy], y1 = by[cy + 1];
            const mx = Math.floor((x1 - x0) * 0.2), my = Math.floor((y1 - y0) * 0.2);
            for (const v of values) v.length = 0;
            let transparent = 0, n = 0;
            for (let y = y0 + my; y < y1 - my; y++) {
                for (let x = x0 + mx; x < x1 - mx; x++) {
                    const i = (y * w + x) * 4;
                    n++;
                    if (d[i + 3] < 128) { transparent++; continue; }
                    for (let c = 0; c < 4; c++) values[c].push(d[i + c]);
                }
            }
            const o = (cy * out.width + cx) * 4;
            if (n === 0 || transparent * 2 >= n) continue;   // stays transparent
            for (let c = 0; c < 4; c++) {
                values[c].sort((a, b) => a - b);
                out.data[o + c] = values[c][values[c].length >> 1];
            }
            if (out.data[o + 3] > 230) out.data[o + 3] = 255;
        }
    }
    return { image: out, bx, by };
}

// How well the art pixels reproduce the picture: the share of (sampled)
// pixels that are clearly different from their cell's colour.
function reconstruction_error(img, small, bx, by) {
    const { width: w, height: h, data: d } = img;
    const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 200000)));
    let bad = 0, n = 0;
    let cx = 0;
    for (let y = by[0]; y < by[by.length - 1]; y += step) {
        let cy = 0;
        while (cy < by.length - 2 && y >= by[cy + 1]) cy++;
        cx = 0;
        for (let x = bx[0]; x < bx[bx.length - 1]; x += step) {
            while (cx < bx.length - 2 && x >= bx[cx + 1]) cx++;
            const i = (y * w + x) * 4, j = (cy * small.width + cx) * 4;
            n++;
            const ta = d[i + 3] < 128, tb = small.data[j + 3] < 128;
            if (ta || tb) { if (ta !== tb) bad++; continue; }
            if (Math.abs(d[i] - small.data[j]) + Math.abs(d[i + 1] - small.data[j + 1]) + Math.abs(d[i + 2] - small.data[j + 2]) > 96) bad++;
        }
    }
    return n ? bad / n : 0;
}

// How much better than chance a grid with spacing s catches the edges: 1 =
// every edge lies on a grid line, 0 = no better than any grid would.
function grid_score(capture, s) {
    if (capture.total === 0) return 1;
    const chance = Math.min(1, (2 * (s >= 5 ? 1 : 0) + 1) / s);
    return chance >= 1 ? 0 : (capture.fraction - chance) / (1 - chance);
}

// The pixel size: among the grids that catch the art's edges about as well as
// the best one, the biggest that also reproduces the picture (half of the true
// size catches the edges just as well, but reproduces nothing new). 1 if the
// picture is not enlarged pixel art.
function detect_pixel_scale(img) {
    const { px, py } = edge_profiles(img);
    const max = Math.min(64, Math.floor(Math.min(img.width, img.height) / 2));
    const candidates = [];
    for (let s = 2; s <= max; s++) candidates.push(s);
    for (let s = 2.25; s < Math.min(12, max); s += 0.25) if (s % 1) candidates.push(s);
    const scored = candidates.map(s => {
        const gx = grid_capture(px, s), gy = grid_capture(py, s);
        return { s, gx, gy, score: Math.min(grid_score(gx, s), grid_score(gy, s)), none: gx.total + gy.total === 0 };
    });
    if (!scored.length || scored[0].none) return { scale: 1, offset_x: 0, offset_y: 0 };
    const best = Math.max(...scored.map(c => c.score));
    const good = scored.filter(c => c.score >= Math.max(0.45, best - 0.12)).sort((a, b) => b.s - a.s);
    for (const c of good) {
        if (Math.ceil(img.width / c.s) < 2 || Math.ceil(img.height / c.s) < 2) continue;
        const { image: small, bx, by } = downsample(img, c.s, c.s, c.gx.offset, c.gy.offset);
        if (small.width < 1 || small.height < 1) continue;
        if (reconstruction_error(img, small, bx, by) <= 0.05)
            return { scale: c.s, offset_x: c.gx.offset, offset_y: c.gy.offset };
    }
    return { scale: 1, offset_x: 0, offset_y: 0 };
}

// JPEG noise: colours that are nearly the same become exactly the same (the
// most frequent of them).
function merge_similar_colors(img, tolerance = 30) {
    const d = new Uint8ClampedArray(img.data);
    const counts = new Map();
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 16) continue;
        const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => [k >> 16 & 255, k >> 8 & 255, k & 255]);
    if (sorted.length > 4096) return rgba_image(img.width, img.height, d);   // a photo: leave it
    const representatives = [];
    const map = new Map();
    for (const c of sorted) {
        const rep = representatives.find(r => Math.abs(r[0] - c[0]) + Math.abs(r[1] - c[1]) + Math.abs(r[2] - c[2]) <= tolerance);
        map.set((c[0] << 16) | (c[1] << 8) | c[2], rep ?? c);
        if (!rep) representatives.push(c);
    }
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 16) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
        const rep = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        d[i] = rep[0]; d[i + 1] = rep[1]; d[i + 2] = rep[2];
    }
    return rgba_image(img.width, img.height, d);
}

// ------------------------------------------------------------ frames

function column_empty(img, x, y0 = 0, y1 = img.height) {
    for (let y = y0; y < y1; y++) if (img.data[(y * img.width + x) * 4 + 3] >= 16) return false;
    return true;
}

function row_empty(img, y, x0 = 0, x1 = img.width) {
    for (let x = x0; x < x1; x++) if (img.data[(y * img.width + x) * 4 + 3] >= 16) return false;
    return true;
}

// Runs of non-empty columns (or rows): the figures standing side by side.
function content_runs(length, empty) {
    const runs = [];
    let start = -1;
    for (let i = 0; i <= length; i++) {
        const filled = i < length && !empty(i);
        if (filled && start < 0) start = i;
        if (!filled && start >= 0) { runs.push([start, i]); start = -1; }
    }
    return runs;
}

// One axis of a sheet: figures side by side at even distances are frames
// (count, start, size: start may be negative or the frames may reach past
// the picture – that part is transparent); otherwise one frame around all
// content (a transparent margin is not part of it).
function axis_layout(length, empty, sprite_size, filled = null) {
    // runs closer than 3 pixels belong together (a dashed light beam)
    const runs = [];
    for (const run of content_runs(length, empty)) {
        if (runs.length && run[0] - runs[runs.length - 1][1] < 3) runs[runs.length - 1][1] = run[1];
        else runs.push([...run]);
    }
    if (!runs.length) return { count: 1, start: 0, size: length, even: false };
    const first = runs[0][0], last = runs[runs.length - 1][1];
    if (runs.length >= 2) {
        const centers = runs.map(([a, b]) => (a + b) / 2);
        const p = (centers[centers.length - 1] - centers[0]) / (runs.length - 1);
        const widest = Math.max(...runs.map(([a, b]) => b - a));
        const even = centers.every((c, i) => Math.abs(c - (centers[0] + i * p)) <= Math.max(1.5, p * 0.15));
        if (even && p >= 2 && widest <= p + 0.5) {
            let size = Math.round(p);
            if (sprite_size && Math.abs(size - sprite_size) <= 1) size = sprite_size;
            return { count: runs.length, start: Math.round(centers[0] - size / 2), size, even: true };
        }
    }
    // figures touching each other, each about the sprite's size: decided by
    // detect_frames (it needs the other direction, too)
    // frames that look alike: the content repeats every p pixels
    if (filled && !(sprite_size && Math.round((last - first) / sprite_size) >= 2 && Math.abs(last - first - Math.round((last - first) / sprite_size) * sprite_size) <= 3)) {
        const period = repeating_period(filled, first, last, sprite_size);
        if (period) return { ...period, even: true };
    }
    return { count: 1, start: first, size: last - first, even: false };
}

// How much of a column (or row) is filled, compared with the one p pixels
// further: frames of one animation look alike, so the profile repeats.
function repeating_period(filled, first, last, sprite_size) {
    const span = last - first;
    const sim = [];
    for (let p = 1; p <= span / 1.5; p++) {
        let same = 0, all = 0;
        for (let x = first; x + p < last; x++) {
            same += Math.min(filled[x], filled[x + p]);
            all += Math.max(filled[x], filled[x + p]);
        }
        sim[p] = all ? same / all : 0;
    }
    // a real repeat is a peak: in between, the frames do not match (a plain
    // shape matches itself the better, the smaller the shift – no peak)
    const peaks = [];
    for (let p = 8; p < sim.length; p++) {
        if (sim[p] < 0.7) continue;
        let low = 1;
        for (let q = Math.ceil(p / 2); q < p; q++) low = Math.min(low, sim[q]);
        const peak = sim[p] - low;
        if (peak >= 0.2) peaks.push({ p, peak });
    }
    if (!peaks.length) return null;
    // the shortest repeat that is clearly there (an animation of 4 frames also
    // repeats after 2 of them)
    const strongest = Math.max(...peaks.map(c => c.peak));
    const best = (sprite_size && peaks.find(c => Math.abs(c.p - sprite_size) <= 1)) || peaks.find(c => c.peak >= strongest * 0.6);
    let p = best.p;
    if (sprite_size && Math.abs(p - sprite_size) <= 1) p = sprite_size;
    // where the frames begin: their borders cut through as little as possible
    let start = first, cut = Infinity;
    for (let o = first - p + 1; o <= first; o++) {
        let c = 0;
        for (let x = o + p; x < last; x += p) c += filled[x] ?? 0;
        // equally good: the content in the middle of its frames
        const centred = Math.abs((o + Math.ceil((last - o) / p) * p - last) - (first - o));
        if (c < cut || (c === cut && centred < start_centred)) { cut = c; start = o; var start_centred = centred; }
    }
    const count = Math.ceil((last - start) / p);
    return count >= 2 ? { count, start, size: p } : null;
}

// How many filled pixels each column (axis 'x') or row ('y') has.
function filled_profile(img, axis) {
    const out = new Float64Array(axis === 'x' ? img.width : img.height);
    for (let y = 0; y < img.height; y++)
        for (let x = 0; x < img.width; x++)
            if (img.data[(y * img.width + x) * 4 + 3] >= 16) out[axis === 'x' ? x : y]++;
    return out;
}

// The frame layout: { cols, rows, x0, y0, width, height, why }, the frames
// left to right, top to bottom, each width × height, the first at x0/y0.
function detect_frames(img, sprite_width = null, sprite_height = null) {
    const { width: w, height: h } = img;
    // a clean sheet in the sprite's size
    if (sprite_width && sprite_height && w % sprite_width === 0 && h % sprite_height === 0 && (w > sprite_width || h > sprite_height))
        return { cols: w / sprite_width, rows: h / sprite_height, x0: 0, y0: 0, width: sprite_width, height: sprite_height, why: 'size' };
    const ax = axis_layout(w, x => column_empty(img, x), sprite_width, filled_profile(img, 'x'));
    const ay = axis_layout(h, y => row_empty(img, y), sprite_height, filled_profile(img, 'y'));
    // figures touching each other, each about the sprite's size (a strip: the
    // other direction must fit into the sprite)
    for (const [axis, size, other, other_size] of [[ax, sprite_width, ay, sprite_height], [ay, sprite_height, ax, sprite_width]]) {
        if (axis.even || !size || !other_size || other.size > other_size) continue;
        const n = Math.round(axis.size / size);
        if (n >= 2 && Math.abs(axis.size - n * size) <= 3) {
            axis.start -= Math.floor((n * size - axis.size) / 2);
            Object.assign(axis, { count: n, size, even: true });
        }
    }
    // smaller than the sprite: the sprite's size, standing at the bottom, in the middle
    if (sprite_width && !ax.even && ax.size < sprite_width) { ax.start -= Math.floor((sprite_width - ax.size) / 2); ax.size = sprite_width; }
    if (sprite_height && !ay.even && ay.size < sprite_height) { ay.start -= sprite_height - ay.size; ay.size = sprite_height; }
    if (ax.even || ay.even)
        return { cols: ax.count, rows: ay.count, x0: ax.start, y0: ay.start, width: ax.size, height: ay.size, why: 'gaps' };
    // figures touching each other: square frames side by side
    if (ax.size > ay.size && ay.size > 0 && ax.size % ay.size === 0)
        return { cols: ax.size / ay.size, rows: 1, x0: ax.start, y0: ay.start, width: ay.size, height: ay.size, why: 'square' };
    if (ay.size > ax.size && ax.size > 0 && ay.size % ax.size === 0)
        return { cols: 1, rows: ay.size / ax.size, x0: ax.start, y0: ay.start, width: ax.size, height: ax.size, why: 'square' };
    return { cols: 1, rows: 1, x0: ax.start, y0: ay.start, width: ax.size, height: ay.size, why: 'single' };
}

// A layout with the columns and rows the child chose: the content divided
// into equal frames (a little transparent room added where it does not
// divide evenly – nothing is cut off).
function layout_for(img, cols, rows) {
    const ax = axis_layout(img.width, x => column_empty(img, x), null);
    const ay = axis_layout(img.height, y => row_empty(img, y), null);
    const span_x = ax.even ? ax.count * ax.size : ax.size, from_x = ax.start;
    const span_y = ay.even ? ay.count * ay.size : ay.size, from_y = ay.start;
    const width = Math.ceil(span_x / cols), height = Math.ceil(span_y / rows);
    return {
        cols, rows, width, height, why: 'manual',
        x0: from_x - Math.floor((width * cols - span_x) / 2),
        y0: from_y - (height * rows - span_y),
    };
}

// The frames of a layout; outside the picture is transparent. Empty frames
// (an unfinished last row of a sheet) can be left out.
function split_frames(img, layout, { skip_empty = true } = {}) {
    const { cols, rows, x0, y0, width: fw, height: fh } = layout;
    if (!(fw > 0 && fh > 0)) return [];
    const frames = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const f = rgba_image(fw, fh);
            let filled = false;
            for (let y = 0; y < fh; y++) {
                const sy = y0 + r * fh + y;
                if (sy < 0 || sy >= img.height) continue;
                for (let x = 0; x < fw; x++) {
                    const sx = x0 + c * fw + x;
                    if (sx < 0 || sx >= img.width) continue;
                    const s = (sy * img.width + sx) * 4, t = (y * fw + x) * 4;
                    for (let k = 0; k < 4; k++) f.data[t + k] = img.data[s + k];
                    if (img.data[s + 3] >= 16) filled = true;
                }
            }
            if (filled || !skip_empty) frames.push(f);
        }
    }
    return frames;
}

// Crops a transparent margin.
function trim_transparent(img) {
    const xr = content_runs(img.width, x => column_empty(img, x));
    const yr = content_runs(img.height, y => row_empty(img, y));
    if (!xr.length || !yr.length) return img;
    const x0 = xr[0][0], x1 = xr[xr.length - 1][1], y0 = yr[0][0], y1 = yr[yr.length - 1][1];
    if (x0 === 0 && y0 === 0 && x1 === img.width && y1 === img.height) return img;
    const out = rgba_image(x1 - x0, y1 - y0);
    for (let y = y0; y < y1; y++) {
        const src = (y * img.width + x0) * 4;
        out.data.set(img.data.subarray(src, src + (x1 - x0) * 4), (y - y0) * out.width * 4);
    }
    return out;
}

// A frame in another size: bottom-centred like Größe ändern does it; what
// does not fit is cut off.
function place_frame(img, width, height) {
    const out = rgba_image(width, height);
    const dx = Math.floor((width - img.width) / 2), dy = height - img.height;
    for (let y = 0; y < img.height; y++) {
        const ty = y + dy;
        if (ty < 0 || ty >= height) continue;
        for (let x = 0; x < img.width; x++) {
            const tx = x + dx;
            if (tx < 0 || tx >= width) continue;
            const s = (y * img.width + x) * 4, t = (ty * width + tx) * 4;
            for (let c = 0; c < 4; c++) out.data[t + c] = img.data[s + c];
        }
    }
    return out;
}

// The whole analysis: the dialog's first guess.
function analyze_pasted_image(img, sprite_width, sprite_height) {
    const background = detect_background(img);
    let work = img;
    if (background) work = remove_background(img, background.colors).image;
    const scale = detect_pixel_scale(work);
    const settings = { remove_background: !!background, ...scale, merge_colors: scale.scale > 1, skip_empty: true, cols: null, rows: null };
    const art = pasted_art(img, settings, background);
    const layout = detect_frames(art, sprite_width, sprite_height);
    return { background, settings: { ...settings, cols: layout.cols, rows: layout.rows }, layout };
}

// The picture as art pixels: background removed, pixel size undone, colours tidied.
function pasted_art(img, settings, background) {
    let work = img;
    if (settings.remove_background && background) work = remove_background(work, background.colors).image;
    if (settings.scale > 1) work = downsample(work, settings.scale, settings.scale, settings.offset_x, settings.offset_y).image;
    if (settings.merge_colors) work = merge_similar_colors(work);
    return work;
}

// Applies the settings → { art, layout, frames }. The detected layout is used
// while the columns and rows are the ones it found.
function process_pasted_image(img, settings, background, sprite_width = null, sprite_height = null) {
    const art = pasted_art(img, settings, background);
    let layout = detect_frames(art, sprite_width, sprite_height);
    if (settings.cols && settings.rows && (settings.cols !== layout.cols || settings.rows !== layout.rows))
        layout = layout_for(art, settings.cols, settings.rows);
    const frames = split_frames(art, layout, { skip_empty: settings.skip_empty });
    return { art, layout, frames };
}

// ------------------------------------------------------------ the dialog

function rgba_to_data_url(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return c.toDataURL('image/png');
}

async function rgba_from_data_url(src) {
    const image = await load_img_from_src(src);
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    return rgba_image(c.width, c.height, ctx.getImageData(0, 0, c.width, c.height).data);
}

function rgba_is_empty(img) {
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i] >= 16) return false;
    return true;
}

const IMAGE_IMPORT_TARGETS = {
    replace: 'den aktuellen Frame ersetzen (weitere Frames dahinter)',
    append: 'hinten an diesen Zustand anhängen',
    state: 'als neuen Zustand',
    sprite: 'als neues Sprite',
};

class ImageImportDialog {
    constructor() {
        this.modal = new ModalDialog({
            title: 'Bild einfügen',
            width: '860px',
            max_width: '94vw',
            body: `
                <div class="image-import">
                    <div class="image-import-previews">
                        <figure><div class="image-import-original"><img id="image_import_original" alt=""></div><figcaption>Eingefügtes Bild</figcaption></figure>
                        <figure><div class="image-import-result"><canvas id="image_import_preview"></canvas></div><figcaption id="image_import_result_caption">So wird es</figcaption></figure>
                    </div>
                    <div class="image-import-strip" id="image_import_strip"></div>
                    <p class="image-import-summary" id="image_import_summary"></p>
                    <div class="image-import-settings">
                        <label class="image-import-field"><input type="checkbox" id="image_import_background"> Hintergrund entfernen <span id="image_import_bg_colors"></span></label>
                        <label class="image-import-field">Pixelgröße <input type="number" id="image_import_scale" min="1" max="64" step="0.25"> <span class="image-import-hint">so viele Bildpunkte sind ein Pixel deiner Grafik</span></label>
                        <label class="image-import-field">Frames <input type="number" id="image_import_cols" min="1" max="64" step="1"> nebeneinander × <input type="number" id="image_import_rows" min="1" max="64" step="1"> untereinander</label>
                        <label class="image-import-field"><input type="checkbox" id="image_import_merge"> ähnliche Farben vereinheitlichen</label>
                        <label class="image-import-field">Einfügen <select id="image_import_target"></select></label>
                    </div>
                    <div class="image-import-warning" id="image_import_warning"></div>
                </div>
            `,
            footer: [
                { type: 'button', label: 'Abbrechen', callback: (modal) => { this.stop(); modal.dismiss(); } },
                { type: 'button', label: 'Einfügen', color: 'green', callback: () => this.apply() },
            ],
        });
        this.import_button = this.modal.dialog.find('.modal-footer button.green');
        const recompute = () => this.recompute();
        $('#image_import_background, #image_import_merge').on('change', recompute);
        $('#image_import_scale').on('change', () => {
            this.settings.scale = Math.max(1, Math.min(64, Number($('#image_import_scale').val()) || 1));
            // a new pixel size: find the grid's offset again and the frames anew
            const work = this.settings.remove_background && this.background ? remove_background(this.image, this.background.colors).image : this.image;
            if (this.settings.scale > 1) {
                const { px, py } = edge_profiles(work);
                this.settings.offset_x = grid_capture(px, this.settings.scale).offset;
                this.settings.offset_y = grid_capture(py, this.settings.scale).offset;
            }
            this.settings.cols = this.settings.rows = null;
            this.recompute();
        });
        $('#image_import_cols, #image_import_rows').on('change', recompute);
        $('#image_import_target').on('change', () => { this.target = $('#image_import_target').val(); this.render_warning(); });
        this.modal.dialog.on('change', 'input[name=image_import_fit]', () => { this.fit = $('input[name=image_import_fit]:checked').val(); });
    }

    async open(image) {
        this.image = image;
        const si = canvas.sprite_index, sti = canvas.state_index;
        const sprite = game.data.sprites[si];
        this.sprite = { width: sprite.width, height: sprite.height };
        // a sprite with nothing drawn yet takes the size of what is pasted
        this.fresh = sprite.states.length === 1 && sprite.states[0].frames.length === 1 &&
            rgba_is_empty(await rgba_from_data_url(sprite.states[0].frames[0].src));
        this.state_empty = sprite.states[sti].frames.length === 1 &&
            rgba_is_empty(await rgba_from_data_url(sprite.states[sti].frames[0].src));
        const analysis = analyze_pasted_image(image, sprite.width, sprite.height);
        this.background = analysis.background;
        this.settings = analysis.settings;
        this.detected = { scale: analysis.settings.scale, background: !!analysis.background };
        this.target = null;
        this.fit = null;
        const original = document.createElement('canvas');
        original.width = image.width;
        original.height = image.height;
        original.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
        $('#image_import_original').attr('src', original.toDataURL('image/png'))
            .toggleClass('pixelated', image.width <= 256 && image.height <= 256);
        $('#image_import_background').prop('checked', this.settings.remove_background).prop('disabled', !this.background);
        $('#image_import_bg_colors').empty();
        for (const c of this.background?.colors ?? [])
            $('<span>').addClass('image-import-swatch').css('background', `rgb(${c[0]}, ${c[1]}, ${c[2]})`).appendTo('#image_import_bg_colors');
        $('#image_import_scale').val(this.settings.scale);
        $('#image_import_merge').prop('checked', this.settings.merge_colors);
        $('#image_import_cols').val(this.settings.cols);
        $('#image_import_rows').val(this.settings.rows);
        this.modal.show();
        this.recompute();
    }

    recompute() {
        const s = this.settings;
        s.remove_background = $('#image_import_background').prop('checked') && !!this.background;
        s.merge_colors = $('#image_import_merge').prop('checked');
        if (s.cols !== null) {
            s.cols = Math.max(1, Math.min(64, Math.round(Number($('#image_import_cols').val()) || 1)));
            s.rows = Math.max(1, Math.min(64, Math.round(Number($('#image_import_rows').val()) || 1)));
        }
        this.result = process_pasted_image(this.image, s, this.background, this.sprite.width, this.sprite.height);
        if (s.cols === null) { s.cols = this.result.layout.cols; s.rows = this.result.layout.rows; }
        $('#image_import_cols').val(s.cols);
        $('#image_import_rows').val(s.rows);
        this.render_preview();
        this.render_targets();
        this.render_warning();
    }

    frame_size() {
        return { width: this.result.layout.width, height: this.result.layout.height };
    }

    render_preview() {
        const frames = this.result.frames;
        const { width: fw, height: fh } = this.frame_size();
        const preview = $('#image_import_preview')[0];
        const zoom = Math.max(1, Math.floor(Math.min(240 / Math.max(fw, 1), 180 / Math.max(fh, 1))));
        preview.width = fw;
        preview.height = fh;
        $(preview).css({ width: `${fw * zoom}px`, height: `${fh * zoom}px` });
        this.preview_frames = frames.map(f => new ImageData(new Uint8ClampedArray(f.data), f.width, f.height));
        this.stop();
        let i = 0;
        const draw = () => {
            if (!this.preview_frames.length) return;
            preview.getContext('2d').clearRect(0, 0, fw, fh);
            preview.getContext('2d').putImageData(this.preview_frames[i % this.preview_frames.length], 0, 0);
            i++;
        };
        draw();
        if (frames.length > 1) this.timer = setInterval(() => { if (!this.modal.dialog.is(':visible')) return this.stop(); draw(); }, 125);
        $('#image_import_result_caption').text(frames.length > 1 ? `So wird es: ${frames.length} Frames` : 'So wird es');
        const strip = $('#image_import_strip').empty();
        if (frames.length > 1) {
            const thumb = Math.max(1, Math.floor(48 / Math.max(fw, fh)));
            for (const f of frames.slice(0, 32)) {
                const c = $('<canvas>').addClass('image-import-thumb').attr({ width: f.width, height: f.height })
                    .css({ width: `${f.width * thumb}px`, height: `${f.height * thumb}px` }).appendTo(strip)[0];
                c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.data), f.width, f.height), 0, 0);
            }
            if (frames.length > 32) $('<span>').text(`… und ${frames.length - 32} mehr`).appendTo(strip);
        }
        // what was recognised
        const parts = [];
        if (this.settings.remove_background && this.background)
            parts.push(this.background.colors.length > 1 ? 'Karomuster-Hintergrund entfernt' : 'Hintergrund entfernt');
        if (this.settings.scale > 1)
            parts.push(`jeder Pixel war ${String(this.settings.scale).replace('.', ',')}-fach vergrößert`);
        parts.push(frames.length === 1 ? `1 Frame, ${fw}×${fh} Pixel` : `${frames.length} Frames à ${fw}×${fh} Pixel`);
        $('#image_import_summary').text(`${this.settings.scale === this.detected.scale ? 'Erkannt' : 'Eingestellt'}: ${parts.join(' · ')}`);
    }

    render_targets() {
        const n = this.result.frames.length;
        const { width: fw, height: fh } = this.frame_size();
        const fits = fw === this.sprite.width && fh === this.sprite.height;
        if (!this.target) {
            if (this.fresh) this.target = 'replace';
            else if (!fits) this.target = 'sprite';
            else if (n === 1 || this.state_empty) this.target = 'replace';
            else this.target = 'state';
        }
        const select = $('#image_import_target').empty();
        for (const [key, label] of Object.entries(IMAGE_IMPORT_TARGETS)) {
            const text = n === 1 && key === 'replace' ? 'den aktuellen Frame ersetzen' : label;
            $('<option>').val(key).text(text).appendTo(select);
        }
        select.val(this.target);
    }

    // The size check: frames that do not match the sprite.
    render_warning() {
        const box = $('#image_import_warning').empty().removeClass('error');
        const { width: fw, height: fh } = this.frame_size();
        const n = this.result.frames.length;
        let ok = n > 0;
        if (!n) box.addClass('error').append($('<p>').text('Nach dem Entfernen des Hintergrunds ist nichts mehr übrig. Schalte „Hintergrund entfernen“ aus.'));
        if (fw > MAX_DIMENSION || fh > MAX_DIMENSION) {
            box.addClass('error').append($('<p>').text(`Ein Sprite kann höchstens ${MAX_DIMENSION}×${MAX_DIMENSION} Pixel groß sein – das hier wäre ${fw}×${fh}. Stell die Pixelgröße ein oder teile das Bild in mehr Frames.`));
            ok = false;
        } else if (n && (fw > 128 || fh > 128)) {
            box.append($('<p>').text(`${fw}×${fh} Pixel ist sehr groß für ein Sprite (die meisten sind 16 bis 48 Pixel groß). Zeigt das Bild vielleicht grobe Pixel, die stark vergrößert sind? Dann stell die Pixelgröße passend ein.`));
        }
        const into_sprite = this.target !== 'sprite';
        const mismatch = n && (fw !== this.sprite.width || fh !== this.sprite.height);
        if (ok && into_sprite && mismatch) {
            if (this.fresh && this.target === 'replace') {
                box.append($('<p>').text(`Dein Sprite ist noch leer und bekommt die Größe des Bildes: ${fw}×${fh} Pixel.`));
                this.fit = 'adopt';
            } else {
                box.append($('<p>').addClass('image-import-mismatch')
                    .text(`Achtung: Die Frames sind ${fw}×${fh} Pixel groß, dein Sprite ist ${this.sprite.width}×${this.sprite.height} Pixel groß.`));
                const grow_w = Math.max(fw, this.sprite.width), grow_h = Math.max(fh, this.sprite.height);
                const choices = [];
                if (grow_w !== this.sprite.width || grow_h !== this.sprite.height)
                    choices.push(['grow', `Sprite auf ${grow_w}×${grow_h} Pixel vergrößern (alle Frames bekommen unten mittig mehr Platz)`]);
                choices.push(['fit', fw > this.sprite.width || fh > this.sprite.height
                    ? `in ${this.sprite.width}×${this.sprite.height} einpassen (unten mittig – was übersteht, wird abgeschnitten)`
                    : `in ${this.sprite.width}×${this.sprite.height} einsetzen (unten mittig)`]);
                if (!choices.some(([key]) => key === this.fit)) this.fit = choices[0][0];
                for (const [key, label] of choices) {
                    $('<label>').addClass('image-import-choice')
                        .append($('<input type="radio" name="image_import_fit">').val(key).prop('checked', this.fit === key))
                        .append(document.createTextNode(' ' + label)).appendTo(box);
                }
                box.append($('<p>').addClass('image-import-hint').text('Oder wähle oben „als neues Sprite“ – dann bleibt dein Sprite, wie es ist.'));
            }
        } else if (!mismatch) {
            this.fit = null;
        }
        box.toggle(box.children().length > 0);
        this.import_button.prop('disabled', !ok);
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }

    async apply() {
        const frames = this.result.frames;
        if (!frames.length) return;
        const si = canvas.sprite_index, sti = canvas.state_index, fi = canvas.frame_index;
        const { width: fw, height: fh } = this.frame_size();
        this.stop();
        this.modal.dismiss();
        if (this.target === 'sprite') {
            const sprite = { width: fw, height: fh, states: [{ properties: { name: 'eingefügt' }, frames: frames.map(f => ({ src: rgba_to_data_url(f) })) }] };
            assign_new_game_id(game.data, 'sprites', sprite);
            game.add_sprites([sprite]);
            return;
        }
        const sprite = game.data.sprites[si];
        canvas.append_to_undo_stack();   // the frame as it was: one click on it brings it back
        let size = { width: sprite.width, height: sprite.height };
        if (fw !== sprite.width || fh !== sprite.height) {
            if (this.fit === 'adopt') size = { width: fw, height: fh };
            if (this.fit === 'grow') {
                size = { width: Math.max(fw, sprite.width), height: Math.max(fh, sprite.height) };
                for (const state of sprite.states)
                    for (const frame of state.frames)
                        frame.src = rgba_to_data_url(place_frame(await rgba_from_data_url(frame.src), size.width, size.height));
            }
        }
        const srcs = frames.map(f => rgba_to_data_url(f.width === size.width && f.height === size.height ? f : place_frame(f, size.width, size.height)));
        sprite.width = size.width;
        sprite.height = size.height;
        let show = { sti, fi };
        if (this.target === 'replace') {
            sprite.states[sti].frames.splice(fi, 1, ...srcs.map(src => ({ src })));
        } else if (this.target === 'append') {
            show.fi = sprite.states[sti].frames.length;
            sprite.states[sti].frames.push(...srcs.map(src => ({ src })));
        } else if (this.target === 'state') {
            sprite.states.push({ properties: { name: 'eingefügt' }, frames: srcs.map(src => ({ src })) });
            game.fix_game_data();
            show = { sti: sprite.states.length - 1, fi: 0 };
        }
        game.update_geometry_for_sprite(si);
        if (typeof show_sprite_again === 'function') show_sprite_again(si, show.sti, show.fi);
        else { canvas.detachSprite(); canvas.attachSprite(si, show.sti, show.fi, () => game.refresh_frames_on_screen()); }
    }
}

// From the clipboard or a dropped file: a Blob with a picture.
async function open_image_import(blob) {
    let bitmap;
    try {
        bitmap = await createImageBitmap(blob);
    } catch (e) {
        return;   // not a picture the browser can read
    }
    if (bitmap.width * bitmap.height > IMAGE_IMPORT_MAX_PIXELS) {
        window.alert('Das Bild ist zu groß zum Einfügen.');
        return;
    }
    const c = document.createElement('canvas');
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const image = rgba_image(c.width, c.height, ctx.getImageData(0, 0, c.width, c.height).data);
    window.image_import_dialog ??= new ImageImportDialog();
    await window.image_import_dialog.open(image);
}

if (typeof module !== 'undefined') module.exports = {
    rgba_image, detect_background, remove_background, edge_profiles, grid_capture, downsample,
    detect_pixel_scale, merge_similar_colors, detect_frames, layout_for, split_frames, trim_transparent, place_frame,
    analyze_pasted_image, pasted_art, process_pasted_image, IMAGE_IMPORT_MAX_PIXELS,
};

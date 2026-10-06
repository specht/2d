// The game's HUD: what the player needs to know, drawn into the game's canvas
// as pixel art (app.js draw_hud, after the scene and the CRT pass, like the
// speech bubbles) – no bar across the top of the screen any more.
//
// It shows only what the game uses, with the game's own pictures:
//   lives    hearts top left – the picture of the sprite that gives lives
//            (not one that is only sold in a shop; else a built-in heart);
//            only if the game starts with more than one life or something
//            gives lives
//   energy   a bar under them; only with "Energie anzeigen" and something
//            in the game that hurts (a trap, an enemy) or gives energy
//   coins    top right – the picture of the sprite that gives points and
//            the number; only if something gives points
//   items    under them, what stays for the whole game (inventory.js) – each
//            thing's picture, "× n" when there are several; a weapon with its
//            number key in front and a frame while it is chosen; only if
//            something "bleibt fürs ganze Spiel"
//   level    the level's name for a moment when it starts (if it has one)
// Prices in a shop are drawn above what is for sale (price_tag), in the same
// pixels: the coin's picture and the number.
// Changes are animated: a lost heart shakes and empties, damage leaves a
// white piece on the energy bar that drains away, coins count up and their
// picture hops.
//
// Everything is measured in HUD pixels; one HUD pixel is hud_scale(…) screen
// pixels, a whole number, so every edge stays sharp. The built-in heart and
// coin are drawn in HUD pixels with an ink outline. The game's own pictures
// (a heart, a coin, the items) keep all their pixels: each picture pixel is a
// whole number of screen pixels, as many as fit a box of ICON_BOX HUD pixels
// (hud_sprite_scale) – smaller than the HUD's pixels for a big sprite, but
// never a picture with pixels left out. Text is drawn at its own size in
// screen pixels (a pixel font drawn one pixel per font pixel falls apart);
// a number beside a picture is centred on it by the height of its digits.

const HUD = {
    MARGIN: 6,          // from the edge of the screen
    GAP: 2,             // between hearts
    ICON_MAX: 13,       // the built-in pictures: bigger ones at half size
    ICON_BOX: 13,       // the game's pictures fit this box (hud_sprite_scale)
    BAR_WIDTH: 46,
    BAR_HEIGHT: 5,
    HEARTS_MAX: 8,      // more lives: one heart and "× n"
    NAME_SECONDS: 2.4,  // how long the level's name stays
    NAME_DELAY: 0.25,
    STRIP: 44,          // how tall the HUD's part of the screen is
    STRIP_ITEMS: 62,    // … with a row of items
    ITEM_GAP: 4,        // between items
    CHOSEN: '#ffcd75',  // the frame and number of a chosen weapon
    INK: '#1a1c2c',     // outlines
    EMPTY: '#3b4260',   // a lost heart, the empty bar
    TEXT: '#f4f4f4',
    DRAIN: '#f4f4f4',
    BAR_COLORS: [[0.5, '#a7f070'], [0.25, '#ffcd75'], [0, '#ef5d57']],
};

// A heart for games without a sprite that gives lives (7 × 6, outlined below).
const HUD_HEART = [
    '.##.##.',
    '#%#####',
    '#######',
    '.#####.',
    '..###..',
    '...#...',
];
const HUD_HEART_COLORS = { '#': '#e04e5e', '%': '#ffb0a0' };

// A coin for price tags in games where nothing gives points (6 × 6).
const HUD_COIN = [
    '.####.',
    '#%%###',
    '#%####',
    '######',
    '######',
    '.####.',
];
const HUD_COIN_COLORS = { '#': '#ffcd75', '%': '#fff5c0' };

// ------------------------------------------------------------ what to show
// data: the game as the engine holds it (placed sprites refer to sprite
// indices). Returns { lives: { show, sprite }, energy: { show }, coins: { show, sprite },
// items: { show } }.
function hud_plan(data) {
    const sprites = data?.sprites ?? [];
    const props = data?.properties ?? {};
    const placed = new Map();
    // placed with a Preis (a shop): a potion that sells one life more is not
    // what a life looks like
    const sold = new Map();
    for (const level of data?.levels ?? [])
        for (const layer of level?.layers ?? [])
            for (const p of layer?.sprites ?? []) {
                if (!Array.isArray(p) || !Number.isInteger(p[0])) continue;
                placed.set(p[0], (placed.get(p[0]) ?? 0) + 1);
                if (Number(p[3]?.pickup?.price) > 0) sold.set(p[0], (sold.get(p[0]) ?? 0) + 1);
            }
    const only_sold = (i) => (sold.get(i) ?? 0) > 0 && sold.get(i) === placed.get(i);
    // the sprite that gives something and is placed most often (the coin, not the treasure chest)
    const most_placed = (test) => {
        let best = null, count = -1;
        sprites.forEach((sprite, i) => {
            if (!test(sprite?.traits ?? {}, i)) return;
            const n = placed.get(i) ?? 0;
            if (n > count) { best = i; count = n; }
        });
        return best;
    };
    const life_sprite = most_placed((t, i) => (Number(t.pickup?.lives) || 0) > 0 && !only_sold(i));
    const coin_sprite = most_placed(t => (Number(t.pickup?.points) || 0) > 0);
    const hurts = sprites.some(s => s?.traits && ('trap' in s.traits || 'baddie' in s.traits)) ||
        sprites.some(s => (Number(s?.traits?.pickup?.energy) || 0) > 0);
    return {
        lives: { show: (Number(props.lives_at_begin) || 0) > 1 || sprites.some(s => (Number(s?.traits?.pickup?.lives) || 0) > 0), sprite: life_sprite },
        energy: { show: props.show_energy !== false && hurts },
        coins: { show: coin_sprite !== null, sprite: coin_sprite },
        // "bleibt fürs ganze Spiel" (inventory.js): the row of items
        items: { show: sprites.some(s => s?.traits?.pickup?.keep === true) },
    };
}

// Screen pixels per HUD pixel: the game's own pixel size, but never so small
// or so big that the numbers are hard to read (their capitals 2.5 … 4.5 % of
// the screen's height).
function hud_scale(screen_height, screen_pixel_height, cap = 7) {
    const game = Math.round(screen_height / Math.max(1, Number(screen_pixel_height) || 240));
    const lo = Math.max(1, Math.round(screen_height * 0.025 / cap));
    const hi = Math.max(lo, Math.round(screen_height * 0.045 / cap));
    return Math.max(lo, Math.min(hi, game || lo));
}

// How many heart places: as many as the game starts with, more once the
// player has collected more; many lives become one heart and a number.
function hud_heart_slots(lives, lives_at_begin) {
    const slots = Math.max(0, Math.round(lives), Math.round(Number(lives_at_begin) || 0));
    return slots > HUD.HEARTS_MAX ? { slots: 1, compact: true } : { slots, compact: false };
}

function hud_energy_color(fraction) {
    for (const [from, color] of HUD.BAR_COLORS) if (fraction > from) return color;
    return HUD.BAR_COLORS[HUD.BAR_COLORS.length - 1][1];
}

// The number shown counts towards the real one: quick, but you see it count.
function hud_count_towards(shown, actual, dt) {
    if (shown === actual) return actual;
    const step = Math.max(1, Math.abs(actual - shown) * Math.min(1, dt * 10));
    return shown < actual ? Math.min(actual, Math.ceil(shown + step)) : Math.max(actual, Math.floor(shown - step));
}

// --------------------------------------------------------------- pictures
// RGBA pixels → the smallest box around everything that is drawn.
function hud_opaque_box(rgba, width, height) {
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
            if (rgba[4 * (y * width + x) + 3] >= 128) {
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
    return x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

// A picture for the HUD: cut to what is drawn, at half size when it is big,
// with a one-pixel outline in ink all around (so it reads on any background).
// fill: draw every pixel in this colour instead (a lost heart). outline:
// false leaves the ink away (the items, which bring their own outline; a
// second one around a small picture made it hard to read) – the picture keeps
// its size. Returns { rgba, width, height } – the picture with its outline.
function hud_icon_pixels(rgba, width, height, fill = null, outline = true) {
    const box = hud_opaque_box(rgba, width, height) ?? { x: 0, y: 0, width: 1, height: 1 };
    const half = Math.max(box.width, box.height) > HUD.ICON_MAX ? 2 : 1;
    const w = Math.ceil(box.width / half), h = Math.ceil(box.height / half);
    const W = w + 2, H = h + 2;
    const out = new Uint8ClampedArray(W * H * 4);
    const on = new Uint8Array(W * H);
    const [fr, fg, fb] = fill ? [1, 3, 5].map(i => parseInt(fill.slice(i, i + 2), 16)) : [0, 0, 0];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // half size: the pixel of the 2 × 2 block that is drawn (the first one)
            let src = -1;
            for (let dy = 0; dy < half && src < 0; dy++)
                for (let dx = 0; dx < half && src < 0; dx++) {
                    const sx = box.x + x * half + dx, sy = box.y + y * half + dy;
                    if (sx < width && sy < height && rgba[4 * (sy * width + sx) + 3] >= 128) src = 4 * (sy * width + sx);
                }
            if (src < 0) continue;
            const o = 4 * ((y + 1) * W + x + 1);
            on[(y + 1) * W + x + 1] = 1;
            out[o] = fill ? fr : rgba[src]; out[o + 1] = fill ? fg : rgba[src + 1]; out[o + 2] = fill ? fb : rgba[src + 2]; out[o + 3] = 255;
        }
    }
    const [ir, ig, ib] = [1, 3, 5].map(i => parseInt(HUD.INK.slice(i, i + 2), 16));
    for (let y = 0; y < H && outline; y++) {
        for (let x = 0; x < W; x++) {
            if (on[y * W + x]) continue;
            const near = (x > 0 && on[y * W + x - 1]) || (x < W - 1 && on[y * W + x + 1]) ||
                (y > 0 && on[(y - 1) * W + x]) || (y < H - 1 && on[(y + 1) * W + x]);
            if (!near) continue;
            const o = 4 * (y * W + x);
            out[o] = ir; out[o + 1] = ig; out[o + 2] = ib; out[o + 3] = 255;
        }
    }
    return { rgba: out, width: W, height: H };
}

// A picture of the game for the HUD: cut to what is drawn, every pixel kept
// (no outline: the game's sprites bring their own). fill: every pixel in this
// colour instead (a lost heart). Returns { rgba, width, height }.
function hud_sprite_pixels(rgba, width, height, fill = null) {
    const box = hud_opaque_box(rgba, width, height) ?? { x: 0, y: 0, width: 1, height: 1 };
    const out = new Uint8ClampedArray(box.width * box.height * 4);
    const [fr, fg, fb] = fill ? [1, 3, 5].map(i => parseInt(fill.slice(i, i + 2), 16)) : [0, 0, 0];
    for (let y = 0; y < box.height; y++)
        for (let x = 0; x < box.width; x++) {
            const src = 4 * ((box.y + y) * width + box.x + x), o = 4 * (y * box.width + x);
            if (rgba[src + 3] < 128) continue;
            out[o] = fill ? fr : rgba[src]; out[o + 1] = fill ? fg : rgba[src + 1]; out[o + 2] = fill ? fb : rgba[src + 2]; out[o + 3] = 255;
        }
    return { rgba: out, width: box.width, height: box.height };
}

// Screen pixels per picture pixel for a picture of this size (its bigger side,
// in picture pixels) at k screen pixels per HUD pixel: a picture that fits the
// box keeps the HUD's pixels; a bigger one gets smaller pixels – a whole
// number of screen pixels each, as close to the box as that allows.
function hud_sprite_scale(size, k) {
    if (size <= HUD.ICON_BOX) return k;
    return Math.max(1, Math.round(HUD.ICON_BOX * k / size));
}

// The built-in heart (or coin) as RGBA pixels.
function hud_heart_rgba(rows = HUD_HEART, colors = HUD_HEART_COLORS) {
    const h = rows.length, w = rows[0].length;
    const rgba = new Uint8ClampedArray(w * h * 4);
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const color = colors[ch];
        if (!color) return;
        const o = 4 * (y * w + x);
        [rgba[o], rgba[o + 1], rgba[o + 2]] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
        rgba[o + 3] = 255;
    }));
    return { rgba, width: w, height: h };
}

// --------------------------------------------------------------- painting
// Draws the HUD into a 2D canvas in screen pixels (k per HUD pixel).
// make_canvas(w, h) gives a canvas; sprite_rgba(sprite index) → { rgba,
// width, height } of its first picture, or null; text_bitmap(text, color, k)
// → a canvas with the text in the game's pixel font, one font pixel = k
// screen pixels (speech.js render_speech_bitmap).
class HudPainter {
    // font: the game's pixel font (speech.js SPEECH_FONTS: ascent, cap), to
    // centre a number on a picture by its digits; without it, by its bitmap.
    constructor(plan, { make_canvas, sprite_rgba, text_bitmap, font = null }) {
        this.plan = plan;
        this.make_canvas = make_canvas;
        this.text_bitmap = text_bitmap;
        this.sprite_rgba = sprite_rgba;
        this.font = font;
        this.texts = new Map();
        this.icons = new Map();
        this.tags = new Map();
        // the pictures' pixels (made into icons for each HUD scale: icon())
        this.heart_pixels = plan.lives.sprite !== null ? sprite_rgba(plan.lives.sprite) : null;
        this.coin_pixels = plan.coins.sprite !== null ? sprite_rgba(plan.coins.sprite) : null;
        // how tall the HUD's part of the screen is (in HUD pixels)
        this.strip = plan.items?.show ? HUD.STRIP_ITEMS : HUD.STRIP;
        this.reset();
    }

    // A picture, made once per scale: { canvas, width, height (HUD pixels it
    // takes), draw_w, draw_h (the size it is drawn at, in HUD pixels: whole
    // screen pixels), outlined }. pixels: the game's picture, or null for the
    // built-in one (art: HUD_HEART / HUD_COIN rows and colours).
    icon(key, pixels, art, fill = null) {
        const k = this.k;
        const id = `${key}|${fill}|${k}`;
        if (this.icons.has(id)) return this.icons.get(id);
        let icon = null;
        const canvas_of = (p) => {
            const canvas = this.make_canvas(p.width, p.height);
            const ctx = canvas.getContext('2d');
            const image = ctx.createImageData(p.width, p.height);
            image.data.set(p.rgba);
            ctx.putImageData(image, 0, 0);
            return canvas;
        };
        if (pixels) {
            const p = hud_sprite_pixels(pixels.rgba, pixels.width, pixels.height, fill);
            const scale = hud_sprite_scale(Math.max(p.width, p.height), k);
            const draw_w = p.width * scale / k, draw_h = p.height * scale / k;
            icon = { canvas: canvas_of(p), draw_w, draw_h, width: Math.ceil(draw_w), height: Math.ceil(draw_h), outlined: false };
        } else if (art) {
            const raw = hud_heart_rgba(art[0], art[1]);
            const p = hud_icon_pixels(raw.rgba, raw.width, raw.height, fill);
            icon = { canvas: canvas_of(p), draw_w: p.width, draw_h: p.height, width: p.width, height: p.height, outlined: true };
        }
        if (this.icons.size > 200) this.icons.clear();
        this.icons.set(id, icon);
        return icon;
    }

    heart(fill = null) {
        return this.icon('heart', this.heart_pixels, [HUD_HEART, HUD_HEART_COLORS], fill);
    }

    coin() {
        return this.coin_pixels ? this.icon('coin', this.coin_pixels, null) : null;
    }

    // the picture of a kept item (its first frame)
    item_icon(si) {
        this.item_pixels ??= new Map();
        if (!this.item_pixels.has(si)) this.item_pixels.set(si, this.sprite_rgba(si));
        const pixels = this.item_pixels.get(si);
        return pixels ? this.icon(`item${si}`, pixels, null) : null;
    }

    draw_icon(ctx, icon, x, y) {
        ctx.drawImage(icon.canvas, x, y, icon.draw_w, icon.draw_h);
    }

    // where a label goes so that its digits are centred on a picture drawn at y
    label_y(label, icon, y) {
        const f = this.font;
        // render_speech_bitmap: 2 font pixels of outline and air, then the
        // letters, their baseline ascent + 1 below that; a font pixel is a HUD pixel
        const middle = f ? 2 + f.ascent + 1 - f.cap / 2 : label.height / 2;
        return y + Math.round(icon.draw_h / 2 - middle);
    }

    // A price in a shop: the coin's picture and the number, k screen pixels per
    // HUD pixel. Returns { canvas, width, height } in screen pixels.
    price_tag(price, k) {
        const key = `${k}|${price}`;
        if (!this.tags.has(key)) {
            if (this.tags.size > 100) this.tags.clear();
            this.k = k;
            const coin = this.coin() ?? this.icon('builtin_coin', null, [HUD_COIN, HUD_COIN_COLORS]);
            const label = this.text(String(price));
            const label_y = this.label_y(label, coin, 0);
            const top = Math.min(0, label_y), bottom = Math.max(coin.height, label_y + label.height);
            const canvas = this.make_canvas(Math.ceil((coin.width + label.width) * k), Math.ceil((bottom - top) * k));
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.setTransform(k, 0, 0, k, 0, 0);
            this.draw_icon(ctx, coin, 0, -top);
            this.draw_text(ctx, label, coin.width, label_y - top);
            this.tags.set(key, { canvas, width: canvas.width, height: canvas.height });
        }
        return this.tags.get(key);
    }

    // a new level: the name comes again; the numbers stay where they are
    reset(level_name = '') {
        this.level_name = (level_name ?? '').trim();
        this.last = null;
    }

    // a text's picture, and its size in HUD pixels
    text(text, color = HUD.TEXT) {
        const k = this.k;
        const key = `${k}|${color}|${text}`;
        if (!this.texts.has(key)) {
            if (this.texts.size > 200) this.texts.clear();
            const canvas = this.text_bitmap(text, color, k);
            this.texts.set(key, { canvas, width: canvas.width / k, height: canvas.height / k });
        }
        return this.texts.get(key);
    }

    draw_text(ctx, label, x, y) {
        ctx.drawImage(label.canvas, x, y, label.width, label.height);
    }

    // values: { lives, lives_at_begin, energy, max_energy, points, items }, t: the
    // level's clock; the canvas is width × height screen pixels, k of them
    // per HUD pixel. Returns a key that changes whenever the picture changes
    // (the caller uploads the canvas only then). items: [{ sprite_index, count,
    // key (a weapon's number or null), chosen }] (inventory.js).
    paint(ctx, width_px, height_px, k, values, t) {
        this.k = k;
        const width = width_px / k;
        const last = this.last ?? { t, lives: values.lives, energy: values.energy, drain: values.energy, points: values.points,
            shown_points: values.points, lost_at: -10, lost_index: -1, gain_at: -10, gain_index: -1, coin_at: -10, hurt_at: -10,
            item_counts: new Map((values.items ?? []).map(item => [item.sprite_index, item.count])), item_at: new Map() };
        const dt = Math.max(0, Math.min(0.25, t - last.t));
        if (values.lives < last.lives) { last.lost_at = t; last.lost_index = Math.max(0, Math.round(values.lives)); }
        // a life more: the new heart hops
        if (values.lives > last.lives) { last.gain_at = t; last.gain_index = Math.max(0, Math.round(values.lives) - 1); }
        if (values.energy < last.energy) last.hurt_at = t;
        // the drained piece waits a moment, then follows down; going up is at once
        if (values.energy >= last.drain) last.drain = values.energy;
        else if (t - last.hurt_at > 0.35) last.drain = Math.max(values.energy, last.drain - dt * Math.max(20, (values.max_energy || 100) * 0.6));
        if (values.points > last.points) last.coin_at = t;
        // a new item (or one more of it) hops like the coin
        for (const item of values.items ?? []) {
            if (item.count > (last.item_counts.get(item.sprite_index) ?? 0)) last.item_at.set(item.sprite_index, t);
            last.item_counts.set(item.sprite_index, item.count);
        }
        last.shown_points = hud_count_towards(last.shown_points, values.points, dt);
        Object.assign(last, { t, lives: values.lives, energy: values.energy, points: values.points });
        this.last = last;
        const hop_of = (at) => t - at < 0.25 ? -Math.round(Math.sin((t - at) / 0.25 * Math.PI) * 3) : 0;

        const M = HUD.MARGIN;
        const parts = [];        // what is drawn, for the key
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width_px, height_px);
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.imageSmoothingEnabled = false;
        let y = M;
        // lives
        if (this.plan.lives.show) {
            const { slots, compact } = hud_heart_slots(values.lives, values.lives_at_begin);
            const heart = this.heart(), empty = this.heart(HUD.EMPTY), white = this.heart(HUD.TEXT);
            let x = M;
            const shaking = t - last.lost_at < 0.45;
            const gain_hop = hop_of(last.gain_at);
            for (let i = 0; i < slots; i++) {
                const full = compact ? values.lives > 0 : i < values.lives;
                let dx = 0, dy = 0;
                if (shaking && i === last.lost_index) dx = [1, -1, 1, -1, 0][Math.min(4, Math.floor((t - last.lost_at) / 0.09))];
                if (!compact && i === last.gain_index) dy = gain_hop;
                // a moment of white when it is lost, then empty
                const flash = shaking && i === last.lost_index && t - last.lost_at < 0.12;
                const icon = flash ? white : full ? heart : empty;
                this.draw_icon(ctx, icon, x + dx, y + dy);
                // outlined neighbours share their outline
                x += icon.outlined ? icon.width - 1 + HUD.GAP - 1 : icon.width + HUD.GAP - 1;
            }
            if (compact) {
                const label = this.text(`× ${Math.max(0, Math.round(values.lives))}`);
                this.draw_text(ctx, label, x + 1, this.label_y(label, heart, y));
            }
            parts.push('L', slots, compact ? Math.round(values.lives) : '', values.lives, shaking ? Math.floor((t - last.lost_at) / 0.09) : '', gain_hop);
            y += heart.height + 2;
        }
        // energy
        if (this.plan.energy.show) {
            const max = Math.max(1, values.max_energy || 100);
            const W = HUD.BAR_WIDTH, H = HUD.BAR_HEIGHT;
            const fill = Math.round(W * Math.max(0, Math.min(1, values.energy / max)));
            const drain = Math.round(W * Math.max(0, Math.min(1, last.drain / max)));
            ctx.fillStyle = HUD.INK;
            ctx.fillRect(M, y, W + 2, H + 2);
            ctx.fillStyle = HUD.EMPTY;
            ctx.fillRect(M + 1, y + 1, W, H);
            if (drain > fill) { ctx.fillStyle = HUD.DRAIN; ctx.fillRect(M + 1 + fill, y + 1, drain - fill, H); }
            const flash = t - last.hurt_at < 0.1;
            ctx.fillStyle = flash ? HUD.TEXT : hud_energy_color(values.energy / max);
            ctx.fillRect(M + 1, y + 1, fill, H);
            // a lighter top row, and a notch every fifth
            ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.fillRect(M + 1, y + 1, fill, 1);
            ctx.fillStyle = 'rgba(26, 28, 44, 0.45)';
            for (let i = 1; i < 5; i++) ctx.fillRect(M + 1 + Math.round(W * i / 5), y + 1, 1, H);
            parts.push('E', fill, drain, flash);
            y += H + 2 + 3;
        }
        // items: picture, "× n"; a weapon with its number in front, framed while
        // chosen. One row: every picture centred on the tallest.
        if (this.plan.items?.show && values.items?.length) {
            const row = values.items.map(item => ({ item, icon: this.item_icon(item.sprite_index) })).filter(e => e.icon);
            const row_h = Math.max(0, ...row.map(e => e.icon.height));
            let x = M;
            y += 1;   // room for a chosen weapon's frame
            for (const { item, icon } of row) {
                const top = y + Math.floor((row_h - icon.height) / 2);
                const hop = hop_of(last.item_at.get(item.sprite_index) ?? -10);
                if (item.key !== null && item.key !== undefined) {
                    const label = this.text(String(item.key), item.chosen ? HUD.CHOSEN : HUD.TEXT);
                    this.draw_text(ctx, label, x, this.label_y(label, icon, top));
                    x += label.width;
                }
                if (item.chosen) {
                    ctx.fillStyle = HUD.CHOSEN;
                    ctx.fillRect(x - 1, top - 1 + hop, icon.width + 2, 1);
                    ctx.fillRect(x - 1, top + icon.height + hop, icon.width + 2, 1);
                    ctx.fillRect(x - 1, top + hop, 1, icon.height);
                    ctx.fillRect(x + icon.width, top + hop, 1, icon.height);
                }
                this.draw_icon(ctx, icon, x, top + hop);
                x += icon.width;
                if (item.count > 1) {
                    const label = this.text(`× ${item.count}`);
                    this.draw_text(ctx, label, x + 1, this.label_y(label, icon, top));
                    x += label.width + 1;
                }
                x += HUD.ITEM_GAP;
                parts.push('I', item.sprite_index, item.count, item.key, item.chosen, hop);
            }
        }
        // coins
        const coin = this.plan.coins.show ? this.coin() : null;
        if (coin) {
            const label = this.text(String(Math.max(0, Math.round(last.shown_points))));
            const hop = hop_of(last.coin_at);
            const right = width - M;
            this.draw_text(ctx, label, right - label.width, Math.max(0, this.label_y(label, coin, M)));
            this.draw_icon(ctx, coin, right - label.width - coin.width - 1, M + hop);
            parts.push('C', last.shown_points, hop);
        }
        // the level's name, for a moment
        if (this.level_name) {
            const s = t - HUD.NAME_DELAY;
            if (s >= 0 && s < HUD.NAME_SECONDS) {
                const alpha = Math.min(1, s / 0.25, (HUD.NAME_SECONDS - s) / 0.5);
                const label = this.text(this.level_name);
                const rise = Math.round((1 - Math.min(1, s / 0.25)) * 3);
                ctx.globalAlpha = Math.round(alpha * 8) / 8;
                this.draw_text(ctx, label, Math.round((width - label.width) / 2), M + rise);
                ctx.globalAlpha = 1;
                parts.push('N', Math.round(alpha * 8), rise);
            }
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return `${width_px}x${height_px}x${k}|${parts.join(',')}`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HUD, HUD_HEART, HUD_COIN, hud_plan, hud_scale, hud_heart_slots, hud_energy_color, hud_count_towards,
        hud_opaque_box, hud_icon_pixels, hud_sprite_pixels, hud_sprite_scale, hud_heart_rgba, HudPainter };
}

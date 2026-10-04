// The game's HUD: what the player needs to know, drawn into the game's canvas
// as pixel art (app.js draw_hud, after the scene and the CRT pass, like the
// speech bubbles) – no bar across the top of the screen any more.
//
// It shows only what the game uses, with the game's own pictures:
//   lives    hearts top left – the picture of the sprite that gives lives
//            (else a built-in heart); only if the game starts with more than
//            one life or something gives lives
//   energy   a bar under them; only with "Energie anzeigen" and something
//            in the game that hurts (a trap, an enemy) or gives energy
//   coins    top right – the picture of the sprite that gives points and
//            the number; only if something gives points
//   level    the level's name for a moment when it starts (if it has one)
// Changes are animated: a lost heart shakes and empties, damage leaves a
// white piece on the energy bar that drains away, coins count up and their
// picture hops.
//
// Everything is measured in HUD pixels; one HUD pixel is hud_scale(…) screen
// pixels, a whole number, so every edge stays sharp. Pictures are drawn that
// many times as big; text is drawn at its own size in screen pixels (a pixel
// font drawn one pixel per font pixel falls apart).

const HUD = {
    MARGIN: 6,          // from the edge of the screen
    GAP: 2,             // between hearts
    ICON_MAX: 13,       // a picture bigger than this is shown at half size
    BAR_WIDTH: 46,
    BAR_HEIGHT: 5,
    HEARTS_MAX: 8,      // more lives: one heart and "× n"
    NAME_SECONDS: 2.4,  // how long the level's name stays
    NAME_DELAY: 0.25,
    STRIP: 44,          // how tall the HUD's part of the screen is
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

// ------------------------------------------------------------ what to show
// data: the game as the engine holds it (placed sprites refer to sprite
// indices). Returns { lives: { show, sprite }, energy: { show }, coins: { show, sprite } }.
function hud_plan(data) {
    const sprites = data?.sprites ?? [];
    const props = data?.properties ?? {};
    const placed = new Map();
    for (const level of data?.levels ?? [])
        for (const layer of level?.layers ?? [])
            for (const p of layer?.sprites ?? [])
                if (Array.isArray(p) && Number.isInteger(p[0])) placed.set(p[0], (placed.get(p[0]) ?? 0) + 1);
    // the sprite that gives something and is placed most often (the coin, not the treasure chest)
    const most_placed = (test) => {
        let best = null, count = -1;
        sprites.forEach((sprite, i) => {
            if (!test(sprite?.traits ?? {})) return;
            const n = placed.get(i) ?? 0;
            if (n > count) { best = i; count = n; }
        });
        return best;
    };
    const life_sprite = most_placed(t => (Number(t.pickup?.lives) || 0) > 0);
    const coin_sprite = most_placed(t => (Number(t.pickup?.points) || 0) > 0);
    const hurts = sprites.some(s => s?.traits && ('trap' in s.traits || 'baddie' in s.traits)) ||
        sprites.some(s => (Number(s?.traits?.pickup?.energy) || 0) > 0);
    return {
        lives: { show: (Number(props.lives_at_begin) || 0) > 1 || life_sprite !== null, sprite: life_sprite },
        energy: { show: props.show_energy !== false && hurts },
        coins: { show: coin_sprite !== null, sprite: coin_sprite },
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
// fill: draw every pixel in this colour instead (a lost heart). Returns
// { rgba, width, height } – the picture with its outline.
function hud_icon_pixels(rgba, width, height, fill = null) {
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
    for (let y = 0; y < H; y++) {
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

// The built-in heart as RGBA pixels.
function hud_heart_rgba() {
    const h = HUD_HEART.length, w = HUD_HEART[0].length;
    const rgba = new Uint8ClampedArray(w * h * 4);
    HUD_HEART.forEach((row, y) => [...row].forEach((ch, x) => {
        const color = HUD_HEART_COLORS[ch];
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
    constructor(plan, { make_canvas, sprite_rgba, text_bitmap }) {
        this.plan = plan;
        this.make_canvas = make_canvas;
        this.text_bitmap = text_bitmap;
        this.texts = new Map();
        const icon = (pixels, fill = null) => {
            if (!pixels) return null;
            const p = hud_icon_pixels(pixels.rgba, pixels.width, pixels.height, fill);
            const canvas = make_canvas(p.width, p.height);
            const ctx = canvas.getContext('2d');
            const image = ctx.createImageData(p.width, p.height);
            image.data.set(p.rgba);
            ctx.putImageData(image, 0, 0);
            return canvas;
        };
        const heart = (plan.lives.sprite !== null ? sprite_rgba(plan.lives.sprite) : null) ?? hud_heart_rgba();
        this.heart = icon(heart);
        this.heart_empty = icon(heart, HUD.EMPTY);
        this.heart_flash = icon(heart, HUD.TEXT);
        this.coin = plan.coins.sprite !== null ? icon(sprite_rgba(plan.coins.sprite)) : null;
        this.reset();
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

    // values: { lives, lives_at_begin, energy, max_energy, points }, t: the
    // level's clock; the canvas is width × height screen pixels, k of them
    // per HUD pixel. Returns a key that changes whenever the picture changes
    // (the caller uploads the canvas only then).
    paint(ctx, width_px, height_px, k, values, t) {
        this.k = k;
        const width = width_px / k;
        const last = this.last ?? { t, lives: values.lives, energy: values.energy, drain: values.energy, points: values.points,
            shown_points: values.points, lost_at: -10, lost_index: -1, coin_at: -10, hurt_at: -10 };
        const dt = Math.max(0, Math.min(0.25, t - last.t));
        if (values.lives < last.lives) { last.lost_at = t; last.lost_index = Math.max(0, Math.round(values.lives)); }
        if (values.energy < last.energy) last.hurt_at = t;
        // the drained piece waits a moment, then follows down; going up is at once
        if (values.energy >= last.drain) last.drain = values.energy;
        else if (t - last.hurt_at > 0.35) last.drain = Math.max(values.energy, last.drain - dt * Math.max(20, (values.max_energy || 100) * 0.6));
        if (values.points > last.points) last.coin_at = t;
        last.shown_points = hud_count_towards(last.shown_points, values.points, dt);
        Object.assign(last, { t, lives: values.lives, energy: values.energy, points: values.points });
        this.last = last;

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
            let x = M;
            const shaking = t - last.lost_at < 0.45;
            for (let i = 0; i < slots; i++) {
                const full = compact ? values.lives > 0 : i < values.lives;
                let dx = 0, dy = 0;
                if (shaking && i === last.lost_index) dx = [1, -1, 1, -1, 0][Math.min(4, Math.floor((t - last.lost_at) / 0.09))];
                // a moment of white when it is lost, then empty
                const flash = shaking && i === last.lost_index && t - last.lost_at < 0.12;
                const icon = flash ? this.heart_flash : full ? this.heart : this.heart_empty;
                ctx.drawImage(icon, x + dx, y + dy);
                // neighbours share their outline
                x += icon.width - 1 + HUD.GAP - 1;
            }
            if (compact) {
                const label = this.text(`× ${Math.max(0, Math.round(values.lives))}`);
                this.draw_text(ctx, label, x + 1, y + Math.round((this.heart.height - label.height) / 2));
            }
            parts.push('L', slots, compact ? Math.round(values.lives) : '', values.lives, shaking ? Math.floor((t - last.lost_at) / 0.09) : '');
            y += this.heart.height + 2;
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
        }
        // coins
        if (this.plan.coins.show && this.coin) {
            const label = this.text(String(Math.max(0, Math.round(last.shown_points))));
            const hop = t - last.coin_at < 0.25 ? -Math.round(Math.sin((t - last.coin_at) / 0.25 * Math.PI) * 3) : 0;
            const row = Math.max(this.coin.height, label.height);
            const right = width - M;
            this.draw_text(ctx, label, right - label.width, M + Math.round((row - label.height) / 2));
            ctx.drawImage(this.coin, right - label.width - this.coin.width, M + Math.round((row - this.coin.height) / 2) + hop);
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
    module.exports = { HUD, HUD_HEART, hud_plan, hud_scale, hud_heart_slots, hud_energy_color, hud_count_towards,
        hud_opaque_box, hud_icon_pixels, hud_heart_rgba, HudPainter };
}

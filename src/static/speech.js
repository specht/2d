// Sprechtexte: what a character says, the way old adventure games showed it –
// coloured pixel letters with a black outline above the speaker's head, one
// sentence after the other. "." (or the action key, or a tap) skips to the
// next sentence.
//
// A sign (trait "text", placed property text) is read out by the player's
// figure by default (speaker "player"); it can also speak itself (speaker
// "self", in its own colour). Every line of the text is one sentence.
//
// Game settings (data.properties, absent = the default): text_font,
// text_size, text_speed, text_color (the figure's colour).
//
// The letters are drawn into the game's own canvas (app.js, a last render
// pass in screen pixels), not as HTML: so they are crisp, independent of the
// level's pixel size, unaffected by the CRT effect, and in recipe recordings.
// They are sized to the screen, not to the level: the same text reads equally
// well in a game 180 pixels high and in one 360 pixels high. A line is drawn
// at its final size, every pixel either fully on or off, and the outline
// grows around it by one font pixel.

// em: the font's pixel grid (font pixels per em); cap, ascent (with umlauts),
// descent: in font pixels. All four fonts: SIL Open Font License (fonts/).
const SPEECH_FONTS = {
    pixelify: { label: 'Pixelify – gut lesbar', family: 'Pixelify Sans', em: 10, cap: 7, ascent: 9, descent: 2 },
    jersey: { label: 'Jersey – kräftig', family: 'Jersey 10', em: 18.6667, cap: 10, ascent: 13, descent: 2 },
    tiny5: { label: 'Tiny5 – klein und fein', family: 'Tiny5', em: 8, cap: 5, ascent: 7, descent: 1 },
    pressstart: { label: 'Press Start – Arcade', family: 'Press Start 2P', em: 8, cap: 8, ascent: 8, descent: 0 },
};
const SPEECH_DEFAULT_FONT = 'pixelify';

// Height of a capital letter as a share of the screen height.
const SPEECH_SIZES = {
    small: { label: 'klein', share: 0.02 },
    medium: { label: 'mittel', share: 0.027 },
    large: { label: 'groß', share: 0.036 },
};

// How long a sentence stays: multiplied by this.
const SPEECH_SPEEDS = {
    slow: { label: 'langsam', factor: 1.5 },
    normal: { label: 'normal', factor: 1 },
    fast: { label: 'schnell', factor: 0.65 },
};

const SPEECH_PLAYER_COLOR = '#f4f4f4';
const SPEECH_SELF_COLOR = '#73eff7';
const SPEECH_SPEAKERS = { player: 'die Spielfigur liest vor', self: 'das Sprite spricht selbst' };

function speech_color(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

// The game's settings, every one with its default (old games have none).
function speech_settings(properties) {
    const p = properties ?? {};
    return {
        font: p.text_font in SPEECH_FONTS ? p.text_font : SPEECH_DEFAULT_FONT,
        size: p.text_size in SPEECH_SIZES ? p.text_size : 'medium',
        speed: p.text_speed in SPEECH_SPEEDS ? p.text_speed : 'normal',
        color: speech_color(p.text_color, SPEECH_PLAYER_COLOR),
    };
}

// Every line is one sentence; empty lines are left out.
function speech_parts(text) {
    if (typeof text !== 'string') return [];
    return text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
}

// Seconds a sentence stays: long enough to read it, at least 1.5 s.
function speech_seconds(part, speed = 'normal') {
    const factor = SPEECH_SPEEDS[speed]?.factor ?? 1;
    return Math.max(1.5, 1.0 + 0.065 * String(part).length) * factor;
}

// Screen pixels per font pixel: a whole number, so every letter is crisp.
function speech_scale(screen_height, font = SPEECH_DEFAULT_FONT, size = 'medium') {
    const f = SPEECH_FONTS[font] ?? SPEECH_FONTS[SPEECH_DEFAULT_FONT];
    const share = SPEECH_SIZES[size]?.share ?? SPEECH_SIZES.medium.share;
    return Math.max(1, Math.round(screen_height * share / f.cap));
}

// Lines no wider than max_width; measure(text) gives a text's width. A word
// that is too long on its own is cut where it has to be.
function wrap_speech(text, max_width, measure) {
    const lines = [];
    let line = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (!line || measure(candidate) <= max_width) {
            line = candidate;
        } else {
            lines.push(line);
            line = word;
        }
        // a single word wider than the line: cut it
        while (measure(line) > max_width && line.length > 1) {
            let cut = line.length - 1;
            while (cut > 1 && measure(line.slice(0, cut)) > max_width) cut--;
            lines.push(line.slice(0, cut));
            line = line.slice(cut);
        }
    }
    if (line) lines.push(line);
    return lines;
}

// What is being said right now: one monologue at a time. source: whatever
// started it (a sign's entry index), so the same sign can skip instead of
// starting again. log: every sentence that was shown, in order (tests, recipes).
class Speech {
    constructor() {
        this.current = null;
        this.log = [];
    }

    get active() {
        return this.current !== null;
    }

    get text() {
        return this.current ? this.current.parts[this.current.index] : null;
    }

    start({ parts, speaker = 'player', color = SPEECH_PLAYER_COLOR, source = null, speed = 'normal' }, time) {
        const list = (parts ?? []).filter(part => typeof part === 'string' && part.length);
        if (!list.length) return false;
        this.current = { parts: list, index: 0, speaker, color, source, speed, until: time + speech_seconds(list[0], speed) };
        this.log.push(list[0]);
        return true;
    }

    // the next sentence, or the end
    skip(time) {
        const c = this.current;
        if (!c) return;
        c.index += 1;
        if (c.index >= c.parts.length) {
            this.current = null;
            return;
        }
        c.until = time + speech_seconds(c.parts[c.index], c.speed);
        this.log.push(c.parts[c.index]);
    }

    update(time) {
        while (this.current && time >= this.current.until) this.skip(this.current.until);
    }

    stop() {
        this.current = null;
    }
}

// ------------------------------------------------------------ the pixels
// The lines of one sentence as RGBA pixels: letters in colour, an outline of
// one font pixel (k screen pixels) in black. make_canvas(w, h) gives a 2D
// canvas (browser only). Returns { canvas, width, height }.
function render_speech_bitmap(lines, font_id, k, color, make_canvas) {
    const font = SPEECH_FONTS[font_id] ?? SPEECH_FONTS[SPEECH_DEFAULT_FONT];
    const px = font.em * k;
    const line_height = (font.ascent + font.descent + 2) * k;
    const pad = 2 * k;                                   // outline and a little air
    const probe = make_canvas(1, 1).getContext('2d');
    probe.font = `${px}px "${font.family}"`;
    const widths = lines.map(line => Math.ceil(probe.measureText(line).width));
    const width = Math.max(1, ...widths) + 2 * pad;
    const height = lines.length * line_height + 2 * pad;
    const canvas = make_canvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.font = probe.font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => {
        const x = Math.round((width - widths[i]) / 2);
        const y = pad + i * line_height + (font.ascent + 1) * k;
        ctx.fillText(line, x, y);
    });
    const image = ctx.getImageData(0, 0, width, height);
    const n = width * height;
    // letters: every pixel fully on or off
    const on = new Uint8Array(n);
    for (let i = 0; i < n; i++) on[i] = image.data[4 * i + 3] >= 128 ? 1 : 0;
    // outline: grow by k pixels in every direction (a square), in two passes
    const row = new Uint8Array(n);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let hit = 0;
            for (let d = -k; d <= k && !hit; d++) {
                const xx = x + d;
                if (xx >= 0 && xx < width && on[y * width + xx]) hit = 1;
            }
            row[y * width + x] = hit;
        }
    }
    const [r, g, b] = [1, 3, 5].map(i => parseInt(speech_color(color, SPEECH_PLAYER_COLOR).slice(i, i + 2), 16));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            let outline = 0;
            for (let d = -k; d <= k && !outline; d++) {
                const yy = y + d;
                if (yy >= 0 && yy < height && row[yy * width + x]) outline = 1;
            }
            const o = 4 * i;
            if (on[i]) {
                image.data[o] = r; image.data[o + 1] = g; image.data[o + 2] = b; image.data[o + 3] = 255;
            } else if (outline) {
                image.data[o] = 0; image.data[o + 1] = 0; image.data[o + 2] = 0; image.data[o + 3] = 255;
            } else {
                image.data[o + 3] = 0;
            }
        }
    }
    ctx.putImageData(image, 0, 0);
    return { canvas, width, height };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SPEECH_FONTS, SPEECH_DEFAULT_FONT, SPEECH_SIZES, SPEECH_SPEEDS, SPEECH_PLAYER_COLOR, SPEECH_SELF_COLOR,
        SPEECH_SPEAKERS, speech_color, speech_settings, speech_parts, speech_seconds, speech_scale, wrap_speech,
        Speech, render_speech_bitmap,
    };
}

// The curtain screens of a game (level start, a lost life, Game Over, level
// geschafft, through a door into or out of a Nebenlevel, the end), in German and in the game's own pixel font – the same
// letters as the HUD and the speech bubbles (speech.js render_speech_bitmap),
// so they belong to the game instead of looking like a web page.
//
// curtain_screen is pure (tested in test/screens.test.cjs); render_curtain
// puts the lines into #curtain_text as crisp pixel bitmaps.

const CURTAIN_COLORS = {
    title: '#f4f4f4',
    good: '#ffcd75',     // geschafft
    bad: '#ef7d57',      // Game Over
    quiet: '#94b0c2',    // what comes next, the prompt
};

// Cap height of a line as a share of the screen height.
const CURTAIN_SIZES = { big: 0.085, medium: 0.05, small: 0.032 };

// What a screen says: { lines: [{ text, size, color, pulse? }] }.
//   kind: 'level_start' | 'lost_life' | 'game_over' | 'level_complete' | 'level_change' | 'the_end'
//   (level_change: into or out of a Nebenlevel – a door, nothing was geschafft)
//   info: { level_name, next_name, lives, title, points, show_points, prompt }
function curtain_screen(kind, info = {}) {
    const prompt = String(info.prompt ?? 'Drück eine Taste');
    const line = (text, size, color = CURTAIN_COLORS.title, extra = {}) => ({ text: String(text), size, color, ...extra });
    const clean = (s) => String(s ?? '').trim();
    const lines = [];
    if (kind === 'level_start') {
        if (clean(info.level_name)) lines.push(line(clean(info.level_name), 'big'));
        lines.push(line(`${prompt}, um loszulegen`, 'small', CURTAIN_COLORS.quiet, { pulse: true }));
    } else if (kind === 'lost_life') {
        lines.push(line('Autsch!', 'big'));
        if (Number.isFinite(info.lives))
            lines.push(line(info.lives === 1 ? 'Noch 1 Leben' : `Noch ${info.lives} Leben`, 'medium', CURTAIN_COLORS.quiet));
        lines.push(line(`${prompt}, um weiterzuspielen`, 'small', CURTAIN_COLORS.quiet, { pulse: true }));
    } else if (kind === 'game_over') {
        lines.push(line('Game Over', 'big', CURTAIN_COLORS.bad));
        lines.push(line('Keine Leben mehr', 'medium', CURTAIN_COLORS.quiet));
    } else if (kind === 'level_complete') {
        lines.push(line('Geschafft!', 'big', CURTAIN_COLORS.good));
        if (clean(info.next_name)) lines.push(line(`Weiter mit: ${clean(info.next_name)}`, 'medium', CURTAIN_COLORS.quiet));
    } else if (kind === 'level_change') {
        if (clean(info.level_name)) lines.push(line(clean(info.level_name), 'big'));
    } else if (kind === 'the_end') {
        lines.push(line('Ende', 'big', CURTAIN_COLORS.good));
        lines.push(line(clean(info.title) ? `Du hast „${clean(info.title)}“ geschafft!` : 'Du hast es geschafft!', 'medium'));
        if (info.show_points && Number.isFinite(info.points)) lines.push(line(`Punkte: ${info.points}`, 'medium', CURTAIN_COLORS.good));
    }
    return { lines };
}

// The start screen's head: the game's title, big, and who made it.
function start_screen(info = {}) {
    const title = String(info.title ?? '').trim(), author = String(info.author ?? '').trim();
    const lines = [];
    if (title) lines.push({ text: title, size: 'big', color: CURTAIN_COLORS.title });
    if (author) lines.push({ text: `von ${author}`, size: 'small', color: CURTAIN_COLORS.quiet });
    return { lines };
}

// A text too wide for one line, on as few lines as it needs, broken between
// words and as even as possible (not one long line and a short rest).
// width_of(text): its width; a single word wider than max_width gets a line
// of its own (render_curtain then makes the letters smaller).
function wrap_curtain_text(text, width_of, max_width) {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    if (words.length <= 1 || width_of(words.join(' ')) <= max_width) return [words.join(' ')];
    const greedy = (limit) => {
        const lines = [];
        for (const word of words) {
            const joined = lines.length ? `${lines[lines.length - 1]} ${word}` : null;
            if (joined !== null && width_of(joined) <= limit) lines[lines.length - 1] = joined;
            else lines.push(word);
        }
        return lines;
    };
    const count = greedy(max_width).length;
    // the narrowest width that needs no more lines
    let lo = Math.max(...words.map(width_of)), hi = max_width;
    if (lo >= hi) return greedy(max_width);
    for (let i = 0; i < 16 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (greedy(mid).length <= count) hi = mid; else lo = mid;
    }
    return greedy(hi);
}

// Draws a screen into the container (jQuery). height: of the game screen in
// px; font: a SPEECH_FONTS id. Each line is a bitmap of whole font pixels.
// A line too wide for the screen goes on several lines (a long level name);
// only when that is not enough (one very long word, or too many lines) it
// gets smaller font pixels (never blurred).
function render_curtain(container, screen, height, font, width = null) {
    container.empty();
    const info = SPEECH_FONTS[font] ?? SPEECH_FONTS[SPEECH_DEFAULT_FONT];
    const make_canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const room = (width ?? height * 16 / 9) * 0.92;
    const probe = make_canvas(1, 1).getContext('2d');
    // as render_speech_bitmap measures: the letters and 2 font pixels of air on each side
    const width_at = (k) => (text) => { probe.font = `${info.em * k}px "${info.family}"`; return Math.ceil(probe.measureText(text).width) + 4 * k; };
    for (const line of screen.lines) {
        let k = Math.max(1, Math.round(CURTAIN_SIZES[line.size] * height / info.cap));
        let bitmap = null;
        for (;;) {
            const lines = wrap_curtain_text(line.text, width_at(k), room);
            bitmap = render_speech_bitmap(lines, font, k, line.color, make_canvas);
            if (k <= 1 || (bitmap.width <= room && bitmap.height <= height * 0.5)) break;
            k -= 1;
        }
        $(bitmap.canvas).addClass('curtain-line').toggleClass('curtain-pulse', !!line.pulse)
            .css({ width: `${bitmap.width}px`, height: `${bitmap.height}px` }).appendTo(container);
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { curtain_screen, start_screen, wrap_curtain_text, CURTAIN_COLORS, CURTAIN_SIZES };

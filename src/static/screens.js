// The curtain screens of a game (level start, a lost life, Game Over, level
// geschafft, the end), in German and in the game's own pixel font – the same
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
//   kind: 'level_start' | 'lost_life' | 'game_over' | 'level_complete' | 'the_end'
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

// Draws a screen into the container (jQuery). height: of the game screen in
// px; font: a SPEECH_FONTS id. Each line is a bitmap of whole font pixels.
// A line too wide for the screen gets smaller font pixels (never blurred).
function render_curtain(container, screen, height, font, width = null) {
    container.empty();
    const info = SPEECH_FONTS[font] ?? SPEECH_FONTS[SPEECH_DEFAULT_FONT];
    const make_canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const room = (width ?? height * 16 / 9) * 0.92;
    for (const line of screen.lines) {
        let k = Math.max(1, Math.round(CURTAIN_SIZES[line.size] * height / info.cap));
        let bitmap = render_speech_bitmap([line.text], font, k, line.color, make_canvas);
        while (k > 1 && bitmap.width > room) bitmap = render_speech_bitmap([line.text], font, --k, line.color, make_canvas);
        $(bitmap.canvas).addClass('curtain-line').toggleClass('curtain-pulse', !!line.pulse)
            .css({ width: `${bitmap.width}px`, height: `${bitmap.height}px` }).appendTo(container);
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { curtain_screen, start_screen, CURTAIN_COLORS, CURTAIN_SIZES };

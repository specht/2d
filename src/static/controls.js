// Keyboard controls. Games without `properties.controls` keep the established
// keys exactly (arrows + WASD, Space, F, J, K). A creator can replace the keys
// of single actions in Einstellungen → Steuerung; absent actions use defaults.
const GAME_CONTROLS = [
    { id: 'left', label: 'Nach links', keys: ['ArrowLeft', 'KeyA'] },
    { id: 'right', label: 'Nach rechts', keys: ['ArrowRight', 'KeyD'] },
    { id: 'up', label: 'Hoch (Leiter)', keys: ['ArrowUp', 'KeyW'] },
    { id: 'down', label: 'Runter (Leiter)', keys: ['ArrowDown', 'KeyS'] },
    { id: 'jump', label: 'Springen', keys: ['Space'] },
    { id: 'action', label: 'Aktion (Tür, Text)', keys: ['KeyF'] },
    { id: 'melee', label: 'Nahkampf', keys: ['KeyJ'] },
    { id: 'ranged', label: 'Fernkampf', keys: ['KeyK'] },
];
const MAX_KEYS_PER_CONTROL = 2;

// Keys that must keep their meaning in the game or the browser.
const RESERVED_KEYS = {
    Escape: 'Esc beendet das Spiel.',
    F5: 'F5 lädt die Seite neu.',
    F11: 'F11 schaltet den Vollbildmodus um.',
    F12: 'F12 öffnet die Entwicklerwerkzeuge.',
};

function valid_key_code(code) {
    return typeof code === 'string' && /^[A-Za-z][A-Za-z0-9]{0,23}$/.test(code) && !(code in RESERVED_KEYS);
}

// { left: [...codes], ... } — custom lists replace the defaults per action.
function resolve_controls(properties) {
    const custom = properties?.controls;
    const result = {};
    for (const control of GAME_CONTROLS) {
        const keys = custom && Array.isArray(custom[control.id]) ?
            custom[control.id].filter(valid_key_code).slice(0, MAX_KEYS_PER_CONTROL) : null;
        result[control.id] = keys && keys.length ? keys : [...control.keys];
    }
    return result;
}

// Map key code → list of actions (one key may trigger several actions).
function controls_key_map(properties) {
    const map = new Map();
    const controls = resolve_controls(properties);
    for (const [action, keys] of Object.entries(controls))
        for (const code of keys) {
            if (!map.has(code)) map.set(code, []);
            map.get(code).push(action);
        }
    return map;
}

const DEFAULT_CONTROL_KEYS = new Set(GAME_CONTROLS.flatMap(c => c.keys));

function key_label(code) {
    const names = {
        Space: 'Leertaste', Enter: 'Eingabe', NumpadEnter: 'Num Eingabe', Tab: 'Tab', Backspace: 'Rücktaste',
        ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
        ShiftLeft: 'Umschalt links', ShiftRight: 'Umschalt rechts',
        ControlLeft: 'Strg links', ControlRight: 'Strg rechts',
        AltLeft: 'Alt', AltRight: 'Alt Gr', MetaLeft: 'Windows', MetaRight: 'Windows',
        CapsLock: 'Feststell', Comma: ',', Period: '.', Minus: 'ß', Backquote: '^',
        BracketLeft: 'Ü', BracketRight: '+', Semicolon: 'Ö', Quote: 'Ä', Slash: '-', Backslash: '#',
        IntlBackslash: '<', Equal: '´', Insert: 'Einfg', Delete: 'Entf', Home: 'Pos1', End: 'Ende',
        PageUp: 'Bild ↑', PageDown: 'Bild ↓',
    };
    if (names[code]) return names[code];
    let m = code.match(/^Key([A-Z])$/);
    // Browsers report the US layout position; on German keyboards Y and Z are swapped.
    if (m) return m[1] === 'Y' ? 'Z' : m[1] === 'Z' ? 'Y' : m[1];
    if ((m = code.match(/^Digit(\d)$/))) return m[1];
    if ((m = code.match(/^Numpad(\d)$/))) return `Num ${m[1]}`;
    if ((m = code.match(/^F(\d+)$/))) return `F${m[1]}`;
    return code;
}

// A German hint for keys that work but can cause surprises in the browser.
function key_warning(code) {
    if (code in RESERVED_KEYS) return RESERVED_KEYS[code] + ' Diese Taste kann nicht belegt werden.';
    if (/^Shift/.test(code))
        return 'Drückt man Umschalt fünfmal schnell hintereinander, fragt Windows nach den „Einrastfunktionen“. Im Spiel funktioniert die Taste trotzdem – einfach „Nein“ wählen oder die Frage in Windows abschalten.';
    if (/^Control/.test(code))
        return 'Strg zusammen mit anderen Tasten löst Browser-Befehle aus – Strg+W schließt zum Beispiel den Tab. Belege mit Strg am besten eine Aktion, bei der man nicht gleichzeitig W, A, S oder D drückt, oder steuere mit den Pfeiltasten.';
    if (/^Alt/.test(code))
        return 'Alt kann im Browser das Menü öffnen. Im Spiel wird das verhindert, außerhalb des Spiels nicht.';
    if (/^Meta/.test(code))
        return 'Die Windows-Taste öffnet das Startmenü. Das kann das Spiel nicht verhindern – besser eine andere Taste nehmen.';
    if (code === 'Tab') return 'Tab springt normalerweise zum nächsten Eingabefeld. Im Spiel wird das verhindert.';
    if (code === 'CapsLock') return 'Die Feststelltaste rastet ein – danach schreibt man groß weiter. Besser eine andere Taste nehmen.';
    return null;
}

// ------------------------------------------------ the key over a door or a sign
// In the game, a small key cap above a door, a sign, a switch … says which key
// does it (app.js). It is drawn like the F cap the game always had: a pixel font
// 5 rows high (most letters 3 wide), on a cap 9 pixels high and as wide as its
// label – the F cap comes out pixel for pixel as before.
const KEY_CAP_GLYPHS = {
    A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
    C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
    E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
    G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
    I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
    K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
    O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
    Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
    S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
    U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
    W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
    Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
    0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
    2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
    4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
    6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
    8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
    // a sixth row on top: the dots (they sit in the row above the letters)
    'Ä': ['#.#', '.#.', '#.#', '###', '#.#', '#.#'], 'Ö': ['#.#', '.#.', '#.#', '#.#', '#.#', '.#.'],
    'Ü': ['#.#', '...', '#.#', '#.#', '#.#', '###'], 'ß': ['.#.', '#.#', '##.', '#.#', '##.'],
    ',': ['..', '..', '..', '.#', '#.'], '.': ['.', '.', '.', '.', '#'], '-': ['...', '...', '###', '...', '...'],
    '+': ['...', '.#.', '###', '.#.', '...'], '#': ['#.#', '###', '#.#', '###', '#.#'],
    '<': ['..#', '.#.', '#..', '.#.', '..#'], '^': ['.#.', '#.#', '...', '...', '...'],
    '´': ['.#', '#.', '..', '..', '..'], '?': ['##.', '..#', '.#.', '...', '.#.'],
    '←': ['..#..', '.#...', '#####', '.#...', '..#..'], '→': ['..#..', '...#.', '#####', '...#.', '..#..'],
    '↑': ['..#..', '.###.', '#.#.#', '..#..', '..#..'], '↓': ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
};

// What the cap says: short (it stands above a door), in capitals.
function key_cap_text(code) {
    const short = {
        Space: 'LEER', Enter: 'ENTER', NumpadEnter: 'ENTER', Tab: 'TAB', Backspace: 'RÜCK',
        ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', ControlLeft: 'STRG', ControlRight: 'STRG',
        AltLeft: 'ALT', AltRight: 'ALTGR', MetaLeft: 'WIN', MetaRight: 'WIN', CapsLock: 'FEST',
        Insert: 'EINFG', Delete: 'ENTF', Home: 'POS1', End: 'ENDE', PageUp: 'BILD↑', PageDown: 'BILD↓',
    };
    if (short[code]) return short[code];
    const m = String(code).match(/^Numpad(\d)$/);
    if (m) return m[1];
    const text = [...key_label(String(code)).toUpperCase()].filter(ch => ch in KEY_CAP_GLYPHS).join('').slice(0, 6);
    return text || '?';
}

// The cap as rows of pixels, one letter per colour (app.js paints them):
// a b c / g – the corners (half see-through), b – light edge (top, left),
// e – dark edge (bottom, right), d – the face, f – the label.
// → { width, height: 9, rows: [string × 9] }
function key_cap_pixels(text) {
    const glyphs = [...String(text)].map(ch => KEY_CAP_GLYPHS[ch] ?? KEY_CAP_GLYPHS['?']);
    const label_width = glyphs.reduce((sum, g) => sum + g[0].length, 0) + Math.max(0, glyphs.length - 1);
    const width = label_width + 6, height = 9;
    const rows = Array.from({ length: height }, (_, y) => {
        if (y === 0) return 'a' + 'b'.repeat(width - 2) + 'c';
        if (y === height - 1) return 'c' + 'e'.repeat(width - 2) + 'g';
        return ('b' + 'd'.repeat(width - 2) + 'e').split('');
    });
    let x = 3;
    for (const glyph of glyphs) {
        // the letters in rows 2 … 6; a sixth glyph row (umlaut dots) in row 1
        const top = 7 - glyph.length;
        glyph.forEach((line, gy) => [...line].forEach((ch, gx) => { if (ch === '#') rows[top + gy][x + gx] = 'f'; }));
        x += glyph[0].length + 1;
    }
    return { width, height, rows: rows.map(r => (Array.isArray(r) ? r.join('') : r)) };
}

const KEY_CAP_COLORS = {
    a: [112, 117, 117, 139], b: [112, 118, 118, 255], c: [72, 77, 77, 139], d: [71, 77, 77, 255],
    e: [32, 35, 35, 255], f: [207, 208, 210, 255], g: [31, 35, 35, 139],
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_CONTROLS, MAX_KEYS_PER_CONTROL, RESERVED_KEYS, DEFAULT_CONTROL_KEYS,
        valid_key_code, resolve_controls, controls_key_map, key_label, key_warning,
        KEY_CAP_GLYPHS, KEY_CAP_COLORS, key_cap_text, key_cap_pixels,
    };
}

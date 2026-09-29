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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_CONTROLS, MAX_KEYS_PER_CONTROL, RESERVED_KEYS, DEFAULT_CONTROL_KEYS,
        valid_key_code, resolve_controls, controls_key_map, key_label, key_warning,
    };
}

const assert = require('node:assert/strict');
const test = require('node:test');
const c = require('../src/static/controls.js');

test('games without custom controls keep the established keys', () => {
    const map = c.controls_key_map(undefined);
    assert.deepEqual(map.get('ArrowLeft'), ['left']);
    assert.deepEqual(map.get('KeyA'), ['left']);
    assert.deepEqual(map.get('Space'), ['jump']);
    assert.deepEqual(map.get('KeyF'), ['action']);
    assert.deepEqual(map.get('KeyJ'), ['melee']);
    assert.deepEqual(map.get('KeyK'), ['ranged']);
    assert.equal(map.get('ControlLeft'), undefined);
});

test('custom keys replace only the changed actions', () => {
    const controls = c.resolve_controls({ controls: { melee: ['ControlLeft'], jump: ['Space', 'ArrowUp'] } });
    assert.deepEqual(controls.melee, ['ControlLeft']);
    assert.deepEqual(controls.left, ['ArrowLeft', 'KeyA']);
    const map = c.controls_key_map({ controls: { jump: ['Space', 'ArrowUp'] } });
    assert.deepEqual(map.get('ArrowUp'), ['up', 'jump']);
});

test('invalid, empty and reserved keys fall back to defaults', () => {
    const controls = c.resolve_controls({ controls: { left: [], right: ['Escape'], up: 'KeyW', down: [42] } });
    assert.deepEqual(controls.left, ['ArrowLeft', 'KeyA']);
    assert.deepEqual(controls.right, ['ArrowRight', 'KeyD']);
    assert.deepEqual(controls.up, ['ArrowUp', 'KeyW']);
    assert.deepEqual(controls.down, ['ArrowDown', 'KeyS']);
    assert.equal(c.valid_key_code('F11'), false);
});

test('German labels and warnings', () => {
    assert.equal(c.key_label('KeyZ'), 'Y');
    assert.equal(c.key_label('Space'), 'Leertaste');
    assert.match(c.key_warning('ShiftLeft'), /Einrastfunktionen/);
    assert.match(c.key_warning('ControlLeft'), /Strg\+W/);
    assert.equal(c.key_warning('KeyJ'), null);
});

test('the key cap over doors: the F comes out as the picture the game always had, other keys their own', () => {
    // the 36 × 36 F picture (app.js OVERLAY_ICONS.f_key), 4 × 4 image pixels per cap pixel
    const f = c.key_cap_pixels(c.key_cap_text('KeyF'));
    assert.deepEqual(f.rows, [
        'abbbbbbbc', 'bddddddde', 'bddfffdde', 'bddfdddde', 'bddffddde',
        'bddfdddde', 'bddfdddde', 'bddddddde', 'ceeeeeeeg',
    ]);
    assert.equal(c.key_cap_text('KeyT'), 'T');
    assert.equal(c.key_cap_text('KeyZ'), 'Y');          // German keyboard
    assert.equal(c.key_cap_text('Space'), 'LEER');
    assert.equal(c.key_cap_text('Quote'), 'Ä');
    assert.equal(c.key_cap_text('Numpad5'), '5');
    assert.equal(c.key_cap_text('ArrowUp'), '↑');
    // every label is drawn with known letters, the cap as wide as the label
    for (const control of c.GAME_CONTROLS) for (const code of control.keys) {
        const text = c.key_cap_text(code);
        assert.ok([...text].every(ch => ch in c.KEY_CAP_GLYPHS), `${code} → ${text}`);
        const cap = c.key_cap_pixels(text);
        assert.equal(cap.rows.length, 9);
        assert.ok(cap.rows.every(r => r.length === cap.width && [...r].every(ch => ch in c.KEY_CAP_COLORS)));
    }
    assert.equal(c.key_cap_pixels('LEER').width, 4 * 3 + 3 + 6);
    // glyphs are rectangles
    for (const [ch, g] of Object.entries(c.KEY_CAP_GLYPHS)) assert.ok(g.every(line => line.length === g[0].length), ch);
});

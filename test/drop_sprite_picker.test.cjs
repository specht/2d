// Regression test for the Fehlerberichte "Cannot read properties of undefined
// (reading 'drop')" (October 2026): the Beute picker of an enemy outlived its
// sprite's panel. Showing another sprite – or loading another game, whose
// sprite list selects its first sprite inside Game._load – refreshed the old
// picker on a sprite without an enemy trait, threw, and left _load half done.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../src/static/game.js'), 'utf8');

function slice(begin_marker, end_marker) {
    const begin = source.indexOf(begin_marker);
    const end = source.indexOf(end_marker, begin);
    assert.ok(begin >= 0 && end > begin, `${begin_marker} not found`);
    return source.slice(begin, end);
}

// The start of build_sprite_traits_menu, up to and including the first
// refresh of the hover titles (the rest builds the panels with jQuery).
function menu_start() {
    const begin_marker = '    build_sprite_traits_menu() {';
    const refresh = '        this.refresh_sprite_titles?.();\n';
    const body = slice(begin_marker, refresh) + refresh;
    return body.replace(begin_marker, '    build_sprite_traits_menu_start() {') + '    }\n';
}

function make_editor() {
    const pickers = [];
    const canvas = { sprite_index: 0 };
    const chain = new Proxy(function () {}, { get: () => () => chain, apply: () => chain });
    const Editor = new Function('$', 'canvas', 'SpriteSelectWidget', 'CheckboxWidget', 'NumberWidget',
        `return class Editor {
            ${slice('    refresh_sprite_reference_pickers() {', '    add_sprite_trait(trait) {')}
            ${slice('    add_drop_controls(div, si) {', '    add_hit_feedback_controls(div, si, role) {')}
            ${menu_start()}
            refresh_sprite_titles() { this.refresh_sprite_reference_pickers(); }
        }`)(
        chain,
        canvas,
        class { constructor(options) { this.options = options; pickers.push(this); } refresh() { this.options.get(); } },
        class {},
        class {});
    const editor = new Editor();
    return { editor, pickers, canvas };
}

test('the Beute picker of an enemy is not refreshed for the next sprite', () => {
    const { editor, canvas } = make_editor();
    editor.data = {
        sprites: [
            { id: 's0', traits: { baddie: { drop: { sprite_id: 's1' } } } },
            { id: 's1', traits: { pickup: {} } },
        ],
    };
    // the enemy is shown: its panel has a Beute picker
    canvas.sprite_index = 0;
    editor.add_drop_controls({}, 0);
    assert.equal(editor.drop_sprite_picker.options.get(), '1');
    // another game is loaded (or another sprite chosen): sprite 0 is no enemy
    editor.data = { sprites: [{ id: 's0', traits: {} }] };
    assert.doesNotThrow(() => editor.build_sprite_traits_menu_start());
    assert.equal(editor.drop_sprite_picker, null);
});

test('the Beute picker reads no Beute when the enemy trait is gone', () => {
    const { editor } = make_editor();
    editor.data = { sprites: [{ id: 's0', traits: { baddie: {} } }] };
    editor.add_drop_controls({}, 0);
    // a session participant takes the trait away before the panel is rebuilt
    delete editor.data.sprites[0].traits.baddie;
    assert.doesNotThrow(() => editor.refresh_sprite_reference_pickers());
    assert.equal(editor.drop_sprite_picker.options.get(), 'none');
});

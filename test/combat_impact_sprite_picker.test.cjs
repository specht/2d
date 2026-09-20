const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../src/static/widgets.js'), 'utf8');
const first = source.indexOf('class SpriteSelectWidget {');
const last = source.indexOf('\nclass SpriteWidget {', first);
assert.ok(first >= 0 && last > first);
const SpriteSelectWidget = vm.runInNewContext(
    `${source.slice(first, last)}\nSpriteSelectWidget;`);

test('preview shows actual sprite drawing and title, never its array number', () => {
    const unnamed = { states: [{ properties: { name: '' },
        frames: [{ src: 'first' }, { src: 'middle' }, { src: 'last' }] }] };
    const named = { states: [{ properties: { name: '  Explosion  ' },
        frames: [{ src: 'painted-impact' }] }] };
    assert.deepEqual({ ...SpriteSelectWidget.preview(unnamed) },
        { src: 'middle', label: 'Ohne Titel' });
    assert.deepEqual({ ...SpriteSelectWidget.preview(named) },
        { src: 'painted-impact', label: 'Explosion' });
});

test('current preview uses remapped index and the newest drawing', () => {
    const actor = { states: [{ properties: { name: 'Figur' }, frames: [{ src: 'actor' }] }] };
    const impact = { states: [{ properties: { name: 'Funken' }, frames: [{ src: 'spark-1' }] }] };
    const sprites = [actor, impact];
    const choice = { value: '1', sprites: () => sprites };
    assert.equal(SpriteSelectWidget.preview(choice.sprites()[Number(choice.value)]).src, 'spark-1');
    sprites[1].states[0].frames[0].src = 'spark-2';
    assert.equal(SpriteSelectWidget.preview(choice.sprites()[Number(choice.value)]).src, 'spark-2');
    // Existing editor remapping changes 1 -> 0 when the impact sprite moves.
    sprites.reverse();
    choice.value = '0';
    assert.equal(SpriteSelectWidget.preview(choice.sprites()[Number(choice.value)]).src, 'spark-2');
});

// Small jQuery stand-in: exercise actual picker interactions without a browser.
test('picker displays images for choices and selection, refreshes drawings and reordering', () => {
    class Element {
        constructor(tag) {
            this.tag = tag;
            this.children = [];
            this.attributes = {};
            this.handlers = {};
            this.visible = true;
            this.value = '';
            this[0] = { contains: other => other === this[0] };
        }
        addClass(name) { this.className = name; return this; }
        appendTo(parent) { parent.children.push(this); return this; }
        append(child) { this.children.push(child); return this; }
        attr(name, value) {
            if (value === undefined) return this.attributes[name];
            this.attributes[name] = value;
            return this;
        }
        removeAttr(name) { delete this.attributes[name]; return this; }
        text(value) { this.value = value; return this; }
        hide() { this.visible = false; return this; }
        show() { this.visible = true; return this; }
        is(query) { return query === ':visible' && this.visible; }
        empty() { this.children = []; return this; }
        on(name, fn) { this.handlers[name] = fn; return this; }
        trigger(name) { this.handlers[name]?.(); return this; }
    }
    const $ = value => typeof value === 'string' ? new Element(value) : value;
    const EditorWidget = vm.runInNewContext(`${source.slice(first, last)}
SpriteSelectWidget;`,
        { $, install_hint_handler() {} });
    const actor = { states: [{ properties: { name: 'Held' }, frames: [{ src: 'actor.png' }] }] };
    const impact = { states: [{ properties: { name: 'Funken' }, frames: [{ src: 'spark.png' }] }] };
    const sprites = [actor, impact];
    let selected = 'none';
    const container = new Element('div');
    const picker = new EditorWidget({ container, label: 'Treffereffekt:',
        sprites: () => sprites, get: () => selected, set: value => { selected = value; } });
    assert.equal(picker.previewLabel.value, 'aus');
    picker.button.trigger('click');
    assert.equal(picker.menu.children.length, 3);
    assert.equal(picker.menu.children[2].children[0].attributes.src, 'spark.png');
    assert.equal(picker.menu.children[2].children[1].value, 'Funken');
    picker.menu.children[2].trigger('click');
    assert.equal(selected, '1');
    assert.equal(picker.previewImage.attributes.src, 'spark.png');
    assert.equal(picker.previewLabel.value, 'Funken');
    impact.states[0].frames[0].src = 'updated.png';
    picker.refresh();
    assert.equal(picker.previewImage.attributes.src, 'updated.png');
    impact.states[0].properties.name = 'Neuer Funken';
    picker.refresh();
    assert.equal(picker.previewLabel.value, 'Neuer Funken');
    sprites.reverse();
    selected = '0'; // remap_hit_sprite_references updates the saved index.
    picker.refresh();
    assert.equal(picker.previewImage.attributes.src, 'updated.png');
    picker.button.trigger('click');
    assert.equal(picker.menu.children[1].children[0].attributes.src, 'updated.png');
    assert.equal(picker.menu.children[1].attributes['aria-pressed'], 'true');
    picker.menu.children[0].trigger('click');
    assert.equal(selected, 'none');
    assert.equal(picker.previewLabel.value, 'aus');
});

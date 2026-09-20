const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { CombatSystem } = require('../src/static/combat.js');

const app = fs.readFileSync(require.resolve('../src/static/app.js'), 'utf8');
const start = app.indexOf('class Character {');
const end = app.indexOf('\nclass VariableClock {', start);
assert.ok(start >= 0 && end > start);
const Character = new Function('resolved_character_attacks',
    `${app.slice(start, end)}\nreturn Character;`)(() => []);

class AtlasMaterial {
    constructor(texture = 'atlas') {
        this.uniforms = { texture1: { value: texture } };
        this.fragmentShader = 'original';
        this.disposed = false;
    }
    clone() { return new AtlasMaterial(this.uniforms.texture1.value); }
    dispose() { this.disposed = true; }
}
function fixture(role, setting) {
    const base = new AtlasMaterial();
    const sprite = {
        width: 16, height: 16,
        traits: { [role]: { energy: 30, ex_top: 1, ex_left: 1, ex_right: 1,
            ...(setting === undefined ? {} : { hit_feedback: setting }) } },
        states: [{ traits: { [role]: { right: {} } },
            properties: { fps: 8 }, frames: [{}] }],
    };
    let time = 0;
    const game = { data: { sprites: [sprite] }, running: true,
        energy: 100, lives: 3, reached_flag: false, ts_zoom_actor: -1,
        clock: { getElapsedTime: () => time },
        curtain: { showing: false }, update_stats() {}, baddies: [],
        geometry_and_material_for_frame: [[[{ geometry: 'normal', material: base }]]],
    };
    function add() {
        const mesh = { material: base, geometry: 'normal',
            position: { x: 0, y: 0 }, scale: { x: 1 } };
        const c = new Character(game, 0, mesh);
        if (role === 'actor') game.player_character = c;
        else game.baddies.push(c);
        return c;
    }
    return { add, game, sprite, base, advance: dt => { time += dt; } };
}

test('chosen colour tints only the struck instance and retains atlas alpha', () => {
    const { add, base, advance, sprite } = fixture('baddie',
        { kind: 'color', color: '#12c0ff' });
    const originalJSON = JSON.stringify(sprite);
    const a = add(), b = add();
    a.flash_on_hit();
    a.update_state_and_direction('stand', 'right');
    b.update_state_and_direction('stand', 'right');
    assert.notEqual(a.mesh.material, base);
    assert.equal(b.mesh.material, base);
    assert.equal(base.fragmentShader, 'original');
    assert.match(a.mesh.material.fragmentShader, /0\.0706, 0\.7529, 1\.0000/);
    assert.match(a.mesh.material.fragmentShader, /pixel\.a/);
    assert.equal(a.mesh.material.uniforms.texture1.value, base.uniforms.texture1.value);
    const first = a.mesh.material;
    advance(0.06);
    a.update_state_and_direction('stand', 'right');
    assert.equal(a.mesh.material, first);
    advance(0.2);
    a.update_state_and_direction('stand', 'right');
    assert.equal(a.mesh.material, base);
    a.dispose_hit_flash();
    assert.equal(first.disposed, true);
    assert.equal(JSON.stringify(sprite), originalJSON);
});

test('Ausblenden discards pixels, aus skips feedback, missing setting stays red', () => {
    const hidden = fixture('baddie', { kind: 'hide' });
    const baddie = hidden.add();
    baddie.flash_on_hit();
    baddie.update_state_and_direction('stand', 'right');
    assert.match(baddie.mesh.material.fragmentShader, /discard/);
    hidden.advance(0.2);
    baddie.update_state_and_direction('stand', 'right');
    assert.equal(baddie.mesh.material, hidden.base);

    const disabled = fixture('actor', { kind: 'none' });
    const actor = disabled.add();
    actor.flash_on_hit();
    assert.equal(actor.hit_flash_until, 0);
    actor.update_state_and_direction('stand', 'right');
    assert.equal(actor.mesh.material, disabled.base);

    const legacy = fixture('actor');
    const player = legacy.add();
    player.flash_on_hit();
    player.update_state_and_direction('stand', 'right');
    assert.match(player.mesh.material.fragmentShader, /1\.0000, 0\.2510, 0\.2510/);
});

test('dead baddie has normal death material even when the hide flash was running', () => {
    const { add, base } = fixture('baddie', { kind: 'hide' });
    const enemy = add();
    enemy.flash_on_hit();
    enemy.update_state_and_direction('stand', 'right');
    enemy.take_damage(30);
    assert.equal(enemy.active, false);
    assert.equal(enemy.hit_flash_until, 0);
    assert.equal(enemy.mesh.material, base);
});

test('descriptive applied tags and short dropdown labels are kept separate', () => {
    const source = fs.readFileSync(require.resolve('../src/static/traits.js'), 'utf8');
    const metadata = vm.runInNewContext(source + '\n({ STATE_TRAITS, STATE_TRAITS_ORDER });');
    for (const [role, noun] of [['actor', 'Spielfigur'], ['baddie', 'Gegner']]) {
        assert.equal(metadata.STATE_TRAITS[role].right.label, `${noun} schaut nach rechts`);
        assert.match(metadata.STATE_TRAITS[role].attack_right.label, new RegExp(noun));
        assert.match(metadata.STATE_TRAITS[role].hit_right.label, new RegExp(noun));
        const menuSource = fs.readFileSync(require.resolve('../src/static/game.js'), 'utf8');
        assert.match(menuSource, /x\.split\('_'\)\.at\(-1\)/);
    }
});

test('editor controls save target settings only when changed', () => {
    const source = fs.readFileSync(require.resolve('../src/static/game.js'), 'utf8');
    const begin = source.indexOf('    add_hit_feedback_controls(div, si, role) {');
    const end = source.indexOf('    add_melee_attack_trait_controls(div, si) {', begin);
    assert.ok(begin >= 0 && end > begin);
    const widgets = [];
    const Editor = new Function('SelectWidget', 'ColorWidget',
        `return class Editor { ${source.slice(begin, end)} }`)(
        class { constructor(options) { widgets.push({ type: 'select', ...options }); } },
        class { constructor(options) { widgets.push({ type: 'color', ...options }); } });
    const editor = new Editor();
    editor.data = { sprites: [{ traits: { actor: {}, baddie: {} } }] };
    editor.build_sprite_traits_menu = () => {};
    editor.add_hit_feedback_controls({}, 0, 'actor');
    assert.equal(JSON.stringify(editor.data.sprites[0].traits.actor), '{}');
    assert.equal(widgets[0].get(), 'color');
    assert.equal(widgets[1].get(), '#ff4040');
    widgets[1].set('#0088ff');
    assert.deepEqual(editor.data.sprites[0].traits.actor.hit_feedback,
        { kind: 'color', color: '#0088ff' });
    widgets.length = 0;
    editor.add_hit_feedback_controls({}, 0, 'baddie');
    widgets[0].set('hide');
    assert.equal(editor.data.sprites[0].traits.baddie.hit_feedback.kind, 'hide');
    widgets.length = 0;
    editor.add_hit_feedback_controls({}, 0, 'baddie');
    assert.equal(widgets.length, 1); // No colour picker while hiding.
    widgets[0].set('none');
    assert.equal(editor.data.sprites[0].traits.baddie.hit_feedback.kind, 'none');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { figure_state_table, who_shows_what, object_state_roles, figure_trait } = require('../src/static/who_shows_what.js');

// The real Character class of the game (as in combat_character_states.test.cjs)
const source = fs.readFileSync(require.resolve('../src/static/app.js'), 'utf8');
const begin = source.indexOf('class Character {');
const end = source.indexOf('\nclass VariableClock {', begin);
const Character = new Function('resolved_character_attacks', 'companion_abilities',
    `const console = { log() {} };\n${source.slice(begin, end)}\nreturn Character;`)(() => [], () => ({ vrun: 1, vjump: 1, jump: true }));

function game_table(sprite) {
    const game = {
        data: { sprites: [sprite] }, energy: 100, lives: 3, running: true, reached_flag: false, ts_zoom_actor: -1,
        clock: { getElapsedTime: () => 0 },
        geometry_and_material_for_frame: [sprite.states.map((state, si) => state.frames.map((_, fi) => ({ geometry: `${si}:${fi}`, material: `${si}:${fi}` })))],
        update_stats() {}, curtain: { showing: false, show() {}, show_screen() {} }, baddies: [],
    };
    const c = new Character(game, 0, { position: { x: 0, y: 0 }, scale: { x: 1 } });
    return c.sti_for_state;
}

const TAGS = ['front', 'back', 'left', 'right', 'walk_left', 'walk_right', 'walk_front', 'jump_left', 'jump_right',
    'fall_left', 'fall_right', 'fall_front', 'climb', 'dead', 'attack_right', 'attack_left', 'hit_front', 'swim_left', 'fly_right'];

function sprite_with(trait, states) {
    return {
        width: 16, height: 16,
        traits: { [trait]: { energy: 30, ex_top: 1, ex_left: 1, ex_right: 1 } },
        states: states.map(tags => ({ traits: { [trait]: Object.fromEntries(tags.map(t => [t, {}])) }, properties: { name: tags.join('+') }, frames: [{}] })),
    };
}

// a small deterministic random generator
function rng(seed) {
    return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}

test('the overview builds the same table as the game, for many sprites', () => {
    const random = rng(7);
    for (const trait of ['actor', 'baddie', 'companion']) {
        for (let n = 0; n < 150; n++) {
            const count = 1 + Math.floor(random() * 5);
            const states = Array.from({ length: count }, () => TAGS.filter(() => random() < 0.15));
            const sprite = sprite_with(trait, states);
            const ours = figure_state_table(sprite, trait);
            const theirs = JSON.parse(JSON.stringify(game_table(sprite)));
            assert.deepEqual(ours, theirs, JSON.stringify(states));
        }
    }
});

test('drawn, mirrored, another picture, missing', () => {
    // 0: stehen rechts, 1: laufen rechts
    const sprite = sprite_with('actor', [['right'], ['walk_right']]);
    const { rows } = who_shows_what(sprite);
    const row = (kind) => rows.find(r => r.kind === kind);
    const cell = (kind, dir) => row(kind).cells.find(c => c.dir === dir);
    assert.equal(cell('stand', 'right').how, 'drawn');
    assert.equal(cell('stand', 'left').how, 'mirrored');
    assert.equal(cell('stand', 'left').flipped, true);
    assert.equal(cell('walk', 'right').how, 'drawn');
    assert.equal(cell('walk', 'left').how, 'mirrored');
    assert.equal(cell('jump', 'right').how, 'other');           // stehen rechts
    assert.match(cell('jump', 'right').text, /zeigt Stehen rechts/);
    assert.equal(cell('stand', 'front').how, 'missing');       // the first state
    assert.equal(row('climb').cells[0].how, 'missing');
    assert.equal(row('dead').cells[0].how, 'missing');
    assert.ok(!row('attack'));                                  // a pose only once it exists
    assert.equal(figure_trait({ traits: { baddie: {}, companion: {} } }), 'baddie');
    assert.equal(who_shows_what({ traits: { door: {} }, states: [] }), null);
});

test('poses: the other side mirrored, front from the side', () => {
    const sprite = sprite_with('baddie', [['left', 'right'], ['attack_right']]);
    const row = who_shows_what(sprite).rows.find(r => r.kind === 'attack');
    assert.deepEqual(row.cells.map(c => [c.dir, c.how, c.flipped]), [['left', 'mirrored', true], ['right', 'drawn', false], ['front', 'other', false]]);
    assert.ok(!who_shows_what(sprite).rows.some(r => r.kind === 'climb'));
});

test('objects: which state shows what', () => {
    const sprite = { traits: { door: {} }, states: [{ traits: { door: { closed: {} } } }, { traits: { door: { open: {} } } }] };
    assert.deepEqual(object_state_roles(sprite).map(r => [r.role, r.sti]), [['closed', 0], ['open', 1], ['transition', null]]);
});

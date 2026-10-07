const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// the labels children see (traits.js): the texts quote them
globalThis.SPRITE_TRAITS = vm.runInNewContext(fs.readFileSync(require.resolve('../src/static/traits.js'), 'utf8') + '\n SPRITE_TRAITS;');
Object.assign(globalThis, require('../src/static/level_flow.js'));
Object.assign(globalThis, require('../src/static/signals.js'));
Object.assign(globalThis, require('../src/static/level_map.js'));
Object.assign(globalThis, require('../src/static/game_ids.js'));
const { sprite_pitfalls, game_pitfalls, play_check_live } = require('../src/static/level_check.js');

const sprite = (id, name, traits) => ({ id, properties: { name }, traits, states: [] });
const ids = (found) => found.map(f => f.id);
const plays = { collision_detection: true, parallax: 0 };
const level = (sprites, more = {}, layers = null) => ({ id: more.id ?? 'l', properties: { use_level: true, name: '', ...more },
    layers: layers ?? [{ type: 'sprites', properties: plays, sprites }] });

test('an exit, key, checkpoint or trap that can be collected is gone before it works', () => {
    const exit = sprite_pitfalls({ traits: { level_complete: {}, pickup: {} } }, 'Ziel');
    assert.deepEqual(ids(exit), ['collected_first']);
    assert.match(exit[0].text, /»Ziel« hat „man kann es einsammeln“ und „Levelwechsel“/);
    assert.match(exit[0].text, /wechselt das Level nie/);
    assert.match(exit[0].text, /Nimm „man kann es einsammeln“ weg/);

    const key = sprite_pitfalls({ traits: { key: {}, pickup: { points: 5 } } }, 'Schlüssel');
    assert.deepEqual(ids(key), ['collected_first']);
    assert.match(key[0].text, /öffnet keine Tür/);
    assert.match(key[0].text, /Ein Schlüssel wird ohnehin eingesammelt/);

    const several = sprite_pitfalls({ traits: { pickup: {}, checkpoint: {}, trap: {} } }, 'X')[0].text;
    assert.match(several, /wird der Checkpoint nie aktiv und schadet die Falle nie/);

    // a key takes an exit along, too – two sprites are the way out
    const key_exit = sprite_pitfalls({ traits: { key: {}, level_complete: {} } }, 'Tor');
    assert.deepEqual(ids(key_exit), ['key_first']);
    assert.match(key_exit[0].text, /zwei Sprites: einen Schlüssel und einen Ausgang/);

    // what works stays quiet: a weapon to collect, a coin, a key, an exit
    for (const traits of [{ pickup: {}, melee_attack: {} }, { pickup: { points: 10 } }, { key: {} }, { level_complete: {} }, { pickup: {}, block_above: {} }])
        assert.deepEqual(sprite_pitfalls({ traits }, 'S'), [], JSON.stringify(traits));
});

test('solid from every side, it is never touched; a trap one can stand on hurts only from the side', () => {
    const solid = { block_above: {}, block_sides: {}, block_below: {} };
    const coin = sprite_pitfalls({ traits: { pickup: {}, ...solid } }, 'Münze');
    assert.deepEqual(ids(coin), ['solid_untouched']);
    assert.match(coin[0].text, /kann man es nie einsammeln/);
    assert.match(sprite_pitfalls({ traits: { level_complete: {}, ...solid } }, 'Ziel')[0].text, /wechselt das Level nie/);
    assert.deepEqual(sprite_pitfalls({ traits: solid }, 'Boden'), []);
    const spikes = sprite_pitfalls({ traits: { trap: {}, block_above: {} } }, 'Stacheln');
    assert.deepEqual(spikes.map(f => [f.id, f.severity]), [['trap_stand_on', 'hint']]);
});

test('what makes an object does nothing on a figure', () => {
    const enemy = sprite_pitfalls({ traits: { baddie: {}, pickup: { points: 7 }, block_above: {} } }, 'Glibber');
    assert.deepEqual(ids(enemy), ['figure_object']);
    assert.match(enemy[0].text, /»Glibber« ist ein Gegner\. „man kann es einsammeln“ und „man kann nicht von oben reinfallen“ wirken bei einer Figur nicht/);
    const both = sprite_pitfalls({ traits: { actor: {}, baddie: {} } }, 'Pip');
    assert.deepEqual(ids(both), ['two_figures']);
    assert.match(both[0].text, /nur die Spielfigur/);
    // a figure with its own things is fine
    assert.deepEqual(sprite_pitfalls({ traits: { actor: {}, melee_attack: {}, ranged_attack: {} } }, 'Pip'), []);
    assert.deepEqual(sprite_pitfalls({ traits: { baddie: {}, smart: {} } }, 'Glibber'), []);
});

test('a Leben the figure cannot take while it has all of them', () => {
    const heart = { traits: { pickup: { lives: 1 } } };
    // absent settings are 5 and 5 (game.js)
    const found = sprite_pitfalls(heart, 'Herz', {});
    assert.deepEqual(found.map(f => [f.id, f.severity]), [['lives_full', 'hint']]);
    assert.match(found[0].text, /schon am Anfang 5 Leben, und mehr als 5 kann sie nicht haben/);
    assert.match(found[0].text, /„Leben maximal“ höher/);
    assert.deepEqual(sprite_pitfalls(heart, 'Herz', { lives_at_begin: 3, max_lives: 5 }), []);
    assert.deepEqual(sprite_pitfalls(heart, 'Herz', null), []);
});

test('levels: no Spielfigur, two, one in a picture layer, things that only look like they play', () => {
    const sprites = [sprite('pip', 'Pip', { actor: {} }), sprite('coin', 'Münze', { pickup: {} }),
        sprite('ground', 'Boden', { block_above: {} }), sprite('exit', 'Ziel', { level_complete: {} })];
    const backdrop = { collision_detection: false, parallax: 0 };
    const data = { properties: {}, sprites, levels: [
        level([['ground', 0, 0], ['exit', 48, 0]], { id: 'a' }),
        level([['pip', 0, 24], ['pip', 48, 24], ['exit', 96, 0]], { id: 'b' }),
        level(null, { id: 'c' }, [
            { type: 'sprites', properties: backdrop, sprites: [['pip', 0, 24], ['coin', 24, 24], ['coin', 48, 24], ['ground', 0, 0]] },
            { type: 'sprites', properties: plays, sprites: [['exit', 96, 0]] }]),
        level([['pip', 0, 24], ['coin', 24, 24], ['exit', 96, 0]], { id: 'd' }),
        level([], { id: 'draft', use_level: false }),
    ] };
    const found = game_pitfalls(data);
    const by_level = (li) => found.filter(f => f.level_index === li).map(f => f.id);
    assert.deepEqual(by_level(0), ['no_player']);
    assert.deepEqual(by_level(1), ['two_players']);
    assert.deepEqual(found.find(f => f.id === 'two_players').place, { layer_index: 0, placed_index: 0 });
    assert.deepEqual(by_level(2), ['layer_without_play', 'player_in_picture']);
    assert.match(found.find(f => f.id === 'layer_without_play').text, /»Münze« \(2×\)\. Die Ebene hat keine Kollisionen/);
    assert.deepEqual(by_level(3), []);
    assert.deepEqual(by_level(4), []);           // a draft is not checked
    // a picture layer that is plain decoration says nothing (ground in the backdrop)
    assert.ok(!found.find(f => f.id === 'layer_without_play').text.includes('Boden'));
    assert.equal(found.find(f => f.id === 'layer_without_play').severity, 'problem');
    // only a figure in the backdrop (a bird): maybe a picture on purpose
    const bird = { properties: {}, sprites: [...sprites, sprite('bird', 'Vogel', { baddie: {} })], levels: [
        level(null, {}, [{ type: 'sprites', properties: { collision_detection: true, parallax: 0.5 }, sprites: [['bird', 0, 90]] },
            { type: 'sprites', properties: plays, sprites: [['pip', 0, 24], ['exit', 96, 0]] }])] };
    const hint = game_pitfalls(bird).find(f => f.id === 'layer_without_play');
    assert.equal(hint.severity, 'hint');
    assert.match(hint.text, /»Vogel«\. Die Ebene hat eine Parallaxe/);
});

test('a sprite is checked once, where it is placed; Level testen checks only that level', () => {
    const sprites = [sprite('pip', 'Pip', { actor: {} }), sprite('gate', 'Tor', { level_complete: {}, pickup: {} }),
        sprite('unused', 'Herz', { pickup: { lives: 1 }, level_complete: {} })];
    const data = { properties: { lives_at_begin: 3, max_lives: 5 }, sprites, levels: [
        level([['pip', 0, 24], ['gate', 48, 0]], { id: 'a' }),
        level([['pip', 0, 24], ['gate', 48, 0]], { id: 'b' }),
        level([], { id: 'c' }),
    ] };
    const all = game_pitfalls(data);
    assert.deepEqual(all.filter(f => f.sprite_index !== null).map(f => [f.sprite_index, f.id]), [[1, 'collected_first']]);
    // only level c: Tor is not placed there, the level has no Spielfigur
    const only_c = game_pitfalls(data, { level_indices: [2] });
    assert.deepEqual(only_c.map(f => f.id), ['no_player']);
});

test('the Levelübersicht and the Signale-Übersicht speak here, too', () => {
    const sprites = [sprite('pip', 'Pip', { actor: {} }), sprite('door', 'Tür', { door: { lockable: true } }),
        sprite('lever', 'Hebel', { switch: {} }), sprite('exit', 'Ziel', { level_complete: {} })];
    const data = { properties: {}, sprites, levels: [
        level([['pip', 0, 24], ['door', 48, 0, { door: { signal_code: 4 } }], ['exit', 96, 0, { level_complete: { target: 'gone' } }]], { id: 'a' }),
        level([['pip', 0, 24], ['lever', 48, 0, { switch: { signal_code: 7 } }], ['exit', 96, 0]], { id: 'b' }),
    ] };
    const found = game_pitfalls(data);
    const a = found.filter(f => f.level_index === 0);
    assert.ok(a.some(f => f.id === 'level_map' && /nicht mehr gibt/.test(f.text)), JSON.stringify(a));
    const waiting = a.find(f => f.id === 'signal_no_sender');
    assert.ok(waiting, JSON.stringify(a));
    assert.match(waiting.text, /Auf Code 4 wartet etwas/);
    assert.deepEqual(waiting.place, { layer_index: 0, placed_index: 1 });
    const b = found.filter(f => f.level_index === 1);
    assert.deepEqual(b.map(f => [f.id, f.severity]), [['signal_no_receiver', 'hint']]);
    assert.match(b[0].text, /Code 7 gesendet – aber nichts in diesem Level reagiert darauf/);
});

test('while the game runs: a Leben the figure walks over with all its lives, an exit still closed', () => {
    const touch = {};
    const player = {
        sprite: { width: 24, height: 24 }, traits: { ex_left: 0.7, ex_right: 0.7, ex_top: 1 }, dead: () => false,
        has_trait_at: (traits, x0, x1, y0, y1, accept) => {
            const entry = touch[traits[0]] ?? null;
            return entry && (!accept || accept(entry)) ? entry : null;
        },
    };
    const game = { running: true, lives: 5, level_index: 0, reached_flag: false, player_character: player,
        data: { properties: { max_lives: 5 }, sprites: [{ traits: { pickup: { lives: 1 } } }, { traits: { level_complete: {} } }],
            levels: [{ properties: { signal_names: { 3: 'Brücke' } } }] } };
    const name_of = (si) => ['Herz', 'Ziel'][si];
    assert.deepEqual(play_check_live(game, name_of), []);
    touch.pickup = { sprite_index: 0, entry_index: 4 };
    let hints = play_check_live(game, name_of);
    assert.deepEqual(hints.map(h => h.key), ['lives_full:0']);
    assert.match(hints[0].text, /»Herz« gibt Leben, aber die Spielfigur hat schon 5 – mehr als 5 geht nicht/);
    game.lives = 4;
    assert.deepEqual(play_check_live(game, name_of), []);
    // a shop item is bought, not collected: not this
    touch.pickup.shop_price = 10;
    game.lives = 5;
    assert.deepEqual(play_check_live(game, name_of), []);
    touch.level_complete = { sprite_index: 1, entry_index: 9, exit_open: false, exit_gate_code: 3 };
    hints = play_check_live(game, name_of);
    assert.deepEqual(hints.map(h => h.key), ['exit_closed:0:9']);
    assert.match(hints[0].text, /Der Ausgang »Ziel« ist noch zu\. Er öffnet sich erst, wenn »Brücke« \(Code 3\) ankommt/);
    touch.level_complete.exit_open = true;
    assert.deepEqual(play_check_live(game, name_of), []);
    game.running = false;
    touch.level_complete.exit_open = false;
    assert.deepEqual(play_check_live(game, name_of), []);
});

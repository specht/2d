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
const { sprite_pitfalls, game_pitfalls, play_check_live, level_check_points } = require('../src/static/level_check.js');

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
    // a locked door that waits for a Code: said about the door
    const waiting = a.find(f => f.id === 'door_never_opens');
    assert.ok(waiting, JSON.stringify(a));
    assert.match(waiting.text, /Die Tür »Tür« ist verschließbar, aber in diesem Level gibt es keinen Schlüssel, Schalter und keine Druckplatte mit Code 4/);
    assert.deepEqual(waiting.place, { layer_index: 0, placed_index: 1 });
    assert.ok(!a.some(f => f.id === 'signal_no_sender'));
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

test('Tür-, Schalter- und Druckplatten-Check: both pictures are needed', () => {
    const state = (traits) => ({ traits, frames: [{}], properties: {} });
    const door = (states) => sprite_pitfalls({ traits: { door: {} }, states }, 'Tor');
    assert.deepEqual(ids(door([state({ door: { closed: {} } }), state({ door: { open: {} } })])), []);
    const no_open = door([state({ door: { closed: {} } })]);
    assert.deepEqual(ids(no_open), ['door_states']);
    assert.match(no_open[0].text, /^Tür-Check: »Tor« ist eine Tür, aber kein Zustand hat die Rolle „geöffnet“\. Ohne „geöffnet“ geht die Tür nie auf/);
    assert.match(no_open[0].text, /„Rolle zuweisen“ die Rolle „geöffnet“\.$/);
    const none = door([state({})]);
    assert.match(none[0].text, /die Rollen „geschlossen“ und „geöffnet“/);
    const lever = sprite_pitfalls({ traits: { switch: {} }, states: [state({ switch: { off: {} } })] }, 'Hebel');
    assert.deepEqual(lever.map(f => [f.id, f.severity]), [['switch_states', 'problem']]);
    assert.match(lever[0].text, /^Schalter-Check: .*„Schalter ist an“/);
    const plate = sprite_pitfalls({ traits: { pressure_plate: {} }, states: [] }, 'Platte');
    assert.match(plate[0].text, /^Druckplatten-Check: .*„Druckplatte nicht gedrückt“ und „Druckplatte gedrückt“/);
});

test('a key and a door that do not work together', () => {
    const state = (traits) => ({ traits, frames: [{}], properties: {} });
    const both = [state({ door: { closed: {} } }), state({ door: { open: {} } })];
    const sprites = [sprite('pip', 'Pip', { actor: {} }), { ...sprite('door', 'Tor', { door: { lockable: true } }), states: both },
        { ...sprite('gate', 'Gartentor', { door: { lockable: false } }), states: both }, sprite('key', 'Schlüssel', { key: {} })];
    const check = (levels) => game_pitfalls({ properties: {}, sprites, levels }).filter(f => f.level_index !== null);
    // another Code: one finding about the pair, nothing about a Code nobody sends
    const mismatch = check([level([['pip', 0, 24], ['door', 48, 0, { door: { signal_code: 3 } }], ['key', 24, 0, { key: { signal_code: 2 } }]])]);
    assert.deepEqual(mismatch.map(f => f.id), ['door_never_opens']);
    assert.match(mismatch[0].text, /wartet auf Code 3, aber der Schlüssel »Schlüssel« hat Code 2\. .* Gib beiden denselben Code\./);
    // the same Code: nothing to say
    assert.deepEqual(check([level([['pip', 0, 24], ['door', 48, 0, { door: { signal_code: 3 } }], ['key', 24, 0, { key: { signal_code: 3 } }]])]), []);
    // the key in one level, the door in the next: a key opens doors only in its own level
    const apart = check([level([['pip', 0, 24], ['key', 24, 0, { key: { signal_code: 5 } }]], { id: 'a', name: 'Wald' }),
        level([['pip', 0, 24], ['door', 48, 0, { door: { signal_code: 5 } }]], { id: 'b', name: 'Burg' })]);
    assert.deepEqual(apart.map(f => [f.id, f.level_index, f.severity]), [['key_no_door', 0, 'problem'], ['door_never_opens', 1, 'problem']]);
    assert.match(apart[0].text, /Die Tür mit diesem Code liegt in »Burg«/);
    assert.match(apart[1].text, /liegt in »Wald« – aber ein Schlüssel öffnet nur Türen in seinem eigenen Level/);
    // a door that is not locked opens anyway: the key is not needed
    const unlocked = check([level([['pip', 0, 24], ['gate', 48, 0, { door: { signal_code: 1 } }], ['key', 24, 0, { key: { signal_code: 1 } }]])]);
    assert.deepEqual(unlocked.map(f => [f.id, f.severity]), [['key_door_unlocked', 'hint']]);
    assert.match(unlocked[0].text, /»Gartentor« – aber die Tür ist nicht verschließbar/);
});

// Zustände with roles: what has pictures for its states is checked for them
const st = (name, traits = {}) => ({ properties: { name }, traits, frames: [] });

test('a figure without roles always shows its first Zustand; a Zustand without a role is never shown', () => {
    const plain = { traits: { actor: {} }, states: [st('Stehen'), st('Laufen'), st('Springen')] };
    const found = sprite_pitfalls(plain, 'Pip');
    assert.deepEqual(found.map(f => [f.id, f.severity]), [['figure_no_roles', 'problem']]);
    assert.match(found[0].text, /»Pip« hat 3 Zustände, aber keiner hat eine Rolle\. Darum zeigt das Spiel immer nur den ersten, »Stehen«/);
    assert.match(found[0].text, /„Spielfigur läuft nach rechts“/);
    const enemy = sprite_pitfalls({ traits: { baddie: {} }, states: [st(''), st('')] }, 'Glibber');
    assert.match(enemy[0].text, /der Gegner läuft/);
    // roles given, one Zustand left over (an old role of a trait taken away counts for nothing)
    const left = sprite_pitfalls({ traits: { actor: {} }, states: [st('a', { actor: { right: {} } }), st('b', { actor: { walk_right: {} } }),
        st('', { baddie: { front: {} } })] }, 'Pip');
    assert.deepEqual(left.map(f => [f.id, f.severity]), [['figure_state_unused', 'hint']]);
    assert.match(left[0].text, /Der Zustand »Zustand 3« von »Pip« hat keine Rolle und wird im Spiel nie gezeigt/);
    // one Zustand, or every Zustand with a role: nothing to say
    assert.deepEqual(sprite_pitfalls({ traits: { actor: {} }, states: [st('a')] }, 'Pip'), []);
    assert.deepEqual(sprite_pitfalls({ traits: { companion: {}, text: {} }, states: [st('a', { companion: { front: {} } }), st('b', { text: { speaking: {} } })] }, 'Hund'), []);
});

test('both pictures in one Zustand; a checkpoint that never shows it is active', () => {
    const door = sprite_pitfalls({ traits: { door: {} }, states: [st('Tür', { door: { closed: {}, open: {} } })] }, 'Tür');
    assert.deepEqual(ids(door), ['door_same_state']);
    assert.match(door[0].text, /Der Zustand »Tür« hat beide Rollen, „geschlossen“ und „geöffnet“\. So sieht es immer gleich aus/);
    const lever = sprite_pitfalls({ traits: { switch: {} }, states: [st('', { switch: { off: {}, on: {} } })] }, 'Hebel');
    assert.deepEqual(ids(lever), ['switch_same_state']);
    const gate = sprite_pitfalls({ traits: { level_complete: {} }, states: [st('Tor', { level_complete: { closed: {}, open: {} } })] }, 'Tor');
    assert.deepEqual(ids(gate), ['level_complete_same_state']);
    assert.match(gate[0].text, /„Ausgang zu“ und „Ausgang offen“/);
    // the checkpoint: a hint, and only for a sprite that has Zustände
    const flag = sprite_pitfalls({ traits: { checkpoint: {} }, states: [st('Fahne')] }, 'Fahne');
    assert.deepEqual(flag.map(f => [f.id, f.severity]), [['checkpoint_state', 'hint']]);
    assert.match(flag[0].text, /„Checkpoint aktiviert“/);
    assert.deepEqual(sprite_pitfalls({ traits: { checkpoint: {} }, states: [st('a'), st('b', { checkpoint: { active: {} } })] }, 'Fahne'), []);
});

test('a bomb needs its explosion – at the bomb, and at the figure that throws it', () => {
    const silent = sprite_pitfalls({ traits: { bomb: {} }, states: [st('Bombe')] }, 'Bombe');
    assert.deepEqual(ids(silent), ['bomb_states']);
    assert.match(silent[0].text, /man sieht keine Explosion/);
    // the old way: a Zustand named "Explosion" counts
    assert.deepEqual(sprite_pitfalls({ traits: { bomb: {} }, states: [st('Bombe'), st('Explosion')] }, 'Bombe'), []);
    // only the explosion drawn, first: it flies as an explosion
    assert.deepEqual(ids(sprite_pitfalls({ traits: { bomb: {} }, states: [st('', { bomb: { explosion: {} } })] }, 'Bombe')), ['bomb_fuse']);

    const bomb = { id: 'bomb', properties: { name: 'Kirsche' }, traits: {}, states: [st('a')] };
    const thrower = { id: 'pip', traits: { actor: { attacks: [{ delivery: { detonation: { fuse_s: 2 } }, visual: { projectile_sprite_id: 'bomb' } },
        { delivery: {}, visual: { projectile_sprite_id: 'bomb' } }] } }, states: [st('a')] };
    const sprite_of = (ref) => (ref === 'bomb' ? bomb : null);
    const found = sprite_pitfalls(thrower, 'Pip', null, { sprite_of });
    assert.deepEqual(ids(found), ['bomb_no_explosion']);
    assert.match(found[0].text, /»Pip« wirft eine Bombe, aber »Kirsche« hat keinen Zustand mit der Rolle „Explosion“.*Gib dem Bomben-Sprite die Eigenschaft „Bombe“/);
    bomb.states.push(st('', { bomb: { explosion: {} } }));
    assert.deepEqual(sprite_pitfalls(thrower, 'Pip', null, { sprite_of }), []);
    // in the whole game: the figure placed, the bomb not
    bomb.states.pop();
    const data = { properties: {}, sprites: [thrower, bomb], levels: [level([['pip', 0, 24]])] };
    assert.ok(game_pitfalls(data).some(f => f.id === 'bomb_no_explosion' && f.sprite_index === 0));
});

test('placed copies: an empty sign, a gated exit and a Zähler without their pictures', () => {
    const sprites = [sprite('pip', 'Pip', { actor: {} }), sprite('sign', 'Schild', { text: {} }),
        { ...sprite('gate', 'Tor', { level_complete: {} }), states: [st('zu', { level_complete: { closed: {} } })] },
        { ...sprite('count', 'Anzeige', { counter: {} }), states: [st('', { counter: { waiting: {} } }), st('', { counter: { count_1: {} } }), st('', { counter: { done: {} } })] },
        sprite('lever', 'Hebel', { switch: {} })];
    const data = { properties: {}, sprites, levels: [level([['pip', 0, 24],
        ['sign', 24, 0], ['sign', 48, 0, { text: { text: ' | ' } }], ['sign', 72, 0, { text: { text: 'Hallo!' } }],
        ['sign', 96, 0, { text: { shop_keeper: true } }],
        ['gate', 120, 0, { level_complete: { opens_on_signal: true, signal_code: 1 } }], ['gate', 144, 0],
        ['count', 0, 48, { counter: { signal_code: 1, count: 3 } }],
        ['lever', 0, 72, { switch: { signal_code: 1 } }], ['lever', 24, 72, { switch: { signal_code: 1 } }], ['lever', 48, 72, { switch: { signal_code: 1 } }]])] };
    const found = game_pitfalls(data).filter(f => f.level_index === 0);
    const sign = found.find(f => f.id === 'sign_empty');
    assert.equal(sign.severity, 'hint');
    assert.match(sign.text, /Das Schild »Schild« \(2×\) hat keinen Text/);
    assert.deepEqual(sign.place, { layer_index: 0, placed_index: 1 });
    const gate = found.filter(f => f.id === 'exit_gate_states');
    assert.equal(gate.length, 1);
    assert.match(gate[0].text, /Der Ausgang »Tor« öffnet erst bei Signal, aber kein Zustand hat die Rolle „Ausgang offen“/);
    const counter = found.find(f => f.id === 'counter_states');
    assert.match(counter.text, /Der Zähler »Anzeige« zählt bis 3 .* es fehlen die Rolle „Zähler zeigt 2“/);
    // three switches for three: it can count to the end
    assert.ok(!found.some(f => f.id === 'counter_never_full'));
});

test('a Zähler that counts to more than there is', () => {
    const sprites = [sprite('pip', 'Pip', { actor: {} }), sprite('count', 'Zähler', { counter: {} }), sprite('lever', 'Hebel', { switch: {} }),
        sprite('door', 'Tür', { door: {} }), sprite('potion', 'Trank', { pickup: {} })];
    const base = [['pip', 0, 24], ['count', 0, 48, { counter: { signal_code: 4, count: 3, send_code: 5 } }],
        ['lever', 0, 72, { switch: { signal_code: 4 } }], ['lever', 24, 72, { switch: { signal_code: 4 } }],
        ['door', 48, 0, { door: { signal_code: 5, lockable: true } }]];
    const found = game_pitfalls({ properties: {}, sprites, levels: [level(base)] }).filter(f => f.id === 'counter_never_full');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'problem');
    assert.match(found[0].text, /Der Zähler »Zähler« zählt bis 3, aber in diesem Level senden nur 2 Dinge Code 4/);
    assert.match(found[0].text, /Stell beim Zähler „Anzahl“ auf 2/);
    // a shop item one can buy again sends each time: no limit to tell
    const shop = [...base, ['potion', 72, 0, { pickup: { price: 1, buy_again: true, signal_on_collect: true, signal_code: 4 } }]];
    assert.ok(!game_pitfalls({ properties: {}, sprites, levels: [level(shop)] }).some(f => f.id === 'counter_never_full'));
});

test('a shop item that costs more than there are points in the whole game', () => {
    const sprites = [sprite('pip', 'Pip', { actor: {} }), sprite('coin', 'Münze', { pickup: { points: 5 } }),
        sprite('sword', 'Schwert', { pickup: {} }), sprite('slime', 'Glibber', { baddie: { drop: { sprite_id: 'coin' } } })];
    const backdrop = { collision_detection: false, parallax: 0 };
    const levels = [
        level([['pip', 0, 24], ['coin', 24, 24], ['coin', 48, 24], ['slime', 72, 24]], { id: 'a' }),
        level([['pip', 0, 24], ['sword', 24, 24, { pickup: { price: 20 } }], ['sword', 48, 24, { pickup: { price: 15 } }]], { id: 'shop' }),
        // a coin in a picture layer and in a draft: nobody gets those
        level(null, { id: 'c' }, [{ type: 'sprites', properties: backdrop, sprites: [['coin', 0, 0]] },
            { type: 'sprites', properties: plays, sprites: [['pip', 0, 24]] }]),
        level([['coin', 0, 0]], { id: 'draft', use_level: false }),
    ];
    const traits_of = (ref) => sprites.find(s => s.id === ref)?.traits ?? null;
    assert.equal(level_check_points(levels, traits_of), 15);
    const found = game_pitfalls({ properties: {}, sprites, levels }).filter(f => f.id === 'shop_unaffordable');
    assert.equal(found.length, 1);
    assert.match(found[0].text, /»Schwert« kostet 20 Punkte, aber im ganzen Spiel gibt es nur 15 Punkte zu sammeln/);
    assert.equal(found[0].level_index, 1);
    // Level testen of the shop: still the points of the whole game
    assert.equal(game_pitfalls({ properties: {}, sprites, levels }, { level_indices: [1] }).filter(f => f.id === 'shop_unaffordable').length, 1);
    const none = game_pitfalls({ properties: {}, sprites: sprites.slice(0, 3), levels: [level([['pip', 0, 24], ['sword', 24, 24, { pickup: { price: 1 } }]])] });
    assert.match(none.find(f => f.id === 'shop_unaffordable').text, /gibt es keine Punkte zu sammeln\. So kann man es nie kaufen\. Leg Sachen mit „gibt Punkte“ in die Level/);
});

test('a Vorrat that gives nothing when used; a Leben in the Vorrat is collected with all lives', () => {
    assert.deepEqual(ids(sprite_pitfalls({ traits: { pickup: { store: true, points: 5 } } }, 'Münze')), ['store_nothing']);
    assert.deepEqual(sprite_pitfalls({ traits: { pickup: { store: true, speed_boost_duration: 6 } } }, 'Feder'), []);
    assert.deepEqual(sprite_pitfalls({ traits: { pickup: { store: true, lives: 1 } } }, 'Herz', { lives_at_begin: 5, max_lives: 5 }), []);
});

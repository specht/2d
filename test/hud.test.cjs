const test = require('node:test');
const assert = require('node:assert/strict');
const hud = require('../src/static/hud.js');

const sprite = (traits) => ({ width: 24, height: 24, traits, states: [] });
const game = (sprites, props = {}, placed = []) => ({ sprites, properties: { lives_at_begin: 5, show_energy: true, ...props },
    levels: [{ layers: [{ type: 'sprites', sprites: placed.map(i => [i, 0, 0]) }] }] });

test('the HUD shows only what the game uses', () => {
    // a figure and ground only: one life, nothing hurts, nothing to collect
    let plan = hud.hud_plan(game([sprite({ actor: {} }), sprite({ block_above: {} })], { lives_at_begin: 1 }));
    assert.deepEqual(plan, { lives: { show: false, sprite: null }, energy: { show: false }, coins: { show: false, sprite: null } });
    // more lives, spikes, coins and a gem: the coin is placed more often, so its picture is the counter's
    plan = hud.hud_plan(game([sprite({ actor: {} }), sprite({ trap: { damage: 10 } }), sprite({ pickup: { points: 100 } }),
        sprite({ pickup: { points: 10 } }), sprite({ pickup: { lives: 1 } })], {}, [3, 3, 3, 2, 4]));
    assert.deepEqual(plan, { lives: { show: true, sprite: 4 }, energy: { show: true }, coins: { show: true, sprite: 3 } });
    // "Energie anzeigen" off: no bar
    plan = hud.hud_plan(game([sprite({ baddie: {} })], { show_energy: false }));
    assert.equal(plan.energy.show, false);
    assert.equal(plan.lives.show, true);
    // something that gives energy is reason enough for the bar
    assert.equal(hud.hud_plan(game([sprite({ pickup: { energy: 20 } })])).energy.show, true);
    assert.equal(hud.hud_plan({}).coins.show, false);
});

test('the HUD pixel is a whole number of screen pixels, readable on every screen', () => {
    assert.equal(hud.hud_scale(720, 180), 4);       // the game's own pixel size
    assert.equal(hud.hud_scale(1080, 240), 5);      // 4.5 → 5
    assert.equal(hud.hud_scale(1080, 120), 7);      // 9 would be huge: at most 4.5 % of the height
    assert.equal(hud.hud_scale(1080, 1080), 4);     // 1 would be tiny: at least 2.5 %
    assert.equal(hud.hud_scale(200, 240), 1);
    assert.ok(Number.isInteger(hud.hud_scale(777, 333)));
});

test('hearts: as many as at the start, more when collected, a number when there are many', () => {
    assert.deepEqual(hud.hud_heart_slots(3, 5), { slots: 5, compact: false });
    assert.deepEqual(hud.hud_heart_slots(7, 5), { slots: 7, compact: false });
    assert.deepEqual(hud.hud_heart_slots(12, 3), { slots: 1, compact: true });
    assert.deepEqual(hud.hud_heart_slots(0, 0), { slots: 0, compact: false });
});

test('energy colours, and the coin counter counts', () => {
    assert.equal(hud.hud_energy_color(1), '#a7f070');
    assert.equal(hud.hud_energy_color(0.4), '#ffcd75');
    assert.equal(hud.hud_energy_color(0.1), '#ef5d57');
    assert.equal(hud.hud_energy_color(0), '#ef5d57');
    let shown = 0;
    const seen = [];
    for (let i = 0; i < 40 && shown !== 50; i++) seen.push(shown = hud.hud_count_towards(shown, 50, 1 / 60));
    assert.equal(shown, 50);
    assert.ok(seen.length > 3, 'it counts, it does not jump');
    assert.ok(seen.every((v, i) => i === 0 || v >= seen[i - 1]));
    assert.equal(hud.hud_count_towards(7, 7, 0.1), 7);
    assert.equal(hud.hud_count_towards(10, 0, 1), 0);
});

test('pictures are cut to what is drawn, halved when big, and outlined', () => {
    // a 4 × 4 picture with a 2 × 1 red bar in the middle
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (const x of [1, 2]) { const o = 4 * (1 * 4 + x); rgba.set([255, 0, 0, 255], o); }
    assert.deepEqual(hud.hud_opaque_box(rgba, 4, 4), { x: 1, y: 1, width: 2, height: 1 });
    const icon = hud.hud_icon_pixels(rgba, 4, 4);
    assert.deepEqual([icon.width, icon.height], [4, 3]);
    const at = (x, y) => [...icon.rgba.slice(4 * (y * icon.width + x), 4 * (y * icon.width + x) + 4)];
    assert.deepEqual(at(1, 1), [255, 0, 0, 255]);
    assert.deepEqual(at(0, 1), [0x1a, 0x1c, 0x2c, 255]);    // ink beside it
    assert.deepEqual(at(1, 0), [0x1a, 0x1c, 0x2c, 255]);    // and above
    assert.equal(at(0, 0)[3], 0);                            // corners stay free
    // filled in one colour (a lost heart)
    assert.deepEqual(hud.hud_icon_pixels(rgba, 4, 4, '#3b4260').rgba.slice(4 * (1 * 4 + 1), 4 * (1 * 4 + 1) + 4), new Uint8ClampedArray([0x3b, 0x42, 0x60, 255]));
    // a big picture comes at half size
    const big = new Uint8ClampedArray(24 * 24 * 4).fill(255);
    const half = hud.hud_icon_pixels(big, 24, 24);
    assert.deepEqual([half.width, half.height], [14, 14]);
    // nothing drawn: one pixel, not an error
    assert.equal(hud.hud_opaque_box(new Uint8ClampedArray(16), 2, 2), null);
    assert.deepEqual(hud.hud_heart_rgba().width, hud.HUD_HEART[0].length);
});

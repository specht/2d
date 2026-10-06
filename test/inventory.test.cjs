const test = require('node:test');
const assert = require('node:assert/strict');
const inv = require('../src/static/inventory.js');
const hud = require('../src/static/hud.js');

const sword = { id: 'melee', slot: 'nah', label: 'Schwert', delivery: { kind: 'swing', range_px: 24 },
    effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.4 } };
const bow = { id: 'ranged', slot: 'fern', label: 'Pfeil', delivery: { kind: 'projectile', range_px: 200, speed_px_s: 240 },
    effect: { kind: 'damage', amount: 15 }, timing: { cooldown_s: 0.6 } };
const sprite = (pickup, extra = {}) => ({ traits: { pickup, ...extra } });

// 0 coin, 1 sword (Taste 3), 2 bow, 3 sling (no number), 4 key that stays, 5 sword that is not kept
const sprites = [
    sprite({ points: 10 }),
    sprite({ keep: true, weapon_key: 3 }, { melee_attack: { attack: sword } }),
    sprite({ keep: true }, { ranged_attack: { attack: bow } }),
    sprite({ keep: true }, { ranged_attack: { attack: { ...bow, label: 'Stein' } } }),
    sprite({ keep: true }),
    sprite({}, { melee_attack: { attack: sword } }),
];

test('only a kept pickup with an attack is a weapon', () => {
    assert.equal(inv.is_weapon(sprites[0]), false);
    assert.equal(inv.is_weapon(sprites[1]), true);
    assert.equal(inv.is_weapon(sprites[4]), false, 'a key that stays is an item, not a weapon');
    assert.equal(inv.is_weapon(sprites[5]), false, 'without "bleibt fürs ganze Spiel" nothing changes');
    assert.deepEqual(inv.weapon_slots(sprites[1]), ['nah']);
    assert.deepEqual(inv.weapon_slots(sprites[2]), ['fern']);
    // an attack the player could not use with J or K is no slot
    assert.equal(inv.weapon_attack_slot({ slot: 'nah', delivery: { kind: 'projectile' } }), null);
});

test('the inventory counts what stays, in the order collected', () => {
    const items = [];
    assert.equal(inv.inventory_add(items, 4), 1);
    assert.equal(inv.inventory_add(items, 2), 1);
    assert.equal(inv.inventory_add(items, 4), 2);
    assert.deepEqual(items, [{ sprite_index: 4, count: 2 }, { sprite_index: 2, count: 1 }]);
    assert.equal(inv.inventory_count(items, 4), 2);
    assert.equal(inv.inventory_count(items, 1), 0);
    assert.equal(inv.inventory_count(undefined, 1), 0);
});

test('weapon numbers: the author chooses, the others take the next free one', () => {
    const items = [{ sprite_index: 2, count: 1 }, { sprite_index: 4, count: 1 }, { sprite_index: 1, count: 1 }, { sprite_index: 3, count: 1 }];
    // the bow first (1), the sword keeps its 3, the sling takes 2; the key has none
    assert.deepEqual(inv.weapon_keys(items, sprites), [
        { sprite_index: 2, key: 1 }, { sprite_index: 1, key: 3 }, { sprite_index: 3, key: 2 }]);
    assert.equal(inv.weapon_for_key(items, sprites, 3), 1);
    assert.equal(inv.weapon_for_key(items, sprites, 2), 3);
    assert.equal(inv.weapon_for_key(items, sprites, 7), null);
    // two weapons want the same number: the first collected keeps it
    const twins = [sprite({ keep: true, weapon_key: 1 }, { melee_attack: { attack: sword } }),
        sprite({ keep: true, weapon_key: 1 }, { ranged_attack: { attack: bow } })];
    assert.deepEqual(inv.weapon_keys([{ sprite_index: 1, count: 1 }, { sprite_index: 0, count: 1 }], twins),
        [{ sprite_index: 1, key: 1 }, { sprite_index: 0, key: 2 }]);
    // more than nine: the rest have no number
    const many = Array.from({ length: 11 }, () => sprite({ keep: true }, { melee_attack: { attack: sword } }));
    const keys = inv.weapon_keys(many.map((_, i) => ({ sprite_index: i, count: 1 })), many);
    assert.deepEqual(keys.map(k => k.key), [1, 2, 3, 4, 5, 6, 7, 8, 9, null, null]);
    assert.equal(inv.weapon_key_number('Digit4'), 4);
    assert.equal(inv.weapon_key_number('Numpad9'), 9);
    assert.equal(inv.weapon_key_number('Digit0'), null);
    assert.equal(inv.weapon_key_number('KeyJ'), null);
});

test('a chosen weapon goes in front of the figure\'s own attack of its kind, with its own id', () => {
    const own = [{ ...sword, id: 'melee', label: 'Faust' }];
    let choice = inv.choose_weapon({ nah: null, fern: null }, sprites, 1);
    assert.deepEqual(choice, { nah: 1, fern: null });
    choice = inv.choose_weapon(choice, sprites, 2);
    assert.deepEqual(choice, { nah: 1, fern: 2 }, 'a bow does not take the sword away');
    const attacks = inv.attacks_with_weapons(own, sprites, choice);
    assert.deepEqual(attacks.map(a => [a.id, a.label]), [['waffe1:melee', 'Schwert'], ['waffe2:ranged', 'Pfeil'], ['melee', 'Faust']]);
    // the first of a kind is what J uses (app.js request_melee_attacks)
    assert.equal(attacks.find(a => a.slot === 'nah').label, 'Schwert');
    // nothing chosen: exactly the figure's own list, the same array
    assert.equal(inv.attacks_with_weapons(own, sprites, { nah: null, fern: null }), own);
    assert.deepEqual(inv.attacks_with_weapons(undefined, sprites, null), []);
    // the sprites' attacks are not changed
    assert.equal(sprites[1].traits.melee_attack.attack.id, 'melee');
});

test('the shop says why something cannot be bought', () => {
    const potion = sprite({ energy: 20 });
    const heart = sprite({ lives: 1 });
    assert.equal(inv.shop_refusal({ price: 30, points: 10, sprite: potion, held: 0, lives: 3, max_lives: 5 }), 'Dafür fehlen dir noch 20 Münzen.');
    assert.equal(inv.shop_refusal({ price: 11, points: 10, sprite: potion, held: 0, lives: 3, max_lives: 5 }), 'Dafür fehlt dir noch 1 Münze.');
    assert.equal(inv.shop_refusal({ price: 10, points: 10, sprite: potion, held: 0, lives: 3, max_lives: 5 }), null);
    assert.equal(inv.shop_refusal({ price: 10, points: 50, sprite: heart, held: 0, lives: 5, max_lives: 5 }), 'Du hast schon alle Leben.');
    assert.equal(inv.shop_refusal({ price: 10, points: 50, sprite: heart, held: 0, lives: 4, max_lives: 5 }), null);
    assert.equal(inv.shop_refusal({ price: 10, points: 50, sprite: sprites[1], held: 1, lives: 3, max_lives: 5 }), 'Das hast du schon.');
    assert.equal(inv.shop_refusal({ price: 10, points: 50, sprite: sprites[1], held: 0, lives: 3, max_lives: 5 }), null);
});

// a canvas that remembers what was drawn on it (enough for HudPainter)
function fake_canvas(width, height) {
    const calls = [];
    const ctx = {
        calls, imageSmoothingEnabled: true, fillStyle: '', globalAlpha: 1,
        setTransform() { }, clearRect() { }, putImageData() { },
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        fillRect: (x, y, w, h) => calls.push(['rect', ctx.fillStyle, x, y, w, h]),
        drawImage: (image, x, y) => calls.push(['image', image.name ?? '', x, y]),
    };
    return { width, height, getContext: () => ctx };
}

test('the HUD shows the items, each weapon with its number, the chosen one framed', () => {
    const data = { sprites: sprites.map(s => ({ ...s, width: 24, height: 24 })), properties: { lives_at_begin: 1, show_energy: false },
        levels: [{ layers: [{ type: 'sprites', sprites: [] }] }] };
    const plan = hud.hud_plan(data);
    assert.equal(plan.items.show, true);
    const red = new Uint8ClampedArray(24 * 24 * 4);
    red.set([255, 0, 0, 255], 4 * (10 * 24 + 10));
    const texts = [];
    const painter = new hud.HudPainter(plan, {
        make_canvas: fake_canvas,
        sprite_rgba: () => ({ rgba: red, width: 24, height: 24 }),
        text_bitmap: (text, color, k) => { texts.push([text, color]); return Object.assign(fake_canvas(8 * k, 9 * k), { name: `text:${text}` }); },
    });
    assert.equal(painter.strip, hud.HUD.STRIP_ITEMS);
    const ctx = fake_canvas(400, 100).getContext('2d');
    const items = [{ sprite_index: 1, count: 1, key: 3, chosen: true }, { sprite_index: 4, count: 2, key: null, chosen: false }];
    const key = painter.paint(ctx, 400, 100, 1, { lives: 1, lives_at_begin: 1, energy: 100, max_energy: 100, points: 0, items }, 0);
    assert.ok(texts.some(([text, color]) => text === '3' && color === hud.HUD.CHOSEN), 'the number in the colour of the chosen weapon');
    assert.ok(texts.some(([text]) => text === '× 2'), 'two keys: "× 2"');
    assert.ok(ctx.calls.some(c => c[0] === 'rect' && c[1] === hud.HUD.CHOSEN), 'a frame around the chosen weapon');
    // another weapon chosen: another picture
    const other = painter.paint(ctx, 400, 100, 1, { lives: 1, lives_at_begin: 1, energy: 100, max_energy: 100, points: 0,
        items: [{ ...items[0], chosen: false }, items[1]] }, 1);
    assert.notEqual(other, key);
    // a price tag: the coin (the built-in one here) and the number
    const tag = painter.price_tag(25, 2);
    assert.ok(tag.width > 0 && tag.height > 0);
    assert.ok(texts.some(([text]) => text === '25'));
    assert.equal(painter.price_tag(25, 2), tag, 'made once');
});

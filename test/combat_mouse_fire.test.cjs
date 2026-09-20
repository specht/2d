const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/static/app.js'), 'utf8');

test('left-click on the game canvas queues one shot only for mouse-aimed weapons', () => {
    const begin = source.indexOf("\t\tthis.renderer.domElement.addEventListener('pointerdown', (event) => {");
    const end = source.indexOf('\n\t\tthis.mesh_catalogue = [];', begin);
    assert.ok(begin >= 0 && end > begin);
    const bind = new Function(source.slice(begin, end));
    let pointerdown;
    const attack = { slot: 'fern', delivery: { kind: 'projectile', aim_mode: 'mouse' } };
    const game = {
        renderer: { domElement: { addEventListener(type, handler) {
            assert.equal(type, 'pointerdown');
            pointerdown = handler;
        } } },
        combat: { game_allows_combat() { return true; } },
        player_character: { traits: { attacks: [attack] } },
        pointer_world: { valid: false },
        update_pointer_world(x, y) { this.pointer_world = { valid: true, x, y }; },
        mouse_shot_pending: false,
    };
    bind.call(game);
    pointerdown({ button: 2, clientX: 10, clientY: 20 });
    assert.equal(game.mouse_shot_pending, false);
    attack.delivery.aim_mode = 'horizontal';
    pointerdown({ button: 0, clientX: 10, clientY: 20 });
    assert.equal(game.mouse_shot_pending, false);
    attack.delivery.aim_mode = 'mouse';
    pointerdown({ button: 0, clientX: 10, clientY: 20 });
    assert.equal(game.mouse_shot_pending, true);
    assert.deepEqual(game.mouse_shot_world, { x: 10, y: 20 });
});

test('queued click uses the clicked world position once; K remains available', () => {
    const begin = source.indexOf('        const actorCenterY = actor.mesh.position.y + actor.sprite.height / 2;');
    const end = source.indexOf('        for (const baddie of this.baddies) {', begin);
    assert.ok(begin >= 0 && end > begin);
    const request = new Function('KEY_RANGED',
        `return function(t) { const actor = this.player_character; ${source.slice(begin, end)} };`)('ranged');
    const shots = [];
    const attack = { id: 'ranged', slot: 'fern', delivery: { kind: 'projectile', aim_mode: 'mouse' } };
    const game = {
        player_character: { mesh: { position: { x: 0, y: 0 } },
            sprite: { height: 20 }, traits: { attacks: [attack] } },
        pressed_keys: { ranged: false },
        mouse_shot_pending: true,
        mouse_shot_world: { x: 0, y: 100 },
        pointer_world: { valid: false }, pointer_client: null,
        combat: { request_attack(owner, id, time, aim) { shots.push({ owner, id, time, aim }); } },
    };
    request.call(game, 0);
    assert.equal(shots.length, 1);
    assert.deepEqual(shots[0].aim, { x: 0, y: 1 });
    assert.equal(game.mouse_shot_pending, false);
    request.call(game, 0.1);
    assert.equal(shots.length, 1); // Click does not repeat like holding K.
    attack.delivery.aim_mode = 'horizontal';
    game.pressed_keys.ranged = true;
    request.call(game, 0.2);
    assert.equal(shots.length, 2);
    assert.equal(shots[1].aim, null);
});

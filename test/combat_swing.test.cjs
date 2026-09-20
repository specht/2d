const assert = require('node:assert/strict');
const test = require('node:test');
const { CombatSystem } = require('../src/static/combat.js');
const { register_swing } = require('../src/static/combat_swing.js');

function fixture() {
    const game = {
        running: true, reached_flag: false, curtain: { showing: false },
        lives: 3, energy: 100, baddies: [], active_level_sprites: [],
        data: { sprites: [] }, update_stats() { this.updates = (this.updates ?? 0) + 1; },
    };
    const sword = () => ({
        id: 'sword', slot: 'nah', delivery: { kind: 'swing', range_px: 40 },
        effect: { kind: 'damage', amount: 20 }, timing: { cooldown_s: 0.6 },
    });
    const actor = {
        game, active: true, character_trait: 'actor',
        mesh: { position: { x: 0, y: 0 } },
        sprite: { width: 20, height: 20 }, traits: { attacks: [sword()] },
        last_horizontal_facing: 'right',
        dead() { return this.died === true; },
        invincible() { return false; },
        die() { this.died = true; },
    };
    game.player_character = actor;
    const baddie = (x, traits = {}) => {
        let enemy = {
            game, active: true, character_trait: 'baddie', energy: 60,
            mesh: { position: { x, y: 0 } }, sprite: { width: 20, height: 20 },
            traits: { attacks: [sword()], ...traits }, last_horizontal_facing: 'left',
            take_damage(amount) {
                this.energy = Math.max(0, this.energy - amount);
                if (!this.energy) this.active = false;
            },
        };
        game.baddies.push(enemy);
        return enemy;
    };
    const combat = new CombatSystem(game);
    register_swing(combat);
    return { game, actor, baddie, combat };
}

test('Actor sword hits forward once without any animation or weapon sprite', () => {
    const { actor, baddie, combat } = fixture();
    const near = baddie(35);
    const far = baddie(100);
    const behind = baddie(-35);
    const swing = combat.request_attack(actor, 'sword', 0);
    assert.ok(swing);
    assert.equal(near.energy, 40);
    assert.equal(far.energy, 60);
    assert.equal(behind.energy, 60);
    combat.step(0.1);
    assert.equal(near.energy, 40);
    combat.step(0.2);
    assert.equal(combat.active.length, 0);
});

test('Baddie sword uses the identical delivery and damages player', () => {
    const { game, actor, baddie, combat } = fixture();
    const enemy = baddie(35);
    assert.ok(combat.request_attack(enemy, 'sword', 0));
    assert.equal(game.energy, 80);
    assert.equal(actor.died, undefined);
    assert.equal(combat.request_attack(enemy, 'sword', 0.1), null);
    assert.ok(combat.request_attack(enemy, 'sword', 0.7));
    assert.equal(game.energy, 60);
});

test('Both enemies have independent health and cooldowns', () => {
    const { game, baddie, combat } = fixture();
    const one = baddie(35);
    const two = baddie(38);
    assert.ok(combat.request_attack(one, 'sword', 0));
    assert.ok(combat.request_attack(two, 'sword', 0));
    assert.equal(game.energy, 60);
    assert.equal(one.energy, 60);
    assert.equal(two.energy, 60);
});

test('Walls and closed doors block swings; open doors do not', () => {
    const { game, actor, baddie, combat } = fixture();
    const target = baddie(35);
    const obstacle = { sprite_index: 0, mesh: { position: { x: 20, y: 0 } }, door_closed: true };
    game.active_level_sprites = [obstacle];
    game.data.sprites.push({ width: 8, height: 30, traits: { door: {} } });
    combat.request_attack(actor, 'sword', 0);
    assert.equal(target.energy, 60);
    obstacle.door_closed = false;
    combat.request_attack(actor, 'sword', 0.7);
    assert.equal(target.energy, 40);
});

test('Reset removes active swings without sprite art or THREE', () => {
    const { actor, baddie, combat } = fixture();
    baddie(35);
    combat.request_attack(actor, 'sword', 0);
    assert.equal(combat.active.length, 1);
    combat.reset();
    assert.equal(combat.active.length, 0);
    assert.ok(combat.request_attack(actor, 'sword', 0));
});

test('Invalid melee reach is safely rejected', () => {
    const { actor, combat } = fixture();
    actor.traits.attacks[0].delivery.range_px = Infinity;
    assert.equal(combat.request_attack(actor, 'sword', 0), null);
});

test('Stopping gameplay retires active swings', () => {
    const { game, actor, baddie, combat } = fixture();
    baddie(35);
    combat.request_attack(actor, 'sword', 0);
    game.curtain.showing = true;
    combat.step(0.01);
    assert.equal(combat.active.length, 0);
});

function fakeThree() {
    const previous = global.THREE;
    global.THREE = {
        DoubleSide: 2,
        BufferAttribute: class {
            constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; }
        },
        BufferGeometry: class {
            constructor() { this.attributes = {}; }
            setAttribute(name, value) { this.attributes[name] = value; return this; }
            setIndex(indices) { this.indices = indices; return this; }
            dispose() { this.disposed = true; }
        },
        MeshBasicMaterial: class {
            constructor(options) { Object.assign(this, options); }
            dispose() { this.disposed = true; }
        },
        Mesh: class {
            constructor(geometry, material) { this.geometry = geometry; this.material = material; }
        },
    };
    const scene = {
        meshes: [],
        add(mesh) { this.meshes.push(mesh); },
        remove(mesh) { this.meshes = this.meshes.filter(x => x !== mesh); },
    };
    return { scene, restore() { if (previous === undefined) delete global.THREE; else global.THREE = previous; } };
}

test('Swoosh is a filled, curved shape that animates and cleans up for either owner', () => {
    const gfx = fakeThree();
    try {
        const { game, actor, baddie, combat } = fixture();
        game.scene = gfx.scene;
        const enemy = baddie(35);
        actor.traits.attacks[0].visual = { kind: 'slash' }; // existing M1 JSON
        const playerSwing = combat.request_attack(actor, 'sword', 0);
        const enemySwing = combat.request_attack(enemy, 'sword', 0);
        assert.ok(playerSwing.visual_mesh);
        assert.ok(enemySwing.visual_mesh);
        assert.equal(gfx.scene.meshes.length, 2);
        const mesh = playerSwing.visual_mesh;
        assert.equal(mesh.geometry.indices.length, 8 * 6); // filled ribbon, not Line
        const original = Array.from(mesh.geometry.attributes.position.array);
        const originalAlpha = mesh.material.opacity;
        combat.step(0.08);
        assert.notDeepEqual(Array.from(mesh.geometry.attributes.position.array), original);
        assert.equal(mesh.geometry.attributes.position.needsUpdate, true);
        assert.ok(mesh.material.opacity > originalAlpha); // fade in at the beginning
        const brightAlpha = mesh.material.opacity;
        combat.step(0.13);
        assert.ok(mesh.material.opacity < brightAlpha); // then fade out
        combat.step(0.16);
        assert.equal(gfx.scene.meshes.length, 0);
        assert.equal(mesh.geometry.disposed, true);
        assert.equal(mesh.material.disposed, true);
    } finally {
        gfx.restore();
    }
});

test('No swoosh is drawn when disabled; both sides still deal exactly the same damage', () => {
    const gfx = fakeThree();
    try {
        const { game, actor, baddie, combat } = fixture();
        game.scene = gfx.scene;
        const enemy = baddie(35);
        actor.traits.attacks[0].visual = { kind: 'none' };
        enemy.traits.attacks[0].visual = { kind: 'none' };
        assert.ok(combat.request_attack(actor, 'sword', 0));
        assert.equal(enemy.energy, 40);
        assert.ok(combat.request_attack(enemy, 'sword', 0));
        assert.equal(game.energy, 80);
        assert.equal(gfx.scene.meshes.length, 0);
        combat.step(0.16);
        assert.equal(combat.active.length, 0);
    } finally {
        gfx.restore();
    }
});

test('Leftward swoosh mirrors the arc and visual-free fallback needs no THREE', () => {
    const gfx = fakeThree();
    try {
        const { game, actor, baddie, combat } = fixture();
        game.scene = gfx.scene;
        baddie(-35);
        actor.last_horizontal_facing = 'left';
        const swing = combat.request_attack(actor, 'sword', 0);
        assert.ok(swing.visual_mesh);
        const xs = Array.from(swing.visual_mesh.geometry.attributes.position.array)
            .filter((_, i) => i % 3 === 0);
        assert.ok(xs.every(x => x < 0));
        combat.reset();
        assert.equal(gfx.scene.meshes.length, 0);
        delete global.THREE;
        assert.ok(combat.request_attack(actor, 'sword', 0));
        assert.equal(game.baddies[0].energy, 20);
    } finally {
        gfx.restore();
    }
});

test('Swoosh direction reverses the vertical motion for player and baddie, not their attack direction', () => {
    const gfx = fakeThree();
    try {
        const { game, actor, baddie, combat } = fixture();
        game.scene = gfx.scene;
        const enemy = baddie(35);
        // Identical visible reach, opposite vertical sweeps.
        actor.traits.attacks[0].visual = { kind: 'swoosh', sweep: 'up', reach_px: 50 };
        enemy.traits.attacks[0].visual = { kind: 'swoosh', sweep: 'down', reach_px: 50 };
        const up = combat.request_attack(actor, 'sword', 0);
        const down = combat.request_attack(enemy, 'sword', 0);
        assert.ok(up?.visual_mesh);
        assert.ok(down?.visual_mesh);
        assert.equal(enemy.energy, 40);
        assert.equal(game.energy, 80);
        assert.equal(up.swoosh.reach, down.swoosh.reach);
        assert.equal(up.swoosh.sweep, 'up');
        assert.equal(down.swoosh.sweep, 'down');
        const yUp = up.visual_mesh.geometry.attributes.position.array;
        const yDown = down.visual_mesh.geometry.attributes.position.array;
        for (let i = 1; i < yUp.length; i += 3) {
            assert.ok(Math.abs((yUp[i] - up.swoosh.y) + (yDown[i] - down.swoosh.y)) < 1e-4);
        }
        combat.step(0.10);
        assert.equal(enemy.energy, 40);
        assert.equal(game.energy, 80);
        combat.step(0.16);
        assert.equal(gfx.scene.meshes.length, 0);
    } finally {
        gfx.restore();
    }
});

test('Visual reach changes the swoosh size but never changes which enemy gets hit', () => {
    const gfx = fakeThree();
    try {
        const { game, actor, baddie, combat } = fixture();
        game.scene = gfx.scene;
        const far = baddie(110);
        actor.traits.attacks[0].visual = { kind: 'swoosh', reach_px: 120 };
        const longVisual = combat.request_attack(actor, 'sword', 0);
        assert.equal(longVisual.swoosh.reach, 120);
        assert.equal(far.energy, 60); // Mechanic still uses delivery.range_px: 40.
        const firstX = longVisual.visual_mesh.geometry.attributes.position.array[0];
        combat.reset();
        actor.traits.attacks[0].visual.reach_px = 15;
        const shortVisual = combat.request_attack(actor, 'sword', 0);
        assert.equal(shortVisual.swoosh.reach, 15);
        assert.notEqual(shortVisual.visual_mesh.geometry.attributes.position.array[0], firstX);
        assert.equal(far.energy, 60);
        combat.reset();
        actor.traits.attacks[0].delivery.range_px = 100;
        assert.ok(combat.request_attack(actor, 'sword', 0));
        assert.equal(far.energy, 40); // Range changes only when the hit range changes.
    } finally {
        gfx.restore();
    }
});

test('Old sword visuals retain their original direction and length; invalid visual settings fall back safely', () => {
    const gfx = fakeThree();
    try {
        const { game, actor, combat } = fixture();
        game.scene = gfx.scene;
        actor.traits.attacks[0].visual = { kind: 'slash' }; // saved before the dropdown existed
        let swing = combat.request_attack(actor, 'sword', 0);
        assert.equal(swing.swoosh.sweep, 'up');
        assert.ok(Math.abs(swing.swoosh.reach - 28.8) < 1e-9);
        combat.reset();
        actor.traits.attacks[0].visual = { kind: 'swoosh', sweep: 'sideways', reach_px: Infinity };
        swing = combat.request_attack(actor, 'sword', 0);
        assert.equal(swing.swoosh.sweep, 'up');
        assert.ok(Math.abs(swing.swoosh.reach - 28.8) < 1e-9);
        combat.reset();
        actor.traits.attacks[0].visual = { kind: 'swoosh', sweep: 'down', reach_px: 99999 };
        swing = combat.request_attack(actor, 'sword', 0);
        assert.equal(swing.swoosh.reach, 200);
        combat.reset();
        actor.traits.attacks[0].visual = { kind: 'none', sweep: 'down', reach_px: 120 };
        assert.ok(combat.request_attack(actor, 'sword', 0));
        assert.equal(gfx.scene.meshes.length, 0);
    } finally {
        gfx.restore();
    }
});

test('Sword editor controls keep visual settings independent of hit reach for either character type', () => {
    // Execute the real editor control fragment with small widget stubs, avoiding a DOM.
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(__dirname, '../src/static/game.js'), 'utf8');
    const start = source.indexOf("        if (trait === 'actor' || trait === 'baddie') {");
    const end = source.indexOf("        if (trait === 'door') this.add_door_state_help", start);
    assert.ok(start >= 0 && end > start);
    const controls = [];
    const widget = (type) => class {
        constructor(options) { controls.push({ type, ...options }); }
    };
    const render = new Function('self', 'si', 'trait', 'div',
        'CheckboxWidget', 'SelectWidget', 'NumberWidget', source.slice(start, end));
    const actorSword = {
        id: 'sword', delivery: { kind: 'swing', range_px: 40 },
        visual: { kind: 'slash' },
    };
    const enemySword = {
        id: 'sword', delivery: { kind: 'swing', range_px: 40 },
        visual: { kind: 'swoosh', sweep: 'down', reach_px: 55 },
    };
    const self = {
        data: { sprites: [{ traits: { actor: { attacks: [actorSword] },
            baddie: { attacks: [enemySword] } } }] },
        build_sprite_traits_menu() { this.rebuilds = (this.rebuilds ?? 0) + 1; },
    };
    const paint = (trait) => {
        controls.length = 0;
        render(self, 0, trait, {}, widget('checkbox'), widget('select'), widget('number'));
        return (label) => {
            const control = controls.find(c => c.label === label);
            assert.ok(control, `Missing ${label} for ${trait}`);
            return control;
        };
    };
    let control = paint('actor');
    assert.equal(control('Swoosh:').get(), 'up'); // old 'slash' value still enabled
    assert.ok(control('Swoosh-Länge:').get() > 28);
    control('Swoosh:').set('none');
    assert.equal(actorSword.visual.kind, 'none');
    assert.equal(self.rebuilds, 1);
    control = paint('actor');
    assert.equal(controls.filter(c => c.label === 'Swoosh-Länge:').length, 0);
    control('Swoosh:').set('down');
    assert.equal(actorSword.visual.sweep, 'down');
    assert.equal(actorSword.visual.kind, 'swoosh');
    control = paint('actor');
    control('Swoosh-Länge:').set(90);
    control('Angriffsreichweite:').set(70);
    assert.equal(actorSword.visual.reach_px, 90);
    assert.equal(actorSword.delivery.range_px, 70);
    assert.equal(enemySword.delivery.range_px, 40);
    assert.equal(enemySword.visual.reach_px, 55);
    control = paint('baddie');
    assert.equal(control('Swoosh:').get(), 'down');
    control('Swoosh:').set('up');
    assert.equal(enemySword.visual.sweep, 'up');
    assert.equal(actorSword.visual.sweep, 'down');
});

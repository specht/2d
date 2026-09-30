const test = require('node:test');
const assert = require('node:assert/strict');
const MovementRegions = require('../src/static/movement_regions.js');

const rect = (left, bottom, width, height) => ({ left, bottom, width, height });
const region = (movement, rects, name = 'Bereich') => ({ type: 'movement_region', properties: { name }, rects, movement });

test('old levels without regions move as always', () => {
    const resolved = MovementRegions.resolve({ properties: {}, layers: [{ type: 'sprites', sprites: [] }] });
    assert.equal(MovementRegions.at(resolved, 0, 0), null);
    assert.equal(MovementRegions.at(null, 0, 0), null);
});

test('a swimming region applies inside its rectangles only, with defaults filled in', () => {
    const resolved = MovementRegions.resolve({ properties: {}, layers: [region({ mode: 'swim' }, [rect(0, 0, 100, 50)])] });
    const inside = MovementRegions.at(resolved, 50, 20);
    assert.equal(inside.mode, 'swim');
    assert.equal(inside.gravity, 20);
    assert.equal(inside.glide, 90);
    assert.equal(inside.surface, 50);
    assert.equal(MovementRegions.at(resolved, 150, 20), null);
});

test('the frontmost region decides, currents of all regions add up', () => {
    // saved layer lists are front first
    const resolved = MovementRegions.resolve({ properties: {}, layers: [
        region({ mode: 'inherit', current: { speed: 60, angle: 270 } }, [rect(40, 0, 20, 50)], 'Sog'),
        region({ mode: 'swim', current: { speed: 60, angle: 0 } }, [rect(0, 0, 100, 50)], 'Meer'),
    ] });
    const sog = MovementRegions.at(resolved, 50, 20);
    assert.equal(sog.mode, 'swim', 'the Sog keeps the water below');
    assert.ok(Math.abs(sog.current.x - 1) < 1e-9);
    assert.ok(Math.abs(sog.current.y + 1) < 1e-9);
    const sea = MovementRegions.at(resolved, 10, 20);
    assert.ok(Math.abs(sea.current.y) < 1e-9);
});

test('an air bubble in front of the water walks normally', () => {
    const resolved = MovementRegions.resolve({ properties: {}, layers: [
        region({ mode: 'normal' }, [rect(40, 0, 20, 50)], 'Luftblase'),
        region({ mode: 'swim' }, [rect(0, 0, 100, 50)], 'Meer'),
    ] });
    assert.equal(MovementRegions.at(resolved, 50, 20), null);
    assert.equal(MovementRegions.at(resolved, 10, 20).mode, 'swim');
});

test('the level setting applies everywhere; moon gravity walks normally', () => {
    const moon = MovementRegions.resolve({ properties: { movement: { mode: 'normal', gravity: 17 } }, layers: [] });
    const here = MovementRegions.at(moon, 1000, -500);
    assert.equal(here.mode, 'normal');
    assert.equal(here.gravity, 17);
    assert.equal(here.surface, Infinity);
});

test('values are clamped and unknown modes become swimming', () => {
    const s = MovementRegions.settings({ mode: 'jetpack', gravity: -5, glide: 150, speed: 0 });
    assert.equal(s.mode, 'swim');
    assert.equal(s.gravity, 0);
    assert.equal(s.glide, 99);
    assert.equal(s.speed, 0.1);
});

const env = { vrun: 3, vjump: 7, gravity: 0.5, near_surface: false };
const swim = MovementRegions.settings({ mode: 'swim' });

test('in the water the figure sinks slowly and drifts on after letting go', () => {
    let v = { vx: 0, vy: 0 };
    for (let i = 0; i < 200; i++) v = MovementRegions.fluid_step(v, { x: 0, y: 0 }, swim, env);
    assert.ok(v.vy < 0 && v.vy > -1.5, `slow sinking: ${v.vy}`);
    v = { vx: 0, vy: 0 };
    for (let i = 0; i < 60; i++) v = MovementRegions.fluid_step(v, { x: 1, y: 0 }, swim, env);
    assert.ok(v.vx > 2.3 && v.vx <= 2.4 + 1e-9, `up to 0.8 × speed: ${v.vx}`);
    const after = MovementRegions.fluid_step(v, { x: 0, y: 0 }, swim, env);
    assert.ok(after.vx > 2, 'it glides on');
});

test('a stroke swims up, and just below the surface it leaps out', () => {
    const stroke = MovementRegions.fluid_step({ vx: 0, vy: -1 }, { x: 0, y: 0, stroke: true }, swim, env);
    assert.ok(stroke.vy > 3.5 && stroke.vy < 4.5, `${stroke.vy}`);
    const leap = MovementRegions.fluid_step({ vx: 0, vy: 0 }, { x: 0, y: 0, stroke: true }, swim, { ...env, near_surface: true });
    assert.equal(leap.vy, 7);
});

test('floating has no gravity and a current carries the figure along', () => {
    const space = MovementRegions.settings({ mode: 'float' });
    let v = { vx: 0, vy: 0 };
    v = MovementRegions.fluid_step(v, { x: 0, y: 0 }, space, env);
    assert.equal(v.vy, 0);
    const pulled = { ...space, current: { x: 0, y: -2 } };
    for (let i = 0; i < 400; i++) v = MovementRegions.fluid_step(v, { x: 0, y: 0 }, pulled, env);
    assert.ok(Math.abs(v.vy + 2) < 0.01, `the Sog sets the speed: ${v.vy}`);
});

test('diagonally the figure is as fast as straight ahead', () => {
    const space = MovementRegions.settings({ mode: 'float', glide: 0 });
    const straight = MovementRegions.fluid_step({ vx: 0, vy: 0 }, { x: 1, y: 0 }, space, env);
    const diagonal = MovementRegions.fluid_step({ vx: 0, vy: 0 }, { x: 1, y: 1 }, space, env);
    assert.ok(Math.abs(Math.hypot(diagonal.vx, diagonal.vy) - Math.hypot(straight.vx, straight.vy)) < 1e-9);
    assert.ok(Math.abs(diagonal.vx - diagonal.vy) < 1e-9);
});

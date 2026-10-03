const test = require('node:test');
const assert = require('node:assert/strict');
const { copy_state_without_role, copy_state_for_sprite, frame_range, valid_frame_indices, duplicate_frames_in, remove_frames_from, reverse_frames_in, move_frames_block } = require('../src/static/sprite_actions.js');

const state = () => ({
    properties: { name: 'laufen', fps: 10 },
    traits: { actor: { walk_right: {} }, ranged_attack: { attack: {} } },
    frames: [{ src: 'a', tag: 'x1' }, { src: 'b' }],
});

test('a duplicated state keeps its pictures and settings, but takes no role', () => {
    const original = state();
    const copy = copy_state_without_role(original);
    assert.deepEqual(copy.traits, { actor: {}, ranged_attack: {} });
    assert.deepEqual(copy.frames, [{ src: 'a' }, { src: 'b' }]);
    assert.equal(copy.properties.fps, 10);
    assert.deepEqual(original.traits.actor, { walk_right: {} });   // the original keeps its role
});

test('a state copied to another sprite keeps the roles that sprite can have', () => {
    const copy = copy_state_for_sprite(state(), { traits: { actor: {} } });
    assert.deepEqual(copy.traits, { actor: { walk_right: {} } });
    assert.deepEqual(copy.frames, [{ src: 'a' }, { src: 'b' }]);
});

const strip = () => ['a', 'b', 'c', 'd', 'e'].map(src => ({ src }));
const srcs = (frames) => frames.map(f => f.src).join('');

test('Shift + click selects a range, in either direction', () => {
    assert.deepEqual(frame_range(1, 3), [1, 2, 3]);
    assert.deepEqual(frame_range(3, 1), [1, 2, 3]);
    assert.deepEqual(frame_range(2, 2), [2]);
    assert.deepEqual(valid_frame_indices([4, 1, 1, 9, -1, 2.5], 5), [1, 4]);
});

test('several frames: duplicate after the last, reverse, remove (never all)', () => {
    const dup = duplicate_frames_in(strip(), [1, 3]);
    assert.equal(srcs(dup.frames), 'abcdbde');
    assert.deepEqual(dup.selection, [4, 5]);
    // copies are new frames, not the same objects
    assert.notEqual(dup.frames[4], dup.frames[1]);
    assert.equal(srcs(reverse_frames_in(strip(), [0, 1, 2])), 'cbade');
    assert.equal(srcs(reverse_frames_in(strip(), [1, 3])), 'adcbe');
    const removed = remove_frames_from(strip(), [0, 4]);
    assert.equal(srcs(removed.frames), 'bcd');
    assert.equal(srcs(removed.removed), 'ae');
    assert.equal(remove_frames_from(strip(), [0, 1, 2, 3, 4]).removed.length, 0);
    assert.equal(srcs(duplicate_frames_in(strip(), []).frames), 'abcde');
});

test('several selected frames dragged together land as a block where the dragged one was dropped', () => {
    // a b c d e, b and c selected, b dragged behind e (from 1 to 4)
    let r = move_frames_block(strip(), [1, 2], 1, 4);
    assert.equal(srcs(r.frames), 'adebc');
    assert.deepEqual(r.selection, [3, 4]);
    // c dragged to the front (from 2 to 0)
    r = move_frames_block(strip(), [1, 2], 2, 0);
    assert.equal(srcs(r.frames), 'bcade');
    assert.deepEqual(r.selection, [0, 1]);
    // gaps close up: a and e selected, a dragged between c and d (from 0 to 2)
    r = move_frames_block(strip(), [0, 4], 0, 2);
    assert.equal(srcs(r.frames), 'bcaed');
    assert.deepEqual(r.selection, [2, 3]);
    // dropped where it was: nothing moves except closing the gaps
    r = move_frames_block(strip(), [1, 3], 1, 1);
    assert.equal(srcs(r.frames), 'abdce');
});

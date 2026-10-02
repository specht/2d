const test = require('node:test');
const assert = require('node:assert/strict');
const { LevelHistory } = require('../src/static/level_history.js');

const v = (n) => JSON.stringify({ id: 'l0', n });

test('the first look at a level is no step; every change is one', () => {
    const h = new LevelHistory();
    assert.equal(h.observe('l0', v(0)), 'baseline');
    assert.equal(h.can_undo('l0'), false);
    assert.equal(h.observe('l0', v(0)), 'same');
    assert.equal(h.observe('l0', v(1)), 'step');
    assert.equal(h.observe('l0', v(2)), 'step');
    assert.equal(h.can_undo('l0'), true);
    assert.equal(h.undo('l0', v(2)), v(1));
    assert.equal(h.undo('l0', v(1)), v(0));
    assert.equal(h.undo('l0', v(0)), null);
    assert.equal(h.redo('l0', v(0)), v(1));
    assert.equal(h.redo('l0', v(1)), v(2));
    assert.equal(h.redo('l0', v(2)), null);
});

test('an edit not observed yet is what gets undone', () => {
    const h = new LevelHistory();
    h.observe('l0', v(0));
    // typed, but the pause has not passed yet
    assert.equal(h.undo('l0', v(1)), v(0));
    assert.equal(h.redo('l0', v(0)), v(1));
});

test('a new edit after undoing ends the redo chain', () => {
    const h = new LevelHistory();
    h.observe('l0', v(0));
    h.observe('l0', v(1));
    h.undo('l0', v(1));
    assert.equal(h.can_redo('l0'), true);
    assert.equal(h.redo('l0', v(5)), null); // v(5): edited after undoing
    assert.equal(h.can_redo('l0'), false);
    assert.equal(h.undo('l0', v(5)), v(0));
});

test('levels have their own history; rebase and forget take no steps', () => {
    const h = new LevelHistory();
    h.observe('l0', v(0));
    h.observe('l1', 'a');
    h.observe('l1', 'b');
    assert.equal(h.can_undo('l0'), false);
    assert.equal(h.can_undo('l1'), true);
    h.rebase('l0', v(9)); // tidied up while shown
    assert.equal(h.observe('l0', v(9)), 'same');
    assert.equal(h.can_undo('l0'), false);
    h.forget('l1'); // somebody else changed it
    assert.equal(h.can_undo('l1'), false);
    assert.equal(h.observe('l1', 'c'), 'baseline');
    assert.equal(h.undo('nope', 'x'), null);
    assert.equal(h.observe(undefined, 'x'), 'same');
});

test('old steps are dropped by count and by size', () => {
    const h = new LevelHistory({ max_steps: 3 });
    for (let i = 0; i <= 10; i++) h.observe('l0', v(i));
    assert.equal(h.undo('l0', v(10)), v(9));
    assert.equal(h.undo('l0', v(9)), v(8));
    assert.equal(h.undo('l0', v(8)), v(7));
    assert.equal(h.undo('l0', v(7)), null);

    const big = new LevelHistory({ max_chars: 25 });
    big.observe('l0', '0123456789');
    big.observe('l0', 'abcdefghij');
    big.observe('l0', 'ABCDEFGHIJ');
    big.observe('l0', 'xxxxxxxxxx'); // 30 characters in steps: the oldest goes
    assert.equal(big.undo('l0', 'xxxxxxxxxx'), 'ABCDEFGHIJ');
    assert.equal(big.undo('l0', 'ABCDEFGHIJ'), 'abcdefghij');
    assert.equal(big.undo('l0', 'abcdefghij'), null);
});

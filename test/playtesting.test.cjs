const test = require('node:test');
const assert = require('node:assert/strict');
const { playtest_clock, playtest_missing, playtest_stars } = require('../src/static/playtesting.js');

const QUESTIONS = [
    { id: 'fun', type: 'scale' },
    { id: 'difficulty', type: 'choice', options: [['easy', 'zu leicht']] },
    { id: 'good', type: 'text', required: true },
    { id: 'bug_text', type: 'text', required: false },
];

test('playtesting clock: minutes and seconds, never below zero', () => {
    assert.equal(playtest_clock(300), '5:00');
    assert.equal(playtest_clock(61.2), '1:02');
    assert.equal(playtest_clock(9), '0:09');
    assert.equal(playtest_clock(-4), '0:00');
});

test('playtesting survey: every scale and choice, the required texts with a few letters', () => {
    assert.deepEqual(playtest_missing(QUESTIONS, {}), ['fun', 'difficulty', 'good']);
    assert.deepEqual(playtest_missing(QUESTIONS, { fun: 3, difficulty: 'easy', good: ' ok ' }), ['good']);
    assert.deepEqual(playtest_missing(QUESTIONS, { fun: 3, difficulty: 'easy', good: 'Die Musik' }), []);
    // a game that would not run needs nothing else
    assert.deepEqual(playtest_missing(QUESTIONS, { broken: true }), []);
});

test('playtesting stars', () => {
    assert.equal(playtest_stars(3.6), '★★★★☆');
    assert.equal(playtest_stars(null), '');
});

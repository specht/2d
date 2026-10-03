const test = require('node:test');
const assert = require('node:assert/strict');
const { rescue_decision, rescue_time_text, rescue_game_text, RESCUE_MAX_AGE_MS } = require('../src/static/rescue.js');

const now = new Date(2026, 9, 12, 10, 42).getTime();
const record = (extra = {}) => ({ version: 1, time: now - 60000, unsaved: true, data: { sprites: [] }, title: '', author: '', ...extra });

test('after a reload the studio started itself, the work comes back without asking', () => {
    assert.equal(rescue_decision(record(), { auto: true, now }), 'restore');
    assert.equal(rescue_decision(record(), { auto: false, now }), 'ask');
});

test('nothing to offer: no copy, a saved game, a broken or a stale copy', () => {
    assert.equal(rescue_decision(null, { now }), 'none');
    assert.equal(rescue_decision(undefined, { auto: true, now }), 'none');
    assert.equal(rescue_decision(record({ unsaved: false }), { auto: true, now }), 'none');
    assert.equal(rescue_decision(record({ data: null }), { auto: true, now }), 'none');
    assert.equal(rescue_decision(record({ data: 'x' }), { auto: true, now }), 'none');
    assert.equal(rescue_decision(record({ time: undefined }), { auto: true, now }), 'none');
    // two weeks old: somebody else's, long ago
    assert.equal(rescue_decision(record({ time: now - RESCUE_MAX_AGE_MS - 1 }), { auto: true, now }), 'none');
    // from the future (a wrong clock): not trusted
    assert.equal(rescue_decision(record({ time: now + 3600 * 1000 }), { auto: true, now }), 'none');
});

test('the question names the game and the time', () => {
    assert.equal(rescue_game_text(record()), 'ein Spiel ohne Titel');
    assert.equal(rescue_game_text(record({ author: 'Lea' })), 'ein Spiel ohne Titel von Lea');
    assert.equal(rescue_game_text(record({ title: ' Pips Abenteuer ', author: 'Lea' })), '»Pips Abenteuer« von Lea');
    assert.equal(rescue_game_text(record({ title: 'Pips Abenteuer' })), '»Pips Abenteuer«');
    assert.equal(rescue_time_text(now - 5 * 60000, now), 'heute um 10:37 Uhr');
    assert.equal(rescue_time_text(now - 24 * 3600 * 1000, now), 'gestern um 10:42 Uhr');
    assert.equal(rescue_time_text(new Date(2026, 9, 3, 9, 5).getTime(), now), 'am 3.10. um 09:05 Uhr');
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { curtain_screen } = require('../src/static/screens.js');
const texts = (kind, info) => curtain_screen(kind, info).lines.map(l => l.text);

test('the curtain screens speak German and say what happens next', () => {
    assert.deepEqual(texts('level_start', { level_name: 'Die Höhle', prompt: 'Drück eine Taste' }), ['Die Höhle', 'Drück eine Taste, um loszulegen']);
    assert.deepEqual(texts('level_start', { level_name: '  ' }), ['Drück eine Taste, um loszulegen']);
    assert.deepEqual(texts('lost_life', { lives: 1, prompt: 'Tipp auf den Bildschirm' }), ['Autsch!', 'Noch 1 Leben', 'Tipp auf den Bildschirm, um weiterzuspielen']);
    assert.deepEqual(texts('game_over'), ['Game Over', 'Keine Leben mehr']);
    assert.deepEqual(texts('level_complete', { next_name: 'Level 2' }), ['Geschafft!', 'Weiter mit: Level 2']);
    assert.deepEqual(texts('level_complete', {}), ['Geschafft!']);
    assert.deepEqual(texts('the_end', { title: 'Pips Reise', points: 120, show_points: true }), ['Ende', 'Du hast „Pips Reise“ geschafft!', 'Punkte: 120']);
    assert.deepEqual(texts('the_end', { points: 0, show_points: false }), ['Ende', 'Du hast es geschafft!']);
    // names are text: no HTML is ever made of them
    assert.equal(texts('level_complete', { next_name: '<b>x</b>' })[1], 'Weiter mit: <b>x</b>');
});

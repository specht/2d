const test = require('node:test');
const assert = require('node:assert/strict');
const sp = require('../src/static/speech.js');

test('settings: every one has a default, nonsense falls back to it', () => {
    assert.deepEqual(sp.speech_settings(undefined), { font: 'pixelify', size: 'medium', speed: 'normal', color: '#f4f4f4' });
    assert.deepEqual(sp.speech_settings({ text_font: 'tiny5', text_size: 'large', text_speed: 'fast', text_color: '#FFCD75' }),
        { font: 'tiny5', size: 'large', speed: 'fast', color: '#ffcd75' });
    assert.deepEqual(sp.speech_settings({ text_font: 'comic sans', text_size: 7, text_speed: null, text_color: 'red' }),
        { font: 'pixelify', size: 'medium', speed: 'normal', color: '#f4f4f4' });
});

test('every line is a sentence; empty lines and spaces around them do not count', () => {
    assert.deepEqual(sp.speech_parts('Hallo!\n\n  Hier wohnt die Hexe.  \r\nViel Glück …\n'),
        ['Hallo!', 'Hier wohnt die Hexe.', 'Viel Glück …']);
    assert.deepEqual(sp.speech_parts(''), []);
    assert.deepEqual(sp.speech_parts(undefined), []);
});

test('a sentence stays long enough to read it, at least 1.5 s; the reading speed scales it', () => {
    assert.equal(sp.speech_seconds('Hi'), 1.5);
    const long = 'x'.repeat(60);
    assert.ok(Math.abs(sp.speech_seconds(long) - (1.0 + 0.065 * 60)) < 1e-9);
    assert.ok(sp.speech_seconds(long, 'slow') > sp.speech_seconds(long) && sp.speech_seconds(long, 'fast') < sp.speech_seconds(long));
});

test('letters are a whole number of screen pixels per font pixel, and sized to the screen', () => {
    for (const font of Object.keys(sp.SPEECH_FONTS)) {
        for (const h of [180, 360, 720, 1080]) assert.ok(Number.isInteger(sp.speech_scale(h, font)) && sp.speech_scale(h, font) >= 1);
        // bigger screen: not smaller letters; "groß" not smaller than "klein"
        assert.ok(sp.speech_scale(1080, font) >= sp.speech_scale(720, font));
        assert.ok(sp.speech_scale(720, font, 'large') >= sp.speech_scale(720, font, 'small'));
    }
    // the fonts look about equally big: capitals within a few pixels of each other
    const caps = Object.keys(sp.SPEECH_FONTS).map(f => sp.speech_scale(720, f) * sp.SPEECH_FONTS[f].cap);
    assert.ok(Math.max(...caps) - Math.min(...caps) <= 6, caps.join(', '));
});

test('wrapping: whole words per line; a word too long on its own is cut', () => {
    const measure = s => s.length * 10;
    assert.deepEqual(sp.wrap_speech('Hier wohnt die Hexe Grüßli', 120, measure), ['Hier wohnt', 'die Hexe', 'Grüßli']);
    assert.deepEqual(sp.wrap_speech('kurz', 120, measure), ['kurz']);
    const cut = sp.wrap_speech('Donaudampfschifffahrt', 60, measure);
    assert.ok(cut.every(line => measure(line) <= 60) && cut.join('') === 'Donaudampfschifffahrt');
});

test('a monologue: one sentence after the other, by time or skipped with "."', () => {
    const s = new sp.Speech();
    assert.equal(s.start({ parts: [] }, 0), false);
    assert.equal(s.active, false);
    assert.equal(s.start({ parts: ['Eins.', 'Zwei, länger als eins.', 'Drei.'], source: 4 }, 10), true);
    assert.equal(s.text, 'Eins.');
    s.update(10 + 1.4);
    assert.equal(s.text, 'Eins.');
    s.update(10 + 1.5);                     // its time is up
    assert.equal(s.text, 'Zwei, länger als eins.');
    s.skip(12);                             // "." – straight on
    assert.equal(s.text, 'Drei.');
    s.update(100);                          // the last one ends too
    assert.equal(s.active, false);
    assert.equal(s.text, null);
    assert.deepEqual(s.log, ['Eins.', 'Zwei, länger als eins.', 'Drei.']);
    // a long pause: every sentence still comes once, in order
    const t = new sp.Speech();
    t.start({ parts: ['a', 'b', 'c'] }, 0);
    t.update(1000);
    assert.deepEqual(t.log, ['a', 'b', 'c']);
    t.start({ parts: ['x'] }, 0);
    t.stop();
    assert.equal(t.active, false);
});

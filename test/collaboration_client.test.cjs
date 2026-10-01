const assert = require('node:assert/strict');
const test = require('node:test');
const {
    normalize_collaboration_name,
    collaboration_code_from_url,
    collaboration_websocket_url,
    collaboration_connection_status,
} = require('../src/static/collaboration.js');

test('collaboration names are required, compact and bounded', () => {
    assert.equal(normalize_collaboration_name('  Mia   Muster  '), 'Mia Muster');
    assert.equal(normalize_collaboration_name(''), null);
    assert.equal(normalize_collaboration_name('   '), null);
    assert.equal(normalize_collaboration_name('Mia\nBen'), null);
    assert.equal(normalize_collaboration_name('x'.repeat(41)), null);
    assert.equal(normalize_collaboration_name('🎮'.repeat(40)), '🎮'.repeat(40));
});

test('collaboration code is separate from the normal game hash', () => {
    assert.equal(
        collaboration_code_from_url('https://2d.example/studio?collab=abc123#level'),
        'abc123',
    );
    assert.equal(
        collaboration_code_from_url('https://2d.example/studio#level'),
        null,
    );
});

test('websocket URL follows the page transport', () => {
    assert.equal(
        collaboration_websocket_url('abc 123', { protocol: 'http:', host: 'localhost:8025' }),
        'ws://localhost:8025/collaboration/abc%20123',
    );
    assert.equal(
        collaboration_websocket_url('abc123', { protocol: 'https:', host: '2d.example' }),
        'wss://2d.example/collaboration/abc123',
    );
});

test('connection status distinguishes first connect from reconnect', () => {
    assert.equal(collaboration_connection_status(false, false), 'Verbindung wird hergestellt …');
    assert.equal(collaboration_connection_status(false, true), 'Verbindung wird wiederhergestellt …');
    assert.equal(collaboration_connection_status(true, true), 'Verbunden');
});

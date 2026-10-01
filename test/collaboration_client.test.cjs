const assert = require('node:assert/strict');
const test = require('node:test');
const {
    normalize_collaboration_name,
    collaboration_code_from_url,
    collaboration_websocket_url,
    collaboration_connection_status,
    collaboration_resource_value,
    collaboration_lock_revisions,
    collaboration_changed_resources,
    collaboration_resource_description,
    collaboration_saved_notice,
    collaboration_save_error_message,
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


test('resource helper addresses settings, sprites and levels without changing saved data', () => {
    const state = {
        properties: { title: 'Spiel' },
        sprites: [{ name: 'A' }, { name: 'B' }],
        levels: [{ name: 'L1' }],
    };
    assert.deepEqual(collaboration_resource_value(state, 'settings'), { title: 'Spiel' });
    assert.deepEqual(collaboration_resource_value(state, 'sprite:1'), { name: 'B' });
    assert.deepEqual(collaboration_resource_value(state, 'level:0'), { name: 'L1' });
    assert.equal(collaboration_resource_value(state, 'sprite:99'), null);
    assert.equal(collaboration_resource_value(state, 'nope'), null);
});

test('lock revisions expose only resources currently being edited', () => {
    const participants = [
        { id: 'a', name: 'Anna', lock: { resource: 'sprite:0', revision: 3 } },
        { id: 'b', name: 'Ben' },
        { id: 'c', name: 'Cem', lock: { resource: 'level:1', revision: 2 } },
    ];
    assert.deepEqual(collaboration_lock_revisions(participants), {
        'sprite:0': 3,
        'level:1': 2,
    });
});

test('changed resources are detected by per-resource revision, not by session revision', () => {
    const before = [
        { id: 'a', lock: { resource: 'sprite:0', revision: 1 } },
        { id: 'b', lock: { resource: 'level:0', revision: 4 } },
    ];
    const after = [
        { id: 'a', lock: { resource: 'sprite:0', revision: 2 } },
        { id: 'b', lock: { resource: 'level:0', revision: 4 } },
        { id: 'c', lock: { resource: 'sprite:1', revision: 0 } },
    ];
    assert.deepEqual(collaboration_changed_resources(before, after), ['sprite:0']);
});

test('resource descriptions are student-facing German', () => {
    assert.equal(collaboration_resource_description('sprite:0'), 'dieses Sprite');
    assert.equal(collaboration_resource_description('level:0'), 'dieses Level');
    assert.equal(collaboration_resource_description('settings'), 'die Einstellungen');
});


test('shared save messages name the saver without turning names into identities', () => {
    assert.equal(collaboration_saved_notice('Anna', false), 'Anna hat das Spiel gespeichert.');
    assert.equal(collaboration_saved_notice('Anna', true), 'Spiel gespeichert.');
    assert.equal(collaboration_saved_notice(null, false), 'Spiel gespeichert.');
});

test('shared save errors distinguish a concurrent save from a real failure', () => {
    assert.equal(
        collaboration_save_error_message('save_in_progress'),
        'Jemand anderes speichert das Spiel gerade. Versuche es gleich noch einmal.',
    );
    assert.equal(
        collaboration_save_error_message('save_failed'),
        'Das gemeinsame Spiel konnte nicht gespeichert werden.',
    );
});

test('classroom collaboration codes are uppercased, cleaned and exactly six characters', () => {
    const collaboration = require('../src/static/collaboration.js');

    assert.equal(collaboration.format_collaboration_code_input(' ab-12 cd '), 'AB12CD');
    assert.equal(collaboration.format_collaboration_code_input('abcdefghi'), 'ABCDEF');
    assert.equal(collaboration.normalize_collaboration_code('ab12cd'), 'AB12CD');
    assert.equal(collaboration.normalize_collaboration_code('AB12'), null);
});

test('collaboration code from URL is normalized to uppercase', () => {
    const collaboration = require('../src/static/collaboration.js');

    assert.equal(
        collaboration.collaboration_code_from_url('https://2d.example/studio?collab=ab12cd#level'),
        'AB12CD',
    );
});

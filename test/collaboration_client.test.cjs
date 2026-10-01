const assert = require('node:assert/strict');
const test = require('node:test');
const {
    normalize_collaboration_name,
    collaboration_code_from_url,
    collaboration_websocket_url,
    collaboration_connection_status,
    collaboration_status_label,
    collaboration_resource,
    parse_collaboration_resource,
    collaboration_resource_value,
    collaboration_after_id,
    reorder_collaboration_list,
    apply_collaboration_structure,
    collaboration_rejection_notice,
    collaboration_lock_taken_notice,
    collaboration_lock_race_notice,
    collaboration_same_sprite_structure,
    collaboration_copy_frame_sources,
    collaboration_leave_text,
    collaboration_join_error_text,
    collaboration_resource_description,
    collaboration_saved_notice,
    collaboration_save_error_message,
} = require('../src/static/collaboration.js');
const { CollaborationClient } = require('../src/static/collaboration.js');

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
        'ABC123',
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

test('status-bar label does not expose the session code', () => {
    assert.equal(collaboration_status_label(true, 2), 'Gemeinsam · 2');
    assert.equal(collaboration_status_label(false, 2), 'Gemeinsam …');
});


test('resource descriptions are student-facing German', () => {
    assert.equal(collaboration_resource_description('sprite:s0'), 'dieses Sprite');
    assert.equal(collaboration_resource_description('level:l0'), 'dieses Level');
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


test('resources address sprites and levels by id, not by position', () => {
    const state = {
        properties: { title: 'Spiel' },
        sprites: [{ id: 'held', name: 'A' }, { id: 'muenze', name: 'B' }],
        levels: [{ id: 'start', name: 'L1' }],
    };
    assert.equal(collaboration_resource('sprite', 'held'), 'sprite:held');
    assert.equal(collaboration_resource('sprite', undefined), null);
    assert.deepEqual(parse_collaboration_resource('level:start'), { kind: 'level', id: 'start', key: 'levels' });
    assert.deepEqual(parse_collaboration_resource('settings'), { kind: 'settings', key: 'properties' });
    assert.equal(parse_collaboration_resource('frame:x'), null);
    assert.deepEqual(collaboration_resource_value(state, 'settings'), { title: 'Spiel' });
    assert.deepEqual(collaboration_resource_value(state, 'sprite:muenze'), { id: 'muenze', name: 'B' });
    assert.deepEqual(collaboration_resource_value(state, 'level:start'), { id: 'start', name: 'L1' });
    assert.equal(collaboration_resource_value(state, 'sprite:1'), null);
    assert.equal(collaboration_resource_value(state, 'nope'), null);
});

test('structure positions are expressed as the id of the previous item', () => {
    const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    assert.equal(collaboration_after_id(list, 'a'), null);
    assert.equal(collaboration_after_id(list, 'c'), 'b');
    assert.equal(collaboration_after_id(list, 'x'), null);
});

test('lists are brought into the server order in place', () => {
    const [a, b, c] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const list = [a, b, c];
    assert.deepEqual(reorder_collaboration_list(list, ['a', 'b', 'c']), { ok: true, changed: false });
    assert.deepEqual(reorder_collaboration_list(list, ['c', 'a', 'b']), { ok: true, changed: true });
    assert.deepEqual(list, [c, a, b]);
    assert.equal(list[0], c);
    assert.equal(reorder_collaboration_list(list, ['a', 'b']).ok, false);
    assert.equal(reorder_collaboration_list(list, ['a', 'b', 'x']).ok, false);
});

test('other participants\' inserts, deletes and moves are applied by id', () => {
    const list = [{ id: 'a' }, { id: 'b' }];
    const value = { id: 'n', states: [] };
    assert.ok(apply_collaboration_structure(list, { action: 'insert', id: 'n', value, order: ['a', 'n', 'b'] }).ok);
    assert.deepEqual(list.map(item => item.id), ['a', 'n', 'b']);
    assert.notEqual(list[1], value, 'the message value is copied');
    assert.ok(apply_collaboration_structure(list, { action: 'move', id: 'a', order: ['n', 'b', 'a'] }).ok);
    assert.deepEqual(list.map(item => item.id), ['n', 'b', 'a']);
    assert.ok(apply_collaboration_structure(list, { action: 'delete', id: 'b', order: ['n', 'a'] }).ok);
    assert.deepEqual(list.map(item => item.id), ['n', 'a']);
    assert.equal(apply_collaboration_structure(list, { action: 'delete', id: 'n', order: ['n', 'a'] }).ok, false);
    assert.equal(apply_collaboration_structure(list, { action: 'insert', id: 'x', value: { id: 'y' }, order: [] }).ok, false);
});

test('refused changes are explained in German', () => {
    assert.equal(collaboration_rejection_notice({ request: 'delete', kind: 'sprite', reason: 'locked' }, 'Mia'),
        'Mia bearbeitet dieses Sprite gerade. Es kann deshalb nicht gelöscht werden.');
    assert.equal(collaboration_rejection_notice({ request: 'delete', kind: 'level', reason: 'last_item' }),
        'Das letzte Level kann nicht gelöscht werden.');
    assert.match(collaboration_rejection_notice({ request: 'update', reason: 'stale' }), /nicht übernommen/);
    assert.match(collaboration_rejection_notice({ request: 'move', reason: 'unknown_resource' }), /neu geladen/);
});

// ------------------------------------------------------------ protocol flows

function harness({ pane = 'sprites', sprite_index = 0 } = {}) {
    const saved = { window: global.window, WebSocket: global.WebSocket, current_pane: global.current_pane };
    const sent = [];
    const loads = [];
    global.WebSocket = { OPEN: 1 };
    global.current_pane = pane;
    global.window = {
        canvas: { sprite_index, state_index: 0, frame_index: 0, detachSprite() {}, attachSprite() {} },
        game: {
            data: {
                properties: { title: 'Spiel' },
                sprites: [{ id: 'held', name: 'Held', states: [] }, { id: 'muenze', name: 'Münze', states: [] }],
                levels: [{ id: 'start', layers: [] }],
            },
            level_editor: { level_index: 0 },
            _load() { loads.push(true); },
            create_geometry_and_material_for_sprite() {},
            update_material_for_sprite() {},
            refresh_frames_on_screen() {},
            refresh_game_settings_controls() {},
        },
    };
    const client = new CollaborationClient();
    client.code = 'ABC123';
    client.connected = true;
    client.participant_id = 'me';
    client.socket = { readyState: 1, send(json) { sent.push(JSON.parse(json)); } };
    client.remember_all_server_values(); // what a snapshot does
    const restore = () => Object.assign(global, saved);
    return { client, sent, loads, data: global.window.game.data, restore };
}

const me_holding = (resource) => [{ id: 'me', name: 'Ich', lock: { resource } }];

test('a gap in the revisions asks for one snapshot and ignores messages until it arrives', () => {
    const h = harness();
    try {
        h.client.revision = 4;
        h.client.handle_message({ type: 'update', revision: 6, resource: 'sprite:muenze', resource_revision: 1,
            value: { id: 'muenze', name: 'zu spät' }, participant_id: 'other' });
        h.client.handle_message({ type: 'update', revision: 7, resource: 'sprite:muenze', resource_revision: 2,
            value: { id: 'muenze', name: 'auch ignoriert' }, participant_id: 'other' });
        assert.deepEqual(h.sent, [{ type: 'request_snapshot' }]);
        assert.equal(h.data.sprites[1].name, 'Münze');
        assert.equal(h.client.revision, 4);
    } finally { h.restore(); }
});

test('updates from others replace the resource with that id', () => {
    const h = harness();
    try {
        h.data.sprites.reverse(); // positions differ from the sender's
        h.client.handle_message({ type: 'update', revision: 1, resource: 'sprite:muenze', resource_revision: 3,
            value: { id: 'muenze', name: 'neu', states: [] }, participant_id: 'other' });
        assert.equal(h.data.sprites[0].name, 'neu');
        assert.equal(h.data.sprites[1].name, 'Held');
        assert.equal(h.client.resource_revisions['sprite:muenze'], 3);
        assert.equal(h.client.revision, 1);
    } finally { h.restore(); }
});

test('the resource we hold is sent once it stops changing; our own echo keeps newer local edits', () => {
    const h = harness();
    try {
        h.client.focused_resource = 'sprite:held';
        h.client.handle_presence(me_holding('sprite:held'));
        h.data.sprites[0].name = 'Held 2';
        h.client.sync_current_resource(); // change observed
        h.client.resource_changed_at -= 1000; // pretend 300 ms passed
        h.client.sync_current_resource();
        const update = h.sent.find(m => m.type === 'update');
        assert.deepEqual(update, { type: 'update', resource: 'sprite:held', resource_revision: 0,
            value: { id: 'held', name: 'Held 2', states: [] } });

        h.data.sprites[0].name = 'Held 3'; // edited again before the echo
        h.client.handle_message({ type: 'update', revision: 1, resource: 'sprite:held', resource_revision: 1,
            value: update.value, participant_id: 'me' });
        assert.equal(h.data.sprites[0].name, 'Held 3');
        assert.equal(h.client.pending_update, null);
        assert.equal(h.client.resource_revisions['sprite:held'], 1);
        assert.notEqual(h.client.serialize_local_resource('sprite:held'), h.client.synced_serialized);
    } finally { h.restore(); }
});

test('leaving a resource sends its last change before giving up the lock', () => {
    const h = harness();
    try {
        h.client.focused_resource = 'sprite:held';
        h.client.handle_presence(me_holding('sprite:held'));
        h.data.sprites[0].name = 'gerade gezeichnet';
        global.window.canvas.sprite_index = 1; // switch to the other sprite at once
        h.client.focus_current_resource();
        assert.deepEqual(h.sent.map(m => m.type), ['update']);
        assert.equal(h.client.focused_resource, 'sprite:held');

        h.client.handle_message({ type: 'update', revision: 1, resource: 'sprite:held', resource_revision: 1,
            value: h.sent[0].value, participant_id: 'me' });
        h.client.focus_current_resource();
        // one message: the server moves the lock to the new sprite
        assert.deepEqual(h.sent.slice(1), [{ type: 'lock', resource: 'sprite:muenze' }]);
        assert.equal(h.client.focused_resource, 'sprite:muenze');
    } finally { h.restore(); }
});

test('local structure changes are sent with their position and confirmed without a rebuild', () => {
    const h = harness();
    try {
        h.data.sprites.push({ id: 'neu', states: [] });
        h.client.structure_changed('sprite', 'insert', 'neu');
        assert.deepEqual(h.sent, [{ type: 'insert', kind: 'sprite', id: 'neu', after_id: 'muenze', value: { id: 'neu', states: [] } }]);
        assert.equal(h.client.pending_structure, 1);

        h.client.handle_message({ type: 'structure', revision: 1, kind: 'sprite', action: 'insert', id: 'neu',
            after_id: 'muenze', value: { id: 'neu', states: [] }, order: ['held', 'muenze', 'neu'],
            participant_id: 'me', participants: [] });
        assert.equal(h.client.pending_structure, 0);
        assert.equal(h.loads.length, 0);
        assert.equal(h.client.resource_revisions['sprite:neu'], 0);
    } finally { h.restore(); }
});

test('a foreign structure change is applied and the editor rebuilt', () => {
    const h = harness();
    try {
        h.client.handle_message({ type: 'structure', revision: 1, kind: 'sprite', action: 'move', id: 'held',
            after_id: 'muenze', order: ['muenze', 'held'], participant_id: 'other', participants: [] });
        assert.deepEqual(h.data.sprites.map(s => s.id), ['muenze', 'held']);
        assert.equal(h.loads.length, 1);
    } finally { h.restore(); }
});

test('a foreign structure change while our own is unconfirmed leads to a snapshot', () => {
    const h = harness();
    try {
        h.data.levels.push({ id: 'mein', layers: [] });
        h.client.structure_changed('level', 'insert', 'mein');
        h.client.handle_message({ type: 'structure', revision: 1, kind: 'level', action: 'insert', id: 'fremd',
            value: { id: 'fremd' }, order: ['start', 'fremd'], participant_id: 'other', participants: [] });
        assert.deepEqual(h.sent.map(m => m.type), ['insert', 'request_snapshot']);
        assert.ok(h.client.awaiting_snapshot);
    } finally { h.restore(); }
});

test('a refused structure change is undone through a snapshot', () => {
    const h = harness();
    try {
        h.client.participants = [{ id: 'other', name: 'Mia', lock: { resource: 'sprite:muenze' } }];
        h.data.sprites.splice(1, 1);
        h.client.structure_changed('sprite', 'delete', 'muenze');
        h.client.handle_message({ type: 'rejected', request: 'delete', kind: 'sprite', action: 'delete',
            id: 'muenze', reason: 'locked' });
        assert.deepEqual(h.sent.map(m => m.type), ['delete', 'request_snapshot']);
        assert.equal(h.client.pending_structure, 0);
    } finally { h.restore(); }
});

test('a sprite somebody else edits cannot be deleted', () => {
    const h = harness();
    try {
        h.client.participants = [{ id: 'other', name: 'Mia', lock: { resource: 'sprite:muenze' } }];
        assert.equal(h.client.can_delete('sprite', 'muenze'), false);
        assert.equal(h.client.can_delete('sprite', 'held'), true);
        h.client.connected = false;
        assert.equal(h.client.can_delete('sprite', 'held'), false);
        h.client.code = null;
        assert.equal(h.client.can_delete('sprite', 'muenze'), true, 'no session: no restriction');
    } finally { h.restore(); }
});

test('a rejected update takes the server version of the resource', () => {
    const h = harness();
    try {
        h.client.focused_resource = 'sprite:held';
        h.client.pending_update = { resource: 'sprite:held', serialized: '{}' };
        h.client.handle_message({ type: 'rejected', request: 'update', resource: 'sprite:held', reason: 'stale',
            resource_revision: 5, value: { id: 'held', name: 'Server', states: [] } });
        assert.equal(h.data.sprites[0].name, 'Server');
        assert.equal(h.client.resource_revisions['sprite:held'], 5);
        assert.equal(h.client.pending_update, null);
    } finally { h.restore(); }
});

test('only join errors end the session; other errors leave reconnecting to the close handler', () => {
    const h = harness();
    try {
        h.client.handle_message({ type: 'error', error: 'internal_error', fatal: true });
        h.client.handle_message({ type: 'error', error: 'invalid_json', fatal: false });
        assert.equal(h.client.intentional_close, false);
    } finally { h.restore(); }
});

test('remote sprite updates preserve an attached sprite even while another pane is visible', () => {
    const h = harness({ pane: 'level', sprite_index: 0 });
    let attach_args = null;
    let trait_refreshes = 0;
    try {
        Object.assign(global.window.canvas, {
            state_index: 1, frame_index: 1,
            detachSprite() { this.sprite_index = null; },
            attachSprite(sprite_index, state_index, frame_index, callback) {
                this.sprite_index = sprite_index;
                attach_args = [sprite_index, state_index, frame_index];
                callback();
            },
        });
        global.window.game.build_sprite_traits_menu = () => { trait_refreshes += 1; };
        h.client.apply_resource_value('sprite:held', {
            id: 'held', properties: { name: 'Neu' },
            states: [{ frames: [{ src: 'n0' }] }, { frames: [{ src: 'n1' }, { src: 'n2' }] }],
        });
        assert.deepEqual(attach_args, [0, 1, 1]);
        assert.equal(h.data.sprites[0].properties.name, 'Neu');
        assert.equal(trait_refreshes, 1);
    } finally { h.restore(); }
});

test('remote settings update refreshes settings controls without rebuilding the whole game', () => {
    const h = harness({ pane: 'settings' });
    let refreshes = 0;
    try {
        global.window.game.refresh_game_settings_controls = () => { refreshes += 1; };
        assert.ok(h.client.apply_resource_value('settings', { gravity: 0.8 }));
        assert.equal(h.data.properties.gravity, 0.8);
        assert.equal(refreshes, 1);
        assert.equal(h.loads.length, 0);
    } finally { h.restore(); }
});

// ------------------------------------------------------------ reconnecting and leases

function storage() {
    const items = new Map();
    return {
        getItem: key => items.has(key) ? items.get(key) : null,
        setItem: (key, value) => items.set(key, String(value)),
        removeItem: key => items.delete(key),
        items,
    };
}

function connection_harness() {
    const saved = {};
    for (const key of ['window', 'WebSocket', 'sessionStorage', 'history', 'current_pane'])
        saved[key] = global[key];
    const sockets = [];
    class FakeWebSocket {
        static OPEN = 1;
        constructor(url) {
            this.url = url;
            this.readyState = 1;
            this.sent = [];
            this.listeners = {};
            sockets.push(this);
        }
        addEventListener(type, listener) { this.listeners[type] = listener; }
        send(json) { this.sent.push(JSON.parse(json)); }
        close() {}
    }
    global.WebSocket = FakeWebSocket;
    global.sessionStorage = storage();
    global.history = { state: null, replaceState() {} };
    global.current_pane = 'sprites';
    global.window = {
        location: { protocol: 'http:', host: 'localhost:8025', href: 'http://localhost:8025/studio?collab=ABC123' },
        canvas: { sprite_index: 0 },
        game: { data: { properties: {}, sprites: [{ id: 'held', states: [] }], levels: [{ id: 'start' }] },
            _load() {}, save() {}, load() {} },
    };
    const client = new CollaborationClient();
    client.schedule_reconnect = () => { client.reconnects = (client.reconnects ?? 0) + 1; };
    const restore = () => Object.assign(global, saved);
    return { client, sockets, restore };
}

test('the reconnect token from the welcome is remembered and sent when joining again', () => {
    const h = connection_harness();
    try {
        h.client.connect('ABC123', 'Mia');
        h.sockets[0].listeners.open();
        assert.deepEqual(h.sockets[0].sent[0], { type: 'join', name: 'Mia', participant_id: null, reconnect_token: null });
        h.sockets[0].listeners.message({ data: JSON.stringify({
            type: 'welcome', participant_id: 'p1', reconnect_token: 'geheim', revision: 0,
            state: global.window.game.data, participants: [], resource_revisions: {},
        }) });
        clearInterval(h.client.heartbeat_interval);
        clearInterval(h.client.resource_interval);
        assert.equal(sessionStorage.getItem('2d-collaboration:ABC123:token'), 'geheim');

        h.client.connect('ABC123', 'Mia');
        h.sockets[1].listeners.open();
        assert.deepEqual(h.sockets[1].sent[0], { type: 'join', name: 'Mia', participant_id: 'p1', reconnect_token: 'geheim' });
    } finally { h.restore(); }
});

test('a connection replaced by another tab ends the session here instead of reconnecting', () => {
    const h = connection_harness();
    try {
        sessionStorage.setItem('2d-collaboration:ABC123:token', 'geheim');
        h.client.connect('ABC123', 'Mia');
        h.sockets[0].listeners.close({ code: 4010, reason: 'replaced' });
        assert.equal(h.client.reconnects, undefined);
        assert.equal(h.client.code, null);
        assert.equal(sessionStorage.getItem('2d-collaboration:ABC123:token'), null);
        assert.match(h.client.notice_override, /anderen Tab/);

        h.client.connect('ABC123', 'Mia');
        h.sockets[1].listeners.close({ code: 1006, reason: '' });
        assert.equal(h.client.reconnects, 1, 'an ordinary drop still reconnects');
    } finally { h.restore(); }
});

test('losing a lock to somebody else is explained', () => {
    const h = harness();
    try {
        h.client.focused_resource = 'sprite:held';
        h.client.handle_presence([{ id: 'me', name: 'Ich', lock: { resource: 'sprite:held' } }]);
        h.client.handle_presence([{ id: 'me', name: 'Ich' }, { id: 'o', name: 'Ben', lock: { resource: 'sprite:held' } }]);
        assert.equal(h.client.notice_override,
            'Ben arbeitet jetzt an diesem Sprite weiter, weil du eine Weile nichts daran geändert hast.');
        assert.match(collaboration_lock_taken_notice('Ben', 'level:start'), /an diesem Level weiter/);
        assert.match(collaboration_lock_taken_notice('Ben', 'settings'), /an den Einstellungen weiter/);
    } finally { h.restore(); }
});

test('a lock somebody else holds is asked for again now and then', () => {
    const h = harness();
    try {
        h.client.focused_resource = 'sprite:held';
        h.client.participants = [{ id: 'o', name: 'Ben', lock: { resource: 'sprite:held' } }];
        h.client.lock_retry_at = Date.now() + 10_000;
        h.client.ensure_current_resource_lock();
        assert.equal(h.sent.length, 0);
        h.client.lock_retry_at = Date.now() - 1;
        h.client.ensure_current_resource_lock();
        assert.deepEqual(h.sent, [{ type: 'lock', resource: 'sprite:held' }]);
        h.client.lock_request_pending = false;
        h.client.ensure_current_resource_lock();
        assert.equal(h.sent.length, 1, 'not again before the retry interval');
    } finally { h.restore(); }
});

// ------------------------------------------------------------ leaving

test('the leave question only warns about losing work when nobody else can save it', () => {
    assert.equal(collaboration_leave_text('load', { alone: false, unsaved: true }),
        'Wenn du ein anderes Spiel lädst, verlässt du die gemeinsame Sitzung. Die anderen können weiterarbeiten und das Spiel speichern.');
    assert.match(collaboration_leave_text('leave', { alone: true, unsaved: true }), /noch nicht gespeichert.*verloren/);
    assert.match(collaboration_leave_text('load', { alone: true, unsaved: false }), /ist gespeichert/);
});

function in_session(h) {
    h.client.code = 'ABC123';
    h.client.connected = true;
    h.client.participant_id = 'me';
    h.client.socket = { readyState: 1, sent: [], send(json) { this.sent.push(JSON.parse(json)); }, close() {} };
}

test('unsaved shared work is recognised from the revisions', () => {
    const h = connection_harness();
    try {
        in_session(h);
        h.client.revision = 3;
        h.client.saved_revision = 3;
        assert.equal(h.client.has_unsaved_changes(), false);
        h.client.revision = 4;
        assert.equal(h.client.has_unsaved_changes(), true);
    } finally { h.restore(); }
});

test('loading another game asks first, then leaves the session and loads', async () => {
    const h = connection_harness();
    try {
        const loaded = [];
        global.window.game.load = (tag) => loaded.push(tag);
        in_session(h);
        h.client.participants = [{ id: 'me', name: 'Ich' }, { id: 'o', name: 'Ben' }];
        let shown = 0;
        global.window.collaborationLeaveModal = { show() { shown += 1; } };
        h.client.install_load_guard();

        global.window.game.load('abc1234');
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(shown, 1);
        assert.deepEqual(loaded, []);
        assert.equal(h.client.code, 'ABC123');

        h.client.confirmed_leave();
        assert.deepEqual(loaded, ['abc1234']);
        assert.equal(h.client.code, null);

        global.window.game.load('def5678'); // outside a session: no question
        assert.deepEqual(loaded, ['abc1234', 'def5678']);
    } finally { h.restore(); }
});

test('the leave button only asks when the last participant would lose unsaved work', async () => {
    const h = connection_harness();
    try {
        global.window.collaborationLeaveModal = { show() {} };
        in_session(h);
        h.client.participants = [{ id: 'me', name: 'Ich' }, { id: 'o', name: 'Ben' }];
        h.client.revision = 5;
        h.client.confirm_leave('leave');
        assert.equal(h.client.code, null, 'others stay: leave at once');

        in_session(h);
        h.client.participants = [{ id: 'me', name: 'Ich' }];
        h.client.revision = 5;
        h.client.saved_revision = 4;
        h.client.confirm_leave('leave');
        assert.equal(h.client.code, 'ABC123', 'alone with unsaved work: ask first');
        assert.ok(h.client.pending_leave);
        await new Promise(resolve => setTimeout(resolve, 0));
    } finally { h.restore(); }
});

test('a session that ended while we were away is closed with an explanation', () => {
    const h = connection_harness();
    try {
        in_session(h);
        h.client.has_connected_once = true;
        h.client.handle_message({ type: 'error', error: 'session_not_found', fatal: true });
        assert.equal(h.client.code, null);
        assert.match(h.client.notice_override, /gibt es nicht mehr/);
    } finally { h.restore(); }
});

test('a shared save sends the palette the saver has selected', () => {
    const h = harness();
    const saved = { palettes: global.palettes, selected_palette_index: global.selected_palette_index };
    try {
        global.palettes = [{ colors: ['#000000', '#ffffff'] }];
        global.selected_palette_index = 0;
        h.client.save_after_sync = true;
        h.client.continue_shared_save();
        assert.deepEqual(h.sent.at(-1), { type: 'save', palette: ['#000000', '#ffffff'] });
    } finally { Object.assign(global, saved); h.restore(); }
});

test('refused joins are explained; other errors are not treated as refusals', () => {
    assert.match(collaboration_join_error_text('session_full'), /Mehr passen nicht/);
    assert.match(collaboration_join_error_text('too_many_attempts'), /falsche Codes/);
    assert.match(collaboration_join_error_text('name_too_long'), /40 Zeichen/);
    assert.equal(collaboration_join_error_text('internal_error'), null);
});

test('a refused join drops the code, a bad name keeps it', () => {
    const h = connection_harness();
    try {
        let errors = [];
        global.window.collaborationJoinModal = { show() {}, showError(text) { errors.push(text); } };
        in_session(h);
        h.client.handle_message({ type: 'error', error: 'name_required', fatal: true });
        assert.equal(h.client.code, 'ABC123');
        h.client.handle_message({ type: 'error', error: 'session_full', fatal: true });
        assert.equal(h.client.code, null);
        assert.equal(errors.length, 2);
    } finally { h.restore(); }
});

// ------------------------------------------------------------ switching without flicker

test('a resource nobody holds can be edited right away, before our lock arrives', () => {
    const h = harness();
    try {
        h.client.focus_current_resource(true);
        assert.deepEqual(h.sent, [{ type: 'lock', resource: 'sprite:held' }]);
        assert.equal(h.client.can_edit_current(), true, 'no waiting, no dimming');
        h.client.participants = [{ id: 'o', name: 'Ben', lock: { resource: 'sprite:held' } }];
        assert.equal(h.client.can_edit_current(), false, 'somebody else holds it');
        h.client.participants = [];
        h.client.connected = false;
        assert.equal(h.client.can_edit_current(), false, 'disconnected');
    } finally { h.restore(); }
});

test('changes made before the lock arrived are sent once it is there', () => {
    const h = harness();
    try {
        h.client.focus_current_resource(true);
        h.data.sprites[0].name = 'schon gezeichnet';
        h.client.sync_current_resource();
        h.client.resource_changed_at -= 1000;
        h.client.sync_current_resource();
        assert.deepEqual(h.sent.map(m => m.type), ['lock'], 'nothing is sent without the lock');
        assert.equal(h.client.has_unsaved_changes(), true);

        h.client.handle_presence(me_holding('sprite:held'));
        assert.equal(h.client.lock_request, null);
        h.client.sync_current_resource();
        h.client.resource_changed_at -= 1000;
        h.client.sync_current_resource();
        const update = h.sent.find(m => m.type === 'update');
        assert.equal(update?.value.name, 'schon gezeichnet');
    } finally { h.restore(); }
});

test('if somebody else was faster, our early changes are undone and the old lock is released', () => {
    const h = harness({ sprite_index: 1 });
    try {
        h.client.focused_resource = 'sprite:held';
        h.client.handle_presence(me_holding('sprite:held'));
        h.client.focus_current_resource(); // the canvas now shows "muenze"
        assert.deepEqual(h.sent.at(-1), { type: 'lock', resource: 'sprite:muenze' });
        h.data.sprites[1].name = 'meins';

        h.client.handle_message({ type: 'presence', participants: [
            { id: 'me', name: 'Ich', lock: { resource: 'sprite:held' } },
            { id: 'o', name: 'Ben', lock: { resource: 'sprite:muenze' } },
        ] });
        assert.equal(h.data.sprites[1].name, 'Münze', 'back to the server version');
        assert.equal(h.client.notice_override, collaboration_lock_race_notice('Ben', 'sprite:muenze'));
        assert.deepEqual(h.sent.at(-1), { type: 'unlock', resource: 'sprite:held' });
        assert.equal(h.client.has_unsaved_changes(), false);
    } finally { h.restore(); }
});

test('a stroke finished after somebody else took the sprite is undone', () => {
    const h = harness();
    try {
        h.client.focus_current_resource(true);
        h.client.handle_presence([{ id: 'me', name: 'Ich' }, { id: 'o', name: 'Ben', lock: { resource: 'sprite:held' } }]);
        h.data.sprites[0].name = 'Mausklick kam zu spät';
        h.client.sync_current_resource();
        assert.equal(h.data.sprites[0].name, 'Held');
        assert.ok(!h.sent.some(m => m.type === 'update'));
    } finally { h.restore(); }
});

test('a lock request without an answer is sent again', () => {
    const h = harness();
    try {
        h.client.focus_current_resource(true);
        h.client.ensure_current_resource_lock();
        assert.equal(h.sent.filter(m => m.type === 'lock').length, 1);
        h.client.lock_request.at -= 10_000;
        h.client.ensure_current_resource_lock();
        assert.equal(h.sent.filter(m => m.type === 'lock').length, 2);
    } finally { h.restore(); }
});

test('a shared save waits for our lock and then sends the early change first', () => {
    const h = harness();
    try {
        h.client.focus_current_resource(true);
        h.data.sprites[0].name = 'vor dem Speichern';
        h.client.request_shared_save();
        assert.ok(!h.sent.some(m => m.type === 'save' || m.type === 'update'));
        h.client.handle_presence(me_holding('sprite:held'));
        const update = h.sent.find(m => m.type === 'update');
        assert.equal(update?.value.name, 'vor dem Speichern');
        h.client.handle_message({ type: 'update', revision: 1, resource: 'sprite:held', resource_revision: 1,
            value: update.value, participant_id: 'me' });
        assert.equal(h.sent.at(-1).type, 'save');
    } finally { h.restore(); }
});

test('pixel-only changes are recognised so the editor is not rebuilt', () => {
    const sprite = (src, fps = 8) => ({ id: 's', traits: { pickup: {} },
        states: [{ properties: { name: 'a', fps }, frames: [{ src }, { src: 'x' }] }] });
    assert.equal(collaboration_same_sprite_structure(sprite('a'), sprite('b')), true);
    assert.equal(collaboration_same_sprite_structure(sprite('a'), sprite('a', 12)), false);
    const fewer = sprite('a');
    fewer.states[0].frames.pop();
    assert.equal(collaboration_same_sprite_structure(sprite('a'), fewer), false);
    const target = sprite('alt');
    const first_frame = target.states[0].frames[0];
    collaboration_copy_frame_sources(target, sprite('neu'));
    assert.equal(first_frame.src, 'neu', 'frames are updated in place');
});

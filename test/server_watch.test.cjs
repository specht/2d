const test = require('node:test');
const assert = require('node:assert/strict');
const { server_unavailable_status, server_status_after, upload_refused } = require('../src/static/server_watch.js');

test('which answers mean the server is away', () => {
    for (const status of [0, 502, 503, 504]) assert.equal(server_unavailable_status(status), true, String(status));
    // the server answered: a bug, not a restart
    for (const status of [200, 400, 404, 405, 500]) assert.equal(server_unavailable_status(status), false, String(status));
});

test('down, back, and a new version', () => {
    assert.equal(server_status_after('ok', { type: 'down' }, 'v1'), 'down');
    assert.equal(server_status_after('updated', { type: 'down' }, 'v1'), 'down');
    // back with the same version: just say so
    assert.equal(server_status_after('down', { type: 'up', version: 'v1' }, 'v1'), 'back');
    // back with another version: offer the reload
    assert.equal(server_status_after('down', { type: 'up', version: 'v2' }, 'v1'), 'updated');
    // restarted between two pings: noticed by the version alone
    assert.equal(server_status_after('ok', { type: 'up', version: 'v2' }, 'v1'), 'updated');
    assert.equal(server_status_after('ok', { type: 'up', version: 'v1' }, 'v1'), 'ok');
    // an older server without a version, or a page without one: no reload offer
    assert.equal(server_status_after('down', { type: 'up', version: null }, 'v1'), 'back');
    assert.equal(server_status_after('ok', { type: 'up', version: 'v2' }, null), 'ok');
    assert.equal(server_status_after('back', { type: 'up', version: 'v1' }, 'v1'), 'ok');
});

test('a game the server will not take: a proxy\'s 413 or the app\'s own limit', () => {
    assert.equal(upload_refused(413, '<html>413 Request Entity Too Large</html>'), true);
    assert.equal(upload_refused(500, '{"error":"too_much_data"}'), true);
    assert.equal(upload_refused(500, '{"error":"assertion failed"}'), false);
    assert.equal(upload_refused(502, ''), false);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { crash_should_report, crash_describe_element, crash_report_payload, CRASH_BREADCRUMBS } = require('../src/static/crash_report.js');

test('errors nobody in the studio can fix are not reported', () => {
    assert.equal(crash_should_report('Script error.', ''), false);
    assert.equal(crash_should_report('ResizeObserver loop completed with undelivered notifications.', 'x'), false);
    assert.equal(crash_should_report('boom', 'chrome-extension://abc/content.js'), false);
    assert.equal(crash_should_report("Cannot read properties of undefined (reading 'rects')", 'https://2d.hackschule.de/level_editor.js?abc'), true);
    // a same-origin "Script error." with a source is a real one
    assert.equal(crash_should_report('Script error.', 'https://2d.hackschule.de/app.js'), true);
});

const element = (props) => ({
    tagName: 'BUTTON', id: '', className: '', textContent: '', isContentEditable: false,
    getAttribute(name) { return props.attrs?.[name] ?? null; },
    closest() { return props.closest ?? this; },
    ...props,
});

test('a click is described by what was clicked, never by what was typed', () => {
    assert.equal(crash_describe_element(element({ id: 'mi_level', textContent: '  Level \n' })), 'button#mi_level "Level"');
    assert.equal(crash_describe_element(element({ className: 'menu_layer_item active extra', textContent: 'Sprites (4) · Welt' })),
        'button.menu_layer_item.active "Sprites (4) · Welt"');
    assert.equal(crash_describe_element(element({ tagName: 'INPUT', id: 'own_game_title', textContent: 'Lea' })), 'input#own_game_title');
    assert.equal(crash_describe_element(element({ textContent: 'x'.repeat(80) })).length, 'button "'.length + 30 + 1);
    assert.equal(crash_describe_element(element({ attrs: { title: 'Level testen (T)' }, textContent: '' })), 'button "Level testen (T)"');
    assert.equal(crash_describe_element(null), '?');
});

test('the report carries what helps to reproduce, cut to size', () => {
    const crumbs = Array.from({ length: 50 }, (_, i) => `${i}s level click x`);
    const payload = crash_report_payload({ message: 'm'.repeat(3000), source: 's', line: 12, column: NaN, stack: 'x'.repeat(9000) },
        crumbs, { pane: 'level' }, 'v1');
    assert.equal(payload.kind, 'error');
    assert.equal(payload.message.length, 2000);
    assert.equal(payload.stack.length, 6000);
    assert.equal(payload.line, 12);
    assert.equal(payload.column, undefined);
    assert.equal(payload.breadcrumbs.length, CRASH_BREADCRUMBS);
    assert.equal(payload.breadcrumbs.at(-1), '49s level click x');
    assert.deepEqual(payload.context, { pane: 'level' });
    assert.equal(payload.studio_version, 'v1');
});

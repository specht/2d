const test = require('node:test');
const assert = require('node:assert/strict');
const { modal_dialog_key_action } = require('../src/static/modaldialogs.js');

const b = (label, more = {}) => ({ label, ...more });

test('Esc clicks the cancel button, or closes the dialog', () => {
    assert.equal(modal_dialog_key_action('Escape', [b('Abbrechen'), b('Ja, 32 × 32')]), 0);
    assert.equal(modal_dialog_key_action('Escape', [b('Sitzung verlassen'), b('Schließen')]), 1);
    assert.equal(modal_dialog_key_action('Escape', [b('Zurück'), b('Beitreten')]), 0);
    assert.equal(modal_dialog_key_action('Escape', [b('Rückgängig machen'), b('Fertig')]), 'dismiss');
    assert.equal(modal_dialog_key_action('Escape', [b('Weg damit', { cancel: true }), b('Behalten')]), 0);
    // a hidden cancel button is not clicked
    assert.equal(modal_dialog_key_action('Escape', [b('Abbrechen', { visible: false }), b('OK')]), 'dismiss');
    // a disabled cancel button is not clicked; a busy dialog (every button hidden) stays
    assert.equal(modal_dialog_key_action('Escape', [b('Abbrechen', { disabled: true }), b('OK')]), null);
    assert.equal(modal_dialog_key_action('Escape', [b('Rückgängig machen', { visible: false }), b('Fertig', { visible: false })]), null);
    assert.equal(modal_dialog_key_action('Escape', []), 'dismiss');
    // a dialog that has to be answered stays
    assert.equal(modal_dialog_key_action('Escape', [b('Verwerfen'), b('Wiederherstellen')], { escape: false }), null);
});

test('Enter confirms only when one button is the confirmation', () => {
    assert.equal(modal_dialog_key_action('Enter', [b('Abbrechen'), b('Größe ändern')]), 1);
    // two real choices: Enter does nothing
    assert.equal(modal_dialog_key_action('Enter', [b('Abbrechen'), b('Zuerst speichern'), b('Trotzdem öffnen')]), null);
    // … unless one is hidden (Neues Spiel without unsaved changes) or opts out
    assert.equal(modal_dialog_key_action('Enter', [b('Abbrechen'), b('Erst speichern', { visible: false }), b('Neues Spiel anfangen')]), 2);
    assert.equal(modal_dialog_key_action('Enter', [b('Verwerfen', { enter: false }), b('Wiederherstellen')]), 1);
    // a disabled confirmation is not clicked, and Enter does not close instead
    assert.equal(modal_dialog_key_action('Enter', [b('Schließen'), b('In mein Spiel holen', { disabled: true })]), null);
    // only informing: Enter closes with Schließen, never with Abbrechen
    assert.equal(modal_dialog_key_action('Enter', [b('Schließen')]), 0);
    assert.equal(modal_dialog_key_action('Enter', [b('Sitzung verlassen', { enter: false }), b('Schließen')]), 1);
    assert.equal(modal_dialog_key_action('Enter', [b('Abbrechen')]), null);
    assert.equal(modal_dialog_key_action('Enter', []), null);
    assert.equal(modal_dialog_key_action('Tab', [b('Abbrechen'), b('OK')]), null);
});

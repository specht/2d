// Neues Spiel (Einstellungen → Spiel, and the dialog of Spiel laden): starts
// over with an empty game, exactly as the studio starts without one – no need
// to reload the page. Unsaved work is never lost by surprise: the dialog says
// so and offers to save first. Not during a live session (the session's game
// belongs to everybody in it).

function new_game_dialog() {
    if (window.newGameModal) return window.newGameModal;
    window.newGameModal = new ModalDialog({
        title: 'Neues Spiel',
        width: '480px',
        max_width: '92vw',
        body: `
            <div class="new-game-dialog">
                <p>Ein leeres Spiel: ein leeres Sprite und ein leeres Level, so wie das Studio ohne Spiel beginnt.</p>
                <p id="new_game_unsaved" class="new-game-warning"></p>
            </div>
        `,
        footer: [
            { type: 'button', label: 'Abbrechen', callback: (self) => self.dismiss() },
            { type: 'button', label: 'Erst speichern', icon: 'fa-save', callback: (self) => { self.dismiss(); game.save(); } },
            { type: 'button', label: 'Neues Spiel anfangen', icon: 'fa-file-o', color: 'green',
                callback: (self) => { if (start_new_game()) self.dismiss(); } },
        ],
    });
    return window.newGameModal;
}

function show_new_game_dialog() {
    const modal = new_game_dialog();
    const unsaved = game.has_unsaved_changes?.();
    $('#new_game_unsaved').toggle(!!unsaved).text(unsaved ?
        'Dein jetziges Spiel hat Änderungen, die noch nicht gespeichert sind. Wenn du neu anfängst, sind sie weg – speichere es vorher, wenn du es behalten willst.' : '');
    // "Erst speichern" only when there is something to save
    modal.dialog.find('.modal-footer button').eq(1).toggle(!!unsaved);
    modal.show();
    if (window.collaboration?.code)
        modal.showError('Während ihr gemeinsam bearbeitet, geht das nicht. Verlasse zuerst die Sitzung.');
}

// true once the new game is there
function start_new_game() {
    if (window.collaboration?.code) return false;
    game.reset();
    game.from_recipe = null;
    game.refresh_own_game_button?.();
    $('#game_code_div').hide();
    // the address names no game any more (a reload must not bring the old one back)
    if (window.location.search.replace('?', '').length === 7)
        history.replaceState(history.state, '', window.location.pathname + window.location.hash);
    if (window.studio_show_pane?.('sprites')) studio_history_push?.({ pane: 'sprites' });
    return true;
}

// The button in Einstellungen → Spiel, next to "Als eigenes Spiel weiterführen".
Game.prototype.add_new_game_button = function (container) {
    const box = $('<div>').addClass('own-game new-game').appendTo(container);
    $('<button>').attr('type', 'button').addClass('own-game-button')
        .append($('<i>').addClass('fa fa-file-o'))
        .append(document.createTextNode(' Neues Spiel …'))
        .on('click', () => show_new_game_dialog())
        .appendTo(box);
    $('<div>').addClass('own-game-hint')
        .text('Fängt ein neues, leeres Spiel an – ohne die Seite neu zu laden.')
        .appendTo(box);
};

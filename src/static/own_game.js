// Als eigenes Spiel weiterführen (Einstellungen → Spiel).
//
// Saving normally continues the version tree of the game that was opened:
// `data.parent` is the code of that version. Continuing as an own game saves
// the current state as the first version of a new game instead – no parent,
// so it is a new entry in the game list, and every later save continues the
// new game. The game it came from and all its versions stay as they are.
//
// Game codes are derived from the saved JSON, so clearing `parent` alone would
// give an unchanged game the code it already has (and two children forking
// the same version the same code). Every own game therefore gets a random
// `lineage` that only makes it distinct: absent in older games (their codes
// stay the same), never read by the game itself.

function new_lineage_id() {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => (b % 36).toString(36)).join('');
}

// The same title as before, ignoring case and spaces: not a new name.
function same_game_title(a, b) {
    const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
    return norm(a) !== '' && norm(a) === norm(b);
}

Game.prototype.can_continue_as_own_game = function () {
    return (typeof this.data?.parent === 'string' && this.data.parent !== '') || !!this.from_recipe;
};

// Unsaved changes: the game as it was last loaded or saved, without `parent`
// (saving changes it). Asked before something replaces the game (rezepte.js).
Game.prototype.saved_state_snapshot = function () {
    const { parent, ...rest } = this.data ?? {};
    return JSON.stringify(rest);
};

Game.prototype.remember_saved_state = function (snapshot = null) {
    this.saved_state = snapshot ?? this.saved_state_snapshot();
};

Game.prototype.has_unsaved_changes = function () {
    return this.saved_state !== undefined && this.saved_state !== this.saved_state_snapshot();
};

// The button in Einstellungen → Spiel (below Titel and Autor). Only for a game
// that has a code: a game that was never saved is its own game already.
Game.prototype.add_own_game_button = function (container) {
    const box = $('<div>').addClass('own-game').appendTo(container);
    $('<button>').attr('type', 'button').addClass('own-game-button')
        .append($('<i>').addClass('fa fa-code-fork'))
        .append(document.createTextNode(' Als eigenes Spiel weiterführen …'))
        .on('click', () => show_own_game_dialog(this.from_recipe ? 'recipe' : 'fork'))
        .appendTo(box);
    $('<div>').addClass('own-game-hint')
        .text('Macht daraus ein neues Spiel mit eigenem Code. Das Spiel, von dem du kommst, bleibt unverändert.')
        .appendTo(box);
    this.own_game_box = box;
    this.refresh_own_game_button();
};

Game.prototype.refresh_own_game_button = function () {
    this.own_game_box?.toggle(this.can_continue_as_own_game());
};

// Saves the current state as the first version of a new game. Nothing changes
// if saving fails, so the next normal save still continues the old game.
Game.prototype.save_as_own_game = function (title, author, on_saved, on_failed) {
    if (this.currently_saving) { on_failed?.('busy'); return; }
    const properties = this.data.properties;
    const before = { parent: this.data.parent, lineage: this.data.lineage, title: properties.title, author: properties.author };
    properties.title = title;
    properties.author = author;
    this.data.parent = null;
    this.data.lineage = new_lineage_id();
    this.send_save((tag) => {
        this.refresh_game_settings_controls();
        on_saved?.(tag);
    }, () => {
        this.data.parent = before.parent;
        if (before.lineage === undefined) delete this.data.lineage; else this.data.lineage = before.lineage;
        properties.title = before.title;
        properties.author = before.author;
        on_failed?.('error');
    });
};

function own_game_dialog() {
    if (window.ownGameModal) return window.ownGameModal;
    window.ownGameModal = new ModalDialog({
        title: 'Als eigenes Spiel weiterführen',
        width: '460px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog own-game-dialog">
                <p id="own_game_lead" class="collab-lead"></p>
                <label class="collab-field">
                    <span>Titel des Spiels</span>
                    <input id="own_game_title" maxlength="60" autocomplete="off" spellcheck="false" placeholder="zum Beispiel: Pips großes Abenteuer">
                </label>
                <label class="collab-field">
                    <span>Autor – dein Name</span>
                    <input id="own_game_author" maxlength="40" autocomplete="off" spellcheck="false">
                </label>
            </div>
        `,
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Als eigenes Spiel speichern',
                color: 'green',
                callback: (self) => submit_own_game_dialog(self),
            },
        ],
    });
    // Enter in a field saves, like the button
    $('#own_game_title, #own_game_author').on('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); submit_own_game_dialog(window.ownGameModal); }
    });
    return window.ownGameModal;
}

const OWN_GAME_TEXTS = {
    fork: {
        title: 'Als eigenes Spiel weiterführen',
        lead: () => 'Dein Spiel bekommt einen eigenen Code und eine eigene Geschichte: Wenn du später speicherst, geht es mit deinem neuen Spiel weiter. Das Spiel, von dem du kommst, bleibt genau so, wie es ist – mit allen seinen Versionen.',
    },
    // Saving a recipe scene (rezepte.js): the recipes stay as they are for
    // everybody, so the game list never shows a recipe that somebody changed.
    recipe: {
        title: 'Als eigenes Spiel speichern',
        lead: (recipe) => `Das ist die Szene aus dem Rezept „${recipe?.titel ?? ''}“. Die Rezepte bleiben für alle so, wie sie sind – deshalb wird daraus beim Speichern dein eigenes Spiel, mit eigenem Titel und eigenem Code.`,
    },
};

// mode: 'fork' (the button in Einstellungen) or 'recipe' (saving a recipe scene).
function show_own_game_dialog(mode = 'fork', options = {}) {
    const modal = own_game_dialog();
    const texts = OWN_GAME_TEXTS[mode] ?? OWN_GAME_TEXTS.fork;
    modal.own_game_mode = mode;
    modal.own_game_options = options;
    modal.dialog.children('h3').first().text(texts.title);
    $('#own_game_lead').text(texts.lead(game.from_recipe));
    $('#own_game_title').val('');
    $('#own_game_author').val('');
    modal.show();
    if (window.collaboration?.code) {
        modal.showError('Während ihr gemeinsam bearbeitet, geht das nicht. Verlasse zuerst die Sitzung – danach kannst du daraus dein eigenes Spiel machen.');
        return;
    }
    $('#own_game_title').trigger('focus');
}

function submit_own_game_dialog(modal) {
    if (window.collaboration?.code) return;
    const title = String($('#own_game_title').val() ?? '').trim();
    const author = String($('#own_game_author').val() ?? '').trim();
    const old_title = game.from_recipe?.titel ?? game.data.properties.title;
    if (!title) { modal.showError('Bitte gib deinem Spiel einen Namen.'); $('#own_game_title').trigger('focus'); return; }
    if (same_game_title(title, old_title)) {
        modal.showError(modal.own_game_mode === 'recipe'
            ? 'Gib deinem Spiel einen eigenen Namen – nicht den Namen des Rezepts.'
            : 'Gib deinem Spiel einen neuen Namen, damit man es vom Spiel unterscheiden kann, von dem es kommt.');
        $('#own_game_title').trigger('focus');
        return;
    }
    if (!author) { modal.showError('Bitte gib deinen Namen ein.'); $('#own_game_author').trigger('focus'); return; }
    game.save_as_own_game(title, author, (tag) => {
        game.from_recipe = null;   // from now on an ordinary game of its own
        modal.dismiss();
        modal.own_game_options?.on_saved?.(tag);
    }, (reason) => {
        modal.showError(reason === 'busy'
            ? 'Das Spiel wird gerade gespeichert. Versuche es gleich noch einmal.'
            : 'Das Spiel konnte nicht gespeichert werden. Versuche es noch einmal.');
    });
}

if (typeof module !== 'undefined') module.exports = { new_lineage_id, same_game_title };

var backdrop_click_handler_initialized = false;

// Keys in a dialog. Esc cancels: it clicks the Abbrechen / Schließen / Zurück
// button (so what that button undoes is undone), or else closes the dialog
// like a click beside it – unless the dialog has to be answered (option
// escape: false). Enter confirms when exactly one button can be seen as the
// confirmation: every shown button but those (a footer entry may say
// cancel: true, or enter: false for a second choice such as »Verwerfen«);
// a dialog with nothing to confirm and a Schließen button closes with Enter.
// Fields that use Enter themselves (preventDefault) keep it.
const MODAL_CANCEL_LABELS = ['Abbrechen', 'Schließen', 'Zurück'];

// entries: the footer buttons { label, cancel, enter, visible, disabled }.
// Returns the index of the button to click, 'dismiss', or null (nothing).
function modal_dialog_key_action(key, entries, options = {}) {
    const shown = entries.map((entry, index) => ({ ...entry, index })).filter(entry => entry.visible !== false);
    const is_cancel = (entry) => entry.cancel ?? MODAL_CANCEL_LABELS.includes(String(entry.label ?? '').trim());
    const cancel = shown.find(is_cancel);
    // every button hidden: the dialog is busy (a palette being applied)
    if (entries.length > 0 && shown.length === 0) return null;
    if (key === 'Escape') {
        if (options.escape === false) return null;
        if (!cancel) return 'dismiss';
        return cancel.disabled ? null : cancel.index;
    }
    if (key === 'Enter') {
        const confirm = shown.filter(entry => !is_cancel(entry) && entry.enter !== false);
        if (confirm.length === 1) return confirm[0].disabled ? null : confirm[0].index;
        if (shown.length > 0 && confirm.length === 0 && cancel && !cancel.disabled && String(cancel.label).trim() === 'Schließen') return cancel.index;
    }
    return null;
}

class ModalDialog {
    constructor(options) {
        let self = this;
        this.parent = $('.modal-dialogs');
        if (!('width' in options)) options.width = '80vw';
        this.options = options;
        this.options.max_width ||= 'unset';
        this.dialog = $(`<div class='modal' style='display: none;'>`);
        this.dialog.css('width', `${this.options.width}`);
        this.dialog.css('max-width', `${this.options.max_width}`);
        if ('height' in options)
            this.dialog.css('height', `${options.height}`);
        if (options.title) {
            this.dialog.append($('<h3>').html(options.title));
        }
        if (options.body)
            this.dialog.append($(`<div class='modal-body'>`).append($(options.body)));
        this.errorDiv = $(`<div class='modal-status'>`).appendTo(this.dialog);
        if (options.footer) {
            let footer = $(`<div class='modal-footer'>`).appendTo(this.dialog);
            for (let entry of options.footer) {
                if (entry.type === 'button') {
                    let button = $('<button>').text(entry.label);
                    button.data('modal_entry', entry);
                    if (entry.icon) {
                        button.empty();
                        button.append($(`<i class='fa ${entry.icon}'></i>`));
                        button.append(`&nbsp;&nbsp;`);
                        button.append(entry.label);
                    }
                    button.appendTo(footer);
                    if (entry.color)
                        button.addClass(entry.color);
                    if (entry.callback) {
                        button.click(function(e) {
                            entry.callback(self);
                        });
                    }
                } else if (entry.type === 'input') {
                    let input = $(`<input>`).attr('placeholder', entry.label);
                    if (entry.icon) {
                        input.empty();
                        input.append($(`<i class='fa ${entry.icon}'></i>`));
                        input.append(`&nbsp;&nbsp;`);
                        input.append(entry.label);
                    }
                    input.appendTo(footer);
                    // if (entry.color)
                    //     button.addClass(entry.color);
                    if (entry.callback) {
                        input.on('change keyup', function(e) {
                            entry.callback(self, input.val());
                        });
                    }
                }
            }
        }
        this.dialog.data('modal_dialog', this);
        this.parent.append(this.dialog);
        if (options.vars) {
            for (let key in options.vars) {
                this[key] = options.vars[key];
            }
        }
        if (options.onbody) {
            options.onbody(this);
        }
        this.dialog.mousedown(function(e) {
            e.stopPropagation();
        });
        if (!backdrop_click_handler_initialized) {
            backdrop_click_handler_initialized = true;
            self.parent.mousedown(function(e) {
                self.parent.hide();
                self.parent.find('.modal').hide();
            })
        }
    }

    show() {
        this.parent.show();
        this.errorDiv.hide();
        this.dialog.show();
        this.dialog.find('.modal-body')[0].scrollTop = 0;
        if (this.options.onshow) {
            this.options.onshow(this);
        }
    }

    hide() {
        this.dialog.hide();
        this.parent.hide();
    }

    dismiss() {
        this.hide();
    }

    showError(message) {
        this.errorDiv.html(message).slideDown();
    }
}

// The dialog in front, if one is shown (not the colour picker's backdrop).
function modal_dialog_in_front() {
    const shown = $('.modal-dialogs:visible > .modal:visible');
    return shown.length ? shown.last().data('modal_dialog') ?? null : null;
}

// A field in the dialog (a rename, a filter, a search) may use Esc itself:
// then Esc is looked at after it, like Enter.
function modal_dialog_field(dialog, target) {
    return !!(target?.closest?.('input, textarea, select, [contenteditable]') && dialog.dialog[0].contains(target));
}

function handle_modal_dialog_key(e, phase) {
    if (e.key !== 'Escape' && e.key !== 'Enter') return;
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing || e.repeat) return;
    const dialog = modal_dialog_in_front();
    if (!dialog) return;
    // a menu, the colour picker or a sprite list over the dialog closes first
    if ($('.context-menu:visible, #clr-picker.clr-open, .modal:visible .sprite-select-menu:visible').length) return;
    if (e.key === 'Escape' && (phase === 'capture') === modal_dialog_field(dialog, e.target)) return;
    if (e.key === 'Escape' && e.defaultPrevented) return;
    if (e.key === 'Enter') {
        if (e.defaultPrevented) return;
        // a text area or list keeps its Enter, a focused button or link in
        // the dialog does what Enter does there
        const target = e.target?.closest ? e.target : null;
        if (target?.closest('textarea, select, [contenteditable]')) return;
        if (target?.closest('button, a') && dialog.dialog[0].contains(target)) return;
    }
    const buttons = dialog.dialog.find('.modal-footer button').toArray();
    const entries = buttons.map(button => ({
        ...($(button).data('modal_entry') ?? { label: $(button).text() }),
        visible: $(button).is(':visible'),
        disabled: button.disabled,
    }));
    const action = modal_dialog_key_action(e.key, entries, dialog.options);
    if (action === null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (action === 'dismiss') dialog.dismiss();
    else $(buttons[action]).trigger('click');
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    // Esc before anything else sees it (the editors' own Esc, the recipe
    // popup) – unless a field of the dialog has the focus; Enter after the
    // fields of the dialog had their chance
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') handle_modal_dialog_key(e, 'capture'); }, true);
    window.addEventListener('keydown', (e) => handle_modal_dialog_key(e, 'bubble'));
}

if (typeof module !== 'undefined') module.exports = { modal_dialog_key_action, MODAL_CANCEL_LABELS };

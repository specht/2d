class ModalDialog {
    constructor(options) {
        let self = this;
        this.parent = $('.modal-dialogs');
        if (!('width' in options)) options.width = '80vw';
        this.options = options;
        this.dialog = $(`<div class='modal' style='display: none;'>`);
        this.dialog.css('width', `${this.options.width}`);
        if (options.title) {
            this.dialog.append($('<h3>').text(options.title));
        }
        if (options.body)
            this.dialog.append($(`<div class='modal-body'>`).append($(options.body)));
        this.errorDiv = $(`<div class='modal-status'>`).appendTo(this.dialog);
        if (options.footer) {
            let footer = $(`<div class='modal-footer'>`).appendTo(this.dialog);
            for (let entry of options.footer) {
                if (entry.type === 'button') {
                    let button = $('<button>').text(entry.label);
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
                }
            }
        }
        this.parent.append(this.dialog);
        if (options.vars) {
            for (let key in options.vars) {
                this[key] = options.vars[key];
            }
        }
        if (options.onbody) {
            options.onbody(this);
        }
    }

    show() {
        this.parent.fadeIn();
        this.errorDiv.hide();
        this.dialog.show();
        this.dialog.find('.modal-body')[0].scrollTop = 0;
        if (this.options.onshow) {
            this.options.onshow(this);
        }
    }

    hide() {
        this.dialog.hide();
        this.parent.fadeOut();
    }

    dismiss() {
        this.hide();
    }

    showError(message) {
        this.errorDiv.html(message).slideDown();
    }
}

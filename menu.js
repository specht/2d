const KEY_TR = {
    ' ': '␣',
    'Control': 'Strg',
    'ArrowLeft': '◄',
    'ArrowRight': '►',
    'ArrowUp': '▲',
    'ArrowDown': '▼'
};
class Menu {
    constructor(element, info) {
        this.element = element;
        let seen_groups = {};
        this.commands = {};
        this.shortcuts = {};
        this.groups = {};
        this.status_buttons = {};
        this.status_shortcuts = {};
        for (let item of info) {
            if (item.type === 'divider') {
                this.element.append($('<hr />'));
                continue;
            }
            let key_parts = [];
            if (item.group) key_parts.push(item.group);
            key_parts.push(item.command);
            let key = key_parts.join('/');
            let button = $('<div>').addClass('button');
            if (item.css) button.attr('style', item.css);
            if (item.image) button.css('background-image', `url(icons/${item.image}.png)`);
            if (item.size === 5)
                button.addClass('button-5');
            if (item.color)
                button.css('background-color', item.color);
            button.data('key', key);
            this.element.append(button);
            this.commands[key] = { button: button, hints: item.hints, label: item.label };
            if (item.shortcut) {
                button.append($('<div>').addClass('tooltip').addClass('key').text(item.shortcut));
                this.shortcuts[item.shortcut.toLowerCase()] = key;
            }
            if (item.group) {
                this.commands[key].group = item.group;
                this.groups[item.group] ||= { keys: [], active: null };
                this.groups[item.group].keys.push(key);
                if (!(item.group in seen_groups)) {
                    seen_groups[item.group] = true;
                    this.handle_click(key);
                }
            }
            let self = this;
            button.click(function (e) {
                self.handle_click($(e.target).closest('.button').data('key'));
            })
        }
        let self = this;
        $(window).keydown(function (e) {
            let k = e.key.toLowerCase();
            if (k in self.shortcuts) {
                e.preventDefault();
                e.stopPropagation();
                let key = self.shortcuts[k];
                self.handle_click(key);
                return;
            }
            if (k in self.status_shortcuts) {
                e.preventDefault();
                e.stopPropagation();
                self.handle_status_button_down(self.status_shortcuts[k], true);
                return;
            }
        })
        $(window).keyup(function (e) {
            let k = e.key.toLowerCase();
            if (k in self.status_shortcuts) {
                e.preventDefault();
                e.stopPropagation();
                self.handle_status_button_up(self.status_shortcuts[k], true);
                return;
            }
        })
    }

    get(group) {
        return this.groups[group].active;
    }

    handle_status_button_down(is, was_key) {
        let self = this;
        if (this.status_buttons[is].type === 'checkbox') {
            if (this.status_buttons[is].value) {
                if (!was_key) {
                    this.status_buttons[is].value = false;
                    this.status_buttons[is].button.removeClass('active');
                    this.status_buttons[is].callback(false);
                }
            } else {
                this.status_buttons[is].value = true;
                this.status_buttons[is].button.addClass('active');
                this.status_buttons[is].callback(true);
            }
        } else {
            this.status_buttons[is].button.addClass('active');
            setTimeout(function () { self.status_buttons[is].button.removeClass('active'); }, 20);
            this.status_buttons[is].callback();
        }
    }

    handle_status_button_up(is, was_key) {
        let self = this;
        if (was_key && this.status_buttons[is].value) {
            this.status_buttons[is].value = false;
            this.status_buttons[is].button.removeClass('active');
            this.status_buttons[is].callback(false);
        }
    }

    handle_click(key) {
        let self = this;
        let command = this.commands[key];
        if (command.group) {
            for (let other of this.groups[command.group].keys) {
                this.commands[other].button.removeClass('active');
            }
            this.commands[key].button.addClass('active');
            this.groups[command.group].active = key;
        }
        if (command.group === 'tool') {
            this.status_buttons = {};
            this.status_shortcuts = {};
            let statusBar = $('#status-bar');
            statusBar.empty();
            let hints = (command.hints || []).slice(0);
            if (command.label) hints.unshift(`<b>${command.label}</b>`);
            hints.unshift({ key: 'H', type: 'checkbox', label: 'Hilfe', callback: function (flag) { if (flag) self.element.find('.tooltip').show(); else self.element.find('.tooltip').hide(); } });
            let i = 0;
            for (let hint of hints) {
                let is = i.toString();
                if (typeof (hint) == 'string') {
                    statusBar.append($('<div>').addClass('status-bar-item').append(hint));
                } else if (typeof (hint) === 'object') {
                    if (hint.type === 'group') {
                        let button = $('<div>').addClass('status-bar-item status-bar-button').data('is', is);
                        for (let key of hint.keys)
                            button.append($(`<span class='key longkey'>${KEY_TR[key] || key}</span>`));
                        button.append(hint.label);
                        button.append($(`<span class='hint-divider'></span>`));
                        for (let shortcut of hint.shortcuts) {
                            let is = i.toString();
                            this.status_buttons[is] = { button: button, value: false, callback: shortcut.callback || (() => { }) };
                            this.status_shortcuts[shortcut.key.toLowerCase()] = is;
                            i += 1;
                        }
                        statusBar.append(button);
                    } else {
                        let button = $('<div>').addClass('status-bar-item status-bar-button').data('is', is);
                        button.append($(`<span class='key longkey'>${KEY_TR[hint.key] || hint.key}</span>`));
                        button.append(hint.label);
                        button.append($(`<span class='hint-divider'></span>`));
                        this.status_buttons[is] = { button: button, value: false, type: hint.type, callback: hint.callback || (() => { }) };
                        this.status_shortcuts[hint.key.toLowerCase()] = is;
                        statusBar.append(button);

                        button.mousedown(function () { self.handle_status_button_down(is, false); });
                        button.mouseup(function () { self.handle_status_button_up(is, false); });
                        button.mouseleave(function () { self.handle_status_button_up(is); });
                        i += 1;
                    }
                }
            }
        }
    }
}
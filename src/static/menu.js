const KEY_TR = {
    'Space': 'Leer',
    'Control': 'Strg',
    'ArrowLeft': '◄',
    'ArrowRight': '►',
    'ArrowUp': '▲',
    'ArrowDown': '▼'
};
class Menu {
    constructor(element, pane, info, canvas) {
        this.element = element;
        this.pane = pane;
        this.canvas = canvas;
        let seen_groups = {};
        this.commands = {};
        this.shortcuts = {};
        this.groups = {};
        this.status_buttons = {};
        this.status_shortcuts = {};
        this.active_key = null;
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
            this.commands[key] = { button: button, hints: item.hints, label: item.label, key: key };
            if (item.shortcut) {
                button.append($('<div>').addClass('tooltip').addClass('key').text(item.shortcut));
                this.shortcuts[item.shortcut] = key;
            }
            if (item.group) {
                this.commands[key].group = item.group;
                this.groups[item.group] ||= { keys: [], active: null };
                this.groups[item.group].keys.push(key);
            }
            if (item.callback)
                this.commands[key].callback = item.callback;
            if (item.data)
                this.commands[key].data = item.data;
            let self = this;
            button.click(function (e) {
                self.handle_click($(e.target).closest('.button').data('key'));
            })
            if (item.group) {
                if (!(item.group in seen_groups)) {
                    seen_groups[item.group] = true;
                    this.handle_click(key);
                }
            }
        }
        let self = this;
        $(window).keydown(function (e) {
            if ($(e.target).is('input')) return;
            let k = self.parseKeyEvent(e);
            if (k in self.shortcuts) {
                if (self.shortcuts[k].global || self.pane === current_pane) {
                    // console.log(`Handling menu keydown: ${k}`, self.shortcuts[k]);
                    e.preventDefault();
                    e.stopPropagation();
                    let key = self.shortcuts[k];
                    self.handle_click(key);
                    return;
                }
            }
            if (k in self.status_shortcuts) {
                if (self.status_shortcuts[k].global || self.pane === current_pane) {
                    // console.log(`Handling menu keydown: ${k}`, self.status_shortcuts[k]);
                    e.preventDefault();
                    e.stopPropagation();
                    self.handle_status_button_down(self.status_shortcuts[k], true);
                    return;
                }
            }
        })
        $(window).keyup(function (e) {
            last_spriteskip_timestamp = 0;
            last_stateskip_timestamp = 0;
            last_frameskip_timestamp = 0;
            let k = self.parseKeyEvent(e);
            if (k in self.status_shortcuts) {
                e.preventDefault();
                e.stopPropagation();
                self.handle_status_button_up(self.status_shortcuts[k], true);
                return;
            }
        })
    }

    parseKeyEvent(e) {
        let parts = [];
        if (['Control', 'Alt', 'Shift'].indexOf(e.key) >= 0) {
            return e.key;
        } else {
            if (e.ctrlKey) parts.push('Control');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');
            let k = e.code;
            if (k.substr(0, 3) === 'Key')
                k = k.substr(3);
            if (k.substr(0, 5) === 'Digit')
                k = k.substr(5);
            parts.push(k);
            return parts.join('+');
        }
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

    refresh_status_bar() {
        let active_command = null;
        // console.log('active_key', this.active_key);
        if (this.active_key)
            active_command = this.commands[this.active_key];
        let self = this;
        this.status_buttons = {};
        this.status_shortcuts = {};
        let statusBar = $('#status-bar');
        statusBar.empty();
        let hints = (active_command.hints || []).slice(0);
        if (active_command.label) hints.unshift(`<b>${active_command.label}</b>`);
        hints.unshift({
            label: `<i class='fa fa-sign-in'></i>&nbsp;&nbsp;Anmelden`, callback: function () {
            }
        });

        hints.push({ key: 'H', type: 'checkbox', label: 'Hilfe', callback: function (flag) { if (flag) self.element.find('.tooltip').show(); else self.element.find('.tooltip').hide(); } });
        // hints.push({ key: 'Control+Z', label: 'Rückgängig', callback: function () { self.canvas.undo(); } });
        hints.push({
            key: 'Control+O', label: 'Spiel laden', callback: function () {
                load_game();
            }
            // if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
        });
        hints.push({
            key: 'Control+S', label: 'Spiel speichern', callback: function () {
                game.save();
            }
            // if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); }
        });
        hints.push({
            key: 'F11', label: 'Vollbild', callback: function () {
                if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen();
            }
        });
        if (this.pane === 'sprites') {
            hints.push(
                {
                    type: 'group', keys: [`Bild <i class='fa fa-arrow-up'></i>`, `Bild <i class='fa fa-arrow-down'></i>`], label: 'Sprite wechseln', shortcuts: [
                        { key: 'PageUp', label: 'Zurück', callback: () => canvas.switchToSpriteDelta(-1) },
                        { key: 'PageDown', label: 'Vor', callback: () => canvas.switchToSpriteDelta(+1) },
                    ]
                },
            );
            hints.push(
                {
                    type: 'group', keys: [`<i style='font-size: 90%;' class='fa fa-chevron-up'></i>`, `<i style='font-size: 90%;' class='fa fa-chevron-down'></i>`], label: 'Zustand wechseln', shortcuts: [
                        { key: 'ArrowUp', label: 'Hoch', callback: () => canvas.switchToStateDelta(-1) },
                        { key: 'ArrowDown', label: 'Runter', callback: () => canvas.switchToStateDelta(+1) },
                    ]
                },
            );
            hints.push(
                {
                    type: 'group', keys: [`<i style='font-size: 90%;' class='fa fa-chevron-left'></i>`, `<i style='font-size: 90%;' class='fa fa-chevron-right'></i>`], label: 'Frame wechseln', shortcuts: [
                        { key: 'ArrowLeft', label: 'Links', callback: () => canvas.switchToFrameDelta(-1) },
                        { key: 'ArrowRight', label: 'Rechts', callback: () => canvas.switchToFrameDelta(+1) },
                        { key: 'Home', label: 'Pos1', callback: () => canvas.switchToFirstFrame() },
                        { key: 'End', label: 'Ende', callback: () => canvas.switchToLastFrame() },
                    ]
                },
            );
        }
        hints.push({
            key: 'Alt+1', visible: false, global: true, label: 'Sprites', callback: function () {
                $('#mi_sprites').click();
            }
        });
        hints.push({
            key: 'Alt+2', visible: false, global: true, label: 'Level', callback: function () {
                $('#mi_level').click();
            }
        });
        hints.push({
            key: 'Shift+D', label: 'Debug', callback: function () {
                console.log('debug!');
                window.debugModal.show();
            }
        });

        let i = 0;
        for (let hint of hints) {
            let is = i.toString();
            if (typeof (hint) == 'string') {
                statusBar.append($('<div>').addClass('status-bar-item').append(hint));
            } else if (typeof (hint) === 'object') {
                if (hint.type === 'group') {
                    let button = $('<div>').addClass('status-bar-item status-bar-button').data('is', is);
                    for (let key of hint.keys) {
                        let span = $(`<span class='key longkey'>${KEY_TR[key] || key}</span>`);
                        if (key !== hint.keys[hint.keys.length - 1])
                            span.css('margin-right', '3px');
                        button.append(span);
                    }
                    button.append(hint.label);
                    button.append($(`<span class='hint-divider'></span>`));
                    for (let shortcut of hint.shortcuts) {
                        let is = i.toString();
                        this.status_buttons[is] = { button: button, value: false, callback: shortcut.callback || (() => { }) };
                        this.status_shortcuts[shortcut.key] = is;
                        i += 1;
                    }
                    if (hint.visible !== false)
                        statusBar.append(button);
                } else {
                    let button = $('<div>').addClass('status-bar-item status-bar-button').data('is', is);
                    if (hint.key) {
                        let key_parts = hint.key.split('+');
                        for (let i = 0; i < key_parts.length; i++) {
                            let part = key_parts[i];
                            let style = '';
                            if (i > 0)
                                style = 'margin-left: -0.5em;'
                            button.append($(`<span class='key longkey' style='${style}'>${KEY_TR[part] || part}</span>`));
                        }
                    }
                    button.append(hint.label);
                    button.append($(`<span class='hint-divider'></span>`));
                    this.status_buttons[is] = { button: button, value: false, type: hint.type, callback: hint.callback || (() => { }) };
                    if (hint.key)
                        this.status_shortcuts[hint.key] = is;
                    if (hint.visible !== false)
                        statusBar.append(button);

                    button.mousedown(function () { self.handle_status_button_down(is, false); });
                    button.mouseup(function () { self.handle_status_button_up(is, false); });
                    button.mouseleave(function () { self.handle_status_button_up(is); });
                    i += 1;
                }
            }
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
            this.active_key = key;
            this.refresh_status_bar();
        }
        if (command.callback)
            command.callback(command);
    }
}
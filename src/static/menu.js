const KEY_TR = {
    'Space': 'Leer',
    'Control': 'Strg',
    'Delete': 'Entf',
    'ArrowLeft': '◄',
    'ArrowRight': '►',
    'ArrowUp': '▲',
    'ArrowDown': '▼'
};
// Shortcuts are matched by the key's position (e.code), so the tool buttons
// follow the rows of the keyboard. What is printed on that key depends on
// the layout – on a German keyboard the key at "Y" says Z. Where the browser
// tells (navigator.keyboard.getLayoutMap), the labels show the printed letter.
let KEYBOARD_LAYOUT = null;
function printed_key(letter) {
    if (typeof letter !== 'string' || !/^[A-Z]$/.test(letter)) return letter;
    const printed = KEYBOARD_LAYOUT?.get?.(`Key${letter}`);
    return printed && printed.length === 1 ? printed.toUpperCase() : letter;
}
if (typeof navigator !== 'undefined' && navigator.keyboard?.getLayoutMap) {
    navigator.keyboard.getLayoutMap().then((map) => {
        KEYBOARD_LAYOUT = map;
        if (typeof menus === 'undefined') return;
        for (const menu of Object.values(menus)) {
            menu.refresh_key_labels?.();
            if (typeof current_pane !== 'undefined' && menu.pane === current_pane) menu.refresh_status_bar?.();
        }
    }).catch(() => { });
}

class Menu {
    constructor(element, pane, info, canvas, callback) {
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
        this.callback = null;
        if (typeof(callback) !== 'undefined')
            this.callback = callback;
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
            this.commands[key].shortcut = item.shortcut;
            this.commands[key].title = item.title;
            if (item.shortcut) {
                button.append($('<div>').addClass('tooltip').addClass('key').text(printed_key(item.shortcut)));
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
        this.refresh_key_labels();
        let self = this;
        $(window).keydown(function (e) {
            if (e.ctrlKey && (e.key === 'o' || e.key === 's')) {
                e.stopPropagation();
                e.preventDefault();
            } else {
                if ($(e.target).is('input') || $(e.target).is('textarea')) return;
            }
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
                    // a toggle flips once per key press, not with the key's repeat
                    if (e.repeat && self.status_buttons[self.status_shortcuts[k]]?.type === 'toggle') return;
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
            if (typeof(k) === 'undefined') return '';
            if (k.substr(0, 3) === 'Key')
                k = k.substr(3);
            if (k.substr(0, 5) === 'Digit')
                k = k.substr(5);
            parts.push(k);
            return parts.join('+');
        }
    }

    // Hovering a tool says what it is and which key it has (printed_key);
    // item.title may explain more.
    refresh_key_labels() {
        for (const command of Object.values(this.commands)) {
            if (!command.label) continue;
            const key = command.shortcut ? printed_key(command.shortcut) : null;
            command.button.attr('title', [`${command.label}${key ? ` (Taste ${KEY_TR[key] || key})` : ''}`, command.title].filter(Boolean).join(' – '));
            if (key) command.button.children('.tooltip.key').text(key);
        }
    }

    get(group) {
        return this.groups[group].active;
    }

    handle_status_button_down(is, was_key) {
        let self = this;
        // toggle: a setting that stays on until it is pressed again (Gitter, Onion Skinning …)
        if (this.status_buttons[is].type === 'toggle') {
            const value = !this.status_buttons[is].get();
            this.status_buttons[is].callback(value);
            this.refresh_toggles();
            return;
        }
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

    // Toggles show whether their setting is on (it may change elsewhere, too).
    refresh_toggles() {
        for (const entry of Object.values(this.status_buttons))
            if (entry.type === 'toggle') entry.button.toggleClass('active', !!entry.get());
    }

    refresh_status_bar() {
        if (current_pane !== this.pane) return;
        let active_command = {};
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
        // Level editor (level_editor.js): right after the tool, before the general keys
        if (this.pane === 'level') {
            hints.push({ key_label: 'Control+Z', label: 'Rückgängig', class: 'level-history-undo',
                title: 'Macht die letzte Änderung an diesem Level rückgängig – Sprites, Ebenen, Einstellungen.',
                callback: () => game.level_editor?.undo() });
            hints.push({ key_label: 'Control+Y', label: 'Wiederholen', class: 'level-history-redo',
                title: 'Holt zurück, was du gerade rückgängig gemacht hast.',
                callback: () => game.level_editor?.redo() });
            // the view settings of the level editor (also under Werkzeuge)
            const titles = {
                show_grid: 'Zeigt das Gitter, an dem die Sprites einrasten.',
                show_signal_overview: 'Zeigt rechts alle Signale dieses Levels als Regeln: Wenn das passiert – dann das.',
                show_minimap: 'Zeigt unten links das ganze Level klein. Klick oder zieh auf der Karte, um dorthin zu springen.',
                animate_level: 'Sprites und Effekte bewegen sich schon hier im Editor, so wie im Spiel.',
            };
            for (const [key, option, label] of [['G', 'show_grid', 'Gitter'], ['S', 'show_signal_overview', 'Signale'], ['M', 'show_minimap', 'Karte'], ['A', 'animate_level', 'Level animieren']]) {
                hints.push({ key, type: 'toggle', label, title: titles[option],
                    get: () => !!game.level_editor?.[option],
                    callback: (value) => game.level_editor?.set_view_option?.(option, value) });
            }
        }
        // Sprite editor: undo/redo (sprite_history.js, matched by the printed
        // letter there), Onion Skinning (canvas.js), Vorschau (sprite_preview.js)
        if (this.pane === 'sprites') {
            hints.push({ key_label: 'Control+Z', label: 'Rückgängig', class: 'sprite-history-undo',
                title: 'Macht die letzte Änderung an diesem Sprite rückgängig – Pixel, Frames, Zustände, Framerate, Eigenschaften.',
                callback: () => window.sprite_history?.undo() });
            hints.push({ key_label: 'Control+Y', label: 'Wiederholen', class: 'sprite-history-redo',
                title: 'Holt zurück, was du gerade rückgängig gemacht hast.',
                callback: () => window.sprite_history?.redo() });
            hints.push({ key: 'O', type: 'toggle', label: 'Onion Skinning',
                title: 'Der Frame davor (rötlich) und danach (bläulich) scheinen durch – so zeichnest du eine Bewegung Schritt für Schritt.',
                get: () => !!canvas?.onion_skin,
                callback: (value) => canvas?.set_onion_skin?.(value) });
            // M: next to B and N (spiegeln) in the keyboard row of the tool buttons
            hints.push({ key: 'M', type: 'toggle', label: 'Spiegelnd zeichnen',
                title: 'Was du mit Stift, Formen oder Füllen zeichnest, erscheint auch gespiegelt auf der anderen Seite. Die gestrichelte Linie ist der Spiegel.',
                get: () => !!canvas?.symmetric,
                callback: (value) => canvas?.set_symmetric?.(value) });
            hints.push({ key: 'P', type: 'toggle', label: 'Vorschau',
                title: 'Spielt die Animation des Zustands oben rechts ab – mit Framerate (− / +) und gespiegelter Ansicht.',
                get: () => !!window.sprite_preview?.shown,
                callback: (value) => window.sprite_preview?.set_shown?.(value) });
        }
        // hints.unshift({
        //     label: `<i class='fa fa-sign-in'></i>&nbsp;&nbsp;Anmelden`, callback: function () {
        //         window.loginModal.show();
        //     }
        // });

        hints.push({ key: 'H', type: 'checkbox', label: 'Hilfe',
            title: 'Gedrückt halten: jeder Knopf zeigt seine Taste, und bei vielen Einstellungen erklärt ein ? (anklicken), was sie tut.',
            callback: function (flag) {
            if (flag) {
                $('.tooltip').show();
                for (let t of $('.tooltip')) {
                    let d = Math.abs((($(t)[0].getBoundingClientRect().left + $(t)[0].getBoundingClientRect().top) / 500.0)) % 1.0;
                    $(t).css('animation-delay', `${d * 1.0}s`);
                }
            }
            else {
                $('.tooltip').hide();
            }
        } });
        // hints.push({ key: 'Control+Z', label: 'Rückgängig', callback: function () { self.canvas.undo(); } });
        hints.push({
            key: 'Control+O', label: 'Spiel laden', callback: function () {
                window.loadGameModal.show();
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
        if (this.pane === 'play') {
            hints.push({
                key: 'Control+Enter', label: 'Spiel im Vollbild', callback: function () {
                    // fullscreen.js inside the game: only the game fills the screen
                    const frame = document.getElementById('play_iframe');
                    frame?.contentWindow?.toggle_game_fullscreen?.();
                    frame?.focus();
                }
            });
        }
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
            key: 'Alt+1', visible: true, global: true, label: 'Sprites', callback: function () {
                $('#mi_sprites').click();
            }
        });
        hints.push({
            key: 'Alt+2', visible: true, global: true, label: 'Level', callback: function () {
                $('#mi_level').click();
            }
        });
        hints.push({
            key: 'Alt+3', visible: true, global: true, label: 'Einstellungen', callback: function () {
                $('#mi_settings').click();
            }
        });
        hints.push({
            key: 'Alt+4', visible: true, global: true, label: 'Spielen', callback: function () {
                $('#mi_play').click();
            }
        });
        hints.push({
            key: 'Alt+5', visible: true, global: true, label: 'Hilfe', callback: function () {
                $('#mi_help').click();
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
                    if (hint.title) button.attr('title', hint.title);
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
                    if (hint.class) button.addClass(hint.class);
                    // hovering an entry explains it (the UI explains itself)
                    if (hint.title) button.attr('title', hint.title);
                    // key_label: shown like a key, but handled elsewhere (e.g. by the
                    // printed letter instead of the key's position, see level_editor.js)
                    const shown_key = hint.key ?? hint.key_label;
                    if (shown_key) {
                        let key_parts = shown_key.split('+');
                        for (let i = 0; i < key_parts.length; i++) {
                            // hint.key goes by position: show what is printed there
                            let part = hint.key ? printed_key(key_parts[i]) : key_parts[i];
                            let style = '';
                            if (i > 0)
                                style = 'margin-left: -0.5em;'
                            button.append($(`<span class='key longkey' style='${style}'>${KEY_TR[part] || part}</span>`));
                        }
                    }
                    button.append(hint.label);
                    button.append($(`<span class='hint-divider'></span>`));
                    this.status_buttons[is] = { button: button, value: false, type: hint.type, get: hint.get, callback: hint.callback || (() => { }) };
                    if (hint.type === 'toggle') button.addClass('status-bar-toggle').toggleClass('active', !!hint.get());
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
        window.collaboration?.append_status_control?.(statusBar);
        if (this.pane === 'level') game?.level_editor?.update_history_buttons?.();
        if (this.pane === 'sprites') window.sprite_history?.update_buttons?.();
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
        if (self.callback)
            self.callback();
    }

    blur() {
        let self = this;
        self.active_key = null;
        self.refresh_status_bar();
        self.element.find('.button').removeClass('active');
        if (self.callback)
            self.callback();
    }
}
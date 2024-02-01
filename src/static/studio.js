var menus = {};
var canvas = null;
var game = null;
var current_pane = 'sprites';
var selected_palette_index = 9;
var current_palette_rgb = [];
var tool_menu_items = {};

function bytes_to_str(i) {
    if (i < 1024)
        return `${i} B`;
    if (i < 1024 * 1024)
        return `${(i / 1024).toFixed(1)} kB`;
    if (i < 1024 * 1024 * 1024)
        return `${(i / 1024).toFixed(1)} MB`;
    return `${(i / 1024).toFixed(1)} GB`;
}

function handleResize() {
    canvas.handleResize();
    $('#canvas').css('left', `${(window.innerWidth - $('#canvas').width()) * 0.5}px`);
    $('#undo_stack').css('left', `${(window.innerWidth - $('#canvas').width()) * 0.5}px`);
    $('#undo_stack').css('width', `${$('#canvas').width()}px`);
    $('#menu_frames').css('left', `${(window.innerWidth - $('#canvas').width()) * 0.5}px`);
    $('#menu_frames').css('top', `${$('#canvas').height() + 120}px`);
    $('#menu_frames').css('width', `${$('#canvas').width()}px`);
    $('.menu_container').css('left', `${(window.innerWidth - $('#canvas').width()) * 0.5 - $('.menu_container').width() - 25}px`);
    $('.right_menu_container').css('left', `${(window.innerWidth + $('#canvas').width()) * 0.5 + 25}px`);
    $('.far_right_menu_container').css('left', `${(window.innerWidth + $('#canvas').width()) * 0.5 + 25 + 225}px`);
    $('.full_right_menu_container').css('left', `${window.innerWidth - 236}px`);
    $('.full_left_menu_container').css('left', `20px`);
    // $('#right_menu_container .menu_frames').css('height', `${$('#canvas').height() * 0.2 - 25}px`);

    if (window.innerWidth - $('#canvas').width() > 940)
        $('#states_container').appendTo($('.far_right_menu_container'));
    else
        $('#states_container').appendTo($('.right_menu_container'));

    $('#main_div_level .left_menu_container').css('left', '10px');
    $('#main_div_level .left_menu_container').css('width', '174px');
    $('#level').css('left', '260px');
    $('#level').css('top', '50px');
    $('#level').css('width', `${window.innerWidth - 516}px`);
    $('#level').css('height', `${window.innerHeight - 100}px`);
    if (game != null && game.level_editor != null) game.level_editor.handleResize();
}

function setPenWidth(menu_item) {
    canvas.pen_width = menu_item.data;
    canvas.update_overlay_brush();
    // canvas.update_selection_brush();
}

function setCurrentColor(color) {
    if (color.length === 7)
        color += 'ff';
    canvas.current_color = parseInt(color.replace('#', ''), 16);
    // $('#current_color_menu input').val(`#${canvas.current_color.toString(16)}`);
    let t = tinycolor(color);
    $('#current_color_menu').css('background', `linear-gradient(${t.toRgbString()},${t.toRgbString()}), url(transparent.png), #777`);
    $('#color_variations_menu').empty();
    let a = tinycolor(color).analogous(12);
    for (var h = 0; h < 11; h++) {
        var variation = a[h + 1];
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = -5; h <= 5; h++) {
        var variation = tinycolor(color);
        // -40 -30 -20 -10 0 10 20 30 40
        if (h < 0)
            variation.darken(Math.pow(Math.abs(h / 5.0), 1.0) * 40);
        else
            variation.brighten(Math.pow(Math.abs(h / 5.0), 1.0) * 40);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = -5; h <= 5; h++) {
        var variation = tinycolor(color);
        // -40 -30 -20 -10 0 10 20 30 40
        if (h < 0)
            variation.darken(Math.pow(Math.abs(h / 5.0), 2.0) * 20);
        else
            variation.brighten(Math.pow(Math.abs(h / 5.0), 2.0) * 20);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = -5; h <= 5; h++) {
        var variation = tinycolor(color);
        if (h < 0)
            variation.desaturate(-h * 16);
        else
            variation.saturate(h * 16);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = 1; h <= 11; h++) {
        var variation = tinycolor(color);
        variation.setAlpha(h / 11);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu .button').click(function (e) {
        let list_color = $(e.target).data('list_color');
        canvas.current_color = (((((list_color[0] * 256) + list_color[1]) * 256) + list_color[2]) * 256) + list_color[3];
        color_menu.element.find('.button').removeClass('active');
        $('#color_variations_menu').find('.button').removeClass('active');
        $(e.target).addClass('active');
    });
}

function activateTool(item) {
    canvas.clearSelection();
    if (item.key.substr(0, 5) === 'tool/') {
        if (item.key !== 'tool/picker')
            window.revert_to_tool = item.key;
        canvas.setShowPen(['tool/pen', 'tool/line', 'tool/rect', 'tool/ellipse',
            'tool/spray', 'tool/fill', 'tool/gradient', 'tool/fill-rect',
            'tool/fill-ellipse', 'tool/picker', 'tool/select-rect'].indexOf(item.key) >= 0);
        canvas.setModifierCtrl(false);
        canvas.setModifierAlt(false);
        canvas.setModifierShift(false);
        if (['tool/picker', 'tool/spray', 'tool/fill', 'tool/gradient', 'tool/select-rect'].indexOf(item.key) >= 0)
            menus.sprites.handle_click('penWidth/1');
    }
}

function update_color_palette_with_colors(colors) {
    color_menu_items = [];
    window.current_palette_rgb = [];
    for (let i = 0; i < colors.length + 1; i++) {
        let color = '';
        let k = i;
        let menu_item = null;
        if (k < colors.length) {
            let item = colors[k];
            color = item;
            menu_item = { group: 'color', data: color, command: color, color: color, size: 5 };
            // console.log(color.substring(3, 5));
            window.current_palette_rgb.push([
                parseInt(color.substring(1, 3), 16),
                parseInt(color.substring(3, 5), 16),
                parseInt(color.substring(5, 7), 16)]);
        } else {
            menu_item = { group: 'color', data: '#00000000', command: '', size: 5, css: `background-image: url(transparent.png); background-position: 5px 5px; background-repeat: repeat; background-color: #777;` };
        }
        menu_item.callback = function (item) {
            setCurrentColor(item.data);
        };
        color_menu_items.push(menu_item);
    }
    // color_menu_items.push({ image: 'palette' , size: 5, css: 'background-image-size: 16px 16px' });
    $('#color_menu').empty();
    color_menu = new Menu($('#color_menu'), 'sprites', color_menu_items);
}

function update_color_palette() {
    update_color_palette_with_colors(palettes[selected_palette_index].colors);
}

function show_modal(id) {
    $('modal-container .modal').hide();
    let complete = null;
    if (window[id + '_complete']) {
        complete = window[id + '_complete'];
    }
    $(`#${id}`).show({ duration: 0, complete: complete });
    $(`#${id}`).closest('.modal-container').show();
}

function close_modal() {
    console.log('huhu')
    for (let x of $('.modal-container .modal')) {
        console.log(x);
    }
    $('.modal-container .modal').hide();
    $('.modal-container').hide();
    // $('.modal-container').fadeOut({complete: () => {
    //     $('.modal').hide();
    // }});
}

function refresh_playtesting_code() {
    api_call('/api/get_playtesting_code', {}, function(data) {
        if (data.success) {
            $('#btn_playtesting').html(`<b>${data.title}</b> (${data.author})`);
            $('#btn_playtesting').attr('href', `https://2d.hackschule.de/play/${data.tag}`);
            console.log(data);
        }
    });
}

/*
 ├─e7a7qmp
 ├─5nqrh5b
 └─2x3hp8q
   ├─┬─4n2zuhp
   │ ├─l1bhsvc
   │ └─hrrmfjk
   └─┬─kppujs0
     └─2fbet5p

     ┌─2fbet5p
   ┌─┴─kppujs0
   │
   │ ┌─hrrmfjk
   │ ├─l1bhsvc
   ├─┴─4n2zuhp
   │
 ┌─2x3hp8q
 ├─5nqrh5b
 ├─e7a7qmp

      ┌─2fbet5p
   ┌─kppujs0
   │ ┌─hrrmfjk
   │ ├─l1bhsvc
   ├─4n2zuhp
 ┌─2x3hp8q
 ├─5nqrh5b
 ├─e7a7qmp

 e7a7qmp───5nqrh5b───2x3hp8q─┬─4n2zuhp───l1bhsvc───hrrmfjk
                             └─kppujs0───2fbet5p

 ├─e7a7qmp
 ├─5nqrh5b
 └─2x3hp8q
   ├─┬─4n2zuhp
   └─┼───kppujs0
     ├─l1bhsvc
     └───2fbet5p
 */

document.addEventListener("DOMContentLoaded", async function (event) {
    let shaders = new Shaders();
    await shaders.load();
    moment.locale('de');
    tool_menu_items.sprites = [
        { group: 'tool', command: 'pen', image: 'draw-freehand-44', shortcut: 'Q', label: 'Zeichnen' },
        { group: 'tool', command: 'line', image: 'draw-line-44', shortcut: 'W', label: 'Linie zeichnen' },
        {
            group: 'tool', command: 'rect', image: 'draw-rectangle-44', shortcut: 'E', label: 'Rechteck zeichnen', hints: [
                { key: 'Control', label: 'Seitenverhältnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'ellipse', image: 'draw-ellipse-44', shortcut: 'R', label: 'Ellipse zeichnen', hints: [
                { key: 'Control', label: 'Seitenverhältnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'spray', image: 'spray-can', shortcut: 'T', label: 'Sprühdose', hints: [
                { key: 'Control', label: 'Helligkeit variieren', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'auch auf anderen Farben', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        { group: 'tool', command: 'select-rect', image: 'select-rect-44', shortcut: 'Y', label: 'Rechteck auswählen', hints: [
            { key: 'Control', label: 'Auswahl erweitern', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
            { key: 'Alt', label: 'Auswahl verkleinern', type: 'checkbox', callback: function (x) { canvas.setModifierAlt(x); } },
            { key: 'Shift', label: 'Klonen', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
        ] },
        { group: 'tool', command: 'fill', image: 'color-fill-44', shortcut: 'A', label: 'Fläche füllen' },
        {
            group: 'tool', command: 'gradient', image: 'color-gradient', shortcut: 'S', label: 'Farbverlauf', hints: [
                { key: 'Control', label: 'Helligkeit variiieren', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Alt', label: 'kreisförmig', type: 'checkbox', callback: function (x) { canvas.setModifierAlt(x); } },
                { key: 'Shift', label: 'auch auf anderen Farben', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'fill-rect', image: 'fill-rectangle', shortcut: 'D', label: 'Rechteck füllen', hints: [
                { key: 'Control', label: 'Seitenverhältnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'fill-ellipse', image: 'fill-ellipse', shortcut: 'F', label: 'Ellipse füllen', hints: [
                { key: 'Control', label: 'Seitenverhältnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'pan', image: 'system-search', shortcut: 'G', label: 'Sichtbaren Ausschnitt ändern', hints: [
                // {
                //     type: 'group', keys: ['Pfeiltasten'], label: 'Verschieben', shortcuts: [
                //         { key: 'ArrowLeft', label: 'Links', callback: () => canvas.panLeft() },
                //         { key: 'ArrowRight', label: 'Rechts', callback: () => canvas.panRight() },
                //         { key: 'ArrowUp', label: 'Hoch', callback: () => canvas.panUp() },
                //         { key: 'ArrowDown', label: 'Runter', callback: () => canvas.panDown() }]
                // },
                // {
                //     type: 'group', keys: ['+', '-'], label: 'Zoom', shortcuts: [
                //         { key: '+', callback: () => canvas.zoomIn() },
                //         { key: '-', callback: () => canvas.zoomOut() },
                //     ]
                // },
                { key: 'Space', label: 'Automatisch anpassen', callback: () => canvas.autoFit() },
                `Zoome mit dem Mausrad und klicke, um den sichtbaren Ausschnitt zu verschieben`]
        },
        { command: 'clear', image: 'document-new', callback: () => canvas.clearFrame(), label: 'Frame löschen' },
        { group: 'tool', command: 'picker', image: 'color-picker', shortcut: 'Z', label: 'Farbe auswählen' },
        { group: 'tool', command: 'move', image: 'transform-move', shortcut: 'X', label: 'Sprite verschieben', hints: [
            { key: 'Shift', label: 'nur diesen Frame verschieben', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            {
                type: 'group', keys: ['Control', `<i style='font-size: 90%;' class='fa fa-chevron-left'></i>`, `<i style='font-size: 90%;' class='fa fa-chevron-right'></i>`, `<i style='font-size: 90%;' class='fa fa-chevron-up'></i>`, `<i style='font-size: 90%;' class='fa fa-chevron-down'></i>`], label: 'Verschieben', shortcuts: [
                    { key: 'Control+ArrowLeft', label: 'Links', callback: () => canvas.move_frames(-1, 0) },
                    { key: 'Control+ArrowRight', label: 'Rechts', callback: () => canvas.move_frames(+1, 0) },
                    { key: 'Control+ArrowUp', label: 'Pos1', callback: () => canvas.move_frames(0, -1) },
                    { key: 'Control+ArrowDown', label: 'Ende', callback: () => canvas.move_frames(0, +1) },
                    // we need to specify the Control+Shift variants as well or it wouldn't work if Shift is pressed
                    { key: 'Control+Shift+ArrowLeft', label: 'Links', callback: () => canvas.move_frames(-1, 0) },
                    { key: 'Control+Shift+ArrowRight', label: 'Rechts', callback: () => canvas.move_frames(+1, 0) },
                    { key: 'Control+Shift+ArrowUp', label: 'Pos1', callback: () => canvas.move_frames(0, -1) },
                    { key: 'Control+Shift+ArrowDown', label: 'Ende', callback: () => canvas.move_frames(0, +1) },
                ]
            },

        ] },
        { command: 'rotate-left', image: 'transform-rotate-left', shortcut: 'C', callback: () => canvas.rotateLeft() },
        { command: 'rotate-right', image: 'transform-rotate-right', shortcut: 'V', callback: () => canvas.rotateRight() },
        { command: 'flip-h', image: 'transform-flip-h', shortcut: 'B', callback: () => canvas.flipHorizontal() },
        { command: 'flip-v', image: 'transform-flip-v', shortcut: 'N', callback: () => canvas.flipVertical() },
        { type: 'divider' },
        { group: 'penWidth', command: '1', image: 'pen-width-1n', shortcut: '1', data: 1, callback: setPenWidth },
        { group: 'penWidth', command: '2', image: 'pen-width-2n', shortcut: '2', data: 2, callback: setPenWidth },
        { group: 'penWidth', command: '3', image: 'pen-width-3n', shortcut: '3', data: 3, callback: setPenWidth },
        { group: 'penWidth', command: '4', image: 'pen-width-4n', shortcut: '4', data: 4, callback: setPenWidth },
        { group: 'penWidth', command: '5', image: 'pen-width-5n', shortcut: '5', data: 5, callback: setPenWidth },
        { group: 'penWidth', command: '6', image: 'pen-width-6n', shortcut: '6', data: 6, callback: setPenWidth },
    ];
    tool_menu_items.sprites = tool_menu_items.sprites.map(function (x) {
        if (!x.callback)
            x.callback = activateTool;
        return x;
    });

    tool_menu_items.level = [
        { group: 'tool', command: 'pan', image: 'move-hand-44', shortcut: 'Q', label: 'Verschieben' },
        { group: 'tool', command: 'pen', image: 'draw-freehand-44', shortcut: 'W', label: 'Zeichnen', hints: [
            { key: 'Shift', label: 'Gitter ignorieren', type: 'checkbox', callback: function (x) { game.level_editor.setModifierShift(x); } },
        ] },
        { group: 'tool', command: 'select', image: 'select-rect-44', shortcut: 'E', label: 'Auswählen', hints: [
            { key: 'Control+A', label: 'Alles auswählen', callback: function (x) { game.level_editor.select_all(); } },
            { key: 'Delete', label: 'Auswahl löschen', callback: function (x) { game.level_editor.delete_selection(); } },
        ] },
        // { group: 'tool', command: 'fill-rect', image: 'fill-rectangle', shortcut: 'W', label: 'Rechteck füllen' },
    ];


    // $('#palettes_here').masonry('layout');
    // $('#palettes_here').change(function (e) {
    //     update_color_palette();
    // });
    // $('#palettes_here').val('9');

    canvas = new Canvas($('#canvas'), null);
    handleResize();

    update_color_palette();
    // initialize all other menus
    menus.level = new Menu($('#tool_menu_level'), 'level', tool_menu_items.level, null, function() {
        if (this.active_key === 'tool/pen') {
            $('#menu_level_sprites .button').removeClass('active');
            $('#menu_level_sprites .button').eq(game.level_editor.sprite_index).addClass('active');
        } else {
            $('#menu_level_sprites .button').removeClass('active');
        }
        if (this.active_key !== 'tool/select') {
            game?.level_editor?.clear_selection();
        }
        if (this.active_key !== null) {
            game?.level_editor?.refresh_backdrop_controls();
            game?.level_editor?.refresh();
            game?.level_editor?.render();
        }
    });
    // initialize sprites menu last
    menus.sprites = new Menu($('#tool_menu'), 'sprites', tool_menu_items.sprites, canvas);
    canvas.menu = menus.sprites;

    menus.settings = new Menu($('#tool_menu_settings'), 'settings', [], null);
    menus.play = new Menu($('#tool_menu_play'), 'play', [], null);
    menus.help = new Menu($('#tool_menu_help'), 'help', [], null);

    // menu.handle_click('tool/gradient');
    // menu.handle_click('penWidth/1');

    $('.btn-checkbox').click(function (e) {
        let state = $(e.target).attr('data-state') === 'true';
        $(e.target).attr('data-state', !state);
    })

    $('.main_div').hide();
    $('#main_div_sprites').show();

    $('.main-nav-item').click(function (e) {
        let key = $(e.target).attr('id').replace('mi_', '');
        $('.main-nav-item').removeClass('active');
        $(`#mi_${key}`).addClass('active');
        $('.main_div').hide();
        $(`#main_div_${key}`).show();
        current_pane = key;
        if (key in menus)
            menus[key].refresh_status_bar();
        if (current_pane === 'level')
            game.level_editor.refresh_sprite_widget();
        if (current_pane === 'play') {
            $('#play_iframe').hide();
            api_call('/api/save_game_temp', { game: game.data }, function (data) {
                if (data.success) {
                    console.log(`tag: ${data.tag}`);
                    $('#play_iframe')[0].contentWindow.game.load(data.tag);
                    $('#play_iframe').fadeIn();
                    $('#play_iframe').focus();
                }
            });
        } else {
            try {
                $('#play_iframe')[0].contentWindow.game.stop();
                $('#play_iframe')[0].contentWindow.yt_player.pauseVideo();
            } catch {}
        }
        if (current_pane === 'playtesting') {
            refresh_playtesting_code();
        }
    })

    $('#bu_save_game').click(function (e) {
        game.save();
    });

    setupDropdownMenu($('#functions_dropdown'), [
        {
            label: 'Sprite',
            children: [
                {
                    label: 'Größe ändern',
                    callback: () => {
                        window.resizeCanvasModal.show();
                    },
                },
                {
                    label: 'Sprite importieren',
                    callback: () => {
                        window.importSpriteModal.show();
                    }
                },
                // {
                //     label: 'Farbkorrektur',
                //     callback: () => {
                //         window.colorCorrectionModal.show();
                //     },
                // },
            ],
        },
        {
            label: 'Palette',
            children: [
                {
                    label: 'Palette wählen',
                    callback: () => {
                        window.choosePaletteModal.show();
                    }
                },
                {
                    label: 'Sprite an Palette anpassen',
                    children: [
                        {
                            label: "Ordered Dithering",
                            callback: () => {
                                canvas.append_to_undo_stack();
                                let dither = new DitherJS();
                                let context = canvas.bitmap.getContext('2d');
                                var imageData = context.getImageData(0, 0, canvas.bitmap.width, canvas.bitmap.height);
                                let algorithm = 'ordered';
                                // let algorithm = 'diffusion';
                                // let algorithm = 'atkinson';

                                dither.ditherImageData(imageData, { step: 1, algorithm: algorithm, palette: window.current_palette_rgb });
                                context.putImageData(imageData, 0, 0);
                                canvas.append_to_undo_stack();
                                canvas.write_frame_to_game_data();
                            }
                        },
                        {
                            label: "Diffusion Dithering",
                            callback: () => {
                                canvas.append_to_undo_stack();
                                let dither = new DitherJS();
                                let context = canvas.bitmap.getContext('2d');
                                var imageData = context.getImageData(0, 0, canvas.bitmap.width, canvas.bitmap.height);
                                // let algorithm = 'ordered';
                                let algorithm = 'diffusion';
                                // let algorithm = 'atkinson';

                                dither.ditherImageData(imageData, { step: 1, algorithm: algorithm, palette: window.current_palette_rgb });
                                context.putImageData(imageData, 0, 0);
                                canvas.append_to_undo_stack();
                                canvas.write_frame_to_game_data();
                            }
                        },
                        {
                            label: "Atkinson Dithering",
                            callback: () => {
                                canvas.append_to_undo_stack();
                                let dither = new DitherJS();
                                let context = canvas.bitmap.getContext('2d');
                                var imageData = context.getImageData(0, 0, canvas.bitmap.width, canvas.bitmap.height);
                                // let algorithm = 'ordered';
                                // let algorithm = 'diffusion';
                                let algorithm = 'atkinson';

                                dither.ditherImageData(imageData, { step: 1, algorithm: algorithm, palette: window.current_palette_rgb });
                                context.putImageData(imageData, 0, 0);
                                canvas.append_to_undo_stack();
                                canvas.write_frame_to_game_data();
                            }
                        },
                    ],
                },
            ],
        },
    ]);

    game = new Game();

    // game.load('6imgi0t');
    // game.load('skkmhwy');

    let tag = window.location.search.replace('?', '');
    if (tag.length === 7) {
        game.load(tag);
    }

    // document.oncopy = function (copyEvent) {
    //     // TODO: not working yet, maybe ask for permissions?
    //     console.log('copying sprite to clipboard!');
    //     let url = canvas.toUrl();
    //     console.log(url);
    //     copyEvent.clipboardData.setData('image/png', url);
    //     copyEvent.preventDefault();
    // }

    async function getClipboardContents() {
        // TODO: handle width and height correctly
        // return;
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    const blob = await item.getType(type);
                    console.log(type);
                    if (type.indexOf("image") === 0) {
                        var reader = new FileReader();
                        reader.onload = (event) => {
                            let image = new Image();
                            image.src = event.target.result;
                            image.decode().then(() => {
                                let si = canvas.sprite_index;
                                let sti = canvas.state_index;
                                let fi = canvas.frame_index;
                                if ((this.game.data.sprites[si].states.length === 1 &&
                                    this.game.data.sprites[si].states[sti].frames.length === 1) ||
                                    (this.game.data.sprites[si].width === image.width &&
                                    this.game.data.sprites[si].height === image.height))
                                {
                                    console.log(`got image: ${image.width}x${image.height}`);
                                    let sw = image.width;
                                    let sh = image.height;
                                    let tw = sw;
                                    let th = sh;
                                    if (tw > MAX_DIMENSION) tw = MAX_DIMENSION;
                                    if (th > MAX_DIMENSION) th = MAX_DIMENSION;
                                    // while ((tw % 24) !== 0) tw += 1;
                                    // while ((th % 24) !== 0) th += 1;
                                    // console.log(tw, th);
                                    let c = document.createElement('canvas');
                                    c.width = tw;
                                    c.height = th;
                                    let ctx = c.getContext('2d');
                                    let i = 0;
                                    for (let y = 0; y < Math.floor(image.height / sh); y++) {
                                        for (let x = 0; x < Math.floor(image.width / sw); x++) {
                                            // if (i >= 40 && i < 50) {
                                            ctx.clearRect(0, 0, tw, th);
                                            ctx.drawImage(image, x * sw, y * sh, sw, sh, 0, 0, sw, sh);
                                            let src = c.toDataURL('image/png');
                                            if (i === 0) {
                                                game.data.sprites[si].states[sti].frames[fi] = { src: src };
                                                game.data.sprites[si].width = sw;
                                                game.data.sprites[si].height = sh;
                                            }
                                            // }
                                            i += 1;
                                        }
                                    }
                                    canvas.detachSprite();
                                    canvas.attachSprite(si, sti, fi, function() {});
                                }
                            });
                        };
                        reader.readAsDataURL(blob);
                    }
                }
            }
        } catch (err) {
            console.error(err.name, err.message);
        }
    }

    document.onpaste = function (pasteEvent) {
        getClipboardContents();
    };

    $(document).on('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });
    $(document).on('drop', function (e) {
        return;
        if (!$('#mi_sprites').hasClass('active')) return;
        e.preventDefault();
        e.stopPropagation();
        let total = e.originalEvent.dataTransfer.files.length;
        let index = 0;
        let count = 0;
        let temp = {};
        let si = canvas.sprite_index;
        let sti = canvas.state_index;
        for (let file of e.originalEvent.dataTransfer.files) {
            console.log(file);
            (function (index) {
                let reader = new FileReader();
                reader.onload = function (event) {
                    temp[index] = event.target.result;
                    count += 1;
                    if (count === total) {
                        let src_list = [];
                        for (let i = 0; i < total; i++)
                            src_list.push(temp[i]);
                        canvas.insertFrames(si, sti, src_list);
                        // canvas.detachSprite();
                        // for (let i = 0; i < total; i++)
                        //     canvas.insertFrame(si, sti, temp[i], (i === total - 1) ? () => {
                        //         console.log('heya');
                        //         canvas.attachSprite(si, sti, game.data.sprites[si].states[sti].frames.length - 1);
                        //     } : () => {});
                    }
                };
                reader.readAsDataURL(file);
            })(index);
            index += 1;
        }
    });

    // setInterval(function() {
    //     console.log(canvas.sprite_index, canvas.state_index, canvas.frame_index);
    // }, 500);

    for (let div of $('.scroll_helper')) {
        $(div).on('mousedown.scrollhelper', function (e) {
            e.stopPropagation();
            $(div).data('mouse_x', e.clientX);
            $(div).data('mouse_y', e.clientY);
            $(div).data('scroll_x', $(div).scrollLeft());
            $(div).data('scroll_y', $(div).scrollTop());
            $('html').on('mousemove.scrollhelper', function (e) {
                if ($(div).hasClass('scroll_helper_horizontal'))
                    $(div).scrollLeft($(div).data('scroll_x') + $(div).data('mouse_x') - e.clientX);
                if ($(div).hasClass('scroll_helper_vertical'))
                    $(div).scrollTop($(div).data('scroll_y') + $(div).data('mouse_y') - e.clientY);
            });
            $('html').on('mouseup.scrollhelper', function (e) {
                $('html').off('mousemove.scrollhelper');
                $('html').off('mouseup.scrollhelper');
            });
        });
    }

    $('.scroll_helper_horizontal').on('wheel', function(e) {
        if (e.originalEvent.deltaX === 0) {
            let t = $(e.target).closest('.scroll_helper_horizontal');
            t[0].scrollLeft += e.originalEvent.deltaY;
        }
    });

    $('.modal-container').click(function (e) {
        close_modal();
    });
    $('.modal .bu-close').click(function (e) {
        close_modal();
    });

    $('.modal').click(function (e) {
        e.stopPropagation();
    });

    $(window).resize(function () {
        handleResize();
    });

    window.loginModal = new ModalDialog({
        title: 'Anmelden',
        width: '60vw',
        body: `
        <p>
        Du kannst dich anmelden, um sicherzustellen, dass du immer an der richtigen Version deines Spiels arbeitest.
        </p>
        <p>
        <label style='display: inline-block; width: 6em;'>E-Mail:</label>
        <input id='ti_login_email' type='text' style='font-size: 100%; display: inline-block; min-width: 20em; width: calc(100% - 8em);'/>
        </p>
        `,
        onshow: () => {
            $('#ti_login_email').focus();
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
        ]
    });

    window.loadGameModal = new ModalDialog({
        title: 'Spiel laden',
        width: '80vw',
        height: '90vh',
        body: `
        <div style='position: absolute; width: calc(100% - 30px); height: calc(100% - 30px);'>
            <div style='position: absolute; width: 100%; height: 100%;' class='scroll-helper'>
                <div id='load_games_list' style='position: relative; left: 0; opacity: 1; transition: left 0.5s ease, opacity 0.5s ease;'></div>
            </div>
            <div style='position: absolute; width: 100%; height: 100%;' class='scroll-helper'>
                <button id='bu_load_game_back' style='position: absolute; left: 100%; opacity: 0; transition: left 0.5s ease, opacity 0.5s ease; margin-bottom: 5px;'><i class='fa fa-angle-left'></i> Zurück</button>
                <span id='games_sublist_graph'></span>
                <div id='load_games_sublist' style='position: relative; left: 100%; opacity: 0; transition: left 0.5s ease, opacity 0.5s ease;'></div>
            </div>
        </div>
        `,
        onshow: () => {
            $('#games_sublist_graph').hide();
            $('#load_games_list').css('left', '0').css('opacity', 1);
            $('#load_games_sublist').css('left', '100%').css('opacity', 0);
            $('#bu_load_game_back').css('left', '100%').css('opacity', 0);
            $('#load_games_list').parent().css('pointer-events', 'auto');
            $('#load_games_sublist').parent().css('pointer-events', 'none');
            let body = $('#load_games_list');
            body.empty();
            let self = this;
            api_call('/api/get_games', {}, function (data) {
                if (data.success) {
                    console.log(data);
                    let div = $('<div>');
                    body.append(div);
                    new SortableTable({
                        element: div,
                        headers: ['', 'Code', 'Autor', 'Titel', 'Datum', 'Größe', 'Sprites', 'Zustände', 'Frames', 'Versionen'].map(function (x) {
                            let th = $('<th>').text(x);
                            if (['Größe', 'Sprites', 'Zustände', 'Frames'].indexOf(x) >= 0) {
                                th.addClass('right');
                                th.data('type', 'int');
                            }
                            if (['Versionen'].indexOf(x) >= 0) {
                                th.data('type', 'int');
                            }
                            return th;
                        }),
                        rows: data.nodes.map(function (node) {
                            let bu_versions = $('');
                            if (node.ancestor_count > 0) {
                                bu_versions = $('<button>').css('font-size', '90%').css('width', '9.2em').append($(`<div>${node.ancestor_count} Versionen <i class='fa fa-angle-right'></i></div>`));
                                bu_versions.click(function(e) {
                                    api_call('/api/graph', {tag: node.tag}, function(data) {
                                        if (data.success) {
                                            $('#games_sublist_graph').empty().append($(data.svg)).show();
                                            $('#games_sublist_graph svg g.node').on('click', function(e) {
                                                let id = $(e.target).closest('g.node').attr('id').substr(1);;
                                                console.log(`click ${id}`);
                                            })
                                        }
                                    });
                                    e.stopPropagation();
                                    $('#load_games_list').css('left', '-100%').css('opacity', 0);
                                    $('#load_games_sublist').css('left', '0').css('opacity', 1);
                                    $('#bu_load_game_back').css('left', '0').css('opacity', 1);
                                    $('#load_games_list').parent().css('pointer-events', 'none');
                                    $('#load_games_sublist').parent().css('pointer-events', 'auto');
                                    $('#load_games_sublist').empty();
                                    api_call('/api/get_versions_for_game', {tag: node.tag}, function(data) {
                                        if (data.success) {
                                            new SortableTable({
                                                element: $('#load_games_sublist'),
                                                headers: ['', 'Code', 'Autor', 'Titel', 'Datum', 'Größe', 'Sprites', 'Zustände', 'Frames'].map(function (x) {
                                                    let th = $('<th>').text(x);
                                                    if (['Größe', 'Sprites', 'Zustände', 'Frames'].indexOf(x) >= 0) {
                                                        th.addClass('right');
                                                        th.data('type', 'int');
                                                    }
                                                    return th;
                                                }),
                                                rows: data.nodes.map(function (node) {
                                                    return [
                                                        node.tag,
                                                        $('<td>').append($('<img>').attr('src', `noto/${node.icon}.png`).css('height', '24px')),
                                                        $('<td>').addClass('mono').text(node.tag),
                                                        $('<td>').text(node.author || '–'),
                                                        $('<td>').text(node.title || '–'),
                                                        $('<td>').text(moment.unix(node.ts_created).format('L LT')),
                                                        $('<td>').addClass('right').text(bytes_to_str(node.size)).data('sort_value', node.size),
                                                        $('<td>').addClass('right').text(`${node.sprite_count}`).data('sort_value', node.sprite_count),
                                                        $('<td>').addClass('right').text(`${node.state_count}`).data('sort_value', node.state_count),
                                                        $('<td>').addClass('right').text(`${node.frame_count}`).data('sort_value', node.frame_count),
                                                    ];
                                                }),
                                                // filter_callback: user_filter,
                                                clickable_rows: true,
                                                clickable_row_callback: (tag) => {
                                                    game.load(tag);
                                                    window.loadGameModal.dismiss();
                                                }
                                            });
                                        }
                                    });
                                });
                            }
                            return [
                                node.tag,
                                $('<td>').append($('<img>').attr('src', `noto/${node.icon}.png`).css('height', '24px')),
                                $('<td>').addClass('mono').text(node.tag),
                                $('<td>').text(node.author || '–'),
                                $('<td>').text(node.title || '–'),
                                $('<td>').text(moment.unix(node.ts_created).format('L LT')),
                                $('<td>').addClass('right').text(bytes_to_str(node.size)).data('sort_value', node.size),
                                $('<td>').addClass('right').text(`${node.sprite_count}`).data('sort_value', node.sprite_count),
                                $('<td>').addClass('right').text(`${node.state_count}`).data('sort_value', node.state_count),
                                $('<td>').addClass('right').text(`${node.frame_count}`).data('sort_value', node.frame_count),
                                $('<td>').append(bu_versions).data('sort_value', node.ancestor_count + 1),
                            ];
                        }),
                        // filter_callback: user_filter,
                        clickable_rows: true,
                        clickable_row_callback: (tag) => {
                            game.load(tag);
                            window.loadGameModal.dismiss();
                        }
                    });
                }
            });
        },
        footer: [
            {
                type: 'input',
                label: 'Suchen',
                icon: 'fa-search',
                callback: (self, text) => {
                    console.log(text);
                },
            },
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
        ]
    });

    $('#bu_load_game_back').click(function(e) {
        $('#load_games_list').css('left', '0').css('opacity', 1);
        $('#load_games_sublist').css('left', '100%').css('opacity', 0);
        $('#bu_load_game_back').css('left', '100%').css('opacity', 0);
        $('#load_games_list').parent().css('pointer-events', 'auto');
        $('#load_games_sublist').parent().css('pointer-events', 'none');
        $('#load_games_sublist').empty();
        $('#games_sublist_graph').hide().attr('src', '');
    });

    $('#btn_playtesting_refresh').click(function(e) {
        e.preventDefault();
        e.stopPropagation();
        refresh_playtesting_code();
    });

    window.resizeCanvasModal = new ModalDialog({
        title: 'Größe ändern',
        width: '40vw',
        body: `
        <p>Bitte gib die gewünschte Größe für das aktuelle Sprite an:</p>
        <div style="text-align: center; font-size: 120%;">
            <input id='ti_sprite_width' type='text' style='width: 3em; font-size: 100%; text-align: center;'/>
            &times;
            <input id='ti_sprite_height' type='text' style='width: 3em; font-size: 100%; text-align: center;'/>
        </div>
        `,
        onshow: () => {
            $('#ti_sprite_width').val(canvas.bitmap.width);
            $('#ti_sprite_height').val(canvas.bitmap.height);
            $('#ti_sprite_width').focus();
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Größe ändern',
                icon: 'fa-check',
                color: 'green',
                callback: async (self) => {
                    let new_width = parseInt($('#ti_sprite_width').val());
                    let new_height = parseInt($('#ti_sprite_height').val());
                    if (new_width > 0 && new_width <= MAX_DIMENSION && new_height > 0 && new_height <= MAX_DIMENSION) {
                        let old_sprite_index = canvas.sprite_index;
                        let old_state_index = canvas.state_index;
                        let old_frame_index = canvas.frame_index;
                        let old_width = game.data.sprites[old_sprite_index].width;
                        let old_height = game.data.sprites[old_sprite_index].height;
                        game.data.sprites[old_sprite_index].width = new_width;
                        game.data.sprites[old_sprite_index].height = new_height;
                        for (let state_index = 0; state_index < game.data.sprites[old_sprite_index].states.length; state_index++) {
                            for (let frame_index = 0; frame_index < game.data.sprites[old_sprite_index].states[state_index].frames.length; frame_index++) {
                                console.log(`Resizing sprite ${old_sprite_index} / state ${state_index} / frame ${frame_index} to ${new_width}x${new_height}`);
                                let image = await load_img_from_src(game.data.sprites[old_sprite_index].states[state_index].frames[frame_index].src);
                                let c = document.createElement('canvas');
                                c.width = new_width;
                                c.height = new_height;
                                let ctx = c.getContext('2d');
                                ctx.clearRect(0, 0, new_width, new_height);
                                ctx.translate(Math.floor((new_width - old_width) / 2), new_height - old_height);
                                ctx.drawImage(image, 0, 0);
                                game.data.sprites[old_sprite_index].states[state_index].frames[frame_index].src = c.toDataURL('image/png');
                            }
                        }
                        game.refresh_frames_on_screen();
                        canvas.detachSprite();
                        canvas.attachSprite(old_sprite_index, old_state_index, old_frame_index, function() {
                            game.update_geometry_for_sprite(old_sprite_index);
                            self.dismiss();
                        });
                    } else {
                        self.showError("Fehler: Ungültige Größe.")
                    }
                }
            },
        ]
    });

    window.colorCorrectionModal = new ModalDialog({
        title: 'Farbkorrektur',
        width: '40vw',
        body: `
        `,
        onshow: () => {
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Übernehmen',
                icon: 'fa-check',
                color: 'green',
                callback: async (self) => {
                }
            },
        ]
    });

    window.choosePaletteModal = new ModalDialog({
        title: 'Palette wählen',
        vars: {
            palette_index: -1,
            div_for_palette_index: {},
        },
        width: '80vw',
        body: `
        <div id='palettes_here' class="grid"></div>
        `,
        onbody: (self) => {
            for (let i = 0; i < palettes.length; i++) {
                let palette = palettes[i];
                let div = $(`<div class='palette-swatches grid-item'>`);
                let div2 = $(`<div>`)
                div.append(div2)
                div2.append($(`<h3>`).text(palette.name));
                let colors = $(`<div>`).css('margin-top', '5px');
                for (let color of palette.colors) {
                    let swatch = $(`<div class='swatch'>`);
                    swatch.css('background-color', color);
                    colors.append(swatch);
                }
                div2.append(colors);
                div2.click(function (e) {
                    $('#palettes_here .palette-swatches > div').removeClass('active');
                    $(e.target).closest('.palette-swatches > div').addClass('active');
                    self.palette_index = i;
                });
                self.div_for_palette_index[i] = div2;
                $('#palettes_here').append(div);
            }
            window.modal_choose_palette_grid = $('#palettes_here').masonry({
                itemSelector: '.grid-item',
                transitionDuration: 0,
                // columnWidth: 200,
                gutter: 10,
            });
        },
        onshow: (self) => {
            self.palette_index = window.selected_palette_index;
            $('#palettes_here .palette-swatches > div').removeClass('active');
            self.div_for_palette_index[self.palette_index].addClass('active');
            window.modal_choose_palette_grid.masonry();
            window.dispatchEvent(new Event('resize'));
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Palette wählen',
                icon: 'fa-check',
                color: 'green',
                callback: async (self) => {
                    window.selected_palette_index = self.palette_index;
                    update_color_palette();
                    self.dismiss();
                }
            },
        ]
    });

    window.importSpriteModal = new ModalDialog({
        title: 'Sprite importieren',
        // vars: {
        //     palette_index: -1,
        //     div_for_palette_index: {},
        // },
        width: '90vw',
        body: `
        <div id='gifs_here' class="grid"></div>
        `,
        onbody: (self) => {
            // for (let i = 0; i < palettes.length; i++) {
            //     let palette = palettes[i];
            //     let div = $(`<div class='palette-swatches grid-item'>`);
            //     let div2 = $(`<div>`)
            //     div.append(div2)
            //     div2.append($(`<h3>`).text(palette.name));
            //     let colors = $(`<div>`).css('margin-top', '5px');
            //     for (let color of palette.colors) {
            //         let swatch = $(`<div class='swatch'>`);
            //         swatch.css('background-color', color);
            //         colors.append(swatch);
            //     }
            //     div2.append(colors);
            //     div2.click(function (e) {
            //         $('#palettes_here .palette-swatches > div').removeClass('active');
            //         $(e.target).closest('.palette-swatches > div').addClass('active');
            //         self.palette_index = i;
            //     });
            //     self.div_for_palette_index[i] = div2;
            //     $('#palettes_here').append(div);
            // }
            $('#gifs_here').empty();
            api_call('/api/get_all_gifs', {}, function(data) {
                if (data.success) {
                    for (let tag of data.tags) {
                        $('#gifs_here').append($(`<img style='height: 100px; image-rendering: pixelated;'>`).attr('src', `/gen/catalogue/${tag}.gif`));
                    }
                }
            });
        },
        onshow: (self) => {
            // self.palette_index = window.selected_palette_index;
            // $('#palettes_here .palette-swatches > div').removeClass('active');
            // self.div_for_palette_index[self.palette_index].addClass('active');
            // window.modal_choose_palette_grid.masonry();
            window.dispatchEvent(new Event('resize'));
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
            // {
            //     type: 'button',
            //     label: 'Sprite importieren',
            //     icon: 'fa-check',
            //     color: 'green',
            //     callback: async (self) => {
            //         // window.selected_palette_index = self.palette_index;
            //         // update_color_palette();
            //         self.dismiss();
            //     }
            // },
        ]
    });

    window.debugModal = new ModalDialog({
        title: 'Debug',
        width: '80vw',
        body: `<div id='debug_here' style='white-space: pre; font-family: monospace; font-size: 90%;'></div>`,
        onbody: (self) => {
        },
        onshow: (self) => {
            $('#debug_here').text(JSON.stringify(game.data, null, 4));
        },
        footer: [
            {
                type: 'button',
                label: 'Schließen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
        ]
    });

    if (this.location.host.indexOf('localhost') === 0) {
        // window.test_list = [];
        // new DragAndDropWidget({
        //     game: self.game,
        //     container: $('#menu_test'),
        //     trash: $('#trash'),
        //     items: window.test_list,
        //     item_class: 'menu_state_item',
        //     step_aside_css: { top: '35px' },
        //     gen_item: (state, index) => {
        //         window.test_list[window.test_list.length - 1] = index + 1;
        //         let state_div = $(`<div>`).text(`Item ${index + 1}`);
        //         return state_div;
        //     },
        //     onclick: (e, index) => {
        //         // $(e).closest('.menu_state_item').parent().parent().find('.menu_state_item').removeClass('active');
        //         // $(e).parent().addClass('active');
        //     },
        //     gen_new_item: () => {
        //         let x = -1;
        //         window.test_list.push(x);
        //         return x;
        //     },
        //     delete_item: (index) => {
        //         window.test_list.splice(index, 1);
        //     },
        //     on_move_item: (from, to) => {
        //         console.log(`moving item from ${from} to ${to}!`);
        //         move_item_helper(window.test_list, from, to);
        //         console.log(window.test_list);
        //     }
        // });
        // setTimeout(function() {
        //     for (let i = 0; i < 8; i++)
        //         $('#menu_test ._dnd_item .add').click();
        //     for (let i = 0; i < 4; i++)
        //         $('#menu_states ._dnd_item .add').click();
        // }, 500);

        // setTimeout(function() {
        //     show_modal('modal_resize_canvas');
        // show_modal('modal_choose_palette');
        // }, 250);
        // game.load("mkristz");
        // setTimeout(function() {
        //     $('#mi_level').click();
        // }, 250);
    }
    $('html').css('background-color', '');
    $('#curtain').fadeOut();
});

// moves item from one place to another
// returns an array of index translations
function move_item_helper(list, from, to) {
    let tr = [];
    for (let i = 0; i < list.length; i++) tr[i] = i;
    if (from === to) return tr;
    let temp = list[from];
    if (from < to) {
        for (let i = from; i < to; i++) {
            list[i] = list[i + 1];
            tr[i + 1] = i;
        }
    } else {
        for (let i = from; i > to; i--) {
            list[i] = list[i - 1];
            tr[i - 1] = i;
        }
    }
    list[to] = temp;
    tr[from] = to;
    return tr;
}

// deletes item in array
// returns an array of index translations
function delete_item_helper(list, index) {
    let tr = [];
    for (let i = 0; i < list.length; i++)
        tr[i] = (i <= index) ? i : i - 1;
    list.splice(index, 1);
    return tr;
}

window.onerror = function(event, source, lineno, colno, error) {
    let data = {
        event: event,
        source: source,
        lineno: lineno,
        colno: colno,
        error: error
    };
    console.log(JSON.stringify(data));
    $('#error_curtain').fadeIn();
    $('#error_curtain .robot').css('transform', 'scale(1)');
    $('#error_curtain p').css('transform', 'translate(0, 0)').css('opacity', 1);
};

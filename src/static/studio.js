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
    $('.full_right_menu_container').css('left', `${window.innerWidth - 236}px`);
    $('.full_left_menu_container').css('left', `20px`);
    // $('#right_menu_container .menu_frames').css('height', `${$('#canvas').height() * 0.2 - 25}px`);

    $('#main_div_level .left_menu_container').css('left', '10px');
    $('#main_div_level .left_menu_container').css('width', '174px');
    $('#level').css('left', '240px');
    $('#level').css('top', '50px');
    $('#level').css('width', `${window.innerWidth - 496}px`);
    $('#level').css('height', `${window.innerHeight - 100}px`);
    if (game != null && game.level_editor != null) game.level_editor.handleResize();
}

function setPenWidth(menu_item) {
    canvas.pen_width = menu_item.data;
    canvas.update_overlay_brush();
}

function setCurrentColor(color) {
    if (color.length === 7)
        color += 'ff';
    canvas.current_color = parseInt(color.replace('#', ''), 16);
    // $('#current_color_menu input').val(`#${canvas.current_color.toString(16)}`);
    let t = tinycolor(color);
    $('#current_color_menu').css('background', `linear-gradient(${t.toRgbString()},${t.toRgbString()}), url(transparent.png), #777`);
    $('#color_variations_menu').empty();
    let a = tinycolor(color).analogous(10);
    for (var h = 0; h < 9; h++) {
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
    for (var h = -4; h <= 4; h++) {
        var variation = tinycolor(color);
        // -40 -30 -20 -10 0 10 20 30 40
        if (h < 0)
            variation.darken(Math.pow(Math.abs(h / 4.0), 1.0) * 40);
        else
            variation.brighten(Math.pow(Math.abs(h / 4.0), 1.0) * 40);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = -4; h <= 4; h++) {
        var variation = tinycolor(color);
        // -40 -30 -20 -10 0 10 20 30 40
        if (h < 0)
            variation.darken(Math.pow(Math.abs(h / 4.0), 2.0) * 20);
        else
            variation.brighten(Math.pow(Math.abs(h / 4.0), 2.0) * 20);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = -4; h <= 4; h++) {
        var variation = tinycolor(color);
        if (h < 0)
            variation.desaturate(-h * 20);
        else
            variation.saturate(h * 20);
        var swatch = $("<span class='button button-9'>");
        var b = "linear-gradient(" + variation.toRgbString() + "," + variation.toRgbString() + "), url(transparent.png), #777";
        swatch.css('background', b);
        swatch.data('html_color', variation.toRgbString());
        var rgb = variation.toRgb();
        swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
        $('#color_variations_menu').append(swatch);
    }
    $('#color_variations_menu').append('<br />');
    for (var h = 1; h <= 9; h++) {
        var variation = tinycolor(color);
        variation.setAlpha(h / 9);
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
    if (item.key.substr(0, 5) === 'tool/') {
        if (item.key !== 'tool/picker')
            window.revert_to_tool = item.key;
        canvas.setShowPen(['tool/pen', 'tool/line', 'tool/rect', 'tool/ellipse',
            'tool/spray', 'tool/fill', 'tool/gradient', 'tool/fill-rect',
            'tool/fill-ellipse', 'tool/picker'].indexOf(item.key) >= 0);
        canvas.setModifierCtrl(false);
        canvas.setModifierShift(false);
        if (['tool/picker', 'tool/spray', 'tool/fill', 'tool/gradient'].indexOf(item.key) >= 0)
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
    $('.modal').hide();
    let complete = null;
    if (window[id + '_complete']) {
        complete = window[id + '_complete'];
    }
    $(`#${id}`).show({ duration: 0, complete: complete });
    $(`#${id}`).closest('.modal-container').show();
}

function close_modal() {
    $('.modal').hide();
    $('.modal-container').hide();
    // $('.modal-container').fadeOut({complete: () => {
    //     $('.modal').hide();
    // }});
}

function load_game() {
    api_call('/api/get_games', {}, function (data) {
        if (data.success) {
            console.log(data);
            let body = $('#modal_load_game .modal-body');
            body.empty();
            let div = $('<div>');
            body.append(div);
            new SortableTable({
                element: div,
                headers: ['', 'Code', 'Autor', 'Titel', 'Datum', 'Größe', 'Sprites', 'Zustände', 'Frames'].map(function (x) {
                    let th = $('<th>').text(x);
                    // if (['Klasse', 'Ausgeliehen'].indexOf(x) >= 0) th.data('type', 'int');
                    return th;
                }),
                rows: data.nodes.map(function (node) {
                    return [
                        node.tag,
                        $('<td>').append($('<img>').attr('src', `noto/${node.icon}.png`).css('height', '24px')),
                        $('<td>').text(node.tag),
                        $('<td>').text(node.author || '–'),
                        $('<td>').text(node.title || '–'),
                        $('<td>').text(moment.unix(node.ts_created).format('L LTS')),
                        $('<td>').text(bytes_to_str(node.size)),
                        $('<td>').text(`${node.sprite_count}`),
                        $('<td>').text(`${node.state_count}`),
                        $('<td>').text(`${node.frame_count}`),
                    ];
                }),
                // filter_callback: user_filter,
                clickable_rows: true,
                clickable_row_callback: (tag) => {
                    game.load(tag);
                    close_modal();
                }
            });
            // let table = $(`<table>`);
            // let body = $('#modal_load_game .modal-body');
            // body.empty();
            // body.append(table);
            // for (let node of data.nodes) {
            //     console.log(node);
            //     let row = $('<tr>');
            //     // for (let i = 0; i < data.max_width; i++) {
            //     //     let td = $('<td>')
            //     //     if (i == node.offset)
            //     //         td.html(`<i class='fa fa-circle'></i>`);
            //     //     td.appendTo(row);
            //     // }
            //     $('<td>').append($('<img>').attr('src', `noto/${node.icon}.png`).css('height', '32px')).appendTo(row);
            //     $(`<td class='mono'>`).text(node.tag).appendTo(row);
            //     table.append(row);

            // }
            show_modal('modal_load_game');
        }
    })
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

document.addEventListener("DOMContentLoaded", function (event) {
    moment.locale('de');
    tool_menu_items.sprites = [
        { group: 'tool', command: 'pen', image: 'draw-freehand', shortcut: 'Q', label: 'Zeichnen' },
        { group: 'tool', command: 'line', image: 'draw-line', shortcut: 'W', label: 'Linie zeichnen' },
        {
            group: 'tool', command: 'rect', image: 'draw-rectangle', shortcut: 'E', label: 'Rechteck zeichnen', hints: [
                { key: 'Control', label: 'Seitenverhältnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'ellipse', image: 'draw-ellipse', shortcut: 'R', label: 'Ellipse zeichnen', hints: [
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
        { group: 'tool', command: 'fill', image: 'color-fill', shortcut: 'A', label: 'Fläche füllen' },
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
        { group: 'tool', command: 'picker', image: 'color-picker', shortcut: 'Z', label: 'Farbe auswählen' },
        { group: 'tool', command: 'move', image: 'transform-move', shortcut: 'X', label: 'Sprite verschieben' },
        // { command: 'rotate-left', image: 'transform-rotate-left' },
        { command: 'rotate-right', image: 'transform-rotate-right', shortcut: 'C', callback: () => canvas.rotate() },
        { command: 'flip-h', image: 'transform-flip-h', shortcut: 'V', callback: () => canvas.flipHorizontal() },
        { command: 'flip-v', image: 'transform-flip-v', shortcut: 'B', callback: () => canvas.flipVertical() },
        { type: 'divider' },
        { group: 'penWidth', command: '1', image: 'pen-width-1', shortcut: '1', data: 1, callback: setPenWidth },
        { group: 'penWidth', command: '2', image: 'pen-width-2', shortcut: '2', data: 2, callback: setPenWidth },
        { group: 'penWidth', command: '3', image: 'pen-width-3', shortcut: '3', data: 3, callback: setPenWidth },
        { group: 'penWidth', command: '4', image: 'pen-width-4', shortcut: '4', data: 4, callback: setPenWidth },
        { group: 'penWidth', command: '5', image: 'pen-width-5', shortcut: '5', data: 5, callback: setPenWidth },
    ];
    tool_menu_items.sprites = tool_menu_items.sprites.map(function (x) {
        if (!x.callback)
            x.callback = activateTool;
        return x;
    });

    tool_menu_items.level = [
        { group: 'tool', command: 'pan', image: 'move-hand', shortcut: 'Q', label: 'Verschieben' },
        { group: 'tool', command: 'pen', image: 'draw-freehand', shortcut: 'W', label: 'Zeichnen', hints: [
            { key: 'Shift', label: 'Gitter ignorieren', type: 'checkbox', callback: function (x) { game.level_editor.setModifierShift(x); } },
        ] },
        { group: 'tool', command: 'select', image: 'select-rect', shortcut: 'E', label: 'Auswählen', hints: [
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
            $('.menu_backdrop_item').removeClass('active');
            if (game !== null && game.level_editor !== null) {
                game.level_editor.backdrop_index = null;
                $('#menu_backdrop_properties_container').slideUp();
                game.level_editor.refresh();
                game.level_editor.render();
            }
        }
    });
    // initialize sprites menu last
    menus.sprites = new Menu($('#tool_menu'), 'sprites', tool_menu_items.sprites, canvas);
    canvas.menu = menus.sprites;

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
        menus[key].refresh_status_bar();
        if (current_pane === 'level')
            game.level_editor.refresh_sprite_widget();
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

    // game.load('s76l9s7');
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
                                console.log(si, sti, fi);
                                if (this.game.data.sprites[si].states.length === 1 &&
                                    this.game.data.sprites[si].states[0].frames.length === 1)
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

    window.resizeCanvasModal = new ModalDialog({
        title: 'Größe ändern',
        width: '40vw',
        body: `
        <p>Bitte gib die gewünschte Größe für das aktuelle Sprite an:</p>
        <div style="text-align: center; font-size: 120%;">
            <input id='ti_sprite_width' type='text' style='width: 3em; font-size: 100%;'/>
            &times;
            <input id='ti_sprite_height' type='text' style='width: 3em; font-size: 100%;'/>
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

function parse_html_color(color) {
    return parseInt(color.substr(1, 6), 16);
}

function parse_html_color_to_vec4(color) {
    if (color.length === 7) {
        let c = parseInt(color.substr(1, 6), 16);
        let r = (c >> 16) & 0xff;
        let g = (c >> 8) & 0xff;
        let b = (c >> 0) & 0xff;
        return [r / 255.0, g / 255.0, b / 255.0, 1.0];
    } else if (color.length === 9) {
        let c = parseInt(color.substr(1, 8), 16);
        let r = (c >> 24) & 0xff;
        let g = (c >> 16) & 0xff;
        let b = (c >> 8) & 0xff;
        let a = (c >> 0) & 0xff;
        return [r / 255.0, g / 255.0, b / 255.0, a / 255.0];
    }
}


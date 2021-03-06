var menu = null;
var canvas = null;
var game = null;

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
    // $('#right_menu_container .menu_frames').css('height', `${$('#canvas').height() * 0.2 - 25}px`);
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
        if (h < 0)
            variation.darken(-h * 10);
        else
            variation.brighten(h * 10);
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
        if (['tool/picker', 'tool/spray', 'tool/fill'].indexOf(item.key) >= 0)
            menu.handle_click('penWidth/1');
    }
}

function update_color_palette() {
    let i = parseInt($('#palettes_here').val());
    color_menu_items = [];
    colors = palettes[i].colors;
    for (let i = 0; i < colors.length + 1; i++) {
        let color = '';
        let k = i;
        let menu_item = null;
        if (k < colors.length) {
            let item = colors[k];
            color = item;
            menu_item = { group: 'color', data: color, command: color, color: color, size: 5 };
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
    color_menu = new Menu($('#color_menu'), color_menu_items);
}

function show_modal(id) {
    $('.modal').hide();
    $(`#${id}`).show();
    $('.modal-container').show();
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
                headers: ['', 'Code', 'Autor', 'Titel', 'Datum', 'Gr????e', 'Sprites', 'Zust??nde', 'Frames'].map(function (x) {
                    let th = $('<th>').text(x);
                    // if (['Klasse', 'Ausgeliehen'].indexOf(x) >= 0) th.data('type', 'int');
                    return th;
                }),
                rows: data.nodes.map(function (node) {
                    return [
                        node.tag,
                        $('<td>').append($('<img>').attr('src', `noto/${node.icon}.png`).css('height', '24px')),
                        $('<td>').text(node.tag),
                        $('<td>').text(node.author || '???'),
                        $('<td>').text(node.title || '???'),
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
 ??????e7a7qmp
 ??????5nqrh5b
 ??????2x3hp8q
   ????????????4n2zuhp
   ??? ??????l1bhsvc
   ??? ??????hrrmfjk
   ????????????kppujs0
     ??????2fbet5p

     ??????2fbet5p
   ????????????kppujs0
   ???
   ??? ??????hrrmfjk
   ??? ??????l1bhsvc
   ????????????4n2zuhp
   ???
 ??????2x3hp8q
 ??????5nqrh5b
 ??????e7a7qmp

      ??????2fbet5p
   ??????kppujs0
   ??? ??????hrrmfjk
   ??? ??????l1bhsvc
   ??????4n2zuhp
 ??????2x3hp8q
 ??????5nqrh5b
 ??????e7a7qmp

 e7a7qmp?????????5nqrh5b?????????2x3hp8q?????????4n2zuhp?????????l1bhsvc?????????hrrmfjk
                             ??????kppujs0?????????2fbet5p

 ??????e7a7qmp
 ??????5nqrh5b
 ??????2x3hp8q
   ????????????4n2zuhp
   ??????????????????kppujs0
     ??????l1bhsvc
     ????????????2fbet5p
 */

document.addEventListener("DOMContentLoaded", function (event) {
    moment.locale('de');
    let tool_menu_items = [
        { group: 'tool', command: 'pen', image: 'draw-freehand', shortcut: 'Q', label: 'Zeichnen' },
        { group: 'tool', command: 'line', image: 'draw-line', shortcut: 'W', label: 'Linie zeichnen' },
        {
            group: 'tool', command: 'rect', image: 'draw-rectangle', shortcut: 'E', label: 'Rechteck zeichnen', hints: [
                { key: 'Control', label: 'Seitenverh??ltnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'ellipse', image: 'draw-ellipse', shortcut: 'R', label: 'Ellipse zeichnen', hints: [
                { key: 'Control', label: 'Seitenverh??ltnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'spray', image: 'spray-can', shortcut: 'T', label: 'Spr??hdose', hints: [
                { key: 'Control', label: 'Helligkeit variieren', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'nur auf selber Farbe', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        { group: 'tool', command: 'fill', image: 'color-fill', shortcut: 'A', label: 'Fl??che f??llen' },
        {
            group: 'tool', command: 'gradient', image: 'color-gradient', shortcut: 'S', label: 'Farbverlauf', hints: [
                { key: 'Control', label: 'kreisf??rmig', type: 'checkbox' },
                { key: 'Shift', label: 'Dithering verwenden', type: 'checkbox' },
            ]
        },
        {
            group: 'tool', command: 'fill-rect', image: 'fill-rectangle', shortcut: 'D', label: 'Rechteck f??llen', hints: [
                { key: 'Control', label: 'Seitenverh??ltnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'fill-ellipse', image: 'fill-ellipse', shortcut: 'F', label: 'Ellipse f??llen', hints: [
                { key: 'Control', label: 'Seitenverh??ltnis 1:1', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Shift', label: 'Zentrieren', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'pan', image: 'system-search', shortcut: 'G', label: 'Sichtbaren Ausschnitt ??ndern', hints: [
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
        { group: 'tool', command: 'picker', image: 'color-picker', shortcut: 'Z', label: 'Farbe ausw??hlen' },
        { group: 'tool', command: 'move', image: 'transform-move', shortcut: 'X', label: 'Sprite verschieben' },
        // { command: 'rotate-left', image: 'transform-rotate-left' },
        { command: 'rotate-right', image: 'transform-rotate-right', shortcut: 'C' },
        { command: 'flip-h', image: 'transform-flip-h', shortcut: 'V' },
        { command: 'flip-v', image: 'transform-flip-v', shortcut: 'B' },
        { type: 'divider' },
        { group: 'penWidth', command: '1', image: 'pen-width-1', shortcut: '1', data: 1, callback: setPenWidth },
        { group: 'penWidth', command: '2', image: 'pen-width-2', shortcut: '2', data: 2, callback: setPenWidth },
        { group: 'penWidth', command: '3', image: 'pen-width-3', shortcut: '3', data: 3, callback: setPenWidth },
        { group: 'penWidth', command: '4', image: 'pen-width-4', shortcut: '4', data: 4, callback: setPenWidth },
        { group: 'penWidth', command: '5', image: 'pen-width-5', shortcut: '5', data: 5, callback: setPenWidth },
    ];
    tool_menu_items = tool_menu_items.map(function (x) {
        if (!x.callback)
            x.callback = activateTool;
        return x;
    });
    let color_menu_items = [];
    for (let i = 0; i < palettes.length; i++) {
        let palette = palettes[i];
        $('#palettes_here').append($('<option>').text(palette.name).val(`${i}`));
    }
    $('#palettes_here').change(function (e) {
        update_color_palette();
    });
    $('#palettes_here').val('9');

    canvas = new Canvas($('#canvas'), menu);
    handleResize();

    update_color_palette();
    menu = new Menu($('#tool_menu'), tool_menu_items, canvas);
    canvas.menu = menu;

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
    })

    $('#bu_save_game').click(function (e) {
        game.save();
    });

    game = new Game();
    // game.load('s76l9s7');
    // game.load('skkmhwy');

    let tag = window.location.search.replace('?', '');
    if (tag.length === 7) {
        game.load(tag);
    }

    // document.onpaste = function(pasteEvent) {
    //     var item = pasteEvent.clipboardData.items[0];
    //     if (item.type && item.type.indexOf("image") === 0) {
    //         var blob = item.getAsFile();
    //         var reader = new FileReader();
    //         reader.onload = (event) => {
    //             let image = new Image();
    //             image.src = event.target.result;
    //             image.decode().then(() => {
    //                 let si = canvas.sprite_index;
    //                 let sti = canvas.state_index;
    //                 let fi = canvas.frame_index;
    //                 // let sw = 48;
    //                 // let sh = 48;
    //                 // let sw = 32;
    //                 // let sh = 32;
    //                 let sw = image.width;
    //                 let sh = image.height;
    //                 let c = document.createElement('canvas');
    //                 c.width = sw;
    //                 c.height = sh;
    //                 let ctx = c.getContext('2d');
    //                 let i = 0;
    //                 for (let y = 0; y < Math.floor(image.height / sh); y++) {
    //                     for (let x = 0; x < Math.floor(image.width / sw); x++) {
    //                         // if (i >= 40 && i < 50) {
    //                             ctx.clearRect(0, 0, sw, sh);
    //                             ctx.drawImage(image, x * sw, y * sh, sw, sh, 0, 0, sw, sh);
    //                             let src = c.toDataURL('image/png');
    //                             if (i === 0) {
    //                                 game.data.sprites[si].states[sti].frames[fi] = {src: src, width: sw, height: sh};
    //                             } else {
    //                                 game.data.sprites[canvas.sprite_index].states[canvas.state_index].frames.push({src: src, width: sw, height: sh});
    //                             }
    //                         // }
    //                         i += 1;
    //                     }
    //                 }
    //                 canvas.detachSprite();
    //                 canvas.attachSprite(si, sti, fi);
    //             });
    //         };
    //         reader.readAsDataURL(blob);
    //     }
    // };

    $(document).on('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });
    $(document).on('drop', function (e) {
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
            (function(index) {
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

    $(window).resize(function () {
        handleResize();
    });

    // load_game();
});

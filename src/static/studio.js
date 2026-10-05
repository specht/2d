var menus = {};
var canvas = null;
var game = null;
var current_pane = 'sprites';
const PANE_HASH = { sprites: 'sprites', level: 'level', settings: 'einstellungen', play: 'spielen', help: 'hilfe', playtesting: 'playtesting' };

function parse_studio_hash() {
    const [pane_hash, recipe] = decodeURIComponent(window.location.hash.replace(/^#/, '')).split('/');
    const pane = Object.keys(PANE_HASH).find(key => PANE_HASH[key] === pane_hash) ?? 'sprites';
    return pane === 'help' && recipe ? { pane, recipe } : { pane };
}

function studio_url(state) {
    let hash = PANE_HASH[state.pane] ?? 'sprites';
    if (state.pane === 'help' && state.recipe) hash += '/' + encodeURIComponent(state.recipe);
    return window.location.pathname + window.location.search + '#' + hash;
}

function studio_history_push(state) {
    history.pushState(state, '', studio_url(state));
}
var selected_palette_index = 9;
var current_palette_rgb = [];
var tool_menu_items = {};

function bytes_to_str(i) {
    if (i < 1024)
        return `${i} B`;
    if (i < 1024 * 1024)
        return `${(i / 1024).toFixed(1)} kB`;
    if (i < 1024 * 1024 * 1024)
        return `${(i / 1024 / 1024).toFixed(1)} MB`;
    if (i < 1024 * 1024 * 1024 * 1024)
        return `${(i / 1024 / 1024 / 1024).toFixed(1)} GB`;
    return `${(i / 1024 / 1024 / 1024 / 1024).toFixed(1)} TB`;
}

// The sprite pane's columns (pure), from the general to the particular:
// every sprite of the game | tools and colours | drawing area | "this sprite"
// (Titel, Eigenschaften) | its Zustände. So the sprites are on the left in
// both editors (the level editor's palette), the tools beside the drawing
// area, and what is being edited on its right. The tools column has one
// width everywhere: six tools, eight colours and eleven variations in a row,
// edge to edge. The drawing area stays square and as big as the height
// allows; the Zustände get a column of their own when that costs it little
// (1920 × 1080), otherwise they come below the Eigenschaften.
const SPRITE_LEFT_COLUMN = 240;

// The sprite list shows whole tiles (68 px each, plus its padding and room
// for a scrollbar); what is left over goes to the sprite and state columns.
const SPRITE_TILE_STEP = 68;
const SPRITE_LIBRARY_PADDING = 24;

function sprite_pane_layout(width, height) {
    const wide = width >= 1600;
    const gap = wide ? 20 : 14;
    const left_w = SPRITE_LEFT_COLUMN;
    const column_w = wide ? 250 : 236;
    // at least three tiles of the sprite list; on a tablet two (the drawing area needs the room)
    const library_min = SPRITE_LIBRARY_PADDING + (width < 1400 ? 2 : 3) * SPRITE_TILE_STEP;
    // everything but the drawing area and the list: tools, gaps, the columns
    const others = (columns) => gap + gap + left_w + gap + gap + columns * (column_w + gap);
    const fit = (columns) => Math.max(100, Math.min(height - 218, width - others(columns) - library_min));
    const states_column = fit(2) >= fit(1) * 0.93;
    const size = states_column ? fit(2) : fit(1);
    const columns = states_column ? 2 : 1;
    // the room for the list: whole tiles; the rest widens the columns
    const room = width - others(columns) - size;
    const tiles = Math.max(2, Math.floor((Math.max(room, library_min) - SPRITE_LIBRARY_PADDING) / SPRITE_TILE_STEP));
    const library_w = SPRITE_LIBRARY_PADDING + tiles * SPRITE_TILE_STEP;
    const spare = Math.max(0, room - library_w);
    const sprite_w = column_w + Math.floor(spare / columns);
    const states_w = states_column ? column_w + Math.floor(spare / columns) : column_w;
    const x_library = gap;
    const x_tools = x_library + library_w + gap;
    const x_canvas = x_tools + left_w + gap;
    const x_sprite = x_canvas + size + gap;
    const x_states = x_sprite + sprite_w + gap;
    return { gap, left_w, sprite_w, states_w, states_column, size, x_library, library_w, x_tools, x_canvas, x_sprite, x_states };
}

// Folding panels (the settings of the level and of the layer in the level
// editor): the head always shows, a click folds or unfolds the body. Whether a
// panel is open is remembered per browser; a panel may be held open (the
// settings of a Hintergrund layer are all there is to edit on it).
const FOLDING_PANEL_DEFAULT_OPEN = { level_settings: false, layer_settings: false };
const folding_panel_forced = {};

function folding_panel_open(name) {
    if (folding_panel_forced[name]) return true;
    try {
        const stored = localStorage.getItem(`panel_${name}`);
        if (stored !== null) return stored === '1';
    } catch { }
    return FOLDING_PANEL_DEFAULT_OPEN[name] ?? true;
}

function refresh_folding_panel(name) {
    const panel = $(`.folding-panel[data-panel="${name}"]`);
    const open = folding_panel_open(name);
    panel.toggleClass('folded', !open);
    panel.find('.folding-panel-head').attr('title', open ? 'Klicken zum Einklappen' : 'Klicken zum Aufklappen');
}

function set_folding_panel_open(name, open) {
    try { localStorage.setItem(`panel_${name}`, open ? '1' : '0'); } catch { }
    refresh_folding_panel(name);
}

window.set_folding_panel_open_by_name = (name, open) => set_folding_panel_open(name, open);

window.set_folding_panel_forced = function (name, forced) {
    folding_panel_forced[name] = !!forced;
    refresh_folding_panel(name);
};

function setup_folding_panels() {
    $(document).on('click', '.folding-panel-head', (e) => {
        const name = $(e.currentTarget).closest('.folding-panel').data('panel');
        // a panel held open folds only once it is no longer held
        if (folding_panel_forced[name]) return;
        set_folding_panel_open(name, !folding_panel_open(name));
    });
    $('.folding-panel').each((_, panel) => refresh_folding_panel($(panel).data('panel')));
}

// The view settings of the sprite editor: switches under Werkzeuge and in
// the status bar (menu.js), with their keys. M stands next to B and N
// (spiegeln) in the keyboard row of the tool buttons.
const SPRITE_VIEW_TOGGLES = [
    { key: 'O', label: 'Onion Skinning',
        title: 'Der Frame davor (rötlich) und danach (bläulich) scheinen durch – so zeichnest du eine Bewegung Schritt für Schritt.',
        get: () => !!canvas?.onion_skin, set: (value) => canvas?.set_onion_skin?.(value) },
    { key: 'P', label: 'Vorschau',
        title: 'Spielt die Animation des Zustands oben rechts ab – mit Framerate (− / +) und gespiegelter Ansicht.',
        get: () => !!window.sprite_preview?.shown, set: (value) => window.sprite_preview?.set_shown?.(value) },
    { key: 'M', label: 'Spiegelnd zeichnen',
        title: 'Was du mit Stift, Formen oder Füllen zeichnest, erscheint auch gespiegelt auf der anderen Seite. Die gestrichelte Linie ist der Spiegel.',
        get: () => !!canvas?.symmetric, set: (value) => canvas?.set_symmetric?.(value) },
];

function setup_sprite_view_toggles() {
    const row = $('#sprite_view_toggles').empty().addClass('view-toggles');
    for (const toggle of SPRITE_VIEW_TOGGLES) {
        toggle.button = $('<button type="button" class="view-toggle">').attr('title', `${toggle.label} (${toggle.key}) – ${toggle.title}`)
            .append($('<span class="view-toggle-dot">')).append($('<span>').text(toggle.label))
            .append($('<span class="key widget-key">').text(printed_key(toggle.key)))
            .appendTo(row)
            .on('click', () => { toggle.set(!toggle.get()); menus.sprites?.refresh_toggles(); });
    }
    refresh_sprite_view_toggles();
}

function refresh_sprite_view_toggles() {
    for (const toggle of SPRITE_VIEW_TOGGLES) toggle.button?.toggleClass('active', !!toggle.get());
}

function handleResize() {
    const layout = sprite_pane_layout(window.innerWidth, window.innerHeight);
    canvas.max_size = layout.size;
    canvas.handleResize();
    const size = $('#canvas').width();
    $('#canvas').css('left', `${layout.x_canvas}px`);
    $('#undo_stack').css({ left: `${layout.x_canvas}px`, width: `${size}px` });
    $('#menu_frames').css({ left: `${layout.x_canvas}px`, top: `${size + 120}px`, width: `${size}px` });
    // the boxes are left_w wide; the column is a little wider, for its scrollbar (styles.css)
    $('#main_div_sprites > .menu_container').first().css({ left: `${layout.x_tools}px`, width: `${layout.left_w + 12}px`,
        '--sprite-left-column': `${layout.left_w}px` });
    $('#main_div_sprites .right_menu_container').css({ left: `${layout.x_sprite}px`, width: `${layout.sprite_w}px` });
    // the Zustände: their own column, or below the Eigenschaften
    const states_home = layout.states_column ? $('#main_div_sprites .states_menu_container') : $('#main_div_sprites .right_menu_container');
    if (!$('#states_container').parent().is(states_home)) $('#states_container').appendTo(states_home);
    $('#main_div_sprites .states_menu_container').toggle(layout.states_column)
        .css({ left: `${layout.x_states}px`, width: `${layout.states_w}px` });
    $('#main_div_sprites .far_right_menu_container').css({ left: `${layout.x_library}px`, width: `${layout.library_w}px` });
    // the list moves its items aside while one is dragged: as many per row as fit
    const per_row = Math.max(1, Math.floor(($('#menu_sprites').innerWidth() || layout.library_w - 16) / 68));
    if (typeof game !== 'undefined') game?.sprites_widget?.set_columns?.(per_row, 68);
    // Level editor: wider side columns on wide screens (1920 × 1080: the
    // placed sprite's Eigenschaften fit their labels, more sprites per row),
    // the level view takes what is left.
    const wide = window.innerWidth >= 1600;
    const right_width = wide ? 300 : 216;
    const left_width = wide ? 276 : 222;
    $('.full_right_menu_container').css({ left: `${window.innerWidth - right_width - 20}px`, width: `${right_width}px` });
    $('.full_left_menu_container').css('left', `20px`);
    $('#main_div_level .full_left_menu_container').css('width', `${left_width}px`);
    // $('#right_menu_container .menu_frames').css('height', `${$('#canvas').height() * 0.2 - 25}px`);

    $('#main_div_level .left_menu_container').css('left', '10px');
    $('#main_div_level .left_menu_container').css('width', '174px');
    $('#level').css('left', `${20 + left_width + 18}px`);
    $('#level').css('top', '50px');
    $('#level').css('width', `${window.innerWidth - (20 + left_width + 18) - (right_width + 40)}px`);
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
    remember_color_before_transparent();
    canvas.current_color = parseInt(color.replace('#', ''), 16);
    refresh_current_color_chip();
    // durchsichtig: the variations of the colour before stay (X goes back to it)
    if (((canvas.current_color >>> 0) & 0xff) === 0) {
        $('#color_variations_menu .button').removeClass('active');
        return;
    }
    $('#color_variations_menu').empty();
    // rows of variations of the colour, each with what it is for (hover)
    const add_row = (colors, title) => {
        for (const variation of colors) {
            const swatch = $("<span class='button button-9'>").attr('title', title);
            swatch.css('background', `linear-gradient(${variation.toRgbString()},${variation.toRgbString()}), url(transparent.png), #777`);
            swatch.data('html_color', variation.toRgbString());
            const rgb = variation.toRgb();
            swatch.data('list_color', [rgb.r, rgb.g, rgb.b, Math.floor(rgb.a * 255)]);
            $('#color_variations_menu').append(swatch);
        }
    };
    const base = tinycolor(color);
    const alpha = base.getAlpha();
    add_row(base.analogous(12).slice(1, 12), 'Ähnliche Farbtöne');
    // pixel-art shades: darker ones cooler, lighter ones warmer (pixel_tools.js shade_ramp)
    add_row(shade_ramp(base.toHsl(), 5).map(c => tinycolor({ h: c.h, s: c.s, l: c.l, a: alpha })),
        'Schatten und Licht wie in Pixel-Art: dunkler wird kühler (bläulicher), heller wird wärmer (gelblicher)');
    add_row([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(h => {
        const variation = tinycolor(color);
        return h < 0 ? variation.darken(Math.abs(h / 5) * 40) : variation.brighten(Math.abs(h / 5) * 40);
    }), 'Dunkler und heller (derselbe Farbton)');
    add_row([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(h => {
        const variation = tinycolor(color);
        return h < 0 ? variation.desaturate(-h * 16) : variation.saturate(h * 16);
    }), 'Blasser und kräftiger');
    add_row([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(h => tinycolor(color).setAlpha(h / 11)),
        'Durchsichtiger – ganz links fast unsichtbar');
    $('#color_variations_menu .button').click(function (e) {
        remember_color_before_transparent();
        let list_color = $(e.target).data('list_color');
        canvas.current_color = (((((list_color[0] * 256) + list_color[1]) * 256) + list_color[2]) * 256) + list_color[3];
        color_menu.element.find('.button').removeClass('active');
        $('#color_variations_menu').find('.button').removeClass('active');
        $(e.target).addClass('active');
        refresh_current_color_chip();
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
        // these work with one pixel; the brush size of the pen comes back with it
        const one_pixel = ['tool/picker', 'tool/spray', 'tool/fill', 'tool/gradient', 'tool/select-rect'];
        if (one_pixel.includes(item.key)) {
            if (!one_pixel.includes(window.last_tool_key)) window.pen_width_for_drawing = canvas.pen_width;
            menus.sprites.handle_click('penWidth/1');
        } else if (one_pixel.includes(window.last_tool_key) && window.pen_width_for_drawing > 1) {
            menus.sprites.handle_click(`penWidth/${window.pen_width_for_drawing}`);
        }
        window.last_tool_key = item.key;
    }
}

// Farbe ↔ durchsichtig (X, and the button at X under Werkzeuge): the second
// colour is always "durchsichtig", like the two colours in Photoshop. The
// right mouse button does not paint – it opens the menu (canvas.js canvas_menu).
window.color_before_transparent = null;

function color_is_transparent(c) {
    return ((c >>> 0) & 0xff) === 0;
}

function remember_color_before_transparent() {
    if (typeof canvas !== 'undefined' && canvas && !color_is_transparent(canvas.current_color))
        window.color_before_transparent = canvas.current_color >>> 0;
}

function toggle_transparent_color() {
    if (!color_is_transparent(canvas.current_color)) {
        remember_color_before_transparent();
        canvas.current_color = 0;
        $('#color_variations_menu .button').removeClass('active');
    } else if (window.color_before_transparent !== null) {
        canvas.current_color = window.color_before_transparent;
        // a colour of the variations: it is marked there again
        const back = window.color_before_transparent;
        $('#color_variations_menu .button').each((_, el) => {
            const c = $(el).data('list_color');
            if (c && ((((c[0] * 256 + c[1]) * 256 + c[2]) * 256 + c[3]) >>> 0) === back) $(el).addClass('active');
        });
    } else {
        const first = color_menu_items?.find(item => item.data !== '#00000000');
        if (first) setCurrentColor(first.data);
    }
    refresh_current_color_chip();
    canvas.update_overlay_brush?.();
}

// The swatch of the palette that is the colour the pen draws with (also after
// the pipette picked one), the X button, and a word when that colour is transparent.
function refresh_current_color_chip() {
    if (typeof menus !== 'undefined') menus.sprites?.refresh_toggles?.();
    const c = canvas.current_color >>> 0;
    const rgba = [(c >>> 24) & 0xff, (c >>> 16) & 0xff, (c >>> 8) & 0xff, c & 0xff];
    const t = tinycolor({ r: rgba[0], g: rgba[1], b: rgba[2], a: rgba[3] / 255 });
    const transparent = rgba[3] === 0;
    $('#palette_erase_hint').toggleClass('transparent', transparent)
        .html(transparent ? 'Durchsichtig – der Stift radiert. <span class="key">X</span> holt deine Farbe zurück.' :
            '<span class="key">X</span> wechselt zu durchsichtig (radieren) und zurück');
    // the X button: what the pen paints with in front (your colour or durchsichtig), the other one behind
    const swap = $('.swap-transparent-button');
    if (swap.length) {
        if (!swap.children('.swap-chip').length)
            swap.prepend('<span class="swap-chip swap-colour"></span><span class="swap-chip swap-clear"></span>');
        const other = window.color_before_transparent;
        const colour = !transparent ? t : other === null ? null :
            tinycolor({ r: other >>> 24, g: (other >>> 16) & 0xff, b: (other >>> 8) & 0xff, a: (other & 0xff) / 255 });
        swap.toggleClass('transparent', transparent);
        swap.children('.swap-colour').css('background', colour ? `linear-gradient(${colour.toRgbString()},${colour.toRgbString()}), url(transparent.png), #777` : '');
    }
    if (typeof color_menu !== 'undefined' && color_menu?.commands) {
        const hex = t.toHexString().toLowerCase();
        let found = false;
        for (const command of Object.values(color_menu.commands)) {
            const data = String(command.data ?? '').toLowerCase();
            const same = transparent ? (data.length === 9 && data.endsWith('00')) :
                (data.slice(0, 7) === hex && (data.length < 9 || data.slice(7, 9) === 'ff'));
            command.button?.toggleClass('active', same && !found);
            if (same) found = true;
        }
        if (found) $('#color_variations_menu .button').removeClass('active');
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
        { group: 'tool', command: 'pen', image: 'draw-freehand-44', shortcut: 'Q', label: 'Zeichnen', hints: [
                // the button at X under Werkzeuge has the key; the right button opens the menu (canvas.js canvas_menu)
                { key_label: 'X', type: 'toggle', label: 'Durchsichtig (radieren)',
                    title: 'Wechselt zwischen deiner Farbe und durchsichtig – mit durchsichtig radiert der Stift.',
                    get: () => color_is_transparent(canvas.current_color), callback: () => toggle_transparent_color() },
                'Rechtsklick: Menü',
                'Mausrad: zoomen',
                `<span class='key longkey'>Leer</span>&nbsp;+ ziehen: Ausschnitt verschieben`,
            ] },
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
        {
            group: 'tool', command: 'select-rect', image: 'select-rect-44', shortcut: 'Y', label: 'Rechteck auswählen', hints: [
                'Rechtsklick: Menü',
                { key: 'Control+A', label: 'Alles', callback: function () { canvas.select_all_pixels(); } },
                // canvas.js handle_selection_key: Strg+C / X / V, Entf, Esc, Pfeiltasten
                { key_label: 'Control+C', label: 'Kopieren', callback: function () { canvas.copy_selection_pixels(); } },
                { key_label: 'Control+V', label: 'Einfügen', callback: function () { canvas.paste_selection_pixels(); } },
                { key: 'Control', label: 'Auswahl erweitern', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
                { key: 'Alt', label: 'Auswahl verkleinern', type: 'checkbox', callback: function (x) { canvas.setModifierAlt(x); } },
                { key: 'Shift', label: 'Klonen', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
            ]
        },
        {
            group: 'tool', command: 'fill', image: 'color-fill-44', shortcut: 'A', label: 'Fläche füllen', hints: [
                // canvas.js replace_color: every pixel of exactly the clicked colour
                { key: 'Shift', label: 'Farbe im ganzen Frame ersetzen', type: 'checkbox', callback: function (x) { canvas.setModifierShift(x); } },
                { key: 'Control', label: 'Farbe in allen Frames ersetzen', type: 'checkbox', callback: function (x) { canvas.setModifierCtrl(x); } },
            ]
        },
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
        // the buttons stand like the keys on the keyboard: Q … Y, A … G, Z … N
        {
            group: 'tool', command: 'move', image: 'transform-move', label: 'Sprite verschieben',
            title: 'Verschiebt das Bild in allen Frames (mit Shift nur in diesem). Mit Strg und den Pfeiltasten geht es pixelweise.', hints: [
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

            ]
        },
        { group: 'tool', command: 'picker', image: 'color-picker', shortcut: 'Z', label: 'Farbe auswählen' },
        // X: the second colour is always "durchsichtig" (like the two colours in Photoshop)
        { command: 'swap-transparent', shortcut: 'X', label: 'Farbe ↔ durchsichtig', css_class: 'swap-transparent-button',
            title: 'Wechselt zwischen deiner Farbe und durchsichtig. Mit durchsichtig radieren Stift, Formen und Füllen.',
            callback: () => toggle_transparent_color() },
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
        { group: 'tool', command: 'pan', image: 'move-hand-44', shortcut: 'Q', label: 'Verschieben', hints: [
                'Mausrad: zoomen',
                'Rechtsklick: Menü',
                // level_editor.js handle_down: grab_panning, set_space_pan
                `Mit jedem Werkzeug: mittlere Maustaste oder <span class='key longkey'>Leer</span>&nbsp;+ ziehen`,
            ]
        },
        {
            group: 'tool', command: 'pen', image: 'draw-freehand-44', shortcut: 'W', label: 'Zeichnen', hints: [
                { key: 'Shift', label: 'Gitter ignorieren', type: 'checkbox', callback: function (x) { game.level_editor.setModifierShift(x); } },
                // level_editor.js set_pen_erasing (the key itself is handled there)
                { key_label: 'X', type: 'toggle', label: 'Radieren', title: 'Der Stift löscht, statt zu setzen – noch einmal X oder ein Klick auf ein Sprite: wieder setzen.',
                    get: () => !!game.level_editor?.pen_erasing, callback: (value) => game.level_editor?.set_pen_erasing(value) },
                'Rechtsklick: Menü',
                // level_editor.js shape_for_event: Shift and Alt can change while dragging
                `<span class='key longkey'>Strg</span>&nbsp;+ ziehen: Rechteck füllen, mit <span class='key longkey'>Shift</span> nur den Rand, mit <span class='key longkey'>Alt</span> eine Linie`,
            ]
        },
        {
            group: 'tool', command: 'select', image: 'select-rect-44', shortcut: 'E', label: 'Auswählen', hints: [
                'Rechtsklick: Menü',
                { key: 'Control+A', label: 'Alles auswählen', callback: function (x) { game.level_editor.select_all(); } },
                { key: 'Delete', label: 'Auswahl löschen', callback: function (x) { game.level_editor.delete_selection(); } },
                // handled by the printed letter in level_editor.js (key_label: shown only)
                { key_label: 'Control+C', label: 'Kopieren', callback: function () { game.level_editor.copy_selection(); } },
                { key_label: 'Control+V', label: 'Einfügen', callback: function () { game.level_editor.paste_clipboard(); } },
                { key_label: 'Control+D', label: 'Duplizieren', callback: function () { game.level_editor.duplicate_selection(); } },
                // level_editor.js handle_double_click: picks from any layer, again: the one behind
                'Doppelklick: in jeder Ebene auswählen',
                'Ziehen oder Pfeiltasten verschieben die Auswahl, mit <span class=\'key longkey\'>Shift</span> pixelgenau',
            ]
        },
        // the buttons stand in the order of their keys on the keyboard: Q W E R T
        {
            group: 'tool', command: 'connect', image: 'connect-44', shortcut: 'R', label: 'Verbinden', hints: [
                'Erst anklicken, was sendet (Schalter, Schlüssel, Druckplatte, Gegner, Signalbereich), dann, was reagieren soll (Tür, Brücke, Dach …)',
                { key: 'Escape', label: 'Abbrechen', callback: function () { game.level_editor.cancel_connect(); } },
            ]
        },
        // not a tool: starts a test run of this level (T: the figure at the mouse)
        { command: 'test', image: 'play-44', shortcut: 'T', label: 'Level testen',
            callback: function () { game.level_editor?.start_playtest(); } },
        // { group: 'tool', command: 'fill-rect', image: 'fill-rectangle', shortcut: 'W', label: 'Rechteck füllen' },
    ];


    // $('#palettes_here').masonry('layout');
    // $('#palettes_here').change(function (e) {
    //     update_color_palette();
    // });
    // $('#palettes_here').val('9');

    canvas = new Canvas($('#canvas'), null);
    handleResize();
    setup_folding_panels();

    update_color_palette();
    // initialize all other menus
    menus.level = new Menu($('#tool_menu_level'), 'level', tool_menu_items.level, null, function () {
        $('#menu_level_sprites .button').removeClass('active');
        // the chosen sprite is marked while the pen places it (not while it erases: X)
        if (this.active_key === 'tool/pen' && !game.level_editor?.pen_erasing)
            $('#menu_level_sprites .button').eq(game.level_editor.sprite_index).addClass('active');
        if (this.active_key !== 'tool/pen') game?.level_editor?.set_pen_erasing?.(false);
        if (this.active_key !== 'tool/select') {
            game?.level_editor?.clear_selection();
        }
        if (this.active_key !== 'tool/connect') game?.level_editor?.cancel_connect?.();
        if (this.active_key !== null) {
            game?.level_editor?.refresh_backdrop_controls();
            game?.level_editor?.refresh();
            game?.level_editor?.render();
        }
    });
    // initialize sprites menu last
    menus.sprites = new Menu($('#tool_menu'), 'sprites', tool_menu_items.sprites, canvas);
    canvas.menu = menus.sprites;
    setup_sprite_view_toggles();
    refresh_current_color_chip();

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

    function show_pane(key) {
        let changed = key !== current_pane;
        $('.main-nav-item').removeClass('active');
        $(`#mi_${key}`).addClass('active');
        // narrow screens: the tab bar scrolls sideways – keep the active tab in view
        $(`#mi_${key}`)[0]?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
        $('.main_div').hide();
        $(`#main_div_${key}`).show();
        current_pane = key;
        if (key in menus)
            menus[key].refresh_status_bar();
        // the animation preview runs only while the sprite editor is shown
        window.sprite_preview?.update?.();
        if (current_pane === 'sprites') window.sprite_history?.rebase?.();
        if (current_pane === 'level') {
            game.level_editor.refresh_sprite_widget();
            // deleting a sprite elsewhere tidies the levels: not an edit to undo here
            game.level_editor.history_rebase?.();
        }
        // the Signale beside a test run belong to that run only
        game.level_editor?.stop_signal_watch?.();
        if (current_pane === 'play') {
            // "Level testen" (level editor): straight into that level
            const playtest = window.studio_pending_playtest ?? null;
            window.studio_pending_playtest = null;
            $('#play_iframe').hide();
            api_call('/api/save_game_temp', { game: game.data }, function (data) {
                if (data.success) {
                    console.log(`tag: ${data.tag}`);
                    const frame = $('#play_iframe')[0].contentWindow;
                    // keys must reach the game, not the editor that was open
                    // before (a test run starts with T in the level editor)
                    const focus_game = focus_play_frame;
                    const loaded = frame.game.load(data.tag);
                    Promise.resolve(loaded).then(() => {
                        if (playtest) frame.game.start_playtest?.(playtest);
                        // the level's Signale beside the test run (level_editor.js)
                        if (playtest && current_pane === 'play') game.level_editor?.start_signal_watch?.(playtest.level_index);
                        focus_game();
                    });
                    $('#play_iframe').fadeIn();
                    focus_game();
                }
            });
        } else {
            try {
                $('#play_iframe')[0].contentWindow.game.stop();
                $('#play_iframe')[0].contentWindow.yt_player.pauseVideo();
            } catch { }
        }
        if (current_pane === 'playtesting') window.playtesting?.show();
        return changed;
    }

    // Spielen: the game frame gets the keys. Keys that still arrive here (the
    // frame did not have the focus yet, e.g. right after T in the level
    // editor) are handed to the game, and the frame takes the focus for the
    // next ones. Studio shortcuts with Strg/Alt stay here.
    function focus_play_frame() {
        if (current_pane !== 'play') return;
        const iframe = $('#play_iframe')[0];
        document.activeElement?.blur?.();
        iframe?.focus();
        try { iframe?.contentWindow?.focus(); } catch { }
    }
    window.focus_play_frame = focus_play_frame;
    for (const type of ['keydown', 'keyup']) {
        window.addEventListener(type, (e) => {
            if (current_pane !== 'play' || $(e.target).is('input, textarea, select, [contenteditable]')) return;
            // a dialog is open (Strg+S, Gemeinsam bearbeiten …): its buttons get the keys
            if ($('.modal-dialogs').is(':visible')) return;
            if (e.ctrlKey || e.altKey || e.metaKey || /^F\d+$/.test(e.key ?? '')) return;
            const frame = $('#play_iframe')[0]?.contentWindow;
            if (!frame?.game) return;
            e.preventDefault();
            e.stopPropagation();
            try {
                frame.dispatchEvent(new frame.KeyboardEvent(type, { key: e.key, code: e.code, repeat: e.repeat, shiftKey: e.shiftKey, bubbles: true }));
            } catch { }
            focus_play_frame();
        }, true);
    }

    // Browser history: every pane (and every opened recipe in Hilfe) gets its own
    // entry, so the back button stays inside the studio instead of leaving it.
    $('.main-nav-item').click(function (e) {
        let key = $(e.target).attr('id').replace('mi_', '');
        if (show_pane(key)) studio_history_push({ pane: key });
    })
    window.studio_show_pane = show_pane;
    // Test runs from the level editor: into the Spielen pane, and back with
    // Esc to the level editor as it was (its camera and layer never changed).
    window.studio_start_playtest = function (options) {
        window.studio_pending_playtest = options;
        if (show_pane('play')) studio_history_push({ pane: 'play' });
    };
    window.studio_return_from_playtest = function () {
        if (show_pane('level')) studio_history_push({ pane: 'level' });
        window.focus();
    };
    window.addEventListener('popstate', (e) => {
        const state = e.state ?? parse_studio_hash();
        if (state.pane && $(`#mi_${state.pane}`).length) show_pane(state.pane);
        if (state.pane === 'help') window.recipe_gallery?.restore(state);
    });
    {
        // Only Hilfe can be opened directly (e.g. a link to one recipe); the
        // editing panes need a loaded game first.
        let state = parse_studio_hash();
        if (state.pane !== 'help') state = { pane: 'sprites' };
        history.replaceState(state, '', studio_url(state));
        if (state.pane === 'help') {
            show_pane('help');
            // The gallery may or may not have loaded its recipes yet: restore()
            // handles both, the variable covers a gallery created later.
            window.pending_recipe_state = state;
            window.recipe_gallery?.restore(state);
        }
    }

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
                    label: 'Sprites holen (Katalog oder anderes Spiel) …',
                    callback: () => show_sprite_basket(),
                },
                {
                    label: 'Bilder öffnen …',
                    callback: () => choose_image_files(),
                },
                {
                    // canvas.js outline_frames: one pixel in the current colour around everything drawn
                    label: 'Umriss zeichnen',
                    hint: 'Zeichnet einen Rand von einem Pixel in der gewählten Farbe um alles, was im Bild ist – gut gegen Figuren, die im Hintergrund verschwinden. Strg+Z nimmt ihn wieder weg.',
                    children: [
                        { label: 'in diesem Frame', callback: () => canvas.outline_frames('frame') },
                        { label: 'in allen Frames dieses Zustands', callback: () => canvas.outline_frames('state') },
                        { label: 'in allen Frames des Sprites', callback: () => canvas.outline_frames('sprite') },
                    ],
                },
                // {
                //     label: 'Spritekatalog',
                //     callback: () => {
                //         window.importSpriteModal.show();
                //     }
                // },
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
                // palette_apply.js: every sprite and every background colour
                {
                    label: 'Ganzes Spiel an Palette anpassen',
                    children: Object.entries(PALETTE_METHODS).map(([method, label]) => ({
                        label: label.charAt(0).toUpperCase() + label.slice(1),
                        callback: () => apply_palette_to_game(method),
                    })),
                },
                {
                    label: 'Umfärben rückgängig machen',
                    enabled: () => !!game?.palette_undo,
                    callback: () => undo_game_palette(),
                },
            ],
        },
    ]);

    game = new Game();

    // The lists explain themselves when the mouse rests on them (their items
    // have no title of their own, except sprites: their names).
    const list_titles = {
        '#menu_frames': 'Klick: Frame bearbeiten · Shift oder Strg + Klick: mehrere Frames auswählen · Rechtsklick: Duplizieren, Kopieren, Umkehren … · Ziehen: Reihenfolge ändern oder in den Papierkorb – ausgewählte Frames gehen alle mit',
        '#menu_states': 'Klick: Zustand bearbeiten · Rechtsklick: Duplizieren, Animation kopieren oder tauschen … · Ziehen: in den Papierkorb',
        '#menu_levels': 'Klick: Level bearbeiten · Rechtsklick: Duplizieren · Ziehen: Reihenfolge ändern oder in den Papierkorb (gleich danach mit Strg+Z zurückholen)',
        '#menu_layers': 'Klick: Ebene bearbeiten · Auge: zeigen/verstecken · Schloss: vor Änderungen schützen · Rechtsklick: Duplizieren · Ziehen: Reihenfolge ändern oder in den Papierkorb',
        '#trash': 'Hierher ziehen, um es zu löschen. Ein gelöschtes Sprite oder Level holst du gleich danach mit Strg+Z zurück.',
    };
    for (const [selector, title] of Object.entries(list_titles)) $(selector).attr('title', title);

    // game.load('6imgi0t');
    // game.load('skkmhwy');

    let tag = window.location.search.replace('?', '');
    // rescue.js: unsaved work from before the reload comes first; the game
    // from the address only when it does not come back
    const load_from_address = (restored) => {
        if (!restored && tag.length === 7) game.load(tag);
    };
    if (window.studio_rescue) window.studio_rescue.check_on_start(load_from_address);
    else load_from_address(false);

    // document.oncopy = function (copyEvent) {
    //     // TODO: not working yet, maybe ask for permissions?
    //     console.log('copying sprite to clipboard!');
    //     let url = canvas.toUrl();
    //     console.log(url);
    //     copyEvent.clipboardData.setData('image/png', url);
    //     copyEvent.preventDefault();
    // }

    // Pictures from the clipboard (Strg+V) or dropped onto the sprite editor:
    // image_import.js analyses them (pixel size, background, frames) and asks
    // in a dialog how to bring them in.
    const typing = (target) => $(target).is('input, textarea, select, [contenteditable]');
    document.addEventListener('paste', async (e) => {
        if (current_pane !== 'sprites' || typing(e.target)) return;
        // several copied picture files become one animation
        const files = [...(e.clipboardData?.items ?? [])].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean);
        if (files.length) {
            e.preventDefault();
            open_image_import(files.length === 1 ? files[0] : files);
            return;
        }
        // some browsers only offer pictures through the asynchronous clipboard
        try {
            for (const entry of await navigator.clipboard.read()) {
                const type = entry.types.find(t => t.startsWith('image/'));
                if (type) { open_image_import(await entry.getType(type)); return; }
            }
        } catch (err) { }
    });

    $(document).on('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
    });
    $(document).on('drop', function (e) {
        if (current_pane !== 'sprites') return;
        const files = [...(e.originalEvent.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        e.stopPropagation();
        open_image_import(files.length === 1 ? files[0] : files);
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

    $('.scroll_helper_horizontal').on('wheel', function (e) {
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

    function highlight_path_to(tag) {
        $('#games_sublist_graph svg g.node').removeClass('highlight');
        $('#games_sublist_graph svg g.edge').removeClass('highlight');
        let node = $(`#games_sublist_graph svg g.node#g${tag}`);
        node.addClass('highlight');
        let p0 = tag;
        let p = window.graph_parents[tag] ?? null;
        while (p !== null) {
            let node = $(`#games_sublist_graph svg g.node#g${p}`);
            node.addClass('highlight');
            let edge = $(`#games_sublist_graph svg g.edge#g${p}g${p0}`);
            edge.addClass('highlight');
            p0 = p;
            p = window.graph_parents[p] ?? null;
        }
    }

    function populate_games_list(nodes) {
        console.log(nodes);
        $('#load_games_sublist').empty();
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
            rows: nodes.map(function (node) {
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

    function populate_tips_games(div, nodes) {
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
            rows: nodes.map(function (node) {
                let bu_versions = $('');
                if (node.relatives_count > 0) {
                    bu_versions = $('<button>').css('font-size', '90%').css('width', '9.2em').append($(`<div>${node.relatives_count} Versionen <i class='fa fa-angle-right'></i></div>`));
                    bu_versions.click(function (e) {
                        api_call('/api/graph', { tag: node.tag }, function (data) {
                            if (data.success) {
                                window.graph_parents = data.graph_parents;
                                $('#games_sublist_graph').empty().append($(data.svg)).show();
                                highlight_path_to(node.tag);
                                $('#games_sublist_graph svg g.node').on('click', function (e) {
                                    let id = $(e.target).closest('g.node').attr('id').substr(1);;
                                    highlight_path_to(id);
                                    fetch_game_versions_until(id);
                                })
                            }
                        });
                        e.stopPropagation();
                        $('#load_games_list').css('left', '-100%').css('opacity', 0);
                        $('#load_games_sublist').css('left', '0').css('opacity', 1);
                        $('#bu_load_game_back').css('left', '0').css('opacity', 1);
                        $('#load_games_list').parent().css('pointer-events', 'none');
                        $('#load_games_sublist').parent().css('pointer-events', 'auto');
                        fetch_game_versions_until(node.tag);
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
                    $('<td>').append(bu_versions).data('sort_value', node.relatives_count),
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

    function fetch_game_versions_until(tag) {
        api_call('/api/get_versions_for_game', { tag: tag }, function (data) {
            if (data.success) {
                populate_games_list(data.nodes);
            }
        });
    }

    window.loadGameModal = new ModalDialog({
        title: 'Spiel laden',
        width: '90vw',
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
            let secret = window.location.search.toString().replace('?', '').trim();
            if (secret.length === 0) secret = 'x';
            api_call(`/api/get_games/${secret}`, {}, function (data) {
                console.log(data);
                if (data.success) {
                    console.log(data);
                    let div = $('<div>');
                    body.append(div);
                    populate_tips_games(div, data.nodes);
                }
            });
        },
        footer: [
            // {
            //     type: 'input',
            //     label: 'Suchen',
            //     icon: 'fa-search',
            //     callback: (self, text) => {
            //         text = text.trim();
            //         window.current_search_query = text;
            //         api_call(text.length === 0 ? '/api/get_games' : '/api/search_game', {query: text}, function(data) {
            //             if (data.success) {
            //                 if (window.current_search_query === (data.query ?? '')) {
            //                     let body = $('#load_games_list');
            //                     body.empty();
            //                     let div = $('<div>');
            //                     body.append(div);
            //                     populate_tips_games(div, data.nodes);
            //                 }
            //             }
            //         });
            //     },
            // },
            {
                type: 'button',
                label: 'Neues Spiel …',
                icon: 'fa-file-o',
                callback: (self) => { self.dismiss(); if (typeof show_new_game_dialog === 'function') show_new_game_dialog(); },
            },
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
        ]
    });

    $('#bu_load_game_back').click(function (e) {
        $('#load_games_list').css('left', '0').css('opacity', 1);
        $('#load_games_sublist').css('left', '100%').css('opacity', 0);
        $('#bu_load_game_back').css('left', '100%').css('opacity', 0);
        $('#load_games_list').parent().css('pointer-events', 'auto');
        $('#load_games_sublist').parent().css('pointer-events', 'none');
        $('#load_games_sublist').empty();
        $('#games_sublist_graph').hide().attr('src', '');
    });

    window.resizeCanvasModal = new ModalDialog({
        title: 'Größe ändern',
        width: '40vw',
        body: `
        <div>
        <p>Wie viele Felder des Rasters soll das Sprite groß sein? Dann passt es im Level genau zu den anderen.</p>
        <div class='resize-cells' id='resize_cells'></div>
        <p>Oder gib die Größe in Pixeln ein:</p>
        <div style="text-align: center; font-size: 120%;">
            <input id='ti_sprite_width' type='text' style='width: 3em; font-size: 100%; text-align: center;'/>
            &times;
            <input id='ti_sprite_height' type='text' style='width: 3em; font-size: 100%; text-align: center;'/>
        </div>
        <p class='resize-grid-hint' id='resize_grid_hint'></p>
        </div>
        `,
        onshow: () => {
            $('#ti_sprite_width').val(canvas.bitmap.width);
            $('#ti_sprite_height').val(canvas.bitmap.height);
            // whole cells of the game's Raster (Einstellungen → Spiel: Rastergröße)
            const cell = typeof game_grid_size === 'function' ? game_grid_size(game.data) : 24;
            const cells = $('#resize_cells').empty();
            const hint = () => {
                const w = parseInt($('#ti_sprite_width').val()), h = parseInt($('#ti_sprite_height').val());
                const fits = w > 0 && h > 0 && w % cell === 0 && h % cell === 0;
                $('#resize_grid_hint').toggleClass('warn', !fits).text(fits ? `${w / cell} × ${h / cell} Felder – passt ins Raster.` :
                    `Passt nicht ins Raster von ${cell} × ${cell} Pixeln: Im Level steht es dann über den Rand der Felder hinaus.`);
                cells.children().each((_, el) => $(el).toggleClass('active', $(el).data('w') === w && $(el).data('h') === h));
            };
            for (const [cw, ch] of [[1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 3], [4, 4]]) {
                const w = cw * cell, h = ch * cell;
                const button = $('<button>').attr('type', 'button').addClass('resize-cell').data('w', w).data('h', h)
                    .attr('title', `${w} × ${h} Pixel`).appendTo(cells);
                // a little picture of the cells
                const box = $('<span>').addClass('resize-cell-box').css({ width: `${cw * 9}px`, height: `${ch * 9}px`,
                    backgroundSize: '9px 9px' }).appendTo(button);
                $('<span>').addClass('resize-cell-label').text(`${cw} × ${ch}`).appendTo(button);
                button.on('click', () => { $('#ti_sprite_width').val(w); $('#ti_sprite_height').val(h); hint(); });
            }
            $('#ti_sprite_width, #ti_sprite_height').off('input.grid').on('input.grid', hint);
            hint();
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
                        canvas.attachSprite(old_sprite_index, old_state_index, old_frame_index, function () {
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
            $('<label>').addClass('palette-apply-all')
                .append($('<input type="checkbox" id="palette_apply_all">'))
                .append(document.createTextNode(' Mein Spiel gleich in diese Palette umfärben – alle Sprites und die Farben der Hintergründe'))
                .insertBefore(self.dialog.find('.modal-footer'));
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
                    // palette_apply.js: the whole game in the new colours, backgrounds too
                    if ($('#palette_apply_all').prop('checked')) apply_palette_to_game('ordered');
                }
            },
        ]
    });

    // window.importSpriteModal = new ModalDialog({
    //     title: 'Spritekatalog',
    //     // vars: {
    //     //     palette_index: -1,
    //     //     div_for_palette_index: {},
    //     // },
    //     width: '90vw',
    //     body: `
    //     <div id='gifs_here' class="grid"></div>
    //     `,
    //     onbody: (self) => {
    //         // for (let i = 0; i < palettes.length; i++) {
    //         //     let palette = palettes[i];
    //         //     let div = $(`<div class='palette-swatches grid-item'>`);
    //         //     let div2 = $(`<div>`)
    //         //     div.append(div2)
    //         //     div2.append($(`<h3>`).text(palette.name));
    //         //     let colors = $(`<div>`).css('margin-top', '5px');
    //         //     for (let color of palette.colors) {
    //         //         let swatch = $(`<div class='swatch'>`);
    //         //         swatch.css('background-color', color);
    //         //         colors.append(swatch);
    //         //     }
    //         //     div2.append(colors);
    //         //     div2.click(function (e) {
    //         //         $('#palettes_here .palette-swatches > div').removeClass('active');
    //         //         $(e.target).closest('.palette-swatches > div').addClass('active');
    //         //         self.palette_index = i;
    //         //     });
    //         //     self.div_for_palette_index[i] = div2;
    //         //     $('#palettes_here').append(div);
    //         // }
    //         $('#gifs_here').empty();
    //         api_call('/api/get_all_gifs', {}, function (data) {
    //             if (data.success) {
    //                 console.log(data);
    //                 for (let tag of data.tags) {
    //                     $('#gifs_here').append($(`<img style='height: 100px; image-rendering: pixelated;'>`).attr('src', `/gen/catalogue/${tag}.gif`));
    //                 }
    //             }
    //         });
    //     },
    //     onshow: (self) => {
    //         // self.palette_index = window.selected_palette_index;
    //         // $('#palettes_here .palette-swatches > div').removeClass('active');
    //         // self.div_for_palette_index[self.palette_index].addClass('active');
    //         // window.modal_choose_palette_grid.masonry();
    //         window.dispatchEvent(new Event('resize'));
    //     },
    //     footer: [
    //         {
    //             type: 'button',
    //             label: 'Abbrechen',
    //             icon: 'fa-times',
    //             callback: (self) => self.dismiss(),
    //         },
    //         // {
    //         //     type: 'button',
    //         //     label: 'Sprite importieren',
    //         //     icon: 'fa-check',
    //         //     color: 'green',
    //         //     callback: async (self) => {
    //         //         // window.selected_palette_index = self.palette_index;
    //         //         // update_color_palette();
    //         //         self.dismiss();
    //         //     }
    //         // },
    //     ]
    // });

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

// Uncaught errors: crash_report.js (the robot, the rescue copy and a Fehlerbericht).

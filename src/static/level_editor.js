class LayerStruct {
    /*
    layer: only one sprite per position allowed
    */
    constructor(level_editor) {
        this.level_editor = level_editor;
        this.el_sprite_count = null;
        this.group = new THREE.Group();
        this.interval_tree_x = new IntervalTree();
        this.interval_tree_y = new IntervalTree();
        this.selectionMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5});
        this.reset();
    }

    reset() {
        this.group.remove.apply(this.group, this.group.children);
        this.interval_tree_x.clear();
        this.interval_tree_y.clear();
        this.mesh_for_pos = {};
        this.placed_sprite_index_for_pos = {};
    }

    // clear layer struct and apply layer from game data
    apply_layer(layer) {
        this.reset();
        this.layer = layer;
        if (layer.type !== 'sprites') return;
        const game = this.level_editor.game;
        for (let i = 0; i < layer.sprites.length; i++) {
            let sprite = layer.sprites[i];
            // Placed sprites refer to their sprite by ID; one whose sprite no
            // longer exists is dropped from the layer.
            const sprite_index = game.sprite_index_for_ref(sprite[0]);
            if (sprite_index === null) {
                layer.sprites.splice(i--, 1);
                continue;
            }
            this.add_sprite([sprite[1], sprite[2]], sprite_index, i);
        }
        if (this.el_sprite_count !== null)
            $(this.el_sprite_count).text(`${layer.sprites.length}`);
        // console.log(layer);
    }

    // after a Mischmodus change of the layer or of a sprite
    refresh_materials() {
        if (this.layer?.type !== 'sprites') return;
        for (const pos of Object.keys(this.mesh_for_pos)) {
            const si = this.level_editor.game.sprite_index_for_ref(this.layer.sprites[this.placed_sprite_index_for_pos[pos]]?.[0]);
            if (si === null) continue;
            this.mesh_for_pos[pos].material = this.level_editor.game.editor_sprite_material(si, this.layer.properties?.blend);
        }
    }

    remove_from_interval_trees(psi) {
        let placed = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[psi];
        let sprite_index = this.level_editor.game.sprite_index_for_ref(placed[0]);
        let p = [placed[1], placed[2]];
        let sw = this.level_editor.game.data.sprites[sprite_index].width;
        let sh = this.level_editor.game.data.sprites[sprite_index].height;
        let x0 = p[0] - sw * 0.5;
        let x1 = p[0] + sw * 0.5;
        let y0 = p[1];
        let y1 = p[1] + sh;
        this.interval_tree_x.remove([x0, x1], psi);
        this.interval_tree_y.remove([y0, y1], psi);
    }

    insert_into_interval_trees(psi) {
        let placed = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[psi];
        let sprite_index = this.level_editor.game.sprite_index_for_ref(placed[0]);
        let p = [placed[1], placed[2]];
        let sw = this.level_editor.game.data.sprites[sprite_index].width;
        let sh = this.level_editor.game.data.sprites[sprite_index].height;
        let x0 = p[0] - sw * 0.5;
        let x1 = p[0] + sw * 0.5;
        let y0 = p[1];
        let y1 = p[1] + sh;
        this.interval_tree_x.insert([x0, x1], psi);
        this.interval_tree_y.insert([y0, y1], psi);
    }

    remove_sprite(p, retain_position) {
        let pos = `${p[0]}/${p[1]}`;
        if (pos in this.placed_sprite_index_for_pos) {
            let placed_sprite_index = this.placed_sprite_index_for_pos[pos];
            this.group.remove(this.mesh_for_pos[pos]);
            this.remove_from_interval_trees(this.placed_sprite_index_for_pos[pos]);
            delete this.placed_sprite_index_for_pos[pos];
            delete this.mesh_for_pos[pos];
            if (!retain_position) {
                // don't retain position: swap removed sprite with last sprite (sprite_index vs. this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length - 1)
                // delete a
                let a = placed_sprite_index;
                // move b to position of a
                let b = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length - 1;
                if (a !== b) {
                    this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[a] = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[b];
                    let sprite = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[a];
                    this.placed_sprite_index_for_pos[`${sprite[1]}/${sprite[2]}`] = a;
                    this.remove_from_interval_trees(b);
                    this.insert_into_interval_trees(a);
                }
                this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.splice(b, 1);
            }
            if (!retain_position) {
                $(this.el_sprite_count).text(`${this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length}`);
            }
        }
    }

    add_sprite(p, sprite_index, force_placed_sprite_index) {
        let use_placed_sprite_index = null;
        if (force_placed_sprite_index === null)
            use_placed_sprite_index = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length;
        else
            use_placed_sprite_index = force_placed_sprite_index;

        let pos = `${p[0]}/${p[1]}`;
        // console.log('THIS', this.level_editor.layer_index, this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites);
        const existing = (this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites ?? [])[this.placed_sprite_index_for_pos[pos]];
        if (this.level_editor.game.sprite_index_for_ref(existing?.[0]) !== sprite_index) {
            let sw = this.level_editor.game.data.sprites[sprite_index].width;
            let sh = this.level_editor.game.data.sprites[sprite_index].height;
            let x0 = p[0] - sw * 0.5;
            let x1 = p[0] + sw * 0.5;
            let y0 = p[1];
            let y1 = p[1] + sh;
            if (pos in this.placed_sprite_index_for_pos) {
                use_placed_sprite_index = this.placed_sprite_index_for_pos[pos];
                this.remove_sprite(p, true);
            }
            let mesh = new THREE.Mesh(this.level_editor.game.geometry_for_sprite[sprite_index],
                this.level_editor.game.editor_sprite_material(sprite_index, this.layer?.properties?.blend));
            // "Level animieren" (LevelEditor.animate_sprites) picks its frame
            mesh.userData.sprite_index = sprite_index;
            mesh.position.x = p[0];
            mesh.position.y = p[1];
            this.group.add(mesh);
            this.mesh_for_pos[pos] = mesh;
            this.placed_sprite_index_for_pos[pos] = use_placed_sprite_index;
            this.interval_tree_x.insert([x0, x1], use_placed_sprite_index);
            this.interval_tree_y.insert([y0, y1], use_placed_sprite_index);
            if (force_placed_sprite_index === null) {
                const placed = [this.level_editor.game.data.sprites[sprite_index].id, p[0], p[1]];
                // a new Schalter or Druckplatte gets a free Code (signals.js)
                const level = this.level_editor.game.data.levels[this.level_editor.level_index];
                give_new_senders_codes(level, [placed], () => this.level_editor.game.data.sprites[sprite_index].traits);
                give_new_signs_their_voice([placed], () => this.level_editor.game.data.sprites[sprite_index].traits);
                (level.layers[this.level_editor.layer_index].sprites ?? [])[use_placed_sprite_index] = placed;
            }
            $(this.el_sprite_count).text(`${(this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites ?? []).length}`);
        }
    }

    select_rect(selection_group, x0, y0, x1, y1) {
        let result = [];
        selection_group.remove.apply(selection_group, selection_group.children);
        let layer = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index];

        if (!layer.properties.visible)
            return result;
        let result_x = new Set();
        for (let i of this.interval_tree_x.search([x0, x1]))
            result_x.add(i);
        let result_y = new Set();
        for (let i of this.interval_tree_y.search([y0, y1]))
            result_y.add(i);
        result = new Set([...result_x].filter((x) => result_y.has(x)));

        for (let index of result) {
            let s = layer.sprites[index];
            let sprite_index = this.level_editor.game.sprite_index_for_ref(s[0]);

            let sw = this.level_editor.game.data.sprites[sprite_index].width;
            let sh = this.level_editor.game.data.sprites[sprite_index].height;
            let x0 = s[1] - sw * 0.5;
            let x1 = s[1] + sw * 0.5;
            let y0 = s[2];
            let y1 = s[2] + sh;

            let points = [];
            points.push(new THREE.Vector3(x0, y0, 1));
            points.push(new THREE.Vector3(x0, y1, 1));
            points.push(new THREE.Vector3(x1, y1, 1));
            points.push(new THREE.Vector3(x1, y0, 1));
            let geometry = new THREE.BufferGeometry().setFromPoints(points);
            selection_group.add(new THREE.LineLoop(geometry, this.selectionMaterial));
        }
        return [...result];
    }
}

class LevelEditor {
    constructor(element, game) {
        let self = this;
        // a game was loaded: the editor before this one is still game.level_editor
        // until this constructor returns, and menus call it meanwhile – on the
        // new game's data, which may have fewer levels or layers than its indices
        const previous = game?.level_editor;
        if (previous && previous !== this) {
            previous.level_index = 0;
            previous.layer_index = 0;
        }
        this.element = element;
        $(this.element).empty();
        $(this.element).css('cursor', 'crosshair');
        this.grid_width = 24;
        this.grid_height = 24;
        this.grid_x = 0;
        this.grid_y = 0;
        this.modifier_shift = false;
        this.game = game;
        this.level_index = 0;
        this.auto_adjust_camera = true;
        this.layer_index = 0;
        this.rect_index = 0;
        this.clock = new THREE.Clock(true);
        this.scene = new THREE.Scene();
        this.grid_group = new THREE.Group();
        this.cursor_group = new THREE.Group();
        this.cursor_group_inner = new THREE.Group();
        this.cursor_group.add(this.cursor_group_inner);
        this.rect_group = new THREE.Group();
        this.selection_group = new THREE.Group();
        this.backdrop_cursor = new THREE.Group();
        this.layer_structs = [];
        this.camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
        this.camera.position.x = 0;
        this.camera.position.z = 10;
        this.camera.position.y = 0;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor("#000");
        this.camera_x = 0.0;
        this.camera_y = 0.0;
        this.scale = 3.0;
        this.x0 = 0;
        this.y0 = 0;
        this.x1 = 0;
        this.y1 = 0;
        this.sheets = [];
        this.cursor = null;
        this.selection = [];
        this.sprite_index = 0;
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        this.scale = this.height / 24.0 / 16.0;
        this.visible_pixels = this.height / this.scale;
        this.is_touch = false;
        this.is_double_touch = false;
        this.double_touch_points = null;
        this.mouse_down = false;
        this.mouse_down_button = 0;
        this.mouse_down_position = [0, 0];
        this.mouse_down_position_no_snap = [0, 0];
        this.mouse_down_position_raw = [0, 0];
        this.updating_selection = false;
        this.old_camera_position = [0, 0];
        $(this.element).append(this.renderer.domElement);
        this.label_for_level = [];
        this.backdrop_index = null;
        this.backdrop_controls = [];
        this.backdrop_controls_setup_for = null;
        this.backdrop_move_point = null;
        this.backdrop_move_elements = {};
        this.backdrop_move_point_old_coordinates = null;
        this.backdrop_move_point_old_size = null;
        this.show_grid = true;
        // "Level animieren": sprites play their animation, effect backdrops
        // (snow, rain, dust, …) move – a live preview, nothing is saved
        this.animate_level = false;
        this.backdrop_time_meshes = [];
        this.backdrop_animation_frame = null;
        this.camera_mode = false;
        // Signale: connections (build_signal_links)
        this.signal_links_group = new THREE.Group();
        // Bewegte Plattformen (platforms.js): their Weg (build_platform_paths)
        this.platform_paths_group = new THREE.Group();
        this.signal_link_curves = [];
        this.signal_link_frames = [];
        this.connect_from = null;
        this.connect_pointer = null;
        this.signal_highlight = null;
        // Signale-Übersicht (S): every Code of the level as a rule card
        try { this.show_signal_overview = localStorage.getItem('signal_overview') === '1'; } catch { this.show_signal_overview = false; }
        // Übersichtskarte (M): the whole level small, in a corner (level_minimap.js)
        try { this.show_minimap = localStorage.getItem('level_minimap') === '1'; } catch { this.show_minimap = false; }
        // Levelübersicht (L): how the levels are connected (level_map.js). Not remembered:
        // it covers the level, and a child who reloads should see the level.
        this.show_level_map = false;
        // Bereiche (B): thin outlines of every Hintergrund, Signalbereich and
        // Bewegungsbereich, also when another layer is the current one
        try { this.show_regions = localStorage.getItem('level_regions') !== '0'; } catch { this.show_regions = true; }
        // Hervorheben (D): behind the current layer darker, in front of it faint
        try { this.dim_other_layers = localStorage.getItem('level_dim') === '1'; } catch { this.dim_other_layers = false; }
        this.signal_focus_code = null;

        this.texture_loader = new THREE.TextureLoader();
        this.refresh_sprite_widget();

        $('#tool_menu_level_settings').empty();
        // View settings: also in the status bar, with G / S / M / L / A
        // (set_view_option). Small switches in one block with their names on
        // them, so the palette below gets the height.
        this.view_option_widgets = {};
        const view_row = $('<div class="view-toggles">').appendTo($('#tool_menu_level_settings'));
        const view_toggle = (option, label, key, hint) => {
            const button = $('<button type="button" class="view-toggle">').attr('title', `${label} (${key}) – ${hint}`)
                .append($('<span class="view-toggle-dot">')).append($('<span>').text(label)).append($('<span class="key widget-key">').text(key))
                .appendTo(view_row)
                .on('click', () => self.set_view_option(option, !self[option]));
            const widget = { refresh: () => button.toggleClass('active', !!self[option]) };
            widget.refresh();
            this.view_option_widgets[option] = widget;
        };
        view_toggle('show_grid', 'Gitter', 'G', 'Zeigt das Gitter, an dem die Sprites einrasten.');
        view_toggle('show_signal_overview', 'Signale', 'S', 'Zeigt rechts im Level alle Signale als Regeln: Wenn das passiert – dann das. Fährst du mit der Maus über eine Regel, siehst du ihre Verbindungen. Ein Klick auf eine Zeile wählt aus, was dort steht, ein Klick auf den Code zeigt alles mit diesem Code. Was du im Level auswählst, zeigt seine Verbindungen auch ohne Übersicht.');
        view_toggle('show_minimap', 'Karte', 'M', 'Zeigt unten links das ganze Level klein, mit einem Rahmen um das, was du gerade siehst. Klick oder zieh auf der Karte, um dorthin zu springen.');
        view_toggle('show_level_map', 'Levelübersicht', 'L', 'Zeigt alle Level deines Spiels und wohin ihre Ausgänge führen. Ein Klick auf ein Level öffnet es, ein Klick auf einen Pfeil zeigt den Ausgang. Warnungen sagen dir, wenn man ein Level nie erreicht oder nicht mehr herauskommt.');
        view_toggle('show_regions', 'Bereiche', 'B', 'Zeigt die Rechtecke aller Hintergründe, Signalbereiche (gelb) und Bewegungsbereiche (grün) als dünne Linien – auch wenn gerade eine andere Ebene dran ist. Rechtsklick (oder Finger halten) auf einen Bereich: ihn bearbeiten.');
        view_toggle('dim_other_layers', 'Hervorheben', 'D', 'Die Ebene, an der du arbeitest, ist deutlich zu sehen: was dahinter liegt, wird dunkler, was davor liegt, durchsichtig – so siehst du, was zu ihr gehört.');
        view_toggle('animate_level', 'Animieren', 'A', 'Sprites zeigen ihre Animation, und Schnee, Regen, Schwebestaub und die anderen Effekte bewegen sich – schon hier im Level-Editor, so wie später im Spiel. Gezeigt wird bei jedem Sprite sein erster Zustand.');
        // Gittergröße and Gitteroffset change the grid for this session only
        // (the game's Raster is in Einstellungen → Spiel): folded away
        const grid_box = $('<details class="grid-details">').appendTo($('#tool_menu_level_settings'));
        this.grid_summary = $('<summary>').attr('title', 'Gitter nur für jetzt verändern – das Raster des Spiels stellst du unter Einstellungen → Spiel ein.').appendTo(grid_box);
        const grid_fields = $('<div>').appendTo(grid_box);
        this.update_grid_summary = () => this.grid_summary.text(`Gitter ${self.grid_width} × ${self.grid_height}` +
            (self.grid_x || self.grid_y ? `, versetzt ${self.grid_x} : ${self.grid_y}` : ''));
        this.grid_size_widget = new NumberWidget({
            count: 2,
            container: grid_fields,
            connector: $('<span>').css('width', '0.8em').css('text-align', 'center').html('&times;'),
            label: 'Größe',
            width: '1.8em',
            min: [1, 1],
            max: [512, 512],
            get: () => [self.grid_width, self.grid_height],
            set: (width, height) => {
                self.grid_width = width;
                self.grid_height = height;
                self.update_grid_summary();
                self.refresh();
                self.render();
            },
        });
        this.grid_offset_widget = new NumberWidget({
            count: 2,
            container: grid_fields,
            connector: $('<span>').css('width', '0.8em').css('text-align', 'center').html(':'),
            label: 'Versatz',
            width: '1.8em',
            min: [-1024, -1024],
            max: [1024, 1024],
            get: () => [self.grid_x, self.grid_y],
            set: (x, y) => {
                self.grid_x = x;
                self.grid_y = y;
                self.update_grid_summary();
                self.refresh();
                self.render();
            },
        });
        this.update_grid_summary();

        // new CheckboxWidget({
        //     container: $('#tool_menu_level_settings'),
        //     label: 'Kameraansicht',
        //     get: () => self.camera_mode,
        //     set: (x) => {
        //         self.camera_mode = x;
        //         handleResize();
        //         self.refresh();
        //         self.render();
        //     },
        // });

        this.bar_top = $(`<div style='background-color: #000; position: absolute; left: 0; right: 0; top: 0; height: 0px; transition: height 0.5s;'>`).appendTo(this.element);
        this.bar_bottom = $(`<div style='background-color: #000; position: absolute; left: 0; right: 0; bottom: 0; height: 0px; transition: height 0.5s;'>`).appendTo(this.element);
        this.bar_left = $(`<div style='background-color: #000; position: absolute; left: 0; top: 0; bottom: 0; width: 0px; transition: width 0.5s;'>`).appendTo(this.element);
        this.bar_right = $(`<div style='background-color: #000; position: absolute; right: 0; top: 0; bottom: 0; width: 0px; transition: width 0.5s;'>`).appendTo(this.element);

        // let material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        // let points = [];
        // points.push(new THREE.Vector3(0, 10, 2));
        // points.push(new THREE.Vector3(0, 0, 2));
        // points.push(new THREE.Vector3(10, 0, 2));
        // let geometry = new THREE.BufferGeometry().setFromPoints(points);
        // let line = new THREE.Line(geometry, material);
        // this.scene.add(line);

        this.levels_widget = new DragAndDropWidget({
            game: self.game,
            container: $('#menu_levels'),
            trash: $('#trash'),
            items: self.game.data.levels,
            item_class: 'menu_level_item',
            step_aside_css: { top: '35px' },
            context_menu: (index) => self.level_context_menu(index),
            // double-click: rename the level right in the list
            rename: {
                get: (index) => self.game.data.levels[index]?.properties?.name ?? '',
                placeholder: (index) => `Level ${index + 1}`,
                set: (index, name) => self.rename_level(index, name),
            },
            gen_item: (level, index) => {
                let level_div = $(`<div>`);
                let level_label = $(`<div>`);
                level_div.append(level_label);
                this.label_for_level[index] = level_label;
                this.update_level_label(index);
                return level_div;
            },
            onclick: (e, index) => {
                // edits of the level shown so far become an undo step first
                self.history_observe();
                self.clear_selection();
                self.level_index = index;
                self.layer_index = 0;
                self.update_level_settings_head();
                self.rect_index = 0;
                self.auto_adjust_camera = true;

                self.layer_structs = [];
                for (let layer of self.game.data.levels[self.level_index].layers) {
                    let layer_struct = new LayerStruct(self);
                    layer_struct.apply_layer(layer);
                    self.layer_structs.push(layer_struct);
                }
                // "in diesem Level" means this level now
                if (self.palette_filter?.kind === 'used') self.palette_filter.apply();

                $('#menu_level_properties').empty();
                new LineEditWidget({
                    container: $('#menu_level_properties'),
                    label: 'Titel',
                    hint: 'Der Name des Levels. Die Spieler sehen ihn, wenn das Level beginnt.',
                    placeholder: () => `Level ${self.level_index + 1}`,
                    get: () => self.game.data.levels[self.level_index].properties.name,
                    set: (x) => {
                        self.game.data.levels[self.level_index].properties.name = x;
                        self.update_level_label();
                    },
                });

                new CheckboxWidget({
                    container: $('#menu_level_properties'),
                    label: 'Level verwenden',
                    get: () => self.game.data.levels[self.level_index].properties.use_level,
                    set: (x) => {
                        self.game.data.levels[self.level_index].properties.use_level = x;
                        self.update_level_label();
                    },
                });

                // Nebenlevel (level_flow.js): absent = part of the order, as always
                new CheckboxWidget({
                    container: $('#menu_level_properties'),
                    label: 'Nebenlevel',
                    hint: 'Ein Nebenlevel ist ein Laden, ein Bonuslevel oder ein Geheimraum: Man kommt nur durch einen Ausgang hinein, der „führt zu“ genau dieses Level hat. Nach dem Level davor geht es nicht hier weiter, sondern mit dem nächsten Level der Liste. Ein Ausgang im Nebenlevel führt zurück, woher man kam – außer du wählst bei ihm etwas anderes.',
                    get: () => self.game.data.levels[self.level_index].properties.side_level === true,
                    set: (x) => {
                        const properties = self.game.data.levels[self.level_index].properties;
                        if (x) properties.side_level = true; else delete properties.side_level;
                        self.update_level_label();
                        // "führt zu" of the exits means something else now
                        self.placed_properties_for = null;
                        self.refresh();
                    },
                });

                new ColorWidget({
                    container: $('#menu_level_properties'),
                    label: 'Hintergrundfarbe',
                    get: () => self.game.data.levels[self.level_index].properties.background_color,
                    set: (x) => {
                        self.game.data.levels[self.level_index].properties.background_color = x;
                        self.refresh();
                        self.render();
                    },
                });

                // Signale: "alle Gegner besiegt" (absent = the level sends nothing)
                self.add_all_defeated_controls($('<div>').appendTo($('#menu_level_properties')));
                self.add_level_start_controls($('<div>').appendTo($('#menu_level_properties')));
                // only in games with something that "bleibt fürs ganze Spiel" (inventory.js)
                self.add_item_signal_controls($('<div>').appendTo($('#menu_level_properties')));
                self.add_level_complete_controls($('<div>').appendTo($('#menu_level_properties')));

                // Bewegung im ganzen Level (movement_regions.js): absent = as always
                const movement_box = $('<div>').appendTo($('#menu_level_properties'));
                self.add_movement_controls(movement_box, null, true);

                new LineEditWidget({
                    container: $('#menu_level_properties'),
                    label: 'Youtube',
                    get: () => self.game.data.levels[self.level_index].properties.yt_tag,
                    set: (x) => {
                        self.game.data.levels[self.level_index].properties.yt_tag = x;
                    },
                });

                // new LineEditWidget({
                //     container: $('#menu_level_properties'),
                //     label: 'Höhe in Pixeln:',
                //     hint: 'So viele Pixel hoch ist der Bildausschnitt.',
                //     min: 16,
                //     max: 1080,
                //     get: () => self.game.data.levels[self.level_index].properties.screen_pixel_height,
                //     set: (x) => {
                //         self.game.data.levels[self.level_index].properties.screen_pixel_height = x;
                //     },
                // });

                self.layers_widget = new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_layers'),
                    trash: $('#trash'),
                    items: self.game.data.levels[self.level_index].layers,
                    item_class: 'menu_layer_item',
                    context_menu: (index) => self.layer_context_menu(index),
                    rename: {
                        get: (index) => self.game.data.levels[self.level_index].layers[index]?.properties?.name ?? '',
                        placeholder: (index) => `Ebene ${index + 1}`,
                        set: (index, name) => self.rename_layer(index, name),
                    },
                    // a locked layer cannot be thrown away (the trash does not appear)
                    can_delete_index: (index) => !self.layer_locked(index),
                    step_aside_css: { top: '35px' },
                    gen_new_item_options: [
                        ['Sprites', 'sprites'],
                        ['Hintergrund', 'backdrop'],
                        ['Signalbereich', 'signal_area'],
                        ['Bewegungsbereich', 'movement_region'],
                        // ['Text', 'text'],
                    ],
                    gen_item: (layer, index) => {
                        let type = layer.type;
                        let layer_div = $(`<div>`).css('padding-top', '4px');
                        let button_show = $(`<div class='toggle' style='margin-left: 1px; position: relative; top: -2px;'>`);
                        if (self.game.data.levels[self.level_index].layers[index].properties.visible) {
                            button_show.append($(`<i class='fa fa-eye'>`));
                        } else {
                            button_show.append($(`<i class='fa fa-eye-slash'>`));
                        }
                        button_show.click(function(e) {
                            let button = $(e.target).closest('.toggle');
                            let item = button.closest('.menu_layer_item').parent();
                            let layer_index = item.index();
                            self.game.data.levels[self.level_index].layers[layer_index].properties.visible = !self.game.data.levels[self.level_index].layers[layer_index].properties.visible;
                            if (self.game.data.levels[self.level_index].layers[layer_index].properties.visible) {
                                button.find('i').removeClass('fa-eye-slash').addClass('fa-eye');
                            } else {
                                button.find('i').removeClass('fa-eye').addClass('fa-eye-slash');
                            }
                            e.stopPropagation();
                            self.clear_selection();
                            self.refresh();
                            self.render();
                        });
                        layer_div.append(button_show);
                        // Ebene sperren: nothing can be painted, moved or deleted in it by accident
                        const locked = layer.properties.locked === true;
                        const button_lock = $(`<div class='toggle layer-lock' style='margin-left: 3px; position: relative; top: -2px;'>`)
                            .toggleClass('locked', locked)
                            .attr('title', locked ? 'Ebene ist gesperrt – klicken zum Entsperren' :
                                'Ebene sperren: Dann kannst du darin nichts mehr aus Versehen malen, löschen oder verschieben.')
                            .append($(`<i class='fa ${locked ? 'fa-lock' : 'fa-unlock'}'>`));
                        button_lock.click(function(e) {
                            e.stopPropagation();
                            const layer_index = $(e.target).closest('.menu_layer_item').parent().index();
                            const properties = self.game.data.levels[self.level_index].layers[layer_index].properties;
                            // absent = not locked: unlocking leaves no trace
                            if (properties.locked === true) delete properties.locked; else properties.locked = true;
                            const now = properties.locked === true;
                            const button = $(e.target).closest('.toggle');
                            button.toggleClass('locked', now).attr('title', now ? 'Ebene ist gesperrt – klicken zum Entsperren' :
                                'Ebene sperren: Dann kannst du darin nichts mehr aus Versehen malen, löschen oder verschieben.');
                            button.find('i').toggleClass('fa-lock', now).toggleClass('fa-unlock', !now);
                            // unlocked: an old "ist gesperrt" notice is no longer true
                            if (!now) $(self.element).find('.level-notice').removeClass('showing');
                            self.backdrop_controls_setup_for = null;   // rectangle handles appear or go
                            self.placed_properties_for = null;
                            self.refresh();
                            self.render();
                        });
                        layer_div.append(button_lock);
                        if (type === 'sprites') {
                            let sprite_count = $(`<span>`).text(`${layer.sprites.length}`);
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Sprites (')).append(sprite_count).append($('<span>').text(') · ')));
                            self.layer_structs[index].el_sprite_count = sprite_count;
                        } else if (type === 'backdrop') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Hintergrund · '));
                        } else if (type === 'signal_area') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Signalbereich · '));
                        } else if (type === 'movement_region') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Bewegungsbereich · '));
                        } else if (type === 'text') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Text · '));
                        }
                        layer_div.append($('<span class="layer-name">').text(layer.properties.name || `Ebene ${index + 1}`)
                            .toggleClass('unnamed', !String(layer.properties.name ?? '').trim()));
                        return layer_div;
                    },
                    onclick: (e, index) => {
                        self.history_observe();
                        self.clear_selection();
                        self.layer_index = index;
                        // the hint of the selection panel depends on the layer
                        $('#menu_placed_properties').empty();
                        self.rect_index = 0;
                        self.backdrop_controls_setup_for = null;
                        if (self.game.data.levels[self.level_index].layers[self.layer_index].type !== 'sprites') {
                            menus.level.blur();
                        } else if (menus.level.active_key === null) {
                            // back from a Hintergrund layer (which switched the
                            // tools off for its handles): the tool from before
                            menus.level.handle_click(menus.level.groups.tool?.active ?? 'tool/pan');
                        }
                        if (['backdrop', 'signal_area', 'movement_region'].includes(self.game.data.levels[self.level_index].layers[self.layer_index].type)) {
                            self.refresh_backdrop_controls();
                        }
                        self.setup_layer_properties();
                        $('#menu_layer_properties_container').show();
                        self.refresh();
                        self.render();
                        // the layer panel fills in missing settings (Bewegung)
                        self.history_rebase();
                    },
                    gen_new_item: (type) => {
                        // a new Sprites or Hintergrund layer goes in front of the
                        // Hintergründe at the back (the sky): behind them nobody would see it
                        const level_layers = self.game.data.levels[self.level_index].layers;
                        let at = level_layers.length;
                        if (type === 'sprites' || type === 'backdrop')
                            while (at > 0 && level_layers[at - 1].type === 'backdrop') at--;
                        let layer_struct = new LayerStruct(self);
                        self.layer_structs.splice(at, 0, layer_struct);
                        let layer = { type: type };
                        if (type === 'signal_area') {
                            const level = self.game.data.levels[self.level_index];
                            let count = level.layers.filter(x => x.type === type).length + 1;
                            // a Code nothing else uses yet, so it does not start anything by itself
                            layer.properties = { name: `Signalbereich ${count}`, signal_code: free_signal_code(level) };
                        }
                        if (type === 'movement_region') {
                            let count = self.game.data.levels[self.level_index].layers.filter(x => x.type === type).length + 1;
                            layer.properties = { name: `Bewegungsbereich ${count}` };
                            layer.movement = { mode: 'swim' };
                        }
                        if (type === 'sprites' || type === 'backdrop') {
                            // "Ebene 3", "Hintergrund 2": a name to start with (default_names.js)
                            const word = type === 'sprites' ? 'Ebene' : 'Hintergrund';
                            const names = self.game.data.levels[self.level_index].layers.map(x => x.properties?.name);
                            if (typeof next_default_name === 'function')
                                layer.properties = { ...(layer.properties ?? {}), name: next_default_name(names.filter(n => String(n ?? '').startsWith(word)), word,
                                    self.game.data.levels[self.level_index].layers.filter(x => x.type === type).length + 1) };
                        }
                        if (type === 'sprites') {
                            layer.sprites = [];
                        } else if (type === 'backdrop' || type === 'signal_area' || type === 'movement_region') {
                            let x0 = Math.round(self.camera_x - self.width * 0.45 / self.scale);
                            let x1 = Math.round(self.camera_x + self.width * 0.45 / self.scale);
                            let y0 = Math.round(self.camera_y - self.height * 0.45 / self.scale);
                            let y1 = Math.round(self.camera_y + self.height * 0.45 / self.scale);
                            let rect = { left: x0, bottom: y0, width: x1 - x0, height: y1 - y0 };
                            layer.rects = [rect];
                        }
                        self.game.data.levels[self.level_index].layers.splice(at, 0, layer);
                        self.game.fix_game_data();
                        self.refresh();
                        self.render();
                        return self.game.data.levels[self.level_index].layers[at];
                    },
                    delete_item: (index) => {
                        self.game.data.levels[self.level_index].layers.splice(index, 1);
                        self.layer_structs.splice(index, 1);
                        self.layer_index = 0;
                        self.rect_index = 0;
                        self.refresh();
                        // self.render();
                    },
                    on_move_item: (from, to) => {
                        move_item_helper(self.game.data.levels[self.level_index].layers, from, to);
                        move_item_helper(self.layer_structs, from, to);
                        self.refresh();
                        self.render();
                    }
                });

                self.refresh();
                self.render();
                // showing a level may tidy it up (sprites that no longer exist):
                // that is not an edit to undo
                self.history_rebase();
            },
            gen_new_item: () => {
                const level = {};
                assign_new_game_id(self.game.data, 'levels', level);
                self.game.data.levels.push(level);
                self.game.fix_game_data();
                window.collaboration?.structure_changed?.('level', 'insert', level.id);
                self.record_level_list('insert', level.id, self.game.data.levels.length - 1);
                return self.game.data.levels[self.game.data.levels.length - 1];
            },
            can_delete_index: (index) => window.collaboration?.can_delete?.('level', self.game.data.levels[index]?.id) ?? true,
            delete_item: (index) => {
                // Strg+Z brings it back, also after the trash's own offer has ended
                self.record_level_list('remove', self.game.data.levels[index]?.id, index, JSON.stringify(self.game.data.levels[index]));
                const [deleted] = self.game.data.levels.splice(index, 1);
                self.label_for_level.splice(index, 1);
                self.level_index = 0;
                window.collaboration?.structure_changed?.('level', 'delete', deleted?.id);
            },
            on_move_item: (from, to) => {
                move_item_helper(self.game.data.levels, from, to);
                move_item_helper(self.label_for_level, from, to);
                window.collaboration?.structure_changed?.('level', 'move', self.game.data.levels[to]?.id);
                self.record_level_list('move', self.game.data.levels[to]?.id, from, to);
            }
        });

        this.update_level_label();
        this.refresh();
        menus.level.handle_click('tool/pan');
        this.refresh();
        this.render();

        $(this.element).off();

        // right-click: a menu of what can be done with the sprite under the
        // mouse or with the selection (the pen erases instead, Verbinden stops)
        $(this.element).on('contextmenu', function (e) {
            self.handle_context_menu(e);
            return false;
        });
        $(this.element).on('mouseenter', (e) => self.handle_enter(e));
        $(this.element).on('mouseleave', (e) => self.handle_leave(e));
        $(this.element).on('mousedown touchstart', (e) => self.handle_down(e));
        // select tool: double-click picks a sprite in whichever layer it is
        $(this.element).on('dblclick', (e) => self.handle_double_click(e));
        // every loaded game makes a new LevelEditor: the one before must stop
        // listening, or it keeps handling the mouse with its old level index
        // (a game with fewer levels then threw on every mouse move)
        $(window).off('.level_editor_pointer');
        $(window).on('mouseup.level_editor_pointer touchend.level_editor_pointer', (e) => self.handle_up(e));
        $(window).on('mousemove.level_editor_pointer touchmove.level_editor_pointer', (e) => self.handle_move(e));
        $(this.element).on('wheel', function (e) {
            e.preventDefault();
            let p = self.ui_to_world(self.get_touch_point(e), false);
            self.zoom_at_point(e.originalEvent.deltaY, p[0], p[1]);
            if (self.backdrop_index !== null) {
                self.refresh_backdrop_controls();
            }
            self.refresh();
            self.render();
        });
        this.handleResize();
    }

    // ---------------------------------------- Rückgängig / Wiederholen
    // level_history.js keeps the versions; here: when to look, and how to
    // show an older version.
    current_history_level() {
        return this.game.data?.levels?.[this.level_index] ?? null;
    }

    history_observe() {
        const level = this.current_history_level();
        if (!level?.id || !this.game.level_history) return;
        this.game.level_history.observe(level.id, JSON.stringify(level));
        this.update_history_buttons();
    }

    history_rebase() {
        const level = this.current_history_level();
        if (!level?.id || !this.game.level_history) return;
        this.game.level_history.rebase(level.id, JSON.stringify(level));
        this.update_history_buttons();
    }

    undo() {
        this.step_history('undo');
    }

    redo() {
        this.step_history('redo');
    }

    // Strg+Z / Strg+Y: whatever happened last – a step of the level shown, or
    // a change of the level list (level_list_history.js: a new, duplicated,
    // deleted or moved level)
    step_history(direction) {
        const level = this.current_history_level();
        const history = this.game.level_history;
        // not in the middle of a drag, and not while somebody else edits this level
        if (!level?.id || !history || this.mouse_down) return;
        if (window.collaboration?.can_edit_current?.() === false) return;
        history.observe(level.id, JSON.stringify(level));
        const list = this.level_list_history();
        if (list) {
            const list_seq = direction === 'undo' ? list.last_undo_seq(this.game.data) : list.last_redo_seq(this.game.data);
            const level_seq = direction === 'undo' ? history.last_undo_seq(level.id) : history.last_redo_seq(level.id);
            if (list_seq > level_seq) {
                this.step_level_list(direction);
                return;
            }
        }
        const serialized = history[direction](level.id, JSON.stringify(level));
        if (serialized !== null) {
            this.game.data.levels[this.level_index] = JSON.parse(serialized);
            this.reload_level_keeping_view(this.level_index);
        }
        this.update_history_buttons();
    }

    // The level list's history – not in a live session (there the change
    // has reached the others already).
    level_list_history() {
        if (window.collaboration?.code || typeof window === 'undefined') return null;
        return window.level_list_history ?? null;
    }

    record_level_list(kind, ...args) {
        this.level_list_history()?.[`record_${kind}`]?.(...args, this.game.data);
        this.update_history_buttons();
    }

    step_level_list(direction) {
        const result = this.level_list_history()[direction](game_level_list_ops(this.game), this.game.data);
        if (!result) return;
        const levels = this.game.data.levels;
        let index = result.show ? levels.findIndex(l => l.id === result.show) : result.show_index;
        index = Math.max(0, Math.min(index ?? 0, levels.length - 1));
        // the level shown so far may be gone: nothing may look at it any more
        this.selection = [];
        this.level_index = index;
        this.layer_index = 0;
        this.label_for_level = [];
        this.levels_widget.rebuild();
        this.levels_widget.select_index(index);
        this.refresh_level_map?.();
        this.show_level_notice?.(result.text, 2500);
        this.update_history_buttons();
    }

    update_history_buttons() {
        if (typeof $ === 'undefined') return;
        const id = this.current_history_level()?.id;
        const history = this.game.level_history;
        const list = this.level_list_history();
        $('#status-bar .level-history-undo').toggleClass('disabled', !history?.can_undo(id) && !list?.last_undo_seq(this.game.data));
        $('#status-bar .level-history-redo').toggleClass('disabled', !history?.can_redo(id) && !list?.last_redo_seq(this.game.data));
    }

    // Shows the level again after its data was replaced (undo, or a change
    // from a collaboration session), keeping the camera and the selected layer.
    reload_level_keeping_view(index) {
        const view = {
            camera_x: this.camera_x, camera_y: this.camera_y,
            visible_pixels: this.visible_pixels, layer_index: this.layer_index,
        };
        $('#menu_levels > ._dnd_item').eq(index).children().eq(0).trigger('click');
        if (this.level_index !== index) return;
        this.auto_adjust_camera = false;
        this.camera_x = view.camera_x;
        this.camera_y = view.camera_y;
        this.visible_pixels = view.visible_pixels;
        this.fix_scale?.();
        const layers = this.game.data.levels[index]?.layers ?? [];
        if (view.layer_index > 0 && view.layer_index < layers.length)
            $('#menu_layers > ._dnd_item').eq(view.layer_index).children().eq(0).trigger('click');
        // Showing the level fitted the camera to its sprites and drew the grid
        // (and backdrop handles) for that view: draw them again for the old one.
        this.backdrop_controls_setup_for = null;
        this.refresh();
        this.render();
    }

    // The panel of the selection says what it is for while nothing is selected.
    show_placed_hint() {
        const layer = this.game.data.levels[this.level_index]?.layers[this.layer_index];
        const hint = $('<div class="placed-hint">').appendTo($('#menu_placed_properties'));
        if (layer && layer.type !== 'sprites') {
            hint.html('Diese Ebene hat keine Sprites. Ihre Einstellungen stehen oben – die Rechtecke ziehst du im Level an ihren Griffen größer oder kleiner.');
            return;
        }
        hint.html('Klick mit <b>Auswählen (E)</b> auf ein Sprite im Level – hier stehen dann seine Einstellungen.<br><br>' +
            '<b>Rechtsklick</b> auf ein Sprite zeigt, was du damit machen kannst: kopieren, löschen, in eine andere Ebene schieben, im Sprite-Editor bearbeiten …');
    }

    update_placed_title() {
        const layer = this.current_sprite_layer();
        const count = this.selection.length;
        if (!layer || !count) { $('#placed_properties_title').text('Auswahl'); return; }
        if (count === 1) {
            const placed = layer.sprites[this.selection[0]];
            const si = placed ? this.game.sprite_index_for_ref(placed[0]) : null;
            $('#placed_properties_title').text(si !== null ? `Auswahl: ${sprite_label(this.game.data.sprites[si], si)}` : 'Auswahl');
        } else $('#placed_properties_title').text(`Auswahl: ${count} Sprites`);
    }

    // ------------------------------------------------ the right-click menu
    // With Auswählen and Verschieben (Q): on a sprite, it is selected first
    // (in whichever layer it lies, like a double-click) and the menu shows what
    // can be done with it; on the selection, with all of it; on empty ground,
    // with the layer and the level. The pen erases with the right button and
    // Verbinden stops with it, so they have no menu.
    handle_context_menu(e) {
        if (current_pane !== 'level') return;
        const tool = menus.level.active_key;
        // Verbinden: the right button stops connecting; every other tool: the menu
        if (tool === 'tool/connect') return;
        const touch = this.get_touch_point(e);
        const [wx, wy] = this.ui_to_world(touch, false);
        const layer = this.current_sprite_layer();
        if (!(layer && this.selection.length && this.selection_point_inside(wx, wy))) {
            const pick = this.pick_for_menu(touch);
            if (pick) {
                if (tool !== 'tool/select') menus.level.handle_click('tool/select');
                if (pick.layer_index !== this.layer_index)
                    $('#menu_layers > ._dnd_item').eq(pick.layer_index).children().eq(0).trigger('click');
                this.selection = [pick.placed_index];
                this.placed_properties_for = null;
                this.show_selection();
                this.refresh();
                this.render();
            } else if (this.selection.length) {
                this.clear_selection();
            }
        }
        const entries = this.selection.length ? this.selection_menu(touch) : this.ground_menu(touch);
        show_context_menu(e.clientX, e.clientY, entries);
    }

    // The sprite under the screen point: in the current layer first (the
    // topmost there), else in any visible layer (placed_sprites_at).
    pick_for_menu(touch) {
        const level = this.game.data.levels[this.level_index];
        if (this.current_sprite_layer()?.properties?.visible !== false) {
            const [wx, wy] = this.ui_to_world(touch, false);
            const index = this.topmost_placed_at(wx, wy);
            if (index >= 0) return { layer_index: this.layer_index, placed_index: index };
        }
        const point_of = (li) => {
            const parallax = level.layers[li]?.properties?.parallax ?? 0;
            return [this.camera_x + (touch[0] - this.width / 2) / this.scale - this.camera_x * parallax,
                this.camera_y - (touch[1] - this.height / 2) / this.scale - this.camera_y * parallax];
        };
        const size_of = (ref) => this.game.data.sprites[this.game.sprite_index_for_ref(ref)] ?? null;
        return next_pick(placed_sprites_at(level.layers, point_of, size_of), null) ?? null;
    }

    layer_menu_entries() {
        const layer = this.game.data.levels[this.level_index]?.layers[this.layer_index];
        if (!layer) return [];
        const locked = layer.properties?.locked === true;
        return [
            { label: locked ? 'Ebene entsperren' : 'Ebene sperren', icon: locked ? 'fa-unlock' : 'fa-lock',
                hint: 'In einer gesperrten Ebene kannst du nichts aus Versehen malen, löschen oder verschieben.',
                callback: () => $('#menu_layers > ._dnd_item').eq(this.layer_index).find('.layer-lock').trigger('click') },
            { label: 'Ebene ausblenden', icon: 'fa-eye-slash',
                hint: 'Nur hier im Editor – mit dem Auge in der Liste der Ebenen zeigst du sie wieder.',
                callback: () => $('#menu_layers > ._dnd_item').eq(this.layer_index).find('.toggle').not('.layer-lock').first().trigger('click') },
        ];
    }

    selection_menu(touch) {
        const layer = this.current_sprite_layer();
        const count = this.selection.length;
        const level = this.game.data.levels[this.level_index];
        const layer_name = layer?.properties?.name || `Ebene ${this.layer_index + 1}`;
        const first = layer?.sprites[this.selection[0]];
        const si = first ? this.game.sprite_index_for_ref(first[0]) : null;
        const label = count === 1 && si !== null ? sprite_label(this.game.data.sprites[si], si) : `${count} Sprites`;
        const read_only = this.read_only_level();
        const same = layer ? same_sprite_indices(layer.sprites, this.selection).length : 0;
        const others = level.layers.map((l, li) => ({ l, li })).filter(({ l, li }) => l.type === 'sprites' && li !== this.layer_index);
        const signal = count === 1 && first ? this.signal_object_for_placed(this.layer_index, this.selection[0]) : null;
        return [
            { header: `${label} · Ebene »${layer_name}«` },
            { label: 'Ausschneiden', icon: 'fa-scissors', key: 'Strg+X', disabled: read_only, callback: () => this.cut_selection() },
            { label: 'Kopieren', icon: 'fa-files-o', key: 'Strg+C', callback: () => this.copy_selection() },
            { label: 'Einfügen', icon: 'fa-clipboard', key: 'Strg+V', disabled: !window.level_clipboard || read_only,
                hint: window.level_clipboard ? null : 'Erst etwas kopieren (Strg+C).', callback: () => this.paste_at(touch) },
            { label: 'Duplizieren', icon: 'fa-clone', key: 'Strg+D', disabled: read_only, callback: () => this.duplicate_selection() },
            { label: 'Löschen', icon: 'fa-trash', key: 'Entf', disabled: read_only, callback: () => this.delete_selection() },
            '-',
            { label: same > count ? `Alle gleichen auswählen (${same})` : 'Alle gleichen auswählen', icon: 'fa-object-group', disabled: same <= count,
                hint: same > count ? 'Alle Sprites dieser Ebene, die so aussehen wie die ausgewählten.' : 'In dieser Ebene gibt es keine weiteren davon.',
                callback: () => this.select_same_sprites() },
            { label: 'Ersetzen durch …', icon: 'fa-exchange', disabled: read_only, hint: 'Die ausgewählten Sprites werden zu einem anderen Sprite, jedes an seinem Platz.',
                callback: () => this.open_replace_picker() },
            { label: 'In Ebene', icon: 'fa-clone', disabled: read_only || !others.length, empty: 'keine andere Sprite-Ebene',
                hint: others.length ? null : 'Es gibt keine andere Sprite-Ebene.',
                children: others.map(({ l, li }) => ({ label: l.properties?.name || `Ebene ${li + 1}`, callback: () => this.move_selection_to_layer(li) })) },
            { label: 'Nach vorne holen', icon: 'fa-arrow-up', disabled: read_only, hint: 'Vor alle anderen Sprites dieser Ebene.',
                callback: () => this.reorder_selection('front') },
            { label: 'Nach hinten schicken', icon: 'fa-arrow-down', disabled: read_only, hint: 'Hinter alle anderen Sprites dieser Ebene.',
                callback: () => this.reorder_selection('back') },
            '-',
            { label: 'Im Sprite-Editor bearbeiten', icon: 'fa-paint-brush', disabled: si === null,
                hint: 'Das Bild dieses Sprites malen – alle Kopien im Spiel ändern sich mit.',
                callback: () => this.edit_sprite_in_sprite_editor(si) },
            ...(signal ? [{ label: 'Verbinden …', icon: 'fa-link', key: 'R', disabled: read_only,
                hint: 'Mit einem Signal verbinden: Klick danach auf das, was reagieren soll (oder was es auslöst).',
                callback: () => this.start_connect_from(signal) }] : []),
            { label: 'Hier testen', icon: 'fa-play', key: 'T', callback: () => this.start_playtest(touch) },
            ...this.region_menu_entries(touch),
            '-',
            ...this.layer_menu_entries(),
        ];
    }

    ground_menu(touch) {
        const layer = this.game.data.levels[this.level_index]?.layers[this.layer_index];
        const sprites_layer = layer?.type === 'sprites';
        const read_only = this.read_only_level();
        return [
            { header: `Ebene »${layer?.properties?.name || `Ebene ${this.layer_index + 1}`}«` },
            { label: 'Einfügen', icon: 'fa-clipboard', key: 'Strg+V', disabled: !window.level_clipboard || !sprites_layer || read_only,
                hint: !window.level_clipboard ? 'Erst etwas kopieren (Strg+C).' : !sprites_layer ? 'Nur in eine Sprite-Ebene.' : 'Hier einfügen.',
                callback: () => this.paste_at(touch) },
            { label: 'Alles in dieser Ebene auswählen', icon: 'fa-object-group', key: 'Strg+A', disabled: !sprites_layer || !layer.sprites.length,
                callback: () => { if (menus.level.active_key !== 'tool/select') menus.level.handle_click('tool/select'); this.select_all(); } },
            '-',
            { label: 'Hier testen', icon: 'fa-play', key: 'T', hint: 'Das Level spielen – die Spielfigur beginnt hier.', callback: () => this.start_playtest(touch) },
            { label: 'Ganzes Level zeigen', icon: 'fa-arrows-alt', hint: 'Zoomt so, dass alles zu sehen ist.', callback: () => this.show_whole_level() },
            ...this.region_menu_entries(touch),
            '-',
            ...this.layer_menu_entries(),
        ];
    }

    // The Hintergründe, Signalbereiche and Bewegungsbereiche here: one entry
    // each to edit that rectangle (its layer becomes the current one).
    region_menu_entries(touch) {
        const level = this.game.data.levels[this.level_index];
        const kinds = { backdrop: ['Hintergrund', 'fa-picture-o'], signal_area: ['Signalbereich', 'fa-bolt'], movement_region: ['Bewegungsbereich', 'fa-tint'] };
        const entries = this.regions_at(touch)
            .filter(({ li, ri }) => !(li === this.layer_index && ri === this.rect_index && menus.level.active_key === null))
            .map(({ li, ri }) => {
                const layer = level.layers[li];
                const [kind, icon] = kinds[layer.type];
                const name = layer.properties?.name || `Ebene ${li + 1}`;
                return { label: `${kind} »${name}« bearbeiten`, icon, hint: (layer.rects?.length ?? 0) > 1 ? `Rechteck ${ri + 1}` : null,
                    callback: () => this.edit_region(li, ri) };
            });
        return entries.length ? ['-', ...entries] : [];
    }

    // Einfügen from the menu: where the menu was opened.
    paste_at(touch) {
        const before = { inside: this.pointer_inside, raw: this.pointer_world_raw };
        this.pointer_inside = true;
        this.pointer_world_raw = touch;
        this.paste_clipboard();
        this.pointer_inside = before.inside;
        this.pointer_world_raw = before.raw;
    }

    reorder_selection(where) {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length || this.read_only_level() || this.refuse_locked_layer()) return;
        const result = reorder_placed(layer.sprites, this.selection, where);
        this.set_layer_sprites(this.layer_index, result.sprites, result.selection);
    }

    open_replace_picker() {
        this.placed_properties_for = null;
        this.refresh();
        $('#menu_placed_properties .selection-replace').show();
        $('#menu_placed_properties')[0]?.scrollTo?.({ top: 0 });
        this.show_level_notice?.('Wähle rechts unter „Auswahl“ das neue Sprite.');
    }

    edit_sprite_in_sprite_editor(si) {
        if (si === null || si === undefined) return;
        if (window.studio_show_pane?.('sprites')) studio_history_push?.({ pane: 'sprites' });
        canvas.switchToSprite(si);
    }

    show_whole_level() {
        this.auto_adjust_camera = true;
        this.refresh();
        this.render();
    }

    // The Signale object of a placed sprite, if it sends or reacts (signals.js).
    signal_object_for_placed(layer_index, placed_index) {
        const level = this.game.data.levels[this.level_index];
        const placed = level.layers[layer_index]?.sprites?.[placed_index];
        const sprite = placed ? this.game.data.sprites[this.game.sprite_index_for_ref(placed[0])] : null;
        if (!sprite) return null;
        const { traits_of, size_of } = this.signal_context();
        const x = placed[1], y = placed[2] + sprite.height / 2;
        const picked = pick_signal_object(level, x, y, traits_of, size_of, layer_index, 'sender');
        return picked?.kind === 'sprite' && picked.layer_index === layer_index && picked.placed_index === placed_index ? picked : null;
    }

    start_connect_from(object) {
        menus.level.handle_click('tool/connect');
        this.connect_from = object;
        const placed = this.game.data.levels[this.level_index].layers[object.layer_index]?.sprites?.[object.placed_index];
        this.connect_pointer = object.anchor ? { ...object.anchor } : (placed ? { x: placed[1], y: placed[2] } : null);
        this.show_level_notice?.('Klick jetzt auf das, was damit verbunden werden soll. Rechtsklick bricht ab.');
        this.refresh();
        this.render();
    }

    // The heads of the folding settings panels name what they belong to.
    update_layer_settings_head() {
        const layer = this.game.data.levels[this.level_index]?.layers[this.layer_index];
        if (!layer) return;
        $('#layer_settings_head').text(`Einstellungen der Ebene »${layer.properties?.name || `Ebene ${this.layer_index + 1}`}«`);
    }

    update_level_settings_head() {
        $('#level_settings_head').text(`Einstellungen von »${level_display_name(this.game.data.levels, this.level_index)}«`);
    }

    // ------------------------------------------------ working with a selection
    // level_selection.js does the work on the data; here: showing it, the
    // mouse and the keys. The clipboard lives as long as the studio page, so
    // sprites can be copied from one level or layer to another.
    current_sprite_layer() {
        const layer = this.game.data.levels[this.level_index]?.layers[this.layer_index];
        return layer?.type === 'sprites' ? layer : null;
    }

    // The lookup of the current layer (LayerStruct), built from the layer as
    // it is in the game now. A level put in from elsewhere (Gemeinsam
    // bearbeiten) is a new object: a lookup still built from the old one
    // would erase or place by positions of sprites that are no longer there.
    current_layer_struct() {
        const struct = this.layer_structs[this.layer_index];
        const layer = this.current_sprite_layer();
        if (struct && layer && struct.layer !== layer) struct.apply_layer(layer);
        return struct;
    }

    // Outlines around the selected sprites (dx, dy: while they are dragged).
    show_selection(dx = 0, dy = 0) {
        const group = this.selection_group;
        group.remove.apply(group, group.children);
        const layer = this.current_sprite_layer();
        if (!layer) return;
        const material = this.layer_structs[this.layer_index]?.selectionMaterial ??
            new THREE.LineBasicMaterial({ color: 0xffffff });
        for (const index of this.selection) {
            const placed = layer.sprites[index];
            const sprite = placed && this.game.data.sprites[this.game.sprite_index_for_ref(placed[0])];
            if (!sprite) continue;
            const x0 = placed[1] - sprite.width / 2 + dx, x1 = placed[1] + sprite.width / 2 + dx;
            const y0 = placed[2] + dy, y1 = placed[2] + sprite.height + dy;
            const points = [[x0, y0], [x0, y1], [x1, y1], [x1, y0]].map(([x, y]) => new THREE.Vector3(x, y, 1));
            group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
        }
    }

    // Puts a changed sprites array into layer li and shows it, selecting `selection`.
    set_layer_sprites(li, sprites, selection = []) {
        const layer = this.game.data.levels[this.level_index].layers[li];
        layer.sprites = sprites;
        this.layer_structs[li]?.apply_layer(layer);
        if (li === this.layer_index) this.selection = selection;
        this.placed_properties_for = null;
        this.show_selection();
        this.refresh();
        this.render();
    }

    selection_point_inside(x, y) {
        const layer = this.current_sprite_layer();
        return !!layer && this.selection.some(index => {
            const placed = layer.sprites[index];
            const sprite = placed && this.game.data.sprites[this.game.sprite_index_for_ref(placed[0])];
            return sprite && x >= placed[1] - sprite.width / 2 && x <= placed[1] + sprite.width / 2 &&
                y >= placed[2] && y <= placed[2] + sprite.height;
        });
    }

    // Dragging the selection: the meshes follow the mouse in whole grid
    // steps (with Shift pixel by pixel); the data changes on release.
    preview_selection_move(dx, dy) {
        const layer = this.current_sprite_layer();
        const struct = this.layer_structs[this.layer_index];
        if (!layer || !struct) return;
        for (const index of this.selection) {
            const placed = layer.sprites[index];
            const mesh = placed && struct.mesh_for_pos[`${placed[1]}/${placed[2]}`];
            if (mesh) mesh.position.set(placed[1] + dx, placed[2] + dy, mesh.position.z);
        }
        this.show_selection(dx, dy);
        this.render();
    }

    // The grid as level_selection.js expects it (sprites stand on its points).
    selection_grid() {
        return { width: this.grid_width, height: this.grid_height, x: this.grid_x, y: this.grid_y };
    }

    // Half a grid step: where duplicates and pasted copies go (duplicate_offset).
    duplicate_step() {
        return [Math.max(1, Math.round(this.grid_width / 2)), Math.max(1, Math.round(this.grid_height / 2))];
    }

    nudge_selection(dx, dy) {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length || this.read_only_level() || this.refuse_locked_layer()) return;
        const moved = move_placed(layer.sprites, this.selection, dx, dy);
        this.set_layer_sprites(this.layer_index, moved.sprites, moved.selection);
    }

    copy_selection() {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length) return false;
        window.level_clipboard = copy_placed(layer.sprites, this.selection);
        // the names of their Codes travel along (pasting into another level)
        if (window.level_clipboard)
            window.level_clipboard.signal_names = signal_names_for_placed(this.game.data.levels[this.level_index], window.level_clipboard.items);
        this.show_level_notice?.(`${this.selection.length === 1 ? '1 Sprite' : `${this.selection.length} Sprites`} kopiert – mit Strg+V einfügen.`);
        return true;
    }

    cut_selection() {
        if (this.read_only_level() || this.refuse_locked_layer() || !this.copy_selection()) return;
        this.delete_selection();
    }

    // At the mouse (its lower left corner on the grid cell under the
    // pointer), or where it was copied from when the mouse is elsewhere –
    // half a grid step beside it if something is there (duplicate_offset).
    paste_clipboard() {
        const clipboard = window.level_clipboard;
        const layer = this.current_sprite_layer();
        if (!clipboard) { this.show_level_notice?.('Nichts zum Einfügen – kopiere erst Sprites (Strg+C).'); return; }
        if (!layer) { this.show_level_notice?.('Sprites kannst du nur in eine Sprite-Ebene einfügen.'); return; }
        if (this.read_only_level() || this.refuse_locked_layer()) return;
        // copied in another game: its sprites are not in this one, and pasting
        // would only clear the places they were meant for
        const known = clipboard.items.filter(item => this.game.sprite_index_for_ref(item[0]) !== null);
        if (known.length < clipboard.items.length) {
            this.show_level_notice?.(known.length ? 'Ein Teil der kopierten Sprites stammt aus einem anderen Spiel – hol sie dir erst mit „Sprites holen“.' :
                'Die kopierten Sprites stammen aus einem anderen Spiel – hol sie dir erst mit „Sprites holen“.');
            return;
        }
        const [dx, dy] = duplicate_offset(layer.sprites, clipboard.items, ...this.duplicate_step(), 0);
        let x = clipboard.x + dx, y = clipboard.y + dy;
        if (this.pointer_inside && this.pointer_world_raw)
            [x, y] = this.ui_to_world(this.pointer_world_raw, true);
        if (menus.level.active_key !== 'tool/select') menus.level.handle_click('tool/select');
        const pasted = paste_placed(layer.sprites, clipboard, x, y);
        // named Codes keep their names here: the name wins (signals.js)
        const level = this.game.data.levels[this.level_index];
        const changed = carry_signal_names(level, pasted.selection.map(i => pasted.sprites[i]), clipboard.signal_names);
        this.set_layer_sprites(this.layer_index, pasted.sprites, pasted.selection);
        // "Eingefügt – in diesem Level ist »Tor auf« Code 1."
        const moved = Object.values(changed).map(code => `»${signal_name(level, code)}« Code ${code}`);
        if (moved.length)
            this.show_level_notice(`Eingefügt – in diesem Level ${moved.length === 1 ? 'ist' : 'sind'} ${moved.length === 1 ? moved[0] :
                `${moved.slice(0, -1).join(', ')} und ${moved[moved.length - 1]}`}.`);
    }

    duplicate_selection() {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length || this.read_only_level() || this.refuse_locked_layer()) return;
        const clipboard = copy_placed(layer.sprites, this.selection);
        // half a grid step to the right and up: on top of the originals, never
        // replacing a sprite; dragging them puts them back on the grid
        const [dx, dy] = duplicate_offset(layer.sprites, clipboard.items, ...this.duplicate_step());
        const pasted = paste_placed(layer.sprites, clipboard, clipboard.x + dx, clipboard.y + dy);
        this.set_layer_sprites(this.layer_index, pasted.sprites, pasted.selection);
    }

    move_selection_to_layer(target) {
        const level = this.game.data.levels[this.level_index];
        const from = this.current_sprite_layer();
        const to = level.layers[target];
        if (!from || to?.type !== 'sprites' || target === this.layer_index || !this.selection.length || this.read_only_level()) return;
        // out of a locked layer or into one: neither
        if (this.refuse_locked_layer() || this.refuse_locked_layer(target)) {
            this.placed_properties_for = null;   // the "In Ebene" field shows the current layer again
            this.refresh();
            return;
        }
        // the layers may scroll differently (parallax): the sprites stay where they are on screen
        const [dx, dy] = parallax_layer_offset(this.camera_x, this.camera_y,
            from.properties?.parallax, to.properties?.parallax, this.grid_width, this.grid_height);
        const moved = move_placed_to_layer(from.sprites, this.selection, to.sprites, dx, dy);
        from.sprites = moved.from;
        this.layer_structs[this.layer_index]?.apply_layer(from);
        to.sprites = moved.to;
        this.layer_structs[target]?.apply_layer(to);
        // go along to the layer, with the moved sprites selected
        $('#menu_layers > ._dnd_item').eq(target).children().eq(0).trigger('click');
        this.selection = moved.selection;
        this.placed_properties_for = null;
        this.show_selection();
        this.refresh();
        this.render();
    }

    // Strg + drag with the pen: 'rect' fills the rectangle, 'frame' (with
    // Shift) only its edge, 'line' (with Alt) a line of cells.
    static shape_for_event(e) {
        return e.altKey ? 'line' : e.shiftKey ? 'frame' : 'rect';
    }

    // While dragging: the rectangle as a box, the edge and the line as the
    // sprites they will place.
    preview_shape(shape, x0, y0, x1, y1) {
        const step = this.pen_grid();
        const cells = shape === 'rect' ? null : shape_cells(shape, x0, y0, x1, y1, step, 1024);
        if (cells && this.sheets[this.sprite_index]) {
            this.clear_rect_group();
            for (const [x, y] of cells)
                this.sheets[this.sprite_index].add_sprite_to_group(this.rect_group, 'sprite', x, y);
        } else {
            const half_w = step.width / 2;
            this.prepare_rect_group(Math.min(x0, x1) - half_w, Math.min(y0, y1),
                Math.max(x0, x1) + half_w, Math.max(y0, y1) + step.height);
        }
        this.rect_group.visible = true;
    }

    draw_shape(shape, x0, y0, x1, y1) {
        const layer = this.current_sprite_layer();
        const sprite = this.game.data.sprites[this.sprite_index];
        if (!layer || !sprite || layer.properties.visible === false || this.read_only_level() || this.refuse_locked_layer()) return;
        const filled = place_shape(layer.sprites, sprite.id, shape, x0, y0, x1, y1, this.pen_grid());
        // new Schalter and Druckplatten: each its own free Code (signals.js)
        give_new_senders_codes(this.game.data.levels[this.level_index],
            filled.selection.map(i => filled.sprites[i]), () => sprite.traits);
        give_new_signs_their_voice(filled.selection.map(i => filled.sprites[i]), () => sprite.traits);
        this.set_layer_sprites(this.layer_index, filled.sprites, []);
    }

    // "Gleiche auswählen": every copy of the selected sprites in this layer.
    select_same_sprites() {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length) return;
        this.selection = same_sprite_indices(layer.sprites, this.selection);
        this.placed_properties_for = null;
        this.show_selection();
        this.refresh();
        this.render();
    }

    // "Ersetzen durch": the selected sprites become another sprite, each in
    // its place (level_selection.js replace_placed). Settings of traits the
    // new sprite has stay; a new Schalter or Druckplatte gets a free Code.
    replace_selection(sprite_index) {
        const layer = this.current_sprite_layer();
        const sprite = this.game.data.sprites[sprite_index];
        if (!layer || !sprite || !this.selection.length || this.read_only_level() || this.refuse_locked_layer()) return;
        const result = replace_placed(layer.sprites, this.selection, sprite.id, trait => trait in (sprite.traits ?? {}));
        if (!result.changed.length) return;
        give_new_senders_codes(this.game.data.levels[this.level_index],
            result.changed.map(i => result.sprites[i]), () => sprite.traits);
        give_new_signs_their_voice(result.changed.map(i => result.sprites[i]), () => sprite.traits);
        this.set_layer_sprites(this.layer_index, result.sprites, result.selection);
        this.build_signal_links();
        const count = result.changed.length;
        this.show_level_notice(`${count === 1 ? '1 Sprite' : `${count} Sprites`} ersetzt – Strg+Z macht es rückgängig.`);
    }

    read_only_level() {
        return window.collaboration?.can_edit_current?.() === false;
    }

    // Ebene sperren (layer.properties.locked, absent = not locked; only the
    // editor reads it, the game ignores it): nothing in a locked layer can be
    // painted, erased, moved, pasted, filled, replaced or deleted in the
    // level view. Selecting it, its settings, Verbinden and undo still work.
    layer_locked(li = this.layer_index) {
        return this.game.data.levels[this.level_index]?.layers?.[li]?.properties?.locked === true;
    }

    // true (and a notice) if this layer is locked
    refuse_locked_layer(li = this.layer_index) {
        if (!this.layer_locked(li)) return false;
        const layer = this.game.data.levels[this.level_index].layers[li];
        this.show_level_notice?.(`Die Ebene »${layer.properties.name || `Ebene ${li + 1}`}« ist gesperrt. Entsperre sie mit dem Schloss in der Liste der Ebenen.`);
        return true;
    }

    // The box above the placed properties: how many are selected, and what
    // can be done with them.
    add_selection_controls(container) {
        const count = this.selection.length;
        const box = $('<div class="selection-box">').appendTo(container);
        $('<div class="selection-count">').text(count === 1 ? '1 Sprite ausgewählt' : `${count} Sprites ausgewählt`).appendTo(box);
        const buttons = $('<div class="selection-buttons">').appendTo(box);
        const button = (label, title, action, row = buttons) => $('<button type="button">').text(label).attr('title', title)
            .on('click', (e) => { e.preventDefault(); action(); }).appendTo(row);
        button('Kopieren', 'Strg+C – einfügen mit Strg+V, auch in einem anderen Level', () => this.copy_selection());
        button('Duplizieren', 'Strg+D – eine Kopie, halb versetzt über dem Original; zieh sie an ihren Platz', () => this.duplicate_selection());
        button('Löschen', 'Entf', () => this.delete_selection());
        // a row of its own: the panel is narrow
        const more = $('<div class="selection-buttons">').appendTo(box);
        const layer_now = this.current_sprite_layer();
        const same = layer_now ? same_sprite_indices(layer_now.sprites, this.selection).length : 0;
        if (same > count)
            button('Alle gleichen', `Wählt alle ${same} Sprites dieser Ebene aus, die so aussehen wie die ausgewählten – zum Beispiel jedes Grasstück, um alle auf einmal zu ersetzen.`,
                () => this.select_same_sprites(), more);
        // "Ersetzen durch": a small sprite picker of its own; choosing a sprite
        // in the sprite list would switch to the pen and drop the selection
        const picker = $('<div class="selection-replace">').hide();
        button('Ersetzen durch …', 'Die ausgewählten Sprites werden zu einem anderen Sprite, jedes an seinem Platz. Codes und Einstellungen bleiben, wenn das neue Sprite sie auch hat (zum Beispiel eine Tür, die zu einer anderen Tür wird).',
            () => picker.toggle(), more);
        this.game.data.sprites.forEach((sprite, si) => {
            const frames = sprite.states?.[0]?.frames ?? [];
            const frame = frames[Math.floor(frames.length / 2 - 0.5)] ?? frames[0];
            $('<button type="button" class="selection-replace-sprite">')
                .attr('title', sprite_label(sprite, si))
                .css('background-image', frame?.src ? `url(${frame.src})` : 'none')
                .on('click', (e) => { e.preventDefault(); this.replace_selection(si); })
                .appendTo(picker);
        });
        picker.appendTo(box);
        const level = this.game.data.levels[this.level_index];
        const options = {};
        level.layers.forEach((layer, li) => {
            if (layer.type === 'sprites') options[String(li)] = layer.properties.name || `Ebene ${li + 1}`;
        });
        if (Object.keys(options).length > 1) {
            new SelectWidget({
                container: box,
                label: 'In Ebene',
                hint: 'Verschiebt die ausgewählten Sprites in eine andere Ebene – zum Beispiel eine Brücke in ihre eigene Ebene, die bei einem Signal erscheint.',
                options,
                get: () => String(this.layer_index),
                set: (value) => this.move_selection_to_layer(Number(value)),
            });
        }
    }

    // ------------------------------------------------------- test runs
    // "Level testen": this level in the Spielen pane. With the mouse over the
    // level (key T), the figure starts on the grid cell under the mouse.
    // at: the screen point to start from (the right-click menu), else the mouse
    start_playtest(at = null) {
        const options = { level_index: this.level_index, start: null };
        const point = at ?? (this.pointer_inside ? this.pointer_world_raw : null);
        if (point) {
            const [x, y] = this.ui_to_world(point, true);
            options.start = { x, y };
        }
        window.studio_start_playtest?.(options);
    }

    // ---------------------------------------------- Signale: connections
    // Animated dashes run from what sends to what reacts (signals.js), and
    // both get a pulsing frame. Shown for what is selected (a placed sprite,
    // the current layer, what "Verbinden" started from, a connection just
    // made) and for the Signale-Übersicht (the card under the mouse, a Code
    // clicked there).
    signal_context() {
        const level = this.game.data.levels[this.level_index];
        const sprite_of = ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)];
        return {
            level,
            traits_of: ref => sprite_of(ref)?.traits,
            size_of: ref => { const sprite = sprite_of(ref); return sprite ? { width: sprite.width, height: sprite.height } : null; },
        };
    }

    signal_codes_to_show() {
        // a card of the Signale-Übersicht under the mouse: only its Code
        if (this.show_signal_overview && Number.isInteger(this.signal_focus_code)) return new Set([this.signal_focus_code]);
        const { level, traits_of } = this.signal_context();
        const codes = new Set();
        if (Number.isInteger(this.connect_from?.code)) codes.add(this.connect_from.code);
        if (this.signal_highlight && performance.now() < this.signal_highlight.until) codes.add(this.signal_highlight.code);
        const layer = level?.layers[this.layer_index];
        if (layer?.type === 'sprites' && this.selection.length === 1) {
            const placed = layer.sprites[this.selection[0]];
            if (placed)
                for (const found of placed_signal_roles(placed, traits_of(placed[0]), traits_of)) codes.add(found.code);
        } else if (layer && (layer.type === 'signal_area' || layer_reacts_to_signals(layer.properties))) {
            codes.add(Number(layer.properties.signal_code ?? 0));
        }
        return codes;
    }

    build_signal_links() {
        const group = this.signal_links_group;
        for (const child of [...group.children]) {
            group.remove(child);
            child.geometry?.dispose?.();
            child.material?.dispose?.();
        }
        this.signal_link_curves = [];
        this.signal_link_frames = [];
        this.signal_link_labels = [];
        this.build_platform_paths();
        this.refresh_signal_overview();
        this.refresh_level_map();
        this.refresh_signal_code_widgets();
        if (!this.game.data.levels?.[this.level_index]) return;
        const { level, traits_of, size_of } = this.signal_context();
        const codes = this.signal_codes_to_show();
        const objects = signal_objects(level, traits_of, size_of);
        const framed = objects.filter(o => codes === null || codes.has(o.code));
        if (this.connect_from && !framed.some(o => same_signal_object(o, this.connect_from))) framed.push(this.connect_from);
        // marching frames around everything involved
        for (const object of framed) {
            const rects = object.rects ? object.rects.map(r => ({ x0: r.left, y0: r.bottom, x1: r.left + r.width, y1: r.bottom + r.height }))
                : [object.rect];
            for (const rect of rects) this.signal_link_frames.push({ rect, color: signal_link_color(object.code) });
        }
        for (const link of signal_links(objects, codes)) {
            this.signal_link_curves.push({ from: link.from.anchor, to: link.to.anchor, color: signal_link_color(link.code) });
            // a sender with a Verzögerung: its lines say how long
            const delay = this.signal_object_delay(level, link.from);
            if (delay > 0) this.signal_link_labels.push({ from: link.from.anchor, to: link.to.anchor,
                text: signal_seconds_text(delay), color: signal_link_color(link.code) });
        }
        if (this.connect_from && this.connect_pointer)
            this.signal_link_curves.push({ from: this.connect_from.anchor, to: this.connect_pointer, color: '#f4f4f4' });
        this.signal_dash_mesh = null;
        if (this.signal_link_curves.length || this.signal_link_frames.length) {
            // a dark edge under the colours: visible on a light sky and on dark walls
            this.signal_dash_shadow = new THREE.Mesh(new THREE.BufferGeometry(),
                new THREE.MeshBasicMaterial({ color: 0x1a1c2c, transparent: true, opacity: 0.6, depthTest: false, side: THREE.DoubleSide }));
            this.signal_dash_shadow.renderOrder = 10;
            group.add(this.signal_dash_shadow);
            this.signal_dash_mesh = new THREE.Mesh(new THREE.BufferGeometry(),
                new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, side: THREE.DoubleSide }));
            this.signal_dash_mesh.renderOrder = 11;
            group.add(this.signal_dash_mesh);
        }
        this.update_signal_dashes(performance.now() / 1000);
        if (group.children.length) this.start_signal_animation();
    }

    // Dashes along a curve that bends upwards, moving from sender to receiver,
    // with an arrow head; sizes in screen pixels.
    update_signal_dashes(time) {
        if (!this.signal_dash_mesh) return;
        const px = 1 / this.scale;
        const positions = [], colors = [], shadow = [];
        const color = new THREE.Color();
        const quad = (a, b, half) => {
            const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
            const ux = dx / length, uy = dy / length;
            for (const [h, extend, out] of [[half + px, px, shadow], [half, 0, positions]]) {
                const nx = -uy * h, ny = ux * h, ex = ux * extend, ey = uy * extend;
                const p = [[a.x - ex + nx, a.y - ey + ny], [a.x - ex - nx, a.y - ey - ny], [b.x + ex - nx, b.y + ey - ny], [b.x + ex + nx, b.y + ey + ny]];
                for (const i of [0, 1, 2, 0, 2, 3]) {
                    out.push(p[i][0], p[i][1], 2);
                    if (out === positions) colors.push(color.r, color.g, color.b);
                }
            }
        };
        for (const curve of this.signal_link_curves) {
            const a = curve.from, b = curve.to;
            const distance = Math.hypot(b.x - a.x, b.y - a.y);
            if (distance < 1) continue;
            color.set(curve.color);
            const control = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + distance * 0.25 + 12 * px };
            const at = t => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * control.x + t * t * b.x,
                y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * control.y + t * t * b.y });
            const steps = 48;
            const points = [at(0)];
            const lengths = [0];
            for (let i = 1; i <= steps; i++) {
                points.push(at(i / steps));
                lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
            }
            const total = lengths[steps];
            const dash = 7 * px, gap = 5 * px, period = dash + gap;
            const offset = (time * 24 * px) % period;
            const point_at = (s) => {
                let i = 1;
                while (i < steps && lengths[i] < s) i++;
                const t = (s - lengths[i - 1]) / ((lengths[i] - lengths[i - 1]) || 1);
                return { x: points[i - 1].x + (points[i].x - points[i - 1].x) * t, y: points[i - 1].y + (points[i].y - points[i - 1].y) * t };
            };
            const end = total - 7 * px; // room for the arrow head
            for (let s = offset - period; s < end; s += period) {
                const s0 = Math.max(0, s), s1 = Math.min(end, s + dash);
                if (s1 <= s0) continue;
                const pieces = Math.max(1, Math.ceil((s1 - s0) / (3 * px)));
                for (let k = 0; k < pieces; k++)
                    quad(point_at(s0 + (s1 - s0) * k / pieces), point_at(s0 + (s1 - s0) * (k + 1) / pieces), 1.25 * px);
            }
            // arrow head
            const tip = points[steps], back = point_at(total - 9 * px);
            const dx = tip.x - back.x, dy = tip.y - back.y, length = Math.hypot(dx, dy) || 1;
            const ux = dx / length, uy = dy / length;
            const left = { x: back.x - uy * 4.5 * px, y: back.y + ux * 4.5 * px };
            const right = { x: back.x + uy * 4.5 * px, y: back.y - ux * 4.5 * px };
            for (const p of [tip, left, right]) { positions.push(p.x, p.y, 2); colors.push(color.r, color.g, color.b); }
            const grow = (p) => ({ x: p.x + (p.x - (tip.x + left.x + right.x) / 3) * 0.35, y: p.y + (p.y - (tip.y + left.y + right.y) / 3) * 0.35 });
            for (const p of [tip, left, right].map(grow)) shadow.push(p.x, p.y, 2);
        }
        // frames: dashes marching around the outline
        for (const frame of this.signal_link_frames) {
            color.set(frame.color);
            const pad = 3 * px, r = frame.rect;
            const corners = [[r.x0 - pad, r.y0 - pad], [r.x1 + pad, r.y0 - pad], [r.x1 + pad, r.y1 + pad], [r.x0 - pad, r.y1 + pad], [r.x0 - pad, r.y0 - pad]]
                .map(([x, y]) => ({ x, y }));
            const dash = 5 * px, period = 8 * px;
            let walked = 0;
            const offset = (time * 16 * px) % period;
            for (let i = 0; i < 4; i++) {
                const a = corners[i], b = corners[i + 1];
                const length = Math.hypot(b.x - a.x, b.y - a.y);
                const point = s => ({ x: a.x + (b.x - a.x) * s / length, y: a.y + (b.y - a.y) * s / length });
                // dashes on this side: where (walked + s - offset) mod period < dash
                let s = ((offset - walked) % period + period) % period - period;
                for (; s < length; s += period) {
                    const s0 = Math.max(0, s), s1 = Math.min(length, s + dash);
                    if (s1 > s0) quad(point(s0), point(s1), 1 * px);
                }
                walked += length;
            }
        }
        const geometry = this.signal_dash_mesh.geometry;
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeBoundingSphere();
        const under = this.signal_dash_shadow.geometry;
        under.setAttribute('position', new THREE.Float32BufferAttribute(shadow, 3));
        under.computeBoundingSphere();
    }

    start_signal_animation() {
        if (this.signal_animation_frame) return;
        const tick = () => {
            this.signal_animation_frame = null;
            if (typeof current_pane !== 'undefined' && current_pane !== 'level') return;
            if (!this.signal_links_group.children.length) return;
            // a connection just made stays visible for a moment
            if (this.signal_highlight && performance.now() >= this.signal_highlight.until) {
                this.signal_highlight = null;
                this.build_signal_links();
            }
            this.update_signal_dashes(performance.now() / 1000);
            this.render();
            this.signal_animation_frame = requestAnimationFrame(tick);
        };
        this.signal_animation_frame = requestAnimationFrame(tick);
    }

    // "Verbinden" tool: first click what sends (or what reacts), then its
    // partner. They get a shared Code (connect_signal_objects).
    handle_connect_down(e) {
        if (e.button === 2) {
            this.cancel_connect();
            return;
        }
        const touch = this.get_touch_point(e);
        const x = this.camera_x + (touch[0] - this.width / 2) / this.scale;
        const y = this.camera_y - (touch[1] - this.height / 2) / this.scale;
        const { level, traits_of, size_of } = this.signal_context();
        // the first click looks for what sends, the second for its partner
        const prefer = !this.connect_from || !this.connect_from.sends ? 'sender' : 'receiver';
        const picked = pick_signal_object(level, x, y, traits_of, size_of, this.layer_index, prefer);
        if (!this.connect_from) {
            this.connect_from = picked;
            this.connect_pointer = picked ? { x, y } : null;
        } else {
            // a layer that would take away its own sender
            const own_layer = (layer, sprite) => layer?.kind === 'layer' && sprite?.kind === 'sprite' &&
                sprite.layer_index === layer.layer_index;
            if (own_layer(picked, this.connect_from) || own_layer(this.connect_from, picked)) {
                this.show_level_notice('Das liegt auf derselben Ebene wie der Sender – die Ebene würde ihn mit verschwinden lassen. Leg das, was erscheinen oder verschwinden soll, in eine eigene Ebene.');
            } else if (picked && !same_signal_object(picked, this.connect_from) &&
                window.collaboration?.can_edit_current?.() !== false) {
                const used_before = signal_codes_in_level(level);
                const code = connect_signal_objects(level, this.connect_from, picked, traits_of, size_of);
                if (code !== null) this.signal_highlight = { code, until: performance.now() + 2500 };
                // a Code that did not exist before: ask for its name (prefilled)
                if (code !== null && !used_before.has(code)) {
                    const sender = this.connect_from.sends ? this.connect_from : picked.sends ? picked : this.connect_from;
                    const receiver = sender === picked ? this.connect_from : picked;
                    setTimeout(() => this.ask_signal_name(code, unique_signal_name(level,
                        `${this.signal_object_label(sender)} → ${this.signal_object_label(receiver)}`)), 0);
                }
                // the panels show the new Code
                this.placed_properties_for = null;
                if ($('#menu_layer_properties_container').is(':visible')) this.setup_layer_properties();
            }
            this.connect_from = null;
            this.connect_pointer = null;
        }
        this.refresh();
        this.render();
    }

    // The name buttons of every Code field on the page (SignalCodeWidget):
    // a name given or changed elsewhere shows at once. Runs with
    // build_signal_links, i.e. after every change that could matter.
    refresh_signal_code_widgets() {
        $('.signal-code-pick').each((_, el) => $(el).data('signal-code-widget')?.refresh_button());
    }

    // Takes one thing out of the Signale ("Kein Signal"): object as in a rule
    // card (signal_rules). A key, door, Schalter, Druckplatte or Bereich gets
    // the Code null; an enemy, a sign, a layer or a level setting switches its
    // signal off. The key an enemy leaves behind is left alone (its Code falls
    // back to the drawing's). False if nothing changed (or the layer is locked).
    clear_signal_object(level, object) {
        if (!level || !object) return false;
        if (object.kind === 'level' && object.setting === 'item_signals') {
            const list = level.properties?.item_signals;
            if (!Array.isArray(list) || !list[object.index]) return false;
            list.splice(object.index, 1);
            if (!list.length) delete level.properties.item_signals;
            return true;
        }
        if (object.kind === 'level') {
            if (!(object.setting in (level.properties ?? {}))) return false;
            delete level.properties[object.setting];
            if (object.setting === 'signal_all_defeated') delete level.properties.signal_all_defeated_delay;
            if (object.setting === 'signal_level_start') delete level.properties.signal_level_start_delay;
            return true;
        }
        const layer = level.layers[object.layer_index];
        if (!layer || this.refuse_locked_layer(object.layer_index)) return false;
        if (object.kind === 'layer') {
            delete layer.properties.signal_reaction;
            delete layer.properties.signal_code;
            delete layer.properties.signal_fade;
            return true;
        }
        if (object.kind === 'area') {
            layer.properties.signal_code = null;
            return true;
        }
        const placed = layer.sprites?.[object.placed_index];
        const trait = { loot: null, baddie: 'baddie', text: 'text', counter_out: 'counter', exit_out: 'level_complete' }[object.role] ?? object.role;
        if (!placed || !trait) return false;
        if (!placed[3] || typeof placed[3] !== 'object') placed[3] = {};
        const props = placed[3][trait] ??= {};
        // what a Zähler sends
        if (object.role === 'counter_out') {
            props.send_code = null;
            return true;
        }
        // what an exit sends while the figure stands at it
        if (object.role === 'exit_out') {
            props.signal_on_reach = false;
            delete props.send_code;
            return true;
        }
        const flag = { baddie: 'signal_on_defeat', text: 'speaks_on_signal', pickup: 'signal_on_collect', companion: 'waits_for_signal',
            level_complete: 'opens_on_signal' }[trait];
        if (flag) {
            props[flag] = false;
            delete props.signal_code;
        } else props.signal_code = null;
        return true;
    }

    // After taking things out: one undo step, and every panel shows it.
    signal_objects_cleared(notice) {
        this.history_observe();
        this.placed_properties_for = null;
        if ($('#menu_layer_properties_container').is(':visible')) this.setup_layer_properties();
        $('.level-signal-controls').each((_, box) => $(box).data('refresh')?.());
        this.signal_focus_code = null;
        this.refresh();
        this.build_signal_links();
        this.render();
        this.show_level_notice(notice);
    }

    // × on a line of a card: everything on that line leaves the signal.
    remove_signal_line(line) {
        if (window.collaboration?.can_edit_current?.() === false) {
            this.show_level_notice('Gerade bearbeitet jemand anderes dieses Level.');
            return;
        }
        const level = this.game.data.levels[this.level_index];
        let changed = 0;
        for (const object of line.objects) if (object.role !== 'loot' && this.clear_signal_object(level, object)) changed++;
        if (changed) this.signal_objects_cleared(`„${line.text}“ gehört nicht mehr zu diesem Signal – Strg+Z macht es rückgängig.`);
    }

    // The trash can of a card: the whole rule goes – every line, and its name.
    delete_signal_rule(card) {
        if (window.collaboration?.can_edit_current?.() === false) {
            this.show_level_notice('Gerade bearbeitet jemand anderes dieses Level.');
            return;
        }
        const level = this.game.data.levels[this.level_index];
        let changed = 0;
        for (const line of [...card.senders, ...card.receivers])
            for (const object of line.objects) if (object.role !== 'loot' && this.clear_signal_object(level, object)) changed++;
        if (signal_name(level, card.code)) { set_signal_name(level, card.code, ''); changed++; }
        if (changed) this.signal_objects_cleared(`Die Regel ${signal_code_text(card.code, card.name)} ist gelöscht – Strg+Z macht es rückgängig.`);
    }

    // "+ Neue Regel": the Verbinden tool, and what to click.
    start_new_signal_rule() {
        if (menus.level.active_key !== 'tool/connect') menus.level.handle_click('tool/connect');
        this.cancel_connect();
        this.show_level_notice('Verbinden: Klicke zuerst auf das, was senden soll (Schalter, Schlüssel, Druckplatte, Gegner, Signalbereich) – dann auf das, was reagieren soll (Tür, Ausgang, Ebene). Esc bricht ab.', 7000);
    }

    // The Verzögerung of a sender in seconds (0: at once), as stored: the
    // placed sprite's signal_delay (not for the key an enemy leaves behind)
    // or a Bereich's properties.signal_delay.
    signal_object_delay(level, object) {
        const layer = level?.layers[object?.layer_index];
        if (!layer || !object.sends) return 0;
        if (object.kind === 'area') return signal_delay_seconds(layer.properties?.signal_delay);
        if (object.kind !== 'sprite' || object.role === 'loot') return 0;
        return signal_delay_seconds(layer.sprites?.[object.placed_index]?.[3]?.[object.trait]?.signal_delay);
    }

    // The labels on delayed connections: small boxes over the level view,
    // put at the middle of their curve on every render (the curve bends with
    // the zoom, see update_signal_dashes).
    place_signal_link_labels() {
        let box = $(this.element).find('.signal-link-labels');
        const labels = this.signal_link_labels ?? [];
        if (!labels.length) { box.remove(); return; }
        if (!box.length) box = $('<div class="signal-link-labels">').appendTo(this.element);
        const items = box.children();
        const px = 1 / this.scale;
        labels.forEach((label, i) => {
            let item = items.eq(i);
            if (!item.length) item = $('<div class="signal-link-label">').append($('<i class="fa fa-clock-o">'), $('<span>')).appendTo(box);
            item.find('span').text(label.text);
            item.css('--signal-color', label.color);
            const a = label.from, b = label.to;
            const distance = Math.hypot(b.x - a.x, b.y - a.y);
            // the curve's middle: a quadratic Bézier at t = ½ is ¼ a + ½ control + ¼ b
            const control_y = (a.y + b.y) / 2 + distance * 0.25 + 12 * px;
            const x = (a.x + b.x) / 2, y = 0.25 * a.y + 0.5 * control_y + 0.25 * b.y;
            item.css({ left: `${this.width / 2 + (x - this.camera_x) * this.scale}px`,
                top: `${this.height / 2 - (y - this.camera_y) * this.scale}px` });
        });
        items.slice(labels.length).remove();
    }

    // What a sender or receiver is called in a suggested name: the sprite's
    // label (Titel or "Sprite N"), a layer's or Bereich's name.
    signal_object_label(object) {
        const layer = this.game.data.levels[this.level_index]?.layers[object?.layer_index];
        if (!layer) return '';
        if (object.kind === 'sprite') {
            const index = this.game.sprite_index_for_ref(layer.sprites?.[object.placed_index]?.[0]);
            return Number.isInteger(index) && this.game.data.sprites[index] ? sprite_label(this.game.data.sprites[index], index) : 'Sprite';
        }
        return layer.properties?.name || (object.kind === 'area' ? 'Signalbereich' : 'Ebene');
    }

    // A small field over the level: "Name für das neue Signal". The
    // suggestion is selected, so typing replaces it; Enter or leaving the field
    // saves (rename_signal_code), Esc leaves the Code without a name.
    ask_signal_name(code, suggestion) {
        $(this.element).find('.signal-name-prompt').remove();
        const box = $('<div class="signal-name-prompt">').css('--signal-color', signal_link_color(code))
            .toggleClass('beside-overview', !!this.show_signal_overview).appendTo(this.element);
        // the level view must not paint or zoom through it
        box.on('mousedown touchstart dblclick wheel contextmenu', (e) => e.stopPropagation());
        $('<div class="signal-name-prompt-label">').text(`Name für das neue Signal (Code ${code})`).appendTo(box);
        const input = $('<input type="text">')
            .attr({ maxlength: SIGNAL_NAME_MAX_LENGTH, placeholder: 'Name, z. B. Brücke', spellcheck: 'false' })
            .val(suggestion).appendTo(box);
        $('<div class="signal-name-prompt-hint">').text('Enter: übernehmen · Esc: ohne Namen').appendTo(box);
        let finished = false;
        const finish = (save) => {
            if (finished) return true;
            if (save && !this.rename_signal_code(code, input.val())) return false;
            finished = true;
            box.remove();
            return true;
        };
        input.on('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        // a name that is taken: no name (the notice says why)
        input.on('blur', () => { if (!finish(true)) finish(false); });
        input.trigger('focus').trigger('select');
    }

    handle_connect_move(e) {
        if (!this.connect_from) return;
        const touch = this.get_touch_point(e);
        this.connect_pointer = {
            x: this.camera_x + (touch[0] - this.width / 2) / this.scale,
            y: this.camera_y - (touch[1] - this.height / 2) / this.scale,
        };
        this.build_signal_links();
        this.render();
    }

    // A short message over the level (a few seconds).
    // ------------------------------------------------ right-click menus
    level_context_menu(index) {
        const levels = this.game.data.levels;
        const can_delete = levels.length > 1 && (window.collaboration?.can_delete?.('level', levels[index]?.id) ?? true);
        return [
            { header: level_display_name(levels, index) },
            { label: 'Umbenennen', icon: 'fa-pencil', hint: 'Auch mit einem Doppelklick auf das Level.',
                callback: () => this.levels_widget.start_rename(index) },
            { label: 'Duplizieren', icon: 'fa-clone', callback: () => this.duplicate_level(index),
                hint: 'Eine Kopie des ganzen Levels mit allen Ebenen – gleich dahinter in der Liste.' },
            { label: 'Einstellungen', icon: 'fa-sliders', hint: 'Hintergrundfarbe, Nebenlevel, Signale des Levels …',
                callback: () => { if (index !== this.level_index) this.levels_widget.options.onclick(null, index); window.set_folding_panel_open_by_name?.('level_settings', true); } },
            '-',
            { label: 'Löschen', icon: 'fa-trash', disabled: !can_delete,
                hint: can_delete ? 'Gleich danach kannst du es mit „Rückgängig“ zurückholen.' : 'Das letzte Level bleibt.',
                callback: () => this.levels_widget.delete_index(index) },
        ];
    }

    layer_context_menu(index) {
        const read_only = this.read_only_level();
        const layers = this.game.data.levels[this.level_index].layers;
        const can_delete = !read_only && layers.length > 1 && !this.layer_locked(index);
        return [
            { header: layers[index]?.properties?.name || `Ebene ${index + 1}` },
            { label: 'Umbenennen', icon: 'fa-pencil', disabled: read_only, hint: 'Auch mit einem Doppelklick auf die Ebene.',
                callback: () => this.layers_widget.start_rename(index) },
            { label: 'Duplizieren', icon: 'fa-clone', disabled: read_only, callback: () => this.duplicate_layer(index),
                hint: read_only ? 'Gerade bearbeitet jemand anderes dieses Level.' : 'Eine Kopie dieser Ebene mit allem, was darin liegt – direkt darüber.' },
            '-',
            { label: 'Löschen', icon: 'fa-trash', disabled: !can_delete,
                hint: this.layer_locked(index) ? 'Die Ebene ist gesperrt.' : layers.length <= 1 ? 'Die letzte Ebene bleibt.' : 'Strg+Z holt sie zurück.',
                callback: () => this.layers_widget.delete_index(index) },
        ];
    }

    rename_level(index, name) {
        const level = this.game.data.levels[index];
        if (!level) return;
        level.properties.name = name;
        this.update_level_label(index);
        // the Titel field of the level shows it
        if (index === this.level_index) $('#menu_level_properties .item').first().data('widget-instance')?.refresh?.();
        this.history_observe();
    }

    rename_layer(index, name) {
        const layer = this.game.data.levels[this.level_index].layers[index];
        if (!layer || this.read_only_level()) return;
        layer.properties.name = name;
        $('#menu_layers').children('._dnd_item').eq(index).find('.layer-name').text(name || `Ebene ${index + 1}`).toggleClass('unnamed', !String(name ?? '').trim());
        if (index === this.layer_index) { this.setup_layer_properties(); this.update_layer_label(); }
        this.history_observe();
    }

    sprite_button_context_menu(si) {
        const sprite = this.game.data.sprites[si];
        if (!sprite) return [];
        const layer = this.current_sprite_layer();
        const count = layer ? layer.sprites.filter(entry => Array.isArray(entry) && entry[0] === sprite.id).length : 0;
        return [
            { label: 'Im Sprite-Editor bearbeiten', icon: 'fa-paint-brush', callback: () => {
                if (window.studio_show_pane?.('sprites')) studio_history_push?.({ pane: 'sprites' });
                canvas.switchToSprite(si);
            } },
            { label: count ? `Alle ${count} in dieser Ebene auswählen` : 'Alle in dieser Ebene auswählen', icon: 'fa-object-group',
                disabled: !count, hint: count ? null : 'In dieser Ebene liegt keins davon.',
                callback: () => this.select_all_of_sprite(sprite.id) },
            '-',
            { label: 'Duplizieren', icon: 'fa-clone', callback: () => { if (typeof duplicate_sprite === 'function') duplicate_sprite(si); },
                hint: 'Ein neues Sprite als Kopie – zum Beispiel, um eine zweite Farbe davon zu malen.' },
        ];
    }

    duplicate_level(index) {
        this.history_observe();
        const levels = this.game.data.levels;
        const original = levels[index];
        if (!original) return;
        const copy = JSON.parse(JSON.stringify(original));
        delete copy.id;
        assign_new_game_id(this.game.data, 'levels', copy);
        copy.properties.name = `${original.properties.name || `Level ${index + 1}`} (Kopie)`;
        levels.splice(index + 1, 0, copy);
        this.game.fix_game_data();
        window.collaboration?.structure_changed?.('level', 'insert', copy.id);
        this.record_level_list('insert', copy.id, index + 1);
        this.label_for_level = [];
        this.levels_widget.rebuild();
        this.levels_widget.select_index(index + 1);
    }

    duplicate_layer(index) {
        if (this.read_only_level()) return;
        const level = this.game.data.levels[this.level_index];
        const original = level?.layers?.[index];
        if (!original) return;
        const copy = JSON.parse(JSON.stringify(original));
        copy.properties ??= {};
        copy.properties.name = `${original.properties?.name || `Ebene ${index + 1}`} (Kopie)`;
        delete copy.properties.locked;   // the copy is there to be worked on
        level.layers.splice(index + 1, 0, copy);
        this.game.fix_game_data();
        const layer_struct = new LayerStruct(this);
        layer_struct.apply_layer(level.layers[index + 1]);
        this.layer_structs.splice(index + 1, 0, layer_struct);
        this.layers_widget.rebuild();
        this.layers_widget.select_index(index + 1);
    }

    // Every placed copy of one sprite in the current layer (sprite palette).
    select_all_of_sprite(id) {
        const layer = this.current_sprite_layer();
        if (!layer) return;
        menus.level.handle_click('tool/select');
        this.selection = layer.sprites.map((entry, i) => Array.isArray(entry) && entry[0] === id ? i : -1).filter(i => i >= 0);
        this.placed_properties_for = null;
        this.show_selection();
        this.refresh();
        this.render();
    }

    // Gitter anzeigen / Signale-Übersicht / Übersichtskarte / Level animieren:
    // the checkboxes under Werkzeuge and the toggles in the status bar (G / S / M / A).
    set_view_option(option, value) {
        value = !!value;
        this[option] = value;
        if (option === 'show_grid') this.refresh();
        if (option === 'show_signal_overview') {
            try { localStorage.setItem('signal_overview', value ? '1' : '0'); } catch { }
            if (!value) this.signal_focus_code = null;
            this.build_signal_links();
        }
        if (option === 'show_minimap') {
            try { localStorage.setItem('level_minimap', value ? '1' : '0'); } catch { }
        }
        if (option === 'show_regions' || option === 'dim_other_layers') {
            try { localStorage.setItem(option === 'show_regions' ? 'level_regions' : 'level_dim', value ? '1' : '0'); } catch { }
            this.refresh();
        }
        if (option === 'show_level_map') this.refresh_level_map();
        if (option === 'animate_level') {
            if (value) this.start_level_animation();
            else {
                this.set_backdrop_time(0);
                // every sprite shows its still picture again
                this.refresh_blend_materials();
            }
        }
        this.render();
        this.view_option_widgets?.[option]?.refresh();
        menus.level?.refresh_toggles?.();
    }

    show_level_notice(text, duration = 4500) {
        let notice = $(this.element).find('.level-notice');
        if (!notice.length) notice = $('<div class="level-notice">').appendTo(this.element);
        notice.text(text).addClass('showing');
        clearTimeout(this.level_notice_timer);
        this.level_notice_timer = setTimeout(() => notice.removeClass('showing'), duration);
    }

    cancel_connect() {
        if (!this.connect_from) return;
        this.connect_from = null;
        this.connect_pointer = null;
        this.build_signal_links();
        this.render();
    }

    // Under the Code of a key, door, Schalter, Druckplatte or enemy: what else
    // in this level has the same Code (signals.js), so a child sees what is
    // connected. One line under each Code field (an enemy can have two: what it
    // sends when defeated, and the key it leaves behind).
    add_signal_link_line(container, trait, key, entry_index) {
        const role = key === 'drop_code' ? SIGNAL_LOOT_ROLE :
            key === 'send_code' ? (trait === 'level_complete' ? SIGNAL_EXIT_OUT_ROLE : SIGNAL_COUNTER_OUT_ROLE) :
            SIGNAL_SPRITE_ROLES.find(role => role.trait === trait);
        if (!role) return;
        this.signal_link_lines ??= [];
        this.signal_link_lines.push({ line: $('<div class="signal-links">').appendTo(container), role, entry_index });
    }

    add_signal_links(sprite, entry_index) {
        const lines = this.signal_link_lines ?? [];
        if (!lines.length) return;
        const level_index = this.level_index, layer_index = this.layer_index;
        this.update_signal_links = () => {
            const level = this.game.data.levels[level_index];
            const placed = level?.layers[layer_index]?.sprites?.[entry_index];
            if (!placed) return;
            const { traits_of } = this.signal_context();
            const roles = placed_signal_roles(placed, sprite.traits, traits_of);
            for (const { line, role } of lines) {
                // an enemy only takes part once "sendet, wenn besiegt" is on
                const found = roles.find(found => found.role === role);
                line.text(found ? describe_signal_partners(found.code, signal_partners(level, found.code, traits_of),
                    signal_name(level, found.code)) : '');
            }
            this.build_signal_links();
            this.render();
        };
        this.update_signal_links();
    }

    // Signale (signals.js): a layer can appear or disappear when something
    // sends its Code. Absent = it does not react.
    // hint: the explanation of "Bei Signal" (absent: the one for sprite layers)
    add_layer_signal_controls(layer, hint = null) {
        const container = $('#menu_layer_properties');
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        const update_links = () => {
            const code = layer.properties.signal_code ?? 0;
            links.text(layer_reacts_to_signals(layer.properties) ?
                describe_signal_partners(code, signal_partners(level, code,
                    ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits),
                    signal_name(level, code)) : '');
            this.build_signal_links();
            this.render();
        };
        let details = null;
        new SelectWidget({
            container,
            label: 'Bei Signal',
            hint: hint ?? 'Die Ebene kann erscheinen oder verschwinden, wenn etwas mit ihrem Code ein Signal sendet: ein Schlüssel, ein Schalter, eine Druckplatte, ein Signalbereich oder ein besiegter Gegner. „erscheint“: am Anfang weg, beim ersten Signal „an“ da. „verschwindet“: am Anfang da, beim ersten Signal „an“ weg. „da, solange an“ und „weg, solange an“: folgt dem Signal – praktisch mit einer Druckplatte oder einem Signalbereich (ein Dach, das verschwindet, solange man im Haus ist). „wechselt“: jedes Signal macht die Ebene da oder weg. Eine Ebene, die weg ist, wird nicht gezeichnet, man kann nicht auf ihr stehen, und Gegner auf ihr warten, bis sie erscheint – so baust du Brücken, Wände, die verschwinden, oder einen Hinterhalt. Die Spielfigur gehört nicht auf so eine Ebene.',
            options: LAYER_SIGNAL_REACTIONS,
            get: () => layer.properties.signal_reaction ?? 'none',
            set: (value) => {
                if (value === 'none') {
                    delete layer.properties.signal_reaction;
                    delete layer.properties.signal_code;
                    delete layer.properties.signal_fade;
                } else {
                    layer.properties.signal_reaction = value;
                    layer.properties.signal_code ??= 0;
                }
                details?.toggle(value !== 'none');
                update_links();
            },
        });
        details = $('<div>').appendTo(container);
        new SignalCodeWidget({
            editor: this,
            container: details,
            label: 'Code',
            hint: 'Alles mit demselben Code sendet dieser Ebene ein Signal. Ohne Code („Kein Signal“) reagiert die Ebene nicht.',
            // "Kein Signal": the layer no longer reacts (Bei Signal: reagiert nicht)
            clear: () => {
                delete layer.properties.signal_reaction;
                delete layer.properties.signal_code;
                delete layer.properties.signal_fade;
                setTimeout(() => this.setup_layer_properties(), 0);
                this.build_signal_links();
                this.render();
            },
            get: () => layer.properties.signal_code ?? 0,
            set: (value) => {
                layer.properties.signal_code = Math.round(value);
                update_links();
            },
        });
        new NumberWidget({
            container: details,
            label: 'Überblendung',
            hint: 'Wie lange die Ebene ein- oder ausgeblendet wird. 0 Sekunden: sofort. Ob man auf ihr stehen kann, ändert sich trotzdem sofort.',
            min: 0,
            max: SIGNAL_LAYER_FADE_MAX_SECONDS,
            step: 0.1,
            decimalPlaces: 1,
            width: '3em',
            suffix: 's',
            get: () => layer_fade_seconds(layer.properties),
            set: (value) => { layer.properties.signal_fade = value; },
        });
        details.toggle(layer_reacts_to_signals(layer.properties));
        links.appendTo(container);
        update_links();
    }

    // Level setting: when no enemy is left, the level sends a Code (signals.js).
    add_all_defeated_controls(box) {
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        let details = null;
        let delay_widget = null;
        let code_widget = null;
        const update = () => {
            const code = level.properties.signal_all_defeated;
            details?.toggle(Number.isInteger(code));
            links.text(Number.isInteger(code) ? describe_signal_partners(code, signal_partners(level, code,
                ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits), signal_name(level, code)) : '');
        };
        const toggle = new CheckboxWidget({
            container: box,
            label: 'sendet, wenn alle Gegner besiegt',
            hint: 'Sind alle Gegner in diesem Level besiegt, sendet das Level einen Code – zum Beispiel öffnet sich dann das Tor zum Ziel. Gegner auf einer Ebene, die noch nicht erschienen ist, zählen erst mit, wenn sie da sind: So kann die nächste Welle erscheinen, sobald die erste besiegt ist. Unverwundbare Gegner zählen nicht mit.',
            get: () => Number.isInteger(level.properties.signal_all_defeated),
            set: (on) => {
                if (on) level.properties.signal_all_defeated = free_signal_code(level);
                else {
                    delete level.properties.signal_all_defeated;
                    delete level.properties.signal_all_defeated_delay;
                    delay_widget?.refresh();
                }
                code_widget?.refresh();
                update();
            },
        });
        details = $('<div>').appendTo(box);
        code_widget = new SignalCodeWidget({
            editor: this,
            container: details,
            label: 'Code',
            // "Kein Signal": the level no longer sends it
            clear: () => {
                delete level.properties.signal_all_defeated;
                delete level.properties.signal_all_defeated_delay;
                toggle.refresh();
                delay_widget?.refresh();
                update();
                this.build_signal_links();
            },
            get: () => level.properties.signal_all_defeated ?? 0,
            set: (value) => {
                level.properties.signal_all_defeated = Math.round(value);
                update();
            },
        });
        // the overview can take this setting away: then the box shows it at once
        box.addClass('level-signal-controls').data('refresh', () => {
            toggle.refresh();
            code_widget?.refresh();
            delay_widget?.refresh();
            update();
        });
        // absent = 0 = at once (signals.js)
        delay_widget = new NumberWidget({
            container: details,
            label: 'Verzögerung',
            hint: 'Das Level sendet den Code erst so viele Sekunden, nachdem der letzte Gegner besiegt ist – zum Beispiel eine kurze Pause vor der nächsten Welle. 0: sofort.',
            min: 0,
            max: SIGNAL_DELAY_MAX_SECONDS,
            step: 0.5,
            decimalPlaces: 1,
            suffix: 's',
            get: () => level.properties.signal_all_defeated_delay ?? 0,
            set: (value) => {
                level.properties.signal_all_defeated_delay = value;
            },
        });
        links.appendTo(box);
        update();
    }

    // Level setting: the level sends a Code when it starts (signals.js, app.js
    // setup_signals) – with a Verzögerung a simple timer. Absent = nothing.
    add_level_start_controls(box) {
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        let details = null, code_widget = null, delay_widget = null;
        const update = () => {
            const code = level.properties.signal_level_start;
            details?.toggle(Number.isInteger(code));
            links.text(Number.isInteger(code) ? describe_signal_partners(code, signal_partners(level, code,
                ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits), signal_name(level, code)) : '');
            this.build_signal_links();
        };
        const toggle = new CheckboxWidget({
            container: box,
            label: 'sendet beim Start',
            hint: 'Das Level sendet einen Code mit „an“, sobald es beginnt (auch nach R im Test, aber nicht nach einem verlorenen Leben). Mit einer Verzögerung ist das eine Uhr: Nach so vielen Sekunden geht zum Beispiel das Tor zu, erscheint eine Brücke oder ist das Level geschafft („geschafft bei Signal“ mit demselben Code). Die Zeit läuft weiter, wenn die Spielfigur ein Leben verliert.',
            get: () => Number.isInteger(level.properties.signal_level_start),
            set: (on) => {
                if (on) level.properties.signal_level_start = free_signal_code(level);
                else {
                    delete level.properties.signal_level_start;
                    delete level.properties.signal_level_start_delay;
                }
                code_widget?.refresh();
                delay_widget?.refresh();
                update();
            },
        });
        details = $('<div>').appendTo(box);
        code_widget = new SignalCodeWidget({
            editor: this,
            container: details,
            label: 'Code',
            // "Kein Signal": the level sends nothing when it starts
            clear: () => {
                delete level.properties.signal_level_start;
                delete level.properties.signal_level_start_delay;
                toggle.refresh();
                delay_widget?.refresh();
                update();
            },
            get: () => level.properties.signal_level_start ?? 0,
            set: (value) => {
                level.properties.signal_level_start = Math.round(value);
                update();
            },
        });
        // absent = 0 = at once (signals.js)
        delay_widget = new NumberWidget({
            container: details,
            label: 'Verzögerung',
            hint: 'So viele Sekunden nach dem Start kommt das Signal an – eine Uhr für dein Level. 0: sofort.',
            min: 0,
            max: SIGNAL_DELAY_MAX_SECONDS,
            step: 0.5,
            decimalPlaces: 1,
            suffix: 's',
            get: () => level.properties.signal_level_start_delay ?? 0,
            set: (value) => {
                level.properties.signal_level_start_delay = value;
                this.build_signal_links();
            },
        });
        links.appendTo(box);
        // the overview can take this setting away: then the box shows it at once
        box.addClass('level-signal-controls').data('refresh', () => {
            toggle.refresh();
            code_widget?.refresh();
            delay_widget?.refresh();
            update();
        });
        update();
    }

    // Level setting "sendet, wenn die Spielfigur … hat" (signals.js
    // level_item_signals, app.js keep_item): a Code for each item that stays for
    // the whole game – sent when the level starts and the figure has it already,
    // or the moment it collects it. Stored as level.properties.item_signals
    // [{ sprite_id, signal_code }]; absent = none. Shown only in games where
    // something "bleibt fürs ganze Spiel" (or where the level has one already).
    add_item_signal_controls(box) {
        const level = this.game.data.levels[this.level_index];
        const sprites = () => this.game.data.sprites;
        const kept = (sprite) => sprite?.traits?.pickup?.keep === true;
        const list = () => Array.isArray(level.properties.item_signals) ? level.properties.item_signals : [];
        const changed = () => {
            this.build_signal_links();
            this.refresh_signal_overview?.();
            this.render();
        };
        const render = () => {
            box.empty();
            const first = sprites().findIndex(kept);
            if (first < 0 && !list().length) return;
            list().forEach((item, index) => {
                const row = $('<div class="item-signal">').appendTo(box);
                const links = $('<div class="signal-links">');
                const update = () => {
                    const code = stored_signal_code(item.signal_code);
                    links.text(code === null ? '' : describe_signal_partners(code, signal_partners(level, code,
                        ref => sprites()[this.game.sprite_index_for_ref(ref)]?.traits), signal_name(level, code)));
                };
                new SpriteSelectWidget({
                    container: row, label: 'sendet, wenn die Spielfigur … hat:',
                    hint: 'Hat die Spielfigur dieses Sprite in ihrem Inventar, sendet das Level den Code mit „an“ – gleich am Anfang, wenn sie es aus einem anderen Level mitbringt, sonst in dem Moment, in dem sie es hier einsammelt. So öffnet ein Schlüssel für das ganze Spiel jede Tür mit diesem Code. Zur Auswahl stehen Sprites mit „bleibt fürs ganze Spiel“.',
                    without_none: true,
                    filter: (sprite) => kept(sprite),
                    sprites,
                    get: () => {
                        const index = sprites().findIndex(sprite => sprite.id === item.sprite_id);
                        return index >= 0 ? String(index) : 'none';
                    },
                    set: (choice) => {
                        const sprite = sprites()[Number(choice)];
                        if (!sprite) return;
                        item.sprite_id = sprite.id;
                        delete item.sprite_index;
                        changed();
                    },
                });
                const code_widget = new SignalCodeWidget({
                    editor: this,
                    container: row,
                    label: 'Code',
                    hint: 'Diesen Code sendet das Level, wenn die Spielfigur das Sprite hat. Ohne Code („Kein Signal“) fällt diese Zeile weg.',
                    clear: () => {
                        this.clear_signal_object(level, { kind: 'level', setting: 'item_signals', index });
                        render();
                        changed();
                    },
                    get: () => item.signal_code ?? 0,
                    set: (value) => {
                        item.signal_code = Math.round(value);
                        update();
                        changed();
                    },
                });
                $('<button type="button" class="btn item-signal-remove">').append($('<i class="fa fa-trash">'))
                    .attr('title', 'Diese Zeile entfernen: Das Level sendet für dieses Sprite nichts mehr.')
                    .on('click', () => {
                        this.clear_signal_object(level, { kind: 'level', setting: 'item_signals', index });
                        render();
                        changed();
                    }).appendTo(code_widget.row);
                links.appendTo(row);
                update();
            });
            if (first < 0) return;
            $('<button type="button" class="btn item-signal-add">')
                .append($('<i class="fa fa-plus">')).append(document.createTextNode(' sendet, wenn die Spielfigur … hat'))
                .attr('title', 'Das Level sendet einen Code, sobald die Spielfigur etwas hat, das „bleibt fürs ganze Spiel“ – zum Beispiel einen Schlüssel aus einem anderen Level. Danach wählst du das Sprite und den Code.')
                .on('click', () => {
                    if (window.collaboration?.can_edit_current?.() === false) {
                        this.show_level_notice('Gerade bearbeitet jemand anderes dieses Level.');
                        return;
                    }
                    const entry = { sprite_id: sprites()[first].id, signal_code: free_signal_code(level) };
                    level.properties.item_signals = [...list(), entry];
                    render();
                    changed();
                }).appendTo(box);
        };
        // the overview can take a line away: then the box shows it at once
        box.addClass('level-signal-controls').data('refresh', render);
        render();
    }

    // Level setting: a Signal completes the level, like the exit (signals.js,
    // app.js complete_level). Absent = only the exit does.
    add_level_complete_controls(box) {
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        let details = null;
        let code_widget = null;
        const update = () => {
            const code = level.properties.signal_level_complete;
            details?.toggle(Number.isInteger(code));
            links.text(Number.isInteger(code) ? describe_signal_partners(code, signal_partners(level, code,
                ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits), signal_name(level, code)) : '');
            this.build_signal_links();
        };
        const toggle = new CheckboxWidget({
            container: box,
            label: 'geschafft bei Signal',
            hint: 'Kommt ein Signal mit diesem Code „an“, ist das Level geschafft – wie am Ziel, und es geht weiter zum nächsten Level. Zum Beispiel: Wähle hier denselben Code wie bei „sendet, wenn alle Gegner besiegt“, dann ist das Level geschafft, sobald kein Gegner mehr übrig ist. Das Ziel funktioniert weiterhin.',
            get: () => Number.isInteger(level.properties.signal_level_complete),
            set: (on) => {
                if (on) level.properties.signal_level_complete = free_signal_code(level);
                else {
                    delete level.properties.signal_level_complete;
                    delete level.properties.signal_level_complete_target;
                }
                code_widget?.refresh();
                update();
            },
        });
        details = $('<div>').appendTo(box);
        code_widget = new SignalCodeWidget({
            editor: this,
            container: details,
            label: 'Code',
            // "Kein Signal": only the exit completes the level again
            clear: () => {
                delete level.properties.signal_level_complete;
                delete level.properties.signal_level_complete_target;
                toggle.refresh();
                update();
            },
            get: () => level.properties.signal_level_complete ?? 0,
            set: (value) => {
                level.properties.signal_level_complete = Math.round(value);
                update();
            },
        });
        // where it goes on (level_flow.js): absent = the next level, as always
        new SelectWidget({
            container: details,
            label: 'führt zu',
            hint: 'Wohin es weitergeht, wenn das Signal das Level beendet – wie „führt zu“ bei einem Ausgang.',
            options: Object.fromEntries(this.level_target_choices(level.properties.signal_level_complete_target)),
            get: () => clean_level_target(level.properties.signal_level_complete_target) ?? '',
            set: (value) => {
                if (value) level.properties.signal_level_complete_target = value;
                else delete level.properties.signal_level_complete_target;
            },
        });
        links.appendTo(box);
        // the overview can take this setting away: then the box shows it at once
        box.addClass('level-signal-controls').data('refresh', () => {
            toggle.refresh();
            code_widget?.refresh();
            update();
        });
        update();
    }

    // A Bereich (layer type signal_area): its rectangles send the Code "an"
    // when the figure's centre enters them and "aus" when it leaves.
    add_area_signal_controls(layer) {
        const container = $('#menu_layer_properties');
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        const update_links = () => {
            const code = stored_signal_code(layer.properties.signal_code);
            links.text(code === null ? 'Kein Signal: Dieser Signalbereich sendet nichts.' : describe_signal_partners(code, signal_partners(level, code,
                ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits), signal_name(level, code)));
            this.build_signal_links();
            this.render();
        };
        new SignalCodeWidget({
            editor: this,
            container,
            label: 'Code',
            hint: 'Kommt die Mitte der Spielfigur in eines der Rechtecke, sendet der Signalbereich diesen Code mit „an“, geht sie wieder hinaus, mit „aus“. Ebenen und Türen mit demselben Code reagieren darauf – zum Beispiel verschwindet das Dach, solange man im Haus ist („weg, solange an“). Ohne Code („Kein Signal“) sendet der Signalbereich nichts. An der Bewegung ändert er nichts – dafür gibt es den Bewegungsbereich (Wasser, Schweben, Strömung).',
            // "Kein Signal": the Bereich sends nothing
            clear: () => {
                layer.properties.signal_code = null;
                update_links();
            },
            get: () => stored_signal_code(layer.properties.signal_code),
            set: (value) => {
                layer.properties.signal_code = Math.round(value);
                update_links();
            },
        });
        links.appendTo(container);
        update_links();
        // absent = 0 = at once (signals.js)
        new NumberWidget({
            container,
            label: 'Verzögerung',
            hint: '„an“ und „aus“ kommen erst so viele Sekunden später an – zum Beispiel fällt die Tür hinter der Spielfigur erst kurz nach dem Hineingehen zu. Beim Start des Levels und nach dem Verlieren eines Lebens zählt sofort, wo die Spielfigur ist. 0: sofort.',
            min: 0,
            max: SIGNAL_DELAY_MAX_SECONDS,
            step: 0.5,
            decimalPlaces: 1,
            suffix: 's',
            get: () => layer.properties.signal_delay ?? 0,
            set: (value) => {
                layer.properties.signal_delay = value;
            },
        });
    }

    setup_layer_properties() {
        let self = this;
        $('#menu_layer_properties').empty();
        let layer = self.game.data.levels[self.level_index].layers[self.layer_index];
        this.update_layer_settings_head();
        // a Hintergrund, Signalbereich or Bewegungsbereich has nothing else to
        // edit than these settings: they stay open for it
        window.set_folding_panel_forced?.('layer_settings', layer?.type !== 'sprites');

        new LineEditWidget({
            container: $('#menu_layer_properties'),
            label: 'Titel',
            hint: 'Gib jeder Ebene einen erkennbaren Namen, zum Beispiel »Haus 1 – Fassade«.',
            placeholder: () => `Ebene ${self.layer_index + 1}`,
            select_default: (value) => typeof is_default_name === 'function' && is_default_name(value, 'Ebene'),
            get: () => layer.properties.name,
            set: (name) => {
                layer.properties.name = name;
                $('#menu_layers').children('._dnd_item').eq(self.layer_index)
                    .find('.layer-name').text(name || `Ebene ${self.layer_index + 1}`).toggleClass('unnamed', !String(name ?? '').trim());
                self.update_layer_label();
                self.update_layer_settings_head();
            },
        });

        if (layer.type === 'sprites') {
            new CheckboxWidget({
                container: $('#menu_layer_properties'),
                label: 'Kollisionen erkennen',
                get: () => self.game.data.levels[self.level_index].layers[self.layer_index].properties.collision_detection,
                set: (x) => {
                    self.game.data.levels[self.level_index].layers[self.layer_index].properties.collision_detection = x;
                    // self.update_layer_label();
                },
            });
            self.add_layer_signal_controls(layer);
        }
        if (layer.type === 'backdrop' || layer.type === 'signal_area' || layer.type === 'movement_region') {
            let backdrop = layer;
            // -----------------------------------------------------------
            let rect_div = $('<div>').appendTo($('#menu_layer_properties'));
            // kept: a press on a rectangle in the view chooses it here, too (choose_rect)
            self.rects_widget = new DragAndDropWidget({
                game: self.game,
                container: rect_div,
                trash: $('#trash'),
                items: self.game.data.levels[self.level_index].layers[self.layer_index].rects,
                item_class: 'menu_layer_item',
                // a rectangle of a locked layer stays
                can_delete_index: () => !self.layer_locked(),
                step_aside_css: { top: '35px' },
                gen_item: (layer, index) => {
                    let rect_div = $(`<div>`).css('padding-top', '5px');
                    rect_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text(`Rechteck ${index + 1}`)));
                    return rect_div;
                },
                onclick: (e, index) => {
                    self.clear_selection();
                    // console.log(`layer click: ${index}`);
                    self.rect_index = index;
                    self.backdrop_controls_setup_for = null;
                    self.refresh_backdrop_controls();
                    self.refresh();
                    self.render();
                },
                gen_new_item: () => {
                    let x0 = Math.round(self.camera_x - self.width * 0.45 / self.scale);
                    let x1 = Math.round(self.camera_x + self.width * 0.45 / self.scale);
                    let y0 = Math.round(self.camera_y - self.height * 0.45 / self.scale);
                    let y1 = Math.round(self.camera_y + self.height * 0.45 / self.scale);
                    // let p;
                    // p = this.snap(x0, y0); x0 = p[0]; y0 = p[1];
                    // p = this.snap(x1, y1); x1 = p[0]; y1 = p[1];
                    let rect = { left: x0, bottom: y0, width: x1 - x0, height: y1 - y0 };
                    self.game.data.levels[self.level_index].layers[self.layer_index].rects.push(rect);
                    self.game.fix_game_data();
                    self.refresh();
                    return rect;
                },
                delete_item: (index) => {
                    self.game.data.levels[self.level_index].layers[self.layer_index].rects.splice(index, 1);
                    self.rect_index = 0;
                    self.refresh();
                    // self.render();
                },
                on_move_item: (from, to) => {
                    move_item_helper(self.game.data.levels[self.level_index].layers[self.layer_index].rects, from, to);
                    self.refresh();
                    self.render();
                }
            });

            if (layer.type === 'signal_area') {
                self.add_area_signal_controls(layer);
            } else if (layer.type === 'movement_region') {
                layer.movement ??= { mode: 'swim' };
                const box = $('<div>').appendTo($('#menu_layer_properties'));
                self.add_movement_controls(box, layer.movement, false);
                // a Schalter can switch the region on and off (a gravity that turns)
                self.add_layer_signal_controls(layer, 'Der Bereich kann an- und ausgehen, wenn etwas mit seinem Code ein Signal sendet: ein Schalter, eine Druckplatte, ein Schlüssel, ein Signalbereich oder ein besiegter Gegner. „erscheint“: am Anfang aus, beim ersten Signal „an“ an. „verschwindet“: am Anfang an, beim ersten Signal „an“ aus. „da, solange an“ und „weg, solange an“: folgt dem Signal. „wechselt“: jedes Signal schaltet ihn um. So dreht ein Schalter die Schwerkraft: ein Bereich über dem ganzen Level mit „Schwerkraft zieht nach oben“ und „wechselt“.');
            } else {
            // -----------------------------------------------------------
            new SelectWidget({
                container: $('#menu_layer_properties'),
                label: `Art`,
                options: {
                    'color': 'Farbe',
                    'effect': 'Effekt',
                },
                get: () => {
                    return `${backdrop.backdrop_type}`;
                },
                set: (x) => {
                    backdrop.backdrop_type = x;
                    self.game.fix_game_data();
                    self.setup_layer_properties();
                    self.backdrop_controls_setup_for = null;
                    self.refresh();
                    self.render();
                },
            });
            // backdrops.js: optional pixel look; nothing is stored until it is switched on
            new CheckboxWidget({
                container: $('#menu_layer_properties'),
                label: 'pixelig (wie Sprites)',
                hint: 'Der Hintergrund wird in der Auflösung des Spiels gezeichnet – ein Farbpunkt pro Spielpixel, genau wie bei den Sprites.',
                get: () => Boolean(backdrop.pixelated) || (backdrop.backdrop_type === 'color' && backdrop_dither_mode(backdrop) > 0),
                set: (x) => {
                    if (x) backdrop.pixelated = true; else delete backdrop.pixelated;
                    self.refresh();
                    self.render();
                },
            });
            if (backdrop.backdrop_type === 'color') {
                new SelectWidget({
                    container: $('#menu_layer_properties'),
                    label: 'Dithering',
                    hint: 'Der Farbverlauf wird auf wenige Farbstufen reduziert. Dazwischen mischen sich die Farben Pixel für Pixel – mit zufälligem Rauschen oder einem regelmäßigen Raster. Das sieht nach echter Pixel-Art aus.',
                    options: BACKDROP_DITHER,
                    get: () => backdrop.dither in BACKDROP_DITHER ? backdrop.dither : 'none',
                    set: (x) => {
                        if (x === 'noise' || x === 'bayer') backdrop.dither = x; else { delete backdrop.dither; delete backdrop.dither_levels; }
                        self.setup_layer_properties();
                        self.refresh();
                        self.render();
                    },
                });
                if (backdrop_dither_mode(backdrop) > 0) {
                    new NumberWidget({
                        container: $('#menu_layer_properties'),
                        label: 'Farbstufen',
                        hint: 'So viele Helligkeitsstufen hat jede Farbe. Wenige Stufen (2–4) sehen grob und körnig aus, viele (16–32) fein.',
                        min: BACKDROP_DITHER_LEVELS.min,
                        max: BACKDROP_DITHER_LEVELS.max,
                        step: 1,
                        decimalPlaces: 0,
                        get: () => backdrop_dither_levels(backdrop),
                        set: (x) => {
                            backdrop.dither_levels = x;
                            self.refresh();
                            self.render();
                        },
                    });
                }
            }
            if (backdrop.backdrop_type === 'color') {
                new SelectWidget({
                    container: $('#menu_layer_properties'),
                    label: `Farben`,
                    options: {
                        '1': 'einfarbig',
                        '2': 'zwei Farben',
                        '4': 'vier Farben',
                    },
                    get: () => {
                        return `${backdrop.colors.length}`;
                    },
                    set: (x) => {
                        if (x === '1') {
                            backdrop.colors = backdrop.colors.splice(0, 1);
                        } else if (x === '2') {
                            backdrop.colors = [['#143b86', 0.5, 0.9], ['#c3def1', 0.5, 0.1]];
                        } else if (x === '4') {
                            backdrop.colors = [['#e7e6e1', 0.1, 0.1], ['#c3def1', 0.9, 0.1], ['#12959f', 0.1, 0.9], ['#b296c7', 0.9, 0.9]];
                        }
                        if (backdrop.colors.length !== 2) delete backdrop.gradient;
                        self.setup_layer_properties();
                        self.backdrop_controls_setup_for = null;
                        self.refresh();
                        self.render();
                    },
                });
                // backdrops.js: absent = straight, as always
                if (backdrop.colors.length === 2) {
                    new SelectWidget({
                        container: $('#menu_layer_properties'),
                        label: 'Verlauf',
                        hint: 'Gerade: die Farben gehen von einem Punkt zum anderen ineinander über, wie beim Himmel. Rund: Farbe 1 liegt in der Mitte, und nach außen hin wird es immer mehr Farbe 2 – wie das Leuchten um eine Lampe, die Sonne oder einen Lichtkegel. Der zweite Punkt bestimmt, wie groß der Kreis ist.',
                        options: BACKDROP_GRADIENTS,
                        get: () => backdrop_gradient_radial(backdrop) ? 'radial' : 'linear',
                        set: (x) => {
                            if (x === 'radial') backdrop.gradient = 'radial'; else delete backdrop.gradient;
                            self.backdrop_controls_setup_for = null;
                            self.refresh();
                            self.render();
                        },
                    });
                }
                for (let ci = 0; ci < backdrop.colors.length; ci++) {
                    new ColorWidget({
                        container: $('#menu_layer_properties'),
                        label: `Farbe ${ci + 1}`,
                        alpha: true,
                        get: () => {
                            let c = backdrop.colors[ci][0];
                            if (c.length == 7) c += 'ff';
                            return c;
                        },
                        set: (x) => {
                            if (`color_${ci}` in self.backdrop_move_elements)
                                self.backdrop_move_elements[`color_${ci}`].css('background-color', x);
                            backdrop.colors[ci][0] = x;
                            self.refresh();
                            self.render();
                        },
                    });
                }
            }
            if (backdrop.backdrop_type === 'effect') {
                new SelectWidget({
                    container: $('#menu_layer_properties'),
                    label: `Effekt`,
                    options: BACKDROP_EFFECTS,
                    get: () => {
                        return `${backdrop.effect}`;
                    },
                    set: (x) => {
                        backdrop.effect = x;
                        self.setup_layer_properties();
                        self.backdrop_controls_setup_for = null;
                        self.refresh();
                        self.render();
                    },
                });
                new ColorWidget({
                    container: $('#menu_layer_properties'),
                    label: 'Farbe',
                    alpha: true,
                    get: () => self.game.data.levels[self.level_index].layers[self.layer_index].color ?? '#ffffffff',
                    set: (x) => {
                        self.game.data.levels[self.level_index].layers[self.layer_index].color = x;
                        self.refresh();
                        self.render();
                    },
                });
                new NumberWidget({
                    container: $('#menu_layer_properties'),
                    label: 'Skalierung',
                    min: 0.0,
                    max: 20.0,
                    step: 0.01,
                    decimalPlaces: 2,
                    get: () => self.game.data.levels[self.level_index].layers[self.layer_index].scale,
                    set: (x) => {
                        self.game.data.levels[self.level_index].layers[self.layer_index].scale = x;
                        // self.update_layer_label();
                        self.refresh();
                        self.render();
                    },
                });
                new NumberWidget({
                    container: $('#menu_layer_properties'),
                    label: 'Geschwindigkeit',
                    min: 0.0,
                    max: 20.0,
                    step: 0.01,
                    decimalPlaces: 2,
                    get: () => self.game.data.levels[self.level_index].layers[self.layer_index].speed,
                    set: (x) => {
                        self.game.data.levels[self.level_index].layers[self.layer_index].speed = x;
                        // self.update_layer_label();
                        self.refresh();
                        self.render();
                    },
                });
                if (BACKDROP_DENSITY_EFFECTS.includes(backdrop.effect)) {
                    new NumberWidget({
                        container: $('#menu_layer_properties'),
                        label: 'Menge',
                        hint: 'Wie dicht es schneit, regnet oder staubt: 1 ist normal, 0,5 die Hälfte, 2 doppelt so viel.',
                        min: BACKDROP_DENSITY.min,
                        max: BACKDROP_DENSITY.max,
                        step: 0.1,
                        decimalPlaces: 1,
                        get: () => backdrop_density(backdrop),
                        set: (x) => {
                            // 1 = the old amount: keep old games unchanged
                            if (Math.abs(x - 1) < 1e-6) delete backdrop.density; else backdrop.density = x;
                            self.refresh();
                            self.render();
                        },
                    });
                }
                // settings of this effect only (Gewitter: how often, how bright …)
                for (const [key, option] of Object.entries(BACKDROP_EFFECT_OPTIONS[backdrop.effect] ?? {})) {
                    const set = (x) => {
                        backdrop[key] = x;
                        self.refresh();
                        self.render();
                    };
                    if (option.type === 'bool') {
                        new CheckboxWidget({ container: $('#menu_layer_properties'), label: option.label, hint: option.hint,
                            get: () => backdrop_effect_option(backdrop, key), set: (x) => set(Boolean(x)) });
                    } else {
                        new NumberWidget({ container: $('#menu_layer_properties'), label: option.label, hint: option.hint,
                            min: option.min, max: option.max, step: option.step, decimalPlaces: option.decimalPlaces, suffix: option.suffix,
                            get: () => backdrop_effect_option(backdrop, key), set });
                    }
                }
            }
            }
        }
        // $('#menu_layer_properties').append($('<hr />'));
        if (layer.type === 'sprites' || layer.type === 'backdrop') {
            new SelectWidget({
                container: $('#menu_layer_properties'),
                label: 'Mischmodus',
                hint: 'So wird die Ebene mit allem dahinter gemischt. Leuchten: Farben werden addiert (Licht, Feuer). Aufhellen: wie Leuchten, aber sanfter (Geister, Nebel). Abdunkeln: Farben werden multipliziert (Schatten, getöntes Glas, Wasser). Normal: jeder Sprite behält seinen eigenen Mischmodus.',
                options: BLEND_MODES,
                get: () => self.game.data.levels[self.level_index].layers[self.layer_index].properties.blend ?? 'normal',
                set: (x) => {
                    const props = self.game.data.levels[self.level_index].layers[self.layer_index].properties;
                    if (x === 'normal') delete props.blend; else props.blend = x;
                    self.refresh_blend_materials();
                    self.refresh();
                    self.render();
                },
            });
        }
        // a Hintergrund (darkness, an effect) can appear and disappear, too
        if (layer.type === 'backdrop') self.add_layer_signal_controls(layer);
        if (layer.type !== 'signal_area' && layer.type !== 'movement_region') {
        new NumberWidget({
            container: $('#menu_layer_properties'),
            label: 'Parallaxe',
            min: -1,
            max: 1,
            step: 0.1,
            decimalPlaces: 2,
            get: () => self.game.data.levels[self.level_index].layers[self.layer_index].properties.parallax,
            set: (x) => {
                self.game.data.levels[self.level_index].layers[self.layer_index].properties.parallax = x;
                // self.update_layer_label();
                self.refresh();
                self.render();
            },
        });
        }
    }

    // Settings of a Bewegungsbereich (movement_regions.js). settings: the layer's
    // movement object – or null for the whole level (level.properties.movement,
    // which is only stored once something other than "normal" is chosen).
    add_movement_controls(box, settings, whole_level) {
        const self = this;
        box.empty();
        const level = () => self.game.data.levels[self.level_index];
        const get = () => whole_level ? level().properties.movement ?? null : settings;
        const modes = whole_level ?
            { none: 'normal (wie immer)', normal: 'Laufen – andere Schwerkraft', swim: 'Schwimmen', float: 'Schweben' } :
            { swim: 'Schwimmen', float: 'Schweben', normal: 'Laufen – andere Schwerkraft', inherit: 'wie darunter (nur Strömung)' };
        const current_mode = () => get()?.mode ?? (whole_level ? 'none' : 'swim');
        new SelectWidget({
            container: box,
            label: whole_level ? 'Bewegung im ganzen Level' : 'Bewegung',
            hint: 'Schwimmen: Die Pfeiltasten steuern in alle Richtungen, die Sprungtaste ist ein Schwimmzug, das Wasser trägt und bremst. ' +
                'Schweben: keine Schwerkraft, die Figur gleitet lange weiter – wie im Weltall. ' +
                'Laufen – andere Schwerkraft: laufen und springen wie immer, aber leichter oder schwerer (der Mond). ' +
                (whole_level ? '' : 'Wie darunter: ändert nichts, fügt nur eine Strömung hinzu – ein Sog im Wasser darunter. ') +
                'Liegen Bereiche übereinander, gilt der vorderste. Die Strömungen aller Bereiche zählen zusammen. Gegner, die laufen, schwimmen und schweben hier auch – ein Jäger schwimmt dir in alle Richtungen nach. Aus ihrem Bereich kommen Gegner nicht heraus. Flatterer und Stampfer merken nichts davon.',
            options: modes,
            get: () => current_mode(),
            set: (mode) => {
                if (whole_level) {
                    if (mode === 'none') delete level().properties.movement;
                    else level().properties.movement = { ...(level().properties.movement ?? {}), mode };
                } else {
                    settings.mode = mode;
                }
                // the other settings have different defaults per mode
                for (const key of ['gravity', 'glide', 'speed', 'stroke'])
                    delete get()?.[key];
                self.add_movement_controls(box, settings, whole_level);
            },
        });
        const mode = current_mode();
        if (mode === 'none') return;
        const defaults = MovementRegions.DEFAULTS[mode] ?? {};
        const number = (key, options) => new NumberWidget({
            container: box, ...options,
            get: () => get()?.[key] ?? defaults[key],
            set: (value) => {
                if (!Number.isFinite(value) || value < options.min || value > options.max) return;
                get()[key] = value;
            },
        });
        if (mode !== 'inherit') {
            number('gravity', { label: 'Schwerkraft', suffix: '%', min: 0, max: 300, step: 5, decimalPlaces: 0,
                hint: 'Wie stark die Schwerkraft hier zieht – in Prozent der Schwerkraft des Spiels. 100 % wie immer, 17 % wie auf dem Mond, 0 %: gar nicht. Im Wasser hält der Auftrieb dagegen: 20 % lässt die Figur langsam sinken.' });
        }
        if (mode === 'swim' || mode === 'float') {
            number('glide', { label: 'Gleiten', suffix: '%', min: 0, max: 99, step: 1, decimalPlaces: 0,
                hint: 'Wie lange die Figur weitertreibt, wenn du loslässt. 0 %: sie bleibt sofort stehen. 90 %: wie im Wasser. 97 % und mehr: wie im Weltall.' });
            number('speed', { label: 'Tempo', suffix: '×', min: 0.1, max: 5, step: 0.1, decimalPlaces: 1,
                hint: 'So schnell wird die Figur hier – als Vielfaches ihrer Geschwindigkeit.' });
        }
        if (mode === 'swim') {
            number('stroke', { label: 'Schwimmzug', suffix: '×', min: 0, max: 3, step: 0.1, decimalPlaces: 1,
                hint: 'Wie kräftig ein Druck auf die Sprungtaste nach oben schwimmt – als Vielfaches der Sprungkraft. Direkt unter der Wasseroberfläche springt die Figur damit aus dem Wasser. 0: Die Sprungtaste macht im Wasser nichts.' });
        }
        if (mode !== 'inherit') {
            new SelectWidget({
                container: box, label: 'Schwerkraft zieht nach',
                hint: 'Wohin die Schwerkraft hier zieht. Nach links, oben oder rechts: Die Spielfigur und laufende Gegner drehen sich mit – ihr Boden ist dann eine Wand oder die Decke. Die Kamera dreht sich mit der Spielfigur, so bleibt sie auf dem Bildschirm aufrecht – oder sie bleibt, wie sie ist (Kamera). Schräge und Leitern gehen nur, wenn die Schwerkraft nach unten zieht; sonst ist eine Schräge ein Block. Mit „Bei Signal“ kann ein Schalter den Bereich an- und ausschalten.',
                options: { down: 'unten (wie immer)', left: 'links', up: 'oben', right: 'rechts' },
                get: () => get()?.direction ?? 'down',
                set: (value) => {
                    if (value === 'down') {
                        delete get().direction;
                        delete get().turn_seconds;
                        delete get().camera;
                    } else get().direction = value;
                    self.add_movement_controls(box, settings, whole_level);
                    self.render();
                },
            });
            if (get()?.direction) {
                const [lo, hi] = MovementRegions.TURN_LIMITS;
                new NumberWidget({
                    container: box, label: 'Drehdauer', suffix: 's', min: lo, max: hi, step: 0.1, decimalPlaces: 1,
                    hint: 'Wie lange das Drehen dauert, wenn die Spielfigur in diesen Bereich kommt – und wieder hinaus. Die Schwerkraft wechselt genau in der Mitte. Ohne Änderung: 2 Sekunden. 0 Sekunden: sofort.',
                    get: () => get()?.turn_seconds ?? MovementRegions.TURN_SECONDS,
                    set: (value) => { if (Number.isFinite(value) && value >= lo && value <= hi) get().turn_seconds = value; },
                });
                new SelectWidget({
                    container: box, label: 'Kamera',
                    hint: 'Was die Kamera macht, wenn sich die Schwerkraft dreht. „dreht sich mit“: Die Spielfigur bleibt auf dem Bildschirm aufrecht, die Welt dreht sich um sie. „bleibt – Pfeiltasten wie auf dem Bildschirm“: Die Kamera bleibt, die Spielfigur steht an der Wand oder hängt an der Decke; an der rechten Wand läuft sie mit ↑ hinauf, an der Decke mit → nach rechts. „bleibt – Pfeiltasten wie für die Figur“: Die Kamera bleibt, und → ist immer „vorwärts“ für die Figur – an der Decke läuft sie damit auf dem Bildschirm nach links.',
                    options: { turn: 'dreht sich mit', fixed: 'bleibt – Pfeiltasten wie auf dem Bildschirm', fixed_figure: 'bleibt – Pfeiltasten wie für die Figur' },
                    get: () => get()?.camera ?? 'turn',
                    set: (value) => {
                        if (value === 'turn') delete get().camera;
                        else get().camera = value;
                    },
                });
            }
        }
        const current = () => get()?.current ?? {};
        const set_current = (key, value) => {
            const c = { ...(get().current ?? {}), [key]: value };
            if (!(c.speed > 0) && !c.angle) delete get().current;
            else get().current = c;
        };
        new NumberWidget({
            container: box, label: 'Strömung', suffix: 'px/s', min: 0, max: 1200, step: 10, decimalPlaces: 0,
            hint: 'Wie schnell die Figur hier in eine Richtung gezogen wird – eine Strömung, ein Sog, ein Wind. 0: keine.',
            get: () => current().speed ?? 0,
            set: (value) => { if (Number.isFinite(value) && value >= 0 && value <= 1200) set_current('speed', value); },
        });
        new NumberWidget({
            container: box, label: 'Richtung', suffix: '°', min: 0, max: 359, step: 15, decimalPlaces: 0,
            hint: 'Wohin die Strömung zieht: 0° nach rechts, 90° nach oben, 180° nach links, 270° nach unten. Jeder Winkel dazwischen geht auch.',
            get: () => current().angle ?? 0,
            set: (value) => { if (Number.isFinite(value) && value >= 0 && value <= 359) set_current('angle', value); },
        });
    }

    // The choices of a "führt zu" field of this level (level_flow.js). A target
    // whose level was deleted stays visible, and so does the Delta of an older
    // game's exit (old_delta: a number other than 1), so nothing changes by itself.
    level_target_choices(current, old_delta = null) {
        const levels = this.game.data.levels;
        const options = level_target_options(levels, this.level_index);
        const t = clean_level_target(current);
        if (t && !options.some(([value]) => value === t))
            options.splice(options.length - 1, 0, [t, t === levels[this.level_index]?.id ? 'dieses Level' : 'ein Level, das es nicht mehr gibt']);
        if (!t && Number.isInteger(old_delta)) {
            const to = next_level_in_sequence(levels, this.level_index, old_delta);
            const where = to >= 0 && to < levels.length ? `»${level_display_name(levels, to)}«` : 'zum Spielende';
            options.unshift([LEVEL_TARGET_DELTA, `${where} (${old_delta > 1 ? `${old_delta - 1} Level überspringen` : `${Math.abs(old_delta - 1)} Level zurück`}, von früher)`]);
        }
        return options;
    }

    update_level_label(li) {
        if (typeof(li) === 'undefined') li = this.level_index;
        // without a Titel: "Level 3", shown dimmed – it can (and should) be named
        const named = String(this.game.data.levels[li].properties.name ?? '').trim() !== '';
        let label = $('<div>').text(level_display_name(this.game.data.levels, li)).toggleClass('unnamed', !named);
        // a Nebenlevel (level_flow.js) is not part of the order
        if (this.game.data.levels[li].properties.side_level === true)
            label.prepend($('<i class="fa fa-level-up level-side-mark">').attr('title', 'Nebenlevel: nur durch einen Ausgang erreichbar'));
        if (!this.game.data.levels[li].properties.use_level) {
            label.css('text-decoration', 'line-through');
            label.css('opacity', 0.6);
        }
        label.css('white-space', 'nowrap');
        label.css('margin', '6px 5px');
        label.css('pointer-events', 'none');
        this.label_for_level[li].empty().append(label);
        if (li === this.level_index) this.update_level_settings_head();
        // names and Nebenlevel are on the Levelübersicht, too
        this.refresh_level_map?.();
    }

    // ------------------------------------------------ Levelübersicht (L)
    // Every level of the game and where its exits lead (level_map.js), over the
    // level view. A level is a node with its name; arrows are exits
    // (grey: the next level, yellow: a chosen level, dashed: "zurück", green:
    // the end). Clicking a card opens the level, clicking an arrow shows its
    // exit. Built again only when what it shows changes.
    refresh_level_map() {
        let panel = $(this.element).find('.level-map');
        const levels = this.game.data?.levels;
        if (!this.show_level_map || !levels?.length) {
            panel.remove();
            this.level_map_key = null;
            return;
        }
        const traits_of = (ref) => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits ?? null;
        const map = level_map(levels, traits_of);
        const key = JSON.stringify([this.level_index, map]);
        if (panel.length && key === this.level_map_key) return;
        this.level_map_key = key;
        const scroll = panel.find('.level-map-body').scrollLeft() ?? 0;
        panel.remove();
        panel = $('<div class="level-map">').appendTo(this.element);
        // the level view must not paint, zoom or pan through the map
        panel.on('mousedown touchstart dblclick wheel contextmenu', (e) => e.stopPropagation());
        const head = $('<div class="level-map-head">').appendTo(panel);
        $('<span class="level-map-title">').text('Levelübersicht').appendTo(head);
        const legend = $('<span class="level-map-legend">').appendTo(head);
        for (const [kind, text] of [['next', 'nächstes Level'], ['target', 'gewähltes Level'], ['back', 'zurück'], ['end', 'Spielende'], ['order', 'Reihenfolge (noch ohne Ausgang)']])
            $('<span>').addClass(`level-map-key level-map-key-${kind}`).text(text).appendTo(legend);
        $('<button class="level-map-close" title="Schließen (L)">').append($('<i class="fa fa-times">'))
            .on('click', () => this.set_view_option('show_level_map', false)).appendTo(head);
        const body = $('<div class="level-map-body">').appendTo(panel);

        const W = 150, H = 52, GX = 80, GY = 34, PAD = 24;
        const pos = (column, row) => ({ x: PAD + column * (W + GX), y: PAD + row * (H + GY) });
        const width = PAD * 2 + map.columns * (W + GX) - GX + 8, height = PAD * 2 + Math.max(1, map.rows) * (H + GY) - GY + 30;
        const area = $('<div class="level-map-area">').css({ width: `${width}px`, height: `${height}px` }).appendTo(body);
        const svg = $(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
            .attr({ width, height, class: 'level-map-lines' }).appendTo(area);
        const defs = $(document.createElementNS('http://www.w3.org/2000/svg', 'defs')).appendTo(svg);
        for (const kind of ['next', 'target', 'back', 'end', 'order']) {
            const marker = $(document.createElementNS('http://www.w3.org/2000/svg', 'marker'))
                .attr({ id: `level-map-arrow-${kind}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' })
                .appendTo(defs);
            $(document.createElementNS('http://www.w3.org/2000/svg', 'path')).attr({ d: 'M0,0 L10,5 L0,10 z', class: `level-map-arrowhead level-map-${kind}` }).appendTo(marker);
        }
        const box_of = (to) => to === 'end' ? pos(map.end.column, map.end.row) : pos(map.nodes[to].column, map.nodes[to].row);
        // several arrows between the same two levels (and direction) lie side by side
        const pair_of = (edge) => `${edge.from}>${edge.to}`;
        const pair_total = new Map();
        for (const edge of map.edges) pair_total.set(pair_of(edge), (pair_total.get(pair_of(edge)) ?? 0) + 1);
        const pair_count = new Map();
        for (const edge of map.edges) {
            const a = box_of(edge.from), b = box_of(edge.to);
            const pair = pair_of(edge);
            const nth = pair_count.get(pair) ?? 0;
            pair_count.set(pair, nth + 1);
            // −…+ around the middle line
            const spread = (nth - ((pair_total.get(pair) ?? 1) - 1) / 2) * 22;
            const shift = Math.max(0, spread);
            // Every arrow leaves its node on the line from the node's middle
            // towards where it goes, and comes in on the line towards the middle
            // of the node it points at – its head points at that middle, after a
            // straight piece (END) so it never sits on a bend.
            const END = 12, PAD = 3;
            const centre = (box) => ({ x: box.x + W / 2, y: box.y + H / 2 });
            // where the line from a node's middle towards (tx, ty) leaves the node (and PAD beyond)
            const rim = (box, tx, ty) => {
                const c = centre(box);
                const dx = tx - c.x, dy = ty - c.y, len = Math.hypot(dx, dy) || 1;
                const ux = dx / len, uy = dy / len;
                const t = Math.min(Math.abs(ux) > 1e-6 ? (W / 2) / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? (H / 2) / Math.abs(uy) : Infinity) + PAD;
                return { x: c.x + ux * t, y: c.y + uy * t, ux, uy };
            };
            const ca = centre(a), cb = centre(b);
            const forward = b.x > a.x;
            // forward: straight towards the other node (side by side: shifted);
            // back to the left or within a column: through a point below both
            let via_a, via_b;
            if (forward) {
                // side by side: aimed from points beside the other node's middle,
                // so each leaves and arrives at its own place, still towards the middle
                const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
                const nx = -(cb.y - ca.y) / len, ny = (cb.x - ca.x) / len;
                via_a = { x: cb.x + nx * spread * 3, y: cb.y + ny * spread * 3 };
                via_b = { x: ca.x + nx * spread * 3, y: ca.y + ny * spread * 3 };
            } else {
                const dip = Math.max(a.y, b.y) + H + 30 + Math.abs(spread);
                via_a = via_b = { x: (ca.x + cb.x) / 2 + spread, y: dip };
            }
            const s0 = rim(a, via_a.x, via_a.y);
            const tip = rim(b, via_b.x, via_b.y);
            const q = { x: tip.x + tip.ux * END, y: tip.y + tip.uy * END };
            const k = Math.max(24, Math.hypot(q.x - s0.x, q.y - s0.y) / 3);
            const c1 = { x: s0.x + s0.ux * k, y: s0.y + s0.uy * k }, c2 = { x: q.x + tip.ux * k, y: q.y + tip.uy * k };
            const d = `M${s0.x},${s0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${q.x},${q.y} L${tip.x},${tip.y}`;
            // the middle of the curve, for its badge
            const mid = { x: (s0.x + 3 * c1.x + 3 * c2.x + q.x) / 8, y: (s0.y + 3 * c1.y + 3 * c2.y + q.y) / 8 };
            const group = $(document.createElementNS('http://www.w3.org/2000/svg', 'g')).addClass('level-map-edge').appendTo(svg);
            $(document.createElementNS('http://www.w3.org/2000/svg', 'path')).attr({ d, class: `level-map-line level-map-${edge.kind}`,
                'marker-end': `url(#level-map-arrow-${edge.kind})` }).appendTo(group);
            // a wide invisible path makes the arrow easy to click
            const hit = $(document.createElementNS('http://www.w3.org/2000/svg', 'path')).attr({ d, class: 'level-map-hit' }).appendTo(group);
            const exit = edge.exits.find(e => !e.signal) ?? edge.exits[0];
            const where = edge.to === 'end' ? 'zum Spielende' : `nach »${map.nodes[edge.to].name}«`;
            const title = edge.kind === 'order' ?
                `»${map.nodes[edge.from].name}« hat noch keinen Ausgang. Bekommt es einen, führt er ${where} – klicken, um das Level zu öffnen` :
                `${edge.exits.length > 1 ? `${edge.exits.length} Ausgänge` : exit.signal ? '„geschafft bei Signal“' : 'Ausgang'} in »${map.nodes[edge.from].name}« ` +
                `${edge.kind === 'back' ? `führt zurück nach »${map.nodes[edge.to].name}«` : `führt ${where}`}` +
                (exit.signal ? '' : ' – klicken, um ihn zu zeigen') +
                // what opens it (level_map.js level_map_gate)
                [...new Set(edge.exits.map(e => e.gate?.text).filter(Boolean))].map(text => `\n${text}`).join('');
            $(document.createElementNS('http://www.w3.org/2000/svg', 'title')).text(title).appendTo(group);
            if (edge.kind === 'order') hit.on('click', () => {
                this.open_level_from_map(edge.from);
                this.show_level_notice('Setz ein Sprite mit der Eigenschaft „Levelwechsel“ ins Level – das ist der Ausgang. Wohin er führt, stellst du bei ihm unter „führt zu“ ein.', 7000);
            });
            else if (!exit.signal) hit.on('click', () => this.show_level_map_exit(edge.from, exit));
            const badges = [];
            if (edge.exits.some(e => e.action_key)) badges.push('F');
            // ⚡: it waits for a Signal (geschafft bei Signal, or its layer reacts to one)
            if (edge.exits.some(e => e.signal || e.gate)) badges.push('⚡');
            if (edge.exits.length > 1) badges.push(`×${edge.exits.length}`);
            const never = edge.exits.every(e => e.gate?.closed && e.gate.senders && !e.gate.senders.length);
            if (badges.length) $('<div class="level-map-badge">').text(badges.join(' ')).attr('title', title)
                .toggleClass('never', never && edge.exits.some(e => e.gate))
                .css({ left: `${mid.x}px`, top: `${mid.y}px` }).appendTo(area);
        }
        for (const node of map.nodes) {
            const { x, y } = pos(node.column, node.row);
            const card = $('<div class="level-map-card">').css({ left: `${x}px`, top: `${y}px`, width: `${W}px`, height: `${H}px` })
                .toggleClass('current', node.index === this.level_index).toggleClass('unused', !node.used)
                .toggleClass('side', node.side).toggleClass('warn', node.warnings.length > 0)
                .attr('title', [`${node.name} – klicken, um das Level zu öffnen`, ...node.warnings, ...node.hints].join('\n'))
                .on('click', () => this.open_level_from_map(node.index))
                .appendTo(area);
            const label = $('<div class="level-map-name">').appendTo(card);
            if (node.start) $('<i class="fa fa-play level-map-start">').attr('title', 'Hier beginnt das Spiel').appendTo(label);
            if (node.side) $('<i class="fa fa-level-up level-side-mark">').attr('title', 'Nebenlevel').appendTo(label);
            $('<span>').text(node.name).appendTo(label);
            const tags = $('<div class="level-map-tags">').appendTo(card);
            if (!node.used) $('<span>').text('nicht verwendet').appendTo(tags);
            else if (node.side) $('<span>').text('Nebenlevel').appendTo(tags);
            if (node.warnings.length) $('<span class="level-map-warn">').append($('<i class="fa fa-exclamation-triangle">'),
                document.createTextNode(` ${node.warnings.length}`)).appendTo(tags);
            else if (node.hints.length) $('<span class="level-map-hint">').append($('<i class="fa fa-info-circle">'),
                document.createTextNode(' kein Ausgang')).appendTo(tags);
        }
        const end = pos(map.end.column, map.end.row);
        $('<div class="level-map-end">').css({ left: `${end.x}px`, top: `${end.y}px`, height: `${H}px` })
            .toggleClass('unreachable', !map.end_reachable)
            .append($('<i class="fa fa-flag-checkered">'), $('<span>').text('Spielende'))
            .attr('title', map.end_reachable ? 'THE END: hier ist das Spiel geschafft' : 'Kein Weg führt vom ersten Level bis hierher')
            .appendTo(area);
        // what is wrong, in words (also on the cards), and how connections are made
        const notes = [];
        if (!map.end_reachable) notes.push(['', 'Vom ersten Level aus führt kein Weg zum Spielende.', 'warn']);
        for (const node of map.nodes) for (const w of node.warnings) notes.push([node.name, w, 'warn']);
        for (const node of map.nodes) for (const h of node.hints) notes.push([node.name, h, 'hint']);
        const list = $('<div class="level-map-notes">').appendTo(panel);
        for (const [name, text, kind] of notes) {
            const line = $('<div>').addClass(`level-map-note-${kind}`)
                .append($(`<i class="fa ${kind === 'warn' ? 'fa-exclamation-triangle' : 'fa-info-circle'}">`));
            if (name) $('<b>').text(` ${name}: `).appendTo(line);
            else line.append(document.createTextNode(' '));
            line.append(document.createTextNode(text)).appendTo(list);
        }
        $('<div class="level-map-help">').text('Jeder Pfeil ist ein Ausgang – ein Sprite mit der Eigenschaft „Levelwechsel“. ' +
            'Normalerweise führt er zum nächsten Level der Liste. Wohin er sonst führt, stellst du beim Ausgang im Level unter „führt zu“ ein: ' +
            'klick auf einen Pfeil, um ihn zu zeigen. ⚡ heißt: der Ausgang wartet auf ein Signal (fahr mit der Maus über den Pfeil, um zu sehen, auf welches und wer es sendet).').appendTo(list);
        // a wide game: smaller, so that it fits (up to a point, then it scrolls)
        const avail = body[0].clientWidth - 4, tall = body[0].clientHeight - 4;
        const fit = Math.min(1, avail / width, Math.max(0.6, tall / height));
        if (fit < 1) area.css('zoom', Math.max(0.55, fit));
        body.scrollLeft(scroll);
    }

    open_level_from_map(index) {
        this.set_view_option('show_level_map', false);
        if (index !== this.level_index) this.levels_widget?.select_index(index);
    }

    // An arrow of the map: its level, and the exit selected in its layer.
    show_level_map_exit(level_index, exit) {
        this.open_level_from_map(level_index);
        if (Number.isInteger(exit?.layer) && Number.isInteger(exit?.index))
            this.pick_signal_overview_object({ kind: 'sprite', layer_index: exit.layer, placed_index: exit.index });
    }

    // Double-click with the select tool: the sprite under the mouse is selected
    // in whichever layer it lies (level_selection.js placed_sprites_at), and that
    // layer becomes the current one. Again at the same spot: the sprite behind.
    // With the hand tool, a double-click on a sprite says the same – the
    // select tool takes over and selects it (on empty ground nothing changes).
    handle_double_click(e) {
        const tool = menus.level.active_key;
        if (tool !== 'tool/select' && tool !== 'tool/pan') return;
        const level = this.game.data.levels[this.level_index];
        const touch = this.get_touch_point(e);
        // the point in each layer's own coordinates (as ui_to_world, per Parallaxe)
        const point_of = (li) => {
            const parallax = level.layers[li]?.properties?.parallax ?? 0;
            return [this.camera_x + (touch[0] - this.width / 2) / this.scale - this.camera_x * parallax,
                this.camera_y - (touch[1] - this.height / 2) / this.scale - this.camera_y * parallax];
        };
        const size_of = (ref) => this.game.data.sprites[this.game.sprite_index_for_ref(ref)] ?? null;
        const hits = placed_sprites_at(level.layers, point_of, size_of);
        const last = this.last_pick;
        const same_spot = last && last.level_index === this.level_index &&
            Math.hypot(touch[0] - last.x, touch[1] - last.y) < 4;
        const pick = next_pick(hits, same_spot ? last.hit : null);
        if (!pick) return;
        if (tool === 'tool/pan') menus.level.handle_click('tool/select');
        this.last_pick = { x: touch[0], y: touch[1], level_index: this.level_index, hit: pick };
        if (pick.layer_index !== this.layer_index) {
            // like clicking the layer in the list (properties, panel, undo)
            $('#menu_layers > ._dnd_item').eq(pick.layer_index).children().eq(0).trigger('click');
            const layer = level.layers[pick.layer_index];
            this.show_level_notice?.(`Ausgewählt in der Ebene »${layer.properties.name || `Ebene ${pick.layer_index + 1}`}«`);
        }
        this.selection = [pick.placed_index];
        this.placed_properties_for = null;
        this.show_selection();
        this.refresh();
        this.render();
    }

    // The current layer, always visible in a corner of the level view, with a
    // padlock when it is locked.
    update_layer_label() {
        let label = $(this.element).find('.level-layer-label');
        if (!label.length) label = $('<div class="level-layer-label">').appendTo(this.element);
        const level = this.game.data.levels[this.level_index];
        const layer = level?.layers?.[this.layer_index];
        if (!layer) { label.hide(); return; }
        label.empty().show();
        if (layer.properties?.locked === true) $('<i class="fa fa-lock">').appendTo(label);
        $('<span>').text(`Ebene: ${layer.properties?.name || `Ebene ${this.layer_index + 1}`}`).appendTo(label);
    }

    // ------------------------------------------- Signale-Übersicht (S)
    // A panel at the right edge of the level view: every Code of the level as
    // a rule card (signal_rules in signals.js). Hovering a card shows only its
    // connections; clicking a line selects what it names, clicking the Code
    // shows everything that has it. Drawn again only when the rules change.
    refresh_signal_overview() {
        let panel = $(this.element).find('.signal-overview');
        const level = this.game.data.levels?.[this.level_index];
        if (!this.show_signal_overview || !level) {
            panel.remove();
            this.signal_overview_key = null;
            return;
        }
        const cards = this.signal_cards(level);
        const complete = this.complete_rule(level);
        const key = JSON.stringify([this.level_index, cards, complete, this.level_target_choices(null)]);
        if (panel.length && key === this.signal_overview_key) return;
        this.signal_overview_key = key;
        const scroll = panel.find('.signal-overview-body').scrollTop() ?? 0;
        // a name field that disappears with the old panel must not save on blur
        this.signal_overview_rebuilding = true;
        try { panel.remove(); } finally { this.signal_overview_rebuilding = false; }
        panel = $('<div class="signal-overview">').appendTo(this.element);
        // the level view must not paint, zoom or pan through the panel
        panel.on('mousedown touchstart dblclick wheel contextmenu', (e) => e.stopPropagation());
        const head = $('<div class="signal-overview-head">').appendTo(panel);
        $('<span>').text('Signale in diesem Level').appendTo(head);
        $('<button class="signal-overview-close" title="Schließen (S)">').append($('<i class="fa fa-times">'))
            .on('click', () => this.set_view_option('show_signal_overview', false)).appendTo(head);
        const body = $('<div class="signal-overview-body">').appendTo(panel);
        // first: what ends this level (every exit, "geschafft bei Signal")
        this.build_complete_card(body, complete, true);
        if (!cards.length) {
            $('<p class="signal-overview-empty">').text('Sonst sendet oder reagiert noch nichts in diesem Level. Setz zum Beispiel einen Schalter und ein Tor ins Level und verbinde sie mit dem Werkzeug Verbinden (R).').appendTo(body);
        }
        for (const card of cards) this.build_signal_card(body, card, true);
        $('<button class="signal-overview-new">').append($('<i class="fa fa-plus">'), $('<span>').text(' Neue Regel'))
            .attr('title', 'Mit dem Werkzeug Verbinden (R): erst anklicken, was sendet, dann, was reagieren soll')
            .on('click', () => this.start_new_signal_rule()).appendTo(body);
        body.scrollTop(scroll);
    }

    // Every Code of a level as rule cards (signal_rules), with sprite labels.
    signal_cards(level) {
        const { traits_of } = this.signal_context();
        const name_of = (ref) => {
            const index = this.game.sprite_index_for_ref(ref);
            return Number.isInteger(index) && this.game.data.sprites[index] ? sprite_label(this.game.data.sprites[index], index) : '';
        };
        return signal_rules(level, traits_of, name_of);
    }

    // What ends a level, as one rule (level_map.js level_complete_rule), with
    // sprite labels.
    complete_rule(level) {
        const { traits_of } = this.signal_context();
        const name_of = (ref) => {
            const index = this.game.sprite_index_for_ref(ref);
            return Number.isInteger(index) && this.game.data.sprites[index] ? sprite_label(this.game.data.sprites[index], index) : '';
        };
        return level_complete_rule(level, traits_of, name_of);
    }

    // The card "Level geschafft", always first in the Signale-Übersicht: every
    // exit and "geschafft bei Signal" is a line "Wenn …", and each says where
    // it leads. interactive: where it leads and (an exit) "nur mit F" are
    // changed right here – the same settings as the placed exit's; a click on
    // the text selects the exit; × takes "geschafft bei Signal" away. An exit
    // that opens only on a Signal says so (and is a receiver on that Code's card).
    build_complete_card(body, rule, interactive) {
        const level = this.game.data.levels[this.level_index];
        const box = $('<div class="signal-rule signal-rule-complete">').toggleClass('signal-rule-problem', !!rule.problem).appendTo(body);
        $('<div class="signal-rule-name signal-rule-name-text">').text('Level geschafft').appendTo(box);
        const row = $('<div class="signal-rule-row">').appendTo(box);
        $('<span class="signal-rule-word">').text('Wenn').appendTo(row);
        const list = $('<div class="signal-rule-lines">').appendTo(row);
        if (!rule.lines.length) $('<div class="signal-rule-missing">').text('nichts beendet dieses Level').appendTo(list);
        rule.lines.forEach((line, i) => {
            const entry = $('<div class="signal-rule-line signal-complete-line">').appendTo(list);
            const head = $('<div>').appendTo(entry);
            if (i > 0) $('<span class="signal-rule-or">').text('oder ').appendTo(head);
            const text = $('<span>').text(line.text + (line.count > 1 ? ` (${line.count}×)` : '')).appendTo(head);
            const pickable = line.objects.filter(o => o.kind !== 'level');
            if (interactive && pickable.length) {
                text.addClass('signal-rule-pick').attr('title', 'Auswählen');
                let next = 0;
                text.on('click', () => { this.pick_signal_overview_object(pickable[next % pickable.length]); next++; });
            }
            if (line.gate) $('<div class="signal-complete-gate">').append($('<i class="fa fa-lock">'))
                .append(document.createTextNode(` zu, bis ${signal_code_text(line.gate.code, line.gate.name)} kommt`)).appendTo(entry);
            if (!line.working) $('<div class="signal-rule-warning">').append($('<i class="fa fa-exclamation-triangle">'))
                .append($('<span>').text(' Liegt in einer Ebene ohne Kollisionen (oder mit Parallaxe) – so funktioniert er nicht.')).appendTo(entry);
            // where it leads
            const old_delta = line.kind === 'exit' && !clean_level_target(line.target) && Math.round(line.delta) !== 1 ? Math.round(line.delta) : null;
            const choices = this.level_target_choices(line.target, old_delta);
            const current = clean_level_target(line.target) ?? (old_delta !== null ? LEVEL_TARGET_DELTA : '');
            const where = $('<div class="signal-complete-where">').appendTo(entry);
            $('<span class="signal-complete-arrow">').text('→ weiter:').appendTo(where);
            if (interactive) {
                const select = $('<select class="signal-complete-target">').attr('title', 'Wohin es danach weitergeht').appendTo(where);
                for (const [value, label] of choices) $('<option>').val(value).text(label).appendTo(select);
                select.val(current);
                select.on('change', () => this.set_complete_line(line, { target: select.val() }));
                if (line.kind === 'exit')
                    $('<button type="button" class="signal-complete-key">').text('nur mit F').toggleClass('active', line.action_key)
                        .attr('title', 'An: Die Spielfigur geht erst durch diesen Ausgang, wenn man davor die Aktionstaste (F) drückt.')
                        .on('click', () => this.set_complete_line(line, { action_key: !line.action_key })).appendTo(where);
            } else {
                $('<span>').text(choices.find(([value]) => value === current)?.[1] ?? 'zum nächsten Level').appendTo(where);
            }
            if (interactive && line.kind === 'signal') {
                entry.addClass('signal-rule-removable');
                $('<button class="signal-rule-remove">').append($('<i class="fa fa-times">'))
                    .attr('title', '„geschafft bei Signal“ ausschalten')
                    .on('click', (e) => {
                        e.stopPropagation();
                        if (this.clear_signal_object(level, line.objects[0]))
                            this.signal_objects_cleared('Das Signal beendet das Level nicht mehr – Strg+Z macht es rückgängig.');
                    }).appendTo(entry);
            }
        });
        const then_row = $('<div class="signal-rule-row">').appendTo(box);
        $('<span class="signal-rule-word">').text('dann').appendTo(then_row);
        $('<div class="signal-rule-lines">').append($('<div class="signal-rule-line">').text('ist das Level geschafft')).appendTo(then_row);
        if (rule.problem === 'no_exit')
            $('<div class="signal-rule-warning">').append($('<i class="fa fa-exclamation-triangle">'))
                .append($('<span>').text(' Setz ein Sprite mit der Eigenschaft „Levelwechsel“ ins Level – zum Beispiel eine Fahne. Ohne eigenes Ziel führt es zum nächsten Level.')).appendTo(box);
        return box;
    }

    // A line of "Level geschafft" changed: change: { target } ('' = the next
    // level, as always) or { action_key }. For every exit on the line (as its
    // placed settings) or "geschafft bei Signal" (the level's setting).
    set_complete_line(line, change) {
        if (window.collaboration?.can_edit_current?.() === false) {
            this.show_level_notice('Gerade bearbeitet jemand anderes dieses Level.');
            return;
        }
        const level = this.game.data.levels[this.level_index];
        if ('target' in change && change.target === LEVEL_TARGET_DELTA) return;
        for (const object of line.objects) {
            if (object.kind === 'level') {
                if (!('target' in change)) continue;
                if (change.target) level.properties.signal_level_complete_target = change.target;
                else delete level.properties.signal_level_complete_target;
                continue;
            }
            if (this.refuse_locked_layer(object.layer_index)) return;
            const placed = level.layers[object.layer_index]?.sprites?.[object.placed_index];
            if (!placed) continue;
            if (!placed[3] || typeof placed[3] !== 'object') placed[3] = {};
            const props = placed[3].level_complete ??= {};
            if ('target' in change) {
                // a new choice replaces an older game's Delta for good
                delete props.delta;
                if (change.target) props.target = change.target;
                else delete props.target;
            }
            if ('action_key' in change) {
                if (change.action_key) props.action_key = true;
                else delete props.action_key;
            }
            if (!Object.keys(props).length) delete placed[3].level_complete;
        }
        this.history_observe();
        this.placed_properties_for = null;
        $('.level-signal-controls').each((_, box) => $(box).data('refresh')?.());
        this.refresh();
        this.build_signal_links();
        this.refresh_level_map?.();
        this.render();
    }

    // One "Wenn … dann …" card. interactive: in the level editor (hover shows
    // its lines, lines select, the name can be changed); else only to read
    // (the panel beside a test run).
    build_signal_card(body, card, interactive) {
        const box = $('<div class="signal-rule">').toggleClass('signal-rule-problem', !!card.problem).appendTo(body);
        box.css('--signal-color', signal_link_color(card.code));
        if (interactive) {
            box.on('mouseenter', () => { this.signal_focus_code = card.code; this.build_signal_links(); this.render(); });
            box.on('mouseleave', () => { this.signal_focus_code = null; this.build_signal_links(); this.render(); });
            $('<button class="signal-rule-delete">').append($('<i class="fa fa-trash-o">'))
                .attr('title', 'Diese Regel löschen: alles verliert diesen Code (Strg+Z macht es rückgängig)')
                .on('click', (e) => { e.stopPropagation(); this.delete_signal_rule(card); }).appendTo(box);
            $('<button class="signal-rule-code">').text(`Code ${card.code}`).attr('title', 'Alles mit diesem Code zeigen')
                .on('click', () => this.focus_signal_code(card.code)).appendTo(box);
            // a named Code: its name on top, the number stays small on the right
            this.add_signal_rule_name(box, card);
        } else {
            $('<span class="signal-rule-code">').text(`Code ${card.code}`).appendTo(box);
            if (card.name) $('<div class="signal-rule-name signal-rule-name-text">').text(card.name).appendTo(box);
        }
        const section = (word, lines, empty) => {
            const row = $('<div class="signal-rule-row">').appendTo(box);
            $('<span class="signal-rule-word">').text(word).appendTo(row);
            const list = $('<div class="signal-rule-lines">').appendTo(row);
            if (!lines.length) $('<div class="signal-rule-missing">').text(empty).appendTo(list);
            lines.forEach((line, i) => {
                const entry = $('<div class="signal-rule-line">').appendTo(list);
                if (i > 0) $('<span class="signal-rule-or">').text(word === 'Wenn' ? 'oder ' : 'und ').appendTo(entry);
                $('<span>').text(line.text + (line.count > 1 ? ` (${line.count}×)` : '')).appendTo(entry);
                const pickable = line.objects.filter(o => o.kind !== 'level');
                if (interactive && pickable.length) {
                    entry.addClass('signal-rule-pick').attr('title', 'Auswählen');
                    let next = 0;
                    entry.on('click', () => { this.pick_signal_overview_object(pickable[next % pickable.length]); next++; });
                }
                // × takes this line out of the signal (not the key an enemy leaves behind)
                if (interactive && line.objects.some(o => o.role !== 'loot')) {
                    entry.addClass('signal-rule-removable');
                    $('<button class="signal-rule-remove">').append($('<i class="fa fa-times">'))
                        .attr('title', line.count > 1 ? `Alle ${line.count} aus diesem Signal nehmen` : 'Aus diesem Signal nehmen')
                        .on('click', (e) => { e.stopPropagation(); this.remove_signal_line(line); }).appendTo(entry);
                }
            });
        };
        section('Wenn', card.senders, 'nichts sendet diesen Code');
        section('dann', card.receivers, 'nichts reagiert darauf');
        if (card.off.length) $('<div class="signal-rule-off">').text(card.off.join(' · ')).appendTo(box);
        if (card.problem === 'no_receiver')
            $('<div class="signal-rule-warning">').append($('<i class="fa fa-exclamation-triangle">'))
                .append($('<span>').text(' Das wird gesendet – aber nichts reagiert darauf. Gib einer Tür oder Ebene denselben Code.')).appendTo(box);
        if (card.problem === 'no_sender')
            $('<div class="signal-rule-warning">').append($('<i class="fa fa-exclamation-triangle">'))
                .append($('<span>').text(' Hier wartet etwas – aber nichts sendet diesen Code. Gib einem Schalter, Schlüssel oder Signalbereich denselben Code.')).appendTo(box);
        return box;
    }

    // ------------------------------- Signale beside a test run (B7)
    // While "Level testen" runs, the Spielen pane shows the level's cards
    // beside the game (only to read, and only while the Signale-Übersicht is
    // switched on). A card flashes when its signal arrives in the game and
    // shows "an" or "aus". Nothing in the game changes: the studio reads what
    // the game's SignalBus has delivered (its list `sent`, in order of
    // arrival, so a Verzögerung shows as such), once per animation frame. A
    // new bus (R, a lost life does not make one) starts the cards afresh;
    // in another level (the exit was reached) nothing flashes.
    start_signal_watch(level_index) {
        this.stop_signal_watch();
        const level = this.game.data.levels[level_index];
        if (!this.show_signal_overview || !level) return;
        const cards = this.signal_cards(level);
        const panel = $('<div class="signal-overview signal-watch">').appendTo('#main_div_play');
        const head = $('<div class="signal-overview-head">').appendTo(panel);
        $('<span>').text('Signale in diesem Level').appendTo(head);
        $('<button class="signal-overview-close" title="Ausblenden (im Level-Editor: S)">').append($('<i class="fa fa-times">'))
            .on('click', () => {
                this.set_view_option('show_signal_overview', false);
                this.stop_signal_watch();
                window.focus_play_frame?.();
            }).appendTo(head);
        const body = $('<div class="signal-overview-body">').appendTo(panel);
        $('<p class="signal-watch-hint">').text('Spiel los: Eine Regel leuchtet auf, sobald ihr Signal ankommt.').appendTo(body);
        const boxes = new Map();
        this.build_complete_card(body, this.complete_rule(level), false);
        for (const card of cards) boxes.set(card.code, this.build_signal_card(body, card, false));
        // the game must keep the keys: clicks on the panel give them back
        panel.on('mouseup', () => window.focus_play_frame?.());
        $('#main_div_play').addClass('with-signal-watch');
        const watch = this.signal_watch = { level_index, panel, boxes, bus: null, seen: 0, frame: null };
        const tick = () => {
            if (this.signal_watch !== watch) return;
            let game = null;
            try { game = $('#play_iframe')[0]?.contentWindow?.game ?? null; } catch { }
            const bus = game?.signals ?? null;
            const here = game?.level_index === level_index;
            panel.toggleClass('signal-watch-elsewhere', !!game && !here);
            if (bus !== watch.bus) {
                watch.bus = bus;
                watch.seen = 0;
                for (const box of boxes.values()) box.removeClass('signal-rule-on signal-rule-off-state').find('.signal-rule-state').remove();
            }
            const sent = here && Array.isArray(bus?.sent) ? bus.sent : null;
            while (sent && watch.seen < sent.length) {
                const [code, value] = sent[watch.seen++];
                this.signal_watch_arrived(boxes.get(code), value);
            }
            watch.frame = requestAnimationFrame(tick);
        };
        watch.frame = requestAnimationFrame(tick);
    }

    stop_signal_watch() {
        const watch = this.signal_watch;
        if (!watch) return;
        this.signal_watch = null;
        cancelAnimationFrame(watch.frame);
        watch.panel.remove();
        $('#main_div_play').removeClass('with-signal-watch');
    }

    // A signal arrived: the card flashes and says "an" or "aus".
    signal_watch_arrived(box, value) {
        if (!box) return;
        box.removeClass('signal-rule-fired');
        void box[0].offsetWidth; // the flash starts again for the next signal
        box.addClass('signal-rule-fired').toggleClass('signal-rule-on', !!value).toggleClass('signal-rule-off-state', !value);
        let state = box.children('.signal-rule-state');
        if (!state.length) state = $('<span class="signal-rule-state">').insertAfter(box.children('.signal-rule-code'));
        state.text(value ? 'an' : 'aus');
    }

    // The name of a card: on top in the Code's colour, a click (or the pencil)
    // turns it into a field. A card without a name only has a small pencil
    // next to its Code. Enter or leaving the field saves, Esc keeps the old
    // name. The Code itself never changes (signals.js).
    add_signal_rule_name(box, card) {
        const chip = box.children('.signal-rule-code');
        let row = null;
        let add = null;
        const show = () => {
            row?.remove();
            row = null;
            add?.remove();
            add = null;
            if (card.name) {
                row = $('<div class="signal-rule-name">').insertAfter(chip);
                const button = $('<button class="signal-rule-rename">').attr('title', 'Umbenennen')
                    .on('click', edit).appendTo(row);
                $('<span class="signal-rule-name-text">').text(card.name).appendTo(button);
                $('<i class="fa fa-pencil">').appendTo(button);
            } else {
                // floats right as well: it sits just left of the Code
                add = $('<button class="signal-rule-name-add">')
                    .attr('title', 'Diesem Signal einen Namen geben, zum Beispiel »Brücke«')
                    .append($('<i class="fa fa-pencil">')).on('click', edit).insertAfter(chip);
            }
        };
        const edit = () => {
            if (window.collaboration?.can_edit_current?.() === false) {
                this.show_level_notice('Gerade bearbeitet jemand anderes dieses Level.');
                return;
            }
            add?.remove();
            add = null;
            row ??= $('<div class="signal-rule-name">').insertAfter(chip);
            row.empty();
            let finished = false;
            const input = $('<input type="text" class="signal-rule-name-input">')
                .attr({ maxlength: SIGNAL_NAME_MAX_LENGTH, placeholder: 'Name, z. B. Brücke', spellcheck: 'false' })
                .val(card.name).appendTo(row);
            const finish = (save) => {
                if (finished) return true;
                if (save && !this.rename_signal_code(card.code, input.val())) return false;
                finished = true;
                // a changed name rebuilds the whole panel; else show this card's name again
                if (box.closest('body').length) show();
                return true;
            };
            input.on('keydown', (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); finish(true); }
                else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
            });
            input.on('blur', () => {
                if (this.signal_overview_rebuilding) return;
                // a name that is taken: keep the old one (the notice says why)
                if (!finish(true)) finish(false);
            });
            input.trigger('focus').trigger('select');
        };
        show();
    }

    // Gives a Code of the current level a name ('' removes it). False, with a
    // notice, when another Code already has that name.
    rename_signal_code(code, name) {
        const level = this.game.data.levels[this.level_index];
        if (!level) return false;
        if (clean_signal_name(name) === signal_name(level, code)) return true;
        const result = set_signal_name(level, code, name);
        if (!result.ok) {
            if (result.taken_by !== null)
                this.show_level_notice(`»${clean_signal_name(name)}« heißt in diesem Level schon Code ${result.taken_by}. Wähle einen anderen Namen.`);
            return false;
        }
        this.history_observe();
        // the lines under the Code fields show the new name
        this.update_signal_links?.();
        if ($('#menu_layer_properties_container').is(':visible')) this.setup_layer_properties();
        this.build_signal_links();
        this.render();
        return true;
    }

    // The camera onto a rectangle of one layer (its Parallaxe taken into
    // account); zooms out if it does not fit.
    view_signal_rects(entries) {
        const level = this.game.data.levels[this.level_index];
        let box = null;
        for (const { rect, layer_index } of entries) {
            const parallax = level.layers[layer_index]?.properties?.parallax ?? 0;
            const f = Math.abs(1 - parallax) < 0.05 ? 1 : 1 / (1 - parallax);
            box = signal_rect_union(box, { x0: rect.x0 * f, x1: rect.x1 * f, y0: rect.y0 * f, y1: rect.y1 * f });
        }
        if (!box) return;
        const panel_width = $(this.element).find('.signal-overview').outerWidth() ?? 0;
        const free_width = Math.max(100, this.width - panel_width - 24);
        const need = Math.min(this.height / ((box.y1 - box.y0) + 96), free_width / ((box.x1 - box.x0) + 96));
        if (need < this.scale) {
            this.visible_pixels = this.height / need;
            this.fix_scale();
        }
        // centred in the part of the view the panel leaves free
        this.camera_x = (box.x0 + box.x1) / 2 + panel_width / 2 / this.scale;
        this.camera_y = (box.y0 + box.y1) / 2;
        this.auto_adjust_camera = false;
        this.backdrop_controls_setup_for = null;
        this.handleResize();
        this.refresh();
        this.render();
    }

    focus_signal_code(code) {
        const { level, traits_of, size_of } = this.signal_context();
        const objects = signal_objects(level, traits_of, size_of).filter(o => o.code === code);
        this.signal_highlight = { code, until: performance.now() + 4000 };
        this.view_signal_rects(objects.map(o => ({ rect: o.rect, layer_index: o.layer_index })));
        this.build_signal_links();
        this.render();
    }

    // A line of a card: select the placed sprite (in its layer), or make the
    // layer or Bereich the current one – and look at it.
    pick_signal_overview_object(object) {
        const level = this.game.data.levels[this.level_index];
        if (!object || !level?.layers[object.layer_index]) return;
        if (object.layer_index !== this.layer_index)
            $('#menu_layers > ._dnd_item').eq(object.layer_index).children().eq(0).trigger('click');
        const { traits_of, size_of } = this.signal_context();
        const found = signal_objects(level, traits_of, size_of).find(o => o.layer_index === object.layer_index &&
            (object.kind !== 'sprite' || o.placed_index === object.placed_index) && (object.kind === 'sprite') === (o.kind === 'sprite'));
        if (object.kind === 'sprite') {
            menus.level.handle_click('tool/select');
            this.selection = [object.placed_index];
            this.placed_properties_for = null;
            this.show_selection();
        }
        if (found) this.view_signal_rects([{ rect: found.rect, layer_index: object.layer_index }]);
        else { this.refresh(); this.render(); }
    }

    get_touch_point(e) {
        let dx = this.element.position().left;
        let dy = this.element.position().top;
        if (e.clientX)
            return [e.clientX - dx, e.clientY - dy];
        else {
            if (e.touches) {
                this.is_touch = true;
                return [e.touches[0].clientX - dx, e.touches[0].clientY - dy];
            }
            return [0 - dx, 0 - dy];
        }
    }

    // The pen and a finger: what the press would have done (handle_down
    // waited, see pending_touch_place) – set the sprite or erase one there.
    apply_pending_touch_place() {
        if (!this.pending_touch_place) return;
        this.pending_touch_place = null;
        if (this.pen_erasing) {
            if (this.modifier_shift) this.remove_sprite_from_level(this.mouse_down_position_no_snap, this.mouse_down_position_no_snap);
            else this.remove_sprite_from_level(this.mouse_down_position, this.mouse_down_position_no_snap);
        } else {
            this.add_sprite_to_level(this.modifier_shift ? this.mouse_down_position_no_snap : this.mouse_down_position);
        }
        this.render();
    }

    // Hervorheben (D): the meshes of a layer in front of the current one get
    // faint copies of their materials (LayerFade, as the game fades a layer),
    // and get their own back otherwise. The copies are kept per material.
    dim_layer_group(group, faint) {
        // weak: backdrop materials are made anew on every refresh
        this.dim_copies ??= new WeakMap();
        this.dim_copy_set ??= new WeakSet();
        const visit = (node) => {
            if (node.material && !Array.isArray(node.material)) {
                const is_copy = this.dim_copy_set.has(node.material);
                if (faint && !is_copy) {
                    let entry = this.dim_copies.get(node.material);
                    if (entry === undefined) {
                        entry = typeof LayerFade !== 'undefined' ? LayerFade.copy(node.material, 'layerOpacity') : null;
                        if (entry) {
                            if (entry.shader) entry.material.uniforms.layerOpacity.value = 0.28;
                            else entry.material.opacity = (entry.opacity ?? 1) * 0.28;
                            this.dim_copy_set.add(entry.material);
                        }
                        this.dim_copies.set(node.material, entry);
                    }
                    if (entry) {
                        // the sprite's picture as it is now (repainted in the sprite editor)
                        if (entry.material.uniforms?.texture1 && node.material.uniforms?.texture1)
                            entry.material.uniforms.texture1.value = node.material.uniforms.texture1.value;
                        node.userData.undimmed_material = node.material;
                        node.material = entry.material;
                    }
                } else if (!faint && is_copy && node.userData.undimmed_material) {
                    node.material = node.userData.undimmed_material;
                    delete node.userData.undimmed_material;
                }
            }
            for (const child of node.children ?? []) visit(child);
        };
        visit(group);
    }

    // Hervorheben (D): a dark veil over everything behind the current layer,
    // as big as the view.
    dim_veil() {
        if (!this.dim_veil_mesh) {
            this.dim_veil_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
                new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.62, depthTest: false, depthWrite: false }));
        }
        const w = (this.width || 1000) / this.scale, h = (this.height || 1000) / this.scale;
        this.dim_veil_mesh.scale.set(w * 1.2 + 2, h * 1.2 + 2, 1);
        this.dim_veil_mesh.position.set(this.camera_x, this.camera_y, 0);
        return this.dim_veil_mesh;
    }

    // Bereiche (B): the rectangles of every visible Hintergrund (blue),
    // Signalbereich (yellow) and Bewegungsbereich (green) as thin lines, each
    // where its layer is drawn (Parallaxe). The current layer's own are drawn
    // by the rectangle editing (backdrop_cursor) while no tool is chosen.
    // A Bewegungsbereich with a turned gravity (movement_regions.js direction):
    // an arrow in each rectangle, pointing where gravity pulls.
    gravity_arrows(layer, material) {
        const k = MovementRegions.direction_k(layer.movement?.direction);
        if (layer.type !== 'movement_region' || !k) return [];
        const [dx, dy] = MovementRegions.to_world(k, 0, -1);
        return (layer.rects ?? []).map(normalized_rect).filter(r => r.width > 0 && r.height > 0).map(r => {
            const cx = r.left + r.width / 2, cy = r.bottom + r.height / 2;
            const len = Math.min(r.width, r.height) * 0.3, head = Math.min(len * 0.4, 10);
            const tip = [cx + dx * len, cy + dy * len];
            // the head: back from the tip and to both sides
            const points = [[cx - dx * len, cy - dy * len], tip,
                [tip[0] - dx * head - dy * head, tip[1] - dy * head + dx * head], tip,
                [tip[0] - dx * head + dy * head, tip[1] - dy * head - dx * head]];
            return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y))), material);
        });
    }

    region_outlines() {
        const group = new THREE.Group();
        const level = this.game.data.levels[this.level_index];
        const colours = { backdrop: 0x73eff7, signal_area: 0xffcd75, movement_region: 0x38b764 };
        level.layers.forEach((layer, li) => {
            if (!(layer.type in colours) || layer.properties?.visible === false) return;
            if (li === this.backdrop_index_shown && menus.level.active_key === null) return;
            const parallax = layer.properties?.parallax ?? 0;
            const material = new THREE.LineDashedMaterial({ color: colours[layer.type], transparent: true, opacity: 0.55,
                dashSize: 5 / this.scale, gapSize: 4 / this.scale });
            const layer_group = new THREE.Group();
            layer_group.position.set(this.camera_x * parallax, this.camera_y * parallax, 0);
            for (const rect of layer.rects ?? []) {
                const r = normalized_rect(rect);
                if (!(r.width > 0 && r.height > 0)) continue;
                const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(r.left, r.bottom), new THREE.Vector3(r.left + r.width, r.bottom),
                    new THREE.Vector3(r.left + r.width, r.bottom + r.height), new THREE.Vector3(r.left, r.bottom + r.height),
                ]), material);
                line.computeLineDistances();
                layer_group.add(line);
            }
            for (const arrow of this.gravity_arrows(layer, new THREE.LineBasicMaterial({ color: colours[layer.type], transparent: true, opacity: 0.55 })))
                layer_group.add(arrow);
            group.add(layer_group);
        });
        return group;
    }

    // The layers with rectangles (Hintergrund, Signalbereich, Bewegungsbereich)
    // that have one under the screen point: [{ li, ri }], the topmost first.
    regions_at(touch) {
        const level = this.game.data.levels[this.level_index];
        const found = [];
        level.layers.forEach((layer, li) => {
            if (!['backdrop', 'signal_area', 'movement_region'].includes(layer.type) || layer.properties?.visible === false) return;
            const parallax = layer.properties?.parallax ?? 0;
            const x = this.camera_x + (touch[0] - this.width / 2) / this.scale - this.camera_x * parallax;
            const y = this.camera_y - (touch[1] - this.height / 2) / this.scale - this.camera_y * parallax;
            const rects = layer.rects ?? [];
            for (let ri = rects.length - 1; ri >= 0; ri--) {
                const r = normalized_rect(rects[ri]);
                if (x >= r.left && x < r.left + r.width && y >= r.bottom && y < r.bottom + r.height) { found.push({ li, ri }); break; }
            }
        });
        return found;
    }

    // Makes layer li current and its rectangle ri the chosen one (from the menu).
    edit_region(li, ri) {
        if (li !== this.layer_index) $('#menu_layers > ._dnd_item').eq(li).children().eq(0).trigger('click');
        this.choose_rect(ri);
    }

    choose_rect(ri) {
        if (this.rects_widget && ri !== this.rect_index) this.rects_widget.select_index(ri);
        this.rect_index = ri;
        this.backdrop_controls_setup_for = null;
        this.refresh();
        this.render();
    }

    // No tool chosen on a Hintergrund, Signalbereich or Bewegungsbereich: a
    // press inside one of its rectangles chooses it and drags it along.
    start_rect_move() {
        const layer = this.game.data.levels[this.level_index].layers[this.backdrop_index];
        if (!layer?.rects?.length || this.layer_locked(this.backdrop_index)) return false;
        const [x, y] = this.mouse_down_position_no_snap;
        const inside = (rect) => {
            if (!rect) return false;
            const r = normalized_rect(rect);
            return x >= r.left && x < r.left + r.width && y >= r.bottom && y < r.bottom + r.height;
        };
        // the chosen one first, then the topmost (the last in the list)
        let ri = inside(layer.rects[this.rect_index]) ? this.rect_index : -1;
        for (let i = layer.rects.length - 1; ri < 0 && i >= 0; i--) if (inside(layer.rects[i])) ri = i;
        if (ri < 0) return false;
        if (ri !== this.rect_index) this.choose_rect(ri);
        Object.assign(layer.rects[ri], normalized_rect(layer.rects[ri]));
        this.backdrop_move_point = 'move';
        this.backdrop_move_point_old_rect = { ...layer.rects[ri] };
        $(this.element).addClass('moving-rect');
        return true;
    }

    // What the pen shows under the mouse: the chosen sprite – or, while it
    // erases (X), a red frame with a cross of that size.
    rebuild_pen_cursor() {
        this.cursor_group_inner.remove.apply(this.cursor_group_inner, this.cursor_group_inner.children);
        if (menus.level.active_key !== 'tool/pen') return;
        if (!this.pen_erasing) {
            this.sheets[this.sprite_index]?.add_sprite_to_group(this.cursor_group_inner, 'sprite', 0, 0);
            return;
        }
        const sprite = this.game.data.sprites[this.sprite_index];
        const w = sprite?.width ?? this.grid_width, h = sprite?.height ?? this.grid_height;
        const material = new THREE.LineBasicMaterial({ color: 0xef7d57, transparent: true });
        const line = (points, loop) => {
            const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
            this.cursor_group_inner.add(loop ? new THREE.LineLoop(geometry, material) : new THREE.LineSegments(geometry, material));
        };
        line([[-w / 2, 0], [-w / 2, h], [w / 2, h], [w / 2, 0]], true);
        line([[-w / 2, 0], [w / 2, h], [-w / 2, h], [w / 2, 0]], false);
    }

    // X: the pen erases instead of placing (and X again: it places again) –
    // like "durchsichtig" in the sprite editor. Choosing a sprite or another
    // tool ends it.
    set_pen_erasing(flag) {
        flag = !!flag;
        if (flag && menus.level.active_key !== 'tool/pen') menus.level.handle_click('tool/pen');
        if (this.pen_erasing === flag) return;
        this.pen_erasing = flag;
        $('#menu_level_sprites > .button').removeClass('active');
        if (!flag && menus.level.active_key === 'tool/pen')
            $('#menu_level_sprites > .button').filter((_, b) => $(b).data('sprite_index') === this.sprite_index).addClass('active');
        this.eraser_toggle?.toggleClass('active', flag);
        $(this.element).toggleClass('pen-erasing', flag);
        this.rebuild_pen_cursor();
        menus.level.refresh_toggles?.();
        this.render();
    }

    handle_enter(e) {
        this.pointer_inside = true;
        let p = this.pen_point(this.get_touch_point(e));
        this.rebuild_pen_cursor();
        if (menus.level.active_key === 'tool/pen') {
            this.cursor_group_inner.position.x = p[0];
            this.cursor_group_inner.position.y = p[1];
            this.cursor_group.visible = true;
        }
        this.render();
    }

    handle_leave(e) {
        this.pointer_inside = false;
        if (menus.level.active_key === 'tool/pen') {
            this.cursor_group.visible = false;
        }
        this.render();
    }

    handle_down(e) {
        e.preventDefault();
        e.stopPropagation();
        // preventDefault keeps the focus where it was: leave a text field, so
        // that keys (Strg+Z, tool shortcuts) work on the level again
        if (document.activeElement?.matches?.('input, textarea, select')) document.activeElement.blur();
        this.last_touch_distance = null;
        if ((e.touches || []).length >= 2) {
            // two fingers zoom and move the view, with every tool: whatever the
            // first finger began stops (the pen has not set anything yet)
            this.is_double_touch = true;
            this.double_touch_points = [
                [e.touches[0].clientX, e.touches[0].clientY],
                [e.touches[1].clientX, e.touches[1].clientY]
            ];
            this.last_touch_mid = null;
            clearTimeout(this.long_press?.timer);
            this.long_press = null;
            this.pending_touch_place = null;
            this.mouse_down = false;
            this.updating_selection = false;
            this.moving_selection = null;
            this.drawing_shape = null;
            this.backdrop_move_point = null;
            this.rect_group.visible = false;
            this.render();
            return;
        } else {
            this.is_double_touch = false;
        }
        this.updating_selection = false;
        this.mouse_down = true;
        this.mouse_down_button = e.button;
        let touch = this.get_touch_point(e);
        this.mouse_down_position = menus.level.active_key === 'tool/pen' ? this.pen_point(touch) : this.ui_to_world(touch, true);
        this.mouse_down_position_no_snap = this.ui_to_world(touch, false);
        this.mouse_down_position_raw = touch;
        this.x0 = this.mouse_down_position_no_snap[0];
        this.y0 = this.mouse_down_position_no_snap[1];
        this.x1 = this.mouse_down_position_no_snap[0];
        this.y1 = this.mouse_down_position_no_snap[1];

        // a finger is the left button
        const button = e.touches ? 0 : e.button;
        if (e.touches) this.mouse_down_button = 0;
        // a tablet has no right button: holding a finger still opens the menu,
        // with every tool, like the right-click (Verbinden: it stops connecting)
        clearTimeout(this.long_press?.timer);
        this.long_press = null;
        this.pending_touch_place = null;
        if ((e.touches || []).length === 1) {
            const at = { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
            this.long_press = { x: at.clientX, y: at.clientY, timer: setTimeout(() => {
                this.long_press = null;
                this.mouse_down = false;
                this.pending_touch_place = null;
                this.updating_selection = false;
                this.moving_selection = null;
                this.drawing_shape = null;
                this.backdrop_move_point = null;
                this.rect_group.visible = false;
                if (menus.level.active_key === 'tool/connect') this.cancel_connect?.();
                else this.handle_context_menu(at);
                this.render();
            }, 550) };
        }
        // the middle mouse button, or the left one while the Leertaste is held:
        // drag the view, whichever tool is active
        if (!e.touches && (e.button === 1 || (e.button === 0 && this.space_pan))) {
            this.grab_panning = true;
            this.old_camera_position = [this.camera_x, this.camera_y];
            $(this.element).addClass('grab-panning');
            return;
        }
        // no tool on a Hintergrund, Signalbereich or Bewegungsbereich: drag a rectangle
        if (menus.level.active_key === null && this.backdrop_index !== null && this.backdrop_move_point === null && button === 0)
            this.start_rect_move();
        if (menus.level.active_key === 'tool/connect') {
            this.handle_connect_down(e);
        } else if (menus.level.active_key === 'tool/pen' && this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            if (this.refuse_locked_layer()) {
                // locked: neither paint, erase nor fill (the notice says why)
            } else if (e.touches) {
                // a finger: set (or erase) once it is clear that it is no long
                // press and no second finger – when it moves or lifts
                this.pending_touch_place = { at: this.mouse_down_raw_touch = this.get_touch_point(e) };
            } else if (button === 0 && this.pen_erasing) {
                // X: the pen erases
                if (this.modifier_shift) this.remove_sprite_from_level(this.mouse_down_position_no_snap, this.mouse_down_position_no_snap);
                else this.remove_sprite_from_level(this.mouse_down_position, this.mouse_down_position_no_snap);
            } else if (button === 0 && (e.ctrlKey || e.metaKey)) {
                // Strg + ziehen: fill a rectangle with the chosen sprite (+ Shift: its edge, + Alt: a line)
                this.drawing_shape = LevelEditor.shape_for_event(e);
                const [x0, y0] = this.mouse_down_position;
                this.preview_shape(this.drawing_shape, x0, y0, x0, y0);
            } else if (button === 0) {
                if (this.modifier_shift) {
                    this.add_sprite_to_level(this.mouse_down_position_no_snap);
                } else {
                    this.add_sprite_to_level(this.mouse_down_position);
                }
            }
            // the right button opens the menu (handle_context_menu)
        } else if (menus.level.active_key === 'tool/pan') {
            this.old_camera_position = [this.camera_x, this.camera_y];
        } else if (menus.level.active_key === 'tool/select' && e.button === 2) {
            // the right button opens the menu (handle_context_menu)
        } else if (menus.level.active_key === 'tool/select' && this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            const [px, py] = this.mouse_down_position_no_snap;
            if (button === 0 && !e.shiftKey && this.selection.length && this.selection_point_inside(px, py)) {
                // on the selection: drag it (not in a locked layer)
                if (!this.refuse_locked_layer()) this.moving_selection = { dx: 0, dy: 0 };
            } else {
                // Shift: add to what is selected
                this.selection_before = e.shiftKey ? [...this.selection] : [];
                this.clear_selection(false);
                this.updating_selection = true;
            }
        }

        this.render();
    }

    handle_up(e) {
        if (current_pane !== 'level') return;
        clearTimeout(this.long_press?.timer);
        this.long_press = null;
        // two fingers: done once both are off
        if (this.is_double_touch) {
            if (!(e.touches?.length)) { this.is_double_touch = false; this.last_touch_mid = null; this.last_touch_distance = null; }
            this.mouse_down = false;
            return;
        }
        // the pen and a finger that did not move: a tap sets the sprite now
        if (this.pending_touch_place && this.mouse_down) this.apply_pending_touch_place();
        this.pending_touch_place = null;
        this.mouse_down = false;
        this.backdrop_move_point = null;
        this.backdrop_move_point_old_rect = null;
        $(this.element).removeClass('moving-rect');
        if (this.grab_panning) {
            this.grab_panning = false;
            $(this.element).removeClass('grab-panning');
            return;
        }
        // let p_no_snap = this.ui_to_world(this.get_touch_point(e), false);
        // if (menus.level.active_key === 'tool/fill-rect') {
        //     let x0 = this.mouse_down_position_no_snap[0];
        //     let y0 = this.mouse_down_position_no_snap[1];
        //     let x1 = p_no_snap[0];
        //     let y1 = p_no_snap[1];
        //     if (x0 > x1) { let temp = x0; x0 = x1; x1 = temp; }
        //     if (y0 > y1) { let temp = y0; y0 = y1; y1 = temp; }
        //     x0 = Math.round(Math.floor(x0 / this.grid_width) * this.grid_width);
        //     y0 = Math.round(Math.floor(y0 / this.grid_height) * this.grid_height);
        //     x1 = Math.round(Math.ceil(x1 / this.grid_width) * this.grid_width);
        //     y1 = Math.round(Math.ceil(y1 / this.grid_height) * this.grid_height);
        //     for (let y = y0; y < y1; y += this.grid_height) {
        //         for (let x = x0; x < x1; x += this.grid_width) {
        //             this.add_sprite_to_level([x, y]);
        //         }
        //     }
        // }
        if (this.moving_selection) {
            const { dx, dy } = this.moving_selection;
            this.moving_selection = null;
            if ((dx || dy) && !this.read_only_level()) this.nudge_selection(dx, dy);
            else this.set_layer_sprites(this.layer_index, this.current_sprite_layer()?.sprites ?? [], this.selection);
        }
        if (this.drawing_shape) {
            const shape = e.touches ? this.drawing_shape : LevelEditor.shape_for_event(e);
            this.drawing_shape = null;
            const p = this.pen_point(this.get_touch_point(e));
            this.draw_shape(shape, this.mouse_down_position[0], this.mouse_down_position[1], p[0], p[1]);
        }
        if (this.updating_selection && menus.level.active_key === 'tool/select') {
            let sx0 = this.x0;
            let sy0 = this.y0;
            let sx1 = this.x1;
            let sy1 = this.y1;
            this.clear_selection(false);
            const found = this.layer_structs[this.layer_index].select_rect(this.selection_group, sx0, sy0, sx1, sy1);
            this.selection = [...new Set([...(this.selection_before ?? []), ...found])];
            this.selection_before = [];
            this.show_selection();
            this.refresh();
            this.render();
        }
        this.rect_group.visible = false;
        this.render();
    }

    handle_move(e) {
        if (current_pane !== 'level') return;
        // a finger that moves is no long press
        if (this.long_press && e.touches?.[0] &&
            Math.hypot(e.touches[0].clientX - this.long_press.x, e.touches[0].clientY - this.long_press.y) > 10) {
            clearTimeout(this.long_press.timer);
            this.long_press = null;
        }
        if (this.grab_panning) {
            if (this.mouse_down) this.pan_view_to(this.get_touch_point(e));
            return;
        }
        if (!this.mouse_down && $(e.target).closest('.signal-overview, .level-minimap').length) return;
        if (this.is_double_touch) {
            if ((e.touches ?? []).length < 2) return;
            let this_touch_points = [
                [e.touches[0].clientX, e.touches[0].clientY],
                [e.touches[1].clientX, e.touches[1].clientY]
            ];
            let dx = this_touch_points[0][0] - this_touch_points[1][0];
            let dy = this_touch_points[0][1] - this_touch_points[1][1];
            let this_touch_distance = Math.sqrt(dx * dx + dy * dy);
            let touch_distance_delta = null;
            if (this.last_touch_distance !== null)
                touch_distance_delta = this_touch_distance - this.last_touch_distance;
            this.last_touch_distance = this_touch_distance;
            // two fingers, every tool: they zoom (closer / apart) and move the view (together)
            const mid = [(this_touch_points[0][0] + this_touch_points[1][0]) * 0.5, (this_touch_points[0][1] + this_touch_points[1][1]) * 0.5];
            if (this.last_touch_mid) {
                this.camera_x -= (mid[0] - this.last_touch_mid[0]) / this.scale;
                this.camera_y += (mid[1] - this.last_touch_mid[1]) / this.scale;
                this.auto_adjust_camera = false;
            }
            this.last_touch_mid = mid;
            if (touch_distance_delta !== null) {
                let tx = mid[0] - this.element.position().left;
                let ty = mid[1] - this.element.position().top;
                let p = this.ui_to_world([tx, ty], false);
                this.zoom_at_point(-touch_distance_delta * 3, p[0], p[1]);
            }
            if (this.backdrop_index !== null) this.refresh_backdrop_controls();
            this.refresh();
            this.render();
            return;
        }
        let touch = this.get_touch_point(e);
        // the pen and a finger: once it moves, it draws (from where it began)
        if (this.pending_touch_place) {
            const from = this.pending_touch_place.at;
            if (Math.hypot(touch[0] - from[0], touch[1] - from[1]) <= 10) return;
            this.apply_pending_touch_place();
        }
        let p = menus.level.active_key === 'tool/pen' ? this.pen_point(touch) : this.ui_to_world(touch, true);
        let p_no_snap = this.ui_to_world(touch, false);
        this.pointer_world_raw = touch;
        this.pointer_world = p_no_snap;
        if (menus.level.active_key === 'tool/connect') this.handle_connect_move(e);
        if (this.moving_selection && this.mouse_down) {
            let dx = p_no_snap[0] - this.mouse_down_position_no_snap[0];
            let dy = p_no_snap[1] - this.mouse_down_position_no_snap[1];
            // the selection's lower left corner lands on the grid (back onto
            // it when it was off, e.g. a duplicate); with Shift pixel by pixel
            if (!e.shiftKey)
                [dx, dy] = snapped_selection_delta(this.current_sprite_layer()?.sprites ?? [], this.selection, dx, dy, this.selection_grid());
            if (dx !== this.moving_selection.dx || dy !== this.moving_selection.dy) {
                this.moving_selection = { dx, dy };
                this.preview_selection_move(dx, dy);
            }
            return;
        }
        if (this.drawing_shape && this.mouse_down) {
            // Shift and Alt can still change the shape while dragging
            if (!e.touches) this.drawing_shape = LevelEditor.shape_for_event(e);
            const [x0, y0] = this.mouse_down_position;
            this.preview_shape(this.drawing_shape, x0, y0, p[0], p[1]);
            this.render();
            return;
        }
        if (menus.level.active_key === 'tool/pen' && this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            this.cursor_group.visible = true;
            if (this.modifier_shift) {
                this.cursor_group_inner.position.x = p_no_snap[0];
                this.cursor_group_inner.position.y = p_no_snap[1];
            } else {
                this.cursor_group_inner.position.x = p[0];
                this.cursor_group_inner.position.y = p[1];
            }
            if (this.mouse_down && this.mouse_down_button === 0) {
                if (this.pen_erasing) {
                    if (this.modifier_shift) this.remove_sprite_from_level(p_no_snap, p_no_snap);
                    else this.remove_sprite_from_level(p, p_no_snap);
                } else if (this.modifier_shift) {
                    this.add_sprite_to_level(p_no_snap);
                } else {
                    this.add_sprite_to_level(p);
                }
            }
        } else {
            this.cursor_group.visible = false;
        }
        if (menus.level.active_key === 'tool/pan') {
            // $(this.element).css('cursor', 'url(icons/move-hand.png) 11 4, auto');
            if (this.mouse_down && this.mouse_down_button === 0) this.pan_view_to(touch);
        }

        if (this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            if (menus.level.active_key === 'tool/fill-rect' || menus.level.active_key === 'tool/select') {
                if (this.mouse_down) {
                    this.x0 = this.mouse_down_position_no_snap[0];
                    this.y0 = this.mouse_down_position_no_snap[1];
                    this.x1 = p_no_snap[0];
                    this.y1 = p_no_snap[1];
                    this.prepare_rect_group(this.x0, this.y0, this.x1, this.y1);
                }
                this.rect_group.visible = this.mouse_down;
            }
        }
        if (this.backdrop_index !== null && menus.level.active_key !== 'tool/pan') {
            if (this.mouse_down && this.mouse_down_button === 0) {
                if (this.backdrop_move_point !== null) {
                    if (this.backdrop_move_point.substr(0, 6) === 'color_') {
                        let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                        let color_index = parseInt(this.backdrop_move_point.substr(6));
                        let dx = p_no_snap[0] - this.mouse_down_position_no_snap[0];
                        let dy = p_no_snap[1] - this.mouse_down_position_no_snap[1];
                        dx /= backdrop.rects[0].width;
                        dy /= backdrop.rects[0].height;
                        let nx = Math.round((this.backdrop_move_point_old_coordinates[0] + dx) * 1000.0) / 1000.0;
                        let ny = Math.round((this.backdrop_move_point_old_coordinates[1] + dy) * 1000.0) / 1000.0;
                        backdrop.colors[color_index][1] = nx;
                        backdrop.colors[color_index][2] = ny;
                        this.place_backdrop_controls();
                        this.refresh();
                        this.render();
                    } else if (this.backdrop_move_point.substr(0, 14) === 'control_point_') {
                        let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                        let control_point_index = parseInt(this.backdrop_move_point.substr(14));
                        let dx = p_no_snap[0] - this.mouse_down_position_no_snap[0];
                        let dy = p_no_snap[1] - this.mouse_down_position_no_snap[1];
                        dx /= backdrop.rects[0].width;
                        dy /= backdrop.rects[0].height;
                        let nx = Math.round((this.backdrop_move_point_old_coordinates[0] + dx) * 1000.0) / 1000.0;
                        let ny = Math.round((this.backdrop_move_point_old_coordinates[1] + dy) * 1000.0) / 1000.0;
                        backdrop.control_points[control_point_index] = [nx, ny];
                        this.place_backdrop_controls();
                        this.refresh();
                        this.render();
                    } else if (this.backdrop_move_point.startsWith('rect_') && this.backdrop_move_point_old_rect) {
                        // one of the eight handles: its edges follow the mouse
                        // (on the grid while it is shown), the others stay
                        let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                        let rect = backdrop.rects[this.rect_index];
                        const sides = RECT_HANDLES[this.backdrop_move_point.substr(5)];
                        if (rect && sides) {
                            const dx = p_no_snap[0] - this.mouse_down_position_no_snap[0];
                            const dy = p_no_snap[1] - this.mouse_down_position_no_snap[1];
                            const snap = this.show_grid ? (x, y) => this.snap(x, y, false) : (x, y) => [Math.round(x), Math.round(y)];
                            const min_size = this.show_grid ? Math.min(this.grid_width, this.grid_height) : 1;
                            Object.assign(rect, resized_rect(this.backdrop_move_point_old_rect, sides, dx, dy, snap, min_size));
                            this.place_backdrop_controls();
                            this.refresh();
                            this.render();
                        }
                    } else if (this.backdrop_move_point === 'move' && this.backdrop_move_point_old_rect) {
                        // the whole rectangle (start_rect_move): its lower left corner on the grid while it is shown
                        const rect = this.game.data.levels[this.level_index].layers[this.backdrop_index].rects[this.rect_index];
                        const old = this.backdrop_move_point_old_rect;
                        if (rect) {
                            let nx = old.left + p_no_snap[0] - this.mouse_down_position_no_snap[0];
                            let ny = old.bottom + p_no_snap[1] - this.mouse_down_position_no_snap[1];
                            [nx, ny] = this.show_grid ? this.snap(nx, ny, false) : [Math.round(nx), Math.round(ny)];
                            rect.left = nx;
                            rect.bottom = ny;
                            this.place_backdrop_controls();
                            this.refresh();
                            this.render();
                        }
                    }
                }
            } else if (!this.mouse_down && menus.level.active_key === null) {
                // the hand shows where a rectangle can be grabbed
                const layer = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                const [x, y] = p_no_snap;
                const over = !this.layer_locked(this.backdrop_index) && (layer?.rects ?? []).some(rect => {
                    const r = normalized_rect(rect);
                    return x >= r.left && x < r.left + r.width && y >= r.bottom && y < r.bottom + r.height;
                });
                $(this.element).toggleClass('over-rect', over);
            }
        }
        this.render();
    }

    setModifierShift(flag) {
        this.modifier_shift = flag;
        // this.refresh();
        // this.render();
    }

    clear_rect_group() {
        for (const child of this.rect_group.children) child.geometry?.dispose();
        this.rect_group.remove.apply(this.rect_group, this.rect_group.children);
    }

    prepare_rect_group(x0, y0, x1, y1) {
        this.clear_rect_group();
        let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.0, transparent: true });

        let points = [];
        points.push(new THREE.Vector3(x0, y0))
        points.push(new THREE.Vector3(x0, y1))
        points.push(new THREE.Vector3(x1, y1))
        points.push(new THREE.Vector3(x1, y0))
        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rect_group.add(new THREE.LineLoop(geometry, material));
    }

    // The pen while it erases (X): the sprite on exactly this spot, else the
    // topmost one under the mouse (raw: the point in the world) – a wide
    // sprite sits elsewhere than the spot the chosen sprite would take.
    remove_sprite_from_level(p, raw = null) {
        if (this.layer_locked()) return;
        const layer = this.current_sprite_layer();
        if (!layer || !layer.properties.visible) return;
        const struct = this.current_layer_struct();
        if (!(`${p[0]}/${p[1]}` in struct.placed_sprite_index_for_pos) && raw) {
            const index = this.topmost_placed_at(raw[0], raw[1]);
            if (index < 0) return;
            p = [layer.sprites[index][1], layer.sprites[index][2]];
        }
        struct.remove_sprite(p, false);
        this.render();
    }

    // The index of the topmost placed sprite of the current layer that
    // covers the world point (x, y), or -1.
    topmost_placed_at(x, y) {
        const layer = this.current_sprite_layer();
        if (!layer) return -1;
        for (let i = layer.sprites.length - 1; i >= 0; i--) {
            const placed = layer.sprites[i];
            const sprite = this.game.data.sprites[this.game.sprite_index_for_ref(placed[0])];
            if (!sprite) continue;
            if (x >= placed[1] - sprite.width / 2 && x < placed[1] + sprite.width / 2 && y >= placed[2] && y < placed[2] + sprite.height)
                return i;
        }
        return -1;
    }

    add_sprite_to_level(p) {
        if (this.layer_locked()) return;
        if (this.game.data.levels[this.level_index].layers[this.layer_index].properties.visible) {
            this.current_layer_struct().add_sprite(p, this.sprite_index, null);
            this.render();
        }
    }

    clear_selection(do_update) {
        if (typeof(do_update) === 'undefined') do_update = true;
        this.selection = [];
        this.selection_group.remove.apply(this.selection_group, this.selection_group.children);
        if (do_update) this.refresh();
        this.render();
    }

    select_all() {
        this.clear_selection();
        this.selection = this.layer_structs[this.layer_index].select_rect(this.selection_group, -Infinity, -Infinity, Infinity, Infinity);
        this.refresh();
        this.render();
    }

    delete_selection() {
        // only a sprite layer has sprites to delete (Entf on a Hintergrund
        // layer used to end with the robot)
        if (!this.current_sprite_layer() || !this.selection.length || this.read_only_level()) return;
        if (this.refuse_locked_layer()) return;
        let delete_these = new Set();
        for (let i of this.selection)
            delete_these.add(i);
        let new_sprites = [];
        for (let i = 0; i < this.game.data.levels[this.level_index].layers[this.layer_index].sprites.length; i++) {
            if (!delete_these.has(i)) {
                new_sprites.push(this.game.data.levels[this.level_index].layers[this.layer_index].sprites[i]);
            }
        }
        this.game.data.levels[this.level_index].layers[this.layer_index].sprites = new_sprites;
        this.layer_structs[this.layer_index].apply_layer(this.game.data.levels[this.level_index].layers[this.layer_index]);
        this.clear_selection();
        this.refresh();
        this.render();
    }

    fix_scale() {
        this.scale = this.height / this.visible_pixels;
        if (this.scale < 0.05)
            this.scale = 0.05;
        if (this.scale > 8)
            this.scale = 8;
        this.visible_pixels = this.height / this.scale;
    }

    // ------------------------------------------------ Übersichtskarte (M)
    // level_minimap.js has the geometry. The picture is the level scene drawn
    // a second time, small, into the map's corner of the same canvas (layers
    // with Parallaxe where the view's camera puts them); a div on top gives
    // the border, the frame of the view and the mouse.
    minimap_size_of(ref) {
        const sprite = this.game.data.sprites[this.game.sprite_index_for_ref(ref)];
        return sprite ? { width: sprite.width, height: sprite.height } : null;
    }

    render_minimap() {
        const level = this.game.data.levels?.[this.level_index];
        const bounds = (this.show_minimap && !this.camera_mode && level) ?
            minimap_bounds(level.layers, (ref) => this.minimap_size_of(ref), Math.max(this.grid_width, this.grid_height)) : null;
        let box = $(this.element).children('.level-minimap');
        if (!bounds || this.width < 320 || this.height < 240) {
            box.remove();
            this.minimap = null;
            return;
        }
        if (!box.length) box = this.make_minimap_box();
        const layout = minimap_layout(bounds, Math.min(240, this.width * 0.3), Math.min(150, this.height * 0.3));
        this.minimap = { bounds, layout };
        box.css({ width: `${layout.width}px`, height: `${layout.height}px` });
        const view = {
            x0: this.camera_x - this.width * 0.5 / this.scale, x1: this.camera_x + this.width * 0.5 / this.scale,
            y0: this.camera_y - this.height * 0.5 / this.scale, y1: this.camera_y + this.height * 0.5 / this.scale,
        };
        const frame = minimap_view_frame(bounds, layout, view);
        box.children('.level-minimap-view').css({ left: `${frame.left}px`, top: `${frame.top}px`,
            width: `${frame.width}px`, height: `${frame.height}px`, display: frame.width > 0 && frame.height > 0 ? '' : 'none' });

        // the picture: everything but the editor's helpers, inside the box's
        // border (styles.css: 8 px from the corner, 1 px border)
        const cx = (bounds.x0 + bounds.x1) / 2, cy = (bounds.y0 + bounds.y1) / 2;
        this.minimap_camera ??= new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
        const camera = this.minimap_camera;
        camera.left = cx - layout.width / 2 / layout.scale;
        camera.right = cx + layout.width / 2 / layout.scale;
        camera.top = cy + layout.height / 2 / layout.scale;
        camera.bottom = cy - layout.height / 2 / layout.scale;
        camera.position.set(0, 0, 10);
        camera.updateProjectionMatrix();
        const helpers = [this.grid_group, this.cursor_group, this.rect_group, this.selection_group,
            this.backdrop_cursor, this.signal_links_group, this.platform_paths_group].filter(Boolean);
        const shown = helpers.map(group => group.visible);
        helpers.forEach(group => { group.visible = false; });
        const corner = 8 + 1;   // from the bottom left of the canvas
        this.renderer.setScissorTest(true);
        this.renderer.setScissor(corner, corner, layout.width, layout.height);
        this.renderer.setViewport(corner, corner, layout.width, layout.height);
        this.renderer.render(this.scene, camera);
        this.renderer.setScissorTest(false);
        this.renderer.setViewport(0, 0, this.width, this.height);
        helpers.forEach((group, i) => { group.visible = shown[i]; });
    }

    make_minimap_box() {
        const box = $('<div class="level-minimap">').attr('title', 'Übersichtskarte (M): klicken oder ziehen, um dorthin zu springen')
            .append($('<div class="level-minimap-view">')).appendTo(this.element);
        // the view's middle goes to the point under the mouse
        const jump = (e) => {
            if (!this.minimap) return;
            const offset = box.offset();
            // a finger, too
            const point = e.touches?.[0] ?? e.originalEvent?.touches?.[0] ?? e;
            const [x, y] = minimap_map_to_world(this.minimap.bounds, this.minimap.layout,
                point.pageX - offset.left - 1, point.pageY - offset.top - 1);
            this.camera_x = x;
            this.camera_y = y;
            if (this.backdrop_index !== null) this.backdrop_controls_setup_for = null;
            this.refresh();
            this.render();
        };
        box.on('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.button !== 0) return;
            jump(e);
            $(window).on('mousemove.level_minimap', jump).on('mouseup.level_minimap', () => $(window).off('.level_minimap'));
        });
        // the pen's sprite does not wait at the map's edge
        box.on('mouseenter', () => {
            if (this.cursor_group.visible) { this.cursor_group.visible = false; this.render(); }
        });
        // the level view must neither paint, nor zoom, nor open a menu through the map
        box.on('dblclick contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); });
        box.on('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            jump(e);
            $(window).on('touchmove.level_minimap', jump).on('touchend.level_minimap touchcancel.level_minimap', () => $(window).off('.level_minimap'));
        });
        box.on('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.zoom_at_point(e.originalEvent.deltaY, this.camera_x, this.camera_y);
            this.refresh();
            this.render();
        });
        return box;
    }

    // The hand tool, the middle mouse button and Leertaste + drag: the point
    // grabbed at mouse down follows the mouse.
    pan_view_to(touch) {
        this.camera_x = this.old_camera_position[0] - (touch[0] - this.mouse_down_position_raw[0]) / this.scale;
        this.camera_y = this.old_camera_position[1] + (touch[1] - this.mouse_down_position_raw[1]) / this.scale;
        if (this.backdrop_index !== null) this.backdrop_controls_setup_for = null;
        this.refresh();
        this.render();
    }

    // Leertaste held: the next drag moves the view (the cursor shows a hand).
    set_space_pan(on) {
        this.space_pan = !!on;
        $(this.element).toggleClass('space-pan', this.space_pan);
    }

    zoom_at_point(delta, cx, cy) {
        let sx = (cx - this.camera_x) * this.scale;
        let sy = (cy - this.camera_y) * this.scale;
        this.visible_pixels *= (1 + delta * 0.001);
        this.fix_scale();
        this.camera_x = cx - sx / this.scale;
        this.camera_y = cy - sy / this.scale;
        this.handleResize();
    }

    snap(wx, wy, sprite) {
        if (typeof(sprite) === 'undefined') sprite = true;
        if (!sprite) {
            wx += this.grid_width * 0.5;
            wy += this.grid_height * 0.5;
        }
        wx = Math.round(Math.floor((wx + this.grid_width / 2) / this.grid_width) * this.grid_width + (this.grid_x % this.grid_width));
        wy = Math.round(Math.floor((wy) / this.grid_height) * this.grid_height + (this.grid_y % this.grid_height));
        if (!sprite) {
            wx -= this.grid_width * 0.5;
        }
        return [wx, wy];
    }

    // exact: the world point unrounded (for snapping it afterwards)
    ui_to_world(p, snap, exact = false) {
        let layer = this.game.data.levels[this.level_index].layers[this.layer_index];
        let wx = this.camera_x + (p[0] - (this.width / 2)) / this.scale - this.camera_x * layer.properties.parallax;
        let wy = this.camera_y - (p[1] - (this.height / 2)) / this.scale - this.camera_y * layer.properties.parallax;
        if (exact) return [wx, wy];
        if (snap) {
            wx = Math.round(Math.floor((wx + this.grid_width / 2) / this.grid_width) * this.grid_width + (this.grid_x % this.grid_width));
            wy = Math.round(Math.floor((wy) / this.grid_height) * this.grid_height + (this.grid_y % this.grid_height));
        } else {
            wx = Math.round(wx);
            wy = Math.round(wy);
            // console.log(p, wx, wy);
        }
        return [wx, wy];
    }

    world_to_ui(p) {
        let layer = this.game.data.levels[this.level_index].layers[this.layer_index];
        let ox = this.camera_x - this.width * 0.5 / this.scale;
        let oy = this.camera_y + this.height * 0.5 / this.scale;
        let x0 = (p[0] + this.camera_x * layer.properties.parallax - ox) * this.scale;
        let y0 = (p[1] + this.camera_y * layer.properties.parallax - oy) * -this.scale;
        return [x0, y0];
    }

    handleResize() {
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        let targetAspectRatio = 16.0 / 9.0;
        this.bar_top.css('height', '0');
        this.bar_bottom.css('height', '0');
        this.bar_left.css('width', '0');
        this.bar_right.css('width', '0');
        if (this.camera_mode) {
            let real_height = this.height;
            this.camera_x = 0.0;
            this.camera_y = 0.0;
            if (this.height * targetAspectRatio > this.width) {
                let bar_size = Math.round((this.height - this.width / targetAspectRatio) * 0.5);
                this.bar_top.css('height', `${bar_size}px`);
                this.bar_bottom.css('height', `${bar_size}px`);
                real_height = this.width / targetAspectRatio;
            } else {
                let bar_size = Math.round((this.width - this.height * targetAspectRatio) * 0.5);
                this.bar_left.css('width', `${bar_size}px`);
                this.bar_right.css('width', `${bar_size}px`);
            }
            this.scale = real_height / 300.0;
        }
        // Game._load resizes before it makes the new LevelEditor: this one may
        // still point at a level the newly loaded game does not have
        if (!this.game.data.levels?.[this.level_index]?.layers?.[this.layer_index]) return;
        this.refresh_grid();
        this.render();
    }

    render() {

        let layer = this.game.data.levels[this.level_index].layers[this.layer_index];

        if (this.auto_adjust_camera) {
            this.auto_adjust_camera = false;
            let aabb = new THREE.Box3();
            for (let lyi = 0; lyi < this.game.data.levels[this.level_index].layers.length; lyi++) {
                try {
                    aabb.expandByObject(this.layer_structs[lyi].group, true);
                } catch {
                }
            }
            let center = aabb.getCenter(new THREE.Vector3());
            let size = aabb.getSize(new THREE.Vector3());
            this.camera_x = center.x;
            this.camera_y = center.y;
            if (isFinite(size.x) && isFinite(size.y) && size.x > 0 && size.y > 0) {
                this.visible_pixels = Math.max(size.x * (this.height / this.width) * 1.05, size.y * 1.05);
                this.fix_scale();
            }
            // console.log(aabb);
            // this.camera_x = (aabb.min.x + aabb.max.x) * 0.5;
            // this.camera_y = (aabb.min.y + aabb.max.y) * 0.5;
            // console.log(this.camera_x, this.camera_y);
        }

        this.selection_group.position.x = this.camera_x * layer.properties.parallax;
        this.selection_group.position.y = this.camera_y * layer.properties.parallax;
        this.rect_group.position.x = this.camera_x * layer.properties.parallax;
        this.rect_group.position.y = this.camera_y * layer.properties.parallax;
        this.grid_group.position.x = this.camera_x * layer.properties.parallax;
        this.grid_group.position.y = this.camera_y * layer.properties.parallax;
        this.cursor_group.position.x = this.camera_x * layer.properties.parallax;
        this.cursor_group.position.y = this.camera_y * layer.properties.parallax;

        // requestAnimationFrame((t) => this.render());
        this.camera.left = this.camera_x - this.width * 0.5 / this.scale;
        this.camera.right = this.camera_x + this.width * 0.5 / this.scale;
        this.camera.top = this.camera_y + this.height * 0.5 / this.scale;
        this.camera.bottom = this.camera_y - this.height * 0.5 / this.scale;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.renderer.sortObjects = false;
        this.renderer.render(this.scene, this.camera);
        this.render_minimap();
        this.place_signal_link_labels();
        this.place_platform_handle();
        // let data = {};
        // if (this.layer_structs.length > 0) {
        //     data.sprites = ((this.game.data.levels || [{}])[0].layers || [{}])[0].sprites.map(function(x) {return `#${x[0]} @ ${x[1]}/${x[2]}`;});
        //     data.psifp = this.layer_structs[0].placed_sprite_index_for_pos;
        //     data.ixtc = this.layer_structs[0].interval_tree_x.values;
        //     data.iytc = this.layer_structs[0].interval_tree_y.values;
        //     data.mfp = Object.keys(this.layer_structs[0].mesh_for_pos).length;
        // }
        // $('#layer_debug').text(JSON.stringify(data, null, 2));
    }

    refresh_grid() {
        let p0 = this.ui_to_world([0, this.height], false);
        let p1 = this.ui_to_world([this.width, 0], false);
        // let x0 = this.camera_x - this.width * 0.5 / this.scale;
        // let x1 = this.camera_x + this.width * 0.5 / this.scale;
        // let y0 = this.camera_y - this.height * 0.5 / this.scale;
        // let y1 = this.camera_y + this.height * 0.5 / this.scale;

        // x0 -= this.camera_x * this.game.data.levels[this.level_index].layers[this.layer_index].properties.parallax;
        // y0 -= this.camera_y * this.game.data.levels[this.level_index].layers[this.layer_index].properties.parallax;
        // x1 -= this.camera_x * this.game.data.levels[this.level_index].layers[this.layer_index].properties.parallax;
        // y1 -= this.camera_y * this.game.data.levels[this.level_index].layers[this.layer_index].properties.parallax;
        let x0 = p0[0]; let y0 = p0[1];
        let x1 = p1[0]; let y1 = p1[1];

        for (const child of this.grid_group.children) { child.geometry?.dispose(); child.material?.dispose(); }
        this.grid_group.remove.apply(this.grid_group, this.grid_group.children);
        // Every line twice, a dark one and a light one beside it (one screen
        // pixel apart), so the grid shows on a light sky as well as on dark
        // ground. It fades out when the cells get too small to aim at.
        const cell = Math.min(this.grid_width, this.grid_height) * this.scale;
        const opacity = 0.4 * Math.max(0, Math.min(1, (cell - 4) / 12));
        if (opacity <= 0) return;
        const pixel = 1 / this.scale;

        let points = [];
        let y = Math.floor(y0 / this.grid_height) * this.grid_height + (this.grid_y % this.grid_height);
        while (y < y1) {
            points.push(new THREE.Vector3(x0, y))
            points.push(new THREE.Vector3(x1, y))
            y += this.grid_height;
        }
        let x = Math.floor(x0 / this.grid_width) * this.grid_width - this.grid_width * 0.5 + (this.grid_x % this.grid_width);
        while (x < x1) {
            points.push(new THREE.Vector3(x, y0))
            points.push(new THREE.Vector3(x, y1))
            x += this.grid_width;
        }
        const dark = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0x1a1c2c, transparent: true, opacity }));
        dark.position.set(pixel, -pixel, 0);
        this.grid_group.add(dark);
        this.grid_group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity })));

        // points = [];
        // points.push(new THREE.Vector3(0, 0))
        // points.push(new THREE.Vector3(24, 0))
        // geometry = new THREE.BufferGeometry().setFromPoints(points);
        // material = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2.0, transparent: true});
        // line = new THREE.LineSegments(geometry, material);
        // this.grid_group.add(line);
        // points = [];
        // points.push(new THREE.Vector3(0, 0))
        // points.push(new THREE.Vector3(0, 24))
        // geometry = new THREE.BufferGeometry().setFromPoints(points);
        // material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2.0, transparent: true});
        // line = new THREE.LineSegments(geometry, material);
        // this.grid_group.add(line);
    }

    refresh_backdrop_controls() {
        this.backdrop_controls_setup_for = null;
    }

    // Puts the handles of the current rectangle and the gradient / effect
    // points where they belong on screen (CSS centres each on its point).
    // A point of a gradient or effect is relative to the layer's first
    // rectangle, the handles belong to the chosen one.
    place_backdrop_controls() {
        const backdrop = this.game.data.levels[this.level_index]?.layers?.[this.backdrop_index];
        const rect = backdrop?.rects?.[this.rect_index];
        if (!rect) return;
        const at = (id, point) => this.backdrop_move_elements[id]?.css({ left: `${point[0]}px`, top: `${point[1]}px` });
        // on a small rectangle the middle handles would cover the corners
        const [a, b] = [this.world_to_ui([rect.left, rect.bottom]), this.world_to_ui([rect.left + rect.width, rect.bottom + rect.height])];
        const room_x = Math.abs(b[0] - a[0]) >= 40, room_y = Math.abs(b[1] - a[1]) >= 40;
        for (const [handle, sides] of Object.entries(RECT_HANDLES)) {
            at(`rect_${handle}`, this.world_to_ui(rect_handle_point(rect, sides)));
            const middle = sides.length === 1;
            this.backdrop_move_elements[`rect_${handle}`]?.toggle(!middle || ('tb'.includes(sides) ? room_x : room_y));
        }
        const r0 = backdrop.rects[0];
        const relative = (u, v) => this.world_to_ui([r0.left + r0.width * u, r0.bottom + r0.height * v]);
        (backdrop.colors ?? []).forEach((c, ci) => at(`color_${ci}`, relative(c[1], c[2])));
        const defaults = shaders.control_points_for_effect?.[backdrop.effect] ?? [];
        defaults.forEach((d, cpi) => {
            const c = backdrop.control_points?.[cpi] ?? d;
            at(`control_point_${cpi}`, relative(c[0], c[1]));
        });
    }

    // Effect time for the preview: 0 = still (as before), else the clock.
    backdrop_time() {
        return this.animate_level ? this.clock.getElapsedTime() : 0;
    }

    set_backdrop_time(t) {
        for (const entry of this.backdrop_time_meshes) {
            const time = entry.mesh.material?.uniforms?.time;
            if (time) time.value = t * entry.speed;
        }
    }

    start_level_animation() {
        if (this.backdrop_animation_frame !== null) return;
        const step = () => {
            if (!this.animate_level) {
                this.backdrop_animation_frame = null;
                return;
            }
            // only while the level editor is on screen, and drawn only when something moved
            if ($(this.element).is(':visible')) {
                const time = this.backdrop_time();
                let moved = this.backdrop_time_meshes.length > 0;
                if (moved) this.set_backdrop_time(time);
                if (this.animate_sprites(time)) moved = true;
                if (moved) this.render();
            }
            this.backdrop_animation_frame = requestAnimationFrame(step);
        };
        this.backdrop_animation_frame = requestAnimationFrame(step);
    }

    // A material that shows one frame of a sprite's first state, with the
    // Mischmodus of the layer (or else of the sprite) like
    // Game.editor_sprite_material. Kept per frame picture and mode, so a frame
    // drawn anew simply gets a new one; another game starts afresh. (Here and
    // not in game.js: game.js is part of the recipe build's engine
    // fingerprint, and a preview must not make every recipe record again.)
    frame_material(si, fi, layer_blend) {
        const game = this.game;
        const frame = game.data.sprites[si]?.states?.[0]?.frames?.[fi];
        const base = game.material_for_sprite[si];
        if (!frame?.src || !base) return game.editor_sprite_material(si, layer_blend);
        if (this.frame_materials_for !== game.data) {
            this.frame_materials_for = game.data;
            this.frame_materials = new Map();
            this.frame_textures = new Map();
        }
        const mode = blend_mode_of(layer_blend) ?? blend_mode_of(game.data.sprites[si]?.blend);
        const key = `${mode ?? ''}|${frame.src}`;
        let material = this.frame_materials.get(key);
        if (!material) {
            let texture = this.frame_textures.get(frame.src);
            if (!texture) {
                texture = this.texture_loader.load(frame.src);
                texture.magFilter = THREE.NearestFilter;
                this.frame_textures.set(frame.src, texture);
            }
            material = base.clone();
            material.uniforms.texture1.value = texture;
            if (mode) material = blended_copy(material, mode);
            this.frame_materials.set(key, material);
        }
        return material;
    }

    // Every placed copy of a sprite with more than one frame in its first
    // state shows the frame the game would show now: the state's fps (default
    // 8, like app.js) and the copy's offset (sprite_frame_offset). True if a
    // copy changed its frame.
    animate_sprites(time) {
        const level = this.game.data.levels[this.level_index];
        const sprites = this.game.data.sprites;
        let changed = false;
        (this.layer_structs ?? []).forEach((struct, li) => {
            const layer = level?.layers[li];
            if (layer?.type !== 'sprites' || layer.properties?.visible === false) return;
            for (const mesh of Object.values(struct.mesh_for_pos)) {
                const si = mesh.userData.sprite_index;
                const state = sprites[si]?.states?.[0];
                const count = state?.frames?.length ?? 0;
                if (count < 2) continue;
                const fps = Number.isFinite(state.properties?.fps) && state.properties.fps > 0 ? state.properties.fps : 8;
                const step = Math.floor(time * fps + sprite_frame_offset(state.properties, sprites[si], mesh.position.x, mesh.position.y));
                const fi = ((step % count) + count) % count;
                const material = this.frame_material(si, fi, layer.properties?.blend);
                if (mesh.material !== material) {
                    mesh.material = material;
                    changed = true;
                }
            }
        });
        return changed;
    }

    refresh_blend_materials() {
        for (const layer_struct of this.layer_structs ?? []) layer_struct.refresh_materials();
    }

    refresh() {
        let self = this;
        // every label that names the level, the layer or the selection
        // follows what is shown now (after switching, renaming, undo …)
        this.update_layer_label();
        this.update_level_settings_head();
        this.update_layer_settings_head();
        this.update_placed_title();
        this.scene.remove.apply(this.scene, this.scene.children);
        this.scene.background = new THREE.Color(parse_html_color(this.game.data.levels[this.level_index].properties.background_color));

        this.refresh_grid();
        // // remove all elements in the scene
        // this.scene.remove.apply(this.scene, this.scene.children);
        // if (game === null) return;

        this.backdrop_time_meshes = [];
        // re-create all sprite sheets
        this.sheets = [];
        for (let si = 0; si < this.game.data.sprites.length; si++) {
            let fi = Math.floor(this.game.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let frame = this.game.data.sprites[si].states[0].frames[fi];
            let info = { width: this.game.data.sprites[si].width, height: this.game.data.sprites[si].height, sprites: { sprite: { x: 0, y: 0, width: this.game.data.sprites[si].width, height: this.game.data.sprites[si].height } } };
            let sheet = new SpriteSheet(this.texture_loader, frame.src, info);
            this.sheets.push(sheet);
        }

        // Hervorheben (D): the layers keep their order. A dark veil lies over
        // everything behind the current layer; the layers in front of it are
        // drawn faint (dim_layer_group), so the current one shows through.
        const dim = this.dim_other_layers && this.game.data.levels[this.level_index].layers.length > 1;
        const add_layer = (li) => {
            const before = this.scene.children.length;
            add_layer_now(li);
            const faint = dim && li < this.layer_index;
            for (const group of this.scene.children.slice(before))
                if (group !== this.cursor_group) this.dim_layer_group(group, faint);
        };
        const add_layer_now = (li) => {
            if (li < this.layer_structs.length) {
                if (!this.game.data.levels[this.level_index].layers[li].properties.visible)
                    return;
                if (this.game.data.levels[this.level_index].layers[li].type === 'sprites') {
                    this.layer_structs[li].group.position.x = this.camera_x * this.game.data.levels[this.level_index].layers[li].properties.parallax;
                    this.layer_structs[li].group.position.y = this.camera_y * this.game.data.levels[this.level_index].layers[li].properties.parallax;
                    this.scene.add(this.layer_structs[li].group);
                    if (this.layer_index === li)
                        this.scene.add(this.cursor_group);
                } else if (this.game.data.levels[this.level_index].layers[li].type === 'backdrop') {
                    let backdrop = this.game.data.levels[this.level_index].layers[li];
                    let rect0 = backdrop.rects[0];
                    // Parallaxe, as in the game (app.js moves every layer by camera × parallax)
                    // and as ui_to_world already assumes when its rectangles are edited
                    const parallax = backdrop.properties?.parallax ?? 0;
                    const backdrop_group = new THREE.Group();
                    backdrop_group.position.set(this.camera_x * parallax, this.camera_y * parallax, 0);
                    this.scene.add(backdrop_group);
                    for (let ri = 0; ri < backdrop.rects.length; ri++) {
                        let rect = backdrop.rects[ri];
                        let geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
                        geometry.translate(0.5, 0.5, 0.0);
                        geometry.scale(rect.width, rect.height, 1.0);
                        geometry.translate(rect.left, rect.bottom, 0);
                        // geometry.translate(0, 0, -1);
                        // backdrops.js: the same materials as in the game, plus default control points
                        let material = backdrop_material(backdrop, rect0, { fill_default_points: true, scale_as_array: true,
                            stencil_ref: backdrop_stencil_ref(li) });
                        if (backdrop.backdrop_type === 'effect' || backdrop.backdrop_type === 'color')
                            set_backdrop_uv(geometry, rect);
                        let mesh = new THREE.Mesh(geometry, material);
                        if (backdrop.backdrop_type === 'effect' && material.uniforms?.time) {
                            const entry = { mesh, speed: backdrop.speed ?? 1.0 };
                            this.backdrop_time_meshes.push(entry);
                            material.uniforms.time.value = this.backdrop_time() * entry.speed;
                        }
                        backdrop_group.add(mesh);
                    }
                }
            }
        };
        for (let li = this.game.data.levels[this.level_index].layers.length - 1; li >= 0; li--) {
            if (dim && li === this.layer_index) this.scene.add(this.dim_veil());
            add_layer(li);
        }
        if (this.show_grid)
            this.scene.add(this.grid_group);
        this.scene.add(this.selection_group);
        this.scene.add(this.rect_group);

        this.backdrop_index = null;
        if (['backdrop', 'signal_area', 'movement_region'].includes(this.game.data.levels[this.level_index].layers[this.layer_index].type))
            this.backdrop_index = this.layer_index;
        this.backdrop_index_shown = this.backdrop_index;
        if (this.show_regions) this.scene.add(this.region_outlines());

        if (this.backdrop_index !== null && menus.level.active_key === null &&
            this.game.data.levels[this.level_index].layers[this.backdrop_index].rects?.[this.rect_index]) {
            let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
            this.backdrop_cursor.remove.apply(this.backdrop_cursor, this.backdrop_cursor.children);
            // the rectangle and its handles sit where the layer is drawn (Parallaxe)
            const cursor_parallax = backdrop.properties?.parallax ?? 0;
            this.backdrop_cursor.position.set(this.camera_x * cursor_parallax, this.camera_y * cursor_parallax, 0);
            if (backdrop.type === 'signal_area' || backdrop.type === 'movement_region') {
                // all rectangles of the region, so one can see where it applies
                const outline = new THREE.LineBasicMaterial({ color: backdrop.type === 'movement_region' ? 0x38b764 : 0xffcd75,
                    linewidth: 1.0, transparent: true, opacity: 0.65 });
                for (const rect of backdrop.rects) {
                    if (!valid_signal_rect(rect)) continue;
                    const points = [
                        new THREE.Vector3(rect.left, rect.bottom),
                        new THREE.Vector3(rect.left + rect.width, rect.bottom),
                        new THREE.Vector3(rect.left + rect.width, rect.bottom + rect.height),
                        new THREE.Vector3(rect.left, rect.bottom + rect.height),
                    ];
                    this.backdrop_cursor.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), outline));
                }
                for (const arrow of this.gravity_arrows(backdrop, outline)) this.backdrop_cursor.add(arrow);
            }
            let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5, transparent: true });

            let points = [];
            if (this.rect_index !== null && this.rect_index < backdrop.rects.length) {
                points.push(new THREE.Vector3(backdrop.rects[this.rect_index].left, backdrop.rects[this.rect_index].bottom));
                points.push(new THREE.Vector3(backdrop.rects[this.rect_index].left + backdrop.rects[this.rect_index].width, backdrop.rects[this.rect_index].bottom));
                points.push(new THREE.Vector3(backdrop.rects[this.rect_index].left + backdrop.rects[this.rect_index].width, backdrop.rects[this.rect_index].bottom + backdrop.rects[this.rect_index].height));
                points.push(new THREE.Vector3(backdrop.rects[this.rect_index].left, backdrop.rects[this.rect_index].bottom + backdrop.rects[this.rect_index].height));
                let geometry = new THREE.BufferGeometry().setFromPoints(points);
                this.backdrop_cursor.add(new THREE.LineLoop(geometry, material));
                // a round gradient: the circle where colour 2 is reached
                if (backdrop.backdrop_type === 'color' && backdrop_gradient_radial(backdrop) && backdrop.rects[0]) {
                    const r0 = backdrop.rects[0];
                    const [c0, c1] = backdrop.colors;
                    const cx = r0.left + r0.width * c0[1], cy = r0.bottom + r0.height * c0[2];
                    const radius = Math.hypot(r0.width * (c1[1] - c0[1]), r0.height * (c1[2] - c0[2]));
                    const circle = [];
                    for (let i = 0; i < 96; i++) {
                        const a = i / 96 * Math.PI * 2;
                        circle.push(new THREE.Vector3(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius));
                    }
                    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circle),
                        new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 6 / this.scale, gapSize: 4 / this.scale, transparent: true, opacity: 0.8 }));
                    ring.computeLineDistances();
                    this.backdrop_cursor.add(ring);
                }
                this.scene.add(this.backdrop_cursor);
            }
        }
        if (this.backdrop_controls_setup_for === null) {
            this.backdrop_move_elements = {};
            this.backdrop_controls_setup_for = [this.backdrop_index, this.rect_index];
            for (let x of this.backdrop_controls)
                $(x).remove();
            this.backdrop_controls = [];
            if (this.backdrop_index !== null && menus.level.active_key === null && !this.layer_locked(this.backdrop_index) &&
                this.game.data.levels[this.level_index].layers[this.backdrop_index].rects?.[this.rect_index]) {
                let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                let rect = backdrop.rects[this.rect_index];
                // the eight square handles of the rectangle (level_rects.js); the
                // round ones are the points of a gradient or an effect
                const add_control = (id, element, old_coordinates) => {
                    this.backdrop_controls.push(element);
                    this.backdrop_move_elements[id] = element;
                    element.on('mousedown touchstart', (e) => {
                        if (!e.touches && e.button !== 0) return;   // the middle button moves the view
                        self.backdrop_move_point = id;
                        self.backdrop_move_point_old_coordinates = old_coordinates();
                        self.backdrop_move_point_old_rect = { ...rect };
                        self.backdrop_move_element = element;
                        self.handle_down(e);
                    });
                    $(this.element).append(element);
                };
                for (const handle of Object.keys(RECT_HANDLES)) {
                    add_control(`rect_${handle}`, $('<div class="backdrop-handle">').css('cursor', RECT_HANDLE_CURSORS[handle])
                        .attr('title', 'Ziehen, um das Rechteck größer oder kleiner zu machen'), () => [rect.left, rect.bottom]);
                }
                if (backdrop.backdrop_type === 'color' && backdrop.colors.length > 1) {
                    for (let ci = 0; ci < backdrop.colors.length; ci++) {
                        const c = backdrop.colors[ci];
                        add_control(`color_${ci}`, $('<div class="backdrop-swatch">').css('background-color', c[0])
                            .attr('title', `Farbe ${ci + 1}: ziehen, um den Verlauf zu verschieben`), () => [c[1], c[2]]);
                    }
                }
                if (backdrop.backdrop_type === 'effect') {
                    const default_control_points = shaders.control_points_for_effect[backdrop.effect] ?? [];
                    for (let cpi = 0; cpi < default_control_points.length; cpi++) {
                        add_control(`control_point_${cpi}`, $('<div class="backdrop-swatch">').css('background-color', '#fff'), () => {
                            const c = backdrop.control_points[cpi] ?? default_control_points[cpi];
                            return [c[0], c[1]];
                        });
                    }
                }
                this.place_backdrop_controls();
            }
        }

        // rebuilt when the selection changes (which sprites, in which layer)
        const selection_key = this.selection.length ? `${this.level_index}:${this.layer_index}:${this.selection.join(',')}` : null;
        let placed_properties_need_update = (this.placed_properties_for ?? null) !== selection_key;
        this.placed_properties_for = selection_key;
        if (!selection_key) {
            // nothing selected: what this panel is for (once, not on every refresh)
            if (!$('#menu_placed_properties > .placed-hint').length) {
                $('#menu_placed_properties').empty();
                this.show_placed_hint();
            }
            $('#placed_properties_title').text('Auswahl');
            this.update_signal_links = null;
            placed_properties_need_update = false;
        }

        if (placed_properties_need_update) {
            $('#menu_placed_properties').empty();
            this.update_placed_title();
            this.update_signal_links = null;
            this.add_selection_controls($('#menu_placed_properties'));
            if (this.selection.length === 1) {
                let div = $(`<div>`).appendTo($('#menu_placed_properties'));
                let entry_index = this.selection[0];
                let entry = this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index];
                let sprite = this.game.data.sprites[this.game.sprite_index_for_ref(entry[0])];
                // which sprite this is (its Titel, else its number)
                $('<div class="placed-sprite-title">')
                    .text(sprite_label(sprite, this.game.sprite_index_for_ref(entry[0]))).appendTo(div);
                // what is connected (signals.js): written right under each Code
                this.signal_link_lines = [];
                const level = this.game.data.levels[this.level_index];
                const { traits_of } = this.signal_context();
                const placed_now = () => this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index];
                const props_of = (trait) => (placed_now()[3] ?? {})[trait] ?? {};
                const writable_props_of = (trait) => {
                    const placed = placed_now();
                    placed[3] ??= {};
                    placed[3][trait] ??= {};
                    return placed[3][trait];
                };
                const widgets = {};
                for (let trait in sprite.traits) {
                    for (let key in ((SPRITE_TRAITS[trait] ?? {}).placed_properties ?? {})) {
                        let property = SPRITE_TRAITS[trait].placed_properties[key];
                        // visible(traits of the drawing, traits_of, this copy's settings)
                        if (property.visible && !property.visible(sprite.traits, traits_of, props_of(trait), level)) continue;
                        // absent: the default (some take it from the drawing)
                        const get = () => props_of(trait)[key] ?? (property.default_for ? property.default_for(sprite.traits) : property.default);
                        const set = (value) => {
                            const props = writable_props_of(trait);
                            props[key] = value;
                            // "sendet, wenn besiegt": an enemy without a Code gets a free one
                            if (trait === 'baddie' && key === 'signal_on_defeat') {
                                give_defeat_sender_code(level, props);
                                widgets['baddie/signal_code']?.refresh();
                            }
                            // "spricht bei Signal" / "sendet, wenn eingesammelt": a free Code, so it does
                            // not start with the keys and doors on 0
                            // a platform "bei Signal" (platforms.js) as well
                            if (((trait === 'text' && key === 'speaks_on_signal') || (trait === 'pickup' && key === 'signal_on_collect') ||
                                (trait === 'companion' && key === 'waits_for_signal') || (trait === 'level_complete' && key === 'opens_on_signal') ||
                                (trait === 'moving' && key === 'start' && value === 'signal')) &&
                                (value === true || value === 'signal') && !('signal_code' in props))
                                props.signal_code = free_signal_code(level);
                            // an exit that sends while the figure stands at it: a free Code, too
                            if (trait === 'level_complete' && key === 'signal_on_reach' && value === true && !('send_code' in props))
                                props.send_code = free_signal_code(level);
                            // the exit's line in the Signale-Übersicht changes with its settings
                            if (trait === 'level_complete') this.refresh_signal_overview?.();
                            // a setting that shows or hides others ("Wer spricht" → Textfarbe)
                            if (property.rebuilds_panel) {
                                this.placed_properties_for = null;
                                setTimeout(() => this.refresh(), 0);
                            }
                            this.update_signal_links?.();
                            // the Weg of a platform is drawn in the level
                            if (trait === 'moving') {
                                this.build_platform_paths();
                                this.render();
                            }
                        };
                        let widget = null;
                        if (key === 'signal_code' || key === 'drop_code' || key === 'send_code') {
                            // a number and the level's signals with their names; an emptied
                            // Code is "kein Signal" (not for the Beute: absent there means the drawing's Code)
                            const clear = key === 'drop_code' ? null : () => {
                                const props = writable_props_of(trait);
                                // what an exit sends: it stops sending
                                if (key === 'send_code' && trait === 'level_complete') {
                                    props.signal_on_reach = false;
                                    delete props.send_code;
                                    this.placed_properties_for = null;
                                    setTimeout(() => this.refresh(), 0);
                                    this.update_signal_links?.();
                                    return;
                                }
                                // what a Zähler sends: "kein Signal"
                                if (key === 'send_code') {
                                    props.send_code = null;
                                    this.update_signal_links?.();
                                    return;
                                }
                                // an enemy or a sign: its signal switches off; a key, door,
                                // Schalter or Druckplatte: null, it neither sends nor reacts
                                const flag = { baddie: 'signal_on_defeat', text: 'speaks_on_signal', pickup: 'signal_on_collect', companion: 'waits_for_signal',
                                    level_complete: 'opens_on_signal' }[trait];
                                if (flag) {
                                    props[flag] = false;
                                    delete props.signal_code;
                                    this.placed_properties_for = null;
                                    setTimeout(() => this.refresh(), 0);
                                } else props.signal_code = null;
                                this.update_signal_links?.();
                            };
                            widget = new SignalCodeWidget({
                                editor: this,
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                max: property.max ?? 1000,
                                get: () => props_of(trait)[key] === null ? null : get(),
                                set,
                                clear,
                            });
                        } else if (property.type === 'int' || property.type === 'float') {
                            widget = new NumberWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                min: property.min ?? null,
                                max: property.max ?? null,
                                step: property.step ?? null,
                                decimalPlaces: property.decimalPlaces ?? null,
                                width: property.width ?? null,
                                suffix: property.suffix ?? null,
                                count: property.count ?? null,
                                connector: property.connector ?? null,
                                onfocus: property.onfocus ?? null,
                                onblur: property.onblur ?? null,
                                onchange: property.onchange ?? null,
                                get,
                                set: (x) => set(property.type === 'int' ? Math.round(x) : x),
                            });
                        } else if (property.type === 'bool') {
                            widget = new CheckboxWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                get: () => Boolean(get()),
                                set: (x) => set(Boolean(x)),
                            });
                        } else if (property.type === 'override') {
                            // yes / no for this placed sprite, or as drawn (absent)
                            const drawn = Boolean(sprite.traits[trait]?.[key]);
                            widget = new SelectWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: { drawn: `wie beim Sprite (${drawn ? 'ja' : 'nein'})`, yes: 'ja', no: 'nein' },
                                get: () => {
                                    const value = props_of(trait)[key];
                                    return typeof value === 'boolean' ? (value ? 'yes' : 'no') : 'drawn';
                                },
                                set: (x) => {
                                    if (x !== 'drawn') return set(x === 'yes');
                                    delete writable_props_of(trait)[key];
                                    this.update_signal_links?.();
                                },
                            });
                        } else if (property.type === 'select') {
                            widget = new SelectWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: property.options ?? null,
                                get,
                                set,
                            });
                        } else if (property.type === 'level_target') {
                            // where an exit leads (level_flow.js): '' = nothing chosen, the next level;
                            // an older game's Delta (not 1) is a choice of its own until another is made
                            const old_delta = () => {
                                const d = props_of(trait).delta;
                                return Number.isFinite(d) && Math.round(d) !== 1 && !clean_level_target(props_of(trait)[key]) ? Math.round(d) : null;
                            };
                            widget = new SelectWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: Object.fromEntries(this.level_target_choices(props_of(trait)[key], old_delta())),
                                get: () => clean_level_target(props_of(trait)[key]) ?? (old_delta() !== null ? LEVEL_TARGET_DELTA : ''),
                                set: (value) => {
                                    if (value === LEVEL_TARGET_DELTA) return;
                                    const props = writable_props_of(trait);
                                    // a new choice replaces the old Delta for good
                                    delete props.delta;
                                    if (value) return set(value);
                                    delete props[key];
                                    this.update_signal_links?.();
                                    this.refresh_signal_overview?.();
                                },
                            });
                        } else if (property.type === 'string') {
                            widget = new LineEditWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: property.options ?? null,
                                get,
                                set,
                            });
                            // e.g. "Neue Sprechblase": puts a | where the cursor is
                            const insert = property.options?.insert_button;
                            if (insert) {
                                const field = widget.input;
                                $('<button type="button">').addClass('text-insert-button')
                                    .append($('<i>').addClass(`fa ${insert.icon ?? 'fa-plus'}`))
                                    .append(document.createTextNode(` ${insert.label}`))
                                    .on('mousedown', (e) => e.preventDefault())   // the field keeps its cursor
                                    .on('click', () => {
                                        const el = field[0];
                                        const value = el.value, from = el.selectionStart ?? value.length, to = el.selectionEnd ?? from;
                                        el.value = value.slice(0, from) + insert.text + value.slice(to);
                                        el.selectionStart = el.selectionEnd = from + insert.text.length;
                                        widget.update();
                                        el.focus();
                                    })
                                    .insertAfter(field);
                            }
                        } else if (property.type === 'color') {
                            widget = new ColorWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                get,
                                set,
                            });
                        }
                        widgets[`${trait}/${key}`] = widget;
                        if (key === 'signal_code' || key === 'drop_code' || key === 'send_code') this.add_signal_link_line(div, trait, key, entry_index);
                    }
                }
                this.add_signal_links(sprite, entry_index);
                // a Preis in a game where nothing gives points: nobody could buy it
                if ('pickup' in sprite.traits && Number(props_of('pickup').price) > 0 &&
                    !this.game.data.sprites.some(other => (Number(other?.traits?.pickup?.points) || 0) > 0))
                    $('<p class="trait-warning">').text('In deinem Spiel gibt noch nichts Punkte – dann kann man das hier nicht kaufen. Gib zum Beispiel einer Münze „gibt Punkte“.').appendTo(div);
            }
        }
        /*
        add_sprite_trait_controls(trait, element) {
            let self = this;
            let si = canvas.sprite_index;
            let div = $(`<div class='menu'>`);
            let bu_delete = $(`<button class='btn'>`).append($(`<i class='fa fa-trash'>`));
            bu_delete.click(function(e) {
                self.remove_sprite_trait(trait);
                self.build_sprite_traits_menu();
            });
            let title = $(`<h4>`).append($('<span>').text(SPRITE_TRAITS[trait].label)).append(bu_delete).appendTo(div);
            let info = SPRITE_TRAITS[trait] ?? {};
            for (let key in info.properties ?? {}) {
                let property = info.properties[key];
                if (property.type === 'float') {
                    new NumberWidget({
                        container: div,
                        label: property.label ?? key,
                        hint: property.hint ?? null,
                        min: property.min ?? null,
                        max: property.max ?? null,
                        step: property.step ?? null,
                        decimalPlaces: property.decimalPlaces ?? null,
                        width: property.width ?? null,
                        suffix: property.suffix ?? null,
                        count: property.count ?? null,
                        connector: property.connector ?? null,
                        onfocus: property.onfocus ?? null,
                        onblur: property.onblur ?? null,
                        onchange: property.onchange ?? null,
                        get: () => self.data.sprites[si].traits[trait][key],
                        set: (...x) => {
                            let y = x;
                            if (y.length === 1) y = y[0];
                            self.data.sprites[si].traits[trait][key] = y;
                        },
                    });
                } else if (property.type === 'bool') {
                    new CheckboxWidget({
                        container: div,
                        label: property.label ?? key,
                        hint: property.hint ?? null,
                        get: () => self.data.sprites[si].traits[trait][key],
                        set: (x) => {
                            self.data.sprites[si].traits[trait][key] = x;
                        },
                    });
                } else if (property.type === 'select') {
                    new SelectWidget({
                        container: div,
                        label: property.label ?? key,
                        hint: property.hint ?? null,
                        options: property.options ?? null,
                        get: () => self.data.sprites[si].traits[trait][key],
                        set: (x) => {
                            self.data.sprites[si].traits[trait][key] = x;
                        },
                    });
                }
            }
            div.insertAfter(element);
        }
    */
        this.scene.add(this.signal_links_group);
        this.scene.add(this.platform_paths_group);
        this.build_signal_links();
    }

    // The selected platform (one placed sprite with "bewegt sich"), if its
    // end may be dragged: { layer, index, placed, sprite, settings } or null.
    selected_platform() {
        const layer = this.current_sprite_layer();
        if (!layer || this.selection.length !== 1 || typeof platform_settings !== 'function') return null;
        if (!layer.properties?.collision_detection || Math.abs(layer.properties?.parallax ?? 0) >= 0.0001) return null;
        if (this.read_only_level() || this.layer_locked()) return null;
        const placed = layer.sprites[this.selection[0]];
        const sprite = this.game.data.sprites[this.game.sprite_index_for_ref(placed?.[0])];
        if (!sprite?.traits || !('moving' in sprite.traits)) return null;
        return { layer, index: this.selection[0], placed, sprite, settings: platform_settings(sprite.traits.moving, placed[3]?.moving) };
    }

    // A round handle in the middle of the dashed end frame: dragging it sets
    // the Weg (placed moving.path_x / path_y), the end on whole grid cells
    // like the pen (sprite_grid_point; with Shift pixel by pixel).
    place_platform_handle() {
        const found = menus.level.active_key === 'tool/select' && !this.moving_selection ? this.selected_platform() : null;
        let handle = $(this.element).find('.platform-end-handle');
        if (!found) { if (!this.platform_drag) handle.remove(); return; }
        if (!handle.length) {
            handle = $('<div class="platform-end-handle"><i class="fa fa-arrows"></i></div>')
                .attr('title', 'Ziehen: bis hierhin fährt die Plattform')
                .on('mousedown touchstart', (e) => this.start_platform_drag(e))
                .appendTo(this.element);
        }
        const end = platform_end(found.placed[1], found.placed[2], found.settings);
        const x = end.x, y = end.y + found.sprite.height / 2;
        handle.css({ left: `${this.width / 2 + (x - this.camera_x) * this.scale}px`,
            top: `${this.height / 2 - (y - this.camera_y) * this.scale}px` });
    }

    start_platform_drag(e) {
        if (!e.touches && e.button !== 0) return;     // the middle button moves the view
        const found = this.selected_platform();
        if (!found) return;
        e.preventDefault();
        e.stopPropagation();
        this.platform_drag = { index: found.index };
        const move = (ev) => {
            const now = this.selected_platform();
            if (!now) return;
            const [wx, wy] = this.ui_to_world(this.get_touch_point(ev), false, true);
            const w = now.sprite.width, h = now.sprite.height, grid = this.selection_grid();
            // the pointer holds the middle of the end frame
            let [x, y] = ev.shiftKey ? [Math.round(wx), Math.round(wy - h / 2)] :
                sprite_grid_point(wx - w / 2 + grid.width / 2, wy - h / 2 + grid.height / 2, w, h, grid);
            const props = ((now.placed[3] ??= {}).moving ??= {});
            const path_x = x - now.placed[1], path_y = y - now.placed[2];
            if (props.path_x === path_x && props.path_y === path_y) return;
            props.path_x = path_x;
            props.path_y = path_y;
            this.build_platform_paths();
            this.render();
        };
        const up = () => {
            $(window).off('mousemove.platform touchmove.platform', move).off('mouseup.platform touchend.platform', up);
            this.platform_drag = null;
            // the fields show the new Weg
            this.placed_properties_for = null;
            this.refresh();
            this.render();
        };
        $(window).on('mousemove.platform touchmove.platform', move).on('mouseup.platform touchend.platform', up);
    }

    // Bewegte Plattformen (platforms.js): the Weg of every copy as a dashed
    // line from where it stands to where it goes, and a dashed frame at the
    // end. Only in layers where the game moves them (with collisions, no
    // Parallaxe). Rebuilt with the signal links, i.e. after every change.
    build_platform_paths() {
        const group = this.platform_paths_group;
        for (const child of [...group.children]) {
            group.remove(child);
            child.geometry?.dispose?.();
        }
        const level = this.game.data.levels?.[this.level_index];
        if (!level || typeof platform_settings !== 'function') return;
        this.platform_path_material ??= new THREE.LineDashedMaterial({ color: 0x73eff7, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.9, depthTest: false });
        this.platform_path_shadow ??= new THREE.LineBasicMaterial({ color: 0x1a1c2c, transparent: true, opacity: 0.5, depthTest: false });
        level.layers.forEach((layer) => {
            if (layer?.type !== 'sprites' || layer.properties?.visible === false || !layer.properties?.collision_detection ||
                Math.abs(layer.properties?.parallax ?? 0) >= 0.0001) return;
            for (const placed of layer.sprites ?? []) {
                const sprite = this.game.data.sprites[this.game.sprite_index_for_ref(placed[0])];
                if (!sprite?.traits || !('moving' in sprite.traits)) continue;
                const settings = platform_settings(sprite.traits.moving, placed[3]?.moving);
                if (!(settings.length > 0)) continue;
                const end = platform_end(placed[1], placed[2], settings);
                const h = sprite.height / 2, w = sprite.width / 2;
                const line = [new THREE.Vector3(placed[1], placed[2] + h, 3), new THREE.Vector3(end.x, end.y + h, 3)];
                const frame = [[-w, 0], [w, 0], [w, 2 * h], [-w, 2 * h], [-w, 0]].map(([x, y]) => new THREE.Vector3(end.x + x, end.y + y, 3));
                for (const points of [line, frame]) {
                    // dark between the dashes: visible on a light sky and on dark walls
                    const shadow = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.platform_path_shadow);
                    shadow.renderOrder = 8;
                    const dashed = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.platform_path_material);
                    dashed.computeLineDistances();
                    dashed.renderOrder = 9;
                    group.add(shadow, dashed);
                }
            }
        });
    }

    // The grid is the game's Rastergröße (level_selection.js game_grid_size)
    // – set again when that changes or another game is loaded; a size typed
    // into Gittergröße stays until then.
    sync_grid_to_game() {
        const size = game_grid_size(this.game.data);
        if (this.grid_synced_for?.data === this.game.data && this.grid_synced_for.size === size) return;
        this.grid_synced_for = { data: this.game.data, size };
        this.grid_width = size;
        this.grid_height = size;
        this.grid_x = 0;
        this.grid_y = 0;
        this.grid_size_widget?.refresh();
        this.grid_offset_widget?.refresh();
        this.update_grid_summary?.();
    }

    // Where the pen puts the current sprite: whole grid cells from its lower
    // left corner (sprite_grid_point); Shift: wherever the pointer is.
    pen_point(touch, free = false) {
        if (free) return this.ui_to_world(touch, false);
        const sprite = this.game.data.sprites[this.sprite_index];
        const [wx, wy] = this.ui_to_world(touch, false, true);
        return sprite_grid_point(wx, wy, sprite?.width ?? this.grid_width, sprite?.height ?? this.grid_height, this.selection_grid());
    }

    // The cells of a line, frame or rectangle of the current sprite.
    pen_grid() {
        const sprite = this.game.data.sprites[this.sprite_index];
        return sprite_grid_step(sprite?.width ?? this.grid_width, sprite?.height ?? this.grid_height, this.selection_grid());
    }

    refresh_sprite_widget() {
        this.sync_grid_to_game();
        $('#menu_level_sprites').empty();
        // search and filters (sprite_filter.js); "in diesem Level": the sprites placed here
        if (!this.palette_filter && typeof SpriteFilter === 'function' && $('#level_sprite_filter').length) {
            this.palette_filter = new SpriteFilter({
                container: $('#level_sprite_filter'),
                sprites: () => this.game.data.sprites,
                used_ids: () => this.sprite_ids_in_level(),
                on_change: (visible) => $('#menu_level_sprites > .button').each((i, button) => {
                    $(button).toggle(visible[$(button).data('sprite_index')] !== false);
                }),
            });
        }
        for (let si = 0; si < this.game.data.sprites.length; si++) {
            this.game.update_material_for_sprite(si);
            let fi = Math.floor(this.game.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let sprite_button = $(`<div>`).addClass('button button-3').appendTo($('#menu_level_sprites'));
            // sprite_button.append($('<img>').attr('src', this.game.data.sprites[si].states[0].frames[fi].src).css('width', '100%').css('image-rendering', 'pixelated'));
            sprite_button.css('background-image', `url(${this.game.data.sprites[si].states[0].frames[fi].src})`);
            sprite_button.css('background-size', 'contain');
            sprite_button.css('image-rendering', 'pixelated');
            sprite_button.data('sprite_index', si);
            sprite_button.attr('title', sprite_label(this.game.data.sprites[si], si));
            sprite_button.on('contextmenu', (e) => {
                show_context_menu(e.clientX, e.clientY, this.sprite_button_context_menu($(e.currentTarget).data('sprite_index')));
                return false;
            });
            // if (si === 0) sprite_button.addClass('active');
            sprite_button.mousedown(function(e) {
                e.preventDefault();
                $(e.target).closest('.menu').find('.button').removeClass('active');
                let button = $(e.target.closest('.button'));
                button.addClass('active');
                self.sprite_index = button.data('sprite_index');
                // a sprite chosen: the pen places it again (not X: erasing)
                self.set_pen_erasing(false);
                // the grid stays the game's Rastergröße (sprite_grid_point puts
                // bigger sprites on whole cells), it does not follow the sprite
                self.refresh();
                self.render();
                menus.level.handle_click('tool/pen');
            });
        }
        // X: the pen erases – a switch above the sprites, like "durchsichtig"
        // among the colours of the sprite editor
        if (!this.eraser_toggle) {
            // one switch, also after a game was loaded (a new editor)
            $('.level-palette .eraser-toggle').remove();
            this.eraser_toggle = $('<button type="button" class="view-toggle eraser-toggle">')
                .attr('title', 'Radieren (X) – der Stift löscht, statt zu setzen. Ein Klick auf ein Sprite oder noch einmal X: wieder setzen.')
                .append($('<span class="view-toggle-dot">')).append($('<span>').text('Radieren'))
                .append($('<span class="key widget-key">').text(printed_key('X')))
                .on('click', () => this.set_pen_erasing(!this.pen_erasing))
                .insertBefore($('#level_sprite_filter'));
        }
        this.eraser_toggle.toggleClass('active', !!this.pen_erasing);
        // a game with only a few sprites: where more come from
        if (this.game.data.sprites.length < 4) {
            const hint = $('<div class="palette-hint">').appendTo($('#menu_level_sprites'));
            $('<div>').text('Mehr Sprites? Zeichne sie im Tab „Sprites“ – oder hol dir fertige aus dem Sprite-Katalog.').appendTo(hint);
            if (typeof show_sprite_basket === 'function')
                $('<button type="button">').append($('<i class="fa fa-shopping-basket">')).append(' Sprites holen').appendTo(hint)
                    .on('click', () => show_sprite_basket());
        }
        this.palette_filter?.refresh();
        this.refresh();
        let self = this;
        setTimeout(function() { self.render(); }, 0);
        menus.level.callback();
    }

    // The ids of every sprite placed in this level (any layer).
    sprite_ids_in_level() {
        const ids = new Set();
        for (const layer of this.game.data.levels[this.level_index]?.layers ?? [])
            for (const placed of layer.sprites ?? []) {
                const si = this.game.sprite_index_for_ref(placed[0]);
                if (si !== null) ids.add(this.game.data.sprites[si].id);
            }
        return ids;
    }
}

// When an edit in the level editor may just have been completed, the level
// is compared with its last version (LevelEditor.history_observe). Typing in
// a field is one step once it pauses; pressing a mouse button or a key first
// takes what was typed, so it does not merge with the next edit.
(function install_level_history_listeners() {
    if (typeof document === 'undefined') return;
    const TYPING_PAUSE_MS = 600;
    let timer = null;
    const editor = () => (typeof current_pane !== 'undefined' && current_pane === 'level') ?
        window.game?.level_editor ?? null : null;
    const is_field = (target) => !!target?.closest?.('input, textarea, select, [contenteditable]');
    const observe_now = () => {
        clearTimeout(timer);
        timer = null;
        editor()?.history_observe();
    };
    const observe_soon = (delay) => {
        clearTimeout(timer);
        timer = setTimeout(observe_now, delay);
    };
    const flush = () => { if (timer !== null) observe_now(); };
    document.addEventListener('mousedown', flush, true);
    document.addEventListener('touchstart', flush, true);
    // typing goes on in the same field: only other keys end the pause
    document.addEventListener('keydown', (e) => { if (!is_field(e.target)) flush(); }, true);
    document.addEventListener('mouseup', () => observe_soon(0), true);
    document.addEventListener('touchend', () => observe_soon(0), true);
    document.addEventListener('keyup', (e) => observe_soon(is_field(e.target) ? TYPING_PAUSE_MS : 0), true);
    document.addEventListener('input', () => observe_soon(TYPING_PAUSE_MS), true);
    document.addEventListener('change', (e) => observe_soon(is_field(e.target) ? TYPING_PAUSE_MS : 0), true);

    // The selection: Strg+C / Strg+X / Strg+V / Strg+D, arrow keys (one grid
    // step, with Shift one pixel), Esc. By the printed letter, like Strg+Z.
    window.addEventListener('keydown', (e) => {
        const level_editor = editor();
        // a dialog in front has the keys (Esc closes it: modaldialogs.js)
        if (!level_editor || e.altKey || is_field(e.target) || $('.modal-dialogs:visible > .modal:visible').length) return;
        const ctrl = e.ctrlKey || e.metaKey;
        const key = (e.key ?? '').toLowerCase();
        const selecting = menus.level.active_key === 'tool/select' && level_editor.selection.length > 0;
        let handled = true;
        if (ctrl && key === 'c') handled = level_editor.copy_selection();
        else if (ctrl && key === 'x') level_editor.cut_selection();
        else if (ctrl && key === 'v') level_editor.paste_clipboard();
        else if (ctrl && key === 'd') level_editor.duplicate_selection();
        // X (by its place on the keyboard, like the tools): the pen erases / places
        else if (!ctrl && !e.shiftKey && e.code === 'KeyX' && !e.repeat) level_editor.set_pen_erasing(!(level_editor.pen_erasing && menus.level.active_key === 'tool/pen'));
        else if (!ctrl && selecting && e.key.startsWith('Arrow')) {
            const [ax, ay] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key] ?? [0, 0];
            // with Shift one pixel; else to the next grid position (a whole
            // step on the grid, less when the selection is off it)
            const [dx, dy] = e.shiftKey ? [ax, ay] : grid_step_delta(level_editor.current_sprite_layer()?.sprites ?? [],
                level_editor.selection, ax, ay, level_editor.selection_grid());
            level_editor.nudge_selection(dx, dy);
        } else if (!ctrl && selecting && e.key === 'Escape') level_editor.clear_selection();
        else handled = false;
        if (!handled) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

    // Leertaste held: drag the view with any tool (handle_down), like the
    // middle mouse button. Swallowed, so it neither scrolls nor presses a button.
    window.addEventListener('keydown', (e) => {
        const level_editor = editor();
        if (!level_editor || e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || is_field(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        if (!e.repeat) level_editor.set_space_pan(true);
    }, true);
    const end_space_pan = () => { if (window.game?.level_editor?.space_pan) window.game.level_editor.set_space_pan(false); };
    window.addEventListener('keyup', (e) => { if (e.code === 'Space') end_space_pan(); }, true);
    window.addEventListener('blur', end_space_pan);

    // Strg+Z / Strg+Y (or Strg+Umschalt+Z) by the printed letter: on a German
    // keyboard Z and Y swap places, so the key's position (e.code) would be wrong.
    window.addEventListener('keydown', (e) => {
        const level_editor = editor();
        if (!level_editor || !(e.ctrlKey || e.metaKey) || e.altKey || is_field(e.target)) return;
        const key = (e.key ?? '').toLowerCase();
        if (key !== 'z' && key !== 'y') return;
        e.preventDefault();
        e.stopPropagation();
        if (key === 'z' && !e.shiftKey) level_editor.undo();
        else level_editor.redo();
    }, true);
})();

// "Level animieren": the frame offset of a placed copy, like app.js gives
// it (Phase x / y: a wave across the level; Phase Zufall: every copy on its
// own). The game takes Math.random() for Zufall; the preview takes a number
// from the position instead, so a copy does not jump while you look at it.
function sprite_frame_offset(properties, sprite, x, y) {
    const fx = Number(properties?.phase_x) || 0;
    const fy = Number(properties?.phase_y) || 0;
    const fr = Number(properties?.phase_r) || 0;
    const random = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    return Math.floor((x / (sprite?.width || 1)) * fx + (y / (sprite?.height || 1)) * fy + random * 1024 * fr);
}

// Colours of the Codes in the level editor's connections (Sweetie 16, bright).
const SIGNAL_LINK_COLORS = ['#ffcd75', '#73eff7', '#a7f070', '#ef7d57', '#41a6f6', '#f4f4f4', '#38b764', '#b13e53'];
function signal_link_color(code) {
    const n = Number.isInteger(code) ? code : 0;
    return SIGNAL_LINK_COLORS[((n % SIGNAL_LINK_COLORS.length) + SIGNAL_LINK_COLORS.length) % SIGNAL_LINK_COLORS.length];
}

// ------------------------------------------------------ the Code field
// "Code" of a key, door, Schalter, Druckplatte, enemy, sign, layer, Bereich
// or a level setting: a field you can type a number into (the recipes say
// "trag als Code 4 ein"), and next to it a button with the Code's name that
// opens the level's signals: every Code of this level (with its name),
// "Neues Signal …" (a free Code, then its name), "Namen geben …" and
// "Kein Signal". An emptied field also means "Kein Signal" (data.clear: what
// that is for this object – a null Code, or switching its signal off); without
// data.clear an empty field goes back to the Code it had.
// data: { editor, container, label, hint, get, set, clear?, max }.
// A Hinweistext placed from now on speaks itself ("Wer spricht: das Sprite
// spricht selbst"): its sentences stay above it, and it shows "spricht gerade"
// if drawn. Stored on the copy, so copies placed before – which have no
// "Wer spricht" and are read out by the figure – stay exactly as they are.
// A copy that already says who speaks (replaced by another sign) keeps it.
function give_new_signs_their_voice(placed_list, traits_of) {
    for (const placed of placed_list ?? []) {
        if (!placed || !('text' in (traits_of(placed[0]) ?? {}))) continue;
        if (!placed[3] || typeof placed[3] !== 'object') placed[3] = {};
        const props = placed[3].text ??= {};
        props.speaker ??= 'self';
    }
}

class SignalCodeWidget {
    constructor(data) {
        this.data = data;
        this.editor = data.editor;
        const div = $('<div class="item">').data('widget-instance', this);
        $('<div style="margin-right: 1em;">').text(data.label ?? 'Code').appendTo(div);
        this.row = $('<div class="signal-code-row">').css({ display: 'flex', 'align-items': 'center' }).appendTo(div);
        // sized inline like NumberWidget's fields (panel rules for text inputs would stretch it)
        this.input = $('<input type="text" class="signal-code-input" inputmode="numeric">')
            .css({ width: '2.5em', flex: '0 0 auto', 'text-align': 'center' })
            .attr('placeholder', '–').appendTo(this.row);
        // a number takes effect while typing; an empty field only once it is left (or Enter)
        this.input.on('input', () => {
            const value = this.parse();
            if (value !== null && value !== 'empty' && value !== this.code()) this.apply(value);
        });
        this.input.on('change blur', () => this.commit());
        this.input.on('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.commit(); this.input.trigger('blur'); }
        });
        this.input.on('focus', () => this.input.trigger('select'));
        this.button = $('<button type="button" class="dropdown-button signal-code-pick">')
            .attr('title', 'Signale in diesem Level: einen auswählen, ein neues anlegen, einen Namen geben oder das Signal entfernen')
            .append($('<span class="dropdown-text">'))
            .append($('<i class="fa fa-angle-down dropdown-arrow">'))
            .on('mousedown', (e) => { if (this.button.hasClass('open')) e.stopPropagation(); })
            .on('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if ($('.context-menu').length && this.button.hasClass('open')) { close_context_menu(); return; }
                this.open_menu();
            })
            .appendTo(this.row);
        // so that a rename elsewhere (overview, another field) reaches this button
        this.button.data('signal-code-widget', this);
        $(data.container).append(div);
        install_hint_handler(div, data);
        this.refresh();
    }

    // What is typed: a Code (0 … max), 'empty', or null (not a number).
    parse() {
        const text = String(this.input.val() ?? '').trim();
        if (text === '') return 'empty';
        if (!/^\d+$/.test(text)) return null;
        return Math.min(Number(text), this.data.max ?? 1000);
    }

    commit() {
        // clearing may rebuild the panel this field is in; its blur must not commit again
        if (this.committing || !document.body.contains(this.input[0])) return;
        this.committing = true;
        try { this.commit_now(); } finally { this.committing = false; }
    }

    commit_now() {
        const value = this.parse();
        if (value === 'empty' && this.code() !== null) {
            if (this.data.clear) this.clear();
        } else if (value !== null && value !== 'empty' && value !== this.code()) {
            this.apply(value);
        }
        this.refresh();
    }

    apply(code) {
        this.data.set(code);
        this.refresh_button();
    }

    clear() {
        if (!this.data.clear) return;
        this.data.clear();
        this.refresh();
    }

    level() {
        return this.editor.game.data.levels[this.editor.level_index];
    }

    // the current Code, or null for "kein Signal"
    code() {
        const value = this.data.get();
        if (value === null || value === undefined) return value === null ? null : 0;
        const number = Number(value);
        return Number.isInteger(number) ? number : 0;
    }

    refresh() {
        const code = this.code();
        if (!this.input.is(':focus') || this.parse() !== code) this.input.val(code === null ? '' : String(code));
        this.refresh_button();
    }

    refresh_button() {
        const code = this.code();
        const name = code === null ? '' : signal_name(this.level(), code);
        this.button.find('.dropdown-text').text(code === null ? 'kein Signal' : name || 'ohne Namen');
        this.button.toggleClass('signal-code-unnamed', !name);
        this.button.css('--signal-color', signal_link_color(code));
    }

    // every Code of the level, small first; the current one even if nothing
    // else has it. 0 only where something uses it (keys and doors of older
    // games meet there), so a Schalter is not put on it by accident.
    codes() {
        const level = this.level();
        const codes = signal_codes_in_level(level);
        const { traits_of } = this.editor.signal_context();
        const zero = signal_partners(level, 0, traits_of);
        if (!Object.keys(zero.counts).length && !zero.layers.length && !zero.areas.length && !zero.all_defeated)
            codes.delete(0);
        if (this.code() !== null) codes.add(this.code());
        return [...codes].sort((a, b) => a - b);
    }

    may_edit() {
        if (window.collaboration?.can_edit_current?.() !== false) return true;
        this.editor.show_level_notice('Gerade bearbeitet jemand anderes dieses Level.');
        return false;
    }

    open_menu() {
        const level = this.level();
        const current = this.code();
        const { traits_of } = this.editor.signal_context();
        const entries = this.codes().map(code => {
            const name = signal_name(level, code);
            return {
                label: name ? `${name} · ${code}` : `Code ${code}`,
                icon: code === current ? 'fa-check' : '',
                hint: describe_signal_partners(code, signal_partners(level, code, traits_of), name),
                callback: () => { if (code !== current && this.may_edit()) this.choose(code); },
            };
        });
        entries.push('-');
        entries.push({ label: 'Neues Signal …', icon: 'fa-plus',
            hint: 'Ein Code, den in diesem Level noch nichts hat – danach kannst du ihm einen Namen geben.',
            callback: () => {
                if (!this.may_edit()) return;
                this.choose(free_signal_code(level));
                this.edit_name();
            } });
        if (current !== null) {
            const name = signal_name(level, current);
            entries.push({ label: name ? `»${name}« umbenennen …` : 'Namen geben …', icon: 'fa-pencil',
                hint: 'Der Name gilt für alles mit diesem Code in diesem Level.',
                callback: () => { if (this.may_edit()) this.edit_name(); } });
        }
        if (this.data.clear) {
            entries.push({ label: 'Kein Signal', icon: current === null ? 'fa-check' : 'fa-ban',
                hint: 'Dieses Objekt sendet nichts und reagiert auf nichts mehr. Du kannst auch einfach die Zahl löschen.',
                callback: () => { if (current !== null && this.may_edit()) this.clear(); } });
        }
        const rect = this.button[0].getBoundingClientRect();
        show_context_menu(rect.left, rect.bottom + 2, entries, { min_width: rect.width, dropdown: true });
        this.button.addClass('open');
        $('.context-menu').first().on('remove-menu', () => this.button.removeClass('open'));
    }

    choose(code) {
        this.data.set(code);
        this.refresh();
    }

    // The button becomes a field for the name of the current Code. Enter or
    // leaving it saves, Esc keeps the old name (rename_signal_code).
    edit_name() {
        const code = this.code();
        const input = $('<input type="text" class="signal-code-name-input">')
            .attr({ maxlength: SIGNAL_NAME_MAX_LENGTH, placeholder: 'Name, z. B. Brücke', spellcheck: 'false' })
            .val(signal_name(this.level(), code)).css('--signal-color', signal_link_color(code));
        this.button.hide().after(input);
        let finished = false;
        const finish = (save) => {
            if (finished) return true;
            if (save && !this.editor.rename_signal_code(code, input.val())) return false;
            finished = true;
            input.remove();
            this.button.show();
            this.refresh_button();
            return true;
        };
        input.on('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        // a name that is taken: keep the old one (the notice says why)
        input.on('blur', () => { if (!finish(true)) finish(false); });
        input.trigger('focus').trigger('select');
    }
}

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
        console.log(`apply_layer`, layer, this.layer_index);
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
        this.condition_index = 0;
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
        // live preview of effect backdrops (snow, rain, dust, …)
        this.animate_backdrops = false;
        this.backdrop_time_meshes = [];
        this.backdrop_animation_frame = null;
        this.camera_mode = false;
        // Signale: connections (build_signal_links)
        this.signal_links_group = new THREE.Group();
        this.signal_link_curves = [];
        this.signal_link_frames = [];
        this.show_signal_links = false;
        this.connect_from = null;
        this.connect_pointer = null;
        this.signal_highlight = null;

        this.texture_loader = new THREE.TextureLoader();
        this.refresh_sprite_widget();

        $('#tool_menu_level_settings').empty();
        new CheckboxWidget({
            container: $('#tool_menu_level_settings'),
            label: 'Gitter anzeigen',
            get: () => self.show_grid,
            set: (x) => {
                self.show_grid = x;
                self.refresh();
                self.render();
            },
        });
        new CheckboxWidget({
            container: $('#tool_menu_level_settings'),
            label: 'Verbindungen zeigen',
            hint: 'Zeigt alle Signale im Level: Von allem, was sendet (Schalter, Schlüssel, Druckplatte, Bereich, Gegner), laufen Striche zu allem, was mit demselben Code reagiert (Türen, Ebenen). Sonst siehst du nur die Verbindungen von dem, was du gerade ausgewählt hast.',
            get: () => self.show_signal_links,
            set: (x) => {
                self.show_signal_links = x;
                self.build_signal_links();
                self.render();
            },
        });
        new CheckboxWidget({
            container: $('#tool_menu_level_settings'),
            label: 'Effekte bewegen',
            hint: 'Schnee, Regen, Schwebestaub und die anderen Effekte bewegen sich schon hier im Level-Editor – so wie später im Spiel.',
            get: () => self.animate_backdrops,
            set: (x) => {
                self.animate_backdrops = x;
                if (x) self.start_backdrop_animation();
                else {
                    self.set_backdrop_time(0);
                    self.render();
                }
            },
        });
        this.grid_size_widget = new NumberWidget({
            count: 2,
            container: $('#tool_menu_level_settings'),
            connector: $('<span>').css('width', '0.8em').css('text-align', 'center').html('&times;'),
            label: 'Gittergröße:',
            width: '1.8em',
            min: [1, 1],
            max: [512, 512],
            get: () => [self.grid_width, self.grid_height],
            set: (width, height) => {
                self.grid_width = width;
                self.grid_height = height;
                self.refresh();
                self.render();
            },
        });
        this.grid_offset_widget = new NumberWidget({
            count: 2,
            container: $('#tool_menu_level_settings'),
            connector: $('<span>').css('width', '0.8em').css('text-align', 'center').html(':'),
            label: 'Gitteroffset:',
            width: '1.8em',
            min: [-1024, -1024],
            max: [1024, 1024],
            get: () => [self.grid_x, self.grid_y],
            set: (x, y) => {
                self.grid_x = x;
                self.grid_y = y;
                self.refresh();
                self.render();
            },
        });

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

        new DragAndDropWidget({
            game: self.game,
            container: $('#menu_levels'),
            trash: $('#trash'),
            items: self.game.data.levels,
            item_class: 'menu_level_item',
            step_aside_css: { top: '35px' },
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
                self.condition_index = 0;
                self.rect_index = 0;
                self.auto_adjust_camera = true;

                self.layer_structs = [];
                for (let layer of self.game.data.levels[self.level_index].layers) {
                    let layer_struct = new LayerStruct(self);
                    layer_struct.apply_layer(layer);
                    self.layer_structs.push(layer_struct);
                }

                $('#menu_level_properties').empty();
                new LineEditWidget({
                    container: $('#menu_level_properties'),
                    label: 'Titel',
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

                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_layers'),
                    trash: $('#trash'),
                    items: self.game.data.levels[self.level_index].layers,
                    item_class: 'menu_layer_item',
                    step_aside_css: { top: '35px' },
                    gen_new_item_options: [
                        ['Sprites', 'sprites'],
                        ['Hintergrund', 'backdrop'],
                        ['Bereich (sendet ein Signal)', 'signal_area'],
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
                        if (type === 'sprites') {
                            let sprite_count = $(`<span>`).text(`${layer.sprites.length}`);
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Sprites (')).append(sprite_count).append($('<span>').text(') · ')));
                            self.layer_structs[index].el_sprite_count = sprite_count;
                        } else if (type === 'backdrop') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Hintergrund · '));
                        } else if (type === 'signal_area') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Bereich · '));
                        } else if (type === 'movement_region') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Bewegungsbereich · '));
                        } else if (type === 'text') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('Text · '));
                        }
                        layer_div.append($('<span class="layer-name">').text(layer.properties.name || `Ebene ${index + 1}`));
                        return layer_div;
                    },
                    onclick: (e, index) => {
                        self.history_observe();
                        self.clear_selection();
                        self.layer_index = index;
                        self.rect_index = 0;
                        self.backdrop_controls_setup_for = null;
                        if (self.game.data.levels[self.level_index].layers[self.layer_index].type !== 'sprites') {
                            menus.level.blur();
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
                        let layer_struct = new LayerStruct(self);
                        self.layer_structs.push(layer_struct);
                        let layer = { type: type };
                        if (type === 'signal_area') {
                            const level = self.game.data.levels[self.level_index];
                            let count = level.layers.filter(x => x.type === type).length + 1;
                            // a Code nothing else uses yet, so it does not start anything by itself
                            layer.properties = { name: `Bereich ${count}`, signal_code: free_signal_code(level) };
                        }
                        if (type === 'movement_region') {
                            let count = self.game.data.levels[self.level_index].layers.filter(x => x.type === type).length + 1;
                            layer.properties = { name: `Bewegungsbereich ${count}` };
                            layer.movement = { mode: 'swim' };
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
                        self.game.data.levels[self.level_index].layers.push(layer);
                        self.game.fix_game_data();
                        self.refresh();
                        self.render();
                        return self.game.data.levels[self.level_index].layers[self.game.data.levels[self.level_index].layers.length - 1];
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

                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_conditions'),
                    trash: $('#trash'),
                    items: self.game.data.levels[self.level_index].conditions,
                    item_class: 'menu_layer_item',
                    step_aside_css: { top: '35px' },
                    gen_new_item_options: [
                        ['Levelwechsel erreicht', 'touching_level_complete'],
                        ['Punkte gesammelt (noch ohne Wirkung)', 'min_points'],
                        ['Sprite eingesammelt (noch ohne Wirkung)', 'need_sprite'],
                        ['Gegner getötet (noch ohne Wirkung)', 'killed_baddie'],
                    ],
                    gen_item: (layer, index) => {
                        let type = layer.type;
                        let condition_div = $(`<div>`).css('padding-top', '4px');
                        if (type === 'touching_level_complete') {
                            condition_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Levelwechsel erreicht')));
                        } else if (type === 'min_points') {
                            condition_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Punkte gesammelt')));
                        } else if (type === 'need_sprite') {
                            condition_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Sprite eingesammelt')));
                        } else if (type === 'killed_baddie') {
                            condition_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Gegner getötet')));
                        }
                        if (type !== 'touching_level_complete') {
                            condition_div.append($('<span>')
                                .css({ 'margin-left': '0.4em', color: '#d8b34d' })
                                .attr('title', 'Diese Bedingung wird im Spiel noch nicht geprüft.')
                                .text('ⓘ'));
                        }
                        return condition_div;
                    },
                    hint_with_heading_for_item: (item) => {
                        if (item.type === 'touching_level_complete')
                            return ["Levelwechsel erreicht", "Berührt die Spielfigur ein Sprite mit der Eigenschaft »Levelwechsel«, wechselt das Spiel direkt zum nächsten Level. Dieser Listeneintrag wird dabei nicht eigens geprüft."];
                        if (item.type === 'min_points')
                            return ["Punkte gesammelt", "Noch ohne Wirkung im Spiel: Der eingestellte Mindestanteil wird gespeichert, beim Levelwechsel aber nicht geprüft."];
                        if (item.type === 'need_sprite')
                            return ["Sprite eingesammelt", "Noch ohne Wirkung im Spiel: Das Einsammeln eines bestimmten Sprites wird beim Levelwechsel nicht geprüft."];
                        if (item.type === 'killed_baddie')
                            return ["Gegner getötet", "Noch ohne Wirkung im Spiel: Das Besiegen eines Gegners wird beim Levelwechsel nicht geprüft."];
                    },
                    onclick: (e, index) => {
                        self.clear_selection();
                        self.condition_index = index;
                        self.setup_condition_properties();
                        $('#menu_conditions_properties_container').show();
                        self.refresh();
                        self.render();
                    },
                    gen_new_item: (type) => {
                        // let layer_struct = new LayerStruct(self);
                        // self.layer_structs.push(layer_struct);
                        let condition = { type: type };
                        // if (type === 'sprites') {
                        //     layer.sprites = [];
                        // } else if (type === 'backdrop') {
                        //     let x0 = Math.round(self.camera_x - self.width * 0.45 / self.scale);
                        //     let x1 = Math.round(self.camera_x + self.width * 0.45 / self.scale);
                        //     let y0 = Math.round(self.camera_y - self.height * 0.45 / self.scale);
                        //     let y1 = Math.round(self.camera_y + self.height * 0.45 / self.scale);
                        //     let rect = { left: x0, bottom: y0, width: x1 - x0, height: y1 - y0 };
                        //     layer.rects = [rect];
                        // }
                        self.game.data.levels[self.level_index].conditions.push(condition);
                        self.game.fix_game_data();
                        self.refresh();
                        self.render();
                        return self.game.data.levels[self.level_index].conditions[self.game.data.levels[self.level_index].conditions.length - 1];
                    },
                    delete_item: (index) => {
                        self.game.data.levels[self.level_index].conditions.splice(index, 1);
                        self.condition_index = 0;
                        self.refresh();
                        // self.render();
                    },
                    on_move_item: (from, to) => {
                        move_item_helper(self.game.data.levels[self.level_index].conditions, from, to);
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
                return self.game.data.levels[self.game.data.levels.length - 1];
            },
            can_delete_index: (index) => window.collaboration?.can_delete?.('level', self.game.data.levels[index]?.id) ?? true,
            delete_item: (index) => {
                const [deleted] = self.game.data.levels.splice(index, 1);
                self.label_for_level.splice(index, 1);
                self.level_index = 0;
                window.collaboration?.structure_changed?.('level', 'delete', deleted?.id);
            },
            on_move_item: (from, to) => {
                move_item_helper(self.game.data.levels, from, to);
                move_item_helper(self.label_for_level, from, to);
                window.collaboration?.structure_changed?.('level', 'move', self.game.data.levels[to]?.id);
            }
        });

        this.update_level_label();
        this.refresh();
        menus.level.handle_click('tool/pan');
        this.refresh();
        this.render();

        $(this.element).off();

        $(this.element).on('contextmenu', function (e) {
            return false;
        });
        $(this.element).on('mouseenter', (e) => self.handle_enter(e));
        $(this.element).on('mouseleave', (e) => self.handle_leave(e));
        $(this.element).on('mousedown touchstart', (e) => self.handle_down(e));
        $(window).on('mouseup touchend', (e) => self.handle_up(e));
        $(window).on('mousemove touchmove', (e) => self.handle_move(e));
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

    step_history(direction) {
        const level = this.current_history_level();
        const history = this.game.level_history;
        // not in the middle of a drag, and not while somebody else edits this level
        if (!level?.id || !history || this.mouse_down) return;
        if (window.collaboration?.can_edit_current?.() === false) return;
        const serialized = history[direction](level.id, JSON.stringify(level));
        if (serialized !== null) {
            this.game.data.levels[this.level_index] = JSON.parse(serialized);
            this.reload_level_keeping_view(this.level_index);
        }
        this.update_history_buttons();
    }

    update_history_buttons() {
        if (typeof $ === 'undefined') return;
        const id = this.current_history_level()?.id;
        const history = this.game.level_history;
        $('#status-bar .level-history-undo').toggleClass('disabled', !history?.can_undo(id));
        $('#status-bar .level-history-redo').toggleClass('disabled', !history?.can_redo(id));
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

    // ------------------------------------------------ working with a selection
    // level_selection.js does the work on the data; here: showing it, the
    // mouse and the keys. The clipboard lives as long as the studio page, so
    // sprites can be copied from one level or layer to another.
    current_sprite_layer() {
        const layer = this.game.data.levels[this.level_index]?.layers[this.layer_index];
        return layer?.type === 'sprites' ? layer : null;
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

    nudge_selection(dx, dy) {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length || this.read_only_level()) return;
        const moved = move_placed(layer.sprites, this.selection, dx, dy);
        this.set_layer_sprites(this.layer_index, moved.sprites, moved.selection);
    }

    copy_selection() {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length) return false;
        window.level_clipboard = copy_placed(layer.sprites, this.selection);
        this.show_level_notice?.(`${this.selection.length === 1 ? '1 Sprite' : `${this.selection.length} Sprites`} kopiert – mit Strg+V einfügen.`);
        return true;
    }

    cut_selection() {
        if (this.read_only_level() || !this.copy_selection()) return;
        this.delete_selection();
    }

    // At the mouse (its lower left corner on the grid cell under the
    // pointer), or one grid step beside the original when the mouse is elsewhere.
    paste_clipboard() {
        const clipboard = window.level_clipboard;
        const layer = this.current_sprite_layer();
        if (!clipboard || !layer || this.read_only_level()) return;
        let x = clipboard.x + this.grid_width, y = clipboard.y;
        if (this.pointer_inside && this.pointer_world_raw)
            [x, y] = this.ui_to_world(this.pointer_world_raw, true);
        if (menus.level.active_key !== 'tool/select') menus.level.handle_click('tool/select');
        const pasted = paste_placed(layer.sprites, clipboard, x, y);
        this.set_layer_sprites(this.layer_index, pasted.sprites, pasted.selection);
    }

    duplicate_selection() {
        const layer = this.current_sprite_layer();
        if (!layer || !this.selection.length || this.read_only_level()) return;
        const clipboard = copy_placed(layer.sprites, this.selection);
        const pasted = paste_placed(layer.sprites, clipboard, clipboard.x + this.grid_width, clipboard.y);
        this.set_layer_sprites(this.layer_index, pasted.sprites, pasted.selection);
    }

    move_selection_to_layer(target) {
        const level = this.game.data.levels[this.level_index];
        const from = this.current_sprite_layer();
        const to = level.layers[target];
        if (!from || to?.type !== 'sprites' || target === this.layer_index || !this.selection.length || this.read_only_level()) return;
        const moved = move_placed_to_layer(from.sprites, this.selection, to.sprites);
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

    fill_rectangle(x0, y0, x1, y1) {
        const layer = this.current_sprite_layer();
        const sprite = this.game.data.sprites[this.sprite_index];
        if (!layer || !sprite || layer.properties.visible === false || this.read_only_level()) return;
        const filled = fill_placed(layer.sprites, sprite.id, x0, y0, x1, y1,
            { width: this.grid_width, height: this.grid_height });
        // new Schalter and Druckplatten: each its own free Code (signals.js)
        give_new_senders_codes(this.game.data.levels[this.level_index],
            filled.selection.map(i => filled.sprites[i]), () => sprite.traits);
        this.set_layer_sprites(this.layer_index, filled.sprites, []);
    }

    read_only_level() {
        return window.collaboration?.can_edit_current?.() === false;
    }

    // The box above the placed properties: how many are selected, and what
    // can be done with them.
    add_selection_controls(container) {
        const count = this.selection.length;
        const box = $('<div class="selection-box">').appendTo(container);
        $('<div class="selection-count">').text(count === 1 ? '1 Sprite ausgewählt' : `${count} Sprites ausgewählt`).appendTo(box);
        const buttons = $('<div class="selection-buttons">').appendTo(box);
        const button = (label, title, action) => $('<button type="button">').text(label).attr('title', title)
            .on('click', (e) => { e.preventDefault(); action(); }).appendTo(buttons);
        button('Kopieren', 'Strg+C – einfügen mit Strg+V, auch in einem anderen Level', () => this.copy_selection());
        button('Duplizieren', 'Strg+D – eine Kopie gleich daneben', () => this.duplicate_selection());
        button('Löschen', 'Entf', () => this.delete_selection());
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
    start_playtest() {
        const options = { level_index: this.level_index, start: null };
        if (this.pointer_inside && this.pointer_world_raw) {
            const [x, y] = this.ui_to_world(this.pointer_world_raw, true);
            options.start = { x, y };
        }
        window.studio_start_playtest?.(options);
    }

    // ---------------------------------------------- Signale: connections
    // Animated dashes run from what sends to what reacts (signals.js), and
    // both get a pulsing frame. Shown for what is selected (a placed sprite,
    // the current layer, what "Verbinden" started from, a connection just
    // made), or for everything with "Verbindungen zeigen".
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
        if (this.show_signal_links) return null;
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
        for (const link of signal_links(objects, codes))
            this.signal_link_curves.push({ from: link.from.anchor, to: link.to.anchor, color: signal_link_color(link.code) });
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
                const code = connect_signal_objects(level, this.connect_from, picked, traits_of, size_of);
                if (code !== null) this.signal_highlight = { code, until: performance.now() + 2500 };
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
    show_level_notice(text) {
        let notice = $(this.element).find('.level-notice');
        if (!notice.length) notice = $('<div class="level-notice">').appendTo(this.element);
        notice.text(text).addClass('showing');
        clearTimeout(this.level_notice_timer);
        this.level_notice_timer = setTimeout(() => notice.removeClass('showing'), 4500);
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
        const role = key === 'drop_code' ? SIGNAL_LOOT_ROLE : SIGNAL_SPRITE_ROLES.find(role => role.trait === trait);
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
                line.text(found ? describe_signal_partners(found.code, signal_partners(level, found.code, traits_of)) : '');
            }
            this.build_signal_links();
            this.render();
        };
        this.update_signal_links();
    }

    // Signale (signals.js): a layer can appear or disappear when something
    // sends its Code. Absent = it does not react.
    add_layer_signal_controls(layer) {
        const container = $('#menu_layer_properties');
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        const update_links = () => {
            links.text(layer_reacts_to_signals(layer.properties) ?
                describe_signal_partners(layer.properties.signal_code ?? 0, signal_partners(level,
                    layer.properties.signal_code ?? 0,
                    ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits)) : '');
            this.build_signal_links();
            this.render();
        };
        let details = null;
        new SelectWidget({
            container,
            label: 'Bei Signal',
            hint: 'Die Ebene kann erscheinen oder verschwinden, wenn etwas mit ihrem Code ein Signal sendet: ein Schlüssel, ein Schalter, eine Druckplatte, ein Bereich oder ein besiegter Gegner. „erscheint“: am Anfang weg, beim ersten Signal „an“ da. „verschwindet“: am Anfang da, beim ersten Signal „an“ weg. „da, solange an“ und „weg, solange an“: folgt dem Signal – praktisch mit einer Druckplatte oder einem Bereich (ein Dach, das verschwindet, solange man im Haus ist). „wechselt“: jedes Signal macht die Ebene da oder weg. Eine Ebene, die weg ist, wird nicht gezeichnet, man kann nicht auf ihr stehen, und Gegner auf ihr warten, bis sie erscheint – so baust du Brücken, Wände, die verschwinden, oder einen Hinterhalt. Die Spielfigur gehört nicht auf so eine Ebene.',
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
        new NumberWidget({
            container: details,
            label: 'Code',
            hint: 'Alles mit demselben Code sendet dieser Ebene ein Signal.',
            min: 0,
            max: 1000,
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
        const update = () => {
            const code = level.properties.signal_all_defeated;
            details?.toggle(Number.isInteger(code));
            links.text(Number.isInteger(code) ? describe_signal_partners(code, signal_partners(level, code,
                ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits)) : '');
        };
        new CheckboxWidget({
            container: box,
            label: 'sendet, wenn alle Gegner besiegt',
            hint: 'Sind alle Gegner in diesem Level besiegt, sendet das Level einen Code – zum Beispiel öffnet sich dann das Tor zum Ziel. Gegner auf einer Ebene, die noch nicht erschienen ist, zählen erst mit, wenn sie da sind: So kann die nächste Welle erscheinen, sobald die erste besiegt ist.',
            get: () => Number.isInteger(level.properties.signal_all_defeated),
            set: (on) => {
                if (on) level.properties.signal_all_defeated = free_signal_code(level);
                else {
                    delete level.properties.signal_all_defeated;
                    delete level.properties.signal_all_defeated_delay;
                    delay_widget?.refresh();
                }
                details?.find('input').first().val(level.properties.signal_all_defeated ?? 0);
                update();
            },
        });
        details = $('<div>').appendTo(box);
        new NumberWidget({
            container: details,
            label: 'Code',
            min: 0,
            max: 1000,
            get: () => level.properties.signal_all_defeated ?? 0,
            set: (value) => {
                level.properties.signal_all_defeated = Math.round(value);
                update();
            },
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

    // A Bereich (layer type signal_area): its rectangles send the Code "an"
    // when the figure's centre enters them and "aus" when it leaves.
    add_area_signal_controls(layer) {
        const container = $('#menu_layer_properties');
        const level = this.game.data.levels[this.level_index];
        const links = $('<div class="signal-links">');
        const update_links = () => {
            const code = layer.properties.signal_code ?? 0;
            links.text(describe_signal_partners(code, signal_partners(level, code,
                ref => this.game.data.sprites[this.game.sprite_index_for_ref(ref)]?.traits)));
            this.build_signal_links();
            this.render();
        };
        new NumberWidget({
            container,
            label: 'Code',
            hint: 'Kommt die Mitte der Spielfigur in eines der Rechtecke, sendet der Bereich diesen Code mit „an“, geht sie wieder hinaus, mit „aus“. Ebenen und Türen mit demselben Code reagieren darauf – zum Beispiel verschwindet das Dach, solange man im Haus ist („weg, solange an“).',
            min: 0,
            max: 1000,
            get: () => layer.properties.signal_code ?? 0,
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

        new LineEditWidget({
            container: $('#menu_layer_properties'),
            label: 'Name',
            hint: 'Gib jeder Ebene einen erkennbaren Namen, zum Beispiel »Haus 1 – Fassade«.',
            get: () => layer.properties.name,
            set: (name) => {
                layer.properties.name = name;
                $('#menu_layers').children('._dnd_item').eq(self.layer_index)
                    .find('.layer-name').text(name || `Ebene ${self.layer_index + 1}`);
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
            
            new DragAndDropWidget({
                game: self.game,
                container: rect_div,
                trash: $('#trash'),
                items: self.game.data.levels[self.level_index].layers[self.layer_index].rects,
                item_class: 'menu_layer_item',
                step_aside_css: { top: '35px' },
                gen_item: (layer, index) => {
                    let rect_div = $(`<div>`).css('padding-top', '5px');
                    rect_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Rechteck')));
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
                    console.log(JSON.stringify(self.game.data.levels[self.level_index].layers[self.layer_index].rects));
                    self.game.data.levels[self.level_index].layers[self.layer_index].rects.push(rect);
                    console.log(JSON.stringify(self.game.data.levels[self.level_index].layers[self.layer_index].rects));
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
                        self.setup_layer_properties();
                        self.backdrop_controls_setup_for = null;
                        self.refresh();
                        self.render();
                    },
                });
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

    setup_condition_properties() {
        let self = this;
        $('#menu_conditions_properties').empty();

        let condition = self.game.data.levels[self.level_index].conditions[self.condition_index];

        if (condition.type !== 'touching_level_complete') {
            $('<div>').css({ margin: '4px 5px 8px', color: '#d8b34d', 'font-size': '0.9em' })
                .text('Noch ohne Wirkung im Spiel.')
                .appendTo($('#menu_conditions_properties'));
        }

        if (condition.type === 'min_points') {
            new NumberWidget({
                container: $('#menu_conditions_properties'),
                label: 'Mindestanteil',
                min: 0.0,
                max: 100.0,
                suffix: '%',
                get: () => self.game.data.levels[self.level_index].conditions[self.condition_index].properties.min_points_percent,
                set: (x) => {
                    self.game.data.levels[self.level_index].conditions[self.condition_index].properties.min_points_percent = x;
                    // self.update_condition_label();
                },
            });
        } else if (condition.type === 'need_sprite') {
            new SpriteWidget({
                container: $('#menu_conditions_properties'),
                label: 'Sprite',
                filter: (sprite) => {
                    return 'pickup' in sprite.traits;
                },
                get: () => self.game.data.levels[self.level_index].conditions[self.condition_index].properties.sprite_id,
                set: (x) => {
                    self.game.data.levels[self.level_index].conditions[self.condition_index].properties.sprite_id = x;
                    // self.update_layer_label();
                },
            });
        }
    }

    update_level_label(li) {
        if (typeof(li) === 'undefined') li = this.level_index;
        let label = $('<div>').text(this.game.data.levels[li].properties.name);
        if (!this.game.data.levels[li].properties.use_level) {
            label.css('text-decoration', 'line-through');
            label.css('opacity', 0.6);
        }
        label.css('white-space', 'nowrap');
        label.css('margin', '6px 5px');
        label.css('pointer-events', 'none');
        this.label_for_level[li].empty().append(label);
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

    handle_enter(e) {
        this.pointer_inside = true;
        let p = this.ui_to_world(this.get_touch_point(e), true);
        this.cursor_group_inner.remove.apply(this.cursor_group_inner, this.cursor_group_inner.children);
        if (menus.level.active_key === 'tool/pen') {
            this.sheets[this.sprite_index].add_sprite_to_group(this.cursor_group_inner, 'sprite', 0, 0);
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
        if ((e.touches || []).length === 2) {
            this.is_double_touch = true;
            this.double_touch_points = [
                [e.touches[0].clientX, e.touches[0].clientY],
                [e.touches[1].clientX, e.touches[1].clientY]
            ];
        } else {
            this.is_double_touch = false;
        }
        this.updating_selection = false;
        this.mouse_down = true;
        this.mouse_down_button = e.button;
        let touch = this.get_touch_point(e);
        this.mouse_down_position = this.ui_to_world(touch, true);
        this.mouse_down_position_no_snap = this.ui_to_world(touch, false);
        this.mouse_down_position_raw = touch;
        this.x0 = this.mouse_down_position_no_snap[0];
        this.y0 = this.mouse_down_position_no_snap[1];
        this.x1 = this.mouse_down_position_no_snap[0];
        this.y1 = this.mouse_down_position_no_snap[1];

        if (e.touches) this.mouse_down_button = 0;
        if (menus.level.active_key === 'tool/connect') {
            this.handle_connect_down(e);
        } else if (menus.level.active_key === 'tool/pen' && this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
                // Strg + ziehen: fill a rectangle with the chosen sprite
                this.filling_rectangle = true;
                this.prepare_rect_group(this.mouse_down_position[0], this.mouse_down_position[1],
                    this.mouse_down_position[0], this.mouse_down_position[1]);
                this.rect_group.visible = true;
            } else if (e.button === 0) {
                if (this.modifier_shift) {
                    this.add_sprite_to_level(this.mouse_down_position_no_snap);
                } else {
                    this.add_sprite_to_level(this.mouse_down_position);
                }
            } else if (e.button === 2) {
                if (this.modifier_shift) {
                    this.remove_sprite_from_level(this.mouse_down_position_no_snap);
                } else {
                    this.remove_sprite_from_level(this.mouse_down_position);
                }
            }
        } else if (menus.level.active_key === 'tool/pan') {
            this.old_camera_position = [this.camera_x, this.camera_y];
        } else if (menus.level.active_key === 'tool/select' && this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            const [px, py] = this.mouse_down_position_no_snap;
            if (e.button === 0 && !e.shiftKey && this.selection.length && this.selection_point_inside(px, py)) {
                // on the selection: drag it
                this.moving_selection = { dx: 0, dy: 0 };
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
        this.mouse_down = false;
        this.backdrop_move_point = null;
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
        if (this.filling_rectangle) {
            this.filling_rectangle = false;
            const p = this.ui_to_world(this.get_touch_point(e), true);
            this.fill_rectangle(this.mouse_down_position[0], this.mouse_down_position[1], p[0], p[1]);
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
            if (touch_distance_delta !== null) {
                if (menus.level.active_key === 'tool/pan') {
                    let tx = (this_touch_points[0][0] + this_touch_points[1][0]) * 0.5;
                    let ty = (this_touch_points[0][1] + this_touch_points[1][1]) * 0.5;
                    tx -= this.element.position().left;
                    ty -= this.element.position().top;
                    // this.zoom_at_point(-touch_distance_delta * 3, cx, cy);
                    let p = this.ui_to_world([tx, ty], false);
                    this.zoom_at_point(-touch_distance_delta * 3, p[0], p[1]);
                    if (this.backdrop_index !== null)
                        this.refresh_backdrop_controls();
                    this.refresh();
                    this.render();
                }
            }
            return;
        }
        let touch = this.get_touch_point(e);
        let p = this.ui_to_world(touch, true);
        let p_no_snap = this.ui_to_world(touch, false);
        this.pointer_world_raw = touch;
        this.pointer_world = p_no_snap;
        if (menus.level.active_key === 'tool/connect') this.handle_connect_move(e);
        if (this.moving_selection && this.mouse_down) {
            let dx = p_no_snap[0] - this.mouse_down_position_no_snap[0];
            let dy = p_no_snap[1] - this.mouse_down_position_no_snap[1];
            if (!e.shiftKey) {
                dx = Math.round(dx / this.grid_width) * this.grid_width;
                dy = Math.round(dy / this.grid_height) * this.grid_height;
            }
            if (dx !== this.moving_selection.dx || dy !== this.moving_selection.dy) {
                this.moving_selection = { dx, dy };
                this.preview_selection_move(dx, dy);
            }
            return;
        }
        if (this.filling_rectangle && this.mouse_down) {
            const [x0, y0] = this.mouse_down_position;
            const half_w = this.grid_width / 2;
            this.prepare_rect_group(Math.min(x0, p[0]) - half_w, Math.min(y0, p[1]),
                Math.max(x0, p[0]) + half_w, Math.max(y0, p[1]) + this.grid_height);
            this.rect_group.visible = true;
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
            if (this.mouse_down) {
                if (this.mouse_down_button === 0) {
                    if (this.modifier_shift) {
                        this.add_sprite_to_level(p_no_snap);
                    } else {
                        this.add_sprite_to_level(p);
                    }
                } else if (this.mouse_down_button === 2) {
                    if (this.modifier_shift) {
                        this.remove_sprite_from_level(p_no_snap);
                    } else {
                        this.remove_sprite_from_level(p);
                    }
                }
            }
        } else {
            this.cursor_group.visible = false;
        }
        if (menus.level.active_key === 'tool/pan') {
            // $(this.element).css('cursor', 'url(icons/move-hand.png) 11 4, auto');
            if (this.mouse_down && this.mouse_down_button === 0) {
                this.camera_x = this.old_camera_position[0] - (touch[0] - this.mouse_down_position_raw[0]) / this.scale;
                this.camera_y = this.old_camera_position[1] + (touch[1] - this.mouse_down_position_raw[1]) / this.scale;
                if (this.backdrop_index !== null) this.backdrop_controls_setup_for = null;
                this.refresh();
                this.render();
            }
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
                        let p = this.world_to_ui([backdrop.rects[0].left + backdrop.rects[0].width * nx, backdrop.rects[0].bottom + backdrop.rects[0].height * ny]);
                        this.backdrop_move_elements[this.backdrop_move_point].css('left', `${p[0] - 8}px`);
                        this.backdrop_move_elements[this.backdrop_move_point].css('top', `${p[1] - 8}px`);
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
                        let p = this.world_to_ui([backdrop.rects[0].left + backdrop.rects[0].width * nx, backdrop.rects[0].bottom + backdrop.rects[0].height * ny]);
                        this.backdrop_move_elements[this.backdrop_move_point].css('left', `${p[0] - 8}px`);
                        this.backdrop_move_elements[this.backdrop_move_point].css('top', `${p[1] - 8}px`);
                        this.refresh();
                        this.render();
                    } else if (this.backdrop_move_point === 'sc0' || this.backdrop_move_point === 'sc3') {
                        let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                        let rect = backdrop.rects[this.rect_index];
                        if (this.backdrop_move_point === 'sc0') {
                            let dx = p_no_snap[0] - this.mouse_down_position_no_snap[0];
                            let dy = p_no_snap[1] - this.mouse_down_position_no_snap[1];
                            let bnx = this.backdrop_move_point_old_coordinates[0] + dx;
                            let bny = this.backdrop_move_point_old_coordinates[1] + dy;
                            if (this.show_grid) {
                                let r = this.snap(bnx, bny, false);
                                bnx = r[0]; bny = r[1];
                            }
                            rect.width = this.backdrop_move_point_old_coordinates[0] + this.backdrop_move_point_old_size[0] - bnx;
                            rect.height = this.backdrop_move_point_old_coordinates[1] + this.backdrop_move_point_old_size[1] - bny;
                            rect.left = bnx;
                            rect.bottom = bny;
                            let p = this.world_to_ui([bnx, bny]);
                            this.backdrop_move_elements[this.backdrop_move_point].css('left', `${p[0] - 8}px`);
                            this.backdrop_move_elements[this.backdrop_move_point].css('top', `${p[1] - 8}px`);
                        } else {
                            let bnx = p_no_snap[0];
                            let bny = p_no_snap[1];
                            if (this.show_grid) {
                                let r = this.snap(bnx, bny, false);
                                bnx = r[0]; bny = r[1];
                            }
                            rect.width = bnx - this.backdrop_move_point_old_coordinates[0];
                            rect.height = bny - this.backdrop_move_point_old_coordinates[1];
                            let p = this.world_to_ui([bnx, bny]);
                            this.backdrop_move_elements[this.backdrop_move_point].css('left', `${p[0] - 8}px`);
                            this.backdrop_move_elements[this.backdrop_move_point].css('top', `${p[1] - 8}px`);
                        }
                        if (this.rect_index === 0) {
                            for (let ci = 0; ci < (backdrop.colors ?? []).length; ci++) {
                                if (`color_${ci}` in this.backdrop_move_elements) {
                                    let color = backdrop.colors[ci];
                                    let p = this.world_to_ui([rect.left + rect.width * color[1], rect.bottom + rect.height * color[2]]);
                                    this.backdrop_move_elements[`color_${ci}`].css('left', `${p[0] - 8}px`);
                                    this.backdrop_move_elements[`color_${ci}`].css('top', `${p[1] - 8}px`);
                                }
                            }
                            for (let cpi = 0; cpi < (backdrop.control_points ?? []).length; cpi++) {
                                if (`control_point_${cpi}` in this.backdrop_move_elements) {
                                    let control_point = backdrop.control_points[cpi];
                                    let p = this.world_to_ui([rect.left + rect.width * control_point[0], rect.bottom + rect.height * control_point[1]]);
                                    this.backdrop_move_elements[`control_point_${cpi}`].css('left', `${p[0] - 8}px`);
                                    this.backdrop_move_elements[`control_point_${cpi}`].css('top', `${p[1] - 8}px`);
                                }
                            }
                        }
                        this.refresh();
                        this.render();
                    }
                }
            }
        }
        this.render();
    }

    setModifierShift(flag) {
        this.modifier_shift = flag;
        // this.refresh();
        // this.render();
    }

    prepare_rect_group(x0, y0, x1, y1) {
        this.rect_group.remove.apply(this.rect_group, this.rect_group.children);
        let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.0, transparent: true });

        let points = [];
        points.push(new THREE.Vector3(x0, y0))
        points.push(new THREE.Vector3(x0, y1))
        points.push(new THREE.Vector3(x1, y1))
        points.push(new THREE.Vector3(x1, y0))
        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.rect_group.add(new THREE.LineLoop(geometry, material));
    }

    remove_sprite_from_level(p) {
        if (this.game.data.levels[this.level_index].layers[this.layer_index].properties.visible) {
            this.layer_structs[this.layer_index].remove_sprite(p, false);
            this.render();
        }
    }

    add_sprite_to_level(p) {
        if (this.game.data.levels[this.level_index].layers[this.layer_index].properties.visible) {
            this.layer_structs[this.layer_index].add_sprite(p, this.sprite_index, null);
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

    ui_to_world(p, snap) {
        let layer = this.game.data.levels[this.level_index].layers[this.layer_index];
        let wx = this.camera_x + (p[0] - (this.width / 2)) / this.scale - this.camera_x * layer.properties.parallax;
        let wy = this.camera_y - (p[1] - (this.height / 2)) / this.scale - this.camera_y * layer.properties.parallax;
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
            let center = aabb.getCenter();
            let size = aabb.getSize();
            console.log('auto adjusting camera!', size);
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

        this.grid_group.remove.apply(this.grid_group, this.grid_group.children);
        let opacity = 0.2;
        if (this.scale < 1.0)
            opacity *= this.scale;
        let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.0, transparent: true, opacity: opacity });

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
        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        // geometry.translate(0.5, 0.5, 0);
        let line = new THREE.LineSegments(geometry, material);
        this.grid_group.add(line);

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

    // Effect time for the preview: 0 = still (as before), else the clock.
    backdrop_time() {
        return this.animate_backdrops ? this.clock.getElapsedTime() : 0;
    }

    set_backdrop_time(t) {
        for (const entry of this.backdrop_time_meshes) {
            const time = entry.mesh.material?.uniforms?.time;
            if (time) time.value = t * entry.speed;
        }
    }

    start_backdrop_animation() {
        if (this.backdrop_animation_frame !== null) return;
        const step = () => {
            if (!this.animate_backdrops) {
                this.backdrop_animation_frame = null;
                return;
            }
            // only while the level editor is on screen and there is something to move
            if (this.backdrop_time_meshes.length && $(this.element).is(':visible')) {
                this.set_backdrop_time(this.backdrop_time());
                this.render();
            }
            this.backdrop_animation_frame = requestAnimationFrame(step);
        };
        this.backdrop_animation_frame = requestAnimationFrame(step);
    }

    refresh_blend_materials() {
        for (const layer_struct of this.layer_structs ?? []) layer_struct.refresh_materials();
    }

    refresh() {
        let self = this;
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

        for (let li = this.game.data.levels[this.level_index].layers.length - 1; li >= 0; li--) {
            if (li < this.layer_structs.length) {
                if (!this.game.data.levels[this.level_index].layers[li].properties.visible)
                    continue;
                if (this.game.data.levels[this.level_index].layers[li].type === 'sprites') {
                    this.layer_structs[li].group.position.x = this.camera_x * this.game.data.levels[this.level_index].layers[li].properties.parallax;
                    this.layer_structs[li].group.position.y = this.camera_y * this.game.data.levels[this.level_index].layers[li].properties.parallax;
                    this.scene.add(this.layer_structs[li].group);
                    if (this.layer_index === li)
                        this.scene.add(this.cursor_group);
                } else if (this.game.data.levels[this.level_index].layers[li].type === 'backdrop') {
                    let backdrop = this.game.data.levels[this.level_index].layers[li];
                    let rect0 = backdrop.rects[0];
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
                        this.scene.add(mesh);
                    }
                }
            }
        }
        if (this.show_grid)
            this.scene.add(this.grid_group);
        this.scene.add(this.selection_group);
        this.scene.add(this.rect_group);

        this.backdrop_index = null;
        if (['backdrop', 'signal_area', 'movement_region'].includes(this.game.data.levels[this.level_index].layers[this.layer_index].type))
            this.backdrop_index = this.layer_index;

        if (this.backdrop_index !== null && menus.level.active_key === null &&
            this.game.data.levels[this.level_index].layers[this.backdrop_index].rects?.[this.rect_index]) {
            let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
            this.backdrop_cursor.remove.apply(this.backdrop_cursor, this.backdrop_cursor.children);
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
                this.scene.add(this.backdrop_cursor);
            }
        }
        if (this.backdrop_controls_setup_for === null) {
            this.backdrop_move_elements = {};
            this.backdrop_controls_setup_for = [this.backdrop_index, this.rect_index];
            for (let x of this.backdrop_controls)
                $(x).remove();
            this.backdrop_controls = [];
            if (this.backdrop_index !== null && menus.level.active_key === null &&
                this.game.data.levels[this.level_index].layers[this.backdrop_index].rects?.[this.rect_index]) {
                let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
                let rect = backdrop.rects[this.rect_index];
                let p0 = this.world_to_ui([rect.left, rect.bottom]);
                let p1 = this.world_to_ui([rect.left + rect.width, rect.bottom + rect.height]);

                let sc0 = $(`<div style='top: ${p0[1] - 8}px; left: ${p0[0] - 8}px; background-color: #444;'>`).addClass('backdrop-swatch');
                this.backdrop_controls.push(sc0);
                this.backdrop_move_elements.sc0 = sc0;
                $(sc0).on('mousedown touchstart', function(e) {
                    self.backdrop_move_point = `sc0`;
                    self.backdrop_move_point_old_coordinates = [rect.left, rect.bottom];
                    self.backdrop_move_point_old_size = [rect.width, rect.height];
                    self.handle_down(e);
                });
                $(this.element).append(sc0);

                let sc3 = $(`<div style='top: ${p1[1] - 8}px; left: ${p1[0] - 8}px; background-color: #444;'>`).addClass('backdrop-swatch');
                this.backdrop_controls.push(sc3);
                this.backdrop_move_elements.sc3 = sc3;
                $(sc3).on('mousedown touchstart', function(e) {
                    self.backdrop_move_point = `sc3`;
                    self.backdrop_move_point_old_coordinates = [rect.left, rect.bottom];
                    self.backdrop_move_point_old_size = [rect.width, rect.height];
                    self.backdrop_move_element = sc3;
                    self.handle_down(e);
                });
                $(this.element).append(sc3);

                if (backdrop.backdrop_type === 'color') {
                    if (backdrop.colors.length > 1) {
                        let rect = backdrop.rects[0];
                        let p0 = this.world_to_ui([rect.left, rect.bottom]);
                        let p1 = this.world_to_ui([rect.left + rect.width, rect.bottom + rect.height]);
                        for (let ci = 0; ci < backdrop.colors.length; ci++) {
                            let c = backdrop.colors[ci];
                            let swatch_control = $(`<div style='top: ${p0[1] + (p1[1] - p0[1]) * c[2] - 8}px; left: ${p0[0] + (p1[0] - p0[0]) * c[1] - 8}px; background-color: ${c[0]};'>`).addClass('backdrop-swatch');
                            this.backdrop_controls.push(swatch_control);
                            this.backdrop_move_elements[`color_${ci}`] = swatch_control;
                            $(swatch_control).on('mousedown touchstart', function(e) {
                                self.backdrop_move_point = `color_${ci}`;
                                self.backdrop_move_point_old_coordinates = [c[1], c[2]];
                                self.backdrop_move_element = swatch_control;
                                self.handle_down(e);
                            });
                            $(this.element).append(swatch_control);
                        }
                    }
                }
                if (backdrop.backdrop_type === 'effect') {
                    let default_control_points = shaders.control_points_for_effect[backdrop.effect] ?? [];
                    let rect = backdrop.rects[0];
                    let p0 = this.world_to_ui([rect.left, rect.bottom]);
                    let p1 = this.world_to_ui([rect.left + rect.width, rect.bottom + rect.height]);
                    for (let cpi = 0; cpi < default_control_points.length; cpi++) {
                        let c = backdrop.control_points[cpi] ?? default_control_points[cpi];
                        let swatch_control = $(`<div style='top: ${p0[1] + (p1[1] - p0[1]) * c[1] - 8}px; left: ${p0[0] + (p1[0] - p0[0]) * c[0] - 8}px; background-color: #fff;'>`).addClass('backdrop-swatch');
                        this.backdrop_controls.push(swatch_control);
                        this.backdrop_move_elements[`control_point_${cpi}`] = swatch_control;
                        $(swatch_control).on('mousedown touchstart', function(e) {
                            let c = backdrop.control_points[cpi] ?? default_control_points[cpi];
                            self.backdrop_move_point = `control_point_${cpi}`;
                            self.backdrop_move_point_old_coordinates = [c[0], c[1]];
                            self.backdrop_move_element = swatch_control;
                            self.handle_down(e);
                        });
                        $(this.element).append(swatch_control);
                    }
                }
            }
        }

        // rebuilt when the selection changes (which sprites, in which layer)
        const selection_key = this.selection.length ? `${this.level_index}:${this.layer_index}:${this.selection.join(',')}` : null;
        let placed_properties_need_update = (this.placed_properties_for ?? null) !== selection_key;
        this.placed_properties_for = selection_key;
        if (!selection_key) {
            $('#menu_placed_properties').empty();
            this.update_signal_links = null;
            placed_properties_need_update = false;
        }

        if (placed_properties_need_update) {
            $('#menu_placed_properties').empty();
            this.update_signal_links = null;
            this.add_selection_controls($('#menu_placed_properties'));
            if (this.selection.length === 1) {
                let div = $(`<div>`).appendTo($('#menu_placed_properties'));
                let entry_index = this.selection[0];
                let entry = this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index];
                console.log('entry', entry);
                let sprite = this.game.data.sprites[this.game.sprite_index_for_ref(entry[0])];
                console.log('sprite', sprite);
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
                        if (property.visible && !property.visible(sprite.traits, traits_of)) continue;
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
                            this.update_signal_links?.();
                        };
                        let widget = null;
                        if (property.type === 'int' || property.type === 'float') {
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
                        } else if (property.type === 'string') {
                            widget = new LineEditWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: property.options ?? null,
                                get,
                                set,
                            });
                        }
                        widgets[`${trait}/${key}`] = widget;
                        if (key === 'signal_code' || key === 'drop_code') this.add_signal_link_line(div, trait, key, entry_index);
                    }
                }
                this.add_signal_links(sprite, entry_index);
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
        this.build_signal_links();
    }

    refresh_sprite_widget() {
        $('#menu_level_sprites').empty();
        for (let si = 0; si < this.game.data.sprites.length; si++) {
            this.game.update_material_for_sprite(si);
            let fi = Math.floor(this.game.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let sprite_button = $(`<div>`).addClass('button button-3').appendTo($('#menu_level_sprites'));
            // sprite_button.append($('<img>').attr('src', this.game.data.sprites[si].states[0].frames[fi].src).css('width', '100%').css('image-rendering', 'pixelated'));
            sprite_button.css('background-image', `url(${this.game.data.sprites[si].states[0].frames[fi].src})`);
            sprite_button.css('background-size', 'contain');
            sprite_button.css('image-rendering', 'pixelated');
            sprite_button.data('sprite_index', si);
            // if (si === 0) sprite_button.addClass('active');
            sprite_button.mousedown(function(e) {
                e.preventDefault();
                $(e.target).closest('.menu').find('.button').removeClass('active');
                let button = $(e.target.closest('.button'));
                button.addClass('active');
                self.sprite_index = button.data('sprite_index');
                self.grid_width = self.game.data.sprites[self.sprite_index].width;
                self.grid_height = self.game.data.sprites[self.sprite_index].height;
                self.grid_x = 0;
                self.grid_y = 0;
                self.grid_size_widget.refresh();
                self.grid_offset_widget.refresh();
                self.refresh();
                self.render();
                menus.level.handle_click('tool/pen');
            });
        }
        this.refresh();
        let self = this;
        setTimeout(function() { self.render(); }, 0);
        menus.level.callback();
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
        if (!level_editor || e.altKey || is_field(e.target)) return;
        const ctrl = e.ctrlKey || e.metaKey;
        const key = (e.key ?? '').toLowerCase();
        const selecting = menus.level.active_key === 'tool/select' && level_editor.selection.length > 0;
        let handled = true;
        if (ctrl && key === 'c') handled = level_editor.copy_selection();
        else if (ctrl && key === 'x') level_editor.cut_selection();
        else if (ctrl && key === 'v') level_editor.paste_clipboard();
        else if (ctrl && key === 'd') level_editor.duplicate_selection();
        else if (!ctrl && selecting && e.key.startsWith('Arrow')) {
            const step_x = e.shiftKey ? 1 : level_editor.grid_width;
            const step_y = e.shiftKey ? 1 : level_editor.grid_height;
            const [dx, dy] = { ArrowLeft: [-step_x, 0], ArrowRight: [step_x, 0], ArrowUp: [0, step_y], ArrowDown: [0, -step_y] }[e.key] ?? [0, 0];
            level_editor.nudge_selection(dx, dy);
        } else if (!ctrl && selecting && e.key === 'Escape') level_editor.clear_selection();
        else handled = false;
        if (!handled) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);

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

// Colours of the Codes in the level editor's connections (Sweetie 16, bright).
const SIGNAL_LINK_COLORS = ['#ffcd75', '#73eff7', '#a7f070', '#ef7d57', '#41a6f6', '#f4f4f4', '#38b764', '#b13e53'];
function signal_link_color(code) {
    const n = Number.isInteger(code) ? code : 0;
    return SIGNAL_LINK_COLORS[((n % SIGNAL_LINK_COLORS.length) + SIGNAL_LINK_COLORS.length) % SIGNAL_LINK_COLORS.length];
}

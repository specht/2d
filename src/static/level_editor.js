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
        console.log(`apply_layer`, layer, this.layer_index);
        if (layer.type !== 'sprites') return;
        for (let i = 0; i < layer.sprites.length; i++) {
            let sprite = layer.sprites[i];
            this.add_sprite([sprite[1], sprite[2]], sprite[0], i);
        }
        if (this.el_sprite_count !== null)
            $(this.el_sprite_count).text(`${layer.sprites.length}`);
        // console.log(layer);
    }

    remove_from_interval_trees(psi) {
        let placed = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[psi];
        let sprite_index = placed[0];
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
        let sprite_index = placed[0];
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
        if (((this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites ?? [])[this.placed_sprite_index_for_pos[pos]] ?? [])[0] !== sprite_index) {
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
            let mesh = new THREE.Mesh(this.level_editor.game.geometry_for_sprite[sprite_index], this.level_editor.game.material_for_sprite[sprite_index]);
            mesh.position.x = p[0];
            mesh.position.y = p[1];
            this.group.add(mesh);
            this.mesh_for_pos[pos] = mesh;
            this.placed_sprite_index_for_pos[pos] = use_placed_sprite_index;
            this.interval_tree_x.insert([x0, x1], use_placed_sprite_index);
            this.interval_tree_y.insert([y0, y1], use_placed_sprite_index);
            if (force_placed_sprite_index === null) {
                (this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites ?? [])[use_placed_sprite_index] = [sprite_index, p[0], p[1]];
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
            let sprite_index = s[0];

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
        this.camera_mode = false;

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

                new LineEditWidget({
                    container: $('#menu_level_properties'),
                    label: 'Youtube',
                    get: () => self.game.data.levels[self.level_index].properties.yt_tag,
                    set: (x) => {
                        self.game.data.levels[self.level_index].properties.yt_tag = x;
                    },
                });

                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_layers'),
                    trash: $('#trash'),
                    items: self.game.data.levels[self.level_index].layers,
                    item_class: 'menu_layer_item',
                    step_aside_css: { top: '35px' },
                    gen_new_item_options: [
                        ['Sprites', 'sprites'],
                        ['Backdrop', 'backdrop'],
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
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Sprites (')).append(sprite_count).append($('<span>').text(')')));
                            self.layer_structs[index].el_sprite_count = sprite_count;
                        } else if (type === 'backdrop') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Backdrop')));
                        } else if (type === 'text') {
                            layer_div.append($(`<span style='margin-left: 0.5em;'>`).append($('<span>').text('Text')));
                        }
                        return layer_div;
                    },
                    onclick: (e, index) => {
                        self.clear_selection();
                        self.layer_index = index;
                        self.rect_index = 0;
                        self.backdrop_controls_setup_for = null;
                        if (self.game.data.levels[self.level_index].layers[self.layer_index].type !== 'sprites') {
                            menus.level.blur();
                        }
                        if (self.game.data.levels[self.level_index].layers[self.layer_index].type == 'backdrop') {
                            self.refresh_backdrop_controls();
                        }
                        self.setup_layer_properties();
                        $('#menu_layer_properties_container').show();
                        self.refresh();
                        self.render();
                    },
                    gen_new_item: (type) => {
                        let layer_struct = new LayerStruct(self);
                        self.layer_structs.push(layer_struct);
                        let layer = { type: type };
                        if (type === 'sprites') {
                            layer.sprites = [];
                        } else if (type === 'backdrop') {
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
                        ['Punkte gesammelt', 'min_points'],
                        ['Sprite eingesammelt', 'need_sprite'],
                        ['Gegner getötet', 'killed_baddie'],
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
                        return condition_div;
                    },
                    hint_with_heading_for_item: (item) => {
                        if (item.type === 'touching_level_complete')
                            return ["Levelwechsel erreicht", "Damit das Level beendet werden kann, muss ein Sprite mit der Eigenschaft »Levelwechsel« eingesammelt worden sein."];
                        if (item.type === 'min_points')
                            return ["Punkte gesammelt", "Damit das Level beendet werden kann, muss ein bestimmter Anteil der im Level vorhandenen Punkte eingesammelt worden sein."];
                        if (item.type === 'need_sprite')
                            return ["Sprite eingesammelt", "Damit das Level beendet werden kann, muss ein bestimmtes Sprite eingesammelt worden sein."];
                        if (item.type === 'killed_baddie')
                            return ["Gegner getötet", "Damit das Level beendet werden kann, muss ein bestimmter Gegner getötet worden sein."];
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
            },
            gen_new_item: () => {
                self.game.data.levels.push({});
                self.game.fix_game_data();
                return level;
            },
            delete_item: (index) => {
                self.game.data.levels.splice(index, 1);
                self.level_index = 0;
            },
            on_move_item: (from, to) => {
                move_item_helper(self.game.data.levels, from, to);
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

    setup_layer_properties() {
        let self = this;
        $('#menu_layer_properties').empty();
        let layer = self.game.data.levels[self.level_index].layers[self.layer_index];

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
        }
        if (layer.type === 'backdrop') {
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
                    options: {
                        'snow': 'Schnee',
                        'smoke': 'Rauch',
                        'fire': 'Feuer',
                        'lightrays': 'Lichtstrahlen',
                    },
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
            }
        }
        // $('#menu_layer_properties').append($('<hr />'));
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

    setup_condition_properties() {
        let self = this;
        $('#menu_conditions_properties').empty();

        let condition = self.game.data.levels[self.level_index].conditions[self.condition_index];

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
                get: () => self.game.data.levels[self.level_index].conditions[self.condition_index].properties.sprite_index,
                set: (x) => {
                    self.game.data.levels[self.level_index].conditions[self.condition_index].properties.sprite_index = x;
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
        if (menus.level.active_key === 'tool/pen') {
            this.cursor_group.visible = false;
        }
        this.render();
    }

    handle_down(e) {
        e.preventDefault();
        e.stopPropagation();
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
        if (menus.level.active_key === 'tool/pen' && this.game.data.levels[this.level_index].layers[this.layer_index].type === 'sprites') {
            if (e.button === 0) {
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
            this.clear_selection(false);
            this.updating_selection = true;
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
        if (this.updating_selection && menus.level.active_key === 'tool/select') {
            let sx0 = this.x0;
            let sy0 = this.y0;
            let sx1 = this.x1;
            let sy1 = this.y1;
            this.clear_selection(false);
            this.selection = this.layer_structs[this.layer_index].select_rect(this.selection_group, sx0, sy0, sx1, sy1);
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

    refresh() {
        let self = this;
        this.scene.remove.apply(this.scene, this.scene.children);
        this.scene.background = new THREE.Color(parse_html_color(this.game.data.levels[this.level_index].properties.background_color));

        this.refresh_grid();
        // // remove all elements in the scene
        // this.scene.remove.apply(this.scene, this.scene.children);
        // if (game === null) return;

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
                        let uniforms = {};
                        let material = new THREE.LineBasicMaterial({transparent: true});
                        material.opacity = 0;
                        if (backdrop.backdrop_type === 'effect') {
                            let gradient_points = JSON.parse(JSON.stringify(backdrop.control_points));
                            uniforms = {
                                time: { value: 0 },
                                resolution: { value: [rect0.width, rect0.height] },
                                scale: { value: [backdrop.scale] },
                                color: { value: parse_html_color_to_vec4(backdrop.color)}
                            };
                            for (let gi = 0; gi < shaders.control_points_for_effect[backdrop.effect].length; gi++) {
                                gradient_points[gi] ??= JSON.parse(JSON.stringify(shaders.control_points_for_effect[backdrop.effect][gi]));
                                gradient_points[gi][0] = rect0.width * gradient_points[gi][0] + rect0.left;
                                gradient_points[gi][1] = rect0.height * gradient_points[gi][1] + rect0.bottom;
                                uniforms[`cp${String.fromCharCode(97 + gi)}`] = { value: [gradient_points[gi][0], gradient_points[gi][1]] };
                            }
                            material = new THREE.ShaderMaterial({
                                uniforms: uniforms,
                                transparent: true,
                                vertexShader: shaders.get('basic.vs'),
                                fragmentShader: shaders.get(backdrop.effect + '.fs'),
                                side: THREE.DoubleSide,
                            });
                            let x0 = rect.left;
                            let y0 = rect.bottom;
                            let x1 = rect.left + rect.width;
                            let y1 = rect.bottom + rect.height;
                            let uv = geometry.attributes.uv;
                            uv.setXY(0, x0, y1);
                            uv.setXY(1, x1, y1);
                            uv.setXY(2, x0, y0);
                            uv.setXY(3, x1, y0);
                        }
                        if (backdrop.backdrop_type === 'color') {
                            let gradient_points = JSON.parse(JSON.stringify(backdrop.colors));
                            for (let gi = 0; gi < gradient_points.length; gi++) {
                                gradient_points[gi][1] = rect0.width * gradient_points[gi][1] + rect0.left;
                                gradient_points[gi][2] = rect0.height * gradient_points[gi][2] + rect0.bottom;
                            }
                            if (gradient_points.length === 1) {
                                uniforms = {
                                    n:  { value: 1 },
                                    ca: { value: parse_html_color_to_vec4(gradient_points[0][0]) },
                                };
                            } else if (gradient_points.length === 2) {
                                let d = [gradient_points[1][1] - gradient_points[0][1], gradient_points[1][2] - gradient_points[0][2]];
                                let l = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
                                let l1 = 1.0 / l;
                                d[0] *= l1; d[1] *= l1;
                                uniforms = {
                                    n:  { value: 2 },
                                    ca: { value: parse_html_color_to_vec4(gradient_points[0][0]) },
                                    cb: { value: parse_html_color_to_vec4(gradient_points[1][0]) },
                                    pa: { value: [gradient_points[0][1], gradient_points[0][2]] },
                                    pb: { value: [gradient_points[1][1], gradient_points[1][2]] },
                                    na: { value: [d[0], d[1]] },
                                    nb: { value: [-d[0], -d[1]] },
                                    la: { value: l },
                                    lb: { value: l },
                                };
                            } else if (gradient_points.length === 4) {
                                uniforms = {
                                    n:  { value: 4 },
                                    ca: { value: parse_html_color_to_vec4(gradient_points[0][0]) },
                                    cb: { value: parse_html_color_to_vec4(gradient_points[1][0]) },
                                    cc: { value: parse_html_color_to_vec4(gradient_points[2][0]) },
                                    cd: { value: parse_html_color_to_vec4(gradient_points[3][0]) },
                                    pa: { value: [gradient_points[0][1], gradient_points[0][2]] },
                                    pb: { value: [gradient_points[1][1], gradient_points[1][2]] },
                                    pc: { value: [gradient_points[2][1], gradient_points[2][2]] },
                                    pd: { value: [gradient_points[3][1], gradient_points[3][2]] },
                                };
                            }
                            material = new THREE.ShaderMaterial({
                                uniforms: uniforms,
                                transparent: true,
                                vertexShader: shaders.get('basic.vs'),
                                fragmentShader: shaders.get('gradient.fs'),
                                side: THREE.DoubleSide,
                            });
                            let x0 = rect.left;
                            let y0 = rect.bottom;
                            let x1 = rect.left + rect.width;
                            let y1 = rect.bottom + rect.height;
                            let uv = geometry.attributes.uv;
                            uv.setXY(0, x0, y1);
                            uv.setXY(1, x1, y1);
                            uv.setXY(2, x0, y0);
                            uv.setXY(3, x1, y0);
                        }
                        let mesh = new THREE.Mesh(geometry, material);
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
        if (this.game.data.levels[this.level_index].layers[this.layer_index].type === 'backdrop')
            this.backdrop_index = this.layer_index;

        if (this.backdrop_index !== null && menus.level.active_key === null) {
            let backdrop = this.game.data.levels[this.level_index].layers[this.backdrop_index];
            this.backdrop_cursor.remove.apply(this.backdrop_cursor, this.backdrop_cursor.children);
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
            if (this.backdrop_index !== null && menus.level.active_key === null) {
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

        let placed_properties_need_update = false;
        if (this.selection.length !== 1) {
            $('#menu_placed_properties').empty();
        } else {
            placed_properties_need_update = ((this.placed_properties_for ?? null) != this.selection[0]);
            this.placed_properties_for = this.selection[0];
        }

        if (placed_properties_need_update) {
            $('#menu_placed_properties').empty();
            if (this.selection.length === 1) {
                this.placed_properties_for ??= selection[0];
                let div = $(`<div>`).appendTo($('#menu_placed_properties'));
                let entry_index = this.selection[0];
                let entry = this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index];
                console.log('entry', entry);
                let sprite = this.game.data.sprites[entry[0]];
                console.log('sprite', sprite);
                for (let trait in sprite.traits) {
                    console.log('trait', trait);
                    // let title = $(`<h4>`).text(SPRITE_TRAITS[trait].label).appendTo(div);
                    for (let key in ((SPRITE_TRAITS[trait] ?? {}).placed_properties ?? {})) {
                        console.log('key', key);
                        let property = SPRITE_TRAITS[trait].placed_properties[key];
                        console.log('property', property);
                        if (property.type === 'int') {
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
                                get: () => ((this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ?? {})[trait] ?? {})[key] ?? property.default,
                                set: (x) => {
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait][key] = Math.round(x);
                                },
                            });
                        } else if (property.type === 'float') {
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
                                get: () => ((this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ?? {})[trait] ?? {})[key] ?? property.default,
                                set: (x) => {
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait][key] = x;
                                },
                            });
                        } else if (property.type === 'bool') {
                            new CheckboxWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                get: () => ((this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ?? {})[trait] ?? {})[key] ?? property.default,
                                set: (x) => {
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait][key] = Math.round(x);
                                },
                            });
                        } else if (property.type === 'select') {
                            new SelectWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: property.options ?? null,
                                get: () => ((this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ?? {})[trait] ?? {})[key] ?? property.default,
                                set: (x) => {
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait][key] = Math.round(x);
                                },
                            });
                        } else if (property.type === 'string') {
                            new LineEditWidget({
                                container: div,
                                label: property.label ?? key,
                                hint: property.hint ?? null,
                                options: property.options ?? null,
                                get: () => ((this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ?? {})[trait] ?? {})[key] ?? property.default,
                                set: (x) => {
                                    console.log('SETTING', x);
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait] ??= {};
                                    this.game.data.levels[this.level_index].layers[this.layer_index].sprites[entry_index][3][trait][key] = x;
                                },
                            });
                        }
                    }
                }
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


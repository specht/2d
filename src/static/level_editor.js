class LayerStruct {
    /*
    layer: only one sprite per position allowed
    */
    constructor(level_editor) {
        this.level_editor = level_editor;
        this.group = new THREE.Group();
        this.el_sprite_count = null;
        this.sprite_for_pos = {};
        this.mesh_for_pos = {};
    }

    // clear layer struct and apply layer from game data
    apply_layer(layer) {
        this.group.remove.apply(this.group, this.group.children);
        this.sprite_for_pos = {};
        this.mesh_for_pos = {};
        for (let sprite of layer.sprites) {
            this.add_sprite([sprite[1], sprite[2]], sprite[0], false);
        }
        // console.log(layer);
    }

    remove_sprite(p, update_game) {
        let pos = `${p[0]}/${p[1]}`;
        if (pos in this.sprite_for_pos) {
            this.group.remove(this.mesh_for_pos[pos]);
            delete this.sprite_for_pos[pos];
            delete this.mesh_for_pos[pos];
            if (update_game) {
                // find sprite in sprite list
                let index = null;
                for (let i = 0; i < this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length; i++) {
                    let entry = this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites[i];
                    if (entry[1] === p[0] && entry[2] === p[1]) {
                        index = i;
                        break;
                    }
                }
                if (index !== null)
                    this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.splice(index, 1);
            }
            $(this.el_sprite_count).text(`${this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length}`);
        }
    }

    add_sprite(p, sprite_index, update_game) {
        let pos = `${p[0]}/${p[1]}`;
        if (this.sprite_for_pos[pos] !== sprite_index) {
            if (pos in this.sprite_for_pos) {
                this.group.remove(this.mesh_for_pos[pos]);
                delete this.sprite_for_pos[pos];
                delete this.mesh_for_pos[pos];
            }
            let mesh = new THREE.Mesh(this.level_editor.game.geometry_for_sprite[sprite_index], this.level_editor.game.material_for_sprite[sprite_index]);
            mesh.position.x = p[0];
            mesh.position.y = p[1];
            this.group.add(mesh);
            this.sprite_for_pos[pos] = sprite_index;
            this.mesh_for_pos[pos] = mesh;
            if (update_game) {
                this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.push([sprite_index, p[0], p[1]]);
            }
            $(this.el_sprite_count).text(`${this.level_editor.game.data.levels[this.level_editor.level_index].layers[this.level_editor.layer_index].sprites.length}`);
        }
    }
}

class LevelEditor {
    constructor(element, game) {
        let self = this;
        this.element = element;
        $(this.element).empty();
        this.grid_width = 24;
        this.grid_height = 24;
        this.grid_x = 0;
        this.grid_y = 0;
        this.modifier_shift = false;
        this.game = game;
        this.level_index = 0;
        this.layer_index = 0;
        this.clock = new THREE.Clock(true);
        this.scene = new THREE.Scene();
        this.grid_group = new THREE.Group();
        this.cursor_group = new THREE.Group();
        this.rect_group = new THREE.Group();
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
        this.x0 = 0.0;
        this.y0 = 0.0;
        this.y1 = 1.0;
        this.sheets = [];
        this.cursor = null;
        this.sprite_index = 0;
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        this.scale = this.height / 24.0 / 16.0;
        this.visible_pixels = this.height / this.scale;
        this.mouse_down = false;
        this.mouse_down_button = 0;
        this.mouse_down_position = [0, 0];
        this.mouse_down_position_no_snap = [0, 0];
        this.mouse_down_position_raw = [0, 0];
        this.old_camera_position = [0, 0];
        this.sprite_for_pos = {};
        $(this.element).append(this.renderer.domElement);

        this.texture_loader = new THREE.TextureLoader();

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
            gen_item: (level, index) => {
                let level_div = $(`<div>`);
                return level_div;
            },
            onclick: (e, index) => {
                $(e).closest('.menu_level_item').parent().parent().find('.menu_level_item').removeClass('active');
                $(e).parent().addClass('active');
                self.level_index = index;
                self.layer_index = 0;

                self.layer_structs = [];
                for (let layer of self.game.data.levels[self.level_index].layers) {
                    let layer_struct = new LayerStruct(self);
                    layer_struct.apply_layer(layer);
                    self.layer_structs.push(layer_struct);
                }

                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_layers'),
                    trash: $('#trash'),
                    items: self.game.data.levels[self.level_index].layers,
                    item_class: 'menu_layer_item',
                    gen_item: (layer, index) => {
                        let layer_div = $(`<div>`);
                        let button_show = $(`<div class='toggle'>`);
                        if (self.game.data.levels[self.level_index].layers[index].properties.visible) {
                            button_show.append($(`<i class='fa fa-eye'>`));
                        } else {
                            button_show.append($(`<i class='fa fa-eye-slash'>`));
                        }
                        button_show.click(function(e) {
                            let button = $(e.target).closest('.toggle');
                            let item = button.closest('.menu_layer_item');
                            let layer_index = item.index();
                            self.game.data.levels[self.level_index].layers[layer_index].properties ??= {};
                            self.game.data.levels[self.level_index].layers[layer_index].properties.visible = !self.game.data.levels[self.level_index].layers[layer_index].properties.visible;
                            if (self.game.data.levels[self.level_index].layers[layer_index].properties.visible) {
                                button.find('i').removeClass('fa-eye-slash').addClass('fa-eye');
                            } else {
                                button.find('i').removeClass('fa-eye').addClass('fa-eye-slash');
                            }
                            e.stopPropagation();
                            self.refresh();
                            self.render();
                        });
                        layer_div.append(button_show);
                        let sprite_count = $(`<span>`).text(`${layer.sprites.length}`);
                        layer_div.append($(`<span style='margin-left: 0.5em;'>`).append(sprite_count).append($('<span>').text(' Sprites')));
                        self.layer_structs[index].el_sprite_count = sprite_count;
                        return layer_div;
                    },
                    onclick: (e, index) => {
                        $(e).closest('.menu_layer_item').parent().parent().find('.menu_layer_item').removeClass('active');
                        $(e).parent().addClass('active');
                        self.layer_index = index;
                    },
                    gen_new_item: () => {
                        let layer = { sprites: [] };
                        self.game.data.levels[self.level_index].layers.push(layer);
                        self.game.fix_game_data();
                        let layer_struct = new LayerStruct(self);
                        self.layer_structs.push(layer_struct);
                        self.refresh();
                        return self.game.data.levels[self.level_index].layers[self.game.data.levels[self.level_index].layers.length - 1];
                    },
                    delete_item: (index) => {
                        self.game.data.levels[self.level_index].layers.splice(index, 1);
                        self.layer_structs.splice(index, 1);
                        self.refresh();
                        self.render();
                    },
                    on_swap_items: (a, b) => {
                        if (a > b) {
                            let temp = self.game.data.levels[self.level_index].layers[b];
                            let temps = self.layer_structs[b];
                            for (let i = b; i < a; i++) {
                                self.game.data.levels[self.level_index].layers[i] = self.game.data.levels[self.level_index].layers[i + 1];
                                self.layer_structs[i] = self.layer_structs[i + 1];
                            }
                            self.game.data.levels[self.level_index].layers[a] = temp;
                            self.layer_structs[a] = temps;
                        } else if (a < b) {
                            let temp = self.game.data.levels[self.level_index].layers[b];
                            let temps = self.layer_structs[b];
                            for (let i = b; i > a; i--) {
                                self.game.data.levels[self.level_index].layers[i] = self.game.data.levels[self.level_index].layers[i - 1];
                                self.layer_structs[i] = self.layer_structs[i - 1];
                            }
                            self.game.data.levels[self.level_index].layers[a] = temp;
                            self.layer_structs[a] = temps;
                        }
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
            },
            on_swap_items: (a, b) => {
                // if (a > b) {
                //     let temp = self.game.data.sprites[self.sprite_index].states[b];
                //     for (let i = b; i < a; i++)
                //     self.game.data.sprites[self.sprite_index].states[i] = self.game.data.sprites[self.sprite_index].states[i + 1];
                //     self.game.data.sprites[self.sprite_index].states[a] = temp;
                // } else if (a < b) {
                //     let temp = self.game.data.sprites[self.sprite_index].states[b];
                //     for (let i = b; i > a; i--)
                //     self.game.data.sprites[self.sprite_index].states[i] = self.game.data.sprites[self.sprite_index].states[i - 1];
                //     self.game.data.sprites[self.sprite_index].states[a] = temp;
                // }
                // self.game.refresh_frames_on_screen();
            }
        });

        this.refresh();
        this.render();

        $(this.element).off();

        $(this.element).mouseenter(function (e) {
            let p = self.ui_to_world(e.offsetX, e.offsetY, true);
            self.cursor_group.remove.apply(self.cursor_group, self.cursor_group.children);
            if (menus.level.active_key === 'tool/pen') {
                self.sheets[self.sprite_index].add_sprite_to_group(self.cursor_group, 'sprite', 0, 0);
                self.cursor_group.position.x = p[0];
                self.cursor_group.position.y = p[1];
                self.cursor_group.visible = true;
            }
            self.render();
        });
        $(this.element).mousemove(function (e) {
            let p = self.ui_to_world(e.offsetX, e.offsetY, true);
            let p_no_snap = self.ui_to_world(e.offsetX, e.offsetY, false);
            if (menus.level.active_key === 'tool/pen') {
                self.cursor_group.visible = true;
                if (self.modifier_shift) {
                    self.cursor_group.position.x = p_no_snap[0];
                    self.cursor_group.position.y = p_no_snap[1];
                } else {
                    self.cursor_group.position.x = p[0];
                    self.cursor_group.position.y = p[1];
                }
                if (self.mouse_down) {
                    if (self.mouse_down_button === 0) {
                        if (self.modifier_shift) {
                            self.add_sprite_to_level(p_no_snap);
                        } else {
                            self.add_sprite_to_level(p);
                        }
                    } else if (self.mouse_down_button === 2) {
                        if (self.modifier_shift) {
                            self.remove_sprite_from_level(p_no_snap);
                        } else {
                            self.remove_sprite_from_level(p);
                        }
                    }
                }
            } else {
                self.cursor_group.visible = false;
            }
            if (menus.level.active_key === 'tool/pan') {
                // $(self.element).css('cursor', 'url(icons/move-hand.png) 11 4, auto');
                if (self.mouse_down && self.mouse_down_button === 0) {
                    self.camera_x = self.old_camera_position[0] - (e.offsetX - self.mouse_down_position_raw[0]) / self.scale;
                    self.camera_y = self.old_camera_position[1] + (e.offsetY - self.mouse_down_position_raw[1]) / self.scale;
                    self.refresh();
                }
            }

            if (menus.level.active_key === 'tool/fill-rect' || menus.level.active_key === 'tool/select') {
                if (self.mouse_down) {
                    self.prepare_rect_group(self.mouse_down_position_no_snap[0], self.mouse_down_position_no_snap[1], p_no_snap[0], p_no_snap[1]);
                }
                self.rect_group.visible = self.mouse_down;
            }
            self.render();
        });
        $(this.element).mouseleave(function (e) {
            if (menus.level.active_key === 'tool/pen') {
                self.cursor_group.visible = false;
            }
            self.render();
        });
        $(this.element).on('contextmenu', function (e) {
            return false;
        });
        $(this.element).mousedown(function (e) {
            e.preventDefault();
            e.stopPropagation();
            self.mouse_down = true;
            self.mouse_down_button = e.button;
            self.mouse_down_position = self.ui_to_world(e.offsetX, e.offsetY, true);
            self.mouse_down_position_no_snap = self.ui_to_world(e.offsetX, e.offsetY, false);
            self.mouse_down_position_raw = [e.offsetX, e.offsetY];
            if (menus.level.active_key === 'tool/pen') {
                if (e.button === 0) {
                    if (self.modifier_shift) {
                        self.add_sprite_to_level(self.mouse_down_position_no_snap);
                    } else {
                        self.add_sprite_to_level(self.mouse_down_position);
                    }
                } else if (e.button === 2) {
                    if (self.modifier_shift) {
                        self.remove_sprite_from_level(self.mouse_down_position_no_snap);
                    } else {
                        self.remove_sprite_from_level(self.mouse_down_position);
                    }
                }
            } else if (menus.level.active_key === 'tool/pan') {
                self.old_camera_position = [self.camera_x, self.camera_y];
            }
            self.render();
        });
        $(this.element).mouseup(function (e) {
            self.mouse_down = false;
            let p_no_snap = self.ui_to_world(e.offsetX, e.offsetY, false);
            if (menus.level.active_key === 'tool/fill-rect') {
                let x0 = self.mouse_down_position_no_snap[0];
                let y0 = self.mouse_down_position_no_snap[1];
                let x1 = p_no_snap[0];
                let y1 = p_no_snap[1];
                if (x0 > x1) { let temp = x0; x0 = x1; x1 = temp; }
                if (y0 > y1) { let temp = y0; y0 = y1; y1 = temp; }
                x0 = Math.round(Math.floor(x0 / self.grid_width) * self.grid_width);
                y0 = Math.round(Math.floor(y0 / self.grid_height) * self.grid_height);
                x1 = Math.round(Math.ceil(x1 / self.grid_width) * self.grid_width);
                y1 = Math.round(Math.ceil(y1 / self.grid_height) * self.grid_height);
                for (let y = y0; y < y1; y += self.grid_height) {
                    for (let x = x0; x < x1; x += self.grid_width) {
                        self.add_sprite_to_level([x, y]);
                    }
                }
            }
            self.rect_group.visible = false;
            self.render();
        });
        $(this.element).on('mousewheel', function (e) {
            e.preventDefault();
            let p = self.ui_to_world(e.originalEvent.offsetX, e.originalEvent.offsetY, false);
            self.zoom_at_point(e.originalEvent.deltaY, p[0], p[1]);
            self.render();
        });
    }

    setModifierShift(flag) {
        this.modifier_shift = flag;
        // this.refresh();
        this.render();
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
            this.layer_structs[this.layer_index].remove_sprite(p, true);
            this.render();
        }
    }

    add_sprite_to_level(p) {
        if (this.game.data.levels[this.level_index].layers[this.layer_index].properties.visible) {
            this.layer_structs[this.layer_index].add_sprite(p, this.sprite_index, true);
            this.render();
        }
    }

    fix_scale() {
        this.scale = this.height / this.visible_pixels;
        if (this.scale < 0.2) {
            this.scale = 0.2;
            this.visible_pixels = this.height / this.scale;
        }
        if (this.scale > 8) {
            this.scale = 8;
            this.visible_pixels = this.height / this.scale;
        }
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

    ui_to_world(x, y, snap) {
        let wx = this.camera_x + (x - (this.width / 2)) / this.scale;
        let wy = this.camera_y - (y - (this.height / 2)) / this.scale;
        if (snap) {
            wx = Math.round(Math.floor((wx + 12) / this.grid_width) * this.grid_width);
            wy = Math.round(Math.floor((wy) / this.grid_height) * this.grid_height);
        } else {
            wx = Math.round(wx);
            wy = Math.round(wy);
        }
        return [wx, wy];
    }

    handleResize() {
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        this.refresh_grid();
        this.render();
    }

    render() {
        // requestAnimationFrame((t) => this.render());
        this.camera.left = this.camera_x - this.width * 0.5 / this.scale;
        this.camera.right = this.camera_x + this.width * 0.5 / this.scale;
        this.camera.top = this.camera_y + this.height * 0.5 / this.scale;
        this.camera.bottom = this.camera_y - this.height * 0.5 / this.scale;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.renderer.render(this.scene, this.camera);
    }

    refresh_grid() {
        this.x0 = this.camera_x - this.width * 0.5 / this.scale;
        this.x1 = this.camera_x + this.width * 0.5 / this.scale;
        this.y0 = this.camera_y - this.height * 0.5 / this.scale;
        this.y1 = this.camera_y + this.height * 0.5 / this.scale;

        this.grid_group.remove.apply(this.grid_group, this.grid_group.children);
        let opacity = 0.2;
        if (this.scale < 1.0)
            opacity *= this.scale;
        let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.0, transparent: true, opacity: opacity });

        let points = [];
        let y = Math.floor(this.y0 / this.grid_height) * this.grid_height;
        while (y < this.y1) {
            points.push(new THREE.Vector3(this.x0, y))
            points.push(new THREE.Vector3(this.x1, y))
            y += this.grid_height;
        }
        let x = Math.floor(this.x0 / this.grid_width) * this.grid_width - this.grid_width * 0.5;
        while (x < this.x1) {
            points.push(new THREE.Vector3(x, this.y0))
            points.push(new THREE.Vector3(x, this.y1))
            x += this.grid_width;
        }
        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        // geometry.translate(0.5, 0.5, 0);
        let line = new THREE.LineSegments(geometry, material);
        this.grid_group.add(line);
    }

    refresh() {
        this.scene.remove.apply(this.scene, this.scene.children);

        this.refresh_grid();
        // // remove all elements in the scene
        // this.scene.remove.apply(this.scene, this.scene.children);
        // if (game === null) return;

        // re-create all sprite sheets
        this.sheets = [];
        // this.sprite_for_pos = {};
        for (let si = 0; si < this.game.data.sprites.length; si++) {
            let fi = Math.floor(this.game.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let frame = this.game.data.sprites[si].states[0].frames[fi];
            let info = { width: this.game.data.sprites[si].width, height: this.game.data.sprites[si].height, sprites: { sprite: { x: 0, y: 0, width: this.game.data.sprites[si].width, height: this.game.data.sprites[si].height } } };
            let sheet = new SpriteSheet(this.texture_loader, frame.src, info);
            this.sheets.push(sheet);
        }

        for (let li = 0; li < this.game.data.levels[this.level_index].layers.length; li++) {
            if (li < this.layer_structs.length) {
                this.layer_structs[li].group.renderOrder = -li;
                if (this.game.data.levels[this.level_index].layers[li].properties.visible) {
                    this.scene.add(this.layer_structs[li].group);
                }
            }
        }
        this.scene.add(this.grid_group);
        this.scene.add(this.cursor_group);
        this.scene.add(this.rect_group);
    }
}


class LayerStruct {
    /*
    layer: only one sprite per position allowed
    */
    constructor(level_editor) {
        this.level_editor = level_editor;
        this.group = new THREE.Group();
        this.sprite_for_pos = {};
    }

    apply_layer(layer) {
    }

    remove_sprite(p) {
        let pos = `${p[0]}/${p[1]}`;
    }

    add_sprite(p, sprite_index) {
        let pos = `${p[0]}/${p[1]}`;
        if (this.sprite_for_pos[pos] !== sprite_index) {
            this.remove_sprite(p);
            this.level_editor.sheets[sprite_index].add_sprite_to_group(this.group, 'sprite', p[0], p[1]);
            // add_sprite_to_scene(this.scene, 'sprite', p[0], p[1]);
        }
    }
}

class LevelEditor {
    constructor(element, game) {
        let self = this;
        this.element = element;
        $(this.element).empty();
        this.game = game;
        this.level_index = 0;
        this.layer_index = 0;
        this.clock = new THREE.Clock(true);
        this.scene = new THREE.Scene();
        this.grid_group = new THREE.Group();
        this.cursor_group = new THREE.Group();
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
        this.sprite_for_pos = {};
        $(this.element).append(this.renderer.domElement);

        this.texture_loader = new THREE.TextureLoader();
        this.refresh();

        // let material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        // let points = [];
        // points.push(new THREE.Vector3(0, 10, 2));
        // points.push(new THREE.Vector3(0, 0, 2));
        // points.push(new THREE.Vector3(10, 0, 2));
        // let geometry = new THREE.BufferGeometry().setFromPoints(points);
        // let line = new THREE.Line(geometry, material);
        // this.scene.add(line);

        this.render();

        $(this.element).mousemove(function (e) {
            let p = self.ui_to_world(e.offsetX, e.offsetY, true);
            self.cursor_group.remove.apply(self.cursor_group, self.cursor_group.children);
            self.sheets[self.sprite_index].add_sprite_to_group(self.cursor_group, 'sprite', 0, 0);
            self.cursor_group.position.x = p[0];
            self.cursor_group.position.y = p[1];
            self.cursor_group.visible = true;
            if (self.mouse_down)
                self.add_sprite_to_level(p);
            self.render();
        });
        $(this.element).mouseleave(function (e) {
            self.cursor_group.visible = false;
            self.render();
        });
        $(this.element).on('contextmenu', function (e) {
            return false;
        });
        $(this.element).mousedown(function (e) {
            e.preventDefault();
            e.stopPropagation();
            self.mouse_down = true;
            let p = self.ui_to_world(e.offsetX, e.offsetY, true);
            if (e.button === 0)
                self.add_sprite_to_level(p);
            if (e.button === 2)
                self.remove_sprite_from_level(p);
            self.render();
        });
        $(this.element).mouseup(function (e) {
            self.mouse_down = false;
            self.render();
        });
        $(this.element).on('mousewheel', function (e) {
            e.preventDefault();
            let p = self.ui_to_world(e.originalEvent.offsetX, e.originalEvent.offsetY, false);
            self.zoom_at_point(e.originalEvent.deltaY, p[0], p[1]);
            self.render();
        });

        for (let layer of self.game.data.levels[self.level_index].layers) {
            let layer_struct = new LayerStruct(self);
            layer_struct.apply_layer(layer);
            this.layer_structs.push(layer_struct);
        }

        new DragAndDropWidget({
            game: self.game,
            container: $('#menu_levels'),
            trash: $('#trash'),
            items: self.game.data.levels,
            item_class: 'menu_layer_item',
            gen_item: (state) => {
                let level_div = $(`<div>`);
                return level_div;
            },
            onclick: (e, index) => {
                $(e).closest('.menu_layer_item').parent().parent().find('.menu_layer_item').removeClass('active');
                $(e).parent().addClass('active');
                this.level_index = index;
            },
            gen_new_item: () => {
                let level = {layers: [{ sprites: [] }]};
                self.game.data.levels.push(level);
                return levevl;
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

        new DragAndDropWidget({
            game: self.game,
            container: $('#menu_layers'),
            trash: $('#trash'),
            items: self.game.data.levels[self.level_index].layers,
            item_class: 'menu_layer_item',
            gen_item: (state) => {
                let layer_div = $(`<div>`);
                let button_show = $(`<div class='toggle'>`).append($(`<i class='fa fa-eye'>`));
                layer_div.append(button_show);
                layer_div.append($(`<span style='margin-left: 0.5em;'>`).text('0 Sprites'));
                return layer_div;
            },
            onclick: (e, index) => {
                $(e).closest('.menu_layer_item').parent().parent().find('.menu_layer_item').removeClass('active');
                $(e).parent().addClass('active');
                this.layer_index = index;
            },
            gen_new_item: () => {
                let layer = { sprites: [] };
                self.game.data.levels[self.level_index].layers.push(layer);
                let layer_struct = new LayerStruct(self);
                this.layer_structs.push(layer_struct);
                return layer;
            },
            delete_item: (index) => {
                self.game.data.levels[self.level_index].layers.splice(index, 1);
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

    }

    remove_sprite_from_level(p) {
        let pos = `${p[0]}/${p[1]}`;
        if (pos in this.sprite_for_pos) {
            console.log(`removing at ${pos}`);
            // this.scene.remove(this.sprite_for_pos[pos]);
            // delete game.data.levels[this.level_index].layers[this.layer_index].sprites[pos];
            // delete this.sprite_for_pos[pos];
        }
    }

    add_sprite_to_level(p) {
        this.remove_sprite_from_level(p);
        let pos = `${p[0]}/${p[1]}`;
        let mesh = new THREE.Mesh(this.game.geometry_for_sprite[this.sprite_index], this.game.material_for_sprite[this.sprite_index]);
        mesh.position.x = p[0];
        mesh.position.y = p[1];
        this.layer_structs[this.layer_index].group.add(mesh);
        // this.layer_structs[this.layer_index].add_sprite(p, this.sprite_index);
        this.render();
        // game.data.levels[this.level_index].layers[this.layer_index].sprites[pos] = this.sprite_index;
        // this.sprite_for_pos[pos] = this.sheets[this.sprite_index].add_sprite_to_scene(this.scene, 'sprite', p[0], p[1]);
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
            wx = Math.floor((wx + 12) / 24) * 24;
            wy = Math.floor((wy) / 24) * 24;
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
        let grid_size_x = 24;
        let grid_size_y = 24;
        let y = Math.floor(this.y0 / grid_size_y) * grid_size_y;
        while (y < this.y1) {
            points.push(new THREE.Vector3(this.x0, y))
            points.push(new THREE.Vector3(this.x1, y))
            y += grid_size_y;
        }
        let x = Math.floor(this.x0 / grid_size_x) * grid_size_x - grid_size_x * 0.5;
        while (x < this.x1) {
            points.push(new THREE.Vector3(x, this.y0))
            points.push(new THREE.Vector3(x, this.y1))
            x += grid_size_x;
        }
        let geometry = new THREE.BufferGeometry().setFromPoints(points);
        // geometry.translate(0.5, 0.5, 0);
        let line = new THREE.LineSegments(geometry, material);
        this.grid_group.add(line);
    }

    refresh() {
        // this.scene.remove.apply(this.scene, this.scene.children);

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

        for (let struct of this.layer_structs)
            this.scene.add(struct.group);
        this.scene.add(this.grid_group);
        this.scene.add(this.cursor_group);

        // // remove sprite from scene: this.scene.remove(sprite);
        // // move sprite in scene: sprite.position.y = -24;
        // for (let li = game.data.levels[this.level_index].layers.length - 1; li >= 0; li--) {
        //     for (let pos in game.data.levels[this.level_index].layers[li].sprites) {
        //         let parts = pos.split('/');
        //         let x = parseInt(parts[0]);
        //         let y = parseInt(parts[1]);
        //         let sprite_index = game.data.levels[this.level_index].layers[li].sprites[pos];
        //         this.sprite_for_pos[pos] = this.sheets[sprite_index].add_sprite_to_scene(this.scene, 'sprite', x, y);
        //     }
        // }
    }
}


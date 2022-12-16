class LevelEditor {
    constructor(element) {
        let self = this;
        this.element = element;
        this.level_index = 0;
        this.layer_index = 0;
        this.clock = new THREE.Clock(true);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
        this.camera.position.x = 0;
        this.camera.position.z = 10;
        this.camera.position.y = 0;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor("#000");
        this.camera_x = 0.0;
        this.camera_y = 0.0;
        this.scale = 3.0;
        this.sheets = [];
        this.cursor = null;
        this.sprite_index = 0;
        this.width = $(this.element).width();
        this.height = $(this.element).height()
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

        $(this.element).mousemove(function(e) {
            let p = self.ui_to_world(e.offsetX, e.offsetY, true);
            if (self.cursor === null) {
                self.cursor = self.sheets[level_editor.sprite_index].add_sprite_to_scene(self.scene, 'sprite', 0, 0);
            }
            self.cursor.position.x = p[0];
            self.cursor.position.y = p[1];
            if (self.mouse_down)
                self.add_sprite_to_level(p);
            self.render();
        });
        $(this.element).mouseleave(function(e) {
            if (self.cursor !== null) {
                self.scene.remove(self.cursor);
                self.cursor = null;
            }
            self.render();
        });
        $(this.element).on('contextmenu', function(e) {
            return false;
        });
        $(this.element).mousedown(function(e) {
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
        $(this.element).mouseup(function(e) {
            self.mouse_down = false;
            self.render();
        });
        $(this.element).on('mousewheel', function(e) {
            e.preventDefault();
            let p = self.ui_to_world(e.originalEvent.offsetX, e.originalEvent.offsetY, false);
            console.log(p);
            self.zoom_at_point(e.originalEvent.deltaY, p[0], p[1]);
            self.render();
        });

        new DragAndDropWidget({
            game: self.game,
            container: $('#menu_layers'),
            trash: $('#trash'),
            items: game.data.levels[self.level_index].layers,
            item_class: 'menu_layer_item',
            gen_item: (state) => {
                let layer_div = $(`<div>`);
                // layer_div.append($(`<div class='state_label'>`).text(state.label));
                return layer_div;
            },
            onclick: (e, index) => {
                $(e).closest('.menu_layer_item').parent().parent().find('.menu_layer_item').removeClass('active');
                $(e).parent().addClass('active');
                this.layer_index = index;
            },
            gen_new_item: () => {
                let layer = { sprites: [] };
                game.data.levels[self.level_index].layers.push(layer);
                return layer;
            },
            delete_item: (index) => {
                game.data.levels[self.level_index].layers.splice(index, 1);
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
            this.scene.remove(this.sprite_for_pos[pos]);
            delete game.data.levels[this.level_index].layers[0].sprites[pos];
            delete this.sprite_for_pos[pos];
        }
    }

    add_sprite_to_level(p) {
        this.remove_sprite_from_level(p);
        let pos = `${p[0]}/${p[1]}`;
        game.data.levels[this.level_index].layers[0].sprites[pos] = this.sprite_index;
        this.sprite_for_pos[pos] = this.sheets[level_editor.sprite_index].add_sprite_to_scene(this.scene, 'sprite', p[0], p[1]);
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
        // this.handleResize();
    }

    ui_to_world(x, y, snap) {
        let wx = (x - (this.width / 2)) / this.scale;
        let wy = -(y - (this.height / 2)) / this.scale;
        if (snap) {
            wx = Math.floor((wx + 12) / 24) * 24;
            wy = Math.floor((wy) / 24) * 24;
        }
        return [wx, wy];
    }

    handleResize() {
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        this.render();
    }

    render() {
        // requestAnimationFrame((t) => this.render());
        this.camera.left = (-this.width / 2 + this.camera_x) / this.scale;
        this.camera.right = (this.width / 2 + this.camera_x) / this.scale;
        this.camera.top = (this.height / 2 + this.camera_y) / this.scale;
        this.camera.bottom = (-this.height / 2 + this.camera_y) / this.scale;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.renderer.render(this.scene, this.camera);
    }

    refresh() {
        // remove all elements in the scene
        this.scene.remove.apply(this.scene, this.scene.children);
        if (game === null) return;

        this.sheets = [];
        this.sprite_for_pos = {};

        for (let si = 0; si < game.data.sprites.length; si++) {
            let fi = Math.floor(game.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let frame = game.data.sprites[si].states[0].frames[fi];
            let src = frame.src;
            let info = {width: game.data.sprites[si].width, height: game.data.sprites[si].height, sprites: { sprite: { x: 0, y: 0, width: game.data.sprites[si].width, height: game.data.sprites[si].height}}};
            let sheet = new SpriteSheet(this.texture_loader, frame.src, info);
            this.sheets.push(sheet);
        }

        // remove sprite from scene: this.scene.remove(sprite);
        // move sprite in scene: sprite.position.y = -24;
        for (let pos in game.data.levels[this.level_index].layers[0].sprites) {
            let parts = pos.split('/');
            let x = parseInt(parts[0]);
            let y = parseInt(parts[1]);
            let sprite_index = game.data.levels[this.level_index].layers[0].sprites[pos];
            this.sprite_for_pos[pos] = this.sheets[sprite_index].add_sprite_to_scene(this.scene, 'sprite', x, y);
        }
    }
}


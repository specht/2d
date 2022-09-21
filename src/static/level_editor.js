class SpriteSheet {
    constructor(texture_loader, path, info) {
        this.info = info;
        this.spritesheet = texture_loader.load(path);
        this.spritesheet.magFilter = THREE.NearestFilter;
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                texture1: { value: this.spritesheet },
            },
            transparent: true,
            vertexShader: document.getElementById('vertex-shader').textContent,
            fragmentShader: document.getElementById('fragment-shader').textContent
        });
    };

    add_sprite_to_scene(scene, id, x, y) {
        let skin = this.info.sprites[id];
        if (!skin.pivot) skin.pivot = [skin.width / 2, skin.height];
        if (!skin.hitbox) skin.hitbox = [[0, 0], [0, skin.height], [skin.width, skin.height], [skin.width, 0]];
        let sx = skin.x;
        let sy = skin.y;
        let sw = skin.width;
        let sh = skin.height;
        x += sw/2;
        y -= sh/2;
        x -= (skin.pivot)[0];
        y += (skin.pivot)[1];
        let geometry = new THREE.PlaneGeometry(sw, sh, 1, 1);
        let uvs = geometry.attributes.uv;
        let p = 0.05;
        let x0 = (sx + p) / this.info.width;
        let x1 = (sx + sw - p) / this.info.width;
        let y0 = (sy + p) / this.info.height;
        let y1 = (sy + sh - p) / this.info.height;
        uvs.setXY(0, x0, 1 - y0);
        uvs.setXY(1, x1, 1 - y0);
        uvs.setXY(2, x0, 1 - y1);
        uvs.setXY(3, x1, 1 - y1);
        let sprite = new THREE.Mesh(geometry, this.material);
        sprite.position.x = x;
        sprite.position.y = y;
        let group = new THREE.Group();
        group.add(sprite);
        if (true) {
            let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5, transparent: true, opacity: 0.3 });
            let points = [];
            for (let p of (skin.hitbox || [])) {
                let px = p[0] - sw / 2 + x;
                let py = sh - p[1] - sh / 2 + y;
                points.push(new THREE.Vector3(px, py, 1));
            }
            let geometry = new THREE.BufferGeometry().setFromPoints(points);
            let line = new THREE.LineLoop(geometry, material);
            group.add(line);
            // if (skin.pivot) {
            //     let material = new THREE.LineBasicMaterial({ color: 0xff0000 });
            //     points = [];
            //     let px = skin.pivot[0] - sw / 2 + x;
            //     let py = sh - skin.pivot[1] - sh / 2 + y;
            //     points.push(new THREE.Vector3(px - 1, py - 1, 1));
            //     points.push(new THREE.Vector3(px + 1, py + 1, 1));
            //     geometry = new THREE.BufferGeometry().setFromPoints(points);
            //     line = new THREE.Line(geometry, material);
            //     group.add(line);
            //     points = [];
            //     points.push(new THREE.Vector3(px + 1, py - 1, 1));
            //     points.push(new THREE.Vector3(px - 1, py + 1, 1));
            //     geometry = new THREE.BufferGeometry().setFromPoints(points);
            //     line = new THREE.Line(geometry, material);
            //     group.add(line);
            // }
        }
        scene.add(group);
        return group;
    }
};

class LevelEditor {
    constructor(element) {
        this.element = element;
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
        this.level_index = 0;
        this.sheets = [];
        this.cursor = null;
        this.sprite_index = 0;
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        this.visible_pixels = this.height / this.scale;
        this.mouse_down = false;
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

        let self = this;
        $(this.element).mousemove(function(e) {
            let p = self.ui_to_world(e.offsetX, e.offsetY);
            if (self.cursor === null) {
                self.cursor = self.sheets[level_editor.sprite_index].add_sprite_to_scene(self.scene, 'sprite', 0, 0);
            }
            self.cursor.position.x = p[0];
            self.cursor.position.y = p[1];
            if (self.mouse_down)
                self.add_sprite_to_level(p);
        });
        $(this.element).mouseleave(function(e) {
            if (self.cursor !== null) {
                self.scene.remove(self.cursor);
                self.cursor = null;
            }
        });
        $(this.element).mousedown(function(e) {
            self.mouse_down = true;
            let p = self.ui_to_world(e.offsetX, e.offsetY);
            self.add_sprite_to_level(p);
        });
        $(this.element).mouseup(function(e) {
            self.mouse_down = false;
        });
        $(this.element).on('mousewheel', function(e) {
            e.preventDefault();
            let cx = e.clientX - self.element.position().left;
            let cy = e.clientY - self.element.position().top;
            self.zoom_at_point(e.originalEvent.deltaY, cx, cy);
        });
    }

    add_sprite_to_level(p) {
        game.data.levels[this.level_index].push({i: this.sprite_index, x: 0, y: 0});
        this.sheets[level_editor.sprite_index].add_sprite_to_scene(this.scene, 'sprite', 0, 0);
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
        let sx = (cx - this.camera_x) / this.scale;
        let sy = (cy - this.camera_y) / this.scale;
        this.visible_pixels *= (1 + delta * 0.001);
        this.fix_scale();
        // this.camera_x = cx - sx * this.scale;
        // this.camera_y = cy - sy * this.scale;
        // this.handleResize();
    }

    ui_to_world(x, y) {
        let wx = (x - (this.width / 2)) / this.scale;
        let wy = -(y - (this.height / 2)) / this.scale;
        wx = Math.floor(wx / 24) * 24;
        wy = Math.floor(wy / 24) * 24;
        return [wx, wy];
    }

    handleResize() {
        this.width = $(this.element).width();
        this.height = $(this.element).height()
        this.render();
    }

    render() {
        requestAnimationFrame((t) => this.render());
        this.camera.left = (-this.width / 2 + this.camera_x) / this.scale;
        this.camera.right = (this.width / 2 + this.camera_x) / this.scale;
        this.camera.top = (this.height / 2 + this.camera_y) / this.scale;
        this.camera.bottom = (-this.height / 2 + this.camera_y) / this.scale;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);

        this.renderer.render(this.scene, this.camera);
    }

    refresh() {
        this.scene.remove.apply(this.scene, this.scene.children);
        if (game === null) return;

        this.sheets = [];

        for (let si = 0; si < game.data.sprites.length; si++) {
            let fi = Math.floor(game.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let frame = game.data.sprites[si].states[0].frames[fi];
            let src = frame.src;
            let info = {width: frame.width, height: frame.height, sprites: { sprite: { x: 0, y: 0, width: frame.width, height: frame.height}}};
            let sheet = new SpriteSheet(this.texture_loader, frame.src, info);
            this.sheets.push(sheet);
        }

        for (let i = 0; i < (((game.data.levels || [])[this.level_index]) || []).length; i++) {
            let tile = game.data.levels[this.level_index][i];
            let sprite = this.sheets[tile.i].add_sprite_to_scene(this.scene, 'sprite', tile.x, tile.y);
            // if (i === 0)
                // this.scene.remove(sprite);
                // sprite.position.y = -24;
        }
    }
}

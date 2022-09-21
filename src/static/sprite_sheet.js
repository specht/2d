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


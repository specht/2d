class Game {
    constructor() {
        this.data = null;
        this.level_editor = null;
        this.texture_loader = new THREE.TextureLoader();
        this.geometry_for_sprite = [];
        this.material_for_sprite = [];
        this.reset();
    }

    reset() {
        this.data = {};
        this.fix_game_data();
        this._load();
    }

    load(tag) {
        console.log(`Loading game: ${tag}`);
        let self = this;

        api_call('/api/load_game', { tag: tag }, function (data) {
            if (data.success) {
                console.log(data);
                self.data = data.game;
                self.data.parent = tag;
                self._load();
            }
        });
    }

    save() {
        this.data.palette = palettes[selected_palette_index].colors;
        let self = this;
        api_call('/api/save_game', { game: this.data }, function (data) {
            if (data.success) {
                if (data.tag !== self.data.parent) {
                    self.data.parent = data.tag;
                }
                $('#save_notification img').attr('src', `noto/${data.icon}.png`);
                $('#save_notification').addClass('showing');
                setTimeout(() => { $('#save_notification').removeClass('showing'); }, 3000);
                // window.location.href = `/?${data.tag}`;
            }
        });
    }

    fix_game_data() {
        // console.log(`Fixing game data / before:`, JSON.stringify(this.data));
        this.data ??= {};
        this.data.parent ??= null;
        this.data.sprites ??= [];
        if (this.data.sprites.length === 0) {
            this.data.sprites.push({
                width: DEFAULT_WIDTH,
                height: DEFAULT_HEIGHT,
                states: [],
            });
        }
        for (let si = 0; si < this.data.sprites.length; si++) {
            this.data.sprites[si].width ??= DEFAULT_WIDTH;
            this.data.sprites[si].height ??= DEFAULT_HEIGHT;
            this.data.sprites[si].properties ??= {};
            this.data.sprites[si].properties.name ??= '';
            this.data.sprites[si].properties.classes ??= [];
            this.data.sprites[si].properties.hitboxes ??= {};
            this.data.sprites[si].states ??= [];
            if (this.data.sprites[si].states.length === 0) {
                this.data.sprites[si].states.push({});
            }
            for (let sti = 0; sti < this.data.sprites[si].states.length; sti++) {
                this.data.sprites[si].states[sti].properties ??= {};
                this.data.sprites[si].states[sti].properties.name ??= '';
                this.data.sprites[si].states[sti].properties.hitboxes ??= {};
                this.data.sprites[si].states[sti].properties.fps ??= 8;
                this.data.sprites[si].states[sti].frames ??= [];
                if (this.data.sprites[si].states[sti].frames.length === 0)
                    this.data.sprites[si].states[sti].frames.push({});
                for (let fi = 0; fi < this.data.sprites[si].states[sti].frames.length; fi++) {
                    this.data.sprites[si].states[sti].frames[fi].properties ??= {};
                    this.data.sprites[si].states[sti].frames[fi].properties.hitboxes ??= {};
                    this.data.sprites[si].states[sti].frames[fi].src ??= createDataUrlForImageSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
                }
            }
        }
        this.data.levels ??= [];
        if (this.data.levels.length === 0)
            this.data.levels.push({});
        for (let li = 0; li < this.data.levels.length; li++) {
            this.data.levels[li].properties ??= {};
            this.data.levels[li].properties.name ??= '';
            this.data.levels[li].layers ??= [];
            if (this.data.levels[li].layers.length === 0)
                this.data.levels[li].layers.push({});
            for (let lyi = 0; lyi < this.data.levels[li].layers.length; lyi++) {
                this.data.levels[li].layers[lyi].properties ??= {};
                this.data.levels[li].layers[lyi].properties.visible ??= true;
                this.data.levels[li].layers[lyi].sprites ??= [];
                if (!Array.isArray(this.data.levels[li].layers[lyi].sprites))
                    this.data.levels[li].layers[lyi].sprites = [];
                this.data.levels[li].layers[lyi].sprite_properties ??= {};
            }
        }
        for (let si = 0; si < this.data.sprites.length; si++) {
            if (typeof(this.data.sprites[si].width) === 'undefined') {
                this.data.sprites[si].width = this.data.sprites[si].states[0].frames[0].width;
                this.data.sprites[si].height = this.data.sprites[si].states[0].frames[0].height;
                for (let sti = 0; sti < this.data.sprites[si].states.length; sti++) {
                    for (let fi = 0; fi < this.data.sprites[si].states[sti].frames.length; fi++) {
                        delete this.data.sprites[si].states[sti].frames[fi].width;
                        delete this.data.sprites[si].states[sti].frames[fi].height;
                    }
                }
            }
        }
        // console.log(`Fixing game data / after:`, JSON.stringify(this.data));
    }

    create_geometry_and_material_for_sprite(si) {
        this.geometry_for_sprite[si] = new THREE.PlaneGeometry(1, 1, 1, 1);
        let m = this.geometry_for_sprite[si].getAttribute('position');
        this.material_for_sprite[si] = new THREE.ShaderMaterial({
            uniforms: {
                texture1: { value: null },
            },
            transparent: true,
            vertexShader: document.getElementById('vertex-shader').textContent,
            fragmentShader: document.getElementById('fragment-shader').textContent,
            side: THREE.DoubleSide,
        });
        this.update_geometry_for_sprite(si);
        this.update_material_for_sprite(si);
    }

    update_geometry_for_sprite(si) {
        if (this.geometry_for_sprite[si]) {
            const m = new Float32Array([-0.5, 0.5, 0.0, 0.5, 0.5, 0.0, -0.5, -0.5, 0.0, 0.5, -0.5, 0.0]);
            this.geometry_for_sprite[si].setAttribute('position', new THREE.BufferAttribute(m, 3));
            this.geometry_for_sprite[si].scale(this.data.sprites[si].width, this.data.sprites[si].height, 1.0);
            this.geometry_for_sprite[si].translate(0, this.data.sprites[si].height / 2, 0.0);
        }
    }

    update_material_for_sprite(si) {
        if (this.material_for_sprite[si]) {
            let fi = Math.floor(this.data.sprites[si].states[0].frames.length / 2 - 0.5);
            let frame = this.data.sprites[si].states[0].frames[fi];
            let texture = this.texture_loader.load(frame.src);
            texture.magFilter = THREE.NearestFilter;
            this.material_for_sprite[si].uniforms.texture1.value = texture;
        }
    }

    _load() {
        canvas.setGame(this);
        let self = this;
        this.fix_game_data();
        for (let si = 0; si < this.data.sprites.length; si++) {
            let sprite_info = this.data.sprites[si];
            for (let sti = 0; sti < sprite_info.states.length; sti++) {
                let state_info = sprite_info.states[sti];
                for (let fi = 0; fi < state_info.frames.length; fi++) {
                    let frame_info = state_info.frames[fi];
                    let frame = {};
                    frame.src = frame_info.src;
                    this.data.sprites[si].states[sti].frames[fi] = frame;
                }
            }
            this.create_geometry_and_material_for_sprite(si);
            this.update_material_for_sprite(si);
        }
        // console.log('init -->', JSON.stringify(this.data.sprites[0]));
        if (this.data.palette) {
            update_color_palette_with_colors(this.data.palette);
        } else {
            window.selected_palette_index = 9;
            update_color_palette();
        }
        // if (this.palette)
        // update_color_palette_with_colors()

        new DragAndDropWidget({
            game: this,
            container: $('#menu_sprites'),
            trash: $('#trash'),
            items: this.data.sprites,
            item_class: 'menu_sprite_item',
            onclick: (e, index) => {
                canvas.attachSprite(index, 0, 0, function() {
                    $(e).closest('.menu_sprite_item').parent().parent().find('.menu_sprite_item').removeClass('active');
                    $(e).parent().addClass('active');
                });
            },
            gen_item: (sprite, index) => {
                let img = $('<img>');
                img.attr('src', sprite.states[0].frames[0].src);
                return img;
            },
            gen_new_item: () => {
                self.data.sprites.push({});
                self.fix_game_data();
                self.create_geometry_and_material_for_sprite(self.data.sprites.length - 1);
                return self.data.sprites[self.data.sprites.length - 1];
            },
            delete_item: (index) => {
                canvas.detachSprite();
                self.data.sprites.splice(index, 1);
                this.refresh_frames_on_screen();
            },
            on_swap_items: (a, b) => {
                if (a > b) {
                    let temp = self.data.sprites[b];
                    for (let i = b; i < a; i++)
                        self.data.sprites[i] = self.data.sprites[i + 1];
                    self.data.sprites[a] = temp;
                } else if (a < b) {
                    let temp = self.data.sprites[b];
                    for (let i = b; i > a; i--)
                        self.data.sprites[i] = self.data.sprites[i - 1];
                    self.data.sprites[a] = temp;
                }
                this.refresh_frames_on_screen();
            }
        });

        this.level_editor = new LevelEditor($('#level'), this);
    }

    refresh_frames_on_screen() {
        for (let si = 0; si < this.data.sprites.length; si++) {
            let fi = Math.floor(this.data.sprites[si].states[0].frames.length / 2 - 0.5);
            $('#menu_sprites ._dnd_item img').eq(si).attr('src', this.data.sprites[si].states[0].frames[fi].src);
        }
        if (canvas.sprite_index !== null) {
            for (let sti = 0; sti < this.data.sprites[canvas.sprite_index].states.length; sti++) {
                let fi = Math.floor(this.data.sprites[canvas.sprite_index].states[sti].frames.length / 2 - 0.5);
                $('#menu_states ._dnd_item img').eq(sti).attr('src', this.data.sprites[canvas.sprite_index].states[sti].frames[fi].src);
            }
            if (canvas.state_index !== null) {
                for (let fi = 0; fi < this.data.sprites[canvas.sprite_index].states[canvas.state_index].frames.length; fi++) {
                    $('#menu_frames ._dnd_item img').eq(fi).attr('src', this.data.sprites[canvas.sprite_index].states[canvas.state_index].frames[fi].src);
                }
            }
        }
    }
}

class Game {
    constructor() {
        this.data = null;
        this.level_editor = null;
        this.texture_loader = new THREE.TextureLoader();
        this.geometry_for_sprite = [];
        this.material_for_sprite = [];
        this.currently_saving = false;
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
        if (this.currently_saving) return;
        this.currently_saving = true;
        this.data.palette = palettes[selected_palette_index].colors;
        let self = this;
        api_call('/api/save_game', { game: this.data }, function (data) {
            if (data.success) {
                if (data.tag !== self.data.parent) {
                    self.data.parent = data.tag;
                }
                $('#save_notification img').attr('src', `noto/${data.icon}.png`);
                $('#save_notification').addClass('showing');
                setTimeout(() => {
                    $('#save_notification').removeClass('showing');
                    self.currently_saving = false;
                }, 3000);
                // window.location.href = `/?${data.tag}`;
            } else {
                self.currently_saving = false;
            }
        });
    }

    fix_game_data() {
        // console.log(`Fixing game data / before:`, JSON.stringify(this.data));
        this.data ??= {};
        this.data.properties ??= {};
        this.data.properties.title ??= '';
        this.data.properties.author ??= '';
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
            // this.data.sprites[si].properties ??= {};
            // this.data.sprites[si].properties.name ??= '';
            // this.data.sprites[si].properties.classes ??= [];
            // this.data.sprites[si].properties.hitboxes ??= {};
            this.data.sprites[si].traits ??= {};
            for (let trait of Object.keys(this.data.sprites[si].traits)) {
                let info = TRAITS[trait] ?? {};
                for (let key in info.properties ?? {}) {
                    let property = info.properties[key];
                    this.data.sprites[si].traits[trait][key] ??= property.default;
                }
            }
            this.data.sprites[si].states ??= [];
            if (this.data.sprites[si].states.length === 0) {
                this.data.sprites[si].states.push({});
            }
            for (let sti = 0; sti < this.data.sprites[si].states.length; sti++) {
                this.data.sprites[si].states[sti].properties ??= {};
                this.data.sprites[si].states[sti].properties.name ??= '';
                // this.data.sprites[si].states[sti].properties.hitboxes ??= {};
                // this.data.sprites[si].states[sti].properties.fps ??= 8;
                this.data.sprites[si].states[sti].frames ??= [];
                if (this.data.sprites[si].states[sti].frames.length === 0)
                    this.data.sprites[si].states[sti].frames.push({});
                for (let fi = 0; fi < this.data.sprites[si].states[sti].frames.length; fi++) {
                    // this.data.sprites[si].states[sti].frames[fi].properties ??= {};
                    // this.data.sprites[si].states[sti].frames[fi].properties.hitboxes ??= {};
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
            this.data.levels[li].properties.use_level ??= true;
            this.data.levels[li].properties.background_color ??= '#000000';
            this.data.levels[li].layers ??= [];
            if (this.data.levels[li].layers.length === 0)
                this.data.levels[li].layers.push({});
            for (let lyi = 0; lyi < this.data.levels[li].layers.length; lyi++) {
                this.data.levels[li].layers[lyi].type ??= 'sprites';
                this.data.levels[li].layers[lyi].properties ??= {};
                this.data.levels[li].layers[lyi].properties.name ??= '';
                this.data.levels[li].layers[lyi].properties.visible ??= true;
                this.data.levels[li].layers[lyi].properties.parallax ??= 0.0;
                this.data.levels[li].layers[lyi].properties.opacity ??= 1.0;
                if (this.data.levels[li].layers[lyi].type === 'sprites') {
                    this.data.levels[li].layers[lyi].properties.collision_detection ??= true;
                    this.data.levels[li].layers[lyi].sprites ??= [];
                    if (!Array.isArray(this.data.levels[li].layers[lyi].sprites))
                        this.data.levels[li].layers[lyi].sprites = [];
                    this.data.levels[li].layers[lyi].sprite_properties ??= {};
                } else if (this.data.levels[li].layers[lyi].type === 'backdrop') {
                    this.data.levels[li].layers[lyi].colors ??= [['#143b86', 0.5, 0.9], ['#c3def1', 0.5, 0.1]];
                    this.data.levels[li].layers[lyi].top ??= 0;
                    this.data.levels[li].layers[lyi].bottom ??= 0;
                    this.data.levels[li].layers[lyi].width ??= 100;
                    this.data.levels[li].layers[lyi].height ??= 100;
                }
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
            step_aside_css: { left: '68px', top: '0px' },
            step_aside_css_mod: { left: '-136px', top: '53px'},
            step_aside_css_mod_n: 3,
            onclick: (e, index) => {
                canvas.attachSprite(index, 0, 0, function() {
                    // $(e).closest('.menu_sprite_item').parent().parent().find('.menu_sprite_item').removeClass('active');
                    // $(e).parent().addClass('active');
                });
                self.build_traits_menu();
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
                let tr = delete_item_helper(self.data.sprites, index);
                console.log(tr);
                for (let levels of self.data.levels) {
                    for (let layer of levels.layers) {
                        if (layer.type === 'sprites') {
                            let temp = [];
                            // remove deleted sprite in all level layers
                            for (let psi = 0; psi < layer.sprites.length; psi++)
                                if (layer.sprites[psi][0] !== index)
                                    temp.push(layer.sprites[psi]);
                            // translaste remaining sprites
                            for (let psi = 0; psi < temp.length; psi++)
                                temp[psi][0] = tr[temp[psi][0]];
                            // write fixed sprites back to layer
                            layer.sprites = temp;
                        }
                    }
                }
                this.refresh_frames_on_screen();
                for (let si = 0; si < self.data.sprites.length; si++)
                    this.create_geometry_and_material_for_sprite(si);
                // fix level editor
                if (self.level_editor.sprite_index >= self.data.sprites.length - 1)
                    self.level_editor.sprite_index = self.data.sprites.length - 1;
                self.level_editor.layer_structs[self.level_editor.layer_index].apply_layer(self.data.levels[self.level_editor.level_index].layers[self.level_editor.layer_index]);

            },
            on_move_item: (from, to) => {
                let tr = move_item_helper(self.data.sprites, from, to);
                for (let levels of self.data.levels) {
                    for (let layer of levels.layers) {
                        if (layer.type === 'sprites') {
                            for (let psi = 0; psi < layer.sprites.length; psi++) {
                                layer.sprites[psi][0] = tr[layer.sprites[psi][0]];
                            }
                        }
                    }
                }
                this.refresh_frames_on_screen();
                for (let si = 0; si < self.data.sprites.length; si++)
                    this.create_geometry_and_material_for_sprite(si);
            }
        });

        this.level_editor = new LevelEditor($('#level'), this);

        $('#game-settings-here').empty();
        new LineEditWidget({
            container: $('#game-settings-here'),
            label: 'Titel:',
            get: () => self.data.properties.title,
            set: (x) => {
                self.data.properties.title = x;
            },
        });
        new LineEditWidget({
            container: $('#game-settings-here'),
            label: 'Autor:',
            get: () => self.data.properties.author,
            set: (x) => {
                self.data.properties.author = x;
            },
        });
        if (typeof(this.data.parent) !== 'undefined') {
            $('#play_iframe').hide();
            if ($('#play_iframe')[0].contentWindow.game) {
                $('#play_iframe')[0].contentWindow.game.load(this.data.parent);
                $('#play_iframe').fadeIn();
                $('#play_iframe').focus();
            }
        }
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

    add_trait(trait) {
        let self = this;
        let si = canvas.sprite_index;
        // TODO: Check if this makes sense
        self.data.sprites[si].traits[trait] ??= {};
        self.fix_game_data();
    }

    remove_trait(trait) {
        let self = this;
        let si = canvas.sprite_index;
        // TODO: Check if this makes sense
        delete self.data.sprites[si].traits[trait];
        self.fix_game_data();
    }

    build_traits_menu() {
        let self = this;
        let si = canvas.sprite_index;
        $('#menu_sprite_properties').empty();
        $('#menu_sprite_properties_variable_part_following').nextAll().remove();
        let traits_menu = $('<div>').appendTo($('#menu_sprite_properties'))
        setupDropdownMenu(traits_menu, [
            {
                label: 'Eigenschaft hinzufügen',
                children: [
                    {
                        label: 'Spielfigur',
                        callback: () => {
                            self.add_trait('actor');
                            self.build_traits_menu();
                        },
                    },
                    {
                        label: 'Blöcke',
                        children: [
                            {
                                label: 'man kann nicht von oben reinfallen',
                                callback: () => {
                                    self.add_trait('block_above');
                                    self.build_traits_menu();
                                },
                            },
                            {
                                label: 'man kann nicht von der Seite reinlaufen',
                                callback: () => {
                                    self.add_trait('block_sides');
                                    self.build_traits_menu();
                                },
                            },
                        ],
                    },
                ],
            },
        ]);
        let keys = Object.keys(self.data.sprites[si].traits);
        for (let i = keys.length - 1; i >= 0; i--) {
            let trait = keys[i];
            this.add_trait_controls(trait, $('#menu_sprite_properties_variable_part_following'));
        }
    }

    add_trait_controls(trait, element) {
        let self = this;
        let si = canvas.sprite_index;
        let div = $(`<div class='menu'>`);
        let bu_delete = $(`<button class='btn'>`).append($(`<i class='fa fa-trash'>`));
        bu_delete.click(function(e) {
            self.remove_trait(trait);
            self.build_traits_menu();
        });
        let title = $(`<h4>`).append($('<span>').text(TRAITS[trait].label)).append(bu_delete).appendTo(div);
        let info = TRAITS[trait] ?? {};
        for (let key in info.properties ?? {}) {
            let property = info.properties[key];
            if (property.type === 'float') {
                new NumberWidget({
                    container: div,
                    label: property.label ?? key,
                    get: () => self.data.sprites[si].traits[trait][key],
                    set: (x) => {
                        self.data.sprites[si].traits[trait][key] = parseFloat(x);
                    },
                });
            } else if (property.type === 'bool') {
                new CheckboxWidget({
                    container: div,
                    label: property.label ?? key,
                    get: () => self.data.sprites[si].traits[trait][key],
                    set: (x) => {
                        self.data.sprites[si].traits[trait][key] = x;
                    },
                });
            }
        }
        div.insertAfter(element);
    }

}

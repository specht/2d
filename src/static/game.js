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
                $('#game_code_div').show();
                $('#game_code').text(`${tag}`);
                $('#game_link').attr('href', `https://2d.hackschule.de/play/${tag}`).text(`https://2d.hackschule.de/play/${tag}`);
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
                $('#game_code_div').show();
                $('#game_code').text(`${data.tag}`);
                $('#game_link').attr('href', `https://2d.hackschule.de/play/${data.tag}`).text(`https://2d.hackschule.de/play/${data.tag}`);
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
        this.data.properties.yt_tag ??= '';
        this.data.properties.lives_at_begin ??= 5;
        this.data.properties.max_lives ??= 5;
        this.data.properties.show_energy ??= true;
        this.data.properties.energy_at_begin ??= 100;
        this.data.properties.max_energy ??= 100;
        this.data.properties.respawn_invincible ??= 3;
        this.data.properties.screen_pixel_height ??= 240.0;
        this.data.properties.gravity ??= 0.5;
        this.data.properties.coyote_time ??= 50;
        this.data.properties.safe_zone_x ??= 0.4;
        this.data.properties.safe_zone_y ??= 0.3;
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
                let info = SPRITE_TRAITS[trait] ?? {};
                for (let key in info.properties ?? {}) {
                    let property = info.properties[key];
                    this.data.sprites[si].traits[trait][key] ??= property.default;
                }
                for (let sti = 0; sti < this.data.sprites[si].states.length; sti++) {
                    this.data.sprites[si].states[sti].traits ??= {};
                    this.data.sprites[si].states[sti].traits[trait] ??= {};
                }
            }
            this.data.sprites[si].states ??= [];
            if (this.data.sprites[si].states.length === 0) {
                this.data.sprites[si].states.push({});
            }
            for (let sti = 0; sti < this.data.sprites[si].states.length; sti++) {
                this.data.sprites[si].states[sti].properties ??= {};
                this.data.sprites[si].states[sti].properties.name ??= '';
                this.data.sprites[si].states[sti].properties.fps ??= 8;
                this.data.sprites[si].states[sti].properties.phase_x ??= 0.0;
                this.data.sprites[si].states[sti].properties.phase_y ??= 0.0;
                this.data.sprites[si].states[sti].properties.phase_r ??= 1.0;
                // this.data.sprites[si].states[sti].properties.hitboxes ??= {};
                this.data.sprites[si].states[sti].frames ??= [];
                if (this.data.sprites[si].states[sti].frames.length === 0)
                    this.data.sprites[si].states[sti].frames.push({});
                for (let fi = 0; fi < this.data.sprites[si].states[sti].frames.length; fi++) {
                    // this.data.sprites[si].states[sti].frames[fi].properties ??= {};
                    // this.data.sprites[si].states[sti].frames[fi].properties.hitboxes ??= {};
                    this.data.sprites[si].states[sti].frames[fi].src ??= createDataUrlForImageSize(this.data.sprites[si].width, this.data.sprites[si].height);
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
            this.data.levels[li].properties.yt_tag ??= '';
            // this.data.levels[li].properties.screen_pixel_height ??= '';
            this.data.levels[li].layers ??= [];
            if (this.data.levels[li].layers.length === 0)
                this.data.levels[li].layers.push({});
            this.data.levels[li].conditions ??= [];
            if (this.data.levels[li].conditions.length === 0)
                this.data.levels[li].conditions.push({ type: 'touching_level_complete' });
            for (let ci = 0; ci < this.data.levels[li].conditions.length; ci++) {
                let condition = this.data.levels[li].conditions[ci];
                condition.type ??= 'touching_level_complete';
                condition.properties ??= {};
                if (condition.type === 'min_points') {
                    condition.properties.min_points_percent ??= 100.0;
                }
            }
            for (let lyi = 0; lyi < this.data.levels[li].layers.length; lyi++) {
                this.data.levels[li].layers[lyi].type ??= 'sprites';
                this.data.levels[li].layers[lyi].properties ??= {};
                this.data.levels[li].layers[lyi].properties.name ??= '';
                this.data.levels[li].layers[lyi].properties.visible ??= true;
                this.data.levels[li].layers[lyi].properties.parallax ??= 0.0;
                this.data.levels[li].layers[lyi].properties.opacity ??= 1.0;
                this.data.levels[li].layers[lyi].rects ??= [];
                let layer = this.data.levels[li].layers[lyi];
                // promote old layer rect
                if (layer.left && layer.bottom && layer.width && layer.height) {
                    this.data.levels[li].layers[lyi].rects.push({ left: layer.left, bottom: layer.bottom, width: layer.width, height: layer.height });
                    delete this.data.levels[li].layers[lyi].left;
                    delete this.data.levels[li].layers[lyi].bottom;
                    delete this.data.levels[li].layers[lyi].width;
                    delete this.data.levels[li].layers[lyi].height;
                }
                if (this.data.levels[li].layers[lyi].type === 'sprites') {
                    this.data.levels[li].layers[lyi].properties.collision_detection ??= true;
                    this.data.levels[li].layers[lyi].sprites ??= [];
                    if (!Array.isArray(this.data.levels[li].layers[lyi].sprites))
                        this.data.levels[li].layers[lyi].sprites = [];
                    this.data.levels[li].layers[lyi].sprite_properties ??= {};
                } else if (this.data.levels[li].layers[lyi].type === 'backdrop') {
                    let lyp = this.data.levels[li].layers[lyi];
                    // this.data.levels[li].layers[lyi].rects ??= [{
                    //     left: lyp.left,
                    //     bottom: lyp.bottom,
                    //     width: lyp.width,
                    //     height: lyp.height,
                    // }];
                    // for (let ri = 0; ri < this.data.levels[li].layers[lyi].rects.length; ri++) {
                    //     this.data.levels[li].layers[lyi].rects[ri].left ??= 0;
                    //     this.data.levels[li].layers[lyi].rects[ri].bottom ??= 0;
                    //     this.data.levels[li].layers[lyi].rects[ri].width ??= 100;
                    //     this.data.levels[li].layers[lyi].rects[ri].height ??= 100;
                    // }
                    this.data.levels[li].layers[lyi].backdrop_type ??= 'color'
                    if (this.data.levels[li].layers[lyi].backdrop_type === 'color') {
                        this.data.levels[li].layers[lyi].colors ??= [['#143b86', 0.5, 0.9], ['#c3def1', 0.5, 0.1]];
                    }
                    if (this.data.levels[li].layers[lyi].backdrop_type === 'effect') {
                        this.data.levels[li].layers[lyi].effect ??= 'snow';
                        this.data.levels[li].layers[lyi].scale ??= 1.0;
                        this.data.levels[li].layers[lyi].speed ??= 1.0;
                        this.data.levels[li].layers[lyi].color ??= '#ffffffff';
                        this.data.levels[li].layers[lyi].control_points ??= [];
                    }
                }
            }
        }
        for (let si = 0; si < this.data.sprites.length; si++) {
            if (typeof (this.data.sprites[si].width) === 'undefined') {
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
            vertexShader: shaders.get('basic.vs'),
            fragmentShader: shaders.get('texture.fs'),
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
            step_aside_css_mod: { left: '-136px', top: '53px' },
            step_aside_css_mod_n: 3,
            onclick: (e, index) => {
                canvas.attachSprite(index, 0, 0, function () {
                    // $(e).closest('.menu_sprite_item').parent().parent().find('.menu_sprite_item').removeClass('active');
                    // $(e).parent().addClass('active');
                });
                self.build_sprite_traits_menu();
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
                self.remap_hit_sprite_references(tr, index);
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
                self.remap_hit_sprite_references(tr);
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

        new SeparatorWidget({
            container: $('#game-settings-here'),
            label: 'Spiel',
        });
        new LineEditWidget({
            container: $('#game-settings-here'),
            label: 'Titel:',
            hint: 'Gib deinem Spiel einen Titel, damit du es schnell wieder findest.',
            get: () => self.data.properties.title,
            set: (x) => {
                self.data.properties.title = x;
            },
        });
        new LineEditWidget({
            container: $('#game-settings-here'),
            label: 'Autor:',
            hint: 'Hier kannst du deinen Namen eintragen.',
            get: () => self.data.properties.author,
            set: (x) => {
                self.data.properties.author = x;
            },
        });
        new SeparatorWidget({
            container: $('#game-settings-here'),
            label: 'Gesundheit',
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Leben am Anfang:',
            hint: 'Dieser Wert gibt an, wie viele Leben deine Figur am Anfang des Spiels hat.',
            min: 1,
            max: 1000,
            step: 1,
            decimalPlaces: 0,
            get: () => self.data.properties.lives_at_begin,
            set: (x) => {
                self.data.properties.lives_at_begin = x;
            },
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Leben maximal:',
            hint: 'Dieser Wert gibt an, wie viele Leben deine Figur im Laufe des Spiels höchstens sammeln kann. Sind die Leben am Maximum, kann die Spielfigur keine weiteren lebensspendenen Sprites einsammeln.',
            min: 1,
            max: 1000,
            step: 1,
            decimalPlaces: 0,
            get: () => self.data.properties.max_lives,
            set: (x) => {
                self.data.properties.max_lives = x;
            },
        });
        new CheckboxWidget({
            container: $('#game-settings-here'),
            label: 'Energie anzeigen:',
            hint: 'Gib hier an, ob du die Energie während des Spiels anzeigen möchtest.',
            default: true,
            get: () => self.data.properties.show_energy,
            set: (x) => {
                self.data.properties.show_energy = x;
            },
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Energie am Anfang:',
            hint: 'So viel Energie hat deine Spielfigur am Anfang.',
            min: 1,
            max: 1000,
            step: 1,
            decimalPlaces: 0,
            get: () => self.data.properties.energy_at_begin,
            set: (x) => {
                self.data.properties.energy_at_begin = x;
            },
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Energie maximal:',
            hint: 'So viel Energie kann deine Spielfigur maximial haben.',
            min: 1,
            max: 1000,
            step: 1,
            decimalPlaces: 0,
            get: () => self.data.properties.max_energy,
            set: (x) => {
                self.data.properties.max_energy = x;
            },
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Unverwundbar nach Respawn:',
            hint: 'Gib hier an, wie lange deine Spielfigur nach einem Respawn unverwundbar sein soll.',
            min: 0,
            max: 60,
            step: 1,
            decimalPlaces: 1,
            suffix: 's',
            get: () => self.data.properties.respawn_invincible,
            set: (x) => {
                self.data.properties.respawn_invincible = x;
            },
        });
        new SeparatorWidget({
            container: $('#game-settings-here'),
            label: 'Physik',
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Gravitation:',
            hint: 'Wert für die Schwerkraft. Höherer Wert = größere Schwerkraft, Figuren fallen schneller.',
            min: 0,
            max: 100,
            step: 0.1,
            decimalPlaces: 2,
            get: () => self.data.properties.gravity,
            set: (x) => {
                self.data.properties.gravity = x;
            },
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Coyote Time:',
            hint: 'Wert für die Verzögerung beim Fallen.',
            min: 0,
            max: 1000,
            step: 1,
            decimalPlaces: 0,
            suffix: 'ms',
            get: () => self.data.properties.coyote_time,
            set: (x) => {
                self.data.properties.coyote_time = x;
            },
        });
        new SeparatorWidget({
            container: $('#game-settings-here'),
            label: 'Kamera',
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Höhe in Pixeln:',
            hint: 'So viele Pixel hoch ist der Bildausschnitt.',
            min: 16,
            max: 1080,
            get: () => self.data.properties.screen_pixel_height,
            set: (x) => {
                self.data.properties.screen_pixel_height = x;
            },
        });
        new NumberWidget({
            container: $('#game-settings-here'),
            label: 'Kamera Safe Zone (Breite &times; Höhe):',
            hint: `<p>Solange du innerhalb dieses Bereichs bleibst, bewegt sich die Kamera nicht mit, wenn du die Spielfigur bewegst. Verlässt die Figur diesen Bereich, folgt die Kamera automatisch.</p>
            <p>Kleinere Werte sorgen dafür, dass die Kamera schneller reagiert.</p>
            <p>Setze beide Werte auf 0, um die Spielfigur immer genau in der Mitte des Bildschirmes zu halten.</p>
            `,
            count: 2,
            connector: '&times;',
            min: [0.0, 0.0],
            max: [1.0, 1.0],
            step: 0.1,
            decimalPlaces: 1,
            get: () => [self.data.properties.safe_zone_x, self.data.properties.safe_zone_y],
            set: (x, y) => {
                self.data.properties.safe_zone_x = x;
                self.data.properties.safe_zone_y = y;
            },
        });
        new CheckboxWidget({
            container: $('#game-settings-here'),
            label: 'Kathodenstrahlröhre:',
            hint: `Simuliert einen alten CRT-Monitor mit Scanlines, Wölbung und Vignette für das ultimative Retro-Feedling.`,
            default: false,
            get: () => self.data.properties.crt_effect,
            set: (x) => {
                self.data.properties.crt_effect = x;
            },
        });
        new SeparatorWidget({
            container: $('#game-settings-here'),
            label: 'Musik',
        });
        new LineEditWidget({
            container: $('#game-settings-here'),
            label: 'Youtube ID:',
            hint: `<p>Gib hier die Video-ID eines Youtube-Videos ein, um eine Musik im Hintergrund des Spiels abzuspielen.</p>
            <p>Beispiel: Für das Video unter <a target='_blank' href='https://www.youtube.com/watch?v=dQw4w9WgXcQ'>https://www.youtube.com/watch?v=dQw4w9WgXcQ</a> lautet die ID <b>dQw4w9WgXcQ</b>.</p>
            `,
            get: () => self.data.properties.yt_tag,
            set: (x) => {
                self.data.properties.yt_tag = x;
            },
        });
        let div = $(`<div id='game_code_div'>`);
        $('#game-settings-here').append(div);
        new SeparatorWidget({
            container: div,
            label: 'Link zum Spiel',
        });
        div.append($(`<p>`).css('margin', '4px 6px').text("Der Code für dein Spiel lautet:"));
        let game_code = $(`<p>`).attr('id', 'game_code').attr('target', '_blank').html(``);
        div.append(game_code);
        div.append($(`<p>`).css('margin', '4px 6px').text("Wenn du dein Spiel teilen möchtest, verwende diesen Link:"));
        let game_link = $(`<a>`).attr('id', 'game_link').css('margin', '4px 6px').attr('target', '_blank').html(``);
        div.append(game_link);
        if (typeof (this.data.parent) !== 'undefined') {
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
        this.attack_sprite_picker?.refresh();
        this.hit_sprite_picker?.refresh();
        this.ranged_projectile_picker?.refresh();
        this.ranged_hit_picker?.refresh();
    }

    // Combat effect sprites use the same array indices as placed level sprites.
    // Reordering/deleting an image must update both modern and legacy attacks.
    remap_hit_sprite_references(translation, deletedIndex = null) {
        for (const sprite of this.data.sprites) {
            const attacks = [sprite.traits?.melee_attack?.attack,
                sprite.traits?.ranged_attack?.attack];
            for (const role of ['actor', 'baddie'])
                if (Array.isArray(sprite.traits?.[role]?.attacks))
                    attacks.push(...sprite.traits[role].attacks);
            for (const attack of attacks) {
                const visual = attack?.visual;
                if (!visual || typeof visual !== 'object') continue;
                for (const key of ['hit_sprite_index', 'attack_sprite_index', 'projectile_sprite_index']) {
                    if (!Number.isInteger(visual[key])) continue;
                    if (visual[key] === deletedIndex) {
                        delete visual[key];
                        continue;
                    }
                    const next = translation[visual[key]];
                    if (Number.isInteger(next) && next >= 0) visual[key] = next;
                    else delete visual[key];
                }
            }
        }
        this.attack_sprite_picker?.refresh();
        this.hit_sprite_picker?.refresh();
        this.ranged_projectile_picker?.refresh();
        this.ranged_hit_picker?.refresh();
    }

    add_sprite_trait(trait) {
        let self = this;
        let si = canvas.sprite_index;
        let traits = self.data.sprites[si].traits;
        if (trait === 'melee_attack') add_melee_trait(traits);
        else if (trait === 'ranged_attack') add_ranged_trait(traits);
        else traits[trait] ??= {};
        self.fix_game_data();
    }

    remove_sprite_trait(trait) {
        let self = this;
        let si = canvas.sprite_index;
        let traits = self.data.sprites[si].traits;
        if (trait === 'melee_attack') remove_melee_trait(traits);
        else if (trait === 'ranged_attack') remove_ranged_trait(traits);
        else delete traits[trait];
        self.fix_game_data();
    }

    build_sprite_traits_submenu(traits) {
        let self = this;
        return traits.map(function (x) {
            if (typeof (x) === 'string')
                return {
                    label: SPRITE_TRAITS[x].label,
                    callback: () => {
                        self.add_sprite_trait(x);
                        self.build_sprite_traits_menu();
                    }
                };
            let d = { label: x[0] };
            if ((!(x[0] in SPRITE_TRAITS)) && x.length > 1) {
                d.children = self.build_sprite_traits_submenu(x[1]);
            }
            return d;
        });
    }

    build_sprite_traits_menu() {
        let self = this;
        let si = canvas.sprite_index;
        this.door_state_help = null;
        this.attack_sprite_picker = null;
        this.hit_sprite_picker = null;
        this.ranged_projectile_picker = null;
        this.ranged_hit_picker = null;
        $('#menu_sprite_properties').empty();
        $('#menu_sprite_properties_variable_part_following').nextAll().remove();
        let traits_menu = $('<div>').css('max-height', 'calc(50vh - 90px)').appendTo($('#menu_sprite_properties'));
        let traits_menu_data = [];
        traits_menu_data.push({ label: 'Eigenschaft hinzufügen', children: this.build_sprite_traits_submenu(SPRITE_TRAITS_ORDER) });
        setupDropdownMenu(traits_menu, traits_menu_data);
        let keys = Object.keys(self.data.sprites[si].traits);
        for (let i = keys.length - 1; i >= 0; i--) {
            let trait = keys[i];
            this.add_sprite_trait_controls(trait, $('#menu_sprite_properties_variable_part_following'));
        }
        // Old sword configurations appear as a virtual melee trait. Displaying
        // the controls does NOT migrate or otherwise modify saved game JSON.
        if (!('melee_attack' in self.data.sprites[si].traits) &&
            legacy_melee_attack(self.data.sprites[si].traits)) {
            this.add_sprite_trait_controls('melee_attack', $('#menu_sprite_properties_variable_part_following'));
        }
        this.build_state_traits_menu();
    }

    add_sprite_trait_controls(trait, element) {
        let self = this;
        let si = canvas.sprite_index;
        let div = $(`<div class='menu'>`);
        let bu_delete = $(`<button class='btn'>`).append($(`<i class='fa fa-trash'>`));
        bu_delete.click(function (e) {
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
        if (trait === 'melee_attack') this.add_melee_attack_trait_controls(div, si);
        if (trait === 'ranged_attack') this.add_ranged_attack_trait_controls(div, si);
        if (trait === 'actor' || trait === 'baddie') this.add_hit_feedback_controls(div, si, trait);
        if (trait === 'door') this.add_door_state_help(div, si);
        div.insertAfter(element);
    }

    // Target-owned visual feedback, independent of weapon/attack settings.
    // Merely opening the editor does not add properties to saved game JSON.
    add_hit_feedback_controls(div, si, role) {
        const traits = this.data.sprites[si].traits[role];
        new SelectWidget({
            container: div, label: 'Trefferreaktion:',
            hint: 'So sieht diese Figur nach einem Treffer kurz aus. Das ändert weder Schaden noch Unverwundbarkeit.',
            options: { color: 'Farbe', hide: 'Ausblenden', none: 'aus' },
            get: () => traits.hit_feedback?.kind ?? 'color',
            set: kind => {
                if (!['color', 'hide', 'none'].includes(kind)) return;
                traits.hit_feedback = { ...traits.hit_feedback, kind };
                this.build_sprite_traits_menu();
            },
        });
        if ((traits.hit_feedback?.kind ?? 'color') === 'color') new ColorWidget({
            container: div, label: 'Trefferfarbe:',
            hint: 'Färbt die sichtbaren Pixel kurz ein; durchsichtige Pixel bleiben durchsichtbar.',
            get: () => traits.hit_feedback?.color ?? '#ff4040',
            set: color => {
                if (!/^#[0-9a-f]{6}$/i.test(color)) return;
                traits.hit_feedback = { ...traits.hit_feedback, kind: 'color', color };
            },
        });
    }

    add_melee_attack_trait_controls(div, si) {
        const sprite_traits = this.data.sprites[si].traits;
        const attack = melee_attack_for_editor(sprite_traits);
        if (!attack) return;
        if (!sprite_traits.actor && !sprite_traits.baddie) {
            $('<p>').text('Füge auch die Eigenschaft „Spielfigur“ oder „Gegner“ hinzu.').appendTo(div);
        }
        this.add_trait_help(div, 'Hinweise zum Nahkampfangriff',
            'Zum Ausprobieren brauchst du nur deine Figurenbilder. J: Nahkampfangriff der Spielfigur; Gegner greifen automatisch in Reichweite an. Berührungsschaden ist eine eigene Einstellung.');
        const section = (label) => $('<h5>').addClass('trait-section-title').text(label).appendTo(div);
        section('So funktioniert der Angriff');
        new LineEditWidget({
            container: div, label: 'Name des Angriffs:',
            hint: 'Wie soll der Angriff heißen? Zum Beispiel Faustschlag, Kralle oder U-Boot-Ramme.',
            get: () => attack.label ?? 'Nahkampfangriff',
            set: (value) => {
                if (typeof value === 'string' && value.trim())
                    attack.label = value.trim().slice(0, 80);
            },
        });
        new NumberWidget({
            container: div, label: 'Schaden:',
            hint: 'Wie viel Energie verliert die getroffene Figur? Dies ist nicht der Berührungsschaden.',
            min: 1, max: 10000, step: 1, decimalPlaces: 0,
            get: () => Number.isFinite(attack.effect?.amount) ? attack.effect.amount : 20,
            set: (value) => {
                if (!Number.isFinite(value) || value < 1 || value > 10000) return;
                attack.effect ??= { kind: 'damage' };
                attack.effect.amount = value;
            },
        });
        new NumberWidget({
            container: div, label: 'Angriffsreichweite:',
            hint: 'Wie weit vor der Figur kann der Nahkampfangriff treffen? Unabhängig von der Länge des Swooshs.',
            min: 1, max: 500, step: 1, decimalPlaces: 0, suffix: 'px',
            get: () => Number.isFinite(attack.delivery?.range_px) ? attack.delivery.range_px : 40,
            set: (value) => {
                if (!Number.isFinite(value) || value < 1 || value > 500) return;
                attack.delivery ??= { kind: 'swing' };
                attack.delivery.range_px = value;
            },
        });
        new NumberWidget({
            container: div, label: 'Cooldown:',
            hint: 'So viele Sekunden muss die Figur nach einem Angriff bis zum nächsten warten. Für Spielfigur und Gegner getrennt.',
            min: 0, max: 60, step: 0.1, decimalPlaces: 1, suffix: 's',
            get: () => Number.isFinite(attack.timing?.cooldown_s) ? attack.timing.cooldown_s : 0.6,
            set: (value) => {
                if (!Number.isFinite(value) || value < 0 || value > 60) return;
                attack.timing ??= {};
                attack.timing.cooldown_s = value;
            },
        });
        section('So sieht der Angriff aus');
        this.attack_sprite_picker = new SpriteSelectWidget({
            container: div, label: 'Angriffssprite:',
            hint: 'Zeichne einen eigenen Sprite (auch mehrere Frames möglich) und wähle ihn hier aus. Das Bild erscheint, sobald der Angriff startet – auch wenn niemand getroffen wird. Es ändert weder Schaden noch Reichweite.',
            sprites: () => this.data.sprites,
            get: () => Number.isInteger(attack.visual?.attack_sprite_index) &&
                this.data.sprites[attack.visual.attack_sprite_index] ?
                String(attack.visual.attack_sprite_index) : 'none',
            set: (choice) => {
                const index = Number(choice);
                if (choice !== 'none' && (!Number.isInteger(index) || index < 0 ||
                    !this.data.sprites[index])) return;
                const visual = attack.visual && typeof attack.visual === 'object' ? attack.visual : {};
                if (choice === 'none') delete visual.attack_sprite_index;
                else visual.attack_sprite_index = index;
                attack.visual = visual;
            },
        });
        this.hit_sprite_picker = new SpriteSelectWidget({
            container: div, label: 'Treffereffekt:',
            hint: 'Zeichne einen eigenen Sprite (auch mehrere Frames möglich) und wähle ihn hier aus. Das Bild erscheint nur bei einem Treffer und ändert weder Schaden noch Reichweite.',
            sprites: () => this.data.sprites,
            get: () => Number.isInteger(attack.visual?.hit_sprite_index) &&
                this.data.sprites[attack.visual.hit_sprite_index] ?
                String(attack.visual.hit_sprite_index) : 'none',
            set: (choice) => {
                const index = Number(choice);
                if (choice !== 'none' && (!Number.isInteger(index) || index < 0 ||
                    !this.data.sprites[index])) return;
                const visual = attack.visual && typeof attack.visual === 'object' ? attack.visual : {};
                if (choice === 'none') delete visual.hit_sprite_index;
                else visual.hit_sprite_index = index;
                // No legacy star/POW option is retained on this development branch.
                delete visual.hit_kind;
                attack.visual = visual;
            },
        });
        new SelectWidget({
            container: div, label: 'Swoosh:',
            hint: 'Aus: kein eingeblendeter Schwung. Die Bewegung des Swooshs verändert weder Schaden noch Angriffsreichweite.',
            options: {
                none: 'aus',
                up: 'hoch',
                down: 'runter',
            },
            get: () => attack.visual?.kind === 'none' ? 'none' :
                (attack.visual?.sweep === 'down' ? 'down' : 'up'),
            set: (choice) => {
                if (!['none', 'up', 'down'].includes(choice)) return;
                let visual = attack.visual && typeof attack.visual === 'object' ? attack.visual : {};
                attack.visual = choice === 'none' ? { ...visual, kind: 'none' } :
                    { ...visual, kind: 'swoosh', sweep: choice };
                this.build_sprite_traits_menu();
            },
        });
        if (attack.visual?.kind !== 'none') new NumberWidget({
            container: div, label: 'Swoosh-Länge:',
            hint: 'Nur die sichtbare Länge des Schwungs. Der tatsächliche Trefferbereich steht oben.',
            min: 8, max: 200, step: 1, decimalPlaces: 0, suffix: 'px',
            get: () => Number.isFinite(attack.visual?.reach_px) ? attack.visual.reach_px :
                Math.max(8, Math.min((Number.isFinite(attack.delivery?.range_px) ?
                    attack.delivery.range_px : 40) * 0.72, 38)),
            set: (value) => {
                if (!Number.isFinite(value) || value < 8 || value > 200) return;
                let visual = attack.visual && typeof attack.visual === 'object' ? attack.visual : {};
                attack.visual = { ...visual, reach_px: value };
            },
        });
    }

    add_ranged_attack_trait_controls(div, si) {
        const traits = this.data.sprites[si].traits;
        const attack = traits.ranged_attack?.attack;
        if (!attack) return;
        if (!traits.actor && !traits.baddie)
            $('<p>').text('Füge auch die Eigenschaft „Spielfigur“ oder „Gegner“ hinzu.').appendTo(div);
        this.add_trait_help(div, 'Hinweise zum Fernkampfangriff',
            'K: Schießen. Bei Maus-Zielen geht auch ein Linksklick ins Spielfeld. Eine Bombe explodiert nach Ablauf der Zündzeit, auch wenn sie noch fliegt. Die Schwerkraft betrifft nur dieses Projektil. Berührungsschaden ist unabhängig davon.');
        this.add_trait_help(div, 'Bomben zeichnen',
            'Zeichne die Bombe im ersten Zustand (Ersatzbild). Füge einen Zustand namens „Zündschnur“ mit der Bombe und ihrer brennenden Schnur hinzu; er läuft ab dem Abwurf. Der Zustand „Explosion“ spielt nach der Zündzeit einmal. Die Titel müssen genau so heißen. Der Schaden hängt nicht von den Bildern ab.');
        const section = label => $('<h5>').addClass('trait-section-title').text(label).appendTo(div);
        section('So funktioniert der Angriff');
        new LineEditWidget({
            container: div, label: 'Name des Angriffs:',
            hint: 'Zum Beispiel Pfeil, Feuerball oder Torpedo.',
            get: () => attack.label ?? 'Fernkampfangriff',
            set: value => {
                if (typeof value === 'string' && value.trim())
                    attack.label = value.trim().slice(0, 80);
            },
        });
        new NumberWidget({
            container: div, label: 'Schaden:',
            hint: 'Wie viel Energie verliert die getroffene Figur? Unabhängig vom Berührungsschaden.',
            min: 1, max: 10000, step: 1, decimalPlaces: 0,
            get: () => attack.effect?.amount ?? 15,
            set: value => {
                if (!Number.isFinite(value) || value < 1 || value > 10000) return;
                attack.effect ??= { kind: 'damage' };
                attack.effect.amount = value;
            },
        });
        new NumberWidget({
            container: div, label: 'Reichweite:',
            hint: 'Wie weit das Projektil höchstens fliegt. Die Bildgröße verändert die Reichweite nicht.',
            min: 1, max: 1000, step: 1, decimalPlaces: 0, suffix: 'px',
            get: () => attack.delivery?.range_px ?? 280,
            set: value => {
                if (!Number.isFinite(value) || value < 1 || value > 1000) return;
                attack.delivery.range_px = value;
            },
        });
        let bomb_controls = null;
        new SelectWidget({
            container: div, label: 'Art:',
            hint: 'Ein normales Projektil verschwindet beim Treffer. Eine Bombe kann liegen bleiben und nach einer Zündzeit explodieren.',
            options: { projectile: 'Projektil', bomb: 'Bombe' },
            get: () => attack.delivery?.detonation ? 'bomb' : 'projectile',
            set: choice => {
                if (choice === 'bomb') {
                    attack.delivery.detonation ??= { fuse_s: 2, radius_px: 48, shake_strength: 0 };
                    attack.delivery.gravity_px_s2 ??= 500;
                } else if (choice === 'projectile') {
                    delete attack.delivery.detonation;
                    if (attack.delivery.speed_px_s < 40) attack.delivery.speed_px_s = 240;
                }
                bomb_controls?.toggle(!!attack.delivery.detonation);
            },
        });
        new NumberWidget({
            container: div, label: 'Geschwindigkeit:',
            hint: 'Wie viele Spielpixel das Projektil pro Sekunde fliegt. Bei Bomben bedeutet 0: direkt fallen lassen.',
            min: 0, max: 1200, step: 10, decimalPlaces: 0, suffix: 'px/s',
            get: () => attack.delivery?.speed_px_s ?? 240,
            set: value => {
                if (!Number.isFinite(value) || value < (attack.delivery.detonation ? 0 : 40) ||
                    value > 1200) return;
                attack.delivery.speed_px_s = value;
            },
        });
        bomb_controls = $('<div>').appendTo(div);
        $('<h5>').addClass('trait-section-title').text('Bombe').appendTo(bomb_controls);
        new NumberWidget({
            container: bomb_controls, label: 'Zündzeit:',
            hint: 'Sekunden ab dem Abwurf – die Bombe kann auch in der Luft explodieren.',
            min: 0.1, max: 20, step: 0.1, decimalPlaces: 1, suffix: 's',
            get: () => attack.delivery?.detonation?.fuse_s ?? 2,
            set: value => {
                if (!attack.delivery.detonation || !Number.isFinite(value) ||
                    value < 0.1 || value > 20) return;
                attack.delivery.detonation.fuse_s = value;
            },
        });
        new NumberWidget({
            container: bomb_controls, label: 'Explosionsradius:',
            hint: 'Alle Gegner im Umkreis können genau einmal getroffen werden. Die Bildgröße ändert diesen Radius nicht.',
            min: 1, max: 500, step: 1, decimalPlaces: 0, suffix: 'px',
            get: () => attack.delivery?.detonation?.radius_px ?? 48,
            set: value => {
                if (!attack.delivery.detonation || !Number.isFinite(value) ||
                    value < 1 || value > 500) return;
                attack.delivery.detonation.radius_px = value;
            },
        });
        new NumberWidget({
            container: bomb_controls, label: 'Bodenerschütterung:',
            hint: 'Wie stark die Kamera bei einer nahen Explosion wackelt. 0 schaltet den Effekt aus.',
            min: 0, max: 20, step: 1, decimalPlaces: 0,
            get: () => attack.delivery?.detonation?.shake_strength ?? 0,
            set: value => {
                if (!attack.delivery.detonation || !Number.isFinite(value) ||
                    value < 0 || value > 20) return;
                attack.delivery.detonation.shake_strength = value;
            },
        });
        bomb_controls.toggle(!!attack.delivery.detonation);
        new NumberWidget({
            container: div, label: 'Schwerkraft:',
            hint: '0 bedeutet: Das Projektil fliegt geradeaus. Größere Werte ziehen es nach unten.',
            min: 0, max: 4000, step: 10, decimalPlaces: 0, suffix: 'px/s²',
            get: () => attack.delivery?.gravity_px_s2 ?? 0,
            set: value => {
                if (!Number.isFinite(value) || value < 0 || value > 4000) return;
                attack.delivery.gravity_px_s2 = value;
            },
        });
        new NumberWidget({
            container: div, label: 'Cooldown:',
            hint: 'So viele Sekunden muss die Figur bis zum nächsten Schuss warten.',
            min: 0, max: 60, step: 0.1, decimalPlaces: 1, suffix: 's',
            get: () => attack.timing?.cooldown_s ?? 0.8,
            set: value => {
                if (!Number.isFinite(value) || value < 0 || value > 60) return;
                attack.timing ??= {};
                attack.timing.cooldown_s = value;
            },
        });
        new SelectWidget({
            container: div, label: 'Zielen:',
            hint: 'Waagerecht nutzt die Blickrichtung. Maus richtet den Schuss nach der Maus aus. Gegner zielen damit direkt auf die Spielfigur.',
            options: { horizontal: 'waagerecht', mouse: 'Maus' },
            get: () => attack.delivery?.aim_mode ?? 'horizontal',
            set: choice => {
                if (!['horizontal', 'mouse'].includes(choice)) return;
                attack.delivery.aim_mode = choice;
            },
        });
        section('So sieht der Angriff aus');
        const picker = (field, key, hint) => new SpriteSelectWidget({
            container: div, label: field,
            hint, sprites: () => this.data.sprites,
            get: () => Number.isInteger(attack.visual?.[key]) &&
                this.data.sprites[attack.visual[key]] ? String(attack.visual[key]) : 'none',
            set: choice => {
                const index = Number(choice);
                if (choice !== 'none' && (!Number.isInteger(index) || index < 0 ||
                    !this.data.sprites[index])) return;
                attack.visual ??= {};
                if (choice === 'none') delete attack.visual[key];
                else attack.visual[key] = index;
            },
        });
        this.ranged_projectile_picker = picker('Projektilsprite:', 'projectile_sprite_index',
            'Zeichne normale Projektile nach rechts. Für eine Bombe kannst du zusätzliche Zustände „Zündschnur“ (Bombenkörper mit brennender Schnur) und „Explosion“ zeichnen. Die Zündschnur läuft ab dem Abwurf, die Explosion danach einmal.');
        this.ranged_hit_picker = picker('Treffereffekt:', 'hit_sprite_index',
            'Dieses Bild erscheint nur bei einem Treffer, unabhängig vom Projektilsprite.');
    }

    // Long trait explanations share a compact, keyboard-accessible disclosure.
    // Detailed field-specific help stays in the existing ? dialogs.
    add_trait_help(div, label, explanation = null) {
        let help = $('<details>').addClass('trait-help').appendTo(div);
        $('<summary>').text(label).appendTo(help);
        if (explanation) $('<p>').text(explanation).appendTo(help);
        return help;
    }

    add_door_state_help(div, si) {
        let help = this.add_trait_help(div, 'Tür-Check');
        let summary = help.children('summary');
        let status = $('<div>').appendTo(help);
        let advice = $('<div>').css({
            'margin-top': '6px',
            'font-size': '0.9em',
            'color': '#ffcc66',
        }).appendTo(help);

        this.door_state_help = () => {
            let states = this.data.sprites[si].states;
            status.empty();
            let present_count = 0;
            for (let [trait, label] of [['closed', 'geschlossen'], ['open', 'geöffnet']]) {
                let present = states.some((state) => trait in (state.traits?.door ?? {}));
                if (present) present_count++;
                let row = $('<div>').css({
                    'display': 'flex',
                    'align-items': 'center',
                    'gap': '7px',
                    'margin-top': '5px',
                }).appendTo(status);
                $('<i>').addClass(present ? 'fa fa-check-circle' : 'fa fa-exclamation-circle')
                    .css('color', present ? '#6dcd8d' : '#ffcc66').appendTo(row);
                $('<span>').text(present ? `„${label}“ vorhanden` : `„${label}“ fehlt`).appendTo(row);
            }
            summary.text(`Tür-Check: ${present_count}/2 Zustände`);
            summary.css('color', present_count === 2 ? '#6dcd8d' : '#ffcc66');
            advice.text(present_count < 2 ? 'Weise den fehlenden Zustand unter „Zustände“ zu.' : '');
        };
        this.door_state_help();
    }

    add_state_trait(sprite_trait, trait) {
        let self = this;
        let si = canvas.sprite_index;
        let sti = canvas.state_index;
        // TODO: Check if this makes sense
        self.data.sprites[si].states[sti].traits ??= {};
        self.data.sprites[si].states[sti].traits[sprite_trait] ??= {};
        self.data.sprites[si].states[sti].traits[sprite_trait][trait] ??= {};
        self.fix_game_data();
        this.door_state_help?.();
    }

    remove_state_trait(sprite_trait, trait) {
        let self = this;
        let si = canvas.sprite_index;
        let sti = canvas.state_index;
        // TODO: Check if this makes sense
        delete self.data.sprites[si].states[sti].traits[sprite_trait][trait];
        self.fix_game_data();
        this.door_state_help?.();
    }

    build_state_traits_submenu(sprite_trait, traits) {
        let self = this;
        // console.log(traits);
        return traits.map(function (x) {
            if (typeof (x) === 'string')
                return {
                    // The selection menu already supplies the group (Stehen,
                    // Angriff, ...). Applied tags below need the full label.
                    label: (sprite_trait === 'actor' || sprite_trait === 'baddie') &&
                        /^(?:(?:walk|jump|fall|attack|hit)_)?(?:front|back|left|right)$/.test(x) ?
                        { front: 'vorn', back: 'hinten', left: 'links', right: 'rechts' }[
                            x.split('_').at(-1)] : STATE_TRAITS[sprite_trait][x].label,
                    callback: () => {
                        self.add_state_trait(sprite_trait, x);
                        self.build_state_traits_menu();
                    }
                };
            let d = { label: x[0] };
            if ((!(x[0] in STATE_TRAITS)) && x.length > 1) {
                // console.log(x);
                d.children = self.build_state_traits_submenu(sprite_trait, x[1]);
            }
            return d;
        });
    }

    build_state_traits_menu() {
        let self = this;
        let si = canvas.sprite_index;
        let sti = canvas.state_index;
        $('#menu_state_properties_fixed').empty();
        new LineEditWidget({
            container: $('#menu_state_properties_fixed'),
            label: 'Titel',
            hint: `Gib jedem Zustand einen Titel, damit du weißt, welcher Zustand welcher ist.`,
            get: () => self.data.sprites[si].states[sti].properties.name,
            set: (x) => {
                self.data.sprites[si].states[sti].properties.name = x;
                canvas.update_state_label();
                this.hit_sprite_picker?.refresh();
            },
        });
        new NumberWidget({
            container: $('#menu_state_properties_fixed'),
            label: 'Framerate',
            hint: `Die Framerate definiert, wie schnell ein Sprite animiert wird.
            Die Einheit dafür sind FPS (frames per second), also Bilder pro Sekunde.
            Umso höher die FPS-Zahl ist, umso schneller läuft die Animation.`,
            suffix: 'fps',
            width: '1.8em',
            min: 1,
            max: 60,
            get: () => self.data.sprites[si].states[sti].properties.fps,
            set: (x) => {
                self.data.sprites[si].states[sti].properties.fps = x;
            },
        });
        new NumberWidget({
            container: $('#menu_state_properties_fixed'),
            label: "Phase <span style='font-size: 80%;'>XY/R</span>",
            hint: `<p>Die Phase wird wichtig, wenn du viele Sprites in einem Level platzierst.</p>
            <p>Setzt du alle Werte auf 0, so werden alle Sprites synchron, also gleichzeitig animiert.</p>
            <ul>
                <li>Der X-Wert gibt an, wie stark der Einfluss der X-Position auf die Phase ist</li>
                <li>Der Y-Wert gibt an, wie stark der Einfluss der Y-Position auf die Phase ist</li>
                <li>Der R-Wert gibt an, wie stark ein zufälliger Einfluss auf die Phase ist</li>
            </ul>`,
            width: '1.4em',
            count: 3,
            min: [0.0, 0.0, 0.0],
            max: [1.0, 1.0, 1.0],
            step: 0.1,
            decimalPlaces: 1,
            get: () => [self.data.sprites[si].states[sti].properties.phase_x,
            self.data.sprites[si].states[sti].properties.phase_y,
            self.data.sprites[si].states[sti].properties.phase_r],
            set: (x, y, r) => {
                self.data.sprites[si].states[sti].properties.phase_x = x;
                self.data.sprites[si].states[sti].properties.phase_y = y;
                self.data.sprites[si].states[sti].properties.phase_r = r;
            },
        });

        $('#menu_state_properties').empty();
        $('#menu_state_properties_variable_part_following').nextAll().remove();
        let traits_menu = $('<div>').appendTo($('#menu_state_properties'))
        let traits_menu_data = [];
        let children = [];
        for (let sprite_trait of Object.keys(self.data.sprites[si].traits)) {
            if (sprite_trait in STATE_TRAITS_ORDER)
                children.push({ label: SPRITE_TRAITS[sprite_trait].label, children: this.build_state_traits_submenu(sprite_trait, STATE_TRAITS_ORDER[sprite_trait]) });
        }
        if (children.length === 0) return;
        traits_menu_data.push({ label: 'Eigenschaft hinzufügen', children: children });
        setupDropdownMenu(traits_menu, traits_menu_data);

        let sprite_traits = Object.keys(self.data.sprites[si].traits);
        for (let i = sprite_traits.length - 1; i >= 0; i--) {
            let sprite_trait = sprite_traits[i];
            let keys = Object.keys(self.data.sprites[si].states[sti].traits[sprite_trait]);
            for (let i = keys.length - 1; i >= 0; i--) {
                let trait = keys[i];
                this.add_state_trait_controls(sprite_trait, trait, $('#menu_state_properties_variable_part_following'));
            }
        }

    }

    add_state_trait_controls(sprite_trait, trait, element) {
        let self = this;
        let si = canvas.sprite_index;
        let sti = canvas.state_index;
        let div = $(`<div class='menu'>`);
        let bu_delete = $(`<button class='btn'>`).append($(`<i class='fa fa-trash'>`));
        bu_delete.click(function (e) {
            self.remove_state_trait(sprite_trait, trait);
            self.build_state_traits_menu();
        });
        let title = $(`<h4>`).append($('<span>').text(STATE_TRAITS[sprite_trait][trait].label)).append(bu_delete).appendTo(div);
        // let info = SPRITE_TRAITS[trait] ?? {};
        // for (let key in info.properties ?? {}) {
        //     let property = info.properties[key];
        //     if (property.type === 'float') {
        //         new NumberWidget({
        //             container: div,
        //             label: property.label ?? key,
        //             min: property.min ?? null,
        //             max: property.max ?? null,
        //             get: () => self.data.sprites[si].traits[trait][key],
        //             set: (x) => {
        //                 self.data.sprites[si].traits[trait][key] = x;
        //             },
        //         });
        //     } else if (property.type === 'bool') {
        //         new CheckboxWidget({
        //             container: div,
        //             label: property.label ?? key,
        //             get: () => self.data.sprites[si].traits[trait][key],
        //             set: (x) => {
        //                 self.data.sprites[si].traits[trait][key] = x;
        //             },
        //         });
        //     }
        // }
        div.insertAfter(element);
    }
}

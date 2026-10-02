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
            // Old enemies get the behaviour they already have (Wächter / Steht still);
            // their classic settings stay and keep them moving exactly as before.
            if (this.data.sprites[si].traits.baddie && typeof promote_baddie_behavior === 'function')
                promote_baddie_behavior(this.data.sprites[si].traits.baddie);
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
                } else if (this.data.levels[li].layers[lyi].type === 'movement_region') {
                    // Bewegungsbereich (movement_regions.js): the settings of its rectangles
                    const layer = this.data.levels[li].layers[lyi];
                    if (!layer.movement || typeof layer.movement !== 'object') layer.movement = { mode: 'swim' };
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
        // Signale (signals.js): door codes and Sichtbarkeitsbereiche of older
        // games become the one Code and Bereiche. Deterministic.
        promote_legacy_signals(this.data);
        // Stable sprite/level identities (game_ids.js). Deterministic, so the
        // same JSON always gets the same IDs; existing IDs are kept.
        ensure_game_ids(this.data);
        // References between sprites are stored as sprite IDs; old games
        // still hold array indices, which become IDs here.
        convert_sprite_references_to_ids(this.data);
        // console.log(`Fixing game data / after:`, JSON.stringify(this.data));
    }

    create_geometry_and_material_for_sprite(si) {
        if (this.blend_materials_for_sprite) this.blend_materials_for_sprite[si] = {};
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
            for (const material of Object.values(this.blend_materials_for_sprite?.[si] ?? {}))
                material.uniforms.texture1.value = texture;
        }
    }

    // Array index of a referenced sprite (placed sprites and attack visuals
    // store sprite IDs), or null if the sprite does not exist (any more).
    sprite_index_for_ref(ref) {
        const sprites = this.data?.sprites ?? [];
        if (Number.isInteger(ref)) return ref >= 0 && ref < sprites.length ? ref : null;
        if (typeof ref !== 'string') return null;
        let index = this.sprite_index_by_id_cache?.get(ref);
        if (index === undefined || sprites[index]?.id !== ref) {
            this.sprite_index_by_id_cache = sprite_index_by_id(this.data);
            index = this.sprite_index_by_id_cache.get(ref);
        }
        return index ?? null;
    }

    // Level editor: the sprite's material with the Mischmodus of the layer
    // (or else of the sprite itself), like in the game.
    editor_sprite_material(si, layer_blend) {
        const base = this.material_for_sprite[si];
        const mode = blend_mode_of(layer_blend) ?? blend_mode_of(this.data.sprites[si]?.blend);
        if (!mode || !base) return base;
        this.blend_materials_for_sprite ??= [];
        this.blend_materials_for_sprite[si] ??= {};
        const material = this.blend_materials_for_sprite[si][mode] ??= blended_copy(base, mode);
        material.uniforms.texture1.value = base.uniforms.texture1.value;
        return material;
    }

    _load() {
        canvas.setGame(this);
        let self = this;
        // Another game (or a session's copy of it): the undo steps of the
        // levels before do not belong to it. Rebuilding the lists keeps them.
        if (this.level_history_data !== this.data || this.level_history_levels !== this.data.levels) {
            this.level_history = typeof LevelHistory !== 'undefined' ? new LevelHistory() : null;
            this.level_history_data = this.data;
            this.level_history_levels = this.data.levels;
        }
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
                const sprite = {};
                assign_new_game_id(self.data, 'sprites', sprite);
                self.data.sprites.push(sprite);
                self.fix_game_data();
                self.create_geometry_and_material_for_sprite(self.data.sprites.length - 1);
                window.collaboration?.structure_changed?.('sprite', 'insert', sprite.id);
                return self.data.sprites[self.data.sprites.length - 1];
            },
            can_delete_index: (index) => window.collaboration?.can_delete?.('sprite', self.data.sprites[index]?.id) ?? true,
            delete_item: (index) => {
                canvas.detachSprite();
                // References use sprite IDs, so only references to the deleted
                // sprite itself need to go; nothing else is renumbered.
                const [deleted] = self.data.sprites.splice(index, 1);
                remove_sprite_references(self.data, deleted?.id);
                window.collaboration?.structure_changed?.('sprite', 'delete', deleted?.id);
                self.refresh_sprite_reference_pickers();
                // unnamed sprites are called by their number, which has changed
                setTimeout(() => self.refresh_sprite_titles(), 0);
                this.refresh_frames_on_screen();
                for (let si = 0; si < self.data.sprites.length; si++)
                    this.create_geometry_and_material_for_sprite(si);
                // fix level editor
                if (self.level_editor.sprite_index >= self.data.sprites.length - 1)
                    self.level_editor.sprite_index = self.data.sprites.length - 1;
                self.level_editor.layer_structs[self.level_editor.layer_index].apply_layer(self.data.levels[self.level_editor.level_index].layers[self.level_editor.layer_index]);

            },
            on_move_item: (from, to) => {
                // Sprite IDs travel with their sprite: no references change.
                move_item_helper(self.data.sprites, from, to);
                window.collaboration?.structure_changed?.('sprite', 'move', self.data.sprites[to]?.id);
                self.refresh_sprite_reference_pickers();
                setTimeout(() => self.refresh_sprite_titles(), 0);
                this.refresh_frames_on_screen();
                for (let si = 0; si < self.data.sprites.length; si++)
                    this.create_geometry_and_material_for_sprite(si);
            }
        });

        this.level_editor = new LevelEditor($('#level'), this);
        this.refresh_sprite_titles();

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
        this.add_controls_settings($('#game-settings-here'));
        this.add_speech_settings($('#game-settings-here'));
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
        this.arrange_settings_cards($('#game-settings-here'));
        if (typeof (this.data.parent) !== 'undefined') {
            $('#play_iframe').hide();
            if ($('#play_iframe')[0].contentWindow.game) {
                $('#play_iframe')[0].contentWindow.game.load(this.data.parent);
                $('#play_iframe').fadeIn();
                $('#play_iframe').focus();
            }
        }
    }

    refresh_game_settings_controls() {
        $('#game-settings-here .item').each(function () {
            $(this).data('widget-instance')?.refresh?.();
        });
        this.refresh_controls_settings?.();
    }

    // Einstellungen: every section (a separator and the fields after it) becomes a
    // card; the cards fill the width in columns instead of one long narrow list.
    arrange_settings_cards(container) {
        const cards = [];
        let card = null;
        for (const child of container.children().toArray()) {
            const el = $(child);
            const separator = el.is('.item') ? el.children('.separator') : el.children('.item').first().children('.separator');
            if (separator.length) {
                card = $('<section>').addClass('settings-karte');
                $('<h3>').text(separator.text()).appendTo(card);
                cards.push(card);
                // a section wrapped in its own element (Link zum Spiel): move its content
                if (el.is('.item')) { el.remove(); continue; }
                separator.closest('.item').remove();
                card.attr('id', el.attr('id') ?? null);
                el.removeAttr('id');
                el.appendTo(card);
                continue;
            }
            if (!card) { card = $('<section>').addClass('settings-karte'); cards.push(card); }
            el.appendTo(card);
        }
        container.empty().addClass('settings-raster');
        for (const c of cards) c.appendTo(container);
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
        this.drop_sprite_picker?.refresh();
        this.attack_sprite_picker?.refresh();
        this.hit_sprite_picker?.refresh();
        this.ranged_projectile_picker?.refresh();
        this.ranged_hit_picker?.refresh();
    }

    // Einstellungen → Steuerung. Without custom keys the game JSON stays unchanged;
    // only actions a child actually changes are stored in properties.controls.
    // Einstellungen → Texte (speech.js): one font, size and reading speed for
    // the whole game, and the colour the figure speaks in. Absent = the
    // default; a choice equal to the default is not stored.
    add_speech_settings(container) {
        const self = this;
        new SeparatorWidget({ container, label: 'Texte' });
        const preview = $('<div class="speech-preview">');
        const store = (key, value, fallback) => {
            if (value === fallback) delete self.data.properties[key]; else self.data.properties[key] = value;
            draw_preview();
        };
        const option_labels = (table) => Object.fromEntries(Object.entries(table).map(([id, v]) => [id, v.label]));
        new SelectWidget({
            container, label: 'Schrift',
            hint: 'In dieser Pixelschrift sprechen alle Figuren und Schilder in deinem Spiel.',
            options: option_labels(SPEECH_FONTS),
            get: () => speech_settings(self.data.properties).font,
            set: (x) => store('text_font', x, SPEECH_DEFAULT_FONT),
        });
        new SelectWidget({
            container, label: 'Textgröße',
            hint: 'Wie groß die Buchstaben im Spiel sind – immer gleich groß, egal wie groß das Spielfenster ist.',
            options: option_labels(SPEECH_SIZES),
            get: () => speech_settings(self.data.properties).size,
            set: (x) => store('text_size', x, 'medium'),
        });
        new SelectWidget({
            container, label: 'Lesetempo',
            hint: 'Wie lange ein Satz stehen bleibt. Mit der Punkt-Taste (.) springt man im Spiel sofort zum nächsten Satz.',
            options: option_labels(SPEECH_SPEEDS),
            get: () => speech_settings(self.data.properties).speed,
            set: (x) => store('text_speed', x, 'normal'),
        });
        new ColorWidget({
            container, label: 'Textfarbe der Spielfigur',
            hint: 'In dieser Farbe spricht deine Spielfigur – auch wenn sie ein Schild vorliest.',
            get: () => speech_settings(self.data.properties).color,
            set: (x) => store('text_color', speech_color(x, SPEECH_PLAYER_COLOR), SPEECH_PLAYER_COLOR),
        });
        preview.appendTo(container);
        // the same pixels the game draws
        const draw_preview = () => {
            const settings = speech_settings(self.data.properties);
            const font = SPEECH_FONTS[settings.font];
            const make_canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
            const paint = () => {
                const k = Math.max(1, Math.min(4, speech_scale(420, settings.font, settings.size)));
                const bitmap = render_speech_bitmap(['So spricht deine Figur!', 'Grüße aus dem Pixelwald …'],
                    settings.font, k, settings.color, make_canvas);
                preview.empty().append($(bitmap.canvas).addClass('speech-preview-canvas'));
            };
            paint();
            document.fonts?.load?.(`${font.em * 2}px "${font.family}"`).then(paint).catch(() => null);
        };
        draw_preview();
    }

    add_controls_settings(container) {
        new SeparatorWidget({ container, label: 'Steuerung' });
        const box = $('<div>').addClass('controls-settings').appendTo(container);
        const render = () => {
            box.empty();
            const current = resolve_controls(this.data.properties);
            $('<p>').addClass('controls-hint').text('Klicke auf eine Taste und drück dann die neue Taste. ' +
                'Jede Aktion kann zwei Tasten haben. Entf entfernt eine Taste, Esc bricht ab.').appendTo(box);
            const used = new Map();
            for (const control of GAME_CONTROLS)
                for (const code of current[control.id]) used.set(code, [...(used.get(code) ?? []), control.label]);
            for (const control of GAME_CONTROLS) {
                const row = $('<div>').addClass('controls-row').appendTo(box);
                $('<div>').addClass('controls-label').text(control.label).appendTo(row);
                const keys = current[control.id];
                for (let slot = 0; slot < MAX_KEYS_PER_CONTROL; slot++) {
                    const code = keys[slot];
                    $('<button>').addClass('controls-key').toggleClass('empty', !code)
                        .text(code ? key_label(code) : '+').attr('title', code ?? 'weitere Taste')
                        .on('click', (e) => this.capture_control_key(control.id, slot, $(e.currentTarget), render))
                        .appendTo(row);
                }
                const notes = keys.map(key_warning).filter(Boolean);
                for (const code of keys) {
                    const others = (used.get(code) ?? []).filter(label => label !== control.label);
                    if (others.length) notes.push(`${key_label(code)} ist auch für „${others.join('“, „')}“ belegt.`);
                }
                for (const note of [...new Set(notes)]) $('<div>').addClass('controls-warning').text(note).appendTo(box);
            }
            if (this.controls_notice) {
                $('<div>').addClass('controls-warning').text(this.controls_notice).appendTo(box);
                this.controls_notice = null;
            }
            $('<button>').addClass('controls-reset').text('Standard-Tasten')
                .prop('disabled', !this.data.properties.controls)
                .on('click', () => { delete this.data.properties.controls; render(); })
                .appendTo(box);
        };
        this.refresh_controls_settings = render;
        render();
    }

    capture_control_key(action, slot, button, render) {
        button.text('Taste drücken …').addClass('waiting');
        // Capture phase: the studio's own shortcuts must not see this key.
        const handler = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.removeEventListener('keydown', handler, true);
            if (e.code === 'Escape') return render();
            let keys = [...resolve_controls(this.data.properties)[action]];
            if (e.code === 'Delete' || e.code === 'Backspace') {
                if (slot < keys.length && keys.length > 1) keys.splice(slot, 1);
                else this.controls_notice = 'Jede Aktion braucht mindestens eine Taste.';
            } else if (!valid_key_code(e.code)) {
                this.controls_notice = key_warning(e.code) ?? 'Diese Taste kann nicht belegt werden.';
                return render();
            } else {
                keys[slot] = e.code;
                keys = [...new Set(keys.filter(Boolean))];
            }
            const control = GAME_CONTROLS.find(c => c.id === action);
            this.data.properties.controls ??= {};
            if (keys.join() === control.keys.join()) delete this.data.properties.controls[action];
            else this.data.properties.controls[action] = keys;
            if (!Object.keys(this.data.properties.controls).length) delete this.data.properties.controls;
            render();
        };
        window.addEventListener('keydown', handler, true);
    }

    // Pickers show sprite thumbnails by position; after sprites were reordered
    // or deleted they need to look up their (ID-based) choice again.
    refresh_sprite_reference_pickers() {
        this.drop_sprite_picker?.refresh();
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

    // Mischmodus: how the sprite is mixed with everything behind it.
    // Absent = normal transparency (old games).
    add_sprite_blend_control(si) {
        let self = this;
        new SelectWidget({
            container: $('#menu_sprite_properties'),
            label: 'Mischmodus',
            hint: 'So wird der Sprite mit allem dahinter gemischt. Leuchten: Farben werden addiert – gut für Licht, Feuer und Funken. Aufhellen: wie Leuchten, aber sanfter – gut für Geister und Nebel. Abdunkeln: Farben werden multipliziert – gut für Schatten, getöntes Glas und Wasser.',
            options: BLEND_MODES,
            get: () => self.data.sprites[si].blend ?? 'normal',
            set: (x) => {
                if (x === 'normal') delete self.data.sprites[si].blend; else self.data.sprites[si].blend = x;
                if (self.level_editor?.layer_structs?.length) {
                    self.level_editor.refresh_blend_materials();
                    self.level_editor.refresh();
                    self.level_editor.render();
                }
            },
        });
    }

    // Titel of the sprite (game_ids.js: absent = none, the sprite is called by
    // its number). Shown when hovering a sprite in the lists and in every
    // sprite picker.
    add_sprite_title_control(si) {
        new LineEditWidget({
            container: $('#menu_sprite_properties'),
            label: 'Titel',
            hint: 'Gib dem Sprite einen Titel, damit du es wiederfindest – zum Beispiel „Tür“, „Schlüssel“ oder „Glibber“. Du siehst ihn, wenn du mit der Maus auf ein Sprite zeigst, beim Platzieren im Level und überall, wo du ein Sprite auswählst.',
            get: () => sprite_title(this.data.sprites[si]),
            set: (x) => {
                if (x === sprite_title(this.data.sprites[si])) return;
                set_sprite_title(this.data.sprites[si], x);
                this.refresh_sprite_titles();
            },
        });
    }

    // Hover titles of the sprite list and the level editor's sprite buttons
    // (in list order, so they stay right after moving sprites around).
    refresh_sprite_titles() {
        $('#menu_sprites > ._dnd_item').not('.add, .placeholder').each((i, item) => {
            const sprite = this.data.sprites[i];
            if (sprite) $(item).attr('title', sprite_label(sprite, i));
        });
        $('#menu_level_sprites > .button').each((i, button) => {
            const si = $(button).data('sprite_index');
            if (this.data.sprites[si]) $(button).attr('title', sprite_label(this.data.sprites[si], si));
        });
        this.refresh_sprite_reference_pickers?.();
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
        this.add_sprite_title_control?.(si);
        this.refresh_sprite_titles?.();
        // Mischmodus first: the menu below unfolds downwards and must not cover it
        this.add_sprite_blend_control?.(si);
        // an unfolded menu scrolls inside its box instead of spilling over what follows
        let traits_menu = $('<div>').addClass('traits-menu').appendTo($('#menu_sprite_properties'));
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
        if (trait === 'baddie' && typeof BADDIE_BEHAVIORS !== 'undefined') this.add_behavior_controls(div, si);
        // Rarely needed settings (hitbox, screen shake …) sit in a folded "Erweitert" section.
        let advanced = null;
        for (let key in info.properties ?? {}) {
            let property = info.properties[key];
            // Some settings only matter for some behaviours (e.g. patrolling).
            if (typeof property.visible === 'function' && !property.visible(self.data.sprites[si].traits[trait], self.data.sprites[si].traits)) continue;
            let container = div;
            if (property.advanced) {
                if (!advanced) {
                    const details = $('<details>').addClass('trait-advanced').appendTo(div);
                    $('<summary>').text('Erweitert').appendTo(details);
                    advanced = $('<div>').appendTo(details);
                }
                container = advanced;
            }
            if (property.type === 'float') {
                new NumberWidget({
                    container: container,
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
                    container: container,
                    label: property.label ?? key,
                    hint: property.hint ?? null,
                    get: () => self.data.sprites[si].traits[trait][key],
                    set: (x) => {
                        self.data.sprites[si].traits[trait][key] = x;
                    },
                });
            } else if (property.type === 'select') {
                new SelectWidget({
                    container: container,
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
        if (trait === 'baddie') this.add_drop_controls?.(div, si);
        if (trait === 'door') this.add_door_state_help(div, si);
        div.insertAfter(element);
    }

    // "Verhalten": one select with named enemy types, each with only its own
    // settings. Loading a game gives old enemies their type (promote_baddie_behavior).
    add_behavior_controls(div, si) {
        const traits = this.data.sprites[si].traits.baddie;
        const type = baddie_behavior_type(traits);
        const info = BADDIE_BEHAVIORS[type];
        const options = {};
        for (const id of BADDIE_BEHAVIOR_ORDER) options[id] = BADDIE_BEHAVIORS[id].label;
        new SelectWidget({
            container: div, label: 'Verhalten', hint: info.hint, options,
            get: () => type,
            set: (x) => {
                if (!(x in BADDIE_BEHAVIORS) || x === type) return;
                set_baddie_behavior_type(traits, x);
                this.build_sprite_traits_menu();
            },
        });
        $('<p>').addClass('behavior-hint').text(info.hint).appendTo(div);
        for (const [key, setting] of Object.entries(info.settings)) {
            if (setting.type === 'bool') {
                new CheckboxWidget({
                    container: div, label: setting.label, hint: setting.hint,
                    get: () => traits.behavior?.[key] ?? setting.default,
                    set: (value) => {
                        traits.behavior = { ...(traits.behavior ?? { type }), [key]: Boolean(value) };
                    },
                });
                continue;
            }
            new NumberWidget({
                container: div, label: setting.label, hint: setting.hint,
                min: setting.min, max: setting.max, step: setting.step,
                decimalPlaces: setting.decimalPlaces, suffix: setting.suffix,
                get: () => traits.behavior?.[key] ?? setting.default,
                set: (value) => {
                    traits.behavior = { ...(traits.behavior ?? { type }), [key]: value };
                },
            });
        }
        $('<div>').addClass('behavior-separator').appendTo(div);
    }

    // Target-owned visual feedback, independent of weapon/attack settings.
    // Merely opening the editor does not add properties to saved game JSON.
    // Beute: what a defeated enemy leaves behind (traits.baddie.drop).
    add_drop_controls(div, si) {
        const baddie = () => this.data.sprites[si].traits.baddie;
        const box = $('<div>').appendTo(div);
        const render = () => {
            box.empty();
            this.drop_sprite_picker = new SpriteSelectWidget({
                container: box, label: 'Beute:',
                none_label: 'Keine Beute',
                hint: 'Das lässt der Gegner zurück, wenn er besiegt ist – zum Beispiel einen Schlüssel, ein Extraleben oder Münzen. Das Sprite braucht die Eigenschaft „man kann es einsammeln“ oder „ist ein Schlüssel“.',
                sprites: () => this.data.sprites,
                get: () => {
                    const id = baddie().drop?.sprite_id;
                    const index = typeof id === 'string' ? this.data.sprites.findIndex(sprite => sprite.id === id) : -1;
                    return index >= 0 ? String(index) : 'none';
                },
                set: (choice) => {
                    const index = Number(choice);
                    if (choice === 'none') delete baddie().drop;
                    else if (Number.isInteger(index) && this.data.sprites[index]) {
                        const { sprite_index, ...drop } = baddie().drop ?? {};
                        baddie().drop = { ...drop, sprite_id: this.data.sprites[index].id };
                    }
                    render();
                },
            });
            const chosen_id = baddie().drop?.sprite_id;
            const chosen = typeof chosen_id === 'string' ? this.data.sprites.find(sprite => sprite.id === chosen_id) : null;
            if (!chosen) return;
            new CheckboxWidget({
                container: box, label: 'gibt die Beute ab, wenn man ihn berührt',
                hint: 'Man muss den Gegner nicht besiegen: Wer ihn einholt und berührt, bekommt die Beute. Gut für einen Dieb, der wegläuft.',
                get: () => baddie().drop?.on_touch === true,
                set: (value) => {
                    if (value) baddie().drop.on_touch = true;
                    else delete baddie().drop.on_touch;
                },
            });
            if ('key' in chosen.traits) {
                new NumberWidget({
                    container: box, label: 'Schlüssel-Code',
                    hint: 'Der Schlüssel öffnet Türen mit demselben Code. Das gilt für jeden Gegner dieser Art – im Level kannst du jedem einzelnen einen eigenen Code geben: Klick ihn an und stell „Code der Beute“ ein.',
                    min: 0, max: 1000, step: 1, decimalPlaces: 0,
                    get: () => baddie().drop?.signal_code ?? 0,
                    set: (x) => { baddie().drop.signal_code = Math.round(x); },
                });
            } else if (!('pickup' in chosen.traits)) {
                $('<div>').css({ margin: '4px 5px 8px', color: '#d8b34d', 'font-size': '0.9em' })
                    .text('Dieses Sprite kann man nicht einsammeln. Gib ihm „man kann es einsammeln“ oder „ist ein Schlüssel“.')
                    .appendTo(box);
            }
        };
        render();
    }

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
            get: () => {
                const id = attack.visual?.attack_sprite_id;
                const index = typeof id === 'string' ? this.data.sprites.findIndex(sprite => sprite.id === id) : -1;
                return index >= 0 ? String(index) : 'none';
            },
            set: (choice) => {
                const index = Number(choice);
                if (choice !== 'none' && (!Number.isInteger(index) || index < 0 ||
                    !this.data.sprites[index])) return;
                const visual = attack.visual && typeof attack.visual === 'object' ? attack.visual : {};
                delete visual.attack_sprite_index;
                if (choice === 'none') delete visual.attack_sprite_id;
                else visual.attack_sprite_id = this.data.sprites[index].id;
                attack.visual = visual;
            },
        });
        this.hit_sprite_picker = new SpriteSelectWidget({
            container: div, label: 'Treffereffekt:',
            hint: 'Zeichne einen eigenen Sprite (auch mehrere Frames möglich) und wähle ihn hier aus. Das Bild erscheint nur bei einem Treffer und ändert weder Schaden noch Reichweite.',
            sprites: () => this.data.sprites,
            get: () => {
                const id = attack.visual?.hit_sprite_id;
                const index = typeof id === 'string' ? this.data.sprites.findIndex(sprite => sprite.id === id) : -1;
                return index >= 0 ? String(index) : 'none';
            },
            set: (choice) => {
                const index = Number(choice);
                if (choice !== 'none' && (!Number.isInteger(index) || index < 0 ||
                    !this.data.sprites[index])) return;
                const visual = attack.visual && typeof attack.visual === 'object' ? attack.visual : {};
                delete visual.hit_sprite_index;
                if (choice === 'none') delete visual.hit_sprite_id;
                else visual.hit_sprite_id = this.data.sprites[index].id;
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
            'K schießt. Bei Maus-Zielen geht auch ein Linksklick ins Spielfeld.');
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
        new CheckboxWidget({
            container: bomb_controls, label: 'Eigene Spielfigur verletzen:',
            hint: 'Nur für selbst gelegte Bomben: Die Explosion kann auch deine Spielfigur treffen. Aus bedeutet, dass du gegen deine eigenen Bomben geschützt bist.',
            get: () => attack.delivery?.detonation?.self_damage ?? false,
            set: checked => {
                if (attack.delivery.detonation) attack.delivery.detonation.self_damage = !!checked;
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
        let angle_controls = null;
        new SelectWidget({
            container: div, label: 'Zielen:',
            hint: 'Blickrichtung schießt mit K dorthin, wohin die Figur schaut – waagerecht oder im eingestellten Winkel. Maus richtet den Schuss nach der Maus aus. Gegner zielen damit direkt auf die Spielfigur.',
            options: { horizontal: 'Blickrichtung', mouse: 'Maus' },
            get: () => attack.delivery?.aim_mode ?? 'horizontal',
            set: choice => {
                if (!['horizontal', 'mouse'].includes(choice)) return;
                attack.delivery.aim_mode = choice;
                angle_controls?.toggle(choice !== 'mouse');
            },
        });
        angle_controls = $('<div>').appendTo(div);
        new NumberWidget({
            container: angle_controls, label: 'Winkel:',
            hint: '0 bedeutet waagerecht. Größere Werte schießen schräg nach oben (45 = diagonal), negative schräg nach unten. Mit Schwerkraft fliegt das Projektil dann einen Bogen.',
            min: -80, max: 80, step: 5, decimalPlaces: 0, suffix: '°',
            get: () => attack.delivery?.aim_angle_deg ?? 0,
            set: value => {
                if (!Number.isFinite(value) || value < -80 || value > 80) return;
                if (value === 0) delete attack.delivery.aim_angle_deg;
                else attack.delivery.aim_angle_deg = value;
            },
        });
        angle_controls.toggle((attack.delivery?.aim_mode ?? 'horizontal') !== 'mouse');
        section('So sieht der Angriff aus');
        const picker = (field, key, hint) => new SpriteSelectWidget({
            container: div, label: field,
            hint, sprites: () => this.data.sprites,
            get: () => {
                const id = attack.visual?.[`${key}_id`];
                const index = typeof id === 'string' ? this.data.sprites.findIndex(sprite => sprite.id === id) : -1;
                return index >= 0 ? String(index) : 'none';
            },
            set: choice => {
                const index = Number(choice);
                if (choice !== 'none' && (!Number.isInteger(index) || index < 0 ||
                    !this.data.sprites[index])) return;
                attack.visual ??= {};
                delete attack.visual[`${key}_index`];
                if (choice === 'none') delete attack.visual[`${key}_id`];
                else attack.visual[`${key}_id`] = this.data.sprites[index].id;
            },
        });
        this.ranged_projectile_picker = picker('Projektilsprite:', 'projectile_sprite',
            'Zeichne normale Projektile nach rechts.');
        this.ranged_hit_picker = picker('Treffereffekt:', 'hit_sprite',
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
                        /^(?:(?:walk|jump|fall|attack|hit|swim|float|drift|dive|rise)_)?(?:front|back|left|right)$/.test(x) ?
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

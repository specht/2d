class Game {
    constructor() {
        this.data = null;
        this.reset();
    }

    reset() {
        this.data = {
            parent: null,
            sprites: [
                {
                    states: [
                        {
                            frames: [
                                { src: createDataUrlForImageSize(24, 24), width: 24, height: 24 }
                            ]
                        }
                    ]
                }
            ]
        };
        this._load();
    }

    load(tag) {
        console.log(`Loading game: ${tag}`);
        let self = this;

        api_call('/api/load_game', { tag: tag }, function (data) {
            if (data.success) {
                self.data = data.game;
                this._load();
            }
        });
    }

    save() {
        let data = {};
        data.parent = this.data.parent;
        data.title = this.data.title;
        data.sprites = [];
        for (let sprite of this.data.sprites) {
            let states = [];
            for (let state of sprite.states) {
                let frames = [];
                for (let frame of state.frames) {
                    frames.push(frame);
                }
                let state_data = { frames: frames };
                if (state.label) state_data.label = state.label;
                if (typeof (state.gravity) !== 'undefined') state_data.gravity = state.gravity;
                if (typeof (state.movable) !== 'undefined') state_data.gravity = state.movable;
                states.push(state_data);
            }
            data.sprites.push({ states: states });
        }
        console.log(data);
        let self = this;
        api_call('/api/save_game', { game: data }, function (data) {
            if (data.success) {
                if (data.tag !== self.data.parent) {
                    self.data.parent = data.tag;
                }
                console.log(data);
            }
        });
    }

    _load() {
        canvas.setGame(this.data);
        let first_png = true;
        let sprite_div = $(`#menu_sprites`);
        sprite_div.empty();
        let self = this;
        for (let si = 0; si < this.data.sprites.length; si++) {
            let sprite_info = this.data.sprites[si];
            for (let sti = 0; sti < sprite_info.states.length; sti++) {
                let state_info = sprite_info.states[sti];
                for (let fi = 0; fi < state_info.frames.length; fi++) {
                    let frame_info = state_info.frames[fi];
                    let tag = frame_info.tag;
                    let frame = {};
                    frame.src = frame_info.src;
                    frame.width = frame_info.width;
                    frame.height = frame_info.height;
                    let img = null;
                    if (sti == 0 && fi === 0) {
                        img = $('<img>').attr('src', frame_info.src);
                        sprite_div.append(img);
                    }
                    this.data.sprites[si].states[sti].frames[fi] = frame;
                    if (first_png) {
                        img.addClass('active');
                        canvas.attachSprite(si, sti, fi, [img]);
                        first_png = false;
                    }
                    if (img != null) {
                        img.click(function (e) {
                            sprite_div.find('img').removeClass('active');
                            canvas.attachSprite(si, sti, fi, [img]);
                            img.addClass('active');
                        });
                    }
                }
            }
        }
    }
}

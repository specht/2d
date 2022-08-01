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
                self._load();
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
        canvas.setGame(this);
        let self = this;
        for (let si = 0; si < this.data.sprites.length; si++) {
            let sprite_info = this.data.sprites[si];
            for (let sti = 0; sti < sprite_info.states.length; sti++) {
                let state_info = sprite_info.states[sti];
                for (let fi = 0; fi < state_info.frames.length; fi++) {
                    let frame_info = state_info.frames[fi];
                    let frame = {};
                    frame.src = frame_info.src;
                    frame.width = frame_info.width;
                    frame.height = frame_info.height;
                    this.data.sprites[si].states[sti].frames[fi] = frame;
                }
            }
        }

        new DragAndDropWidget({
            container: $('#menu_sprites'),
            trash: $('#trash'),
            items: this.data.sprites,
            item_class: 'menu_sprite_item',
            onclick: (e, index) => {
                $(e).closest('.menu_sprite_item').parent().parent().find('.menu_sprite_item').removeClass('active');
                $(e).parent().addClass('active');
                canvas.attachSprite(index, 0, 0, {sprites: $(e).closest('.menu_sprite_item').parent().parent().find('.menu_sprite_item')});
            },
            gen_item: (item) => {
                let img = $('<img>');
                img.attr('src', item.states[0].frames[0].src);
                return img;
            },
            gen_new_item: () => {
                let width = 24; let height = 24;
                let src = createDataUrlForImageSize(width, height);
                let sprite = {states: [{frames: [{ src: src, width: width, height: height }]}]};
                self.data.sprites.push(sprite);
                return sprite;
            },
            delete_item: (index) => {
                canvas.detachSprite();
                self.data.sprites.splice(index, 1);
                this.refresh_frames_on_screen();
            },
            on_swap_items: (a, b) => {
                console.log('swap', a, b);
                let temp = self.data.sprites[a];
                self.data.sprites[a] = self.data.sprites[b];
                self.data.sprites[b] = temp;
                this.refresh_frames_on_screen();
            }
        });
    }

    refresh_frames_on_screen() {
        for (let si = 0; si < this.data.sprites.length; si++) {
            $('#menu_sprites ._dnd_item img').eq(si).attr('src', this.data.sprites[si].states[0].frames[0].src);
        }
        if (canvas.sprite_index !== null) {
            for (let sti = 0; sti < this.data.sprites[canvas.sprite_index].states.length; sti++) {
                $('#menu_states ._dnd_item img').eq(sti).attr('src', this.data.sprites[canvas.sprite_index].states[sti].frames[0].src);
            }
        }
    }
}

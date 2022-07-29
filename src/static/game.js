class Game {
    constructor(path) {
        this.data = null;
        this.loadFromPath(path);
    }

    loadFromPath(path) {
        console.log(`Loading game: ${path}`);
        let self = this;
        $.get(`/gen/games/${path}`, {}).done(function (data) {
            self.data = data;
            // console.log(data);
            let first_png = true;
            let sprite_div = $(`#right_menu_container .menu_sprites`);
            for (let si = 0; si < data.sprites.length; si++) {
                let sprite_info = data.sprites[si];
                let sprite = new Sprite();
                for (let sti = 0; sti < sprite_info.states.length; sti++) {
                    let state_info = sprite_info.states[sti];
                    for (let fi = 0; fi < state_info.frames.length; fi++) {
                        let frame_info = state_info.frames[fi];
                        let tag = frame_info.tag;
                        let frame = new Frame();
                        frame.loadFromUrl(`/gen/png/${tag}.png`, function () {
                            let img = $('<img>').attr('src', frame.src);
                            sprite_div.append(img);
                            self.data.sprites[si].states[sti].frames[fi] = frame;
                            if (first_png) {
                                img.addClass('active');
                                canvas.attachSprite(self.data.sprites[si], 0, 0, [img]);
                                first_png = false;
                            }
                            img.click(function(e) {
                                sprite_div.find('img').removeClass('active');
                                canvas.attachSprite(self.data.sprites[si], sti, fi, [img]);
                                img.addClass('active');
                            });
                        });
                    }
                }
            }
        }).fail(function () {
            console.log('error');
        });
    }
}
class Game {
    constructor() {
        this.data = null;
        // this.loadFromPath(path);
    }

    load(tag) {
        console.log(`Loading game: ${tag}`);
        let self = this;

        api_call('/api/load_game', {tag: tag}, function(data) {
            if (data.success) {
                console.log(data);
                data = data.game;
                self.data = data;
                let first_png = true;
                let sprite_div = $(`#menu_sprites`);
                for (let si = 0; si < data.sprites.length; si++) {
                    let sprite_info = data.sprites[si];
                    let sprite = new Sprite();
                    for (let sti = 0; sti < sprite_info.states.length; sti++) {
                        let state_info = sprite_info.states[sti];
                        for (let fi = 0; fi < state_info.frames.length; fi++) {
                            let frame_info = state_info.frames[fi];
                            let tag = frame_info.tag;
                            let frame = new Frame();
                            frame.src = frame_info.src;
                            let img = $('<img>').attr('src', frame_info.src);
                            sprite_div.append(img);
                            self.data.sprites[si].states[sti].frames[fi] = frame;
                            if (first_png) {
                                img.addClass('active');
                                console.log(self.data.sprites[si]);
                                canvas.attachSprite(self.data.sprites[si], sti, fi, [img]);
                                first_png = false;
                            }
                            img.click(function(e) {
                                sprite_div.find('img').removeClass('active');
                                canvas.attachSprite(self.data.sprites[si], sti, fi, [img]);
                                img.addClass('active');
                            });
                        }
                    }
                }
                 }
        });
    }
}
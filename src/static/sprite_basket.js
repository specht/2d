// Sprites aus einem anderen Spiel holen (sprite editor: the basket tile next
// to + in the sprite list, or Funktionen → Sprite).
//
// A child opens another game by its code (or a recipe's scene), puts sprites
// into a basket – from as many games as they like – and brings them into
// their own game in one go, with all states, frames, settings and Eigen-
// schaften. Nothing in the other game changes, and nothing is shared between
// the games afterwards: the copies are new sprites with new IDs.
//
// A sprite may refer to other sprites of its game (the picture of an attack,
// a projectile, what an enemy leaves behind). Those come along by themselves
// ("kommt mit"), and the copies refer to each other. Placed settings (Codes,
// texts …) belong to levels and do not travel.

// ------------------------------------------------------------ pure helpers

function basket_clone(value) {
    return JSON.parse(JSON.stringify(value));
}

// IDs of the sprites this sprite refers to.
function sprite_reference_ids(sprite) {
    const ids = [];
    for_each_sprite_reference_in_sprite(basket_clone(sprite), (container, _index_key, id_key) => {
        if (typeof container[id_key] === 'string') ids.push(container[id_key]);
    });
    return ids;
}

// The chosen sprites plus everything they need, in the order of the source
// game. `needed` lists the ones that only come along.
function sprites_with_dependencies(data, chosen_ids) {
    const by_id = new Map((data?.sprites ?? []).map(s => [s.id, s]));
    const take = new Set();
    const queue = [...chosen_ids].filter(id => by_id.has(id));
    while (queue.length) {
        const id = queue.shift();
        if (take.has(id)) continue;
        take.add(id);
        for (const ref of sprite_reference_ids(by_id.get(id))) if (by_id.has(ref) && !take.has(ref)) queue.push(ref);
    }
    const ids = (data?.sprites ?? []).map(s => s.id).filter(id => take.has(id));
    const chosen = new Set(chosen_ids);
    return { ids, needed: ids.filter(id => !chosen.has(id)) };
}

// Copies of `sprites` that can be added to `target` (a game's data): new IDs,
// and references between the copied sprites point at the copies. A reference
// to a sprite that is not copied stays as it is (duplicating a sprite in the
// same game keeps its projectile), unless `drop_other_references` is set (from
// another game, where that ID would mean nothing or something else).
function copy_sprites_for(target, sprites, { drop_other_references = false } = {}) {
    const taken = { sprites: [...(target?.sprites ?? [])] };
    const id_map = new Map();
    const copies = sprites.map(sprite => {
        const copy = basket_clone(sprite);
        const old_id = copy.id;
        delete copy.id;
        assign_new_game_id(taken, 'sprites', copy);
        taken.sprites.push(copy);
        if (old_id !== undefined) id_map.set(old_id, copy.id);
        // pictures only: the frames' server tags belong to the other game
        for (const state of copy.states ?? [])
            state.frames = (state.frames ?? []).map(frame => ({ src: frame.src }));
        return copy;
    });
    for (const copy of copies) {
        for_each_sprite_reference_in_sprite(copy, (container, _index_key, id_key, clear) => {
            if (!(id_key in container)) return;
            if (id_map.has(container[id_key])) container[id_key] = id_map.get(container[id_key]);
            else if (drop_other_references) clear();
        });
    }
    return copies;
}

// A game from elsewhere as the studio would see it (IDs, references by ID).
function normalized_source_game(data) {
    const holder = { data: basket_clone(data) };
    if (typeof Game === 'function' && Game.prototype.fix_game_data) Game.prototype.fix_game_data.call(holder);
    else { ensure_game_ids(holder.data); convert_sprite_references_to_ids(holder.data); }
    return holder.data;
}

// ------------------------------------------------------------ the studio

if (typeof Game === 'function') {
    // Adds new sprites (already with IDs) at the end of the list and shows the
    // first one. Used by the basket and by Duplizieren.
    Game.prototype.add_sprites = function (sprites, { select = true } = {}) {
        if (!sprites.length) return;
        const first = this.data.sprites.length;
        for (const sprite of sprites) this.data.sprites.push(sprite);
        this.fix_game_data();
        for (let si = first; si < this.data.sprites.length; si++)
            this.create_geometry_and_material_for_sprite(si);
        for (const sprite of sprites) window.collaboration?.structure_changed?.('sprite', 'insert', sprite.id);
        this.sprites_widget?.append_items(first);
        this.refresh_sprite_reference_pickers();
        this.level_editor?.refresh_sprite_widget?.();
        setTimeout(() => this.refresh_sprite_titles(), 0);
        if (select) this.sprites_widget?.select_index(first);
    };
}

const SPRITE_BASKET_CODE = /^[0-9a-z]{7}$/;

class SpriteBasket {
    constructor() {
        this.source = null;          // { key, name, data }
        this.items = [];             // { key, source_key, source_name, sprite_id, label, preview }
        this.sources = new Map();    // key → { name, data } of everything in the basket
        this.timer = null;
        this.build();
    }

    build() {
        const self = this;
        this.modal = new ModalDialog({
            title: 'Sprites aus einem anderen Spiel holen',
            width: '920px',
            max_width: '94vw',
            height: '86vh',
            body: `
                <div class="basket">
                    <div class="basket-source">
                        <label class="basket-field">
                            <span>Code des Spiels</span>
                            <input id="basket_code" maxlength="7" autocomplete="off" spellcheck="false" placeholder="4n2zuhp">
                        </label>
                        <button type="button" id="basket_open" class="basket-open">Öffnen</button>
                        <label class="basket-field basket-recipe-field">
                            <span>oder aus einem Rezept</span>
                            <select id="basket_recipe"><option value="">Rezept wählen …</option></select>
                        </label>
                    </div>
                    <div class="basket-info" id="basket_info">Öffne ein Spiel, aus dem du Sprites holen möchtest – zum Beispiel eins, das dir gut gefällt. Dann klickst du die Sprites an, die du haben willst.</div>
                    <div class="basket-grid" id="basket_grid"></div>
                </div>
            `,
            onshow: () => self.shown(),
            footer: [
                { type: 'button', label: 'Schließen', callback: (modal) => modal.dismiss() },
                { type: 'button', label: 'In mein Spiel holen', color: 'green', callback: () => self.import() },
            ],
        });
        // the basket itself: above the buttons
        this.tray = $('<div>').addClass('basket-tray').insertBefore(this.modal.dialog.find('.modal-footer'));
        this.import_button = this.modal.dialog.find('.modal-footer button.green');
        $('#basket_open').on('click', () => this.open_code());
        $('#basket_code').on('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.open_code(); } });
        $('#basket_recipe').on('change', (e) => {
            const id = e.target.value;
            if (id) this.open_recipe(id);
        });
        // stop animating while the dialog is closed
        const hide = this.modal.hide.bind(this.modal);
        this.modal.hide = () => { this.stop_animation(); hide(); };
    }

    shown() {
        const recipes = (window.recipe_gallery?.recipes ?? []).filter(r => window.recipe_gallery.scene_url?.(r));
        const select = $('#basket_recipe');
        if (select.children().length !== recipes.length + 1) {
            select.find('option:not(:first)').remove();
            for (const r of recipes) $('<option>').val(r.id).text(r.titel).appendTo(select);
        }
        select.closest('.basket-recipe-field').toggle(recipes.length > 0);
        this.render_grid();
        this.render_tray();
        this.start_animation();
        if (!this.source) $('#basket_code').trigger('focus');
    }

    info(text, error = false) {
        $('#basket_info').text(text).toggleClass('error', error);
    }

    open_code() {
        const code = String($('#basket_code').val() ?? '').trim().toLowerCase();
        if (!SPRITE_BASKET_CODE.test(code)) {
            this.info('Ein Spielcode hat sieben Zeichen (Buchstaben und Ziffern), zum Beispiel 4n2zuhp.', true);
            return;
        }
        $('#basket_recipe').val('');
        this.info('Das Spiel wird geöffnet …');
        api_call('/api/load_game', { tag: code }, (result) => {
            if (!result.success || !result.game) {
                this.info(`Es gibt kein Spiel mit dem Code ${code}.`, true);
                return;
            }
            const name = this.game_name(result.game, code);
            this.set_source(`game:${code}`, name, result.game);
        });
    }

    async open_recipe(id) {
        const recipe = window.recipe_gallery?.recipes?.find(r => r.id === id);
        const url = recipe && window.recipe_gallery.scene_url(recipe);
        if (!url) return;
        $('#basket_code').val('');
        this.info('Das Rezept wird geöffnet …');
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            this.set_source(`recipe:${id}`, `Rezept „${recipe.titel}“`, await response.json());
        } catch (e) {
            this.info('Das Rezept konnte nicht geöffnet werden.', true);
        }
    }

    game_name(data, code) {
        const title = String(data?.properties?.title ?? '').trim();
        const author = String(data?.properties?.author ?? '').trim();
        if (title && author) return `„${title}“ von ${author}`;
        if (title) return `„${title}“`;
        return `Spiel ${code}`;
    }

    set_source(key, name, data) {
        this.source = { key, name, data: normalized_source_game(data) };
        const count = this.source.data.sprites.length;
        this.info(`${name}: ${count === 1 ? '1 Sprite' : `${count} Sprites`}. Klicke die Sprites an, die du in den Korb legen möchtest.`);
        this.render_grid();
    }

    in_basket(source_key, sprite_id) {
        return this.items.some(i => i.source_key === source_key && i.sprite_id === sprite_id);
    }

    // Sprites that come along with what is in the basket (from the same game).
    needed(source_key) {
        const source = this.sources.get(source_key);
        if (!source) return [];
        const chosen = this.items.filter(i => i.source_key === source_key).map(i => i.sprite_id);
        return sprites_with_dependencies(source.data, chosen).needed;
    }

    toggle(sprite) {
        const source = this.source;
        if (this.in_basket(source.key, sprite.id)) {
            this.items = this.items.filter(i => !(i.source_key === source.key && i.sprite_id === sprite.id));
        } else {
            this.sources.set(source.key, { name: source.name, data: source.data });
            const index = source.data.sprites.indexOf(sprite);
            this.items.push({ source_key: source.key, source_name: source.name, sprite_id: sprite.id,
                label: sprite_label(sprite, index), sprite });
        }
        for (const key of [...this.sources.keys()])
            if (!this.items.some(i => i.source_key === key)) this.sources.delete(key);
        this.render_grid();
        this.render_tray();
    }

    // A sprite as a little animation: the frames of its first state.
    preview(sprite) {
        const frames = (sprite.states?.[0]?.frames ?? []).map(f => f.src).filter(Boolean);
        const fps = Number(sprite.states?.[0]?.properties?.fps) || 8;
        const img = $('<img>').addClass('basket-preview').attr('src', frames[Math.floor(frames.length / 2 - 0.5)] ?? frames[0] ?? '');
        if (frames.length > 1) img.data('frames', frames).data('fps', fps);
        return img;
    }

    describe(sprite) {
        const states = sprite.states?.length ?? 0;
        const frames = (sprite.states ?? []).reduce((n, s) => n + (s.frames?.length ?? 0), 0);
        return `${sprite.width}×${sprite.height} · ${states === 1 ? '1 Zustand' : `${states} Zustände`} · ${frames === 1 ? '1 Frame' : `${frames} Frames`}`;
    }

    render_grid() {
        const grid = $('#basket_grid').empty();
        if (!this.source) return;
        const needed = new Set(this.needed(this.source.key));
        this.source.data.sprites.forEach((sprite, index) => {
            const chosen = this.in_basket(this.source.key, sprite.id);
            const card = $('<button>').attr('type', 'button').addClass('basket-card')
                .toggleClass('chosen', chosen).toggleClass('needed', needed.has(sprite.id))
                .attr('title', chosen ? 'Aus dem Korb nehmen' : 'In den Korb legen')
                .on('click', () => this.toggle(sprite))
                .appendTo(grid);
            $('<div>').addClass('basket-card-bild').append(this.preview(sprite)).appendTo(card);
            $('<div>').addClass('basket-card-name').text(sprite_label(sprite, index)).appendTo(card);
            $('<div>').addClass('basket-card-info').text(this.describe(sprite)).appendTo(card);
            if (chosen) $('<div>').addClass('basket-card-mark').html('<i class="fa fa-check"></i>').appendTo(card);
            else if (needed.has(sprite.id)) $('<div>').addClass('basket-card-mark').text('kommt mit').appendTo(card);
        });
    }

    render_tray() {
        const tray = this.tray.empty();
        const needed_count = [...this.sources.keys()].reduce((n, key) => n + this.needed(key).length, 0);
        const label = $('<div>').addClass('basket-tray-label').appendTo(tray);
        $('<i>').addClass('fa fa-shopping-basket').appendTo(label);
        if (!this.items.length) {
            label.append(document.createTextNode(' Der Korb ist leer.'));
        } else {
            label.append(document.createTextNode(` Im Korb: ${this.items.length === 1 ? '1 Sprite' : `${this.items.length} Sprites`}`
                + (needed_count ? ` (und ${needed_count === 1 ? '1 Sprite, das' : `${needed_count} Sprites, die`} dazugehör${needed_count === 1 ? 't' : 'en'})` : '')));
        }
        const list = $('<div>').addClass('basket-tray-items').appendTo(tray);
        for (const item of this.items) {
            $('<button>').attr('type', 'button').addClass('basket-tray-item')
                .attr('title', `${item.label} (aus ${item.source_name}) – zum Herausnehmen anklicken`)
                .append(this.preview(item.sprite))
                .append($('<i>').addClass('fa fa-times'))
                .on('click', () => {
                    this.items = this.items.filter(i => i !== item);
                    if (!this.items.some(i => i.source_key === item.source_key)) this.sources.delete(item.source_key);
                    this.render_grid();
                    this.render_tray();
                })
                .appendTo(list);
        }
        const total = this.items.length + needed_count;
        this.import_button.prop('disabled', total === 0)
            .contents().last().replaceWith(document.createTextNode(total ? `In mein Spiel holen (${total})` : 'In mein Spiel holen'));
    }

    import() {
        if (!this.items.length) return;
        const copies = [];
        for (const [key, source] of this.sources) {
            const chosen = this.items.filter(i => i.source_key === key).map(i => i.sprite_id);
            const { ids } = sprites_with_dependencies(source.data, chosen);
            const sprites = ids.map(id => source.data.sprites.find(s => s.id === id));
            copies.push(...copy_sprites_for({ sprites: [...game.data.sprites, ...copies] }, sprites, { drop_other_references: true }));
        }
        game.add_sprites(copies);
        this.items = [];
        this.sources.clear();
        this.modal.dismiss();
        if (window.current_pane !== 'sprites') window.studio_show_pane?.('sprites');
    }

    start_animation() {
        this.stop_animation();
        const t0 = performance.now();
        this.timer = setInterval(() => {
            if (!this.modal.dialog.is(':visible')) { this.stop_animation(); return; }
            const t = (performance.now() - t0) / 1000;
            for (const img of this.modal.dialog.find('img.basket-preview')) {
                const frames = $(img).data('frames');
                if (!frames) continue;
                const src = frames[Math.floor(t * $(img).data('fps')) % frames.length];
                if (img.getAttribute('src') !== src) img.setAttribute('src', src);
            }
        }, 40);
    }

    stop_animation() {
        clearInterval(this.timer);
        this.timer = null;
    }
}

function show_sprite_basket() {
    window.sprite_basket ??= new SpriteBasket();
    window.sprite_basket.modal.show();
}

if (typeof module !== 'undefined') module.exports = { sprite_reference_ids, sprites_with_dependencies, copy_sprites_for };

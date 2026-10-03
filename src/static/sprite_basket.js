// Sprites aus einem anderen Spiel holen (sprite editor: the basket tile next
// to + in the sprite list, or Funktionen → Sprite).
//
// Two places to take sprites from: the Sprite-Katalog – every sprite of the
// recipes (and a few more), grouped (Spielfiguren, Gegner, Natur …), written
// by the recipe build as /rezepte/katalog.json – and any other game, opened by
// its code. A child puts sprites into a basket – from as many places as they
// like – and brings them into their own game in one go, with all states,
// frames, settings and Eigenschaften. Nothing at the source changes, and
// nothing is shared afterwards: the copies are new sprites with new IDs.
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

// The catalogue's groups with their sprites (file: katalog.json, { gruppen:
// [{ name, sprites: [ids] }], spiel }), only those whose Titel or group
// contains every word of the search text. Empty groups are left out.
function catalogue_groups(file, search = '') {
    const by_id = new Map((file?.spiel?.sprites ?? []).map(sprite => [sprite.id, sprite]));
    const plain = (text) => String(text ?? '').toLocaleLowerCase('de');
    const words = plain(search).split(/\s+/).filter(Boolean);
    return (file?.gruppen ?? []).map(group => ({
        name: group.name,
        sprites: (group.sprites ?? []).map(id => by_id.get(id)).filter(Boolean)
            .filter(sprite => words.every(word => plain(`${sprite_title(sprite)} ${group.name}`).includes(word))),
    })).filter(group => group.sprites.length);
}

// ------------------------------------------------------------ the studio

const SPRITE_BASKET_CODE = /^[0-9a-z]{7}$/;
const SPRITE_CATALOGUE_KEY = 'katalog';

class SpriteBasket {
    constructor() {
        this.view = 'katalog';       // 'katalog' | 'code'
        this.source = null;          // the game opened by its code: { key, name, data }
        this.catalogue = null;       // { key, name, data, groups } once loaded
        this.catalogue_loading = null;
        this.search = '';
        this.items = [];             // { source_key, source_name, sprite_id, label, sprite }
        this.sources = new Map();    // key → { name, data } of everything in the basket
        this.timer = null;
        this.build();
    }

    build() {
        const self = this;
        this.modal = new ModalDialog({
            title: 'Sprites holen',
            width: '980px',
            max_width: '94vw',
            height: '88vh',
            body: `
                <div class="basket">
                    <div class="basket-tabs">
                        <button type="button" class="basket-tab" data-view="katalog"><i class="fa fa-th-large"></i> Sprite-Katalog</button>
                        <button type="button" class="basket-tab" data-view="code"><i class="fa fa-gamepad"></i> Aus einem anderen Spiel</button>
                    </div>
                    <div class="basket-source basket-view" data-view="katalog">
                        <label class="basket-field basket-search-field">
                            <span>Suchen</span>
                            <input id="basket_search" type="search" autocomplete="off" spellcheck="false" placeholder="z. B. Baum, Münze, Hund">
                        </label>
                        <div class="basket-group-links" id="basket_group_links"></div>
                    </div>
                    <div class="basket-source basket-view" data-view="code">
                        <label class="basket-field">
                            <span>Code des Spiels</span>
                            <input id="basket_code" maxlength="7" autocomplete="off" spellcheck="false" placeholder="4n2zuhp">
                        </label>
                        <button type="button" id="basket_open" class="basket-open">Öffnen</button>
                    </div>
                    <div class="basket-info" id="basket_info"></div>
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
        this.modal.dialog.find('.basket-tab').on('click', (e) => this.show_view($(e.currentTarget).data('view')));
        $('#basket_open').on('click', () => this.open_code());
        $('#basket_code').on('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.open_code(); } });
        $('#basket_search').on('input', (e) => {
            this.search = e.target.value;
            this.render_grid();
        });
        // stop animating while the dialog is closed
        const hide = this.modal.hide.bind(this.modal);
        this.modal.hide = () => { this.stop_animation(); hide(); };
    }

    shown() {
        this.show_view(this.view);
        this.render_tray();
        this.start_animation();
    }

    show_view(view) {
        this.view = view === 'code' ? 'code' : 'katalog';
        this.modal.dialog.find('.basket-tab').each((_, el) => $(el).toggleClass('active', $(el).data('view') === this.view));
        this.modal.dialog.find('.basket-view').each((_, el) => $(el).toggle($(el).data('view') === this.view));
        if (this.view === 'katalog') {
            this.load_catalogue();
            $('#basket_search').trigger('focus');
        } else {
            if (this.source) this.source_info(this.source);
            else this.info('Öffne ein anderes Spiel mit seinem Code – zum Beispiel eins, das dir gut gefällt. Dann klickst du die Sprites an, die du haben willst.');
            $('#basket_code').trigger('focus');
        }
        this.render_grid();
    }

    info(text, error = false) {
        $('#basket_info').text(text).toggleClass('error', error);
    }

    source_info(source) {
        const count = source.data.sprites.length;
        this.info(`${source.name}: ${count === 1 ? '1 Sprite' : `${count} Sprites`}. Klicke die Sprites an, die du in den Korb legen möchtest.`);
    }

    // The Sprite-Katalog (katalog.json, written by the recipe build), once.
    load_catalogue() {
        if (this.catalogue) {
            this.info('Alle Sprites aus den Rezepten und noch ein paar mehr. Klicke an, was du in deinem Spiel haben möchtest.');
            return;
        }
        if (this.catalogue_loading) return;
        this.info('Der Sprite-Katalog wird geladen …');
        this.catalogue_loading = fetch(`/rezepte/katalog.json?${window.CACHE_BUSTER || Date.now()}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(file => {
                const data = normalized_source_game(file.spiel);
                this.catalogue = { key: SPRITE_CATALOGUE_KEY, name: 'dem Sprite-Katalog', data, file: { ...file, spiel: data } };
                if (this.view === 'katalog') {
                    this.load_catalogue();
                    this.render_grid();
                }
            })
            .catch(() => {
                if (this.view === 'katalog') this.info('Der Sprite-Katalog konnte nicht geladen werden.', true);
            })
            .finally(() => { this.catalogue_loading = null; });
    }

    open_code() {
        const code = String($('#basket_code').val() ?? '').trim().toLowerCase();
        if (!SPRITE_BASKET_CODE.test(code)) {
            this.info('Ein Spielcode hat sieben Zeichen (Buchstaben und Ziffern), zum Beispiel 4n2zuhp.', true);
            return;
        }
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

    game_name(data, code) {
        const title = String(data?.properties?.title ?? '').trim();
        const author = String(data?.properties?.author ?? '').trim();
        if (title && author) return `„${title}“ von ${author}`;
        if (title) return `„${title}“`;
        return `Spiel ${code}`;
    }

    set_source(key, name, data) {
        this.source = { key, name, data: normalized_source_game(data) };
        if (this.view === 'code') {
            this.source_info(this.source);
            this.render_grid();
        }
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

    toggle(source, sprite) {
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

    card(source, sprite, needed) {
        const chosen = this.in_basket(source.key, sprite.id);
        const card = $('<button>').attr('type', 'button').addClass('basket-card')
            .toggleClass('chosen', chosen).toggleClass('needed', needed.has(sprite.id))
            .attr('title', chosen ? 'Aus dem Korb nehmen' : 'In den Korb legen')
            .on('click', () => this.toggle(source, sprite));
        $('<div>').addClass('basket-card-bild').append(this.preview(sprite)).appendTo(card);
        $('<div>').addClass('basket-card-name').text(sprite_label(sprite, source.data.sprites.indexOf(sprite))).appendTo(card);
        $('<div>').addClass('basket-card-info').text(this.describe(sprite)).appendTo(card);
        if (chosen) $('<div>').addClass('basket-card-mark').html('<i class="fa fa-check"></i>').appendTo(card);
        else if (needed.has(sprite.id)) $('<div>').addClass('basket-card-mark').text('kommt mit').appendTo(card);
        return card;
    }

    render_grid() {
        const grid = $('#basket_grid').empty();
        const links = $('#basket_group_links').empty();
        if (this.view === 'code') {
            if (!this.source) return;
            const needed = new Set(this.needed(this.source.key));
            for (const sprite of this.source.data.sprites) grid.append(this.card(this.source, sprite, needed));
            return;
        }
        const catalogue = this.catalogue;
        if (!catalogue) return;
        const needed = new Set(this.needed(catalogue.key));
        const groups = catalogue_groups(catalogue.file, this.search);
        if (!groups.length) {
            $('<div>').addClass('basket-empty').text(`Nichts gefunden für „${this.search.trim()}“.`).appendTo(grid);
            return;
        }
        for (const group of groups) {
            const heading = $('<h3>').addClass('basket-group').text(group.name).appendTo(grid);
            $('<span>').addClass('basket-group-count').text(group.sprites.length).appendTo(heading);
            // jump to a group
            $('<button>').attr('type', 'button').addClass('basket-group-link').text(group.name)
                .on('click', () => {
                    // the grid is the headings' offsetParent (position: relative)
                    grid[0].scrollTo({ top: heading[0].offsetTop - 4, behavior: 'smooth' });
                })
                .appendTo(links);
            for (const sprite of group.sprites) grid.append(this.card(catalogue, sprite, needed));
        }
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

if (typeof module !== 'undefined') module.exports = { sprite_reference_ids, sprites_with_dependencies, copy_sprites_for, catalogue_groups };

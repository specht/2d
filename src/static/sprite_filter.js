// Finding a sprite in a big game: a search field over the sprites' Titel and
// filters by what a sprite is (from its traits). Used by the sprite list of
// the sprite editor and the sprite palette of the level editor. The filter
// only hides buttons; nothing about the game changes.
//
// Pure parts (sprite_kinds, sprite_filter_matches, sprite_filter_kinds_in)
// are tested in test/sprite_filter.test.cjs; SpriteFilter is the little UI.

// What a sprite is, as the children see it. A sprite may be several things.
const SPRITE_KINDS = [
    { id: 'figur', label: 'Figuren', traits: ['actor'] },
    { id: 'begleiter', label: 'Begleiter', traits: ['companion'] },
    { id: 'gegner', label: 'Gegner', traits: ['baddie', 'trap'] },
    { id: 'block', label: 'Blöcke', traits: ['block_above', 'block_sides', 'block_below', 'slope', 'ladder', 'conveyor', 'moving', 'falls_down'] },
    { id: 'sammeln', label: 'Sammeln', traits: ['pickup', 'key'] },
    { id: 'schalter', label: 'Türen & Schalter', traits: ['door', 'switch', 'pressure_plate', 'counter', 'level_complete', 'checkpoint', 'text'] },
    { id: 'deko', label: 'Deko', traits: [] },
];

// The kinds of one sprite (ids of SPRITE_KINDS); a sprite without any of
// these traits is Deko (pictures, backgrounds, attack pictures).
function sprite_kinds(sprite) {
    const traits = Object.keys(sprite?.traits ?? {});
    const kinds = SPRITE_KINDS.filter(kind => kind.traits.some(t => traits.includes(t))).map(kind => kind.id);
    return kinds.length ? kinds : ['deko'];
}

// The kinds that occur in the game, in the order of SPRITE_KINDS, with their counts.
function sprite_filter_kinds_in(sprites) {
    const counts = new Map();
    for (const sprite of sprites ?? [])
        for (const kind of sprite_kinds(sprite)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    return SPRITE_KINDS.filter(kind => counts.has(kind.id)).map(kind => ({ ...kind, count: counts.get(kind.id) }));
}

function sprite_filter_normalize(text) {
    return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

// ------------------------------------------------ which sprites the game uses
// After a lesson of importing, a game has dozens of sprites nobody placed.
// usage: id → { placed (how often, all levels), levels (level index → count),
// needed (another sprite or a level setting needs it: an attack picture, a
// Beute, a level condition, "sendet, wenn die Spielfigur … hat") }. The
// references are the ones game_ids.js knows (for_each_sprite_reference_in_sprite);
// a sprite that only refers to itself is not needed by that.
function sprite_usage(data) {
    const sprites = Array.isArray(data?.sprites) ? data.sprites : [];
    const usage = new Map(sprites.map(s => [s?.id, { placed: 0, levels: new Map(), needed: false }]));
    const id_of = (ref, key_id = null) => {
        if (typeof key_id === 'string') return key_id;
        if (typeof ref === 'string') return ref;
        return Number.isInteger(ref) ? sprites[ref]?.id ?? null : null;
    };
    (Array.isArray(data?.levels) ? data.levels : []).forEach((level, li) => {
        for (const layer of Array.isArray(level?.layers) ? level.layers : []) {
            if (layer?.type !== 'sprites' || !Array.isArray(layer.sprites)) continue;
            for (const placed of layer.sprites) {
                const entry = usage.get(id_of(Array.isArray(placed) ? placed[0] : null));
                if (!entry) continue;
                entry.placed += 1;
                entry.levels.set(li, (entry.levels.get(li) ?? 0) + 1);
            }
        }
        for (const condition of Array.isArray(level?.conditions) ? level.conditions : []) {
            const props = condition?.properties;
            const entry = props && usage.get(id_of(props.sprite_index, props.sprite_id));
            if (entry) entry.needed = true;
        }
        for (const item of Array.isArray(level?.properties?.item_signals) ? level.properties.item_signals : []) {
            const entry = item && usage.get(id_of(item.sprite_index, item.sprite_id));
            if (entry) entry.needed = true;
        }
    });
    if (typeof for_each_sprite_reference_in_sprite === 'function') {
        for (const sprite of sprites) {
            for_each_sprite_reference_in_sprite(sprite, (container, index_key, id_key) => {
                const id = id_of(container[index_key], container[id_key]);
                if (id && id !== sprite?.id && usage.has(id)) usage.get(id).needed = true;
            });
        }
    }
    return usage;
}

// The ids of the sprites the game does not use anywhere (placed nowhere,
// needed by nothing): what can go when tidying up.
function unused_sprite_ids(data) {
    const result = new Set();
    for (const [id, entry] of sprite_usage(data)) if (id && !entry.placed && !entry.needed) result.add(id);
    return result;
}

// Does sprite (at index) pass the filter { query, kind, ids }?
//   query: words that must all occur in its label (Titel or "Sprite N") or the name of its kind
//   kind:  a SPRITE_KINDS id, or null for all; 'used' ("Im Level") and
//          'unused' ("Unbenutzt") keep only the sprites whose id is in ids
function sprite_filter_matches(sprite, index, filter = {}) {
    const kinds = sprite_kinds(sprite);
    if (filter.kind === 'used' || filter.kind === 'unused') {
        if (!filter.ids?.has?.(sprite?.id)) return false;
    } else if (filter.kind && !kinds.includes(filter.kind)) return false;
    const words = sprite_filter_normalize(filter.query).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const title = typeof sprite_label === 'function' ? sprite_label(sprite, index) :
        (String(sprite?.properties?.name ?? '').trim() || `Sprite ${index + 1}`);
    const haystack = sprite_filter_normalize([title, ...kinds.map(id => SPRITE_KINDS.find(k => k.id === id)?.label)].join(' '));
    return words.every(word => haystack.includes(word));
}

// The search field and the filter chips above a list of sprite buttons.
//   container:  where the controls go
//   sprites:    () => the game's sprites
//   used_ids:   optional () => Set of sprite ids "in diesem Level" (offers that chip)
//   unused_ids: () => Set of the sprites used nowhere ("Unbenutzt"); by
//               default those of the studio's game – both lists show it
//   on_change:  (filter) => hide / show the buttons
// Shown only when there is something to find: from MIN_SPRITES sprites on.
class SpriteFilter {
    static MIN_SPRITES = 13;

    constructor({ container, sprites, used_ids = null, on_change,
        unused_ids = () => (typeof game !== 'undefined' && game?.data ? unused_sprite_ids(game.data) : new Set()) }) {
        this.container = $(container);
        this.sprites = sprites;
        this.used_ids = used_ids;
        this.unused_ids = unused_ids;
        this.on_change = on_change;
        this.query = '';
        this.kind = null;
        this.container.empty().addClass('sprite-filter');
        const row = $('<div class="sprite-filter-search">').appendTo(this.container);
        $('<i class="fa fa-search">').appendTo(row);
        this.input = $('<input type="text" spellcheck="false">').attr('placeholder', 'Sprite suchen …')
            .attr('title', 'Sucht nach dem Titel eines Sprites – oder nach „Gegner“, „Blöcke“, „Deko“ …')
            .appendTo(row);
        this.clear_button = $('<button type="button" class="sprite-filter-clear" title="Suche löschen">').append($('<i class="fa fa-times">'))
            .appendTo(row).on('click', () => { this.input.val(''); this.query = ''; this.apply(); this.input.focus(); });
        // typing here must not reach the editors' shortcuts
        this.input.on('keydown keyup keypress', e => e.stopPropagation());
        this.input.on('input', () => { this.query = this.input.val(); this.apply(); });
        this.input.on('keydown', e => {
            if (e.key === 'Escape') { this.input.val(''); this.query = ''; this.apply(); this.input.blur(); }
        });
        this.chips = $('<div class="sprite-filter-chips">').appendTo(this.container);
        this.count = $('<div class="sprite-filter-count">').appendTo(this.container);
        this.refresh();
    }

    // a chip chosen from elsewhere (the sprite list's menu: "Unbenutzte zeigen")
    set_kind(kind) {
        this.kind = kind;
        this.refresh();
    }

    filter() {
        const ids = this.kind === 'used' ? this.used_ids?.() : this.kind === 'unused' ? this.unused_ids?.() : null;
        return { query: this.query, kind: this.kind, ids };
    }

    active() {
        return Boolean(sprite_filter_normalize(this.query) || this.kind);
    }

    // After sprites were added, removed or changed: the chips that make sense now.
    refresh() {
        const sprites = this.sprites() ?? [];
        const shown = sprites.length >= SpriteFilter.MIN_SPRITES || this.active();
        this.container.toggle(shown);
        const kinds = sprite_filter_kinds_in(sprites);
        const unused = this.unused_ids?.()?.size ?? 0;
        if (this.kind === 'unused' && !unused) this.kind = null;
        if (this.kind && this.kind !== 'used' && this.kind !== 'unused' && !kinds.some(k => k.id === this.kind)) this.kind = null;
        this.chips.empty();
        const chip = (id, label, title) => $('<button type="button" class="sprite-filter-chip">').text(label).attr('title', title)
            .toggleClass('active', this.kind === id).appendTo(this.chips)
            .on('click', () => { this.kind = this.kind === id ? null : id; this.refresh(); });
        chip(null, 'Alle', 'Alle Sprites zeigen');
        if (this.used_ids) chip('used', 'Im Level', 'Nur die Sprites, die in diesem Level schon vorkommen');
        // tidying up: what no level has and nothing else needs
        if (unused) chip('unused', `Unbenutzt (${unused})`, 'Nur die Sprites, die in keinem Level vorkommen und die auch kein anderes Sprite braucht (als Angriffsbild, Beute …). Zum Aufräumen: im Tab „Sprites“ mit Shift anklicken und löschen.')
            .addClass('sprite-filter-unused');
        // one kind only is no filter
        if (kinds.length > 1)
            for (const kind of kinds) chip(kind.id, kind.label, `${kind.label}: ${kind.count}`);
        this.apply();
    }

    apply() {
        this.clear_button.css('visibility', this.query ? 'visible' : 'hidden');
        const filter = this.filter();
        const sprites = this.sprites() ?? [];
        let n = 0;
        const visible = sprites.map((sprite, i) => {
            const ok = sprite_filter_matches(sprite, i, filter);
            if (ok) n++;
            return ok;
        });
        this.count.text(this.active() ? (n ? `${n} von ${sprites.length} Sprites` : 'Kein Sprite passt – lösch die Suche oder wähle „Alle“.') : '');
        this.count.toggle(this.active());
        this.on_change?.(visible, filter);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SPRITE_KINDS, sprite_kinds, sprite_filter_kinds_in, sprite_filter_matches, sprite_filter_normalize,
        sprite_usage, unused_sprite_ids };
}

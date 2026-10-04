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

// Does sprite (at index) pass the filter { query, kind, ids }?
//   query: words that must all occur in its label (Titel or "Sprite N") or the name of its kind
//   kind:  a SPRITE_KINDS id, or null for all; 'used' keeps only the sprites whose id is in ids
function sprite_filter_matches(sprite, index, filter = {}) {
    const kinds = sprite_kinds(sprite);
    if (filter.kind === 'used') {
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
//   on_change:  (filter) => hide / show the buttons
// Shown only when there is something to find: from MIN_SPRITES sprites on.
class SpriteFilter {
    static MIN_SPRITES = 13;

    constructor({ container, sprites, used_ids = null, on_change }) {
        this.container = $(container);
        this.sprites = sprites;
        this.used_ids = used_ids;
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

    filter() {
        return { query: this.query, kind: this.kind, ids: this.kind === 'used' ? this.used_ids?.() : null };
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
        if (this.kind && this.kind !== 'used' && !kinds.some(k => k.id === this.kind)) this.kind = null;
        this.chips.empty();
        const chip = (id, label, title) => $('<button type="button" class="sprite-filter-chip">').text(label).attr('title', title)
            .toggleClass('active', this.kind === id).appendTo(this.chips)
            .on('click', () => { this.kind = this.kind === id ? null : id; this.refresh(); });
        chip(null, 'Alle', 'Alle Sprites zeigen');
        if (this.used_ids) chip('used', 'Im Level', 'Nur die Sprites, die in diesem Level schon vorkommen');
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
    module.exports = { SPRITE_KINDS, sprite_kinds, sprite_filter_kinds_in, sprite_filter_matches, sprite_filter_normalize };
}

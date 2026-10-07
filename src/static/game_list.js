// Spiel laden: the list of games, its search, loading by code, and the family
// tree of a game's versions.
//
// Every save is a version with its own code (a content hash); a version knows
// the version it was loaded from (its parent), so the versions of a game form
// a tree – its family. The list shows the newest version of every family; the
// family tree shows all of them (main.rb /api/get_games, /api/family, both
// answered from the server's GameIndex).
//
// The list can hold thousands of games, so it is drawn as plain HTML, a page
// of rows at a time (more while scrolling), with lazily loaded icons, and it
// stays drawn between two openings of the dialog.
//
// Pure parts (game_list_normalize, game_list_code, game_list_matches,
// game_list_sort, game_family_layout, game_family_ancestors, game_family_svg)
// are tested in test/game_list.test.cjs; GameList and GameFamily are the UI.

const GAME_LIST_PAGE = 120;
// families with more versions than this get their straight stretches folded
const GAME_FAMILY_FOLD_FROM = 30;

function game_list_normalize(text) {
    return String(text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function game_list_escape(text) {
    return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// The code in what was typed or pasted: "abc1234", " ABC1234 ", or a link
// like https://2d.hackschule.de/play/abc1234 – or null.
function game_list_code(text) {
    const s = String(text ?? '').trim().toLowerCase();
    let m = s.match(/^[a-z0-9]{7}$/);
    if (m) return m[0];
    m = s.match(/(?:\/play\/|#)([a-z0-9]{7})\/?$/);
    return m ? m[1] : null;
}

// What the search looks at: code, title, author and the other titles and
// authors of the family (an older name of the game finds it, too).
function game_list_search_text(node) {
    return game_list_normalize([node.tag, node.title, node.author, ...(node.others ?? [])].join('\n'));
}

// Does the game contain every word of the query (in its code, title, author …)?
function game_list_matches(node, query) {
    const words = game_list_normalize(query).split(/\s+/).filter(w => w.length);
    if (!words.length) return true;
    const text = node._search ?? game_list_search_text(node);
    return words.every(w => text.includes(w));
}

const GAME_LIST_COLUMNS = [
    { key: 'icon', label: '' },
    { key: 'tag', label: 'Code', type: 'text' },
    { key: 'author', label: 'Autor', type: 'text' },
    { key: 'title', label: 'Titel', type: 'text' },
    { key: 'ts_created', label: 'Datum', type: 'number' },
    { key: 'size', label: 'Größe', type: 'number', right: true },
    { key: 'sprite_count', label: 'Sprites', type: 'number', right: true },
    { key: 'state_count', label: 'Zustände', type: 'number', right: true },
    { key: 'frame_count', label: 'Frames', type: 'number', right: true },
    { key: 'relatives_count', label: 'Versionen', type: 'number', versions: true },
];

// A sorted copy (stable; games without a value come last either way).
function game_list_sort(nodes, key, descending = true) {
    const column = GAME_LIST_COLUMNS.find(c => c.key === key);
    const text = column?.type === 'text';
    return nodes.map((node, i) => [node, i]).sort(([a, ia], [b, ib]) => {
        const va = a[key], vb = b[key];
        const ea = va === undefined || va === null || va === '';
        const eb = vb === undefined || vb === null || vb === '';
        if (ea || eb) return ea === eb ? ia - ib : (ea ? 1 : -1);
        let r = text ? String(va).localeCompare(String(vb), 'de', { sensitivity: 'base' }) : va - vb;
        if (descending) r = -r;
        return r || ia - ib;
    }).map(([node]) => node);
}

function game_list_bytes(i) {
    if (!(i >= 0)) return '';
    if (i < 1024) return `${i} B`;
    if (i < 1024 * 1024) return `${(i / 1024).toFixed(1)} kB`;
    return `${(i / 1024 / 1024).toFixed(1)} MB`;
}

let game_list_date_format = null;
function game_list_date(ts) {
    if (!ts) return '';
    game_list_date_format ??= new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return game_list_date_format.format(new Date(ts * 1000));
}

// day and time; the year, too, when it is not this year's (`now`: seconds)
function game_list_short_date(ts, now = Date.now() / 1000) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const two = (x) => String(x).padStart(2, '0');
    const year = d.getFullYear() !== new Date(now * 1000).getFullYear() ? d.getFullYear() : '';
    return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${year} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

function game_list_row_html(node, columns) {
    const cells = columns.map(c => {
        const v = node[c.key];
        if (c.key === 'icon')
            return `<td class="game-list-icon">${node.icon ? `<img loading="lazy" alt="" src="noto/${game_list_escape(node.icon)}.png">` : ''}</td>`;
        if (c.key === 'tag') return `<td class="mono">${game_list_escape(v)}</td>`;
        if (c.key === 'ts_created') return `<td>${game_list_date(v)}</td>`;
        if (c.key === 'size') return `<td class="right">${game_list_bytes(v)}</td>`;
        if (c.versions)
            return `<td>${v > 1 ? `<button class="game-list-versions" tabindex="-1">${v} Versionen <i class="fa fa-angle-right"></i></button>` : ''}</td>`;
        if (c.type === 'text') return `<td title="${game_list_escape(v)}">${game_list_escape(v || '–')}</td>`;
        return `<td class="${c.right ? 'right' : ''}">${v ?? ''}</td>`;
    });
    return `<tr class="clickable_row" data-tag="${game_list_escape(node.tag)}">${cells.join('')}</tr>`;
}

// ---------------------------------------------------------------- family tree

// Where every version of a family goes in the tree: left to right in the
// order they were saved (a version is never left of an older one, nor of its
// parent), branches in rows. Versions of the same year may share a column
// (two branches worked on at the same time); a new year starts a new column,
// so the years lie side by side (`years`: [{ year, from, to }] in columns,
// when there is more than one). The branch that leads to
// `main_tag` (default: the newest version) runs straight through, the others
// below and above it (packed: see "rows"). In big families a straight stretch (one version after the other, no
// branch) is folded: only its ends are shown, the edge counts the versions
// in between. `keep` tags are never folded.
// nodes: [{ tag, parent, ts_created, … }] → { nodes: [{ …node, x, y, tip }],
//   edges: [{ from, to, folded }], columns, rows, years }
// `title`: the family's name (a tip's label shows its title only when it
// differs); `measure(text)`: a label's width in pixels (the browser measures
// it; the estimate is for the tests). Every branch keeps room for the label
// of its last version, so labels never run into anything.
function game_family_layout(nodes, { main_tag = null, keep = [], fold = null, title = null, measure = game_family_estimate } = {}) {
    const by_tag = new Map(nodes.map(n => [n.tag, n]));
    const children = new Map(nodes.map(n => [n.tag, []]));
    for (const n of nodes)
        if (n.parent && n.parent !== n.tag && by_tag.has(n.parent)) children.get(n.parent).push(n.tag);
    const parent_of = tag => {
        const p = by_tag.get(tag)?.parent;
        return p && p !== tag && by_tag.has(p) ? p : null;
    };
    const ts = tag => by_tag.get(tag)?.ts_created ?? 0;
    const older = (a, b) => ts(a) - ts(b) || (a < b ? -1 : a > b ? 1 : 0);
    for (const list of children.values()) list.sort(older);
    const roots = nodes.map(n => n.tag).filter(t => !parent_of(t)).sort(older);

    // the main branch: from main_tag (or the newest tip) back to its root
    const tips = nodes.map(n => n.tag).filter(t => children.get(t).length === 0);
    if (!main_tag || !by_tag.has(main_tag)) main_tag = tips.slice().sort(older).at(-1) ?? null;
    const main = new Set();
    for (let t = main_tag, guard = 0; t && guard <= nodes.length; t = parent_of(t), guard++) main.add(t);

    // folding
    const keep_set = new Set([...keep, main_tag].filter(Boolean));
    const folding = fold ?? nodes.length > GAME_FAMILY_FOLD_FROM;
    const hidden = new Set();
    if (folding) {
        for (const n of nodes) {
            const p = parent_of(n.tag);
            if (p && children.get(n.tag).length === 1 && children.get(p).length === 1 && !keep_set.has(n.tag))
                hidden.add(n.tag);
        }
    }

    // columns: the drawn versions, one step to the right per drawn parent;
    // kids: the drawn children, the one on the main branch first, then the
    // others oldest first (the first one continues its parent's row)
    const placed = new Map();
    const edges = [];
    const passed = new Set();
    const visit = (tag, column, from, folded) => {
        if (placed.has(tag)) return null;
        if (hidden.has(tag) && !passed.has(tag)) {
            passed.add(tag);
            const [child] = children.get(tag);
            return visit(child, column, from, folded + 1);
        }
        if (from) edges.push({ from, to: tag, folded });
        const kids = children.get(tag).slice().sort((a, b) => (main.has(b) ? 1 : 0) - (main.has(a) ? 1 : 0) || older(a, b));
        const entry = { ...by_tag.get(tag), x: column, y: 0, tip: kids.length === 0 };
        placed.set(tag, entry);
        entry.kids = kids.map(kid => visit(kid, column + 1, tag, 0)).filter(Boolean);
        return tag;
    };
    roots.sort((a, b) => (main.has(b) ? 1 : 0) - (main.has(a) ? 1 : 0) || older(a, b));
    const starts = roots.map(root => visit(root, 0, null, 0)).filter(Boolean);
    // a loop has no root (the server never writes one): start anywhere
    for (const n of nodes) if (!placed.has(n.tag) && !passed.has(n.tag)) starts.push(visit(n.tag, 0, null, 0));

    // columns in time: through the drawn versions, oldest first (a version
    // with a clock behind its parent's counts as saved right after it); each
    // goes right of its parent and not left of the one saved before it – one
    // further when the year changes
    const drawn_parent = new Map(edges.map(e => [e.to, e.from]));
    const order = [...placed.keys()];
    const when = new Map();
    for (const t of order) when.set(t, Math.max(ts(t), when.get(drawn_parent.get(t)) ?? -Infinity));
    const year_of = t => new Date(when.get(t) * 1000).getFullYear();
    const rank = new Map(order.map((t, i) => [t, i]));
    const in_time = order.slice().sort((a, b) => when.get(a) - when.get(b) || rank.get(a) - rank.get(b));
    let previous = null;
    for (const t of in_time) {
        const p = drawn_parent.get(t);
        const after_parent = p ? placed.get(p).x + 1 : 0;
        const after_previous = previous === null ? 0 : placed.get(previous).x + (year_of(t) !== year_of(previous) ? 1 : 0);
        placed.get(t).x = Math.max(after_parent, after_previous);
        previous = t;
    }
    const years = [];
    for (const t of in_time) {
        const year = year_of(t), x = placed.get(t).x;
        if (years.at(-1)?.year === year) years.at(-1).to = x;
        else years.push({ year, from: x, to: x });
    }

    // rows: a branch runs from where it leaves its parent to its newest
    // version along one row. The main branch takes row 0; every other branch
    // takes the nearest row (below first, then above, then further away)
    // where neither it (with room for the label of its last version) nor its
    // curve from the parent meets anything placed before – so short branches
    // share rows and the tree stays low. Branches that leave further right are
    // placed first: a branch placed later leaves further left, so nothing
    // placed before stands in the way of its curve, and nothing crosses.
    // (Curves from the same parent may share their start; a curve that would
    // still be blocked – two branch points in one column – takes the nearest
    // free row anyway.) In the end the rows are counted from the top.
    const used = new Map();   // row → [[from, to, owner], …] in columns; owner: the parent of a curve
    const is_free = (r, a, b, owner = null) =>
        !(used.get(r) ?? []).some(([c, d, o]) => a <= d && c <= b && (owner === null || o !== owner));
    const take = (r, a, b, owner = null) => {
        if (!used.has(r)) used.set(r, []);
        used.get(r).push([a, b, owner]);
    };
    const pending = starts.filter(Boolean).map((tag, i) => ({ tag, parent: null, order: i }));
    let top = 0, bottom = 0;
    const column_of = (p) => (p.parent ? placed.get(p.parent).x : Infinity);
    let order_index = order.length;
    while (pending.length) {
        // rightmost branch point first; equal ones in the order they were found
        pending.sort((p, q) => (column_of(q) - column_of(p)) || p.order - q.order);
        const { tag: start, parent } = pending.shift();
        let end = start;
        while (placed.get(end).kids.length) end = placed.get(end).kids[0];
        const xs = placed.get(start).x;
        const label = game_family_label(placed.get(end), title);
        const label_columns = (GAME_FAMILY_LABEL_GAP + measure(label) + 14) / GAME_FAMILY_COLUMN;
        // a branch that starts with folded versions keeps room for their count
        // (left of its first version)
        const counted = parent && edges.some(e => e.to === start && e.folded);
        // the line comes down from the parent half a column after it and runs
        // along the row to the branch's first version (which may be further right)
        const xp = parent ? placed.get(parent).x : xs - 1;
        const span = [Math.min(xs - (counted ? 0.6 : 0.2), xp + 0.5), placed.get(end).x + label_columns];
        const from_row = parent ? placed.get(parent).y : 0;
        const curve = [xp + 0.25, xp + 0.75];
        const between = (row) => {
            const rows_between = [];
            for (let q = Math.min(from_row, row) + 1; q < Math.max(from_row, row); q++) rows_between.push(q);
            return rows_between;
        };
        const fits = (row) => is_free(row, ...span) && between(row).every(q => is_free(q, ...curve, parent));
        // the rows to try, nearest first (below before above)
        const candidates = [];
        const first = parent ? 1 : 0;
        for (let d = first; d <= bottom - top + 2; d++) {
            candidates.push(from_row + d);
            if (d > 0) candidates.push(from_row - d);
        }
        let r = candidates.find(fits);
        if (r === undefined) r = candidates.find(row => is_free(row, ...span)) ?? bottom + 1;
        if (parent) for (const q of between(r)) take(q, ...curve, parent);
        take(r, ...span);
        top = Math.min(top, r);
        bottom = Math.max(bottom, r);
        for (let t = start; t; t = placed.get(t).kids[0]) {
            const entry = placed.get(t);
            entry.y = r;
            for (const kid of entry.kids.slice(1)) pending.push({ tag: kid, parent: t, order: order_index++ });
        }
    }
    for (const entry of placed.values()) entry.y -= top;
    const rows = placed.size ? bottom - top + 1 : 0;

    const out = [...placed.values()];
    for (const n of out) delete n.kids;
    return {
        nodes: out,
        edges,
        columns: out.reduce((m, n) => Math.max(m, n.x + 1), 0),
        rows,
        main_tag,
        years: years.length > 1 ? years : [],
    };
}

// A version and everything before it, newest first (the versions table).
function game_family_ancestors(nodes, tag) {
    const by_tag = new Map(nodes.map(n => [n.tag, n]));
    const out = [];
    const seen = new Set();
    for (let t = tag; t && by_tag.has(t) && !seen.has(t); t = by_tag.get(t).parent) {
        seen.add(t);
        out.push(by_tag.get(t));
    }
    return out;
}

const GAME_FAMILY_COLUMN = 52;
const GAME_FAMILY_ROW = 38;
const GAME_FAMILY_MARGIN = 22;
const GAME_FAMILY_LABEL_GAP = 18;
const GAME_FAMILY_TITLE_MAX = 28;
const GAME_FAMILY_YEAR_ROOM = 18;   // above the tree: the years

// The label of the newest version of a branch: its date, and its title when
// it is not the family's
function game_family_label(node, title = null, now = undefined) {
    let t = node.title && node.title !== title ? node.title : null;
    if (t && t.length > GAME_FAMILY_TITLE_MAX) t = t.slice(0, GAME_FAMILY_TITLE_MAX - 1) + '…';
    return [t, game_list_short_date(node.ts_created, now) || node.tag].filter(Boolean).join(' · ');
}

// a label's width in pixels without a browser (15 px text, wide letters)
function game_family_estimate(text) {
    return String(text).length * 8.6;
}

// The tree as SVG: a dot per version (newer ones brighter), the newest
// version of each branch with its date (and its title, when it is not the
// family's `title`), the way to `selected` highlighted; behind it, when the
// family spans several years, a band per year with the year on top.
function game_family_svg(layout, selected = null, { title = null, measure = game_family_estimate, now = undefined } = {}) {
    const by_tag = new Map(layout.nodes.map(n => [n.tag, n]));
    const on_path = new Set();
    // the highlighted way: from the selected version back along the drawn edges
    const parent_edge = new Map(layout.edges.map(e => [e.to, e]));
    for (let t = selected, guard = 0; t && by_tag.has(t) && guard <= layout.nodes.length; guard++) {
        on_path.add(t);
        t = parent_edge.get(t)?.from ?? null;
    }
    const times = layout.nodes.map(n => n.ts_created ?? 0);
    const t0 = Math.min(...times), t1 = Math.max(...times);
    const age = n => (t1 > t0 ? ((n.ts_created ?? 0) - t0) / (t1 - t0) : 1);
    const years = layout.years ?? [];
    const top = years.length ? GAME_FAMILY_YEAR_ROOM : 0;
    const X = n => GAME_FAMILY_MARGIN + n.x * GAME_FAMILY_COLUMN;
    const Y = n => top + GAME_FAMILY_MARGIN + n.y * GAME_FAMILY_ROW;
    let label_room = 0;
    const parts = [];
    for (const e of layout.edges) {
        const a = by_tag.get(e.from), b = by_tag.get(e.to);
        const x1 = X(a), y1 = Y(a), x2 = X(b), y2 = Y(b);
        const mid = x1 + GAME_FAMILY_COLUMN / 2;
        // to another row: down within one column, then along the row
        const bend = Math.min(x2, x1 + GAME_FAMILY_COLUMN);
        const d = y1 === y2 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}C${mid} ${y1} ${mid} ${y2} ${bend} ${y2}${bend < x2 ? `H${x2}` : ''}`;
        const hl = on_path.has(e.from) && on_path.has(e.to) ? ' highlight' : '';
        parts.push(`<path class="family-edge${hl}" d="${d}"/>`);
        if (e.folded && y1 === y2)
            parts.push(`<text class="family-folded" x="${(x1 + x2) / 2}" y="${y2 - 9}">+${e.folded}</text>`);
        else if (e.folded)
            parts.push(`<text class="family-folded" x="${x2 - 14}" y="${y2 - 9}" text-anchor="end">+${e.folded}</text>`);
    }
    for (const n of layout.nodes) {
        const hl = on_path.has(n.tag) ? ' highlight' : '';
        const sel = n.tag === selected ? ' selected' : '';
        const tip_text = n.tip ? game_family_label(n, title, now) : '';
        // opaque, newer ones brighter: the lines end at the dots instead of showing through
        const grey = Math.round(0x70 + (0xee - 0x70) * age(n));
        const tooltip = [n.tag, n.title, n.author, game_list_date(n.ts_created)].filter(Boolean).join(' – ');
        parts.push(`<g class="family-node${hl}${sel}" data-tag="${game_list_escape(n.tag)}">` +
            `<title>${game_list_escape(tooltip)}</title>` +
            `<circle cx="${X(n)}" cy="${Y(n)}" r="${n.tip ? 10 : 8}" fill="rgb(${grey},${grey},${grey})"/>` +
            (n.tip ? `<text x="${X(n) + GAME_FAMILY_LABEL_GAP}" y="${Y(n) + 5}">${game_list_escape(tip_text)}</text>` : '') +
            `</g>`);
        if (n.tip) label_room = Math.max(label_room, X(n) + GAME_FAMILY_LABEL_GAP + measure(tip_text) + 8);
    }
    const width = Math.max(label_room, (layout.columns - 1) * GAME_FAMILY_COLUMN + 2 * GAME_FAMILY_MARGIN) + 8;
    const height = top + Math.max(0, layout.rows - 1) * GAME_FAMILY_ROW + 2 * GAME_FAMILY_MARGIN;
    // the years: bands from half a column before their first version to half
    // a column after their last (the last one to the end, with the labels)
    const bands = years.map((y, i) => {
        const left = i === 0 ? 0 : GAME_FAMILY_MARGIN + (y.from - 0.5) * GAME_FAMILY_COLUMN;
        const right = i === years.length - 1 ? width : GAME_FAMILY_MARGIN + (y.to + 0.5) * GAME_FAMILY_COLUMN;
        return `<rect class="family-year${i % 2 ? ' odd' : ''}" x="${left}" y="0" width="${right - left}" height="${height}"/>` +
            `<text class="family-year-label" x="${(left + Math.min(right, left + 2 * GAME_FAMILY_COLUMN)) / 2}" y="13">${y.year}</text>`;
    });
    return `<svg class="game-family" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bands.join('')}${parts.join('')}</svg>`;
}

// ---------------------------------------------------------------- UI

// A table of games (the list, or the versions of a family). on_load(tag),
// on_versions(tag) (the button in the Versionen column).
class GameList {
    constructor({ container, columns = GAME_LIST_COLUMNS, on_load, on_versions = null, sort = 'ts_created' }) {
        this.container = container;
        this.columns = columns;
        this.on_load = on_load;
        this.on_versions = on_versions;
        this.sort_key = sort;
        this.descending = true;
        this.query = '';
        this.nodes = [];
        this.visible = [];
        this.shown = 0;
        this.signature = null;
        container.innerHTML = '';
        this.table = document.createElement('table');
        this.table.className = 'game-list';
        container.appendChild(this.table);
        this.table.addEventListener('click', e => this.click(e));
        this.more = document.createElement('div');
        this.more.className = 'game-list-more';
        container.appendChild(this.more);
        this.more.addEventListener('click', () => this.show_more());
        // the next page while scrolling, before the end is reached
        if (typeof IntersectionObserver === 'function') {
            this.observer = new IntersectionObserver(entries => {
                if (entries.some(e => e.isIntersecting)) this.show_more();
            }, { rootMargin: '400px' });
            this.observer.observe(this.more);
        }
    }

    // New games (keeps sorting and search). Same games as before: nothing is
    // drawn again.
    set_nodes(nodes) {
        const signature = nodes.map(n => `${n.tag}:${n.relatives_count ?? ''}`).join(',');
        if (signature === this.signature) return false;
        this.signature = signature;
        for (const n of nodes) n._search = game_list_search_text(n);
        this.nodes = nodes;
        this.render();
        return true;
    }

    set_query(query) {
        if (query === this.query) return;
        this.query = query;
        this.render();
    }

    render() {
        const sorted = game_list_sort(this.nodes, this.sort_key, this.descending);
        this.visible = this.query ? sorted.filter(n => game_list_matches(n, this.query)) : sorted;
        const head = this.columns.map(c => {
            const arrow = c.key === this.sort_key ? ` <i class="fa fa-caret-${this.descending ? 'down' : 'up'}"></i>` : '';
            return `<th data-key="${c.key}" class="${c.right ? 'right' : ''}${c.type ? ' sortable' : ''}">${c.label}${arrow}</th>`;
        }).join('');
        this.table.innerHTML = `<thead><tr>${head}</tr></thead><tbody></tbody>`;
        this.tbody = this.table.tBodies[0];
        this.shown = 0;
        this.table.style.display = this.visible.length ? '' : 'none';
        this.show_more();
        this.on_render?.(this.visible.length, this.nodes.length);
    }

    show_more() {
        if (!this.tbody || this.shown >= this.visible.length) {
            this.more.textContent = '';
            return;
        }
        const page = this.visible.slice(this.shown, this.shown + GAME_LIST_PAGE);
        this.tbody.insertAdjacentHTML('beforeend', page.map(n => game_list_row_html(n, this.columns)).join(''));
        this.shown += page.length;
        const rest = this.visible.length - this.shown;
        this.more.textContent = rest > 0 ? `${rest} weitere …` : '';
    }

    click(e) {
        const th = e.target.closest('th[data-key]');
        if (th) {
            const column = this.columns.find(c => c.key === th.dataset.key);
            if (!column?.type) return;
            if (this.sort_key === column.key) this.descending = !this.descending;
            else {
                this.sort_key = column.key;
                this.descending = column.type !== 'text';
            }
            this.render();
            return;
        }
        const tr = e.target.closest('tr[data-tag]');
        if (!tr) return;
        if (e.target.closest('.game-list-versions') && this.on_versions) this.on_versions(tr.dataset.tag);
        else this.on_load(tr.dataset.tag);
    }
}

// The family tree above the versions table: a click on a dot selects that
// version (its way back is highlighted, the table shows it and its
// ancestors). on_select(tag)
class GameFamily {
    constructor({ container, on_select }) {
        this.container = container;
        this.on_select = on_select;
        this.nodes = [];
        this.layout = null;
        this.selected = null;
        // labels measured in the font they are drawn with
        const context = document.createElement('canvas').getContext('2d');
        this.measure = (text) => {
            context.font = `15px ${getComputedStyle(container).fontFamily}`;
            return context.measureText(String(text)).width;
        };
        container.addEventListener('click', e => {
            const g = e.target.closest('.family-node');
            if (g) this.select(g.dataset.tag);
        });
    }

    set_family(nodes, tag) {
        this.nodes = nodes;
        // the family's name: the title of its newest version
        this.title = nodes.reduce((a, b) => ((b.ts_created ?? 0) >= (a?.ts_created ?? 0) ? b : a), null)?.title ?? null;
        this.layout = game_family_layout(nodes, { main_tag: tag, title: this.title, measure: this.measure });
        this.select(tag);
    }

    select(tag) {
        // a folded version cannot be clicked, but it can be selected from
        // the table: draw it, then
        if (this.layout && !this.layout.nodes.some(n => n.tag === tag))
            this.layout = game_family_layout(this.nodes, { main_tag: this.layout.main_tag, keep: [tag], title: this.title, measure: this.measure });
        this.selected = tag;
        this.container.innerHTML = this.layout ? game_family_svg(this.layout, tag, { title: this.title, measure: this.measure }) : '';
        this.on_select?.(tag);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GAME_LIST_COLUMNS, game_list_normalize, game_list_code, game_list_search_text, game_list_matches,
        game_list_sort, game_list_row_html, game_family_layout, game_family_ancestors, game_family_svg, game_family_label,
    };
}

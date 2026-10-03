// When something in the studio goes wrong (an uncaught error): the robot.
//
// Before, the robot asked the child to reload – and everything that was not
// saved was gone. Now, in this order:
//   1. the game is copied into the browser (rescue.js), so a reload loses
//      nothing;
//   2. a Fehlerbericht goes to the server (/api/report_error, written to
//      /raw/client-errors, see client_errors.rb and show-client-errors.rb):
//      the message and stack, the studio version, which pane and tool were in
//      use, the last clicks and keys (never what was typed into a field) and,
//      for the first error of a page, the code of a temporary copy of the game
//      (saved like "Level testen" does, listed nowhere), so the bug can be
//      reproduced with /?<code> and turned into a regression test;
//   3. the robot says that the work is safe and offers "Neu laden" (the work
//      comes back by itself) or "Weiterarbeiten".
// Errors the child cannot do anything about (from browser extensions, the
// cross-origin "Script error.", ResizeObserver notices) are ignored; a
// rejected promise is reported but never shows the robot (a failed request
// while the server restarts is not a crash).

const CRASH_MAX_REPORTS = 5;
const CRASH_BREADCRUMBS = 30;
const CRASH_TEMP_SAVE_TIMEOUT_MS = 15000;

function crash_should_report(message, source) {
    const m = String(message ?? '');
    const s = String(source ?? '');
    if (/^Script error\.?$/i.test(m.trim()) && !s) return false;
    if (/ResizeObserver loop/i.test(m)) return false;
    if (/^(chrome|moz|safari|safari-web)-extension:/i.test(s)) return false;
    return true;
}

// "button#mi_level "Level"" – enough to see what was clicked, never a value
// typed into a field.
function crash_describe_element(el) {
    if (!el || typeof el !== 'object') return '?';
    const target = el.closest?.('button, a, [id], ._dnd_item, .button, label, li, canvas') ?? el;
    let text = String(target.tagName ?? '?').toLowerCase();
    if (target.id) text += `#${target.id}`;
    const classes = String(typeof target.className === 'string' ? target.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (classes.length) text += '.' + classes.join('.');
    const is_field = /^(input|textarea|select)$/i.test(target.tagName ?? '') || target.isContentEditable;
    if (!is_field) {
        const label = String(target.getAttribute?.('title') || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
        if (label) text += ` "${label}"`;
    }
    return text;
}

// The report as it is sent; the server cuts it once more (client_errors.rb).
function crash_report_payload(error, breadcrumbs, context, version) {
    const cut = (v, n) => (v === undefined || v === null) ? undefined : String(v).slice(0, n);
    return {
        kind: error.kind ?? 'error',
        message: cut(error.message, 2000) ?? '',
        source: cut(error.source, 500),
        line: Number.isFinite(error.line) ? error.line : undefined,
        column: Number.isFinite(error.column) ? error.column : undefined,
        stack: cut(error.stack, 6000),
        details: error.details,
        breadcrumbs: (breadcrumbs ?? []).slice(-CRASH_BREADCRUMBS),
        context,
        studio_version: version ?? null,
    };
}

class CrashReporter {
    constructor() {
        this.breadcrumbs = [];
        this.seen = new Set();
        this.reports = 0;
        this.started_at = Date.now();
        this.curtain_shown = false;
        // errors the child chose to work on after: no robot for them again
        this.dismissed = new Set();
        this.game_tag = null;
        document.addEventListener('click', (e) => this.crumb('click', crash_describe_element(e.target)), true);
        document.addEventListener('keydown', (e) => {
            // keys in text fields are what the child writes: not recorded
            if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
            const mods = [e.ctrlKey && 'Strg', e.altKey && 'Alt', e.shiftKey && e.key.length > 1 && 'Shift', e.metaKey && 'Cmd'].filter(Boolean);
            this.crumb('key', [...mods, e.key].join('+'));
        }, true);
        window.addEventListener('error', (e) => this.on_error({
            message: e.message, source: e.filename, line: e.lineno, column: e.colno, stack: e.error?.stack,
        }));
        window.addEventListener('unhandledrejection', (e) => {
            const reason = e.reason;
            const message = reason?.message ?? String(reason);
            // a request that failed while the server was away is no bug
            if (/Failed to fetch|NetworkError|Load failed|aborted/i.test(message)) return;
            this.report({ kind: 'promise', message, stack: reason?.stack }, false);
        });
    }

    crumb(kind, what) {
        const t = ((Date.now() - this.started_at) / 1000).toFixed(1);
        const pane = typeof current_pane !== 'undefined' ? current_pane : '?';
        this.breadcrumbs.push(`${t}s ${pane} ${kind} ${what}`);
        if (this.breadcrumbs.length > CRASH_BREADCRUMBS) this.breadcrumbs.shift();
    }

    context() {
        const c = {};
        try {
            c.pane = typeof current_pane !== 'undefined' ? current_pane : null;
            c.tool = (typeof menus !== 'undefined' && menus[c.pane]?.active_key) || null;
            const le = window.game?.level_editor;
            if (c.pane === 'level' && le) {
                c.level = le.level_index;
                c.layer_type = game.data?.levels?.[le.level_index]?.layers?.[le.layer_index]?.type ?? null;
            }
            c.url = window.location.pathname + window.location.search + window.location.hash;
            c.user_agent = navigator.userAgent;
            c.screen = `${window.innerWidth}×${window.innerHeight}`;
            c.in_session = !!window.collaboration?.code;
            c.sprites = game?.data?.sprites?.length ?? null;
            c.levels = game?.data?.levels?.length ?? null;
            c.parent = game?.data?.parent ?? null;
            c.from_recipe = game?.from_recipe?.id ?? null;
        } catch (e) { }
        return c;
    }

    on_error(error) {
        if (!crash_should_report(error.message, error.source)) return;
        this.report(error, true);
    }

    // Something worth knowing about that is not a crash (a failed save …).
    report_problem(kind, details) {
        this.report({ kind, message: kind, details }, false);
    }

    async report(error, show_robot) {
        const key = `${error.kind ?? 'error'}|${error.message}|${error.source}|${error.line}`;
        if (show_robot && !this.dismissed.has(key)) this.show_curtain(key);
        if (this.seen.has(key) || this.reports >= CRASH_MAX_REPORTS) return;
        this.seen.add(key);
        this.reports += 1;
        const payload = crash_report_payload(error, this.breadcrumbs, this.context(), window.CACHE_BUSTER);
        // the first crash of a page: a copy of the game to reproduce it with
        if (show_robot && !this.game_tag) this.game_tag = await this.temp_save();
        if (this.game_tag) payload.game_tag = this.game_tag;
        try {
            await fetch('/api/report_error', {
                method: 'POST', cache: 'no-store', keepalive: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ report: payload }),
            });
            this.reported = true;
            if (show_robot) $('#error_curtain .error-reported').text('Der Fehler wurde gemeldet, damit er repariert werden kann.');
        } catch (e) { }
    }

    async temp_save() {
        if (!window.game?.data || window.collaboration?.code) return null;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = setTimeout(() => controller?.abort(), CRASH_TEMP_SAVE_TIMEOUT_MS);
        try {
            const response = await fetch('/api/save_game_temp', {
                method: 'POST', cache: 'no-store', signal: controller?.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ game: game.data }),
            });
            const data = await response.json();
            return typeof data?.tag === 'string' ? data.tag : null;
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    async show_curtain(key) {
        if (this.curtain_shown || typeof $ === 'undefined') return;
        this.curtain_shown = true;
        const safe = window.studio_rescue ? await window.studio_rescue.save_now() : false;
        const curtain = $('#error_curtain');
        curtain.find('.error-text').text(safe ?
            'Hoppla, da ist etwas schiefgegangen. Deine Arbeit ist hier im Browser gesichert. Lade die Seite neu – danach ist alles wieder da.' :
            'Hoppla, da ist etwas schiefgegangen. Speichere dein Spiel, wenn du kannst, und lade dann die Seite neu.');
        curtain.find('.error-reload').off('click').on('click', () => studio_reload_keeping_work());
        curtain.find('.error-continue').off('click').on('click', () => {
            curtain.fadeOut();
            this.curtain_shown = false;
            this.dismissed.add(key);
        });
        curtain.fadeIn();
        curtain.find('.robot').css('transform', 'scale(1)');
        curtain.find('.error-box').css('transform', 'translate(0, 0)').css('opacity', 1);
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.crash_reporter = new CrashReporter();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { crash_should_report, crash_describe_element, crash_report_payload, CRASH_BREADCRUMBS };
}

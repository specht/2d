// Notfallkopie: the game in the studio, kept in this browser (IndexedDB)
// while it has changes that are not saved yet.
//
// In a classroom the page gets reloaded: after an update of the studio, after
// a crash (the robot), or by accident. Saving first is not always possible –
// the server may be restarting – and a child may not have a title or author
// yet. So the studio keeps its own copy, a few seconds behind the child, and
// brings it back:
//   - at once and without asking after a reload the studio started itself
//     (`studio_reload_keeping_work`: update, robot), with a short notice;
//   - after asking when the copy is found otherwise (the tab was closed, the
//     browser crashed), naming the game and the time.
// Nothing goes to the server: the copy is only in this browser, and saving
// works exactly as before. Restored work counts as unsaved (the save button
// and the questions before replacing the game know it), and the copy is
// removed once the game is saved or the child discards it.
//
// Not during a live session: there the server keeps the shared game.

const RESCUE_DB_NAME = '2d-studio';
const RESCUE_STORE = 'rescue';
const RESCUE_KEY = 'game';
// sessionStorage: set right before a reload the studio started itself
const RESCUE_RELOAD_FLAG = '2d-restore-after-reload';
// older copies are not offered any more (a shared classroom computer)
const RESCUE_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
const RESCUE_INTERVAL_MS = 4000;

// What to do with a copy found when the studio starts: 'restore' (without
// asking), 'ask' or 'none'.
function rescue_decision(record, { auto = false, now = Date.now() } = {}) {
    if (!record || typeof record !== 'object' || !record.data || typeof record.data !== 'object') return 'none';
    if (!record.unsaved) return 'none';
    if (!(Number(record.time) > 0) || now - record.time > RESCUE_MAX_AGE_MS || record.time > now + 60000) return 'none';
    return auto ? 'restore' : 'ask';
}

function rescue_time_text(time, now = Date.now()) {
    const d = new Date(time), n = new Date(now);
    const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    if (d.toDateString() === n.toDateString()) return `heute um ${hm} Uhr`;
    const y = new Date(now - 24 * 3600 * 1000);
    if (d.toDateString() === y.toDateString()) return `gestern um ${hm} Uhr`;
    return `am ${d.getDate()}.${d.getMonth() + 1}. um ${hm} Uhr`;
}

// "»Mein Spiel« von Lea" / "»Mein Spiel«" / "ein Spiel ohne Titel"
function rescue_game_text(record) {
    const title = String(record?.title ?? '').trim();
    const author = String(record?.author ?? '').trim();
    if (!title) return author ? `ein Spiel ohne Titel von ${author}` : 'ein Spiel ohne Titel';
    return author ? `»${title}« von ${author}` : `»${title}«`;
}

// IndexedDB, wrapped: every call resolves (null / false when the browser
// does not allow it, e.g. some private windows).
const rescue_store = {
    open() {
        if (this.opening) return this.opening;
        this.opening = new Promise((resolve) => {
            try {
                const request = indexedDB.open(RESCUE_DB_NAME, 1);
                request.onupgradeneeded = () => request.result.createObjectStore(RESCUE_STORE);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
                request.onblocked = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
        return this.opening;
    },
    async run(mode, action) {
        const db = await this.open();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(RESCUE_STORE, mode);
                const request = action(tx.objectStore(RESCUE_STORE));
                // get: the record (undefined when there is none); put/delete: not null
                tx.oncomplete = () => resolve(request ? (request.result ?? undefined) : true);
                tx.onerror = tx.onabort = () => resolve(null);
            } catch (e) {
                resolve(null);
            }
        });
    },
    async get() { return (await this.run('readonly', (store) => store.get(RESCUE_KEY))) ?? null; },
    async put(record) { return (await this.run('readwrite', (store) => store.put(record, RESCUE_KEY))) !== null; },
    async clear() { return (await this.run('readwrite', (store) => store.delete(RESCUE_KEY))) !== null; },
};

class StudioRescue {
    constructor() {
        this.dirty = false;
        this.writing = null;
        this.started = false;
        // anything the child does may change the game; the copy follows a
        // few seconds later (and never while nothing happens)
        for (const type of ['mouseup', 'keyup', 'touchend', 'change', 'input', 'drop', 'paste'])
            document.addEventListener(type, () => { this.dirty = true; }, true);
        // saving or loading changes what counts as unsaved
        if (typeof $ !== 'undefined') $(document).ajaxComplete(() => { this.dirty = true; });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this.dirty) this.write();
        });
        window.addEventListener('pagehide', () => { if (this.dirty) this.write(); });
    }

    active() {
        return this.started && typeof game !== 'undefined' && !!game?.data && !window.collaboration?.code;
    }

    start() {
        if (this.timer) return;
        this.timer = setInterval(() => { if (this.dirty) this.write(); }, RESCUE_INTERVAL_MS);
    }

    // Keeps the current state (or removes the copy when nothing is unsaved).
    // Resolves true when the work is safe: copied, or nothing to copy.
    write() {
        if (!this.active()) return Promise.resolve(!this.started ? false : true);
        if (this.writing) return this.writing.then(() => this.write());
        this.dirty = false;
        let unsaved = true;
        try { unsaved = game.has_unsaved_changes?.() ?? true; } catch (e) { }
        const record = unsaved ? {
            version: 1,
            time: Date.now(),
            unsaved: true,
            data: game.data,
            from_recipe: game.from_recipe ?? null,
            title: game.data?.properties?.title ?? '',
            author: game.data?.properties?.author ?? '',
            studio_version: window.CACHE_BUSTER ?? null,
        } : null;
        this.writing = (async () => {
            let ok;
            if (!record) ok = await rescue_store.clear();
            else {
                ok = await rescue_store.put(record);
                // something in the game the browser cannot copy as it is
                if (!ok) {
                    try { ok = await rescue_store.put({ ...record, data: JSON.parse(JSON.stringify(record.data)) }); } catch (e) { ok = false; }
                }
            }
            this.last_ok = ok;
            return ok || !record;
        })().finally(() => { this.writing = null; });
        return this.writing;
    }

    save_now() {
        this.dirty = true;
        return this.write();
    }

    // When the studio starts: a copy from before? proceed(restored) loads the
    // game from the address unless the copy came back.
    async check_on_start(proceed) {
        let auto = false;
        try {
            auto = sessionStorage.getItem(RESCUE_RELOAD_FLAG) === '1';
            sessionStorage.removeItem(RESCUE_RELOAD_FLAG);
        } catch (e) { }
        const record = await rescue_store.get();
        const decision = rescue_decision(record, { auto });
        const finish = (restored) => {
            this.started = true;
            this.start();
            proceed(restored);
        };
        if (decision === 'restore') {
            this.restore(record);
            this.notice('Deine Arbeit ist wieder da – genau so, wie du sie verlassen hast.');
            finish(true);
        } else if (decision === 'ask') {
            this.ask(record, (restore) => {
                if (restore) this.restore(record);
                else rescue_store.clear();
                finish(restore);
            });
        } else {
            if (record) rescue_store.clear();
            finish(false);
        }
    }

    restore(record) {
        game.data = record.data;
        game._load();
        // not on the server yet: it counts as unsaved until it is saved
        game.saved_state = '';
        if (record.from_recipe) game.from_recipe = record.from_recipe;
        game.refresh_own_game_button?.();
        if (typeof game.data.parent === 'string' && game.data.parent) {
            $('#game_code_div').show();
            $('#game_code').text(game.data.parent);
        }
        this.dirty = true;
    }

    // The child has to choose: a click beside the dialog (which closes other
    // dialogs) shows it again, so the copy is neither lost nor forgotten.
    ask(record, answer) {
        const choose = (self, restore) => {
            $('.modal-dialogs').off('mousedown.rescue_ask');
            self.dismiss();
            answer(restore);
        };
        const dialog = new ModalDialog({
            title: 'Ungespeicherte Arbeit gefunden',
            width: '480px',
            max_width: '90vw',
            body: `<div class="collab-dialog"><p class="collab-lead"></p><p></p></div>`,
            footer: [
                { type: 'button', label: 'Verwerfen', callback: (self) => choose(self, false) },
                { type: 'button', label: 'Wiederherstellen', color: 'green', callback: (self) => choose(self, true) },
            ],
        });
        $('.modal-dialogs').on('mousedown.rescue_ask', (e) => {
            if (e.target === e.currentTarget) setTimeout(() => dialog.show(), 0);
        });
        const ps = dialog.dialog.find('.collab-dialog p');
        ps.eq(0).text(`In diesem Browser liegt noch ${rescue_game_text(record)}, zuletzt bearbeitet ${rescue_time_text(record.time)} – nicht gespeichert.`);
        ps.eq(1).text('Möchtest du damit weitermachen? Wenn das nicht deine Arbeit ist, klicke auf »Verwerfen«.');
        dialog.show();
    }

    notice(text) {
        const box = $('<div class="studio-notice">').text(text).appendTo('body');
        setTimeout(() => box.addClass('showing'), 20);
        setTimeout(() => { box.removeClass('showing'); setTimeout(() => box.remove(), 400); }, 6000);
    }
}

// Reloads the page without losing anything: the copy first, then the reload,
// after which the studio brings the work back by itself. Used by the update
// banner (server_watch.js) and the robot (crash_report.js).
async function studio_reload_keeping_work() {
    const rescue = window.studio_rescue;
    const safe = rescue ? await rescue.save_now() : false;
    let unsaved = true;
    try { unsaved = game?.has_unsaved_changes?.() ?? true; } catch (e) { }
    if (!safe && unsaved) {
        // the browser would not keep it: the child decides
        const dialog = new ModalDialog({
            title: 'Erst speichern',
            width: '460px',
            max_width: '90vw',
            body: `<div class="collab-dialog"><p class="collab-lead">Dieser Browser kann deine Arbeit nicht zwischenspeichern. Speichere dein Spiel, bevor du die Seite neu lädst – sonst ist weg, was du seit dem letzten Speichern gemacht hast.</p></div>`,
            footer: [
                { type: 'button', label: 'Trotzdem neu laden', callback: (self) => { self.dismiss(); studio_reload_now(); } },
                { type: 'button', label: 'Speichern', color: 'green', callback: (self) => { self.dismiss(); game.save(); } },
            ],
        });
        dialog.show();
        return;
    }
    try { sessionStorage.setItem(RESCUE_RELOAD_FLAG, '1'); } catch (e) { }
    studio_reload_now();
}

function studio_reload_now() {
    window.studio_reloading = true;
    window.location.reload();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof indexedDB !== 'undefined') {
    window.studio_rescue = new StudioRescue();
    // closing the tab with changes the copy does not have yet: the browser asks
    window.addEventListener('beforeunload', (e) => {
        if (window.studio_reloading || !window.studio_rescue.active() || !window.studio_rescue.dirty) return;
        let unsaved = false;
        try { unsaved = game.has_unsaved_changes(); } catch (err) { }
        if (!unsaved) return;
        window.studio_rescue.write();
        e.preventDefault();
        e.returnValue = '';
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { rescue_decision, rescue_time_text, rescue_game_text, RESCUE_MAX_AGE_MS };
}

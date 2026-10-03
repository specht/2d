// Is the server there, and is it still the version this page came from?
//
// In a classroom the server may be restarted (an update, a fix). The studio
// itself keeps working without it – only saving, loading, "Level testen" and
// live sessions need it. So instead of failing silently, the studio:
//   - notices when the server cannot be reached (a failed request or the
//     regular ping) and shows a banner: wait a moment, your work is safe;
//   - pings every few seconds until it is back, then says so;
//   - notices a new version (the ping answers with the server's version,
//     main.rb: a digest of the studio's files) and offers to reload – the
//     work comes along (rescue.js, studio_reload_keeping_work);
//   - offers to save again when a save failed while the server was away.
// Nothing here changes the game.

const SERVER_PING_MS = 30000;
const SERVER_PING_DOWN_MS = 3000;
const SERVER_PING_TIMEOUT_MS = 8000;
// after this long the banner also says to tell the teacher
const SERVER_DOWN_LONG_MS = 90000;

// HTTP statuses that mean "the server is not there" (nginx answers 502 while
// the app restarts; 0: no connection at all)
function server_unavailable_status(status) {
    return status === 0 || status === 502 || status === 503 || status === 504;
}

// 'ok' | 'down' | 'back' (just returned, same version) | 'updated' (a newer
// version is running than the one this page was loaded from)
function server_status_after(status, event, client_version) {
    if (event?.type === 'down') return 'down';
    if (event?.type === 'up') {
        if (event.version && client_version && event.version !== client_version) return 'updated';
        return status === 'down' ? 'back' : 'ok';
    }
    return status;
}

class ServerWatch {
    constructor(client_version) {
        this.client_version = client_version ?? null;
        this.status = 'ok';
        this.down_since = null;
        this.save_failed = false;
        this.dismissed_version = null;
        this.server_version = null;
        this.timer = null;
        this.banner = null;
    }

    start() {
        if (typeof $ !== 'undefined') {
            $(document).ajaxError((event, jqxhr, settings) => {
                if (jqxhr.statusText === 'abort' || window.studio_reloading) return;
                const url = String(settings?.url ?? '');
                if (server_unavailable_status(jqxhr.status)) {
                    if (url.includes('/api/save_game') && !url.includes('_temp')) this.save_failed = true;
                    this.went_down();
                } else if (url.includes('/api/save_game') && !url.includes('_temp')) {
                    // the server is there but did not take it: a bug to fix
                    this.notice('Speichern hat nicht geklappt. Deine Arbeit ist hier im Browser gesichert – versuch es gleich noch einmal.');
                    window.crash_reporter?.report_problem?.('save_failed', { status: jqxhr.status, error: String(jqxhr.responseText ?? '').slice(0, 300) });
                }
            });
            $(document).ajaxSuccess((event, jqxhr, settings) => {
                const url = String(settings?.url ?? '');
                if (url.includes('/api/save_game') && !url.includes('_temp')) this.save_failed = false;
                // a request got through while we thought it was away: ask now
                if (this.status === 'down') this.schedule(0);
            });
        }
        window.addEventListener('online', () => this.schedule(0));
        this.schedule(SERVER_PING_MS);
    }

    schedule(delay) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.ping(), delay);
    }

    async ping() {
        let result = null;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeout = setTimeout(() => controller?.abort(), SERVER_PING_TIMEOUT_MS);
        try {
            const response = await fetch('/api/ping', {
                method: 'POST', body: '{}', cache: 'no-store',
                headers: { 'Content-Type': 'application/json' }, signal: controller?.signal,
            });
            if (response.ok) {
                const data = await response.json();
                if (data?.pong) result = { type: 'up', version: data.version ?? null };
            } else if (server_unavailable_status(response.status)) {
                result = { type: 'down' };
            } else {
                // answered, if not happily: it is there
                result = { type: 'up', version: null };
            }
        } catch (e) {
            result = { type: 'down' };
        }
        clearTimeout(timeout);
        if (result.type === 'down') this.went_down();
        else this.came_up(result.version);
    }

    went_down() {
        if (this.status !== 'down') this.down_since = Date.now();
        this.status = 'down';
        this.render();
        this.schedule(SERVER_PING_DOWN_MS);
    }

    came_up(version) {
        if (version) this.server_version = version;
        this.status = server_status_after(this.status, { type: 'up', version }, this.client_version);
        this.down_since = null;
        this.render();
        if (this.status === 'back') {
            clearTimeout(this.back_timer);
            // the message stays while there is something to save
            this.back_timer = setTimeout(() => {
                if (this.status === 'back' && !this.offer_save()) { this.status = 'ok'; this.render(); }
            }, 5000);
        }
        this.schedule(SERVER_PING_MS);
    }

    offer_save() {
        let unsaved = false;
        try { unsaved = game?.has_unsaved_changes?.() ?? false; } catch (e) { }
        return this.save_failed && unsaved;
    }

    render() {
        if (typeof $ === 'undefined') return;
        const show = (this.status === 'down') || (this.status === 'back') ||
            (this.status === 'updated' && this.dismissed_version !== this.server_version);
        if (!show) {
            this.banner?.removeClass('showing');
            return;
        }
        if (!this.banner) this.banner = $('<div id="server_banner" class="server-banner" role="status" aria-live="polite">').appendTo('body');
        const banner = this.banner.empty().attr('class', `server-banner showing server-${this.status}`);
        const text = $('<span class="server-banner-text">').appendTo(banner);
        if (this.status === 'down') {
            text.text('Der Server ist gerade nicht erreichbar – wahrscheinlich startet er neu. Du kannst weiterarbeiten, nur Speichern geht gerade nicht. ');
            if (this.down_since && Date.now() - this.down_since > SERVER_DOWN_LONG_MS)
                text.append('Dauert es länger als ein paar Minuten, sag deiner Lehrkraft Bescheid.');
            else
                text.append('Bitte warte einen Moment', $('<span class="server-banner-dots">'));
            // the long-wait sentence appears without another event
            clearTimeout(this.long_timer);
            if (this.down_since) this.long_timer = setTimeout(() => { if (this.status === 'down') this.render(); }, SERVER_DOWN_LONG_MS + 1000);
        } else if (this.status === 'back') {
            if (this.offer_save()) {
                text.text('Der Server ist wieder da. Dein Spiel ist noch nicht gespeichert.');
                $('<button class="server-banner-button">').text('Jetzt speichern').on('click', () => {
                    this.status = 'ok';
                    this.render();
                    game.save();
                }).appendTo(banner);
            } else {
                text.text('Der Server ist wieder da.');
            }
        } else if (this.status === 'updated') {
            text.text('Es gibt eine neue Version des Game Studios. Lade die Seite neu – deine Arbeit kommt mit.');
            $('<button class="server-banner-button">').text('Neu laden').on('click', () => studio_reload_keeping_work()).appendTo(banner);
            $('<button class="server-banner-close" title="Später">').html('&times;').on('click', () => {
                this.dismissed_version = this.server_version;
                this.render();
            }).appendTo(banner);
        }
    }

    notice(text) {
        if (window.studio_rescue?.notice) window.studio_rescue.notice(text);
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.server_watch = new ServerWatch(window.CACHE_BUSTER);
    document.addEventListener('DOMContentLoaded', () => window.server_watch.start());
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { server_unavailable_status, server_status_after, ServerWatch };
}

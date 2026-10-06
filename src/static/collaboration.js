// Live collaboration in the studio (server side: src/ruby/collaboration.rb).
//
// Resources are "settings", "sprite:<id>" and "level:<id>": sprites and levels
// are addressed by their durable id (game_ids.js), never by array index.
// Everybody edits at most one resource at a time and holds its lock while
// doing so. The resource being edited is polled, and once it has not changed
// for a moment it is sent as a whole ("update"). Adding, deleting and moving
// sprites or levels happens locally first and is then sent as a small
// operation ("insert", "delete", "move"); the server confirms it with the
// authoritative order of the list. Every confirmed operation carries the
// session revision; a client that notices a gap asks for a snapshot.

const COLLABORATION_CODE_LENGTH = 6;
const COLLABORATION_COLLECTIONS = { sprite: 'sprites', level: 'levels' };
const COLLABORATION_LOCK_RETRY_MS = 15_000;
// Participant colours (the server hands out indices, see COLOR_COUNT in
// collaboration.rb). Tuned to read on the studio's dark panels with dark text.
const COLLABORATION_COLORS = ['#f5b83d', '#5cc8ff', '#ff7aa8', '#9be36a', '#b79cff', '#ff9e5e', '#4fe0c8', '#e27bff'];
// a lock request without any answer is sent again after this time
const COLLABORATION_LOCK_TIMEOUT_MS = 5_000;

function normalize_collaboration_name(value) {
    const raw = String(value ?? '');
    if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name || [...name].length > 40) return null;
    return name;
}

function format_collaboration_code_input(value) {
    return String(value ?? '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, COLLABORATION_CODE_LENGTH);
}

function normalize_collaboration_code(value) {
    const code = format_collaboration_code_input(value);
    return code.length === COLLABORATION_CODE_LENGTH ? code : null;
}

function collaboration_code_from_url(url) {
    return normalize_collaboration_code(new URL(url).searchParams.get('collab'));
}

function collaboration_websocket_url(code, location_like) {
    const scheme = location_like.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${scheme}//${location_like.host}/collaboration/${encodeURIComponent(code)}`;
}

function collaboration_connection_status(connected, has_connected_once) {
    if (connected) return 'Verbunden';
    return has_connected_once
        ? 'Verbindung wird wiederhergestellt …'
        : 'Verbindung wird hergestellt …';
}

function collaboration_resource(kind, id) {
    return typeof id === 'string' && id ? `${kind}:${id}` : null;
}

function parse_collaboration_resource(resource) {
    if (resource === 'settings') return { kind: 'settings', key: 'properties' };
    const match = /^(sprite|level):(.+)$/.exec(typeof resource === 'string' ? resource : '');
    return match ? { kind: match[1], id: match[2], key: COLLABORATION_COLLECTIONS[match[1]] } : null;
}

function collaboration_resource_value(state, resource) {
    const target = parse_collaboration_resource(resource);
    if (!state || !target) return null;
    if (target.kind === 'settings') return state.properties ?? null;
    const list = state[target.key];
    return Array.isArray(list) ? (list.find(item => item?.id === target.id) ?? null) : null;
}

// The id of the item directly before `id`, or null if it is the first.
function collaboration_after_id(list, id) {
    const index = (Array.isArray(list) ? list : []).findIndex(item => item?.id === id);
    return index > 0 ? (list[index - 1]?.id ?? null) : null;
}

// Brings a list of objects with ids into the order reported by the server.
// ok is false if the ids do not match exactly, so the caller can resync.
function reorder_collaboration_list(list, order) {
    const failed = { ok: false, changed: false };
    if (!Array.isArray(list) || !Array.isArray(order) || list.length !== order.length) return failed;
    const by_id = new Map(list.map(item => [item?.id, item]));
    if (by_id.size !== list.length) return failed;
    const sorted = order.map(id => by_id.get(id));
    if (sorted.some(item => item === undefined)) return failed;
    let changed = false;
    sorted.forEach((item, index) => {
        if (list[index] !== item) changed = true;
        list[index] = item;
    });
    return { ok: true, changed };
}

// Two versions of a sprite that differ at most in the pixels of their frames.
function collaboration_same_sprite_structure(a, b) {
    const shape = sprite => JSON.stringify({
        ...sprite,
        states: (sprite?.states ?? []).map(state => ({ ...state, frames: (state?.frames ?? []).length })),
    });
    return !!a && !!b && shape(a) === shape(b);
}

function collaboration_copy_frame_sources(target, source) {
    source.states.forEach((state, si) => state.frames.forEach((frame, fi) => {
        target.states[si].frames[fi].src = frame.src;
    }));
}

// Applies somebody else's insert, delete or move to the local list.
function apply_collaboration_structure(list, message) {
    if (!Array.isArray(list)) return { ok: false, changed: false };
    if (message.action === 'insert') {
        if (!message.value || message.value.id !== message.id) return { ok: false, changed: false };
        if (!list.some(item => item?.id === message.id))
            list.push(JSON.parse(JSON.stringify(message.value)));
    } else if (message.action === 'delete') {
        const index = list.findIndex(item => item?.id === message.id);
        if (index >= 0) list.splice(index, 1);
    }
    return { ok: reorder_collaboration_list(list, message.order).ok, changed: true };
}

// Text of the question asked before leaving the session. Leaving loses
// nothing as long as somebody else stays or everything has been saved.
function collaboration_leave_text(reason, { alone = false, unsaved = false } = {}) {
    const start = reason === 'load'
        ? 'Wenn du ein anderes Spiel lädst, verlässt du die gemeinsame Sitzung.'
        : 'Du verlässt die gemeinsame Sitzung.';
    if (alone && unsaved)
        return `${start} Außer dir ist niemand mehr dabei, und die gemeinsamen Änderungen sind noch nicht gespeichert. Speichere vorher, sonst gehen sie verloren.`;
    if (alone)
        return `${start} Der gemeinsame Stand ist gespeichert.`;
    return `${start} Die anderen können weiterarbeiten und das Spiel speichern.`;
}

// What to tell somebody whose join was refused; null for errors that are not
// about joining (those are handled by reconnecting).
function collaboration_join_error_text(error) {
    switch (error) {
        case 'session_not_found': return 'Unter diesem Code gibt es keine gemeinsame Sitzung. Prüfe den Code.';
        case 'session_full': return 'In dieser Sitzung sind schon sehr viele dabei. Mehr passen nicht hinein.';
        case 'too_many_attempts': return 'Es wurden zu oft falsche Codes eingegeben. Warte ein paar Minuten und versuche es dann noch einmal.';
        case 'name_required':
        case 'invalid_name':
        case 'name_too_long': return 'Bitte gib einen gültigen Namen ein (höchstens 40 Zeichen).';
        default: return null;
    }
}

// ------------------------------------------------------------ people

function collaboration_color(participant) {
    if (Number.isInteger(participant?.color))
        return COLLABORATION_COLORS[((participant.color % COLLABORATION_COLORS.length) + COLLABORATION_COLORS.length) % COLLABORATION_COLORS.length];
    // fallback for an older server: derived from the id, stable as well
    let hash = 0;
    for (const char of String(participant?.id ?? '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return COLLABORATION_COLORS[hash % COLLABORATION_COLORS.length];
}

function collaboration_initial(name) {
    const first = [...String(name ?? '').trim()][0];
    return first ? first.toLocaleUpperCase('de') : '?';
}

// What somebody is doing, as shown in the participant list. `me` switches to
// the second person ("zeichnest"), data is the game (for names and pictures).
function collaboration_activity(participant, data, me = false) {
    const target = parse_collaboration_resource(participant?.lock?.resource);
    if (target?.kind === 'sprite') {
        const sprite = (data?.sprites ?? []).find(item => item?.id === target.id);
        const frames = sprite?.states?.[0]?.frames ?? [];
        const frame = frames[Math.max(0, Math.floor((frames.length - 1) / 2))];
        return { text: me ? 'zeichnest' : 'zeichnet', picture: frame?.src ?? null };
    }
    if (target?.kind === 'level') {
        const levels = data?.levels ?? [];
        const index = levels.findIndex(item => item?.id === target.id);
        const name = levels[index]?.properties?.name?.trim() || `Level ${index + 1}`;
        return { text: `${me ? 'baust' : 'baut'} an „${name}“`, picture: null };
    }
    if (target?.kind === 'settings')
        return { text: me ? 'änderst die Einstellungen' : 'ändert die Einstellungen', picture: null };
    return { text: me ? 'schaust dich um' : 'schaut sich um', picture: null };
}

// The tag on a sprite, level or the settings somebody else is working on.
function collaboration_occupied_text(name, resource) {
    const kind = parse_collaboration_resource(resource)?.kind;
    if (kind === 'level') return `${name} baut gerade an diesem Level. Du kannst zuschauen.`;
    if (kind === 'settings') return `${name} ändert gerade die Einstellungen. Du kannst zuschauen.`;
    return `${name} zeichnet gerade dieses Sprite. Du kannst zuschauen.`;
}

function collaboration_people_title(count) {
    return count === 1 ? 'Du bist allein in der Sitzung' : `${count} Leute in der Sitzung`;
}

function collaboration_lock_race_notice(name, resource) {
    const kind = parse_collaboration_resource(resource)?.kind;
    const what = kind === 'settings' ? 'den Einstellungen' : kind === 'level' ? 'diesem Level' : 'diesem Sprite';
    return `${name ?? 'Jemand anderes'} hat im selben Moment angefangen, an ${what} zu arbeiten. Deine Änderung daran wurde zurückgenommen.`;
}

function collaboration_lock_taken_notice(name, resource) {
    const kind = parse_collaboration_resource(resource)?.kind;
    const what = kind === 'settings' ? 'den Einstellungen' : kind === 'level' ? 'diesem Level' : 'diesem Sprite';
    return `${name} arbeitet jetzt an ${what} weiter, weil du eine Weile nichts daran geändert hast.`;
}

function collaboration_rejection_notice(message, holder_name = null) {
    const thing = message?.kind === 'level' ? 'Level' : 'Sprite';
    if (message?.request === 'update')
        return 'Deine letzte Änderung konnte nicht übernommen werden. Du siehst jetzt den gemeinsamen Stand.';
    if (message?.reason === 'locked')
        return `${holder_name ?? 'Jemand anderes'} bearbeitet dieses ${thing} gerade. Es kann deshalb nicht gelöscht werden.`;
    if (message?.reason === 'last_item')
        return `Das letzte ${thing} kann nicht gelöscht werden.`;
    return 'Das hat nicht geklappt, weil sich gleichzeitig etwas anderes geändert hat. Der gemeinsame Stand wird neu geladen.';
}

function collaboration_saved_notice(saved_by, is_me) {
    if (is_me || !saved_by) return 'Spiel gespeichert.';
    return `${saved_by} hat das Spiel gespeichert.`;
}

function collaboration_save_error_message(error) {
    if (error === 'save_in_progress')
        return 'Jemand anderes speichert das Spiel gerade. Versuche es gleich noch einmal.';
    return 'Das gemeinsame Spiel konnte nicht gespeichert werden.';
}
class CollaborationClient {
    constructor() {
        this.code = null;
        this.name = null;
        this.participant_id = null;
        this.reconnect_token = null;
        this.source_tag = null;
        this.revision = 0;
        this.resource_revisions = {};
        this.participants = [];
        this.socket = null;
        this.connected = false;
        this.has_connected_once = false;
        this.show_status_after_welcome = false;
        this.scroll_status_after_welcome = false;
        this.intentional_close = false;
        this.reconnect_timeout = null;
        this.reconnect_delay = 1000;
        this.heartbeat_interval = null;
        this.resource_interval = null;
        this.error_modal = null;

        // the resource this tab is working on, and the lock request on its way
        this.focused_resource = null;
        this.lock_request = null; // { resource, at }
        // asking again for a lock somebody else holds (it may have become idle)
        this.lock_retry_at = 0;
        // the stray lock we already asked the server to release
        this.unlock_sent_for = null;
        // { resource, serialized } of the update on its way to the server
        this.pending_update = null;
        // resource => its last value confirmed by the server, serialized the
        // way the local copy serializes. Local edits are whatever differs.
        this.server_values = new Map();
        this.last_observed_serialized = null;
        this.resource_changed_at = 0;
        this.awaiting_snapshot = false;
        // own structure changes not yet confirmed by the server
        this.pending_structure = 0;
        this.notice_override = null;
        this.notice_override_until = 0;
        this.original_game_save = null;
        this.original_game_load = null;
        // what to do after the user confirmed leaving the session
        this.pending_leave = null;
        this.saved_revision = 0;
        this.save_after_sync = false;
        this.save_pending = false;
    }

    participant_storage_key(code) {
        return `2d-collaboration:${code}:participant`;
    }

    name_storage_key(code) {
        return `2d-collaboration:${code}:name`;
    }

    // The reconnect token is the secret that lets this tab take over its own
    // participant again after a dropped connection (participant ids are
    // visible to everybody in the session).
    token_storage_key(code) {
        return `2d-collaboration:${code}:token`;
    }

    remember_participant() {
        if (!this.code) return;
        if (this.name)
            sessionStorage.setItem(this.name_storage_key(this.code), this.name);
        if (this.participant_id)
            sessionStorage.setItem(this.participant_storage_key(this.code), this.participant_id);
        if (this.reconnect_token)
            sessionStorage.setItem(this.token_storage_key(this.code), this.reconnect_token);
    }

    start(name, modal) {
        name = normalize_collaboration_name(name);
        if (!name) {
            modal.showError('Bitte gib deinen Namen ein (höchstens 40 Zeichen).');
            return;
        }
        if (!window.game?.data) {
            modal.showError('Das Spiel ist noch nicht fertig geladen.');
            return;
        }
        // A recipe scene is never saved as it is (own_game.js): it becomes an
        // own game first, then it can be shared like any other.
        if (window.game.from_recipe) {
            modal.showError('Das ist eine Szene aus einem Rezept. Speichere sie zuerst als dein eigenes Spiel (Strg+S) – dann könnt ihr gemeinsam daran arbeiten.');
            return;
        }

        const payload = { game: window.game.data };
        if (typeof window.game.data.parent === 'string' && window.game.data.parent)
            payload.source_tag = window.game.data.parent;

        api_call('/api/collaboration/create', payload, (data) => {
            if (!data.success) {
                modal.showError(data.error === 'too_many_sessions'
                    ? 'Gerade laufen sehr viele gemeinsame Sitzungen. Versuche es in ein paar Minuten noch einmal.'
                    : 'Die gemeinsame Sitzung konnte nicht gestartet werden.');
                return;
            }
            modal.dismiss();
            this.set_code_in_url(data.code);
            this.show_status_after_welcome = true;
            this.scroll_status_after_welcome = true;
            this.connect(data.code, name);
        });
    }

    join(code, name, modal) {
        name = normalize_collaboration_name(name);
        if (!name) {
            modal.showError('Bitte gib deinen Namen ein (höchstens 40 Zeichen).');
            return;
        }
        code = normalize_collaboration_code(code);
        if (!code) {
            modal.showError('Bitte gib den sechsstelligen Sitzungscode ein.');
            return;
        }
        this.set_code_in_url(code);
        this.scroll_status_after_welcome = true;
        modal.dismiss();
        this.connect(code, name, modal);
    }

    connect(code, name, error_modal = null) {
        code = normalize_collaboration_code(code);
        if (!code) {
            error_modal?.showError('Bitte gib den sechsstelligen Sitzungscode ein.');
            return;
        }
        this.intentional_close = false;
        this.code = code;
        this.name = name;
        this.error_modal = error_modal;
        this.participant_id = sessionStorage.getItem(this.participant_storage_key(code));
        this.reconnect_token = sessionStorage.getItem(this.token_storage_key(code));
        this.render_control();
        this.update_resource_access();

        const ws = new WebSocket(collaboration_websocket_url(code, window.location));
        this.socket = ws;

        ws.addEventListener('open', () => {
            if (this.socket !== ws) return;
            ws.send(JSON.stringify({
                type: 'join',
                name: this.name,
                participant_id: this.participant_id,
                reconnect_token: this.reconnect_token,
            }));
        });

        ws.addEventListener('message', (event) => {
            if (this.socket !== ws) return;
            let message;
            try {
                message = JSON.parse(event.data);
            } catch (error) {
                console.error('Ungültige Collaboration-Nachricht', error);
                return;
            }
            this.handle_message(message);
        });

        ws.addEventListener('close', (event) => {
            if (this.socket !== ws) return;
            console.warn('Collaboration WebSocket closed', { code: event.code, reason: event.reason });
            this.socket = null;
            this.connected = false;
            this.reset_sync_state();
            this.save_after_sync = false;
            this.save_pending = false;
            if (window.game) window.game.currently_saving = false;
            this.stop_heartbeat();
            if (event.code === 4010) {
                // The same participant joined again from another tab or window.
                this.end_session('Diese gemeinsame Sitzung ist jetzt in einem anderen Tab oder Fenster geöffnet. Hier ist sie beendet.');
                return;
            }
            this.render_control();
            this.update_resource_access();
            if (!this.intentional_close) this.schedule_reconnect();
        });

        ws.addEventListener('error', () => {
            // close will handle reconnect/UI
        });
    }

    // ------------------------------------------------------------ messages

    send(message) {
        if (this.socket?.readyState !== WebSocket.OPEN) return false;
        this.socket.send(JSON.stringify(message));
        return true;
    }

    reset_sync_state() {
        this.pending_update = null;
        this.lock_request = null;
        this.unlock_sent_for = null;
        this.awaiting_snapshot = false;
        this.pending_structure = 0;
        this.server_values = new Map();
        this.last_observed_serialized = null;
        this.resource_changed_at = 0;
    }

    handle_message(message) {
        switch (message.type) {
            case 'welcome': return this.handle_welcome(message);
            case 'snapshot': return this.apply_snapshot(message);
            case 'presence': return this.handle_presence(message.participants);
            case 'update': return this.handle_update(message);
            case 'structure': return this.handle_structure(message);
            case 'rejected': return this.handle_rejected(message);
            case 'saved': return this.handle_saved(message);
            case 'save_error': return this.handle_save_error(message);
            case 'error': return this.handle_error(message);
        }
    }

    handle_welcome(message) {
        this.connected = true;
        this.has_connected_once = true;
        this.reconnect_delay = 1000;
        this.participant_id = message.participant_id;
        this.reconnect_token = message.reconnect_token ?? this.reconnect_token;
        this.remember_participant();
        this.apply_snapshot(message);
        this.start_heartbeat();
        this.start_resource_loop();
        this.install_save_guard();
        this.install_load_guard();
        if (this.scroll_status_after_welcome) {
            this.scroll_status_after_welcome = false;
            $('#status-bar').scrollLeft(0);
        }
        if (this.show_status_after_welcome) {
            this.show_status_after_welcome = false;
            window.collaborationStatusModal?.show();
        }
    }

    // Replaces the whole local game with the session state. Used when joining
    // and whenever the client lost track of the order of operations.
    apply_snapshot(message) {
        if (!message.state || !window.game) return;
        const restore = this.current_resource() ?? this.focused_resource;
        this.reset_sync_state();
        this.source_tag = message.source_tag ?? null;
        this.revision = message.revision;
        this.saved_revision = Number.isInteger(message.saved_revision) ? message.saved_revision : 0;
        this.participants = message.participants ?? [];
        this.resource_revisions = { ...(message.resource_revisions ?? {}) };

        window.game.data = message.state;
        window.game._load();
        this.remember_all_server_values();
        this.show_game_code(this.source_tag);
        this.restore_resource_selection(restore);
        this.focused_resource = null;
        this.focus_current_resource(true);
        this.render_control();
        this.render_status();
        this.update_resource_access();
        if (this.save_after_sync)
            this.cancel_shared_save('Vor dem Speichern musste der gemeinsame Stand neu geladen werden. Prüfe deine Änderung und speichere noch einmal.');
    }

    // Operations carry the session revision. A gap means we missed something:
    // then the next snapshot replaces everything and messages until then are
    // ignored.
    accept_revision(message) {
        if (this.awaiting_snapshot) return false;
        if (message.revision !== this.revision + 1) {
            this.request_snapshot();
            return false;
        }
        this.revision = message.revision;
        return true;
    }

    request_snapshot() {
        if (this.awaiting_snapshot) return;
        this.awaiting_snapshot = true;
        this.pending_update = null;
        this.send({ type: 'request_snapshot' });
        this.update_resource_access();
    }

    handle_presence(participants) {
        const previous = this.participants;
        this.participants = participants ?? [];
        this.settle_lock_request();
        this.handle_lock_transition(previous);
        this.release_stray_lock();
        this.render_control();
        this.render_status();
        this.ensure_current_resource_lock();
        this.update_resource_access();
        this.continue_shared_save();
    }

    // The answer to our lock request is the first participant list that shows
    // somebody holding that resource (us, or somebody who was faster).
    settle_lock_request() {
        const request = this.lock_request;
        if (!request) return;
        const holder = this.lock_holder(request.resource);
        if (!holder) return;
        this.lock_request = null;
        if (holder.id !== this.participant_id) this.lock_denied(request.resource, holder);
    }

    // Somebody else got the resource we started editing optimistically: put
    // back the server's version of it.
    lock_denied(resource, holder) {
        if (this.resource_synced(resource)) return;
        this.revert_to_server_value(resource);
        this.show_temporary_notice(collaboration_lock_race_notice(holder?.name, resource), 6000);
    }

    revert_to_server_value(resource) {
        const serialized = this.server_values.get(resource);
        if (serialized === undefined) return;
        this.apply_resource_value(resource, JSON.parse(serialized));
        this.last_observed_serialized = serialized;
        this.resource_changed_at = performance.now();
    }

    handle_lock_transition(previous_participants) {
        const resource = this.focused_resource;
        if (!resource) return;
        const was_mine = this.lock_holder(resource, previous_participants)?.id === this.participant_id;
        const is_mine = this.owns_lock(resource);
        if (!is_mine && was_mine) {
            const holder = this.lock_holder(resource);
            if (holder) {
                // Taken over after the lock was unused for a while (the server's
                // lease). Anything not yet sent cannot be sent any more.
                if (!this.resource_synced(resource)) this.revert_to_server_value(resource);
                this.show_temporary_notice(collaboration_lock_taken_notice(holder.name, resource), 6000);
            }
        }
    }

    // A lock we still hold on something we are no longer working on (for
    // example because the lock on the new resource was refused) is released.
    release_stray_lock() {
        const mine = this.participants.find(participant => participant.id === this.participant_id)?.lock?.resource;
        if (!mine || mine === this.focused_resource || mine === this.lock_request?.resource) {
            this.unlock_sent_for = null;
            return;
        }
        if (this.unlock_sent_for === mine || !this.resource_synced(mine)) return;
        if (this.send({ type: 'unlock', resource: mine })) this.unlock_sent_for = mine;
    }

    handle_update(message) {
        if (!this.accept_revision(message)) return;
        this.resource_revisions[message.resource] = message.resource_revision;
        const own = message.participant_id === this.participant_id &&
            this.pending_update?.resource === message.resource;
        if (own) {
            // Our own change came back: keep the local copy, which may already
            // contain newer edits, and only move the baseline.
            this.server_values.set(message.resource, this.pending_update.serialized);
            this.pending_update = null;
            this.release_stray_lock();
            this.continue_shared_save();
            return;
        }
        if (!this.apply_resource_value(message.resource, message.value)) {
            this.request_snapshot();
            return;
        }
        this.remember_server_value(message.resource);
        if (message.resource === this.focused_resource) {
            this.last_observed_serialized = this.server_values.get(message.resource);
            this.resource_changed_at = performance.now();
        }
    }

    handle_structure(message) {
        if (!this.accept_revision(message)) return;
        const key = COLLABORATION_COLLECTIONS[message.kind];
        const list = window.game?.data?.[key];
        const restore = this.current_resource() ?? this.focused_resource;
        const mine = message.participant_id === this.participant_id;
        let result;
        if (mine && this.pending_structure > 0) {
            // Our own change was already applied locally; only the final order
            // can differ if somebody else changed the list at the same time.
            this.pending_structure -= 1;
            result = reorder_collaboration_list(list, message.order);
        } else if (this.pending_structure > 0) {
            // Somebody else changed the list while our own change is still on
            // its way: the two cannot be merged reliably, so start over.
            this.request_snapshot();
            return;
        } else {
            result = apply_collaboration_structure(list, message);
        }
        if (!result.ok) {
            this.request_snapshot();
            return;
        }

        const resource = collaboration_resource(message.kind, message.id);
        if (message.action === 'insert') this.resource_revisions[resource] = 0;
        if (message.action === 'delete') {
            delete this.resource_revisions[resource];
            this.server_values.delete(resource);
        }
        const previous = this.participants;
        if (Array.isArray(message.participants)) this.participants = message.participants;
        if (result.changed) this.rebuild_editor(restore);
        if (message.action === 'insert' && !mine) this.remember_server_value(resource);
        this.handle_lock_transition(previous);
        this.render_control();
        this.render_status();
        this.update_resource_access();
    }

    handle_rejected(message) {
        const previous = this.participants;
        if (Array.isArray(message.participants)) this.participants = message.participants;

        if (message.request === 'lock' || message.request === 'unlock') {
            if (message.request === 'lock' && this.lock_request?.resource === message.resource) {
                this.lock_request = null;
                if (message.reason === 'locked')
                    this.lock_denied(message.resource, this.lock_holder(message.resource));
                else
                    this.revert_to_server_value(message.resource);
            }
            this.handle_lock_transition(previous);
            this.release_stray_lock();
        } else if (message.request === 'update') {
            this.pending_update = null;
            if (message.value && typeof message.value === 'object' && Number.isInteger(message.resource_revision)) {
                // Take the server's version of the resource.
                this.resource_revisions[message.resource] = message.resource_revision;
                this.apply_resource_value(message.resource, message.value);
                this.remember_server_value(message.resource);
                this.last_observed_serialized = this.server_values.get(message.resource);
            } else {
                this.request_snapshot();
            }
            this.show_temporary_notice(collaboration_rejection_notice(message), 5000);
            if (this.save_after_sync)
                this.cancel_shared_save('Vor dem Speichern konnte deine letzte Änderung nicht übernommen werden. Prüfe sie und speichere noch einmal.');
        } else {
            // A structure change we already made locally was refused: undo it
            // by loading the session state again.
            this.pending_structure = Math.max(0, this.pending_structure - 1);
            const holder = message.reason === 'locked'
                ? this.lock_holder(collaboration_resource(message.kind, message.id))
                : null;
            this.show_temporary_notice(collaboration_rejection_notice(message, holder?.name), 5000);
            this.request_snapshot();
        }
        this.render_control();
        this.render_status();
        this.update_resource_access();
    }

    handle_error(message) {
        console.warn('Collaboration error', message.error);
        const text = collaboration_join_error_text(message.error);
        // Other errors are either harmless or the server closes the socket,
        // after which we reconnect.
        if (!message.fatal || text === null) return;

        this.intentional_close = true;
        const session_not_found = message.error === 'session_not_found';
        if (session_not_found && this.has_connected_once) {
            // We were in this session before: it ended while we were away.
            this.end_session('Die gemeinsame Sitzung gibt es nicht mehr, zum Beispiel weil längere Zeit niemand dabei war. Dein Stand ist noch hier. Speichere ihn, damit nichts verloren geht.');
            return;
        }
        // With a bad name the code is fine and stays; otherwise it is dropped.
        if (!['name_required', 'invalid_name', 'name_too_long'].includes(message.error)) {
            this.code = null;
            this.participant_id = null;
            const url = new URL(window.location.href);
            url.searchParams.delete('collab');
            history.replaceState(history.state, '', url.pathname + url.search + url.hash);
            this.render_control();
            this.update_resource_access();
        }
        if (this.error_modal) {
            this.error_modal.show();
            this.error_modal.showError(text);
        } else {
            window.collaborationJoinModal?.show();
            window.collaborationJoinModal?.showError(text);
        }
    }

    // ------------------------------------------------------- local editor

    show_game_code(tag) {
        if (!tag || typeof $ === 'undefined') return;
        $('#game_code_div').show();
        $('#game_code').text(tag);
        $('#game_link')
            .attr('href', `https://2d.hackschule.de/play/${tag}`)
            .text(`https://2d.hackschule.de/play/${tag}`);
    }

    // Rebuilds sprite and level lists after somebody else changed them. The
    // local data (including our own unsent edits) stays as it is.
    rebuild_editor(restore_resource) {
        if (!window.game) return;
        window.game._load();
        this.restore_resource_selection(restore_resource);
        this.focus_current_resource();
    }

    // Puts a value from the session into the local game. Returns false if the
    // resource does not exist locally.
    apply_resource_value(resource, value) {
        const target = parse_collaboration_resource(resource);
        const data = window.game?.data;
        if (!target || !data || !value || typeof value !== 'object') return false;
        const copied = JSON.parse(JSON.stringify(value));

        if (target.kind === 'settings') {
            data.properties = copied;
            window.game.refresh_game_settings_controls?.();
            return true;
        }

        const list = data[target.key];
        const index = Array.isArray(list) ? list.findIndex(item => item?.id === target.id) : -1;
        if (index < 0) return false;

        if (target.kind === 'sprite') {
            // somebody else's version: our undo steps of this sprite would undo theirs
            window.sprite_history?.forget?.(target.id);
            this.apply_sprite_value(index, copied);
            return true;
        }

        // Somebody else's version: our undo steps of this level would undo theirs.
        window.game.level_history?.forget(target.id);
        list[index] = copied;
        if (this.current_resource() === resource && typeof $ !== 'undefined')
            window.game.level_editor?.reload_level_keeping_view?.(index);
        return true;
    }

    apply_sprite_value(index, copied) {
        const list = window.game.data.sprites;
        const canvas = window.canvas;
        const was_attached = canvas?.sprite_index === index;

        // While somebody draws, usually only pixels change. Then the frames
        // are updated in place and only the visible frame is reloaded: state
        // and frame lists, traits panel and zoom stay as they are.
        if (collaboration_same_sprite_structure(list[index], copied)) {
            collaboration_copy_frame_sources(list[index], copied);
            window.game.update_material_for_sprite(index);
            window.game.refresh_frames_on_screen();
            window.game.level_editor?.render?.();
            if (was_attached) {
                const src = list[index].states[canvas.state_index]?.frames[canvas.frame_index]?.src;
                if (src) this.reload_canvas_keeping_view(() => canvas.loadFromUrl(src, false, () => this.restore_canvas_view()));
            }
            return;
        }

        // The sprite canvas stays attached even while another pane (for
        // example the level editor) is visible. Preserve that selection
        // before replacing the sprite so returning to the sprite pane never
        // shows stale pixels or a detached canvas.
        const previous_state_index = was_attached ? canvas.state_index : 0;
        const previous_frame_index = was_attached ? canvas.frame_index : 0;
        if (was_attached) canvas.detachSprite();

        list[index] = copied;
        window.game.create_geometry_and_material_for_sprite(index);
        window.game.update_material_for_sprite(index);
        window.game.refresh_frames_on_screen();
        // a renamed sprite: hover titles and pickers (its Titel is not a pixel change)
        window.game.refresh_sprite_titles?.();
        if (window.game.level_editor) {
            window.game.level_editor.refresh_blend_materials?.();
            window.game.level_editor.refresh?.();
            window.game.level_editor.render?.();
        }

        if (was_attached && copied.states?.length) {
            const state_index = Math.min(
                Math.max(Number.isInteger(previous_state_index) ? previous_state_index : 0, 0),
                copied.states.length - 1,
            );
            const frames = copied.states[state_index]?.frames ?? [];
            if (frames.length) {
                const frame_index = Math.min(
                    Math.max(Number.isInteger(previous_frame_index) ? previous_frame_index : 0, 0),
                    frames.length - 1,
                );
                this.reload_canvas_keeping_view(() => canvas.attachSprite(index, state_index, frame_index, () => {
                    this.restore_canvas_view();
                    window.game.build_sprite_traits_menu?.();
                }));
            }
        }
    }

    // Loading a frame fits the zoom to the sprite; somebody watching another
    // person draw keeps their own zoom and position instead.
    reload_canvas_keeping_view(load) {
        const canvas = window.canvas;
        this.canvas_view = canvas ? {
            visible_pixels: canvas.visible_pixels, offset_x: canvas.offset_x, offset_y: canvas.offset_y,
            width: canvas.bitmap?.width, height: canvas.bitmap?.height,
        } : null;
        load();
    }

    restore_canvas_view() {
        const view = this.canvas_view;
        const canvas = window.canvas;
        this.canvas_view = null;
        if (!view || !canvas || canvas.bitmap?.width !== view.width || canvas.bitmap?.height !== view.height) return;
        canvas.visible_pixels = view.visible_pixels;
        canvas.offset_x = view.offset_x;
        canvas.offset_y = view.offset_y;
        canvas.handleResize?.();
    }

    restore_resource_selection(resource) {
        const target = parse_collaboration_resource(resource);
        if (!target || typeof $ === 'undefined' || !window.game?.data) return;
        if (target.kind === 'sprite' && current_pane === 'sprites') {
            const index = window.game.data.sprites.findIndex(sprite => sprite?.id === target.id);
            if (index >= 0) $('#menu_sprites > ._dnd_item').eq(index).children().eq(0).trigger('click');
        } else if (target.kind === 'level' && current_pane === 'level') {
            const index = window.game.data.levels.findIndex(level => level?.id === target.id);
            if (index >= 0) $('#menu_levels > ._dnd_item').eq(index).children().eq(0).trigger('click');
        }
    }

    current_resource() {
        const data = window.game?.data;
        if (!data || typeof current_pane === 'undefined') return null;
        if (current_pane === 'sprites' && Number.isInteger(window.canvas?.sprite_index))
            return collaboration_resource('sprite', data.sprites?.[window.canvas.sprite_index]?.id);
        if (current_pane === 'level' && Number.isInteger(window.game.level_editor?.level_index))
            return collaboration_resource('level', data.levels?.[window.game.level_editor.level_index]?.id);
        if (current_pane === 'settings') return 'settings';
        return null;
    }

    // ------------------------------------------------------- loops

    start_heartbeat() {
        this.stop_heartbeat();
        this.heartbeat_interval = setInterval(() => {
            this.send({ type: 'heartbeat' });
        }, 30_000);
    }

    stop_heartbeat() {
        if (this.heartbeat_interval !== null) {
            clearInterval(this.heartbeat_interval);
            this.heartbeat_interval = null;
        }
    }

    start_resource_loop() {
        if (this.resource_interval !== null) return;
        this.resource_interval = setInterval(() => {
            this.focus_current_resource();
            this.sync_current_resource();
            this.update_resource_access();
        }, 200);
    }

    schedule_reconnect() {
        if (!this.code || !this.name || this.reconnect_timeout !== null) return;
        this.reconnect_timeout = setTimeout(() => {
            this.reconnect_timeout = null;
            this.connect(this.code, this.name, this.error_modal);
        }, this.reconnect_delay);
        this.reconnect_delay = Math.min(this.reconnect_delay * 2, 10_000);
    }

    // ------------------------------------------------------- locks

    // Follows what the user is looking at. Switching costs one message: the
    // server moves our lock to the new resource in one step. Editing does not
    // wait for that answer (see can_edit_current); only a lock somebody else
    // holds makes a resource read-only.
    focus_current_resource(force = false) {
        if (!this.connected || this.awaiting_snapshot) return;
        const resource = this.current_resource();
        if (!force && resource === this.focused_resource) {
            this.ensure_current_resource_lock();
            return;
        }

        const old_resource = this.focused_resource;
        if (old_resource && old_resource !== resource && !this.resource_synced(old_resource)) {
            // Send the last changes of the resource we are leaving first. If
            // its lock is still on the way, wait for it (then they are sent).
            if (this.owns_lock(old_resource)) this.flush_resource(old_resource);
            if (this.owns_lock(old_resource) || this.lock_request?.resource === old_resource) return;
        }

        this.focused_resource = resource;
        this.lock_request = null;
        this.lock_retry_at = Date.now() + COLLABORATION_LOCK_RETRY_MS;
        this.last_observed_serialized = this.serialize_local_resource(resource);
        this.resource_changed_at = performance.now();
        if (resource) this.request_lock(resource);
        else this.release_stray_lock();
        this.update_resource_access();
    }

    ensure_current_resource_lock() {
        const resource = this.focused_resource;
        if (!this.connected || !resource) return;
        if (this.lock_request) {
            // No answer for a long time (should not happen): ask again.
            if (Date.now() - this.lock_request.at < COLLABORATION_LOCK_TIMEOUT_MS) return;
            this.lock_request = null;
        }
        const holder = this.lock_holder(resource);
        if (!holder) {
            this.request_lock(resource);
        } else if (holder.id !== this.participant_id && Date.now() >= this.lock_retry_at) {
            // The server hands the lock over once its holder has not used it
            // for a while, so keep asking now and then.
            this.lock_retry_at = Date.now() + COLLABORATION_LOCK_RETRY_MS;
            this.request_lock(resource);
        }
    }

    request_lock(resource) {
        if (!this.connected || !resource || this.lock_request) return;
        if (this.owns_lock(resource)) return;
        if (this.send({ type: 'lock', resource })) this.lock_request = { resource, at: Date.now() };
    }

    lock_holder(resource, participants = this.participants) {
        if (!resource) return null;
        return (participants ?? []).find(participant => participant.lock?.resource === resource) ?? null;
    }

    owns_lock(resource) {
        return !!resource && this.lock_holder(resource)?.id === this.participant_id;
    }

    // Who else is working on this resource, if anybody.
    other_holder(resource) {
        const holder = this.lock_holder(resource);
        return holder && holder.id !== this.participant_id ? holder : null;
    }

    // Editing is possible while connected unless somebody else holds the
    // resource. Before our own lock arrives, edits are kept locally and sent
    // once it is there (or undone if somebody else was faster).
    can_edit_current() {
        const resource = this.current_resource();
        if (!this.code || !resource) return true;
        return this.connected && !this.awaiting_snapshot && !this.other_holder(resource);
    }

    // ------------------------------------------------------- resource sync

    serialize_local_resource(resource) {
        const value = collaboration_resource_value(window.game?.data, resource);
        return value === null ? null : JSON.stringify(value);
    }

    remember_server_value(resource) {
        const serialized = this.serialize_local_resource(resource);
        if (serialized === null) this.server_values.delete(resource);
        else this.server_values.set(resource, serialized);
    }

    remember_all_server_values() {
        this.server_values = new Map();
        const data = window.game?.data;
        if (!data) return;
        this.remember_server_value('settings');
        for (const [kind, key] of Object.entries(COLLABORATION_COLLECTIONS))
            for (const item of Array.isArray(data[key]) ? data[key] : [])
                if (typeof item?.id === 'string') this.remember_server_value(collaboration_resource(kind, item.id));
    }

    // True if the local copy holds nothing the server does not have yet.
    resource_synced(resource) {
        if (!resource) return true;
        if (this.pending_update?.resource === resource) return false;
        const base = this.server_values.get(resource);
        const serialized = this.serialize_local_resource(resource);
        return serialized === null || base === undefined || serialized === base;
    }

    send_update(resource, serialized) {
        if (this.pending_update || serialized === null) return false;
        const sent = this.send({
            type: 'update',
            resource,
            resource_revision: this.resource_revisions[resource] ?? 0,
            value: JSON.parse(serialized),
        });
        if (sent) this.pending_update = { resource, serialized };
        return sent;
    }

    flush_resource(resource) {
        if (!this.owns_lock(resource) || this.pending_update || this.resource_synced(resource)) return;
        this.send_update(resource, this.serialize_local_resource(resource));
    }

    // Polled: sends the resource we hold once it has not changed for 300 ms.
    // A resource somebody else holds always shows the server's version: a
    // stroke that was still being drawn when their lock arrived is undone.
    sync_current_resource() {
        const resource = this.focused_resource;
        if (!this.connected || !resource || this.awaiting_snapshot || this.pending_update) return;
        if (!this.owns_lock(resource)) {
            const holder = this.other_holder(resource);
            if (holder && !this.resource_synced(resource)) this.lock_denied(resource, holder);
            return;
        }
        const serialized = this.serialize_local_resource(resource);
        if (serialized === null) return;
        const now = performance.now();
        if (serialized !== this.last_observed_serialized) {
            this.last_observed_serialized = serialized;
            this.resource_changed_at = now;
            return;
        }
        if (serialized === this.server_values.get(resource) || now - this.resource_changed_at < 300) return;
        this.send_update(resource, serialized);
    }

    // ------------------------------------------------------- structure

    // Called by the sprite and level lists before an item is deleted.
    can_delete(kind, id) {
        if (!this.code) return true;
        if (!this.connected || this.awaiting_snapshot) return false;
        const holder = this.lock_holder(collaboration_resource(kind, id));
        if (holder && holder.id !== this.participant_id) {
            this.show_temporary_notice(collaboration_rejection_notice(
                { request: 'delete', kind, reason: 'locked' }, holder.name), 3500);
            return false;
        }
        return true;
    }

    // Called by the sprite and level lists after an item was added, deleted
    // or moved locally. The server confirms (or refuses) the change.
    structure_changed(kind, action, id) {
        if (!this.code) return;
        const key = COLLABORATION_COLLECTIONS[kind];
        const list = window.game?.data?.[key];
        if (!key || !Array.isArray(list) || typeof id !== 'string') return;

        const message = { type: action, kind, id };
        if (action === 'insert') {
            const item = list.find(entry => entry?.id === id);
            if (!item) return;
            message.value = JSON.parse(JSON.stringify(item));
        }
        if (action === 'insert' || action === 'move') message.after_id = collaboration_after_id(list, id);

        if (this.connected && !this.awaiting_snapshot && this.send(message)) {
            this.pending_structure += 1;
            const resource = collaboration_resource(kind, id);
            if (action === 'insert') {
                this.resource_revisions[resource] = 0;
                this.server_values.set(resource, JSON.stringify(message.value));
            }
            if (action === 'delete') this.server_values.delete(resource);
        } else {
            // The change cannot be shared right now; the next snapshot (or the
            // welcome after reconnecting) replaces it.
            this.request_snapshot();
        }
    }

    // While the session is not usable, sprites and levels cannot be added,
    // dragged or deleted (on touch devices dragging starts with touchstart).
    install_structure_guards() {
        const blocked = () => !!this.code && (!this.connected || this.awaiting_snapshot);
        const items = '#menu_sprites > ._dnd_item:not(.add), #menu_levels > ._dnd_item:not(.add)';
        const add = '#menu_sprites > ._dnd_item.add, #menu_levels > ._dnd_item.add';
        for (const type of ['mousedown', 'touchstart']) {
            document.addEventListener(type, (event) => {
                if (blocked() && event.target.closest?.(items)) event.stopPropagation();
            }, true);
        }
        document.addEventListener('click', (event) => {
            if (!blocked() || !event.target.closest?.(add)) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.show_temporary_notice('Gerade besteht keine Verbindung zur gemeinsamen Sitzung. Warte kurz, bis sie wieder da ist.', 4000);
        }, true);
    }

    // ------------------------------------------------------- leaving

    others_present() {
        return this.participants.some(participant => participant.id !== this.participant_id);
    }

    // Changes in the session that no shared save contains yet, including our
    // own latest change that may not even have reached the server.
    has_unsaved_changes() {
        if (this.revision > this.saved_revision || this.pending_update) return true;
        return !this.resource_synced(this.focused_resource);
    }

    // Leaves the session and then calls proceed(). Asks first when loading
    // another game (easy to do without thinking of the session), and
    // whenever leaving would lose unsaved shared work.
    confirm_leave(reason, proceed = null) {
        if (!this.code) {
            proceed?.();
            return;
        }
        const alone = !this.others_present();
        const unsaved = this.has_unsaved_changes();
        if (reason !== 'load' && !(alone && unsaved)) {
            this.leave();
            proceed?.();
            return;
        }
        this.pending_leave = proceed ?? (() => {});
        const text = collaboration_leave_text(reason, { alone, unsaved });
        // Shown after the current click handler: the game list closes its own
        // dialog right after asking to load, which would hide this one too.
        // Asked from the session dialog: that one makes room and comes back
        // if the answer is "Abbrechen".
        this.leave_asked_from_status = reason === 'leave';
        setTimeout(() => {
            if (typeof $ !== 'undefined') $('#collaboration_leave_text').text(text);
            globalThis.window?.collaborationStatusModal?.hide();
            globalThis.window?.collaborationLeaveModal?.show();
        }, 0);
    }

    confirmed_leave() {
        const proceed = this.pending_leave;
        this.pending_leave = null;
        this.leave();
        proceed?.();
    }

    install_load_guard() {
        if (typeof window.game?.load !== 'function' || this.original_game_load) return;
        this.original_game_load = window.game.load.bind(window.game);
        const self = this;
        window.game.load = function (tag) {
            if (!self.code) return self.original_game_load(tag);
            self.confirm_leave('load', () => self.original_game_load(tag));
        };
    }

    // Closing or reloading the tab: send our last change, and let the browser
    // ask first if this would lose shared work nobody else can save.
    install_page_guards() {
        window.addEventListener('pagehide', () => {
            if (this.connected && this.owns_lock(this.focused_resource))
                this.flush_resource(this.focused_resource);
        });
        window.addEventListener('beforeunload', (event) => {
            if (!this.code || !this.connected || this.others_present() || !this.has_unsaved_changes()) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    // ------------------------------------------------------- shared save

    install_save_guard() {
        if (typeof window.game?.save !== 'function' || this.original_game_save) return;
        this.original_game_save = window.game.save.bind(window.game);
        const self = this;
        window.game.save = function () {
            if (self.code) return self.request_shared_save();
            return self.original_game_save();
        };
    }

    request_shared_save() {
        if (!this.code) return this.original_game_save?.();
        if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) {
            this.show_temporary_notice('Das Spiel kann erst gespeichert werden, wenn die gemeinsame Sitzung wieder verbunden ist.', 4500);
            return;
        }
        if (this.save_pending || this.save_after_sync) {
            this.show_temporary_notice('Das gemeinsame Spiel wird bereits gespeichert.', 3000);
            return;
        }
        if (this.awaiting_snapshot || this.pending_structure > 0) {
            this.show_temporary_notice('Warte kurz, bis der gemeinsame Stand wieder vollständig synchronisiert ist.', 4000);
            return;
        }

        this.save_after_sync = true;
        this.continue_shared_save();
    }

    // Saving waits until our own latest change has reached the server.
    continue_shared_save() {
        if (!this.save_after_sync || this.save_pending || this.pending_update) return;

        const resource = this.focused_resource;
        if (resource && !this.resource_synced(resource)) {
            // Our lock may still be on its way; the save continues once the
            // change has been sent and confirmed.
            if (!this.owns_lock(resource)) return;
            if (!this.send_update(resource, this.serialize_local_resource(resource)))
                this.cancel_shared_save('Die letzte Änderung konnte vor dem Speichern nicht synchronisiert werden.');
            return;
        }

        this.save_after_sync = false;
        this.save_pending = true;
        if (window.game) window.game.currently_saving = true;
        const palette = typeof palettes !== 'undefined' && typeof selected_palette_index !== 'undefined'
            ? palettes[selected_palette_index]?.colors : undefined;
        if (!this.send({ type: 'save', ...(Array.isArray(palette) ? { palette } : {}) }))
            this.cancel_shared_save('Das gemeinsame Spiel konnte nicht gespeichert werden.');
    }

    cancel_shared_save(message = null) {
        this.save_after_sync = false;
        this.save_pending = false;
        if (window.game) window.game.currently_saving = false;
        if (message) this.show_temporary_notice(message, 5000);
    }

    handle_saved(message) {
        if (typeof message.tag !== 'string' || !message.tag) return;
        const mine = message.saved_by_id === this.participant_id;
        // Saving counts as an operation (it changes the parent); a gap is
        // handled like for every other operation.
        const in_order = this.accept_revision(message);
        this.source_tag = message.tag;
        if (in_order) {
            this.saved_revision = message.revision;
            if (Array.isArray(message.participants)) this.participants = message.participants;
            if (window.game?.data) window.game.data.parent = message.tag;
        }
        this.show_game_code(message.tag);

        if (mine) {
            this.save_after_sync = false;
            this.save_pending = false;
            if (window.game) window.game.currently_saving = false;
        }
        if (message.icon) {
            $('#save_notification img').attr('src', `noto/${message.icon}.png`);
            $('#save_notification').addClass('showing');
            setTimeout(() => $('#save_notification').removeClass('showing'), 3000);
        }
        this.show_temporary_notice(collaboration_saved_notice(message.saved_by, mine), 3500);
        this.render_control();
        this.render_status();
        if (!mine) this.continue_shared_save();
    }

    handle_save_error(message) {
        this.cancel_shared_save(collaboration_save_error_message(message.error));
    }

    show() {
        if (this.code) {
            window.collaborationStatusModal.show();
        } else {
            window.collaborationChoiceModal.show();
        }
    }

    leave() {
        // Send the last change of the resource we are editing before leaving.
        if (this.connected && this.owns_lock(this.focused_resource))
            this.flush_resource(this.focused_resource);
        const socket = this.socket;
        this.socket = null;
        if (socket) socket.close(1000, 'left_session');
        this.end_session();
    }

    // Stops taking part in the session in this tab, without reconnecting.
    end_session(notice = null) {
        this.intentional_close = true;
        this.has_connected_once = false;
        this.pending_leave = null;
        this.stop_heartbeat();
        if (this.reconnect_timeout !== null) {
            clearTimeout(this.reconnect_timeout);
            this.reconnect_timeout = null;
        }
        this.socket = null;
        this.connected = false;
        this.participants = [];
        this.focused_resource = null;
        this.reset_sync_state();
        this.save_after_sync = false;
        this.save_pending = false;
        if (window.game) window.game.currently_saving = false;
        if (this.code) {
            sessionStorage.removeItem(this.participant_storage_key(this.code));
            sessionStorage.removeItem(this.name_storage_key(this.code));
            sessionStorage.removeItem(this.token_storage_key(this.code));
        }
        this.code = null;
        this.name = null;
        this.participant_id = null;
        this.reconnect_token = null;
        const url = new URL(window.location.href);
        url.search = this.source_tag ? `?${this.source_tag}` : '';
        this.source_tag = null;
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
        this.render_control();
        this.update_resource_access();
        window.collaborationStatusModal?.dismiss();
        if (notice) this.show_temporary_notice(notice, 8000);
    }

    set_code_in_url(code) {
        code = normalize_collaboration_code(code);
        if (!code) return;
        const url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('collab', code);
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }

    // ------------------------------------------------------- status bar

    // A small square in the participant's colour with their initial, like a
    // swatch from the palette.
    token(participant, extra_class = '') {
        return $('<span>')
            .addClass(`collab-token ${extra_class}`.trim())
            .toggleClass('is-me', participant.id === this.participant_id)
            .css('--collab-color', collaboration_color(participant))
            .attr('title', participant.name)
            .text(collaboration_initial(participant.name));
    }

    append_status_control(status_bar = null) {
        if (typeof $ === 'undefined') return;
        status_bar ??= $('#status-bar');
        if (!status_bar?.length) return;
        let control = status_bar.find('#collaboration-control');
        if (!control.length) {
            control = $('<div id="collaboration-control">')
                .addClass('status-bar-item status-bar-button collab-status')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.show();
                });
        }

        control.detach();
        control.toggleClass('connected', this.connected);
        control.toggleClass('disconnected', !!this.code && !this.connected);
        control.toggleClass('active-session', !!this.code);
        control.empty();

        if (this.code) {
            control.attr('title', this.connected
                ? 'Gemeinsame Sitzung: Code, Leute und wer woran arbeitet'
                : collaboration_connection_status(false, this.has_connected_once));
            control.append($('<span>').addClass('collab-status-dot'));
            control.append($('<span>').addClass('collab-status-label').text('Gemeinsam'));
            const stack = $('<span>').addClass('collab-token-stack');
            const shown = this.participants.slice(0, 6);
            for (const participant of shown) stack.append(this.token(participant));
            if (this.participants.length > shown.length)
                stack.append($('<span>').addClass('collab-token collab-token-more').text(`+${this.participants.length - shown.length}`));
            control.append(stack);
            status_bar.prepend(control);
        } else {
            control.attr('title', 'Mit anderen zusammen an diesem Spiel arbeiten');
            control.append($('<span>').text('Zusammenarbeiten'));
            status_bar.append(control);
        }
        // its width changes what is left for the tool's hints (menu.js)
        if (typeof refresh_status_bar_keys === 'function') refresh_status_bar_keys(status_bar[0]);
    }

    render_control() {
        this.append_status_control();
        this.render_activity();
    }

    // ------------------------------------------------------- session dialog

    render_status() {
        if (typeof $ === 'undefined') return;

        const connection = $('#collaboration_connection');
        connection.toggleClass('connected', this.connected);
        connection.toggleClass('reconnecting', !!this.code && !this.connected);
        $('#collaboration_connection_status').text(
            collaboration_connection_status(this.connected, this.has_connected_once)
        );

        const tiles = $('#collaboration_session_code').empty();
        for (const char of this.code ?? '——————') tiles.append($('<span>').text(char));

        $('#collaboration_participants_title').text(collaboration_people_title(this.participants.length));
        const list = $('#collaboration_participants').empty();
        for (const participant of this.participants) {
            const me = participant.id === this.participant_id;
            const activity = collaboration_activity(participant, window.game?.data, me);
            const row = $('<div>').addClass('collab-person').toggleClass('is-me', me)
                .css('--collab-color', collaboration_color(participant));
            row.append(this.token(participant, 'collab-token-large'));
            const text = $('<div>').addClass('collab-person-text').appendTo(row);
            const name = $('<div>').addClass('collab-person-name').text(participant.name).appendTo(text);
            if (me) name.append($('<span>').addClass('collab-me').text('du'));
            const doing = $('<div>').addClass('collab-person-activity').text(activity.text).appendTo(text);
            if (activity.picture) doing.append($('<img>').attr({ src: activity.picture, alt: '' }));
            list.append(row);
        }
    }

    copy_to_clipboard(text, button) {
        const done = () => {
            const label = button.data('label') ?? button.html();
            button.data('label', label).addClass('copied').html('<i class="fa fa-check"></i> Kopiert');
            clearTimeout(button.data('timer'));
            button.data('timer', setTimeout(() => button.removeClass('copied').html(label), 2000));
        };
        const fallback = () => {
            const input = $('<textarea>').val(text).css({ position: 'fixed', opacity: 0 }).appendTo('body');
            input[0].select();
            try { document.execCommand('copy'); done(); } catch (_error) {}
            input.remove();
        };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
        else fallback();
    }

    session_link() {
        const url = new URL(window.location.href);
        url.search = '';
        url.hash = '';
        url.searchParams.set('collab', this.code);
        return url.toString();
    }

    // ------------------------------------------------------- who works where

    // Marks the sprites and levels other people are working on with their
    // colour and initial. Runs often, so it only touches items that change.
    render_activity() {
        if (typeof $ === 'undefined' || !window.game?.data) return;
        if ($('html').data('_dnd_moving')) return; // the lists are being rearranged
        const holders = new Map();
        if (this.code) {
            for (const participant of this.participants) {
                if (participant.id !== this.participant_id && participant.lock?.resource)
                    holders.set(participant.lock.resource, participant);
            }
        }
        for (const [kind, key, list] of [['sprite', 'sprites', '#menu_sprites'], ['level', 'levels', '#menu_levels']]) {
            const items = $(`${list} > ._dnd_item:not(.add)`);
            const data = window.game.data[key] ?? [];
            items.each((index, element) => {
                const item = $(element).children().eq(0);
                const holder = holders.get(collaboration_resource(kind, data[index]?.id)) ?? null;
                const marker = holder ? `${holder.id}:${holder.name}:${holder.color}` : '';
                if (item.attr('data-collab-holder') === marker) return;
                item.attr('data-collab-holder', marker);
                item.children('.collab-marker').remove();
                item.toggleClass('collab-held', !!holder);
                if (!holder) {
                    item.css('--collab-color', '');
                    return;
                }
                item.css('--collab-color', collaboration_color(holder));
                item.append(this.token(holder, 'collab-marker').attr('title', collaboration_occupied_text(holder.name, collaboration_resource(kind, data[index].id)).split('.')[0]));
            });
        }
    }

    // ------------------------------------------------------- notices

    ensure_notice() {
        if (typeof $ === 'undefined') return { text() { return this; }, show() { return this; }, hide() { return this; } };
        let notice = $('#collaboration-resource-notice');
        if (!notice.length)
            notice = $('<div id="collaboration-resource-notice" class="collab-toast" role="status">').hide().appendTo('body');
        return notice;
    }

    show_temporary_notice(text, duration = 3500) {
        this.notice_override = text;
        this.notice_override_until = Date.now() + duration;
        this.ensure_notice().text(text).show();
    }

    // ------------------------------------------------------- read-only view

    // The drawing surface, level or settings for a resource, and the panels
    // around it that only make sense when one may edit.
    static targets(resource) {
        const kind = parse_collaboration_resource(resource)?.kind;
        // The tool bars stay usable: choosing the hand tool to look around
        // does not change anything.
        if (kind === 'sprite') return {
            surface: '#canvas',
            tools: '#color_menu, #color_variations_menu, #functions_dropdown, #undo_stack, #menu_frames, #states_container, #menu_sprite_properties, #sprite_traits_group',
        };
        if (kind === 'level') return {
            surface: '#level',
            tools: '#tool_menu_level_settings, #menu_level_sprites, #menu_layers, #menu_level_properties, #menu_layer_properties, #menu_placed_properties',
        };
        if (kind === 'settings') return { surface: '#game-settings-here', tools: '' };
        return null;
    }

    // Read-only means: the surface stays fully visible (watching somebody
    // work is the point) inside a frame in their colour with a name tag; the
    // tools around it are dimmed. holder is null when we are disconnected.
    set_controls_readonly(resource, readonly, holder = null) {
        if (typeof $ === 'undefined') return;
        // Called several times a second: only touch the page when something changed.
        const key = readonly ? `${resource}|${holder ? `${holder.id}:${holder.name}:${holder.color}` : 'offline'}` : '';
        if (key !== this.readonly_key) {
            this.readonly_key = key;
            $('.collab-readonly-tools').removeClass('collab-readonly-tools');
            $('.collab-occupied').removeClass('collab-occupied collab-offline').css('--collab-color', '');
            const targets = readonly ? CollaborationClient.targets(resource) : null;
            if (targets) {
                if (targets.tools) $(targets.tools).addClass('collab-readonly-tools');
                $(targets.surface).addClass('collab-occupied').toggleClass('collab-offline', !holder)
                    .css('--collab-color', holder ? collaboration_color(holder) : '');
                const tag = this.ensure_occupied_tag().empty().toggleClass('collab-offline', !holder)
                    .css('--collab-color', holder ? collaboration_color(holder) : '');
                if (holder) tag.append(this.token(holder), $('<span>').text(collaboration_occupied_text(holder.name, resource)));
                else tag.append($('<i class="fa fa-plug"></i>'), $('<span>').text('Die Verbindung ist unterbrochen. Bis sie wieder da ist, kannst du nichts ändern.'));
            }
        }
        this.place_occupied_tag(readonly ? CollaborationClient.targets(resource)?.surface : null);
    }

    // On a surface somebody else is working on, only looking around works:
    // the hand tool, the mouse wheel and two-finger gestures.
    install_readonly_guard() {
        const looking_around = (event, surface) => {
            if ((event.touches?.length ?? 0) >= 2) return true;
            if (surface.id === 'canvas') return window.canvas?.menu?.get?.('tool') === 'tool/pan';
            if (surface.id === 'level') return typeof menus !== 'undefined' && menus.level?.active_key === 'tool/pan';
            return false;
        };
        for (const type of ['mousedown', 'touchstart', 'pointerdown', 'dblclick']) {
            document.addEventListener(type, (event) => {
                const surface = event.target.closest?.('.collab-occupied');
                if (!surface || looking_around(event, surface)) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }, { capture: true, passive: false });
        }
    }

    ensure_occupied_tag() {
        let tag = $('#collaboration-occupied-tag');
        if (!tag.length) tag = $('<div id="collaboration-occupied-tag" class="collab-occupied-tag" role="status">').hide().appendTo('body');
        return tag;
    }

    // The tag sits inside the top left corner of the surface it belongs to.
    place_occupied_tag(surface) {
        const tag = $('#collaboration-occupied-tag');
        const element = surface ? $(surface)[0] : null;
        const rect = element?.getBoundingClientRect();
        if (!rect || rect.width === 0 || !$(element).is(':visible')) {
            tag.hide();
            return;
        }
        tag.css({ left: `${Math.round(rect.left + 8)}px`, top: `${Math.round(rect.top + 8)}px`, 'max-width': `${Math.max(160, Math.round(rect.width - 16))}px` }).show();
    }

    update_resource_access() {
        if (typeof $ === 'undefined') return;
        const resource = this.current_resource();
        const notice = this.ensure_notice();

        if (this.notice_override && Date.now() < this.notice_override_until) {
            notice.text(this.notice_override).show();
        } else {
            this.notice_override = null;
            notice.hide();
        }

        this.render_activity();
        if (!this.code || !resource) {
            this.set_controls_readonly(resource, false);
            return;
        }
        this.set_controls_readonly(resource, !this.can_edit_current(), this.connected ? this.other_holder(resource) : null);
    }
}

function wait_for_collaboration_game(callback) {
    if (window.game?.data) {
        callback();
        return;
    }
    setTimeout(() => wait_for_collaboration_game(callback), 50);
}

function setup_collaboration_ui() {
    window.collaboration = new CollaborationClient();
    window.collaboration.install_structure_guards();
    window.collaboration.install_page_guards();
    window.collaboration.install_readonly_guard();

    window.collaborationLeaveModal = new ModalDialog({
        title: 'Gemeinsame Sitzung verlassen?',
        width: '460px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog">
                <p id="collaboration_leave_text" class="collab-lead"></p>
            </div>
        `,
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                callback: (self) => {
                    window.collaboration.pending_leave = null;
                    self.dismiss();
                    if (window.collaboration.leave_asked_from_status) window.collaborationStatusModal.show();
                },
            },
            {
                type: 'button',
                label: 'Sitzung verlassen',
                color: 'collab-leave',
                callback: (self) => {
                    self.dismiss();
                    window.collaboration.confirmed_leave();
                },
            },
        ],
    });

    window.collaborationChoiceModal = new ModalDialog({
        title: 'Zusammenarbeiten',
        width: '460px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog">
                <p class="collab-lead">Mehrere Leute können gleichzeitig am selben Spiel arbeiten, jede und jeder am eigenen Computer.</p>
                <div class="collab-choices">
                    <button id="collaboration_choose_start" class="collab-choice" type="button">
                        <i class="fa fa-user-plus"></i>
                        <strong>Neue Sitzung starten</strong>
                        <span>Mit deinem Spiel, so wie es gerade ist. Du bekommst einen Code für die anderen.</span>
                    </button>
                    <button id="collaboration_choose_join" class="collab-choice" type="button">
                        <i class="fa fa-sign-in"></i>
                        <strong>Sitzung beitreten</strong>
                        <span>Jemand hat dir einen Code genannt.</span>
                    </button>
                </div>
            </div>
        `,
        onshow: (self) => {
            $('#collaboration_choose_start')
                .off('click.collaboration')
                .on('click.collaboration', () => {
                    self.dismiss();
                    window.collaborationStartModal.show();
                });
            $('#collaboration_choose_join')
                .off('click.collaboration')
                .on('click.collaboration', () => {
                    self.dismiss();
                    window.collaborationJoinCodeModal.show();
                });
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                callback: (self) => self.dismiss(),
            },
        ],
    });

    window.collaborationStartModal = new ModalDialog({
        title: 'Neue Sitzung',
        width: '420px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog">
                <p class="collab-lead">Die anderen sehen deinen Namen, solange die Sitzung läuft. Ein Vorname reicht.</p>
                <label class="collab-field">
                    <span>Dein Name</span>
                    <input id="collaboration_start_name" maxlength="40" autocomplete="off" spellcheck="false">
                </label>
            </div>
        `,
        onshow: () => {
            $('#collaboration_start_name').trigger('focus');
        },
        footer: [
            {
                type: 'button',
                label: 'Zurück',
                callback: (self) => {
                    self.dismiss();
                    window.collaborationChoiceModal.show();
                },
            },
            {
                type: 'button',
                label: 'Sitzung starten',
                color: 'green',
                callback: (self) => {
                    window.collaboration.start($('#collaboration_start_name').val(), self);
                },
            },
        ],
    });

    window.collaborationJoinCodeModal = new ModalDialog({
        title: 'Sitzung beitreten',
        width: '420px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog">
                <label class="collab-field">
                    <span>Code der Sitzung</span>
                    <input id="collaboration_join_input_code" class="collab-code-input" placeholder="······"
                           maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false">
                </label>
                <label class="collab-field">
                    <span>Dein Name</span>
                    <input id="collaboration_join_input_name" maxlength="40" autocomplete="off" spellcheck="false">
                </label>
                <p class="collab-note"><i class="fa fa-info-circle"></i> Dein Spiel hier wird durch das gemeinsame Spiel ersetzt. Speichere es vorher, wenn du es behalten willst.</p>
            </div>
        `,
        onshow: () => {
            $('#collaboration_join_input_code')
                .val('')
                .off('input.collaboration')
                .on('input.collaboration', function () {
                    this.value = format_collaboration_code_input(this.value);
                })
                .trigger('focus');
        },
        footer: [
            {
                type: 'button',
                label: 'Zurück',
                callback: (self) => {
                    self.dismiss();
                    window.collaborationChoiceModal.show();
                },
            },
            {
                type: 'button',
                label: 'Beitreten',
                color: 'green',
                callback: (self) => {
                    window.collaboration.join(
                        $('#collaboration_join_input_code').val(),
                        $('#collaboration_join_input_name').val(),
                        self,
                    );
                },
            },
        ],
    });

    // Used when somebody opens a collaboration URL directly. The code is
    // already known here, so the student only has to enter a name.
    window.collaborationJoinModal = new ModalDialog({
        title: 'Sitzung beitreten',
        width: '420px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog">
                <p class="collab-lead">Du trittst der Sitzung <span id="collaboration_join_code" class="collab-inline-code"></span> bei.</p>
                <label class="collab-field">
                    <span>Dein Name</span>
                    <input id="collaboration_join_name" maxlength="40" autocomplete="off" spellcheck="false">
                </label>
                <p class="collab-note"><i class="fa fa-info-circle"></i> Dein Spiel hier wird durch das gemeinsame Spiel ersetzt.</p>
            </div>
        `,
        onshow: () => {
            const code = collaboration_code_from_url(window.location.href);
            const remembered = code ? sessionStorage.getItem(window.collaboration.name_storage_key(code)) : '';
            $('#collaboration_join_code').text(code ?? '');
            $('#collaboration_join_name').val(remembered ?? '').trigger('focus');
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Beitreten',
                color: 'green',
                callback: (self) => {
                    const code = collaboration_code_from_url(window.location.href);
                    window.collaboration.join(code, $('#collaboration_join_name').val(), self);
                },
            },
        ],
    });

    window.collaborationStatusModal = new ModalDialog({
        title: 'Gemeinsame Sitzung',
        width: '460px',
        max_width: '90vw',
        body: `
            <div class="collab-dialog">
                <div class="collab-code">
                    <div id="collaboration_session_code" class="collab-code-tiles" aria-label="Code der Sitzung"></div>
                    <p class="collab-code-help">Die anderen klicken in der Leiste unten auf <b>Zusammenarbeiten</b>, dann auf <b>Sitzung beitreten</b>, und tippen diesen Code ein.</p>
                    <div class="collab-code-actions">
                        <button id="collaboration_copy_code" type="button"><i class="fa fa-clipboard"></i> Code kopieren</button>
                        <button id="collaboration_copy_link" type="button"><i class="fa fa-link"></i> Link kopieren</button>
                    </div>
                </div>

                <div class="collab-people-head">
                    <h4 id="collaboration_participants_title"></h4>
                    <div id="collaboration_connection" class="collab-connection">
                        <span class="collab-status-dot"></span>
                        <span id="collaboration_connection_status"></span>
                    </div>
                </div>
                <div id="collaboration_participants" class="collab-people"></div>
                <p class="collab-note">Die Namen gibt es nur in dieser Sitzung. Sie sind keine Konten.</p>
            </div>
        `,
        onshow: () => {
            window.collaboration.render_status();
            $('#collaboration_copy_code').off('click.collaboration').on('click.collaboration', function () {
                window.collaboration.copy_to_clipboard(window.collaboration.code ?? '', $(this));
            });
            $('#collaboration_copy_link').off('click.collaboration').on('click.collaboration', function () {
                window.collaboration.copy_to_clipboard(window.collaboration.session_link(), $(this));
            });
        },
        footer: [
            {
                type: 'button',
                label: 'Sitzung verlassen',
                color: 'collab-leave',
                // not what Enter does here: it closes (modaldialogs.js)
                enter: false,
                callback: () => window.collaboration.confirm_leave('leave'),
            },
            {
                type: 'button',
                label: 'Schließen',
                callback: (self) => self.dismiss(),
            },
        ],
    });

    // Enter in a field does what the green button does.
    for (const modal of [window.collaborationStartModal, window.collaborationJoinCodeModal, window.collaborationJoinModal]) {
        modal.dialog.on('keydown', 'input', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            modal.dialog.find('.modal-footer button.green').trigger('click');
        });
    }

    window.collaboration.render_control();
    window.collaboration.install_save_guard();

    const code = collaboration_code_from_url(window.location.href);
    if (code) {
        wait_for_collaboration_game(() => {
            window.collaboration.install_save_guard();
            const remembered_name = sessionStorage.getItem(window.collaboration.name_storage_key(code));
            const remembered_participant = sessionStorage.getItem(window.collaboration.participant_storage_key(code));
            if (remembered_name && remembered_participant) {
                window.collaboration.connect(code, remembered_name);
            } else {
                window.collaborationJoinModal.show();
            }
        });
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.COLLABORATION) setup_collaboration_ui();
    });
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalize_collaboration_name,
        format_collaboration_code_input,
        normalize_collaboration_code,
        collaboration_code_from_url,
        collaboration_websocket_url,
        collaboration_connection_status,
        collaboration_resource,
        parse_collaboration_resource,
        collaboration_resource_value,
        collaboration_after_id,
        reorder_collaboration_list,
        apply_collaboration_structure,
        collaboration_same_sprite_structure,
        collaboration_copy_frame_sources,
        collaboration_rejection_notice,
        collaboration_lock_taken_notice,
        collaboration_lock_race_notice,
        collaboration_leave_text,
        COLLABORATION_COLORS,
        collaboration_color,
        collaboration_initial,
        collaboration_activity,
        collaboration_occupied_text,
        collaboration_people_title,
        collaboration_join_error_text,
        collaboration_saved_notice,
        collaboration_save_error_message,
        CollaborationClient,
    };
}

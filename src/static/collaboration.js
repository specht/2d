const COLLABORATION_COMMAND_KEY = '__collaboration';
const COLLABORATION_CODE_LENGTH = 6;

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

function collaboration_resource_value(state, resource) {
    if (!state || !resource) return null;
    if (resource === 'settings') return state.properties ?? null;
    const match = /^(sprite|level):(\d+)$/.exec(resource);
    if (!match) return null;
    const collection = match[1] === 'sprite' ? state.sprites : state.levels;
    return Array.isArray(collection) ? (collection[Number(match[2])] ?? null) : null;
}

function collaboration_lock_revisions(participants) {
    const result = {};
    for (const participant of participants ?? []) {
        const lock = participant.lock;
        if (!lock?.resource) continue;
        result[lock.resource] = Number.isInteger(lock.revision) ? lock.revision : 0;
    }
    return result;
}

function collaboration_changed_resources(before_participants, after_participants) {
    const before = collaboration_lock_revisions(before_participants);
    const after = collaboration_lock_revisions(after_participants);
    return Object.keys(after).filter(resource =>
        Object.prototype.hasOwnProperty.call(before, resource) && after[resource] > before[resource]
    );
}

function collaboration_resource_description(resource) {
    if (resource === 'settings') return 'die Einstellungen';
    if (resource?.startsWith('sprite:')) return 'dieses Sprite';
    if (resource?.startsWith('level:')) return 'dieses Level';
    return 'diesen Bereich';
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
        this.source_tag = null;
        this.revision = 0;
        this.participants = [];
        this.socket = null;
        this.connected = false;
        this.has_connected_once = false;
        this.show_status_after_welcome = false;
        this.intentional_close = false;
        this.reconnect_timeout = null;
        this.reconnect_delay = 1000;
        this.heartbeat_interval = null;
        this.resource_interval = null;
        this.error_modal = null;

        this.focused_resource = null;
        this.lock_request_pending = false;
        this.pending_resource_update = false;
        this.synced_resource_serialized = null;
        this.last_observed_resource_serialized = null;
        this.resource_changed_at = 0;
        this.force_full_snapshot = false;
        this.structure_resync_pending = false;
        this.top_level_sprite_refs = [];
        this.top_level_level_refs = [];
        this.notice_override = null;
        this.notice_override_until = 0;
        this.original_game_save = null;
        this.save_after_sync = false;
        this.save_pending = false;
    }

    participant_storage_key(code) {
        return `2d-collaboration:${code}:participant`;
    }

    name_storage_key(code) {
        return `2d-collaboration:${code}:name`;
    }

    remember_participant() {
        if (!this.code) return;
        if (this.name)
            sessionStorage.setItem(this.name_storage_key(this.code), this.name);
        if (this.participant_id)
            sessionStorage.setItem(this.participant_storage_key(this.code), this.participant_id);
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

        const payload = { game: window.game.data };
        if (typeof window.game.data.parent === 'string' && window.game.data.parent)
            payload.source_tag = window.game.data.parent;

        api_call('/api/collaboration/create', payload, (data) => {
            if (!data.success) {
                modal.showError('Die gemeinsame Sitzung konnte nicht gestartet werden.');
                return;
            }
            modal.dismiss();
            this.set_code_in_url(data.code);
            this.show_status_after_welcome = true;
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
            this.pending_resource_update = false;
            this.lock_request_pending = false;
            this.save_after_sync = false;
            this.save_pending = false;
            if (window.game) window.game.currently_saving = false;
            this.stop_heartbeat();
            this.render_control();
            this.update_resource_access();
            if (!this.intentional_close) this.schedule_reconnect();
        });

        ws.addEventListener('error', () => {
            // close will handle reconnect/UI
        });
    }

    handle_message(message) {
        if (message.type === 'welcome') {
            this.connected = true;
            this.has_connected_once = true;
            this.reconnect_delay = 1000;
            this.participant_id = message.participant_id;
            this.source_tag = message.source_tag ?? null;
            this.revision = message.revision;
            this.participants = message.participants ?? [];
            this.remember_participant();
            this.apply_snapshot(message);
            this.capture_top_level_refs();
            this.start_heartbeat();
            this.start_resource_loop();
            this.install_save_guard();
            this.render_control();
            this.render_status();
            this.focus_current_resource(true);
            if (this.show_status_after_welcome) {
                this.show_status_after_welcome = false;
                window.collaborationStatusModal?.show();
            }
            return;
        }

        if (message.type === 'presence') {
            this.participants = message.participants ?? [];
            this.revision = message.revision ?? this.revision;
            this.lock_request_pending = false;
            this.render_control();
            this.render_status();
            this.ensure_current_resource_lock();
            this.update_resource_access();
            return;
        }

        if (message.type === 'state' || message.type === 'resync') {
            this.handle_state_message(message);
            return;
        }

        if (message.type === 'saved') {
            this.handle_saved(message);
            return;
        }

        if (message.type === 'save_error') {
            this.handle_save_error(message);
            return;
        }

        if (message.type === 'error') {
            this.intentional_close = true;
            const session_not_found = message.error === 'session_not_found';
            const text = session_not_found
                ? 'Unter diesem Code gibt es keine gemeinsame Sitzung. Prüfe den Code.'
                : message.error === 'name_required' || message.error === 'invalid_name' || message.error === 'name_too_long'
                    ? 'Bitte gib einen gültigen Namen ein (höchstens 40 Zeichen).'
                    : 'Die gemeinsame Sitzung konnte nicht geöffnet werden.';
            if (session_not_found) {
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
    }

    handle_state_message(message) {
        const previous_participants = this.participants;
        const previous_revision = this.revision;
        const next_participants = message.participants ?? this.participants;
        const changed_resources = collaboration_changed_resources(previous_participants, next_participants);

        if ('source_tag' in message) this.source_tag = message.source_tag;
        this.revision = message.revision;
        this.participants = next_participants;
        this.lock_request_pending = false;

        if (this.force_full_snapshot) {
            const restore_resource = this.current_resource();
            this.force_full_snapshot = false;
            this.structure_resync_pending = false;
            this.apply_snapshot(message);
            this.capture_top_level_refs();
            this.restore_resource_selection(restore_resource);
            this.focused_resource = null;
            this.focus_current_resource(true);
        } else if (message.type === 'resync') {
            this.pending_resource_update = false;
            if (this.focused_resource && message.state) {
                this.apply_resource_from_state(message.state, this.focused_resource, true);
                this.set_resource_baseline(message.state, this.focused_resource);
            }
        } else if (message.revision > previous_revision) {
            if (changed_resources.length > 0) {
                for (const resource of changed_resources)
                    this.apply_resource_update(message.state, resource);
            } else {
                // Compatibility path for the foundation's whole-state replacement
                // and for future session-wide operations such as shared save.
                const restore_resource = this.current_resource();
                this.apply_snapshot(message);
                this.capture_top_level_refs();
                this.restore_resource_selection(restore_resource);
            }
        }

        this.handle_lock_transition(message.state, previous_participants);
        this.render_control();
        this.render_status();
        this.update_resource_access();
        if (message.type === 'resync' && this.save_after_sync)
            this.cancel_shared_save('Vor dem Speichern musste der gemeinsame Stand neu geladen werden. Prüfe deine Änderung und speichere noch einmal.');
        else
            this.continue_shared_save();
    }

    handle_lock_transition(state, previous_participants) {
        const resource = this.focused_resource;
        if (!resource) return;
        const old_holder = this.lock_holder(resource, previous_participants);
        const new_holder = this.lock_holder(resource, this.participants);
        const was_mine = old_holder?.id === this.participant_id;
        const is_mine = new_holder?.id === this.participant_id;

        if (!was_mine && is_mine) {
            this.pending_resource_update = false;
            this.apply_resource_from_state(state, resource, true);
            this.set_resource_baseline(state, resource);
        } else if (was_mine && !is_mine) {
            this.pending_resource_update = false;
            this.synced_resource_serialized = null;
            this.last_observed_resource_serialized = null;
        } else if (!is_mine && new_holder && state) {
            this.apply_resource_from_state(state, resource, true);
            this.set_resource_baseline(state, resource);
        }
    }

    apply_snapshot(message) {
        if (!message.state || !window.game) return;
        window.game.data = message.state;
        window.game._load();

        if (message.source_tag) {
            $('#game_code_div').show();
            $('#game_code').text(message.source_tag);
            $('#game_link')
                .attr('href', `https://2d.hackschule.de/play/${message.source_tag}`)
                .text(`https://2d.hackschule.de/play/${message.source_tag}`);
        }
    }

    apply_resource_update(state, resource) {
        const holder = this.lock_holder(resource, this.participants);
        const mine = holder?.id === this.participant_id;
        if (mine) {
            this.pending_resource_update = false;
            this.set_resource_baseline(state, resource, false);
            return;
        }
        this.apply_resource_from_state(state, resource, true);
        if (resource === this.focused_resource)
            this.set_resource_baseline(state, resource);
    }

    apply_resource_from_state(state, resource, refresh_ui) {
        if (!window.game?.data) return;
        const value = collaboration_resource_value(state, resource);
        if (value === null) return;
        const copied = JSON.parse(JSON.stringify(value));

        if (resource === 'settings') {
            window.game.data.properties = copied;
            if (refresh_ui)
                window.game.refresh_game_settings_controls?.();
            return;
        }

        const match = /^(sprite|level):(\d+)$/.exec(resource);
        if (!match) return;
        const index = Number(match[2]);
        if (match[1] === 'sprite') {
            if (!window.game.data.sprites?.[index]) return;

            // The sprite canvas stays attached even while another pane (for
            // example the level editor) is visible. Preserve that selection
            // before replacing the authoritative sprite data so returning to
            // the sprite pane never shows stale pixels or a detached canvas.
            const canvas = window.canvas;
            const was_attached = canvas?.sprite_index === index;
            const previous_state_index = was_attached ? canvas.state_index : 0;
            const previous_frame_index = was_attached ? canvas.frame_index : 0;
            if (was_attached) canvas.detachSprite();

            window.game.data.sprites[index] = copied;
            this.top_level_sprite_refs[index] = window.game.data.sprites[index];
            window.game.create_geometry_and_material_for_sprite(index);
            window.game.update_material_for_sprite(index);
            window.game.refresh_frames_on_screen();
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
                    canvas.attachSprite(index, state_index, frame_index, () => {
                        window.game.build_sprite_traits_menu?.();
                    });
                }
            }
        } else {
            if (!window.game.data.levels?.[index]) return;
            window.game.data.levels[index] = copied;
            this.top_level_level_refs[index] = window.game.data.levels[index];
            if (refresh_ui && this.current_resource() === resource) {
                const item = $('#menu_levels > ._dnd_item').eq(index).children().eq(0);
                item.trigger('click');
            }
        }
    }

    restore_resource_selection(resource) {
        if (!resource || typeof $ === 'undefined') return;
        if (resource.startsWith('sprite:') && current_pane === 'sprites') {
            const index = Number(resource.split(':')[1]);
            $('#menu_sprites > ._dnd_item').eq(index).children().eq(0).trigger('click');
        } else if (resource.startsWith('level:') && current_pane === 'level') {
            const index = Number(resource.split(':')[1]);
            $('#menu_levels > ._dnd_item').eq(index).children().eq(0).trigger('click');
        }
    }

    start_heartbeat() {
        this.stop_heartbeat();
        this.heartbeat_interval = setInterval(() => {
            if (this.socket?.readyState === WebSocket.OPEN)
                this.socket.send(JSON.stringify({ type: 'heartbeat' }));
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
            this.detect_unsupported_structure_change();
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

    current_resource() {
        if (!window.game?.data || typeof current_pane === 'undefined') return null;
        if (current_pane === 'sprites' && window.canvas?.sprite_index !== null)
            return `sprite:${window.canvas.sprite_index}`;
        if (current_pane === 'level' && window.game.level_editor?.level_index !== null)
            return `level:${window.game.level_editor.level_index}`;
        if (current_pane === 'settings') return 'settings';
        return null;
    }

    focus_current_resource(force = false) {
        if (!this.connected) return;
        const resource = this.current_resource();
        if (!force && resource === this.focused_resource) {
            this.ensure_current_resource_lock();
            return;
        }

        const old_resource = this.focused_resource;
        if (old_resource && this.owns_lock(old_resource))
            this.send_command({ type: 'unlock', resource: old_resource });

        this.focused_resource = resource;
        this.lock_request_pending = false;
        this.pending_resource_update = false;
        this.synced_resource_serialized = null;
        this.last_observed_resource_serialized = null;
        this.resource_changed_at = 0;

        if (resource) this.request_lock(resource);
        this.update_resource_access();
    }

    ensure_current_resource_lock() {
        const resource = this.focused_resource;
        if (!this.connected || !resource || this.lock_request_pending) return;
        const holder = this.lock_holder(resource);
        if (!holder) this.request_lock(resource);
    }

    request_lock(resource) {
        if (!this.connected || !resource || this.lock_request_pending) return;
        this.lock_request_pending = true;
        this.send_command({ type: 'lock', resource });
        this.update_resource_access();
    }

    send_command(command) {
        if (this.socket?.readyState !== WebSocket.OPEN) return false;
        this.socket.send(JSON.stringify({
            type: 'replace_state',
            base_revision: this.revision,
            state: { [COLLABORATION_COMMAND_KEY]: command },
        }));
        return true;
    }

    lock_holder(resource, participants = this.participants) {
        return (participants ?? []).find(participant => participant.lock?.resource === resource) ?? null;
    }

    owns_lock(resource) {
        return this.lock_holder(resource)?.id === this.participant_id;
    }

    current_resource_revision(resource) {
        const holder = this.lock_holder(resource);
        return holder && Number.isInteger(holder.lock?.revision) ? holder.lock.revision : 0;
    }

    serialize_local_resource(resource) {
        const value = collaboration_resource_value(window.game?.data, resource);
        return value === null ? null : JSON.stringify(value);
    }

    set_resource_baseline(state, resource, reset_observed = true) {
        const value = collaboration_resource_value(state, resource);
        if (value === null) return;
        this.synced_resource_serialized = JSON.stringify(value);
        if (reset_observed) {
            this.last_observed_resource_serialized = this.serialize_local_resource(resource);
            this.resource_changed_at = performance.now();
        }
    }

    sync_current_resource() {
        const resource = this.focused_resource;
        if (!this.connected || !resource || !this.owns_lock(resource) || this.pending_resource_update)
            return;
        if (this.structure_resync_pending) return;

        const serialized = this.serialize_local_resource(resource);
        if (serialized === null) return;
        const now = performance.now();
        if (serialized !== this.last_observed_resource_serialized) {
            this.last_observed_resource_serialized = serialized;
            this.resource_changed_at = now;
            return;
        }
        if (serialized === this.synced_resource_serialized || now - this.resource_changed_at < 300)
            return;

        this.pending_resource_update = true;
        const sent = this.send_command({
            type: 'replace_resource',
            resource,
            resource_revision: this.current_resource_revision(resource),
            value: JSON.parse(serialized),
        });
        if (!sent) this.pending_resource_update = false;
    }

    capture_top_level_refs() {
        if (!window.game?.data) return;
        this.top_level_sprite_refs = [...(window.game.data.sprites ?? [])];
        this.top_level_level_refs = [...(window.game.data.levels ?? [])];
    }

    top_level_structure_changed() {
        if (!window.game?.data) return false;
        const sprites = window.game.data.sprites ?? [];
        const levels = window.game.data.levels ?? [];
        if (sprites.length !== this.top_level_sprite_refs.length || levels.length !== this.top_level_level_refs.length)
            return true;
        for (let i = 0; i < sprites.length; i++)
            if (sprites[i] !== this.top_level_sprite_refs[i]) return true;
        for (let i = 0; i < levels.length; i++)
            if (levels[i] !== this.top_level_level_refs[i]) return true;
        return false;
    }

    detect_unsupported_structure_change() {
        if (!this.connected || this.structure_resync_pending || !this.top_level_structure_changed()) return;
        this.structure_resync_pending = true;
        this.force_full_snapshot = true;
        this.show_temporary_notice('Sprites und Level können in der gemeinsamen Sitzung noch nicht hinzugefügt, gelöscht oder umsortiert werden.', 4500);
        if (this.socket?.readyState === WebSocket.OPEN)
            this.socket.send(JSON.stringify({ type: 'request_snapshot' }));
    }

    install_structure_guards() {
        document.addEventListener('mousedown', (event) => {
            if (!this.code) return;
            const item = event.target.closest?.('#menu_sprites > ._dnd_item:not(.add), #menu_levels > ._dnd_item:not(.add)');
            if (item) event.stopPropagation();
        }, true);
        document.addEventListener('click', (event) => {
            if (!this.code) return;
            const add = event.target.closest?.('#menu_sprites > ._dnd_item.add, #menu_levels > ._dnd_item.add');
            if (!add) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.show_temporary_notice('Sprites und Level können in der gemeinsamen Sitzung noch nicht hinzugefügt, gelöscht oder umsortiert werden.', 4500);
        }, true);
    }

    install_save_guard() {
        if (!window.game || this.original_game_save) return;
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
        if (this.structure_resync_pending) {
            this.show_temporary_notice('Warte kurz, bis der gemeinsame Stand wieder vollständig synchronisiert ist.', 4000);
            return;
        }

        this.save_after_sync = true;
        this.continue_shared_save();
    }

    continue_shared_save() {
        if (!this.save_after_sync || this.save_pending || this.pending_resource_update) return;

        const resource = this.focused_resource;
        if (resource && this.owns_lock(resource)) {
            const serialized = this.serialize_local_resource(resource);
            if (serialized !== null && serialized !== this.synced_resource_serialized) {
                this.pending_resource_update = true;
                const sent = this.send_command({
                    type: 'replace_resource',
                    resource,
                    resource_revision: this.current_resource_revision(resource),
                    value: JSON.parse(serialized),
                });
                if (!sent) {
                    this.pending_resource_update = false;
                    this.cancel_shared_save('Die letzte Änderung konnte vor dem Speichern nicht synchronisiert werden.');
                }
                return;
            }
        }

        this.save_after_sync = false;
        this.save_pending = true;
        if (window.game) window.game.currently_saving = true;
        try {
            this.socket.send(JSON.stringify({ type: 'save' }));
        } catch (_error) {
            this.cancel_shared_save('Das gemeinsame Spiel konnte nicht gespeichert werden.');
        }
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
        this.source_tag = message.tag;
        if (Number.isInteger(message.revision)) this.revision = message.revision;
        if (Array.isArray(message.participants)) this.participants = message.participants;
        if (window.game?.data) window.game.data.parent = message.tag;

        $('#game_code_div').show();
        $('#game_code').text(message.tag);
        $('#game_link')
            .attr('href', `https://2d.hackschule.de/play/${message.tag}`)
            .text(`https://2d.hackschule.de/play/${message.tag}`);

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
            window.collaborationStartModal.show();
        }
    }

    copy_code(modal) {
        if (!this.code) return;
        navigator.clipboard.writeText(this.code).then(() => {
            $('#collaboration_copy_status').text('Code kopiert.');
        }).catch(() => {
            modal.showError(`Sitzungscode: ${this.code}`);
        });
    }

    leave() {
        this.intentional_close = true;
        this.stop_heartbeat();
        if (this.reconnect_timeout !== null) {
            clearTimeout(this.reconnect_timeout);
            this.reconnect_timeout = null;
        }
        if (this.socket) this.socket.close(1000, 'left_session');
        this.socket = null;
        this.connected = false;
        this.participants = [];
        this.focused_resource = null;
        this.pending_resource_update = false;
        this.lock_request_pending = false;
        this.save_after_sync = false;
        this.save_pending = false;
        if (window.game) window.game.currently_saving = false;
        if (this.code) {
            sessionStorage.removeItem(this.participant_storage_key(this.code));
            sessionStorage.removeItem(this.name_storage_key(this.code));
        }
        this.code = null;
        this.name = null;
        this.participant_id = null;
        const url = new URL(window.location.href);
        url.search = this.source_tag ? `?${this.source_tag}` : '';
        this.source_tag = null;
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
        this.render_control();
        this.update_resource_access();
        window.collaborationStatusModal?.dismiss();
    }

    set_code_in_url(code) {
        code = normalize_collaboration_code(code);
        if (!code) return;
        const url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('collab', code);
        history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    }

    append_status_control(status_bar = $('#status-bar')) {
        if (typeof $ === 'undefined' || !status_bar?.length) return;
        let control = status_bar.find('#collaboration-control');
        if (!control.length) {
            control = $('<div id="collaboration-control">')
                .addClass('status-bar-item status-bar-button collaboration-status-button')
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
            control.attr('title', `Gemeinsame Sitzung ${this.code} anzeigen`);
            control.append($('<span>').addClass('collaboration-status-dot'));
            const label = this.connected
                ? `Gemeinsam · ${this.code} · ${this.participants.length}`
                : `Gemeinsam · ${this.code} …`;
            control.append($('<span>').text(label));
            status_bar.prepend(control);
        } else {
            control.attr('title', 'Gemeinsame Sitzung starten oder beitreten');
            control.text('Zusammenarbeiten');
            status_bar.append(control);
        }
    }

    render_control() {
        this.append_status_control();
    }

    render_status() {
        if (typeof $ === 'undefined') return;
        $('#collaboration_session_code').text(this.code ?? '—');
        const list = $('#collaboration_participants').empty();
        for (const participant of this.participants) {
            const item = $('<li>').text(participant.name);
            if (participant.id === this.participant_id) item.append(' (du)');
            if (participant.lock?.resource)
                item.append(` — ${collaboration_resource_description(participant.lock.resource)}`);
            list.append(item);
        }
        $('#collaboration_connection_status').text(
            collaboration_connection_status(this.connected, this.has_connected_once)
        );
    }

    ensure_notice() {
        if (typeof $ === 'undefined') return $();
        let notice = $('#collaboration-resource-notice');
        if (!notice.length) {
            notice = $('<div id="collaboration-resource-notice">').css({
                position: 'fixed',
                left: '50%',
                bottom: '42px',
                transform: 'translateX(-50%)',
                'z-index': 850,
                'max-width': 'min(720px, 90vw)',
                padding: '0.45em 0.8em',
                'border-radius': '5px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(15,15,18,0.92)',
                color: '#ddd',
                'box-shadow': '0 2px 12px rgba(0,0,0,0.55)',
                'font-size': '14px',
                'pointer-events': 'none',
            }).hide().appendTo('body');
        }
        return notice;
    }

    show_temporary_notice(text, duration = 3500) {
        this.notice_override = text;
        this.notice_override_until = Date.now() + duration;
        this.ensure_notice().text(text).show();
    }

    set_controls_readonly(resource, readonly) {
        if (typeof $ === 'undefined') return;
        const all = [
            '#tool_menu', '#color_menu', '#color_variations_menu', '#functions_dropdown', '#canvas', '#undo_stack',
            '#menu_frames', '#states_container', '#menu_sprite_properties',
            '#tool_menu_level', '#tool_menu_level_settings', '#menu_level_sprites', '#level', '#menu_layers',
            '#menu_level_properties', '#menu_layer_properties', '#menu_placed_properties',
            '#game-settings-here',
        ].join(', ');
        $(all).css({ 'pointer-events': '', opacity: '' });
        if (!readonly || !resource) return;

        let selectors = '';
        if (resource.startsWith('sprite:')) {
            selectors = '#tool_menu, #color_menu, #color_variations_menu, #functions_dropdown, #canvas, #undo_stack, #menu_frames, #states_container, #menu_sprite_properties';
        } else if (resource.startsWith('level:')) {
            selectors = '#tool_menu_level, #tool_menu_level_settings, #menu_level_sprites, #level, #menu_layers, #menu_level_properties, #menu_layer_properties, #menu_placed_properties';
        } else if (resource === 'settings') {
            selectors = '#game-settings-here';
        }
        $(selectors).css({ 'pointer-events': 'none', opacity: 0.55 });
    }

    update_resource_access() {
        if (typeof $ === 'undefined') return;
        const resource = this.current_resource();
        const notice = this.ensure_notice();

        if (this.notice_override && Date.now() < this.notice_override_until) {
            notice.text(this.notice_override).show();
        } else {
            this.notice_override = null;
            if (!this.code || !resource) {
                notice.hide();
            } else if (!this.connected) {
                notice.text('Die Verbindung zur gemeinsamen Sitzung ist unterbrochen. Bearbeiten ist vorübergehend gesperrt.').show();
            } else {
                const holder = this.lock_holder(resource);
                if (holder && holder.id !== this.participant_id)
                    notice.text(`${holder.name} bearbeitet gerade ${collaboration_resource_description(resource)}.`).show();
                else if (!holder)
                    notice.text('Bearbeitung wird vorbereitet …').show();
                else
                    notice.hide();
            }
        }

        if (!this.code || !resource) {
            this.set_controls_readonly(resource, false);
            return;
        }
        const can_edit = this.connected && this.owns_lock(resource) && !this.structure_resync_pending;
        this.set_controls_readonly(resource, !can_edit);
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

    window.collaborationStartModal = new ModalDialog({
        title: 'Zusammenarbeiten',
        width: '420px',
        max_width: '90vw',
        body: `
            <p>Starte eine neue gemeinsame Sitzung oder tritt mit einem Sitzungscode bei.</p>
            <p><label>Dein Name<br><input id="collaboration_start_name" maxlength="40" autocomplete="name"></label></p>
            <p>
                <label>Sitzungscode<br>
                    <input id="collaboration_start_code" class="collaboration-code-input"
                           maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false">
                </label><br>
                <small>Nur nötig, wenn du einer bestehenden Sitzung beitreten möchtest.</small>
            </p>
        `,
        onshow: () => {
            $('#collaboration_start_code')
                .off('input.collaboration')
                .on('input.collaboration', function () {
                    this.value = format_collaboration_code_input(this.value);
                });
            $('#collaboration_start_name').trigger('focus');
        },
        footer: [
            {
                type: 'button',
                label: 'Abbrechen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Mit Code beitreten',
                icon: 'fa-sign-in',
                callback: (self) => {
                    window.collaboration.join(
                        $('#collaboration_start_code').val(),
                        $('#collaboration_start_name').val(),
                        self,
                    );
                },
            },
            {
                type: 'button',
                label: 'Neue Sitzung',
                icon: 'fa-users',
                color: 'green',
                callback: (self) => {
                    window.collaboration.start($('#collaboration_start_name').val(), self);
                },
            },
        ],
    });

    window.collaborationJoinModal = new ModalDialog({
        title: 'Gemeinsame Sitzung',
        width: '420px',
        max_width: '90vw',
        body: `
            <p>Du trittst der gemeinsamen Sitzung <strong id="collaboration_join_code"></strong> bei.</p>
            <p><label>Dein Name<br><input id="collaboration_join_name" maxlength="40" autocomplete="name"></label></p>
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
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
            {
                type: 'button',
                label: 'Beitreten',
                icon: 'fa-users',
                color: 'green',
                callback: (self) => {
                    const code = collaboration_code_from_url(window.location.href);
                    window.collaboration.join(code, $('#collaboration_join_name').val(), self);
                },
            },
        ],
    });

    window.collaborationStatusModal = new ModalDialog({
        title: 'Gemeinsam bearbeiten',
        width: '520px',
        max_width: '90vw',
        body: `
            <p id="collaboration_connection_status"></p>
            <p>Sitzungscode:</p>
            <div id="collaboration_session_code" class="collaboration-session-code"></div>
            <p>Andere wählen <strong>Zusammenarbeiten</strong> und geben diesen Code ein.</p>
            <p id="collaboration_copy_status"></p>
            <h4>Gerade dabei</h4>
            <ul id="collaboration_participants"></ul>
            <p><small>Die Namen gelten nur für diese gemeinsame Sitzung. Sie sind keine Konten.</small></p>
        `,
        onshow: () => window.collaboration.render_status(),
        footer: [
            {
                type: 'button',
                label: 'Code kopieren',
                icon: 'fa-copy',
                callback: (self) => window.collaboration.copy_code(self),
            },
            {
                type: 'button',
                label: 'Sitzung verlassen',
                icon: 'fa-sign-out',
                callback: () => window.collaboration.leave(),
            },
            {
                type: 'button',
                label: 'Schließen',
                icon: 'fa-times',
                callback: (self) => self.dismiss(),
            },
        ],
    });

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
        if (window.DEVELOPMENT) setup_collaboration_ui();
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
        collaboration_resource_value,
        collaboration_lock_revisions,
        collaboration_changed_resources,
        collaboration_resource_description,
        collaboration_saved_notice,
        collaboration_save_error_message,
        CollaborationClient,
    };
}

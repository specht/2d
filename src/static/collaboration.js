function normalize_collaboration_name(value) {
    const raw = String(value ?? '');
    if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name || [...name].length > 40) return null;
    return name;
}

function collaboration_code_from_url(url) {
    return new URL(url).searchParams.get('collab');
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
        this.error_modal = null;
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
        modal.dismiss();
        this.connect(code, name, modal);
    }

    connect(code, name, error_modal = null) {
        this.intentional_close = false;
        this.code = code;
        this.name = name;
        this.error_modal = error_modal;
        this.participant_id = sessionStorage.getItem(this.participant_storage_key(code));
        this.render_control();

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
            this.stop_heartbeat();
            this.render_control();
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
            this.start_heartbeat();
            this.render_control();
            this.render_status();
            if (this.show_status_after_welcome) {
                this.show_status_after_welcome = false;
                window.collaborationStatusModal?.show();
            }
            return;
        }

        if (message.type === 'presence') {
            this.participants = message.participants ?? [];
            this.revision = message.revision ?? this.revision;
            this.render_control();
            this.render_status();
            return;
        }

        if (message.type === 'state' || message.type === 'resync') {
            if ('source_tag' in message) this.source_tag = message.source_tag;
            this.revision = message.revision;
            this.participants = message.participants ?? this.participants;
            this.apply_snapshot(message);
            this.render_control();
            this.render_status();
            return;
        }

        if (message.type === 'error') {
            this.intentional_close = true;
            const text = message.error === 'session_not_found'
                ? 'Diese gemeinsame Sitzung gibt es nicht mehr.'
                : message.error === 'name_required' || message.error === 'invalid_name' || message.error === 'name_too_long'
                    ? 'Bitte gib einen gültigen Namen ein (höchstens 40 Zeichen).'
                    : 'Die gemeinsame Sitzung konnte nicht geöffnet werden.';
            if (this.error_modal) {
                this.error_modal.show();
                this.error_modal.showError(text);
            } else {
                window.collaborationJoinModal?.show();
                window.collaborationJoinModal?.showError(text);
            }
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

    schedule_reconnect() {
        if (!this.code || !this.name || this.reconnect_timeout !== null) return;
        this.reconnect_timeout = setTimeout(() => {
            this.reconnect_timeout = null;
            this.connect(this.code, this.name, this.error_modal);
        }, this.reconnect_delay);
        this.reconnect_delay = Math.min(this.reconnect_delay * 2, 10_000);
    }

    show() {
        if (this.code) {
            window.collaborationStatusModal.show();
        } else {
            window.collaborationStartModal.show();
        }
    }

    share_url() {
        if (!this.code) return '';
        const url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('collab', this.code);
        return url.toString();
    }

    copy_link(modal) {
        const url = this.share_url();
        if (!url) return;
        navigator.clipboard.writeText(url).then(() => {
            $('#collaboration_copy_status').text('Link kopiert.');
        }).catch(() => {
            const input = $('#collaboration_link');
            input.trigger('focus').trigger('select');
            modal.showError('Bitte kopiere den markierten Link.');
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
        window.collaborationStatusModal?.dismiss();
    }

    set_code_in_url(code) {
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
                .attr('title', 'Gemeinsame Sitzung starten oder anzeigen')
                .on('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.show();
                });
            status_bar.append(control);
        }
        control.toggleClass('connected', this.connected);
        control.toggleClass('disconnected', !!this.code && !this.connected);
        let label = 'Zusammenarbeiten';
        if (this.connected) label += ` (${this.participants.length})`;
        else if (this.code) label += ' …';
        control.text(label);
    }

    render_control() {
        this.append_status_control();
    }

    render_status() {
        if (typeof $ === 'undefined') return;
        $('#collaboration_link').val(this.share_url());
        const list = $('#collaboration_participants').empty();
        for (const participant of this.participants) {
            const item = $('<li>').text(participant.name);
            if (participant.id === this.participant_id) item.append(' (du)');
            list.append(item);
        }
        $('#collaboration_connection_status').text(
            collaboration_connection_status(this.connected, this.has_connected_once)
        );
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

    window.collaborationStartModal = new ModalDialog({
        title: 'Gemeinsam bearbeiten',
        width: '420px',
        max_width: '90vw',
        body: `
            <p>Starte eine gemeinsame Sitzung und teile anschließend den Link.</p>
            <p><label>Dein Name<br><input id="collaboration_start_name" maxlength="40" autocomplete="name"></label></p>
        `,
        onshow: () => {
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
                label: 'Sitzung starten',
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
            <p>Gib deinen Namen ein, bevor du gemeinsam mit den anderen arbeitest.</p>
            <p><label>Dein Name<br><input id="collaboration_join_name" maxlength="40" autocomplete="name"></label></p>
        `,
        onshow: () => {
            const code = collaboration_code_from_url(window.location.href);
            const remembered = code ? sessionStorage.getItem(window.collaboration.name_storage_key(code)) : '';
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
            <p>Teile diesen Link mit den anderen:</p>
            <p><input id="collaboration_link" readonly style="width: 100%; box-sizing: border-box;"></p>
            <p id="collaboration_copy_status"></p>
            <h4>Gerade dabei</h4>
            <ul id="collaboration_participants"></ul>
            <p><small>Die Namen gelten nur für diese gemeinsame Sitzung. Sie sind keine Konten.</small></p>
        `,
        onshow: () => window.collaboration.render_status(),
        footer: [
            {
                type: 'button',
                label: 'Link kopieren',
                icon: 'fa-copy',
                callback: (self) => window.collaboration.copy_link(self),
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

    const code = collaboration_code_from_url(window.location.href);
    if (code) {
        wait_for_collaboration_game(() => {
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
        collaboration_code_from_url,
        collaboration_websocket_url,
        collaboration_connection_status,
    };
}

// Playtesting in the classroom – the studio's side (the server's side and
// the rules: src/ruby/playtesting.rb; switched on and off in the terminal
// with playtest.rb).
//
// While the teacher has it switched on, the "Playtesting" tab appears. In it
// a child can
//   - submit their own game (it needs a title and an author; it is saved
//     first, and every later save is what gets tested from then on), and see
//     how often it has been tested and how much fun the testers had;
//   - wait: first everybody submits, then the teacher starts the testing
//     (moderation page, playtest.rb start) – only who has a game in the round
//     (alone or as a team) tests; the tab shows how many games are in and
//     looks again every few seconds;
//   - test the games of the others: the server hands out the next game (the
//     one tested least so far – nobody chooses), it runs for a few minutes
//     (after half the time "Fertig" goes to the survey early), then a short
//     survey: how much fun, how it looks, the controls, how hard, whether it
//     was clear what to do, how far one got, bugs – and two sentences: what
//     was really good, what could be better. The tester's first name goes
//     with it (it is printed for the author).
//
// A browser is known by a random id it keeps (no accounts): it is what
// keeps a child from getting their own game, or one game twice.

const PLAYTEST_FACES = ['😖', '🙁', '😐', '🙂', '😄'];

function playtest_random_id() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => (b % 36).toString(36)).join('');
}

// mm:ss
function playtest_clock(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// The survey is complete enough to send: every scale and choice answered,
// the required texts written (at least a few words) – or the game would not run.
function playtest_missing(questions, answers) {
    if (answers.broken) return [];
    return questions.filter(q => {
        const v = answers[q.id];
        if (q.type === 'text') return q.required && String(v ?? '').trim().length < 3;
        return v === undefined || v === null || v === '';
    }).map(q => q.id);
}

function playtest_stars(value) {
    if (value === null || value === undefined) return '';
    const full = Math.round(value);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
}

class Playtesting {
    constructor() {
        let id = null, name = '';
        try {
            id = localStorage.getItem('2d_browser');
            if (!id) { id = playtest_random_id(); localStorage.setItem('2d_browser', id); }
            name = localStorage.getItem('2d_tester_name') ?? '';
        } catch (e) { }
        this.browser = id ?? playtest_random_id();
        this.name = name;
        this.status = null;
        this.enabled = false;
        this.view = 'home';         // home | run | survey | thanks
        this.assignment = null;
        this.answers = {};
        this.timer = null;
    }

    // In a live session its code comes along: the server takes the team's
    // game from the session (playtesting.rb teams), and the game open here
    // tells whether it is submitted already – by anybody.
    api(path, data) {
        const extra = {};
        const session = window.collaboration?.code;
        if (session) extra.session = session;
        const open_tag = game?.data?.parent;
        if (typeof open_tag === 'string' && /^[a-z0-9]{7}$/.test(open_tag)) extra.open_tag = open_tag;
        return new Promise((resolve) => {
            api_call(`/api/playtest/${path}`, { browser: this.browser, ...extra, ...data }, (result) => resolve(result));
        });
    }

    // With the studio's ping (server_watch.js), every 30 seconds: this browser,
    // the names it knows, the live session – so the teacher's moderation page
    // lists every child, also one who has not opened this tab, and a child
    // who joins a team's session late becomes one of that team.
    ping_info() {
        const props = typeof game !== 'undefined' ? game?.data?.properties ?? {} : {};
        const playtest = { browser: this.browser,
            who: { tester: this.name, session: window.collaboration?.name ?? '', author: String(props.author ?? '') } };
        if (window.collaboration?.code) playtest.session = window.collaboration.code;
        return { playtest };
    }

    async refresh() {
        const status = await this.api('status', {});
        if (!status.success) return;
        const before = this.status_key;
        this.status = status;
        this.status_key = JSON.stringify([status.enabled, status.testing, status.has_game, status.games, status.tested,
            status.class_tests, (status.submissions ?? []).map(s => [s.id, s.tests, s.fun]), status.open_game?.id]);
        this.set_enabled(status.enabled, status.testing);
        if (status.running && !this.assignment) {
            // a test that was running before a reload goes on
            this.start(status.running);
            return;
        }
        // a running test or a half-filled survey is never redrawn underneath the child;
        // nor what somebody is typing in (it is drawn again at the next look)
        if (current_pane !== 'playtesting' || !(this.view === 'home' || this.view === 'thanks')) return;
        if (this.status_key === before && this.root().children().length) return;
        if (this.root().find('input:focus, textarea:focus').length) { this.status_key = null; return; }
        this.render();
    }

    // the server's ping says whether it is on and whether the testing runs (server_watch.js)
    set_enabled(enabled, testing = this.testing) {
        enabled = !!enabled;
        testing = !!testing;
        const changed = enabled !== this.enabled || testing !== this.testing;
        this.enabled = enabled;
        this.testing = testing;
        $('#mi_playtesting').toggle(enabled || this.view === 'run' || this.view === 'survey');
        if (changed && current_pane === 'playtesting') this.refresh();
    }

    show() {
        this.refresh();
        if (this.view === 'home' || this.view === 'thanks' || !this.root().children().length) this.render();
        // while the tab is shown: how many games are in, and when the testing starts
        this.poll ??= setInterval(() => {
            if (current_pane === 'playtesting' && this.enabled && (this.view === 'home' || this.view === 'thanks')) this.refresh();
        }, 5000);
    }

    root() {
        return $('#playtesting_here');
    }

    render() {
        const root = this.root().empty();
        // the game gets the whole width while it runs
        $('#main_div_playtesting').toggleClass('pt-wide', this.view === 'run');
        if (this.view === 'run') return this.render_run(root);
        if (this.view === 'survey') return this.render_survey(root);
        const status = this.status;
        $('<h2>').text('Playtesting').appendTo(root);
        if (!status) { $('<p class="pt-muted">').text('Einen Moment …').appendTo(root); return; }
        if (!status.enabled) {
            $('<p class="pt-muted">').text('Playtesting ist gerade ausgeschaltet. Deine Lehrkraft schaltet es ein, wenn es losgeht.').appendTo(root);
            return;
        }
        $('<p class="pt-class">').html(status.testing || status.class_tests
            ? `Eure Klasse hat schon <b>${status.class_tests}</b> ${status.class_tests === 1 ? 'Test' : 'Tests'} gemacht – <b>${status.games}</b> ${status.games === 1 ? 'Spiel ist' : 'Spiele sind'} dabei.`
            : `<b>${status.games}</b> ${status.games === 1 ? 'Spiel ist' : 'Spiele sind'} schon eingereicht.`).appendTo(root);
        if (this.view === 'thanks') this.render_thanks(root);
        if (!status.testing) {
            // first everybody submits; the testing starts when the teacher says so
            this.render_mine_card(root);
            this.render_waiting_card(root);
            return;
        }
        this.render_test_card(root);
        this.render_mine_card(root);
    }

    render_waiting_card(root) {
        const card = $('<section class="pt-card pt-test pt-waiting">').appendTo(root);
        $('<h3>').text(this.status.class_tests ? 'Das Testen ist beendet' : 'Gleich geht das Testen los').appendTo(card);
        $('<div class="pt-count">').append($('<b>').text(this.status.games), $('<span>').text(this.status.games === 1 ? ' Spiel eingereicht' : ' Spiele eingereicht')).appendTo(card);
        $('<p class="pt-note">').text(this.status.has_game
            ? (this.status.class_tests ? 'Danke fürs Testen! Deine Rückmeldungen sind angekommen.' : 'Dein Spiel ist dabei. Sobald deine Lehrkraft das Testen startet, geht es hier los – du musst nichts neu laden.')
            : 'Reiche zuerst dein Spiel ein – oder ihr euer Team-Spiel. Testen darf, wer selbst ein Spiel dabei hat.').appendTo(card);
    }

    // ------------------------------------------------ one's own game
    render_mine_card(root) {
        const card = $('<section class="pt-card pt-mine">').appendTo(root);
        $('<h3>').text('Dein Spiel').appendTo(card);
        const props = game?.data?.properties ?? {};
        const submissions = this.status.submissions ?? [];
        const parent = game?.data?.parent;
        const current = submissions.find(s => (s.tags ?? [s.tag]).includes(parent));
        for (const s of submissions) {
            const row = $('<div class="pt-submission">').appendTo(card);
            $('<div class="pt-submission-title">').text(s.team ? `»${s.title}« (euer Team-Spiel)` : `»${s.title}«`).appendTo(row);
            const tests = s.tests === 0 ? 'noch nicht getestet' : `${s.tests}× getestet`;
            $('<div class="pt-submission-stats">').text(s.fun ? `${tests} · Spaß ${playtest_stars(s.fun)}` : tests).appendTo(row);
        }
        if (current) {
            const yours = current.team
                ? `Euer Team-Spiel ist eingereicht (von ${current.author}). Keiner von euch bekommt es zum Testen.`
                : 'Das ist dein eingereichtes Spiel.';
            $('<p class="pt-note">').text(game.has_unsaved_changes?.()
                ? `${yours} Speichere, damit die Tester die neuesten Änderungen bekommen.`
                : `${yours} Jede Version, die gespeichert wird, wird ab jetzt getestet.`).appendTo(card);
            return;
        }
        // the game open here is somebody else's submission: once is enough
        const open = this.status.open_game;
        if (open) {
            $('<p class="pt-note">').text(`Dieses Spiel ist schon eingereicht – »${open.title}« von ${open.author}. Jedes Spiel wird nur einmal getestet. Arbeitet ihr zusammen daran? Dann seid ihr ein Team, sobald ihr in einer gemeinsamen Sitzung seid.`).appendTo(card);
            return;
        }
        $('<p class="pt-note">').text(submissions.length
            ? 'Das Spiel, das gerade im Studio offen ist, ist noch nicht eingereicht.'
            : 'Reiche dein Spiel ein, damit die anderen es testen. Danach wird jede Version, die du speicherst, getestet.').appendTo(card);
        const fields = $('<div class="pt-fields">').appendTo(card);
        const field = (label, key, placeholder) => {
            const box = $('<label class="pt-field">').appendTo(fields);
            $('<span>').text(label).appendTo(box);
            $('<input type="text" maxlength="60">').attr('placeholder', placeholder).val(props[key] ?? '').on('input', (e) => {
                game.data.properties[key] = e.target.value;
                game.refresh_game_settings_controls?.();
            }).appendTo(box);
        };
        field('Titel deines Spiels', 'title', 'zum Beispiel: Pips großes Abenteuer');
        field('Dein Name', 'author', 'dein Vorname');
        const message = $('<p class="pt-message">').appendTo(card);
        $('<button class="pt-button pt-primary">').text('Mein Spiel zum Testen einreichen').on('click', () => this.submit(message)).appendTo(card);
    }

    submit(message) {
        const props = game.data.properties;
        if (!String(props.title ?? '').trim() || !String(props.author ?? '').trim()) {
            message.text('Dein Spiel braucht einen Titel und deinen Namen.');
            return;
        }
        if (game.from_recipe) {
            message.text('Das ist eine Szene aus einem Rezept. Speichere sie zuerst als dein eigenes Spiel.');
            game.save();
            return;
        }
        message.text('Wird gespeichert …');
        // In a live session the team's game is the session's: it is saved for
        // everybody, and that version is submitted – so the others (also one
        // who joins later) are the team, and every shared save is tested.
        const save = (on_saved, on_failed) => window.collaboration?.code && window.collaboration.shared_save_then
            ? window.collaboration.shared_save_then(on_saved, on_failed)
            : game.send_save(on_saved, on_failed);
        save(async (tag) => {
            const result = await this.api('submit', { tag });
            if (!result.success || result.error) {
                message.text({
                    title_and_author_needed: 'Dein Spiel braucht einen Titel und deinen Namen.',
                    playtesting_off: 'Playtesting ist gerade ausgeschaltet.',
                }[result.error] ?? 'Das hat nicht geklappt. Versuch es gleich noch einmal.');
                return;
            }
            await this.refresh();
            this.notice(result.already
                ? `»${result.submission.title}« war schon eingereicht – von ${result.submission.author}. Ihr seid ein Team: es wird nur einmal getestet, und keiner von euch bekommt es zum Testen.`
                : `»${result.submission.title}« ist eingereicht – jetzt können die anderen es testen!`);
        }, () => message.text('Speichern hat nicht geklappt. Versuch es gleich noch einmal.'));
    }

    // ------------------------------------------------ testing the others
    render_test_card(root) {
        const card = $('<section class="pt-card pt-test">').appendTo(root);
        $('<h3>').text('Spiele der anderen testen').appendTo(card);
        $('<p class="pt-note">').text(`Du bekommst ein Spiel und spielst es ${this.status.minutes === 1 ? 'eine Minute' : `${this.status.minutes} Minuten`} lang. Danach erzählst du in einer kurzen Umfrage, wie es war – das hilft den anderen, ihr Spiel besser zu machen.`).appendTo(card);
        if (this.status.tested) $('<p class="pt-tested">').text(`Du hast schon ${this.status.tested} ${this.status.tested === 1 ? 'Spiel' : 'Spiele'} getestet.`).appendTo(card);
        if (!this.status.has_game) {
            $('<p class="pt-message">').text('Reiche zuerst dein Spiel ein (unten) – oder ihr euer Team-Spiel. Testen darf, wer selbst ein Spiel dabei hat.').appendTo(card);
            return;
        }
        const box = $('<label class="pt-field pt-name">').appendTo(card);
        $('<span>').text('Dein Vorname').appendTo(box);
        const input = $('<input type="text" maxlength="30" placeholder="so steht es bei deiner Rückmeldung">').val(this.name).appendTo(box);
        const message = $('<p class="pt-message">').appendTo(card);
        $('<button class="pt-button pt-primary pt-big">').html('Nächstes Spiel testen &nbsp;▶').on('click', async () => {
            const name = input.val().trim();
            if (!name) { message.text('Schreib zuerst deinen Vornamen hin.'); input.trigger('focus'); return; }
            this.name = name;
            try { localStorage.setItem('2d_tester_name', name); } catch (e) { }
            const result = await this.api('next', { name });
            if (!result.success) { message.text('Das hat nicht geklappt. Versuch es gleich noch einmal.'); return; }
            if (result.error) {
                message.text({
                    not_started: 'Das Testen hat noch nicht begonnen – deine Lehrkraft startet es.',
                    submit_first: 'Reiche zuerst dein Spiel ein – testen darf, wer selbst ein Spiel dabei hat.',
                    playtesting_off: 'Playtesting ist gerade ausgeschaltet.',
                }[result.error] ?? 'Das hat nicht geklappt. Versuch es gleich noch einmal.');
                this.refresh();
                return;
            }
            if (!result.assignment) {
                message.text('Gerade gibt es kein Spiel, das du noch nicht getestet hast. Schau gleich noch einmal – vielleicht kommen neue dazu!');
                return;
            }
            this.start(result.assignment);
        }).appendTo(card);
    }

    start(assignment) {
        this.assignment = assignment;
        this.answers = {};
        this.ends_at = Date.now() + assignment.seconds_left * 1000;
        this.view = assignment.seconds_left > 0 ? 'run' : 'survey';
        $('#mi_playtesting').show();
        if (current_pane !== 'playtesting') window.studio_show_pane?.('playtesting');
        else this.render();
    }

    render_run(root) {
        const a = this.assignment;
        const run = $('<div class="pt-run">').appendTo(root);
        const bar = $('<div class="pt-run-bar">').appendTo(run);
        $('<div class="pt-run-title">').append($('<b>').text(`»${a.title}«`), $('<span>').text(` von ${a.author}`)).appendTo(bar);
        const clock = $('<div class="pt-clock">').appendTo(bar);
        const progress = $('<div class="pt-progress">').append($('<div>')).appendTo(bar);
        const done = $('<button class="pt-button pt-primary">').text('Fertig – zur Umfrage').on('click', () => this.to_survey()).appendTo(bar);
        $('<button class="pt-button pt-quiet">').text('Spiel startet nicht?').attr('title', 'Wenn das Spiel gar nicht läuft: direkt zur Umfrage und das dort ankreuzen.').on('click', () => {
            this.answers.broken = true;
            this.to_survey();
        }).appendTo(bar);
        const frame = $('<iframe class="pt-frame" allow="fullscreen">').attr('src', `/standalone#${a.tag}`).appendTo(run);
        frame.on('load', () => { try { frame[0].focus(); frame[0].contentWindow.focus(); } catch (e) { } });
        $('<p class="pt-hint">').text('Klick ins Spiel, damit es deine Tasten bekommt.').appendTo(run);
        const tick = () => {
            const left = (this.ends_at - Date.now()) / 1000;
            const total = a.seconds_total || 1;
            clock.text(playtest_clock(left));
            progress.children().css('width', `${Math.max(0, Math.min(100, (1 - left / total) * 100))}%`);
            const early = left <= total / 2;
            done.prop('disabled', !early).attr('title', early ? '' : `Ab ${playtest_clock(total / 2)} Restzeit geht es zur Umfrage – spiel bis dahin weiter.`);
            if (left <= 0) this.to_survey();
        };
        clearInterval(this.timer);
        this.timer = setInterval(tick, 500);
        tick();
    }

    to_survey() {
        clearInterval(this.timer);
        this.timer = null;
        this.view = 'survey';
        this.render();
    }

    // ------------------------------------------------ the survey
    render_survey(root) {
        const a = this.assignment;
        const questions = this.status?.questions ?? [];
        const labels = this.status?.scale_labels ?? [];
        const form = $('<div class="pt-survey">').appendTo(root);
        $('<h2>').text(`Wie war »${a.title}«?`).appendTo(form);
        $('<p class="pt-note">').text(`${a.author} freut sich über ehrliche, freundliche Rückmeldungen. Deine Antworten stehen später mit deinem Namen (${this.name || '–'}) auf ihrem Zettel.`).appendTo(form);
        const broken = $('<label class="pt-broken">').appendTo(form);
        $('<input type="checkbox">').prop('checked', !!this.answers.broken).on('change', (e) => {
            this.answers.broken = e.target.checked;
            form.toggleClass('pt-is-broken', e.target.checked);
        }).appendTo(broken);
        $('<span>').text(' Das Spiel ließ sich gar nicht spielen').appendTo(broken);
        form.toggleClass('pt-is-broken', !!this.answers.broken);
        const sections = { scale: 'Bewerte das Spiel', choice: 'Kurz gefragt', text: 'In deinen Worten' };
        let section = null;
        for (const q of questions) {
            if (q.type !== section) {
                section = q.type;
                $('<h3 class="pt-section">').addClass(`pt-section-${q.type}`).text(sections[q.type] ?? '').appendTo(form);
            }
            const block = $('<div class="pt-question">').attr('data-q', q.id).addClass(`pt-${q.type}`).appendTo(form);
            const choose = (value, button) => {
                this.answers[q.id] = value;
                button.addClass('chosen').siblings().removeClass('chosen');
                block.removeClass('pt-missing');
            };
            if (q.type === 'scale') {
                // a category: its icon, what it means, five faces to click
                const about = $('<div class="pt-category">').appendTo(block);
                $('<span class="pt-category-icon">').text(q.icon ?? '').appendTo(about);
                $('<span class="pt-category-text">').append($('<b>').text(q.label), $('<span>').text(q.hint ?? '')).appendTo(about);
                const row = $('<div class="pt-scale">').appendTo(block);
                PLAYTEST_FACES.forEach((face, i) => {
                    const b = $('<button class="pt-face">').attr('title', labels[i] ?? '')
                        .append($('<span class="pt-face-icon">').text(face), $('<span class="pt-face-label">').text(labels[i] ?? ''))
                        .toggleClass('chosen', this.answers[q.id] === i + 1).appendTo(row);
                    b.on('click', () => choose(i + 1, b));
                });
                continue;
            }
            $('<div class="pt-question-label">').text(q.label).appendTo(block);
            if (q.type === 'choice') {
                const row = $('<div class="pt-choices">').appendTo(block);
                for (const [value, label] of q.options) {
                    const b = $('<button class="pt-choice">').text(label).toggleClass('chosen', this.answers[q.id] === value).appendTo(row);
                    b.on('click', () => choose(value, b));
                }
            } else {
                $('<textarea rows="2" maxlength="1200">').attr('placeholder', q.placeholder ?? '').val(this.answers[q.id] ?? '').on('input', (e) => {
                    this.answers[q.id] = e.target.value;
                    block.removeClass('pt-missing');
                }).appendTo(block);
            }
        }
        const message = $('<p class="pt-message">').appendTo(form);
        $('<button class="pt-button pt-primary pt-big">').text('Rückmeldung abschicken').on('click', async () => {
            const missing = playtest_missing(questions, this.answers);
            form.find('.pt-question').each((i, el) => $(el).toggleClass('pt-missing', missing.includes($(el).attr('data-q'))));
            if (missing.length) {
                message.text('Da fehlt noch etwas – die rot markierten Fragen.');
                form.find('.pt-missing')[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            const result = await this.api('feedback', { assignment: a.id, answers: this.answers });
            if (!result.success || result.error) {
                message.text(result.error === 'already_done' ? 'Diese Rückmeldung ist schon angekommen.' : 'Das hat nicht geklappt. Versuch es gleich noch einmal.');
                if (result.error !== 'already_done') return;
            } else {
                this.status = { ...this.status, ...result };
            }
            this.last = a;
            this.assignment = null;
            this.view = 'thanks';
            $('#mi_playtesting').toggle(this.enabled);
            this.render();
            this.root().scrollTop(0);
        }).appendTo(form);
    }

    render_thanks(root) {
        const box = $('<section class="pt-card pt-thanks">').appendTo(root);
        $('<div class="pt-thanks-big">').text('🎉').appendTo(box);
        $('<h3>').text(`Danke, ${this.name}!`).appendTo(box);
        $('<p>').text(`Deine Rückmeldung hilft ${this.last?.author ?? 'den anderen'}, das Spiel noch besser zu machen.`).appendTo(box);
    }

    notice(text) {
        window.studio_rescue?.notice?.(text);
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.playtesting = new Playtesting();
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.playtesting.refresh(), 500));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { playtest_clock, playtest_missing, playtest_stars, PLAYTEST_FACES };
}

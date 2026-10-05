// Plays the films of the Erste-Schritte guides in the Hilfe tab (made by
// rezepte/tools/film.mjs: frame 0 whole, every later frame only what changed,
// packed into a few WebP sheets). Unlike an animated picture a film can be
// paused and wound:
//   – it starts by itself shortly after it is in view, and stops when it leaves
//     (not with "weniger Bewegung" in the system settings: then a ▶ waits)
//   – a tap or click on it pauses and plays on (also Leertaste when it has the focus)
//   – the progress line under it is always there; under the mouse (or a
//     finger) it grows into a bar to wind the film
//   – the steps of the film stand beside it: the current one is lit, the
//     ones before are done, a click on one jumps there
//   – the keys pressed (Strg + Z …) are shown over the film, crisp at every size
// Only one film plays at a time.
(function () {
    const START_DELAY_MS = 450;     // in view this long, then it starts
    const VISIBLE_SHARE = 0.6;      // so much of it must be in view
    const reduce_motion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const players = new Set();

    function format_time(ms) {
        const s = Math.max(0, Math.round(ms / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }

    function key_html(keys, maus) {
        const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const parts = (keys ?? []).map(k => `<kbd>${esc(k)}</kbd>`);
        if (maus) parts.push(`<span class="film-maus">${esc(maus)}</span>`);
        return parts.join('<span class="film-plus">+</span>');
    }

    class FilmPlayer {
        constructor(figure) {
            this.figure = figure;
            this.url = figure.dataset.film;
            this.stage = figure.querySelector('.film-buehne');
            this.canvas = this.stage.querySelector('canvas');
            this.ctx = this.canvas.getContext('2d');
            // The film is put together at its real size on a canvas of its own;
            // the visible canvas gets it at the size it is shown, scaled down
            // smoothly (a 1600 px picture shrunk by the browser would flicker in
            // thin lines and small text). At its real size or larger: 1:1.
            this.full = document.createElement('canvas');
            this.full.width = this.canvas.width;
            this.full.height = this.canvas.height;
            this.full_ctx = this.full.getContext('2d');
            this.resized = new ResizeObserver(() => this.present());
            this.resized.observe(this.stage);
            this.steps = [...figure.querySelectorAll('.film-schritte li')];
            this.film = null;
            this.sheets = [];
            this.time = 0;
            this.drawn = -1;
            this.playing = false;
            this.user_paused = false;
            this.visible = false;
            this.build_ui();
            this.observer = new IntersectionObserver((entries) => this.seen(entries), { threshold: [0, 0.25, VISIBLE_SHARE, 1] });
            this.observer.observe(this.stage);
            this.near = new IntersectionObserver((entries) => {
                if (entries.some(e => e.isIntersecting)) { this.near.disconnect(); this.load(); }
            }, { rootMargin: '800px 0px' });
            this.near.observe(this.stage);
        }

        build_ui() {
            const el = (tag, cls, parent) => { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e; };
            this.stage.tabIndex = 0;
            this.stage.setAttribute('aria-label', 'Video: antippen zum Anhalten oder Weiterspielen');
            this.keys = el('div', 'film-tasten', this.stage);
            this.big = el('div', 'film-gross', this.stage);
            this.big.innerHTML = '<i class="fa fa-play"></i>';
            this.waiting = el('div', 'film-laedt', this.stage);
            this.waiting.innerHTML = '<i class="fa fa-circle-o-notch fa-spin"></i>';
            this.bar = el('div', 'film-leiste', this.stage);
            this.track = el('div', 'film-spur', this.bar);
            this.fill = el('div', 'film-fortschritt', this.track);
            this.knob = el('div', 'film-knopf', this.track);
            this.clock = el('div', 'film-zeit', this.bar);
            // a tap on the film: pause / play on (not on the bar)
            this.stage.addEventListener('click', (e) => {
                if (this.bar.contains(e.target) || !this.film) return;
                this.toggle();
            });
            this.stage.addEventListener('keydown', (e) => {
                if (!this.film) return;
                if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.toggle(); }
                if (e.key === 'ArrowRight') { e.preventDefault(); this.seek(this.time + 2000); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); this.seek(this.time - 2000); }
            });
            // the bar: press (or touch) and drag to wind
            this.bar.addEventListener('pointerdown', (e) => {
                if (!this.film) return;
                e.preventDefault();
                e.stopPropagation();
                this.bar.setPointerCapture?.(e.pointerId);
                this.bar.classList.add('aktiv');
                this.was_playing = this.playing;
                this.stop_loop();
                this.seek_to_pointer(e);
                const move = (ev) => this.seek_to_pointer(ev);
                const up = () => {
                    this.bar.removeEventListener('pointermove', move);
                    this.bar.removeEventListener('pointerup', up);
                    this.bar.removeEventListener('pointercancel', up);
                    this.bar.classList.remove('aktiv');
                    if (this.was_playing) this.play();
                };
                this.bar.addEventListener('pointermove', move);
                this.bar.addEventListener('pointerup', up);
                this.bar.addEventListener('pointercancel', up);
            });
            this.bar.addEventListener('click', (e) => e.stopPropagation());
            // a step beside the film: jump there and play
            this.steps.forEach((li) => li.addEventListener('click', () => {
                if (!this.film) return;
                this.user_paused = false;
                this.seek(Number(li.dataset.t) || 0);
                this.play();
            }));
            this.render_state();
        }

        async load() {
            try {
                const response = await fetch(this.url);
                if (!response.ok) throw new Error(response.statusText);
                const film = await response.json();
                this.sheets = await Promise.all(film.bilder.map(src => new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = src;
                })));
                this.film = film;
            } catch (e) {
                this.waiting.innerHTML = '<span>Das Video konnte nicht geladen werden.</span>';
                return;
            }
            this.waiting.remove();
            // marks for the steps on the bar
            for (const li of this.steps) {
                const tick = document.createElement('div');
                tick.className = 'film-marke';
                tick.style.left = `${100 * (Number(li.dataset.t) || 0) / this.film.dauer}%`;
                this.track.appendChild(tick);
            }
            this.show(0);
            if (this.visible) this.schedule_start();
            this.render_state();
        }

        // index of the frame shown at `time`
        frame_at(time) {
            const frames = this.film.frames;
            let lo = 0, hi = frames.length - 1;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                if (frames[mid].t <= time) lo = mid; else hi = mid - 1;
            }
            return lo;
        }

        show(time) {
            if (!this.film) return;
            this.time = Math.max(0, Math.min(time, this.film.dauer));
            const target = this.frame_at(this.time);
            // back in time: from the first frame again (it is the whole picture)
            if (target < this.drawn) this.drawn = -1;
            for (let i = this.drawn + 1; i <= target; i++) {
                for (const [s, sx, sy, w, h, dx, dy] of this.film.frames[i].p)
                    this.full_ctx.drawImage(this.sheets[s], sx, sy, w, h, dx, dy, w, h);
            }
            const changed = this.drawn !== target;
            this.drawn = target;
            if (changed) this.present();
            this.render_progress();
        }

        // the picture put together so far onto the visible canvas, at the size it is shown
        present() {
            if (this.drawn < 0) return;
            const shown = this.canvas.getBoundingClientRect().width * (window.devicePixelRatio || 1);
            const w = shown > 0 ? Math.min(this.full.width, Math.round(shown)) : this.full.width;
            const h = Math.max(1, Math.round(w * this.full.height / this.full.width));
            if (this.canvas.width !== w || this.canvas.height !== h) {
                this.canvas.width = w;
                this.canvas.height = h;
            }
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            this.ctx.drawImage(this.full, 0, 0, w, h);
        }

        // what goes with this moment: the bar, the step beside, the keys
        render_progress() {
            const share = this.film ? this.time / this.film.dauer : 0;
            this.fill.style.width = `${share * 100}%`;
            this.knob.style.left = `${share * 100}%`;
            this.clock.textContent = this.film ? `${format_time(this.time)} / ${format_time(this.film.dauer)}` : '';
            let current = -1;
            this.steps.forEach((li, i) => { if ((Number(li.dataset.t) || 0) <= this.time) current = i; });
            this.steps.forEach((li, i) => {
                li.classList.toggle('aktiv', i === current);
                li.classList.toggle('fertig', i < current);
            });
            const timeline = this.film?.zeitleiste ?? [];
            let entry = null;
            for (const e of timeline) { if (e.t <= this.time) entry = e; else break; }
            const html = entry ? key_html(entry.keys, entry.maus) : '';
            if (html !== this.keys_html) {
                this.keys_html = html;
                this.keys.innerHTML = html;
                this.keys.classList.toggle('zeigt', !!html);
            }
        }

        render_state() {
            this.stage.classList.toggle('spielt', this.playing);
            this.stage.classList.toggle('pausiert', !!this.film && !this.playing);
        }

        seek(time) {
            if (!this.film) return;
            this.show(time);
        }

        seek_to_pointer(e) {
            const r = this.track.getBoundingClientRect();
            const share = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            this.show(share * this.film.dauer);
        }

        play() {
            if (!this.film || this.playing) return;
            // one film at a time
            for (const other of players) if (other !== this) other.pause();
            if (this.time >= this.film.dauer) this.show(0);
            this.playing = true;
            this.last = performance.now();
            const tick = (now) => {
                if (!this.playing) return;
                const dt = Math.min(250, now - this.last);
                this.last = now;
                let t = this.time + dt;
                // from the start again at the end (the film already holds its last picture)
                if (t >= this.film.dauer) t = 0;
                this.show(t);
                this.raf = requestAnimationFrame(tick);
            };
            this.raf = requestAnimationFrame(tick);
            this.render_state();
        }

        stop_loop() {
            this.playing = false;
            cancelAnimationFrame(this.raf);
            this.render_state();
        }

        pause() {
            clearTimeout(this.start_timer);
            this.stop_loop();
        }

        toggle() {
            if (this.playing) { this.user_paused = true; this.pause(); }
            else { this.user_paused = false; this.play(); }
            this.stage.focus({ preventScroll: true });
        }

        schedule_start() {
            clearTimeout(this.start_timer);
            if (this.user_paused || reduce_motion() || !this.film) return;
            this.start_timer = setTimeout(() => { if (this.visible) this.play(); }, START_DELAY_MS);
        }

        seen(entries) {
            const ratio = entries.at(-1).intersectionRatio;
            const was = this.visible;
            this.visible = ratio >= VISIBLE_SHARE - 0.01;
            if (this.visible && !was) this.schedule_start();
            // out of view: it waits (and starts again when it comes back)
            if (ratio < 0.25 && this.playing) this.pause();
            if (!this.visible) clearTimeout(this.start_timer);
        }

        destroy() {
            this.pause();
            this.observer.disconnect();
            this.near.disconnect();
            this.resized.disconnect();
            players.delete(this);
        }
    }

    window.anleitung_films = {
        // every film in this element (a guide that was just opened)
        mount(root) {
            for (const figure of root.querySelectorAll('figure.anleitung-film[data-film]')) {
                if (figure._film) continue;
                figure._film = new FilmPlayer(figure);
                players.add(figure._film);
            }
        },
        // the guide is closed (or another opens): every film stops
        unmount_all() {
            for (const p of [...players]) p.destroy();
        },
        FilmPlayer,
    };
})();

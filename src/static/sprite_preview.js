// Vorschau im Sprite-Editor: the animation of the current state plays in a
// small box in the corner of the drawing area, at the state's Framerate –
// so a child sees the movement while drawing it, without starting the game.
//
// The box has play/pause, the Framerate (− and +, the same value as the
// state's "Framerate" field), and a mirror button: a figure drawn facing
// right walks left in the game mirrored, so both directions can be checked.
// P (next to O for Onion Skinning) or the status bar shows and hides it; off
// whenever the studio opens. It only reads the game; Framerate is the one
// thing it changes.

const SPRITE_PREVIEW_MAX = 128;   // the picture fits into this many pixels

// The largest whole scale (≥ 1) that fits, or a fraction for big sprites.
function sprite_preview_scale(width, height, max = SPRITE_PREVIEW_MAX) {
    if (!(width > 0) || !(height > 0)) return 1;
    const fit = Math.min(max / width, max / height);
    return fit >= 1 ? Math.floor(fit) : fit;
}

// Which frame is shown t seconds after the animation started.
function sprite_preview_frame(t, fps, count) {
    if (!(count > 0)) return 0;
    const f = Math.max(1, Number(fps) || 1);
    return Math.floor(Math.max(0, t) * f) % count;
}

function sprite_preview_fps(fps, delta) {
    return Math.max(1, Math.min(60, Math.round((Number(fps) || 8) + delta)));
}

class SpritePreview {
    constructor() {
        // off whenever the studio opens, like Onion Skinning
        this.shown = false;
        this.playing = true;
        this.mirrored = false;
        this.images = new Map();
        this.started = performance.now();
        this.last_frame = -1;
        this.raf = null;
        this.box = null;
    }

    current_state() {
        const c = window.canvas;
        const sprite = window.game?.data?.sprites?.[c?.sprite_index];
        const state = sprite?.states?.[c?.state_index];
        return sprite && state ? { sprite, state } : null;
    }

    set_shown(flag) {
        this.shown = !!flag;
        this.update();
        menus?.sprites?.refresh_toggles?.();
    }

    build() {
        if (this.box || typeof $ === 'undefined' || !$('#canvas').length) return;
        const box = $('<div class="sprite-preview">').appendTo('#canvas');
        this.picture = $('<canvas class="sprite-preview-picture">').attr('title', 'Klicken: anhalten / weiterspielen').appendTo(box);
        const row = $('<div class="sprite-preview-controls">').appendTo(box);
        this.play_button = $('<button class="sprite-preview-play">').on('click', () => this.toggle_play()).appendTo(row);
        $('<button title="langsamer">').text('−').on('click', () => this.change_fps(-1)).appendTo(row);
        this.fps_label = $('<span class="sprite-preview-fps">').attr('title', 'Framerate: Bilder pro Sekunde').appendTo(row);
        $('<button title="schneller">').text('+').on('click', () => this.change_fps(+1)).appendTo(row);
        this.mirror_button = $('<button class="sprite-preview-mirror" title="Gespiegelt: so sieht es aus, wenn die Figur nach links läuft">')
            .html('&#x21c4;').on('click', () => { this.mirrored = !this.mirrored; this.last_frame = -1; this.update(); }).appendTo(row);
        this.picture.on('click', () => this.toggle_play());
        // the drawing area must not paint or zoom through the box
        box.on('mousedown touchstart dblclick contextmenu wheel', (e) => e.stopPropagation());
        box.on('mousedown', (e) => e.preventDefault());
        this.box = box;
    }

    toggle_play() {
        this.playing = !this.playing;
        this.started = performance.now();
        this.last_frame = -1;
        this.update();
    }

    change_fps(delta) {
        const current = this.current_state();
        if (!current) return;
        current.state.properties.fps = sprite_preview_fps(current.state.properties.fps, delta);
        this.started = performance.now();
        // the "Framerate" field of the state shows the new value
        window.game?.build_state_traits_menu?.();
        this.update();
        document.dispatchEvent(new Event('change'));   // undo and the rescue copy see it
    }

    image(src) {
        if (!this.images.has(src)) {
            if (this.images.size > 128) this.images.clear();
            const image = new Image();
            image.onload = () => { this.last_frame = -1; };
            image.src = src;
            this.images.set(src, image);
        }
        return this.images.get(src);
    }

    update() {
        if (typeof $ === 'undefined') return;
        const visible = this.shown && typeof current_pane !== 'undefined' && current_pane === 'sprites' && !!this.current_state();
        if (!visible) {
            this.box?.hide();
            if (this.raf) { cancelAnimationFrame(this.raf); this.raf = null; }
            return;
        }
        this.build();
        this.box.show();
        const { state } = this.current_state();
        const n = state.frames.length;
        this.play_button.html(this.playing ? '&#x275a;&#x275a;' : '&#x25b6;').attr('title', this.playing ? 'Anhalten' : 'Abspielen')
            .prop('disabled', n < 2);
        this.fps_label.text(`${state.properties.fps ?? 8} fps`);
        this.mirror_button.toggleClass('active', this.mirrored);
        this.draw();
        if (!this.raf) this.raf = requestAnimationFrame(() => this.tick());
    }

    tick() {
        this.raf = null;
        if (!this.shown || current_pane !== 'sprites') { this.update(); return; }
        this.draw();
        this.raf = requestAnimationFrame(() => this.tick());
    }

    draw() {
        const current = this.current_state();
        if (!current || !this.picture) return;
        const { sprite, state } = current;
        const n = state.frames.length;
        if (!n) return;
        // stopped: the frame being drawn; playing: the animation
        const fi = this.playing && n > 1 ?
            sprite_preview_frame((performance.now() - this.started) / 1000, state.properties.fps, n) :
            Math.min(window.canvas?.frame_index ?? 0, n - 1);
        const src = state.frames[fi]?.src;
        const scale = sprite_preview_scale(sprite.width, sprite.height);
        const w = Math.max(1, Math.round(sprite.width * scale)), h = Math.max(1, Math.round(sprite.height * scale));
        const key = `${fi}|${src?.length}|${src?.slice(-24)}|${w}x${h}|${this.mirrored}`;
        if (key === this.last_frame) return;
        const image = src ? this.image(src) : null;
        if (!image?.complete) return;
        const el = this.picture[0];
        if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
        const ctx = el.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        if (this.mirrored) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        ctx.drawImage(image, 0, 0, w, h);
        ctx.restore();
        this.last_frame = key;
    }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.sprite_preview = new SpritePreview();
    // the pane, the sprite, the state or a frame changed: show it
    for (const type of ['mouseup', 'keyup', 'click'])
        document.addEventListener(type, () => setTimeout(() => window.sprite_preview.update(), 0), true);
    window.addEventListener('hashchange', () => window.sprite_preview.update());
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sprite_preview_scale, sprite_preview_frame, sprite_preview_fps, SPRITE_PREVIEW_MAX };
}

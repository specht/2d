const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 24;
const PEN_SHAPE_TOOLS = ['tool/pen', 'tool/line', 'tool/rect', 'tool/ellipse',
    'tool/fill-rect', 'tool/fill-ellipse', 'tool/picker', 'tool/spray', 'tool/fill', 'select-rect'];
const TWO_POINT_TOOLS = ['tool/line', 'tool/rect', 'tool/ellipse',
    'tool/fill-rect', 'tool/fill-ellipse', 'tool/gradient', 'tool/select-rect'];
const UNDO_TOOLS = ['tool/pen', 'tool/line', 'tool/rect', 'tool/ellipse', 'tool/move',
    'tool/fill-rect', 'tool/fill-ellipse', 'tool/spray', 'tool/fill', 'tool/gradient'];
const PERFORM_ON_MOUSE_DOWN_TOOLS = ['tool/pen', 'tool/picker', 'tool/spray', 'tool/fill', 'tool/gradient'];
const PERFORM_ON_MOUSE_MOVE_TOOLS = ['tool/pen', 'tool/picker', 'tool/move', 'tool/gradient'];
const MAX_UNDO_STACK_SIZE = 64;
const MAX_DIMENSION = 512;
// Zooming out stops where the whole sprite just fills the drawing area
// (fit_scale): "weiter weg, bis es nicht mehr geht" is always the best fit,
// never a small sprite in a big empty area. MAX_ZOOM limits zooming in;
// a sprite so small that it fits only beyond it may still fill the area.
const MAX_ZOOM = 64;
var last_spriteskip_timestamp = 0;
var last_stateskip_timestamp = 0;
var last_frameskip_timestamp = 0;
const SKIP_MIN_DELAY = 125;

// How many screen pixels make one CSS pixel (2 on most tablets and retina
// screens), at most max: the level editor's WebGL stays fast on a phone.
function screen_pixel_ratio(max = 2) {
    return Math.min(Math.max(window.devicePixelRatio || 1, 1), max);
}

// A canvas of lines over the zoomed sprite (grid, outlines) with as many pixels
// as the screen shows, drawn in CSS pixels: the lines stay thin and sharp on a
// tablet instead of being blown up by the browser.
function size_canvas_for_screen(canvas, width, height) {
    const ratio = screen_pixel_ratio(3);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // a new size resets the context: the scale is set again every time
    canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
}

function createDataUrlForImageSize(width, height) {
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    let context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
}

class Canvas {
    constructor(element, menu) {
        this.element = element;
        this.menu = menu;
        this.backdrop_color = document.createElement('canvas');
        this.backdrop = document.createElement('canvas');
        this.bitmap = document.createElement('canvas');
        this.overlay_bitmap = document.createElement('canvas');
        this.overlay_bitmap_outline = document.createElement('canvas');
        this.selection_bitmap = document.createElement('canvas');
        this.selection_bitmap_outline = document.createElement('canvas');
        this.stamp_bitmap = document.createElement('canvas');
        // read back on every pointer move (set_pixels, update_outline, the
        // stamp): only the first getContext of a canvas decides, so they ask for
        // it here, before anything else does – later calls cannot change it
        for (const bitmap of [this.bitmap, this.overlay_bitmap, this.selection_bitmap, this.stamp_bitmap])
            bitmap.getContext('2d', { willReadFrequently: true });
        this.overlay_grid = document.createElement('canvas');
        // Onion Skinning: the frame before (and after) shines through (update_onion_skin)
        this.onion_bitmap = document.createElement('canvas');
        // view aids start switched off whenever the studio opens (a forgotten
        // one would only confuse): Onion Skinning (O), Spiegelnd zeichnen (M)
        this.onion_skin = false;
        this.onion_images = new Map();
        this.onion_key = null;
        // Spiegelnd zeichnen (M): the pen and the shapes draw mirrored, too
        // (pixel_tools.js); the axis is shown over the drawing
        this.symmetric = false;
        this.mirror_axis_div = null;
        this.bitmap.width = DEFAULT_WIDTH;
        this.bitmap.height = DEFAULT_HEIGHT;
        this.overlay_bitmap.width = DEFAULT_WIDTH;
        this.overlay_bitmap.height = DEFAULT_HEIGHT;
        this.selection_bitmap.width = DEFAULT_WIDTH;
        this.selection_bitmap.height = DEFAULT_HEIGHT;
        this.stamp_bitmap.width = DEFAULT_WIDTH;
        this.stamp_bitmap.height = DEFAULT_HEIGHT;
        this.current_color = 0xff0000ff;
        this.pen_width = 1;
        this.last_touch_distance = null;
        this.last_mouse_x = null;
        this.last_mouse_y = null;
        this.mouse_in_canvas = false;
        this.show_pen = false;
        this.mouse_down = false;
        this.mouse_down_point = null;
        this.mouse_down_button = null;
        this.mouse_down_pixels = null;
        this.mouse_down_in_selection = false;
        this.modifier_ctrl = false;
        this.modifier_alt = false;
        this.modifier_shift = false;
        this.undo_stack = [];
        this.is_touch = false;
        this.is_double_touch = false;
        this.double_touch_points = null;
        this.periodic_ticker_handle = null;
        this.spray_pixels = null;
        this.spray_pixels_per_shot = 1;
        this.label_for_state = [];
        this.draw_ex = false;
        $(this.element).css('overflow', 'hidden');
        $(this.element).css('cursor', 'crosshair');
        $(this.backdrop_color).css('background-color', `#777`);
        $(this.backdrop_color).css('position', 'absolute');
        $(this.backdrop).css('background-image', `url(transparent.png)`);
        $(this.backdrop).css('background-attachment', 'fixed');
        $(this.backdrop).css('position', 'absolute');
        $(this.bitmap).css('position', 'absolute');
        $(this.bitmap).css('image-rendering', 'pixelated');
        $(this.onion_bitmap).css({ position: 'absolute', 'image-rendering': 'pixelated', 'pointer-events': 'none' }).hide();
        $(this.overlay_bitmap).css('position', 'absolute');
        $(this.overlay_bitmap).css('image-rendering', 'pixelated');
        $(this.overlay_bitmap).css('opacity', 0.9);
        $(this.overlay_bitmap_outline).css('position', 'absolute');
        $(this.selection_bitmap).css('position', 'absolute');
        $(this.selection_bitmap).css('image-rendering', 'pixelated');
        $(this.selection_bitmap).css('opacity', 0.9);
        $(this.selection_bitmap_outline).css('position', 'absolute');
        $(this.overlay_grid).css('position', 'absolute');
        this.element.append(this.backdrop_color);
        this.element.append(this.backdrop);
        this.element.append(this.onion_bitmap);
        this.element.append(this.bitmap);
        this.element.append(this.selection_bitmap);
        this.element.append(this.overlay_bitmap);
        this.element.append(this.overlay_grid);
        this.element.append(this.selection_bitmap_outline);
        this.element.append(this.overlay_bitmap_outline);

        this.offset_x = 0;
        this.offset_y = 0;
        this.size = 10;
        this.visible_pixels = DEFAULT_HEIGHT;
        this.scale = this.size / this.visible_pixels;
        this.scrollable_x = false;
        this.scrollable_y = false;
        this.handleResize();

        this.moving = false;
        this.moving_x = 0;
        this.moving_y = 0;

        let self = this;
        // the mouse wheel zooms with every tool (as in the level editor)
        this.element[0].addEventListener('wheel', function (e) {
            e.preventDefault();
            let cx = e.clientX - self.element.position().left;
            let cy = e.clientY - self.element.position().top;
            self.zoom_at_point(e.deltaY, cx, cy);
        }, { passive: false });
        // a picture of the Verlauf dropped onto the frames: a new frame after the one being drawn
        $('#menu_frames').on('dragover', (e) => {
            if (Array.from(e.originalEvent.dataTransfer?.types ?? []).includes('application/x-2d-frame')) {
                e.preventDefault();
                $('#menu_frames').addClass('drop-frame');
            }
        }).on('dragleave drop', () => $('#menu_frames').removeClass('drop-frame'))
            .on('drop', (e) => {
                const raw = e.originalEvent.dataTransfer?.getData('application/x-2d-frame');
                if (!raw) return;
                e.preventDefault();
                const entry = JSON.parse(raw);
                const sprite = self.game?.data?.sprites?.[self.sprite_index];
                if (!sprite) return;
                if (entry.width !== sprite.width || entry.height !== sprite.height) {
                    if (typeof show_state_notice === "function") show_state_notice(`Das Bild ist ${entry.width} × ${entry.height} groß, dieses Sprite ${sprite.width} × ${sprite.height}.`);
                    return;
                }
                const frames = sprite.states[self.state_index].frames;
                frames.splice(self.frame_index + 1, 0, { src: entry.url });
                if (typeof show_sprite_again === 'function') show_sprite_again(self.sprite_index, self.state_index, self.frame_index + 1);
            });
        // Leertaste + ziehen moves the view with every tool (the middle button, too)
        this.space_pan = false;
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Space' || current_pane !== 'sprites' || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
            if (self.menu?.get('tool') === 'tool/pan') return;
            self.space_pan = true;
            self.element.addClass('grab-panning');
            e.preventDefault();
        });
        window.addEventListener('keyup', (e) => {
            if (e.code !== 'Space') return;
            self.space_pan = false;
            if (!self.grab_panning) self.element.removeClass('grab-panning');
        });
        $(this.element).off();
        
        $(this.element).on('mouseenter', (e) => self.handle_enter(e));
        $(this.element).on('mouseleave', (e) => self.handle_leave(e));
        $(this.element).on('mousedown touchstart', (e) => self.handle_down(e));
        $(window).on('mouseup touchend', (e) => self.handle_up(e));
        $(window).on('mousemove touchmove', (e) => self.handle_move(e));
        this.game = null;
        this.sprite_index = null;
        this.state_index = null;
        this.frame_index = null;
        // right-click: always a menu (canvas_menu) – with every tool, so the
        // right button never paints by surprise. Durchsichtig is X (studio.js).
        this.element.on('contextmenu', function (e) {
            // a finger held still (widgets.js long press): what it painted goes away first
            self.cancel_touch_stroke();
            if (typeof show_context_menu === 'function')
                show_context_menu(e.clientX, e.clientY, self.canvas_menu(e));
            return false;
        });
        // Strg+C / X / V, Entf, Esc and the arrow keys work on the selection
        // (before the editor's own keys: the arrows would switch frames)
        window.addEventListener('keydown', (e) => self.handle_selection_key(e), true);
        // the pixel clipboard is for this studio: after the window was left
        // (perhaps to copy a picture elsewhere), Strg+V pastes that picture again
        window.addEventListener('blur', () => setTimeout(() => {
            if (document.activeElement?.tagName !== 'IFRAME') window.pixel_clipboard_from_here = false;
        }, 0));
    }

    get_touch_point(e) {
        if (e.clientX)
            return [e.clientX, e.clientY];
        else {
            if (e.touches) {
                this.is_touch = true;
                return [e.touches[0].clientX, e.touches[0].clientY];
            } else return [0, 0];
        }
    }

    zoom_at_point(delta, cx, cy) {
        let sx = (cx - this.offset_x) / this.scale;
        let sy = (cy - this.offset_y) / this.scale;
        this.visible_pixels *= (1 + delta * 0.001);
        this.fix_scale();
        this.offset_x = cx - sx * this.scale;
        this.offset_y = cy - sy * this.scale;
        this.handleResize();
    }

    handle_enter(e) {
        this.mouse_in_canvas = true;
        this.update_overlay_outline();
    }

    handle_leave(e) {
        this.mouse_in_canvas = false;
        if (this.menu) {
            // if (TWO_POINT_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
            // } else {
            //     this.mouse_down = false;
            // }
        } else {
            this.mouse_down = false;
        }
        this.update_overlay_outline();
    }

    handle_down(e) {
        this.last_touch_distance = null;
        // a finger: no mouse events after it (they would draw a second time)
        if (e.touches && e.cancelable !== false) e.preventDefault?.();
        if ((e.touches || []).length >= 2) {
            // a second finger: what the first one painted goes away, and the
            // two fingers zoom and move the view (handle_move)
            this.cancel_touch_stroke();
            this.is_double_touch = true;
            this.last_touch_mid = null;
            this.double_touch_points = [
                [e.touches[0].clientX, e.touches[0].clientY],
                [e.touches[1].clientX, e.touches[1].clientY]
            ];
            return;
        } else {
            this.is_double_touch = false;
        }
        // the frame as it was, so that a long press (the menu) or a second
        // finger can take back what this finger paints (cancel_touch_stroke)
        this.touch_backup = e.touches ? this.bitmap.getContext('2d').getImageData(0, 0, this.bitmap.width, this.bitmap.height) : null;
        let p = this.get_touch_point(e);
        this.last_mouse_x = p[0] - this.element.position().left;
        this.last_mouse_y = p[1] - this.element.position().top;
        // the right button opens the menu (contextmenu, canvas_menu)
        if (!e.touches && e.button === 2) return;
        // the middle button, or the left one while the Leertaste is held: move the view
        if (!e.touches && (e.button === 1 || (e.button === 0 && this.space_pan))) {
            e.preventDefault();
            this.grab_panning = true;
            this.moving_x = p[0];
            this.moving_y = p[1];
            this.element.addClass('grab-panning');
            return;
        }
        this.mouse_down = true;
        this.mouse_down_point = this.get_sprite_point_from_last_mouse();
        this.mouse_down_in_selection = this.get_pixel(this.selection_bitmap, this.mouse_down_point[0], this.mouse_down_point[1])[3] > 0;
        if (this.menu.get('tool') === 'tool/select-rect' && this.mouse_down_in_selection) {
            this.clear(this.stamp_bitmap);
            let context = this.stamp_bitmap.getContext('2d');
            context.drawImage(this.bitmap, 0, 0);
            // TODO: This is terribly slow
            for (let y = 0; y < this.bitmap.height; y++) {
                for (let x = 0; x < this.bitmap.width; x++) {
                    if (this.get_pixel(this.selection_bitmap, x, y)[3] === 0) {
                        this.set_pixel(this.stamp_bitmap, x, y, 0x00000001);
                    } else {
                        if (!this.modifier_shift)
                            this.set_pixel(this.bitmap, x, y, 0x00000000);
                    }
                }
            }
        }
        this.mouse_down_button = e.button;
        this.spray_pixels = null;
        if (this.menu) {
            if (this.menu.get('tool') === 'tool/pan') {
                this.moving = true;
                this.moving_x = p[0];
                this.moving_y = p[1];
            } else if (PERFORM_ON_MOUSE_DOWN_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                this.perform_drawing_action();
            }
        }
        if (this.menu.get('tool') === 'tool/select-rect' && this.mouse_down_in_selection)
            this.handle_move(e);
    }

    get_sprite_point_from_last_mouse() {
        let sx = (this.last_mouse_x - this.offset_x) / this.scale;
        let sy = (this.last_mouse_y - this.offset_y) / this.scale;
        sx -= ((this.pen_width + 1) % 2) * 0.5;
        sy -= ((this.pen_width + 1) % 2) * 0.5;
        return [Math.floor(sx), Math.floor(sy)];
    }

    linePattern(p0, p1) {
        let result = [];
        let x0 = p0[0];
        let y0 = p0[1];
        let x1 = p1[0];
        let y1 = p1[1];
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        while (true) {
            result.push([x0, y0]);
            if (x0 == x1 && y0 == y1)
                break;
            let e2 = err * 2;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        return result;
    }

    prepare_2_point_coordinates(p0, p1) {
        let x0 = p0[0], y0 = p0[1], x1 = p1[0], y1 = p1[1];
        if (x1 < x0) { let t = x0; x0 = x1; x1 = t; }
        if (y1 < y0) { let t = y0; y0 = y1; y1 = t; }
        if ((this.menu.get('tool') !== 'tool/select-rect') && this.modifier_ctrl) {
            let s = Math.max(x1 - x0, y1 - y0);
            x1 = x0 + s;
            y1 = y0 + s;
        }
        if (this.modifier_shift) {
            let w2 = (x1 - x0);
            let h2 = (y1 - y0);
            let cx = p0[0];
            let cy = p0[1];
            x0 = cx - w2;
            y0 = cy - h2;
            x1 = cx + w2;
            y1 = cy + h2;
        }
        return [x0, y0, x1, y1];
    }

    rectPattern(p0, p1) {
        let [x0, y0, x1, y1] = this.prepare_2_point_coordinates(p0, p1)
        if (x0 > x1) { let t = x0; x0 = x1; x1 = t; }
        if (y0 > y1) { let t = y0; y0 = y1; y1 = t; }
        let result = [];
        for (let x = x0; x <= x1; x++) {
            result.push([x, y0]);
            result.push([x, y1]);
        }
        for (let y = y0 + 1; y < y1; y++) {
            result.push([x0, y]);
            result.push([x1, y]);
        }
        return result;
    }

    fillRectPattern(p0, p1) {
        let [x0, y0, x1, y1] = this.prepare_2_point_coordinates(p0, p1)
        if ((this.menu.get('tool') !== 'tool/select-rect') && this.modifier_ctrl) {
            let s = Math.max(x1 - x0, y1 - y0);
            x1 = x0 + s;
            y1 = y0 + s;
        }
        if (x0 > x1) { let t = x0; x0 = x1; x1 = t; }
        if (y0 > y1) { let t = y0; y0 = y1; y1 = t; }
        let result = [];
        for (let y = y0; y <= y1; y++) {
            result.push([x0, y, x1 - x0 + 1]);
        }
        return result;
    }

    ellipsePattern(p0, p1) {
        let [x0, y0, x1, y1] = this.prepare_2_point_coordinates(p0, p1)
        let sx = (x1 - x0) % 2;
        let sy = (y1 - y0) % 2;
        let a = Math.floor(Math.abs(x1 - x0) / 2);
        let b = Math.floor(Math.abs(y1 - y0) / 2);
        let xm = x0 + a;
        let ym = y0 + b;
        if (a == 0)
            if (a < 1 || b < 1)
                return this.linePattern([xm - a, ym - b], [xm + a, ym + b]);

        let result = [];
        let dx = 0;
        let dy = b;
        let a2 = a * a;
        let b2 = b * b;
        let err = b2 - (2 * b - 1) * a2;

        do {
            result.push([xm + dx + sx, ym + dy + sy]);
            result.push([xm - dx, ym + dy + sy]);
            result.push([xm + dx + sx, ym - dy]);
            result.push([xm - dx, ym - dy]);
            let e2 = 2 * err;
            if (e2 < (2 * dx + 1) * b2) { dx++; err += (2 * dx + 1) * b2; }
            if (e2 > -(2 * dy - 1) * a2) { dy--; err -= (2 * dy - 1) * a2; }
        } while (dy >= 0);
        while (dx++ < a) {
            result.push([xm + dx + sx, ym]);
            result.push([xm - dx, ym]);
        }
        return result;
    }

    fillEllipsePattern(p0, p1) {
        let [x0, y0, x1, y1] = this.prepare_2_point_coordinates(p0, p1)
        let sx = (x1 - x0) % 2;
        let sy = (y1 - y0) % 2;
        let a = Math.floor(Math.abs(x1 - x0) / 2);
        let b = Math.floor(Math.abs(y1 - y0) / 2);
        let xm = x0 + a;
        let ym = y0 + b;
        if (a == 0)
            if (a < 1 || b < 1)
                return this.linePattern([xm - a, ym - b], [xm + a, ym + b]);

        let result = [];
        let dx = 0;
        let dy = b;
        let a2 = a * a;
        let b2 = b * b;
        let err = b2 - (2 * b - 1) * a2;

        do {
            result.push([xm - dx, ym - dy, dx * 2 + 1 + sx]);
            result.push([xm - dx, ym + dy + sy, dx * 2 + 1 + sx]);
            let e2 = 2 * err;
            if (e2 < (2 * dx + 1) * b2) { dx++; err += (2 * dx + 1) * b2; }
            if (e2 > -(2 * dy - 1) * a2) { dy--; err -= (2 * dy - 1) * a2; }
        } while (dy >= 0)
        while (dx++ < a) {
            result.push([xm - dx, ym, dx * 2 + 1 + sx]);
        }
        return result;
    }

    patternForTool(p0, p1, tool) {
        if (tool === 'tool/line')
            return this.linePattern(p0, p1);
        else if (tool === 'tool/rect')
            return this.rectPattern(p0, p1);
        else if (tool === 'tool/fill-rect')
            return this.fillRectPattern(p0, p1);
        else if (tool === 'tool/ellipse')
            return this.ellipsePattern(p0, p1);
        else if (tool === 'tool/fill-ellipse')
            return this.fillEllipsePattern(p0, p1);
        else if (tool === 'tool/select-rect')
            return this.fillRectPattern(p0, p1);
    }

    mask_for_pen_and_pattern(pen_mask, shape_mask) {
        let mask_hash = {};
        for (let l of shape_mask) {
            for (let p of pen_mask) {
                if (l.length > 2) {
                    for (let x = 0; x < l[2]; x++) {
                        let mx = l[0] + p[0] + x;
                        let my = l[1] + p[1];
                        mask_hash[`${mx}|${my}`] = [mx, my];
                    }
                } else {
                    let mx = l[0] + p[0];
                    let my = l[1] + p[1];
                    mask_hash[`${mx}|${my}`] = [mx, my];
                }
            }
        }
        return Object.values(mask_hash);
    }

    async move_frames(dx, dy) {
        let temp = document.createElement('canvas');
        temp.width = this.bitmap.width;
        temp.height = this.bitmap.height;
        let context = temp.getContext('2d');
        let temp2 = document.createElement('canvas');
        temp2.width = this.bitmap.width;
        temp2.height = this.bitmap.height;
        let context2 = temp2.getContext('2d');
        for (let fi = 0; fi < this.game.data.sprites[this.sprite_index].states[this.state_index].frames.length; fi++) {
            if (this.modifier_shift && fi !== this.frame_index) continue;
            let frame = this.game.data.sprites[this.sprite_index].states[this.state_index].frames[fi];
            let bitmap = await loadImage(frame.src);
            context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
            context.drawImage(bitmap, 0, 0);
            let temp3 = temp2;
            let context3 = context2;
            if (fi === this.frame_index) {
                temp3 = this.bitmap;
                context3 = this.bitmap.getContext('2d');
            }
            context3.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
            context3.drawImage(temp, dx, dy);
            context3.drawImage(temp, dx - this.bitmap.width, dy);
            context3.drawImage(temp, dx, dy - this.bitmap.height);
            context3.drawImage(temp, dx - this.bitmap.width, dy - this.bitmap.height);
            this.game.data.sprites[this.sprite_index].states[this.state_index].frames[fi].src = temp3.toDataURL('image/png');;
        }
        this.game.refresh_frames_on_screen();
    }

    perform_drawing_action() {
        let s = this.get_sprite_point_from_last_mouse();
        let pattern = this.penPattern(this.pen_width);
        let use_color = (this.mouse_down_button == 2) ? 0x00000000 : this.current_color;
        if (this.menu) {
            if (this.menu.get('tool') === 'tool/pen') {
                let line_pattern = this.linePattern(this.mouse_down_point, s);
                this.mouse_down_point = s;
                let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                this.set_pixels(this.bitmap, this.mirrored(mask), use_color);
            } else if (this.menu.get('tool') === 'tool/gradient') {
                if (this.spray_pixels === null) {
                    this.mouse_down_point = s;
                    this.mouse_down_color = this.get_pixel(this.bitmap, this.mouse_down_point[0], this.mouse_down_point[1]);
                    this.spray_pixels = this.determine_spray_pixels();
                    let context = this.bitmap.getContext('2d', { willReadFrequently: true });
                    this.mouse_down_pixels = context.getImageData(0, 0, this.bitmap.width, this.bitmap.height);
                }
                let mdx = s[0] - this.mouse_down_point[0];
                let mdy = s[1] - this.mouse_down_point[1];
                let ml = (mdx * mdx + mdy * mdy) ** 0.5;
                if (!this.modifier_alt) {
                    mdx /= ml;
                    mdy /= ml;
                }
                if (ml < 0.0001) ml = 0.0001;
                for (let p of this.spray_pixels) {
                    let draw_color = this.current_color;
                    let dx = p[0] - this.mouse_down_point[0];
                    let dy = p[1] - this.mouse_down_point[1];
                    let l = (dx * dx + dy * dy) ** 0.5;
                    let alpha = l / ml;
                    if (!this.modifier_alt) {
                        alpha = (dx * mdx + dy * mdy) / ml;
                    }
                    if (alpha < 0.0) alpha = 0.0;
                    if (alpha > 1.0) alpha = 1.0;
                    let r = this.mouse_down_pixels.data[p[1] * this.bitmap.width * 4 + p[0] * 4 + 0];
                    let g = this.mouse_down_pixels.data[p[1] * this.bitmap.width * 4 + p[0] * 4 + 1];
                    let b = this.mouse_down_pixels.data[p[1] * this.bitmap.width * 4 + p[0] * 4 + 2];
                    let a = this.mouse_down_pixels.data[p[1] * this.bitmap.width * 4 + p[0] * 4 + 3];
                    r = r * (1.0 - alpha) + ((this.current_color >> 24) & 0xff) * alpha;
                    g = g * (1.0 - alpha) + ((this.current_color >> 16) & 0xff) * alpha;
                    b = b * (1.0 - alpha) + ((this.current_color >> 8) & 0xff) * alpha;
                    a += Math.floor(alpha * 255);
                    if (a > 255) a = 255;
                    draw_color = ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff);
                    if (this.modifier_ctrl) {
                        let c = tinycolor({r: r, g: g, b: b, a: 1.0});
                        let t = c.getBrightness() / 255.0;
                        t = Math.pow(t, 0.5);
                        t = t * 255.0;
                        if (Math.random() < 0.5) {
                            c = c.brighten(Math.random() * (t / 20.0));
                        } else {
                            c = c.darken(Math.random() * (t / 20.0));
                        }
                        let rgb = c.toRgb();
                        r = rgb.r;
                        g = rgb.g;
                        b = rgb.b;
                        draw_color = ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff);
                    }
                    this.set_pixel(this.bitmap, p[0], p[1], draw_color);
                }
            } else if (this.menu.get('tool') === 'tool/select-rect') {
                if (!this.mouse_down_in_selection) {
                    let line_pattern = this.patternForTool(this.mouse_down_point, s, this.menu.get('tool'));
                    let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                    if (!(this.modifier_ctrl || this.modifier_alt)) this.clear(this.selection_bitmap);
                    this.set_pixels(this.selection_bitmap, mask, this.modifier_alt ? 0x0: 0x1);
                    this.update_selection_outline();
                } else {
                    this.append_to_undo_stack();
                    // put stamp in final position
                    let bitmap_context = this.bitmap.getContext('2d');
                    bitmap_context.drawImage(this.stamp_bitmap, s[0] - this.mouse_down_point[0], s[1] - this.mouse_down_point[1]);
                    this.write_frame_to_game_data();
                    // move selection
                    let stamp_context = this.stamp_bitmap.getContext('2d');
                    stamp_context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
                    stamp_context.drawImage(this.selection_bitmap, s[0] - this.mouse_down_point[0], s[1] - this.mouse_down_point[1]);
                    let selection_context = this.selection_bitmap.getContext('2d');
                    selection_context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
                    selection_context.drawImage(this.stamp_bitmap, 0, 0);
                    this.update_selection_outline();
                }
            } else if (TWO_POINT_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                let line_pattern = this.patternForTool(this.mouse_down_point, s, this.menu.get('tool'));
                let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                this.set_pixels(this.bitmap, this.mirrored(mask), use_color);
            } else if (this.menu.get('tool') === 'tool/picker') {
                this.mouse_down_point = s;
                let pattern = this.penPattern(this.pen_width);
                let color = [0, 0, 0, 0];
                let count = 0;
                for (let p of pattern) {
                    let x = this.mouse_down_point[0] + p[0];
                    let y = this.mouse_down_point[1] + p[1];
                    if (x >= 0 && y >= 0 && x < this.bitmap.width && y < this.bitmap.height) {
                        let pixel = this.get_pixel(this.bitmap, x, y);
                        for (let i = 0; i < 4; i++)
                            color[i] += pixel[i];
                        count += 1;
                    }
                }
                if (count > 0) {
                    for (let i = 0; i < 4; i++)
                        color[i] = Math.round(color[i] / count);
                    setCurrentColor(tinycolor({ r: color[0], g: color[1], b: color[2], a: color[3] / 255 }).toHex8String());
                    this.menu.handle_click(window.revert_to_tool);
                }
            } else if (this.menu.get('tool') === 'tool/spray') {
                this.stop_ticker();
                this.mouse_down_point = s;
                this.mouse_down_color = this.get_pixel(this.bitmap, this.mouse_down_point[0], this.mouse_down_point[1]);
                this.spray_pixels = this.determine_spray_pixels();
                this.spray_pixels_per_shot = Math.max(1, Math.floor(this.bitmap.width * this.bitmap.height / 50 / 5));
                this.start_ticker(20);
            } else if (this.menu.get('tool') === 'tool/fill') {
                this.mouse_down_point = s;
                if (s[0] < 0 || s[1] < 0 || s[0] >= this.bitmap.width || s[1] >= this.bitmap.height) return;
                this.mouse_down_color = this.get_pixel(this.bitmap, this.mouse_down_point[0], this.mouse_down_point[1]);
                // Farbe ersetzen: with Shift every pixel of this colour in the
                // frame, with Strg in every frame of the sprite (pixel_tools.js)
                if (this.modifier_ctrl || this.modifier_shift) {
                    this.replace_color(Array.from(this.mouse_down_color), rgba_of(use_color >>> 0), this.modifier_ctrl);
                    return;
                }
                let context = this.bitmap.getContext('2d');
                this.flood_fill_data = context.getImageData(0, 0, this.bitmap.width, this.bitmap.height);
                this.flood_fill_seen_pixels = {};
                this._flood_fill(this.mouse_down_point, this.mouse_down_color);
                // mirrored: the area on the other side, too (unless it is the same one)
                const mx = this.bitmap.width - 1 - s[0];
                if (this.symmetric && mx !== s[0] && !this.flood_fill_seen_pixels[s[1] * this.bitmap.width + mx])
                    this._flood_fill([mx, s[1]], this.get_pixel(this.bitmap, mx, s[1]));
                context.putImageData(this.flood_fill_data, 0, 0);
                this.flood_fill_seen_pixels = null;
                this.flood_fill_data = null;
            } else if (this.menu.get('tool') === 'tool/move') {
                let dx = s[0] - this.mouse_down_point[0];
                let dy = s[1] - this.mouse_down_point[1];
                while (dx < 0) dx += this.bitmap.width;
                while (dy < 0) dy += this.bitmap.height;
                dx %= this.bitmap.width;
                dy %= this.bitmap.height;
                if (dx !== 0 || dy !== 0) {
                    this.move_frames(dx, dy);
                    this.mouse_down_point = s;
                }
            }
        }
    }

    clearSelection() {
        this.clear(this.selection_bitmap);
        this.clear(this.selection_bitmap_outline);
    }

    // Fills the area of exactly the colour under the mouse (mouse_down_color)
    // that p belongs to. With its own list instead of calling itself once per
    // pixel: that ran out of stack on an empty 96 × 96 frame (the robot).
    _flood_fill(p, color) {
        const width = this.bitmap.width, height = this.bitmap.height;
        const data = this.flood_fill_data.data, seen = this.flood_fill_seen_pixels;
        const use_color = (this.mouse_down_button == 2) ? 0x00000000 : this.current_color;
        const want = this.mouse_down_color;
        const fill = [(use_color >> 24) & 0xff, (use_color >> 16) & 0xff, (use_color >> 8) & 0xff, use_color & 0xff];
        const todo = [p[1] * width + p[0]];
        while (todo.length) {
            const offset = todo.pop();
            if (seen[offset]) continue;
            seen[offset] = true;
            const o = offset * 4;
            if (data[o] !== want[0] || data[o + 1] !== want[1] || data[o + 2] !== want[2] || data[o + 3] !== want[3]) continue;
            data[o] = fill[0]; data[o + 1] = fill[1]; data[o + 2] = fill[2]; data[o + 3] = fill[3];
            const x = offset % width, y = (offset - x) / width;
            if (x > 0) todo.push(offset - 1);
            if (y > 0) todo.push(offset - width);
            if (x < width - 1) todo.push(offset + 1);
            if (y < height - 1) todo.push(offset + width);
        }
    }

    determine_spray_pixels() {
        let result = [];
        if (this.modifier_shift) {
            for (let y = 0; y < this.bitmap.height; y++) {
                for (let x = 0; x < this.bitmap.width; x++) {
                    result.push([x, y]);
                }
            }
        } else {
            let context = this.bitmap.getContext('2d');
            let data = context.getImageData(0, 0, this.bitmap.width, this.bitmap.height);
            for (let y = 0; y < this.bitmap.height; y++) {
                for (let x = 0; x < this.bitmap.width; x++) {
                    let o = y * this.bitmap.width * 4 + x * 4;
                    let color = [data.data[o + 0], data.data[o + 1], data.data[o + 2], data.data[o + 3]];
                    if (color.join('/') === this.mouse_down_color.join('/'))
                        // if (color.join('/') === self.mouse_down_color.join('/'))
                        // self.set_pixel(self.bitmap, x + p[0], y + p[1], draw_color);
                        result.push([x, y]);
                }
            }
        }
        return result;
    }

    start_ticker(frequency) {
        this.stop_ticker();
        this.periodic_ticker_handle = setInterval(this.ticker_callback, frequency, this);
    }

    stop_ticker() {
        if (this.periodic_ticker_handle !== null) {
            clearInterval(this.periodic_ticker_handle);
            this.periodic_ticker_handle = null;
        }
    }

    ticker_callback(self) {
        if (self.menu) {
            if (self.menu.get('tool') === 'tool/spray') {
                for (let i = 0; i < self.spray_pixels_per_shot; i++) {
                    if (self.spray_pixels.length === 0)
                        return;
                    let offset = Math.floor(Math.random() * (self.spray_pixels.length));
                    let x = self.spray_pixels[offset][0];
                    let y = self.spray_pixels[offset][1];
                    self.spray_pixels[offset] = self.spray_pixels[self.spray_pixels.length - 1];
                    self.spray_pixels = self.spray_pixels.slice(0, self.spray_pixels.length - 1);
                    let pattern = self.penPattern(self.pen_width);
                    for (let p of pattern) {
                        let draw_color = self.current_color;
                        if (self.modifier_ctrl) {
                            let c = tinycolor('#' + draw_color.toString(16));
                            if (Math.random() < 0.5)
                                c = c.brighten(Math.random() * 10);
                            else
                                c = c.darken(Math.random() * 10);
                            draw_color = parseInt(c.toHex8(), 16);
                        }
                        if (self.modifier_shift) {
                            self.set_pixel(self.bitmap, x + p[0], y + p[1], draw_color);
                        } else {
                            let color = self.get_pixel(self.bitmap, x + p[0], y + p[1]);
                            if (color.join('/') === self.mouse_down_color.join('/'))
                                self.set_pixel(self.bitmap, x + p[0], y + p[1], draw_color);
                        }
                    }
                }
            }
        }
    }

    handle_up(e) {
        if (current_pane !== 'sprites') return;
        // two fingers: done once both are off (nothing was painted)
        if (this.is_double_touch) {
            if (!(e.touches?.length)) { this.is_double_touch = false; this.last_touch_mid = null; }
            this.mouse_down = false;
            return;
        }
        this.touch_backup = null;
        if (this.grab_panning) {
            this.grab_panning = false;
            if (!this.space_pan) this.element.removeClass('grab-panning');
            return;
        }
        if (this.menu) {
            if (this.menu.get('tool') === 'tool/pan') {
                this.moving = false;
            } else if (TWO_POINT_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                if (this.mouse_down)
                    this.perform_drawing_action();
            }
            if (this.mouse_down) {
                if (UNDO_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                    this.write_frame_to_game_data();
                    this.append_to_undo_stack();
                }
            }
        }
        this.mouse_down = false;
        this.mouse_down_point = null;
        this.mouse_down_button = null;
        this.update_overlay_brush();
        this.update_selection_brush();
        this.stop_ticker();
    }

    current_frame_src() {
        return this.game?.data?.sprites?.[this.sprite_index]?.states?.[this.state_index]?.frames?.[this.frame_index]?.src;
    }

    write_frame_to_game_data() {
        this.game.data.sprites[this.sprite_index].states[this.state_index].frames[this.frame_index].src = this.toUrl();
        this.game.refresh_frames_on_screen();
    }

    setShowPen(flag) {
        this.show_pen = flag;
        this.update_overlay_brush();
        this.update_selection_brush();
    }

    update_outline(bitmap, bitmap_outline, extra_stroke) {
        if (typeof(extra_stroke) === 'undefined') extra_stroke = false;
        let context = bitmap.getContext('2d');
        let outline_context = bitmap_outline.getContext('2d');
        let width = bitmap.width;
        let height = bitmap.height;
        let outline_width = bitmap_outline.width;
        let outline_height = bitmap_outline.height;
        outline_context.clearRect(0, 0, outline_width, outline_height);
        if (bitmap !== this.selection_bitmap) {
            if (!((this.mouse_down || this.mouse_in_canvas) && this.show_pen))
                return;
            if (this.mouse_down && this.mouse_down_in_selection)
                return;
        }
        let data = context.getImageData(0, 0, width, height).data;
        outline_context.beginPath();
        outline_context.strokeStyle = '#ffffff';
        // outline_context.setLineDash([4, 4]);
        outline_context.lineWidth = 1;
        if (extra_stroke) {
            outline_context.lineWidth = 5;
            outline_context.strokeStyle = '#000';
        }
        // TODO: This code is really slow on a large sprite
        // outline_context.moveTo(0, 0);
        // outline_context.lineTo(100, 200);
        // outline_context.stroke();
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let offset = (y * width + x) * 4;
                let sx = x * this.scale + Math.min(this.offset_x, 0) - (Math.min(this.offset_x, 0) % this.scale);
                let sy = y * this.scale + Math.min(this.offset_y, 0) - (Math.min(this.offset_y, 0) % this.scale);
                let p0 = data[offset + 3] > 0;
                let px = data[offset + 4 + 3] > 0;
                let py = data[offset + width * 4 + 3] > 0;
                if (x < width - 1) {
                    if (p0 && !px) {
                        outline_context.moveTo(Math.round(sx + this.scale) - 0.5, Math.round(sy) - 0.5);
                        outline_context.lineTo(Math.round(sx + this.scale) - 0.5, Math.round(sy + this.scale) - 0.5);
                    }
                    if (!p0 && px) {
                        outline_context.moveTo(Math.round(sx + this.scale) + 0.5, Math.round(sy) - 0.5);
                        outline_context.lineTo(Math.round(sx + this.scale) + 0.5, Math.round(sy + this.scale) - 0.5);
                    }
                }
                if (y < height - 1) {
                    if (p0 && !py) {
                        outline_context.moveTo(Math.round(sx) - 0.5, Math.round(sy + this.scale) - 0.5);
                        outline_context.lineTo(Math.round(sx + this.scale) - 0.5, Math.round(sy + this.scale) - 0.5);
                    }
                    if (!p0 && py) {
                        outline_context.moveTo(Math.round(sx) - 0.5, Math.round(sy + this.scale) + 0.5);
                        outline_context.lineTo(Math.round(sx + this.scale) - 0.5, Math.round(sy + this.scale) + 0.5);
                    }
                }
            }
        }
        outline_context.stroke();
        if (extra_stroke) {
            outline_context.strokeStyle = '#ffffff';
            outline_context.lineWidth = 2;
            outline_context.stroke();
        }

    }

    update_overlay_outline(extra_stroke) {
        this.update_outline(this.overlay_bitmap, this.overlay_bitmap_outline, extra_stroke);
    }

    update_overlay_brush() {
        if (this.last_mouse_x === null || this.last_mouse_y === null)
            return;
        let use_color = (this.mouse_down_button == 2) ? 0x00000000 : this.current_color;
        let pattern = this.penPattern(this.pen_width);
        let s = this.get_sprite_point_from_last_mouse();
        let extra_stroke = false;
        if (this.menu.get('tool') === 'tool/select-rect') {
            use_color = 1;
            if (!this.mouse_down) {
                let selection_pixel = this.get_pixel(this.selection_bitmap, s[0], s[1])[3];
                if (selection_pixel === 0) {
                    $(this.element).css('cursor', 'crosshair');
                } else {
                    $(this.element).css('cursor', 'move');
                    extra_stroke = true;
                    use_color = 0;
                }
            } else {
                $(this.element).css('cursor', 'crosshair');
            }
        }
        this.clear(this.overlay_bitmap);
        if (!(this.is_touch && !this.mouse_down)) {
            if (this.menu.get('tool') === 'tool/pen') {
                if (this.mouse_in_canvas && this.show_pen) {
                    for (let p of this.mirrored(pattern.map(p => [s[0] + p[0], s[1] + p[1]])))
                        this.set_pixel(this.overlay_bitmap, p[0], p[1], Math.max(1, use_color));
                }
            } else if (TWO_POINT_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                if (this.menu.get('tool') === 'tool/select-rect') {
                    if (this.mouse_down) {
                        if (!this.mouse_down_in_selection) {
                            let line_pattern = this.patternForTool(this.mouse_down_point, s, this.menu.get('tool'));
                            let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                            this.set_pixels(this.overlay_bitmap, mask, use_color);
                        } else {
                            let overlay_context = this.overlay_bitmap.getContext('2d');
                            overlay_context.drawImage(this.stamp_bitmap, s[0] - this.mouse_down_point[0], s[1] - this.mouse_down_point[1]);
                        }
                    } else {
                        for (let p of pattern)
                            this.set_pixel(this.overlay_bitmap, s[0] + p[0], s[1] + p[1], use_color);
                    }
                } else {
                    if (this.mouse_down) {
                        if (this.menu.get('tool') === 'tool/gradient') {
                        } else {
                            let line_pattern = this.patternForTool(this.mouse_down_point, s, this.menu.get('tool'));
                            let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                            this.set_pixels(this.overlay_bitmap, this.mirrored(mask), Math.max(1, use_color));
                        }
                    } else {
                        for (let p of this.mirrored(pattern.map(p => [s[0] + p[0], s[1] + p[1]])))
                            this.set_pixel(this.overlay_bitmap, p[0], p[1], Math.max(1, use_color));
                    }
                }
            } else if (PEN_SHAPE_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                for (let p of pattern)
                    this.set_pixel(this.overlay_bitmap, s[0] + p[0], s[1] + p[1], 1);
            }
        }
        this.update_overlay_outline();
        if (this.menu.get('tool') === 'tool/select-rect') {
            this.update_selection_outline(extra_stroke);
        }
    }

    update_selection_outline(extra_stroke) {
        this.update_outline(this.selection_bitmap, this.selection_bitmap_outline, extra_stroke);
    }

    update_selection_brush() {
        this.update_selection_outline();
    }

    handle_move(e) {
        if (current_pane !== 'sprites') return;
        if (this.is_double_touch) {
            if ((e.touches ?? []).length < 2) return;
            let this_touch_points = [
                [e.touches[0].clientX, e.touches[0].clientY],
                [e.touches[1].clientX, e.touches[1].clientY]
            ];
            let dx = this_touch_points[0][0] - this_touch_points[1][0];
            let dy = this_touch_points[0][1] - this_touch_points[1][1];
            let this_touch_distance = Math.sqrt(dx * dx + dy * dy);
            let touch_distance_delta = null;
            if (this.last_touch_distance !== null)
                touch_distance_delta = this_touch_distance - this.last_touch_distance;
            this.last_touch_distance = this_touch_distance;
            // two fingers, every tool: closer / apart zooms, together moves the view
            let tx = (this_touch_points[0][0] + this_touch_points[1][0]) * 0.5;
            let ty = (this_touch_points[0][1] + this_touch_points[1][1]) * 0.5;
            if (this.last_touch_mid) {
                this.offset_x += tx - this.last_touch_mid[0];
                this.offset_y += ty - this.last_touch_mid[1];
            }
            this.last_touch_mid = [tx, ty];
            if (touch_distance_delta !== null)
                this.zoom_at_point(-touch_distance_delta * 3, tx - this.element.position().left, ty - this.element.position().top);
            else this.handleResize();
            return;
        }
        let p = this.get_touch_point(e);
        this.last_mouse_x = p[0] - this.element.position().left;
        this.last_mouse_y = p[1] - this.element.position().top;
        if (this.grab_panning) {
            this.offset_x += p[0] - this.moving_x;
            this.offset_y += p[1] - this.moving_y;
            this.moving_x = p[0];
            this.moving_y = p[1];
            this.handleResize();
            return;
        }
        if (this.menu) {
            if (this.menu.get('tool') === 'tool/pan') {
                if (this.moving) {
                    let dx = p[0] - this.moving_x;
                    let dy = p[1] - this.moving_y;
                    this.offset_x += dx;
                    this.offset_y += dy;
                    this.moving_x = p[0];
                    this.moving_y = p[1];
                    this.handleResize();
                }
            // } else if (this.menu.get('tool') === 'tool/select-rect') {
            //     this.update_selection_brush();
            } else {
                this.update_overlay_brush();
                if (PERFORM_ON_MOUSE_MOVE_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                    if (this.mouse_down) {
                        this.perform_drawing_action();
                    }
                }
            }
        }
    }

    undo() {
        // if (this.undo_stack.length === 0)
        //     return;
        // this.loadFromUrl(this.undo_stack[this.undo_stack.length - 1]);
        // this.undo_stack = this.undo_stack.slice(0, this.undo_stack.length - 1);
        // this.refresh_undo_stack();
    }

    loadFromUrl(url, add_to_undo_stack, callback) {
        if (typeof (add_to_undo_stack) === 'undefined')
            add_to_undo_stack = false;
        let drawing = new Image();
        let context = this.bitmap.getContext('2d');
        let self = this;
        drawing.src = url;
        drawing.decode().then(() => {
            self.bitmap.width = drawing.width;
            self.bitmap.height = drawing.height;
            self.overlay_bitmap.width = drawing.width;
            self.overlay_bitmap.height = drawing.height;
            self.selection_bitmap.width = drawing.width;
            self.selection_bitmap.height = drawing.height;
            self.stamp_bitmap.width = drawing.width;
            self.stamp_bitmap.height = drawing.height;
            context.drawImage(drawing, 0, 0);
            $(self.bitmap).css('width', `${self.bitmap.width * self.scale}px`);
            $(self.bitmap).css('height', `${self.bitmap.height * self.scale}px`);
            $(self.overlay_bitmap).css('width', `${self.bitmap.width * self.scale}px`);
            $(self.overlay_bitmap).css('height', `${self.bitmap.height * self.scale}px`);
            $(self.selection_bitmap).css('width', `${self.bitmap.width * self.scale}px`);
            $(self.selection_bitmap).css('height', `${self.bitmap.height * self.scale}px`);
            self.autoFit();
            // Showing a frame must not change it: re-encoding the canvas can
            // produce different PNG data (and slightly different semi-
            // transparent pixels) than the frame that was just loaded.
            if (self.current_frame_src() === url && url.startsWith('data:image/png'))
                self.game.refresh_frames_on_screen();
            else
                self.write_frame_to_game_data();
            if (add_to_undo_stack)
                self.append_to_undo_stack();
            if (typeof (callback) !== 'undefined')
                callback();
        });
    }

    toUrl() {
        return this.bitmap.toDataURL('image/png');
    }

    autoFit() {
        this.visible_pixels = Math.max(this.bitmap.width, this.bitmap.height);
        this.handleResize();
    }

    zoomIn() {
        this.zoom_at_point(-200, this.size / 2, this.size / 2);
    }

    zoomOut() {
        this.zoom_at_point(200, this.size / 2, this.size / 2);
    }

    panLeft() {
        this.offset_x += this.size * 0.1;
        this.handleResize();
    }

    panRight() {
        this.offset_x -= this.size * 0.1;
        this.handleResize();
    }

    panUp() {
        this.offset_y += this.size * 0.1;
        this.handleResize();
    }

    panDown() {
        this.offset_y -= this.size * 0.1;
        this.handleResize();
    }

    flipHorizontal() {
        // with a selection: only the selection (in its place)
        if (this.has_selection()) { this.flip_selection('x'); return; }
        let temp = document.createElement('canvas');
        temp.width = this.bitmap.width;
        temp.height = this.bitmap.height;
        let context = temp.getContext('2d');
        context.translate(this.bitmap.width, 0);
        context.scale(-1, 1);
        context.drawImage(this.bitmap, 0, 0);
        context = this.bitmap.getContext('2d');
        context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
        context.drawImage(temp, 0, 0);
        this.append_to_undo_stack();
        this.write_frame_to_game_data();
    }

    flipVertical() {
        if (this.has_selection()) { this.flip_selection('y'); return; }
        let temp = document.createElement('canvas');
        temp.width = this.bitmap.width;
        temp.height = this.bitmap.height;
        let context = temp.getContext('2d');
        context.translate(0, this.bitmap.height);
        context.scale(1, -1);
        context.drawImage(this.bitmap, 0, 0);
        context = this.bitmap.getContext('2d');
        context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
        context.drawImage(temp, 0, 0);
        this.append_to_undo_stack();
        this.write_frame_to_game_data();
    }

    rotateRight() {
        let temp = document.createElement('canvas');
        temp.width = this.bitmap.width;
        temp.height = this.bitmap.height;
        let context = temp.getContext('2d');
        context.translate(this.bitmap.width / 2, this.bitmap.height / 2);
        context.rotate(Math.PI / 2);
        context.translate(-this.bitmap.width / 2, -this.bitmap.height / 2);
        context.drawImage(this.bitmap, 0, 0);
        context = this.bitmap.getContext('2d');
        context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
        context.drawImage(temp, 0, 0);
        this.append_to_undo_stack();
        this.write_frame_to_game_data();
    }

    rotateLeft() {
        let temp = document.createElement('canvas');
        temp.width = this.bitmap.width;
        temp.height = this.bitmap.height;
        let context = temp.getContext('2d');
        context.translate(this.bitmap.width / 2, this.bitmap.height / 2);
        context.rotate(-Math.PI / 2);
        context.translate(-this.bitmap.width / 2, -this.bitmap.height / 2);
        context.drawImage(this.bitmap, 0, 0);
        context = this.bitmap.getContext('2d');
        context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
        context.drawImage(temp, 0, 0);
        this.append_to_undo_stack();
        this.write_frame_to_game_data();
    }

    penPattern(width) {
        if (width == 1)
            return [[0, 0]];
        else if (width == 2)
            return [[0, 0], [1, 0], [0, 1], [1, 1]];
        else if (width == 3)
            return [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]];
        else if (width == 4)
            return [[0, -1], [1, -1],
            [-1, 0], [0, 0], [1, 0], [2, 0],
            [-1, 1], [0, 1], [1, 1], [2, 1],
            [0, 2], [1, 2]];
        else if (width == 5)
            return [[-1, -2], [0, -2], [1, -2],
            [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1],
            [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
            [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1],
            [-1, 2], [0, 2], [1, 2]];
        else if (width == 6)
            return [
                [-1, -2], [0, -2], [1, -2], [2, -2],
                [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
                [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
                [-2, 1], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1],
                [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [3, 2],
                [-1, 3], [0, 3], [1, 3], [2, 3],
            ];
    }

    set_pixel(canvas, x, y, color) {
        let context = canvas.getContext('2d', { willReadFrequently: true });
        let data = context.getImageData(x, y, 1, 1);
        data.data[0] = (color >> 24) & 0xff;
        data.data[1] = (color >> 16) & 0xff;
        data.data[2] = (color >> 8) & 0xff;
        data.data[3] = color & 0xff;
        context.putImageData(data, x, y);
    }

    get_pixel(canvas, x, y) {
        let context = canvas.getContext('2d', { willReadFrequently: true });
        let data = context.getImageData(x, y, 1, 1);
        return [data.data[0], data.data[1], data.data[2], data.data[3]];
    }

    set_pixels(canvas, mask, color) {
        let context = canvas.getContext('2d', { willReadFrequently: true });
        let data = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let p of mask) {
            let x = p[0];
            let y = p[1];
            if (x >= 0 && y >= 0 && x < canvas.width && y < canvas.height) {
                let offset = y * canvas.width * 4 + x * 4;
                data.data[offset + 0] = (color >> 24) & 0xff;
                data.data[offset + 1] = (color >> 16) & 0xff;
                data.data[offset + 2] = (color >> 8) & 0xff;
                data.data[offset + 3] = color & 0xff;
            }
        }
        context.putImageData(data, 0, 0);
    }

    clear(canvas) {
        let context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    // ------------------------------------------- the selection (pixel_tools.js)
    selection_mask() {
        return this.selection_bitmap.getContext('2d', { willReadFrequently: true })
            .getImageData(0, 0, this.bitmap.width, this.bitmap.height).data;
    }

    frame_pixels() {
        return this.bitmap.getContext('2d', { willReadFrequently: true })
            .getImageData(0, 0, this.bitmap.width, this.bitmap.height).data;
    }

    has_selection() {
        if (!this.bitmap?.width) return false;
        const mask = this.selection_mask();
        for (let i = 3; i < mask.length; i += 4) if (mask[i] > 0) return true;
        return false;
    }

    // Puts { pixels, mask } into the frame and the selection; one undo step.
    apply_selection_result(result) {
        const w = this.bitmap.width, h = this.bitmap.height;
        this.bitmap.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.pixels), w, h), 0, 0);
        this.selection_bitmap.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(result.mask), w, h), 0, 0);
        this.update_selection_outline();
        this.write_frame_to_game_data();
        this.append_to_undo_stack();
    }

    copy_selection_pixels() {
        const clip = copy_selected(this.frame_pixels(), this.selection_mask(), this.bitmap.width, this.bitmap.height);
        if (!clip) return false;
        window.pixel_clipboard = clip;
        window.pixel_clipboard_from_here = true;
        if (typeof show_state_notice === 'function')
            show_state_notice('Kopiert – mit Strg+V fügst du es ein, auch in einem anderen Frame (an derselben Stelle).');
        return true;
    }

    cut_selection_pixels() {
        if (!this.copy_selection_pixels()) return;
        this.delete_selection_pixels();
    }

    delete_selection_pixels() {
        const mask = this.selection_mask();
        this.apply_selection_result({ pixels: clear_selected(this.frame_pixels(), mask), mask });
    }

    // At the place it was copied from: the same head on every frame of a walk.
    paste_selection_pixels() {
        const clip = window.pixel_clipboard;
        if (!clip) return false;
        if (this.menu?.get('tool') !== 'tool/select-rect') this.menu?.handle_click('tool/select-rect');
        const w = this.bitmap.width, h = this.bitmap.height;
        const x = Math.min(clip.x, Math.max(0, w - clip.width)), y = Math.min(clip.y, Math.max(0, h - clip.height));
        this.apply_selection_result(paste_selected(this.frame_pixels(), w, h, clip, x, y));
        if (typeof show_state_notice === 'function') show_state_notice('Eingefügt – zieh die Auswahl dorthin, wo sie hin soll.');
        return true;
    }

    nudge_selection_pixels(dx, dy) {
        this.apply_selection_result(move_selected(this.frame_pixels(), this.selection_mask(), this.bitmap.width, this.bitmap.height, dx, dy));
    }

    flip_selection(axis) {
        this.apply_selection_result(flip_selected(this.frame_pixels(), this.selection_mask(), this.bitmap.width, this.bitmap.height, axis));
    }

    select_all_pixels() {
        if (this.menu?.get('tool') !== 'tool/select-rect') this.menu?.handle_click('tool/select-rect');
        const w = this.bitmap.width, h = this.bitmap.height;
        const mask = new Uint8ClampedArray(w * h * 4);
        for (let i = 3; i < mask.length; i += 4) mask[i] = 1;
        this.selection_bitmap.getContext('2d').putImageData(new ImageData(mask, w, h), 0, 0);
        this.update_selection_outline();
    }

    handle_selection_key(e) {
        if (typeof current_pane === 'undefined' || current_pane !== 'sprites') return;
        if (e.target?.closest?.('input, textarea, select, [contenteditable]') || $('.modal-dialogs:visible, .context-menu').length) return;
        const ctrl = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
        const done = () => { e.preventDefault(); e.stopImmediatePropagation(); };
        if (ctrl && key === 'v' && window.pixel_clipboard && window.pixel_clipboard_from_here) { this.paste_selection_pixels(); done(); return; }
        if (!this.has_selection()) return;
        if (ctrl && key === 'c') { this.copy_selection_pixels(); done(); }
        else if (ctrl && key === 'x') { this.cut_selection_pixels(); done(); }
        else if (!ctrl && (e.key === 'Delete' || e.key === 'Backspace')) { this.delete_selection_pixels(); done(); }
        else if (!ctrl && e.key === 'Escape') { this.clearSelection(); done(); }
        else if (!ctrl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            const step = e.shiftKey ? 4 : 1;
            const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
            this.nudge_selection_pixels(dx, dy);
            done();
        }
    }

    // A finger's stroke that turned out to be a long press or the start of
    // two fingers: the frame as it was before it, nothing written.
    cancel_touch_stroke() {
        if (this.touch_backup && this.mouse_down) {
            this.bitmap.getContext('2d').putImageData(this.touch_backup, 0, 0);
            this.stop_ticker();
            this.clear?.(this.overlay_bitmap);
            this.handleResize();
        }
        this.touch_backup = null;
        this.mouse_down = false;
        this.mouse_down_point = null;
    }

    // The right-click menu of the drawing area: what can be done with the
    // selection, if there is one – else with the pixel and the frame.
    canvas_menu(e) {
        if (this.has_selection()) return this.selection_menu();
        // the pixel under the mouse, measured as in handle_down
        this.last_mouse_x = e.clientX - this.element.position().left;
        this.last_mouse_y = e.clientY - this.element.position().top;
        const [x, y] = this.get_sprite_point_from_last_mouse();
        const inside = x >= 0 && y >= 0 && x < this.bitmap.width && y < this.bitmap.height;
        const pixel = inside ? this.get_pixel(this.bitmap, x, y) : null;
        const transparent = typeof color_is_transparent === 'function' && color_is_transparent(this.current_color);
        const clip = window.pixel_clipboard;
        return [
            { header: `Frame ${(this.frame_index ?? 0) + 1}` },
            { label: pixel && pixel[3] === 0 ? 'Durchsichtig von hier nehmen' : 'Farbe von hier nehmen', icon: 'fa-eyedropper', key: printed_key('Z'),
                disabled: !pixel, hint: 'Wie die Pipette: der Stift malt dann mit dieser Farbe.',
                callback: () => setCurrentColor(tinycolor({ r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] / 255 }).toHex8String()) },
            { label: transparent ? 'Wieder mit Farbe malen' : 'Durchsichtig malen (radieren)', icon: 'fa-eraser', key: printed_key('X'),
                callback: () => toggle_transparent_color() },
            '-',
            { label: 'Einfügen', icon: 'fa-clipboard', key: 'Strg+V', disabled: !clip,
                hint: clip ? 'An der Stelle, an der es kopiert wurde.' : 'Erst mit „Rechteck auswählen“ etwas auswählen und kopieren.',
                callback: () => this.paste_selection_pixels() },
            { label: 'Alles auswählen', icon: 'fa-object-group', key: 'Strg+A', callback: () => this.select_all_pixels() },
            '-',
            { label: 'Waagerecht spiegeln', icon: 'fa-arrows-h', key: printed_key('B'), callback: () => this.flipHorizontal() },
            { label: 'Senkrecht spiegeln', icon: 'fa-arrows-v', key: printed_key('N'), callback: () => this.flipVertical() },
            { label: 'Nach links drehen', icon: 'fa-rotate-left', key: printed_key('C'), callback: () => this.rotateLeft() },
            { label: 'Nach rechts drehen', icon: 'fa-rotate-right', key: printed_key('V'), callback: () => this.rotateRight() },
            '-',
            { label: 'Frame leeren', icon: 'fa-file-o', hint: 'Macht diesen Frame leer. Strg+Z holt das Bild zurück.',
                callback: () => this.clearFrame() },
        ];
    }

    // The right-click menu of "Rechteck auswählen".
    selection_menu() {
        const any = this.has_selection();
        const clip = window.pixel_clipboard;
        return [
            { header: any ? 'Auswahl' : 'Nichts ausgewählt' },
            { label: 'Ausschneiden', icon: 'fa-scissors', key: 'Strg+X', disabled: !any, callback: () => this.cut_selection_pixels() },
            { label: 'Kopieren', icon: 'fa-files-o', key: 'Strg+C', disabled: !any, callback: () => this.copy_selection_pixels() },
            { label: 'Einfügen', icon: 'fa-clipboard', key: 'Strg+V', disabled: !clip,
                hint: clip ? 'An der Stelle, an der es kopiert wurde – auch in einem anderen Frame.' : 'Erst etwas auswählen und kopieren.',
                callback: () => this.paste_selection_pixels() },
            { label: 'Löschen', icon: 'fa-eraser', key: 'Entf', disabled: !any, callback: () => this.delete_selection_pixels() },
            '-',
            { label: 'Waagerecht spiegeln', icon: 'fa-arrows-h', key: 'B', disabled: !any, callback: () => this.flip_selection('x') },
            { label: 'Senkrecht spiegeln', icon: 'fa-arrows-v', key: 'N', disabled: !any, callback: () => this.flip_selection('y') },
            { label: 'Um 1 Pixel verschieben', icon: 'fa-arrows', key: 'Pfeiltasten', disabled: true,
                hint: 'Mit den Pfeiltasten (mit Shift: 4 Pixel) – oder zieh die Auswahl mit der Maus.' },
            '-',
            { label: 'Alles auswählen', icon: 'fa-object-group', key: 'Strg+A', callback: () => this.select_all_pixels() },
            { label: 'Auswahl aufheben', icon: 'fa-times', key: 'Esc', disabled: !any, callback: () => this.clearSelection() },
        ];
    }

    clearFrame() {
        this.clear(this.bitmap);
        this.write_frame_to_game_data();
    }

    // the scale at which the whole sprite just fills the drawing area
    fit_scale() {
        return this.size / Math.max(1, this.bitmap.width, this.bitmap.height);
    }

    fix_scale() {
        const min_scale = this.fit_scale();
        const max_scale = Math.max(MAX_ZOOM, min_scale);
        this.scale = this.size / this.visible_pixels;
        if (this.scale < min_scale) {
            this.scale = min_scale;
            this.visible_pixels = this.size / this.scale;
        }
        if (this.scale > max_scale) {
            this.scale = max_scale;
            this.visible_pixels = this.size / this.scale;
        }
    }

    handleResize() {
        let height = window.innerHeight;
        let undo_height = 48;
        this.size = Math.max(100, height - 110 - 60 - undo_height);
        // the sprite pane's layout may ask for less (studio.js sprite_pane_layout)
        if (this.max_size) this.size = Math.max(100, Math.min(this.size, this.max_size));
        this.fix_scale();
        this.scrollable_x = (this.bitmap.width * this.scale > this.size);
        this.scrollable_y = (this.bitmap.height * this.scale > this.size);
        if (!this.scrollable_x) {
            this.offset_x = (this.size - this.bitmap.width * this.scale) / 2;
        } else {
            let min_offset = -(this.bitmap.width * this.scale - this.size);
            let max_offset = 0;
            if (this.offset_x < min_offset) this.offset_x = min_offset;
            if (this.offset_x > max_offset) this.offset_x = max_offset;
        }
        if (!this.scrollable_y) {
            this.offset_y = (this.size - this.bitmap.height * this.scale) / 2;
        } else {
            let min_offset = -(this.bitmap.height * this.scale - this.size);
            let max_offset = 0;
            if (this.offset_y < min_offset) this.offset_y = min_offset;
            if (this.offset_y > max_offset) this.offset_y = max_offset;
        }
        this.element.css('height', `${this.size}px`);
        this.element.css('width', `${this.size}px`);
        this.backdrop_color.width = Math.min(this.bitmap.width * this.scale, this.size + 32);
        this.backdrop_color.height = Math.min(this.bitmap.height * this.scale, this.size + 32);
        this.backdrop.width = Math.min(this.bitmap.width * this.scale, this.size + 32);
        this.backdrop.height = Math.min(this.bitmap.height * this.scale, this.size + 32);
        const lines_width = Math.min(this.bitmap.width * this.scale, this.size + 2 * this.scale) + 1;
        const lines_height = Math.min(this.bitmap.height * this.scale, this.size + 2 * this.scale) + 1;
        for (const lines of [this.overlay_grid, this.overlay_bitmap_outline, this.selection_bitmap_outline])
            size_canvas_for_screen(lines, lines_width, lines_height);
        let context = this.overlay_grid.getContext('2d');

        // render grid lines (white)
        context.beginPath();
        let opacity = this.scale / 32 * 0.4;
        if (opacity > 0.6) opacity = 0.6;
        for (let y = 0; y < (this.size + this.scale * 2) / this.scale; y++) {
            let i = Math.round(y * this.scale);
            context.moveTo(0, i + 0.5);
            context.lineTo(this.size + 2 * this.scale, i + 0.5);
            context.moveTo(i + 0.5, 0);
            context.lineTo(i + 0.5, this.size + 2 * this.scale);
        }
        context.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        context.stroke();

        // render grid lines (black)
        context.beginPath();
        for (let y = 0; y < (this.size + this.scale * 2) / this.scale; y++) {
            let i = Math.round(y * this.scale);
            context.moveTo(0, i - 0.5);
            context.lineTo(this.size + 2 * this.scale, i - 0.5);
            context.moveTo(i - 0.5, 0);
            context.lineTo(i - 0.5, this.size + 2 * this.scale);
        }
        context.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.5})`;
        context.stroke();

        if (this.draw_ex && game != null && ('actor' in game.data.sprites[canvas.sprite_index].traits || 'baddie' in game.data.sprites[canvas.sprite_index].traits)) {
            // render sprite collision extension lines
            context.beginPath();
            let trait = game.data.sprites[canvas.sprite_index].traits.actor;
            if ('baddie' in game.data.sprites[canvas.sprite_index].traits)
                trait = game.data.sprites[canvas.sprite_index].traits.baddie;
            let x0 = Math.round(this.bitmap.width * (0.5 - trait.ex_left * 0.5) * this.scale);
            let x1 = Math.round(this.bitmap.width * (0.5 + trait.ex_right * 0.5) * this.scale);
            let y = Math.round(this.bitmap.width * (1.0 - trait.ex_top) * this.scale);
            context.moveTo(0 + 0.5, this.bitmap.height * this.scale + 0.5);
            context.lineTo(x0 + 0.5, this.bitmap.height * this.scale + 0.5);
            context.lineTo(x0 + 0.5, y + 0.5);
            context.lineTo(x1 + 0.5, y + 0.5);
            context.lineTo(x1 + 0.5, this.bitmap.height * this.scale + 0.5);
            context.lineTo(this.bitmap.width * this.scale + 0.5, this.bitmap.height * this.scale + 0.5);
            context.lineTo(this.bitmap.width * this.scale + 0.5, -0.5);
            context.lineTo(0.5, -0.5);
            context.strokeStyle = `#f00`;
            context.fillStyle = 'rgba(255, 0, 0, 0.2)'
            context.fill();
            context.stroke();
        }

        $(this.bitmap).css('width', `${Math.round(this.bitmap.width * this.scale)}px`);
        $(this.bitmap).css('height', `${Math.round(this.bitmap.height * this.scale)}px`);
        $(this.bitmap).css('left', `${this.offset_x}px`);
        $(this.bitmap).css('top', `${this.offset_y}px`);
        $(this.onion_bitmap).css({ width: `${Math.round(this.bitmap.width * this.scale)}px`, height: `${Math.round(this.bitmap.height * this.scale)}px`,
            left: `${this.offset_x}px`, top: `${this.offset_y}px` });
        $(this.overlay_bitmap).css('width', `${this.bitmap.width * this.scale}px`);
        $(this.overlay_bitmap).css('height', `${this.bitmap.height * this.scale}px`);
        $(this.overlay_bitmap).css('left', `${this.offset_x}px`);
        $(this.overlay_bitmap).css('top', `${this.offset_y}px`);
        $(this.selection_bitmap).css('width', `${this.bitmap.width * this.scale}px`);
        $(this.selection_bitmap).css('height', `${this.bitmap.height * this.scale}px`);
        $(this.selection_bitmap).css('left', `${this.offset_x}px`);
        $(this.selection_bitmap).css('top', `${this.offset_y}px`);

        if (this.scrollable_x) {
            $(this.overlay_grid).css('left', `${this.offset_x % this.scale}px`);
            $(this.overlay_bitmap_outline).css('left', `${this.offset_x % this.scale}px`);
            $(this.selection_bitmap_outline).css('left', `${this.offset_x % this.scale}px`);
            $(this.backdrop_color).css('left', `${this.offset_x % 16}px`);
            $(this.backdrop).css('left', `${this.offset_x % 16}px`);
        } else {
            $(this.overlay_grid).css('left', `${this.offset_x}px`);
            $(this.overlay_bitmap_outline).css('left', `${this.offset_x}px`);
            $(this.selection_bitmap_outline).css('left', `${this.offset_x}px`);
            $(this.backdrop_color).css('left', `${this.offset_x}px`);
            $(this.backdrop).css('left', `${this.offset_x}px`);
        }
        if (this.scrollable_y) {
            $(this.overlay_grid).css('top', `${this.offset_y % this.scale}px`);
            $(this.overlay_bitmap_outline).css('top', `${this.offset_y % this.scale}px`);
            $(this.selection_bitmap_outline).css('top', `${this.offset_y % this.scale}px`);
            $(this.backdrop_color).css('top', `${this.offset_y % 16}px`);
            $(this.backdrop).css('top', `${this.offset_y % 16}px`);
        } else {
            $(this.overlay_grid).css('top', `${this.offset_y}px`);
            $(this.overlay_bitmap_outline).css('top', `${this.offset_y}px`);
            $(this.selection_bitmap_outline).css('top', `${this.offset_y}px`);
            $(this.backdrop_color).css('top', `${this.offset_y}px`);
            $(this.backdrop).css('top', `${this.offset_y}px`);
        }
        this.update_selection_outline();
        this.place_mirror_axis();
    }

    // ---------------------------------------- Spiegelnd zeichnen (M)
    set_symmetric(flag) {
        this.symmetric = !!flag;
        this.place_mirror_axis();
        this.update_overlay_brush();
    }

    // The mask, and its mirror image while Spiegelnd zeichnen is on.
    mirrored(mask) {
        return this.symmetric ? mirror_points(mask, this.bitmap.width) : mask;
    }

    // A thin line over the middle of the sprite, where the mirror is.
    place_mirror_axis() {
        if (!this.symmetric) {
            this.mirror_axis_div?.hide();
            return;
        }
        if (!this.mirror_axis_div) this.mirror_axis_div = $('<div class="mirror-axis">').appendTo(this.element);
        const top = Math.max(0, this.offset_y);
        const bottom = Math.min(this.size, this.offset_y + this.bitmap.height * this.scale);
        this.mirror_axis_div.css({ left: `${this.offset_x + mirror_axis(this.bitmap.width) * this.scale}px`,
            top: `${top}px`, height: `${Math.max(0, bottom - top)}px` }).show();
    }

    // ---------------------------------------- Farbe ersetzen
    // Every pixel of exactly `from` becomes `to`: in this frame, or (all_frames)
    // in every frame of every state of the sprite. The other frames are loaded
    // one by one; `working` keeps the undo history from taking half of it.
    async replace_color(from, to, all_frames) {
        if (from.every((v, i) => v === to[i])) return;
        const context = this.bitmap.getContext('2d', { willReadFrequently: true });
        const data = context.getImageData(0, 0, this.bitmap.width, this.bitmap.height);
        let count = replace_color_in(data.data, from, to);
        context.putImageData(data, 0, 0);
        if (!all_frames) return;
        const si = this.sprite_index, sti = this.state_index, fi = this.frame_index;
        const sprite = this.game.data.sprites[si];
        this.working = true;
        try {
            const temp = document.createElement('canvas');
            temp.width = this.bitmap.width;
            temp.height = this.bitmap.height;
            const temp_context = temp.getContext('2d', { willReadFrequently: true });
            for (let s = 0; s < sprite.states.length; s++) {
                for (let f = 0; f < sprite.states[s].frames.length; f++) {
                    if (s === sti && f === fi) continue;
                    const frame = sprite.states[s].frames[f];
                    const image = await loadImage(frame.src);
                    temp_context.clearRect(0, 0, temp.width, temp.height);
                    temp_context.drawImage(image, 0, 0);
                    const pixels = temp_context.getImageData(0, 0, temp.width, temp.height);
                    const changed = replace_color_in(pixels.data, from, to);
                    if (!changed) continue;
                    count += changed;
                    temp_context.putImageData(pixels, 0, 0);
                    frame.src = temp.toDataURL('image/png');
                }
            }
        } finally {
            this.working = false;
        }
        this.write_frame_to_game_data();
        this.game.update_material_for_sprite?.(si);
        this.game.refresh_frames_on_screen();
        window.sprite_history?.observe?.();
        if (typeof show_state_notice === 'function') show_state_notice(count ? `${count} Pixel umgefärbt – in allen Frames des Sprites.` : 'Diese Farbe kommt sonst nirgends vor.');
    }

    // ---------------------------------------- Umriss
    // scope: 'frame', 'state' (every frame of this state) or 'sprite'. The
    // frame on the drawing area is changed directly, the others one by one
    // (`working`: one undo step for all of it).
    async outline_frames(scope) {
        if (this.sprite_index === null || this.state_index === null || this.frame_index === null) return;
        const rgba = rgba_of(this.current_color >>> 0);
        if (rgba[3] === 0) {
            if (typeof show_state_notice === 'function') show_state_notice('Wähle zuerst eine Farbe für den Umriss (nicht durchsichtig).');
            return;
        }
        const si = this.sprite_index, sti = this.state_index, fi = this.frame_index;
        const sprite = this.game.data.sprites[si];
        const w = this.bitmap.width, h = this.bitmap.height;
        this.working = true;
        let count = 0;
        try {
            const context = this.bitmap.getContext('2d', { willReadFrequently: true });
            const data = context.getImageData(0, 0, w, h);
            count += outline_pixels(data.data, w, h, rgba);
            context.putImageData(data, 0, 0);
            const temp = document.createElement('canvas');
            temp.width = w;
            temp.height = h;
            const temp_context = temp.getContext('2d', { willReadFrequently: true });
            for (let s = 0; s < sprite.states.length; s++) {
                if (scope === 'frame' || (scope === 'state' && s !== sti)) continue;
                for (let f = 0; f < sprite.states[s].frames.length; f++) {
                    if (s === sti && f === fi) continue;
                    const frame = sprite.states[s].frames[f];
                    temp_context.clearRect(0, 0, w, h);
                    temp_context.drawImage(await loadImage(frame.src), 0, 0);
                    const pixels = temp_context.getImageData(0, 0, w, h);
                    const changed = outline_pixels(pixels.data, w, h, rgba);
                    if (!changed) continue;
                    count += changed;
                    temp_context.putImageData(pixels, 0, 0);
                    frame.src = temp.toDataURL('image/png');
                }
            }
        } finally {
            this.working = false;
        }
        this.write_frame_to_game_data();
        this.append_to_undo_stack();
        this.game.update_material_for_sprite?.(si);
        this.game.refresh_frames_on_screen();
        window.sprite_history?.observe?.();
        if (typeof show_state_notice === 'function')
            show_state_notice(count ? `Umriss gezeichnet: ${count} Pixel.` : 'Hier gibt es nichts zu umranden.');
    }

    setModifierCtrl(flag) {
        this.modifier_ctrl = flag;
        this.update_overlay_brush();
    }

    setModifierAlt(flag) {
        this.modifier_alt = flag;
        this.update_overlay_brush();
    }

    setModifierShift(flag) {
        this.modifier_shift = flag;
        this.update_overlay_brush();
    }

    append_to_undo_stack() {
        let url = this.toUrl();
        const width = this.game.data.sprites[this.sprite_index].width, height = this.game.data.sprites[this.sprite_index].height;
        // the same picture again (going back and forth between frames): once is enough –
        // it moves to the end, where the newest pictures are
        const same = this.undo_stack.findIndex(entry => entry.url === url && entry.width === width && entry.height === height);
        if (same >= 0) this.undo_stack.splice(same, 1);
        if (this.undo_stack.length >= MAX_UNDO_STACK_SIZE) this.undo_stack = this.undo_stack.slice(1);
        this.undo_stack.push({
            width: this.game.data.sprites[this.sprite_index].width,
            height: this.game.data.sprites[this.sprite_index].height,
            url: url});
        this.refresh_undo_stack();
        this.game.refresh_frames_on_screen();
    }

    refresh_undo_stack() {
        let div = $('#undo_stack');
        div.empty();
        let self = this;
        // Verlauf: every picture drawn or looked at lately. A click puts it into
        // the frame being drawn; dragged onto the frames below, it becomes a new frame.
        $('<span class="undo-stack-label">').text('Verlauf').attr('title',
            'Die Bilder, die du zuletzt gemalt oder angeschaut hast. Klick: in den Frame übernehmen, den du gerade malst. Auf die Frames unten ziehen: als neuer Frame einfügen. Nur bei gleicher Größe.')
            .appendTo(div);
        const current = this.game?.data?.sprites?.[this.sprite_index];
        for (let entry of this.undo_stack) {
            let image = $('<img>').attr('src', entry.url).attr('draggable', 'true')
                .attr('title', 'Klick: in diesen Frame übernehmen · auf die Frames ziehen: neuer Frame');
            if (current && (entry.width !== current.width || entry.height !== current.height))
                image.addClass('other-size').attr('title', `${entry.width} × ${entry.height} – passt nicht zu diesem Sprite`);
            image.on('dragstart', (e) => {
                e.originalEvent.dataTransfer.setData('application/x-2d-frame', JSON.stringify(entry));
                e.originalEvent.dataTransfer.effectAllowed = 'copy';
            });
            image.click(function (e) {
                if (entry.width === self.game.data.sprites[self.sprite_index].width &&
                    entry.height === self.game.data.sprites[self.sprite_index].height) {
                    let src = $(e.target).attr('src');
                    self.loadFromUrl(src, false, function() {
                        self.append_to_undo_stack();
                    });
                }
            });
            div.append(image);
        }
        div.scrollLeft(999999);
    }

    setGame(game) {
        this.game = game;
        this.sprite_index = null;
        this.state_index = null;
        this.frame_index = null;
    }

    attachSprite(sprite_index, state_index, frame_index, callback) {
        // console.log(`attachSprite: ${sprite_index} (${this.sprite_index}), state: ${state_index} (${this.state_index}), frame: ${frame_index} (${this.frame_index})`);

        if (this.sprite_index === sprite_index && this.state_index === state_index && this.frame_index === frame_index) {
            callback();
            return;
        }
        let sprite = this.game.data.sprites[sprite_index];
        let self = this;
        let sprite_changed = (sprite_index !== this.sprite_index);
        let state_changed = (state_index !== this.state_index);
        this.detachSprite();

        this.sprite_index = sprite_index;
        this.state_index = state_index;
        this.frame_index = frame_index;

        this.loadFromUrl(sprite.states[state_index].frames[frame_index].src, true, function () {
            // self.undo_stack = sprite.undo_stack || [];
            self.refresh_undo_stack();
            $('#ti_sprite_label').val(sprite.label);
            $('#bu_sprite_gravity').attr('data-state', sprite.gravity ? 'true' : 'false');
            $('#bu_sprite_movable').attr('data-state', sprite.movable ? 'true' : 'false');

            // return;

            if (sprite_changed) {
                // console.log('sprite_changed!');
                self.states_widget = new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_states'),
                    trash: $('#trash'),
                    items: sprite.states,
                    item_class: 'menu_state_item',
                    selected_index: self.state_index,
                    step_aside_css: { top: '35px' },
                    // sprite_actions.js: Duplizieren, Animation kopieren/tauschen …
                    context_menu: (index) => typeof state_context_menu === 'function' ? state_context_menu(index) : [],
                    // double-click (or Umbenennen in its menu): rename it in the list
                    rename: {
                        get: (index) => sprite.states[index]?.properties?.name ?? '',
                        placeholder: (index) => `Zustand ${index + 1}`,
                        set: (index, name) => {
                            const state = sprite.states[index];
                            if (!state) return;
                            state.properties ??= {};
                            state.properties.name = name;
                            self.label_for_state[index]?.text(name || `Zustand ${index + 1}`).toggleClass('unnamed', !name);
                            if (index === self.state_index) self.game.build_state_traits_menu();
                        },
                    },
                    gen_item: (state, index) => {
                        let state_div = $(`<div>`);
                        let fi = Math.floor(state.frames.length / 2 - 0.5);
                        let img = $('<img>').attr('src', state.frames[fi].src);
                        state_div.append(img);
                        // without a Titel: "Zustand 2", dimmed – it can be named
                        let state_label = $(`<div class='state_label'>`).text(state.properties.name || `Zustand ${index + 1}`)
                            .toggleClass('unnamed', !state.properties.name);
                        self.label_for_state[index] = state_label;
                        state_div.append(state_label);
                        return state_div;
                    },
                    onclick: (e, index) => {
                        // the state that is shown already: stay on its frame
                        self.attachSprite(self.sprite_index, index, index === self.state_index ? self.frame_index : 0, function() {
                            // $(e).closest('.menu_state_item').parent().parent().find('.menu_state_item').removeClass('active');
                            // $(e).parent().addClass('active');
                        });
                        self.game.build_state_traits_menu();
                    },
                    gen_new_item: () => {
                        const states = self.game.data.sprites[self.sprite_index].states;
                        // "Zustand 2": a name that shows it can be renamed – and
                        // that becomes its role once it gets one (default_names.js)
                        const name = typeof next_default_name === 'function' ? next_default_name(states.map(x => x.properties?.name), 'Zustand', states.length + 1) : null;
                        states.push(name ? { properties: { name } } : {});
                        self.game.fix_game_data();
                        return states[states.length - 1];
                    },
                    delete_item: (index) => {
                        self.game.data.sprites[self.sprite_index].states.splice(index, 1);
                        // another state is at this place now: show it from its first frame
                        self.state_index = null;
                        self.frame_index = null;
                    },
                    on_move_item: (from, to) => {
                        move_item_helper(self.game.data.sprites[self.sprite_index].states, from, to);
                        self.game.refresh_frames_on_screen();
                    }
                });
            }
            self.update_onion_skin();
            if (sprite_changed || state_changed) {
                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_frames'),
                    trash: $('#trash'),
                    items: sprite.states[self.state_index].frames,
                    item_class: 'menu_frame_item',
                    selected_index: self.frame_index,
                    step_aside_css: { left: '68px' },
                    // sprite_actions.js: Duplizieren, Kopieren, Einfügen …
                    context_menu: (index) => typeof frame_context_menu === 'function' ? frame_context_menu(index) : [],
                    gen_item: (frame, index) => {
                        return $('<img>').attr('src', frame.src);
                    },
                    onclick: (e, index) => {
                        self.attachSprite(self.sprite_index, self.state_index, index, function() {
                            // $(e).closest('.menu_frame_item').parent().parent().find('.menu_frame_item').removeClass('active');
                            // $(e).parent().addClass('active');
                        });
                    },
                    gen_new_item: () => {
                        self.game.data.sprites[self.sprite_index].states[self.state_index].frames.push({});
                        self.game.fix_game_data();
                        return self.game.data.sprites[self.sprite_index].states[self.state_index].frames[self.game.data.sprites[self.sprite_index].states[self.state_index].frames.length - 1];
                    },
                    delete_item: (index) => {
                        // one of several selected frames: the others go too (sprite_actions.js)
                        const chosen = typeof selection_for_list_action === 'function' ? selection_for_list_action(index) : null;
                        const si = self.sprite_index, sti = self.state_index;
                        self.game.data.sprites[self.sprite_index].states[self.state_index].frames.splice(index, 1);
                        // another frame is at this place now: load it again
                        self.frame_index = null;
                        self.game.refresh_frames_on_screen();
                        // after the list has finished with the one it deleted
                        if (chosen) {
                            // one undo step for all of it (sprite_history.js waits)
                            self.working = true;
                            setTimeout(() => finish_block_delete(si, sti, chosen, index), 0);
                        }
                    },
                    on_move_item: (from, to) => {
                        const frames = self.game.data.sprites[self.sprite_index].states[self.state_index].frames;
                        // one of several selected frames: they move as a block (sprite_actions.js)
                        const chosen = typeof selection_for_list_action === 'function' ? selection_for_list_action(from) : null;
                        const before = [...frames];
                        const si = self.sprite_index, sti = self.state_index;
                        move_item_helper(frames, from, to);
                        self.game.refresh_frames_on_screen();
                        if (chosen) {
                            self.working = true;
                            setTimeout(() => finish_block_move(si, sti, before, chosen, from, to), 0);
                        }
                    }
                });
            }
            callback();
        });
    }

    set_onion_skin(flag) {
        this.onion_skin = !!flag;
        this.update_onion_skin();
    }

    // Onion Skinning: under the frame being drawn, the frame before it (reddish)
    // and the one after it (bluish) shine through, so a movement can be drawn
    // step by step. Animations loop: before the first frame comes the last.
    update_onion_skin() {
        const el = this.onion_bitmap;
        const frames = this.game?.data?.sprites?.[this.sprite_index]?.states?.[this.state_index]?.frames ?? [];
        const n = frames.length, fi = this.frame_index;
        if (!this.onion_skin || n < 2 || fi === null || fi >= n) {
            this.onion_key = null;
            $(el).hide();
            return;
        }
        const before = frames[(fi - 1 + n) % n].src;
        const after = n > 2 ? frames[(fi + 1) % n].src : null;
        const key = `${before}|${after}|${this.bitmap.width}x${this.bitmap.height}`;
        $(el).show();
        if (key === this.onion_key) return;
        this.onion_key = key;
        const load = (src) => {
            if (!src) return Promise.resolve(null);
            if (!this.onion_images.has(src)) {
                if (this.onion_images.size > 64) this.onion_images.clear();
                const image = new Image();
                image.src = src;
                this.onion_images.set(src, image.decode().then(() => image, () => null));
            }
            return this.onion_images.get(src);
        };
        Promise.all([load(before), load(after)]).then(([image_before, image_after]) => {
            if (this.onion_key !== key) return;
            el.width = this.bitmap.width;
            el.height = this.bitmap.height;
            const context = el.getContext('2d');
            context.clearRect(0, 0, el.width, el.height);
            const tinted = (image, color, alpha) => {
                if (!image) return;
                const temp = document.createElement('canvas');
                temp.width = el.width;
                temp.height = el.height;
                const t = temp.getContext('2d');
                t.drawImage(image, 0, 0);
                t.globalCompositeOperation = 'source-atop';
                t.fillStyle = color;
                t.fillRect(0, 0, temp.width, temp.height);
                context.globalAlpha = alpha;
                context.drawImage(temp, 0, 0);
                context.globalAlpha = 1;
            };
            tinted(image_after, 'rgba(65, 166, 246, 0.55)', 0.28);
            tinted(image_before, 'rgba(239, 125, 87, 0.45)', 0.45);
        });
    }

    detachSprite() {
        if (this.sprite_index !== null && this.state_index !== null && this.frame_index !== null && this.sprite_index < this.game.data.sprites.length) {
            // this.game.data.sprites[this.sprite_index].undo_stack = this.undo_stack;
            // this.game.data.sprites[this.sprite_index].states[this.state_index].frames[this.frame_index].src = this.toUrl();
        }
        this.sprite_index = null;
        this.state_index = null;
        this.frame_index = null;
    }

    switchToSprite(si) {
        let sprite_div = $('#menu_sprites').find('._dnd_item').eq(si).find('div').eq(0);
        sprite_div.click();
        // adjust scoll position of container
        // state_div.parent().scrollLeft(frame_div.position().left + frame_div.parent().scrollLeft() - Math.floor(frame_div.parent().width() / 2) + Math.floor(frame_div.width() / 2));
    }

    switchToSpriteDelta(delta) {
        let now = window.performance.now();
        let diff = now - last_spriteskip_timestamp;
        if (diff < SKIP_MIN_DELAY) return;
        last_spriteskip_timestamp = now;
        let si = $('#menu_sprites').find('._dnd_item.active').index();
        let sc = this.game.data.sprites.length;
        si = (si + delta + sc) % sc;
        this.switchToSprite(si);
    }

    switchToState(sti) {
        let state_div = $('#menu_states').find('._dnd_item').eq(sti).find('div').eq(0);
        state_div.click();
        // adjust scoll position of container
        // state_div.parent().scrollLeft(frame_div.position().left + frame_div.parent().scrollLeft() - Math.floor(frame_div.parent().width() / 2) + Math.floor(frame_div.width() / 2));
    }

    switchToStateDelta(delta) {
        let now = window.performance.now();
        let diff = now - last_stateskip_timestamp;
        if (diff < SKIP_MIN_DELAY) return;
        last_stateskip_timestamp = now;
        let sti = $('#menu_states').find('._dnd_item.active').index();
        let stc = this.game.data.sprites[this.sprite_index].states.length;
        sti = (sti + delta + stc) % stc;
        this.switchToState(sti);
    }

    switchToFrame(fi) {
        let frame_div = $('#menu_frames').find('._dnd_item').eq(fi).find('div').eq(0);
        if (!frame_div.hasClass('.add')) {
            frame_div.click();
            // adjust scoll position of container
            frame_div.parent().scrollLeft(frame_div.position().left + frame_div.parent().scrollLeft() - Math.floor(frame_div.parent().width() / 2) + Math.floor(frame_div.width() / 2));
        }
    }

    switchToFrameDelta(delta) {
        let now = window.performance.now();
        let diff = now - last_frameskip_timestamp;
        if (diff < SKIP_MIN_DELAY) return;
        last_frameskip_timestamp = now;
        let fi = $('#menu_frames').find('._dnd_item.active').index();
        let fc = this.game.data.sprites[this.sprite_index].states[this.state_index].frames.length;
        fi = (fi + delta + fc) % fc;
        this.switchToFrame(fi);
    }

    switchToFirstFrame() {
        this.switchToFrame(0);
    }

    switchToLastFrame() {
        this.switchToFrame(this.game.data.sprites[this.sprite_index].states[this.state_index].frames.length - 1);
    }

    update_state_label() {
        const state = this.game.data.sprites[this.sprite_index].states[this.state_index];
        const name = state.properties.name;
        this.label_for_state[this.state_index]?.text(name || `Zustand ${this.state_index + 1}`).toggleClass('unnamed', !name);
    }

    grow_image(image, width, height) {
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        let context = canvas.getContext('2d');
        context.drawImage(image, Math.floor((width - image.width) / 2), height - image.height);
        return canvas.toDataURL('image/png');
    }

    async insertFrames(si, sti, src_list) {
        let max_width = 0;
        let max_height = 0;
        let existing_frames = [];
        for (let frame of this.game.data.sprites[si].states[sti].frames) {
            let image = new Image();
            image.src = frame.src;
            await image.decode();
            existing_frames.push(image);
            if (image.width > max_width) max_width = image.width;
            if (image.height > max_height) max_height = image.height;
        }
        let images = [];
        for (let src of src_list) {
            let image = new Image();
            image.src = src;
            await image.decode();
            images.push(image);
            if (image.width > max_width) max_width = image.width;
            if (image.height > max_height) max_height = image.height;
        }

        // grow existing frames
        for (let i = 0; i < this.game.data.sprites[si].states[sti].frames.length; i++) {
            let src = this.grow_image(existing_frames[i], max_width, max_height);
            this.game.data.sprites[si].states[sti].frames[i] = {
                width: max_width,
                height: max_height,
                src: src
            };
        }
        // grow new frames
        for (let image of images) {
            let src = this.grow_image(image, max_width, max_height);
            this.game.data.sprites[si].states[sti].frames.push({
                width: max_width,
                height: max_height,
                src: src
            });
        }



    //     let image = new Image();
    //     image.src = src;
    //     image.decode().then(() => {
    //         let width = image.width;
    //         let height = image.height;
    //         for (let i = 0; i < this.game.data.sprites[si].states[sti].frames.length; i++) {
    //             let frame = this.game.data.sprites[si].states[sti].frames[i];
    //             if (frame.width < max_width || frame.height < max_height) {
    //                 // grow the frame
    //                 this.game.data.sprites[si].states[sti].frames[i].src = this.grow_image_src(frame.src, max_width, max_height);
    //                 this.game.data.sprites[si].states[sti].frames[i].width = max_width;
    //                 this.game.data.sprites[si].states[sti].frames[i].height = max_height;
    //             }
    //         }
    //         this.game.data.sprites[si].states[sti].frames.push({width: width, height: height, src: src});
    //         callback();
    //    });
    }
}

load_img_from_src = async (src) => {
    return new Promise((resolve, reject) => {
        let img = document.createElement('img');
        img.onload = async () => {
            resolve(img);
        };
        img.src = src;
    });
};

loadImage = path => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = path;
        img.onload = () => {
            resolve(img);
        }
        img.onerror = e => {
            reject(e);
        }
    });
}


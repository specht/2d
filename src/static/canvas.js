const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 24;
const PEN_SHAPE_TOOLS = ['tool/pen', 'tool/line', 'tool/rect', 'tool/ellipse',
    'tool/fill-rect', 'tool/fill-ellipse', 'tool/picker', 'tool/spray', 'tool/fill'];
const TWO_POINT_TOOLS = ['tool/line', 'tool/rect', 'tool/ellipse',
    'tool/fill-rect', 'tool/fill-ellipse', 'tool/gradient'];
const UNDO_TOOLS = ['tool/pen', 'tool/line', 'tool/rect', 'tool/ellipse',
    'tool/fill-rect', 'tool/fill-ellipse', 'tool/spray', 'tool/fill', 'tool/gradient'];
const PERFORM_ON_MOUSE_DOWN_TOOLS = ['tool/pen', 'tool/picker', 'tool/spray', 'tool/fill', 'tool/gradient'];
const PERFORM_ON_MOUSE_MOVE_TOOLS = ['tool/pen', 'tool/picker', 'tool/move', 'tool/gradient'];
const MAX_UNDO_STACK_SIZE = 32;
const MAX_DIMENSION = 256;
const MIN_ZOOM = 2;
const MAX_ZOOM = 64;
var last_spriteskip_timestamp = 0;
var last_stateskip_timestamp = 0;
var last_frameskip_timestamp = 0;
const SKIP_MIN_DELAY = 125;

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
        this.overlay_grid = document.createElement('canvas');
        this.bitmap.width = DEFAULT_WIDTH;
        this.bitmap.height = DEFAULT_HEIGHT;
        this.overlay_bitmap.width = DEFAULT_WIDTH;
        this.overlay_bitmap.height = DEFAULT_HEIGHT;
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
        $(this.element).css('overflow', 'hidden');
        $(this.element).css('cursor', 'crosshair');
        $(this.backdrop_color).css('background-color', `#777`);
        $(this.backdrop_color).css('position', 'absolute');
        $(this.backdrop).css('background-image', `url(transparent.png)`);
        $(this.backdrop).css('background-attachment', 'fixed');
        $(this.backdrop).css('position', 'absolute');
        $(this.bitmap).css('position', 'absolute');
        $(this.bitmap).css('image-rendering', 'pixelated');
        $(this.overlay_bitmap).css('position', 'absolute');
        $(this.overlay_bitmap).css('image-rendering', 'pixelated');
        $(this.overlay_bitmap).css('opacity', 0.9);
        $(this.overlay_bitmap_outline).css('position', 'absolute');
        $(this.overlay_grid).css('position', 'absolute');
        this.element.append(this.backdrop_color);
        this.element.append(this.backdrop);
        this.element.append(this.bitmap);
        this.element.append(this.overlay_bitmap);
        this.element.append(this.overlay_grid);
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
        this.element[0].addEventListener('wheel', function (e) {
            if (self.menu.get('tool') === 'tool/pan') {
                e.preventDefault();
                let cx = e.clientX - self.element.position().left;
                let cy = e.clientY - self.element.position().top;
                self.zoom_at_point(e.deltaY, cx, cy);
            }
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
        // prevent context menu on canvas when right clicking
        this.element.on('contextmenu', function (e) {
            return false;
        });
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
        if ((e.touches || []).length === 2) {
            this.is_double_touch = true;
            this.double_touch_points = [
                [e.touches[0].clientX, e.touches[0].clientY],
                [e.touches[1].clientX, e.touches[1].clientY]
            ];
        } else {
            this.is_double_touch = false;
        }
        let p = this.get_touch_point(e);
        this.last_mouse_x = p[0] - this.element.position().left;
        this.last_mouse_y = p[1] - this.element.position().top;
        this.mouse_down = true;
        this.mouse_down_point = this.get_sprite_point_from_last_mouse();
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
        if (this.modifier_ctrl) {
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
        if (this.modifier_ctrl) {
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


    perform_drawing_action() {
        let s = this.get_sprite_point_from_last_mouse();
        let pattern = this.penPattern(this.pen_width);
        let use_color = (this.mouse_down_button == 2) ? 0x00000000 : this.current_color;
        if (this.menu) {
            if (this.menu.get('tool') === 'tool/pen') {
                let line_pattern = this.linePattern(this.mouse_down_point, s);
                this.mouse_down_point = s;
                let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                this.set_pixels(this.bitmap, mask, use_color);
            } else if (this.menu.get('tool') === 'tool/gradient') {
                if (this.spray_pixels === null) {
                    this.mouse_down_point = s;
                    this.mouse_down_color = this.get_pixel(this.bitmap, this.mouse_down_point[0], this.mouse_down_point[1]);
                    this.spray_pixels = this.determine_spray_pixels();
                    let context = this.bitmap.getContext('2d');
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
                        if (Math.random() < 0.5)
                            c = c.brighten(Math.random() * 10);
                        else
                            c = c.darken(Math.random() * 10);
                        let rgb = c.toRgb();
                        r = rgb.r;
                        g = rgb.g;
                        b = rgb.b;
                        draw_color = ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff);
                    }
                    this.set_pixel(this.bitmap, p[0], p[1], draw_color);
                }
            } else if (TWO_POINT_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                let line_pattern = this.patternForTool(this.mouse_down_point, s, this.menu.get('tool'));
                let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                this.set_pixels(this.bitmap, mask, use_color);
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
                    window.menu.handle_click(window.revert_to_tool);
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
                this.mouse_down_color = this.get_pixel(this.bitmap, this.mouse_down_point[0], this.mouse_down_point[1]);
                let context = this.bitmap.getContext('2d');
                this.flood_fill_data = context.getImageData(0, 0, this.bitmap.width, this.bitmap.height);
                this.flood_fill_seen_pixels = {};
                this._flood_fill(this.mouse_down_point, this.mouse_down_color);
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
                    let temp = document.createElement('canvas');
                    temp.width = this.bitmap.width;
                    temp.height = this.bitmap.height;
                    let context = temp.getContext('2d');
                    context.drawImage(this.bitmap, 0, 0);
                    context = this.bitmap.getContext('2d');
                    context.clearRect(0, 0, this.bitmap.width, this.bitmap.height);
                    // context.translate(dx, dy);
                    context.drawImage(temp, dx, dy);
                    context.drawImage(temp, dx - this.bitmap.width, dy);
                    context.drawImage(temp, dx, dy - this.bitmap.height);
                    context.drawImage(temp, dx - this.bitmap.width, dy - this.bitmap.height);
                    this.mouse_down_point = s;
                    // this.append_to_undo_stack();
                    this.write_frame_to_game_data();
                }
            }
        }
    }

    _flood_fill(p, color) {
        let offset = p[1] * this.bitmap.width + p[0];
        if (this.flood_fill_seen_pixels[offset])
            return;
        let use_color = (this.mouse_down_button == 2) ? 0x00000000 : this.current_color;
        this.flood_fill_seen_pixels[offset] = true;
        offset *= 4;
        let probe = [];
        for (let i = 0; i < 4; i++)
            probe.push(this.flood_fill_data.data[offset + i]);
        if (probe.join('/') === this.mouse_down_color.join('/')) {
            this.flood_fill_data.data[offset + 0] = (use_color >> 24) & 0xff;
            this.flood_fill_data.data[offset + 1] = (use_color >> 16) & 0xff;
            this.flood_fill_data.data[offset + 2] = (use_color >> 8) & 0xff;
            this.flood_fill_data.data[offset + 3] = use_color & 0xff;
            if (p[0] > 0) this._flood_fill([p[0] - 1, p[1]], color);
            if (p[1] > 0) this._flood_fill([p[0], p[1] - 1], color);
            if (p[0] < this.bitmap.width - 1) this._flood_fill([p[0] + 1, p[1]], color);
            if (p[1] < this.bitmap.height - 1) this._flood_fill([p[0], p[1] + 1], color);
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
        this.stop_ticker();
    }

    write_frame_to_game_data() {
        this.game.data.sprites[this.sprite_index].states[this.state_index].frames[this.frame_index].src = this.toUrl();
        this.game.refresh_frames_on_screen();
    }

    setShowPen(flag) {
        this.show_pen = flag;
        this.update_overlay_brush();
    }

    update_overlay_outline() {
        // return;
        let overlay_context = this.overlay_bitmap.getContext('2d');
        let outline_context = this.overlay_bitmap_outline.getContext('2d');
        let overlay_width = this.overlay_bitmap.width;
        let overlay_height = this.overlay_bitmap.height;
        let outline_width = this.overlay_bitmap_outline.width;
        let outline_height = this.overlay_bitmap_outline.height;
        outline_context.clearRect(0, 0, outline_width, outline_height);
        if (!((this.mouse_down || this.mouse_in_canvas) && this.show_pen))
            return;
        let data = overlay_context.getImageData(0, 0, overlay_width, overlay_height).data;
        outline_context.beginPath();
        outline_context.strokeStyle = '#ffffff';
        outline_context.lineWidth = 1;
        // TODO: This code is really slow on a large sprite
        for (let y = 0; y < overlay_height; y++) {
            for (let x = 0; x < overlay_width; x++) {
                let offset = (y * overlay_width + x) * 4;
                let sx = x * this.scale + Math.min(this.offset_x, 0) - (Math.min(this.offset_x, 0) % this.scale);
                let sy = y * this.scale + Math.min(this.offset_y, 0) - (Math.min(this.offset_y, 0) % this.scale);
                let p0 = data[offset + 3] > 0;
                let px = data[offset + 4 + 3] > 0;
                let py = data[offset + overlay_width * 4 + 3] > 0;
                if (x < overlay_width - 1) {
                    if (p0 && !px) {
                        outline_context.moveTo(Math.round(sx + this.scale) - 0.5, Math.round(sy) + 1.5);
                        outline_context.lineTo(Math.round(sx + this.scale) - 0.5, Math.round(sy + this.scale) - 0.5);
                    }
                    if (!p0 && px) {
                        outline_context.moveTo(Math.round(sx + this.scale) + 0.5, Math.round(sy) + 1.5);
                        outline_context.lineTo(Math.round(sx + this.scale) + 0.5, Math.round(sy + this.scale) - 0.5);
                    }
                }
                if (y < overlay_height - 1) {
                    if (p0 && !py) {
                        outline_context.moveTo(Math.round(sx) + 1.5, Math.round(sy + this.scale) - 0.5);
                        outline_context.lineTo(Math.round(sx + this.scale) - 0.5, Math.round(sy + this.scale) - 0.5);
                    }
                    if (!p0 && py) {
                        outline_context.moveTo(Math.round(sx) + 1.5, Math.round(sy + this.scale) + 0.5);
                        outline_context.lineTo(Math.round(sx + this.scale) - 0.5, Math.round(sy + this.scale) + 0.5);
                    }
                }
            }
        }
        outline_context.stroke();
    }

    update_overlay_brush() {
        if (this.last_mouse_x === null || this.last_mouse_y === null)
            return;
        let use_color = (this.mouse_down_button == 2) ? 0x00000000 : this.current_color;
        let pattern = this.penPattern(this.pen_width);
        let s = this.get_sprite_point_from_last_mouse();
        this.clear(this.overlay_bitmap);
        if (!(this.is_touch && !this.mouse_down)) {
            if (this.menu.get('tool') === 'tool/pen') {
                if (this.mouse_in_canvas && this.show_pen) {
                    for (let p of pattern)
                        this.set_pixel(this.overlay_bitmap, s[0] + p[0], s[1] + p[1], Math.max(1, use_color));
                }
            } else if (TWO_POINT_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                if (this.mouse_down) {
                    if (this.menu.get('tool') === 'tool/gradient') {
                    } else {
                        let line_pattern = this.patternForTool(this.mouse_down_point, s, this.menu.get('tool'));
                        let mask = this.mask_for_pen_and_pattern(pattern, line_pattern);
                        this.set_pixels(this.overlay_bitmap, mask, Math.max(1, use_color));
                    }
                } else {
                    for (let p of pattern)
                        this.set_pixel(this.overlay_bitmap, s[0] + p[0], s[1] + p[1], Math.max(1, use_color));
                }
            } else if (PEN_SHAPE_TOOLS.indexOf(this.menu.get('tool')) >= 0) {
                for (let p of pattern)
                    this.set_pixel(this.overlay_bitmap, s[0] + p[0], s[1] + p[1], 1);
            }
        }
        this.update_overlay_outline();
    }

    handle_move(e) {
        if (current_pane !== 'sprites') return;
        if (this.is_double_touch) {
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
            if (touch_distance_delta !== null) {
                if (this.menu.get('tool') === 'tool/pan') {
                    let tx = (this_touch_points[0][0] + this_touch_points[1][0]) * 0.5;
                    let ty = (this_touch_points[0][1] + this_touch_points[1][1]) * 0.5;
                    let cx = tx - this.element.position().left;
                    let cy = ty - this.element.position().top;
                    this.zoom_at_point(-touch_distance_delta * 3, cx, cy);
                }
            }
            return;
        }
        let p = this.get_touch_point(e);
        this.last_mouse_x = p[0] - this.element.position().left;
        this.last_mouse_y = p[1] - this.element.position().top;
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
            context.drawImage(drawing, 0, 0);
            $(self.bitmap).css('width', `${self.bitmap.width * self.scale}px`);
            $(self.bitmap).css('height', `${self.bitmap.height * self.scale}px`);
            $(self.overlay_bitmap).css('width', `${self.bitmap.width * self.scale}px`);
            $(self.overlay_bitmap).css('height', `${self.bitmap.height * self.scale}px`);
            self.autoFit();
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

    rotate() {
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
    }

    set_pixel(canvas, x, y, color) {
        let context = canvas.getContext('2d');
        let data = context.getImageData(x, y, 1, 1);
        data.data[0] = (color >> 24) & 0xff;
        data.data[1] = (color >> 16) & 0xff;
        data.data[2] = (color >> 8) & 0xff;
        data.data[3] = color & 0xff;
        context.putImageData(data, x, y);
    }

    get_pixel(canvas, x, y) {
        let context = canvas.getContext('2d');
        let data = context.getImageData(x, y, 1, 1);
        return [data.data[0], data.data[1], data.data[2], data.data[3]];
    }

    set_pixels(canvas, mask, color) {
        let context = canvas.getContext('2d');
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

    fix_scale() {
        this.scale = this.size / this.visible_pixels;
        if (this.scale < MIN_ZOOM) {
            this.scale = MIN_ZOOM;
            this.visible_pixels = this.size / this.scale;
        }
        if (this.scale > MAX_ZOOM) {
            this.scale = MAX_ZOOM;
            this.visible_pixels = this.size / this.scale;
        }
    }

    handleResize() {
        let height = window.innerHeight;
        let undo_height = 48;
        this.size = Math.max(100, height - 110 - 60 - undo_height);
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
        this.overlay_grid.width = Math.min(this.bitmap.width * this.scale, this.size + 2 * this.scale) + 1;
        this.overlay_grid.height = Math.min(this.bitmap.height * this.scale, this.size + 2 * this.scale) + 1;
        this.overlay_bitmap_outline.width = Math.min(this.bitmap.width * this.scale, this.size + 2 * this.scale) + 1;
        this.overlay_bitmap_outline.height = Math.min(this.bitmap.height * this.scale, this.size + 2 * this.scale) + 1;
        let context = this.overlay_grid.getContext('2d');
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
        $(this.bitmap).css('width', `${Math.round(this.bitmap.width * this.scale)}px`);
        $(this.bitmap).css('height', `${Math.round(this.bitmap.height * this.scale)}px`);
        $(this.bitmap).css('left', `${this.offset_x}px`);
        $(this.bitmap).css('top', `${this.offset_y}px`);
        $(this.overlay_bitmap).css('width', `${this.bitmap.width * this.scale}px`);
        $(this.overlay_bitmap).css('height', `${this.bitmap.height * this.scale}px`);
        $(this.overlay_bitmap).css('left', `${this.offset_x}px`);
        $(this.overlay_bitmap).css('top', `${this.offset_y}px`);

        if (this.scrollable_x) {
            $(this.overlay_grid).css('left', `${this.offset_x % this.scale}px`);
            $(this.overlay_bitmap_outline).css('left', `${this.offset_x % this.scale}px`);
            $(this.backdrop_color).css('left', `${this.offset_x % 16}px`);
            $(this.backdrop).css('left', `${this.offset_x % 16}px`);
        } else {
            $(this.overlay_grid).css('left', `${this.offset_x}px`);
            $(this.overlay_bitmap_outline).css('left', `${this.offset_x}px`);
            $(this.backdrop_color).css('left', `${this.offset_x}px`);
            $(this.backdrop).css('left', `${this.offset_x}px`);
        }
        if (this.scrollable_y) {
            $(this.overlay_grid).css('top', `${this.offset_y % this.scale}px`);
            $(this.overlay_bitmap_outline).css('top', `${this.offset_y % this.scale}px`);
            $(this.backdrop_color).css('top', `${this.offset_y % 16}px`);
            $(this.backdrop).css('top', `${this.offset_y % 16}px`);
        } else {
            $(this.overlay_grid).css('top', `${this.offset_y}px`);
            $(this.overlay_bitmap_outline).css('top', `${this.offset_y}px`);
            $(this.backdrop_color).css('top', `${this.offset_y}px`);
            $(this.backdrop).css('top', `${this.offset_y}px`);
        }
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
        for (let entry of this.undo_stack) {
            let image = $('<img>').attr('src', entry.url);
            image.click(function (e) {
                if (entry.width === self.game.data.sprites[self.sprite_index].width &&
                    entry.height === self.game.data.sprites[self.sprite_index].height) {
                    let src = $(e.target).attr('src');
                    self.loadFromUrl(src, false);
                } else {
                    console.log('nope');
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
                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_states'),
                    trash: $('#trash'),
                    items: sprite.states,
                    item_class: 'menu_state_item',
                    step_aside_css: { top: '35px' },
                    gen_item: (state, index) => {
                        let state_div = $(`<div>`);
                        let fi = Math.floor(state.frames.length / 2 - 0.5);
                        let img = $('<img>').attr('src', state.frames[fi].src);
                        state_div.append(img);
                        state_div.append($(`<div class='state_label'>`).text(state.label));
                        return state_div;
                    },
                    onclick: (e, index) => {
                        self.attachSprite(self.sprite_index, index, 0, function() {
                            // $(e).closest('.menu_state_item').parent().parent().find('.menu_state_item').removeClass('active');
                            // $(e).parent().addClass('active');
                        });
                    },
                    gen_new_item: () => {
                        self.game.data.sprites[self.sprite_index].states.push({});
                        self.game.fix_game_data();
                        return self.game.data.sprites[self.sprite_index].states[self.game.data.sprites[self.sprite_index].states.length - 1];
                    },
                    delete_item: (index) => {
                        self.game.data.sprites[self.sprite_index].states.splice(index, 1);
                        // canvas.detachSprite();
                    },
                    on_move_item: (from, to) => {
                        move_item_helper(self.game.data.sprites[self.sprite_index].states, from, to);
                        self.game.refresh_frames_on_screen();
                    }
                });
            }
            if (sprite_changed || state_changed) {
                new DragAndDropWidget({
                    game: self.game,
                    container: $('#menu_frames'),
                    trash: $('#trash'),
                    items: sprite.states[self.state_index].frames,
                    item_class: 'menu_frame_item',
                    step_aside_css: { left: '68px' },
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
                        self.game.data.sprites[self.sprite_index].states[self.state_index].frames.splice(index, 1);
                        self.game.refresh_frames_on_screen();
                    },
                    on_move_item: (from, to) => {
                        move_item_helper(self.game.data.sprites[self.sprite_index].states[self.state_index].frames, from, to);
                        self.game.refresh_frames_on_screen();
                    }
                });
            }
            callback();
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
        frame_div.click();
        // adjust scoll position of container
        frame_div.parent().scrollLeft(frame_div.position().left + frame_div.parent().scrollLeft() - Math.floor(frame_div.parent().width() / 2) + Math.floor(frame_div.width() / 2));
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

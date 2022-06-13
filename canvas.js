const DEFAULT_WIDTH = 24;
const DEFAULT_HEIGHT = 24;

class Canvas {
    constructor(element, menu) {
        this.element = element;
        this.menu = menu;
        this.backdrop_color = document.createElement('canvas');
        this.backdrop = document.createElement('canvas');
        this.bitmap = document.createElement('canvas');
        this.overlay_bitmap = document.createElement('canvas');
        this.overlay_grid = document.createElement('canvas');
        this.bitmap.width = DEFAULT_WIDTH;
        this.bitmap.height = DEFAULT_HEIGHT;
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
        $(this.overlay_bitmap).css('opacity', 0.5);
        $(this.overlay_grid).css('position', 'absolute');
        this.element.append(this.backdrop_color);
        this.element.append(this.backdrop);
        this.element.append(this.bitmap);
        this.element.append(this.overlay_bitmap);
        this.element.append(this.overlay_grid);

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
        // $(this.element).mousedown((e) => self.handle_down(e));
        // $(this.element).mouseup((e) => self.handle_up(e));
        // $(this.element).mousemove((e) => self.handle_move(e));
        $(this.element).on('mousedown touchstart', (e) => self.handle_down(e));
        $(window).on('mouseup touchend', (e) => self.handle_up(e));
        $(window).on('mousemove touchmove', (e) => self.handle_move(e));
        // $(this.element).on({ touchend: (e) => self.handle_up(e) });
        // $(this.element).on({ touchmove: (e) => self.handle_move(e) });
        // $(window).mousemove(function (e) {
        // });
    }

    get_touch_point(e) {
        if (e.clientX)
            return { x: e.clientX, y: e.clientY };
        else
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
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

    handle_down(e) {
        let p = this.get_touch_point(e);
        if (this.menu.get('tool') === 'tool/pan') {
            this.moving = true;
            this.moving_x = p.x;
            this.moving_y = p.y;
        }
    }

    handle_up(e) {
        if (this.menu.get('tool') === 'tool/pan') {
            this.moving = false;
        }
    }

    handle_move(e) {
        if (this.menu.get('tool') === 'tool/pan') {
            if (this.moving) {
                let p = this.get_touch_point(e);
                let dx = p.x - this.moving_x;
                let dy = p.y - this.moving_y;
                this.offset_x += dx;
                this.offset_y += dy;
                this.moving_x = p.x;
                this.moving_y = p.y;
                this.handleResize();
            } else {
                // let cx = e.clientX - this.element.position().left;
                // let cy = e.clientY - this.element.position().top;
                // let sx = (cx - this.offset_x) / this.scale;
                // let sy = (cy - this.offset_y) / this.scale;
                // this.clear(this.overlay_bitmap);
                // this.set_pixel(this.overlay_bitmap, Math.floor(sx), Math.floor(sy), 0xff);
            }
        }
    }

    loadFromUrl(url) {
        let drawing = new Image();
        let context = this.bitmap.getContext('2d');
        let self = this;
        drawing.onload = function () {
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
        };
        drawing.src = url;
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

    set_pixel(canvas, x, y, color) {
        let context = canvas.getContext('2d');
        let data = context.getImageData(x, y, 1, 1);
        data.data[0] = 0xff;
        data.data[1] = 0;
        data.data[2] = 0;
        data.data[3] = 0xff;
        context.putImageData(data, x, y);
    }

    clear(canvas) {
        let context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
    }

    fix_scale() {
        this.scale = this.size / this.visible_pixels;
        if (this.scale < 3) {
            this.scale = 3;
            this.visible_pixels = this.size / this.scale;
        }
        if (this.scale > 64) {
            this.scale = 64;
            this.visible_pixels = this.size / this.scale;
        }
    }

    handleResize() {
        let height = window.innerHeight;
        this.size = Math.max(100, height - 110);
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
        $(this.bitmap).css('width', `${this.bitmap.width * this.scale}px`);
        $(this.bitmap).css('height', `${this.bitmap.height * this.scale}px`);
        $(this.bitmap).css('left', `${this.offset_x}px`);
        $(this.bitmap).css('top', `${this.offset_y}px`);
        $(this.overlay_bitmap).css('width', `${this.bitmap.width * this.scale}px`);
        $(this.overlay_bitmap).css('height', `${this.bitmap.height * this.scale}px`);
        $(this.overlay_bitmap).css('left', `${this.offset_x}px`);
        $(this.overlay_bitmap).css('top', `${this.offset_y}px`);
        if (this.scrollable_x) {
            $(this.overlay_grid).css('left', `${this.offset_x % this.scale}px`);
            $(this.backdrop_color).css('left', `${this.offset_x % 16}px`);
            $(this.backdrop).css('left', `${this.offset_x % 16}px`);
        } else {
            $(this.overlay_grid).css('left', `${this.offset_x}px`);
            $(this.backdrop_color).css('left', `${this.offset_x}px`);
            $(this.backdrop).css('left', `${this.offset_x}px`);
        }
        if (this.scrollable_y) {
            $(this.overlay_grid).css('top', `${this.offset_y % this.scale}px`);
            $(this.backdrop_color).css('top', `${this.offset_y % 16}px`);
            $(this.backdrop).css('top', `${this.offset_y % 16}px`);
        } else {
            $(this.overlay_grid).css('top', `${this.offset_y}px`);
            $(this.backdrop_color).css('top', `${this.offset_y}px`);
            $(this.backdrop).css('top', `${this.offset_y}px`);
        }
    }
}
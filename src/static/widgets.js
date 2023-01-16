class EditableText {
    constructor(options = {}) {
        this.placeholder = options.placeholder || '';
        this.element = $('<div>').addClass('editable-text');
        // this.element.text(this.label);
        let bu_edit = $(`<div class='bu'>`).html(`<i class='fa fa-edit'></i>`);
        this.element.append(bu_edit);
    }

    update() {
    }
}

class DragAndDropWidget {
    constructor(options = {}) {
        let self = this;
        this.dragging_div = $(`<div style='position: relative; pointer-events: none;'>`);
        this.mouse_down_element = null;
        this.drop_index = null;
        this.placeholder = $(`<div>`).addClass('_dnd_item').append($('<div>').addClass(options.item_class).addClass('placeholder'));
        options.old_onclick = options.onclick;
        options.onclick = function(e, index) {
            $(self.options.container).find('._dnd_item').removeClass('active');
            $(self.options.container).find('._dnd_item').eq(index).addClass('active');
            self.options.old_onclick(e, index);
        };
        options.can_be_empty ??= false;
        options.step_aside_css ??= {};
        options.step_aside_css_mod ??= {};
        options.step_aside_css_mod_n ??= 0;
        options.gen_new_item_options ??= [];
        this.options = options;
        this.options.step_aside_css_reverse = {};
        this.options.step_aside_css_mod_reverse = {};
        for (let key of Object.keys(this.options.step_aside_css)) {
            let v = this.options.step_aside_css[key];
            let neg = '-';
            if (v[0] === '-') { v = v.substr(1); neg = ''; }
            if (v[0] === '+') v = v.substr(1);
            this.options.step_aside_css_reverse[key] = neg + v;
        }
        for (let key of Object.keys(this.options.step_aside_css_mod)) {
            let v = this.options.step_aside_css_mod[key];
            let neg = '-';
            if (v[0] === '-') { v = v.substr(1); neg = ''; }
            if (v[0] === '+') v = v.substr(1);
            this.options.step_aside_css_mod_reverse[key] = neg + v;
        }
        this.options.step_aside_css_reset = {};
        for (let key of Object.keys(this.options.step_aside_css))
            this.options.step_aside_css_reset[key] = '0';
        $(options.container).empty();
        for (let i = 0; i < options.items.length; i++) {
            let item = options.items[i];
            this._append_item(options.gen_item(item, i));
        }
        this.add_div = $(`<div>`).addClass('_dnd_item add');
        this.add_button = $('<div>').addClass(options.item_class).appendTo(this.add_div);
        $('<div>').addClass('add').append($(`<i class='fa fa-plus'></i>`)).appendTo(this.add_button);
        if (self.options.gen_new_item_options.length > 0) {
            this.gen_new_item_options_div = $('<div>').addClass('add_choice_container').css('display', 'none').appendTo(this.add_div);
            for (let entry of self.options.gen_new_item_options) {
                let label = entry[0];
                let type = entry[1];
                let button = $('<div>').addClass('add_choice').append($(`<i class='fa fa-plus'>`)).append('&nbsp;&nbsp;').append($('<span>').text(label)).appendTo(this.gen_new_item_options_div);
                button.click(function(e) {
                    console.log(`adding ${type}!`);
                    self.gen_new_item_options_div.hide();
                    let index = self.options.items.length;
                    let item = self.options.gen_item(self.options.gen_new_item(type), index);
                    self._append_item(item);
                    self._move_add_div_to_end();
                    self.options.onclick(item, $(item).parent().parent().index());
                });
            }
        }

        this.add_button.click(function (e) {
            if (self.options.gen_new_item_options.length > 0) {
                if (self.gen_new_item_options_div.is(':visible')) {
                    self.gen_new_item_options_div.hide();
                } else {
                    self.gen_new_item_options_div.show();
                }
            } else {
                let index = self.options.items.length;
                let item = self.options.gen_item(self.options.gen_new_item(), index);
                self._append_item(item);
                self._move_add_div_to_end();
                self.options.onclick(item, $(item).parent().parent().index());
            }
        });
        $(options.container).append(this.add_div);
        if (options.items.length > 0 && (!options.can_be_empty))
            this.options.onclick(this.options.container.children().eq(0).children().eq(0), 0);
        this.moving_index = null;
    }

    get_touch_point(e) {
        if (e.clientX)
            return [e.clientX, e.clientY];
        else {
            if (e.touches && e.touches.length > 0) {
                this.is_touch = true;
                return [e.touches[0].clientX, e.touches[0].clientY];
            } else if (e.changedTouches && e.changedTouches.length > 0) {
                this.is_touch = true;
                return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
            } else return [0, 0];
        }
    }

    _move_add_div_to_end() {
        $(this.options.container).append(this.add_div);
    }

    _append_item(item) {
        let self = this;
        let item_div = $(`<div>`).addClass('_dnd_item');
        let item_subdiv = $(`<div>`).addClass(this.options.item_class).appendTo(item_div);
        item_subdiv.on('contextmenu', () => false);
        let drag_handle = $(`<div class='drag_handle'>`);
        item_subdiv.append(drag_handle);
        item_subdiv.append(item);
        item_subdiv.click((e) => {
            let element = $(e.target).closest('._dnd_item');
            self.options.onclick(element.children().eq(0)[0], element.index());
        });
        drag_handle.on('mousedown touchstart', function (e) {
            e.stopPropagation();
            let item = $(e.target).closest('._dnd_item').children()[0];
            let div = $(item.closest('._dnd_item'));
            self.moving_index = div.index();
            self.mouse_down_element = div;
            let body = $('html');
            let p = self.get_touch_point(e);
            let dx = p[0] - $(div).offset().left;
            let dy = p[1] - $(div).offset().top;
            body.data('_dnd_moving', true);
            body.data('_dnd_has_moved', false);
            body.data('_dnd_div_x', p[0] - dx - 1);
            body.data('_dnd_div_y', p[1] - dy - 1);
            body.data('_dnd_mouse_x', p[0]);
            body.data('_dnd_mouse_y', p[1]);
            self._install_drag_and_drop_handler();
            self.container_scroll_position = [self.options.container.scrollLeft(), self.options.container.scrollTop()];
        });
        $(this.options.container).append(item_div);
    }

    can_delete_item() {
        return this.options.can_be_empty || (this.options.container.children().length > 2);
    }

    _install_drag_and_drop_handler() {
        let self = this;
        let body = $('html');
        body.on('mousemove._dnd touchmove._dnd', function (e) {
            e.stopPropagation();
            self.options.container[0].scrollLeft = self.container_scroll_position[0];
            self.options.container[0].scrollTop = self.container_scroll_position[1];
            let body = $('html');
            if (body.data('_dnd_moving')) {
                let div_x = body.data('_dnd_div_x');
                let div_y = body.data('_dnd_div_y');
                let mouse_x = body.data('_dnd_mouse_x');
                let mouse_y = body.data('_dnd_mouse_y');
                let p = self.get_touch_point(e);
                let dx = p[0] - mouse_x;
                let dy = p[1] - mouse_y;
                if ((dx * dx + dy * dy > 100) && (!body.data('_dnd_has_moved'))) {
                    let index = self.mouse_down_element.index();
                    self.drop_index = null;
                    self.placeholder.insertAfter(self.options.container.children().eq(index));
                    self.dragging_div.appendTo($('body'));
                    self.dragging_div.append(self.mouse_down_element);
                    self.dragging_div.css('left', `${p[0] - dx - 1}px`);
                    self.dragging_div.css('top', `${p[1] - dy - 1}px`);
                    body.data('_dnd_has_moved', true);
                    if (self.can_delete_item())
                        $(self.options.trash).addClass('showing');
                }
                self.dragging_div.css('left', `${div_x + dx}px`);
                self.dragging_div.css('top', `${div_y + dy}px`);
                // find the element we're currently pointing at
                if (body.data('_dnd_has_moved')) {
                    let element = self.elementWithClassAtPoint(p, '_dnd_item');
                    if (!self.elementPresentAtPoint(p, self.options.container))
                        element = $();
                    if (self.elementPresentAtPoint(p, self.options.trash)) {
                        self.options.trash.addClass('hovering');
                    } else {
                        self.options.trash.removeClass('hovering');
                    }
                    element = element.closest('._dnd_item');
                    let parent = element.parent();
                    if (element.length === 1 && parent[0] === self.options.container[0] && element.hasClass('_dnd_item') && !element.hasClass('placeholder') && !element.hasClass('add')) {
                        let index = element.index();
                        element.parent().children().removeClass('drop_target');
                        element.addClass('drop_target');
                        self.drop_index = index;
                        if (self.drop_index === self.moving_index)
                            element.css('opacity', 0);
                    } else {
                        if (self.elementWithClassAtPoint(p, 'menu-body').length === 0) {
                            self.drop_index = null;
                            self.options.container.parent().find('._dnd_item > div').css(self.options.step_aside_css_reset);
                            self.options.container.children().removeClass('drop_target');
                        }
                    }
                    element.parent().find('._dnd_item > div').css(self.options.step_aside_css_reset);
                    if (self.drop_index !== null) {
                        if (self.drop_index < self.moving_index) {
                            for (let i = self.drop_index; i < self.moving_index; i++) {
                                if (self.options.step_aside_css_mod_n > 0) {
                                    let k = i % self.options.step_aside_css_mod_n;
                                    if (k === self.options.step_aside_css_mod_n - 1)
                                        element.parent().children().eq(i).children().eq(0).css(self.options.step_aside_css_mod);
                                    else
                                        element.parent().children().eq(i).children().eq(0).css(self.options.step_aside_css);
                                } else {
                                    element.parent().children().eq(i).children().eq(0).css(self.options.step_aside_css);
                                }
                            }
                        } else {
                            for (let i = self.moving_index + 1; i <= self.drop_index; i++) {
                                if (self.options.step_aside_css_mod_n > 0) {
                                    let k = i % self.options.step_aside_css_mod_n;
                                    if (k === 0)
                                        element.parent().children().eq(i).children().eq(0).css(self.options.step_aside_css_mod_reverse);
                                    else
                                        element.parent().children().eq(i).children().eq(0).css(self.options.step_aside_css_reverse);
                                } else {
                                    element.parent().children().eq(i).children().eq(0).css(self.options.step_aside_css_reverse);
                                }
                            }
                        }
                    }
                }
            }
        });
        body.on('mouseup._dnd touchend._dnd', function (e) {
            let body = $('html');
            if (body.data('_dnd_moving')) {
                if (!body.data('_dnd_has_moved')) {
                    self.options.onclick(self.mouse_down_element.children().eq(0)[0], self.mouse_down_element.index());
                }
                self._uninstall_drag_and_drop_handler(e);
            }
        });
    }

    _uninstall_drag_and_drop_handler(e) {
        let body = $('html');
        if (body.data('_dnd_has_moved')) {
            let select_item_at_end = null;
            let delete_at_end = null;
            let swap_later = null;
            let dragged_div = this.dragging_div.children().eq(0);
            let p = this.get_touch_point(e);
            if (this.can_delete_item() && this.elementPresentAtPoint(p, this.options.trash)) {
                // item was dropped into the trash
                delete_at_end = this.placeholder.index();
                if (dragged_div.hasClass('active'))
                    select_item_at_end = 0;
                else
                    select_item_at_end = this.options.container.find('._dnd_item.active').index();
            } else {
                if (this.drop_index === this.moving_index || this.drop_index === null) {
                    this.options.container.parent().find('._dnd_item > div').css(this.options.step_aside_css_reset);
                } else {
                    this.options.container.parent().find('._dnd_item').addClass('_no_anim');
                    this.options.container.parent().find('._dnd_item > div').css(this.options.step_aside_css_reset);
                    for (let x of this.options.container.parent().find('._dnd_item > div'))
                        $(x)[0].offsetHeight;
                    this.options.container.parent().find('._dnd_item').removeClass('_no_anim');
                }
                let dropped_div = this.placeholder;
                if (this.drop_index !== null)
                    dropped_div = this.options.container.children().eq(this.drop_index);
                if (dropped_div.index() !== this.placeholder.index()) {
                    swap_later = [dropped_div.index(), this.placeholder.index()];
                }
                if (this.drop_index < this.moving_index)
                    dragged_div.insertBefore(dropped_div);
                else
                    dragged_div.insertAfter(dropped_div);
                // dropped_div.insertAfter(this.placeholder);
            }
            this.options.container.children().removeClass('drop_target');
            this.dragging_div.empty().detach();
            this.placeholder.detach();
            select_item_at_end = this.options.container.find('._dnd_item.active').index();
            if (select_item_at_end < 0) select_item_at_end = 0;
            this._move_add_div_to_end();
            $(this.options.trash).removeClass('showing');
            if (delete_at_end !== null)
                this.options.delete_item(delete_at_end);
            if (swap_later !== null)
                this.options.on_move_item(swap_later[1], swap_later[0]);
            if (select_item_at_end != null && !this.options.can_be_empty)
                this.options.onclick(this.options.container.children().eq(select_item_at_end).children().eq(0)[0], select_item_at_end);
            if (delete_at_end !== null || swap_later !== null)
                this.options.game.refresh_frames_on_screen();
        }
        body.data('_dnd_moving', false);
        body.off('mousemove._dnd touchmove._dnd');
        body.off('mouseup._dnd touchend._dnd');
    }

    elementWithClassAtPoint(p, c) {
        for (let x of $(document.elementsFromPoint(p[0], p[1])))
            if ($(x).hasClass(c))
                return $(x);
        return $();
    }

    elementPresentAtPoint(p, e) {
        for (let x of $(document.elementsFromPoint(p[0], p[1]))) {
            if ($(x).is($(e)))
                return true;
        }
        return false;
    }
}

class SortableTable {
    constructor(options) {
        if (typeof(options.sortable) === 'undefined')
            options.sortable = true;
        this.element = options.element;
        this.headers = options.headers;
        this.rows = options.rows;
        this.clickable_row_callback = options.clickable_row_callback;
        this.filter_callback = options.filter_callback;
        this.options = options;
        let table_div = $(`<div class="table-container">`);
        let table = $("<table>");
        table_div.append(table);
        let thead = $('<thead>');
        table.append(thead);
        let self = this;
        for (let i = 0; i < options.headers.length; i++) {
            let cell = options.headers[i];
            if (options.sortable) {
                cell.addClass('hover:bg-stone-200');
                cell.data('index', i);
                cell.data('sort_direction', null);
                cell.css('cursor', 'pointer');
                cell.click(function (e) {
                    let index = $(e.target).closest('th').data('index')
                    let direction = $(e.target).closest('th').data('sort_direction') || 'desc';
                    direction = (direction === 'desc') ? 'asc' : 'desc';
                    $(e.target).closest('th').data('sort_direction', direction);
                    self.sort_rows(index, direction === 'desc');
                });
            }
            thead.append(cell);
        }
        let tbody = $('<tbody>');
        this.tbody = tbody;
        table.append(tbody);
        for (let row of options.rows) {
            this.add_row(row, false);
        }
        this.element.append(table_div);
        table.css('display', 'table');
    }

    add_row(row, highlight, insert_after_this) {
        if (row === null) return;
        if (typeof(highlight) === 'undefined')
            highlight = true;
        if (typeof(insert_after_this) === 'undefined')
            insert_after_this = null;
        let tr = $('<tr>');
        let self = this;
        if (this.options.clickable_rows) {
            tr.addClass('clickable_row');
            tr.click(function (e) {
                self.clickable_row_callback($(e.target).closest('tr').data('row_data'));
            });
        }
        let row_data = row[0];
        tr.data('row_data', row[0])
        tr.append(row.slice(1));
        let i = 0;
        let j = 0;
        let col_index = {};
        for (let cell of tr.find('td')) {
            let colspan = parseInt($(cell).attr('colspan') || 1);
            for (let k = 0; k < colspan; k++)
                col_index[j + k] = i;
            j += colspan;
            i += 1;
        }
        tr.data('col_index', col_index);

        this.tbody.append(tr);

        if (highlight) {
            tr.addClass('hl').addClass('has_hl');
            setTimeout(function() {
                tr.removeClass('hl');
            }, 2000);
        }
    }

    highlight_row(tr) {
        tr.addClass('hl').addClass('has_hl');
        setTimeout(function() {
            tr.removeClass('hl');
        }, 2000);
    }

    update_filter() {
        if (!this.filter_callback)
            return;
        for (let tr of this.tbody.find('tr')) {
            if (this.filter_callback($(tr).data('row_data')))
                $(tr).show();
            else
                $(tr).hide();
        }
    }

    sort_rows(index, descending) {
        let th = $(this.headers[index]);
        let type = $(th).data('type') || 'string';
        let rows = this.tbody.find('tr').get();
        rows.sort(function (_a, _b) {
            let result = 0;
            let aci = $(_a).data('col_index');
            let bci = $(_b).data('col_index');
            let a = $($(_a).find('td').eq(aci[index]));
            let b = $($(_b).find('td').eq(bci[index]));
            if (type === 'int') {
                let ai = $(a).data('sort_value');
                if (ai === null) ai = parseInt($(a).text());
                let bi = $(b).data('sort_value');
                if (bi === null) bi = parseInt($(b).text());
                if (isNaN(ai) && !isNaN(bi))
                    result = 1;
                else if (!isNaN(ai) && isNaN(bi))
                    result = -1;
                else if (isNaN(ai) && isNaN(bi))
                    result = 0;
                else
                    result = ai - bi;
            } else if (type === 'string') {
                let as = $(a).data('sort_value') || $(a).text();
                let bs = $(b).data('sort_value') || $(b).text();
                result = as.localeCompare(bs);
            }
            if (descending) result = -result;
            return result;
        });
        for (let row of rows)
            this.tbody.append(row);
        // for (let row of this.rows) {
        //     let tr = $('<tr>');
        //     tr.append(row);
        //     this.tbody.append(tr);
        // }
    }
}

class ColorWidget {
    constructor(data) {
        let self = this;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        this.color_button = $(`<input type='text' data-coloris class='color-dot' style='background-color: ${data.get()}'>`);
        this.color_button.click(function(e) {
            Coloris({
                themeMode: 'dark',
                alpha: data.alpha ?? false,
                focusInput: false,
                selectInput: false,
                theme: 'large',
                defaultColor: data.get(),
                swatches: current_palette_rgb.map(function(x) {
                    return `#${Number(x[0]).toString(16).padStart(2, '0')}${Number(x[1]).toString(16).padStart(2, '0')}${Number(x[2]).toString(16).padStart(2, '0')}`;
                }),
              });
        });
        // label.click(function(e) {
        //     self.color_button.click();
        // });
        div.append(this.color_button);
        $(this.container).append(div);
        this.color_button.on('open', function(e) {
            $('.modal-dialogs').css('background-color', 'transparent').show();
        });
        this.color_button.on('close', function(e) {
            $('.modal-dialogs').css('background-color', '').hide();
        });
        this.color_button.on('input', function(e) {
            let color = $(e.target).val();
            self.color_button.css('background-color', color);
            data.set(color);
        });
        this.color_button.on('change', function(e) {
            console.log('change');
        });
    }
}

class LineEditWidget {
    constructor(data) {
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        this.input = $(`<input type='text'>`);
        this.input.val(data.get());
        // label.click(function(e) {
        //     self.input.focus();
        // });
        div.append(this.input);
        $(this.container).append(div);
        let self = this;
        this.input.keydown(function(e) { self.update(); });
        this.input.keyup(function(e) { self.update(); });
        this.input.change(function(e) { self.update(); });
    }

    update() {
        this.data.set(this.input.val().trim());
    }
}

class NumberWidget {
    constructor(data) {
        let self = this;
        data.count ??= 1;
        data.width ??= '2.5em';
        data.min ??= null;
        data.max ??= null;
        data.step ??= 1;
        data.decimalPlaces ??= 0;
        data.suffix ??= null;
        if (data.min !== null && !Array.isArray(data.min))
            data.min = [data.min];
        if (data.max !== null && !Array.isArray(data.max))
            data.max = [data.max];
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let subdiv = $('<div>').css('display', 'flex').css('align-items', 'center');
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        this.input = [];
        let v = data.get();
        if (!Array.isArray(v)) v = [v];
        for (let i = 0; i < data.count; i++) {
            this.input.push($(`<input type='text' style='text-align: center; width: ${this.data.width};'>`));
            this.input[i].val(self.format(v[i]));
            if (i > 0)
                subdiv.append(this.data.connector);
            subdiv.append(this.input[i]);
            this.input[i].keydown(function(e) { self.update(i); });
            this.input[i].keyup(function(e) { self.update(i); });
            this.input[i].change(function(e) { self.update(i); });
            this.input[i].focus(function(e) {
                self.focus(i);
                $(e.target).select();
            });
            this.input[i].keydown(function(e) {
                if (self.get(i) !== null) {
                    if (e.code === 'ArrowUp')
                        self.delta(i, self.data.step);
                    if (e.code === 'ArrowDown')
                        self.delta(i, -self.data.step);
                }
            });
            this.input[i].on('wheel', function(e) {
                if (self.get(i) !== null && self.input[i].is(':focus')) {
                    if (e.originalEvent.deltaY < 0)
                        self.delta(i, self.data.step);
                    if (e.originalEvent.deltaY > 0)
                        self.delta(i, -self.data.step);
                }
            });
            this.input[i].blur(function(e) { self.blur(i); });
        }
        if (this.data.suffix !== null)
            subdiv.append($(`<span style='margin-left: 0.25em;'>`).text(this.data.suffix));
        div.append(subdiv);
        $(this.container).append(div);
    }

    delta(i, d) {
        let nv = this.get(i) + d;
        if (this.data.min !== null && nv < this.data.min[i])
            nv = this.data.min[i];
        if (this.data.max !== null && nv > this.data.max[i])
            nv = this.data.max[i];
        this.input[i].val(this.format(nv));
        this.update(i);
    }

    refresh() {
        let v = this.data.get();
        if (!Array.isArray(v)) v = [v];
        for (let i = 0; i < this.data.count; i++)
            this.input[i].val(this.format(v[i]));
    }

    get(i) {
        let v = this.input[i].val().replace(',', '.');
        v = parseFloat(v);
        if (isNaN(v))
            return null;
        if (this.data.min !== null && v < this.data.min[i])
            v = this.data.min[i];
        if (this.data.max !== null && v > this.data.max[i])
            v = this.data.max[i];
        return v;
    }

    update() {
        let values = [];
        for (let i = 0; i < this.data.count; i++) {
            let v = this.get(i);
            if (v === null) return;
            values.push(v);
        }
        this.data.set(...values);
    }

    focus() {
        this.old_value = this.data.get();
        if (!Array.isArray(this.old_value)) this.old_value = [this.old_value];
    }

    format(v) {
        return v.toFixed(this.data.decimalPlaces);
    }

    blur() {
        let values = [];
        for (let i = 0; i < this.data.count; i++) {
            let v = this.get(i);
            if (v === null) v = this.old_value[i];
            values.push(v);
            this.input[i].val(this.format(v));
        }
        this.data.set(...values);
    }
}

class CheckboxWidget {
    constructor(data) {
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        this.input = $(`<button class='btn-checkbox' data-state='${this.data.get()}'>`);
        // label.click(function(e) {
        //     self.input.click();
        // });
        this.input.click(function(e) {
            let flag = self.input.attr('data-state') === 'true';
            flag = !flag;
            $(self.input).attr('data-state', `${flag}`);
            self.data.set(flag);
        });
        div.append(this.input);
        $(this.container).append(div);
        let self = this;
        this.input.change(function(e) { self.update(); });
    }

    update() {
        this.data.set(this.input.val().trim());
    }
}

class SelectWidget {
    constructor(data) {
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        this.select = $(`<select>`);
        for (let key of Object.keys(data.options)) {
            this.select.append($(`<option>`).val(key).text(data.options[key]));
        }
        this.select.val(data.get());
        // label.click(function(e) {
        //     self.select.click();
        // });
        // this.input.click(function(e) {
        //     let flag = self.input.attr('data-state') === 'true';
        //     flag = !flag;
        //     $(self.input).attr('data-state', `${flag}`);
        //     self.data.set(flag);
        // });
        div.append(this.select);
        $(this.container).append(div);
        let self = this;
        this.select.change(function(e) { self.update(); });
    }

    update() {
        if (this.data.get() !== this.select.val())
            this.data.set(this.select.val());
    }
}

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
        this.placeholder = $(`<div>`).addClass(options.item_class).addClass('_dnd_item').addClass('placeholder');
        this.options = options;
        $(options.container).empty();
        for (let i = 0; i < options.items.length; i++) {
            let item = options.items[i];
            this._append_item(options.gen_item(item, i));
        }
        this.add_div = $(`<div>`).addClass(options.item_class).addClass('_dnd_item').addClass('add');
        this.add_div.append($(`<i class='fa fa-plus'></i>`));
        this.add_div.click(function (e) {
            let item = self.options.gen_item(self.options.gen_new_item(), options.items.length);
            self._append_item(item);
            self._move_add_div_to_end();
            self.options.onclick(item, $(item).parent().index());
        });
        $(options.container).append(this.add_div);
        if (options.items.length > 0)
            this.options.onclick(this.options.container.children().eq(0).children().eq(0), 0);
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
        let item_div = $(`<div>`).addClass(this.options.item_class).addClass('_dnd_item');
        item_div.on('contextmenu', () => false);
        let drag_handle = $(`<div class='drag_handle'>`);
        item_div.append(drag_handle);
        item_div.append(item.css('pointer-events', 'none'));
        item_div.click((e) => {
            let element = $(e.target).closest('._dnd_item');
            self.options.onclick(element.children().eq(0)[0], element.index());
        });
        drag_handle.on('mousedown touchstart', function (e) {
            e.stopPropagation();
            let item = $(e.target).closest('._dnd_item').children()[0];
            let div = $(item.closest('._dnd_item'));
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
        return this.options.container.children().length > 2;
    }

    _install_drag_and_drop_handler() {
        let self = this;
        let body = $('html');
        body.on('mousemove._dnd touchmove._dnd', function (e) {
            // e.preventDefault();
            // console.log(self.options.container.scrollTop(), self.container_scroll_position[1]);
            // self.options.container.scrollLeft(self.container_scroll_position[0]);
            // self.options.container.scrollTop(self.container_scroll_position[1]);
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
                    let element = $(document.elementFromPoint(p[0], p[1]));
                    if (element.closest(self.options.trash).length > 0) {
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
                    } else {
                        self.drop_index = null;
                        self.options.container.children().removeClass('drop_target');
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
            let element = $(document.elementFromPoint(p[0], p[1]));
            if (this.can_delete_item() && $(element).closest($(this.options.trash)).length > 0) {
                // item was dropped into the trash
                delete_at_end = this.placeholder.index();
                if (dragged_div.hasClass('active'))
                    select_item_at_end = 0;
                else
                    select_item_at_end = this.options.container.find('._dnd_item.active').index();
            } else {
                let dropped_div = this.placeholder;
                if (this.drop_index !== null)
                    dropped_div = this.options.container.children().eq(this.drop_index);
                if (dropped_div.index() !== this.placeholder.index()) {
                    swap_later = [dropped_div.index(), this.placeholder.index()];
                }
                dragged_div.insertAfter(dropped_div);
                dropped_div.insertAfter(this.placeholder);
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
                this.options.on_swap_items(swap_later[0], swap_later[1]);
            if (select_item_at_end != null)
                this.options.onclick(this.options.container.children().eq(select_item_at_end).children().eq(0)[0], select_item_at_end);
            if (delete_at_end !== null || swap_later !== null)
                this.options.game.refresh_frames_on_screen();
        }
        body.data('_dnd_moving', false);
        body.off('mousemove._dnd touchmove._dnd');
        body.off('mouseup._dnd touchend._dnd');
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

    add_row(row, highlight) {
        if (row === null) return;
        if (typeof(highlight) === 'undefined')
            highlight = true;
        let tr = $('<tr>');
        let self = this;
        if (this.options.clickable_rows) {
            tr.addClass('clickable_row');
            tr.click(function (e) {
                self.clickable_row_callback($(e.target).closest('tr').data('row_data'));
            });
        }
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

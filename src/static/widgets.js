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
        this.has_touch = false;
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
            this._append_item(options.gen_item(item, i), i);
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
                    self.gen_new_item_options_div[0].scrollIntoView();
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
        // more tiles next to + (extra_buttons: [{ icon, title, callback }])
        if (options.extra_buttons?.length) {
            this.extra_divs = $();
            for (const extra of options.extra_buttons) {
                const div = $('<div>').addClass('_dnd_item add extra');
                const button = $('<div>').addClass(options.item_class).attr('title', extra.title ?? '').appendTo(div);
                $('<div>').addClass('add').append($('<i>').addClass(`fa ${extra.icon}`)).appendTo(button);
                button.on('click', (e) => { e.stopPropagation(); extra.callback(); });
                this.extra_divs = this.extra_divs.add(div);
            }
            $(options.container).append(this.extra_divs);
        }
        // selected_index: which item is shown at first (default: the first)
        if (options.items.length > 0 && (!options.can_be_empty)) {
            const first = Math.max(0, Math.min(options.selected_index ?? 0, options.items.length - 1));
            this.options.onclick(this.options.container.children().eq(first).children().eq(0), first);
        }
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
        if (this.extra_divs) $(this.options.container).append(this.extra_divs);
    }

    // Items that were added to `items` from outside (Sprites aus einem anderen
    // Spiel, Duplizieren): shown at the end, like the + button adds one.
    append_items(first_index) {
        for (let i = first_index; i < this.options.items.length; i++)
            this._append_item(this.options.gen_item(this.options.items[i], i), i);
        this._move_add_div_to_end();
    }

    // The whole list again (after an item was inserted in the middle).
    rebuild() {
        this.add_div.detach();
        this.extra_divs?.detach();
        $(this.options.container).empty();
        for (let i = 0; i < this.options.items.length; i++)
            this._append_item(this.options.gen_item(this.options.items[i], i), i);
        this._move_add_div_to_end();
    }

    select_index(index) {
        const element = this.options.container.children().eq(index);
        if (element.length) this.options.onclick(element.children().eq(0)[0], index);
    }

    handle_down(e) {
        let self = this;
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
    }

    _append_item(item, index = this.options.items.length - 1) {
        let self = this;
        let item_div = $(`<div>`).addClass('_dnd_item');
        let item_subdiv = $(`<div>`).addClass(this.options.item_class).appendTo(item_div);
        // context_menu(index): the entries of its right-click menu (show_context_menu)
        item_subdiv.on('contextmenu', (e) => {
            const index = item_div.index();
            const entries = this.options.context_menu?.(index);
            if (entries?.length) show_context_menu(e.clientX, e.clientY, entries);
            return false;
        });
        let drag_handle = $(`<div class='drag_handle'>`);
        item_subdiv.append(drag_handle);
        item_subdiv.append(item);
        item.on('touchstart', function(e) {
            self.has_touch = true;
        });
        item.on('mousedown touchstart', function(e) {
            if (!self.has_touch)
                e.preventDefault();
        });
        item_subdiv.click((e) => {
            let element = $(e.target).closest('._dnd_item');
            self.options.onclick(element.children().eq(0)[0], element.index());
        });
        item_subdiv.on('mousedown touchstart', function (e) {
            if (!self.has_touch)
                self.handle_down(e);
        });
        drag_handle.on('mousedown touchstart', function (e) {
            if (self.has_touch)
                self.handle_down(e);
        });
        try {
            if (self.options.items[index]) {
                let hint = self.options.hint_with_heading_for_item(self.options.items[index]);
                let hint2 = {label: hint[0], hint: hint[1]};
                install_hint_handler(item, hint2);
                // console.log('hint', hint);
            }
        } catch (e) {}
        $(this.options.container).append(item_div);
    }

    can_delete_item() {
        // Optional veto for the item being dragged (live collaboration: an
        // item somebody else is editing cannot be deleted).
        if (this.options.can_delete_index && Number.isInteger(this.moving_index) &&
            this.options.can_delete_index(this.moving_index) === false)
            return false;
        // (the item being dragged is out of the list; a placeholder stands in for it)
        return this.options.can_be_empty || (this.options.container.children('._dnd_item').not('.add').length > 1);
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

// A small right-click menu. entries: { label, icon?, callback, disabled?, hint?,
// children? } or '-' for a line. It closes on a click elsewhere, Esc or scrolling.
function show_context_menu(x, y, entries, options = {}) {
    close_context_menu();
    const menu = $('<div>').addClass('context-menu').attr('role', 'menu');
    if (options.dropdown) menu.addClass('context-menu-dropdown');
    if (options.min_width) menu.css('min-width', `${Math.ceil(options.min_width)}px`);
    const build = (container, list) => {
        for (const entry of list) {
            if (entry === '-') { $('<div>').addClass('context-menu-line').appendTo(container); continue; }
            if (!entry) continue;
            const item = $('<div>').addClass('context-menu-item').attr('role', 'menuitem').appendTo(container);
            $('<i>').addClass(`fa fa-fw ${entry.icon ?? ''}`).appendTo(item);
            $('<span>').addClass('context-menu-label').text(entry.label).appendTo(item);
            if (entry.hint) item.attr('title', entry.hint);
            if (entry.disabled) { item.addClass('disabled'); continue; }
            if (entry.children) {
                item.addClass('has-children').append($('<i>').addClass('fa fa-angle-right context-menu-arrow'));
                const sub = $('<div>').addClass('context-menu context-menu-sub').appendTo(item);
                if (entry.children.length) build(sub, entry.children);
                else $('<div>').addClass('context-menu-item disabled').append($('<span>').text(entry.empty ?? '–')).appendTo(sub);
                // keep the submenu inside the window (menus near the bottom open upwards)
                item.on('mouseenter', () => {
                    sub.css('top', '-5px');
                    const rect = sub[0].getBoundingClientRect();
                    const overflow = rect.bottom - (window.innerHeight - 4);
                    if (overflow > 0) sub.css('top', `${-5 - overflow}px`);
                });
                continue;
            }
            item.on('mousedown', (e) => e.stopPropagation());
            item.on('click', (e) => {
                e.stopPropagation();
                close_context_menu();
                entry.callback?.();
            });
        }
    };
    build(menu, entries);
    menu.appendTo(document.body);
    // inside the window
    const w = menu.outerWidth(), h = menu.outerHeight();
    menu.css({ left: Math.max(4, Math.min(x, window.innerWidth - w - 4)), top: Math.max(4, Math.min(y, window.innerHeight - h - 4)) });
    // a submenu opens to the left when there is no room on the right
    if (x + w * 2 > window.innerWidth) menu.addClass('subs-left');
    setTimeout(() => {
        $(document).on('mousedown.contextmenu touchstart.contextmenu', (e) => {
            if (!$(e.target).closest('.context-menu').length) close_context_menu();
        });
        $(document).on('keydown.contextmenu', (e) => { if (e.key === 'Escape') close_context_menu(); });
        $(window).on('blur.contextmenu resize.contextmenu', () => close_context_menu());
        // scrolling inside a long menu is fine, scrolling anything else closes it
        $(window).on('wheel.contextmenu', (e) => { if (!$(e.target).closest('.context-menu').length) close_context_menu(); });
    }, 0);
}

function close_context_menu() {
    $('.context-menu').trigger('remove-menu').remove();
    $(document).off('.contextmenu');
    $(window).off('.contextmenu');
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

function install_hint_handler(div, data) {
    if (data.hint) {
        div.css('position', 'relative');
        let hint = $('<div>').addClass('tooltip').addClass('tooltip_hint').addClass('key').text('?');
        div.append(hint);
        hint.on('click', function(e) {
            let modal = new ModalDialog({
                title: data.label,
                width: 'unset',
                max_width: '800px',
                height: 'unset',
                body: $(`<p>`).html(data.hint),
                footer: [
                    {
                        type: 'button',
                        label: 'Schließen',
                        icon: 'fa-times',
                        callback: (self) => self.dismiss(),
                    },
                ]
            });
            modal.show();
            $('.tooltip').hide();
        });
    }
}

class ColorWidget {
    constructor(data) {
        let self = this;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        this.color_button = $(`<input type='text' data-coloris value='${data.get()}' class='color-dot' style='background-color: ${data.get()}'>`);
        this.color_button.click(function(e) {
            console.log(data.get());
            Coloris({
                themeMode: 'dark',
                alpha: data.alpha ?? false,
                focusInput: false,
                selectInput: false,
                theme: 'large',
                defaultColor: data.get(),
                // inline: true,
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
        install_hint_handler(div, data);
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
        console.log("LineEditWidget", data);
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`).data('widget-instance', this);
        let label = $(`<div style='margin-right: 1em; white-space: pre;'>`).text(data.label);
        div.append(label);
        this.input = $(`<input type='text'>`);
        if ((data.options || {}).multiline)
            this.input = $(`<textarea style="font-family: 'IBM Plex Sans'; max-width: 100%; background-color: rgb(17, 17, 17); color: rgb(238, 238, 238); border: none; padding: 0.5em 0.2em; margin-top: 0.5em; box-shadow: rgba(255, 255, 255, 0.3) 0px 0px 10px inset; height: 100px; width: calc(100% - 0.4em);">`);
        this.input.val(data.get());
        // label.click(function(e) {
        //     self.input.focus();
        // });
        $(this.container).append(div);
        if ((data.options || {}).multiline)
            $(this.container).append(this.input);
        else
            div.append(this.input);
        install_hint_handler(div, data);
        let self = this;
        this.input.keydown(function(e) { self.update(); });
        this.input.keyup(function(e) { self.update(); });
        this.input.change(function(e) { self.update(); });
    }

    update() {
        this.data.set(this.input.val().trim());
    }

    refresh() {
        this.input.val(this.data.get());
    }
}

class NumberWidget {
    constructor(data) {
        let self = this;
        data.hint ??= null;
        data.count ??= 1;
        data.width ??= '2.5em';
        data.min ??= null;
        data.max ??= null;
        data.step ??= 1;
        data.decimalPlaces ??= 0;
        data.suffix ??= null;
        data.onfocus ??= null;
        data.onblur ??= null;
        if (data.min !== null && !Array.isArray(data.min))
            data.min = [data.min];
        if (data.max !== null && !Array.isArray(data.max))
            data.max = [data.max];
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`).data('widget-instance', this);
        let subdiv = $('<div>').css('display', 'flex').css('align-items', 'center');
        let label = $(`<div style='margin-right: 1em;'>`).html(data.label);
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
                if (self.data.onfocus) self.data.onfocus();
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
                    e.stopPropagation();
                    e.preventDefault();
                    if (e.originalEvent.deltaY < 0)
                        self.delta(i, self.data.step);
                    if (e.originalEvent.deltaY > 0)
                        self.delta(i, -self.data.step);
                }
            });
            this.input[i].blur(function(e) {
                self.blur(i);
                if (self.data.onblur) self.data.onblur();
            });
        }
        if (this.data.suffix !== null)
            subdiv.append($(`<span style='margin-left: 0.25em;'>`).text(this.data.suffix));
        div.append(subdiv);
        $(this.container).append(div);
        install_hint_handler(div, data);
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
        if (this.data.onchange) this.data.onchange();
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
        if (this.data.onchange) this.data.onchange();
    }
}

class CheckboxWidget {
    constructor(data) {
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`).data('widget-instance', this);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        // key: its shortcut, shown like a key (the shortcut itself lives in menu.js)
        if (data.key) label.append(' ').append($('<span>').addClass('key widget-key').text(data.key));
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
        install_hint_handler(div, data);
        let self = this;
        this.input.change(function(e) { self.update(); });
    }

    update() {
        this.data.set(this.input.val().trim());
    }

    refresh() {
        this.input.attr('data-state', `${!!this.data.get()}`);
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
        install_hint_handler(div, data);
        let self = this;
        this.select.change(function(e) { self.update(); });
    }

    update() {
        if (this.data.get() !== this.select.val())
            this.data.set(this.select.val());
    }
}

class SeparatorWidget {
    constructor(data) {
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div' class='separator'>`).text(data.label);
        div.append(label);
        this.container.append(div);
    }
}

// Thumbnail-only picker for student-drawn effects. The options expand below
// the control, inside the narrow trait panel instead of beside its label.
class SpriteSelectWidget {
    static preview(sprite) {
        const frames = sprite?.states?.[0]?.frames ?? [];
        const frame = frames[Math.max(0, Math.floor((frames.length - 1) / 2))];
        return frame?.src ?? null;
    }

    constructor(data) {
        this.data = data;
        this.root = $('<div>').addClass('item sprite-select-widget');
        $('<div>').addClass('sprite-select-caption').text(data.label).appendTo(this.root);
        this.button = $('<button type="button">').addClass('sprite-select-current')
            .attr('aria-haspopup', 'true').attr('aria-expanded', 'false').appendTo(this.root);
        this.previewImage = $('<img>').addClass('sprite-select-image')
            .attr('alt', '').appendTo(this.button);
        this.previewEmpty = $('<span>').addClass('sprite-select-empty')
            .attr('aria-hidden', 'true').text('∅').appendTo(this.button);
        this.menu = $('<div>').addClass('sprite-select-menu').hide().appendTo(this.root);
        this.grid = $('<div>').addClass('sprite-select-menu-grid').attr('role', 'group')
            .attr('aria-label', 'Treffereffekt auswählen').appendTo(this.menu);
        $(data.container).append(this.root);
        install_hint_handler(this.root, data);
        this.button.on('click', () => {
            if (this.menu.is(':visible')) this.close();
            else {
                this.renderOptions();
                this.menu.show();
                this.button.attr('aria-expanded', 'true');
            }
        });
        this.root.on('keydown', event => {
            if (event.key === 'Escape') {
                this.close();
                this.button.trigger('focus');
            }
        });
        this.root.on('focusout', event => {
            if (!this.root[0].contains(event.relatedTarget)) this.close();
        });
        this.refresh();
    }

    close() {
        this.menu.hide();
        this.button.attr('aria-expanded', 'false');
    }

    // Resolve the current index on every refresh: reordering/deleting sprites
    // is handled by the editor, and changing artwork updates this thumbnail.
    refresh() {
        const chosen = this.data.get();
        const index = chosen === 'none' ? -1 : Number(chosen);
        const sprite = Number.isInteger(index) && index >= 0 ?
            this.data.sprites()[index] : null;
        const src = sprite ? SpriteSelectWidget.preview(sprite) : null;
        if (src) this.previewImage.attr('src', src).show();
        else this.previewImage.removeAttr('src').hide();
        if (src) this.previewEmpty.hide();
        else this.previewEmpty.show();
        this.button.attr('aria-label', src ?
            `${this.data.label} ausgewähltes Bild ändern` : `${this.data.label} aus`);
        // the chosen sprite's Titel (game_ids.js), else its number
        this.button.attr('title', sprite ? sprite_label(sprite, index) : (this.data.none_label ?? ''));
        if (this.menu.is(':visible')) this.renderOptions();
    }

    renderOptions() {
        this.grid.empty();
        const selected = this.data.get();
        const add = (value, src, ariaLabel) => {
            const option = $('<button type="button">').addClass('sprite-select-option')
                .attr('aria-label', ariaLabel).attr('title', ariaLabel)
                .attr('aria-pressed', String(value === selected)).appendTo(this.grid);
            if (value === selected) option.addClass('active');
            if (src) $('<img>').addClass('sprite-select-image')
                .attr('alt', '').attr('src', src).appendTo(option);
            else $('<span>').addClass('sprite-select-empty')
                .attr('aria-hidden', 'true').text('∅').appendTo(option);
            option.on('click', () => {
                this.data.set(value);
                this.close();
                this.refresh();
                this.button.trigger('focus');
            });
        };
        add('none', null, this.data.none_label ?? 'Kein Treffereffekt');
        this.data.sprites().forEach((sprite, index) =>
            add(String(index), SpriteSelectWidget.preview(sprite), sprite_label(sprite, index)));
    }
}

class SpriteWidget {
    constructor(data) {
        this.data = data;
        this.container = data.container;
        let div = $(`<div class='item'>`);
        let label = $(`<div style='margin-right: 1em;'>`).text(data.label);
        div.append(label);
        // this.select = $(`<select>`);
        for (let si = 0; si < game.data.sprites.length; si++) {
            let sprite = game.data.sprites[si];
            if (this.data.filter(sprite) === true) {
                let state = sprite.states[0];
                let fi = Math.floor(state.frames.length / 2 - 0.5);
                let img = $('<img>').addClass('sprite-sq-thumb').attr('src', state.frames[fi].src)
                    .attr('title', sprite_label(sprite, si));
                div.append(img);
            }
            // this.select.append($(`<option>`).val(si).text(`${si}`));

        }
        // div.append(this.select);
        $(this.container).append(div);
        install_hint_handler(div, data);
        // let self = this;
        // this.select.change(function(e) { self.update(); });

    }

    update() {
        if (this.data.get() !== this.select.val())
            this.data.set(this.select.val());
    }
}

// ------------------------------------------------------------ dropdowns
// Every <select> in the studio is shown as a button that opens a menu in the
// style of the right-click menus (show_context_menu). The <select> itself
// stays in the page, hidden: its value, its options, `disabled` and its change
// event work as always, so no code that uses it has to change. A select with
// data-native keeps the browser's look.
function dropdown_label(select) {
    const option = select.options[select.selectedIndex];
    return option ? option.textContent : '';
}

function sync_dropdown(select) {
    const button = select.__dropdown_button;
    if (!button) return;
    button.find('.dropdown-text').text(dropdown_label(select));
    button.prop('disabled', select.disabled);
    button.toggle(select.style.display !== 'none' && !select.hidden);
}

function open_dropdown(select, button) {
    const rect = button[0].getBoundingClientRect();
    const entries = [...select.options].map(option => ({
        label: option.textContent,
        icon: option.selected ? 'fa-check' : '',
        disabled: option.disabled,
        callback: () => {
            if (select.value === option.value) return;
            select.value = option.value;
            $(select).trigger('change');
            select.dispatchEvent(new Event('input', { bubbles: true }));
        },
    }));
    if (!entries.length) return;
    show_context_menu(rect.left, rect.bottom + 2, entries, { min_width: rect.width, dropdown: true });
    button.addClass('open');
    const close = () => { button.removeClass('open'); button.trigger('focus'); };
    $('.context-menu').first().on('remove-menu', close);
}

function enhance_select(select) {
    if (select.__dropdown_button || select.dataset.native !== undefined) return;
    const button = $('<button type="button">').addClass('dropdown-button')
        .append($('<span>').addClass('dropdown-text'))
        .append($('<i>').addClass('fa fa-angle-down dropdown-arrow'));
    select.__dropdown_button = button;
    button.insertAfter(select);
    $(select).addClass('dropdown-native');
    // the same place in a layout (flex rules for the select apply to the button, too)
    if (select.id) button.attr('data-for', select.id);
    // a click on the open dropdown's button closes it (and does not open it again)
    button.on('mousedown', (e) => { if (button.hasClass('open')) e.stopPropagation(); });
    button.on('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if ($('.context-menu').length && button.hasClass('open')) { close_context_menu(); return; }
        open_dropdown(select, button);
    });
    // arrows change the value without opening the menu
    button.on('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        e.stopPropagation();
        const options = [...select.options];
        let i = select.selectedIndex;
        do { i += e.key === 'ArrowDown' ? 1 : -1; } while (options[i]?.disabled);
        if (!options[i]) return;
        select.selectedIndex = i;
        $(select).trigger('change');
    });
    $(select).on('change', () => sync_dropdown(select));
    // options added or removed later
    new MutationObserver(() => sync_dropdown(select)).observe(select, { childList: true, subtree: true, characterData: true, attributes: true });
    sync_dropdown(select);
}

// Values set from code (select.val(…)) update the button, too.
if (typeof HTMLSelectElement !== 'undefined' && !HTMLSelectElement.__dropdown_patched) {
    HTMLSelectElement.__dropdown_patched = true;
    const later = (select) => { if (select?.__dropdown_button) queueMicrotask(() => sync_dropdown(select)); };
    for (const [proto, key, owner] of [[HTMLSelectElement.prototype, 'value', s => s], [HTMLSelectElement.prototype, 'selectedIndex', s => s],
        [HTMLOptionElement.prototype, 'selected', o => o.parentElement?.closest?.('select')]]) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (!descriptor?.set) continue;
        Object.defineProperty(proto, key, {
            ...descriptor,
            set(value) { descriptor.set.call(this, value); later(owner(this)); },
        });
    }
    const enhance_all = (root) => {
        if (root.tagName === 'SELECT') enhance_select(root);
        root.querySelectorAll?.('select').forEach(enhance_select);
    };
    const start = () => {
        enhance_all(document.body);
        new MutationObserver((mutations) => {
            for (const m of mutations) for (const node of m.addedNodes) if (node.nodeType === 1) enhance_all(node);
        }).observe(document.body, { childList: true, subtree: true });
    };
    if (typeof document !== 'undefined') {
        if (document.body) start();
        else document.addEventListener('DOMContentLoaded', start);
    }
}

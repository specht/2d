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
        for (let item of options.items) {
            this._append_item(options.gen_item(item));
        }
        this.add_div = $(`<div>`).addClass(options.item_class).addClass('_dnd_item').addClass('add');
        this.add_div.append($(`<i class='fa fa-plus'></i>`));
        this.add_div.click(function (e) {
            let item = self.options.gen_item(self.options.gen_new_item());
            self._append_item(item);
            self._move_add_div_to_end();
            self.options.onclick(item, $(item).parent().index());
        });
        $(options.container).append(this.add_div);
        if (options.items.length > 0)
            this.options.onclick(this.options.container.children().eq(0).children().eq(0), 0);
    }

    _move_add_div_to_end() {
        $(this.options.container).append(this.add_div);
    }

    _append_item(item) {
        let self = this;
        let item_div = $(`<div>`).addClass(this.options.item_class).addClass('_dnd_item');
        item_div.append(item);
        item_div.mousedown(function (e) {
            let item = $(e.target).closest('._dnd_item').children()[0];
            let div = $(item.closest('._dnd_item'));
            self.mouse_down_element = div;
            let body = $('html');
            let dx = e.clientX - $(div).offset().left;
            let dy = e.clientY - $(div).offset().top;
            body.data('_dnd_moving', true);
            body.data('_dnd_has_moved', false);
            body.data('_dnd_div_x', e.clientX - dx - 1);
            body.data('_dnd_div_y', e.clientY - dy - 1);
            body.data('_dnd_mouse_x', e.clientX);
            body.data('_dnd_mouse_y', e.clientY);
            self._install_drag_and_drop_handler();
        });
        $(this.options.container).append(item_div);
    }

    can_delete_item() {
        return this.options.container.children().length > 2;
    }

    _install_drag_and_drop_handler() {
        let self = this;
        let body = $('html');
        body.on('mousemove._dnd', function (e) {
            e.preventDefault();
            e.stopPropagation();
            let body = $('html');
            if (body.data('_dnd_moving')) {
                let div_x = body.data('_dnd_div_x');
                let div_y = body.data('_dnd_div_y');
                let mouse_x = body.data('_dnd_mouse_x');
                let mouse_y = body.data('_dnd_mouse_y');
                let dx = e.clientX - mouse_x;
                let dy = e.clientY - mouse_y;
                if ((dx * dx + dy * dy > 100) && (!body.data('_dnd_has_moved'))) {
                    let index = self.mouse_down_element.index();
                    self.drop_index = null;
                    self.placeholder.insertAfter(self.options.container.children().eq(index));
                    self.dragging_div.appendTo($('body'));
                    self.dragging_div.append(self.mouse_down_element);
                    self.dragging_div.css('left', `${e.clientX - dx - 1}px`);
                    self.dragging_div.css('top', `${e.clientY - dy - 1}px`);
                    body.data('_dnd_has_moved', true);
                    if (self.can_delete_item())
                        $(self.options.trash).addClass('showing');
                }
                self.dragging_div.css('left', `${div_x + dx}px`);
                self.dragging_div.css('top', `${div_y + dy}px`);
                // find the element we're currently pointing at
                if (body.data('_dnd_has_moved')) {
                    let element = $(document.elementFromPoint(e.clientX, e.clientY));
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
        body.on('mouseup._dnd', function (e) {
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
            let element = $(document.elementFromPoint(e.clientX, e.clientY));
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

        }
        body.data('_dnd_moving', false);
        body.off('mousemove._dnd');
        body.off('mouseup._dnd');
    }
}
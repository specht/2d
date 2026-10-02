class DropdownMenu {
    constructor(element, info) {
        this.element = element;
        this.element.addClass('dropdown_menu');
        this.element.empty();
        this.element.append(this.parse_children(info, 0));
    }
    parse_children(children, level) {
        let div = $(`<div>`);
        for (let entry of children) {
            let label = $(`<div class='item'>`).text(entry.label);
            div.append(label);
            label.css('padding-left', `${(level + 1) * 5}px`);
            if (entry.children) {
                label.addClass('has_submenu');
                let submenu = this.parse_children(entry.children, level + 1);
                submenu.addClass('dropdown_submenu');
                submenu.css('display', 'none');
                div.append(submenu);
                label.click(function(e) {
                    let item = $(e.target).closest('.item');
                    item.parent().find('.has_submenu').removeClass('open');
                    item.parent().find('.dropdown_submenu').slideUp({duration: 200});
                    if (!item.next().is(':visible')) {
                        item.next().slideDown({duration: 200, complete: () => reveal(item, item.next())});
                        item.addClass('open');
                    }
                });
            }
            if (entry.callback) {
                label.click(function(e) {
                    entry.callback();
                });
            }
        }
        return div;
    }
}

// A menu in a box that scrolls (the trait menu): a group opened near the
// bottom would unfold out of sight. Scroll just far enough to show it, but
// never so far that its own label leaves the box.
function reveal(item, submenu) {
    const box = item.closest('.traits-menu')[0];
    if (!box || box.scrollHeight <= box.clientHeight) return;
    const view = box.getBoundingClientRect();
    const label = item[0].getBoundingClientRect();
    const below = submenu[0].getBoundingClientRect().bottom - view.bottom;
    if (below <= 0) return;
    const delta = Math.min(below, label.top - view.top);
    if (delta > 0) box.scrollTo({ top: box.scrollTop + delta, behavior: 'smooth' });
}

function setupDropdownMenu(element, info) {
    let dropdownMenu = new DropdownMenu(element, info);
    return dropdownMenu;
}
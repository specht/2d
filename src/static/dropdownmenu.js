// A list of entries in a panel (Funktionen, Eigenschaft hinzufügen): an entry
// with children opens them as a menu in the style of the right-click menus
// (show_context_menu in widgets.js), with submenus for deeper levels.
class DropdownMenu {
    constructor(element, info) {
        this.element = element;
        this.element.addClass('dropdown_menu');
        this.element.empty();
        this.element.append(this.parse_children(info));
    }

    static menu_entries(children) {
        return children.map(entry => ({
            label: entry.label,
            icon: entry.icon,
            disabled: !entry.callback && !entry.children?.length,
            callback: entry.callback,
            children: entry.children ? DropdownMenu.menu_entries(entry.children) : undefined,
        }));
    }

    parse_children(children) {
        let div = $(`<div>`);
        for (let entry of children) {
            let label = $(`<div class='item'>`).text(entry.label).css('padding-left', '5px');
            div.append(label);
            if (entry.children) {
                label.addClass('has_submenu');
                label.on('mousedown', (e) => { if (label.hasClass('open')) e.stopPropagation(); });
                label.on('click', (e) => {
                    e.stopPropagation();
                    if (label.hasClass('open')) { close_context_menu(); return; }
                    const rect = label[0].getBoundingClientRect();
                    show_context_menu(rect.left, rect.bottom + 2, DropdownMenu.menu_entries(entry.children), { min_width: rect.width });
                    label.addClass('open');
                    $('.context-menu').first().on('remove-menu', () => label.removeClass('open'));
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
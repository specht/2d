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
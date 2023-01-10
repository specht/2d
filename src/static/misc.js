function parse_html_color(color) {
    return parseInt(color.substr(1, 6), 16);
}

function parse_html_color_to_vec4(color) {
    if (color.length === 7) {
        let c = parseInt(color.substr(1, 6), 16);
        let r = (c >> 16) & 0xff;
        let g = (c >> 8) & 0xff;
        let b = (c >> 0) & 0xff;
        return [r / 255.0, g / 255.0, b / 255.0, 1.0];
    } else if (color.length === 9) {
        let c = parseInt(color.substr(1, 8), 16);
        let r = (c >> 24) & 0xff;
        let g = (c >> 16) & 0xff;
        let b = (c >> 8) & 0xff;
        let a = (c >> 0) & 0xff;
        return [r / 255.0, g / 255.0, b / 255.0, a / 255.0];
    }
}


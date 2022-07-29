class Frame {
    constructor() {
        this.src = '';
    }

    loadFromUrl(url, complete) {
        let drawing = new Image();
        let self = this;
        drawing.onload = function () {
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d');
            canvas.width = drawing.width;
            canvas.height = drawing.height;
            context.drawImage(drawing, 0, 0);
            self.src = canvas.toDataURL('image/png');
            if (typeof(complete) !== 'undefined') complete();
        };
        drawing.src = url;
    }
}
class Sprite {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.src = '';
        this.states = [{frames: [{width: 24, height: 24, src: ''}]}];
    }

    loadFromUrl(si, fi, url, complete) {
        let drawing = new Image();
        let self = this;
        drawing.onload = function () {
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d');
            canvas.width = drawing.width;
            canvas.height = drawing.height;
            context.drawImage(drawing, 0, 0);
            self.states[si].frames[fi].width = drawing.width;
            self.states[si].frames[fi].height = drawing.height;
            self.states[si].frames[fi].src = canvas.toDataURL('image/png');
            complete();
        };
        drawing.src = url;
    }
}
class Sprite {
    Sprite() {
        this.width = 0;
        this.height = 0;
        this.src = '';
    }

    loadFromUrl(url, complete) {
        let drawing = new Image();
        let self = this;
        drawing.onload = function () {
            console.log('loaded image!');
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d');
            canvas.width = drawing.width;
            canvas.height = drawing.height;
            context.drawImage(drawing, 0, 0);
            self.width = drawing.width;
            self.height = drawing.height;
            self.src = canvas.toDataURL('image/png');
            complete();
        };
        drawing.src = url;
    }
}
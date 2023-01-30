let shaders = null;

class Shaders {
    constructor() {
        this.files = ['basic.vs', 'texture.fs', 'gradient.fs', 'snow.fs', 'smoke.fs'];
        this.shaders = {};
        shaders = this;
    }

    async load(path) {
        for (let path of this.files) {
            this.shaders[path] = await this.load_shader(path);
        }
    }

    async load_shader(path) {
        return await (await fetch(`/shaders/${path}`)).text();
    }

    get(path) {
        return this.shaders[path];
    }
}
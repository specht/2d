let shaders = null;

class Shaders {
    constructor() {
        this.files = ['basic.vs', 'texture.fs', 'screen.fs', 'gradient.fs',
            'snow.fs', 'smoke.fs', 'fire.fs', 'lightrays.fs'];
        this.shaders = {};
        this.control_points_for_effect = {
            'snow': [[0.5, 0.0], [0.5, -0.1]],
            'smoke': [[0.5, 0.0], [0.5, -0.1]],
            'fire': [[0.5, 0.0], [0.5, -0.1]],
            'lightrays': [[0.5, 0.0], [0.5, -0.1], [0.45, 1.1], [0.55, 1.2]],
        };
        shaders = this;
    }

    async load(path) {
        for (let path of this.files) {
            this.shaders[path] = await this.load_shader(path);
        }
    }

    async load_shader(path) {
        return await (await fetch(`/shaders/${path}?${Math.random()}`)).text();
    }

    get(path) {
        return this.shaders[path];
    }
}
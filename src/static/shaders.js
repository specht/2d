let shaders = null;

class Shaders {
    constructor() {
        this.files = ['basic.vs', 'texture.fs', 'screen.fs', 'gradient.fs',
            'snow.fs', 'smoke.fs', 'fire.fs', 'lightrays.fs',
            'stars.fs', 'aurora.fs', 'rain.fs', 'clouds.fs', 'fireflies.fs', 'bubbles.fs'];
        this.shaders = {};
        this.control_points_for_effect = {
            'snow': [[0.5, 0.0], [0.5, -0.1]],
            'smoke': [[0.5, 0.0], [0.5, -0.1]],
            'fire': [[0.5, 0.0], [0.5, -0.1]],
            'lightrays': [[0.5, 0.0], [0.5, -0.1], [0.45, 1.1], [0.55, 1.2]],
            // bright at the top, fading out towards the horizon
            'stars': [[0.5, 1.0], [0.5, 0.25]],
            // the aurora starts at the first point and fades out towards the second
            'aurora': [[0.5, 0.35], [0.5, 1.0]],
            'rain': [[0.5, 0.0], [0.5, -0.1]],
            'clouds': [[0.5, 0.0], [0.5, -0.1]],
            'fireflies': [[0.5, 0.0], [0.5, -0.1]],
            'bubbles': [[0.5, 0.0], [0.5, -0.1]],
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
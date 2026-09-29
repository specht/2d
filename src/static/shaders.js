let shaders = null;

class Shaders {
    constructor() {
        this.files = ['basic.vs', 'texture.fs', 'screen.fs', 'gradient.fs',
            'snow.fs', 'smoke.fs', 'fire.fs', 'lightrays.fs',
            'stars.fs', 'aurora.fs', 'rain.fs', 'clouds.fs', 'fireflies.fs', 'bubbles.fs', 'dust.fs'];
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
            // Staubwirbel: the eye of the whirl, and a point on its edge
            'dust': [[0.5, 0.5], [0.85, 0.5]],
        };
        shaders = this;
    }

    // All shaders at once: one after another cost one round trip each
    // (15 shaders × ~1 s on a busy school network).
    async load() {
        const sources = await Promise.all(this.files.map(path => this.load_shader(path)));
        this.files.forEach((path, i) => { this.shaders[path] = sources[i]; });
    }

    async load_shader(path) {
        // the server's version: cached until the next update (see config.rb)
        return await (await fetch(`/shaders/${path}?${window.CACHE_BUSTER || Math.random()}`)).text();
    }

    get(path) {
        return this.shaders[path];
    }
}
// Backdrop layers ("Hintergrund"): colour gradients and shader effects.
// Shared by the game (app.js) and the level editor (level_editor.js).
//
// Optional per-layer settings (absent in old games = exactly the old look):
//   pixelated: true          the shader runs at the game's resolution, one
//                            colour per game pixel – like the sprites
//   dither: 'noise'|'bayer'  colour gradients only: reduce the gradient to a
//   dither_levels: 8         few colour steps and dither between them
//                            (always on the game-pixel grid)

const BACKDROP_EFFECTS = {
    snow: 'Schnee',
    rain: 'Regen',
    smoke: 'Rauch',
    fire: 'Feuer',
    lightrays: 'Lichtstrahlen',
    stars: 'Sternenhimmel',
    aurora: 'Nordlicht',
    clouds: 'Wolken',
    fireflies: 'Glühwürmchen',
    bubbles: 'Blasen',
    dust: 'Schwebestaub',
    lightning: 'Gewitter',
};

// Blend modes ("Mischmodus") for sprites, sprite layers and backdrop layers.
// Absent or 'normal' = ordinary transparency, exactly as before.
//   add       Leuchten   colours are added: light, fire, glowing things
//   screen    Aufhellen  like add, but never brighter than white: ghosts, mist
//   multiply  Abdunkeln  colours are multiplied: shadows, tinted glass, water
const BLEND_MODES = { normal: 'Normal', add: 'Leuchten', screen: 'Aufhellen', multiply: 'Abdunkeln' };

function blend_mode_of(value) {
    return value && value !== 'normal' && value in BLEND_MODES ? value : null;
}

// The blend factors below expect premultiplied colour (rgb × alpha). Wrap the
// shader's main() instead of editing every shader.
function premultiplied_shader(source) {
    if (source.includes('void blend_main()')) return source;
    return source.replace(/void\s+main\s*\(\s*(?:void)?\s*\)/, 'void blend_main()') +
        '\nvoid main() {\n    blend_main();\n    gl_FragColor.rgb *= gl_FragColor.a;\n}\n';
}

// Turns a (fresh or cloned) ShaderMaterial into one with the given blend mode.
function apply_blend_mode(material, mode) {
    mode = blend_mode_of(mode);
    if (!mode || !material?.fragmentShader) return material;
    const f = {
        add: [THREE.OneFactor, THREE.OneFactor],
        screen: [THREE.OneFactor, THREE.OneMinusSrcColorFactor],
        multiply: [THREE.DstColorFactor, THREE.OneMinusSrcAlphaFactor],
    }[mode];
    material.blending = THREE.CustomBlending;
    material.blendEquation = THREE.AddEquation;
    material.blendSrc = f[0];
    material.blendDst = f[1];
    // keep the alpha of what is already there
    material.blendEquationAlpha = THREE.AddEquation;
    material.blendSrcAlpha = THREE.ZeroFactor;
    material.blendDstAlpha = THREE.OneFactor;
    material.depthWrite = false;
    material.fragmentShader = premultiplied_shader(material.fragmentShader);
    material.userData.blend = mode;
    material.needsUpdate = true;
    return material;
}

// A copy of a sprite material with another blend mode (the texture is shared).
function blended_copy(base, mode) {
    const material = base.clone();
    if (base.uniforms?.texture1) material.uniforms.texture1.value = base.uniforms.texture1.value;
    return apply_blend_mode(material, mode);
}

// Settings of single effects, saved on the layer (absent = the default).
// `uniform`: the name in the effect's shader.
const BACKDROP_EFFECT_OPTIONS = {
    lightning: {
        lightning_interval: {
            label: 'Blitz alle', suffix: 's', min: 0.5, max: 60, step: 0.5, decimalPlaces: 1, default: 5, uniform: 'interval',
            hint: 'So viele Sekunden liegen ungefähr zwischen zwei Blitzen. Mit Geschwindigkeit 2 blitzt es doppelt so oft.',
        },
        lightning_glow: {
            label: 'Himmel leuchtet', min: 0, max: 1, step: 0.05, decimalPlaces: 2, default: 0.6, uniform: 'glow',
            hint: 'Wie hell der ganze Himmel beim Blitz aufleuchtet: 0 = nur der Blitz selbst, 1 = sehr hell. Liegt die Ebene hinter Bäumen und Häusern, leuchten ihre Umrisse kurz auf.',
        },
        lightning_bolts: {
            type: 'bool', label: 'Blitze zeigen', default: true, uniform: 'bolts',
            hint: 'Ohne Häkchen sieht man keine Blitze, nur der Himmel flackert – wie Wetterleuchten in der Ferne.',
        },
    },
};

function backdrop_effect_option(backdrop, key) {
    const option = BACKDROP_EFFECT_OPTIONS[backdrop?.effect]?.[key];
    if (!option) return undefined;
    const v = backdrop[key];
    if (option.type === 'bool') return typeof v === 'boolean' ? v : option.default;
    const n = Number(v);
    return Number.isFinite(n) && v !== null && v !== undefined ? Math.min(option.max, Math.max(option.min, n)) : option.default;
}

// Effects with a "Menge" setting (backdrop.density, 1 = normal).
const BACKDROP_DENSITY_EFFECTS = ['snow', 'rain', 'dust'];
const BACKDROP_DENSITY = { min: 0.1, max: 3, default: 1 };

function backdrop_density(backdrop) {
    const d = Number(backdrop?.density);
    if (!Number.isFinite(d)) return BACKDROP_DENSITY.default;
    return Math.min(BACKDROP_DENSITY.max, Math.max(BACKDROP_DENSITY.min, d));
}

const BACKDROP_DITHER = { none: 'aus', noise: 'Rauschen', bayer: 'Raster' };
const BACKDROP_DITHER_LEVELS = { min: 2, max: 32, default: 8 };

function backdrop_dither_mode(backdrop) {
    return { noise: 1, bayer: 2 }[backdrop?.dither] ?? 0;
}

function backdrop_dither_levels(backdrop) {
    const n = Math.round(Number(backdrop?.dither_levels));
    if (!Number.isFinite(n)) return BACKDROP_DITHER_LEVELS.default;
    return Math.min(BACKDROP_DITHER_LEVELS.max, Math.max(BACKDROP_DITHER_LEVELS.min, n));
}

// Game pixels per shader pixel: 0 = smooth (as before), 1 = game resolution.
function backdrop_pixel_size(backdrop) {
    if (backdrop?.backdrop_type === 'color' && backdrop_dither_mode(backdrop)) return 1.0;
    return backdrop?.pixelated ? 1.0 : 0.0;
}

// Every backdrop shader reads the world position from `vuv`. For the pixel
// grid, `vuv` is replaced by the centre of the game pixel it falls into – for
// all shaders at once, without touching each shader's own code.
const backdrop_shader_cache = {};
function backdrop_fragment_shader(source) {
    if (backdrop_shader_cache[source]) return backdrop_shader_cache[source];
    let result = source.replace(/varying\s+(?:(?:highp|mediump|lowp)\s+)?vec2\s+vuv\s*;/,
        (m) => `${m}\nuniform float pixel_size;\nvec2 vuv_grid;\n#define vuv vuv_grid\n`);
    if (result !== source) {
        result = result.replace(/void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/, (m) => `${m}\n#undef vuv\n` +
            `    vuv_grid = pixel_size > 0.0 ? (floor(vuv / pixel_size) + 0.5) * pixel_size : vuv;\n#define vuv vuv_grid\n`);
    }
    backdrop_shader_cache[source] = result;
    return result;
}

// World coordinates as texture coordinates: shaders work in game pixels.
function set_backdrop_uv(geometry, rect) {
    const x0 = rect.left, y0 = rect.bottom;
    const x1 = rect.left + rect.width, y1 = rect.bottom + rect.height;
    const uv = geometry.attributes.uv;
    uv.setXY(0, x0, y1);
    uv.setXY(1, x1, y1);
    uv.setXY(2, x0, y0);
    uv.setXY(3, x1, y0);
}

// Material for one rectangle of a backdrop layer. `fill_default_points`: the
// editor shows the default control points of an effect when none were moved yet
// (the game has always used the saved points only – kept as it was).
function backdrop_material(backdrop, rect0, options = {}) {
    const material = backdrop_material_plain(backdrop, rect0, options);
    const mode = blend_mode_of(backdrop.properties?.blend);
    if (mode && material.isShaderMaterial) apply_blend_mode(material, mode);
    if (options.stencil_ref && (backdrop.rects?.length ?? 0) > 1) union_of_rects(material, options.stencil_ref);
    return material;
}

// Several rectangles of one layer are one area: where they overlap, the effect
// (half transparent snow, a tint …) must not be drawn twice. Every rectangle
// marks its pixels in the stencil buffer with the layer's number and skips
// pixels that are already marked. ref: 1 … 255, different for every layer.
function union_of_rects(material, ref) {
    material.stencilWrite = true;
    material.stencilRef = ref;
    material.stencilFunc = THREE.NotEqualStencilFunc;
    material.stencilFuncMask = 0xff;
    material.stencilWriteMask = 0xff;
    material.stencilFail = THREE.KeepStencilOp;
    material.stencilZFail = THREE.KeepStencilOp;
    material.stencilZPass = THREE.ReplaceStencilOp;
    return material;
}

// The stencil number of a layer (by its index in the level).
function backdrop_stencil_ref(layer_index) {
    return (layer_index % 255) + 1;
}

function backdrop_material_plain(backdrop, rect0, { fill_default_points = false, scale_as_array = false } = {}) {
    const pixel = { pixel_size: { value: backdrop_pixel_size(backdrop) } };
    if (backdrop.backdrop_type === 'effect') {
        const gradient_points = JSON.parse(JSON.stringify(backdrop.control_points ?? []));
        const uniforms = {
            time: { value: 0 },
            resolution: { value: [rect0.width, rect0.height] },
            scale: { value: scale_as_array ? [backdrop.scale] : backdrop.scale },
            color: { value: parse_html_color_to_vec4(backdrop.color) },
            // Menge (snow, rain): absent = 1 = the old amount
            density: { value: backdrop_density(backdrop) },
            ...pixel,
        };
        for (const [key, option] of Object.entries(BACKDROP_EFFECT_OPTIONS[backdrop.effect] ?? {})) {
            const v = backdrop_effect_option(backdrop, key);
            uniforms[option.uniform] = { value: option.type === 'bool' ? (v ? 1.0 : 0.0) : v };
        }
        const defaults = shaders.control_points_for_effect[backdrop.effect] ?? [];
        const count = fill_default_points ? defaults.length : gradient_points.length;
        for (let gi = 0; gi < count; gi++) {
            if (fill_default_points) gradient_points[gi] ??= JSON.parse(JSON.stringify(defaults[gi]));
            const p = gradient_points[gi];
            if (!p) continue;
            uniforms[`cp${String.fromCharCode(97 + gi)}`] = {
                value: [rect0.width * p[0] + rect0.left, rect0.height * p[1] + rect0.bottom],
            };
        }
        return new THREE.ShaderMaterial({
            uniforms,
            transparent: true,
            vertexShader: shaders.get('basic.vs'),
            fragmentShader: backdrop_fragment_shader(shaders.get(backdrop.effect + '.fs')),
            side: THREE.DoubleSide,
        });
    }
    if (backdrop.backdrop_type === 'color') {
        const gradient_points = JSON.parse(JSON.stringify(backdrop.colors));
        for (const p of gradient_points) {
            p[1] = rect0.width * p[1] + rect0.left;
            p[2] = rect0.height * p[2] + rect0.bottom;
        }
        let uniforms = {};
        const c = (i) => ({ value: parse_html_color_to_vec4(gradient_points[i][0]) });
        const p = (i) => ({ value: [gradient_points[i][1], gradient_points[i][2]] });
        if (gradient_points.length === 1) {
            uniforms = { n: { value: 1 }, ca: c(0) };
        } else if (gradient_points.length === 2) {
            const d = [gradient_points[1][1] - gradient_points[0][1], gradient_points[1][2] - gradient_points[0][2]];
            const l = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
            const l1 = 1.0 / l;
            d[0] *= l1; d[1] *= l1;
            uniforms = {
                n: { value: 2 }, ca: c(0), cb: c(1), pa: p(0), pb: p(1),
                na: { value: [d[0], d[1]] }, nb: { value: [-d[0], -d[1]] },
                la: { value: l }, lb: { value: l },
            };
        } else if (gradient_points.length === 4) {
            uniforms = { n: { value: 4 }, ca: c(0), cb: c(1), cc: c(2), cd: c(3), pa: p(0), pb: p(1), pc: p(2), pd: p(3) };
        }
        uniforms = {
            ...uniforms, ...pixel,
            dither_mode: { value: backdrop_dither_mode(backdrop) },
            dither_levels: { value: backdrop_dither_levels(backdrop) },
        };
        return new THREE.ShaderMaterial({
            uniforms,
            transparent: true,
            vertexShader: shaders.get('basic.vs'),
            fragmentShader: backdrop_fragment_shader(shaders.get('gradient.fs')),
            side: THREE.DoubleSide,
        });
    }
    const material = new THREE.LineBasicMaterial({ transparent: true });
    material.opacity = 0;
    return material;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BACKDROP_EFFECTS, BACKDROP_EFFECT_OPTIONS, backdrop_effect_option, BACKDROP_DITHER, BLEND_MODES, BACKDROP_DENSITY_EFFECTS, BACKDROP_DENSITY, backdrop_density,
        blend_mode_of, premultiplied_shader, backdrop_stencil_ref, BACKDROP_DITHER_LEVELS,
        backdrop_dither_mode, backdrop_dither_levels, backdrop_pixel_size, backdrop_fragment_shader,
    };
}

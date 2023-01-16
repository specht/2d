let SIMULATION_RATE = 60;
let KEY_UP = 'up';
let KEY_DOWN = 'down';
let KEY_LEFT = 'left';
let KEY_RIGHT = 'right';
let KEY_JUMP = 'jump';
window.yt_player = null;

class Character {
	constructor(game, sprite, mesh) {
		this.game = game;
		this.sprite = sprite;
		this.mesh = mesh;
		this.traits = {};
		this.follow_camera = false;
		if ('actor' in this.sprite.traits) {
			this.traits = this.sprite.traits.actor;
			this.follow_camera = true;
		}
		console.log(`character`, this.sprite, this.mesh);
		this.vy = 0;
	}

	has_trait_at(trait_or_traits, dx0, dx1, dy0, dy1) {
		if (typeof(trait_or_traits) === 'string')
			trait_or_traits = [trait_or_traits];
		let x0 = this.mesh.position.x + dx0;
		let x1 = this.mesh.position.x + dx1;
		let y0 = this.mesh.position.y + dy0;
		let y1 = this.mesh.position.y + dy1;

		let result_x = new Set();
		for (let i of this.game.interval_tree_x.search([x0, x1]))
			result_x.add(i);
		let result_y = new Set();
		for (let i of this.game.interval_tree_y.search([y0, y1]))
			result_y.add(i);
		let result = [...new Set([...result_x].filter((x) => result_y.has(x)))];
		for (let entry_index of result) {
			let entry = this.game.active_level_sprites[entry_index];
			let sprite = this.game.data.sprites[entry.sprite_index];
			for (let trait of trait_or_traits)
				if (trait in sprite.traits)
					return entry;
		}
		return null;
	}

	simulation_step() {

		// if we're standing, we can jump
		if (this.has_trait_at(['block_above', 'ladder'], -0.5, 0.5, -0.1, 0)) {
			this.vy = 0;
			if (this.game.pressed_keys[KEY_JUMP])
				this.vy = this.traits.vjump;
		}

		// move left / right
		if (this.game.pressed_keys[KEY_RIGHT])
			this.mesh.position.x += this.traits.vrun;
		if (this.game.pressed_keys[KEY_LEFT])
			this.mesh.position.x -= this.traits.vrun;

		if (this.has_trait_at('ladder', -0.5, 0.5, 0, 1.0)) {
			if (this.game.pressed_keys[KEY_UP]) {
				this.mesh.position.y += this.traits.vrun;
				while (!this.has_trait_at('ladder', -0.5, 0.5, 0.0, 1.0)) {
					this.mesh.position.y -= 1;
				}
			}
			if (this.game.pressed_keys[KEY_DOWN])
				this.mesh.position.y -= this.traits.vrun;
			if (this.vy > 0)
				this.mesh.position.y += this.vy;
		} else {
			this.mesh.position.y += this.vy;
		}

		// decrease y velocity because of gravity
		if (!this.has_trait_at(['block_above', 'ladder'], -0.5, 0.5, -1.0, 0.0)) {
			this.vy -= this.game.data.properties.gravity;
			if (this.vy < -10)
				this.vy = -10;
		}

		let ppu = this.traits.ex_top;
		let ppl = this.traits.ex_left;
		let ppr = this.traits.ex_right;

		let entry = this.has_trait_at('block_above', -0.5, 0.5, 0.1, 1.1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			this.mesh.position.y = entry.mesh.position.y + this.sprite.height;
		}

		if (this.vy > 0) {
			entry = this.has_trait_at('block_below', -0.5, 0.5,
				this.sprite.height * ppu + 0.1,
				this.sprite.height * ppu + 1.1);
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				this.mesh.position.y = entry.mesh.position.y - this.sprite.height * ppu;
				this.vy = 0;
			}
		}

		entry = this.has_trait_at('block_sides',
			this.sprite.width * 0.5 * ppr - 1,
			this.sprite.width * 0.5 * ppr,
			0.5, this.sprite.height - 1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			this.mesh.position.x = entry.mesh.position.x - sprite.width * 0.5 - this.sprite.width * 0.5 * ppr;
		}

		entry = this.has_trait_at('block_sides',
			-this.sprite.width * 0.5 * ppl,
			-this.sprite.width * 0.5 * ppl + 1,
			0.5, this.sprite.height - 1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			this.mesh.position.x = entry.mesh.position.x + sprite.width * 0.5 + this.sprite.width * 0.5 * ppl;
		}

		if (this.follow_camera) {
			let scale = this.game.height / this.game.screen_pixel_height;
			let safe_zone_x0 = this.mesh.position.x - (this.game.width / 2 / scale) * this.game.screen_safe_zone_x;
			let safe_zone_x1 = this.mesh.position.x + (this.game.width / 2 / scale) * this.game.screen_safe_zone_x;
			let safe_zone_y0 = this.mesh.position.y - (this.game.height / 2 / scale) * this.game.screen_safe_zone_y;
			let safe_zone_y1 = this.mesh.position.y + (this.game.height / 2 / scale) * this.game.screen_safe_zone_y;
			if (this.game.camera_x < safe_zone_x0) this.game.camera_x = safe_zone_x0;
			if (this.game.camera_x > safe_zone_x1) this.game.camera_x = safe_zone_x1;
			if (this.game.camera_y < safe_zone_y0) this.game.camera_y = safe_zone_y0;
			if (this.game.camera_y > safe_zone_y1) this.game.camera_y = safe_zone_y1;
		}
	}
}

class Game {
	constructor() {
		let self = this;
		this.data = null;
		this.spritesheet_info = null;
		this.spritesheets = null;
		// a mesh for every sprite (not regarding state or frame)
		this.mesh_catalogue = [];
		this.running = false;
		this.level_index = 0;
		this.layers = [];
		this.meshes_for_sprite = [];
		this.animated_sprites = [];
		this.interval_tree_x = new IntervalTree();
        this.interval_tree_y = new IntervalTree();
		this.active_level_sprites = [];
		this.reset();
		window.addEventListener('resize', () => {
			self.handle_resize();
		});
		window.addEventListener('keydown', (e) => {
			this.handle_key_down(e.code)
		});
		window.addEventListener('keyup', (e) => {
			this.handle_key_up(e.code)
		});
		window.addEventListener('touchstart', (e) => {
			$('#touch_controls').show();
		});

		new TouchControl({
			element: $('#touch_controls'),
			game: self,
			radius: '20vh',
			css: {
				left: '10vh',
				bottom: '10vh',
			},
		});
		new TouchButton({
			element: $('#touch_controls'),
			game: self,
			radius: '20vh',
			css: {
				right: '10vh',
				bottom: '10vh',
			},
		});
	}

	async load(tag) {
		// load game json
		this.reset();
		if (window.yt_player !== null) {
			window.yt_player.pauseVideo();
		}

		this.data = await (await fetch(`/gen/games/${tag}.json`)).json();
		this.spritesheet_info = await (await fetch(`/gen/spritesheets/${tag}.json`)).json();
		this.spritesheets = [];
		for (let i = 0; i < this.spritesheet_info.spritesheets.length; i++) {
			console.log(this.spritesheet_info.spritesheets[i]);
			let blob = await(await fetch(`/gen/spritesheets/${this.spritesheet_info.spritesheets[i]}`)).blob();
			let texture = new THREE.Texture();
			texture.image = await createImageBitmap(blob);
			// texture.magFilter = THREE.NearestFilter;
			texture.needsUpdate = true;
			let material = new THREE.ShaderMaterial({
				uniforms: {
					texture1: { value: texture },
				},
				transparent: true,
				vertexShader: document.getElementById('vertex-shader').textContent,
				fragmentShader: document.getElementById('fragment-shader').textContent,
				side: THREE.DoubleSide,
			});
			this.spritesheets.push(material);
		}
		console.log(this);

		$('#game_title').text(this.data.properties.title);
		$('#game_author').text(this.data.properties.author);
		this.setup();
		// if (window.location.host.substring(0, 9) === 'localhost') {
		// 	this.run();
		// 	// $('#touch_controls').show();
		// }
	}

	stop() {
		if (window.yt_player !== null) {
			window.yt_player.pauseVideo();
		}
	}

	setup() {
		this.running = false;
        this.clock = new THREE.Clock(true);
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
        this.camera.position.x = 0;
        this.camera.position.z = 10;
        this.camera.position.y = 0;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor("#000");
		this.camera_x = 0.0;
		this.camera_y = 0.0;
		this.screen_pixel_height = 240;
		this.screen_safe_zone_x = 0.4;
		this.screen_safe_zone_y = 0.4;
		this.animated_sprites = [];
		this.meshes_for_sprite = [];
		this.player_character = null;

		this.minx = 0;
		this.miny = 0;
		this.maxx = 0;
		this.maxy = 0;
		this.pressed_keys = {};
		this.simulated_to = 0;

		this.interval_tree_x.clear();
		this.interval_tree_y.clear();
		this.active_level_sprites = [];

		$('#screen').empty();
		$('#screen').append(this.renderer.domElement);
		this.mesh_catalogue = [];
		this.layers = [];

		if (this.data === null)
			return;

		this.screen_pixel_height = this.data.properties.screen_pixel_height;

		let tw = this.spritesheet_info.width;
		let th = this.spritesheet_info.height;
		for (let si = 0; si < this.data.sprites.length; si++) {
			let sprite = this.data.sprites[si];
			let geometry = new THREE.PlaneGeometry(sprite.width, sprite.height);
			geometry.translate(0, sprite.height / 2, 0);
			let tile_info = this.spritesheet_info.tiles[si][0][0];
			let mesh = new THREE.Mesh(geometry, this.spritesheets[tile_info[0]]);
			// mesh.scale.x *= -1;
			let uv = geometry.attributes.uv;
			uv.setXY(0, tile_info[1] / tw, tile_info[2] / th);
			uv.setXY(1, (tile_info[1] + sprite.width * 4) / tw, tile_info[2] / th);
			uv.setXY(2, tile_info[1] / tw, (tile_info[2] + sprite.height * 4) / th);
			uv.setXY(3, (tile_info[1] + sprite.width * 4) / tw, (tile_info[2] + sprite.height * 4) / th);
			this.mesh_catalogue.push(mesh);
			this.meshes_for_sprite.push([]);
			if (sprite.states[0].frames.length > 1)
				this.animated_sprites.push(si);
		}

		if (this.level_index >= this.data.levels.length)
			return;

		this.scene.background = new THREE.Color(parse_html_color(this.data.levels[this.level_index].properties.background_color));

		let level = this.data.levels[this.level_index];
		this.minx = 0;
		this.maxx = 0;
		this.miny = 0;
		this.maxy = 0;
		for (let li = 0; li < level.layers.length; li++) {
			let game_layer = new THREE.Group();
			let layer = level.layers[li];
			if (layer.type === 'sprites') {
				for (let spi = 0; spi < layer.sprites.length; spi++) {
					let placed = layer.sprites[spi];
					let mesh = this.mesh_catalogue[placed[0]].clone();
					let sprite = this.data.sprites[placed[0]];
					let effective_collision_detection = layer.properties.collision_detection && (Math.abs(layer.properties.parallax) < 0.0001);
					if (effective_collision_detection) {
						let x = placed[1];
						let y = placed[2];
						let x0 = x - sprite.width / 2;
						let x1 = x + sprite.width / 2;
						let y0 = y;
						let y1 = y + sprite.height;
						if (x0 < this.minx) this.minx = x0;
						if (x1 > this.maxx) this.maxx = x1;
						if (y0 < this.miny) this.miny = y0;
						if (y1 > this.maxy) this.maxy = y1;
						if (!('actor' in sprite.traits))
						{
							this.interval_tree_x.insert([x0, x1], this.active_level_sprites.length);
							this.interval_tree_y.insert([y0, y1], this.active_level_sprites.length);
							this.active_level_sprites.push({layer_index: li, sprite_index: placed[0], mesh: mesh});
						}
					}
					if ('actor' in sprite.traits)
					{
						console.log(sprite.traits);
						this.player_character = new Character(this, sprite, mesh);
						this.camera_x = placed[1];
						this.camera_y = placed[2] + this.data.properties.screen_pixel_height * 0.3;
					}
					mesh.position.set(placed[1], placed[2], 0);
					this.meshes_for_sprite[placed[0]].push(mesh);
					game_layer.add(mesh);
				}
			} else if (layer.type === 'backdrop') {
				let backdrop = layer;
				let geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
				geometry.translate(0.5, 0.5, 0.0);
				geometry.scale(backdrop.width, backdrop.height, 1.0);
				geometry.translate(backdrop.left, backdrop.bottom, 0);
				// geometry.translate(0, 0, -1);
				let gradient_points = backdrop.colors;
				let uniforms = {};
				if (gradient_points.length === 1) {
					uniforms = {
						n:  { value: 1 },
						ca: { value: parse_html_color_to_vec4(gradient_points[0][0]) },
					};
				} else if (gradient_points.length === 2) {
					let d = [gradient_points[1][1] - gradient_points[0][1], gradient_points[1][2] - gradient_points[0][2]];
					let l = Math.sqrt(d[0] * d[0] + d[1] * d[1]);
					let l1 = 1.0 / l;
					d[0] *= l1; d[1] *= l1;
					uniforms = {
						n:  { value: 2 },
						ca: { value: parse_html_color_to_vec4(gradient_points[0][0]) },
						cb: { value: parse_html_color_to_vec4(gradient_points[1][0]) },
						pa: { value: [gradient_points[0][1], gradient_points[0][2]] },
						pb: { value: [gradient_points[1][1], gradient_points[1][2]] },
						na: { value: [d[0], d[1]] },
						nb: { value: [-d[0], -d[1]] },
						la: { value: l },
						lb: { value: l },
					};
				} else if (gradient_points.length === 4) {
					uniforms = {
						n:  { value: 4 },
						ca: { value: parse_html_color_to_vec4(gradient_points[0][0]) },
						cb: { value: parse_html_color_to_vec4(gradient_points[1][0]) },
						cc: { value: parse_html_color_to_vec4(gradient_points[2][0]) },
						cd: { value: parse_html_color_to_vec4(gradient_points[3][0]) },
						pa: { value: [gradient_points[0][1], gradient_points[0][2]] },
						pb: { value: [gradient_points[1][1], gradient_points[1][2]] },
						pc: { value: [gradient_points[2][1], gradient_points[2][2]] },
						pd: { value: [gradient_points[3][1], gradient_points[3][2]] },
					};
				}
				let material = new THREE.ShaderMaterial({
					uniforms: uniforms,
					transparent: true,
					vertexShader: document.getElementById('vertex-shader').textContent,
					fragmentShader: document.getElementById('fragment-shader-gradient').textContent,
					side: THREE.DoubleSide,
				});
				let mesh = new THREE.Mesh(geometry, material);
				game_layer.add(mesh);
			}
			this.layers.push(game_layer);
		}
		// console.log(this.minx, this.maxx, this.miny, this.maxy);

		for (let i = this.layers.length - 1; i >= 0; i--)
			this.scene.add(this.layers[i]);

		// let material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        // let points = [];
        // points.push(new THREE.Vector3(0, 24, 2));
        // points.push(new THREE.Vector3(0, 0, 2));
        // points.push(new THREE.Vector3(24, 0, 2));
        // let geometry = new THREE.BufferGeometry().setFromPoints(points);
        // let line = new THREE.Line(geometry, material);
        // this.scene.add(line);

	}

	parse_yt_timestamp(s) {
		let t = 0;
		if (typeof(s) === 'undefined' || s === null)
			return 0;
		if (/^\d+h\d+m\d+(\.\d+)?s$/.test(s)) {
			let parts = s.split(/[hms]/);
			t = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
		} else if (/^\d+m\d+(\.\d+)?s$/.test(s)) {
			let parts = s.split(/[ms]/);
			t = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
		} else if (/^\d+(\.\d+)?s$/.test(s)) {
			let parts = s.split(/[s]/);
			t = parseFloat(parts[0]);
		} else if (/^\d+(\.\d+)?$/.test(s)) {
			t = parseFloat(s);
		}
		return t;
	}

	run() {
		if (window.yt_player !== null) {
			window.yt_player.pauseVideo();
			let yt_tag = null;
			if ((window.game.data.properties.yt_tag ?? '').length > 0)
				yt_tag = window.game.data.properties.yt_tag;
			if ((window.game.data.levels[0].properties.yt_tag ?? '').length > 0)
				yt_tag = window.game.data.levels[0].properties.yt_tag;
			if (yt_tag !== null) {
				let parts = yt_tag.split('#');
				let s = this.parse_yt_timestamp(parts[1]);
				window.yt_player.loadVideoById(parts[0], s);
			}
		}
		if (this.running) return;
		this.running = true;
		$('#overlay').fadeOut();
		$('#screen').fadeIn();

		requestAnimationFrame((t) => this.render());
	}

	stop() {
		if (!this.running) return;
		this.running = false;
		$('#overlay').fadeIn();
		$('#screen').fadeOut();
	}

	render() {
		this.simulate();
		let scale = this.height / this.screen_pixel_height;

		for (let si of this.animated_sprites) {
			let sprite = this.data.sprites[si];
			let sti = 0;
			let fps = sprite.states[sti].properties.fps ?? 8;
			let fi = Math.floor(this.clock.getElapsedTime() * fps) % sprite.states[sti].frames.length;
			for (let mesh of this.meshes_for_sprite[si]) {
				let uv = mesh.geometry.attributes.uv;
				let tw = this.spritesheet_info.width;
				let th = this.spritesheet_info.height;
				let tile_info = this.spritesheet_info.tiles[si][0][fi];
				uv.setXY(0, tile_info[1] / tw, tile_info[2] / th);
				uv.setXY(1, (tile_info[1] + sprite.width * 4) / tw, tile_info[2] / th);
				uv.setXY(2, tile_info[1] / tw, (tile_info[2] + sprite.height * 4) / th);
				uv.setXY(3, (tile_info[1] + sprite.width * 4) / tw, (tile_info[2] + sprite.height * 4) / th);
				uv.needsUpdate = true;
			}
		}

        this.camera.left = this.camera_x - this.width * 0.5 / scale;
        this.camera.right = this.camera_x + this.width * 0.5 / scale;
        this.camera.top = this.camera_y + this.height * 0.5 / scale;
        this.camera.bottom = this.camera_y - this.height * 0.5 / scale;

		// fix camera
		if (this.maxx - this.minx > this.screen_pixel_height * 16.0 / 9) {
			if (this.camera.left < this.minx)
				this.camera_x += (this.minx - this.camera.left);
			if (this.camera.right > this.maxx)
				this.camera_x += (this.maxx - this.camera.right);
		} else {
			this.camera_x = (this.minx + this.maxx) * 0.5;
		}
		if (this.maxy - this.miny > this.screen_pixel_height) {
			if (this.camera.bottom < this.miny)
				this.camera_y += (this.miny - this.camera.bottom);
			// if (this.camera.top > this.maxy)
			// 	this.camera_y += (this.maxy - this.camera.top);
		} else {
			this.camera_y = (this.miny + this.maxy) * 0.5;
		}

		this.camera.left = this.camera_x - this.width * 0.5 / scale;
		this.camera.right = this.camera_x + this.width * 0.5 / scale;
		this.camera.top = this.camera_y + this.height * 0.5 / scale;
		this.camera.bottom = this.camera_y - this.height * 0.5 / scale;

		for (let i = 0; i < this.layers.length; i++) {
			this.layers[i].position.x = this.camera_x * this.data.levels[this.level_index].layers[i].properties.parallax;
			this.layers[i].position.y = this.camera_y * this.data.levels[this.level_index].layers[i].properties.parallax;
		}

		this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.renderer.sortObjects = false;
        this.renderer.render(this.scene, this.camera);
		if (this.running)
	        requestAnimationFrame((t) => this.render());
    }

	reset() {
		this.handle_resize();
		this.stop();
		$('#overlay').show();
		$('#screen').hide();
		this.setup();
	}

	handle_resize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		if (this.height * 16.0/9 < this.width)
			$('.play_container_inner').css('width', '').css('height', '100%');
		else
			$('.play_container_inner').css('height', '').css('width', '100%');
		$('body').css('font-size', `${this.height / 30}px`);
	}

	handle_key_down(key) {
		if (key === 'ArrowLeft')
			this.pressed_keys[KEY_LEFT] = true;
		if (key === 'ArrowRight')
			this.pressed_keys[KEY_RIGHT] = true;
		if (key === 'ArrowUp')
			this.pressed_keys[KEY_UP] = true;
		if (key === 'ArrowDown')
			this.pressed_keys[KEY_DOWN] = true;
		if (key === 'Space')
			this.pressed_keys[KEY_JUMP] = true;
	}

	handle_key_up(key) {
		if (key === 'ArrowLeft')
			this.pressed_keys[KEY_LEFT] = false;
		if (key === 'ArrowRight')
			this.pressed_keys[KEY_RIGHT] = false;
		if (key === 'ArrowUp')
			this.pressed_keys[KEY_UP] = false;
		if (key === 'ArrowDown')
			this.pressed_keys[KEY_DOWN] = false;
		if (key === 'Space')
			this.pressed_keys[KEY_JUMP] = false;
	}

	// handle simulation at fixed rate
	simulation_step() {
		if (this.player_character !== null)
			this.player_character.simulation_step();
	}

	simulate() {
		let simulate_to = Math.floor(this.clock.getElapsedTime() * 60.0);
		while (this.simulated_to < simulate_to) {
			this.simulation_step();
			this.simulated_to++;
		}
	}
};

class TouchControl {
    constructor(options) {
        this.options = options;
        this.bg_element = $('<div>');
        this.bg_element.css('position', 'absolute').css('width', options.radius).css('height', options.radius).css('border-radius', options.radius);
        this.bg_element.css('background-color', 'rgba(0,0,0,0.5)');
        this.bg_element.css('border', '2px solid #444');
        this.bg_element.css(options.css);
		this.fg_element = $('<div>');
        this.fg_element.css('position', 'absolute').css('width', options.radius).css('height', options.radius).css('border-radius', options.radius);
        // this.fg_element.css('border', '1px solid green');
		this.fg_element.css('left', '50%');
		this.fg_element.css('top', '50%');
		this.fg_element.css('transform', 'translate(-50%, -50%) scale(0.7) translate(0px, 0px)');
        this.fg_element.css('background-color', 'rgba(255,255,255,0.5)');
		this.fg_element.css('border', '3px solid #fff');
		this.bg_element.append(this.fg_element);
        options.element.append(this.bg_element);
		let self = this;
		this.bg_element.on('touchstart', function(e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchmove', function(e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchend touchcancel', function(e) {
			self.fg_element.css('transform', `translate(-50%, -50%) scale(0.7) translate(0px, 0px)`);
			self.options.game.pressed_keys[KEY_RIGHT] = false;
			self.options.game.pressed_keys[KEY_LEFT] = false;
			self.options.game.pressed_keys[KEY_UP] = false;
			self.options.game.pressed_keys[KEY_DOWN] = false;
		});
    }

	handle_touch(e) {
		let self = this;
		let touch = e.touches[0];
		let width = self.bg_element.width();
		let height = self.bg_element.height();
		let dx = (touch.clientX - self.bg_element.position().left - width / 2) / (width / 2);
		let dy = (touch.clientY - self.bg_element.position().top - height / 2) / (height / 2);
		let r = Math.sqrt(dx * dx + dy * dy);
		let fr = r;
		if (fr > 1.0)
			fr = 1.0;
		dx *= fr / r;
		dy *= fr / r;
		let phi = Math.atan2(dy, dx) / Math.PI * 180;
		self.fg_element.css('transform', `translate(-50%, -50%) scale(0.7) translate(${dx * (width / 2)}px, ${dy * (height / 2)}px)`);
		self.options.game.pressed_keys[KEY_RIGHT] = (phi > -60.0 && phi < 60.0);
		self.options.game.pressed_keys[KEY_LEFT] = (phi > 120.0 || phi < -120.0);
		self.options.game.pressed_keys[KEY_UP] = (phi > -150.0 && phi < -30.0);
		self.options.game.pressed_keys[KEY_DOWN] = (phi > 30.0 && phi < 150.0);
	}
}

class TouchButton {
    constructor(options) {
        this.options = options;
        this.bg_element = $('<div>');
        this.bg_element.css('position', 'absolute').css('width', options.radius).css('height', options.radius).css('border-radius', options.radius);
        this.bg_element.css('background-color', 'rgba(0,0,0,0.5)');
        this.bg_element.css('border', '2px solid #444');
        this.bg_element.css(options.css);
		this.fg_element = $('<div>');
        this.fg_element.css('position', 'absolute').css('width', options.radius).css('height', options.radius).css('border-radius', options.radius);
        // this.fg_element.css('border', '1px solid green');
		this.fg_element.css('left', '50%');
		this.fg_element.css('top', '50%');
		this.fg_element.css('transform', 'translate(-50%, -50%) scale(0.7) translate(0px, 0px)');
        this.fg_element.css('background-color', 'rgba(255,255,255,0.5)');
		this.fg_element.css('border', '3px solid #fff');
		this.bg_element.append(this.fg_element);
        options.element.append(this.bg_element);
		let self = this;
		this.bg_element.on('touchstart', function(e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchmove', function(e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchend touchcancel', function(e) {
			self.fg_element.css('transform', `translate(-50%, -50%) scale(0.7) translate(0px, 0px)`);
			self.options.game.pressed_keys[KEY_JUMP] = false;
		});
    }

	handle_touch(e) {
		let self = this;
		let touch = e.touches[0];
		let width = self.bg_element.width();
		let height = self.bg_element.height();
		let dx = (touch.clientX - self.bg_element.position().left - width / 2) / (width / 2);
		let dy = (touch.clientY - self.bg_element.position().top - height / 2) / (height / 2);
		let r = Math.sqrt(dx * dx + dy * dy);
		let fr = r;
		if (fr > 0.0)
			fr = 0.0;
		dx *= fr / r;
		dy *= fr / r;
		let phi = Math.atan2(dy, dx) / Math.PI * 180;
		self.fg_element.css('transform', `translate(-50%, -50%) scale(0.7) translate(${dx * (width / 2)}px, ${dy * (height / 2)}px)`);
		self.options.game.pressed_keys[KEY_JUMP] = true;
	}
}

document.addEventListener("DOMContentLoaded", function (event) {
	window.game = new Game();
	window.game.reset();

	let tag = window.location.hash.substring(1);
	console.log(tag);
	if (tag.length === 7) window.game.load(tag);

	$('#mi_start').click(function(e) {
		window.game.run();
	});
});

function onYouTubeIframeAPIReady() {
    window.yt_player = new YT.Player('yt_placeholder', {
        height: '390',
        width: '640',
    });
}

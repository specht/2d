let SIMULATION_RATE = 60;
let KEY_UP = 'up';
let KEY_DOWN = 'down';
let KEY_LEFT = 'left';
let KEY_RIGHT = 'right';
let KEY_JUMP = 'jump';

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
		console.log(`loading ${tag}`);
		// load game json
		this.reset();
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
		if (window.location.host.substring(0, 9) === 'localhost') {
			this.run();
			// $('#touch_controls').show();
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
		this.player_mesh = null;
		this.player_sprite = null;
		this.player_traits = null;
		this.player_vy = 0.0;

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
						this.player_mesh = mesh;
						this.player_sprite = sprite;
						this.player_traits = sprite.traits.actor;
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

	run() {
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
		
		// let zoom = (Math.sin(this.clock.getElapsedTime() * 0.5) + 1.0) * 0.2 + 1.0;
		// scale *= zoom;
		// this.camera_x = Math.sin(this.clock.getElapsedTime()) * 20;

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
		console.log('hello this is game');
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

	has_trait_at_player(trait, dx0, dx1, dy0, dy1) {
		let x0 = this.player_mesh.position.x + dx0;
		let x1 = this.player_mesh.position.x + dx1;
		let y0 = this.player_mesh.position.y + dy0;
		let y1 = this.player_mesh.position.y + dy1;

		let result_x = new Set();
		for (let i of this.interval_tree_x.search([x0, x1]))
			result_x.add(i);
		let result_y = new Set();
		for (let i of this.interval_tree_y.search([y0, y1]))
			result_y.add(i);
		let result = [...new Set([...result_x].filter((x) => result_y.has(x)))];
		for (let entry_index of result) {
			let entry = this.active_level_sprites[entry_index];
			let sprite = this.data.sprites[entry.sprite_index];
			if (trait in sprite.traits)
				return entry;
		}
		return null;
	}

	// handle simulation at fixed rate
	simulation_step() {
		let scale = this.height / this.screen_pixel_height;
		if (this.player_mesh !== null) {
			if (this.has_trait_at_player('block_above', -0.5, 0.5, -0.1, 0)) {
				this.player_vy = 0;
				if (this.pressed_keys[KEY_JUMP])
					this.player_vy = this.player_sprite.traits.actor.vjump;
			}

			if (this.pressed_keys[KEY_RIGHT])
				this.player_mesh.position.x += this.player_traits.vrun;
			if (this.pressed_keys[KEY_LEFT])
				this.player_mesh.position.x -= this.player_traits.vrun;
			// if (this.pressed_keys[KEY_UP])
			// 	this.player_mesh.position.y += this.player_traits.vrun;
			// if (this.pressed_keys[KEY_DOWN])
			// 	this.player_mesh.position.y -= this.player_traits.vrun;

			this.player_mesh.position.y += this.player_vy;

			this.player_vy -= this.data.properties.gravity;
			if (this.player_vy < -10)
				this.player_vy = -10;

			if (this.has_trait_at_player('block_above', -0.5, 0.5, -0.1, 0)) {
				if (this.pressed_keys[KEY_JUMP])
					this.player_vy = 12;
			}

			let ppu = 1.0;
			let ppl = 0.7;
			let ppr = 0.7;

			let entry = this.has_trait_at_player('block_above', -0.5, 0.5, 0.1, 1.1);
			if (entry) {
				let sprite = this.data.sprites[entry.sprite_index];
				this.player_mesh.position.y = entry.mesh.position.y + sprite.height;
			}

			if (this.player_vy > 0) {
				entry = this.has_trait_at_player('block_below', -0.5, 0.5,
					this.player_sprite.height * ppu + 0.1,
					this.player_sprite.height * ppu + 1.1);
				if (entry) {
					let sprite = this.data.sprites[entry.sprite_index];
					this.player_mesh.position.y = entry.mesh.position.y - this.player_sprite.height * ppu;
					this.player_vy = 0;
				}
			}

			entry = this.has_trait_at_player('block_sides',
				this.player_sprite.width * 0.5 * ppr - 1,
				this.player_sprite.width * 0.5 * ppr,
				0.5, this.player_sprite.height - 1);
			if (entry) {
				let sprite = this.data.sprites[entry.sprite_index];
				this.player_mesh.position.x = entry.mesh.position.x - sprite.width * 0.5 - this.player_sprite.width * 0.5 * ppr;
			}

			entry = this.has_trait_at_player('block_sides',
				-this.player_sprite.width * 0.5 * ppl,
				-this.player_sprite.width * 0.5 * ppl + 1,
				0.5, this.player_sprite.height - 1);
			if (entry) {
				let sprite = this.data.sprites[entry.sprite_index];
				this.player_mesh.position.x = entry.mesh.position.x + sprite.width * 0.5 + this.player_sprite.width * 0.5 * ppl;
			}


			// let camera follow player
			let safe_zone_x0 = this.player_mesh.position.x - (this.width / 2 / scale) * this.screen_safe_zone_x;
			let safe_zone_x1 = this.player_mesh.position.x + (this.width / 2 / scale) * this.screen_safe_zone_x;
			let safe_zone_y0 = this.player_mesh.position.y - (this.height / 2 / scale) * this.screen_safe_zone_y;
			let safe_zone_y1 = this.player_mesh.position.y + (this.height / 2 / scale) * this.screen_safe_zone_y;
			if (this.camera_x < safe_zone_x0) this.camera_x = safe_zone_x0;
			if (this.camera_x > safe_zone_x1) this.camera_x = safe_zone_x1;
			if (this.camera_y < safe_zone_y0) this.camera_y = safe_zone_y0;
			if (this.camera_y > safe_zone_y1) this.camera_y = safe_zone_y1;
			// this.camera_y = this.player_mesh.position.y + this.data.properties.screen_pixel_height * 0.3;
		}

		// 	// this.player_mesh.position.set(100, 0, 10);
		// 	if (key === 'ArrowRight') {
		// 		this.player_mesh.position.x += 1;
		// 	}
		// 	if (key === 'ArrowLeft') {
		// 		this.player_mesh.position.x -= 1;
		// 	}
		// 	// this.player_mesh.matrixWorldNeedsUpdate = true;
		// 	// console.log(this.player_mesh.position);
		// }

	}

	simulate() {
		let simulate_to = Math.floor(this.clock.getElapsedTime() * 60.0);
		while (this.simulated_to < simulate_to) {
			this.simulation_step();
			this.simulated_to++;
		}
	}
};

document.addEventListener("DOMContentLoaded", function (event) {
	window.game = new Game();
	window.game.reset();
	$('#mi_start').click(function(e) {
		window.game.run();
	});
});

/*
window.renderer = null;
window.clock = null;
window.scene = null;
window.camera = null;

var keys_tr = {
	'arrowleft': 'left',
	'arrowright': 'right',
	' ': 'jump',
}
var keys = {left: false, right: false, jump: false};

var texture_loader = new THREE.TextureLoader();

class SpriteSheet {
	constructor(path, info) {
		this.info = info;
		this.spritesheet = texture_loader.load(path);
		this.spritesheet.magFilter = THREE.NearestFilter;
		this.material = new THREE.ShaderMaterial({
			uniforms: {
				texture1: { value: this.spritesheet },
			},
			transparent: true,
			vertexShader: document.getElementById('vertex-shader').textContent,
			fragmentShader: document.getElementById('fragment-shader').textContent
		});
	};

	add_sprite_to_scene(scene, id, x, y) {
		let skin = this.info.sprites[id];
		let sx = skin.x;
		let sy = skin.y;
		let sw = skin.width;
		let sh = skin.height;
		x += sw/2;
		y -= sh/2;
		x -= skin.pivot[0];
		y += skin.pivot[1];
		let geometry = new THREE.PlaneGeometry(sw, sh, 1, 1);
		let uvs = geometry.attributes.uv;
		let p = 0.05;
		let x0 = (sx + p) / this.info.width;
		let x1 = (sx + sw - p) / this.info.width;
		let y0 = (sy + p) / this.info.height;
		let y1 = (sy + sh - p) / this.info.height;
		uvs.setXY(0, x0, 1 - y0);
		uvs.setXY(1, x1, 1 - y0);
		uvs.setXY(2, x0, 1 - y1);
		uvs.setXY(3, x1, 1 - y1);
		let sprite = new THREE.Mesh(geometry, this.material);
		sprite.position.x = x;
		sprite.position.y = y;
		let group = new THREE.Group();
		group.add(sprite);
		if (true) {
			let material = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1.5 });
			let points = [];
			for (let p of (skin.hitbox || [])) {
				let px = p[0] - sw / 2 + x;
				let py = sh - p[1] - sh / 2 + y;
				points.push(new THREE.Vector3(px, py, 1));
			}
			let geometry = new THREE.BufferGeometry().setFromPoints(points);
			let line = new THREE.LineLoop(geometry, material);
			group.add(line);
			if (skin.pivot) {
				let material = new THREE.LineBasicMaterial({ color: 0xff0000 });
				points = [];
				let px = skin.pivot[0] - sw / 2 + x;
				let py = sh - skin.pivot[1] - sh / 2 + y;
				points.push(new THREE.Vector3(px - 1, py - 1, 1));
				points.push(new THREE.Vector3(px + 1, py + 1, 1));
				geometry = new THREE.BufferGeometry().setFromPoints(points);
				line = new THREE.Line(geometry, material);
				group.add(line);
				points = [];
				points.push(new THREE.Vector3(px + 1, py - 1, 1));
				points.push(new THREE.Vector3(px - 1, py + 1, 1));
				geometry = new THREE.BufferGeometry().setFromPoints(points);
				line = new THREE.Line(geometry, material);
				group.add(line);
			}
		}
		scene.add(group);
		return group;
	}
};

function animate_step() {
	player.position.add(player_v);
	player_v.add(player_a);
	// player_v.multiplyScalar(0.9);
	player_v.x *= 0;
	if (player.position.y < 0) {
		if (!player_rest_y)
			shake_magnitude = 1.0;
		player_rest_y = true;
		player.position.y = 0;
	}
	if (player.position.x < -8.2 * 24)
		player.position.x = -8.2 * 24;
	if (player.position.x > 8.2 * 24)
		player.position.x = 8.2 * 24;
	shake_magnitude *= 0.96;
	// if (camera_x < player.position.x * 6)
		// camera_x += 4;
	// if (camera_x > player.position.x * 6)
		// camera_x -= 4;
	// camera_x = player.position.x * 6;
	// player_a.multiplyScalar(0.9);
	let dx = (camera_x - player.position.x * 6);
	camera_x += -dx * 0.05;
	sky.position.x = camera_x / 8.0;
	let dy = (camera_y - player.position.y * 6);
	// camera_y += -dy * 0.05;
	sky.position.y = camera_y / 8.0;
}

var last_t = null;
var shake_x = 0.0;
var shake_y = 0.0;
var shake_magnitude = 0.0;
var camera_x = 0.0;
var camera_y = 0.0;

var render = function () {
	requestAnimationFrame(render);
	shake_x = (Math.random() - 0.5) * 10.0 * shake_magnitude;
	shake_y = (Math.random() - 0.5) * 60.0 * shake_magnitude;
	resize_handler();
	// player_v.x = 0;
	if (keys.left) player_v.x = -2;
	if (keys.right) player_v.x = 2;
	if (keys.jump) {
		if (player_rest_y) {
			player_v.y = JUMP_SPEEDITY;
			player_rest_y = false;
		}
	}
	let t = Math.floor(clock.getElapsedTime() * 100);
	if (last_t !== null) {
		while (last_t < t) {
			animate_step();
			last_t += 1;
		}
	}
	last_t = t;
	renderer.setRenderTarget(null);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.render(scene, camera);
};

function resize_handler() {
	let width = window.innerWidth;
	let height = window.innerHeight;
	let scale = 6;
	renderer.setSize(width, height);
	// camera_y = 0;
	camera.left = (-width / 2 + shake_x + camera_x) / scale;
	camera.right = (width / 2 + shake_x + camera_x) / scale;
	camera.top = (height / 2 + shake_y + camera_y) / scale;
	camera.bottom = (-height / 2 + shake_y + camera_y) / scale;
	camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
	resize_handler();
});

window.addEventListener('keydown', function(e) {
	for (let k in keys_tr)
		if (e.key.toLowerCase() === k)
			keys[keys_tr[k]] = true;
});

window.addEventListener('keyup', function(e) {
	for (let k in keys_tr)
		if (e.key.toLowerCase() === k)
			keys[keys_tr[k]] = false;
});

window.addEventListener('blur', function(e) {
	for (let k in keys_tr)
		keys[keys_tr[k]] = false;
});

function reset_game() {
	var clock = new THREE.Clock(true);
	var scene = new THREE.Scene();
	var camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
	camera.position.x = 0;
	camera.position.z = 10;
	camera.position.y = 0;
	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setClearColor("#058");
	renderer.setSize(window.innerWidth, window.innerHeight);
	
	document.body.appendChild(renderer.domElement);
	
	sheet = new SpriteSheet('spritesheet.png', spritesheet_info);
	let sky = sheet.add_sprite_to_scene(scene, 'sky', 0, 0);
	sky.scale.x = 1.5;
	sky.scale.y = 1.5;
	for (let x = -16; x <= 16; x++)
		sheet.add_sprite_to_scene(scene, 'soil', x * 24, 0-24-24);
	for (let x = -16; x <= 16; x++)
		sheet.add_sprite_to_scene(scene, 'soil', x * 24, 0-24-24-24);
	for (let y = 0; y < 10; y++) {
		sheet.add_sprite_to_scene(scene, 'soil', 9*24, y * 24);
		sheet.add_sprite_to_scene(scene, 'soil', -9*24, y * 24);
	}
	let tree = sheet.add_sprite_to_scene(scene, 'tree', 48, -24);
	let player = sheet.add_sprite_to_scene(scene, 'dustin', 0, 0-24);
	sheet.add_sprite_to_scene(scene, 'shrub', -80, 0-24-6);
	for (let x = -16; x <= 16; x++)
		sheet.add_sprite_to_scene(scene, 'grass', x * 24, 0-24);
	for (let y = -1; y == -1; y++) {
		sheet.add_sprite_to_scene(scene, 'soil', 9*24, y * 24);
		sheet.add_sprite_to_scene(scene, 'soil', -9*24, y * 24);
	}
	
	// let material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
	// points = [];
	// points.push(new THREE.Vector3(0, 10, 2));
	// points.push(new THREE.Vector3(0, 0, 2));
	// points.push(new THREE.Vector3(10, 0, 2));
	// let geometry = new THREE.BufferGeometry().setFromPoints(points);
	// let line = new THREE.Line(geometry, material);
	// scene.add(line);
	
	var GRAVITY = -0.195;
	var JUMP_SPEEDITY = 5.5;
	
	var player_a = new THREE.Vector3(0, GRAVITY, 0);
	var player_v = new THREE.Vector3();
	var player_rest_y = true;
	
	
}

document.addEventListener("DOMContentLoaded", function (event) {
	reset_game();
	resize_handler();
	render();
});
*/
class Game {
	constructor() {
		let self = this;
		let data = null;
		this.reset();
		window.addEventListener('resize', () => {
			self.handle_resize();
		});
	}

	load(data) {
		console.log('loading data', data);
		this.data = data;
		$('#game_title').text(this.data.properties.title);
		$('#game_author').text(this.data.properties.author);
	}

	reset() {
		console.log('hello this is game');
		this.handle_resize();
	}

	handle_resize() {
		let width = window.innerWidth;
		let height = window.innerHeight;
		if (height * 16.0/9 < width)
			$('.play_container_inner').css('width', '').css('height', '100%');
		else
			$('.play_container_inner').css('height', '').css('width', '100%');
		$('body').css('font-size', `${height / 30}px`);
	}
};

window.game = new Game();

document.addEventListener("DOMContentLoaded", function (event) {
	window.game.reset();
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
var spritesheet_info = {
	"width": 440,
	"height": 259,
	"sprites": {
		"dustin": {
			"x": 4, "y": 237, "width": 14, "height": 22,
			"pivot": [7, 22],
			"hitbox": [[0, 0], [0, 22], [14, 22], [14, 0]]
		},
		"grass": {
			"x": 90, "y": 235, "width": 24, "height": 24,
			"pivot": [12, 0],
			"hitbox": [[0, 0], [0, 24], [24, 24], [24, 0]]
		},
		"shrub": {
			"x": 191, "y": 144, "width": 96, "height": 16,
			"pivot": [48, 16],
			"hitbox": [[0, 0], [0, 16], [96, 16], [96, 0]]
		},
		"tree": {
			"x": 0, "y": 40, "width": 70, "height": 88,
			"pivot": [35, 88],
			"hitbox": [[10, 10], [0, 40], [0, 45], [10, 55],
			[30, 60], [28, 88], [40, 88], [40, 65],
			[70, 50], [70, 30], [60, 10], [35, 0]]
		},
	}
};

var keys_tr = {'arrowleft': 'left', 'arrowright': 'right', ' ': 'jump'}
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
		let x0 = sx / this.info.width;
		let x1 = (sx + sw) / this.info.width;
		let y0 = sy / this.info.height;
		let y1 = (sy + sh) / this.info.height;
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
			let material = new THREE.LineBasicMaterial({ color: 0xffffff });
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

var clock = new THREE.Clock(true);

var scene = new THREE.Scene();
var camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
camera.position.x = 0;
camera.position.z = 10;
camera.position.y = 0;
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor("#058");
renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

sheet = new SpriteSheet('spritesheet.png', spritesheet_info);
let tree = sheet.add_sprite_to_scene(scene, 'tree', 48, -24);
sheet.add_sprite_to_scene(scene, 'shrub', -80, 0-24);
for (let x = -6; x <= 6; x++)
	sheet.add_sprite_to_scene(scene, 'grass', x * 24, 0-24);
let player = sheet.add_sprite_to_scene(scene, 'dustin', 0, 0-24);

// let material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
// points = [];
// points.push(new THREE.Vector3(0, 10, 2));
// points.push(new THREE.Vector3(0, 0, 2));
// points.push(new THREE.Vector3(10, 0, 2));
// let geometry = new THREE.BufferGeometry().setFromPoints(points);
// let line = new THREE.Line(geometry, material);
// scene.add(line);


var render = function () {
	requestAnimationFrame(render);
	let t = clock.getElapsedTime();
	if (keys.left) player.position.x -= 0.5;
	if (keys.right) player.position.x += 0.5;
	renderer.setRenderTarget(null);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.render(scene, camera);
};

function resize_handler() {
	let width = window.innerWidth;
	let height = window.innerHeight;
	let scale = 8;
	renderer.setSize(width, height);
	camera.left = -width / 2 / scale;
	camera.right = width / 2 / scale;
	camera.top = height / 2 / scale;
	camera.bottom = -height / 2 / scale;
	camera.updateProjectionMatrix();
}

resize_handler();

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

render();

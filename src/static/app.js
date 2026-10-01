let SIMULATION_RATE = 60;
let KEY_UP = 'up';
let KEY_DOWN = 'down';
let KEY_LEFT = 'left';
let KEY_RIGHT = 'right';
let KEY_JUMP = 'jump';
let KEY_ACTION = 'action';
let KEY_MELEE = 'melee';
let KEY_RANGED = 'ranged';
// Control action (controls.js) → internal pressed_keys entry.
const ACTION_KEYS = { left: KEY_LEFT, right: KEY_RIGHT, up: KEY_UP, down: KEY_DOWN,
	jump: KEY_JUMP, action: KEY_ACTION, melee: KEY_MELEE, ranged: KEY_RANGED };
window.yt_player = null;
let OVERLAY_ICONS = {
	f_key: [36, 36, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAf0lEQVRYw+2YQQqAIBQFv9GBWygE0SqCoM7nr9PUVtyEpJIwbye4GHjDAzWDc7uEMcZKxZyqR3ju5GcB6C197IyqVgW4vLdU1rhDidmWNen+OE9UhkNZHaEyHHrbpa9OURk7RGUAAQRQ6R3KvTtU1r5D8f9M/NYunVuE/6G2gR7lsx2d8NUeyQAAAABJRU5ErkJggg=="],
};

// "!" above an enemy that has just noticed the player (baddie_ai.js). Created only
// when needed, so games without it create exactly the same objects as before.
const ALERT_ICON = [36, 36, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAkCAYAAADhAJiYAAAAhElEQVR42mNkQANSMjr/GegInj25wojMZ2IYZGDUQYQAI3qauXXjBEkG7PWKR+E7b1tIkn41DYvRKBvaDmIhVQN6mqF2mhqNslEHjTpotBwiBNDLFUrLndEoG3lpiFCaGo2y0TREaftotBwaef2y0b79aBqidhoiBAilMfQ0MRplw95BAG2TIUiAgKIgAAAAAElFTkSuQmCC"];

Number.prototype.clamp = function (min, max) {
	return Math.min(Math.max(this, min), max);
};

class FutureEventList {
	constructor() {
		this.tree = new AVLBundle();
	}

	insert(t, value) {
		this.tree.insert(t, value);
	}

	peek() {
		return this.tree.min();
	}

	pop() {
		return this.tree.pop().data;
	}
};

class Character {
	constructor(game, sprite_index, mesh) {
		this.game = game;
		this.active = true;
		this.sprite_index = sprite_index;
		this.sprite = this.game.data.sprites[this.sprite_index];
		this.mesh = mesh;
		this.traits = {};
		this.follow_camera = false;
		this.character_trait = null;
		this.state = 'stand';
		this.direction = 'front';
		this.t0 = 0.0;
		this.sti_for_state = {};
		this.combat_visual = null;
		this.hit_flash_until = 0;
		this.hit_flash_materials = null;
		this.pressed_keys = {};
		this.intention = null;
		this.invincible_until = 0;
		this.paused_until = 0;
		this.accelerated_until = 0;
		this.speed_boost_vrun = 1.0;
		this.speed_boost_vjump = 1.0;
		this.initial_position = [mesh.position.x, mesh.position.y];
		this.simulate_this = true;
		this.falling_sprite_indices = {};
		console.log(this.initial_position);

		if ('actor' in this.sprite.traits) {
			this.character_trait = 'actor';
			this.traits = this.sprite.traits[this.character_trait];
			this.follow_camera = true;
			this.simulate_this = true;
		}
		else if ('baddie' in this.sprite.traits) {
			this.character_trait = 'baddie';
			this.traits = this.sprite.traits[this.character_trait];
			// Each enemy has its own health; the sprite trait is the starting value.
			this.energy = this.traits.energy;
			this.traits.ex_top ??= 1.0;
			this.traits.ex_left ??= 1.0;
			this.traits.ex_right ??= 1.0;
			this.simulate_this = !this.traits.wait_until_seen;
		}

        // Normalize the new optional melee trait only in this character's
        // runtime view, alongside the ranged trait. Legacy JSON stays unchanged.
        if (this.character_trait && (this.sprite.traits.melee_attack?.attack ||
            this.sprite.traits.ranged_attack?.attack)) {
            this.traits = {
                ...this.traits,
                attacks: resolved_character_attacks(this.sprite.traits, this.character_trait),
            };
        }

		// Optional "Verhalten" (baddie_ai.js). null = the classic patrol code.
		this.behavior = this.character_trait === 'baddie' && typeof baddie_behavior === 'function' ?
			baddie_behavior(this.traits, this.sprite?.traits?.smart) : null;
		this.ai_memory = {};
		this.ai_speed = 1.0;
		this.ai_dy = 0;
		this.ai_no_gravity = false;
		this.ai_face = null;
		this.ai_pose = null;
		this.alert_until = 0;
		this.alert_mesh = null;

		let state_prefixes = ['stand', 'walk', 'jump', 'fall'];

		for (let sp of state_prefixes) {
			this.sti_for_state[sp] ??= {};
		}

		console.log(this.sprite.states);
		for (let spi = 0; spi < state_prefixes.length; spi++) {
			let sp = state_prefixes[spi];
			let remaining_sp = state_prefixes.slice(spi + 1);
			for (let sti = 0; sti < this.sprite.states.length; sti++) {
				let state = this.sprite.states[sti];
				let state_traits = (state.traits ?? {})[this.character_trait] ?? {};
				let prefix = sp === 'stand' ? '' : sp + '_';
				for (let d of ['front', 'back', 'left', 'right']) {
					if (`${prefix}${d}` in state_traits) {
						this.assign_sti(sp, d, sti, 100, false);
						for (let rsp of remaining_sp)
							this.assign_sti(rsp, d, sti, 10, false);
					}
				}
			}
			// console.log(`after ${sp}:`, JSON.parse(JSON.stringify(this.sti_for_state)));
		}

		// assign default states
		for (let state of ['stand', 'walk', 'jump', 'fall', 'dead']) {
			for (let d of ['front', 'back', 'left', 'right']) {
				this.assign_sti(state, d, 0, 0, false);
			}
		}

		// try to assign flipped states
		for (let state of ['stand', 'walk', 'jump', 'fall']) {
			this.assign_sti(state, 'left', this.sti_for_state[state].right.sti, 1, true);
			this.assign_sti(state, 'right', this.sti_for_state[state].left.sti, 1, true);
		}

		for (let sti = 0; sti < this.sprite.states.length; sti++) {
			let state = this.sprite.states[sti];
			let state_traits = (state.traits ?? {})[this.character_trait] ?? {};
			if ('dead' in state_traits) {
				for (let d of ['front', 'back', 'left', 'right']) {
					this.assign_sti('dead', d, sti, 200, false);
				}
			}
		}
        // These are optional render poses, not movement states or attack hitboxes.
        // Missing poses never replace the normal movement art in an old game.
        // hunt / flee / stunned / landed: poses of enemy behaviours (baddie_ai.js).
        // swim / float / drift / dive / rise: the figure in a Bewegungsbereich
        // (movement_regions.js)
        for (let kind of ['attack', 'hit', 'hunt', 'flee', 'stunned', 'landed', 'swim', 'float', 'drift', 'dive', 'rise']) {
            let poses = {};
            for (let sti = 0; sti < this.sprite.states.length; sti++) {
                let tags = this.sprite.states[sti].traits?.[this.character_trait] ?? {};
                for (let d of ['front', 'back', 'left', 'right']) {
                    if (`${kind}_${d}` in tags)
                        poses[d] = { sti, flipped: false };
                }
            }
            if (!Object.keys(poses).length) continue;
            // A single right/left drawing can face the other way by flipping.
            for (let [d, opposite] of [['left', 'right'], ['right', 'left']]) {
                if (!poses[d] && poses[opposite])
                    poses[d] = { ...poses[opposite], flipped: true };
            }
            let fallback = poses.right ?? poses.left ?? poses.front ?? poses.back;
            for (let d of ['front', 'back', 'left', 'right'])
                poses[d] ??= { ...fallback };
            this.sti_for_state[kind] = poses;
        }
		// Klettern: an optional state for climbing a ladder, the same for every
		// direction (a climber is seen from behind). Without it, climbing shows
		// the back-facing state – old games look exactly as before.
		for (let sti = 0; sti < this.sprite.states.length; sti++) {
			if ('climb' in (this.sprite.states[sti].traits?.[this.character_trait] ?? {})) {
				this.sti_for_state.climb = {};
				for (let d of ['front', 'back', 'left', 'right'])
					this.sti_for_state.climb[d] = { sti, confidence: 300, flipped: false };
				break;
			}
		}
		console.log(this.sti_for_state);


		this.vy = 0;
		// Bewegungsbereiche: sideways speed in the water or in space (px per frame)
		this.vx = 0;
		this.stroke_held = false;
	}

	assign_sti(state, direction, sti, confidence, flipped) {
		this.sti_for_state[state] ??= {};
		this.sti_for_state[state][direction] ??= { sti: sti, confidence: confidence, flipped: flipped };
		if (confidence > this.sti_for_state[state][direction].confidence) {
			this.sti_for_state[state][direction] = { sti: sti, confidence: confidence, flipped: flipped };
		}
	}

    // Called only after an accepted combat activation / accepted nonlethal hit.
    // Character art plays once at its own FPS, irrespective of attack cooldowns.
    show_combat_visual(kind) {
        const poses = this.sti_for_state[kind];
        if (!poses || !this.active ||
            (this.character_trait === 'actor' ? this.dead() : this.energy <= 0)) return;
        const now = this.game.clock.getElapsedTime();
        // A reaction belongs to the target and takes priority over its attack pose.
        if (kind === 'attack' && this.combat_visual?.kind === 'hit' &&
            now < this.combat_visual.until) return;
        const direction = poses[this.direction] ? this.direction :
            (this.last_horizontal_facing ?? 'right');
        const state = this.sprite.states[poses[direction].sti];
        const fps = Number.isFinite(state.properties?.fps) && state.properties.fps > 0 ?
            state.properties.fps : 8;
        const duration = Math.min(2, Math.max(0.15, state.frames.length / fps));
        this.combat_visual = { kind, until: now + duration };
        this.t0 = now;
    }

    // Only a confirmed, nonlethal hit starts this target-owned visual.
    // No extra invincibility or damage is introduced by the presentation.
    flash_on_hit() {
        if (!this.active || (this.character_trait === 'actor' ? this.dead() : this.energy <= 0) ||
            this.traits?.hit_feedback?.kind === 'none') return;
        this.hit_flash_until = this.game.clock.getElapsedTime() + 0.18;
    }

    // All atlas materials are shared. The temporary shader belongs to this
    // character instance, and uses the *normal* atlas frame as its source.
    // In particular, do not multiply the atlas alpha by the chosen colour:
    // 'Ausblenden' is a separate choice, never an accidental transparent tint.
    apply_hit_flash() {
        if (!(this.game.clock.getElapsedTime() < this.hit_flash_until) || !this.active ||
            (this.character_trait === 'actor' ? this.dead() : this.energy <= 0)) return;
        const setting = this.traits?.hit_feedback ?? {};
        if (setting.kind === 'none') return;
        const kind = setting.kind === 'hide' ? 'hide' : 'color';
        const hex = typeof setting.color === 'string' && /^#[0-9a-f]{6}$/i.test(setting.color) ?
            setting.color : '#ff4040';
        // update_state_and_direction restored the base material for this frame
        // just before calling us. Never treat a previous flash as a new base.
        const base = this.mesh.material;
        if (!base?.uniforms?.texture1 || typeof base.clone !== 'function') return;
        this.hit_flash_materials ??= new Map();
        let cached = this.hit_flash_materials.get(base);
        if (!cached || cached.kind !== kind || cached.color !== hex) {
            cached?.material.dispose();
            const material = base.clone();
            // THREE.ShaderMaterial.clone() also clones texture uniforms. Reuse the
            // original uploaded atlas texture, not an uninitialised texture copy.
            material.uniforms.texture1.value = base.uniforms.texture1.value;
            if (kind === 'hide') {
                material.fragmentShader = 'void main() { discard; }';
            } else {
                const rgb = [1, 3, 5].map(i =>
                    (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(4)).join(', ');
                material.fragmentShader = `uniform sampler2D texture1;
varying vec2 vuv;
void main() {
    vec4 pixel = texture2D(texture1, vuv);
    if (pixel.a <= 0.0) discard;
    gl_FragColor = vec4(mix(pixel.rgb, vec3(${rgb}), 0.9), pixel.a);
}`;
                // blended sprites (Mischmodus) expect premultiplied colour
                if (base.userData?.blend) material.fragmentShader = premultiplied_shader(material.fragmentShader);
            }
            material.needsUpdate = true;
            cached = { kind, color: hex, material };
            this.hit_flash_materials.set(base, cached);
        }
        this.mesh.material = cached.material;
    }

    dispose_hit_flash() {
        for (const entry of this.hit_flash_materials?.values() ?? []) entry.material.dispose();
        this.hit_flash_materials = null;
    }

	has_trait_at(trait_or_traits, dx0, dx1, dy0, dy1) {
		if (typeof (trait_or_traits) === 'string')
			trait_or_traits = [trait_or_traits];
		let x0 = this.mesh.position.x + dx0;
		let x1 = this.mesh.position.x + dx1;
		let y0 = this.mesh.position.y + dy0;
		let y1 = this.mesh.position.y + dy1;

		let check_for_door = false;
		for (let trait of trait_or_traits) {
			if (trait === 'block_above' || trait === 'block_sides' || trait === 'block_below') {
				check_for_door = true;
				break;
			}
		}

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
			for (let trait of trait_or_traits) {
				if (trait in sprite.traits) {
					let ok = true;
					if (trait === 'door') {
						// Doors are a special case because of their proximity sensing capabilities.
						// We search an area +- 100 px around the door and now have to test whether
						// the hit was really within the door's area via xsense and ysense.
						if (this.mesh.position.x < entry.mesh.position.x - sprite.width / 2 - sprite.traits.door.xsense ||
							this.mesh.position.x > entry.mesh.position.x + sprite.width / 2 + sprite.traits.door.xsense ||
							this.mesh.position.y < entry.mesh.position.y - sprite.traits.door.ysense ||
							this.mesh.position.y > entry.mesh.position.y + sprite.height + sprite.traits.door.ysense)
							ok = false;
					}
					if (trait === 'slope') {
						// Slopes are special as well: whether we're intersecting the slope or not
						// depends on the x position
						let tx = (this.mesh.position.x - (entry.mesh.position.x - sprite.width / 2)) / sprite.width;
						if (sprite.traits.slope.direction === 'negative') tx = 1.0 - tx;
						tx = tx.clamp(0.0, 1.0);
						if (this.mesh.position.y > entry.mesh.position.y + tx * sprite.height + 8) {
							ok = false;
						}
					}

					if (ok) {
						let r = { ...entry };
						r.entry_index = entry_index;
						return r;
					}
				}
			}
			if (check_for_door) {
				if (('door' in sprite.traits) && entry.door_closed) {
					let r = { ...entry };
					r.entry_index = entry_index;
					return r;
				}
			}
		}
		return null;
	}

	has_baddie_at(dx0, dx1, dy0, dy1) {
		this.game.update_dynamic_interval_tree_if_necessary();

		let x0 = this.mesh.position.x + dx0;
		let x1 = this.mesh.position.x + dx1;
		let y0 = this.mesh.position.y + dy0;
		let y1 = this.mesh.position.y + dy1;

		return this.game.has_baddie_at(x0, x1, y0, y1);
	}

	intersect_x_with_trait(dx, trait_or_traits, dx0, dx1, dy0, dy1) {
		if (typeof (trait_or_traits) === 'string')
			trait_or_traits = [trait_or_traits];

		let x0 = this.mesh.position.x + dx0;
		let x1 = this.mesh.position.x + dx1;
		let y0 = this.mesh.position.y + dy0;
		let y1 = this.mesh.position.y + dy1;

		// handle slopes: if we want to walk left or right and we're on a slope,
		// just do it
		if (this.has_trait_at(['slope'], -0.0001, 0.0001, -0.1, -0.01)) {
			return dx;
		}

		let check_for_block_above = trait_or_traits.indexOf('block_above') >= 0;
		let check_for_block_sides = trait_or_traits.indexOf('block_sides') >= 0;
		let check_for_block_below = trait_or_traits.indexOf('block_below') >= 0;

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
			for (let trait of trait_or_traits) {
				if (trait in sprite.traits) {
					let winx = this.mesh.position.x;
					if (dx < 0)
						winx = Math.max(x0, entry.mesh.position.x + sprite.width / 2 + this.traits.ex_left * this.sprite.width * 0.5);
					else if (dx > 0)
						winx = Math.min(x0, entry.mesh.position.x - sprite.width / 2 - this.traits.ex_right * this.sprite.width * 0.5);
					dx = winx - this.mesh.position.x;
				}
			}
			if (check_for_block_above || check_for_block_sides || check_for_block_below) {
				if (('door' in sprite.traits) && entry.door_closed) {
					let winx = this.mesh.position.x;
					if (dx < 0)
						winx = Math.max(x0, entry.mesh.position.x + sprite.width / 2 + this.traits.ex_left * this.sprite.width * 0.5);
					else if (dx > 0)
						winx = Math.min(x0, entry.mesh.position.x - sprite.width / 2 - this.traits.ex_right * this.sprite.width * 0.5);
					dx = winx - this.mesh.position.x;
				}
			}
		}
		return dx;
	}

	try_move_x(dx) {
		if (dx < 0) {
			let lb = -this.traits.ex_left * this.sprite.width * 0.5;
			let tb = this.traits.ex_top * this.sprite.height;
			dx = this.intersect_x_with_trait(dx, ['block_sides'], lb + dx, lb, 0.1, tb - 0.1);
		} else if (dx > 0) {
			let rb = this.traits.ex_right * this.sprite.width * 0.5;
			let tb = this.traits.ex_top * this.sprite.height;
			dx = this.intersect_x_with_trait(dx, ['block_sides'], rb, rb + dx, 0.1, tb - 0.1);
		}
		// console.log(this.mesh.position.x, dx);
		this.mesh.position.x += dx;
		return dx;
	}

	intersect_y_with_trait(dy, trait_or_traits, dx0, dx1, dy0, dy1) {
		if (typeof (trait_or_traits) === 'string')
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
			for (let trait of trait_or_traits) {
				if (trait in sprite.traits) {
					let winy = this.mesh.position.y;
					if (dy < 0) {
						// accomodate for slope
						let height = sprite.height;
						if (trait === 'slope') {
							let tx = (this.mesh.position.x - (entry.mesh.position.x - sprite.width * 0.5)) / sprite.width;
							if (sprite.traits.slope.direction === 'negative') tx = 1.0 - tx;
							tx = tx.clamp(0.0, 1.0);
							height = tx * sprite.height;
						}
						winy = Math.max(y0, entry.mesh.position.y + height);
					} else if (dy > 0)
						winy = Math.min(y0, entry.mesh.position.y - this.sprite.height * this.traits.ex_top);
					dy = winy - this.mesh.position.y;
				}
			}
		}
		return dy;
	}

	try_move_y(dy) {
		let old_dy = dy;
		if (dy < 0) {
			if (this.pressed_keys[KEY_DOWN]) {
				dy = this.intersect_y_with_trait(dy, ['block_above'], -0.5, 0.5, dy, 0.0);
			} else {
				dy = this.intersect_y_with_trait(dy, ['block_above', 'ladder'], -0.5, 0.5, dy, 0.0);
				if (this.character_trait === 'baddie' && old_dy != dy) {
					this.game.ts_camera_shake = this.game.clock.getElapsedTime();
					let dx = this.mesh.position.x - this.game.player_character.mesh.position.x;
					let dy = this.mesh.position.y - this.game.player_character.mesh.position.y;
					let dist = 1.0 - Math.pow(dx * dx + dy * dy, 0.5) / this.traits.camera_shake_max_dist;
					if (dist < 0.0) dist = 0.0;
					this.game.camera_shake_strength = dist * this.traits.camera_shake_on_land ?? 0;
				}
			}
			dy = this.intersect_y_with_trait(dy, ['slope'], -0.01, 0.01, dy - 0.1, dy);
		} else if (dy > 0) {
			let tb = this.traits.ex_top * this.sprite.height;
			dy = this.intersect_y_with_trait(dy, ['block_below'], -0.5, 0.5, tb + 0.1, tb + dy + 0.1);
		}
		this.mesh.position.y += dy;
		return dy;
	}

	update_state_and_direction(state, direction) {
		let old_sti = this.sti_for_state[this.state][this.direction].sti;
		let old_flipped = this.sti_for_state[this.state][this.direction].flipped;
		this.state = state;
		this.direction = direction;
		if (direction === 'left' || direction === 'right') this.last_horizontal_facing = direction;
		let sti = this.sti_for_state[this.state][this.direction].sti;
		let flipped = this.sti_for_state[this.state][this.direction].flipped;
		if (sti !== old_sti || flipped !== old_flipped) {
			this.t0 = this.game.clock.getElapsedTime();
			let info = this.game.geometry_and_material_for_frame[this.sprite_index][sti][0];
			this.mesh.geometry = info.geometry;
			this.mesh.material = this.game.material_for_frame?.(info, this.mesh) ?? info.material;
		}
		// animate character if there's more than one frame
		if (this.game.data.sprites[this.sprite_index].states[sti].frames.length > 0) {
			let fi = Math.floor((this.game.clock.getElapsedTime() - this.t0) * this.sprite.states[sti].properties.fps) % this.sprite.states[sti].frames.length;
			if (state === 'climb') {
				// holding still on the ladder: keep the frame, go on from it later
				if (this.climb_hold) {
					fi = this.climb_frame ?? 0;
					this.t0 = this.game.clock.getElapsedTime() - (fi + 0.5) / (this.sprite.states[sti].properties.fps || 1);
				}
				this.climb_frame = fi;
			}
            if (state === 'dead' || state === 'attack' || state === 'hit' || state === 'landed') {
                // Death and optional combat poses play once; never loop.
                fi = Math.floor((this.game.clock.getElapsedTime() - this.t0) * this.sprite.states[sti].properties.fps);
                if (fi > this.sprite.states[sti].frames.length - 1)
                    fi = this.sprite.states[sti].frames.length - 1;
            }
			let info = this.game.geometry_and_material_for_frame[this.sprite_index][sti][fi];
			this.mesh.geometry = info.geometry;
			this.mesh.material = this.game.material_for_frame?.(info, this.mesh) ?? info.material;
		}
        this.apply_hit_flash();
		this.mesh.scale.x = flipped ? -1.0 : 1.0;
	}

	// Ground contact right now, without the coyote-time memory of
	// standing_on_ground(): calling that one more often changes the jump timing.
	touching_ground() {
		return (this.has_trait_at(['ladder', 'slope'], -0.5, 0.5, -0.5, -0.01) !== null) ||
			this.standing_on_block_top();
	}

	standing_on_ground() {
		// we're adding a coyote time effect here:
		// keep this true for an additional 30 ms or something like this
		let value = (this.has_trait_at(['ladder', 'slope'], -0.5, 0.5, -0.5, -0.01) !== null) ||
			this.standing_on_block_top();
		this.standing_on_ground_cache ??= {
			v0: false,
			v1: false,
			v1_t: 0.0,
		};
		this.standing_on_ground_cache.v0 = this.standing_on_ground_cache.v1;
		this.standing_on_ground_cache.v1 = value;
		if (this.standing_on_ground_cache.v0 === true && this.standing_on_ground_cache.v1 === false) {
			let delta = (this.game.data.properties.coyote_time ?? 30) * 0.001;
			if (this.has_trait_at(['slope'], -0.001, 0.001, -8, -0.01) !== null) delta = 0;
			this.standing_on_ground_cache.v1_t = this.game.clock.getElapsedTime() + delta;
		}
		if (this.standing_on_ground_cache.v1 === false) {
			return this.game.clock.getElapsedTime() < this.standing_on_ground_cache.v1_t;
		} else {
			return true;
		}
	}

	// A "von oben" block (or a closed door) only carries a figure whose feet are
	// at its top surface. Before, feet anywhere inside counted as ground, so a
	// figure jumping up through a one-way platform stopped and stood inside it.
	// Now it keeps moving and lands on the top edge (try_move_y lifts it there).
	standing_on_block_top() {
		const x = this.mesh.position.x, y = this.mesh.position.y;
		const ids_x = new Set(this.game.interval_tree_x.search([x - 0.5, x + 0.5]));
		for (const i of this.game.interval_tree_y.search([y - 0.5, y - 0.01])) {
			if (!ids_x.has(i)) continue;
			const entry = this.game.active_level_sprites[i];
			const sprite = this.game.data.sprites[entry.sprite_index];
			const carries = 'block_above' in sprite.traits || ('door' in sprite.traits && entry.door_closed);
			if (carries && y >= entry.mesh.position.y + sprite.height - 1.0) return true;
		}
		return false;
	}

	center_on_entry(entry) {
		this.mesh.position.x = entry.mesh.position.x;
	}

	patrol_direction() {
		if (this.traits.start_dir === 'left') return 'left';
		if (this.traits.start_dir === 'right') return 'right';
		return ['left', 'right'][Math.floor(Math.random() * 2.0)];
	}

	patrol_duration() {
		if (this.traits.takes_breaks[0] !== 0 || this.traits.takes_breaks[1] !== 0) {
			return (Math.random() * (this.traits.takes_breaks[1] - this.traits.takes_breaks[0]) + this.traits.takes_breaks[0]) * SIMULATION_RATE;
		}
		return null;
	}

	break_duration() {
		return (Math.random() * (this.traits.break_length[1] - this.traits.break_length[0]) + this.traits.break_length[0]) * SIMULATION_RATE;
	}

	simulate_movement() {
		this.ai_speed = 1.0;
		this.ai_dy = 0;
		this.ai_no_gravity = false;
		this.ai_face = null;
		this.ai_pose = null;
		if (!this.behavior) return this.simulate_patrol();
		const now = this.game.clock.getElapsedTime();
		const out = baddie_decide(this.behavior, this.ai_memory, this.ai_perception());
		this.ai_no_gravity = Boolean(out.no_gravity) || this.behavior.type === 'flutter';
		if (out.patrol) {
			this.simulate_patrol();
		} else {
			this.pressed_keys[KEY_LEFT] = Boolean(out.keys?.left);
			this.pressed_keys[KEY_RIGHT] = Boolean(out.keys?.right);
			this.pressed_keys[KEY_JUMP] = Boolean(out.keys?.jump);
			// "Leitern klettern" (off by default): the behaviour may climb
			this.pressed_keys[KEY_UP] = Boolean(out.keys?.up);
			this.pressed_keys[KEY_DOWN] = Boolean(out.keys?.down);
		}
		this.ai_speed = out.speed ?? 1.0;
		this.ai_dy = out.dy ?? 0;
		this.ai_face = out.face ?? null;
		this.ai_pose = out.pose ?? null;
		// The "!" is optional (off by default).
		if (out.alert && this.behavior.alert) this.alert_until = now + 0.8;
		if (out.stun > 0) this.paused_until = now + out.stun;
	}

	// What an enemy with a "Verhalten" perceives (see baddie_decide).
	ai_perception() {
		const w2 = this.sprite.width * 0.5, h = this.sprite.height;
		const player = this.game.player_character;
		const alive = player && player !== this && !player.dead() && this.game.running !== false;
		const gravity = Number(this.game.data.properties.gravity) || 0.5;
		// how far a jump carries at the current speed (a chasing enemy runs faster)
		const hop = this.traits.vrun * (this.ai_speed || 1) * (this.traits.jump_vfactor ?? 1) * 2 * this.traits.vjump / gravity;
		const side = dir => (dir === 'left' ? -1 : 1);
		return {
			now: this.game.clock.getElapsedTime(),
			on_ground: this.touching_ground(),
			// swimming or floating (a Bewegungsbereich): 'swim' | 'float' | null
			fluid: this.fluid_mode ?? null,
			on_ladder: Boolean(this.has_trait_at(['ladder'], -0.5, 0.5, -1.1, 1.1)),
			facing: this.last_horizontal_facing ?? (this.traits.start_dir === 'left' ? 'left' : 'right'),
			x: this.mesh.position.x, y: this.mesh.position.y,
			x0: this.initial_position[0], y0: this.initial_position[1],
			half_width: w2,
			player: alive ? {
				dx: player.mesh.position.x - this.mesh.position.x,
				dy: player.mesh.position.y - this.mesh.position.y,
				// how far apart the two centres are when their collision boxes touch
				touch: (player.mesh.position.x >= this.mesh.position.x ?
					w2 * (this.traits.ex_right ?? 1) + player.sprite.width * 0.5 * (player.traits.ex_left ?? 1) :
					w2 * (this.traits.ex_left ?? 1) + player.sprite.width * 0.5 * (player.traits.ex_right ?? 1)),
			} : null,
			clear: dx => !this.has_trait_at(['block_sides'], Math.min(0, dx), Math.max(0, dx), h * 0.5 - 1, h * 0.5 + 1),
			wall: dir => Boolean(dir === 'left' ?
				this.has_trait_at(['block_sides'], -w2 - 1, -w2, 0.1, h - 0.1) :
				this.has_trait_at(['block_sides'], w2, w2 + 1, 0.1, h - 0.1)),
			ground: dir => Boolean(dir === 'left' ?
				this.has_trait_at(['block_above', 'slope'], -w2, -w2 + 1, -1.0, 0.0) :
				this.has_trait_at(['block_above', 'slope'], w2 - 1, w2, -1.0, 0.0)),
			landing: dir => Boolean(this.has_trait_at(['block_above', 'slope'], side(dir) * hop - 2, side(dir) * hop + 2, -1.0, 0.0)),
			clearable: dir => this.can_jump_over(dir),
			safe_drop: dir => this.safe_drop(dir),
			ladder_up: Boolean(this.has_trait_at(['ladder'], -0.5, 0.5, 0.1, 1.1)),
			ladder_down: Boolean(this.has_trait_at(['ladder'], -0.5, 0.5, -1.1, -0.1)),
			ladder_near: (way, reach) => {
				const [y0, y1] = way === 'up' ? [0.1, 1.1] : [-1.1, -0.1];
				for (let d = 0; d <= reach; d += 6)
					for (const dx of d ? [d, -d] : [0])
						if (this.has_trait_at(['ladder'], dx - 0.5, dx + 0.5, y0, y1)) return dx;
				return null;
			},
		};
	}

	// "Intelligenz" (traits.js): the optional abilities of a walking enemy.
	// Only enemies use it; the trait is looked up once.
	movement_abilities() {
		if (this._abilities === undefined) {
			// only walking behaviours (ticks hidden after switching to e.g. Flatterer count for nothing)
			const walks = ['guard', 'hunter', 'coward'].includes(this.behavior?.type ?? 'guard');
			this._abilities = this.character_trait === 'baddie' && walks && typeof baddie_moves === 'function' ?
				baddie_moves(this.sprite?.traits?.smart) : {};
		}
		return this._abilities;
	}

	// Height of this enemy's jump in pixels (vy = vjump, minus gravity every step).
	jump_height() {
		const gravity = Number(this.game.data.properties.gravity) || 0.5;
		const v = Number(this.traits.vjump) || 0;
		return v * v / (2 * gravity);
	}

	// The wall ahead is low enough to jump over: above the jump height, there is room.
	can_jump_over(dir) {
		const w2 = this.sprite.width * 0.5, h = this.sprite.height;
		const x0 = dir === 'left' ? -w2 - 6 : w2, x1 = dir === 'left' ? -w2 : w2 + 6;
		const top = this.jump_height();
		if (top < 4) return false;
		return !this.has_trait_at(['block_sides'], x0, x1, top, top + h - 1);
	}

	// Below the ledge ahead there is ground – at most five blocks down.
	safe_drop(dir) {
		const w2 = this.sprite.width * 0.5;
		const x0 = dir === 'left' ? -w2 - 2 : w2, x1 = dir === 'left' ? -w2 : w2 + 2;
		return Boolean(this.has_trait_at(['block_above', 'slope'], x0, x1, -5 * 24, -1.0));
	}

	// One step of the patrol with abilities: slopes are ground, low walls are
	// jumped over, gaps jumped across, ledges dropped down. Without abilities the
	// classic code below runs unchanged.
	smart_patrol_step(dir, a) {
		const w2 = this.sprite.width * 0.5, h = this.sprite.height;
		const key = dir === 'left' ? KEY_LEFT : KEY_RIGHT;
		const turn = () => { this.intention.direction = dir === 'left' ? 'right' : 'left'; };
		const ground_traits = a.slopes ? ['block_above', 'slope'] : ['block_above'];
		const wall_traits = a.slopes ? ['block_sides'] : ['block_sides', 'slope'];
		const ground = dir === 'left' ?
			this.has_trait_at(ground_traits, -w2 - 1, -w2, -1.0, 0.0) :
			this.has_trait_at(ground_traits, w2 - 1, w2, -1.0, 0.0);
		const wall = dir === 'left' ?
			this.has_trait_at(wall_traits, -w2 - 1, -w2, 0.1, h - 0.1) :
			this.has_trait_at(wall_traits, w2, w2 + 1, 0.1, h - 0.1);
		// walking up a slope: the slope under the feet counts as ground as well
		const on_slope = a.slopes && this.has_trait_at(['slope'], -0.5, 0.5, -1.0, 0.1);
		if (wall) {
			if (a.obstacles && this.can_jump_over(dir)) { this.pressed_keys[key] = true; this.pressed_keys[KEY_JUMP] = true; }
			else turn();
		} else if (ground || on_slope) {
			this.pressed_keys[key] = true;
		} else {
			const hop = this.traits.vrun * (this.traits.jump_vfactor ?? 1) * 2 * this.traits.vjump /
				(Number(this.game.data.properties.gravity) || 0.5);
			const s = dir === 'left' ? -1 : 1;
			const landing = this.has_trait_at(['block_above', 'slope'], s * hop - 2, s * hop + 2, -1.0, 0.0);
			if (a.gaps && landing) { this.pressed_keys[key] = true; this.pressed_keys[KEY_JUMP] = true; }
			else if (a.drop && this.safe_drop(dir)) this.pressed_keys[key] = true;
			else if (Math.random() < this.traits.jump_from_edge_probability / 100.0) {
				this.pressed_keys[key] = true;
				this.pressed_keys[KEY_JUMP] = true;
			} else turn();
		}
	}

	// Speed added by a conveyor belt or escalator under the character (0 = none).
	conveyor_push() {
		// Not while jumping off (vy > 0); touching_ground() has no side effects.
		if (this.vy > 0.01 || !this.touching_ground()) return 0;
		let entry = this.has_trait_at(['conveyor'], -0.5, 0.5, -1.0, -0.01);
		if (!entry) {
			// Escalator: a slope that is also a conveyor; the slope test checks the surface.
			const slope = this.has_trait_at(['slope'], -0.5, 0.5, -0.01, 0.1);
			if (slope && 'conveyor' in this.game.data.sprites[slope.sprite_index].traits) entry = slope;
		}
		if (!entry) return 0;
		const belt = this.game.data.sprites[entry.sprite_index].traits.conveyor;
		if (this.character_trait === 'baddie' && belt.moves_baddies === false) return 0;
		const speed = Number(belt.speed) || 0;
		return belt.direction === 'left' ? -speed : speed;
	}

	// "!" above an enemy that just noticed the player.
	update_alert_icon() {
		const show = this.active && this.game.clock.getElapsedTime() < this.alert_until;
		if (!show && !this.alert_mesh) return;
		if (!this.alert_mesh) {
			const template = this.game.alert_icon_template();
			if (!template || !this.mesh.parent) return;
			this.alert_mesh = template.clone();
			this.alert_mesh.geometry = template.geometry.clone();
			this.mesh.parent.add(this.alert_mesh);
		}
		this.alert_mesh.visible = show;
		if (show) this.alert_mesh.position.set(this.mesh.position.x,
			this.mesh.position.y + this.sprite.height * this.traits.ex_top + 7, 1.0);
	}

	// The classic enemy: walk, turn at walls and ledges (or jump off them).
	simulate_patrol() {

		if (this.traits.patrols) {
			this.intention ??= {
				direction: this.patrol_direction(),
				duration: this.patrol_duration(),
			};

			if (this.intention.duration !== null) {
				this.intention.duration -= 1;
				if (this.intention.duration <= 0) {
					if (this.intention.direction === 'stay') {
						this.intention.direction = this.intention.old_direction;
						this.intention.duration = this.patrol_duration();
					} else {
						this.intention.old_direction = this.intention.direction;
						this.intention.direction = 'stay';
						this.intention.duration = this.break_duration();
					}
				}
			}


			const range = (this.behavior?.range ?? 0) * 24;
			if (range > 0) {
				const from_start = this.mesh.position.x - this.initial_position[0];
				if (this.intention.direction === 'left' && from_start <= -range) this.intention.direction = 'right';
				else if (this.intention.direction === 'right' && from_start >= range) this.intention.direction = 'left';
			}

			if (this.traits.affected_by_gravity && !this.ai_no_gravity) {
				if (this.standing_on_ground()) {
					this.pressed_keys[KEY_LEFT] = false;
					this.pressed_keys[KEY_RIGHT] = false;
					this.pressed_keys[KEY_UP] = false;
					this.pressed_keys[KEY_DOWN] = false;
					this.pressed_keys[KEY_JUMP] = false;
					const abilities = this.movement_abilities();
					if ((abilities.slopes || abilities.obstacles || abilities.gaps || abilities.drop) &&
						(this.intention.direction === 'left' || this.intention.direction === 'right')) {
						this.smart_patrol_step(this.intention.direction, abilities);
					} else if (this.intention.direction === 'left') {
						if (this.has_trait_at(['block_above'], -this.sprite.width * 0.5 - 1, -this.sprite.width * 0.5, -1.0, 0.0)) {
							if (this.has_trait_at(['block_sides', 'slope'], -this.sprite.width * 0.5 - 1, -this.sprite.width * 0.5, 0.1, this.sprite.height - 0.1)) {
								this.intention.direction = 'right';
							} else {
								this.pressed_keys[KEY_LEFT] = true;
							}
						} else {
							if (this.has_trait_at(['block_sides', 'slope'], this.sprite.width * 0.5 - 1, this.sprite.width * 0.5, 0.1, this.sprite.height - 0.1)) {
								this.intention.direction = 'right';
							} else {
								if (Math.random() < this.traits.jump_from_edge_probability / 100.0) {
									this.pressed_keys[KEY_LEFT] = true;
									this.pressed_keys[KEY_JUMP] = true;
								} else {
									this.intention.direction = 'right';
								}
							}
						}
					} else if (this.intention.direction === 'right') {
						if (this.has_trait_at(['block_above'], this.sprite.width * 0.5 - 1, this.sprite.width * 0.5, -1.0, 0.0)) {
							if (this.has_trait_at(['block_sides', 'slope'], this.sprite.width * 0.5, this.sprite.width * 0.5 + 1, 0.1, this.sprite.height - 0.1)) {
								this.intention.direction = 'left';
							} else {
								this.pressed_keys[KEY_RIGHT] = true;
							}
						} else {
							if (this.has_trait_at(['block_sides', 'slope'], this.sprite.width * 0.5, this.sprite.width * 0.5 + 1, 0.1, this.sprite.height - 0.1)) {
								this.intention.direction = 'left';
							} else {
								if (Math.random() < this.traits.jump_from_edge_probability / 100.0) {
									this.pressed_keys[KEY_RIGHT] = true;
									this.pressed_keys[KEY_JUMP] = true;
								} else {
									this.intention.direction = 'left';
								}
							}
						}
					}
				}
			} else {
				this.pressed_keys[KEY_LEFT] = false;
				this.pressed_keys[KEY_RIGHT] = false;
				this.pressed_keys[KEY_UP] = false;
				this.pressed_keys[KEY_DOWN] = false;
				this.pressed_keys[KEY_JUMP] = false;
				if (this.intention.direction === 'left') {
					if (this.has_trait_at(['block_sides'], -this.sprite.width * 0.5 - 1, -this.sprite.width * 0.5, 0.1, this.sprite.height - 0.1)) {
						this.intention.direction = 'right';
					} else {
						this.pressed_keys[KEY_LEFT] = true;
					}
				} else if (this.intention.direction === 'right') {
					if (this.has_trait_at(['block_sides'], this.sprite.width * 0.5, this.sprite.width * 0.5 + 1, 0.1, this.sprite.height - 0.1)) {
						this.intention.direction = 'left';
					} else {
						this.pressed_keys[KEY_RIGHT] = true;
					}
				}
			}
		}
	}

	hit_paused() {
		return this.character_trait === 'baddie' && this.paused_until > this.game.clock.getElapsedTime();
	}

	invincible() {
		return this.game.clock.getElapsedTime() < this.invincible_until;
	}

	accelerated() {
		return this.game.clock.getElapsedTime() < this.accelerated_until;
	}

	vrun_factor() {
		return (this.accelerated() && this.character_trait === 'actor') ? this.speed_boost_vrun : 1.0;
	}

	vjump_factor() {
		return (this.accelerated() && this.character_trait === 'actor') ? this.speed_boost_vjump : 1.0;
	}

	dead() {
		return (this.game.ts_zoom_actor >= 0) && (!this.game.reached_flag);
	}

	die(sprite, trait) {
		if ((!this.game.running) || this.dead() || this.game.reached_flag) return;
		this.combat_visual = null;
		this.hit_flash_until = 0;
		this.game.ts_zoom_actor = this.game.clock.getElapsedTime();
		this.game.lives -= 1;
		if (this.game.lives < 0) this.game.lives = 0;
		this.game.update_stats();
		let self = this;
		if (this.game.lives === 0) {
			this.game.curtain.show('GAME OVER', 0.5, 2.0, function () {
				self.game.stop();
				$('#screen').hide();
			});
		} else {
			this.game.curtain.show(`${this.game.continue_prompt?.() ?? 'Drück eine Taste'}, um fortzufahren`, 0.5, 1.0, function () {
				self.mesh.position.x = self.initial_position[0];
				self.mesh.position.y = self.initial_position[1];
				if (sprite !== null) {
					self.invincible_until = self.game.clock.getElapsedTime() + sprite.traits[trait].damage_cool_down;
				}
				self.game.energy = self.game.data.properties.energy_at_begin;
				self.game.update_stats();
			});
		}
	}

	take_damage_from_sprite(sprite, trait) {
		// for actor
		if ((!this.game.running) || this.dead() || this.game.reached_flag) return;
		if (sprite.traits[trait].damage > 0) {
			this.game.energy -= sprite.traits[trait].damage;
			if (this.game.energy < 0) this.game.energy = 0;
			this.game.update_stats();
			if (this.game.energy === 0) {
				this.die(sprite, trait);
			} else {
				this.invincible_until = this.game.clock.getElapsedTime() + sprite.traits[trait].damage_cool_down;
				// Touching something that hurts looks like a hit: the figure's
				// "Treffer" state (if it has one) and its hit flash.
				this.show_combat_visual('hit');
				this.flash_on_hit();
			}
		}
	}

	take_damage(damage) {
		if (this.character_trait === 'baddie') {
			this.energy -= damage;
			if (this.energy < 0.0) this.energy = 0.0;
			// Optional "Pause nach Treffer": absent or 0 keeps the old behaviour.
			const pause = Number(this.traits.hit_pause) || 0;
			if (pause > 0 && this.energy >= 0.0001)
				this.paused_until = this.game.clock.getElapsedTime() + pause;
			if (this.energy < 0.0001) {
				// remove baddie from game
				this.active = false;
				if (this.alert_mesh) this.alert_mesh.visible = false;
				this.combat_visual = null;
				this.hit_flash_until = 0;
				this.update_state_and_direction('dead', 'front');
				// Beute: an item the enemy leaves behind (a key, a life, coins …)
				this.game.spawn_drop?.(this);
				// this.mesh.visible = false;
			}
		}
	}

	simulation_step(t) {
		if (!this.active) {
			// A dead baddie is already inactive for AI, combat and collisions, but its
			// death pose still has to finish. update_state_and_direction() contains
			// the one-shot animation logic and clamps to the final frame.
			if (this.character_trait === 'baddie' && this.state === 'dead')
				this.update_state_and_direction('dead', this.direction);
			return;
		}
		if (!this.simulate_this) {
			let x0 = this.mesh.position.x - this.sprite.width * 0.5 * this.traits.ex_left;
			let x1 = this.mesh.position.x + this.sprite.width * 0.5 * this.traits.ex_right;
			let y0 = this.mesh.position.y;
			let y1 = this.mesh.position.y + this.sprite.height * this.traits.ex_top;
			let c = this.game.camera;
			if ((x0 >= c.left && x0 <= c.right && y0 >= c.bottom && y0 <= c.top) ||
				(x1 >= c.left && x1 <= c.right && y0 >= c.bottom && y0 <= c.top) ||
				(x0 >= c.left && x0 <= c.right && y1 >= c.bottom && y1 <= c.top) ||
				(x1 >= c.left && x1 <= c.right && y1 >= c.bottom && y1 <= c.top)) {
				console.log('starting simulation');
				this.simulate_this = true;
			}
		}

		if (!this.simulate_this) return;
		// move left / right

		if (this.character_trait === 'baddie') {
			if (this.hit_paused()) {
				// Stunned after a hit: stand still (gravity still applies).
				for (const k of Object.keys(this.pressed_keys)) this.pressed_keys[k] = false;
				this.ai_dy = 0;
				this.ai_speed = 1.0;
				// a lurker that ran into a wall shows its "benommen" pose meanwhile
				this.ai_pose = (this.ai_memory.stunned_until ?? 0) > this.game.clock.getElapsedTime() ? 'stunned' : null;
			} else {
				this.simulate_movement();
			}
			this.update_alert_icon();
		}

		if (this.character_trait === 'actor') {
			this.pressed_keys = this.game.pressed_keys;
			if (this.game.curtain.showing)
				this.pressed_keys = {};
		}

		let entry = this.has_trait_at(['falls_down'], -0.5, 0.5, -1.0, -0.1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			if (!(this.character_trait === 'baddie' && (!sprite.traits.falls_down.falls_on_baddie))) {
				// this.falling_sprite_indices
				if (!entry.falling) {
					for (let sti = 0; sti < sprite.states.length; sti++) {
						if ('crumbling' in sprite.states[sti].traits.falls_down)
							this.game.state_for_mesh[entry.mesh.uuid].state_index = sti;
						this.game.state_for_mesh[entry.mesh.uuid].loop = false;
					}
					if (sprite.traits.falls_down.accumulates) {
						this.game.active_level_sprites[entry.entry_index].accumulated ??= 0;
						this.game.active_level_sprites[entry.entry_index].accumulated += 1;
						let fc = sprite.states[this.game.state_for_mesh[entry.mesh.uuid].state_index].frames.length;
						let fi = Math.floor(this.game.active_level_sprites[entry.entry_index].accumulated / SIMULATION_RATE / sprite.traits.falls_down.timeout * fc);
						if (fi > fc - 1) fi = fc - 1;
						this.game.state_for_mesh[entry.mesh.uuid].frame_index = fi;
					}
					if ((!(sprite.traits.falls_down.accumulates)) || (this.game.active_level_sprites[entry.entry_index].accumulated >= sprite.traits.falls_down.timeout * SIMULATION_RATE)) {
						let t = sprite.traits.falls_down.accumulates ? 0.0 : sprite.traits.falls_down.timeout;
						this.game.active_level_sprites[entry.entry_index].falling = true;
						this.game.future_event_list.insert(this.game.clock.getElapsedTime() + t, { action: 'falls_down', entry_index: entry.entry_index });
						if (!sprite.traits.falls_down.accumulates) {
							this.game.state_for_mesh[entry.mesh.uuid].t0 = this.game.clock.getElapsedTime();
							this.game.state_for_mesh[entry.mesh.uuid].t1 = this.game.clock.getElapsedTime() + sprite.traits.falls_down.timeout;
						}
					}
				}
			}
		}

		let dx = 0;
		let factor = 1;
		if (this.character_trait === 'baddie' && this.pressed_keys[KEY_JUMP]) factor = this.traits.jump_vfactor;
		if (this.character_trait === 'baddie') factor *= this.ai_speed;
		if (this.pressed_keys[KEY_RIGHT]) dx += this.traits.vrun * factor * this.vrun_factor();
		if (this.pressed_keys[KEY_LEFT]) dx -= this.traits.vrun * factor * this.vrun_factor();

		if (this.character_trait === 'actor') {
			if (!this.traits.force_non_controllable)
				dx = 0;
			if (Math.abs(this.traits.force_x) > 0.001) {
				if (!this.dead()) {
					dx += this.traits.force_x;
				}
			}
		}

		// Bewegungsbereiche (movement_regions.js): swimming, floating, a different
		// gravity or a current. The player character and every enemy that walks
		// (flying and stomping behaviours move themselves); old games have none.
		const move = (this.character_trait === 'actor' || (this.character_trait === 'baddie' && !this.ai_no_gravity)) &&
			typeof MovementRegions !== 'undefined' ?
			MovementRegions.at(this.game.movement_regions, this.mesh.position.x,
				this.mesh.position.y + this.sprite.height * 0.5) : null;
		const fluid = move && (move.mode === 'swim' || move.mode === 'float') ? move : null;
		// the enemy AI looks at this in the next step (swims after the player)
		this.fluid_mode = fluid ? fluid.mode : null;
		const fluid_from = [this.mesh.position.x, this.mesh.position.y];
		let fluid_input_x = 0, fluid_input_y = 0;
		if (fluid) {
			// In the water and in space the figure has momentum: the arrow keys
			// steer in all four directions, the jump key is a swim stroke.
			const actor = this.character_trait === 'actor';
			const controllable = actor ? !this.dead() && this.traits.force_non_controllable !== false : true;
			const key = k => controllable && Boolean(this.pressed_keys[k]);
			const ix = (key(KEY_RIGHT) ? 1 : 0) - (key(KEY_LEFT) ? 1 : 0);
			const iy = (key(KEY_UP) ? 1 : 0) - (key(KEY_DOWN) ? 1 : 0);
			const jump = key(KEY_JUMP);
			const stroke = jump && !this.stroke_held;
			const next = MovementRegions.fluid_step({ vx: this.vx, vy: this.vy },
				{ x: ix, y: iy, stroke }, fluid, {
					vrun: this.traits.vrun * (actor ? this.vrun_factor() : (this.ai_speed || 1)),
					vjump: this.traits.vjump * (actor ? this.vjump_factor() : 1),
					gravity: this.traits.affected_by_gravity === false ? 0 : this.game.data.properties.gravity,
					// only the player leaps out of the water; enemies stay in it
					near_surface: actor && fluid.surface - (this.mesh.position.y + this.sprite.height * 0.5) < this.sprite.height * 0.6,
				});
			this.stroke_held = jump;
			if (stroke && fluid.mode === 'swim' && fluid.stroke > 0) this.stroke_at = this.game.clock.getElapsedTime();
			this.vx = next.vx;
			this.vy = next.vy;
			dx = this.vx + (actor && !this.dead() ? (this.traits.force_x || 0) : 0);
			fluid_input_x = ix;
			fluid_input_y = iy;
		} else if (move) {
			// a current on land pushes like wind
			dx += move.current.x;
		}
		// a stroke needs a fresh press – also after jumping into the water
		if (!fluid) this.stroke_held = Boolean(this.pressed_keys[KEY_JUMP]);

		// Förderband / Rolltreppe: standing on it carries the character along.
		const input_dx = dx;
		const belt = this.conveyor_push();
		dx += belt;

		// if (this.character_trait === 'baddie')
		// 	dx *= (1.0) + ((Math.random() - 0.5) * 2.0) * 3;
		// console.log(this.mesh.position.x, "trying", dx);
		let previous_slope = this.has_trait_at(['slope'], -0.001, 0.001, -0.01, 0.1);
		let prev_dx = dx;

		entry = this.has_trait_at(['slope'], -0.5, 0.5, -0.01, 0.1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			if (sprite.traits.slope.slippery > 0.0) {
				dx += (sprite.traits.slope.direction === 'negative' ? 1 : -1) * sprite.traits.slope.slippery / 100.0 * sprite.height / sprite.width;
			}
		}


		const wanted_dx = dx;
		dx = this.try_move_x(dx);
		// against a wall the drift stops; on land the steps become the momentum
		if (fluid) { if (Math.abs(dx) < Math.abs(wanted_dx) - 0.01) this.vx = 0; }
		else this.vx = dx;
		if (dx !== 0) {
			if (previous_slope) {
				// we were standing on a slope, adjust y accordingly
				let sprite = this.game.data.sprites[previous_slope.sprite_index];
				let tx = (this.mesh.position.x - (previous_slope.mesh.position.x - sprite.width * 0.5)) / sprite.width;
				if (sprite.traits.slope.direction === 'negative') tx = 1.0 - tx;
				tx = tx.clamp(0.0, 1.0);
				let dy = previous_slope.mesh.position.y + tx * sprite.height - this.mesh.position.y;
				this.mesh.position.y += dy;
				// this.mesh.position.y += 0.1;
			}
		}
		let state = 'stand';
		if (this.ai_no_gravity) {
			// Flying / stomping behaviours: no gravity, so no jump or fall poses –
			// except a stomper crashing down.
			this.vy = 0;
			state = (this.behavior?.type === 'stomper' && this.ai_dy < -0.1) ? 'fall' :
				(Math.abs(dx) > 0.1 ? 'walk' : 'stand');
		} else if (fluid) {
			// in the water / in space: on the bottom walk and stand, else jump / fall poses
			state = this.touching_ground() && this.vy <= 0.01 ?
				(Math.abs(fluid_input_x) > 0 ? 'walk' : 'stand') : (this.vy > 0 ? 'jump' : 'fall');
		} else if (this.standing_on_ground()) {
			// On a belt only the character's own steps count as walking.
			state = (Math.abs(belt ? input_dx : dx) > 0.1) ? 'walk' : 'stand';
		} else {
			state = (this.vy > 0) ? 'jump' : 'fall';
		}
		if (this.character_trait === 'actor') {
			if (this.dead())
				state = 'dead';
		}
		// In the water / in space (only states the sprite has; on the bottom it
		// walks and stands): "taucht ab" (down), "taucht auf" (up, and right after
		// a stroke), "treibt" (no key pressed), else "schwimmt" / "schwebt".
		if (fluid && state !== 'dead' && !(this.touching_ground() && this.vy <= 0.01)) {
			const has = k => Boolean(this.sti_for_state[k]);
			const swim = fluid.mode === 'swim';
			const stroked = this.game.clock.getElapsedTime() - (this.stroke_at ?? -1) < 0.35;
			let pose = null;
			if (fluid_input_y < 0 && has('dive')) pose = 'dive';
			else if ((fluid_input_y > 0 || (swim && stroked)) && has('rise')) pose = 'rise';
			else if (fluid_input_x === 0 && fluid_input_y === 0 && !stroked && has('drift')) pose = 'drift';
			else if (has(swim ? 'swim' : 'float')) pose = swim ? 'swim' : 'float';
			if (pose) state = pose;
		}
        // Behaviour poses (only if the sprite has such a state): jagt, benommen, aufgeschlagen.
        // In the air, an enemy with its own jump / fall art shows it even while hunting.
        const own_air_art = (state === 'jump' || state === 'fall') &&
            Object.values(this.sti_for_state[state] ?? {}).some(e => e.confidence >= 100);
        if (state !== 'dead' && this.ai_pose && this.sti_for_state[this.ai_pose] && !own_air_art) state = this.ai_pose;
        // Optional art overlays movement for a short time; physics runs as usual.
        if (state !== 'dead' && this.combat_visual) {
            if (this.game.clock.getElapsedTime() < this.combat_visual.until)
                state = this.combat_visual.kind;
            else
                this.combat_visual = null;
        }
		let direction = this.direction;
		const facing_dx = fluid ? fluid_input_x : (belt ? input_dx : dx);
		if (facing_dx > 0) direction = 'right';
		if (facing_dx < 0) direction = 'left';
		if (this.ai_face && Math.abs(dx) < 0.01) direction = this.ai_face;

		let dy = 0;
		// in the water / in space the arrow keys swim instead of climbing
		entry = fluid ? null : this.has_trait_at(['ladder'], -0.5, 0.5, 0.1, 1.1);
		if (entry) {
			if (this.pressed_keys[KEY_UP]) {
				dy += this.traits.vrun * this.vrun_factor();
				if (this.game.data.sprites[entry.sprite_index].traits.ladder.center)
					this.center_on_entry(entry);
			}
		}
		entry = fluid ? null : this.has_trait_at(['ladder'], -0.5, 0.5, -1.1, -0.1);
		if (entry) {
			if (this.pressed_keys[KEY_DOWN]) {
				dy -= this.traits.vrun * this.vrun_factor();
				if (this.game.data.sprites[entry.sprite_index].traits.ladder.center)
					this.center_on_entry(entry);
			}
		}
		// Climbing a ladder turns the character to the back – slopes and escalators
		// (their height correction below) must not.
		const climbing = dy !== 0;
		// handle slopes: if we're on a slope, correct y coordinate
		// let value = (this.has_trait_at(['block_above', 'ladder'], -0.5, 0.5, -0.1, -0.01) !== null);
		entry = this.has_trait_at(['slope'], -0.5, 0.5, -0.01, 0.1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			let tx = (this.mesh.position.x - (entry.mesh.position.x - sprite.width * 0.5)) / sprite.width;
			if (sprite.traits.slope.direction === 'negative') tx = 1.0 - tx;
			tx = tx.clamp(0.0, 1.0);
			dy = Math.max(dy, entry.mesh.position.y + tx * sprite.height - this.mesh.position.y);
		}

		dy = this.try_move_y(dy);
		if (climbing && Math.abs(dy) > 0.1)
			direction = 'back';
		// "klettert" (if the sprite has it): while climbing – and while holding
		// still in the middle of a ladder, with the animation paused.
		this.climb_hold = false;
		if (this.sti_for_state.climb && state !== 'dead' && state !== 'attack' && state !== 'hit') {
			if (climbing && Math.abs(dy) > 0.1) {
				state = 'climb';
			} else if (this.state === 'climb' && Math.abs(dx) < 0.1 && !this.standing_on_block_top() &&
				this.has_trait_at(['ladder'], -0.5, 0.5, 0.1, 1.1)) {
				state = 'climb';
				this.climb_hold = true;
			}
		}
		if (this.ai_dy) {
			// Flying and stomping enemies move themselves; this is not climbing.
			const moved = this.try_move_y(this.ai_dy);
			this.ai_memory.blocked = this.ai_dy < 0 && moved > this.ai_dy + 0.01;
		}

		if (fluid) {
			// the velocity already has buoyancy, gravity and the current in it
			const wanted_dy = this.vy;
			const moved = this.try_move_y(this.vy);
			if (Math.abs(moved) < Math.abs(wanted_dy) - 0.01) this.vy = 0;
			// Enemies stay in their water (their space): a shark does not swim out
			// of the sea onto the beach, it turns back at the edge.
			if (this.character_trait === 'baddie') {
				const h2 = this.sprite.height * 0.5;
				const inside = (x, y) => MovementRegions.at(this.game.movement_regions, x, y + h2)?.mode === fluid.mode;
				if (!inside(this.mesh.position.x, this.mesh.position.y)) {
					// keep what stays inside: along the surface, it may still swim sideways
					this.mesh.position.y = fluid_from[1];
					this.vy = 0;
					if (!inside(this.mesh.position.x, this.mesh.position.y)) {
						this.mesh.position.x = fluid_from[0];
						this.vx = 0;
					}
				}
			}
		} else {
		// if we're standing, we can jump
		if (this.character_trait === 'baddie' || this.sprite.traits[this.character_trait].can_jump) {
			if (this.standing_on_ground()) {
				this.vy = 0;
				if (this.pressed_keys[KEY_JUMP])
					this.vy = this.traits.vjump * this.vjump_factor();
			}
		}

		if (this.sprite.traits[this.character_trait].affected_by_gravity && !this.ai_no_gravity) {
			let dy = this.try_move_y(this.vy);
			if (Math.abs(dy) < 0.01) this.vy = 0;
		}

		// a Bewegungsbereich may change gravity (the moon) – and push up or down
		this.vy -= this.game.data.properties.gravity * (move ? move.gravity / 100 : 1);
		if (this.vy < -10)
			this.vy = -10;
		if (move && move.current.y) this.try_move_y(move.current.y);
		}

		this.update_state_and_direction(state, direction);

		if (this.character_trait === 'actor') {
			entry = this.has_trait_at(['pickup'], -this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
				this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				let entry_lives = sprite.traits.pickup.lives;
				if (!(entry_lives > 0 && this.game.lives >= this.game.data.properties.max_lives)) {
					let x = entry.mesh.position.x;
					let y = entry.mesh.position.y;
					let x0 = x - sprite.width / 2;
					let x1 = x + sprite.width / 2;
					let y0 = y;
					let y1 = y + sprite.height;
					this.game.interval_tree_x.remove([x0, x1], entry.entry_index);
					this.game.interval_tree_y.remove([y0, y1], entry.entry_index);
					this.game.transitioning_sprites['pickup'] ??= {};
					this.game.transitioning_sprites['pickup'][entry.entry_index] = { t0: t, y0: entry.mesh.position.y };
					this.game.points += sprite.traits.pickup.points ?? 0;
					this.game.lives += sprite.traits.pickup.lives ?? 0;
					if (this.game.lives > this.game.data.properties.max_lives)
						this.game.lives = this.game.data.properties.max_lives;
					this.game.energy += sprite.traits.pickup.energy ?? 0;
					if (this.game.energy > this.game.data.properties.max_energy)
						this.game.energy = this.game.data.properties.max_energy;
					if ((sprite.traits.pickup.invincible ?? 0) > 0.0) {
						this.invincible_until = t + sprite.traits.pickup.invincible;
					}
					if ((sprite.traits.pickup.speed_boost_duration ?? 0) > 0.0) {
						this.accelerated_until = t + sprite.traits.pickup.speed_boost_duration;
						this.speed_boost_vrun = sprite.traits.pickup.speed_boost_vrun;
						this.speed_boost_vjump = sprite.traits.pickup.speed_boost_vjump;
					}
					this.game.update_stats();
				}
			}

			entry = this.has_trait_at(['key'], -this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
				this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				let x = entry.mesh.position.x;
				let y = entry.mesh.position.y;
				let x0 = x - sprite.width / 2;
				let x1 = x + sprite.width / 2;
				let y0 = y;
				let y1 = y + sprite.height;
				this.game.interval_tree_x.remove([x0, x1], entry.entry_index);
				this.game.interval_tree_y.remove([y0, y1], entry.entry_index);
				this.game.transitioning_sprites['pickup'] ??= {};
				this.game.transitioning_sprites['pickup'][entry.entry_index] = { t0: t, y0: entry.mesh.position.y };
				console.log('picking up key!');
				console.log(this.game.active_level_sprites[entry.entry_index]);
				this.game.found_keys[entry.door_code] = true;
				this.game.update_stats();
			}

			for (let mesh of this.game.overlay_meshes)
				mesh.visible = false;
			this.game.action_key_targets = {};

			entry = this.has_trait_at(['door'],
				-this.traits.ex_left * this.sprite.width * 0.5 - 0.1 - 100,
				this.traits.ex_right * this.sprite.width * 0.5 + 0.1 + 100,
				-0.1 - 100,
				this.traits.ex_top * this.sprite.height + 0.1 + 100);
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				// console.log(sprite);
				// console.log(`door here - closed: ${entry.door_closed} - x/y sense: ${sprite.traits.door.xsense} / ${sprite.traits.door.ysense}`);

				if (sprite.traits.door.automatic) {
					this.game.open_door_intent(entry.entry_index, t);
				} else {
					let ok = true;
					if (this.game.active_level_sprites[entry.entry_index].door_closed === false) {
						ok = false;
						if (this.has_trait_at(['door'],
							-this.traits.ex_left * this.sprite.width * 0.25 - 0.1,
							this.traits.ex_right * this.sprite.width * 0.25 + 0.1,
							-0.1,
							this.traits.ex_top * this.sprite.height + 0.1) === null) {
							ok = true;
						}
					}
					if (ok) {
						this.game.active_level_sprites[entry.entry_index].overlay_mesh.visible = true;
						this.game.action_key_targets.door ??= [];
						this.game.action_key_targets.door.push(entry.entry_index);
					}
				}
			}

			entry = this.has_trait_at(['text'],
				-this.traits.ex_left * this.sprite.width * 0.5 - 10,
				this.traits.ex_right * this.sprite.width * 0.5 + 10,
				-10,
				this.traits.ex_top * this.sprite.height + 10);
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				this.game.active_level_sprites[entry.entry_index].overlay_mesh.visible = true;
				this.game.action_key_targets.text ??= [];
				this.game.action_key_targets.text.push(entry.entry_index);
			}

			entry = this.has_trait_at(['checkpoint'], -this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
				this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				this.initial_position = [entry.mesh.position.x, entry.mesh.position.y];
				for (let sti = 0; sti < sprite.states.length; sti++) {
					if ('active' in sprite.states[sti].traits.checkpoint)
						this.game.state_for_mesh[entry.mesh.uuid].state_index = sti;
				}
			}

			if (!(this.invincible() || this.dead())) {
				entry = this.has_trait_at(['trap'], -this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
					this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
				if (entry) {
					let sprite = this.game.data.sprites[entry.sprite_index];
					this.take_damage_from_sprite(sprite, 'trap');
				}
			}

			if (!this.game.reached_flag) {
				entry = this.has_trait_at(['level_complete'], -this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
					this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
				if (entry) {
					this.game.reached_flag = true;
					this.game.ts_zoom_actor = this.game.clock.getElapsedTime();
					let self = this;
					let delta = entry.delta ?? 1;
					let next_level_index = self.game.get_next_level_index(delta);
					if (next_level_index >= 0 && next_level_index < self.game.data.levels.length) {
						let next_level_title = self.game.data.levels[next_level_index].properties.name.trim();
						if (next_level_title.length > 0) {
							next_level_title = `<div><span style='color: #aaa;'>Next up:</span> ${next_level_title}</div>`;
						}
						this.game.curtain.show(`LEVEL COMPLETE!${next_level_title}`, 0.5, 1.0, function () {
							self.game.level_index = self.game.get_next_level_index(delta);
							self.game.setup();
							self.game.run();
						});
					} else {
						this.game.curtain.show('THE END', 0.5, 2.0, function () {
							self.game.stop();
							$('#screen').hide();
						});
					}
					// let sprite = this.game.data.sprites[entry.sprite_index];
					// for (let sti = 0; sti < sprite.states.length; sti++) {
					// 	if ('active' in sprite.states[sti].traits.checkpoint)
					// 		this.game.state_for_mesh[entry.mesh.uuid].state_index = sti;
					// }
				}
			}

			if (!this.dead()) {
				entry = this.has_baddie_at(-this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
					this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
				// Beute "beim Berühren": caught – the enemy lets go of what it carries
				// (once; spawn_drop remembers). Also while blinking after a hit.
				if (entry?.traits?.drop?.on_touch === true && !entry.dropped) this.game.spawn_drop?.(entry);
				if (entry && !this.invincible()) {
					this.take_damage_from_sprite(entry.sprite, 'baddie');
				}
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
			if (!this.dead()) {
				if (this.mesh.position.y < this.game.miny - this.game.screen_pixel_height * 1.5) this.die(null, null);
			}
			if (this.pressed_keys[KEY_ACTION]) {
				for (let entry_index of (this.game.action_key_targets.door ?? [])) {
					this.game.toggle_door_intent(entry_index, t);
				}
				for (let entry_index of (this.game.action_key_targets.text ?? [])) {
					let s = this.game.active_level_sprites[entry_index].text;
					$('#text_frame').text(s);
					$('#text_frame').addClass('showing');
					console.log(s);
				}
			}
		}
	}
}

class VariableClock {
	constructor() {
		this.clock = new THREE.Clock(true);
		this.speed = 0.0;
		this.t0 = 0.0;
		this.t1 = 0.0;
		this.setSpeed(1.0);
		this.start();
	}

	getSpeed() {
		return this.speed;
	}

	setSpeed(speed) {
		if (speed !== this.speed) {
			this.t0 = this.getElapsedTime();
			this.t1 = this.clock.getElapsedTime();
			this.speed = speed;
		}
	}

	getElapsedTime() {
		return this.t0 + (this.clock.getElapsedTime() - this.t1) * this.speed;
	}

	start() {
		this.clock.start();
	}

	delta(d) {
		let s = this.getSpeed();
		s += d;
		if (s < 0.0) s = 0.0;
		if (s > 10.0) s = 10.0;
		this.setSpeed(s);
		add_console_message(`Geschwindigkeit: ${s.toFixed(1)}`)
	}
}

class Curtain {
	constructor(game) {
		this.game = game;
		this.oncomplete = null;
		this.showing = false;
		this.ts_continue = 0;
	}

	show(html, text_delay, key_delay, oncomplete) {
		setTimeout(function () {
			$('#curtain_text').html(html).addClass('showing');
		}, text_delay * 1000.0);
		$('#curtain').addClass('showing');
		this.oncomplete = oncomplete;
		this.showing = true;
		this.ts_continue = this.game.clock.getElapsedTime() + key_delay;
	}

	hide() {
		$('#curtain_text').empty().removeClass('showing');
		$('#curtain').removeClass('showing');
		this.game.ts_zoom_actor = -1;
		this.showing = false;
		this.ts_continue = 0;
	}
}

class Game {
	constructor() {
		let self = this;
		this.data = null;
		this.curtain = new Curtain(this);
		console.log(window.location);
		this.development = window.location.search.substring(0, 4) === '?dev';
		this.spritesheet_info = null;
		this.spritesheets = null;
		// a mesh for every sprite (not regarding state or frame)
		this.mesh_catalogue = [];
		this.overlay_mesh_catalogue = {};
		this.running = false;
		this.level_index = 0;
		this.layers = [];
		this.meshes_for_sprite = [];
		this.state_for_mesh = {};
		this.geometry_and_material_for_frame = [];
		this.animated_sprites = [];
		this.transitioning_sprites = {};
		this.interval_tree_x = new IntervalTree();
		this.interval_tree_y = new IntervalTree();
		this.frame = 0;
		this.dynamic_interval_frame = -1;
		this.dynamic_interval_tree_x = new IntervalTree();
		this.dynamic_interval_tree_y = new IntervalTree();
		this.active_level_sprites = [];
		this.overlay_meshes = [];
		this.action_key_targets = {};
		this.future_event_list = new FutureEventList();
		this.pointer_client = null;
		this.pointer_world = { valid: false, x: 0, y: 0 };
		this.key_actions = controls_key_map(null);
		this.reset();
		this.combat = new CombatSystem(this);
		register_swing(this.combat);
		register_projectile(this.combat);
		window.addEventListener('resize', () => {
			self.handle_resize();
		});
		window.addEventListener('keydown', (e) => {
			// Custom keys such as Tab or Alt must not trigger browser actions while
			// playing. The established default keys keep their old behaviour.
			if (this.running && this.key_actions.has(e.code) && !DEFAULT_CONTROL_KEYS.has(e.code))
				e.preventDefault();
			this.handle_key_down(e.code)
		});
		window.addEventListener('keyup', (e) => {
			this.handle_key_up(e.code)
		});
		window.addEventListener('touchstart', (e) => {
			const first = !this.touch_seen;
			this.touch_seen = true;
			$('#touch_controls').show();
			// the start screen now explains the touch controls
			if (first) this.render_start_screen();
		});
		window.addEventListener('mousemove', (e) => {
			this.pointer_client = { x: e.clientX, y: e.clientY };
			this.update_pointer_world(e.clientX, e.clientY);
		});
		window.addEventListener('blur', () => {
			this.pointer_world.valid = false;
			this.pointer_client = null;
			// Alt+Tab, the Windows key or a system dialog steal the key-up event:
			// release every key so the figure does not keep running.
			for (const k of Object.keys(this.pressed_keys ?? {})) this.pressed_keys[k] = false;
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
			label: '⤒',
			css: {
				right: '10vh',
				bottom: '10vh',
			},
		});
		// Attack buttons: only shown when the figure of the current level can
		// attack that way (update_touch_buttons, called for every level).
		this.touch_melee_button = new TouchButton({
			element: $('#touch_controls'),
			game: self,
			key: KEY_MELEE,
			radius: '14vh',
			label: '⚔',
			css: { right: '33vh', bottom: '6vh' },
		});
		this.touch_ranged_button = new TouchButton({
			element: $('#touch_controls'),
			game: self,
			key: KEY_RANGED,
			radius: '14vh',
			label: '➶',
			css: { right: '13vh', bottom: '33vh' },
		});
		this.update_touch_buttons();
	}

	reset() {
		this.combat?.reset();
		this.old_yt_tag = null;
		this.time_meshes = [];
		this.level_index = 0;
		this.next_level_index = 0;
		this.lives = 5;
		this.energy = 100;
		this.found_keys = {};
		console.log('RESET', this.next_level_index);
		this.handle_resize();
		this.stop();
		this.just_started = true;
		$('#overlay').show();
		$('#screen').hide();
		this.curtain.hide();
		$('#text_frame').removeClass('showing');

		this.points = 0;

		if (this.data === null)
			return;

		this.lives = this.data.properties.lives_at_begin;
		this.energy = this.data.properties.energy_at_begin;
		this.points = 0;
	}

	// Sprite sheet material with a blend mode (backdrops.js); null = plain.
	blend_material(sheet_index, mode) {
		const base = this.spritesheets[sheet_index];
		mode = blend_mode_of(mode);
		if (!mode || !base) return base;
		this.blend_materials ??= {};
		const key = `${sheet_index}:${mode}`;
		this.blend_materials[key] ??= blended_copy(base, mode);
		return this.blend_materials[key];
	}

	// Beute (traits.baddie.drop = { sprite_index, door_code }): a defeated enemy
	// leaves a sprite behind that can be collected like a placed one – a key
	// (with its door code) or anything "man kann es einsammeln". Absent = nothing.
	spawn_drop(owner) {
		const drop = owner?.traits?.drop;
		const si = drop?.sprite_index;
		const sprite = Number.isInteger(si) ? this.data.sprites[si] : null;
		if (!sprite || owner.dropped || !this.mesh_catalogue[si]) return null;
		if (!('pickup' in sprite.traits) && !('key' in sprite.traits)) return null;
		owner.dropped = true;
		const mesh = this.mesh_catalogue[si].clone();
		mesh.geometry = mesh.geometry.clone();
		mesh.geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([1.0, 1.0, 1.0, 1.0]), 1));
		if (owner.mesh.userData?.blend) {
			mesh.material = this.blend_material(this.geometry_and_material_for_frame[si][0][0].sheet, owner.mesh.userData.blend);
			mesh.userData.blend = owner.mesh.userData.blend;
		}
		const x = owner.mesh.position.x, y = owner.mesh.position.y;
		mesh.position.set(x, y, 0);
		(owner.mesh.parent ?? this.scene).add(mesh);
		const entry = { layer_index: null, sprite_index: si, mesh: mesh };
		for (const trait of Object.keys(sprite.traits))
			for (const [key, data] of Object.entries(SPRITE_TRAITS[trait]?.placed_properties ?? {}))
				entry[key] = data.type === 'bool' ? Boolean(data.default) : data.default;
		if ('key' in sprite.traits) entry.door_code = Number.isInteger(drop.door_code) ? drop.door_code : 0;
		const index = this.active_level_sprites.length;
		this.active_level_sprites.push(entry);
		this.interval_tree_x.insert([x - sprite.width / 2, x + sprite.width / 2], index);
		this.interval_tree_y.insert([y, y + sprite.height], index);
		// animated like placed sprites (coins spin, keys glint)
		this.meshes_for_sprite[si].push(mesh);
		this.state_for_mesh[mesh.uuid] = { state_index: 0, frame_offset: 0, frame_index: 0, loop: true };
		return entry;
	}

	// Material for a frame, honouring a layer's Mischmodus (stored on the mesh).
	material_for_frame(info, mesh) {
		const mode = mesh?.userData?.blend;
		return mode ? this.blend_material(info.sheet, mode) : info.material;
	}

	async load(tag) {
		// load game json
		this.reset();
		if (window.yt_player !== null) {
			try {
				window.yt_player.pauseVideo();
			} catch { }
		}

		this.data = await (await fetch(`/gen/games/${tag}.json`)).json();
		// Saved games refer to sprites by ID (game_ids.js); the engine keeps
		// working with array indices. Old games already hold indices.
		resolve_sprite_references_to_indices(this.data);
		this.spritesheet_info = await (await fetch(`/gen/spritesheets/${tag}.json`)).json();
		this.spritesheets = [];
		for (let i = 0; i < this.spritesheet_info.spritesheets.length; i++) {
			console.log(this.spritesheet_info.spritesheets[i]);
			let blob = await (await fetch(`/gen/spritesheets/${this.spritesheet_info.spritesheets[i]}`)).blob();
			let texture = new THREE.Texture();
			texture.image = await createImageBitmap(blob);
			// texture.magFilter = THREE.NearestFilter;
			texture.needsUpdate = true;
			let material = new THREE.ShaderMaterial({
				uniforms: {
					texture1: { value: texture },
				},
				transparent: true,
				vertexShader: shaders.get('basic.vs'),
				fragmentShader: shaders.get('texture.fs'),
				side: THREE.DoubleSide,
			});
			this.spritesheets.push(material);
		}
		// blended copies of the sprite sheet materials, created on first use
		this.blend_materials = {};

		this.overlay_icons_material = {};
		for (let key in OVERLAY_ICONS) {
			let texture = new THREE.Texture();
			let image = new Image();
			image.src = OVERLAY_ICONS[key][2];
			texture.image = image;
			texture.needsUpdate = true;
			let material = new THREE.ShaderMaterial({
				uniforms: {
					texture1: { value: texture },
				},
				transparent: true,
				vertexShader: shaders.get('basic.vs'),
				fragmentShader: shaders.get('texture.fs'),
				side: THREE.DoubleSide,
			});
			this.overlay_icons_material[key] = material;
		}

		// only games with music need the YouTube player
		if ((this.data.properties.yt_tag ?? '').length > 0 ||
			(this.data.levels ?? []).some(level => (level.properties?.yt_tag ?? '').length > 0))
			load_youtube_api();
		$('#game_title').text(this.data.properties.title);
		$('#game_author').text(this.data.properties.author);
		this.render_start_screen();
		this.setup();
		this.ts_zoom_actor = -1;
		this.reached_flag = false;
		$('#stats').removeClass('showing');
		// if (window.location.host.substring(0, 9) === 'localhost') {
		// 	this.run();
		// 	// $('#touch_controls').show();
		// }
	}

	stop() {
		$('#text_frame').removeClass('showing');
		window.yt_pending = null;   // music that is still loading must not start later
		if (window.yt_player !== null) {
			window.yt_player.pauseVideo();
		}
	}

	get_next_level_index(delta) {
		let li = this.level_index + delta;
		while ((li >= 0) && (li < this.data.levels.length) && !this.data.levels[li].properties.use_level)
			li += 1;
		return li;
	}

	update_stats() {
		$('.la_level').html(`Level: ${this.level_index + 1}`);
		$('.la_points').html(`Punkte: ${this.points}`);
		$('.la_lives').html(`Leben: ${this.lives}`);
		$('.la_energy').html(`Energie: ${this.energy}`);
	}

	setup() {
		this.combat.reset();
        for (const character of [this.player_character, ...(this.baddies ?? [])])
            character?.dispose_hit_flash?.();
		this.running = false;
		this.time_meshes = [];
		this.clock = new VariableClock();
		this.scene = new THREE.Scene();
		this.camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
		this.camera.position.x = 0;
		this.camera.position.z = 10;
		this.camera.position.y = 0;
		this.screen_camera = new THREE.OrthographicCamera(-1, 1, -1, 1, 1, 1000);
		this.screen_camera.position.x = 0;
		this.screen_camera.position.z = 10;
		this.screen_camera.position.y = 0;
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
		this.baddies = [];
		this.geometry_and_material_for_frame = [];
		this.animated_sprites = [];
		this.transitioning_sprites = {};
		this.ts_camera_shake = -1;
		this.camera_shake_strength = 0;

		this.minx = 0;
		this.miny = 0;
		this.pointer_world.valid = false;
		this.maxx = 0;
		this.maxy = 0;
		this.pressed_keys = {};
		this.key_actions = controls_key_map(this.data?.properties);
		this.mouse_shot_pending = false;
		this.mouse_shot_world = null;
		this.simulated_to = 0;

		this.interval_tree_x.clear();
		this.interval_tree_y.clear();
		this.frame = 0;
		this.dynamic_interval_frame = -1;
		this.dynamic_interval_tree_x.clear();
		this.dynamic_interval_tree_y.clear();

		this.active_level_sprites = [];
		this.overlay_meshes = [];
		this.action_key_targets = {};
		this.falling_sprite_indices = {};
		this.future_event_list = new FutureEventList();

		this.ts_zoom_actor = -1;
		this.reached_flag = false;

		$('#screen').empty();
		$('#screen').append(this.renderer.domElement);
		// Invisible fullscreen overlays (e.g. #curtain) can intercept canvas clicks.
		// Capture on the play area instead; ignore visible UI and touch controls.
		const play_area = this.renderer.domElement.closest('.play_container_inner');
		// setup() runs again on level changes; do not accumulate click handlers.
		this.mouse_click_surface?.removeEventListener('pointerdown', this.mouse_click_handler, true);
		this.mouse_click_surface = play_area;
		this.mouse_click_handler = (event) => {
			const touch = event.pointerType === 'touch' || event.pointerType === 'pen';
			if (event.target?.closest?.('#touch_controls') || (event.target?.closest?.('#overlay') && !this.curtain?.showing)) return;
			// Touch: a tap closes a sign's text and continues after the curtain,
			// like any key on the keyboard.
			if (touch && ((typeof document !== 'undefined' && document.querySelector('#text_frame.showing')) || this.curtain?.showing)) {
				this.handle_key_down('Tap');
				return;
			}
			if (event.target?.closest?.('#text_frame.showing')) return;
			if (this.running && this.action_box_at?.(event.clientX, event.clientY)) {
				// a tap is over in a moment: hold the key long enough for the game to see it
				this.pressed_keys[KEY_ACTION] = true;
				clearTimeout(this.action_tap_timer);
				this.action_tap_timer = setTimeout(() => { this.pressed_keys[KEY_ACTION] = false; }, 120);
				return;
			}
			// Aiming with the mouse (a touch fires with the ➶ button instead).
			if (event.button !== 0 || (event.pointerType && event.pointerType !== 'mouse') ||
				!this.combat.game_allows_combat()) return;
			const actor = this.player_character;
			const attack = actor?.traits?.attacks?.find(a =>
				a?.slot === 'fern' && a.delivery?.kind === 'projectile');
			if (attack?.delivery?.aim_mode !== 'mouse') return;
			this.pointer_client = { x: event.clientX, y: event.clientY };
			this.update_pointer_world(event.clientX, event.clientY);
			if (!this.pointer_world.valid) return;
			this.mouse_shot_world = { x: this.pointer_world.x, y: this.pointer_world.y };
			this.mouse_shot_pending = true;
		};
		play_area?.addEventListener('pointerdown', this.mouse_click_handler, true);
		this.mesh_catalogue = [];
		this.overlay_mesh_catalogue = {};
		this.layers = [];
		this.visibility_rules = [];

		if (this.data === null)
			return;

		if (this.level_index === 0) {
			this.lives = 1;
			this.energy = 100;
			this.lives = this.data.properties.lives_at_begin;
			this.energy = this.data.properties.energy_at_begin;
		}

		this.update_stats();

		this.screen_pixel_height = this.data.properties.screen_pixel_height;
		this.screen_safe_zone_x = this.data.properties.safe_zone_x;
		this.screen_safe_zone_y = this.data.properties.safe_zone_y;
		if (this.data.properties.show_energy) $('.la_energy').show(); else $('.la_energy').hide();

		let tw = this.spritesheet_info.width;
		let th = this.spritesheet_info.height;
		for (let si = 0; si < this.data.sprites.length; si++) {
			let sprite = this.data.sprites[si];
			this.geometry_and_material_for_frame[si] = [];
			for (let sti = 0; sti < sprite.states.length; sti++) {
				this.geometry_and_material_for_frame[si][sti] = [];
				let state = sprite.states[sti];
				for (let fi = 0; fi < state.frames.length; fi++) {
					let geometry = new THREE.PlaneGeometry(sprite.width, sprite.height);
					geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([1.0, 1.0, 1.0, 1.0]), 1));
					geometry.translate(0, sprite.height / 2, 0);
					let tile_info = this.spritesheet_info.tiles[si][sti][fi];
					let uv = geometry.attributes.uv;
					uv.setXY(0, tile_info[1] / tw, tile_info[2] / th);
					uv.setXY(1, (tile_info[1] + sprite.width * 4) / tw, tile_info[2] / th);
					uv.setXY(2, tile_info[1] / tw, (tile_info[2] + sprite.height * 4) / th);
					uv.setXY(3, (tile_info[1] + sprite.width * 4) / tw, (tile_info[2] + sprite.height * 4) / th);
					// Mischmodus of the sprite (absent = the plain sprite sheet material)
					let material = this.blend_material(tile_info[0], sprite.blend);
					this.geometry_and_material_for_frame[si][sti][fi] = { geometry: geometry, material: material, sheet: tile_info[0] }
					if (sti === 0 && fi === 0) {
						let mesh = new THREE.Mesh(geometry, material);
						// mesh.scale.x *= -1;
						this.mesh_catalogue.push(mesh);
						this.meshes_for_sprite.push([]);
						if (sprite.states[0].frames.length > 1 || sprite.states.length > 1) {
							if (!('actor' in sprite.traits || 'baddie' in sprite.traits))
								this.animated_sprites.push(si);
						}
					}
				}
			}
		}

		for (let key in OVERLAY_ICONS) {
			let width = OVERLAY_ICONS[key][0];
			let height = OVERLAY_ICONS[key][1];
			let geometry = new THREE.PlaneGeometry(width, height);
			geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([1.0, 1.0, 1.0, 1.0]), 1));
			geometry.scale(0.25, -0.25, 1.0);
			let uv = geometry.attributes.uv;
			uv.setXY(0, 0.0, 0.0);
			uv.setXY(1, 1.0, 0.0);
			uv.setXY(2, 0.0, 1.0);
			uv.setXY(3, 1.0, 1.0);
			let material = this.overlay_icons_material[key];
			let mesh = new THREE.Mesh(geometry, material);
			this.overlay_mesh_catalogue[key] = mesh;
		}


		if (this.level_index >= this.data.levels.length)
			return;

		let level = this.data.levels[this.level_index];
		this.scene.background = new THREE.Color(parse_html_color(level.properties.background_color));

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
					let si = placed[0];
					let mesh = this.mesh_catalogue[si].clone();
					mesh.geometry = mesh.geometry.clone();
					// Mischmodus of the layer overrides the sprite's own
					const layer_blend = blend_mode_of(layer.properties.blend);
					if (layer_blend) {
						mesh.material = this.blend_material(this.geometry_and_material_for_frame[si][0][0].sheet, layer_blend);
						mesh.userData.blend = layer_blend;
					}
					mesh.geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([1.0, 1.0, 1.0, 1.0]), 1));
					// mesh.material = mesh.material.clone();
					// console.log(mesh.material.uniforms.texture1);
					let sprite = this.data.sprites[si];
					let effective_collision_detection = layer.properties.collision_detection && (Math.abs(layer.properties.parallax) < 0.0001);
					if (effective_collision_detection) {
						let x = placed[1];
						let y = placed[2];
						let placed_properties = placed[3] ?? {};
						let x0 = x - sprite.width / 2;
						let x1 = x + sprite.width / 2;
						let y0 = y;
						let y1 = y + sprite.height;
						if (x0 < this.minx) this.minx = x0;
						if (x1 > this.maxx) this.maxx = x1;
						if (y0 < this.miny) this.miny = y0;
						if (y1 > this.maxy) this.maxy = y1;
						let active_entry = null;
						if (!('actor' in sprite.traits || 'baddie' in sprite.traits)) {
							this.interval_tree_x.insert([x0, x1], this.active_level_sprites.length);
							this.interval_tree_y.insert([y0, y1], this.active_level_sprites.length);
							active_entry = { layer_index: li, sprite_index: si, mesh: mesh };
							this.active_level_sprites.push(active_entry);
						}
						for (let trait of Object.keys(sprite.traits)) {
							for (let key of Object.keys(SPRITE_TRAITS[trait].placed_properties ?? {})) {
								let data = SPRITE_TRAITS[trait].placed_properties[key];
								let value = (placed_properties[trait] ?? {})[key] ?? data.default;
								// Old games may store placed checkboxes as 0/1 instead of true/false.
								if (data.type === 'bool') value = Boolean(value);
								console.log(`setting placed prop: ${trait} / ${key}: ${value}`);
								if (active_entry !== null) active_entry[key] = value;
								console.log('look', active_entry);
							}
						}
						if (active_entry !== null && ('door' in sprite.traits || 'text' in sprite.traits)) {
							active_entry.door_state = 'idle';
							let overlay_mesh = this.overlay_mesh_catalogue['f_key'].clone();
							overlay_mesh.geometry = overlay_mesh.geometry.clone();
							overlay_mesh.position.set(placed[1], placed[2] + sprite.height / 2, 1.0);
							game_layer.add(overlay_mesh);
							active_entry.overlay_mesh = overlay_mesh;
							overlay_mesh.visible = false;
							this.overlay_meshes.push(overlay_mesh);
						}
					}
					mesh.position.set(placed[1], placed[2], 0);
					this.meshes_for_sprite[si].push(mesh);
					if ('actor' in sprite.traits) {
						this.player_character = new Character(this, si, mesh);
						this.camera_x = placed[1];
						this.camera_y = placed[2] + this.data.properties.screen_pixel_height * 0.3;
					}
					else if ('baddie' in sprite.traits) {
						this.baddies.push(new Character(this, si, mesh));
					}
					let fx = sprite.states[0].properties.phase_x;
					let fy = sprite.states[0].properties.phase_y;
					let fr = sprite.states[0].properties.phase_r;
					let fo = Math.floor((mesh.position.x / sprite.width) * fx + (mesh.position.y / sprite.height) * fy + Math.random() * 1024 * fr);
					this.state_for_mesh[mesh.uuid] = { state_index: 0, frame_offset: fo, frame_index: 0, loop: true };
					if ('door' in sprite.traits) {
						// Placed door state affects both collision and the initial appearance.
						// Keep state 0 as a fallback for older, incomplete door sprites.
						let initially_closed = Boolean(placed[3]?.door?.door_closed ?? true);
						let state_name = initially_closed ? 'closed' : 'open';
						let state_index = sprite.states.findIndex((state) => state_name in (state.traits?.door ?? {}));
						if (state_index !== -1) {
							this.state_for_mesh[mesh.uuid].state_index = state_index;
						}
					}
					game_layer.add(mesh);
				}
			} else if (layer.type === 'backdrop') {
				let backdrop = layer;
				let rect0 = backdrop.rects[0];
				for (let ri = 0; ri < backdrop.rects.length; ri++) {
					let rect = backdrop.rects[ri];
					let geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
					geometry.translate(0.5, 0.5, 0.0);
					geometry.scale(rect.width, rect.height, 1.0);
					geometry.translate(rect.left, rect.bottom, 0);
					// geometry.translate(0, 0, -1);
					// backdrops.js: gradients and effects (incl. pixel grid and dithering)
					// overlapping rectangles: drawn once (backdrops.js: union_of_rects)
					let material = backdrop_material(backdrop, rect0, { stencil_ref: backdrop_stencil_ref(li) });
					if (backdrop.backdrop_type === 'effect' || backdrop.backdrop_type === 'color')
						set_backdrop_uv(geometry, rect);
					let mesh = new THREE.Mesh(geometry, material);
					if (backdrop.backdrop_type === 'effect')
						this.time_meshes.push({ mesh: mesh, speed: backdrop.speed });
					game_layer.add(mesh);
				}
			}
			this.layers.push(game_layer);
		}
		// touch buttons for this level's figure (melee / ranged only if it has them)
		this.update_touch_buttons();
		// Sichtbarkeit beeinflusst nur Three.js-Gruppen, nicht die Kollisionsindizes.
		this.visibility_rules = VisibilityRegions.resolve(level.layers);
		// Bewegungsbereiche: swimming, floating, other gravity, currents (player and walking enemies)
		this.movement_regions = typeof MovementRegions !== 'undefined' ? MovementRegions.resolve(level) : null;
		VisibilityRegions.prepare(this.visibility_rules, this.layers);
		this.update_layer_visibility(true);
		// console.log(this.minx, this.maxx, this.miny, this.maxy);

		for (let i = this.layers.length - 1; i >= 0; i--)
			this.scene.add(this.layers[i]);

		if (this.data.properties.crt_effect) {
			// stencil: overlapping backdrop rectangles are drawn once (union_of_rects)
			this.render_target = new THREE.WebGLRenderTarget(this.width, this.height, { magFilter: THREE.NearestFilter, stencilBuffer: true });
			this.screen_scene = new THREE.Scene();
			let geometry = new THREE.PlaneGeometry(this.width, this.height);
			console.log('size', this.width, this.height, this.data.properties.screen_pixel_height);
			let material = new THREE.ShaderMaterial({
				uniforms: {
					texture1: { value: this.render_target.texture },
					resolution: { value: [this.data.properties.screen_pixel_height / 9.0 * 16.0, this.data.properties.screen_pixel_height] },
				},
				vertexShader: shaders.get('basic.vs'),
				fragmentShader: shaders.get('screen.fs'),
				side: THREE.DoubleSide,
			});
			this.screen_scene.add(new THREE.Mesh(geometry, material));
		}

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
		if (typeof (s) === 'undefined' || s === null)
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

	prepare_run() {
		let self = this;
		if (this.level_index < this.data.levels.length) {
			let level = this.data.levels[this.level_index];
			let level_title = level.properties.name.trim();
			this.curtain.show(`<div>${level_title}</div><div style='margin-top: 1vh; font-size: 70%; opacity: 0.5;'>${this.continue_prompt()}</div>`, 0.0, 0.0, function () {
				self.frame = 0;
				self.clock.start();
				self.run();
			});
		} else {
			this.curtain.show(`<div>THE END</div><div style='margin-top: 1vh; font-size: 70%; opacity: 0.5;'>${this.continue_prompt()}</div>`, 0.0, 0.0, function () {
				self.stop();
			});
		}
		$('#overlay').fadeOut();
	}

	run() {
		// this.setup();
		// this.prepare_run();
		$('#stats').addClass('showing');
		{
			// Level music overrides the game-wide track; an empty level tag uses the game default.
			let game_music = this.data.properties.yt_tag ?? '';
			let level_music = this.data.levels[this.level_index].properties.yt_tag ?? '';
			let yt_tag = level_music.length > 0 ? level_music : (game_music.length > 0 ? game_music : null);
			if (yt_tag !== this.old_yt_tag) {
				if (yt_tag === null) {
					window.yt_pending = null;
					try { window.yt_player?.pauseVideo(); } catch { }
				} else {
					let parts = yt_tag.split('#');
					let s = this.parse_yt_timestamp(parts[1]);
					// (loaded in load() already, so the player is usually ready by now)
					with_youtube((player) => player.loadVideoById(parts[0], s));
				}
				this.old_yt_tag = yt_tag;
			}
		}

		if (this.running) return;
		this.running = true;

		$('#screen').fadeIn();
		requestAnimationFrame((t) => this.render());
	}

	stop() {
		if (!this.running) return;
		this.running = false;
		this.curtain.hide();
		$('#overlay').fadeIn();
		$('#screen').fadeOut();
		$('#stats').removeClass('showing');
		window.yt_pending = null;
		if (window.yt_player !== null) {
			try {
				window.yt_player.pauseVideo();
			} catch { }
		}
	}

	update_layer_visibility(immediate = false) {
		VisibilityRegions.apply(this.visibility_rules, this.layers, this.player_character,
			this.clock.getElapsedTime(), immediate);
	}

	render() {
		this.simulate();
		// Auch nach Respawn, Positionstausch oder Frames ohne Simulationsschritt prüfen.
		this.update_layer_visibility();

		for (let mesh of this.time_meshes) {
			mesh.mesh.material.uniforms.time.value = this.clock.getElapsedTime() * mesh.speed;
		}
		let scale = this.height / this.screen_pixel_height;
		if (this.ts_zoom_actor >= 0) {
			let t = (this.clock.getElapsedTime() - this.ts_zoom_actor) / 3;
			if (t < 0.0) t = 0.0;
			if (t > 1.0) t = 1.0;
			// t = 3 * t * t - 2 * t * t * t;
			t = 1.0 - (1.0 - t) * (1.0 - t) * (1.0 - t);
			scale *= (1.0 + t);
			this.camera_x += (this.player_character.mesh.position.x - this.camera_x) * 0.1;
			this.camera_y += (this.player_character.mesh.position.y - this.camera_y) * 0.1;
		}

		// handle animated sprites

		for (let si of this.animated_sprites) {
			let sprite = this.data.sprites[si];
			for (let mesh of this.meshes_for_sprite[si]) {
				let mesh_state = this.state_for_mesh[mesh.uuid];
				let sti = mesh_state.state_index;
				let fps = sprite.states[sti].properties.fps ?? 8;
				if (mesh_state.loop) {
					mesh_state.frame_index = Math.floor((this.clock.getElapsedTime() * fps) + mesh_state.frame_offset) % sprite.states[sti].frames.length;
					if (mesh_state.frame_index < 0) mesh_state.frame_index += sprite.states[sti].frames.length;
				} else {
					if (mesh_state.t0 && mesh_state.t1) {
						let t = (this.clock.getElapsedTime() - mesh_state.t0) / (mesh_state.t1 - mesh_state.t0);
						if (t > 1.0) t = 1.0;
						mesh_state.frame_index = Math.floor(t * sprite.states[sti].frames.length);
						if (mesh_state.frame_index > sprite.states[sti].frames.length - 1)
							mesh_state.frame_index = sprite.states[sti].frames.length - 1;
					}
				}
				let fi = mesh_state.frame_index;
				if (fi < 0) fi += sprite.states[sti].frames.length;
				if (fi > sprite.states[sti].frames.length - 1) fi = sprite.states[sti].frames.length - 1;
				let uv = mesh.geometry.attributes.uv;
				let tw = this.spritesheet_info.width;
				let th = this.spritesheet_info.height;
				let tile_info = this.spritesheet_info.tiles[si][sti][fi];
				uv.setXY(0, tile_info[1] / tw, tile_info[2] / th);
				uv.setXY(1, (tile_info[1] + sprite.width * 4) / tw, tile_info[2] / th);
				uv.setXY(2, tile_info[1] / tw, (tile_info[2] + sprite.height * 4) / th);
				uv.setXY(3, (tile_info[1] + sprite.width * 4) / tw, (tile_info[2] + sprite.height * 4) / th);
				uv.needsUpdate = true;
				mesh.needsUpdate = true;
			}
		}

		let t1 = this.clock.getElapsedTime();
		// handle transitioning sprites (pickup)
		let delete_keys = [];
		for (let pi in (this.transitioning_sprites ?? {}).pickup ?? {}) {
			let entry = this.active_level_sprites[pi];
			let sprite = this.data.sprites[entry.sprite_index];
			let dt0 = (t1 - this.transitioning_sprites.pickup[pi].t0);
			const duration = Math.max((sprite.traits.pickup ?? {}).duration ?? 0.5, 0.01);
			let dt = dt0 / duration;
			// A collected item jumps up quickly and slows down (ease-out), grows for
			// a moment ("pop") and then fades while it shrinks a little. It rises
			// just as far as before: Bewegung × Ausblenden.
			const k = Math.min(Math.max(dt, 0.0), 1.0);
			const rise = ((sprite.traits.pickup ?? {}).move_up ?? 100) * duration;
			entry.mesh.position.y = this.transitioning_sprites.pickup[pi].y0 + rise * (1.0 - Math.pow(1.0 - k, 3));
			const pop = k < 0.18 ? 1.0 + 0.3 * Math.sin(k / 0.18 * Math.PI * 0.5) : 1.3 - 0.45 * (k - 0.18) / 0.82;
			entry.mesh.scale.set(Math.sign(entry.mesh.scale.x || 1) * pop, pop, 1);
			let t = k < 0.4 ? 1.0 : 1.0 - (k - 0.4) / 0.6;
			t = t * t * (3.0 - 2.0 * t);
			entry.mesh.geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([t, t, t, t]), 1));
			if (dt > 1.0) {
				delete_keys.push(pi);
				entry.mesh.visible = false;
				// entry.mesh.geometry.dispose();
				// entry.mesh.material.dispose();
				// this.scene.remove(entry.mesh);
			}
		}
		for (let pi of delete_keys)
			delete this.transitioning_sprites.pickup[pi];

		// handle transitioning sprites (transition)
		delete_keys = [];
		for (let pi in (this.transitioning_sprites ?? {}).transition ?? {}) {
			// console.log(pi, this.transitioning_sprites.transition[pi]);
			let entry = this.active_level_sprites[pi];
			let sprite = this.data.sprites[entry.sprite_index];
			let si = entry.sprite_index;
			this.state_for_mesh[entry.mesh.uuid].state_index = this.transitioning_sprites.transition[pi].transition_state;
			let sti = this.state_for_mesh[entry.mesh.uuid].state_index;
			let dt0 = (t1 - this.transitioning_sprites.transition[pi].t0);
			let dt = dt0 / ((sprite.traits.transition ?? {}).duration ?? 0.5);
			this.state_for_mesh[entry.mesh.uuid].frame_index = Math.floor(dt * sprite.states[sti].frames.length);
			if (this.transitioning_sprites.transition[pi].reverse_animation)
				this.state_for_mesh[entry.mesh.uuid].frame_index = Math.floor((1.0 - dt) * sprite.states[sti].frames.length);

			// TODO: This animation code is duplicated somewhere
			let fi = this.state_for_mesh[entry.mesh.uuid].frame_index;
			if (fi < 0) fi = 0;
			if (fi > sprite.states[sti].frames.length - 1) fi = sprite.states[sti].frames.length - 1;
			let uv = entry.mesh.geometry.attributes.uv;
			let tw = this.spritesheet_info.width;
			let th = this.spritesheet_info.height;
			let tile_info = this.spritesheet_info.tiles[si][sti][fi];
			uv.setXY(0, tile_info[1] / tw, tile_info[2] / th);
			uv.setXY(1, (tile_info[1] + sprite.width * 4) / tw, tile_info[2] / th);
			uv.setXY(2, tile_info[1] / tw, (tile_info[2] + sprite.height * 4) / th);
			uv.setXY(3, (tile_info[1] + sprite.width * 4) / tw, (tile_info[2] + sprite.height * 4) / th);
			uv.needsUpdate = true;
			entry.mesh.needsUpdate = true;

			this.transitioning_sprites.transition[pi].progress(dt);
			if (dt > 1.0) {
				delete_keys.push(pi);
				this.transitioning_sprites.transition[pi].done();
			}
		}
		for (let pi of delete_keys)
			delete this.transitioning_sprites.transition[pi];

		if (this.player_character) {
			if (this.player_character.invincible() || this.player_character.accelerated()) {
				this.player_character.mesh.visible = (this.frame % 10) < 5;
			} else {
				this.player_character.mesh.visible = true;
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

		let cx = this.camera_x;
		let cy = this.camera_y;
		if (this.ts_camera_shake >= 0) {
			let t = (this.clock.getElapsedTime() - this.ts_camera_shake) / 1.0;
			if (t < 0.0) t = 0.0;
			if (t > 1.0) {
				t = 1.0;
				this.ts_camera_shake = -1.0;
			}
			t = 1.0 - (1.0 - t) * (1.0 - t) * (1.0 - t);
			cx += (Math.random() * 2.0 - 1.0) * this.camera_shake_strength * (1.0 - t);
			cy += (Math.random() * 2.0 - 1.0) * this.camera_shake_strength * (1.0 - t);
		}

		this.camera.left = cx - this.width * 0.5 / scale;
		this.camera.right = cx + this.width * 0.5 / scale;
		this.camera.top = cy + this.height * 0.5 / scale;
		this.camera.bottom = cy - this.height * 0.5 / scale;

		for (let i = 0; i < this.layers.length; i++) {
			this.layers[i].position.x = this.camera_x * this.data.levels[this.level_index].layers[i].properties.parallax;
			this.layers[i].position.y = this.camera_y * this.data.levels[this.level_index].layers[i].properties.parallax;
		}

		this.camera.updateProjectionMatrix();
		this.renderer.setSize(this.width, this.height);
		this.renderer.sortObjects = false;

		// this.renderer.gammaFactor = 2.2;
		// this.renderer.outputEncoding = THREE.sRGBEncoding;

		this.renderer.setRenderTarget(this.data.properties.crt_effect ? this.render_target : null);
		this.renderer.render(this.scene, this.camera);

		if (this.data.properties.crt_effect) {
			this.screen_camera.left = -this.width * 0.5;
			this.screen_camera.right = this.width * 0.5;
			this.screen_camera.bottom = -this.height * 0.5;
			this.screen_camera.top = this.height * 0.5;
			this.screen_camera.updateProjectionMatrix();
			this.renderer.setRenderTarget(null);
			this.renderer.render(this.screen_scene, this.screen_camera);
		}
		if (this.running)
			requestAnimationFrame((t) => this.render());
	}

	resume_game() {
		console.log("RESUME_GAME");
		if (this.lives > 0) {
			this.ts_zoom_actor = -1;
			this.player_character.mesh.position.x = this.player_character.initial_position[0];
			this.player_character.mesh.position.y = this.player_character.initial_position[1];
			this.player_character.invincible_until = this.clock.getElapsedTime() + this.data.properties.respawn_invincible;
			this.update_layer_visibility(true);
		}
	}

	// Built like the overlay icons, but only on first use (see ALERT_ICON).
	alert_icon_template() {
		if (this.alert_icon_mesh !== undefined) return this.alert_icon_mesh;
		const texture = new THREE.Texture();
		const image = new Image();
		image.onload = () => { texture.needsUpdate = true; };
		image.src = ALERT_ICON[2];
		texture.image = image;
		const material = new THREE.ShaderMaterial({
			uniforms: { texture1: { value: texture } },
			transparent: true,
			vertexShader: shaders.get('basic.vs'),
			fragmentShader: shaders.get('texture.fs'),
			side: THREE.DoubleSide,
		});
		const geometry = new THREE.PlaneGeometry(ALERT_ICON[0], ALERT_ICON[1]);
		geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([1.0, 1.0, 1.0, 1.0]), 1));
		geometry.scale(0.25, -0.25, 1.0);
		const uv = geometry.attributes.uv;
		uv.setXY(0, 0.0, 0.0);
		uv.setXY(1, 1.0, 0.0);
		uv.setXY(2, 0.0, 1.0);
		uv.setXY(3, 1.0, 1.0);
		this.alert_icon_mesh = new THREE.Mesh(geometry, material);
		return this.alert_icon_mesh;
	}

	handle_resize() {
		this.width = window.innerWidth;
		this.height = window.innerHeight;

		if (this.height * 16.0 / 9 < this.width)
			$('.play_container_inner').css('width', '').css('height', '100%');
		else
			$('.play_container_inner').css('height', '').css('width', '100%');
		$('body').css('font-size', `${this.height / 30}px`);
	}

	// Start screen: the controls this game really uses, with its own keys.
	render_start_screen() {
		const panel = $('#start_controls');
		if (!panel.length || !this.data) return;
		panel.empty();
		const placed = new Set();
		for (const level of this.data.levels ?? [])
			for (const layer of level.layers ?? [])
				if (layer.type === 'sprites') for (const p of layer.sprites ?? []) placed.add(p[0]);
		const sprites = [...placed].map(si => this.data.sprites[si]).filter(Boolean);
		const has = (fn) => sprites.some(sp => fn(sp.traits ?? {}));
		// the same attack list a Character gets (new melee/ranged traits or old swords)
		const actor_attack = (slot, kind) => has(t => {
			if (!('actor' in t)) return false;
			const attacks = (t.melee_attack?.attack || t.ranged_attack?.attack) && typeof resolved_character_attacks === 'function' ?
				resolved_character_attacks(t, 'actor') : t.actor?.attacks;
			return Array.isArray(attacks) && attacks.some(a => a?.slot === slot && a.delivery?.kind === kind);
		});
		const uses = {
			left: true, right: true, jump: true,
			up: has(t => 'ladder' in t), down: has(t => 'ladder' in t),
			action: has(t => ('door' in t && !t.door?.automatic) || 'text' in t),
			melee: actor_attack('nah', 'swing'),
			ranged: actor_attack('fern', 'projectile'),
		};
		const touch = this.touch_seen || window.matchMedia?.('(pointer: coarse)')?.matches;
		const rows = touch ? [
			['Laufen', ['linker Kreis']],
			...(uses.up ? [['Leiter', ['linker Kreis hoch / runter']]] : []),
			['Springen', ['⤒']],
			...(uses.action ? [['Tür, Text', ['auf das F tippen']]] : []),
			...(uses.melee ? [['Nahkampf', ['⚔']]] : []),
			...(uses.ranged ? [['Fernkampf', ['➶']]] : []),
		] : (() => {
			const keys = resolve_controls(this.data.properties);
			// first keys first (← →), the second keys of the same actions as the alternative (A D)
			const k = (...ids) => [ids.map(id => keys[id][0]).filter(Boolean).map(key_label),
				ids.map(id => keys[id][1]).filter(Boolean).map(key_label)];
			return [
				['Laufen', ...k('left', 'right')],
				...(uses.up ? [['Leiter', ...k('up', 'down')]] : []),
				['Springen', ...k('jump')],
				...(uses.action ? [['Tür, Text', ...k('action')]] : []),
				...(uses.melee ? [['Nahkampf', ...k('melee')]] : []),
				...(uses.ranged ? [['Fernkampf', ...k('ranged')]] : []),
			];
		})();
		for (const [label, keys, alternative] of rows) {
			panel.append($('<div class="label">').text(label));
			const cell = $('<div class="keys">');
			for (const k of keys) cell.append($(touch ? '<span>' : '<span class="key">').text(k));
			if (alternative?.length) {
				cell.append($('<span class="oder">').text('oder'));
				for (const k of alternative) cell.append($('<span class="key alt">').text(k));
			}
			panel.append(cell);
		}
		const fullscreen = typeof window.toggle_game_fullscreen === 'function';
		$('#start_hint').text(touch ?
			(fullscreen ? 'Vollbild: Tipp unten rechts auf ⛶' : '') :
			'Vollbild: Strg + Enter oder ⛶ unten rechts · Esc beendet das Spiel');
	}

	// "Press a key" – or "tap", once the game has been touched.
	continue_prompt() {
		return this.touch_seen ? 'Tipp auf den Bildschirm' : 'Drück eine Taste';
	}

	// Touch buttons for the attacks the figure of this level really has.
	player_attack(slot) {
		const kind = slot === 'nah' ? 'swing' : 'projectile';
		return this.player_character?.traits?.attacks?.find?.(a => a?.slot === slot && a.delivery?.kind === kind) ?? null;
	}

	update_touch_buttons() {
		const melee = Boolean(this.player_attack('nah'));
		const ranged = Boolean(this.player_attack('fern'));
		this.touch_melee_button?.show(melee);
		this.touch_ranged_button?.show(ranged);
		// a single attack button sits right next to the jump button
		this.touch_ranged_button?.bg_element.css(melee ? { right: '13vh', bottom: '33vh' } : { right: '33vh', bottom: '6vh' });
	}

	// A tap (or click) on a visible "F" box above a door or a sign works like
	// the action key.
	action_box_at(clientX, clientY) {
		const rect = this.renderer?.domElement?.getBoundingClientRect?.();
		if (!rect || !(rect.width > 0) || !this.camera) return false;
		const u = (clientX - rect.left) / rect.width, v = (clientY - rect.top) / rect.height;
		if (u < 0 || u > 1 || v < 0 || v > 1) return false;
		const x = this.camera.left + u * (this.camera.right - this.camera.left);
		const y = this.camera.top - v * (this.camera.top - this.camera.bottom);
		const p = new THREE.Vector3();
		for (const mesh of this.overlay_meshes ?? []) {
			if (!mesh.visible) continue;
			mesh.getWorldPosition(p);
			// generous: a fingertip is much bigger than the box
			if (Math.abs(p.x - x) <= 16 && Math.abs(p.y - y) <= 16) return true;
		}
		return false;
	}

	update_pointer_world(clientX, clientY) {
		const rect = this.renderer?.domElement?.getBoundingClientRect?.();
		if (!rect || rect.width <= 0 || rect.height <= 0) {
			this.pointer_world.valid = false;
			return;
		}
		if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
			this.pointer_world.valid = false;
			return;
		}
		const u = (clientX - rect.left) / rect.width;
		const v = (clientY - rect.top) / rect.height;
		this.pointer_world.x = this.camera.left + u * (this.camera.right - this.camera.left);
		this.pointer_world.y = this.camera.top - v * (this.camera.top - this.camera.bottom);
		this.pointer_world.valid = true;
	}


	handle_key_down(key) {
		if (((this.running && this.lives === 0) || (this.level_index >= this.data.levels.length)) && key === 'Escape') {
			this.stop();
			return;
		}
		if ($('#text_frame').hasClass('showing')) {
			$('#text_frame').removeClass('showing');
			return;
		}
		if (this.curtain.showing) {
			if (this.clock.getElapsedTime() > this.curtain.ts_continue) {
				this.curtain.oncomplete();
				this.curtain.hide();
			}
			return;
		}
		if (this.running && key === 'Escape') {
			this.stop();
			return;
		}
		// Keys come from the game's controls (defaults when not customised).
		for (const action of this.key_actions.get(key) ?? []) {
			if ((action === 'melee' || action === 'ranged') && !this.player_character?.traits?.attacks?.length)
				continue;
			this.pressed_keys[ACTION_KEYS[action]] = true;
		}
		if (this.development) {
			if (key === 'Comma') {
				this.clock.delta(-0.1);
			}
			if (key === 'Period') {
				this.clock.delta(0.1);
			}
			if (key === 'KeyS') {
				this.ts_camera_shake = this.clock.getElapsedTime();
			}
		}
	}

	handle_key_up(key) {
		for (const action of this.key_actions.get(key) ?? [])
			this.pressed_keys[ACTION_KEYS[action]] = false;
	}

    // The keyboard and enemy AI request the same registered delivery.
    request_melee_attacks(t) {
        let actor = this.player_character;
        if (!actor || !this.combat.owner_is_alive(actor)) return;
        if (this.pressed_keys[KEY_MELEE]) {
            for (let attack of (Array.isArray(actor.traits.attacks) ? actor.traits.attacks : [])) {
                if (attack?.slot === 'nah' && attack.delivery?.kind === 'swing') {
                    this.combat.request_attack(actor, attack.id, t);
                    break;
                }
            }
        }
        for (let baddie of this.baddies) {
            // No new work for existing games without explicitly enabled attacks.
            if (!Array.isArray(baddie.traits.attacks) || !baddie.traits.attacks.length ||
                !baddie.simulate_this || !this.combat.owner_is_alive(baddie) || baddie.hit_paused()) continue;
            let attack = baddie.traits.attacks.find(a =>
                a?.slot === 'nah' && a.delivery?.kind === 'swing');
            if (!attack || !this.combat.valid_definition(attack)) continue;
            let dx = actor.mesh.position.x - baddie.mesh.position.x;
            let reach = attack.delivery.range_px + (baddie.sprite.width + actor.sprite.width) / 2;
            if (Math.abs(dx) > reach ||
                Math.abs(actor.mesh.position.y - baddie.mesh.position.y) >
                    Math.max(actor.sprite.height, baddie.sprite.height)) continue;
            let facing = baddie.last_horizontal_facing ??
                (baddie.traits.start_dir === 'left' ? 'left' : 'right');
            if ((dx < 0 && facing !== 'left') || (dx > 0 && facing !== 'right')) continue;
            this.combat.request_attack(baddie, attack.id, t);
        }
    }

    // A second input/controller uses the same damage, cooldown and hit pipeline.
    request_ranged_attacks(t) {
        const actor = this.player_character;
        if (!actor || !this.combat.owner_is_alive(actor)) return;
        const actorCenterY = actor.mesh.position.y + actor.sprite.height / 2;
        const clicked = this.mouse_shot_pending;
        const click_target = this.mouse_shot_world;
        this.mouse_shot_pending = false;
        this.mouse_shot_world = null;
        if (this.pressed_keys[KEY_RANGED] || clicked) {
            const attack = actor.traits.attacks?.find(a =>
                a?.slot === 'fern' && a.delivery?.kind === 'projectile');
            if (attack) {
                let aim = null;
                if (attack.delivery?.aim_mode === 'mouse' && !clicked && this.pointer_client)
                    this.update_pointer_world(this.pointer_client.x, this.pointer_client.y);
                const point = clicked ? click_target : this.pointer_world;
                if (attack.delivery?.aim_mode === 'mouse' && point?.valid !== false && point) {
                    const dx = point.x - actor.mesh.position.x;
                    const dy = point.y - actorCenterY;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 1e-6) aim = { x: dx / dist, y: dy / dist };
                }
                if (!clicked || attack.delivery?.aim_mode === 'mouse')
                    this.combat.request_attack(actor, attack.id, t, aim);
            }
        }
        for (const baddie of this.baddies) {
            if (!baddie.simulate_this || !this.combat.owner_is_alive(baddie) || baddie.hit_paused()) continue;
            const attack = baddie.traits.attacks?.find(a =>
                a?.slot === 'fern' && a.delivery?.kind === 'projectile');
            if (!attack || !this.combat.valid_definition(attack)) continue;
            const dx = actor.mesh.position.x - baddie.mesh.position.x;
            const dy = actorCenterY - (baddie.mesh.position.y + baddie.sprite.height / 2);
            const range = attack.delivery.range_px + (actor.sprite.width + baddie.sprite.width) / 2;
            // Stationary dropped bombs have no line-of-sight aiming requirement;
            // they are triggered when the player is nearby, just like other attacks.
            if (attack.delivery?.detonation && attack.delivery.speed_px_s === 0) {
                if (Math.abs(dx) <= attack.delivery.detonation.radius_px +
                    (actor.sprite.width + baddie.sprite.width) / 2 &&
                    Math.abs(dy) <= attack.delivery.detonation.radius_px * 2)
                    this.combat.request_attack(baddie, attack.id, t);
                continue;
            }
            if (attack.delivery?.aim_mode === 'mouse') {
                const dist = Math.hypot(dx, dy);
                if (!(dist > 1e-6) || dist > range) continue;
                this.combat.request_attack(baddie, attack.id, t, { x: dx / dist, y: dy / dist });
                continue;
            }
            if (Math.abs(dx) > range || Math.abs(dy) > actor.sprite.height / 2 + 2)
                continue;
            const facing = baddie.last_horizontal_facing ??
                (baddie.traits.start_dir === 'left' ? 'left' : 'right');
            if ((dx < 0 && facing !== 'left') || (dx > 0 && facing !== 'right')) continue;
            this.combat.request_attack(baddie, attack.id, t, { x: dx < 0 ? -1 : 1 });
        }
    }

	// handle simulation at fixed rate
	simulation_step(t) {
		if (this.player_character !== null)
			this.player_character.simulation_step(t);
		for (let baddie of this.baddies)
			baddie.simulation_step(t);
		if (this.combat.game_allows_combat()) {
			this.request_melee_attacks(t);
			this.request_ranged_attacks(t);
		}

		let next_fel_entry = this.future_event_list.peek();
		while ((next_fel_entry !== null) && (next_fel_entry <= t)) {
			let fel_entry = this.future_event_list.pop();
			if (fel_entry.action === 'falls_down') {
				let sprite = this.data.sprites[this.active_level_sprites[fel_entry.entry_index].sprite_index];
				let mesh = this.active_level_sprites[fel_entry.entry_index].mesh;
				this.falling_sprite_indices[fel_entry.entry_index] = { vy: 0.0, damage: sprite.traits.falls_down.damage, width: sprite.width };
				let x = mesh.position.x;
				let y = mesh.position.y;
				let x0 = x - sprite.width / 2;
				let x1 = x + sprite.width / 2;
				let y0 = y;
				let y1 = y + sprite.height;
				this.interval_tree_x.remove([x0, x1], fel_entry.entry_index);
				this.interval_tree_y.remove([y0, y1], fel_entry.entry_index);
			}
			next_fel_entry = this.future_event_list.peek();
		}
		let delete_these = [];
		for (let entry_index in this.falling_sprite_indices) {
			let falling_sprite = this.falling_sprite_indices[entry_index];
			let mesh = this.active_level_sprites[entry_index].mesh;
			falling_sprite.vy += this.data.properties.gravity;
			mesh.position.y -= falling_sprite.vy;
			if (falling_sprite.damage > 0) {
				let baddie = this.has_baddie_at(mesh.position.x - falling_sprite.width * 0.5, mesh.position.x + falling_sprite.width * 0.5,
					mesh.position.y - 2, mesh.position.y + 2);
				if (baddie !== null) {
					baddie.take_damage(falling_sprite.damage);
				}
			}

			if (mesh.position.y < this.camera.bottom - this.data.properties.screen_pixel_height) {
				mesh.visible = false;
				delete_these.push(entry_index);
			}
		}
		for (let index of delete_these)
			delete this.falling_sprite_indices[index];
		this.combat.step(t);
	}

	simulate() {
		let simulate_to = Math.floor(this.clock.getElapsedTime() * 60.0);
		while (this.simulated_to < simulate_to) {
			this.simulation_step(this.simulated_to / SIMULATION_RATE);
			this.frame++;
			this.simulated_to++;
		}
	}

	update_dynamic_interval_tree_if_necessary() {
		if (this.dynamic_interval_frame !== this.frame) {
			// recreate baddie interval tree
			this.dynamic_interval_tree_x.clear();
			this.dynamic_interval_tree_y.clear();
			for (let bi = 0; bi < this.baddies.length; bi++) {
				let baddie = this.baddies[bi];
				if (!baddie.active) continue;
				let x = baddie.mesh.position.x;
				let y = baddie.mesh.position.y;
				let x0 = x - (baddie.sprite.width / 2) * baddie.traits.ex_left;
				let x1 = x + (baddie.sprite.width / 2) * baddie.traits.ex_right;
				let y0 = y;
				let y1 = y + baddie.sprite.height * baddie.traits.ex_top;
				this.dynamic_interval_tree_x.insert([x0, x1], bi);
				this.dynamic_interval_tree_y.insert([y0, y1], bi);
			}
			this.dynamic_interval_frame = this.frame;
		}
	}

	has_baddie_at(x0, x1, y0, y1) {
		let result_x = new Set();
		for (let i of this.dynamic_interval_tree_x.search([x0, x1]))
			result_x.add(i);
		let result_y = new Set();
		for (let i of this.dynamic_interval_tree_y.search([y0, y1]))
			result_y.add(i);
		let result = [...new Set([...result_x].filter((x) => result_y.has(x)))];
		for (let entry_index of result) {
			let baddie = this.baddies[entry_index];
			if (baddie.active) return baddie;
		}
		return null;
	}

	open_door_intent(entry_index, t) {
		let entry = this.active_level_sprites[entry_index];
		let sprite = this.data.sprites[entry.sprite_index];
		if (entry.door_state === 'opening' || entry.door_closed === false)
			return;
		let ok = false;
		if (sprite.traits.door.lockable) {
			// check if we have correct key
			console.log(`Checking door key: ${entry.door_code}, have: `, this.found_keys)
			if (this.found_keys[entry.door_code] === true) {
				ok = true;
			}
		} else {
			ok = true;
		}
		if (ok) {
			console.log("Now opening door!");
			console.log("sprite", sprite);
			let open_state_index = sprite.states.findIndex((s) => s.traits.door.open);
			let closed_state_index = sprite.states.findIndex((s) => s.traits.door.closed);
			let transition_state_index = sprite.states.findIndex((s) => s.traits.door.transition);
			if (open_state_index === -1) {
				console.log("No open state found for this door!");
				return;
			}
			if (transition_state_index === -1) {
				// no animation, just open the door
				this.active_level_sprites[entry_index].door_closed = false;
				this.state_for_mesh[entry.mesh.uuid].state_index = open_state_index;
				this.state_for_mesh[entry.mesh.uuid].frame_index = 0;
			} else {
				// show the transition animation, open door when animation is done
				entry.door_state = 'opening';
				this.transitioning_sprites['transition'] ??= {};
				this.transitioning_sprites['transition'][entry_index] = {
					t0: t,
					t1: t + sprite.states[transition_state_index].frames.length / (sprite.states[transition_state_index].properties.fps ?? 8),
					transition_state: transition_state_index,
					progress: (t) => {
						if (t > 0.5) this.active_level_sprites[entry_index].door_closed = false;
					},
					done: () => {
						entry.door_state = 'idle';
						this.active_level_sprites[entry_index].door_closed = false;
						this.state_for_mesh[entry.mesh.uuid].state_index = open_state_index;
						this.state_for_mesh[entry.mesh.uuid].frame_index = 0;
					},
				};
			}
		}
	}

	close_door_intent(entry_index, t) {
		let entry = this.active_level_sprites[entry_index];
		let sprite = this.data.sprites[entry.sprite_index];
		if (entry.door_state === 'closing' || entry.door_closed === true)
			return;
		if (sprite.traits.door.closable) {
			console.log("Now closing door!");
			console.log("sprite", sprite);
			let open_state_index = sprite.states.findIndex((s) => s.traits.door.open);
			let closed_state_index = sprite.states.findIndex((s) => s.traits.door.closed);
			let transition_state_index = sprite.states.findIndex((s) => s.traits.door.transition);
			if (closed_state_index === -1) {
				console.log("No closed state found for this door!");
				return;
			}
			if (transition_state_index === -1) {
				// no animation, just close the door
				this.active_level_sprites[entry_index].door_closed = true;
				this.state_for_mesh[entry.mesh.uuid].state_index = closed_state_index;
				this.state_for_mesh[entry.mesh.uuid].frame_index = 0;
			} else {
				// show the transition animation, close door when animation is done
				entry.door_state = 'closing';
				this.transitioning_sprites['transition'] ??= {};
				this.transitioning_sprites['transition'][entry_index] = {
					t0: t,
					t1: t + sprite.states[transition_state_index].frames.length / (sprite.states[transition_state_index].properties.fps ?? 8),
					transition_state: transition_state_index,
					reverse_animation: true,
					progress: (t) => {
						if (t > 0.5) this.active_level_sprites[entry_index].door_closed = true;
					},
					done: () => {
						entry.door_state = 'idle';
						this.active_level_sprites[entry_index].door_closed = true;
						this.state_for_mesh[entry.mesh.uuid].state_index = closed_state_index;
						this.state_for_mesh[entry.mesh.uuid].frame_index = 0;
					},
				};
			}
		}
	}

	toggle_door_intent(entry_index, t) {
		let entry = this.active_level_sprites[entry_index];
		let sprite = this.data.sprites[entry.sprite_index];
		if (entry.door_state !== 'idle')
			return;
		if (entry.door_closed) {
			this.open_door_intent(entry_index, t);
		} else {
			this.close_door_intent(entry_index, t);
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
		this.bg_element.on('touchstart', function (e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchmove', function (e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchend touchcancel', function (e) {
			if (e.targetTouches?.length) return;
			self.fg_element.css('transform', `translate(-50%, -50%) scale(0.7) translate(0px, 0px)`);
			self.options.game.pressed_keys[KEY_RIGHT] = false;
			self.options.game.pressed_keys[KEY_LEFT] = false;
			self.options.game.pressed_keys[KEY_UP] = false;
			self.options.game.pressed_keys[KEY_DOWN] = false;
		});
	}

	handle_touch(e) {
		if (this.options.game.curtain.showing) {
			if (this.options.game.clock.getElapsedTime() > this.options.game.curtain.ts_continue) {
				this.options.game.curtain.oncomplete();
				this.options.game.curtain.hide();
			}
			return;
		}
		let self = this;
		e.preventDefault?.();
		// the finger on the stick – not a finger on the jump button
		let touch = e.targetTouches?.[0] ?? e.touches[0];
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
		this.bg_element.on('touchstart', function (e) {
			self.handle_touch(e);
		});
		this.bg_element.on('touchmove', function (e) {
			self.handle_touch(e);
		});
		if (options.label) {
			this.fg_element.text(options.label).css({ display: 'flex', 'align-items': 'center', 'justify-content': 'center',
				color: '#fff', 'font-size': `calc(${options.radius} * 0.4)`, 'line-height': 1 });
		}
		this.bg_element.on('touchend touchcancel', function (e) {
			// other fingers may still be on this button
			if (e.targetTouches?.length) return;
			self.fg_element.css('transform', `translate(-50%, -50%) scale(0.7) translate(0px, 0px)`);
			self.options.game.pressed_keys[self.key] = false;
		});
	}

	get key() {
		return this.options.key ?? KEY_JUMP;
	}

	show(flag) {
		this.bg_element.toggle(Boolean(flag));
		if (!flag && this.options.game.pressed_keys) this.options.game.pressed_keys[this.key] = false;
	}

	handle_touch(e) {
		let self = this;
		e.preventDefault?.();
		let touch = e.targetTouches?.[0] ?? e.touches[0];
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
		self.options.game.pressed_keys[self.key] = true;
	}
}

document.addEventListener("DOMContentLoaded", async function (event) {
	let shaders = new Shaders();
	await shaders.load();

	window.game = new Game();
	window.game.reset();

	let tag = window.location.hash.substring(1);
	console.log(tag);
	if (tag.length === 7) window.game.load(tag);

	$('#mi_start').click(function (e) {
		window.game.level_index = 0;
		window.game.reset();
		window.game.setup();
		window.game.prepare_run();
	});
});

// The YouTube player (about 1 MB) is only loaded for games with music:
// load_youtube_api() when such a game is loaded, with_youtube() to play.
// window.yt_player stays null until the player is ready.
function load_youtube_api() {
	if (window.yt_script_requested || typeof document === 'undefined') return;
	window.yt_script_requested = true;
	const script = document.createElement('script');
	script.src = 'https://www.youtube.com/iframe_api';
	document.head.appendChild(script);
}

function with_youtube(callback) {
	if (window.yt_player) return callback(window.yt_player);
	window.yt_pending = callback;   // only the latest request matters
	load_youtube_api();
}

function onYouTubeIframeAPIReady() {
	const player = new YT.Player('yt_placeholder', {
		height: '390',
		width: '640',
		events: {
			onReady: () => {
				window.yt_player = player;
				const pending = window.yt_pending;
				window.yt_pending = null;
				try { pending?.(player); } catch { }
			},
		},
	});
}

function add_console_message(s) {
	if (!game.development) return;
	$('#console').empty();
	$(`<div style=''>`).addClass('console-message').text(s).appendTo($('#console'));
	$('#console').addClass('showing');
	if (window.console_timeout)
		clearTimeout(window.console_timeout);
	window.console_timeout = setTimeout(function () {
		$('#console').removeClass('showing');
	}, 3000);
}
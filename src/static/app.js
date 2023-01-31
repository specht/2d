let SIMULATION_RATE = 60;
let KEY_UP = 'up';
let KEY_DOWN = 'down';
let KEY_LEFT = 'left';
let KEY_RIGHT = 'right';
let KEY_JUMP = 'jump';
window.yt_player = null;

class Character {
	constructor(game, sprite_index, mesh) {
		this.game = game;
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
		this.pressed_keys = {};
		this.intention = null;
		this.invincible_until = 0;
		this.initial_position = [mesh.position.x, mesh.position.y];
		this.simulate_this = true;
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
			this.traits.ex_top ??= 1.0;
			this.traits.ex_left ??= 1.0;
			this.traits.ex_right ??= 1.0;
			this.simulate_this = !this.traits.wait_until_seen;
		}

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
		console.log(this.sti_for_state);


		this.vy = 0;
	}

	assign_sti(state, direction, sti, confidence, flipped) {
		this.sti_for_state[state] ??= {};
		this.sti_for_state[state][direction] ??= {sti: sti, confidence: confidence, flipped: flipped};
		if (confidence > this.sti_for_state[state][direction].confidence) {
			this.sti_for_state[state][direction] = {sti: sti, confidence: confidence, flipped: flipped};
		}
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
			for (let trait of trait_or_traits) {
				if (trait in sprite.traits) {
					let r = {...entry};
					r.entry_index = entry_index;
					return r;
				}
			}
		}
		return null;
	}

	has_baddie_at(dx0, dx1, dy0, dy1) {

		if (this.game.dynamic_interval_frame !== this.game.frame) {
			// recreate baddie interval tree
			this.game.dynamic_interval_tree_x.clear();
			this.game.dynamic_interval_tree_y.clear();
			for (let bi = 0; bi < this.game.baddies.length; bi++) {
				let baddie = this.game.baddies[bi];
				let x = baddie.mesh.position.x;
				let y = baddie.mesh.position.y;
				let x0 = x - baddie.sprite.width / 2;
				let x1 = x + baddie.sprite.width / 2;
				let y0 = y;
				let y1 = y + baddie.sprite.height;
				this.game.dynamic_interval_tree_x.insert([x0, x1], bi);
				this.game.dynamic_interval_tree_y.insert([y0, y1], bi);
			}
		}

		let trait_or_traits = ['baddie'];

		let x0 = this.mesh.position.x + dx0;
		let x1 = this.mesh.position.x + dx1;
		let y0 = this.mesh.position.y + dy0;
		let y1 = this.mesh.position.y + dy1;

		let result_x = new Set();
		for (let i of this.game.dynamic_interval_tree_x.search([x0, x1]))
			result_x.add(i);
		let result_y = new Set();
		for (let i of this.game.dynamic_interval_tree_y.search([y0, y1]))
			result_y.add(i);
		let result = [...new Set([...result_x].filter((x) => result_y.has(x)))];
		for (let entry_index of result) {
			return this.game.baddies[entry_index];
		}
		return null;
	}

	intersect_x_with_trait(dx, trait_or_traits, dx0, dx1, dy0, dy1) {
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
		this.mesh.position.x += dx;
		return dx;
	}

	intersect_y_with_trait(dy, trait_or_traits, dx0, dx1, dy0, dy1) {
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
			for (let trait of trait_or_traits) {
				if (trait in sprite.traits) {
					let winy = this.mesh.position.y;
					if (dy < 0)
						winy = Math.max(y0, entry.mesh.position.y + sprite.height);
					else if (dy > 0)
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
			// if (this.has_trait_at('ladder'), -0.5, 0.5, 0.1, 1.1) {
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
		let sti = this.sti_for_state[this.state][this.direction].sti;
		let flipped = this.sti_for_state[this.state][this.direction].flipped;
		if (sti !== old_sti || flipped !== old_flipped) {
			this.t0 = this.game.clock.getElapsedTime();
			let info = this.game.geometry_and_material_for_frame[this.sprite_index][sti][0];
			this.mesh.geometry = info.geometry;
			this.mesh.material = info.material;
		}
		// animate character if there's more than one frame
		if (this.game.data.sprites[this.sprite_index].states[sti].frames.length > 0) {
			let fi = Math.floor((this.game.clock.getElapsedTime() - this.t0) * this.sprite.states[sti].properties.fps) % this.sprite.states[sti].frames.length;
			let info = this.game.geometry_and_material_for_frame[this.sprite_index][sti][fi];
			this.mesh.geometry = info.geometry;
			this.mesh.material = info.material;
		}
		this.mesh.scale.x = flipped ? -1.0 : 1.0;
	}

	standing_on_ground() {
		return this.has_trait_at(['block_above', 'ladder'], -0.5, 0.5, -0.1, 0);
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

			if (this.traits.affected_by_gravity) {
				if (this.standing_on_ground()) {
					this.pressed_keys[KEY_LEFT] = false;
					this.pressed_keys[KEY_RIGHT] = false;
					this.pressed_keys[KEY_UP] = false;
					this.pressed_keys[KEY_DOWN] = false;
					this.pressed_keys[KEY_JUMP] = false;
					if (this.intention.direction === 'left') {
						if (this.has_trait_at(['block_above'], -this.sprite.width * 0.5 - 1, -this.sprite.width * 0.5, -1.0, 0.0)) {
							if (this.has_trait_at(['block_sides'], -this.sprite.width * 0.5 - 1, -this.sprite.width * 0.5, 0.1, this.sprite.height - 0.1)) {
								this.intention.direction = 'right';
							} else {
								this.pressed_keys[KEY_LEFT] = true;
							}
						} else {
							if (this.has_trait_at(['block_sides'], this.sprite.width * 0.5 - 1, this.sprite.width * 0.5, 0.1, this.sprite.height - 0.1)) {
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
							if (this.has_trait_at(['block_sides'], this.sprite.width * 0.5, this.sprite.width * 0.5 + 1, 0.1, this.sprite.height - 0.1)) {
								this.intention.direction = 'left';
							} else {
								this.pressed_keys[KEY_RIGHT] = true;
							}
						} else {
							if (this.has_trait_at(['block_sides'], this.sprite.width * 0.5, this.sprite.width * 0.5 + 1, 0.1, this.sprite.height - 0.1)) {
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

	invincible() {
		return this.game.clock.getElapsedTime() < this.invincible_until;
	}

	dead() {
		return (this.game.ts_zoom_actor >= 0) && (!this.game.reached_flag);
	}

	die(sprite, trait) {
		if ((!this.game.running) || this.dead() || this.game.reached_flag) return;
		this.game.ts_zoom_actor = this.game.clock.getElapsedTime();
		this.game.lives -= 1;
		if (this.game.lives < 0) this.game.lives = 0;
		this.game.update_stats();
		let self = this;
		if (this.game.lives === 0) {
			this.game.curtain.show('GAME OVER', 0.5, 2.0, function() {
				self.game.stop();
				$('#screen').hide();
			});
		} else {
			this.game.curtain.show('Drück eine Taste, um fortzufahren', 0.5, 1.0, function() {
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
		if ((!this.game.running) || this.dead() || this.game.reached_flag) return;
		this.game.energy -= sprite.traits[trait].damage;
		if (this.game.energy < 0) this.game.energy = 0;
		this.game.update_stats();
		if (this.game.energy === 0) {
			this.die(sprite, trait);
		} else {
			this.invincible_until = this.game.clock.getElapsedTime() + sprite.traits[trait].damage_cool_down;
		}
	}

	simulation_step(t) {
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
			this.simulate_movement();
		}

		if (this.character_trait === 'actor') {
			this.pressed_keys = this.game.pressed_keys;
			if (this.game.curtain.showing)
				this.pressed_keys = {};
		}

		let dx = 0;
		let factor = 1;
		if (this.character_trait === 'baddie' && this.pressed_keys[KEY_JUMP]) factor = this.traits.jump_vfactor;
		if (this.pressed_keys[KEY_RIGHT]) dx += this.traits.vrun * factor;
		if (this.pressed_keys[KEY_LEFT]) dx -= this.traits.vrun * factor;
		// if (this.character_trait === 'baddie')
		// 	dx *= (1.0) + ((Math.random() - 0.5) * 2.0) * 3;
		dx = this.try_move_x(dx);
		let state = 'stand';
		if (this.standing_on_ground()) {
			state = (Math.abs(dx) > 0.1) ? 'walk' : 'stand';
		} else {
			state = (this.vy > 0) ? 'jump' : 'fall';
		}
		if (this.character_trait === 'actor') {
			if (this.dead())
				state = 'dead';
		}
		let direction = this.direction;
		if (dx > 0) direction = 'right';
		if (dx < 0) direction = 'left';

		let dy = 0;
		let entry = this.has_trait_at(['ladder'], -0.5, 0.5, 0.1, 1.1);
		if (entry) {
			if (this.pressed_keys[KEY_UP]) {
				dy += this.traits.vrun;
				if (this.game.data.sprites[entry.sprite_index].traits.ladder.center)
					this.center_on_entry(entry);
			}
		}
		entry = this.has_trait_at(['ladder'], -0.5, 0.5, -1.1, -0.1);
		if (entry) {
			if (this.pressed_keys[KEY_DOWN]) {
				dy -= this.traits.vrun;
				if (this.game.data.sprites[entry.sprite_index].traits.ladder.center)
					this.center_on_entry(entry);
			}
		}
		dy = this.try_move_y(dy);
		if (Math.abs(dy) > 0.1)
			direction = 'back';

		// if we're standing, we can jump
		if (this.character_trait === 'baddie' || this.sprite.traits[this.character_trait].can_jump) {
			if (this.standing_on_ground()) {
				this.vy = 0;
				if (this.pressed_keys[KEY_JUMP])
					this.vy = this.traits.vjump;
			}
		}

		if (this.sprite.traits[this.character_trait].affected_by_gravity) {
			let dy = this.try_move_y(this.vy);
			if (Math.abs(dy) < 0.01) this.vy = 0;
		}

		this.vy -= this.game.data.properties.gravity;
		if (this.vy < -10)
			this.vy = -10;

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
					this.game.update_stats();
				}
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
					let next_level_index = self.game.get_next_level_index();
					if (next_level_index < self.game.data.levels.length) {
						let next_level_title = self.game.data.levels[next_level_index].properties.name.trim();
						if (next_level_title.length > 0) {
							next_level_title = `<div><span style='color: #aaa;'>Next up:</span> ${next_level_title}</div>`;
						}
						this.game.curtain.show(`LEVEL COMPLETE!${next_level_title}`, 0.5, 1.0, function() {
							self.game.level_index = self.game.get_next_level_index();
							self.game.setup();
							self.game.run();
						});
					} else {
						this.game.curtain.show('THE END', 0.5, 2.0, function() {
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

			if (!(this.invincible() || this.dead())) {
				entry = this.has_baddie_at(-this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
					this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1);
				if (entry) {
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
		setTimeout(function() {
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

	reset() {
		this.old_yt_tag = null;
		this.time_meshes = [];
		this.level_index = 0;
		this.next_level_index = 0;
		this.lives = 5;
		this.energy = 100;
		console.log('RESET', this.next_level_index);
		this.handle_resize();
		this.stop();
		this.just_started = true;
		$('#overlay').show();
		$('#screen').hide();
		this.curtain.hide();

		this.points = 0;

		if (this.data === null)
			return;

		this.lives = this.data.properties.lives_at_begin;
		this.energy = this.data.properties.energy_at_begin;
		this.points = 0;

	}

	async load(tag) {
		// load game json
		this.reset();
		if (window.yt_player !== null) {
			try {
				window.yt_player.pauseVideo();
			} catch {}
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
				vertexShader: shaders.get('basic.vs'),
				fragmentShader: shaders.get('texture.fs'),
				side: THREE.DoubleSide,
			});
			this.spritesheets.push(material);
		}
		console.log(this);

		$('#game_title').text(this.data.properties.title);
		$('#game_author').text(this.data.properties.author);
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
		if (window.yt_player !== null) {
			window.yt_player.pauseVideo();
		}
	}

	get_next_level_index() {
		let li = this.level_index + 1;
		while ((li < this.data.levels.length) && !this.data.levels[li].properties.use_level)
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
		this.maxx = 0;
		this.maxy = 0;
		this.pressed_keys = {};
		this.simulated_to = 0;

		this.interval_tree_x.clear();
		this.interval_tree_y.clear();
		this.frame = 0;
		this.dynamic_interval_frame = -1;
		this.dynamic_interval_tree_x.clear();
		this.dynamic_interval_tree_y.clear();

		this.active_level_sprites = [];

		this.ts_zoom_actor = -1;
		this.reached_flag = false;

		$('#screen').empty();
		$('#screen').append(this.renderer.domElement);
		this.mesh_catalogue = [];
		this.layers = [];

		this.lives = 1;
		this.energy = 100;
		if (this.data === null)
			return;

		this.lives = this.data.properties.lives_at_begin;
		this.energy = this.data.properties.energy_at_begin;

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
					let material = this.spritesheets[tile_info[0]];
					this.geometry_and_material_for_frame[si][sti][fi] = {geometry: geometry, material: material}
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
					mesh.geometry.setAttribute('opacity', new THREE.BufferAttribute(new Float32Array([1.0, 1.0, 1.0, 1.0]), 1));
					// mesh.material = mesh.material.clone();
					// console.log(mesh.material.uniforms.texture1);
					let sprite = this.data.sprites[si];
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
						if (!('actor' in sprite.traits || 'baddie' in sprite.traits))
						{
							this.interval_tree_x.insert([x0, x1], this.active_level_sprites.length);
							this.interval_tree_y.insert([y0, y1], this.active_level_sprites.length);
							this.active_level_sprites.push({layer_index: li, sprite_index: si, mesh: mesh});
						}
					}
					mesh.position.set(placed[1], placed[2], 0);
					this.meshes_for_sprite[si].push(mesh);
					if ('actor' in sprite.traits)
					{
						this.player_character = new Character(this, si, mesh);
						this.camera_x = placed[1];
						this.camera_y = placed[2] + this.data.properties.screen_pixel_height * 0.3;
					}
					else if ('baddie' in sprite.traits)
					{
						this.baddies.push(new Character(this, si, mesh));
					}
					let fx = sprite.states[0].properties.phase_x;
					let fy = sprite.states[0].properties.phase_y;
					let fr = sprite.states[0].properties.phase_r;
					let fo = Math.floor((mesh.position.x / sprite.width) * fx + (mesh.position.y / sprite.height) * fy + Math.random() * 1024 * fr);
					this.state_for_mesh[mesh.uuid] = {state_index: 0, frame_offset: fo};
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
					let uniforms = {};
					let material = new THREE.LineBasicMaterial({transparent: true});
					material.opacity = 0;

					if (backdrop.backdrop_type === 'effect') {
						let gradient_points = JSON.parse(JSON.stringify(backdrop.control_points));
						uniforms = {
							time:  { value: 0 },
							resolution: { value: [rect0.width, rect0.height] },
							scale: { value: backdrop.scale },
							color: { value: parse_html_color_to_vec4(backdrop.color) },
						};
						for (let gi = 0; gi < gradient_points.length; gi++) {
							gradient_points[gi][0] = rect0.width * gradient_points[gi][0] + rect0.left;
							gradient_points[gi][1] = rect0.height * gradient_points[gi][1] + rect0.bottom;
							uniforms[`cp${String.fromCharCode(97 + gi)}`] = { value: [gradient_points[gi][0], gradient_points[gi][1]] };
						}
						material = new THREE.ShaderMaterial({
							uniforms: uniforms,
							transparent: true,
							vertexShader: shaders.get('basic.vs'),
							fragmentShader: shaders.get(backdrop.effect + '.fs'),
							side: THREE.DoubleSide,
						});
						let x0 = rect.left;
						let y0 = rect.bottom;
						let x1 = rect.left + rect.width;
						let y1 = rect.bottom + rect.height;
						let uv = geometry.attributes.uv;
						uv.setXY(0, x0, y1);
						uv.setXY(1, x1, y1);
						uv.setXY(2, x0, y0);
						uv.setXY(3, x1, y0);
					}
					if (backdrop.backdrop_type === 'color') {
						let gradient_points = JSON.parse(JSON.stringify(backdrop.colors));
						for (let gi = 0; gi < gradient_points.length; gi++) {
							gradient_points[gi][1] = rect0.width * gradient_points[gi][1] + rect0.left;
							gradient_points[gi][2] = rect0.height * gradient_points[gi][2] + rect0.bottom;
					}
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
						material = new THREE.ShaderMaterial({
							uniforms: uniforms,
							transparent: true,
							vertexShader: shaders.get('basic.vs'),
							fragmentShader: shaders.get('gradient.fs'),
							side: THREE.DoubleSide,
						});
						let x0 = rect.left;
						let y0 = rect.bottom;
						let x1 = rect.left + rect.width;
						let y1 = rect.bottom + rect.height;
						let uv = geometry.attributes.uv;
						uv.setXY(0, x0, y1);
						uv.setXY(1, x1, y1);
						uv.setXY(2, x0, y0);
						uv.setXY(3, x1, y0);
				}
					let mesh = new THREE.Mesh(geometry, material);
					if (backdrop.backdrop_type === 'effect')
						this.time_meshes.push({mesh: mesh, speed: backdrop.speed});
					game_layer.add(mesh);
				}
			}
			this.layers.push(game_layer);
		}
		// console.log(this.minx, this.maxx, this.miny, this.maxy);

		for (let i = this.layers.length - 1; i >= 0; i--)
			this.scene.add(this.layers[i]);

		if (this.data.properties.crt_effect) {
			this.render_target = new THREE.WebGLRenderTarget(this.width, this.height, {magFilter: THREE.NearestFilter});
			this.screen_scene = new THREE.Scene();
			let geometry = new THREE.PlaneGeometry(this.width, this.height);
			console.log('size', this.width, this.height, this.data.properties.screen_pixel_height);
			let material = new THREE.ShaderMaterial({
				uniforms: {
					texture1: { value: this.render_target.texture },
					resolution: { value: [this.data.properties.screen_pixel_height / 9.0 * 16.0, this.data.properties.screen_pixel_height]},
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

	prepare_run() {
		let self = this;
		if (this.level_index < this.data.levels.length) {
			let level = this.data.levels[this.level_index];
			let level_title = level.properties.name.trim();
			this.curtain.show(`<div>${level_title}</div><div style='margin-top: 1vh; font-size: 70%; opacity: 0.5;'>Drück eine Taste</div>`, 0.0, 0.0, function() {
				self.frame = 0;
				self.clock.start();
				self.run();
			});
		} else {
			this.curtain.show(`<div>THE END</div><div style='margin-top: 1vh; font-size: 70%; opacity: 0.5;'>Drück eine Taste</div>`, 0.0, 0.0, function() {
				self.stop();
			});
		}
		$('#overlay').fadeOut();
	}

	run() {
		// this.setup();
		// this.prepare_run();
		$('#stats').addClass('showing');
		if (window.yt_player !== null) {
			// window.yt_player.pauseVideo();
			let yt_tag = null;
			if ((window.game.data.properties.yt_tag ?? '').length > 0)
				yt_tag = window.game.data.properties.yt_tag;
			if ((window.game.data.levels[0].properties.yt_tag ?? '').length > 0)
				yt_tag = window.game.data.levels[0].properties.yt_tag;
			if (yt_tag !== null) {
				if (yt_tag !== this.old_yt_tag) {
					this.old_yt_tag = yt_tag;
					let parts = yt_tag.split('#');
					let s = this.parse_yt_timestamp(parts[1]);
					window.yt_player.loadVideoById(parts[0], s);
				}
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
		if (window.yt_player !== null) {
			try {
				window.yt_player.pauseVideo();
			} catch {}
		}
	}

	render() {
		this.simulate();

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
				let fi = Math.floor((this.clock.getElapsedTime() * fps) + mesh_state.frame_offset) % sprite.states[sti].frames.length;
				if (fi < 0) fi += sprite.states[sti].frames.length;
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

		// handle transitioning sprites (pickup)
		let t1 = this.clock.getElapsedTime();
		let delete_keys = [];
		for (let pi in (this.transitioning_sprites ?? {}).pickup ?? {}) {
			let entry = this.active_level_sprites[pi];
			let sprite = this.data.sprites[entry.sprite_index];
			let dt0 = (t1 - this.transitioning_sprites.pickup[pi].t0);
			let dt = dt0 / sprite.traits.pickup.duration;
			entry.mesh.position.y = this.transitioning_sprites.pickup[pi].y0 + dt0 * sprite.traits.pickup.move_up;
			let t = 1.0 - dt;
			if (t > 1.0) t = 1.0;
			if (t < 0.0) t = 0.0;
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

		if (this.player_character) {
			if (this.player_character.invincible()) {
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
		}
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
		if (((this.running && this.lives === 0) || (this.level_index >= this.data.levels.length)) && key === 'Escape') {
			this.stop();
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
	simulation_step(t) {
		if (this.player_character !== null)
			this.player_character.simulation_step(t);
		for (let baddie of this.baddies)
			baddie.simulation_step(t);
	}

	simulate() {
		let simulate_to = Math.floor(this.clock.getElapsedTime() * 60.0);
		while (this.simulated_to < simulate_to) {
			this.simulation_step(this.simulated_to / SIMULATION_RATE);
			this.frame++;
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
		if (this.options.game.curtain.showing) {
			if (this.options.game.clock.getElapsedTime() > this.options.game.curtain.ts_continue) {
				this.options.game.curtain.oncomplete();
				this.options.game.curtain.hide();
			}
			return;
		}
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

document.addEventListener("DOMContentLoaded", async function (event) {
	let shaders = new Shaders();
    await shaders.load();

	window.game = new Game();
	window.game.reset();

	let tag = window.location.hash.substring(1);
	console.log(tag);
	if (tag.length === 7) window.game.load(tag);

	$('#mi_start').click(function(e) {
		window.game.level_index = 0;
		window.game.reset();
		window.game.setup();
		window.game.prepare_run();
	});
});

function onYouTubeIframeAPIReady() {
    window.yt_player = new YT.Player('yt_placeholder', {
        height: '390',
        width: '640',
    });
}

function add_console_message(s) {
	if (!game.development) return;
	$('#console').empty();
	$(`<div style=''>`).addClass('console-message').text(s).appendTo($('#console'));
	$('#console').addClass('showing');
	if (window.console_timeout)
		clearTimeout(window.console_timeout);
	window.console_timeout = setTimeout(function() {
		$('#console').removeClass('showing');
	}, 3000);
}
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
// Laden (app.js shop_*): how near a Verkäufer greets and chats, and how many
// quiet seconds before he chats (Character.SHOP_REACH_UP: what is in reach)
const SHOP_NEAR = 144;
const SHOP_CHAT_PAUSE = 4;
// Weather that falls or rises: it stays upright on the screen when the
// camera turns with a turned gravity (Game.turn_upright_effects)
const UPRIGHT_EFFECTS = ['snow', 'rain', 'smoke', 'fire', 'bubbles', 'lightning'];
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
	// Laden: how far above the figure's head something for sale is still within reach (on a counter)
	static SHOP_REACH_UP = 14;

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
		else if ('companion' in this.sprite.traits && typeof companion_abilities === 'function') {
			// Begleiter (companion_ai.js): follows the player with its own way of
			// moving. Not an enemy: it is kept in game.companions, never in baddies.
			this.character_trait = 'companion';
			this.companion = companion_abilities(this.sprite.traits.companion);
			// a runtime view; the saved traits stay as they are
			this.traits = { ...this.sprite.traits.companion, vrun: this.companion.vrun, vjump: this.companion.vjump,
				can_jump: this.companion.jump, affected_by_gravity: true, ex_left: 0.7, ex_right: 0.7, ex_top: 1.0 };
			this.companion_memory = {};
			// what happened, for the recipes' checks (rezepte/tools/record.mjs)
			this.companion_stats = { lost: 0, returned: 0 };
			this.simulate_this = true;
		}

        // Normalize the new optional melee trait only in this character's
        // runtime view, alongside the ranged trait. Legacy JSON stays unchanged.
        if (this.character_trait && this.character_trait !== 'companion' && (this.sprite.traits.melee_attack?.attack ||
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

		// try to assign flipped states: a side without its own picture shows
		// the other side mirrored. With neither side drawn (a figure without
		// roles), the first state faces right as drawn and is mirrored for left
		// – before, both sides showed it mirrored, so a figure drawn facing right
		// always looked left (who_shows_what.js mirrors this rule)
		for (let state of ['stand', 'walk', 'jump', 'fall']) {
			const left_had = this.sti_for_state[state].left.confidence;
			this.assign_sti(state, 'left', this.sti_for_state[state].right.sti, 1, true);
			if (left_had > 0)
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
        // fly: a Begleiter that "kann fliegen" (companion_ai.js)
        // sit / busy: a Begleiter keeping busy while the player stands still
        for (let kind of ['attack', 'hit', 'hunt', 'flee', 'stunned', 'landed', 'swim', 'float', 'drift', 'dive', 'rise', 'fly', 'sit', 'busy']) {
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


		this.vy = 0;
		// Bewegungsbereiche: sideways speed in the water or in space (px per frame)
		this.vx = 0;
		this.stroke_held = false;
		// Schwerkraft-Richtung (movement_regions.js direction): quarter turns of
		// the figure's own "down" (0: down, as always); frame_k: the same while
		// its simulation step runs in its own coordinates (enter_frame)
		this.gravity_k = 0;
		this.frame_k = 0;
		this.gravity_turn = null;
	}

	// ---------------------------------------------------- turned gravity
	// A Bewegungsbereich may pull to the left, up or to the right. The figure's
	// own directions turn with it: its floor is where gravity pulls. During its
	// simulation step (frame_k) mesh.position holds its own coordinates – x
	// along its floor, y up from its feet – so walking, jumping and the enemies'
	// senses stay as they are; every question to the world (has_trait_at,
	// intersect_*, the interval trees) is turned into world coordinates here.
	// Without a turned gravity (gravity_k 0) none of this happens.

	enter_frame() {
		const p = this.mesh.position;
		[p.x, p.y] = MovementRegions.to_local(this.gravity_k, p.x, p.y);
		this.frame_k = this.gravity_k;
	}

	leave_frame() {
		const p = this.mesh.position;
		[p.x, p.y] = MovementRegions.to_world(this.frame_k, p.x, p.y);
		this.frame_k = 0;
	}

	// a world point in the figure's own coordinates while its step runs (else as it is)
	local_xy(x, y) {
		return this.frame_k ? MovementRegions.to_local(this.frame_k, x, y) : [x, y];
	}

	// …and back
	world_of(x, y) {
		return this.frame_k ? MovementRegions.to_world(this.frame_k, x, y) : [x, y];
	}

	// the feet in the world
	world_xy() {
		return this.world_of(this.mesh.position.x, this.mesh.position.y);
	}

	// A rectangle relative to the feet, in the figure's own directions (dx
	// along its floor, dy up from it), in the world: [x0, x1, y0, y1].
	world_box(dx0, dx1, dy0, dy1) {
		const p = this.mesh.position;
		const k = this.gravity_k ?? 0;
		if (!k) return [p.x + dx0, p.x + dx1, p.y + dy0, p.y + dy1];
		const [x, y] = this.frame_k ? [p.x, p.y] : MovementRegions.to_local(k, p.x, p.y);
		return MovementRegions.box_to_world(k, x + dx0, x + dx1, y + dy0, y + dy1);
	}

	// The middle of the figure (half its height above the feet) in the world.
	world_center() {
		const p = this.mesh.position, h2 = this.sprite.height * 0.5;
		if (!this.gravity_k) return [p.x, p.y + h2];
		if (this.frame_k) return MovementRegions.to_world(this.frame_k, p.x, p.y + h2);
		const [ox, oy] = MovementRegions.to_world(this.gravity_k, 0, h2);
		return [p.x + ox, p.y + oy];
	}

	// Above the head (its own up), in the world – where a speech bubble goes.
	head_world() {
		const p = this.mesh.position, h = this.sprite.height;
		if (!this.gravity_k) return [p.x, p.y + h];
		const [ox, oy] = MovementRegions.to_world(this.gravity_k, 0, h);
		return [p.x + ox, p.y + oy];
	}

	// A level sprite's rectangle in the figure's own coordinates.
	entry_box(entry, sprite) {
		const x = entry.mesh.position.x, y = entry.mesh.position.y;
		const x0 = x - sprite.width / 2, x1 = x + sprite.width / 2, y0 = y, y1 = y + sprite.height;
		if (!this.frame_k) return { x0, x1, y0, y1 };
		const b = MovementRegions.box_to_local(this.frame_k, x0, x1, y0, y1);
		return { x0: b[0], x1: b[1], y0: b[2], y1: b[3] };
	}

	// The sprite has the trait – seen in the figure's own directions. face: for
	// "von der Seite", which side of the sprite the figure runs into ('left' |
	// 'right'), or null for either.
	has_local_trait(sprite, trait, face = null) {
		if (!this.frame_k) return trait in sprite.traits;
		// ladders and slopes go with the world's up: turned, a slope is a block, a ladder nothing
		if (trait === 'ladder' || trait === 'slope') return false;
		if (trait !== 'block_above' && trait !== 'block_below' && trait !== 'block_sides') return trait in sprite.traits;
		const faces = MovementRegions.local_faces(sprite.traits, this.frame_k);
		if (trait === 'block_above') return faces.up;
		if (trait === 'block_below') return faces.down;
		return face ? faces[face] : (faces.left || faces.right);
	}

	// Level sprites overlapping a rectangle given in the figure's own coordinates.
	candidates_at(x0, x1, y0, y1) {
		if (!this.frame_k) return this.game.collision_candidates(x0, x1, y0, y1);
		const b = MovementRegions.box_to_world(this.frame_k, x0, x1, y0, y1);
		return this.game.collision_candidates(b[0], b[1], b[2], b[3]);
	}

	// How far a turn has come (0 … 1, eased), or null when there is none.
	// A turn takes turn.seconds; gravity changes halfway.
	turn_progress(t) {
		const turn = this.gravity_turn;
		if (!turn) return null;
		const s = turn.seconds > 0 ? (t - turn.at) / turn.seconds : 1;
		if (!(s < 1) && turn.switched) {
			this.gravity_turn = null;
			return null;
		}
		const u = Math.min(1, Math.max(0, s));
		return u * u * (3 - 2 * u);
	}

	// The angle the figure is drawn at (radians, counter-clockwise): its
	// gravity, or on the way to the next.
	visual_angle(t) {
		const e = this.turn_progress(t);
		if (e === null) return (this.gravity_k ?? 0) * Math.PI / 2;
		return this.gravity_turn.from + (this.gravity_turn.to - this.gravity_turn.from) * e;
	}

	// The camera's angle for the player (Game.render): the same as the figure's
	// – or 0 while the region says the camera stays as it is (camera 'fixed' /
	// 'fixed_figure', movement_regions.js).
	camera_angle(t) {
		const e = this.turn_progress(t);
		if (e === null) return this.gravity_camera && this.gravity_camera !== 'turn' ? 0 : (this.gravity_k ?? 0) * Math.PI / 2;
		return this.gravity_turn.camera_from + (this.gravity_turn.camera_to - this.gravity_turn.camera_from) * e;
	}

	// The camera stays and the arrow keys mean the screen's directions (camera
	// 'fixed'): which of the figure's own keys they are. On the right wall
	// "up" walks up it, on the ceiling "right" walks to the right.
	screen_keys(keys) {
		const arrows = [[KEY_RIGHT, 1, 0], [KEY_LEFT, -1, 0], [KEY_UP, 0, 1], [KEY_DOWN, 0, -1]];
		const out = { ...keys };
		for (const [key] of arrows) out[key] = false;
		for (const [key, x, y] of arrows) {
			if (!keys[key]) continue;
			const [lx, ly] = MovementRegions.to_local(this.frame_k, x, y);
			out[arrows.find(([, ax, ay]) => ax === Math.round(lx) && ay === Math.round(ly))[0]] = true;
		}
		return out;
	}

	// Back to gravity pulling down at once (starting again after a lost life).
	reset_gravity() {
		this.gravity_k = 0;
		this.gravity_turn = null;
		this.gravity_camera = null;
		this.turn_settle = false;
	}

	// Before the step: the Bewegungsbereich at the figure's middle says where
	// gravity pulls. The player and walking enemies turn with it (a flyer, a
	// stomper and a Begleiter keep theirs). A new direction starts a turn on
	// the screen (as long as the region's "Drehdauer"); halfway through it
	// gravity changes (turn_gravity). Changing its mind before that, the
	// figure turns back from where it is.
	update_gravity_direction(t) {
		if (typeof MovementRegions === 'undefined' || !MovementRegions.to_world) return;
		const regions = this.game.movement_regions;
		if (!this.gravity_k && !this.gravity_turn && !regions?.turns) return;
		const turns = this.character_trait === 'actor' || (this.character_trait === 'baddie' && !this.ai_no_gravity);
		let turn = this.gravity_turn;
		if (turns) {
			const [cx, cy] = this.world_center();
			const here = MovementRegions.at(regions, cx, cy, this.game.signal_hidden_layers);
			const want = here?.direction ?? 0;
			const heading = turn && !turn.switched ? turn.to_k : this.gravity_k;
			// a short pause between two turns: no flicker at the edge of a region
			if (want !== heading && t - (this.gravity_turn_started ?? -Infinity) >= 0.2) {
				// turning back out of a region takes as long as turning in
				const seconds = here?.direction ? here.turn_seconds : (this.gravity_turn_seconds ?? MovementRegions.TURN_SECONDS);
				if (here?.direction) this.gravity_turn_seconds = here.turn_seconds;
				// what the camera does: the region's say (turning back: as when turning in)
				const camera = here?.direction ? (here.camera ?? 'turn') : (this.gravity_camera ?? 'turn');
				const from = this.visual_angle(t);
				const camera_from = this.camera_angle(t);
				const from_k = this.gravity_k;
				// from the angle it is drawn at, the short way to the new direction
				const to = from_k * Math.PI / 2 + MovementRegions.turn_delta(from_k, want);
				const unwound = from - Math.round((from - from_k * Math.PI / 2) / (2 * Math.PI)) * 2 * Math.PI;
				// the camera: along to the same angle, or (staying) back to upright
				const camera_to = camera === 'turn' ? to : 0;
				const camera_unwound = camera_from - Math.round((camera_from - camera_to) / (2 * Math.PI)) * 2 * Math.PI;
				turn = this.gravity_turn = { from: unwound, to, to_k: want, at: t, seconds, switched: want === from_k,
					camera, camera_from: camera_unwound, camera_to };
				this.gravity_turn_started = t;
			}
		}
		// halfway through the turn, gravity changes
		if (turn && !turn.switched && (turn.seconds <= 0 || t >= turn.at + turn.seconds / 2)) {
			turn.switched = true;
			this.gravity_camera = turn.camera;
			this.turn_gravity(turn.to_k);
		}
	}

	// Gravity pulls somewhere else from now on: the figure turns around its
	// middle (so it stays where it is), and its speed turns along.
	turn_gravity(k) {
		if (k === this.gravity_k) return;
		const [cx, cy] = this.world_center();
		const [wvx, wvy] = MovementRegions.to_world(this.gravity_k, this.vx, this.vy);
		this.gravity_k = k;
		const [ox, oy] = MovementRegions.to_world(k, 0, this.sprite.height * 0.5);
		this.mesh.position.x = cx - ox;
		this.mesh.position.y = cy - oy;
		[this.vx, this.vy] = MovementRegions.to_local(k, wvx, wvy);
		// the coyote time belonged to the old floor
		this.standing_on_ground_cache = null;
		this.turn_settle = true;
	}

	// Right after a turn (in the figure's own coordinates): if its turned body
	// sticks into a block, it moves out – up first, then to the sides.
	settle_after_turn() {
		this.turn_settle = false;
		const w = this.sprite.width * 0.5, h = this.sprite.height * this.traits.ex_top;
		const l = w * this.traits.ex_left - 0.5, r = w * this.traits.ex_right - 0.5;
		const blocked = () => this.has_trait_at(['block_sides', 'block_above', 'block_below'], -l, r, 0.5, h - 0.5) !== null;
		if (!blocked()) return;
		const p = this.mesh.position, x = p.x, y = p.y;
		for (let d = 2; d <= Math.max(h, w * 2); d += 2) {
			for (const [dx, dy] of [[0, d], [-d, 0], [d, 0], [0, -d]]) {
				p.x = x + dx;
				p.y = y + dy;
				if (!blocked()) return;
			}
		}
		p.x = x;
		p.y = y;
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

	// Something collected flies up and fades (Game.render) – up as the figure
	// that collected it sees it: with a turned gravity, away from its floor.
	collected_flies_up(entry, t) {
		const flight = { t0: t, y0: entry.mesh.position.y };
		if (this.gravity_k) {
			[flight.ux, flight.uy] = MovementRegions.to_world(this.gravity_k, 0, 1);
			flight.x0 = entry.mesh.position.x;
		}
		this.game.transitioning_sprites['pickup'] ??= {};
		this.game.transitioning_sprites['pickup'][entry.entry_index] = flight;
	}

	// Collects a pickup (an entry as has_trait_at gives it): it goes, its Code is
	// sent, the figure gets what it gives, and what "bleibt fürs ganze Spiel" goes
	// into the inventory (inventory.js). stays: bought in a shop that has more of
	// it ("kann man öfter kaufen") – it stays where it is.
	collect_pickup(entry, t, stays = false) {
		let sprite = this.game.data.sprites[entry.sprite_index];
		if (!stays) {
			let x = entry.mesh.position.x;
			let y = entry.mesh.position.y;
			let x0 = x - sprite.width / 2;
			let x1 = x + sprite.width / 2;
			let y0 = y;
			let y1 = y + sprite.height;
			this.game.interval_tree_x.remove([x0, x1], entry.entry_index);
			this.game.interval_tree_y.remove([y0, y1], entry.entry_index);
			this.collected_flies_up(entry, t);
			this.game.remember_collected?.(this.game.active_level_sprites[entry.entry_index]);
		}
		// "sendet, wenn eingesammelt" (signals.js; absent = sends nothing)
		if (entry.pickup_signal_on === true) {
			this.game.signals?.send(stored_signal_code(entry.pickup_signal_code), true, t, { delay: entry.pickup_signal_delay });
			this.game.remember_send?.(stored_signal_code(entry.pickup_signal_code), true);
		}
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
		// "bleibt fürs ganze Spiel" (absent = gone, as always)
		if (sprite.traits.pickup.keep === true) this.game.keep_item?.(entry.sprite_index, t);
		this.game.update_stats();
	}

	// accept(entry): optional, only entries it says yes to (a shop item is no free pickup)
	has_trait_at(trait_or_traits, dx0, dx1, dy0, dy1, accept = null) {
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

		// (turned gravity: x0 … y1 are the figure's own coordinates, candidates_at turns them)
		let result = this.candidates_at(x0, x1, y0, y1);
		for (let entry_index of result) {
			let entry = this.game.active_level_sprites[entry_index];
			let sprite = this.game.data.sprites[entry.sprite_index];
			for (let trait of trait_or_traits) {
				if (this.has_local_trait(sprite, trait)) {
					let ok = true;
					if (trait === 'door') {
						// Doors are a special case because of their proximity sensing capabilities.
						// We search an area +- 100 px around the door and now have to test whether
						// the hit was really within the door's area via xsense and ysense.
						const [px, py] = this.world_xy();
						if (px < entry.mesh.position.x - sprite.width / 2 - sprite.traits.door.xsense ||
							px > entry.mesh.position.x + sprite.width / 2 + sprite.traits.door.xsense ||
							py < entry.mesh.position.y - sprite.traits.door.ysense ||
							py > entry.mesh.position.y + sprite.height + sprite.traits.door.ysense)
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

					if (ok && accept && !accept(entry)) ok = false;
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

		const [x0, x1, y0, y1] = this.world_box(dx0, dx1, dy0, dy1);

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

		let result = this.candidates_at(x0, x1, y0, y1);
		for (let entry_index of result) {
			let entry = this.game.active_level_sprites[entry_index];
			let sprite = this.game.data.sprites[entry.sprite_index];
			const box = this.entry_box(entry, sprite);
			for (let trait of trait_or_traits) {
				// going left the figure runs into the sprite's right side
				if (this.has_local_trait(sprite, trait, dx < 0 ? 'right' : 'left')) {
					let winx = this.mesh.position.x;
					if (dx < 0)
						winx = Math.max(x0, box.x1 + this.traits.ex_left * this.sprite.width * 0.5);
					else if (dx > 0)
						winx = Math.min(x0, box.x0 - this.traits.ex_right * this.sprite.width * 0.5);
					dx = winx - this.mesh.position.x;
				}
			}
			if (check_for_block_above || check_for_block_sides || check_for_block_below) {
				if (('door' in sprite.traits) && entry.door_closed) {
					let winx = this.mesh.position.x;
					if (dx < 0)
						winx = Math.max(x0, box.x1 + this.traits.ex_left * this.sprite.width * 0.5);
					else if (dx > 0)
						winx = Math.min(x0, box.x0 - this.traits.ex_right * this.sprite.width * 0.5);
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

		let result = this.candidates_at(x0, x1, y0, y1);
		for (let entry_index of result) {
			let entry = this.game.active_level_sprites[entry_index];
			let sprite = this.game.data.sprites[entry.sprite_index];
			for (let trait of trait_or_traits) {
				if (this.has_local_trait(sprite, trait)) {
					let winy = this.mesh.position.y;
					const box = this.entry_box(entry, sprite);
					if (dy < 0) {
						// accomodate for slope (only with gravity pulling down: has_local_trait)
						if (trait === 'slope') {
							let tx = (this.mesh.position.x - (entry.mesh.position.x - sprite.width * 0.5)) / sprite.width;
							if (sprite.traits.slope.direction === 'negative') tx = 1.0 - tx;
							tx = tx.clamp(0.0, 1.0);
							winy = Math.max(y0, entry.mesh.position.y + tx * sprite.height);
						} else winy = Math.max(y0, box.y1);
					} else if (dy > 0)
						winy = Math.min(y0, box.y0 - this.sprite.height * this.traits.ex_top);
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
				// a landing enemy shakes the camera by its distance to the figure –
				// a level may have no Spielfigur (a test run there: 9d4c7e, October 2026)
				if (this.character_trait === 'baddie' && old_dy != dy && this.game.player_character) {
					this.game.ts_camera_shake = this.game.clock.getElapsedTime();
					const [wx, wy] = this.world_xy();
					let dx = wx - this.game.player_character.mesh.position.x;
					let dy = wy - this.game.player_character.mesh.position.y;
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
		if (this.frame_k) {
			// turned gravity: the same, in the figure's own coordinates
			for (const i of this.candidates_at(x - 0.5, x + 0.5, y - 0.5, y - 0.01)) {
				const entry = this.game.active_level_sprites[i];
				const sprite = this.game.data.sprites[entry.sprite_index];
				const carries = this.has_local_trait(sprite, 'block_above') || ('door' in sprite.traits && entry.door_closed);
				if (carries && y >= this.entry_box(entry, sprite).y1 - 1.0) return true;
			}
			return false;
		}
		const ids_x = new Set(this.game.interval_tree_x.search([x - 0.5, x + 0.5]));
		for (const i of this.game.interval_tree_y.search([y - 0.5, y - 0.01])) {
			if (!ids_x.has(i)) continue;
			const entry = this.game.active_level_sprites[i];
			if (entry.signal_hidden) continue;
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
		// (turned gravity: the player and its own start in the enemy's coordinates)
		const [px, py] = alive ? this.local_xy(player.mesh.position.x, player.mesh.position.y) : [0, 0];
		const home = this.local_xy(this.initial_position[0], this.initial_position[1]);
		return {
			now: this.game.clock.getElapsedTime(),
			on_ground: this.touching_ground(),
			// swimming or floating (a Bewegungsbereich): 'swim' | 'float' | null
			fluid: this.fluid_mode ?? null,
			on_ladder: Boolean(this.has_trait_at(['ladder'], -0.5, 0.5, -1.1, 1.1)),
			facing: this.last_horizontal_facing ?? (this.traits.start_dir === 'left' ? 'left' : 'right'),
			x: this.mesh.position.x, y: this.mesh.position.y,
			x0: home[0], y0: home[1],
			half_width: w2,
			player: alive ? {
				dx: px - this.mesh.position.x,
				dy: py - this.mesh.position.y,
				// how far apart the two centres are when their collision boxes touch
				touch: (px >= this.mesh.position.x ?
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

	// ------------------------------------------------ Begleiter (companion_ai.js)

	// One step of a companion: it decides its keys like an enemy does, with its
	// own abilities; the movement below is the shared Character code.
	simulate_companion(t) {
		this.ai_speed = 1.0;
		this.ai_dy = 0;
		this.ai_no_gravity = false;
		this.ai_face = null;
		this.ai_pose = null;
		const player = this.game.player_character;
		// "kommt erst bei Signal mit": it stays where it is (a flyer hovers) and
		// looks at the player when it comes close
		if (this.companion_waiting) {
			for (const k of [KEY_LEFT, KEY_RIGHT, KEY_JUMP, KEY_UP, KEY_DOWN]) this.pressed_keys[k] = false;
			this.ai_no_gravity = Boolean(this.companion.fly);
			if (player?.mesh && Math.abs(player.mesh.position.x - this.mesh.position.x) < 6 * 24) {
				this.ai_face = player.mesh.position.x < this.mesh.position.x ? 'left' : 'right';
				// a bird that was sitting on the ground stays there while it looks
				if (this.companion.fly && this.touching_ground() && this.companion_home_memory?.idle?.kind === 'ground') this.ai_no_gravity = false;
				return;
			}
			// nobody near: it keeps busy around its own place (companion_ai.js)
			this.companion_home ??= [this.mesh.position.x, this.mesh.position.y];
			this.companion_home_memory ??= { seed: 777 + (this.companion_slot ?? 0) * 31 };
			const w = this.companion_perception(null);
			const [hx, hy] = this.companion_home;
			w.player = { dx: hx - this.mesh.position.x, dy: hy - this.mesh.position.y, x: hx, y: hy, facing: 'right', start: 0.5 };
			if (typeof companion_idle_ready === 'function' && companion_idle_ready(this.companion_home_memory, w))
				this.apply_companion_decision(this.companion.fly ?
					companion_idle_fly(this.companion, this.companion_home_memory, w) :
					companion_idle_walk(this.companion, this.companion_home_memory, w));
			return;
		}
		// while the player is dead or the curtain is down, it waits
		const alive = player && player !== this && !player.dead() && this.game.running !== false &&
			!this.game.curtain?.showing;
		const out = companion_decide(this.companion, this.companion_memory, this.companion_perception(alive ? player : null));
		this.apply_companion_decision(out);
		if (alive) this.update_companion_lost(t, player);
	}

	// The keys, speed and pose a companion decided on (companion_ai.js).
	apply_companion_decision(out) {
		this.ai_no_gravity = Boolean(out.no_gravity);
		this.pressed_keys[KEY_LEFT] = Boolean(out.keys?.left);
		this.pressed_keys[KEY_RIGHT] = Boolean(out.keys?.right);
		this.pressed_keys[KEY_JUMP] = Boolean(out.keys?.jump);
		this.pressed_keys[KEY_UP] = Boolean(out.keys?.up);
		this.pressed_keys[KEY_DOWN] = Boolean(out.keys?.down);
		this.ai_speed = out.speed ?? 1.0;
		this.ai_dy = out.dy ?? 0;
		this.ai_face = out.face ?? null;
		// "sitzt" / "beschäftigt sich" – shown only if the sprite has such a picture
		this.ai_pose = out.pose ?? null;
	}

	// What a companion perceives (see companion_decide).
	companion_perception(player) {
		const w2 = this.sprite.width * 0.5, h = this.sprite.height;
		const gravity = Number(this.game.data.properties.gravity) || 0.5;
		const side = dir => (dir === 'left' ? -1 : 1);
		const regions = this.game.movement_regions;
		const swim_at = (x, y) => typeof MovementRegions !== 'undefined' &&
			MovementRegions.at(regions, x, y)?.mode === 'swim';
		return {
			now: this.game.clock.getElapsedTime(),
			on_ground: this.touching_ground(),
			fluid: this.fluid_mode ?? null,
			slot: this.companion_slot ?? 0,
			near_surface: this.fluid_surface !== null && this.fluid_surface !== undefined &&
				this.fluid_surface - (this.mesh.position.y + h * 0.5) < h * 0.6,
			player: player ? {
				dx: player.mesh.position.x - this.mesh.position.x,
				dy: player.mesh.position.y - this.mesh.position.y,
				x: player.mesh.position.x, y: player.mesh.position.y,
				facing: player.last_horizontal_facing ?? 'right',
			} : null,
			// which keep-busy pictures it has ("sitzt", "beschäftigt sich"); for
			// the movement states only drawn ones count (walk is never missing:
			// it falls back to the standing picture)
			has_pose: kind => ['stand', 'walk', 'jump', 'fall'].includes(kind) ?
				Object.values(this.sti_for_state[kind] ?? {}).some(e => e.confidence >= 100) :
				Boolean(this.sti_for_state[kind]),
			// how far down the ground is (px, at most max), or null
			ground_below: max => {
				for (let d = 0; d <= max; d += 2)
					if (this.has_trait_at(['block_above', 'slope'], -w2 + 1, w2 - 1, -d - 1.0, -d)) return d;
				return null;
			},
			wall: dir => Boolean(dir === 'left' ?
				this.has_trait_at(['block_sides'], -w2 - 1, -w2, 0.1, h - 0.1) :
				this.has_trait_at(['block_sides'], w2, w2 + 1, 0.1, h - 0.1)),
			// its own jump decides – never the player's
			clearable: dir => this.can_jump_over(dir),
			ground: dir => Boolean(dir === 'left' ?
				this.has_trait_at(['block_above', 'slope'], -w2, -w2 + 1, -1.0, 0.0) :
				this.has_trait_at(['block_above', 'slope'], w2 - 1, w2, -1.0, 0.0)),
			// where its own jump lands (at this speed): ground at the same height
			landing: (dir, speed = 1) => {
				const hop = this.traits.vrun * speed * 2 * this.traits.vjump / gravity;
				return Boolean(this.has_trait_at(['block_above', 'slope'], side(dir) * hop - 2, side(dir) * hop + 2, -1.0, 0.0));
			},
			safe_drop: dir => this.safe_drop(dir),
			// water right ahead, or below the ledge ahead
			water: dir => {
				const x = this.mesh.position.x + side(dir) * (w2 + 6), y = this.mesh.position.y;
				return [h * 0.5, -6, -30, -54].some(dy => swim_at(x, y + dy));
			},
		};
	}

	// Lost and found (companion_lost_step): far, out of sight and getting no
	// closer for a while → lost; a little later it comes back near the player.
	update_companion_lost(t, player) {
		const dx = player.mesh.position.x - this.mesh.position.x;
		const dy = player.mesh.position.y - this.mesh.position.y;
		const c = this.game.camera ? (this.game.view_box?.() ?? this.game.camera) : null;
		const w2 = this.sprite.width * 0.5, h = this.sprite.height;
		const x = this.mesh.position.x, y = this.mesh.position.y;
		const visible = Boolean(c) && x + w2 >= c.left && x - w2 <= c.right && y + h >= c.bottom && y <= c.top;
		const result = companion_lost_step(this.companion_memory, {
			now: t, distance: Math.hypot(dx, dy), visible,
			busy: !this.companion.fly && !this.fluid_mode && !this.touching_ground(),
			// fallen out of the level (into a pit)
			fell_out: y < this.game.miny - 2 * 24,
		});
		if (result === 'lost' && !this.companion_counted_lost) {
			this.companion_counted_lost = true;
			this.companion_stats.lost += 1;
		}
		if (result === 'following') this.companion_counted_lost = false;
		if (result === 'return') this.return_to_player(player, t);
	}

	// The companion's body at (x, y) would be free of walls and blocks.
	companion_box_free(x, y) {
		const old_x = this.mesh.position.x, old_y = this.mesh.position.y;
		this.mesh.position.x = x;
		this.mesh.position.y = y;
		const w2 = this.sprite.width * 0.5 * 0.7, h = this.sprite.height;
		const blocked = this.has_trait_at(['block_sides', 'block_above', 'block_below', 'slope'], -w2, w2, 1, h - 1);
		this.mesh.position.x = old_x;
		this.mesh.position.y = old_y;
		return !blocked;
	}

	// Heights at x where the companion could come back: on ground (and in the
	// water for a swimmer), in the air for a flyer.
	companion_spots_at(x, player) {
		const h = this.sprite.height;
		const py = player.mesh.position.y;
		const swim_at = (yy) => typeof MovementRegions !== 'undefined' &&
			MovementRegions.at(this.game.movement_regions, x, yy + h * 0.5)?.mode === 'swim';
		const ys = [];
		if (this.companion.fly) {
			for (const dy of [COMPANION.FLY_ABOVE, 48, 0, 72, -24]) ys.push(py + dy);
		} else {
			for (const i of this.game.collision_candidates(x - 1, x + 1, py - 160, py + 96)) {
				const entry = this.game.active_level_sprites[i];
				const sprite = this.game.data.sprites[entry.sprite_index];
				if ('block_above' in sprite.traits) ys.push(entry.mesh.position.y + sprite.height);
				else if ('slope' in sprite.traits) {
					let tx = (x - (entry.mesh.position.x - sprite.width * 0.5)) / sprite.width;
					if (sprite.traits.slope.direction === 'negative') tx = 1.0 - tx;
					ys.push(entry.mesh.position.y + tx.clamp(0.0, 1.0) * sprite.height);
				}
			}
			// a swimmer may also come back in the water the player is in
			if (this.companion.swim && player.fluid_mode === 'swim')
				for (let dy = -48; dy <= 48; dy += 12) if (swim_at(py + dy)) ys.push(py + dy);
		}
		return ys.filter(yy => this.companion_box_free(x, yy) && (this.companion.swim || this.companion.fly || !swim_at(yy)));
	}

	// The game helps a lost companion: it comes back just outside the screen,
	// behind the player (or ahead), and walks or flies in. Only if there is no
	// such place, it appears right beside the player.
	return_to_player(player, t, nearby = false) {
		const c = this.game.camera ? (this.game.view_box?.() ?? this.game.camera) : null;
		const facing = player.last_horizontal_facing ?? 'right';
		const behind = facing === 'left' ? 'right' : 'left';
		let spot = null;
		if (!nearby && c) {
			const xs = companion_return_xs({ left: c.left, right: c.right }, player.mesh.position.x, behind, this.sprite.width);
			const spots = [];
			xs.forEach((x, order) => { for (const y of this.companion_spots_at(x, player)) spots.push({ x, y, order }); });
			spot = companion_pick_spot(spots, player.mesh.position.y);
		}
		if (!spot) {
			const px = player.mesh.position.x, py = player.mesh.position.y;
			const back = behind === 'left' ? -1 : 1;
			const lift = this.companion.fly ? COMPANION.FLY_ABOVE : 0;
			spot = [[px + back * 20, py + lift], [px, py + lift], [px, py]].map(([x, y]) => ({ x, y }))
				.find(s => this.companion_box_free(s.x, s.y)) ?? { x: px, y: py };
		}
		this.mesh.position.x = spot.x;
		this.mesh.position.y = spot.y;
		this.vx = 0;
		this.vy = 0;
		this.update_state_and_direction(this.state, spot.x < player.mesh.position.x ? 'right' : 'left');
		companion_returned(this.companion_memory, t, Math.hypot(player.mesh.position.x - spot.x, player.mesh.position.y - spot.y));
		this.companion_counted_lost = false;
		if (!nearby) this.companion_stats.returned += 1;
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
		if (show) {
			// above its head – its own up (turned gravity)
			const [ax, ay] = this.world_of(this.mesh.position.x, this.mesh.position.y + this.sprite.height * this.traits.ex_top + 7);
			this.alert_mesh.position.set(ax, ay, 1.0);
			this.alert_mesh.rotation.z = this.frame_k * Math.PI / 2;
		}
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
				const from_start = this.mesh.position.x - this.local_xy(this.initial_position[0], this.initial_position[1])[0];
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
			this.game.curtain.show_screen('game_over', {}, 0.5, 2.0, function () {
				self.game.stop();
				$('#screen').hide();
			});
		} else {
			this.game.curtain.show_screen('lost_life', { lives: this.game.lives }, 0.5, 1.0, function () {
				self.reset_gravity();
				self.mesh.position.x = self.initial_position[0];
				self.mesh.position.y = self.initial_position[1];
				// Begleiter come along to the place where the figure starts again
				for (const companion of self.game.companions ?? [])
					if (!companion.companion_waiting) companion.return_to_player(self, self.game.clock.getElapsedTime(), true);
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
			// "unverwundbar": nothing hurts it (combat, falling blocks, anything later)
			if (this.traits?.invincible === true) return;
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
				const drop = this.game.spawn_drop?.(this);
				// Signale: "sendet, wenn besiegt", "alle Gegner besiegt" (once)
				if (!this.defeated) {
					this.defeated = true;
					// the level memory: it stays defeated, its loot stays where it fell
					this.game.remember_defeated?.(this, drop ?? this.drop_entry ?? null);
					this.game.baddie_defeated?.(this, this.game.clock.getElapsedTime());
				}
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
			let [x0, x1, y0, y1] = this.world_box(-this.sprite.width * 0.5 * this.traits.ex_left,
				this.sprite.width * 0.5 * this.traits.ex_right, 0, this.sprite.height * this.traits.ex_top);
			let c = this.game.view_box?.() ?? this.game.camera;
			if ((x0 >= c.left && x0 <= c.right && y0 >= c.bottom && y0 <= c.top) ||
				(x1 >= c.left && x1 <= c.right && y0 >= c.bottom && y0 <= c.top) ||
				(x0 >= c.left && x0 <= c.right && y1 >= c.bottom && y1 <= c.top) ||
				(x1 >= c.left && x1 <= c.right && y1 >= c.bottom && y1 <= c.top)) {
				this.simulate_this = true;
			}
		}

		if (!this.simulate_this) return;
		// a Bewegungsbereich may turn gravity: then the step runs in the figure's
		// own coordinates (enter_frame) and is turned back into the world after it
		this.update_gravity_direction(t);
		if (!this.gravity_k) return this.simulation_body(t);
		this.enter_frame();
		try {
			if (this.turn_settle) this.settle_after_turn();
			this.simulation_body(t);
		} finally {
			this.leave_frame();
		}
	}

	// One step of moving, colliding and collecting (simulation_step).
	simulation_body(t) {
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
		else if (this.character_trait === 'companion') {
			this.simulate_companion(t);
		}

		if (this.character_trait === 'actor') {
			this.pressed_keys = this.game.pressed_keys;
			if (this.game.curtain.showing)
				this.pressed_keys = {};
			// a turned gravity with the camera staying: the arrow keys follow the screen
			else if (this.frame_k && this.gravity_camera === 'fixed')
				this.pressed_keys = this.screen_keys(this.pressed_keys);
		}

		let entry = this.has_trait_at(['falls_down'], -0.5, 0.5, -1.0, -0.1);
		if (entry) {
			let sprite = this.game.data.sprites[entry.sprite_index];
			// a Begleiter never breaks the player's way
			if (this.character_trait !== 'companion' && !(this.character_trait === 'baddie' && (!sprite.traits.falls_down.falls_on_baddie))) {
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
		if (this.character_trait === 'baddie' || this.character_trait === 'companion') factor *= this.ai_speed;
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
		let move = (this.character_trait === 'actor' || ((this.character_trait === 'baddie' || this.character_trait === 'companion') && !this.ai_no_gravity)) &&
			typeof MovementRegions !== 'undefined' ?
			MovementRegions.at(this.game.movement_regions, ...this.world_center(), this.game.signal_hidden_layers) : null;
		// turned gravity: a current pushes in the world's direction – in the figure's own
		if (move && this.frame_k) {
			const [cx, cy] = MovementRegions.to_local(this.frame_k, move.current.x, move.current.y);
			move = { ...move, current: { x: cx, y: cy } };
		}
		// A Begleiter that cannot swim does not swim: water is no Bewegungsbereich
		// for it (it waits at the shore; companion_ai.js). A flyer flies over it.
		if (move?.mode === 'swim' && this.character_trait === 'companion' && !this.companion.swim) move = null;
		const fluid = move && (move.mode === 'swim' || move.mode === 'float') ? move : null;
		// the enemy AI looks at this in the next step (swims after the player)
		this.fluid_mode = fluid ? fluid.mode : null;
		this.fluid_surface = fluid ? fluid.surface : null;
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
					// the player (and a Begleiter following it) leaps out of the water; enemies stay in it
					near_surface: (actor || this.character_trait === 'companion') && !this.frame_k && fluid.surface - (this.mesh.position.y + this.sprite.height * 0.5) < this.sprite.height * 0.6,
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
			// a flying Begleiter with "fliegt" pictures shows them, moving or hovering
			if (this.character_trait === 'companion' && this.sti_for_state.fly) state = 'fly';
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
				const inside = (x, y) => MovementRegions.at(this.game.movement_regions, ...this.world_of(x, y + h2), this.game.signal_hidden_layers)?.mode === fluid.mode;
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
		if (this.character_trait === 'baddie' || this.traits.can_jump) {
			if (this.standing_on_ground()) {
				this.vy = 0;
				if (this.pressed_keys[KEY_JUMP])
					this.vy = this.traits.vjump * this.vjump_factor();
			}
		}

		if (this.traits.affected_by_gravity && !this.ai_no_gravity) {
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
			// a shop item (placed pickup.price > 0) is bought with F, not collected on touch
			entry = this.has_trait_at(['pickup'], -this.traits.ex_left * this.sprite.width * 0.5 + 0.1,
				this.traits.ex_right * this.sprite.width * 0.5 - 0.1, 0.1, this.traits.ex_top * this.sprite.height - 0.1,
				(e) => !(e.shop_price > 0));
			if (entry) {
				let sprite = this.game.data.sprites[entry.sprite_index];
				let entry_lives = sprite.traits.pickup.lives;
				if (!(entry_lives > 0 && this.game.lives >= this.game.data.properties.max_lives))
					this.collect_pickup(entry, t);
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
				this.collected_flies_up(entry, t);
				// a key with "kein Signal" opens nothing
				if (entry.signal_code !== null) this.game.found_keys[entry.signal_code] = true;
				this.game.remember_collected?.(this.game.active_level_sprites[entry.entry_index]);
				// …and sends its Code: doors with "öffnen" and layers react, too.
				this.game.signals?.send(entry.signal_code, true, t, { delay: entry.signal_delay });
				this.game.remember_send?.(entry.signal_code, true);
				this.game.update_stats();
			}

			// Druckplatten: "an" when the figure steps on, "aus" when it leaves.
			this.game.update_pressure_plates(this, t);

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

				// a placed door may open differently from its drawing (signals.js door_setting)
				if (door_setting(this.game.active_level_sprites[entry.entry_index].automatic, sprite.traits.door.automatic)) {
					this.game.open_door_intent(entry.entry_index, t);
				} else {
					// an open door can be closed with F only while nobody stands in it
					// (Game.door_occupied: the figure or an enemy overlapping the door)
					let ok = true;
					if (this.game.active_level_sprites[entry.entry_index].door_closed === false)
						ok = !this.game.door_occupied(entry.entry_index);
					if (ok) {
						this.game.active_level_sprites[entry.entry_index].overlay_mesh.visible = true;
						this.game.action_key_targets.door ??= [];
						this.game.action_key_targets.door.push(entry.entry_index);
					}
				}
			}

			entry = this.has_trait_at(['switch'],
				-this.traits.ex_left * this.sprite.width * 0.5 - 10,
				this.traits.ex_right * this.sprite.width * 0.5 + 10,
				-10,
				this.traits.ex_top * this.sprite.height + 10);
			if (entry) {
				this.game.active_level_sprites[entry.entry_index].overlay_mesh.visible = true;
				this.game.action_key_targets.switch ??= [];
				this.game.action_key_targets.switch.push(entry.entry_index);
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

			// Laden: standing at something with a Preis – the F hint, bought on a fresh press (below).
			// Within reach also when it lies on a counter a little above the figure's head.
			entry = this.has_trait_at(['pickup'],
				-this.traits.ex_left * this.sprite.width * 0.5 - 4,
				this.traits.ex_right * this.sprite.width * 0.5 + 4,
				-4,
				this.traits.ex_top * this.sprite.height + Character.SHOP_REACH_UP,
				(e) => e.shop_price > 0 && !e.collected);
			if (entry) {
				const overlay = this.game.active_level_sprites[entry.entry_index].overlay_mesh;
				if (overlay) overlay.visible = true;
				this.game.action_key_targets.shop = [entry.entry_index];
			}
			// stepping up to it: its Beschreibung is said
			this.game.shop_look?.(entry ? entry.entry_index : null, t);

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
				// "sendet, wenn die Figur davorsteht": "an" when the figure gets to
				// an exit, "aus" when it leaves – open or still closed
				this.game.exit_reached?.(entry, t);
				// "öffnet erst bei Signal": a closed exit is no exit yet
				if (entry && entry.exit_open === false) entry = null;
				// An exit does nothing until the figure has once stood beside every
				// exit: it may start or arrive (level_flow.js) on one.
				if (!entry) this.game.exit_armed = true;
				else if (entry.exit_action_key === true) {
					// "nur mit Aktionstaste": the F hint, and through on a fresh press (below)
					const overlay = this.game.active_level_sprites[entry.entry_index].overlay_mesh;
					if (overlay) overlay.visible = true;
					this.game.action_key_targets.exit = [entry.entry_index];
				} else if (this.game.exit_armed) {
					this.game.complete_level(entry.delta ?? 1, entry.exit_target);
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

			// (the camera follows the feet in the world; a turned camera: Game.view_extents)
			const [wx, wy] = this.world_xy();
			if (this.follow_camera) {
				let scale = this.game.height / this.game.screen_pixel_height;
				const half_x = (this.game.width / 2 / scale) * this.game.screen_safe_zone_x;
				const half_y = (this.game.height / 2 / scale) * this.game.screen_safe_zone_y;
				const [safe_x, safe_y] = this.game.view_extents?.(half_x, half_y) ?? [half_x, half_y];
				let safe_zone_x0 = wx - safe_x;
				let safe_zone_x1 = wx + safe_x;
				let safe_zone_y0 = wy - safe_y;
				let safe_zone_y1 = wy + safe_y;
				if (this.game.camera_x < safe_zone_x0) this.game.camera_x = safe_zone_x0;
				if (this.game.camera_x > safe_zone_x1) this.game.camera_x = safe_zone_x1;
				if (this.game.camera_y < safe_zone_y0) this.game.camera_y = safe_zone_y0;
				if (this.game.camera_y > safe_zone_y1) this.game.camera_y = safe_zone_y1;
			}
			if (!this.dead()) {
				// fallen out of the level – where its gravity pulls
				const out = this.game.screen_pixel_height * 1.5;
				if ([wy < this.game.miny - out, wx > this.game.maxx + out, wy > this.game.maxy + out, wx < this.game.minx - out][this.gravity_k])
					this.die(null, null);
			}
			// A switch flips once per press, not in every step the key is held.
			const action_pressed = Boolean(this.pressed_keys[KEY_ACTION]);
			if (switch_flipped(action_pressed, this.action_was_pressed)) {
				for (let entry_index of (this.game.action_key_targets.switch ?? []))
					this.game.flip_switch(entry_index, t);
				// a shop: buy what the figure stands at (or say why not); else a sign:
				// read it out – or, while somebody speaks, the next sentence
				if (!this.game.shop_action?.(this, t))
					this.game.speech_action?.(t);
				// an exit "nur mit Aktionstaste" – not with F still held from the level before
				const exit_index = (this.game.action_key_targets.exit ?? [])[0];
				if (exit_index !== undefined && this.game.exit_key_ready && !this.game.reached_flag) {
					const exit = this.game.active_level_sprites[exit_index];
					this.game.complete_level(exit.delta ?? 1, exit.exit_target);
				}
			}
			if (!this.game.action_key_held?.()) this.game.exit_key_ready = true;
			this.action_was_pressed = action_pressed;
			if (this.pressed_keys[KEY_ACTION]) {
				for (let entry_index of (this.game.action_key_targets.door ?? [])) {
					this.game.toggle_door_intent(entry_index, t);
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

	// A screen of screens.js (in German, in the game's pixel font): kind and
	// info as curtain_screen takes them; the prompt comes from the game.
	show_screen(kind, info, text_delay, key_delay, oncomplete) {
		const game = this.game;
		const token = this.token = (this.token ?? 0) + 1;
		const screen = curtain_screen(kind, { prompt: game.continue_prompt?.(), ...(info ?? {}) });
		const font = speech_settings(game.data?.properties).font;
		setTimeout(() => {
			Promise.resolve(game.speech_fonts_ready?.()).then(() => {
				// hidden or replaced in the meantime
				if (!this.showing || token !== this.token) return;
				const box = $('#curtain_text');
				render_curtain(box, screen, box.height() || window.innerHeight, font, box.width() || null);
				box.addClass('showing');
			});
		}, text_delay * 1000.0);
		$('#curtain').addClass('showing');
		this.oncomplete = oncomplete;
		this.showing = true;
		this.ts_continue = game.clock.getElapsedTime() + key_delay;
	}

	hide() {
		this.token = (this.token ?? 0) + 1;
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
		// the keys that are down right now (unlike pressed_keys, not forgotten by setup())
		this.keys_down = new Set();
		// keys pressed in the game (setup() starts it anew); there before the first level, so a key
		// pressed while a game is still loading (or failed to load) does no harm
		this.pressed_keys = {};
		// Sprechtexte (speech.js): what is being said, drawn in a last render pass
		this.speech = new Speech();
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
			// a test run from the studio: R starts the level again (unless R is
			// one of the game's own keys), Esc goes back to the level editor
			if (this.playtest && !e.repeat && (e.key ?? '').toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey &&
				!this.key_actions.has(e.code)) {
				e.preventDefault();
				this.restart_playtest();
				return;
			}
			if (this.playtest && e.code === 'Escape') {
				e.preventDefault();
				this.end_playtest();
				return;
			}
			this.keys_down.add(e.code);
			this.handle_key_down(e.code)
		});
		window.addEventListener('keyup', (e) => {
			this.keys_down.delete(e.code);
			this.handle_key_up(e.code)
		});
		window.addEventListener('touchstart', (e) => {
			const first = !this.touch_seen;
			this.touch_seen = true;
			$('#touch_controls').show();
			// the start screen now explains the touch controls
			if (first) this.render_start_screen();
		});
		// turned sideways, full screen on or off: the start screen's hint follows
		window.addEventListener('resize', () => { if (this.data) this.update_start_hint(); });
		window.addEventListener('mousemove', (e) => {
			this.pointer_client = { x: e.clientX, y: e.clientY };
			this.update_pointer_world(e.clientX, e.clientY);
		});
		window.addEventListener('blur', () => {
			this.pointer_world.valid = false;
			this.pointer_client = null;
			this.keys_down.clear();
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
		// the levels the figure came from ("zurück", level_flow.js) and the one it
		// just left (where it arrives in the next one)
		this.level_trail = [];
		this.arrived_from = null;
		// what happened in each level during this run (level id → record): a level
		// that is entered again looks as it was left (remember_* / restore_level_memory)
		this.level_memory = {};
		this.memory_now = null;
		this.lives = 5;
		this.energy = 100;
		this.found_keys = {};
		// what stays for the whole game, and the weapons chosen (inventory.js):
		// only a new game (or game over) empties it, not a lost life
		this.inventory = [];
		this.weapon_choice = { nah: null, fern: null };
		this.handle_resize();
		this.stop();
		this.just_started = true;
		$('#overlay').show();
		$('#screen').hide();
		this.curtain.hide();
		this.speech?.stop();

		this.points = 0;

		// no game yet – or one whose load failed halfway: nothing to start from
		if (!this.data?.properties)
			return;

		this.lives = this.data.properties.lives_at_begin;
		this.energy = this.data.properties.energy_at_begin;
		this.points = 0;
		// a game starts with the first level of the order (Level verwenden, no Nebenlevel)
		this.level_index = first_level_index(this.data.levels);
	}

	// Is a key that means "Aktion" held down right now? (keys_down: the keyboard
	// as it is, also across a level change, which forgets pressed_keys)
	action_key_held() {
		for (const code of this.keys_down ?? [])
			if ((this.key_actions.get(code) ?? []).includes('action')) return true;
		return false;
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

	// Beute (traits.baddie.drop = { sprite_index, signal_code }): a defeated enemy
	// leaves a sprite behind that can be collected like a placed one – a key
	// (with the placed enemy's baddie.drop_code, else the drawing's Code) or
	// anything "man kann es einsammeln". Absent = nothing.
	spawn_drop(owner) {
		const drop = owner?.traits?.drop;
		const si = drop?.sprite_index;
		const sprite = Number.isInteger(si) ? this.data.sprites[si] : null;
		if (!sprite || owner.dropped || !this.mesh_catalogue[si]) return null;
		if (!('pickup' in sprite.traits) && !('key' in sprite.traits)) return null;
		owner.dropped = true;
		const mesh = this.mesh_catalogue[si].clone();
		const remembered_owner = owner;
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
		// the placed enemy's own Code, else the drawing's (signals.js effective_loot_code)
		if ('key' in sprite.traits) entry.signal_code = effective_loot_code(owner.placed_signal, drop);
		const index = this.active_level_sprites.length;
		this.active_level_sprites.push(entry);
		// the enemy knows its loot (the level memory keeps it if nobody collects it)
		remembered_owner.drop_entry = entry;
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
		const material = mode ? this.blend_material(info.sheet, mode) : info.material;
		// an enemy on a layer that fades in or out (Signale) fades with it
		const fade = this.signal_layer_fades?.get(mesh?.userData?.signal_layer);
		return fade ? (LayerFade.copy_for(fade.materials, material, fade.alpha) ?? material) : material;
	}

	// tag: a saved game (/gen/games, the play link) – or, with play_copy, the
	// studio's game as Spielen sent it (/api/play_copy, play_copies.rb)
	// The game is complete only when load() is done: this.data comes first,
	// the sprite sheets and the overlay icons after it. Start waits for
	// this.loading (a Start while the sheets were still on their way ran
	// setup() on half a game: 34bcb4, October 2026).
	load(tag, options = {}) {
		this.loaded = false;
		this.loading = this.load_now(tag, options);
		this.loading.then(() => { this.loaded = true; }, () => null);
		return this.loading;
	}

	async load_now(tag, { play_copy = false } = {}) {
		// load game json
		this.playtest = null;
		$('#playtest_badge').removeClass('showing');
		this.reset();
		if (window.yt_player !== null) {
			try {
				window.yt_player.pauseVideo();
			} catch { }
		}

		const urls = play_copy ?
			{ game: `/api/play_copy/${tag}`, sheets: `/api/play_copy/${tag}/sheets` } :
			{ game: `/gen/games/${tag}.json`, sheets: `/gen/spritesheets/${tag}.json` };
		this.data = await (await fetch(urls.game)).json();
		// Games saved before December 2022 have no properties at all (the studio
		// fills them in, game.js fix_game_data): each value is absent, as in any
		// game that never set it.
		this.data.properties ??= {};
		// Door codes and Sichtbarkeitsbereiche of older games become Signale
		// (signals.js), exactly as the studio does when it loads them.
		promote_legacy_signals(this.data);
		// Saved games refer to sprites by ID (game_ids.js); the engine keeps
		// working with array indices. Old games already hold indices.
		resolve_sprite_references_to_indices(this.data);
		// the first level of the order (reset() ran before this game was there)
		this.level_index = first_level_index(this.data.levels);
		this.spritesheet_info = await (await fetch(urls.sheets)).json();
		this.spritesheets = [];
		for (let i = 0; i < this.spritesheet_info.spritesheets.length; i++) {
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
		// the title in the game's own pixel font (screens.js), once it has loaded
		if (typeof start_screen === 'function') {
			const font = speech_settings(this.data.properties).font;
			const head = start_screen(this.data.properties);
			const family = SPEECH_FONTS[font]?.family;
			Promise.resolve(this.speech_fonts_ready?.()).then(() => {
				const height = $('#overlay').height() || window.innerHeight;
				render_curtain($('#game_title').attr('aria-label', this.data.properties.title ?? ''), head, height, font, $('#overlay').width() || null);
				$('#game_author').empty();
				if (family) $('#overlay .menu').css('font-family', `"${family}", 'Bebas Neue', sans-serif`);
			});
		}
		this.render_start_screen();
		this.setup();
		this.ts_zoom_actor = -1;
		this.reached_flag = false;
		// if (window.location.host.substring(0, 9) === 'localhost') {
		// 	this.run();
		// 	// $('#touch_controls').show();
		// }
	}

	stop() {
		this.speech?.stop();
		window.yt_pending = null;   // music that is still loading must not start later
		if (window.yt_player !== null) {
			window.yt_player.pauseVideo();
		}
	}

	// The level is done: by the exit (a sprite with level_complete, its placed
	// delta and target) or by a Signal (level setting signal_level_complete,
	// delta 1, signal_level_complete_target). Once per level (reached_flag); the
	// camera zooms onto the figure, then the curtain leads to where the exit
	// leads (level_flow.js: the next level in use unless something else was
	// chosen) – or THE END.
	complete_level(delta = 1, target = null) {
		if (this.reached_flag || this.replaying_memory) return false;
		this.reached_flag = true;
		this.ts_zoom_actor = this.clock.getElapsedTime();
		let self = this;
		const levels = self.data.levels;
		const here = levels[self.level_index];
		const result = resolve_level_exit(levels, self.level_index, { target, delta }, self.level_trail);
		if (!result.end) {
			const next = levels[result.index];
			this.curtain.show_screen('level_complete', { next_name: next.properties.name }, 0.5, 1.0, function () {
				self.level_trail = next_level_trail(self.level_trail, here?.id ?? null, result, next.id ?? null);
				// the figure arrives at the exit that leads back here (setup: place_player_on_arrival)
				self.arrived_from = here?.id ?? null;
				self.level_index = result.index;
				self.setup();
				self.run();
			});
		} else {
			this.curtain.show_screen('the_end', this.end_screen_info(), 0.5, 2.0, function () {
				self.stop();
				$('#screen').hide();
			});
		}
		return true;
	}

	// The F hint of a door, sign, Schalter or exit is drawn in front of every
	// sprite of its layer (the scene is drawn in order, renderer.sortObjects is
	// off), but behind the figure: the hints go to the end of their layer, and
	// in the figure's own layer the figure comes last, after them – in front of
	// every sprite of its layer. (Before, the hints went just before the figure,
	// so a sign placed after the figure covered its own hint, and the figure
	// stood behind every sprite placed after it: an intentional fix.) In a layer
	// in front of the figure's, the hints stay in front, like that layer.
	place_overlay_meshes() {
		for (const mesh of this.overlay_meshes) {
			const group = mesh.parent;
			if (!group) continue;
			group.remove(mesh);
			group.add(mesh);
		}
		const player = this.player_character?.mesh ?? null;
		const group = player?.parent ?? null;
		if (group) {
			group.remove(player);
			group.add(player);
		}
	}

	// the level an exit without a target leads to (level_flow.js)
	get_next_level_index(delta) {
		return next_level_in_sequence(this.data.levels, this.level_index, delta);
	}

	// Came through an exit with a chosen target: the figure starts at the exit
	// that leads back (level_flow.js arrival_exit_index) – also after losing a
	// life – and its Begleiter come along. Without one: the level's own start.
	place_player_on_arrival() {
		const from = this.arrived_from;
		this.arrived_from = null;
		const pc = this.player_character;
		if (!from || !pc) return;
		const exits = this.active_level_sprites.filter(entry =>
			entry.layer_index !== null && 'level_complete' in this.data.sprites[entry.sprite_index].traits);
		const i = arrival_exit_index(this.data.levels, this.level_index, exits.map(entry => ({ target: entry.exit_target })), from);
		if (i < 0) return;
		const exit = exits[i];
		pc.mesh.position.x = exit.mesh.position.x;
		pc.mesh.position.y = this.free_start_height(pc, exit.mesh.position.x, exit.mesh.position.y);
		pc.initial_position = [pc.mesh.position.x, pc.mesh.position.y];
		this.camera_x = pc.mesh.position.x;
		this.camera_y = pc.mesh.position.y + this.data.properties.screen_pixel_height * 0.3;
		for (const companion of this.companions ?? [])
			if (!companion.companion_waiting) companion.return_to_player(pc, 0, true);
	}

	// Lives, energy and points are read by the HUD in every frame (draw_hud);
	// callers still say when they changed.
	update_stats() {
	}

	// ------------------------------------------------- Inventar and weapons
	// inventory.js: what "bleibt fürs ganze Spiel" stays in game.inventory; a
	// weapon among it can be chosen with the number keys.

	// A kept sprite was collected (or bought): one more in the inventory. A new
	// weapon is chosen at once; the level's "sendet, wenn die Spielfigur … hat"
	// sends the first time the figure has it.
	keep_item(si, t) {
		const count = inventory_add(this.inventory, si);
		const sprite = this.data.sprites[si];
		if (is_weapon(sprite)) {
			this.weapon_choice = choose_weapon(this.weapon_choice, this.data.sprites, si);
			this.apply_weapons();
		}
		if (count === 1)
			for (const item of this.item_signals ?? [])
				if (item.sprite_index === si) this.signals?.send(item.signal_code, true, t);
	}

	// The figure's attacks: its own, with the chosen weapons in front (the game
	// uses the first attack of a kind). Without weapons: exactly its own.
	apply_weapons() {
		const pc = this.player_character;
		if (!pc) return;
		pc.own_traits ??= pc.traits;
		if (!this.inventory?.some(item => is_weapon(this.data.sprites[item.sprite_index]))) {
			pc.traits = pc.own_traits;
		} else {
			const attacks = attacks_with_weapons(pc.own_traits.attacks, this.data.sprites, this.weapon_choice);
			pc.traits = { ...pc.own_traits, attacks };
		}
		this.update_touch_buttons();
	}

	// A number key: the weapon with that number, if the figure has one.
	choose_weapon_key(n) {
		const si = weapon_for_key(this.inventory, this.data.sprites, n);
		if (si === null) return false;
		this.weapon_choice = choose_weapon(this.weapon_choice, this.data.sprites, si);
		this.apply_weapons();
		return true;
	}

	// What the HUD shows of the inventory: [{ sprite_index, count, key, chosen }]
	hud_items() {
		if (!this.inventory?.length) return [];
		const keys = new Map(weapon_keys(this.inventory, this.data.sprites).map(w => [w.sprite_index, w.key]));
		return this.inventory.map(item => ({
			sprite_index: item.sprite_index, count: item.count,
			key: keys.has(item.sprite_index) ? keys.get(item.sprite_index) : null,
			chosen: keys.has(item.sprite_index) &&
				(this.weapon_choice?.nah === item.sprite_index || this.weapon_choice?.fern === item.sprite_index),
		}));
	}

	// ------------------------------------------------------------ Laden
	// A fresh press of the action key at something with a Preis: buy it, or the
	// figure says why not. True if the press went to the shop.
	shop_action(pc, t) {
		// while a sign speaks, F goes on to its next sentence; what the shop says
		// (a Beschreibung, chatting) does not stand in the way of buying
		if (this.speech?.active && !String(this.speech.current?.source ?? '').startsWith('shop')) return false;
		const entry_index = (this.action_key_targets.shop ?? [])[0];
		const entry = entry_index === undefined ? null : this.active_level_sprites[entry_index];
		if (!entry || entry.collected || !pc) return false;
		const sprite = this.data.sprites[entry.sprite_index];
		const price = Math.max(0, Math.round(Number(entry.shop_price) || 0));
		const refusal = shop_refusal({ price, points: this.points, sprite,
			held: inventory_count(this.inventory, entry.sprite_index),
			lives: this.lives, max_lives: this.data.properties.max_lives });
		// a Verkäufer (text.shop_keeper) speaks for the shop, else the figure says it
		const keeper = this.shop_keeper_near(entry);
		if (refusal) {
			this.shop_say(keeper, [refusal], 'shop', t);
			return true;
		}
		this.points -= price;
		pc.collect_pickup({ ...entry, entry_index }, t, entry.shop_again === true);
		// this item's own line, else the Verkäufer's "sagt beim Kaufen" (absent: "Danke!")
		if (keeper !== null) {
			const own = typeof entry.shop_buy_line === 'string' ? entry.shop_buy_line.trim() : '';
			const parts = speech_parts(own || this.active_level_sprites[keeper].shop_thanks || '');
			if (parts.length) this.shop_say(keeper, parts, 'shop', t);
			else this.speech.stop();
		} else if (String(this.speech.current?.source ?? '').startsWith('shop')) this.speech.stop();
		return true;
	}

	// The shop speaks: the Verkäufer (an entry index) in his colour, or the figure.
	// source: 'shop' (buying), 'shop_info' (a Beschreibung), 'shop_greet', 'shop_chat'.
	shop_say(keeper, parts, source, t) {
		const settings = speech_settings(this.data.properties);
		return this.speech.start({ parts, source, speed: settings.speed,
			...(keeper === null ? { speaker: 'player', color: settings.color } :
				{ speaker: keeper, color: speech_color(this.active_level_sprites[keeper].color, SPEECH_SELF_COLOR) }) }, t);
	}

	// The figure stands at something for sale (an entry index) or at nothing
	// (null): when it steps up to a new one, its Beschreibung is said – it
	// interrupts the shop's own talk, never a sign.
	shop_look(entry_index, t) {
		if (entry_index === this.shop_looking) return;
		this.shop_looking = entry_index;
		const entry = entry_index === null ? null : this.active_level_sprites[entry_index];
		const text = typeof entry?.shop_text === 'string' ? entry.shop_text : '';
		const parts = speech_parts(text);
		if (!parts.length || this.replaying_memory) return;
		if (this.speech.active && !String(this.speech.current?.source ?? '').startsWith('shop')) return;
		this.shop_say(this.shop_keeper_near(entry), parts, 'shop_info', t);
	}

	// Verkäufer with "begrüßt": once, when the figure first comes near (in this
	// visit of the level). With "plaudert": while the figure is near and nobody
	// has said anything for SHOP_CHAT_PAUSE seconds, the next sentence.
	update_shop_keepers(t) {
		const pc = this.player_character;
		if (!pc?.mesh || pc.dead?.()) return;
		this.speech.update(t);
		if (this.speech.active) this.shop_quiet_since = t;
		this.shop_quiet_since ??= t;
		for (const keeper of this.shop_keepers) {
			const entry = this.active_level_sprites[keeper.entry_index];
			if (!entry || entry.signal_hidden) continue;
			const near = Math.abs(entry.mesh.position.x - pc.mesh.position.x) <= SHOP_NEAR &&
				Math.abs(entry.mesh.position.y - pc.mesh.position.y) <= SHOP_NEAR;
			if (!near) continue;
			if (!keeper.greeted) {
				keeper.greeted = true;
				const parts = speech_parts(entry.shop_greeting ?? '');
				// the greeting waits for nobody but a sign
				if (parts.length && !(this.speech.active && !String(this.speech.current?.source ?? '').startsWith('shop'))) {
					this.shop_say(keeper.entry_index, parts, 'shop_greet', t);
					this.shop_quiet_since = t;
					continue;
				}
			}
			const chatter = speech_parts(entry.shop_chatter ?? '');
			if (!chatter.length || this.speech.active || t - this.shop_quiet_since < SHOP_CHAT_PAUSE) continue;
			const part = chatter[keeper.chat_index % chatter.length];
			keeper.chat_index += 1;
			this.shop_say(keeper.entry_index, [part], 'shop_chat', t);
			this.shop_quiet_since = t;
		}
	}

	// The Verkäufer nearest to what is for sale (an entry index), or null.
	shop_keeper_near(item) {
		let best = null, best_d = Infinity;
		this.active_level_sprites.forEach((entry, index) => {
			if (entry.shop_keeper !== true || entry.signal_hidden || entry.layer_index === null) return;
			const d = Math.hypot(entry.mesh.position.x - item.mesh.position.x, entry.mesh.position.y - item.mesh.position.y);
			if (d < best_d) { best = index; best_d = d; }
		});
		return best;
	}

	// The prices above what is for sale, in screen pixels like the HUD (k
	// per HUD pixel), drawn after the scene: crisp at every level size.
	draw_price_tags() {
		// where the tags are (draw_speech keeps its bubble out of their way)
		this.price_tag_rects = [];
		if (!this.price_tags?.length || !this.hud || typeof document === 'undefined' || !this.renderer || !this.camera) return;
		const font = SPEECH_FONTS[speech_settings(this.data.properties).font] ?? SPEECH_FONTS[SPEECH_DEFAULT_FONT];
		const k = hud_scale(this.height, this.screen_pixel_height, font.cap);
		if (!this.tag_scene) {
			this.tag_scene = new THREE.Scene();
			this.tag_camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
		}
		const used = new Set();
		for (const entry of this.price_tags) {
			const visible = !entry.collected && entry.mesh.visible && !entry.signal_hidden &&
				this.layers[entry.layer_index]?.visible !== false;
			if (entry.tag_mesh) entry.tag_mesh.visible = visible;
			if (!visible) continue;
			const price = Math.max(0, Math.round(Number(entry.shop_price) || 0));
			const tag = this.hud.price_tag(price, k);
			if (!entry.tag_mesh || entry.tag_key !== tag) {
				const texture = new THREE.CanvasTexture(tag.canvas);
				texture.magFilter = THREE.NearestFilter;
				texture.minFilter = THREE.NearestFilter;
				texture.generateMipmaps = false;
				if (entry.tag_mesh) {
					entry.tag_mesh.material.map?.dispose();
					entry.tag_mesh.material.map = texture;
					entry.tag_mesh.material.needsUpdate = true;
				} else {
					entry.tag_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
						new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
					this.tag_scene.add(entry.tag_mesh);
				}
				entry.tag_key = tag;
			}
			// world → screen pixels (y up): centred above the sprite
			const sprite = this.data.sprites[entry.sprite_index];
			const p = new THREE.Vector3();
			entry.mesh.getWorldPosition(p);
			// (a turned camera: above it on the screen – screen_top_of)
			const [sx, sy] = this.screen_top_of(p.x, p.y, sprite.width, sprite.height);
			const left = Math.round(sx - tag.width / 2), bottom = Math.round(sy + k);
			this.price_tag_rects.push({ left, bottom, right: left + tag.width, top: bottom + tag.height });
			entry.tag_mesh.scale.set(tag.width, tag.height, 1);
			entry.tag_mesh.position.set(left + tag.width / 2, bottom + tag.height / 2, 0);
			used.add(entry.tag_mesh);
		}
		if (!used.size) return;
		this.tag_camera.right = this.width;
		this.tag_camera.top = this.height;
		this.tag_camera.updateProjectionMatrix();
		const auto_clear = this.renderer.autoClear;
		this.renderer.autoClear = false;
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.tag_scene, this.tag_camera);
		this.renderer.autoClear = auto_clear;
	}

	// ------------------------------------------------------------ HUD (hud.js)
	// Made for every level (setup): what the game shows (hud_plan) and its
	// pictures, taken from the sprite sheet at their real size.
	setup_hud() {
		if (typeof HudPainter === 'undefined' || typeof document === 'undefined' || !this.data) { this.hud = null; return; }
		const name = this.data.levels[this.level_index]?.properties?.name ?? '';
		if (this.hud && this.hud_data === this.data) { this.hud.reset(name); this.hud_key = null; return; }
		const make_canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
		const sprite_rgba = (si) => {
			const sprite = this.data.sprites[si];
			const tile = this.spritesheet_info?.tiles?.[si]?.[0]?.[0];
			const image = tile ? this.spritesheets?.[tile[0]]?.uniforms?.texture1?.value?.image : null;
			if (!sprite || !image) return null;
			const canvas = make_canvas(sprite.width, sprite.height);
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingEnabled = false;
			// the sheet holds every picture four times as big (SPRITESHEET_FACTOR)
			ctx.drawImage(image, tile[1], tile[2], sprite.width * 4, sprite.height * 4, 0, 0, sprite.width, sprite.height);
			return { rgba: ctx.getImageData(0, 0, sprite.width, sprite.height).data, width: sprite.width, height: sprite.height };
		};
		const font = speech_settings(this.data.properties).font;
		const text_bitmap = (text, color, k) => render_speech_bitmap([text], font, k, color, make_canvas).canvas;
		this.hud = new HudPainter(hud_plan(this.data), { make_canvas, sprite_rgba, text_bitmap, font: SPEECH_FONTS[font] ?? null });
		this.hud.reset(name);
		// numbers and names in the game's pixel font: drawn again once it is loaded
		const hud = this.hud;
		this.speech_fonts_ready?.().then(() => { hud.texts.clear(); this.hud_key = null; });
		this.hud_data = this.data;
		this.hud_key = null;
	}

	// The HUD in screen pixels over everything (like draw_speech): a canvas as
	// wide as the screen and as tall as the HUD, made a texture only when its
	// picture changed.
	draw_hud() {
		if (!this.hud || this.hud_off || typeof document === 'undefined' || !this.renderer) return;
		const font = SPEECH_FONTS[speech_settings(this.data.properties).font] ?? SPEECH_FONTS[SPEECH_DEFAULT_FONT];
		const k = hud_scale(this.height, this.screen_pixel_height, font.cap);
		const w = Math.max(1, Math.round(this.width)), h = Math.min(Math.max(1, Math.round(this.height)), (this.hud.strip ?? HUD.STRIP) * k);
		if (!this.hud_canvas) {
			this.hud_canvas = document.createElement('canvas');
			this.hud_scene = new THREE.Scene();
			this.hud_camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
			this.hud_texture = new THREE.CanvasTexture(this.hud_canvas);
			this.hud_texture.magFilter = THREE.NearestFilter;
			this.hud_texture.minFilter = THREE.NearestFilter;
			this.hud_texture.generateMipmaps = false;
			this.hud_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
				new THREE.MeshBasicMaterial({ map: this.hud_texture, transparent: true, depthTest: false, depthWrite: false }));
			this.hud_scene.add(this.hud_mesh);
		}
		if (this.hud_canvas.width !== w || this.hud_canvas.height !== h) {
			this.hud_canvas.width = w;
			this.hud_canvas.height = h;
			// a canvas of another size needs a new texture
			this.hud_texture.dispose();
			this.hud_texture = new THREE.CanvasTexture(this.hud_canvas);
			this.hud_texture.magFilter = THREE.NearestFilter;
			this.hud_texture.minFilter = THREE.NearestFilter;
			this.hud_texture.generateMipmaps = false;
			this.hud_mesh.material.map = this.hud_texture;
			this.hud_mesh.material.needsUpdate = true;
			this.hud_key = null;
		}
		const key = this.hud.paint(this.hud_canvas.getContext('2d'), w, h, k, {
			lives: this.lives, lives_at_begin: this.data.properties.lives_at_begin,
			energy: this.energy, max_energy: this.data.properties.max_energy, points: this.points,
			items: this.hud_items(),
		}, this.clock.getElapsedTime());
		if (key !== this.hud_key) {
			this.hud_texture.needsUpdate = true;
			this.hud_key = key;
		}
		// screen pixel on screen pixel, along the top of the screen
		this.hud_camera.right = this.width;
		this.hud_camera.top = this.height;
		this.hud_camera.updateProjectionMatrix();
		this.hud_mesh.scale.set(w, h, 1);
		this.hud_mesh.position.set(w / 2, this.height - h / 2, 0);
		const auto_clear = this.renderer.autoClear;
		this.renderer.autoClear = false;
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.hud_scene, this.hud_camera);
		this.renderer.autoClear = auto_clear;
	}

	setup() {
		this.combat.reset();
		// Keys open doors of the level they were found in only. setup() runs
		// for every level (not when the figure dies and respawns), so keys
		// collected earlier in this level stay collected after dying.
		this.found_keys = {};
        for (const character of [this.player_character, ...(this.baddies ?? [])])
            character?.dispose_hit_flash?.();
		this.running = false;
		this.time_meshes = [];
		// falling or rising weather, upright on a turned screen (turn_upright_effects)
		this.upright_effects = [];
		this.upright_effects_angle = 0;
		this.view = null;
		this.view_angle = 0;
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
		// Begleiter (companion_ai.js): characters that follow the player – never enemies
		this.companions = [];
		this.geometry_and_material_for_frame = [];
		this.animated_sprites = [];
		this.transitioning_sprites = {};
		// the sprite that shows "spricht gerade" (update_speaking_states)
		this.speaking_shown = null;
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
		// Bewegte Plattformen und Aufzüge (platforms.js)
		this.moving_platforms = [];

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
			// Touch: a tap goes on to the next sentence of what somebody says
			// (speech.js) and continues after the curtain, like a key would.
			if (touch && (this.speech?.active || this.curtain?.showing)) {
				this.handle_key_down('Tap');
				return;
			}
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
		// set up for the level in setup_signals(), after the level's sprites
		this.signals = null;
		this.signal_hidden_layers = new Set();

		if (this.data === null)
			return;

		// Lives and energy start anew with a new game (reset), not whenever the
		// first level is set up – a level reached again (a hub) keeps them.
		this.update_stats();

		this.screen_pixel_height = this.data.properties.screen_pixel_height;
		this.screen_safe_zone_x = this.data.properties.safe_zone_x;
		this.screen_safe_zone_y = this.data.properties.safe_zone_y;

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
							if (!('actor' in sprite.traits || 'baddie' in sprite.traits || 'companion' in sprite.traits))
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
						if (!('actor' in sprite.traits || 'baddie' in sprite.traits || 'companion' in sprite.traits)) {
							this.interval_tree_x.insert([x0, x1], this.active_level_sprites.length);
							this.interval_tree_y.insert([y0, y1], this.active_level_sprites.length);
							// place: which placed sprite this is (the level memory)
							active_entry = { layer_index: li, sprite_index: si, mesh: mesh, place: `${li}:${spi}` };
							this.active_level_sprites.push(active_entry);
						}
						for (let trait of Object.keys(sprite.traits)) {
							for (let key of Object.keys(SPRITE_TRAITS[trait].placed_properties ?? {})) {
								let data = SPRITE_TRAITS[trait].placed_properties[key];
								let stored = (placed_properties[trait] ?? {})[key];
								// "kein Signal" (signals.js): an emptied Code stays null, it never becomes the default 0
								let value = (stored === null && key === 'signal_code') ? null : (stored ?? data.default);
								// Old games may store placed checkboxes as 0/1 instead of true/false.
								if (data.type === 'bool') value = Boolean(value);
								// entry_key: a field of its own on the entry (a pickup's Code must not overwrite a key's)
								if (active_entry !== null) active_entry[data.entry_key ?? key] = value;
							}
						}
						// an exit "nur mit Aktionstaste" shows the F hint like a door
						// …and so does something with a Preis (a shop: placed pickup.price)
						if (active_entry !== null && ('door' in sprite.traits || 'text' in sprite.traits || 'switch' in sprite.traits ||
							('level_complete' in sprite.traits && active_entry.exit_action_key === true) ||
							('pickup' in sprite.traits && active_entry.shop_price > 0))) {
							active_entry.door_state = 'idle';
							let overlay_mesh = this.overlay_mesh_catalogue['f_key'].clone();
							overlay_mesh.geometry = overlay_mesh.geometry.clone();
							// z 0: in the plane of the sprites, so the figure is never hidden
							// behind it by depth (where it is drawn decides: place_overlay_meshes)
							overlay_mesh.position.set(placed[1], placed[2] + sprite.height / 2, 0);
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
						this.player_character.layer_index = li;
						this.camera_x = placed[1];
						this.camera_y = placed[2] + this.data.properties.screen_pixel_height * 0.3;
					}
					else if ('baddie' in sprite.traits) {
						const baddie = new Character(this, si, mesh);
						baddie.layer_index = li;
						baddie.place = `${li}:${spi}`;
						// Signale: "sendet, wenn besiegt" and its Code (absent = sends nothing),
						// and the Code of a key it leaves behind (drop_code)
						baddie.placed_signal = placed[3]?.baddie ?? null;
						this.baddies.push(baddie);
					}
					else if ('companion' in sprite.traits) {
						const companion = new Character(this, si, mesh);
						companion.layer_index = li;
						// "kommt erst bei Signal mit" (absent = follows from the start, as always)
						companion.placed_signal = placed[3]?.companion ?? null;
						companion.companion_waiting = companion.placed_signal?.waits_for_signal === true;
						if (companion.character_trait === 'companion') {
							// its place in the line behind the player (flyers and walkers apart)
							companion.companion_slot = this.companions.filter(o => o.companion.fly === companion.companion.fly).length;
							this.companions.push(companion);
						}
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
					// falling or rising weather stays upright on a turned screen (turn_upright_effects)
					if (backdrop.backdrop_type === 'effect' && UPRIGHT_EFFECTS.includes(backdrop.effect)) {
						const uv = geometry.attributes.uv;
						this.upright_effects.push({ mesh,
							corners: [0, 1, 2, 3].map(i => [uv.getX(i), uv.getY(i)]),
							points: Object.entries(material.uniforms ?? {}).filter(([name]) => /^cp[a-z]$/.test(name))
								.map(([name, u]) => [name, [u.value[0], u.value[1]]]) });
					}
					game_layer.add(mesh);
				}
			}
			this.layers.push(game_layer);
		}
		// a level entered again during this run: as it was left (collected things
		// stay collected, defeated enemies stay defeated, Schalter keep their state)
		this.restore_level_memory(level);
		// the F hints: in front of the sprites of their layer, behind the figure
		this.place_overlay_meshes();
		// through an exit with a chosen target: start at the exit that leads back
		this.place_player_on_arrival();
		// no exit works before the figure has stepped off them (exit_armed), and an
		// exit "nur mit Aktionstaste" waits until the key is let go (exit_key_ready)
		this.exit_armed = false;
		this.exit_key_ready = !this.action_key_held();
		// the weapons the figure holds (inventory.js; nothing to do without any)
		this.apply_weapons();
		// touch buttons for this level's figure (melee / ranged only if it has them)
		this.update_touch_buttons();
		// the HUD: what this game shows, and the level's name for a moment
		this.setup_hud();
		// prices in a shop, drawn above what is for sale (draw_price_tags); the
		// tags of the level before go
		for (const mesh of [...(this.tag_scene?.children ?? [])]) {
			mesh.material.map?.dispose();
			mesh.material.dispose();
			mesh.geometry.dispose();
			this.tag_scene.remove(mesh);
		}
		this.price_tags = this.active_level_sprites.filter(entry => entry.layer_index !== null && entry.shop_price > 0);
		// Verkäufer who greet or chat (update_shop_keepers); what the figure looks at
		this.shop_keepers = this.active_level_sprites.map((entry, entry_index) => ({ entry, entry_index }))
			.filter(({ entry }) => entry.shop_keeper === true && entry.layer_index !== null &&
				(speech_parts(entry.shop_greeting ?? '').length || speech_parts(entry.shop_chatter ?? '').length))
			.map(({ entry_index }) => ({ entry_index, greeted: false, chat_index: 0 }));
		this.shop_looking = null;
		this.shop_quiet_since = null;
		// Bewegungsbereiche: swimming, floating, other gravity, currents (player and walking enemies)
		this.movement_regions = typeof MovementRegions !== 'undefined' ? MovementRegions.resolve(level) : null;
		// Bewegte Plattformen und Aufzüge (platforms.js; old games have none)
		this.moving_platforms = typeof MovingPlatforms !== 'undefined' ? MovingPlatforms.setup(this) : [];
		// Signale (signals.js): who listens to which Code in this level
		this.setup_signals(level);
		// nothing is being said when a level starts; its font is loaded now
		this.speech?.stop();
		this.speech_fonts_ready?.();
		this.update_layer_visibility();
		// console.log(this.minx, this.maxx, this.miny, this.maxy);

		for (let i = this.layers.length - 1; i >= 0; i--)
			this.scene.add(this.layers[i]);

		if (this.data.properties.crt_effect) {
			// stencil: overlapping backdrop rectangles are drawn once (union_of_rects)
			this.render_target = new THREE.WebGLRenderTarget(this.width, this.height, { magFilter: THREE.NearestFilter, stencilBuffer: true });
			this.screen_scene = new THREE.Scene();
			let geometry = new THREE.PlaneGeometry(this.width, this.height);
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
			this.curtain.show_screen('level_start', { level_name: level.properties.name }, 0.0, 0.0, function () {
				self.frame = 0;
				self.clock.start();
				self.run();
			});
		} else {
			this.curtain.show_screen('the_end', this.end_screen_info(), 0.0, 0.0, function () {
				self.stop();
			});
		}
		$('#overlay').fadeOut();
	}

	run() {
		// this.setup();
		// this.prepare_run();
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
		// one frame loop only: a frame of an earlier run still queued goes
		cancelAnimationFrame(this.render_frame);
		this.render_frame = requestAnimationFrame((t) => this.render());
	}

	stop() {
		// The frame queued last would still be drawn – and a browser holds it
		// back while the game frame is hidden (the studio's Level pane), then
		// draws it when the frame is shown again: after the next load() had
		// reset the level, with the old run's layers (70dad2, October 2026).
		// Also when the run had ended already (restart_playtest).
		cancelAnimationFrame(this.render_frame);
		this.render_frame = null;
		if (!this.running) return;
		this.running = false;
		this.curtain.hide();
		$('#overlay').fadeIn();
		$('#screen').fadeOut();
		window.yt_pending = null;
		if (window.yt_player !== null) {
			try {
				window.yt_player.pauseVideo();
			} catch { }
		}
	}

	// Layers that appear or disappear by a signal fade in and out.
	update_layer_visibility() {
		const time = this.clock.getElapsedTime();
		for (const [li, fade] of this.signal_layer_fades ?? []) {
			const group = this.layers[li];
			if (!group) continue;
			fade.alpha = signal_fade_alpha(fade, time);
			LayerFade.set(fade.materials, fade.alpha);
			group.visible = fade.alpha > 0;
		}
	}

	// ------------------------------------------------------------ Signale
	// Senders: keys (when collected), Schalter, Druckplatten, Bereiche,
	// defeated enemies and "alle Gegner besiegt". Receivers: doors
	// (door_reaction), layers (signal_code / signal_reaction), signs that
	// speak (speaks_on_signal) and the level (signal_level_complete). See
	// signals.js. Every level starts with a new bus; objects keep their state
	// when the figure dies.
	setup_signals(level) {
		this.signals = new SignalBus();
		this.signal_hidden_layers = new Set();
		this.signal_layer_fades = new Map();
		// doors that close again by themselves ("schließt wieder nach"), and
		// doors waiting for their doorway to be free before they close
		this.auto_closing_doors = [];
		this.doors_waiting_to_close = new Set();
		this.active_level_sprites.forEach((entry, entry_index) => {
			const traits = this.data.sprites[entry.sprite_index].traits;
			if ('door' in traits) {
				this.signals.connect(entry.signal_code, (value, t) => this.door_signal(entry_index, value, t));
				entry.close_at = null;
				if (signal_delay_seconds(entry.close_after) > 0) this.auto_closing_doors.push(entry_index);
			}
			if ('switch' in traits)
				this.show_trait_state(entry, 'switch', entry.switch_on ? 'on' : 'off');
			if ('pressure_plate' in traits) {
				entry.plate_down = false;
				this.show_trait_state(entry, 'pressure_plate', 'up');
			}
			// a sign that speaks on "an" (absent = only with the action key, as always)
			if ('text' in traits && entry.speaks_on_signal === true)
				this.signals.connect(stored_signal_code(entry.signal_code), (value) => { if (value) this.signal_speech(entry_index); });
			// a Zähler: counts its Code, sends its own at its Anzahl (signals.js)
			if ('counter' in traits) {
				entry.counter_value = 0;
				entry.counter_full = false;
				this.show_counter_state(entry);
				this.signals.connect(stored_signal_code(entry.counter_in), (value, t) => this.counter_signal(entry_index, value, t));
			}
			// a platform "bei Signal": "an" to the end of its Weg, "aus" back (platforms.js)
			if (entry.platform?.settings.start === 'signal')
				this.signals.connect(stored_signal_code(entry.platform_code), (value) => MovingPlatforms.signal(entry.platform, value));
			// an exit "öffnet erst bei Signal": closed until its Code comes "an", then
			// open for good (absent = open from the start, as always). It shows
			// "Ausgang zu" / "Ausgang offen" if drawn.
			if ('level_complete' in traits) {
				entry.exit_open = entry.exit_gate_on !== true;
				this.show_trait_state(entry, 'level_complete', entry.exit_open ? 'open' : 'closed');
				if (!entry.exit_open)
					this.signals.connect(stored_signal_code(entry.exit_gate_code), (value) => {
						if (!value || entry.exit_open) return;
						entry.exit_open = true;
						this.show_trait_state(entry, 'level_complete', 'open');
					});
			}
		});
		// the exit the figure stands at, for "sendet, wenn die Figur davorsteht"
		this.exit_touching = null;
		// "geschafft bei Signal" (level setting; absent = only the exit completes the level)
		const complete = level.properties?.signal_level_complete;
		if (Number.isInteger(complete))
			this.signals.connect(complete, (value) => { if (value) this.complete_level(1, level.properties?.signal_level_complete_target); });
		for (let li = 0; li < level.layers.length; li++) {
			const layer = level.layers[li];
			if (!layer_reacts_to_signals(layer.properties)) continue;
			// The figure is drawn in its layer: that layer must not take it away.
			if (this.player_character?.layer_index === li) continue;
			const reaction = layer.properties.signal_reaction;
			this.signal_layer_fades.set(li, { alpha: 1, from: 1, to: 1, started_at: 0,
				seconds: layer_fade_seconds(layer.properties),
				materials: LayerFade.materials(this.layers[li], 'signalOpacity') });
			// enemies on it switch their material every frame (material_for_frame)
			for (const baddie of [...this.baddies, ...(this.companions ?? [])]) if (baddie.layer_index === li) baddie.mesh.userData.signal_layer = li;
			let visible = layer_visible_at_start(reaction);
			this.set_layer_signal_visible(li, visible, true);
			this.signals.connect(stored_signal_code(layer.properties.signal_code), (value) => {
				visible = layer_visible_after(reaction, value, visible);
				this.set_layer_signal_visible(li, visible, this.signals.immediate === true);
			});
		}
		// a Begleiter that waits for its signal: "an" and it comes along, for good
		for (const companion of this.companions ?? []) {
			if (!companion.companion_waiting) continue;
			this.signals.connect(stored_signal_code(companion.placed_signal?.signal_code), (value) => {
				if (value) companion.companion_waiting = false;
			});
		}
		// Bereiche: rectangles that send when the figure's centre enters or leaves them
		this.signal_areas = [];
		level.layers.forEach((layer, li) => {
			if (layer?.type !== 'signal_area' || !(layer.rects ?? []).some(valid_signal_rect)) return;
			this.signal_areas.push({ li, code: stored_signal_code(layer.properties?.signal_code), rects: layer.rects, inside: false,
				delay: layer.properties?.signal_delay });
		});
		// "alle Gegner besiegt" (level setting; absent = nothing is sent)
		const all = level.properties?.signal_all_defeated;
		this.signal_all_defeated = Number.isInteger(all) ? all : null;
		this.signal_all_defeated_delay = level.properties?.signal_all_defeated_delay;
		// "sendet beim Start" (level setting; absent = nothing): once per level start (also R),
		// not after a lost life. Without a Verzögerung it is decided at once with the Bereiche, so the
		// level looks right from its first frame; with one it is a timer on the level's clock
		// (setup starts the simulation at 0), which goes on when the figure dies.
		const start = level.properties?.signal_level_start;
		const start_delay = signal_delay_seconds(level.properties?.signal_level_start_delay);
		// A figure that starts inside a Bereich: the level looks right at once.
		this.signals.immediate = true;
		this.update_signal_areas(0);
		if (Number.isInteger(start) && start_delay === 0) this.signals.send(start, true, 0);
		// "sendet, wenn die Spielfigur … hat": what it brought along counts from the start
		this.item_signals = (typeof level_item_signals === 'function' ? level_item_signals(level) : [])
			.filter(item => Number.isInteger(item.sprite_index) && item.signal_code !== null);
		for (const item of this.item_signals)
			if (inventory_count(this.inventory, item.sprite_index) > 0) this.signals.send(item.signal_code, true, 0);
		this.signals.immediate = false;
		if (Number.isInteger(start) && start_delay > 0) this.signals.send(start, true, 0, { delay: start_delay, from: 'level_start' });
		// entered again: what the remembered senders sent arrives once more, at once
		this.replay_level_memory();
	}

	// ------------------------------------------------------- level memory
	// During one run (until a new game, game over or a new test run) every level
	// remembers what happened in it: collected sprites and keys, defeated
	// enemies (and the loot they left lying there), Schalter, and the signals
	// those sent. Entered again, the level looks as it was left: the signals are
	// sent again at once (doors, layers, Zähler and companions follow), without
	// completing the level or making signs speak. Falling blocks, Druckplatten,
	// Signalbereiche, timers and checkpoints start afresh – a crumbled bridge
	// is back, so no level can become impossible.
	level_memory_record(level) {
		if (!level?.id) return null;
		this.level_memory ??= {};
		return this.level_memory[level.id] ??= { gone: [], defeated: [], switches: {}, drops: {}, sends: [] };
	}

	remember_send(code, value) {
		if (this.replaying_memory || !this.memory_now || signal_key(code) === null) return;
		if (this.memory_now.sends.length < LEVEL_MEMORY_MAX_SENDS) this.memory_now.sends.push([code, Boolean(value)]);
	}

	// a collected sprite or key (a placed one, or loot an enemy left behind)
	remember_collected(entry) {
		const memory = this.memory_now;
		entry.collected = true;
		if (!memory || this.replaying_memory) return;
		if (entry.place) memory.gone.push(entry.place);
		if (entry.drop_of) delete memory.drops[entry.drop_of];
	}

	remember_defeated(baddie, drop_entry) {
		const memory = this.memory_now;
		if (!memory || !baddie.place) return;
		memory.defeated.push(baddie.place);
		// loot still lying there comes back with the level
		if (drop_entry && !drop_entry.collected) {
			drop_entry.drop_of = baddie.place;
			memory.drops[baddie.place] = { x: drop_entry.mesh.position.x, y: drop_entry.mesh.position.y,
				drop: baddie.traits.drop, placed_signal: baddie.placed_signal, layer_index: baddie.layer_index,
				blend: baddie.mesh.userData?.blend ?? null };
		}
	}

	restore_level_memory(level) {
		const memory = this.level_memory_record(level);
		this.memory_now = memory;
		this.memory_to_replay = null;
		if (!memory || !(memory.gone.length || memory.defeated.length || Object.keys(memory.switches).length ||
			Object.keys(memory.drops).length || memory.sends.length)) return;
		const gone = new Set(memory.gone);
		this.active_level_sprites.forEach((entry) => {
			if (entry.place && gone.has(entry.place)) {
				const sprite = this.data.sprites[entry.sprite_index];
				const x = entry.mesh.position.x, y = entry.mesh.position.y;
				this.interval_tree_x.remove([x - sprite.width / 2, x + sprite.width / 2], this.active_level_sprites.indexOf(entry));
				this.interval_tree_y.remove([y, y + sprite.height], this.active_level_sprites.indexOf(entry));
				entry.mesh.visible = false;
				entry.collected = true;
				// a key that was found still opens its doors
				if ('key' in sprite.traits && entry.signal_code !== null) this.found_keys[entry.signal_code] = true;
			}
			if (entry.place && entry.place in memory.switches) entry.switch_on = memory.switches[entry.place];
		});
		const defeated = new Set(memory.defeated);
		this.baddies = this.baddies.filter(baddie => {
			if (!defeated.has(baddie.place)) return true;
			baddie.active = false;
			baddie.defeated = true;
			baddie.mesh.parent?.remove(baddie.mesh);
			return false;
		});
		for (const [place, drop] of Object.entries(memory.drops)) {
			const owner = { traits: { drop: drop.drop }, placed_signal: drop.placed_signal,
				mesh: { position: { x: drop.x, y: drop.y }, userData: { blend: drop.blend }, parent: this.layers[drop.layer_index] ?? null } };
			const entry = this.spawn_drop(owner);
			if (entry) entry.drop_of = place;
		}
		this.memory_to_replay = memory.sends.slice();
	}

	replay_level_memory() {
		const sends = this.memory_to_replay;
		this.memory_to_replay = null;
		if (!sends?.length || !this.signals) return;
		const waiting = (this.companions ?? []).filter(companion => companion.companion_waiting);
		this.replaying_memory = true;
		this.signals.immediate = true;
		try {
			for (const [code, value] of sends) this.signals.send(code, value, 0);
		} finally {
			this.signals.immediate = false;
			this.replaying_memory = false;
		}
		// a companion that was already found comes along again
		const pc = this.player_character;
		for (const companion of waiting)
			if (!companion.companion_waiting && pc) companion.return_to_player(pc, 0, true);
	}

	update_signal_areas(t) {
		const pc = this.player_character;
		if (!pc?.mesh || !this.signal_areas?.length) return;
		const x = pc.mesh.position.x;
		const y = pc.mesh.position.y + pc.sprite.height / 2;
		for (const area of this.signal_areas) {
			const inside = point_in_signal_rects(area.rects, x, y);
			if (inside === area.inside) continue;
			area.inside = inside;
			// deciding at once (start, respawn) also takes back what is still on its way
			this.signals?.send(area.code, inside, t, { delay: area.delay, from: area });
		}
	}

	// A defeated enemy sends its Code ("sendet, wenn besiegt"); once no enemy
	// is left in the level (enemies on a layer that is away do not count yet),
	// the level sends "alle Gegner besiegt" (enemies that are "unverwundbar"
	// do not count). Either may send later (Verzögerung).
	baddie_defeated(baddie, t) {
		if (baddie.placed_signal?.signal_on_defeat === true) {
			this.signals?.send(stored_signal_code(baddie.placed_signal.signal_code), true, t, { delay: baddie.placed_signal.signal_delay });
			this.remember_send(stored_signal_code(baddie.placed_signal.signal_code), true);
		}
		if (this.signal_all_defeated === null || this.signal_all_defeated === undefined) return;
		// an enemy that cannot be defeated ("unverwundbar") does not count either
		if (this.baddies.some(other => other.active && !other.signal_hidden && other.traits?.invincible !== true)) return;
		this.signals?.send(this.signal_all_defeated, true, t, { delay: this.signal_all_defeated_delay });
		this.remember_send(this.signal_all_defeated, true);
	}

	// A layer that is away is not drawn, its sprites do not collide
	// (collision_candidates skips them) and its enemies wait (not moving, not
	// hurting, not to be hit) until it appears.
	set_layer_signal_visible(li, visible, immediate = false) {
		if (visible) this.signal_hidden_layers.delete(li);
		else this.signal_hidden_layers.add(li);
		for (const entry of this.active_level_sprites)
			if (entry.layer_index === li) entry.signal_hidden = !visible;
		for (const baddie of [...(this.baddies ?? []), ...(this.companions ?? [])])
			if (baddie.layer_index === li) baddie.signal_hidden = !visible;
		this.dynamic_interval_frame = -1;
		const fade = this.signal_layer_fades?.get(li);
		if (fade) {
			const time = this.clock.getElapsedTime();
			const now = immediate || !(fade.seconds > 0);
			fade.from = now ? (visible ? 1 : 0) : signal_fade_alpha(fade, time);
			fade.to = visible ? 1 : 0;
			fade.started_at = time;
		}
		// shown again: the fade decides in the same frame (render)
		if (visible && this.layers[li]) this.layers[li].visible = true;
		if (!visible && immediate && this.layers[li]) this.layers[li].visible = false;
	}

	show_trait_state(entry, trait, name) {
		const sprite = this.data.sprites[entry.sprite_index];
		const state_index = sprite.states.findIndex((state) => name in (state.traits?.[trait] ?? {}));
		const mesh_state = this.state_for_mesh[entry.mesh.uuid];
		if (state_index === -1 || !mesh_state) return;
		mesh_state.state_index = state_index;
		mesh_state.frame_index = 0;
	}

	// ------------------------------------------------------------ Sprechtexte
	// speech.js: a sign is read out by the figure (or speaks itself), one line
	// after the other, above the speaker's head.

	// The action key: while somebody speaks, the next sentence; else the sign
	// the figure stands at starts speaking.
	speech_action(t) {
		if (this.speech.active) {
			this.speech.skip(t);
			return;
		}
		const entry_index = (this.action_key_targets.text ?? [])[0];
		if (entry_index !== undefined) this.start_speech(entry_index, t);
	}

	// A sign that speaks on a Signal: it starts at once, on the game clock
	// (signals may arrive with time 0 when the level decides at once); a sign
	// that is already speaking goes on.
	signal_speech(entry_index) {
		if (this.replaying_memory) return false;
		if (this.speech.active && this.speech.current?.source === entry_index) return false;
		return this.start_speech(entry_index, this.clock.getElapsedTime());
	}

	start_speech(entry_index, t) {
		const entry = this.active_level_sprites[entry_index];
		if (!entry) return false;
		const settings = speech_settings(this.data.properties);
		const itself = entry.speaker === 'self';
		return this.speech.start({
			parts: speech_parts(entry.text),
			speaker: itself ? entry_index : 'player',
			color: itself ? speech_color(entry.color, SPEECH_SELF_COLOR) : settings.color,
			source: entry_index,
			speed: settings.speed,
		}, t);
	}

	// A sprite that speaks itself (speaker "self") shows its state "spricht gerade"
	// while its sentences are on screen, and its first state again afterwards –
	// a figure at the roadside moves its mouth. Without such a state nothing changes.
	update_speaking_states() {
		const current = this.speech?.active ? this.speech.current : null;
		const talking = current && current.speaker !== 'player' ? current.speaker : null;
		const shown = this.speaking_shown ?? null;
		if (shown && shown.entry_index === talking) return;
		if (shown) {
			// back to the state it had before
			const entry = this.active_level_sprites[shown.entry_index];
			const mesh_state = entry?.mesh ? this.state_for_mesh[entry.mesh.uuid] : null;
			if (mesh_state) mesh_state.state_index = shown.before;
			this.speaking_shown = null;
		}
		if (talking === null) return;
		const entry = this.active_level_sprites[talking];
		const sprite = entry ? this.data.sprites[entry.sprite_index] : null;
		const mesh_state = entry?.mesh ? this.state_for_mesh[entry.mesh.uuid] : null;
		const state_index = sprite?.states.findIndex((state) => 'speaking' in (state.traits?.text ?? {})) ?? -1;
		if (state_index === -1 || !mesh_state) return;
		this.speaking_shown = { entry_index: talking, before: mesh_state.state_index };
		mesh_state.state_index = state_index;
	}

	// The game's font, loaded before it is needed (a promise; recipes wait for it).
	speech_fonts_ready() {
		if (typeof document === 'undefined' || !document.fonts?.load) return Promise.resolve();
		const font = SPEECH_FONTS[speech_settings(this.data?.properties).font];
		return document.fonts.load(`${font.em * 4}px "${font.family}"`).catch(() => null);
	}

	// The point above the speaker's head, in screen pixels from the bottom
	// left: [x, y]. The figure's head is where its own up is (turned gravity);
	// a sign's top is the top on the screen (screen_top_of).
	speech_anchor() {
		const speaker = this.speech.current?.speaker;
		if (speaker === 'player') {
			const pc = this.player_character;
			if (!pc?.mesh) return null;
			// the camera stays while the figure is turned: above it on the screen
			const t = this.clock.getElapsedTime();
			if (pc.camera_angle && Math.abs(Math.sin((pc.visual_angle(t) - pc.camera_angle(t)) / 2)) > 1e-6) {
				const [x0, x1, y0, y1] = pc.world_box(-pc.sprite.width / 2, pc.sprite.width / 2, 0, pc.sprite.height);
				return this.screen_top_of((x0 + x1) / 2, y0, x1 - x0, y1 - y0);
			}
			return this.world_to_screen(...(pc.head_world?.() ?? [pc.mesh.position.x, pc.mesh.position.y + pc.sprite.height]));
		}
		const entry = this.active_level_sprites[speaker];
		if (!entry?.mesh) return null;
		const sprite = this.data.sprites[entry.sprite_index];
		return this.screen_top_of(entry.mesh.position.x, entry.mesh.position.y, sprite.width, sprite.height);
	}

	// The last render pass: the sentence being said, in screen pixels, on top
	// of everything (also of the CRT effect), so it is crisp and readable.
	draw_speech() {
		if (!this.speech?.active || typeof document === 'undefined') return;
		this.speech.update(this.clock.getElapsedTime());
		const anchor = this.speech.active ? this.speech_anchor() : null;
		if (!anchor) return;
		const settings = speech_settings(this.data.properties);
		const k = speech_scale(this.height, settings.font, settings.size);
		const font = SPEECH_FONTS[settings.font];
		const key = [this.speech.text, settings.font, k, this.speech.current.color, this.width].join('|');
		if (key !== this.speech_key) {
			// not loaded yet: draw with what there is, again once it is there
			if (document.fonts && !document.fonts.check(`${font.em * k}px "${font.family}"`)) {
				this.speech_fonts_ready().then(() => { this.speech_key = null; });
			}
			const make_canvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
			const probe = make_canvas(1, 1).getContext('2d');
			probe.font = `${font.em * k}px "${font.family}"`;
			const lines = wrap_speech(this.speech.text, Math.max(font.em * k * 4, this.width * 0.6), s => probe.measureText(s).width);
			const bitmap = render_speech_bitmap(lines, settings.font, k, this.speech.current.color, make_canvas);
			if (!this.speech_scene) {
				this.speech_scene = new THREE.Scene();
				this.speech_camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
				this.speech_mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
					new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
				this.speech_scene.add(this.speech_mesh);
			}
			const texture = new THREE.CanvasTexture(bitmap.canvas);
			texture.magFilter = THREE.NearestFilter;
			texture.minFilter = THREE.NearestFilter;
			texture.generateMipmaps = false;
			this.speech_mesh.material.map?.dispose();
			this.speech_mesh.material.map = texture;
			this.speech_mesh.material.needsUpdate = true;
			this.speech_size = [bitmap.width, bitmap.height];
			this.speech_key = key;
		}
		// world → screen pixels (y up), above the head, kept on the screen
		const [w, h] = this.speech_size;
		const [sx, sy] = anchor;
		const margin = 2 * k;
		let left = Math.round(sx - w / 2);
		left = Math.max(margin, Math.min(this.width - w - margin, left));
		let bottom = Math.round(sy + k);
		// a price in the way (a Verkäufer next to what he sells): the bubble goes above it
		for (let moved = true; moved;) {
			moved = false;
			for (const r of this.price_tag_rects ?? []) {
				if (left < r.right && left + w > r.left && bottom < r.top && bottom + h > r.bottom) {
					bottom = r.top + k;
					moved = true;
				}
			}
		}
		bottom = Math.max(margin, Math.min(this.height - h - margin, bottom));
		this.speech_camera.right = this.width;
		this.speech_camera.top = this.height;
		this.speech_camera.updateProjectionMatrix();
		this.speech_mesh.scale.set(w, h, 1);
		this.speech_mesh.position.set(left + w / 2, bottom + h / 2, 0);
		const auto_clear = this.renderer.autoClear;
		this.renderer.autoClear = false;
		this.renderer.setRenderTarget(null);
		this.renderer.render(this.speech_scene, this.speech_camera);
		this.renderer.autoClear = auto_clear;
	}

	// Zähler: "an" +1, "aus" −1; at its Anzahl it sends its own Code "an",
	// below it "aus" (only when that changes). A sender to itself is no loop:
	// the bus stops deep chains (SIGNAL_MAX_DEPTH).
	counter_signal(entry_index, value, t) {
		const entry = this.active_level_sprites[entry_index];
		const step = counter_step(entry.counter_value, value, counter_count({ count: entry.counter_count }));
		entry.counter_value = step.count;
		const changed = step.full !== entry.counter_full;
		entry.counter_full = step.full;
		this.show_counter_state(entry);
		if (!changed) return;
		this.signals?.send(stored_signal_code(entry.counter_out), step.full, t, { delay: entry.counter_delay, from: entry });
	}

	// The exit the figure stands at changed (entry or null): an exit with
	// "sendet, wenn die Figur davorsteht" sends "an" when the figure gets there
	// and "aus" when it leaves (placed exit_send_on / exit_send_code).
	// (has_trait_at returns a copy of the entry: compared by its index)
	exit_reached(entry, t) {
		const previous = this.exit_touching;
		const now = entry ? entry.entry_index : null;
		if (previous === now) return;
		this.exit_touching = now;
		for (const [index, value] of [[previous, false], [now, true]]) {
			const exit = index === null ? null : this.active_level_sprites[index];
			if (!exit || exit.exit_send_on !== true) continue;
			this.signals?.send(stored_signal_code(exit.exit_send_code), value, t, { from: exit });
		}
	}

	// "Zähler erreicht" when full, else "Zähler zeigt n" if that is drawn, else "Zähler wartet".
	show_counter_state(entry) {
		const sprite = this.data.sprites[entry.sprite_index];
		const has = (name) => sprite.states.some(state => name in (state.traits?.counter ?? {}));
		const name = entry.counter_full && has('done') ? 'done' :
			(entry.counter_value > 0 && has(`count_${entry.counter_value}`) ? `count_${entry.counter_value}` : 'waiting');
		this.show_trait_state(entry, 'counter', name);
	}

	flip_switch(entry_index, t) {
		const entry = this.active_level_sprites[entry_index];
		entry.switch_on = !entry.switch_on;
		this.show_trait_state(entry, 'switch', entry.switch_on ? 'on' : 'off');
		this.signals?.send(entry.signal_code, entry.switch_on, t, { delay: entry.signal_delay });
		if (this.memory_now && entry.place) this.memory_now.switches[entry.place] = entry.switch_on;
		this.remember_send(entry.signal_code, entry.switch_on);
	}

	// A Druckplatte is down while the middle of the figure is above it (not
	// already when the figure's edge touches the plate's tile).
	update_pressure_plates(character, t) {
		// (in the figure's own directions – a turned gravity: Character.world_box)
		const box = character.world_box ? character.world_box(-1.0, 1.0, -1.0, character.traits.ex_top * character.sprite.height - 0.1) :
			[character.mesh.position.x - 1.0, character.mesh.position.x + 1.0, character.mesh.position.y - 1.0,
				character.mesh.position.y + character.traits.ex_top * character.sprite.height - 0.1];
		const pressed = new Set(this.collision_candidates(...box));
		this.active_level_sprites.forEach((entry, entry_index) => {
			if (!('pressure_plate' in this.data.sprites[entry.sprite_index].traits)) return;
			const down = pressed.has(entry_index) && !character.dead();
			if (down === entry.plate_down) return;
			entry.plate_down = down;
			this.show_trait_state(entry, 'pressure_plate', down ? 'down' : 'up');
			this.signals?.send(entry.signal_code, down, t, { delay: entry.signal_delay });
		});
	}

	door_signal(entry_index, value, t) {
		const entry = this.active_level_sprites[entry_index];
		// "wechseln" goes by where the door is heading, not where it is right now
		const closed = entry.door_signal_pending ? entry.door_signal_pending === 'close' :
			entry.door_state === 'opening' ? false : entry.door_state === 'closing' ? true : entry.door_closed;
		const action = door_signal_action(entry.door_reaction, value, closed);
		if (action === 'unlock') this.found_keys[entry.signal_code] = true;
		else if (action) this.move_door_by_signal(entry_index, action, t);
	}

	// A door that is still moving does the last signal when it is done, so a
	// quick step on and off a Druckplatte cannot leave it open. A door that
	// is to close while somebody stands in it waits until the doorway is free
	// (update_waiting_doors), like "schließt wieder nach" does; a newer signal
	// to open takes the waiting back.
	move_door_by_signal(entry_index, action, t) {
		const entry = this.active_level_sprites[entry_index];
		if ((entry.door_state ?? 'idle') !== 'idle') {
			entry.door_signal_pending = action;
			return;
		}
		if (action === 'close' && entry.door_closed === false && this.door_occupied(entry_index)) {
			entry.door_signal_pending = 'close';
			this.doors_waiting_to_close.add(entry_index);
			return;
		}
		this.doors_waiting_to_close?.delete(entry_index);
		entry.door_signal_pending = null;
		if (action === 'open') this.open_door_intent(entry_index, t, { force: true });
		else this.close_door_intent(entry_index, t, { force: true });
	}

	// "schließt wieder nach" (placed door.close_after): an open door closes
	// by itself, also one that cannot be closed otherwise (signals.js
	// door_auto_close_step). It waits while the figure or an enemy is in it.
	update_auto_closing_doors(t) {
		for (const entry_index of this.auto_closing_doors ?? []) {
			const entry = this.active_level_sprites[entry_index];
			const still = (entry.door_state ?? 'idle') === 'idle' && entry.door_closed === false && !entry.signal_hidden;
			const step = door_auto_close_step(entry.close_after, entry.close_at, still,
				() => this.door_occupied(entry_index), t);
			entry.close_at = step.close_at;
			if (step.close) this.move_door_by_signal(entry_index, 'close', t);
		}
	}

	// Doors that were told to close while somebody stood in them: they close
	// as soon as the doorway is free (move_door_by_signal).
	update_waiting_doors(t) {
		for (const entry_index of [...(this.doors_waiting_to_close ?? [])]) {
			const entry = this.active_level_sprites[entry_index];
			if (entry?.door_signal_pending !== 'close') { this.doors_waiting_to_close.delete(entry_index); continue; }
			if ((entry.door_state ?? 'idle') === 'idle' && !this.door_occupied(entry_index))
				this.move_door_by_signal(entry_index, 'close', t);
		}
	}

	// Somebody in the door's rectangle: the figure, or an enemy that is there.
	door_occupied(entry_index) {
		const entry = this.active_level_sprites[entry_index];
		const sprite = this.data.sprites[entry.sprite_index];
		const x0 = entry.mesh.position.x - sprite.width / 2, x1 = entry.mesh.position.x + sprite.width / 2;
		const y0 = entry.mesh.position.y, y1 = entry.mesh.position.y + sprite.height;
		const inside = (character) => {
			if (!character?.mesh) return false;
			const w = character.sprite.width / 2, ex = character.traits ?? {};
			// its body in the world (turned gravity: Character.world_box)
			const [bx0, bx1, by0, by1] = character.world_box ?
				character.world_box(-w * (ex.ex_left ?? 1), w * (ex.ex_right ?? 1), 0, character.sprite.height * (ex.ex_top ?? 1)) :
				[character.mesh.position.x - w * (ex.ex_left ?? 1), character.mesh.position.x + w * (ex.ex_right ?? 1),
					character.mesh.position.y, character.mesh.position.y + character.sprite.height * (ex.ex_top ?? 1)];
			return bx1 > x0 && bx0 < x1 && by1 > y0 && by0 < y1;
		};
		if (inside(this.player_character)) return true;
		return (this.baddies ?? []).some(baddie => baddie.active && !baddie.signal_hidden && inside(baddie));
	}

	// ------------------------------------------------ the camera, turned or not
	// Half the width and height of the world rectangle around a screen-sized
	// box (half_w × half_h) turned by an angle (the camera's: view_angle) –
	// exactly half_w × half_h while it is not turned.
	view_extents(half_w, half_h, angle = this.view_angle ?? 0) {
		if (!angle) return [half_w, half_h];
		const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
		return [c * half_w + s * half_h, s * half_w + c * half_h];
	}

	// The world rectangle the screen shows (around it, when the camera is turned).
	view_box() {
		const v = this.view, c = this.camera;
		if (!v) return { left: c.left, right: c.right, top: c.top, bottom: c.bottom };
		const [ex, ey] = this.view_extents(v.half_w, v.half_h);
		return { left: v.cx - ex, right: v.cx + ex, bottom: v.cy - ey, top: v.cy + ey };
	}

	// A world point in screen pixels from the bottom left: [x, y].
	world_to_screen(x, y) {
		const v = this.view, cam = this.camera;
		if (!v) return [(x - cam.left) / (cam.right - cam.left) * this.width, (y - cam.bottom) / (cam.top - cam.bottom) * this.height];
		const c = Math.cos(-v.angle), s = Math.sin(-v.angle);
		const dx = x - v.cx, dy = y - v.cy;
		return [(c * dx - s * dy + v.half_w) / (2 * v.half_w) * this.width, (s * dx + c * dy + v.half_h) / (2 * v.half_h) * this.height];
	}

	// A point on the screen (u, v: 0 … 1 from the top left) in the world: [x, y].
	screen_to_world(u, v) {
		const view = this.view, cam = this.camera;
		if (!view) return [cam.left + u * (cam.right - cam.left), cam.top - v * (cam.top - cam.bottom)];
		const dx = (u - 0.5) * 2 * view.half_w, dy = (0.5 - v) * 2 * view.half_h;
		const c = Math.cos(view.angle), s = Math.sin(view.angle);
		return [view.cx + c * dx - s * dy, view.cy + s * dx + c * dy];
	}

	// Where something placed at (x, y) – its feet, w × h big – has its top on
	// the screen (a price tag, a speech bubble): [x, y] in screen pixels.
	screen_top_of(x, y, w, h) {
		if (!this.view) return this.world_to_screen(x, y + h);
		const [sx, sy] = this.world_to_screen(x, y + h / 2);
		const c = Math.abs(Math.cos(this.view.angle)), s = Math.abs(Math.sin(this.view.angle));
		return [sx, sy + (c * h / 2 + s * w / 2) / (2 * this.view.half_h) * this.height];
	}

	// Figures in the middle of a turn: drawn at their angle, turning around
	// their middle. Returns [mesh, x, y] to put back after drawing.
	show_turning_figures() {
		const back = [];
		const t = this.clock.getElapsedTime();
		for (const figure of [this.player_character, ...(this.baddies ?? []), ...(this.companions ?? [])]) {
			if (!figure?.mesh || (!figure.gravity_k && !figure.gravity_turn && !figure.mesh.rotation.z)) continue;
			const angle = figure.visual_angle(t);
			figure.mesh.rotation.z = angle;
			const base = figure.gravity_k * Math.PI / 2;
			if (angle === base) continue;
			const p = figure.mesh.position, h2 = figure.sprite.height * 0.5;
			const [cx, cy] = figure.world_center();
			back.push([figure.mesh, p.x, p.y]);
			p.set(cx + Math.sin(angle) * h2, cy - Math.cos(angle) * h2, p.z);
		}
		return back;
	}

	// Things to collect (Einsammeln, keys) stay upright on the screen when the
	// camera turns with a turned gravity: a sideways heart or coin looks
	// wrong. They turn around their middle, only while drawing – where they
	// are and what touches them stays as it is. Returns [mesh, x, y] to put back.
	show_upright_items(angle) {
		const back = [];
		if (!angle && !this.items_turned) return back;
		this.items_turned = Boolean(angle);
		const c = Math.cos(angle), s = Math.sin(angle);
		for (const entry of this.active_level_sprites ?? []) {
			const sprite = this.data.sprites[entry.sprite_index];
			if (!entry.mesh || !sprite?.traits || !('pickup' in sprite.traits || 'key' in sprite.traits)) continue;
			entry.mesh.rotation.z = angle;
			if (!angle) continue;
			const p = entry.mesh.position, h2 = sprite.height * 0.5 * Math.abs(entry.mesh.scale?.y ?? 1);
			back.push([entry.mesh, p.x, p.y]);
			p.set(p.x + s * h2, p.y + h2 - c * h2, p.z);
		}
		return back;
	}

	// Snow, rain, smoke, fire, bubbles and lightning fall or rise: when the
	// camera turns, they stay upright on the screen. Their texture coordinates
	// (the world position the shader reads, backdrops.js set_backdrop_uv) and
	// control points turn the other way round.
	turn_upright_effects(angle) {
		if (!this.upright_effects?.length || (this.upright_effects_angle ?? 0) === angle) return;
		this.upright_effects_angle = angle;
		const c = Math.cos(-angle), s = Math.sin(-angle);
		const turn = ([x, y]) => [c * x - s * y, s * x + c * y];
		for (const effect of this.upright_effects) {
			const uv = effect.mesh.geometry.attributes.uv;
			effect.corners.forEach((corner, i) => uv.setXY(i, ...turn(corner)));
			uv.needsUpdate = true;
			for (const [name, point] of effect.points) effect.mesh.material.uniforms[name].value = turn(point);
		}
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

		this.update_speaking_states();
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
			const flight = this.transitioning_sprites.pickup[pi];
			if (flight.ux !== undefined) {
				// collected in a turned gravity: up is where the figure's up is (Character.collected_flies_up)
				entry.mesh.position.x = flight.x0 + flight.ux * rise * (1.0 - Math.pow(1.0 - k, 3));
				entry.mesh.position.y = flight.y0 + flight.uy * rise * (1.0 - Math.pow(1.0 - k, 3));
			} else entry.mesh.position.y = flight.y0 + rise * (1.0 - Math.pow(1.0 - k, 3));
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
		for (let pi of delete_keys) {
			delete this.transitioning_sprites.transition[pi];
			// a signal arrived while the door was moving
			const pending = this.active_level_sprites[pi]?.door_signal_pending;
			if (pending) this.move_door_by_signal(Number(pi), pending, t1);
		}

		if (this.player_character) {
			if (this.player_character.invincible() || this.player_character.accelerated()) {
				this.player_character.mesh.visible = (this.frame % 10) < 5;
			} else {
				this.player_character.mesh.visible = true;
			}
		}

		// A turned gravity turns the camera with the player (Character.visual_angle):
		// the player stays upright on the screen. The level's edges then hold the
		// rectangle around the turned screen (view_extents) – on all four sides
		// while the camera is turned, as there is no sky beyond a wall. During a
		// turn the camera glides from where the edges held it before to where
		// they hold it after, so the player stays in the picture. Unturned, all
		// of this is exactly as it has always been.
		const view_angle = this.player_character?.camera_angle?.(this.clock.getElapsedTime()) ?? 0;
		this.view_angle = view_angle;
		const turn = view_angle ? this.player_character?.gravity_turn : null;
		const held = (angle) => {
			// (a whole turn round is upright again)
			const turned = Math.abs(Math.sin(angle / 2)) > 1e-9;
			if (!turned) angle = 0;
			const [view_ex, view_ey] = this.view_extents(this.width * 0.5 / scale, this.height * 0.5 / scale, angle);
			let camera_x = this.camera_x, camera_y = this.camera_y;
			this.camera.left = camera_x - view_ex;
			this.camera.right = camera_x + view_ex;
			this.camera.top = camera_y + view_ey;
			this.camera.bottom = camera_y - view_ey;
			const [span_x, span_y] = angle ? this.view_extents(this.screen_pixel_height * 16.0 / 9, this.screen_pixel_height, angle) :
				[this.screen_pixel_height * 16.0 / 9, this.screen_pixel_height];

			// fix camera
			if (this.maxx - this.minx > span_x) {
				if (this.camera.left < this.minx)
					camera_x += (this.minx - this.camera.left);
				if (this.camera.right > this.maxx)
					camera_x += (this.maxx - this.camera.right);
			} else {
				camera_x = (this.minx + this.maxx) * 0.5;
			}
			if (this.maxy - this.miny > span_y) {
				if (this.camera.bottom < this.miny)
					camera_y += (this.miny - this.camera.bottom);
				// turned: nothing beyond the top either (unturned there is sky above)
				else if (turned && this.camera.top > this.maxy)
					camera_y += (this.maxy - this.camera.top);
			} else {
				camera_y = (this.miny + this.maxy) * 0.5;
			}
			return [camera_x, camera_y];
		};
		const turned_to = turn ? turn.camera_to : view_angle;
		const before = turn ? held(turn.camera_from) : null;
		[this.camera_x, this.camera_y] = held(turned_to);
		let view_x = this.camera_x, view_y = this.camera_y;
		if (before && turn.camera_to !== turn.camera_from) {
			// where the player is on the screen glides from before to after – it
			// never leaves the picture while everything turns around it
			const e = Math.min(1, Math.max(0, (view_angle - turn.camera_from) / (turn.camera_to - turn.camera_from)));
			const [px, py] = this.player_character.world_center();
			const on_screen = (cx, cy, a) => {
				const c = Math.cos(-a), s = Math.sin(-a), dx = px - cx, dy = py - cy;
				return [c * dx - s * dy, s * dx + c * dy];
			};
			const [ax, ay] = on_screen(before[0], before[1], turn.camera_from);
			const [bx, by] = on_screen(view_x, view_y, turn.camera_to);
			const sx = ax + (bx - ax) * e, sy = ay + (by - ay) * e;
			const c = Math.cos(view_angle), s = Math.sin(view_angle);
			view_x = px - (c * sx - s * sy);
			view_y = py - (s * sx + c * sy);
		}

		let cx = view_x;
		let cy = view_y;
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

		const half_w = this.width * 0.5 / scale, half_h = this.height * 0.5 / scale;
		if (!view_angle) {
			this.camera.left = cx - half_w;
			this.camera.right = cx + half_w;
			this.camera.top = cy + half_h;
			this.camera.bottom = cy - half_h;
			this.camera.position.x = 0;
			this.camera.position.y = 0;
			this.camera.rotation.z = 0;
			this.view = null;
		} else {
			// turned: the camera sits in the middle and turns there
			this.camera.left = -half_w;
			this.camera.right = half_w;
			this.camera.top = half_h;
			this.camera.bottom = -half_h;
			this.camera.position.x = cx;
			this.camera.position.y = cy;
			this.camera.rotation.z = view_angle;
			this.view = { cx, cy, angle: view_angle, half_w, half_h };
		}
		// weather that falls or rises stays upright on the screen (screen_upright_effects)
		this.turn_upright_effects(view_angle);

		for (let i = 0; i < this.layers.length; i++) {
			this.layers[i].position.x = this.camera_x * this.data.levels[this.level_index].layers[i].properties.parallax;
			this.layers[i].position.y = this.camera_y * this.data.levels[this.level_index].layers[i].properties.parallax;
		}

		this.camera.updateProjectionMatrix();
		// a tablet or a retina screen: the pixels of the game sharp, not blurred by
		// the browser (at most twice as many pixels: a phone stays fast)
		const pixel_ratio = Math.min(Math.max(globalThis.devicePixelRatio || 1, 1), 2);
		if (this.renderer.getPixelRatio() !== pixel_ratio) this.renderer.setPixelRatio(pixel_ratio);
		this.renderer.setSize(this.width, this.height);
		this.renderer.sortObjects = false;

		// this.renderer.gammaFactor = 2.2;
		// this.renderer.outputEncoding = THREE.sRGBEncoding;

		this.renderer.setRenderTarget(this.data.properties.crt_effect ? this.render_target : null);
		// figures in the middle of a turn are drawn turning (Character.visual_angle)
		const turning = this.show_turning_figures();
		// coins, hearts, keys: upright on the screen, however the camera has turned
		turning.push(...this.show_upright_items(this.view_angle ?? 0));
		this.renderer.render(this.scene, this.camera);
		for (const [mesh, x, y] of turning) mesh.position.set(x, y, mesh.position.z);

		if (this.data.properties.crt_effect) {
			this.screen_camera.left = -this.width * 0.5;
			this.screen_camera.right = this.width * 0.5;
			this.screen_camera.bottom = -this.height * 0.5;
			this.screen_camera.top = this.height * 0.5;
			this.screen_camera.updateProjectionMatrix();
			this.renderer.setRenderTarget(null);
			this.renderer.render(this.screen_scene, this.screen_camera);
		}
		// the HUD (hud.js), and what somebody says on top of everything
		this.draw_price_tags();
		this.draw_hud();
		this.draw_speech();
		if (this.running)
			this.render_frame = requestAnimationFrame((t) => this.render());
	}

	resume_game() {
		if (this.lives > 0) {
			this.ts_zoom_actor = -1;
			this.player_character.reset_gravity?.();
			this.player_character.mesh.position.x = this.player_character.initial_position[0];
			this.player_character.mesh.position.y = this.player_character.initial_position[1];
			this.player_character.invincible_until = this.clock.getElapsedTime() + this.data.properties.respawn_invincible;
			// back at the start or the checkpoint: Bereiche decide at once, without fading
			if (this.signals) {
				this.signals.immediate = true;
				this.update_signal_areas(this.clock.getElapsedTime());
				this.signals.immediate = false;
			}
			this.update_layer_visibility();
		}
	}

	// -------------------------------------------------------- test runs
	// "Level testen" in the studio: straight into one level, without the
	// start screen and the curtain, optionally with the figure at a chosen
	// point (start: { x, y }, its feet there). Nothing about the game changes.
	start_playtest({ level_index = 0, start = null } = {}) {
		if (!this.data) return;
		const count = this.data.levels?.length ?? 0;
		this.playtest = { level_index: Math.max(0, Math.min(count - 1, level_index | 0)), start };
		this.reset();
		this.level_index = this.playtest.level_index;
		this.setup();
		const pc = this.player_character;
		if (pc && start && Number.isFinite(start.x) && Number.isFinite(start.y)) {
			pc.mesh.position.x = start.x;
			pc.mesh.position.y = this.free_start_height(pc, start.x, start.y);
			// dying brings the figure back here, too
			pc.initial_position = [pc.mesh.position.x, pc.mesh.position.y];
			this.camera_x = pc.mesh.position.x;
			this.camera_y = pc.mesh.position.y + this.data.properties.screen_pixel_height * 0.3;
			// Bereiche and the picture: as if the level had started here
			if (this.signals) {
				this.signals.immediate = true;
				this.update_signal_areas(0);
				this.signals.immediate = false;
			}
			this.update_layer_visibility();
		}
		$('#overlay').stop(true, true).hide();
		$('#screen').stop(true, true).show();
		$('#playtest_badge').addClass('showing');
		// the keys belong to the game at once (the studio started this with T)
		try { window.focus(); } catch { }
		this.frame = 0;
		this.clock.start();
		this.run();
	}

	// Clicked on the floor or a wall: the figure stands on top of it instead
	// of being stuck inside.
	free_start_height(pc, x, y) {
		const half = pc.sprite.width * 0.5;
		for (let tries = 0; tries < 64; tries++) {
			const solid = this.collision_candidates(x - half * pc.traits.ex_left + 0.5, x + half * pc.traits.ex_right - 0.5,
				y + 0.5, y + pc.sprite.height * pc.traits.ex_top - 0.5)
				.map(i => this.active_level_sprites[i])
				.filter(entry => {
					const traits = this.data.sprites[entry.sprite_index].traits;
					return 'block_sides' in traits || 'block_above' in traits || 'block_below' in traits ||
						('door' in traits && entry.door_closed);
				});
			if (!solid.length) return y;
			y = Math.max(...solid.map(entry => entry.mesh.position.y + this.data.sprites[entry.sprite_index].height));
		}
		return y;
	}

	// Without stop(): no fading out and in. The running frame loop ends by
	// itself (running is false), the new one starts a frame later.
	restart_playtest() {
		if (!this.playtest || this.restarting_playtest) return;
		this.restarting_playtest = true;
		this.speech?.stop();
		this.curtain.hide();
		this.running = false;
		requestAnimationFrame(() => requestAnimationFrame(() => {
			this.restarting_playtest = false;
			if (this.playtest) this.start_playtest(this.playtest);
		}));
	}

	end_playtest() {
		this.stop();
		this.playtest = null;
		$('#playtest_badge').removeClass('showing');
		// back to the level editor, exactly where it was
		try { window.parent?.studio_return_from_playtest?.(); } catch { }
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
		let manual_door = false; // a placed door that needs F (door_setting)
		for (const level of this.data.levels ?? [])
			for (const layer of level.layers ?? [])
				if (layer.type === 'sprites') for (const p of layer.sprites ?? []) {
					placed.add(p[0]);
					const door = this.data.sprites[p[0]]?.traits?.door;
					if (door && !door_setting(p[3]?.door?.automatic, door.automatic)) manual_door = true;
				}
		const sprites = [...placed].map(si => this.data.sprites[si]).filter(Boolean);
		const has = (fn) => sprites.some(sp => fn(sp.traits ?? {}));
		// the same attack list a Character gets (new melee/ranged traits or old swords)
		const actor_attack = (slot, kind) => has(t => {
			if (!('actor' in t)) return false;
			const attacks = (t.melee_attack?.attack || t.ranged_attack?.attack) && typeof resolved_character_attacks === 'function' ?
				resolved_character_attacks(t, 'actor') : t.actor?.attacks;
			return Array.isArray(attacks) && attacks.some(a => a?.slot === slot && a.delivery?.kind === kind);
		});
		// weapons (inventory.js): placed ones, and what a shop sells
		const weapon = (slot) => sprites.some(sp => weapon_slots(sp).includes(slot));
		let shop = false;
		for (const level of this.data.levels ?? [])
			for (const layer of level.layers ?? [])
				if (layer.type === 'sprites') for (const p of layer.sprites ?? [])
					if (Number(p[3]?.pickup?.price) > 0 && 'pickup' in (this.data.sprites[p[0]]?.traits ?? {})) shop = true;
		const uses = {
			left: true, right: true, jump: true,
			up: has(t => 'ladder' in t), down: has(t => 'ladder' in t),
			action: manual_door || shop || has(t => 'text' in t || 'switch' in t),
			switch: has(t => 'switch' in t),
			shop,
			melee: actor_attack('nah', 'swing') || weapon('nah'),
			ranged: actor_attack('fern', 'projectile') || weapon('fern'),
			weapons: sprites.filter(sp => is_weapon(sp)).length > 1,
		};
		const action_label = ['Tür', ...(uses.switch ? ['Schalter'] : []), 'Text', ...(uses.shop ? ['Kaufen'] : [])].join(', ');
		const touch = this.touch_seen || window.matchMedia?.('(pointer: coarse)')?.matches;
		const rows = touch ? [
			['Laufen', ['linker Kreis']],
			...(uses.up ? [['Leiter', ['linker Kreis hoch / runter']]] : []),
			['Springen', ['⤒']],
			...(uses.action ? [[action_label, ['auf das F tippen']]] : []),
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
				...(uses.action ? [[action_label, ...k('action')]] : []),
				...(uses.melee ? [['Nahkampf', ...k('melee')]] : []),
				...(uses.ranged ? [['Fernkampf', ...k('ranged')]] : []),
				// several weapons: the number keys choose (the number stands beside each in the HUD)
				...(uses.weapons ? [['Waffe wählen', ['1 … 9']]] : []),
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
		this.update_start_hint();
	}

	// Under the controls: how to play full screen. On a phone or tablet a big
	// button "Im Vollbild spielen" instead (full screen, sideways, and go:
	// fullscreen.js) – while the game is not full screen yet. Without full
	// screen (an iPhone) held upright: turn it sideways.
	update_start_hint() {
		const touch = this.touch_seen || window.matchMedia?.('(pointer: coarse)')?.matches;
		const fullscreen = window.game_fullscreen;
		const offer = Boolean(touch && fullscreen?.supported?.() && !fullscreen.is_fullscreen());
		$('#mi_fullscreen').css('display', offer ? '' : 'none');
		const upright = window.matchMedia?.('(orientation: portrait)')?.matches;
		$('#start_hint').text(touch ?
			(!offer && upright && !fullscreen?.is_fullscreen?.() ? 'Dreh dein Gerät quer – dann wird das Spiel größer.' : '') :
			'Vollbild: Alt + Enter oder ⛶ unten rechts · Esc beendet das Spiel');
	}

	// The end of the game: its title, and the points if the HUD counts them.
	end_screen_info() {
		const plan = typeof hud_plan === 'function' && this.data ? hud_plan(this.data) : null;
		return { title: this.data?.properties?.title, points: this.points, show_points: !!plan?.coins?.show };
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
		const [x, y] = this.screen_to_world(u, v);
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
		[this.pointer_world.x, this.pointer_world.y] = this.screen_to_world(u, v);
		this.pointer_world.valid = true;
	}


	handle_key_down(key) {
		if (((this.running && this.lives === 0) || (this.level_index >= this.data.levels.length)) && key === 'Escape') {
			this.stop();
			return;
		}
		// Sprechtexte (speech.js): "." goes on to the next sentence, like in old
		// adventure games (unless "." is one of the game's own keys); so does a
		// tap on a touch screen. Every other key plays on.
		if (this.speech?.active && (key === 'Tap' ||
			((key === 'Period' || key === 'NumpadDecimal') && !this.key_actions.has(key)))) {
			this.speech.skip(this.clock.getElapsedTime());
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
		// 1 … 9: choose a weapon (inventory.js) – unless the game uses that key itself
		const weapon_number = this.running && !this.key_actions.has(key) ? weapon_key_number(key) : null;
		if (weapon_number !== null) this.choose_weapon_key(weapon_number);
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
		// platforms first: whoever stands on one goes along, then moves itself
		if (this.moving_platforms?.length) MovingPlatforms.step(this, t);
		if (this.player_character !== null)
			this.player_character.simulation_step(t);
		// enemies on a layer that is away (Signale) wait
		for (let baddie of this.baddies)
			if (!baddie.signal_hidden) baddie.simulation_step(t);
		// Begleiter after the player: they go where it is now
		for (const companion of this.companions ?? [])
			if (!companion.signal_hidden) companion.simulation_step(t);
		this.update_signal_areas(t);
		// Verkäufer: greet and chat (only in levels that have one)
		if (this.shop_keepers?.length) this.update_shop_keepers(t);
		// signals with a Verzögerung that are due now, then doors that close again
		this.signals?.deliver_due(t);
		this.update_auto_closing_doors(t);
		this.update_waiting_doors(t);
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

			if (mesh.position.y < this.view_box().bottom - this.data.properties.screen_pixel_height) {
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
				if (!baddie.active || baddie.signal_hidden) continue;
				// its body in the world (turned gravity: Character.world_box)
				let [x0, x1, y0, y1] = baddie.world_box(-(baddie.sprite.width / 2) * baddie.traits.ex_left,
					(baddie.sprite.width / 2) * baddie.traits.ex_right, 0, baddie.sprite.height * baddie.traits.ex_top);
				this.dynamic_interval_tree_x.insert([x0, x1], bi);
				this.dynamic_interval_tree_y.insert([y0, y1], bi);
			}
			this.dynamic_interval_frame = this.frame;
		}
	}

	// Level sprites whose rectangle overlaps this one, in the order the
	// interval trees have always given them. Sprites on a layer that a signal
	// has taken away are not there: they do not collide, cannot be collected
	// and do not hurt.
	collision_candidates(x0, x1, y0, y1) {
		const result_y = new Set(this.interval_tree_y.search([y0, y1]));
		const result = [];
		for (const i of new Set(this.interval_tree_x.search([x0, x1]))) {
			if (result_y.has(i) && !this.active_level_sprites[i]?.signal_hidden) result.push(i);
		}
		return result;
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
			if (baddie.active && !baddie.signal_hidden) return baddie;
		}
		return null;
	}

	// force: moved by a signal (signals.js), not by the figure – no key needed.
	open_door_intent(entry_index, t, options = {}) {
		let entry = this.active_level_sprites[entry_index];
		let sprite = this.data.sprites[entry.sprite_index];
		// already open: "schließt wieder nach" starts again (an automatic door
		// stays open while the figure stands in front of it)
		if (entry.door_closed === false && entry.close_at !== null && entry.close_at !== undefined)
			entry.close_at = t + signal_delay_seconds(entry.close_after);
		if (entry.door_state === 'opening' || entry.door_closed === false)
			return;
		let ok = false;
		if (door_setting(entry.lockable, sprite.traits.door.lockable) && !options.force) {
			// check if we have correct key
			if (this.found_keys[entry.signal_code] === true) {
				ok = true;
			}
		} else {
			ok = true;
		}
		if (ok) {
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

	close_door_intent(entry_index, t, options = {}) {
		let entry = this.active_level_sprites[entry_index];
		let sprite = this.data.sprites[entry.sprite_index];
		if (entry.door_state === 'closing' || entry.door_closed === true)
			return;
		if (sprite.traits.door.closable || options.force) {
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
		} else if (!this.door_occupied(entry_index)) {
			// never onto somebody standing in the doorway
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
	if (tag.length === 7) window.game.load(tag);

	// a phone or tablet: full screen first (while the tap still counts as the
	// player's own), then the game starts as with "Start"
	$('#mi_fullscreen').click(function (e) {
		e.stopPropagation();
		window.game_fullscreen?.enter();
		$('#mi_start').trigger('click');
	});

	// Start: once the game has loaded (Game.load); before any game, nothing
	// happens, and clicking again while it loads starts it only once
	// (a loaded game starts right in the click, as before: music and full
	// screen may need the click itself)
	let start_pending = false;
	const start = () => {
		window.game.playtest = null;
		$('#playtest_badge').removeClass('showing');
		// reset() starts with the first level of the order (level_flow.js)
		window.game.reset();
		window.game.setup();
		window.game.prepare_run();
	};
	$('#mi_start').click(function (e) {
		if (window.game.loaded) return start();
		const loading = window.game.loading;
		if (!loading || start_pending) return;
		start_pending = true;
		loading.then(() => { start_pending = false; start(); }, () => { start_pending = false; });
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
// Visuals belong to accepted hits, not to a delivery's collision lifetime.
// Reuse the ordinary sprite atlas: never clone/dispose atlas frames or textures.
class CombatImpactEffects {
    constructor(game) {
        this.game = game;
        this.active = [];
    }

    spawn_sprite_index(si, x, y, time, options = {}) {
        if (!Number.isInteger(si) || si < 0 || this.active.length >= 64 ||
            typeof THREE === 'undefined' || !THREE.Mesh || !this.game.scene) return false;
        const sprite = this.game.data?.sprites?.[si];
        const state_index = Number.isInteger(options.state_index) ? options.state_index : 0;
        const state = sprite?.states?.[state_index];
        const frames = this.game.geometry_and_material_for_frame?.[si]?.[state_index];
        if (!state?.frames?.length || !frames?.length || frames.length !== state.frames.length ||
            !frames.every(frame => frame?.geometry && frame?.material)) return false;
        const fps = Number.isFinite(state.properties?.fps) && state.properties.fps > 0 ?
            state.properties.fps : 8;
        const mesh = new THREE.Mesh(frames[0].geometry, frames[0].material);
        mesh.position.set(Math.round(x), Math.round(y), Number.isFinite(options.z) ? options.z : 3);
        if (mesh.scale) {
            mesh.scale.x = options.mirror_x ? -1 : 1;
            mesh.scale.y = 1;
            mesh.scale.z = 1;
        }
        this.game.scene.add(mesh);
        this.active.push({ mesh, frames, fps, started_at: time,
            expires_at: time + Math.max(0.15, frames.length / fps), frame_index: 0 });
        return true;
    }

    spawn(instance, target, time) {
        const si = instance.definition.visual?.hit_sprite_index;
        const sprite = this.game.data?.sprites?.[si];
        // Atlas planes are anchored at their bottom edge. Draw at native size,
        // centred on the target and aligned to whole logical game pixels.
        this.spawn_sprite_index(si,
            target.mesh.position.x,
            target.mesh.position.y + target.sprite.height / 2 - (sprite?.height ?? 0) / 2,
            time, { z: 3 });
    }

    step(time) {
        const still_active = [];
        for (const effect of this.active) {
            if (time >= effect.expires_at) {
                this.game.scene?.remove(effect.mesh);
                continue;
            }
            const index = Math.min(effect.frames.length - 1,
                Math.max(0, Math.floor((time - effect.started_at) * effect.fps)));
            if (index !== effect.frame_index) {
                effect.frame_index = index;
                effect.mesh.geometry = effect.frames[index].geometry;
                effect.mesh.material = effect.frames[index].material;
            }
            still_active.push(effect);
        }
        this.active = still_active;
    }

    reset() {
        for (const effect of this.active) this.game.scene?.remove(effect.mesh);
        this.active = [];
    }
}

// Shared combat foundation. Loaded by the game runtime when combat is integrated.
// Existing games without an attacks array have no combat attacks.
class CombatSystem {
    constructor(game) {
        this.game = game;
        this.deliveries = new Map();
        this.impacts = new CombatImpactEffects(game);
        this.reset();
    }

    reset() {
        this.impacts.reset();
        for (let instance of this.active ?? []) {
            this.deliveries.get(instance.definition.delivery.kind)?.stop?.(instance, this);
        }
        this.active = [];
        this.cooldowns = new WeakMap();
        this.next_id = 1;
    }

    // Each delivery supplies validate(definition), start(instance, combat), and
    // optionally step(instance, time, combat). Neither owner type is special here.
    register_delivery(kind, handler) {
        if (typeof kind !== 'string' || !kind || !handler ||
            typeof handler.validate !== 'function' || typeof handler.start !== 'function') {
            throw new TypeError('Invalid combat delivery');
        }
        this.deliveries.set(kind, handler);
    }

    owner_is_alive(owner) {
        if (!owner || owner.game !== this.game || !owner.active || !owner.mesh) return false;
        if (owner.character_trait === 'actor') {
            return owner === this.game.player_character &&
                this.game.energy > 0 && !(owner.dead?.() ?? false);
        }
        if (owner.character_trait === 'baddie') {
            return this.game.baddies.includes(owner) && owner.energy > 0;
        }
        return false;
    }

    game_allows_combat() {
        return this.game.running && !this.game.reached_flag &&
            !this.game.curtain?.showing && this.game.lives > 0;
    }

    // The schema is opt-in and shared by actor and baddie. Only registered
    // deliveries can be requested; future presets never silently do nothing.
    valid_definition(definition) {
        if (!definition || typeof definition !== 'object' ||
            typeof definition.id !== 'string' || !definition.id ||
            typeof definition.slot !== 'string' || !definition.slot ||
            definition.effect?.kind !== 'damage' ||
            !Number.isFinite(definition.effect.amount) ||
            definition.effect.amount <= 0 || definition.effect.amount > 10000 ||
            !Number.isFinite(definition.timing?.cooldown_s) ||
            definition.timing.cooldown_s < 0 || definition.timing.cooldown_s > 60 ||
            (definition.hit?.rehit_interval_s !== undefined &&
                (!Number.isFinite(definition.hit.rehit_interval_s) ||
                    definition.hit.rehit_interval_s < 0.05 ||
                    definition.hit.rehit_interval_s > 60))) {
            return false;
        }
        let handler = this.deliveries.get(definition.delivery?.kind);
        return !!handler && handler.validate(definition) === true;
    }

    // Called by either player controls or baddie AI. A delivery owns geometry;
    // an attack visual (including its absence) never controls hit detection.
    request_attack(owner, attack_id, time, aim = null) {
        if (!this.game_allows_combat() || !this.owner_is_alive(owner) ||
            !Number.isFinite(time) || time < 0 || this.active.length >= 128) return null;
        let attacks = owner.traits?.attacks;
        if (!Array.isArray(attacks)) return null;
        let definition = attacks.find((attack) => attack?.id === attack_id);
        if (!this.valid_definition(definition)) return null;

        let times = this.cooldowns.get(owner);
        let previous = times?.get(attack_id);
        if (previous !== undefined && time < previous + definition.timing.cooldown_s) return null;

        // Snapshot the definition: editing a sprite cannot alter an active shot.
        let snapshot = {
            ...definition,
            delivery: { ...definition.delivery,
                ...(definition.delivery.detonation ?
                    { detonation: { ...definition.delivery.detonation } } : {}) },
            effect: { ...definition.effect },
            timing: { ...definition.timing },
            hit: definition.hit ? { ...definition.hit } : null,
            visual: definition.visual ? { ...definition.visual } : null,
        };
        let instance = {
            id: this.next_id++, owner: owner, team: owner.character_trait,
            definition: snapshot, started_at: time, expires_at: time,
            aim: aim, hit_targets: new Set(), last_hit_at: new Map(),
        };
        let handler = this.deliveries.get(snapshot.delivery.kind);
        // A delivery may decline a request (e.g. no valid direction). Do not
        // consume a cooldown or retain an instance in that case.
        // Register before start: a hitscan delivery may hit immediately in start().
        this.active.push(instance);
        if (handler.start(instance, this) === false ||
            !Number.isFinite(instance.expires_at) || instance.expires_at < time ||
            instance.expires_at > time + 30) {
            this.active.pop();
            return null;
        }
        if (!times) {
            times = new Map();
            this.cooldowns.set(owner, times);
        }
        times.set(attack_id, time);
        // Presentation is a notification, never a prerequisite for activation.
        owner.show_combat_visual?.('attack');
        return instance;
    }

    // All deliveries use this one gateway; no friendly fire or self-hits in v1.
    // Existing contact/trap/falling-block damage never passes through here.
    apply_hit(instance, target, time) {
        if (!this.game_allows_combat() || !this.active.includes(instance) ||
            !this.owner_is_alive(instance.owner) || !this.owner_is_alive(target) ||
            target === instance.owner || !Number.isFinite(time) ||
            time < instance.started_at || time > instance.expires_at) return false;
        if (instance.hit_targets.has(target)) {
            let interval = instance.definition.hit?.rehit_interval_s;
            if (interval === undefined || time < instance.last_hit_at.get(target) + interval) return false;
        }
        if (instance.team === 'actor' && target.character_trait !== 'baddie') return false;
        if (instance.team === 'baddie' && target.character_trait !== 'actor') return false;

        let amount = instance.definition.effect.amount;
        if (target.character_trait === 'actor') {
            if (target.invincible?.()) return false;
            this.game.energy = Math.max(0, this.game.energy - amount);
            this.game.update_stats();
            if (this.game.energy === 0) target.die(null, null);
        } else {
            target.take_damage(amount);
        }
        instance.hit_targets.add(target);
        instance.last_hit_at.set(target, time);
        this.impacts.spawn(instance, target, time);
        // Only an accepted, nonlethal combat hit can start target-owned art.
        if (this.owner_is_alive(target)) {
            target.show_combat_visual?.('hit');
            target.flash_on_hit?.();
        }
        return true;
    }

    step(time) {
        if (!Number.isFinite(time)) return;
        if (!this.game_allows_combat()) {
            this.impacts.reset();
            for (let instance of this.active)
                this.deliveries.get(instance.definition.delivery.kind)?.stop?.(instance, this);
            this.active = [];
            return;
        }
        this.impacts.step(time);
        let retired = new Set();
        // A delivery may spawn child attacks while stepping. Keep those new
        // instances rather than replacing the active array mid-iteration.
        for (let instance of [...this.active]) {
            if (!this.owner_is_alive(instance.owner) || time > instance.expires_at) {
                retired.add(instance);
                continue;
            }
            let handler = this.deliveries.get(instance.definition.delivery.kind);
            if (!handler || (typeof handler.step === 'function' &&
                handler.step(instance, time, this) === false)) retired.add(instance);
        }
        if (retired.size) {
            for (let instance of retired)
                this.deliveries.get(instance.definition.delivery.kind)?.stop?.(instance, this);
            this.active = this.active.filter((instance) => !retired.has(instance));
        }
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { CombatSystem, CombatImpactEffects };

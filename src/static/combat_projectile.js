// Projectile delivery owns only flight, artwork and collision. Damage,
// cooldowns, hit reactions and target eligibility remain in the shared combat system.
function register_projectile(combat) {
    const RADIUS = 2; // Fixed collision half-size: student artwork cannot change hits.

    function character_bounds(character) {
        const x = character.mesh.position.x;
        const y = character.mesh.position.y;
        const half = character.sprite.width / 2;
        return {
            x0: x - half * (character.traits.ex_left ?? 1),
            x1: x + half * (character.traits.ex_right ?? 1),
            y0: y, y1: y + character.sprite.height * (character.traits.ex_top ?? 1),
        };
    }

    // Return the earliest time along a segment at which a 4x4 projectile touches
    // an expanded rectangle. This avoids tunnelling for both horizontal and arced shots.
    function first_contact(fromX, fromY, toX, toY, rect) {
        const bounds = {
            x0: rect.x0 - RADIUS,
            x1: rect.x1 + RADIUS,
            y0: rect.y0 - RADIUS,
            y1: rect.y1 + RADIUS,
        };
        const dx = toX - fromX;
        const dy = toY - fromY;
        let entry = 0;
        let exit = 1;
        for (const [start, delta, lo, hi] of [
            [fromX, dx, bounds.x0, bounds.x1],
            [fromY, dy, bounds.y0, bounds.y1],
        ]) {
            if (Math.abs(delta) < 1e-9) {
                if (start < lo || start > hi) return null;
                continue;
            }
            let t0 = (lo - start) / delta;
            let t1 = (hi - start) / delta;
            if (t0 > t1) [t0, t1] = [t1, t0];
            entry = Math.max(entry, t0);
            exit = Math.min(exit, t1);
            if (entry > exit) return null;
        }
        return entry >= 0 && entry <= 1 ? entry : null;
    }

    function obstacle_contact(game, fromX, fromY, toX, toY) {
        let nearest = null;
        for (const entry of game.active_level_sprites ?? []) {
            const sprite = game.data?.sprites?.[entry.sprite_index];
            const traits = sprite?.traits ?? {};
            if (!sprite || !entry.mesh || !(traits.block_sides || traits.block_above ||
                traits.block_below || (traits.door && entry.door_closed))) continue;
            const rect = {
                x0: entry.mesh.position.x - sprite.width / 2,
                x1: entry.mesh.position.x + sprite.width / 2,
                y0: entry.mesh.position.y,
                y1: entry.mesh.position.y + sprite.height,
            };
            const t = first_contact(fromX, fromY, toX, toY, rect);
            if (t !== null && (nearest === null || t < nearest)) nearest = t;
        }
        return nearest;
    }

    function update_projectile_mesh(instance, time) {
        if (!instance.projectile_mesh) return;
        if (instance.projectile_frames) {
            const index = Math.floor((time - instance.started_at) * instance.projectile_fps) %
                instance.projectile_frames.length;
            instance.projectile_mesh.geometry = instance.projectile_frames[index].geometry;
            instance.projectile_mesh.material = instance.projectile_frames[index].material;
        }
        if (!instance.projectile_mesh.rotation)
            instance.projectile_mesh.rotation = { z: 0 };
        const vy = instance.projectile_vy - instance.projectile_gravity * (time - instance.started_at);
        instance.projectile_mesh.rotation.z = instance.direction * Math.atan2(vy, Math.abs(instance.projectile_vx));
        const angle = instance.projectile_mesh.rotation.z;
        const halfHeight = instance.projectile_height / 2;
        instance.projectile_mesh.position.x = Math.round(instance.projectile_x + Math.sin(angle) * halfHeight);
        instance.projectile_mesh.position.y = Math.round(instance.projectile_y - Math.cos(angle) * halfHeight);
    }

    function render_projectile(instance, system) {
        const game = system.game;
        if (typeof THREE === 'undefined' || !THREE.Mesh || !game.scene) return;
        const si = instance.definition.visual?.projectile_sprite_index;
        const sprite = game.data?.sprites?.[si];
        const state = sprite?.states?.[0];
        const frames = game.geometry_and_material_for_frame?.[si]?.[0];
        if (Number.isInteger(si) && state?.frames?.length &&
            frames?.length === state.frames.length &&
            frames.every(frame => frame?.geometry && frame?.material)) {
            instance.projectile_frames = frames;
            instance.projectile_fps = Number.isFinite(state.properties?.fps) && state.properties.fps > 0 ?
                state.properties.fps : 8;
            instance.projectile_height = sprite.height;
            instance.projectile_mesh = new THREE.Mesh(frames[0].geometry, frames[0].material);
            if (instance.projectile_mesh.scale) instance.projectile_mesh.scale.x = instance.direction;
        } else if (THREE.PlaneGeometry && THREE.MeshBasicMaterial) {
            // Default artwork needs no student-drawn asset and no atlas texture.
            const geometry = new THREE.PlaneGeometry(6, 4);
            geometry.translate(0, 2, 0);
            const material = new THREE.MeshBasicMaterial({ color: 0xffe7ac,
                transparent: true, depthWrite: false, side: THREE.DoubleSide });
            instance.projectile_mesh = new THREE.Mesh(geometry, material);
            instance.projectile_height = 4;
            instance.projectile_owns_art = true;
        }
        if (instance.projectile_mesh) {
            instance.projectile_mesh.position.set(0, 0, 2.5);
            game.scene.add(instance.projectile_mesh);
            update_projectile_mesh(instance, instance.started_at);
        }
    }

    function stop(instance, system) {
        if (instance.projectile_mesh) {
            system.game.scene?.remove(instance.projectile_mesh);
            if (instance.projectile_owns_art) {
                instance.projectile_mesh.geometry.dispose();
                instance.projectile_mesh.material.dispose();
            }
            instance.projectile_mesh = null;
        }
    }

    combat.register_delivery('projectile', {
        validate(definition) {
            const { range_px: range, speed_px_s: speed, gravity_px_s2: gravity, aim_mode: aimMode } = definition.delivery;
            return Number.isFinite(range) && range >= 1 && range <= 1000 &&
                Number.isFinite(speed) && speed >= 40 && speed <= 1200 &&
                (gravity === undefined || (Number.isFinite(gravity) && gravity >= 0 && gravity <= 4000)) &&
                (aimMode === undefined || ['horizontal', 'mouse'].includes(aimMode));
        },
        start(instance, system) {
            const owner = instance.owner;
            const speed = instance.definition.delivery.speed_px_s;
            const gravity = Number.isFinite(instance.definition.delivery.gravity_px_s2) ?
                instance.definition.delivery.gravity_px_s2 : 0;
            let aimX = Number.isFinite(instance.aim?.x) ? instance.aim.x :
                (owner.last_horizontal_facing === 'left' ? -1 : 1);
            let aimY = Number.isFinite(instance.aim?.y) ? instance.aim.y : 0;
            const norm = Math.hypot(aimX, aimY);
            if (!(norm > 1e-9)) {
                aimX = owner.last_horizontal_facing === 'left' ? -1 : 1;
                aimY = 0;
            } else {
                aimX /= norm;
                aimY /= norm;
            }
            instance.direction = aimX < 0 ? -1 : 1;
            instance.projectile_vx = aimX * speed;
            instance.projectile_vy = aimY * speed;
            instance.projectile_gravity = gravity;
            const bounds = character_bounds(owner);
            instance.projectile_x = instance.direction > 0 ? bounds.x1 + RADIUS : bounds.x0 - RADIUS;
            instance.projectile_y = owner.mesh.position.y + owner.sprite.height / 2;
            instance.projectile_start_x = instance.projectile_x;
            instance.projectile_start_y = instance.projectile_y;
            instance.projectile_elapsed = 0;
            instance.expires_at = instance.started_at +
                instance.definition.delivery.range_px / speed + 1 / 60;
            render_projectile(instance, system);
        },
        step(instance, time, system) {
            const game = system.game;
            const { range_px: range, speed_px_s: speed } = instance.definition.delivery;
            const elapsed = Math.min(range / speed, Math.max(0, time - instance.started_at));
            if (elapsed <= instance.projectile_elapsed) return elapsed < range / speed;
            const fromX = instance.projectile_x;
            const fromY = instance.projectile_y;
            const toX = instance.projectile_start_x + instance.projectile_vx * elapsed;
            const toY = instance.projectile_start_y + instance.projectile_vy * elapsed -
                0.5 * instance.projectile_gravity * elapsed * elapsed;
            let nearest = obstacle_contact(game, fromX, fromY, toX, toY);
            let targetAt = null;
            const targets = instance.team === 'actor' ? game.baddies : [game.player_character];
            for (const target of targets) {
                if (!system.owner_is_alive(target)) continue;
                const t = first_contact(fromX, fromY, toX, toY, character_bounds(target));
                if (t !== null && (nearest === null || t < nearest)) {
                    nearest = t;
                    targetAt = target;
                }
            }
            instance.projectile_x = nearest === null ? toX : fromX + (toX - fromX) * nearest;
            instance.projectile_y = nearest === null ? toY : fromY + (toY - fromY) * nearest;
            instance.projectile_elapsed = elapsed;
            update_projectile_mesh(instance, instance.started_at + elapsed);
            if (nearest !== null) {
                if (targetAt) system.apply_hit(instance, targetAt, time);
                return false; // Hit, invincible target, or solid obstacle: no piercing.
            }
            return elapsed < range / speed;
        },
        stop,
    });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { register_projectile };

// Projectile delivery owns only flight, artwork and collision. Damage,
// cooldowns, hit reactions and target eligibility remain in the shared combat system.
function register_projectile(combat) {
    const RADIUS = 2; // Ordinary projectiles have a fixed 4x4 collision box.
    const bomb_mode = instance => !!instance.definition.delivery.detonation;
    // New bomb sprites use explicit state traits. Existing artwork selected by
    // the old title-based UI still works without migrating saved game JSON.
    const bomb_state = (sprite, kind, old_name) => {
        const tagged = sprite?.states?.findIndex(state => state.traits?.bomb?.[kind]);
        if (tagged >= 0) return tagged;
        return sprite?.states?.findIndex(state =>
            state.properties?.name?.trim().toLocaleLowerCase('de') === old_name) ?? -1;
    };
    const fuse_state = sprite => bomb_state(sprite, 'fuse', 'zündschnur');
    const explosion_state = sprite => bomb_state(sprite, 'explosion', 'explosion');

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
    function first_contact(fromX, fromY, toX, toY, rect, radius = RADIUS) {
        const bounds = {
            x0: rect.x0 - radius,
            x1: rect.x1 + radius,
            y0: rect.y0 - radius,
            y1: rect.y1 + radius,
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

    function obstacle_contact(game, fromX, fromY, toX, toY, radius = RADIUS) {
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
            const t = first_contact(fromX, fromY, toX, toY, rect, radius);
            if (t !== null && (nearest === null || t < nearest)) nearest = t;
        }
        return nearest;
    }

    // Bombs collide with surfaces, not with every rectangle having any block
    // trait. A side wall cancels horizontal velocity but never suspends gravity.
    // Floor/ceiling contacts only count when moving towards that surface.
    function bomb_surface_contact(game, from, to, radius, axis) {
        let best = null;
        const delta = to[axis] - from[axis];
        if (Math.abs(delta) < 1e-9) return null;
        for (const entry of game.active_level_sprites ?? []) {
            const sprite = game.data?.sprites?.[entry.sprite_index];
            if (!sprite || !entry.mesh) continue;
            const traits = sprite.traits ?? {};
            const closed_door = traits.door && entry.door_closed;
            const blocking = axis === 'x' ? traits.block_sides :
                delta < 0 ? traits.block_above : traits.block_below;
            if (!blocking && !closed_door) continue;
            const rect = {
                x0: entry.mesh.position.x - sprite.width / 2,
                x1: entry.mesh.position.x + sprite.width / 2,
                y0: entry.mesh.position.y,
                y1: entry.mesh.position.y + sprite.height,
            };
            const other = axis === 'x' ? 'y' : 'x';
            const surface = delta > 0 ? rect[axis + '0'] - radius :
                rect[axis + '1'] + radius;
            // Do not collide with a surface already behind the starting point.
            const t = (surface - from[axis]) / delta;
            if (t < -1e-9 || t > 1 + 1e-9) continue;
            // A bomb may enter the wall's height while moving diagonally.
            // Its OLD y was not necessarily inside the wall's vertical span.
            const at_other = from[other] + (to[other] - from[other]) * t;
            if (at_other + radius <= rect[other + '0'] ||
                at_other - radius >= rect[other + '1']) continue;
            const contact = { t: Math.max(0, t), surface };
            if (!best || contact.t < best.t) best = contact;
        }
        return best;
    }

    function update_projectile_mesh(instance, time) {
        if (!instance.projectile_mesh) return;
        if (instance.projectile_frames) {
            const frame = Math.floor((time - instance.started_at) * instance.projectile_fps);
            // Zündschnur burns through once. Hold its final frame until the
            // configured fuse time, independently of the number of drawings.
            const index = bomb_mode(instance) ?
                Math.min(instance.projectile_frames.length - 1, frame) :
                frame % instance.projectile_frames.length;
            instance.projectile_mesh.geometry = instance.projectile_frames[index].geometry;
            instance.projectile_mesh.material = instance.projectile_frames[index].material;
        }
        if (!instance.projectile_mesh.rotation)
            instance.projectile_mesh.rotation = { z: 0 };
        const vy = instance.projectile_resting ? 0 :
            instance.projectile_vy - instance.projectile_gravity * (time - instance.started_at);
        instance.projectile_mesh.rotation.z = bomb_mode(instance) ? 0 :
            instance.direction * Math.atan2(vy, Math.abs(instance.projectile_vx));
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
        const selected_state = bomb_mode(instance) ? fuse_state(sprite) : -1;
        const state_index = selected_state >= 0 ? selected_state : 0;
        const state = sprite?.states?.[state_index];
        const frames = game.geometry_and_material_for_frame?.[si]?.[state_index];
        if (Number.isInteger(si) && state?.frames?.length &&
            frames?.length === state.frames.length &&
            frames.every(frame => frame?.geometry && frame?.material)) {
            instance.projectile_frames = frames;
            instance.projectile_fps = Number.isFinite(state.properties?.fps) && state.properties.fps > 0 ?
                state.properties.fps : 8;
            instance.projectile_height = sprite.height;
            instance.projectile_mesh = new THREE.Mesh(frames[0].geometry, frames[0].material);
            if (instance.projectile_mesh.scale)
                instance.projectile_mesh.scale.x = bomb_mode(instance) ? 1 : instance.direction;
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
            const { range_px: range, speed_px_s: speed, gravity_px_s2: gravity,
                aim_mode: aimMode, detonation } = definition.delivery;
            const bomb = detonation !== undefined;
            return Number.isFinite(range) && range >= 1 && range <= 1000 &&
                Number.isFinite(speed) && speed >= (bomb ? 0 : 40) && speed <= 1200 &&
                (gravity === undefined || (Number.isFinite(gravity) && gravity >= 0 && gravity <= 4000)) &&
                (aimMode === undefined || ['horizontal', 'mouse'].includes(aimMode)) &&
                (!bomb || (!!detonation && Number.isFinite(detonation.fuse_s) &&
                    detonation.fuse_s >= 0.1 && detonation.fuse_s <= 20 &&
                    Number.isFinite(detonation.radius_px) && detonation.radius_px >= 1 &&
                    detonation.radius_px <= 500 &&
                    (detonation.shake_strength === undefined ||
                        (Number.isFinite(detonation.shake_strength) &&
                            detonation.shake_strength >= 0 && detonation.shake_strength <= 20))));
        },
        start(instance, system) {
            const owner = instance.owner;
            const speed = instance.definition.delivery.speed_px_s;
            const gravity = Number.isFinite(instance.definition.delivery.gravity_px_s2) ?
                instance.definition.delivery.gravity_px_s2 : 0;
            const bomb = bomb_mode(instance);
            const drop = bomb && speed === 0;
            let aimX = Number.isFinite(instance.aim?.x) ? instance.aim.x :
                (owner.last_horizontal_facing === 'left' ? -1 : 1);
            // A horizontal bomb throw needs lift to clear the ground. Explicit
            // mouse aiming keeps the direction selected by the player.
            let aimY = Number.isFinite(instance.aim?.y) ? instance.aim.y : 0;
            if (bomb && !drop && aimY >= 0 && aimY < 0.35) aimY = 0.35;
            const norm = Math.hypot(aimX, aimY);
            if (!(norm > 1e-9)) {
                aimX = owner.last_horizontal_facing === 'left' ? -1 : 1;
                aimY = 0;
            } else {
                aimX /= norm;
                aimY /= norm;
            }
            instance.direction = aimX < 0 ? -1 : 1;
            instance.projectile_vx = drop ? 0 : aimX * speed;
            instance.projectile_vy = drop ? 0 : aimY * speed;
            instance.projectile_gravity = gravity;
            const bounds = character_bounds(owner);
            const sprite_index = instance.definition.visual?.projectile_sprite_index;
            const art_height = system.game.data?.sprites?.[sprite_index]?.height;
            instance.projectile_radius = bomb && Number.isFinite(art_height) ?
                Math.max(RADIUS, Math.min(24, art_height / 2)) : RADIUS;
            instance.projectile_x = drop ? owner.mesh.position.x :
                (instance.direction > 0 ? bounds.x1 + instance.projectile_radius :
                    bounds.x0 - instance.projectile_radius);
            // Tall bomb artwork must not spawn inside the floor at the owner's
            // feet: that made ground-level throws stop instantly.
            instance.projectile_y = Math.max(bounds.y0 + instance.projectile_radius + 2,
                owner.mesh.position.y + owner.sprite.height / 2);
            instance.projectile_start_x = instance.projectile_x;
            instance.projectile_start_y = instance.projectile_y;
            instance.projectile_y_origin_at = 0;
            instance.projectile_elapsed = 0;
            instance.projectile_resting = false;
            instance.expires_at = instance.started_at +
                (bomb ? instance.definition.delivery.detonation.fuse_s :
                    instance.definition.delivery.range_px / speed) + 1 / 60;
            render_projectile(instance, system);
        },
        step(instance, time, system) {
            const game = system.game;
            const { range_px: range, speed_px_s: speed, detonation } = instance.definition.delivery;
            const bomb = !!detonation;
            const elapsed = Math.max(0, time - instance.started_at);
            const flight_limit = speed > 0 ? range / speed : Infinity;
            const motion_time = Math.min(elapsed, bomb ? detonation.fuse_s : flight_limit);

            if (!instance.projectile_resting && motion_time > instance.projectile_elapsed) {
                const fromX = instance.projectile_x;
                const fromY = instance.projectile_y;
                const radius = instance.projectile_radius;
                if (bomb) {
                    // Sweep short segments of the *actual* arc. Previously x was
                    // tested at the old height for the entire step; a bomb could
                    // cross a side wall while rising or falling through it.
                    while (instance.projectile_elapsed < motion_time - 1e-9 &&
                        !instance.projectile_resting) {
                        const next_time = Math.min(motion_time,
                            instance.projectile_elapsed + 1 / 60);
                        const x0 = instance.projectile_x;
                        const y0 = instance.projectile_y;
                        const toX = instance.projectile_start_x + instance.projectile_vx *
                            Math.min(next_time, flight_limit);
                        const age = next_time - instance.projectile_y_origin_at;
                        const toY = instance.projectile_start_y + instance.projectile_vy * age -
                            0.5 * instance.projectile_gravity * age * age;
                        // Use the changing height when sweeping sideways.
                        const wall = bomb_surface_contact(game,
                            { x: x0, y: y0 }, { x: toX, y: toY }, radius, 'x');
                        instance.projectile_x = wall ? wall.surface : toX;
                        if (wall) {
                            instance.projectile_vx = 0;
                            instance.projectile_start_x = wall.surface;
                        } else if (next_time >= flight_limit && instance.projectile_vx !== 0) {
                            // Reaching throw range stops x only; gravity continues.
                            instance.projectile_vx = 0;
                            instance.projectile_start_x = toX;
                        }
                        const from = { x: instance.projectile_x, y: y0 };
                        const roof_or_floor = bomb_surface_contact(game,
                            from, { x: from.x, y: toY }, radius, 'y');
                        instance.projectile_y = roof_or_floor ? roof_or_floor.surface : toY;
                        if (roof_or_floor) {
                            if (toY < y0) instance.projectile_resting = true;
                            else {
                                // A ceiling cancels upward momentum, not gravity.
                                instance.projectile_start_y = roof_or_floor.surface;
                                instance.projectile_vy = 0;
                                instance.projectile_y_origin_at = next_time;
                            }
                        }
                        instance.projectile_elapsed = next_time;
                    }
                } else {
                    // Preserve ordinary projectile collision and hit behaviour.
                    const toX = instance.projectile_start_x + instance.projectile_vx * motion_time;
                    const toY = instance.projectile_start_y + instance.projectile_vy * motion_time -
                        0.5 * instance.projectile_gravity * motion_time * motion_time;
                    let contact = obstacle_contact(game, fromX, fromY, toX, toY, radius);
                    let targetAt = null;
                    const targets = instance.team === 'actor' ? game.baddies : [game.player_character];
                    for (const target of targets) {
                        if (!system.owner_is_alive(target)) continue;
                        const t = first_contact(fromX, fromY, toX, toY,
                            character_bounds(target), radius);
                        if (t !== null && (contact === null || t < contact)) {
                            contact = t;
                            targetAt = target;
                        }
                    }
                    instance.projectile_x = contact === null ? toX : fromX + (toX - fromX) * contact;
                    instance.projectile_y = contact === null ? toY : fromY + (toY - fromY) * contact;
                    if (contact !== null) {
                        update_projectile_mesh(instance, time);
                        if (targetAt) system.apply_hit(instance, targetAt, time);
                        return false;
                    }
                }
                instance.projectile_elapsed = motion_time;
            }
            update_projectile_mesh(instance, time);
            if (bomb && elapsed >= detonation.fuse_s) {
                // One explosion, one shared damage gateway per target; art is optional.
                const x = instance.projectile_x;
                const y = instance.projectile_y;
                const radius = detonation.radius_px;
                // Owner self-damage is opt-in; allied units remain protected.
                // Process opponents first so a lethal self-hit cannot suppress
                // damage to enemies in the same explosion.
                const targets = instance.team === 'actor' ?
                    [...game.baddies, ...(detonation.self_damage ? [game.player_character] : [])] :
                    [game.player_character];
                for (const target of targets) {
                    if (!system.owner_is_alive(target)) continue;
                    const bounds = character_bounds(target);
                    const px = Math.max(bounds.x0, Math.min(x, bounds.x1));
                    const py = Math.max(bounds.y0, Math.min(y, bounds.y1));
                    if (Math.hypot(x - px, y - py) <= radius)
                        system.apply_hit(instance, target, time);
                }
                const si = instance.definition.visual?.projectile_sprite_index;
                const sprite = game.data?.sprites?.[si];
                const state_index = explosion_state(sprite);
                if (state_index >= 0)
                    system.impacts.spawn_sprite_index(si, x,
                        y - sprite.height / 2, time, { state_index });
                const strength = detonation.shake_strength ?? 0;
                const actor = game.player_character;
                if (strength > 0 && actor?.mesh && game.clock) {
                    const dist = Math.hypot(x - actor.mesh.position.x,
                        y - (actor.mesh.position.y + actor.sprite.height / 2));
                    const intensity = strength * Math.max(0, 1 - dist / (radius * 4));
                    if (intensity > 0) {
                        game.ts_camera_shake = game.clock.getElapsedTime();
                        game.camera_shake_strength = intensity;
                    }
                }
                return false;
            }
            if (bomb) return true;
            return motion_time < flight_limit;
        },
        stop,
    });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { register_projectile };

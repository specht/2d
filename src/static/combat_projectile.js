// Horizontal, pixel-grid projectile delivery. The combat system owns damage,
// target eligibility and cooldowns; this delivery owns only flight and collision.
function register_projectile(combat) {
    const RADIUS = 2; // Fixed collision half-size: student artwork cannot change hits.
    const overlaps = (a0, a1, b0, b1) => a0 <= b1 && b0 <= a1;

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

    // Return the earliest time along a horizontal segment at which a 4x4
    // projectile touches a rectangle. This avoids tunnelling at high speeds.
    function first_contact(from, to, y, rect) {
        if (!overlaps(y - RADIUS, y + RADIUS, rect.y0, rect.y1)) return null;
        const lo = rect.x0 - RADIUS;
        const hi = rect.x1 + RADIUS;
        if (from >= lo && from <= hi) return 0;
        const dx = to - from;
        if (dx > 0 && from < lo && to >= lo) return (lo - from) / dx;
        if (dx < 0 && from > hi && to <= hi) return (hi - from) / dx;
        return null;
    }

    function obstacle_contact(game, from, to, y) {
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
            const t = first_contact(from, to, y, rect);
            if (t !== null && (nearest === null || t < nearest)) nearest = t;
        }
        return nearest;
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
            instance.projectile_mesh.position.set(Math.round(instance.projectile_x),
                Math.round(instance.projectile_y - instance.projectile_height / 2), 2.5);
            game.scene.add(instance.projectile_mesh);
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
            const { range_px: range, speed_px_s: speed } = definition.delivery;
            return Number.isFinite(range) && range >= 1 && range <= 1000 &&
                Number.isFinite(speed) && speed >= 40 && speed <= 1200;
        },
        start(instance, system) {
            const owner = instance.owner;
            const aim = instance.aim?.x;
            instance.direction = aim === -1 || aim === 1 ? aim :
                (owner.last_horizontal_facing === 'left' ? -1 : 1);
            const bounds = character_bounds(owner);
            instance.projectile_x = instance.direction > 0 ? bounds.x1 + RADIUS : bounds.x0 - RADIUS;
            instance.projectile_y = owner.mesh.position.y + owner.sprite.height / 2;
            instance.projectile_start_x = instance.projectile_x;
            instance.projectile_traveled = 0;
            instance.expires_at = instance.started_at +
                instance.definition.delivery.range_px / instance.definition.delivery.speed_px_s + 1 / 60;
            render_projectile(instance, system);
        },
        step(instance, time, system) {
            const game = system.game;
            const { range_px: range, speed_px_s: speed } = instance.definition.delivery;
            const distance = Math.min(range, Math.max(0, (time - instance.started_at) * speed));
            if (distance <= instance.projectile_traveled) return distance < range;
            const from = instance.projectile_x;
            const to = instance.projectile_start_x + instance.direction * distance;
            let nearest = obstacle_contact(game, from, to, instance.projectile_y);
            let targetAt = null;
            const targets = instance.team === 'actor' ? game.baddies : [game.player_character];
            for (const target of targets) {
                if (!system.owner_is_alive(target)) continue;
                const t = first_contact(from, to, instance.projectile_y, character_bounds(target));
                if (t !== null && (nearest === null || t < nearest)) {
                    nearest = t;
                    targetAt = target;
                }
            }
            const at = nearest === null ? to : from + (to - from) * nearest;
            instance.projectile_x = at;
            instance.projectile_traveled = Math.abs(at - instance.projectile_start_x);
            if (instance.projectile_mesh) {
                instance.projectile_mesh.position.x = Math.round(at);
                if (instance.projectile_frames) {
                    const index = Math.floor((time - instance.started_at) * instance.projectile_fps) %
                        instance.projectile_frames.length;
                    instance.projectile_mesh.geometry = instance.projectile_frames[index].geometry;
                    instance.projectile_mesh.material = instance.projectile_frames[index].material;
                }
            }
            if (nearest !== null) {
                if (targetAt) system.apply_hit(instance, targetAt, time);
                return false; // Hit, invincible target, or solid obstacle: no piercing.
            }
            return distance < range;
        },
        stop,
    });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { register_projectile };

// A melee swing is one delivery, not a player-specific damage path.
// Optional character art will be layered onto the same instance later.
function register_swing(combat) {
    const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

    function bounds(character) {
        let x = character.mesh.position.x;
        let y = character.mesh.position.y;
        let w = character.sprite.width / 2;
        return {
            x0: x - w * (character.traits.ex_left ?? 1),
            x1: x + w * (character.traits.ex_right ?? 1),
            y0: y, y1: y + character.sprite.height * (character.traits.ex_top ?? 1),
        };
    }

    // This first delivery checks static collision shapes directly. Future
    // rays/projectiles can reuse a more general world obstacle query.
    function blocked(game, from, to, y) {
        for (let entry of game.active_level_sprites ?? []) {
            let sprite = game.data.sprites[entry.sprite_index];
            let traits = sprite?.traits ?? {};
            if (!(traits.block_sides || traits.block_above || traits.block_below ||
                (traits.door && entry.door_closed))) continue;
            let x = entry.mesh.position.x;
            let by = entry.mesh.position.y;
            if (y > by && y < by + sprite.height &&
                overlaps(Math.min(from, to), Math.max(from, to),
                    x - sprite.width / 2, x + sprite.width / 2)) return true;
        }
        return false;
    }

    // A small, angular crescent rather than a straight line. Rendering never
    // changes attack geometry, targets, damage or cooldowns.
    function draw_swoosh(instance, progress) {
        let mesh = instance.visual_mesh;
        if (!mesh) return;
        let vertices = mesh.geometry.attributes.position.array;
        let visual = instance.swoosh;
        // An unset visual length keeps the original M1b appearance for old games.
        let radius = visual.reach;
        let start_angle = -1.15 + progress * 1.85;
        let vertical = visual.sweep === 'down' ? -1 : 1;
        const segments = 8;
        for (let i = 0; i <= segments; i++) {
            let u = i / segments;
            let angle = start_angle + 0.85 * u;
            let thickness = 0.3 + 6 * Math.sin(Math.PI * u);
            for (let side = 0; side < 2; side++) {
                let r = radius - (side ? thickness : 0);
                let n = (2 * i + side) * 3;
                vertices[n] = visual.x + instance.direction * Math.cos(angle) * r;
                vertices[n + 1] = visual.y + vertical * Math.sin(angle) * r;
                vertices[n + 2] = 2;
            }
        }
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.material.opacity = 0.9 * Math.min(1, 0.25 + progress * 12) *
            Math.pow(1 - progress, 0.8);
    }

    function start_swoosh(instance, game, edge, y, range) {
        // An explicit "none" suppresses all procedural art. Old M1 definitions
        // with "slash" still show the upgraded effect; missing art uses it too.
        let kind = instance.definition.visual?.kind;
        if ((kind !== undefined && kind !== 'slash' && kind !== 'swoosh') ||
            typeof THREE === 'undefined' || !game.scene) return;
        let vertices = new Float32Array(18 * 3);
        let indices = [];
        for (let i = 0; i < 8; i++) {
            let a = 2 * i;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        let geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        let material = new THREE.MeshBasicMaterial({
            color: 0xffe7ac, transparent: true, opacity: 0.9,
            depthWrite: false, side: THREE.DoubleSide,
        });
        instance.visual_mesh = new THREE.Mesh(geometry, material);
        let options = instance.definition.visual ?? {};
        // Clamp malformed hand-edited JSON instead of making invalid geometry.
        let default_reach = Math.max(8, Math.min(range * 0.72, 38));
        let reach = Number.isFinite(options.reach_px) ?
            Math.max(8, Math.min(options.reach_px, 200)) : default_reach;
        instance.swoosh = {
            x: edge + instance.direction * Math.min(4, range * 0.1),
            y, reach,
            sweep: options.sweep === 'down' ? 'down' : 'up',
        };
        game.scene.add(instance.visual_mesh);
        draw_swoosh(instance, 0);
    }

    // Optional attack-owned artwork. The player's Angriff state is independent.
    // The slash plays even when no target is hit and never affects the hitbox.
    function spawn_attack_sprite(instance, system) {
        const si = instance.definition.visual?.attack_sprite_index;
        if (!Number.isInteger(si) || si < 0) return;
        const owner = instance.owner;
        const sprite = system.game.data?.sprites?.[si];
        if (!sprite || !system.impacts?.spawn_sprite_index) return;
        const dir = instance.direction;
        const reach = instance.definition.delivery.range_px;
        const offset = Math.max(
            Math.round(((owner.sprite.width ?? 0) + (sprite.width ?? 0)) / 4),
            Math.round(Math.min(20, Math.max(8, reach * 0.35))));
        system.impacts.spawn_sprite_index(si,
            owner.mesh.position.x + dir * offset,
            owner.mesh.position.y + owner.sprite.height / 2 - sprite.height / 2,
            instance.started_at, { mirror_x: dir < 0, z: 2.5 });
    }

    function clear_swoosh(instance, game) {
        let mesh = instance.visual_mesh;
        if (!mesh) return;
        game.scene?.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        instance.visual_mesh = null;
    }

    function stop(instance, system) {
        clear_swoosh(instance, system.game);
    }

    combat.register_delivery('swing', {
        validate(definition) {
            let range = definition.delivery.range_px;
            return Number.isFinite(range) && range > 0 && range <= 500;
        },
        start(instance, system) {
            let owner = instance.owner;
            let game = system.game;
            let dir = instance.aim?.x;
            // Keyboard melee remembers the last horizontal direction even
            // after jumping, climbing, or standing still.
            if (dir !== -1 && dir !== 1) dir = owner.last_horizontal_facing === 'left' ? -1 : 1;
            instance.direction = dir;
            instance.expires_at = instance.started_at + 0.15;
            let o = bounds(owner);
            let range = instance.definition.delivery.range_px;
            let edge = dir > 0 ? o.x1 : o.x0;
            let end = edge + dir * range;
            let y = o.y0 + (o.y1 - o.y0) * 0.5;
            let area = {
                x0: Math.min(edge, end), x1: Math.max(edge, end),
                y0: o.y0 + (o.y1 - o.y0) * 0.15,
                y1: o.y0 + (o.y1 - o.y0) * 0.85,
            };
            // Geometry is independent of both sprites' pictures or frames.
            let candidates = instance.team === 'actor' ? game.baddies : [game.player_character];
            for (let target of candidates) {
                if (!system.owner_is_alive(target)) continue;
                let t = bounds(target);
                if (!overlaps(area.x0, area.x1, t.x0, t.x1) ||
                    !overlaps(area.y0, area.y1, t.y0, t.y1)) continue;
                if (blocked(game, owner.mesh.position.x, target.mesh.position.x, y)) continue;
                system.apply_hit(instance, target, instance.started_at);
            }
            start_swoosh(instance, game, edge, y, range);
            spawn_attack_sprite(instance, system);
        },
        step(instance, time, system) {
            if (time >= instance.expires_at) return false;
            // Only the swing's own visual determines its 0.15 s lifetime.
            if (time >= instance.started_at + 0.15) {
                clear_swoosh(instance, system.game);
            } else if (instance.visual_mesh) {
                let progress = Math.max(0, Math.min(1,
                    (time - instance.started_at) / 0.15));
                draw_swoosh(instance, progress);
            }
            return true;
        },
        stop,
    });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { register_swing };

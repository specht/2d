// A sword swing is one delivery, not a player-specific damage path.
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

    function stop(instance, system) {
        let mesh = instance.visual_mesh;
        if (!mesh) return;
        system.game.scene?.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        instance.visual_mesh = null;
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
            // Automatic visual fallback: no weapon sprite or attack state needed.
            if (typeof THREE !== 'undefined' && game.scene) {
                let geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(edge, y - 4, 2),
                    new THREE.Vector3(end, y + 4, 2),
                ]);
                let material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
                instance.visual_mesh = new THREE.Line(geometry, material);
                game.scene.add(instance.visual_mesh);
            }
        },
        step(instance, time, system) {
            if (time < instance.expires_at) return true;
            return false;
        },
        stop,
    });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { register_swing };

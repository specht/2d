const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function sandbox() {
    const ctx = { console, crypto: require('node:crypto').webcrypto };
    vm.createContext(ctx);
    for (const f of ['game_ids.js', 'sprite_basket.js'])
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/static', f), 'utf8'), ctx, { filename: f });
    return ctx;
}

const frame = (src) => ({ src, tag: 'abc1234' });
const source = () => ({
    sprites: [
        { id: 's0', properties: { name: 'Pip mit Bogen' }, traits: { actor: { attacks: [{ visual: { projectile_sprite_id: 's1', hit_sprite_id: 's2' } }] } }, states: [{ frames: [frame('a')] }] },
        { id: 's1', properties: { name: 'Pfeil' }, traits: {}, states: [{ frames: [frame('b')] }] },
        { id: 's2', properties: { name: 'Funke' }, traits: {}, states: [{ frames: [frame('c')] }] },
        { id: 's3', traits: { baddie: { drop: { sprite_id: 's4', signal_code: 3 } } }, states: [{ frames: [frame('d')] }] },
        { id: 's4', traits: { key: {} }, states: [{ frames: [frame('e')] }] },
        { id: 's5', traits: {}, states: [{ frames: [frame('f')] }] },
    ],
});

test('what a sprite needs comes along, in the order of the other game', () => {
    const ctx = sandbox();
    const r = vm.runInContext('sprites_with_dependencies', ctx)(source(), ['s3', 's0']);
    assert.deepEqual([...r.ids], ['s0', 's1', 's2', 's3', 's4']);
    assert.deepEqual([...r.needed], ['s1', 's2', 's4']);
    const none = vm.runInContext('sprites_with_dependencies', ctx)(source(), ['s5']);
    assert.deepEqual([...none.ids], ['s5']);
    assert.deepEqual([...none.needed], []);
});

test('copies get new IDs and refer to each other; frames keep only their picture', () => {
    const ctx = sandbox();
    const target = { sprites: [{ id: 's0' }, { id: 's1' }] };   // same IDs as the other game
    const src = source();
    const copies = vm.runInContext('copy_sprites_for', ctx)(target, src.sprites.slice(0, 3), { drop_other_references: true });
    const ids = copies.map(c => c.id);
    assert.equal(new Set([...ids, 's0', 's1']).size, 5);
    const visual = copies[0].traits.actor.attacks[0].visual;
    assert.equal(visual.projectile_sprite_id, ids[1]);
    assert.equal(visual.hit_sprite_id, ids[2]);
    assert.deepEqual(JSON.parse(JSON.stringify(copies[1].states[0].frames)), [{ src: 'b' }]);
    // the other game is untouched
    assert.equal(src.sprites[0].id, 's0');
    assert.equal(src.sprites[0].traits.actor.attacks[0].visual.projectile_sprite_id, 's1');
});

test('a reference to a sprite that is not copied: kept in the same game, dropped from another', () => {
    const ctx = sandbox();
    const copy = vm.runInContext('copy_sprites_for', ctx);
    const src = source();
    const same = copy(src, [src.sprites[3]]);
    assert.equal(same[0].traits.baddie.drop.sprite_id, 's4');
    const other = copy({ sprites: [] }, [src.sprites[3]], { drop_other_references: true });
    assert.equal(other[0].traits.baddie.drop, undefined);
});

test('Sprite-Katalog: groups in their order, searched by Titel or group, empty groups left out', () => {
    const ctx = sandbox();
    const catalogue_groups = vm.runInContext('catalogue_groups', ctx);
    const file = {
        gruppen: [
            { name: 'Spielfiguren', sprites: ['s0'] },
            { name: 'Natur', sprites: ['s2', 's1', 'gone'] },
        ],
        spiel: { sprites: [
            { id: 's0', properties: { name: 'Pip' } },
            { id: 's1', properties: { name: 'Baum' } },
            { id: 's2', properties: { name: 'Busch' } },
        ] },
    };
    const names = (groups) => groups.map(g => `${g.name}: ${g.sprites.map(s => s.properties.name).join(',')}`);
    assert.deepEqual(names(catalogue_groups(file)), ['Spielfiguren: Pip', 'Natur: Busch,Baum']);
    assert.deepEqual(names(catalogue_groups(file, 'BAUM')), ['Natur: Baum']);
    // the group's name counts, every word must match
    assert.deepEqual(names(catalogue_groups(file, 'natur b')), ['Natur: Busch,Baum']);
    assert.deepEqual(names(catalogue_groups(file, 'pip natur')), []);
    assert.equal(catalogue_groups(null).length, 0);
});

// The catalogue the recipe build turns into katalog.json (rezepte/katalog.yaml)
test('Sprite-Katalog: every catalogue sprite is in one group, and everything in it is a multiple of 24 × 24', async (t) => {
    let YAML;
    try {
        const file = require('node:module').createRequire(path.join(__dirname, '../rezepte/tools/build.mjs')).resolve('yaml');
        const mod = await import(require('node:url').pathToFileURL(file));
        YAML = mod.default?.parse ? mod.default : mod;
    } catch { return t.skip('yaml not installed (rezepte/tools: npm install)'); }
    const katalog = YAML.parse(fs.readFileSync(path.join(__dirname, '../rezepte/katalog.yaml'), 'utf8'));
    const grouped = (katalog.sammlung ?? []).flatMap(group => Object.values(group)[0]);
    const left_out = katalog.nicht_in_sammlung ?? [];
    assert.equal(new Set(grouped).size, grouped.length, 'no sprite in two groups');
    assert.deepEqual([...grouped, ...left_out].sort(), Object.keys(katalog.sprites).sort());
    const size = (id) => katalog.sprites[id].groesse ?? (katalog.sprites[id].extends ? size(katalog.sprites[id].extends) : [24, 24]);
    const odd = grouped.filter(id => size(id).some(n => n % 24 !== 0));
    assert.deepEqual(odd, []);
    // the pictures have that size, too
    for (const id of grouped) {
        const [w, h] = size(id);
        for (const state of katalog.sprites[id].states ?? []) {
            const png = fs.readFileSync(path.join(__dirname, '../rezepte/sprites', `${state.strip}.png`));
            const pw = png.readUInt32BE(16), ph = png.readUInt32BE(20);
            assert.ok(ph === h && pw % w === 0, `${state.strip}.png is ${pw}×${ph}, ${id} is ${w}×${h}`);
        }
    }
});

test('the basket brings pictures only: states and frames, no Eigenschaften or roles', () => {
    const pictures_only = vm.runInContext('sprite_pictures_only', sandbox());
    const sprite = { id: 's1', properties: { name: 'Pip' }, traits: { actor: { vjump: 7 } },
        states: [{ properties: { name: 'stehen', fps: 3 }, traits: { actor: { right: {} } }, frames: [{ src: 'a' }, { src: 'b' }] }] };
    const copy = JSON.parse(JSON.stringify(pictures_only(sprite)));   // out of the sandbox's realm
    assert.deepEqual(copy.traits, {});
    assert.deepEqual(copy.states[0].traits, {});
    assert.deepEqual(copy.states[0].frames, [{ src: 'a' }, { src: 'b' }]);
    assert.equal(copy.states[0].properties.fps, 3);
    assert.equal(copy.properties.name, 'Pip');
    // the original is untouched
    assert.deepEqual(sprite.traits, { actor: { vjump: 7 } });
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// own_game.js extends Game; a minimal Game that "saves" like game.js does.
function sandbox(save_works) {
    const ctx = { crypto: require('node:crypto').webcrypto, $: () => ({ toggle() {} }), console };
    vm.createContext(ctx);
    vm.runInContext(`class Game {
        send_save(on_saved, on_failed) {
            this.sent = JSON.parse(JSON.stringify(this.data));
            if (${save_works}) { this.data.parent = 'neu1234'; on_saved('neu1234'); } else on_failed();
        }
        refresh_game_settings_controls() {}
    }`, ctx);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/static/own_game.js'), 'utf8'), ctx);
    return ctx;
}

test('lineage: ten random letters or digits, different every time', () => {
    const ctx = sandbox(true);
    const ids = new Set(Array.from({ length: 200 }, () => vm.runInContext('new_lineage_id()', ctx)));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.match(id, /^[0-9a-z]{10}$/);
});

test('a new title must really be new (case and spaces do not count)', () => {
    const { same_game_title } = sandbox(true);
    assert.equal(same_game_title(' pilzwald ', 'Pilzwald'), true);
    assert.equal(same_game_title('Pilz  wald', 'pilz wald'), true);
    assert.equal(same_game_title('Pilzwald 2', 'Pilzwald'), false);
    assert.equal(same_game_title('Pilzwald', ''), false);
});

test('saving as own game: no parent, a lineage, the new title and author', () => {
    const ctx = sandbox(true);
    vm.runInContext(`g = new Game(); g.data = { parent: 'alt1234', properties: { title: 'Pilzwald', author: 'Lena' }, sprites: [] };
        g.save_as_own_game('Max im Pilzwald', 'Max', (tag) => { saved = tag; });`, ctx);
    const sent = vm.runInContext('g.sent', ctx);
    assert.equal(sent.parent, null);
    assert.match(sent.lineage, /^[0-9a-z]{10}$/);
    assert.equal(sent.properties.title, 'Max im Pilzwald');
    assert.equal(sent.properties.author, 'Max');
    assert.equal(vm.runInContext('saved', ctx), 'neu1234');
    assert.equal(vm.runInContext('g.data.parent', ctx), 'neu1234');   // later saves continue the new game
});

test('if saving fails, the game stays the old one', () => {
    const ctx = sandbox(false);
    vm.runInContext(`g = new Game(); g.data = { parent: 'alt1234', properties: { title: 'Pilzwald', author: 'Lena' }, sprites: [] };
        g.save_as_own_game('Max im Pilzwald', 'Max', null, (reason) => { failed = reason; });`, ctx);
    assert.equal(vm.runInContext('failed', ctx), 'error');
    assert.equal(vm.runInContext('JSON.stringify(g.data)', ctx),
        JSON.stringify({ parent: 'alt1234', properties: { title: 'Pilzwald', author: 'Lena' }, sprites: [] }));
});

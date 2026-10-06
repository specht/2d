// The game frame loads one game after another (Spiel laden, Spielen): a game
// saved before it had properties must not break it for the next one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'static', 'app.js'), 'utf8');
function method(start, next) {
    const begin = source.indexOf(`\n\t${start}`);
    const end = source.indexOf(`\n\t${next}`, begin + 1);
    assert.ok(begin >= 0 && end > begin, `${start} found in app.js`);
    return source.slice(begin, end);
}

function make_game(files) {
    const jq = () => new Proxy({}, { get: (t, k) => (k === 'width' || k === 'height') ? () => 0 : () => jq() });
    const fetch = async (url) => {
        const name = url.replace(/^\/gen\//, '');
        if (!(name in files)) throw new SyntaxError(`no ${name}`);
        return { json: async () => JSON.parse(JSON.stringify(files[name])) };
    };
    // eslint-disable-next-line no-new-func
    const Game = new Function('$', 'fetch', 'window', 'first_level_index', 'promote_legacy_signals',
        'resolve_sprite_references_to_indices', 'load_youtube_api', 'OVERLAY_ICONS', 'speech_settings',
        `class Game {
            constructor() { this.data = null; this.curtain = { hide() {} }; }
            handle_resize() {} stop() {} render_start_screen() {} setup() {}
            ${method('reset() {', '// Is a key that means')}
            ${method('async load(tag) {', 'stop() {')}
        }
        return Game;`)(
        jq, fetch, { yt_player: null }, () => 0, () => {}, () => {}, () => {}, {}, () => ({}));
    return new Game();
}

const NEW = { properties: { title: 'Neu', lives_at_begin: 3, energy_at_begin: 70 }, sprites: [], levels: [{}] };
const OLD = { sprites: [], levels: [{}] };   // saved before December 2022
const SHEETS = { spritesheets: [], width: 1, height: 1 };

test('a game without properties loads, and the next game still starts', async () => {
    const game = make_game({ 'games/oldgame.json': OLD, 'spritesheets/oldgame.json': SHEETS,
        'games/newgame.json': NEW, 'spritesheets/newgame.json': SHEETS });
    game.reset();
    await game.load('oldgame');
    assert.deepEqual(game.data.properties, {});
    await game.load('newgame');
    game.reset();
    assert.equal(game.lives, 3);
    assert.equal(game.energy, 70);
});

test('a load that failed halfway does not break the next one', async () => {
    const game = make_game({ 'games/newgame.json': NEW, 'spritesheets/newgame.json': SHEETS });
    game.data = { sprites: [], levels: [] };   // what a failed load left behind
    await game.load('newgame');
    game.reset();
    assert.equal(game.lives, 3);
});

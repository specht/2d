// Dev helper: screenshot the studio's Hilfe tab with the recipe gallery.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const root = path.join(repo, 'src/static');
const out = process.argv[2] ?? 'preview';
const recipe = process.argv[3];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', e => console.log('pageerror:', e.message));
await p.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'studio.local') return r.abort();
    let f = path.join(root, u.pathname === '/' ? 'studio.html' : decodeURIComponent(u.pathname));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '{}' });
    let body = fs.readFileSync(f);
    if (f.endsWith('.html')) body = body.toString().replace(/#\{[^}]*\}/g, '');
    const ext = path.extname(f);
    r.fulfill({ status: 200, body, contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg' }[ext] ?? 'application/octet-stream' });
});
await p.goto('http://studio.local/');
await p.waitForTimeout(800);
await p.click('#mi_help'); if (process.env.CHIP) { await p.waitForTimeout(500); await p.click(`.rezept-chip:has-text("${process.env.CHIP}")`); }
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}-galerie.png` });
if (recipe) {
    await p.click(`.rezept-karte:has-text("${recipe}")`);
    await p.waitForTimeout(1000);
    await p.screenshot({ path: `${out}-rezept.png` });
    await p.evaluate(() => { document.getElementById('main_div_help').scrollTop += 700; });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}-rezept2.png` });
}
await b.close();

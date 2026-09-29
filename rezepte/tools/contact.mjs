// Dev helper: contact sheet of every Nth frame of a recording (WebP or GIF) -> PNG.
import sharp from 'sharp';
const [,, file, out, step = '6'] = process.argv;
const meta = await sharp(file, { animated: true }).metadata();
const n = meta.pages, h = meta.pageHeight, w = meta.width;
const picks = [];
for (let i = 0; i < n; i += Number(step)) picks.push(i);
const imgs = await Promise.all(picks.map(i => sharp(file, { page: i }).png().toBuffer()));
const cols = 4;
await sharp(imgs, { join: { across: cols, shim: 4, background: '#ff00ff' } }).png().toFile(out);
console.log(n, 'frames', w + 'x' + h, 'delays', meta.delay?.slice(0, 12).join(','));

// Films for the Erste-Schritte guides (anleitungen.mjs), played by the Hilfe
// tab (src/static/anleitung_film.js). An animated WebP can be neither paused
// nor wound to a moment; a film can, and stays lossless (the studio's text
// stays sharp):
//
//   film.json  { w, h, dauer, bilder: ['x-0.webp?v', …],
//                frames: [{ t, p: [[sheet, sx, sy, w, h, dx, dy], …] }, …],
//                zeitleiste: [{ t, nr, text, keys, maus }, …] }
//
// Frame 0 is the whole picture; every later frame only the rectangles that
// changed since the frame before. The player draws them in order on a canvas,
// so it shows frame n by drawing frames 0 … n (a few hundred drawImage calls:
// instant), and goes on from there while it plays. `t` is the frame's start
// in ms; a frame lasts until the next one starts, the last until `dauer`.
import sharp from 'sharp';
import { STEP_MS } from './record.mjs';

const TILE = 32;
const SHEET_WIDTH = 2048;
const SHEET_MAX_HEIGHT = 4096;

// identical consecutive frames are one frame that lasts longer
function distinct_frames(frames) {
    const out = [];
    frames.forEach((f, i) => {
        const last = out.at(-1);
        if (last && last.frame.data.equals(f.data)) last.steps++;
        else out.push({ frame: f, start: i, steps: 1 });
    });
    return out;
}

// the tiles that differ between two frames, merged into rectangles: runs of
// tiles in a row, and a run continues downwards while the next row has the
// same run
function changed_rects(a, b, w, h) {
    const cols = Math.ceil(w / TILE), rows = Math.ceil(h / TILE);
    const changed = (c, r) => {
        const x0 = c * TILE, x1 = Math.min(w, x0 + TILE), y1 = Math.min(h, (r + 1) * TILE);
        for (let y = r * TILE; y < y1; y++) {
            const o = (y * w + x0) * 4, n = (x1 - x0) * 4;
            if (a.compare(b, o, o + n, o, o + n) !== 0) return true;
        }
        return false;
    };
    const open = new Map();     // "c0:c1" → rect still growing downwards
    const rects = [];
    for (let r = 0; r < rows; r++) {
        const runs = [];
        for (let c = 0; c < cols; c++) {
            if (!changed(c, r)) continue;
            if (runs.length && runs.at(-1)[1] === c) runs.at(-1)[1] = c + 1;
            else runs.push([c, c + 1]);
        }
        const next = new Map();
        for (const [c0, c1] of runs) {
            const key = `${c0}:${c1}`;
            const rect = open.get(key);
            if (rect) { rect.r1 = r + 1; next.set(key, rect); }
            else { const nr = { c0, c1, r0: r, r1: r + 1 }; rects.push(nr); next.set(key, nr); }
        }
        open.clear();
        for (const [k, v] of next) open.set(k, v);
    }
    return rects.map(({ c0, c1, r0, r1 }) => {
        const x = c0 * TILE, y = r0 * TILE;
        return { x, y, w: Math.min(w, c1 * TILE) - x, h: Math.min(h, r1 * TILE) - y };
    });
}

// frames: one per 60 Hz step ({ w, h, data: RGBA }); timeline from the recorder.
// Returns the film (without its sheet URLs) and the sheets as WebP buffers.
export async function encode_film(frames, timeline = []) {
    const { w, h } = frames[0];
    if (w > SHEET_WIDTH) throw new Error(`Film zu breit (${w} px, höchstens ${SHEET_WIDTH})`);
    const list = distinct_frames(frames);
    // shelf packing in the order of the frames
    const sheets = [];
    let sheet = null;
    const new_sheet = () => { sheet = { x: 0, y: 0, row: 0, parts: [], height: 0 }; sheets.push(sheet); };
    const place = (rw, rh) => {
        if (!sheet) new_sheet();
        // the row is full: the next row
        if (sheet.x + rw > SHEET_WIDTH) { sheet.x = 0; sheet.y += sheet.row; sheet.row = 0; }
        // the sheet is full: the next sheet
        if (sheet.y + rh > SHEET_MAX_HEIGHT) new_sheet();
        const at = { sheet: sheets.length - 1, x: sheet.x, y: sheet.y };
        sheet.x += rw;
        sheet.row = Math.max(sheet.row, rh);
        sheet.height = Math.max(sheet.height, sheet.y + rh);
        return at;
    };
    const film_frames = [];
    let previous = null;
    for (const item of list) {
        const f = item.frame;
        const rects = previous ? changed_rects(previous.data, f.data, w, h) : [{ x: 0, y: 0, w, h }];
        const p = [];
        for (const r of rects) {
            const at = place(r.w, r.h);
            sheets[at.sheet].parts.push({ frame: f, r, at });
            p.push([at.sheet, at.x, at.y, r.w, r.h, r.x, r.y]);
        }
        film_frames.push({ t: Math.round(item.start * STEP_MS), p });
        previous = f;
    }
    const dauer = Math.round(frames.length * STEP_MS);
    const images = [];
    for (const s of sheets) {
        const height = Math.max(1, s.height);
        const raw = Buffer.alloc(SHEET_WIDTH * height * 4);
        for (const { frame, r, at } of s.parts)
            for (let y = 0; y < r.h; y++) {
                const from = ((r.y + y) * w + r.x) * 4;
                frame.data.copy(raw, ((at.y + y) * SHEET_WIDTH + at.x) * 4, from, from + r.w * 4);
            }
        // only as wide as used
        const used = Math.max(1, ...s.parts.map(q => q.at.x + q.r.w));
        images.push(await sharp(raw, { raw: { width: SHEET_WIDTH, height, channels: 4 } })
            .extract({ left: 0, top: 0, width: used, height })
            .webp({ lossless: true, effort: 5 }).toBuffer());
    }
    return { film: { w, h, dauer, frames: film_frames, zeitleiste: timeline }, images };
}

// The steps of a film (its numbered captions, in order), for the list beside
// it: [{ nr, text, mehr?, t }] – `mehr` is the longer explanation the list shows
// under the current step. A caption without a number (the film's title) is not a step.
export function film_steps(timeline) {
    const steps = [];
    let last = null;
    for (const e of timeline) {
        if (e.nr === null || e.nr === undefined || !e.text) continue;
        const key = `${e.nr}|${e.text}`;
        if (key === last) continue;
        last = key;
        steps.push({ nr: e.nr, text: e.text, ...(e.mehr ? { mehr: e.mehr } : {}), t: e.t });
    }
    return steps;
}

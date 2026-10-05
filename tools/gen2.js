// Entwurfshilfe 2: würfelt ganze Räume (Wände, Lampe, Kristalle, Dinge) und zeigt die kniffligsten.
//
//   gjs -m tools/gen2.js B x H 'zutaten' [versuche] [seed]
//   zutaten: Zeichen aus levels.txt, z. B. '**//\\B~~~' – Lampe und Spieler kommen automatisch dazu.
//   Umgebung: WALLS=0.18 (Wanddichte), MAXPAR=45, TOP=6, LIMIT=120000
import GLib from 'gi://GLib';
import { Core, solve, reconstruct, setLimit } from './lib.js';

const [Wa, Ha, stuff, triesArg, seedArg] = ARGV;
const W = Number(Wa), H = Number(Ha), tries = Number(triesArg || 3000);
let seed = (Number(seedArg || 1) * 2654435761) >>> 0 || 1;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const walls = Number(GLib.getenv('WALLS') || 0.18);
const maxPar = Number(GLib.getenv('MAXPAR') || 45);
setLimit(Number(GLib.getenv('LIMIT') || 120000));

const found = [], seen = new Set();
let solvable = 0;
for (let n = 0; n < tries; n++) {
  const g = [];
  for (let y = 0; y < H; y++) {
    g.push([]);
    for (let x = 0; x < W; x++) g[y].push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? '#' : rnd() < walls ? '#' : '.');
  }
  const free = () => {
    for (let k = 0; k < 200; k++) {
      const x = 1 + ((rnd() * (W - 2)) | 0), y = 1 + ((rnd() * (H - 2)) | 0);
      if (g[y][x] === '.') return [x, y];
    }
    return null;
  };
  // Lampe an einer Wand, Blick ins Innere
  const side = (rnd() * 4) | 0;
  let lx, ly, lc;
  if (side === 0) { lx = 1; ly = 1 + ((rnd() * (H - 2)) | 0); lc = '>'; }
  else if (side === 1) { lx = W - 2; ly = 1 + ((rnd() * (H - 2)) | 0); lc = '<'; }
  else if (side === 2) { ly = 1; lx = 1 + ((rnd() * (W - 2)) | 0); lc = 'v'; }
  else { ly = H - 2; lx = 1 + ((rnd() * (W - 2)) | 0); lc = '^'; }
  g[ly][lx] = lc;
  let ok = true;
  for (const ch of stuff + 'P') {
    const p = free();
    if (!p) { ok = false; break; }
    g[p[1]][p[0]] = ch;
  }
  if (!ok) continue;
  const text = g.map((r) => r.join('')).join('\n');
  if (seen.has(text)) continue;
  seen.add(text);
  let lv;
  try { lv = Core.parseLevels('@level g\n' + text + '\n')[0]; } catch (e) { continue; }
  const res = solve(lv);
  if (res.error) continue;
  solvable++;
  const { moves, steps } = reconstruct(lv, res);
  const where = new Map(), moved = new Set();
  let movable = 0;
  for (let i = 0; i < lv.o.length; i++) if (Core.isPushable(lv.o[i]) || Core.isRotator(lv.o[i])) { where.set(i, i); movable++; }
  for (const s of steps) {
    const e = s.ev, from = e.objFrom ?? e.at;
    for (const [start, pos] of where) if (pos === from) { moved.add(start); if (e.objTo !== undefined) where.set(start, e.kind === 'sink' ? -1 : e.objTo); }
  }
  const sinks = steps.filter((s) => s.ev.kind === 'sink').length;
  const score = Math.log2(res.expanded + 1) * 4 + steps.length * 1.2 + moved.size * 4 + sinks * 2
    - Math.max(0, moves.length - maxPar) * 1.5 - (movable - moved.size) * 8;
  found.push({ text, par: moves.length, pushes: steps.length, used: moved.size + '/' + movable, states: res.expanded, score, moves });
}
found.sort((a, b) => b.score - a.score);
print(`${solvable} lösbar von ${seen.size}\n`);
for (const f of found.slice(0, Number(GLib.getenv('TOP') || 6))) {
  print(`score ${f.score.toFixed(1)}  par ${f.par}  schübe ${f.pushes}  benutzt ${f.used}  zustände ${f.states}\n${f.text}\n${f.moves}\n`);
}

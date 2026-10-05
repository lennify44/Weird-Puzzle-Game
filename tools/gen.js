// Entwurfshilfe: verteilt bewegliche Dinge zufällig auf einer Vorlage, löst jede Variante
// und zeigt die interessantesten. Die Vorlage legt Wände, Lampen, Kristalle usw. fest;
// "?" markiert Felder, auf denen Dinge landen dürfen (ohne "?" jedes freie Bodenfeld).
// Fehlt "P", wird auch der Spieler zufällig gesetzt.
//
//   gjs -m tools/gen.js vorlage.txt '//\B' [versuche] [seed]
import GLib from 'gi://GLib';
import { Core, solve, reconstruct, draw, setLimit } from './lib.js';

const [file, objs, triesArg, seedArg] = ARGV;
const tpl = new TextDecoder().decode(GLib.file_get_contents(file)[1]).replace(/\n+$/, '').split('\n');
const tries = Number(triesArg || 2000);
let seed = Number(seedArg || 1);
seed = (seed * 2654435761) >>> 0 || 1;
const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
setLimit(Number(GLib.getenv('LIMIT') || 150000));

const cells = [];
let hasMarks = tpl.some((r) => r.includes('?'));
tpl.forEach((r, y) => [...r].forEach((c, x) => { if (c === '?' || (!hasMarks && c === '.')) cells.push([x, y]); }));
const needPlayer = !tpl.some((r) => r.includes('P'));
const seen = new Set(), found = [];

for (let n = 0; n < tries; n++) {
  const rows = tpl.map((r) => [...r]);
  const pool = cells.slice();
  const put = (ch) => { const j = (rnd() * pool.length) | 0; const [x, y] = pool.splice(j, 1)[0]; rows[y][x] = ch; };
  for (const ch of objs.replace('-', '')) put(ch);
  // "%" in der Vorlage = Drehspiegel mit zufälliger Startrichtung
  for (const r of rows) for (let x = 0; x < r.length; x++) if (r[x] === '%') r[x] = rnd() < 0.5 ? 'r' : 'R';
  if (needPlayer) put('P');
  const text = rows.map((r) => r.join('').replace(/\?/g, '.')).join('\n');
  if (seen.has(text)) continue;
  seen.add(text);
  let lv;
  try { lv = Core.parseLevels('@level g\n' + text + '\n')[0]; } catch (e) { continue; }
  const res = solve(lv);
  if (res.error) continue;
  const { moves, steps } = reconstruct(lv, res);
  const moved = new Set();
  // welche Dinge wurden bewegt? (über ihre Startposition verfolgt)
  const where = new Map();
  for (let i = 0; i < lv.o.length; i++) if (Core.isPushable(lv.o[i]) || Core.isRotator(lv.o[i])) where.set(i, i);
  for (const s of steps) {
    const e = s.ev;
    const from = e.objFrom ?? e.at;
    for (const [start, pos] of where) if (pos === from) { moved.add(start); if (e.objTo !== undefined) where.set(start, e.kind === 'sink' ? -1 : e.objTo); }
  }
  // Gute Rätsel: alle Dinge werden gebraucht, die Suche ist groß, die Lösung aber nicht endlos.
  const score = Math.log2(res.expanded + 1) * 4 + steps.length * 1.5 + moved.size * 4
    - Math.max(0, moves.length - Number(GLib.getenv('MAXPAR') || 45)) * 1.5
    - (moved.size < objs.replace('-', '').length ? 15 : 0);
  found.push({ text, par: moves.length, pushes: steps.length, used: moved.size, states: res.expanded, score, moves });
}

found.sort((a, b) => b.score - a.score);
print(`${found.length} lösbare von ${seen.size} Varianten\n`);
for (const f of found.slice(0, Number(GLib.getenv('TOP') || 6))) {
  print(`score ${f.score.toFixed(1)}  par ${f.par}  schübe ${f.pushes}  benutzt ${f.used}  zustände ${f.states}\n${f.text}\n${f.moves}\n`);
}

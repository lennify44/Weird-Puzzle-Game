// Löser: beweist für jedes Level, dass es lösbar ist, und findet die kürzeste Lösung
// (Anzahl Züge = "Par").
//
//   gjs -m tools/solve.js                 alle Level, schreibt tools/solutions.json
//   gjs -m tools/solve.js 3-2 3-4         nur diese Level, mit Zugfolge und Endstellung
//   VERBOSE=1 gjs -m tools/solve.js ...   zeigt jeden Schub der Lösung als Karte
import GLib from 'gi://GLib';
import System from 'system';
import { ROOT, read, Core, solve, reconstruct, replay, draw } from './lib.js';

const levels = Core.parseLevels(read('src/levels.txt'));
const only = ARGV.length ? ARGV : null;
const verbose = !!GLib.getenv('VERBOSE');
const results = {};
let bad = 0;
const t0 = Date.now();
for (const lv of levels) {
  if (only && !only.includes(lv.id)) continue;
  const t = Date.now();
  const res = solve(lv);
  const ms = Date.now() - t;
  if (res.error) {
    bad++;
    print(`${lv.id.padEnd(5)} FEHLER: ${res.error}  (${lv.name.de})`);
    continue;
  }
  const { moves, steps } = reconstruct(lv, res);
  const ok = replay(lv, moves);
  if (!ok || moves.length !== res.cost) { bad++; print(`${lv.id} FEHLER: Nachspielen fehlgeschlagen`); continue; }
  results[lv.id] = { par: moves.length, pushes: steps.length, states: res.expanded, moves };
  print(`${lv.id.padEnd(5)} par ${String(moves.length).padStart(3)}  schübe ${String(steps.length).padStart(2)}  zustände ${String(res.expanded).padStart(8)}  ${String(ms).padStart(6)}ms  ${lv.name.de}`);
  if (only) {
    print('   ' + moves);
    if (verbose) {
      print(draw(lv, Core.initState(lv)));
      for (const s of steps) print(`   ${s.ev.kind} ${s.ev.objFrom ?? s.ev.at} -> ${s.ev.objTo ?? ''}\n` + draw(lv, s.st));
    } else {
      print(draw(lv, steps[steps.length - 1].st));
    }
  }
}
if (!only) {
  GLib.file_set_contents(ROOT + '/tools/solutions.json', JSON.stringify(results, null, 1));
  print(`\n${Object.keys(results).length} Level gelöst, ${bad} Fehler, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
if (bad) System.exit(1);

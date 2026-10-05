// Spielt eine Zugfolge nach und zeigt die Karte: gjs -m tools/play.js 2-6 RRDD...
import { Core, read, draw, LETTERS } from './lib.js';
const [id, moves = ''] = ARGV;
const lv = Core.parseLevels(read('src/levels.txt')).find((l) => l.id === id);
let st = Core.initState(lv), n = 0;
for (const ch of moves) {
  const r = Core.step(lv, st, Core.trace(lv, st), LETTERS.indexOf(ch));
  if (!r || !r.st) { print(`Zug ${n + 1} (${ch}) geht nicht`); break; }
  st = r.st; n++;
}
print(draw(lv, st));
print(Core.trace(lv, st).win ? 'gelöst' : 'nicht gelöst');

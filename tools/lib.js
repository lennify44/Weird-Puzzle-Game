// Gemeinsamer Teil der Werkzeuge: lädt src/core.js – dieselben Regeln und derselbe Löser wie im Spiel.
import GLib from 'gi://GLib';

export const ROOT = GLib.path_get_dirname(GLib.path_get_dirname(GLib.filename_from_uri(import.meta.url)[0]));
export const read = (p) => new TextDecoder().decode(GLib.file_get_contents(ROOT + '/' + p)[1]);
export const Core = new Function(read('src/core.js') + '\nreturn Core;')();

export let LIMIT = Number(GLib.getenv('LIMIT') || 4000000);
export function setLimit(n) { LIMIT = n; }
export const LETTERS = 'URDL';

export const key = (st) => Core.stateKey(st);
export const walkRegion = (lv, st, beam) => Core.walkRegion(lv, st, beam);

const ERR = { solved: 'startet bereits gelöst', unsolvable: 'unlösbar', limit: 'Zustandslimit erreicht' };
export function solve(lv) {
  const r = Core.solve(lv, Core.initState(lv), LIMIT);
  if (r.error) return { error: ERR[r.error] + (r.error === 'limit' ? ' (' + LIMIT + ')' : ''), expanded: r.expanded };
  return { ...r, cost: r.moves.length };
}
export const reconstruct = (lv, res) => ({ moves: res.moves, steps: res.steps });

// Prüft die Zugfolge noch einmal Zug für Zug mit Core.step – so wie das Spiel sie ausführt.
export function replay(lv, moves) {
  let st = Core.initState(lv);
  for (const ch of moves) {
    const r = Core.step(lv, st, Core.trace(lv, st), LETTERS.indexOf(ch));
    if (!r || !r.st) return false;
    st = r.st;
  }
  return Core.trace(lv, st).win;
}

const CH = {};
CH[Core.CRATE] = 'B'; CH[Core.MIRROR_S] = '/'; CH[Core.MIRROR_B] = '\\'; CH[Core.SPLIT_S] = 's'; CH[Core.SPLIT_B] = 'S';
CH[Core.ROT_S] = 'r'; CH[Core.ROT_B] = 'R'; CH[Core.FIX_S] = 'f'; CH[Core.FIX_B] = 'F'; CH[Core.CRYSTAL] = '*';
CH[Core.SRC_N] = '^'; CH[Core.SRC_E] = '>'; CH[Core.SRC_S] = 'v'; CH[Core.SRC_W] = '<';
export function draw(lv, st) {
  const beam = Core.trace(lv, st);
  let out = '';
  for (let y = 0; y < lv.h; y++) {
    let row = '';
    for (let x = 0; x < lv.w; x++) {
      const i = y * lv.w + x, t = st.t[i], k = st.o[i];
      if (i === st.p) row += 'P';
      else if (k) row += k === Core.CRYSTAL && beam.lit[i] ? '@' : CH[k];
      else if (t === Core.WALL) row += '#';
      else if (t === Core.VOID) row += ' ';
      else if (t === Core.WATER) row += '~';
      else if (t === Core.CHASM) row += beam.seg[i] ? '=' : '_';
      else if (t === Core.FILLED) row += 'o';
      else row += beam.seg[i] ? ((beam.seg[i] & 5) && (beam.seg[i] & 10) ? '+' : (beam.seg[i] & 5) ? '|' : '-') : '.';
    }
    out += '   ' + row + '\n';
  }
  return out;
}


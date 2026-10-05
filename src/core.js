// Leuchtfeuer – Spielregeln. Wird vom Spiel UND vom Löser (tools/solve.js) benutzt,
// damit jedes Level mit exakt denselben Regeln geprüft wird, mit denen man es spielt.
var Core = (function () {
  'use strict';

  // Böden
  const FLOOR = 0, WALL = 1, WATER = 2, CHASM = 3, VOID = 4, FILLED = 5;
  // Dinge (eine Ebene über dem Boden)
  const NONE = 0, CRATE = 1, MIRROR_S = 2, MIRROR_B = 3, SPLIT_S = 4, SPLIT_B = 5,
    ROT_S = 6, ROT_B = 7, FIX_S = 8, FIX_B = 9, CRYSTAL = 10,
    SRC_N = 12, SRC_E = 13, SRC_S = 14, SRC_W = 15;

  // Richtungen: 0 = hoch, 1 = rechts, 2 = runter, 3 = links
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const REF_S = [1, 0, 3, 2]; // Spiegel "/"
  const REF_B = [3, 2, 1, 0]; // Spiegel "\"

  const TILE_CHARS = { '#': WALL, '.': FLOOR, ' ': VOID, '~': WATER, '_': CHASM };
  const THING_CHARS = {
    'B': CRATE, '/': MIRROR_S, '\\': MIRROR_B, 's': SPLIT_S, 'S': SPLIT_B,
    'r': ROT_S, 'R': ROT_B, 'f': FIX_S, 'F': FIX_B, '*': CRYSTAL,
    '^': SRC_N, '>': SRC_E, 'v': SRC_S, '<': SRC_W,
  };

  const isPushable = (k) => k >= CRATE && k <= SPLIT_B;
  const isRotator = (k) => k === ROT_S || k === ROT_B;
  const isSource = (k) => k >= SRC_N && k <= SRC_W;
  const isSlash = (k) => k === MIRROR_S || k === SPLIT_S || k === ROT_S || k === FIX_S;
  const isMirrorLike = (k) => k >= MIRROR_S && k <= FIX_B;
  const isSplitter = (k) => k === SPLIT_S || k === SPLIT_B;

  function parseLevels(text) {
    const levels = [];
    let cur = null;
    const finish = () => {
      if (!cur) return;
      if (!cur.rows.length) throw new Error('Level ' + cur.id + ' hat keine Karte');
      levels.push(build(cur));
      cur = null;
    };
    for (const raw of text.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (line.startsWith(';')) continue;
      if (line.startsWith('@level')) { finish(); cur = { id: line.slice(6).trim(), name: null, hint: null, rows: [] }; continue; }
      if (!cur) { if (line.trim()) throw new Error('Text außerhalb eines Levels: ' + line); continue; }
      if (line.startsWith('@name')) { cur.name = splitLang(line.slice(5)); continue; }
      if (line.startsWith('@hint')) { cur.hint = splitLang(line.slice(5)); continue; }
      if (!line.trim()) { if (cur.rows.length) finish(); continue; }
      cur.rows.push(line);
    }
    finish();
    return levels;
  }

  function splitLang(s) {
    const [en, de] = s.split('|').map((x) => x.trim());
    return { en: en, de: de || en };
  }

  function build(def) {
    const h = def.rows.length;
    const w = Math.max(...def.rows.map((r) => r.length));
    const tiles = new Uint8Array(w * h), o = new Uint8Array(w * h);
    let p = -1;
    const sources = [], crystals = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const c = def.rows[y][x] === undefined ? ' ' : def.rows[y][x];
        const i = y * w + x;
        if (c in TILE_CHARS) { tiles[i] = TILE_CHARS[c]; continue; }
        tiles[i] = FLOOR;
        if (c === 'P') { if (p >= 0) throw new Error(def.id + ': zwei Spieler'); p = i; continue; }
        if (!(c in THING_CHARS)) throw new Error(def.id + ': unbekanntes Zeichen "' + c + '"');
        const k = THING_CHARS[c];
        o[i] = k;
        if (isSource(k)) sources.push(i);
        if (k === CRYSTAL) crystals.push(i);
      }
    }
    // Wände, die keine begehbare Fläche berühren (auch nicht diagonal), werden zu offenem Meer.
    // Eine Wandschicht bleibt immer stehen, deshalb ändert das nichts an den Regeln.
    const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || tiles[y * w + x] === WALL || tiles[y * w + x] === VOID;
    const outer = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (tiles[y * w + x] !== WALL) continue;
      let inner = false;
      for (let dy = -1; dy <= 1 && !inner; dy++) for (let dx = -1; dx <= 1; dx++) if (!solid(x + dx, y + dy)) { inner = true; break; }
      if (!inner) outer.push(y * w + x);
    }
    for (const i of outer) tiles[i] = VOID;
    if (p < 0) throw new Error(def.id + ': kein Spieler');
    if (!sources.length) throw new Error(def.id + ': keine Lampe');
    if (!crystals.length) throw new Error(def.id + ': kein Kristall');
    return { id: def.id, name: def.name || { en: def.id, de: def.id }, hint: def.hint, w, h, tiles, o, p, sources, crystals, rows: def.rows };
  }

  function initState(lv) {
    return { t: lv.tiles.slice(), o: lv.o.slice(), p: lv.p };
  }

  function copyState(st) {
    return { t: st.t.slice(), o: st.o.slice(), p: st.p };
  }

  // Verfolgt alle Strahlen. seg[i] hat Bit d gesetzt, wenn in Zelle i ein Strahl
  // von der Mitte zur Seite d läuft. hits = Stellen, an denen ein Strahl abprallt,
  // escapes = Strahlen, die den Rand der Karte verlassen.
  function trace(lv, st) {
    const w = lv.w, h = lv.h, n = w * h;
    const seg = new Uint8Array(n), vis = new Uint8Array(n), lit = new Uint8Array(n);
    const hits = [], escapes = [];
    const stack = [];
    for (const s of lv.sources) {
      const d = st.o[s] - SRC_N;
      seg[s] |= 1 << d;
      stack.push(s, d);
    }
    while (stack.length) {
      const d = stack.pop(), c = stack.pop();
      const x = (c % w) + DX[d], y = ((c / w) | 0) + DY[d];
      if (x < 0 || y < 0 || x >= w || y >= h) { escapes.push(c, d); continue; }
      const i = y * w + x;
      if (vis[i] & (1 << d)) continue;
      vis[i] |= 1 << d;
      if (st.t[i] === WALL) { hits.push(c, d); continue; }
      const k = st.o[i];
      const inBit = 1 << ((d + 2) & 3);
      if (k === NONE || k === CRYSTAL) {
        if (k === CRYSTAL) lit[i] = 1;
        seg[i] |= inBit | (1 << d);
        stack.push(i, d);
      } else if (k === CRATE || isSource(k)) {
        hits.push(c, d);
      } else {
        const r = isSlash(k) ? REF_S[d] : REF_B[d];
        seg[i] |= inBit | (1 << r);
        stack.push(i, r);
        if (isSplitter(k)) { seg[i] |= 1 << d; stack.push(i, d); }
      }
    }
    let litCount = 0;
    for (const c of lv.crystals) if (lit[c]) litCount++;
    return { seg, lit, hits, escapes, litCount, total: lv.crystals.length, win: litCount === lv.crystals.length };
  }

  // Darf der Spieler auf Zelle i stehen? Lichtbrücken: Abgrund nur, solange Licht darüber läuft.
  function standable(st, beam, i) {
    if (st.o[i] !== NONE) return false;
    const t = st.t[i];
    if (t === FLOOR || t === FILLED) return true;
    return t === CHASM && beam.seg[i] !== 0;
  }

  // Ein Zug. Gibt null zurück, wenn er nicht geht (dann zählt er auch nicht),
  // sonst { st: neuer Zustand, ev: was passiert ist }.
  function step(lv, st, beam, d) {
    const w = lv.w, p = st.p;
    const x = (p % w) + DX[d], y = ((p / w) | 0) + DY[d];
    if (x < 0 || y < 0 || x >= w || y >= lv.h) return null;
    const n = y * w + x, k = st.o[n];
    if (k === NONE) {
      if (!standable(st, beam, n)) return null;
      const ns = { t: st.t, o: st.o, p: n };
      return { st: ns, ev: { kind: 'walk', from: p, to: n, d } };
    }
    if (isPushable(k)) {
      const tx = x + DX[d], ty = y + DY[d];
      if (tx < 0 || ty < 0 || tx >= w || ty >= lv.h) return null;
      const t = ty * w + tx;
      if (st.o[t] !== NONE) return null;
      const tt = st.t[t];
      if (tt === FLOOR || tt === FILLED) {
        const o = st.o.slice();
        o[t] = k; o[n] = NONE;
        return { st: { t: st.t, o, p: n }, ev: { kind: 'push', from: p, to: n, objFrom: n, objTo: t, thing: k, d } };
      }
      if (tt === WATER) {
        const o = st.o.slice(), tl = st.t.slice();
        o[n] = NONE; tl[t] = FILLED;
        return { st: { t: tl, o, p: n }, ev: { kind: 'sink', from: p, to: n, objFrom: n, objTo: t, thing: k, d } };
      }
      return null;
    }
    if (isRotator(k)) {
      const o = st.o.slice();
      o[n] = k === ROT_S ? ROT_B : ROT_S;
      const ns = { t: st.t, o, p };
      // Steht der Spieler auf einer Lichtbrücke, die durch das Drehen verschwände, klemmt der Spiegel.
      if (st.t[p] === CHASM && trace(lv, ns).seg[p] === 0) return { st: null, ev: { kind: 'jam', at: n, d } };
      return { st: ns, ev: { kind: 'rotate', at: n, from: k, to: o[n], d } };
    }
    return null;
  }


  // ---- Löser (Dijkstra über Schübe; Kosten = Anzahl Züge). Wird von tools/ und vom Tipp im Spiel benutzt.

  function stateKey(st) {
    // Spielerposition + alle beweglichen/drehbaren Dinge + aufgefüllte Wasserfelder
    let s = String.fromCharCode(st.p);
    const o = st.o, t = st.t;
    for (let i = 0; i < o.length; i++) {
      const k = o[i];
      if (k !== NONE && k < FIX_S) s += String.fromCharCode(i, k);
      if (t[i] === FILLED) s += String.fromCharCode(i, 99);
    }
    return s;
  }

  function walkRegion(lv, st, beam) {
    const n = lv.w * lv.h, dist = new Int32Array(n).fill(-1), prev = new Int32Array(n).fill(-1);
    const q = [st.p];
    dist[st.p] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const c = q[qi], x = c % lv.w, y = (c / lv.w) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= lv.w || ny >= lv.h) continue;
        const i = ny * lv.w + nx;
        if (dist[i] >= 0 || !standable(st, beam, i)) continue;
        dist[i] = dist[c] + 1; prev[i] = c; q.push(i);
      }
    }
    return { dist, prev, cells: q };
  }

  function heapPush(a, c, v) {
    a.push([c, v]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; const tmp = a[p]; a[p] = a[i]; a[i] = tmp; i = p; }
  }
  function heapPop(a) {
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        const tmp = a[m]; a[m] = a[i]; a[i] = tmp; i = m;
      }
    }
    return top;
  }

  // Kürzeste Lösung ab Zustand st0. Ergebnis: { moves: 'URDL…', steps: [{ev, st}], expanded }
  // oder { error: 'solved' | 'unsolvable' | 'limit', expanded }.
  function solve(lv, st0, limit) {
    limit = limit || 4000000;
    if (trace(lv, st0).win) return { error: 'solved', expanded: 0 };
    const nodes = new Map(), heap = [];
    const k0 = stateKey(st0);
    nodes.set(k0, { st: st0, cost: 0, parent: null, from: -1, d: -1, done: false });
    heapPush(heap, 0, k0);
    let expanded = 0, goal = null;
    while (heap.length) {
      const top = heapPop(heap), cost = top[0], k = top[1];
      const node = nodes.get(k);
      if (node.done || node.cost < cost) continue;
      node.done = true;
      if (++expanded > limit) return { error: 'limit', expanded };
      const beam = trace(lv, node.st);
      if (beam.win) { goal = node; break; }
      const reg = walkRegion(lv, node.st, beam);
      for (const c of reg.cells) {
        const at = { t: node.st.t, o: node.st.o, p: c };
        for (let d = 0; d < 4; d++) {
          const r = step(lv, at, beam, d);
          if (!r || !r.st || r.ev.kind === 'walk') continue;
          const nk = stateKey(r.st), nc = cost + reg.dist[c] + 1;
          const old = nodes.get(nk);
          if (old && old.cost <= nc) continue;
          nodes.set(nk, { st: r.st, cost: nc, parent: k, from: c, d, done: false, ev: r.ev });
          heapPush(heap, nc, nk);
        }
      }
    }
    if (!goal) return { error: 'unsolvable', expanded };
    const chain = [];
    for (let n = goal; n.parent !== null; n = nodes.get(n.parent)) chain.push(n);
    chain.reverse();
    let moves = '', prevSt = st0;
    const steps = [];
    for (const n of chain) {
      const reg = walkRegion(lv, prevSt, trace(lv, prevSt));
      const path = [];
      for (let c = n.from; c !== prevSt.p; c = reg.prev[c]) path.push(c);
      path.push(prevSt.p);
      path.reverse();
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        moves += 'URDL'[b === a - lv.w ? 0 : b === a + 1 ? 1 : b === a + lv.w ? 2 : 3];
      }
      moves += 'URDL'[n.d];
      steps.push({ ev: n.ev, st: n.st, from: n.from });
      prevSt = n.st;
    }
    return { moves, steps, expanded };
  }

  return {
    FLOOR, WALL, WATER, CHASM, VOID, FILLED,
    NONE, CRATE, MIRROR_S, MIRROR_B, SPLIT_S, SPLIT_B, ROT_S, ROT_B, FIX_S, FIX_B, CRYSTAL,
    SRC_N, SRC_E, SRC_S, SRC_W, DX, DY,
    isPushable, isRotator, isSource, isSlash, isMirrorLike, isSplitter,
    parseLevels, initState, copyState, trace, standable, step, solve, walkRegion, stateKey,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;

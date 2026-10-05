#!/usr/bin/env python3
"""Spielt jedes Level im echten Spiel (headless Firefox) mit der Lösung des Lösers durch:
Tastendrücke gehen durch dieselbe Eingabe wie beim Spielen. Prüft danach den Spielfluss
(Gewinnfenster, Freischalten, Seekarte, Abspann) und speichert Bildschirmfotos.

  tests/run.sh               alles
  tests/run.sh shots         nur Bildschirmfotos (nach tests/shots/)"""
import json, pathlib, sys, time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

root = pathlib.Path(__file__).resolve().parent.parent
sols = json.loads((root / 'tools' / 'solutions.json').read_text())
shots = root / 'tests' / 'shots'
shots.mkdir(exist_ok=True)
KEYS = {'U': 'ArrowUp', 'R': 'ArrowRight', 'D': 'ArrowDown', 'L': 'ArrowLeft'}

def browser(w, h):
    o = Options()
    o.add_argument('-headless')
    o.set_preference('media.autoplay.default', 0)
    d = webdriver.Firefox(options=o)
    d.set_window_size(w, h)
    return d

def errors(d):
    return d.execute_script('return window.__errors || []')

def load(d):
    d.get((root / 'index.html').as_uri() + '#test')
    d.execute_script("window.__errors=[];window.addEventListener('error',e=>window.__errors.push(String(e.message)));")
    time.sleep(0.8)

failed = []
mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
d = browser(1280, 800)
try:
    load(d)
    js = lambda s, *a: d.execute_script(s, *a)
    if mode in ('all', 'play'):
        ids = js('return __lf.levels')
        for i, lid in enumerate(ids):
            js('localStorage.clear(); __lf.start(arguments[0])', i)
            for ch in sols[lid]['moves']:
                js('__lf.key(arguments[0])', KEYS[ch])
            st = js('return __lf.state()')
            ok = st['won'] and st['moves'] == sols[lid]['par']
            print(f"{lid:5} {'ok ' if ok else 'FEHLER'} moves {st['moves']} lit {st['lit']}/{st['total']}")
            if not ok: failed.append(lid)
        # undo/restart smoke test on level 1
        js('__lf.start(0)')
        for c in 'ArrowUp ArrowUp KeyZ KeyZ KeyR'.split(): js('__lf.key(arguments[0])', c)
        st = js('return __lf.state()')
        if st['moves'] != 0: failed.append('undo/restart'); print('undo/restart FEHLER', st)
        # Tipp: zeigt den nächsten Schub, zweites H führt ihn aus
        i5 = ids.index('1-5')
        js('__lf.start(arguments[0])', i5)
        js('__lf.key("KeyH")')
        for _ in range(50):
            time.sleep(0.1)
            if js('return __lf.hint()'): break
        h = js('return __lf.hint()')
        if not h: failed.append('hint'); print('Tipp FEHLER', js('return __lf.toast()'))
        else:
            js('__lf.key("KeyH")'); time.sleep(0.15 * h['n'] + 0.5)
            st = js('return __lf.state()')
            if st['moves'] != h['n']: failed.append('hint-run'); print('Tipp ausführen FEHLER', st, h)
        # Sackgasse: Spiegel in 1-1 in die Ecke schieben -> Tipp meldet es
        js('__lf.start(0)')
        for c in 'ArrowRight ArrowRight ArrowUp ArrowUp ArrowLeft ArrowLeft'.split(): js('__lf.key(arguments[0])', c)
        js('__lf.key("KeyH")'); time.sleep(1.0)
        msg = js('return __lf.toast()')
        if 'no way' not in msg: failed.append('deadend'); print('Sackgasse FEHLER:', msg)
        # win flow: panel appears, next level starts
        js('localStorage.clear(); __lf.start(0)')
        for ch in sols[ids[0]]['moves']: js('__lf.key(arguments[0])', KEYS[ch])
        time.sleep(1.4)
        st = js('return __lf.state()')
        if st['overlay'] != 'win': failed.append('winpanel'); print('Gewinnfenster fehlt', st)
        d.save_screenshot(str(shots / 'win.png'))
        js("document.getElementById('win-next').click()")
        time.sleep(0.3)
        st = js('return __lf.state()')
        if st['level'] != ids[1]: failed.append('next'); print('Nächstes Level FEHLER', st)
    if mode in ('all', 'shots'):
        js('localStorage.clear(); __lf.showScene("title")'); time.sleep(1.2)
        d.save_screenshot(str(shots / 'title.png'))
        js('__lf.setSolved(arguments[0]); __lf.openChart(0)', list(sols)[:2]); time.sleep(0.8)
        d.save_screenshot(str(shots / 'chart.png'))
        for i, lid in enumerate(js('return __lf.levels')):
            js('__lf.start(arguments[0])', i); time.sleep(0.6)
            d.save_screenshot(str(shots / f'lv-{lid}.png'))
            moves = sols[lid]['moves']
            for ch in moves: js('__lf.key(arguments[0])', KEYS[ch])
            time.sleep(0.5)
            d.save_screenshot(str(shots / f'lv-{lid}-solved.png'))
        js('__lf.showScene("ending")'); time.sleep(1.5)
        d.save_screenshot(str(shots / 'ending.png'))
        d.set_window_size(400, 860); time.sleep(0.3)
        js('__lf.start(1)'); time.sleep(0.6)
        d.save_screenshot(str(shots / 'phone-play.png'))
        js('__lf.openChart(0)'); time.sleep(0.6)
        d.save_screenshot(str(shots / 'phone-chart.png'))
        js('__lf.showScene("title")'); time.sleep(0.6)
        d.save_screenshot(str(shots / 'phone-title.png'))
    if mode in ('all', 'play'):
        # Ton: echter Klick startet den AudioContext, alle Klänge laufen ohne Fehler
        js('__lf.showScene("title")'); time.sleep(0.3)
        d.find_element('id', 'btn-options').click(); time.sleep(0.5)
        js('__lf.sfx(3)'); time.sleep(0.5)
        a = js('return __lf.audio()')
        print('Audio:', a)
        if a['state'] != 'running' or not a['music']: failed.append('audio')
    e = errors(d)
    if e: failed.append('js'); print('JS-Fehler:', e)
finally:
    d.quit()
print('FEHLER: ' + ', '.join(failed) if failed else 'alles in Ordnung')
sys.exit(1 if failed else 0)

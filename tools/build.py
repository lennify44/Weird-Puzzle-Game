#!/usr/bin/env python3
"""Baut aus src/ zwei Dateien:
  index.html          eigenständiges Dokument (Doppelklick oder GitHub Pages)
  dist/artifact.html  dieselbe Seite ohne <html>/<head>/<body>, für claude.ai-Artifacts
Par-Werte kommen aus tools/solutions.json (erzeugt von: gjs -m tools/solve.js)."""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'src'
page = (src / 'page.html').read_text()
sols = json.loads((root / 'tools' / 'solutions.json').read_text())
pars = {k: {'par': v['par']} for k, v in sols.items()}

page = (page.replace('/*CSS*/', (src / 'style.css').read_text())
            .replace('/*CORE*/', (src / 'core.js').read_text())
            .replace('/*GAME*/', (src / 'game.js').read_text())
            .replace('__LEVELS__', json.dumps((src / 'levels.txt').read_text(), ensure_ascii=False))
            .replace('__PARS__', json.dumps(pars)))

(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'artifact.html').write_text(page)

head, body = page.split('<div id="app">', 1)
full = ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '</head>\n<body>\n<div id="app">' + body + '</body>\n</html>\n')
(root / 'index.html').write_text(full)
print(f'index.html {len(full)//1024} KB, {len(pars)} Level')

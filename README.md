# Leuchtfeuer

Ein Rätselspiel aus Spiegeln und Licht. Die Leuchtfeuer an der Küste sind erloschen.
Du schiebst Spiegel, Kisten und Halbspiegel und drehst festgeschraubte Spiegel, bis der
Strahl jeder Lampe alle Kristalle gleichzeitig trifft.

**Spielen:** `index.html` im Browser öffnen. Keine Installation, keine Server, läuft offline
(nur die Schriftarten kommen von Google Fonts, ohne Netz gibt es Ersatzschriften).

## Inhalt

- 33 Level in sechs Kapiteln, jedes Kapitel ein Leuchtturm auf der Seekarte:
  1. **Kittelfels** – Spiegel
  2. **Salzwatt** – Kisten und Wasser (Dinge im Wasser werden zu Boden)
  3. **Krähenspalt** – Lichtbrücken (über einem Spalt kann man gehen, solange Licht darüber fällt)
  4. **Zwei Schwestern** – Halbspiegel (teilen den Strahl)
  5. **Mühlenhuk** – Drehspiegel (fest, drehen sich beim Anstoßen)
  6. **Großes Feuer** – alles zusammen, danach der Abspann
- Jedes Level hat ein **Par**: die kürzeste mögliche Lösung, vom Löser berechnet.
- Rückgängig (beliebig oft, auch ein Neustart lässt sich zurücknehmen), Neustart,
  Fortschritt wird im Browser gespeichert.
- Ein Level darf man überspringen, aber nicht zwei hintereinander. Das Große Feuer öffnet
  sich erst, wenn alle anderen Leuchttürme brennen.
- Englisch und Deutsch, Musik und Klänge werden live im Browser erzeugt (Web Audio).
- Tastatur, Maus, Touch (Tippen und Wischen) und Gamepad.

## Steuerung

| Taste | Wirkung |
|---|---|
| Pfeiltasten / WASD | gehen, schieben, Drehspiegel anstoßen |
| Z, Rücktaste, U | Zug zurücknehmen |
| R | Level neu starten |
| Esc, P | Menü |
| Enter | im Gewinnfenster: weiter |
| Maus / Touch | Feld antippen = hingehen, Spiegel neben dir antippen = schieben, wischen = ein Schritt |
| Gamepad | Steuerkreuz/Stick, A weiter, B zurück, Y neu, Start Menü |

## Regeln

- Der Strahl läuft geradeaus, Spiegel lenken ihn um 90° ab (beide Seiten sind verspiegelt).
- Kristalle lassen Licht durch, Wände und Kisten halten es auf. Der Spieler wirft keinen Schatten.
- Man kann immer nur ein Ding schieben, ziehen geht nicht.
- Wasser: Licht geht darüber, man selbst nicht. Ein Ding, das hineingeschoben wird, versinkt
  und wird zu Boden.
- Spalt: Dinge können nicht hinein. Man kann darüber gehen, solange Licht darüber fällt.
- Drehspiegel klemmen, wenn das Drehen die Lichtbrücke unter deinen Füßen löschen würde.

## Aufbau

```
src/core.js       Spielregeln (Strahlverfolgung, Züge) – von Spiel UND Löser benutzt
src/levels.txt    alle Level als Textkarten (Legende steht oben in der Datei)
src/game.js       Darstellung, Klang, Menüs, Eingabe
src/style.css     Oberfläche
src/page.html     Seitengerüst
tools/build.py    baut index.html (eigenständig) und dist/artifact.html (für claude.ai)
tools/solve.js    Löser: beweist, dass jedes Level lösbar ist, berechnet Par → tools/solutions.json
tools/play.js     spielt eine Zugfolge nach und zeigt die Karte
tools/gen.js      Entwurfshilfe: verteilt Dinge zufällig auf einer Vorlage und zeigt die kniffligsten
tests/run.sh      spielt jedes Level im echten Spiel (headless Firefox) mit der Lösung des Lösers durch
```

Node.js wird nicht gebraucht. Die Werkzeuge laufen mit `gjs` (bei GNOME dabei), der Build mit Python 3.

```sh
gjs -m tools/solve.js          # alle Level lösen, Par neu berechnen
gjs -m tools/solve.js 3-4      # ein Level mit Lösungsweg
python3 tools/build.py         # index.html bauen
tests/run.sh                   # Browsertest (legt beim ersten Mal ein venv mit Selenium an)
```

Ein neues Level: Karte in `src/levels.txt` eintragen, `gjs -m tools/solve.js` (prüft Lösbarkeit
und Par), `python3 tools/build.py`, `tests/run.sh`.

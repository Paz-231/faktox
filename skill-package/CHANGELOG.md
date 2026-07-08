# Changelog — Faktox Invoice Agent

## 1.1.0 (2026-07-08)

**Wichtig:** Diese Version macht den Skill auf jedem Rechner lauffähig
(macOS, Linux, Windows). Ein Update von 1.0.0 wird dringend empfohlen.

### Behoben
- Alle Datenpfade sind jetzt portabel: Daten liegen in `~/.faktox/`
  (konfigurierbar über `FAKTOX_DATA_DIR`) statt in einem fest verdrahteten
  Server-Verzeichnis. Script-zu-Script-Aufrufe funktionieren aus jedem
  Installationsort.
- DE ermäßigter Steuersatz: Tippfehler behoben — deutsche Rechnungen mit
  `ust_ermaessigt` weisen jetzt korrekt 7% aus (vorher fälschlich 10%).
- Nummernkreis ist jetzt wirklich atomar: portables File-Locking +
  atomares Schreiben (temp file + rename). Parallele Aufrufe können keine
  doppelten Nummern mehr erzeugen.
- PDF-Scan: PDFs werden als Datei-Anhang an die Vision-API übergeben
  (vorher als Bild deklariert, was viele Modelle ablehnen).
- Mahnschreiben enthalten jetzt Absender- und Empfängerblock, Mahndatum,
  neues Zahlungsziel und Grußformel — formal vollständige Briefe.

### Aktualisiert
- Kleinunternehmergrenzen auf Rechtsstand 2025/2026: AT €55.000,
  DE €25.000/€100.000.
- `SKILL.md` im Claude-Code-Skill-Format (YAML-Frontmatter) mit präzisen
  Workflows — der Skill wird jetzt von Claude Code automatisch erkannt.
- API-Key-Variable heißt jetzt `OPENROUTER_API_KEY`
  (`BUILT_IN_FORGE_API_KEY` funktioniert weiterhin).

### Neu
- `ANLEITUNG.txt` — vollständige Anleitung für Käufer
- `requirements.txt`, `LICENSE.txt`, `CHANGELOG.md`, `VERSION`
- `scripts/common.py` — gemeinsame Basis (Datenverzeichnis, Locking)

## 1.0.0 (2026-07-06)

- Erstveröffentlichung: 13 Scripts, AT-Honorarnoten + DE-Rechnungen,
  Nummernkreis, Storno, Steuerstatus-Historie, Mahnwesen, KI-Scan,
  Email-Abholung, EÜR/UStVA/DATEV-Reports.

---
name: faktox-invoice-agent
description: DACH-konformer Rechnungs- und Buchhaltungs-Agent für Österreich und Deutschland. Verwenden bei allen Aufgaben rund um Rechnungen, Honorarnoten, Eingangsrechnungen, Mahnungen, Storno, Kundenstamm, Rechnungsnummern, EÜR, USt-Voranmeldung, DATEV-Export oder Buchhaltungs-Reports. Trigger-Beispiele - "Schreib eine Rechnung an ...", "Scanne diese Rechnung", "Erstelle den Monatsreport", "Mahne Rechnung RE-...", "Storniere Rechnung ...".
---

# Faktox Invoice Agent — Rechnungen & Buchhaltung für AT/DE

Du bist ein Rechnungs- und Buchhaltungs-Assistent für Selbständige in Österreich
und Deutschland. Dieses Skill-Paket enthält 14 Python-Scripts, die zusammen ein
vollständiges Rechnungssystem bilden: DACH-konforme PDF-Rechnungen, lückenloser
Nummernkreis, Storno-Logik, Steuerstatus-Historie, Mahnwesen, Eingangsrechnungen
mit KI-Scan und Steuerberater-fertige Reports.

## Grundregeln (IMMER beachten)

1. **Nummernkreis ist heilig.** Jede Rechnungsnummer kommt aus
   `number_manager.py next` — niemals selbst ausdenken. Nach erfolgreicher
   PDF-Erstellung sofort `finalize` aufrufen.
2. **Kein Steuerausweis ohne UID.** `generate_invoice.py` blockiert das
   automatisch — Fehler an den User durchreichen, nicht umgehen.
3. **Rechnungen werden nie gelöscht oder geändert.** Korrektur nur über
   `number_manager.py cancel <nummer>` (erzeugt Storno-Nummer) + neue Rechnung.
4. **Steuerstatus kommt aus dem Profil.** Vor der ersten Rechnung muss
   `business_profile.py` eingerichtet sein (Basisdaten + tax-status).
5. **Fehlende Pflichtfelder beim User nachfragen** — nie raten (besonders
   UID, IBAN, Adressen).
6. **Alle Daten** liegen in `~/.faktox/` (bzw. `$FAKTOX_DATA_DIR`) als JSON —
   bei Problemen dort nachsehen.

## Setup (einmalig pro User)

```bash
pip install -r requirements.txt   # reportlab + requests

# Unternehmensprofil anlegen:
python3 scripts/business_profile.py set --name "Max Mustermann" \
  --street "Musterstraße 1" --city "1010 Wien, Österreich" --country AT \
  --email "max@example.at" --iban "AT..." --bank-owner "Max Mustermann"
python3 scripts/business_profile.py tax-status --status kleinunternehmer --from 2026-01-01
# Falls USt-pflichtig: zusätzlich UID setzen:
python3 scripts/business_profile.py uid "ATU12345678"
```

Optional für KI-Funktionen: `export OPENROUTER_API_KEY="sk-or-..."`

## Workflow: Ausgangsrechnung erstellen

User sagt z.B. „Rechnung an Herbert Thaler für 5 Stunden Beratung à 120 Euro":

1. Baue die Invoice-Spec (JSON) — Vorlagen in `templates/`. Kundendaten aus
   dem Kundenstamm holen: `python3 scripts/customers.py find "Herbert"`.
   Fehlt der Kunde: Daten erfragen und mit `customers.py add` speichern.
2. Nummer ziehen: `NUM=$(python3 scripts/number_manager.py next --type Rechnung)`
   und als `invoice_number` in die Spec eintragen.
3. `issuer` kann in der Spec weggelassen werden — er wird automatisch aus dem
   Unternehmensprofil geladen (inkl. UID und Steuerstatus zum Rechnungsdatum).
4. PDF erzeugen: `python3 scripts/generate_invoice.py spec.json --out Rechnung_$NUM.pdf`
   — bei Validierungsfehlern: Fehler beheben (User fragen), NICHT die Nummer verwerfen.
5. Finalisieren: `python3 scripts/number_manager.py finalize $NUM`
6. Im Mahnwesen registrieren: `python3 scripts/mahnwesen.py register Rechnung_$NUM.json`
   (das enriched JSON aus Schritt 4, liegt neben dem PDF)
7. Dem User Zusammenfassung zeigen: Nummer, Empfänger, Netto/USt/Brutto, PDF-Pfad.

Typ „Honorarnote" statt „Rechnung" verwenden, wenn der User in AT freiberuflich
abrechnet oder es explizit sagt.

## Workflow: Rechnung stornieren

```bash
python3 scripts/number_manager.py cancel RE-2026-000003   # gibt STORNO-Nummer zurück
```
Dann eine Storno-Rechnung (negative Beträge, type wie Original, Nummer =
STORNO-Nummer, Verweis "Storno zu RE-2026-000003" im footer) generieren und
finalisieren. Die Originalnummer bleibt im Register — keine Lücken.

## Workflow: Eingangsrechnung erfassen (Foto/PDF)

```bash
python3 scripts/scan_invoice.py rechnung.jpg --auto-add   # KI-Scan + ablegen
# oder manuell:
python3 scripts/incoming.py add --number "R-123" --issuer "AWS" --date 2026-07-01 --amount 120.00 --vat 20.00
python3 scripts/incoming.py paid "R-123"                  # als bezahlt markieren
```
Nach jedem Scan die extrahierten Daten dem User zur Bestätigung zeigen.

## Workflow: Mahnwesen (3 Stufen)

```bash
python3 scripts/mahnwesen.py list                    # offene Rechnungen prüfen
python3 scripts/mahnwesen.py remind RE-2026-000001   # Stufe 1: Zahlungserinnerung
python3 scripts/mahnwesen.py mahn1  RE-2026-000001   # Stufe 2: 1. Mahnung
python3 scripts/mahnwesen.py mahn2  RE-2026-000001   # Stufe 3: 2. Mahnung (letzte)
python3 scripts/mahnwesen.py paid   RE-2026-000001   # Zahlungseingang buchen
```
Reihenfolge einhalten; zwischen den Stufen ~7 Tage Abstand empfehlen.

## Workflow: Reports & Steuerberater

```bash
python3 scripts/report_generator.py monthly --month 2026-07   # PDF + CSV
python3 scripts/report_generator.py yearly --year 2026        # Jahresbericht/EÜR
python3 scripts/report_generator.py ustva --month 2026-07     # USt-Voranmeldung (FinanzOnline/ELSTER)
python3 scripts/export_csv.py --out export.csv                # DATEV-kompatibler Export
```

## Workflow: Email-Abholung (optional)

IMAP-Zugangsdaten als Env-Vars (`IMAP_HOST`, `IMAP_USER`, `IMAP_PASSWORD`), dann:
```bash
python3 scripts/email_checker.py --auto-add --mark-read
```

## Script-Referenz

| Script | Funktion |
|---|---|
| `generate_invoice.py` | PDF-Generierung (AT + DE, mit Steuerlogik + UID-Prüfung) |
| `business_profile.py` | Unternehmensprofil + Steuerstatus-/UID-Historie |
| `number_manager.py` | Lückenloser Nummernkreis + Storno (atomar, File-Lock) |
| `customers.py` | Kundenstamm (add/find/list/update/remove) |
| `incoming.py` | Eingangsrechnungen (add/list/paid/summary) |
| `scan_invoice.py` | KI-Scan: Foto/PDF → Rechnungsdaten (OpenRouter Vision) |
| `file_manager.py` | Datei-Ablage für PDFs/Fotos (nach Jahr/Monat) |
| `email_checker.py` | Email-Abholung per IMAP + Auto-Scan |
| `mahnwesen.py` | Mahnwesen (Erinnerung, 1./2. Mahnung, paid) |
| `report_generator.py` | Reports: monthly/yearly/ustva/euer (PDF + CSV) |
| `export_csv.py` | DATEV-/Excel-kompatibler CSV-Export |
| `parse_input.py` | Text → Invoice-Spec via LLM (für Automationen ohne Assistent) |
| `upload_to_drive.py` | Google-Drive-Upload (optional) |
| `common.py` | Gemeinsame Basis: Datenverzeichnis, Locking, atomare Writes |

## Umgebungsvariablen

| Variable | Zweck | Pflicht |
|---|---|---|
| `FAKTOX_DATA_DIR` | Datenverzeichnis (Standard: `~/.faktox`) | nein |
| `OPENROUTER_API_KEY` | KI-Scan + Text-Parsing | nur für KI-Features |
| `VISION_MODEL` | Vision-Modell (Standard: `openai/gpt-4o`) | nein |
| `IMAP_HOST/_USER/_PASSWORD` | Email-Abholung | nur für Email-Feature |
| `GOOGLE_APPLICATION_CREDENTIALS`, `DRIVE_FOLDER_ID` | Drive-Upload | nur für Drive |

## Rechtlicher Rahmen (Stand 2026)

- AT Kleinunternehmer: §6 Abs1 Z27 UStG, Grenze €55.000 Jahresumsatz (seit 2025)
- DE Kleinunternehmer: §19 UStG, Grenzen €25.000 Vorjahr / €100.000 laufend (seit 2025)
- Steuersätze: AT 20% / 10% (13%), DE 19% / 7%; Reverse Charge §13b UStG (DE)
- Dieses Tool ersetzt keine Steuerberatung. Bei Grenzfällen den User an
  seinen Steuerberater verweisen.

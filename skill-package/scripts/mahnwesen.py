#!/usr/bin/env python3
"""Mahnwesen — Zahlungserinnerungen und Mahnungen.

Usage:
    python3 mahnwesen.py register <spec.json>
    python3 mahnwesen.py list
    python3 mahnwesen.py remind <invoice_number> [--out .pdf]
    python3 mahnwesen.py mahn1 <invoice_number> [--out .pdf]
    python3 mahnwesen.py mahn2 <invoice_number> [--out .pdf]
    python3 mahnwesen.py paid <invoice_number>
"""
import json, sys, argparse
from pathlib import Path
from datetime import datetime, timedelta

from common import DATA_DIR, read_json, write_json_atomic

DB_PATH = DATA_DIR / "invoices.json"
MAHNUNG = {
    "remind": {"title": "ZAHLUNGSERINNERUNG", "intro": "wir möchten Sie daran erinnern, dass die folgende Rechnung noch offen ist:", "footer": "Bitte überweisen Sie den fälligen Betrag bis zum neuen Zahlungsziel. Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos."},
    "mahn1": {"title": "1. MAHNUNG", "intro": "trotz unserer Zahlungserinnerung haben wir den fälligen Betrag noch nicht erhalten:", "footer": "Wir bitten Sie, den ausstehenden Betrag bis zum neuen Zahlungsziel zu überweisen."},
    "mahn2": {"title": "2. MAHNUNG", "intro": "trotz unserer 1. Mahnung haben wir den fälligen Betrag immer noch nicht erhalten:", "footer": "Dies ist unsere letzte Mahnung. Sollte der Betrag nicht bis zum neuen Zahlungsziel eingehen, behalten wir uns rechtliche Schritte vor."},
}
def load_db(): return read_json(DB_PATH, {"invoices": []})
def save_db(db): write_json_atomic(DB_PATH, db)
def find_inv(n, db=None): 
    db = db or load_db()
    return next((i for i in db["invoices"] if i["invoice_number"] == n), None)

def cmd_register(args):
    spec = json.loads(Path(args.spec).read_text(encoding="utf-8")); db = load_db()
    if find_inv(spec["invoice_number"], db): print(f"❌ {spec['invoice_number']} exists", file=sys.stderr); sys.exit(1)
    db["invoices"].append({"invoice_number": spec["invoice_number"], "invoice_date": spec.get("invoice_date"), "gross_total": spec.get("gross_total"), "recipient_name": (spec.get("recipient") or {}).get("name"), "status": "open", "remind_date": None, "mahn1_date": None, "mahn2_date": None, "paid_date": None, "spec_path": str(Path(args.spec).resolve()), "registered_at": datetime.now().isoformat()})
    save_db(db); print(f"✅ Registered: {spec['invoice_number']} — €{spec.get('gross_total', 0):.2f}")

def cmd_list(args):
    db = load_db()
    if not db["invoices"]: print("No invoices."); return
    for i in db["invoices"]:
        e = {"open":"🟡","paid":"🟢","overdue":"🔴"}.get(i["status"], "⚪")
        m = " [2.M]" if i["mahn2_date"] else " [1.M]" if i["mahn1_date"] else " [Er.]" if i["remind_date"] else ""
        print(f"  {e} {i['invoice_number']} — {i['recipient_name']} — €{i['gross_total']:.2f} — {i['status']}{m}")

def cmd_mahnung(args, mt):
    inv = find_inv(args.invoice_number)
    if not inv: print(f"❌ {args.invoice_number} not found", file=sys.stderr); sys.exit(1)
    if inv["status"] == "paid": print(f"✅ Already paid"); return
    spec = json.loads(Path(inv["spec_path"]).read_text(encoding="utf-8"))
    now = datetime.now().strftime("%d.%m.%Y")
    db = load_db()
    for r in db["invoices"]:
        if r["invoice_number"] == args.invoice_number:
            if mt == "remind": r["remind_date"] = now
            elif mt == "mahn1": r["mahn1_date"] = now
            elif mt == "mahn2": r["mahn2_date"] = now; r["status"] = "overdue"
    save_db(db)
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    W, H = A4; left = 55; rx = W - 55
    out = Path(args.out) if args.out else Path(f"Mahnung_{args.invoice_number}_{mt}.pdf")
    issuer = spec.get("issuer") or {}
    recipient = spec.get("recipient") or {}
    due = (datetime.now() + timedelta(days=7)).strftime("%d.%m.%Y")

    c = canvas.Canvas(str(out), pagesize=A4)
    c.setTitle(f"{MAHNUNG[mt]['title']} zu {args.invoice_number}")

    # Kopf
    c.setFont("Helvetica-Bold", 22); c.drawString(left, H-70, MAHNUNG[mt]["title"])
    c.setLineWidth(0.8); c.line(left, H-78, rx, H-78)

    # Absender (aus der Original-Rechnung)
    y = H - 110
    c.setFont("Helvetica-Bold", 11); c.drawString(left, y, "Absender")
    c.setFont("Helvetica", 9.2)
    for line in [issuer.get("name", ""), issuer.get("street", ""), issuer.get("postal_city_country", "")]:
        if line:
            y -= 14; c.drawString(left, y, line)
    if uid := issuer.get("uid"):
        y -= 14; c.drawString(left, y, f"UID: {uid}")

    # Meta rechts: Mahndatum, Rechnungsnummer, neues Zahlungsziel
    c.setFont("Helvetica-Bold", 9.2); c.drawRightString(rx - 90, H-110, "Datum:")
    c.setFont("Helvetica", 9.2); c.drawRightString(rx, H-110, now)
    c.setFont("Helvetica-Bold", 9.2); c.drawRightString(rx - 90, H-125, "Rechnungsnummer:")
    c.setFont("Helvetica", 9.2); c.drawRightString(rx, H-125, args.invoice_number)
    c.setFont("Helvetica-Bold", 9.2); c.drawRightString(rx - 90, H-140, "Neues Zahlungsziel:")
    c.setFont("Helvetica", 9.2); c.drawRightString(rx, H-140, due)

    # Empfänger
    y -= 32
    c.setFont("Helvetica-Bold", 11); c.drawString(left, y, "Empfänger")
    c.setFont("Helvetica", 9.2)
    for line in [recipient.get("name", inv.get("recipient_name", "")), recipient.get("street", ""), recipient.get("postal_city_country", "")]:
        if line:
            y -= 14; c.drawString(left, y, line)

    # Anrede + Text
    y -= 36
    c.setFont("Helvetica", 9.5)
    c.drawString(left, y, "Sehr geehrte Damen und Herren,")
    y -= 20
    c.drawString(left, y, MAHNUNG[mt]["intro"])

    # Rechnungsdaten
    y -= 30
    c.setFont("Helvetica-Bold", 10); c.drawString(left, y, f"Rechnungsbetrag: € {inv['gross_total']:.2f}")
    y -= 15
    c.setFont("Helvetica", 9.2); c.drawString(left, y, f"Rechnungsnummer: {args.invoice_number}")
    y -= 15
    c.drawString(left, y, f"Rechnungsdatum: {inv.get('invoice_date', '?')}")

    # Schlusstext
    y -= 30
    c.setFont("Helvetica", 9.5); c.drawString(left, y, MAHNUNG[mt]["footer"])

    # Bankverbindung
    if issuer.get("iban"):
        y -= 35
        c.setFont("Helvetica-Bold", 11); c.drawString(left, y, "Bankverbindung")
        bl = []
        if o := issuer.get("bank_owner"): bl.append(("Inhaber:", o))
        bl.append(("IBAN:", issuer["iban"]))
        if b := issuer.get("bic"): bl.append(("BIC:", b))
        for i, (l, v) in enumerate(bl):
            c.setFont("Helvetica-Bold", 9.2); c.drawString(left, y - 18 - i*15, l)
            c.setFont("Helvetica", 9.2); c.drawString(150, y - 18 - i*15, v)
        y -= 18 + len(bl) * 15

    # Grußformel
    y -= 30
    c.setFont("Helvetica", 9.5)
    c.drawString(left, y, "Mit freundlichen Grüßen")
    if issuer.get("name"):
        c.drawString(left, y - 15, issuer["name"])

    c.showPage(); c.save()
    print(f"✅ {MAHNUNG[mt]['title']}: {out}")
    print(f"   Neues Zahlungsziel: {due}")

def cmd_paid(args):
    db = load_db()
    for r in db["invoices"]:
        if r["invoice_number"] == args.invoice_number:
            r["status"] = "paid"; r["paid_date"] = datetime.now().strftime("%d.%m.%Y"); save_db(db)
            print(f"✅ {args.invoice_number} paid"); return
    print(f"❌ Not found", file=sys.stderr); sys.exit(1)

def main():
    p = argparse.ArgumentParser(description="Mahnwesen"); sub = p.add_subparsers(dest="command")
    pr = sub.add_parser("register"); pr.add_argument("spec"); pr.set_defaults(func=cmd_register)
    sub.add_parser("list").set_defaults(func=cmd_list)
    for cmd in ["remind", "mahn1", "mahn2"]:
        pp = sub.add_parser(cmd); pp.add_argument("invoice_number"); pp.add_argument("--out"); pp.set_defaults(func=lambda a, c=cmd: cmd_mahnung(a, c))
    pp = sub.add_parser("paid"); pp.add_argument("invoice_number"); pp.set_defaults(func=cmd_paid)
    args = p.parse_args()
    if not args.command: p.print_help(); sys.exit(1)
    args.func(args)

if __name__ == "__main__":
    main()

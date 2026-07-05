# Faktur — DACH Rechnungs-SaaS

Standalone Rechnungs-SaaS mit KI für Solo-Selbständige in DACH.
AT-Honorarnoten + DE-Rechnungen, Foto-Scan, Buchhaltungs-Report.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Convex (reactive DB + file storage + functions)
- **Auth**: Magic-Link (eigene Implementation)
- **Payment**: Stripe Subscriptions
- **AI**: OpenRouter Vision API (Foto/PDF → Rechnungsdaten)

## Setup

```bash
# 1. Dependencies
npm install

# 2. Convex initialisieren (braucht convex.dev Account)
npx convex dev

# 3. Dev server
npm run dev
```

## Struktur

```
rechnung-saas/
├── index.html              # Landing Page
├── convex/
│   ├── schema.ts           # DB Schema (9 Tabellen)
│   ├── invoices.ts         # Ausgangsrechnungen API
│   ├── incoming.ts         # Eingangsrechnungen API
│   ├── profile.ts          # Unternehmensprofil + Steuerstatus
│   ├── customers.ts        # Kundenstamm
│   └── auth.ts             # Magic-Link Auth (TODO)
├── src/
│   ├── App.tsx             # Main app (TODO)
│   ├── Dashboard.tsx       # Dashboard (TODO)
│   └── components/         # UI components (TODO)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Pricing

- Free: 0€/Monat — 3 Rechnungen
- Starter: 12€/Monat — 20 Rechnungen, Foto-Scan, Mahnwesen
- Pro: 29€/Monat — Unlimited, Email-Abholung, Buchhaltungs-Report

## 10k-Mathe

10.000€ ÷ 12€ = 833 zahlende User. DACH hat ~4M Solo-Selbständige.

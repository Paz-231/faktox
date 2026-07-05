#!/usr/bin/env python3
"""
Stripe Setup Script — erstellt Products + Prices für Faktur.

Führt dies einmal aus um die Stripe Products anzulegen:
    python3 scripts/stripe_setup.py

Danach werden die Price IDs ausgegeben — trage sie als
Convex Environment Variables ein:
    STRIPE_PRICE_STARTER=price_...
    STRIPE_PRICE_PRO=price_...

Env: STRIPE_SECRET_KEY
"""
import os
import sys
import requests

STRIPE_KEY = os.environ.get("STRIPE_SECRET_KEY", "")

if not STRIPE_KEY:
    print("❌ STRIPE_SECRET_KEY nicht gesetzt")
    print("   Export: export STRIPE_SECRET_KEY=sk_test_...")
    sys.exit(1)

BASE = "https://api.stripe.com/v1"
AUTH = (STRIPE_KEY, "")

PLANS = [
    {
        "name": "Faktur Starter",
        "description": "20 Rechnungen/Monat, Foto-Upload, Mahnwesen, monatlicher Report",
        "amount": 1200,  # €12.00
        "currency": "eur",
        "interval": "month",
        "env_var": "STRIPE_PRICE_STARTER",
    },
    {
        "name": "Faktur Pro",
        "description": "Unlimited Rechnungen, Email-Abholung, Jahresbericht, DATEV-Export, USt-Voranmeldung",
        "amount": 2900,  # €29.00
        "currency": "eur",
        "interval": "month",
        "env_var": "STRIPE_PRICE_PRO",
    },
]

print("🔑 Stripe Setup für Faktur")
print("=" * 50)

for plan in PLANS:
    # Create product
    print(f"\n📦 Erstelle Product: {plan['name']}")
    resp = requests.post(
        f"{BASE}/products",
        auth=AUTH,
        data={
            "name": plan["name"],
            "description": plan["description"],
        },
    )
    if resp.status_code != 200:
        print(f"❌ Product creation failed: {resp.json()}")
        continue

    product = resp.json()
    product_id = product["id"]
    print(f"   Product ID: {product_id}")

    # Create price
    print(f"   Erstelle Price: €{plan['amount']/100:.2f}/{plan['interval']}")
    resp = requests.post(
        f"{BASE}/prices",
        auth=AUTH,
        data={
            "product": product_id,
            "unit_amount": plan["amount"],
            "currency": plan["currency"],
            "recurring[interval]": plan["interval"],
        },
    )
    if resp.status_code != 200:
        print(f"❌ Price creation failed: {resp.json()}")
        continue

    price = resp.json()
    price_id = price["id"]
    print(f"   Price ID: {price_id}")
    print(f"   → Setze Convex env: {plan['env_var']}={price_id}")

print("\n" + "=" * 50)
print("✅ Setup complete!")
print()
print("Trage diese als Convex Environment Variables ein:")
print()
for plan in PLANS:
    print(f"  npx convex env set {plan['env_var']} <price_id>")
print()
print("Und setze auch:")
print("  npx convex env set STRIPE_SECRET_KEY <sk_test_...>")
print("  npx convex env set STRIPE_WEBHOOK_SECRET <whsec_...>")
print("  npx convex env set FRONTEND_URL https://your-domain.com")

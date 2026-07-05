import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const joinWaitlist = useMutation(api.waitlist.join);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    try {
      await joinWaitlist({ email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Etwas ist schiefgelaufen");
    }
  };

  return (
    <div className="container">
      <section className="hero">
        <h1>Faktur</h1>
        <p>
          DACH Rechnungs-SaaS mit KI. Sprich oder fotografiere — wir erstellen deine
          Rechnung. AT-Honorarnoten, DE-Rechnungen, automatisches Mahnwesen,
          Buchhaltungs-Report.
        </p>
        {!submitted ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            <input
              type="email"
              placeholder="deine@email.at"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: "1rem 1.5rem",
                borderRadius: 8,
                border: "none",
                fontSize: "1rem",
                minWidth: 280,
              }}
              required
            />
            <button type="submit" className="cta">
              14 Tage gratis testen
            </button>
          </form>
        ) : (
          <div style={{ marginTop: "2rem", fontSize: "1.2rem", color: "#8DAA8C" }}>
            ✅ Du bist auf der Warteliste! Wir melden uns bald.
          </div>
        )}
        {error && (
          <div style={{ marginTop: "1rem", color: "#E8A48C" }}>{error}</div>
        )}
      </section>

      <section className="features">
        <div className="feature">
          <h3>🎤 Voice & Foto-Eingabe</h3>
          <p>Diktiere deine Rechnung oder fotografiere den Stundenzettel. KI extrahiert alle Daten automatisch.</p>
        </div>
        <div className="feature">
          <h3>🇦🇹🇩🇪 DACH-konform</h3>
          <p>AT-Honorarnoten mit §6 Abs1 Z27 UStG. DE-Rechnungen mit §19 UStG. Kleinunternehmer-Regelung automatisch.</p>
        </div>
        <div className="feature">
          <h3>📊 Buchhaltungs-Report</h3>
          <p>EÜR nach §4 Abs3 EStG, USt-Voranmeldung, DATEV-Export. Monatlich und jährlich. Steuerberater-fertig.</p>
        </div>
        <div className="feature">
          <h3>📮 Email-Abholung</h3>
          <p>Rechnungen an eine spezielle Email-Adresse werden automatisch abgeholt, gescannt und abgelegt.</p>
        </div>
        <div className="feature">
          <h3>🔔 Mahnwesen</h3>
          <p>Automatische Zahlungserinnerungen, 1. und 2. Mahnung. Lückenloser Rechnungsnummern-Kreis.</p>
        </div>
        <div className="feature">
          <h3>🔒 Lückenlos</h3>
          <p>Rechnungsnummern sind atomar, fortlaufend, nie wiederverwendet. Jede Storno bekommt eine Storno-Rechnung.</p>
        </div>
      </section>

      <section className="moat" id="moat">
        <h2>Warum nicht einfach Excel?</h2>
        <div className="moat-grid">
          <div className="moat-item">
            <h4>UID-Pflicht-Prüfung</h4>
            <p>USt-pflichtig ohne UID? Rechnung wird blockiert. Kein Steuerausweis ohne UID.</p>
          </div>
          <div className="moat-item">
            <h4>Steuerstatus-Wechsel</h4>
            <p>Vom Kleinunternehmer zur USt-Pflicht. System erkennt das Datum automatisch.</p>
          </div>
          <div className="moat-item">
            <h4>Storno-Logik</h4>
            <p>Jede Storno-Rechnung hat eine eigene Nummer. Keine Lücken im Nummernkreis.</p>
          </div>
          <div className="moat-item">
            <h4>DACH-Moat</h4>
            <p>AT/DE Steuerrecht, UStG, Kleinunternehmer-Regelung. US-Tools können das nicht.</p>
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <h2>Preise</h2>
        <div className="plans">
          <div className="plan">
            <h3>Free</h3>
            <div className="price">0€ <span>/Monat</span></div>
            <ul>
              <li>3 Rechnungen pro Monat</li>
              <li>AT-Honorarnoten + DE-Rechnungen</li>
              <li>Kundenstamm</li>
              <li>PDF-Export</li>
            </ul>
          </div>
          <div className="plan featured">
            <h3>Starter</h3>
            <div className="price">12€ <span>/Monat</span></div>
            <ul>
              <li>20 Rechnungen pro Monat</li>
              <li>Foto-Upload + Vision-Scan</li>
              <li>Mahnwesen (3 Stufen)</li>
              <li>Eingangsrechnungen</li>
              <li>Buchhaltungs-Report (monatlich)</li>
            </ul>
          </div>
          <div className="plan">
            <h3>Pro</h3>
            <div className="price">29€ <span>/Monat</span></div>
            <ul>
              <li>Unbegrenzte Rechnungen</li>
              <li>Email-Abholung (IMAP)</li>
              <li>Jahresbericht + EÜR</li>
              <li>DATEV-Export</li>
              <li>USt-Voranmeldung-Daten</li>
              <li>Mehrere Unternehmen</li>
            </ul>
          </div>
        </div>
      </section>

      <footer>
        <p>Faktur — DACH Rechnungs-SaaS mit KI<br />
        © 2026 maighty Labs. Keine Steuerberatung. Alle Rechte vorbehalten.</p>
      </footer>
    </div>
  );
}

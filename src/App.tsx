import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

export default function App() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const containerRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // Liquid background transforms
  const bgY = useTransform(smoothProgress, [0, 1], ["0%", "50%"]);
  const bgScale = useTransform(smoothProgress, [0, 0.5, 1], [1, 1.1, 1.2]);
  const bgOpacity = useTransform(smoothProgress, [0, 0.3, 0.7, 1], [0.6, 0.4, 0.3, 0.2]);

  // Hero parallax
  const heroY = useTransform(smoothProgress, [0, 0.3], ["0%", "30%"]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.2], [1, 0]);

  return (
    <div className="landing">
      {/* Liquid animated background */}
      <motion.div
        className="liquid-bg"
        style={{
          y: bgY,
          scale: bgScale,
          opacity: bgOpacity,
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, var(--accent), transparent),
                       radial-gradient(ellipse 60% 40% at 80% 50%, var(--accent), transparent),
                       radial-gradient(ellipse 60% 40% at 20% 80%, var(--accent), transparent)`,
          backgroundSize: "100% 100%, 60% 60%, 50% 50%",
          backgroundRepeat: "no-repeat",
          filter: "blur(80px)",
        }}
      />

      <div className="landing-content">
        {/* Nav */}
        <nav className="landing-nav">
          <div className="landing-nav-logo">Faktox<span>.</span></div>
          <div className="landing-nav-links">
            <a onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>Features</a>
            <a onClick={() => document.getElementById("moat")?.scrollIntoView({ behavior: "smooth" })}>Warum Faktox</a>
            <a onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>Preise</a>
            <button className="landing-nav-login" onClick={() => setShowLogin(true)}>Einloggen</button>
          </div>
        </nav>

        {/* Hero */}
        <motion.section className="hero" style={{ y: heroY, opacity: heroOpacity }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
          >
            <span className="hero-badge">DACH Rechnungs-SaaS</span>
            <h1>Rechnungen.<br /><span>Intelligent.</span></h1>
            <p>
              Fotografieren, diktieren, fertig. Faktox erstellt AT-Honorarnoten
              und DE-Rechnungen mit KI — automatisch DACH-konform, mit
              Mahnwesen und Buchhaltungs-Report.
            </p>
            {!submitted ? (
              <form className="hero-cta" onSubmit={(e) => { e.preventDefault(); if (email) setSubmitted(true); }}>
                <input
                  className="hero-input"
                  type="email"
                  placeholder="deine@email.at"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="btn btn-primary">
                  Kostenlos starten
                </button>
              </form>
            ) : (
              <div className="waitlist-success">
                <div className="waitlist-success-text">Auf der Warteliste. Wir melden uns.</div>
                <button className="btn btn-sm" onClick={() => setShowLogin(true)}>Jetzt einloggen »</button>
              </div>
            )}
            <div className="scroll-hint">scroll</div>
          </motion.div>
        </motion.section>

        {/* Features */}
        <motion.section
          className="section"
          id="features"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="section-title">Alles drin. Nichts zu viel.</h2>
          <p className="section-subtitle">Was Faktox von Excel und anderen Tools unterscheidet.</p>

          <div className="features-grid">
            {[
              { label: "AI", title: "Foto & Voice-Eingabe", desc: "Fotografiere den Stundenzettel oder diktiere die Rechnung. KI extrahiert alle Daten automatisch." },
              { label: "DACH", title: "AT & DE konform", desc: "Honorarnoten mit §6 Abs1 Z27 UStG. DE-Rechnungen mit §19 UStG. Kleinunternehmer-Logik automatisch." },
              { label: "Report", title: "Buchhaltungs-Report", desc: "EÜR nach §4 Abs3 EStG, USt-Voranmeldung, DATEV-Export. Monatlich und jährlich. Steuerberater-fertig." },
              { label: "Email", title: "Automatische Abholung", desc: "Rechnungen an eine spezielle Email-Adresse werden automatisch abgeholt, gescannt und abgelegt." },
              { label: "Mahnwesen", title: "3-stufiges Mahnwesen", desc: "Zahlungserinnerung, 1. und 2. Mahnung. Automatisch generiert, lückenloser Nummernkreis." },
              { label: "Audit", title: "Lückenlos & Storno", desc: "Rechnungsnummern atomar, fortlaufend, nie wiederverwendet. Jede Storno bekommt eine Storno-Rechnung." },
            ].map((f, i) => (
              <motion.div
                key={i}
                className="feature-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
              >
                <div className="feature-label">{f.label}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Moat */}
        <motion.section
          className="moat-section"
          id="moat"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="section-title">Warum nicht einfach Excel?</h2>
          <p className="section-subtitle">Vier Gründe warum Faktox Rechnungsstellung sicherer macht.</p>
          <div className="moat-grid">
            {[
              { title: "UID-Pflicht-Prüfung", desc: "USt-pflichtig ohne UID? Rechnung wird blockiert. Kein Steuerausweis ohne UID-Nummer." },
              { title: "Steuerstatus-Wechsel", desc: "Vom Kleinunternehmer zur USt-Pflicht. System erkennt das Datum und wendet den korrekten Steuersatz an." },
              { title: "Storno-Logik", desc: "Jede Storno-Rechnung hat eine eigene Nummer. Keine Lücken im Nummernkreis. Vollständiger Audit-Trail." },
              { title: "DACH-Moat", desc: "AT/DE Steuerrecht, UStG, Kleinunternehmer-Regelung. US-Tools können das nicht leisten." },
            ].map((m, i) => (
              <motion.div
                key={i}
                className="moat-item"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <h4>{m.title}</h4>
                <p>{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Pricing */}
        <motion.section
          className="pricing-section"
          id="pricing"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="section-title">Preise</h2>
          <p className="section-subtitle">Faire Preise. Keine versteckten Kosten. Jederzeit kündbar.</p>
          <div className="plans">
            {[
              {
                name: "Free", price: "0€", period: "/Monat", sub: "Für den Start",
                features: ["3 Rechnungen pro Monat", "3 Aufträge + Angebote", "AT-Honorarnoten + DE-Rechnungen", "Kundenstamm", "Kleinunternehmer-Logik", "Storno-Logik"],
                featured: false,
              },
              {
                name: "Starter", price: "14,90€", period: "/Monat", sub: "Für Solo-Selbständige",
                features: ["Unbegrenzte Rechnungen", "Unbegrenzte Aufträge + Angebote", "Foto/PDF Upload + AI Vision-Scan", "Mahnwesen (3 Stufen)", "Eingangsrechnungen unbegrenzt", "Buchhaltungs-Report (monatlich)"],
                featured: true,
              },
              {
                name: "Pro", price: "29,90€", period: "/Monat", sub: "Für Anspruchsvolle",
                features: ["Alles aus Starter", "Email-Abholung (IMAP)", "EÜR (§4 Abs3 EStG)", "USt-Voranmeldung-Daten", "DATEV-Export", "Jahresbericht", "Mehrere Unternehmen"],
                featured: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                className={`plan ${plan.featured ? "featured" : ""}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <h3>{plan.name}</h3>
                <div className="price">{plan.price}<span> {plan.period}</span></div>
                <div className="price-sub">{plan.sub}</div>
                <ul>
                  {plan.features.map((f, j) => <li key={j}>{f}</li>)}
                </ul>
                <button
                  className={`btn ${plan.featured ? "btn-primary" : ""}`}
                  onClick={() => setShowLogin(true)}
                >
                  {plan.name === "Free" ? "Kostenlos starten" : `${plan.name} wählen`}
                </button>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section
          className="final-cta"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2>Starte heute.</h2>
          <p>Keine Kreditkarte nötig. 3 Rechnungen gratis. Upgrade jederzeit.</p>
          <button className="btn btn-primary" onClick={() => setShowLogin(true)}>Kostenlos starten</button>
        </motion.section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>Faktox — DACH Rechnungs-SaaS mit KI<br />faktox.online — © 2026 maighty Labs. Keine Steuerberatung.</p>
        </footer>
      </div>

      {/* Login redirect */}
      {showLogin && (
        <LoginRedirect />
      )}
    </div>
  );
}

function LoginRedirect() {
  // Redirect to the auth flow — in the full app this would show the login page
  // For the landing page deploy, we just show a message
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="modal-overlay" onClick={() => window.location.reload()}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Faktox<span style={{ color: "var(--accent)" }}>.</span></h2>
          <button className="btn btn-ghost btn-icon" onClick={() => window.location.reload()}>×</button>
        </div>
        <div className="modal-body">
          {sent ? (
            <p style={{ textAlign: "center", color: "var(--success)" }}>Magic-Link gesendet an {email}</p>
          ) : (
            <>
              <p style={{ marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--fg-3)" }}>Einloggen mit Magic-Link</p>
              <input
                className="input"
                type="email"
                placeholder="deine@email.at"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ marginBottom: "0.75rem" }}
              />
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => email && setSent(true)}>
                Magic-Link anfordern
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

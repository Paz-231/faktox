import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { money } from "./lib";

interface EditRecurringOrderModalProps {
  template: any;
  userId: string;
  sessionToken: string;
  onClose: () => void;
  onSaved?: () => void;
}

interface EditableItem {
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  taxRate: number;
}

const UNITS = ["Stunden", "Stück", "Monate", "Pauschal", "Tag", "Quadratmeter"];

export function EditRecurringOrderModal({
  template,
  userId,
  sessionToken,
  onClose,
  onSaved,
}: EditRecurringOrderModalProps) {
  const customers = useQuery(api.customers.list, { userId: userId as any, sessionToken }) ?? [];
  const updateTemplate = useMutation(api.recurringOrderManagement.updateTemplateContent);

  const [title, setTitle] = useState(template.title || "");
  const [customerId, setCustomerId] = useState(template.customerId || "");
  const [recipientName, setRecipientName] = useState(template.recipientName || "");
  const [recipientStreet, setRecipientStreet] = useState(template.recipientStreet || "");
  const [recipientCity, setRecipientCity] = useState(template.recipientCity || "");
  const [recipientUid, setRecipientUid] = useState(template.recipientUid || "");
  const [paymentTerms, setPaymentTerms] = useState(template.paymentTerms || "");
  const [items, setItems] = useState<EditableItem[]>(
    (template.items || []).map((item: any) => ({
      description: item.description || "",
      qty: Number(item.qty || 1),
      unit: item.unit || "Stunden",
      unitPrice: Number(item.unitPrice || 0),
      taxRate: Number(item.taxRate ?? template.taxRate ?? 0),
    })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    const customer = customers.find((entry: any) => entry._id === id);
    if (!customer) return;
    setRecipientName(customer.name || "");
    setRecipientStreet(customer.street || "");
    setRecipientCity(customer.postalCityCountry || "");
    setRecipientUid(customer.uid || "");
  };

  const updateItem = (index: number, field: keyof EditableItem, value: string | number) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      return {
        ...item,
        [field]: field === "qty" || field === "unitPrice" || field === "taxRate"
          ? Number(value)
          : value,
      };
    }));
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        description: "",
        qty: 1,
        unit: "Stunden",
        unitPrice: 0,
        taxRate: Number(template.taxRate || 0),
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const netAmount = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const vatAmount = items.reduce(
    (sum, item) => sum + (item.qty * item.unitPrice * item.taxRate) / 100,
    0,
  );

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!title.trim()) {
      setError("Bitte gib der Serie einen Titel.");
      return;
    }
    if (!recipientName.trim() || !recipientStreet.trim() || !recipientCity.trim()) {
      setError("Empfängerdaten sind unvollständig.");
      return;
    }
    if (items.length === 0 || items.some((item) => !item.description.trim() || item.qty <= 0 || item.unitPrice <= 0)) {
      setError("Alle Positionen benötigen Beschreibung, Menge und Preis.");
      return;
    }

    setSaving(true);
    try {
      await updateTemplate({
        sessionToken,
        templateId: template._id,
        title: title.trim(),
        customerId: (customerId || undefined) as any,
        recipientName: recipientName.trim(),
        recipientStreet: recipientStreet.trim(),
        recipientCity: recipientCity.trim(),
        recipientUid: recipientUid.trim() || undefined,
        taxMode: template.taxMode,
        taxRate: template.taxRate,
        taxNote: template.taxNote || undefined,
        items: items.map((item, index) => ({
          pos: index + 1,
          description: item.description.trim(),
          qty: item.qty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          total: item.qty * item.unitPrice,
          taxRate: item.taxRate,
        })),
        paymentTerms: paymentTerms.trim(),
        footer: template.footer || undefined,
      });
      onSaved?.();
      onClose();
    } catch (saveError: any) {
      setError(saveError.message || "Die Serie konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "min(900px, 100%)", maxHeight: "94vh", display: "flex", flexDirection: "column" }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Wiederkehrenden Auftrag bearbeiten</h2>
            <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--fg-3)" }}>
              Änderungen gelten nur für zukünftig erzeugte Aufträge. Bereits bestehende Aufträge bleiben unverändert.
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Schließen">×</button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: "0.75rem", border: "1px solid var(--border)", background: "var(--surface-2)", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--fg-3)" }}>Rhythmus</div>
                <strong style={{ fontSize: "0.8125rem" }}>{template.frequency === "yearly" ? "Jährlich" : "Monatlich"}</strong>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--fg-3)" }}>Nächster Termin</div>
                <strong style={{ fontSize: "0.8125rem" }}>{template.nextOccurrenceDate || "—"}</strong>
              </div>
              <div>
                <div style={{ fontSize: "0.6875rem", color: "var(--fg-3)" }}>Hinweis</div>
                <strong style={{ fontSize: "0.8125rem" }}>Zeitplan bleibt unverändert</strong>
              </div>
            </div>
          </div>

          <div className="field-group" style={{ marginBottom: "1rem" }}>
            <label className="label" htmlFor="edit-recurring-title">Titel der Serie</label>
            <input id="edit-recurring-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="create-invoice-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: "1rem" }}>
            <div>
              <h4 style={{ margin: "0 0 0.5rem" }}>Empfänger</h4>
              {customers.length > 0 && (
                <div className="field-group" style={{ marginBottom: "0.5rem" }}>
                  <label className="label" htmlFor="edit-recurring-customer">Kunde auswählen</label>
                  <select
                    id="edit-recurring-customer"
                    className="input"
                    value={customerId}
                    onChange={(event) => selectCustomer(event.target.value)}
                  >
                    <option value="">Manuell eingeben</option>
                    {customers.map((customer: any) => (
                      <option key={customer._id} value={customer._id}>{customer.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="field-group" style={{ marginBottom: "0.5rem" }}>
                <label className="label" htmlFor="edit-recurring-name">Name / Firma</label>
                <input id="edit-recurring-name" className="input" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
              </div>
              <div className="field-group" style={{ marginBottom: "0.5rem" }}>
                <label className="label" htmlFor="edit-recurring-street">Straße</label>
                <input id="edit-recurring-street" className="input" value={recipientStreet} onChange={(event) => setRecipientStreet(event.target.value)} />
              </div>
              <div className="field-group" style={{ marginBottom: "0.5rem" }}>
                <label className="label" htmlFor="edit-recurring-city">PLZ + Ort + Land</label>
                <input id="edit-recurring-city" className="input" value={recipientCity} onChange={(event) => setRecipientCity(event.target.value)} />
              </div>
              <div className="field-group" style={{ marginBottom: "0.75rem" }}>
                <label className="label" htmlFor="edit-recurring-uid">UID (optional)</label>
                <input id="edit-recurring-uid" className="input" value={recipientUid} onChange={(event) => setRecipientUid(event.target.value)} />
              </div>
              <div className="field-group">
                <label className="label" htmlFor="edit-recurring-terms">Zahlungsbedingungen</label>
                <textarea
                  id="edit-recurring-terms"
                  className="input"
                  value={paymentTerms}
                  onChange={(event) => setPaymentTerms(event.target.value)}
                  style={{ minHeight: "100px", resize: "vertical" }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0 }}>Positionen</h4>
                <button className="btn btn-sm" onClick={addItem}>+ Position</button>
              </div>
              {items.map((item, index) => (
                <div key={index} style={{ padding: "0.75rem", border: "1px solid var(--border)", marginBottom: "0.625rem", background: "var(--surface-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <strong style={{ fontSize: "0.75rem" }}>Position {index + 1}</strong>
                    {items.length > 1 && (
                      <button className="btn btn-ghost btn-icon" onClick={() => removeItem(index)} aria-label={`Position ${index + 1} entfernen`}>×</button>
                    )}
                  </div>
                  <div className="field-group" style={{ marginBottom: "0.5rem" }}>
                    <label className="label">Beschreibung</label>
                    <input className="input" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "0.7fr 1fr 1fr", gap: "0.5rem" }}>
                    <div className="field-group">
                      <label className="label">Menge</label>
                      <input className="input" type="number" min="0.01" step="0.01" value={item.qty} onChange={(event) => updateItem(index, "qty", event.target.value)} />
                    </div>
                    <div className="field-group">
                      <label className="label">Einheit</label>
                      <select className="input" value={item.unit} onChange={(event) => updateItem(index, "unit", event.target.value)}>
                        {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </div>
                    <div className="field-group">
                      <label className="label">Preis</label>
                      <input className="input" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} />
                    </div>
                  </div>
                  <div style={{ marginTop: "0.5rem", textAlign: "right", fontSize: "0.75rem", fontWeight: 600 }}>
                    {money(item.qty * item.unitPrice)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "1rem", padding: "0.75rem", border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}><span>Netto je Auftrag</span><span>{money(netAmount)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginTop: "0.25rem" }}><span>USt</span><span>{money(vatAmount)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginTop: "0.375rem", paddingTop: "0.375rem", borderTop: "1px solid var(--border)" }}><span>Brutto je Auftrag</span><span>{money(netAmount + vatAmount)}</span></div>
          </div>

          {error && (
            <div role="alert" style={{ marginTop: "0.875rem", padding: "0.75rem", border: "1px solid var(--danger)", color: "var(--danger)", background: "var(--surface-2)" }}>
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ flexShrink: 0 }}>
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Speichere..." : "Änderungen für zukünftige Aufträge speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

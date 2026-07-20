import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

interface RecurringOccurrenceHistoryProps {
  templateId: string;
  sessionToken: string;
  onOpenOrder?: (orderId: string) => void;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

function occurrenceStatus(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    generated: { label: "Auftrag erstellt", className: "badge badge-success" },
    skipped: { label: "Übersprungen", className: "badge badge-warn" },
    failed: { label: "Fehlgeschlagen", className: "badge badge-danger" },
    processing: { label: "In Bearbeitung", className: "badge badge-accent" },
    scheduled: { label: "Geplant", className: "badge" },
  };
  return map[status] || { label: status, className: "badge" };
}

export function RecurringOccurrenceHistory({
  templateId,
  sessionToken,
  onOpenOrder,
}: RecurringOccurrenceHistoryProps) {
  const occurrences = useQuery(api.recurringOrders.listOccurrences, {
    sessionToken,
    templateId: templateId as any,
    limit: 20,
  });

  if (occurrences === undefined) {
    return (
      <div aria-live="polite" style={{ padding: "0.75rem", color: "var(--fg-3)", fontSize: "0.75rem" }}>
        Ausführungen werden geladen...
      </div>
    );
  }

  if (occurrences.length === 0) {
    return (
      <div style={{ padding: "0.75rem", color: "var(--fg-3)", fontSize: "0.75rem" }}>
        Noch keine Ausführungen. Der erste Auftrag wird am nächsten fälligen Termin als Entwurf angelegt.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {occurrences.map((occurrence: any) => {
        const status = occurrenceStatus(occurrence.status);
        return (
          <div
            key={occurrence._id}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(100px, 0.8fr) minmax(130px, 1fr) minmax(0, 1.6fr)",
              gap: "0.75rem",
              alignItems: "center",
              padding: "0.625rem 0.75rem",
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.625rem", color: "var(--fg-3)" }}>Termin</div>
              <strong style={{ fontSize: "0.75rem" }}>{formatDate(occurrence.occurrenceDate)}</strong>
            </div>
            <div><span className={status.className}>{status.label}</span></div>
            <div style={{ minWidth: 0 }}>
              {occurrence.generatedOrderId && onOpenOrder ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => onOpenOrder(occurrence.generatedOrderId)}
                  style={{ paddingInline: "0.625rem" }}
                >
                  Auftrag öffnen
                </button>
              ) : occurrence.errorMessage ? (
                <span style={{ color: "var(--danger)", fontSize: "0.6875rem", wordBreak: "break-word" }}>
                  {occurrence.errorMessage}
                </span>
              ) : (
                <span style={{ color: "var(--fg-3)", fontSize: "0.6875rem" }}>Keine weitere Aktion</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

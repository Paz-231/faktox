import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./authHelper";

// ═══════════════════════════════════════════════════════════
// Reports API — serverseitige Aggregation
//
// EÜR, USt-Voranmeldung und Dashboard-KPIs werden hier über
// ALLE Belege des Users berechnet. Die list-Queries liefern
// aus Bandbreitengründen nur die letzten 100 Einträge — für
// Steuerzahlen wäre das stillschweigend falsch.
// ═══════════════════════════════════════════════════════════

// Datum als DD.MM.YYYY (de-AT) oder YYYY-MM-DD → { y, m } (m 0-basiert)
function parseYm(s: string): { y: number; m: number } | null {
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) return { y: Number(dmy[3]), m: Number(dmy[2]) - 1 };
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]) - 1 };
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : { y: d.getFullYear(), m: d.getMonth() };
}

const inMonth = (s: string, m: number, y: number) => {
  const p = parseYm(s);
  return !!p && p.m === m && p.y === y;
};
const inYear = (s: string, y: number) => {
  const p = parseYm(s);
  return !!p && p.y === y;
};
const sum = (arr: any[], f: string) => arr.reduce((s, x) => s + (x[f] || 0), 0);

// Dashboard-KPIs + Berichts-Summen für einen Monat/ein Jahr
export const summary = query({
  args: { sessionToken: v.string(), month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);

    const invoices = await ctx.db
      .query("outgoingInvoices")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const incoming = await ctx.db
      .query("incomingInvoices")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const auftrags = await ctx.db
      .query("auftrags")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    // Stornierte Rechnungen und Storno-Belege selbst zählen nicht als Einnahme
    const active = invoices.filter((r) => r.status !== "storno" && !r.stornoOf);

    const monthInv = active.filter((r) => inMonth(r.date, args.month, args.year));
    const monthInc = incoming.filter((i) => inMonth(i.date, args.month, args.year));
    const yearInv = active.filter((r) => inYear(r.date, args.year));
    const yearInc = incoming.filter((i) => inYear(i.date, args.year));

    // Offene Forderungen: gestellt ("final"), aber noch nicht bezahlt
    const open = active.filter((r) => r.status === "final");

    return {
      month: {
        revenueNet: sum(monthInv, "netAmount"),
        revenueGross: sum(monthInv, "grossAmount"),
        vatReceived: sum(monthInv, "vatAmount"),
        expensesNet: sum(monthInc, "netAmount"),
        expensesGross: sum(monthInc, "grossAmount"),
        vatPaid: sum(monthInc, "vatAmount"),
        invoiceCount: monthInv.length,
        incomingCount: monthInc.length,
      },
      year: {
        revenueNet: sum(yearInv, "netAmount"),
        expensesNet: sum(yearInc, "netAmount"),
        vatReceived: sum(yearInv, "vatAmount"),
        vatPaid: sum(yearInc, "vatAmount"),
      },
      open: {
        amount: sum(open, "grossAmount"),
        count: open.length,
      },
      totals: {
        invoices: active.length,
        incoming: incoming.length,
        auftrags: auftrags.length,
      },
    };
  },
});

// Analytics-Seite: Status-Verteilungen, 6-Monats-Trend, Top-Kunden
export const analytics = query({
  args: { sessionToken: v.string(), month: v.number(), year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);

    const auftrags = await ctx.db
      .query("auftrags")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const incoming = await ctx.db
      .query("incomingInvoices")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const customers = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    const activeAuftrags = auftrags.filter((a) => a.status !== "discarded");
    const monthAuftrags = auftrags.filter((a) => inMonth(a.date, args.month, args.year));
    const yearAuftrags = auftrags.filter((a) => inYear(a.date, args.year));
    const monthActive = monthAuftrags.filter((a) => a.status !== "discarded");
    const yearActive = yearAuftrags.filter((a) => a.status !== "discarded");
    const monthInc = incoming.filter((i) => inMonth(i.date, args.month, args.year));
    const yearInc = incoming.filter((i) => inYear(i.date, args.year));
    const openInc = incoming.filter((i) => i.status === "open");

    // 6-Monats-Trend (inkl. gewähltem Monat)
    const trend: { y: number; m: number; revenue: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(args.year, args.month - i, 1);
      const m = d.getMonth();
      const y = d.getFullYear();
      trend.push({
        y,
        m,
        revenue: sum(activeAuftrags.filter((a) => inMonth(a.date, m, y)), "netAmount"),
        expenses: sum(incoming.filter((x) => inMonth(x.date, m, y)), "netAmount"),
      });
    }

    // Top 5 Kunden nach Netto-Umsatz
    const byCustomer: Record<string, number> = {};
    for (const a of activeAuftrags) {
      byCustomer[a.recipientName] = (byCustomer[a.recipientName] || 0) + (a.netAmount || 0);
    }
    const topCustomers = Object.entries(byCustomer)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, revenue]) => ({ name, revenue }));

    return {
      counts: {
        customers: customers.length,
        auftrags: auftrags.length,
        incoming: incoming.length,
        draft: auftrags.filter((a) => a.status === "draft").length,
        confirmed: auftrags.filter((a) => a.status === "confirmed").length,
        discarded: auftrags.filter((a) => a.status === "discarded").length,
        incomingOpen: openInc.length,
        incomingPaid: incoming.filter((i) => i.status === "paid").length,
      },
      month: {
        revenueNet: sum(monthActive, "netAmount"),
        vatReceived: sum(monthActive, "vatAmount"),
        expensesNet: sum(monthInc, "netAmount"),
        vatPaid: sum(monthInc, "vatAmount"),
        auftragCount: monthAuftrags.length,
        incomingCount: monthInc.length,
      },
      year: {
        revenueNet: sum(yearActive, "netAmount"),
        expensesNet: sum(yearInc, "netAmount"),
        auftragCount: yearAuftrags.length,
        incomingCount: yearInc.length,
      },
      openPayables: {
        amount: sum(openInc, "grossAmount"),
        count: openInc.length,
      },
      trend,
      topCustomers,
    };
  },
});

// DATEV-Export: alle Belege eines Jahres (serverseitig gefiltert,
// nur die Felder, die im CSV landen)
export const exportRows = query({
  args: { sessionToken: v.string(), year: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);

    const invoices = await ctx.db
      .query("outgoingInvoices")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const incoming = await ctx.db
      .query("incomingInvoices")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();

    return {
      invoices: invoices
        .filter((r) => r.status !== "storno" && !r.stornoOf && inYear(r.date, args.year))
        .map((r) => ({
          date: r.date,
          number: r.number,
          type: r.type,
          recipientName: r.recipientName,
          netAmount: r.netAmount,
          taxRate: r.taxRate,
          vatAmount: r.vatAmount,
          grossAmount: r.grossAmount,
          status: r.status,
        })),
      incoming: incoming
        .filter((i) => inYear(i.date, args.year))
        .map((i) => ({
          date: i.date,
          number: i.number,
          issuerName: i.issuerName,
          netAmount: i.netAmount || 0,
          taxRate: i.taxRate || 0,
          vatAmount: i.vatAmount || 0,
          grossAmount: i.grossAmount || 0,
          status: i.status,
        })),
    };
  },
});

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════
// Angebote API — optionales Dokument vor Auftrag
// ═══════════════════════════════════════════════════════════

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("angebots")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { angebotId: v.id("angebots") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.angebotId);
  },
});

// Get next angebot number (AN- prefix)
export const getNextNumber = mutation({
  args: { userId: v.id("users"), year: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("numberSequences")
      .withIndex("userId_year", (q) => q.eq("userId", args.userId).eq("year", args.year))
      .first();

    if (existing) {
      const nextNum = existing.nextNumber;
      await ctx.db.patch(existing._id, { nextNumber: nextNum + 1 });
      return `AN-${args.year}-${String(nextNum).padStart(6, "0")}`;
    } else {
      await ctx.db.insert("numberSequences", {
        userId: args.userId,
        year: args.year,
        nextNumber: 2,
        createdAt: Date.now(),
      });
      return `AN-${args.year}-000001`;
    }
  },
});

// Create angebot
export const create = mutation({
  args: {
    userId: v.id("users"),
    number: v.string(),
    date: v.string(),
    validUntil: v.optional(v.string()),
    deliveryDate: v.optional(v.string()),
    recipientName: v.string(),
    recipientStreet: v.string(),
    recipientCity: v.string(),
    recipientUid: v.optional(v.string()),
    taxMode: v.string(),
    taxRate: v.number(),
    taxNote: v.optional(v.string()),
    netAmount: v.number(),
    vatAmount: v.number(),
    grossAmount: v.number(),
    items: v.array(v.object({
      pos: v.number(),
      description: v.string(),
      qty: v.number(),
      unit: v.string(),
      unitPrice: v.number(),
      total: v.number(),
    })),
    paymentTerms: v.optional(v.string()),
    footer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const angebotId = await ctx.db.insert("angebots", {
      ...args,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: "angebot_created",
      details: `Angebot ${args.number} — €${args.grossAmount.toFixed(2)}`,
      timestamp: now,
    });

    return angebotId;
  },
});

// Mark as sent
export const markSent = mutation({
  args: { angebotId: v.id("angebots") },
  handler: async (ctx, args) => {
    const angebot = await ctx.db.get(args.angebotId);
    if (!angebot) throw new Error("Angebot not found");

    await ctx.db.patch(args.angebotId, {
      status: "sent",
      sentDate: new Date().toLocaleDateString("de-AT"),
      updatedAt: Date.now(),
    });
  },
});

// Confirm angebot → generates Auftrag
export const confirm = mutation({
  args: { angebotId: v.id("angebots") },
  handler: async (ctx, args) => {
    const angebot = await ctx.db.get(args.angebotId);
    if (!angebot) throw new Error("Angebot not found");
    if (angebot.status === "discarded") throw new Error("Angebot was discarded");
    if (angebot.auftragId) throw new Error("Angebot already has an auftrag");

    // Generate auftrag number
    const year = new Date().getFullYear();
    const existing = await ctx.db
      .query("numberSequences")
      .withIndex("userId_year", (q) => q.eq("userId", angebot.userId).eq("year", year))
      .first();

    let auftragNumber: string;
    if (existing) {
      const nextNum = existing.nextNumber;
      await ctx.db.patch(existing._id, { nextNumber: nextNum + 1 });
      auftragNumber = `AU-${year}-${String(nextNum).padStart(6, "0")}`;
    } else {
      await ctx.db.insert("numberSequences", {
        userId: angebot.userId,
        year,
        nextNumber: 2,
        createdAt: Date.now(),
      });
      auftragNumber = `AU-${year}-000001`;
    }

    const now = Date.now();
    const auftragId = await ctx.db.insert("auftrags", {
      userId: angebot.userId,
      number: auftragNumber,
      date: new Date().toLocaleDateString("de-AT"),
      deliveryDate: angebot.deliveryDate,
      recipientName: angebot.recipientName,
      recipientStreet: angebot.recipientStreet,
      recipientCity: angebot.recipientCity,
      recipientUid: angebot.recipientUid,
      taxMode: angebot.taxMode,
      taxRate: angebot.taxRate,
      taxNote: angebot.taxNote,
      netAmount: angebot.netAmount,
      vatAmount: angebot.vatAmount,
      grossAmount: angebot.grossAmount,
      items: angebot.items,
      status: "confirmed", // Auto-confirmed because it came from a confirmed angebot
      confirmedDate: new Date().toLocaleDateString("de-AT"),
      angebotId: args.angebotId,
      rechnungIds: [],
      paymentTerms: angebot.paymentTerms || "Zahlbar ohne Abzug innerhalb von 7 Tagen.",
      footer: angebot.footer,
      createdAt: now,
      updatedAt: now,
    });

    // Link angebot → auftrag
    await ctx.db.patch(args.angebotId, {
      status: "confirmed",
      confirmedDate: new Date().toLocaleDateString("de-AT"),
      auftragId,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: angebot.userId,
      action: "angebot_confirmed",
      details: `Angebot ${angebot.number} → Auftrag ${auftragNumber}`,
      timestamp: now,
    });

    return { auftragId, auftragNumber };
  },
});

// Discard angebot
export const discard = mutation({
  args: { angebotId: v.id("angebots") },
  handler: async (ctx, args) => {
    const angebot = await ctx.db.get(args.angebotId);
    if (!angebot) throw new Error("Angebot not found");
    if (angebot.auftragId) throw new Error("Cannot discard — Auftrag already generated");

    await ctx.db.patch(args.angebotId, {
      status: "discarded",
      updatedAt: Date.now(),
    });
  },
});

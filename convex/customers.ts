import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════
// Customers API — Kundenstamm
// ═══════════════════════════════════════════════════════════

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    street: v.optional(v.string()),
    postalCityCountry: v.optional(v.string()),
    uid: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customers", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const findByName = query({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("customers")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .collect();
    const lower = args.name.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(lower));
  },
});

// Get single customer by ID
export const getById = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.customerId);
  },
});

// Update customer
export const update = mutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    street: v.optional(v.string()),
    postalCityCountry: v.optional(v.string()),
    uid: v.optional(v.string()),
    email: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...updates } = args;
    // Remove undefined values
    const clean: any = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    await ctx.db.patch(customerId, clean);
    return { success: true };
  },
});

// Get all documents for a customer — Angebote, Aufträge, Rechnungen, Stornos
export const getDocuments = query({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) return null;

    const userId = customer.userId;
    const name = customer.name;

    // Find all aufträge for this customer (by recipientName match since customerId is optional)
    const allAuftrags = await ctx.db
      .query("auftrags")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const auftrags = allAuftrags.filter(
      (a) => a.customerId === args.customerId || a.recipientName === name
    );

    // Find all angebote matching the same recipientName
    const allAngebots = await ctx.db
      .query("angebots")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const angebots = allAngebots.filter((a) => a.recipientName === name);

    // Find all rechnungen from the aufträge
    const rechnungIds = auftrags.flatMap((a) => a.rechnungIds || []);
    const rechnungen = [];
    for (const rid of rechnungIds) {
      const r = await ctx.db.get(rid);
      if (r) rechnungen.push(r);
    }

    // Stornos = rechnungen with stornoOf or stornoNumber
    const stornos = rechnungen.filter((r) => r.stornoOf || r.stornoNumber);

    return { angebots, auftrags, rechnungen, stornos };
  },
});

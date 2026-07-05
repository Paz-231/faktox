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

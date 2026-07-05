import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════
// Settings API — User-Einstellungen
// ═══════════════════════════════════════════════════════════

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const upsert = mutation({
  args: {
    userId: v.id("users"),
    rechnungMode: v.string(), // "auto" | "manual"
    defaultTaxMode: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rechnungMode: args.rechnungMode,
        defaultTaxMode: args.defaultTaxMode,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("settings", {
        userId: args.userId,
        rechnungMode: args.rechnungMode,
        defaultTaxMode: args.defaultTaxMode,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

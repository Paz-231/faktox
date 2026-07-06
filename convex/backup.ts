import { httpAction, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════
// Backup & Export — vollständiger Daten-Export pro User
// ═══════════════════════════════════════════════════════════

// Export ALL user data as JSON (for download + backup)
export const exportAllData = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate session
  const session = await ctx.runQuery(api.auth.validateSession, { token });
  if (!session) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.userId;

  // Collect ALL user data
  const [
    customers,
    auftrags,
    angebots,
    invoices,
    incomingInvoices,
    dunningLetters,
    numberSequences,
    settings,
    profile,
    auditLog,
  ] = await Promise.all([
    ctx.runQuery(api.customers.list, { userId }),
    ctx.runQuery(api.auftrags.list, { userId }),
    // For angebots and invoices we need to query them too
    ctx.runQuery(api.backup.getUserAngebots, { userId }),
    ctx.runQuery(api.backup.getUserInvoices, { userId }),
    ctx.runQuery(api.incoming.list, { userId }),
    ctx.runQuery(api.backup.getUserDunningLetters, { userId }),
    ctx.runQuery(api.backup.getUserNumberSequences, { userId }),
    ctx.runQuery(api.settings.get, { userId }),
    ctx.runQuery(api.profile.get, { userId }),
    ctx.runQuery(api.backup.getUserAuditLog, { userId }),
  ]);

  const backup = {
    metadata: {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      email: session.email,
      userId: userId,
      totalRecords:
        (customers as any[]).length +
        (auftrags as any[]).length +
        (angebots as any[]).length +
        (invoices as any[]).length +
        (incomingInvoices as any[]).length,
    },
    customers,
    auftrags,
    angebots,
    invoices,
    incomingInvoices,
    dunningLetters,
    numberSequences,
    settings,
    profile,
    auditLog,
  };

  const json = JSON.stringify(backup, null, 2);
  const fileName = `faktox-backup-${new Date().toISOString().split("T")[0]}.json`;

  return new Response(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// Get backup summary (for settings page)
export const getBackupSummary = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [customers, auftrags, incoming] = await Promise.all([
      ctx.db.query("customers").withIndex("userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("auftrags").withIndex("userId", (q) => q.eq("userId", args.userId)).collect(),
      ctx.db.query("incomingInvoices").withIndex("userId", (q) => q.eq("userId", args.userId)).collect(),
    ]);

    const angebots = await ctx.db.query("angebots").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
    const invoices = await ctx.db.query("outgoingInvoices").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
    const dunning = await ctx.db.query("dunningLetters").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
    const audit = await ctx.db.query("auditLog").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();

    return {
      customers: customers.length,
      auftrags: auftrags.length,
      angebots: angebots.length,
      invoices: invoices.length,
      incomingInvoices: incoming.length,
      dunningLetters: dunning.length,
      auditLogEntries: audit.length,
      totalRecords:
        customers.length + auftrags.length + angebots.length +
        invoices.length + incoming.length + dunning.length + audit.length,
    };
  },
});

// ─── Internal queries for backup ────────────────────────────

export const getUserAngebots = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("angebots").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUserInvoices = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("outgoingInvoices").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUserDunningLetters = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("dunningLetters").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUserNumberSequences = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("numberSequences").withIndex("userId_year", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUserAuditLog = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("auditLog").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

// ─── Queries for automated backup (no session needed, admin-only) ─

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const getUsersCustomers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("customers").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUsersAuftrags = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("auftrags").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUsersIncoming = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("incomingInvoices").withIndex("userId", (q) => q.eq("userId", args.userId)).collect();
  },
});

export const getUsersSettings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("settings").withIndex("userId", (q) => q.eq("userId", args.userId)).first();
  },
});

export const getUsersProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("businessProfiles").withIndex("userId", (q) => q.eq("userId", args.userId)).first();
  },
});

// ─── Mutation: save backup record ───────────────────────────

export const saveBackupRecord = mutation({
  args: {
    userId: v.id("users"),
    storageId: v.string(),
    fileName: v.string(),
    sizeBytes: v.number(),
    recordCount: v.number(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("backups", {
      userId: args.userId,
      storageId: args.storageId as any,
      fileName: args.fileName,
      sizeBytes: args.sizeBytes,
      recordCount: args.recordCount,
      type: args.type,
      createdAt: Date.now(),
    });
  },
});

// ─── List backups for user (Settings page) ──────────────────

export const listBackups = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("backups")
      .withIndex("userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(30); // last 30 backups
  },
});

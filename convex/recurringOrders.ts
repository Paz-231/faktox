import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "./authHelper";
import {
  createRecurrenceSchedule,
  dateInTimeZone,
  nextOccurrence,
  parseIsoDate,
  previewOccurrences,
  type RecurrenceSchedule,
} from "../shared/recurrence";

const lineItemValidator = v.object({
  pos: v.number(),
  description: v.string(),
  qty: v.number(),
  unit: v.string(),
  unitPrice: v.number(),
  total: v.number(),
  taxRate: v.optional(v.number()),
});

const frequencyValidator = v.union(v.literal("monthly"), v.literal("yearly"));
const endModeValidator = v.union(v.literal("never"), v.literal("on_date"), v.literal("after_occurrences"));
const templateStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("completed"),
  v.literal("error"),
);

const templateValidator = v.object({
  _id: v.id("recurringOrderTemplates"),
  _creationTime: v.number(),
  userId: v.id("users"),
  title: v.string(),
  customerId: v.optional(v.id("customers")),
  recipientName: v.string(),
  recipientStreet: v.string(),
  recipientCity: v.string(),
  recipientUid: v.optional(v.string()),
  taxMode: v.string(),
  taxRate: v.number(),
  taxNote: v.optional(v.string()),
  items: v.array(lineItemValidator),
  paymentTerms: v.string(),
  footer: v.optional(v.string()),
  frequency: frequencyValidator,
  interval: v.number(),
  startDate: v.string(),
  timezone: v.string(),
  endMode: endModeValidator,
  endDate: v.optional(v.string()),
  maxOccurrences: v.optional(v.number()),
  anchorDay: v.number(),
  anchorMonth: v.optional(v.number()),
  lastDayOfMonth: v.boolean(),
  status: templateStatusValidator,
  nextOccurrenceDate: v.optional(v.string()),
  lastOccurrenceDate: v.optional(v.string()),
  occurrenceCount: v.number(),
  generatedCount: v.number(),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function scheduleFromTemplate(template: Doc<"recurringOrderTemplates">): RecurrenceSchedule {
  return {
    frequency: template.frequency,
    interval: template.interval,
    startDate: template.startDate,
    timezone: template.timezone,
    endMode: template.endMode,
    endDate: template.endDate,
    maxOccurrences: template.maxOccurrences,
    anchorDay: template.anchorDay,
    anchorMonth: template.anchorMonth,
    lastDayOfMonth: template.lastDayOfMonth,
  };
}

function normalizeItems(items: Array<{
  pos: number;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  taxRate?: number;
}>, taxMode: string) {
  const defaultRates: Record<string, number> = {
    kleinunternehmer: 0,
    ust_standard: 20,
    ust_ermaessigt: 10,
    reverse_charge: 0,
    befreit: 0,
  };
  const defaultRate = defaultRates[taxMode] ?? 0;
  if (items.length === 0) throw new Error("Mindestens eine Position ist erforderlich");
  return items.map((item, index) => {
    if (!item.description.trim() || item.qty <= 0 || item.unitPrice <= 0) {
      throw new Error(`Position ${index + 1} ist unvollständig`);
    }
    return {
      pos: index + 1,
      description: item.description.trim(),
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.qty * item.unitPrice,
      taxRate: item.taxRate ?? defaultRate,
    };
  });
}

function calculateTax(items: ReturnType<typeof normalizeItems>) {
  const grouped = new Map<number, { netAmount: number; vatAmount: number; grossAmount: number }>();
  let netAmount = 0;
  let vatAmount = 0;
  for (const item of items) {
    const rate = item.taxRate ?? 0;
    const vat = rate > 0 ? (item.total * rate) / 100 : 0;
    netAmount += item.total;
    vatAmount += vat;
    const current = grouped.get(rate) ?? { netAmount: 0, vatAmount: 0, grossAmount: 0 };
    current.netAmount += item.total;
    current.vatAmount += vat;
    current.grossAmount += item.total + vat;
    grouped.set(rate, current);
  }
  return {
    netAmount,
    vatAmount,
    grossAmount: netAmount + vatAmount,
    taxBreakdown: [...grouped.entries()]
      .map(([taxRate, amounts]) => ({ taxRate, ...amounts }))
      .sort((a, b) => b.taxRate - a.taxRate),
  };
}

function isoToDisplayDate(isoDate: string): string {
  const { year, month, day } = parseIsoDate(isoDate);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}

async function nextOrderNumber(
  ctx: MutationCtx,
  userId: Id<"users">,
  occurrenceDate: string,
): Promise<string> {
  const { year } = parseIsoDate(occurrenceDate);
  const existing = await ctx.db
    .query("numberSequences")
    .withIndex("userId_year", (q) => q.eq("userId", userId).eq("year", year))
    .first();
  if (existing) {
    const number = existing.nextNumber;
    await ctx.db.patch(existing._id, { nextNumber: number + 1 });
    return `AU-${year}-${String(number).padStart(6, "0")}`;
  }
  await ctx.db.insert("numberSequences", {
    userId,
    year,
    nextNumber: 2,
    createdAt: Date.now(),
  });
  return `AU-${year}-000001`;
}

function findOccurrenceOnOrAfter(
  schedule: RecurrenceSchedule,
  startIndex: number,
  minimumDate: string,
): { index: number; date: string } | null {
  for (let index = startIndex; index < startIndex + 2400; index += 1) {
    const date = nextOccurrence(schedule, index);
    if (!date) return null;
    if (date >= minimumDate) return { index, date };
  }
  throw new Error("Wiederholungsserie überschreitet den unterstützten Planungshorizont");
}

export const preview = query({
  args: {
    sessionToken: v.string(),
    frequency: frequencyValidator,
    startDate: v.string(),
    timezone: v.string(),
    interval: v.optional(v.number()),
    endMode: v.optional(endModeValidator),
    endDate: v.optional(v.string()),
    maxOccurrences: v.optional(v.number()),
    count: v.optional(v.number()),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await getAuthUserId(ctx, args.sessionToken);
    dateInTimeZone(args.timezone);
    const schedule = createRecurrenceSchedule(args);
    return previewOccurrences(schedule, Math.min(args.count ?? 3, 12));
  },
});

export const createTemplate = mutation({
  args: {
    sessionToken: v.string(),
    title: v.string(),
    customerId: v.optional(v.id("customers")),
    recipientName: v.string(),
    recipientStreet: v.string(),
    recipientCity: v.string(),
    recipientUid: v.optional(v.string()),
    taxMode: v.string(),
    taxRate: v.number(),
    taxNote: v.optional(v.string()),
    items: v.array(lineItemValidator),
    paymentTerms: v.string(),
    footer: v.optional(v.string()),
    frequency: frequencyValidator,
    interval: v.optional(v.number()),
    startDate: v.string(),
    timezone: v.string(),
    endMode: v.optional(endModeValidator),
    endDate: v.optional(v.string()),
    maxOccurrences: v.optional(v.number()),
  },
  returns: v.id("recurringOrderTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Benutzer nicht gefunden");
    if (user.plan === "free") {
      throw new Error("Wiederkehrende Aufträge sind im Starter- und Pro-Plan verfügbar");
    }
    dateInTimeZone(args.timezone);
    if (args.customerId) {
      const customer = await ctx.db.get(args.customerId);
      if (!customer || customer.userId !== userId) throw new Error("Kunde nicht gefunden");
    }
    if (!args.title.trim()) throw new Error("Titel ist erforderlich");
    if (!args.recipientName.trim() || !args.recipientStreet.trim() || !args.recipientCity.trim()) {
      throw new Error("Empfängerdaten sind unvollständig");
    }
    const schedule = createRecurrenceSchedule(args);
    const items = normalizeItems(args.items, args.taxMode);
    const now = Date.now();
    const templateId = await ctx.db.insert("recurringOrderTemplates", {
      userId,
      title: args.title.trim(),
      ...(args.customerId ? { customerId: args.customerId } : {}),
      recipientName: args.recipientName.trim(),
      recipientStreet: args.recipientStreet.trim(),
      recipientCity: args.recipientCity.trim(),
      ...(args.recipientUid ? { recipientUid: args.recipientUid } : {}),
      taxMode: args.taxMode,
      taxRate: args.taxRate,
      ...(args.taxNote ? { taxNote: args.taxNote } : {}),
      items,
      paymentTerms: args.paymentTerms,
      ...(args.footer ? { footer: args.footer } : {}),
      ...schedule,
      status: "active",
      nextOccurrenceDate: schedule.startDate,
      occurrenceCount: 0,
      generatedCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId,
      action: "recurring_order_created",
      details: `${args.title.trim()} — ${schedule.frequency} ab ${schedule.startDate}`,
      timestamp: now,
    });
    return templateId;
  },
});

export const listTemplates = query({
  args: { sessionToken: v.string(), status: v.optional(templateStatusValidator) },
  returns: v.array(templateValidator),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    if (args.status) {
      return await ctx.db
        .query("recurringOrderTemplates")
        .withIndex("userId_status", (q) => q.eq("userId", userId).eq("status", args.status!))
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("recurringOrderTemplates")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
  },
});

export const getTemplate = query({
  args: { sessionToken: v.string(), templateId: v.id("recurringOrderTemplates") },
  returns: v.union(templateValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    if (template.userId !== userId) throw new Error("Zugriff verweigert");
    return template;
  },
});

export const pauseTemplate = mutation({
  args: { sessionToken: v.string(), templateId: v.id("recurringOrderTemplates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) throw new Error("Serie nicht gefunden");
    if (template.status !== "active") throw new Error("Nur aktive Serien können pausiert werden");
    await ctx.db.patch(template._id, { status: "paused", updatedAt: Date.now() });
    return null;
  },
});

export const resumeTemplate = mutation({
  args: { sessionToken: v.string(), templateId: v.id("recurringOrderTemplates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) throw new Error("Serie nicht gefunden");
    if (template.status !== "paused" && template.status !== "error") {
      throw new Error("Nur pausierte oder fehlerhafte Serien können fortgesetzt werden");
    }
    const today = dateInTimeZone(template.timezone);
    const next = findOccurrenceOnOrAfter(scheduleFromTemplate(template), template.occurrenceCount, today);
    if (!next) {
      await ctx.db.patch(template._id, {
        status: "completed",
        nextOccurrenceDate: undefined,
        errorMessage: undefined,
        updatedAt: Date.now(),
      });
      return null;
    }
    await ctx.db.patch(template._id, {
      status: "active",
      occurrenceCount: next.index,
      nextOccurrenceDate: next.date,
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const endTemplate = mutation({
  args: { sessionToken: v.string(), templateId: v.id("recurringOrderTemplates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) throw new Error("Serie nicht gefunden");
    await ctx.db.patch(template._id, {
      status: "completed",
      nextOccurrenceDate: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const skipNextOccurrence = mutation({
  args: { sessionToken: v.string(), templateId: v.id("recurringOrderTemplates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx, args.sessionToken);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) throw new Error("Serie nicht gefunden");
    if (template.status !== "active" && template.status !== "paused") {
      throw new Error("Nur aktive oder pausierte Serien können übersprungen werden");
    }
    if (!template.nextOccurrenceDate) throw new Error("Kein Termin zum Überspringen");
    const existing = await ctx.db
      .query("recurringOrderOccurrences")
      .withIndex("templateId_occurrenceDate", (q) =>
        q.eq("templateId", template._id).eq("occurrenceDate", template.nextOccurrenceDate!),
      )
      .first();
    if (!existing) {
      const now = Date.now();
      await ctx.db.insert("recurringOrderOccurrences", {
        userId,
        templateId: template._id,
        occurrenceIndex: template.occurrenceCount,
        occurrenceDate: template.nextOccurrenceDate,
        occurrenceKey: `${template._id}:${template.nextOccurrenceDate}`,
        status: "skipped",
        attemptCount: 0,
        createdAt: now,
        processedAt: now,
      });
    }
    const nextCount = template.occurrenceCount + 1;
    const following = nextOccurrence(scheduleFromTemplate(template), nextCount);
    await ctx.db.patch(template._id, {
      occurrenceCount: nextCount,
      nextOccurrenceDate: following ?? undefined,
      status: following ? template.status : "completed",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const processDueTemplates = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const scanThrough = dateInTimeZone("Pacific/Kiritimati");
    const due = await ctx.db
      .query("recurringOrderTemplates")
      .withIndex("status_nextOccurrenceDate", (q) =>
        q.eq("status", "active").lte("nextOccurrenceDate", scanThrough),
      )
      .take(50);
    let scheduled = 0;
    for (const template of due) {
      if (!template.nextOccurrenceDate) continue;
      if (template.nextOccurrenceDate > dateInTimeZone(template.timezone)) continue;
      await ctx.scheduler.runAfter(0, internal.recurringOrders.generateOccurrence, {
        templateId: template._id,
        expectedDate: template.nextOccurrenceDate,
      });
      scheduled += 1;
    }
    return scheduled;
  },
});

export const generateOccurrence = internalMutation({
  args: {
    templateId: v.id("recurringOrderTemplates"),
    expectedDate: v.string(),
  },
  returns: v.object({
    status: v.union(v.literal("generated"), v.literal("skipped"), v.literal("error")),
    orderId: v.optional(v.id("auftrags")),
  }),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template || template.status !== "active" || template.nextOccurrenceDate !== args.expectedDate) {
      return { status: "skipped" as const };
    }
    if (args.expectedDate > dateInTimeZone(template.timezone)) return { status: "skipped" as const };
    const existing = await ctx.db
      .query("recurringOrderOccurrences")
      .withIndex("templateId_occurrenceDate", (q) =>
        q.eq("templateId", template._id).eq("occurrenceDate", args.expectedDate),
      )
      .first();
    if (existing) {
      return existing.generatedOrderId
        ? { status: "generated" as const, orderId: existing.generatedOrderId }
        : { status: "skipped" as const };
    }
    const user = await ctx.db.get(template.userId);
    if (!user || user.plan === "free") {
      await ctx.db.patch(template._id, {
        status: "error",
        errorMessage: "Wiederkehrende Aufträge benötigen einen aktiven Starter- oder Pro-Plan",
        updatedAt: Date.now(),
      });
      return { status: "error" as const };
    }

    const now = Date.now();
    const items = normalizeItems(template.items, template.taxMode);
    const totals = calculateTax(items);
    const number = await nextOrderNumber(ctx, template.userId, args.expectedDate);
    const occurrenceId = await ctx.db.insert("recurringOrderOccurrences", {
      userId: template.userId,
      templateId: template._id,
      occurrenceIndex: template.occurrenceCount,
      occurrenceDate: args.expectedDate,
      occurrenceKey: `${template._id}:${args.expectedDate}`,
      status: "processing",
      attemptCount: 1,
      createdAt: now,
    });
    const orderId = await ctx.db.insert("auftrags", {
      userId: template.userId,
      number,
      date: isoToDisplayDate(args.expectedDate),
      ...(template.customerId ? { customerId: template.customerId } : {}),
      recipientName: template.recipientName,
      recipientStreet: template.recipientStreet,
      recipientCity: template.recipientCity,
      ...(template.recipientUid ? { recipientUid: template.recipientUid } : {}),
      taxMode: template.taxMode,
      taxRate: template.taxRate,
      ...(template.taxNote ? { taxNote: template.taxNote } : {}),
      taxBreakdown: totals.taxBreakdown,
      netAmount: totals.netAmount,
      vatAmount: totals.vatAmount,
      grossAmount: totals.grossAmount,
      items,
      status: "draft",
      rechnungIds: [],
      recurringTemplateId: template._id,
      recurringOccurrenceId: occurrenceId,
      scheduledFor: args.expectedDate,
      createdAutomatically: true,
      paymentTerms: template.paymentTerms,
      ...(template.footer ? { footer: template.footer } : {}),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(occurrenceId, {
      status: "generated",
      generatedOrderId: orderId,
      processedAt: now,
    });
    const nextCount = template.occurrenceCount + 1;
    const following = nextOccurrence(scheduleFromTemplate(template), nextCount);
    await ctx.db.patch(template._id, {
      occurrenceCount: nextCount,
      generatedCount: template.generatedCount + 1,
      lastOccurrenceDate: args.expectedDate,
      nextOccurrenceDate: following ?? undefined,
      status: following ? "active" : "completed",
      errorMessage: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: template.userId,
      action: "recurring_order_generated",
      details: `${number} aus Serie ${template.title} für ${args.expectedDate}`,
      timestamp: now,
    });
    return { status: "generated" as const, orderId };
  },
});

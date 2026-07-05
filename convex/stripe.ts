import { httpAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════
// Stripe Webhook Handler — Convex HTTP Action
// ═══════════════════════════════════════════════════════════
//
// Stripe sendet webhooks hierher bei:
// - checkout.session.completed → User hat abonniert
// - customer.subscription.updated → Plan geändert
// - customer.subscription.deleted → Abo gekündigt
//
// Setup:
// 1. Stripe Webhook Endpoint: https://your-domain.com/convex/stripeWebhook
// 2. Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
// 3. Copy signing secret → STRIPE_WEBHOOK_SECRET env var

export const stripeWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !stripeKey) {
    return new Response(JSON.stringify({ error: "Stripe not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify webhook signature
  let event;
  try {
    // Dynamic import to avoid bundling stripe in Convex
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" as any });
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;
      const customerEmail = session.customer_details?.email || "";
      const metadata = session.metadata || {};

      // Find user by email
      const user = await ctx.runQuery(api.auth.getUserByEmail, { email: customerEmail });
      if (!user) {
        console.error("User not found for email:", customerEmail);
        break;
      }

      // Determine plan from metadata
      const plan = metadata.plan || "starter";
      await ctx.runMutation(api.auth.updateSubscription, {
        userId: user._id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan,
        planStatus: "active",
      });

      console.log(`✅ Subscription activated: ${customerEmail} → ${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const status = subscription.status;
      const priceId = subscription.items?.data?.[0]?.price?.id;

      // Determine plan from price ID
      const plan = priceIdToPlan(priceId);

      // Find user by Stripe customer ID
      const user = await ctx.runQuery(api.auth.getUserByStripeCustomer, { customerId });
      if (user) {
        await ctx.runMutation(api.auth.updateSubscription, {
          userId: user._id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          plan,
          planStatus: status === "active" ? "active" : status,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      const user = await ctx.runQuery(api.auth.getUserByStripeCustomer, { customerId });
      if (user) {
        await ctx.runMutation(api.auth.updateSubscription, {
          userId: user._id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          plan: "free",
          planStatus: "canceled",
        });
      }
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

// Also expose as POST endpoint
export const stripeWebhookPost = httpAction(async (ctx, request) => {
  return stripeWebhook(ctx, request);
});

// ─── Helpers ────────────────────────────────────────────────

function priceIdToPlan(priceId: string | undefined): string {
  if (!priceId) return "free";
  // These will be set by the setup script
  const starterPriceId = process.env.STRIPE_PRICE_STARTER;
  const proPriceId = process.env.STRIPE_PRICE_PRO;
  if (priceId === proPriceId) return "pro";
  if (priceId === starterPriceId) return "starter";
  return "free";
}

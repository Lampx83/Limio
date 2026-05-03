import { NextResponse } from "next/server";
import Stripe from "stripe";
import { processStripeWebhook, getStripe } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Stripe webhook receiver. Verifies signature against
 * STRIPE_WEBHOOK_SECRET, then dispatches via processStripeWebhook.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "no_signature" }, { status: 400 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "webhook_not_configured" },
      { status: 503 },
    );
  }
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_signature", details: (e as Error).message },
      { status: 400 },
    );
  }

  try {
    await processStripeWebhook(event);
    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json(
      { error: "processing_failed", details: (e as Error).message },
      { status: 500 },
    );
  }
}

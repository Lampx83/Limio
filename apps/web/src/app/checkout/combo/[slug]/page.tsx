import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBundleBySlug, isAdmin, ownedCourseIdsInBundle } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getPaymentEnabled, getSiteSetting } from "@/lib/site-settings";
import { getConfiguredPaymentProviders } from "@/lib/paymentProviders";
import { bundleCheckoutGate } from "@/lib/checkoutGate";
import BundleCheckoutView from "@/components/checkout/BundleCheckoutView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Thanh toán combo | Limio", robots: { index: false, follow: false, nocache: true } };

/** Trang thanh toán combo (docs/tieu-chi/trang-thanh-toan.md, AC2). */
export default async function BundleCheckoutPage({ params }: { params: { slug: string } }) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const admin = userId ? await isAdmin(userId) : false;

  const bundle = await getBundleBySlug(params.slug, { allowDraft: admin });
  const paymentEnabled = await getPaymentEnabled();
  const gate = bundleCheckoutGate({ slug: params.slug, userId, bundle, paymentEnabled });
  if (gate.kind === "notFound" || !bundle) notFound();
  if (gate.kind === "redirect") redirect(gate.to);

  const [owned, providers] = await Promise.all([
    userId ? ownedCourseIdsInBundle(userId, bundle.id) : Promise.resolve([] as string[]),
    getConfiguredPaymentProviders().catch((): Awaited<ReturnType<typeof getConfiguredPaymentProviders>> => []),
  ]);
  const gateways = (["vnpay", "sepay_pg", "sepay"] as const).filter((p) => providers.includes(p));
  const transferInstructions = gateways.length === 0 ? await getSiteSetting("payment.transfer_instructions") : null;

  return <BundleCheckoutView bundle={bundle} ownedCount={owned.length} gateways={[...gateways]} transferInstructions={transferInstructions} />;
}

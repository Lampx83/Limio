import { NextResponse } from "next/server";
import { getPlatformJwks } from "@feedbackme/core-lms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public JWKS endpoint per OIDC. LTI tools fetch this to verify our signed
 * id_tokens. No auth — keys are public by design.
 */
export async function GET() {
  const jwks = await getPlatformJwks();
  return NextResponse.json(jwks, {
    headers: { "cache-control": "public, max-age=300" },
  });
}

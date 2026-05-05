import { NextResponse } from "next/server";
import {
  getIntegrationSecret,
  IntegrationError,
  isAdmin,
  testOpenAiKey,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Test an OpenAI key. Two modes:
 *   - body { value: "sk-..." } — test ad-hoc value before saving
 *   - empty body — test the currently saved key
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = ((await readJson(req)) ?? {}) as { value?: string };
  let key = body.value;
  if (!key) {
    try {
      key = await getIntegrationSecret("openai");
    } catch (e) {
      if (e instanceof IntegrationError && e.code === "key_not_found") {
        return NextResponse.json({ ok: false, error: "no_key_saved" }, { status: 400 });
      }
      throw e;
    }
  }
  const result = await testOpenAiKey(key);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { testVbeeCredentials } from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError, isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Test cặp App-Id + Token của Vbee ĐÃ LƯU (không có mode "test trước khi lưu"
 * như OpenAI — App-Id và Token là hai field độc lập trên UI nên không có một
 * giá trị "đang gõ" duy nhất để test tạm).
 */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let appId: string;
  let token: string;
  try {
    [appId, token] = await Promise.all([
      getIntegrationSecret("vbee.app_id"),
      getIntegrationSecret("vbee.token"),
    ]);
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      return NextResponse.json({ ok: false, error: "no_key_saved" }, { status: 400 });
    }
    throw e;
  }

  const result = await testVbeeCredentials({ appId, token });
  return NextResponse.json(result);
}

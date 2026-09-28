import { NextResponse } from "next/server";
import {
  getIntegrationSecret,
  IntegrationError,
  isAdmin,
  testGa4Credential,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Test cặp Property ID + Service account JSON của GA4 ĐÃ LƯU — cùng lý do
 * không có mode "test trước khi lưu" như vbee/test/route.ts: hai field độc
 * lập, không có một giá trị "đang gõ" duy nhất để test tạm.
 */
export async function POST() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let propertyId: string;
  let serviceAccountJson: string;
  try {
    [propertyId, serviceAccountJson] = await Promise.all([
      getIntegrationSecret("ga4.property_id"),
      getIntegrationSecret("ga4.service_account"),
    ]);
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      return NextResponse.json({ ok: false, error: "no_key_saved" }, { status: 400 });
    }
    throw e;
  }

  const result = await testGa4Credential(propertyId, serviceAccountJson);
  return NextResponse.json(result);
}

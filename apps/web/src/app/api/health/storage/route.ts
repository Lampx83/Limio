import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { storageFor } from "@/lib/storage";
import { lessonVideoKeyFromFilename } from "@/lib/storage-keys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/health/storage — kiểm tra đường ĐỌC DỮ LIỆU từ kho tệp (MinIO/S3), cho giám sát ngoài (Sim).
 *
 * `/api/health` chỉ thấy DB + Redis; khi kho tệp nghẽn, HEAD/list vẫn trả lời ngay nhưng phần thân đọc
 * được vài KB rồi đứng — trang chủ vẫn 200 trong lúc mọi video/PDF không mở được (sự cố 15–16/11/2026).
 * Endpoint này đọc thật 256 KB đầu của một video có sẵn và chỉ trả 200 khi nhận đủ byte trong 8 s.
 * Cố ý KHÔNG gộp vào /api/health: kho tệp lỗi mà Docker đánh dấu web unhealthy thì khởi động lại vô ích.
 */
const PROBE_BYTES = 256 * 1024;
const TIMEOUT_MS = 8000;

async function probe(): Promise<{ ok: boolean; detail: string }> {
  const item = await prisma.contentItem.findFirst({
    where: { type: "video", payload: { path: ["url"], string_starts_with: "/api/lesson-media/videos/" } },
    select: { payload: true },
    orderBy: { createdAt: "asc" },
  });
  const url = (item?.payload as { url?: string } | null)?.url;
  if (!url) return { ok: true, detail: "no_video_to_probe" };
  const key = lessonVideoKeyFromFilename(url.split("/").pop()!);
  if (!key) return { ok: true, detail: "no_key" };
  const adapter = storageFor(key);
  if (!adapter.getRange) return { ok: true, detail: "adapter_has_no_range" };

  const total = await adapter.sizeOf(key.key);
  if (total === null) return { ok: false, detail: "object_missing" };
  const want = Math.min(PROBE_BYTES, total);
  const part = await adapter.getRange(key.key, 0, want - 1);
  if (!part) return { ok: false, detail: "no_range_response" };
  let got = 0;
  try {
    for await (const chunk of part.body) got += (chunk as Buffer).length;
  } finally {
    part.body.destroy();
  }
  return got >= want ? { ok: true, detail: "ok" } : { ok: false, detail: `short_read ${got}/${want}` };
}

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ ok: boolean; detail: string }>((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, detail: "timeout" }), TIMEOUT_MS);
  });
  const result = await Promise.race([
    probe().catch((e: unknown) => ({ ok: false, detail: e instanceof Error ? e.message : "error" })),
    timeout,
  ]).finally(() => clearTimeout(timer));
  if (!result.ok) console.error(`[health/storage] ${result.detail}`);
  return NextResponse.json({ status: result.ok ? "ok" : "storage_unavailable" }, { status: result.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}

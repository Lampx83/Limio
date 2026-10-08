import { NextResponse } from "next/server";
import {
  embedMaterial,
  findMaterialsNeedingReembed,
  getEmbedCompute,
  DEFAULT_EMBEDDING_MODEL,
} from "@feedbackme/core-feedback";

export const runtime = "nodejs";
// BẮT BUỘC: GET handler không đụng dynamic API sẽ bị Next prerender tĩnh lúc build (không có env, không có
// DB) rồi phục vụ kết quả đóng băng — route không bao giờ chạy thật. Các route cron khác cũng làm vậy.
export const dynamic = "force-dynamic";
// Mỗi tài liệu vài chục đoạn × vài giây; chạy lô nhỏ, gọi lại cho tới khi `remaining` = 0.
export const maxDuration = 300;

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 25;

/**
 * Embed lại tài liệu vấn đáp có vector không thuộc model embeddings hiện hành (vừa đổi model, hoặc được
 * lưu lúc chưa cấu hình embeddings). Trong lúc chưa embed lại, vấn đáp vẫn chạy bằng tìm theo từ khoá nên
 * không có thời điểm nào hỏng — route này chỉ để khôi phục tìm theo nghĩa.
 *
 * Gọi tay (hoặc từ cron) với `Authorization: Bearer $CRON_SECRET`; `?limit=N` (mặc định 5, tối đa 25).
 * Idempotent: tài liệu đã đúng model không còn nằm trong danh sách. Lỗi một tài liệu không chặn các
 * tài liệu khác. Usage ghi cho người đã tải tài liệu lên (uploadedById), cùng cách với nút "embed lại".
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected && req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const compute = getEmbedCompute();
  if (!compute) {
    return NextResponse.json({ ok: true, skipped: "embedding_not_configured" });
  }

  const raw = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, MAX_LIMIT) : DEFAULT_LIMIT;

  const pending = await findMaterialsNeedingReembed(limit);
  const results: Array<{ materialId: string; ok: boolean; chunks?: number; error?: string }> = [];
  for (const m of pending) {
    try {
      const r = await embedMaterial(m.uploadedById, m.id, compute);
      results.push({ materialId: m.id, ok: true, chunks: r.chunkCount });
    } catch (e) {
      results.push({ materialId: m.id, ok: false, error: (e as Error).message.slice(0, 200) });
    }
  }

  const remaining = (await findMaterialsNeedingReembed(MAX_LIMIT + 1)).length;
  return NextResponse.json({
    ok: results.every((r) => r.ok),
    model: DEFAULT_EMBEDDING_MODEL,
    processed: results.length,
    // Tối đa MAX_LIMIT+1 — chỉ để biết còn phải gọi nữa hay không.
    remaining,
    results,
  });
}

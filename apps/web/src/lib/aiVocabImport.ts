import { apiUrl } from "@/lib/apiUrl";
import { newBlockItemId } from "@/lib/langBlocks";
import type { VocabEditorItem } from "@/lib/langBlockEditor";

/**
 * LANG G2.5 — logic thuần của giao diện "Nhập từ vựng bằng AI": gọi API, chọn dòng ở
 * bản xem trước, chuyển dòng AI thành dòng của bộ soạn, và lời báo lỗi tiếng Việt.
 */

export type AiFilledField = "reading" | "meaning" | "example";

export interface AiVocabItem {
  term: string;
  meaning: string;
  reading?: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
  note?: string;
  /** Trường do AI tự điền — giao diện phải đánh dấu để giảng viên kiểm tra. */
  filled: AiFilledField[];
}

export interface AiVocabSkipped {
  reason: string;
  term?: string;
}

export type ExtractVocabResult =
  | { ok: true; items: AiVocabItem[]; skipped: AiVocabSkipped[] }
  | { ok: false; error: string; status?: number; message: string };

/** Lời tiếng Việt cho từng mã lỗi. Không bao giờ để lộ chi tiết kỹ thuật. */
export function aiVocabErrorMessage(error: string, status?: number, details?: unknown): string {
  switch (error) {
    case "openai_not_configured":
      return "Chưa cấu hình OpenAI cho hệ thống. Hãy liên hệ quản trị viên, hoặc dùng cách dán bảng.";
    case "no_token_budget":
      return "Ví token AI của bạn đã hết hạn mức. Hãy mua thêm token hoặc dùng cách dán bảng.";
    case "daily_token_cap":
      return "Bạn đã dùng hết hạn mức AI hôm nay. Thử lại vào ngày mai hoặc dùng cách dán bảng.";
    case "global_token_cap":
      return "Hệ thống đã đạt hạn mức AI của hôm nay. Thử lại sau hoặc dùng cách dán bảng.";
    case "rate_limited":
      return "Bạn gửi hơi nhanh. Hãy chờ một chút rồi thử lại.";
    case "validation_failed":
      if (details === "too_short") return "Văn bản quá ngắn. Hãy dán thêm nội dung (tối thiểu 20 ký tự).";
      if (details === "too_long") return "Văn bản quá dài (tối đa 20.000 ký tự). Hãy chia nhỏ rồi nhập từng phần.";
      if (details === "empty_content") return "Hãy dán văn bản từ vựng vào ô trước.";
      return "Yêu cầu không hợp lệ. Kiểm tra lại văn bản đã dán.";
    case "json_parse_failed":
      return "AI trả về kết quả không đọc được. Hãy thử lại, hoặc chia nhỏ văn bản.";
    case "openai_error":
      return "Không gọi được dịch vụ AI lúc này. Hãy thử lại sau.";
    case "forbidden":
      return "Bạn không có quyền dùng tính năng này.";
    case "unauthorized":
      return "Phiên đăng nhập đã hết. Hãy đăng nhập lại.";
    case "network_error":
      return "Mất kết nối mạng. Kiểm tra mạng rồi thử lại; nội dung bạn đã dán vẫn còn.";
    default:
      return status && status >= 500
        ? "Máy chủ đang gặp sự cố. Hãy thử lại sau."
        : "Không phân tích được văn bản. Hãy thử lại.";
  }
}

export async function extractVocabWithAi(
  rawText: string,
  fillMissing: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractVocabResult> {
  const fail = (error: string, status?: number, details?: unknown): ExtractVocabResult => ({
    ok: false,
    error,
    status,
    message: aiVocabErrorMessage(error, status, details),
  });

  let res: Response;
  try {
    res = await fetchImpl(apiUrl("/api/ai/extract-vocab"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, fillMissing }),
    });
  } catch {
    return fail("network_error");
  }

  const data = (await res.json().catch(() => null)) as
    | { error?: string; details?: unknown; items?: unknown; skipped?: unknown }
    | null;
  if (!res.ok) return fail(data?.error ?? "request_failed", res.status, data?.details);

  return {
    ok: true,
    items: Array.isArray(data?.items) ? (data!.items as AiVocabItem[]) : [],
    skipped: Array.isArray(data?.skipped) ? (data!.skipped as AiVocabSkipped[]) : [],
  };
}

export const selectAll = (items: readonly unknown[]): Set<number> => new Set(items.map((_, i) => i));

export function toggleSelection(sel: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(sel);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  return next;
}

/** Các dòng đã chọn, giữ thứ tự gốc. */
export function selectedItems<T>(items: readonly T[], sel: ReadonlySet<number>): T[] {
  return items.filter((_, i) => sel.has(i));
}

const FILLED_LABEL: Record<AiFilledField, string> = { reading: "phiên âm", meaning: "nghĩa", example: "ví dụ" };
export const filledLabel = (filled: readonly AiFilledField[]): string => filled.map((f) => FILLED_LABEL[f]).join(", ");

/** Dòng của bộ soạn: trường thiếu là chuỗi rỗng, mỗi dòng có id riêng. */
export function aiItemToEditorItem(it: AiVocabItem): VocabEditorItem {
  return {
    id: newBlockItemId(),
    term: it.term,
    reading: it.reading ?? "",
    meaning: it.meaning,
    example: it.example ?? "",
    exampleReading: it.exampleReading ?? "",
    exampleMeaning: it.exampleMeaning ?? "",
    note: it.note ?? "",
    audioUrl: "",
  };
}

// A6.2 — embedding chạy trên máy chủ tự host (Ollama: Qwen3-Embedding), không còn OpenAI.
//
// Cột OralExamMaterialChunk.embedding là vector(1536). Qwen3-Embedding mặc định ra 4096 chiều nhưng được
// huấn luyện kiểu Matryoshka nên cắt ngắn vẫn dùng được; ta xin đúng EMBEDDING_DIM chiều (tham số
// `dimensions` của Ollama, đã cắt + chuẩn hoá L2) để KHÔNG phải đổi schema.
//
// Vector của hai model KHÔNG so sánh được với nhau, nên mỗi chunk ghi `embeddingModel` và tìm kiếm chỉ
// xét chunk cùng model với model hiện hành (xem materialEmbeddings.ts).

/** Số chiều khớp cột pgvector `vector(1536)`. */
export const EMBEDDING_DIM = 1536;

/** Model mặc định trên máy chủ Ollama. Đổi qua `EMBED_MODEL`. */
export const DEFAULT_EMBED_MODEL_NAME = "qwen3-embedding:8b-ctx16k";

const SECKEY_HEADER = "x-ollama-seckey";
/** Ollama nhận mảng nhiều đoạn một lượt; chia lô để một tài liệu dài không thành request khổng lồ. */
const EMBED_BATCH_SIZE = 16;
const EMBED_TIMEOUT_MS = 60_000;

export function getEmbeddingModel(): string {
  return process.env.EMBED_MODEL?.trim() || DEFAULT_EMBED_MODEL_NAME;
}

/** Tên model ghi vào AiUsageLog và OralExamMaterialChunk.embeddingModel. */
export const DEFAULT_EMBEDDING_MODEL = getEmbeddingModel();

/** Base URL Ollama, vd `http://host:8037/ollama`. Rỗng ⇒ chưa cấu hình embeddings. */
export function getEmbeddingBaseUrl(): string | null {
  const raw = process.env.EMBED_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function isEmbeddingConfigured(): boolean {
  return getEmbeddingBaseUrl() !== null;
}

export interface EmbedComputeResult {
  embeddings: number[][];
  /** Tổng token tiêu tốn — dùng để ghi AiUsageLog. */
  tokensUsed: number;
}

/** Nhận N đoạn text, trả N vector cùng thứ tự. Không tự trim/chunk — caller lo. */
export type EmbedComputeFn = (texts: string[]) => Promise<EmbedComputeResult>;

/**
 * Đưa vector về đúng EMBEDDING_DIM chiều. Ollama đã cắt theo `dimensions`; nếu một server khác bỏ qua
 * tham số đó và trả nhiều chiều hơn thì cắt + chuẩn hoá L2 ở đây (hợp lệ với model Matryoshka). Ít chiều
 * hơn thì là lỗi — không đệm số 0 vì sẽ cho điểm tương đồng sai âm thầm.
 */
export function fitEmbedding(vec: number[]): number[] {
  if (vec.length === EMBEDDING_DIM) return vec;
  if (vec.length < EMBEDDING_DIM) {
    throw new Error(`embedding_dim_too_small: ${vec.length} < ${EMBEDDING_DIM}`);
  }
  const cut = vec.slice(0, EMBEDDING_DIM);
  const norm = Math.sqrt(cut.reduce((s, x) => s + x * x, 0)) || 1;
  return cut.map((x) => x / norm);
}

export class EmbeddingNotConfiguredError extends Error {
  constructor() {
    super("embedding_not_configured: đặt EMBED_BASE_URL (Ollama) để dùng embeddings");
    this.name = "EmbeddingNotConfiguredError";
  }
}

/** Gọi `POST {EMBED_BASE_URL}/api/embed`. `fetchImpl` để test không cần mạng. */
export async function embedTexts(
  texts: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<EmbedComputeResult> {
  const baseUrl = getEmbeddingBaseUrl();
  if (!baseUrl) throw new EmbeddingNotConfiguredError();
  const seckey = process.env.EMBED_SECKEY?.trim();
  const model = getEmbeddingModel();

  const embeddings: number[][] = [];
  let tokensUsed = 0;
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await fetchImpl(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(seckey ? { [SECKEY_HEADER]: seckey } : {}),
      },
      body: JSON.stringify({ model, input: batch, dimensions: EMBEDDING_DIM }),
      signal: AbortSignal.timeout(EMBED_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw Object.assign(new Error(`embedding_http_${res.status}: ${detail}`), { status: res.status });
    }
    const json = (await res.json()) as { embeddings?: number[][]; prompt_eval_count?: number };
    if (!json.embeddings || json.embeddings.length !== batch.length) {
      throw new Error("embedding_count_mismatch");
    }
    for (const v of json.embeddings) embeddings.push(fitEmbedding(v));
    tokensUsed += json.prompt_eval_count ?? 0;
  }
  return { embeddings, tokensUsed };
}

/**
 * Adapter thật. Tách khỏi embedMaterial() (materialEmbeddings.ts) để phần lưu-trữ/DB test được bằng
 * compute fn giả, không cần máy chủ embeddings trong test.
 * Trả null khi chưa đặt EMBED_BASE_URL — caller lùi về tìm theo từ khoá.
 */
export function getEmbedCompute(fetchImpl: typeof fetch = fetch): EmbedComputeFn | null {
  if (!isEmbeddingConfigured()) return null;
  return (texts) => embedTexts(texts, fetchImpl);
}

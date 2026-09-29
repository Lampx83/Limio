/**
 * Lớp chịu tải cho mọi lời gọi OpenAI: giới hạn số request chạy đồng thời +
 * retry có backoff khi gặp 429/5xx/lỗi mạng. Cắm vào `fetch` của SDK nên
 * chat / audio / embeddings / stream đều được bảo vệ mà route không phải đổi.
 *
 * Giới hạn:
 * - Semaphore nằm trong bộ nhớ MỘT tiến trình. Hiện production chạy 1 container
 *   `web` nên đủ; nếu scale ngang thì hạn mức thật là `maxConcurrent × số web`.
 * - Slot chỉ giữ tới lúc nhận header. Với stream, phần body chảy tiếp sau khi
 *   slot đã nhả — chấp nhận được vì RPM/TPM của OpenAI tính lúc nhận request.
 */

export class OpenaiBusyError extends Error {
  constructor() {
    super("openai_busy");
    this.name = "OpenaiBusyError";
  }
}

export interface ResilientFetchOptions {
  baseFetch?: typeof fetch;
  maxConcurrent: number;
  /** Số lần THỬ LẠI (không tính lần đầu). */
  maxRetries: number;
  /** Chờ tối đa trong hàng đợi trước khi ném OpenaiBusyError. */
  queueTimeoutMs: number;
  baseDelayMs: number;
  maxDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async acquire(timeoutMs: number, signal?: AbortSignal | null): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }
    return new Promise((resolve, reject) => {
      const grant = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(() => this.release());
      };
      const drop = () => {
        const i = this.waiters.indexOf(grant);
        if (i >= 0) this.waiters.splice(i, 1);
      };
      const timer = setTimeout(() => {
        drop();
        signal?.removeEventListener("abort", onAbort);
        reject(new OpenaiBusyError());
      }, timeoutMs);
      const onAbort = () => {
        drop();
        clearTimeout(timer);
        reject(signal?.reason ?? new Error("aborted"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      this.waiters.push(grant);
    });
  }

  /** Chuyển thẳng slot cho người chờ kế tiếp (không giảm `active`). */
  private release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.active--;
  }
}

/**
 * Lỗi này có phải "OpenAI đang quá tải" (hàng đợi đầy, hoặc 429 sau khi hết
 * lượt retry) — tức là thử lại sau ít giây thì được — chứ không phải lỗi thật
 * của người dùng? Đi theo `cause`/`details` vì lỗi thường bị bọc: SDK bọc lỗi
 * fetch thành APIConnectionError, còn core-feedback bọc tiếp thành
 * AiTutorError/OpenAiVoiceError. `insufficient_quota` (hết tiền) KHÔNG tính:
 * chờ vài giây không giải quyết được.
 */
export function isOpenaiOverloaded(e: unknown, depth = 0): boolean {
  if (depth > 4 || e == null || typeof e !== "object") return false;
  if (e instanceof OpenaiBusyError) return true;
  const o = e as { status?: unknown; code?: unknown; cause?: unknown; details?: unknown };
  if (o.status === 429 && o.code !== "insufficient_quota") return true;
  return isOpenaiOverloaded(o.cause, depth + 1) || isOpenaiOverloaded(o.details, depth + 1);
}

const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/** Body dạng stream chỉ đọc được 1 lần → không thể gửi lại. */
function isReplayable(body: unknown): boolean {
  if (body == null) return true;
  if (typeof body === "string") return true;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return true;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return true;
  return false;
}

function retryAfterMs(res: Response): number | null {
  const ms = Number(res.headers.get("retry-after-ms"));
  if (Number.isFinite(ms) && ms > 0) return ms;
  const s = res.headers.get("retry-after");
  if (!s) return null;
  const secs = Number(s);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const date = Date.parse(s);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** 429 do hết tiền/quota tháng: retry chỉ tốn thời gian. */
async function isQuotaExhausted(res: Response): Promise<boolean> {
  if (res.status !== 429) return false;
  try {
    const j = (await res.clone().json()) as { error?: { code?: string; type?: string } };
    return j?.error?.code === "insufficient_quota" || j?.error?.type === "insufficient_quota";
  } catch {
    return false;
  }
}

export function createResilientFetch(opts: ResilientFetchOptions): typeof fetch {
  const baseFetch = opts.baseFetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = opts.random ?? Math.random;
  const sem = new Semaphore(Math.max(1, opts.maxConcurrent));

  const backoff = (attempt: number, res?: Response): number => {
    const hinted = res ? retryAfterMs(res) : null;
    // Full jitter: tránh mọi request cùng thức dậy một lúc.
    const exp = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** attempt);
    const jittered = random() * exp;
    return Math.min(opts.maxDelayMs, Math.max(hinted ?? 0, jittered));
  };

  return async (input, init) => {
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const canRetry = isReplayable(init?.body);

    for (let attempt = 0; ; attempt++) {
      const release = await sem.acquire(opts.queueTimeoutMs, signal);
      let res: Response | undefined;
      let failure: unknown;
      try {
        res = await baseFetch(input, init);
      } catch (e) {
        failure = e;
      } finally {
        release();
      }

      const exhausted = attempt >= opts.maxRetries || !canRetry || signal?.aborted;
      if (res) {
        if (!RETRIABLE_STATUS.has(res.status) || exhausted) return res;
        if (await isQuotaExhausted(res)) return res;
        await res.body?.cancel().catch(() => undefined);
        await sleep(backoff(attempt, res));
      } else {
        if (exhausted || signal?.aborted) throw failure;
        await sleep(backoff(attempt));
      }
    }
  };
}

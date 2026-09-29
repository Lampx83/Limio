import { describe, expect, it, vi } from "vitest";
import { createResilientFetch, isOpenaiOverloaded, OpenaiBusyError } from "./openaiResilience";

const json = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const base = {
  maxConcurrent: 2,
  maxRetries: 3,
  queueTimeoutMs: 1000,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  random: () => 1,
};

const post = (f: typeof fetch, body: BodyInit | null = "{}", init: RequestInit = {}) =>
  f("https://api.test/v1", { method: "POST", body, ...init });

describe("createResilientFetch — retry", () => {
  it("retry 429 rồi thành công, tôn trọng Retry-After", async () => {
    const baseFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(429, {}, { "retry-after": "3" }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const f = createResilientFetch({ ...base, baseFetch, sleep });

    const res = await post(f);
    expect(res.status).toBe(200);
    expect(baseFetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000); // Retry-After thắng backoff 100ms
  });

  it("retry 5xx và lỗi mạng, dừng khi hết lượt và trả response cuối", async () => {
    const baseFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue(json(503));
    const f = createResilientFetch({ ...base, baseFetch, sleep: async () => {} });

    const res = await post(f);
    expect(res.status).toBe(503);
    expect(baseFetch).toHaveBeenCalledTimes(4); // 1 + 3 retry
  });

  it("KHÔNG retry insufficient_quota", async () => {
    const baseFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json(429, { error: { code: "insufficient_quota" } }));
    const f = createResilientFetch({ ...base, baseFetch, sleep: async () => {} });

    const res = await post(f);
    expect(res.status).toBe(429);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("KHÔNG retry 4xx khác (400/401)", async () => {
    const baseFetch = vi.fn<typeof fetch>().mockResolvedValue(json(400));
    const f = createResilientFetch({ ...base, baseFetch, sleep: async () => {} });
    expect((await post(f)).status).toBe(400);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("KHÔNG retry khi body là stream (không gửi lại được)", async () => {
    const baseFetch = vi.fn<typeof fetch>().mockResolvedValue(json(429));
    const f = createResilientFetch({ ...base, baseFetch, sleep: async () => {} });
    const stream = new ReadableStream();
    const res = await post(f, stream as unknown as BodyInit);
    expect(res.status).toBe(429);
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("retry được body FormData (upload audio)", async () => {
    const baseFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(429))
      .mockResolvedValueOnce(json(200));
    const f = createResilientFetch({ ...base, baseFetch, sleep: async () => {} });
    const fd = new FormData();
    fd.append("file", new Blob(["x"]), "a.webm");
    expect((await post(f, fd)).status).toBe(200);
  });

  it("không retry và ném lại lỗi khi request đã bị huỷ", async () => {
    const ac = new AbortController();
    const baseFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      ac.abort();
      throw new DOMException("aborted", "AbortError");
    });
    const f = createResilientFetch({ ...base, baseFetch, sleep: async () => {} });
    await expect(post(f, "{}", { signal: ac.signal })).rejects.toThrow("aborted");
    expect(baseFetch).toHaveBeenCalledTimes(1);
  });

  it("backoff bị chặn trên bởi maxDelayMs", async () => {
    const baseFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(429, {}, { "retry-after": "999" }))
      .mockResolvedValueOnce(json(200));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const f = createResilientFetch({ ...base, baseFetch, sleep });
    await post(f);
    expect(sleep).toHaveBeenCalledWith(5000);
  });
});

describe("createResilientFetch — giới hạn đồng thời", () => {
  function gated() {
    let inFlight = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const baseFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise<void>((r) => releases.push(r));
      inFlight--;
      return json(200);
    });
    return { baseFetch, releases, peak: () => peak };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("không bao giờ vượt maxConcurrent, hàng đợi chạy tiếp khi có slot", async () => {
    const g = gated();
    const f = createResilientFetch({ ...base, maxConcurrent: 2, baseFetch: g.baseFetch });
    const all = Promise.all([1, 2, 3, 4, 5].map(() => post(f)));
    await tick();
    expect(g.baseFetch).toHaveBeenCalledTimes(2);

    while (g.releases.length) {
      g.releases.shift()!();
      await tick();
    }
    while (g.releases.length) {
      g.releases.shift()!();
      await tick();
    }
    await all;
    expect(g.baseFetch).toHaveBeenCalledTimes(5);
    expect(g.peak()).toBe(2);
  });

  it("ném OpenaiBusyError khi chờ hàng đợi quá hạn", async () => {
    vi.useFakeTimers();
    try {
      const g = gated();
      const f = createResilientFetch({
        ...base,
        maxConcurrent: 1,
        queueTimeoutMs: 500,
        baseFetch: g.baseFetch,
      });
      void post(f); // chiếm slot duy nhất
      const waiting = post(f);
      const assertion = expect(waiting).rejects.toBeInstanceOf(OpenaiBusyError);
      await vi.advanceTimersByTimeAsync(600);
      await assertion;
      expect(g.baseFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("nhả slot trong lúc backoff để request khác chen vào", async () => {
    const order: string[] = [];
    let call = 0;
    const baseFetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      call++;
      order.push(`c${call}`);
      return call === 1 ? json(429) : json(200);
    });
    let wake!: () => void;
    const sleep = () => new Promise<void>((r) => (wake = r));
    const f = createResilientFetch({ ...base, maxConcurrent: 1, baseFetch, sleep });

    const a = post(f); // 429, rồi ngủ backoff
    await tick();
    const b = post(f); // phải chạy được dù A đang ngủ
    expect((await b).status).toBe(200);
    wake();
    expect((await a).status).toBe(200);
    expect(order).toEqual(["c1", "c2", "c3"]);
  });
});

describe("isOpenaiOverloaded", () => {
  const rateLimit = (code?: string) => Object.assign(new Error("429"), { status: 429, code });

  it("nhận ra hàng đợi đầy, kể cả khi bị SDK bọc vào cause", () => {
    expect(isOpenaiOverloaded(new OpenaiBusyError())).toBe(true);
    expect(isOpenaiOverloaded(Object.assign(new Error("Connection error."), { cause: new OpenaiBusyError() }))).toBe(true);
  });

  it("nhận ra 429 sau khi bị bọc bởi lỗi nghiệp vụ (cause hoặc details)", () => {
    const viaCause = Object.assign(new Error("openai_error"), { code: "openai_error", cause: rateLimit() });
    const viaDetails = Object.assign(new Error("stt_failed"), { code: "stt_failed", details: rateLimit() });
    expect(isOpenaiOverloaded(viaCause)).toBe(true);
    expect(isOpenaiOverloaded(viaDetails)).toBe(true);
  });

  it("KHÔNG coi hết tiền (insufficient_quota) là quá tải", () => {
    expect(isOpenaiOverloaded(rateLimit("insufficient_quota"))).toBe(false);
  });

  it("KHÔNG nhầm lỗi khác, và không lặp vô hạn khi cause vòng tròn", () => {
    expect(isOpenaiOverloaded(new Error("boom"))).toBe(false);
    expect(isOpenaiOverloaded(Object.assign(new Error("x"), { status: 500 }))).toBe(false);
    expect(isOpenaiOverloaded("string")).toBe(false);
    expect(isOpenaiOverloaded(null)).toBe(false);
    const a: { cause?: unknown } = {};
    a.cause = a;
    expect(isOpenaiOverloaded(a)).toBe(false);
  });
});

"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

// Trùng NEU_TTS_MAX_CHARS ở packages/core-feedback (route cũng kiểm tra lại).
const MAX_CHARS = 500;
// Model NEU TTS được huấn luyện cho tiếng Việt; câu tiếng Anh chỉ để thử.
type Lang = "vi" | "en";
const SAMPLE_TEXTS: Record<Lang, string> = {
  vi: "Xin chào, em hãy giới thiệu về bản thân và ngành học của em.",
  en: "Hello, please introduce yourself and the subject you are studying.",
};
const LANG_LABELS: Record<Lang, string> = { vi: "Tiếng Việt", en: "English (thử)" };

type VoiceRow = {
  voice: string;
  status: "idle" | "loading" | "ok" | "error";
  url?: string;
  error?: string;
};

/**
 * Khung thử NEU API cho admin. Hiện chỉ có TTS (đọc thử theo từng giọng); API
 * khác của NEU sẽ thêm thành section mới trong cùng card này.
 */
export default function NeuApiTester() {
  const [voices, setVoices] = useState<string[] | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("vi");
  const [text, setText] = useState(SAMPLE_TEXTS.vi);
  const [rows, setRows] = useState<VoiceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/admin/integrations/neutts/voices"), { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        if (!j.ok) setVoicesError(j.error ?? "unknown_error");
        else setVoices(j.voices ?? []);
      } catch {
        if (!cancelled) setVoicesError("network_error");
      }
    })();
    return () => {
      cancelled = true;
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function clearUrls() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  }

  async function synth(voice: string): Promise<VoiceRow> {
    try {
      const res = await fetch(apiUrl("/api/admin/integrations/neutts/speech"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), voice }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return { voice, status: "error", error: j.error ?? `http_${res.status}` };
      }
      const url = URL.createObjectURL(await res.blob());
      urlsRef.current.push(url);
      return { voice, status: "ok", url };
    } catch {
      return { voice, status: "error", error: "network_error" };
    }
  }

  async function runFor(list: string[]) {
    if (busy || !text.trim()) return;
    setBusy(true);
    clearUrls();
    setRows(list.map((voice) => ({ voice, status: "loading" })));
    // Tuần tự từng giọng: server giới hạn đồng thời (TTS_MAX_CONCURRENT=2).
    for (const voice of list) {
      const row = await synth(voice);
      setRows((prev) => prev.map((r) => (r.voice === voice ? row : r)));
    }
    setBusy(false);
  }

  const tooLong = text.trim().length > MAX_CHARS;

  return (
    <section className="card">
      <header className="border-b border-token pb-3">
        <h2 className="text-base font-semibold">Thử NEU API</h2>
        <p className="mt-1.5 text-xs text-muted">
          Gọi qua Kong bằng key đã lưu ở trên. Hiện có TTS; API khác của NEU sẽ thêm thành section
          riêng trong card này.
        </p>
      </header>

      <div className="mt-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium">TTS — đọc thử theo giọng</h3>
          {voicesError && (
            <p className="mt-2 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              Không lấy được danh sách giọng: {voicesError}
            </p>
          )}
          {!voicesError && voices === null && (
            <p className="mt-2 text-xs text-muted">Đang tải danh sách giọng…</p>
          )}
          {voices && (
            <p className="mt-2 text-xs text-muted">
              {voices.length} giọng: {voices.join(", ")}
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted" htmlFor="neu-tts-text">
            Nội dung ({text.trim().length}/{MAX_CHARS} ký tự)
          </label>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-muted" htmlFor="neu-tts-lang">
              Ngôn ngữ
            </label>
            <select
              id="neu-tts-lang"
              value={lang}
              onChange={(e) => {
                const next = e.target.value as Lang;
                setLang(next);
                setText(SAMPLE_TEXTS[next]);
              }}
              className="input w-auto py-1 text-sm"
            >
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <option key={l} value={l}>
                  {LANG_LABELS[l]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            id="neu-tts-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="input mt-1 text-sm"
          />
          {tooLong && (
            <p className="mt-1 text-xs text-danger-700">Quá {MAX_CHARS} ký tự, rút ngắn trước khi đọc.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={busy || tooLong || !text.trim() || !voices?.length}
            onClick={() => voices && runFor(voices)}
          >
            {busy ? "Đang đọc…" : `Đọc thử tất cả giọng (${voices?.length ?? 0})`}
          </button>
          {voices?.map((v) => (
            <button
              key={v}
              type="button"
              className="btn-secondary btn-sm"
              disabled={busy || tooLong || !text.trim()}
              onClick={() => runFor([v])}
            >
              {v}
            </button>
          ))}
        </div>

        {rows.length > 0 && (
          <ul className="divide-y divide-token rounded-lg border border-token">
            {rows.map((row) => (
              <li key={row.voice} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="w-28 font-mono text-xs">{row.voice}</span>
                {row.status === "loading" && <span className="text-xs text-muted">đang tạo…</span>}
                {row.status === "error" && (
                  <span className="text-xs text-danger-700">✗ {row.error}</span>
                )}
                {row.status === "ok" && row.url && (
                  <audio controls preload="none" src={row.url} className="h-8 max-w-full" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

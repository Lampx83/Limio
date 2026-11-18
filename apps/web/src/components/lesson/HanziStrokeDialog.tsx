"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, X } from "lucide-react";
import BrushIcon from "./BrushIcon";
import { apiUrl } from "@/lib/apiUrl";
import { hanChars, hanziDataPath } from "@/lib/hanziStrokes";
import { hskT } from "./hskT";
import type { UiLang } from "@/lib/i18n/core";

type Mode = "watch" | "practice";
type Writer = { animateCharacter: (o?: { onComplete?: () => void }) => void; quiz: (o?: { onComplete?: (s: { totalMistakes: number }) => void }) => void; cancelQuiz: () => void };

/**
 * Cửa sổ "Cách viết" của một từ mới: hiện nét viết từng chữ Hán (chạy theo thứ tự nét) và cho tập viết (vẽ theo, vẽ sai nét thì báo).
 * `head`/`foot` (tuỳ chọn): thông tin của từ (pinyin, nghĩa, ví dụ) hiện trên chữ chọn và dưới nút; khoá nào không truyền thì cửa sổ như cũ. Dữ liệu nét lấy từ file tĩnh của chính site (public/hanzi), không gọi dịch vụ ngoài. Chữ thiếu dữ liệu thì báo, không vỡ.
 */
export default function HanziStrokeDialog({ term, lang, onClose, head, foot }: { term: string; lang: UiLang; onClose: () => void; head?: React.ReactNode; foot?: React.ReactNode }) {
  const t = (key: Parameters<typeof hskT>[1]) => hskT(lang, key);
  const chars = hanChars(term);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("watch");
  const [run, setRun] = useState(0); // đổi để chạy lại
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");
  const [result, setResult] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const ch = chars[idx];

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    const el = box.current;
    if (!el || !ch) return;
    let dead = false;
    let writer: Writer | null = null;
    el.innerHTML = "";
    setStatus("loading");
    setResult(null);
    void import("hanzi-writer").then(({ default: HanziWriter }) => {
      if (dead) return;
      const w = HanziWriter.create(el, ch, {
        width: 240,
        height: 240,
        padding: 8,
        showOutline: true,
        strokeColor: getComputedStyle(el).color,
        outlineColor: "#d4d4d8",
        highlightColor: "#EC4899",
        drawingColor: "#65a30d",
        strokeAnimationSpeed: 1.2,
        delayBetweenStrokes: 250,
        charDataLoader: (c: string, ok: (d: never) => void, fail: () => void) => {
          fetch(apiUrl(hanziDataPath(c)))
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d) => !dead && ok(d as never))
            .catch(() => !dead && (setStatus("missing"), fail()));
        },
        onLoadCharDataSuccess: () => !dead && setStatus("ok"),
      } as never) as unknown as Writer;
      writer = w;
      if (mode === "watch") w.animateCharacter();
      else w.quiz({ onComplete: (s) => !dead && setResult(s.totalMistakes === 0 ? t("learn.hsk.write.perfect") : t("learn.hsk.write.done")) });
    });
    return () => {
      dead = true;
      try {
        writer?.cancelQuiz();
      } catch {}
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ch, mode, run]);

  const pick = (m: Mode) => {
    if (m === mode) setRun((n) => n + 1);
    else setMode(m);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} data-testid="hanzi-dialog">
      <div role="dialog" aria-modal="true" aria-label={`${t("learn.hsk.write.open")}: ${term}`} className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-h4 font-semibold">{t("learn.hsk.write.open")}</h3>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label={t("learn.hsk.write.close")} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-soft">
            <X size={16} aria-hidden />
          </button>
        </div>

        {head}

        {chars.length > 1 && (
          <div role="group" aria-label={t("learn.hsk.write.chars")} className="mb-3 flex flex-wrap gap-1.5">
            {chars.map((c, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={i === idx}
                onClick={() => setIdx(i)}
                className={`han-text h-10 w-10 rounded-lg border border-token text-xl ${i === idx ? "bg-brand-100 font-medium text-brand-800" : "hover:bg-brand-soft"}`}
                lang="zh-Hans"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto flex h-[256px] w-[256px] items-center justify-center rounded-xl border border-token bg-white text-[#111]" style={{ backgroundImage: "linear-gradient(to right, transparent 49.6%, #e5e7eb 50%, transparent 50.4%), linear-gradient(to bottom, transparent 49.6%, #e5e7eb 50%, transparent 50.4%)" }}>
          <div ref={box} data-testid="hanzi-box" className="h-[240px] w-[240px] text-[#111]" />
        </div>

        <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-center text-sm text-muted">
          {status === "missing" ? t("learn.hsk.write.missing") : result ?? (mode === "practice" ? t("learn.hsk.write.hint") : "")}
        </p>

        <div className="mt-2 flex justify-center gap-2">
          <button type="button" onClick={() => pick("watch")} aria-pressed={mode === "watch"} className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-token px-3.5 text-sm ${mode === "watch" ? "bg-brand-100 font-medium text-brand-800" : "hover:bg-brand-soft"}`}>
            {mode === "watch" ? <RotateCcw size={14} aria-hidden /> : <Play size={14} aria-hidden />} {t("learn.hsk.write.watch")}
          </button>
          <button type="button" onClick={() => pick("practice")} aria-pressed={mode === "practice"} className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-token px-3.5 text-sm ${mode === "practice" ? "bg-brand-100 font-medium text-brand-800" : "hover:bg-brand-soft"}`}>
            <BrushIcon /> {t("learn.hsk.write.practice")}
          </button>
        </div>
        {foot}
      </div>
    </div>
  );
}

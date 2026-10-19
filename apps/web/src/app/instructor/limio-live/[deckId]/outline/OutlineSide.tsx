"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { sanitizeLayoutConfig } from "@/lib/limioLiveSlides";
import { nextThemeSuggestion } from "@/lib/limioLiveOutlineCard";
import type { Outline } from "@/lib/limioLiveOutline";
import { LayoutSlideView } from "../../SlideLayouts";
import { SLIDE_THEMES } from "../../slideThemes";

/**
 * Giao diện của bài ở cột phải trang dàn ý (O3): hai bản xem thu nhỏ vẽ bằng chính bộ vẽ slide (một bìa, một slide nội dung của chính bài)
 * và nút "Gợi ý giao diện khác" đổi sang giao diện sáng kế tiếp chưa xem, lưu ngay vào bài. Không mở thư viện đầy đủ ở đây.
 */
export function ThemeBox({ deckId, title, outline, theme, onTheme }: { deckId: string; title: string; outline: Outline; theme: string; onTheme: (id: string) => void }) {
  const seen = useRef<string[]>([]);
  const [err, setErr] = useState(false);
  const current = SLIDE_THEMES.find((t) => t.id === theme) ?? SLIDE_THEMES[0];

  const cover = sanitizeLayoutConfig("cover", { title: title || outline.title || "Bài giảng", subtitle: "", org: "", byline: "" });
  const sample = outline.slides.find((s) => s.kind === "content" && s.layout !== "cover" && s.layout !== "section" && s.points.some((p) => p.trim()));
  const body = sanitizeLayoutConfig("list", {
    title: sample?.title || "Tiêu đề slide",
    lines: (sample?.points ?? ["Ý thứ nhất", "Ý thứ hai", "Ý thứ ba"]).slice(0, 3).map((text) => ({ text })),
  });

  const suggest = async () => {
    const next = nextThemeSuggestion(theme, seen.current);
    seen.current.push(theme);
    const prev = theme;
    onTheme(next);
    setErr(false);
    try {
      const r = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      });
      if (!r.ok) throw new Error("save");
    } catch {
      onTheme(prev);
      setErr(true);
    }
  };

  return (
    <section className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4" aria-label="Giao diện của bài">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Giao diện</h2>
        <button type="button" onClick={() => void suggest()} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:underline">
          <RefreshCw size={13} aria-hidden /> Gợi ý giao diện khác
        </button>
      </div>
      <div className="grid gap-2">
        <Mini><LayoutSlideView config={cover} themeId={theme} /></Mini>
        <Mini><LayoutSlideView config={body} themeId={theme} /></Mini>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Giao diện <b>{current.label}</b>, xem trước bằng chữ thật của bài. Đổi lại được bất cứ lúc nào trong trình soạn.
      </p>
      {err && <p className="mt-1 text-[13px] font-medium text-red-700">Không lưu được giao diện, thử lại.</p>}
    </section>
  );
}

function Mini({ children }: { children: React.ReactNode }) {
  return <div className="relative flex aspect-video w-full flex-col overflow-hidden rounded-lg border border-token">{children}</div>;
}

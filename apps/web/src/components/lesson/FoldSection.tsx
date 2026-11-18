"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { stripPinyinTokens } from "@/lib/hskAuthored";
import { hskAuthoredHtml } from "@/lib/hskAuthoredDom";
import Collapse from "@/components/ui/Collapse";

/**
 * Mục phụ của bài HSK gập sẵn (docs/tieu-chi/limio-language-ux-p1-ly-thuyet.md, mục E): tiêu đề mục vẫn hiện bên ngoài; ở đây là dòng tóm tắt
 * (công thức ngữ pháp, các từ cần lưu ý, câu đầu phần văn hoá) và nút "Xem chi tiết". Nội dung vẫn nằm trong trang (chỉ ẩn) nên tìm kiếm trên trang,
 * chạm-để-xem pinyin và âm thanh hoạt động ngay khi mở. Khi mở thì dòng tóm tắt thu lại (nội dung đã có đủ các tiêu đề đó); mở/thu theo chiều cao có chuyển động (ui/Collapse).
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Dòng tóm tắt: lần dựng đầu (và trên máy chủ) là chữ thuần, sau khi gắn vào trang mới dựng pinyin dưới chữ Hán (DOMParser chỉ có ở trình duyệt). */
function SummaryLine({ line }: { line: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => setHtml(hskAuthoredHtml(esc(line))), [line]);
  return html === null ? <>{stripPinyinTokens(line)}</> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function FoldSection({ summary, children }: { summary: string[]; children: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div data-testid="fold-section" data-open={open ? "" : undefined}>
      {summary.length > 0 && (
        <Collapse open={!open} testId="fold-summary-collapse">
          <ul data-testid="fold-summary" className="mb-2 space-y-1 border-l-4 border-brand-600 bg-brand-50 px-4 py-2 text-[1.05rem] leading-relaxed">
            {summary.map((line, i) => (
              <li key={i}>
                <SummaryLine line={line} />
              </li>
            ))}
          </ul>
        </Collapse>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="btn btn-sm gap-1.5 bg-brand-100 font-bold text-brand-800 hover:bg-brand-200"
      >
        {open ? t("reader.fold.close") : t("reader.fold.open")}
        <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Collapse open={open} id={id}>
        <div className="pt-3">{children}</div>
      </Collapse>
    </div>
  );
}

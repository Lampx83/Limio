"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { parsePromptAid } from "@/lib/promptAid";
import { useT } from "@/lib/i18n/client";

/**
 * Chú giải dưới đề câu hỏi của khoá ngoại ngữ: phiên âm hiện sẵn (chữ nhỏ, màu nhạt); bản dịch ẩn, học viên bấm "Hiện bản dịch" mới thấy
 * (đề là một phần của bài đọc hiểu nên không dịch sẵn). Không có `promptAid` thì không vẽ gì.
 */
export default function PromptAid({ config }: { config: unknown }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const aid = parsePromptAid(config);
  if (!aid) return null;
  return (
    <div className="mb-2 space-y-1" data-testid="prompt-aid">
      {aid.reading && (
        <p className="text-sm text-muted" data-testid="prompt-aid-reading">
          {aid.reading}
        </p>
      )}
      {aid.translation && (
        <>
          <button type="button" className="rp-link inline-flex items-center gap-1 text-xs" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <Languages size={12} aria-hidden /> {open ? t("practice.aid.hideTranslation") : t("practice.aid.showTranslation")}
          </button>
          {open && (
            <p className="text-sm italic text-muted" data-testid="prompt-aid-translation">
              {aid.translation}
            </p>
          )}
        </>
      )}
    </div>
  );
}

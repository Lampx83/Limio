"use client";

import { createContext, useContext } from "react";
import { Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/client";

/** Việc của khung bài mà các nút ở thanh đáy (server component) cần gọi: mở panel AI trợ giảng. */
interface Actions {
  openPanel: () => void;
}
const LessonFrameActions = createContext<Actions | null>(null);
export const LessonFrameActionsProvider = LessonFrameActions.Provider;

/**
 * Nút mở AI trợ giảng ở giữa thanh đáy (docs/tieu-chi/limio-language-ux-dieu-huong-bai.md, H1). Chỉ hiện dưới `lg`: từ `lg` đã có nút nổi mở panel.
 * Ngoài khung bài (không có context) thì không hiện gì.
 */
export function AiOpenButton() {
  const actions = useContext(LessonFrameActions);
  const t = useT();
  if (!actions) return null;
  return (
    <button
      type="button"
      onClick={actions.openPanel}
      aria-label={t("ai.panel.openAria")}
      title={t("ai.panel.openTitle")}
      data-testid="bar-ai-button"
      className="btn btn-sm bg-brand-100 text-brand-800 hover:bg-brand-200 lg:hidden"
    >
      <Sparkles size={16} aria-hidden />
    </button>
  );
}

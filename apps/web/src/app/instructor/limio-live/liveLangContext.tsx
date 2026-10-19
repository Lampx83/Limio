"use client";

import { createContext, useContext, type ReactNode } from "react";
import { slideText, type SlideText } from "@/lib/limioLiveLanguage";

// Ngôn ngữ của bài giảng đang soạn, chiếu hoặc xem qua link: chữ hệ thống vẽ trên slide ("Nguồn ảnh", "Đơn vị", "Chuỗi 1"…)
// theo ngôn ngữ này (docs/tieu-chi/ngon-ngu-slide.md, L11). Đặt cạnh LiveBrandProvider; thiếu thì dùng tiếng Việt.
const Ctx = createContext<string | null>(null);

export function LiveLangProvider({ lang, children }: { lang: string | null | undefined; children: ReactNode }) {
  return <Ctx.Provider value={lang ?? null}>{children}</Ctx.Provider>;
}

export const useSlideText = (): SlideText => slideText(useContext(Ctx));
/** Mã ngôn ngữ của bài (null = chưa xác định), cho các hàm dựng slide nhận `lang`. */
export const useDeckLang = (): string | null => useContext(Ctx);

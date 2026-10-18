"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { motifImageOrdinals, resolveSlideMotif, type MotifSlot, type SlideMotifId } from "@/lib/limioLiveMotifs";

// Hoa văn trang trí của bài giảng đang soạn hoặc chiếu: mã bài (suy ra hoa văn chủ đạo), lựa chọn của cả bài,
// và thứ tự các ô hình (để hai ô liền nhau khác hoa văn). Đặt cạnh LiveBrandProvider ở gốc trình sửa và trình chiếu.
// Không có provider (ảnh mẫu trong bảng thương hiệu…) thì vẫn có hoa văn tự động, chỉ không biết thứ tự ô hình.

interface MotifCtx {
  deckId: string | null;
  deckChoice: string | null;
  ordinals: Map<string, number>;
}

const Ctx = createContext<MotifCtx | null>(null);

export function LiveMotifProvider({
  deckId,
  motif,
  slides,
  children,
}: {
  deckId: string;
  motif: string | null | undefined;
  slides: ReadonlyArray<{ id: string; type?: string; config?: unknown }>;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ deckId, deckChoice: motif ?? null, ordinals: motifImageOrdinals(slides) }), [deckId, motif, slides]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hoa văn của slide đang vẽ; `slideId` cho biết thứ tự ô hình (không có thì coi là ô đầu). */
export function useSlideMotif(config: Record<string, unknown> | null | undefined, slideId?: string): { motif: SlideMotifId; slot: MotifSlot } | null {
  const ctx = useContext(Ctx);
  return resolveSlideMotif({
    deckId: ctx?.deckId,
    deckChoice: ctx?.deckChoice,
    config,
    imageOrdinal: slideId ? ctx?.ordinals.get(slideId) : 0,
  });
}

/** Lựa chọn hoa văn của cả bài (null = tự động), cho trình sửa hiện "Theo bài giảng: …". */
export const useDeckMotifChoice = (): string | null => useContext(Ctx)?.deckChoice ?? null;

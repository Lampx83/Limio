"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { deckAutoMotif, isMotifId, motifImageOrdinals, resolveSlideMotif, type MotifSlot, type SlideArtId } from "@/lib/limioLiveMotifs";
import { autoImageStyles, resolveImageFrame, resolveImageStyle, type ImageFrame, type ImageStyle } from "@/lib/limioLiveImageStyle";

// Hoa văn trang trí của bài giảng đang soạn hoặc chiếu: mã bài (suy ra hoa văn chủ đạo), lựa chọn của cả bài,
// và thứ tự các ô hình (để hai ô liền nhau khác hoa văn). Đặt cạnh LiveBrandProvider ở gốc trình sửa và trình chiếu.
// Không có provider (ảnh mẫu trong bảng thương hiệu…) thì vẫn có hoa văn tự động, chỉ không biết thứ tự ô hình.

interface MotifCtx {
  deckId: string | null;
  deckChoice: string | null;
  ordinals: Map<string, number>;
  /** Kiểu tự động của từng slide Chữ và hình (docs/tieu-chi/chu-va-hinh-kieu-khung.md, K4–K6). */
  imageStyles: Map<string, ImageStyle>;
  /** LiveDeck.imageFrame: khung hình của cả bài (null = tự động theo hoa văn). */
  imageFrame: string | null;
}

const Ctx = createContext<MotifCtx | null>(null);

export function LiveMotifProvider({
  deckId,
  motif,
  imageFrame,
  slides,
  children,
}: {
  deckId: string;
  motif: string | null | undefined;
  imageFrame?: string | null;
  slides: ReadonlyArray<{ id: string; type?: string; config?: unknown }>;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ deckId, deckChoice: motif ?? null, ordinals: motifImageOrdinals(slides), imageStyles: autoImageStyles(slides), imageFrame: imageFrame ?? null }),
    [deckId, motif, imageFrame, slides],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Hoa văn của slide đang vẽ; `slideId` cho biết thứ tự ô hình (không có thì coi là ô đầu). */
export function useSlideMotif(config: Record<string, unknown> | null | undefined, slideId?: string): { motif: SlideArtId; slot: MotifSlot } | null {
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

/** Kiểu trình bày và khung hình của một slide Chữ và hình; không có provider thì kiểu theo slide, khung tự động. */
export function useImageLook(config: Record<string, unknown> | null | undefined, slideId?: string): { style: ImageStyle; frame: ImageFrame } {
  const ctx = useContext(Ctx);
  const deckMotif = isMotifId(ctx?.deckChoice) ? ctx!.deckChoice : deckAutoMotif(ctx?.deckId);
  return {
    style: resolveImageStyle(config, slideId ? ctx?.imageStyles.get(slideId) : undefined),
    frame: resolveImageFrame({ config, deckFrame: ctx?.imageFrame ?? null, deckMotif }),
  };
}

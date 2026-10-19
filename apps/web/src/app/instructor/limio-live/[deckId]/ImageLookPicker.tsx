"use client";

import {
  IMAGE_FRAMES,
  IMAGE_FRAME_LABEL,
  IMAGE_STYLES,
  IMAGE_STYLE_LABEL,
  frameApplies,
  imageStyleFits,
  isImageFrame,
  isImageStyle,
  type ImageFrame,
  type ImageStyle,
} from "@/lib/limioLiveImageStyle";
import { LayoutSlideView } from "../SlideLayouts";
import { useImageLook } from "../liveMotifContext";
import { slideBgFor } from "../slideThemes";

/**
 * Kiểu trình bày và khung hình của một slide Chữ và hình (docs/tieu-chi/chu-va-hinh-kieu-khung.md, K11–K12). Mỗi ô là chính
 * slide đang soạn vẽ theo lựa chọn đó. Không bắt buộc: "Tự động" để hệ thống xen kẽ kiểu, "Theo bài" dùng khung của cả bài.
 */
export function ImageLookPicker({
  config,
  themeId,
  slideId,
  onStyle,
  onFrame,
}: {
  config: Record<string, unknown>;
  themeId?: string | null;
  slideId?: string;
  /** null = Tự động. */
  onStyle: (style: ImageStyle | null) => void;
  /** null = Theo bài. */
  onFrame: (frame: ImageFrame | null) => void;
}) {
  const own = isImageStyle(config.imageStyle) ? config.imageStyle : null;
  const ownFrame = isImageFrame(config.imageFrame) ? config.imageFrame : null;
  const auto = useImageLook({ ...config, imageStyle: undefined }, slideId);
  const deckFrame = useImageLook({ ...config, imageFrame: undefined }, slideId).frame;
  const effective = useImageLook(config, slideId);
  const unfit = own && !imageStyleFits(own, config);
  // Ô xem trước khung: kiểu đang dùng nếu có ô hình riêng, không thì vẽ trên kiểu "Hình bên phải".
  const frameBase: ImageStyle = frameApplies(effective.style) ? effective.style : "right";

  const thumb = (cfg: Record<string, unknown>, label: string, on: boolean, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`grid gap-1 rounded-xl border p-1 text-center text-xs font-medium transition ${on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"}`}
    >
      <span aria-hidden="true" className="relative block aspect-video w-full overflow-hidden rounded-lg border border-black/10" style={{ background: slideBgFor(themeId, true) }}>
        <span className="absolute inset-0 flex">
          <LayoutSlideView config={cfg} themeId={themeId} />
        </span>
      </span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-0.5 text-xs font-semibold text-muted">Kiểu trình bày</p>
        <p className="mb-1.5 text-xs text-muted">Tự động: hệ thống xen kẽ để các slide Chữ và hình liền nhau không giống nhau.</p>
        <div role="radiogroup" aria-label="Kiểu trình bày" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {thumb({ ...config, imageStyle: auto.style }, `Tự động (${IMAGE_STYLE_LABEL[auto.style].toLowerCase()})`, !own, () => onStyle(null), "auto")}
          {IMAGE_STYLES.map((s) => thumb({ ...config, imageStyle: s }, IMAGE_STYLE_LABEL[s], own === s, () => onStyle(s), s))}
        </div>
        {unfit && (
          <p className="mt-1.5 text-xs text-muted">
            {own === "top" || own === "overlay"
              ? `Kiểu "${IMAGE_STYLE_LABEL[own]}" cần ảnh thật, chữ không quá dài${own === "top" ? " và 2 đến 3 ý" : ""}; slide này đang vẽ như "Hình bên phải".`
              : ""}
          </p>
        )}
      </div>
      <div>
        <p className="mb-0.5 text-xs font-semibold text-muted">Khung hình</p>
        <p className="mb-1.5 text-xs text-muted">Áp cho kiểu có ô hình riêng (bên phải, bên trái, hình nhỏ). Khung của cả bài đổi ở menu Giao diện.</p>
        <div role="radiogroup" aria-label="Khung hình" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {thumb({ ...config, imageStyle: frameBase, imageFrame: deckFrame }, `Theo bài (${IMAGE_FRAME_LABEL[deckFrame].toLowerCase()})`, !ownFrame, () => onFrame(null), "deck")}
          {IMAGE_FRAMES.map((f) => thumb({ ...config, imageStyle: frameBase, imageFrame: f }, IMAGE_FRAME_LABEL[f], ownFrame === f, () => onFrame(f), f))}
        </div>
      </div>
    </div>
  );
}

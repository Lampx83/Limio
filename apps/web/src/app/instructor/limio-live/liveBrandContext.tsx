"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { LOGO_MARGIN_PX, LOGO_PX, logoVisibleOn, sanitizeBrand, type BrandConfig, type SlideRole } from "@/lib/limioLiveBrand";

// Thương hiệu của bài giảng đang soạn hoặc chiếu. Đặt ở gốc trình sửa và trình chiếu để mọi nơi vẽ slide
// (khung soạn, màn chiếu, dải slide thu nhỏ) dùng chung một nguồn; trang của học viên không dùng.
const Ctx = createContext<BrandConfig | null>(null);

export function LiveBrandProvider({ brand, children }: { brand: unknown; children: ReactNode }) {
  const value = useMemo(() => sanitizeBrand(brand), [brand]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLiveBrand = (): BrandConfig | null => useContext(Ctx);

/**
 * Logo cho slide KHÔNG dùng bộ vẽ bố cục (trắc nghiệm, bình chọn, bảng...): phủ lên khung slide theo tỉ lệ
 * khung (khung thay đổi kích thước), cùng vị trí và cỡ như logo trong bố cục. Slide bố cục tự vẽ logo trong LayoutSlideView.
 */
export function BrandLogoOverlay({ role }: { role: SlideRole }) {
  const brand = useLiveBrand();
  if (!brand?.logoUrl || !logoVisibleOn(brand.logoShow, role)) return null;
  const v = (LOGO_MARGIN_PX / 720) * 100;
  const h = (LOGO_MARGIN_PX / 1280) * 100;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={apiUrl(brand.logoUrl)}
      alt=""
      aria-hidden
      draggable={false}
      style={{
        position: "absolute",
        zIndex: 20,
        pointerEvents: "none",
        height: `${(LOGO_PX[brand.logoSize] / 720) * 100}%`,
        width: "auto",
        maxWidth: "22%",
        objectFit: "contain",
        ...(brand.logoPos[0] === "t" ? { top: `${v}%` } : { bottom: `${v}%` }),
        ...(brand.logoPos[1] === "l" ? { left: `${h}%` } : { right: `${h}%` }),
      }}
    />
  );
}

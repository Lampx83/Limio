"use client";

import { useEffect, useState, type CSSProperties, type MouseEventHandler } from "react";
import { renderMath } from "@/lib/mathRender";

/**
 * Render instructor-authored HTML (richtext content) after sanitizing
 * with DOMPurify on the client. Server render is a hidden placeholder —
 * sanitization runs in useEffect so DOMPurify (which depends on the DOM)
 * never touches the server bundle.
 *
 * Strips scripts, event handlers, javascript: URLs, etc. — only safe
 * inline/block formatting tags + http(s)/mailto links survive.
 */
export default function SafeHtml({
  html,
  className,
  style,
  attrs,
  transform,
  onClick,
}: {
  html: string;
  /** Uỷ quyền bấm cho nút nằm trong HTML đã dựng (vd. "Bước tiếp" của lời giải từng bước). */
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  /** Thuộc tính data-* gắn lên khung (vd. data-palette của bài học). */
  attrs?: Record<`data-${string}`, string>;
  /**
   * Biến đổi HTML SAU khi đã làm sạch (vd. dựng <details> cho bố cục Hỏi và
   * đáp). Chỉ được thêm cấu trúc lành tính, không đưa thêm dữ liệu ngoài vào.
   */
  transform?: (sanitizedHtml: string) => string;
}) {
  const [clean, setClean] = useState("");

  useEffect(() => {
    let active = true;
    void import("dompurify").then((mod) => {
      if (!active) return;
      const DOMPurify = mod.default;
      const sanitized = DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        ADD_ATTR: ["target", "rel", "style"],
        ADD_TAGS: ["mark"],
      });
      // Dựng công thức trước, rồi mới tới transform (bố cục), để transform thấy HTML cuối cùng.
      return renderMath(sanitized).then((withMath) => {
        if (active) setClean(transform ? transform(withMath) : withMath);
      });
    });
    return () => {
      active = false;
    };
    // transform là hàm thuần ở cấp module — không cần theo dõi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  return (
    <div
      className={className}
      style={style}
      onClick={onClick}
      {...attrs}
      // sanitized by DOMPurify in the effect above
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

"use client";

import { useEffect, useState } from "react";

export interface LessonSection {
  el: HTMLElement;
  no: string;
  label: string;
}

/**
 * Các mục có số của bài đang xem (tiêu đề mục `.hsk-sh` trong `#lesson-content`) và mục đang đọc khi cuộn (docs/tieu-chi/limio-language-ux-p1-ly-thuyet.md, mục F;
 * dùng cho mục lục phần ở thanh bài và cho nhãn thanh trên dưới `lg`). Bài không có mục có số thì mảng rỗng.
 */
export function useLessonSections(): { secs: LessonSection[]; cur: number } {
  const [secs, setSecs] = useState<LessonSection[]>([]);
  const [cur, setCur] = useState(0);

  useEffect(() => {
    const scan = () => {
      const heads = Array.from(document.querySelectorAll<HTMLElement>("#lesson-content .hsk-sh"));
      const next: LessonSection[] = heads.map((el) => {
        const h2 = el.querySelector("h2");
        const zh = h2?.querySelector(".zh")?.textContent ?? "";
        const text = (h2?.textContent ?? "").replace(zh, "").trim();
        return { el, no: el.querySelector(".hsk-sn")?.textContent?.trim() ?? "", label: text || zh };
      });
      setSecs((prev) => (prev.length === next.length && prev.every((p, i) => p.el === next[i]!.el) ? prev : next));
    };
    scan();
    // Khối bài dựng xong sau lần đầu (khối luyện tập, mục dựng bằng DOM ở trình duyệt): quét lại một lần.
    const t = window.setTimeout(scan, 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (secs.length === 0) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Mục đang đọc = mục cuối cùng có đầu mục đã lên tới 1/3 phía trên màn hình.
        const line = window.innerHeight / 3;
        let active = 0;
        secs.forEach((s, i) => {
          if (s.el.getBoundingClientRect().top <= line) active = i;
        });
        setCur(active);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [secs]);

  return { secs, cur };
}

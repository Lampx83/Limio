"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Nút nhảy về đầu / xuống cuối trang.
 *
 * Hai nút chứ không phải một nút tự đảo chiều: một nút đảo chiều buộc người
 * dùng phải đoán nó đang ở chế độ nào trước khi bấm, và đoán sai thì trang
 * nhảy ngược hẳn lại chỗ vừa đọc. Hai mũi tên luôn nói đúng việc chúng làm.
 *
 * Chỉ hiện khi trang thực sự dài hơn một màn rưỡi — trang ngắn thì nút này
 * chỉ là thêm một thứ che mất nội dung.
 */
export default function ScrollEnds({
  className = "fixed bottom-20 right-4 z-30",
}: {
  /** Vị trí; mặc định xếp dưới cùng cột nút nổi bên phải. */
  className?: string;
}) {
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    function check() {
      const doc = document.documentElement;
      setScrollable(doc.scrollHeight > window.innerHeight * 1.5);
    }
    check();
    window.addEventListener("resize", check);
    // Nội dung dài ra sau khi ảnh tải xong hoặc mục nào đó mở ra, nên đo lại
    // khi cây DOM đổi chứ không chỉ đo đúng một lần lúc gắn.
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", check);
      mo.disconnect();
    };
  }, []);

  if (!scrollable) return null;

  function go(to: "top" | "bottom") {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: to === "top" ? 0 : document.documentElement.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }

  const btn =
    "flex h-9 w-9 items-center justify-center text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]";

  return (
    <div
      className={`${className} flex flex-col overflow-hidden rounded-full border border-token bg-[rgb(var(--surface))] shadow-lg print:hidden`}
    >
      <button type="button" onClick={() => go("top")} className={btn} title="Lên đầu trang" aria-label="Cuộn lên đầu trang">
        <ChevronUp className="h-4 w-4" aria-hidden />
      </button>
      <span className="mx-2 border-t border-token" aria-hidden />
      <button type="button" onClick={() => go("bottom")} className={btn} title="Xuống cuối trang" aria-label="Cuộn xuống cuối trang">
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

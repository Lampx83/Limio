"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";

/**
 * Thanh điều khiển của trang in — và cú gọi in tự động.
 *
 * Nội dung bài được `SafeHtml` làm sạch trong useEffect, tức là nó xuất hiện
 * SAU khi trang hydrate. Gọi `print()` ngay lúc mount sẽ in ra một trang trống.
 * Nên ở đây chờ tài liệu tải xong rồi đợi thêm một nhịp; nút bấm tay vẫn luôn
 * hiện, phòng khi trình duyệt chặn hộp thoại in tự động.
 */
export default function PrintTrigger({ backHref }: { backHref: string }) {
  const fired = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const start = () => {
      timer = setTimeout(() => {
        setReady(true);
        if (fired.current) return;
        fired.current = true;
        window.print();
      }, 900);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", start);
    };
  }, []);

  return (
    <>
      {/* Ẩn khi in: đây là điều khiển của trang, không phải nội dung bài. */}
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link href={backHref} className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
          Quay lại bài học
        </Link>
        <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm">
          <Printer size={16} />
          In / Lưu PDF
        </button>
        <span className="text-meta text-muted">
          {ready
            ? "Trong hộp thoại in, chọn “Lưu thành PDF” để tải về máy."
            : "Đang chuẩn bị bản in…"}
        </span>
      </div>
    </>
  );
}

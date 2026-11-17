"use client";

import { useEffect } from "react";
import { withBasePath } from "@/lib/apiUrl";

const HREF = "/fonts/lxgw-wenkai/regular.css";
let requested = false;

/**
 * Nạp font chữ Hán LXGW WenKai (霞鹜文楷) khi trang có chữ Hán giản thể. Font đã cắt thành 97 mảnh theo unicode-range, nên trình duyệt chỉ tải mảnh nào chứa chữ đang hiện
 * (thường vài trăm KB cho một bài); trang không có chữ Hán không tải gì. Nạp một lần cho cả trang. Chưa tải xong thì chữ hiện bằng font hệ thống rồi đổi (font-display: swap).
 */
export default function HanFontLoader({ lang }: { lang?: string }) {
  useEffect(() => {
    if (lang !== "zh-Hans" || requested) return;
    requested = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = withBasePath(HREF);
    document.head.appendChild(link);
  }, [lang]);
  return null;
}

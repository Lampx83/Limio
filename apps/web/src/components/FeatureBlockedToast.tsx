"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "@/lib/toast";

// Khi requireFeature() chặn 1 trang, nó redirect thẳng về đây (thường là
// dashboard) — không có gì báo cho GV biết TẠI SAO trang cũ biến mất. Nếu GV
// vốn đã đứng ở dashboard, redirect về chính nó nhìn y hệt "bấm không có
// phản ứng gì". Component này đọc ?blocked=<key> trên URL đích, hiện toast
// giải thích, rồi dọn query khỏi URL để F5 không hiện lại.
const MESSAGES: Record<string, string> = {
  limio_live: "Tính năng Limio-Live chưa được bật cho tài khoản này — liên hệ admin nếu bạn cần dùng.",
};

export default function FeatureBlockedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const blocked = searchParams.get("blocked");
  // React Strict Mode (dev) chạy effect 2 lần lúc mount — chưa kịp thấy
  // router.replace dọn query nên lần 2 vẫn thấy `blocked`, toast hiện đôi.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!blocked || firedRef.current) return;
    firedRef.current = true;
    toast.error(MESSAGES[blocked] ?? "Tính năng này chưa được bật cho tài khoản của bạn.");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("blocked");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  return null;
}

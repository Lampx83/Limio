"use client";

import { useEffect, useState } from "react";

/**
 * Khung nhìn THỰC SỰ đang thấy được (trừ bàn phím ảo), để phòng thi cố định co theo nó.
 *
 * Phòng vấn đáp dùng `fixed` toàn màn hình. Trên iOS Safari bàn phím ảo KHÔNG co khung layout, nên ô nhập
 * ở đáy bị bàn phím đè mất — sinh viên báo "bàn phím che ô hiện chữ" và phải tắt bàn phím để đọc câu hỏi.
 * `visualViewport` cho biết phần còn thấy; cả Android lẫn iOS đều hỗ trợ. Trả null khi không hỗ trợ (CSS
 * `100dvh` vẫn lo phần còn lại) và ở lần render đầu trên server.
 */
export function useVisualViewport(): { height: number; offsetTop: number } | null {
  const [vp, setVp] = useState<{ height: number; offsetTop: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVp({ height: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop) });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return vp;
}

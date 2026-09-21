"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cờ bật/tắt nhớ trong trình duyệt (localStorage) — cho tuỳ chọn giao diện của từng người dùng, không phải dữ
 * liệu nghiệp vụ. Lần render đầu luôn là `initial` (khớp với server), rồi mới đọc giá trị đã lưu. Mọi truy cập
 * localStorage bọc try/catch: chế độ riêng tư hoặc bị chặn dữ liệu thì vẫn chạy, chỉ là không nhớ.
 */
export function useStoredFlag(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) setValue(v === "1");
    } catch {
      /* không đọc được thì giữ mặc định */
    }
  }, [key]);

  const set = useCallback(
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* không ghi được thì thôi */
      }
    },
    [key],
  );

  return [value, set];
}

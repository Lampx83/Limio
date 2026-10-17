"use client";

import { useEffect, useRef, useState } from "react";
import type { BrandConfig } from "@/lib/limioLiveBrand";

/**
 * Bản nháp thương hiệu tự lưu: mỗi thay đổi áp ngay lên màn hình, rồi lưu sau một nhịp ngắn (gộp các lần gõ liên tiếp).
 * `update` bỏ khoá có giá trị undefined (xoá logo/màu); `flush` lưu ngay (đóng hộp thoại).
 */
export function useBrandDraft(initial: BrandConfig, onSave: (b: BrandConfig) => void) {
  const [draft, setDraft] = useState<BrandConfig>(initial);
  const [saved, setSaved] = useState(true);
  const latest = useRef(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useRef(onSave);
  save.current = onSave;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    save.current(latest.current);
    setSaved(true);
  };
  const update = (patch: Partial<BrandConfig>, immediate = true) => {
    const next = { ...latest.current, ...patch } as BrandConfig;
    for (const k of Object.keys(patch) as Array<keyof BrandConfig>) if (patch[k] === undefined) delete next[k];
    latest.current = next;
    setDraft(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, immediate ? 120 : 600);
  };
  /** Đặt cả bản nháp (vd. gỡ hết) và lưu ngay. */
  const replace = (next: BrandConfig) => {
    latest.current = next;
    setDraft(next);
    flush();
  };
  return { draft, update, flush, replace, saved };
}

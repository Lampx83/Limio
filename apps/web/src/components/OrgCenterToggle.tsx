"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Công tắc "Tính năng trung tâm" của một trường (CENTER, mục G). Bật thì giảng viên của trường thấy Lịch dạy,
 * Giáo trình dựng sẵn, điểm danh và chuyên cần; tắt thì các mục đó ẩn (dữ liệu giữ nguyên).
 */
export default function OrgCenterToggle({ organizationId, initialEnabled }: { organizationId: string; initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !enabled;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/orgs/${organizationId}/center`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        toast.error("Chưa đổi được cài đặt", { description: res.status === 403 ? "Bạn không có quyền với trường này." : undefined });
        return;
      }
      setEnabled(next);
      toast.success(next ? "Đã bật tính năng trung tâm" : "Đã tắt tính năng trung tâm");
      router.refresh();
    } catch {
      toast.error("Chưa đổi được cài đặt", { description: "Mạng không ổn định, thử lại sau." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5" aria-labelledby="center-toggle-heading">
      <h2 id="center-toggle-heading" className="text-h4">
        Tính năng trung tâm
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Lịch dạy, giáo trình dựng sẵn, điểm danh và chuyên cần. Tắt thì các mục này ẩn khỏi menu của giảng viên trong trường; dữ liệu đã có được
        giữ nguyên.
      </p>
      <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={enabled} disabled={busy} onChange={toggle} />
        <span className="font-medium">{enabled ? "Đang bật cho trường này" : "Đang tắt"}</span>
      </label>
    </section>
  );
}

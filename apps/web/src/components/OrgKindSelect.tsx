"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

type Kind = "school" | "center" | "publisher";

const OPTIONS: Array<{ value: Kind; label: string; hint: string }> = [
  { value: "school", label: "Trường thường", hint: "Thành viên, thi cử, kỳ học, lớp và giáo viên." },
  { value: "center", label: "Trung tâm", hint: "Thêm lịch lớp, điểm danh, điều phối. Quản trị thấy tên học viên để liên hệ." },
  { value: "publisher", label: "Nhà xuất bản", hint: "Học liệu, mã kích hoạt, báo cáo gộp. Quản trị không bao giờ thấy danh tính học viên." },
];

/**
 * Loại của một tổ chức: mỗi tổ chức đúng một loại. Chỉ Platform Admin đổi (admin của tổ chức không tự đổi được, vì đổi loại là đổi
 * phạm vi dữ liệu học viên họ được thấy). Dữ liệu đã có được giữ nguyên khi đổi.
 */
export default function OrgKindSelect({ organizationId, initialKind }: { organizationId: string; initialKind: Kind }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [busy, setBusy] = useState(false);

  async function change(next: Kind) {
    if (next === kind) return;
    if (!window.confirm(`Đổi loại tổ chức thành "${OPTIONS.find((o) => o.value === next)!.label}"? Menu và phạm vi dữ liệu của quản trị tổ chức sẽ đổi theo; dữ liệu đã có được giữ nguyên.`)) return;
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/orgs/${organizationId}/kind`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: next }),
      });
      if (!res.ok) {
        toast.error("Chưa đổi được loại tổ chức", { description: res.status === 403 ? "Chỉ quản trị nền tảng đổi được." : undefined });
        return;
      }
      setKind(next);
      toast.success("Đã đổi loại tổ chức");
      router.refresh();
    } catch {
      toast.error("Chưa đổi được loại tổ chức", { description: "Mạng không ổn định, thử lại sau." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5" aria-labelledby="org-kind-heading">
      <h2 id="org-kind-heading" className="text-h4">Loại tổ chức</h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">Mỗi tổ chức đúng một loại. Loại quyết định menu quản trị và những gì quản trị của tổ chức được thấy.</p>
      <div role="radiogroup" aria-label="Loại tổ chức" className="mt-3 grid gap-2 md:grid-cols-3">
        {OPTIONS.map((o) => (
          <label key={o.value} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm transition-colors ${kind === o.value ? "border-brand-400 bg-brand-50 dark:bg-brand-950/30" : "border-token hover:bg-[rgb(var(--surface-muted))]"}`}>
            <input type="radio" name="org-kind" className="mt-1" checked={kind === o.value} disabled={busy} onChange={() => void change(o.value)} />
            <span>
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

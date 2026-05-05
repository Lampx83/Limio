"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

export default function AddModuleForm({
  courseId,
  nextOrderIndex,
}: {
  courseId: string;
  nextOrderIndex: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-token py-4 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
      >
        + Thêm module
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/courses/${courseId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, orderIndex: nextOrderIndex }),
      });
    } catch (networkErr) {
      setBusy(false);
      console.error("[AddModuleForm] network error", networkErr);
      const msg = "Không kết nối được tới server";
      setError(msg);
      toast.error(msg);
      return;
    }
    setBusy(false);
    if (res.ok) {
      toast.success("Đã tạo module");
      setTitle("");
      setOpen(false);
      router.refresh();
      return;
    }
    const d = await res.json().catch(() => ({}));
    const code = (d as { error?: string }).error ?? `http_${res.status}`;
    console.error("[AddModuleForm] create failed", res.status, d);
    setError(code);
    toast.error(`Tạo module thất bại: ${code}`);
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block flex-1">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Tên module
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            className="input mt-1"
            placeholder="Ví dụ: Phương trình bậc 1"
          />
        </label>
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Tạo"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary btn-sm"
        >
          Hủy
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-danger-600">Lỗi: {error}</p>
      )}
    </form>
  );
}

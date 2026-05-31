"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";

interface Revision {
  id: string;
  subject: string;
  editedAt: string;
  editedByUserId: string;
  editedByName: string | null;
}

export default function HistoryDrawer({
  open,
  onClose,
  templateKey,
  scopeId,
  onReverted,
}: {
  open: boolean;
  onClose: () => void;
  templateKey: string;
  scopeId: string;
  onReverted: () => void;
}) {
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);

  const apiBase = `${apiUrl("/api/admin/emails")}/${encodeURIComponent(templateKey)}`;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`${apiBase}/history?scope=${scopeId}`)
      .then((r) => r.json())
      .then((data) => setRevisions(data.revisions ?? []))
      .catch(() => toast.error("Không tải được lịch sử"))
      .finally(() => setLoading(false));
  }, [open, apiBase, scopeId]);

  async function onRevert(revisionId: string) {
    if (
      !confirm(
        "Khôi phục bản này sẽ ghi đè nội dung hiện tại (bản hiện tại được lưu thành 1 revision mới, có thể quay lại sau). Tiếp tục?",
      )
    )
      return;
    setReverting(revisionId);
    try {
      const res = await fetch(`${apiBase}/revert?scope=${scopeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? "Khôi phục thất bại");
        return;
      }
      toast.success("Đã khôi phục");
      onClose();
      onReverted();
    } finally {
      setReverting(null);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-base-200 px-4 py-3">
          <h2 className="font-semibold">Lịch sử chỉnh sửa</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted hover:bg-base-100"
            aria-label="Đóng"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-muted">Đang tải…</p>
          ) : revisions.length === 0 ? (
            <p className="text-sm text-muted">
              Chưa có lịch sử (chưa ai chỉnh sửa template này ở phạm vi hiện tại).
            </p>
          ) : (
            <ul className="space-y-3">
              {revisions.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-base-200 p-3"
                >
                  <div className="text-xs text-muted">
                    {formatDateTime(r.editedAt)}{" "}
                    · bởi <strong>{r.editedByName ?? r.editedByUserId.slice(0, 8)}</strong>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {r.subject}
                  </p>
                  <button
                    onClick={() => onRevert(r.id)}
                    disabled={reverting === r.id}
                    className="mt-2 text-xs text-brand-700 hover:underline disabled:opacity-50"
                  >
                    {reverting === r.id ? "Đang khôi phục..." : "Khôi phục bản này"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <footer className="border-t border-base-200 px-4 py-2 text-xs text-faint">
          Mỗi lần Save tạo 1 revision của bản trước. Lưu lại tối đa 50 bản gần nhất.
        </footer>
      </aside>
    </div>
  );
}

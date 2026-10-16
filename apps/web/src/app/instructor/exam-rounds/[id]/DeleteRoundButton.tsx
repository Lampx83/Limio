"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * Xoá đợt thi — cùng cơ chế với xoá khoá học: phải gõ đúng tên đợt.
 *
 * Đợt và các ca chưa có bài làm bị xoá cùng nhau. Nếu có bài làm thì server
 * trả `round_has_attempts` kèm số bài: lúc đó không xoá gì, và đề xuất lưu trữ.
 */
export default function DeleteRoundButton({
  roundId,
  roundTitle,
}: {
  roundId: string;
  roundTitle: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  const reset = () => {
    setOpen(false);
    setTyped("");
    setErr(null);
    setBlockedCount(null);
  };

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/exam-rounds/${roundId}`), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmTitle: typed }),
      });
      if (res.ok) {
        window.location.href = "/instructor/organize/formal";
        return;
      }
      const j = (await res.json().catch(() => null)) as {
        error?: string;
        details?: { count?: number };
      } | null;
      if (j?.error === "round_has_attempts") {
        setBlockedCount(j.details?.count ?? 0);
      } else if (j?.error === "title_mismatch") {
        setErr("Tên gõ vào không khớp.");
      } else if (j?.error === "forbidden") {
        setErr("Bạn không có quyền xoá đợt này.");
      } else {
        setErr(`Xoá thất bại: ${j?.error ?? `HTTP ${res.status}`}`);
      }
    } catch {
      setErr("Mất kết nối khi xoá đợt. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl(`/api/exam-rounds/${roundId}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) {
        setErr("Không lưu trữ được đợt. Vui lòng thử lại.");
        return;
      }
      reset();
      router.refresh();
    } catch {
      setErr("Mất kết nối khi lưu trữ đợt. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded border border-red-400 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        <Trash2 size={14} /> Xoá đợt thi
      </button>
    );
  }

  if (blockedCount !== null) {
    return (
      <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-900">
          Không xoá được vì đã có {blockedCount > 0 ? `${blockedCount} bài làm` : "bài làm"}.
        </p>
        <p className="mt-2 text-amber-900">
          Đợt và các ca có bài làm được giữ lại để bảo toàn kết quả. Bạn có thể <b>lưu trữ</b> đợt
          thay vì xoá — dữ liệu được giữ nguyên.
        </p>
        {err && <p className="mt-2 text-red-700">{err}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={archive}
            disabled={busy}
            className="rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {busy ? "Đang lưu trữ…" : "Lưu trữ đợt"}
          </button>
          <button type="button" onClick={reset} disabled={busy} className="btn-secondary btn-sm">
            Đóng
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-red-300 bg-white p-3 text-sm">
      <p className="mb-2 font-medium text-red-800">
        Xoá vĩnh viễn đợt này? Các ca thi chưa có bài làm sẽ bị xoá cùng, và trưởng đợt bị gỡ.
        Không thể hoàn tác.
      </p>
      <p className="mb-2 text-red-700">
        Gõ <code className="rounded bg-red-50 px-1 font-mono">{roundTitle}</code> để xác nhận:
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoFocus
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
        placeholder={roundTitle}
      />
      {err && <p className="mb-2 text-red-700">{err}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || typed.trim() !== roundTitle.trim()}
          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Đang xoá…" : "Xoá vĩnh viễn"}
        </button>
        <button type="button" onClick={reset} disabled={busy} className="btn-secondary btn-sm">
          Huỷ
        </button>
      </div>
    </div>
  );
}

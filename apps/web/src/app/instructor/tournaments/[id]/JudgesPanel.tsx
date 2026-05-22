"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, UserPlus, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

type Judge = {
  id: string;
  addedAt: string;
  user: { id: string; displayName: string; email: string };
};

const ERROR_LABEL: Record<string, string> = {
  user_not_found: "Không tìm thấy user với email này.",
  already_judge: "User này đã là giám khảo.",
  validation_failed: "Email không hợp lệ.",
  forbidden: "Bạn không có quyền chỉnh sửa.",
};

export default function JudgesPanel({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/judges`));
    if (res.ok) {
      const d = await res.json();
      setJudges(d.judges);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function addJudge(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/judges`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setEmail("");
      await load();
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(ERROR_LABEL[body.error] ?? body.error);
    }
  }

  async function removeJudge(userId: string, name: string) {
    if (!confirm(`Xoá "${name}" khỏi danh sách giám khảo?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      apiUrl(`/api/tournaments/${tournamentId}/judges?userId=${userId}`),
      { method: "DELETE" },
    );
    setBusy(false);
    if (res.ok) {
      await load();
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Gavel size={18} className="text-violet-600" />
        <h3 className="text-base font-semibold">Giám khảo hackathon</h3>
      </div>
      <p className="mt-1 text-xs text-muted">
        Khi tournament có giám khảo + mission nộp theo nhóm (PEER_REVIEW), hệ
        thống tự assign mọi giám khảo chấm mỗi đội — thay vì peer chia ngẫu nhiên.
      </p>

      <form onSubmit={addJudge} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="email@vidu.edu.vn"
          className="input flex-1 text-sm"
        />
        <button type="submit" disabled={busy} className="btn-primary btn-sm inline-flex items-center gap-1.5">
          <UserPlus size={14} />
          Thêm
        </button>
      </form>
      {error && (
        <p className="mt-2 text-xs font-medium text-rose-600">⚠ {error}</p>
      )}

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-faint">Đang tải...</p>
        ) : judges.length === 0 ? (
          <p className="rounded-xl border border-dashed border-token px-4 py-8 text-center text-sm text-faint">
            Chưa có giám khảo nào. Thêm email để bắt đầu.
          </p>
        ) : (
          <ul className="divide-y divide-token rounded-xl border border-token">
            {judges.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
                    {(j.user.displayName[0] ?? "?").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{j.user.displayName}</p>
                    <p className="truncate text-xs text-faint">{j.user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeJudge(j.user.id, j.user.displayName)}
                  disabled={busy}
                  title="Xoá khỏi giám khảo"
                  className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

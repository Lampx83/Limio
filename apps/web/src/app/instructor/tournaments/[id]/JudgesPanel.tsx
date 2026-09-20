"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, UserPlus, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { tournamentErrorMessage } from "@/lib/tournamentText";

type Judge = {
  id: string;
  addedAt: string;
  user: { id: string; displayName: string; email: string };
};

const ERROR_LABEL: Record<string, string> = {
  user_not_found: "Không tìm thấy tài khoản nào với email này.",
  already_judge: "Người này đã là giám khảo.",
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
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/judges`));
      if (res.ok) {
        const d = await res.json();
        setJudges(d.judges);
      } else {
        setError("Không tải được danh sách giám khảo.");
      }
    } catch {
      setError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function addJudge(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/judges`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) {
        setEmail("");
        await load();
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(ERROR_LABEL[body.error] ?? tournamentErrorMessage(body, "Chưa thêm được giám khảo."));
      }
    } catch {
      setError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setBusy(false);
    }
  }

  async function removeJudge(userId: string, name: string) {
    if (!confirm(`Xoá "${name}" khỏi danh sách giám khảo?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/tournaments/${tournamentId}/judges?userId=${userId}`),
        { method: "DELETE" },
      );
      if (res.ok) {
        await load();
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(tournamentErrorMessage(body, "Chưa xoá được giám khảo."));
      }
    } catch {
      setError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Gavel size={18} className="text-violet-600" />
        <h3 className="text-base font-semibold">Giám khảo</h3>
      </div>
      <p className="mt-1 text-xs text-muted">
        Không bắt buộc. Nếu đấu trường có giám khảo và có nhiệm vụ chấm chéo nộp theo đội, hệ thống giao
        cho mọi giám khảo chấm bài của từng đội, thay vì để các đội chấm chéo ngẫu nhiên cho nhau.
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
                  title="Bỏ khỏi danh sách giám khảo" aria-label="Bỏ khỏi danh sách giám khảo"
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

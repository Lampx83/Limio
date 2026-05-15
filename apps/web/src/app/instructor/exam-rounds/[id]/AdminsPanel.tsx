"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface AdminInfo {
  userId: string;
  displayName: string;
  email: string;
  grantedAt: string;
}

export default function AdminsPanel({
  roundId,
  admins,
  canEdit,
  currentUserId,
}: {
  roundId: string;
  admins: AdminInfo[];
  canEdit: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onAdd = async () => {
    setErr(null);
    const trimmed = email.trim();
    if (!trimmed) return setErr("Nhập email người dùng.");
    setBusy(true);
    try {
      // Resolve email → userId via existing lookup endpoint.
      const lookup = await fetch(
        `/api/users/lookup?email=${encodeURIComponent(trimmed)}`,
      );
      if (!lookup.ok) {
        if (lookup.status === 404)
          setErr("Không tìm thấy user với email này.");
        else setErr(`HTTP ${lookup.status}`);
        return;
      }
      const { user } = (await lookup.json()) as {
        user: { id: string };
      };
      const r = await fetch(`/api/exam-rounds/${roundId}/admins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (j?.error === "round_admin_already_exists")
          setErr("Người dùng đã là trưởng đợt rồi.");
        else setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setEmail("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (userId: string) => {
    if (admins.length <= 1)
      return alert("Phải còn ít nhất 1 trưởng đợt.");
    if (
      !window.confirm(
        userId === currentUserId
          ? "Gỡ chính bạn khỏi danh sách trưởng đợt? Bạn sẽ mất quyền chỉnh sửa đợt này."
          : "Gỡ trưởng đợt này?",
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/exam-rounds/${roundId}/admins/${userId}`,
        { method: "DELETE" },
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      if (userId === currentUserId) {
        // Self-removed: bounce to list, since we no longer have access.
        window.location.href = "/instructor/exam-rounds";
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-default bg-white p-5">
      <h2 className="text-sm font-semibold">
        Trưởng đợt thi ({admins.length})
      </h2>
      <p className="mt-1 text-xs text-faint">
        Trưởng đợt có quyền chỉnh sửa đợt, ca thi, và gán giám thị. Mỗi đợt phải
        có ít nhất 1 trưởng đợt.
      </p>

      <ul className="mt-4 space-y-2">
        {admins.map((a) => (
          <li
            key={a.userId}
            className="flex items-center justify-between rounded border border-default px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">
                {a.displayName}
                {a.userId === currentUserId && (
                  <span className="ml-2 text-xs text-blue-600">(bạn)</span>
                )}
              </div>
              <div className="text-xs text-faint">{a.email}</div>
            </div>
            {canEdit && (
              <button
                onClick={() => onRemove(a.userId)}
                disabled={busy}
                aria-label={`Gỡ ${a.displayName}`}
                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-5 rounded border border-dashed border-default p-3">
          <div className="text-xs font-medium text-slate-600">
            Thêm trưởng đợt (email)
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 rounded border border-default px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={onAdd}
              disabled={busy}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Thêm
            </button>
          </div>
          {err && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {err}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

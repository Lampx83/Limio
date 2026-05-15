"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, Mail, Trash2, X } from "lucide-react";

interface RoomRow {
  id: string;
  orderIndex: number;
  name: string;
  locationNote: string | null;
  proctorUserId: string;
  proctorName: string;
  graders: Array<{ id: string; displayName: string }>;
  candidateCount: number;
}

export default function SessionRoomsPanel({
  sessionId,
  rooms,
  canEdit,
}: {
  sessionId: string;
  rooms: RoomRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<RoomRow | null>(null);
  const [showBulk, setShowBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onReorder = async (currentIdx: number, dir: -1 | 1) => {
    const target = currentIdx + dir;
    if (target < 0 || target >= rooms.length) return;
    setBusy(true);
    setErr(null);
    try {
      const ordered = rooms.map((r) => r.id);
      const moved = ordered.splice(currentIdx, 1)[0]!;
      ordered.splice(target, 0, moved);
      const r = await fetch(`/api/exam-sessions/${sessionId}/rooms/reorder`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderedRoomIds: ordered }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (room: RoomRow) => {
    if (
      !window.confirm(
        `Xoá phòng "${room.name}"? Thí sinh trong phòng sẽ được unassign (giữ lại trong ca thi).`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-rooms/${room.id}`, { method: "DELETE" });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // Inline PATCH helper used by all editable cells. Refreshes the route on
  // success so the next reorder picks up the new orderIndex / etc.
  const patchRoom = async (
    roomId: string,
    body: Record<string, unknown>,
  ): Promise<string | null> => {
    setErr(null);
    const r = await fetch(`/api/exam-rooms/${roomId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as {
        error?: string;
        details?: { reason?: string };
      } | null;
      const msg =
        j?.details?.reason === "duplicate"
          ? "Tên phòng đã được dùng trong ca thi này."
          : j?.details?.reason === "user_not_found"
            ? "Không tìm thấy user."
            : j?.error ?? `HTTP ${r.status}`;
      setErr(msg);
      return msg;
    }
    router.refresh();
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-faint">
          {rooms.length} phòng thi trong ca này.
          {canEdit &&
            " Sửa tên / địa điểm bằng cách click vào ô. Đổi giám thị qua nút ✎."}
        </p>
        {canEdit && (
          <button
            onClick={() => setShowBulk(true)}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            + Thêm phòng thi
          </button>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="rounded border border-dashed border-default p-8 text-center text-sm text-faint">
          Chưa có phòng thi nào.{" "}
          {canEdit && "Click \"+ Thêm phòng thi\" để khởi tạo."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-default bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-4 py-2.5">STT</th>
                <th className="px-4 py-2.5">Tên phòng</th>
                <th className="px-4 py-2.5">Địa điểm / Zoom</th>
                <th className="px-4 py-2.5">Giám thị</th>
                <th className="px-4 py-2.5">Người chấm</th>
                <th className="px-4 py-2.5 text-right">Thí sinh</th>
                <th className="w-32 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, idx) => (
                <tr key={r.id} className="border-t border-default">
                  <td className="px-4 py-3 text-xs text-faint">{r.orderIndex}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {canEdit ? (
                        <InlineTextCell
                          value={r.name}
                          onSave={(v) =>
                            v && v !== r.name
                              ? patchRoom(r.id, { name: v })
                              : Promise.resolve(null)
                          }
                          ariaLabel={`Đổi tên ${r.name}`}
                          placeholder="Tên phòng"
                        />
                      ) : (
                        <span className="font-medium">{r.name}</span>
                      )}
                      <Link
                        href={`${pathname}/rooms/${r.id}`}
                        className="text-xs text-blue-600 hover:underline"
                        title="Vào trang quản lý thí sinh"
                      >
                        ↗
                      </Link>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <InlineTextCell
                        value={r.locationNote ?? ""}
                        onSave={(v) =>
                          patchRoom(r.id, { locationNote: v.trim() || null })
                        }
                        ariaLabel={`Đổi địa điểm phòng ${r.name}`}
                        placeholder="Vd: Nhà A1 t1"
                      />
                    ) : (
                      <span className="text-xs text-faint">
                        {r.locationNote || (
                          <span className="text-slate-300">—</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canEdit ? (
                      <InlineProctorCell
                        roomId={r.id}
                        currentName={r.proctorName}
                        onPick={async (userId) =>
                          patchRoom(r.id, { proctorUserId: userId })
                        }
                      />
                    ) : (
                      <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs">
                        {r.proctorName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.graders.length === 0 ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.graders.map((g) => (
                          <span
                            key={g.id}
                            className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs"
                          >
                            {g.displayName}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{r.candidateCount}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-0.5">
                        <button
                          onClick={() => onReorder(idx, -1)}
                          disabled={busy || idx === 0}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                          aria-label={`Đưa ${r.name} lên trên`}
                          title="Đưa lên"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => onReorder(idx, 1)}
                          disabled={busy || idx === rooms.length - 1}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                          aria-label={`Đưa ${r.name} xuống dưới`}
                          title="Đưa xuống"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => setEditing(r)}
                          className="rounded p-1.5 text-slate-600 hover:bg-slate-100"
                          aria-label={`Sửa chi tiết ${r.name}`}
                          title="Sửa chi tiết (người chấm)"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => onDelete(r)}
                          disabled={busy}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label={`Xoá ${r.name}`}
                          title="Xoá"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {editing && (
        <RoomDetailDialog
          room={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {showBulk && (
        <BulkCreateDialog
          sessionId={sessionId}
          onClose={() => setShowBulk(false)}
          onDone={() => {
            setShowBulk(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// Inline editable cells
// ============================================================================

function InlineTextCell({
  value,
  onSave,
  ariaLabel,
  placeholder,
}: {
  value: string;
  onSave: (next: string) => Promise<string | null>;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  const commit = async () => {
    if (busy) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const err = await onSave(draft);
    setBusy(false);
    if (!err) setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={ariaLabel}
        className="w-full rounded border border-transparent px-2 py-1 text-left text-sm hover:border-default hover:bg-slate-50"
      >
        {value || <span className="text-slate-300 italic">{placeholder ?? "—"}</span>}
      </button>
    );
  }
  return (
    <input
      type="text"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          cancel();
        }
      }}
      disabled={busy}
      placeholder={placeholder}
      className="w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm focus:outline-none disabled:opacity-50"
    />
  );
}

function InlineProctorCell({
  roomId,
  currentName,
  onPick,
}: {
  roomId: string;
  currentName: string;
  onPick: (userId: string) => Promise<string | null>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Invite sub-flow state: when lookup returns 404, prompt for displayName.
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState("");

  const commit = async () => {
    if (!email.trim()) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/users/lookup?email=${encodeURIComponent(email.trim())}`);
      if (r.status === 404) {
        // Switch to invite sub-form, default name = email prefix.
        const prefix = email.split("@")[0] ?? "";
        setInviteName(prefix);
        setInviting(true);
        return;
      }
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const { user } = (await r.json()) as { user: { id: string } };
      const e = await onPick(user.id);
      if (!e) {
        setEmail("");
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitInvite = async () => {
    if (!inviteName.trim()) {
      setErr("Cần nhập họ tên.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-rooms/${roomId}/proctor/invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: inviteName.trim(),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      // Success — close form, refresh row to show new proctor.
      setEmail("");
      setInviteName("");
      setInviting(false);
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs">
          {currentName}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Đổi
        </button>
      </div>
    );
  }
  if (inviting) {
    return (
      <div className="flex flex-col gap-1 rounded border border-amber-300 bg-amber-50 p-1.5">
        <div className="text-[10px] text-amber-800">
          <Mail className="mr-1 inline h-3 w-3 align-text-bottom" /> Email <strong>{email}</strong> chưa có tài khoản — gửi lời mời?
        </div>
        <div className="flex items-center gap-1">
          <input
            type="text"
            autoFocus
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitInvite();
              } else if (e.key === "Escape") {
                setInviting(false);
                setInviteName("");
                setErr(null);
              }
            }}
            placeholder="Họ tên"
            disabled={busy}
            className="w-32 rounded border border-blue-400 px-2 py-1 text-xs focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submitInvite}
            disabled={busy || !inviteName.trim()}
            className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Gửi lời mời
          </button>
          <button
            type="button"
            onClick={() => {
              setInviting(false);
              setInviteName("");
              setErr(null);
            }}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Huỷ"
          >
            <X size={12} />
          </button>
        </div>
        {err && <div className="text-[10px] text-red-600">{err}</div>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setEditing(false);
              setEmail("");
              setErr(null);
            }
          }}
          placeholder="email@..."
          disabled={busy}
          className="w-32 rounded border border-blue-400 px-2 py-1 text-xs focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={commit}
          disabled={busy || !email.trim()}
          className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-amber-700 disabled:opacity-50"
        >
          OK
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setEmail("");
            setErr(null);
          }}
          className="text-slate-400 hover:text-slate-700"
          aria-label="Huỷ"
        >
          <X size={12} />
        </button>
      </div>
      {err && <div className="text-[10px] text-red-600">{err}</div>}
    </div>
  );
}

// ============================================================================
// Bulk create dialog
// ============================================================================

function BulkCreateDialog({
  sessionId,
  onClose,
  onDone,
}: {
  sessionId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [count, setCount] = useState(5);
  const [prefix, setPrefix] = useState("Phòng");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (count < 1 || count > 50) {
      setErr("Số phòng phải từ 1 đến 50.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-sessions/${sessionId}/rooms/bulk`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count, namePrefix: prefix.trim() || "Phòng" }),
      });
      const j = (await r.json().catch(() => null)) as {
        created?: number;
        error?: string;
      } | null;
      if (!r.ok) {
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-default px-5 py-3">
          <h3 className="text-base font-semibold">Tạo nhiều phòng thi</h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Số lượng phòng <span className="text-red-600">*</span>
            </span>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) =>
                setCount(Number.parseInt(e.target.value, 10) || 0)
              }
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-faint">
              Tối đa 50 phòng/lần. Tên mặc định: "{prefix.trim() || "Phòng"} 1",
              "{prefix.trim() || "Phòng"} 2"…
            </span>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Tiền tố tên (tuỳ chọn)
            </span>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              maxLength={40}
              placeholder="Phòng"
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Sau khi tạo, click vào ô tên / địa điểm / giám thị trong bảng để
            sửa nhanh từng phòng. Người chấm gán qua nút ✎ cuối hàng.
          </p>
          {err && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-default px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded border border-default px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Đang tạo..." : `Tạo ${count} phòng`}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ============================================================================
// Detail dialog for grader management (proctor + name + location already inline)
// ============================================================================

interface PickedUser {
  id: string;
  displayName: string;
  email?: string;
}

function RoomDetailDialog({
  room,
  onClose,
  onDone,
}: {
  room: RoomRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [graders, setGraders] = useState<PickedUser[]>(room.graders);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-rooms/${room.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ graderUserIds: graders.map((g) => g.id) }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-default px-5 py-3">
          <h3 className="text-base font-semibold">
            Người chấm cho "{room.name}"
          </h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4">
          <p className="text-[11px] text-faint">
            0..N người. Có thể trùng với giám thị.
          </p>
          <UserPicker value={graders} onChange={setGraders} max={20} />
          {err && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-default px-5 py-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded border border-default px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function UserPicker({
  value,
  onChange,
  max,
}: {
  value: PickedUser[];
  onChange: (next: PickedUser[]) => void;
  max: number;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setErr(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    if (value.length >= max) {
      setErr(`Tối đa ${max} người.`);
      return;
    }
    if (value.some((v) => v.email === trimmed)) {
      setErr("Email này đã được thêm.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/users/lookup?email=${encodeURIComponent(trimmed)}`);
      if (!r.ok) {
        if (r.status === 404) setErr("Không tìm thấy user với email này.");
        else setErr(`HTTP ${r.status}`);
        return;
      }
      const { user } = (await r.json()) as {
        user: { id: string; displayName: string; email: string };
      };
      onChange([
        ...value,
        { id: user.id, displayName: user.displayName, email: user.email },
      ]);
      setEmail("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded border border-default p-2">
      {value.length > 0 && (
        <ul className="mb-2 space-y-1">
          {value.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-sm"
            >
              <span>
                <span className="font-medium">{u.displayName}</span>
                {u.email && (
                  <span className="ml-1 text-xs text-faint">({u.email})</span>
                )}
              </span>
              <button
                onClick={() => onChange(value.filter((v) => v.id !== u.id))}
                className="text-slate-400 hover:text-red-600"
                aria-label={`Gỡ ${u.displayName}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="email@example.com"
          className="flex-1 rounded border border-default px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={add}
          disabled={busy || value.length >= max}
          className="rounded border border-default px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          + Thêm
        </button>
      </div>
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
    </div>
  );
}

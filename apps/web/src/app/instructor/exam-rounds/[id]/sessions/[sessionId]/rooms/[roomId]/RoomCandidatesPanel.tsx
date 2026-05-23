"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";

interface CandidateRow {
  id: string;
  displayName: string;
  accessCode: string | null;
  userId: string | null;
  email: string | null;
  mssv: string | null;
  disabledAt: string | null;
  arrivedAt: string | null;
  createdAt: string;
}

export interface OtherRoom {
  id: string;
  name: string;
  orderIndex: number;
  candidateCount: number;
}

export default function RoomCandidatesPanel({
  roomId,
  candidates,
  canEdit,
  otherRooms,
  examAccessMode,
}: {
  roomId: string;
  candidates: CandidateRow[];
  canEdit: boolean;
  otherRooms: OtherRoom[];
  examAccessMode: string;
}) {
  // Mã thi 8 ký tự ở ExamCandidate.accessCode chỉ có nghĩa với chế độ
  // assigned_code (thí sinh dùng để claim qua /exam/<mã>). Với open_code
  // (thí sinh dùng mã ca thi + form khai báo) mã này là dead data → ẩn cột.
  const showAccessCodeColumn = examAccessMode === "assigned_code";
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [moveTargetId, setMoveTargetId] = useState<string>("");

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleSelectAll = () => {
    if (selected.length === candidates.length) setSelected([]);
    else setSelected(candidates.map((c) => c.id));
  };

  const doMove = async () => {
    if (!moveTargetId || selected.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-rooms/${moveTargetId}/candidates/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateIds: selected }),
      });
      const j = (await r.json().catch(() => null)) as {
        moved?: number;
        error?: string;
      } | null;
      if (!r.ok) {
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setNotice(`Đã chuyển ${j?.moved ?? 0} thí sinh.`);
      setSelected([]);
      setMoveTargetId("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  // Toggle attendance: optimistic-ish — POST + refresh.
  const onToggleAttendance = async (cand: CandidateRow) => {
    setErr(null);
    const next = !cand.arrivedAt;
    const r = await fetch(
      `/api/exam-rooms/${roomId}/candidates/${cand.id}/attendance`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ present: next }),
      },
    );
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      setErr(j?.error ?? `HTTP ${r.status}`);
      return;
    }
    router.refresh();
  };

  const onRemove = async (cand: CandidateRow) => {
    if (
      !window.confirm(
        `Xoá thí sinh "${cand.displayName}" khỏi phòng? Không thể hoàn tác.`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(
        `/api/exam-rooms/${roomId}/candidates/${cand.id}`,
        { method: "DELETE" },
      );
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

  return (
    <section className="rounded-lg border border-default bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-default px-5 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">
            Danh sách thí sinh ({candidates.length})
          </h2>
          {candidates.length > 0 && (
            <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
              ✓ Có mặt: {candidates.filter((c) => c.arrivedAt).length}/
              {candidates.length}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Thêm thí sinh
          </button>
        )}
      </header>

      {candidates.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-faint">
          Chưa có thí sinh nào trong phòng này.
          {canEdit && " Click \"+ Thêm thí sinh\" để nhập."}
        </div>
      ) : (
        <>
          {canEdit && selected.length > 0 && otherRooms.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-default bg-blue-50 px-5 py-2 text-sm">
              <span className="text-blue-700">
                Đã chọn {selected.length}
              </span>
              <span className="text-faint">→ chuyển sang phòng:</span>
              <select
                value={moveTargetId}
                onChange={(e) => setMoveTargetId(e.target.value)}
                className="rounded border border-default px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
              >
                <option value="">— Chọn phòng đích —</option>
                {otherRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    STT {r.orderIndex} — {r.name}
                  </option>
                ))}
              </select>
              <button
                onClick={doMove}
                disabled={busy || !moveTargetId}
                className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Chuyển
              </button>
              <button
                onClick={() => setSelected([])}
                className="text-xs text-slate-600 underline"
              >
                Bỏ chọn
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {canEdit && (
                    <th className="w-8 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          selected.length > 0 &&
                          selected.length === candidates.length
                        }
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả"
                      />
                    </th>
                  )}
                  <th className="w-12 px-4 py-2.5">STT</th>
                  <th className="px-4 py-2.5">Họ tên</th>
                  <th className="px-4 py-2.5">MSSV</th>
                  <th className="px-4 py-2.5">Email</th>
                  {showAccessCodeColumn && (
                    <th className="px-4 py-2.5">Mã thi</th>
                  )}
                  <th className="px-4 py-2.5">Có mặt</th>
                  <th className="px-4 py-2.5">Tài khoản</th>
                  <th className="w-16 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`border-t border-default ${c.arrivedAt ? "bg-emerald-50/30" : ""}`}
                  >
                    {canEdit && (
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          aria-label={`Chọn ${c.displayName}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-xs text-faint">{idx + 1}</td>
                  <td className="px-4 py-2.5 font-medium">{c.displayName}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.mssv || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.email || <span className="text-slate-300">—</span>}
                  </td>
                  {showAccessCodeColumn && (
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {c.accessCode || <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleAttendance(c)}
                      title={
                        c.arrivedAt
                          ? `Có mặt lúc ${new Date(c.arrivedAt).toLocaleTimeString("vi-VN")} — bấm để huỷ`
                          : "Bấm để đánh dấu có mặt"
                      }
                      className={`inline-flex items-center justify-center rounded-full border h-6 w-6 text-sm transition-colors ${
                        c.arrivedAt
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 bg-white text-slate-300 hover:border-emerald-400 hover:text-emerald-500"
                      }`}
                      aria-label={`Điểm danh ${c.displayName}`}
                      aria-pressed={!!c.arrivedAt}
                    >
                      ✓
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {c.userId ? (
                      <span className="rounded-sm bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                        Đã link
                      </span>
                    ) : (
                      <span className="text-faint">Anonymous</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEdit && (
                      <button
                        onClick={() => onRemove(c)}
                        disabled={busy}
                        aria-label={`Xoá ${c.displayName}`}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {err && (
        <div className="border-t border-red-300 bg-red-50 px-5 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {notice && (
        <div className="border-t border-emerald-300 bg-emerald-50 px-5 py-2 text-sm text-emerald-800">
          {notice}{" "}
          <button
            onClick={() => setNotice(null)}
            className="ml-2 text-xs text-emerald-700 underline"
          >
            Đóng
          </button>
        </div>
      )}

      {showAdd && (
        <AddCandidatesDialog
          roomId={roomId}
          otherRooms={otherRooms}
          onClose={() => setShowAdd(false)}
          onDone={(result) => {
            setShowAdd(false);
            if (result) {
              const parts: string[] = [];
              if (result.added) parts.push(`Đã thêm ${result.added} thí sinh`);
              if (result.copied) parts.push(`copy ${result.copied} thí sinh`);
              if (result.skipped) parts.push(`bỏ qua ${result.skipped} trùng`);
              setNotice(parts.length > 0 ? parts.join(", ") + "." : null);
            }
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

interface ParsedCandidate {
  displayName: string;
  email?: string | null;
  mssv?: string | null;
}

type Mode = "manual" | "csv" | "copy";

function AddCandidatesDialog({
  roomId,
  otherRooms,
  onClose,
  onDone,
}: {
  roomId: string;
  otherRooms: OtherRoom[];
  onClose: () => void;
  onDone: (
    result:
      | { added?: number; copied?: number; skipped: number }
      | null,
  ) => void;
}) {
  const [mode, setMode] = useState<Mode>("manual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copyFromRoomId, setCopyFromRoomId] = useState<string>("");

  // Manual mode: a list of in-progress candidate inputs.
  const [manual, setManual] = useState<ParsedCandidate[]>([
    { displayName: "", email: "", mssv: "" },
  ]);

  // CSV mode: parsed preview.
  const [csvRaw, setCsvRaw] = useState("");
  const [csvPreview, setCsvPreview] = useState<{
    ok: ParsedCandidate[];
    errors: Array<{ line: number; reason: string }>;
  } | null>(null);

  const submit = async (cands: ParsedCandidate[]) => {
    setErr(null);
    if (cands.length === 0) {
      setErr("Chưa có thí sinh nào để thêm.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-rooms/${roomId}/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidates: cands.map((c) => ({
            displayName: c.displayName.trim(),
            email: c.email?.trim() || null,
            mssv: c.mssv?.trim() || null,
          })),
        }),
      });
      const j = (await r.json().catch(() => null)) as {
        added?: number;
        skipped?: number;
        error?: string;
        details?: unknown;
      } | null;
      if (!r.ok) {
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone({ added: j?.added ?? 0, skipped: j?.skipped ?? 0 });
    } finally {
      setBusy(false);
    }
  };

  const submitManual = () => {
    const valid = manual.filter((c) => c.displayName.trim().length > 0);
    if (valid.length === 0) {
      setErr("Phải nhập ít nhất 1 thí sinh có họ tên.");
      return;
    }
    submit(valid);
  };

  const submitCsv = () => {
    if (!csvPreview || csvPreview.ok.length === 0) {
      setErr("CSV chưa có dòng hợp lệ.");
      return;
    }
    submit(csvPreview.ok);
  };

  const submitCopy = async () => {
    setErr(null);
    if (!copyFromRoomId) {
      setErr("Chọn phòng nguồn để copy.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-rooms/${roomId}/candidates/copy-from`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromRoomId: copyFromRoomId }),
      });
      const j = (await r.json().catch(() => null)) as {
        copied?: number;
        skipped?: number;
        error?: string;
        details?: { reason?: string };
      } | null;
      if (!r.ok) {
        if (j?.details?.reason === "rooms_in_different_sessions")
          setErr("Chỉ copy được giữa các phòng trong cùng ca thi.");
        else setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone({ copied: j?.copied ?? 0, skipped: j?.skipped ?? 0 });
    } finally {
      setBusy(false);
    }
  };

  const parseCsv = () => {
    const out: ParsedCandidate[] = [];
    const errors: Array<{ line: number; reason: string }> = [];
    const lines = csvRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setCsvPreview({ ok: [], errors: [] });
      return;
    }

    // Optional header: detect by looking for "ho ten" / "hoten" / "displayName".
    let startIdx = 0;
    const lower = lines[0]!.toLowerCase();
    if (
      lower.includes("ho") ||
      lower.includes("displayname") ||
      lower.includes("tên")
    )
      startIdx = 1;

    for (let i = startIdx; i < lines.length; i++) {
      const raw = lines[i]!;
      // Simple CSV: split by comma. No quoted-field handling (instructor input,
      // we'll add full RFC 4180 parsing if real-world examples need it).
      const cols = raw.split(",").map((c) => c.trim());
      const displayName = cols[0] ?? "";
      const email = cols[1] ?? "";
      const mssv = cols[2] ?? "";
      if (!displayName) {
        errors.push({ line: i + 1, reason: "Thiếu họ tên" });
        continue;
      }
      out.push({
        displayName,
        email: email || null,
        mssv: mssv || null,
      });
    }
    setCsvPreview({ ok: out, errors });
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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-default px-5 py-3">
          <h3 className="text-base font-semibold">Thêm thí sinh vào phòng</h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="border-b border-default px-5">
          <nav className="-mb-px flex gap-1">
            <button
              onClick={() => setMode("manual")}
              className={`border-b-2 px-3 py-2 text-sm ${
                mode === "manual"
                  ? "border-blue-500 font-semibold text-blue-700"
                  : "border-transparent text-slate-600"
              }`}
            >
              Nhập tay
            </button>
            <button
              onClick={() => setMode("csv")}
              className={`border-b-2 px-3 py-2 text-sm ${
                mode === "csv"
                  ? "border-blue-500 font-semibold text-blue-700"
                  : "border-transparent text-slate-600"
              }`}
            >
              Import CSV
            </button>
            {otherRooms.length > 0 && (
              <button
                onClick={() => setMode("copy")}
                className={`border-b-2 px-3 py-2 text-sm ${
                  mode === "copy"
                    ? "border-blue-500 font-semibold text-blue-700"
                    : "border-transparent text-slate-600"
                }`}
              >
                Copy từ phòng khác
              </button>
            )}
          </nav>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {mode === "manual" && (
            <div className="space-y-2">
              <p className="text-xs text-faint">
                Mỗi hàng = 1 thí sinh. Họ tên bắt buộc; email + MSSV tuỳ chọn.
              </p>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-faint">
                  <tr>
                    <th className="w-8"></th>
                    <th className="px-2 py-1">Họ tên *</th>
                    <th className="px-2 py-1">Email</th>
                    <th className="px-2 py-1">MSSV</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {manual.map((c, i) => (
                    <tr key={i}>
                      <td className="text-xs text-faint">{i + 1}</td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={c.displayName}
                          onChange={(e) =>
                            setManual((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, displayName: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="Nguyễn Văn A"
                          className="w-full rounded border border-default px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="email"
                          value={c.email ?? ""}
                          onChange={(e) =>
                            setManual((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, email: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="a@x.com"
                          className="w-full rounded border border-default px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={c.mssv ?? ""}
                          onChange={(e) =>
                            setManual((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, mssv: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="K65-001"
                          className="w-full rounded border border-default px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </td>
                      <td>
                        {manual.length > 1 && (
                          <button
                            onClick={() =>
                              setManual((prev) =>
                                prev.filter((_, j) => j !== i),
                              )
                            }
                            className="text-slate-400 hover:text-red-600"
                            aria-label={`Xoá hàng ${i + 1}`}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={() =>
                  setManual((prev) => [
                    ...prev,
                    { displayName: "", email: "", mssv: "" },
                  ])
                }
                className="rounded border border-default px-3 py-1 text-xs hover:bg-slate-50"
              >
                + Thêm hàng
              </button>
            </div>
          )}

          {mode === "csv" && (
            <div className="space-y-3">
              <p className="text-xs text-faint">
                Mỗi dòng:{" "}
                <code className="rounded bg-slate-100 px-1 font-mono">
                  Họ tên, email, MSSV
                </code>
                . Header (nếu có) tự bỏ qua. Bỏ trống email/MSSV nếu không có.
              </p>
              <textarea
                value={csvRaw}
                onChange={(e) => setCsvRaw(e.target.value)}
                rows={8}
                placeholder={"Nguyễn Văn A, a@x.com, K65-001\nTrần Thị B, b@x.com, K65-002"}
                className="w-full rounded border border-default px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={parseCsv}
                  className="rounded border border-default px-3 py-1 text-xs hover:bg-slate-50"
                >
                  Preview
                </button>
                {csvPreview && (
                  <span className="text-xs text-faint">
                    {csvPreview.ok.length} hợp lệ
                    {csvPreview.errors.length > 0 &&
                      `, ${csvPreview.errors.length} lỗi`}
                  </span>
                )}
              </div>
              {csvPreview && csvPreview.ok.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border border-default">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-left text-faint">
                      <tr>
                        <th className="px-2 py-1">Họ tên</th>
                        <th className="px-2 py-1">Email</th>
                        <th className="px-2 py-1">MSSV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.ok.map((c, i) => (
                        <tr key={i} className="border-t border-default">
                          <td className="px-2 py-1">{c.displayName}</td>
                          <td className="px-2 py-1">{c.email || "—"}</td>
                          <td className="px-2 py-1">{c.mssv || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {csvPreview && csvPreview.errors.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <div className="font-semibold">Dòng lỗi:</div>
                  <ul className="mt-1 list-inside list-disc">
                    {csvPreview.errors.map((e, i) => (
                      <li key={i}>
                        Dòng {e.line}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {mode === "copy" && (
            <div className="space-y-3">
              <p className="text-xs text-faint">
                Copy toàn bộ thí sinh từ 1 phòng khác trong cùng ca thi sang
                phòng này. Mỗi thí sinh sao chép sẽ có mã thi mới. Trùng email
                / MSSV (đã có trong phòng này) sẽ bị bỏ qua.
              </p>
              <label className="block">
                <span className="block text-xs font-medium text-slate-600">
                  Phòng nguồn <span className="text-red-600">*</span>
                </span>
                <select
                  value={copyFromRoomId}
                  onChange={(e) => setCopyFromRoomId(e.target.value)}
                  className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— Chọn phòng nguồn —</option>
                  {otherRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      STT {r.orderIndex} — {r.name} ({r.candidateCount} thí sinh)
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

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
            onClick={
              mode === "manual"
                ? submitManual
                : mode === "csv"
                  ? submitCsv
                  : submitCopy
            }
            disabled={busy}
            className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy
              ? mode === "copy"
                ? "Đang copy..."
                : "Đang thêm..."
              : mode === "copy"
                ? "Copy vào phòng"
                : "Thêm vào phòng"}
          </button>
        </footer>
      </div>
    </div>
  );
}

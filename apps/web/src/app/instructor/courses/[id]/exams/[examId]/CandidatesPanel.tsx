"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";

type Row = {
  id: string;
  displayName: string;
  accessCode: string | null;
  metadata: Record<string, unknown> | null;
  disabledAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  attemptCount: number;
  roomId: string | null;
  roomName: string | null;
};

type RoomOption = { id: string; name: string };

type Mode = "authenticated" | "open_code" | "assigned_code";

export default function CandidatesPanel({
  examId,
  examAccessMode,
}: {
  examId: string;
  examAccessMode: Mode;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [roomFilter, setRoomFilter] = useState<"all" | "unassigned" | string>(
    "all",
  );
  const [emailPreview, setEmailPreview] = useState<{
    recipients: number;
    skipped: number;
    preview: {
      candidate: { displayName: string; email: string; accessCode: string };
      subject: string;
      html: string;
      text: string;
    } | null;
  } | null>(null);

  const refresh = async () => {
    setErr(null);
    const [candRes, roomRes] = await Promise.all([
      fetch(`/api/exams/${examId}/candidates`),
      fetch(`/api/exams/${examId}/rooms`),
    ]);
    if (!candRes.ok) {
      setErr(`HTTP ${candRes.status}`);
      return;
    }
    const candJson = (await candRes.json()) as { candidates: Row[] };
    setRows(candJson.candidates);
    if (roomRes.ok) {
      const j = (await roomRes.json()) as {
        rooms: Array<{ id: string; name: string }>;
      };
      setRooms(j.rooms.map((r) => ({ id: r.id, name: r.name })));
    }
    // Drop selections that no longer exist.
    setSelectedIds((s) => {
      const valid = new Set(candJson.candidates.map((c) => c.id));
      return new Set([...s].filter((id) => valid.has(id)));
    });
  };

  useEffect(() => {
    if (examAccessMode === "assigned_code") refresh();
  }, [examId, examAccessMode]);

  const assignSelectedToRoom = async (roomId: string | null) => {
    if (selectedIds.size === 0) return;
    setBusy("assign");
    setErr(null);
    try {
      const r = await fetch(
        `/api/exams/${examId}/rooms/assign-candidates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            candidateIds: [...selectedIds],
            roomId,
          }),
        },
      );
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { assigned: number };
      flashOk(
        roomId
          ? `Đã gán ${j.assigned} thí sinh vào phòng.`
          : `Đã bỏ gán ${j.assigned} thí sinh.`,
      );
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const flashOk = (s: string) => {
    setFlash(s);
    setTimeout(() => setFlash(null), 3000);
  };

  if (examAccessMode !== "assigned_code") {
    return null;
  }

  const filteredRows = (rows ?? []).filter((r) => {
    if (roomFilter === "all") return true;
    if (roomFilter === "unassigned") return r.roomId === null;
    return r.roomId === roomFilter;
  });

  const addOne = async () => {
    const name = window.prompt("Tên thí sinh:")?.trim();
    if (!name) return;
    const email = window.prompt("Email (tuỳ chọn):")?.trim();
    setBusy("add");
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          metadata: email ? { email } : undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
      } else {
        await refresh();
        flashOk("Đã thêm");
      }
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Xoá thí sinh này?")) return;
    const r = await fetch(`/api/candidates/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      setErr(j?.error ?? `HTTP ${r.status}`);
    } else {
      await refresh();
    }
  };

  const onToggleDisable = async (row: Row) => {
    const r = await fetch(`/api/candidates/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ disabled: row.disabledAt === null }),
    });
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
    } else {
      await refresh();
    }
  };

  const onOpenSendPreview = async () => {
    setBusy("preview");
    setErr(null);
    try {
      const r = await fetch(
        `/api/exams/${examId}/candidates/send-codes/preview`,
      );
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as {
        recipients: number;
        skipped: number;
        preview: {
          candidate: {
            displayName: string;
            email: string;
            accessCode: string;
          };
          subject: string;
          html: string;
          text: string;
        } | null;
      };
      if (j.recipients === 0) {
        setErr("Không có thí sinh nào có email.");
        return;
      }
      setEmailPreview(j);
    } finally {
      setBusy(null);
    }
  };

  const onConfirmSend = async () => {
    setBusy("send");
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/candidates/send-codes`, {
        method: "POST",
      });
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as {
        attempted: number;
        delivered: number;
        loggedOnly: number;
        failed: { candidateId: string; error: string }[];
      };
      flashOk(
        `Đã gửi ${j.delivered} / log-only ${j.loggedOnly} / lỗi ${j.failed.length} (tổng ${j.attempted})`,
      );
      setEmailPreview(null);
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    if (!rows) return;
    const head = ["displayName", "accessCode", "email", "studentCode", "class", "disabledAt", "attemptCount"];
    const lines = [head.join(",")];
    for (const r of rows) {
      const m = (r.metadata ?? {}) as Record<string, string | undefined>;
      lines.push(
        [
          csv(r.displayName),
          csv(r.accessCode ?? ""),
          csv(m.email ?? ""),
          csv(m.studentCode ?? ""),
          csv(m.class ?? ""),
          csv(r.disabledAt ?? ""),
          String(r.attemptCount),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `candidates-${examId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      id="candidates"
      data-testid="candidates-panel"
      className="mt-8 rounded border border-default bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Thí sinh</h2>
          <p className="text-sm text-faint">
            Danh sách thí sinh dự thi + mã cá nhân (8 ký tự). Mỗi mã = 1 attempt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowImport((s) => !s)}
            disabled={busy !== null}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Import CSV
          </button>
          <button
            onClick={exportCsv}
            disabled={!rows || rows.length === 0}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            onClick={addOne}
            disabled={busy !== null}
            className="rounded border border-default bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            + Thêm thí sinh
          </button>
          <button
            onClick={onOpenSendPreview}
            disabled={busy !== null || !rows || rows.length === 0}
            className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === "preview" ? "..." : <><Mail className="mr-1 inline h-3.5 w-3.5 align-text-bottom" /> Gửi mã qua email</>}
          </button>
        </div>
      </div>

      {showImport && <ImportCsv examId={examId} onDone={refresh} setErr={setErr} setBusy={setBusy} />}

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}
      {flash && <div className="mt-3 text-xs text-emerald-700">{flash}</div>}

      {/* Filter + bulk-assign toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-default pb-3 text-sm">
        <label className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-faint">Lọc theo phòng:</span>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value as typeof roomFilter)}
            className="rounded border border-default bg-white px-2 py-1 text-xs"
          >
            <option value="all">Tất cả</option>
            <option value="unassigned">Chưa gán phòng</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-faint">
              Đã chọn {selectedIds.size}
            </span>
            <label className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-faint">Gán vào:</span>
              <select
                disabled={busy !== null || rooms.length === 0}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  if (v === "__unassign__") assignSelectedToRoom(null);
                  else assignSelectedToRoom(v);
                  e.currentTarget.selectedIndex = 0;
                }}
                className="rounded border border-default bg-white px-2 py-1 text-xs"
                defaultValue=""
              >
                <option value="" disabled>
                  Chọn phòng…
                </option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                <option value="__unassign__">— Bỏ gán phòng —</option>
              </select>
            </label>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-blue-700 hover:underline"
            >
              Bỏ chọn
            </button>
          </>
        )}
        {rooms.length === 0 && (
          <span className="text-xs text-faint">
            (Chưa có phòng nào — tạo phòng ở tab “Phòng thi”.)
          </span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-default text-left text-xs uppercase text-faint">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả thí sinh hiển thị"
                  checked={
                    filteredRows.length > 0 &&
                    filteredRows.every((r) => selectedIds.has(r.id))
                  }
                  onChange={(e) => {
                    const next = new Set(selectedIds);
                    if (e.target.checked) {
                      for (const r of filteredRows) next.add(r.id);
                    } else {
                      for (const r of filteredRows) next.delete(r.id);
                    }
                    setSelectedIds(next);
                  }}
                />
              </th>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Mã SV / Lớp</th>
              <th className="px-3 py-2">Phòng</th>
              <th className="px-3 py-2 text-center">Attempt</th>
              <th className="px-3 py-2 text-center">Mail</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-faint">Đang tải...</td></tr>
            )}
            {rows && filteredRows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-faint">
                {rows.length === 0
                  ? "Chưa có thí sinh nào."
                  : "Không có thí sinh nào khớp bộ lọc."}
              </td></tr>
            )}
            {filteredRows.map((r) => {
              const m = (r.metadata ?? {}) as Record<string, string | undefined>;
              return (
                <tr
                  key={r.id}
                  data-testid={`candidate-row-${r.id}`}
                  className={`border-b border-default ${r.disabledAt ? "opacity-50" : ""} ${selectedIds.has(r.id) ? "bg-blue-50/40" : ""}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${r.displayName}`}
                      checked={selectedIds.has(r.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">{r.displayName}</td>
                  <td className="px-3 py-2 font-mono text-xs tracking-wider">
                    {r.accessCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{m.email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-faint">
                    {[m.studentCode, m.class].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.roomName ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">
                        {r.roomName}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.attemptCount > 0 ? (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                        {r.attemptCount}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">
                    {r.emailSentAt ? "✓" : <span className="text-faint">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={`/api/candidates/${r.id}/export`}
                      download
                      title="Tải xuống dữ liệu cá nhân (GDPR Điều 12)"
                      className="rounded border border-default bg-white px-2 py-0.5 text-xs hover:bg-slate-50"
                    >
                      Export
                    </a>
                    <button
                      onClick={() => onToggleDisable(r)}
                      className="ml-1 rounded border border-default bg-white px-2 py-0.5 text-xs hover:bg-slate-50"
                    >
                      {r.disabledAt ? "Bật" : "Tắt"}
                    </button>
                    <button
                      onClick={() => onDelete(r.id)}
                      disabled={r.attemptCount > 0}
                      title={r.attemptCount > 0 ? "Đã có lượt thi — chỉ xoá khi chưa thi" : "Xoá thí sinh"}
                      className="ml-1 rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Xoá
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {emailPreview && (
        <EmailPreviewModal
          data={emailPreview}
          busy={busy === "send"}
          onCancel={() => setEmailPreview(null)}
          onConfirm={onConfirmSend}
        />
      )}
    </section>
  );
}

function EmailPreviewModal({
  data,
  busy,
  onCancel,
  onConfirm,
}: {
  data: {
    recipients: number;
    skipped: number;
    preview: {
      candidate: { displayName: string; email: string; accessCode: string };
      subject: string;
      html: string;
      text: string;
    } | null;
  };
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!data.preview) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-default px-5 py-3">
          <div>
            <h3
              id="email-preview-title"
              className="text-base font-semibold"
            >
              Xem trước email gửi mã
            </h3>
            <p className="mt-0.5 text-xs text-faint">
              Mẫu lấy từ thí sinh{" "}
              <strong>{data.preview.candidate.displayName}</strong> (
              {data.preview.candidate.email}). Mỗi thí sinh nhận email riêng
              với mã + tên của mình.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="grid gap-3 border-b border-default bg-slate-50 px-5 py-3 text-sm sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-faint">
              Sẽ gửi
            </div>
            <div className="mt-0.5 text-lg font-semibold text-slate-900">
              {data.recipients}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-faint">
              Bỏ qua (thiếu email)
            </div>
            <div className="mt-0.5 text-lg font-semibold text-amber-700">
              {data.skipped}
            </div>
          </div>
          <div className="sm:col-span-1">
            <div className="text-xs uppercase tracking-wide text-faint">
              Tiêu đề
            </div>
            <div className="mt-0.5 break-words text-xs text-slate-700">
              {data.preview.subject}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-5">
          <iframe
            title="Email preview"
            srcDoc={data.preview.html}
            sandbox=""
            className="h-[55vh] w-full rounded border border-default bg-white"
          />
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-default px-5 py-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded border border-default bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Đang gửi..." : `Gửi cho ${data.recipients} thí sinh`}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ImportCsv({
  examId,
  onDone,
  setErr,
  setBusy,
}: {
  examId: string;
  onDone: () => Promise<void>;
  setErr: (s: string | null) => void;
  setBusy: (s: string | null) => void;
}) {
  const [text, setText] = useState("");
  const onImport = async () => {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      setErr("CSV trống hoặc sai định dạng. Header phải có ít nhất `displayName`.");
      return;
    }
    setBusy("import");
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bulk: rows }),
      });
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { created: number; failed: { row: number; error: string }[] };
      setText("");
      await onDone();
      setErr(
        j.failed.length > 0
          ? `Đã tạo ${j.created}, lỗi ${j.failed.length} dòng`
          : null,
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-4 rounded border border-default bg-slate-50 p-3">
      <p className="text-xs text-faint">
        Dán CSV. Header: <code>displayName,email,studentCode,class</code>. Ví dụ:
      </p>
      <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-[11px] text-slate-700">
{`displayName,email,studentCode,class
Nguyễn Văn A,a@example.com,K65-001,K65-DSAI
Trần Thị B,b@example.com,K65-002,K65-DSAI`}
      </pre>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Dán CSV vào đây..."
        className="mt-2 w-full rounded border border-default px-3 py-2 font-mono text-xs"
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={onImport}
          disabled={!text.trim()}
          className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Import
        </button>
      </div>
    </div>
  );
}

function parseCsv(raw: string): { displayName: string; metadata?: Record<string, string> }[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const head = lines[0]!.split(",").map((s) => s.trim());
  const idxName = head.indexOf("displayName");
  if (idxName < 0) return [];
  const idxEmail = head.indexOf("email");
  const idxStudent = head.indexOf("studentCode");
  const idxClass = head.indexOf("class");
  const rows: { displayName: string; metadata?: Record<string, string> }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(",").map((s) => s.trim());
    const name = cells[idxName];
    if (!name) continue;
    const meta: Record<string, string> = {};
    if (idxEmail >= 0 && cells[idxEmail]) meta.email = cells[idxEmail]!;
    if (idxStudent >= 0 && cells[idxStudent]) meta.studentCode = cells[idxStudent]!;
    if (idxClass >= 0 && cells[idxClass]) meta.class = cells[idxClass]!;
    rows.push({ displayName: name, metadata: Object.keys(meta).length > 0 ? meta : undefined });
  }
  return rows;
}

function csv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

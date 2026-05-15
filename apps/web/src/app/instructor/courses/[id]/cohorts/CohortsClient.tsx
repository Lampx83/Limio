"use client";

import { useEffect, useState } from "react";

type Cohort = {
  id: string;
  name: string;
  code: string | null;
  instructorId: string | null;
  instructorName: string | null;
  description: string | null;
  memberCount: number;
  scheduleCount: number;
  createdAt: string;
};

type Member = { userId: string; displayName: string; email: string; joinedAt: string };

type InstructorOption = { id: string; displayName: string; email: string };

export default function CohortsClient({
  courseId,
  initial,
  instructorOptions,
}: {
  courseId: string;
  initial: Cohort[];
  instructorOptions: InstructorOption[];
}) {
  const [cohorts, setCohorts] = useState(initial);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [instructorId, setInstructorId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch(`/api/courses/${courseId}/cohorts`);
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as { cohorts: Cohort[] };
    setCohorts(j.cohorts);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/courses/${courseId}/cohorts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          instructorId: instructorId || undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setName("");
      setCode("");
      setInstructorId("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (
    id: string,
    patch: { name?: string; code?: string | null; instructorId?: string | null },
  ) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/cohorts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return false;
      }
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm("Xoá cohort này? Mọi member sẽ bị remove.")) return;
    const r = await fetch(`/api/cohorts/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    if (openId === id) setOpenId(null);
    await refresh();
  };

  return (
    <div className="mt-6">
      <form
        onSubmit={onCreate}
        className="grid grid-cols-1 gap-3 rounded border border-default bg-white p-4 md:grid-cols-4"
      >
        <label className="md:col-span-2">
          <span className="block text-xs font-medium text-slate-600">
            Tên lớp <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Vd: K65A-DSAI-2025-2"
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">
            Mã lớp (trường định nghĩa)
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={16}
            placeholder="K65A-T7C"
            className="mt-1 w-full rounded border border-default px-3 py-2 font-mono text-sm uppercase"
          />
          <span className="mt-0.5 block text-xs text-faint">
            SV gõ mã này ở form open-mode
          </span>
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">GV phụ trách</span>
          <select
            value={instructorId}
            onChange={(e) => setInstructorId(e.target.value)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          >
            <option value="">— Chưa gán —</option>
            {instructorOptions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-4 flex justify-end">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "..." : "+ Tạo lớp"}
          </button>
        </div>
      </form>

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      {cohorts.length === 0 && (
        <div className="mt-6 rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Chưa có cohort nào.
        </div>
      )}

      <ul data-testid="cohort-list" className="mt-4 space-y-2">
        {cohorts.map((c) => (
          <li
            key={c.id}
            data-testid={`cohort-row-${c.id}`}
            className="rounded border border-default bg-white"
          >
            {editId === c.id ? (
              <EditRow
                cohort={c}
                instructorOptions={instructorOptions}
                busy={busy}
                onCancel={() => setEditId(null)}
                onSave={async (patch) => {
                  const ok = await onSaveEdit(c.id, patch);
                  if (ok) setEditId(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{c.name}</span>
                    {c.code && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs text-blue-700">
                        {c.code}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-faint">
                    {c.instructorName ? (
                      <>👤 {c.instructorName}</>
                    ) : (
                      <span className="text-amber-700">⚠ Chưa gán GV</span>
                    )}
                    <span className="mx-1.5">·</span>
                    {c.memberCount} thành viên · {c.scheduleCount} ca thi
                  </div>
                </div>
                <button
                  onClick={() => setEditId(c.id)}
                  className="rounded border border-default bg-white px-3 py-1 text-xs hover:bg-slate-50"
                >
                  Sửa
                </button>
                <button
                  onClick={() => setOpenId(openId === c.id ? null : c.id)}
                  className="rounded border border-default bg-white px-3 py-1 text-xs hover:bg-slate-50"
                >
                  {openId === c.id ? "Đóng" : "Members"}
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-800 hover:bg-red-100"
                >
                  Xoá
                </button>
              </div>
            )}
            {openId === c.id && <MemberPanel cohortId={c.id} onChange={refresh} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditRow({
  cohort,
  instructorOptions,
  busy,
  onSave,
  onCancel,
}: {
  cohort: Cohort;
  instructorOptions: InstructorOption[];
  busy: boolean;
  onSave: (patch: {
    name: string;
    code: string | null;
    instructorId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(cohort.name);
  const [code, setCode] = useState(cohort.code ?? "");
  const [instructorId, setInstructorId] = useState(cohort.instructorId ?? "");
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-default p-3 md:grid-cols-4">
      <label className="md:col-span-2">
        <span className="block text-xs font-medium text-slate-600">Tên lớp</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-slate-600">Mã lớp</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={16}
          className="mt-1 w-full rounded border border-default px-3 py-2 font-mono text-sm uppercase"
        />
      </label>
      <label>
        <span className="block text-xs font-medium text-slate-600">GV phụ trách</span>
        <select
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        >
          <option value="">— Chưa gán —</option>
          {instructorOptions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end justify-end gap-2 md:col-span-4">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          Huỷ
        </button>
        <button
          onClick={() =>
            onSave({
              name: name.trim(),
              code: code.trim() ? code.trim() : null,
              instructorId: instructorId || null,
            })
          }
          disabled={busy || !name.trim()}
          className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}

function MemberPanel({ cohortId, onChange }: { cohortId: string; onChange: () => Promise<void> }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch(`/api/cohorts/${cohortId}/members`);
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as { members: Member[] };
    setMembers(j.members);
  };

  useEffect(() => {
    refresh();
  }, [cohortId]);

  const onAdd = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setErr(null);
    setReport(null);
    try {
      const inputs = input.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
      const r = await fetch(`/api/cohorts/${cohortId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ add: inputs }),
      });
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as {
        added: number;
        skipped: { input: string; reason: string }[];
      };
      setReport(`Thêm ${j.added}${j.skipped.length > 0 ? ` · skip ${j.skipped.length}: ` + j.skipped.map((s) => `${s.input}(${s.reason})`).join(", ") : ""}`);
      setInput("");
      await refresh();
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (userId: string) => {
    const r = await fetch(`/api/cohorts/${cohortId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ removeUserId: userId }),
    });
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    await refresh();
    await onChange();
  };

  return (
    <div className="border-t border-default bg-slate-50 p-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Email hoặc userId (cách nhau bằng dấu phẩy/khoảng trắng)"
          className="flex-1 rounded border border-default bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={onAdd}
          disabled={busy || !input.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "..." : "Thêm"}
        </button>
      </div>
      {report && <div className="mt-2 text-xs text-slate-700">{report}</div>}
      {err && (
        <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-800">⚠ {err}</div>
      )}
      <ul className="mt-3 space-y-1">
        {members === null && <li className="text-xs text-faint">Đang tải...</li>}
        {members && members.length === 0 && (
          <li className="text-xs text-faint">Chưa có thành viên.</li>
        )}
        {members?.map((m) => (
          <li
            key={m.userId}
            className="flex items-center gap-2 rounded border border-default bg-white px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <span className="font-medium">{m.displayName}</span>
              <span className="ml-2 text-xs text-faint">{m.email}</span>
            </div>
            <button
              onClick={() => onRemove(m.userId)}
              className="rounded border border-default bg-white px-2 py-0.5 text-xs hover:bg-slate-50"
            >
              Xoá
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

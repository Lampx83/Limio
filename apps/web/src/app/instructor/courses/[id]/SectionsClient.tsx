"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";
import { ShareCard } from "@/components/ui";

type Section = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string | null;
  isDefault: boolean;
  enrolledCount: number;
  createdAt: string;
};

export default function SectionsClient({ courseId }: { courseId: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch(apiUrl(`/api/courses/${courseId}/sections`));
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as { sections: Section[] };
    setSections(j.sections);
  };

  useEffect(() => {
    refresh().finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/sections`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      setName("");
      setDescription("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (id: string, patch: { name: string; description: string | null }) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/sections/${id}`), {
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
    if (!window.confirm("Xoá lớp học này? Chỉ xoá được khi chưa có học viên nào.")) return;
    const r = await fetch(apiUrl(`/api/sections/${id}`), { method: "DELETE" });
    if (!r.ok) {
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      setErr(
        j?.error === "section_has_enrollments"
          ? "Không xoá được — lớp còn học viên."
          : (j?.error ?? `HTTP ${r.status}`),
      );
      return;
    }
    await refresh();
  };

  const onRegenerate = async (id: string) => {
    if (!window.confirm("Tạo lại link mời? Link cũ sẽ hết hiệu lực ngay lập tức.")) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/sections/${id}/regenerate-invite`), { method: "POST" });
      if (!r.ok) {
        setErr(`HTTP ${r.status}`);
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <form
        onSubmit={onCreate}
        className="grid grid-cols-1 gap-3 rounded border border-default bg-white p-4 md:grid-cols-3"
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
            placeholder="Vd: Lớp K65-CS1"
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">Mô tả (tuỳ chọn)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Vd: Lớp thứ 7 chiều"
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
          />
        </label>
        <div className="md:col-span-3 flex justify-end">
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

      {!loaded && (
        <div className="mt-4 text-sm text-faint">Đang tải...</div>
      )}

      {loaded && sections.length === 0 && (
        <div className="mt-6 rounded border border-dashed border-default p-6 text-center text-sm text-faint">
          Chưa có lớp học nào. Tạo lớp để lấy link mời học viên tự đăng ký.
        </div>
      )}

      <ul data-testid="section-list" className="mt-4 space-y-2">
        {sections.map((s) => (
          <li
            key={s.id}
            data-testid={`section-row-${s.id}`}
            className="rounded border border-default bg-white"
          >
            {editId === s.id ? (
              <EditRow
                section={s}
                busy={busy}
                onCancel={() => setEditId(null)}
                onSave={async (patch) => {
                  const ok = await onSaveEdit(s.id, patch);
                  if (ok) setEditId(null);
                }}
              />
            ) : (
              <div className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/instructor/courses/${courseId}/sections/${s.id}`}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <span className="text-sm font-semibold">{s.name}</span>
                    {s.description && (
                      <span className="ml-2 text-xs text-faint">{s.description}</span>
                    )}
                    <div className="mt-0.5 text-xs text-blue-600 underline decoration-dotted">
                      {s.enrolledCount} học viên
                    </div>
                  </Link>
                  <button
                    onClick={() => setEditId(s.id)}
                    className="rounded border border-default bg-white px-3 py-1 text-xs hover:bg-slate-50"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => onRegenerate(s.id)}
                    disabled={busy}
                    className="rounded border border-default bg-white px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                  >
                    ↻ Tạo lại mã
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    className="rounded border border-red-300 bg-red-50 px-3 py-1 text-xs text-red-800 hover:bg-red-100"
                  >
                    Xoá
                  </button>
                </div>
                {s.inviteCode && (
                  <div className="mt-2">
                    <ShareCard
                      path={`/enroll/${s.inviteCode}`}
                      label="Link mời vào lớp"
                      hint="Ai có link này cũng vào được lớp — bấm “Tạo lại mã” là link cũ mất hiệu lực ngay."
                      fileName={`lop-${s.inviteCode}`}
                    />
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditRow({
  section,
  busy,
  onSave,
  onCancel,
}: {
  section: Section;
  busy: boolean;
  onSave: (patch: { name: string; description: string | null }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? "");
  return (
    <div className="grid grid-cols-1 gap-3 border-b border-default p-3 md:grid-cols-3">
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
        <span className="block text-xs font-medium text-slate-600">Mô tả</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        />
      </label>
      <div className="flex items-end justify-end gap-2 md:col-span-3">
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-default bg-white px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
        >
          Huỷ
        </button>
        <button
          onClick={() =>
            onSave({ name: name.trim(), description: description.trim() ? description.trim() : null })
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

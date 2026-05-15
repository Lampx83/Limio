"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

export default function CreateRoundButton({
  courses,
}: {
  courses: CourseOption[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        + Tạo đợt thi
      </button>
      {open && (
        <CreateRoundDialog
          courses={courses}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreateRoundDialog({
  courses,
  onClose,
}: {
  courses: CourseOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? "");
  const [opensAt, setOpensAt] = useState(toLocalInput(addDays(new Date(), 7)));
  const [closesAt, setClosesAt] = useState(toLocalInput(addDays(new Date(), 14)));

  const submit = async () => {
    setErr(null);
    if (!code.trim()) return setErr("Mã đợt không được trống.");
    if (!title.trim()) return setErr("Tên đợt không được trống.");
    if (!courseId) return setErr("Chọn 1 khoá học.");
    if (new Date(opensAt) >= new Date(closesAt))
      return setErr("Thời gian mở phải trước thời gian đóng.");

    setBusy(true);
    try {
      const r = await fetch("/api/exam-rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim() || null,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
          courseId,
        }),
      });
      const j = (await r.json().catch(() => null)) as {
        id?: string;
        error?: string;
      } | null;
      if (!r.ok) {
        const errCode = j?.error;
        if (errCode === "round_code_taken")
          setErr("Mã đợt đã được dùng. Đổi mã khác.");
        else if (errCode === "forbidden")
          setErr("Bạn không có quyền tạo đợt cho khoá học đã chọn.");
        else if (errCode === "validation_failed")
          setErr("Dữ liệu không hợp lệ.");
        else setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      if (j?.id) router.push(`/instructor/exam-rounds/${j.id}?tab=sessions`);
      else router.refresh();
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
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-y-auto rounded-lg bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-default px-5 py-3">
          <h3 className="text-base font-semibold">Tạo đợt thi mới</h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="rounded p-1 text-faint hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">
                Mã đợt <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={60}
                placeholder="GIUA-KY-HK1-2026"
                className="mt-1 w-full rounded border border-default px-3 py-2 font-mono text-sm uppercase focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">
                Tên đợt <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                placeholder="Đợt thi giữa kỳ HK1 2025-2026"
                className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Mô tả</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Ghi chú nội bộ (tuỳ chọn)"
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-slate-600">
              Khoá học <span className="text-red-600">*</span>
            </span>
            {courses.length === 0 ? (
              <div className="mt-1 rounded border border-default px-3 py-2 text-xs text-faint">
                Chưa có khoá học nào bạn quản lý.
              </div>
            ) : (
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">
                Mở từ <span className="text-red-600">*</span>
              </span>
              <input
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600">
                Đóng lúc <span className="text-red-600">*</span>
              </span>
              <input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          <p className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            ℹ️ Sau khi tạo đợt thi, vào tab &quot;Ca thi&quot; để thêm từng ca
            với mã + giờ, rồi tab &quot;Phòng thi&quot; để import danh sách
            phòng từ Excel.
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
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Đang tạo..." : "Tạo đợt thi"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, FileQuestion, Trash2 } from "lucide-react";

type Bank = {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "course" | "org";
  courseId: string | null;
  courseTitle: string | null;
  isOwner: boolean;
  questionCount: number;
  updatedAt: string;
};

type Course = { id: string; title: string };

// Màu chỉ báo phạm vi chia sẻ (thanh cạnh trái + chấm nhỏ); phần còn lại trung tính.
const VIS_META: Record<Bank["visibility"], { label: string; rail: string; dot: string }> = {
  private: { label: "Riêng tư", rail: "bg-slate-300", dot: "bg-slate-400" },
  course: { label: "Theo khoá", rail: "bg-brand-500", dot: "bg-brand-500" },
  org: { label: "Tổ chức", rail: "bg-sky-500", dot: "bg-sky-500" },
};

export default function BankListClient({
  initialBanks,
  availableCourses,
}: {
  initialBanks: Bank[];
  availableCourses: Course[];
}) {
  const router = useRouter();
  const [banks, setBanks] = useState(initialBanks);
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/question-banks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          courseId: courseId || undefined,
          visibility: courseId ? "course" : "private",
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { id: string };
      router.push(`/instructor/question-banks/${j.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ngân hàng câu hỏi</h1>
          <p className="mt-1 text-sm text-faint">
            {banks.length} bank · câu hỏi tái sử dụng cross-exam
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Đóng" : "+ Tạo ngân hàng mới"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onCreate}
          className="mt-3 rounded-lg border border-default bg-white p-4 shadow-sm"
        >
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Tên ngân hàng</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder="Vd: Toán cơ bản lớp 10"
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            />
          </label>
          <label className="mt-3 block">
            <span className="block text-xs font-medium text-slate-600">
              Phạm vi
            </span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
            >
              <option value="">Riêng tư (chỉ mình bạn)</option>
              {availableCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  Khoá: {c.title} (chia sẻ co-instructors)
                </option>
              ))}
            </select>
          </label>
          {err && (
            <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              ⚠ {err}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? "..." : "Tạo"}
            </button>
          </div>
        </form>
      )}

      {banks.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint">
          Chưa có ngân hàng câu hỏi nào. Bấm &ldquo;+ Tạo ngân hàng mới&rdquo; để bắt đầu.
        </div>
      )}

      {banks.length > 0 && (
        <ul data-testid="bank-list" className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {banks.map((b) => {
            const vis = VIS_META[b.visibility];
            return (
              <li
                key={b.id}
                className="group relative overflow-hidden rounded-xl border border-default bg-white shadow-sm transition hover:shadow-md"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${vis.rail}`} aria-hidden />
                <Link
                  href={`/instructor/question-banks/${b.id}`}
                  className="block p-4 pl-5 pr-12"
                  prefetch={false}
                >
                  <h2 className="break-words text-base font-semibold leading-snug text-slate-900 transition group-hover:text-brand-700">
                    {b.name}
                  </h2>
                  {b.courseTitle ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{b.courseTitle}</span>
                    </p>
                  ) : null}
                  {b.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{b.description}</p>
                  )}
                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <FileQuestion className="h-3.5 w-3.5" aria-hidden />
                      <b className="font-semibold text-slate-700">{b.questionCount}</b> câu hỏi
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${vis.dot}`} aria-hidden />
                      {vis.label}
                    </span>
                    {!b.isOwner && (
                      <span className="font-medium text-amber-700">Chia sẻ</span>
                    )}
                  </p>
                </Link>
                {/* Delete button — only owner sees it. Positioned absolute to
                    avoid being part of the <Link> click area. */}
                {b.isOwner && (
                  <DeleteBankButton
                    bankId={b.id}
                    bankName={b.name}
                    onDeleted={() =>
                      setBanks((curr) => curr.filter((x) => x.id !== b.id))
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DeleteBankButton({
  bankId,
  bankName,
  onDeleted,
}: {
  bankId: string;
  bankName: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (
      !confirm(
        `Xoá ngân hàng "${bankName}"?\n\nMọi câu hỏi + version + skill tag + stats trong ngân hàng sẽ bị xoá theo. Không thể khôi phục.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      // First try without force — server tells us if any question has been
      // copied into an exam and how many.
      let r = await fetch(`/api/question-banks/${bankId}`, { method: "DELETE" });
      if (r.status === 409) {
        const body = (await r.json().catch(() => null)) as
          | { error?: string; details?: { usedCount?: number } }
          | null;
        const used = body?.details?.usedCount ?? "một số";
        const ok = confirm(
          `Ngân hàng này có ${used} câu hỏi đã được copy vào đề thi. Xoá sẽ mất link giữa đề và ngân hàng (đề vẫn giữ bản sao câu hỏi, chỉ mất khả năng tra về nguồn).\n\nVẫn xoá?`,
        );
        if (!ok) {
          setBusy(false);
          return;
        }
        r = await fetch(`/api/question-banks/${bankId}?force=true`, {
          method: "DELETE",
        });
      }
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        alert(`Xoá thất bại: ${body?.error ?? r.statusText}`);
        setBusy(false);
        return;
      }
      onDeleted();
    } catch {
      alert("Lỗi mạng — thử lại");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-label={`Xoá ${bankName}`}
      title="Xoá ngân hàng"
      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

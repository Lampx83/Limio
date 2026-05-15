"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";

type SessionStatus = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<SessionStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};

interface SessionDetail {
  id: string;
  roundId: string;
  examId: string;
  examTitle: string;
  examAccessMode: string;
  examStatus: string;
  courseId: string;
  courseTitle: string;
  code: string | null;
  title: string | null;
  status: SessionStatus;
  opensAt: string;
  closesAt: string;
  durationOverrideMin: number | null;
  ipAllowlist: string[];
}

export default function SessionOverviewPanel({
  detail,
  canEdit,
}: {
  detail: SessionDetail;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const changeStatus = async (next: SessionStatus) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-sessions/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
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

  const onDelete = async () => {
    if (
      !window.confirm(
        "Xoá ca thi này? Tất cả phòng + thí sinh sẽ bị xoá theo. Không thể hoàn tác.",
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-sessions/${detail.id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      window.location.href = `/instructor/exam-rounds/${detail.roundId}?tab=sessions`;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-default bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">Thông tin ca thi</h2>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Chỉnh sửa
            </button>
          )}
        </div>
        {editing ? (
          <EditForm
            detail={detail}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Mã ca">
              {detail.code ? (
                <span className="font-mono text-xs">{detail.code}</span>
              ) : (
                <span className="text-faint">(Không có)</span>
              )}
            </Field>
            <Field label="Tên ca">
              {detail.title ?? <span className="text-faint">(Chưa đặt)</span>}
            </Field>
            <Field label="Trạng thái">{STATUS_LABEL[detail.status]}</Field>
            <Field label="Thời lượng override">
              {detail.durationOverrideMin
                ? `${detail.durationOverrideMin} phút`
                : "(Theo đề thi)"}
            </Field>
            <Field label="Mở từ">{formatDate(detail.opensAt)}</Field>
            <Field label="Đóng lúc">{formatDate(detail.closesAt)}</Field>
            <Field label="Đề thi" wide>
              <Link
                href={`/instructor/courses/${detail.courseId}/exams/${detail.examId}`}
                className="text-blue-600 hover:underline"
              >
                {detail.examTitle}
              </Link>
              <span className="text-faint"> · {detail.courseTitle}</span>
            </Field>
          </dl>
        )}
      </section>

      {canEdit && (
        <section className="rounded-lg border border-default bg-white p-5">
          <h2 className="text-sm font-semibold">Đổi trạng thái</h2>
          <p className="mt-1 text-xs text-faint">
            Hiện tại: {STATUS_LABEL[detail.status]}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["draft", "open", "closed", "archived"] as SessionStatus[])
              .filter((s) => s !== detail.status)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={busy}
                  className="rounded border border-default px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  → {STATUS_LABEL[s]}
                </button>
              ))}
          </div>
        </section>
      )}

      {canEdit && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-5">
          <h2 className="text-sm font-semibold text-red-800">Vùng nguy hiểm</h2>
          <p className="mt-1 text-xs text-red-700">
            Xoá ca thi sẽ xoá tất cả phòng thi + thí sinh trong ca. Không thể
            hoàn tác.
          </p>
          <button
            onClick={onDelete}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded border border-red-400 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 size={14} /> Xoá ca thi
          </button>
        </section>
      )}

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function EditForm({
  detail,
  onDone,
  onCancel,
}: {
  detail: SessionDetail;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(detail.code ?? "");
  const [title, setTitle] = useState(detail.title ?? "");
  const [opensAt, setOpensAt] = useState(toLocalInput(detail.opensAt));
  const [closesAt, setClosesAt] = useState(toLocalInput(detail.closesAt));
  const [duration, setDuration] = useState(
    detail.durationOverrideMin?.toString() ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (new Date(opensAt) >= new Date(closesAt))
      return setErr("Mở từ phải trước Đóng lúc.");
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-sessions/${detail.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim() || null,
          title: title.trim() || null,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
          durationOverrideMin: duration.trim()
            ? Number.parseInt(duration, 10)
            : null,
        }),
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
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">Mã ca</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={60}
            placeholder="Vd: CA-1-SANG"
            className="mt-1 w-full rounded border border-default px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Tên ca
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Vd: Ca 1 — Sáng 14/5"
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Mở từ
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
            Đóng lúc
          </span>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">
          Thời lượng (phút) — override
        </span>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          min={1}
          max={1440}
          placeholder="Để trống = dùng thời lượng đề thi"
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>
      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
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
      </div>
    </div>
  );
}

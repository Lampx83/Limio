"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Info, Trash2 } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import type { ReadinessItem } from "@/lib/roundReadiness";

type RoundStatus = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};

interface CourseInfo {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
}

interface RoundData {
  id: string;
  code: string;
  title: string;
  description: string | null;
  status: RoundStatus;
  opensAt: string;
  closesAt: string;
  course: CourseInfo;
}

// Trạng thái đợt chỉ để phân loại và lọc danh sách — KHÔNG tự mở/đóng ca thi hay
// chặn ai vào thi (giờ vào thi do từng ca quyết định). Nói rõ điều đó, kẻo giảng
// viên tưởng bấm "Đã đóng" là dừng được kỳ thi.
const STATUS_HELP: Record<RoundStatus, string> = {
  draft: "Đang chuẩn bị, chưa công bố.",
  open: "Đợt đang diễn ra.",
  closed: "Đợt đã kết thúc (để phân loại).",
  archived: "Cất đi khỏi danh sách chính.",
};

const READINESS_ICON = {
  ok: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Đã xong" />,
  todo: <Circle className="h-4 w-4 shrink-0 text-amber-600" aria-label="Cần làm" />,
  info: <Info className="h-4 w-4 shrink-0 text-blue-600" aria-label="Lưu ý" />,
  skipped: <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-label="Chưa tới bước này" />,
} as const;

export default function OverviewPanel({
  round,
  canEdit,
  readiness,
}: {
  round: RoundData;
  canEdit: boolean;
  readiness: ReadinessItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const changeStatus = async (next: RoundStatus) => {
    if (busy) return;
    if (
      (next === "closed" || next === "archived") &&
      !window.confirm(
        `Chuyển đợt sang "${STATUS_LABEL[next]}"?\n\nLưu ý: trạng thái đợt chỉ để phân loại; các ca thi vẫn chạy theo giờ của từng ca. Muốn dừng một ca đang thi, hãy đóng ca đó ở tab Ca thi.`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-rounds/${round.id}`, {
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

  const onDeleteRound = async () => {
    if (
      !window.confirm(
        "Xoá đợt thi này? Không thể hoàn tác. Nếu đợt còn ca thi, sẽ bị từ chối.",
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exam-rounds/${round.id}`, {
        method: "DELETE",
      });
      const j = (await r.json().catch(() => null)) as {
        error?: string;
        details?: { reason?: string };
      } | null;
      if (!r.ok) {
        if (j?.details?.reason === "round_has_sessions")
          setErr("Đợt thi còn ca thi — xoá hết ca trước.");
        else setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      window.location.href = "/instructor/exam-rounds";
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-default bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold">Thông tin chung</h2>
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
          <EditMetaForm
            round={round}
            onDone={() => {
              setEditing(false);
              router.refresh();
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <Field label="Mã đợt">
              <span className="font-mono text-xs">{round.code}</span>
            </Field>
            <Field label="Trạng thái">{STATUS_LABEL[round.status]}</Field>
            <Field label="Khoá học">{round.course.courseTitle}</Field>
            <Field label="Mở từ">{formatDate(round.opensAt)}</Field>
            <Field label="Đóng lúc">{formatDate(round.closesAt)}</Field>
            <Field label="Mô tả" wide>
              <span className="whitespace-pre-wrap">
                {round.description || (
                  <span className="text-faint">(Không có)</span>
                )}
              </span>
            </Field>
          </dl>
        )}
      </section>

      <section
        className="rounded-lg border border-default bg-white p-5"
        data-testid="round-readiness"
      >
        <h2 className="text-sm font-semibold">Sẵn sàng thi chưa?</h2>
        <ul className="mt-3 space-y-2">
          {readiness.map((item) => (
            <li key={item.key} className="flex gap-2 text-sm">
              <span className="mt-0.5">{READINESS_ICON[item.status]}</span>
              <div className="min-w-0">
                <span className={item.status === "skipped" ? "text-faint" : ""}>
                  {item.label}
                </span>
                {item.problems && item.problems.length > 0 && item.status !== "ok" && (
                  <ul className="mt-0.5 list-inside list-disc text-xs text-slate-600">
                    {item.problems.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
                {item.tab && (item.status === "todo" || item.status === "info") && (
                  <Link
                    href={`/instructor/exam-rounds/${round.id}?tab=${item.tab}`}
                    className="mt-0.5 inline-block text-xs font-medium text-blue-600 hover:underline"
                  >
                    Xử lý →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canEdit && (
        <section className="rounded-lg border border-default bg-white p-5">
          <h2 className="text-sm font-semibold">Đổi trạng thái</h2>
          <p className="mt-1 text-xs text-faint">
            Hiện tại: {STATUS_LABEL[round.status]} — {STATUS_HELP[round.status]} Trạng thái chỉ để
            phân loại, không tự mở hay đóng ca thi.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["draft", "open", "closed", "archived"] as RoundStatus[])
              .filter((s) => s !== round.status)
              .map((s) => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={busy}
                  title={STATUS_HELP[s]}
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
          <h2 className="text-sm font-semibold text-red-800">
            Vùng nguy hiểm
          </h2>
          <p className="mt-1 text-xs text-red-700">
            Xoá đợt thi sẽ gỡ luôn cả trưởng đợt. Chỉ xoá được khi không còn ca thi.
          </p>
          <button
            onClick={onDeleteRound}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded border border-red-400 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 size={14} /> Xoá đợt thi
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
  return formatDateTime(iso);
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

function EditMetaForm({
  round,
  onDone,
  onCancel,
}: {
  round: RoundData;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(round.title);
  const [description, setDescription] = useState(round.description ?? "");
  const [opensAt, setOpensAt] = useState(toLocalInput(round.opensAt));
  const [closesAt, setClosesAt] = useState(toLocalInput(round.closesAt));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!title.trim()) return setErr("Tên đợt không được trống.");
    if (new Date(opensAt) >= new Date(closesAt))
      return setErr("Mở từ phải trước Đóng lúc.");
    setBusy(true);
    try {
      const r = await fetch(`/api/exam-rounds/${round.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
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
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">
          Tên đợt
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Mô tả</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={2}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </label>
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
          className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}

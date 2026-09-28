"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";
import { EmptyState, ShareCard, StatusBadge, type StatusTone } from "@/components/ui";
import { ChevronRight, MoreVertical, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import ImportStudentsButton from "./ImportStudentsButton";

type FeedbackVariant = "personalized" | "minimal";

// B10 — nhãn cho điều kiện feedback. Viết bằng thứ giảng viên đọc là hiểu ngay
// mình đang cho lớp nào nhận gì, chứ không phải tên biến trong schema.
const VARIANTS: Record<
  FeedbackVariant,
  { label: string; short: string; desc: string; tone: StatusTone }
> = {
  personalized: {
    label: "Cá nhân hoá",
    short: "Cá nhân hoá",
    desc: "Phản hồi gọi tên lỗi sai cụ thể, kèm bài ôn gợi ý và đề xuất bài học tiếp theo.",
    tone: "success",
  },
  minimal: {
    label: "Rút gọn (đối chứng)",
    short: "Rút gọn",
    desc: "Chỉ phản hồi chung. Vẫn thấy điểm và đáp án đúng, nhưng không gọi tên lỗi sai, không gợi ý bài ôn, không đề xuất bài kế tiếp.",
    tone: "warning",
  },
};

type Section = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string | null;
  isDefault: boolean;
  feedbackVariant: FeedbackVariant;
  enrolledCount: number;
  createdAt: string;
};

export default function SectionsClient({
  courseId,
  showResearch = false,
}: {
  courseId: string;
  showResearch?: boolean;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [unassigned, setUnassigned] = useState(0);
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
    const j = (await r.json()) as { sections: Section[]; unassigned?: number };
    setSections(j.sections);
    setUnassigned(j.unassigned ?? 0);
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

  const onSaveEdit = async (
    id: string,
    patch: { name: string; description: string | null; feedbackVariant?: FeedbackVariant },
  ) => {
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
      {/*
        Lớp mặc định bị ẩn khỏi danh sách bên dưới có chủ ý — nó không phải một
        lớp thật. Nhưng người rơi vào đó thì phải nhìn thấy được: họ ghi danh
        qua link giới thiệu khoá chứ không qua link lớp, và nếu không hiện ra ở
        đây thì họ lặng lẽ đứng ngoài mọi lớp suốt kỳ.
      */}
      {unassigned > 0 && (
        <div className="banner-info mb-4 block rounded-xl px-4 py-3 text-sm">
          <p className="font-medium">
            {unassigned} học viên chưa được xếp lớp
          </p>
          <p className="mt-0.5 text-xs">
            Họ ghi danh bằng link giới thiệu khoá học thay vì link lớp. Mở một lớp
            bất kỳ bên dưới rồi dùng nút chuyển lớp để xếp họ vào — hoặc gửi lại
            link lớp cho họ tự chuyển.
          </p>
        </div>
      )}

      <form
        onSubmit={onCreate}
        className="card grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <label className="md:col-span-2">
          <span className="label">
            Tên lớp <span className="text-danger-600">*</span>
          </span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            placeholder="Vd: Lớp K65-CS1"
            className="input mt-1"
          />
        </label>
        <label>
          <span className="label">Mô tả (tuỳ chọn)</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="Vd: Lớp thứ 7 chiều"
            className="input mt-1"
          />
        </label>
        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="btn-primary"
          >
            {busy ? "..." : (<><Plus className="h-4 w-4" aria-hidden />Tạo lớp</>)}
          </button>
        </div>
      </form>

      {err && (
        <div className="mt-3 rounded-lg border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          ⚠ {err}
        </div>
      )}

      {!loaded && (
        <div className="mt-4 text-meta">Đang tải...</div>
      )}

      {loaded && sections.length === 0 && (
        <EmptyState
          className="mt-6"
          icon="🏫"
          title="Chưa có lớp học nào"
          description="Tạo lớp để lấy link mời học viên tự đăng ký."
        />
      )}

      <ul data-testid="section-list" className="mt-5 space-y-4">
        {sections.map((s) => (
          <li
            key={s.id}
            data-testid={`section-row-${s.id}`}
            className="card overflow-hidden !p-0"
          >
            {editId === s.id ? (
              <EditRow
                section={s}
                busy={busy}
                showResearch={showResearch}
                onCancel={() => setEditId(null)}
                onSave={async (patch) => {
                  const ok = await onSaveEdit(s.id, patch);
                  if (ok) setEditId(null);
                }}
              />
            ) : (
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-3">
                  <Link
                    href={`/instructor/courses/${courseId}/sections/${s.id}`}
                    className="group min-w-0"
                    prefetch={false}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-h4">{s.name}</span>
                      {showResearch && (
                        <span title={VARIANTS[s.feedbackVariant].desc} className="shrink-0">
                          <StatusBadge tone={VARIANTS[s.feedbackVariant].tone} dot={false}>
                            {VARIANTS[s.feedbackVariant].short}
                          </StatusBadge>
                        </span>
                      )}
                    </div>
                    {s.description && (
                      <p className="text-meta mt-0.5">{s.description}</p>
                    )}
                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-brand-100 py-1 pl-3 pr-2 text-brand-800 transition-colors group-hover:bg-brand-200">
                      <Users className="h-4 w-4" aria-hidden />
                      <span className="text-base font-bold leading-none">{s.enrolledCount}</span>
                      <span className="text-sm font-medium">học viên</span>
                      <span className="ml-1 inline-flex items-center gap-0.5 border-l border-brand-800/20 pl-2 text-sm font-semibold underline-offset-2 group-hover:underline">
                        Xem danh sách
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </span>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ImportStudentsButton
                      courseId={courseId}
                      sectionId={s.id}
                      sectionName={s.name}
                      onImported={refresh}
                    />
                    <SectionActionsMenu
                      sectionName={s.name}
                      busy={busy}
                      onEdit={() => setEditId(s.id)}
                      onRegenerate={() => onRegenerate(s.id)}
                      onDelete={() => onDelete(s.id)}
                    />
                  </div>
                </div>
                {s.inviteCode && (
                  <div className="mt-4">
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

// Sửa/Tạo lại mã/Xoá đều là hành động hiếm khi dùng so với Nhập học viên —
// gom lại sau nút "..." để hàng tiêu đề của thẻ lớp đỡ dày đặc nút bấm.
// Cùng pattern với LessonActionMenu.tsx.
function SectionActionsMenu({
  sectionName,
  busy,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  sectionName: string;
  busy: boolean;
  onEdit: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-[rgb(var(--surface-muted))] hover:text-default disabled:opacity-50"
        title="Thêm hành động cho lớp"
        aria-label={`Thêm hành động cho lớp ${sectionName}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-token bg-[rgb(var(--surface))] py-1 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-30 sm:mt-1 sm:w-56"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
          >
            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
            Sửa lớp
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRegenerate();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))]"
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
            Tạo lại mã mời
          </button>
          <div role="separator" className="my-1 border-t border-token" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            Xoá lớp
          </button>
        </div>
      )}
    </div>
  );
}

function EditRow({
  section,
  busy,
  showResearch,
  onSave,
  onCancel,
}: {
  section: Section;
  busy: boolean;
  showResearch: boolean;
  onSave: (patch: {
    name: string;
    description: string | null;
    feedbackVariant?: FeedbackVariant;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? "");
  const [variant, setVariant] = useState<FeedbackVariant>(section.feedbackVariant);
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-token p-4 sm:p-5 md:grid-cols-3">
      <label className="md:col-span-2">
        <span className="label">Tên lớp</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="input mt-1"
        />
      </label>
      <label>
        <span className="label">Mô tả</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          className="input mt-1"
        />
      </label>
      {showResearch && (
      <label className="md:col-span-3">
        <span className="label">Điều kiện phản hồi của lớp</span>
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as FeedbackVariant)}
          className="input mt-1"
        >
          {(Object.keys(VARIANTS) as FeedbackVariant[]).map((v) => (
            <option key={v} value={v}>
              {VARIANTS[v].label}
            </option>
          ))}
        </select>
        <span className="help">{VARIANTS[variant].desc}</span>
        {variant !== section.feedbackVariant && (
          <span className="mt-1 block text-xs text-warning-700">
            Đổi giữa kỳ sẽ chia dữ liệu của lớp làm hai giai đoạn — phản hồi đã
            sinh trước đó vẫn giữ điều kiện cũ. Nên chốt trước khi lớp bắt đầu
            làm quiz.
          </span>
        )}
      </label>
      )}
      <div className="flex items-end justify-end gap-2 md:col-span-3">
        <button
          onClick={onCancel}
          disabled={busy}
          className="btn-secondary btn-sm"
        >
          Huỷ
        </button>
        <button
          onClick={() =>
            onSave({
              name: name.trim(),
              description: description.trim() ? description.trim() : null,
              // Không gửi khi giảng viên thường không thấy ô này.
              ...(showResearch ? { feedbackVariant: variant } : {}),
            })
          }
          disabled={busy || !name.trim()}
          className="btn-primary btn-sm"
        >
          {busy ? "..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}

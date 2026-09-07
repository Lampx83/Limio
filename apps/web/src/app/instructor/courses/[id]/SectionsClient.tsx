"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";
import { ShareCard } from "@/components/ui";

type FeedbackVariant = "personalized" | "minimal";

// B10 — nhãn cho điều kiện feedback. Viết bằng thứ giảng viên đọc là hiểu ngay
// mình đang cho lớp nào nhận gì, chứ không phải tên biến trong schema.
const VARIANTS: Record<
  FeedbackVariant,
  { label: string; short: string; desc: string; tone: string }
> = {
  personalized: {
    label: "Cá nhân hoá",
    short: "Cá nhân hoá",
    desc: "Phản hồi gọi tên lỗi sai cụ thể, kèm bài ôn gợi ý và đề xuất bài học tiếp theo.",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  minimal: {
    label: "Rút gọn (đối chứng)",
    short: "Rút gọn",
    desc: "Chỉ phản hồi chung. Vẫn thấy điểm và đáp án đúng, nhưng không gọi tên lỗi sai, không gợi ý bài ôn, không đề xuất bài kế tiếp.",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
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

export default function SectionsClient({ courseId }: { courseId: string }) {
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
    patch: { name: string; description: string | null; feedbackVariant: FeedbackVariant },
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
        <div className="banner-warning mb-4 block rounded-xl px-4 py-3 text-sm">
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
                    prefetch={false}
                  >
                    <span className="text-sm font-semibold">{s.name}</span>
                    {s.description && (
                      <span className="ml-2 text-xs text-faint">{s.description}</span>
                    )}
                    <div className="mt-0.5 text-xs text-blue-600 underline decoration-dotted">
                      {s.enrolledCount} học viên
                    </div>
                  </Link>
                  <span
                    title={VARIANTS[s.feedbackVariant].desc}
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${VARIANTS[s.feedbackVariant].tone}`}
                  >
                    {VARIANTS[s.feedbackVariant].short}
                  </span>
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
  onSave: (patch: {
    name: string;
    description: string | null;
    feedbackVariant: FeedbackVariant;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(section.name);
  const [description, setDescription] = useState(section.description ?? "");
  const [variant, setVariant] = useState<FeedbackVariant>(section.feedbackVariant);
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
      <label className="md:col-span-3">
        <span className="block text-xs font-medium text-slate-600">
          Điều kiện phản hồi của lớp
        </span>
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as FeedbackVariant)}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        >
          {(Object.keys(VARIANTS) as FeedbackVariant[]).map((v) => (
            <option key={v} value={v}>
              {VARIANTS[v].label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-faint">{VARIANTS[variant].desc}</span>
        {variant !== section.feedbackVariant && (
          <span className="mt-1 block text-xs text-amber-800">
            Đổi giữa kỳ sẽ chia dữ liệu của lớp làm hai giai đoạn — phản hồi đã
            sinh trước đó vẫn giữ điều kiện cũ. Nên chốt trước khi lớp bắt đầu
            làm quiz.
          </span>
        )}
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
            onSave({
              name: name.trim(),
              description: description.trim() ? description.trim() : null,
              feedbackVariant: variant,
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

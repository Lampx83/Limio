"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import { useResizableColumns } from "@/lib/useResizableColumns";
import { EmptyState, ShareCard, StatusBadge, type StatusTone } from "@/components/ui";
import { ChevronDown, FileSpreadsheet, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2, Users } from "lucide-react";
import ImportStudentsButton from "./ImportStudentsButton";
import SectionImportPanel from "./SectionImportPanel";

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
  termLabel: string | null;
  description: string | null;
  inviteCode: string | null;
  isDefault: boolean;
  feedbackVariant: FeedbackVariant;
  enrolledCount: number;
  createdAt: string;
};

const ERROR_TEXT: Record<string, string> = {
  section_name_taken: "Tên lớp này đã có trong khoá.",
  validation_failed: "Dữ liệu chưa hợp lệ — kiểm tra lại các ô.",
  researcher_only: "Chỉ Researcher mới đổi được điều kiện phản hồi của lớp.",
};
const errorText = (code: string | undefined, status: number) =>
  (code && ERROR_TEXT[code]) || `Có lỗi (${code ?? `HTTP ${status}`}).`;

// ── Sắp xếp ────────────────────────────────────────────────────────────────

type SortKey = "name" | "termLabel" | "description" | "enrolledCount" | "createdAt";
type SortDir = "asc" | "desc";

/** Bấm lần đầu vào cột: chữ → A→Z; số và thời gian → lớn / mới nhất trước. */
const FIRST_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  termLabel: "asc",
  description: "asc",
  enrolledCount: "desc",
  createdAt: "desc",
};

const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

function compareBy(a: Section, b: Section, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "enrolledCount") return sign * (a.enrolledCount - b.enrolledCount);
  if (key === "createdAt") return sign * (Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const av = (key === "name" ? a.name : a[key]) ?? "";
  const bv = (key === "name" ? b.name : b[key]) ?? "";
  // Ô trống luôn xuống cuối, bất kể chiều sắp xếp — sắp ngược mà một loạt dòng trống lên đầu thì vô ích.
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return sign * collator.compare(av, bv);
}

// ── Cột ────────────────────────────────────────────────────────────────────

/** Cột "Tên lớp" co giãn (lấy phần còn lại); các cột dưới đây kéo đổi độ rộng được. */
type ColKey = "termLabel" | "description" | "enrolledCount" | "createdAt";
const COL_DEFAULTS: Record<ColKey, string> = {
  termLabel: "16%",
  description: "28%",
  enrolledCount: "9%",
  createdAt: "17%",
};
const COL_MINS: Record<ColKey, number> = { termLabel: 72, description: 96, enrolledCount: 64, createdAt: 110 };

interface FormValues {
  name: string;
  termLabel: string;
  note: string;
  feedbackVariant: FeedbackVariant;
}

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
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Mặc định: lớp mới tạo nằm trên cùng.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "createdAt", dir: "desc" });
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "create" | "import">("none");

  const cols = useResizableColumns<ColKey>({
    storageKey: "instructor.sections.colWidths.v1",
    defaults: COL_DEFAULTS,
    mins: COL_MINS,
    flexMin: 160,
  });

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

  const onCreate = async (v: FormValues) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/courses/${courseId}/sections`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: v.name.trim(),
          termLabel: v.termLabel.trim() || null,
          description: v.note.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(errorText(j?.error, r.status));
        return false;
      }
      const created = ((await r.json()) as { section: Section }).section;
      await refresh();
      setPanel("none");
      // Lớp mới luôn lên đầu danh sách, dù trước đó đang sắp xếp theo cột nào.
      setSort({ key: "createdAt", dir: "desc" });
      setSearch("");
      setExpandedId(created.id);
      return true;
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (section: Section, v: FormValues) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/sections/${section.id}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: v.name.trim(),
          termLabel: v.termLabel.trim() || null,
          description: v.note.trim() || null,
          // Không gửi khi giảng viên thường không thấy ô này.
          ...(showResearch ? { feedbackVariant: v.feedbackVariant } : {}),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(errorText(j?.error, r.status));
        return false;
      }
      await refresh();
      setEditId(null);
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
    setExpandedId(null);
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

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }));
  }

  const q = search.trim().toLowerCase();
  const rows = (
    q
      ? sections.filter((s) =>
          [s.name, s.termLabel, s.description].some((t) => t && t.toLowerCase().includes(q)),
        )
      : [...sections]
  ).sort(
    (a, b) =>
      compareBy(a, b, sort.key, sort.dir) ||
      // Hai dòng bằng nhau ở cột đang sắp: lớp mới hơn lên trước, để thứ tự luôn ổn định.
      Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const termSuggestions = [...new Set(sections.map((s) => s.termLabel).filter((t): t is string => !!t))];

  /** Tiêu đề cột: bấm để sắp xếp; `edge` = ranh giới kéo đổi độ rộng nằm bên phải cột này. */
  function th(key: SortKey, label: string, edge?: [ColKey | null, ColKey], align: "left" | "right" = "left") {
    const active = sort.key === key;
    return (
      <th
        className="relative px-3 py-2 font-medium"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={`flex w-full items-center gap-1 uppercase transition-colors hover:text-brand-600 ${align === "right" ? "justify-end" : ""}`}
        >
          <span className="truncate">{label}</span>
          <span aria-hidden className={`shrink-0 ${active ? "" : "opacity-40"}`}>
            {active ? (sort.dir === "asc" ? "↑" : "↓") : "↕"}
          </span>
        </button>
        {edge && cols.resizeHandle(edge[0], edge[1], label)}
      </th>
    );
  }

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

      {/* Thanh công cụ: tìm kiếm ở trái, tạo/nhập ở phải. */}
      <div className="flex flex-wrap items-center gap-2">
        {loaded && sections.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên lớp, kỳ học, ghi chú…"
              aria-label="Tìm lớp học"
              className="input h-9 w-64 py-0 pl-8"
            />
          </div>
        )}
        {cols.customized && (
          <button type="button" onClick={cols.resetAll} className="btn-ghost btn-sm" title="Trả các cột về độ rộng mặc định">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Đặt lại độ rộng cột
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPanel(panel === "import" ? "none" : "import")}
            aria-pressed={panel === "import"}
            className="btn-secondary btn-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Nhập từ Excel
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "create" ? "none" : "create")}
            aria-pressed={panel === "create"}
            className="btn-primary btn-sm"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Tạo lớp
          </button>
        </div>
      </div>

      {panel === "create" && (
        <div className="card mt-4">
          <h3 className="text-h4">Tạo lớp học</h3>
          <SectionForm
            className="mt-4"
            initial={{ name: "", termLabel: "", note: "", feedbackVariant: "personalized" }}
            termSuggestions={termSuggestions}
            showResearch={false}
            busy={busy}
            submitLabel="Tạo lớp"
            onSubmit={onCreate}
            onCancel={() => setPanel("none")}
          />
        </div>
      )}

      {panel === "import" && (
        <div className="mt-4">
          <SectionImportPanel
            courseId={courseId}
            onDone={() => {
              void refresh();
              setSort({ key: "createdAt", dir: "desc" });
            }}
            onClose={() => setPanel("none")}
          />
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-lg border border-danger-600/30 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          ⚠ {err}
        </div>
      )}

      {!loaded && <div className="mt-4 text-meta">Đang tải...</div>}

      {loaded && sections.length === 0 && (
        <EmptyState
          className="mt-6"
          icon="🏫"
          title="Chưa có lớp học nào"
          description="Tạo lớp hoặc nhập nhiều lớp từ Excel để lấy link mời học viên tự đăng ký."
        />
      )}

      {loaded && sections.length > 0 && rows.length === 0 && (
        <EmptyState
          className="mt-6"
          icon="🔍"
          title="Không có lớp nào khớp tìm kiếm"
          description="Thử từ khoá khác, hoặc xoá ô tìm kiếm."
          actions={[{ label: "Xoá tìm kiếm", variant: "secondary", onClick: () => setSearch("") }]}
        />
      )}

      {rows.length > 0 && (
        <div data-testid="section-list" className="card mt-4 overflow-x-auto !p-0">
          <table className="w-full min-w-[40rem] text-left text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col />
              <col style={cols.colStyle("termLabel")} />
              <col style={cols.colStyle("description")} />
              <col style={cols.colStyle("enrolledCount")} />
              <col style={cols.colStyle("createdAt")} />
            </colgroup>
            <thead className="border-b border-token bg-[rgb(var(--surface-muted))] text-[11px] tracking-wide text-muted">
              <tr>
                {th("name", "Tên lớp", [null, "termLabel"])}
                {th("termLabel", "Kỳ học", ["termLabel", "description"])}
                {th("description", "Ghi chú", ["description", "enrolledCount"])}
                {th("enrolledCount", "Sĩ số", ["enrolledCount", "createdAt"], "right")}
                {th("createdAt", "Ngày tạo")}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border))]">
              {rows.map((s) => {
                const open = expandedId === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr
                      data-testid={`section-row-${s.id}`}
                      onClick={() => {
                        setExpandedId(open ? null : s.id);
                        if (open) setEditId(null);
                      }}
                      className={`cursor-pointer transition-colors hover:bg-[rgb(var(--surface-muted))] ${open ? "bg-[rgb(var(--surface-muted))]" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          aria-expanded={open}
                          aria-controls={`section-detail-${s.id}`}
                          onClick={(e) => {
                            // Cả dòng đã bắt click; nút chỉ để bàn phím / trình đọc màn hình có chỗ focus.
                            e.stopPropagation();
                            setExpandedId(open ? null : s.id);
                            if (open) setEditId(null);
                          }}
                          className="flex w-full min-w-0 items-center gap-2 text-left font-semibold"
                          title={s.name}
                        >
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "" : "-rotate-90"}`}
                            aria-hidden
                          />
                          <span className="truncate">{s.name}</span>
                          {showResearch && (
                            <span title={VARIANTS[s.feedbackVariant].desc} className="shrink-0">
                              <StatusBadge tone={VARIANTS[s.feedbackVariant].tone} dot={false}>
                                {VARIANTS[s.feedbackVariant].short}
                              </StatusBadge>
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="truncate px-3 py-3" title={s.termLabel ?? undefined}>
                        {s.termLabel ?? <span className="text-faint">—</span>}
                      </td>
                      <td className="truncate px-3 py-3 text-muted" title={s.description ?? undefined}>
                        {s.description ?? ""}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{s.enrolledCount}</td>
                      <td className="truncate px-3 py-3 text-muted" title={formatDateTime(s.createdAt)}>
                        {formatDateTime(s.createdAt)}
                      </td>
                    </tr>

                    {open && (
                      <tr>
                        <td
                          colSpan={5}
                          id={`section-detail-${s.id}`}
                          className="border-t border-token bg-[rgb(var(--surface-muted))]/50 p-4"
                        >
                          {editId === s.id ? (
                            <SectionForm
                              initial={{
                                name: s.name,
                                termLabel: s.termLabel ?? "",
                                note: s.description ?? "",
                                feedbackVariant: s.feedbackVariant,
                              }}
                              termSuggestions={termSuggestions}
                              showResearch={showResearch}
                              variantChanged={(v) => v !== s.feedbackVariant}
                              busy={busy}
                              submitLabel="Lưu"
                              onSubmit={(v) => onSaveEdit(s, v)}
                              onCancel={() => setEditId(null)}
                            />
                          ) : (
                            <div className="space-y-4">
                              {s.description && (
                                <p className="text-sm">
                                  <span className="text-muted">Ghi chú: </span>
                                  {s.description}
                                </p>
                              )}

                              {s.inviteCode ? (
                                <ShareCard
                                  path={`/enroll/${s.inviteCode}`}
                                  label="Link mời vào lớp"
                                  hint="Ai có link này cũng vào được lớp — bấm “Tạo lại mã mời” là link cũ mất hiệu lực ngay."
                                  fileName={`lop-${s.inviteCode}`}
                                  defaultQrOpen
                                />
                              ) : (
                                <p className="text-meta">Lớp này chưa có link mời.</p>
                              )}

                              <div className="flex flex-wrap items-start gap-2">
                                <ImportStudentsButton
                                  courseId={courseId}
                                  sectionId={s.id}
                                  sectionName={s.name}
                                  onImported={refresh}
                                />
                                <Link
                                  href={`/instructor/courses/${courseId}/sections/${s.id}`}
                                  className="btn-secondary btn-sm"
                                  prefetch={false}
                                >
                                  <Users className="h-3.5 w-3.5" aria-hidden />
                                  Danh sách học viên ({s.enrolledCount})
                                </Link>
                                <div className="ml-auto flex flex-wrap gap-2">
                                  <button type="button" onClick={() => setEditId(s.id)} className="btn-secondary btn-sm">
                                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRegenerate(s.id)}
                                    disabled={busy}
                                    className="btn-secondary btn-sm"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                                    Tạo lại mã mời
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDelete(s.id)}
                                    className="btn-secondary btn-sm text-danger-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    Xoá
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Form dùng chung cho tạo lớp và sửa lớp: Tên lớp, Kỳ học (gõ chữ), Ghi chú. */
function SectionForm({
  initial,
  termSuggestions,
  showResearch,
  variantChanged,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
  className = "",
}: {
  initial: FormValues;
  /** Các kỳ đã dùng ở lớp khác của khoá — gợi ý khi gõ, người dùng vẫn gõ tự do được. */
  termSuggestions: string[];
  showResearch: boolean;
  variantChanged?: (v: FeedbackVariant) => boolean;
  busy: boolean;
  submitLabel: string;
  onSubmit: (v: FormValues) => Promise<boolean>;
  onCancel: () => void;
  className?: string;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`}
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(v);
      }}
    >
      <label>
        <span className="label">
          Tên lớp <span className="text-danger-600">*</span>
        </span>
        <input
          type="text"
          required
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={200}
          placeholder="Vd: Lớp K65-CS1"
          className="input mt-1"
        />
      </label>

      <label>
        <span className="label">Kỳ học</span>
        <input
          type="text"
          value={v.termLabel}
          onChange={(e) => set("termLabel", e.target.value)}
          maxLength={100}
          list="section-term-suggestions"
          placeholder="Vd: HK1 2026-27"
          className="input mt-1"
        />
        <datalist id="section-term-suggestions">
          {termSuggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      <label className="sm:col-span-2">
        <span className="label">Ghi chú</span>
        <textarea
          value={v.note}
          onChange={(e) => set("note", e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder="Vd: Học thứ 7 chiều, phòng B1-204"
          className="input mt-1"
        />
      </label>

      {showResearch && (
        <label className="sm:col-span-2">
          <span className="label">Điều kiện phản hồi của lớp</span>
          <select
            value={v.feedbackVariant}
            onChange={(e) => set("feedbackVariant", e.target.value as FeedbackVariant)}
            className="input mt-1"
          >
            {(Object.keys(VARIANTS) as FeedbackVariant[]).map((k) => (
              <option key={k} value={k}>
                {VARIANTS[k].label}
              </option>
            ))}
          </select>
          <span className="help">{VARIANTS[v.feedbackVariant].desc}</span>
          {variantChanged?.(v.feedbackVariant) && (
            <span className="mt-1 block text-xs text-warning-700">
              Đổi giữa kỳ sẽ chia dữ liệu của lớp làm hai giai đoạn — phản hồi đã sinh trước đó vẫn giữ điều kiện
              cũ. Nên chốt trước khi lớp bắt đầu làm quiz.
            </span>
          )}
        </label>
      )}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary btn-sm">
          Huỷ
        </button>
        <button type="submit" disabled={busy || !v.name.trim()} className="btn-primary btn-sm">
          {busy ? "..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

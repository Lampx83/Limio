"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Search, TriangleAlert } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { formatPrice, isFree } from "@/lib/formatPrice";
import { toast } from "@/lib/toast";
import { EmptyState } from "@/components/ui";
import StatusBadge, { type StatusTone } from "@/components/ui/StatusBadge";

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  priceCents: number | null;
  currency: string;
  publicAccess: boolean;
  isSample: boolean;
  /** null = theo mặc định hệ thống. */
  virtualLecturerMode: string | null;
  /** Người giảng ảo riêng của khoá; null = theo mặc định hệ thống. */
  virtualLecturerCode: string | null;
  isLearnerSample: boolean;
  enrollMode: string;
  activeAccessPlanCount: number;
  /** Tổ chức sở hữu khoá (nhà xuất bản/trường); quyết định ai xem được Báo cáo nhà xuất bản. */
  organizationId: string | null;
  organizationName: string | null;
}

interface OrgOption {
  id: string;
  name: string;
  code: string;
}

interface CoursesResponse {
  stats: {
    all: number;
    byStatus: Record<string, number>;
    noOrg: number;
    teacherSample: number;
    learnerSample: number;
  };
  courses: CourseRow[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  archived: "Lưu trữ",
};

const STATUS_TONE: Record<string, StatusTone> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "published", label: "Đã publish" },
  { value: "draft", label: "Nháp" },
  { value: "archived", label: "Lưu trữ" },
] as const;

const VIRTUAL_LECTURER_OPTIONS = [
  { value: "", label: "Theo mặc định hệ thống" },
  { value: "BAT_BUOC", label: "Bắt buộc" },
  { value: "HIEN", label: "Hiện" },
  { value: "TU_BAT", label: "Em tự bật" },
  { value: "AN", label: "Không hiện" },
];

const selectCls =
  "w-full rounded-md border border-token bg-[rgb(var(--surface))] px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50";

/** Công tắc bật/tắt kèm nhãn; hiện rõ "đang bật" thay vì ô tick với chữ "Không". */
function SampleSwitch({
  label,
  checked,
  disabled,
  title,
  ariaLabel,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  title: string;
  ariaLabel: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 whitespace-nowrap text-xs disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-[rgb(var(--border))]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-3" : ""
          }`}
        />
      </span>
      <span className={checked ? "font-medium text-[rgb(var(--text))]" : "text-muted"}>{label}</span>
    </button>
  );
}

/** Cột của bảng ở màn rộng. Sidebar admin chiếm ~260px nên chỉ tách 4 cột từ `xl`; hẹp hơn thì mỗi khoá là một thẻ. */
const XL_COLS = "xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.2fr)] xl:gap-x-5";

export default function CoursesBrowser({
  lecturers,
}: {
  /** Danh mục giảng viên ảo, truyền từ server page để không kéo core-lms vào bundle trình duyệt. */
  lecturers: { code: string; name: string; gender: "female" | "male" }[];
}) {
  const [data, setData] = useState<CoursesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [orgFilter, setOrgFilter] = useState("");
  const [sampleFilter, setSampleFilter] = useState("");
  const [page, setPage] = useState(0);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [openLecturer, setOpenLecturer] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/orgs"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { organizations: OrgOption[] } | null) => setOrgs(d?.organizations ?? []))
      .catch(() => setOrgs([]));
  }, []);

  // Gõ xong mới tìm (250 ms): không bắn một request cho mỗi phím.
  useEffect(() => {
    const next = qInput.trim();
    if (next === q) return;
    const t = setTimeout(() => {
      setQ(next);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [qInput, q]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (orgFilter) params.set("org", orgFilter);
    if (sampleFilter) params.set("sample", sampleFilter);
    params.set("page", String(page));
    params.set("limit", "25");
    fetch(apiUrl(`/api/admin/courses?${params}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: CoursesResponse) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, status, orgFilter, sampleFilter, page, reloadKey]);

  const hasFilter = q !== "" || status !== "" || orgFilter !== "" || sampleFilter !== "";

  function resetFilters() {
    setQInput("");
    setQ("");
    setStatus("");
    setOrgFilter("");
    setSampleFilter("");
    setPage(0);
  }

  function patchLocal(id: string, patch: Partial<CourseRow>) {
    setData((d) => (d ? { ...d, courses: d.courses.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : d));
  }

  /** Một đường lưu cho mọi công tắc/ô chọn: khoá dòng đang lưu, lỗi báo bằng toast ngay cạnh thao tác. */
  async function save(
    c: CourseRow,
    path: string,
    body: unknown,
    patch: Partial<CourseRow>,
    opts: { errorFor?: (code?: string) => string | undefined; done?: string; onSaved?: () => void } = {},
  ) {
    setSavingId(c.id);
    try {
      const r = await fetch(apiUrl(`/api/admin/courses/${c.id}/${path}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        toast.error("Chưa lưu được", { description: opts.errorFor?.(d.error) ?? "Thử lại sau." });
        return;
      }
      patchLocal(c.id, patch);
      if (opts.done) toast.success(opts.done);
      opts.onSaved?.();
    } catch {
      toast.error("Chưa lưu được", { description: "Mạng không ổn định, thử lại sau." });
    } finally {
      setSavingId(null);
    }
  }

  // Gắn khoá vào tổ chức = cho quản trị và người xem báo cáo của tổ chức thấy doanh thu, số liệu học tập tổng hợp
  // (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC8). Hỏi lại trước khi đổi vì đây là quyết định chia sẻ dữ liệu.
  async function changeOrganization(c: CourseRow, value: string) {
    const next = value === "" ? null : value;
    if (next === c.organizationId) return;
    const nextName = orgs.find((o) => o.id === next)?.name ?? "";
    const question = next
      ? `Gắn "${c.title}" vào ${nextName}? Quản trị viên và người xem báo cáo của ${nextName} sẽ thấy doanh thu và số liệu học tập tổng hợp của khoá này.`
      : `Gỡ "${c.title}" khỏi ${c.organizationName ?? "tổ chức"}? Họ sẽ không xem được báo cáo của khoá này nữa.`;
    if (!window.confirm(question)) return;
    await save(
      c,
      "organization",
      { organizationId: next },
      { organizationId: next, organizationName: next ? nextName : null },
      { done: next ? `Đã gắn vào ${nextName}` : "Đã gỡ khỏi tổ chức", onSaved: () => setReloadKey((k) => k + 1) },
    );
  }

  const stats = data?.stats;
  const count = (v: string) => (stats ? (v === "" ? stats.all : (stats.byStatus[v] ?? 0)) : undefined);

  return (
    <>
      {/* Tìm + lọc */}
      <div className="card mb-4 space-y-3 p-4">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            id="courses-search"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="input pl-9"
            placeholder="Tìm theo tên hoặc slug, ví dụ: Tiếng Trung, thiet-ke-ui-ux"
            aria-label="Tìm khoá học theo tên hoặc slug"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = status === f.value;
              return (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => {
                    setStatus(f.value);
                    setPage(0);
                  }}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                      : "border-token text-muted hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                >
                  {f.label}
                  <span className="tabular-nums text-faint">{count(f.value)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <select
              value={orgFilter}
              onChange={(e) => {
                setOrgFilter(e.target.value);
                setPage(0);
              }}
              aria-label="Lọc theo tổ chức"
              className="input !w-auto !py-1.5 text-xs"
            >
              <option value="">Mọi tổ chức</option>
              <option value="none">Chưa thuộc tổ chức{stats ? ` (${stats.noOrg})` : ""}</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              value={sampleFilter}
              onChange={(e) => {
                setSampleFilter(e.target.value);
                setPage(0);
              }}
              aria-label="Lọc theo khoá mẫu"
              className="input !w-auto !py-1.5 text-xs"
            >
              <option value="">Mọi khoá</option>
              <option value="teacher">Khoá mẫu cho giảng viên{stats ? ` (${stats.teacherSample})` : ""}</option>
              <option value="learner">Khoá mẫu cho học viên{stats ? ` (${stats.learnerSample})` : ""}</option>
            </select>
            {hasFilter && (
              <button type="button" onClick={resetFilters} className="text-xs text-brand-600 hover:underline">
                Xoá bộ lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="banner-danger mb-4 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            Chưa tải được danh sách khoá học.
          </span>
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="btn-secondary btn-sm">
            Thử lại
          </button>
        </div>
      )}

      {!data ? (
        <div className="card space-y-3" aria-busy="true" aria-label="Đang tải danh sách">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-[rgb(var(--surface-muted))]" />
          ))}
        </div>
      ) : data.courses.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon="🔎"
            title="Không có khoá học nào khớp"
            description="Thử bỏ bớt bộ lọc hoặc gõ từ khoá ngắn hơn."
            actions={[{ label: "Xoá bộ lọc", onClick: resetFilters, variant: "secondary" }]}
          />
        ) : (
          <EmptyState icon="📚" title="Chưa có khoá học nào" description="Khoá học do giảng viên tạo sẽ hiện ở đây." />
        )
      ) : (
        <>
          <p className="mb-2 text-xs text-muted" aria-live="polite">
            {data.total} khoá học
            {loading ? " · đang cập nhật…" : ""}
          </p>

          <div className={`card overflow-hidden p-0 transition-opacity ${loading ? "opacity-60" : ""}`}>
            <div className={`hidden border-b border-token bg-base-50 px-4 py-2.5 text-xs font-medium uppercase text-faint xl:grid ${XL_COLS}`}>
              <div>Khoá học</div>
              <div>Giá &amp; gói bán</div>
              <div>Tổ chức sở hữu</div>
              <div>Khoá mẫu</div>
            </div>

            <ul className="divide-y divide-token">
              {data.courses.map((c) => {
                const busy = savingId === c.id;
                // Giảng viên mới không ghi danh nên chỉ xem được khoá công khai. Đang là mẫu thì luôn cho tắt, dù khoá đã đổi sang riêng tư.
                const teacherEligible = c.status === "published" && c.publicAccess;
                // "Học thử" ghi danh thật nên khoá phải published + tự ghi danh + miễn phí. Đang là mẫu thì luôn cho tắt.
                const learnerEligible = c.status === "published" && c.enrollMode === "open" && isFree(c.priceCents);
                const lecturerCustom = c.virtualLecturerMode !== null || c.virtualLecturerCode !== null;
                const lecturerOpen = openLecturer === c.id;
                return (
                  <li key={c.id} className="px-4 py-4 hover:bg-base-50">
                    <div className={`grid gap-3 md:grid-cols-3 xl:items-start xl:gap-y-0 ${XL_COLS}`}>
                      {/* Khoá học + lối vào các trang quản lý */}
                      <div className="min-w-0 md:col-span-3 xl:col-span-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/instructor/courses/${c.id}`} prefetch={false} className="min-w-0 truncate font-medium hover:underline" title="Mở khoá học">
                            {c.title}
                          </Link>
                          <StatusBadge tone={STATUS_TONE[c.status] ?? "neutral"}>{STATUS_LABEL[c.status] ?? c.status}</StatusBadge>
                        </div>
                        <p className="truncate text-xs text-faint">{c.slug}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Link href={`/admin/courses/${c.id}/access-plans`} prefetch={false} className="btn-secondary btn-sm">
                            Gói bán
                          </Link>
                          <Link href={`/admin/courses/${c.id}/narrations`} prefetch={false} className="btn-ghost btn-sm">
                            Giọng đọc
                          </Link>
                          <button
                            type="button"
                            onClick={() => setOpenLecturer(lecturerOpen ? null : c.id)}
                            aria-expanded={lecturerOpen}
                            aria-controls={`lecturer-${c.id}`}
                            className="btn-ghost btn-sm"
                          >
                            Giảng viên ảo
                            {lecturerCustom && <span className="chip-brand !px-1.5 !py-0">riêng</span>}
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${lecturerOpen ? "rotate-180" : ""}`} aria-hidden />
                          </button>
                        </div>
                      </div>

                      {/* Giá */}
                      <div>
                        <p className="mb-0.5 text-xs text-faint xl:hidden">Giá &amp; gói bán</p>
                        <p className="font-medium tabular-nums">{isFree(c.priceCents) ? "Miễn phí" : formatPrice(c.priceCents!, c.currency)}</p>
                        <p className={`text-xs ${c.activeAccessPlanCount === 0 ? "text-faint" : "text-muted"}`}>
                          {c.activeAccessPlanCount === 0 ? "Chưa có gói bán" : `${c.activeAccessPlanCount} gói đang bán`}
                        </p>
                      </div>

                      {/* Tổ chức */}
                      <div>
                        <label className="block">
                          <span className="mb-0.5 block text-xs text-faint xl:sr-only">Tổ chức sở hữu</span>
                          <select
                            value={c.organizationId ?? ""}
                            disabled={busy}
                            aria-label={`Tổ chức sở hữu khoá: ${c.title}`}
                            title="Quản trị viên và người xem báo cáo của tổ chức sẽ thấy doanh thu và số liệu học tập tổng hợp của khoá"
                            onChange={(e) => void changeOrganization(c, e.target.value)}
                            className={selectCls}
                          >
                            <option value="">Chưa thuộc tổ chức nào</option>
                            {c.organizationId && !orgs.some((o) => o.id === c.organizationId) && (
                              <option value={c.organizationId}>{c.organizationName ?? "Tổ chức hiện tại"}</option>
                            )}
                            {orgs.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {/* Khoá mẫu */}
                      <div>
                        <p className="mb-1 text-xs text-faint xl:hidden">Khoá mẫu</p>
                        <div className="space-y-1.5">
                          <SampleSwitch
                            label="Cho giảng viên"
                            checked={c.isSample}
                            disabled={busy || (!c.isSample && !teacherEligible)}
                            title={
                              c.isSample || teacherEligible
                                ? "Hiện cho giảng viên chưa có khoá nào xem thử"
                                : "Cần publish và bật đọc công khai trước"
                            }
                            ariaLabel={`Khoá mẫu cho giảng viên: ${c.title}`}
                            onChange={(next) =>
                              void save(c, "sample", { isSample: next }, { isSample: next }, {
                                errorFor: (code) =>
                                  code === "sample_requires_public"
                                    ? `"${c.title}" cần đã publish và bật đọc công khai thì mới làm khoá mẫu được.`
                                    : undefined,
                                onSaved: () => setReloadKey((k) => k + 1),
                              })
                            }
                          />
                          <SampleSwitch
                            label="Cho học viên"
                            checked={c.isLearnerSample}
                            disabled={busy || (!c.isLearnerSample && !learnerEligible)}
                            title={
                              c.isLearnerSample || learnerEligible
                                ? "Hiện ở thẻ “Thử học ngay” cho học viên chưa có khoá nào; nhiều khoá bật thì hiện khoá bật gần nhất"
                                : "Cần publish, cho tự ghi danh và miễn phí trước"
                            }
                            ariaLabel={`Khoá mẫu cho học viên: ${c.title}`}
                            onChange={(next) =>
                              void save(c, "learner-sample", { on: next }, { isLearnerSample: next }, {
                                errorFor: (code) =>
                                  code === "learner_sample_requires_open_free"
                                    ? `"${c.title}" cần đã publish, cho học viên tự ghi danh và miễn phí thì mới làm khoá mẫu cho học viên được.`
                                    : undefined,
                                onSaved: () => setReloadKey((k) => k + 1),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    {lecturerOpen && (
                      <div id={`lecturer-${c.id}`} className="mt-3 grid gap-3 rounded-lg bg-[rgb(var(--surface-muted))] p-3 sm:grid-cols-2">
                        <label className="block text-xs text-muted">
                          <span className="mb-1 block font-medium text-[rgb(var(--text))]">Chế độ hiện giảng viên ảo</span>
                          <select
                            value={c.virtualLecturerMode ?? ""}
                            disabled={busy}
                            aria-label={`Giảng viên ảo: ${c.title}`}
                            onChange={(e) => {
                              const mode = e.target.value === "" ? null : e.target.value;
                              void save(c, "virtual-lecturer", { mode }, { virtualLecturerMode: mode });
                            }}
                            className={selectCls}
                          >
                            {VIRTUAL_LECTURER_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs text-muted">
                          <span className="mb-1 block font-medium text-[rgb(var(--text))]">Người giảng</span>
                          <select
                            value={c.virtualLecturerCode ?? ""}
                            disabled={busy}
                            aria-label={`Người giảng ảo: ${c.title}`}
                            onChange={(e) => {
                              const lecturerCode = e.target.value === "" ? null : e.target.value;
                              void save(c, "virtual-lecturer", { lecturerCode }, { virtualLecturerCode: lecturerCode });
                            }}
                            className={selectCls}
                          >
                            <option value="">Theo mặc định hệ thống</option>
                            {lecturers.map((l) => (
                              <option key={l.code} value={l.code}>
                                {l.name} ({l.gender === "female" ? "nữ" : "nam"})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="mt-3 text-xs text-muted">
            <span className="font-medium text-[rgb(var(--text))]">Khoá mẫu</span> là khoá hiện sẵn cho người mới xem thử khi họ chưa có
            khoá nào. Công tắc mờ nghĩa là khoá chưa đủ điều kiện, rê chuột vào để biết còn thiếu gì.
          </p>

          {data.pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted">
              <span>
                Trang {data.page + 1} / {data.pageCount} · {data.total} khoá học
              </span>
              <div className="flex gap-1">
                <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} className="btn-ghost btn-sm">
                  ← Trước
                </button>
                <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= data.pageCount - 1 || loading} className="btn-ghost btn-sm">
                  Sau →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

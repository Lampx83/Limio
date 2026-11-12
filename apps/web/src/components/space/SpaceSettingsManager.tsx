"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { derivePalette, isHexColor } from "@/lib/space/theme";
import { SPACE_EDITABLE_COPY, SPACE_TEMPLATES } from "@/lib/space/templates";
import type { SpaceStored } from "@/lib/space/settings";
import type { SpaceLang } from "@/lib/space/types";

type CopyKey = (typeof SPACE_EDITABLE_COPY)[number];

interface CourseRow {
  slug: string;
  title: string;
  iconUrl: string;
  topic: Record<SpaceLang, string>;
  outcome: Record<SpaceLang, string>;
}

const COPY_LABEL: Record<CopyKey, string> = {
  heroLead: "Tiêu đề (phần đầu)",
  heroAccent: "Tiêu đề (phần nhấn màu)",
  intro: "Đoạn giới thiệu",
  coursesSub: "Mô tả dưới \"Các khoá học\"",
  footnote: "Chú thích chân trang",
  metaDescription: "Mô tả khi chia sẻ link",
};
const LONG: CopyKey[] = ["intro", "footnote", "metaDescription"];

const ERR: Record<string, string> = {
  invalid_slug: "Địa chỉ không hợp lệ (2–40 ký tự: chữ thường, số, gạch nối; không trùng tên hệ thống).",
  slug_required: "Cần đặt địa chỉ (slug) trước khi bật space.",
  slug_taken: "Địa chỉ này đã có space khác dùng.",
  slug_reserved: "Địa chỉ này dành riêng cho nền tảng — chỉ Platform Admin dùng được.",
  course_not_in_org: "Có khoá không thuộc trường này, không thể đưa vào space.",
  forbidden: "Bạn không có quyền với trường này.",
};

function toRows(s: SpaceStored): CourseRow[] {
  return (s.courses ?? []).map((c) => ({
    slug: c.slug,
    title: c.title,
    iconUrl: c.iconUrl ?? "",
    topic: { en: c.topic?.en ?? "", vi: c.topic?.vi ?? "" },
    outcome: { en: c.outcome?.en ?? "", vi: c.outcome?.vi ?? "" },
  }));
}

export default function SpaceSettingsManager({
  organizationId,
  orgName,
  orgCourses,
  initial,
  initialEnabled,
  initialSlug,
  isPlatformAdmin,
}: {
  organizationId: string;
  orgName: string;
  orgCourses: Array<{ slug: string; title: string; status: string }>;
  initial: SpaceStored;
  initialEnabled: boolean;
  initialSlug: string | null;
  isPlatformAdmin: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [titleSuffix, setTitleSuffix] = useState(initial.titleSuffix ?? "");
  const [primary, setPrimary] = useState(initial.primary ?? "#2563EB");
  const [accent, setAccent] = useState(initial.accent ?? "#F59E0B");
  // Bộ màu chính xác (vd NEU) đi kèm mẫu; đổi màu chủ đạo/nhấn thì bỏ để suy lại từ màu mới.
  const [tones, setTones] = useState({ dark: initial.dark, soft: initial.soft, accent2: initial.accent2 });
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [logoAlt, setLogoAlt] = useState(initial.logoAlt ?? "");
  const [partnerLogoUrl, setPartnerLogoUrl] = useState(initial.partnerLogoUrl ?? "");
  const [partnerLogoAlt, setPartnerLogoAlt] = useState(initial.partnerLogoAlt ?? "");
  const [heroVisualUrl, setHeroVisualUrl] = useState(initial.heroVisualUrl ?? "");
  const [siteUrl, setSiteUrl] = useState(initial.siteUrl ?? "");
  const [siteLabel, setSiteLabel] = useState(initial.siteLabel ?? "");
  const [langs, setLangs] = useState<SpaceLang[]>(initial.langs ?? ["en", "vi"]);
  const [defaultLang, setDefaultLang] = useState<SpaceLang>(initial.defaultLang ?? "en");
  const [copy, setCopy] = useState<Record<SpaceLang, Partial<Record<CopyKey, string>>>>({
    en: { ...(initial.copy?.en as Partial<Record<CopyKey, string>>) },
    vi: { ...(initial.copy?.vi as Partial<Record<CopyKey, string>>) },
  });
  const [courses, setCourses] = useState<CourseRow[]>(toRows(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const palette = derivePalette(isHexColor(primary) ? primary : "#2563EB", isHexColor(accent) ? accent : "#F59E0B", {
    dark: tones.dark,
    soft: tones.soft,
    accent2: tones.accent2,
  });
  const homePath = slug === "micro4asia" ? "/micro4asia" : `/s/${slug}`;
  const inSpace = new Set(courses.map((c) => c.slug));
  const addable = orgCourses.filter((c) => !inSpace.has(c.slug));
  const statusOf = (s: string) => orgCourses.find((c) => c.slug === s)?.status ?? null;

  function applyTemplate(id: string) {
    const t = SPACE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const hasInput = Boolean(name || logoUrl || partnerLogoUrl || courses.length > 0);
    if (hasInput && !window.confirm("Nạp mẫu sẽ thay các giá trị đang nhập trong form (chưa lưu). Tiếp tục?")) return;
    const s = t.build();
    setName(s.name ?? "");
    setTitleSuffix(s.titleSuffix ?? "");
    setPrimary(s.primary ?? primary);
    setAccent(s.accent ?? accent);
    setTones({ dark: s.dark, soft: s.soft, accent2: s.accent2 });
    setLogoUrl(s.logoUrl ?? "");
    setLogoAlt(s.logoAlt ?? "");
    setPartnerLogoUrl(s.partnerLogoUrl ?? "");
    setPartnerLogoAlt(s.partnerLogoAlt ?? "");
    setHeroVisualUrl(s.heroVisualUrl ?? "");
    setSiteUrl(s.siteUrl ?? "");
    setSiteLabel(s.siteLabel ?? "");
    setLangs(s.langs ?? ["en", "vi"]);
    setDefaultLang(s.defaultLang ?? "en");
    setCopy({
      en: { ...(s.copy?.en as Partial<Record<CopyKey, string>>) },
      vi: { ...(s.copy?.vi as Partial<Record<CopyKey, string>>) },
    });
    setCourses(toRows(s));
    if (!slug) setSlug(id);
    toast.success("Đã nạp mẫu vào form", { description: "Bấm Lưu để áp dụng." });
  }

  async function upload(file: File): Promise<string | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/space/asset`), { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error("Chưa tải được ảnh", {
        description: res.status === 415 ? "Chỉ nhận JPG, PNG, WebP, GIF." : res.status === 413 ? "Ảnh tối đa 5 MB." : undefined,
      });
      return null;
    }
    return data.url as string;
  }

  function move(i: number, d: -1 | 1) {
    setCourses((cs) => {
      const j = i + d;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }
  const patchCourse = (i: number, p: Partial<CourseRow>) => setCourses((cs) => cs.map((c, k) => (k === i ? { ...c, ...p } : c)));

  async function save() {
    setBusy(true);
    setError(null);
    const space: SpaceStored = {
      name,
      titleSuffix,
      primary,
      accent,
      ...tones,
      logoUrl,
      logoAlt,
      partnerLogoUrl,
      partnerLogoAlt,
      heroVisualUrl,
      siteUrl,
      siteLabel,
      langs,
      defaultLang,
      courses: courses.map((c) => ({
        slug: c.slug,
        title: c.title,
        iconUrl: c.iconUrl,
        topic: c.topic,
        outcome: c.outcome,
      })),
      copy: { en: copy.en, vi: copy.vi },
    };
    try {
      const res = await fetch(apiUrl(`/api/orgs/${organizationId}/space`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, slug, space }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = ERR[data.error as string] ?? "Chưa lưu được. Thử lại sau.";
        setError(data.error === "course_not_in_org" && data.details?.slugs ? `${msg} (${data.details.slugs.join(", ")})` : msg);
        return;
      }
      toast.success("Đã lưu space");
      router.refresh();
    } catch {
      setError("Mạng không ổn định, thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  const field = "input mt-1.5";
  return (
    <section className="card p-5" aria-labelledby="space-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="space-heading" className="text-h4">
            Space — trang riêng &amp; thương hiệu
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Tạo trang giới thiệu riêng cho {orgName} (hoặc một dự án) tại <code>/s/&lt;địa chỉ&gt;</code>. Khi người học vào các khoá
            trong danh sách, toàn bộ giao diện (màu, logo, chân trang) đổi theo thương hiệu này và không bị đưa về giao diện Limio.
          </p>
        </div>
        {enabled && slug && (
          <a href={homePath} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
            Xem trang <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="font-medium">{enabled ? "Space đang bật" : "Space đang tắt"}</span>
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="sp-slug">Địa chỉ (slug)</label>
          <div className="mt-1.5 flex items-center gap-1 text-sm text-muted">
            <span>/s/</span>
            <input id="sp-slug" className="input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="ten-truong" maxLength={40} />
          </div>
          <span className="help">Chữ thường, số, gạch nối. {isPlatformAdmin ? "" : "Đổi địa chỉ sẽ làm link cũ không còn dùng được."}</span>
        </div>
        <div>
          <label className="label" htmlFor="sp-name">Tên space</label>
          <input id="sp-name" className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={orgName} maxLength={60} />
          <span className="help">Để trống thì dùng tên trường.</span>
        </div>
        <div>
          <label className="label" htmlFor="sp-suffix">Hậu tố tên trang khi chia sẻ</label>
          <input id="sp-suffix" className={field} value={titleSuffix} onChange={(e) => setTitleSuffix(e.target.value)} placeholder={orgName} maxLength={40} />
        </div>
        <div>
          <span className="label">Mẫu</span>
          <select className="select mt-1.5" value="" onChange={(e) => applyTemplate(e.target.value)} aria-label="Nạp mẫu">
            <option value="">Nạp mẫu có sẵn…</option>
            {SPACE_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Màu sắc</h3>
      <div className="mt-2 flex flex-wrap items-end gap-4">
        {(
          [
            ["Màu chủ đạo", primary, (v: string) => { setPrimary(v); setTones({ dark: undefined, soft: undefined, accent2: undefined }); }],
            ["Màu nhấn", accent, (v: string) => { setAccent(v); setTones((t) => ({ ...t, accent2: undefined })); }],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="text-sm">
            <span className="label">{label}</span>
            <span className="mt-1.5 flex items-center gap-2">
              <input type="color" aria-label={label} value={isHexColor(value) ? value : "#000000"} onChange={(e) => set(e.target.value.toUpperCase())} className="h-9 w-12 cursor-pointer rounded border border-token p-0.5" />
              <input className="input w-28 font-mono" value={value} onChange={(e) => set(e.target.value.toUpperCase())} maxLength={7} aria-label={`${label} (mã hex)`} />
            </span>
          </label>
        ))}
        {/* Xem trước màu: hero + nút + dải số liệu của trang space. */}
        <div className="min-w-[16rem] flex-1 overflow-hidden rounded-lg border border-token text-xs" aria-label="Xem trước màu">
          <div className="px-4 py-3 text-white" style={{ background: palette.primary }}>
            <div className="font-bold">{name || orgName}</div>
            <span className="mt-1.5 inline-block px-2 py-0.5 font-bold" style={{ background: palette.accent, color: palette.primary }}>Nút chính</span>
          </div>
          <div className="px-4 py-1.5 font-semibold" style={{ background: palette.soft, color: palette.primary }}>6 khoá học · 2 đang mở</div>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Logo &amp; hình</h3>
      <div className="mt-2 grid gap-4 md:grid-cols-2">
        <AssetField label="Logo chính (ngang)" hint="Để trống thì dùng logo của trường." value={logoUrl} onChange={setLogoUrl} upload={upload} />
        <div>
          <label className="label" htmlFor="sp-logoalt">Mô tả logo chính (alt)</label>
          <input id="sp-logoalt" className={field} value={logoAlt} onChange={(e) => setLogoAlt(e.target.value)} maxLength={120} />
        </div>
        <AssetField label="Logo đối tác / dự án" hint="Hiện cạnh logo chính, ngăn bởi một vạch." value={partnerLogoUrl} onChange={setPartnerLogoUrl} upload={upload} />
        <div>
          <label className="label" htmlFor="sp-plogoalt">Mô tả logo đối tác (alt)</label>
          <input id="sp-plogoalt" className={field} value={partnerLogoAlt} onChange={(e) => setPartnerLogoAlt(e.target.value)} maxLength={120} />
        </div>
        <AssetField label="Hình hero (vuông, tuỳ chọn)" hint="Hiện bên phải đầu trang; để trống thì đầu trang chạy hết chiều ngang." value={heroVisualUrl} onChange={setHeroVisualUrl} upload={upload} />
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="sp-site">Website dự án (https)</label>
            <input id="sp-site" className={field} value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="label" htmlFor="sp-sitelabel">Chữ hiển thị cho website</label>
            <input id="sp-sitelabel" className={field} value={siteLabel} onChange={(e) => setSiteLabel(e.target.value)} maxLength={80} />
          </div>
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Ngôn ngữ</h3>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
        {(["en", "vi"] as const).map((l) => (
          <label key={l} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={langs.includes(l)}
              onChange={(e) => {
                const next = e.target.checked ? [...langs, l] : langs.filter((x) => x !== l);
                if (next.length === 0) return; // luôn còn ít nhất một ngôn ngữ
                setLangs(next);
                if (!next.includes(defaultLang)) setDefaultLang(next[0]!);
              }}
            />
            {l === "en" ? "English" : "Tiếng Việt"}
          </label>
        ))}
        <label className="flex items-center gap-2">
          Mặc định
          <select className="select w-auto" value={defaultLang} onChange={(e) => setDefaultLang(e.target.value as SpaceLang)}>
            {langs.map((l) => (
              <option key={l} value={l}>{l === "en" ? "English" : "Tiếng Việt"}</option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="mt-6 text-sm font-semibold">Nội dung trang (tuỳ chọn)</h3>
      <p className="help">Để trống thì dùng chữ mặc định theo tên trường.</p>
      <div className="mt-2 grid gap-3">
        {langs.map((l) => (
          <details key={l} className="rounded-lg border border-token p-3" open={langs.length === 1}>
            <summary className="cursor-pointer text-sm font-medium">{l === "en" ? "English" : "Tiếng Việt"}</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {SPACE_EDITABLE_COPY.map((k) => (
                <div key={k} className={LONG.includes(k) ? "md:col-span-2" : ""}>
                  <label className="label" htmlFor={`sp-${l}-${k}`}>{COPY_LABEL[k]}</label>
                  {LONG.includes(k) ? (
                    <textarea id={`sp-${l}-${k}`} className="textarea mt-1.5" rows={3} value={copy[l][k] ?? ""} onChange={(e) => setCopy((c) => ({ ...c, [l]: { ...c[l], [k]: e.target.value } }))} />
                  ) : (
                    <input id={`sp-${l}-${k}`} className={field} value={copy[l][k] ?? ""} onChange={(e) => setCopy((c) => ({ ...c, [l]: { ...c[l], [k]: e.target.value } }))} />
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-semibold">Danh sách khoá ({courses.length})</h3>
      <p className="help">
        Khoá đã xuất bản hiện "Đang mở" và dẫn vào khoá; khoá chưa có hoặc chưa xuất bản hiện "Sắp ra mắt" và tự mở khi xuất bản.
        Mọi trang của các khoá này (giới thiệu, bài học, bài thi) đổi theo thương hiệu của space.
      </p>
      <ol className="mt-3 grid gap-3">
        {courses.map((c, i) => {
          const st = statusOf(c.slug);
          return (
            <li key={`${c.slug}-${i}`} className="rounded-lg border border-token p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 text-sm font-bold text-faint">{i + 1}</span>
                <input className="input w-56 font-mono text-xs" value={c.slug} onChange={(e) => patchCourse(i, { slug: e.target.value.trim() })} aria-label="Slug khoá" placeholder="slug-khoa-hoc" />
                <input className="input min-w-[12rem] flex-1" value={c.title} onChange={(e) => patchCourse(i, { title: e.target.value })} aria-label="Tên khoá" placeholder="Tên khoá" />
                <span className={`chip ${st === "published" ? "chip-brand" : ""}`}>{st === "published" ? "Đã xuất bản" : st ? `Trong trường · ${st}` : "Chưa có khoá"}</span>
                <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === courses.length - 1} aria-label="Xuống"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setCourses((cs) => cs.filter((_, k) => k !== i))} aria-label="Bỏ khỏi space"><Trash2 className="h-4 w-4" /></button>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">Chủ đề, chuẩn đầu ra, biểu tượng</summary>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {langs.map((l) => (
                    <div key={l} className="grid gap-2">
                      <input className="input" placeholder={`Chủ đề (${l})`} value={c.topic[l]} onChange={(e) => patchCourse(i, { topic: { ...c.topic, [l]: e.target.value } })} />
                      <textarea className="textarea" rows={3} placeholder={`Người học có thể… (${l})`} value={c.outcome[l]} onChange={(e) => patchCourse(i, { outcome: { ...c.outcome, [l]: e.target.value } })} />
                    </div>
                  ))}
                  <AssetField label="Biểu tượng ô khoá (tuỳ chọn)" value={c.iconUrl} onChange={(v) => patchCourse(i, { iconUrl: v })} upload={upload} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {addable.length > 0 && (
          <select
            className="select w-auto max-w-xs"
            value=""
            aria-label="Thêm khoá của trường"
            onChange={(e) => {
              const oc = orgCourses.find((x) => x.slug === e.target.value);
              if (oc) setCourses((cs) => [...cs, { slug: oc.slug, title: oc.title, iconUrl: "", topic: { en: "", vi: "" }, outcome: { en: "", vi: "" } }]);
            }}
          >
            <option value="">Thêm khoá của trường…</option>
            {addable.map((c) => (
              <option key={c.slug} value={c.slug}>{c.title} ({c.status})</option>
            ))}
          </select>
        )}
        <button type="button" className="btn-secondary btn-sm" onClick={() => setCourses((cs) => [...cs, { slug: "", title: "", iconUrl: "", topic: { en: "", vi: "" }, outcome: { en: "", vi: "" } }])}>
          <Plus className="h-4 w-4" aria-hidden /> Thêm khoá giữ chỗ
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu space"}
        </button>
        <span className="text-xs text-muted">Thay đổi áp dụng ngay cho trang công khai.</span>
      </div>
    </section>
  );
}

/** Ô ảnh: xem trước + ô URL + nút tải lên. */
function AssetField({
  label,
  hint,
  value,
  onChange,
  upload,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  upload: (f: File) => Promise<string | null>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-token bg-white">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-faint">Chưa có</span>
          )}
        </span>
        <input className="input min-w-0 flex-1 text-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder="/đường-dẫn hoặc https://…" aria-label={`${label} (URL)`} />
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            const url = await upload(f);
            setBusy(false);
            if (url) onChange(url);
          }}
        />
        <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => ref.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden /> {busy ? "…" : "Tải lên"}
        </button>
        {value && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange("")} aria-label="Bỏ ảnh">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {hint && <span className="help">{hint}</span>}
    </div>
  );
}

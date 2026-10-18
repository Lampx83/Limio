"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { Link2, Loader2, Upload } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { slideImageThumb } from "@/lib/limioLiveImage";
import { SLIDE_ILLUSTRATION_GROUPS, SLIDE_ILLUSTRATION_LABELS, isSlideIllustrationId } from "@feedbackme/shared-types";
import { MOTIF_LABELS, SLIDE_MOTIFS, isMotifId, slideArtLabel, type SlideArtId, type SlideMotifId } from "@/lib/limioLiveMotifs";
import { motifSvgBody } from "@/lib/limioLiveMotifArt";
import { brandCssVars, brandEffectiveThemeId } from "@/lib/limioLiveBrand";
import { useLiveBrand } from "../liveBrandContext";
import { isDarkTheme, layoutThemeClass, slideBgFor } from "../slideThemes";

// Chọn hoa văn trang trí (limioLiveMotifs): cho cả bài trong bảng Giao diện, và riêng một slide trong khung sửa.
// Slide Chữ và hình còn có ảnh riêng của giảng viên (tải từ máy, kéo thả, dán Ctrl+V, dán địa chỉ; mockup
// docs/mockup/anh-rieng-o-hinh.html) và hình minh hoạ theo chủ đề (chia năm nhóm), đặt trên phần hoa văn.
// Mỗi ô là hình thật của hoa văn trên đúng giao diện (và màu thương hiệu) của bài, không phải tên suông.

/** Ô xem trước một hoa văn hoặc hình minh hoạ trên giao diện của bài; null = ô trống (không dùng). */
export function MotifSwatch({ motif, themeId, className = "" }: { motif: SlideArtId | null; themeId?: string | null; className?: string }) {
  const brand = useLiveBrand();
  const eff = brandEffectiveThemeId(brand, themeId);
  const vars = brandCssVars(brand, isDarkTheme(themeId)) as CSSProperties;
  const uid = `sw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const html = useMemo(
    () =>
      motif
        ? `<svg viewBox="0 0 240 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%">${motifSvgBody(motif, 240, 240, uid)}</svg>`
        : "",
    [motif, uid],
  );
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-lg border border-black/10 ${layoutThemeClass(eff)} ${className}`}
      style={{ background: slideBgFor(themeId, true), ...vars }}
    >
      <span className="absolute inset-0" style={{ background: "linear-gradient(145deg, var(--ssoft), var(--ssoft2))" }} />
      {motif ? (
        <span className={`absolute inset-0 ${isSlideIllustrationId(motif) ? "motif m-illus" : ""}`} dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="absolute inset-0" style={{ background: "repeating-linear-gradient(135deg, transparent 0 7px, rgba(120,120,120,.18) 7px 8px)" }} />
      )}
    </span>
  );
}

type Option = { value: string | null; label: string; motif: SlideArtId | null };

function Grid({ options, value, themeId, onPick, label }: { options: Option[]; value: string | null; themeId?: string | null; onPick: (v: string | null) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(76px,1fr))]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value ?? "auto"}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.value)}
            className={`grid gap-1 rounded-xl border p-1 text-center text-[11px] font-medium leading-tight transition ${
              on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"
            }`}
          >
            <MotifSwatch motif={o.motif} themeId={themeId} className="aspect-square w-full" />
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Hoa văn của cả bài: Tự động (mặc định, hệ thống chọn theo mã bài) / Chọn một hoa văn / Không dùng.
 * `value`: null = tự động, "none", hoặc mã hoa văn; `autoMotif` là hoa văn mà chế độ tự động đang cho ra.
 */
export function DeckMotifPicker({
  value,
  autoMotif,
  themeId,
  onChange,
}: {
  value: string | null;
  autoMotif: SlideMotifId;
  themeId?: string | null;
  onChange: (v: string | null) => void;
}) {
  const mode = value === "none" ? "none" : isMotifId(value) ? "pick" : "auto";
  const [picking, setPicking] = useState(mode === "pick");
  const shown = picking || mode === "pick" ? "pick" : mode;
  const seg = (m: "auto" | "pick" | "none", text: string) => (
    <button
      type="button"
      aria-pressed={shown === m}
      onClick={() => {
        setPicking(m === "pick");
        if (m === "auto") onChange(null);
        if (m === "none") onChange("none");
      }}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
        shown === m ? "bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm" : "text-muted hover:text-[rgb(var(--text))]"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-faint">Hoa văn trang trí</p>
      <p className="mb-1.5 text-xs text-muted">
        Hình trừu tượng ở chỗ trống của bìa, bìa phần, trích dẫn và ô hình chưa có ảnh. Chữ luôn đủ rõ.
      </p>
      <div className="flex items-center gap-3">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-0.5" role="group" aria-label="Hoa văn của cả bài">
          {seg("auto", "Tự động")}
          {seg("pick", "Chọn một")}
          {seg("none", "Không dùng")}
        </div>
      </div>
      {shown === "auto" && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <MotifSwatch motif={autoMotif} themeId={themeId} className="h-10 w-10 shrink-0" />
          <span>
            Bài này đang dùng <b className="text-[rgb(var(--text))]">{MOTIF_LABELS[autoMotif]}</b>; ô hình của từng slide lần lượt nhận các hoa văn khác.
          </span>
        </div>
      )}
      {shown === "pick" && (
        <div className="mt-2">
          <Grid
            label="Hoa văn chủ đạo"
            options={SLIDE_MOTIFS.map((m) => ({ value: m, label: MOTIF_LABELS[m], motif: m }))}
            value={isMotifId(value) ? value : null}
            themeId={themeId}
            onPick={(v) => onChange(v)}
          />
        </div>
      )}
    </div>
  );
}

/** Ảnh riêng ở ô hình, đúng các khoá trong config của slide Chữ và hình. */
export interface SlotImage {
  imageUrl: string;
  imageAlt?: string;
  imageFit?: "contain";
  imageCredit?: string;
  imageSourceUrl?: string;
}
/** Thay đổi ảnh riêng: patch các khoá, hoặc null = bỏ ảnh (ô hình quay về hình minh hoạ/hoa văn đã chọn). */
export type SlotImageChange = Partial<Record<keyof SlotImage, string | undefined>> | null;

const SLOT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const SLOT_IMAGE_MAX = 10 * 1024 * 1024;

/** Lời báo lỗi theo mã của route slot-image: nói rõ phải làm gì. */
function slotImageError(code: string, name?: string): string {
  switch (code) {
    case "too_large":
      return "Ảnh quá giới hạn 10 MB. Thầy/cô thu nhỏ ảnh rồi tải lại.";
    case "not_image":
      return name ? `Tệp “${name}” không phải ảnh PNG, JPG, WebP hay GIF.` : "Địa chỉ này không phải một ảnh PNG, JPG, WebP hay GIF.";
    case "invalid_url":
      return "Địa chỉ phải bắt đầu bằng https:// và trỏ tới một ảnh.";
    case "blocked_address":
    case "fetch_failed":
      return "Không lấy được ảnh từ địa chỉ này. Có thể đây là trang web chứ không phải ảnh (bấm chuột phải vào ảnh, chọn “Sao chép địa chỉ hình ảnh”), hoặc trang gốc chặn tải; khi đó thầy/cô lưu ảnh về máy rồi chọn “Tải ảnh từ máy”.";
    case "rate_limited":
      return "Thầy/cô đã tải nhiều ảnh trong ít phút. Chờ một lát rồi thử lại.";
    default:
      return "Chưa tải được ảnh. Thầy/cô thử lại.";
  }
}

/** Ô "Ảnh của thầy/cô" ở đầu lưới chọn: tải từ máy, kéo thả, dán Ctrl+V, dán địa chỉ (máy chủ tải về). */
function OwnImageTiles({ onImage }: { onImage: (c: SlotImageChange) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);

  const send = async (body: FormData | string, label: string, sourceUrl?: string) => {
    setBusy(label);
    setErr("");
    try {
      const res = await fetch(apiUrl("/api/instructor/limio-live/slot-image"), {
        method: "POST",
        ...(typeof body === "string" ? { headers: { "content-type": "application/json" }, body } : { body }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error ?? "upload_failed");
      // Ảnh mới thay ảnh cũ: bỏ mô tả, cách đặt, nguồn của ảnh trước.
      onImage({ imageUrl: j.url, imageAlt: undefined, imageFit: undefined, imageCredit: undefined, imageSourceUrl: sourceUrl });
      setUrl("");
      setUrlOpen(false);
    } catch (e) {
      setErr(slotImageError((e as Error).message, typeof body === "string" ? undefined : label));
    } finally {
      setBusy(null);
    }
  };
  const useFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!SLOT_IMAGE_TYPES.includes(f.type)) return setErr(slotImageError("not_image", f.name));
    if (f.size > SLOT_IMAGE_MAX) return setErr(slotImageError("too_large"));
    const form = new FormData();
    form.append("file", f, f.name);
    void send(form, f.name);
  };
  const useUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return setErr(slotImageError("invalid_url"));
    void send(JSON.stringify({ url: u }), u, u);
  };

  // Dán ảnh bằng Ctrl+V khi lưới đang mở (trừ lúc đang gõ trong ô nhập).
  const useFileRef = useRef(useFile);
  useFileRef.current = useFile;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable='true']")) return;
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (!f) return;
      e.preventDefault();
      useFileRef.current(f);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    useFile(e.dataTransfer.files?.[0]);
  };
  const tile = "grid gap-1 rounded-xl border p-1 text-center text-[11px] font-medium leading-tight transition";
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">Ảnh của thầy/cô</p>
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(76px,1fr))]">
        <button type="button" className={`${tile} border-token hover:border-brand-600`} onClick={() => fileRef.current?.click()} disabled={!!busy}>
          <span className="grid aspect-square w-full place-items-center rounded-lg bg-[rgb(var(--surface-muted))] text-brand-700">
            <Upload size={26} aria-hidden="true" />
          </span>
          <span>Tải ảnh từ máy</span>
        </button>
        <button
          type="button"
          aria-pressed={urlOpen}
          className={`${tile} ${urlOpen ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"}`}
          onClick={() => {
            setUrlOpen((v) => !v);
            setErr("");
          }}
          disabled={!!busy}
        >
          <span className="grid aspect-square w-full place-items-center rounded-lg bg-[rgb(var(--surface-muted))] text-brand-700">
            <Link2 size={26} aria-hidden="true" />
          </span>
          <span>Dán địa chỉ ảnh</span>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={SLOT_IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          useFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {urlOpen && (
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            className="input min-w-[200px] flex-1 text-sm"
            placeholder="https://… (địa chỉ của một ảnh)"
            value={url}
            autoFocus
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                useUrl();
              }
            }}
          />
          <button type="button" className="btn-primary text-sm" onClick={useUrl} disabled={!!busy || !url.trim()}>
            Dùng ảnh này
          </button>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed px-3 py-2 text-xs ${over ? "border-brand-600 bg-brand-50" : "border-token text-muted"}`}
      >
        {busy ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Đang tải ảnh và làm bản nhỏ…
          </span>
        ) : (
          "Hoặc kéo thả ảnh vào đây, hay dán ảnh bằng Ctrl+V. PNG, JPG, WebP, GIF; tối đa 10 MB. Máy chủ tự thu nhỏ ảnh."
        )}
      </div>
      {err && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {err}
        </p>
      )}
    </div>
  );
}

/** Mô tả ảnh, nguồn ảnh (khi ảnh lấy từ địa chỉ) và "Hiện trọn ảnh": chỉ hiện khi đã có ảnh riêng. */
function OwnImageOptions({ image, onImage }: { image: SlotImage; onImage: (c: SlotImageChange) => void }) {
  const [alt, setAlt] = useState(image.imageAlt ?? "");
  const [credit, setCredit] = useState(image.imageCredit ?? "");
  useEffect(() => {
    setAlt(image.imageAlt ?? "");
    setCredit(image.imageCredit ?? "");
  }, [image.imageUrl, image.imageAlt, image.imageCredit]);
  const id = useId();
  return (
    <div className="grid gap-2.5">
      <label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`${id}a`}>
        Mô tả ảnh (không bắt buộc)
        <input
          id={`${id}a`}
          className="input text-sm font-normal text-[rgb(var(--text))]"
          value={alt}
          maxLength={200}
          placeholder="Ví dụ: Sơ đồ ba bước xử lý dữ liệu"
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => alt.trim() !== (image.imageAlt ?? "") && onImage({ imageAlt: alt.trim() || undefined })}
        />
        <span className="font-normal text-faint">Giúp người dùng trình đọc màn hình, và hiện thay ảnh khi ảnh không tải được.</span>
      </label>
      {image.imageSourceUrl && (
        <label className="grid gap-1 text-xs font-semibold text-muted" htmlFor={`${id}c`}>
          Nguồn ảnh (không bắt buộc)
          <input
            id={`${id}c`}
            className="input text-sm font-normal text-[rgb(var(--text))]"
            value={credit}
            maxLength={120}
            placeholder="Ví dụ: Wikimedia Commons, tác giả…"
            onChange={(e) => setCredit(e.target.value)}
            onBlur={() => credit.trim() !== (image.imageCredit ?? "") && onImage({ imageCredit: credit.trim() || undefined })}
          />
          <span className="font-normal text-faint">Hiện thành dòng nhỏ dưới ô hình. Ảnh lấy từ {new URL(image.imageSourceUrl).hostname}.</span>
        </label>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-brand-600"
          checked={image.imageFit === "contain"}
          onChange={(e) => onImage({ imageFit: e.target.checked ? "contain" : undefined })}
        />
        <span>
          Hiện trọn ảnh, không cắt
          <span className="block text-xs text-faint">Nên bật cho sơ đồ, biểu đồ, ảnh chụp màn hình.</span>
        </span>
      </label>
    </div>
  );
}

/**
 * Hoa văn của một slide trong khung sửa: dòng gọn (hình đang dùng + nút Đổi), bấm mới mở lưới.
 * `value`: undefined = theo bài giảng, "none", mã hoa văn hoặc mã hình minh hoạ; `effective` là thứ slide đang
 * hiển thị, `inherited` là hoa văn slide nhận nếu theo bài giảng. `illustrations`: slide là Chữ và hình chưa có
 * ảnh, nên lưới có thêm nhóm "Hình minh hoạ" ở trên cùng. Hình do AI chọn hiện như giảng viên tự chọn.
 */
export function SlideMotifField({
  value,
  effective,
  inherited,
  illustrations = false,
  image,
  onImage,
  themeId,
  onChange,
}: {
  value: string | undefined;
  effective: SlideArtId | null;
  inherited: SlideArtId | null;
  illustrations?: boolean;
  /** Ảnh riêng đang dùng (bố cục Chữ và hình); có thì ô hình hiện ảnh, thắng hình minh hoạ và hoa văn. */
  image?: SlotImage | null;
  /** Có thì lưới có phần "Ảnh của thầy/cô" ở trên cùng. Chọn một ô hình/hoa văn thì nơi gọi bỏ ảnh. */
  onImage?: (c: SlotImageChange) => void;
  themeId?: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  // Hình minh hoạ chỉ có hiệu lực ở ô hình; ở bố cục khác coi như slide theo bài giảng (mã vẫn được giữ).
  const own: SlideArtId | null = isMotifId(value) || (illustrations && isSlideIllustrationId(value)) ? value : null;
  const status = image
    ? image.imageSourceUrl
      ? "Ảnh riêng (lấy từ địa chỉ)"
      : "Ảnh riêng của thầy/cô"
    : value === "none" ? "Không dùng cho slide này" : own ? `${slideArtLabel(own)} (riêng slide này)` : inherited ? `Theo bài giảng: ${slideArtLabel(inherited)}` : "Theo bài giảng (bài đang tắt hoa văn)";
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-xl border border-token p-2">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slideImageThumb(image.imageUrl)} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-black/10 object-cover" />
        ) : (
          <MotifSwatch motif={effective} themeId={themeId} className="h-11 w-11 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted">{illustrations ? "Hình ở ô hình" : "Hoa văn"}</p>
          <p className="truncate text-sm">{status}</p>
        </div>
        {image && onImage && (
          <button type="button" className="btn-secondary text-sm" onClick={() => onImage(null)}>
            Bỏ ảnh
          </button>
        )}
        <button type="button" className="btn-secondary text-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Xong" : "Đổi"}
        </button>
      </div>
      {image && onImage && <OwnImageOptions image={image} onImage={onImage} />}
      {open && onImage && <OwnImageTiles onImage={onImage} />}
      {open && illustrations && (
        <>
          <p className={`text-sm font-semibold ${onImage ? "border-t border-token pt-3" : ""}`}>Hình minh hoạ</p>
          {SLIDE_ILLUSTRATION_GROUPS.map((g) => (
            <div key={g.label} className="space-y-1">
              <p className="text-xs font-semibold text-muted">{g.label}</p>
              <Grid
                label={`Hình minh hoạ: ${g.label}`}
                options={g.ids.map((m) => ({ value: m as string | null, label: SLIDE_ILLUSTRATION_LABELS[m], motif: m }))}
                value={!image && own && isSlideIllustrationId(own) ? own : null}
                themeId={themeId}
                onPick={onChange}
              />
            </div>
          ))}
          <p className="border-t border-token pt-3 text-sm font-semibold">Hoa văn</p>
        </>
      )}
      {open && (
        <Grid
          label="Hoa văn của slide này"
          options={[
            { value: null, label: "Theo bài giảng", motif: inherited },
            ...SLIDE_MOTIFS.map((m) => ({ value: m as string | null, label: MOTIF_LABELS[m], motif: m })),
            { value: "none", label: "Không dùng", motif: null },
          ]}
          value={image ? "" : value === "none" ? "none" : own && isSlideIllustrationId(own) ? "" : own}
          themeId={themeId}
          onPick={onChange}
        />
      )}
    </div>
  );
}

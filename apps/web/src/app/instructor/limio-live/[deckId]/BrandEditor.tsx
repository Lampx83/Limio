"use client";

import { useMemo, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import {
  BRAND_BGS,
  BRAND_COLOR_SLOTS,
  BRAND_POSITIONS,
  BRAND_SIZES,
  BRAND_SHOWS,
  brandBackground,
  brandEffectiveThemeId,
  brandFrameBackground,
  brandPalette,
  extractLogoColors,
  isBrandColor,
  type BrandBg,
  type BrandColorSlot,
  type BrandColors,
  type BrandConfig,
  type BrandPosition,
  type BrandShow,
  type BrandSize,
} from "@/lib/limioLiveBrand";
import { LayoutSlideView } from "../SlideLayouts";
import { BrandLogoOverlay, LiveBrandProvider } from "../liveBrandContext";
import { isDarkTheme, slideBgFor } from "../slideThemes";

// Bộ phối màu gợi ý (chính, phụ, nhấn): bấm một bộ là đặt cả ba ô.
const PRESETS: ReadonlyArray<{ name: string; colors: Required<BrandColors> }> = [
  { name: "Lam và cam", colors: { primary: "#0A6EBD", secondary: "#0E7490", accent: "#F59E0B" } },
  { name: "Đỏ và vàng", colors: { primary: "#B91C1C", secondary: "#9A3412", accent: "#FACC15" } },
  { name: "Lục và lam", colors: { primary: "#047857", secondary: "#0F766E", accent: "#38BDF8" } },
  { name: "Tím và hồng", colors: { primary: "#6D28D9", secondary: "#BE185D", accent: "#F0ABFC" } },
  { name: "Than và cam", colors: { primary: "#27272A", secondary: "#52525B", accent: "#F97316" } },
  { name: "Xanh navy", colors: { primary: "#1E3A8A", secondary: "#1D4ED8", accent: "#7DD3FC" } },
];
const SLOT_LABEL: Record<BrandColorSlot, { name: string; hint: string }> = {
  primary: { name: "Màu chính", hint: "Tiêu đề nổi, biểu tượng, nút, thanh tiến độ" },
  secondary: { name: "Màu phụ", hint: "Điểm nhấn thứ hai, dải màu của chữ" },
  accent: { name: "Màu nhấn", hint: "Vầng sáng và điểm cuối dải màu" },
};
const BG_LABEL: Record<BrandBg, string> = { theme: "Theo giao diện", light: "Sáng xuyệt tông", dark: "Tối xuyệt tông" };

/** Đọc điểm ảnh của logo (thu nhỏ) để gợi ý màu; null nếu trình duyệt không đọc được ảnh. */
async function logoPixels(src: Blob): Promise<Uint8ClampedArray | null> {
  try {
    const bmp = await createImageBitmap(src);
    const k = Math.min(1, 96 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
}

const SLOT_ADJUST_NOTE: Record<BrandColorSlot, string> = { primary: "màu chính", secondary: "màu phụ", accent: "màu nhấn" };
const SIZE_LABEL: Record<BrandSize, string> = { s: "Nhỏ", m: "Vừa", l: "Lớn" };
const SHOW_LABEL: Record<BrandShow, string> = { all: "Mọi slide", nocover: "Trừ bìa", ends: "Bìa và tóm tắt" };
const POS_LABEL: Record<BrandPosition, string> = { tl: "Góc trên trái", tr: "Góc trên phải", bl: "Góc dưới trái", br: "Góc dưới phải" };
const POS_CLASS: Record<BrandPosition, string> = { tl: "left-1.5 top-1.5", tr: "right-1.5 top-1.5", bl: "bottom-1.5 left-1.5", br: "bottom-1.5 right-1.5" };

type SampleKey = "cover" | "cards" | "quiz" | "summary";
const SAMPLE_LABEL: Record<SampleKey, string> = { cover: "Bìa", cards: "Ba thẻ", quiz: "Trắc nghiệm", summary: "Tóm tắt" };
export const SAMPLE_CONFIG: Record<Exclude<SampleKey, "quiz">, Record<string, unknown>> = {
  cover: { layout: "cover", title: "Giới thiệu nền tảng giảng dạy tương tác", subtitle: "Một công cụ gom mọi hoạt động của buổi lên lớp.", byline: "" },
  cards: {
    layout: "cards",
    title: "Ba nhóm công cụ trong một nền tảng",
    items: [
      { heading: "Dạy trực tiếp", body: "Trình chiếu và cho học viên tham gia ngay trên điện thoại.", icon: "chat" },
      { heading: "Kiểm tra đánh giá", body: "Tổ chức ca thi, phòng thi và chấm điểm.", icon: "target" },
      { heading: "Theo dõi tiến bộ", body: "Xem kết quả từng học viên và gợi ý nội dung cần ôn.", icon: "chart" },
    ],
  },
  summary: {
    layout: "summary",
    title: "Những điều cần ghi nhớ",
    items: [{ heading: "Limio gom mọi công cụ về một nơi." }, { heading: "AI giúp soạn bài từ tài liệu có sẵn." }, { heading: "Kết quả buổi học được lưu để xem lại." }],
  },
};

type PreviewTheme = "current" | "light" | "dark";

const seg = (on: boolean) =>
  `px-3.5 py-1.5 text-sm ${on ? "bg-brand-soft font-bold shadow-[inset_0_0_0_1px_rgb(var(--brand-fill,101_163_13))]" : "bg-[rgb(var(--surface))] font-medium hover:bg-[rgb(var(--surface-muted))]"}`;

/** Cách lấy logo: bài giảng tự tải (own) hoặc cố định theo logo của trường (org, quản trị viên đặt ở mục Logo trường). */
export type BrandLogoSource =
  | { kind: "own"; uploading: boolean; onUpload: (file: File) => void }
  | { kind: "org"; url: string | null };

/**
 * Form thương hiệu dùng chung: logo, vị trí và cỡ, bảng màu 3 ô, nền xuyệt tông, kèm xem thử ngay. Không tự lưu:
 * nơi dùng giữ `draft` và nhận thay đổi qua `update`. Dùng ở hộp thoại Thương hiệu của bài giảng và trang cài đặt của trường.
 */
export default function BrandEditor({
  draft,
  update,
  themeId,
  logo,
  onClearAll,
  suggestSignal,
}: {
  draft: BrandConfig;
  update: (patch: Partial<BrandConfig>, immediate?: boolean) => void;
  themeId: string;
  logo: BrandLogoSource;
  /** Bấm "Gỡ toàn bộ thương hiệu" (nơi dùng quyết định gỡ những gì). */
  onClearAll: () => void;
  /** Tăng lên để yêu cầu gợi ý màu từ tệp logo vừa tải (nơi dùng gửi tệp qua suggestFromFile). */
  suggestSignal?: { file: File; n: number } | null;
}) {
  const [sample, setSample] = useState<SampleKey>("cards");
  const [pt, setPt] = useState<PreviewTheme>("current");
  // Ô nhập mã màu theo từng ô; chỉ áp khi gõ đủ mã hợp lệ.
  const [hex, setHex] = useState<Record<BrandColorSlot, string>>({
    primary: draft.colors?.primary ?? "",
    secondary: draft.colors?.secondary ?? "",
    accent: draft.colors?.accent ?? "",
  });
  // Bộ màu gợi ý lấy từ logo (chưa áp dụng cho tới khi người dùng bấm).
  const [suggest, setSuggest] = useState<string[] | null>(null);
  const uploading = logo.kind === "own" && logo.uploading;
  const logoUrl = logo.kind === "org" ? logo.url ?? undefined : draft.logoUrl;

  const suggestFrom = async (blob: Blob) => {
    const px = await logoPixels(blob);
    setSuggest(px ? extractLogoColors(px) : []);
  };
  // Nơi dùng tải xong logo mới thì gợi ý màu từ chính tệp đó.
  const [lastSignal, setLastSignal] = useState(0);
  if (suggestSignal && suggestSignal.n !== lastSignal) {
    setLastSignal(suggestSignal.n);
    void suggestFrom(suggestSignal.file);
  }

  const deckDark = isDarkTheme(themeId);
  const previewTheme = pt === "current" ? themeId : pt === "light" ? (deckDark ? "white" : themeId) : deckDark ? themeId : "night";
  const dark = isDarkTheme(brandEffectiveThemeId(draft.colors ? draft : null, previewTheme));
  const palette = useMemo(() => brandPalette(draft.colors, dark), [draft.colors, dark]);
  const shownBrand: BrandConfig | null = logoUrl || draft.colors ? { ...draft, ...(logoUrl ? { logoUrl } : {}) } : null;

  // Đặt một ô màu. Xoá màu chính thì xoá cả bảng (phụ và nhấn chỉ có nghĩa khi có màu chính).
  const setColor = (slot: BrandColorSlot, value: string | undefined, immediate = true) => {
    const cur = draft.colors;
    let next: BrandColors | undefined;
    if (slot === "primary") {
      next = value ? { ...cur, primary: value } : undefined;
    } else if (cur) {
      next = { ...cur, [slot]: value };
      if (!value) delete next[slot];
    }
    setHex((h) => (slot === "primary" && !value ? { primary: "", secondary: "", accent: "" } : { ...h, [slot]: value ?? "" }));
    // Bỏ màu chính là bỏ cả bảng màu, nền xuyệt tông cũng không còn nghĩa: về theo giao diện.
    update(slot === "primary" && !value ? { colors: undefined, bg: "theme" } : { colors: next }, immediate);
  };
  const applyPreset = (c: Required<BrandColors>) => {
    setHex({ primary: c.primary, secondary: c.secondary, accent: c.accent });
    update({ colors: { ...c } });
  };

  return (

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[360px_minmax(0,1fr)] md:grid-rows-1">
          <div className="px-4 pt-3 md:order-2 md:self-start md:py-4 md:pl-1 md:pr-5">
            <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Xem thử trên các slide">
              {(Object.keys(SAMPLE_LABEL) as SampleKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={sample === k}
                  onClick={() => setSample(k)}
                  className={`rounded-full border px-3 py-1 text-[13.5px] font-semibold ${sample === k ? "border-brand-600 bg-brand-soft text-[rgb(var(--text))]" : "border-token text-muted"}`}
                >
                  {SAMPLE_LABEL[k]}
                </button>
              ))}
              <span className="flex-1" />
              {(draft.bg === "theme" || !draft.colors) && (
                [
                  ["current", "Giao diện hiện tại"],
                  ["light", "Thử nền sáng"],
                  ["dark", "Thử nền tối"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={pt === k}
                  onClick={() => setPt(k)}
                  className={`rounded-full border px-3 py-1 text-[13.5px] font-semibold ${pt === k ? "border-brand-600 bg-brand-soft text-[rgb(var(--text))]" : "border-token text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <LiveBrandProvider brand={shownBrand}>
              <div
                className="relative flex aspect-video w-full overflow-hidden rounded-xl border border-black/10"
                style={{ background: brandFrameBackground(shownBrand, sample !== "quiz") ?? slideBgFor(previewTheme, sample !== "quiz") }}
              >
                {sample === "quiz" ? (
                  <div className="flex h-full w-full flex-col justify-center gap-3 p-[7%] text-[#20241F]">
                    <p className="text-[clamp(14px,2.4vw,26px)] font-extrabold leading-tight">Công cụ nào giúp thấy ngay học viên hiểu bài đến đâu?</p>
                    <div className="grid grid-cols-2 gap-2 text-[clamp(11px,1.5vw,16px)]">
                      {["Bình chọn nhanh", "Chép lại bài", "Đám mây từ", "Giờ nghỉ dài"].map((o, i) => (
                        <div key={o} className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/80 px-3 py-2">
                          <b className="grid h-6 w-6 place-items-center rounded-md bg-black/5 text-xs">{"ABCD"[i]}</b>
                          {o}
                        </div>
                      ))}
                    </div>
                    <BrandLogoOverlay role="other" />
                  </div>
                ) : (
                  <LayoutSlideView config={SAMPLE_CONFIG[sample]} themeId={previewTheme} />
                )}
              </div>
            </LiveBrandProvider>
            <p className="mt-2 text-[13px] text-faint">
              Xem thử trên nhiều slide để chắc logo và màu hợp ở mọi nơi. Logo chỉ hiện trên màn chiếu và bản xem trước, không hiện trên điện thoại học viên.
            </p>
          </div>

          <div className="min-h-0 space-y-6 overflow-y-auto border-token p-4 pb-8 md:order-1 md:border-r">
            <section aria-labelledby="brand-logo-h">
              <h3 id="brand-logo-h" className="mb-2 text-[15px] font-bold">Logo</h3>
              <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-token bg-[rgb(var(--surface-muted))] p-3">
                <div className="grid h-12 w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl border border-token bg-white">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={apiUrl(logoUrl)} alt="Logo đơn vị" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-faint">Chưa có</span>
                  )}
                </div>
                {logo.kind === "own" ? (
                  <>
                    <div className="min-w-0 flex-1 text-sm">
                      <b>{logoUrl ? "Đã có logo" : "Chưa có logo"}</b>
                      <small className="block text-xs text-faint">PNG, JPG hoặc WebP, tối đa 5 MB. Nên dùng nền trong suốt.</small>
                    </div>
                    <label className="btn-secondary h-8 cursor-pointer gap-1.5 !px-3 text-[13px]">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {logoUrl ? "Đổi" : "Tải lên"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) logo.onUpload(f);
                        }}
                      />
                    </label>
                    {logoUrl && (
                      <button type="button" className="btn-secondary h-8 !px-3 text-[13px]" onClick={() => update({ logoUrl: undefined })}>
                        Gỡ
                      </button>
                    )}
                  </>
                ) : (
                  <div className="min-w-0 flex-1 text-sm">
                    <b>{logoUrl ? "Logo của trường" : "Trường chưa có logo"}</b>
                    <small className="block text-xs text-faint">Logo do mục “Logo trường” quản lý; thay ở đó để áp cho mọi bài giảng.</small>
                  </div>
                )}
              </div>
            </section>

            {logoUrl && (
              <section aria-labelledby="brand-pos-h" className="space-y-4">
                <div>
                  <h3 id="brand-pos-h" className="mb-2 text-[15px] font-bold">Vị trí và cỡ</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative h-16 w-[108px] shrink-0 rounded-xl border border-token bg-[rgb(var(--surface-muted))]" role="group" aria-label="Vị trí logo">
                      {BRAND_POSITIONS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-label={POS_LABEL[p]}
                          aria-pressed={draft.logoPos === p}
                          onClick={() => update({ logoPos: p })}
                          className={`absolute h-[26px] w-[26px] rounded-lg border ${POS_CLASS[p]} ${draft.logoPos === p ? "border-brand-600 bg-brand-600" : "border-token bg-[rgb(var(--surface))]"}`}
                        />
                      ))}
                    </div>
                    <div className="inline-flex overflow-hidden rounded-xl border border-token" role="group" aria-label="Cỡ logo">
                      {BRAND_SIZES.map((s, i) => (
                        <button key={s} type="button" aria-pressed={draft.logoSize === s} onClick={() => update({ logoSize: s })} className={`${seg(draft.logoSize === s)} ${i ? "border-l border-token" : ""}`}>
                          {SIZE_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-[15px] font-bold">Hiện ở</h3>
                  <div className="inline-flex flex-wrap overflow-hidden rounded-xl border border-token" role="group" aria-label="Hiện logo ở">
                    {BRAND_SHOWS.map((s, i) => (
                      <button key={s} type="button" aria-pressed={draft.logoShow === s} onClick={() => update({ logoShow: s })} className={`${seg(draft.logoShow === s)} ${i ? "border-l border-token" : ""}`}>
                        {SHOW_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section aria-labelledby="brand-color-h">
              <h3 id="brand-color-h" className="mb-1 text-[15px] font-bold">Bảng màu thương hiệu</h3>
              <p className="mb-3 text-[13px] text-faint">
                Ba màu thay màu nhấn trên giao diện đang dùng; nền slide giữ nguyên. Chỉ cần đặt màu chính, hai màu còn lại tự sinh nếu để trống.
              </p>

              <div className="mb-4">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Bộ phối màu gợi ý</span>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Bộ phối màu gợi ý">
                  {PRESETS.map((pr) => {
                    const on = draft.colors?.primary === pr.colors.primary && draft.colors?.secondary === pr.colors.secondary && draft.colors?.accent === pr.colors.accent;
                    return (
                      <button
                        key={pr.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => applyPreset(pr.colors)}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-[13px] font-medium ${on ? "border-brand-600 bg-brand-soft ring-1 ring-brand-600" : "border-token hover:bg-[rgb(var(--surface-muted))]"}`}
                      >
                        <span className="flex shrink-0">
                          {[pr.colors.primary, pr.colors.secondary, pr.colors.accent].map((c, i) => (
                            <i key={i} className="-ml-1.5 block h-5 w-5 rounded-full border-2 border-[rgb(var(--surface))] first:ml-0" style={{ background: c }} />
                          ))}
                        </span>
                        {pr.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {logoUrl && (
                <div className="mb-4 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3">
                  <div className="flex items-center gap-2">
                    <b className="flex-1 text-[13px]">Màu lấy từ logo</b>
                    <button
                      type="button"
                      className="text-[13px] font-medium text-brand-700 hover:underline"
                      onClick={async () => {
                        try {
                          const r = await fetch(apiUrl(logoUrl!));
                          await suggestFrom(await r.blob());
                        } catch {
                          setSuggest([]);
                        }
                      }}
                    >
                      {suggest ? "Lấy lại" : "Gợi ý màu từ logo"}
                    </button>
                  </div>
                  {suggest && suggest.length > 0 && (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="flex" aria-label="Màu gợi ý từ logo">
                        {suggest.map((c, i) => (
                          <i key={c} className="-ml-1.5 block h-7 w-7 rounded-full border-2 border-[rgb(var(--surface))] first:ml-0" style={{ background: c }} title={c} aria-label={`${SLOT_LABEL[BRAND_COLOR_SLOTS[i]!].name} ${c}`} />
                        ))}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary h-8 !px-3 text-[13px]"
                        onClick={() => {
                          const [primary, secondary, accent] = suggest;
                          setHex({ primary: primary ?? "", secondary: secondary ?? "", accent: accent ?? "" });
                          update({ colors: { primary: primary!, ...(secondary ? { secondary } : {}), ...(accent ? { accent } : {}) } });
                        }}
                      >
                        Dùng bộ màu này
                      </button>
                    </div>
                  )}
                  {suggest && suggest.length === 0 && (
                    <p className="mt-1.5 text-[12.5px] text-faint">Chưa lấy được màu nổi bật từ logo này (logo có thể chỉ gồm nền trắng hoặc xám). Hãy chọn màu tay bên dưới.</p>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                {BRAND_COLOR_SLOTS.map((slot) => {
                  const value = draft.colors?.[slot];
                  const disabled = slot !== "primary" && !draft.colors;
                  return (
                    <div key={slot} className={`flex items-center gap-2 ${disabled ? "opacity-50" : ""}`}>
                      <input
                        type="color"
                        aria-label={`Chọn ${SLOT_LABEL[slot].name.toLowerCase()}`}
                        disabled={disabled}
                        value={value && isBrandColor(value) ? value.toLowerCase() : "#0a6ebd"}
                        onChange={(e) => setColor(slot, e.target.value.toUpperCase(), false)}
                        className="h-10 w-11 shrink-0 rounded-xl border border-token bg-[rgb(var(--surface))] p-0.5"
                      />
                      <div className="grid min-w-0 flex-1 leading-tight">
                        <b className="text-sm">{SLOT_LABEL[slot].name}</b>
                        <small className="truncate text-xs text-faint">{SLOT_LABEL[slot].hint}</small>
                      </div>
                      <input
                        type="text"
                        aria-label={`Mã ${SLOT_LABEL[slot].name.toLowerCase()}`}
                        placeholder={slot === "primary" ? "#0A6EBD" : "Tự động"}
                        maxLength={7}
                        disabled={disabled}
                        value={hex[slot]}
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          const v = raw && raw[0] !== "#" ? `#${raw}` : raw;
                          setHex((h) => ({ ...h, [slot]: v.toUpperCase() }));
                          if (isBrandColor(v)) setColor(slot, v.toUpperCase(), false);
                          else if (!v && slot !== "primary") setColor(slot, undefined, false);
                        }}
                        className="input h-9 w-[104px] shrink-0 uppercase tabular-nums"
                      />
                      {value && (
                        <button
                          type="button"
                          aria-label={slot === "primary" ? "Bỏ cả bảng màu" : `Bỏ ${SLOT_LABEL[slot].name.toLowerCase()} (tự động)`}
                          title={slot === "primary" ? "Bỏ cả bảng màu" : "Để tự động"}
                          onClick={() => setColor(slot, undefined)}
                          className="shrink-0 text-faint hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3">
                {palette ? (
                  <>
                    <div className="flex items-center gap-1.5" aria-label="Bảng màu sau khi chỉnh">
                      {[palette.sa, palette.sa2, palette.accent, palette.soft, palette.soft2].map((c, i) => (
                        <i key={i} className="block h-7 w-7 rounded-lg border border-black/10" style={{ background: c }} />
                      ))}
                    </div>
                    <p className={`mt-2 rounded-lg px-3 py-2 text-[13px] ${palette.adjusted.length ? "bg-amber-50 text-amber-900" : "text-faint"}`}>
                      {palette.adjusted.length
                        ? `Đã chỉnh ${palette.adjusted.map((k) => SLOT_ADJUST_NOTE[k]).join(" và ")} ${dark ? "sáng" : "đậm"} hơn một chút để chữ trên ${dark ? "nền tối" : "nền sáng"} vẫn dễ đọc.`
                        : "Các màu này đủ độ tương phản trên giao diện đang xem thử."}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-faint">Đang dùng màu nhấn của giao diện.</p>
                )}
              </div>
            </section>

            <section aria-labelledby="brand-bg-h" className={draft.colors ? "" : "opacity-60"}>
              <h3 id="brand-bg-h" className="mb-1 text-[15px] font-bold">Nền slide</h3>
              <p className="mb-2 text-[13px] text-faint">
                {draft.colors ? "Nền xuyệt tông lấy sắc độ từ bảng màu, nên toàn slide cùng một tông." : "Đặt màu chính để dùng nền xuyệt tông."}
              </p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Nền slide">
                {BRAND_BGS.map((m) => {
                  const on = (draft.colors ? draft.bg : "theme") === m;
                  const swatch = m === "theme" ? slideBgFor(themeId, true) : draft.colors ? brandBackground(draft.colors, m) : null;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={m !== "theme" && !draft.colors}
                      onClick={() => update({ bg: m })}
                      className={`grid gap-1 rounded-xl border p-1.5 text-center text-[12.5px] font-medium disabled:cursor-not-allowed ${on ? "border-brand-600 ring-1 ring-brand-600" : "border-token hover:border-brand-600"}`}
                    >
                      <span className="block h-9 w-full rounded-lg border border-black/10" style={{ background: swatch ?? "repeating-linear-gradient(45deg,#fff 0 5px,#e5e7eb 5px 10px)" }} />
                      <span>{BG_LABEL[m]}</span>
                    </button>
                  );
                })}
              </div>
              {draft.colors && draft.bg === "dark" && (
                <p className="mt-2 text-[12.5px] text-faint">
                  Nền tối chỉ áp cho slide bố cục; slide tương tác (trắc nghiệm, bình chọn, bảng) vẫn nền sáng để chữ đọc rõ.
                </p>
              )}
            </section>

            {(logoUrl || draft.colors) && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline"
                onClick={() => {
                  setHex({ primary: "", secondary: "", accent: "" });
                  onClearAll();
                }}
              >
                <X size={14} /> Gỡ toàn bộ thương hiệu
              </button>
            )}
          </div>
        </div>
  );
}

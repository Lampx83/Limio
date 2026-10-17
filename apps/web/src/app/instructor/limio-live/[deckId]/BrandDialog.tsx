"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Upload, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import {
  BRAND_POSITIONS,
  BRAND_SIZES,
  BRAND_SHOWS,
  DEFAULT_BRAND,
  brandPalette,
  isBrandColor,
  sanitizeBrand,
  type BrandConfig,
  type BrandPosition,
  type BrandShow,
  type BrandSize,
} from "@/lib/limioLiveBrand";
import { LayoutSlideView } from "../SlideLayouts";
import { BrandLogoOverlay, LiveBrandProvider } from "../liveBrandContext";
import { isDarkTheme, slideBgFor } from "../slideThemes";

const COLORS = ["#0A6EBD", "#B91C1C", "#0F766E", "#7C3AED", "#C2410C", "#1D4ED8", "#047857", "#BE185D"];
const SIZE_LABEL: Record<BrandSize, string> = { s: "Nhỏ", m: "Vừa", l: "Lớn" };
const SHOW_LABEL: Record<BrandShow, string> = { all: "Mọi slide", nocover: "Trừ bìa", ends: "Bìa và tóm tắt" };
const POS_LABEL: Record<BrandPosition, string> = { tl: "Góc trên trái", tr: "Góc trên phải", bl: "Góc dưới trái", br: "Góc dưới phải" };
const POS_CLASS: Record<BrandPosition, string> = { tl: "left-1.5 top-1.5", tr: "right-1.5 top-1.5", bl: "bottom-1.5 left-1.5", br: "bottom-1.5 right-1.5" };

type SampleKey = "cover" | "cards" | "quiz" | "summary";
const SAMPLE_LABEL: Record<SampleKey, string> = { cover: "Bìa", cards: "Ba thẻ", quiz: "Trắc nghiệm", summary: "Tóm tắt" };
const SAMPLE_CONFIG: Record<Exclude<SampleKey, "quiz">, Record<string, unknown>> = {
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

/** Hộp thoại Thương hiệu: logo + màu cho cả bài giảng; thay đổi tự lưu, xem thử ngay trên vài slide mẫu. */
export default function BrandDialog({
  brand,
  themeId,
  onChange,
  onClose,
}: {
  brand: unknown;
  themeId: string;
  /** Lưu thương hiệu (null = xoá hết). */
  onChange: (next: BrandConfig | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<BrandConfig>(() => sanitizeBrand(brand) ?? DEFAULT_BRAND);
  const [sample, setSample] = useState<SampleKey>("cards");
  const [pt, setPt] = useState<PreviewTheme>("current");
  const [uploading, setUploading] = useState(false);
  const [hexText, setHexText] = useState(draft.color ?? "");
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(draft);
  latest.current = draft;

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = latest.current;
    onChange(d.logoUrl || d.color ? d : null);
    setSaved(true);
  };
  const update = (patch: Partial<BrandConfig>, immediate = true) => {
    const next = { ...latest.current, ...patch } as BrandConfig;
    for (const k of Object.keys(patch) as Array<keyof BrandConfig>) if (patch[k] === undefined) delete next[k];
    latest.current = next;
    setDraft(next);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, immediate ? 120 : 600);
  };

  const uploadLogo = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return void toast.error("Logo quá lớn (tối đa 5 MB)");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl("/api/instructor/limio-live/brand-logo"), { method: "POST", body: fd });
      const j = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !j?.url) {
        toast.error(res.status === 415 ? "Chỉ nhận ảnh PNG, JPG hoặc WebP" : res.status === 413 ? "Logo quá lớn (tối đa 5 MB)" : "Tải logo thất bại");
        return;
      }
      update({ logoUrl: j.url });
    } catch {
      toast.error("Lỗi mạng khi tải logo");
    } finally {
      setUploading(false);
    }
  };

  const deckDark = isDarkTheme(themeId);
  const previewTheme = pt === "current" ? themeId : pt === "light" ? (deckDark ? "white" : themeId) : deckDark ? themeId : "night";
  const dark = isDarkTheme(previewTheme);
  const palette = useMemo(() => (draft.color ? brandPalette(draft.color, dark) : null), [draft.color, dark]);
  const shownBrand = draft.logoUrl || draft.color ? draft : null;

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="brand-dlg-title"
      onClose={() => {
        flush();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto h-[min(760px,94vh)] w-[min(1120px,96vw)] max-w-none overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50 max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-token px-4 py-3">
          <h2 id="brand-dlg-title" className="flex-1 text-lg font-bold">
            Thương hiệu của bài giảng
          </h2>
          <span className="text-[13px] text-faint" role="status">
            {saved ? "Đã lưu" : "Đang lưu..."}
          </span>
          <button type="button" className="btn-primary h-9" onClick={() => ref.current?.close()}>
            Xong
          </button>
        </div>

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
              {(
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
                style={{ background: slideBgFor(previewTheme, sample !== "quiz") }}
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
                  {draft.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={apiUrl(draft.logoUrl)} alt="Logo đơn vị" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-faint">Chưa có</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <b>{draft.logoUrl ? "Đã có logo" : "Chưa có logo"}</b>
                  <small className="block text-xs text-faint">PNG, JPG hoặc WebP, tối đa 5 MB. Nên dùng nền trong suốt.</small>
                </div>
                <label className="btn-secondary h-8 cursor-pointer gap-1.5 !px-3 text-[13px]">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {draft.logoUrl ? "Đổi" : "Tải lên"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void uploadLogo(f);
                    }}
                  />
                </label>
                {draft.logoUrl && (
                  <button type="button" className="btn-secondary h-8 !px-3 text-[13px]" onClick={() => update({ logoUrl: undefined })}>
                    Gỡ
                  </button>
                )}
              </div>
            </section>

            {draft.logoUrl && (
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
              <h3 id="brand-color-h" className="mb-1 text-[15px] font-bold">Màu thương hiệu</h3>
              <p className="mb-2 text-[13px] text-faint">
                Thay màu nhấn (tiêu đề nổi, biểu tượng, nút, thanh tiến độ) trên giao diện đang dùng; nền slide giữ nguyên.
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Màu gợi ý">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Màu ${c}`}
                    aria-pressed={draft.color === c}
                    onClick={() => {
                      setHexText(c);
                      update({ color: c });
                    }}
                    className={`h-8 w-8 rounded-full border-2 shadow-[inset_0_0_0_1px_rgb(0_0_0/.12)] ${draft.color === c ? "border-[rgb(var(--text))]" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
                <button
                  type="button"
                  aria-label="Không dùng màu thương hiệu"
                  title="Không dùng màu thương hiệu"
                  aria-pressed={!draft.color}
                  onClick={() => {
                    setHexText("");
                    update({ color: undefined });
                  }}
                  className={`h-8 w-8 rounded-full border-2 ${!draft.color ? "border-[rgb(var(--text))]" : "border-transparent"}`}
                  style={{ background: "repeating-linear-gradient(45deg,#fff 0 5px,#e5e7eb 5px 10px)" }}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Chọn màu"
                  value={draft.color && isBrandColor(draft.color) ? draft.color.toLowerCase() : "#0a6ebd"}
                  onChange={(e) => {
                    setHexText(e.target.value.toUpperCase());
                    update({ color: e.target.value.toUpperCase() }, false);
                  }}
                  className="h-10 w-11 rounded-xl border border-token bg-[rgb(var(--surface))] p-0.5"
                />
                <input
                  type="text"
                  aria-label="Mã màu"
                  placeholder="#0A6EBD"
                  maxLength={7}
                  value={hexText}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    const v = raw && raw[0] !== "#" ? `#${raw}` : raw;
                    setHexText(v.toUpperCase());
                    if (isBrandColor(v)) update({ color: v.toUpperCase() }, false);
                  }}
                  className="input w-32 uppercase tabular-nums"
                />
                {draft.color && (
                  <button type="button" className="btn-secondary h-8 !px-3 text-[13px]" onClick={() => { setHexText(""); update({ color: undefined }); }}>
                    Bỏ màu
                  </button>
                )}
              </div>
              <div className="mt-3">
                {palette ? (
                  <>
                    <div className="flex gap-1.5" aria-label="Bảng màu sinh từ màu đã chọn">
                      {[palette.sa, palette.sa2, palette.soft, palette.soft2].map((c, i) => (
                        <i key={i} className="block h-7 w-7 rounded-lg border border-black/10" style={{ background: c }} />
                      ))}
                    </div>
                    <p className={`mt-2 rounded-lg px-3 py-2 text-[13px] ${palette.adjusted ? "bg-amber-50 text-amber-900" : "text-faint"}`}>
                      {palette.adjusted
                        ? `Đã chỉnh màu ${dark ? "sáng" : "đậm"} hơn một chút để chữ trên ${dark ? "nền tối" : "nền sáng"} vẫn dễ đọc.`
                        : "Màu này đủ độ tương phản trên giao diện đang xem thử."}
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-faint">Đang dùng màu nhấn của giao diện.</p>
                )}
              </div>
            </section>

            {(draft.logoUrl || draft.color) && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-red-700 hover:underline"
                onClick={() => {
                  setHexText("");
                  latest.current = DEFAULT_BRAND;
                  setDraft(DEFAULT_BRAND);
                  setSaved(false);
                  flush();
                }}
              >
                <X size={14} /> Gỡ toàn bộ thương hiệu
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

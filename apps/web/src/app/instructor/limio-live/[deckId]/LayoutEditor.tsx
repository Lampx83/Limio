"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import {
  ITEM_RANGE,
  LAYOUT_META,
  MAX_LEN,
  SLIDE_ICONS,
  SLIDE_LAYOUTS,
  convertLayoutConfig,
  layoutTextProblems,
  padForEditing,
  pickMeta,
  resolveLayout,
  sanitizeLayoutConfig,
  type LayoutColumn,
  type LayoutItem,
  type SlideLayoutId,
} from "@/lib/limioLiveSlides";
import { LayoutSlideView } from "../SlideLayouts";
import { slideBgFor } from "../slideThemes";

type Cfg = Record<string, any>;
type Save = (patch: { config: Cfg }) => void;

const ICON_LABELS: Record<(typeof SLIDE_ICONS)[number], string> = {
  target: "Mục tiêu",
  compass: "La bàn",
  route: "Lộ trình",
  chat: "Trao đổi",
  book: "Sách",
  sparkle: "Ý tưởng",
  users: "Nhóm",
  chart: "Biểu đồ",
};

/** Giữ ghi chú giảng và các khoá không thuộc bố cục khi lưu. */
const keepExtras = (config: Cfg): Cfg => pickMeta(config);

/** Chọn bố cục: đổi bố cục mang theo nội dung đang có (xem convertLayoutConfig). */
export function LayoutPicker({
  config,
  onSave,
  draft,
}: {
  config: Cfg;
  onSave: Save;
  /** Nội dung đang gõ dở (chưa lưu) để mang sang bố cục mới; mặc định lấy từ config đã lưu. */
  draft?: Cfg;
}) {
  const current = resolveLayout(config);
  const change = (to: SlideLayoutId) => {
    if (to === current) return;
    onSave({ config: { ...convertLayoutConfig(draft ?? config, to), ...keepExtras(config) } });
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Bố cục slide">
      <span className="mr-1 text-xs font-semibold text-muted">Bố cục</span>
      {SLIDE_LAYOUTS.map((l) => (
        <button
          key={l}
          type="button"
          title={LAYOUT_META[l].hint}
          aria-pressed={l === current}
          onClick={() => change(l)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
            l === current
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-token text-muted hover:border-brand-300 hover:text-[rgb(var(--text))]"
          }`}
        >
          {LAYOUT_META[l].label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  max,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  max: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  const near = value.length > max * 0.85;
  return (
    <label className="block">
      <span className="mb-0.5 flex items-center justify-between text-xs font-semibold text-muted">
        {label}
        {near && (
          <span className={value.length >= max ? "text-red-600" : "text-amber-700"}>
            {value.length}/{max}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          value={value}
          maxLength={max}
          rows={2}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="input w-full text-sm"
        />
      ) : (
        <input
          value={value}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="input w-full text-sm"
        />
      )}
    </label>
  );
}

export default function LayoutEditor({
  config,
  themeId,
  onSave,
}: {
  config: Cfg;
  themeId?: string | null;
  onSave: Save;
}) {
  const layout = resolveLayout(config);
  const [d, setD] = useState<Cfg>(() => padForEditing(layout, config));
  const range = ITEM_RANGE[layout];

  const commit = (next: Cfg = d) => onSave({ config: { ...sanitizeLayoutConfig(layout, next), ...keepExtras(config) } });
  const set = (patch: Cfg) => setD((prev) => ({ ...prev, ...patch }));
  const blur = () => commit();

  // Xem trước đúng như sẽ lưu: mục còn trống không hiện.
  const preview = useMemo(() => sanitizeLayoutConfig(layout, d), [layout, d]);
  const problems = useMemo(() => layoutTextProblems(layout, preview), [layout, preview]);

  const items: LayoutItem[] = d.items ?? [];
  const setItem = (i: number, patch: Partial<LayoutItem>) =>
    set({ items: items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const columns: LayoutColumn[] = d.columns ?? [];
  const setCol = (i: number, patch: Partial<LayoutColumn>) =>
    set({ columns: columns.map((c, k) => (k === i ? { ...c, ...patch } : c)) });

  return (
    <div className="flex w-full flex-col gap-4">
      <LayoutPicker config={config} onSave={onSave} draft={preview} />

      {/* Xem trước đúng như lúc trình chiếu */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl border border-black/10 shadow-sm"
        style={{ background: slideBgFor(themeId, true) }}
      >
        <div className="absolute inset-0 flex">
          <LayoutSlideView config={preview} themeId={themeId} />
        </div>
      </div>

      {problems.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Slide này dài ({problems.join(", ")}): chữ đã tự thu nhỏ đến mức nhỏ nhất vẫn dễ đọc. Hãy viết ngắn lại hoặc
            tách thành hai slide.
          </span>
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {layout !== "quote" && (
          <div className="md:col-span-2">
            <Field
              label="Tiêu đề"
              value={d.title ?? ""}
              max={MAX_LEN.title}
              onChange={(v) => set({ title: v })}
              onBlur={blur}
            />
          </div>
        )}

        {(layout === "cover" || layout === "section") && (
          <div className="md:col-span-2">
            <Field
              label={layout === "cover" ? "Mô tả ngắn" : "Câu dẫn"}
              value={d.subtitle ?? ""}
              max={MAX_LEN.subtitle}
              multiline
              onChange={(v) => set({ subtitle: v })}
              onBlur={blur}
            />
          </div>
        )}
        {layout === "cover" && (
          <div className="md:col-span-2">
            <Field
              label="Giảng viên và lớp"
              value={d.byline ?? ""}
              max={MAX_LEN.byline}
              placeholder="Giảng viên: Nguyễn Văn A · Lớp K66"
              onChange={(v) => set({ byline: v })}
              onBlur={blur}
            />
          </div>
        )}
        {layout === "section" && (
          <Field
            label="Số mục"
            value={d.sectionNumber ?? ""}
            max={MAX_LEN.sectionNumber}
            onChange={(v) => set({ sectionNumber: v })}
            onBlur={blur}
          />
        )}

        {layout === "image" && (
          <>
            {(d.bullets as string[]).map((b, i) => (
              <div key={i} className="md:col-span-2">
                <Field
                  label={`Ý ${i + 1}`}
                  value={b}
                  max={MAX_LEN.bullet}
                  onChange={(v) => set({ bullets: (d.bullets as string[]).map((x, k) => (k === i ? v : x)) })}
                  onBlur={blur}
                />
              </div>
            ))}
            <div className="md:col-span-2">
              <Field
                label="Địa chỉ ảnh (để trống thì dùng hình minh hoạ mặc định)"
                value={d.imageUrl ?? ""}
                max={2000}
                onChange={(v) => set({ imageUrl: v })}
                onBlur={blur}
              />
            </div>
          </>
        )}

        {range &&
          items.map((it, i) => (
            <div key={i} className="rounded-xl border border-token p-3 md:col-span-2">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                <span>
                  {layout === "steps" ? "Bước" : layout === "cards" ? "Thẻ" : layout === "stats" ? "Số liệu" : "Dòng"}{" "}
                  {i + 1}
                </span>
                {items.length > range.min && (
                  <button
                    type="button"
                    aria-label="Xoá mục này"
                    className="text-faint hover:text-red-600"
                    onClick={() => {
                      const next = items.filter((_, k) => k !== i);
                      set({ items: next });
                      commit({ ...d, items: next });
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label={layout === "stats" ? "Con số" : layout === "summary" ? "Nội dung" : "Tiêu đề"}
                  value={it.heading}
                  max={layout === "stats" ? MAX_LEN.statValue : layout === "summary" ? MAX_LEN.itemBody : MAX_LEN.itemHeading}
                  onChange={(v) => setItem(i, { heading: v })}
                  onBlur={blur}
                />
                {layout === "cards" && (
                  <label className="block">
                    <span className="mb-0.5 block text-xs font-semibold text-muted">Biểu tượng</span>
                    <select
                      className="input w-full text-sm"
                      value={it.icon ?? "target"}
                      onChange={(e) => {
                        const next = items.map((x, k) => (k === i ? { ...x, icon: e.target.value as LayoutItem["icon"] } : x));
                        set({ items: next });
                        commit({ ...d, items: next });
                      }}
                    >
                      {SLIDE_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ICON_LABELS[ic]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {layout !== "summary" && (
                  <div className="md:col-span-2">
                    <Field
                      label="Câu giải thích"
                      value={it.body}
                      max={MAX_LEN.itemBody}
                      multiline
                      onChange={(v) => setItem(i, { body: v })}
                      onBlur={blur}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

        {range && items.length < range.max && (
          <button
            type="button"
            className="flex w-fit items-center gap-1 text-xs font-medium text-brand-700 hover:underline md:col-span-2"
            onClick={() => set({ items: [...items, { heading: "", body: "" }] })}
          >
            <Plus size={14} /> Thêm {layout === "steps" ? "bước" : layout === "cards" ? "thẻ" : layout === "stats" ? "số liệu" : "dòng"}
          </button>
        )}

        {layout === "steps" && (
          <div className="md:col-span-2">
            <Field
              label="Dòng cuối (tuỳ chọn)"
              value={d.footnote ?? ""}
              max={MAX_LEN.footnote}
              placeholder="Vòng lặp được lặp lại sau mỗi bài tập."
              onChange={(v) => set({ footnote: v })}
              onBlur={blur}
            />
          </div>
        )}

        {layout === "compare" &&
          columns.map((col, i) => (
            <div key={i} className="rounded-xl border border-token p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                <span>Cột {i + 1}</span>
                <select
                  className="input py-0.5 text-xs"
                  value={col.tone}
                  onChange={(e) => {
                    const next = columns.map((c, k) => (k === i ? { ...c, tone: e.target.value as LayoutColumn["tone"] } : c));
                    set({ columns: next });
                    commit({ ...d, columns: next });
                  }}
                >
                  <option value="bad">Cách chưa tốt</option>
                  <option value="good">Cách tốt</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Field
                  label="Tên cột"
                  value={col.heading}
                  max={MAX_LEN.columnHeading}
                  onChange={(v) => setCol(i, { heading: v })}
                  onBlur={blur}
                />
                {col.points.map((p, k) => (
                  <Field
                    key={k}
                    label={`Ví dụ ${k + 1}`}
                    value={p}
                    max={MAX_LEN.columnPoint}
                    multiline
                    onChange={(v) => setCol(i, { points: col.points.map((x, j) => (j === k ? v : x)) })}
                    onBlur={blur}
                  />
                ))}
                {col.points.length < 3 && (
                  <button
                    type="button"
                    className="flex w-fit items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                    onClick={() => setCol(i, { points: [...col.points, ""] })}
                  >
                    <Plus size={14} /> Thêm ví dụ
                  </button>
                )}
                <Field
                  label="Nhận xét cuối cột"
                  value={col.note}
                  max={MAX_LEN.columnNote}
                  onChange={(v) => setCol(i, { note: v })}
                  onBlur={blur}
                />
              </div>
            </div>
          ))}

        {layout === "quote" && (
          <>
            <div className="md:col-span-2">
              <Field
                label="Câu trích dẫn"
                value={d.quote ?? ""}
                max={MAX_LEN.quote}
                multiline
                onChange={(v) => set({ quote: v })}
                onBlur={blur}
              />
            </div>
            <div className="md:col-span-2">
              <Field
                label="Nguồn hoặc thông điệp"
                value={d.source ?? ""}
                max={MAX_LEN.source}
                onChange={(v) => set({ source: v })}
                onBlur={blur}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

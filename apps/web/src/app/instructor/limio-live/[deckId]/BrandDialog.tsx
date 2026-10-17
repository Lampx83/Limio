"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import {
  DEFAULT_BRAND,
  applyBrandTemplate,
  orgBrandConfig,
  sanitizeBrand,
  sanitizeOrgBrandSettings,
  type BrandConfig,
} from "@/lib/limioLiveBrand";
import type { DeckOrgBrand } from "@/lib/limioLiveBrandServer";
import BrandEditor from "./BrandEditor";
import BrandTemplateGallery from "./BrandTemplateGallery";
import { useBrandDraft } from "./useBrandDraft";

type Mode = "org" | "custom" | "none";

/** Phần thương hiệu của bài giảng thay đổi qua hộp thoại; nơi dùng gộp vào bài và lưu. */
export interface BrandPatch {
  brand?: BrandConfig | null;
  brandOff?: boolean;
  brandTemplate?: string | null;
}

/**
 * Hộp thoại Thương hiệu của bài giảng. Ba chế độ: dùng thương hiệu của trường (chọn mẫu phối màu), riêng cho bài này
 * (logo + bảng màu + nền tự đặt), hoặc không dùng. Trường chưa có bộ thương hiệu thì chỉ có "riêng" và "không dùng".
 * Thay đổi tự lưu.
 */
export default function BrandDialog({
  brand,
  brandOff,
  brandTemplate,
  org,
  themeId,
  onChange,
  onClose,
}: {
  brand: unknown;
  brandOff: boolean;
  brandTemplate: string | null;
  org: DeckOrgBrand | null;
  themeId: string;
  onChange: (patch: BrandPatch) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const orgBrand = orgBrandConfig(org?.slideBrand, org?.logoUrl);
  const hasOrg = !!orgBrand;
  const own = sanitizeBrand(brand);
  const [mode, setMode] = useState<Mode>(brandOff ? "none" : own ? "custom" : hasOrg ? "org" : "custom");
  const [uploading, setUploading] = useState(false);
  const [signal, setSignal] = useState<{ file: File; n: number } | null>(null);
  // Mẫu đang chọn cho bài: giữ cục bộ để đổi là thấy ngay (nơi dùng cập nhật sau khi lưu).
  const orgDefault = sanitizeOrgBrandSettings(org?.slideBrand)?.defaultTemplate ?? "default";
  const [tpl, setTpl] = useState(brandTemplate ?? orgDefault);

  const { draft, update, flush, replace, saved } = useBrandDraft(own ?? DEFAULT_BRAND, (b) => {
    onChange({ brand: b.logoUrl || b.colors ? b : null, brandOff: false });
  });

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === "org") {
      onChange({ brandOff: false, brand: null });
    } else if (next === "custom") {
      // Lần đầu chuyển sang riêng: lấy thương hiệu của trường (đúng mẫu đang chọn) làm điểm xuất phát để chỉnh.
      if (!draft.logoUrl && !draft.colors && orgBrand) replace({ ...applyBrandTemplate(orgBrand, tpl) });
      else onChange({ brandOff: false, brand: draft.logoUrl || draft.colors ? draft : null });
    } else {
      onChange({ brandOff: true });
    }
    setMode(next);
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
      setSignal((s) => ({ file, n: (s?.n ?? 0) + 1 }));
    } catch {
      toast.error("Lỗi mạng khi tải logo");
    } finally {
      setUploading(false);
    }
  };

  const modes: Array<{ id: Mode; label: string }> = [
    ...(hasOrg ? [{ id: "org" as const, label: `Của ${org?.name ?? "trường"}` }] : []),
    { id: "custom", label: "Riêng cho bài này" },
    { id: "none", label: "Không dùng" },
  ];

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="brand-dlg-title"
      onClose={() => {
        if (mode === "custom") flush();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto h-[min(760px,94vh)] w-[min(1120px,96vw)] max-w-none overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50 max-sm:m-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-screen max-sm:rounded-none max-sm:border-0"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-token px-4 py-3">
          <h2 id="brand-dlg-title" className="text-lg font-bold">
            Thương hiệu của bài giảng
          </h2>
          <div className="inline-flex overflow-hidden rounded-xl border border-token" role="radiogroup" aria-label="Nguồn thương hiệu">
            {modes.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => switchMode(m.id)}
                className={`px-3.5 py-1.5 text-sm ${i ? "border-l border-token" : ""} ${mode === m.id ? "bg-brand-soft font-bold" : "bg-[rgb(var(--surface))] font-medium hover:bg-[rgb(var(--surface-muted))]"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className="flex-1" />
          <span className="text-[13px] text-faint" role="status">
            {mode === "custom" && !saved ? "Đang lưu..." : "Đã lưu"}
          </span>
          <button type="button" className="btn-primary h-9" onClick={() => ref.current?.close()}>
            Xong
          </button>
        </div>

        {mode === "custom" && (
          <BrandEditor
            draft={draft}
            update={update}
            themeId={themeId}
            logo={{ kind: "own", uploading, onUpload: (f) => void uploadLogo(f) }}
            onClearAll={() => replace(DEFAULT_BRAND)}
            suggestSignal={signal}
          />
        )}

        {mode === "org" && orgBrand && (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <BrandTemplateGallery
              orgBrand={orgBrand}
              themeId={themeId}
              selectedId={tpl}
              onSelect={(id) => {
                setTpl(id);
                // Mẫu trùng mặc định của trường thì không cần lưu riêng: bài theo mặc định, sau này admin đổi mặc định bài tự theo.
                onChange({ brandOff: false, brand: null, brandTemplate: id === orgDefault ? null : id });
              }}
            />
          </div>
        )}

        {mode === "none" && (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div className="max-w-md">
              <p className="text-[15px] font-bold">Bài giảng này không dùng thương hiệu</p>
              <p className="mt-1 text-sm text-muted">Slide hiển thị đúng theo giao diện đã chọn, không logo, không màu thương hiệu.</p>
            </div>
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  );
}

"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { DEFAULT_BRAND, orgBrandConfig, sanitizeOrgBrandSettings, type BrandConfig } from "@/lib/limioLiveBrand";
import BrandEditor from "@/app/instructor/limio-live/[deckId]/BrandEditor";
import BrandTemplateGallery from "@/app/instructor/limio-live/[deckId]/BrandTemplateGallery";

/**
 * Thương hiệu của trường cho slide Limio-Live: màu, nền, vị trí/cỡ/chỗ hiện logo. Logo lấy từ mục "Logo trường" ở trên.
 * Mọi giảng viên của trường dùng bộ này cho bài giảng chưa có thương hiệu riêng, và chọn một trong các mẫu phối màu
 * tự sinh từ màu của trường. Lưu bằng nút (ảnh hưởng nhiều người nên không tự lưu).
 */
export default function OrgBrandSettings({
  organizationId,
  orgName,
  logoUrl,
  initialSettings,
}: {
  organizationId: string;
  orgName: string;
  logoUrl: string | null;
  initialSettings: unknown;
}) {
  const initial = sanitizeOrgBrandSettings(initialSettings);
  const [draft, setDraft] = useState<BrandConfig>(() => {
    const { defaultTemplate: _t, ...rest } = initial ?? { ...DEFAULT_BRAND, defaultTemplate: undefined };
    void _t;
    return { ...DEFAULT_BRAND, ...rest };
  });
  const [defaultTemplate, setDefaultTemplate] = useState(initial?.defaultTemplate ?? "default");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const update = (patch: Partial<BrandConfig>) => {
    setDraft((d) => {
      const next = { ...d, ...patch } as BrandConfig;
      for (const k of Object.keys(patch) as Array<keyof BrandConfig>) if (patch[k] === undefined) delete next[k];
      return next;
    });
    setDirty(true);
  };

  const body = () => {
    const { logoUrl: _l, ...settings } = draft;
    void _l;
    return { ...settings, ...(draft.colors && defaultTemplate !== "default" ? { defaultTemplate } : {}) };
  };

  const save = async (brand: unknown) => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/orgs/${organizationId}/brand`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand }),
      });
      if (!res.ok) {
        toast.error(res.status === 403 ? "Bạn không có quyền sửa thương hiệu của trường" : "Lưu thương hiệu thất bại");
        return false;
      }
      setDirty(false);
      toast.success("Đã lưu thương hiệu của trường");
      return true;
    } catch {
      toast.error("Lỗi mạng");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm(`Gỡ toàn bộ thương hiệu của ${orgName}? Giảng viên của trường sẽ không còn nhận bộ màu này cho bài giảng của họ.`)) return;
    if (await save(null)) {
      setDraft(DEFAULT_BRAND);
      setDefaultTemplate("default");
      setEditorKey((k) => k + 1);
    }
  };

  const shown = orgBrandConfig({ ...draft, defaultTemplate }, logoUrl) ?? { ...DEFAULT_BRAND, ...(logoUrl ? { logoUrl } : {}) };

  return (
    <section className="card p-5" aria-labelledby="org-brand-h">
      <h2 id="org-brand-h" className="text-lg font-semibold">
        Thương hiệu cho bài giảng Limio-Live
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Giảng viên của <strong>{orgName}</strong> tự dùng bộ này cho bài giảng của họ: logo trường (ở mục trên), bảng màu và kiểu nền. Giảng
        viên vẫn chọn được mẫu phối màu khác cho từng bài, hoặc tự đặt riêng nếu cần.
      </p>

      <div className="mt-4 flex h-[640px] flex-col overflow-hidden rounded-2xl border border-token">
        <BrandEditor
          key={editorKey}
          draft={draft}
          update={update}
          themeId="white"
          logo={{ kind: "org", url: logoUrl }}
          onClearAll={() => void clearAll()}
        />
      </div>

      {draft.colors && (
        <div className="mt-5">
          <h3 className="text-[15px] font-bold">Mẫu mặc định cho giảng viên</h3>
          <p className="mb-3 mt-0.5 max-w-3xl text-sm text-muted">
            Các mẫu dưới đây tự sinh từ màu của trường (đảo vai trò màu chính/phụ, nền sáng hoặc tối, đơn sắc). Mẫu bạn chọn là mặc định cho bài
            giảng mới; giảng viên vẫn đổi sang mẫu khác cho từng bài.
          </p>
          <BrandTemplateGallery
            orgBrand={shown}
            themeId="white"
            selectedId={defaultTemplate}
            onSelect={(id) => {
              setDefaultTemplate(id);
              setDirty(true);
            }}
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          disabled={!dirty || saving}
          onClick={() => void save(draft.colors || draft.logoPos !== DEFAULT_BRAND.logoPos || draft.logoSize !== DEFAULT_BRAND.logoSize || draft.logoShow !== DEFAULT_BRAND.logoShow ? body() : null)}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Lưu thương hiệu của trường
        </button>
        <span className="text-sm text-muted" role="status">
          {dirty ? "Có thay đổi chưa lưu" : "Đã lưu"}
        </span>
        {!logoUrl && <span className="text-sm text-amber-800">Trường chưa có logo: tải ở mục “Logo trường” phía trên để logo hiện trên slide.</span>}
      </div>
    </section>
  );
}

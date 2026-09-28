"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function OrgSettingsClient({
  organizationId,
  initialName,
  initialLogoUrl,
  initialSignatureUrl,
  initialSignatureName,
  initialSignatureTitle,
}: {
  organizationId: string;
  initialName: string;
  initialLogoUrl: string | null;
  initialSignatureUrl: string | null;
  initialSignatureName: string | null;
  initialSignatureTitle: string | null;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(initialSignatureUrl);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [savingName, setSavingName] = useState(false);
  const [signatureName, setSignatureName] = useState(initialSignatureName ?? "");
  const [signatureTitle, setSignatureTitle] = useState(initialSignatureTitle ?? "");
  const [savedSignatureName, setSavedSignatureName] = useState(initialSignatureName ?? "");
  const [savedSignatureTitle, setSavedSignatureTitle] = useState(initialSignatureTitle ?? "");
  const [savingSignatureMeta, setSavingSignatureMeta] = useState(false);
  const signatureMetaDirty =
    signatureName !== savedSignatureName || signatureTitle !== savedSignatureTitle;

  async function saveSignatureMeta() {
    setSavingSignatureMeta(true);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/signature`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: signatureName.trim(), title: signatureTitle.trim() }),
    });
    setSavingSignatureMeta(false);
    if (res.ok) {
      setSavedSignatureName(signatureName.trim());
      setSavedSignatureTitle(signatureTitle.trim());
      setSignatureName(signatureName.trim());
      setSignatureTitle(signatureTitle.trim());
      toast.success("Đã lưu tên/chức danh người ký");
      router.refresh();
    } else {
      toast.error("Lưu thất bại");
    }
  }

  async function onSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Tên trường không được để trống");
      return;
    }
    setSavingName(true);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/name`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSavingName(false);
    if (res.ok) {
      const data = (await res.json()) as { name: string };
      setName(data.name);
      toast.success("Đã cập nhật tên trường");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Cập nhật tên thất bại", {
        description: typeof data?.error === "string" ? data.error : undefined,
      });
    }
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Ảnh quá lớn", { description: "Tối đa 5 MB. Vui lòng nén hoặc chọn ảnh khác." });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ", { description: "Chỉ chấp nhận JPG, PNG, WebP hoặc GIF." });
      return;
    }

    setUploadingLogo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/logo`), {
      method: "POST",
      body: fd,
    });
    setUploadingLogo(false);
    if (res.ok) {
      const data = (await res.json()) as { brandingLogoUrl: string };
      setLogoUrl(data.brandingLogoUrl);
      toast.success("Đã cập nhật logo trường");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Tải logo thất bại", {
        description: typeof data?.error === "string" ? data.error : undefined,
      });
    }
  }

  async function onLogoRemove() {
    if (!logoUrl) return;
    if (!confirm("Xoá logo hiện tại của trường?")) return;
    setUploadingLogo(true);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/logo`), { method: "DELETE" });
    setUploadingLogo(false);
    if (res.ok) {
      setLogoUrl(null);
      toast.success("Đã xoá logo trường");
      router.refresh();
    } else {
      toast.error("Xoá thất bại");
    }
  }

  async function onSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Ảnh quá lớn", { description: "Tối đa 5 MB. Vui lòng nén hoặc chọn ảnh khác." });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ", { description: "Chỉ chấp nhận JPG, PNG, WebP hoặc GIF." });
      return;
    }

    setUploadingSignature(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/signature`), {
      method: "POST",
      body: fd,
    });
    setUploadingSignature(false);
    if (res.ok) {
      const data = (await res.json()) as { signatureImageUrl: string };
      setSignatureUrl(data.signatureImageUrl);
      toast.success("Đã cập nhật chữ ký người đại diện");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Tải ảnh chữ ký thất bại", {
        description: typeof data?.error === "string" ? data.error : undefined,
      });
    }
  }

  async function onSignatureRemove() {
    if (!signatureUrl) return;
    if (!confirm("Xoá ảnh chữ ký hiện tại?")) return;
    setUploadingSignature(true);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/signature`), { method: "DELETE" });
    setUploadingSignature(false);
    if (res.ok) {
      setSignatureUrl(null);
      toast.success("Đã xoá ảnh chữ ký");
      router.refresh();
    } else {
      toast.error("Xoá thất bại");
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-base font-semibold">Tên trường</h2>
        <p className="mt-0.5 text-xs text-muted">
          Hiển thị trên chứng nhận hoàn thành khoá học (&quot;Limio × Tên trường&quot;).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="input w-64 max-w-full"
            placeholder="Tên trường"
          />
          <button
            type="button"
            onClick={onSaveName}
            disabled={savingName || name.trim() === initialName}
            className="btn-secondary btn-sm"
          >
            Lưu
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Logo trường</h2>
        <p className="mt-0.5 text-xs text-muted">
          Hiển thị cạnh logo Limio ở đầu chứng nhận hoàn thành khoá học.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface-muted))]">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Logo trường"
                className="h-full w-full rounded-lg object-contain p-2"
              />
            ) : (
              <span className="text-xs text-faint">Chưa có</span>
            )}
            {uploadingLogo && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-[10px] font-medium text-white">
                Đang tải...
              </div>
            )}
          </div>

          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onLogoChange}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="btn-secondary btn-sm"
              >
                {logoUrl ? "Đổi logo" : "Tải logo lên"}
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={onLogoRemove}
                  disabled={uploadingLogo}
                  className="btn-ghost btn-sm text-danger-700 hover:bg-danger-50"
                >
                  Xoá
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-faint">JPG, PNG, WebP hoặc GIF. Tối đa 5 MB.</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold">Chữ ký người đại diện</h2>
        <p className="mt-0.5 text-xs text-muted">
          Hiện trên chứng nhận hoàn thành khoá học, cạnh chữ ký Limio.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative flex h-16 w-32 shrink-0 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface-muted))]">
            {signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signatureUrl}
                alt="Chữ ký người đại diện"
                className="h-full w-full rounded-lg object-contain p-2"
              />
            ) : (
              <span className="text-xs text-faint">Chưa có</span>
            )}
            {uploadingSignature && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-[10px] font-medium text-white">
                Đang tải...
              </div>
            )}
          </div>

          <div>
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={onSignatureChange}
              className="hidden"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => signatureInputRef.current?.click()}
                disabled={uploadingSignature}
                className="btn-secondary btn-sm"
              >
                {signatureUrl ? "Đổi chữ ký" : "Tải ảnh chữ ký lên"}
              </button>
              {signatureUrl && (
                <button
                  type="button"
                  onClick={onSignatureRemove}
                  disabled={uploadingSignature}
                  className="btn-ghost btn-sm text-danger-700 hover:bg-danger-50"
                >
                  Xoá
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-faint">
              JPG, PNG, WebP hoặc GIF, nền trong suốt. Tối đa 5 MB.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-token pt-4">
          <div>
            <label className="text-xs font-semibold" htmlFor="org-sig-name">
              Tên người ký
            </label>
            <input
              id="org-sig-name"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="Nguyễn Văn A"
              className="input mt-1 w-48"
            />
          </div>
          <div>
            <label className="text-xs font-semibold" htmlFor="org-sig-title">
              Chức danh
            </label>
            <input
              id="org-sig-title"
              value={signatureTitle}
              onChange={(e) => setSignatureTitle(e.target.value)}
              placeholder="Hiệu trưởng"
              className="input mt-1 w-48"
            />
          </div>
          <button
            type="button"
            onClick={saveSignatureMeta}
            disabled={savingSignatureMeta || !signatureMetaDirty}
            className="btn-secondary btn-sm"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

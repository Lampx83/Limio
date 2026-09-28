"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function OrgSettingsClient({
  organizationId,
  initialLogoUrl,
}: {
  organizationId: string;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Ảnh quá lớn", { description: "Tối đa 5 MB. Vui lòng nén hoặc chọn ảnh khác." });
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Định dạng không hỗ trợ", { description: "Chỉ chấp nhận JPG, PNG, WebP hoặc GIF." });
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/logo`), {
      method: "POST",
      body: fd,
    });
    setUploading(false);
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

  async function onRemove() {
    if (!logoUrl) return;
    if (!confirm("Xoá logo hiện tại của trường?")) return;
    setUploading(true);
    const res = await fetch(apiUrl(`/api/orgs/${organizationId}/logo`), { method: "DELETE" });
    setUploading(false);
    if (res.ok) {
      setLogoUrl(null);
      toast.success("Đã xoá logo trường");
      router.refresh();
    } else {
      toast.error("Xoá thất bại");
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold">Logo trường</h2>
      <p className="mt-0.5 text-xs text-muted">
        Hiển thị cạnh tên trường trên chứng nhận hoàn thành khoá học.
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
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 text-[10px] font-medium text-white">
              Đang tải...
            </div>
          )}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onChange}
            className="hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary btn-sm"
            >
              {logoUrl ? "Đổi logo" : "Tải logo lên"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading}
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
  );
}

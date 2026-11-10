"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";

/**
 * Ảnh bìa / banner của khoá (docs/tieu-chi/trang-khoa-hoc-banner-sach.md, AC3). Tải lên và gỡ có hiệu lực NGAY (không đợi
 * bấm "Lưu"), vì đó là thao tác riêng trên tệp; ba ô văn bản thông tin sách thì lưu cùng form.
 * Giới hạn kiểm ở phía trình duyệt chỉ để báo sớm — máy chủ kiểm lại.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

export default function CourseCoverUpload({ courseId, initialUrl }: { courseId: string; initialUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại đúng tệp vừa chọn
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return void toast.error("Chỉ nhận ảnh JPG, PNG hoặc WebP.");
    if (file.size > MAX_BYTES) return void toast.error("Ảnh quá lớn, tối đa 5 MB.");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(apiUrl(`/api/instructor/courses/${courseId}/cover`), { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return void toast.error("Tải ảnh thất bại", { description: data.message ?? data.error ?? "Vui lòng thử lại." });
      setUrl(data.coverUrl as string);
      toast.success("Đã cập nhật ảnh bìa");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/courses/${courseId}/cover`), { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return void toast.error("Gỡ ảnh thất bại", { description: data.message ?? data.error ?? "Vui lòng thử lại." });
      }
      setUrl(null);
      toast.success("Đã gỡ ảnh bìa");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-token bg-[rgb(var(--surface))] text-faint">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Ảnh bìa hiện tại của khoá" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus size={22} aria-hidden />
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-muted">
          Ảnh hiện ở bên phải banner trang khoá của học viên (từ màn 1024 px trở lên), nên dùng ảnh đứng như bìa sách. JPG, PNG hoặc WebP, tối đa 5 MB.
        </p>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={onPick} aria-label="Chọn ảnh bìa" disabled={busy} />
          <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            <ImagePlus size={14} aria-hidden /> {busy ? "Đang xử lý…" : url ? "Đổi ảnh" : "Tải ảnh lên"}
          </button>
          {url && (
            <button type="button" className="btn-ghost btn-sm text-danger-600" disabled={busy} onClick={onRemove}>
              <Trash2 size={14} aria-hidden /> Xoá ảnh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

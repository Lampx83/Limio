"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, ExternalLink, Link2, Loader2, RefreshCw, X } from "lucide-react";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";
import { toast } from "@/lib/toast";

type Action = "enable" | "rotate" | "disable";

/**
 * Chia sẻ link xem chỉ đọc /bai-giang/<mã>: ai có link cũng xem và tải PDF được, không cần đăng nhập.
 * Ghi chú giảng, đáp án trắc nghiệm và slide ẩn đã được máy chủ lọc khỏi trang đó (limioLiveShare).
 */
export default function ShareDialog({
  deckId,
  shareCode,
  onChange,
  onClose,
}: {
  deckId: string;
  shareCode: string | null;
  onChange: (shareCode: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const link = shareCode ? shareUrl(`/bai-giang/${shareCode}`) : "";

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const run = async (action: Action) => {
    if (action === "rotate" && !confirm("Tạo link mới? Link cũ sẽ ngừng hoạt động ngay, người đã nhận link cũ không xem được nữa.")) return;
    if (action === "disable" && !confirm("Tắt chia sẻ? Link hiện tại sẽ ngừng hoạt động ngay.")) return;
    setBusy(action);
    try {
      const res = await fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast.error("Không cập nhật được chia sẻ, thử lại sau");
        return;
      }
      const data = (await res.json()) as { shareCode: string | null };
      onChange(data.shareCode);
      if (action === "rotate") toast.success("Đã tạo link mới, link cũ đã ngừng hoạt động");
      if (action === "disable") toast.success("Đã tắt chia sẻ");
    } catch {
      toast.error("Lỗi mạng, thử lại sau");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (await copyText(link)) toast.success("Đã sao chép link");
    else toast.error("Không sao chép được, hãy chọn link và sao chép tay");
  };

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby="share-dlg-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(560px,94vw)] max-w-none rounded-2xl border border-token bg-[rgb(var(--surface))] p-0 text-[rgb(var(--text))] shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center gap-3 border-b border-token px-5 py-3">
        <h2 id="share-dlg-title" className="text-h4 flex-1">
          Chia sẻ bài giảng
        </h2>
        <button onClick={() => ref.current?.close()} className="rounded-lg p-1.5 text-muted hover:bg-[rgb(var(--surface-muted))]" aria-label="Đóng">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        <p className="text-body">
          Link xem chỉ đọc: ai có link cũng xem được toàn bộ slide và tải về dạng PDF, không cần đăng nhập. Ghi chú giảng, đáp án
          trắc nghiệm và các slide đã ẩn sẽ không hiện.
        </p>

        {shareCode ? (
          <>
            <div className="flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.target.select()} className="input min-w-0 flex-1 text-sm" aria-label="Link chia sẻ" />
              <button onClick={copy} className="btn-primary flex shrink-0 items-center gap-1.5">
                <Copy size={15} /> Sao chép
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={link} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-1.5 text-sm">
                <ExternalLink size={14} /> Mở thử
              </a>
              <button onClick={() => run("rotate")} disabled={busy !== null} className="btn-secondary flex items-center gap-1.5 text-sm">
                {busy === "rotate" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Tạo link mới
              </button>
              <button
                onClick={() => run("disable")}
                disabled={busy !== null}
                className="ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
              >
                {busy === "disable" ? "Đang tắt…" : "Tắt chia sẻ"}
              </button>
            </div>
            <p className="text-caption text-muted">
              Ảnh trong slide hiện với mọi người có link, nên chỉ chia sẻ khi bạn có quyền dùng các ảnh đó. Muốn thu hồi link đã gửi,
              bấm “Tạo link mới” hoặc “Tắt chia sẻ”.
            </p>
          </>
        ) : (
          <button onClick={() => run("enable")} disabled={busy !== null} className="btn-primary flex items-center gap-2">
            {busy === "enable" ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Bật link chia sẻ
          </button>
        )}
      </div>
    </dialog>,
    document.body
  );
}

"use client";

import { useEffect, useState } from "react";
import { History, Loader2, RotateCcw, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import DateTime from "@/components/ui/DateTime";
import LessonRichText from "./LessonRichText";

interface Version {
  id: string;
  source: string;
  payload: { html?: string; look?: unknown };
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  generated: "Bản AI tạo",
  before_edit: "Trước khi sửa tay",
  before_ai: "Trước khi nhờ AI sửa",
  before_restore: "Trước khi khôi phục",
  before_convert: "Trước khi chuyển sang dạng mới",
  before_regenerate: "Trước khi làm lại từ dàn ý",
};

/**
 * Lịch sử phiên bản của một khối Văn bản (S3): danh sách bên trái, xem trước
 * bên phải đúng như học viên thấy, "Khôi phục bản này". Khôi phục cũng hoàn
 * tác được — bản hiện tại được chụp lại trước.
 */
export default function VersionHistory({
  contentItemId,
  onRestored,
}: {
  contentItemId: string;
  onRestored: (payload: { html?: string; look?: unknown }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setVersions(null);
    fetch(apiUrl(`/api/contents/${contentItemId}/versions`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { versions: Version[] }) => {
        if (!alive) return;
        setVersions(d.versions);
        setPicked(d.versions[0]?.id ?? null);
      })
      .catch(() => alive && setError("Không tải được lịch sử."));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, contentItemId]);

  const current = versions?.find((v) => v.id === picked) ?? null;

  async function restore() {
    if (!current) return;
    if (!window.confirm("Khôi phục bản này? Bản đang có sẽ được lưu vào lịch sử, khôi phục lại được.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/contents/${contentItemId}/versions/${current.id}/restore`), { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { payload: { html?: string; look?: unknown } };
      onRestored(d.payload);
      setOpen(false);
    } catch {
      setError("Chưa khôi phục được. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost btn-sm">
        <History className="h-3.5 w-3.5" aria-hidden /> Lịch sử
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lịch sử phiên bản"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-3 sm:p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="flex h-full max-h-[52rem] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[rgb(var(--surface))] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-token px-4 py-3">
              <h2 className="text-h4 flex-1">Lịch sử phiên bản</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-faint hover:text-[rgb(var(--text))]" aria-label="Đóng">
                <X className="h-5 w-5" />
              </button>
            </div>
            {versions === null && !error && (
              <div className="grid flex-1 place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label="Đang tải" />
              </div>
            )}
            {versions?.length === 0 && (
              <p className="flex-1 p-6 text-sm text-muted">
                Chưa có phiên bản nào. Mỗi lần lưu, bản trước đó sẽ được giữ ở đây để khôi phục khi cần.
              </p>
            )}
            {versions && versions.length > 0 && (
              <div className="grid min-h-0 flex-1 md:grid-cols-[16rem_1fr]">
                <ol className="max-h-48 overflow-y-auto border-b border-token p-2 md:max-h-none md:border-b-0 md:border-r">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => setPicked(v.id)}
                        aria-current={v.id === picked}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                          v.id === picked ? "bg-brand-soft text-brand-700" : "hover:bg-[rgb(var(--surface-muted))]"
                        }`}
                      >
                        <span className="block font-medium">{SOURCE_LABELS[v.source] ?? v.source}</span>
                        <span className="text-xs text-faint">
                          <DateTime value={v.createdAt} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="min-h-0 overflow-y-auto bg-[rgb(var(--bg))] p-3 sm:p-5">
                  {current && <LessonRichText html={current.payload.html ?? ""} look={current.payload.look} />}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 border-t border-token px-4 py-3">
              {error && <span className="text-sm text-danger-600">{error}</span>}
              <span className="flex-1 text-xs text-faint">Giữ tối đa 30 bản gần nhất; bản AI tạo luôn được giữ.</span>
              <button type="button" onClick={restore} disabled={!current || busy} className="btn-primary">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
                Khôi phục bản này
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

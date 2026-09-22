"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { parseVideoUrl } from "@/lib/videoUrl";
import { toast } from "@/lib/toast";
import EditContentItemForm from "./EditContentItemForm";
import { apiUrl } from "@/lib/apiUrl";

interface Item {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
  isHidden?: boolean;
}

function summarize(type: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (type) {
    case "video":
      return String(p.url ?? "(no url)");
    case "markdown": {
      const body = String(p.body ?? "");
      return body.length > 80 ? body.slice(0, 80) + "…" : body;
    }
    case "richtext": {
      const text = String(p.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return text.length > 80 ? text.slice(0, 80) + "…" : text || "(văn bản trống)";
    }
    case "embed":
      return String(p.url ?? "(no url)");
    case "file":
      return `${String(p.filename ?? "(no name)")} — ${String(p.url ?? "")}`;
    case "external_link":
      return `${String(p.title ?? "")} — ${String(p.url ?? "")}`;
    case "pdf":
      return `${String(p.title ?? "PDF")} — ${String(p.url ?? "")}`;
    case "html_block":
      return `${String(p.title ?? "HTML")} — ${String(p.url ?? "")}`;
    case "scorm":
      return `${String(p.title ?? "SCORM")} — packageId=${String(p.packageId ?? "")}`;
    case "lti":
      return `${String(p.title ?? "LTI tool")} — toolId=${String(p.toolId ?? "")}`;
    case "h5p":
      return `${String(p.title ?? "H5P")} — packageId=${String(p.packageId ?? "")}`;
    default:
      return JSON.stringify(payload).slice(0, 80);
  }
}

const ICON: Record<string, string> = {
  video: "",
  markdown: "",
  embed: "",
  file: "",
  external_link: "",
  pdf: "",
  scorm: "",
  lti: "",
  h5p: "",
  html_block: "🌐",
};

export default function ContentItemRow({
  item,
  lessonId,
}: {
  item: Item;
  lessonId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isHidden, setIsHidden] = useState(item.isHidden ?? false);

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/contents/${item.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Xoá content "${item.type}"? Hành động này không thể hoàn tác.`)) return;
    setBusy(true);
    let res: Response;
    try {
      res = await fetch(apiUrl(`/api/contents/${item.id}`), { method: "DELETE" });
    } catch (networkErr) {
      setBusy(false);
      console.error("[ContentItemRow] network error", networkErr);
      toast.error("Không kết nối được tới server");
      return;
    }

    if (res.ok) {
      toast.success("Đã xoá content");
    } else {
      const d = await res.json().catch(() => ({}));
      const code = (d as { error?: string }).error ?? `http_${res.status}`;
      console.error("[ContentItemRow] delete failed", res.status, d);
      toast.error(`Xoá thất bại: ${code}`);
    }

    setBusy(false);
    router.refresh();
  }

  const videoMeta =
    item.type === "video"
      ? parseVideoUrl(String((item.payload as { url?: string })?.url ?? ""))
      : null;

  if (editing) {
    return (
      <div className="rounded-lg border border-brand-300 bg-[rgb(var(--surface))] p-3">
        <EditContentItemForm
          item={item}
          lessonId={lessonId}
          onClose={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2.5 transition-colors hover:border-brand-200">
      {/* Visual: thumbnail for video items, emoji for others */}
      {videoMeta?.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={videoMeta.thumbnailUrl}
          alt=""
          className="h-12 w-20 shrink-0 rounded-md border border-token bg-black object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <span className="text-xl shrink-0" aria-hidden>
          {ICON[item.type] ?? ""}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="chip">{item.type}</span>
          {videoMeta && videoMeta.kind !== "file" && (
            <span className="chip-brand">{videoMeta.providerName}</span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {summarize(item.type, item.payload)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-lg p-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
        <button
          type="button"
          onClick={toggleHidden}
          disabled={busy}
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
            isHidden
              ? "bg-danger-50 text-danger-600 hover:bg-danger-100"
              : "text-faint hover:bg-brand-soft hover:text-brand-600"
          }`}
          title={isHidden ? "Đang ẩn — bấm để hiện" : "Đang hiện — bấm để ẩn"}
          aria-label={isHidden ? "Hiện content" : "Ẩn content"}
          aria-pressed={isHidden}
        >
          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600 disabled:opacity-50"
          title="Sửa content"
          aria-label="Sửa"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          title="Xoá content"
          aria-label="Xoá"
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Item {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
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
    case "embed":
      return String(p.url ?? "(no url)");
    case "file":
      return `${String(p.filename ?? "(no name)")} — ${String(p.url ?? "")}`;
    case "external_link":
      return `${String(p.title ?? "")} — ${String(p.url ?? "")}`;
    case "pdf":
      return `${String(p.title ?? "PDF")} — ${String(p.url ?? "")}`;
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
  video: "🎬",
  markdown: "📝",
  embed: "🔲",
  file: "📎",
  external_link: "🔗",
  pdf: "📄",
  scorm: "📦",
  lti: "🔗",
  h5p: "✨",
};

export default function ContentItemRow({ item }: { item: Item }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Xóa ${item.type}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/contents/${item.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2.5 transition-colors hover:border-brand-200">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-sm font-mono font-semibold text-faint tabular-nums">
        {item.orderIndex}
      </span>
      <span className="text-xl shrink-0" aria-hidden>
        {ICON[item.type] ?? "📄"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="chip">{item.type}</span>
        </div>
        <p className="mt-1 truncate text-sm text-muted">
          {summarize(item.type, item.payload)}
        </p>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        title="Xóa content này"
        aria-label="Xóa"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint opacity-0 transition-all hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100 disabled:opacity-50"
      >
        🗑
      </button>
    </div>
  );
}

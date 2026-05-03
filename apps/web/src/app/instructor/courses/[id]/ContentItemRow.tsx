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
    <div className="flex items-start gap-2 rounded border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-800">
      <span className="font-mono text-slate-500">{item.orderIndex}</span>
      <span>{ICON[item.type] ?? "📄"}</span>
      <span className="flex-1 truncate">
        <span className="font-medium uppercase text-slate-500">{item.type}</span>
        <span className="ml-2 text-slate-700 dark:text-slate-300">
          {summarize(item.type, item.payload)}
        </span>
      </span>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        Xóa
      </button>
    </div>
  );
}

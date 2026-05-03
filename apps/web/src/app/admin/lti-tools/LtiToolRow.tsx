"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Tool {
  id: string;
  name: string;
  toolUrl: string;
  loginInitUrl: string;
  clientId: string;
  deploymentId: string;
  publicKeyKid: string;
  createdAt: Date;
}

export default function LtiToolRow({ tool }: { tool: Tool }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Xóa tool "${tool.name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/lti-tools/${tool.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="rounded border border-slate-200 p-3 text-xs dark:border-slate-800">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{tool.name}</p>
        <button
          onClick={remove}
          disabled={busy}
          className="rounded border border-red-300 px-2 py-0.5 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Xóa
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono">
        <dt className="text-slate-500">tool URL</dt>
        <dd className="break-all">{tool.toolUrl}</dd>
        <dt className="text-slate-500">login init</dt>
        <dd className="break-all">{tool.loginInitUrl}</dd>
        <dt className="text-slate-500">client_id</dt>
        <dd className="break-all">{tool.clientId}</dd>
        <dt className="text-slate-500">deployment_id</dt>
        <dd>{tool.deploymentId}</dd>
        <dt className="text-slate-500">kid</dt>
        <dd className="break-all">{tool.publicKeyKid}</dd>
      </dl>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl(`/api/lti-tools/${tool.id}`), { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 border-b border-token pb-3">
        <div>
          <p className="text-base font-semibold">{tool.name}</p>
          <p className="mt-1 text-xs text-faint">
            Đăng ký {new Date(tool.createdAt).toLocaleDateString("vi-VN")}
          </p>
        </div>
        <button
          onClick={remove}
          disabled={busy}
          className="btn-sm shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-danger-100 bg-[rgb(var(--surface))] px-3 py-1.5 font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-50"
        >
          Xóa
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <Field label="tool URL" value={tool.toolUrl} />
        <Field label="login init" value={tool.loginInitUrl} />
        <Field label="client_id" value={tool.clientId} />
        <Field label="deployment_id" value={tool.deploymentId} />
        <Field label="kid" value={tool.publicKeyKid} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-semibold uppercase tracking-wide text-faint">
        {label}
      </dt>
      <dd className="break-all font-mono text-muted">{value}</dd>
    </>
  );
}

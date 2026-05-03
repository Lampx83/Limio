"use client";

import { useEffect, useState } from "react";

interface Status {
  key: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  updatedAt: string | Date | null;
}

const LABELS: Record<string, { name: string; placeholder: string; help?: string }> = {
  openai: {
    name: "OpenAI API key",
    placeholder: "sk-proj-...",
    help: "Dùng cho AI tutor, auto-tag skill, generate feedback. Lấy ở console.openai.com.",
  },
  "stripe.secret": {
    name: "Stripe secret key",
    placeholder: "sk_live_... / sk_test_...",
  },
  "vnpay.secret": { name: "VNPay secret", placeholder: "VNPAY_HASH_SECRET" },
  "momo.secret": { name: "Momo secret", placeholder: "MOMO_SECRET_KEY" },
};

export default function IntegrationsManager({
  initialStatuses,
}: {
  initialStatuses: Status[];
}) {
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);

  async function refresh() {
    const r = await fetch("/api/admin/integrations");
    const j = await r.json();
    setStatuses(j.statuses ?? []);
  }

  return (
    <div className="mt-6 space-y-6">
      {statuses.map((s) => (
        <IntegrationRow key={s.key} status={s} onChange={refresh} />
      ))}
    </div>
  );
}

function IntegrationRow({
  status,
  onChange,
}: {
  status: Status;
  onChange: () => void;
}) {
  const meta = LABELS[status.key] ?? { name: status.key, placeholder: "" };
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(!status.hasValue);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    setTestResult(null);
    const res = await fetch(
      `/api/admin/integrations/${encodeURIComponent(status.key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.trim() }),
      },
    );
    setBusy(false);
    if (res.ok) {
      setValue("");
      setShowInput(false);
      setTestResult("✓ Đã lưu (encrypted)");
      onChange();
    } else {
      const d = await res.json().catch(() => ({}));
      setTestResult(`Lỗi: ${d.error ?? "unknown"}`);
    }
  }

  async function testInline() {
    if (!value.trim()) return;
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch("/api/admin/integrations/openai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: value.trim() }),
    });
    const j = await res.json();
    setBusy(false);
    setTestResult(
      j.ok ? `✓ Hợp lệ (${j.modelCount} models)` : `✗ ${j.error}`,
    );
  }

  async function testSaved() {
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch("/api/admin/integrations/openai/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    setBusy(false);
    setTestResult(
      j.ok ? `✓ Key đã lưu hợp lệ (${j.modelCount} models)` : `✗ ${j.error}`,
    );
  }

  async function clearKey() {
    if (!confirm(`Xóa key "${status.key}"?`)) return;
    setBusy(true);
    const res = await fetch(
      `/api/admin/integrations/${encodeURIComponent(status.key)}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (res.ok) {
      setValue("");
      setShowInput(true);
      setTestResult(null);
      onChange();
    }
  }

  return (
    <section className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-semibold">{meta.name}</h2>
          <p className="text-xs text-slate-500">
            <code className="font-mono">{status.key}</code>
          </p>
          {meta.help && (
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {meta.help}
            </p>
          )}
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            status.hasValue
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {status.hasValue
            ? status.source === "env"
              ? "✓ env"
              : "✓ saved"
            : "Chưa cấu hình"}
        </span>
      </div>

      {showInput ? (
        <div className="mt-3 space-y-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.placeholder}
            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            {status.key === "openai" && (
              <button
                onClick={testInline}
                disabled={busy || !value}
                className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-50 dark:border-slate-700"
              >
                Test trước khi lưu
              </button>
            )}
            <button
              onClick={save}
              disabled={busy || !value}
              className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {busy ? "..." : "Lưu (encrypted)"}
            </button>
            {status.hasValue && (
              <button
                onClick={() => {
                  setShowInput(false);
                  setValue("");
                  setTestResult(null);
                }}
                className="rounded border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowInput(true)}
            className="rounded border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
          >
            Thay đổi
          </button>
          {status.key === "openai" && (
            <button
              onClick={testSaved}
              disabled={busy}
              className="rounded border border-slate-300 px-3 py-1 text-xs dark:border-slate-700"
            >
              Test key đã lưu
            </button>
          )}
          {status.source === "db" && (
            <button
              onClick={clearKey}
              disabled={busy}
              className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Xóa
            </button>
          )}
        </div>
      )}

      {testResult && (
        <p
          className={`mt-3 text-xs ${
            testResult.startsWith("✓")
              ? "text-emerald-700 dark:text-emerald-300"
              : testResult.startsWith("✗") || testResult.startsWith("Lỗi")
                ? "text-red-700 dark:text-red-300"
                : "text-slate-600 dark:text-slate-400"
          }`}
        >
          {testResult}
        </p>
      )}

      {status.updatedAt && (
        <p className="mt-2 text-[11px] text-slate-500">
          Cập nhật: {new Date(status.updatedAt).toLocaleString("vi-VN")}
        </p>
      )}
    </section>
  );
}

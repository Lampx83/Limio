"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MODELS = [
  { value: "gpt-4o-mini", label: "gpt-4o-mini (rẻ, nhanh)" },
  { value: "gpt-4o", label: "gpt-4o (chất lượng cao)" },
  { value: "gpt-4-turbo", label: "gpt-4-turbo" },
  { value: "gpt-3.5-turbo", label: "gpt-3.5-turbo (giảm chi phí)" },
];

export default function SettingsForm({
  currentModel,
}: {
  currentModel: string;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(currentModel || "gpt-4o-mini");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const body: { openai_api_key?: string; openai_model: string } = { openai_model: model };
      if (apiKey.trim()) body.openai_api_key = apiKey.trim();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại");
        return;
      }
      setSuccess("Đã lưu cấu hình.");
      setApiKey("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function test() {
    setTestResult(null);
    setTesting(true);
    try {
      const res = await fetch("/api/admin/settings/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setTestResult(`✗ ${data.error ?? "Test thất bại"}`);
      } else {
        setTestResult(`✓ ${data.message ?? "OpenAI hoạt động bình thường"}`);
      }
    } finally {
      setTesting(false);
    }
  }

  async function clearKey() {
    if (!confirm("Xoá API key khỏi DB?")) return;
    const res = await fetch("/api/admin/settings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: ["openai_api_key"] }),
    });
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
      <div>
        <label className="label">API Key mới (để trống nếu không đổi)</label>
        <input
          type="password"
          className="input font-mono text-sm"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
        />
      </div>
      <div>
        <label className="label">Model</label>
        <select
          className="input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {success && <div className="text-sm text-emerald-700">{success}</div>}
      {testResult && (
        <div
          className={`text-sm ${
            testResult.startsWith("✓") ? "text-emerald-700" : "text-rose-600"
          }`}
        >
          {testResult}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button disabled={submitting} className="btn-primary">
          {submitting ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          className="btn-secondary"
        >
          {testing ? "Đang test..." : "Test kết nối OpenAI"}
        </button>
        <button
          type="button"
          onClick={clearKey}
          className="btn-secondary text-rose-600"
        >
          Xoá key khỏi DB
        </button>
      </div>
    </form>
  );
}

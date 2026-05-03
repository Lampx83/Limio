"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterLtiToolForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [toolUrl, setToolUrl] = useState("");
  const [loginInitUrl, setLoginInitUrl] = useState("");
  const [jwksUrl, setJwksUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/lti-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        toolUrl,
        loginInitUrl,
        jwksUrl: jwksUrl.trim() || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      setToolUrl("");
      setLoginInitUrl("");
      setJwksUrl("");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "register_failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 text-sm">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Tên hiển thị (e.g. Khan Academy)"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <input
        value={toolUrl}
        onChange={(e) => setToolUrl(e.target.value)}
        required
        type="url"
        placeholder="Tool URL (target_link_uri)"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <input
        value={loginInitUrl}
        onChange={(e) => setLoginInitUrl(e.target.value)}
        required
        type="url"
        placeholder="Login init URL (OIDC)"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <input
        value={jwksUrl}
        onChange={(e) => setJwksUrl(e.target.value)}
        type="url"
        placeholder="Tool JWKS URL (optional)"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-3 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Đăng ký"}
        </button>
        {error && <span className="text-red-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl("/api/lti-tools", {
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
    <form onSubmit={onSubmit} className="card space-y-3">
      <div>
        <label className="label" htmlFor="lti-name">Tên hiển thị</label>
        <input
          id="lti-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Khan Academy"
          className="input mt-1.5"
        />
      </div>
      <div>
        <label className="label" htmlFor="lti-url">Tool URL (target_link_uri)</label>
        <input
          id="lti-url"
          value={toolUrl}
          onChange={(e) => setToolUrl(e.target.value)}
          required
          type="url"
          placeholder="https://tool.example.com/launch"
          className="input mt-1.5"
        />
      </div>
      <div>
        <label className="label" htmlFor="lti-login">Login init URL (OIDC)</label>
        <input
          id="lti-login"
          value={loginInitUrl}
          onChange={(e) => setLoginInitUrl(e.target.value)}
          required
          type="url"
          placeholder="https://tool.example.com/lti/login"
          className="input mt-1.5"
        />
      </div>
      <div>
        <label className="label" htmlFor="lti-jwks">Tool JWKS URL (optional)</label>
        <input
          id="lti-jwks"
          value={jwksUrl}
          onChange={(e) => setJwksUrl(e.target.value)}
          type="url"
          placeholder="https://tool.example.com/.well-known/jwks.json"
          className="input mt-1.5"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-token pt-3">
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          {busy ? "..." : "Đăng ký"}
        </button>
        {error && (
          <span className="text-xs text-danger-600">Lỗi: {error}</span>
        )}
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

export default function EnterProctorCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl("/api/public/proctor/claim"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(
          j?.error === "rate_limited"
            ? "Thử quá nhiều lần. Chờ một phút rồi nhập lại."
            : "Mã không dùng được. Kiểm tra lại mã, hoặc ca thi đã đóng.",
        );
        return;
      }
      router.push("/giam-thi/phong");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <label className="block">
        <span className="block text-sm font-medium">Mã giám thị</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          placeholder="VD: K7M2QP4R"
          className="mt-1 w-full rounded border border-default px-3 py-2.5 text-center font-mono text-2xl tracking-widest"
        />
      </label>
      {err && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || code.trim().length !== 8}
        className="w-full rounded bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
      >
        {busy ? "Đang kiểm tra…" : "Vào phòng thi"}
      </button>
    </form>
  );
}

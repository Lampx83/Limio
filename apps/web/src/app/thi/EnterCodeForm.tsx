"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Strip non-alphanumeric so paste with spaces / dashes still works, then
// uppercase. Backend codes are 6 (open) or 8 (assigned) chars from a uppercase
// alphanumeric alphabet, so accepting only [A-Z0-9] is safe.
function normalize(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export default function EnterCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const norm = normalize(code);
    if (norm.length < 6) {
      setErr("Mã thi quá ngắn. Mã có 6 hoặc 8 ký tự.");
      return;
    }
    if (norm.length > 8) {
      setErr("Mã thi quá dài. Mã có 6 hoặc 8 ký tự.");
      return;
    }
    setBusy(true);
    router.push(`/exam/${norm}`);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700">
          Mã thi
        </span>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          value={code}
          onChange={(e) => setCode(normalize(e.target.value))}
          maxLength={12}
          placeholder="VD: A1B2C3D4"
          aria-label="Mã thi"
          className="mt-2 w-full rounded-lg border-2 border-slate-300 bg-white px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-slate-900 focus:border-blue-500 focus:outline-none"
        />
        <span className="mt-1 block text-xs text-slate-500">
          Mã thi gồm 6 đến 8 ký tự (chữ và số).
        </span>
      </label>

      {err && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || code.length < 6}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Đang chuyển..." : "Vào thi →"}
      </button>
    </form>
  );
}

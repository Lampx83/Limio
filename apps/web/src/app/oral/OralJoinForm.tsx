"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Nhập tay mã tham gia vấn đáp (GV đọc mã, hoặc mã không kèm link để bấm). */
export default function OralJoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (trimmed) router.push(`/oral/${encodeURIComponent(trimmed)}`);
      }}
      className="mt-6 space-y-3"
    >
      <label className="block">
        <span className="block text-xs font-medium text-slate-600">Mã tham gia</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VD: A3K7M2"
          maxLength={6}
          autoFocus
          className="mt-1 w-full rounded border border-default px-3 py-2 text-center font-mono text-lg uppercase tracking-widest focus:border-blue-500 focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={!code.trim()}
        className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Vào buổi vấn đáp
      </button>
    </form>
  );
}

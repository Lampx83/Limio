"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

export default function ExitImpersonationButton() {
  const [busy, setBusy] = useState(false);
  async function exit() {
    setBusy(true);
    await fetch(apiUrl("/api/admin/impersonate/exit"), { method: "POST" });
    window.location.href = "/admin/users";
  }
  return (
    <button
      type="button"
      onClick={exit}
      disabled={busy}
      className="ml-auto rounded-lg border border-warning-300 bg-white px-3 py-1 text-xs font-semibold text-warning-900 hover:bg-warning-100 disabled:opacity-50"
    >
      {busy ? "…" : "✕ Thoát view"}
    </button>
  );
}

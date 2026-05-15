"use client";

import { useEffect } from "react";

// Trigger the native print dialog shortly after mount so opening the page in
// a new tab pops the printer prompt automatically. Skipping it on first paint
// gives the table a moment to render with real fonts.
export default function PrintAutoFire() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 print:hidden"
    >
      🖨️ In
    </button>
  );
}

"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface BackButtonProps {
  /** Where to go if there's no in-app history to go back to (e.g. opened in a new tab). */
  fallbackHref: string;
  label?: string;
  className?: string;
}

export default function BackButton({ fallbackHref, label = "Quay lại", className }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={className ?? "inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

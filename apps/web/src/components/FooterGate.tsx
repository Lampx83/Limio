"use client";

import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/admin", "/instructor"];

export default function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }
  return <>{children}</>;
}

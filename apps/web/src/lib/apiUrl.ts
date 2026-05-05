/**
 * Prepends the app's base path to an API path so client-side fetch() calls
 * work correctly when the app is served at a sub-path (e.g. /limio).
 *
 * In local dev the base path is "" so paths are returned unchanged.
 * In production with basePath=/limio: "/api/courses" → "/limio/api/courses".
 *
 * Two-tier detection (most reliable first):
 *  1. NEXT_PUBLIC_BASE_PATH — baked in at Docker build time via build-arg.
 *     Set NEXT_PUBLIC_BASE_PATH=/limio in .env.prod to use this fast path.
 *  2. Runtime script-tag detection — reads the prefix from the first
 *     Next.js /_next/ chunk URL. Works even when the build-arg was not set,
 *     as long as the browser has loaded the page.
 *
 * Usage:
 *   import { apiUrl } from "@/lib/apiUrl";
 *   fetch(apiUrl("/api/courses"), { method: "POST", ... })
 */

let _cachedBase: string | undefined;

function detectBasePath(): string {
  // Fast path: baked in at build time.
  const envBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (envBase) return envBase;

  // Runtime fallback: Next.js always serves its chunks at
  // "<basePath>/_next/static/…". Find the first such script tag and
  // extract the prefix before "/_next/".
  if (typeof window !== "undefined") {
    const script = document.querySelector(
      'script[src*="/_next/"]'
    ) as HTMLScriptElement | null;

    if (script?.src) {
      try {
        const pathname = new URL(script.src).pathname; // e.g. "/limio/_next/static/…"
        const idx = pathname.indexOf("/_next/");
        if (idx > 0) return pathname.slice(0, idx); // → "/limio"
      } catch {
        // Ignore — fall through to ""
      }
    }
  }

  return "";
}

export function apiUrl(path: string): string {
  if (_cachedBase === undefined) {
    _cachedBase = detectBasePath();
  }
  return `${_cachedBase}${path}`;
}

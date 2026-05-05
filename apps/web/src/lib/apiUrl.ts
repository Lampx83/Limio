/**
 * Prepends NEXT_PUBLIC_BASE_PATH to an API path so fetch() calls work
 * correctly when the app is served at a sub-path (e.g. /limio).
 *
 * In local dev BASE_PATH is "" so the path is returned unchanged.
 * In production (basePath=/limio), "/api/courses" → "/limio/api/courses".
 *
 * Usage:
 *   import { apiUrl } from "@/lib/apiUrl";
 *   fetch(apiUrl("/api/courses"), { method: "POST", ... })
 */
export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${path}`;
}

import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

// NEXT_PUBLIC_BASE_PATH is baked at Docker build time (e.g. "/limio").
// Next.js strips this prefix from request.url BEFORE the route handler runs,
// so the handler always sees /api/auth/... (without /limio).
//
// Problem: NextAuth builds the OAuth redirect_uri from request.url + basePath:
//   new URL("/api/auth/callback/google", "https://host/api/auth/signin/google")
//   = "https://host/api/auth/callback/google"   ← missing /limio → mismatch
//
// Fix: prepend BASE back onto the pathname so NextAuth sees the full path.
// With auth.ts basePath="${BASE}/api/auth" (= "/limio/api/auth"), NextAuth
// strips "/limio/api/auth" from "/limio/api/auth/..." correctly AND builds
// redirect_uri / error-page URLs that include /limio.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function withBasePath(req: NextRequest): NextRequest {
  if (!BASE) return req;
  const url = new URL(req.url);
  url.pathname = `${BASE}${url.pathname}`;
  // Construct a new NextRequest (not plain Request) so NextAuth retains
  // access to NextRequest-specific fields (cookies, nextUrl, etc.).
  return new NextRequest(url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
  });
}

export async function GET(req: NextRequest) {
  return handlers.GET(withBasePath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withBasePath(req));
}

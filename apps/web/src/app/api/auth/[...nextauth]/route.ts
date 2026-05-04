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
//
// Implementation: use a Proxy to override only `url`, forwarding everything
// else (body, headers, cookies…) to the original request unchanged.
// This avoids the body re-streaming problem: passing req.body to a new
// Request/NextRequest constructor in Node.js 18+ requires duplex:"half" which
// NextRequest's TypeScript types don't accept. The Proxy sidesteps that
// entirely — the original ReadableStream is never duplicated.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function withBasePath(req: NextRequest): NextRequest {
  if (!BASE) return req;
  const url = new URL(req.url);
  url.pathname = `${BASE}${url.pathname}`;
  const patched = url.toString();
  return new Proxy(req, {
    get(target, prop, receiver) {
      if (prop === "url") return patched;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as NextRequest;
}

export async function GET(req: NextRequest) {
  return handlers.GET(withBasePath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withBasePath(req));
}

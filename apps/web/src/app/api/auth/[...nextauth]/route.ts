import { handlers } from "@/lib/auth";
import { type NextRequest } from "next/server";

// NEXT_PUBLIC_BASE_PATH is baked at Docker build time (e.g. "/limio").
// Next.js strips this prefix from request.url BEFORE the route handler runs,
// so the handler always sees /api/auth/... (without /limio).
//
// Problem: NextAuth builds the OAuth redirect_uri from request.url + basePath:
//   new URL("/api/auth/callback/google", "https://host/api/auth/signin/google")
//   = "https://host/api/auth/callback/google"   ← missing /limio → mismatch
//
// Fix: prepend BASE back onto the pathname so NextAuth sees the full path.
// With auth.ts basePath="/limio/api/auth", NextAuth then strips "/limio/api/auth"
// from "/limio/api/auth/..." correctly AND builds URLs that include /limio.

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function withBasePath(req: NextRequest): Request {
  if (!BASE) return req;
  const url = new URL(req.url);
  url.pathname = `${BASE}${url.pathname}`;
  return new Request(url.toString(), {
    method: req.method,
    headers: new Headers(req.headers),
    body: req.body,
    // Node.js 18+ requires duplex:"half" when body is a ReadableStream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(req.body ? { duplex: "half" } : {}),
  } as RequestInit);
}

export async function GET(req: NextRequest) {
  return handlers.GET(withBasePath(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withBasePath(req));
}

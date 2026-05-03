"use client";

/**
 * Client-side provider wrapper.
 *
 * SessionProvider MUST receive an explicit basePath that includes the
 * Next.js app basePath (e.g. "/limio"). Without it, next-auth/react
 * defaults to "/api/auth" and all client calls (signIn, signOut,
 * useSession) hit /api/auth/... — a path the reverse proxy never routes
 * to the app when it's mounted under a sub-path.
 *
 * NEXT_PUBLIC_BASE_PATH is baked in at Docker build time via the
 * NEXT_PUBLIC_BASE_PATH build-arg (empty string when served from root).
 */
import { SessionProvider } from "next-auth/react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider basePath={`${BASE}/api/auth`}>
      {children}
    </SessionProvider>
  );
}

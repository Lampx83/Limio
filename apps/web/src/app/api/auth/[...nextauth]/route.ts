import { handlers } from "@/lib/auth";

// Plain re-export: Next.js strips the app basePath (/limio) before the
// handler runs, so NextAuth receives /api/auth/... which matches
// auth.ts basePath="/api/auth" exactly.  No URL manipulation needed here.
//
// The OAuth redirect_uri (/limio/api/auth/callback/google) is handled by
// the redirectProxyUrl option on each SSO provider in auth.ts.
export const { GET, POST } = handlers;

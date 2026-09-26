import { cookies, headers } from "next/headers";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  IMPERSONATION_COOKIE,
  categorizeUserAgent,
  decodeImpersonationCookie,
  emitEvent,
  getRolesForUser,
  loginCredentials,
  loginOrLinkSso,
} from "@feedbackme/core-lms";

/**
 * Auth providers — Credentials (email+password) plus optional SSO via Google
 * and Microsoft Entra ID. SSO providers are conditionally registered based on
 * env vars so missing config in dev doesn't break sign-in.
 */
// Build-time base path (e.g. "/foo" when proxied at a sub-path).
// Empty when served from root domain — current production (limio.vn).
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const ssoProviders = [];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  ssoProviders.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Always show the account chooser. Avoids silent re-login with the wrong
      // Google account when learner has multiple Gmails open.
      authorization: { params: { prompt: "select_account" } },
    }),
  );
}

if (
  process.env.MICROSOFT_CLIENT_ID &&
  process.env.MICROSOFT_CLIENT_SECRET
) {
  ssoProviders.push(
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      // `common` = work, school, AND personal Microsoft accounts. Override
      // with the tenant ID for single-tenant orgs.
      issuer: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID ?? "common"}/v2.0`,
    }),
  );
}

// Throttle ghi lastAccessAt: tối đa 1 lần / 5 phút / user / process. Cộng thêm
// điều kiện trong WHERE để nhiều process không ghi đè dồn dập.
const LAST_ACCESS_INTERVAL_MS = 5 * 60 * 1000;
const lastAccessTouched = new Map<string, number>();

function touchLastAccess(userId: string): void {
  const now = Date.now();
  const prev = lastAccessTouched.get(userId) ?? 0;
  if (now - prev < LAST_ACCESS_INTERVAL_MS) return;
  lastAccessTouched.set(userId, now);
  if (lastAccessTouched.size > 5000) lastAccessTouched.clear();
  // Fire-and-forget: không được chặn hay làm hỏng request.
  prisma.user
    .updateMany({
      where: {
        id: userId,
        OR: [
          { lastAccessAt: null },
          { lastAccessAt: { lt: new Date(now - LAST_ACCESS_INTERVAL_MS) } },
        ],
      },
      data: { lastAccessAt: new Date(now) },
    })
    .catch(() => {
      lastAccessTouched.delete(userId);
    });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: `/api/auth`,
  session: { strategy: "jwt" },
  // pages.error must NOT point at /api/auth/error (the NextAuth API route
  // itself) — that creates a redirect loop. It points at a plain app page.
  pages: {
    signIn: `${BASE}/signin`,
    error: `${BASE}/auth-error`,
  },
  // Allows NextAuth to accept requests from plain-HTTP origins (IP:PORT) and
  // from behind reverse proxies. Without this, NextAuth v5 throws UntrustedHost
  // for any non-localhost / non-HTTPS origin in production.
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const result = await loginCredentials({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!result) return null;
        return {
          id: result.id,
          email: result.email,
          name: result.name,
          isEmailVerified: result.isEmailVerified,
        };
      },
    }),
    ...ssoProviders,
  ],
  callbacks: {
    /**
     * For SSO providers, resolve / create the FeedBackMe User row + AuthProvider
     * link, then mutate user.id so the JWT callback uses our internal UUID
     * (not the OAuth `sub`).
     */
    async signIn({ user, account, profile }) {
      if (!account) return false;
      if (account.provider === "credentials") return true;

      const provider =
        account.provider === "google"
          ? "google"
          : account.provider === "microsoft-entra-id"
            ? "microsoft"
            : null;
      if (!provider) return false;

      const email = user.email ?? (profile as { email?: string } | undefined)?.email;
      const providerUserId =
        account.providerAccountId ??
        (profile as { sub?: string } | undefined)?.sub;
      if (!email || !providerUserId) return false;

      // Google + Microsoft both assert email ownership in their id_token.
      const result = await loginOrLinkSso({
        provider,
        providerUserId,
        email,
        name: user.name ?? email.split("@")[0]!,
        emailVerifiedByProvider: true,
      });
      if (!result) return false;

      user.id = result.id;
      (user as { isEmailVerified?: boolean }).isEmailVerified = result.isEmailVerified;
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id;
        token.isEmailVerified = (user as { isEmailVerified?: boolean }).isEmailVerified ?? false;
      }
      if (token.userId) touchLastAccess(token.userId as string);
      const shouldRefreshRoles = Boolean(user) || trigger === "update" || token.roles === undefined;
      if (shouldRefreshRoles && token.userId) {
        const rows = await getRolesForUser(token.userId as string);
        const unique = Array.from(new Set(rows.map((r) => r.roleName)));
        token.roles = unique;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
        session.user.isEmailVerified = Boolean(token.isEmailVerified);
        session.user.roles = Array.isArray(token.roles) ? (token.roles as string[]) : [];
      }

      // Impersonation: if a valid signed cookie exists AND the cookie's
      // adminId matches the JWT's userId, swap session.user to the target.
      // session.user.impersonator preserves the admin identity for the banner
      // and for any "real actor" lookups by app code that respect it.
      const adminId = token.userId as string | undefined;
      if (adminId) {
        const raw = cookies().get(IMPERSONATION_COOKIE)?.value;
        const decoded = decodeImpersonationCookie(raw);
        if (decoded && decoded.adminId === adminId) {
          const target = await prisma.user.findUnique({
            where: { id: decoded.targetId },
            select: { id: true, email: true, displayName: true },
          });
          if (target) {
            const targetRoles = await getRolesForUser(target.id);
            const adminEmail = session.user.email ?? null;
            const adminName = session.user.name ?? null;
            session.user.impersonator = {
              id: adminId,
              email: adminEmail,
              name: adminName,
            };
            session.user.id = target.id;
            session.user.email = target.email;
            session.user.name = target.displayName;
            session.user.roles = Array.from(
              new Set(targetRoles.map((r) => r.roleName)),
            );
          }
        }
      }
      return session;
    },
  },
  events: {
    /**
     * Ghi lại mỗi lần đăng nhập thành công — biết được sinh viên học lúc nào,
     * bao nhiêu lần, dùng thiết bị gì, mà không lưu UA nguyên văn hay IP (xem
     * `categorizeUserAgent`). Cố tình dùng `events`, không phải `callbacks`:
     * callbacks có thể chặn/định hướng lại luồng đăng nhập, còn events là
     * fire-and-forget — throw ở đây (hoặc DB chậm) không bao giờ được làm
     * hỏng lượt đăng nhập của người dùng, nên vẫn bọc try/catch cho chắc.
     *
     * `user.id` ở đây là id nội bộ cuối cùng: với SSO, callback `signIn` ở
     * trên đã ghi đè `user.id = result.id` trước khi luồng đi tới đây.
     */
    async signIn({ user, account }) {
      if (!user.id) return;
      try {
        const ua = headers().get("user-agent");
        const { device, browser } = categorizeUserAgent(ua);
        await emitEvent(user.id, LearningEventType.SessionStarted, {
          device,
          browser,
          provider: account?.provider ?? "unknown",
        });
      } catch {
        // Nuốt lỗi — đây là đường ghi số liệu, không phải đường đăng nhập.
      }
    },
  },
});

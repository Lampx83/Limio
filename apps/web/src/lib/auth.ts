import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginCredentials, getRolesForUser } from "@feedbackme/core-lms";

// Google OAuth provider is stubbed for Phase 0.
// To enable: install @auth/google and add the import + provider config below.
// import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
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
    // Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.userId = user.id;
        token.isEmailVerified = (user as { isEmailVerified?: boolean }).isEmailVerified ?? false;
      }
      // Refresh roles on login and on explicit session update; covers `update()` from client.
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
      return session;
    },
  },
});

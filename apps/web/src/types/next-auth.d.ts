import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      isEmailVerified?: boolean;
      roles?: string[];
      /**
       * When set, the current `id`/`email`/`name`/`roles` are the impersonated
       * user's; `impersonator` is the actual admin who initiated the swap.
       */
      impersonator?: {
        id: string;
        email?: string | null;
        name?: string | null;
      };
    };
  }

  interface User {
    id: string;
    isEmailVerified?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isEmailVerified?: boolean;
    roles?: string[];
  }
}

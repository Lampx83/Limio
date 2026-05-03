import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper for FeedBackMe.
 *
 * Two modes:
 *   - Live mode (recommended for MVP): `server.url` points to the production
 *     Vercel deployment. No native build needed when content updates.
 *   - Bundled mode: comment out `server.url`; `pnpm run build && next export`
 *     into `webDir`, then `npx cap sync` to ship offline-capable static bundle.
 *
 * Setup (run from this directory):
 *   pnpm install
 *   npx cap add ios
 *   npx cap add android
 *   npx cap sync
 *   npx cap open ios     # requires Xcode
 *   npx cap open android # requires Android Studio
 */
const config: CapacitorConfig = {
  appId: "dev.feedbackme.app",
  appName: "FeedBackMe",
  webDir: "www",
  server: {
    // Replace with your production URL when shipping.
    url: process.env.CAPACITOR_SERVER_URL ?? "https://feedbackme.example.com",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#7c3aed",
      androidScaleType: "CENTER_CROP",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

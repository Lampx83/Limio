# FeedBackMe Mobile (Capacitor)

Native iOS + Android wrapper around the Next.js web app. Two distribution modes:

## Mode 1 — Live web (fastest path)

`capacitor.config.ts` points `server.url` to a deployed URL. When content changes
on web, the mobile app sees them immediately — no resubmission to App Store /
Play Store unless the wrapper itself changes.

```bash
cd apps/mobile
pnpm install
CAPACITOR_SERVER_URL=https://your-prod-url.vercel.app npx cap add ios
npx cap add android
npx cap sync
npx cap open ios       # opens Xcode
npx cap open android   # opens Android Studio
```

Build + sign in Xcode / Android Studio per Apple / Google's process.

## Mode 2 — Bundled (offline-capable)

For offline lesson cache. Build the web export into `www/`, then sync.

1. In `apps/web`, add `next.config.js` with `output: "export"`.
2. Run `pnpm --filter @feedbackme/web build`.
3. Copy `apps/web/out` → `apps/mobile/www`.
4. In `capacitor.config.ts`, comment out `server.url`.
5. `npx cap sync && npx cap open ios`.

Caveats: SSR routes won't work — only static + client-side fetch. API calls
still go to the server, so most of the platform requires online.

## Push notifications

Capacitor's `@capacitor/push-notifications` is wired in config. To enable:

1. Apple: configure APNs in Apple Developer console + add capability in Xcode.
2. Android: register Firebase project + drop `google-services.json`.
3. Send registration token from app to your backend → store on User row →
   server pushes via APNs/FCM.

## Why Capacitor, not React Native?

We have a working web app. Capacitor wraps it natively in ~1 day. React Native
would mean rewriting the entire UI in RN components (~3-5 weeks). For MVP, the
wrapper is the right call.

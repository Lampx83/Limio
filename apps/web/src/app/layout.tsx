import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Toaster from "@/components/Toaster";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Limio — Learn your way",
  description:
    "Limio là LMS thế hệ mới: skill graph, BKT learner model, AI tutor và gamification. Học theo cách của bạn — fresh, focused, your own pace.",
  icons: {
    // SVG favicon — Next.js automatically prepends basePath so the <link>
    // tag will reference /limio/favicon.svg when basePath=/limio.
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

// Runs before React hydration to set the dark class — prevents flash of wrong theme.
const NO_FLASH_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('fbm-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-screen">
        <Providers>
          <ImpersonationBanner />
          <AppHeader />
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

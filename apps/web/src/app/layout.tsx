import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Toaster from "@/components/Toaster";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Limio — Learn your way",
  description:
    "Limio là LMS thế hệ mới: skill graph, BKT learner model, AI tutor và gamification. Học theo cách của bạn — fresh, focused, your own pace.",
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
        <ImpersonationBanner />
        <AppHeader />
        {children}
        <Toaster />
      </body>
    </html>
  );
}

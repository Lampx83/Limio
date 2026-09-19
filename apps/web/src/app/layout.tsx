import type { Metadata } from "next";
import { Inter, Caveat } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Toaster from "@/components/Toaster";
import { Providers } from "@/components/Providers";
import Footer from "@/components/Footer";
import FooterGate from "@/components/FooterGate";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

// Chữ viết tay cho tagline "Learn your way" ở header.
const caveat = Caveat({
  subsets: ["latin"],
  display: "swap",
  weight: ["600"],
  variable: "--font-script",
});

// Root layout chứa Footer (gọi getSiteSettings → Prisma). Force-dynamic để
// tránh Next thử SSG mọi page và đập vào DB trong lúc build.
export const dynamic = "force-dynamic";

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

// Dark mode disabled — clear any legacy `dark` class + stored preference left
// over from users who had dark/system theme enabled before. Runs pre-hydration
// so the page never flashes dark for returning users. Keep the script (instead
// of deleting outright) until next release cycle so it cleans up persisted
// localStorage state for all visitors at least once.
const NO_FLASH_SCRIPT = `
(function() {
  try {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('fbm-theme');
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} ${caveat.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <ImpersonationBanner />
          <div data-print-hide>
            <AppHeader />
          </div>
          <div className="flex flex-1 flex-col">{children}</div>
          <FooterGate>
            <Footer />
          </FooterGate>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

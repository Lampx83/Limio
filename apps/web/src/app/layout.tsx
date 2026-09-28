import type { Metadata } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import Toaster from "@/components/Toaster";
import { Providers } from "@/components/Providers";
import Footer from "@/components/Footer";
import FooterGate from "@/components/FooterGate";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { AiTokensPageProvider } from "@/components/AiTokensPageContext";
import { getAiTokensPageLocked } from "@/lib/site-settings";
import { getEnv } from "@/lib/env";
import {
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

// Font tròn, mềm cho tagline "Learn in Flow" / "Teach in Flow" ở header.
const nunito = Nunito({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-script",
});

// Root layout chứa Footer (gọi getSiteSettings → Prisma). Force-dynamic để
// tránh Next thử SSG mọi page và đập vào DB trong lúc build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Mọi URL tương đối trong metadata (canonical, ảnh OG) được Next resolve dựa
  // trên cái này. Thiếu nó thì OG image ra đường dẫn tương đối và Facebook/Zalo
  // không render được thumbnail khi ai đó chia sẻ link khoá học.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    // Trang con chỉ cần khai tên riêng; hậu tố thương hiệu tự gắn vào.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Limio",
    "LMS",
    "học trực tuyến",
    "khoá học online",
    "nền tảng học tập",
    "e-learning",
    "phản hồi cá nhân hoá",
    "gamification học tập",
  ],
  // KHÔNG đặt `alternates.canonical` ở đây: metadata layout được mọi trang con
  // kế thừa, nên mỗi trang không tự khai canonical sẽ tự nhận mình là trang chủ.
  // Canonical của "/" nằm trong app/page.tsx.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    url: absoluteUrl("/"),
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  // KHÔNG khai `robots` ở layout gốc: nó kế thừa xuống mọi trang, kể cả /signin
  // hay /thi — tuyên bố "index, follow" cho những trang đó là đá nhau với
  // `X-Robots-Tag: noindex` mà middleware đặt. Trang công khai tự khai qua
  // `pageMetadata`; trang riêng tư dùng `NOINDEX` ở layout khu vực.
  // Số điện thoại trong nội dung bài học không nên bị Safari tự biến thành link.
  formatDetection: { telephone: false, address: false, email: false },
  icons: {
    // SVG favicon — Next.js automatically prepends basePath so the <link>
    // tag will reference /limio/favicon.svg when basePath=/limio.
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const aiTokensPageUnlocked = !(await getAiTokensPageLocked().catch(() => true));

  return (
    <html lang="vi" className={`${inter.variable} ${nunito.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <GoogleAnalytics
          measurementIds={[
            getEnv().NEXT_PUBLIC_GA_MEASUREMENT_ID,
            getEnv().NEXT_PUBLIC_GA_MEASUREMENT_ID_ALL,
          ]}
        />
        <Providers>
          <AiTokensPageProvider unlocked={aiTokensPageUnlocked}>
          <ImpersonationBanner />
          <div data-print-hide className="sticky top-0 z-30">
            <AppHeader />
          </div>
          <div className="flex flex-1 flex-col">{children}</div>
          <FooterGate>
            <Footer />
          </FooterGate>
          <Toaster />
          </AiTokensPageProvider>
        </Providers>
      </body>
    </html>
  );
}

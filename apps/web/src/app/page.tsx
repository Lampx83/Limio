import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { landingPathForRoles } from "@/lib/landing";
import JsonLd from "@/components/JsonLd";
import LandingPage from "@/components/LandingPage";
import { getRegisterEnabled } from "@/lib/site-settings";
import { absoluteUrl, organizationJsonLd, webSiteJsonLd } from "@/lib/seo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Canonical của trang chủ đặt ở đây chứ không ở root layout: metadata layout
// được kế thừa xuống mọi trang con, nên để ở đó thì mọi trang chưa tự khai
// canonical đều nhận mình là "/". Title/description/OG vẫn lấy từ layout.
export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
  robots: {
    index: true,
    follow: true,
    // Cho Google lấy đoạn trích dài và ảnh lớn thay vì thumbnail bé xíu.
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
};

export default async function HomePage() {
  // Logged-in users → role-appropriate dashboard (xem landingPathForRoles).
  const session = await auth();
  if (session?.user?.id) redirect(landingPathForRoles(session.user.roles ?? []));

  const registerEnabled = await getRegisterEnabled();

  return (
    <>
      {/* Danh tính tổ chức + website cho Google: gắn logo/tên thương hiệu vào
          knowledge panel và mở ô sitelinks search trỏ thẳng vào catalog. */}
      <JsonLd data={[organizationJsonLd(), webSiteJsonLd()]} />
      <LandingPage registerEnabled={registerEnabled} />
    </>
  );
}

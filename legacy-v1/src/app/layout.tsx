import type { Metadata } from "next";
import "./globals.css";
import { getCurrentUser, getImpersonation } from "@/lib/auth";
import ImpersonateBar from "@/components/ImpersonateBar";

export const metadata: Metadata = {
  title: "FeedBackMe - Phản hồi cá nhân hoá bằng AI",
  description:
    "Nền tảng nghiên cứu thực nghiệm phản hồi cá nhân hoá dựa trên AI cho giáo dục đại học Việt Nam.",
};

const themeInitScript = `
(function(){try{
  var s=localStorage.getItem('fbm_theme')||'system';
  var d=s==='dark'||(s==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(d) document.documentElement.classList.add('dark');
}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const imp = await getImpersonation();
  const current = imp ? await getCurrentUser() : null;
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        {imp && current && (
          <ImpersonateBar
            asWho={`${current.full_name} (@${current.username})`}
            originalRole={imp.original_role}
          />
        )}
        {children}
      </body>
    </html>
  );
}

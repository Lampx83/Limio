import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FeedBackMe — LMS với feedback cá nhân hóa",
  description:
    "LMS thế hệ mới: skill graph, BKT learner model, AI tutor và gamification. Học nhanh hơn nhờ feedback đúng lúc.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className="min-h-screen">
        <AppHeader />
        {children}
      </body>
    </html>
  );
}

import { redirect } from "next/navigation";
import { getPortfolioEditor } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PortfolioEditor from "./PortfolioEditor";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/portfolio");

  const { portfolio, rows } = await getPortfolioEditor(session.user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">Portfolio của bạn</h1>
      <p className="mt-2 text-meta">
        Chọn những bài đã được giáo viên chấm mà bạn muốn khoe, rồi bật công khai để gửi link cho người khác.
      </p>
      <PortfolioEditor
        initial={{ slug: portfolio.slug, isPublic: portfolio.isPublic, headline: portfolio.headline ?? "" }}
        rows={rows.map((r) => ({ ...r, gradedAt: r.gradedAt?.toISOString() ?? null }))}
      />
    </main>
  );
}

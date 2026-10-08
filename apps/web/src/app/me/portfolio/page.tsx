import { redirect } from "next/navigation";
import { getPortfolioEditor, PORTFOLIO_MAX_ITEMS_PER_GROUP } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PortfolioEditor from "./PortfolioEditor";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/portfolio");

  const { portfolio, rows, courses } = await getPortfolioEditor(session.user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="text-h1">e-Portfolio của bạn</h1>
      <p className="mt-2 text-body">
        e-Portfolio (hồ sơ học tập điện tử) là một trang riêng tổng hợp các bài làm tốt nhất của bạn, để chia sẻ
        cho nhà tuyển dụng, trường học khác hoặc bất kỳ ai muốn xem năng lực thực tế của bạn.
      </p>
      <p className="mt-2 text-meta">
        Chọn khoá học đã hoàn thành và vài bài tiêu biểu mà bạn muốn khoe, rồi bật công khai để gửi link cho người khác.
      </p>
      <PortfolioEditor
        initial={{
          slug: portfolio.slug,
          isPublic: portfolio.isPublic,
          headline: portfolio.headline ?? "",
          about: portfolio.about ?? "",
        }}
        rows={rows.map((r) => ({
          ...r,
          submittedAt: r.submittedAt.toISOString(),
          gradedAt: r.gradedAt?.toISOString() ?? null,
        }))}
        courses={courses.map((c) => ({ ...c, issuedAt: c.issuedAt.toISOString() }))}
        maxPerGroup={PORTFOLIO_MAX_ITEMS_PER_GROUP}
      />
    </main>
  );
}

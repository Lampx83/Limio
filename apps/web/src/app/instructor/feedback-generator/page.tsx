import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import FeedbackGeneratorClient from "./FeedbackGeneratorClient";

export const dynamic = "force-dynamic";

export default async function FeedbackGeneratorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/feedback-generator");

  const [admin, anyCourse] = await Promise.all([
    isAdmin(session.user.id),
    prisma.courseInstructor.findFirst({ where: { userId: session.user.id } }),
  ]);
  if (!admin && !anyCourse) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ instructor hoặc admin mới truy cập được.
        </div>
      </main>
    );
  }

  const misconceptions = await prisma.misconception.findMany({
    orderBy: { code: "asc" },
    include: {
      templates: {
        where: { scope: "per_misconception" },
        select: { id: true, body: true, priority: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link
        href="/instructor/dashboard"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Dashboard
      </Link>

      <div className="mt-4">
        <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-700">
          AI tools
        </span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          AI Feedback Generator
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Chọn misconception → AI sinh feedback body → review → save làm template.
          Khi học viên trả lời sai vào option có misconception này, hệ feedback
          engine sẽ dùng template để render.
        </p>
      </div>

      <div className="mt-8">
        <FeedbackGeneratorClient
          misconceptions={misconceptions.map((m) => ({
            id: m.id,
            code: m.code,
            name: m.name,
            description: m.description,
            existingTemplates: m.templates.length,
          }))}
        />
      </div>
    </main>
  );
}

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
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Chỉ instructor hoặc admin mới truy cập được.
        </p>
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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/instructor/courses" className="text-sm underline">
        ← Khóa của tôi
      </Link>
      <h1 className="mt-3 text-2xl font-bold">🪄 AI Feedback Generator</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Chọn misconception → AI sinh feedback body → review → save làm template.
        Khi học viên trả lời sai vào option có misconception này, hệ feedback
        engine sẽ dùng template để render.
      </p>
      <FeedbackGeneratorClient
        misconceptions={misconceptions.map((m) => ({
          id: m.id,
          code: m.code,
          name: m.name,
          description: m.description,
          existingTemplates: m.templates.length,
        }))}
      />
    </main>
  );
}

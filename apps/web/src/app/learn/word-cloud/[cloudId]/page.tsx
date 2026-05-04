import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import WordCloudSubmitPage from "./WordCloudSubmitPage";

export const dynamic = "force-dynamic";

export default async function LearnerWordCloudPage({
  params,
}: {
  params: { cloudId: string };
}) {
  // Get word cloud details without auth check - public page
  const wordCloud = await prisma.wordCloud.findUnique({
    where: { id: params.cloudId },
    select: {
      id: true,
      prompt: true,
      session: {
        select: {
          lesson: {
            select: {
              title: true,
              module: { select: { course: { select: { title: true } } } },
            },
          },
        },
      },
    },
  });

  if (!wordCloud) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100/30 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border-2 border-purple-200 bg-white p-6 shadow-lg">
          {/* Course & Lesson Info */}
          <div className="mb-6 text-center text-xs text-muted">
            <p className="font-semibold">
              {wordCloud.session.lesson.module.course.title}
            </p>
            <p className="mt-1">{wordCloud.session.lesson.title}</p>
          </div>

          {/* Word Cloud Content */}
          <WordCloudSubmitPage wordCloud={wordCloud} />
        </div>
      </div>
    </main>
  );
}

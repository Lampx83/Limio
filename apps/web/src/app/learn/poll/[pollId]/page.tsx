import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import PollVotingPage from "./PollVotingPage";

export const dynamic = "force-dynamic";

export default async function LearnerPollPage({
  params,
}: {
  params: { pollId: string };
}) {
  // Get poll details without auth check - public page
  const poll = await prisma.classroomPoll.findUnique({
    where: { id: params.pollId },
    select: {
      id: true,
      question: true,
      options: true,
      isAnonymous: true,
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

  if (!poll) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100/30 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border-2 border-brand-200 bg-white p-6 shadow-lg">
          {/* Course & Lesson Info */}
          <div className="mb-6 text-center text-xs text-muted">
            <p className="font-semibold">
              {poll.session.lesson.module.course.title}
            </p>
            <p className="mt-1">{poll.session.lesson.title}</p>
          </div>

          {/* Poll Content */}
          <PollVotingPage poll={poll} />
        </div>
      </div>
    </main>
  );
}

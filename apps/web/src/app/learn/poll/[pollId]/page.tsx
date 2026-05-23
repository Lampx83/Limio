import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import PollVotingPage from "./PollVotingPage";

export const dynamic = "force-dynamic";

export default async function LearnerPollPage({
  params,
}: {
  params: { pollId: string };
}) {
  console.log("[learn/poll/[pollId]] Attempting to load poll:", params.pollId);

  try {
    // Get poll details without auth check - public page
    const poll = await prisma.classroomPoll.findUnique({
      where: { id: params.pollId },
      include: {
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

    console.log("[learn/poll/[pollId]] Prisma query result:", {
      found: !!poll,
      pollId: poll?.id,
      hasSession: !!poll?.session,
      hasLesson: !!poll?.session?.lesson,
    });

    if (!poll) {
      console.log("[learn/poll/[pollId]] Poll not found in database, returning 404 for pollId:", params.pollId);
      notFound();
    }

    // Transform the poll data to match the expected type for PollVotingPage
    const pollData = {
      id: poll.id,
      question: poll.question,
      options: poll.options,
      isAnonymous: poll.isAnonymous,
      session: {
        lesson: poll.session?.lesson || null,
      },
    };

    return (
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 min-h-screen bg-gradient-to-br from-brand-50 to-brand-100/30">
        <div className="mx-auto max-w-md">
          <div className="rounded-2xl border-2 border-brand-200 bg-white p-6 shadow-lg">
            {/* Course & Lesson Info - only show if lesson exists */}
            {pollData.session.lesson && (
              <div className="mb-6 text-center text-xs text-muted">
                <p className="font-semibold">
                  {pollData.session.lesson.module.course.title}
                </p>
                <p className="mt-1">{pollData.session.lesson.title}</p>
              </div>
            )}

            {/* Poll Content */}
            <PollVotingPage poll={pollData} />
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error("[learn/poll/[pollId]] Error loading poll:", error);
    notFound();
  }
}

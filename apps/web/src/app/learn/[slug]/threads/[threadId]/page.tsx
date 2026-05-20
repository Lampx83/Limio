import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ForumError, getThread, isUserEnrolled } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import ThreadReplyForm from "./ThreadReplyForm";
import MarkResolvedButton from "./MarkResolvedButton";
import { EmptyState, UserAvatar, DateTime, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ThreadPage({
  params,
}: {
  params: { slug: string; threadId: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/signin?callbackUrl=/learn/${params.slug}/threads/${params.threadId}`,
    );
  }
  const userId = session.user.id;

  let thread;
  try {
    thread = await getThread(params.threadId);
  } catch (e) {
    if (e instanceof ForumError) notFound();
    throw e;
  }
  if (thread.lesson.module.course.slug !== params.slug) notFound();

  const course = await prisma.course.findUniqueOrThrow({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!(await isUserEnrolled(userId, course.id))) {
    redirect(`/catalog/${params.slug}`);
  }

  const isAuthor = thread.author.id === userId;
  const isResolvedThread = !!thread.resolvedPostId;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 pb-32">
      <Link
        href={`/learn/${params.slug}/lessons/${thread.lesson.id}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {thread.lesson.title}
      </Link>

      {/* OP article */}
      <article className="mt-6 card">
        <header className="flex items-start gap-3 border-b border-token pb-4">
          <UserAvatar name={thread.author.displayName} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h-display text-h3">{thread.title}</h1>
              {isResolvedThread && (
                <StatusBadge tone="success">Đã giải quyết</StatusBadge>
              )}
            </div>
            <p className="mt-1 text-caption">
              <span className="font-medium text-muted">
                {thread.author.displayName}
              </span>
              <span className="mx-1.5" aria-hidden>·</span>
              <DateTime value={thread.createdAt} format="datetime" />
            </p>
          </div>
        </header>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
          {thread.body}
        </p>
      </article>

      {/* Replies */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">
          Trả lời{" "}
          <span className="text-sm font-normal text-faint">
            ({thread.posts.length})
          </span>
        </h2>
        {thread.posts.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon="💬"
              title="Chưa có ai trả lời"
              description="Hãy là người đầu tiên giúp đỡ — kéo xuống dưới hoặc dùng form ở dưới cùng để trả lời."
            />
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {thread.posts.map((p) => {
              const isResolved = thread.resolvedPostId === p.id;
              return (
                <li
                  key={p.id}
                  className={`overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-card ${
                    isResolved ? "border-success-300" : "border-token"
                  }`}
                >
                  {isResolved && (
                    <div className="flex items-center gap-1.5 bg-success-50 px-4 py-1.5 text-xs font-semibold text-success-700">
                      <span aria-hidden>✓</span>
                      Câu trả lời được chấp nhận
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <UserAvatar name={p.author.displayName} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {p.author.displayName}
                          </p>
                          <p className="mt-0.5 text-caption">
                            <DateTime value={p.createdAt} format="relative" />
                          </p>
                        </div>
                      </div>
                      {isAuthor && !isResolved && (
                        <MarkResolvedButton threadId={thread.id} postId={p.id} />
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                      {p.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Reply form — sticky bottom on mobile */}
      <div
        id="reply"
        className="mt-8 lg:static lg:rounded-2xl lg:border lg:border-token lg:bg-[rgb(var(--surface))] lg:p-5 lg:shadow-card
          fixed bottom-0 left-0 right-0 z-30 border-t border-token bg-[rgb(var(--surface))] p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 1rem)" }}
      >
        <ThreadReplyForm threadId={thread.id} />
      </div>
    </main>
  );
}

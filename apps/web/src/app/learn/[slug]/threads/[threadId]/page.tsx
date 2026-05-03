import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ForumError, getThread, isUserEnrolled } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import ThreadReplyForm from "./ThreadReplyForm";
import MarkResolvedButton from "./MarkResolvedButton";

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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/learn/${params.slug}/lessons/${thread.lesson.id}`}
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← {thread.lesson.title}
      </Link>

      {/* OP article */}
      <article className="mt-6 card">
        <header className="flex items-start gap-3 border-b border-token pb-4">
          <Avatar name={thread.author.displayName} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h-display text-2xl font-bold">{thread.title}</h1>
              {isResolvedThread && (
                <span className="chip-success">✓ Đã giải quyết</span>
              )}
            </div>
            <p className="mt-1 text-xs text-faint">
              <span className="font-medium text-muted">
                {thread.author.displayName}
              </span>
              <span className="mx-1.5">·</span>
              {new Date(thread.createdAt).toLocaleString("vi-VN")}
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
          💬 Trả lời{" "}
          <span className="text-sm font-normal text-faint">
            ({thread.posts.length})
          </span>
        </h2>
        {thread.posts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-token p-8 text-center text-sm text-faint">
            Chưa có ai trả lời. Bạn có thể là người đầu tiên!
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {thread.posts.map((p) => {
              const isResolved = thread.resolvedPostId === p.id;
              return (
                <li
                  key={p.id}
                  className={`overflow-hidden rounded-2xl border bg-[rgb(var(--surface))] shadow-card ${
                    isResolved ? "border-success-200" : "border-token"
                  }`}
                >
                  {isResolved && (
                    <div className="flex items-center gap-1.5 bg-success-50 px-4 py-1.5 text-xs font-semibold text-success-700">
                      <span>✓</span>
                      Câu trả lời được chấp nhận
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar name={p.author.displayName} sm />
                        <div>
                          <p className="text-sm font-medium leading-tight">
                            {p.author.displayName}
                          </p>
                          <p className="mt-0.5 text-xs text-faint">
                            {new Date(p.createdAt).toLocaleString("vi-VN")}
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
          </ul>
        )}
      </section>

      <div className="mt-8">
        <ThreadReplyForm threadId={thread.id} />
      </div>
    </main>
  );
}

function Avatar({ name, sm }: { name: string; sm?: boolean }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const size = sm ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-gradient font-semibold text-white shadow-sm ${size}`}
    >
      {initial}
    </span>
  );
}

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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href={`/learn/${params.slug}/lessons/${thread.lesson.id}`}
        className="text-sm underline"
      >
        ← {thread.lesson.title}
      </Link>

      <article className="mt-6 rounded-lg border border-slate-300 p-5 dark:border-slate-700">
        <h1 className="text-2xl font-bold">
          {thread.resolvedPostId && (
            <span className="mr-2 text-emerald-600">✓</span>
          )}
          {thread.title}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {thread.author.displayName} ·{" "}
          {new Date(thread.createdAt).toLocaleString("vi-VN")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm">{thread.body}</p>
      </article>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">
          Trả lời ({thread.posts.length})
        </h2>
        <ul className="mt-3 space-y-3">
          {thread.posts.map((p) => {
            const isResolved = thread.resolvedPostId === p.id;
            return (
              <li
                key={p.id}
                className={`rounded-lg border p-3 text-sm ${
                  isResolved
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-xs">
                    {isResolved && (
                      <span className="mr-1 font-medium text-emerald-700 dark:text-emerald-300">
                        ✓ Câu trả lời được chấp nhận
                      </span>
                    )}
                    <span className="font-medium">{p.author.displayName}</span>
                    <span className="ml-2 text-slate-500">
                      {new Date(p.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </p>
                  {isAuthor && !isResolved && (
                    <MarkResolvedButton threadId={thread.id} postId={p.id} />
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap">{p.body}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <ThreadReplyForm threadId={thread.id} />
    </main>
  );
}

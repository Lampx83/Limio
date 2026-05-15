import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import ResultForm from "./ResultForm";

export const dynamic = "force-dynamic";

/**
 * A5.8 Q6 — Re-enter-code result lookup. URL pattern matches the claim page so
 * a candidate that bookmarked /exam/[code] can append `/result`.
 *
 * Server-side resolves mode (open vs assigned) so the form knows whether to
 * prompt for email. Invalid code → 404 (no leak).
 */
export default async function ExamResultPage({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code.trim().toUpperCase();
  let mode: "open" | "assigned" | null = null;
  let examTitle: string | null = null;

  if (code.length === 6) {
    const e = await prisma.exam.findUnique({
      where: { openCode: code },
      select: { title: true, accessMode: true },
    });
    if (e && e.accessMode === "open_code") {
      mode = "open";
      examTitle = e.title;
    }
  } else if (code.length === 8) {
    const c = await prisma.examCandidate.findFirst({
      where: { accessCode: code },
      select: { exam: { select: { title: true, accessMode: true } } },
    });
    if (c && c.exam.accessMode === "assigned_code") {
      mode = "assigned";
      examTitle = c.exam.title;
    }
  }

  if (!mode) notFound();

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{examTitle}</h1>
      <p className="mt-1 text-sm text-faint">
        Nhập mã thi {mode === "open" ? "+ email đã đăng ký" : ""} để xem điểm
      </p>
      <ResultForm code={code} mode={mode} />
    </main>
  );
}

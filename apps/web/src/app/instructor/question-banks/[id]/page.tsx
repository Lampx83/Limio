import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listBanks, searchQuestions } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import BankWorkbench from "./BankWorkbench";
import {
  ChevronLeft,
  Library,
  Lock,
  Users,
  Globe,
  Calendar,
  HelpCircle,
  BookOpen,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function QuestionBankWorkbenchPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=/instructor/question-banks/${params.id}`);
  const userId = session.user.id;

  // Confirm actor can see this bank (visibility-aware) before SSR-loading.
  const visible = await listBanks(userId);
  const bank = visible.find((b) => b.id === params.id);
  if (!bank) notFound();

  const initial = await searchQuestions(userId, { bankIds: [params.id], limit: 50 });

  // Skill list for quick-pick — only return ones used in the bank for hint;
  // SkillPicker still queries /api/skills?q=...
  const skillsInBank = await prisma.bankQuestionSkillTag.findMany({
    where: { bankQuestion: { bankId: params.id } },
    select: { skill: { select: { id: true, code: true, name: true } } },
    distinct: ["skillId"],
  });

  const visibility = (bank as { visibility?: string }).visibility ?? "private";
  const visMeta =
    visibility === "course"
      ? { icon: Users, label: "Chia sẻ trong khoá", tone: "text-blue-700 bg-blue-50" }
      : visibility === "public"
      ? { icon: Globe, label: "Công khai", tone: "text-amber-700 bg-amber-50" }
      : { icon: Lock, label: "Riêng tư", tone: "text-slate-700 bg-slate-100" };

  const updatedAt = new Date(bank.updatedAt);
  const updatedLabel = updatedAt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const VisIcon = visMeta.icon;

  return (
    <main>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link
          href="/instructor/question-banks"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          <Library className="h-3.5 w-3.5" aria-hidden />
          <span>Ngân hàng câu hỏi</span>
        </Link>
        <span className="text-slate-300" aria-hidden>
          /
        </span>
        <span className="truncate text-slate-700">{bank.name}</span>
      </nav>

      {/* Header card */}
      <header className="mt-4 overflow-hidden rounded-xl border border-default bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5 p-5 sm:p-6">
          {/* Left: icon + title + description */}
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-emerald-50 text-brand-700 ring-1 ring-brand-100 sm:flex">
              <BookOpen className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {bank.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${visMeta.tone}`}
                >
                  <VisIcon className="h-3 w-3" aria-hidden />
                  {visMeta.label}
                </span>
              </div>
              {bank.description && (
                <p className="line-clamp-2 max-w-2xl text-sm text-slate-600">
                  {bank.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                  <span className="font-semibold tabular-nums text-slate-700">
                    {bank.questionCount}
                  </span>
                  câu hỏi
                </span>
                {bank.courseTitle && (
                  <Link
                    href={`/instructor/courses`}
                    className="inline-flex items-center gap-1 hover:text-slate-700 hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    {bank.courseTitle}
                  </Link>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  Cập nhật {updatedLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    bank.isOwner ? "text-emerald-700" : "text-blue-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      bank.isOwner ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                    aria-hidden
                  />
                  {bank.isOwner ? "Bạn là chủ sở hữu" : "Được chia sẻ"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <BankWorkbench
        bankId={params.id}
        initialItems={initial.items}
        initialCursor={initial.nextCursor}
        suggestedSkills={skillsInBank.map((s) => s.skill)}
      />
    </main>
  );
}

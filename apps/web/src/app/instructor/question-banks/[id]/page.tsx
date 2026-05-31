import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listBanks, searchQuestions } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import BankWorkbench from "./BankWorkbench";
import { formatDate } from "@/lib/datetime";
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

  // Load codePrefix tách riêng vì listBanks chưa expose (giữ payload list nhẹ).
  const bankFull = await prisma.questionBank.findUnique({
    where: { id: params.id },
    select: { codePrefix: true },
  });

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

  const updatedLabel = formatDate(bank.updatedAt);

  const VisIcon = visMeta.icon;

  return (
    <main>
      {/* Header gộp 1 dòng: breadcrumb + title + visibility + meta inline */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Link
          href="/instructor/question-banks"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          title="Về danh sách ngân hàng"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          <Library className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <BookOpen className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        <h1
          className="min-w-0 truncate text-base font-semibold text-slate-900 sm:text-lg"
          title={bank.description ?? bank.name}
        >
          {bank.name}
        </h1>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${visMeta.tone}`}
          title={visMeta.label}
        >
          <VisIcon className="h-3 w-3" aria-hidden />
          {visMeta.label}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span
            className="inline-flex items-center gap-1"
            title={`${bank.questionCount} câu hỏi`}
          >
            <HelpCircle className="h-3 w-3" aria-hidden />
            <span className="font-semibold tabular-nums text-slate-700">
              {bank.questionCount}
            </span>
            câu
          </span>
          {bank.courseTitle && (
            <Link
              href={`/instructor/courses`}
              className="inline-flex items-center gap-1 hover:text-slate-700 hover:underline"
              title={bank.courseTitle}
            >
              <BookOpen className="h-3 w-3" aria-hidden />
              <span className="max-w-[140px] truncate">{bank.courseTitle}</span>
            </Link>
          )}
          <span
            className="inline-flex items-center gap-1"
            title={`Cập nhật ${updatedLabel}`}
          >
            <Calendar className="h-3 w-3" aria-hidden />
            {updatedLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${
              bank.isOwner ? "text-emerald-700" : "text-blue-700"
            }`}
            title={bank.isOwner ? "Bạn là chủ sở hữu" : "Được chia sẻ"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                bank.isOwner ? "bg-emerald-500" : "bg-blue-500"
              }`}
              aria-hidden
            />
            {bank.isOwner ? "Chủ sở hữu" : "Chia sẻ"}
          </span>
        </div>
      </header>

      <BankWorkbench
        bankId={params.id}
        initialCodePrefix={bankFull?.codePrefix ?? null}
        initialItems={initial.items}
        initialCursor={initial.nextCursor}
        suggestedSkills={skillsInBank.map((s) => s.skill)}
      />
    </main>
  );
}

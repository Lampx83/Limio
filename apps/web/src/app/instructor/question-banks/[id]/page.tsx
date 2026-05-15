import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listBanks, searchQuestions } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import BankWorkbench from "./BankWorkbench";

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

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <Link
        href="/instructor/question-banks"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Question Bank
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{bank.name}</h1>
          <p className="mt-1 text-xs text-faint">
            {bank.questionCount} câu hỏi · {bank.isOwner ? "Bạn là chủ sở hữu" : "Chia sẻ qua khoá"}
            {bank.courseTitle ? ` · ${bank.courseTitle}` : ""}
          </p>
        </div>
      </div>

      <BankWorkbench
        bankId={params.id}
        initialItems={initial.items}
        initialCursor={initial.nextCursor}
        suggestedSkills={skillsInBank.map((s) => s.skill)}
      />
    </main>
  );
}

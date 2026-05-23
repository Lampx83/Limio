import Link from "next/link";
import { redirect } from "next/navigation";
import { Library } from "lucide-react";
import { listBanks } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import BankListClient from "./BankListClient";

export const dynamic = "force-dynamic";

export default async function QuestionBanksHubPage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/signin?callbackUrl=/instructor/question-banks");
  const userId = session.user.id;

  const banks = await listBanks(userId);
  const courses = await prisma.courseInstructor.findMany({
    where: { userId },
    select: { course: { select: { id: true, title: true } } },
  });

  return (
    <main>
      <Link href="/instructor/dashboard" className="text-sm text-blue-600 hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Library className="h-6 w-6 shrink-0 text-amber-600" /> Ngân hàng câu hỏi</h1>
          <p className="mt-1 text-sm text-faint">
            {banks.length} bank · câu hỏi tái sử dụng cross-exam
          </p>
        </div>
      </div>

      <BankListClient initialBanks={banks} availableCourses={courses.map((c) => c.course)} />
    </main>
  );
}

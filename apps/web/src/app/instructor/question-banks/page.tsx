import { redirect } from "next/navigation";
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
      <BankListClient initialBanks={banks} availableCourses={courses.map((c) => c.course)} />
    </main>
  );
}

import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import QuestionSetEditorClient from "./QuestionSetEditorClient";

export const dynamic = "force-dynamic";

export default async function QuestionSetEditorPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/gameshow/question-sets/${params.id}`);
  }
  const userId = session.user.id;

  const set = await prisma.gameQuestionSet.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  });
  if (!set) notFound();
  if (set.ownerId !== userId) redirect("/instructor/gameshow/question-sets");

  return <QuestionSetEditorClient setId={params.id} />;
}

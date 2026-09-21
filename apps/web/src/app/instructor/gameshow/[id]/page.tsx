import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import HostGameClient from "./HostGameClient";

export const dynamic = "force-dynamic";

export default async function HostGameshowPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/instructor/gameshow/${params.id}`);
  }
  const userId = session.user.id;

  const gameSession = await prisma.gameSession.findUnique({
    where: { id: params.id },
    select: { id: true, hostId: true, theme: true },
  });
  if (!gameSession) notFound();
  if (gameSession.hostId !== userId) redirect("/instructor/gameshow/new");

  return <HostGameClient sessionId={params.id} theme={gameSession.theme} />;
}

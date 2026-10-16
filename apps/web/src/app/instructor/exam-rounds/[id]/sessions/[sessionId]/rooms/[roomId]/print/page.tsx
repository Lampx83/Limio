import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyRoomPrintRedirect({
  params,
}: {
  params: { id: string; sessionId: string; roomId: string };
}) {
  redirect(
    `/instructor/exam-sessions/${params.sessionId}/rooms/${params.roomId}/print`,
  );
}

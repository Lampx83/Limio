import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Trang ca đã chuyển ra khỏi route đợt (ca có thể không thuộc đợt nào). */
export default function LegacySessionRedirect({
  params,
  searchParams,
}: {
  params: { id: string; sessionId: string };
  searchParams: { tab?: string };
}) {
  const q = searchParams.tab ? `?tab=${encodeURIComponent(searchParams.tab)}` : "";
  redirect(`/instructor/exam-sessions/${params.sessionId}${q}`);
}

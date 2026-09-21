import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getLiveJoinState } from "@/lib/limioLiveJoin";
import { normalizeJoinCode } from "@feedbackme/core-lms";
import LiveJoinClient from "./LiveJoinClient";

export const dynamic = "force-dynamic";

// Học viên quét QR MỘT LẦN cho cả phiên trình chiếu; trang tự theo slide tương tác giảng viên chiếu.
export default async function LearnerLiveSessionPage({ params }: { params: { code: string } }) {
  const code = normalizeJoinCode(params.code);
  if (!code) notFound();

  const state = await getLiveJoinState(code);
  if (state.status === "not_found") notFound();

  if (state.status !== "ended" && "identityMode" in state && state.identityMode === "login") {
    const session = await auth();
    if (!session?.user?.id) redirect(`/signin?callbackUrl=${encodeURIComponent(`/learn/live/${code}`)}`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl bg-gradient-to-br from-brand-50 to-brand-100/30 px-4 py-6 lg:px-6">
      <div className="mx-auto max-w-md">
        <LiveJoinClient code={code} initial={state} />
      </div>
    </main>
  );
}

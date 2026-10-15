import { NextResponse } from "next/server";
import { resolveLobbyTarget } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { touchLobby } from "@/lib/exam-lobby-presence";
import { checkExamNetwork, networkBlockedResponse } from "@/lib/exam-network";

export const runtime = "nodejs";

/**
 * POST /api/exam-lobby/[code] — nhịp tim của học viên đang ở lobby.
 *
 * Trả về pha của ca để trang lobby biết khi nào chuyển sang bước vào thi. Không
 * tạo lượt làm và không đếm giờ; chỉ ghi nhận đang có mặt để giảng viên và giám
 * thị thấy số người chờ.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const target = await resolveLobbyTarget(params.code);
  if (!target) return NextResponse.json({ error: "invalid_code" }, { status: 404 });
  if (!target.ready) return NextResponse.json({ error: "not_ready" }, { status: 409 });

  // Ngoài mạng được phép thì không chờ ở đây: không ghi nhận có mặt.
  const net = await checkExamNetwork(target.examId, req.headers);
  if (!net.allowed) return networkBlockedResponse(net);

  if (target.phase === "lobby" || target.phase === "open")
    await touchLobby(target.sessionId, userId);

  return NextResponse.json({
    phase: target.phase,
    mode: target.mode,
    examTitle: target.examTitle,
    opensAt: target.opensAt.toISOString(),
    closesAt: target.closesAt?.toISOString() ?? null,
  });
}

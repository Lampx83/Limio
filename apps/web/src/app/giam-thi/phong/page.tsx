import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { getProctorRoomView } from "@feedbackme/core-lms";
import {
  PROCTOR_SESSION_COOKIE,
  verifyProctorSession,
} from "@/lib/proctor-session";
import RoomBoard from "./RoomBoard";

export const dynamic = "force-dynamic";

/**
 * Màn giám thị. Quyền đến từ cookie đổi bằng mã phòng — không cần tài khoản.
 *
 * Tự làm mới 15 giây một lần: giám thị để máy mở suốt ca, cần thấy ai vừa vào
 * mà không phải bấm gì. 15s đủ chậm để không quấy DB với vài chục phòng.
 */
export default async function ProctorRoomPage() {
  const token = cookies().get(PROCTOR_SESSION_COOKIE)?.value;
  const payload = token ? verifyProctorSession(token) : null;
  if (!payload) redirect("/giam-thi");

  const view = await getProctorRoomView(payload.roomId).catch(() => null);
  if (!view) redirect("/giam-thi");

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <meta httpEquiv="refresh" content="15" />
      <div className="mb-4">
        <h1 className="text-xl font-bold">{view.roomName}</h1>
        <p className="mt-0.5 text-sm text-faint">
          {view.examTitle}
          {view.sessionTitle ? ` · ${view.sessionTitle}` : ""}
        </p>
        {view.locationNote && (
          <p className="mt-1 inline-flex items-center gap-1 text-caption text-faint">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {view.locationNote}
          </p>
        )}
      </div>

      <RoomBoard view={view} />
    </main>
  );
}

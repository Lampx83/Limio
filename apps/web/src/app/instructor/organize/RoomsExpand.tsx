"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Radio } from "lucide-react";
import type { OrganizerRoomRow } from "@feedbackme/core-lms";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";

/**
 * Các phòng của một ca, bung ra ngay dưới thẻ.
 *
 * Tải khi mở chứ không tải sẵn: danh sách có thể có hàng chục ca, nạp phòng
 * cho tất cả chỉ để phần lớn không ai xem là phí một loạt truy vấn.
 */
export default function RoomsExpand({
  sessionId,
  courseId,
  examId,
}: {
  sessionId: string;
  courseId: string | null;
  examId: string;
}) {
  const [rooms, setRooms] = useState<OrganizerRoomRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/exam-sessions/${sessionId}/rooms-detail`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((j: { rooms: OrganizerRoomRow[] }) => alive && setRooms(j.rooms))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [sessionId]);

  if (err)
    return (
      <p className="w-full border-t border-default pt-2 text-caption text-red-700">
        Không tải được danh sách phòng.
      </p>
    );
  if (!rooms)
    return (
      <p className="w-full border-t border-default pt-2 text-caption text-faint">
        Đang tải phòng thi…
      </p>
    );
  if (rooms.length === 0)
    return (
      <p className="w-full border-t border-default pt-2 text-caption text-faint">
        Ca này chưa có phòng nào.
      </p>
    );

  return (
    <div className="w-full border-t border-default pt-3">
      <ul className="space-y-2">
        {rooms.map((r) => (
          <RoomRow key={r.roomId} r={r} courseId={courseId} examId={examId} />
        ))}
      </ul>
      <p className="mt-2 text-caption text-amber-800">
        Mã giám thị gửi riêng cho người coi thi — đừng chiếu lên màn hay in vào
        phiếu thí sinh.
      </p>
    </div>
  );
}

function RoomRow({
  r,
  courseId,
  examId,
}: {
  r: OrganizerRoomRow;
  courseId: string | null;
  examId: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = shareUrl("/giam-thi");

  const copy = async () => {
    const ok = await copyText(`${url} — mã: ${r.proctorCode}`);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <li className="rounded-md border border-default bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{r.name}</span>
        <span className="text-caption text-faint">
          Giám thị: {r.proctorName}
          {r.locationNote ? ` · ${r.locationNote}` : ""}
        </span>
        <span className="ml-auto flex items-center gap-3 text-caption tabular-nums text-faint">
          <span>{r.arrived}/{r.candidates} có mặt</span>
          <span>{r.submitted}/{r.started} đã nộp</span>
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className="text-caption text-faint">Mã giám thị</span>
        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-sm font-semibold tracking-widest">
          {r.proctorCode}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-default p-1 hover:bg-slate-50"
          aria-label={`Sao chép link và mã giám thị phòng ${r.name}`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <Link
          href={`/instructor/courses/${courseId ?? "none"}/exams/${examId}/live?roomId=${r.roomId}`}
          className="inline-flex items-center gap-1 rounded border border-default px-2 py-1 text-xs hover:bg-slate-50"
        >
          <Radio className="h-3 w-3 shrink-0 text-red-500" />
          Giám sát phòng
        </Link>
      </div>
    </li>
  );
}

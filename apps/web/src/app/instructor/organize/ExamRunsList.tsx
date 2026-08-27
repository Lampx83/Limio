"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, Download, QrCode, Radio } from "lucide-react";
import dynamic from "next/dynamic";
import RoomsExpand from "./RoomsExpand";
import type { ExamRun } from "@feedbackme/core-lms";
import { apiUrl, shareUrl } from "@/lib/apiUrl";

/** Kích thước QR: đủ to để quét từ cuối lớp khi chiếu lên máy chiếu. */
const QR_SIZE = 220;

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-lg border border-emerald-300 bg-white"
        style={{ width: QR_SIZE, height: QR_SIZE }}
      />
    ),
  },
);

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

/**
 * Lịch sử các lần thi CÙNG MỘT DẠNG.
 *
 * Mỗi hình thức tổ chức có trang riêng, và lịch sử tách theo hình thức chứ
 * không gộp một chỗ: kỳ thi chính thức cần thấy ca/phòng/giám thị, còn link nhanh
 * chỉ cần mã và số người nộp.
 */
export default function ExamRunsList({
  runs,
  emptyHint,
  showRooms = false,
}: {
  runs: ExamRun[];
  emptyHint?: string;
  /** Bung ra danh sách phòng + mã giám thị. Chỉ bật ở kỳ thi chính thức: thi
      nhanh mỗi ca đúng một phòng mặc định, bung ra là thêm bấm cho không. */
  showRooms?: boolean;
}) {
  const open = runs.filter((r) => r.isOpen);
  const past = runs.filter((r) => !r.isOpen);

  if (runs.length === 0) {
    return (
      <p className="rounded-lg border border-default bg-white px-4 py-6 text-center text-sm text-faint">
        {emptyHint ?? "Chưa có lần thi nào."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">
            Đang mở <span className="font-normal text-faint">· {open.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {open.map((r) => (
              <Row key={r.sessionId} r={r} showRooms={showRooms} />
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">
            Đã đóng <span className="font-normal text-faint">· {past.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <Row key={r.sessionId} r={r} showRooms={showRooms} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ r, showRooms }: { r: ExamRun; showRooms: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [openRooms, setOpenRooms] = useState(false);

  // Lần thi dùng mã cấp riêng hoặc vào bằng tài khoản thì không có link chung
  // để phát cho cả lớp.
  // shareUrl lo phần tiền tố đường dẫn của production — ghép tay với
  // window.location.origin thì ra link thiếu tiền tố, người nhận bấm vào 404.
  const fullUrl = r.path ? shareUrl(r.path) : "";

  const copy = async () => {
    // Nói thật khi hỏng. Bản cũ nuốt lỗi im lặng: clipboard giữ nguyên nội
    // dung cũ mà giao diện không báo gì, người dùng dán ra thứ chẳng liên quan
    // rồi tưởng app copy sai.
    const ok = await copyText(fullUrl);
    if (!ok) {
      setCopyErr(true);
      setTimeout(() => setCopyErr(false), 4000);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggle = async (open: boolean) => {
    if (
      !open &&
      !confirm(`Đóng buổi thi "${r.examTitle}"? Người đang làm vẫn làm hết giờ.`)
    )
      return;
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/exam-sessions/${r.sessionId}/open-state`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ open }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
        r.isOpen
          ? "border-emerald-300 bg-emerald-50"
          : "border-default bg-white"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`font-mono text-base font-semibold tracking-widest ${
            r.isOpen ? "text-emerald-900" : "text-faint"
          }`}
        >
          {r.code ??
            (r.accessMode === "assigned_code" ? "mã riêng" : "ghi danh")}
        </span>
        {r.isOpen && r.code && (
          <button
            type="button"
            onClick={copy}
            className="rounded p-1 text-emerald-800 hover:bg-emerald-100"
            aria-label={`Sao chép link buổi thi ${r.examTitle}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {r.isOpen && r.code && fullUrl && (
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className={`rounded p-1 text-emerald-800 hover:bg-emerald-100 ${
              showQr ? "bg-emerald-100" : ""
            }`}
            aria-label={
              showQr
                ? `Ẩn mã QR buổi thi ${r.examTitle}`
                : `Hiện mã QR để chiếu cho lớp — buổi thi ${r.examTitle}`
            }
            title={showQr ? "Ẩn mã QR" : "Hiện mã QR để chiếu cho lớp"}
          >
            <QrCode className="h-3.5 w-3.5" />
          </button>
        )}
      </span>

      {/* min-w-48 chứ không min-w-0: khối này chứa TÊN ĐỀ, thứ giáo viên
          dùng để nhận ra dòng nào là dòng nào. Cho nó co vô hạn thì mọi nút
          khác giành hết chỗ và tên đề cụt thành "Bài kiểm tra ...". Có sàn thì
          khi chật, cụm nút xuống dòng — dài thêm một dòng còn hơn mất tên. */}
      <span className="min-w-48 flex-1">
        <span className="block truncate text-sm font-medium">{r.examTitle}</span>
        {r.startedCount > r.submittedCount && (
          <span className="block text-caption text-amber-700">
            {r.startedCount - r.submittedCount} người đang làm dở
          </span>
        )}
        {copyErr && (
          <span className="block text-caption text-red-700">
            Không sao chép được — đọc mã cho lớp hoặc bôi đen rồi copy tay.
          </span>
        )}
        <span className="block text-caption text-faint">
          {fmt(r.opensAt)} · {r.durationMin} phút
          {r.isOpen && !r.closesAt ? " · đóng khi bạn bấm" : ""}
          {r.closesAt ? ` · đóng ${fmt(r.closesAt)}` : ""}
        </span>
      </span>

      {/* Số bài đã nộp, kiểu Google Form: nhãn + số trong vòng tròn đậm.
          Trước đây nó nằm lẫn trong dòng phụ ("0/0 đã nộp") giữa giờ mở và
          thời lượng — thứ giáo viên mở trang này để xem đầu tiên lại là thứ
          khó thấy nhất.

          Đếm bài ĐÃ NỘP, không đếm bài đã bắt đầu: người mở đề rồi bỏ ngang
          chưa phải một lượt thi. Số đang làm dở hiện riêng, và chỉ khi có. */}
      <Link
        href={`/instructor/exam-runs/${r.sessionId}`}
        className="flex shrink-0 items-center gap-2 rounded px-1 py-0.5 hover:bg-black/5"
        title={`${r.submittedCount} bài đã nộp — bấm để xem chi tiết`}
      >
        <span className="text-sm text-ink-2">Bài đã nộp</span>
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-800 px-1.5 text-sm font-semibold tabular-nums text-white">
          {r.submittedCount}
        </span>
      </Link>

      <span className="flex shrink-0 items-center gap-2">
        {/* Giám sát: xem ai đang làm tới đâu. Có cả khi ca ĐÃ ĐÓNG — lúc đó
            màn hình chuyển sang "Xem lại", giữ nguyên toàn bộ bài làm của ca.
            Trang đó vốn lọc 24h gần nhất; truyền sessionId thì bỏ cửa sổ đó,
            vì chính ca đã bó tập bài làm rồi. */}
        <Link
          href={`/instructor/courses/${r.courseId}/exams/${r.examId}/live?sessionId=${r.sessionId}`}
          className="inline-flex items-center gap-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
          title={
            r.isOpen
              ? "Xem ai đang làm bài, tới câu nào"
              : "Xem lại diễn biến của ca đã đóng"
          }
        >
          <Radio
            className={`h-3 w-3 shrink-0 ${r.isOpen ? "text-red-500" : "text-faint"}`}
          />
          {r.isOpen ? "Giám sát" : "Xem lại"}
        </Link>
        <Link
          href={`/instructor/exam-runs/${r.sessionId}`}
          className="text-xs underline"
        >
          Kết quả
        </Link>
        <a
          href={apiUrl(
            `/api/exams/${r.examId}/results?sessionId=${r.sessionId}`,
          )}
          className="inline-flex items-center gap-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
          title="Tải kết quả thí sinh của lần thi này"
        >
          <Download className="h-3 w-3 shrink-0" />
          Tải
        </a>
        {showRooms && (
          <button
            type="button"
            onClick={() => setOpenRooms((v) => !v)}
            aria-expanded={openRooms}
            className="inline-flex items-center gap-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
            title="Xem các phòng của ca này và mã giám thị từng phòng"
          >
            <ChevronDown
              className={`h-3 w-3 shrink-0 transition-transform ${
                openRooms ? "rotate-180" : ""
              }`}
            />
            Phòng thi
          </button>
        )}
        {r.timingMode === "manual" && (
          <button
            type="button"
            onClick={() => toggle(!r.isOpen)}
            disabled={busy}
            /* Đóng ca là hành động cắt dòng người đang vào thi — tô đỏ sẫm để
               không ai bấm nhầm khi đang lướt qua hàng nút. "Mở lại" thì
               không: mở thêm một cánh cửa chẳng hỏng gì. */
            className={
              r.isOpen
                ? "rounded border border-danger-700 bg-danger-700 px-2 py-1 text-xs font-medium text-white hover:bg-danger-600 disabled:opacity-50"
                : "rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
            }
          >
            {busy ? "…" : r.isOpen ? "Đóng" : "Mở lại"}
          </button>
        )}
      </span>

      {/* Bảng chiếu. `w-full` để flex-wrap đẩy nó xuống hẳn một dòng riêng
          thay vì chen vào giữa cụm nút.

          Nền trắng + viền quiet zone: QR đặt trên nền màu hoặc sát mép thì
          máy quét hay không bắt được — nền của thẻ này đang là xanh nhạt. */}
      {showQr && fullUrl && (
        <div className="w-full border-t border-emerald-200 pt-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-lg border border-emerald-300 bg-white p-3">
              <QRCode value={fullUrl} size={QR_SIZE} level="M" />
            </div>
            <div className="min-w-48 flex-1">
              <p className="text-sm text-emerald-900">
                Chiếu lên màn hình để cả lớp quét.
              </p>
              <p className="mt-1 text-sm text-emerald-800">
                Ai không quét được thì vào{" "}
                <span className="font-medium">{shareUrl("/thi")}</span> rồi gõ
                mã:
              </p>
              {/* Mã to hẳn: đây là đường dự phòng khi máy ảnh không bắt được
                  QR, mà lúc đó người gõ đang nhìn từ cuối lớp. */}
              <p className="mt-1 font-mono text-3xl font-semibold tracking-widest text-emerald-900">
                {r.code}
              </p>
            </div>
          </div>
        </div>
      )}

      {openRooms && (
        <RoomsExpand
          sessionId={r.sessionId}
          courseId={r.courseId}
          examId={r.examId}
        />
      )}
    </li>
  );
}

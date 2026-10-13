"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  DoorOpen,
  Download,
  KeyRound,
  Play,
  QrCode,
  Radio,
  Settings2,
  Square,
  Timer,
  UserCheck,
} from "lucide-react";
import dynamic from "next/dynamic";
import QrZoom from "@/components/ui/QrZoom";
import RoomsExpand from "./RoomsExpand";
import type { ExamRun } from "@feedbackme/core-lms";
import { RUN_KIND, runKind } from "./runKind";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { formatTime, formatVN } from "@/lib/datetime";

/** QR hiển thị nhỏ ở góc; bấm vào để phóng popup đủ to cho cả lớp quét (QrZoom). */
const QR_SIZE = 112;

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

/** "16:14 · 09/10" — thêm năm khi khác năm nay (ca đặt hạn đóng tận năm sau
    mà không ghi năm thì trông như đã đóng từ lâu). */
const fmt = (iso: string) => {
  const d = new Date(iso);
  const sameYear =
    formatVN(d, { year: "numeric" }) === formatVN(new Date(), { year: "numeric" });
  // Ghép tay: vi-VN bỏ năm thì in "09-10", dễ đọc nhầm thành khoảng ngày.
  const day = `${formatVN(d, { day: "2-digit" })}/${formatVN(d, { month: "2-digit" })}`;
  return `${formatTime(d)} · ${sameYear ? day : `${day}/${formatVN(d, { year: "numeric" })}`}`;
};

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
  showKind = false,
}: {
  runs: ExamRun[];
  emptyHint?: string;
  /** Bung ra danh sách phòng + mã giám thị — chỉ ở dòng kỳ thi chính thức:
      thi nhanh mỗi ca đúng một phòng mặc định, bung ra là thêm bấm cho không. */
  showRooms?: boolean;
  /** Ghi hình thức tổ chức trên từng dòng — chỉ cần ở trang Lịch sử thi, nơi
      ba hình thức nằm chung một danh sách. */
  showKind?: boolean;
}) {
  const open = runs.filter((r) => r.isOpen);
  const past = runs.filter((r) => !r.isOpen);

  if (runs.length === 0) {
    return (
      <p className="rounded-lg border border-token bg-white px-4 py-6 text-center text-sm text-faint">
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
              <Row key={r.sessionId} r={r} showRooms={showRooms} showKind={showKind} />
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
              <Row key={r.sessionId} r={r} showRooms={showRooms} showKind={showKind} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({
  r,
  showRooms,
  showKind,
}: {
  r: ExamRun;
  showRooms: boolean;
  showKind: boolean;
}) {
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

  const kind = RUN_KIND[runKind(r)];

  return (
    <li className="relative overflow-hidden rounded-xl border border-token bg-white shadow-sm">
      {/* Dải màu bên trái = hình thức thi (xem RUN_KIND). Ca đã đóng giữ màu
          nhưng nhạt đi; trạng thái mở/đóng đọc ở nhãn ngay đầu thẻ. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1.5 ${kind.stripe} ${r.isOpen ? "" : "opacity-40"}`}
      />
      <div className="flex gap-3 px-4 py-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          {/* Dòng nhãn: trạng thái → hình thức → cách vào thi. Mã chung là thứ
              duy nhất cần đọc to cho lớp nên được tô mono; ca không có mã
              chung thì chỉ ghi cách vào, chữ thường — trước đây "ghi danh"
              cũng bị in mono giãn chữ như một cái mã, đọc rất lạ. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {r.isOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Đang mở
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                Đã đóng
              </span>
            )}
            {showKind && (
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${kind.chip}`}>
                {kind.label}
              </span>
            )}
            {r.code ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-token bg-white py-0.5 pl-2 pr-0.5 text-xs">
                <span className="text-faint">Mã</span>
                <span
                  className={`ml-1 font-mono font-semibold tracking-wider ${
                    r.isOpen ? "text-slate-900 dark:text-slate-100" : "text-faint"
                  }`}
                >
                  {r.code}
                </span>
                {r.isOpen && (
                  <button
                    type="button"
                    onClick={copy}
                    className="ml-0.5 rounded-full p-1 text-muted hover:bg-slate-100"
                    aria-label={`Sao chép link buổi thi ${r.examTitle}`}
                    title="Sao chép link vào thi"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                )}
                {r.isOpen && fullUrl && (
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    aria-expanded={showQr}
                    className={`rounded-full p-1 text-muted hover:bg-slate-100 ${
                      showQr ? "bg-slate-100" : ""
                    }`}
                    aria-label={
                      showQr
                        ? `Ẩn mã QR buổi thi ${r.examTitle}`
                        : `Hiện mã QR để chiếu cho lớp — buổi thi ${r.examTitle}`
                    }
                    title={showQr ? "Ẩn mã QR" : "Hiện mã QR để chiếu cho lớp"}
                  >
                    <QrCode className="h-3 w-3" />
                  </button>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-token px-2 py-0.5 text-xs text-muted">
                {r.accessMode === "assigned_code" ? (
                  <>
                    <KeyRound className="h-3 w-3 text-faint" aria-hidden />
                    Mã riêng từng thí sinh
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3 w-3 text-faint" aria-hidden />
                    Học viên đã ghi danh
                  </>
                )}
              </span>
            )}
          </div>

          {/* Tên đề là thứ giáo viên dùng để nhận ra dòng nào là dòng nào —
              cho xuống 2 dòng chứ không cắt cụt. */}
          <h3 className="mt-1 line-clamp-3 text-base sm:line-clamp-2 font-semibold leading-snug">
            {r.examTitle}
          </h3>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-faint">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {fmt(r.opensAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" aria-hidden />
              {r.durationMin} phút
            </span>
            {r.closesAt ? (
              <span>Đóng {fmt(r.closesAt)}</span>
            ) : (
              r.isOpen && <span>Đóng khi bạn bấm</span>
            )}
          </p>

          {r.startedCount > r.submittedCount && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-caption font-medium text-amber-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden />
              {r.startedCount - r.submittedCount} người đang làm dở
            </p>
          )}
          {copyErr && (
            <p className="mt-1 text-caption text-red-700">
              Không sao chép được — đọc mã cho lớp hoặc bôi đen rồi copy tay.
            </p>
          )}
        </div>

        {/* Số bài đã nộp — thứ giáo viên mở trang này để xem đầu tiên, nên to
            và đứng riêng một góc. Đếm bài ĐÃ NỘP, không đếm bài đã bắt đầu:
            người mở đề rồi bỏ ngang chưa phải một lượt thi. */}
        <Link
          href={`/instructor/exam-runs/${r.sessionId}`}
          className="flex shrink-0 flex-col items-center justify-center self-start rounded-lg px-1.5 py-1.5 sm:px-3 text-center hover:bg-slate-50"
          title={`${r.submittedCount} bài đã nộp — bấm để xem kết quả`}
        >
          <span
            className={`text-2xl font-bold leading-none tabular-nums ${
              r.submittedCount > 0 ? "text-slate-900 dark:text-slate-100" : "text-faint"
            }`}
          >
            {r.submittedCount}
          </span>
          <span className="mt-1 whitespace-nowrap text-caption text-faint">
            <span className="hidden sm:inline">bài </span>đã nộp
          </span>
        </Link>
      </div>

      {/* Hàng thao tác: mọi nút cùng một kiểu, chỉ nút Đóng tách sang phải và
          tô đỏ — đóng ca là cắt dòng người đang vào thi, không được bấm nhầm
          khi đang lướt qua hàng nút. "Mở lại" thì không: mở thêm một cánh cửa
          chẳng hỏng gì. */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-token bg-slate-50/70 px-4 py-1.5">
        {/* Có cả khi ca ĐÃ ĐÓNG — lúc đó màn hình chuyển sang "Xem lại", giữ
            nguyên toàn bộ bài làm. Truyền sessionId để bỏ cửa sổ 24h mặc định
            của trang đó, vì chính ca đã bó tập bài làm rồi. */}
        <Link
          href={`/instructor/courses/${r.courseId}/exams/${r.examId}/live?sessionId=${r.sessionId}`}
          className={BTN}
          title={r.isOpen ? "Xem ai đang làm bài, tới câu nào" : "Xem lại diễn biến của ca đã đóng"}
        >
          <Radio className={`h-3.5 w-3.5 ${r.isOpen ? "text-red-500" : "text-faint"}`} />
          {r.isOpen ? "Giám sát" : "Xem lại"}
        </Link>
        <Link href={`/instructor/exam-runs/${r.sessionId}`} className={BTN}>
          <BarChart3 className="h-3.5 w-3.5 text-faint" />
          Kết quả
        </Link>
        <a
          href={apiUrl(`/api/exams/${r.examId}/results?sessionId=${r.sessionId}`)}
          className={BTN}
          title="Tải kết quả thí sinh của lần thi này"
        >
          <Download className="h-3.5 w-3.5 text-faint" />
          Tải
        </a>
        {/* Kỳ thi chính thức thuộc một đợt: không có lối này thì lịch sử chỉ dẫn
            được tới kết quả, mất đường quay về chỗ sửa giờ, xếp phòng. */}
        {r.scale === "formal" && r.roundId && (
          <Link
            href={`/instructor/exam-rounds/${r.roundId}?tab=sessions`}
            className={BTN}
            title="Mở đợt thi chứa ca này để sửa giờ, xếp phòng, cấp mã"
          >
            <Settings2 className="h-3.5 w-3.5 text-faint" />
            Quản lý ca
          </Link>
        )}
        {showRooms && r.scale === "formal" && (
          <button
            type="button"
            onClick={() => setOpenRooms((v) => !v)}
            aria-expanded={openRooms}
            className={`${BTN} ${openRooms ? "bg-slate-100" : ""}`}
            title="Xem các phòng của ca này và mã giám thị từng phòng"
          >
            <DoorOpen className="h-3.5 w-3.5 text-faint" />
            Phòng thi
            <ChevronDown
              className={`h-3.5 w-3.5 text-faint transition-transform ${openRooms ? "rotate-180" : ""}`}
            />
          </button>
        )}
        {r.timingMode === "manual" && (
          <button
            type="button"
            onClick={() => toggle(!r.isOpen)}
            disabled={busy}
            className={
              r.isOpen
                ? "ml-auto inline-flex items-center gap-1.5 rounded-md bg-danger-700 px-3 py-1 text-xs font-medium text-white hover:bg-danger-600 disabled:opacity-50"
                : `ml-auto ${BTN}`
            }
          >
            {r.isOpen ? (
              <Square className="h-3 w-3 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 text-faint" />
            )}
            {busy ? "…" : r.isOpen ? "Đóng ca" : "Mở lại"}
          </button>
        )}
      </div>

      {/* Bảng chiếu. Nền trắng + viền quiet zone: QR đặt trên nền màu hoặc
          sát mép thì máy quét hay không bắt được. */}
      {showQr && fullUrl && (
        <div className="border-t border-token p-4">
          <div className="flex flex-wrap items-center gap-4">
            <QrZoom url={fullUrl} title="Quét để vào thi" code={r.code ?? undefined} copyable>
              <div className="rounded-lg border border-token bg-white p-2">
                <QRCode value={fullUrl} size={QR_SIZE} level="M" />
              </div>
            </QrZoom>
            <div className="min-w-48 flex-1">
              <p className="text-sm text-muted">
                Bấm vào mã QR để phóng to và chiếu lên màn hình cho cả lớp quét.
              </p>
              <p className="mt-1 text-sm text-muted">
                Ai không quét được thì vào{" "}
                <span className="font-medium">{shareUrl("/thi")}</span> rồi gõ mã:
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

      {openRooms && r.scale === "formal" && (
        <div className="border-t border-token px-4 pb-4">
          <RoomsExpand sessionId={r.sessionId} courseId={r.courseId} examId={r.examId} />
        </div>
      )}
    </li>
  );
}

/** Một kiểu nút cho cả hàng thao tác — trước đây lẫn lộn nút viền và chữ gạch chân. */
const BTN =
  "inline-flex items-center gap-1.5 rounded-md border border-token bg-white px-2.5 py-1 text-xs font-medium text-muted hover:bg-slate-50";

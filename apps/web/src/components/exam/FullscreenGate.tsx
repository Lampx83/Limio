"use client";

import { useEffect, useState } from "react";

/**
 * Initial overlay shown before the learner enters fullscreen, and again if
 * they exit (Esc / OS switch). Browsers require a user gesture to enter
 * fullscreen — we can't auto-enter from useEffect.
 */
/**
 * Trình duyệt có API toàn màn hình cho phần tử thường không.
 *
 * Safari trên iPhone KHÔNG có, và trên iPad thì chỉ máy đời mới mới có. Ép
 * một chế độ máy không làm được thì cửa sổ chặn không bao giờ đóng đúng cách,
 * và trên iOS thì bàn phím ảo không bật lên được trong chế độ đó — sinh viên
 * dùng iPad không gõ được câu tự luận.
 *
 * Dò bằng tính năng chứ không đoán theo tên trình duyệt: máy nào làm được thì
 * vẫn ép như cũ.
 */
function fullscreenSupported(): boolean {
  if (typeof document === "undefined") return false;
  return typeof document.documentElement.requestFullscreen === "function";
}

export default function FullscreenGate({
  examTitle,
  onEnter,
  required,
  preview = false,
}: {
  examTitle: string;
  /** Called right after fullscreen request resolves (success or failure). */
  onEnter: () => void;
  /** When false (e.g. proctoringLevel=none), the gate is bypassed. */
  required: boolean;
  /** Giáo viên thử — giữ nguyên giao diện nhưng không hứa "ghi lại" vì bản thử không ghi gì. */
  preview?: boolean;
}) {
  // Bắt đầu đóng, rồi mới mở nếu máy làm được — dò tính năng phải chạy phía
  // client, không phải lúc render trên server.
  const [open, setOpen] = useState(false);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    if (required && fullscreenSupported()) setOpen(true);
    // Máy không có API toàn màn hình (iPhone/iPad cũ): không có gì để bấm, nên báo "vào" luôn để phần bắt đầu
    // buổi (vd bản thử vấn đáp chờ tín hiệu này) không đứng chờ một nút không bao giờ hiện.
    else if (required) onEnter();
    // required tắt lúc đang mở (VD: sinh viên bấm "Kết thúc buổi vấn đáp")
    // — đóng ngay, đừng để hộp thoại đứng chắn màn hình kết thúc.
    else if (!required) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [required]);

  useEffect(() => {
    if (!required || !fullscreenSupported()) return;
    // Chờ 5 giây rồi mới chặn màn hình, khớp với ngưỡng bỏ qua ở ExamPlayer.
    //
    // Cửa sổ chat nổi giành tiêu điểm là trình duyệt rớt khỏi toàn màn hình
    // trong chớp mắt rồi vào lại. Chặn ngay thì sinh viên đang gõ dở bị một
    // hộp thoại đen sì đập vào mặt kèm chữ "đã được ghi nhận" — vì một tin
    // nhắn tới. Rớt thật sự thì sau 5 giây hộp thoại vẫn hiện.
    const GRACE_MS = 5_000;
    let pending: ReturnType<typeof setTimeout> | null = null;

    const onFs = () => {
      if (!document.fullscreenElement) {
        if (pending) return;
        pending = setTimeout(() => {
          pending = null;
          setExited(true);
          setOpen(true);
        }, GRACE_MS);
      } else {
        if (pending) {
          clearTimeout(pending);
          pending = null;
        }
        setExited(false);
        setOpen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      if (pending) clearTimeout(pending);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [required]);

  if (!open) return null;

  const requestFs = async () => {
    try {
      // Không chờ vô hạn: ở một số môi trường (khung trình duyệt nhúng, iframe bị chặn) lời hứa này không bao giờ
      // hoàn tất cũng không báo lỗi — chờ mãi thì nút "bấm mà không phản ứng gì". Quá 1,5 giây coi như đã xử lý.
      await Promise.race([
        document.documentElement.requestFullscreen(),
        new Promise<void>((resolve) => setTimeout(resolve, 1_500)),
      ]);
    } catch {
      // Some browsers reject silently; close gate anyway so the user can take
      // the exam — incidents already flag exits server-side.
    }
    setOpen(false);
    onEnter();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="max-w-md rounded-lg bg-white p-6 text-center shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">{examTitle}</h2>
        {exited ? (
          <p className="mb-4 text-sm text-red-700">
            Bài thi đang không ở chế độ toàn màn hình. Vui lòng quay lại để
            tiếp tục làm bài{preview ? "." : " — rời quá lâu sẽ được ghi vào nhật ký buổi thi."}
          </p>
        ) : (
          <p className="mb-4 text-sm text-faint">
            Bài thi yêu cầu chế độ toàn màn hình. Nhấn nút bên dưới để bắt
            đầu.{" "}
            {preview
              ? "Đây là bản thử — việc rời tab hay thoát toàn màn hình không bị ghi lại."
              : "Việc rời tab hoặc thoát chế độ toàn màn hình sẽ được ghi lại."}
          </p>
        )}
        <button
          type="button"
          onClick={requestFs}
          className="rounded bg-lime-600 px-4 py-2 text-sm font-medium text-white hover:bg-lime-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
        >
          {exited ? "Quay lại toàn màn hình" : "Vào toàn màn hình & bắt đầu"}
        </button>
      </div>
    </div>
  );
}

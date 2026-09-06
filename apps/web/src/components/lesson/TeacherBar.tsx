"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  MonitorPlay,
  Timer,
  Link2,
  Link2Off,
} from "lucide-react";

/**
 * Thanh điều khiển của giảng viên khi đang dạy: bật/tắt ghi chú, mở cửa sổ
 * trình chiếu, đồng hồ, và nhảy giữa các mục.
 *
 * Hai cửa sổ nói chuyện với nhau qua BroadcastChannel — cùng trình duyệt, cùng
 * nguồn, không đi qua máy chủ. Trình chiếu trên lớp thường là màn hình phụ cắm
 * vào chính máy này, nên gửi qua server chỉ thêm độ trễ và thêm một thứ có thể
 * hỏng khi mạng phòng học chập chờn.
 *
 * Cửa sổ trình chiếu mở bằng URL `?stage=1` chứ không phải một trang riêng: nó
 * vẫn là trang bài học ấy, chỉ bỏ phần điều hướng — nên nội dung không bao giờ
 * lệch giữa hai bản.
 */

type Section = { id: string; text: string };

const channelName = (lessonId: string) => `limio-lesson-present:${lessonId}`;

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TeacherBar({
  lessonId,
  lessonTitle,
  teacherMode,
  noteCount,
  containerId,
}: {
  lessonId: string;
  lessonTitle: string;
  teacherMode: boolean;
  /** Số ghi chú giảng viên có trong bài — 0 thì nút bật ghi chú nói rõ là chưa có. */
  noteCount: number;
  containerId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sections, setSections] = useState<Section[]>([]);
  const [current, setCurrent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [linked, setLinked] = useState(true);
  const [stageOpen, setStageOpen] = useState(false);
  const chan = useRef<BroadcastChannel | null>(null);

  // Kênh phát tới cửa sổ trình chiếu.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(channelName(lessonId));
    chan.current = c;
    c.onmessage = (e) => {
      // Màn chiếu báo về khi nó mở/đóng, để nút đổi trạng thái.
      if (e.data?.type === "stage-hello") setStageOpen(true);
      if (e.data?.type === "stage-bye") setStageOpen(false);
    };
    return () => {
      c.close();
      chan.current = null;
    };
  }, [lessonId]);

  // Danh sách mục, đọc từ chính nội dung đã render (giống mục lục nổi).
  useEffect(() => {
    const root = document.getElementById(containerId);
    if (!root) return;
    const scan = () => {
      const found = [...root.querySelectorAll<HTMLElement>("h2[id]")].map((h) => ({
        id: h.id,
        text: (h.querySelector("span:last-of-type")?.textContent ?? h.textContent ?? "").trim(),
      }));
      if (found.length > 0) setSections(found);
      return found.length > 0;
    };
    if (scan()) return;
    const mo = new MutationObserver(() => {
      if (scan()) mo.disconnect();
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [containerId]);

  // Đồng hồ buổi dạy.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const goto = useCallback(
    (index: number) => {
      const s = sections[index];
      if (!s) return;
      setCurrent(index);
      document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (linked) chan.current?.postMessage({ type: "goto", id: s.id });
    },
    [sections, linked],
  );

  const openStage = () => {
    const url = `${pathname}?stage=1`;
    window.open(url, "limio-stage", "noopener=no,width=1280,height=800");
    setRunning(true);
  };

  const toggleNotes = () => {
    const url = teacherMode ? pathname : `${pathname}?gv=1`;
    router.push(url);
  };

  return (
    <div
      data-print-hide
      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-accent-200 bg-accent-50 px-3 py-2.5 dark:border-accent-800 dark:bg-[rgb(var(--surface-muted))] print:hidden"
    >
      <span className="mr-1 text-sm font-semibold text-accent-700 dark:text-accent-300">
        Chế độ giảng viên
      </span>

      <button type="button" onClick={toggleNotes} className="btn-pill bg-[rgb(var(--surface))]">
        {teacherMode ? <EyeOff size={16} /> : <Eye size={16} />}
        {teacherMode ? "Ẩn ghi chú" : noteCount > 0 ? `Hiện ghi chú (${noteCount})` : "Ghi chú (chưa có)"}
      </button>

      <button type="button" onClick={openStage} className="btn-pill bg-[rgb(var(--surface))]">
        <MonitorPlay size={16} />
        {stageOpen ? "Màn chiếu đang mở" : "Mở màn chiếu"}
      </button>

      {sections.length > 1 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface))] px-1.5 py-1">
          <button
            type="button"
            onClick={() => goto(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Mục trước"
            className="rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="max-w-[16rem] truncate px-1 text-sm">
            {current + 1}/{sections.length} · {sections[current]?.text ?? lessonTitle}
          </span>
          <button
            type="button"
            onClick={() => goto(Math.min(sections.length - 1, current + 1))}
            disabled={current >= sections.length - 1}
            aria-label="Mục sau"
            className="rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => setLinked((v) => !v)}
        aria-pressed={linked}
        title={linked ? "Màn chiếu đang đi theo bạn" : "Màn chiếu đang đứng yên"}
        className="btn-pill bg-[rgb(var(--surface))]"
      >
        {linked ? <Link2 size={16} /> : <Link2Off size={16} />}
        {linked ? "Đồng bộ" : "Rời nhau"}
      </button>

      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        onDoubleClick={() => setElapsed(0)}
        title="Bấm để chạy/dừng, bấm đúp để về 0"
        className="btn-pill ml-auto bg-[rgb(var(--surface))] tabular-nums"
      >
        <Timer size={16} />
        {mmss(elapsed)}
      </button>
    </div>
  );
}

/**
 * Phần chạy trong cửa sổ trình chiếu: nghe lệnh nhảy mục và cuộn tới đó.
 * Tách riêng để cửa sổ ấy không phải tải cả thanh điều khiển.
 */
export function StageListener({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(channelName(lessonId));
    c.postMessage({ type: "stage-hello" });
    c.onmessage = (e) => {
      if (e.data?.type === "goto" && typeof e.data.id === "string") {
        document.getElementById(e.data.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    const bye = () => c.postMessage({ type: "stage-bye" });
    window.addEventListener("pagehide", bye);
    return () => {
      bye();
      window.removeEventListener("pagehide", bye);
      c.close();
    };
  }, [lessonId]);
  return null;
}

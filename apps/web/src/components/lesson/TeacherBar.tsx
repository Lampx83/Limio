"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Hourglass,
  MonitorPlay,
  Pause,
  Play,
  Wrench,
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

/**
 * Công tắc bật/tắt.
 *
 * Nút cũ chỉ đổi chữ ("Hiện ghi chú" ↔ "Ẩn ghi chú") nên không ai đọc ra được
 * chữ ấy đang tả TRẠNG THÁI HIỆN TẠI hay VIỆC SẼ XẢY RA khi bấm — hai cách hiểu
 * ngược nhau hoàn toàn. Ở đây tên tính năng đứng yên, còn trạng thái nói bằng
 * ba thứ cùng lúc: vị trí nút gạt, màu, và chữ BẬT/TẮT.
 */
function Toggle({
  on,
  label,
  onToggle,
  title,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        on
          ? "border-brand-600 bg-brand-soft text-brand-700"
          : "border-token bg-[rgb(var(--surface))] text-muted"
      }`}
    >
      <span
        aria-hidden
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          on ? "bg-brand-600" : "bg-[rgb(var(--border))]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${
            on ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      {label}
      <span className={`text-xs font-bold ${on ? "text-brand-700" : "text-faint"}`}>
        {on ? "BẬT" : "TẮT"}
      </span>
    </button>
  );
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
  // Mốc KẾT THÚC (epoch ms) chứ không phải số giây còn lại: gửi mốc thì màn
  // chiếu tự tính phần còn lại, nên trễ đường truyền hay mất một tin nhắn cũng
  // không làm hai bên lệch nhau.
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const chan = useRef<BroadcastChannel | null>(null);
  // Bản sao của endsAt cho hàm nghe tin nhắn: hàm ấy được gắn một lần lúc mở
  // kênh, nên nếu đọc thẳng state thì nó mãi thấy giá trị lúc mount.
  const endsAtRef = useRef<number | null>(null);

  // Kênh phát tới cửa sổ trình chiếu.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(channelName(lessonId));
    chan.current = c;
    c.onmessage = (e) => {
      // Màn chiếu báo về khi nó mở/đóng, để nút đổi trạng thái.
      if (e.data?.type === "stage-hello") {
        setStageOpen(true);
        // Màn chiếu mở SAU khi đã bấm đếm ngược thì phải được kể lại, nếu không
        // nó đứng trắng trong khi lớp đang chờ đồng hồ.
        if (endsAtRef.current !== null) {
          c.postMessage({ type: "timer", endsAt: endsAtRef.current });
        }
      }
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

  // Nhịp đếm ngược của thanh điều khiển — giảng viên cũng cần thấy còn bao lâu.
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  // Đồng hồ buổi dạy.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const setCountdown = useCallback((minutes: number | null) => {
    const at = minutes === null ? null : Date.now() + minutes * 60_000;
    endsAtRef.current = at;
    setEndsAt(at);
    setNow(Date.now());
    setPickerOpen(false);
    chan.current?.postMessage({ type: "timer", endsAt: at });
  }, []);

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

  /**
   * Khi bật Đồng bộ, màn chiếu bám theo lúc bạn CUỘN, không chỉ lúc bấm ‹ ›.
   *
   * Gửi kèm `ratio` — bạn đang ở đâu trong mục hiện tại, tính theo phần trăm —
   * thay vì gửi số pixel: màn chiếu giấu thanh điều hướng và để cỡ chữ lớn hơn
   * nên cùng một mục ở đó cao khác hẳn, copy pixel sang là lệch ngay.
   *
   * Gom việc gửi vào một khung hình bằng requestAnimationFrame; cuộn một cái
   * bắn ra hàng chục sự kiện, gửi hết thì màn chiếu giật.
   */
  useEffect(() => {
    if (!linked || sections.length === 0) return;
    // KHÔNG dùng requestAnimationFrame: cửa sổ điều khiển có lúc bị che (bạn
    // bấm sang cửa sổ màn chiếu), lúc ấy rAF không chạy — mà cờ "đang chờ vẽ"
    // thì đã bật, nên mọi lần cuộn sau đều bị bỏ qua và màn chiếu đứng im vĩnh
    // viễn. Hẹn giờ ngắn thì chạy ở mọi trạng thái cửa sổ.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const send = () => {
      timer = null;
      const marks = sections
        .map((s) => document.getElementById(s.id))
        .filter((e): e is HTMLElement => e !== null);
      if (marks.length === 0) return;
      // Mốc đọc lấy hơi dưới mép trên: mục vừa chạm mép chưa phải mục đang đọc.
      const y = window.scrollY + 120;
      let i = 0;
      for (let k = 0; k < marks.length; k++) {
        if (marks[k]!.getBoundingClientRect().top + window.scrollY <= y) i = k;
      }
      const top = marks[i]!.getBoundingClientRect().top + window.scrollY;
      const nextTop =
        i + 1 < marks.length
          ? marks[i + 1]!.getBoundingClientRect().top + window.scrollY
          : document.documentElement.scrollHeight;
      const ratio = Math.min(1, Math.max(0, (y - top) / Math.max(1, nextTop - top)));
      setCurrent(i);
      chan.current?.postMessage({ type: "goto", id: sections[i]!.id, ratio });
    };
    const onScroll = () => {
      // 50ms: mắt người thấy liền mạch, mà vẫn gom đủ để không gửi mỗi khung
      // hình một tin. Cuộn một dòng cũng kịp sang màn chiếu.
      if (!timer) timer = setTimeout(send, 50);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    // Bật Đồng bộ là màn chiếu nhảy về chỗ bạn đang đứng ngay, không phải chờ
    // tới lần cuộn kế tiếp — bấm một nút mà không thấy gì đổi thì ai cũng tưởng
    // nút hỏng.
    send();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [linked, sections]);

  /**
   * Phím mũi tên ← → nhảy mục, để không phải rê chuột qua lại giữa hai màn hình.
   *
   * Chỉ bắt khi con trỏ KHÔNG nằm trong ô nhập liệu — nếu không thì gõ tìm kiếm
   * cũng làm lớp nhảy mục. Mũi tên trái/phải vốn để cuộn ngang, mà bài học
   * không cuộn ngang, nên lấy dùng ở đây không giẫm chân ai.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goto(Math.min(sections.length - 1, current + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goto(Math.max(0, current - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto, current, sections.length]);

  const openStage = () => {
    const url = `${pathname}?stage=1`;
    window.open(url, "limio-stage", "width=1280,height=800");
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
      <span
        title="Thanh này chỉ hiện với người dạy khoá. Học viên không thấy nó, và cũng không thấy ghi chú bên trong bài."
        className="mr-1 cursor-help text-sm font-semibold text-accent-700 dark:text-accent-300"
      >
        Chế độ giảng viên
      </span>

      <Toggle
        on={teacherMode}
        label="Ghi chú"
        onToggle={toggleNotes}
        title={
          teacherMode
            ? "Ghi chú giảng viên đang hiện trên màn hình của bạn. Tắt để giấu đi. Học viên chưa bao giờ thấy chúng."
            : noteCount > 0
              ? `Bật để hiện ${noteCount} ghi chú xen trong bài. Chỉ mình bạn thấy.`
              : "Bài này chưa có ghi chú nào. Thêm ở trang soạn khoá: chọn hoạt động “Ghi chú giảng viên”."
        }
      />

      <Toggle
        on={linked}
        label="Màn chiếu bám theo"
        onToggle={() => setLinked((v) => !v)}
        title={
          linked
            ? "Màn chiếu đang đi theo bạn: cuộn chuột ở cửa sổ này tới đâu, lớp thấy tới đó. Phím ← → để nhảy mục. Tắt nếu muốn đọc trước phần sau."
            : "Màn chiếu đang đứng yên. Bật để nó đi theo chỗ bạn đang xem."
        }
      />

      {/* Đây là HÀNH ĐỘNG, không phải công tắc — nên để dạng nút đặc, không có
          nút gạt, và trạng thái "đang mở" nói riêng bằng một chấm xanh bên cạnh. */}
      <button
        type="button"
        onClick={openStage}
        title={
          stageOpen
            ? "Đưa cửa sổ màn chiếu ra trước. Bấm lại không mở thêm cửa sổ mới."
            : "Mở cửa sổ chỉ có nội dung để kéo sang máy chiếu (F11 cho toàn màn hình). Đồng hồ cũng bắt đầu chạy."
        }
        className="inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-muted))]"
      >
        <MonitorPlay size={16} />
        Mở màn chiếu
        {stageOpen && (
          <span className="ml-1 inline-flex items-center gap-1 text-xs font-semibold text-success-700">
            <span aria-hidden className="h-2 w-2 rounded-full bg-success-500" />
            đang mở
          </span>
        )}
      </button>

      {/*
        Công cụ lớp học mở ở CỬA SỔ RIÊNG, không nhúng vào trang bài.
        Đang dạy thì ba thứ chạy song song: bài trên cửa sổ điều khiển, nội dung
        trên máy chiếu, và đồng hồ hoặc khảo sát trên cửa sổ thứ ba — nhúng vào
        bài thì mở công cụ là che mất chỗ đang đọc, mà đóng lại là mất đồng hồ.
        Cửa sổ mang tên cố định nên bấm nhiều lần cũng chỉ một cửa sổ.

        Trỏ tới /instructor/teaching-tools chứ KHÔNG phải
        /instructor/classroom/<lessonId>: trang classroom chỉ render tiêu đề bài,
        toàn bộ công cụ nằm ở trang teaching-tools. Mở nhầm trang kia thì cửa sổ
        hiện ra trống trơn.
      */}
      <button
        type="button"
        onClick={() =>
          window.open("/instructor/teaching-tools", "limio-tools", "width=900,height=900")
        }
        title="Bấm giờ, bốc thăm gọi tên, khảo sát nhanh, chia nhóm, word cloud, bảng tương tác — mở ở cửa sổ riêng."
        className="inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-muted))]"
      >
        <Wrench size={16} />
        Công cụ lớp học
      </button>

      {/* Đếm ngược CHIẾU LÊN LỚP — khác với đồng hồ buổi dạy ở cuối thanh, cái
          đó chỉ mình bạn thấy. Ở đây chọn số phút rồi cả lớp cùng nhìn. */}
      <span className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          aria-expanded={pickerOpen}
          title={
            endsAt !== null
              ? "Đang đếm ngược trên màn chiếu. Bấm để đổi thời lượng hoặc dừng."
              : "Chiếu đồng hồ đếm ngược lên màn chiếu — cho hoạt động cá nhân, thảo luận nhóm."
          }
          className={
            endsAt !== null
              ? "inline-flex items-center gap-1.5 rounded-full border border-brand-600 bg-brand-soft px-3.5 py-1.5 text-sm font-semibold tabular-nums text-brand-700"
              : "inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-muted))]"
          }
        >
          <Hourglass size={16} />
          {endsAt !== null ? mmss(Math.max(0, Math.round((endsAt - now) / 1000))) : "Đếm ngược"}
        </button>

        {pickerOpen && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-token bg-[rgb(var(--surface))] p-2 shadow-card">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Chiếu lên lớp
            </p>
            <div className="grid grid-cols-3 gap-1">
              {[1, 3, 5, 10, 15, 20].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setCountdown(m)}
                  className="rounded-lg border border-token px-2 py-1.5 text-sm font-medium hover:bg-brand-soft hover:text-brand-700"
                >
                  {m} phút
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCountdown(null)}
              disabled={endsAt === null}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
            >
              Tắt đồng hồ khỏi màn chiếu
            </button>
          </div>
        )}
      </span>

      {sections.length > 1 && (
        <span className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface))] px-1.5 py-1">
          <button
            type="button"
            onClick={() => goto(Math.max(0, current - 1))}
            disabled={current === 0}
            aria-label="Mục trước"
            title="Về mục trước (phím ←). Màn chiếu nhảy theo nếu công tắc “Màn chiếu bám theo” đang BẬT."
            className="rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="max-w-[16rem] truncate px-1 text-sm">
            <span className="text-faint">Mục </span>
            {current + 1}/{sections.length} · {sections[current]?.text ?? lessonTitle}
          </span>
          <button
            type="button"
            onClick={() => goto(Math.min(sections.length - 1, current + 1))}
            disabled={current >= sections.length - 1}
            aria-label="Mục sau"
            title="Sang mục sau (phím →). Màn chiếu nhảy theo nếu công tắc “Màn chiếu bám theo” đang BẬT."
            className="rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </span>
      )}

      <button
        type="button"
        onClick={() => setRunning((r) => !r)}
        onDoubleClick={() => setElapsed(0)}
        title={
          running
            ? "Đồng hồ đang chạy — bấm để tạm dừng, bấm đúp để về 00:00."
            : "Đồng hồ đang dừng — bấm để chạy, bấm đúp để về 00:00."
        }
        className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium tabular-nums transition-colors ${
          running
            ? "border-brand-600 bg-brand-soft text-brand-700"
            : "border-token bg-[rgb(var(--surface))] text-muted"
        }`}
      >
        {running ? <Pause size={16} /> : <Play size={16} />}
        {mmss(elapsed)}
        <span className="text-xs font-semibold">{running ? "đang chạy" : "đang dừng"}</span>
      </button>
    </div>
  );
}

/**
 * Phần chạy trong cửa sổ trình chiếu: nghe lệnh nhảy mục và cuộn tới đó.
 * Tách riêng để cửa sổ ấy không phải tải cả thanh điều khiển.
 */
export function StageListener({ lessonId }: { lessonId: string }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Portal ra thẳng body. Chế độ màn chiếu giấu MỌI con trực tiếp của <main>
  // trừ khối nội dung — đồng hồ nằm trong <main> thì cũng bị giấu theo, và nó
  // bị giấu một cách im lặng: chữ vẫn có trong DOM, chỉ là không ai thấy.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(channelName(lessonId));
    c.postMessage({ type: "stage-hello" });
    c.onmessage = (e) => {
      if (e.data?.type === "timer") {
        setEndsAt(typeof e.data.endsAt === "number" ? e.data.endsAt : null);
        setNow(Date.now());
        return;
      }
      if (e.data?.type !== "goto" || typeof e.data.id !== "string") return;
      const el = document.getElementById(e.data.id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const ratio = typeof e.data.ratio === "number" ? e.data.ratio : null;
      if (ratio === null) {
        // Lệnh nhảy mục từ nút ‹ ›: cuộn mượt cho lớp nhìn thấy mình đang đi đâu.
        window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      // Bám theo cuộn: nội suy trong chính mục ấy ở KÍCH THƯỚC CỦA MÀN CHIẾU,
      // và cuộn thẳng — cuộn mượt ở đây sẽ luôn chạy sau tay người dạy.
      const marks = [...document.querySelectorAll<HTMLElement>("#lesson-content h2[id]")];
      const idx = marks.findIndex((m) => m.id === el.id);
      const nextTop =
        idx >= 0 && idx + 1 < marks.length
          ? marks[idx + 1]!.getBoundingClientRect().top + window.scrollY
          : document.documentElement.scrollHeight;
      window.scrollTo({ top: top + ratio * Math.max(0, nextTop - top), behavior: "auto" });
    };
    const bye = () => c.postMessage({ type: "stage-bye" });
    window.addEventListener("pagehide", bye);
    return () => {
      bye();
      window.removeEventListener("pagehide", bye);
      c.close();
    };
  }, [lessonId]);

  // Nhịp đếm. Tính từ mốc kết thúc chứ không trừ dần một biến đếm: cửa sổ bị che
  // thì trình duyệt bóp nhịp hẹn giờ, trừ dần sẽ chạy chậm dần so với đồng hồ
  // thật, mà cả lớp thì đang nhìn vào con số ấy.
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  if (endsAt === null || !mounted) return null;
  const left = Math.max(0, Math.round((endsAt - now) / 1000));
  const done = left === 0;
  const urgent = left <= 10 && !done;

  return createPortal(
    <div
      data-stage-timer
      aria-live="off"
      className={`fixed right-6 top-6 z-50 rounded-2xl border-2 px-6 py-4 text-center shadow-card backdrop-blur ${
        done
          ? "border-danger-500 bg-danger-50/95 text-danger-700"
          : urgent
            ? "border-accent-500 bg-accent-50/95 text-accent-700"
            : "border-brand-300 bg-[rgb(var(--surface))]/95"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-widest opacity-70">
        {done ? "Hết giờ" : "Còn lại"}
      </p>
      <p className="text-6xl font-bold leading-none tabular-nums">{mmss(left)}</p>
    </div>,
    document.body,
  );
}

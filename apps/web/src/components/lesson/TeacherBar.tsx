"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Crop,
  Presentation,
  Hourglass,
  MonitorPlay,
  Pause,
  Play,
  PenLine,
  Wrench,
  X,
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

/**
 * Địa chỉ của một phần nội dung, hiểu được ở CẢ HAI cửa sổ.
 *
 * Neo vào `data-item-id` của khối chứa nó rồi mới đếm con cháu bên trong: cửa
 * sổ điều khiển có thêm các khối ghi chú giảng viên xen giữa, nên đánh số theo
 * thứ tự từ đầu bài sẽ trỏ lệch sang khối khác trên màn chiếu.
 *
 * Chỉ gửi ĐỊA CHỈ chứ không gửi HTML: màn chiếu tự tìm phần tử trong DOM của
 * chính nó rồi nhân bản, nên không có đường nào để HTML lạ đi từ cửa sổ này
 * sang cửa sổ kia.
 */
export type FocusPath = { itemId: string; indexes: number[] };

function pathOf(el: HTMLElement): FocusPath | null {
  const host = el.closest<HTMLElement>("[data-item-id]");
  if (!host) return null;
  const indexes: number[] = [];
  let node: HTMLElement = el;
  while (node !== host && node.parentElement) {
    indexes.unshift([...node.parentElement.children].indexOf(node));
    node = node.parentElement;
  }
  return { itemId: host.dataset.itemId!, indexes };
}

export function resolvePath(p: FocusPath): HTMLElement | null {
  let node = document.querySelector<HTMLElement>(`[data-item-id="${p.itemId}"]`);
  for (const i of p.indexes) {
    const next = node?.children[i];
    if (!(next instanceof HTMLElement)) return null;
    node = next;
  }
  return node;
}

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

/**
 * Nhãn hiện khi rê chuột vào một nút nổi.
 *
 * Ba nút xếp dọc ở mép phải chỉ có biểu tượng, và biểu tượng thì đoán được chứ
 * không đọc được — `title` của trình duyệt phải chờ cả giây mới hiện, đủ lâu để
 * người dùng bỏ cuộc và bấm thử. Nhãn này hiện ngay, nằm bên trái nút nên
 * không tràn ra ngoài mép màn hình.
 */
export function FabTip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md bg-[rgb(var(--text))] px-2 py-1 text-xs font-medium text-[rgb(var(--surface))] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

export default function TeacherBar({
  lessonId,
  lessonTitle,
  teacherMode,
  noteCount,
  containerId,
  editHref,
}: {
  lessonId: string;
  lessonTitle: string;
  teacherMode: boolean;
  /** Số ghi chú giảng viên có trong bài — 0 thì nút bật ghi chú nói rõ là chưa có. */
  noteCount: number;
  containerId: string;
  /** Trang soạn nội dung của đúng bài này — lối thoát khỏi chế độ đứng lớp. */
  editHref: string;
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
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState(false);

  // Esc đóng ngăn kéo — cùng cách cư xử với ngăn kéo ghi chú của học viên.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open])
  const [focus, setFocus] = useState<{ path: FocusPath; label: string } | null>(null);
  const focusRef = useRef<{ path: FocusPath; label: string } | null>(null);
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
        if (focusRef.current) {
          c.postMessage({ type: "focus", path: focusRef.current.path });
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

  const sendFocus = useCallback((next: { path: FocusPath; label: string } | null) => {
    focusRef.current = next;
    setFocus(next);
    chan.current?.postMessage({ type: "focus", path: next ? next.path : null });
  }, []);

  /**
   * Chọn vùng chiếu bằng cách rê chuột lên nội dung, giống công cụ soi phần tử
   * của trình duyệt: rê tới đâu viền sáng tới đó, bấm một cái là chốt.
   *
   * Chọn theo PHẦN TỬ chứ không khoanh hình chữ nhật bằng chuột: khoanh theo
   * pixel thì phải chụp ảnh màn hình rồi phóng to — chữ sẽ nhoè, và khung cố
   * định ấy không co giãn theo tỉ lệ máy chiếu. Chọn phần tử thì màn chiếu dựng
   * lại đúng chữ ấy ở cỡ lớn, sắc nét và tự xuống dòng vừa khung.
   */
  useEffect(() => {
    if (!picking) return;
    const root = document.getElementById(containerId);
    if (!root) return;

    let marked: HTMLElement | null = null;
    const clear = () => {
      if (marked) marked.style.outline = "";
      marked = null;
    };
    const mark = (el: HTMLElement) => {
      if (marked === el) return;
      clear();
      marked = el;
      el.style.outline = "3px solid rgb(var(--brand))";
    };
    // Bỏ qua các thẻ bọc: chọn thứ người dạy trỏ vào, không phải cả khối nội dung.
    const targetOf = (t: EventTarget | null): HTMLElement | null => {
      if (!(t instanceof HTMLElement)) return null;
      const el = t.closest<HTMLElement>(
        "h2,h3,h4,p,table,figure,details,ul,ol,blockquote,aside,div[style]",
      );
      return el && root.contains(el) ? el : null;
    };
    const onMove = (e: MouseEvent) => {
      const el = targetOf(e.target);
      if (el) mark(el);
    };
    const onClick = (e: MouseEvent) => {
      const el = targetOf(e.target);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const path = pathOf(el);
      if (path) {
        sendFocus({ path, label: (el.textContent ?? "").trim().slice(0, 40) || "phần đã chọn" });
      }
      setPicking(false);
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicking(false);
    };
    root.addEventListener("mousemove", onMove);
    root.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    root.style.cursor = "crosshair";
    return () => {
      clear();
      root.style.cursor = "";
      root.removeEventListener("mousemove", onMove);
      root.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [picking, containerId, sendFocus]);

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

  const openTools = () =>
    window.open("/instructor/teaching-tools", "limio-tools", "width=900,height=900");

  const openStage = () => {
    const url = `${pathname}?stage=1`;
    window.open(url, "limio-stage", "width=1280,height=800");
    setRunning(true);
  };

  /**
   * Bật/tắt ghi chú.
   *
   * Đổi thuộc tính trên <html> trước — CSS hiện/giấu ngay trong khung hình kế
   * tiếp. URL cập nhật sau ở chế độ replace: nó chỉ để giữ trạng thái khi tải
   * lại trang và để nút "In / Lưu PDF" biết có kèm ghi chú hay không, nên không
   * đáng để người dạy phải đứng chờ máy chủ dựng lại cả bài.
   */
  const [notesOn, setNotesOn] = useState(teacherMode);
  // Câu báo "bài chưa có ghi chú" chỉ sống vài giây mỗi lần bật ghi chú.
  useEffect(() => {
    document.documentElement.dataset.gv = notesOn ? "1" : "0";
  }, [notesOn]);

  const toggleNotes = () => {
    const next = !notesOn;
    setNotesOn(next);
    router.replace(next ? `${pathname}?gv=1` : pathname, { scroll: false });
  };

  const rowBtn =
    "inline-flex w-full items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[rgb(var(--surface-muted))]";

  // Còn lại của đồng hồ đếm ngược, dùng chung cho nút sticky bên dưới — cùng
  // cách tính với dòng hiển thị trong bảng điều khiển (dòng ~647).
  const countdownLeft =
    endsAt === null ? 0 : Math.max(0, Math.round((endsAt - now) / 1000));
  const countdownDone = endsAt !== null && countdownLeft === 0;
  const countdownUrgent = endsAt !== null && countdownLeft <= 10 && !countdownDone;

  return (
    <div data-print-hide data-teacher-bar className="print:hidden">
      {/*
        Cùng cơ chế với nút ghi chú của học viên: một nút tròn ở mép dưới bên
        phải, bấm vào thì ngăn kéo trượt ra thành một lớp riêng đè lên trang.
        Bảng điều khiển trước đây nằm ngang trên đầu nội dung — nó choán một dải
        suốt bề rộng và che hai dòng đầu của phần đang đọc, trong khi phần lớn
        thời gian dạy thì không đụng tới nút nào.

        Xếp trên nút ghi chú (bottom-24) và AI Tutor (bottom-6) trong cùng cột
        nút nổi bên phải. Màu hổ phách để không lẫn với nút của học viên.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở bảng điều khiển giảng viên"
        className="group fixed bottom-52 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-accent-500 text-white shadow-lg transition-transform hover:scale-105"
      >
        {/* Mũ tốt nghiệp đọc ra "sinh viên", không phải "giảng viên" — bảng
            giảng, đúng nghĩa hơn cho một bảng điều khiển lúc đứng lớp. */}
        <Presentation size={20} />
        <FabTip>Bảng giảng viên</FabTip>
        {(focus || endsAt !== null) && (
          // Chấm báo: đang chiếu to hoặc đang đếm ngược thì lớp đang thấy thứ gì
          // đó do bảng này điều khiển, kể cả khi bảng đã đóng.
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[rgb(var(--surface))] bg-success-500"
          />
        )}
      </button>

      {/*
        Chưa mở cửa sổ màn chiếu thì đồng hồ vừa bấm chỉ chạy âm thầm trong
        BroadcastChannel — không cửa sổ nào nghe, nên không ai thấy nó đếm.
        Nhiều buổi dạy chỉ chiếu thẳng chính màn hình này (chia sẻ màn hình,
        không mở cửa sổ phụ), nên khi đó nút này đứng ra làm màn chiếu chính —
        to bằng đúng đồng hồ bên StageListener (cùng cỡ chữ clamp), để đứng xa
        cũng đọc được, không phải một nút bé tí như FAB.
        Tự ẩn khi mở màn chiếu (đồng hồ đã hiện bên đó rồi) hoặc khi tắt đồng
        hồ từ bảng điều khiển — KHÔNG ẩn khi bảng điều khiển đang mở. Đặt ở
        góc dưới-trái, chỗ duy nhất không có FAB (cột nút nổi bên phải) hay
        thanh AppHeader (dính đỉnh trang) choán chỗ.
      */}
      {endsAt !== null && !stageOpen && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Còn ${mmss(countdownLeft)} — bấm để mở bảng điều khiển giảng viên`}
          title="Chưa mở màn chiếu nên đồng hồ chạy ngay trên màn hình này. Bấm để mở bảng điều khiển."
          className={`fixed bottom-6 left-6 z-50 flex items-baseline gap-4 rounded-3xl border-2 px-6 py-3 shadow-card backdrop-blur-md transition-transform hover:scale-[1.02] ${
            countdownDone
              ? "border-danger-500 bg-danger-50/90 text-danger-700"
              : countdownUrgent
                ? "border-accent-500 bg-accent-50/90 text-accent-700"
                : "border-brand-400 bg-[rgb(var(--surface))]/85"
          }`}
        >
          <span className="text-[clamp(1.4rem,2vw,2rem)] font-bold uppercase tracking-[0.2em] opacity-70">
            {countdownDone ? "Hết giờ" : "Còn lại"}
          </span>
          <span className="text-[clamp(3.6rem,6.8vw,6.8rem)] font-bold leading-none tabular-nums">
            {mmss(countdownLeft)}
          </span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <aside
            role="dialog"
            aria-label="Bảng điều khiển giảng viên"
            className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-token bg-[rgb(var(--surface))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-token bg-[rgb(var(--surface)/0.95)] px-5 py-3 backdrop-blur">
              <div>
                <p className="text-sm font-semibold text-accent-700 dark:text-accent-300">
                  Chế độ giảng viên
                </p>
                <p className="text-xs text-muted">Học viên không thấy bảng này</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng bảng điều khiển"
                className="rounded-full p-2 text-muted hover:bg-[rgb(var(--surface-muted))]"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex flex-col gap-2 p-4">
              <Toggle
                on={notesOn}
                label={noteCount > 0 ? `Ghi chú (${noteCount})` : "Ghi chú"}
                onToggle={toggleNotes}
                title={
                  notesOn
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
                    ? "Màn chiếu đang đi theo bạn: cuộn chuột ở cửa sổ này tới đâu, lớp thấy tới đó. Phím ← → để nhảy mục."
                    : "Màn chiếu đang đứng yên. Bật để nó đi theo chỗ bạn đang xem."
                }
              />

              <button
                type="button"
                onClick={openStage}
                title={
                  stageOpen
                    ? "Đưa cửa sổ màn chiếu ra trước. Bấm lại không mở thêm cửa sổ mới."
                    : "Mở cửa sổ chỉ có nội dung để kéo sang máy chiếu (F11 cho toàn màn hình). Đồng hồ cũng bắt đầu chạy."
                }
                className={rowBtn}
              >
                <MonitorPlay size={16} />
                Mở màn chiếu
                {stageOpen && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-success-700">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-success-500" />
                    đang mở
                  </span>
                )}
              </button>

              {/* Chọn vùng thì ngăn kéo tự đóng: việc kế tiếp là rê chuột lên
                  chính nội dung đang bị ngăn kéo che. */}
              <button
                type="button"
                onClick={() => {
                  if (focus) {
                    sendFocus(null);
                    return;
                  }
                  setPicking(true);
                  setOpen(false);
                }}
                title={
                  focus
                    ? `Màn chiếu đang chiếu to: “${focus.label}”. Bấm để trả về cả bài.`
                    : "Chọn một phần nội dung (đề bài, bảng, hình) để chiếu to lên lớp cùng đồng hồ."
                }
                className={rowBtn}
              >
                <Crop size={16} className="shrink-0" />
                <span className="truncate">
                  {focus ? `Bỏ chiếu to: ${focus.label}` : "Chiếu to một phần"}
                </span>
              </button>

              <a
                href={editHref}
                title="Thoát chế độ đứng lớp, quay về màn hình soạn nội dung của bài này."
                className={rowBtn}
              >
                <PenLine size={16} />
                Về soạn nội dung
              </a>

              <button
                type="button"
                onClick={openTools}
                title="Bấm giờ, bốc thăm gọi tên, khảo sát nhanh, chia nhóm, word cloud, bảng tương tác — mở ở cửa sổ riêng."
                className={rowBtn}
              >
                <Wrench size={16} />
                Công cụ lớp học
              </button>

              {sections.length > 1 && (
                <div className="flex items-center gap-1 rounded-lg border border-token bg-[rgb(var(--surface))] px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => goto(Math.max(0, current - 1))}
                    disabled={current === 0}
                    aria-label="Mục trước"
                    title="Về mục trước (phím ←)."
                    className="rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-center text-sm">
                    <span className="text-faint">Mục </span>
                    {current + 1}/{sections.length} · {sections[current]?.text ?? lessonTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => goto(Math.min(sections.length - 1, current + 1))}
                    disabled={current >= sections.length - 1}
                    aria-label="Mục sau"
                    title="Sang mục sau (phím →)."
                    className="rounded-full p-1 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <div className="rounded-lg border border-token bg-[rgb(var(--surface))] p-2.5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Hourglass size={16} />
                    Đếm ngược trên màn chiếu
                  </span>
                  {endsAt !== null && (
                    <span className="text-sm font-bold tabular-nums text-brand-700">
                      {mmss(countdownLeft)}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1">
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

              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                onDoubleClick={() => setElapsed(0)}
                title={
                  running
                    ? "Đồng hồ buổi dạy đang chạy — bấm để tạm dừng, bấm đúp để về 00:00."
                    : "Đồng hồ buổi dạy đang dừng — bấm để chạy, bấm đúp để về 00:00."
                }
                className={`${rowBtn} tabular-nums`}
              >
                {running ? <Pause size={16} /> : <Play size={16} />}
                Buổi dạy: {mmss(elapsed)}
                <span className="ml-auto text-xs font-semibold text-muted">
                  {running ? "đang chạy" : "đang dừng"}
                </span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {picking && (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full border border-brand-600 bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-card">
          Rê chuột lên nội dung rồi bấm vào phần muốn chiếu to · Esc để thoát
        </div>
      )}
    </div>
  );
}

export function StageListener({ lessonId }: { lessonId: string }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [focusPath, setFocusPath] = useState<FocusPath | null>(null);
  const focusBox = useRef<HTMLDivElement | null>(null);
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
      if (e.data?.type === "focus") {
        setFocusPath(e.data.path ?? null);
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

  // Đánh dấu lên <body> khi đang đếm ngược, để CSS chừa chỗ cho đồng hồ ở góc
  // trên bên phải — không chừa thì nó đè lên tên bài, đúng thứ người vào muộn
  // cần đọc.
  useEffect(() => {
    if (endsAt === null) return;
    document.body.dataset.stageTimer = "1";
    return () => {
      delete document.body.dataset.stageTimer;
    };
  }, [endsAt]);

  // Nhịp đếm. Tính từ mốc kết thúc chứ không trừ dần một biến đếm: cửa sổ bị che
  // thì trình duyệt bóp nhịp hẹn giờ, trừ dần sẽ chạy chậm dần so với đồng hồ
  // thật, mà cả lớp thì đang nhìn vào con số ấy.
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  // Nhân bản phần được chọn từ DOM của CHÍNH cửa sổ này — không nhận HTML gửi
  // qua kênh. Nội dung hai bên vốn giống nhau, nên chỉ cần địa chỉ là đủ.
  useEffect(() => {
    const box = focusBox.current;
    if (!box) return;
    box.replaceChildren();
    if (!focusPath) return;
    const el = resolvePath(focusPath);
    if (el) box.appendChild(el.cloneNode(true));
  }, [focusPath]);

  if (!mounted) return null;
  const left = endsAt === null ? 0 : Math.max(0, Math.round((endsAt - now) / 1000));
  const done = endsAt !== null && left === 0;
  const urgent = endsAt !== null && left <= 10 && !done;

  return createPortal(
    <>
      {/* Vùng nội dung được chiếu to: nền đặc để che hẳn bài phía sau — đang
          làm bài tập thì phần còn lại của trang chỉ là thứ gây phân tán. */}
      <div
        hidden={!focusPath}
        className="fixed inset-0 z-40 overflow-auto bg-[rgb(var(--surface))] px-10 py-12"
      >
        <div
          ref={focusBox}
          className="mx-auto max-w-5xl text-[1.6rem] leading-relaxed [&_li]:my-2 [&_p]:my-3 [&_table]:text-[1.2rem]"
        />
      </div>

      {endsAt !== null && (
        <div
          data-stage-timer
          aria-live="off"
          /*
            Một dải ngang cao xấp xỉ tiêu đề bài, không phải một khối choán góc
            màn hình. Bản trước để chữ số 13vw — rộng gần nửa màn chiếu, đè lên
            chỗ đáng nhìn nhất và ép dải tiêu đề phải chừa 48vw trống.

            Trong dải đó thì con số lấy hết chỗ còn lại: nhãn nằm cùng hàng chứ
            không nằm trên (nằm trên là cộng thêm một dòng chiều cao), và chữ
            số dùng `leading-none` để hộp không cao hơn chính chữ.

            Cỡ chữ theo clamp: sàn cho máy chiếu độ phân giải thấp, trần để nó
            không phình ra trên màn hình rất rộng. Nền mờ có blur để nội dung
            phía sau vẫn đọc được.
          */
          className={`pointer-events-none fixed right-6 top-6 z-50 flex items-baseline gap-4 rounded-3xl border-2 px-6 py-3 shadow-card backdrop-blur-md ${
            done
              ? "border-danger-500 bg-danger-50/90 text-danger-700"
              : urgent
                ? "border-accent-500 bg-accent-50/90 text-accent-700"
                : "border-brand-400 bg-[rgb(var(--surface))]/85"
          }`}
        >
          <span className="text-[clamp(1.4rem,2vw,2rem)] font-bold uppercase tracking-[0.2em] opacity-70">
            {done ? "Hết giờ" : "Còn lại"}
          </span>
          <span className="text-[clamp(3.6rem,6.8vw,6.8rem)] font-bold leading-none tabular-nums">
            {mmss(left)}
          </span>
        </div>
      )}
    </>,
    document.body,
  );
}

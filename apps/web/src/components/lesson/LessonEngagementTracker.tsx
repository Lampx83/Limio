"use client";

import { useEffect, useRef } from "react";
import { apiUrl } from "@/lib/apiUrl";

/**
 * B11 — đo người học thực sự ở lại bài bao lâu, cuộn tới đâu, xem hết bao nhiêu
 * phần video. Không hiển thị gì; chỉ gửi số liệu.
 *
 * Vì sao cần: `lesson.viewed` chỉ bắn một lần lúc trang tải xong, nên trong dữ
 * liệu, em đọc kỹ hai mươi phút và em mở bài rồi bỏ đó trông giống hệt nhau.
 *
 * Bốn quyết định đáng nói:
 *
 * - **Chỉ đếm lúc tab hiện.** Tab để quên qua đêm không phải tám tiếng học bài.
 *   Mốc thời gian được đặt lại mỗi lần tab ẩn rồi hiện lại.
 * - **Gửi phần chênh, không gửi tổng.** Mất một nhịp thì mất đúng nhịp đó.
 * - **Nhịp cuối đi bằng `sendBeacon`.** Lúc đóng tab, một `fetch` bình thường
 *   bị trình duyệt huỷ giữa chừng — và nhịp cuối chính là nhịp giữ phần lớn
 *   thời gian của lượt đọc.
 * - **Không chặn gì của người học.** Mọi lỗi mạng đều nuốt: số liệu hỏng còn
 *   hơn trang học hỏng.
 */

/** Gửi mỗi 30 giây. Đủ mịn để dựng đường cong đọc, đủ thưa để không ồn. */
const BEAT_MS = 30_000;
/** Trần cho mỗi lần gửi, khớp với MAX_DELTA_SEC phía máy chủ. */
const MAX_DELTA_SEC = 120;
/** Đợi bố cục ổn định rồi mới chốt mốc cuộn ban đầu. */
const SETTLE_MS = 2_000;

interface Beat {
  activeSecDelta: number;
  scrollPct: number;
  videoPct: number;
  sessionStart: boolean;
  sessionEnd: boolean;
}

export default function LessonEngagementTracker({ lessonId }: { lessonId: string }) {
  // Ref chứ không phải state: những giá trị này đổi mỗi lần cuộn và mỗi giây
  // video chạy: để vào state là bắt React vẽ lại cả trang bài học vì một con
  // số không ai nhìn thấy.
  const activeMsRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);
  const scrollPctRef = useRef(0);
  const videoPctRef = useRef(0);
  const sentSecRef = useRef(0);
  const firstBeatRef = useRef(true);
  // Đã chốt sổ một lượt và đang chờ xem người học có quay lại không.
  const closedRef = useRef(false);

  useEffect(() => {
    // Bài mới thì đếm lại từ đầu.
    activeMsRef.current = 0;
    scrollPctRef.current = 0;
    videoPctRef.current = 0;
    sentSecRef.current = 0;
    firstBeatRef.current = true;
    closedRef.current = false;
    lastTickRef.current = document.visibilityState === "visible" ? Date.now() : null;

    /** Dồn khoảng thời gian tab đang hiện vào tổng, rồi đặt lại mốc. */
    function accumulate() {
      if (lastTickRef.current === null) return;
      activeMsRef.current += Date.now() - lastTickRef.current;
      lastTickRef.current = document.visibilityState === "visible" ? Date.now() : null;
    }

    function send(sessionEnd: boolean) {
      accumulate();
      const totalSec = Math.floor(activeMsRef.current / 1000);
      const delta = Math.min(MAX_DELTA_SEC, totalSec - sentSecRef.current);
      // Không có gì mới và cũng không phải nhịp khép lượt thì đừng làm phiền
      // máy chủ. Nhịp khép lượt vẫn gửi kể cả delta 0, để chốt sổ.
      if (delta <= 0 && !sessionEnd) return;

      const activeSecDelta = Math.max(0, delta);
      // Một lượt chỉ được tính khi nó mang theo thời gian thật. Không có điều
      // kiện này thì mọi lần component gắn lại — React ở chế độ nghiêm ngặt
      // gắn hai lần, và điều hướng phía máy khách cũng có thể gắn lại — đều
      // cộng thêm một lượt, khiến sessionCount nói dối một cách khó phát hiện.
      const countsAsSession = firstBeatRef.current && activeSecDelta > 0;

      const payload: Beat = {
        activeSecDelta,
        scrollPct: scrollPctRef.current,
        videoPct: videoPctRef.current,
        sessionStart: countsAsSession,
        sessionEnd,
      };
      sentSecRef.current += activeSecDelta;
      if (countsAsSession) firstBeatRef.current = false;
      if (sessionEnd) closedRef.current = true;

      const url = apiUrl(`/api/lessons/${lessonId}/engagement`);
      const body = JSON.stringify(payload);
      if (sessionEnd && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: sessionEnd,
      }).catch(() => {
        // Nuốt: đây là đường ghi số liệu, không phải đường học.
      });
    }

    /** Cuộn sâu nhất — tính theo đáy khung nhìn so với chiều cao trang. */
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      // Trang ngắn hơn khung nhìn thì coi như đã đọc hết: không có gì để cuộn.
      //
      // NHƯNG chỉ đúng khi trang đã dựng xong. Đo ngay lúc gắn component thì
      // nội dung chưa render, trang nào cũng "ngắn", và mọi người học đều được
      // ghi là đã đọc hết 100% — một con số sai mà vẫn trông hợp lý, nên sẽ đi
      // thẳng vào bảng phân tích mà không ai nghi ngờ. Vì vậy lần đo đầu tiên
      // được hoãn tới khi bố cục ổn định (xem SETTLE_MS bên dưới).
      const pct = scrollable <= 0
        ? 100
        : Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100);
      const clamped = Math.max(0, Math.min(100, pct));
      if (clamped > scrollPctRef.current) scrollPctRef.current = clamped;
    }

    /** Tỉ lệ video cao nhất trong số các video trên trang. */
    function onTimeUpdate(e: Event) {
      const v = e.target as HTMLVideoElement;
      if (!v.duration || !Number.isFinite(v.duration)) return;
      const pct = Math.round(Math.min(1, v.currentTime / v.duration) * 100);
      if (pct > videoPctRef.current) videoPctRef.current = pct;
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        lastTickRef.current = Date.now();
        // Quay lại sau khi đã chốt sổ là một lượt ngồi đọc mới, không phải
        // phần đuôi của lượt cũ — mở bài ba lần trong ngày là tín hiệu khác
        // hẳn ngồi một mạch.
        if (closedRef.current) {
          firstBeatRef.current = true;
          closedRef.current = false;
        }
      } else {
        // Chuyển tab là lúc lượt đọc có thể kết thúc mà không có sự kiện nào
        // khác báo — chốt sổ ngay, đừng đợi nhịp sau.
        send(true);
      }
    }

    // Không đo ngay: đợi nội dung dựng xong rồi mới chốt mốc ban đầu.
    const settle = setTimeout(onScroll, SETTLE_MS);
    const beat = setInterval(() => send(false), BEAT_MS);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    // `pagehide` bắt được cả trường hợp trang bị đưa vào bfcache, thứ mà
    // `beforeunload` bỏ sót trên Safari và trên iOS.
    const onPageHide = () => send(true);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("timeupdate", onTimeUpdate, { capture: true });

    return () => {
      send(true);
      clearTimeout(settle);
      clearInterval(beat);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("timeupdate", onTimeUpdate, { capture: true });
    };
  }, [lessonId]);

  return null;
}

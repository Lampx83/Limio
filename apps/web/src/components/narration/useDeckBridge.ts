"use client";

import { useEffect, useRef, useState } from "react";
import { deckCmd, firstSegmentOfDeckSlide, parseDeckAnchor, parseDeckMessage, segmentForDeckPos, toDeck } from "@/lib/narration/deckSync";

/** Tin do chính lệnh `toi` của mình gây ra (khung phản hồi lại) chỉ bị bỏ trong khoảng này. */
const ECHO_MS = 700;

export interface DeckBridgeOptions {
  /** Đang nghe một bài deck. */
  active: boolean;
  /** Trình chiếu toàn màn hình: ẩn thanh điều khiển đáy của khung (thanh phát của Limio thay vào). */
  compact: boolean;
  frame: () => HTMLIFrameElement | null;
  anchors: readonly string[];
  /** Đoạn giảng đang đọc (-1 = chưa). */
  segIdx: number;
  /** Học viên bấm trong khung để tới (slide, bước): nhảy giọng tới đoạn tương ứng. */
  onSeek: (segIdx: number) => void;
}

/**
 * Cầu nối hai chiều giữa Nghe giảng và khung slide tương tác `/decks/<id>`:
 * giọng sang đoạn mới → khung nhảy tới đúng slide/bước; học viên tự bấm Sau/Trước/chọn slide trong khung → giọng nhảy theo.
 */
export function useDeckBridge({ active, compact, frame, anchors, segIdx, onSeek }: DeckBridgeOptions) {
  const [pos, setPos] = useState<{ i: number; n: number } | null>(null);
  const last = useRef<{ i: number; b: number; at: number } | null>(null); // lệnh `toi` mình vừa gửi
  const seekRef = useRef(onSeek);
  seekRef.current = onSeek;
  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const segRef = useRef(segIdx);
  segRef.current = segIdx;

  const post = (msg: object) => {
    try {
      frame()?.contentWindow?.postMessage(msg, window.location.origin);
    } catch {
      /* khung chưa sẵn sàng — bỏ qua, lần sau gửi lại */
    }
  };
  const postRef = useRef(post);
  postRef.current = post;

  // Ẩn / hiện thanh đáy của khung theo chế độ trình chiếu (khung cùng origin nên đặt thẳng thuộc tính được).
  const applyCompact = () => {
    const f = frame();
    try {
      const doc = f?.contentDocument;
      if (!f || !doc?.documentElement) return;
      doc.documentElement.toggleAttribute("data-an-thanh", compact);
      f.contentWindow?.dispatchEvent(new Event("resize")); // khung tính lại cỡ sân khấu
      // Vùng dưới khung (phụ đề, thanh chuyển slide) dùng đúng nền và màu chữ của slide thay vì nền trang bài.
      const cs = f.contentWindow?.getComputedStyle(doc.body);
      const bg = cs?.getPropertyValue("--nen").trim();
      const fg = cs?.getPropertyValue("--chu").trim();
      if (bg) document.documentElement.style.setProperty("--deck-bg", bg);
      if (fg) document.documentElement.style.setProperty("--deck-fg", fg);
    } catch {
      /* khung chưa nạp xong — thử lại khi nó báo sẵn sàng */
    }
  };
  const applyCompactRef = useRef(applyCompact);
  applyCompactRef.current = applyCompact;
  useEffect(() => {
    if (!active) return;
    applyCompactRef.current();
    // Hết trình chiếu / hết nghe thì trả khung về nguyên trạng.
    return () => {
      try {
        const f = frame();
        f?.contentDocument?.documentElement.removeAttribute("data-an-thanh");
        f?.contentWindow?.dispatchEvent(new Event("resize"));
      } catch {
        /* bỏ qua */
      }
      document.documentElement.style.removeProperty("--deck-bg");
      document.documentElement.style.removeProperty("--deck-fg");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, compact]);

  // Giọng → khung.
  useEffect(() => {
    if (!active || segIdx < 0) return;
    const p = parseDeckAnchor(anchors[segIdx] ?? "");
    if (!p) return;
    const sent = last.current;
    if (sent && sent.i === p.slide && sent.b === p.step && Date.now() - sent.at < ECHO_MS) return; // khung vừa tự tới đó
    last.current = { i: p.slide, b: p.step, at: Date.now() };
    postRef.current(toDeck(p.slide, p.step));
  }, [active, segIdx, anchors]);

  // Khung → giọng (và số trang).
  useEffect(() => {
    if (!active) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame()?.contentWindow) return;
      const ev = parseDeckMessage(e.data);
      if (!ev) return;
      if (ev.loai === "san-sang") {
        applyCompactRef.current();
        if (typeof ev.n === "number") setPos((p) => ({ i: p?.i ?? 0, n: ev.n! }));
        const p = parseDeckAnchor(anchorsRef.current[segRef.current] ?? "");
        if (p) {
          last.current = { i: p.slide, b: p.step, at: Date.now() };
          postRef.current(toDeck(p.slide, p.step));
        }
        return;
      }
      if (ev.loai !== "trang" && ev.loai !== "buoc") return;
      if (typeof ev.i === "number") {
        const i = ev.i;
        setPos((p) => ({ i, n: ev.n ?? p?.n ?? 0 }));
      }
      const sent = last.current;
      const isEcho = !!sent && Date.now() - sent.at < ECHO_MS && ev.i === sent.i && (ev.loai === "trang" || ev.b === undefined || ev.b === sent.b);
      if (isEcho || typeof ev.i !== "number") return;
      const a = anchorsRef.current;
      const seg = ev.loai === "buoc" && typeof ev.b === "number" ? segmentForDeckPos(a, ev.i, ev.b) : firstSegmentOfDeckSlide(a, ev.i);
      if (seg >= 0 && seg !== segRef.current) {
        last.current = { i: ev.i, b: ev.b ?? 0, at: Date.now() }; // khung đã ở đó rồi: đừng gửi `toi` ngược lại
        seekRef.current(seg);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return {
    pos,
    /** Slide `i` chờ học viên làm xong mới sang (cờ data-dung-cuoi do buildDeckHtml đặt). */
    waits: (i: number): boolean => {
      try {
        return !!frame()?.contentDocument?.querySelectorAll(".khung > section")[i]?.hasAttribute("data-dung-cuoi");
      } catch {
        return false;
      }
    },
    prev: () => postRef.current(deckCmd("lui")),
    next: () => postRef.current(deckCmd("tien")),
  };
}

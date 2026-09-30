"use client";

import { useEffect, useState } from "react";
import type { HelpTourRole, HelpTourStep } from "@/lib/helpTour";

const MOBILE_BREAKPOINT = 1024; // Tailwind `lg` — xem CLAUDE.md §4.6
const SPOTLIGHT_PAD = 6;

type Rect = { top: number; left: number; width: number; height: number };

function isVisible(el: HTMLElement | null): el is HTMLElement {
  return !!el && el.offsetParent !== null;
}

// Có thể có nhiều phần tử cùng data-tour (vd. sidebar desktop ẩn + drawer
// mobile dùng chung nav) — chỉ phần tử đang thực sự hiển thị mới hợp lệ.
function findVisibleTarget(name: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of Array.from(els)) {
    if (isVisible(el)) return el;
  }
  return null;
}

function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export default function HelpTour({
  steps,
  role,
  initiallyOpen,
  mobileMenuToggleEvent,
}: {
  steps: HelpTourStep[];
  role: HelpTourRole;
  initiallyOpen: boolean;
  // Tên custom event để tự mở sidebar dạng drawer trên mobile khi target đang
  // bị ẩn (mỗi sidebar theo role tự export event riêng — StudentLeftMenu,
  // InstructorLeftMenu...), vì mỗi role có 1 component sidebar khác nhau.
  mobileMenuToggleEvent: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];

  useEffect(() => {
    if (!open || !step) return;
    // Xoá rect của bước trước ngay lập tức — nếu không, trong lúc đo lại
    // (đợi drawer mobile mở) người dùng vẫn thấy khung highlight cũ, sai vị trí.
    setRect(null);
    if (!step.target) return;

    // `cancelled` chặn mọi phép đo trễ (poll sau khi mở drawer, sự kiện
    // scroll/resize) ghi đè rect của bước đang hiển thị nếu người dùng đã
    // bấm "Tiếp theo"/"Quay lại" sang bước khác trước khi phép đo cũ kịp
    // chạy xong — đây chính là nguyên nhân bug "tiêu đề đúng, highlight lệch".
    let cancelled = false;
    let scrolledOnce = false;

    const tryMeasure = (): boolean => {
      if (cancelled) return true;
      const el = findVisibleTarget(step.target!);
      if (!el) return false;
      setRect(rectOf(el));
      if (!scrolledOnce) {
        scrolledOnce = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return true;
    };

    if (!tryMeasure()) {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        // Sidebar đang ở drawer đóng (mobile) — mở ra rồi đo lại.
        window.dispatchEvent(new Event(mobileMenuToggleEvent));
      }
      // Mở drawer cần ít nhất 1 chu kỳ React commit + layout — poll vài frame
      // thay vì tin đúng 1 requestAnimationFrame là đủ.
      let attempts = 0;
      const poll = () => {
        if (cancelled || tryMeasure()) return;
        if (attempts++ > 20) {
          // Mục tiêu không tồn tại thật (vd Token AI đang bị khoá) chứ không
          // phải do drawer chưa mở kịp — bỏ qua bước này thay vì đứng lại ở
          // modal trống không trỏ vào đâu.
          setIndex((i) => (i < steps.length - 1 ? i + 1 : i));
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }

    window.addEventListener("resize", tryMeasure);
    window.addEventListener("scroll", tryMeasure, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", tryMeasure);
      window.removeEventListener("scroll", tryMeasure, true);
    };
  }, [open, step, mobileMenuToggleEvent]);

  if (!open || !step) return null;

  const finish = () => {
    setOpen(false);
    fetch("/api/me/help-tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }).catch(() => {});
  };

  const isLast = index === steps.length - 1;

  const card = (
    <div className="w-[min(90vw,360px)] rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-card-hover">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
        Bước {index + 1}/{steps.length}
      </div>
      <h3 className="h-display text-lg font-bold">{step.title}</h3>
      <p className="mt-2 text-sm text-muted">{step.body}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={finish}
          className="text-sm font-medium text-faint hover:text-token"
        >
          Bỏ qua
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              className="btn-secondary btn-sm"
            >
              Quay lại
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
            className="btn-primary btn-sm"
          >
            {isLast ? "Hoàn tất" : index === 0 ? "Bắt đầu" : "Tiếp theo"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!rect) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
        {card}
      </div>
    );
  }

  const spotlight: Rect = {
    top: rect.top - SPOTLIGHT_PAD,
    left: rect.left - SPOTLIGHT_PAD,
    width: rect.width + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
  };

  // Đặt popover cạnh phần tử được highlight, ưu tiên placement chỉ định,
  // kẹp trong viewport để không tràn mép màn hình (đặc biệt mobile).
  const placement = step.placement ?? "bottom";
  const margin = 12;
  let top = spotlight.top;
  let left = spotlight.left;
  let transform: string | undefined;
  if (placement === "bottom") {
    top = spotlight.top + spotlight.height + margin;
    left = spotlight.left;
  } else if (placement === "top") {
    top = spotlight.top - margin;
    left = spotlight.left;
    transform = "translateY(-100%)";
  } else if (placement === "right") {
    top = spotlight.top;
    left = spotlight.left + spotlight.width + margin;
  } else if (placement === "left") {
    top = spotlight.top;
    left = spotlight.left - margin;
    transform = "translateX(-100%)";
  }
  const cardWidth = 360;
  // Chừa đủ chỗ cho card cao nhất có thể (title + 4 dòng body + nút) thay vì
  // đo runtime — trên viewport thấp (mobile), hoặc khi target cuộn ra khỏi
  // màn hình, phải luôn giữ card nằm trong viewport thay vì để nó trôi mất
  // (đã xảy ra thật với placement "top" khi cuộn trang — xem git blame).
  const cardMaxHeight = 280;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  // translateX(-100%) dịch card sang TRÁI của `left` — vùng card chiếm thực
  // tế là [left-cardWidth, left], nên phải kẹp theo vùng đó, không phải theo
  // `left` suông (khác cách clamp cho placement "right"/"bottom").
  if (transform === "translateX(-100%)") {
    left = Math.min(Math.max(left, 16 + Math.min(cardWidth, vw - 32)), vw - 16);
  } else {
    left = Math.min(Math.max(left, 16), vw - Math.min(cardWidth, vw - 32) - 16);
  }
  if (transform === "translateY(-100%)") {
    top = Math.min(Math.max(top, 16 + cardMaxHeight), vh - 16);
  } else {
    top = Math.min(Math.max(top, 16), vh - cardMaxHeight);
  }

  return (
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      <div
        className="pointer-events-none fixed rounded-xl ring-2 ring-brand-400 transition-all duration-150"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          boxShadow: "0 0 0 9999px rgba(15,23,42,0.6)",
        }}
      />
      <div
        className="fixed transition-all duration-150"
        style={{
          top,
          left,
          maxWidth: "min(90vw, 360px)",
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          transform,
        }}
      >
        {card}
      </div>
    </div>
  );
}

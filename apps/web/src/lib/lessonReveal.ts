import type { MouseEvent } from "react";

/**
 * Bố cục "Các bước" có đánh dấu `data-reveal`: ở trang học viên các bước hiện dần, mỗi lần bấm "Bước tiếp" một
 * bước, giống thầy viết từng dòng lên bảng. Dùng cho lời giải mẫu môn Toán.
 *
 * HTML đã lưu KHÔNG đổi (mọi bước vẫn nằm đó), nên in ra, xuất, trình soạn và người không chạy được script
 * đều thấy đủ lời giải. Việc ẩn/hiện chỉ xảy ra ở đây, trên HTML đã làm sạch, ở trình duyệt.
 */

export function buildStepReveal(html: string): string {
  if (!html.includes("data-reveal")) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.body.querySelectorAll('section.lesson-section[data-layout="steps"][data-reveal]').forEach((section) => {
    const parts = Array.from(section.children).filter((c) => c.classList.contains("lesson-part"));
    if (parts.length < 2) return;
    section.classList.add("lk-reveal");
    parts.forEach((p, i) => {
      if (i > 0) p.setAttribute("data-hidden", "1");
    });
    parts[0]!.setAttribute("data-current", "1");
    const ctl = doc.createElement("div");
    ctl.className = "lk-reveal-ctl";
    ctl.innerHTML =
      `<button type="button" data-step-next>Bước tiếp</button>` +
      `<button type="button" data-step-all>Xem hết</button>` +
      `<button type="button" data-step-reset hidden>Xem lại từ đầu</button>` +
      `<span class="lk-reveal-count" aria-live="polite">Bước 1/${parts.length}</span>`;
    parts[parts.length - 1]!.after(ctl);
  });
  return doc.body.innerHTML;
}

function refresh(section: HTMLElement) {
  const parts = Array.from(section.querySelectorAll<HTMLElement>(":scope > .lesson-part"));
  const shown = parts.filter((p) => !p.hasAttribute("data-hidden"));
  parts.forEach((p) => p.removeAttribute("data-current"));
  shown[shown.length - 1]?.setAttribute("data-current", "1");
  const done = shown.length === parts.length;
  section.querySelector<HTMLElement>("[data-step-next]")!.toggleAttribute("hidden", done);
  section.querySelector<HTMLElement>("[data-step-all]")!.toggleAttribute("hidden", done);
  section.querySelector<HTMLElement>("[data-step-reset]")!.toggleAttribute("hidden", !done);
  // Chỉ ghi khi đổi: trình quan sát DOM của Nghe giảng chạy lại mỗi khi có nút chữ mới, ghi thừa là vòng lặp vô tận.
  const count = section.querySelector<HTMLElement>(".lk-reveal-count")!;
  const label = `Bước ${shown.length}/${parts.length}`;
  if (count.textContent !== label) count.textContent = label;
}

/**
 * Cho lời giải đang hiện đúng `count` bước đầu (các bước sau ẩn lại). Nghe giảng gọi hàm này khi giọng giảng tới
 * một bước: bước vừa lộ ra có hiệu ứng "viết", bước đã hiện từ trước thì không chạy lại.
 */
export function showSteps(section: HTMLElement, count: number) {
  if (!section.classList.contains("lk-reveal")) return;
  const parts = Array.from(section.querySelectorAll<HTMLElement>(":scope > .lesson-part"));
  parts.forEach((p, i) => {
    const want = i < count;
    const was = !p.hasAttribute("data-hidden");
    if (want && !was) {
      p.removeAttribute("data-hidden");
      p.classList.remove("lk-just-revealed");
      void p.offsetWidth;
      p.classList.add("lk-just-revealed");
    } else if (!want && was && i > 0) {
      p.setAttribute("data-hidden", "1");
      p.classList.remove("lk-just-revealed");
    }
  });
  refresh(section);
}

/** Uỷ quyền một chỗ ở khung bài: nút nằm trong HTML dựng bằng innerHTML nên không gắn onClick riêng được. */
export function handleStepRevealClick(e: MouseEvent<HTMLElement>) {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-step-next],[data-step-all],[data-step-reset]");
  if (!target) return;
  const section = target.closest<HTMLElement>(".lk-reveal");
  if (!section) return;
  const parts = Array.from(section.querySelectorAll<HTMLElement>(":scope > .lesson-part"));
  const show = (p: HTMLElement) => {
    p.removeAttribute("data-hidden");
    // Chạy lại hiệu ứng "viết ra" dù bước từng hiện trước đó.
    p.classList.remove("lk-just-revealed");
    void p.offsetWidth;
    p.classList.add("lk-just-revealed");
  };
  if (target.hasAttribute("data-step-reset")) {
    parts.forEach((p, i) => {
      p.classList.remove("lk-just-revealed");
      if (i > 0) p.setAttribute("data-hidden", "1");
    });
  } else if (target.hasAttribute("data-step-all")) {
    parts.filter((p) => p.hasAttribute("data-hidden")).forEach(show);
  } else {
    const next = parts.find((p) => p.hasAttribute("data-hidden"));
    if (next) show(next);
  }
  refresh(section);
  const cur = section.querySelector<HTMLElement>(":scope > .lesson-part[data-current]");
  cur?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
}

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildStepReveal, showSteps } from "./lessonReveal";

const steps = (reveal: boolean, n = 3) =>
  `<section class="lesson-section" data-layout="steps"${reveal ? ' data-reveal="1"' : ""}><h2>Giải mẫu</h2>` +
  Array.from({ length: n }, (_, i) => `<div class="lesson-part"><h3>Bước ${i + 1}</h3><p>nội dung ${i + 1}</p></div>`).join("") +
  `<div class="lesson-box" data-kind="note">Ghi nhớ</div></section>`;

const mount = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = buildStepReveal(html);
  return root;
};

describe("lời giải hiện từng bước", () => {
  it("không có data-reveal thì HTML không đổi", () => {
    const html = steps(false);
    expect(buildStepReveal(html)).toBe(html);
  });

  it("chỉ bước 1 hiện, các bước sau ẩn, có nút điều khiển và bộ đếm", () => {
    const root = mount(steps(true));
    const parts = root.querySelectorAll(".lesson-part");
    expect(parts[0]!.hasAttribute("data-hidden")).toBe(false);
    expect(parts[1]!.hasAttribute("data-hidden")).toBe(true);
    expect(parts[2]!.hasAttribute("data-hidden")).toBe(true);
    expect(root.querySelector("[data-step-next]")).not.toBeNull();
    expect(root.querySelector(".lk-reveal-count")!.textContent).toBe("Bước 1/3");
  });

  it("chỉ một bước thì không dựng điều khiển", () => {
    const root = mount(steps(true, 1));
    expect(root.querySelector(".lk-reveal-ctl")).toBeNull();
  });

  it("showSteps (Nghe giảng) hiện đúng n bước đầu và ẩn lại các bước sau khi tua ngược", () => {
    const root = mount(steps(true));
    const section = root.querySelector<HTMLElement>(".lk-reveal")!;
    const parts = () => [...section.querySelectorAll<HTMLElement>(":scope > .lesson-part")];
    showSteps(section, 3);
    expect(parts().map((p) => p.hasAttribute("data-hidden"))).toEqual([false, false, false]);
    expect(section.querySelector("[data-step-reset]")!.hasAttribute("hidden")).toBe(false); // đã xong
    showSteps(section, 2);
    expect(parts().map((p) => p.hasAttribute("data-hidden"))).toEqual([false, false, true]);
    expect(parts()[1]!.hasAttribute("data-current")).toBe(true);
    expect(section.querySelector(".lk-reveal-count")!.textContent).toBe("Bước 2/3");
  });

  it("bước đã hiện từ trước không chạy lại hiệu ứng viết", () => {
    const root = mount(steps(true));
    const section = root.querySelector<HTMLElement>(".lk-reveal")!;
    showSteps(section, 2);
    const second = section.querySelectorAll<HTMLElement>(":scope > .lesson-part")[1]!;
    second.classList.remove("lk-just-revealed");
    showSteps(section, 2);
    expect(second.classList.contains("lk-just-revealed")).toBe(false);
  });
});

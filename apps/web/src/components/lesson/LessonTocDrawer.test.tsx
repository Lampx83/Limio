// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/learn/c/lessons/l1" }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import LessonTocDrawer from "./LessonTocDrawer";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
});

const MODULES = [
  {
    id: "m1",
    title: "Unit 1",
    lessons: [
      { id: "l1", title: "Có video", completed: false, hasVideo: true, videoMinutes: 34 },
      { id: "l2", title: "Chỉ đọc", completed: false },
      { id: "l3", title: "Video đang khoá", completed: false, locked: true, hasVideo: true, videoMinutes: null },
    ],
  },
];

describe("LessonTocDrawer — dấu 'Có video'", () => {
  it("chỉ bài có video mới có dấu (kể cả bài khoá), kèm số phút khi biết", async () => {
    await act(async () => {
      root.render(<LessonTocDrawer slug="c" currentLessonId="l1" modules={MODULES} />);
    });
    await act(async () => {
      host.querySelector("button")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const rows = Array.from(document.body.querySelectorAll("nav ul li"));
    expect(rows).toHaveLength(3);
    const badge = (i: number) => rows[i]!.querySelector('[data-testid="lesson-video-badge"]');
    expect(badge(0)).not.toBeNull();
    expect(badge(0)!.textContent).toContain("Có video");
    expect(badge(0)!.textContent).toContain("34 phút");
    expect(badge(1)).toBeNull();
    expect(badge(2)).not.toBeNull();
    expect(badge(2)!.textContent).not.toContain("phút");
  });
});

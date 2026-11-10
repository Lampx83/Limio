import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/language" }));
vi.mock("./useEffectiveRole", () => ({ useEffectiveRole: (r: string) => r }));

import HeaderTagline from "./HeaderTagline";

const text = (h: string) => h.replace(/<[^>]+>/g, "");

describe("HeaderTagline", () => {
  it("giảng viên: Teach in Flow; học viên: Learn in Flow — kể cả ở /language (không còn tagline riêng của vỏ Language)", () => {
    expect(text(renderToStaticMarkup(<HeaderTagline activeRole="instructor" roles={["instructor"]} />))).toBe("Teach in Flow");
    expect(text(renderToStaticMarkup(<HeaderTagline activeRole="learner" roles={["learner"]} />))).toBe("Learn in Flow");
  });
});

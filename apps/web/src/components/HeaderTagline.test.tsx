import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ usePathname: () => "/language" }));
vi.mock("./useEffectiveRole", () => ({ useEffectiveRole: (r: string) => r }));

import HeaderTagline from "./HeaderTagline";

const text = (h: string) => h.replace(/<[^>]+>/g, "");

describe("HeaderTagline — L2.1", () => {
  it("vỏ Limio Language: tagline 'Speak in Flow' cho cả giảng viên lẫn học viên", () => {
    expect(text(renderToStaticMarkup(<HeaderTagline activeRole="instructor" roles={["instructor"]} languageMode />))).toBe("Speak in Flow");
    expect(text(renderToStaticMarkup(<HeaderTagline activeRole="learner" roles={["learner"]} languageMode />))).toBe("Speak in Flow");
  });
  it("L5.2: vỏ thường không đổi — Teach/Learn in Flow", () => {
    expect(text(renderToStaticMarkup(<HeaderTagline activeRole="instructor" roles={["instructor"]} />))).toBe("Teach in Flow");
    expect(text(renderToStaticMarkup(<HeaderTagline activeRole="learner" roles={["learner"]} />))).toBe("Learn in Flow");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonVideoBadge from "./LessonVideoBadge";
import { translate } from "@/lib/i18n/core";
import { EN, VI } from "@/lib/i18n/dict";

describe("LessonVideoBadge", () => {
  it("có nhãn đọc được cho trình đọc màn hình, biểu tượng thì ẩn khỏi cây trợ năng", () => {
    const html = renderToStaticMarkup(<LessonVideoBadge label="Có video" />);
    expect(html).toContain('<span class="sr-only">Có video</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('title="Có video"');
  });

  it("thời lượng hiện nhỏ cạnh biểu tượng và nằm trong title; không có thì không render", () => {
    const withDur = renderToStaticMarkup(<LessonVideoBadge label="Has video" duration="34 min" />);
    expect(withDur).toContain("34 min");
    expect(withDur).toContain('title="Has video · 34 min"');
    expect(renderToStaticMarkup(<LessonVideoBadge label="Has video" />)).not.toContain("tabular-nums");
  });

  it("nhãn theo ngôn ngữ giao diện: Has video (EN) / Có video (VI)", () => {
    expect(translate(VI, EN, "en", "learn.video.has")).toBe("Has video");
    expect(translate(VI, EN, "vi", "learn.video.has")).toBe("Có video");
  });
});

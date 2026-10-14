import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LanguageProfile } from "@feedbackme/core-feedback";
import LanguageProfileView from "./LanguageProfileView";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

/**
 * LANG G3 / G3.4 — trang hồ sơ 4 kỹ năng cho học viên. Mọi thứ hiển thị theo NHÃN;
 * không có phần trăm, không có xác suất.
 */

const text = (out: string) => out.replace(/<[^>]+>/g, "");
const render = (profile: LanguageProfile) =>
  renderToStaticMarkup(<LanguageProfileView slug="tieng-trung-iii" profile={profile} />);

const profile = (over: Partial<LanguageProfile> = {}): LanguageProfile => ({
  enabled: true,
  skills: [
    { skill: "listening", label: "needs_review", lessonsTotal: 4, lessonsPracticed: 2 },
    { skill: "speaking", label: "no_data", lessonsTotal: 0, lessonsPracticed: 0 },
    { skill: "reading", label: "solid", lessonsTotal: 5, lessonsPracticed: 5 },
    { skill: "writing", label: "practice_more", lessonsTotal: 3, lessonsPracticed: 1 },
  ],
  suggestion: {
    skill: "listening",
    lessonId: "11111111-2222-4333-8444-555555555555",
    lessonTitle: "Hội thoại bài 5",
    reason: "review",
  },
  ...over,
});

describe("LanguageProfileView — G3.4", () => {
  it("G3.4.1 + G3.4.2: bốn thẻ kỹ năng theo thứ tự Nghe, Nói, Đọc, Viết, mỗi thẻ có nhãn", () => {
    const t = text(render(profile()));
    const order = ["Nghe", "Nói", "Đọc", "Viết"].map((s) => t.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const label of ["Cần ôn", "Chưa đủ dữ liệu", "Vững", "Nên luyện thêm"]) expect(t).toContain(label);
  });

  it("G3.4.2: số bài đã làm trên số bài của kỹ năng; KHÔNG có phần trăm hay xác suất", () => {
    const out = render(profile());
    const t = text(out);
    expect(t).toContain("2/4 bài");
    expect(t).toContain("5/5 bài");
    expect(t).not.toContain("%");
    expect(out).not.toMatch(/mastery|probab/i);
  });

  it("G3.4.1: radar là hình có chú thích đọc được (role=img + aria-label đúng thứ tự trục)", () => {
    const out = render(profile());
    expect(out).toMatch(/<svg[^>]*role="img"/);
    expect(out).toContain("Nghe: Cần ôn. Nói: Chưa đủ dữ liệu. Đọc: Vững. Viết: Nên luyện thêm.");
  });

  it("G3.4.1: kỹ năng chưa đủ dữ liệu vẽ chấm rỗng (data-state), còn lại vẽ chấm đặc", () => {
    const out = render(profile());
    expect([...out.matchAll(/data-state="no_data"/g)]).toHaveLength(1);
    expect([...out.matchAll(/data-state="(needs_review|practice_more|solid)"/g)]).toHaveLength(3);
  });

  it("G3.4.3: khối 'Luyện hôm nay' trỏ tới đúng bài gợi ý và nói lý do bằng lời, không bằng số", () => {
    const out = render(profile());
    expect(text(out)).toContain("Luyện hôm nay");
    expect(text(out)).toContain("Hội thoại bài 5");
    expect(out).toContain('href="/learn/tieng-trung-iii/lessons/11111111-2222-4333-8444-555555555555"');
    expect(text(out)).toMatch(/Nghe/);
  });

  it("G3.4.3: không có gợi ý thì ẩn hẳn khối 'Luyện hôm nay'", () => {
    const t = text(render(profile({ suggestion: null })));
    expect(t).not.toContain("Luyện hôm nay");
  });

  it("G3.4.5: có thanh CTA dính đáy cho mobile (ẩn từ lg) khi có gợi ý", () => {
    const out = render(profile());
    expect(out).toContain('aria-label="Hành động chính"');
    expect(out).toContain("lg:hidden");
  });

  it("G3.4.4: khoá chưa gán kỹ năng cho bài nào → lời mời liên hệ giảng viên, không vẽ radar trống", () => {
    const empty = profile({
      skills: (["listening", "speaking", "reading", "writing"] as const).map((skill) => ({
        skill, label: "no_data" as const, lessonsTotal: 0, lessonsPracticed: 0,
      })),
      suggestion: null,
    });
    const out = render(empty);
    expect(text(out)).toContain("chưa gán kỹ năng");
    expect(out).not.toMatch(/<svg[^>]*role="img"/);
  });

  it("đã gán kỹ năng nhưng chưa làm bài nào: vẫn vẽ radar (chấm rỗng) và hướng dẫn bắt đầu", () => {
    const fresh = profile({
      skills: [
        { skill: "listening", label: "no_data", lessonsTotal: 3, lessonsPracticed: 0 },
        { skill: "speaking", label: "no_data", lessonsTotal: 0, lessonsPracticed: 0 },
        { skill: "reading", label: "no_data", lessonsTotal: 2, lessonsPracticed: 0 },
        { skill: "writing", label: "no_data", lessonsTotal: 0, lessonsPracticed: 0 },
      ],
      suggestion: { skill: "listening", lessonId: "l1", lessonTitle: "Bài 1", reason: "start" },
    });
    const out = render(fresh);
    expect(out).toMatch(/<svg[^>]*role="img"/);
    expect(text(out)).toContain("Bài 1");
  });

  it("hồ sơ tắt: lời lẽ trung tính, KHÔNG nhắc tới lớp đối chứng hay thực nghiệm", () => {
    for (const reason of ["control_variant", "personalization_off", "language_mode_off", "not_enrolled", "course_not_found"] as const) {
      const out = render({ enabled: false, reason, skills: [], suggestion: null });
      const t = text(out);
      expect(t.length).toBeGreaterThan(10);
      expect(t).not.toMatch(/đối chứng|thực nghiệm|control|variant/i);
      expect(out).not.toMatch(/<svg[^>]*role="img"/);
    }
  });

  it("tên bài gợi ý chứa HTML hiện nguyên chữ", () => {
    const out = render(profile({ suggestion: { skill: "listening", lessonId: "x", lessonTitle: "<img src=x onerror=alert(1)>", reason: "review" } }));
    expect(out).not.toContain("<img");
  });
});

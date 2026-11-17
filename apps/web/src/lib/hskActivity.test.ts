// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hskActivityHtml, hskBriefHtml, hskScenarioHtml } from "./hskActivity";

const tag = '<p style="x"><strong>■</strong> <span style="s">双人活动</span> Hoạt động theo cặp</p>';
const scene =
  '<p style="x"><span style="s">场景一：在机场接人。</span>A<span style="s">到机场接</span>B<span style="s">，但不知道</span>B<span style="s">长什么样。</span><em>Tình huống 1: Đón người ở sân bay. A ra sân bay đón B nhưng không biết B trông thế nào.</em></p>';

describe("hskActivityHtml — khối 课堂活动", () => {
  it("nhãn hoạt động thành viên thuốc, tình huống thành thẻ có tên, vai A/B thành ô", () => {
    const out = hskActivityHtml(tag + "<p>yêu cầu</p>" + scene);
    expect(out).toContain('<span class="hsk-act-pill"><span class="hz" lang="zh-Hans">双人活动</span>Hoạt động theo cặp</span>');
    expect(out).toContain('class="hsk-scn"');
    expect(out).toContain('<span class="hz" lang="zh-Hans">场景一：在机场接人。</span>');
    expect(out).toContain('<span class="vi">Tình huống 1: Đón người ở sân bay</span>');
    expect(out).toContain('<b class="hsk-role" data-r="A">A</b>');
    expect(out).toContain('<b class="hsk-role" data-r="B">B</b>');
    expect(out).toContain('<p class="hsk-scn-vi">A ra sân bay đón B nhưng không biết B trông thế nào.</p>');
    expect(out).toContain("<p>yêu cầu</p>"); // đoạn thường giữ nguyên
  });
  it("chữ Hán của câu tình huống nối liền, vai nằm đúng chỗ", () => {
    const out = hskActivityHtml(scene);
    expect(out.replace(/<[^>]+>/g, "")).toContain("A到机场接B，但不知道B长什么样。");
  });
  it("chỉ đoạn ■ đầu tiên thành nhãn; đoạn ■ sau giữ nguyên", () => {
    const out = hskActivityHtml(tag + '<p><strong>■</strong> <span>完成句子。</span> Hoàn thành.</p>');
    expect((out.match(/hsk-act-pill/g) ?? []).length).toBe(1);
    expect(out).toContain("完成句子");
  });
  it("tình huống thiếu bản dịch (<em>) thì giữ nguyên đoạn gốc", () => {
    const bad = '<p><span>场景一：x。</span>A到</p>';
    expect(hskActivityHtml(bad)).toBe(bad);
  });
});

describe("hskScenarioHtml — tình huống ở khối riêng", () => {
  it("dựng thẻ tình huống nhưng không đổi đoạn ■ thành nhãn", () => {
    const out = hskScenarioHtml(tag + scene);
    expect(out).toContain('class="hsk-scn"');
    expect(out).not.toContain("hsk-act-pill");
  });
  it("HTML không có tình huống thì trả nguyên", () => {
    expect(hskScenarioHtml("<p>abc</p>")).toBe("<p>abc</p>");
  });
});

describe("hskBriefHtml — câu dẫn và yêu cầu trước hội thoại", () => {
  it("đoạn ■ thành dải nhắc (bỏ ký hiệu), đoạn còn lại thành câu dẫn", () => {
    const out = hskBriefHtml('<p>在家里</p><p><strong>■</strong> <span>听两遍对话。</span>Nghe hai lần.</p>');
    expect(out).toContain('<p class="hsk-scene">在家里</p>');
    expect(out).toContain('class="hsk-brief"');
    expect(out).not.toContain("■");
    expect(out).toContain("听两遍对话。");
  });
});

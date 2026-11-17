// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hskActivityHtml, hskBriefHtml, hskScenarioHtml } from "./hskActivity";

const tag = '<p style="x"><strong>■</strong> <span style="s">双人活动</span> Hoạt động theo cặp</p>';
const scene =
  '<p style="x"><span style="s">场景一：在机场接人。</span>A<span style="s">到机场接</span>B<span style="s">，但不知道</span>B<span style="s">长什么样；</span>B<span style="s">刚下飞机，拿着行李箱，打电话告诉</span>A<span style="s">自己在哪儿。</span><em>Tình huống 1: Đón người ở sân bay. A ra sân bay đón B nhưng không biết B trông thế nào. B vừa xuống máy bay, đang kéo va li và gọi điện cho A để nói mình ở đâu.</em></p>';

describe("hskActivityHtml — khối 课堂活动", () => {
  it("nhãn hoạt động thành viên thuốc, tình huống thành thẻ có tên; mỗi vế của câu mô tả là một bước theo vai A/B", () => {
    const out = hskActivityHtml(tag + "<p>yêu cầu</p>" + scene);
    expect(out).toContain('<span class="hsk-act-pill"><span class="hz" lang="zh-Hans">双人活动</span>Hoạt động theo cặp</span>');
    expect(out).toContain('class="hsk-scn"');
    expect(out).toContain('<span class="hz" lang="zh-Hans">场景一：在机场接人。</span>');
    expect(out).toContain('<span class="vi">Tình huống 1: Đón người ở sân bay</span>');
    expect(out).toContain('<ol class="hsk-steps">');
    expect((out.match(/class="hsk-step"/g) ?? []).length).toBe(2);
    expect(out).toContain('<li class="hsk-step" data-r="A">');
    expect(out).toContain('<li class="hsk-step" data-r="B">');
    expect(out).toContain('<b class="hsk-role hsk-role-lg" data-r="A">A</b>');
    expect(out).toContain('<b class="hsk-role" data-r="B">B</b>'); // vai nhắc giữa câu vẫn là ô nhỏ
    expect(out).toContain("<p>yêu cầu</p>"); // đoạn thường giữ nguyên
  });
  it("bản dịch tách theo câu, mỗi bước một câu, khi số câu khớp số bước", () => {
    const out = hskActivityHtml(scene);
    expect(out).toContain('<p class="hsk-step-vi">A ra sân bay đón B nhưng không biết B trông thế nào.</p>');
    expect(out).toContain('<p class="hsk-step-vi">B vừa xuống máy bay, đang kéo va li và gọi điện cho A để nói mình ở đâu.</p>');
    expect(out).not.toContain("hsk-scn-vi");
  });
  it("số câu dịch không khớp số bước: giữ nguyên đoạn dịch bên dưới", () => {
    const odd = scene.replace("A ra sân bay đón B nhưng không biết B trông thế nào. B vừa", "A ra sân bay đón B nhưng B vừa");
    const out = hskActivityHtml(odd);
    expect(out).toContain('class="hsk-scn-vi"');
    expect(out).not.toContain("hsk-step-vi");
  });
  it("chữ Hán của các bước nối lại đủ câu gốc", () => {
    const out = hskActivityHtml(scene).replace(/<[^>]+>/g, "");
    expect(out).toContain("到机场接B，但不知道B长什么样；");
    expect(out).toContain("刚下飞机，拿着行李箱，打电话告诉A自己在哪儿。");
  });
  it("chỉ đoạn ■ đầu tiên thành nhãn; đoạn ■ sau giữ nguyên", () => {
    const out = hskActivityHtml(tag + '<p><strong>■</strong> <span>完成句子。</span> Hoàn thành.</p>');
    expect((out.match(/hsk-act-pill/g) ?? []).length).toBe(1);
    expect(out).toContain("完成句子");
  });
  it("tình huống chỉ một vế: không thành bước, vẫn là một đoạn có ô vai", () => {
    const one = '<p><span>场景三：x。</span>A<span>去机场。</span><em>Tình huống 3: Đi. A đi sân bay.</em></p>';
    const out = hskActivityHtml(one);
    expect(out).toContain("hsk-scn-han");
    expect(out).not.toContain("hsk-steps");
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

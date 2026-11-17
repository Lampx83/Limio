// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { hskGoalsHtml, hskPairHtml, splitHanVi } from "./hskWarmup";

const goals =
  '<div style="display:flex;background:linear-gradient(90deg,a,b)"><span>1</span><span>我们去机场接你们</span></div>' +
  "<h2><span><span>目标</span></span><span>Mục tiêu</span></h2>" +
  "<ul><li><span>能听懂并使用多项定语描述人或事物的特征。</span>Có thể hiểu và dùng định ngữ nhiều tầng.</li>" +
  "<li><span>能听懂并解决物品丢失的问题。</span>Có thể xử lý tình huống mất đồ.</li></ul>";

const pair =
  "<p><span>2</span><span>两人一组，根据实际情况对话。</span>Làm việc theo cặp.</p>" +
  "<ul><li><span>（</span>1<span>）在机场，你的护照</span>/<span>机票</span>/<span>行李丢了，你会怎么做？</span>Nếu bạn làm mất hộ chiếu, bạn sẽ làm gì?</li>" +
  "<li><span>（</span>2<span>）公司让你去机场接人。</span>Công ty nhờ bạn đi đón người.</li></ul>";

describe("splitHanVi", () => {
  it("tách phần Hán (kể cả dấu / giữa các span và số thứ tự đầu dòng) khỏi bản dịch Việt", () => {
    const d = new DOMParser().parseFromString(`<ul>${pair.split("<ul>")[1]!.replace("</ul>", "")}</ul>`, "text/html");
    expect(splitHanVi(d.querySelector("li")!)).toEqual({ han: "在机场，你的护照/机票/行李丢了，你会怎么做？", vi: "Nếu bạn làm mất hộ chiếu, bạn sẽ làm gì?" });
  });
});

describe("hskGoalsHtml — khối mục tiêu", () => {
  it("bỏ dải tên unit và tiêu đề mục tiêu; mỗi mục tiêu thành thẻ có dấu tích, Hán và Việt tách dòng", () => {
    const out = hskGoalsHtml(goals);
    expect(out).not.toContain("linear-gradient");
    expect(out).not.toContain("<h2");
    expect(out).toContain('<ol class="hsk-goals">');
    expect((out.match(/class="hsk-goal"/g) ?? []).length).toBe(2);
    expect(out).toContain('<p class="han" lang="zh-Hans">能听懂并使用多项定语描述人或事物的特征。</p>');
    expect(out).toContain('<p class="vi2">Có thể hiểu và dùng định ngữ nhiều tầng.</p>');
    expect(out).toContain('<span class="ck">');
  });
  it("câu yêu cầu của bài tập số N cuối khối thành dòng dẫn có đường phân cách (bỏ số)", () => {
    const out = hskGoalsHtml(goals + "<p><span>1</span><span>给下面的词语选择对应的图片。</span>Nối các từ với hình.</p>");
    expect(out).toContain('<p class="hsk-pair-lead hsk-lead-sep"><span class="hz" lang="zh-Hans">给下面的词语选择对应的图片。</span><span class="vi">Nối các từ với hình.</span></p>');
  });
  it("khối không có 目标 giữ nguyên", () => {
    expect(hskGoalsHtml("<p>abc</p>")).toBe("<p>abc</p>");
  });
});

describe("hskPairHtml — hoạt động theo cặp", () => {
  it("dòng yêu cầu bỏ số và thành dòng dẫn; tình huống thành thẻ đánh số có Hán và Việt", () => {
    const out = hskPairHtml(pair);
    expect(out).toContain('<p class="hsk-pair-lead"><span class="hz" lang="zh-Hans">两人一组，根据实际情况对话。</span><span class="vi">Làm việc theo cặp.</span></p>');
    expect((out.match(/class="hsk-ex"/g) ?? []).length).toBe(2);
    expect(out).toContain('<span class="n">1</span>');
    expect(out).toContain("在机场，你的护照/机票/行李丢了，你会怎么做？");
    expect(out).toContain('<p class="vi2">Công ty nhờ bạn đi đón người.</p>');
  });
  it("HTML không có 两人一组 giữ nguyên", () => {
    expect(hskPairHtml("<p>x</p>")).toBe("<p>x</p>");
  });
});

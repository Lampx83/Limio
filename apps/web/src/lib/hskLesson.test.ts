import { describe, expect, it } from "vitest";
import { classifyHskItem, hskDropPageRef, hskDropVocabLabel, hskRecolor, hskDecorLang, isHskDecorCourse, parseHskDecorSlugs, hskIntroHtml, planHskSections, sealParts, splitHanRuns, splitLessonTitle, watermarkChar } from "./hskLesson";

const rt = (html: string) => ({ type: "richtext", payload: { html } });

describe("classifyHskItem — nhận diện khối của bài HSK", () => {
  it("hội thoại, từ mới (bảng 生词), ngữ pháp (小语讲堂), khối tiêu đề (richtext đầu tiên)", () => {
    expect(classifyHskItem({ type: "dialogue", payload: {} }, 1)).toBe("dialogue");
    expect(classifyHskItem(rt('<div>生词 TỪ MỚI</div><table><tr><td>x</td></tr></table>'), 2)).toBe("vocab");
    expect(classifyHskItem(rt("<h2>小语讲堂 · Lớp học của Tiểu Ngữ</h2>"), 3)).toBe("grammar");
    expect(classifyHskItem(rt("<p>在家里</p>"), 0)).toBe("intro");
    expect(classifyHskItem(rt("<p>khác</p>"), 4)).toBe("other");
    expect(classifyHskItem({ type: "exam_practice", payload: {} }, 5)).toBe("other");
  });
  it("bảng có chữ 生词 nhưng không có <table> thì không phải từ mới", () => {
    expect(classifyHskItem(rt("<p>生词</p>"), 2)).toBe("other");
  });
});

describe("planHskSections — đánh số mục theo thứ tự có mặt", () => {
  it("bài đủ bốn loại: 01 hội thoại, 02 từ mới, 03 ngữ pháp", () => {
    const items = [rt("<p>x</p>"), { type: "dialogue", payload: {} }, rt("<table></table>生词"), rt("小语讲堂")];
    const p = planHskSections(items);
    // khối tiêu đề đứng ngay trước hội thoại thuộc mục Hội thoại: tiêu đề mục 01 nằm trước nó
    expect(p.kinds[0]).toBe("intro-brief");
    expect([...p.headAt.entries()].map(([i, v]) => [i, v.no, v.section.vi])).toEqual([
      [0, 1, "Hội thoại"],
      [2, 2, "Từ mới"],
      [3, 3, "Lớp học của Tiểu Ngữ"],
    ]);
    expect(p.count).toBe(3);
  });
  it("khối 课堂活动 là một mục có số; nhận diện trước khối tiêu đề", () => {
    const p = planHskSections([rt("<p>x</p>"), rt('<h2>课堂活动</h2><p>双人活动</p>')]);
    expect(p.kinds).toEqual(["intro", "activity"]);
    expect(p.headAt.get(1)).toMatchObject({ no: 1, section: { zh: "课堂活动", vi: "Hoạt động trên lớp" } });
  });
  it("bài không có hội thoại thì Từ mới là mục 01; khối lặp loại chỉ có tiêu đề ở khối đầu", () => {
    const items = [rt("<p>x</p>"), rt("<table></table>生词"), rt("<table></table>生词")];
    const p = planHskSections(items);
    expect([...p.headAt.keys()]).toEqual([1]);
    expect(p.headAt.get(1)!.no).toBe(1);
    expect(p.count).toBe(1);
  });
});

describe("tên bài", () => {
  it("tách phần Việt và phần Hán, con dấu và chữ mờ", () => {
    expect(splitLessonTitle("Bài khoá 1 · 课文1")).toEqual({ vi: "Bài khoá 1", han: "课文1" });
    expect(splitLessonTitle("Khởi động · 热身")).toEqual({ vi: "Khởi động", han: "热身" });
    expect(splitLessonTitle("课文1 · Bài khoá 1")).toEqual({ vi: "Bài khoá 1", han: "课文1" });
    expect(splitLessonTitle("Tổng quan")).toEqual({ vi: "Tổng quan", han: "" });
    expect(sealParts("课文1")).toEqual({ top: "课文", bottom: "1" });
    expect(sealParts("热身")).toEqual({ top: "热身", bottom: "" });
    expect(watermarkChar("课文1")).toBe("课");
    expect(watermarkChar("综合练习")).toBe("综");
    expect(watermarkChar("")).toBe("");
  });
});

describe("splitHanRuns", () => {
  it("tách chữ Hán khỏi chữ Việt trong mô tả", () => {
    expect(splitHanRuns("Ngữ pháp: cụm cố định 看上去 và 看起来.")).toEqual([
      { text: "Ngữ pháp: cụm cố định ", han: false },
      { text: "看上去", han: true },
      { text: " và ", han: false },
      { text: "看起来", han: true },
      { text: ".", han: false },
    ]);
  });
});

describe("làm sạch khối tiêu đề của sách", () => {
  const banner = '<h2 id="muc-1" style="x"><span style="display:block;background:linear-gradient(90deg,rgb(232,89,33),rgba(232,89,33,.1))">课文1</span></h2>';
  const ref = '<p style="margin:0 0 .6rem;text-align:right;font-size:.8125rem">Student’s Book · page 2</p>';
  it("bỏ dải tiêu đề cam và dòng số trang, giữ câu dẫn", () => {
    const out = hskIntroHtml(ref + banner + "<p>在家里</p>");
    expect(out).toBe("<p>在家里</p>");
  });
  it("bỏ mọi dải tên bài (课文/热身/综合练习) nhưng giữ dải gradient khác", () => {
    const warm = '<h2 style="a"><span style="background:linear-gradient(90deg,x,y)">热身</span>Khởi động</h2>';
    const other = '<h2 style="a"><span style="background:linear-gradient(90deg,x,y)">学习目标</span></h2>';
    expect(hskIntroHtml(warm + other + "<p>z</p>")).toBe(other + "<p>z</p>");
  });
  it("không có dải thì không đụng; chỉ bỏ dòng số trang ở khối khác", () => {
    expect(hskIntroHtml("<p>a</p>")).toBe("<p>a</p>");
    expect(hskDropPageRef(ref + "<h2>小语讲堂</h2>")).toBe("<h2>小语讲堂</h2>");
    expect(hskDropPageRef('<p style="text-align:right">chú thích khác</p>')).toContain("chú thích khác");
  });
});

describe("khoá dùng giao diện HSK (danh sách slug trong cài đặt hệ thống)", () => {
  it("đọc mảng JSON hoặc danh sách cách nhau bằng dấu phẩy, khoảng trắng, xuống dòng", () => {
    expect(parseHskDecorSlugs('["a","b"]')).toEqual(["a", "b"]);
    expect(parseHskDecorSlugs("a, b\nc;d")).toEqual(["a", "b", "c", "d"]);
    expect(parseHskDecorSlugs(" ")).toEqual([]);
    expect(parseHskDecorSlugs(null)).toEqual([]);
    expect(parseHskDecorSlugs("[hỏng")).toEqual([]);
    expect(parseHskDecorSlugs('[1,"x"]')).toEqual(["x"]);
  });
  it("chỉ khoá có trong danh sách; không cài đặt thì không khoá nào", () => {
    expect(isHskDecorCourse("hsk-3", "hsk-3,hsk-4")).toBe(true);
    expect(isHskDecorCourse("hsk-5", "hsk-3,hsk-4")).toBe(false);
    expect(isHskDecorCourse("hsk-3", null)).toBe(false);
    expect(isHskDecorCourse("hsk-3", "")).toBe(false);
  });
});

describe("đổi màu cam nhập sẵn và bỏ nhãn", () => {
  it("rgb/rgba(232,89,33) thành màu chính của khoá; màu khác giữ nguyên", () => {
    expect(hskRecolor('style="color:rgb(232,89,33);border:1px solid rgba(232, 89, 33, .35);background:#fff"')).toBe(
      'style="color:rgb(var(--brand));border:1px solid rgb(var(--brand) / .35);background:#fff"',
    );
    expect(hskRecolor('style="color:rgb(1,2,3)"')).toBe('style="color:rgb(1,2,3)"');
    expect(hskRecolor("linear-gradient(90deg,rgb(120,0,52),rgb(232,89,33))")).toBe("linear-gradient(90deg,rgb(var(--hk-pink-deep)),rgb(var(--brand)))");
  });
  it("bỏ nhãn 生词 TỪ MỚI nhưng giữ phần còn lại", () => {
    expect(hskDropVocabLabel('<div style="font-weight:700">生词 TỪ MỚI</div><p>x</p>')).toBe("<p>x</p>");
    expect(hskDropVocabLabel("<p>y</p>")).toBe("<p>y</p>");
  });
});

describe("ngôn ngữ giảng giải của khoá HSK", () => {
  it("mặc định tiếng Việt; slug:en cho bản tiếng Anh; slug:en vẫn nhận ra là khoá dùng giao diện HSK", () => {
    expect(hskDecorLang("a", "a,b:en")).toBe("vi");
    expect(hskDecorLang("b", "a,b:en")).toBe("en");
    expect(hskDecorLang("b", '["a","b:EN"]')).toBe("en");
    expect(hskDecorLang("zz", "a")).toBe("vi");
    expect(parseHskDecorSlugs("a,b:en")).toEqual(["a", "b"]);
    expect(isHskDecorCourse("b", "a,b:en")).toBe(true);
  });
});

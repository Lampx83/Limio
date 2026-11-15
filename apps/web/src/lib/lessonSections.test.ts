import { describe, expect, it } from "vitest";
import { splitLessonSections, practiceTabLabel, arrangeTabs, mergeTabsByLabel, passageDisplayTitle, dropRepeatedBannerTitle, markLabelBold, type SectionItem } from "./lessonSections";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC5, AC6. HTML mẫu giống hệt bộ nhập khoá Speakout tạo ra. */
const NUM = (n: string) => `<span style="color:rgb(229,0,92);font-size:1.6em;font-weight:700;line-height:1;margin-right:.3rem">${n}</span>`;
const LET = (c: string) => `<span style="color:rgb(229,0,92);font-weight:700;margin-right:.45rem">${c}</span>`;
const stmt = (num: string | null, letter: string | null, text: string) =>
  `<p style="margin:1.1rem 0 .35rem;font-size:1.0625rem;line-height:1.6;">${num ? NUM(num) : ""}${letter ? LET(letter) : ""}${text}</p>`;
const list = (...li: string[]) => `<ol style="margin:.7rem 0">${li.map((x) => `<li>${x}</li>`).join("")}</ol>`;
const banner = `<h2 id="muc-reading"><span>Reading</span></h2>`;
const folio = `<p style="text-align:right">Student’s Book · page 8</p>`;

let n = 0;
const rich = (html: string): SectionItem => ({ id: `r${++n}`, type: "richtext", payload: { html } });
const practice = (id: string, title: string): SectionItem => ({ id, type: "exam_practice", payload: { title } });
const ids = (...x: string[]) => new Set(x);
const html = (it: SectionItem) => (it.payload as { html: string }).html;

describe("splitLessonSections — lý thuyết ở trên, mỗi khối bài luyện một tab", () => {
  it("mỗi khối Bài luyện là một tab theo thứ tự; phần còn lại là lý thuyết giữ nguyên thứ tự", () => {
    const a = rich(folio + banner);
    const audio: SectionItem = { id: "au", type: "audio", payload: {} };
    const r = splitLessonSections([a, practice("p1", "7 · Multi-word verbs"), audio, practice("p2", "8A · Complete the sentences")], ids("p1", "p2"));
    expect(r.tabs.map((t) => t.id)).toEqual(["p1", "p2"]);
    expect(r.tabs.map((t) => t.label)).toEqual(["7", "8A"]);
    expect(r.theory.map((i) => i.id)).toEqual([a.id, "au"]);
  });

  it("khối bài luyện không có trong tập được hiện (vd giảng viên đứng lớp) thì không thành tab và không nằm trong lý thuyết", () => {
    const r = splitLessonSections([rich(banner), practice("p1", "7 · X")], ids());
    expect(r.tabs).toEqual([]);
    expect(r.theory.map((i) => i.type)).toEqual(["richtext", "exam_practice"]);
  });

  it("tên tab bỏ đuôi \" · Practice\"", () => {
    expect(practiceTabLabel("The passive; causative have · Practice")).toBe("The passive; causative have");
    expect(practiceTabLabel("8B · Talk with a virtual partner")).toBe("8B · Talk with a virtual partner");
    expect(practiceTabLabel("")).toBe("Bài luyện");
  });
});

describe("splitLessonSections — chữ của sách đi cùng phiếu bạn ảo (AC6)", () => {
  it("câu yêu cầu 2A + danh sách ngay trước phiếu 2A: danh sách vào tab, câu yêu cầu bị bỏ, phần mở đầu ở lại lý thuyết", () => {
    const chunk = rich(folio + banner + stmt("2", "A", "Work in pairs. Discuss the questions.") + list("Are tea and coffee important?", "Have you drunk any today?"));
    const r = splitLessonSections([chunk, practice("vp", "2A · Talk with a virtual partner")], ids("vp"));
    expect(r.theory).toHaveLength(1);
    expect(html(r.theory[0]!)).toContain("Reading");
    expect(html(r.theory[0]!)).not.toContain("Discuss the questions");
    expect(html(r.theory[0]!)).not.toContain("Are tea and coffee important?");
    const lead = r.tabs[0]!.lead.map(html).join("");
    expect(lead).toContain("Are tea and coffee important?");
    expect(lead).not.toContain("Work in pairs");
  });

  it("câu yêu cầu của bài tập KHÔNG phải bạn ảo: ở lại phần lý thuyết, không mất chữ (kể cả khi tên tab lấy nhãn từ chính câu đó)", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee. What information is new to you?"));
    const r = splitLessonSections([chunk, practice("p1", "The world's favourite drug")], ids("p1"));
    expect(r.tabs[0]!.label).toBe("2B");
    expect(r.tabs[0]!.lead).toEqual([]);
    expect(r.theory.map(html).join("")).toContain("Read the article about coffee");
  });

  it("bài tập khác nhưng số/chữ không khớp khối: ở lại lý thuyết, không mất chữ", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee."));
    const r = splitLessonSections([chunk, practice("p1", "2D · Questions")], ids("p1"));
    expect(r.tabs[0]!.lead).toEqual([]);
    expect(r.theory.map(html).join("")).toContain("Read the article about coffee");
  });

  it("số/chữ không khớp phiếu: ở lại lý thuyết", () => {
    const chunk = rich(stmt("2", "A", "Work in pairs. Discuss the questions.") + list("one"));
    const r = splitLessonSections([chunk, practice("vp", "2D · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs[0]!.lead).toEqual([]);
    expect(r.theory.map(html).join("")).toContain("Work in pairs. Discuss the questions.");
  });

  it("nhãn chỉ có chữ (B) nối tiếp số của câu trước; nhãn chỉ có số (6) cũng nhận ra", () => {
    const c1 = rich(stmt("6", "A", "Work in pairs. Make questions.") + stmt(null, "B", "Add two more questions."));
    const r1 = splitLessonSections([c1, practice("vp", "6B · Talk with a virtual partner")], ids("vp"));
    expect(r1.tabs[0]!.lead.map(html).join("")).not.toContain("Add two more questions");
    expect(r1.theory.map(html).join("")).toContain("Make questions");
    const c2 = rich(stmt("6", null, "Work in pairs. Choose four questions.") + list("q1", "q2"));
    const r2 = splitLessonSections([c2, practice("vp", "6 · Talk with a virtual partner")], ids("vp"));
    expect(r2.tabs[0]!.lead.map(html).join("")).toContain("q1");
  });

  it("phiếu mang nhãn dải (2A–2C) khớp câu yêu cầu 2B", () => {
    const chunk = rich(stmt("2", "B", "Work in pairs. Discuss.") + list("x"));
    const r = splitLessonSections([chunk, practice("vp", "2A–2C · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("<li>x</li>");
  });

  it("chỉ câu cuối của khối chữ gắn vào phiếu; các câu trước (bài tập khác) ở lại lý thuyết", () => {
    const chunk = rich(stmt("7", "A", "Can you think of reasons?") + stmt(null, "B", "Read the article.") + stmt(null, "C", "Work in pairs. Tick the points.") + list("p1"));
    const r = splitLessonSections([chunk, practice("vp", "7C · Talk with a virtual partner")], ids("vp"));
    const theory = r.theory.map(html).join("");
    expect(theory).toContain("Can you think of reasons?");
    expect(theory).toContain("Read the article.");
    expect(theory).not.toContain("Tick the points");
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("<li>p1</li>");
  });

  it("có tiêu đề hoặc hộp quy tắc chen sau câu yêu cầu: câu đó không còn ngay trước phiếu, ở lại lý thuyết", () => {
    const chunk = rich(stmt("2", "A", "Work in pairs. Discuss.") + list("x") + `<aside>rule</aside>`);
    const r = splitLessonSections([chunk, practice("vp", "2A · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs[0]!.lead).toEqual([]);
    expect(r.theory.map(html).join("")).toContain("Work in pairs. Discuss.");
  });

  it("khối chữ chỉ còn câu bị chuyển đi thì không còn khối rỗng trong lý thuyết", () => {
    const chunk = rich(stmt("2", "A", "Work in pairs.") + list("x"));
    const r = splitLessonSections([chunk, practice("vp", "2A · Talk with a virtual partner")], ids("vp"));
    expect(r.theory).toEqual([]);
  });

  it("chữ không theo khuôn của bộ nhập (khoá khác) thì không đụng tới", () => {
    const chunk = rich("<p>Work in pairs. Discuss.</p><ul><li>a</li></ul>");
    const r = splitLessonSections([chunk, practice("vp", "2A · Talk with a virtual partner")], ids("vp"));
    expect(r.theory).toEqual([chunk]);
    expect(r.tabs[0]!.lead).toEqual([]);
  });

  it("HTML dở dang: giữ nguyên, không ném lỗi", () => {
    const chunk = rich("<p>chưa đóng <b>đậm");
    const r = splitLessonSections([chunk, practice("p", "A")], ids("p"));
    expect(r.theory).toEqual([chunk]);
  });
});

describe("splitLessonSections — tên tab theo số exercise của sách (AC5)", () => {
  const label = (title: string, passages?: string[], before?: SectionItem) => {
    const items = before ? [before, practice("p", title)] : [practice("p", title)];
    return splitLessonSections(items, ids("p"), passages ? new Map([["p", passages]]) : undefined).tabs[0]!.label;
  };

  it("nhãn nằm ở đầu tên khối: dùng luôn (2A, 8B, dải 2A–2C, số 7)", () => {
    expect(label("2A · Talk with a virtual partner")).toBe("2A");
    expect(label("8B · Talk with a virtual partner")).toBe("8B");
    expect(label("2A–2C · Busy-ness is NOT a competition")).toBe("2A–2C");
    expect(label("7 · Multi-word verbs")).toBe("7");
  });

  it("khối gộp không có nhãn ở tên: lấy từ nhãn các đoạn, gộp chữ cái liền nhau", () => {
    expect(label("The passive; causative have · Practice", ["3A · Sentences from the article", "3B · Rules for the passive", "3C · Rules", "5"])).toBe("3A–3C, 5");
    expect(label("Buildings", ["1A · Buildings in photos A–E", "1B · Groups of buildings", "1C · Which structure?"])).toBe("1A–1C");
    expect(label("Word order", ["4A · Word order", "4B · Questions"])).toBe("4A–4B");
    expect(label("Vài ý", ["1A · x", "1C · y"])).toBe("1A, 1C");
  });

  it("nhãn đoạn dạng dải (5A–5B) và đoạn nghe (2A · ▶ 2.1) đều đọc được", () => {
    expect(label("Silent letters", ["2A · ▶ 2.4", "2B · ▶ 2.5"])).toBe("2A–2B");
    expect(label("Intonation", ["5A–5B · ▶ 2.3"])).toBe("5A–5B");
  });

  it("không có nhãn ở tên khối lẫn đoạn: lấy nhãn câu yêu cầu của sách đứng ngay trước khối", () => {
    const before = rich(stmt("2", "B", "Read the article about coffee. What information is new to you?"));
    expect(label("The world's favourite drug", ["The world’s favourite drug: ten things you didn’t know about coffee"], before)).toBe("2B");
  });

  it("không tìm được nhãn nào: dùng tên khối (bỏ đuôi Practice)", () => {
    expect(label("Fair Isle: fact file", ["Fair Isle: fact file"])).toBe("Fair Isle: fact file");
    expect(label("Respond to suggestions · Practice")).toBe("Respond to suggestions");
  });

  it("hai khối cùng nhãn vẫn ra hai tab cùng tên ở tầng này (trang gộp chúng thành một tab)", () => {
    const r = splitLessonSections([practice("a", "1A · Match"), practice("b", "1A · Talk with a virtual partner")], ids("a", "b"));
    expect(r.tabs.map((t) => t.label)).toEqual(["1A", "1A"]);
    expect(r.tabs.map((t) => t.virtualPartner)).toEqual([false, true]);
  });
});

describe("arrangeTabs — xếp tab theo số exercise", () => {
  const t = (label: string, virtualPartner = false) => ({ label, virtualPartner });
  it("xếp theo số rồi chữ cái, ổn định khi trùng", () => {
    expect(arrangeTabs([t("8B"), t("7"), t("8A"), t("10A"), t("3A–3D, 5")]).map((x) => x.label)).toEqual(["3A–3D, 5", "7", "8A", "8B", "10A"]);
    expect(arrangeTabs([t("3D"), t("3D", true), t("3C")]).map((x) => `${x.label}${x.virtualPartner ? "*" : ""}`)).toEqual(["3C", "3D", "3D*"]);
  });
  it("có tab không bắt đầu bằng số (tên khối): giữ nguyên thứ tự cũ", () => {
    expect(arrangeTabs([t("8B"), t("Fair Isle: fact file"), t("1A")]).map((x) => x.label)).toEqual(["8B", "Fair Isle: fact file", "1A"]);
  });
});

describe("mergeTabsByLabel — một exercise chỉ một tab", () => {
  const tab = (id: string, label: string) => ({ id, label });
  const combine = (g: { id: string; label: string }[]) => ({ id: g.map((x) => x.id).join("+"), label: g[0]!.label });
  it("tab cùng nhãn gộp thành một, đứng ở vị trí của tab đầu, giữ thứ tự gộp", () => {
    const r = mergeTabsByLabel([tab("a", "3C"), tab("b", "3D"), tab("c", "5"), tab("d", "3D")], combine);
    expect(r.map((x) => `${x.id}:${x.label}`)).toEqual(["a:3C", "b+d:3D", "c:5"]);
  });
  it("không trùng nhãn: không đổi gì", () => {
    const input = [tab("a", "1A"), tab("b", "1B")];
    expect(mergeTabsByLabel(input, combine)).toEqual(input);
  });
});

describe("passageDisplayTitle — phiếu bạn ảo là phần nhỏ của exercise, không đánh lại mã bài", () => {
  it("tiêu đề phiếu bạn ảo bỏ mã bài ở đầu (mã đã có trên tab)", () => {
    expect(passageDisplayTitle("3D · Talk with a virtual partner")).toBe("Talk with a virtual partner");
    expect(passageDisplayTitle("2A–2C · Talk with a virtual partner")).toBe("Talk with a virtual partner");
    expect(passageDisplayTitle("6 · Talk with a virtual partner")).toBe("Talk with a virtual partner");
    expect(passageDisplayTitle("8A · Plan with a virtual partner")).toBe("Plan with a virtual partner");
  });
  it("tiêu đề khác giữ nguyên, kể cả có mã bài", () => {
    expect(passageDisplayTitle("3D · More examples in the article")).toBe("3D · More examples in the article");
    expect(passageDisplayTitle("The world’s favourite drug")).toBe("The world’s favourite drug");
    expect(passageDisplayTitle("Free practice · Talk with a virtual partner")).toBe("Free practice · Talk with a virtual partner");
  });
});

describe("splitLessonSections — bài đọc dùng chung: câu dẫn ở trên đầu không mang nhãn exercise (AC8)", () => {
  it("khối có bài đọc đã lên trên: câu yêu cầu đứng ngay trước mất nhãn số/chữ, giữ nguyên chữ và phần đi kèm", () => {
    const chunk = rich(folio + stmt("2", "B", "Read the article about coffee. What information is new to you?"));
    const r = splitLessonSections([chunk, practice("p1", "The world's favourite drug")], ids("p1"), undefined, ids("p1"));
    const theory = r.theory.map(html).join("");
    expect(theory).toContain("Read the article about coffee. What information is new to you?");
    expect(theory).toContain("Student’s Book");
    expect(theory).not.toContain("color:rgb(229,0,92)");
    expect(theory).not.toMatch(/>2</);
    expect(theory).not.toMatch(/>B</);
    expect(theory).toMatch(/^<p[^>]*>.*<\/p>|<p[^>]*>Read the article/);
  });

  it("không có trong tập bài đọc đã lên trên: giữ nhãn như cũ", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee."));
    const r = splitLessonSections([chunk, practice("p1", "The world's favourite drug")], ids("p1"));
    expect(r.theory.map(html).join("")).toContain("color:rgb(229,0,92)");
  });

  it("nhãn tab vẫn lấy từ câu yêu cầu (2B) dù nhãn trong chữ đã bỏ", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee."));
    const r = splitLessonSections([chunk, practice("p1", "The world's favourite drug")], ids("p1"), undefined, ids("p1"));
    expect(r.tabs[0]!.label).toBe("2B");
  });
});

describe("dropRepeatedBannerTitle — dòng phụ của banner trùng tên bài thì bỏ", () => {
  const banner = (sub: string) =>
    `<p>Student’s Book · page 8</p><h2 id="muc-reading" style="margin:2rem 0 .8rem"><span style="display:block">Reading</span><span style="display:block;margin:.4rem 0 0 .25rem">${sub}</span></h2><p>Read the article.</p>`;

  it("dòng phụ nằm trong tên bài: bỏ dòng phụ, giữ chữ READING và phần còn lại", () => {
    const out = dropRepeatedBannerTitle(banner("The world’s favourite drug"), "1.1 Reading · The world's favourite drug");
    expect(out).toContain("Reading");
    expect(out).not.toContain("favourite drug");
    expect(out).toContain("Student’s Book · page 8");
    expect(out).toContain("<p>Read the article.</p>");
    expect(out).toContain("</span></h2>");
  });
  it("dòng phụ khác tên bài: giữ nguyên", () => {
    const html = banner("Something else entirely");
    expect(dropRepeatedBannerTitle(html, "1.1 Reading · The world's favourite drug")).toBe(html);
  });
  it("banner chỉ một dòng hoặc không có banner: giữ nguyên", () => {
    const one = '<h2><span>Reading</span></h2>';
    expect(dropRepeatedBannerTitle(one, "1.1 Reading")).toBe(one);
    expect(dropRepeatedBannerTitle("<p>x</p>", "1.1 Reading")).toBe("<p>x</p>");
  });
});

describe("markLabelBold — chữ đậm làm nhãn người nói không bôi màu", () => {
  it("chữ đậm kết thúc bằng dấu hai chấm (Jodi:) đánh dấu pv-nohl; từ vựng đậm giữ nguyên", () => {
    const out = markLabelBold("<p><strong>Jodi:</strong> I feel <strong>overwhelmed by</strong> work.</p>");
    expect(out).toContain('<strong class="pv-nohl">Jodi:</strong>');
    expect(out).toContain("<strong>overwhelmed by</strong>");
  });
  it("chữ đậm dài hoặc không có dấu hai chấm: giữ nguyên", () => {
    const html = "<p><strong>keep up with</strong> and <strong>" + "x".repeat(60) + ":</strong></p>";
    expect(markLabelBold(html)).toBe(html);
  });
});


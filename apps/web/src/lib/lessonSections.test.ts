import { describe, expect, it } from "vitest";
import { splitLessonSections, practiceTabLabel, arrangeTabs, mergeTabsByLabel, passageDisplayTitle, dropRepeatedBannerTitle, markLabelBold, dropExerciseBanner, type SectionItem } from "./lessonSections";

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
  it("câu yêu cầu 2A + danh sách ngay trước phiếu 2A: cả hai vào tab của phiếu (câu yêu cầu bỏ nhãn số/chữ), phần mở đầu ở lại lý thuyết", () => {
    const chunk = rich(folio + banner + stmt("2", "A", "Work in pairs. Discuss the questions.") + list("Are tea and coffee important?", "Have you drunk any today?"));
    const r = splitLessonSections([chunk, practice("vp", "2A · Talk with a virtual partner")], ids("vp"));
    expect(r.theory).toHaveLength(1);
    expect(html(r.theory[0]!)).toContain("Reading");
    expect(html(r.theory[0]!)).not.toContain("Discuss the questions");
    expect(html(r.theory[0]!)).not.toContain("Are tea and coffee important?");
    const lead = r.tabs[0]!.lead.map(html).join("");
    expect(lead).toContain("Work in pairs. Discuss the questions.");
    expect(lead).toContain("Are tea and coffee important?");
    expect(lead).not.toContain("color:rgb(229,0,92)");
  });

  it("câu yêu cầu của bài tập KHÔNG phải bạn ảo, khối không có tên riêng: xuống tab của khối (tên tab lấy nhãn từ chính câu đó), không mất chữ", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee. What information is new to you?"));
    const r = splitLessonSections([chunk, practice("p1", "The world's favourite drug")], ids("p1"));
    expect(r.tabs[0]!.label).toBe("2B");
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("Read the article about coffee");
    expect(r.theory.map(html).join("")).not.toContain("Read the article about coffee");
  });

  it("câu yêu cầu số/chữ không khớp khối đứng sau: exercise đó chưa có tab nên thành tab riêng, không mất chữ", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee."));
    const r = splitLessonSections([chunk, practice("p1", "2D · Questions")], ids("p1"));
    expect(r.tabs.map((t) => t.label)).toEqual(["2B", "2D"]);
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("Read the article about coffee");
    expect(r.theory).toEqual([]);
  });

  it("số/chữ không khớp phiếu: câu yêu cầu không gắn vào phiếu mà thành tab riêng của exercise đó", () => {
    const chunk = rich(stmt("2", "A", "Work in pairs. Discuss the questions.") + list("one"));
    const r = splitLessonSections([chunk, practice("vp", "2D · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs.map((t) => t.label)).toEqual(["2A", "2D"]);
    expect(r.tabs[1]!.lead).toEqual([]);
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("Work in pairs. Discuss the questions.");
  });

  it("nhãn chỉ có chữ (B) nối tiếp số của câu trước; nhãn chỉ có số (6) cũng nhận ra", () => {
    const c1 = rich(stmt("6", "A", "Work in pairs. Make questions.") + stmt(null, "B", "Add two more questions."));
    const r1 = splitLessonSections([c1, practice("vp", "6B · Talk with a virtual partner")], ids("vp"));
    // 6A chưa có tab: thành tab riêng (AC6); câu 6B đi cùng phiếu 6B
    expect(r1.tabs.map((t) => t.label)).toEqual(["6A", "6B"]);
    expect(r1.tabs[0]!.lead.map(html).join("")).toContain("Make questions");
    expect(r1.tabs[1]!.lead.map(html).join("")).toContain("Add two more questions");
    const c2 = rich(stmt("6", null, "Work in pairs. Choose four questions.") + list("q1", "q2"));
    const r2 = splitLessonSections([c2, practice("vp", "6 · Talk with a virtual partner")], ids("vp"));
    expect(r2.tabs[0]!.lead.map(html).join("")).toContain("q1");
  });

  it("phiếu mang nhãn dải (2A–2C) khớp câu yêu cầu 2B", () => {
    const chunk = rich(stmt("2", "B", "Work in pairs. Discuss.") + list("x"));
    const r = splitLessonSections([chunk, practice("vp", "2A–2C · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("<li>x</li>");
  });

  it("chỉ câu cuối của khối chữ gắn vào phiếu; các câu trước (bài tập khác chưa có tab) thành tab riêng, không mất chữ", () => {
    const chunk = rich(stmt("7", "A", "Can you think of reasons?") + stmt(null, "B", "Read the article.") + stmt(null, "C", "Work in pairs. Tick the points.") + list("p1"));
    const r = splitLessonSections([chunk, practice("vp", "7C · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs.map((t) => t.label)).toEqual(["7A", "7B", "7C"]);
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("Can you think of reasons?");
    expect(r.tabs[1]!.lead.map(html).join("")).toContain("Read the article.");
    expect(r.theory.map(html).join("")).not.toContain("Tick the points");
    expect(r.tabs[2]!.lead.map(html).join("")).toContain("Tick the points");
    expect(r.tabs[2]!.lead.map(html).join("")).toContain("<li>p1</li>");
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
  it("tab không bắt đầu bằng số (tên khối, Free practice): đứng sau các tab có số, giữ thứ tự cũ với nhau", () => {
    expect(arrangeTabs([t("8B"), t("Fair Isle: fact file"), t("1A"), t("Free practice")]).map((x) => x.label)).toEqual(["1A", "8B", "Fair Isle: fact file", "Free practice"]);
  });
  it("khoá tiếng Trung: nhãn kiểu \"2 (1) · …\" không phải mã exercise, nên không bị kéo lên trước tab chữ (giữ thứ tự cũ)", () => {
    const labels = ["Match the words with the pictures", "2 (1) · Talk with a virtual partner", "2 (2) · Talk with a virtual partner"];
    expect(arrangeTabs(labels.map((l) => t(l, true))).map((x) => x.label)).toEqual(labels);
    const text = ["课文1 · Listen", "课文1 · Role-play", "课文1 · Speaking: answer the questions", "小语讲堂 1"];
    expect(arrangeTabs(text.map((l) => t(l))).map((x) => x.label)).toEqual(text);
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

  it("không có trong tập bài đọc đã lên trên: câu yêu cầu xuống tab của khối, không còn ở lý thuyết", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee."));
    const r = splitLessonSections([chunk, practice("p1", "The world's favourite drug")], ids("p1"));
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("Read the article about coffee.");
    expect(r.theory.map(html).join("")).not.toContain("Read the article about coffee.");
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

describe("splitLessonSections — câu yêu cầu chưa có tab thành tab riêng (AC6)", () => {
  const h3 = "<h3>Seven reasons why being bored is good for you</h3>";
  const para = "<p>As society gets busier and busier, we find that even when we are alone we are constantly stimulated.</p>";

  it("7A, 7B chỉ có chữ (không bài luyện): mỗi câu một tab; bài báo sau tiêu đề ở lại lý thuyết", () => {
    const chunk = rich(folio + banner + stmt("7", "A", "Can you think of any reasons why being bored might be good for you?") + stmt(null, "B", "Read the article. Does it mention any of your ideas?") + h3 + para + stmt("7", "C", "Tick the points you agree with."));
    const r = splitLessonSections([chunk, practice("vp", "7C · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs.map((t) => t.label)).toEqual(["7A", "7B", "7C"]);
    const a = r.tabs[0]!;
    expect(a.lead.map(html).join("")).toContain("Can you think of any reasons");
    expect(r.tabs[1]!.lead.map(html).join("")).toContain("Read the article");
    const theory = r.theory.map(html).join("");
    expect(theory).toContain("Seven reasons why being bored");
    expect(theory).toContain("constantly stimulated");
    expect(theory).not.toContain("Can you think of any reasons");
    expect(theory).not.toContain("Read the article. Does it mention");
    expect(theory).toContain("Student’s Book");
  });

  it("câu yêu cầu của exercise ĐÃ có tab (khối 2B của bài đọc): ở lại lý thuyết", () => {
    const chunk = rich(stmt("2", "B", "Read the article about coffee."));
    const r = splitLessonSections([chunk, practice("p1", "2B · The world's favourite drug")], ids("p1"));
    expect(r.tabs.map((t) => t.label)).toEqual(["2B"]);
    expect(r.theory.map(html).join("")).toContain("Read the article about coffee");
  });

  it("exercise đã có trong nhãn các đoạn của một khối gom (3A–3C): không thêm tab", () => {
    const chunk = rich(stmt("3", "B", "Choose the correct alternatives."));
    const r = splitLessonSections([chunk, practice("p1", "The passive · Practice")], ids("p1"), new Map([["p1", ["3A · x", "3B · y", "3C · z"]]]));
    expect(r.tabs.map((t) => t.label)).toEqual(["3A–3C"]);
    expect(r.theory.map(html).join("")).toContain("Choose the correct alternatives.");
  });

  it("exercise chưa có tab: tab không có khối bài luyện (không bạn ảo), danh sách đi kèm vào tab", () => {
    const chunk = rich(stmt("8", "B", "Write your listicle.") + list("one", "two"));
    const r = splitLessonSections([rich(banner), chunk, practice("vp", "8A · Plan with a virtual partner")], ids("vp"));
    const t = r.tabs.find((x) => x.label === "8B")!;
    expect(t.virtualPartner).toBe(false);
    expect(t.lead.map(html).join("")).toContain("<li>two</li>");
  });

  it("1A rồi 1B liền nhau trước một khối không có tên riêng: khối là 1A (câu yêu cầu xuống tab), 1B thành tab riêng", () => {
    const chunk = rich(banner + stmt("1", "A", "Work in pairs. Read the texts.") + stmt("1", "B", "What do the lists tell you about the people?"));
    const r = splitLessonSections([chunk, practice("p1", "Match the items with the photos")], ids("p1"));
    expect(r.tabs.map((t) => t.label)).toEqual(["1A", "1B"]);
    const a = r.tabs[0]!;
    expect(a.statement).toBe(false);
    expect(a.lead.map(html).join("")).toContain("Work in pairs");
    expect(r.tabs[1]!.statement).toBe(true);
    expect(r.tabs[1]!.lead.map(html).join("")).toContain("What do the lists tell you");
    const theory = r.theory.map(html).join("");
    expect(theory).not.toContain("Work in pairs");
    expect(theory).not.toContain("What do the lists tell you");
  });

  it("một câu yêu cầu duy nhất trước khối không tên: câu đó xuống tab của khối", () => {
    const chunk = rich(banner + stmt("2", "A", "Match the words."));
    const r = splitLessonSections([chunk, practice("p1", "Vocabulary match")], ids("p1"));
    expect(r.tabs.map((t) => t.label)).toEqual(["2A"]);
    expect(r.tabs[0]!.lead.map(html).join("")).toContain("Match the words.");
    expect(r.theory.map(html).join("")).not.toContain("Match the words.");
  });

  it("không còn khối chữ rỗng trong lý thuyết khi cả khối chỉ gồm câu yêu cầu đã chuyển thành tab", () => {
    const chunk = rich(stmt("8", "B", "Write your listicle."));
    const r = splitLessonSections([chunk, practice("vp", "8A · Plan")], ids("vp"));
    expect(r.theory).toEqual([]);
  });

  it("trong tab riêng của câu yêu cầu, nhãn số/chữ của sách bị bỏ (số đã có trên tab), chữ giữ nguyên", () => {
    const chunk = rich(stmt("7", "A", "Can you think of any reasons?") + list("x"));
    const r = splitLessonSections([chunk, practice("vp", "7C · Talk with a virtual partner")], ids("vp"));
    const lead = r.tabs.find((t) => t.label === "7A")!.lead.map(html).join("");
    expect(lead).toContain("Can you think of any reasons?");
    expect(lead).toContain("<li>x</li>");
    expect(lead).not.toContain("color:rgb(229,0,92)");
    expect(lead).not.toMatch(/>7</);
  });

  it("tab của câu yêu cầu đánh dấu statement; tab của bài luyện thì không", () => {
    const chunk = rich(stmt("7", "A", "Can you think of any reasons?") + stmt("7", "C", "Tick the points."));
    const r = splitLessonSections([chunk, practice("vp", "7C · Talk with a virtual partner")], ids("vp"));
    expect(r.tabs.map((t) => [t.label, t.statement])).toEqual([["7A", true], ["7C", false]]);
  });
});


describe("dropExerciseBanner — bỏ thanh \"Exercise N\" khỏi lý thuyết", () => {
  const ex = (t: string) => `<h2 id="muc-x"><span style="display:block">${t}</span></h2>`;
  it("bỏ banner Exercise 1, giữ phần còn lại", () => {
    expect(dropExerciseBanner(`<p>a</p>${ex("Exercise 1")}<p>b</p>`)).toBe("<p>a</p><p>b</p>");
  });
  it("bỏ cả tiêu đề h3 chỉ có chữ \"Exercise 2\" (không có span)", () => {
    expect(dropExerciseBanner('<p>a</p><h3 id="muc-exercise-2" style="color:red">Exercise 2</h3><p>b</p>')).toBe("<p>a</p><p>b</p>");
  });
  it("giữ tiêu đề có thêm chữ sau số", () => {
    const h = "<h3>Exercise 2 · Listening</h3>";
    expect(dropExerciseBanner(h)).toBe(h);
  });
  it("giữ banner có chữ khác", () => {
    const h = ex("Vocabulary") + ex("Reading");
    expect(dropExerciseBanner(h)).toBe(h);
  });
});

describe("splitLessonSections — banner phần của sách (FUNCTION, LEARN TO) đi cùng tab đầu của khối liền sau", () => {
  const brand = (name: string, sub: string) =>
    `<h2 id="muc-${name}"><span style="display:block;background:linear-gradient(90deg,rgb(229,0,92),rgba(229,0,92,.1));color:#fff">${name}</span><span>${sub}</span></h2>`;
  const page = (n: number) => `<p style="text-align:right">Student’s Book · page ${n}</p>`;
  const exh = (n: number) => `<h3 id="muc-exercise-${n}" style="color:rgb(229,0,92)">Exercise ${n}</h3>`;

  it("banner + số trang + \"Exercise N\" đứng giữa bài: thành intro của khối kế tiếp, không còn ở lý thuyết", () => {
    const top = rich(brand("Vocabulary", "Everyday objects") + page(14));
    const fn = rich(brand("Function", "Describing objects") + page(14) + exh(2));
    const r = splitLessonSections([top, practice("p1", "Match"), fn, practice("p2", "Describing objects · Practice")], ids("p1", "p2"));
    expect(r.theory.map((i) => i.id)).toEqual([top.id]);
    const t = r.tabs.find((x) => x.id === "p2")!;
    expect(t.intro).toHaveLength(1);
    expect(html(t.intro![0]!)).toContain("Function");
    expect(html(t.intro![0]!)).toContain("page 14");
    expect(html(t.intro![0]!)).not.toContain("Exercise 2");
    expect(r.tabs.find((x) => x.id === "p1")!.intro).toBeUndefined();
  });

  it("banner đầu bài (chưa có lý thuyết nào đứng trước) ở lại để bài vẫn mở đầu bằng banner", () => {
    const first = rich(brand("Reading", "Coffee") + page(8));
    const r = splitLessonSections([first, practice("p1", "7 · X")], ids("p1"));
    expect(r.theory.map((i) => i.id)).toEqual([first.id]);
    expect(r.tabs[0]!.intro).toBeUndefined();
  });

  it("chỉ còn dòng số trang sau khi câu yêu cầu xuống tab phiếu bạn ảo: bỏ hẳn, không thành thẻ trống", () => {
    const top = rich(brand("Vocabulary", "x") + page(14));
    const s4b = rich(page(15) + exh(4) + stmt("4", "B", "Choose three items.") + `<p>A: It’s made of leather.</p>`);
    const r = splitLessonSections([top, practice("p1", "4A · Complete"), s4b, practice("p2", "4B · Talk with a virtual partner")], ids("p1", "p2"));
    expect(r.theory.map((i) => i.id)).toEqual([top.id]);
    const t = r.tabs.find((x) => x.id === "p2")!;
    expect(t.intro).toBeUndefined();
    expect(html(t.lead[0]!)).toContain("Choose three items.");
  });

  it("khối chữ có nội dung khác (đoạn văn, danh sách) thì không bị coi là banner trơ: giữ nguyên ở lý thuyết", () => {
    const top = rich(brand("Vocabulary", "x") + page(14));
    const mid = rich(brand("Function", "y") + page(14) + `<p>Some real explanation.</p>`);
    const r = splitLessonSections([top, practice("p1", "A"), mid, practice("p2", "B")], ids("p1", "p2"));
    expect(r.theory.map((i) => i.id)).toEqual([top.id, mid.id]);
    expect(r.tabs.every((t) => !t.intro)).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VocabListView from "./VocabListView";
import DialogueView from "./DialogueView";
import LessonContent from "./LessonContent";

// Như AudioLessonPlayer.test: các trình phát nặng của LessonContent không có gì
// để vẽ ngoài trình duyệt. Hai khối ngôn ngữ phải import TĨNH để có trong HTML.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

const AUDIO = "/api/lesson-media/audio/11111111-2222-4333-8444-555555555555-1790000000000-ab12cd34ef567890.mp3";
const text = (out: string) => out.replace(/<[^>]+>/g, "");
const count = (out: string, re: RegExp) => (out.match(re) ?? []).length;

const items = [
  { id: "i1", term: "朋友", reading: "péngyou", meaning: "bạn bè", example: "他是我的朋友。", exampleMeaning: "Anh ấy là bạn tôi.", audioUrl: AUDIO },
  { id: "i2", term: "你好", reading: "nǐ hǎo", meaning: "xin chào" },
];

describe("VocabListView — G2.3.1 / 2.3.2 / 2.3.4 / 2.3.5 / 2.3.6", () => {
  const render = (p: Partial<React.ComponentProps<typeof VocabListView>> = {}) =>
    renderToStaticMarkup(<VocabListView items={items} {...p} />);

  it("hiện từ, phiên âm, nghĩa, ví dụ và bản dịch ví dụ", () => {
    const t = text(render());
    for (const s of ["朋友", "péngyou", "bạn bè", "他是我的朋友。", "Anh ấy là bạn tôi.", "你好", "xin chào"]) {
      expect(t).toContain(s);
    }
  });

  it("tiêu đề khối và nhãn cột phiên âm: mặc định 'Phiên âm', giảng viên đặt được", () => {
    expect(text(render({ title: "Từ mới bài 5" }))).toContain("Từ mới bài 5");
    expect(text(render())).toContain("Phiên âm");
    expect(text(render({ readingLabel: "Pinyin" }))).toContain("Pinyin");
    expect(text(render({ readingLabel: "Pinyin" }))).not.toContain("Phiên âm");
  });

  it("không có từ nào có phiên âm thì không dựng cột/nhãn phiên âm rỗng", () => {
    const t = text(render({ items: [{ id: "x", term: "a", meaning: "b" }] }));
    expect(t).not.toContain("Phiên âm");
  });

  it("G2.3.1: bố cục co giãn bằng lớp responsive (thẻ dọc ở mobile, bảng từ sm trở lên)", () => {
    const out = render();
    expect(out).toMatch(/sm:grid-cols|sm:table|sm:flex-row/);
  });

  it("G2.3.5: chỉ dòng có audio mới có nút nghe; không dòng nào có thì không có nút nghe", () => {
    const out = render();
    expect(count(out, /aria-label="Nghe [^"]*"/g)).toBe(1);
    expect(out).toContain('aria-label="Nghe 朋友"');
    const none = render({ items: [{ id: "x", term: "a", meaning: "b" }] });
    expect(count(none, /aria-label="Nghe /g)).toBe(0);
  });

  it("G2.3.4: thẻ HTML trong dữ liệu hiện nguyên chữ, không thành phần tử", () => {
    const out = render({ items: [{ id: "x", term: "<img src=x onerror=alert(1)>", meaning: "<b>đậm</b>", note: "<script>alert(1)</script>" }] });
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;img");
  });

  it("G2.3.6: có nút 'Che nghĩa' chưa bật mặc định; bật thì nghĩa và phiên âm được đánh dấu che", () => {
    const off = render();
    expect(text(off)).toContain("Che nghĩa");
    expect(off).toMatch(/aria-pressed="false"[^>]*>[^<]*Che nghĩa|Che nghĩa[^]*aria-pressed="false"/);
    expect(count(off, /data-masked="true"/g)).toBe(0);

    const on = render({ initialMasked: true });
    expect(on).toMatch(/aria-pressed="true"/);
    // mỗi dòng che nghĩa + phiên âm; dòng 1 còn che bản dịch ví dụ
    expect(count(on, /data-masked="true"/g)).toBeGreaterThanOrEqual(items.length * 2);
  });

  it("G2.3.6: phần 'từ' không bao giờ bị che (đó là câu hỏi để tự kiểm tra)", () => {
    const on = render({ initialMasked: true });
    const termCell = on.split("朋友")[0]!.split("<").pop() ?? "";
    expect(termCell).not.toContain("data-masked");
  });
});

describe("DialogueView — G2.3.3 / 2.3.4 / 2.3.5", () => {
  const turns = [
    { id: "t1", speaker: "A", text: "你好！", reading: "Nǐ hǎo!", translation: "Xin chào!", audioUrl: AUDIO },
    { id: "t2", speaker: "B", text: "你好，好久不见。", translation: "Chào, lâu rồi không gặp." },
    { id: "t3", speaker: "A", text: "最近忙吗？" },
  ];
  const render = (p: Partial<React.ComponentProps<typeof DialogueView>> = {}) =>
    renderToStaticMarkup(<DialogueView turns={turns} {...p} />);

  it("hiện người nói, lời, phiên âm và bản dịch", () => {
    const t = text(render({ title: "Hội thoại bài 5", caption: "Nghe hai lần." }));
    for (const s of ["Hội thoại bài 5", "Nghe hai lần.", "A", "B", "你好！", "Nǐ hǎo!", "Xin chào!", "好久不见"]) {
      expect(t).toContain(s);
    }
  });

  it("cùng một người nói luôn nằm cùng một bên; người đầu tiên bên trái", () => {
    const sides = [...render().matchAll(/data-side="(left|right)"/g)].map((m) => m[1]);
    expect(sides).toEqual(["left", "right", "left"]);
  });

  it("nút nghe riêng chỉ có ở lượt có audio", () => {
    const out = render();
    expect(count(out, /aria-label="Nghe [^"]*"/g)).toBe(1);
    expect(count(render({ turns: turns.map(({ audioUrl: _a, ...t }) => t) }), /aria-label="Nghe /g)).toBe(0);
  });

  it("có audio cả bài thì dùng trình phát audio đầy đủ; không có thì không có <audio>", () => {
    const withAll = render({ audioUrl: AUDIO });
    expect(withAll).toMatch(/<audio[^>]*\bcontrols\b/);
    expect(withAll).toContain(`src="${AUDIO}"`);
    expect(render()).not.toContain("<audio");
  });

  it("nút 'Bản dịch' bật/tắt: tắt thì bản dịch được che, lời gốc vẫn hiện", () => {
    expect(text(render())).toContain("Bản dịch");
    expect(count(render(), /data-masked="true"/g)).toBe(0);
    const hidden = render({ initialShowTranslation: false });
    expect(count(hidden, /data-masked="true"/g)).toBe(2); // t1 và t2 có bản dịch
    expect(text(hidden)).toContain("你好！");
  });

  it("G2.3.4: HTML trong lời hiện nguyên chữ", () => {
    const out = render({ turns: [{ id: "x", speaker: "<i>A</i>", text: "<img src=x onerror=alert(1)>" }] });
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<i>");
  });
});

describe("LessonContent — nối vocab_list và dialogue vào trang bài", () => {
  it("vocab_list được vẽ bằng VocabListView", () => {
    const out = renderToStaticMarkup(
      <LessonContent items={[{ id: "c1", type: "vocab_list", orderIndex: 0, payload: { title: "Từ mới", items } }]} />,
    );
    expect(text(out)).toContain("Từ mới");
    expect(text(out)).toContain("朋友");
  });

  it("dialogue được vẽ bằng DialogueView", () => {
    const out = renderToStaticMarkup(
      <LessonContent
        items={[{ id: "c2", type: "dialogue", orderIndex: 0, payload: { title: "Hội thoại", turns: [{ id: "t", speaker: "A", text: "你好！" }] } }]}
      />,
    );
    expect(text(out)).toContain("Hội thoại");
    expect(text(out)).toContain("你好！");
  });

  it("payload hỏng không làm sập cả trang bài", () => {
    expect(() =>
      renderToStaticMarkup(
        <LessonContent
          items={[
            { id: "c3", type: "vocab_list", orderIndex: 0, payload: null },
            { id: "c4", type: "dialogue", orderIndex: 1, payload: { turns: "sai" } },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});

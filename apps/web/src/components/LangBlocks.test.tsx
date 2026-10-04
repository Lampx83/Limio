import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import VocabListView from "./VocabListView";
import DialogueView from "./DialogueView";
import LessonContent from "./LessonContent";
import { SOURCE_TEXT_COLOR } from "@/lib/langText";

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

  it("G2.3.6: tự kiểm tra bằng hai nút bật/tắt độc lập — phiên âm và nghĩa (thay cho một nút 'Che nghĩa'); mặc định cả hai bật", () => {
    const def = render();
    const group = def.split('aria-label="Hiển thị"')[1] ?? "";
    expect(text(group)).toContain("Phiên âm");
    expect(text(group)).toContain("Nghĩa");
    expect(count(def, /data-masked="true"/g)).toBe(0);

    // chỉ tắt nghĩa: mỗi dòng che nghĩa (+ ví dụ có bản dịch), phiên âm vẫn hiện
    const noMeaning = render({ initialShowMeaning: false });
    expect(count(noMeaning, /data-masked="true"/g)).toBeGreaterThanOrEqual(items.length);
    expect(noMeaning).toMatch(/data-masked="true"[^>]*>xin chào|data-masked="true"[^>]*>bạn bè/);

    // chỉ tắt phiên âm: chỉ dòng có phiên âm bị che (và phiên âm của ví dụ)
    const noReading = render({ initialShowReading: false });
    expect(count(noReading, /data-masked="true"/g)).toBeGreaterThanOrEqual(2);
    expect(noReading).not.toMatch(/data-masked="true"[^>]*>bạn bè/);

    const neither = render({ initialShowReading: false, initialShowMeaning: false });
    expect(count(neither, /data-masked="true"/g)).toBeGreaterThanOrEqual(items.length * 2);
  });

  it("không dòng nào có phiên âm thì không có nút phiên âm", () => {
    const t = text(render({ items: [{ id: "x", term: "a", meaning: "b" }] }).split('aria-label="Hiển thị"')[1] ?? "");
    expect(t).not.toContain("Phiên âm");
    expect(t).toContain("Nghĩa");
  });

  it("tối ưu chỗ: có câu ví dụ thì từ màn hình rộng (lg) ví dụ sang cột riêng cùng hàng với từ; header có cột 'Ví dụ'; không có ví dụ thì không có cột đó", () => {
    const out = render();
    expect(out).toContain("lg:col-start-4"); // ví dụ ở cột 4 (có phiên âm)
    expect(out).toContain("lg:grid-cols-[");
    expect(text(out.split('aria-label="Hiển thị"')[1] ?? "")).toContain("Ví dụ");
    const noEx = render({ items: items.map((i) => ({ id: i.id, term: i.term, reading: i.reading, meaning: i.meaning })) });
    expect(noEx).not.toContain("lg:col-start-4");
    expect(text(noEx)).not.toContain("Ví dụ");
    // không có phiên âm: ví dụ ở cột 3
    const noReading = render({
      items: items.map((i) => ({ id: i.id, term: i.term, meaning: i.meaning, example: i.example })),
    });
    expect(noReading).toContain("lg:col-start-3");
  });

  it("nút nghe nằm ngay trước chữ ở cột 1 (không còn cột nút riêng cuối hàng)", () => {
    const row = render().split('id="vocab-i1"')[1]!.split("</li>")[0]!;
    expect(row.indexOf('aria-label="Nghe 朋友"')).toBeGreaterThan(-1);
    expect(row.indexOf('aria-label="Nghe 朋友"')).toBeLessThan(row.indexOf("朋友</"));
  });

  it("G2.3.6: phần 'từ' không bao giờ bị che (đó là câu hỏi để tự kiểm tra)", () => {
    const on = render({ initialShowReading: false, initialShowMeaning: false });
    const termCell = on.split("朋友")[0]!.split("<").pop() ?? "";
    expect(termCell).not.toContain("data-masked");
  });
});

describe("màu lời gốc (chữ Hán…)", () => {
  it("từ, câu ví dụ trong từ vựng và lời trong hội thoại dùng cùng một màu riêng", () => {
    const vocab = renderToStaticMarkup(<VocabListView items={items} />);
    const dlg = renderToStaticMarkup(
      <DialogueView turns={[{ id: "t1", speaker: "A", text: "你好！" }]} />,
    );
    const classOf = (html: string, str: string) => html.split(str)[0]!.split("<").pop() ?? "";
    expect(classOf(vocab, ">朋友</")).toContain(SOURCE_TEXT_COLOR);
    expect(classOf(vocab, ">他是我的朋友。</")).toContain(SOURCE_TEXT_COLOR);
    expect(classOf(dlg, ">你好！</")).toContain(SOURCE_TEXT_COLOR);
  });
  it("phiên âm và nghĩa KHÔNG dùng màu của lời gốc", () => {
    const vocab = renderToStaticMarkup(<VocabListView items={items} />);
    expect(classOf2(vocab, ">péngyou</")).not.toContain(SOURCE_TEXT_COLOR);
    expect(classOf2(vocab, ">bạn bè</")).not.toContain(SOURCE_TEXT_COLOR);
  });
});

function classOf2(html: string, str: string) {
  return html.split(str)[0]!.split("<").pop() ?? "";
}

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

  it("K1: có lượt nào có audio thì có nút 'Nghe cả đoạn'; không có lượt nào có audio thì không", () => {
    expect(text(render())).toContain("Nghe cả đoạn");
    const none = turns.map(({ audioUrl: _a, ...t }) => t);
    expect(text(render({ turns: none }))).not.toContain("Nghe cả đoạn");
  });

  it("K1: mỗi lượt có id riêng trong DOM để tự cuộn tới lượt đang phát; chưa phát thì không tô sáng", () => {
    const out = render();
    for (const t of turns) expect(out).toContain(`id="dlg-turn-${t.id}"`);
    expect(out).not.toContain("data-playing");
  });

  it("K2b.5: không có mốc thì y như trước — không lượt nào bấm được chỉ vì có audio cả đoạn", () => {
    const out = render({ audioUrl: AUDIO });
    const li = (id: string) => out.split(`id="dlg-turn-${id}"`)[1]!.split("</li>")[0]!;
    expect(li("t2")).not.toContain("cursor-pointer");
    expect(out).not.toContain("data-playing");
  });

  it("K2b.2: có mốc + audio cả đoạn → lượt có mốc bấm được (tua) dù không có audio riêng; lượt không mốc thì không; chưa phát thì chưa tô sáng", () => {
    const marked = turns.map((t, i) => (i === 1 ? { ...t, startSec: 4.2 } : t));
    const out = render({ audioUrl: AUDIO, turns: marked });
    const li = (id: string) => out.split(`id="dlg-turn-${id}"`)[1]!.split("</li>")[0]!;
    expect(li("t2")).toContain("cursor-pointer");
    expect(li("t3")).not.toContain("cursor-pointer");
    expect(out).not.toContain("data-playing");
  });

  it("K2b.5: có mốc nhưng KHÔNG có audio cả đoạn → không bấm được", () => {
    const marked = turns.map((t, i) => (i === 1 ? { ...t, startSec: 4.2 } : t));
    const out = render({ turns: marked });
    expect(out.split(`id="dlg-turn-t2"`)[1]!.split("</li>")[0]!).not.toContain("cursor-pointer");
  });

  it("K1: lượt có audio là vùng bấm được; lượt không có audio thì không", () => {
    const out = render();
    const li = (id: string) => out.split(`id="dlg-turn-${id}"`)[1]!.split("</li>")[0]!;
    expect(li("t1")).toContain("cursor-pointer");
    expect(li("t2")).not.toContain("cursor-pointer");
  });

  it("mọi lượt cùng một cột (không chia trái/phải — có thể có nhiều hơn 2 người nói); người nói phân biệt bằng số thứ tự và màu avatar", () => {
    const out = render();
    expect(out).not.toContain("data-side");
    expect(out).not.toContain("flex-row-reverse");
    const idx = [...out.matchAll(/data-speaker="(\d+)"/g)].map((m) => m[1]);
    expect(idx).toEqual(["0", "1", "0"]); // A, B, A: cùng người nói luôn cùng số
  });

  it("nhiều người nói (A B C D E F G): mỗi người một màu avatar; người nói cùng tên dùng lại đúng màu; quá số màu thì quay vòng", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    const many = [...names, "A"].map((speaker, i) => ({ id: `m${i}`, speaker, text: `câu ${i}` }));
    const out = render({ turns: many });
    const avatar = (i: number) =>
      out.split(`id="dlg-turn-m${i}"`)[1]!.match(/<span aria-hidden="true"[^>]*class="([^"]+)"/)![1]!.replace(/\s*ring-2 ring-brand-400\s*/, " ").trim();
    const tones = names.map((_, i) => avatar(i));
    expect(new Set(tones.slice(0, 6)).size).toBe(6); // 6 người đầu: 6 màu khác nhau
    expect(tones[6]).toBe(tones[0]); // người thứ 7 quay vòng về màu thứ nhất
    expect(avatar(7)).toBe(tones[0]); // A nói lại: cùng màu lần trước
  });

  it("nút nghe riêng chỉ có ở lượt có audio", () => {
    const out = render();
    expect(count(out, /aria-label="Nghe [^"]*"/g)).toBe(1);
    expect(count(render({ turns: turns.map(({ audioUrl: _a, ...t }) => t) }), /aria-label="Nghe /g)).toBe(0);
  });

  it("có audio cả bài thì dùng trình phát audio đầy đủ; không có thì không có <audio>", () => {
    const withAll = render({ audioUrl: AUDIO });
    expect(withAll).toMatch(/<audio\b/);
    expect(withAll).toContain('aria-label="Tiến độ phát"'); // thanh phát tự vẽ của AudioLessonPlayer
    expect(withAll).toContain(`src="${AUDIO}"`);
    expect(render()).not.toContain("<audio");
  });

  it("phiên âm có nút bật/tắt riêng: nhãn mặc định 'Phiên âm', giảng viên đặt được (Pinyin, IPA…); không lượt nào có phiên âm thì không có nút", () => {
    expect(text(render())).toContain("Phiên âm");
    expect(text(render({ readingLabel: "IPA" }))).toContain("IPA");
    expect(text(render({ readingLabel: "IPA" }))).not.toContain("Phiên âm");
    const none = turns.map(({ reading: _r, ...t }) => t);
    expect(text(render({ turns: none }))).not.toContain("Phiên âm");
  });

  it("ba dạng chữ: lời gốc luôn hiện; phiên âm và tiếng Việt tắt/bật độc lập", () => {
    const both = render();
    expect(count(both, /data-masked="true"/g)).toBe(0);
    const noReading = render({ initialShowReading: false });
    expect(count(noReading, /data-masked="true"/g)).toBe(1); // chỉ t1 có phiên âm
    const noTranslation = render({ initialShowTranslation: false });
    expect(count(noTranslation, /data-masked="true"/g)).toBe(2); // t1, t2 có bản dịch
    const neither = render({ initialShowReading: false, initialShowTranslation: false });
    expect(count(neither, /data-masked="true"/g)).toBe(3);
    // chữ gốc không bao giờ bị che
    for (const s of ["你好！", "你好，好久不见。", "最近忙吗？"]) expect(text(neither)).toContain(s);
    const lineOf = (s: string) => neither.split(s)[0]!.split("<").pop() ?? "";
    expect(lineOf("你好！")).not.toContain("data-masked");
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

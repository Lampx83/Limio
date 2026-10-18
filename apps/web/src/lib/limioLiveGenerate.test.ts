import { describe, expect, it } from "vitest";
import {
  BATCH_SIZE,
  applyStructure,
  configFromOutline,
  deepStripEmoji,
  draftToSlide,
  estimateGenerationTokens,
  generateDeckSlides,
  makeBatches,
  proposalFromDraft,
  sectionNumbers,
  type SlideDraft,
} from "./limioLiveGenerate";
import type { OutlineSlide } from "./limioLiveOutline";

const os = (id: string, kind: OutlineSlide["kind"], layout: OutlineSlide["layout"], title: string, points: string[] = []): OutlineSlide => ({ id, kind, layout, title, points });
const empty: SlideDraft = { index: 0 };

describe("applyStructure: chữ do mạch cấu trúc quyết định", () => {
  it("slide mở phần nhận số phần, tên phần và mục lục, ghi đè bản AI viết", () => {
    const g = draftToSlide(os("a", "content", "section", "Ứng dụng"), { index: 0, title: "Tên AI đổi", subtitle: "Phần này trả lời câu hỏi dùng AR thế nào." }, "07");
    const out = applyStructure(g, { sectionNo: "02", toc: ["Khái niệm", "Ứng dụng", "Thiết kế"], tocCurrent: 2 });
    expect(out.config).toMatchObject({ layout: "section", sectionNumber: "02", title: "Ứng dụng", toc: ["Khái niệm", "Ứng dụng", "Thiết kế"], tocCurrent: 2 });
    expect(out.config.subtitle).toBe("Phần này trả lời câu hỏi dùng AR thế nào.");
  });

  it("slide Mục lục nhận đúng tên các phần", () => {
    const g = draftToSlide(os("b", "content", "summary", "Nội dung buổi học"), { index: 0, title: "Nội dung buổi học", items: [{ heading: "AI viết khác." }, { heading: "Và khác nữa." }] }, "");
    expect(applyStructure(g, { agenda: ["Khái niệm", "Ứng dụng"] }).config.items).toEqual([
      { heading: "Khái niệm", body: "" },
      { heading: "Ứng dụng", body: "" },
    ]);
  });

  it("không có thông tin mạch hoặc slide tương tác thì giữ nguyên", () => {
    const g = draftToSlide(os("c", "word_cloud", null, "Một từ?"), { index: 0, prompt: "Một từ về AR?" }, "");
    expect(applyStructure(g, { agenda: ["x"] })).toBe(g);
    expect(applyStructure(g, null)).toBe(g);
  });
});

describe("makeBatches", () => {
  it("chia theo lô, lô cuối có thể ngắn hơn", () => {
    expect(makeBatches(12)).toEqual([[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11]]);
    expect(makeBatches(0)).toEqual([]);
    expect(BATCH_SIZE).toBe(5);
  });
});

describe("deepStripEmoji", () => {
  it("bỏ emoji ở mọi tầng", () => {
    expect(deepStripEmoji({ a: "Hay 🚀", b: ["x ✅", { c: "y ⭐" }] })).toEqual({ a: "Hay", b: ["x", { c: "y" }] });
  });
});

describe("draftToSlide — slide nội dung", () => {
  it("ba thẻ hợp lệ: lọc, gắn meta, giữ ghi chú, bỏ emoji", () => {
    const slide = os("o1", "content", "cards", "Ba câu hỏi");
    const g = draftToSlide(
      slide,
      {
        index: 1,
        title: "Ba câu hỏi 🎯",
        items: [
          { heading: "Mục tiêu là gì?", body: "Người học biết cần đạt điều gì.", icon: "target" },
          { heading: "Hiện đang ở đâu?", body: "Bài làm cho thấy mức đạt.", icon: "bogus" },
          { heading: "Bước tiếp theo?", body: "Một việc cụ thể.", icon: "route" },
        ],
        notes: "Nhấn mạnh ý đầu. ✨",
      },
      "",
    );
    expect(g.usedFallback).toBe(false);
    expect(g.type).toBe("content");
    expect(g.config).toMatchObject({ layout: "cards", title: "Ba câu hỏi", outlineId: "o1", aiGenerated: true, presenterNote: "Nhấn mạnh ý đầu." });
    expect((g.config.items as any[])[1].icon).toBeUndefined();
  });

  it("slide mục dùng số mục của dàn ý, không tin số do mô hình viết", () => {
    const g = draftToSlide(os("s", "content", "section", "Mục một"), { index: 0, title: "Mục một", subtitle: "Dẫn vào mục.", sectionNumber: "99" }, "02");
    expect(g.config.sectionNumber).toBe("02");
  });

  it("bìa: bỏ tên giảng viên do mô hình tự điền", () => {
    const g = draftToSlide(os("c", "content", "cover", "Bài"), { index: 0, title: "Bài", subtitle: "Mô tả.", byline: "Giảng viên bịa" }, "");
    expect(g.config.byline).toBeUndefined();
  });

  it("thiếu bản nháp hoặc nháp hỏng thì rơi về dàn ý", () => {
    const slide = os("o2", "content", "cards", "Ba ý", ["Một: giải thích một.", "Hai: giải thích hai.", "Ba: giải thích ba."]);
    for (const bad of [undefined, empty, { index: 0, title: "Ba ý", items: [{ heading: "x", body: "" }] }]) {
      const g = draftToSlide(slide, bad, "");
      expect(g.usedFallback).toBe(true);
      expect((g.config.items as any[]).map((i) => i.heading)).toEqual(["Một", "Hai", "Ba"]);
      expect((g.config.items as any[])[0].body).toBe("giải thích một.");
    }
  });

  it("so sánh phải đủ hai cột có ví dụ", () => {
    const slide = os("o3", "content", "compare", "So sánh");
    const ok = draftToSlide(slide, { index: 0, title: "So sánh", columns: [{ heading: "A", tone: "bad", points: ["“x”"], note: "n" }, { heading: "B", tone: "good", points: ["“y”"], note: "m" }] }, "");
    expect(ok.usedFallback).toBe(false);
    const bad = draftToSlide(slide, { index: 0, title: "So sánh", columns: [{ heading: "A", tone: "bad", points: [], note: "" }] }, "");
    expect(bad.usedFallback).toBe(true);
  });

  it("số liệu fallback: không có con số thì chuyển sang ba thẻ, không bịa số", () => {
    const g = configFromOutline(os("o4", "content", "stats", "Số liệu", ["Phản hồi giúp tiến bộ.", "Người học cần thời gian.", "Cần mục tiêu."]), "");
    expect(g.config.layout).toBe("cards");
    const withNum = configFromOutline(os("o5", "content", "stats", "Số liệu", ["Ba câu hỏi 3 được trả lời.", "Hai nội dung 2 gồm điểm mạnh.", "Một việc 1 cụ thể."]), "");
    expect(withNum.config.layout).toBe("stats");
    expect((withNum.config.items as any[])[0].heading).toBe("3");
  });
});

describe("draftToSlide — slide tương tác", () => {
  const quiz = os("q", "quiz", null, "Câu nào đúng?");
  it("quiz hợp lệ: đúng một đáp án đúng", () => {
    const g = draftToSlide(quiz, { index: 2, question: "Câu nào là phản hồi cụ thể?", options: [{ text: "A", correct: false }, { text: "B", correct: true }, { text: "C", correct: false }, { text: "D", correct: false }], notes: "Đáp án đúng là B." }, "");
    expect(g).toMatchObject({ type: "quiz", usedFallback: false });
    expect((g.config.options as any[]).filter((o) => o.correct)).toHaveLength(1);
    expect(g.config.presenterNote).toBe("Đáp án đúng là B.");
  });
  it("quiz không có hoặc nhiều đáp án đúng thì rơi về khung để giảng viên tự điền", () => {
    for (const opts of [
      [{ text: "A", correct: false }, { text: "B", correct: false }],
      [{ text: "A", correct: true }, { text: "B", correct: true }],
      [{ text: "A", correct: true }],
    ]) {
      const g = draftToSlide(quiz, { index: 0, question: "Q?", options: opts }, "");
      expect(g.usedFallback).toBe(true);
      expect(g.config.question).toBe("Câu nào đúng?");
    }
  });
  it("poll và word cloud", () => {
    const p = draftToSlide(os("p", "poll", null, "Ý kiến?"), { index: 0, question: "Bạn thấy sao?", options: [{ text: "Tốt", correct: true }, { text: "Chưa" }] }, "");
    expect(p).toMatchObject({ type: "poll", usedFallback: false });
    expect((p.config.options as any[])[0]).toEqual({ text: "Tốt" });
    const w = draftToSlide(os("w", "word_cloud", null, "Một từ"), { index: 0, prompt: "Em hãy gửi một từ." }, "");
    expect(w).toMatchObject({ type: "word_cloud", usedFallback: false });
    expect(draftToSlide(os("w", "word_cloud", null, "Một từ"), { index: 0, prompt: " " }, "").usedFallback).toBe(true);
  });
});

describe("slide cộng tác từ dàn ý", () => {
  it("Dán Note: type collaborate_board, chế độ free, prompt lấy từ dàn ý khi AI hỏng", () => {
    const g = configFromOutline(os("b", "collaborate_board", null, "Hãy dán một vướng mắc."), "");
    expect(g).toMatchObject({ type: "collaborate_board", usedFallback: true });
    expect(g.config).toMatchObject({ prompt: "Hãy dán một vướng mắc.", mode: "free", allowViewOthers: true, blockPaste: false, outlineId: "b", aiGenerated: true });
  });
  it("Draw-it: cùng type collaborate_board nhưng mode drawing", () => {
    const g = configFromOutline(os("d", "draw_it", null, "Vẽ sơ đồ quy trình."), "");
    expect(g.type).toBe("collaborate_board");
    expect(g.config).toMatchObject({ prompt: "Vẽ sơ đồ quy trình.", mode: "drawing" });
  });
  it("Whiteboard: config chỉ có title", () => {
    const g = configFromOutline(os("w", "whiteboard", null, "Giải bài toán cùng nhau."), "");
    expect(g).toMatchObject({ type: "whiteboard", usedFallback: true });
    expect(g.config).toMatchObject({ title: "Giải bài toán cùng nhau.", outlineId: "w" });
    expect(g.config).not.toHaveProperty("mode");
  });
  it("bản nháp AI hợp lệ được dùng, bỏ emoji, giữ ghi chú giảng", () => {
    const b = draftToSlide(os("b", "collaborate_board", null, "x"), { index: 0, prompt: "Hãy dán một ví dụ 🚀 em từng gặp.", notes: "Nhắc cả lớp." }, "");
    expect(b).toMatchObject({ type: "collaborate_board", usedFallback: false });
    expect(b.config).toMatchObject({ prompt: "Hãy dán một ví dụ em từng gặp.", mode: "free", presenterNote: "Nhắc cả lớp." });
    const d = draftToSlide(os("d", "draw_it", null, "x"), { index: 0, prompt: "Vẽ một sơ đồ." }, "");
    expect(d.config).toMatchObject({ prompt: "Vẽ một sơ đồ.", mode: "drawing" });
    const w = draftToSlide(os("w", "whiteboard", null, "x"), { index: 0, prompt: "Cùng giải bài này." }, "");
    expect(w).toMatchObject({ type: "whiteboard", usedFallback: false });
    expect(w.config).toMatchObject({ title: "Cùng giải bài này." });
  });
  it("bản nháp thiếu prompt thì rơi về dàn ý", () => {
    for (const k of ["collaborate_board", "draw_it", "whiteboard"] as const) {
      expect(draftToSlide(os("x", k, null, "Tiêu đề dàn ý"), { index: 0, prompt: " " }, "").usedFallback).toBe(true);
      expect(draftToSlide(os("x", k, null, "Tiêu đề dàn ý"), undefined, "").usedFallback).toBe(true);
    }
  });
});

describe("sectionNumbers / estimateGenerationTokens", () => {
  it("đánh số mục theo thứ tự slide section", () => {
    const s = [os("1", "content", "cover", "a"), os("2", "content", "section", "b"), os("3", "content", "image", "c"), os("4", "content", "section", "d")];
    expect(sectionNumbers(s)).toEqual(["", "01", "", "02"]);
  });
  it("ước lượng tăng theo số slide và độ dài tài liệu, có chặn trên", () => {
    const a = estimateGenerationTokens({ sourceChars: 5000, slideCount: 10 });
    const b = estimateGenerationTokens({ sourceChars: 5000, slideCount: 20 });
    const c = estimateGenerationTokens({ sourceChars: 500000, slideCount: 10 });
    const d = estimateGenerationTokens({ sourceChars: 24000, slideCount: 10 });
    expect(b.total).toBeGreaterThan(a.total);
    expect(c.total).toBe(d.total);
    expect(a.total).toBe(a.input + a.output);
  });
});

describe("generateDeckSlides", () => {
  const outline = Array.from({ length: 12 }, (_, i) => os(`o${i}`, "content", "image", `Slide ${i}`, ["Ý một.", "Ý hai."]));
  const goodDraft = (i: number): SlideDraft => ({ index: i, title: `Slide ${i}`, bullets: ["Câu một.", "Câu hai.", "Câu ba."], notes: "Ghi chú." });
  const never = () => false;

  it("sinh theo lô, giữ thứ tự và báo tiến độ tăng dần đến tổng", async () => {
    const calls: number[][] = [];
    const progress: number[] = [];
    const r = await generateDeckSlides({
      outline,
      concurrency: 2,
      isFatal: never,
      onProgress: (d) => progress.push(d),
      generateBatch: async (idx) => {
        calls.push(idx);
        return idx.map(goodDraft);
      },
    });
    expect(calls).toHaveLength(3);
    expect(r.slides).toHaveLength(12);
    expect(r.fallbackCount).toBe(0);
    expect(r.slides.map((s) => s.config.outlineId)).toEqual(outline.map((o) => o.id));
    expect(progress[progress.length - 1]).toBe(12);
    expect([...progress].sort((a, b) => a - b)).toEqual(progress);
  });

  it("một lô hỏng: thử lại một lần; vẫn hỏng thì dùng dàn ý, các lô khác không ảnh hưởng", async () => {
    let attemptsOnFirst = 0;
    const r = await generateDeckSlides({
      outline,
      isFatal: never,
      generateBatch: async (idx) => {
        if (idx[0] === 0) {
          attemptsOnFirst++;
          throw new Error("openai_error");
        }
        return idx.map(goodDraft);
      },
    });
    expect(attemptsOnFirst).toBe(2);
    expect(r.fallbackCount).toBe(5);
    expect(r.slides[0]!.usedFallback).toBe(true);
    expect(r.slides[7]!.usedFallback).toBe(false);
  });

  it("lỗi tạm thời ở lần đầu nhưng lần thử lại thành công thì không phải dự phòng", async () => {
    let n = 0;
    const r = await generateDeckSlides({
      outline: outline.slice(0, 5),
      isFatal: never,
      generateBatch: async (idx) => {
        if (n++ === 0) throw new Error("tạm thời");
        return idx.map(goodDraft);
      },
    });
    expect(r.fallbackCount).toBe(0);
  });

  it("hết hạn mức: dừng ngay, ném lỗi, không trả slide nào", async () => {
    const cap = new Error("daily_token_cap");
    let calls = 0;
    await expect(
      generateDeckSlides({
        outline,
        concurrency: 1,
        isFatal: (e) => e === cap,
        generateBatch: async (idx) => {
          calls++;
          if (calls === 2) throw cap;
          return idx.map(goodDraft);
        },
      }),
    ).rejects.toBe(cap);
    expect(calls).toBe(2);
  });

  it("dàn ý rỗng trả về rỗng", async () => {
    const r = await generateDeckSlides({ outline: [], isFatal: never, generateBatch: async () => [] });
    expect(r).toEqual({ slides: [], fallbackCount: 0 });
  });
});

describe("proposalFromDraft", () => {
  const current = {
    config: {
      layout: "cards",
      title: "Ba câu hỏi",
      items: [{ heading: "a", body: "b" }],
      presenterNote: "Ghi chú cũ.",
      outlineId: "o1",
      aiGenerated: true,
      editedByUser: true,
      hidden: true,
    },
  };
  const cardsDraft: SlideDraft = {
    index: 0,
    title: "Ba câu hỏi",
    items: [
      { heading: "Mục tiêu", body: "Nêu rõ đích đến.", icon: "target" },
      { heading: "Hiện trạng", body: "Chỉ ra mức đạt.", icon: "compass" },
      { heading: "Bước tiếp", body: "Giao một việc cụ thể.", icon: "route" },
    ],
    notes: "Ghi chú mới của AI.",
  };

  it("giữ ghi chú và mọi dấu vết của slide cũ, nội dung lấy từ AI", () => {
    const r = proposalFromDraft("shorter", current, cardsDraft)!;
    expect(r.type).toBe("content");
    expect((r.config.items as any[])[0].body).toBe("Nêu rõ đích đến.");
    expect(r.config).toMatchObject({ presenterNote: "Ghi chú cũ.", outlineId: "o1", aiGenerated: true, editedByUser: true, hidden: true });
  });
  it("slide cũ chưa có ghi chú thì dùng ghi chú của AI", () => {
    const { presenterNote: _drop, ...noNote } = current.config;
    expect(proposalFromDraft("simpler", { config: noNote }, cardsDraft)!.config.presenterNote).toBe("Ghi chú mới của AI.");
  });
  it("đổi thành quiz: loại mới là quiz, bỏ khoá bố cục, vẫn giữ dấu vết", () => {
    const r = proposalFromDraft("to_quiz", current, {
      index: 0,
      question: "Câu nào đúng?",
      options: [{ text: "A", correct: false }, { text: "B", correct: true }],
    })!;
    expect(r.type).toBe("quiz");
    expect(r.config.layout).toBeUndefined();
    expect(r.config.question).toBe("Câu nào đúng?");
    expect(r.config).toMatchObject({ outlineId: "o1", presenterNote: "Ghi chú cũ." });
  });
  it("nháp hỏng thì không có đề xuất (không rơi về nội dung dựng sẵn)", () => {
    expect(proposalFromDraft("shorter", current, undefined)).toBeNull();
    expect(proposalFromDraft("shorter", current, { index: 0, title: "x", items: [{ heading: "a", body: "" }] })).toBeNull();
    expect(proposalFromDraft("to_quiz", current, { index: 0, question: "Q?", options: [{ text: "A", correct: true }, { text: "B", correct: true }] })).toBeNull();
  });
  it("bỏ emoji trong đề xuất", () => {
    const r = proposalFromDraft("shorter", current, { ...cardsDraft, title: "Ba câu hỏi 🎯" })!;
    expect(r.config.title).toBe("Ba câu hỏi");
  });
});

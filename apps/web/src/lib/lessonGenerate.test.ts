// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { LessonOutline, SectionDraft, SourcePara } from "@feedbackme/shared-types";
import { EXTENSIONS } from "@/components/richtext/extensions";
import { probeEditorLoss } from "@/components/richtext/lossProbe";
import { generateLessons, generationSteps, type GenerateDeps } from "./lessonGenerate";
import { inline, missingParas } from "./lessonRender";

const PARAS: SourcePara[] = [
  { t: "Nguyên tắc gần nhau phát biểu rằng mắt người xem các phần tử đặt gần nhau là một nhóm." },
  { img: "/api/lesson-media/images/a.png", alt: "Ba nhóm ô vuông" },
  { t: "Khoảng trắng cho người đọc biết đâu là ranh giới giữa các nhóm thông tin." },
  { t: "Lưu ý: hãy thử khoảng cách trước, chỉ thêm khung khi cần." },
  { t: "Bước một là liệt kê các trường. Bước hai là gom nhóm." },
];

const OUTLINE: LessonOutline = {
  ignoredParas: [],
  lessons: [
    {
      id: "l1",
      title: "Nguyên tắc gần nhau",
      objectives: ["Trình bày được nguyên tắc gần nhau."],
      sections: [
        { id: "a", title: "Khái niệm", layout: "image", points: ["Gần nhau là một nhóm."], boxes: [], paras: [0, 1, 2] },
        { id: "b", title: "Lưu ý khi dùng", layout: "cards", points: ["Thử khoảng cách trước."], boxes: ["note"], paras: [3] },
      ],
    },
    {
      id: "l2",
      title: "Áp dụng",
      objectives: [],
      sections: [{ id: "c", title: "Các bước", layout: "steps", points: ["Liệt kê rồi gom."], boxes: [], paras: [4] }],
    },
  ],
};

/** Mô hình giả: "giữ nguyên lời" — chép đúng chữ của các đoạn tài liệu. */
const faithful: GenerateDeps = {
  async writeSection({ section, paras }) {
    const texts = section.paras.map((n) => paras[n]).filter((p): p is { t: string } => !!p && "t" in p).map((p) => p.t);
    const d: SectionDraft = {
      intro: section.layout === "image" ? texts : [],
      parts: section.layout === "image" ? [] : texts.map((t, i) => ({ title: `Phần ${i + 1}`, paragraphs: [t], bullets: [] })),
      boxes: section.boxes.map((k) => ({ kind: k, title: "", paragraphs: ["Hãy **thử** khoảng cách trước."] })),
      imageCaption: "Hình 1. Ba nhóm ô vuông. Nguồn: tự vẽ.",
    };
    return d;
  },
  async writeSummary() {
    return ["Các phần tử gần nhau được xem là một nhóm."];
  },
};

const input = { outline: OUTLINE, paras: PARAS, writing: "keep" as const, addObjectivesSummary: true };

describe("AI viết bài từ dàn ý đã chốt (Mốc 3)", () => {
  it("đúng số bài, số mục, thứ tự và tên mục (T3); ảnh tài liệu được giữ (D2)", async () => {
    const r = await generateLessons(input, faithful);
    expect(r.lessons.map((l) => l.title)).toEqual(["Nguyên tắc gần nhau", "Áp dụng"]);
    const h = r.lessons[0]!.html;
    expect(h.indexOf("<h2>Khái niệm</h2>")).toBeLessThan(h.indexOf("<h2>Lưu ý khi dùng</h2>"));
    expect(h).toContain('data-layout="image"');
    expect(h).toContain('<img src="/api/lesson-media/images/a.png" alt="Ba nhóm ô vuông">');
    expect(h).toContain("<figcaption>Hình 1. Ba nhóm ô vuông. Nguồn: tự vẽ.</figcaption>");
    expect(h).toContain('data-kind="note" data-title="Lưu ý"');
    expect(h).toContain("<strong>thử</strong>");
    expect(h.startsWith('<div class="lesson-box" data-kind="objectives"')).toBe(true);
    expect(h).toContain('data-kind="summary"');
    expect(r.fallbackSections).toEqual([]);
    expect(r.missingParas).toEqual([]);
  });

  it("bài tạo ra mở trong trình soạn thảo không mất gì — sửa tay được ngay", async () => {
    const r = await generateLessons(input, faithful);
    for (const l of r.lessons) expect(probeEditorLoss(l.html, EXTENSIONS)).toBeNull();
  });

  it("tắt Mục tiêu và Tổng kết thì không có hai hộp đó, không gọi viết tổng kết (T2)", async () => {
    let calls = 0;
    const r = await generateLessons({ ...input, addObjectivesSummary: false }, { ...faithful, writeSummary: async () => (calls++, []) });
    expect(calls).toBe(0);
    expect(r.lessons[0]!.html).not.toContain("objectives");
    expect(r.lessons[0]!.html).not.toContain('data-kind="summary"');
  });

  it("một mục lỗi thì mục đó dùng nguyên đoạn tài liệu, các mục khác vẫn được viết (T5)", async () => {
    const progress: boolean[] = [];
    const r = await generateLessons(
      input,
      { ...faithful, writeSection: async (x) => (x.section.id === "b" ? Promise.reject(new Error("bad_json")) : faithful.writeSection(x)) },
      (p) => progress.push(p.ok),
    );
    expect(r.fallbackSections).toEqual(["Lưu ý khi dùng"]);
    expect(r.lessons[0]!.html).toContain("<p>Lưu ý: hãy thử khoảng cách trước, chỉ thêm khung khi cần.</p>");
    expect(progress).toHaveLength(generationSteps(input));
    expect(progress.filter((x) => !x)).toHaveLength(1);
  });

  it("lỗi hết hạn mức thì dừng cả lượt, không ra bài dở", async () => {
    const fatal = new Error("no_token_budget");
    await expect(
      generateLessons(input, { ...faithful, writeSection: async () => Promise.reject(fatal), isFatal: (e) => e === fatal }),
    ).rejects.toBe(fatal);
  });

  it("Giữ nguyên lời: đoạn bị bỏ hoặc bị viết lại được liệt kê để giảng viên kiểm (T6)", async () => {
    const dropping: GenerateDeps = {
      ...faithful,
      async writeSection(x) {
        const d = await faithful.writeSection(x);
        if (x.section.id === "a") d.intro = [d.intro[0]!]; // bỏ đoạn 3 (chỉ số 2)
        return d;
      },
    };
    const r = await generateLessons(input, dropping);
    expect(r.missingParas).toEqual([2]);
    const edited = await generateLessons({ ...input, writing: "edit" }, dropping);
    expect(edited.missingParas).toEqual([]);
  });

  it("chữ từ AI được thoát HTML, chỉ đậm/nghiêng thành thẻ, emoji bị gỡ", () => {
    expect(inline('<script>x</script> **a** *b* 🎯 "c"')).toBe("&lt;script&gt;x&lt;/script&gt; <strong>a</strong> <em>b</em> &quot;c&quot;");
  });

  it("đối chiếu chịu được sửa dấu câu và chia đoạn", () => {
    const html = "<p>nguyên tắc gần nhau phát biểu rằng, mắt người xem các phần tử</p><p>đặt gần nhau là một nhóm</p>";
    expect(missingParas(PARAS, [0], html)).toEqual([]);
  });
});

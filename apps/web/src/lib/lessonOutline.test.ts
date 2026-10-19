import { describe, expect, it } from "vitest";
import type { LessonOutline, SourcePara } from "@feedbackme/shared-types";
import {
  lessonReadingMinutes,
  normalizeLessonOutline,
  orphanParas,
  outlineProblems,
  pruneEmptyLessons,
  sanitizeLessonOutline,
} from "./lessonOutline";

const PARAS: SourcePara[] = [
  { t: "Lời chào đầu tài liệu." },
  { t: "Nguyên tắc gần nhau phát biểu rằng các phần tử gần nhau là một nhóm." },
  { img: "/a.png", alt: "Hình" },
  { t: "Khoảng trắng đánh dấu ranh giới." },
  { t: "Tài liệu tham khảo." },
];

describe("normalizeLessonOutline — dàn ý từ AI", () => {
  it("bố cục lạ bị thay, hộp lạ bị bỏ, emoji bị gỡ, đoạn trùng chỉ thuộc mục đầu, đoạn ngoài phạm vi bị bỏ", () => {
    const o = normalizeLessonOutline(
      {
        lessons: [
          {
            title: "Bài 🎯 gần nhau",
            objectives: ["Trình bày được nguyên tắc.", "", 5],
            sections: [
              { title: "Khái niệm", layout: "hero", points: ["Ý một."], boxes: ["note", "quiz", "note"], paras: [1, 2, 99, -1] },
              { title: "", layout: "steps", points: [], boxes: [], paras: [2, 3] },
            ],
          },
          { title: "Bài rỗng", objectives: [], sections: [] },
        ],
      },
      PARAS,
    );
    expect(o.lessons).toHaveLength(1);
    const [a, b] = o.lessons[0]!.sections;
    expect(o.lessons[0]!.title).toBe("Bài gần nhau");
    expect(o.lessons[0]!.objectives).toEqual(["Trình bày được nguyên tắc."]);
    // Mục có ảnh (đoạn 2) luôn là "Chữ và ảnh", dù mô hình trả bố cục lạ.
    // Đoạn 0 mô hình bỏ sót được nối vào mục đầu; các đoạn sau đoạn 3 nối vào mục cuối.
    expect(a).toMatchObject({ layout: "image", boxes: ["note"], paras: [0, 1, 2] });
    expect(b).toMatchObject({ title: "Mục chưa đặt tên", layout: "steps" });
    expect(b!.paras[0]).toBe(3);
    expect(a!.id).not.toBe(b!.id);
    expect(o.template).toBe("theory");
  });

  it("chỉ nhận 4 cách trình bày AI được chọn; Chữ và ảnh mà không có ảnh về Văn bản; mẫu bài được ghi vào dàn ý", () => {
    const o = normalizeLessonOutline(
      {
        lessons: [
          {
            title: "Ôn tập",
            objectives: [],
            sections: [
              { title: "Ý chính", layout: "image", points: [], boxes: [], paras: [0, 3] },
              { title: "Thẻ", layout: "cards", points: [], boxes: [], paras: [1] },
              { title: "Tự kiểm tra", layout: "faq", points: [], boxes: [], paras: [4] },
            ],
          },
        ],
      },
      PARAS,
      "review",
    );
    expect(o.lessons[0]!.sections.map((s) => s.layout)).toEqual(["text", "text", "faq"]);
    expect(o.template).toBe("review");
  });
});

describe("sanitizeLessonOutline — dàn ý giảng viên gửi lên", () => {
  it("giữ id và tiêu đề trống (đang gõ dở); đoạn bỏ qua không được trùng đoạn đã gán", () => {
    const o = sanitizeLessonOutline(
      {
        lessons: [{ id: "l1", title: "", objectives: [], sections: [{ id: "s1", title: "", layout: "faq", points: [], boxes: [], paras: [1] }] }],
        ignoredParas: [0, 1, 4],
      },
      PARAS.length,
    );
    expect(o?.lessons[0]?.id).toBe("l1");
    expect(o?.lessons[0]?.sections[0]).toMatchObject({ id: "s1", title: "", layout: "faq" });
    expect(o?.ignoredParas).toEqual([0, 4]);
  });

  it("hình dạng sai hẳn thì trả null", () => {
    expect(sanitizeLessonOutline(null, 3)).toBeNull();
    expect(sanitizeLessonOutline({ lessons: "x" }, 3)).toBeNull();
    expect(sanitizeLessonOutline({ lessons: [] }, 3)).toBeNull();
  });
});

const BASE: LessonOutline = {
  ignoredParas: [],
  lessons: [
    { id: "l1", title: "Bài", objectives: [], sections: [{ id: "s1", title: "Mục", layout: "text", points: [], boxes: [], paras: [1, 2, 3] }] },
  ],
};

describe("kiểm tra trước khi chốt", () => {
  it("đoạn chưa thuộc mục nào được liệt kê (D4); bỏ qua rồi thì hết", () => {
    expect(orphanParas(BASE, PARAS)).toEqual([0, 4]);
    expect(orphanParas({ ...BASE, ignoredParas: [0, 4] }, PARAS)).toEqual([]);
  });

  it("lỗi chặn chốt: tên bài trống, mục chưa tiêu đề, đoạn lạc", () => {
    expect(outlineProblems(BASE, PARAS)).toEqual(["2 đoạn tài liệu chưa thuộc mục nào — gán vào một mục hoặc bỏ qua."]);
    const bad: LessonOutline = {
      ignoredParas: [0, 4],
      lessons: [{ ...BASE.lessons[0]!, title: " ", sections: [{ ...BASE.lessons[0]!.sections[0]!, title: "" }] }],
    };
    expect(outlineProblems(bad, PARAS)).toEqual(["Bài học chưa có tên.", "Bài học có 1 mục chưa có tiêu đề."]);
    expect(outlineProblems({ ...BASE, ignoredParas: [0, 4] }, PARAS)).toEqual([]);
  });

  it("thời gian đọc ước lượng", () => {
    const longParas: SourcePara[] = [{ t: "chữ ".repeat(4500) }];
    const lesson = { ...BASE.lessons[0]!, sections: [{ ...BASE.lessons[0]!.sections[0]!, paras: [0] }] };
    expect(lessonReadingMinutes(lesson, longParas)).toBe(23);
  });

  it("bài không còn mục nào bị bỏ, nhưng luôn giữ ít nhất một bài", () => {
    const two: LessonOutline = { ...BASE, lessons: [BASE.lessons[0]!, { id: "l2", title: "Rỗng", objectives: [], sections: [] }] };
    expect(pruneEmptyLessons(two).lessons).toHaveLength(1);
    expect(pruneEmptyLessons({ ...BASE, lessons: [{ ...BASE.lessons[0]!, sections: [] }] }).lessons).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";
import { LessonSpec, lessonContentItems, placePractices, practiceSlotsOf } from "../import-course";

const lesson = (body: string) => LessonSpec.parse({ title: "Bài", body });
const kinds = (b: ReturnType<typeof placePractices>) => b.map((x) => ("practice" in x ? `P${x.practice + 1}` : "text"));

describe("`:::practice n` — đặt Bài luyện giữa thân bài", () => {
  it("không có mốc: bài luyện nằm sau mọi khối chữ như cũ", () => {
    const items = lessonContentItems(lesson("Đoạn một.\n\nĐoạn hai."));
    expect(kinds(placePractices(items, 2))).toEqual(["text", "P1", "P2"]);
  });

  it("có mốc: cắt khối chữ tại mốc, bài luyện nằm giữa (1A trước 1B)", () => {
    const items = lessonContentItems(lesson("**1 A** Đề A.\n\n:::practice 1\n\n**1 B** Đề B."));
    const placed = placePractices(items, 1);
    expect(kinds(placed)).toEqual(["text", "P1", "text"]);
    const html = placed.filter((x): x is { item: { payload: { html: string } } } => "item" in x).map((x) => x.item.payload.html);
    expect(html[0]).toContain("Đề A");
    expect(html[0]).not.toContain("Đề B");
    expect(html[1]).toContain("Đề B");
    expect(html.join("")).not.toContain("data-practice-slot"); // mốc không bao giờ lọt vào bài
  });

  it("mốc ở đầu hoặc cuối không sinh khối chữ rỗng; bài luyện không có mốc xuống cuối theo thứ tự", () => {
    const items = lessonContentItems(lesson(":::practice 2\n\nChữ giữa.\n\n:::practice 1"));
    expect(kinds(placePractices(items, 3))).toEqual(["P2", "text", "P1", "P3"]);
  });

  it("mốc lặp hoặc trỏ tới bài luyện không có thì bị bỏ qua, không mất khối nào", () => {
    const items = lessonContentItems(lesson("A.\n\n:::practice 1\n\nB.\n\n:::practice 1\n\nC.\n\n:::practice 9"));
    expect(kinds(placePractices(items, 1))).toEqual(["text", "P1", "text", "text"]); // A | P1 | B | C (hai mốc thừa chỉ cắt chữ)
  });

  it("practiceSlotsOf đọc đúng các số theo thứ tự", () => {
    expect(practiceSlotsOf("a\n:::practice 2\nb\n:::practice 1\n")).toEqual([2, 1]);
    expect(practiceSlotsOf(undefined)).toEqual([]);
  });
});

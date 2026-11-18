import { describe, expect, it } from "vitest";
import { defaultInstructionKey, instructionPlan, promptHasInstruction } from "./practiceSheetView";

describe("dòng yêu cầu của phiếu", () => {
  it("nhận ra đề đã có dòng yêu cầu riêng", () => {
    expect(promptHasInstruction("Sắp xếp các từ thành một câu đúng. Nghĩa: …")).toBe(true);
    expect(promptHasInstruction("Màn hình đang 播放. Chọn pinyin đúng của 播放.")).toBe(true);
    expect(promptHasInstruction("Điền một từ còn thiếu: 发视频以前")).toBe(true);
    expect(promptHasInstruction("Đúng hay sai: 师傅 chỉ dùng để gọi thầy.")).toBe(true);
    expect(promptHasInstruction("我在超市买了一[[1]]面包。")).toBe(false);
    expect(promptHasInstruction("Hôm nay là ngày mấy?")).toBe(false);
  });
  it("mặc định theo dạng câu; câu chọn có chỗ trống hỏi như điền từ", () => {
    expect(defaultInstructionKey("drag", "我买了一[[1]]面包。")).toBe("practice.sheet.instr.drag");
    expect(defaultInstructionKey("gap", "这个箱子太____了。")).toBe("practice.sheet.instr.gap");
    expect(defaultInstructionKey("choice-inline", "他买了一____洗衣机。")).toBe("practice.sheet.instr.choiceBlank");
    expect(defaultInstructionKey("choice-list", "Hôm nay là ngày mấy?")).toBe("practice.sheet.instr.choice");
    expect(defaultInstructionKey("tfng", "电梯坏了。")).toBe("practice.sheet.instr.tfng");
    expect(defaultInstructionKey("ordering", "昨天…")).toBe("practice.sheet.instr.ordering");
    expect(defaultInstructionKey("ordering", "Sắp xếp các mảnh.")).toBeNull();
    expect(defaultInstructionKey("essay", "Viết một đoạn.")).toBeNull();
    expect(defaultInstructionKey("other", "x")).toBeNull();
  });
  it("cụm cùng dạng chỉ nêu ở câu đầu; đổi dạng thì nêu lại; trường instruction của tác giả thắng", () => {
    const plan = instructionPlan([
      { kind: "drag", prompt: "a[[1]]" },
      { kind: "drag", prompt: "b[[1]]" },
      { kind: "tfng", prompt: "x" },
      { kind: "drag", prompt: "c[[1]]" },
      { kind: "gap", prompt: "Điền từ: ____" },
      { kind: "gap", prompt: "y ____", instruction: "Gõ chữ Hán." },
    ]);
    expect(plan).toEqual([
      { key: "practice.sheet.instr.drag" },
      null,
      { key: "practice.sheet.instr.tfng" },
      { key: "practice.sheet.instr.drag" },
      null,
      { text: "Gõ chữ Hán." },
    ]);
  });
});

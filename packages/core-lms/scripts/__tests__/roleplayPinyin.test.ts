import { describe, expect, it } from "vitest";
import { fillRoleplayPinyin, hasTrailingPinyin, splitTail } from "../roleplay-pinyin";

describe("hasTrailingPinyin", () => {
  it("nhận pinyin giáo viên ghi tay", () => {
    expect(hasTrailingPinyin("我的行李怎么还没出来？ Wǒ de xínglǐ zěnme hái méi chūlái?")).toBe(true);
    expect(hasTrailingPinyin("你好吗？ ni hao ma")).toBe(true);
  });
  it("câu chỉ có chữ Hán, hoặc kết thúc bằng một từ Latin, chưa có pinyin", () => {
    expect(hasTrailingPinyin("你好吗？")).toBe(false);
    expect(hasTrailingPinyin("我用App")).toBe(false);
    expect(hasTrailingPinyin("Hello")).toBe(false);
  });
});

describe("splitTail", () => {
  it("tách phần chữ Hán và phần đuôi", () => {
    expect(splitTail("你好吗？ Nǐ hǎo ma?")).toEqual({ han: "你好吗？", tail: "Nǐ hǎo ma?" });
  });
});

describe("fillRoleplayPinyin", () => {
  const map = { "你好吗？": "Nǐ hǎo ma?", "很好。": "Hěn hǎo." };
  const cfg = { rubric: "r", roleplay: { turns: [{ speaker: "A", text: "你好吗？" }, { speaker: "B", text: "很好。 Hěn hǎo." }, { speaker: "A", text: "再见！" }] } };

  it("thêm cho lượt thiếu, giữ lượt đã có, báo lượt không có trong bảng", () => {
    const r = fillRoleplayPinyin(cfg, map);
    expect(r.added).toBe(1);
    expect(r.kept).toBe(1);
    expect(r.missing).toEqual(["再见！"]);
    const turns = (r.config as typeof cfg).roleplay.turns;
    expect(turns[0]!.text).toBe("你好吗？ Nǐ hǎo ma?");
    expect(turns[1]!.text).toBe("很好。 Hěn hǎo.");
    expect(turns[2]!.text).toBe("再见！");
    expect((r.config as typeof cfg).rubric).toBe("r");
    expect(cfg.roleplay.turns[0]!.text).toBe("你好吗？"); // không sửa cấu hình cũ
  });

  it("chạy lại lần hai không thêm gì nữa", () => {
    const once = fillRoleplayPinyin(cfg, map).config;
    expect(fillRoleplayPinyin(once, map).added).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { withoutTrailingGloss } from "./PinyinLabel";

describe("withoutTrailingGloss", () => {
  it("bỏ pinyin ghi thêm khi trùng với pinyin dưới chữ", () => {
    expect(withoutTrailingGloss("钥匙 · yàoshi", ["yào", "shi"])).toBe("钥匙");
    expect(withoutTrailingGloss("租 · zū", ["zū"])).toBe("租");
    expect(withoutTrailingGloss("牙膏 · yá gāo", ["yá", "gāo"])).toBe("牙膏");
  });
  it("giữ nguyên nghĩa tiếng Việt và nhãn không có phần ghi thêm", () => {
    expect(withoutTrailingGloss("播放 · phát", ["bō", "fàng"])).toBe("播放 · phát");
    expect(withoutTrailingGloss("钥匙", ["yào", "shi"])).toBe("钥匙");
    expect(withoutTrailingGloss("我想租房子 · tôi muốn thuê nhà", ["wǒ", "xiǎng", "zū", "fáng", "zi"])).toBe("我想租房子 · tôi muốn thuê nhà");
  });
  it("giữ nguyên khi số chữ Hán không khớp số âm tiết", () => {
    expect(withoutTrailingGloss("钥匙 · yàoshi", ["yào"])).toBe("钥匙 · yàoshi");
  });
});

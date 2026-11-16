import { describe, expect, it } from "vitest";
import { taughtByNames } from "./taughtBy";

const owner = { role: "owner", user: { displayName: "Phạm Xuân Lâm" } };
const ta = { role: "ta", user: { displayName: "Trợ giảng" } };

describe("taughtByNames", () => {
  it("dùng trường Tác giả khi có, tách theo dấu phẩy", () => {
    expect(taughtByNames({ authors: "Hà Minh Hoàng, Ngô Thái Hoà ", instructors: [owner] })).toEqual(["Hà Minh Hoàng", "Ngô Thái Hoà"]);
  });
  it("trống hoặc toàn dấu cách thì lấy giảng viên chính, bỏ trợ giảng", () => {
    expect(taughtByNames({ authors: null, instructors: [owner, ta] })).toEqual(["Phạm Xuân Lâm"]);
    expect(taughtByNames({ authors: "  , ", instructors: [owner, ta] })).toEqual(["Phạm Xuân Lâm"]);
  });
});

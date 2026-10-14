import { describe, expect, it } from "vitest";
import { sortUserIds, type LightUserRow } from "./adminUserSort";

const row = (id: string, o: Partial<LightUserRow> = {}): LightUserRow => ({
  id,
  organization: null,
  roles: [],
  providers: [],
  ...o,
});

describe("sortUserIds", () => {
  it("Roles: quyền cao nhất trước (asc), nhiều vai trò hơn trước khi cùng vai trò chính; ô trống cuối", () => {
    const rows = [
      row("learner", { roles: ["learner"] }),
      row("none"),
      row("inst", { roles: ["instructor"] }),
      row("admin+inst", { roles: ["admin", "instructor"] }),
      row("admin", { roles: ["admin"] }),
    ];
    expect(sortUserIds(rows, "roles", "asc")).toEqual(["admin+inst", "admin", "inst", "learner", "none"]);
    // Đảo chiều: vẫn để ô trống cuối.
    expect(sortUserIds(rows, "roles", "desc")).toEqual(["learner", "inst", "admin", "admin+inst", "none"]);
  });

  it("Tổ chức: theo tên (không phân biệt hoa thường/dấu), người không thuộc tổ chức luôn cuối", () => {
    const rows = [
      row("b", { organization: { name: "Bách khoa" } }),
      row("none"),
      row("a", { organization: { name: "Đại học A" } }),
      row("c", { organization: { name: "kinh tế quốc dân" } }),
    ];
    expect(sortUserIds(rows, "org", "asc")).toEqual(["b", "a", "c", "none"]);
    expect(sortUserIds(rows, "org", "desc")).toEqual(["c", "a", "b", "none"]);
  });

  it("SSO: theo danh sách provider (đã sắp), không có SSO luôn cuối", () => {
    const rows = [
      row("g", { providers: ["google"] }),
      row("none"),
      row("gp", { providers: ["password", "google"] }),
      row("p", { providers: ["password"] }),
    ];
    expect(sortUserIds(rows, "sso", "asc")).toEqual(["g", "gp", "p", "none"]);
    expect(sortUserIds(rows, "sso", "desc")).toEqual(["p", "gp", "g", "none"]);
  });

  it("bằng nhau thì theo id để phân trang ổn định", () => {
    const rows = [row("z", { roles: ["learner"] }), row("a", { roles: ["learner"] })];
    expect(sortUserIds(rows, "roles", "asc")).toEqual(["a", "z"]);
    expect(sortUserIds(rows, "roles", "desc")).toEqual(["a", "z"]);
  });
});

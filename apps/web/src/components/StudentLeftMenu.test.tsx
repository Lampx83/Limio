import { describe, expect, it } from "vitest";
import { visibleStudentMenuGroups } from "./StudentLeftMenu";

/**
 * Menu học viên DUY NHẤT (docs/tieu-chi/limio-language-gop-menu.md, AC2/AC2b/AC7): "Lịch học" theo lớp có lịch,
 * "Mục tiêu" theo lớp có lịch hoặc đang có mục tiêu. Không có mục riêng cho Limio Language: khoá ngoại ngữ tìm ở
 * Danh mục khoá học như mọi khoá.
 */
const hrefs = (flags: Parameters<typeof visibleStudentMenuGroups>[0]) => visibleStudentMenuGroups(flags).flatMap((g) => g.items.map((i) => i.href));

const COMMON = [
  "/me/enrollments",
  "/me/notes",
  "/me/skills",
  "/me/badges",
  "/me/portfolio",
  "/me/reviews",
  "/catalog",
  "/tournaments",
  "/leaderboard",
  "/me/ai-tokens",
  "/me/settings",
];

describe("visibleStudentMenuGroups", () => {
  it("học viên thường: không có Lịch học và Mục tiêu; không có nhóm hay mục Ngoại ngữ nào", () => {
    const h = hrefs({});
    expect(h).toEqual(COMMON);
    expect(h).not.toContain("/me/lich-hoc");
    expect(h).not.toContain("/me/muc-tieu");
    expect(visibleStudentMenuGroups({}).map((g) => g.label)).toEqual(["Học tập", "Phản hồi", "Khám phá", "Tài khoản"]);
    // Không còn mục Lộ trình / Lịch ôn tập của vỏ Language cũ.
    expect(h.some((x) => x.startsWith("/language"))).toBe(false);
  });

  it("học ở lớp có lịch: có cả Lịch học và Mục tiêu, ngay sau Khoá học của tôi", () => {
    const h = hrefs({ showSchedule: true, showGoals: true });
    expect(h.slice(0, 3)).toEqual(["/me/enrollments", "/me/lich-hoc", "/me/muc-tieu"]);
    expect(h).toHaveLength(COMMON.length + 2);
  });

  it("không có lớp lịch nhưng đang có mục tiêu: chỉ Mục tiêu, không Lịch học", () => {
    const h = hrefs({ showSchedule: false, showGoals: true });
    expect(h).toContain("/me/muc-tieu");
    expect(h).not.toContain("/me/lich-hoc");
  });

  it("nhóm Khám phá chỉ có Danh mục khoá học, Đấu trường, Bảng xếp hạng, bất kể điều kiện nào", () => {
    for (const flags of [{}, { showSchedule: true, showGoals: true }, { showGoals: true }]) {
      const explore = visibleStudentMenuGroups(flags).find((g) => g.id === "explore")!;
      expect(explore.items.map((i) => i.href)).toEqual(["/catalog", "/tournaments", "/leaderboard"]);
    }
  });

  it("Token AI chỉ hiện khi trang đã mở khoá", () => {
    expect(hrefs({ tokensUnlocked: false })).not.toContain("/me/ai-tokens");
    expect(hrefs({ tokensUnlocked: true })).toContain("/me/ai-tokens");
  });
});

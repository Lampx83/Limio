/**
 * Sắp xếp danh sách người dùng của admin theo các cột dẫn xuất (Roles / Tổ chức / SSO).
 *
 * Prisma chỉ orderBy được cột thường của chính bảng User; Roles và SSO là quan hệ nhiều-nhiều,
 * còn sắp theo tên tổ chức thì Prisma không cho chọn NULL xếp đầu hay cuối. Vì vậy các cột này
 * sắp ở bộ nhớ trên bản "nhẹ" (id + vài trường) của toàn bộ kết quả lọc rồi mới cắt trang —
 * cùng một quy tắc cho cả 3 cột: ô trống LUÔN xuống cuối, bất kể chiều sắp xếp.
 */

/** Vai trò ưu tiên hiển thị khi chỉ đủ chỗ cho một chip: quyền cao nhất trước. Dùng chung với bảng người dùng. */
export const ROLE_PRIORITY = ["admin", "instructor", "researcher", "mentor", "learner"];

export const rolePriorityRank = (role: string): number => ROLE_PRIORITY.indexOf(role) + 1 || 99;

export type DerivedSortKey = "roles" | "org" | "sso";

export const DERIVED_SORT_KEYS: readonly DerivedSortKey[] = ["roles", "org", "sso"];

export interface LightUserRow {
  id: string;
  organization: { name: string } | null;
  roles: string[];
  providers: string[];
}

const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/** Trả về id theo thứ tự đã sắp. Hai dòng bằng nhau thì theo id để phân trang ổn định. */
export function sortUserIds(rows: readonly LightUserRow[], key: DerivedSortKey, dir: "asc" | "desc"): string[] {
  const sign = dir === "asc" ? 1 : -1;

  /** Khoá so sánh; null = ô trống (xuống cuối). */
  const keyOf = (r: LightUserRow): { rank: number; text: string } | null => {
    if (key === "org") return r.organization ? { rank: 0, text: r.organization.name } : null;
    if (key === "sso") {
      const text = [...r.providers].sort().join(", ");
      return text ? { rank: 0, text } : null;
    }
    // Roles: theo vai trò chính (cao nhất) mà cột đang hiển thị; nhiều vai trò hơn thì lên trước khi cùng vai trò chính.
    if (r.roles.length === 0) return null;
    const main = Math.min(...r.roles.map(rolePriorityRank));
    return { rank: main * 100 - r.roles.length, text: "" };
  };

  return rows
    .map((r) => ({ id: r.id, k: keyOf(r) }))
    .sort((a, b) => {
      if (!a.k && !b.k) return a.id.localeCompare(b.id);
      if (!a.k) return 1;
      if (!b.k) return -1;
      const c = a.k.rank - b.k.rank || collator.compare(a.k.text, b.k.text);
      return sign * c || a.id.localeCompare(b.id);
    })
    .map((r) => r.id);
}

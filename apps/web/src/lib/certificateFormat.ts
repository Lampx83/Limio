// Hàm định dạng dùng chung cho chứng nhận: bản PDF (certificatePdf.tsx) và bản
// xem trước HTML (app/learn/[slug]/certificate) — để hai bên không lệch nhau.

/** Chèn khoảng trắng thật giữa từng ký tự (chữ cách tay) — xem ghi chú ở `styles.kicker` của certificatePdf.tsx. */
export function tracked(s: string): string {
  return s.split("").join(" ");
}

/** "7 giờ 34 phút" — null nếu học dưới 1 phút. */
export function formatDuration(
  totalSec: number,
  t: { hours: string; minutes: string },
): string | null {
  if (totalSec < 60) return null;
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${t.hours}`);
  if (m > 0) parts.push(`${m} ${t.minutes}`);
  return parts.join(" ") || null;
}

export type CertLocale = "vi" | "en";

/** Chữ in trên chứng nhận — dùng chung cho PDF và bản xem trước HTML. */
export const CERT_STRINGS = {
  vi: {
    kicker: "CHỨNG NHẬN HOÀN THÀNH",
    skillsLabel: "KỸ NĂNG ĐÃ ĐẠT",
    issuerCaption: "Nền tảng học tập cá nhân hoá",
    certId: "Mã chứng nhận",
    verifyAt: "Xác thực tại",
    dateLocale: "vi-VN",
    hours: "giờ",
    minutes: "phút",
    moreSkills: "+{n} kỹ năng khác",
    m4aTag: "CHỨNG CHỈ VI MÔ · MICRO4ASIA",
    m4aNote:
      "Chứng chỉ vi mô thuộc dự án MICRO4ASIA, được Liên minh châu Âu đồng tài trợ",
    m4aIssuerName: "Trường Công nghệ",
    m4aIssuerCaption: "Đại học Kinh tế Quốc dân",
  },
  en: {
    kicker: "CERTIFICATE OF COMPLETION",
    skillsLabel: "SKILLS ACHIEVED",
    issuerCaption: "Personalized Learning Platform",
    certId: "Certificate ID",
    verifyAt: "Verify at",
    dateLocale: "en-GB",
    hours: "hr",
    minutes: "min",
    moreSkills: "+{n} more",
    m4aTag: "MICRO-CREDENTIAL · MICRO4ASIA",
    m4aNote:
      "Micro-credential of the MICRO4ASIA project, co-funded by the European Union",
    m4aIssuerName: "School of Technology",
    m4aIssuerCaption: "National Economics University (NEU)",
  },
} as const satisfies Record<CertLocale, Record<string, string>>;

/**
 * Thứ tự trang của PDF song ngữ: ngôn ngữ của khoá đứng trước. Khoá dạy bằng tiếng Anh (vd. MICRO4ASIA) thì trang
 * đầu — trang người xem thấy đầu tiên, cũng là trang được in — là tiếng Anh.
 */
export function certificateLocales(courseLanguage: string | null | undefined): [CertLocale, CertLocale] {
  return courseLanguage?.trim().toLowerCase().split(/[-_]/)[0] === "en" ? ["en", "vi"] : ["vi", "en"];
}

/** Tên khoá dài hơn ngưỡng này thì xuống 2 dòng ở cỡ chữ lớn — chứng nhận chuyển sang bố cục gọn để không tràn trang. */
const LONG_TITLE_CHARS = 30;

/**
 * Bố cục gọn: chữ tên khoá nhỏ hơn, khoảng cách hẹp hơn. Cần khi trang có thêm dòng MICRO4ASIA hoặc tên khoá dài —
 * trang A4 ngang cố định, nội dung tràn thì react-pdf ép logo và chồng chữ lên nhau.
 */
export function isCompactCertificate(courseTitle: string, isM4a: boolean): boolean {
  return isM4a || courseTitle.trim().length > LONG_TITLE_CHARS;
}

/** Huy hiệu kỹ năng mang tiền tố "Thành thạo: " (core-gamification) — dưới nhãn "Kỹ năng đã đạt" thì thừa, và lạc ngôn ngữ ở trang tiếng Anh. */
export function stripSkillPrefix(name: string): string {
  return name.replace(/^\s*(thành thạo|skill mastery|mastered)\s*:\s*/i, "").trim();
}

/**
 * Nhiều hơn số này thì chỉ in vài kỹ năng đầu + "+N" — khoá lesson-as-tag cấp hàng chục huy hiệu (ML: tới 49), in hết
 * là vỡ trang. Bố cục gọn chỉ còn chỗ cho 1 hàng chip.
 */
const MAX_SKILL_CHIPS = { normal: 4, compact: 2 } as const;
const SHOWN_WHEN_TRUNCATED = 2;
const MAX_SKILL_CHARS = 32;

export function certificateSkillChips(names: string[], moreLabel: string, compact = false): string[] {
  const clean = names.map(stripSkillPrefix).filter(Boolean);
  const cut = (s: string) => (s.length > MAX_SKILL_CHARS ? `${s.slice(0, MAX_SKILL_CHARS - 3).trimEnd()}...` : s);
  if (clean.length <= MAX_SKILL_CHIPS[compact ? "compact" : "normal"]) return clean.map(cut);
  const shown = clean.slice(0, SHOWN_WHEN_TRUNCATED).map(cut);
  return [...shown, moreLabel.replace("{n}", String(clean.length - SHOWN_WHEN_TRUNCATED))];
}

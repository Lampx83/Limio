import { describe, expect, it } from "vitest";
import {
  CERT_STRINGS,
  certificateLocales,
  certificateSkillChips,
  isCompactCertificate,
  stripSkillPrefix,
} from "../certificateFormat";
import { isM4aCourseSlug, M4A_COURSES } from "../micro4asia";

describe("chứng nhận theo ngôn ngữ khoá", () => {
  it("khoá tiếng Anh: trang tiếng Anh đứng đầu, vẫn kèm trang tiếng Việt", () => {
    expect(certificateLocales("en")).toEqual(["en", "vi"]);
    expect(certificateLocales("en-US")).toEqual(["en", "vi"]);
    expect(certificateLocales(" EN ")).toEqual(["en", "vi"]);
  });

  it("khoá tiếng Việt hoặc chưa đặt ngôn ngữ: giữ như cũ, tiếng Việt đứng đầu", () => {
    expect(certificateLocales("vi")).toEqual(["vi", "en"]);
    expect(certificateLocales(null)).toEqual(["vi", "en"]);
    expect(certificateLocales(undefined)).toEqual(["vi", "en"]);
  });

  it("hai bộ chữ có đủ cùng các khoá, không chuỗi rỗng", () => {
    const keys = Object.keys(CERT_STRINGS.vi).sort();
    expect(Object.keys(CERT_STRINGS.en).sort()).toEqual(keys);
    for (const lang of ["vi", "en"] as const) {
      for (const k of keys) expect(CERT_STRINGS[lang][k as keyof (typeof CERT_STRINGS)["vi"]].trim()).not.toBe("");
    }
  });

  it("bản tiếng Anh không lẫn chữ tiếng Việt", () => {
    for (const v of Object.values(CERT_STRINGS.en)) {
      expect(v).not.toMatch(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i);
    }
  });
});

describe("nhận diện khoá MICRO4ASIA", () => {
  it("mọi slug trong danh sách sáu vi tín chỉ đều được nhận", () => {
    for (const c of M4A_COURSES) expect(isM4aCourseSlug(c.slug)).toBe(true);
  });

  it("khoá khác, slug rỗng hoặc null thì không", () => {
    expect(isM4aCourseSlug("lap-trinh-python-co-ban")).toBe(false);
    expect(isM4aCourseSlug("")).toBe(false);
    expect(isM4aCourseSlug(null)).toBe(false);
  });
});

describe("kỹ năng in trên chứng nhận", () => {
  const many = Array.from({ length: 49 }, (_, i) => `Thành thạo: Skill number ${i + 1}`);

  it("bỏ tiền tố 'Thành thạo:' của huy hiệu", () => {
    expect(stripSkillPrefix("Thành thạo: Cross-Validation")).toBe("Cross-Validation");
    expect(stripSkillPrefix("Cross-Validation")).toBe("Cross-Validation");
  });

  it("ít kỹ năng thì in hết", () => {
    expect(certificateSkillChips(many.slice(0, 4), "+{n} more")).toHaveLength(4);
  });

  it("nhiều kỹ năng (lesson-as-tag, ML có tới 49) thì in 2 cái đầu + '+N'", () => {
    expect(certificateSkillChips(many, "+{n} more")).toEqual(["Skill number 1", "Skill number 2", "+47 more"]);
  });

  it("bố cục gọn chỉ còn 1 hàng: hơn 2 kỹ năng là rút gọn", () => {
    expect(certificateSkillChips(many.slice(0, 3), "+{n} more", true)).toEqual(["Skill number 1", "Skill number 2", "+1 more"]);
  });

  it("tên kỹ năng quá dài bị cắt", () => {
    const [chip] = certificateSkillChips(["Thành thạo: Reading classification_report and confusion_matrix"], "+{n}");
    expect(chip?.length).toBeLessThanOrEqual(32);
    expect(chip?.endsWith("...")).toBe(true);
  });

  it("bố cục gọn khi là khoá M4A hoặc tên khoá dài", () => {
    expect(isCompactCertificate("Python", true)).toBe(true);
    expect(isCompactCertificate("Mathematical Foundations for Data Science", false)).toBe(true);
    expect(isCompactCertificate("Lập trình Python cơ bản", false)).toBe(false);
  });
});

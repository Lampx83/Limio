import type { OrgKind } from "@feedbackme/core-lms";
import { HSK_COPY, HSK_LEVELS } from "../hsk";
import { builtinMicro4Asia, HSK_SLUG } from "./builtin";
import type { SpaceStored } from "./settings";
import type { SpaceConfig, SpaceLang } from "./types";

/** Các khoá chữ người quản trị chỉnh trong form (phần còn lại dùng mặc định). */
export const SPACE_EDITABLE_COPY = ["heroLead", "heroAccent", "intro", "coursesSub", "footnote", "metaDescription"] as const;

/** Chuyển một SpaceConfig đầy đủ thành phần lưu được (dùng làm mẫu để nạp vào form). */
export function storedFromConfig(cfg: SpaceConfig): SpaceStored {
  const copy: NonNullable<SpaceStored["copy"]> = {};
  for (const l of cfg.langs) {
    const c = cfg.copy[l];
    copy[l] = Object.fromEntries(SPACE_EDITABLE_COPY.map((k) => [k, c[k]]).filter(([, v]) => v)) as Partial<typeof c>;
  }
  return {
    name: cfg.name,
    titleSuffix: cfg.titleSuffix,
    primary: cfg.palette.primary,
    accent: cfg.palette.accent,
    dark: cfg.palette.dark,
    soft: cfg.palette.soft,
    accent2: cfg.palette.accent2,
    logoUrl: cfg.logoUrl ?? undefined,
    logoAlt: cfg.logoAlt,
    partnerLogoUrl: cfg.partnerLogoUrl ?? undefined,
    partnerLogoAlt: cfg.partnerLogoAlt || undefined,
    heroVisualUrl: cfg.heroVisualUrl ?? undefined,
    siteUrl: cfg.siteUrl ?? undefined,
    siteLabel: cfg.siteLabel ?? undefined,
    langs: cfg.langs,
    defaultLang: cfg.defaultLang,
    courses: cfg.courses.map((c) => ({
      slug: c.slug,
      title: c.title,
      iconUrl: c.iconUrl ?? undefined,
      topic: c.topic as Partial<Record<SpaceLang, string>>,
      outcome: c.outcome as Partial<Record<SpaceLang, string>>,
    })),
    copy,
  };
}

/**
 * Mẫu space HSK (/hsk). Khác MICRO4ASIA, space này không dựng sẵn trong mã mà sống hoàn toàn trong DB
 * (Organization.space): quản trị nạp mẫu này vào form rồi Lưu, sau đó chỉnh trong DB/form như mọi space khác.
 * Mang theo đủ chữ hai ngôn ngữ (kể cả các mục form không sửa) và dải số liệu để trang giống bản thiết kế.
 */
export function hskTemplate(): SpaceStored {
  return {
    name: "HSK 3.0",
    titleSuffix: "Limio",
    // lime-800 làm nền, lime-400 làm màu nhấn, hồng của chữ "io" trong logo Limio làm nhấn thứ hai.
    primary: "#3F6212",
    accent: "#A3E635",
    dark: "#365314",
    soft: "#ECFCCB",
    accent2: "#DB2777",
    logoUrl: "/favicon.svg",
    logoAlt: "Limio",
    heroVisualUrl: "/brand/hsk/hero.svg",
    limioBrand: true,
    langs: ["vi", "en"],
    defaultLang: "vi",
    stats: {
      vi: [
        { n: "9", label: "cấp độ" },
        { n: "3.0", label: "chuẩn HSK" },
      ],
      en: [
        { n: "9", label: "levels" },
        { n: "3.0", label: "HSK standard" },
      ],
    },
    courses: HSK_LEVELS.map((l) => ({ slug: l.slug, title: l.title, topic: l.topic, outcome: l.outcome })),
    copy: { vi: HSK_COPY.vi, en: HSK_COPY.en },
  };
}

export { HSK_SLUG };

export const SPACE_TEMPLATES: Array<{ id: string; label: string; build: () => SpaceStored }> = [
  { id: "micro4asia", label: "MICRO4ASIA (NEU) — 6 vi tín chỉ", build: () => storedFromConfig(builtinMicro4Asia()) },
  { id: "hsk", label: "HSK 3.0 (Limio) — 9 cấp tiếng Trung", build: hskTemplate },
];

// ---- Mẫu theo loại tổ chức (docs/tieu-chi/space-theo-loai-to-chuc-buoc-1.md) ----

/** Chữ khởi đầu theo loại tổ chức. `{T}` là tên tổ chức, được điền lúc dựng mẫu. Không hứa điều trang space chưa có (lịch khai giảng, ô nhập mã, nút mua). */
const KIND_COPY: Record<OrgKind, Record<SpaceLang, Pick<SpaceCopyEditable, CopyEditableKey>>> = {
  school: {
    vi: {
      heroLead: "Học trực tuyến cùng",
      heroAccent: "{T}",
      intro: "Các khoá học do giảng viên của {T} xây dựng. Đăng ký tài khoản để vào học, làm bài và xem nhận xét của giảng viên.",
      coursesSub: "Chọn khoá học phù hợp và bắt đầu.",
      footnote: "{T}, xây dựng trên Limio.",
      metaDescription: "Các khoá học trực tuyến của {T} trên Limio.",
    },
    en: {
      heroLead: "Learn online with",
      heroAccent: "{T}",
      intro: "Courses built by the instructors of {T}. Create an account to enrol, do the exercises and read your instructor's feedback.",
      coursesSub: "Pick the course that suits you and get started.",
      footnote: "{T}, built on Limio.",
      metaDescription: "Online courses from {T} on Limio.",
    },
  },
  center: {
    vi: {
      heroLead: "Học cùng",
      heroAccent: "{T}",
      intro: "Các khoá học và lớp của {T}. Chọn khoá phù hợp với trình độ của bạn, đăng ký tài khoản để vào học và theo dõi buổi học của lớp.",
      coursesSub: "Chọn khoá theo trình độ và mục tiêu của bạn.",
      footnote: "{T}, xây dựng trên Limio.",
      metaDescription: "Khoá học và lớp của {T} trên Limio.",
    },
    en: {
      heroLead: "Study with",
      heroAccent: "{T}",
      intro: "Courses and classes from {T}. Choose the course that matches your level, create an account to join, and follow your class sessions.",
      coursesSub: "Choose a course by your level and goal.",
      footnote: "{T}, built on Limio.",
      metaDescription: "Courses and classes from {T} on Limio.",
    },
  },
  publisher: {
    vi: {
      heroLead: "Học liệu số của",
      heroAccent: "{T}",
      intro: "Bộ học liệu của {T} trên Limio, gồm bài học, bài tập và nhận xét. Đăng ký tài khoản để bắt đầu học.",
      coursesSub: "Chọn bộ học liệu bạn cần.",
      footnote: "{T}, xuất bản trên Limio.",
      metaDescription: "Học liệu số của {T} trên Limio.",
    },
    en: {
      heroLead: "Digital learning materials from",
      heroAccent: "{T}",
      intro: "Learning materials from {T} on Limio, with lessons, exercises and feedback. Create an account to start learning.",
      coursesSub: "Choose the materials you need.",
      footnote: "{T}, published on Limio.",
      metaDescription: "Digital learning materials from {T} on Limio.",
    },
  },
};

type CopyEditableKey = (typeof SPACE_EDITABLE_COPY)[number];
type SpaceCopyEditable = Record<CopyEditableKey, string>;

export const KIND_TEMPLATE_LABEL: Record<OrgKind, string> = {
  school: "Trường thường",
  center: "Trung tâm",
  publisher: "Nhà xuất bản",
};

/** Mẫu khởi đầu của một loại tổ chức: tên, bảng màu thương hiệu Limio và chữ hai ngôn ngữ; không có khoá, logo hay mã space. */
export function templateForKind(kind: OrgKind, orgName: string): SpaceStored {
  const name = orgName.trim() || "Tổ chức";
  const fill = (c: Pick<SpaceCopyEditable, CopyEditableKey>) =>
    Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.replaceAll("{T}", name)])) as Partial<SpaceCopyEditable>;
  const copy = KIND_COPY[kind] ?? KIND_COPY.school;
  return {
    name,
    titleSuffix: "Limio",
    // Cùng bảng màu với mẫu HSK: lime-800 nền, lime-400 nhấn, hồng của chữ "io" nhấn thứ hai.
    primary: "#3F6212",
    accent: "#A3E635",
    dark: "#365314",
    soft: "#ECFCCB",
    accent2: "#DB2777",
    langs: ["vi", "en"],
    defaultLang: "vi",
    copy: { vi: fill(copy.vi), en: fill(copy.en) },
  };
}

export interface SpaceTemplateOption {
  id: string;
  label: string;
  /** "kind": chỉ thay chữ (giữ khoá, logo, ảnh đang có); "project": nạp trọn bộ như trước. */
  group: "kind" | "project";
  build: () => SpaceStored;
}

/** Danh sách "Nạp mẫu" cho tổ chức loại `kind`: mẫu của đúng loại đó đứng đầu, rồi các mẫu dự án như cũ. */
export function templatesForKind(kind: OrgKind, orgName: string): SpaceTemplateOption[] {
  return [
    { id: `kind-${kind}`, label: KIND_TEMPLATE_LABEL[kind] ?? KIND_TEMPLATE_LABEL.school, group: "kind", build: () => templateForKind(kind, orgName) },
    ...SPACE_TEMPLATES.map((t) => ({ ...t, group: "project" as const })),
  ];
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null || v === "" || v === false) return true;
  if (Array.isArray(v)) return v.every(isEmptyValue);
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).every(isEmptyValue);
  return false;
}

/** Space chưa từng được cấu hình (không tên, màu, chữ, khoá, ảnh nào): form mở sẵn mẫu theo loại. Đã có bất kỳ gì thì không bao giờ ghi đè. */
export function isBlankSpace(stored: SpaceStored): boolean {
  return isEmptyValue(stored);
}

/**
 * Trang giới thiệu học liệu HSK (/hsk): chín cấp tiếng Trung theo chuẩn HSK 3.0 do Limio xây dựng.
 *
 * Mỗi cấp gắn với một `slug` khoá học trên Limio: có khoá published với slug đó thì thẻ hiện "Đang mở",
 * chưa có (hoặc còn bản nháp) thì hiện "Sắp ra mắt" — không phải sửa code khi một cấp được xuất bản,
 * chỉ cần dùng đúng slug `hsk-<cấp>-goc`.
 *
 * Phần "Bạn sẽ có thể" mô tả mục tiêu của cấp theo tinh thần chuẩn HSK 3.0 (sơ cấp 1–3, trung cấp 4–6,
 * cao cấp 7–9); cố ý không nêu số từ/chữ cụ thể để không hứa quá những gì từng khoá đã có.
 */
import type { SpaceCopy, SpaceLang } from "./space/types";

export type HskLang = SpaceLang;

export interface HskLevel {
  level: number;
  /** Slug khoá học trên Limio. */
  slug: string;
  /** Tên dùng khi khoá chưa published; khoá đã có thì thẻ dùng tên thật trong DB. */
  title: string;
  topic: Record<HskLang, string>;
  outcome: Record<HskLang, string>;
}

export const HSK_LEVELS: HskLevel[] = [
  {
    level: 1,
    slug: "hsk-1-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 1",
    topic: {
      vi: "Phát âm, câu đầu tiên và 15 chủ đề đời sống",
      en: "Pronunciation, first sentences and 15 everyday topics",
    },
    outcome: {
      vi: "chào hỏi, giới thiệu bản thân và hỏi đáp những điều rất quen thuộc về gia đình, số đếm, thời gian và đồ vật quanh mình bằng những câu ngắn.",
      en: "greet people, introduce yourself and ask and answer about family, numbers, time and everyday things in short sentences.",
    },
  },
  {
    level: 2,
    slug: "hsk-2-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 2",
    topic: {
      vi: "Mua sắm, đi lại, sức khoẻ và sở thích",
      en: "Shopping, getting around, health and hobbies",
    },
    outcome: {
      vi: "trao đổi về những việc quen thuộc hằng ngày như mua sắm, đi lại, sức khoẻ, sở thích và kể lại việc đã xảy ra bằng câu đơn giản.",
      en: "talk about familiar daily matters such as shopping, travel, health and hobbies, and retell things that happened in simple sentences.",
    },
  },
  {
    level: 3,
    slug: "hsk-3-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 3",
    topic: {
      vi: "Học tập, công việc và những tình huống thường gặp",
      en: "Study, work and common everyday situations",
    },
    outcome: {
      vi: "xử lý các tình huống thường gặp khi học tập, làm việc và đi lại; hiểu bài đọc ngắn và viết đoạn văn ngắn về chủ đề quen thuộc.",
      en: "handle common situations in study, work and travel, understand short texts and write short paragraphs on familiar topics.",
    },
  },
  {
    level: 4,
    slug: "hsk-4-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 4",
    topic: {
      vi: "25 chủ đề: hội thoại dài hơn, bài đọc và ngữ pháp nâng cao",
      en: "25 topics: longer conversations, reading and more advanced grammar",
    },
    outcome: {
      vi: "trao đổi khá trôi chảy về nhiều chủ đề quen thuộc, hiểu hội thoại và bài đọc dài hơn, nêu ý kiến và giải thích lý do.",
      en: "converse fairly fluently on many familiar topics, follow longer conversations and texts, and give opinions with reasons.",
    },
  },
  {
    level: 5,
    slug: "hsk-5-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 5",
    topic: {
      vi: "Báo chí, xã hội và trình bày quan điểm",
      en: "News, society and presenting a point of view",
    },
    outcome: {
      vi: "đọc báo chí và bài viết phổ thông, theo dõi bài nói dài và trình bày quan điểm có lập luận về các chủ đề xã hội.",
      en: "read news and general articles, follow extended talks and present reasoned views on social topics.",
    },
  },
  {
    level: 6,
    slug: "hsk-6-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 6",
    topic: {
      vi: "Diễn đạt trôi chảy, có tổ chức về nhiều chủ đề",
      en: "Fluent, well-organised expression on many topics",
    },
    outcome: {
      vi: "hiểu hầu hết tài liệu đọc và nghe thông thường, diễn đạt trôi chảy và mạch lạc về nhiều chủ đề, kể cả chủ đề trừu tượng.",
      en: "understand most everyday reading and listening material and express yourself fluently and coherently, including on abstract topics.",
    },
  },
  {
    level: 7,
    slug: "hsk-7-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 7",
    topic: {
      vi: "Tiếng Trung học thuật và chuyên môn",
      en: "Academic and professional Chinese",
    },
    outcome: {
      vi: "hiểu văn bản chuyên sâu và bài nói phức tạp, phân tích và tranh luận trong môi trường học tập và công việc.",
      en: "understand in-depth texts and complex speech, and analyse and argue a case in study and work settings.",
    },
  },
  {
    level: 8,
    slug: "hsk-8-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 8",
    topic: {
      vi: "Văn bản học thuật, văn học và chuyên ngành",
      en: "Academic, literary and specialist texts",
    },
    outcome: {
      vi: "đọc hiểu văn bản học thuật, văn học và chuyên ngành, viết bài luận mạch lạc, tinh tế.",
      en: "read academic, literary and specialist texts and write coherent, refined essays.",
    },
  },
  {
    level: 9,
    slug: "hsk-9-goc",
    title: "Tiếng Trung chuẩn HSK 3.0 — Cấp 9",
    topic: {
      vi: "Sắc thái, thành ngữ và văn phong ở mức thành thạo",
      en: "Nuance, idiom and register at a near-native level",
    },
    outcome: {
      vi: "hiểu và diễn đạt chính xác sắc thái, thành ngữ và các văn phong khác nhau, ở mức gần với người bản ngữ có học vấn.",
      en: "understand and convey nuance, idiom and different registers accurately, close to an educated native speaker.",
    },
  },
];

export const HSK_COPY: Record<HskLang, SpaceCopy> = {
  vi: {
    metaTitle: "Tiếng Trung HSK 3.0: chín cấp học trực tuyến",
    metaDescription:
      "Chín cấp tiếng Trung theo chuẩn HSK 3.0 trên Limio: hội thoại có giọng đọc, từ vựng, ngữ pháp và bài tập có phản hồi cho từng người học, từ cấp 1 đến cấp 9.",
    eyebrow: "HSK 3.0 × LIMIO",
    heroLead: "Tiếng Trung từ cấp 1 đến cấp 9,",
    heroAccent: "học từng bước chắc",
    intro:
      "Chín cấp tiếng Trung theo chuẩn HSK 3.0, xây thành một lộ trình liền mạch trên Limio: hội thoại có giọng đọc, từ vựng, ngữ pháp và bài tập có phản hồi riêng cho từng người học. Học trọn một cấp rồi đi tiếp lên cấp sau.",
    browse: "Xem chín cấp",
    aboutProject: "Về HSK",
    statsOpen: "{n} cấp đang mở",
    coursesTitle: "Chín cấp HSK 3.0",
    coursesSub:
      "Ba chặng: sơ cấp (1–3), trung cấp (4–6) và cao cấp (7–9). Cấp nào đã ra mắt thì học được ngay; cấp chưa ra mắt hiện “Sắp ra mắt” và sẽ tự mở khi hoàn thành.",
    openNow: "Đang mở",
    comingSoon: "Sắp ra mắt",
    viewCourse: "Vào học",
    youWillBeAbleTo: "Bạn sẽ có thể",
    principlesTitle: "Học ở đây thế nào",
    principles: [
      {
        word: "Liền mạch",
        t: "Một lộ trình, chín cấp",
        d: "Mỗi cấp nối tiếp cấp trước: từ vựng, ngữ pháp và nhân vật đồng hành cùng bạn suốt lộ trình.",
      },
      {
        word: "Thật",
        t: "Học để dùng được",
        d: "Hội thoại theo tình huống, nghe giọng đọc, bài tập có chấm điểm — bạn thấy ngay mình đã nghe, nói, đọc được gì.",
      },
      {
        word: "Của bạn",
        t: "Phản hồi theo từng người",
        d: "Hệ thống theo dõi bạn yếu ở đâu và gợi ý ôn đúng chỗ đó thay vì bắt học lại từ đầu.",
      },
    ],
    stepsTitle: "Bắt đầu trong ba bước",
    steps: [
      { t: "Tạo tài khoản", d: "Đăng ký trên Limio bằng email của bạn." },
      { t: "Ghi danh vào một cấp", d: "Chọn cấp đang mở, thường bắt đầu từ cấp 1." },
      { t: "Học và đi tiếp", d: "Hoàn thành từng chủ đề, rồi lên cấp kế tiếp." },
    ],
    register: "Tạo tài khoản",
    registerIntro: "Một tài khoản cho mọi cấp HSK trên Limio.",
    footnote: "Học liệu HSK do Limio xây dựng theo khung HSK 3.0.",
    poweredBy: "Các khoá học được vận hành trên nền tảng học tập Limio.",
    switchTo: "English",
    switchLabel: "View in English",
    breadcrumbHome: "Trang chủ",
  },
  en: {
    metaTitle: "HSK 3.0 Chinese: nine levels online",
    metaDescription:
      "Nine levels of Chinese aligned with HSK 3.0 on Limio: dialogues with audio, vocabulary, grammar and practice with feedback for each learner, from level 1 to level 9.",
    eyebrow: "HSK 3.0 × LIMIO",
    heroLead: "Chinese from level 1 to level 9,",
    heroAccent: "one solid step at a time",
    intro:
      "Nine levels of Chinese aligned with HSK 3.0, built as one continuous path on Limio: dialogues with audio, vocabulary, grammar and practice with feedback for each learner. Finish a level, then move on to the next.",
    browse: "See the nine levels",
    aboutProject: "About HSK",
    statsOpen: "{n} levels open",
    coursesTitle: "The nine HSK 3.0 levels",
    coursesSub:
      "Three stages: elementary (1–3), intermediate (4–6) and advanced (7–9). A level that has launched opens right away; one that has not shows “Coming soon” and opens automatically when it is ready.",
    openNow: "Open now",
    comingSoon: "Coming soon",
    viewCourse: "Start learning",
    youWillBeAbleTo: "You will be able to",
    principlesTitle: "How it works",
    principles: [
      {
        word: "Continuous",
        t: "One path, nine levels",
        d: "Each level builds on the one before: vocabulary, grammar and the characters you follow stay with you along the whole path.",
      },
      {
        word: "Real",
        t: "Learn to actually use it",
        d: "Situation-based dialogues, listening to recordings and graded practice — you see right away what you can hear, say and read.",
      },
      {
        word: "Yours",
        t: "Feedback for each learner",
        d: "The system tracks where you are weak and points you to review exactly that, instead of starting over.",
      },
    ],
    stepsTitle: "Start in three steps",
    steps: [
      { t: "Create an account", d: "Sign up on Limio with your email." },
      { t: "Enrol in a level", d: "Pick a level that is open now, usually level 1 to begin." },
      { t: "Learn and move on", d: "Complete the topics one by one, then go up a level." },
    ],
    register: "Create an account",
    registerIntro: "One account for every HSK level on Limio.",
    footnote: "HSK materials are built by Limio following the HSK 3.0 framework.",
    poweredBy: "Courses are delivered on the Limio learning platform.",
    switchTo: "Tiếng Việt",
    switchLabel: "Xem bằng tiếng Việt",
    breadcrumbHome: "Home",
  },
};

/** Chữ riêng của giao diện trang /hsk (menu, nút), tách khỏi SpaceCopy vì chỉ trang này dùng. */
export const HSK_UI: Record<
  HskLang,
  { level: string; ctaOpen: string }
> = {
  vi: {
    level: "HSK",
    ctaOpen: "Vào học HSK 1",
  },
  en: {
    level: "HSK",
    ctaOpen: "Start HSK 1",
  },
};

/** Số Hán của từng cấp, dùng làm hình trang trí trên thẻ và hero. */
export const HSK_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
export const HSK_PINYIN = ["yī", "èr", "sān", "sì", "wǔ", "liù", "qī", "bā", "jiǔ"] as const;

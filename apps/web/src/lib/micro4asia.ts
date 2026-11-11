/**
 * Trang dự án MICRO4ASIA (/micro4asia): sáu vi tín chỉ do Trường Công nghệ (NEU) xây dựng.
 *
 * Danh sách sáu vi tín chỉ lấy từ báo cáo ngày 30/09/2026 (Phụ lục I). Mỗi mục gắn với một
 * `slug` khoá học trên Limio: có khoá published với slug đó thì thẻ hiện "Mở học", chưa có
 * thì hiện "Sắp ra mắt" — không phải sửa code khi khoá mới được tạo, chỉ cần dùng đúng slug.
 *
 * Cố ý KHÔNG đưa vào đây: kinh phí, khoa phụ trách, tiến độ — là nội dung báo cáo nội bộ đang
 * chờ duyệt, không phải thông tin công khai.
 */

export type M4aLang = "en" | "vi";

export function resolveM4aLang(raw: string | string[] | undefined): M4aLang {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "vi" ? "vi" : "en";
}

export type M4aIcon = "math" | "code" | "clean" | "chart" | "ml" | "prompt";

export interface M4aCourse {
  /** Slug khoá học trên Limio — khoá nào published với slug này thì được mở. */
  slug: string;
  icon: M4aIcon;
  /** Tên dùng khi khoá chưa có trên Limio; khoá đã có thì dùng tên thật trong DB. */
  title: string;
  /** "Người học có thể …" — chuẩn đầu ra, bám Phụ lục I của báo cáo. */
  outcome: Record<M4aLang, string>;
  topic: Record<M4aLang, string>;
}

// Thứ tự theo báo cáo.
export const M4A_COURSES: M4aCourse[] = [
  {
    slug: "mathematical-foundations-for-data-science",
    icon: "math",
    title: "Mathematical Foundations for Data Science",
    topic: {
      en: "Linear algebra, calculus, probability and statistics",
      vi: "Đại số tuyến tính, giải tích, xác suất và thống kê",
    },
    outcome: {
      en: "use essential mathematical tools to understand the structure of data, quantify uncertainty and support analytical reasoning in business settings.",
      vi: "dùng các công cụ toán học thiết yếu để hiểu cấu trúc dữ liệu, định lượng bất định và hỗ trợ lập luận phân tích trong môi trường kinh doanh.",
    },
  },
  {
    slug: "programming-for-data-science",
    icon: "code",
    title: "Python Programming for Data Science",
    topic: {
      en: "Core Python, NumPy and Pandas",
      vi: "Python cốt lõi, NumPy và Pandas",
    },
    outcome: {
      en: "write and adapt simple Python programs to process and manage data for economic and business analysis.",
      vi: "viết và điều chỉnh các chương trình Python đơn giản để xử lý và quản lý dữ liệu phục vụ phân tích kinh tế và kinh doanh.",
    },
  },
  {
    slug: "data-cleaning-and-preprocessing-with-python",
    icon: "clean",
    title: "Data Cleaning and Preprocessing with Python",
    topic: {
      en: "Exploring, cleaning and preparing data",
      vi: "Khám phá, làm sạch và tiền xử lý dữ liệu",
    },
    outcome: {
      en: "carry out exploratory data analysis and apply basic statistical methods to support reporting and problem solving in organisations.",
      vi: "thực hiện phân tích dữ liệu khám phá và áp dụng các phương pháp thống kê cơ bản phục vụ báo cáo và giải quyết vấn đề trong tổ chức.",
    },
  },
  {
    slug: "data-visualization-for-business-insights",
    icon: "chart",
    title: "Data Visualization for Business Insights",
    topic: {
      en: "Charts and dashboards for decisions",
      vi: "Biểu đồ và dashboard hỗ trợ ra quyết định",
    },
    outcome: {
      en: "design charts and dashboards that turn data into information that supports decision making.",
      vi: "thiết kế biểu đồ và dashboard để chuyển hoá dữ liệu thành thông tin hỗ trợ ra quyết định.",
    },
  },
  {
    slug: "fundamental-of-machine-learning",
    icon: "ml",
    title: "Fundamentals of Machine Learning",
    topic: {
      en: "Prediction and classification models",
      vi: "Mô hình dự báo và phân loại",
    },
    outcome: {
      en: "build and interpret simple prediction and classification models to support planning and data-driven decisions.",
      vi: "xây dựng và diễn giải các mô hình dự báo, phân loại đơn giản để hỗ trợ lập kế hoạch và ra quyết định dựa trên dữ liệu.",
    },
  },
  {
    slug: "prompt-engineering",
    icon: "prompt",
    title: "Prompt Engineering",
    topic: {
      en: "Generative AI as an analysis tool",
      vi: "AI tạo sinh như một công cụ phân tích",
    },
    outcome: {
      en: "design effective prompts that improve analysis workflows and support decision making.",
      vi: "thiết kế prompt hiệu quả để nâng cao quy trình phân tích và hỗ trợ ra quyết định.",
    },
  },
];

export const M4A_SITE_URL = "https://www.micro4asia.eu/";

export interface M4aCopy {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  heroLead: string; // phần đầu của H1 (không gradient)
  heroAccent: string; // phần có gradient
  intro: string;
  browse: string;
  aboutProject: string;
  statsCredentials: string;
  statsSessions: string;
  statsLanguage: string;
  statsOpen: (n: number) => string;
  coursesTitle: string;
  coursesSub: string;
  openNow: string;
  comingSoon: string;
  viewCourse: string;
  youWillBeAbleTo: string;
  principlesTitle: string;
  principles: Array<{ word: string; t: string; d: string }>;
  stepsTitle: string;
  steps: Array<{ t: string; d: string }>;
  register: string;
  footnote: string;
  poweredBy: string;
  switchTo: string;
  switchLabel: string;
  breadcrumbHome: string;
}

export const M4A_COPY: Record<M4aLang, M4aCopy> = {
  en: {
    metaTitle: "MICRO4ASIA micro-credentials",
    metaDescription:
      "Six short online courses in data and AI skills from the School of Technology, National Economics University, delivered through the MICRO4ASIA project, each ending in a verifiable certificate.",
    eyebrow: "MICRO4ASIA × Limio",
    heroLead: "Six micro-credentials for",
    heroAccent: "data and AI skills",
    intro:
      "Short, focused online courses in English from the School of Technology, National Economics University (NEU), delivered through the MICRO4ASIA project. Learn one skill at a time, show it in an assessment, and earn a certificate anyone can verify.",
    browse: "See the six courses",
    aboutProject: "About MICRO4ASIA",
    statsCredentials: "micro-credentials",
    statsSessions: "sessions each",
    statsLanguage: "taught in English",
    statsOpen: (n) => `${n} open now`,
    coursesTitle: "The six micro-credentials",
    coursesSub: "Together they run from the mathematics behind data to working with generative AI.",
    openNow: "Open now",
    comingSoon: "Coming soon",
    viewCourse: "View course",
    youWillBeAbleTo: "You will be able to",
    principlesTitle: "How a micro-credential works",
    principles: [
      {
        word: "Small",
        t: "One course, one skill",
        d: "Learn exactly what you need without committing to a long programme.",
      },
      {
        word: "Real",
        t: "Assessed, not just watched",
        d: "Quizzes, exams and practice tasks show what you can actually do.",
      },
      {
        word: "Portable",
        t: "A certificate anyone can check",
        d: "Each certificate has its own code and a public page for verification.",
      },
    ],
    stepsTitle: "Start in three steps",
    steps: [
      { t: "Create an account", d: "Sign up on Limio with your email." },
      { t: "Enrol in a course", d: "Pick any course that is open now." },
      { t: "Finish and get certified", d: "Complete the course to receive your certificate." },
    ],
    register: "Create an account",
    footnote:
      "MICRO4ASIA is co-funded by the European Union. This page is hosted on Limio by the School of Technology, NEU. The official project website is micro4asia.eu.",
    poweredBy: "Courses are delivered on the Limio learning platform.",
    switchTo: "Tiếng Việt",
    switchLabel: "Xem bằng tiếng Việt",
    breadcrumbHome: "Home",
  },
  vi: {
    metaTitle: "Vi tín chỉ MICRO4ASIA",
    metaDescription:
      "Sáu khoá học trực tuyến ngắn về kỹ năng dữ liệu và AI của Trường Công nghệ, Đại học Kinh tế Quốc dân, thuộc dự án MICRO4ASIA; mỗi khoá kết thúc bằng một chứng nhận kiểm chứng được.",
    eyebrow: "MICRO4ASIA × Limio",
    heroLead: "Sáu vi tín chỉ về",
    heroAccent: "kỹ năng dữ liệu và AI",
    intro:
      "Các khoá học trực tuyến ngắn, giảng bằng tiếng Anh, của Trường Công nghệ, Đại học Kinh tế Quốc dân (NEU), thuộc dự án MICRO4ASIA. Học từng kỹ năng một, chứng minh bằng bài đánh giá, và nhận chứng nhận mà ai cũng kiểm chứng được.",
    browse: "Xem sáu khoá học",
    aboutProject: "Về dự án MICRO4ASIA",
    statsCredentials: "vi tín chỉ",
    statsSessions: "buổi học mỗi khoá",
    statsLanguage: "giảng bằng tiếng Anh",
    statsOpen: (n) => `${n} khoá đang mở`,
    coursesTitle: "Sáu vi tín chỉ",
    coursesSub: "Từ nền tảng toán học của dữ liệu đến làm việc với AI tạo sinh.",
    openNow: "Đang mở",
    comingSoon: "Sắp ra mắt",
    viewCourse: "Xem khoá học",
    youWillBeAbleTo: "Bạn sẽ có thể",
    principlesTitle: "Vi tín chỉ hoạt động thế nào",
    principles: [
      {
        word: "Nhỏ",
        t: "Một khoá, một kỹ năng",
        d: "Học đúng điều cần, không phải cam kết cả một chương trình dài.",
      },
      {
        word: "Thật",
        t: "Có đánh giá, không chỉ “đã xem”",
        d: "Bài kiểm tra, bài thi và bài thực hành cho thấy bạn thật sự làm được gì.",
      },
      {
        word: "Mang theo được",
        t: "Chứng nhận ai cũng kiểm tra được",
        d: "Mỗi chứng nhận có mã riêng và một trang công khai để kiểm chứng.",
      },
    ],
    stepsTitle: "Bắt đầu trong ba bước",
    steps: [
      { t: "Tạo tài khoản", d: "Đăng ký trên Limio bằng email của bạn." },
      { t: "Ghi danh vào khoá", d: "Chọn một khoá đang mở." },
      { t: "Hoàn thành và nhận chứng nhận", d: "Học xong khoá để nhận chứng nhận." },
    ],
    register: "Tạo tài khoản",
    footnote:
      "MICRO4ASIA được đồng tài trợ bởi Liên minh châu Âu. Trang này do Trường Công nghệ, NEU đăng tải trên Limio. Website chính thức của dự án là micro4asia.eu.",
    poweredBy: "Các khoá học được vận hành trên nền tảng học tập Limio.",
    switchTo: "English",
    switchLabel: "View in English",
    breadcrumbHome: "Trang chủ",
  },
};

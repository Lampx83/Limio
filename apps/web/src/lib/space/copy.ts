import type { SpaceCopy, SpaceLang } from "./types";

/** Chữ mặc định cho một space mới — chỉ cần tên; người quản trị ghi đè từng dòng khi muốn. */
export function defaultSpaceCopy(lang: SpaceLang, name: string, org: string): SpaceCopy {
  if (lang === "vi") {
    return {
      metaTitle: name,
      metaDescription: `Các khoá học trực tuyến của ${org} trên Limio, mỗi khoá kết thúc bằng một chứng nhận kiểm chứng được.`,
      eyebrow: `${name} × Limio`,
      heroLead: "Học từng kỹ năng,",
      heroAccent: "nhận chứng nhận thật",
      intro: `Các khoá học trực tuyến ngắn, tập trung của ${org}. Học từng kỹ năng một, chứng minh bằng bài đánh giá, và nhận chứng nhận mà ai cũng kiểm chứng được.`,
      browse: "Xem các khoá học",
      aboutProject: `Về ${name}`,
      statsOpen: "{n} khoá đang mở",
      coursesTitle: "Các khoá học",
      coursesSub: "",
      openNow: "Đang mở",
      comingSoon: "Sắp ra mắt",
      viewCourse: "Xem khoá học",
      youWillBeAbleTo: "Bạn sẽ có thể",
      principlesTitle: "Học ở đây thế nào",
      principles: [
        { word: "Nhỏ", t: "Một khoá, một kỹ năng", d: "Học đúng điều cần, không phải cam kết cả một chương trình dài." },
        { word: "Thật", t: "Có đánh giá, không chỉ “đã xem”", d: "Bài kiểm tra và bài thực hành cho thấy bạn thật sự làm được gì." },
        { word: "Mang theo được", t: "Chứng nhận ai cũng kiểm tra được", d: "Mỗi chứng nhận có mã riêng và một trang công khai để kiểm chứng." },
      ],
      stepsTitle: "Bắt đầu trong ba bước",
      steps: [
        { t: "Tạo tài khoản", d: "Đăng ký trên Limio bằng email của bạn." },
        { t: "Ghi danh vào khoá", d: "Chọn một khoá đang mở." },
        { t: "Hoàn thành và nhận chứng nhận", d: "Học xong khoá để nhận chứng nhận." },
      ],
      register: "Tạo tài khoản",
      registerIntro: `Một tài khoản cho mọi khoá học của ${name} trên Limio.`,
      footnote: `Trang này do ${org} đăng tải trên Limio.`,
      poweredBy: "Các khoá học được vận hành trên nền tảng học tập Limio.",
      switchTo: "English",
      switchLabel: "View in English",
      breadcrumbHome: "Trang chủ",
    };
  }
  return {
    metaTitle: name,
    metaDescription: `Online courses from ${org} on Limio, each ending in a verifiable certificate.`,
    eyebrow: `${name} × Limio`,
    heroLead: "Learn one skill at a time,",
    heroAccent: "earn a real certificate",
    intro: `Short, focused online courses from ${org}. Learn one skill at a time, show it in an assessment, and earn a certificate anyone can verify.`,
    browse: "See the courses",
    aboutProject: `About ${name}`,
    statsOpen: "{n} open now",
    coursesTitle: "Courses",
    coursesSub: "",
    openNow: "Open now",
    comingSoon: "Coming soon",
    viewCourse: "View course",
    youWillBeAbleTo: "You will be able to",
    principlesTitle: "How it works",
    principles: [
      { word: "Small", t: "One course, one skill", d: "Learn exactly what you need without committing to a long programme." },
      { word: "Real", t: "Assessed, not just watched", d: "Quizzes and practice tasks show what you can actually do." },
      { word: "Portable", t: "A certificate anyone can check", d: "Each certificate has its own code and a public page for verification." },
    ],
    stepsTitle: "Start in three steps",
    steps: [
      { t: "Create an account", d: "Sign up on Limio with your email." },
      { t: "Enrol in a course", d: "Pick any course that is open now." },
      { t: "Finish and get certified", d: "Complete the course to receive your certificate." },
    ],
    register: "Create an account",
    registerIntro: `One account for all ${name} courses on Limio.`,
    footnote: `This page is hosted on Limio by ${org}.`,
    poweredBy: "Courses are delivered on the Limio learning platform.",
    switchTo: "Tiếng Việt",
    switchLabel: "Xem bằng tiếng Việt",
    breadcrumbHome: "Home",
  };
}

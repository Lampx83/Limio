// Help tour lần đầu đăng nhập — xem CLAUDE.md §6 (workflow) cho acceptance
// criteria. Trạng thái "đã xem" lưu trên User.helpTourCompletedByRole (Json,
// key = role, value = ISO timestamp), cùng kiểu với notificationsLastSeenByRole
// đã có sẵn — không cần LearningEvent vì đây là UI-seen state thuần, không
// phải hành vi học có ý nghĩa nghiệp vụ (§5 nguyên tắc 1 chỉ bắt buộc event
// cho action nghiệp vụ, không phải mọi tương tác UI).

export type HelpTourRole = "learner" | "instructor";

export type HelpTourCompletionMap = Partial<Record<HelpTourRole, string>>;

export function hasSeenHelpTour(
  map: HelpTourCompletionMap | null | undefined,
  role: HelpTourRole,
): boolean {
  return !!map?.[role];
}

export function markHelpTourSeen(
  map: HelpTourCompletionMap | null | undefined,
  role: HelpTourRole,
  at: Date = new Date(),
): HelpTourCompletionMap {
  return { ...(map ?? {}), [role]: at.toISOString() };
}

export type HelpTourStep = {
  id: string;
  title: string;
  body: string;
  // data-tour attribute của phần tử cần highlight. Không có = modal căn giữa.
  target?: string;
  placement?: "top" | "bottom" | "left" | "right";
  // Ghi đè nhãn 2 nút — dùng cho bước hỏi ý đầu tiên ("Có/Không") thay vì
  // nhãn mặc định "Bắt đầu"/"Bỏ qua" của HelpTour.tsx.
  skipLabel?: string;
  nextLabel?: string;
  // Sidebar 2 tầng (rail + cột module, vd InstructorLeftMenu) — id module cần
  // tự mở cột item ra khi vào bước này, để người dùng thấy tính năng con bên
  // trong chứ không chỉ thấy icon rail được khoanh. "home" (hoặc bỏ trống) =
  // thu cột lại. Không áp dụng cho sidebar phẳng (StudentLeftMenu).
  revealModuleId?: string;
  // data-tour của phần tử khác cần gộp CHUNG 1 khối spotlight với `target`
  // (vd cột module vừa mở ra bởi revealModuleId) — khoanh sáng liền icon +
  // cột tính năng thay vì chỉ mỗi icon nhỏ.
  unionTarget?: string;
};

export const LEARNER_TOUR_STEPS: HelpTourStep[] = [
  {
    id: "welcome",
    title: "Đây là lần đầu tiên bạn sử dụng Limio?",
    body: "Nếu đây là lần đầu tiên bạn sử dụng Limio, bạn có muốn xem tour hướng dẫn nhanh về các tính năng chính của Limio không?",
    skipLabel: "Không, để sau",
    nextLabel: "Có, xem hướng dẫn",
  },
  {
    id: "about",
    title: "Limio là gì?",
    body: "Limio là nền tảng học tập tích hợp AI feedback cá nhân hoá và gamification — giúp việc học vừa hiệu quả vừa thú vị hơn. Giờ cùng xem các tính năng chính nhé.",
  },
  {
    id: "kpis",
    title: "Tiến độ học của bạn",
    body: "Bốn chỉ số này cho biết số khoá đã ghi danh, bài đã hoàn thành, chủ đề đã vững và huy hiệu đã có. Bấm vào từng ô để xem chi tiết.",
    target: "help-tour-kpis",
    placement: "bottom",
  },
  {
    id: "courses",
    title: "Khoá học của tôi",
    body: "Toàn bộ khoá bạn đã ghi danh nằm ở đây, kèm tiến độ từng khoá.",
    target: "help-tour-nav-courses",
    placement: "right",
  },
  {
    id: "notes",
    title: "Ghi chú",
    body: "Ghi chú bạn lưu lại trong lúc học được gom về một chỗ, xem lại nhanh không phải lục từng bài.",
    target: "help-tour-nav-notes",
    placement: "right",
  },
  {
    id: "skills",
    title: "Chủ đề cần ôn",
    body: "Hệ thống tự phát hiện chủ đề bạn còn yếu dựa trên bài làm, giúp bạn biết nên ôn lại phần nào trước.",
    target: "help-tour-nav-skills",
    placement: "right",
  },
  {
    id: "badges",
    title: "Huy hiệu",
    body: "Mỗi mốc học tập đều có thể mang về huy hiệu — xem bộ sưu tập của bạn tại đây.",
    target: "help-tour-nav-badges",
    placement: "right",
  },
  {
    id: "portfolio",
    title: "e-Portfolio của tôi",
    body: "Những bài đã được chấm nằm trong hồ sơ này — có thể bật công khai để chia sẻ khi cần.",
    target: "help-tour-nav-portfolio",
    placement: "right",
  },
  {
    id: "reviews",
    title: "Chấm bài bạn học",
    body: "Một số bài tập cần bạn học chấm chéo cho nhau — bài đang chờ bạn chấm nằm ở đây.",
    target: "help-tour-nav-reviews",
    placement: "right",
  },
  {
    id: "catalog",
    title: "Khám phá thêm khoá học",
    body: "Chưa có link mời từ giảng viên? Ghé catalog để tìm khoá phù hợp và ghi danh.",
    target: "help-tour-nav-catalog",
    placement: "right",
  },
  {
    id: "tournaments",
    title: "Đấu trường",
    body: "Thi đấu theo mùa với các học viên khác, hoàn thành nhiệm vụ để nhận thưởng.",
    target: "help-tour-nav-tournaments",
    placement: "right",
  },
  {
    id: "leaderboard",
    title: "Bảng xếp hạng",
    body: "Xem thứ hạng XP của bạn so với cả hệ thống. Không muốn hiện tên? Có thể ẩn khỏi bảng xếp hạng trong Cài đặt.",
    target: "help-tour-nav-leaderboard",
    placement: "right",
  },
  {
    id: "ai-tokens",
    title: "Token AI",
    body: "Hạn mức dùng AI (giải thích bài, tutor...) của bạn theo dõi tại đây.",
    target: "help-tour-nav-ai-tokens",
    placement: "right",
  },
  {
    id: "settings",
    title: "Cài đặt",
    body: "Đổi thông tin hồ sơ, quyền riêng tư bảng xếp hạng, và xem lại hướng dẫn này bất cứ lúc nào.",
    target: "help-tour-nav-settings",
    placement: "right",
  },
  {
    id: "done",
    title: "Vậy là xong!",
    body: "Bạn có thể xem lại hướng dẫn này bất cứ lúc nào từ mục Cài đặt. Chúc bạn có trải nghiệm thú vị cùng Limio!",
  },
];

export const INSTRUCTOR_TOUR_STEPS: HelpTourStep[] = [
  {
    id: "welcome",
    title: "Đây là lần đầu tiên bạn sử dụng Limio?",
    body: "Nếu đây là lần đầu tiên bạn sử dụng Limio, bạn có muốn xem tour hướng dẫn nhanh về các tính năng chính của Limio không?",
    skipLabel: "Không, để sau",
    nextLabel: "Có, xem hướng dẫn",
  },
  {
    id: "about",
    title: "Limio là gì?",
    body: "Limio là nền tảng dạy học toàn diện — từ LMS eLearning, dạy trực tiếp, đến tổ chức thi, đều có AI hỗ trợ xuyên suốt. Đặc biệt là Vấn đáp AI và chấm bài tự động bằng AI, giúp thầy cô tiết kiệm rất nhiều thời gian. Giờ cùng xem 6 module chính nhé.",
  },
  {
    id: "rail-lms",
    title: "LMS",
    body: "Khoá học, assignment và forum Q&A của bạn — nơi bạn dành phần lớn thời gian soạn bài.",
    target: "help-tour-rail-lms",
    placement: "right",
    revealModuleId: "lms",
    unionTarget: "help-tour-instructor-panel",
  },
  {
    id: "rail-limio-live",
    title: "Limio-Live",
    body: "Dạy học trực tiếp: vote, word cloud, whiteboard, gameshow... để tương tác ngay trong buổi học.",
    target: "help-tour-rail-limio-live",
    placement: "right",
    revealModuleId: "limio-live",
    unionTarget: "help-tour-instructor-panel",
  },
  {
    id: "rail-oral",
    title: "Vấn đáp AI",
    body: "Tổ chức và chấm thi vấn đáp qua hội thoại với AI, không cần giám khảo ngồi nghe trực tiếp.",
    target: "help-tour-rail-oral",
    placement: "right",
    revealModuleId: "oral",
    unionTarget: "help-tour-instructor-panel",
  },
  {
    id: "rail-exam",
    title: "Kiểm tra đánh giá",
    body: "Soạn ngân hàng câu hỏi, gom thành đề thi, rồi tổ chức đợt/ca thi — theo đúng trình tự làm việc thật.",
    target: "help-tour-rail-exam",
    placement: "right",
    revealModuleId: "exam",
    unionTarget: "help-tour-instructor-panel",
  },
  {
    id: "rail-tournament",
    title: "Đấu trường",
    body: "Tạo giải đấu, nhiệm vụ cho học viên thi đua với nhau, tăng động lực học.",
    target: "help-tour-rail-tournament",
    placement: "right",
    revealModuleId: "tournament",
    unionTarget: "help-tour-instructor-panel",
  },
  {
    id: "rail-analytics",
    title: "Phân tích và Báo cáo",
    body: "Nắm kiến thức của từng học viên và quản lý Token AI đang dùng cho lớp.",
    target: "help-tour-rail-analytics",
    placement: "right",
    revealModuleId: "analytics",
    unionTarget: "help-tour-instructor-panel",
  },
  {
    id: "done",
    title: "Vậy là xong!",
    body: "Bạn có thể xem lại hướng dẫn này bất cứ lúc nào từ mục Cài đặt. Chúc bạn có trải nghiệm thú vị cùng Limio!",
  },
];

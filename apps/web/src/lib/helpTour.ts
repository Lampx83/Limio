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
};

export const LEARNER_TOUR_STEPS: HelpTourStep[] = [
  {
    id: "welcome",
    title: "Limio chào mừng bạn 👋",
    body: "Đây là trang tổng quan học tập của bạn. Xem nhanh vài điểm chính trước khi bắt đầu nhé.",
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
    body: "Bạn có thể xem lại hướng dẫn này bất cứ lúc nào từ mục Cài đặt. Chúc bạn học vui!",
  },
];

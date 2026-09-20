// Từ ngữ và thông báo lỗi tiếng Việt cho đấu trường — dùng chung cho giảng viên và học viên
// để một khái niệm chỉ có một tên gọi, và không bao giờ hiện mã lỗi thô ra màn hình.

export const TOURNAMENT_TERMS = {
  tournament: "Đấu trường",
  mission: "Nhiệm vụ",
  missions: "Nhiệm vụ",
  publish: "Công bố",
  published: "Đã công bố",
  draft: "Nháp",
  prize: "Giải thưởng",
  team: "Đội",
  captain: "Đội trưởng",
  registration: "Đăng ký",
  judge: "Giám khảo",
  leaderboard: "Bảng xếp hạng",
  peerReview: "Chấm chéo",
  manualReview: "Giảng viên chấm",
  autoGrade: "Tự chấm bằng bài kiểm tra",
  autoCheck: "Tự kiểm tra tệp/liên kết",
} as const;

// Mã lỗi chính từ API (trường `error`).
const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Bạn cần đăng nhập để tiếp tục.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  not_found: "Không tìm thấy nội dung này. Có thể nó đã bị xoá.",
  not_registered: "Bạn chưa đăng ký đấu trường này.",
  already_registered: "Bạn đã đăng ký đấu trường này rồi.",
  registration_closed: "Đăng ký đã đóng vì đấu trường đã bắt đầu.",
  not_published: "Đấu trường chưa được công bố.",
  tournament_not_open: "Đấu trường chưa bắt đầu hoặc đã kết thúc nên không nhận bài nộp.",
  past_deadline: "Đã quá hạn nộp bài của nhiệm vụ này.",
  resubmit_blocked: "Bài của bạn đang được chấm nên không thể nộp lại lúc này.",
  speed_run_blocked: "Bài nộp quá nhanh so với thời gian làm bài tối thiểu. Hãy làm bài cẩn thận rồi nộp lại.",
  team_submission_captain_only: "Nhiệm vụ này chỉ đội trưởng được nộp bài.",
  team_solo_only: "Đấu trường này thi cá nhân, không có đội.",
  team_full: "Đội này đã đủ người.",
  team_not_found: "Không tìm thấy đội. Kiểm tra lại mã đội.",
  team_join_code_invalid: "Mã đội không đúng. Hỏi lại đội trưởng và nhập lại.",
  team_name_taken: "Tên đội này đã có người dùng. Hãy chọn tên khác.",
  team_not_captain: "Chỉ đội trưởng mới có quyền này.",
  team_locked_after_start: "Đấu trường đã bắt đầu nên không thể đổi thành viên đội nữa.",
  ended: "Đấu trường đã kết thúc.",
  tournament_not_found: "Không tìm thấy đấu trường này.",
  prereq_not_completed: "Bạn cần hoàn thành nhiệm vụ đứng trước để mở nhiệm vụ này.",
  submission_not_found: "Không tìm thấy bài nộp.",
  condition_not_met: "Bạn chưa đạt điều kiện của nhiệm vụ này.",
  mission_not_found: "Không tìm thấy nhiệm vụ này.",
  verify_mode_mismatch: "Nhiệm vụ này không nhận bài theo cách đó.",
  self_review_forbidden: "Bạn không thể chấm bài của chính mình.",
  already_reviewed: "Bạn đã chấm bài này rồi.",
  voting_not_open: "Chưa đến lúc bình chọn. Bạn bình chọn được khi giải cho xem bài của tất cả các đội.",
  cannot_vote_own_team: "Bạn không thể bình chọn cho đội của mình.",
  network_error: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
  validation_failed: "Thông tin chưa hợp lệ. Kiểm tra lại các ô đã nhập.",
};

// Chi tiết của validation_failed khi `details` là một chuỗi.
const DETAIL_MESSAGES: Record<string, string> = {
  endsAt_before_startsAt: "Thời điểm kết thúc phải sau thời điểm bắt đầu.",
  tournament_ended: "Đấu trường đã kết thúc nên không thể chỉnh sửa.",
  team_size_locked:
    "Không đổi được số người mỗi đội khi đấu trường đã công bố hoặc đã có người đăng ký.",
  no_missions: "Cần có ít nhất 1 nhiệm vụ trước khi công bố.",
  prize_distribution_missing: "Đã đặt XP thưởng nhưng chưa chia tỷ lệ theo hạng. Vào tab Giải thưởng để chia.",
  prize_sum_over_100: "Tổng tỷ lệ chia thưởng vượt quá 100%.",
  status_already_published: "Đấu trường này đã được công bố rồi.",
  only_active_or_published_tournaments_can_be_ended:
    "Chỉ kết thúc được đấu trường đang diễn ra hoặc đã công bố.",
  empty: "Tệp rỗng.",
  invalid_url: "Liên kết không hợp lệ. Chỉ nhận liên kết bắt đầu bằng http:// hoặc https://.",
  payload_too_large: "Nội dung nộp quá dài. Hãy rút gọn rồi nộp lại.",
};

const GENERIC = "Có lỗi xảy ra, thử lại sau.";

export function tournamentErrorMessage(
  body: { error?: unknown; details?: unknown } | null | undefined,
  fallback?: string,
): string {
  const code = typeof body?.error === "string" ? body.error : undefined;
  const details = body?.details;

  if (code === "validation_failed") {
    if (typeof details === "string" && DETAIL_MESSAGES[details]) return DETAIL_MESSAGES[details]!;
    return ERROR_MESSAGES.validation_failed!;
  }
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]!;
  return fallback ?? GENERIC;
}

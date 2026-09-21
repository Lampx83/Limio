/**
 * Logic thuần của trình làm bài (ExamPlayer): đồng bộ bản nháp, đồng hồ, thử lại
 * và thông báo lỗi. Tách khỏi component để kiểm thử được — đây là chỗ mất bài
 * xảy ra âm thầm, nên không thể chỉ tin vào mắt.
 */

/**
 * Những câu có trong bản nháp trên máy nhưng KHÁC (hoặc chưa có) trên server.
 * Trước đây bản nháp chỉ được đọc vào giao diện mà không đẩy lên: làm bài lúc mất
 * mạng rồi tải lại trang thì màn hình hiện đủ đáp án, còn server không có câu nào.
 */
export function diffDraftAgainstServer(
  draft: Record<string, unknown> | null | undefined,
  server: Array<{ questionId: string; answerJson: unknown }>,
): string[] {
  if (!draft) return [];
  const onServer = new Map(server.map((a) => [a.questionId, JSON.stringify(a.answerJson ?? null)]));
  const out: string[] = [];
  for (const [qid, val] of Object.entries(draft)) {
    const mine = JSON.stringify(val ?? null);
    const theirs = onServer.get(qid) ?? JSON.stringify(null);
    if (mine !== theirs) out.push(qid);
  }
  return out;
}

/** Thời gian chờ trước lần thử lại thứ `attempt` (0-based): 2s, 4s, 8s… tối đa 30s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(30_000, 2_000 * 2 ** Math.max(0, attempt));
}

const MAX_TRUSTED_RTT_MS = 3_000;

/**
 * Độ lệch đồng hồ (server − client), lấy điểm giữa của yêu cầu để bù độ trễ mạng.
 * Trả null khi RTT quá lớn hoặc dữ liệu hỏng — phép đo xấu tệ hơn không đo.
 */
export function estimateClockSkewMs(
  serverNowIso: string | undefined,
  requestStartMs: number,
  responseEndMs: number,
): number | null {
  if (!serverNowIso) return null;
  const serverMs = new Date(serverNowIso).getTime();
  if (!Number.isFinite(serverMs)) return null;
  if (responseEndMs - requestStartMs > MAX_TRUSTED_RTT_MS) return null;
  return serverMs - (requestStartMs + responseEndMs) / 2;
}

/** Giây còn lại theo giờ server (không âm). */
export function remainingSec(deadlineEpochMs: number, clientNowMs: number, skewMs: number): number {
  return Math.max(0, Math.floor((deadlineEpochMs - (clientNowMs + skewMs)) / 1000));
}

/** Câu tiếng Việt có hướng xử lý cho lỗi khi nộp bài; mã lạ kèm mã để báo giám thị. */
export function humanizeSubmitError(code: string): string {
  switch (code) {
    case "network_error":
      return "Không có kết nối mạng. Bài làm đã được lưu tạm trên máy — hãy kiểm tra mạng rồi bấm Nộp bài lại.";
    case "session_stale":
      return "Bài thi đang được mở ở thiết bị hoặc tab khác. Bấm \"Tiếp tục trên thiết bị này\" ở đầu trang rồi nộp lại.";
    case "unauthorized":
      return "Phiên làm bài đã hết hạn. Hãy đăng nhập lại hoặc vào lại bằng mã thi rồi nộp bài.";
    default:
      return `Chưa nộp được bài (mã: ${code}). Hãy thử lại; nếu vẫn lỗi, báo giám thị.`;
  }
}

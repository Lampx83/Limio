/**
 * Chuỗi giao diện phía HỌC VIÊN của phòng vấn đáp, theo ngôn ngữ của đề (Exam.language).
 *
 * Đề tiếng Anh mà khung giao diện vẫn tiếng Việt thì thí sinh nghe giám khảo nói tiếng Anh nhưng nút bấm,
 * lời nhắc, hộp cảnh báo lại tiếng Việt. Module này thuần (không import React) nên dùng được ở cả server
 * component lẫn client component.
 *
 * Chỉ có hai bộ: "vi" và "en". Đề tiếng Trung (zh) dùng giao diện tiếng Việt — học viên của đề đó là người
 * Việt học tiếng Trung; thêm bộ zh khi có nhu cầu thật.
 */
export type OralUiLang = "vi" | "en";

export function resolveOralUiLang(examLanguage: string | null | undefined): OralUiLang {
  return examLanguage === "en" ? "en" : "vi";
}

export interface OralUiText {
  // Phòng thi — chung cho bản chữ và bản giọng nói
  exitRoom: string;
  examinerAlt: string;
  previewBadge: string;
  turn: (n: number) => string;
  typicalHint: (n: number) => string;
  turnTooltip: string;
  instructions: string;
  viewInstructions: string;
  close: string;
  showExaminer: string;
  hideExaminer: string;
  showExaminerShort: string;
  hideExaminerShort: string;
  topicCard: string;
  preparing: string;
  tapToReveal: string;
  composing: string;
  listeningAndComposing: string;
  speaking: string;
  endedBanner: string;
  pinnedQuestion: string;
  send: string;
  finish: string;
  endExam: string;
  pasteBlocked: string;
  placeholderEnded: string;
  placeholderAnswer: string;
  placeholderAiSpeaking: string;
  placeholderWaiting: string;
  /** Câu hệ thống gửi thay SV khi hết giờ mà ô nhập còn trống — đi vào bản ghi buổi thi. */
  expiredAnswer: string;
  errorPrefix: (code: string) => string;
  previewNoOpenAi: string;
  errors: Record<string, string>;

  // Hộp xác nhận
  cancel: string;
  confirmEndTitle: string;
  confirmEndMessage: string;
  confirmEndLabel: string;
  confirmLeaveTitle: string;
  confirmLeaveMessage: string;
  confirmLeaveLabel: string;
  confirmLeavePreviewTitle: string;
  confirmLeavePreviewMessage: string;
  confirmLeavePreviewLabel: string;

  // Phòng giọng nói
  stopRecordingAria: string;
  startRecordingAria: string;
  listening: string;
  tapMic: string;
  switchToTyping: string;
  switchToVoice: string;

  // Trạng thái dưới avatar
  avatar: { idle: string; thinking: string; talking: string };

  // Lớp phủ giám sát
  gate: {
    exitedBody: (preview: boolean) => string;
    enterBody: (preview: boolean) => string;
    exitedButton: string;
    enterButton: string;
  };
  countdown: { aria: (min: number, sec: number) => string; toast: (min: number) => string };
  tabBlur: { title: string; body: (count: number) => string; button: string };
  multiTab: { title: string; body: string; button: string };

  // Trang "đã nộp"
  submitted: {
    backToCourseArrow: string;
    title: string;
    banner: string;
    used: (used: number, max: number) => string;
    noAttemptsLeft: string;
    retake: (remaining: number) => string;
    backToCourse: string;
  };
  /** Tên hiển thị khi đề không gắn khoá học. */
  standaloneExam: string;
}

const vi: OralUiText = {
  exitRoom: "Thoát phòng vấn đáp",
  examinerAlt: "AI giám khảo",
  previewBadge: "Bản thử · không lưu",
  turn: (n) => `Lượt ${n}`,
  typicalHint: (n) => ` · thường ~${n}`,
  turnTooltip: "Số câu chỉ là ước lượng theo thời gian — buổi vấn đáp không giới hạn số câu, hết giờ là kết thúc.",
  instructions: "Hướng dẫn",
  viewInstructions: "Xem hướng dẫn",
  close: "Đóng",
  showExaminer: "Hiện giảng viên ảo",
  hideExaminer: "Ẩn giảng viên ảo",
  showExaminerShort: "Hiện GV ảo",
  hideExaminerShort: "Ẩn GV ảo",
  topicCard: "Tình huống của bạn",
  preparing: "Đang chuẩn bị câu hỏi đầu tiên…",
  tapToReveal: "Chạm để hiện hết",
  composing: "AI giám khảo đang soạn câu hỏi…",
  listeningAndComposing: "AI giám khảo đang nghe và soạn câu hỏi…",
  speaking: "🔊 AI giám khảo đang đọc câu hỏi…",
  endedBanner: "Buổi vấn đáp đã kết thúc. Bạn đọc xong nhận xét thì bấm “Hoàn tất” để tiếp tục.",
  pinnedQuestion: "Câu hỏi: ",
  send: "Gửi",
  finish: "Hoàn tất",
  endExam: "Kết thúc buổi vấn đáp",
  pasteBlocked: "Không thể dán nội dung vào ô trả lời — hãy tự gõ câu trả lời của bạn.",
  placeholderEnded: "Buổi vấn đáp đã kết thúc.",
  placeholderAnswer: "Trả lời câu hỏi... (Enter = gửi · Shift+Enter = xuống dòng)",
  placeholderAiSpeaking: "AI đang nói — bạn có thể gõ sẵn câu trả lời…",
  placeholderWaiting: "Đợi câu hỏi từ AI giám khảo…",
  expiredAnswer: "(Đã hết giờ, không kịp trả lời.)",
  errorPrefix: (code) => `Lỗi: ${code}`,
  previewNoOpenAi:
    "Hệ thống chưa cấu hình khoá OpenAI nên AI chưa hỏi được — thêm khoá ở phần tích hợp của quản trị rồi thử lại.",
  errors: {
    openai_not_configured: "Admin chưa cấu hình OpenAI key — báo giảng viên/admin.",
    vbee_not_configured: "Admin chưa cấu hình Vbee (giọng nói) — báo giảng viên/admin, hoặc chuyển sang gõ chữ.",
    rate_limited: "Bạn thao tác quá nhanh, đợi một chút rồi thử lại.",
    openai_busy:
      "Hệ thống AI đang quá tải nên chưa phản hồi được — đợi vài giây rồi thử lại; nếu vẫn lỗi, báo giám thị/giảng viên. Đây không phải lỗi của bạn.",
    global_token_cap: "Hệ thống đã chạm trần AI hôm nay — báo giảng viên, đây không phải lỗi của bạn.",
    empty_transcript: "Không nghe rõ câu trả lời — ghi âm lại, hoặc chuyển sang gõ chữ.",
    stt_timeout: "Nhận dạng giọng nói mất quá lâu — thử lại, hoặc chuyển sang gõ chữ.",
    stt_failed: "Không nhận dạng được câu trả lời — thử lại, hoặc chuyển sang gõ chữ.",
    stt_submit_failed: "Không gửi được bản ghi âm — kiểm tra mạng rồi thử lại.",
    mic_denied: "Trình duyệt chặn quyền micro — vào cài đặt site để bật, hoặc chuyển sang gõ chữ.",
  },

  cancel: "Quay lại",
  confirmEndTitle: "Kết thúc buổi vấn đáp?",
  confirmEndMessage: "Không thể tiếp tục sau khi kết thúc.",
  confirmEndLabel: "Kết thúc ngay",
  confirmLeaveTitle: "Rời phòng vấn đáp?",
  confirmLeaveMessage: "Bài làm vẫn giữ nguyên, quay lại sau để tiếp tục.",
  confirmLeaveLabel: "Rời phòng",
  confirmLeavePreviewTitle: "Thoát bản thử?",
  confirmLeavePreviewMessage: "Hội thoại thử sẽ mất.",
  confirmLeavePreviewLabel: "Thoát bản thử",

  stopRecordingAria: "Dừng ghi âm và gửi",
  startRecordingAria: "Bắt đầu ghi âm câu trả lời",
  listening: "Đang nghe — bấm lại để dừng và gửi câu trả lời.",
  tapMic: "Bấm micro để trả lời.",
  switchToTyping: "Mic hỏng? Chuyển sang gõ chữ",
  switchToVoice: "Chuyển lại sang nói",

  avatar: { idle: "Sẵn sàng", thinking: "Đang soạn câu hỏi…", talking: "Đang hỏi…" },

  gate: {
    exitedBody: (preview) =>
      `Bài thi đang không ở chế độ toàn màn hình. Vui lòng quay lại để tiếp tục làm bài${
        preview ? "." : " — rời quá lâu sẽ được ghi vào nhật ký buổi thi."
      }`,
    enterBody: (preview) =>
      `Bài thi yêu cầu chế độ toàn màn hình. Nhấn nút bên dưới để bắt đầu. ${
        preview
          ? "Đây là bản thử — việc rời tab hay thoát toàn màn hình không bị ghi lại."
          : "Việc rời tab hoặc thoát chế độ toàn màn hình sẽ được ghi lại."
      }`,
    exitedButton: "Quay lại toàn màn hình",
    enterButton: "Vào toàn màn hình & bắt đầu",
  },
  countdown: {
    aria: (min, sec) => `Còn ${min} phút ${sec} giây`,
    toast: (min) => `Còn ${min} phút`,
  },
  tabBlur: {
    title: "Cảnh báo: Bạn đã rời tab",
    body: (count) =>
      `Hệ thống đã ghi nhận ${count} lần bạn chuyển sang tab khác trong khi làm bài. Giảng viên có thể xem lại các sự kiện này khi chấm bài.`,
    button: "Tôi đã hiểu, tiếp tục làm bài",
  },
  multiTab: {
    title: "Cảnh báo: Phát hiện tab khác",
    body: "Hệ thống phát hiện bạn đang mở bài thi này ở một tab khác trong cùng trình duyệt. Vui lòng đóng tab kia ngay. Sự việc đã được ghi lại và gửi cho giảng viên.",
    button: "Tôi đã hiểu, tiếp tục",
  },

  submitted: {
    backToCourseArrow: "← Khoá học",
    title: "Đã nộp bài vấn đáp",
    banner:
      "Buổi vấn đáp đã kết thúc. Giảng viên sẽ nghe lại và chấm điểm — kết quả sẽ được thông báo riêng, không hiện tự động ở đây.",
    used: (used, max) => `Bạn đã dùng ${used}/${max} lượt.`,
    noAttemptsLeft: " Đã hết lượt thi.",
    retake: (remaining) => `Thi lại (còn ${remaining} lượt)`,
    backToCourse: "Quay lại khoá học",
  },
  standaloneExam: "Đề độc lập",
};

const en: OralUiText = {
  exitRoom: "Leave the oral exam room",
  examinerAlt: "AI examiner",
  previewBadge: "Preview · not saved",
  turn: (n) => `Turn ${n}`,
  typicalHint: (n) => ` · usually ~${n}`,
  turnTooltip:
    "The number of questions is only an estimate based on time — there is no fixed limit; the exam ends when time runs out.",
  instructions: "Instructions",
  viewInstructions: "View instructions",
  close: "Close",
  showExaminer: "Show the AI examiner",
  hideExaminer: "Hide the AI examiner",
  showExaminerShort: "Show examiner",
  hideExaminerShort: "Hide examiner",
  topicCard: "Your scenario",
  preparing: "Preparing the first question…",
  tapToReveal: "Tap to show everything",
  composing: "The AI examiner is preparing a question…",
  listeningAndComposing: "The AI examiner is listening and preparing a question…",
  speaking: "🔊 The AI examiner is reading the question…",
  endedBanner: "The oral exam has ended. When you have read the feedback, press “Finish” to continue.",
  pinnedQuestion: "Question: ",
  send: "Send",
  finish: "Finish",
  endExam: "End the oral exam",
  pasteBlocked: "You can’t paste into the answer box — please type your answer yourself.",
  placeholderEnded: "The oral exam has ended.",
  placeholderAnswer: "Type your answer... (Enter = send · Shift+Enter = new line)",
  placeholderAiSpeaking: "The AI is speaking — you can start typing your answer…",
  placeholderWaiting: "Waiting for the examiner’s question…",
  expiredAnswer: "(Time is up; no time to answer.)",
  errorPrefix: (code) => `Error: ${code}`,
  previewNoOpenAi:
    "No OpenAI key is configured, so the AI can’t ask questions yet — add a key in the admin integrations page and try again.",
  errors: {
    openai_not_configured: "The admin has not configured an OpenAI key — tell your instructor or the admin.",
    vbee_not_configured:
      "The admin has not configured the voice service (Vbee) — tell your instructor or the admin, or switch to typing.",
    rate_limited: "You are going too fast — wait a moment and try again.",
    openai_busy:
      "The AI service is overloaded and can’t respond yet — wait a few seconds and try again; if it keeps failing, tell the proctor or instructor. This is not your fault.",
    global_token_cap: "The AI has hit today’s limit — tell your instructor. This is not your fault.",
    empty_transcript: "Your answer could not be heard clearly — record it again, or switch to typing.",
    stt_timeout: "Speech recognition took too long — try again, or switch to typing.",
    stt_failed: "Your answer could not be recognised — try again, or switch to typing.",
    stt_submit_failed: "The recording could not be sent — check your connection and try again.",
    mic_denied: "The browser blocked microphone access — enable it in the site settings, or switch to typing.",
  },

  cancel: "Go back",
  confirmEndTitle: "End the oral exam?",
  confirmEndMessage: "You can’t continue after ending.",
  confirmEndLabel: "End now",
  confirmLeaveTitle: "Leave the oral exam room?",
  confirmLeaveMessage: "Your attempt is kept as it is — come back later to continue.",
  confirmLeaveLabel: "Leave room",
  confirmLeavePreviewTitle: "Leave the preview?",
  confirmLeavePreviewMessage: "The preview conversation will be lost.",
  confirmLeavePreviewLabel: "Leave preview",

  stopRecordingAria: "Stop recording and send",
  startRecordingAria: "Start recording your answer",
  listening: "Listening — press again to stop and send your answer.",
  tapMic: "Press the microphone to answer.",
  switchToTyping: "Microphone not working? Switch to typing",
  switchToVoice: "Switch back to speaking",

  avatar: { idle: "Ready", thinking: "Preparing a question…", talking: "Asking…" },

  gate: {
    exitedBody: (preview) =>
      `The exam is no longer in fullscreen mode. Please return to continue${
        preview ? "." : " — leaving for too long will be recorded in the exam log."
      }`,
    enterBody: (preview) =>
      `This exam requires fullscreen mode. Press the button below to begin. ${
        preview
          ? "This is a preview — leaving the tab or fullscreen is not recorded."
          : "Leaving the tab or exiting fullscreen will be recorded."
      }`,
    exitedButton: "Return to fullscreen",
    enterButton: "Enter fullscreen & start",
  },
  countdown: {
    aria: (min, sec) => `${min} minutes ${sec} seconds left`,
    toast: (min) => `${min} ${min === 1 ? "minute" : "minutes"} left`,
  },
  tabBlur: {
    title: "Warning: you left the tab",
    body: (count) =>
      `The system has recorded ${count} time${count === 1 ? "" : "s"} you switched to another tab during the exam. Your instructor can review these events when grading.`,
    button: "I understand, continue",
  },
  multiTab: {
    title: "Warning: another tab detected",
    body: "The system detected that you have this exam open in another tab of the same browser. Please close the other tab now. This has been recorded and sent to your instructor.",
    button: "I understand, continue",
  },

  submitted: {
    backToCourseArrow: "← Course",
    title: "Oral exam submitted",
    banner:
      "The oral exam has ended. Your instructor will review the session and grade it — you will be told the result separately; it does not appear here automatically.",
    used: (used, max) => `You have used ${used}/${max} attempts.`,
    noAttemptsLeft: " No attempts left.",
    retake: (remaining) => `Retake (${remaining} ${remaining === 1 ? "attempt" : "attempts"} left)`,
    backToCourse: "Back to course",
  },
  standaloneExam: "Standalone exam",
};

const TEXT: Record<OralUiLang, OralUiText> = { vi, en };

export function oralUiText(lang: OralUiLang): OralUiText {
  return TEXT[lang];
}

// Kho hướng dẫn cho trợ lý Limio ("làm sao để...?"). Module thuần: các mục hướng dẫn ngắn theo tính năng và hàm chọn
// vài mục liên quan tới câu hỏi để đưa vào prompt (không gửi cả kho mỗi lượt).
//
// NGUỒN: docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md, đã đối chiếu với mã nguồn. Đổi giao diện thì sửa tệp đó trước rồi
// sửa mục tương ứng ở đây. Quy ước viết: thầy/cô, câu đủ chủ ngữ và vị ngữ, tên nút ghi đúng như trên màn hình (kể cả
// khi còn tiếng Anh như "Publish") để giảng viên tìm được. Chỉ viết điều đã kiểm chứng; chỗ chưa chắc thì để trống,
// trợ lý sẽ dặn giảng viên mở trang và làm theo hướng dẫn trên màn hình.

export interface GuideEntry {
  id: string;
  title: string;
  /** Từ khoá (không dấu hoặc có dấu đều được so khớp sau khi bỏ dấu) giúp chọn mục khi giảng viên hỏi. */
  keywords: string[];
  /** Mã điểm đến trong danh mục để trợ lý gắn nút "Mở ngay". */
  destinationIds: string[];
  body: string;
}

export const GUIDES: readonly GuideEntry[] = [
  {
    id: "tao-khoa-hoc",
    title: "Tạo khoá học",
    keywords: ["tạo khoá", "khoá học mới", "soạn khoá", "elearning", "e-learning", "xuất bản", "publish", "công khai", "khoá nháp"],
    destinationIds: ["new_course", "my_courses"],
    body: `Vào "Khoá học của tôi" rồi bấm "+ Tạo khóa học" (giảng viên chưa có khoá thì bấm "+ Tạo khoá đầu tiên" ở trang chủ). Biểu mẫu có Tiêu đề và Mô tả bắt buộc, cùng Level, Ngôn ngữ, Category, ô "Bật cá nhân hoá học tập" và nhóm "Ai vào được khoá này" (mở cho mọi người tự đăng ký, hoặc chỉ vào bằng link mời lớp). Bấm "Tạo và tiếp tục", hệ thống dựng sẵn 3 chương, mỗi chương 3 bài học tên "Module 1..3" và "Bài học 1..3" rồi mở tab Nội dung; thầy/cô nhớ đổi tên hoặc xoá các bài mẫu này vì hệ thống không kiểm tra khoá rỗng khi xuất bản. Khoá là bản nháp cho tới khi bấm nút "Publish" ở đầu trang; trước đó học viên không thấy. Muốn khoá xem được không cần đăng nhập thì bật ô "Công khai" trong biểu mẫu "Sửa" ở tab Tổng quan, và ô này chỉ có tác dụng sau khi đã xuất bản. Giá khoá để trống nghĩa là miễn phí.`,
  },
  {
    id: "noi-dung-khoa",
    title: "Chương, bài học và nội dung trong khoá",
    keywords: ["chương", "module", "bài học", "lesson", "nội dung", "video", "pdf", "word", "docx", "tài nguyên", "hoạt động", "thêm bài"],
    destinationIds: ["my_courses"],
    body: `Trong khoá, vào tab "Nội dung". Thêm chương bằng ô nhập tên rồi bấm "Tạo"; mỗi chương có nút "+ Thêm lesson" để thêm bài học. Chương không kéo thả được, muốn đổi thứ tự thì sửa số ở ô "Order" của chương. Mở một bài học rồi bấm "+ Thêm hoạt động/tài nguyên" để chọn khối nội dung: "Văn bản — AI hỗ trợ" (dán chữ rồi bấm "Định dạng bằng AI", hoặc tải file .docx lên), Video (liên kết YouTube, Vimeo... hoặc tải tệp tối đa 500 MB), PDF, File đính kèm, Link ngoài, "Ghi chú giảng viên" (chỉ giảng viên thấy), và các hoạt động Quiz, Assignment, SCORM, H5P, LTI. Các khối trong bài kéo thả để đổi thứ tự. Menu "⋮" của bài có "Hiện bài này", "Khoá nội dung", "Cho xem thử", Nhân bản, Chuyển lên xuống và Xóa bài học. Limio chưa có chức năng nhập bài từ Markdown; chỉ có khối Markdown gõ tay và nhập Word.`,
  },
  {
    id: "quiz-trong-bai",
    title: "Bài kiểm tra (quiz) trong bài học",
    keywords: ["quiz", "bài kiểm tra", "câu hỏi", "trắc nghiệm", "tự luận", "excel", "nhập câu hỏi", "thời gian làm bài", "số lần làm"],
    destinationIds: ["my_courses"],
    body: `Mở bài học, bấm "+ Thêm quiz", gõ tên rồi bấm "Tạo quiz"; hệ thống tự mở trang trình soạn. Trong trình soạn, nút "Cài đặt" chỉnh Thời gian làm bài, Số lần làm, Hạn mở, Hạn đóng và "Cách tính điểm khi làm nhiều lần"; tắt công tắc thì là không giới hạn. Thêm câu hỏi bằng "Nhập thủ công", "AI import" (dán chữ, tối đa 20.000 chữ) hoặc "Excel import" (tối đa 500 câu một lần), cả hai nhập hàng loạt đều có bước xem trước và chỉ nhận trắc nghiệm, đúng/sai, sắp xếp, ghép cặp, điền khuyết. Có 9 dạng câu hỏi, gồm trắc nghiệm, đúng/sai, điền khuyết, sắp xếp, ghép cặp, đáp án dạng số, tự luận, trả lời ngắn và kéo thả. Bài kiểm tra trong bài học là hệ thống riêng với "Kiểm tra đánh giá" dùng để thi chính thức.`,
  },
  {
    id: "ngan-hang-cau-hoi",
    title: "Ngân hàng câu hỏi",
    keywords: ["ngân hàng", "câu hỏi", "kho câu hỏi", "nhập excel", "thẩm định", "ma trận"],
    destinationIds: ["question_banks"],
    body: `Vào "Kiểm tra đánh giá" rồi "Ngân hàng câu hỏi", bấm "+ Tạo ngân hàng mới", đặt "Tên ngân hàng" và chọn "Phạm vi": riêng tư (chỉ mình thầy/cô) hoặc chia sẻ với đồng giảng viên của một khoá. Trong ngân hàng, thầy/cô thêm câu hỏi bằng cách dán chữ cho AI định dạng, nhập tệp Excel (.xlsx), hoặc "+ Nhập thủ công". Bảng câu hỏi có các cột Mã câu, Chủ đề, Loại, Trạng thái, Thẩm định (Chưa thẩm định, Đã duyệt, Cần sửa) và Độ khó. Có 10 loại câu hỏi, từ trắc nghiệm một hay nhiều đáp án, đúng/sai, điền khuyết đến tự luận, sắp xếp, ghép cặp, điền số, kéo thả. Bước này có thể bỏ qua nếu thầy/cô soạn câu hỏi thẳng trong đề thi.`,
  },
  {
    id: "thiet-ke-de-thi",
    title: "Thiết kế đề thi",
    keywords: ["đề thi", "tạo đề", "thiết kế đề", "soạn đề", "ra đề", "xáo trộn", "lấy câu hỏi", "ma trận đề"],
    destinationIds: ["exams", "question_banks"],
    body: `Vào "Thiết kế đề thi" rồi bấm "+ Tạo bài thi mới" (hoặc "+ Tạo đề không gắn khoá học"). Có hai mức: Cơ bản là trình hướng dẫn 3 bước, gồm chọn nội dung cần kiểm tra, cấu hình đề (số câu, thời gian, mức tư duy) và cách phát đề (một đề chung cho cả lớp, xáo trộn cho mỗi học sinh, hoặc chia lớp làm nhiều ca thi), rồi bấm "Tạo đề". Nâng cao là biểu mẫu đầy đủ với mục đích (đề thi thật hay đề thử nghiệm), cách chấm, mức giám thị, trộn câu và trộn đáp án. Muốn lấy câu từ ngân hàng, bấm "+ Thêm câu hỏi" rồi chọn Ngân hàng câu hỏi, có 3 cách lấy: chọn nhanh theo tiêu chí, chọn thủ công, hoặc theo ma trận đề thi. Đề chia thành các "Phần" để đặt trọng số riêng. Đề phải được xuất bản thì mới đem đi tổ chức thi.`,
  },
  {
    id: "to-chuc-thi",
    title: "Tổ chức thi và link thi nhanh",
    keywords: ["tổ chức thi", "link thi", "thi nhanh", "kiểm tra trên lớp", "đợt thi", "ca thi", "phòng thi", "giám thị", "mã qr", "thi thật", "thử nghiệm câu hỏi"],
    destinationIds: ["quick_exam", "organize", "exam_history"],
    body: `Vào "Tổ chức thi", Limio hỏi thầy/cô định tổ chức kiểu gì, có 3 thẻ. Thẻ "Link thi nhanh" dành cho một buổi kiểm tra đơn giản trên lớp: chọn đề đã xuất bản, đặt thời lượng (phút), chọn mức hiện đáp án và kết quả, tuỳ chọn hẹn giờ mở hoặc đóng, rồi bấm "Mở" để nhận đường dẫn và mã QR gửi cho lớp; kết quả xem ở "Các buổi đã mở". Thẻ "Thử nghiệm câu hỏi" giống link thi nhanh nhưng mặc định không hiện đáp án. Thẻ "Kỳ thi chính thức" dùng cho thi nhiều ca: tạo "Đợt thi", trong đó có các "Ca thi" (vào bằng mã riêng từng thí sinh hoặc một mã chung) và các "Phòng thi" kèm danh sách thí sinh và giám thị. Trạng thái của đợt thi chỉ để phân loại, không tự mở hay đóng ca; muốn dừng ca đang thi thì đóng ca đó ở thẻ Ca thi. Lịch sử các buổi thi xem ở "Lịch sử thi".`,
  },
  {
    id: "bai-tap-cham-bai",
    title: "Bài tập và chấm bài",
    keywords: ["bài tập", "assignment", "chấm bài", "chấm điểm", "nhận xét", "rubric", "tiêu chí chấm", "bài nộp", "chờ chấm", "tự luận", "chấm tự luận"],
    destinationIds: ["assignments", "grade_essays"],
    body: `Thêm bài tập trong bài học bằng thẻ "Assignment" hoặc "+ Thêm assignment": nhập tiêu đề, mô tả nhiệm vụ, hạn nộp (không bắt buộc) và điểm tối đa; có nút "Gợi ý bằng AI" để chọn dạng bài làm. Để chấm, vào "Bài tập" ở menu LMS, tab "Cần chấm" gom bài chờ của mọi khoá. Bấm "Xem bài làm" để mở cửa sổ chấm, nhập Điểm và Nhận xét rồi bấm "Chấm điểm"; nhận xét này đến tay học viên. Nút "Gợi ý điểm bằng AI" chỉ điền sẵn điểm và nhận xét nháp, AI không tự lưu, thầy/cô xem lại rồi mới lưu. Khung "Rubric chấm điểm" ở trang bài nộp là một ô văn bản tự do, AI đọc đúng đoạn chữ đó khi gợi ý điểm; nó không phải bảng tiêu chí có cấu trúc. Bài tự luận trong đề thi chấm ở "Chấm tự luận", cũng có gợi ý chấm bằng AI.`,
  },
  {
    id: "han-theo-lop",
    title: "Hạn nộp và lịch theo từng lớp",
    keywords: ["hạn theo lớp", "lịch theo lớp", "hạn nộp", "gia hạn", "hạn đóng", "hạn mở"],
    destinationIds: ["assignments", "my_courses"],
    body: `Trong biểu mẫu sửa bài tập (hoặc quiz) có mục thu gọn "Hạn theo lớp" (với bài kiểm tra là "Lịch theo lớp"). Mục này hiện "Hạn chung", thầy/cô tích chọn các lớp rồi đặt hạn mở, hạn nộp hoặc hạn đóng riêng, bấm "Áp dụng cho n lớp". Muốn lớp quay về hạn chung thì bấm "Dùng hạn chung".`,
  },
  {
    id: "lop-hoc-hoc-vien",
    title: "Lớp học, link mời và học viên",
    keywords: ["lớp học", "link mời", "mời học viên", "học viên", "nhập học viên", "danh sách lớp", "csv", "ghi danh", "tạo lớp", "chuyển lớp"],
    destinationIds: ["my_courses"],
    body: `Trong khoá, vào tab "Lớp học" rồi bấm "Tạo lớp", đặt tên lớp (ví dụ "Lớp K65-CS1"). Mỗi lớp có thẻ "Link mời vào lớp" kèm mã QR và nút "Sao chép" để gửi học viên. Muốn thêm hàng loạt thì bấm "Nhập học viên" với tệp CSV có dòng đầu là name,email. Menu "…" của lớp có "Sửa lớp", "Tạo lại mã mời" (link cũ chết ngay) và "Xoá lớp" (chỉ khi lớp rỗng). Khoá đặt chế độ "Chỉ vào bằng link mời lớp" chỉ vào được bằng các link này. Tab "Học viên" cho tìm theo tên hoặc email, gán lớp, xoá khỏi khoá học và tải danh sách. Limio chưa có tính năng gửi thông báo cho cả lớp.`,
  },
  {
    id: "dien-dan",
    title: "Diễn đàn hỏi đáp",
    keywords: ["diễn đàn", "forum", "câu hỏi học viên", "trả lời", "thảo luận", "chưa giải đáp"],
    destinationIds: ["forum"],
    body: `Học viên đăng câu hỏi ở nút "Thảo luận" trong bài học. Thầy/cô vào "Diễn đàn hỏi đáp" (Forum Q&A) ở menu LMS, lọc Tất cả, Chưa giải đáp hoặc Đã xử lý, bấm "Mở thread" để đọc và trả lời. Khi có câu trả lời đúng, bấm "Đánh dấu là câu trả lời" thì chủ đề chuyển sang "Đã xử lý". Thẻ "Stale" cho biết các câu hỏi đã chờ quá lâu mà chưa có lời giải.`,
  },
  {
    id: "nam-kien-thuc",
    title: "Xem học viên đang vướng ở đâu",
    keywords: ["nắm kiến thức", "học viên yếu", "chủ đề yếu", "cá nhân hoá", "lộ trình", "quan niệm sai", "mastery", "vướng", "cần hỗ trợ", "im ắng"],
    destinationIds: ["learner_insights", "stale_learners"],
    body: `Vào "Nắm kiến thức" ở mục Phân tích và Báo cáo: có số học viên, số chủ đề, mức nắm trung bình, "Ma trận học viên × chủ đề" và "Độ phủ theo chủ đề" để thấy chủ đề nào cả lớp còn yếu. Muốn tính năng này có dữ liệu, khoá cần bật "Bật cá nhân hoá học tập"; khi đó mỗi bài học tự thành một "Chủ đề" và câu hỏi trong bài thừa hưởng chủ đề đó. Danh sách học viên cần hỗ trợ có ở trang Học viên của khoá. Học viên chỉ thấy nhãn Cần ôn, Nên luyện thêm hoặc Vững, không thấy phần trăm.`,
  },
  {
    id: "gamification",
    title: "Gamification và chứng nhận",
    keywords: ["gamification", "xp", "huy hiệu", "badge", "xếp hạng", "streak", "chứng nhận", "chứng chỉ", "điểm thưởng"],
    destinationIds: ["tournaments", "my_courses"],
    body: `Giảng viên chỉ xem, không cấu hình XP hay huy hiệu: tab "Gamification" của khoá cho thấy tổng XP, số huy hiệu đã cấp, số học viên đang có streak và phân bố level, có xuất CSV. Điểm XP do giảng viên đặt chỉ có ở "Đấu trường". Chứng nhận tự cấp khi học viên hoàn thành khoá, giảng viên không phải cài gì.`,
  },
  {
    id: "bai-giang-tuong-tac",
    title: "Soạn bài giảng tương tác (Limio-Live)",
    keywords: ["bài giảng", "slide", "trình chiếu", "powerpoint", "pptx", "limio-live", "dàn ý", "tài liệu", "bài giảng tương tác", "mô tả chủ đề"],
    destinationIds: ["live_from_document", "live_from_pptx", "live_decks"],
    body: `Có hai đường. Từ tài liệu hoặc ý tưởng: vào "Tạo bài giảng", chọn cách nhập nội dung là "Mô tả chủ đề" (nêu chủ đề, người học và điều người học làm được sau buổi học), "Dán văn bản" hoặc "Tải tệp lên"; có thể bật "Tìm thêm nguồn trên internet". AI đề xuất dàn ý, thầy/cô duyệt dàn ý rồi mới tạo slide (bước dàn ý thường mất 20 đến 90 giây). Từ PowerPoint có sẵn: vào "Tạo bài giảng từ PowerPoint", tải tệp lên, xem các slide đã đọc và chọn "Giữ ý, làm đẹp lại" hoặc "Soạn lại mạch", đặt thời lượng buổi giảng. Các bài đã soạn nằm ở "Bài giảng của tôi" để chỉnh và trình chiếu.`,
  },
  {
    id: "hoat-dong-nhanh",
    title: "Hoạt động nhanh trên lớp",
    keywords: ["bình chọn", "vote", "poll", "đám mây từ", "word cloud", "padlet", "bảng ý tưởng", "draw", "vẽ", "bảng trắng", "đếm ngược", "gọi tên", "chia nhóm", "phân nhóm", "gameshow", "sôi nổi", "tương tác lớp", "hoạt động lớp"],
    destinationIds: ["teaching_tools", "poll", "wordcloud", "board", "timer", "grouping", "gameshow"],
    body: `Mục Limio-Live trong menu có các công cụ dùng ngay khi đứng lớp. Nhóm hoạt động nhanh gồm Vote (bình chọn một câu hỏi), Word Cloud (đám mây từ khoá), Padlet (bảng ý tưởng để mỗi người ghim một ý), Draw-it (cả lớp vẽ minh hoạ) và Whiteboard (bảng trắng chung). Nhóm điều hành lớp gồm Đếm ngược, Gọi tên (chọn ngẫu nhiên một học viên), Phân nhóm và Gameshow (hỏi đáp có tính điểm để ôn tập). Mở trang rồi chọn công cụ, các công cụ này chạy ngay, thầy/cô làm theo hướng dẫn trên màn hình.`,
  },
  {
    id: "van-dap-ai",
    title: "Vấn đáp AI",
    keywords: ["vấn đáp", "oral", "hỏi đáp trực tiếp", "phòng vấn đáp", "soạn đề vấn đáp"],
    destinationIds: ["oral_exam_new", "oral_exams"],
    body: `Vào "Phòng vấn đáp" ở menu Vấn đáp AI để xem các phòng đã có. Soạn đề mới ở "Soạn đề vấn đáp"; thầy/cô có thể gắn đề với một khoá học hoặc để là đề độc lập không gắn khoá. Các bước còn lại do trang soạn đề hướng dẫn trên màn hình.`,
  },
  {
    id: "dau-truong",
    title: "Đấu trường",
    keywords: ["đấu trường", "tournament", "cuộc thi", "xếp hạng", "thi đua", "nhiệm vụ"],
    destinationIds: ["tournaments"],
    body: `"Đấu trường của tôi" dùng để tổ chức cuộc thi nhiều vòng có xếp hạng nhằm tạo động lực học. Đây cũng là nơi duy nhất giảng viên tự đặt điểm XP. Các bước tạo và cấu hình do trang đấu trường hướng dẫn trên màn hình.`,
  },
];

/** Những điều Limio CHƯA có, để trợ lý không hứa nhầm. Luôn đưa vào prompt (ngắn). */
export const ASSISTANT_LIMITS =
  "Limio chưa có: nhập bài từ Markdown; gửi thông báo cho cả lớp; kéo thả để đổi thứ tự chương (đổi bằng ô Order); bảng tiêu chí chấm có cấu trúc (rubric là một ô văn bản tự do); cài đặt XP hoặc huy hiệu cho giảng viên (chỉ có điểm XP trong Đấu trường).";

// ── Chọn mục liên quan ───────────────────────────────────────────────────────

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

/** Chữ không dấu, chỉ chữ/số, bao hai đầu bằng khoảng trắng để so khớp theo từ nguyên vẹn. */
const normalize = (s: string) => ` ${fold(s).replace(/[^a-z0-9]+/g, " ").trim()} `;

export const MAX_GUIDES_PER_TURN = 3;

/**
 * Chọn tối đa `max` mục hướng dẫn hợp nhất với câu hỏi. Điểm = số từ khoá (cụm) xuất hiện trong câu hỏi hiện tại,
 * cộng nửa điểm cho từ khoá xuất hiện ở các câu trước của giảng viên (giữ mạch hội thoại: "vậy bước tiếp theo?").
 * Không khớp mục nào thì trả mảng rỗng (câu chào, trò chuyện) — prompt không phải mang hướng dẫn.
 */
export function selectGuides(message: string, previousUserMessages: readonly string[] = [], max = MAX_GUIDES_PER_TURN): GuideEntry[] {
  const now = normalize(message);
  const before = normalize(previousUserMessages.slice(-2).join(" "));
  const scored = GUIDES.map((g) => {
    let score = 0;
    for (const k of g.keywords) {
      const key = normalize(k);
      if (now.includes(key)) score += key.trim().includes(" ") ? 2 : 1;
      else if (before.includes(key)) score += 0.5;
    }
    return { g, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((x) => x.g);
}

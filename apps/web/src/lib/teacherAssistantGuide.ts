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
    keywords: ["tạo khoá", "khoá học mới", "soạn khoá", "elearning", "e-learning", "xuất bản", "publish", "công khai", "khoá nháp", "giá khoá"],
    destinationIds: ["new_course", "my_courses"],
    body: `Vào "Khoá học của tôi" rồi bấm "+ Tạo khóa học" (giảng viên chưa có khoá thì bấm "+ Tạo khoá đầu tiên" ở trang chủ). Biểu mẫu có Tiêu đề và Mô tả bắt buộc, cùng Level, Ngôn ngữ, Category, ô "Bật cá nhân hoá học tập" và nhóm "Ai vào được khoá này" (mở cho mọi người tự đăng ký, hoặc chỉ vào bằng link mời lớp). Bấm "Tạo và tiếp tục", hệ thống dựng sẵn 3 chương, mỗi chương 3 bài học tên "Module 1..3" và "Bài học 1..3" rồi mở tab Nội dung; thầy/cô nhớ đổi tên hoặc xoá các bài mẫu này vì hệ thống không kiểm tra khoá rỗng khi xuất bản. Khoá là bản nháp cho tới khi bấm nút "Publish" ở đầu trang; trước đó học viên không thấy. Tab Tổng quan là bản tóm tắt, bấm "Sửa" để đổi giá (mặc định tiền đồng, để trống là miễn phí) và bật ô "Công khai" cho phép xem không cần đăng nhập, ô này chỉ có tác dụng sau khi đã xuất bản. Khoá có các tab Tổng quan, Nội dung, Lớp học, Học viên, Grade, Gamification.`,
  },
  {
    id: "noi-dung-khoa",
    title: "Chương, bài học và các khối nội dung",
    keywords: ["chương", "module", "bài học", "lesson", "nội dung", "video", "pdf", "tài nguyên", "hoạt động", "thêm bài", "file đính kèm", "markdown", "scorm", "h5p"],
    destinationIds: ["my_courses"],
    body: `Trong khoá, vào tab "Nội dung". Thêm chương bằng ô nhập tên rồi bấm "Tạo"; mỗi chương có nút "+ Thêm lesson". Chương không kéo thả được, muốn đổi thứ tự thì sửa số ở ô "Order" của chương. Mở một bài học rồi bấm "+ Thêm hoạt động/tài nguyên" để chọn khối: "Văn bản — AI hỗ trợ" (tạo bài từ tài liệu, xem mục riêng), Richtext editor (soạn trực tiếp), "Ghi chú giảng viên" (chỉ giảng viên thấy), Markdown gõ tay, Video (liên kết YouTube, Vimeo... hoặc tải tệp tối đa 500 MB), "Audio (bài nghe)", "Từ vựng (bảng từ)", "Hội thoại", PDF (tối đa 50 MB), "File đính kèm" (tải lên tối đa 10 MB hoặc dán link), Link ngoài, Embed, HTML tự tải lên, và các hoạt động Quiz, Assignment, SCORM, H5P, LTI. Các khối trong bài kéo thả để đổi thứ tự. Menu "⋮" của bài có "Hiện bài này", "Khoá nội dung", "Cho xem thử", Nhân bản, Chuyển lên xuống, Chuyển sang module khác và Xóa bài học. Chưa có khối nhập Markdown riêng; muốn đưa văn bản sẵn có vào bài thì dùng "Văn bản — AI hỗ trợ".`,
  },
  {
    id: "bai-hoc-tu-tai-lieu",
    title: "Tạo bài học từ tài liệu bằng AI (Văn bản — AI hỗ trợ)",
    keywords: ["văn bản ai", "ai hỗ trợ", "tạo bài từ tài liệu", "biến tài liệu", "tài liệu thành bài", "soạn bài học", "viết bài học", "dàn ý bài học", "định dạng bằng ai", "mẫu bài", "bố cục bài", "tạo bài học", "bài học từ tài liệu", "từ tài liệu", "tài liệu word", "word bằng ai", "ai viết bài"],
    destinationIds: ["my_courses"],
    body: `Trong bài học, bấm "+ Thêm hoạt động/tài nguyên" rồi chọn "Văn bản — AI hỗ trợ"; Limio mở trang "Tạo bài từ tài liệu" có ba bước Tài liệu, Dàn ý, Bài học. Bước một: kéo thả hoặc chọn tệp Word, PDF, .txt hay .md (tối đa 10 MB), hoặc dán văn bản (ít nhất 200 ký tự; PDF chụp ảnh không đọc được chữ), chọn "Mẫu bài" (Bài lý thuyết, Bài hướng dẫn thực hành, Bài ôn tập) rồi bấm "Đọc tài liệu và lập dàn ý". Bước hai: sửa dàn ý (tên bài, mục tiêu, từng mục và ý chính, kéo thả đổi thứ tự), chọn "Cách viết" là "Giữ nguyên lời" hoặc "Biên tập cho mạch lạc", tick "Tôi đã xem dàn ý" rồi bấm "Chốt dàn ý". Bước ba: bấm "Tạo bài", xem trước rồi bấm "Áp dụng vào bài học". Nếu tài liệu dài và dàn ý chia thành nhiều bài thì các bài sau thành bài mới đang ẩn, thầy/cô bật "Hiện bài này" khi muốn học viên thấy. Sau khi áp dụng, ở trình soạn có "Nhờ AI" sửa từng mục (viết ngắn hơn, dễ hiểu hơn, thêm ví dụ, sửa chính tả), "Lịch sử phiên bản" để khôi phục, và nút "Giao diện" đổi bảng màu, kiểu chữ. Mỗi lần tạo tốn lượt hỏi AI.`,
  },
  {
    id: "quiz-trong-bai",
    title: "Bài kiểm tra (quiz) trong bài học",
    keywords: ["quiz", "bài kiểm tra", "câu hỏi", "trắc nghiệm", "tự luận", "excel", "nhập câu hỏi", "thời gian làm bài", "số lần làm"],
    destinationIds: ["my_courses"],
    body: `Mở bài học, bấm "+ Thêm quiz", gõ tên rồi bấm "Tạo quiz"; hệ thống tự mở trang trình soạn. Trong trình soạn, nút "Cài đặt" chỉnh Thời gian làm bài, Số lần làm, Hạn mở, Hạn đóng và "Cách tính điểm khi làm nhiều lần"; tắt công tắc thì là không giới hạn. Thêm câu hỏi bằng "Nhập thủ công", "AI import" (dán chữ, tối đa 20.000 chữ) hoặc "Excel import" (tối đa 500 câu một lần), cả hai nhập hàng loạt đều có bước xem trước và chỉ nhận trắc nghiệm, đúng/sai, sắp xếp, ghép cặp, điền khuyết. Có 9 dạng câu hỏi, gồm trắc nghiệm, đúng/sai, điền khuyết, sắp xếp, ghép cặp, đáp án dạng số, tự luận, trả lời ngắn và kéo thả. Học viên làm quiz ở một trang riêng, đáp án được lưu ngay khi chọn nên thoát giữa chừng không mất. Bài kiểm tra trong bài học là hệ thống riêng với "Kiểm tra đánh giá" dùng để thi chính thức.`,
  },
  {
    id: "ngan-hang-cau-hoi",
    title: "Ngân hàng câu hỏi",
    keywords: ["ngân hàng", "kho câu hỏi", "nhập excel", "thẩm định", "ma trận", "ngân hàng câu hỏi"],
    destinationIds: ["question_banks"],
    body: `Vào "Kiểm tra đánh giá" rồi "Ngân hàng câu hỏi", bấm "+ Tạo ngân hàng mới", đặt "Tên ngân hàng" và chọn "Phạm vi": riêng tư (chỉ mình thầy/cô) hoặc chia sẻ với đồng giảng viên của một khoá. Trong ngân hàng, thầy/cô thêm câu hỏi bằng cách dán chữ cho AI định dạng, nhập tệp Excel (.xlsx), hoặc "+ Nhập thủ công". Bảng câu hỏi có các cột Mã câu, Chủ đề, Loại, Trạng thái, Thẩm định (Chưa thẩm định, Đã duyệt, Cần sửa) và Độ khó. Có 10 loại câu hỏi, từ trắc nghiệm một hay nhiều đáp án, đúng/sai, điền khuyết đến tự luận, sắp xếp, ghép cặp, điền số, kéo thả. Ngân hàng không có ô rubric. Bước này có thể bỏ qua nếu thầy/cô soạn câu hỏi thẳng trong đề thi.`,
  },
  {
    id: "thiet-ke-de-thi",
    title: "Thiết kế đề thi",
    keywords: ["đề thi", "tạo đề", "thiết kế đề", "soạn đề", "ra đề", "xáo trộn", "lấy câu hỏi", "ma trận đề", "thi thử", "trọng số", "xuất bản đề"],
    destinationIds: ["exams", "question_banks"],
    body: `Vào "Thiết kế đề thi" rồi bấm "+ Tạo bài thi mới" (hoặc "+ Tạo đề không gắn khoá học"). Có hai mức: Cơ bản là trình hướng dẫn 3 bước gồm chọn nội dung cần kiểm tra, cấu hình đề (số câu, thời gian, mức tư duy) và cách phát đề, rồi bấm "Tạo đề"; Nâng cao là biểu mẫu đầy đủ với mục đích, cách chấm, mức giám thị, trộn câu và trộn đáp án. Muốn lấy câu từ ngân hàng, bấm "+ Thêm câu hỏi" rồi chọn Ngân hàng câu hỏi, có 3 cách lấy: chọn nhanh theo tiêu chí, chọn thủ công, hoặc theo ma trận đề thi. Câu tự luận có ô "Rubric (tuỳ chọn)". Đề chia thành các "Phần"; ở tab Nội dung, thẻ "Trọng số điểm theo phần" cho đặt trọng số, có hiệu lực khi đề từ 2 phần và tổng đúng 100%. Nút "Publish" chỉ làm đề sẵn sàng chứ không tự mở thi; xong thì sang "Tổ chức thi". Nút "Thi thử" cho giảng viên tự làm thử mà không tạo lượt thi. Thẻ đề có nút "Xoá", bị khoá nếu đề đã có lượt thi.`,
  },
  {
    id: "to-chuc-thi",
    title: "Tổ chức thi: link thi nhanh và ca thi chính thức",
    keywords: ["tổ chức thi", "link thi", "thi nhanh", "kiểm tra trên lớp", "ca thi", "phòng thi", "giám thị", "mã qr", "thi thật", "thử nghiệm câu hỏi", "kỳ thi", "mã vào thi", "phòng chờ", "danh sách thí sinh", "thí sinh"],
    destinationIds: ["quick_exam", "organize", "exam_history"],
    body: `Vào "Tổ chức thi", trang có 3 thẻ để tạo mới. Thẻ "Link thi nhanh" dành cho một buổi kiểm tra trên lớp: chọn đề đã xuất bản, đặt thời lượng (phút), chọn mức "Hiện đáp án và kết quả", tuỳ chọn hẹn giờ mở hoặc đóng, rồi bấm "Mở" để nhận mã 6 ký tự, đường dẫn và mã QR gửi cho lớp; thí sinh vào bằng tài khoản ở trang /thi. Thẻ "Thử nghiệm câu hỏi" dùng cùng biểu mẫu. Thẻ "Kỳ thi chính thức" tạo thẳng một "Ca thi" từ đề (Limio không còn khái niệm đợt thi): chọn đề, đặt Mở lúc, Đóng lúc, "Cách vào thi" là "Theo phòng" hoặc "Tự do", rồi bấm "Tạo ca thi". Trang ca có 3 tab Tổng quan, Phòng thi, Kết quả. Ở tab Phòng thi, thầy/cô nhập "Danh sách thí sinh" của cả ca (lấy từ lớp học, dán từ Excel hoặc gõ từng em), rồi tạo phòng bằng "+ Thêm phòng thi" hoặc "Nhập từ danh sách". Chế độ Theo phòng cấp mã cá nhân 8 ký tự, thí sinh không cần đăng nhập; chế độ Tự do dùng một mã chung và thí sinh phải đăng nhập. Phòng chờ mở trước giờ thi 15 phút. Mỗi phòng có mã giám thị riêng, giám thị vào ở /giam-thi. Muốn dừng ca sớm thì sửa "Đóng lúc" trong "Chỉnh sửa" ở tab Tổng quan.`,
  },
  {
    id: "ket-qua-thi",
    title: "Lịch sử thi, kết quả và bảng điểm",
    keywords: ["lịch sử thi", "kết quả thi", "bảng điểm", "xuất điểm", "xem bài làm", "xoá ca thi", "đóng ca", "giám sát"],
    destinationIds: ["exam_history", "quick_exam", "organize"],
    body: `Các buổi và ca thi đã tạo nằm ở "Lịch sử thi", có các tab Tất cả, Link thi nhanh, Thử nghiệm câu hỏi và Kỳ thi chính thức. Mỗi thẻ có nút "Giám sát" (ca đã đóng thì thành "Xem lại"), "Kết quả", "Tải", "Quản lý ca" (chỉ ca chính thức), "Đóng ca" hoặc "Mở lại" (chỉ ca chạy thủ công) và "Xoá" (chỉ khi ca đã đóng và chưa có bài nộp, nếu không thì lưu trữ ca). Nút "Kết quả" mở trang với ba cách xem: theo thí sinh, theo câu hỏi, và chờ chấm tay; bấm "Xem bài làm" để xem và chấm tại chỗ câu tự luận, bài còn tự luận ghi là chưa gồm câu chờ chấm. Menu "Xuất file" có "Bảng điểm (Excel)" và "Dữ liệu phân tích (CSV)". Ở tab Kết quả của trang ca có "Xuất bảng điểm ca thi (Excel)", mỗi dòng một thí sinh kèm mã lớp học và mã lớp thi. Nếu đề có trọng số theo phần thì điểm phần trăm tính theo trọng số.`,
  },
  {
    id: "bai-tap-cham-bai",
    title: "Bài tập và chấm bài",
    keywords: ["bài tập", "assignment", "chấm bài", "chấm điểm", "nhận xét", "bài nộp", "chờ chấm", "chấm tự luận", "chấm nhanh", "bài tiếp", "gợi ý điểm"],
    destinationIds: ["assignments", "grade_essays"],
    body: `Thêm bài tập trong bài học bằng thẻ "Assignment" hoặc "+ Thêm assignment": nhập tiêu đề, mô tả nhiệm vụ, hạn nộp (không bắt buộc), điểm tối đa và "Cách nộp" (cá nhân hoặc theo nhóm). Để chấm, vào "Assignment" ở menu LMS, tab "Cần chấm" gom bài chờ của mọi khoá, hoặc mở trang bài nộp của một bài tập. Bấm "Xem bài làm" mở cửa sổ chấm: bên trái xem trước tệp nộp (PDF, ảnh, video, audio, Google Docs...), bên phải nhập Điểm và Nhận xét rồi bấm "Chấm điểm"; nhận xét này đến tay học viên. Nút "Chấm & bài tiếp" lưu rồi chuyển bài kế, nút "Trước" và "Sau" hoặc phím mũi tên trái phải chuyển bài. Nút "Gợi ý điểm bằng AI" chỉ điền sẵn điểm và nhận xét nháp, AI không tự lưu. AI đọc được chữ trong PDF, Word, Google Docs và bài nói, tối đa 20.000 ký tự (khoảng 7 trang); AI không chấm ảnh, video, PDF scan hay link ngoài. Bài tự luận trong đề thi chấm ở trang "Chấm bài" của đề thi, có nút "Gợi ý chấm".`,
  },
  {
    id: "bai-tap-nhom",
    title: "Bài tập nộp theo nhóm",
    keywords: ["nhóm", "nộp nhóm", "nộp theo nhóm", "bài tập nhóm", "điểm nhóm", "trưởng nhóm", "chia nhóm làm bài", "đổi tên nhóm"],
    destinationIds: ["assignments", "my_courses"],
    body: `Khi tạo hoặc sửa bài tập, ở mục "Cách nộp" chọn "Nộp theo nhóm" (đã có bài nộp thì không đổi được). Nhóm do học viên tự lập ở khối "Nhóm của tôi" trên trang khoá: tạo nhóm hoặc vào nhóm bằng mã 6 ký tự, trưởng nhóm đổi tên khi nhóm chưa khoá. Giảng viên không lập nhóm mà sắp xếp: từ tab "Lớp học" mở trang "Nhóm làm bài tập" để đặt số người tối đa mỗi nhóm, "Khoá danh sách nhóm" hoặc "Mở khoá", đổi tên nhóm, đặt trưởng nhóm, gỡ người, chuyển người sang nhóm khác và thêm người chưa có nhóm, kể cả khi đã khoá. Trang chấm bài nhóm có mỗi nhóm một dòng với cột "Điểm nhóm" và mục "Sinh viên chưa có nhóm". Trong cửa sổ chấm, thầy/cô xem "Phần việc của tôi" của từng người, chấm điểm nhóm trước rồi mới dùng "Chỉnh điểm riêng" cho từng người khi cần. Nộp lại bài sẽ đưa cả nhóm về trạng thái chưa chấm. Số bài chờ chấm ở trang chủ vẫn đếm theo từng người.`,
  },
  {
    id: "rubric",
    title: "Rubric chấm điểm (nhập rubric để AI tham khảo khi chấm)",
    keywords: ["rubric", "nhập rubric", "tiêu chí chấm", "thang điểm", "ai chấm", "gợi ý chấm", "gợi ý điểm", "chấm tự luận", "chấm vấn đáp", "chấm chéo"],
    destinationIds: ["assignments", "grade_essays", "oral_exams", "tournaments"],
    body: `Limio CÓ hỗ trợ nhập rubric, ở bốn nơi, và AI đọc rubric đó khi gợi ý điểm; gợi ý chỉ là bản nháp, AI không tự lưu, thầy/cô xem lại rồi mới chấm. Một là bài tập: mở trang bài nộp của bài tập (bấm "Xem bài nộp"), ở khung "Rubric chấm điểm (không bắt buộc)" phía trên bảng danh sách, gõ tiêu chí và điểm từng ý (ví dụ "3đ nêu đúng khái niệm. 4đ có ví dụ. 3đ trình bày rõ ràng.") rồi bấm "Lưu rubric"; trong cửa sổ chấm cũng có khối "Rubric chấm điểm" để xem và sửa; khi chấm từng bài, bấm "Gợi ý điểm bằng AI". Hai là câu tự luận trong đề thi: khi soạn câu tự luận có ô "Rubric (tuỳ chọn)"; lúc chấm, nút "Gợi ý chấm" dùng rubric này cùng nội dung câu hỏi. Ba là vấn đáp AI: ở trang chấm vấn đáp có dòng "Rubric chấm điểm" với nút "Nhập rubric" hoặc "Sửa rubric"; nhập xong bấm "Chấm lại bằng AI" ở từng lượt để lấy đề xuất mới. Bốn là Đấu trường: nhiệm vụ chấm chéo có bảng "Tiêu chí chấm" (tên tiêu chí, thang điểm, mức quan trọng) và bắt buộc phải có. Rubric ở bài tập và câu tự luận là ô văn bản tự do, không phải bảng nhiều cột và hàng.`,
  },
  {
    id: "han-theo-lop",
    title: "Hạn nộp và lịch làm bài theo từng lớp",
    keywords: ["hạn theo lớp", "lịch theo lớp", "hạn nộp", "gia hạn", "hạn đóng", "hạn mở", "mỗi lớp một hạn"],
    destinationIds: ["assignments", "my_courses"],
    body: `Trong biểu mẫu sửa bài tập có mục "Hạn nộp bài", còn ở bài kiểm tra là "Khi nào học viên được làm bài?". Chọn "Cùng một lịch cho mọi lớp" hoặc "Mỗi lớp một hạn riêng"; chọn lớp (có "Chọn tất cả lớp") rồi đặt "Mở lúc" và "Hạn nộp" hoặc "Đóng lúc", để trống nghĩa là mở ngay hoặc không có hạn. Bấm "Áp dụng cho n lớp đã chọn", rồi bấm "Lưu" của biểu mẫu, vì hạn chỉ được lưu khi lưu cả biểu mẫu.`,
  },
  {
    id: "lop-hoc-hoc-vien",
    title: "Lớp học, link mời và học viên",
    keywords: ["lớp học", "link mời", "mời học viên", "học viên", "nhập học viên", "danh sách lớp", "csv", "ghi danh", "tạo lớp", "chuyển lớp", "kỳ học"],
    destinationIds: ["my_courses"],
    body: `Trong khoá, vào tab "Lớp học" rồi bấm "Tạo lớp", đặt "Tên lớp" (ví dụ "Lớp K65-CS1"), "Kỳ học" và "Ghi chú"; muốn tạo nhiều lớp một lần thì bấm "Nhập từ Excel" (tối đa 200 lớp). Danh sách lớp là một bảng có ô "Tìm lớp học"; bấm một dòng để mở rộng và thấy "Sửa", "Tạo lại mã mời" (link cũ chết ngay), "Xoá" (chỉ khi lớp rỗng) và "Danh sách học viên". Mỗi lớp có hộp "Link mời vào lớp" kèm mã QR và nút "Sao chép" để gửi học viên. Muốn thêm hàng loạt thì bấm "Nhập học viên" với tệp CSV có dòng đầu là name,email. Khoá đặt chế độ "Chỉ vào bằng link mời lớp" chỉ vào được bằng các link này. Tab "Học viên" cho tìm theo tên hoặc email, gán lớp, xoá khỏi khoá học và tải danh sách. Limio chưa có tính năng gửi thông báo cho cả lớp.`,
  },
  {
    id: "dien-dan",
    title: "Diễn đàn hỏi đáp",
    keywords: ["diễn đàn", "forum", "câu hỏi học viên", "trả lời", "thảo luận", "chưa giải đáp"],
    destinationIds: ["forum"],
    body: `Học viên đăng câu hỏi ở nút "Thảo luận" trong bài học. Thầy/cô vào "Forum Q&A" ở menu LMS: có bốn thẻ số (Tổng thread, Chưa giải đáp, Đã xử lý, Stale), hộp chọn khoá, các nút lọc Tất cả, Chưa giải đáp, Đã xử lý và "Stale >48h". Bấm "Mở thread" để đọc và trả lời. Khi có câu trả lời đúng, bấm "Đánh dấu là câu trả lời" thì chủ đề chuyển sang "Đã xử lý".`,
  },
  {
    id: "nam-kien-thuc",
    title: "Xem học viên đang vướng ở đâu (Nắm kiến thức)",
    keywords: ["nắm kiến thức", "học viên yếu", "chủ đề yếu", "cá nhân hoá", "lộ trình", "quan niệm sai", "mastery", "vướng", "cần hỗ trợ", "im ắng", "learner insights"],
    destinationIds: ["learner_insights", "stale_learners"],
    body: `Vào "Nắm kiến thức" ở mục Phân tích và Báo cáo; trang có tên tiếng Anh "Learner Insights (BKT mastery)". Có các thẻ số Học viên tracked, Skill tracked, Mastery TB và HV có skill yếu, cùng "Ma trận học viên × skill" và "Coverage theo skill" để thấy chủ đề nào cả lớp còn yếu; hộp chọn "Tất cả khoá" cho lọc theo từng khoá. Muốn có dữ liệu, khoá cần bật "Cá nhân hoá học tập"; khi đó mỗi bài học tự thành một chủ đề và câu hỏi trong bài thừa hưởng chủ đề đó. Danh sách học viên cần hỗ trợ có ở trang Học viên của khoá. Học viên chỉ thấy nhãn Cần ôn, Nên luyện thêm hoặc Vững, không thấy phần trăm.`,
  },
  {
    id: "gamification",
    title: "Gamification, chứng nhận và e-portfolio",
    keywords: ["gamification", "xp", "huy hiệu", "badge", "xếp hạng", "streak", "chứng nhận", "chứng chỉ", "điểm thưởng", "portfolio", "hồ sơ năng lực"],
    destinationIds: ["tournaments", "my_courses"],
    body: `Giảng viên chỉ xem, không cấu hình XP hay huy hiệu: tab "Gamification" của khoá cho thấy tổng XP, số huy hiệu đã cấp, số học viên đang có streak và phân bố level, có xuất CSV. Điểm XP do giảng viên đặt chỉ có ở "Đấu trường". Chứng nhận tự cấp khi học viên hoàn thành khoá, giảng viên không phải cài gì. e-Portfolio là của học viên: họ tự bật công khai, chọn khoá đã hoàn thành có chứng nhận để trưng bày (mỗi khoá tối đa 2 bài); trang công khai không hiện điểm và nhận xét của giảng viên, và giảng viên chưa có mục xem riêng.`,
  },
  {
    id: "ngoai-ngu",
    title: "Dạy ngoại ngữ: bài nghe, từ vựng, hội thoại, thi thử",
    keywords: ["ngoại ngữ", "tiếng trung", "tiếng anh", "từ vựng", "hội thoại", "audio", "bài nghe", "flashcard", "hsk", "ielts", "toeic", "phiên âm", "pinyin", "chế độ ngoại ngữ", "4 kỹ năng", "góp ý bài viết", "góp ý bài nói"],
    destinationIds: ["my_courses", "exams"],
    body: `Trong bài học, bấm "+ Thêm hoạt động/tài nguyên" để thêm "Audio (bài nghe)" (tải mp3, m4a, ogg hoặc dán link, kèm lời thoại tuỳ chọn), "Từ vựng (bảng từ)" (gõ từng từ, dán từ Excel, hoặc "Nhập bằng AI" từ văn bản rồi duyệt trước khi thêm) và "Hội thoại" (gõ từng lượt hoặc dán cả đoạn, có audio và đặt mốc thời gian theo lượt). Ở tab Tổng quan, bấm "Sửa" rồi bật "Chế độ ngoại ngữ" (cần bật cá nhân hoá trước): mỗi bài có ô "Kỹ năng" Nghe, Nói, Đọc, Viết và học viên có trang "Hồ sơ 4 kỹ năng" chỉ hiện nhãn mức, không hiện phần trăm. Học viên cũng ôn từ vựng bằng flashcard theo lịch ôn cách quãng. Đề thi thử theo khung HSK, IELTS, TOEIC hoặc tuỳ chỉnh tạo ở trang đề thi của khoá ("Tạo đề thi thử từ khung"), có giờ riêng từng phần, cho nghe 1 lần hoặc giới hạn số lần; học viên thấy mục "Luyện thi". Góp ý bài viết và bài nói do AI tạo hiện ở cửa sổ chấm bài nộp, thầy/cô sửa rồi bấm "Duyệt" hoặc "Từ chối" trước khi học viên thấy là đã duyệt.`,
  },
  {
    id: "bai-giang-tao",
    title: "Tạo bài giảng tương tác (Limio-Live)",
    keywords: ["bài giảng", "slide", "powerpoint", "pptx", "limio-live", "dàn ý", "tài liệu", "bài giảng tương tác", "mô tả chủ đề", "soạn bài giảng", "tạo bài giảng", "nhập powerpoint"],
    destinationIds: ["live_from_document", "live_from_pptx", "live_decks"],
    body: `Vào "Bài giảng của tôi" rồi bấm "Tạo bài giảng". Có ba đường. Từ mô tả chủ đề: chọn tab "Mô tả chủ đề", nêu chủ đề, người học và điều người học làm được (15 đến 2.000 ký tự); có công tắc "Tìm thêm nguồn trên internet" nếu quản trị đã bật. Từ tài liệu: tab "Tải tệp lên" (Word, PDF, .txt, .md, tối đa 10 MB) hoặc "Dán văn bản". Chọn thời lượng 15, 30 hoặc 45 phút rồi bấm "Soạn dàn ý". Từ PowerPoint: liên kết "PowerPoint" dẫn tới "Tạo bài giảng từ PowerPoint" (chỉ nhận .pptx tối đa 10 MB), chọn "Giữ ý, làm đẹp lại" (không dùng AI, giữ nguyên thứ tự) hoặc "Soạn lại mạch" (AI dựng lại dàn ý, tốn token), xem màn đối chiếu rồi sang dàn ý. Ở trang "Dàn ý bài giảng" thầy/cô sửa, thêm, xoá, kéo đổi thứ tự các slide, chọn loại slide và bố cục; mọi sửa tự lưu và không tốn lượt AI. Cuối cùng bấm "Tạo N slide" ở thanh dưới cùng; bài đã có slide thì nút thành "Cập nhật slide theo dàn ý". Nội dung AI viết từ kiến thức chung luôn cần thầy/cô kiểm tra trước khi dạy.`,
  },
  {
    id: "bai-giang-trinh-sua",
    title: "Chỉnh slide, nhờ AI, giao diện và thương hiệu bài giảng",
    keywords: ["chỉnh slide", "sửa slide", "bố cục slide", "nhờ ai", "giao diện slide", "thương hiệu", "logo", "bìa", "ảnh slide", "hoàn tác slide", "phiên bản slide", "thêm slide", "biểu đồ", "bảng slide"],
    destinationIds: ["live_decks"],
    body: `Mở một bài giảng từ "Bài giảng của tôi" để vào trình sửa. Cột trái là danh sách slide kéo thả; nút "Thêm slide" mở hộp chọn loại (tương tác, trình bày, nhập PDF hoặc từ khoá học), và rê chuột vào khe giữa hai slide thì hiện nút [+] để chèn đúng chỗ. Bấm một slide hoặc nút "Sửa" để mở cửa sổ có hai tab: "Nội dung" (sửa chữ, thẻ, bảng, biểu đồ, bìa 10 kiểu) và "Nhờ AI" (chat theo từng slide, có nút nhanh như "Viết ngắn hơn", "Thêm ví dụ"; AI đề xuất thì bấm "Áp dụng" hoặc "Bỏ"). Bố cục có Bìa, Chữ và hình, Danh sách, Ba thẻ, So sánh hai cột, Các bước, Số liệu, Trích dẫn, Tóm tắt, Bảng, Biểu đồ. Ở ô hình, bấm "Đổi" để tải ảnh riêng hoặc chọn hình minh hoạ. Mục "Phiên bản" cho khôi phục bản trước khi sửa. Nút "Giao diện" có 18 giao diện màu và hoa văn; hộp "Thương hiệu của bài giảng" cho đặt logo, bảng màu 3 ô, hoặc dùng bộ thương hiệu của trường nếu quản trị trường đã đặt. Ô "Note" ở cột phải là ghi chú giảng, chỉ diễn giả thấy.`,
  },
  {
    id: "bai-giang-trinh-chieu",
    title: "Trình chiếu bài giảng, tương tác với lớp và chia sẻ",
    keywords: ["trình chiếu", "presenter", "máy chiếu", "qr", "quét qr", "kết quả tương tác", "lịch sử tương tác", "chia sẻ bài giảng", "tải pdf", "link xem", "kết thúc buổi"],
    destinationIds: ["live_decks"],
    body: `Bấm "Trình chiếu" ở trình sửa để chiếu toàn màn hình; mũi tên bên cạnh cho chọn "Từ đầu", "Từ slide này" hoặc "Presenter view" (xem trước, ghi chú Note và đồng hồ cho diễn giả; Chrome hoặc Edge có thể tự đưa màn chiếu lên máy chiếu nếu cấp quyền). Mỗi trang tương tác (Trắc nghiệm, Vote, Word Cloud, Dán Note, Draw-it, Whiteboard) có mã QR và mã tham gia riêng; bấm "Hiện QR trên màn chiếu" hoặc phím Q, học viên có thể vào ẩn danh hoặc đăng nhập. Nút "Kết thúc" cho chọn giữ phiên, lưu phiên và đổi mã mới, hoặc xoá kết quả và tạo phiên mới. Nút "Lịch sử" xem kết quả từng slide của các phiên đã chạy. Nút "Chia sẻ" tạo link xem chỉ đọc dạng /bai-giang/mã, ai có link cũng xem được không cần đăng nhập và tải được PDF; link không hiện ghi chú giảng, đáp án trắc nghiệm hay slide đã ẩn, và "Tạo link mới" làm link cũ hết hiệu lực. Limio chưa có chia sẻ bài giảng cho đồng nghiệp cùng soạn.`,
  },
  {
    id: "hoat-dong-nhanh",
    title: "Hoạt động nhanh trên lớp",
    keywords: ["bình chọn", "vote", "poll", "đám mây từ", "word cloud", "padlet", "bảng ý tưởng", "draw", "vẽ", "bảng trắng", "đếm ngược", "gọi tên", "chia nhóm", "phân nhóm", "gameshow", "sôi nổi", "tương tác lớp", "hoạt động lớp", "thùng rác"],
    destinationIds: ["teaching_tools", "poll", "wordcloud", "board", "timer", "grouping", "gameshow"],
    body: `Mục Limio-Live trong menu có các công cụ dùng ngay khi đứng lớp. Nhóm "Hoạt động nhanh" gồm Vote (bình chọn một câu hỏi), Word Cloud (đám mây từ khoá), Padlet (bảng ý tưởng để mỗi người ghim một ý), Draw-it (cả lớp vẽ minh hoạ) và Whiteboard (bảng trắng chung). Nhóm "Điều hành lớp học" gồm Đếm ngược, Gọi tên (chọn ngẫu nhiên một học viên), Phân nhóm và Gameshow (hỏi đáp có tính điểm). Mở một công cụ, bấm nút tạo ("Tạo Vote", "Tạo Word Cloud", "Tạo bảng mới"...) rồi bắt đầu; các phiên đã tạo nằm ở danh sách bên dưới với ô tìm, lọc theo thời gian, chọn nhiều phiên để xoá và "Dọn ... trống". Xoá chỉ chuyển vào "Thùng rác", giữ 30 ngày rồi mới xoá hẳn; có "Khôi phục" và "Hoàn tác" ngay sau khi xoá.`,
  },
  {
    id: "van-dap-ai",
    title: "Vấn đáp AI",
    keywords: ["vấn đáp", "oral", "hỏi đáp trực tiếp", "phòng vấn đáp", "soạn đề vấn đáp", "giám khảo ai", "mã tham gia"],
    destinationIds: ["oral_exam_new", "oral_exams"],
    body: `Vào "Phòng vấn đáp" ở menu Vấn đáp AI rồi bấm "Tạo đề vấn đáp mới". Chọn gắn một khoá học hoặc để là đề độc lập; nhập tiêu đề, chọn "Trả lời bằng" (gõ văn bản hay giọng nói), "Ngôn ngữ hỏi-đáp" (tiếng Việt, English hoặc tiếng Trung, không đổi được sau khi tạo), cách AI phản hồi (thi trung lập hay luyện có nhận xét ngắn) và số lượt mỗi sinh viên, rồi bấm "Lưu và tiếp tục". Ở tab "Tài liệu" tải tệp PDF, Word, .txt hoặc .md (tối đa 20 MB) hoặc nhập danh sách chủ đề; cần ít nhất một tài liệu trước khi mở. Ở tab "Tổ chức thi" đặt thời lượng mỗi lượt rồi bấm "Mở buổi vấn đáp" để nhận mã tham gia, link và mã QR; học viên đã ghi danh vào từ trang khoá. Nút "Thử vấn đáp" cho tự thử mà không tạo lượt. Khi chấm, bấm "Chấm bằng AI" để lấy đề xuất, sửa "Điểm của bạn" rồi "Chốt điểm"; điểm luôn do giảng viên duyệt, và có xuất Excel hoặc PDF. Rubric nhập ở trang chấm, xem mục rubric.`,
  },
  {
    id: "dau-truong",
    title: "Đấu trường",
    keywords: ["đấu trường", "tournament", "cuộc thi", "xếp hạng", "thi đua", "nhiệm vụ", "nộp muộn", "đội"],
    destinationIds: ["tournaments"],
    body: `"Đấu trường của tôi" dùng để tổ chức cuộc thi nhiều vòng có xếp hạng nhằm tạo động lực học; đây cũng là nơi duy nhất giảng viên tự đặt điểm XP. Một đấu trường có các tab Thông tin cơ bản, Nhiệm vụ, Đăng ký, Giám khảo, Giải thưởng và Bảng xếp hạng. Mỗi nhiệm vụ tạo qua 3 bước và có 5 kiểu: làm bài kiểm tra, nộp bài do giảng viên chấm, nộp bài cho bạn học chấm chéo, nộp liên kết hoặc tệp, và tự tính theo việc học trong khoá. Chấm chéo bắt buộc có bảng "Tiêu chí chấm". Có ô "Cho nộp muộn" ở một số kiểu, bài muộn có nhãn "Nộp muộn". Giảng viên đổi tên đội ở tab "Đăng ký", và ở trang bài nộp của nhiệm vụ có thể bấm "Xem bài" để xem trước và chấm nhanh bằng "Đạt" hoặc "Chưa đạt".`,
  },
];

/** Những điều Limio CHƯA có, để trợ lý không hứa nhầm. Luôn đưa vào prompt (ngắn). */
export const ASSISTANT_LIMITS =
  "Limio chưa có: gửi thông báo cho cả lớp; kéo thả để đổi thứ tự chương (đổi bằng ô Order); bảng tiêu chí chấm nhiều cột và hàng cho bài tập, đề thi hay vấn đáp (rubric ở đó chỉ là một ô văn bản tự do, nhưng AI có đọc nó khi gợi ý điểm; riêng nhiệm vụ Đấu trường chấm chéo có bảng tiêu chí); cài đặt XP hoặc huy hiệu cho giảng viên (chỉ có điểm XP trong Đấu trường); chia sẻ bài giảng cho đồng nghiệp cùng soạn (chỉ có link xem chỉ đọc); Thư viện mẫu, Template và Soạn kịch bản của Limio-Live (đang phát triển); chức năng đợt thi (chỉ có ca thi và phòng thi); báo cáo sau buổi dạy theo từng học viên; AI chấm ảnh, video hoặc PDF scan.";

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

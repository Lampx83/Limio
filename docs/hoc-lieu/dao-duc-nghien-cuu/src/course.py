# -*- coding: utf-8 -*-
"""Phần khung của khoá Đạo đức nghiên cứu khoa học: mô tả, danh sách lỗi tư
duy, lời phản hồi.

Khoá gồm 1 module, 6 bài, dùng chung cho **sinh viên, học viên cao học và
nghiên cứu sinh** — giống cách đặt của Khóa 4 (Xử lý & Phân tích dữ liệu).
Đạo đức nghiên cứu đã được chạm nhẹ ở 3 khoá kia (Khóa 2 Bài 6: consent/ẩn
danh/thời điểm xin duyệt; Khóa 3 Bài 5: ICMJE/predatory journal; Khóa 3 Bài 6:
AI trong viết bài) — khoá này KHÔNG dạy lại các phần đó, mà đào sâu góc khác:
liêm chính học thuật (FFP), quy trình hội đồng đạo đức đầy đủ, đạo đức dữ
liệu (kèm khung pháp lý Việt Nam), xung đột lợi ích, đạo đức dùng AI trong
toàn bộ quy trình nghiên cứu (không chỉ viết bài), và văn hoá liêm chính/báo
cáo sai phạm.

Danh sách lỗi tư duy dùng tiền tố `dd.` để không đụng mã của khoá khác trong
cùng DB.
"""

COURSE = {
    "title": "NCKH 501 · Đạo đức nghiên cứu khoa học",
    "slug": "dao-duc-nghien-cuu",
    "description": (
        "Khoá dùng chung cho sinh viên, học viên cao học và nghiên cứu sinh — đào sâu đạo đức "
        "nghiên cứu ở những góc chưa được dạy tại 3 khoá kia trong bộ kỹ năng nghiên cứu: liêm "
        "chính học thuật (đạo văn, tự đạo văn, ngụy tạo/sửa dữ liệu); quy trình hội đồng đạo đức "
        "đầy đủ (phân loại rủi ro, nhóm dễ bị tổn thương); đạo đức dữ liệu nghiên cứu (ẩn danh hoá "
        "kỹ thuật, đối chiếu Luật Bảo vệ dữ liệu cá nhân 2025 của Việt Nam); xung đột lợi ích; đạo "
        "đức dùng AI trong toàn bộ quy trình nghiên cứu, không chỉ khâu viết bài; và văn hoá liêm "
        "chính, báo cáo sai phạm. Mỗi bài dùng tình huống cụ thể, không chỉ nguyên tắc trừu tượng, "
        "và kết bằng một bài kiểm tra ngắn, phương án sai gắn mã lỗi tư duy để phản hồi chỉ đúng "
        "chỗ hiểu nhầm."
    ),
    "language": "vi",
    "level": "intermediate",
    "category": "Nghiên cứu khoa học",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Bài 1 · Liêm chính học thuật ──────────────────────────────────────────
    {
        "code": "dd.paraphrase-no-citation",
        "name": "Diễn giải ý tưởng người khác mà không trích dẫn",
        "description": (
            "Coi việc diễn giải (paraphrase) chỉ cần đổi từ ngữ khác với nguyên văn là đủ, không "
            "cần trích dẫn nguồn — đạo văn xảy ra khi lấy Ý TƯỞNG của người khác mà không ghi "
            "nguồn, không chỉ khi sao chép nguyên văn câu chữ."
        ),
    },
    {
        "code": "dd.self-plagiarism-no-issue",
        "name": "Coi tự đạo văn không phải vấn đề vì tự mình viết ra",
        "description": (
            "Dùng lại nguyên văn đoạn văn từ bài đã công bố trước đó của chính mình mà không trích "
            "dẫn hoặc khai báo, coi đây không phải vi phạm vì 'mình là người viết ra'. Tạp chí giữ "
            "bản quyền sau khi xuất bản, và độc giả có quyền biết nội dung đã công bố ở đâu."
        ),
    },
    {
        "code": "dd.ffp-vs-qrp-confused",
        "name": "Không phân biệt FFP với lỗi phương pháp thông thường",
        "description": (
            "Không phân biệt được vi phạm liêm chính nghiêm trọng (Fabrication, Falsification, "
            "Plagiarism — cố ý và có tính lừa dối) với sai sót phương pháp hoặc questionable "
            "research practices ở mức nhẹ hơn — hai loại này bị xử lý rất khác nhau."
        ),
    },
    {
        "code": "dd.misconduct-no-consequence",
        "name": "Nghĩ vi phạm liêm chính không có hậu quả nếu chưa bị phát hiện",
        "description": (
            "Cho rằng một vi phạm liêm chính chỉ trở thành vấn đề khi bị phát hiện, bỏ qua thực tế "
            "rằng công cụ phát hiện đạo văn, quy trình rà soát hậu kiểm, và việc người khác không "
            "tái lập được kết quả đều có thể phát hiện vi phạm nhiều năm sau khi công bố."
        ),
    },
    # ── Bài 2 · Hội đồng đạo đức nghiên cứu (IRB) ─────────────────────────────
    {
        "code": "dd.skip-risk-classification",
        "name": "Không phân loại mức rủi ro trước khi nộp hồ sơ hội đồng đạo đức",
        "description": (
            "Nộp hồ sơ xin duyệt đạo đức mà không tự đánh giá trước nghiên cứu thuộc mức rủi ro "
            "nào (minimal risk hay greater than minimal risk) — việc này quyết định quy trình "
            "thẩm định sẽ là rút gọn (expedited) hay đầy đủ (full board review)."
        ),
    },
    {
        "code": "dd.vulnerable-group-no-extra-safeguard",
        "name": "Không áp dụng biện pháp bảo vệ bổ sung cho nhóm dễ bị tổn thương",
        "description": (
            "Áp dụng quy trình đồng ý tham gia (consent) tiêu chuẩn cho nhóm dễ bị tổn thương (trẻ "
            "em, người có năng lực hạn chế, nhóm yếu thế) mà không có biện pháp bảo vệ bổ sung "
            "(đồng ý của người đại diện, đánh giá năng lực, giảm thiểu áp lực tham gia)."
        ),
    },
    {
        "code": "dd.one-time-approval-enough",
        "name": "Nghĩ phê duyệt đạo đức một lần là đủ cho toàn bộ nghiên cứu",
        "description": (
            "Cho rằng phê duyệt ban đầu của hội đồng đạo đức có hiệu lực vĩnh viễn, không cần báo "
            "cáo định kỳ (continuing review), báo cáo sửa đổi protocol, hay báo cáo sự cố bất lợi "
            "phát sinh trong quá trình nghiên cứu."
        ),
    },
    {
        "code": "dd.belmont-principle-confused",
        "name": "Nhầm lẫn giữa ba nguyên tắc Belmont",
        "description": (
            "Nhầm lẫn giữa Tôn trọng con người (Respect for Persons — tự nguyện tham gia, bảo vệ "
            "người có năng lực hạn chế), Làm điều thiện (Beneficence — tối đa hoá lợi ích, tối "
            "thiểu hoá rủi ro), và Công bằng (Justice — phân bổ công bằng gánh nặng/lợi ích nghiên "
            "cứu giữa các nhóm)."
        ),
    },
    # ── Bài 3 · Đạo đức dữ liệu nghiên cứu ────────────────────────────────────
    {
        "code": "dd.rename-is-anonymization",
        "name": "Coi đổi tên/mã hoá ID là đã ẩn danh hoàn toàn",
        "description": (
            "Cho rằng chỉ cần thay tên thật bằng mã số (ID1, ID2...) là dữ liệu đã được ẩn danh "
            "hoàn toàn, bỏ qua rủi ro tái nhận dạng (re-identification) khi tổ hợp các biến còn "
            "lại (tuổi, giới tính, đơn vị công tác, thời điểm) vẫn có thể chỉ đúng một người."
        ),
    },
    {
        "code": "dd.no-data-management-plan",
        "name": "Không có kế hoạch quản lý dữ liệu trước khi thu thập",
        "description": (
            "Bắt đầu thu thập dữ liệu mà không có kế hoạch quản lý dữ liệu (data management plan) "
            "xác định trước: ai sở hữu dữ liệu, lưu ở đâu, ai được truy cập, lưu bao lâu, và huỷ "
            "khi nào."
        ),
    },
    {
        "code": "dd.ignore-bvdlcn-law",
        "name": "Bỏ qua nghĩa vụ theo Luật Bảo vệ dữ liệu cá nhân khi xử lý dữ liệu nhạy cảm",
        "description": (
            "Thu thập dữ liệu cá nhân nhạy cảm (dữ liệu trẻ em, dữ liệu sinh trắc học) mà không "
            "biết hoặc bỏ qua nghĩa vụ theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 — ví dụ "
            "không xin đồng ý của cả trẻ (từ đủ 7 tuổi) và người đại diện, hoặc không lập hồ sơ "
            "đánh giá tác động xử lý dữ liệu cá nhân khi luật yêu cầu."
        ),
    },
    {
        "code": "dd.share-data-no-agreement",
        "name": "Chia sẻ dữ liệu nghiên cứu mà không có thoả thuận bảo mật rõ ràng",
        "description": (
            "Chia sẻ bộ dữ liệu nghiên cứu (cho đồng nghiệp, tạp chí yêu cầu open data, hoặc dịch "
            "vụ AI bên thứ ba) mà không có thoả thuận rõ ràng về mục đích sử dụng, thời hạn lưu "
            "trữ, và trách nhiệm bảo mật của bên nhận."
        ),
    },
    # ── Bài 4 · Xung đột lợi ích trong nghiên cứu ─────────────────────────────
    {
        "code": "dd.coi-only-if-affects",
        "name": "Chỉ công bố xung đột lợi ích khi tin rằng nó thực sự ảnh hưởng",
        "description": (
            "Chỉ công bố một xung đột lợi ích (tài trợ, quan hệ cá nhân) khi tự đánh giá rằng nó "
            "thực sự ảnh hưởng tới kết quả — nguyên tắc đúng là công bố MỌI xung đột lợi ích tiềm "
            "ẩn, để người đọc/hội đồng tự đánh giá, không phải người trong cuộc tự quyết."
        ),
    },
    {
        "code": "dd.no-recusal-conflict",
        "name": "Không tự rút khỏi vai trò phản biện/hội đồng khi có xung đột lợi ích",
        "description": (
            "Tiếp tục đóng vai trò phản biện hoặc thành viên hội đồng cho một nghiên cứu dù có "
            "xung đột lợi ích rõ ràng (quan hệ thầy trò, đồng tác giả trước đây, cạnh tranh trực "
            "tiếp về ý tưởng), thay vì tự rút (recusal) và báo cho ban biên tập/chủ tịch hội đồng."
        ),
    },
    {
        "code": "dd.sponsor-controls-publication",
        "name": "Chấp nhận điều khoản tài trợ cho nhà tài trợ kiểm soát việc công bố",
        "description": (
            "Ký hợp đồng tài trợ cho phép nhà tài trợ (doanh nghiệp) có quyền ngăn công bố kết quả "
            "bất lợi cho họ — vi phạm nguyên tắc độc lập học thuật, dù khoản tài trợ hợp pháp."
        ),
    },
    {
        "code": "dd.personal-relationship-not-coi",
        "name": "Không coi quan hệ cá nhân trong hội đồng là xung đột lợi ích",
        "description": (
            "Không công bố quan hệ cá nhân (thầy trò, người thân, đồng nghiệp thân thiết) khi tham "
            "gia hội đồng phản biện hoặc đánh giá một nghiên cứu liên quan tới người đó — xung đột "
            "lợi ích không chỉ giới hạn ở tiền bạc."
        ),
    },
    # ── Bài 5 · Đạo đức khi dùng AI trong toàn bộ quy trình nghiên cứu ────────
    {
        "code": "dd.ai-analysis-no-verify",
        "name": "Chấp nhận thẳng kết quả phân tích do AI đưa ra mà không kiểm chứng",
        "description": (
            "Dùng AI để phân tích dữ liệu (chạy thống kê, gợi ý mô hình) và chấp nhận kết quả mà "
            "không tự kiểm chứng bằng công cụ thống kê chuẩn hoặc hiểu được logic tính toán — coi "
            "AI như một hộp đen đáng tin tuyệt đối."
        ),
    },
    {
        "code": "dd.synthetic-data-as-real",
        "name": "Dùng dữ liệu tổng hợp rồi báo cáo như dữ liệu thu thập thật",
        "description": (
            "Dùng dữ liệu tổng hợp (synthetic data, kể cả do AI tạo ra) để lấp khoảng trống mẫu "
            "hoặc thử nghiệm, nhưng báo cáo hoặc trình bày như thể đó là dữ liệu thu thập thật — "
            "đây là ngụy tạo dữ liệu (fabrication), một vi phạm liêm chính nghiêm trọng."
        ),
    },
    {
        "code": "dd.ai-summary-no-read-source",
        "name": "Dùng bản tóm tắt tài liệu do AI tạo mà không tự đọc nguồn gốc",
        "description": (
            "Đưa vào tổng quan tài liệu một luận điểm hoặc số liệu dựa hoàn toàn vào bản tóm tắt "
            "do AI tạo ra, mà không tự đọc lại bài báo gốc để xác nhận tóm tắt đó phản ánh đúng "
            "nội dung, mức độ chắc chắn, và bối cảnh của nghiên cứu gốc."
        ),
    },
    {
        "code": "dd.ai-blackbox-no-disclosure",
        "name": "Không khai báo việc dùng AI trong khâu phân tích/thu thập dữ liệu",
        "description": (
            "Dùng AI đáng kể trong khâu phân tích hoặc thu thập/tổng hợp dữ liệu (không chỉ viết "
            "văn) mà không khai báo trong phần Methods — khác và nghiêm trọng hơn việc không khai "
            "báo dùng AI để sửa văn phong."
        ),
    },
    # ── Bài 6 · Báo cáo sai phạm và văn hoá liêm chính nghiên cứu ─────────────
    {
        "code": "dd.no-report-fear-retaliation",
        "name": "Không báo cáo sai phạm vì sợ trả đũa",
        "description": (
            "Chứng kiến hoặc nghi ngờ một sai phạm liêm chính nhưng chọn im lặng vì sợ ảnh hưởng "
            "tới quan hệ thầy trò/đồng nghiệp hoặc sự nghiệp của bản thân, coi đây là lựa chọn an "
            "toàn duy nhất — bỏ qua các kênh báo cáo bảo mật đã được thiết lập."
        ),
    },
    {
        "code": "dd.pi-not-responsible-culture",
        "name": "Người hướng dẫn/PI cho rằng văn hoá liêm chính là trách nhiệm cá nhân",
        "description": (
            "Người hướng dẫn (PI) cho rằng liêm chính nghiên cứu chỉ là trách nhiệm cá nhân của "
            "từng thành viên, không phải trách nhiệm của người dẫn dắt nhóm trong việc xây dựng "
            "quy trình, làm gương, và tạo môi trường an toàn để nêu vấn đề."
        ),
    },
    {
        "code": "dd.rcr-training-once-enough",
        "name": "Nghĩ đào tạo liêm chính nghiên cứu một lần là đủ",
        "description": (
            "Cho rằng hoàn thành một khoá đào tạo về liêm chính nghiên cứu (RCR) khi mới bắt đầu "
            "là đủ cho toàn bộ sự nghiệp nghiên cứu, bỏ qua nhu cầu cập nhật định kỳ khi công nghệ "
            "(như AI) và tình huống thực tế thay đổi liên tục."
        ),
    },
    {
        "code": "dd.whistleblower-identity-not-protected",
        "name": "Không bảo mật danh tính người tố cáo trong quy trình xử lý",
        "description": (
            "Xử lý một báo cáo sai phạm mà không bảo mật danh tính người tố cáo, hoặc tiết lộ "
            "danh tính cho bên bị tố cáo trước khi có kết luận điều tra — làm giảm khả năng người "
            "khác dám báo cáo trong tương lai."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "dd.paraphrase-no-citation",
        "body": (
            "Nguyên tắc: trích dẫn theo Ý TƯỞNG, không phải theo việc có sao chép nguyên văn hay "
            "không. Nếu ý đó không phải của bạn tự nghĩ ra, luôn ghi nguồn, dù đã viết lại hoàn "
            "toàn bằng lời của mình."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.self-plagiarism-no-issue",
        "body": (
            "Khi dùng lại đoạn văn từ bài đã công bố trước đó của chính mình, luôn trích dẫn lại "
            "bài đó như một nguồn, hoặc diễn đạt lại — không copy nguyên văn coi như nội dung mới."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.ffp-vs-qrp-confused",
        "body": (
            "FFP (Fabrication, Falsification, Plagiarism) là vi phạm nghiêm trọng, có tính cố ý "
            "lừa dối, xử lý bằng kỷ luật/rút bài. Questionable research practices (như p-hacking) "
            "là vấn đề phương pháp cần cải thiện, không cùng mức độ nghiêm trọng — nhưng cả hai "
            "đều cần được nhận diện đúng tên."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.misconduct-no-consequence",
        "body": (
            "Công cụ phát hiện đạo văn, rà soát hậu kiểm của tạp chí, và việc người khác cố tái "
            "lập không thành công đều có thể phát hiện vi phạm nhiều năm sau — không có 'vùng an "
            "toàn' chỉ vì chưa bị phát hiện ngay."
        ),
        "priority": 8,
    },
    {
        "misconception": "dd.skip-risk-classification",
        "body": (
            "Trước khi nộp hồ sơ, tự đánh giá nghiên cứu thuộc minimal risk hay greater than "
            "minimal risk — việc này quyết định quy trình sẽ nhanh (expedited) hay đầy đủ (full "
            "board), và chuẩn bị hồ sơ khớp với đúng quy trình."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.vulnerable-group-no-extra-safeguard",
        "body": (
            "Với nhóm dễ bị tổn thương, luôn thêm biện pháp bảo vệ: đồng ý của người đại diện hợp "
            "pháp, đánh giá năng lực tham gia, và giảm thiểu áp lực (ví dụ không để người có quyền "
            "lực trực tiếp mời tham gia)."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.one-time-approval-enough",
        "body": (
            "Lên lịch báo cáo định kỳ (continuing review) và báo cáo ngay khi có thay đổi protocol "
            "hoặc sự cố bất lợi — phê duyệt ban đầu không phải giấy phép vĩnh viễn."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.belmont-principle-confused",
        "body": (
            "Ghi nhớ bằng câu hỏi: Respect for Persons hỏi 'người tham gia có tự nguyện và đủ hiểu "
            "biết không?'; Beneficence hỏi 'lợi ích có lớn hơn rủi ro không?'; Justice hỏi 'ai gánh "
            "rủi ro, ai hưởng lợi — có công bằng không?'."
        ),
        "priority": 8,
    },
    {
        "misconception": "dd.rename-is-anonymization",
        "body": (
            "Sau khi đổi tên thành mã số, kiểm lại: tổ hợp các biến còn lại (tuổi, đơn vị, thời "
            "điểm, chức vụ) có thể chỉ đúng một người trong bối cảnh cụ thể không? Nếu có, cần ẩn "
            "danh hoá sâu hơn (gộp nhóm, làm mờ giá trị) hoặc giới hạn công bố chi tiết đó."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.no-data-management-plan",
        "body": (
            "Trước khi thu thập dữ liệu, viết một kế hoạch ngắn: ai sở hữu, lưu ở đâu, ai truy cập "
            "được, lưu bao lâu, huỷ khi nào — nhiều quỹ tài trợ và hội đồng đạo đức hiện yêu cầu "
            "văn bản này trước khi phê duyệt."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.ignore-bvdlcn-law",
        "body": (
            "Với dữ liệu trẻ em hoặc dữ liệu sinh trắc học, đối chiếu Luật Bảo vệ dữ liệu cá nhân "
            "số 91/2025/QH15: trẻ từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện (Điều 24), "
            "và cân nhắc nghĩa vụ lập hồ sơ đánh giá tác động (Điều 21) nếu quy mô xử lý đủ lớn."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.share-data-no-agreement",
        "body": (
            "Trước khi chia sẻ dữ liệu (kể cả với dịch vụ AI bên thứ ba), lập thoả thuận rõ mục "
            "đích, thời hạn, và trách nhiệm bảo mật — hoặc ưu tiên khử nhận dạng dữ liệu trước khi "
            "gửi đi khi có thể."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.coi-only-if-affects",
        "body": (
            "Công bố mọi xung đột lợi ích tiềm ẩn, để người đọc/hội đồng tự đánh giá mức độ ảnh "
            "hưởng — không tự mình phán xét trước rằng nó 'không đáng kể' rồi bỏ qua việc công bố."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.no-recusal-conflict",
        "body": (
            "Khi phát hiện xung đột lợi ích với một nghiên cứu mình được mời phản biện/đánh giá, "
            "báo ngay cho ban biên tập/chủ tịch hội đồng và tự rút (recusal), không tự đánh giá "
            "'mình vẫn khách quan được' rồi tiếp tục."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.sponsor-controls-publication",
        "body": (
            "Trước khi ký hợp đồng tài trợ, đảm bảo điều khoản giữ quyền công bố độc lập của nhà "
            "nghiên cứu — từ chối điều khoản cho phép nhà tài trợ ngăn công bố kết quả bất lợi."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.personal-relationship-not-coi",
        "body": (
            "Công bố quan hệ cá nhân (thầy trò, người thân, đồng nghiệp thân thiết) khi được mời "
            "vào vai trò phản biện/hội đồng — xung đột lợi ích không chỉ là chuyện tiền bạc."
        ),
        "priority": 8,
    },
    {
        "misconception": "dd.ai-analysis-no-verify",
        "body": (
            "Dùng kết quả AI phân tích như một gợi ý ban đầu, luôn tự kiểm chứng lại bằng công cụ "
            "thống kê chuẩn hoặc tự tay tính lại ở một phần đủ để tin tưởng logic tính toán."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.synthetic-data-as-real",
        "body": (
            "Nếu dùng dữ liệu tổng hợp (synthetic) ở bất kỳ giai đoạn nào, khai báo rõ ràng đó là "
            "dữ liệu tổng hợp và mục đích dùng nó (thử pipeline, bảo vệ privacy) — không bao giờ "
            "trình bày lẫn với dữ liệu thu thập thật."
        ),
        "priority": 10,
    },
    {
        "misconception": "dd.ai-summary-no-read-source",
        "body": (
            "Dùng bản tóm tắt của AI để quyết định có đáng đọc kỹ hay không (đọc chiến lược), "
            "nhưng trước khi trích dẫn bất kỳ luận điểm hay số liệu nào vào bản thảo, tự đọc lại "
            "bài gốc để xác nhận."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.ai-blackbox-no-disclosure",
        "body": (
            "Khai báo rõ trong Methods nếu AI được dùng đáng kể ở khâu thu thập hoặc phân tích dữ "
            "liệu — khác với và cần chi tiết hơn khai báo dùng AI chỉ để sửa văn phong."
        ),
        "priority": 9,
    },
    {
        "misconception": "dd.no-report-fear-retaliation",
        "body": (
            "Dùng kênh báo cáo bảo mật (research integrity officer, đường dây riêng) thay vì im "
            "lặng — các quy trình liêm chính hiện đại được thiết kế để bảo vệ danh tính người báo "
            "cáo."
        ),
        "priority": 8,
    },
    {
        "misconception": "dd.pi-not-responsible-culture",
        "body": (
            "Người hướng dẫn/PI cần chủ động xây dựng quy trình rõ ràng, làm gương về liêm chính, "
            "và tạo không khí an toàn để thành viên nhóm dám nêu câu hỏi hoặc lo ngại — đây là "
            "trách nhiệm lãnh đạo, không chỉ trách nhiệm cá nhân từng người."
        ),
        "priority": 8,
    },
    {
        "misconception": "dd.rcr-training-once-enough",
        "body": (
            "Coi đào tạo liêm chính nghiên cứu là quá trình liên tục, đặc biệt cập nhật khi có "
            "công nghệ mới (như AI) làm xuất hiện tình huống chưa từng gặp trước đó."
        ),
        "priority": 7,
    },
    {
        "misconception": "dd.whistleblower-identity-not-protected",
        "body": (
            "Khi xử lý một báo cáo sai phạm, giữ kín danh tính người tố cáo trong suốt quá trình "
            "điều tra ban đầu — tiết lộ sớm có thể dẫn tới trả đũa và làm giảm khả năng người khác "
            "dám báo cáo sau này."
        ),
        "priority": 9,
    },
]

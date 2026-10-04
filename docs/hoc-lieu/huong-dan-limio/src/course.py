# -*- coding: utf-8 -*-
"""Phần khung của khoá mẫu: mô tả, danh sách lỗi tư duy, lời phản hồi.

Văn phong (user chốt 2026-10-03): câu đủ chủ ngữ và vị ngữ, xưng "thầy/cô", không
trộn tiếng Anh với tiếng Việt. Mã lỗi tư duy dùng tiền tố `limio.`.
"""

COURSE = {
    "title": "Hướng dẫn sử dụng Limio",
    "slug": "huong-dan-su-dung-limio",
    "description": (
        "Khoá học này dành cho thầy/cô lần đầu dùng Limio. Thầy/cô vừa học cách dùng, vừa "
        "được xem một khoá học hoàn chỉnh trông như thế nào, vì chính khoá này được dựng "
        "bằng các tính năng mà thầy/cô sắp dùng: bài học có mục tiêu và tổng kết, bài kiểm "
        "tra cuối bài, phản hồi theo từng chỗ hiểu sai, và lộ trình học riêng cho từng người. "
        "Mỗi bài học ngắn, đọc khoảng ba đến năm phút, kèm hình vẽ minh hoạ giao diện và một "
        "việc nhỏ để thầy/cô làm thử ngay trong khoá của mình. Bản này gồm bốn chương: dựng "
        "khoá đầu tiên, kiểm tra và đánh giá, bài tập cùng phản hồi cá nhân hoá, và quản lý "
        "lớp học cùng theo dõi tiến độ."
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Hướng dẫn sử dụng",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    {
        "code": "limio.draft-visible",
        "name": "Cho rằng khoá nháp học viên đã thấy được",
        "description": (
            "Nghĩ rằng khoá vừa tạo xong là học viên vào học được ngay. Thật ra khoá ở trạng "
            "thái nháp cho tới khi giảng viên bấm nút xuất bản, và học viên chưa thấy khoá "
            "trong danh mục."
        ),
    },
    {
        "code": "limio.scaffold-left-behind",
        "name": "Quên các chương và bài học mẫu hệ thống dựng sẵn",
        "description": (
            "Quên rằng hệ thống tự tạo ba chương, mỗi chương ba bài học trống ngay khi tạo khoá. "
            "Nếu không đổi tên hoặc xoá, các bài trống này vẫn nằm trong khoá khi xuất bản."
        ),
    },
    {
        "code": "limio.public-means-open",
        "name": "Nhầm công khai với mở hoàn toàn",
        "description": (
            "Nghĩ rằng đánh dấu công khai nghĩa là ai cũng học và làm bài được. Công khai chỉ "
            "cho người chưa đăng nhập xem nội dung; tiến độ, ghi chú, thảo luận, bài kiểm tra "
            "và trợ lý AI vẫn đòi đăng nhập."
        ),
    },
    {
        "code": "limio.two-assessment-systems",
        "name": "Nhầm bài kiểm tra trong bài học với đề thi",
        "description": (
            "Cho rằng câu hỏi soạn trong bài kiểm tra của bài học và câu hỏi trong ngân hàng "
            "là một kho chung. Hai hệ thống này tách riêng: bài kiểm tra trong bài học dùng "
            "để ôn và nuôi phản hồi cá nhân hoá; ngân hàng câu hỏi và đề thi dùng cho kỳ thi."
        ),
    },
    {
        "code": "limio.round-status-opens-session",
        "name": "Nghĩ trạng thái đợt thi tự mở hoặc đóng ca thi",
        "description": (
            "Cho rằng đổi đợt thi sang Đang mở hay Đã đóng thì các ca thi tự mở hay tự đóng. "
            "Trạng thái đợt thi chỉ để phân loại; giờ vào thi do từng ca quyết định."
        ),
    },
    {
        "code": "limio.ai-score-is-final",
        "name": "Coi điểm AI gợi ý là điểm đã chấm",
        "description": (
            "Nghĩ rằng bấm gợi ý điểm bằng AI là bài đã được chấm xong. AI chỉ điền nháp điểm "
            "và nhận xét; giảng viên phải xem lại rồi bấm lưu thì học viên mới nhận được."
        ),
    },
    {
        "code": "limio.rubric-is-table",
        "name": "Tưởng tiêu chí chấm là một bảng có cấu trúc",
        "description": (
            "Nghĩ rằng tiêu chí chấm phải dựng thành bảng nhiều cột nhiều dòng. Thực tế đó là "
            "một ô văn bản; AI đọc đúng đoạn chữ ấy khi gợi ý điểm nên cần viết rõ điểm cho "
            "từng ý."
        ),
    },
    {
        "code": "limio.tags-by-hand",
        "name": "Nghĩ phải tự gắn chủ đề cho từng bài",
        "description": (
            "Cho rằng muốn có phản hồi cá nhân hoá thì phải gắn chủ đề cho từng bài và từng "
            "câu hỏi. Khi bật cá nhân hoá, mỗi bài học tự trở thành một chủ đề; thầy/cô chỉ "
            "gắn tay khi muốn chia mịn hơn."
        ),
    },
    {
        "code": "limio.student-sees-percent",
        "name": "Tưởng học viên thấy phần trăm thành thạo",
        "description": (
            "Nghĩ rằng học viên nhìn thấy con số phần trăm như giảng viên. Học viên chỉ thấy "
            "các nhãn Cần ôn, Nên luyện thêm, Vững, vì con số dễ bị đọc như một bản án về "
            "năng lực."
        ),
    },
    {
        "code": "limio.invite-code-reuse",
        "name": "Nghĩ tạo lại mã mời thì link cũ vẫn dùng được",
        "description": (
            "Cho rằng tạo lại mã mời chỉ thêm một link mới. Thực tế link cũ ngừng hoạt động "
            "ngay, nên học viên đang giữ link cũ sẽ không vào được lớp."
        ),
    },
    {
        "code": "limio.section-deadline-global",
        "name": "Nghĩ đặt hạn cho một lớp sẽ đổi hạn của mọi lớp",
        "description": (
            "Cho rằng sửa hạn nộp ở một lớp là sửa luôn hạn chung. Hạn theo lớp chỉ ghi đè "
            "cho những lớp được chọn; các lớp còn lại vẫn theo hạn chung."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "limio.draft-visible",
        "body": (
            "Thầy/cô vừa tạo khoá thì khoá còn ở trạng thái nháp, và học viên chưa thấy được. "
            "Khoá chỉ xuất hiện với học viên sau khi thầy/cô bấm nút xuất bản. Thầy/cô nên xem "
            "trước bằng nút \"Xem như học viên\" rồi mới xuất bản."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.scaffold-left-behind",
        "body": (
            "Hệ thống dựng sẵn ba chương và chín bài học trống khi thầy/cô tạo khoá. Nếu thầy/cô "
            "chỉ dùng hai bài, thầy/cô cần xoá các bài còn lại trước khi xuất bản, vì hệ thống "
            "không tự kiểm tra bài trống."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.public-means-open",
        "body": (
            "Công khai chỉ cho người chưa đăng nhập xem nội dung bài. Muốn làm bài kiểm tra, ghi "
            "chú, thảo luận hoặc dùng trợ lý AI, người học vẫn phải đăng nhập. Vì thế thầy/cô "
            "vẫn cần mời học viên ghi danh nếu muốn theo dõi tiến độ của họ."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.two-assessment-systems",
        "body": (
            "Limio có hai nơi soạn câu hỏi khác nhau. Bài kiểm tra trong bài học dùng để học "
            "viên ôn và để hệ thống ước lượng mức thành thạo. Ngân hàng câu hỏi và đề thi dùng "
            "cho kỳ thi. Câu hỏi của hai nơi này không tự chia sẻ cho nhau."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.round-status-opens-session",
        "body": (
            "Trạng thái của đợt thi chỉ giúp thầy/cô phân loại, không mở hay đóng ca thi. Giờ "
            "vào thi do từng ca quyết định, nên thầy/cô cần kiểm tra giờ mở và giờ đóng ở ca thi."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.ai-score-is-final",
        "body": (
            "AI chỉ điền nháp điểm và nhận xét vào cửa sổ chấm, và không tự lưu. Thầy/cô cần đọc, "
            "sửa nếu cần, rồi bấm nút chấm điểm thì học viên mới nhận được kết quả."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.rubric-is-table",
        "body": (
            "Tiêu chí chấm trong Limio là một ô văn bản, không phải bảng. Thầy/cô hãy viết rõ "
            "điểm cho từng ý, ví dụ \"3 điểm nêu đúng khái niệm, 4 điểm có ví dụ\". AI đọc đúng "
            "đoạn chữ này để gợi ý điểm."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.tags-by-hand",
        "body": (
            "Thầy/cô không cần gắn chủ đề cho từng bài. Khi bật cá nhân hoá, mỗi bài học tự trở "
            "thành một chủ đề, và câu hỏi trong bài thừa hưởng chủ đề đó. Thầy/cô chỉ gắn thêm "
            "khi muốn chia mịn hơn."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.student-sees-percent",
        "body": (
            "Học viên chỉ thấy ba nhãn là Cần ôn, Nên luyện thêm và Vững. Phần trăm chỉ hiện với "
            "giảng viên. Cách này giúp học viên coi nhãn là gợi ý việc nên làm tiếp, thay vì một "
            "lời phán xét về năng lực."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.invite-code-reuse",
        "body": (
            "Khi thầy/cô tạo lại mã mời, link cũ ngừng hoạt động ngay lập tức. Thầy/cô nên gửi "
            "link mới cho cả lớp và chỉ tạo lại khi cần thu hồi link đã lộ."
        ),
        "priority": 10,
    },
    {
        "misconception": "limio.section-deadline-global",
        "body": (
            "Hạn theo lớp chỉ áp dụng cho những lớp thầy/cô đã tích chọn. Các lớp còn lại vẫn "
            "dùng hạn chung. Nếu muốn một lớp quay về hạn chung, thầy/cô bấm \"Dùng hạn chung\"."
        ),
        "priority": 10,
    },
]

# -*- coding: utf-8 -*-
from mockup import *

_INVITE = shot(
    "4-1-the-link-moi-lop",
    "Hình minh hoạ: khung của một lớp, gồm tên lớp, nút nhập học viên, số học viên và khung “Link mời vào lớp”.",
    "Trang /instructor/courses/{id}, tab \"Lớp học\" đang mở, khoá \"Nhập môn Lập trình\" (đã xuất bản). Lớp \"K65-CS1\" có 14 học viên, mô tả \"Lớp K65-CS1 — Nhập môn Lập trình, học kỳ I\". "
    "Chụp khung của lớp này: tên lớp, nút \"Nhập học viên\", nút ba chấm, ô \"14 học viên | Xem danh sách\" và khung \"Link mời vào lớp\" kèm đường dẫn /enroll/mã, nút \"Sao chép\", nút \"Mã QR\". Menu ba chấm không cần mở.",
    marks=["Khung Link mời vào lớp", "Nút Mã QR", "Nút Nhập học viên", "Xem danh sách"],
)

_INVITE_LEGEND = legend(
    [
        "**Khung mời.** Giao diện ghi \"Link mời vào lớp\" ở đầu khung. Bên trong là đường dẫn mời của lớp, phần cuối là mã của lớp. Thầy/cô gửi đường dẫn này qua nhóm chat hoặc email.",
        "**Nút \"Mã QR\".** Thầy/cô bấm nút này để lấy mã QR và chiếu lên màn hình lớp cho học viên quét bằng điện thoại. Nút \"Sao chép\" bên cạnh dùng để chép đường dẫn.",
        "**Nút \"Nhập học viên\".** Thầy/cô dùng nút này để nhập cả danh sách học viên của lớp bằng tệp CSV.",
        "**Số học viên và \"Xem danh sách\".** Ô xanh cho biết lớp có bao nhiêu học viên. Thầy/cô bấm \"Xem danh sách\" để mở danh sách của lớp.",
    ]
)

_FLOW = flow(
    [
        ("Tạo lớp", "Đặt tên lớp và mô tả"),
        ("Gửi đường dẫn mời", "Hoặc chiếu mã QR"),
        ("Học viên bấm Vào học", "Trang \"Lời mời tham gia lớp học\""),
        ("Xem danh sách lớp", "Tiến độ và điểm"),
    ]
)

_CSV = (
    "- Dòng 1 là tên cột: `name,email`\n"
    "- Dòng 2 là học viên đầu tiên: `Nguyễn Văn An,an.nguyen@example.com`\n"
    "- Dòng 3 là học viên tiếp theo: `Trần Thị Bình,binh.tran@example.com`"
)

_DEADLINE = shot(
    "4-1-han-theo-lop",
    "Hình minh hoạ: bảng “Hạn theo lớp” đang mở trong biểu mẫu sửa bài tập, đã chọn hai lớp.",
    "Trang bài \"Câu lệnh if\" của khoá \"Nhập môn Lập trình\" (có ba lớp K65-CS1, K65-CS2, K65-CS3). Bấm biểu tượng bút chì ở khối Bài tập, kéo xuống, bấm dòng \"Hạn theo lớp\" để mở. "
    "Tích chọn hai lớp K65-CS1 và K65-CS2, lớp K65-CS3 không tích. Chụp từ dòng tiêu đề \"Hạn theo lớp\" tới hết các nút \"Áp dụng cho 2 lớp\", \"Dùng hạn chung\", \"Bỏ chọn\".",
    marks=["Dòng Hạn chung", "Chọn tất cả lớp", "Dòng của một lớp", "Nút Sửa"],
)

_DEADLINE_LEGEND = legend(
    [
        "**Dòng \"Hạn chung\".** Đây là hạn mặc định. Các lớp chưa có hạn riêng và học viên chưa gán lớp đều theo hạn này.",
        "**Ô \"Chọn tất cả lớp\".** Thầy/cô tích ô này để chọn mọi lớp cùng lúc. Bên phải có dòng cho biết đang chọn bao nhiêu lớp.",
        "**Dòng của một lớp.** Mỗi lớp có hộp chọn, tên lớp, số học viên và dòng \"Theo hạn chung\" khi lớp chưa có hạn riêng. Trong ảnh, hai lớp K65-CS1 và K65-CS2 được tích, còn K65-CS3 thì không.",
        "**Nút \"Sửa\".** Thầy/cô bấm nút này để đặt hạn riêng cho đúng một lớp.",
    ]
)

_DEADLINE_BOX = (
    "Khi đã tích chọn lớp, bên dưới hiện khung \"Đặt hạn cho 2 lớp đã chọn\". "
    "Thầy/cô nhập ngày giờ vào ô \"Hạn nộp\", hoặc tích hộp \"Không có hạn\". "
    "Nút xanh \"Áp dụng cho 2 lớp\" lưu hạn riêng cho các lớp đã tích. Nút \"Dùng hạn chung\" đưa các lớp đã tích về hạn chung. Nút \"Bỏ chọn\" bỏ dấu tích mà không đổi gì."
)

LESSON = {
    "title": "Bài 4.1 · Chia lớp và đặt hạn riêng cho từng lớp",
    "durationMin": 6,
    "description": "Tạo lớp trong một khoá học, mời học viên bằng đường dẫn hoặc tệp CSV, quản lý danh sách lớp và đặt hạn nộp riêng cho từng lớp.",
    "objectives": [
        "Tạo được một lớp và gửi đường dẫn mời cho học viên",
        "Nhập danh sách học viên bằng tệp CSV và chuyển học viên sang lớp khác",
        "Đặt được hạn nộp riêng cho một lớp mà không làm đổi hạn của lớp khác",
    ],
    "summary": [
        "Mỗi lớp có một đường dẫn mời và một mã QR riêng. Tạo lại mã mời thì đường dẫn cũ ngừng hoạt động ngay.",
        "Danh sách lớp cho thấy tiến độ và điểm bài kiểm tra gần nhất của từng học viên; lớp chỉ xoá được khi không còn học viên.",
        "Hạn theo lớp chỉ ghi đè cho những lớp thầy/cô đã tích chọn; các lớp còn lại theo hạn chung.",
    ],
    "body": (
        "\n## Vì sao thầy/cô cần chia lớp\n\n"
        "Một khoá học có thể có nhiều lớp học cùng học. Ví dụ, thầy/cô dạy môn Nhập môn Lập trình cho ba lớp K65-CS1, K65-CS2 và K65-CS3, gồm 14, 12 và 10 học viên. "
        "Cả ba lớp dùng chung một khoá học, nhưng học vào những buổi khác nhau.\n\n"
        "Khi chia lớp, thầy/cô làm được hai việc. Việc thứ nhất là xem tiến độ và điểm riêng cho từng lớp. "
        "Việc thứ hai là đặt hạn nộp riêng, vì lớp học thứ Hai và lớp học thứ Sáu hiếm khi nộp bài cùng một ngày.\n\n"
        "Mục **Lớp học** nằm ở đầu trang khoá học, cạnh mục Học viên. Mục này chỉ hiện khi khoá đã được xuất bản.\n\n"
        + _FLOW
        + "\n\n## Tạo lớp và mời học viên\n\n"
        "Thầy/cô vào mục **Lớp học**. Ở đầu mục này có sẵn biểu mẫu tạo lớp với hai ô.\n\n"
        "1. **Tên lớp.** Ô này bắt buộc (có dấu sao). Ô gợi ý cách đặt tên, ví dụ \"Lớp K65-CS1\".\n"
        "2. **Mô tả (tuỳ chọn).** Thầy/cô có thể ghi lịch học hoặc phòng học.\n\n"
        "Thầy/cô điền các ô rồi bấm nút **Tạo lớp**. Mỗi lớp mới hiện thành một khung riêng bên dưới, kèm khung mời. Hình dưới đây cho thấy một khung như vậy.\n\n"
        + _INVITE
        + "\n\n"
        + _INVITE_LEGEND
        + "\n\nĐường dẫn mời có dạng `/enroll/` rồi đến mã của lớp. Dòng chữ mờ dưới đường dẫn nhắc rằng ai có đường dẫn này cũng vào được lớp. "
        "Khi học viên mở đường dẫn, họ thấy trang \"Lời mời tham gia lớp học\" và bấm nút **Vào học** để tham gia.\n\n"
        "> [!meo] **Gửi đường dẫn cho cả lớp một lần.**\n"
        "> Thầy/cô dán đường dẫn vào nhóm chat của lớp, hoặc chiếu mã QR lên màn hình trong buổi học đầu tiên.\n\n"
        "## Nhập danh sách học viên và quản lý lớp\n\n"
        "Nếu thầy/cô đã có danh sách lớp trong Excel, thầy/cô không cần mời từng người. Ở góc phải khung của lớp có nút **Nhập học viên**. "
        "Nút này nhận một tệp **CSV**. "
        "Dòng đầu tiên của tệp bắt buộc là tên cột, các dòng sau là từng học viên. Ví dụ:\n\n"
        + _CSV
        + "\n\n"
        "Bấm **Xem danh sách** để mở danh sách của lớp. Danh sách có các cột sau.\n\n"
        "| Cột | Cho thầy/cô biết |\n"
        "|---|---|\n"
        "| Học viên | Tên và email của học viên |\n"
        "| Trạng thái | Học viên đang học hay đã hoàn thành |\n"
        "| Vào lớp | Ngày học viên vào lớp |\n"
        "| Tiến độ | Học viên đã học được bao nhiêu phần khoá học |\n"
        "| Điểm bài kiểm tra gần nhất | Kết quả bài kiểm tra mới nhất của học viên |\n"
        "| Chuyển lớp | Nút để đưa học viên sang lớp khác |\n\n"
        "Ba thao tác còn lại nằm trong menu ba chấm ở góc phải khung của lớp.\n\n"
        "- **Sửa lớp** đổi tên hoặc mô tả.\n"
        "- **Tạo lại mã mời** sinh ra một đường dẫn mới. Dòng chữ mờ trong khung mời gọi thao tác này là \"Tạo lại mã\".\n"
        "- **Xoá lớp** chỉ làm được khi lớp không còn học viên nào. Thầy/cô cần bấm \"Chuyển lớp\" cho từng học viên trước.\n\n"
        "> [!canh-bao] **Tạo lại mã mời thì đường dẫn cũ chết ngay.**\n"
        "> Học viên đang giữ đường dẫn cũ sẽ không vào được lớp nữa. Thầy/cô chỉ nên tạo lại khi đường dẫn bị lộ ra ngoài, rồi gửi ngay đường dẫn mới cho cả lớp.\n\n"
        "### Khoá chỉ vào bằng đường dẫn mời của lớp\n\n"
        "Khi tạo khoá, ô \"Ai vào được khoá này\" có hai lựa chọn: \"Mở — ai cũng tự đăng ký được\" và \"Chỉ vào bằng link mời lớp\". "
        "Với lựa chọn thứ hai, học viên chỉ vào được khoá bằng đường dẫn mời của một lớp. "
        "Vì vậy thầy/cô cần tạo ít nhất một lớp trước khi mời học viên vào khoá kiểu này.\n\n"
        "## Đặt hạn riêng cho từng lớp\n\n"
        "Lớp học thứ Hai và lớp học thứ Sáu thường cần hạn nộp khác nhau. Limio cho thầy/cô đặt hạn riêng cho từng lớp mà không phải nhân đôi bài tập.\n\n"
        "Thầy/cô mở biểu mẫu sửa của bài tập hoặc bài kiểm tra, rồi tìm bảng ở phía dưới. "
        "Với bài tập, thầy/cô mở trang bài học và bấm biểu tượng bút chì ở khối Bài tập. Bảng tên là **Hạn theo lớp** với bài tập, và **Lịch theo lớp** với bài kiểm tra. "
        "Bảng đang thu gọn nên thầy/cô bấm vào dòng tiêu đề để mở. Dòng đầu tiên luôn cho biết hạn chung.\n\n"
        + _DEADLINE
        + "\n\n"
        + _DEADLINE_LEGEND
        + "\n\n"
        + _DEADLINE_BOX
        + "\n\nVới bài tập, thầy/cô đặt \"Hạn nộp\". Với bài kiểm tra, thầy/cô đặt \"Hạn mở\" và \"Hạn đóng\", "
        "hoặc chọn \"Mở ngay\" và \"Không có hạn\" nếu không cần ngày cụ thể.\n\n"
        "> [!vi-du] **Bài tập có hạn chung là 15/10.**\n"
        "> Lớp K65-CS2 học thứ Sáu nên cần thêm ba ngày. Thầy/cô tích chọn riêng lớp K65-CS2, đặt hạn nộp 18/10 và bấm \"Áp dụng cho 1 lớp\". "
        "Lớp K65-CS1 và K65-CS3 vẫn nộp bài trước 15/10.\n\n"
        "> [!ghi-nho] **Hạn riêng chỉ đổi những lớp được tích chọn.**\n"
        "> Hạn chung không bị sửa. Muốn lớp nào quay về hạn chung, thầy/cô tích chọn lớp đó rồi bấm \"Dùng hạn chung\". Muốn đặt hạn riêng cho đúng một lớp, thầy/cô bấm \"Sửa\" ở dòng của lớp đó.\n\n"
        + try_now(
            "Tạo một lớp và lấy đường dẫn mời",
            [
                "Mở một khoá đã xuất bản của thầy/cô, rồi bấm mục **Lớp học**.",
                "Gõ tên lớp vào ô **Tên lớp** rồi bấm **Tạo lớp**.",
                "Tìm khung mời của lớp vừa tạo và đọc thử đường dẫn có dạng `/enroll/` kèm mã.",
                "Bấm **Xem danh sách** để biết nơi học viên sẽ xuất hiện. Thầy/cô chưa cần gửi đường dẫn cho ai.",
            ],
            minutes=2,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 4.1",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "4.1-tao-lai-ma-moi",
                "type": "mcq",
                "prompt": "Thầy/cô bấm \"Tạo lại mã mời\" cho một lớp. Điều gì xảy ra với đường dẫn mời cũ?",
                "explanation": "Đường dẫn cũ ngừng hoạt động ngay. Học viên đang giữ đường dẫn cũ không vào được lớp, nên thầy/cô cần gửi đường dẫn mới.",
                "points": 1,
                "options": [
                    {"label": "Đường dẫn cũ ngừng hoạt động ngay", "isCorrect": True},
                    {
                        "label": "Đường dẫn cũ vẫn dùng được song song với đường dẫn mới",
                        "isCorrect": False,
                        "misconception": "limio.invite-code-reuse",
                    },
                    {"label": "Đường dẫn cũ hết hạn sau bảy ngày", "isCorrect": False},
                    {"label": "Học viên đã vào lớp bị đưa ra khỏi lớp", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-han-theo-lop",
                "type": "mcq",
                "prompt": "Bài tập có hạn chung là 15/10. Thầy/cô tích chọn lớp K65-CS2, đặt hạn nộp 18/10 rồi bấm \"Áp dụng cho 1 lớp\". Kết quả nào đúng?",
                "explanation": "Hạn theo lớp chỉ ghi đè cho lớp được tích chọn. Hạn chung vẫn là 15/10 và các lớp khác vẫn theo hạn chung.",
                "points": 1,
                "options": [
                    {"label": "Chỉ lớp K65-CS2 có hạn 18/10; các lớp khác vẫn hạn 15/10", "isCorrect": True},
                    {
                        "label": "Hạn của mọi lớp đổi thành 18/10",
                        "isCorrect": False,
                        "misconception": "limio.section-deadline-global",
                    },
                    {
                        "label": "Hạn chung đổi thành 18/10 và lớp K65-CS2 cũng theo hạn đó",
                        "isCorrect": False,
                        "misconception": "limio.section-deadline-global",
                    },
                    {"label": "Hệ thống tạo thêm một bài tập mới cho lớp K65-CS2", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-xoa-lop",
                "type": "true_false",
                "prompt": "Thầy/cô có thể xoá một lớp còn học viên, và học viên sẽ tự chuyển sang lớp khác.",
                "explanation": "Sai. Lớp chỉ xoá được khi không còn học viên. Thầy/cô cần dùng nút \"Chuyển lớp\" cho từng học viên trước.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "4.1-thu-tu-tao-lop",
                "type": "ordering",
                "prompt": "Sắp xếp các bước đưa một lớp học viên vào khoá học theo đúng thứ tự.",
                "explanation": "Thầy/cô tạo lớp trước để có đường dẫn mời, rồi gửi đường dẫn cho học viên. Học viên bấm \"Vào học\" ở trang lời mời, sau đó xuất hiện trong danh sách lớp.",
                "points": 2,
                "sequence": [
                    "Bấm \"Tạo lớp\" và đặt tên lớp",
                    "Gửi đường dẫn mời hoặc chiếu mã QR",
                    "Học viên bấm \"Vào học\" ở trang lời mời",
                    "Học viên xuất hiện trong danh sách lớp",
                ],
            },
        ],
    },
}

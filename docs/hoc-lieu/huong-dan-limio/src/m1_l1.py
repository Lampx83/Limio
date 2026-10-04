# -*- coding: utf-8 -*-
from mockup import *

_NAV = shot(
    "1-1-thanh-dieu-huong",
    "Thanh điều hướng bên trái và trang \"Khoá học của tôi\". Các số trên hình được giải thích ngay bên dưới.",
    need="/instructor/courses ở màn hình rộng, tài khoản Giảng viên Mẫu. Cột trái chỉ có biểu tượng; bấm biểu tượng mũ cử nhân (mục LMS) để cột thứ hai hiện Khoá học của tôi / Assignment / Forum Q&A, mục Khoá học của tôi đang được chọn. Chụp cột biểu tượng, cột thứ hai và nút tên tài khoản ở góc trên bên phải.",
    marks=["Biểu tượng mũ cử nhân (mục LMS)", "Mục Khoá học của tôi", "Tên tài khoản"],
)

_NAV_LEGEND = legend(
    [
        "**Biểu tượng mũ cử nhân (mục \"LMS\").** Cột bên trái chỉ có biểu tượng, không có chữ. Thầy/cô rê chuột vào một biểu tượng để đọc tên mục, và bấm vào để mở danh sách chức năng của mục đó. Biểu tượng đang mở được tô màu.",
        "**Mục \"Khoá học của tôi\".** Đây là cột thứ hai, hiện ra sau khi thầy/cô bấm biểu tượng mũ cử nhân. Cột này còn có \"Assignment\" (bài tập) và \"Forum Q&A\" (diễn đàn hỏi đáp). Thầy/cô dùng \"Khoá học của tôi\" nhiều nhất, vì mọi khoá học nằm ở đây.",
        "**Tên tài khoản.** Nút này nằm ở góc trên bên phải, ở đây ghi \"Giảng viên Mẫu\". Thầy/cô bấm vào tên mình để mở menu tài khoản, trong đó có mục đăng xuất.",
    ]
)

_FEATURES = fence(
    row_cards(
        card("① Dựng khoá học", "Tạo chương và bài học, chèn văn bản, video, tệp, rồi xuất bản cho học viên.", hue=TEAL, w="20rem"),
        card("② Kiểm tra và đánh giá", "Soạn bài kiểm tra cuối bài, xây ngân hàng câu hỏi, tổ chức kỳ thi.", hue=BLUE, w="20rem"),
        card("③ Phản hồi cá nhân hoá", "Chỉ cho từng học viên chỗ họ hiểu sai và gợi ý bài nên học tiếp.", hue=VIOLET, w="20rem"),
        card("④ Lớp học và số liệu", "Chia lớp, đặt hạn riêng cho từng lớp, theo dõi tiến độ và điểm.", hue=AMBER, w="20rem"),
    )
)

_CYCLE = flow(
    [
        ("Dựng khoá", "Tạo chương, bài học, nội dung"),
        ("Xuất bản và mời", "Mở khoá, gửi đường dẫn cho lớp"),
        ("Dạy và kiểm tra", "Bài kiểm tra, bài tập, thảo luận"),
        ("Xem phản hồi và số liệu", "Biết ai cần giúp, bài nào khó"),
    ]
)

LESSON = {
    "title": "Bài 1.1 · Làm quen với Limio",
    "durationMin": 4,
    "description": "Limio giúp thầy/cô làm được những việc gì, cách đọc khoá học này, và vị trí các chức năng chính trên thanh điều hướng.",
    "objectives": [
        "Kể được bốn nhóm việc thầy/cô làm với Limio",
        "Tìm được khoá học của mình trên thanh điều hướng",
        "Nói được vòng làm việc chung từ dựng khoá tới xem số liệu",
    ],
    "summary": [
        "Limio gồm bốn nhóm việc: dựng khoá học, kiểm tra và đánh giá, phản hồi cá nhân hoá, và quản lý lớp cùng số liệu.",
        "Thanh điều hướng bên trái chỉ có biểu tượng, tên mục hiện khi rê chuột; mọi khoá học của thầy/cô nằm trong \"Khoá học của tôi\", sau khi bấm biểu tượng mũ cử nhân.",
        "Một vòng làm việc đầy đủ gồm bốn bước: dựng khoá, xuất bản và mời học viên, dạy và kiểm tra, rồi xem phản hồi và số liệu.",
    ],
    "body": (
        "\n"
        + hero(
            "Khoá mẫu cho giảng viên",
            "Chào thầy/cô đến với Limio",
            "Khoá này vừa dạy thầy/cô cách dùng Limio, vừa là một ví dụ về khoá học hoàn chỉnh. "
            "Thầy/cô đang đọc một bài học thật, được dựng bằng chính các tính năng sắp được giới thiệu.",
            chips=["4 chương", "12 bài ngắn", "Có việc làm thử sau mỗi bài"],
        )
        + "\n\n## Limio giúp thầy/cô làm được gì\n\n"
        "Limio là hệ thống quản lý học tập. Thầy/cô dùng nó để đưa bài giảng lên mạng, kiểm tra học viên và theo dõi việc học của họ. "
        "Điểm riêng của Limio là **phản hồi cá nhân hoá**: hệ thống chỉ ra cho từng học viên chỗ họ đang hiểu sai, thay vì chỉ cho một con số điểm.\n\n"
        "Công việc của thầy/cô chia thành bốn nhóm. Khoá học này có một chương cho mỗi nhóm.\n\n"
        + _FEATURES
        + "\n\n> [!ghi-nho] **Thầy/cô không cần học hết một lượt.**\n"
        "> Mỗi bài đứng riêng được. Thầy/cô có thể mở ngay chương mình cần, làm xong việc nhỏ ở cuối bài rồi quay lại sau.\n\n"
        "## Cách đọc khoá học này\n\n"
        "Mỗi bài trong khoá học có cùng một khuôn. Khuôn này cũng là khuôn thầy/cô nên dùng khi dựng khoá của mình, vì nó giúp học viên biết trước mình sắp học gì và học xong thì được gì.\n\n"
        "1. **Mục tiêu** nằm ở đầu bài, cho biết thầy/cô sẽ làm được gì sau khi đọc.\n"
        "2. **Nội dung và hình** giải thích từng bước, kèm ảnh chụp giao diện.\n"
        "3. **Tổng kết** nhắc lại vài ý chính.\n"
        "4. **Thử ngay** là một việc nhỏ, làm được trong khoảng hai phút ở khoá của thầy/cô.\n"
        "5. **Câu hỏi ôn tập** giúp thầy/cô kiểm tra mình đã nắm chưa, và là ví dụ về bài kiểm tra cuối bài.\n\n"
        "> [!vi-du] **Hình trong khoá này là ảnh chụp màn hình thật.**\n"
        "> Các vòng số màu đỏ trên ảnh được đánh dấu để thầy/cô thấy rõ chỗ cần bấm. Một số nhãn trên giao diện hiện còn bằng tiếng Anh, ví dụ \"Publish\" hay \"Assignment\". Khoá này gọi các mục bằng tiếng Việt, và ghi nhãn đang hiện trong dấu ngoặc kép để thầy/cô tìm thấy.\n\n"
        "## Thanh điều hướng: nơi thầy/cô bắt đầu mọi việc\n\n"
        "Sau khi đăng nhập, thầy/cô thấy một thanh điều hướng ở bên trái màn hình. Thanh này gồm hai phần: cột biểu tượng của các mục chính, và cột thứ hai liệt kê chức năng của mục đang mở. Thanh trên cùng có logo, nút \"Đấu trường\", chuông thông báo và tên tài khoản.\n\n"
        + _NAV
        + "\n"
        + _NAV_LEGEND
        + "\n\n> [!meo] **Trên điện thoại.**\n"
        "> Khi màn hình hẹp, thanh điều hướng thu lại thành một ngăn kéo. Thầy/cô bấm biểu tượng ba gạch ở góc trên bên trái để mở ra.\n\n"
        "Bảng dưới đây liệt kê các biểu tượng từ trên xuống dưới, như thầy/cô thấy trên hình.\n\n"
        "| Biểu tượng | Tên mục | Thầy/cô dùng để |\n"
        "|---|---|---|\n"
        "| Bảng bốn ô vuông | Trang chủ | Xem việc cần xử lý gấp, hoạt động gần đây và lịch hạn nộp |\n"
        "| Mũ cử nhân | \"LMS\" (bài giảng trực tuyến) | Tạo và quản lý khoá học, bài tập, diễn đàn hỏi đáp |\n"
        "| Bảng trình chiếu | Limio-Live (dạy học trực tiếp) | Chạy hoạt động tương tác ngay trong giờ dạy, như bình chọn hay đám mây từ |\n"
        "| Người máy | Vấn đáp AI | Mở phòng vấn đáp |\n"
        "| Chữ A và dấu cộng | Kiểm tra đánh giá | Soạn ngân hàng câu hỏi, thiết kế đề thi và tổ chức thi |\n"
        "| Chiếc cúp | Đấu trường | Tổ chức cuộc thi có nhiệm vụ và bảng xếp hạng |\n"
        "| Biểu đồ cột | Phân tích và Báo cáo | Xem học viên nào đang nắm kiến thức tới đâu |\n\n"
        "## Một vòng làm việc đầy đủ\n\n"
        "Dù dạy môn gì, thầy/cô cũng đi qua bốn bước giống nhau. Các chương sau lần lượt hướng dẫn từng bước.\n\n"
        + _CYCLE
        + "\n\n"
        + try_now(
            "Tìm khoá học của chính thầy/cô",
            [
                "Bấm **biểu tượng mũ cử nhân** (mục \"LMS\") ở cột bên trái.",
                "Bấm **Khoá học của tôi** ở cột thứ hai để xem danh sách khoá.",
                "Nhìn nút xanh **+ Tạo khóa học** ở góc trên bên phải của trang. Bài 1.2 sẽ dùng nút này.",
            ],
            minutes=1,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 1.1",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "1.1-bon-nhom-viec",
                "type": "mcq",
                "prompt": "Việc nào dưới đây thuộc nhóm \"Kiểm tra và đánh giá\" trong Limio?",
                "explanation": "Soạn ngân hàng câu hỏi và tổ chức thi thuộc nhóm kiểm tra và đánh giá. Tạo chương thuộc nhóm dựng khoá, còn đặt hạn theo lớp thuộc nhóm quản lý lớp.",
                "points": 1,
                "options": [
                    {"label": "Xây ngân hàng câu hỏi và tổ chức một kỳ thi", "isCorrect": True},
                    {"label": "Tạo thêm một chương cho khoá học", "isCorrect": False},
                    {"label": "Đặt hạn nộp riêng cho từng lớp", "isCorrect": False},
                    {"label": "Xem lịch hạn nộp ở trang chủ", "isCorrect": False},
                ],
            },
            {
                "key": "1.1-tim-khoa-hoc",
                "type": "mcq",
                "prompt": "Thầy/cô muốn xem danh sách khoá học của mình. Thầy/cô bấm biểu tượng nào trên thanh điều hướng?",
                "explanation": "Mọi khoá học của giảng viên nằm trong \"Khoá học của tôi\". Mục này hiện ra ở cột thứ hai sau khi thầy/cô bấm biểu tượng mũ cử nhân (mục \"LMS\").",
                "points": 1,
                "options": [
                    {"label": "Biểu tượng mũ cử nhân, rồi \"Khoá học của tôi\"", "isCorrect": True},
                    {"label": "Biểu tượng chữ A và dấu cộng, rồi \"Bắt đầu\"", "isCorrect": False},
                    {"label": "Biểu tượng chiếc cúp, rồi \"Đấu trường của tôi\"", "isCorrect": False},
                    {"label": "Biểu tượng biểu đồ cột, rồi \"Nắm kiến thức\"", "isCorrect": False},
                ],
            },
            {
                "key": "1.1-thu-tu-vong-lam-viec",
                "type": "ordering",
                "prompt": "Sắp xếp bốn bước của một vòng làm việc đầy đủ theo đúng thứ tự.",
                "explanation": "Thầy/cô dựng khoá trước, rồi xuất bản và mời học viên, sau đó dạy và kiểm tra, cuối cùng xem phản hồi và số liệu.",
                "points": 2,
                "sequence": [
                    "Dựng khoá",
                    "Xuất bản và mời học viên",
                    "Dạy và kiểm tra",
                    "Xem phản hồi và số liệu",
                ],
            },
        ],
    },
}

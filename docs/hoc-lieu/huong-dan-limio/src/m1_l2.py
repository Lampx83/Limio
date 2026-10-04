# -*- coding: utf-8 -*-
from mockup import *

_FORM = shot(
    "1-2-bieu-mau-tao-khoa",
    "Biểu mẫu \"Tạo khóa học mới\" với các ô đã điền mẫu.",
    "Trang /instructor/courses/new, đăng nhập bằng tài khoản giảng viên. Điền sẵn: Tiêu đề \"Nhập môn Lập trình\", "
    "Mô tả vài dòng (ví dụ \"Python cho sinh viên năm nhất ngành Công nghệ thông tin\"), ô \"Level\" chọn \"Cơ bản\", Ngôn ngữ \"Tiếng Việt\", ô \"Category\" điền \"Công nghệ thông tin\", "
    "ô \"Bật cá nhân hoá học tập\" để ở trạng thái tắt, nhóm \"Ai vào được khoá này\" chọn \"Mở — ai cũng tự đăng ký được\". "
    "Chụp cả trang từ tiêu đề tới hai nút \"Hủy\" và \"Tạo và tiếp tục\".",
    [
        "Tiêu đề",
        "Mô tả",
        "Ô \"Level\" (trình độ)",
        "Ngôn ngữ",
        "Ô \"Category\" (lĩnh vực)",
        "Bật cá nhân hoá học tập",
        "Ai vào được khoá này",
        "Tạo và tiếp tục",
    ],
)

_FORM_LEGEND = legend(
    [
        "**Tiêu đề.** Ô bắt buộc (có dấu sao đỏ), dài tối đa 200 ký tự. Học viên thấy tên này đầu tiên, nên thầy/cô đặt tên nói rõ khoá dạy gì.",
        "**Mô tả.** Ô bắt buộc, có thanh công cụ định dạng phía trên (chữ đậm, chữ nghiêng, danh sách, đường dẫn, hình). Thầy/cô viết khoá này dành cho ai và học xong được gì.",
        "**Ô \"Level\" (trình độ).** Danh sách chọn, đang là \"Cơ bản\". Có ba mức: Cơ bản, Trung cấp, Nâng cao.",
        "**Ngôn ngữ.** Danh sách chọn ngôn ngữ giảng dạy của khoá: tiếng Việt hoặc tiếng Anh.",
        "**Ô \"Category\" (lĩnh vực).** Ô không bắt buộc, dùng để xếp khoá vào một nhóm, ví dụ Công nghệ thông tin hay Kinh tế.",
        "**Bật cá nhân hoá học tập.** Ô chọn, tắt theo mặc định. Ý nghĩa của ô này nằm ở mục tiếp theo.",
        "**Ai vào được khoá này.** Hai lựa chọn: \"Mở — ai cũng tự đăng ký được\" và \"Chỉ vào bằng link mời lớp\". Mục sau giải thích sự khác nhau.",
        "**Tạo và tiếp tục.** Thầy/cô bấm nút xanh này để tạo khoá. Nút \"Hủy\" bên cạnh để thoát mà không tạo gì.",
    ]
)

_AFTER = flow(
    [
        ("Tạo khoá nháp", "Khoá có trạng thái Nháp, học viên chưa thấy"),
        ("Dựng sẵn khung", "3 chương, mỗi chương 3 bài học trống"),
        ("Mở tab Nội dung", "Thầy/cô vào thẳng nơi dựng khoá"),
        ("Sửa hoặc xoá", "Thầy/cô đổi tên, bỏ bài không dùng"),
    ]
)

_ACCESS = fence(
    row_cards(
        card(
            "Mở — ai cũng tự đăng ký được",
            "Người vào trang giới thiệu khoá thấy nút đăng ký và tự ghi danh. Chỉ kiểu này mới đặt được **giá khoá học** (bài 1.4 chỉ chỗ đặt).",
            hue=TEAL,
            w="18rem",
        ),
        card(
            "Chỉ vào bằng link mời lớp",
            "Trang giới thiệu vẫn xem được nhưng không có nút đăng ký. Học viên chỉ vào được bằng đường dẫn mời của một lớp cụ thể, và vào thẳng đúng lớp đó. Hợp với lớp có danh sách cố định.",
            hue=VIOLET,
            w="18rem",
        ),
    )
)

LESSON = {
    "title": "Bài 1.2 · Tạo khoá học đầu tiên",
    "durationMin": 5,
    "description": "Thầy/cô điền biểu mẫu tạo khoá, chọn kiểu truy cập, và biết hệ thống dựng sẵn những gì ngay sau khi bấm \"Tạo và tiếp tục\".",
    "objectives": [
        "Tạo được một khoá học mới từ biểu mẫu",
        "Phân biệt được hai kiểu \"Ai vào được khoá này\"",
        "Nhận ra các chương và bài học trống mà hệ thống dựng sẵn",
    ],
    "summary": [
        "Thầy/cô tạo khoá bằng nút \"+ Tạo khoá đầu tiên\" ở trang chủ (khi chưa có khoá nào), hoặc bằng \"Khoá học của tôi\" rồi nút \"+ Tạo khóa học\".",
        "Biểu mẫu bắt buộc hai ô là tiêu đề và mô tả. Kiểu truy cập chọn giữa \"Mở\" và \"Chỉ vào bằng link mời lớp\".",
        "Sau khi tạo, hệ thống dựng sẵn ba chương, mỗi chương ba bài học trống. Các bài này vẫn nằm đó nếu thầy/cô không sửa.",
    ],
    "body": (
        "\n"
        "## Hai đường vào biểu mẫu tạo khoá\n\n"
        "Thầy/cô có hai cách để mở biểu mẫu tạo khoá.\n\n"
        "- **Nếu thầy/cô chưa có khoá nào**, trang chủ hiện nút \"+ Tạo khoá đầu tiên\". Thầy/cô bấm nút này.\n"
        "- **Nếu thầy/cô đã có khoá**, thầy/cô bấm biểu tượng mũ cử nhân (mục \"LMS\"), rồi **Khoá học của tôi**, rồi nút xanh \"+ Tạo khóa học\" ở góc trên bên phải.\n\n"
        "Cả hai cách đều dẫn tới cùng một biểu mẫu tên \"Tạo khóa học mới\". Dòng phụ dưới tiêu đề nhắc rằng khoá sẽ được khởi tạo ở dạng nháp, "
        "và thầy/cô bổ sung chương, bài học, bài kiểm tra ở bước sau.\n\n"
        "## Từng ô trong biểu mẫu\n\n"
        "Hình dưới đây là biểu mẫu với các ô đã điền mẫu. Mỗi số trên hình khớp với một dòng chú giải bên dưới. Hai ô \"Level\" và \"Category\" hiện còn ghi bằng tiếng Anh; khoá này gọi là trình độ và lĩnh vực.\n\n"
        + _FORM
        + "\n\n"
        + _FORM_LEGEND
        + "\n\n> [!meo] **Chưa cần hoàn hảo ngay.**\n"
        "> Các ô này sửa lại được ở tab Tổng quan sau khi tạo khoá. Thầy/cô cứ điền đủ rồi bấm tạo, sửa dần sau.\n\n"
        "## Ô \"Bật cá nhân hoá học tập\" nghĩa là gì\n\n"
        "Khi thầy/cô bật ô này, Limio coi **mỗi bài học là một chủ đề**. Hệ thống theo dõi học viên nắm từng chủ đề tới đâu qua các bài kiểm tra trong bài. "
        "Từ đó hệ thống nói được với từng học viên chỗ nào cần ôn lại và nên học gì tiếp theo.\n\n"
        "Thầy/cô không phải gắn chủ đề bằng tay. Hệ thống tự làm việc đó khi thầy/cô thêm bài học và câu hỏi. "
        "Nếu thầy/cô không bật ô này, khoá vẫn chạy bình thường như một khoá học thông thường, chỉ không có phản hồi riêng cho từng học viên.\n\n"
        "Bài 3.2 sẽ giải thích chi tiết. Lúc này thầy/cô chỉ cần biết rằng bật ô này không tốn thêm công sức.\n\n"
        "## Hai kiểu \"Ai vào được khoá này\"\n\n"
        "Nhóm lựa chọn này quyết định học viên bước vào khoá bằng cách nào.\n\n"
        + _ACCESS
        + "\n\n"
        "Thầy/cô có thể đổi kiểu truy cập về sau. Bài 1.4 nói kỹ cách học viên vào khoá, còn bài 4.1 nói về lớp học và đường dẫn mời.\n\n"
        "## Điều xảy ra sau khi bấm \"Tạo và tiếp tục\"\n\n"
        "Hệ thống làm bốn việc liền nhau, và mở thẳng tab **Nội dung** để thầy/cô bắt đầu dựng.\n\n"
        + _AFTER
        + "\n\n> [!canh-bao] **Các bài mẫu trống không tự biến mất.**\n"
        "> Hệ thống dựng sẵn ba chương và chín bài học trống, đặt tên theo số thứ tự. Nếu thầy/cô chỉ dùng hai bài mà không xoá các bài còn lại, "
        "chúng vẫn nằm trong khoá khi xuất bản, và học viên sẽ thấy những bài rỗng. Hệ thống không kiểm tra khoá rỗng.\n\n"
        "> [!ghi-nho] **Khoá vừa tạo đang ở trạng thái Nháp.**\n"
        "> Học viên chưa thấy khoá cho tới khi thầy/cô bấm nút xanh \"Publish\" (xuất bản). Bài 1.4 hướng dẫn bước này.\n\n"
        + try_now(
            "Tạo khoá thử của chính thầy/cô",
            [
                "Bấm **biểu tượng mũ cử nhân**, rồi **Khoá học của tôi**, rồi nút **+ Tạo khóa học** ở góc trên bên phải (hoặc **+ Tạo khoá đầu tiên** ở trang chủ).",
                "Điền ô **Tiêu đề** và ô **Mô tả**. Để các ô còn lại như mặc định nếu thầy/cô chưa chắc.",
                "Bấm **Tạo và tiếp tục**.",
                "Nhìn tab **Nội dung** vừa mở và đếm xem có bao nhiêu chương, bao nhiêu bài học trống.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 1.2",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "1.2-sau-khi-tao",
                "type": "mcq",
                "prompt": "Thầy/cô vừa bấm \"Tạo và tiếp tục\" và chỉ dùng hai bài học. Điều nào đúng về các bài mẫu còn lại?",
                "explanation": "Hệ thống dựng sẵn ba chương và chín bài học trống. Các bài này nằm lại trong khoá cho tới khi thầy/cô xoá hoặc đổi tên, kể cả khi xuất bản.",
                "points": 1,
                "options": [
                    {"label": "Chúng vẫn nằm trong khoá cho tới khi thầy/cô xoá hoặc sửa", "isCorrect": True},
                    {
                        "label": "Chúng tự biến mất khi thầy/cô xuất bản khoá",
                        "isCorrect": False,
                        "misconception": "limio.scaffold-left-behind",
                    },
                    {
                        "label": "Chúng chỉ hiện với giảng viên, học viên không bao giờ thấy",
                        "isCorrect": False,
                        "misconception": "limio.scaffold-left-behind",
                    },
                    {"label": "Hệ thống không dựng sẵn gì, khoá hoàn toàn trống", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-khoa-nhap",
                "type": "true_false",
                "prompt": "Khoá vừa tạo xong, học viên đã thấy khoá trong danh mục và vào học được ngay.",
                "explanation": "Sai. Khoá mới ở trạng thái Nháp, học viên chưa thấy cho tới khi thầy/cô bấm nút \"Publish\" (xuất bản).",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "limio.draft-visible"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.2-hai-kieu-truy-cap",
                "type": "mcq",
                "prompt": "Thầy/cô dạy lớp K65-CS1 gồm 14 học viên có danh sách cố định và chỉ muốn đúng lớp ấy vào học. Thầy/cô chọn kiểu nào?",
                "explanation": "Kiểu \"Chỉ vào bằng link mời lớp\" cho phép học viên vào qua đường dẫn mời của lớp. Kiểu \"Mở\" để ai cũng tự đăng ký được.",
                "points": 1,
                "options": [
                    {"label": "Chỉ vào bằng link mời lớp", "isCorrect": True},
                    {"label": "Mở — ai cũng tự đăng ký được", "isCorrect": False},
                    {"label": "Bật cá nhân hoá học tập", "isCorrect": False},
                    {"label": "Đặt trình độ là Nâng cao", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-thu-tu-tao-khoa",
                "type": "ordering",
                "prompt": "Sắp xếp các việc sau theo đúng thứ tự khi tạo khoá đầu tiên.",
                "explanation": "Thầy/cô mở biểu mẫu, điền tiêu đề và mô tả, bấm Tạo và tiếp tục, rồi hệ thống mở tab Nội dung với khung chương và bài học dựng sẵn.",
                "points": 2,
                "sequence": [
                    "Mở biểu mẫu \"Tạo khóa học mới\"",
                    "Điền tiêu đề và mô tả",
                    "Bấm \"Tạo và tiếp tục\"",
                    "Hệ thống mở tab Nội dung với khung dựng sẵn",
                ],
            },
        ],
    },
}

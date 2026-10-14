# -*- coding: utf-8 -*-
from mockup import *

_FLOW_BA_BUOC = flow(
    [
        ("Ngân hàng câu hỏi", "Soạn hoặc nhập câu hỏi một lần"),
        ("Thiết kế đề thi", "Gom câu hỏi thành một đề"),
        ("Tổ chức thi", "Chọn đề, giờ thi và người vào thi"),
    ]
)

_SHOT_BAT_DAU = shot(
    "2-2-trang-bat-dau",
    "Hình minh hoạ: trang \"Kiểm tra đánh giá\" với ba bước theo thứ tự.",
    "Trang /instructor/assessment (menu Kiểm tra đánh giá, mục Bắt đầu) của giảng viên mẫu (khoá \"Nhập môn Lập trình\"), có ngân hàng \"Nhập môn Lập trình – giữa kỳ\" nhưng chưa có đề thi nào, "
    "để Bước 1 hiện nhãn \"Đã xong\", Bước 2 hiện \"Làm tiếp bước này\" kèm nút \"Tạo đề thi →\", Bước 3 hiện \"Chưa tới bước này\". Chụp tiêu đề, dòng giới thiệu và cả ba thẻ Bước 1, Bước 2, Bước 3.",
    marks=["Nhãn Đã xong", "Nhãn Làm tiếp bước này", "Nút Tạo đề thi", "Nhãn Chưa tới bước này"],
)

_LEGEND_BAT_DAU = legend(
    [
        "**Bước 1, nhãn \"Đã xong\".** Thầy/cô đã có ngân hàng câu hỏi. Dòng nhỏ phía dưới cho biết số ngân hàng và số câu đã xuất bản (trên ảnh còn ghi \"publish\").",
        "**Bước 2, nhãn \"Làm tiếp bước này\".** Đây là bước thầy/cô nên làm kế tiếp. Thẻ của bước này được viền màu xanh để nổi bật.",
        "**Nút \"Tạo đề thi →\".** Thầy/cô bấm để mở đúng trang của bước 2. Thẻ nào cũng có nút riêng ở bên phải.",
        "**Bước 3, nhãn \"Chưa tới bước này\".** Thầy/cô cần có đề thi trước, rồi mới tổ chức thi.",
    ]
)

_SHOT_BANG = shot(
    "2-2-bang-ngan-hang-cau-hoi",
    "Hình minh hoạ: bảng câu hỏi trong một ngân hàng, với các cột và nhãn thẩm định.",
    "Trang /instructor/question-banks/{id} của ngân hàng \"Nhập môn Lập trình – giữa kỳ\" (nhãn Riêng tư) có 8 câu hỏi nhiều loại, nhãn Thẩm định gồm Chưa thẩm định và Cần sửa (nên có thêm ít nhất một câu Đã duyệt), "
    "trạng thái Nháp và Đã publish. Chụp phần đầu trang có ba nút (AI import, Excel import, + Nhập thủ công), hàng bộ lọc "
    "và hàng tiêu đề cột cùng các dòng câu hỏi.",
    marks=["Nút Nhập thủ công", "Cột Trạng thái", "Cột Thẩm định"],
)

_LEGEND_BANG = legend(
    [
        "**Nút thêm câu hỏi.** Vòng số trỏ vào nút \"+ Nhập thủ công\". Bên cạnh nó là hai nút nhập bằng AI (ghi \"AI import\") và nhập từ Excel (ghi \"Excel import\").",
        "**Cột Trạng thái.** Cho biết câu đang ở dạng nháp (nhãn \"Nháp\"), đã xuất bản (nhãn \"Đã publish\") hay đã lưu trữ.",
        "**Cột Thẩm định.** Cho biết câu \"Chưa thẩm định\", \"Đã duyệt\" hay \"Cần sửa\". Đây là cột khác với cột Trạng thái.",
    ]
)

LESSON = {
    "title": "Bài 2.2 · Ngân hàng câu hỏi",
    "durationMin": 5,
    "description": "Vì sao Limio có hai nơi soạn câu hỏi, khi nào dùng ngân hàng câu hỏi, cách tạo ngân hàng và đọc bảng câu hỏi.",
    "objectives": [
        "Phân biệt được bài kiểm tra trong bài học với ngân hàng câu hỏi và đề thi",
        "Tạo được một ngân hàng câu hỏi và chọn đúng phạm vi riêng tư hay chia sẻ",
        "Đọc được các cột của bảng câu hỏi, nhất là cột Trạng thái và cột Thẩm định",
    ],
    "summary": [
        "Limio có hai kho câu hỏi riêng. Bài kiểm tra trong bài học dùng để ôn tập; ngân hàng câu hỏi và đề thi dùng cho kỳ thi. Hai kho không tự chia sẻ câu hỏi cho nhau.",
        "Thầy/cô tạo ngân hàng bằng cách đặt tên và chọn phạm vi: riêng tư, hoặc chia sẻ cho đồng giảng viên của một khoá.",
        "Mỗi câu có hai nhãn khác nhau: Trạng thái (nháp, đã xuất bản, lưu trữ) và Thẩm định (chưa thẩm định, đã duyệt, cần sửa).",
    ],
    "body": (
        "\n"
        "## Vì sao Limio có hai nơi soạn câu hỏi\n\n"
        "Thầy/cô vừa học ở Bài 2.1 cách soạn bài kiểm tra ngay trong bài học. Limio còn có một nơi khác để soạn câu hỏi, gọi là **ngân hàng câu hỏi**. "
        "Hai nơi này phục vụ hai việc khác nhau, nên được tách riêng.\n\n"
        "- **Bài kiểm tra trong bài học** giúp học viên ôn ngay sau khi học. Nó gắn với một bài học cụ thể.\n"
        "- **Ngân hàng câu hỏi** là kho câu hỏi thầy/cô soạn một lần rồi dùng lại cho nhiều đề thi và nhiều kỳ thi.\n\n"
        "> [!canh-bao] **Hai kho không tự chia sẻ câu hỏi.**\n"
        "> Câu soạn trong bài kiểm tra của bài học không tự có trong ngân hàng. Câu trong ngân hàng cũng không tự hiện ở bài kiểm tra của bài học. "
        "Muốn dùng lại, thầy/cô phải soạn hoặc nhập lại ở kho kia.\n\n"
        "## Khi nào dùng hệ thống nào\n\n"
        "Thầy/cô hãy hỏi mình một câu: câu hỏi này để học viên ôn bài, hay để thi?\n\n"
        "| | Bài kiểm tra trong bài học | Ngân hàng câu hỏi và đề thi |\n"
        "|---|---|---|\n"
        "| Mục đích | Ôn tập, nuôi phản hồi cá nhân hoá | Kiểm tra đánh giá, tổ chức kỳ thi |\n"
        "| Câu hỏi nằm ở | Trong từng bài học của khoá | Trong ngân hàng, dùng chung cho nhiều đề |\n"
        "| Học viên làm khi nào | Ngay sau khi học bài | Trong ca thi do thầy/cô tổ chức |\n"
        "| Ví dụ trong dạy học | Mười câu cuối bài \"Vòng lặp for\" | Đề giữa kỳ môn Nhập môn Lập trình cho ba lớp K65-CS1, K65-CS2, K65-CS3 |\n\n"
        "## Trang Bắt đầu: ba bước theo thứ tự\n\n"
        "Menu Kiểm tra đánh giá có bốn mục: Bắt đầu, Ngân hàng câu hỏi, Thiết kế đề thi và Tổ chức thi. "
        "Nếu thầy/cô chưa biết đi từ đâu, hãy mở trang **Bắt đầu**. Trang này chia việc thành ba bước và cho biết thầy/cô đã xong bước nào. "
        "Mỗi bước có một dòng giải thích và một dòng số liệu nhỏ, ví dụ số đề đã xuất bản và số đề nháp.\n\n"
        + _FLOW_BA_BUOC
        + "\n\n"
        + _SHOT_BAT_DAU
        + "\n\n"
        + _LEGEND_BAT_DAU
        + "\n\n"
        "Bước 1 có thể bỏ qua. Nếu thầy/cô chỉ cần một đề dùng một lần, thầy/cô soạn câu hỏi thẳng trong đề thi mà không cần ngân hàng.\n\n"
        "## Tạo ngân hàng và thêm câu hỏi\n\n"
        "Thầy/cô vào mục Ngân hàng câu hỏi và bấm **\"+ Tạo ngân hàng mới\"**. Biểu mẫu có hai ô.\n\n"
        "1. **Tên ngân hàng.** Nên đặt theo môn hoặc chủ đề, ví dụ \"Nhập môn Lập trình – giữa kỳ\".\n"
        "2. **Phạm vi.** Chọn \"Riêng tư\" nếu chỉ mình thầy/cô dùng. Hoặc chọn một khoá để chia sẻ cho các đồng giảng viên của khoá đó.\n\n"
        "Sau khi tạo, thầy/cô mở ngân hàng. Đầu trang là tên ngân hàng cùng nhãn phạm vi (ví dụ \"Riêng tư\"), số câu và một ngày. "
        "Để thêm câu hỏi có ba cách, giống như ở bài kiểm tra trong bài học:\n\n"
        "- **Nhập bằng AI:** thầy/cô dán chữ từ Word hay PDF, AI định dạng lại, thầy/cô xem trước rồi xác nhận.\n"
        "- **Nhập từ Excel:** thầy/cô tải tệp .xlsx điền sẵn theo mẫu lên.\n"
        "- **Nhập thủ công:** thầy/cô soạn từng câu bằng biểu mẫu.\n\n"
        "Ngân hàng có mười loại câu hỏi: trắc nghiệm một đáp án, trắc nghiệm nhiều đáp án, đúng/sai, điền khuyết, trả lời ngắn, tự luận, "
        "sắp xếp thứ tự, ghép cặp, điền số và kéo thả.\n\n"
        "## Đọc bảng câu hỏi\n\n"
        "Câu hỏi trong ngân hàng hiện thành một bảng. Mỗi dòng là một câu, bấm vào dòng để mở và sửa. "
        "Phía trên bảng là ô \"Tìm câu hỏi…\" và các bộ lọc: Trạng thái, Thẩm định, Tư duy, Độ khó, Chủ đề.\n\n"
        + _SHOT_BANG
        + "\n\n"
        + _LEGEND_BANG
        + "\n\n"
        "| Cột | Cho biết |\n"
        "|---|---|\n"
        "| Mã câu | Mã ngắn để gọi tên câu hỏi, ví dụ NMLT-08 |\n"
        "| Câu hỏi | Nội dung câu hỏi |\n"
        "| Chủ đề | Chủ đề của câu hỏi, ví dụ \"Vòng lặp for\" |\n"
        "| Loại | Loại câu: trắc nghiệm, đúng/sai, tự luận… |\n"
        "| Trạng thái | Nháp, đã xuất bản hoặc lưu trữ |\n"
        "| Thẩm định | Chưa thẩm định, đã duyệt hoặc cần sửa |\n"
        "| Tư duy | Mức tư duy mà câu hỏi đòi hỏi, ví dụ \"Nhớ & Hiểu\", \"Vận dụng\" |\n"
        "| Độ khó | Mức khó của câu, hiện bằng các chấm màu |\n"
        "| Cập nhật | Lần sửa gần nhất |\n"
        "| Đợt thi | Mã các đợt thi đã dùng câu này |\n\n"
        "> [!meo] **Làm việc với nhiều câu một lúc.**\n"
        "> Thầy/cô có thể chọn nhiều dòng rồi xuất bản hoặc lưu trữ cùng lúc, thay vì làm từng câu. Ô tìm và các bộ lọc giúp thầy/cô thu hẹp bảng trước khi chọn.\n\n"
        "Cột Trạng thái và cột Thẩm định dễ bị nhầm. **Trạng thái** nói về vòng đời của câu hỏi trong kho. **Thẩm định** nói về việc câu hỏi đã được xem xét kỹ chưa. "
        "Một câu có thể đã xuất bản nhưng vẫn ở nhãn \"Chưa thẩm định\", như dòng dưới cùng trên ảnh.\n\n"
        + try_now(
            "Tạo một ngân hàng câu hỏi nhỏ",
            [
                "Trên thanh điều hướng, bấm **Kiểm tra đánh giá**, rồi bấm **Bắt đầu** để xem ba bước.",
                "Bấm **Ngân hàng câu hỏi**, rồi bấm **+ Tạo ngân hàng mới**.",
                "Gõ **Tên ngân hàng**, giữ phạm vi là Riêng tư, rồi bấm **Tạo**.",
                "Mở ngân hàng vừa tạo, bấm **+ Nhập thủ công** và soạn một câu trắc nghiệm đầu tiên.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 2.2",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "2.2-dung-lai-cau-hoi",
                "type": "mcq",
                "prompt": "Thầy/cô đã soạn 20 câu trong bài kiểm tra của một bài học và muốn dùng lại cho đề thi giữa kỳ. Thầy/cô cần làm gì?",
                "explanation": "Bài kiểm tra trong bài học và ngân hàng câu hỏi là hai kho riêng, không tự chia sẻ câu hỏi. Thầy/cô cần soạn hoặc nhập lại các câu đó vào ngân hàng câu hỏi hoặc vào đề thi.",
                "points": 1,
                "options": [
                    {"label": "Soạn hoặc nhập lại các câu đó vào ngân hàng câu hỏi", "isCorrect": True},
                    {
                        "label": "Không cần làm gì, vì câu hỏi đã tự nằm trong ngân hàng",
                        "isCorrect": False,
                        "misconception": "limio.two-assessment-systems",
                    },
                    {
                        "label": "Xuất bản bài học để câu hỏi tự chuyển sang ngân hàng",
                        "isCorrect": False,
                        "misconception": "limio.two-assessment-systems",
                    },
                    {"label": "Xoá bài kiểm tra rồi tạo lại khoá học", "isCorrect": False},
                ],
            },
            {
                "key": "2.2-pham-vi-rieng-tu",
                "type": "true_false",
                "prompt": "Đúng hay sai: ngân hàng đặt phạm vi \"Riêng tư\" thì các đồng giảng viên cùng khoá vẫn thấy được.",
                "explanation": "Sai. Phạm vi \"Riêng tư\" chỉ mình thầy/cô dùng. Muốn đồng giảng viên thấy, thầy/cô chọn chia sẻ cho một khoá.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "2.2-cach-them-cau",
                "type": "matching",
                "prompt": "Nối mỗi tình huống với cách thêm câu hỏi phù hợp nhất.",
                "explanation": "Đề đã có trong tệp Word thì dán cho AI định dạng. Bảng nhiều câu theo mẫu thì nhập từ Excel. Một câu mới cần soạn kỹ thì nhập thủ công.",
                "points": 3,
                "pairs": [
                    {"left": "Đề đã soạn sẵn trong một tệp Word", "right": "Nhập bằng AI"},
                    {"left": "Một bảng 300 câu trắc nghiệm theo mẫu", "right": "Nhập từ Excel"},
                    {"left": "Một câu tự luận mới nghĩ ra", "right": "Nhập thủ công"},
                ],
            },
            {
                "key": "2.2-cot-tham-dinh",
                "type": "mcq",
                "prompt": "Cột nào trong bảng câu hỏi cho biết câu đã được duyệt, chưa thẩm định hay cần sửa?",
                "explanation": "Cột Thẩm định có ba nhãn: Chưa thẩm định, Đã duyệt và Cần sửa. Cột Trạng thái nói câu đang là nháp, đã xuất bản hay lưu trữ.",
                "points": 1,
                "options": [
                    {"label": "Cột Thẩm định", "isCorrect": True},
                    {"label": "Cột Trạng thái", "isCorrect": False},
                    {"label": "Cột Tư duy", "isCorrect": False},
                    {"label": "Cột Đợt thi", "isCorrect": False},
                ],
            },
        ],
    },
}

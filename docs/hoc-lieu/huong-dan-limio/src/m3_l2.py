# -*- coding: utf-8 -*-
from mockup import *

# ── Sơ đồ khái niệm: cùng điểm 7, hai chỗ hổng khác nhau ───────────────────────
_SAME_SCORE = fence(
    row_cards(
        card(
            "An · 7 điểm",
            "Làm đúng các câu về cú pháp vòng lặp for. **Sai hai câu** vì nghĩ chỉ số đếm bắt đầu từ 1, nên cho rằng range(3) in ra 1, 2, 3.",
            hue=BLUE,
            w="18rem",
        ),
        card(
            "Bình · 7 điểm",
            "Làm đúng các câu về cú pháp vòng lặp for. **Sai hai câu** vì nghĩ range gồm cả giá trị cuối, nên cho rằng range(3) in ra 0, 1, 2, 3.",
            hue=AMBER,
            w="18rem",
        ),
    )
)

# ── Sơ đồ khái niệm: ba nhãn mức thành thạo ────────────────────────────────────
_LEVELS = fence(
    row_cards(
        card("Cần ôn", "Mức nắm **dưới 60%**.", hue=AMBER, w="11rem"),
        card("Nên luyện thêm", "Mức nắm **từ 60% tới dưới 85%**.", hue=BLUE, w="11rem"),
        card("Vững", "Mức nắm **từ 85% trở lên**.", hue=GREEN, w="11rem"),
        card("Chưa có dữ liệu", "Học viên chưa làm câu hỏi nào của chủ đề này.", hue=GRAY, w="11rem"),
    )
)

# ── Ảnh 1: biểu mẫu câu hỏi có quan niệm sai ───────────────────────────────────
_QUESTION = shot(
    "3-2-gan-quan-niem-sai",
    "Hình minh hoạ: các đáp án của một câu trắc nghiệm, mỗi đáp án sai có một ô chọn quan niệm sai ở góc phải.",
    "Trong trình soạn bài kiểm tra \"Kiểm tra: Vòng lặp for\" của khoá \"Nhập môn Lập trình\" (đã bật \"cá nhân hoá học tập\"), mở biểu mẫu sửa câu "
    "trắc nghiệm \"Đoạn mã for i in range(3): print(i) in ra những số nào?\". Chụp phần bốn đáp án: Đáp án 1 \"0, 1, 2\" (đúng, có dấu tích), "
    "Đáp án 2 \"1, 2, 3\" gắn mã py.index_from_1, Đáp án 3 \"0, 1, 2, 3\" gắn mã py.range_inclusive, Đáp án 4 \"Báo lỗi\" để \"Không gắn quan niệm sai\".",
    ["Đáp án đúng (có dấu tích)", "Ô chọn quan niệm sai của Đáp án 2", "Ô chọn quan niệm sai của Đáp án 3"],
)

_QUESTION_LEGEND = legend(
    [
        "**Đáp án đúng.** \"Đáp án 1\" (0, 1, 2) có dấu tích ở ô đầu dòng. Đáp án đúng không có ô chọn quan niệm sai.",
        "**Ô chọn quan niệm sai của \"Đáp án 2\".** Đáp án sai \"1, 2, 3\" đang gắn mã \"py.index_from_1\", tức là hiểu nhầm rằng chỉ số đếm bắt đầu từ 1. Giao diện hiện mã, không hiện tên tiếng Việt của quan niệm sai.",
        "**Ô chọn quan niệm sai của \"Đáp án 3\".** Đáp án sai \"0, 1, 2, 3\" gắn mã \"py.range_inclusive\", tức là hiểu nhầm rằng range gồm cả giá trị cuối.",
    ]
)

# ── Ảnh 2: màn Lộ trình của học viên ───────────────────────────────────────────
_PATH = shot(
    "3-2-lo-trinh-cua-hoc-vien",
    "Hình minh hoạ: phần \"Lộ trình của bạn\" trên trang khoá học, nhìn từ phía học viên.",
    "Đăng nhập bằng học viên mẫu sv.demo.01@feedbackme.dev của khoá \"Nhập môn Lập trình\" (đã bật \"cá nhân hoá học tập\"), mở trang khoá học "
    "(/learn/nhap-mon-lap-trinh). Chụp phần \"Lộ trình của bạn\" với bốn bước: Ôn lại trước khi học tiếp (Các kiểu dữ liệu cơ bản, nhãn Cần ôn), "
    "Bài tiếp theo (Định nghĩa và gọi hàm, chưa có nhãn), Luyện thêm cho chắc (Câu lệnh if, Nên luyện thêm), Luyện thêm cho chắc (Vòng lặp for, Nên luyện thêm). "
    "Màn hình không có phần trăm.",
    ["Bước Ôn lại trước khi học tiếp", "Nhãn Cần ôn", "Nhãn Nên luyện thêm"],
)

_PATH_LEGEND = legend(
    [
        "**Bước \"Ôn lại trước khi học tiếp\".** Mỗi bước có số thứ tự, tên bước, tên bài và tên chủ đề của bài đó. Ở đây bước đầu là bài \"Các kiểu dữ liệu cơ bản\". Mỗi học viên thấy những bước khác nhau, tuỳ kết quả của riêng mình.",
        "**Nhãn \"Cần ôn\".** Nhãn này cho biết mức nắm chủ đề của bước đó còn thấp. Học viên chỉ thấy chữ, không thấy con số phần trăm.",
        "**Nhãn \"Nên luyện thêm\".** Nhãn này xuất hiện ở cả hai bước \"Luyện thêm cho chắc\" (bài \"Câu lệnh if\" và bài \"Vòng lặp for\"). Bước \"Bài tiếp theo\" trong hình chưa có nhãn nào.",
    ]
)

LESSON = {
    "title": "Bài 3.2 · Phản hồi cá nhân hoá và lộ trình học",
    "durationMin": 6,
    "description": "Hiểu vì sao Limio chỉ ra chỗ hổng riêng của từng học viên, cách bật tính năng này gần như không tốn công, và nơi thầy/cô xem kết quả.",
    "objectives": [
        "Giải thích được vì sao cùng một điểm số vẫn cần phản hồi khác nhau",
        "Bật được cá nhân hoá học tập và gắn quan niệm sai vào phương án sai của câu hỏi",
        "Phân biệt được điều học viên thấy (nhãn) với điều giảng viên thấy (phần trăm)",
    ],
    "summary": [
        "Khi bật cá nhân hoá học tập, mỗi bài học tự thành một chủ đề và câu hỏi thừa hưởng chủ đề của bài, nên thầy/cô không phải gắn tay.",
        "Gắn quan niệm sai vào phương án sai giúp hệ thống nói đúng học viên đang hiểu nhầm chỗ nào.",
        "Học viên chỉ thấy ba nhãn Cần ôn, Nên luyện thêm, Vững; thầy/cô thấy phần trăm ở trang \"Nắm kiến thức\" và \"Học viên cần hỗ trợ\".",
    ],
    "body": (
        "\n"
        "Phần lớn hệ thống quản lý học tập chỉ trả về một con số điểm. Limio làm thêm một việc: chỉ ra học viên đang hụt kiến thức ở chỗ nào. "
        "Đó là điểm khác biệt lớn nhất của Limio, và bài này giải thích cách nó hoạt động.\n\n"
        "## Vì sao cùng điểm 7 vẫn cần phản hồi khác nhau\n\n"
        "Thầy/cô dạy môn Nhập môn Lập trình, bài \"Vòng lặp for\". Bài kiểm tra có 10 câu. Hai học viên An và Bình cùng được 7 điểm.\n\n"
        + _SAME_SCORE
        + "\n\n"
        "Nếu chỉ nhìn con số 7, thầy/cô sẽ nhắc cả hai học viên ôn lại cả bài. Nhưng An cần ôn quy ước đếm từ 0, còn Bình cần ôn việc range dừng trước giá trị cuối. "
        "Nhắc chung chung thì mỗi học viên phí một nửa thời gian vào chỗ mình đã vững.\n\n"
        "Limio giúp thầy/cô nhìn thấy sự khác nhau đó mà không phải chấm lại từng bài. Hệ thống làm được vậy nhờ hai thứ: "
        "**chủ đề** (câu hỏi này thuộc kiến thức nào) và **quan niệm sai** (học viên chọn đáp án này vì hiểu nhầm điều gì).\n\n"
        "## Bật cá nhân hoá: mỗi bài học tự thành một chủ đề\n\n"
        "Thầy/cô tích ô **Bật cá nhân hoá học tập** ở biểu mẫu tạo khoá, hoặc ở tab **Tổng quan** của khoá có sẵn, rồi bấm **Lưu và tiếp tục**. "
        "Sau đó hệ thống tự làm ba việc.\n\n"
        "1. Mỗi **bài học** trở thành một **chủ đề**, mang tên của bài đó.\n"
        "2. Mỗi **câu hỏi** trong bài kiểm tra của bài học thừa hưởng chủ đề của bài.\n"
        "3. Khi thầy/cô xuất bản khoá, hệ thống gắn chủ đề cho các bài học.\n\n"
        "Như vậy thầy/cô **không phải gắn chủ đề bằng tay**. Muốn kiểm tra, thầy/cô nhìn lên thanh trên cùng của một bài học: "
        "ở đó có nhãn \"n chủ đề\" hoặc \"chưa có chủ đề\".\n\n"
        "> [!ghi-nho] **Chủ đề tự gắn không cản chủ đề thầy/cô gắn.**\n"
        "> Nếu một bài dài và thầy/cô muốn chia mịn hơn, thầy/cô bấm nhãn chủ đề ở thanh trên của bài để chọn chủ đề có sẵn hoặc tạo chủ đề mới. "
        "Chủ đề thầy/cô gắn tay luôn được ưu tiên hơn chủ đề tự sinh.\n\n"
        "> [!canh-bao] **Bài kiểm tra độc lập không được gắn tự động.**\n"
        "> Bài kiểm tra không thuộc bài học nào thì không có bài để thừa hưởng chủ đề. Thầy/cô cần đặt bài kiểm tra vào trong một bài học, hoặc gắn chủ đề bằng tay.\n\n"
        "Chỉ bài kiểm tra trong bài học mới nuôi phần này. Câu hỏi của ngân hàng câu hỏi và đề thi thuộc hệ thống khác, như Chương 2 đã nói.\n\n"
        "## Gắn quan niệm sai vào phương án sai\n\n"
        "Chủ đề cho hệ thống biết học viên yếu ở bài nào. **Quan niệm sai** (còn gọi là lỗi tư duy) cho biết học viên yếu vì hiểu nhầm điều gì. "
        "Thầy/cô gắn quan niệm sai vào **phương án sai** của câu hỏi, không gắn vào phương án đúng.\n\n"
        + _QUESTION
        + "\n\n"
        + _QUESTION_LEGEND
        + "\n\n"
        "Mỗi đáp án sai có một ô chọn ở góc phải. Đáp án nào thầy/cô chưa gắn thì ô ghi \"Không gắn quan niệm sai\", như \"Đáp án 4\" (Báo lỗi) trong hình. "
        "Vì giao diện hiện mã nên thầy/cô cần biết mã nào ứng với hiểu nhầm nào. Khi danh sách chưa có quan niệm cần dùng, thầy/cô bấm nút \"+ Tạo quan niệm sai mới\" trong biểu mẫu câu hỏi.\n\n"
        "Trong ví dụ trên, học viên chọn \"1, 2, 3\" thì hệ thống nhận ra học viên đó đang nghĩ chỉ số đếm bắt đầu từ 1, chứ không chỉ biết là học viên đó làm sai. Còn học viên chọn \"0, 1, 2, 3\" thì đang nghĩ range gồm cả giá trị cuối.\n\n"
        "> [!meo] **Bắt đầu từ những lỗi thầy/cô gặp nhiều nhất.**\n"
        "> Việc gắn quan niệm sai là không bắt buộc. Thầy/cô chỉ cần gắn cho vài phương án sai mà năm nào học viên cũng chọn nhầm.\n\n"
        "## Học viên thấy gì: chỉ nhãn, không có phần trăm\n\n"
        "Bên trong, hệ thống ước lượng mức nắm của mỗi học viên ở mỗi chủ đề bằng một con số phần trăm. "
        "Nhưng học viên **không thấy con số đó**. Họ chỉ thấy một nhãn bằng chữ, như bốn nhãn dưới đây.\n\n"
        + _LEVELS
        + "\n\n"
        "Lý do là một con số như 58% rất dễ bị đọc như lời kết luận về năng lực của cả con người. Một nhãn như \"Cần ôn\" thì chỉ là một việc nên làm tiếp.\n\n"
        "Dựa trên kết quả này, trang khoá học của học viên có phần \"Lộ trình của bạn\", kèm dòng giải thích rằng đây chỉ là gợi ý dựa trên kết quả làm bài và học viên vẫn có thể học bất kỳ bài nào. "
        "Các bước gợi ý gồm \"Ôn lại trước khi học tiếp\", \"Bài tiếp theo\", \"Luyện thêm cho chắc\" và \"Có thể lướt qua\" (bước cuối không xuất hiện trong hình). "
        "Ở một bài học, học viên cũng có thể thấy dòng \"Bạn có thể bỏ qua bài này\". Đây là chữ học viên thấy trên giao diện, nên nó vẫn xưng \"bạn\".\n\n"
        + _PATH
        + "\n\n"
        + _PATH_LEGEND
        + "\n\n"
        "> [!ghi-nho] **Thầy/cô thấy phần trăm, học viên thì không.**\n"
        "> Nếu học viên hỏi \"em được bao nhiêu phần trăm\", thầy/cô biết con số nhưng nên trả lời bằng việc nên làm tiếp, giống cách Limio làm.\n\n"
        "## Thầy/cô xem kết quả ở đâu\n\n"
        "Có hai nơi, và cả hai đều hiện phần trăm.\n\n"
        "- **Nắm kiến thức.** Thầy/cô vào mục **Phân tích và Báo cáo**, chọn **Nắm kiến thức**. Trang này có các thẻ số về học viên, chủ đề, "
        "mức nắm trung bình và số học viên có chủ đề yếu. Bên dưới là \"Ma trận học viên × chủ đề\" cho thấy từng học viên ở từng chủ đề, "
        "và \"Độ phủ theo chủ đề\".\n"
        "- **Học viên cần hỗ trợ.** Thầy/cô mở tab **Học viên** của khoá và bấm vào liên kết dẫn tới trang này. Bảng ở đây có các cột "
        "\"Lỗi tư duy chưa khắc phục\", \"Kỹ năng yếu\" và \"Hoạt động gần nhất\". Đây là danh sách thầy/cô nên liên hệ trước.\n\n"
        "Học viên chưa làm câu hỏi nào của một chủ đề thì chưa có dữ liệu, và hệ thống không đoán thay.\n\n"
        + try_now(
            "Bật cá nhân hoá và xem các chủ đề",
            [
                "Mở một khoá của thầy/cô, vào tab **Tổng quan**, tích ô **Bật cá nhân hoá học tập**, rồi bấm **Lưu và tiếp tục**.",
                "Vào tab **Nội dung**, mở một bài học và nhìn thanh trên cùng để thấy nhãn chủ đề của bài.",
                "Bấm **Phân tích và Báo cáo** trên thanh điều hướng, rồi bấm **Nắm kiến thức** để xem trang tổng hợp của khoá.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 3.2",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "3.2-tu-gan-chu-de",
                "type": "mcq",
                "prompt": "Thầy/cô vừa bật cá nhân hoá học tập cho khoá. Để mỗi bài học có một chủ đề, thầy/cô cần làm gì thêm?",
                "explanation": "Hệ thống tự biến mỗi bài học thành một chủ đề, và câu hỏi trong bài thừa hưởng chủ đề đó. Thầy/cô chỉ gắn thêm khi muốn chia mịn hơn.",
                "points": 1,
                "options": [
                    {"label": "Không cần làm gì thêm", "isCorrect": True},
                    {
                        "label": "Gắn chủ đề bằng tay cho từng bài học",
                        "isCorrect": False,
                        "misconception": "limio.tags-by-hand",
                    },
                    {
                        "label": "Gắn chủ đề bằng tay cho từng câu hỏi",
                        "isCorrect": False,
                        "misconception": "limio.tags-by-hand",
                    },
                    {"label": "Nhập danh sách chủ đề từ tệp Excel", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-hoc-vien-thay-gi",
                "type": "mcq",
                "prompt": "Hệ thống ước lượng một học viên nắm 72% ở một chủ đề. Học viên đó thấy gì trên giao diện?",
                "explanation": "Học viên chỉ thấy nhãn, không thấy phần trăm. Mức từ 60% tới dưới 85% mang nhãn \"Nên luyện thêm\".",
                "points": 1,
                "options": [
                    {"label": "Nhãn \"Nên luyện thêm\"", "isCorrect": True},
                    {
                        "label": "Con số 72%",
                        "isCorrect": False,
                        "misconception": "limio.student-sees-percent",
                    },
                    {"label": "Nhãn \"Cần ôn\"", "isCorrect": False},
                    {"label": "Nhãn \"Vững\"", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-ghep-nhan",
                "type": "matching",
                "prompt": "Ghép mức nắm kiến thức của học viên với nhãn học viên sẽ thấy.",
                "explanation": "Dưới 60% là \"Cần ôn\", từ 60% tới dưới 85% là \"Nên luyện thêm\", từ 85% trở lên là \"Vững\". Chủ đề chưa có câu trả lời nào thì \"Chưa có dữ liệu\".",
                "points": 3,
                "pairs": [
                    {"left": "Mức nắm 45%", "right": "Cần ôn"},
                    {"left": "Mức nắm 72%", "right": "Nên luyện thêm"},
                    {"left": "Mức nắm 90%", "right": "Vững"},
                    {"left": "Chưa làm câu hỏi nào của chủ đề", "right": "Chưa có dữ liệu"},
                ],
            },
            {
                "key": "3.2-quiz-doc-lap",
                "type": "true_false",
                "prompt": "Một bài kiểm tra độc lập, không đặt trong bài học nào, vẫn tự nhận chủ đề từ cá nhân hoá học tập.",
                "explanation": "Chủ đề tự gắn đến từ bài học. Bài kiểm tra độc lập không có bài để thừa hưởng nên không được gắn tự động; thầy/cô cần gắn tay hoặc đặt nó vào một bài học.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
        ],
    },
}

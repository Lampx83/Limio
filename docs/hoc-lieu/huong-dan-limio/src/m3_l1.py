# -*- coding: utf-8 -*-
from mockup import *

# ── Hình 1: màn hình Bài tập (hai tab + bốn thẻ số) ────────────────────────────
_LIST = shot(
    "3-1-man-hinh-bai-tap",
    "Hình minh hoạ: màn hình quản lý bài tập của giảng viên, có bốn thẻ số, hai tab và danh sách khoá học.",
    "Trang /instructor/assignments (thanh điều hướng: Bài giảng trực tuyến > Bài tập), đăng nhập bằng giảng viên mẫu có khoá \"Nhập môn Lập trình\" "
    "(2 bài tập: 8 + 6 bài chờ chấm, 12 bài đã chấm, 1 bài tập quá hạn; các thẻ số là 2 / 14 / 12 / 1). Để tab \"Danh sách assignment\" đang mở. "
    "Chụp thấy tiêu đề, bốn thẻ số, hai tab (tab Cần chấm có chấm số 14) và mục \"Chọn khoá học\".",
    ["Tab Danh sách bài tập", "Thẻ Đang chờ chấm", "Tab Cần chấm"],
)

_LIST_LEGEND = legend(
    [
        "**Tab \"Danh sách bài tập\"** (trên giao diện ghi \"Danh sách assignment\"). Tab này đang mở. Bên dưới là mục \"Chọn khoá học\" với một thẻ cho từng khoá, ghi số bài học, số bài tập và số bài chờ chấm.",
        "**Thẻ \"Đang chờ chấm\".** Số lớn là tổng bài nộp chưa chấm, dòng nhỏ bên dưới ghi số bài nộp và số bài tự luận. Ba thẻ còn lại là tổng số bài tập, số bài đã chấm và số bài tập quá hạn.",
        "**Tab \"Cần chấm\".** Tab này gom các bài đang chờ chấm của mọi khoá vào một chỗ; con số cạnh tên tab là số bài đang chờ.",
    ]
)

# ── Hình 2: cửa sổ chấm bài ────────────────────────────────────────────────────
_GRADE = shot(
    "3-1-cua-so-cham-bai",
    "Hình minh hoạ: cửa sổ chấm một bài nộp, chụp khi chưa bấm gợi ý điểm bằng AI nên hai ô còn trống.",
    "Từ trang bài nộp của \"Bài tập 1: Tính điểm trung bình\" bấm \"Xem bài làm\" ở một dòng chưa chấm để mở cửa sổ chấm. "
    "CHƯA bấm \"Gợi ý điểm bằng AI\" (không gọi AI thật), nên ô Điểm và ô Nhận xét còn trống. "
    "Chụp thấy tên và email học viên mẫu, nhãn \"Chờ chấm\", mã nguồn bài nộp, nút gợi ý, ô Điểm, ô Nhận xét, nút \"Chấm điểm\" và nút \"Quay lại danh sách\".",
    ["Nút Gợi ý điểm bằng AI", "Ô Điểm", "Ô Nhận xét", "Nút Chấm điểm"],
)

_GRADE_LEGEND = legend(
    [
        "**Nút \"Gợi ý điểm bằng AI\"** (trên giao diện có thêm biểu tượng tia sáng). Khi thầy/cô bấm, AI đọc đề bài, tiêu chí chấm (nếu có) và bài nộp, rồi điền tạm điểm và nhận xét vào hai ô bên dưới. Dòng chữ nhỏ dưới nút nhắc rằng AI không tự lưu gì cả. Ảnh này chụp trước khi bấm nên hai ô còn trống.",
        "**Ô \"Điểm\".** Thầy/cô gõ điểm vào đây, hoặc sửa lại số AI điền nếu thấy chưa hợp lý. Chữ \"/ 10\" bên cạnh là điểm tối đa của bài, và dòng nhắc bên dưới cho biết chỉ nhập số từ 0 đến 10.",
        "**Ô \"Nhận xét\".** Trong ô còn gợi ý \"(optional)\", nghĩa là không bắt buộc. Đoạn chữ này sẽ đến tay học viên, nên thầy/cô cần đọc kỹ và sửa cho đúng giọng của mình.",
        "**Nút \"Chấm điểm\".** Chỉ sau khi thầy/cô bấm nút xanh này, điểm và nhận xét mới được lưu và gửi cho học viên. Với bài đã chấm, nút đổi thành \"Cập nhật điểm\".",
    ]
)

_FLOW = flow(
    [
        ("AI điền nháp", "Điểm và nhận xét hiện sẵn trong hai ô"),
        ("Thầy/cô đọc và sửa", "Đối chiếu với bài làm và tiêu chí chấm"),
        ("Thầy/cô bấm \"Chấm điểm\"", "Điểm và nhận xét được lưu"),
        ("Học viên nhận kết quả", "Chỉ từ lúc này học viên mới thấy"),
    ],
    hue=VIOLET,
)

LESSON = {
    "title": "Bài 3.1 · Giao bài tập và chấm bài",
    "durationMin": 6,
    "description": "Thêm bài tập vào bài học, viết tiêu chí chấm để AI hiểu đúng ý thầy/cô, rồi chấm bài với phần gợi ý nháp của AI.",
    "objectives": [
        "Thêm được một bài tập có hạn nộp và điểm tối đa vào bài học",
        "Viết được tiêu chí chấm đủ rõ để AI đọc hiểu",
        "Chấm được một bài nộp và nói được lúc nào học viên mới nhận kết quả",
    ],
    "summary": [
        "Bài tập gồm tiêu đề, mô tả nhiệm vụ, hạn nộp và điểm tối đa; mục \"Gợi ý dạng bài làm\" là tuỳ chọn.",
        "Tiêu chí chấm là một khung văn bản nằm trên bảng bài nộp, không phải bảng. Thầy/cô nên viết rõ điểm cho từng ý, và AI đọc đúng đoạn chữ ấy.",
        "AI chỉ điền nháp điểm và nhận xét. Học viên chỉ nhận kết quả sau khi thầy/cô bấm \"Chấm điểm\".",
    ],
    "body": (
        "\n"
        "Bài kiểm tra cuối bài do máy chấm. Còn bài tập thì thầy/cô chấm tay, vì học viên nộp bài viết, bài vẽ hay sản phẩm mà máy khó đánh giá. "
        "Bài này hướng dẫn cách giao bài tập, cách viết tiêu chí chấm, và cách dùng AI để chấm nhanh hơn mà vẫn do thầy/cô quyết định.\n\n"
        "## Thêm một bài tập vào bài học\n\n"
        "Thầy/cô mở bài học cần giao bài, bấm **+ Thêm hoạt động/tài nguyên**, rồi chọn thẻ **Bài tập** (ghi chú trên thẻ: giảng viên chấm tay). "
        "Biểu mẫu có bốn ô chính.\n\n"
        "| Ô | Thầy/cô điền gì |\n"
        "|---|---|\n"
        "| Tiêu đề bài tập | Tên ngắn gọn, ví dụ \"Bài tập 1: Tính điểm trung bình\" |\n"
        "| Mô tả nhiệm vụ | Việc học viên phải làm, nộp ở dạng nào, dài khoảng bao nhiêu |\n"
        "| Hạn nộp | Ngày giờ cuối cùng để nộp. Ô này không bắt buộc |\n"
        "| Điểm tối đa | Thang điểm của bài, ví dụ 10 |\n\n"
        "Bên dưới có một mục thu gọn tên **Gợi ý dạng bài làm** (không bắt buộc). Mục này liệt kê các dạng như Tóm tắt, Tự giải thích, "
        "Hình dung tình huống, Vẽ sơ đồ, Vẽ minh hoạ, Dạy lại và Thực hành minh hoạ. "
        "Nếu chưa biết nên yêu cầu học viên làm theo dạng nào, thầy/cô bấm nút **Gợi ý bằng AI** để tham khảo.\n\n"
        "> [!meo] **Hạn riêng cho từng lớp.**\n"
        "> Nếu thầy/cô dạy nhiều lớp mà mỗi lớp cần một hạn nộp khác nhau, bảng \"Hạn theo lớp\" trong biểu mẫu sửa sẽ giúp. Chương 4 sẽ hướng dẫn kỹ hơn.\n\n"
        "## Viết tiêu chí chấm: một ô văn bản, không phải bảng\n\n"
        "Nhiều thầy/cô nghĩ tiêu chí chấm phải dựng thành bảng nhiều cột. Trong Limio thì không. "
        "Mỗi bài tập có một trang bài nộp riêng. Thầy/cô mở trang này bằng nút **Xem bài nộp** trong khối bài tập ở bài học. "
        "Ngay phía trên bảng bài nộp có một khung văn bản gọi là **tiêu chí chấm** (không bắt buộc). Trên giao diện khung này ghi \"Rubric chấm điểm\", và nút lưu ghi \"Lưu rubric\". "
        "Thầy/cô gõ chữ vào khung rồi bấm nút lưu. Khung có sẵn một dòng gợi ý: \"Ví dụ: 3đ nêu đúng khái niệm. 4đ có ví dụ. 3đ trình bày rõ ràng.\"\n\n"
        "Điều quan trọng là **AI đọc đúng đoạn chữ này** khi gợi ý điểm, và dòng giải thích dưới khung cũng nói vậy. Vì vậy tiêu chí càng rõ thì điểm AI gợi ý càng sát ý thầy/cô.\n\n"
        "> [!ghi-nho] **Tiêu chí viết rõ thì AI chấm sát.**\n"
        "> Thầy/cô nên viết mỗi ý một câu, có điểm đi kèm, và tổng các điểm bằng điểm tối đa của bài tập.\n\n"
        "Bảng dưới đây so sánh ba cách viết cho cùng bài tập \"Tính điểm trung bình\" môn Nhập môn Lập trình, điểm tối đa là 10.\n\n"
        "| Cách viết | Nhận xét |\n"
        "|---|---|\n"
        "| \"Bài làm tốt thì cho điểm cao.\" | Quá chung. AI và cả thầy/cô sau một tuần đều không biết thế nào là tốt. |\n"
        "| \"Đúng, gọn, dễ đọc.\" | Có tên các ý nhưng chưa nói mỗi ý bao nhiêu điểm, nên không biết bài thiếu ý nào thì trừ bao nhiêu. |\n"
        "| \"4 điểm chạy đúng với dữ liệu mẫu. 3 điểm xử lý trường hợp nhập sai. 3 điểm đặt tên biến rõ ràng.\" | Mỗi ý có điểm, kiểm tra được bằng cách đọc bài, tổng đúng 10 điểm. |\n\n"
        "> [!canh-bao] **Đừng tìm nút dựng bảng tiêu chí.**\n"
        "> Limio không có bảng tiêu chí chấm nhiều cột. Thầy/cô chỉ cần viết thành các câu ngắn trong một ô văn bản.\n\n"
        "## Chấm bài với phần gợi ý nháp của AI\n\n"
        "Thầy/cô vào **Bài giảng trực tuyến**, chọn **Bài tập** để mở màn hình quản lý bài tập. "
        "Tiêu đề trang trên giao diện ghi \"Assignment\", tức là bài tập.\n\n"
        + "\n"
        + _LIST
        + "\n\n"
        + _LIST_LEGEND
        + "\n\n"
        "Bảng bài nộp nằm ở trang riêng của từng bài tập, như phần trên đã nói. Đầu trang có các thẻ số: tổng học viên, số chưa nộp, số chờ chấm và số đã chấm. "
        "Dưới khung tiêu chí chấm là bảng \"Danh sách\" với các cột Người nộp, Lớp, Trạng thái, Ngày giờ nộp, Bài làm và Điểm. "
        "Bấm **Xem bài làm** ở một dòng thì cửa sổ chấm mở ra. Phần đầu cửa sổ cho thấy tên và email học viên, nhãn trạng thái \"Chờ chấm\" và bài làm. "
        "Ở ví dụ này bài làm là mã nguồn Python.\n\n"
        + _GRADE
        + "\n\n"
        + _GRADE_LEGEND
        + "\n\n"
        "Thứ tự an toàn là AI điền nháp, thầy/cô đọc và sửa, thầy/cô bấm chấm điểm, rồi học viên mới nhận.\n\n"
        + _FLOW
        + "\n\n"
        "> [!canh-bao] **AI không bao giờ tự lưu điểm.**\n"
        "> Bấm \"Gợi ý điểm bằng AI\" chưa phải là chấm xong. Nếu thầy/cô đóng cửa sổ mà chưa bấm \"Chấm điểm\", học viên chưa nhận được gì.\n\n"
        "> [!vi-du] **Một khoá 36 học viên.**\n"
        "> Thầy/cô viết tiêu chí một lần, rồi với mỗi bài nộp chỉ cần bấm gợi ý, đọc, sửa vài chữ và chấm. "
        "Việc đọc bài vẫn là của thầy/cô; AI chỉ giúp thầy/cô không phải gõ lại nhận xét từ đầu 36 lần.\n\n"
        + try_now(
            "Viết tiêu chí chấm cho một bài tập",
            [
                "Mở một bài học có bài tập, hoặc thêm một bài tập mới vào bài học nếu thầy/cô chưa có.",
                "Trong khối bài tập, bấm **Xem bài nộp** để mở trang bài nộp.",
                "Ở khung tiêu chí chấm phía trên bảng (ghi \"Rubric chấm điểm\"), viết ba ý, mỗi ý kèm điểm, sao cho tổng bằng điểm tối đa.",
                "Bấm nút **Lưu tiêu chí** (trên giao diện ghi \"Lưu rubric\").",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 3.1",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "3.1-tieu-chi-la-gi",
                "type": "mcq",
                "prompt": "Trong Limio, tiêu chí chấm của một bài tập được nhập như thế nào?",
                "explanation": "Tiêu chí chấm là một ô văn bản tự do. Thầy/cô viết các câu ngắn có điểm cho từng ý, và AI đọc đúng đoạn chữ đó khi gợi ý điểm.",
                "points": 1,
                "options": [
                    {"label": "Viết thành chữ trong một ô văn bản", "isCorrect": True},
                    {
                        "label": "Dựng thành bảng nhiều cột, mỗi dòng là một tiêu chí",
                        "isCorrect": False,
                        "misconception": "limio.rubric-is-table",
                    },
                    {
                        "label": "Chọn từ một danh sách tiêu chí có sẵn của hệ thống",
                        "isCorrect": False,
                        "misconception": "limio.rubric-is-table",
                    },
                    {"label": "Không cần nhập, AI tự biết cách chấm", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-tieu-chi-tot",
                "type": "mcq",
                "prompt": "Cách viết tiêu chí chấm nào dưới đây giúp AI gợi ý điểm sát nhất?",
                "explanation": "Mỗi ý có điểm đi kèm và kiểm tra được bằng cách đọc bài, tổng điểm bằng điểm tối đa. Hai cách còn lại quá chung, không chỉ ra bài thiếu ý nào thì trừ bao nhiêu.",
                "points": 1,
                "options": [
                    {
                        "label": "4 điểm chạy đúng với dữ liệu mẫu. 3 điểm xử lý trường hợp nhập sai. 3 điểm đặt tên biến rõ ràng.",
                        "isCorrect": True,
                    },
                    {"label": "Bài làm tốt thì cho điểm cao.", "isCorrect": False},
                    {"label": "Chấm theo độ đúng, cách trình bày và sự sáng tạo.", "isCorrect": False},
                    {"label": "Chấm nghiêm khắc.", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-ai-tu-luu",
                "type": "true_false",
                "prompt": "Sau khi thầy/cô bấm \"Gợi ý điểm bằng AI\", học viên đã nhận được điểm và nhận xét đó.",
                "explanation": "AI chỉ điền nháp vào cửa sổ chấm và không bao giờ tự lưu. Học viên chỉ nhận kết quả sau khi thầy/cô xem lại rồi bấm \"Chấm điểm\".",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "limio.ai-score-is-final"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "3.1-thu-tu-cham",
                "type": "ordering",
                "prompt": "Sắp xếp các bước chấm một bài nộp theo thứ tự an toàn.",
                "explanation": "AI điền nháp trước, thầy/cô đọc và sửa, rồi bấm \"Chấm điểm\". Chỉ lúc đó học viên mới nhận điểm và nhận xét.",
                "points": 2,
                "sequence": [
                    "Bấm \"Xem bài làm\" ở dòng của học viên",
                    "Bấm \"Gợi ý điểm bằng AI\"",
                    "Đọc, đối chiếu với bài làm và sửa điểm, nhận xét",
                    "Bấm \"Chấm điểm\"",
                ],
            },
        ],
    },
}

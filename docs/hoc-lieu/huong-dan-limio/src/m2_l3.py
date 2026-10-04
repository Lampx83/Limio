# -*- coding: utf-8 -*-
from mockup import *

_FLOW_PHAN_CAP = flow(
    [
        ("Đợt thi", "Cả kỳ thi, ví dụ \"Thi giữa kỳ — Nhập môn Lập trình, học kỳ I\""),
        ("Ca thi", "Một buổi thi: chọn đề, đặt giờ, chọn cách vào thi"),
        ("Phòng thi", "Nơi xếp thí sinh và giám thị của ca đó"),
    ]
)

_SHOT_TO_CHUC = shot(
    "2-3-ban-dinh-to-chuc-kieu-gi",
    "Hình minh hoạ: trang \"Tổ chức thi\" với ba thẻ để chọn hình thức.",
    "Trang /instructor/organize của giảng viên mẫu (có khoá \"Nhập môn Lập trình\"; không mở kèm đề cụ thể). Chụp tiêu đề \"Tổ chức thi\", dòng hỏi cách tổ chức "
    "và đủ ba thẻ: Link thi nhanh, Thử nghiệm câu hỏi, Kỳ thi chính thức.",
    marks=["Thẻ Link thi nhanh", "Thẻ Thử nghiệm câu hỏi", "Thẻ Kỳ thi chính thức"],
)

_LEGEND_TO_CHUC = legend(
    [
        "**Thi nhanh bằng đường dẫn (thẻ ghi \"Link thi nhanh\").** Dùng cho khảo sát, điểm danh, kiểm tra nhanh trên lớp. Thầy/cô chọn đề thi, đặt thời lượng, mở ngay và đóng khi bấm.",
        "**Thử nghiệm câu hỏi.** Dùng để đo chất lượng câu hỏi trước khi đưa vào ngân hàng. Không hiện đáp án cho người làm, để câu hỏi không bị lộ.",
        "**Kỳ thi chính thức.** Dùng khi có nhiều ca, nhiều phòng và có giám thị. Thầy/cô chia ca, xếp phòng, cấp mã cho từng thí sinh và in phiếu.",
    ]
)

_SHOT_DOT = shot(
    "2-3-tong-quan-dot-thi",
    "Hình minh hoạ: trang một đợt thi, với các thẻ và nhãn trạng thái của đợt.",
    "Trang /instructor/exam-rounds/{id} của đợt thi \"Thi giữa kỳ — Nhập môn Lập trình, học kỳ I\" (có một ca thi, trạng thái Nháp) đang ở thẻ \"Tổng quan\". Cần thấy hàng thẻ Tổng quan / Ca thi / Phòng thi / Trưởng đợt / Kết quả, "
    "chip \"Nháp\" cạnh tên đợt, mục \"Sẵn sàng thi chưa?\" và mục \"Đổi trạng thái\" với dòng ghi chú rằng trạng thái chỉ để phân loại, không tự mở hay đóng ca thi.",
    marks=["Các thẻ của đợt thi", "Nhãn Nháp cạnh tên đợt", "Mục Đổi trạng thái"],
)

_LEGEND_DOT = legend(
    [
        "**Các thẻ.** Tổng quan, Ca thi, Phòng thi, Trưởng đợt và Kết quả. Thầy/cô tạo ca ở thẻ Ca thi và thêm phòng ở thẻ Phòng thi. Ảnh đang ở thẻ Tổng quan.",
        "**Nhãn trạng thái của đợt.** Trên ảnh là \"Nháp\". Có bốn nhãn: Nháp, Đang mở, Đã đóng, Lưu trữ.",
        "**Mục \"Đổi trạng thái\".** Dòng ghi chú ngay dưới tiêu đề mục nói rõ: trạng thái chỉ để phân loại, không tự mở hay đóng ca thi. Giờ vào thi vẫn do từng ca quyết định.",
    ]
)

LESSON = {
    "title": "Bài 2.3 · Đề thi và tổ chức thi",
    "durationMin": 6,
    "description": "Thiết kế đề thi ở hai mức Cơ bản và Nâng cao, chọn một trong ba cách tổ chức thi, và hiểu chuỗi Đợt thi, Ca thi, Phòng thi.",
    "objectives": [
        "Phân biệt được hai mức Cơ bản và Nâng cao khi thiết kế đề thi",
        "Chọn được một trong ba cách tổ chức thi cho đúng tình huống",
        "Nói đúng vai trò của đợt thi, ca thi, phòng thi và của trạng thái đợt thi",
    ],
    "summary": [
        "Đề thi có hai mức: Cơ bản là trình hướng dẫn ba bước, Nâng cao là biểu mẫu đầy đủ với mục đích, chấm điểm, giám thị và trộn đề.",
        "Có ba cách tổ chức thi: thi nhanh bằng đường dẫn, Thử nghiệm câu hỏi và Kỳ thi chính thức. Kỳ thi chính thức đi theo chuỗi Đợt thi, Ca thi, Phòng thi.",
        "Trạng thái đợt thi chỉ để phân loại, không tự mở hay đóng ca thi. Giờ vào thi do từng ca quyết định.",
    ],
    "body": (
        "\n"
        "## Đề thi: bộ câu hỏi thí sinh sẽ làm\n\n"
        "**Đề thi** gồm nội dung câu hỏi và các cài đặt như thời gian làm bài. Thầy/cô soạn đề ở mục Thiết kế đề thi, rồi chọn đề đó khi tổ chức thi. "
        "Một đề dùng lại được cho nhiều lần thi.\n\n"
        "Câu hỏi trong đề lấy từ hai nguồn: ngân hàng câu hỏi (Bài 2.2) hoặc nhập thủ công ngay trong đề. "
        "Khi lấy từ ngân hàng, thầy/cô chọn nhanh theo tiêu chí, chọn thủ công, hoặc chọn theo ma trận đề thi. Đề có thể chia thành nhiều phần, ví dụ một phần trắc nghiệm và một phần tự luận.\n\n"
        "> [!ghi-nho] **Chốt là cố định bộ câu vào đề.**\n"
        "> Khi đề rút câu ngẫu nhiên từ ngân hàng, mỗi lượt thi có thể nhận bộ câu khác nhau. Nút \"Chốt\" cố định bộ câu hiện tại vào đề, "
        "nên từ đó mọi lượt thi nhận cùng một bộ câu.\n\n"
        "## Hai mức: Cơ bản và Nâng cao\n\n"
        "Limio có hai mức khi thiết kế đề, để người mới không bị ngợp.\n\n"
        "| | Cơ bản | Nâng cao |\n"
        "|---|---|---|\n"
        "| Hình thức | Trình hướng dẫn ba bước | Biểu mẫu đầy đủ |\n"
        "| Các bước | Chọn nội dung cần kiểm tra, cấu hình đề (số câu, thời gian, tỉ lệ mức tư duy), phát đề | Mục đích, cách chấm điểm, giám thị, trộn câu và trộn đáp án |\n"
        "| Phù hợp | Đề thi nhanh cho một lớp | Kỳ thi cần kiểm soát chặt |\n\n"
        "Ở bước phát đề của mức Cơ bản, thầy/cô chọn một trong ba cách: một đề chung cho cả lớp, xáo trộn \"cho mỗi học sinh\" (chữ trên giao diện), hoặc chia lớp làm nhiều ca thi. "
        "Sau đó thầy/cô bấm \"Tạo đề\".\n\n"
        "Mức Nâng cao cho thầy/cô quyết định thêm bốn việc. Mục đích là đề thi thật hay đề thử nghiệm. Chấm điểm là tự động hay kết hợp. "
        "Giám thị là không có, cơ bản hay nghiêm ngặt. Và có trộn thứ tự câu hỏi cùng thứ tự đáp án hay không.\n\n"
        "Khi thầy/cô đã tạo vài đề, một biểu ngữ hiện lên: \"Bật chế độ Nâng cao\" để xem chỉ số chất lượng câu hỏi chi tiết. "
        "Thầy/cô bấm \"Bật ngay\" nếu muốn, hoặc \"Bỏ qua\" nếu chưa cần.\n\n"
        "## Ba cách tổ chức thi\n\n"
        "Đề thi soạn xong thì thầy/cô vào mục **Tổ chức thi**. Trang này hỏi thầy/cô định tổ chức kiểu gì. Mỗi cách là một thẻ, có tên và một câu mô tả ngắn.\n\n"
        + _SHOT_TO_CHUC
        + "\n\n"
        + _LEGEND_TO_CHUC
        + "\n\n"
        "| Cách | Dùng khi | Cách làm |\n"
        "|---|---|---|\n"
        "| Thi nhanh bằng đường dẫn | Khảo sát, điểm danh, kiểm tra nhanh trên lớp | Chọn đề đã xuất bản, đặt số phút, chọn mức hiện đáp án và kết quả, bấm \"Mở\" rồi gửi đường dẫn hoặc mã QR |\n"
        "| Thử nghiệm câu hỏi | Muốn đo chất lượng câu trước khi đưa vào ngân hàng | Giống thi nhanh bằng đường dẫn, nhưng mặc định không hiện đáp án |\n"
        "| Kỳ thi chính thức | Nhiều ca, nhiều phòng, có giám thị | Tạo đợt thi, rồi ca thi, rồi phòng thi |\n\n"
        "> [!canh-bao] **Đề phải được xuất bản trước khi mở thi.**\n"
        "> Đề còn ở dạng nháp thì chưa mở thi được. Trang Tổ chức thi sẽ nhắc thầy/cô xuất bản đề trước.\n\n"
        "## Kỳ thi chính thức: Đợt thi, Ca thi, Phòng thi\n\n"
        "Kỳ thi chính thức có ba tầng, đi từ lớn tới nhỏ.\n\n"
        + _FLOW_PHAN_CAP
        + "\n\n"
        "Thầy/cô vào \"Vào quản lý đợt thi\" rồi bấm \"+ Tạo đợt thi\". Mỗi đợt có các thẻ Tổng quan, Ca thi, Phòng thi, Trưởng đợt và Kết quả. "
        "**Trưởng đợt** là người sửa được đợt thi đó, khác với quản trị viên của cả trường.\n\n"
        "Thẻ **Tổng quan** có mục \"Sẵn sàng thi chưa?\". Đây là danh sách việc cần làm trước khi thi: tạo ít nhất một ca thi, dùng đề đã xuất bản, xếp phòng cho ca phát mã theo phòng, và chọn cách vào thi cho từng ca. "
        "Việc nào chưa xong có liên kết \"Xử lý →\" dẫn tới chỗ sửa.\n\n"
        "Khi tạo **ca thi**, thầy/cô chọn đề, đặt giờ và chọn cách vào thi:\n\n"
        "- **Theo phòng:** mỗi thí sinh có một mã riêng và được xếp phòng.\n"
        "- **Tự do:** cả ca dùng chung một mã.\n\n"
        "Ca mới tạo có thể còn ở mức \"Chưa chọn\". Khi đó chỉ học viên đã ghi danh vào khoá mới vào được, nên nếu thầy/cô cần phát mã thì phải chọn một trong hai cách trên.\n\n"
        "Ở thẻ **Phòng thi**, thầy/cô bấm \"+ Thêm phòng thi\", nhập danh sách thí sinh và in phiếu phòng. "
        "Mỗi lần một thí sinh làm bài trong một ca được gọi là một **lượt thi**.\n\n"
        "**Giám thị** không cần tài khoản Limio. Họ vào trang giám thị, nhập mã của phòng mình được phân công. "
        "Mã này do người tổ chức gửi riêng và khác mã thí sinh.\n\n"
        + _SHOT_DOT
        + "\n\n"
        + _LEGEND_DOT
        + "\n\n"
        "> [!canh-bao] **Trạng thái đợt thi không mở hay đóng ca thi.**\n"
        "> Nháp, Đang mở, Đã đóng và Lưu trữ chỉ để thầy/cô phân loại và lọc danh sách. Chuyển đợt sang Đã đóng không làm các ca đang thi dừng lại. "
        "Giờ vào thi do từng ca quyết định. Muốn dừng một ca đang thi, thầy/cô đóng chính ca đó ở thẻ Ca thi.\n\n"
        + try_now(
            "Xem trước các bước tổ chức thi",
            [
                "Trên thanh điều hướng, bấm **Kiểm tra đánh giá**, rồi bấm **Tổ chức thi**.",
                "Đọc ba thẻ: thi nhanh bằng đường dẫn, **Thử nghiệm câu hỏi** và **Kỳ thi chính thức**.",
                "Bấm vào **Kỳ thi chính thức** và đọc ba bước Đợt thi, Ca thi, Phòng thi mà trang giới thiệu.",
                "Bấm **Thiết kế đề thi** và tìm nút tạo đề thi mới. Thầy/cô chưa cần tạo gì.",
            ],
            minutes=2,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 2.3",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "2.3-trang-thai-dot",
                "type": "mcq",
                "prompt": "Thầy/cô chuyển một đợt thi sang trạng thái \"Đã đóng\". Điều gì xảy ra với các ca thi trong đợt?",
                "explanation": "Trạng thái đợt thi chỉ để phân loại. Các ca thi vẫn chạy theo giờ của từng ca. Muốn dừng một ca đang thi, thầy/cô đóng chính ca đó ở thẻ Ca thi.",
                "points": 1,
                "options": [
                    {"label": "Không có gì thay đổi, các ca vẫn theo giờ của từng ca", "isCorrect": True},
                    {
                        "label": "Mọi ca thi trong đợt tự đóng ngay",
                        "isCorrect": False,
                        "misconception": "limio.round-status-opens-session",
                    },
                    {
                        "label": "Các ca thi tự đóng khi tới hết ngày",
                        "isCorrect": False,
                        "misconception": "limio.round-status-opens-session",
                    },
                    {"label": "Thí sinh không xem được kết quả nữa", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-ba-cach-to-chuc",
                "type": "matching",
                "prompt": "Nối mỗi tình huống với cách tổ chức thi phù hợp.",
                "explanation": "Kiểm tra nhanh trên lớp dùng thi nhanh bằng đường dẫn. Đo chất lượng câu mới dùng thử nghiệm câu hỏi. Thi giữa kỳ nhiều ca, nhiều phòng, có giám thị là kỳ thi chính thức.",
                "points": 3,
                "pairs": [
                    {"left": "Kiểm tra 15 phút ngay trên lớp", "right": "Thi nhanh bằng đường dẫn"},
                    {"left": "Đo xem 10 câu mới viết có tốt không, chưa đưa vào ngân hàng", "right": "Thử nghiệm câu hỏi"},
                    {"left": "Thi giữa kỳ chia làm ba ca, nhiều phòng, có giám thị", "right": "Kỳ thi chính thức"},
                ],
            },
            {
                "key": "2.3-cach-vao-ca",
                "type": "mcq",
                "prompt": "Mỗi thí sinh cần một mã riêng và được xếp vào phòng cụ thể. Thầy/cô chọn cách vào ca thi nào?",
                "explanation": "\"Theo phòng\" cấp mã riêng cho từng thí sinh và có xếp phòng. \"Tự do\" chỉ có một mã chung cho cả ca.",
                "points": 1,
                "options": [
                    {"label": "Theo phòng", "isCorrect": True},
                    {"label": "Tự do", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-giam-thi-vao-bang-ma",
                "type": "true_false",
                "prompt": "Đúng hay sai: giám thị cần có tài khoản Limio mới vào coi thi được.",
                "explanation": "Sai. Giám thị không cần tài khoản. Họ vào trang giám thị và nhập mã của phòng mình được phân công, do người tổ chức gửi riêng.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
        ],
    },
}

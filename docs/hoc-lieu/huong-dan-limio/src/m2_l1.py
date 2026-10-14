# -*- coding: utf-8 -*-
from mockup import *

_FLOW_THEM = flow(
    [
        ("Thêm bài kiểm tra", "Bấm \"+ Thêm bài kiểm tra\" trong bài học"),
        ("Đặt tên", "Gõ tên rồi bấm \"Tạo bài kiểm tra\""),
        ("Soạn câu hỏi", "Trình soạn tự mở; thêm câu bằng một trong ba cách"),
    ]
)

_SHOT_EDITOR = shot(
    "2-1-trinh-soan-cau-hoi",
    "Hình minh hoạ: trình soạn bài kiểm tra, với ba nút thêm câu hỏi và danh sách câu hỏi.",
    "Trang /instructor/courses/{id}/quizzes/{quizId}/edit của bài kiểm tra \"Kiểm tra: Vòng lặp for\" (khoá \"Nhập môn Lập trình\"), đã có 3 câu hỏi (một trắc nghiệm về \"for i in range(3): print(i)\", một đúng/sai, "
    "một sắp xếp thứ tự), chưa mở hộp Cài đặt. Chụp thanh tóm tắt cài đặt, nút \"Cài đặt\", dải \"Thêm câu hỏi\" với ba nút (AI import, Excel import, Nhập thủ công), "
    "cột \"Câu hỏi (3)\" bên trái và khung nội dung câu đang chọn bên phải.",
    marks=["Nút Cài đặt", "Ba nút thêm câu hỏi", "Danh sách câu hỏi"],
)

_LEGEND_EDITOR = legend(
    [
        "**Cài đặt.** Thầy/cô bấm nút này để mở bảng cài đặt của bài kiểm tra. Hàng chữ phía trên nút luôn cho biết cài đặt hiện tại: thời gian làm bài, số lần làm, giờ mở và đóng, cách tính điểm.",
        "**Ba nút thêm câu hỏi.** Nhập bằng AI (nút ghi \"AI import\"), nhập từ Excel (nút ghi \"Excel import\") và \"Nhập thủ công\".",
        "**Danh sách câu hỏi.** Con số trong ngoặc là số câu hiện có. Mỗi câu cho biết loại câu, số điểm và chủ đề. Thầy/cô bấm một câu thì nội dung câu đó hiện ở khung bên phải để xem và sửa.",
    ]
)

_SHOT_SETTINGS = shot(
    "2-1-cai-dat-bai-kiem-tra",
    "Hình minh hoạ: bảng cài đặt của bài kiểm tra.",
    "Cùng trang trình soạn bài kiểm tra, đã bấm nút \"Cài đặt\" để mở bảng cài đặt, chưa tick ô nào (bốn thẻ Thời gian làm bài, Số lần làm, Hạn mở, Hạn đóng đều ở mặc định). "
    "Chụp từ ô tên bài kiểm tra tới mục thu gọn \"Lịch theo lớp\", gồm dòng \"Cách tính điểm khi làm nhiều lần\" với ba nút Cao nhất / Lần cuối / Trung bình và hai nút Lưu / Hủy.",
    marks=["Ô chọn của từng cài đặt", "Hạn mở và hạn đóng", "Cách tính điểm khi làm nhiều lần", "Lịch theo lớp"],
)

_LEGEND_SETTINGS = legend(
    [
        "**Ô chọn của từng cài đặt.** Mỗi cài đặt có một ô vuông ở góc phải thẻ. Khi ô để trống, bài kiểm tra theo mặc định: không giới hạn thời gian, không giới hạn số lần làm.",
        "**Hạn mở và hạn đóng.** Nếu thầy/cô không tick, bài kiểm tra mở ngay và không có hạn đóng. Giờ tính theo múi giờ Việt Nam. Trước hạn mở hoặc sau hạn đóng, học viên không bắt đầu được lượt làm mới; lượt đang làm dở vẫn nộp được.",
        "**Cách tính điểm khi làm nhiều lần.** Dòng này dùng khi học viên được làm nhiều lần, kể cả lúc số lần đang là \"Không giới hạn\" như trên ảnh. Có ba lựa chọn: \"Cao nhất\", \"Lần cuối\", \"Trung bình\".",
        "**Lịch theo lớp.** Mục này đang thu gọn. Thầy/cô bấm vào để đặt giờ mở và giờ đóng riêng cho từng lớp. Nếu cả khoá dùng chung một hạn thì thầy/cô chưa cần mở mục này.",
    ]
)

LESSON = {
    "title": "Bài 2.1 · Bài kiểm tra cuối bài học",
    "durationMin": 5,
    "description": "Cách thêm bài kiểm tra vào một bài học, ba cách đưa câu hỏi vào, chín dạng câu hỏi và các cài đặt cần biết.",
    "objectives": [
        "Thêm được một bài kiểm tra vào bài học và mở trình soạn",
        "Chọn được cách đưa câu hỏi vào phù hợp: nhập bằng AI, nhập từ Excel hoặc nhập thủ công",
        "Đặt được thời gian, số lần làm, hạn mở, hạn đóng và cách tính điểm cho bài kiểm tra",
    ],
    "summary": [
        "Bài kiểm tra cuối bài dùng để học viên ôn tập và để hệ thống nuôi phản hồi cá nhân hoá, không dùng cho kỳ thi chính thức.",
        "Thầy/cô thêm câu hỏi bằng ba cách: nhập bằng AI, nhập từ Excel hoặc nhập thủ công. Có chín dạng câu hỏi, nhưng nhập bằng AI chỉ nhận năm dạng.",
        "Phần cài đặt gồm thời gian làm bài, số lần làm, hạn mở, hạn đóng và cách tính điểm khi làm nhiều lần.",
    ],
    "body": (
        "\n"
        "## Bài kiểm tra cuối bài dùng để làm gì\n\n"
        "Bài kiểm tra cuối bài là một nhóm câu hỏi ngắn nằm ngay trong bài học. Học viên học xong thì làm luôn, để tự biết mình đã hiểu bài chưa.\n\n"
        "Mục đích chính của nó là **ôn tập**, không phải thi. Khi học viên làm sai, Limio có thể chỉ ra đúng chỗ các em hiểu nhầm. "
        "Nhờ vậy bài kiểm tra này còn **nuôi phản hồi cá nhân hoá**: mỗi câu trả lời giúp hệ thống đoán học viên đang nắm bài tới đâu.\n\n"
        "Chính những câu hỏi ở cuối mỗi bài trong khoá học này là ví dụ. Thầy/cô vừa làm một câu ở cuối bài trước, và đó là một bài kiểm tra cuối bài thật.\n\n"
        "> [!ghi-nho] **Đây là nơi ôn tập, không phải phòng thi.**\n"
        "> Bài kiểm tra trong bài học và ngân hàng câu hỏi là hai kho riêng. Câu hỏi soạn ở đây không tự có trong ngân hàng, và ngược lại. Bài 2.2 giải thích rõ vì sao.\n\n"
        "Khi khoá học bật cá nhân hoá, mỗi bài học tự thành một chủ đề. Câu hỏi trong bài kiểm tra thừa hưởng chủ đề đó, nên thầy/cô không phải gắn tay.\n\n"
        "## Thêm bài kiểm tra vào bài học\n\n"
        "Thầy/cô làm việc này ở thẻ Nội dung của khoá, ngay trong bài học cần kiểm tra. Có ba bước.\n\n"
        + _FLOW_THEM
        + "\n\n"
        "Sau khi bấm \"Tạo bài kiểm tra\", Limio tự chuyển thầy/cô sang trình soạn. Nếu bài kiểm tra đã có sẵn, thầy/cô bấm nút \"Mở trình soạn\" nằm cạnh nó. "
        "Đầu trình soạn là tên bài kiểm tra; ngay dưới là hàng tóm tắt cài đặt và nút \"Cài đặt\".\n\n"
        + _SHOT_EDITOR
        + "\n\n"
        + _LEGEND_EDITOR
        + "\n\n"
        "## Ba cách đưa câu hỏi vào\n\n"
        "Dải \"Thêm câu hỏi\" có ba nút, như trên ảnh trước. "
        "Thầy/cô chọn cách nào tuỳ vào việc đề đang ở dạng gì.\n\n"
        "| Cách | Dùng khi | Thầy/cô làm gì |\n"
        "|---|---|---|\n"
        "| Nhập bằng AI | Đề đã có trong Word hoặc PDF | Dán chữ vào ô, bấm \"Định dạng bằng AI\", xem trước rồi xác nhận |\n"
        "| Nhập từ Excel | Có nhiều câu, tối đa 500 câu một lần | Tải tệp mẫu .xlsx về, điền câu hỏi, tải lên, xem trước rồi xác nhận |\n"
        "| Nhập thủ công | Cần soạn từng câu, hoặc dùng dạng câu mà hai cách trên không nhận | Mở biểu mẫu, gõ câu hỏi và các phương án |\n\n"
        "Với nhập bằng AI, thầy/cô dán tối đa 20.000 chữ, định dạng tuỳ ý. Đáp án đúng đánh dấu kiểu nào cũng được, như in đậm hay ghi \"Đáp án: B\". "
        "Câu nào AI không chắc đáp án thì báo cảnh báo ở bước xem trước, chứ không tự đoán.\n\n"
        "> [!canh-bao] **Nhập bằng AI và nhập từ Excel chỉ nhận năm dạng câu.**\n"
        "> Đó là trắc nghiệm, đúng/sai, sắp xếp thứ tự, ghép cặp và điền khuyết. Các dạng còn lại như tự luận hay đáp án dạng số, thầy/cô cần nhập thủ công.\n\n"
        "## Chín dạng câu hỏi\n\n"
        "Trình soạn có chín dạng câu hỏi. Thầy/cô nên trộn vài dạng trong một bài để học viên không thấy nhàm.\n\n"
        "| Dạng | Học viên làm gì |\n"
        "|---|---|\n"
        "| Trắc nghiệm | Chọn đáp án đúng trong các phương án |\n"
        "| Đúng / Sai | Chọn một câu khẳng định là đúng hay sai |\n"
        "| Điền khuyết | Gõ từ còn thiếu vào chỗ trống |\n"
        "| Sắp xếp thứ tự | Đặt các mục vào đúng thứ tự |\n"
        "| Ghép cặp | Nối mỗi mục bên trái với mục bên phải |\n"
        "| Đáp án dạng số | Gõ một con số |\n"
        "| Tự luận | Viết một đoạn trả lời dài |\n"
        "| Trả lời ngắn | Gõ một từ hoặc một cụm từ |\n"
        "| Kéo thả từ/câu | Kéo từ hoặc câu vào đúng chỗ |\n\n"
        "> [!meo] **Gắn quan niệm sai vào phương án sai.**\n"
        "> Trong biểu mẫu câu hỏi, thầy/cô có thể gắn một quan niệm sai (còn gọi là lỗi tư duy) vào từng phương án sai. "
        "Khi học viên chọn phương án đó, Limio nói đúng chỗ các em hiểu nhầm. Đây chính là cách khoá học này viết các câu ôn tập.\n\n"
        "## Các cài đặt của bài kiểm tra\n\n"
        "Thầy/cô bấm nút \"Cài đặt\" ở góc phải hàng tóm tắt, ngay dưới tên bài kiểm tra, để mở bảng cài đặt. Ô trên cùng của bảng là tên bài kiểm tra. "
        "Chỉnh xong, thầy/cô bấm \"Lưu\"; muốn bỏ thay đổi thì bấm \"Hủy\".\n\n"
        + _SHOT_SETTINGS
        + "\n\n"
        + _LEGEND_SETTINGS
        + "\n\n"
        "| Cài đặt | Ý nghĩa |\n"
        "|---|---|\n"
        "| Thời gian làm bài | Số phút tối đa cho một lượt làm; để trống ô thì không giới hạn |\n"
        "| Số lần làm | Số lần tối đa mỗi học viên được làm; để trống ô thì không giới hạn |\n"
        "| Hạn mở | Giờ bắt đầu cho làm bài; để trống ô thì mở ngay |\n"
        "| Hạn đóng | Giờ ngừng nhận bài; để trống ô thì không có hạn |\n"
        "| Cách tính điểm khi làm nhiều lần | Lấy điểm cao nhất, điểm lần cuối hoặc điểm trung bình |\n\n"
        "Với bài ôn tập, thầy/cô nên để thoáng: không giới hạn thời gian và số lần, để học viên làm lại tới khi hiểu bài.\n\n"
        "> [!ghi-nho] **Hai cài đặt nâng cao chỉ hiện với nhà nghiên cứu.**\n"
        "> Ô \"Độ khó\" (từ 1 là dễ tới 5 là khó) và ô \"Đánh giá độ tự tin\" (học viên chọn mức tự tin sau mỗi câu) chỉ xuất hiện trên tài khoản nhà nghiên cứu. "
        "Trên ảnh cài đặt ở trên, thầy/cô thấy bốn thẻ mà không có hai ô này, đúng như tài khoản giảng viên thường.\n\n"
        + try_now(
            "Thêm một bài kiểm tra một câu vào bài học của thầy/cô",
            [
                "Mở khoá của thầy/cô, vào thẻ **Nội dung** và chọn một bài học.",
                "Bấm **+ Thêm bài kiểm tra**, gõ tên, rồi bấm **Tạo bài kiểm tra**.",
                "Ở trình soạn, bấm **Nhập thủ công** và soạn một câu trắc nghiệm có hai phương án.",
                "Bấm **Cài đặt**, thử tick ô **Số lần làm**, rồi bấm **Hủy** (hoặc **Lưu** nếu thầy/cô muốn giữ).",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 2.1",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "2.1-muc-dich",
                "type": "mcq",
                "prompt": "Thầy/cô nên dùng bài kiểm tra cuối bài học vào việc nào?",
                "explanation": "Bài kiểm tra cuối bài dùng để học viên ôn tập ngay sau khi học và để hệ thống nuôi phản hồi cá nhân hoá. Kỳ thi chính thức dùng đề thi và ngân hàng câu hỏi.",
                "points": 1,
                "options": [
                    {"label": "Giúp học viên ôn bài và nhận phản hồi về chỗ hiểu nhầm", "isCorrect": True},
                    {
                        "label": "Tổ chức kỳ thi cuối kỳ có giám thị",
                        "isCorrect": False,
                        "misconception": "limio.two-assessment-systems",
                    },
                    {
                        "label": "Lấy câu hỏi từ ngân hàng để ghép thành đề thi",
                        "isCorrect": False,
                        "misconception": "limio.two-assessment-systems",
                    },
                    {"label": "Chấm điểm bài tập nộp bằng tệp", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-ai-nam-dang",
                "type": "true_false",
                "prompt": "Đúng hay sai: nhập bằng AI nhận được cả chín dạng câu hỏi, kể cả tự luận.",
                "explanation": "Sai. Nhập bằng AI chỉ nhận năm dạng: trắc nghiệm, đúng/sai, sắp xếp thứ tự, ghép cặp và điền khuyết. Câu tự luận phải nhập thủ công.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "2.1-cach-tinh-diem",
                "type": "mcq",
                "prompt": "Thầy/cô cho học viên làm bài ba lần và muốn lấy điểm lần làm tốt nhất. Thầy/cô chọn cách tính điểm nào?",
                "explanation": "\"Cao nhất\" lấy điểm cao nhất trong các lần làm. \"Lần cuối\" lấy điểm của lần nộp cuối, còn \"Trung bình\" lấy trung bình các lần.",
                "points": 1,
                "options": [
                    {"label": "Cao nhất", "isCorrect": True},
                    {"label": "Lần cuối", "isCorrect": False},
                    {"label": "Trung bình", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-thu-tu-them",
                "type": "ordering",
                "prompt": "Sắp xếp các bước thêm một bài kiểm tra vào bài học theo đúng thứ tự.",
                "explanation": "Thầy/cô bấm thêm bài kiểm tra trước, đặt tên và tạo, rồi mới soạn câu hỏi ở trình soạn.",
                "points": 2,
                "sequence": [
                    "Bấm \"+ Thêm bài kiểm tra\" trong bài học",
                    "Gõ tên và bấm \"Tạo bài kiểm tra\"",
                    "Mở trình soạn và thêm câu hỏi",
                    "Bấm \"Cài đặt\" để đặt thời gian và số lần làm",
                ],
            },
        ],
    },
}

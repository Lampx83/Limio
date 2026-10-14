# -*- coding: utf-8 -*-
from mockup import *

_FLOW = flow(
    [
        ("Học viên bấm \"Thảo luận\"", "Nút nằm ngay trong bài học"),
        ("Học viên bấm \"Đăng câu hỏi\"", "Câu hỏi hiện ở diễn đàn"),
        ("Thầy/cô mở chủ đề", "Trong \"Diễn đàn hỏi đáp\""),
        ("Đánh dấu câu trả lời", "Chủ đề chuyển sang \"Đã xử lý\""),
    ]
)

_FORUM = shot(
    "4-2-dien-dan-hoi-dap",
    "Hình minh hoạ: trang “Diễn đàn hỏi đáp” của giảng viên, đang lọc “Chưa giải đáp”.",
    "Trang /instructor/forum (tiêu đề \"Forum Q&A\"), tất cả khoá học. Dữ liệu mẫu có 4 chủ đề: 3 chưa giải đáp (một chủ đề đã quá 48 giờ, hiện nhãn \"Stale\"), 1 đã xử lý; ví dụ \"Đặt tên biến thế nào cho dễ đọc?\" và \"range(1, 5) có in ra số 5 không?\". "
    "Bộ lọc \"Chưa giải đáp\" đang chọn; thấy bốn thẻ số, bốn nút lọc, bảng chủ đề và nút \"Mở thread\" ở cuối dòng.",
    marks=["Nút lọc \"Chưa giải đáp\" đang chọn", "Một chủ đề chưa giải đáp", "Nút \"Mở thread\""],
)

_FORUM_LEGEND = legend(
    [
        "**Bộ lọc.** Có bốn nút: \"Tất cả\", \"Chưa giải đáp\", \"Stale >48h\" và \"Đã xử lý\". Trong ảnh, nút \"Chưa giải đáp\" đang được chọn. Thầy/cô nên mở nút này trước.",
        "**Một chủ đề chưa giải đáp.** Mỗi dòng là một câu hỏi của học viên chưa có câu trả lời được đánh dấu. Dòng cho biết khoá và bài học, tác giả, số câu trả lời, tuổi của câu hỏi và trạng thái.",
        "**Nút \"Mở thread\".** Thầy/cô bấm nút này để mở chủ đề, đọc câu hỏi, đọc các câu trả lời và đánh dấu câu trả lời đúng.",
    ]
)

_MENU = shot(
    "4-2-menu-chuot-phai",
    "Hình minh hoạ: đoạn chữ được bôi đen trong bài “Vòng lặp for” (chụp từ tài khoản học viên) và menu chuột phải có hai lựa chọn.",
    "Bài \"Vòng lặp for\" của khoá \"Nhập môn Lập trình\", đăng nhập bằng tài khoản học viên đã ghi danh (không phải chế độ xem trước). "
    "Bôi đen câu \"biến đếm nhận các giá trị từ 0 đến n - 1\" rồi bấm chuột phải. Chụp đoạn chữ có nền xanh nhạt và menu hai lựa chọn \"Viết annotation\", \"Hỏi AI về đoạn này\" ngay bên dưới.",
    marks=["Đoạn chữ được bôi đen", "Viết annotation", "Hỏi AI về đoạn này"],
)

_MENU_LEGEND = legend(
    [
        "**Đoạn chữ được bôi đen.** Đoạn được chọn có nền xanh nhạt. Học viên dùng chuột chọn đúng câu mình thắc mắc, rồi menu hiện ngay bên dưới.",
        "**Lựa chọn viết ghi chú.** Giao diện ghi \"Viết annotation\". Lựa chọn này mở ô để học viên viết ghi chú gắn vào đoạn chữ vừa chọn.",
        "**\"Hỏi AI về đoạn này\".** Lựa chọn này gửi đúng đoạn chữ vừa chọn cho trợ giảng AI để hỏi.",
    ]
)

LESSON = {
    "title": "Bài 4.2 · Thảo luận, ghi chú và hỏi AI trong bài",
    "durationMin": 5,
    "description": "Cách học viên đặt câu hỏi và ghi chú ngay trong bài học, và cách thầy/cô theo dõi, trả lời trong diễn đàn hỏi đáp.",
    "objectives": [
        "Xử lý được một câu hỏi của học viên trong diễn đàn hỏi đáp",
        "Giải thích được cách học viên ghi chú và hỏi AI về một đoạn chữ trong bài",
        "Phân biệt được ghi chú \"Riêng tư\" và ghi chú \"Cả lớp\"",
    ],
    "summary": [
        "Học viên đăng câu hỏi bằng nút \"Thảo luận\" trong bài; thầy/cô xử lý ở \"Diễn đàn hỏi đáp\" và bấm \"Đánh dấu là câu trả lời\" để chuyển chủ đề sang \"Đã xử lý\".",
        "Học viên bôi đen một đoạn chữ rồi bấm chuột phải để chọn viết ghi chú hoặc \"Hỏi AI về đoạn này\".",
        "Ghi chú có hai chế độ \"Riêng tư\" và \"Cả lớp\"; các tính năng này chỉ dùng được với người đã ghi danh và chủ khoá, không dùng được trong chế độ xem trước.",
    ],
    "body": (
        "\n## Thảo luận ngay trong bài học\n\n"
        "Học viên thường thắc mắc đúng lúc đang đọc một bài. Nếu phải rời bài để hỏi ở nơi khác, nhiều câu hỏi sẽ không bao giờ được hỏi. "
        "Vì vậy Limio đặt nút ngay trong bài học.\n\n"
        "Học viên bấm nút **Thảo luận** ở bài đang học, rồi bấm **Đăng câu hỏi** và viết câu hỏi của mình. "
        "Câu hỏi này xuất hiện ở diễn đàn của khoá học.\n\n"
        + _FLOW
        + "\n\nThầy/cô theo dõi các câu hỏi ở mục **Diễn đàn hỏi đáp**. Mục này nằm trong nhóm LMS (biểu tượng mũ cử nhân) trên thanh điều hướng, "
        "cạnh \"Khoá học của tôi\" và \"Bài tập\". Tiêu đề trang đang ghi \"Forum Q&A\".\n\n"
        "Ở đầu trang có bốn thẻ số: tổng số chủ đề, số chủ đề chưa giải đáp, số chủ đề đã xử lý và số chủ đề đã quá 48 giờ mà chưa giải đáp. "
        "Bên trái các nút lọc có danh sách chọn khoá, để thầy/cô chỉ xem một khoá.\n\n"
        + _FORUM
        + "\n\n"
        + _FORUM_LEGEND
        + "\n\nCác chủ đề được chia theo trạng thái.\n\n"
        "| Bộ lọc | Chủ đề hiện ra |\n"
        "|---|---|\n"
        "| Tất cả | Mọi câu hỏi của học viên |\n"
        "| Chưa giải đáp | Câu hỏi chưa có câu trả lời được đánh dấu, kể cả câu đã để quá lâu |\n"
        "| Nút thứ ba (quá 48 giờ) | Chỉ những câu hỏi để quá 48 giờ mà vẫn chưa có câu trả lời được đánh dấu |\n"
        "| Đã xử lý | Câu hỏi đã có câu trả lời được đánh dấu |\n\n"
        "Khi một câu hỏi để quá 48 giờ mà chưa được giải đáp, cột trạng thái của dòng đó đổi thành nhãn đỏ \"Stale\" (tạm hiểu là tồn đọng). Nhờ vậy thầy/cô không bỏ sót.\n\n"
        "Thầy/cô mở một chủ đề, đọc câu hỏi và các câu trả lời. Khi đã có câu trả lời đúng, thầy/cô bấm **Đánh dấu là câu trả lời**. "
        "Chủ đề lập tức chuyển sang \"Đã xử lý\" và biến khỏi danh sách \"Chưa giải đáp\".\n\n"
        "> [!meo] **Mỗi sáng mở \"Chưa giải đáp\" một lần.**\n"
        "> Danh sách này là việc cần làm của thầy/cô. Khi danh sách trống nghĩa là học viên đã được giải đáp hết.\n\n"
        "## Ghi chú theo vùng chọn\n\n"
        "Ngoài diễn đàn, học viên còn ghi chú thẳng lên đoạn chữ mình đang đọc. Cách làm gồm ba thao tác.\n\n"
        "1. Học viên dùng chuột **bôi đen** một đoạn chữ trong bài.\n"
        "2. Học viên bấm **chuột phải** vào đoạn vừa chọn.\n"
        "3. Học viên chọn một trong hai việc trong menu hiện ra.\n\n"
        + _MENU
        + "\n\n"
        + _MENU_LEGEND
        + "\n\nGhi chú ở đây là ghi chú gắn vào một đoạn chữ cụ thể trong bài. Mỗi ghi chú có hai chế độ.\n\n"
        "| Chế độ | Ai đọc được |\n"
        "|---|---|\n"
        "| Riêng tư | Chỉ người viết |\n"
        "| Cả lớp | Cả lớp cùng đọc (giao diện ghi \"Chia sẻ với cả lớp\") |\n\n"
        "> [!vi-du] **Cùng một đoạn chữ, hai cách dùng.**\n"
        "> Trong bài \"Vòng lặp for\", một học viên bôi đen câu \"biến đếm nhận các giá trị từ 0 đến n - 1\" rồi viết ghi chú \"Nhớ range dừng trước số cuối\" ở chế độ Riêng tư để tự nhớ. "
        "Học viên khác thắc mắc vì sao range(1, 5) không có số 5, viết câu hỏi ở chế độ Cả lớp để các học viên khác cùng thấy.\n\n"
        "## Hỏi AI và hạn mức\n\n"
        "Lựa chọn **Hỏi AI về đoạn này** gửi đúng đoạn chữ vừa bôi đen cho trợ giảng AI. Học viên không phải chép lại đoạn chữ vào ô hỏi.\n\n"
        "Trong bài còn có khung nổi **Trợ giảng AI**. Học viên mở khung này để hỏi thêm bất cứ lúc nào. "
        "Mỗi lần hỏi AI đều tính vào hạn mức Token AI của khoá. Token là đơn vị đo lượng chữ AI đọc và viết.\n\n"
        "> [!canh-bao] **Các tính năng này chỉ dành cho người đã ghi danh và chủ khoá.**\n"
        "> Khách chưa đăng nhập không dùng được, dù khoá đã đánh dấu công khai. Chế độ xem trước cũng không có các tính năng này. "
        "Muốn thử, thầy/cô mở bài học bình thường với tư cách chủ khoá.\n\n"
        + try_now(
            "Tự thử ghi chú và hỏi AI",
            [
                "Mở một bài học trong khoá của thầy/cô, không dùng chế độ xem trước.",
                "Bôi đen một câu trong phần văn bản rồi bấm chuột phải.",
                "Chọn lựa chọn thứ nhất của menu (viết ghi chú), viết một ghi chú ngắn ở chế độ \"Riêng tư\" rồi lưu.",
                "Bôi đen một câu khác, bấm chuột phải và chọn **Hỏi AI về đoạn này** để xem trợ giảng AI trả lời thế nào.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 4.2",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "4.2-danh-dau-tra-loi",
                "type": "mcq",
                "prompt": "Thầy/cô muốn chuyển một câu hỏi trong diễn đàn từ \"Chưa giải đáp\" sang \"Đã xử lý\". Thầy/cô làm gì?",
                "explanation": "Thầy/cô mở chủ đề rồi bấm \"Đánh dấu là câu trả lời\" ở câu trả lời phù hợp. Chủ đề tự chuyển sang \"Đã xử lý\".",
                "points": 1,
                "options": [
                    {"label": "Mở chủ đề và bấm \"Đánh dấu là câu trả lời\"", "isCorrect": True},
                    {"label": "Bấm bộ lọc \"Đã xử lý\" ở đầu trang", "isCorrect": False},
                    {"label": "Chờ học viên xoá câu hỏi", "isCorrect": False},
                    {"label": "Xuất bản lại khoá học", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-khoa-cong-khai",
                "type": "mcq",
                "prompt": "Một khoá đã đánh dấu công khai. Một khách chưa đăng nhập đang đọc bài và bôi đen một đoạn chữ. Điều gì đúng?",
                "explanation": "Công khai chỉ cho khách xem nội dung bài. Ghi chú, thảo luận và trợ giảng AI vẫn đòi đăng nhập.",
                "points": 1,
                "options": [
                    {"label": "Khách vẫn phải đăng nhập mới ghi chú hoặc hỏi AI được", "isCorrect": True},
                    {
                        "label": "Khách viết được ghi chú riêng tư mà không cần tài khoản",
                        "isCorrect": False,
                        "misconception": "limio.public-means-open",
                    },
                    {
                        "label": "Khách hỏi được AI, và lượt hỏi tính vào hạn mức của thầy/cô",
                        "isCorrect": False,
                        "misconception": "limio.public-means-open",
                    },
                    {"label": "Khách đăng được câu hỏi vào diễn đàn", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-che-do-ghi-chu",
                "type": "matching",
                "prompt": "Nối mỗi lựa chọn với tác dụng của nó.",
                "explanation": "Lựa chọn viết ghi chú lưu ghi chú gắn vào đoạn chữ; \"Hỏi AI về đoạn này\" hỏi AI về đoạn đó; chế độ \"Riêng tư\" chỉ người viết đọc được; chế độ \"Cả lớp\" để cả lớp cùng đọc.",
                "points": 2,
                "pairs": [
                    {"left": "Lựa chọn viết ghi chú", "right": "Lưu ghi chú gắn vào đoạn chữ đã chọn"},
                    {"left": "Hỏi AI về đoạn này", "right": "Gửi đoạn chữ đã chọn cho trợ giảng AI"},
                    {"left": "Riêng tư", "right": "Chỉ người viết đọc được ghi chú"},
                    {"left": "Cả lớp", "right": "Cả lớp cùng đọc được ghi chú"},
                ],
            },
            {
                "key": "4.2-xem-truoc",
                "type": "true_false",
                "prompt": "Thầy/cô có thể thử việc bôi đen đoạn chữ để viết ghi chú ngay trong chế độ xem trước của khoá học.",
                "explanation": "Sai. Ghi chú theo vùng chọn và hỏi AI chỉ dùng được với người đã ghi danh và chủ khoá, không có trong chế độ xem trước.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
        ],
    },
}

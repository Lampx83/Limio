# -*- coding: utf-8 -*-
from mockup import *

_HEADER = shot(
    "1-4-dau-trang-khoa-nhap",
    "Đầu trang của một khoá còn ở trạng thái Nháp.",
    "Trang /instructor/courses/{id} của khoá \"Hướng dẫn sử dụng Limio\" còn Nháp, đang mở tab \"Nội dung\". "
    "Chụp phần đầu trang: nút xanh \"Publish\" ở góc phải, tên khoá kèm chip \"Nháp\" và nút \"Chế độ đứng lớp\", "
    "hàng tab (chỉ có Tổng quan và Nội dung), và nút \"Xem trước\" ở dòng tiêu đề \"Modules\".",
    [
        "Chip \"Nháp\"",
        "Nút \"Chế độ đứng lớp\"",
        "Nút \"Publish\"",
        "Hàng tab (\"Tổng quan\", \"Nội dung\")",
        "Nút \"Xem trước\"",
    ],
)

_HEADER_LEGEND = legend(
    [
        "**Chip \"Nháp\".** Nhãn cho biết khoá đang ở trạng thái nào: \"Nháp\", \"Đã publish\" (đã xuất bản) hoặc Lưu trữ.",
        "**Nút \"Chế độ đứng lớp\".** Mở bài ở tab mới để thầy/cô trình chiếu tại lớp.",
        "**Nút \"Publish\".** Nút xanh ở góc trên bên phải. Bấm nút này thì khoá chuyển từ Nháp sang đã xuất bản. Khi xuất bản xong, nút biến mất.",
        "**Hàng tab.** Khoá còn Nháp chỉ có hai tab là \"Tổng quan\" và \"Nội dung\". Ô giá và ô \"Công khai\" nằm ở tab \"Tổng quan\" (phần sau nói kỹ).",
        "**Nút \"Xem trước\".** Mở cả khoá đúng như học viên thấy, ở tab mới. Nút \"Xem như học viên\" của riêng từng bài nằm trong trang của bài (hình 1.3).",
    ]
)

_STATES = flow(
    [
        ("Nháp", "Khoá mới tạo. Chỉ thầy/cô thấy"),
        ("Bấm \"Publish\"", "Nút xanh ở đầu trang"),
        ("Đã xuất bản", "Học viên thấy khoá. Nút \"Publish\" biến mất"),
        ("Lưu trữ", "Khi thầy/cô muốn ngừng khoá, ở mục \"Hành động khóa\""),
    ]
)

_PUBLIC = shot(
    "1-4-o-cong-khai",
    "Ô giá và ô \"Công khai\" trong biểu mẫu mở bằng nút \"Sửa\" ở tab Tổng quan.",
    "Khoá \"Nhập môn Lập trình\" (kiểu truy cập \"Mở\"), tab \"Tổng quan\", bấm nút \"Sửa\" để mở biểu mẫu. "
    "Cuộn tới nhóm \"Ai vào được khoá này\", chụp từ nhóm này tới ô chọn \"Công khai — xem được không cần đăng nhập\" "
    "(đang bỏ chọn), thấy cả ô giá \"Để trống = miễn phí\" kèm ô chọn USD.",
    [
        "Nhóm \"Ai vào được khoá này\"",
        "Ô giá (\"Để trống = miễn phí\")",
        "Ô \"Công khai — xem được không cần đăng nhập\"",
    ],
)

_PUBLIC_LEGEND = legend(
    [
        "**Nhóm \"Ai vào được khoá này\".** Hai lựa chọn đã gặp ở bài 1.2. Ô giá chỉ hiện khi thầy/cô chọn \"Mở — ai cũng tự đăng ký được\".",
        "**Ô giá.** Để trống nghĩa là miễn phí. Thầy/cô nhập số tiền theo đơn vị xu của đô la Mỹ (giao diện ghi \"cents\"), nên 999 nghĩa là 9,99 đô la. Nếu đặt giá, hệ thống sinh mã kích hoạt ở mục bên dưới sau khi lưu.",
        "**Ô \"Công khai\".** Ô chọn cho phép người chưa đăng nhập xem nội dung. Ô này chỉ có tác dụng sau khi khoá đã xuất bản.",
    ]
)

_PUBLIC_TABLE = (
    "| Người chưa đăng nhập | Có làm được không |\n"
    "|---|---|\n"
    "| Đọc nội dung và xem video của các bài | Được |\n"
    "| Làm bài kiểm tra | Không, vẫn phải đăng nhập |\n"
    "| Ghi chú, thảo luận | Không, vẫn phải đăng nhập |\n"
    "| Hỏi trợ lý AI | Không, vẫn phải đăng nhập |\n"
    "| Lưu tiến độ học | Không, vẫn phải đăng nhập |\n"
)

LESSON = {
    "title": "Bài 1.4 · Xem thử, xuất bản và đón học viên",
    "durationMin": 6,
    "description": "Thầy/cô xem khoá như học viên, xuất bản khoá, hiểu ô \"Công khai\" và biết học viên vào khoá bằng cách nào.",
    "objectives": [
        "Phân biệt được ba cách xem thử khoá",
        "Xuất bản được khoá và nói đúng điều gì thay đổi",
        "Giải thích được ô \"Công khai\" làm được gì và không làm được gì",
    ],
    "summary": [
        "Khoá mới tạo là Nháp. Học viên chỉ thấy khoá sau khi thầy/cô bấm nút \"Publish\" (xuất bản), và các bài mẫu trống cũng bị xuất bản theo.",
        "Có ba cách xem thử: \"Xem như học viên\" cho một bài, \"Xem trước\" cho cả khoá, \"Chế độ đứng lớp\" để trình chiếu.",
        "Ô \"Công khai\" nằm trong biểu mẫu mở bằng nút \"Sửa\" ở tab Tổng quan, và chỉ cho người chưa đăng nhập xem nội dung. Học viên vào học bằng kiểu \"Mở\" hoặc bằng đường dẫn mời lớp.",
    ],
    "body": (
        "\n"
        "## Xem thử trước khi xuất bản\n\n"
        "Thầy/cô nên tự xem khoá một lần trước khi học viên thấy. Limio có ba cách xem, và cả ba đều mở ở tab mới nên trang soạn của thầy/cô vẫn còn nguyên.\n\n"
        + _HEADER
        + "\n\n"
        + _HEADER_LEGEND
        + "\n\n"
        "| Cách xem | Nằm ở đâu | Dùng khi nào |\n"
        "|---|---|---|\n"
        "| Xem như học viên | Trang của từng bài, góc trên bên phải | Kiểm tra riêng một bài, chỉ thấy tên bài và nội dung |\n"
        "| Xem trước | Tab Nội dung, góc trên bên phải của danh sách chương | Xem cả khoá đúng như học viên thấy |\n"
        "| Chế độ đứng lớp | Đầu trang khoá học, cạnh tên khoá | Trình chiếu bài đang chọn trước lớp |\n\n"
        "> [!ghi-nho] **Bài đang ẩn thì không xem thử được.**\n"
        "> Nút \"Xem như học viên\" bị mờ khi bài đang ẩn, vì học viên cũng không thấy bài đó. Thầy/cô bật lại công tắc \"Hiện bài này\" ở menu \"⋮\" của bài nếu muốn xem.\n\n"
        "## Xuất bản khoá\n\n"
        "Khoá là Nháp cho tới khi thầy/cô bấm nút xanh **\"Publish\"** (xuất bản) ở góc trên bên phải. Sau khi bấm, chip trạng thái đổi sang \"Đã publish\" và nút biến mất. "
        "Khi khoá còn Nháp, trang soạn chỉ có hai tab là Tổng quan và Nội dung.\n\n"
        + _STATES
        + "\n\n"
        "> [!canh-bao] **Bài và chương mẫu trống cũng được xuất bản.**\n"
        "> Hệ thống không kiểm tra khoá rỗng. Nếu thầy/cô còn các bài mẫu trống từ bài 1.2, học viên sẽ thấy chúng. "
        "Thầy/cô nên đổi tên hoặc xoá những bài không dùng trước khi bấm \"Publish\".\n\n"
        "Nếu khoá bật cá nhân hoá, bước xuất bản còn tự gắn chủ đề cho các bài học chưa có. Thầy/cô không phải làm thêm gì.\n\n"
        "## Ô \"Công khai\": làm được gì, không làm được gì\n\n"
        "Tab Tổng quan hiện bản tóm tắt của khoá, chỉ để đọc. Thầy/cô bấm nút \"Sửa\" ở tab này thì mở ra biểu mẫu có ô giá và ô chọn \"Công khai — xem được không cần đăng nhập\". "
        "Thầy/cô bấm nút lưu ở cuối biểu mẫu để giữ thay đổi. Ô \"Công khai\" chỉ có tác dụng sau khi khoá đã xuất bản.\n\n"
        + _PUBLIC
        + "\n\n"
        + _PUBLIC_LEGEND
        + "\n\n"
        + _PUBLIC_TABLE
        + "\n"
        "> [!canh-bao] **Công khai không có nghĩa là mở hoàn toàn.**\n"
        "> Người chưa đăng nhập chỉ đọc được nội dung. Muốn làm bài kiểm tra, ghi chú, thảo luận hay hỏi trợ lý AI, người học vẫn phải đăng nhập. "
        "Vì vậy thầy/cô vẫn cần mời học viên ghi danh nếu muốn theo dõi tiến độ của họ.\n\n"
        "## Học viên vào khoá bằng cách nào\n\n"
        "Cách vào phụ thuộc vào kiểu \"Ai vào được khoá này\" thầy/cô đã chọn ở bài 1.2.\n\n"
        "- **Kiểu \"Mở — ai cũng tự đăng ký được\".** Trang giới thiệu khoá có nút đăng ký, và học viên tự ghi danh. Để trống ô giá thì khoá miễn phí; nếu có giá, học viên nhập mã kích hoạt.\n"
        "- **Kiểu \"Chỉ vào bằng link mời lớp\".** Thầy/cô tạo lớp ở tab Lớp học và gửi đường dẫn mời của lớp. "
        "Học viên bấm vào đường dẫn, thấy trang \"Lời mời tham gia lớp học\" rồi bấm \"Vào học\".\n\n"
        "Cách tạo lớp và gửi đường dẫn mời nằm ở bài 4.1. Các tab Học viên và Lớp học chỉ hiện đầy đủ khi khoá đã xuất bản.\n\n"
        + try_now(
            "Xem thử khoá rồi xuất bản",
            [
                "Ở tab **Nội dung**, bấm nút **Xem trước** ở góc trên bên phải của danh sách chương, rồi nhìn khoá như học viên sẽ thấy.",
                "Quay lại trang soạn, xoá hoặc đổi tên mọi bài mẫu trống mà thầy/cô không dùng.",
                "Chỉ khi khoá đã sẵn sàng, bấm nút xanh **Publish** ở góc trên bên phải của trang.",
                "Kiểm tra chip trạng thái đã đổi từ \"Nháp\" sang \"Đã publish\" và nút \"Publish\" đã biến mất.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 1.4",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "1.4-can-xuat-ban",
                "type": "mcq",
                "prompt": "Thầy/cô đã dựng xong khoá và muốn học viên thấy khoá. Việc cần làm là gì?",
                "explanation": "Khoá mới tạo ở trạng thái Nháp. Học viên chỉ thấy khoá sau khi thầy/cô bấm nút \"Publish\" (xuất bản) ở đầu trang.",
                "points": 1,
                "options": [
                    {"label": "Bấm nút \"Publish\" (xuất bản) ở đầu trang khoá học", "isCorrect": True},
                    {
                        "label": "Không cần làm gì, khoá tạo xong là học viên thấy ngay",
                        "isCorrect": False,
                        "misconception": "limio.draft-visible",
                    },
                    {"label": "Bấm \"Chế độ đứng lớp\"", "isCorrect": False},
                    {"label": "Chỉ cần bật ô \"Công khai\"", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-bai-mau-trong",
                "type": "true_false",
                "prompt": "Nếu khoá còn các bài học mẫu trống, hệ thống sẽ chặn không cho xuất bản.",
                "explanation": "Sai. Hệ thống không kiểm tra khoá rỗng, nên các bài trống vẫn được xuất bản và học viên sẽ thấy chúng.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "limio.scaffold-left-behind"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.4-cong-khai",
                "type": "mcq",
                "prompt": "Khoá đã xuất bản và đánh dấu \"Công khai\". Một người chưa đăng nhập làm được việc nào?",
                "explanation": "Công khai chỉ cho người chưa đăng nhập xem nội dung bài. Làm bài kiểm tra, ghi chú, thảo luận và hỏi trợ lý AI đều đòi đăng nhập.",
                "points": 1,
                "options": [
                    {"label": "Đọc nội dung các bài", "isCorrect": True},
                    {
                        "label": "Làm bài kiểm tra cuối bài",
                        "isCorrect": False,
                        "misconception": "limio.public-means-open",
                    },
                    {
                        "label": "Hỏi trợ lý AI về một đoạn trong bài",
                        "isCorrect": False,
                        "misconception": "limio.public-means-open",
                    },
                    {
                        "label": "Đăng câu hỏi vào phần thảo luận",
                        "isCorrect": False,
                        "misconception": "limio.public-means-open",
                    },
                ],
            },
            {
                "key": "1.4-ba-cach-xem",
                "type": "matching",
                "prompt": "Nối mỗi nút xem thử với việc nó làm.",
                "explanation": "\"Xem như học viên\" mở riêng một bài. \"Xem trước\" mở cả khoá. \"Chế độ đứng lớp\" mở bài ở chế độ giảng dạy để trình chiếu.",
                "points": 2,
                "pairs": [
                    {"left": "Xem như học viên", "right": "Mở riêng một bài đúng như học viên thấy"},
                    {"left": "Xem trước", "right": "Mở cả khoá đúng như học viên thấy"},
                    {"left": "Chế độ đứng lớp", "right": "Mở bài ở chế độ giảng dạy để trình chiếu tại lớp"},
                ],
            },
        ],
    },
}

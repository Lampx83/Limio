# -*- coding: utf-8 -*-
from mockup import *

_CONTENT_TAB = shot(
    "1-3-tab-noi-dung",
    "Tab Nội dung của một khoá có các chương và bài học.",
    "Trang /instructor/courses/{id} đang ở tab \"Nội dung\" của khoá \"Hướng dẫn sử dụng Limio\" (còn Nháp), thấy tiêu đề \"Modules\" kèm \"4 modules · 12 bài\", nút \"Xem trước\", ô \"Tìm bài học…\", \"Gập hết\", \"Mở hết\". "
    "Rê chuột vào hàng Chương 1 để hiện hàng nút ẩn/hiện, khoá, sửa, xoá; chương này mở sẵn các bài 1.1 tới 1.4 và nút \"+ Thêm lesson\" ở cuối chương.",
    [
        "Ô tìm bài học (cùng nút Gập hết, Mở hết)",
        "Nút \"Xem trước\"",
        "Nút sửa chương (bút chì)",
        "Một dòng bài học",
        "Nút \"+ Thêm lesson\"",
    ],
)

_CONTENT_LEGEND = legend(
    [
        "**Ô tìm bài học.** Thầy/cô gõ vào ô \"Tìm bài học…\" để tìm nhanh một bài. Hai nút \"Gập hết\" và \"Mở hết\" ngay bên phải thu hoặc mở mọi chương. Tiêu đề phía trên ghi \"Modules\" (chương), kèm tổng số chương và số bài.",
        "**Nút \"Xem trước\".** Mở khoá đúng như học viên thấy. Bài 1.4 nói kỹ nút này.",
        "**Nút sửa chương.** Bút chì nằm trong hàng nút của chương, hàng này chỉ hiện khi thầy/cô rê chuột vào chương. Từ trái sang phải là mắt (ẩn hoặc hiện chương), ổ khoá (khoá chương), bút chì (sửa chương) và thùng rác (xoá chương).",
        "**Một dòng bài học.** Mỗi dòng là một bài, ghi số thứ tự và tên bài. Bên phải là số khối nội dung (biểu tượng tờ giấy) và số câu hỏi. Thầy/cô bấm vào dòng để mở trang của bài.",
        "**Nút \"+ Thêm lesson\".** Nút gạch đứt ở cuối mỗi chương, dùng để thêm một bài học (lesson) mới vào chương đó.",
    ]
)

_LESSON_PAGE = shot(
    "1-3-trang-bai-hoc",
    "Trang của một bài học, sau khi bấm vào dòng bài ở tab Nội dung.",
    "Từ tab \"Nội dung\" của khoá \"Hướng dẫn sử dụng Limio\", bấm vào dòng \"Bài 1.1 · Làm quen với Limio\". Chụp trang bài: tên bài kèm bút chì, nút \"Xem như học viên\", chip \"1 chủ đề\", menu \"⋮\", danh sách \"Hoạt động (4)\" "
    "có tay cầm kéo thả và nút \"Mở trình soạn\" ở mỗi khối, và nút \"+ Thêm hoạt động/tài nguyên\" ở cuối.",
    [
        "Nút \"Xem như học viên\"",
        "Chip \"1 chủ đề\"",
        "Tay cầm kéo thả",
        "Nút \"Mở trình soạn\"",
        "Nút \"+ Thêm hoạt động/tài nguyên\"",
    ],
)

_LESSON_PAGE_LEGEND = legend(
    [
        "**Nút \"Xem như học viên\".** Mở riêng bài này đúng như học viên thấy. Bài 1.4 nói kỹ nút này. Bên cạnh tên bài có bút chì để đổi tên, và dưới nút này là menu \"⋮\" (hình sau).",
        "**Chip \"1 chủ đề\".** Cho biết bài đang gắn với một chủ đề kiến thức. Khi khoá bật cá nhân hoá, mỗi bài tự thành một chủ đề. Bài 3.2 nói thêm.",
        "**Tay cầm kéo thả.** Ô nhỏ có ba gạch ngang ở bên trái mỗi khối. Thầy/cô nắm tay cầm này để kéo khối lên hoặc xuống.",
        "**Nút \"Mở trình soạn\".** Mỗi khối trong danh sách \"Hoạt động (4)\" có một nút này để mở trình soạn riêng của khối. Cạnh nút còn có ba biểu tượng nhỏ: mắt, bút chì và thùng rác.",
        "**Nút \"+ Thêm hoạt động/tài nguyên\".** Nút gạch đứt ở cuối danh sách, dùng để thêm khối mới vào bài.",
    ]
)

_LESSON_MENU = shot(
    "1-3-menu-bai-hoc",
    "Menu \"⋮\" của một bài học.",
    "Ở trang bài \"Bài 1.1 · Làm quen với Limio\", bấm biểu tượng ba chấm dọc \"⋮\" ngay dưới nút \"Xem như học viên\" để menu mở ra. "
    "Chụp vùng góc trên bên phải của trang bài cùng menu đang mở: ba công tắc Hiện bài này / Khoá nội dung / Cho xem thử, rồi Nhân bản bài, Chuyển lên, Chuyển xuống, Chuyển sang module khác và Xóa bài học.",
    [
        "Công tắc \"Hiện bài này\"",
        "Công tắc \"Khoá nội dung\"",
        "Công tắc \"Cho xem thử\"",
        "\"Chuyển sang module khác\"",
        "\"Xóa bài học\"",
    ],
)

_LESSON_MENU_LEGEND = legend(
    [
        "**Công tắc \"Hiện bài này\".** Đang bật thì học viên thấy bài. Tắt đi thì bài bị ẩn hoàn toàn khỏi học viên.",
        "**Công tắc \"Khoá nội dung\".** Bật lên thì học viên thấy tên bài nhưng chưa mở được.",
        "**Công tắc \"Cho xem thử\".** Bật lên thì người chưa ghi danh cũng xem được bài này.",
        "**\"Chuyển sang module khác\".** Mục có mũi tên bên phải, bấm vào để chọn chương khác. Ngay trên đó còn có \"Nhân bản bài\", \"Chuyển lên\" và \"Chuyển xuống\".",
        "**\"Xóa bài học\".** Mục chữ đỏ ở cuối menu, dùng để xoá bài khỏi khoá. Thầy/cô cân nhắc kỹ trước khi bấm.",
    ]
)

_PICKER = shot(
    "1-3-chon-khoi-noi-dung",
    "Hộp thoại \"Thêm hoạt động/tài nguyên\" khi bấm nút \"+ Thêm hoạt động/tài nguyên\".",
    "Mở một bài học trong tab \"Nội dung\" của khoá \"Hướng dẫn sử dụng Limio\", bấm nút \"+ Thêm hoạt động/tài nguyên\". "
    "Chụp hộp thoại đang mở ở bộ lọc \"Tất cả\": thấy ô \"Tìm hoạt động...\", ba bộ lọc Tất cả / Tài nguyên / Hoạt động, "
    "nhóm \"Tài nguyên\" (Văn bản — AI hỗ trợ, Ghi chú giảng viên, Video, PDF…) và nhóm \"Hoạt động\" (Quiz, Assignment, SCORM, H5P, LTI).",
    [
        "Ô tìm \"Tìm hoạt động...\"",
        "Bộ lọc \"Tất cả\"",
        "Thẻ \"Văn bản — AI hỗ trợ\"",
        "Thẻ \"Ghi chú giảng viên\"",
        "Thẻ \"Quiz\"",
    ],
)

_PICKER_LEGEND = legend(
    [
        "**Ô tìm.** Thầy/cô gõ tên khối cần tìm vào ô \"Tìm hoạt động...\".",
        "**Ba bộ lọc.** \"Tất cả\" (đang chọn), \"Tài nguyên\" và \"Hoạt động\". Bấm \"Tài nguyên\" hoặc \"Hoạt động\" để thu hẹp danh sách. Dưới đó là hai nhóm thẻ có đề mục \"Tài nguyên\" và \"Hoạt động\".",
        "**Thẻ \"Văn bản — AI hỗ trợ\".** Thẻ đầu tiên của nhóm tài nguyên, có nhãn \"AI supported\". Thầy/cô dán chữ thô vào, AI định dạng giúp.",
        "**Thẻ \"Ghi chú giảng viên\".** Khối chỉ thầy/cô thấy khi dạy. Học viên và bản in của họ không có khối này.",
        "**Thẻ \"Quiz\".** Thẻ đầu tiên của nhóm hoạt động, là bài kiểm tra. Thẻ \"Assignment\" ngay bên cạnh là bài tập. Hai loại này là việc học viên phải làm.",
    ]
)

LESSON = {
    "title": "Bài 1.3 · Dựng chương, bài học và nội dung",
    "durationMin": 6,
    "description": "Thầy/cô sắp xếp chương và bài học ở tab Nội dung, rồi thêm các khối văn bản, video, tệp vào từng bài.",
    "objectives": [
        "Thêm, sửa và đổi thứ tự chương, bài học",
        "Thêm được văn bản, video, tệp vào một bài bằng nút \"+ Thêm hoạt động/tài nguyên\"",
        "Chọn đúng loại khối cho từng nhu cầu và sắp xếp lại bằng kéo thả",
    ],
    "summary": [
        "Khoá có ba tầng: khoá, chương, bài học. Mỗi bài chứa nhiều khối nội dung.",
        "Chương đổi thứ tự bằng ô số thứ tự khi sửa chương, không kéo thả được. Bài học chuyển chỗ bằng menu \"⋮\" trong trang của bài.",
        "Khối nội dung thêm bằng \"+ Thêm hoạt động/tài nguyên\" ở trang của bài, và kéo thả bằng tay cầm để đổi thứ tự.",
    ],
    "body": (
        "\n"
        "## Tab Nội dung: bản đồ của khoá học\n\n"
        "Khoá học trong Limio có ba tầng. **Chương** gom các bài cùng chủ đề. **Bài học** là một buổi học nhỏ. "
        "**Khối nội dung** là từng mảnh bên trong bài, như một đoạn văn bản hay một video.\n\n"
        "Thầy/cô làm việc với cả ba tầng ở tab **Nội dung**. Ngay sau khi tạo khoá, tab này đã có khung dựng sẵn từ bài 1.2. Giao diện hiện còn gọi chương là \"module\" và bài học là \"lesson\"; khoá này dùng tên tiếng Việt.\n\n"
        + _CONTENT_TAB
        + "\n\n"
        + _CONTENT_LEGEND
        + "\n\n## Làm việc với chương\n\n"
        "Cuối danh sách chương có nút gạch đứt \"+ Thêm module\" (ảnh trên chưa chụp tới chỗ này, thầy/cô kéo trang xuống cuối). "
        "Thầy/cô bấm nút này để thêm một chương mới, rồi đặt tên cho chương, ví dụ \"Cấu trúc điều khiển\" cho chương dạy câu lệnh if và vòng lặp for.\n\n"
        "Để sửa một chương, thầy/cô rê chuột vào chương rồi bấm biểu tượng bút chì (\"Sửa module\"). Ở đó có hai ô: **tên chương** và ô \"Order\" là **số thứ tự**.\n\n"
        "> [!canh-bao] **Chương không kéo thả được.**\n"
        "> Muốn đưa chương lên trước hay xuống sau, thầy/cô đổi số ở ô số thứ tự rồi lưu. Cùng hàng nút đó, chương còn có thể ẩn, khoá hoặc xoá.\n\n"
        "## Làm việc với bài học\n\n"
        "Để thêm bài học, thầy/cô bấm nút \"+ Thêm lesson\" ở cuối chương, rồi điền tên bài và mô tả ngắn (không bắt buộc), sau đó bấm nút tạo.\n\n"
        "Để làm việc với một bài, thầy/cô bấm vào dòng của bài ở tab Nội dung. Trang của bài mở ra như hình dưới. Muốn quay lại danh sách chương, thầy/cô bấm \"← Danh sách module\" ở phía trên trang bài.\n\n"
        + _LESSON_PAGE
        + "\n\n"
        + _LESSON_PAGE_LEGEND
        + "\n\nMenu \"⋮\" nằm ở góc trên bên phải trang bài, ngay dưới nút \"Xem như học viên\". Menu này chứa các thao tác với cả bài.\n\n"
        + _LESSON_MENU
        + "\n\n"
        + _LESSON_MENU_LEGEND
        + "\n\n"
        "| Mục trong menu \"⋮\" | Tác dụng |\n"
        "|---|---|\n"
        "| Hiện bài này | Tắt đi thì bài bị ẩn hoàn toàn khỏi học viên |\n"
        "| Khoá nội dung | Học viên thấy tên bài nhưng chưa mở được |\n"
        "| Cho xem thử | Người chưa ghi danh cũng xem được bài này |\n"
        "| Nhân bản bài | Tạo một bản sao của bài |\n"
        "| Chuyển lên, Chuyển xuống | Đổi chỗ bài trong cùng chương; \"Chuyển lên\" bị mờ khi bài đã đứng đầu chương |\n"
        "| Chuyển sang module khác | Đưa bài sang một chương khác của khoá |\n"
        "| Xóa bài học | Xoá bài khỏi khoá |\n\n"
        "> [!meo] **Muốn nháp một bài mà chưa cho học viên thấy.**\n"
        "> Thầy/cô tắt công tắc \"Hiện bài này\" trong menu \"⋮\". Khi soạn xong, thầy/cô bật lại.\n\n"
        "## Thêm nội dung vào bài\n\n"
        "Ở cuối danh sách khối của bài, thầy/cô bấm **+ Thêm hoạt động/tài nguyên**. Một hộp thoại hiện ra để thầy/cô chọn loại khối.\n\n"
        + _PICKER
        + "\n\n"
        + _PICKER_LEGEND
        + "\n\n"
        "**Tài nguyên thầy/cô dùng nhiều nhất:**\n\n"
        "| Loại khối | Dùng khi nào |\n"
        "|---|---|\n"
        "| Văn bản — AI hỗ trợ | Thầy/cô dán chữ thô rồi bấm \"Định dạng bằng AI\" để hệ thống chia đề mục, danh sách. Hoặc tải một tệp Word (.docx) lên |\n"
        "| Ghi chú giảng viên | Ghi nhớ riêng cho thầy/cô. Học viên và bản in không thấy khối này |\n"
        "| Video | Dán đường dẫn YouTube, Vimeo, Loom, Wistia, Bunny, Mux hoặc tải tệp (tối đa 500 MB). Có thể chèn câu hỏi giữa video |\n"
        "| PDF | Tài liệu in sẵn, giáo trình, đề cương |\n"
        "| File đính kèm (tệp đính kèm) | Tệp cho học viên tải về, như bảng tính Excel hay bài mẫu |\n"
        "| Link ngoài (liên kết ngoài) | Trỏ học viên tới một trang web khác |\n\n"
        "Ngoài ra còn có khối \"Richtext editor\" (tự soạn văn bản có định dạng, không qua AI), khối \"Markdown\" (gõ chữ thô), khối \"Embed\" (nhúng nội dung từ trang khác) và khối \"HTML tự tải lên\".\n\n"
        "**Hoạt động** là việc học viên phải làm. Hai loại thầy/cô gặp nhiều nhất là **bài kiểm tra** (thẻ \"Quiz\", chương 2 sẽ hướng dẫn) và **bài tập** (thẻ \"Assignment\", chương 3). "
        "Hộp thoại còn có các gói nội dung làm sẵn theo chuẩn SCORM, H5P và LTI cho thầy/cô nào đã có sẵn từ nơi khác.\n\n"
        "> [!ghi-nho] **Ghi chú giảng viên chỉ thầy/cô thấy.**\n"
        "> Học viên không thấy khối này, và bản in của bài cũng không có. Thầy/cô dùng nó để nhắc mình ý định dạy hoặc đáp án gợi ý.\n\n"
        "**Đổi thứ tự các khối.** Mỗi khối trong danh sách \"Hoạt động\" có một tay cầm ở bên trái (tên là \"Kéo để sắp xếp\"). Thầy/cô nắm tay cầm, kéo khối tới vị trí mới rồi thả.\n\n"
        + try_now(
            "Dựng một bài học thật trong khoá thử",
            [
                "Ở tab **Nội dung** của khoá thử, bấm vào dòng một bài học trống để mở trang của bài.",
                "Bấm **+ Thêm hoạt động/tài nguyên**, chọn **Văn bản — AI hỗ trợ**, dán vài câu rồi bấm **Định dạng bằng AI**.",
                "Bấm **+ Thêm hoạt động/tài nguyên** lần nữa và thêm một khối **Ghi chú giảng viên**.",
                "Nắm tay cầm (ô có ba gạch ngang) ở bên trái khối ghi chú, kéo lên trên khối văn bản rồi thả.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 1.3",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "1.3-doi-thu-tu-chuong",
                "type": "mcq",
                "prompt": "Thầy/cô muốn đưa Chương 3 lên đứng trước Chương 2. Thầy/cô làm cách nào?",
                "explanation": "Chương không kéo thả được. Thầy/cô bấm bút chì sửa chương và đổi số ở ô số thứ tự. Bài học thì chuyển chỗ bằng menu \"⋮\" của bài, và khối nội dung mới kéo thả được.",
                "points": 1,
                "options": [
                    {"label": "Sửa chương và đổi số ở ô số thứ tự", "isCorrect": True},
                    {"label": "Kéo thả Chương 3 lên trên Chương 2", "isCorrect": False},
                    {"label": "Bấm biểu tượng mắt ở hàng nút của Chương 2", "isCorrect": False},
                    {"label": "Xoá Chương 2 rồi tạo lại", "isCorrect": False},
                ],
            },
            {
                "key": "1.3-ghi-chu-giang-vien",
                "type": "true_false",
                "prompt": "Khối \"Ghi chú giảng viên\" hiện cho cả học viên khi họ đọc bài.",
                "explanation": "Sai. Chỉ giảng viên thấy khối này. Học viên và bản in của họ đều không có nó.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.3-menu-bai-hoc",
                "type": "matching",
                "prompt": "Nối mục trong menu \"⋮\" của bài học với tác dụng của nó.",
                "explanation": "\"Hiện bài này\" bật hoặc tắt việc học viên thấy bài. \"Khoá nội dung\" cho học viên thấy tên nhưng chưa mở được. \"Cho xem thử\" mở bài cho cả người chưa ghi danh. \"Nhân bản bài\" tạo bản sao.",
                "points": 2,
                "pairs": [
                    {"left": "Hiện bài này (tắt)", "right": "Ẩn hoàn toàn bài khỏi học viên"},
                    {"left": "Khoá nội dung", "right": "Học viên thấy tên bài nhưng chưa mở được"},
                    {"left": "Cho xem thử", "right": "Người chưa ghi danh cũng xem được bài"},
                    {"left": "Nhân bản bài", "right": "Tạo một bản sao của bài"},
                ],
            },
            {
                "key": "1.3-chon-loai-khoi",
                "type": "mcq",
                "prompt": "Thầy/cô có một bài giảng soạn sẵn trong tệp Word. Cách nhanh nhất để đưa vào bài là gì?",
                "explanation": "Khối \"Văn bản — AI hỗ trợ\" cho phép tải tệp Word (.docx) lên, hoặc dán chữ rồi bấm \"Định dạng bằng AI\". Khối PDF và \"File đính kèm\" chỉ để học viên xem hoặc tải về, không biến chữ thành bài đọc.",
                "points": 1,
                "options": [
                    {"label": "Dùng khối \"Văn bản — AI hỗ trợ\" và tải tệp Word lên", "isCorrect": True},
                    {"label": "Dùng khối \"Ghi chú giảng viên\"", "isCorrect": False},
                    {"label": "Dùng khối \"Video\"", "isCorrect": False},
                    {"label": "Dùng khối \"Link ngoài\"", "isCorrect": False},
                ],
            },
        ],
    },
}

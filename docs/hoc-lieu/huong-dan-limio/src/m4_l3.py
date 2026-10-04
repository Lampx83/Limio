# -*- coding: utf-8 -*-
from mockup import *

_HOME = shot(
    "4-3-trang-chu-giang-vien",
    "Hình minh hoạ: trang chủ của giảng viên với phần “Cần xử lý gấp”, lịch và “Hoạt động gần đây”.",
    "Trang /instructor/dashboard của giảng viên mẫu (2 khoá đang dạy, 36 học viên). Thấy lời chào, bốn thẻ số, mục \"Cần xử lý gấp\" với thẻ \"1 thread forum > 48h chưa giải đáp\" và \"14 assignment chờ chấm\", "
    "lịch ở chế độ Tháng (nút \"Tuần\" / \"Tháng\", \"Hôm nay\") và đầu mục \"Hoạt động gần đây\" ở cột phải.",
    marks=["Cần xử lý gấp", "Hoạt động gần đây", "Lịch"],
)

_HOME_LEGEND = legend(
    [
        "**Phần \"Cần xử lý gấp\".** Những việc đang chờ thầy/cô, xếp theo độ ưu tiên và chia nhóm \"Gấp\" và \"Có thể chờ\". Trong ảnh có hai thẻ: \"1 thread forum > 48h chưa giải đáp\" (một chủ đề diễn đàn đã quá 48 giờ chưa có câu trả lời) và \"14 assignment chờ chấm\" (14 bài tập chờ chấm). Mũi tên bên phải thẻ cho biết bấm vào là đi tới nơi xử lý.",
        "**Hoạt động gần đây.** Mục này nằm dưới lịch, ở cột bên phải. Dòng \"72h qua\" cho biết đây là hoạt động của học viên trong ba ngày gần nhất.",
        "**Lịch.** Thầy/cô chuyển giữa chế độ \"Tuần\" và \"Tháng\", lật tháng bằng nút \"Trước\" và \"Sau\", bấm \"Hôm nay\" để về ngày hiện tại. Ngày có hạn được chấm nhỏ bên dưới. Lịch chỉ hiện hạn bài tập và hạn bài kiểm tra.",
    ]
)

_GAMI = shot(
    "4-3-muc-gamification",
    "Hình minh hoạ: mục thành tích của khoá học (tab “Gamification”), giảng viên chỉ xem số liệu.",
    "Trang /instructor/courses/{id}, tab \"Gamification\" đang mở, khoá \"Nhập môn Lập trình\" (36 học viên chia ba lớp K65-CS1, K65-CS2, K65-CS3, đã có XP và huy hiệu). "
    "Chụp phần đầu trang: nút \"Tải CSV\", ô chọn \"Lớp\" và nút \"Lọc\", năm thẻ số (Học viên, Tổng XP, XP trung bình, Badge đã cấp, Đang có streak), dòng \"Phân bố level\" "
    "và bảng từng học viên bên dưới (có hình huy hiệu ở mỗi dòng).",
    marks=["Ô chọn lớp", "Nút Tải CSV", "Các thẻ số", "Bảng từng học viên"],
)

_GAMI_LEGEND = legend(
    [
        "**Ô chọn lớp.** Thầy/cô chọn một lớp trong danh sách rồi bấm nút \"Lọc\" để chỉ xem học viên của lớp đó. Mặc định là \"Tất cả\".",
        "**Nút \"Tải CSV\".** Thầy/cô bấm nút này để tải số liệu về và mở bằng Excel.",
        "**Các thẻ số.** Có năm thẻ: số học viên (36 trong ảnh), tổng điểm kinh nghiệm (XP), điểm kinh nghiệm trung bình, số huy hiệu đã cấp và số người đang giữ chuỗi ngày học. Giao diện ghi các nhãn \"XP trung bình\", \"Badge đã cấp\" và \"Đang có streak\". Dòng \"Phân bố level\" ngay dưới cho biết mỗi cấp độ có bao nhiêu học viên, ví dụ 15 học viên ở cấp 1.",
        "**Bảng từng học viên.** Mỗi dòng có tên, email, lớp, điểm kinh nghiệm, cấp độ, chuỗi ngày học, số huy hiệu và hình các huy hiệu đã nhận. Các cột trên giao diện ghi \"Level\", \"Streak\" và \"Badge\". Cột XP đang xếp từ cao xuống thấp. Thầy/cô bấm mũi tên đầu dòng để mở rộng và xem huy hiệu cùng các lần cộng điểm gần nhất.",
    ]
)

_WHERE = flow(
    [
        ("Trang chủ", "Việc cần xử lý gấp"),
        ("Mục Học viên", "Ai đang học, ai bỏ dở"),
        ("Mục điểm số", "Bảng điểm tải về"),
        ("Mục thành tích", "Mức độ chăm học"),
    ]
)

LESSON = {
    "title": "Bài 4.3 · Theo dõi tiến độ, điểm và thành tích",
    "durationMin": 6,
    "description": "Nơi thầy/cô xem tiến độ, điểm số và mức độ chăm học của học viên, cùng những gì học viên tự thấy về thành tích của mình.",
    "objectives": [
        "Chọn được màn hình đúng để xem tiến độ, điểm số hoặc mức độ chăm học",
        "Đọc được các thẻ số ở mục thành tích",
        "Nói được thầy/cô chỉ xem số liệu thành tích, và học viên thấy những gì",
    ],
    "summary": [
        "Trang chủ cho biết việc cần xử lý gấp; mục Học viên, mục điểm số và danh sách lớp cho biết tiến độ và điểm.",
        "Mục thành tích (tab \"Gamification\") là nơi giảng viên chỉ xem số liệu: không chỉnh được điểm kinh nghiệm, huy hiệu hay nhiệm vụ.",
        "Chứng nhận tự cấp khi học viên hoàn thành khoá, và hồ sơ năng lực là việc của học viên; thầy/cô không phải cài đặt gì.",
    ],
    "body": (
        "\n## Bắt đầu từ trang chủ\n\n"
        "Mỗi ngày thầy/cô nên bắt đầu ở **Trang chủ**, biểu tượng đầu tiên (hình bảng ô vuông) trên thanh điều hướng. Trang này gom các việc cần làm của mọi khoá về một chỗ.\n\n"
        + _HOME
        + "\n\n"
        + _HOME_LEGEND
        + "\n\nPhần **Cần xử lý gấp** giúp thầy/cô thấy ngay việc nào đang chờ. Phần **Hoạt động gần đây** cho biết học viên có đang học hay không. "
        "Bốn thẻ số ở đầu trang cho biết số khoá đang dạy, số học viên, số việc cần xử lý và số học viên im ắng quá 14 ngày (nhãn \"Học viên im ắng >14 ngày\"). "
        "Trang chủ còn có phần thành tích theo khoá (nhãn \"Gamification theo khoá\") để xem nhanh mức độ chăm học của từng khoá.\n\n"
        "> [!ghi-nho] **Lịch chỉ hiện hạn bài tập và bài kiểm tra.**\n"
        "> Những loại sự kiện khác không có trên lịch này.\n\n"
        "## Học viên và điểm số của một khoá\n\n"
        "Khi cần xem kỹ một khoá, thầy/cô mở khoá đó. Mỗi câu hỏi về học viên có một nơi để xem.\n\n"
        + _WHERE
        + "\n\n"
        "| Thầy/cô muốn biết | Mở ở đâu |\n"
        "|---|---|\n"
        "| Học viên nào đang học, đã hoàn thành hay bỏ học | Mục Học viên |\n"
        "| Tìm một học viên theo tên hoặc email | Ô tìm ở mục Học viên |\n"
        "| Học viên của từng lớp học đến đâu | Danh sách của lớp, cột Tiến độ (xem Bài 4.1) |\n"
        "| Điểm bài kiểm tra và điểm bài tập | Mục điểm số |\n\n"
        "Mục **Học viên** có trạng thái từng người: Đang học, Đã hoàn thành, Bỏ học, Đã hoàn tiền và Hết hạn truy cập. "
        "Từ đây thầy/cô bấm **Gán lớp** để xếp học viên vào lớp, hoặc bấm **Tải danh sách học viên** để lấy danh sách về máy. "
        "Nút **Xoá khỏi khoá học** cũng nằm ở đây, nên thầy/cô cần cẩn thận khi bấm.\n\n"
        "Mục điểm số trên giao diện còn ghi là \"Grade\". Mục này có hai nút tải về: một bảng điểm cho bài kiểm tra và một bảng điểm cho bài tập. "
        "Thầy/cô mở các bảng này bằng Excel để tính điểm tổng kết.\n\n"
        "## Mục thành tích: thầy/cô chỉ xem\n\n"
        "Trò chơi hoá là cách dùng điểm, huy hiệu và nhiệm vụ để học viên thấy việc học vui hơn. "
        "Mục **thành tích** của khoá cho thầy/cô biết học viên có chăm học hay không. Đây là tab cuối cùng của khoá, có biểu tượng chiếc cúp.\n\n"
        + _GAMI
        + "\n\n"
        + _GAMI_LEGEND
        + "\n\nMột số dòng trong bảng có nhãn \"Ẩn khỏi BXH\", nghĩa là học viên đó chọn không hiện tên trên bảng xếp hạng. "
        "Thầy/cô vẫn thấy số liệu của họ ở đây.\n\n"
        "> [!canh-bao] **Giảng viên không cấu hình được điểm kinh nghiệm, huy hiệu hay nhiệm vụ.**\n"
        "> Mục này chỉ để xem. Hệ thống tự cộng điểm và cấp huy hiệu cho học viên. Chỗ duy nhất thầy/cô tự đặt điểm kinh nghiệm là **Đấu trường**.\n\n"
        "Còn học viên thì thấy gì? Họ có bốn nơi riêng.\n\n"
        "| Học viên mở | Nội dung |\n"
        "|---|---|\n"
        "| Cách tính điểm (XP) | Giải thích việc nào được cộng bao nhiêu điểm |\n"
        "| Bảng xếp hạng | Xếp hạng theo ngày, tuần, tháng hoặc mọi thời |\n"
        "| Huy hiệu | Các huy hiệu học viên đã nhận |\n"
        "| Nhiệm vụ hôm nay | Ba nhiệm vụ cố định: học một bài, vượt một bài kiểm tra, khắc phục một lỗi tư duy |\n\n"
        "Chuỗi ngày học chỉ là một con số động viên, không được cộng điểm kinh nghiệm.\n\n"
        "## Chứng nhận và hồ sơ năng lực\n\n"
        "**Chứng nhận** tự được cấp khi học viên hoàn thành khoá. Học viên bấm \"Xem chứng nhận\" và tải về dạng PDF. "
        "Mỗi chứng nhận có một số riêng, và người khác dùng trang xác minh để kiểm tra số đó là thật. Thầy/cô không có cài đặt nào cho phần này.\n\n"
        "**Hồ sơ năng lực** (còn gọi là e-portfolio) là việc của học viên. Học viên tự chọn những bài đã được chấm để đưa vào hồ sơ, "
        "rồi tự bật chia sẻ nếu muốn cho người ngoài xem. Thầy/cô không phải cài đặt gì. Điều thầy/cô có thể làm là chấm bài kịp thời, "
        "vì chỉ bài đã chấm mới đưa vào hồ sơ được.\n\n"
        + try_now(
            "Đọc số liệu của một khoá",
            [
                "Bấm **Trang chủ** trên thanh điều hướng và xem phần **Cần xử lý gấp**.",
                "Mở một khoá của thầy/cô, bấm mục **Học viên** và thử gõ tên một học viên vào ô tìm.",
                "Bấm tab cuối cùng của khoá (biểu tượng chiếc cúp), chọn một lớp ở ô lọc, bấm **Lọc** rồi so sánh số học viên với danh sách lớp.",
                "Bấm **Tải CSV** nếu thầy/cô muốn mở số liệu bằng Excel.",
            ],
            minutes=3,
        )
        + "\n"
    ),
    "quiz": {
        "title": "Ôn tập Bài 4.3",
        "passThresholdPct": 60,
        "questions": [
            {
                "key": "4.3-chinh-xp",
                "type": "mcq",
                "prompt": "Thầy/cô muốn đổi số điểm kinh nghiệm mà học viên nhận được khi học một bài. Điều nào đúng?",
                "explanation": "Giảng viên chỉ xem số liệu ở mục thành tích, không chỉnh điểm kinh nghiệm, huy hiệu hay nhiệm vụ. Chỗ duy nhất giảng viên đặt điểm kinh nghiệm là Đấu trường.",
                "points": 1,
                "options": [
                    {"label": "Mục thành tích chỉ để xem; giảng viên chỉ đặt điểm ở Đấu trường", "isCorrect": True},
                    {"label": "Thầy/cô sửa trực tiếp trong bảng từng học viên ở mục thành tích", "isCorrect": False},
                    {"label": "Thầy/cô đổi ở ô chọn lớp của mục thành tích", "isCorrect": False},
                    {"label": "Thầy/cô đổi ở mục Học viên", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-lich-trang-chu",
                "type": "mcq",
                "prompt": "Lịch ở trang chủ giảng viên hiện những gì?",
                "explanation": "Lịch chỉ hiện hạn bài tập và hạn bài kiểm tra. Thầy/cô chuyển giữa chế độ Tuần và Tháng, và bấm \"Hôm nay\" để về ngày hiện tại.",
                "points": 1,
                "options": [
                    {"label": "Hạn bài tập và hạn bài kiểm tra", "isCorrect": True},
                    {"label": "Mọi buổi dạy trực tiếp và hoạt động trên lớp", "isCorrect": False},
                    {"label": "Ngày học viên nhận chứng nhận", "isCorrect": False},
                    {"label": "Lịch học của từng kỳ học", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-noi-xem",
                "type": "matching",
                "prompt": "Nối mỗi việc với nơi thầy/cô thực hiện việc đó.",
                "explanation": "Trang chủ gom việc cần xử lý gấp. Mục Học viên có ô tìm và nút gán lớp. Mục điểm số có hai bảng điểm tải về. Mục thành tích có lọc theo lớp và nút tải CSV.",
                "points": 2,
                "pairs": [
                    {"left": "Xem việc cần xử lý gấp của mọi khoá", "right": "Trang chủ"},
                    {"left": "Tìm học viên theo tên và gán lớp", "right": "Mục Học viên"},
                    {"left": "Tải bảng điểm bài kiểm tra và bài tập", "right": "Mục điểm số"},
                    {"left": "Xem điểm kinh nghiệm và huy hiệu theo từng lớp", "right": "Mục thành tích"},
                ],
            },
            {
                "key": "4.3-chung-nhan",
                "type": "true_false",
                "prompt": "Thầy/cô phải bấm cấp chứng nhận cho từng học viên sau khi họ hoàn thành khoá.",
                "explanation": "Sai. Chứng nhận tự được cấp khi học viên hoàn thành khoá. Học viên tự bấm \"Xem chứng nhận\" và tải về, thầy/cô không có cài đặt nào cho phần này.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
        ],
    },
}

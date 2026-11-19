# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/ky-nang-mem/src/build.py                 # cả khoá đang có
    python3 docs/hoc-lieu/ky-nang-mem/src/build.py --module 1      # chỉ một module

Soạn bằng Python chứ không viết thẳng JSON vì thân bài là văn xuôi dài: chuỗi
`r\"\"\"…\"\"\"` giữ nguyên xuống dòng và dấu nháy, còn JSON thì bắt escape từng ký
tự — sửa một câu trong bài phải đếm dấu gạch chéo.

Module nào soạn xong thì thêm vào MODULES. Module đầu tiên nhập bằng lệnh
thường (tạo khoá mới); các module sau nhập kèm `--into <courseId>` để nối vào
khoá đã có thay vì dựng lại từ đầu.
"""

import argparse
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))

import course  # noqa: E402
import m1_l1, m1_l2, m1_l3  # noqa: E402
import m2_l1, m2_l2, m2_l3  # noqa: E402
import m3_l1, m3_l2, m3_l3  # noqa: E402
import m4_l1, m4_l2, m4_l3, m4_l4  # noqa: E402
import m5_l1, m5_l2, m5_l3  # noqa: E402
import m6_l1, m6_l2, m6_l3  # noqa: E402
import m7_l1, m7_l2, m7_l3  # noqa: E402
import m8_l1, m8_l2, m8_l3  # noqa: E402
import m9_l1, m9_l2, m9_l3  # noqa: E402
import m10_l1, m10_l2, m10_l3  # noqa: E402

MODULES = {
    1: {
        "title": "Module 1 · Giá trị sống",
        "description": (
            "Module này đặt nền móng cho cả khoá bằng câu hỏi người học coi trọng điều gì và dựa vào đâu "
            "để ra quyết định khi hai điều tốt không thể cùng được giữ. Giá trị sống được phân biệt với "
            "mục tiêu, sở thích và nguyên tắc, đồng thời được xem xét ở hai dạng là giá trị tuyên bố và "
            "giá trị hiện ra trong hành vi thực tế. Bài 1.1 hướng dẫn nhận diện giá trị thật qua dấu vết "
            "hành vi và rút một danh sách dài xuống tối đa năm mục có thứ tự ưu tiên; bài 1.2 xét trọng "
            "tâm cuộc sống, hai vòng tròn quan tâm và ảnh hưởng cùng ba loại vấn đề theo mức kiểm soát; "
            "bài 1.3 chuyển các kết quả đó thành bản tuyên ngôn sứ mệnh cá nhân và xem xét cách dùng bản "
            "tuyên ngôn khi giá trị bị thử thách bởi yêu cầu của tổ chức. Thứ tự giá trị lập ở đây được "
            "dùng lại ở module 4, nơi nó trở thành căn cứ để xếp ưu tiên thời gian."
        ),
        "lessons": [m1_l1.LESSON, m1_l2.LESSON, m1_l3.LESSON],
    },
    2: {
        "title": "Module 2 · Tư duy tích cực",
        "description": (
            "Module này xem tư duy tích cực là một kỹ thuật giải thích sự việc sao cho người học còn nhìn "
            "thấy phương án và còn tiếp tục thử, chứ không phải một trạng thái tâm trạng phải duy trì "
            "suốt ngày. Cơ sở của module là chuỗi sự việc, diễn giải, cảm xúc và hành vi, cùng ba trục "
            "giải thích của Seligman gồm độ bền, phạm vi và quy trách nhiệm. Bài 2.1 phân biệt tư duy "
            "tích cực với tích cực độc hại (toxic positivity) và lạc quan mù quáng; bài 2.2 trình bày bảy "
            "lối nghĩ méo (cognitive distortion), quy trình ABCDE để tranh luận với lời tự nói và khái "
            "niệm tư duy phát triển (growth mindset), vốn gần với niềm tin vào năng lực bản thân (self-efficacy) "
            "ở bài 4.1; bài 2.3 bàn về việc duy trì lâu dài qua bốn thói "
            "quen có bằng chứng và tự trắc ẩn (self-compassion). Bài cuối cũng xác định ranh giới mà tại "
            "đó tư duy tích cực không còn đủ và cần đến hỗ trợ chuyên môn."
        ),
        "lessons": [m2_l1.LESSON, m2_l2.LESSON, m2_l3.LESSON],
    },
    3: {
        "title": "Module 3 · Tư duy phản biện",
        "description": (
            "Module này đề cập năng lực kiểm tra chất lượng của một lập luận, kể cả lập luận của chính "
            "người học, trong bối cảnh ai cũng có thể xuất bản thông tin và mô hình AI có thể sinh nội "
            "dung trôi chảy trong vài giây. Tư duy phản biện (critical thinking) được hiểu là một quy "
            "trình dẫn tới kết luận đáng tin hơn, khác với sự bắt bẻ và với thái độ hoài nghi mọi thứ. "
            "Bài 3.1 tách lập luận thành ba mảnh gồm khẳng định, bằng chứng và suy luận, rồi giới thiệu "
            "thang suy luận (ladder of inference) của Argyris; bài 3.2 xét thiên lệch nhận thức, tức sai "
            "lệch có hệ thống ở người đọc, và nguỵ biện, tức lỗi ở mảnh suy luận của người nói; bài 3.3 "
            "chuyển sang đánh giá nguồn bằng kỹ thuật đọc ngang (lateral reading), cách đọc một con số và "
            "độ tin cậy của nội dung do AI sinh ra. Các công cụ này được dẫn lại ở nhiều module sau, đặc "
            "biệt ở module 8 khi phân tích bằng chứng xã hội."
        ),
        "lessons": [m3_l1.LESSON, m3_l2.LESSON, m3_l3.LESSON],
    },
    4: {
        "title": "Module 4 · Quản lý thời gian",
        "description": (
            "Module này xuất phát từ nhận định rằng thời gian cố định ở 24 giờ mỗi ngày, nên đối tượng "
            "quản lý thực chất là các lựa chọn, và thước đo cuối ngày là mục tiêu nào đã tiến lên chứ "
            "không phải số việc đã làm. Bốn bài đi theo trình tự từ xác định việc cần làm đến thực hiện "
            "việc đó. Bài 4.1 trình bày bốn thế hệ quản lý thời gian, trong đó thế hệ thứ tư gắn với giá "
            "trị ở module 1, cùng mục tiêu SMART, mô hình 5A, kế hoạch ba cấp học kỳ, tuần và ngày, đồng thời "
            "giới thiệu niềm tin vào năng lực bản thân (self-efficacy) và liên hệ nó với tư duy phát triển ở "
            "bài 2.2; bài "
            "4.2 phân biệt khẩn cấp với quan trọng bằng ma trận Eisenhower và mô tả bảy kẻ cắp thời gian; "
            "bài 4.3 phân tích chi phí của đa nhiệm, khung giờ vàng, trì hoãn nhìn từ góc độ cảm xúc và "
            "công thức từ chối một đề nghị; bài 4.4 giải thích sai lệch lập kế hoạch (planning fallacy) "
            "và hướng dẫn ước lượng thời gian, dựng lịch theo sáu bước. Kỷ luật thời gian cá nhân cũng là "
            "điều kiện để giữ cam kết với nhóm, như bài 9.1 sẽ dẫn lại."
        ),
        "lessons": [m4_l1.LESSON, m4_l2.LESSON, m4_l3.LESSON, m4_l4.LESSON],
    },
    5: {
        "title": "Module 5 · Giao tiếp hiệu quả",
        "description": (
            "Module này mở đầu nhóm kỹ năng quan hệ bằng giao tiếp, được xem là quá trình hai chiều trong "
            "đó thông điệp chỉ có nghĩa ở dạng người nhận giải mã được. Bài 5.1 trình bày sáu thành phần "
            "của quá trình giao tiếp, sự khác nhau giữa giao tiếp một chiều và hai chiều, bốn loại nhiễu "
            "và ba kỹ thuật xác nhận ý hiểu; bài 5.2 xét các kênh phi ngôn ngữ, phạm vi áp dụng đúng của "
            "quy tắc 7–38–55 và bốn vùng khoảng cách giao tiếp theo Hall; bài 5.3 bàn về việc chọn kênh "
            "theo nội dung, cách viết email, công thức cho bốn tình huống khó là giao việc, nhận việc, "
            "báo tin xấu và trả lời khiếu nại, cùng ranh giới giữa ứng xử quyết đoán, thụ động và hung "
            "hăng. Khi phân tích cách quy tắc 7–38–55 bị dùng sai, bài 5.2 vận dụng lại cách đọc một con "
            "số đã học ở module 3."
        ),
        "lessons": [m5_l1.LESSON, m5_l2.LESSON, m5_l3.LESSON],
    },
    6: {
        "title": "Module 6 · Kỹ năng lắng nghe",
        "description": (
            "Module này tiếp nối giao tiếp ở module 5 bằng việc xét vai trò của người nghe, với luận điểm "
            "rằng nghe là hiện tượng sinh lý còn lắng nghe là hoạt động có chủ đích của sự chú ý. Bài 6.1 "
            "phân biệt nghe với lắng nghe, trình bày năm mức độ lắng nghe từ phớt lờ đến lắng nghe thấu "
            "cảm (empathic listening), bốn mức phản hồi, câu hỏi mở và khoảng dừng; bài 6.2 phân tích bốn "
            "nhóm rào cản, năm thói quen làm hỏng việc nghe, ngôn ngữ cơ thể của người nghe và lý do lời "
            "khuyên đưa ra quá sớm thường kém hiệu quả; bài 6.3 xét bốn tình huống khó là khi chưa hiểu ý "
            "cấp trên, khi khách hàng phàn nàn, khi người đối diện đang buồn và khi hai bên bất đồng quan "
            "điểm. Bài cuối dùng lại khái niệm tích cực độc hại của module 2 và nguyên tắc diễn đạt lại ý "
            "đối phương trước khi phản bác đã trình bày ở module 3."
        ),
        "lessons": [m6_l1.LESSON, m6_l2.LESSON, m6_l3.LESSON],
    },
    7: {
        "title": "Module 7 · Thuyết trình hiệu quả",
        "description": (
            "Module này trình bày thuyết trình như một quy trình gồm ba giai đoạn là soạn nội dung, thiết "
            "kế hỗ trợ trực quan và thực hiện trước khán giả. Bài 7.1 phân biệt thông tin với thông điệp "
            "(key message), đưa ra ba câu hỏi cần trả lời về khán giả, cấu trúc ba phần của một bài trình "
            "bày, cách mở đầu trong 30 giây đầu và cách kết bài; bài 7.2 bàn về thiết kế slide, gồm quy "
            "tắc về lượng chữ, cỡ chữ và kiểu chữ, cách dùng hình ảnh và biểu đồ, và cách trình bày đề "
            "tài kỹ thuật cho khán giả ngoài ngành; bài 7.3 đề cập việc tập nói to có bấm giờ, giọng, mắt "
            "và tư thế khi đứng nói, bốn sự cố thường gặp và cách làm việc với sự hồi hộp. Bài 7.2 dùng "
            "lại cách nhận ra biểu đồ gây hiểu lầm ở bài 3.3, và cách luyện nói to ở bài 7.3 được dùng "
            "lại khi chuẩn bị phỏng vấn ở module 10."
        ),
        "lessons": [m7_l1.LESSON, m7_l2.LESSON, m7_l3.LESSON],
    },
    8: {
        "title": "Module 8 · Nghệ thuật thuyết phục",
        "description": (
            "Module này dựa trên bảy nguyên tắc gây ảnh hưởng của Cialdini và được dạy theo hai chiều: "
            "vận dụng để thuyết phục một cách trung thực, và nhận ra khi các nguyên tắc ấy đang được dùng "
            "lên chính mình. Bài 8.1 đưa ra ba câu hỏi để phân biệt thuyết phục với thao túng, mô tả hai "
            "đường mà người nghe xử lý thông điệp, quy trình năm bước chuẩn bị và cách chuyển tính năng "
            "thành lợi ích; bài 8.2 trình bày bốn nguyên tắc đầu là đáp trả, cam kết và nhất quán, bằng "
            "chứng xã hội và thiện cảm; bài 8.3 trình bày ba nguyên tắc còn lại là uy quyền, khan hiếm và "
            "đồng nhất, các mẫu thiết kế đánh lừa trên ứng dụng và quy trình bốn bước tự vệ trước một lời "
            "chào mời gấp gáp. Module vận dụng lại tư duy phản biện của module 3, chẳng hạn ở nhận định "
            "rằng số đông đo mức lan truyền chứ không đo mức đúng."
        ),
        "lessons": [m8_l1.LESSON, m8_l2.LESSON, m8_l3.LESSON],
    },
    9: {
        "title": "Module 9 · Kỹ năng cá nhân trong làm việc nhóm",
        "description": (
            "Module này xét phần việc của cá nhân trong nhóm, tức những hành vi nằm trong vòng tròn ảnh "
            "hưởng của người học (bài 1.2) kể cả khi không giữ vai trò trưởng nhóm. Bài 9.1 trình bày ba "
            "mô thức phụ thuộc, độc lập và tương thuộc, các đặc trưng phân biệt nhóm với một tập hợp "
            "người và những hành vi nhỏ giúp nhóm vận hành được; bài 9.2 giới thiệu mô hình năm giai đoạn "
            "phát triển nhóm của Tuckman, lý do giai đoạn sóng gió khó tránh khỏi và các vai trò trong "
            "nhóm; bài 9.3 phân tích năm kiểu phản ứng trước xung đột, cách xử lý tình huống thành viên "
            "trễ hạn, thành viên im lặng và hai người bất đồng kéo dài, cùng cách tổ chức buổi rút kinh "
            "nghiệm cuối dự án. Phần tự quản lý ở bài 9.1 dựa trên nội dung của module 1 và module 4, còn "
            "các bài sau tiếp nối nhau theo diễn tiến của một nhóm."
        ),
        "lessons": [m9_l1.LESSON, m9_l2.LESSON, m9_l3.LESSON],
    },
    10: {
        "title": "Module 10 · Viết CV và phỏng vấn xin việc",
        "description": (
            "Module này khép khoá bằng một tình huống nghề nghiệp cụ thể là xin việc, nơi nhiều kỹ năng "
            "đã học được vận dụng cùng lúc. Bài 10.1 trình bày cách nhà tuyển dụng đọc CV, cấu trúc một "
            "trang, cách viết thành tựu có kết quả đo được và việc điều chỉnh CV cho từng vị trí; bài "
            "10.2 phân biệt CV với thư ứng tuyển (cover letter), hướng dẫn tìm hiểu công ty và vị trí, "
            "chuẩn bị ba tới năm câu chuyện theo cấu trúc STAR và phần hậu cần dễ bị bỏ quên; bài 10.3 đi "
            "theo trình tự một buổi phỏng vấn, từ câu giới thiệu bản thân, các nhóm câu hỏi thường gặp và "
            "câu hỏi hỏi lại nhà tuyển dụng, đến việc cần làm sau buổi phỏng vấn, kể cả khi bị từ chối. "
            "Việc chuẩn bị và trình bày trong module này dùng lại kiến thức về phi ngôn ngữ ở bài 5.2 và "
            "cách luyện nói ở bài 7.3."
        ),
        "lessons": [m10_l1.LESSON, m10_l2.LESSON, m10_l3.LESSON],
    },
}

# Lộ trình cả khoá — chín kỹ năng khớp Kho KNM, cộng Tư duy phản biện.
ROADMAP = [
    (1, "Giá trị sống"),
    (2, "Tư duy tích cực"),
    (3, "Tư duy phản biện"),
    (4, "Quản lý thời gian"),
    (5, "Giao tiếp hiệu quả"),
    (6, "Kỹ năng lắng nghe"),
    (7, "Thuyết trình hiệu quả"),
    (8, "Nghệ thuật thuyết phục"),
    (9, "Kỹ năng cá nhân trong làm việc nhóm"),
    (10, "Viết CV và phỏng vấn xin việc"),
]


def build(module_numbers):
    picked = [MODULES[n] for n in module_numbers]
    return {
        "course": course.COURSE,
        "misconceptions": course.MISCONCEPTIONS,
        "feedbackTemplates": course.FEEDBACK_TEMPLATES,
        "modules": picked,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--module", type=int, action="append", help="số thứ tự module, lặp được")
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-ky-nang-mem.json")
    args = ap.parse_args()

    numbers = sorted(args.module or MODULES.keys())
    missing = [n for n in numbers if n not in MODULES]
    if missing:
        done = ", ".join(str(n) for n in sorted(MODULES))
        sys.exit(f"Module chưa soạn: {missing}. Hiện có: {done}")

    manifest = build(numbers)
    args.out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    lessons = sum(len(m["lessons"]) for m in manifest["modules"])
    questions = sum(
        len(l.get("quiz", {}).get("questions", [])) for m in manifest["modules"] for l in m["lessons"]
    )
    print(f"→ {args.out}")
    print(
        f"  {len(manifest['modules'])} module · {lessons} bài · {questions} câu hỏi · "
        f"{len(manifest['misconceptions'])} lỗi tư duy · {len(manifest['feedbackTemplates'])} mẫu phản hồi"
    )
    todo = [f"{n}. {t}" for n, t in ROADMAP if n not in MODULES]
    if todo:
        print("  còn lại: " + " · ".join(todo))


if __name__ == "__main__":
    main()

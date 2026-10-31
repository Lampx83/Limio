#!/usr/bin/env python3
"""Sinh khoa-on-thi-toan-10-mau.json từ nội dung soạn ở đây.

Chạy:  python3 -I docs/hoc-lieu/on-thi-toan-10-mau/src/build.py

Thiết kế dạy học (môn Toán):
- Ví dụ mẫu chia thành TỪNG BƯỚC, mỗi bước một dòng kèm "vì sao" (reveal: hiện dần khi bấm, hoặc khi giọng giảng tới).
- Mờ dần: ví dụ mẫu → "tự làm bước cuối" (có đáp án gập) → bài quiz tự giải.
- "Tìm lỗi trong lời giải": nhìn một lời giải sai, chỉ ra bước sai — luyện phân tích lỗi.
- Trộn xen kẽ ở bài 5 (đề mini tính giờ), chẩn đoán điều kiện tiên quyết ở bài 1.
Công thức viết bằng LaTeX trong $…$ / $$…$$ (KaTeX dựng ở trình duyệt). Tiêu đề mục để chữ thường, KHÔNG chứa công thức,
vì tiêu đề là neo của Nghe giảng. Mọi phép tính đã thay lại vào phương trình; sửa số thì kiểm lại cả đáp án quiz.
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "khoa-on-thi-toan-10-mau.json"

# Hình đồ thị do make_figures.py sinh (tệp SVG trong kho ảnh bài học của máy dev).
FIG_PARABOLA = "/api/lesson-media/images/744a4c7a-efb0-41bd-b9a0-f4e671d9e230-1793451658662-e55e6fe43b5b94d1.svg"

# ── Lỗi tư duy (gắn vào phương án sai) ────────────────────────────────────────
MISC = [
    ("on10.quen-a-khac-0", "Quên điều kiện a ≠ 0",
     "Gọi mọi phương trình dạng ax² + bx + c = 0 là bậc hai mà không kiểm hệ số a. Khi a = 0 phương trình chỉ còn là bậc nhất, và công thức nghiệm với Δ không dùng được."),
    ("on10.sai-dau-b", "Nhầm dấu của b trong công thức nghiệm",
     "Viết x = (b ± √Δ)/(2a) thay vì (−b ± √Δ)/(2a), hoặc bỏ dấu trừ khi b đã mang dấu âm. Kết quả là nghiệm đối dấu với nghiệm đúng."),
    ("on10.delta-chi-nhin-c", "Đoán số nghiệm chỉ nhìn hệ số c",
     "Cho rằng c > 0 thì phương trình có nghiệm, hoặc c < 0 thì vô nghiệm. Số nghiệm do dấu của Δ = b² − 4ac quyết định, không do riêng hệ số nào."),
    ("on10.bat-dang-thuc-delta", "Nhầm dấu bất đẳng thức khi xét Δ",
     "Lấy Δ ≥ 0 cho điều kiện hai nghiệm phân biệt, hoặc đổi chiều bất đẳng thức khi chuyển vế hay chia cho số âm."),
    ("on10.viete-sai-dau-tong", "Nhầm dấu trong hệ thức Viète",
     "Viết x₁ + x₂ = b/a thay vì −b/a. Tích x₁x₂ = c/a thì ít nhầm hơn, nhưng tổng hay mất dấu trừ."),
    ("on10.viete-quen-dieu-kien", "Dùng Viète mà không kiểm Δ ≥ 0",
     "Giải phương trình theo tham số m rồi nhận hết giá trị tìm được, quên rằng hệ thức Viète chỉ có nghĩa khi phương trình có nghiệm."),
    ("on10.quen-doi-chieu-dieu-kien", "Không đối chiếu nghiệm với điều kiện của bài toán",
     "Giải xong phương trình lập được thì nhận mọi nghiệm làm đáp số, quên rằng đại lượng thực tế có điều kiện (dương, nguyên, lớn hơn đại lượng khác)."),
    ("on10.nham-dai-luong", "Trả lời nhầm đại lượng được hỏi",
     "Giải đúng phương trình nhưng kết luận bằng đại lượng khác với đại lượng đề hỏi, chẳng hạn trả lời số lớn trong khi đề hỏi số nhỏ."),
    ("on10.nen-can-hai-dau", "Nghĩ √a có hai giá trị",
     "Viết √49 = ±7. Căn bậc hai số học là số không âm: √49 = 7. Dấu ± chỉ xuất hiện khi giải phương trình x² = 49, không nằm trong chính ký hiệu căn."),
    ("on10.nen-hang-dang-thuc", "Khai triển (a − b)² thiếu số hạng giữa",
     "Viết (x − 2)² = x² − 4 hoặc x² + 4. Bình phương của một hiệu có ba số hạng: x² − 4x + 4."),
    ("on10.nen-rut-gon-can", "Rút gọn căn sai khi đưa thừa số ra ngoài",
     "Đưa thừa số ra ngoài dấu căn mà quên lấy căn của nó (viết √50 = 25√2), hoặc tách sai thành tích."),
]

FEEDBACK = [
    ("on10.quen-a-khac-0", "Hãy nhìn lại hệ số a. Nếu a = 0 thì x² biến mất và còn lại bx + c = 0, tức phương trình bậc nhất. Điều kiện a ≠ 0 là cái làm nên tên “bậc hai”, nên bước đầu tiên của mọi bài là xác định a, b, c và kiểm a.", 10),
    ("on10.sai-dau-b", "Công thức có dấu trừ đứng trước b: x = (−b ± √Δ)/(2a). Khi b đã âm, −b là số dương. Cách chắc ăn là viết hẳn “b = …” ra nháp rồi thay vào, đừng thay nhẩm.", 10),
    ("on10.delta-chi-nhin-c", "Số nghiệm không do một hệ số riêng lẻ quyết định mà do Δ = b² − 4ac. Phương trình x² + x + 3 = 0 có c > 0 nhưng Δ = 1 − 12 = −11 < 0 nên vô nghiệm. Hãy luôn tính Δ rồi mới kết luận.", 10),
    ("on10.bat-dang-thuc-delta", "Hai nghiệm phân biệt đòi Δ > 0 (lớn hơn hẳn), còn Δ = 0 cho nghiệm kép. Khi biến đổi bất đẳng thức, nhớ đổi chiều nếu nhân hay chia cho số âm. Thử lại bằng một giá trị m cụ thể là cách kiểm nhanh.", 10),
    ("on10.viete-sai-dau-tong", "Tổng hai nghiệm là −b/a, có dấu trừ. Cách nhớ: với x² − 7x + 10 = 0 thì hai nghiệm 2 và 5 cộng lại bằng 7, mà b = −7, nên tổng bằng −b/a chứ không phải b/a. Hãy thử với một phương trình nhẩm được nghiệm rồi mới tin công thức.", 10),
    ("on10.viete-quen-dieu-kien", "Hệ thức Viète chỉ đúng khi phương trình có nghiệm, tức Δ ≥ 0 (hoặc Δ′ ≥ 0). Sau khi giải ra các giá trị của tham số, hãy thay lại điều kiện này và loại những giá trị không thoả.", 10),
    ("on10.quen-doi-chieu-dieu-kien", "Phương trình lập được có thể có nghiệm không phù hợp với bài toán. Một vận tốc không thể âm, một độ dài không thể âm, một số tự nhiên không thể là số âm. Luôn quay lại điều kiện đặt ở bước đầu để loại nghiệm.", 10),
    ("on10.nham-dai-luong", "Bạn đã giải đúng, nhưng đề hỏi đại lượng khác. Trước khi viết đáp số, đọc lại câu hỏi của đề và gạch chân đại lượng cần tìm; ẩn đặt ban đầu chưa chắc là đại lượng đề hỏi.", 5),
    ("on10.nen-can-hai-dau", "Căn bậc hai số học của một số không âm là số không âm, nên √49 = 7 chứ không phải ±7. Dấu ± chỉ xuất hiện khi giải x² = 49 (hai nghiệm 7 và −7), và nó nằm trong công thức nghiệm, không nằm trong ký hiệu căn.", 10),
    ("on10.nen-hang-dang-thuc", "Bình phương của một hiệu có ba số hạng: (a − b)² = a² − 2ab + b². Với (x − 2)² thì số hạng giữa là −2·x·2 = −4x. Nếu bạn viết x² − 4 thì đã nhầm với hiệu hai bình phương (x − 2)(x + 2).", 10),
    ("on10.nen-rut-gon-can", "Khi đưa thừa số ra ngoài căn phải lấy căn của nó: √50 = √(25·2) = 5√2 (lấy căn của 25 là 5), không phải 25√2. Hãy tách số dưới căn thành tích một số chính phương và một số nhỏ nhất có thể.", 10),
]


def lec(anchor, text):
    return {"anchor": anchor, "text": text}


# ═══════════════════════════════════════════════════════════════════════════════
# BÀI 1 — Khởi động: kiểm tra kiến thức nền (chẩn đoán đầu chương)
# ═══════════════════════════════════════════════════════════════════════════════
L0 = {
    "title": "Khởi động: kiểm tra kiến thức nền",
    "durationMin": 10,
    "description": "Sáu câu hỏi ngắn kiểm tra bốn kỹ năng nền cần có trước khi vào phương trình bậc hai, để biết cần ôn gì trước.",
    "look": {"palette": "paper", "font": "modern"},
    "objectives": [
        "Tự kiểm được bốn kỹ năng nền: căn bậc hai, bình phương, hằng đẳng thức và giải phương trình bậc nhất",
        "Biết kỹ năng nào còn yếu để ôn trước khi học tiếp",
    ],
    "objectivesLead": "Học xong bài này, em có thể:",
    "body": (
        "Phương trình bậc hai dùng lại những thứ em đã học từ lớp 7 và lớp 8. Nếu một mắt xích còn lỏng, em sẽ sai ở "
        "bước tính chứ không phải ở bước hiểu, và rất khó nhận ra vì sao. Bài này không tính điểm; nó chỉ cho em và "
        "hệ thống biết nên ôn gì trước.\n\n"
        "$$\\text{Căn bậc hai} \\;\\to\\; \\text{Bình phương và hằng đẳng thức} \\;\\to\\; \\text{Phương trình bậc nhất} \\;\\to\\; \\text{Phương trình bậc hai}$$\n\n"
        "Làm sáu câu trong khoảng mười phút. Sai câu nào, phản hồi sẽ chỉ đúng chỗ hiểu nhầm và gợi ý ôn lại."
    ),
    "sections": [
        {
            "layout": "cards",
            "title": "Bốn kỹ năng nền",
            "parts": [
                {"title": "Căn bậc hai", "md": "Biết $\\sqrt{49}=7$ (số không âm) và rút gọn $\\sqrt{50}=5\\sqrt{2}$."},
                {"title": "Bình phương", "md": "Tính được $(-3)^2=9$: bình phương một số âm cho kết quả dương."},
                {"title": "Hằng đẳng thức", "md": "Khai triển đúng $(x-2)^2=x^2-4x+4$, đủ ba số hạng."},
                {"title": "Phương trình bậc nhất", "md": "Giải được $3x-12=0$ và biết đọc đúng dấu của một hệ số."},
            ],
        }
    ],
    "summary": [
        "Phương trình bậc hai dùng lại căn bậc hai, bình phương, hằng đẳng thức và phương trình bậc nhất.",
        "Kỹ năng nào sai thì ôn lại trước, rồi hãy sang bài sau.",
    ],
    "quiz": {
        "title": "Chẩn đoán đầu chương",
        "passThresholdPct": 0,
        "requireConfidence": False,
        "questions": [
            {
                "key": "0.1-can-49", "type": "mcq", "points": 1,
                "prompt": "Giá trị của $\\sqrt{49}$ là:",
                "explanation": "Căn bậc hai số học của 49 là số không âm có bình phương bằng 49, tức là 7. Dấu ± chỉ xuất hiện khi giải phương trình $x^2=49$.",
                "options": [
                    {"label": "$\\pm 7$", "isCorrect": False, "misconception": "on10.nen-can-hai-dau"},
                    {"label": "$7$", "isCorrect": True},
                    {"label": "$24{,}5$", "isCorrect": False},
                    {"label": "$49$", "isCorrect": False},
                ],
            },
            {
                "key": "0.2-binh-phuong-am", "type": "fill_in", "points": 1,
                "prompt": "Tính $(-3)^2$. Điền một số.",
                "explanation": "$(-3)^2=(-3)\\cdot(-3)=9$. Bình phương của số âm là số dương.",
                "answers": ["9"],
            },
            {
                "key": "0.3-khai-trien", "type": "mcq", "points": 1,
                "prompt": "Khai triển $(x-2)^2$ được:",
                "explanation": "$(x-2)^2=x^2-2\\cdot x\\cdot 2+2^2=x^2-4x+4$. Số hạng giữa là $-4x$.",
                "options": [
                    {"label": "$x^2-4$", "isCorrect": False, "misconception": "on10.nen-hang-dang-thuc"},
                    {"label": "$x^2+4$", "isCorrect": False, "misconception": "on10.nen-hang-dang-thuc"},
                    {"label": "$x^2-2x+4$", "isCorrect": False},
                    {"label": "$x^2-4x+4$", "isCorrect": True},
                ],
            },
            {
                "key": "0.4-bac-nhat", "type": "fill_in", "points": 1,
                "prompt": "Giải phương trình $3x-12=0$. Điền giá trị của $x$.",
                "explanation": "$3x=12$ nên $x=12:3=4$. Thử lại: $3\\cdot4-12=0$.",
                "answers": ["4"],
            },
            {
                "key": "0.5-rut-gon-can", "type": "mcq", "points": 1,
                "prompt": "Rút gọn $\\sqrt{50}$:",
                "explanation": "$\\sqrt{50}=\\sqrt{25\\cdot 2}=\\sqrt{25}\\cdot\\sqrt{2}=5\\sqrt{2}$.",
                "options": [
                    {"label": "$25\\sqrt{2}$", "isCorrect": False, "misconception": "on10.nen-rut-gon-can"},
                    {"label": "$5\\sqrt{2}$", "isCorrect": True},
                    {"label": "$10\\sqrt{5}$", "isCorrect": False, "misconception": "on10.nen-rut-gon-can"},
                    {"label": "$2\\sqrt{5}$", "isCorrect": False},
                ],
            },
            {
                "key": "0.6-dau-b", "type": "true_false", "points": 1,
                "prompt": "Với $b=-6$ và $a=1$ thì $\\dfrac{-b}{2a}=-3$.",
                "explanation": "Sai. $-b=-(-6)=6$ nên $\\dfrac{-b}{2a}=\\dfrac{6}{2}=3$. Khi $b$ đã âm thì $-b$ dương.",
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "on10.sai-dau-b"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# BÀI 2 — Phương trình bậc hai và biệt thức Δ
# ═══════════════════════════════════════════════════════════════════════════════
S_VD1 = "Ví dụ mẫu: giải một phương trình bậc hai"
S_VD_TS = "Ví dụ mẫu có tham số"

L1_BODY = (
    "Gần như đề thi vào lớp 10 nào cũng có một câu về phương trình bậc hai, và phần lớn điểm mất ở đây không phải vì "
    "không biết công thức mà vì **làm tắt một bước**: quên kiểm điều kiện, thay sai dấu, hoặc kết luận khi chưa xét hết "
    "trường hợp. Bài này đi từ công thức nghiệm đến bài có tham số, và chỉ ra từng chỗ dễ sai.\n\n"
    "> [!ghi-nho] Phương trình bậc hai một ẩn có dạng $ax^2+bx+c=0$ với $a\\neq 0$. Biệt thức $\\Delta=b^2-4ac$ cho biết số nghiệm.\n\n"
    "$$x_{1,2}=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}\\qquad(\\Delta\\geq 0)$$\n\n"
    ":::Trước khi đọc tiếp, bạn thử đoán\n"
    "Phương trình $x^2+x+3=0$ có hệ số $c=3$ là số dương. Theo bạn nó có nghiệm không? Hãy ghi dự đoán ra nháp, rồi tính "
    "$\\Delta$ ở phần dưới để đối chiếu. Nếu dự đoán của bạn dựa vào dấu của $c$, bạn đang rơi vào một lỗi rất phổ biến mà "
    "bài này sẽ gỡ.\n"
    ":::"
)

L1_SECTIONS = [
    {
        "layout": "compare",
        "title": "Ba trường hợp của Δ",
        "intro": "Mỗi trường hợp ứng với một cách đồ thị parabol $y=ax^2+bx+c$ đứng so với trục hoành.",
        "parts": [
            {"title": "Δ > 0", "md": "- Có **hai nghiệm phân biệt**.\n- Parabol cắt trục hoành tại hai điểm.\n- Ví dụ: $x^2-5x+6=0$ có $\\Delta=1$, nghiệm $2$ và $3$."},
            {"title": "Δ = 0", "md": "- Có **nghiệm kép** $x=-\\dfrac{b}{2a}$.\n- Parabol tiếp xúc trục hoành tại một điểm.\n- Ví dụ: $x^2-4x+4=0$ có $\\Delta=16-16=0$, nghiệm kép $x=2$."},
            {"title": "Δ < 0", "md": "- **Vô nghiệm** (trong tập số thực).\n- Parabol không chạm trục hoành.\n- Ví dụ: $x^2+x+3=0$ có $\\Delta=1-12=-11<0$."},
        ],
        "outro": "> [!canh-bao] Đừng đoán số nghiệm bằng dấu của một hệ số. Phương trình $x^2+x+3=0$ có $c>0$ mà vẫn vô nghiệm, vì thứ quyết định là $\\Delta$ chứ không phải $c$.",
    },
    {
        "layout": "steps",
        "reveal": True,
        "title": S_VD1,
        "intro": "Bài mẫu: giải $x^2-5x+6=0$. Bấm **Bước tiếp** để xem từng dòng lời giải hiện ra, hoặc bật **Nghe giảng** để thầy vừa nói vừa viết.",
        "parts": [
            {"title": "Xác định hệ số", "md": "$$a=1,\\qquad b=-5,\\qquad c=6$$\n\nVì sao: mọi bài bắt đầu từ đây, và phải ghi **kèm dấu**. Kiểm luôn $a\\neq 0$ ✓."},
            {"title": "Tính biệt thức Δ", "md": "$$\\Delta=b^2-4ac=(-5)^2-4\\cdot1\\cdot6=25-24=1$$\n\nVì sao: thay $b=-5$ vào ngoặc để bình phương ra số dương."},
            {"title": "Xét dấu Δ", "md": "$$\\Delta=1>0\\;\\Rightarrow\\;\\text{hai nghiệm phân biệt}$$\n\nVì sao: dấu của $\\Delta$ quyết định phương trình có nghiệm hay không, nên xét trước khi tính nghiệm."},
            {"title": "Áp dụng công thức nghiệm", "md": "$$x_{1,2}=\\frac{-b\\pm\\sqrt{\\Delta}}{2a}=\\frac{5\\pm\\sqrt{1}}{2\\cdot 1}=\\frac{5\\pm 1}{2}$$\n\nChú ý: $-b=5$ vì $b=-5$."},
            {"title": "Tính hai nghiệm", "md": "$$x_1=\\frac{5+1}{2}=3,\\qquad x_2=\\frac{5-1}{2}=2$$"},
            {"title": "Thử lại", "md": "$$3^2-5\\cdot3+6=0\\;✓\\qquad 2^2-5\\cdot2+6=0\\;✓$$\n\nVì sao: thử lại mất mười giây và bắt được gần hết lỗi dấu."},
        ],
        "outro": f"![Đồ thị parabol y = x² − 5x + 6 cắt trục hoành tại x = 2 và x = 3]({FIG_PARABOLA} \"Đồ thị cắt trục hoành đúng tại hai nghiệm vừa tìm được. Hình vẽ minh hoạ.\")",
    },
    {
        "layout": "text",
        "title": "Tự làm bước cuối",
        "parts": [{"md": (
            "Bài tiếp theo giải sẵn ba bước đầu. Em tự làm bước cuối rồi mở lời giải để đối chiếu.\n\n"
            "**Giải $2x^2-3x-2=0$.**\n\n"
            "1. $a=2,\\ b=-3,\\ c=-2$.\n"
            "2. $\\Delta=(-3)^2-4\\cdot2\\cdot(-2)=9+16=25$.\n"
            "3. $\\Delta>0$ nên có hai nghiệm phân biệt, và $\\sqrt{\\Delta}=5$.\n"
            "4. **Tính hai nghiệm $x_1,\\ x_2$ rồi thử lại.** *(việc của em)*\n\n"
            ":::Mở lời giải sau khi đã tự thử\n"
            "$$x_{1,2}=\\frac{-(-3)\\pm 5}{2\\cdot 2}=\\frac{3\\pm 5}{4}\\;\\Rightarrow\\;x_1=\\frac{3+5}{4}=2,\\quad x_2=\\frac{3-5}{4}=-\\frac12$$\n\n"
            "Thử lại: $2\\cdot2^2-3\\cdot2-2=0$ ✓ và $2\\cdot\\left(-\\tfrac12\\right)^2-3\\cdot\\left(-\\tfrac12\\right)-2=\\tfrac12+\\tfrac32-2=0$ ✓.\n"
            ":::"
        )}],
    },
    {
        "layout": "steps",
        "reveal": True,
        "title": S_VD_TS,
        "intro": "Bài mẫu: tìm $m$ để $x^2-2(m-1)x+m^2-3=0$ có hai nghiệm phân biệt.",
        "parts": [
            {"title": "Chọn công thức thu gọn", "md": "Hệ số $b=-2(m-1)$ là số chẵn nên đặt $b'=-(m-1)$ và dùng $\\Delta'=b'^2-ac$ cho phép tính gọn hơn. Ở đây $a=1,\\ c=m^2-3$."},
            {"title": "Tính Δ′ theo m", "md": "$$\\Delta'=(m-1)^2-(m^2-3)=m^2-2m+1-m^2+3=4-2m$$"},
            {"title": "Đặt điều kiện", "md": "$$\\text{Hai nghiệm phân biệt}\\iff\\Delta'>0\\iff 4-2m>0\\iff m<2$$\n\nVì sao: phân biệt nên phải **lớn hơn hẳn** 0, không phải $\\geq$."},
            {"title": "Kiểm bằng một giá trị cụ thể", "md": "Với $m=0$: $x^2+2x-3=0$ có $\\Delta'=1+3=4>0$ ✓. Với $m=2$: $\\Delta'=0$, chỉ còn nghiệm kép, đúng như điều kiện $m<2$."},
        ],
    },
    {
        "layout": "text",
        "title": "Tìm lỗi trong lời giải",
        "parts": [{"md": (
            "Một bạn giải $x^2+2x-8=0$ như sau. Hãy tìm bước sai **trước khi** mở đáp án.\n\n"
            "> [!ghi-nho] **Bước 1.** $a=1,\\ b=2,\\ c=-8$.\n\n"
            "> [!ghi-nho] **Bước 2.** $\\Delta=b^2-4ac=2^2-4\\cdot1\\cdot8=4-32=-28$.\n\n"
            "> [!ghi-nho] **Bước 3.** $\\Delta<0$ nên phương trình vô nghiệm.\n\n"
            ":::Lời giải sai ở bước nào?\n"
            "Sai ở **bước 2**: bạn thay $c=8$ thay vì $c=-8$. Đúng phải là $\\Delta=2^2-4\\cdot1\\cdot(-8)=4+32=36>0$, nên có hai nghiệm "
            "$x=\\dfrac{-2\\pm6}{2}$, tức $x=2$ và $x=-4$. Thử lại: $2^2+2\\cdot2-8=0$ ✓ và $(-4)^2+2\\cdot(-4)-8=0$ ✓.\n\n"
            "Lỗi này đến từ việc thay số âm mà không đặt trong ngoặc. Hãy viết $-4\\cdot a\\cdot c$ với $c$ trong ngoặc rồi mới tính.\n"
            ":::"
        )}],
    },
    {
        "layout": "faq",
        "title": "Những câu học sinh hay hỏi",
        "parts": [
            {"title": "Khi nào nên dùng Δ′ thay cho Δ?", "md": "Khi hệ số $b$ là số chẵn hoặc viết được $b=2b'$. Công thức $\\Delta'=b'^2-ac$ cho số nhỏ hơn nên ít sai hơn, và nghiệm là $x=\\dfrac{-b'\\pm\\sqrt{\\Delta'}}{a}$."},
            {"title": "Phương trình khuyết c hoặc khuyết b có cần tính Δ không?", "md": "Không bắt buộc. Với $ax^2+bx=0$ ta đặt $x$ làm nhân tử chung: $x(ax+b)=0$. Với $ax^2+c=0$ ta chuyển vế rồi lấy căn nếu hai vế cùng dấu."},
            {"title": "Δ = 0 thì có một nghiệm hay hai nghiệm?", "md": "Về giá trị chỉ có một nghiệm $x=-\\dfrac{b}{2a}$; người ta gọi là nghiệm kép vì nó là hai nghiệm trùng nhau. Đề thi dùng cả hai cách nói."},
        ],
    },
]

L1_CARDS = {
    "title": "Thẻ ghi nhớ · Phương trình bậc hai",
    "items": [
        {"term": "Phương trình bậc hai", "meaning": "Phương trình có dạng ax² + bx + c = 0 với a ≠ 0.", "example": "x² − 5x + 6 = 0 có a = 1, b = −5, c = 6."},
        {"term": "Biệt thức Δ", "meaning": "Δ = b² − 4ac; dấu của Δ cho biết số nghiệm của phương trình.", "example": "Δ = 1 > 0 nên x² − 5x + 6 = 0 có hai nghiệm phân biệt."},
        {"term": "Công thức nghiệm", "meaning": "Khi Δ > 0: x₁,₂ = (−b ± √Δ)/(2a). Khi Δ = 0: x = −b/(2a).", "note": "Chú ý dấu trừ đứng trước b."},
        {"term": "Δ′ (biệt thức thu gọn)", "meaning": "Khi b = 2b′: Δ′ = b′² − ac, nghiệm x = (−b′ ± √Δ′)/a.", "example": "x² − 2(m − 1)x + m² − 3 = 0 có Δ′ = 4 − 2m."},
    ],
}

L1_QUIZ = {
    "title": "Kiểm tra nhanh · Phương trình bậc hai",
    "passThresholdPct": 60,
    "requireConfidence": True,
    "questions": [
        {
            "key": "1.1-dieu-kien-a", "type": "mcq", "points": 1,
            "prompt": "Điều kiện nào bảo đảm $ax^2+bx+c=0$ là phương trình bậc hai một ẩn?",
            "explanation": "Chỉ cần $a\\neq0$. Nếu $a=0$, số hạng bậc hai biến mất và phương trình trở thành bậc nhất. Các hệ số $b$ và $c$ có thể bằng 0.",
            "options": [
                {"label": "$b\\neq0$", "isCorrect": False, "misconception": "on10.quen-a-khac-0"},
                {"label": "$a\\neq0$", "isCorrect": True},
                {"label": "$c\\neq0$", "isCorrect": False, "misconception": "on10.quen-a-khac-0"},
                {"label": "Cả $a,\\ b,\\ c$ đều khác 0", "isCorrect": False, "misconception": "on10.quen-a-khac-0"},
            ],
        },
        {
            "key": "1.2-giai-x2-5x-6", "type": "mcq", "points": 2,
            "prompt": "Nghiệm của phương trình $x^2-5x+6=0$ là:",
            "explanation": "$\\Delta=25-24=1$ nên $x=\\dfrac{5\\pm1}{2}$, tức $x=3$ hoặc $x=2$. Thử lại: $2+3=5$ và $2\\cdot3=6$.",
            "options": [
                {"label": "$x=-2$ và $x=-3$", "isCorrect": False, "misconception": "on10.sai-dau-b"},
                {"label": "$x=1$ và $x=6$", "isCorrect": False},
                {"label": "$x=2$ và $x=3$", "isCorrect": True},
                {"label": "Phương trình vô nghiệm", "isCorrect": False},
            ],
        },
        {
            "key": "1.3-c-duong", "type": "true_false", "points": 1,
            "prompt": "Phương trình $x^2+x+3=0$ có nghiệm vì hệ số $c=3$ là số dương.",
            "explanation": "Sai. $\\Delta=1^2-4\\cdot1\\cdot3=-11<0$ nên phương trình vô nghiệm. Số nghiệm do dấu của $\\Delta$ quyết định, không do dấu của riêng $c$.",
            "options": [
                {"label": "Đúng", "isCorrect": False, "misconception": "on10.delta-chi-nhin-c"},
                {"label": "Sai", "isCorrect": True},
            ],
        },
        {
            "key": "1.4-tinh-delta", "type": "fill_in", "points": 1,
            "prompt": "Tính biệt thức $\\Delta$ của phương trình $2x^2-3x-2=0$. Điền một số.",
            "explanation": "$a=2,\\ b=-3,\\ c=-2$ nên $\\Delta=(-3)^2-4\\cdot2\\cdot(-2)=9+16=25$. Hai nghiệm là $\\dfrac{3\\pm5}{4}$, tức $x=2$ và $x=-\\dfrac12$.",
            "answers": ["25"],
        },
        {
            "key": "1.5-keo-tha-delta", "type": "drag_drop_fill", "points": 2,
            "prompt": "Hãy kéo vào chỗ trống. Phương trình bậc hai có [[1]] nghiệm phân biệt khi Δ [[2]] 0, có nghiệm kép khi Δ [[3]] 0.",
            "explanation": "Δ > 0 cho hai nghiệm phân biệt, Δ = 0 cho nghiệm kép, Δ < 0 vô nghiệm.",
            "tokens": [
                {"label": "=", "blank": 3},
                {"label": "ba"},
                {"label": "hai", "blank": 1},
                {"label": "<"},
                {"label": ">", "blank": 2},
            ],
        },
        {
            "key": "1.6-thu-tu-giai", "type": "ordering", "points": 2,
            "prompt": "Hãy sắp xếp các bước giải phương trình bậc hai theo đúng thứ tự.",
            "explanation": "Xác định hệ số và kiểm a ≠ 0 trước, tính Δ, xét dấu Δ để biết số nghiệm, rồi mới tính nghiệm và thử lại.",
            "sequence": [
                "Xác định a, b, c và kiểm a ≠ 0",
                "Tính Δ = b² − 4ac",
                "Xét dấu Δ để biết số nghiệm",
                "Tính nghiệm theo công thức",
                "Thử lại nghiệm vào phương trình",
            ],
        },
        {
            "key": "1.7-tham-so-m", "type": "mcq", "points": 3,
            "prompt": "Phương trình $x^2-2(m-1)x+m^2-3=0$ có hai nghiệm phân biệt khi và chỉ khi:",
            "explanation": "$\\Delta'=(m-1)^2-(m^2-3)=4-2m$. Hai nghiệm phân biệt cần $\\Delta'>0$ nên $4-2m>0$, suy ra $m<2$. Với $m=2$ thì $\\Delta'=0$, chỉ có nghiệm kép.",
            "options": [
                {"label": "$m>2$", "isCorrect": False, "misconception": "on10.bat-dang-thuc-delta"},
                {"label": "$m\\leq2$", "isCorrect": False, "misconception": "on10.bat-dang-thuc-delta"},
                {"label": "$m<2$", "isCorrect": True},
                {"label": "$m\\geq2$", "isCorrect": False, "misconception": "on10.bat-dang-thuc-delta"},
            ],
        },
        {
            "key": "1.8-tim-loi", "type": "mcq", "points": 3,
            "prompt": "Lời giải của $x^2+2x-8=0$:\n\nBước 1: $a=1,\\ b=2,\\ c=-8$.\nBước 2: $\\Delta=2^2-4\\cdot1\\cdot8=4-32=-28$.\nBước 3: $\\Delta<0$ nên phương trình vô nghiệm.\n\nLời giải sai ở bước nào?",
            "explanation": "Sai ở bước 2: phải thay $c=-8$ nên $-4ac=-4\\cdot1\\cdot(-8)=+32$ và $\\Delta=4+32=36>0$. Bước 1 xác định hệ số đúng, bước 3 kết luận đúng theo kết quả của bước 2 (nhưng kết quả đó sai).",
            "options": [
                {"label": "Bước 1", "isCorrect": False},
                {"label": "Bước 3", "isCorrect": False},
                {"label": "Bước 2", "isCorrect": True},
                {"label": "Không bước nào sai", "isCorrect": False},
            ],
        },
    ],
}

L1_LECTURE = [
    lec("mo-dau", "Chào em. Hôm nay mình học phương trình bậc hai, chủ đề gần như năm nào cũng có trong đề thi vào lớp mười. Điều đáng nói là em ít khi mất điểm vì không biết công thức. Em mất điểm vì làm tắt một bước, thay sai dấu, hay quên kiểm điều kiện. Bài này mình đi chậm, từng bước, và chỉ ra chỗ dễ sai."),
    lec("Ba trường hợp của Δ", "Mọi thứ xoay quanh biệt thức đen-ta, bằng b bình phương trừ bốn a c. Nếu đen-ta lớn hơn không, phương trình có hai nghiệm phân biệt. Nếu đen-ta bằng không, có nghiệm kép. Nếu đen-ta nhỏ hơn không, phương trình vô nghiệm. Em nhớ một điều: số nghiệm do đen-ta quyết định, không phải do dấu của một hệ số riêng lẻ nào."),
    lec(S_VD1 + " #1", "Mình giải x bình phương trừ năm x cộng sáu bằng không. Bước một: xác định hệ số. a bằng một, b bằng âm năm, c bằng sáu. Em ghi kèm dấu, vì sai dấu b là lỗi phổ biến nhất. Và em kiểm luôn a khác không."),
    lec(S_VD1 + " #2", "Bước hai: tính đen-ta. Đen-ta bằng b bình phương trừ bốn a c, bằng âm năm trong ngoặc bình phương, trừ bốn nhân một nhân sáu, bằng hai mươi lăm trừ hai mươi bốn, bằng một. Em thay b vào ngoặc để bình phương ra số dương."),
    lec(S_VD1 + " #3", "Bước ba: xét dấu. Đen-ta bằng một, lớn hơn không, nên phương trình có hai nghiệm phân biệt. Em luôn xét dấu trước khi tính nghiệm."),
    lec(S_VD1 + " #4", "Bước bốn: áp dụng công thức nghiệm. x bằng trừ b cộng trừ căn đen-ta, trên hai a. Với b bằng âm năm thì trừ b bằng năm. Vậy x bằng năm cộng trừ một, trên hai."),
    lec(S_VD1 + " #5", "Bước năm: tính hai nghiệm. Năm cộng một chia hai bằng ba. Năm trừ một chia hai bằng hai. Vậy phương trình có hai nghiệm là ba và hai."),
    lec(S_VD1 + " #6", "Bước sáu, và đừng bỏ bước này: thử lại. Ba bình phương trừ năm nhân ba cộng sáu bằng không. Hai bình phương trừ năm nhân hai cộng sáu cũng bằng không. Thử lại chỉ mất mười giây mà bắt được gần hết lỗi dấu."),
    lec("Tự làm bước cuối", "Bây giờ đến lượt em. Bài hai x bình phương trừ ba x trừ hai bằng không đã được giải sẵn ba bước đầu: đen-ta bằng hai mươi lăm, căn đen-ta bằng năm. Em tự tính hai nghiệm rồi thử lại, sau đó mở lời giải để đối chiếu. Em dừng lại thử trước nhé."),
    lec(S_VD_TS + " #1", "Bài có tham số. Tìm m để phương trình có hai nghiệm phân biệt. Hệ số b là hai nhân m trừ một, là số chẵn, nên mình dùng đen-ta phẩy cho gọn."),
    lec(S_VD_TS + " #2", "Đen-ta phẩy bằng m trừ một bình phương, trừ m bình phương trừ ba. Khai triển ra m bình phương trừ hai m cộng một, trừ m bình phương cộng ba, bằng bốn trừ hai m."),
    lec(S_VD_TS + " #3", "Hai nghiệm phân biệt khi đen-ta phẩy lớn hơn không, tức bốn trừ hai m lớn hơn không, suy ra m nhỏ hơn hai. Em chú ý: phân biệt thì phải lớn hơn hẳn không, không được viết lớn hơn hoặc bằng."),
    lec(S_VD_TS + " #4", "Kiểm bằng một giá trị cụ thể. Với m bằng không, phương trình là x bình phương cộng hai x trừ ba bằng không, có đen-ta phẩy bằng bốn, dương, đúng. Với m bằng hai thì đen-ta phẩy bằng không, chỉ còn nghiệm kép, khớp với điều kiện m nhỏ hơn hai."),
    lec("Tìm lỗi trong lời giải", "Phần này em đóng vai người chấm bài. Bạn kia giải x bình phương cộng hai x trừ tám bằng không và kết luận vô nghiệm. Em tìm bước sai trước khi mở đáp án. Gợi ý: nhìn kỹ dấu của c khi thay vào công thức đen-ta."),
    lec("tong-ket", "Tóm lại. Một, luôn xác định a, b, c kèm dấu. Hai, đen-ta quyết định số nghiệm. Ba, hai nghiệm phân biệt đòi đen-ta lớn hơn không. Bốn, luôn thử lại. Làm đủ bốn điều này, em đã giữ được phần lớn điểm của dạng bài này."),
]

LESSON1 = {
    "title": "Phương trình bậc hai và biệt thức Δ",
    "durationMin": 25,
    "description": "Công thức nghiệm, ba trường hợp của Δ, lời giải từng bước, và bài có tham số — kèm bài tìm lỗi trong lời giải.",
    "look": {"palette": "limio", "font": "modern"},
    "objectives": [
        "Xác định được a, b, c của một phương trình bậc hai và kiểm được điều kiện a ≠ 0",
        "Tính được Δ (hoặc Δ′) và kết luận đúng số nghiệm",
        "Giải được phương trình bậc hai bằng công thức nghiệm và thử lại kết quả",
        "Tìm được điều kiện của tham số m để phương trình có hai nghiệm phân biệt",
        "Chỉ ra được bước sai trong một lời giải cho trước",
    ],
    "objectivesLead": "Học xong bài này, em có thể:",
    "body": L1_BODY,
    "sections": L1_SECTIONS,
    "flashcards": L1_CARDS,
    "summary": [
        "Phương trình bậc hai có dạng ax² + bx + c = 0 với a ≠ 0; việc đầu tiên luôn là xác định a, b, c kèm dấu.",
        "Δ = b² − 4ac quyết định số nghiệm: Δ > 0 hai nghiệm phân biệt, Δ = 0 nghiệm kép, Δ < 0 vô nghiệm.",
        "Hai nghiệm phân biệt đòi Δ > 0 chứ không phải Δ ≥ 0; đây là điểm hay mất điểm ở bài có tham số.",
        "Luôn thử lại nghiệm vào phương trình ban đầu trước khi kết luận.",
    ],
    "lecture": L1_LECTURE,
    "quiz": L1_QUIZ,
}

# ═══════════════════════════════════════════════════════════════════════════════
# BÀI 3 — Hệ thức Viète
# ═══════════════════════════════════════════════════════════════════════════════
S2_VD1 = "Ví dụ mẫu: tính một biểu thức của hai nghiệm"
S2_VD_TS = "Ví dụ mẫu có tham số: tìm m"

L2_BODY = (
    "Công thức nghiệm cho ta từng nghiệm. Hệ thức Viète cho ta **mối quan hệ giữa hai nghiệm mà không cần tính chúng**, "
    "và đó là chìa khoá của hầu hết bài có tham số trong đề thi vào 10. Bài này dạy ba việc: dùng Viète để tính nhanh một "
    "biểu thức của hai nghiệm, nhẩm nghiệm, và giải bài có tham số mà không bỏ sót điều kiện.\n\n"
    "> [!ghi-nho] Nếu $ax^2+bx+c=0$ ($a\\neq0$) có hai nghiệm $x_1,\\ x_2$ thì $x_1+x_2=-\\dfrac{b}{a}$ và $x_1x_2=\\dfrac{c}{a}$.\n\n"
    ":::Trước khi đọc tiếp, bạn thử kiểm\n"
    "Phương trình $x^2-7x+10=0$ có hai nghiệm $2$ và $5$. Hãy tự cộng và nhân hai nghiệm, rồi so với $-\\dfrac{b}{a}$ và "
    "$\\dfrac{c}{a}$. Nếu bạn thấy tổng là $7$ mà $b=-7$, bạn vừa tự chứng minh được vì sao công thức có dấu trừ.\n"
    ":::"
)

L2_SECTIONS = [
    {
        "layout": "stats",
        "title": "Hai con số cần thuộc",
        "intro": "Chỉ có hai đại lượng, nhưng gần như mọi bài trong bài này đều xuất phát từ chúng.",
        "parts": [
            {"title": "Tổng hai nghiệm", "md": "$-\\dfrac{b}{a}$"},
            {"title": "Tích hai nghiệm", "md": "$\\dfrac{c}{a}$"},
            {"title": "Điều kiện dùng", "md": "$\\Delta\\geq0$"},
        ],
        "outro": "> [!canh-bao] Tổng hai nghiệm là $-\\dfrac{b}{a}$, có dấu trừ. Với $x^2-7x+10=0$ ta có $b=-7$ và hai nghiệm $2,\\ 5$ cộng lại bằng $7$, nên tổng bằng $-\\dfrac{b}{a}$ chứ không phải $\\dfrac{b}{a}$.",
    },
    {
        "layout": "cards",
        "title": "Tính biểu thức của hai nghiệm mà không giải phương trình",
        "intro": "Mọi biểu thức đối xứng của $x_1$ và $x_2$ đều đưa được về tổng $S=x_1+x_2$ và tích $P=x_1x_2$. Ba biến đổi dưới đây đủ cho hầu hết đề.",
        "parts": [
            {"title": "Tổng bình phương", "md": "$$x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=S^2-2P$$"},
            {"title": "Tổng nghịch đảo", "md": "$$\\frac1{x_1}+\\frac1{x_2}=\\frac{x_1+x_2}{x_1x_2}=\\frac{S}{P}\\quad(P\\neq0)$$"},
            {"title": "Bình phương hiệu", "md": "$$(x_1-x_2)^2=(x_1+x_2)^2-4x_1x_2=S^2-4P$$"},
        ],
    },
    {
        "layout": "compare",
        "title": "Nhẩm nghiệm bằng tổng hệ số",
        "intro": "Hai trường hợp đặc biệt cho phép viết nghiệm ngay mà không tính $\\Delta$. Nhìn tổng các hệ số trước khi lao vào công thức.",
        "parts": [
            {"title": "Nếu a + b + c = 0", "md": "- Một nghiệm là $x=1$.\n- Nghiệm còn lại là $x=\\dfrac{c}{a}$.\n- Ví dụ: $3x^2-5x+2=0$ có $3-5+2=0$ nên nghiệm là $x=1$ và $x=\\dfrac23$."},
            {"title": "Nếu a − b + c = 0", "md": "- Một nghiệm là $x=-1$.\n- Nghiệm còn lại là $x=-\\dfrac{c}{a}$.\n- Ví dụ: $x^2+4x+3=0$ có $1-4+3=0$ nên nghiệm là $x=-1$ và $x=-3$."},
        ],
        "outro": "> [!meo] Hai nghiệm của $x^2-(m+1)x+m=0$ nhẩm được ngay vì $1-(m+1)+m=0$. Nghiệm là $x=1$ và $x=m$, không cần xét $\\Delta$ theo $m$.",
    },
    {
        "layout": "steps",
        "reveal": True,
        "title": S2_VD1,
        "intro": "Bài mẫu: cho $x^2-7x+10=0$ có hai nghiệm $x_1,\\ x_2$. Tính $x_1^2+x_2^2$ mà không giải phương trình.",
        "parts": [
            {"title": "Kiểm phương trình có nghiệm", "md": "$$\\Delta=(-7)^2-4\\cdot1\\cdot10=49-40=9>0$$\n\nVì sao: Viète chỉ nói về hai nghiệm khi chúng tồn tại."},
            {"title": "Viết hệ thức Viète", "md": "$$S=x_1+x_2=-\\frac{b}{a}=7,\\qquad P=x_1x_2=\\frac{c}{a}=10$$"},
            {"title": "Biến đổi biểu thức về S và P", "md": "$$x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=S^2-2P$$\n\nVì sao: $(x_1+x_2)^2$ có thêm số hạng $2x_1x_2$, nên phải trừ nó đi."},
            {"title": "Thay số", "md": "$$x_1^2+x_2^2=7^2-2\\cdot10=49-20=29$$"},
            {"title": "Kiểm bằng nghiệm thật", "md": "Nghiệm của phương trình là $2$ và $5$: $$2^2+5^2=4+25=29\\;✓$$"},
        ],
    },
    {
        "layout": "steps",
        "reveal": True,
        "title": S2_VD_TS,
        "intro": "Bài mẫu: tìm $m$ để $x^2-2(m-1)x+m^2-3=0$ có hai nghiệm thoả $x_1^2+x_2^2=10$.",
        "parts": [
            {"title": "Tìm điều kiện có nghiệm", "md": "$$\\Delta'=(m-1)^2-(m^2-3)=4-2m\\geq0\\iff m\\leq2$$\n\nVì sao: đây là bước **hay bị bỏ**. Ghi lại để đối chiếu ở bước cuối."},
            {"title": "Viết Viète theo m", "md": "$$S=2(m-1),\\qquad P=m^2-3$$"},
            {"title": "Biến đổi hệ thức của đề", "md": "$$x_1^2+x_2^2=S^2-2P=4(m-1)^2-2(m^2-3)=2m^2-8m+10$$"},
            {"title": "Giải phương trình theo m", "md": "$$2m^2-8m+10=10\\iff 2m^2-8m=0\\iff m=0\\ \\text{hoặc}\\ m=4$$"},
            {"title": "Đối chiếu điều kiện", "md": "Điều kiện $m\\leq2$: **nhận $m=0$, loại $m=4$**.\n\nThử lại $m=0$: phương trình $x^2+2x-3=0$ có hai nghiệm $1$ và $-3$, và $1^2+(-3)^2=10$ ✓."},
        ],
    },
    {
        "layout": "text",
        "title": "Tự làm bước cuối",
        "parts": [{"md": (
            "Bài tiếp theo giải sẵn ba bước đầu. Em tự làm phần còn lại.\n\n"
            "**Tìm $m$ để $x^2-2(m-1)x+m^2-3=0$ có hai nghiệm thoả $x_1+x_2=x_1x_2$.**\n\n"
            "1. Điều kiện có nghiệm: $\\Delta'=4-2m\\geq0$, tức $m\\leq2$.\n"
            "2. Viète: $S=2(m-1)$ và $P=m^2-3$.\n"
            "3. Hệ thức $S=P$ cho $2m-2=m^2-3$, tức $m^2-2m-1=0$.\n"
            "4. **Giải phương trình này rồi đối chiếu điều kiện $m\\leq2$.** *(việc của em)*\n\n"
            ":::Mở lời giải sau khi đã tự thử\n"
            "$\\Delta'=1+1=2$ nên $m=1\\pm\\sqrt2$. Đối chiếu: $1+\\sqrt2\\approx2{,}41>2$ nên **loại**; $1-\\sqrt2\\approx-0{,}41\\leq2$ nên **nhận**. "
            "Vậy $m=1-\\sqrt2$.\n"
            ":::"
        )}],
    },
    {
        "layout": "text",
        "title": "Tìm lỗi trong lời giải",
        "parts": [{"md": (
            "Một bạn giải bài \"tìm $m$ để $x^2-2(m-1)x+m^2-3=0$ có $x_1^2+x_2^2=10$\" như sau. Hãy tìm chỗ thiếu **trước khi** mở đáp án.\n\n"
            "> [!ghi-nho] $S=2(m-1),\\ P=m^2-3$, nên $x_1^2+x_2^2=S^2-2P=2m^2-8m+10$.\n\n"
            "> [!ghi-nho] Cho bằng $10$: $2m^2-8m=0$, suy ra $m=0$ hoặc $m=4$.\n\n"
            "> [!ghi-nho] **Vậy $m=0$ hoặc $m=4$.**\n\n"
            ":::Lời giải thiếu gì?\n"
            "Các phép biến đổi đều đúng, nhưng bạn **chưa kiểm điều kiện $\\Delta'\\geq0$** nên nhận thừa $m=4$. Với $m=4$ thì $\\Delta'=4-8=-4<0$, "
            "phương trình vô nghiệm, không có $x_1,\\ x_2$ để mà nói $x_1^2+x_2^2=10$. Đáp số đúng chỉ có $m=0$.\n"
            ":::"
        )}],
    },
    {
        "layout": "faq",
        "title": "Những câu học sinh hay hỏi",
        "parts": [
            {"title": "Vì sao phải kiểm Δ ≥ 0 khi đã dùng Viète?", "md": "Hệ thức Viète chỉ nói về hai nghiệm khi chúng tồn tại. Nếu $\\Delta<0$ thì không có $x_1,\\ x_2$ để mà cộng và nhân, và giá trị $m$ tìm ra là vô nghĩa. Ví dụ trên cho thấy $m=4$ thoả hệ thức nhưng làm phương trình vô nghiệm."},
            {"title": "Biết tổng S và tích P, làm sao tìm hai số?", "md": "Hai số đó là nghiệm của $X^2-SX+P=0$, với điều kiện $S^2-4P\\geq0$. Ví dụ tổng $5$ và tích $6$: $X^2-5X+6=0$ cho hai số $2$ và $3$."},
            {"title": "Viète dùng được khi nghiệm kép không?", "md": "Dùng được: nghiệm kép coi như $x_1=x_2$, và hai hệ thức vẫn đúng. Điều kiện chỉ cần $\\Delta\\geq0$, không đòi $\\Delta>0$."},
        ],
    },
]

L2_CARDS = {
    "title": "Thẻ ghi nhớ · Hệ thức Viète",
    "items": [
        {"term": "Hệ thức Viète", "meaning": "Nếu ax² + bx + c = 0 có hai nghiệm x₁, x₂ thì x₁ + x₂ = −b/a và x₁x₂ = c/a.", "note": "Dấu trừ ở tổng."},
        {"term": "Tổng bình phương hai nghiệm", "meaning": "x₁² + x₂² = (x₁ + x₂)² − 2x₁x₂.", "example": "x² − 7x + 10 = 0: 49 − 20 = 29."},
        {"term": "Nhẩm nghiệm", "meaning": "a + b + c = 0 thì x = 1 là nghiệm; a − b + c = 0 thì x = −1 là nghiệm.", "example": "3x² − 5x + 2 = 0 có hai nghiệm 1 và 2/3."},
        {"term": "Tìm hai số biết tổng S và tích P", "meaning": "Hai số là nghiệm của X² − SX + P = 0, điều kiện S² − 4P ≥ 0."},
    ],
}

L2_QUIZ = {
    "title": "Kiểm tra nhanh · Hệ thức Viète",
    "passThresholdPct": 60,
    "requireConfidence": True,
    "questions": [
        {
            "key": "2.1-tong-nghiem", "type": "mcq", "points": 1,
            "prompt": "Tổng hai nghiệm của phương trình $x^2-7x+10=0$ bằng:",
            "explanation": "Theo Viète $x_1+x_2=-\\dfrac{b}{a}=-\\dfrac{-7}{1}=7$. Kiểm bằng nghiệm thật $2$ và $5$: $2+5=7$.",
            "options": [
                {"label": "$-7$", "isCorrect": False, "misconception": "on10.viete-sai-dau-tong"},
                {"label": "$10$", "isCorrect": False},
                {"label": "$7$", "isCorrect": True},
                {"label": "$-10$", "isCorrect": False},
            ],
        },
        {
            "key": "2.2-ghep-cong-thuc", "type": "matching", "points": 3,
            "prompt": "Hãy ghép mỗi điều kiện hoặc đại lượng với kết quả tương ứng.",
            "explanation": "x₁ + x₂ = −b/a, x₁x₂ = c/a; nếu a + b + c = 0 thì x = 1 là nghiệm; nếu a − b + c = 0 thì x = −1 là nghiệm.",
            "pairs": [
                {"left": "x₁ + x₂", "right": "−b/a"},
                {"left": "x₁ · x₂", "right": "c/a"},
                {"left": "a + b + c = 0", "right": "Một nghiệm là x = 1"},
                {"left": "a − b + c = 0", "right": "Một nghiệm là x = −1"},
            ],
        },
        {
            "key": "2.3-tong-binh-phuong", "type": "fill_in", "points": 2,
            "prompt": "Gọi $x_1,\\ x_2$ là hai nghiệm của $x^2-7x+10=0$. Tính $x_1^2+x_2^2$. Điền một số.",
            "explanation": "$x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=7^2-2\\cdot10=29$. Kiểm: $2^2+5^2=29$.",
            "answers": ["29"],
        },
        {
            "key": "2.4-quen-delta", "type": "true_false", "points": 2,
            "prompt": "Khi tìm $m$ để hai nghiệm thoả $x_1^2+x_2^2=10$, chỉ cần giải phương trình theo $m$, không cần xét $\\Delta$ vì đã dùng hệ thức Viète.",
            "explanation": "Sai. Hệ thức Viète chỉ có nghĩa khi phương trình có nghiệm. Giá trị m tìm ra phải thoả Δ ≥ 0, nếu không phải loại, như m = 4 ở ví dụ trong bài.",
            "options": [
                {"label": "Đúng", "isCorrect": False, "misconception": "on10.viete-quen-dieu-kien"},
                {"label": "Sai", "isCorrect": True},
            ],
        },
        {
            "key": "2.5-hai-so", "type": "mcq", "points": 2,
            "prompt": "Hai số có tổng bằng $5$ và tích bằng $6$ là nghiệm của phương trình nào?",
            "explanation": "Hai số có tổng $S$ và tích $P$ là nghiệm của $X^2-SX+P=0$. Với $S=5,\\ P=6$ ta có $X^2-5X+6=0$, nghiệm là $2$ và $3$.",
            "options": [
                {"label": "$X^2-5X+6=0$", "isCorrect": True},
                {"label": "$X^2+5X+6=0$", "isCorrect": False, "misconception": "on10.viete-sai-dau-tong"},
                {"label": "$X^2-6X+5=0$", "isCorrect": False},
                {"label": "$X^2-5X-6=0$", "isCorrect": False},
            ],
        },
        {
            "key": "2.6-keo-tha-viete", "type": "drag_drop_fill", "points": 2,
            "prompt": "Hãy kéo vào chỗ trống. Theo hệ thức Viète, x₁ + x₂ = [[1]] và x₁·x₂ = [[2]].",
            "explanation": "Tổng hai nghiệm là −b/a và tích hai nghiệm là c/a.",
            "tokens": [
                {"label": "b/a"},
                {"label": "−b/a", "blank": 1},
                {"label": "−c/a"},
                {"label": "c/a", "blank": 2},
            ],
        },
        {
            "key": "2.7-nham-nghiem", "type": "mcq", "points": 2,
            "prompt": "Phương trình $3x^2-5x+2=0$ có $a+b+c=0$. Hai nghiệm của nó là:",
            "explanation": "Vì $3-5+2=0$ nên $x_1=1$, và $x_2=\\dfrac{c}{a}=\\dfrac23$. Kiểm: tổng $1+\\dfrac23=\\dfrac53=-\\dfrac{b}{a}$.",
            "options": [
                {"label": "$x=-1$ và $x=-\\dfrac23$", "isCorrect": False},
                {"label": "$x=1$ và $x=\\dfrac32$", "isCorrect": False},
                {"label": "$x=1$ và $x=2$", "isCorrect": False},
                {"label": "$x=1$ và $x=\\dfrac23$", "isCorrect": True},
            ],
        },
        {
            "key": "2.8-tim-loi", "type": "mcq", "points": 3,
            "prompt": "Một bạn giải: tìm $m$ để $x^2-2(m-1)x+m^2-3=0$ có $x_1^2+x_2^2=10$. Bạn viết $S=2(m-1),\\ P=m^2-3$, được $2m^2-8m=0$ nên $m=0$ hoặc $m=4$, và kết luận \"vậy $m=0$ hoặc $m=4$\".\n\nLời giải này thiếu gì?",
            "explanation": "Các phép biến đổi đúng, nhưng thiếu điều kiện $\\Delta'\\geq0$ tức $m\\leq2$. Với $m=4$ phương trình vô nghiệm, nên phải loại; đáp số đúng là $m=0$.",
            "options": [
                {"label": "Viết sai hệ thức Viète của $S$", "isCorrect": False, "misconception": "on10.viete-sai-dau-tong"},
                {"label": "Phải đổi dấu hai nghiệm tìm được", "isCorrect": False},
                {"label": "Thiếu kiểm điều kiện Δ′ ≥ 0 nên nhận thừa m = 4", "isCorrect": True},
                {"label": "Không thiếu gì, đáp số đúng", "isCorrect": False, "misconception": "on10.viete-quen-dieu-kien"},
            ],
        },
    ],
}

L2_LECTURE = [
    lec("mo-dau", "Bài trước mình học tìm từng nghiệm. Bài này mình học một công cụ mạnh hơn: hệ thức Viète. Nó cho em biết quan hệ giữa hai nghiệm mà không cần tính chúng ra. Hầu hết bài có tham số trong đề thi dùng đến nó, và chỗ em hay mất điểm là quên một điều kiện mà mình sẽ nhấn mạnh trong bài."),
    lec("Hai con số cần thuộc", "Chỉ cần thuộc hai con số. Tổng hai nghiệm bằng âm b chia a. Tích hai nghiệm bằng c chia a. Và chúng chỉ dùng được khi đen-ta lớn hơn hoặc bằng không. Em nhớ dấu trừ ở tổng, vì đây là chỗ sai nhiều nhất."),
    lec(S2_VD1 + " #1", "Bài mẫu: cho x bình phương trừ bảy x cộng mười bằng không. Tính tổng bình phương hai nghiệm mà không giải phương trình. Bước một: kiểm phương trình có nghiệm. Đen-ta bằng bốn mươi chín trừ bốn mươi, bằng chín, dương. Viète chỉ nói về hai nghiệm khi chúng tồn tại."),
    lec(S2_VD1 + " #2", "Bước hai: viết hệ thức Viète. Tổng S bằng âm b chia a, bằng bảy. Tích P bằng c chia a, bằng mười."),
    lec(S2_VD1 + " #3", "Bước ba: biến đổi biểu thức về S và P. Tổng bình phương hai nghiệm bằng tổng hai nghiệm bình phương, trừ hai lần tích. Vì sao? Vì khi bình phương một tổng sẽ có thêm số hạng hai lần tích, nên mình phải trừ nó đi."),
    lec(S2_VD1 + " #4", "Bước bốn: thay số. Bảy bình phương bằng bốn mươi chín, trừ hai nhân mười bằng hai mươi, được hai mươi chín."),
    lec(S2_VD1 + " #5", "Bước năm: kiểm bằng nghiệm thật. Hai nghiệm của phương trình là hai và năm. Hai bình phương cộng năm bình phương bằng bốn cộng hai mươi lăm, đúng hai mươi chín."),
    lec(S2_VD_TS + " #1", "Bây giờ bài có tham số. Tìm m để hai nghiệm thoả tổng bình phương bằng mười. Bước một, và đây là bước hay bị bỏ: tìm điều kiện có nghiệm. Đen-ta phẩy bằng bốn trừ hai m, phải lớn hơn hoặc bằng không, nên m nhỏ hơn hoặc bằng hai. Em ghi lại để đối chiếu ở bước cuối."),
    lec(S2_VD_TS + " #2", "Bước hai: viết Viète theo m. Tổng S bằng hai nhân m trừ một. Tích P bằng m bình phương trừ ba."),
    lec(S2_VD_TS + " #3", "Bước ba: biến đổi hệ thức của đề. Tổng bình phương bằng S bình phương trừ hai P, bằng bốn nhân m trừ một bình phương, trừ hai nhân m bình phương trừ ba. Khai triển ra hai m bình phương, trừ tám m, cộng mười."),
    lec(S2_VD_TS + " #4", "Bước bốn: giải phương trình theo m. Hai m bình phương trừ tám m cộng mười bằng mười, suy ra hai m bình phương trừ tám m bằng không. Vậy m bằng không hoặc m bằng bốn."),
    lec(S2_VD_TS + " #5", "Bước năm, bước quyết định: đối chiếu điều kiện. Điều kiện là m nhỏ hơn hoặc bằng hai. Vậy nhận m bằng không, loại m bằng bốn. Thử lại m bằng không: phương trình x bình phương cộng hai x trừ ba bằng không, có hai nghiệm một và âm ba, và bình phương hai nghiệm cộng lại đúng bằng mười."),
    lec("Tự làm bước cuối", "Đến lượt em. Bài này đã giải sẵn ba bước, hệ thức cho ra m bình phương trừ hai m trừ một bằng không. Em giải phương trình đó và nhớ đối chiếu điều kiện m nhỏ hơn hoặc bằng hai. Có một nghiệm sẽ bị loại. Em thử trước rồi mở lời giải."),
    lec("Tìm lỗi trong lời giải", "Em lại đóng vai người chấm. Bạn kia giải ra m bằng không hoặc m bằng bốn rồi kết luận cả hai. Các phép biến đổi đều đúng. Em tìm xem bạn thiếu bước nào."),
    lec("tong-ket", "Tóm lại. Tổng hai nghiệm là âm b chia a, tích là c chia a. Mọi biểu thức đối xứng đều đưa được về tổng và tích. Nhìn tổng các hệ số trước khi tính đen-ta để nhẩm nghiệm. Và với bài tham số, ghi điều kiện có nghiệm ở bước đầu, đối chiếu ở bước cuối."),
]

LESSON2 = {
    "title": "Hệ thức Viète và các dạng bài tham số",
    "durationMin": 25,
    "description": "Tính biểu thức của hai nghiệm không cần giải, nhẩm nghiệm, và giải bài có tham số mà không sót điều kiện Δ ≥ 0.",
    "look": {"palette": "forest", "font": "modern"},
    "objectives": [
        "Viết được tổng và tích hai nghiệm bằng hệ số, đúng dấu",
        "Biến đổi được x₁² + x₂², 1/x₁ + 1/x₂ về tổng S và tích P",
        "Nhẩm được nghiệm khi a + b + c = 0 hoặc a − b + c = 0",
        "Giải được bài tìm tham số m theo năm bước và loại đúng giá trị không thoả điều kiện",
        "Phát hiện được lời giải thiếu bước kiểm điều kiện Δ′ ≥ 0",
    ],
    "objectivesLead": "Học xong bài này, em có thể:",
    "body": L2_BODY,
    "sections": L2_SECTIONS,
    "flashcards": L2_CARDS,
    "summary": [
        "x₁ + x₂ = −b/a và x₁x₂ = c/a, chỉ dùng khi Δ ≥ 0.",
        "Mọi biểu thức đối xứng của hai nghiệm đều đưa được về S = x₁ + x₂ và P = x₁x₂.",
        "Nhìn a + b + c và a − b + c trước khi tính Δ: nhiều phương trình nhẩm được nghiệm.",
        "Bài tham số: điều kiện Δ ≥ 0 ghi ở bước đầu và đối chiếu ở bước cuối.",
    ],
    "lecture": L2_LECTURE,
    "quiz": L2_QUIZ,
}

# ═══════════════════════════════════════════════════════════════════════════════
# BÀI 4 — Giải bài toán bằng cách lập phương trình
# ═══════════════════════════════════════════════════════════════════════════════
S3_QT = "Quy trình sáu bước"
S3_VD = "Ví dụ mẫu: bài chuyển động"

L3_BODY = (
    "Bài toán lập phương trình thường chiếm 1,5 đến 2 điểm trong đề thi vào 10 và là chỗ **mất điểm vì cẩu thả** nhiều "
    "nhất: giải đúng phương trình nhưng quên loại nghiệm không phù hợp, hoặc trả lời sai đại lượng. Bài này không dạy "
    "thêm công thức; nó dạy một **quy trình** đi từ đề chữ đến đáp số, áp lên hai dạng quen thuộc là hình học và chuyển động.\n\n"
    "> [!ghi-nho] Nghiệm của phương trình chưa phải là đáp số của bài toán. Đáp số là nghiệm **thoả điều kiện đặt ở bước đầu**, "
    "và phải trả lời đúng đại lượng mà đề hỏi.\n\n"
    ":::Trước khi đọc tiếp, bạn thử đoán\n"
    "Một số tự nhiên $n$ thoả $n(n+1)=156$. Giải $n^2+n-156=0$ sẽ ra hai nghiệm, và một trong hai là số âm. Theo bạn, đáp "
    "số của bài toán là một hay hai số? Bạn hãy nghĩ trước, rồi đọc phần “Quy trình sáu bước”.\n"
    ":::"
)

L3_SECTIONS = [
    {
        "layout": "steps",
        "title": S3_QT,
        "intro": "Mọi bài toán lập phương trình đều đi theo cùng một đường. Viết ra từng bước trong bài làm cũng chính là cách để người chấm cho điểm từng ý.",
        "parts": [
            {"title": "Đọc đề, gạch chân đại lượng cần tìm", "md": "Xác định đề hỏi gì. Ẩn đặt ra không nhất thiết là đại lượng đề hỏi, nhưng phải biết cuối cùng cần trả lời gì."},
            {"title": "Chọn ẩn và đặt điều kiện", "md": "Ghi rõ đơn vị và điều kiện: vận tốc dương, độ dài dương, số người là số tự nhiên."},
            {"title": "Biểu diễn các đại lượng còn lại theo ẩn", "md": "Dùng công thức quen thuộc: quãng đường = vận tốc × thời gian, diện tích = dài × rộng."},
            {"title": "Lập phương trình", "md": "Dựa vào mối quan hệ cho trong đề (bằng nhau, hơn kém nhau bao nhiêu)."},
            {"title": "Giải phương trình", "md": "Dùng công thức nghiệm hoặc Viète; giữ nguyên cả hai nghiệm."},
            {"title": "Đối chiếu điều kiện và trả lời", "md": "Loại nghiệm không thoả điều kiện, rồi viết câu trả lời có đơn vị."},
        ],
    },
    {
        "layout": "compare",
        "title": "Hai dạng quen thuộc",
        "intro": "Hai dạng này chiếm phần lớn các bài lập phương trình trong đề; điều đáng nhớ là điều kiện của ẩn mỗi dạng khác nhau.",
        "parts": [
            {"title": "Bài toán hình học", "md": "- Ẩn thường là một cạnh, điều kiện **ẩn > 0**.\n- Hay cho chu vi và diện tích: nửa chu vi cho tổng dài + rộng, diện tích cho tích.\n- Dễ quên: đề thường nói rõ cạnh nào dài hơn."},
            {"title": "Bài toán chuyển động", "md": "- Ẩn thường là vận tốc, điều kiện **ẩn > 0**.\n- Dùng $t=\\dfrac{s}{v}$.\n- Dễ quên: đổi phút ra giờ trước khi lập phương trình."},
        ],
    },
    {
        "layout": "steps",
        "reveal": True,
        "title": S3_VD,
        "intro": "Đề: Một ô tô đi từ A đến B dài $100$ km. Lúc về, ô tô tăng vận tốc thêm $10$ km/h nên thời gian về ít hơn thời gian đi $20$ phút. Tính vận tốc lúc đi.",
        "parts": [
            {"title": "Chọn ẩn, đặt điều kiện", "md": "Gọi vận tốc lúc đi là $x$ (km/h), điều kiện $x>0$. Vận tốc lúc về là $x+10$ (km/h)."},
            {"title": "Biểu diễn thời gian", "md": "$$t_{\\text{đi}}=\\frac{100}{x},\\qquad t_{\\text{về}}=\\frac{100}{x+10}\\quad(\\text{giờ})$$\n\nĐổi $20$ phút $=\\dfrac13$ giờ **trước khi** lập phương trình."},
            {"title": "Lập phương trình", "md": "Thời gian đi hơn thời gian về $\\dfrac13$ giờ:\n$$\\frac{100}{x}-\\frac{100}{x+10}=\\frac13$$"},
            {"title": "Giải phương trình", "md": "Quy đồng: $300(x+10)-300x=x(x+10)$, tức $3000=x^2+10x$.\n$$x^2+10x-3000=0,\\qquad\\Delta'=25+3000=3025=55^2$$\n$$x=-5+55=50\\ \\ \\text{hoặc}\\ \\ x=-5-55=-60$$"},
            {"title": "Đối chiếu điều kiện và trả lời", "md": "Điều kiện $x>0$ loại $x=-60$. Vậy vận tốc lúc đi là **$50$ km/h**.\n\nThử lại: đi $100$ km với $50$ km/h mất $2$ giờ; về với $60$ km/h mất $\\dfrac53$ giờ; hiệu $2-\\dfrac53=\\dfrac13$ giờ $=20$ phút ✓."},
        ],
    },
    {
        "layout": "text",
        "title": "Tự làm bước cuối",
        "parts": [{"md": (
            "**Một hình chữ nhật có chu vi $28$ m và diện tích $48$ m². Biết chiều dài lớn hơn chiều rộng. Tính chiều dài.**\n\n"
            "1. Nửa chu vi là $14$ m. Gọi chiều dài là $x$ (m), điều kiện $x>7$ (vì dài hơn rộng); chiều rộng là $14-x$ (m).\n"
            "2. Diện tích bằng $48$: $x(14-x)=48$, tức $x^2-14x+48=0$.\n"
            "3. **Giải phương trình, đối chiếu điều kiện $x>7$ rồi trả lời.** *(việc của em)*\n\n"
            ":::Mở lời giải sau khi đã tự thử\n"
            "$\\Delta'=49-48=1$ nên $x=7\\pm1$, tức $x=8$ hoặc $x=6$. Điều kiện $x>7$ loại $x=6$. "
            "Vậy chiều dài là **$8$ m** (chiều rộng $6$ m). Kiểm: $8\\cdot6=48$ ✓ và chu vi $2(8+6)=28$ ✓.\n"
            ":::"
        )}],
    },
    {
        "layout": "text",
        "title": "Tìm lỗi trong lời giải",
        "parts": [{"md": (
            "Đề: tìm hai số tự nhiên liên tiếp có tích bằng $156$. Một bạn giải như sau.\n\n"
            "> [!ghi-nho] Gọi số nhỏ là $x$, số lớn là $x+1$. Ta có $x(x+1)=156$, tức $x^2+x-156=0$.\n\n"
            "> [!ghi-nho] $\\Delta=1+624=625$, nên $x=12$ hoặc $x=-13$.\n\n"
            "> [!ghi-nho] **Vậy số nhỏ là $12$ hoặc $-13$.**\n\n"
            ":::Lời giải thiếu gì?\n"
            "Thiếu bước **đối chiếu điều kiện**. Đề nói số tự nhiên nên $x\\geq0$, loại $x=-13$. Vậy hai số là **$12$ và $13$** (kiểm: $12\\cdot13=156$). "
            "Một lời giải đúng toàn bộ phép tính vẫn bị trừ điểm nếu thiếu dòng này.\n"
            ":::"
        )}],
    },
    {
        "layout": "cards",
        "title": "Ba lỗi làm mất điểm nhiều nhất",
        "parts": [
            {"title": "Không loại nghiệm", "md": "Giải xong nhận cả hai nghiệm. Hãy tập thói quen viết dòng “Đối chiếu điều kiện” trong mọi bài làm."},
            {"title": "Quên đổi đơn vị", "md": "Đề cho thời gian bằng phút mà vận tốc tính theo km/h. Đổi trước khi lập phương trình, không đổi ở cuối."},
            {"title": "Trả lời sai đại lượng", "md": "Đề hỏi số nhỏ mà trả lời số lớn, hoặc hỏi vận tốc lúc về mà trả lời vận tốc lúc đi. Đọc lại câu hỏi ngay trước khi viết đáp số."},
        ],
        "outro": "> [!canh-bao] Một bài đúng toàn bộ phép tính vẫn có thể bị trừ điểm nếu đáp số không thoả điều kiện của đề. Người chấm tìm dòng đối chiếu điều kiện trước tiên.",
    },
    {
        "layout": "faq",
        "title": "Những câu học sinh hay hỏi",
        "parts": [
            {"title": "Nên đặt ẩn là đại lượng đề hỏi hay đại lượng khác?", "md": "Thường đặt ẩn là đại lượng đề hỏi cho trả lời đỡ nhầm. Nếu phương trình sẽ rườm rà, có thể đặt ẩn khác, nhưng khi đó phải viết lại câu trả lời thật cẩn thận."},
            {"title": "Phương trình ra nghiệm xấu (không nguyên, có căn) thì sao?", "md": "Nghiệm xấu thường là dấu hiệu lập sai phương trình hoặc quên đổi đơn vị. Đề thi vào 10 gần như luôn cho nghiệm đẹp, nên hãy kiểm lại bước lập phương trình."},
        ],
    },
]

L3_CARDS = {
    "title": "Thẻ ghi nhớ · Lập phương trình",
    "items": [
        {"term": "Quy trình lập phương trình", "meaning": "Chọn ẩn và đặt điều kiện → biểu diễn → lập phương trình → giải → đối chiếu điều kiện → trả lời."},
        {"term": "Công thức chuyển động", "meaning": "Quãng đường = vận tốc × thời gian, nên thời gian = quãng đường ÷ vận tốc.", "note": "Đổi phút ra giờ trước khi lập phương trình."},
        {"term": "Điều kiện của ẩn", "meaning": "Vận tốc, độ dài, thời gian phải dương; số người, số sản phẩm phải là số tự nhiên.", "example": "Giải ra x = −60 km/h thì loại."},
        {"term": "Đối chiếu điều kiện", "meaning": "Bước cuối bắt buộc: loại nghiệm không thoả điều kiện đặt ra rồi mới kết luận."},
    ],
}

L3_QUIZ = {
    "title": "Kiểm tra nhanh · Lập phương trình",
    "passThresholdPct": 60,
    "requireConfidence": True,
    "questions": [
        {
            "key": "3.1-thu-tu-buoc", "type": "ordering", "points": 2,
            "prompt": "Hãy sắp xếp các bước giải bài toán bằng cách lập phương trình theo đúng thứ tự.",
            "explanation": "Chọn ẩn và điều kiện trước, rồi biểu diễn các đại lượng khác, lập phương trình, giải; bước cuối luôn là đối chiếu điều kiện và trả lời.",
            "sequence": [
                "Chọn ẩn và đặt điều kiện cho ẩn",
                "Biểu diễn các đại lượng khác theo ẩn",
                "Lập phương trình",
                "Giải phương trình",
                "Đối chiếu điều kiện rồi trả lời",
            ],
        },
        {
            "key": "3.2-hai-so-lien-tiep", "type": "mcq", "points": 2,
            "prompt": "Tích của hai số tự nhiên liên tiếp bằng $156$. Số nhỏ trong hai số đó là:",
            "explanation": "Gọi số nhỏ là $x$ thì $x^2+x-156=0$, cho $x=12$ hoặc $x=-13$. Điều kiện $x$ là số tự nhiên loại $-13$. Số nhỏ là $12$, số lớn là $13$.",
            "options": [
                {"label": "$13$", "isCorrect": False, "misconception": "on10.nham-dai-luong"},
                {"label": "$-13$", "isCorrect": False, "misconception": "on10.quen-doi-chieu-dieu-kien"},
                {"label": "$11$", "isCorrect": False},
                {"label": "$12$", "isCorrect": True},
            ],
        },
        {
            "key": "3.3-van-toc", "type": "fill_in", "points": 2,
            "prompt": "Ô tô đi quãng đường $100$ km, lúc về tăng vận tốc thêm $10$ km/h nên về sớm hơn $20$ phút. Tính vận tốc lúc đi (km/h). Điền một số.",
            "explanation": "$\\dfrac{100}{x}-\\dfrac{100}{x+10}=\\dfrac13$ dẫn đến $x^2+10x-3000=0$, nghiệm $x=50$ hoặc $x=-60$. Loại $x=-60$, nên vận tốc lúc đi là $50$ km/h.",
            "answers": ["50", "50 km/h"],
        },
        {
            "key": "3.4-nhan-moi-nghiem", "type": "true_false", "points": 1,
            "prompt": "Sau khi giải phương trình lập được, nghiệm nào của phương trình cũng là đáp số hợp lệ của bài toán.",
            "explanation": "Sai. Nghiệm phải thoả điều kiện đã đặt cho ẩn (dương, nguyên, lớn hơn đại lượng khác…). Nghiệm không thoả điều kiện phải loại.",
            "options": [
                {"label": "Đúng", "isCorrect": False, "misconception": "on10.quen-doi-chieu-dieu-kien"},
                {"label": "Sai", "isCorrect": True},
            ],
        },
        {
            "key": "3.5-hinh-chu-nhat", "type": "mcq", "points": 3,
            "prompt": "Một hình chữ nhật có chu vi $28$ m và diện tích $48$ m². Biết chiều dài lớn hơn chiều rộng. Chiều dài là:",
            "explanation": "Nửa chu vi là $14$. Gọi chiều dài $x$ thì chiều rộng $14-x$ và $x(14-x)=48$, tức $x^2-14x+48=0$, nghiệm $x=8$ hoặc $x=6$. Chiều dài phải lớn hơn chiều rộng nên chọn $x=8$ (rộng $6$). Với $x=6$ thì rộng $8$, trái đề.",
            "options": [
                {"label": "$6$ m", "isCorrect": False, "misconception": "on10.quen-doi-chieu-dieu-kien"},
                {"label": "$7$ m", "isCorrect": False},
                {"label": "$14$ m", "isCorrect": False},
                {"label": "$8$ m", "isCorrect": True},
            ],
        },
        {
            "key": "3.6-keo-tha-dat-an", "type": "drag_drop_fill", "points": 3,
            "prompt": "Hãy kéo vào chỗ trống. Gọi vận tốc lúc đi là x (km/h) với điều kiện [[1]]. Vận tốc lúc về là [[2]] (km/h) và thời gian đi quãng đường 100 km là [[3]] (giờ).",
            "explanation": "Vận tốc phải dương nên x > 0; lúc về tăng thêm 10 km/h nên vận tốc là x + 10; thời gian đi là quãng đường chia vận tốc, tức 100/x.",
            "tokens": [
                {"label": "100/x", "blank": 3},
                {"label": "x − 10"},
                {"label": "x > 0", "blank": 1},
                {"label": "100x"},
                {"label": "x + 10", "blank": 2},
            ],
        },
        {
            "key": "3.7-tim-loi", "type": "mcq", "points": 3,
            "prompt": "Đề: tìm hai số tự nhiên liên tiếp có tích bằng $156$. Bạn An lập $x^2+x-156=0$, giải ra $x=12$ hoặc $x=-13$ rồi kết luận \"số nhỏ là $12$ hoặc $-13$\".\n\nBài làm của An thiếu gì?",
            "explanation": "Thiếu bước đối chiếu điều kiện: $x$ là số tự nhiên nên loại $x=-13$. Phép tính đúng, nhưng đáp số phải là $12$ và $13$.",
            "options": [
                {"label": "Lập sai phương trình", "isCorrect": False},
                {"label": "Thiếu bước đối chiếu điều kiện để loại $x=-13$", "isCorrect": True},
                {"label": "Tính sai $\\Delta$", "isCorrect": False},
                {"label": "Không thiếu gì", "isCorrect": False, "misconception": "on10.quen-doi-chieu-dieu-kien"},
            ],
        },
    ],
}

L3_LECTURE = [
    lec("mo-dau", "Bài toán lập phương trình thường chiếm một rưỡi đến hai điểm trong đề thi vào lớp mười, và là chỗ em hay mất điểm vì cẩu thả. Em giải đúng phương trình nhưng quên loại nghiệm, hoặc trả lời sai đại lượng. Bài này không dạy thêm công thức. Nó dạy một quy trình đi từ đề chữ đến đáp số."),
    lec(S3_QT, "Quy trình có sáu bước. Một, đọc đề và gạch chân đại lượng cần tìm. Hai, chọn ẩn và đặt điều kiện. Ba, biểu diễn các đại lượng còn lại theo ẩn. Bốn, lập phương trình. Năm, giải phương trình. Sáu, đối chiếu điều kiện rồi trả lời. Viết ra từng bước trong bài làm cũng là cách để người chấm cho điểm từng ý."),
    lec(S3_VD + " #1", "Bài mẫu: ô tô đi từ A đến B dài một trăm ki-lô-mét. Lúc về tăng vận tốc mười ki-lô-mét một giờ nên về sớm hơn hai mươi phút. Tìm vận tốc lúc đi. Bước một: gọi vận tốc lúc đi là x ki-lô-mét một giờ, điều kiện x lớn hơn không. Vận tốc lúc về là x cộng mười."),
    lec(S3_VD + " #2", "Bước hai: biểu diễn thời gian. Thời gian đi là một trăm chia x. Thời gian về là một trăm chia x cộng mười. Và em đổi hai mươi phút thành một phần ba giờ ngay bây giờ, trước khi lập phương trình."),
    lec(S3_VD + " #3", "Bước ba: lập phương trình. Thời gian đi hơn thời gian về một phần ba giờ. Vậy một trăm chia x, trừ một trăm chia x cộng mười, bằng một phần ba."),
    lec(S3_VD + " #4", "Bước bốn: giải. Quy đồng ra ba trăm nhân x cộng mười, trừ ba trăm x, bằng x nhân x cộng mười. Rút gọn được x bình phương cộng mười x trừ ba nghìn bằng không. Đen-ta phẩy bằng hai mươi lăm cộng ba nghìn, bằng ba nghìn không trăm hai mươi lăm, là năm mươi lăm bình phương. Vậy x bằng năm mươi hoặc x bằng âm sáu mươi."),
    lec(S3_VD + " #5", "Bước năm, bước không được bỏ: đối chiếu điều kiện. Vận tốc phải dương nên loại âm sáu mươi. Vận tốc lúc đi là năm mươi ki-lô-mét một giờ. Thử lại: đi với năm mươi mất hai giờ, về với sáu mươi mất năm phần ba giờ, hiệu đúng một phần ba giờ, tức hai mươi phút."),
    lec("Tự làm bước cuối", "Đến lượt em. Hình chữ nhật chu vi hai mươi tám mét, diện tích bốn mươi tám mét vuông, chiều dài lớn hơn chiều rộng. Mình đã lập sẵn phương trình x bình phương trừ mười bốn x cộng bốn mươi tám bằng không. Em giải, đối chiếu điều kiện x lớn hơn bảy rồi trả lời. Em thử trước rồi mở lời giải."),
    lec("Tìm lỗi trong lời giải", "Em đóng vai người chấm. Bạn kia tìm hai số tự nhiên liên tiếp có tích một trăm năm mươi sáu, ra x bằng mười hai hoặc âm mười ba và kết luận cả hai. Em tìm bước thiếu."),
    lec("tong-ket", "Tóm lại. Mọi bài lập phương trình đi theo sáu bước, và bước cuối là đối chiếu điều kiện. Nghiệm của phương trình chưa phải đáp số. Đổi đơn vị trước khi lập phương trình, và đọc lại câu hỏi trước khi viết đáp số."),
]

LESSON3 = {
    "title": "Giải bài toán bằng cách lập phương trình",
    "durationMin": 25,
    "description": "Quy trình sáu bước từ đề chữ đến đáp số, áp dụng cho bài hình học và chuyển động, và ba lỗi hay mất điểm.",
    "look": {"palette": "sunset", "font": "modern"},
    "objectives": [
        "Chọn được ẩn, đặt đúng điều kiện và đơn vị cho ẩn",
        "Lập được phương trình từ đề chữ cho bài hình học và chuyển động",
        "Loại được nghiệm không thoả điều kiện và trả lời đúng đại lượng đề hỏi",
        "Phát hiện được lời giải thiếu bước đối chiếu điều kiện",
    ],
    "objectivesLead": "Học xong bài này, em có thể:",
    "body": L3_BODY,
    "sections": L3_SECTIONS,
    "flashcards": L3_CARDS,
    "summary": [
        "Mọi bài lập phương trình đi theo sáu bước, và bước cuối là đối chiếu điều kiện.",
        "Nghiệm của phương trình chưa phải đáp số; đáp số là nghiệm thoả điều kiện của ẩn.",
        "Đổi đơn vị trước khi lập phương trình, và đọc lại câu hỏi trước khi viết đáp số.",
    ],
    "lecture": L3_LECTURE,
    "quiz": L3_QUIZ,
}

# ═══════════════════════════════════════════════════════════════════════════════
# BÀI 5 — Luyện tổng hợp xen kẽ + đề mini tính giờ
# ═══════════════════════════════════════════════════════════════════════════════
L4 = {
    "title": "Luyện tổng hợp: đề mini tính giờ",
    "durationMin": 20,
    "description": "Tám câu trộn đủ ba chủ đề và ba mức độ như đề thi, làm trong 20 phút để tập phân bổ thời gian.",
    "look": {"palette": "vibrant", "font": "modern"},
    "objectives": [
        "Nhận ra đang gặp dạng bài nào khi đề trộn nhiều dạng",
        "Phân bổ được thời gian theo mức độ câu hỏi trong một đề có giới hạn giờ",
        "Tự rà bài bằng các bước thử lại đã học",
    ],
    "objectivesLead": "Học xong bài này, em có thể:",
    "body": (
        "Ba bài trước luyện từng dạng một. Đề thi thì không báo trước câu nào thuộc dạng nào, nên bài này **trộn xen kẽ** cả "
        "ba chủ đề: công thức nghiệm, hệ thức Viète và lập phương trình. Nghiên cứu về học Toán cho thấy luyện xen kẽ khó "
        "hơn lúc đầu nhưng nhớ lâu hơn luyện từng dạng liền một khối.\n\n"
        "Đề có **8 câu, 20 phút**, đã đếm giờ khi em bấm bắt đầu. Mỗi câu ghi mức độ: *Nhận biết*, *Thông hiểu*, *Vận dụng*."
    ),
    "sections": [
        {
            "layout": "cards",
            "title": "Cách phân bổ thời gian",
            "parts": [
                {"title": "Nhận biết: khoảng 1 phút", "md": "Câu đầu đề thường chắc điểm. Làm nhanh, đừng kiểm quá lâu."},
                {"title": "Thông hiểu: khoảng 2 phút", "md": "Cần một hai bước biến đổi. Viết nháp ngắn gọn từng dòng."},
                {"title": "Vận dụng: khoảng 3 phút", "md": "Có tham số hoặc đề chữ. Ghi điều kiện ngay từ đầu."},
            ],
            "outro": "> [!meo] Gặp câu chưa làm ngay được thì đánh dấu, làm câu khác trước rồi quay lại. Chừa 2 phút cuối để thử lại các câu có tham số.",
        }
    ],
    "summary": [
        "Đề trộn nhiều dạng: nhìn dấu hiệu của đề để biết dùng công thức nghiệm, Viète hay lập phương trình.",
        "Câu có tham số thì ghi điều kiện ở đầu; câu đề chữ thì đối chiếu điều kiện ở cuối.",
        "Chừa thời gian cuối để thử lại.",
    ],
    "quiz": {
        "title": "Đề mini · tổng hợp phương trình bậc hai",
        "passThresholdPct": 60,
        "requireConfidence": False,
        "timeLimitSec": 1200,
        "questions": [
            {
                "key": "5.1-nhan-biet-bac-hai", "type": "mcq", "points": 1,
                "prompt": "**[Nhận biết]** Phương trình nào dưới đây là phương trình bậc hai một ẩn?",
                "explanation": "Chỉ $x^2-4=0$ có dạng $ax^2+bx+c=0$ với $a=1\\neq0$ ($b=0$ vẫn được). $2x-3=0$ là bậc nhất, $x^3+x=0$ là bậc ba.",
                "options": [
                    {"label": "$2x-3=0$", "isCorrect": False, "misconception": "on10.quen-a-khac-0"},
                    {"label": "$x^3+x=0$", "isCorrect": False},
                    {"label": "$x^2-4=0$", "isCorrect": True},
                    {"label": "$\\dfrac1x=2$", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-nhan-biet-delta", "type": "fill_in", "points": 1,
                "prompt": "**[Nhận biết]** Tính $\\Delta$ của phương trình $x^2-6x+5=0$. Điền một số.",
                "explanation": "$\\Delta=(-6)^2-4\\cdot1\\cdot5=36-20=16$. Hai nghiệm là $\\dfrac{6\\pm4}{2}$, tức $5$ và $1$.",
                "answers": ["16"],
            },
            {
                "key": "5.3-thong-hieu-kep", "type": "mcq", "points": 2,
                "prompt": "**[Thông hiểu]** Phương trình $x^2-6x+9=0$:",
                "explanation": "$\\Delta=36-36=0$ nên có nghiệm kép $x=-\\dfrac{b}{2a}=\\dfrac{6}{2}=3$. Thử lại: $3^2-6\\cdot3+9=0$.",
                "options": [
                    {"label": "có hai nghiệm phân biệt $3$ và $-3$", "isCorrect": False, "misconception": "on10.bat-dang-thuc-delta"},
                    {"label": "vô nghiệm", "isCorrect": False},
                    {"label": "có nghiệm kép $x=-3$", "isCorrect": False, "misconception": "on10.sai-dau-b"},
                    {"label": "có nghiệm kép $x=3$", "isCorrect": True},
                ],
            },
            {
                "key": "5.4-thong-hieu-viete", "type": "fill_in", "points": 2,
                "prompt": "**[Thông hiểu]** Gọi $x_1,\\ x_2$ là hai nghiệm của $x^2-5x-14=0$. Tính $x_1^2+x_2^2$. Điền một số.",
                "explanation": "$S=5,\\ P=-14$ nên $x_1^2+x_2^2=S^2-2P=25+28=53$. Kiểm: nghiệm là $7$ và $-2$, $49+4=53$.",
                "answers": ["53"],
            },
            {
                "key": "5.5-thong-hieu-thu-tu", "type": "ordering", "points": 2,
                "prompt": "**[Thông hiểu]** Hãy sắp xếp các bước giải bài toán tìm tham số $m$ để hai nghiệm thoả một hệ thức.",
                "explanation": "Điều kiện có nghiệm trước, rồi Viète, rồi đưa hệ thức của đề về S và P, giải theo m, và cuối cùng đối chiếu điều kiện đã ghi ở đầu.",
                "sequence": [
                    "Tìm điều kiện có nghiệm (Δ ≥ 0)",
                    "Viết hệ thức Viète theo m",
                    "Biến đổi hệ thức của đề về S và P",
                    "Giải phương trình theo m",
                    "Đối chiếu điều kiện rồi kết luận",
                ],
            },
            {
                "key": "5.6-van-dung-moi-m", "type": "mcq", "points": 3,
                "prompt": "**[Vận dụng]** Tìm $m$ để $x^2-2mx+m^2-1=0$ có hai nghiệm phân biệt.",
                "explanation": "$\\Delta'=m^2-(m^2-1)=1>0$ với mọi $m$. Phương trình luôn có hai nghiệm phân biệt (thật ra $x=m\\pm1$), nên đáp án là mọi $m$.",
                "options": [
                    {"label": "$m>1$", "isCorrect": False, "misconception": "on10.bat-dang-thuc-delta"},
                    {"label": "$m<1$", "isCorrect": False, "misconception": "on10.bat-dang-thuc-delta"},
                    {"label": "Mọi giá trị của $m$", "isCorrect": True},
                    {"label": "Không có giá trị nào của $m$", "isCorrect": False},
                ],
            },
            {
                "key": "5.7-van-dung-hcn", "type": "fill_in", "points": 3,
                "prompt": "**[Vận dụng]** Hình chữ nhật có chu vi $30$ m, diện tích $56$ m², chiều dài lớn hơn chiều rộng. Tính chiều dài (m). Điền một số.",
                "explanation": "Nửa chu vi $15$: $x(15-x)=56$, tức $x^2-15x+56=0$, $\\Delta=225-224=1$, nên $x=8$ hoặc $x=7$. Chiều dài là $8$ (rộng $7$). Kiểm: $8\\cdot7=56$ ✓.",
                "answers": ["8"],
            },
            {
                "key": "5.8-van-dung-nham", "type": "mcq", "points": 3,
                "prompt": "**[Vận dụng]** Hai nghiệm của phương trình $x^2-(m+1)x+m=0$ là:",
                "explanation": "Vì $1-(m+1)+m=0$ nên $a+b+c=0$: một nghiệm là $x=1$, nghiệm kia là $\\dfrac{c}{a}=m$.",
                "options": [
                    {"label": "$x=-1$ và $x=m$", "isCorrect": False},
                    {"label": "$x=1$ và $x=-m$", "isCorrect": False},
                    {"label": "$x=m$ và $x=m+1$", "isCorrect": False},
                    {"label": "$x=1$ và $x=m$", "isCorrect": True},
                ],
            },
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════

COURSE = {
    "title": "Ôn thi vào lớp 10 — Toán (khoá mẫu)",
    "slug": "on-thi-vao-10-toan-mau",
    "description": (
        "Khoá mẫu cho nhà xuất bản xem cách một cuốn sách ôn thi Toán hiển thị trên Limio. Chương “Phương trình bậc hai” "
        "đi từ bài chẩn đoán kiến thức nền, qua công thức nghiệm, hệ thức Viète và bài toán lập phương trình, đến một đề mini "
        "tính giờ. Công thức dựng chuẩn, ví dụ mẫu hiện **từng bước** (kèm giọng giảng), có ví dụ mờ dần, bài tìm lỗi trong lời "
        "giải, và mỗi phương án sai gắn một lỗi tư duy để học viên nhận phản hồi chỉ đúng chỗ mình hiểu nhầm.\n\n"
        "**Nội dung minh hoạ do Limio soạn, không trích từ sách của nhà xuất bản nào.**"
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Ôn thi",
    "personalizationEnabled": True,
}

MANIFEST = {
    "course": COURSE,
    "misconceptions": [{"code": c, "name": n, "description": d} for c, n, d in MISC],
    "feedbackTemplates": [{"misconception": c, "body": b, "priority": p} for c, b, p in FEEDBACK],
    "modules": [
        {
            "title": "Chương 1 · Phương trình bậc hai",
            "description": "Chẩn đoán kiến thức nền, công thức nghiệm, hệ thức Viète, bài toán lập phương trình và đề mini tính giờ — chủ đề trọng tâm của đề thi vào lớp 10.",
            "lessons": [L0, LESSON1, LESSON2, LESSON3, L4],
        }
    ],
}

if __name__ == "__main__":
    OUT.write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    n = sum(len(l["quiz"]["questions"]) for m in MANIFEST["modules"] for l in m["lessons"])
    print("ghi", OUT, "—", n, "câu hỏi,", len(MISC), "lỗi tư duy")

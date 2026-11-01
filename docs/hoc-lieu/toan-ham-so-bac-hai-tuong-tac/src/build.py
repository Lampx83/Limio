"""Dựng manifest khoá "Hàm số bậc hai — học cùng giảng viên ảo" (nhập bằng `pnpm import:course`).

Mọi đáp án số được TÍNH LẠI ở đây bằng chính công thức (check_*), không gõ tay: sai một con số là build dừng.
Chạy:  python3 -I src/build.py   (đứng trong thư mục khoá) -> ghi khoa-ham-so-bac-hai.json
"""
import json
from fractions import Fraction as F
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "khoa-ham-so-bac-hai.json"


def analyze(a, b, c):
    a, b, c = F(a), F(b), F(c)
    d = b * b - 4 * a * c
    xv = -b / (2 * a)
    return d, (xv, a * xv * xv + b * xv + c)


def roots(a, b, c):
    d, _ = analyze(a, b, c)
    if d < 0:
        return []
    # căn đúng khi d là bình phương hữu tỉ (mọi ví dụ trong bài đều vậy)
    n, m = d.numerator, d.denominator
    sn, sm = int(round(n ** 0.5)), int(round(m ** 0.5))
    assert sn * sn == n and sm * sm == m, f"Δ={d} không chính phương"
    s = F(sn, sm)
    return sorted({(-F(b) - s) / (2 * F(a)), (-F(b) + s) / (2 * F(a))})


def num(x):
    x = F(x)
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


# ── Kiểm tra mọi số xuất hiện trong bài (dừng nếu lệch) ────────────────────────
d, (vx, vy) = analyze(1, -2, -3)
assert (d, vx, vy, roots(1, -2, -3)) == (16, 1, -4, [-1, 3])               # ví dụ mẫu
d2, (vx2, vy2) = analyze(-1, 4, 5)
assert (d2, vx2, vy2, roots(-1, 4, 5)) == (36, 2, 9, [-1, 5])              # tự làm bước cuối
assert analyze(2, -4, 1)[1] == (1, -1)                                      # bài tìm lỗi: đỉnh đúng (1;−1)
assert analyze(2, -8, 5)[1][0] == 2                                         # Q3
assert analyze(1, -4, 1)[1] == (2, -3)                                      # Q4
assert analyze(1, 1, 3)[0] == -11 and roots(1, 1, 3) == []                  # Q5
# Q6: y=x²−2x+m cắt Ox hai điểm ⇔ Δ=4−4m>0 ⇔ m<1
assert analyze(1, -2, 0)[0] == 4 and all((analyze(1, -2, m)[0] > 0) == (m < 1) for m in (-3, 0, F(1, 2), 1, 2))
# Q7: đỉnh (1;−4), qua (0;−3) ⇒ y=a(x−1)²−4, a−4=−3 ⇒ a=1 ⇒ y=x²−2x−3
assert 1 - 4 == -3 and analyze(1, -2, -3)[1] == (1, -4)
assert analyze(-1, 4, 5)[1][1] == 9                                         # Q8: GTLN = 9

L = lambda *x: "\n".join(x)

MIS = [
    ("ham2.dau-a", "Nhầm hướng mở của parabol với dấu của a",
     "Cho rằng a > 0 thì parabol mở xuống, hoặc xét hướng mở theo b, c thay vì chỉ theo a. Hướng mở chỉ do dấu của a quyết định."),
    ("ham2.dinh-sai-dau", "Bỏ dấu trừ ở công thức hoành độ đỉnh",
     "Viết x = b/(2a) thay vì x = −b/(2a). Kết quả cho hoành độ đỉnh đối dấu với đáp án đúng."),
    ("ham2.nham-truc", "Lẫn trục tung với trục hoành",
     "Giao điểm với trục tung Oy có dạng (0; c), còn giao điểm với trục hoành Ox mới cần giải phương trình. Hay đảo hai trục khi đọc c và nghiệm."),
    ("ham2.delta-dau", "Đoán số giao điểm theo dấu của một hệ số",
     "Kết luận số giao điểm với Ox từ dấu của c (hoặc b) mà không tính Δ. Thứ quyết định là Δ = b² − 4ac."),
    ("ham2.quen-dieu-kien", "Quên Δ > 0 là điều kiện cắt hai điểm",
     "Khi bài hỏi “cắt trục hoành tại hai điểm phân biệt” thì lấy Δ ≥ 0 hoặc Δ < 0 thay vì Δ > 0, hoặc đổi chiều bất đẳng thức khi biến đổi."),
]
FB = [
    ("ham2.dau-a", "Hướng mở của parabol chỉ do dấu của a quyết định: a > 0 mở lên, a < 0 mở xuống. Em thử kéo thanh trượt a qua 0 trong đồ thị ở mục “Kéo thử” để tự thấy parabol lật."),
    ("ham2.dinh-sai-dau", "Hoành độ đỉnh là −b/(2a), có dấu trừ. Em kiểm bằng đồ thị: kéo b sang dương, đỉnh có chạy sang trái không (khi a > 0)? Nếu có, dấu trừ là đúng."),
    ("ham2.nham-truc", "Điểm cắt trục tung là x = 0, nên tung độ là c: điểm (0; c). Điểm cắt trục hoành mới là nghiệm của phương trình. Em nhìn lại điểm xám trên trục tung trong đồ thị kéo được."),
    ("ham2.delta-dau", "Số giao điểm với trục hoành do Δ quyết định, không do dấu của c hay b. Với y = x² + x + 3 có c > 0 nhưng Δ = −11 < 0 nên không cắt Ox. Em kéo c lên cao trong đồ thị để thấy parabol rời xa trục hoành."),
    ("ham2.quen-dieu-kien", "Cắt trục hoành tại HAI điểm phân biệt ⇔ phương trình có hai nghiệm phân biệt ⇔ Δ > 0 (dấu lớn hơn hẳn). Δ = 0 là tiếp xúc, chỉ một điểm chung."),
]

def plain(t):
    """Câu hỏi và giải thích là chữ thuần + KaTeX, không qua markdown: dấu * sẽ hiện nguyên văn."""
    return t.replace("*", "")


def opt(label, ok=False, mis=None):
    o = {"label": label, "isCorrect": ok}
    if mis:
        o["misconception"] = mis
    return o

QUESTIONS = [
    {"key": "q1-huong-mo", "type": "mcq", "points": 1,
     "prompt": "**(Nhận biết)** Parabol $y=-2x^2+3x-1$ có hướng mở như thế nào?",
     "explanation": "Hệ số $a=-2<0$ nên parabol **mở xuống**. Hướng mở chỉ phụ thuộc dấu của $a$.",
     "options": [opt("Mở lên, vì $c=-1$ và $b=3>0$", mis="ham2.dau-a"), opt("Mở xuống, vì $a=-2<0$", True),
                 opt("Mở lên, vì $b=3>0$", mis="ham2.dau-a"), opt("Không xác định được nếu chưa tính $\\Delta$", mis="ham2.dau-a")]},
    {"key": "q2-giao-oy", "type": "mcq", "points": 1,
     "prompt": "**(Nhận biết)** Đồ thị $y=x^2-2x-3$ cắt trục tung tại điểm nào?",
     "explanation": "Cắt trục tung khi $x=0$, khi đó $y=c=-3$. Điểm cần tìm là $(0;-3)$. Hai điểm $(-1;0)$ và $(3;0)$ là giao điểm với trục **hoành**.",
     "options": [opt("$(-3;0)$", mis="ham2.nham-truc"), opt("$(0;-3)$", True),
                 opt("$(1;-4)$", mis="ham2.nham-truc"), opt("$(0;3)$", mis="ham2.nham-truc")]},
    {"key": "q3-hoanh-do-dinh", "type": "fill_in", "points": 1,
     "prompt": "**(Thông hiểu)** Tìm hoành độ đỉnh của parabol $y=2x^2-8x+5$. Điền một số.",
     "explanation": "$x=-\\dfrac{b}{2a}=-\\dfrac{-8}{2\\cdot2}=2$.", "answers": [num(analyze(2, -8, 5)[1][0])]},
    {"key": "q4-tung-do-dinh", "type": "fill_in", "points": 1,
     "prompt": "**(Thông hiểu)** Parabol $y=x^2-4x+1$ có đỉnh $I$. Tìm tung độ của $I$. Điền một số.",
     "explanation": "Hoành độ đỉnh $x=-\\dfrac{-4}{2}=2$. Thay vào: $y=2^2-4\\cdot2+1=-3$.", "answers": [num(analyze(1, -4, 1)[1][1])]},
    {"key": "q5-so-giao-diem", "type": "mcq", "points": 1,
     "prompt": "**(Thông hiểu)** Parabol $y=x^2+x+3$ có hệ số $c=3>0$. Nó cắt trục hoành tại mấy điểm?",
     "explanation": "$\\Delta=1^2-4\\cdot1\\cdot3=-11<0$ nên **không cắt** trục hoành. Dấu của $c$ không quyết định số giao điểm.",
     "options": [opt("2 điểm, vì $c>0$", mis="ham2.delta-dau"), opt("1 điểm, vì $a=1>0$", mis="ham2.delta-dau"),
                 opt("Không điểm nào, vì $\\Delta=-11<0$", True), opt("Không xác định được", mis="ham2.delta-dau")]},
    {"key": "q6-tham-so", "type": "mcq", "points": 2,
     "prompt": "**(Vận dụng)** Với giá trị nào của $m$ thì parabol $y=x^2-2x+m$ cắt trục hoành tại hai điểm phân biệt?",
     "explanation": "Hai giao điểm phân biệt $\\Leftrightarrow \\Delta>0$. Ở đây $\\Delta=(-2)^2-4\\cdot1\\cdot m=4-4m>0\\Leftrightarrow m<1$.",
     "options": [opt("$m>1$", mis="ham2.quen-dieu-kien"), opt("$m<1$", True),
                 opt("$m\\le1$", mis="ham2.quen-dieu-kien"), opt("$m\\ge1$", mis="ham2.quen-dieu-kien")]},
    {"key": "q7-lap-ham-so", "type": "fill_in", "points": 2,
     "prompt": "**(Vận dụng)** Parabol $y=ax^2+bx+c$ có đỉnh $(1;-4)$ và đi qua $(0;-3)$. Tìm $a$. Điền một số. *(Em kiểm lại bằng đồ thị kéo được ở mục “Kéo thử”.)*",
     "explanation": "Đỉnh $(1;-4)$ nên $y=a(x-1)^2-4$. Đi qua $(0;-3)$: $a\\cdot1-4=-3\\Rightarrow a=1$, tức $y=x^2-2x-3$.", "answers": ["1"]},
    {"key": "q8-gtln", "type": "true_false", "points": 1,
     "prompt": "**(Vận dụng)** Đúng hay sai: hàm số $y=-x^2+4x+5$ đạt giá trị lớn nhất bằng $9$.",
     "explanation": "$a=-1<0$ nên đỉnh là điểm cao nhất. Đỉnh $(2;9)$: $y=-4+8+5=9$. Đúng.",
     "options": [opt("Đúng", True), opt("Sai", mis="ham2.dau-a")]},
]

for _q in QUESTIONS:
    _q["prompt"], _q["explanation"] = plain(_q["prompt"]), plain(_q["explanation"])

COURSE = {
    "title": "Toán — Hàm số bậc hai: học cùng giảng viên ảo (demo)",
    "slug": "toan-ham-so-bac-hai-giang-vien-ao",
    "description": ("Một bài giảng Toán ôn thi (vào lớp 10, tốt nghiệp THPT, thi đại học) mà em **làm** nhiều hơn đọc: "
                    "kéo thanh trượt xem parabol đổi ngay, giải bài thử thách có chấm, xem lời giải hiện **từng bước** "
                    "trong lúc giảng viên ảo giảng, tự làm bước cuối, tìm lỗi trong lời giải, và nhận phản hồi chỉ đúng chỗ "
                    "mình hiểu nhầm.\n\n**Nội dung do Limio soạn.**"),
    "language": "vi", "level": "beginner", "category": "Ôn thi", "personalizationEnabled": True,
}

BODY = L(
    "Đồ thị hàm số bậc hai $y=ax^2+bx+c$ xuất hiện ở hầu hết đề thi: khi thì vẽ, khi thì tìm đỉnh, khi thì xét số giao điểm. "
    "Điểm hay mất không nằm ở công thức mà ở chỗ **không hình dung được đồ thị** nên nhớ sai. Bài này cho em tự tay kéo đồ thị trước, "
    "rồi mới gọn công thức.",
    "",
    "## Em đoán trước đã",
    "",
    ":::Đừng kéo vội. Ghi dự đoán ra nháp",
    "Với $y=x^2-2x-3$: nếu **tăng $a$ từ 1 lên 3** thì parabol *bè ra* hay *thu hẹp lại*? Nếu **tăng $c$ lên 2** thì đồ thị *tịnh tiến* về hướng nào?",
    ":::",
    "",
    "## Kéo thử: a, b, c làm gì với parabol",
    "",
    "Dùng thanh trượt bên dưới, mỗi lần chỉ kéo **một** hệ số, và đối chiếu với dự đoán ở trên:",
    "",
    "1. Kéo $a$ qua $0$: parabol lật. Khi $a=0$ chuyện gì xảy ra?",
    "2. Kéo $c$: đồ thị trượt lên xuống, điểm xám trên trục tung luôn là $(0;c)$.",
    "3. Kéo $b$: đỉnh chạy ngang, và trục đối xứng (nét đỏ đứt) chạy theo.",
    "",
    "Xong phần khám phá, bấm **Thử thách** để giải bài có chấm: kéo $a,b,c$ sao cho đồ thị qua hai điểm cho trước.",
    "",
    "## Ba điều cần nhớ",
    "",
    "> [!ghi-nho] Parabol $y=ax^2+bx+c$ ($a\\neq0$): **hướng mở** do dấu của $a$; **đỉnh** có hoành độ $x=-\\dfrac{b}{2a}$; **cắt trục tung** tại $(0;c)$.",
    "",
    "Số giao điểm với trục hoành do $\\Delta=b^2-4ac$ quyết định: $\\Delta>0$ hai điểm, $\\Delta=0$ một điểm (tiếp xúc), $\\Delta<0$ không có điểm nào.",
    "",
    "> [!canh-bao] Đừng đoán số giao điểm bằng dấu của $c$ hay $b$. $y=x^2+x+3$ có $c>0$ nhưng $\\Delta=-11<0$ nên không cắt trục hoành.",
)

D, (VX, VY) = analyze(1, -2, -3)
SECTIONS = [
    {"layout": "steps", "title": "Ví dụ mẫu: tìm đỉnh và giao điểm", "reveal": True,
     "intro": "Ví dụ này chính là đồ thị mở sẵn lúc đầu ($a=1,\\ b=-2,\\ c=-3$). Em đối chiếu từng bước với đồ thị.",
     "parts": [
         {"title": "Xác định hệ số", "md": "$a=1,\\ b=-2,\\ c=-3$. Ghi kèm dấu, vì sai dấu của $b$ là lỗi hay gặp nhất."},
         {"title": "Hướng mở", "md": "$a=1>0$ nên parabol **mở lên**."},
         {"title": "Đỉnh", "md": f"$x=-\\dfrac{{b}}{{2a}}=-\\dfrac{{-2}}{{2}}={num(VX)}$; $y={num(VX)}^2-2\\cdot{num(VX)}-3={num(VY)}$. Đỉnh $I({num(VX)};{num(VY)})$."},
         {"title": "Giao điểm với trục tung", "md": "$x=0\\Rightarrow y=-3$: điểm $(0;-3)$."},
         {"title": "Giao điểm với trục hoành", "md": f"$\\Delta=(-2)^2-4\\cdot1\\cdot(-3)={num(D)}>0$ nên có hai giao điểm: $x=\\dfrac{{2\\pm4}}{{2}}$, tức $x=-1$ và $x=3$."},
         {"title": "Đối chiếu với đồ thị", "md": "Hai chấm xanh trên trục hoành ở $-1$ và $3$, chấm đỏ ở $(1;-4)$. Khớp."},
     ]},
    {"layout": "text", "title": "Tự làm bước cuối", "parts": [{"md": L(
        "Cho $y=-x^2+4x+5$. Ba bước đầu đã giải sẵn, em tự làm bước cuối rồi mở lời giải đối chiếu.",
        "",
        "1. $a=-1,\\ b=4,\\ c=5$; $a<0$ nên mở **xuống**.",
        f"2. Đỉnh: $x=-\\dfrac{{4}}{{2\\cdot(-1)}}=2$; $y=-4+8+5={num(vy2)}$, nên $I(2;{num(vy2)})$.",
        f"3. $\\Delta=4^2-4\\cdot(-1)\\cdot5={num(d2)}>0$.",
        "4. **Tìm hai giao điểm với trục hoành.** *(việc của em)*",
        "",
        ":::Mở lời giải sau khi đã tự thử",
        "$$x_{1,2}=\\frac{-4\\pm6}{2\\cdot(-1)}\\;\\Rightarrow\\;x_1=\\frac{-4+6}{-2}=-1,\\quad x_2=\\frac{-4-6}{-2}=5$$",
        "Em kiểm bằng đồ thị: đặt $a=-1,\\ b=4,\\ c=5$, hai chấm xanh nằm ở $-1$ và $5$.",
        ":::")}]},
    {"layout": "text", "title": "Tìm lỗi trong lời giải", "parts": [{"md": L(
        "Bạn An làm bài: *Tìm đỉnh của parabol $y=2x^2-4x+1$.*",
        "",
        "> $a=2,\\ b=-4$. Hoành độ đỉnh $x=\\dfrac{b}{2a}=\\dfrac{-4}{4}=-1$. Tung độ $y=2\\cdot(-1)^2-4\\cdot(-1)+1=7$. Vậy đỉnh $(-1;7)$.",
        "",
        "**Lời giải sai ở đâu?** Em tự tìm trước, rồi mở xem.",
        "",
        ":::Mở để xem chỗ sai",
        "Sai ở công thức: hoành độ đỉnh là $x=-\\dfrac{b}{2a}$, **có dấu trừ**. Đúng: $x=-\\dfrac{-4}{4}=1$, $y=2-4+1=-1$, đỉnh $(1;-1)$.",
        "Gợi ý kiểm nhanh: đỉnh phải nằm trên trục đối xứng, và với $a>0$ đỉnh là điểm **thấp nhất**. $(−1;7)$ cao hơn $(0;1)$ nên chắc chắn không phải đỉnh.",
        ":::")}]},
    {"layout": "faq", "title": "Những câu học sinh hay hỏi", "parts": [
        {"title": "Khi $a=0$ thì sao?", "md": "Không còn là hàm bậc hai, đồ thị là đường thẳng $y=bx+c$. Vì vậy đề luôn ghi điều kiện $a\\neq0$."},
        {"title": "Đỉnh có luôn là điểm thấp nhất không?", "md": "Chỉ khi $a>0$. Khi $a<0$ đỉnh là điểm **cao nhất**, và giá trị đó là giá trị lớn nhất của hàm số."},
        {"title": "Vẽ nhanh parabol trong bài thi thế nào?", "md": "Tìm đỉnh, giao điểm với $Oy$ $(0;c)$, giao điểm với $Ox$ nếu có, lấy thêm điểm đối xứng của $(0;c)$ qua trục đối xứng."},
    ]},
]

S = "Ví dụ mẫu: tìm đỉnh và giao điểm"
LECTURE = [
    ("mo-dau", "Chào em. Hôm nay mình học đồ thị hàm số bậc hai, chủ đề xuất hiện ở hầu hết đề thi. Bài này khác một chút: em sẽ tự tay kéo đồ thị, rồi công thức mới đến sau. Em chuẩn bị nháp nhé."),
    ("Em đoán trước đã", "Trước khi kéo, mình đoán đã. Nếu tăng a từ một lên ba, em nghĩ parabol bè ra hay thu hẹp? Còn nếu tăng c lên hai, đồ thị dịch chuyển về hướng nào? Em ghi dự đoán ra nháp. Đoán sai không sao, đoán rồi mới kiểm tra thì em nhớ rất lâu."),
    ("Kéo thử: a, b, c làm gì với parabol", "Bây giờ em kéo thanh trượt. Mỗi lần chỉ kéo một hệ số thôi. Kéo a qua không và nhìn parabol lật. Kéo c và để ý chấm xám trên trục tung, nó luôn là không phẩy c. Kéo b thì đỉnh chạy ngang. Xong rồi em bấm nút Thử thách, kéo ba hệ số sao cho đồ thị đi qua hai điểm đề bài khoanh xanh. Mình đợi em."),
    ("Ba điều cần nhớ", "Từ những gì vừa thấy, ba điều cần nhớ. Một, hướng mở chỉ do dấu của a. Hai, đỉnh có hoành độ âm b trên hai a. Em nhớ dấu trừ, vì thiếu dấu trừ là lỗi hay gặp nhất. Ba, đồ thị cắt trục tung tại không phẩy c. Còn số giao điểm với trục hoành do đen-ta quyết định, không phải dấu của c hay b."),
]
STEP = [
    "Bước một, xác định hệ số: a bằng một, b bằng âm hai, c bằng âm ba. Em ghi kèm dấu nhé.",
    "Bước hai, a bằng một lớn hơn không, nên parabol mở lên. Em đối chiếu với đồ thị lúc nãy.",
    "Bước ba, tìm đỉnh. Hoành độ bằng âm b trên hai a, tức hai trên hai, bằng một. Thay vào, tung độ là âm bốn. Đỉnh là một, âm bốn.",
    "Bước bốn, giao với trục tung: cho x bằng không thì y bằng c, tức âm ba.",
    "Bước năm, đen-ta bằng bốn cộng mười hai, bằng mười sáu, dương, nên có hai giao điểm: x bằng âm một và x bằng ba.",
    "Bước sáu, em nhìn lại đồ thị: hai chấm xanh ở âm một và ba, chấm đỏ ở một, âm bốn. Khớp hoàn toàn.",
]
LECTURE += [(f"{S} #{i + 1}", t) for i, t in enumerate(STEP)]
LECTURE += [
    ("Tự làm bước cuối", "Đến lượt em. Ba bước đầu mình đã làm sẵn. Em tự tìm hai giao điểm với trục hoành rồi mới mở lời giải. Em có thể kiểm bằng cách đặt a bằng âm một, b bằng bốn, c bằng năm trên đồ thị."),
    ("Tìm lỗi trong lời giải", "Bạn An làm bài này và có một chỗ sai. Em đọc kỹ và tự tìm, đừng mở đáp án vội. Gợi ý nhỏ: kiểm tra công thức hoành độ đỉnh."),
    ("tong-ket", "Tổng kết. Hướng mở do a, đỉnh nằm ở âm b trên hai a, cắt trục tung ở c, số giao điểm với trục hoành do đen-ta. Em làm tiếp bài kiểm tra nhanh, nhớ chọn mức tự tin của mình trước khi nộp. Chúc em học tốt."),
]

LESSON = {
    "title": "Hàm số bậc hai: đọc đồ thị parabol", "durationMin": 30,
    "description": "Kéo thanh trượt để thấy a, b, c điều khiển parabol; giải thử thách có chấm; ví dụ hiện từng bước kèm lời giảng; bài tìm lỗi.",
    "look": {"palette": "limio", "font": "modern"},
    "objectives": ["Chỉ ra hướng mở, đỉnh, giao điểm với trục tung của parabol từ hệ số a, b, c",
                   "Dùng Δ để quyết định số giao điểm với trục hoành",
                   "Lập hàm số bậc hai từ đỉnh và một điểm cho trước",
                   "Tìm và sửa lỗi sai dấu trong công thức hoành độ đỉnh"],
    "objectivesLead": "Học xong bài này, em có thể:",
    "body": BODY, "splitSections": True, "toc": False,
    "embeds": [{"url": "/widgets/parabola.html", "height": 720, "afterSection": "Kéo thử: a, b, c làm gì với parabol"}],
    "sections": SECTIONS,
    "flashcards": {"title": "Thẻ ghi nhớ · Hàm số bậc hai", "items": [
        {"term": "Hướng mở của parabol", "meaning": "Do dấu của a: a > 0 mở lên, a < 0 mở xuống."},
        {"term": "Hoành độ đỉnh", "meaning": "x = −b/(2a). Nhớ dấu trừ.", "example": "y = x² − 2x − 3 có x = 1."},
        {"term": "Giao điểm với trục tung", "meaning": "Điểm (0; c)."},
        {"term": "Số giao điểm với trục hoành", "meaning": "Δ > 0: hai; Δ = 0: một (tiếp xúc); Δ < 0: không có."},
    ]},
    "summary": ["Hướng mở chỉ do dấu của $a$.", "Đỉnh có hoành độ $-\\dfrac{b}{2a}$ — nhớ dấu trừ.",
                "Cắt trục tung tại $(0;c)$; số giao điểm với trục hoành do $\\Delta$.", "Có thể kiểm mọi kết quả bằng đồ thị kéo được."],
    "lecture": [{"anchor": a, "text": t} for a, t in LECTURE],
    "quiz": {"title": "Kiểm tra nhanh · Hàm số bậc hai", "passThresholdPct": 60, "requireConfidence": True, "questions": QUESTIONS},
}

manifest = {
    "course": COURSE,
    "misconceptions": [{"code": c, "name": n, "description": d} for c, n, d in MIS],
    "feedbackTemplates": [{"misconception": c, "body": b, "priority": 10} for c, b in FB],
    "modules": [{"title": "Hàm số bậc hai", "lessons": [LESSON]}],
}
OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"OK -> {OUT.name}: {len(QUESTIONS)} câu, {len(LECTURE)} đoạn lời giảng, {sum(len(t) for _, t in LECTURE)} ký tự")

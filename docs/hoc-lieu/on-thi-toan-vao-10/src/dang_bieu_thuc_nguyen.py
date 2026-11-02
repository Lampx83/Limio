"""Bài dạng "Tìm x để biểu thức nguyên" (ý cuối câu II), là khuôn cho các bài dạng khác.

Một bài dạng gồm khung slide cùng giảng viên ảo và một quiz 10 câu, 12 điểm: 3 Nhận biết, 5 Thông hiểu, 2 Vận dụng. Mức của từng câu
ghi ở `muc` để kiểm cơ cấu đề, không hiện cho học sinh. Số liệu của quiz không trùng với slide. Mọi đáp số, ở cả slide lẫn quiz, được tính lại trong `kiem_so()`.
"""
from fractions import Fraction as Fr

from deck_chung import BoSlide, khung_deck, lc, loi_sai

ID = "dang-bieu-thuc-nguyen"
TIEU_DE = "Câu II: Tìm x để biểu thức nguyên"

BO = BoSlide("dbtn")
slide = BO.slide


def truc_so():
    """Trục số của ví dụ mẫu: P chạy trong nửa khoảng từ −3 đến 1, các số nguyên trong đó được tô."""
    x = lambda v: 60 + (v + 4) * 90
    o = ['<svg viewBox="0 0 660 96" width="660" height="96" data-chi="truc-so">',
         f'<line x1="20" y1="44" x2="640" y2="44" stroke="currentColor" stroke-width="3"></line>',
         f'<line x1="{x(-3)}" y1="44" x2="{x(1)}" y2="44" stroke="#e8590c" stroke-width="9"></line>']
    for v in range(-4, 3):
        o.append(f'<line x1="{x(v)}" y1="36" x2="{x(v)}" y2="52" stroke="currentColor" stroke-width="3"></line>')
        o.append(f'<text x="{x(v)}" y="84" font-size="26" text-anchor="middle" fill="currentColor">{str(v).replace("-", "−")}</text>')
    for v in (-3, -2, -1, 0):
        o.append(f'<circle cx="{x(v)}" cy="44" r="10" fill="#e8590c"></circle>')
    o.append(f'<circle cx="{x(1)}" cy="44" r="10" fill="#ffffff" stroke="#e8590c" stroke-width="5"></circle>')
    o.append("</svg>")
    return "".join(o)


slide("01", r"""<section class="bia"><h1>Tìm \(x\) để biểu thức nguyên</h1><p class="phu-de">Dạng thường gặp ở ý cuối của câu II, và là chỗ rất dễ mất điểm</p></section>""",
      ["Chào em! {{Tx}} là {{gv}}. Hôm nay mình học một dạng thường nằm ở ý cuối của câu hai: tìm x để một biểu thức chứa căn nhận giá trị nguyên. Dạng này dễ mất điểm vì có một cách làm rất quen tay nhưng lại sai. Học xong bài này, em sẽ biết khi nào được dùng ước số, và khi nào phải chặn biểu thức giữa hai số."])

slide("02", r"""<section class="hai-cot"><h2>Đọc đề trước: \(x\) có phải số nguyên không?</h2><div class="cot"><div class="dinh-nghia" data-chi="khong-nguyen"><b>Đề không nói \(x\) nguyên.</b> Mẫu số có thể là phân số, nên không dùng ước số được. Ta chặn biểu thức giữa hai số, rồi thử từng số nguyên.</div></div><div class="cot"><div class="dinh-nghia hien" data-chi="nguyen"><b>Đề cho \(x\) nguyên.</b> Khi đó \(\sqrt{x}\) phải là số nguyên thì biểu thức mới nguyên, và ta được dùng ước số.</div></div></section>""",
      ["Việc đầu tiên không phải là tính toán, mà là đọc đề. [chỉ: khong-nguyen] Nếu đề không nói x là số nguyên, thì mẫu số có thể là một phân số, nên không dùng ước số được. Lúc này cách đúng là chặn biểu thức giữa hai số.",
       "[chỉ: nguyen] Còn nếu đề cho x là số nguyên, căn x cũng phải nguyên thì biểu thức mới nguyên. Chỉ khi đó ta mới được dùng ước số. Đề thi vào lớp mười của Hà Nội năm hai nghìn không trăm hai mươi sáu thuộc kiểu thứ nhất."])

slide("03", r"""<section class="noi-dung"><h2>Bước 1: tách phần nguyên</h2><p class="phu-de">Viết tử số thành một bội của mẫu số, cộng hoặc trừ một số. Em hãy ghép mỗi biểu thức với dạng đã tách của nó.</p><div class="ghep-doi" data-chi="ghep"><div class="cap"><span class="a">\(\dfrac{\sqrt{x}-1}{\sqrt{x}+2}\)</span><span class="b">\(1-\dfrac{3}{\sqrt{x}+2}\)</span></div><div class="cap"><span class="a">\(\dfrac{2\sqrt{x}+1}{\sqrt{x}+1}\)</span><span class="b">\(2-\dfrac{1}{\sqrt{x}+1}\)</span></div><div class="cap"><span class="a">\(\dfrac{\sqrt{x}+5}{\sqrt{x}+1}\)</span><span class="b">\(1+\dfrac{4}{\sqrt{x}+1}\)</span></div></div></section>""",
      ["Dù đề thuộc kiểu nào, bước đầu tiên vẫn là tách phần nguyên. Ta viết tử số thành một bội của mẫu số, cộng hoặc trừ một số. Nhờ vậy, x chỉ còn xuất hiện ở một chỗ. [chỉ: ghep] Em ghép mỗi biểu thức với dạng đã tách của nó, rồi bấm Tiếp tục nhé."],
      cho=True)

slide("04", r"""<section class="noi-dung"><h2>Ví dụ: \(P=\dfrac{\sqrt{x}-3}{\sqrt{x}+1}\) với \(x\geq 0\)</h2><ul class="hien-dan"><li>Tách phần nguyên: \(P=1-\dfrac{4}{\sqrt{x}+1}\).</li><li>Chặn: \(\sqrt{x}+1\geq 1\) nên \(0\lt\dfrac{4}{\sqrt{x}+1}\leq 4\), do đó \(-3\leq P\lt 1\).<br>"""
      + truc_so()
      + r"""</li><li>\(P\) nguyên nên \(P\in\{-3;-2;-1;0\}\).</li><li>Giải từng trường hợp: \(\sqrt{x}+1=1;\ \dfrac{4}{3};\ 2;\ 4\), nên \(x\in\left\{0;\dfrac{1}{9};1;9\right\}\).</li></ul></section>""",
      ["Mình cùng làm một ví dụ, với P bằng căn x trừ ba, chia cho căn x cộng một, và x không âm. Đề không nói x là số nguyên, nên ta đi theo cách chặn.",
       "Tách phần nguyên: P bằng một, trừ bốn phần căn x cộng một.",
       "[chỉ: truc-so] Bây giờ chặn. Căn x cộng một lớn hơn hoặc bằng một, nên phân số nằm từ trên không đến tối đa là bốn. Vậy P đi từ âm ba đến dưới một. Trên trục số là đoạn màu cam: có lấy âm ba, nhưng không lấy một.",
       "Trong đoạn đó có bốn số nguyên: âm ba, âm hai, âm một và không.",
       "Mỗi giá trị của P cho một phương trình ẩn căn x. Giải ra, x bằng không, một phần chín, một, và chín. Giá trị một phần chín ứng với mẫu số bằng bốn phần ba, không phải số nguyên, nhưng P vẫn bằng âm hai."])

slide("05", r"""<section class="noi-dung"><h2>Lời giải này sai ở đâu?</h2><p class="phu-de">Tìm \(x\) để \(P=\dfrac{\sqrt{x}-4}{\sqrt{x}+1}\) nguyên, với \(x\geq 0\). Một bạn giải như sau, em hãy bấm vào dòng sai.</p><div class="tim-loi" data-chi="tim-loi"><div class="dong" data-gt="dong-1">\(P=1-\dfrac{5}{\sqrt{x}+1}\).</div><div class="dong" data-gt="dong-2" data-sai="Đề không cho x nguyên nên √x + 1 có thể là phân số. Lập luận theo ước số chỉ đúng khi √x + 1 là số nguyên.">\(P\) nguyên nên \(\sqrt{x}+1\) là ước của \(5\).</div><div class="dong" data-gt="dong-3">Vì \(\sqrt{x}+1\geq 1\) nên \(\sqrt{x}+1\in\{1;5\}\).</div><div class="dong" data-gt="dong-4">Vậy \(x\in\{0;16\}\).</div></div></section>""",
      ["Đây là lỗi hay gặp nhất của dạng này. [chỉ: tim-loi] Một bạn đã giải bài toán tương tự như trên màn hình. Em đọc kỹ đề và từng dòng, bấm vào dòng sai, rồi bấm Tiếp tục nhé."],
      cho=True)

slide("06", r"""<section class="noi-dung"><h2>Lời giải đúng có năm giá trị, không phải hai</h2><p>Dòng sai là dòng thứ hai. Vì \(\sqrt{x}+1\geq 1\) nên \(-4\leq P\lt 1\), do đó \(P\) nhận năm giá trị nguyên.</p><table class="hien" data-chi="bang"><tbody><tr><th>\(P\)</th><td>\(-4\)</td><td>\(-3\)</td><td>\(-2\)</td><td>\(-1\)</td><td>\(0\)</td></tr><tr><th>\(\sqrt{x}+1\)</th><td>\(1\)</td><td>\(\dfrac{5}{4}\)</td><td>\(\dfrac{5}{3}\)</td><td>\(\dfrac{5}{2}\)</td><td>\(5\)</td></tr><tr><th>\(x\)</th><td>\(0\)</td><td>\(\dfrac{1}{16}\)</td><td>\(\dfrac{4}{9}\)</td><td>\(\dfrac{9}{4}\)</td><td>\(16\)</td></tr></tbody></table></section>""",
      ["Dòng sai là dòng thứ hai. Đề không nói x nguyên, nên căn x cộng một có thể là phân số. Ta chặn lại: P đi từ âm bốn đến dưới một, tức là có năm số nguyên.",
       "[chỉ: bang] Giải từng trường hợp, ta được năm giá trị của x. Cách dùng ước số chỉ tìm được hai giá trị đầu và cuối, nên đã đánh mất ba nghiệm còn lại."])

slide("07", r"""<section class="hai-cot"><h2>Em tự làm</h2><div class="cot"><div class="dinh-nghia" data-chi="de">Với \(x\geq 0\), tìm tất cả giá trị của \(x\) để \[P=\frac{\sqrt{x}-5}{\sqrt{x}+2}\] là số nguyên.</div></div><div class="cot"><div class="nhap-dap-an" data-loai="tap-hop" data-dap-an="{1/9; 9/4; 25}" data-chi="nhap"><p class="cau">Tập các giá trị của \(x\) là</p><div class="go-y">Tách: \(P=1-\dfrac{7}{\sqrt{x}+2}\).</div><div class="go-y">\(\sqrt{x}+2\geq 2\) nên \(-\dfrac{5}{2}\leq P\lt 1\), tức là \(P\in\{-2;-1;0\}\).</div>"""
      + loi_sai("{25}", r"Em đã xét ước của \(7\), nên chỉ còn \(\sqrt{x}+2=7\). Đề không cho \(x\) nguyên, em hãy chặn \(P\) rồi thử từng số nguyên.")
      + r"""<div class="giai-thich">\(P=-2,\ -1,\ 0\) lần lượt cho \(\sqrt{x}+2=\dfrac{7}{3},\ \dfrac{7}{2},\ 7\), nên \(x\in\left\{\dfrac{1}{9};\dfrac{9}{4};25\right\}\).</div></div></div></section>""",
      ["Đến lượt em. [chỉ: de] Em làm đủ các bước vừa học ra giấy: tách phần nguyên, chặn, rồi thử từng số nguyên. [chỉ: nhap] Cần thì bấm gợi ý. Có đáp số rồi, em nhập vào ô bên phải và bấm Tiếp tục nhé."],
      cho=True)

slide("08", r"""<section class="hai-cot"><h2>Đừng quên đối chiếu điều kiện</h2><div class="cot"><p>Quay lại biểu thức ở ví dụ: \(P=\dfrac{\sqrt{x}-3}{\sqrt{x}+1}\).</p><div class="dinh-nghia" data-chi="de">Lần này điều kiện là \(x\gt 0,\ x\neq 9\).</div></div><div class="cot"><div class="trac-nghiem" data-chi="cau"><p class="cau">Các giá trị của \(x\) để \(P\) nguyên là</p>"""
      + lc(r"\(x\in\left\{0;\dfrac{1}{9};1;9\right\}\)", phan_hoi="Đây là đáp số của điều kiện x ≥ 0. Với điều kiện mới, x = 0 và x = 9 đều bị loại.")
      + lc(r"\(x\in\left\{\dfrac{1}{9};1;9\right\}\)", phan_hoi="Đề có điều kiện x khác 9, nên x = 9 bị loại.")
      + lc(r"\(x\in\left\{0;\dfrac{1}{9};1\right\}\)", phan_hoi="Đề yêu cầu x > 0, nên x = 0 bị loại.")
      + lc(r"\(x\in\left\{\dfrac{1}{9};1\right\}\)", dung=True)
      + r"""<div class="giai-thich">Trong bốn giá trị đã tìm, \(x=0\) không thoả \(x\gt 0\) và \(x=9\) không thoả \(x\neq 9\).</div></div></div></section>""",
      ["Bước cuối cùng hay bị bỏ qua là đối chiếu điều kiện. [chỉ: de] Vẫn biểu thức ở ví dụ, nhưng điều kiện đã đổi: x dương và x khác chín. [chỉ: cau] Em chọn đáp án đúng rồi bấm Tiếp tục nhé."],
      cho=True)

slide("09", r"""<section class="noi-dung"><h2>Khi đề cho \(x\) là số tự nhiên</h2><p>Vẫn \(P=1-\dfrac{4}{\sqrt{x}+1}\), nhưng lần này \(x\in\mathbb{N}\).</p><ul class="hien-dan"><li>Nếu \(\sqrt{x}\) không nguyên thì \(\sqrt{x}\) là số vô tỉ, kéo theo \(P\) không nguyên. Vậy \(\sqrt{x}\) phải nguyên.</li><li>Khi đó \(\sqrt{x}+1\) là ước dương của \(4\), tức là \(\sqrt{x}+1\in\{1;2;4\}\).</li><li>Vậy \(x\in\{0;1;9\}\). Giá trị \(x=\dfrac{1}{9}\) của ví dụ trước bị loại vì không phải số tự nhiên.</li></ul></section>""",
      ["Bây giờ là kiểu đề thứ hai: cùng biểu thức đó, nhưng x là số tự nhiên. Đây mới là lúc dùng ước số.",
       "Nếu căn x không nguyên thì căn x là số vô tỉ, kéo theo P không thể là số nguyên. Vậy căn x phải nguyên.",
       "Khi đó căn x cộng một là một ước dương của bốn, tức là một, hai, hoặc bốn.",
       "Giải ra, x bằng không, một và chín. So với ví dụ trước, ta mất đúng giá trị một phần chín, vì nó không phải số tự nhiên. Cùng một biểu thức, chỉ khác điều kiện của x, mà đáp số đã khác."])

slide("10", r"""<section class="hai-cot"><h2>Em tự làm: \(x\) là số tự nhiên</h2><div class="cot"><div class="dinh-nghia" data-chi="de">Với \(x\in\mathbb{N}\), tìm tất cả giá trị của \(x\) để \[Q=\frac{\sqrt{x}+9}{\sqrt{x}+1}\] là số nguyên.</div></div><div class="cot"><div class="nhap-dap-an" data-loai="tap-hop" data-dap-an="{0; 1; 9; 49}" data-chi="nhap"><p class="cau">Tập các giá trị của \(x\) là</p><div class="go-y">Tách: \(Q=1+\dfrac{8}{\sqrt{x}+1}\). Khi đó \(\sqrt{x}+1\) là ước dương của \(8\).</div>"""
      + loi_sai("{1; 9; 49}", r"Em đã bỏ sót \(\sqrt{x}+1=1\), tức là \(x=0\). Số \(0\) cũng là số tự nhiên.")
      + r"""<div class="giai-thich">\(\sqrt{x}+1\in\{1;2;4;8\}\), nên \(x\in\{0;1;9;49\}\).</div></div></div></section>""",
      ["Em thử với kiểu đề này. [chỉ: de] Lần này x là số tự nhiên, nên em được dùng ước số. [chỉ: nhap] Em làm ra giấy, nhập tập đáp số vào ô bên phải, rồi bấm Tiếp tục nhé."],
      cho=True)

slide("11", r"""<section class="tong-ket"><h2>Bốn bước của dạng này</h2><ul class="hien-dan"><li>Đọc đề: \(x\) có phải là số nguyên không?</li><li>Tách phần nguyên để \(x\) chỉ còn ở một chỗ.</li><li>Nếu \(x\) không nguyên thì chặn biểu thức; nếu \(x\) nguyên thì dùng ước số.</li><li>Giải từng trường hợp và đối chiếu với điều kiện của đề.</li></ul></section>""",
      ["Mình tóm tắt lại bài học thành bốn bước.",
       "Một, đọc đề xem x có phải là số nguyên không. Câu trả lời quyết định cách làm.",
       "Hai, tách phần nguyên, để x chỉ còn ở một chỗ.",
       "Ba, nếu x không nguyên thì chặn biểu thức giữa hai số. Nếu x nguyên thì dùng ước số.",
       "Bốn, giải từng trường hợp, rồi đối chiếu với điều kiện của đề. Phần luyện tập ngay dưới phần slide sẽ kiểm tra lại cả bốn bước với số liệu mới. Chúc em học tốt nhé!"])


# ── Quiz ──────────────────────────────────────────────────────────────────────────────────────────────────────────
CAU_HOI = [
    {
        "key": "btn.tach", "type": "mcq", "points": 1,
        "muc": "Nhận biết",
        "prompt": "Tách phần nguyên của $\\dfrac{\\sqrt{x}+4}{\\sqrt{x}+1}$ được:",
        "explanation": "Ta có $\\sqrt{x}+4=(\\sqrt{x}+1)+3$, nên biểu thức bằng $1+\\dfrac{3}{\\sqrt{x}+1}$.",
        "options": [
            {"label": "$1-\\dfrac{3}{\\sqrt{x}+1}$", "isCorrect": False, "misconception": "giaide.sai-dau-tach"},
            {"label": "$1+\\dfrac{3}{\\sqrt{x}+1}$", "isCorrect": True},
            {"label": "$4+\\dfrac{3}{\\sqrt{x}+1}$", "isCorrect": False},
            {"label": "$1+\\dfrac{4}{\\sqrt{x}+1}$", "isCorrect": False, "misconception": "giaide.sai-dau-tach"},
        ],
    },
    {
        "key": "btn.uoc-dung-sai", "type": "true_false", "points": 1,
        "muc": "Nhận biết",
        "prompt": "Với $x\\geq 0$ và đề không nói $x$ nguyên, muốn $P=1-\\dfrac{3}{\\sqrt{x}+2}$ nguyên thì $\\sqrt{x}+2$ phải là ước của $3$.",
        "explanation": "Sai. Đề không cho $x$ nguyên nên $\\sqrt{x}+2$ có thể là phân số. Chẳng hạn $\\sqrt{x}+2=\\dfrac{3}{2}$ thì phân số bằng $2$. Cách làm đúng là chặn $P$ rồi thử từng số nguyên.",
        "options": [
            {"label": "Đúng", "isCorrect": False, "misconception": "giaide.uoc-khi-x-khong-nguyen"},
            {"label": "Sai", "isCorrect": True},
        ],
    },
    {
        "key": "btn.dau-chan", "type": "mcq", "points": 1,
        "muc": "Nhận biết",
        "prompt": "Với $x\\gt 0$, khẳng định nào đúng?",
        "explanation": "Vì $x\\gt 0$ nên $\\sqrt{x}+2\\gt 2$, do đó $0\\lt\\dfrac{3}{\\sqrt{x}+2}\\lt\\dfrac{3}{2}$, với dấu nhỏ hơn hẳn.",
        "options": [
            {"label": "$0\\lt\\dfrac{3}{\\sqrt{x}+2}\\leq\\dfrac{3}{2}$", "isCorrect": False, "misconception": "giaide.quen-dau-mut"},
            {"label": "$0\\leq\\dfrac{3}{\\sqrt{x}+2}\\lt\\dfrac{3}{2}$", "isCorrect": False},
            {"label": "$0\\lt\\dfrac{3}{\\sqrt{x}+2}\\lt\\dfrac{3}{2}$", "isCorrect": True},
            {"label": "$\\dfrac{3}{2}\\lt\\dfrac{3}{\\sqrt{x}+2}$", "isCorrect": False},
        ],
    },
    {
        "key": "btn.khoang", "type": "mcq", "points": 1, "workOnPaper": True,
        "muc": "Thông hiểu",
        "prompt": "Với $x\\geq 0$, biểu thức $P=\\dfrac{\\sqrt{x}-1}{\\sqrt{x}+3}$ nằm trong khoảng nào?",
        "explanation": "$P=1-\\dfrac{4}{\\sqrt{x}+3}$. Vì $\\sqrt{x}+3\\geq 3$ nên $0\\lt\\dfrac{4}{\\sqrt{x}+3}\\leq\\dfrac{4}{3}$, do đó $-\\dfrac{1}{3}\\leq P\\lt 1$.",
        "options": [
            {"label": "$-\\dfrac{1}{3}\\leq P\\lt 1$", "isCorrect": True},
            {"label": "$-3\\leq P\\lt 1$", "isCorrect": False},
            {"label": "$0\\lt P\\leq\\dfrac{4}{3}$", "isCorrect": False, "misconception": "giaide.sai-dau-tach"},
            {"label": "$-\\dfrac{1}{3}\\lt P\\leq 1$", "isCorrect": False, "misconception": "giaide.quen-dau-mut"},
        ],
    },
    {
        "key": "btn.mot-gia-tri", "type": "fill_in", "points": 1, "workOnPaper": True,
        "muc": "Thông hiểu",
        "prompt": "Với $x\\geq 0$, có đúng một giá trị của $x$ để $P=\\dfrac{\\sqrt{x}-1}{\\sqrt{x}+3}$ là số nguyên. Điền giá trị đó.",
        "explanation": "Vì $-\\dfrac{1}{3}\\leq P\\lt 1$ nên số nguyên duy nhất là $P=0$, tức là $\\sqrt{x}=1$ và $x=1$.",
        "answers": ["1"],
    },
    {
        "key": "hn26.p-nguyen", "type": "mcq", "points": 1, "workOnPaper": True,
        "muc": "Thông hiểu",
        "prompt": "Với $x\\geq 0$, tất cả giá trị của $x$ để $P=\\dfrac{\\sqrt{x}-2}{\\sqrt{x}+1}$ là số nguyên là:",
        "explanation": "$P=1-\\dfrac{3}{\\sqrt{x}+1}$. Vì $\\sqrt{x}+1\\geq 1$ nên $-2\\leq P\\lt 1$, do đó $P\\in\\{-2;-1;0\\}$. Ba giá trị này lần lượt cho $x=0$, $x=\\dfrac{1}{4}$ và $x=4$.",
        "options": [
            {"label": "$x\\in\\{0;4\\}$", "isCorrect": False, "misconception": "giaide.uoc-khi-x-khong-nguyen"},
            {"label": "$x\\in\\left\\{\\dfrac{1}{4};4\\right\\}$", "isCorrect": False, "misconception": "giaide.quen-dau-mut"},
            {"label": "$x\\in\\{4\\}$", "isCorrect": False},
            {"label": "$x\\in\\left\\{0;\\dfrac{1}{4};4\\right\\}$", "isCorrect": True},
        ],
    },
    {
        "key": "btn.dem", "type": "mcq", "points": 1, "workOnPaper": True,
        "muc": "Thông hiểu",
        "prompt": "Với $x\\gt 0$, có bao nhiêu giá trị của $x$ để $P=\\dfrac{\\sqrt{x}-5}{\\sqrt{x}+1}$ là số nguyên?",
        "explanation": "$P=1-\\dfrac{6}{\\sqrt{x}+1}$. Vì $\\sqrt{x}+1\\gt 1$ nên $-5\\lt P\\lt 1$, do đó $P\\in\\{-4;-3;-2;-1;0\\}$. Mỗi giá trị của $P$ cho đúng một giá trị của $x$, nên có $5$ giá trị.",
        "options": [
            {"label": "$3$", "isCorrect": False, "misconception": "giaide.uoc-khi-x-khong-nguyen"},
            {"label": "$4$", "isCorrect": False},
            {"label": "$5$", "isCorrect": True},
            {"label": "$6$", "isCorrect": False, "misconception": "giaide.quen-dau-mut"},
        ],
    },
    {
        "key": "btn.khong-co", "type": "mcq", "points": 1, "workOnPaper": True,
        "muc": "Thông hiểu",
        "prompt": "Với $x\\geq 0$, các giá trị của $x$ để $P=\\dfrac{\\sqrt{x}+1}{\\sqrt{x}+3}$ là số nguyên là:",
        "explanation": "$P=1-\\dfrac{2}{\\sqrt{x}+3}$. Vì $\\sqrt{x}+3\\geq 3$ nên $\\dfrac{1}{3}\\leq P\\lt 1$. Trong khoảng này không có số nguyên nào.",
        "options": [
            {"label": "$x=0$", "isCorrect": False},
            {"label": "$x=1$", "isCorrect": False},
            {"label": "$x\\in\\{0;1\\}$", "isCorrect": False},
            {"label": "Không có giá trị nào", "isCorrect": True},
        ],
    },
    {
        "key": "btn.dieu-kien", "type": "mcq", "points": 2, "workOnPaper": True,
        "muc": "Vận dụng",
        "prompt": "Với $x\\geq 0,\\ x\\neq 9$, tất cả giá trị của $x$ để $P=\\dfrac{\\sqrt{x}-3}{\\sqrt{x}+2}$ là số nguyên là:",
        "explanation": "$P=1-\\dfrac{5}{\\sqrt{x}+2}$. Vì $\\sqrt{x}+2\\geq 2$ nên $-\\dfrac{3}{2}\\leq P\\lt 1$, do đó $P\\in\\{-1;0\\}$, cho $x=\\dfrac{1}{4}$ và $x=9$. Đề có $x\\neq 9$ nên chỉ còn $x=\\dfrac{1}{4}$.",
        "options": [
            {"label": "$x=\\dfrac{1}{4}$", "isCorrect": True},
            {"label": "$x\\in\\left\\{\\dfrac{1}{4};9\\right\\}$", "isCorrect": False, "misconception": "giaide.quen-doi-chieu"},
            {"label": "$x=9$", "isCorrect": False, "misconception": "giaide.uoc-khi-x-khong-nguyen"},
            {"label": "Không có giá trị nào", "isCorrect": False},
        ],
    },
    {
        "key": "btn.tu-nhien", "type": "mcq", "points": 2, "workOnPaper": True,
        "muc": "Vận dụng",
        "prompt": "Với $x\\in\\mathbb{N}$, tất cả giá trị của $x$ để $Q=\\dfrac{\\sqrt{x}+7}{\\sqrt{x}+1}$ là số nguyên là:",
        "explanation": "$Q=1+\\dfrac{6}{\\sqrt{x}+1}$. Vì $x$ là số tự nhiên nên $\\sqrt{x}$ phải nguyên, và $\\sqrt{x}+1$ là ước dương của $6$, tức là $1;2;3;6$. Vậy $x\\in\\{0;1;4;25\\}$.",
        "options": [
            {"label": "$x\\in\\{1;4;25\\}$", "isCorrect": False, "misconception": "giaide.quen-dau-mut"},
            {"label": "$x\\in\\{0;1;4;25\\}$", "isCorrect": True},
            {"label": "$x\\in\\{0;1;4;5\\}$", "isCorrect": False},
            {"label": "$x\\in\\{1;2;3;6\\}$", "isCorrect": False},
        ],
    },
]

LOI_TU_DUY = [
    ("giaide.uoc-khi-x-khong-nguyen", "Xét ước số khi biến không nhất thiết nguyên",
     "Coi mẫu của biểu thức là số nguyên nên chỉ xét các ước của tử, trong khi đề không cho x nguyên. Mẫu có thể là phân số mà biểu thức vẫn nguyên, vì vậy cách này bỏ sót nghiệm."),
    ("giaide.quen-dau-mut", "Sai ở đầu mút khi chặn biểu thức",
     "Dùng nhầm dấu lớn hơn hẳn và dấu lớn hơn hoặc bằng. Với x ≥ 0, giá trị x = 0 được phép; với x > 0 thì không. Chặn sai dấu sẽ làm thừa hoặc mất giá trị ở đầu mút."),
    ("giaide.sai-dau-tach", "Tách phần nguyên sai",
     "Viết sai số dư khi tách tử số theo mẫu số, hoặc sai dấu của phần phân số. Khi đó mọi bước chặn phía sau đều sai."),
    ("giaide.quen-doi-chieu", "Không đối chiếu đáp số với điều kiện của đề",
     "Giải đủ các trường hợp rồi nhận hết, quên loại những giá trị mà điều kiện của đề không cho phép."),
]

PHAN_HOI = [
    ("giaide.uoc-khi-x-khong-nguyen", "Đề không cho x là số nguyên, nên mẫu số có thể là phân số. Xét ước số sẽ bỏ sót những nghiệm như vậy. Em hãy chặn P giữa hai số rồi thử từng số nguyên trong khoảng đó.", 10),
    ("giaide.quen-dau-mut", "Em hãy nhìn lại điều kiện của x. Với x ≥ 0, giá trị x = 0 được phép nên phải giữ dấu lớn hơn hoặc bằng khi chặn. Với x > 0, giá trị đó bị loại nên dùng dấu lớn hơn hẳn. Hãy thay giá trị đầu mút vào để kiểm tra.", 10),
    ("giaide.sai-dau-tach", "Em hãy nhân ngược lại để kiểm tra phép tách: lấy phần nguyên nhân với mẫu số, cộng phần còn lại, xem có đúng bằng tử số không. Phép kiểm tra này chỉ mất vài giây và bắt được gần hết lỗi dấu.", 10),
    ("giaide.quen-doi-chieu", "Em đã giải đúng các trường hợp, nhưng còn phải đối chiếu với điều kiện của đề. Trước khi kết luận, hãy thay từng giá trị của x vào điều kiện và loại những giá trị không thoả.", 10),
]


def gia_tri_x(a, b, c, duong=False):
    """Mọi x để P = (a√x + b)/(√x + c) nguyên, với x ≥ 0 (x > 0 nếu `duong`) và x không nhất thiết nguyên.

    P = a + (b − ac)/u với u = √x + c. Duyệt mọi số nguyên P đủ gần a rồi giải u; chỉ nhận u ≥ c (u > c nếu `duong`).
    """
    k = b - a * c
    kq = []
    for p in range(a - 50, a + 51):
        if p == a:
            continue
        u = Fr(k, p - a)
        if u > c or (u == c and not duong):
            kq.append((u - c) ** 2)
    return sorted(kq)


def x_tu_nhien(a, b, c, tran=10_000):
    """Mọi x tự nhiên để P nguyên, duyệt trực tiếp. Nếu √x vô tỉ thì P vô tỉ (khi b ≠ ac), nên chỉ cần xét x chính phương."""
    kq = []
    for r in range(tran):
        if (a * r + b) % (r + c) == 0:
            kq.append(r * r)
    return kq


def kiem_so():
    # Slide: phép tách ở bài ghép đôi
    for (a, b, c), (nguyen, du) in {(1, -1, 2): (1, -3), (2, 1, 1): (2, -1), (1, 5, 1): (1, 4)}.items():
        assert (nguyen, du) == (a, b - a * c)
    # Slide: các ví dụ và bài tự làm
    assert gia_tri_x(1, -3, 1) == sorted([Fr(0), Fr(1, 9), Fr(1), Fr(9)])
    assert gia_tri_x(1, -4, 1) == sorted([Fr(0), Fr(1, 16), Fr(4, 9), Fr(9, 4), Fr(16)])
    assert gia_tri_x(1, -5, 2) == sorted([Fr(1, 9), Fr(9, 4), Fr(25)])
    assert gia_tri_x(1, -3, 1, duong=True) == sorted([Fr(1, 9), Fr(1), Fr(9)])
    assert x_tu_nhien(1, -3, 1) == [0, 1, 9] and x_tu_nhien(1, 9, 1) == [0, 1, 9, 49]
    # Quiz
    assert gia_tri_x(1, -1, 3) == [Fr(1)]
    assert gia_tri_x(1, -2, 1) == sorted([Fr(0), Fr(1, 4), Fr(4)])
    assert len(gia_tri_x(1, -5, 1, duong=True)) == 5 and len(gia_tri_x(1, -5, 1)) == 6
    assert sorted(d for d in range(2, 7) if 6 % d == 0) == [2, 3, 6]  # phương án nhiễu 3: chỉ xét ước của 6 lớn hơn 1
    assert gia_tri_x(1, 1, 3) == []
    assert [x for x in gia_tri_x(1, -3, 2) if x != 9] == [Fr(1, 4)] and Fr(9) in gia_tri_x(1, -3, 2)
    assert x_tu_nhien(1, 7, 1) == [0, 1, 4, 25]
    # Cấu trúc quiz: 10 câu, 12 điểm, 3 Nhận biết, 5 Thông hiểu, 2 Vận dụng; mã lỗi đều đã khai báo
    assert len(CAU_HOI) == 10 and sum(c["points"] for c in CAU_HOI) == 12
    for muc, so in (("Nhận biết", 3), ("Thông hiểu", 5), ("Vận dụng", 2)):
        assert sum(c["muc"] == muc for c in CAU_HOI) == so, muc
    ma = {c for c, _, _ in LOI_TU_DUY}
    assert {c for c, _, _ in PHAN_HOI} == ma
    for c in CAU_HOI:
        if c["type"] in ("mcq", "true_false"):
            assert sum(o["isCorrect"] for o in c["options"]) == 1, c["key"]
            for o in c["options"]:
                assert "misconception" not in o or o["misconception"] in ma, c["key"]


def tao_deck():
    kiem_so()
    return khung_deck("Tìm x để biểu thức nguyên", BO.slides)


def tao_bai(lecture, phut):
    """Bài dạng: khung slide và quiz. Không có `body`, vì màn hình bìa là phần mở đầu của bài."""
    return {
        "title": TIEU_DE,
        "description": "Nhận ra kiểu đề, tách phần nguyên, chặn biểu thức hoặc dùng ước số, rồi đối chiếu điều kiện.",
        "durationMin": phut,
        "embeds": [{"url": f"/decks/{ID}", "height": 720}],
        "lecture": lecture,
        "quiz": {"title": "Luyện dạng: tìm x để biểu thức nguyên", "requireConfidence": False, "questions": [{k: v for k, v in c.items() if k != "muc"} for c in CAU_HOI]},
    }

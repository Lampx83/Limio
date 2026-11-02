"""Đề thi Toán vào lớp 10 Hà Nội, thi ngày 31/5/2026: hướng dẫn giải.

Đề bài được diễn đạt lại ngắn gọn và giữ nguyên số liệu; lời giải do Limio soạn. Mọi đáp số và đáp án quiz được kiểm
trong `kiem_so()`, các tính chất hình học được kiểm trong make_figures.py.
"""
from fractions import Fraction as Fr
from math import isqrt

NGUON = "https://laodong.vn/giao-duc/de-thi-dap-an-mon-toan-thi-vao-lop-10-tai-ha-noi-nam-2026-1711071.ldo"


def bai(title, de, buoc, ghi_chu=None, goi_y=None):
    """Một ý của đề: đề bài ở phần dẫn, lời giải hiện từng bước. buoc = [(tên bước, nội dung)].

    Trang học viên luôn hiện sẵn bước đầu của mục `reveal`, nên bước 1 là lời nhắc tự làm; đặt lời giải ở bước 1 thì học
    sinh đọc được ý tưởng trước khi kịp thử.
    """
    tu_lam = "Em hãy làm ý này ra giấy trước, rồi bấm **Bước tiếp** để đối chiếu từng dòng."
    if goi_y:
        tu_lam += f"\n\n:::Bí quá thì mở gợi ý\n{goi_y}\n:::"
    sec = {
        "layout": "steps",
        "reveal": True,
        "title": title,
        "intro": f"**Đề bài.** {de}",
        "parts": [{"title": "Tự làm ra giấy", "md": tu_lam}] + [{"title": t, "md": md} for t, md in buoc],
    }
    if ghi_chu:
        sec["outro"] = ghi_chu
    return sec


def tao_bai(hinh, lecture, deck_id):
    """Một bài cho một đề: khung slide ở đầu, lời giải để đọc lại ở dưới. Lời giảng chỉ theo slide."""
    muc = []

    def them(title, de, buoc, ghi_chu=None, goi_y=None):
        muc.append(bai(title, de, buoc, ghi_chu, goi_y))

    # ── Câu I ───────────────────────────────────────────────────────────────────
    them(
        "Câu I.1: Bảng tần số ghép nhóm",
        "Chiều cao (cm) của 50 học sinh lớp 6 được thống kê như sau. Hãy xác định tần số và tần số tương đối của nhóm $[150;155)$.\n\n"
        "| Chiều cao | $[140;145)$ | $[145;150)$ | $[150;155)$ | $[155;160)$ | $[160;165)$ |\n"
        "|---|---|---|---|---|---|\n"
        "| Số học sinh | 10 | 18 | 14 | 6 | 2 |",
        [
            ("Đọc tần số từ bảng",
             "Tần số của nhóm $[150;155)$ là số học sinh ở cột của nhóm đó, tức là $14$."),
            ("Kiểm tra cỡ mẫu",
             "$$10+18+14+6+2=50$$\n\nTổng này khớp với 50 học sinh mà đề cho. Vì sao cần cộng: tần số tương đối phải chia cho cỡ mẫu, nên ta chắc chắn số này trước khi chia."),
            ("Tính tần số tương đối",
             "$$f=\\frac{14}{50}\\cdot 100\\%=28\\%$$\n\nVậy nhóm $[150;155)$ có tần số $14$ và tần số tương đối $28\\%$."),
        ],
        "> [!canh-bao] Nhóm $[150;155)$ chứa $150$ nhưng không chứa $155$. Học sinh cao đúng $155$ cm thuộc nhóm kế tiếp, vì vậy em đọc kỹ dấu ngoặc khi đề cho số liệu rời.",
    )
    them(
        "Câu I.2: Xác suất của biến cố",
        "Một hộp có 6 quả bóng cùng loại, ghi các số $1,2,3,4,5,6$, mỗi quả một số khác nhau. Lấy ngẫu nhiên một quả. Tính xác suất của biến cố $A$: “Số ghi trên quả bóng lấy được là số chẵn”.",
        [
            ("Viết không gian mẫu",
             "$$\\Omega=\\{1;2;3;4;5;6\\},\\quad n(\\Omega)=6$$\n\nCác quả bóng cùng loại nên sáu kết quả này đồng khả năng."),
            ("Liệt kê kết quả thuận lợi",
             "Các kết quả thuận lợi cho $A$ là $2;4;6$, nên có $3$ kết quả."),
            ("Tính xác suất",
             "$$P(A)=\\frac{3}{6}=\\frac{1}{2}$$"),
        ],
    )

    # ── Câu II ──────────────────────────────────────────────────────────────────
    BIEU_THUC = "Cho $A=\\dfrac{\\sqrt{x}-4}{\\sqrt{x}}$ và $B=\\dfrac{4}{\\sqrt{x}-3}+\\dfrac{x-7\\sqrt{x}-12}{x-9}$ với $x>0,\\ x\\neq 9$."
    them(
        "Câu II.1: Tính giá trị biểu thức",
        f"{BIEU_THUC} Tính giá trị của $A$ khi $x=25$.",
        [
            ("Kiểm tra điều kiện",
             "Giá trị $x=25$ thoả mãn $x>0$ và $x\\neq 9$, nên ta được thay vào biểu thức."),
            ("Thay số và tính",
             "$$A=\\frac{\\sqrt{25}-4}{\\sqrt{25}}=\\frac{5-4}{5}=\\frac{1}{5}$$"),
        ],
    )
    them(
        "Câu II.2: Rút gọn biểu thức",
        "Với biểu thức $B$ ở trên, chứng minh rằng $B=\\dfrac{\\sqrt{x}}{\\sqrt{x}+3}$.",
        [
            ("Phân tích mẫu chung",
             "$$x-9=(\\sqrt{x}-3)(\\sqrt{x}+3)$$\n\nVì sao: đây là hiệu hai bình phương, và nó cho thấy mẫu chung của cả hai phân thức chính là $x-9$."),
            ("Quy đồng",
             "$$B=\\frac{4(\\sqrt{x}+3)+x-7\\sqrt{x}-12}{(\\sqrt{x}-3)(\\sqrt{x}+3)}$$"),
            ("Rút gọn tử",
             "$$4\\sqrt{x}+12+x-7\\sqrt{x}-12=x-3\\sqrt{x}=\\sqrt{x}(\\sqrt{x}-3)$$\n\nHai số $12$ và $-12$ triệt tiêu, và $4\\sqrt{x}-7\\sqrt{x}=-3\\sqrt{x}$."),
            ("Chia cho thừa số chung",
             "$$B=\\frac{\\sqrt{x}(\\sqrt{x}-3)}{(\\sqrt{x}-3)(\\sqrt{x}+3)}=\\frac{\\sqrt{x}}{\\sqrt{x}+3}$$\n\nPhép chia hợp lệ vì $x\\neq 9$ nên $\\sqrt{x}-3\\neq 0$."),
        ],
    )
    them(
        "Câu II.3: Tìm x để P nguyên",
        "Tìm tất cả giá trị của $x$ để biểu thức $P=A\\cdot B$ có giá trị là số nguyên.",
        [
            ("Viết gọn biểu thức P",
             "$$P=\\frac{\\sqrt{x}-4}{\\sqrt{x}}\\cdot\\frac{\\sqrt{x}}{\\sqrt{x}+3}=\\frac{\\sqrt{x}-4}{\\sqrt{x}+3}$$"),
            ("Tách phần nguyên",
             "$$P=\\frac{(\\sqrt{x}+3)-7}{\\sqrt{x}+3}=1-\\frac{7}{\\sqrt{x}+3}$$\n\nVì sao: sau khi tách, $x$ chỉ còn xuất hiện ở một chỗ, nên việc đánh giá $P$ trở nên dễ dàng."),
            ("Chặn P giữa hai số",
             "Vì $x>0$ nên $\\sqrt{x}+3>3$, do đó\n\n$$0<\\frac{7}{\\sqrt{x}+3}<\\frac{7}{3}\\quad\\Rightarrow\\quad -\\frac{4}{3}<P<1$$"),
            ("Liệt kê số nguyên trong khoảng",
             "Các số nguyên nằm trong khoảng $\\left(-\\dfrac{4}{3};1\\right)$ là $-1$ và $0$."),
            ("Giải từng trường hợp",
             "Với $P=0$: $\\sqrt{x}+3=7$, nên $x=16$.\n\nVới $P=-1$: $\\dfrac{7}{\\sqrt{x}+3}=2$, nên $\\sqrt{x}=\\dfrac{1}{2}$ và $x=\\dfrac{1}{4}$.\n\nCả hai giá trị đều thoả mãn $x>0,\\ x\\neq 9$. Vậy $x\\in\\left\\{16;\\dfrac{1}{4}\\right\\}$."),
        ],
        "> [!canh-bao] Đề **không** cho $x$ là số nguyên, nên $\\sqrt{x}+3$ không nhất thiết nguyên. Nếu chỉ xét “$\\sqrt{x}+3$ là ước của $7$” thì em chỉ tìm được $x=16$ và mất nghiệm $x=\\dfrac{1}{4}$, vì khi đó $\\sqrt{x}+3=\\dfrac{7}{2}$ không phải là số nguyên mà $P$ vẫn bằng $-1$. Với loại đề này, cách chắc chắn là chặn $P$ rồi thử từng số nguyên.",
        goi_y="Em hãy viết $P$ dưới dạng một số nguyên trừ đi một phân số, sao cho $x$ chỉ còn xuất hiện ở mẫu của phân số đó. Sau đó em dùng điều kiện $x>0$ để chặn $P$.",
    )

    # ── Câu III ─────────────────────────────────────────────────────────────────
    them(
        "Câu III.1: Bài toán năng suất",
        "Một tổ sản xuất lập kế hoạch may một số áo như nhau mỗi ngày. Trong 3 ngày đầu, tổ may đúng kế hoạch. Trong 7 ngày tiếp theo, nhờ cải tiến kỹ thuật, mỗi ngày tổ may nhiều hơn 5 áo so với kế hoạch. Sau 10 ngày, tổ may được tổng cộng 335 áo. Hỏi theo kế hoạch mỗi ngày tổ may bao nhiêu áo?",
        [
            ("Đặt ẩn và điều kiện",
             "Gọi $x$ là số áo tổ may mỗi ngày theo kế hoạch, với $x\\in\\mathbb{N}^*$."),
            ("Biểu diễn từng giai đoạn",
             "Ba ngày đầu tổ may $3x$ áo. Bảy ngày sau, mỗi ngày tổ may $x+5$ áo, nên cả bảy ngày may $7(x+5)$ áo."),
            ("Lập và giải phương trình",
             "$$3x+7(x+5)=335\;\\Rightarrow\;10x+35=335\;\\Rightarrow\;x=30$$"),
            ("Đối chiếu và kết luận",
             "Giá trị $x=30$ thoả mãn điều kiện. Thử lại: $3\\cdot 30+7\\cdot 35=90+245=335$.\n\nVậy theo kế hoạch, mỗi ngày tổ may $30$ áo."),
        ],
        "> [!canh-bao] “Nhiều hơn 5 áo” là nhiều hơn **mỗi ngày**. Nếu viết $7x+5$ thì em đã coi cả bảy ngày chỉ nhiều hơn 5 áo, và phương trình sai từ đầu.",
    )
    them(
        "Câu III.2: Lập hệ phương trình",
        "Một người mua 25 bông hoa gồm hoa hồng và hoa cúc, hết 180 nghìn đồng. Mỗi bông hoa hồng giá 8 nghìn đồng, mỗi bông hoa cúc giá 6 nghìn đồng. Hỏi người đó mua bao nhiêu bông mỗi loại?",
        [
            ("Đặt ẩn và điều kiện",
             "Gọi $x$, $y$ lần lượt là số bông hoa hồng và hoa cúc, với $x,y\\in\\mathbb{N}$."),
            ("Lập hệ phương trình",
             "$$\\begin{cases}x+y=25\\\\ 8x+6y=180\\end{cases}$$\n\nPhương trình thứ hai dùng đơn vị nghìn đồng cho cả hai vế."),
            ("Giải hệ",
             "Từ phương trình đầu có $y=25-x$. Thay vào phương trình sau:\n\n$$8x+6(25-x)=180\;\\Rightarrow\;2x=30\;\\Rightarrow\;x=15,\\ y=10$$"),
            ("Thử lại và kết luận",
             "Thử lại: $15+10=25$ và $8\\cdot 15+6\\cdot 10=120+60=180$.\n\nVậy người đó mua $15$ bông hoa hồng và $10$ bông hoa cúc."),
        ],
    )
    them(
        "Câu III.3: Hệ thức Viète",
        "Phương trình $x^2-3x+1=0$ có hai nghiệm phân biệt $x_1,x_2$. Tính giá trị của $Q=\\dfrac{3x_2-1}{x_1}+\\dfrac{3x_1}{x_2}-x_1$.",
        [
            ("Viết hệ thức Viète",
             "$$x_1+x_2=3,\\qquad x_1x_2=1$$\n\nĐề đã cho biết phương trình có hai nghiệm phân biệt nên ta được dùng hệ thức này; thật vậy, $\\Delta=9-4=5>0$."),
            ("Tận dụng tích bằng một",
             "Vì $x_1x_2=1$ nên $\\dfrac{1}{x_1}=x_2$ và $\\dfrac{1}{x_2}=x_1$. Thay vào $Q$:\n\n$$Q=(3x_2-1)x_2+3x_1\\cdot x_1-x_1=3x_2^2-x_2+3x_1^2-x_1$$"),
            ("Đưa về tổng và tích",
             "$$Q=3(x_1^2+x_2^2)-(x_1+x_2)$$\n\nMà $x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=9-2=7$."),
            ("Tính kết quả",
             "$$Q=3\\cdot 7-3=18$$"),
        ],
        "> [!meo] Trước khi quy đồng một biểu thức Viète, em hãy nhìn tích $x_1x_2$. Khi tích bằng $1$, mỗi phép chia cho một nghiệm trở thành phép nhân với nghiệm kia, và bài toán ngắn đi rất nhiều.",
        goi_y="Em hãy tính tích $x_1x_2$ trước khi quy đồng và thử xem giá trị của tích giúp gì cho các phép chia trong $Q$.",
    )

    # ── Câu IV.1 ────────────────────────────────────────────────────────────────
    them(
        "Câu IV.1: Hình trụ và bài toán thực tế",
        "Một xô đựng nước dạng hình trụ cao 25 cm, bán kính đáy 12 cm (lấy $\\pi=3{,}14$, coi độ dày của xô không đáng kể). (a) Tính diện tích xung quanh của xô. (b) Người ta dùng xô đổ nước vào một bể có thể tích 150 lít; mỗi lần múc chỉ múc lượng nước bằng $80\\%$ thể tích của xô. Bể ban đầu không có nước. Hỏi cần ít nhất bao nhiêu xô để đổ đầy bể? (Biết $1$ lít $=1000\\ \\text{cm}^3$.)\n\n"
        f"![Xô hình trụ có bán kính đáy 12 cm và chiều cao 25 cm]({hinh['hn2026-tru']} \"Xô nước trong đề, vẽ lại theo số liệu của đề.\")",
        [
            ("Tính diện tích xung quanh",
             "$$S_{xq}=2\\pi rh=2\\cdot 3{,}14\\cdot 12\\cdot 25=1884\\ (\\text{cm}^2)$$"),
            ("Tính thể tích của xô",
             "$$V=\\pi r^2h=3{,}14\\cdot 12^2\\cdot 25=11304\\ (\\text{cm}^3)$$"),
            ("Tính lượng nước mỗi lần múc",
             "$$80\\%\\cdot 11304=9043{,}2\\ (\\text{cm}^3)=9{,}0432\\ (\\text{lít})$$"),
            ("Chia và làm tròn lên",
             "$$150:9{,}0432\\approx 16{,}59$$\n\nSố lần đổ phải là số nguyên và phải đủ đầy bể, nên ta lấy số nguyên nhỏ nhất không nhỏ hơn $16{,}59$, tức là $17$."),
            ("Kiểm tra bằng hai số liền nhau",
             "Với $16$ xô, lượng nước là $16\\cdot 9{,}0432\\approx 144{,}7$ lít, chưa đầy bể. Với $17$ xô, lượng nước là $17\\cdot 9{,}0432\\approx 153{,}7$ lít, đã đủ.\n\nVậy cần ít nhất $17$ xô nước."),
        ],
        "> [!canh-bao] Chữ “ít nhất” trong bài toán này nghĩa là phải **làm tròn lên**, kể cả khi phần thập phân nhỏ hơn $0{,}5$. Em cũng cần đổi đơn vị trước khi chia, vì thể tích xô tính bằng cm³ còn thể tích bể tính bằng lít.",
    )

    # ── Câu IV.2 ────────────────────────────────────────────────────────────────
    muc.append({
        "layout": "text",
        "title": "Câu IV.2: Đề bài hình học",
        "parts": [{"md": (
            "**Đề bài.** Cho tam giác $ABC$ vuông tại $A$ ($AB<AC$) nội tiếp đường tròn tâm $O$, đường kính $BC$. Lấy điểm $H$ thuộc đoạn $AB$ sao cho $HB>HA$ ($H$ khác $A$). "
            "Đường thẳng qua $H$ vuông góc với $BC$ cắt $BC$ tại $D$ và cắt đường thẳng $AC$ tại $E$.\n\n"
            "a) Chứng minh bốn điểm $A,H,D,C$ cùng thuộc một đường tròn.\n\n"
            "b) Đường thẳng $CH$ cắt $(O)$ tại điểm thứ hai $F$. Đường thẳng qua $A$ vuông góc với $ED$ cắt $DF$ tại $M$. Chứng minh $AE\\cdot BC=EH\\cdot AB$ và $\\widehat{EMH}=90^\\circ$.\n\n"
            "c) Đường thẳng $BM$ cắt $(O)$ tại điểm thứ hai $K$. Chứng minh tam giác $HKM$ là tam giác cân.\n\n"
            "> [!meo] Em hãy tự vẽ hình trước khi xem lời giải. Vẽ đường tròn đủ lớn và đặt $A$ gần $B$ để $AB<AC$, rồi đặt $H$ gần $A$ hơn gần $B$ để $HB>HA$. Hình vẽ đúng tỉ lệ giúp em nhìn ra nhiều góc bằng nhau."
        )}],
    })
    them(
        "Câu IV.2a: Bốn điểm cùng thuộc đường tròn",
        "Chứng minh bốn điểm $A,H,D,C$ cùng thuộc một đường tròn.",
        [
            ("Xét góc tại A",
             f"![Hình vẽ ý a: đường tròn đường kính HC đi qua A và D]({hinh['hn2026-iv2a']} \"Đường tròn nét đứt có đường kính HC đi qua A và D.\")\n\n"
             "Tam giác $ABC$ vuông tại $A$ và $H$ thuộc $AB$, nên $\\widehat{HAC}=90^\\circ$. Do đó $A$ thuộc đường tròn đường kính $HC$."),
            ("Xét góc tại D",
             "Vì $HD\\perp BC$ tại $D$ nên $\\widehat{HDC}=90^\\circ$. Do đó $D$ cũng thuộc đường tròn đường kính $HC$."),
            ("Kết luận",
             "Hai điểm $A$ và $D$ cùng nhìn đoạn $HC$ dưới một góc vuông, nên bốn điểm $A,H,D,C$ cùng thuộc đường tròn đường kính $HC$."),
        ],
    )
    them(
        "Câu IV.2b, phần 1: Tam giác đồng dạng",
        "Chứng minh $AE\\cdot BC=EH\\cdot AB$.",
        [
            ("Tìm cặp tam giác từ đẳng thức",
             "Đẳng thức cần chứng minh tương đương với $\\dfrac{AE}{AB}=\\dfrac{EH}{BC}$. Tỉ lệ này gợi ý xét hai tam giác $AEH$ và $ABC$."),
            ("Chỉ ra hai cặp góc bằng nhau",
             "Ta có $\\widehat{EAH}=\\widehat{BAC}=90^\\circ$, vì $E$ thuộc đường thẳng $AC$ và $H$ thuộc $AB$.\n\nTrong tam giác $EDC$ vuông tại $D$, góc $\\widehat{DEC}$ phụ với $\\widehat{ACB}$. Trong tam giác $ABC$ vuông tại $A$, góc $\\widehat{ABC}$ cũng phụ với $\\widehat{ACB}$. Do đó $\\widehat{AEH}=\\widehat{ABC}$."),
            ("Suy ra đẳng thức",
             "Vậy $\\triangle AEH\\sim\\triangle ABC$ (g.g), nên\n\n$$\\frac{AE}{AB}=\\frac{EH}{BC}\;\\Rightarrow\;AE\\cdot BC=EH\\cdot AB$$"),
        ],
    )
    them(
        "Câu IV.2b, phần 2: Chứng minh góc vuông",
        "Chứng minh $\\widehat{EMH}=90^\\circ$.",
        [
            ("Thêm một đường tròn nữa",
             f"![Hình vẽ ý b: DH là phân giác của góc ADM, M đối xứng với A qua DE]({hinh['hn2026-iv2b']} \"DH là phân giác của góc ADM và là trung trực của AM.\")\n\n"
             "$F$ thuộc đường tròn đường kính $BC$ nên $\\widehat{BFH}=\\widehat{BFC}=90^\\circ$. Mặt khác $\\widehat{BDH}=90^\\circ$. Vì vậy $B,D,H,F$ cùng thuộc đường tròn đường kính $BH$."),
            ("Chứng minh DH là phân giác",
             "Ta nối ba cặp góc bằng nhau:\n\n- $\\widehat{HDF}=\\widehat{HBF}$ vì cùng chắn cung $HF$ của đường tròn đường kính $BH$.\n- $\\widehat{ABF}=\\widehat{ACF}$ vì cùng chắn cung $AF$ của $(O)$.\n- $\\widehat{ACH}=\\widehat{ADH}$ vì cùng chắn cung $AH$ của đường tròn ở ý a.\n\nVì $H$ thuộc $AB$ và $CF$ đi qua $H$, ta suy ra $\\widehat{HDF}=\\widehat{ADH}$, tức là $DH$ là phân giác của góc $\\widehat{ADM}$."),
            ("Suy ra DE là trung trực của AM",
             "Gọi $I$ là giao điểm của $AM$ và $DE$. Tam giác $ADM$ có $DI$ vừa là đường cao ($AM\\perp DE$) vừa là phân giác, nên tam giác này cân tại $D$ và $IA=IM$. Do đó $DE$ là đường trung trực của đoạn $AM$."),
            ("Kết luận góc vuông",
             "Vì $H$ và $E$ thuộc đường trung trực của $AM$ nên $HM=HA$ và $EM=EA$. Cùng với cạnh chung $EH$, ta có $\\triangle EMH=\\triangle EAH$ (c.c.c). Do đó $\\widehat{EMH}=\\widehat{EAH}=90^\\circ$."),
        ],
        "> [!ghi-nho] Kết quả đáng nhớ của ý này là $M$ đối xứng với $A$ qua đường thẳng $DE$, nên $HM=HA$. Ý c sẽ dùng lại điều đó.",
        goi_y="Điểm $F$ tạo thêm một đường tròn có đường kính $BH$. Em hãy thử chứng minh $DH$ là phân giác của góc $\\widehat{ADM}$, rồi xem tam giác $ADM$ có gì đặc biệt.",
    )
    them(
        "Câu IV.2c: Tam giác cân",
        "Đường thẳng $BM$ cắt $(O)$ tại điểm thứ hai $K$. Chứng minh tam giác $HKM$ cân.",
        [
            ("Dự đoán và thêm điểm phụ",
             f"![Hình vẽ ý c: HK bằng HM, N là giao điểm của BM và DE]({hinh['hn2026-iv2c']} \"Đường tròn nét đứt tâm H đi qua A, M và K; N là giao điểm của BM và DE.\")\n\n"
             "Hình vẽ cho thấy $HK=HM$, nên ta dự đoán tam giác cân tại $H$. Gọi $N$ là giao điểm của đường thẳng $BM$ và đường thẳng $DE$. Vì $HB>HA$ nên $M$ nằm giữa $B$ và $N$; vì $AB<AC$ nên $M$ nằm ngoài $(O)$, do đó $K$ nằm giữa $B$ và $M$. Như vậy bốn điểm nằm theo thứ tự $B,K,M,N$."),
            ("Hai tích cùng bằng BD nhân BC",
             "Điểm $K$ thuộc đường tròn đường kính $BC$ nên $\\widehat{BKC}=90^\\circ$. Do đó $\\triangle BKC\\sim\\triangle BDN$ (chung góc $B$, cùng có góc vuông), suy ra $BK\\cdot BN=BD\\cdot BC$.\n\nTương tự, $\\triangle BDH\\sim\\triangle BAC$ (chung góc $B$, cùng có góc vuông), suy ra $BH\\cdot BA=BD\\cdot BC$.\n\nVậy $BK\\cdot BN=BH\\cdot BA$."),
            ("Tìm góc bằng góc đáy",
             "Từ $\\dfrac{BK}{BA}=\\dfrac{BH}{BN}$ và góc $B$ chung, ta có $\\triangle BKH\\sim\\triangle BAN$ (c.g.c). Do đó $\\widehat{BKH}=\\widehat{BAN}$."),
            ("Dùng tính đối xứng",
             "Theo ý b, $DE$ là trung trực của $AM$. Điểm $H$ và $N$ đều thuộc $DE$ nên $HA=HM$ và $NA=NM$. Với cạnh chung $HN$, ta có $\\triangle HAN=\\triangle HMN$ (c.c.c), do đó $\\widehat{HAN}=\\widehat{HMN}$."),
            ("Kết luận tam giác cân",
             "Vì $H$ thuộc $AB$ nên $\\widehat{BAN}=\\widehat{HAN}$. Vì các điểm nằm theo thứ tự $B,K,M,N$ nên\n\n$$\\widehat{HKM}=180^\\circ-\\widehat{BKH}=180^\\circ-\\widehat{HAN}=180^\\circ-\\widehat{HMN}=\\widehat{HMK}$$\n\nTam giác $HKM$ có hai góc ở $K$ và $M$ bằng nhau, nên tam giác này cân tại $H$."),
        ],
        "> [!meo] Khi đề có nhiều đường thẳng đi qua cùng một điểm như $B$, em hãy thử viết các tích đoạn thẳng từ điểm đó. Hai tích bằng nhau thường cho một cặp tam giác đồng dạng, và cặp tam giác này chuyển được góc từ chỗ khó nhìn sang chỗ dễ nhìn.",
        goi_y="Em hãy đoán xem tam giác cân tại đỉnh nào, rồi gọi $N$ là giao điểm của $BM$ và $DE$. So sánh các tích đoạn thẳng từ $B$ sẽ cho một cặp tam giác đồng dạng.",
    )

    # ── Câu V ───────────────────────────────────────────────────────────────────
    them(
        "Câu V: Chi phí nhỏ nhất",
        "Một công ty thuê một kho xưởng và điều động một số công nhân để hoàn thành đơn hàng 1000 sản phẩm. Chi phí thuê kho là 3 triệu đồng mỗi ngày. Mỗi công nhân làm được 5 sản phẩm một ngày và được thưởng 1 triệu đồng sau khi đơn hàng hoàn thành. Công ty nên điều động bao nhiêu công nhân và thuê kho trong bao nhiêu ngày để tổng chi phí thuê kho và thưởng là nhỏ nhất?",
        [
            ("Đặt ẩn",
             "Gọi $x$ là số công nhân và $y$ là số ngày thuê kho, với $x,y\\in\\mathbb{N}^*$."),
            ("Liên hệ giữa hai ẩn",
             "Mỗi ngày $x$ công nhân làm được $5x$ sản phẩm, nên $5xy=1000$, tức là $xy=200$."),
            ("Viết chi phí theo một ẩn",
             "Tổng chi phí tính bằng triệu đồng là\n\n$$P=x+3y=x+\\frac{600}{x}$$"),
            ("Thử các giá trị có thể",
             "Vì $x,y$ nguyên dương và $xy=200$ nên $x$ là ước của $200$.\n\n"
             "| $x$ | 1 | 2 | 4 | 5 | 8 | 10 | 20 | 25 | 40 | 50 | 100 | 200 |\n"
             "|---|---|---|---|---|---|---|---|---|---|---|---|---|\n"
             "| $P$ | 601 | 302 | 154 | 125 | 83 | 70 | 50 | 49 | 55 | 62 | 106 | 203 |"),
            ("Kết luận",
             "Giá trị nhỏ nhất của $P$ là $49$ triệu đồng, đạt được khi $x=25$ và $y=8$.\n\nVậy công ty nên điều động $25$ công nhân và thuê kho trong $8$ ngày."),
        ],
        ":::Cách lập luận không cần bảng\n"
        "Với mọi số nguyên $x$, hai số $x-24$ và $x-25$ là hai số nguyên liên tiếp nên $(x-24)(x-25)\\geq 0$. Khai triển ta có $x^2+600\\geq 49x$, và chia hai vế cho $x>0$ được $x+\\dfrac{600}{x}\\geq 49$. Dấu bằng xảy ra khi $x=24$ hoặc $x=25$. Tuy nhiên $x=24$ cho $y$ không nguyên, nên chỉ có $x=25$ là thoả mãn.\n"
        ":::",
        goi_y="Em hãy biểu diễn tổng chi phí theo một ẩn duy nhất. Lưu ý rằng số công nhân và số ngày đều là số nguyên dương, nên số giá trị cần thử không nhiều.",
    )

    return {
        "title": "Đề Hà Nội năm 2026",
        "durationMin": 120,
        "description": "Đề Toán vào lớp 10 của Hà Nội, thi ngày 31/5/2026. Em tự làm từng câu trên slide cùng giảng viên, kéo hình để dự đoán, rồi đọc lại lời giải chi tiết ở phần dưới.",
        "look": {"palette": "limio", "font": "modern"},
        "embeds": [{"url": f"/decks/{deck_id}", "height": 720, "atStart": True}],
        "body": (
            "Phần dưới đây là lời giải chi tiết để em đọc lại sau khi học cùng giảng viên. Mỗi ý có đề bài ở đầu mục, và những ý khó có gợi ý được gập lại. Em bấm **Bước tiếp** để xem từng dòng và dừng ở dòng đầu tiên khác với bài của mình, vì đó là chỗ cần học.\n\n"
            f"> [!ghi-nho] Đề bài trong bài học được diễn đạt lại ngắn gọn và giữ nguyên số liệu; lời giải do Limio soạn. Nếu muốn luyện như thi thật, em hãy tính giờ và làm theo ảnh đề gốc đăng trên [báo Lao Động]({NGUON})."
        ),
        "sections": muc,
        "summary": [
            "Khi đề không cho biến nguyên, em chặn biểu thức giữa hai số rồi thử từng số nguyên, thay vì xét ước số.",
            "Trong bài toán thực tế, chữ “ít nhất” yêu cầu làm tròn lên, và em cần đổi đơn vị trước khi tính.",
            "Khi tích hai nghiệm bằng 1, phép chia cho một nghiệm trở thành phép nhân với nghiệm kia.",
            "Ở bài hình nhiều ý, kết quả của ý trước thường là chìa khoá của ý sau: ý b cho HA = HM, và ý c dùng lại điều đó.",
        ],
        "lecture": lecture,
    }


# ── Câu luyện chờ chuyển vào các bài dạng ở đợt soạn sau. Câu về biểu thức nguyên đã chuyển sang dang_bieu_thuc_nguyen.py ──
CAU_CHO_CAC_DANG = [
    {
        "key": "hn26.tan-so", "type": "fill_in", "points": 1,
        "prompt": "Một bảng tần số ghép nhóm có cỡ mẫu $40$, nhóm $[20;25)$ có tần số $10$. Tần số tương đối của nhóm này bằng bao nhiêu phần trăm? Điền một số.",
        "explanation": "Tần số tương đối bằng tần số chia cỡ mẫu: $\\dfrac{10}{40}\\cdot 100\\%=25\\%$.",
        "answers": ["25", "25%"],
    },
    {
        "key": "hn26.xac-suat", "type": "mcq", "points": 1,
        "prompt": "Một hộp có 8 tấm thẻ cùng loại ghi các số từ $1$ đến $8$. Lấy ngẫu nhiên một thẻ. Xác suất để số trên thẻ chia hết cho $3$ là:",
        "explanation": "Các kết quả thuận lợi là $3$ và $6$, nên xác suất bằng $\\dfrac{2}{8}=\\dfrac{1}{4}$.",
        "options": [
            {"label": "$\\dfrac{3}{8}$", "isCorrect": False},
            {"label": "$\\dfrac{1}{4}$", "isCorrect": True},
            {"label": "$\\dfrac{1}{3}$", "isCorrect": False},
            {"label": "$\\dfrac{2}{3}$", "isCorrect": False},
        ],
    },
    {
        "key": "hn26.rut-gon", "type": "mcq", "points": 1, "workOnPaper": True,
        "prompt": "Với $x\\geq 0,\\ x\\neq 4$, rút gọn $B=\\dfrac{2}{\\sqrt{x}-2}+\\dfrac{x-4\\sqrt{x}-4}{x-4}$ được:",
        "explanation": "Mẫu chung là $x-4=(\\sqrt{x}-2)(\\sqrt{x}+2)$. Tử sau khi quy đồng là $2\\sqrt{x}+4+x-4\\sqrt{x}-4=x-2\\sqrt{x}=\\sqrt{x}(\\sqrt{x}-2)$, nên $B=\\dfrac{\\sqrt{x}}{\\sqrt{x}+2}$.",
        "options": [
            {"label": "$\\dfrac{\\sqrt{x}}{\\sqrt{x}-2}$", "isCorrect": False},
            {"label": "$\\dfrac{\\sqrt{x}-2}{\\sqrt{x}+2}$", "isCorrect": False},
            {"label": "$\\dfrac{\\sqrt{x}}{\\sqrt{x}+2}$", "isCorrect": True},
            {"label": "$\\dfrac{1}{\\sqrt{x}+2}$", "isCorrect": False},
        ],
    },
    {
        "key": "hn26.nang-suat", "type": "fill_in", "points": 1, "workOnPaper": True,
        "prompt": "Một xưởng dự định mỗi ngày làm một số sản phẩm như nhau. Trong 4 ngày đầu, xưởng làm đúng dự định. Trong 6 ngày sau, mỗi ngày xưởng làm nhiều hơn 3 sản phẩm so với dự định. Sau 10 ngày, xưởng làm được 198 sản phẩm. Theo dự định, mỗi ngày xưởng làm bao nhiêu sản phẩm? Điền một số.",
        "explanation": "$4x+6(x+3)=198$ nên $10x+18=198$, suy ra $x=18$. Thử lại: $72+126=198$.",
        "answers": ["18"],
    },
    {
        "key": "hn26.viete", "type": "mcq", "points": 2, "workOnPaper": True,
        "prompt": "Phương trình $x^2-4x+1=0$ có hai nghiệm phân biệt $x_1,x_2$. Giá trị của $Q=\\dfrac{x_2}{x_1}+\\dfrac{x_1}{x_2}$ là:",
        "explanation": "Ta có $x_1+x_2=4$ và $x_1x_2=1$, nên $Q=x_2^2+x_1^2=(x_1+x_2)^2-2x_1x_2=16-2=14$.",
        "options": [
            {"label": "$14$", "isCorrect": True},
            {"label": "$16$", "isCorrect": False, "misconception": "giaide.tong-binh-phuong"},
            {"label": "$18$", "isCorrect": False, "misconception": "giaide.tong-binh-phuong"},
            {"label": "$4$", "isCorrect": False},
        ],
    },
    {
        "key": "hn26.xo-nuoc", "type": "mcq", "points": 2, "workOnPaper": True,
        "prompt": "Một xô hình trụ có bán kính đáy $10$ cm, chiều cao $20$ cm (lấy $\\pi=3{,}14$). Mỗi lần người ta múc lượng nước bằng $75\\%$ thể tích xô để đổ vào một bể $100$ lít ban đầu không có nước. Cần ít nhất bao nhiêu xô để đổ đầy bể?",
        "explanation": "Thể tích xô là $3{,}14\\cdot 10^2\\cdot 20=6280$ cm³, mỗi lần múc $4710$ cm³ $=4{,}71$ lít. Ta có $100:4{,}71\\approx 21{,}23$, và phải làm tròn lên nên cần $22$ xô.",
        "options": [
            {"label": "$16$ xô", "isCorrect": False, "misconception": "giaide.quen-ti-le"},
            {"label": "$21$ xô", "isCorrect": False, "misconception": "giaide.lam-tron-xuong"},
            {"label": "$22$ xô", "isCorrect": True},
            {"label": "$25$ xô", "isCorrect": False},
        ],
    },
    {
        "key": "hn26.duong-kinh", "type": "mcq", "points": 1,
        "prompt": "Tam giác $ABC$ vuông tại $A$, điểm $H$ thuộc cạnh $AB$, và $HD\\perp BC$ tại $D$. Bốn điểm $A,H,D,C$ cùng thuộc đường tròn có đường kính là đoạn nào?",
        "explanation": "$A$ và $D$ cùng nhìn đoạn $HC$ dưới một góc vuông, vì $\\widehat{HAC}=\\widehat{HDC}=90^\\circ$. Vậy đường kính là $HC$.",
        "options": [
            {"label": "$AC$", "isCorrect": False},
            {"label": "$BC$", "isCorrect": False},
            {"label": "$HD$", "isCorrect": False},
            {"label": "$HC$", "isCorrect": True},
        ],
    },
    {
        "key": "hn26.toi-uu", "type": "fill_in", "points": 2, "workOnPaper": True,
        "prompt": "Một đơn hàng có 600 sản phẩm. Mỗi công nhân làm được 3 sản phẩm một ngày và được thưởng 1 triệu đồng khi xong việc. Tiền thuê kho là 2 triệu đồng một ngày. Số công nhân và số ngày đều là số nguyên dương. Cần bao nhiêu công nhân để tổng chi phí nhỏ nhất? Điền một số.",
        "explanation": "$3xy=600$ nên $xy=200$. Chi phí là $P=x+2y=x+\\dfrac{400}{x}$. Thử các ước của $200$, giá trị nhỏ nhất là $P=40$ khi $x=20$ và $y=10$.",
        "answers": ["20"],
    },
]

LOI_TU_DUY = [
    ("giaide.uoc-khi-x-khong-nguyen", "Xét ước số khi biến không nhất thiết nguyên",
     "Coi mẫu của biểu thức là số nguyên nên chỉ xét các ước của tử, trong khi đề không cho x nguyên. Mẫu có thể là phân số mà biểu thức vẫn nguyên, vì vậy cách này bỏ sót nghiệm."),
    ("giaide.quen-dau-mut", "Sai ở đầu mút khi chặn biểu thức",
     "Dùng nhầm dấu lớn hơn hẳn và dấu lớn hơn hoặc bằng. Với x ≥ 0, giá trị x = 0 được phép; với x > 0 thì không. Chặn sai dấu sẽ làm thừa hoặc mất giá trị ở đầu mút."),
    ("giaide.tong-binh-phuong", "Tính sai tổng bình phương hai nghiệm",
     "Viết x₁² + x₂² = (x₁ + x₂)², bỏ quên hai lần tích, hoặc cộng thêm hai lần tích thay vì trừ đi."),
    ("giaide.lam-tron-xuong", "Làm tròn xuống trong bài toán ít nhất",
     "Dùng quy tắc làm tròn thông thường cho số lần đổ nước. Khi đề hỏi cần ít nhất bao nhiêu lần để đủ, phần lẻ vẫn cần thêm một lần nữa."),
    ("giaide.quen-ti-le", "Bỏ qua tỉ lệ phần trăm của đề",
     "Lấy cả thể tích xô làm lượng nước mỗi lần, quên rằng đề chỉ cho múc một phần trăm nào đó của thể tích."),
]

PHAN_HOI = [
    ("giaide.uoc-khi-x-khong-nguyen", "Đề không cho x là số nguyên, nên √x + 1 có thể là phân số. Với x = 1/4 thì √x + 1 = 3/2, không phải ước của 3 mà P vẫn bằng −1. Em hãy chặn P giữa hai số rồi thử từng số nguyên trong khoảng đó.", 10),
    ("giaide.quen-dau-mut", "Em đã bỏ sót một giá trị. Điều kiện ở đây là x ≥ 0, nên x = 0 được phép và √x + 1 có thể bằng 1. Khi đó P = −2 là số nguyên. Em hãy giữ dấu lớn hơn hoặc bằng khi chặn biểu thức.", 10),
    ("giaide.tong-binh-phuong", "Tổng bình phương hai nghiệm được tính bằng x₁² + x₂² = (x₁ + x₂)² − 2x₁x₂, nên có dấu trừ và hệ số 2. Em hãy thử với hai số cụ thể, ví dụ 1 và 2: 1² + 2² = 5, còn (1 + 2)² = 9.", 10),
    ("giaide.lam-tron-xuong", "Đề hỏi ít nhất bao nhiêu xô để đầy bể. Nếu lấy số nhỏ hơn thương thì bể vẫn chưa đầy, vì vậy em phải làm tròn lên dù phần lẻ nhỏ. Em nhân ngược lại để kiểm tra lượng nước có đủ không.", 10),
    ("giaide.quen-ti-le", "Em đã dùng cả thể tích xô, trong khi đề nói mỗi lần chỉ múc 75% thể tích. Em hãy tính lượng nước thực múc trước, rồi mới lấy thể tích bể chia cho lượng đó.", 10),
]


def kiem_so():
    """Tính lại mọi đáp số của đề và phần luyện tập. Sai ở đâu thì dừng, không sinh tệp."""
    from math import sqrt
    # Câu I
    assert 10 + 18 + 14 + 6 + 2 == 50 and Fr(14, 50) == Fr(28, 100)
    # Câu II: B rút gọn đúng, P nguyên đúng tại hai giá trị và không còn số nguyên nào khác trong khoảng.
    A = lambda x: (sqrt(x) - 4) / sqrt(x)
    B = lambda x: 4 / (sqrt(x) - 3) + (x - 7 * sqrt(x) - 12) / (x - 9)
    for x in (0.25, 1, 4, 16, 25, 100):
        assert abs(B(x) - sqrt(x) / (sqrt(x) + 3)) < 1e-9
    assert abs(A(25) - 0.2) < 1e-12 and abs(A(16) * B(16)) < 1e-12 and abs(A(0.25) * B(0.25) + 1) < 1e-12
    # Câu III
    assert 3 * 30 + 7 * 35 == 335 and 15 + 10 == 25 and 8 * 15 + 6 * 10 == 180
    x1, x2 = (3 + sqrt(5)) / 2, (3 - sqrt(5)) / 2
    assert abs((3 * x2 - 1) / x1 + 3 * x1 / x2 - x1 - 18) < 1e-9
    # Câu IV.1
    V = 3.14 * 144 * 25
    assert abs(2 * 3.14 * 12 * 25 - 1884) < 1e-9 and abs(V - 11304) < 1e-9
    lit = 0.8 * V / 1000
    assert abs(lit - 9.0432) < 1e-9 and 16 * lit < 150 <= 17 * lit
    # Câu V
    uoc = [d for d in range(1, 201) if 200 % d == 0]
    P = {d: d + 600 // d for d in uoc}
    assert uoc == [1, 2, 4, 5, 8, 10, 20, 25, 40, 50, 100, 200]
    assert list(P.values()) == [601, 302, 154, 125, 83, 70, 50, 49, 55, 62, 106, 203]
    assert min(P, key=P.get) == 25 and 200 // 25 == 8 and P[25] == 49
    # Luyện tập
    assert Fr(10, 40) == Fr(1, 4) and 4 * 18 + 6 * 21 == 198
    for x in (0, 1, 9, 16):
        assert abs(2 / (sqrt(x) - 2) + (x - 4 * sqrt(x) - 4) / (x - 4) - sqrt(x) / (sqrt(x) + 2)) < 1e-9
    P2 = lambda x: (sqrt(x) - 2) / (sqrt(x) + 1)
    assert P2(0) == -2 and abs(P2(0.25) + 1) < 1e-12 and P2(4) == 0
    a1, a2 = 2 + sqrt(3), 2 - sqrt(3)
    assert abs(a2 / a1 + a1 / a2 - 14) < 1e-9
    v = 3.14 * 100 * 20 * 0.75 / 1000
    assert abs(v - 4.71) < 1e-9 and 21 * v < 100 <= 22 * v
    assert 15 * 6.28 < 100 <= 16 * 6.28  # phương án nhiễu 16 xô: quên 75%
    q = {d: d + 400 // d for d in uoc}
    assert min(q, key=q.get) == 20 and q[20] == 40 and isqrt(400) == 20
    # Mỗi câu trắc nghiệm đúng một đáp án; mã lỗi đều đã khai báo.
    ma = {c for c, _, _ in LOI_TU_DUY}
    for c in CAU_CHO_CAC_DANG:
        if c["type"] == "mcq":
            assert sum(o["isCorrect"] for o in c["options"]) == 1, c["key"]
            for o in c["options"]:
                assert o.get("misconception", next(iter(ma))) in ma, c["key"]
    assert {c for c, _, _ in PHAN_HOI} == ma

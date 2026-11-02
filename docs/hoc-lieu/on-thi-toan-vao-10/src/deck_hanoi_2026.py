"""Bộ slide tương tác của đề Hà Nội 2026, cùng khuôn với khoá Toán 10 (khung /decks, giảng viên ảo).

Mỗi slide khai báo html và các bước lời giảng. Số bước phải bằng số phần hiện dần cộng một, và mọi lời giao việc phải nằm ở cuối một
slide chờ, vì đó là chỗ duy nhất giọng thực sự dừng. `tao_deck()` kiểm tra cả hai điều đó.
Đáp số dùng trong slide được tính lại ở `de_hanoi_2026.kiem_so()` và `kiem_so_deck()`.
"""
import json

from deck_chung import BoSlide, khung_deck, lc, loi_sai

ID = "de-ha-noi-2026"

# ── Hình câu IV.2: dựng đúng theo đề, nên kéo A và H thì các kết luận vẫn giữ nguyên ──────────────────────────────────
VUNG = {"x": [-1.2, 1.2], "y": [-0.12, 1.4]}
NHAN = {"O": [0, 30], "B": [-20, 8], "C": [20, 8], "A": [20, -12], "H": [22, 12], "D": [0, 30], "E": [20, -8],
        "F": [-22, 6], "M": [-22, -8], "K": [-22, 14], "N": [0, -14], "I": [-14, -12]}
DUNG = {
    "O": {"x": 0, "y": 0},
    "B": {"x": -1, "y": 0},
    "C": {"x": 1, "y": 0},
    "A": {"tren": ["O", "B"], "goc": 120},
    "H": {"chia": ["A", "B"], "t": 0.25},
    "D": {"chan": ["H", "B", "C"]},
    "E": {"giao": [["D", "H"], ["A", "C"]]},
    "F": {"giaoTron": [["C", "H"], "O", "B"], "khac": "C"},
    "M": {"giao": [["D", "F"], {"qua": "A", "vuongGoc": ["D", "E"]}]},
    "I": {"giao": [["A", "M"], ["D", "E"]]},
    "K": {"giaoTron": [["B", "M"], "O", "B"], "khac": "B"},
    "N": {"giao": [["B", "M"], ["D", "E"]]},
}
THU_TU = ["O", "B", "C", "A", "H", "D", "E", "F", "M", "I", "K", "N"]
NEN = [["B", "C"], ["A", "B"], {"a": "E", "b": "C"}, {"a": "E", "b": "D"}]
VUONG = [["B", "A", "C"], ["C", "D", "E"]]


def lop(diem="", net=(), tron=(), vuong=()):
    """Những gì được vẽ thêm ở một bước của lời giảng."""
    return {"diem": diem, "net": list(net), "tron": list(tron), "vuong": list(vuong)}


# Hình nền của đề, vẽ một lần ở bước 0.
NEN_DE = lop("OBCAHDE", NEN, [{"tam": "O", "qua": "B"}], VUONG)


def hinh(*cac_lop, keo=False, moTa="Hình câu IV.2", chi="hinh", **them):
    """Một hình của câu IV.2. Lớp thứ k hiện từ bước k của slide, nên hình được vẽ dần đúng theo lời giảng. `keo` cho phép kéo A và H."""
    buoc_diem, net, tron, vuong = {}, [], [], []
    for k, l in enumerate(cac_lop):
        for ten in l["diem"]:
            buoc_diem.setdefault(ten, k)
        for n in l["net"]:
            net.append({"a": n[0], "b": n[1], "buoc": k} if isinstance(n, list) else {**n, "buoc": k})
        tron += [{**c, "buoc": k} for c in l["tron"]]
        vuong += [{"v": v, "buoc": k} for v in l["vuong"]]
    diem = []
    for ten in THU_TU:
        d = {"ten": ten, **DUNG[ten], "nhan": NHAN[ten]}
        if ten in buoc_diem:
            d["buoc"] = buoc_diem[ten]
        else:
            d["an"] = True
        if keo and ten == "A":
            d["keo"] = [97, 140]
        if keo and ten == "H":
            d["keo"] = [0.05, 0.28]
        diem.append(d)
    du_lieu = {"vung": VUNG, "diem": diem, "net": net, "tron": tron, "vuong": vuong, "moTa": moTa, **them}
    return f"""<div class="hinh-dung" data-chi="{chi}" data-du-lieu='{json.dumps(du_lieu, ensure_ascii=False)}'></div>"""


TRU = (
    '<svg viewBox="0 0 420 410" width="420" height="410" data-chi="hinh">'
    '<ellipse cx="190" cy="70" rx="130" ry="34" fill="#4dabf7" fill-opacity=".14" stroke="currentColor" stroke-width="4"></ellipse>'
    '<line x1="60" y1="70" x2="60" y2="340" stroke="currentColor" stroke-width="4"></line>'
    '<line x1="320" y1="70" x2="320" y2="340" stroke="currentColor" stroke-width="4"></line>'
    '<path d="M60 340 A130 34 0 0 0 320 340" fill="none" stroke="currentColor" stroke-width="4"></path>'
    '<path d="M60 340 A130 34 0 0 1 320 340" fill="none" stroke="#868e96" stroke-width="3" stroke-dasharray="9 8"></path>'
    '<line x1="190" y1="70" x2="320" y2="70" stroke="#1c7ed6" stroke-width="5"></line>'
    '<circle cx="190" cy="70" r="6" fill="#1c7ed6"></circle>'
    '<text x="255" y="102" font-size="28" font-weight="700" fill="#1c7ed6" text-anchor="middle">12 cm</text>'
    '<line x1="345" y1="70" x2="345" y2="340" stroke="#e8590c" stroke-width="4"></line>'
    '<text x="340" y="215" font-size="28" font-weight="700" fill="#e8590c" text-anchor="end">25 cm</text>'
    "</svg>"
)

BO = BoSlide("dhn26")
slide = BO.slide


# ── Mở đầu ──────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("01", r"""<section class="bia"><h1>Đề Toán vào 10 Hà Nội 2026</h1><p class="phu-de">Em tự làm từng câu trên slide, rồi cùng thầy đối chiếu từng bước</p></section>""",
      ["Chào em! {{Tx}} là {{gv}}. Hôm nay {{tx}} và em cùng giải đề Toán vào lớp mười của Hà Nội năm hai nghìn không trăm hai mươi sáu. Với mỗi câu, em chuẩn bị giấy bút và tự làm trước. Khi em có đáp số, {{tx}} sẽ cùng em đối chiếu từng bước, và chỉ ra những chỗ dễ mất điểm nhất."],
      ghi_chu="Đề do Sở GDĐT Hà Nội ra ngày 31/5/2026; đề bài trên slide được diễn đạt lại ngắn gọn, giữ nguyên số liệu.")

slide("02", r"""<section class="noi-dung"><h2>Đề có gì, chia thời gian thế nào?</h2><table data-chi="bang"><thead><tr><th>Câu</th><th>Điểm</th><th>Nội dung</th><th>Gợi ý</th></tr></thead><tbody>
<tr><td>I</td><td>1,5</td><td>Thống kê và xác suất</td><td>10 phút</td></tr>
<tr><td>II</td><td>1,5</td><td>Biểu thức chứa căn</td><td>15 phút</td></tr>
<tr><td>III</td><td>2,5</td><td>Bài toán thực tế, hệ thức Viète</td><td>25 phút</td></tr>
<tr><td>IV</td><td>4,0</td><td>Hình trụ, hình học đường tròn</td><td>50 phút</td></tr>
<tr><td>V</td><td>0,5</td><td>Bài toán chi phí nhỏ nhất</td><td>10 phút</td></tr></tbody></table>
<div class="meo hien">Làm chắc các câu dễ trước, và dành 10 phút cuối để soát bài.</div></section>""",
      ["[chỉ: bang] Đề có năm câu, làm trong một trăm hai mươi phút. Trong cột điểm, riêng câu bốn đã chiếm bốn điểm, nên {{tx}} gợi ý dành khoảng năm mươi phút cho câu này.",
       "Câu năm chỉ có nửa điểm, nên đừng sa đà vào nó từ đầu. Nên làm chắc các câu dễ trước, và luôn giữ lại mười phút cuối để soát bài."])

# ── Câu I ───────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("03", r"""<section class="noi-dung"><h2>Câu I: thống kê và xác suất</h2><div class="tabs" data-chi="cau"><div class="tab" data-ten="Ý 1"><p class="phu-de">Chiều cao (cm) của 50 học sinh lớp 6:</p><table><tbody><tr><th>Chiều cao</th><td>\([140;145)\)</td><td>\([145;150)\)</td><td>\([150;155)\)</td><td>\([155;160)\)</td><td>\([160;165)\)</td></tr><tr><th>Số học sinh</th><td>10</td><td>18</td><td>14</td><td>6</td><td>2</td></tr></tbody></table>
<div class="nhap-dap-an" data-loai="so" data-dap-an="28"><p class="cau">Tần số tương đối của nhóm \([150;155)\) bằng bao nhiêu phần trăm?</p><div class="go-y">Tần số tương đối bằng tần số của nhóm chia cho cỡ mẫu.</div>"""
      + loi_sai("14", r"14 là tần số của nhóm. Tần số tương đối phải chia tiếp cho cỡ mẫu \(50\).")
      + loi_sai("0.28|0,28", r"Em tính đúng giá trị rồi, chỉ cần đổi ra phần trăm và nhập số \(28\).")
      + r"""<div class="giai-thich">\(\dfrac{14}{50}\cdot 100\%=28\%\).</div></div></div>
<div class="tab" data-ten="Ý 2"><div class="trac-nghiem"><p class="cau">Hộp có 6 quả bóng cùng loại ghi các số từ \(1\) đến \(6\). Lấy ngẫu nhiên một quả. Xác suất lấy được quả ghi số chẵn là</p>"""
      + lc(r"\(\dfrac{1}{6}\)", phan_hoi="Có tới ba số chẵn là 2, 4 và 6, chứ không phải một kết quả.")
      + lc(r"\(\dfrac{1}{3}\)", phan_hoi="Em đã đếm thiếu một số chẵn. Các số chẵn là 2, 4 và 6.")
      + lc(r"\(\dfrac{1}{2}\)", dung=True)
      + lc(r"\(\dfrac{3}{5}\)", phan_hoi="Mẫu số là số kết quả có thể xảy ra, tức là 6 chứ không phải 5.")
      + r"""<div class="giai-thich">Có \(3\) kết quả thuận lợi trong \(6\) kết quả đồng khả năng, nên \(P=\dfrac{3}{6}=\dfrac{1}{2}\).</div></div></div></div></section>""",
      ["Mình khởi động với câu một. [chỉ: cau] Có hai ý ngắn: ý một tính tần số tương đối, ý hai tính xác suất. Em làm cả hai thẻ. Xong thì em bấm Tiếp tục nhé."],
      cho=True)

# ── Câu II ──────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("04", r"""<section class="hai-cot"><h2>Câu II: biểu thức chứa căn</h2><div class="cot"><div class="dinh-nghia" data-chi="de">Với \(x\gt 0,\ x\neq 9\), cho \[A=\frac{\sqrt{x}-4}{\sqrt{x}},\qquad B=\frac{4}{\sqrt{x}-3}+\frac{x-7\sqrt{x}-12}{x-9}.\]</div><p>Ý 1: tính \(A\) khi \(x=25\).</p></div><div class="cot"><div class="nhap-dap-an" data-loai="so" data-dap-an="1/5|0.2" data-chi="nhap"><p class="cau">Giá trị của \(A\) khi \(x=25\) là bao nhiêu?</p><div class="go-y">Thay \(\sqrt{25}=5\) vào cả tử và mẫu.</div>"""
      + loi_sai("21/25|0.84|0,84", r"Em đã thay \(x=25\) mà quên khai căn. Trong biểu thức là \(\sqrt{x}=5\), không phải \(x\).")
      + r"""<div class="giai-thich">\(x=25\) thoả mãn điều kiện, và \(A=\dfrac{5-4}{5}=\dfrac{1}{5}\).</div></div></div></section>""",
      ["Sang câu hai. [chỉ: de] Đề cho hai biểu thức A và B, với x dương và x khác chín. Ý một rất nhẹ nhàng: tính A khi x bằng hai mươi lăm. [chỉ: nhap] Em nhập đáp số rồi bấm Tiếp tục."],
      cho=True)

slide("05", r"""<section class="noi-dung"><h2>Câu II, ý 2: xếp lại các dòng rút gọn</h2><p class="phu-de">Chứng minh \(B=\dfrac{\sqrt{x}}{\sqrt{x}+3}\). Các dòng lời giải đã bị xáo trộn, em hãy kéo về đúng thứ tự.</p><div class="sap-xep" data-chi="sap-xep"><div class="muc">Mẫu chung: \(x-9=(\sqrt{x}-3)(\sqrt{x}+3)\)</div><div class="muc">Quy đồng: \(B=\dfrac{4(\sqrt{x}+3)+x-7\sqrt{x}-12}{(\sqrt{x}-3)(\sqrt{x}+3)}\)</div><div class="muc">Thu gọn tử: \(x-3\sqrt{x}=\sqrt{x}(\sqrt{x}-3)\)</div><div class="muc">Chia cho \(\sqrt{x}-3\neq 0\): \(B=\dfrac{\sqrt{x}}{\sqrt{x}+3}\)</div></div></section>""",
      ["Ý hai là rút gọn B. Em làm ra giấy trước đã. [chỉ: sap-xep] Sau đó, em kéo các dòng trên màn hình về đúng thứ tự, rồi bấm Tiếp tục nhé."],
      cho=True)

slide("06", r"""<section class="noi-dung"><h2>Câu II, ý 3: lời giải này sai ở đâu?</h2><p class="phu-de">Đặt \(P=A\cdot B=\dfrac{\sqrt{x}-4}{\sqrt{x}+3}\). Tìm \(x\) để \(P\) nguyên. Một bạn giải như sau, em hãy bấm vào dòng sai.</p><div class="tim-loi" data-chi="tim-loi"><div class="dong" data-gt="dong-1">\(P=1-\dfrac{7}{\sqrt{x}+3}\).</div><div class="dong" data-gt="dong-2" data-sai="Đề không cho x nguyên nên √x + 3 có thể là phân số. Lập luận theo ước số chỉ đúng khi √x + 3 là số nguyên.">Để \(P\) nguyên thì \(\sqrt{x}+3\) phải là ước của \(7\).</div><div class="dong" data-gt="dong-3">Vì \(\sqrt{x}+3\gt 3\) nên \(\sqrt{x}+3=7\).</div><div class="dong" data-gt="dong-4">Suy ra \(x=16\), và đó là giá trị duy nhất.</div></div></section>""",
      ["Bây giờ là ý khó nhất của câu hai. Đề hỏi: tìm x để P là số nguyên. [chỉ: tim-loi] Đây là lời giải mà rất nhiều bạn sẽ viết, và nó bị mất điểm. Em đọc thật kỹ đề và từng dòng, bấm vào dòng sai, rồi bấm Tiếp tục."],
      cho=True)

slide("07", r"""<section class="noi-dung"><h2>Câu II, ý 3: chặn \(P\) rồi thử từng số nguyên</h2><ul class="hien-dan"><li>Vì \(x\gt 0\) nên \(\sqrt{x}+3\gt 3\), do đó \(0\lt\dfrac{7}{\sqrt{x}+3}\lt\dfrac{7}{3}\).</li><li>Suy ra \(-\dfrac{4}{3}\lt P\lt 1\), nên \(P\) nguyên chỉ có thể là \(-1\) hoặc \(0\).</li><li>\(P=0\) khi \(\sqrt{x}+3=7\), tức là \(x=16\).</li><li>\(P=-1\) khi \(\sqrt{x}+3=\dfrac{7}{2}\), tức là \(x=\dfrac{1}{4}\). Vậy \(x\in\left\{16;\dfrac{1}{4}\right\}\).</li></ul><div class="canh-bao">Với \(x=\dfrac{1}{4}\), mẫu \(\sqrt{x}+3\) không nguyên mà \(P\) vẫn bằng \(-1\). Vì vậy không thể chỉ xét ước số.</div></section>""",
      ["Dòng sai là dòng thứ hai: đề không hề nói x là số nguyên, nên căn x cộng ba có thể là một phân số. Cách làm đúng là chặn P giữa hai số.",
       "Vì x dương nên căn x cộng ba lớn hơn ba. Do đó phân số bảy trên căn x cộng ba nằm giữa không và bảy phần ba.",
       "Suy ra P nằm giữa âm bốn phần ba và một. Trong khoảng này chỉ có hai số nguyên là âm một và không.",
       "P bằng không khi căn x cộng ba bằng bảy, tức là x bằng mười sáu.",
       "P bằng âm một khi căn x cộng ba bằng bảy phần hai, tức là x bằng một phần tư. Đây chính là nghiệm mà lời giải kia đánh mất."])

# ── Câu III ─────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("08", r"""<section class="noi-dung"><h2>Câu III: hai bài toán thực tế</h2><div class="tabs" data-chi="cau"><div class="tab" data-ten="Ý 1"><p>Một tổ may lập kế hoạch mỗi ngày may số áo như nhau. Ba ngày đầu tổ may đúng kế hoạch; bảy ngày sau mỗi ngày may nhiều hơn \(5\) áo. Sau \(10\) ngày tổ may được \(335\) áo.</p><div class="nhap-dap-an" data-loai="so" data-dap-an="30"><p class="cau">Theo kế hoạch, mỗi ngày tổ may bao nhiêu áo?</p><div class="go-y">Gọi \(x\) là số áo mỗi ngày theo kế hoạch. Bảy ngày sau mỗi ngày may \(x+5\) áo.</div>"""
      + loi_sai("33", r"Em đã viết \(7x+5\), tức là cả bảy ngày chỉ nhiều hơn \(5\) áo. Thực ra là nhiều hơn \(5\) áo <b>mỗi ngày</b>: \(7(x+5)\).")
      + r"""<div class="giai-thich">\(3x+7(x+5)=335\) nên \(x=30\).</div></div></div>
<div class="tab" data-ten="Ý 2"><p>Một người mua \(25\) bông hoa gồm hoa hồng và hoa cúc, hết \(180\) nghìn đồng. Hoa hồng giá \(8\) nghìn đồng một bông, hoa cúc giá \(6\) nghìn đồng một bông.</p><div class="nhap-dap-an" data-loai="so" data-dap-an="15"><p class="cau">Người đó mua bao nhiêu bông hoa hồng?</p><div class="go-y">Gọi \(x\), \(y\) là số bông mỗi loại rồi lập hai phương trình: một về số bông, một về số tiền.</div>"""
      + loi_sai("10", "10 là số bông hoa cúc. Em đọc lại xem đề hỏi loại hoa nào nhé.")
      + r"""<div class="giai-thich">\(x+y=25\) và \(8x+6y=180\) nên \(x=15,\ y=10\).</div></div></div></div></section>""",
      ["Câu ba gồm hai bài toán thực tế. [chỉ: cau] Em làm lần lượt hai thẻ. Với thẻ thứ nhất, em đọc kỹ cụm từ nhiều hơn năm áo mỗi ngày. Làm xong cả hai, em bấm Tiếp tục."],
      cho=True)

slide("09", r"""<section class="hai-cot"><h2>Câu III: đặt ẩn đúng là xong một nửa</h2><div class="cot"><div class="vi-du" data-chi="ao"><b>Ý 1.</b> Gọi \(x\) là số áo mỗi ngày theo kế hoạch, \(x\in\mathbb{N}^*\). \[3x+7(x+5)=335\] \[10x+35=335\;\Rightarrow\;x=30\] Thử lại: \(90+245=335\).</div></div><div class="cot"><div class="vi-du hien" data-chi="hoa"><b>Ý 2.</b> Gọi \(x\), \(y\) là số bông hoa hồng và hoa cúc. \[\begin{cases}x+y=25\\ 8x+6y=180\end{cases}\] Thay \(y=25-x\) ta được \(2x=30\), nên \(x=15,\ y=10\).</div></div></section>""",
      ["[chỉ: ao] Ý một, em đặt x là số áo mỗi ngày theo kế hoạch, vì đó chính là đại lượng đề hỏi. Ba ngày đầu may ba x áo, bảy ngày sau may bảy nhân x cộng năm áo. Giải ra x bằng ba mươi, và thử lại đúng ba trăm ba mươi lăm áo.",
       "[chỉ: hoa] Ý hai có hai đại lượng nên em dùng hai ẩn. Một phương trình về số bông, một phương trình về số tiền. Giải ra mười lăm bông hoa hồng và mười bông hoa cúc."])

slide("10", r"""<section class="hai-cot"><h2>Câu III, ý 3: hệ thức Viète</h2><div class="cot"><div class="dinh-nghia" data-chi="de">Phương trình \(x^2-3x+1=0\) có hai nghiệm phân biệt \(x_1,x_2\). Tính \[Q=\frac{3x_2-1}{x_1}+\frac{3x_1}{x_2}-x_1.\]</div></div><div class="cot"><div class="nhap-dap-an" data-loai="so" data-dap-an="18" data-chi="nhap"><p class="cau">Giá trị của \(Q\) là bao nhiêu?</p><div class="go-y">Trước khi quy đồng, em hãy tính tích \(x_1x_2\).</div><div class="go-y">Vì \(x_1x_2=1\) nên \(\dfrac{1}{x_1}=x_2\) và \(\dfrac{1}{x_2}=x_1\).</div>"""
      + loi_sai("24", r"Em đã lấy \(x_1^2+x_2^2=9\). Đúng phải là \((x_1+x_2)^2-2x_1x_2=9-2=7\).")
      + loi_sai("21", r"Em tính đúng \(3(x_1^2+x_2^2)=21\) rồi, nhưng còn phải trừ đi \(x_1+x_2=3\).")
      + r"""<div class="giai-thich">\(Q=3(x_1^2+x_2^2)-(x_1+x_2)=3\cdot 7-3=18\).</div></div></div></section>""",
      ["Ý ba là hệ thức Viète. [chỉ: de] Biểu thức Q trông khá rắc rối và không đối xứng. [chỉ: nhap] Em tính ra giấy, cần thì bấm gợi ý. Có đáp số rồi, em nhập vào và bấm Tiếp tục."],
      cho=True)

slide("11", r"""<section class="noi-dung"><h2>Câu III, ý 3: tích bằng một giúp bỏ mẫu số</h2><p class="phu-de">Theo hệ thức Viète: \(x_1+x_2=3\) và \(x_1x_2=1\).</p><ul class="hien-dan"><li>Vì \(x_1x_2=1\) nên \(\dfrac{1}{x_1}=x_2\) và \(\dfrac{1}{x_2}=x_1\).</li><li>Do đó \(Q=(3x_2-1)x_2+3x_1\cdot x_1-x_1=3(x_1^2+x_2^2)-(x_1+x_2)\).</li><li>Mà \(x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=9-2=7\), nên \(Q=3\cdot 7-3=18\).</li></ul></section>""",
      ["Đầu tiên em viết hệ thức Viète: tổng hai nghiệm bằng ba, tích hai nghiệm bằng một.",
       "Tích bằng một là chìa khoá. Nó cho biết chia cho x một cũng chính là nhân với x hai, và chia cho x hai cũng là nhân với x một.",
       "Nhờ vậy mọi mẫu số biến mất. Gom lại, Q bằng ba nhân tổng bình phương, trừ đi tổng hai nghiệm. Biểu thức tưởng không đối xứng hoá ra lại đối xứng.",
       "Tổng bình phương bằng chín trừ hai, tức là bảy. Vậy Q bằng hai mươi mốt trừ ba, bằng mười tám."])

# ── Câu IV.1 ────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("12", r"""<section class="hai-cot"><h2>Câu IV, ý 1: xô nước hình trụ</h2><div class="cot">""" + TRU + r"""<p class="phu-de">Lấy \(\pi=3{,}14\), coi độ dày của xô không đáng kể.</p></div><div class="cot"><div class="tabs" data-chi="cau"><div class="tab" data-ten="a"><div class="nhap-dap-an" data-loai="so" data-dap-an="1884"><p class="cau">Diện tích xung quanh của xô bằng bao nhiêu cm²?</p><div class="go-y">\(S_{xq}=2\pi rh\).</div>"""
      + loi_sai("942", r"Em đã thiếu số \(2\) trong công thức \(S_{xq}=2\pi rh\).")
      + r"""<div class="giai-thich">\(2\cdot 3{,}14\cdot 12\cdot 25=1884\) cm².</div></div></div><div class="tab" data-ten="b"><p>Mỗi lần múc \(80\%\) thể tích xô để đổ vào một bể \(150\) lít đang rỗng.</p><div class="nhap-dap-an" data-loai="so" data-dap-an="17"><p class="cau">Cần ít nhất bao nhiêu xô để đầy bể?</p><div class="go-y">Tính thể tích xô, lấy \(80\%\) và đổi ra lít (\(1\) lít \(=1000\) cm³).</div>"""
      + loi_sai("16", "Với 16 xô, bể mới có khoảng 144,7 lít nên chưa đầy. Chữ “ít nhất” yêu cầu làm tròn lên.")
      + loi_sai("14|13", r"Em đã dùng cả thể tích xô. Mỗi lần chỉ múc \(80\%\) thể tích thôi.")
      + r"""<div class="giai-thich">Mỗi lần múc \(9{,}0432\) lít, và \(150:9{,}0432\approx 16{,}59\), nên cần \(17\) xô.</div></div></div></div></div></section>""",
      ["Sang câu bốn, phần nhiều điểm nhất của đề. [chỉ: hinh] Ý một là một chiếc xô hình trụ có bán kính mười hai xăng ti mét, cao hai mươi lăm xăng ti mét. [chỉ: cau] Em làm hai thẻ a và b. Xong thì em bấm Tiếp tục."],
      cho=True)

slide("13", r"""<section class="noi-dung"><h2>Câu IV, ý 1b: chữ “ít nhất” nghĩa là làm tròn lên</h2><ul class="hien-dan"><li>Thể tích xô: \(V=\pi r^2h=3{,}14\cdot 12^2\cdot 25=11304\) cm³.</li><li>Mỗi lần múc: \(80\%\cdot 11304=9043{,}2\) cm³, tức là \(9{,}0432\) lít.</li><li>Số lần: \(150:9{,}0432\approx 16{,}59\), nên cần ít nhất \(17\) xô.</li></ul><div class="meo">Kiểm tra bằng hai số liền nhau: \(16\) xô được khoảng \(144{,}7\) lít, còn \(17\) xô được khoảng \(153{,}7\) lít.</div></section>""",
      ["Mình đi lại ý b nhé. Có ba việc phải làm theo thứ tự.",
       "Việc một, tính thể tích xô: pi r bình phương h, bằng mười một nghìn ba trăm linh bốn xăng ti mét khối.",
       "Việc hai, mỗi lần chỉ múc tám mươi phần trăm, tức là khoảng chín phẩy không bốn lít. Cần đổi đơn vị trước khi chia.",
       "Việc ba, lấy một trăm năm mươi chia cho lượng đó, được khoảng mười sáu phẩy năm chín. Mười sáu xô thì bể chưa đầy, nên đáp số là mười bảy xô. Đây là chỗ làm tròn thông thường sẽ sai nếu phần lẻ nhỏ."])

# ── Câu IV.2 ────────────────────────────────────────────────────────────────────────────────────────────────────────
# Mọi yêu cầu tự làm là một slide chờ (`cho=True`): giọng đọc xong thì dừng hẳn cho tới khi học sinh bấm Tiếp tục. Slide lời giải theo sau
# vẽ hình dần theo từng bước lời giảng, nên phần nào đang được nói tới thì phần đó mới hiện ra.
slide("14", r"""<section class="hai-cot"><h2>Câu IV, ý 2: dựng hình theo đề</h2><div class="cot" data-chi="de"><p>Vẽ đường tròn \((O)\) đường kính \(BC\).</p><p class="hien">Lấy \(A\) trên đường tròn sao cho \(AB\lt AC\): tam giác \(ABC\) vuông tại \(A\).</p><p class="hien">Lấy \(H\) thuộc đoạn \(AB\) sao cho \(HB\gt HA\).</p><p class="hien">Đường thẳng qua \(H\) vuông góc với \(BC\) cắt \(BC\) tại \(D\), cắt đường thẳng \(AC\) tại \(E\).</p><div class="meo hien">Em vẽ lại hình ra giấy, rồi kéo \(A\) và \(H\) trên hình để xem các điểm đổi theo.</div></div><div class="cot">"""
      + hinh(lop("OBC", [["B", "C"]], [{"tam": "O", "qua": "B"}]),
             lop("A", [["A", "B"], ["A", "C"]], vuong=[["B", "A", "C"]]),
             lop("H"),
             lop("DE", [["E", "D"], ["E", "A"]], vuong=[["C", "D", "E"]]),
             keo=True, moTa="Hình câu IV.2 vẽ dần theo đề, kéo được điểm A và H") + r"""</div></section>""",
      ["Đến bài hình, phần nhiều điểm nhất của đề. Mình dựng hình theo đúng thứ tự của đề nhé. [chỉ: hinh] Đầu tiên là đường tròn tâm O, đường kính B C.",
       "Tiếp theo, lấy điểm A trên đường tròn, gần B hơn để A B nhỏ hơn A C. Vì B C là đường kính nên tam giác A B C vuông tại A.",
       "Lấy điểm H trên đoạn A B, sao cho H gần A hơn gần B.",
       "Cuối cùng, kẻ đường thẳng qua H vuông góc với B C. Nó cắt B C tại D, và cắt đường thẳng A C tại E.",
       "Bây giờ em vẽ lại hình ra giấy của mình, rồi kéo thử điểm A và điểm H trên màn hình. Xong thì em bấm Tiếp tục nhé."],
      cho=True)

slide("15", r"""<section class="hai-cot"><h2>Câu IV, ý 2a: em tự làm trước</h2><div class="cot">"""
      + hinh(NEN_DE, moTa="Hình câu IV.2 với các điểm A, H, D, E")
      + r"""</div><div class="cot"><div class="trac-nghiem" data-chi="cau"><p class="cau">\(A,H,D,C\) cùng thuộc đường tròn có đường kính là đoạn nào?</p>"""
      + lc(r"\(AC\)", phan_hoi="Điểm H không nhìn đoạn AC dưới một góc vuông, nên AC không phải đường kính.")
      + lc(r"\(HC\)", dung=True)
      + lc(r"\(BC\)", phan_hoi="Đường tròn đường kính BC là đường tròn (O), và H không nằm trên đường tròn đó.")
      + lc(r"\(HD\)", phan_hoi="Điểm A và C không nhìn đoạn HD dưới một góc vuông.")
      + r"""<div class="giai-thich">\(A\) và \(D\) cùng nhìn đoạn \(HC\) dưới một góc vuông.</div></div></div></section>""",
      ["Ý a yêu cầu chứng minh bốn điểm A, H, D, C cùng thuộc một đường tròn. Muốn vậy, em tìm một đoạn thẳng mà hai điểm còn lại cùng nhìn dưới góc vuông. [chỉ: cau] Em nhìn hình, chọn đáp án, rồi bấm Tiếp tục nhé."],
      cho=True)

slide("16", r"""<section class="hai-cot"><h2>Câu IV, ý 2a: bốn điểm cùng thuộc đường tròn</h2><div class="cot">"""
      + hinh(NEN_DE,
             lop("", [{"a": "H", "b": "C", "lop": "cam"}]),
             lop(),
             lop("", tron=[{"duongKinh": ["H", "C"], "lop": "cam", "dut": True}]),
             moTa="Đường tròn đường kính HC đi qua A và D")
      + r"""</div><div class="cot"><p>Ta xét đoạn \(HC\).</p><ul class="hien-dan"><li>\(H\) thuộc \(AB\) nên \(\widehat{HAC}=90^\circ\).</li><li>\(HD\perp BC\) nên \(\widehat{HDC}=90^\circ\).</li><li>\(A\) và \(D\) cùng nhìn \(HC\) dưới một góc vuông, nên \(A,H,D,C\) cùng thuộc đường tròn đường kính \(HC\).</li></ul></div></section>""",
      ["Mình đối chiếu nhé. Đoạn cần tìm là H C.",
       "[chỉ: hinh] Mình kẻ đoạn H C. Điểm H nằm trên A B, nên góc H A C là góc vuông của tam giác đã cho.",
       "Vì H D vuông góc với B C, nên góc H D C cũng bằng chín mươi độ.",
       "A và D cùng nhìn H C dưới một góc vuông, nên cả hai nằm trên đường tròn đường kính H C. Đây là đường tròn nét đứt vừa hiện ra, và nó sẽ được dùng lại ở ý b."])

slide("17", r"""<section class="hai-cot"><h2>Câu IV, ý 2b: em tự làm trước</h2><div class="cot">"""
      + hinh(NEN_DE, moTa="Hình câu IV.2 với các điểm A, H, D, E")
      + r"""</div><div class="cot"><div class="dinh-nghia" data-chi="de">Chứng minh \(AE\cdot BC=EH\cdot AB\).</div><div class="bam-de-xem" data-nhan="Xem gợi ý">Em đổi đẳng thức tích thành tỉ lệ, rồi tìm hai tam giác chứa bốn đoạn thẳng đó.</div></div></section>""",
      ["Ý b có hai phần. [chỉ: de] Phần đầu là chứng minh một đẳng thức tích. Em làm ra giấy, khi nào cần thì mở gợi ý. Có lời giải rồi, em bấm Tiếp tục nhé."],
      cho=True)

slide("18", r"""<section class="hai-cot"><h2>Câu IV, ý 2b: \(AE\cdot BC=EH\cdot AB\)</h2><div class="cot">"""
      + hinh(NEN_DE,
             lop("", [{"a": "E", "b": "H", "lop": "cam"}, {"a": "A", "b": "E", "lop": "cam"}, {"a": "A", "b": "H", "lop": "cam"}]),
             lop(),
             moTa="Hai tam giác AEH và ABC")
      + r"""</div><div class="cot"><p>Đẳng thức cần chứng minh tương đương \(\dfrac{AE}{AB}=\dfrac{EH}{BC}\), nên ta xét \(\triangle AEH\) và \(\triangle ABC\).</p><ul class="hien-dan"><li>Hai tam giác có \(\widehat{EAH}=\widehat{BAC}=90^\circ\); và \(\widehat{AEH}=\widehat{ABC}\) vì cùng phụ với \(\widehat{ACB}\).</li><li>Vậy \(\triangle AEH\sim\triangle ABC\) (g.g), nên \(AE\cdot BC=EH\cdot AB\).</li></ul></div></section>""",
      ["Mình đối chiếu nhé. Đổi đẳng thức tích thành tỉ lệ: A E trên A B bằng E H trên B C. Bốn đoạn này nằm trong hai tam giác A E H và A B C.",
       "[chỉ: hinh] Tam giác A E H được tô màu trên hình. Hai tam giác cùng có một góc vuông tại A. Ngoài ra, góc A E H và góc A B C cùng phụ với góc A C B, nên chúng bằng nhau.",
       "Vậy hai tam giác đồng dạng theo trường hợp góc góc. Từ tỉ lệ cạnh, nhân chéo là được đẳng thức cần chứng minh."])

slide("19", r"""<section class="hai-cot"><h2>Câu IV, ý 2b: em tự làm trước</h2><div class="cot">"""
      + hinh(NEN_DE, lop("FM", [{"a": "C", "b": "F", "lop": "nhat"}, {"a": "D", "b": "M", "lop": "nhat"}, {"a": "A", "b": "M", "lop": "nhat"}]), moTa="Hình câu IV.2 có thêm điểm F và M")
      + r"""</div><div class="cot"><p class="hien">\(CH\) cắt \((O)\) tại điểm thứ hai \(F\). Đường thẳng qua \(A\) vuông góc với \(ED\) cắt \(DF\) tại \(M\).</p><div class="dinh-nghia" data-chi="de">Chứng minh \(\widehat{EMH}=90^\circ\).</div><div class="bam-de-xem" data-nhan="Xem gợi ý">Em thử chứng minh \(DH\) là phân giác của \(\widehat{ADM}\), rồi xem \(M\) có quan hệ gì với \(A\).</div></div></section>""",
      ["Phần hai cần nhiều ý tưởng hơn, và hình sẽ có thêm hai điểm mới.",
       "[chỉ: hinh] Đường thẳng C H cắt đường tròn tại điểm thứ hai là F. Đường thẳng qua A vuông góc với E D cắt D F tại M. [chỉ: de] Đề yêu cầu chứng minh góc E M H vuông. Em làm ra giấy, cần thì mở gợi ý. Xong thì em bấm Tiếp tục nhé."],
      cho=True)

slide("20", r"""<section class="hai-cot"><h2>Câu IV, ý 2b: \(\widehat{EMH}=90^\circ\)</h2><div class="cot">"""
      + hinh(NEN_DE,
             lop("F", [{"a": "H", "b": "F", "lop": "nhat"}, {"a": "H", "b": "C", "lop": "nhat"}, {"a": "B", "b": "F", "lop": "mau"}]),
             lop("M", [{"a": "A", "b": "D", "lop": "la"}, {"a": "D", "b": "M", "lop": "la"}]),
             lop("I", [{"a": "A", "b": "M", "lop": "mau"}]),
             lop("", [{"a": "M", "b": "E", "lop": "cam"}, {"a": "M", "b": "H", "lop": "cam"}], vuong=[["E", "M", "H"]]),
             moTa="DH là phân giác góc ADM, M đối xứng với A qua DE")
      + r"""</div><div class="cot"><p>Ta tìm mối liên hệ giữa \(M\) và \(A\).</p><ul class="hien-dan"><li>\(\widehat{BFH}=\widehat{BDH}=90^\circ\) nên \(B,D,H,F\) thuộc đường tròn đường kính \(BH\).</li><li>\(\widehat{HDF}=\widehat{HBF}=\widehat{ACH}=\widehat{ADH}\), nên \(DH\) là phân giác của \(\widehat{ADM}\).</li><li>\(\triangle ADM\) có \(DI\) vừa là đường cao vừa là phân giác, nên \(DE\) là trung trực của \(AM\).</li><li>Do đó \(HM=HA\), \(EM=EA\), nên \(\triangle EMH=\triangle EAH\) (c.c.c) và \(\widehat{EMH}=90^\circ\).</li></ul></div></section>""",
      ["Mình đối chiếu nhé. Ý tưởng chính là tìm mối liên hệ giữa điểm M và điểm A.",
       "[chỉ: hinh] Mình kẻ B F. Điểm F nằm trên đường tròn đường kính B C nên góc B F C vuông. Kết hợp với góc B D H vuông, bốn điểm B, D, H, F cùng thuộc đường tròn đường kính B H.",
       "Mình kẻ D A và D M, hai đoạn màu xanh lá. Nối các góc bằng nhau qua ba đường tròn: góc H D F bằng góc H B F, bằng góc A C H, bằng góc A D H. Vậy D H chia đôi góc A D M.",
       "Mình kẻ A M, cắt D E tại I. Trong tam giác A D M, đoạn D I vừa là đường cao vừa là phân giác, nên tam giác cân tại D, và D E là trung trực của A M.",
       "Mình kẻ M E và M H. H và E nằm trên trung trực nên H M bằng H A, E M bằng E A. Hai tam giác E M H và E A H bằng nhau, nên góc E M H bằng góc E A H, bằng chín mươi độ."])

slide("21", r"""<section class="noi-dung"><h2>Câu IV, ý 2c: kéo hình để dự đoán</h2><p class="phu-de">\(BM\) cắt \((O)\) tại điểm thứ hai \(K\). Tam giác \(HKM\) cân tại đỉnh nào?</p>"""
      + hinh(lop("OBCAHDEFMK", NEN + [{"a": "H", "b": "C", "lop": "nhat"}, {"a": "D", "b": "M", "lop": "nhat"}, {"a": "A", "b": "M", "lop": "nhat"}, {"a": "B", "b": "M", "lop": "mau"}, {"a": "H", "b": "K", "lop": "cam"}, {"a": "H", "b": "M", "lop": "cam"}, {"a": "K", "b": "M", "lop": "cam"}], [{"tam": "O", "qua": "B"}], VUONG),
             keo=True, moTa="Kéo A và H để so sánh ba cạnh của tam giác HKM", chu="Kéo A và H, rồi so sánh ba độ dài. Bán kính (O) được lấy bằng 5.", tiLe=5, do=[{"nhan": "HK", "a": "H", "b": "K"}, {"nhan": "HM", "a": "H", "b": "M"}, {"nhan": "KM", "a": "K", "b": "M"}])
      + r"""</section>""",
      ["Ý c là ý khó nhất của đề. Thay vì chứng minh ngay, mình dự đoán trước đã. [chỉ: hinh] Em kéo điểm A và điểm H nhiều lần, rồi nhìn ba độ dài ở bên phải để tìm hai độ dài luôn bằng nhau. Khi đã có dự đoán, em thử chứng minh ra giấy, rồi bấm Tiếp tục nhé."],
      cho=True)

slide("22", r"""<section class="hai-cot"><h2>Câu IV, ý 2c: tam giác \(HKM\) cân tại \(H\)</h2><div class="cot">"""
      + hinh(lop("OBCAHDEFMK", NEN + [{"a": "H", "b": "F", "lop": "nhat"}, {"a": "H", "b": "C", "lop": "nhat"}, {"a": "D", "b": "M", "lop": "nhat"}, {"a": "A", "b": "M", "lop": "nhat"}, {"a": "B", "b": "M", "lop": "mau"}], [{"tam": "O", "qua": "B"}], VUONG),
             lop("N", [{"a": "E", "b": "N", "lop": "nhat", "dut": True}, {"a": "M", "b": "N", "lop": "mau"}]),
             lop("", [{"a": "K", "b": "C", "lop": "nhat", "dut": True}], vuong=[["B", "K", "C"]]),
             lop("", [{"a": "H", "b": "K", "lop": "cam"}, {"a": "A", "b": "N", "lop": "la"}]),
             lop("", [{"a": "H", "b": "M", "lop": "cam"}]),
             moTa="N là giao điểm của BM và DE; HK bằng HM")
      + r"""</div><div class="cot"><p>Hình cho thấy \(HK=HM\), nên ta cần chứng minh hai góc ở \(K\) và \(M\) bằng nhau.</p><ul class="hien-dan"><li>Gọi \(N=BM\cap DE\). Các điểm nằm theo thứ tự \(B,K,M,N\).</li><li>\(\triangle BKC\sim\triangle BDN\), \(\triangle BDH\sim\triangle BAC\), nên \(BK\cdot BN=BD\cdot BC=BH\cdot BA\).</li><li>Suy ra \(\triangle BKH\sim\triangle BAN\) (c.g.c), nên \(\widehat{BKH}=\widehat{BAN}\).</li><li>\(DE\) là trung trực của \(AM\), nên \(\triangle HAN=\triangle HMN\). Vậy \(\widehat{HKM}=180^\circ-\widehat{BKH}\) \(=180^\circ-\widehat{HMN}=\widehat{HMK}\).</li></ul></div></section>""",
      ["Chắc em đã thấy: H K luôn bằng H M, dù kéo thế nào. Vậy tam giác cân tại H, và mình cần chứng minh hai góc ở K và M bằng nhau.",
       "[chỉ: hinh] Mình thêm điểm N là giao của đường thẳng B M với đường thẳng D E. Hai điều kiện H B lớn hơn H A và A B nhỏ hơn A C của đề bảo đảm các điểm nằm theo thứ tự B, K, M, N.",
       "Mình kẻ K C. Góc B K C vuông, nên tam giác B K C đồng dạng với tam giác B D N. Tương tự, tam giác B D H đồng dạng với tam giác B A C. Cả hai cho cùng một tích B D nhân B C, nên B K nhân B N bằng B H nhân B A.",
       "Mình kẻ H K và A N. Từ đẳng thức vừa có, hai tam giác B K H và B A N có góc B chung và hai cạnh tỉ lệ, nên đồng dạng. Suy ra góc B K H bằng góc B A N.",
       "Mình kẻ H M. Theo ý b, D E là trung trực của A M, nên hai tam giác H A N và H M N bằng nhau, và góc H A N bằng góc H M N. Góc H K M kề bù với góc B K H, góc H M K kề bù với góc H M N, nên hai góc này bằng nhau. Vậy tam giác H K M cân tại H."])

# ── Câu V ───────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("23", r"""<section class="hai-cot"><h2>Câu V: chi phí nhỏ nhất</h2><div class="cot"><div data-chi="de"><p>Đơn hàng có \(1000\) sản phẩm. Mỗi công nhân làm \(5\) sản phẩm một ngày và được thưởng \(1\) triệu đồng khi xong việc. Thuê kho hết \(3\) triệu đồng một ngày.</p><p>Số công nhân và số ngày thuê kho là số nguyên dương.</p></div></div><div class="cot"><div class="nhap-dap-an" data-loai="so" data-dap-an="25" data-chi="nhap"><p class="cau">Nên điều động bao nhiêu công nhân để tổng chi phí nhỏ nhất?</p><div class="go-y">Gọi \(x\) là số công nhân, \(y\) là số ngày. Từ \(5xy=1000\) suy ra \(xy=200\).</div><div class="go-y">Chi phí là \(P=x+3y=x+\dfrac{600}{x}\), với \(x\) là ước của \(200\).</div>"""
      + loi_sai("24", r"Với \(24\) công nhân thì \(P=49\), nhưng \(y=\dfrac{200}{24}\) không nguyên. Số ngày phải là số nguyên.")
      + loi_sai("20", r"Với \(20\) công nhân thì \(P=50\). Em thử tiếp ước lớn hơn của \(200\).")
      + r"""<div class="giai-thich">\(x=25\) cho \(y=8\) và \(P=25+24=49\) triệu đồng, nhỏ nhất trong các ước của \(200\).</div></div></div></section>""",
      ["Câu cuối là bài toán tối ưu. [chỉ: de] Công ty càng thuê nhiều công nhân thì càng nhanh xong, nên tiền kho giảm nhưng tiền thưởng tăng. [chỉ: nhap] Em tự làm rồi nhập số công nhân. Xong thì em bấm Tiếp tục."],
      cho=True)

slide("24", r"""<section class="noi-dung"><h2>Câu V: viết chi phí theo một ẩn rồi thử</h2><p>Gọi \(x\) là số công nhân, \(y\) là số ngày: \(5xy=1000\), tức là \(xy=200\).</p><ul class="hien-dan"><li>Chi phí: \(P=x+3y=x+\dfrac{600}{x}\) (triệu đồng), với \(x\) là ước của \(200\).</li></ul><table class="hien" data-chi="bang"><tbody><tr><th>\(x\)</th><td>1</td><td>2</td><td>4</td><td>5</td><td>8</td><td>10</td><td>20</td><td><b>25</b></td><td>40</td><td>50</td><td>100</td><td>200</td></tr><tr><th>\(P\)</th><td>601</td><td>302</td><td>154</td><td>125</td><td>83</td><td>70</td><td>50</td><td><b>49</b></td><td>55</td><td>62</td><td>106</td><td>203</td></tr></tbody></table></section>""",
      ["Gọi x là số công nhân và y là số ngày. Tổng sản phẩm bằng năm x y, nên x nhân y bằng hai trăm.",
       "Chi phí gồm x triệu tiền thưởng và ba y triệu tiền kho. Thay y bằng hai trăm chia x, ta được chi phí chỉ theo một ẩn: x cộng sáu trăm chia x.",
       "[chỉ: bang] Vì x và y đều nguyên dương nên x là ước của hai trăm, chỉ có mười hai giá trị. Lập bảng là thấy ngay: nhỏ nhất là bốn mươi chín triệu, khi có hai mươi lăm công nhân làm trong tám ngày."])

# ── Tóm tắt ─────────────────────────────────────────────────────────────────────────────────────────────────────────
slide("25", r"""<section class="tong-ket"><h2>Ba điều mang theo</h2><ul class="hien-dan"><li>Đề không nói \(x\) nguyên thì đừng xét ước số: hãy chặn biểu thức giữa hai số.</li><li>Trong bài thực tế, “ít nhất” nghĩa là làm tròn lên, và phải đổi đơn vị trước khi tính.</li><li>Ở bài hình, kết quả của ý trước thường là chìa khoá của ý sau.</li></ul><p>Lời giải chi tiết để đọc lại nằm ngay dưới phần slide. Các dạng trong đề có bài luyện riêng ở mục Luyện theo dạng.</p></section>""",
      ["Mình đã đi hết đề rồi. {{Tx}} muốn em mang theo ba điều.",
       "Một, khi đề không nói x là số nguyên, đừng xét ước số, mà chặn biểu thức giữa hai số rồi thử từng số nguyên.",
       "Hai, trong bài toán thực tế, chữ ít nhất nghĩa là làm tròn lên, và cần đổi đơn vị trước khi tính.",
       "Ba, ở bài hình, kết quả của ý trước thường là chìa khoá của ý sau: ý c dùng lại đúng điều ý b đã chứng minh. Lời giải chi tiết nằm ngay dưới phần slide, còn từng dạng có bài luyện riêng. Chúc em thi thật tốt nhé!"])


def kiem_so_deck():
    """Các số nhiễu trong slide phải đúng là kết quả của lỗi mà phản hồi mô tả."""
    assert 10 * 33 + 5 == 335  # viết 7x + 5
    assert 3 * 9 - 3 == 24 and 3 * 7 == 21  # quên trừ 2x₁x₂; quên trừ x₁ + x₂
    assert round(3.14 * 12 * 25) == 942  # thiếu số 2
    assert 13 < 150 / (3.14 * 144 * 25 / 1000) < 14  # quên 80%
    assert 24 + 600 // 24 == 49 and 200 % 24 != 0  # x = 24 cho P = 49 nhưng y không nguyên
    assert 20 + 600 // 20 == 50
    assert round(16 * 9.0432, 1) == 144.7 and round(17 * 9.0432, 1) == 153.7


def tao_deck():
    kiem_so_deck()
    return khung_deck("Đề Toán vào 10 Hà Nội 2026", BO.slides, {"Viète": "Vi ét"})

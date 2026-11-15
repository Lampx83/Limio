# -*- coding: utf-8 -*-
"""Dựng bộ slide `passive-causative` (Speakout 1.1 · Grammar) cho khung /decks.

    python3 docs/hoc-lieu/speakout-grammar-slide/build.py

Ghi apps/web/src/content/decks/passive-causative.json. Tiêu chí: docs/tieu-chi/slide-giang-song-ngu.md (B1–B7).
Nội dung TỰ SOẠN, không chép bài đọc, ví dụ hay bài tập của sách (bộ slide nằm trong Git; học liệu Pearson thì không).

Quy ước lời giảng:
  - tiếng Việt giảng, mọi cụm tiếng Anh bọc trong [en: …] để đọc bằng giọng Anh;
  - [chỉ: id] trỏ vào phần tử có data-chi; [chờ: …] / [nghĩ n: …] chỉ ở CUỐI một bước;
  - số bước = 1 + số phần tử hiện dần (.hien, ul.hien-dan > li, .so-sanh > .cot) để mỗi ý khớp một bước.
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "apps", "web", "src", "content", "decks", "passive-causative.json")

def lc(text, fb, dung=False, gt=None):
    cls = "lc dung" if dung else "lc"
    return f'<button class="{cls}" data-gt="{gt or text}" data-phan-hoi="{fb}">{text}</button>'

def mcq(kid, cau, options, giai, chi=None):
    """options: [(chữ, phản hồi, đúng?)]; chi = mã để lời giảng trỏ vào ([chỉ: …])."""
    c = f' data-chi="{chi}"' if chi else ""
    return (f'<div class="trac-nghiem" data-kiem="{kid}"{c}><p class="cau">{cau}</p>'
            + "".join(lc(t, fb, d) for t, fb, d in options)
            + f'<div class="giai-thich">{giai}</div></div>')

def cap(a, b):
    return f'<div class="cap"><span class="a">{a}</span><span class="b">{b}</span></div>'

SLIDES = []
def slide(sid, html, steps, dung_cuoi=False, note=""):
    SLIDES.append({"id": sid, "html": html, "ghiChu": note, "loiGiang": {"buoc": steps, "dungCuoi": dung_cuoi}})

# 1 ── Bìa
slide("pc-01",
 '<section class="bia"><h1>Câu bị động và <i>have</i> + vật + past participle</h1>'
 '<p class="phu-de">Nói việc gì được làm, và việc gì mình nhờ người khác làm</p>'
 '<ul class="hien-dan"><li>Biết khi nào nên dùng câu bị động (the passive)</li>'
 '<li>Nhờ người khác làm giúp bằng <b>have + vật + past participle</b></li>'
 '<li>Tự nói và viết câu về cuộc sống của em</li></ul></section>',
 ["Chào em! {{Tx}} là {{gv}}. Hôm nay mình học hai cấu trúc rất hay gặp khi nói về lối sống: câu bị động, tiếng Anh gọi là [en: the passive], và cấu trúc nhờ người khác làm giúp. [dừng 1] Em thử nghĩ xem: em đã bao giờ nói câu [en: I had my hair cut] chưa?",
  "Việc thứ nhất: biết khi nào nên dùng câu bị động.",
  "Việc thứ hai: dùng [en: have], cộng với vật, cộng với quá khứ phân từ, để nói việc mình nhờ người khác làm giúp.",
  "Việc thứ ba: tự nói và viết câu về cuộc sống của chính em. [dừng 1] Mình bắt đầu nhé!"])

# 2 ── Ai làm, và ai quan trọng?
slide("pc-02",
 '<section class="hai-cot"><h2>Ai làm, và ai quan trọng?</h2>'
 '<div class="cot"><div class="vi-du" data-chi="cau-1">Someone <b>waters</b> the plants every morning.</div>'
 '<div class="vi-du" data-chi="cau-2">The plants <b>are watered</b> every morning.</div>'
 '<p class="phu-de">Hai câu nói cùng một việc.</p></div>'
 '<div class="cot">' + mcq("pc-02-a", "Câu nào nói về <b>những cái cây</b>, chứ không nói về người tưới?", [
   ("Someone waters the plants every morning.", "Câu này bắt đầu bằng someone, tức là đang nói về người tưới.", False),
   ("The plants are watered every morning.", "Đúng: chủ ngữ là the plants, và are watered là dạng bị động.", True),
   ("The plants water every morning.", "Câu này sai nghĩa: cây không tự tưới được, và thiếu dạng bị động.", False)],
   "Câu bị động đặt <b>vật được tác động</b> lên đầu câu.") + '</div></section>',
 ["Mình bắt đầu bằng hai câu bên trái. [chỉ: cau-1] Câu đầu nói: [en: Someone waters the plants every morning]. Chủ ngữ là một người, đang tưới cây. [chỉ: cau-2] Câu thứ hai nói: [en: The plants are watered every morning]. Chủ ngữ bây giờ là những cái cây.",
  "Việc xảy ra vẫn y như nhau. Chỉ khác là người nói đang chú ý vào thứ gì: người tưới, hay những cái cây được tưới. Câu thứ hai là câu bị động. [dừng 1] Em chọn câu trả lời bên phải nhé."],
 dung_cuoi=True)

# 3 ── Hình thức
def tab(ten, cong_thuc, vd, nghia):
    return f'<div class="tab" data-ten="{ten}"><p><b>{cong_thuc}</b></p><div class="vi-du">{vd}</div><p class="phu-de">{nghia}</p></div>'
slide("pc-03",
 '<section><h2>Câu bị động: hình thức</h2>'
 '<div class="dinh-nghia" data-chi="cong-thuc">Câu bị động = một dạng của <b>be</b> + <b>past participle</b> (quá khứ phân từ, cột 3 của động từ)</div>'
 '<div class="tabs" data-chi="tabs">'
 + tab("Hiện tại đơn", "am / is / are + past participle", "Rice <b>is grown</b> in the Mekong Delta.", "Gạo được trồng ở đồng bằng sông Cửu Long.")
 + tab("Quá khứ đơn", "was / were + past participle", "This bridge <b>was built</b> last year.", "Cây cầu này được xây năm ngoái.")
 + tab("Hiện tại hoàn thành", "has / have been + past participle", "The road <b>has been repaired</b>.", "Con đường đã được sửa xong.")
 + tab("Tương lai", "will be + past participle", "The results <b>will be announced</b> on Friday.", "Kết quả sẽ được công bố vào thứ Sáu.")
 + tab("Động từ khuyết thiếu", "can / must + be + past participle", "Phones <b>must be switched</b> off.", "Điện thoại phải được tắt.")
 + '</div></section>',
 ["Câu bị động luôn gồm hai phần. [chỉ: cong-thuc] Một dạng của động từ [en: be], cộng với quá khứ phân từ của động từ chính, tiếng Anh gọi là [en: past participle]. Ví dụ, [en: steal] có quá khứ phân từ là [en: stolen], còn [en: build] là [en: built].",
  "Động từ [en: be] sẽ đổi theo thì của câu. [chỉ: tabs] Em bấm lần lượt từng thẻ. Thẻ đầu là hiện tại đơn: [en: Rice is grown in the Mekong Delta]. Gạo được trồng ở đồng bằng sông Cửu Long. [chờ: Em bấm lần lượt từng thẻ để xem các thì]",
  "Quá khứ đơn dùng [en: was] hoặc [en: were]: [en: This bridge was built last year]. Hiện tại hoàn thành dùng [en: has been] hoặc [en: have been]: [en: The road has been repaired]. Tương lai dùng [en: will be]: [en: The results will be announced on Friday]. Với động từ khuyết thiếu như [en: can] hay [en: must], ta dùng [en: be] nguyên dạng: [en: Phones must be switched off]."])

# 4 ── Ghép chủ động – bị động
slide("pc-04",
 '<section><h2>Ghép câu chủ động với câu bị động</h2><div class="ghep-doi" data-chi="ghep">'
 + cap("A chef prepares the soup every day.", "The soup is prepared every day.")
 + cap("They built this school in the nineties.", "This school was built in the nineties.")
 + cap("The council has closed the old market.", "The old market has been closed.")
 + cap("The company will launch a new app soon.", "A new app will be launched soon.")
 + '</div></section>',
 ["Bây giờ em tự ghép nhé. [chỉ: ghep] Bên trái là câu chủ động, bên phải là câu bị động có cùng ý.",
  "Gợi ý: nhìn thì của động từ ở câu bên trái. Thì đó không đổi khi em chuyển sang bị động, chỉ có động từ [en: be] đổi theo. Em chọn một ô bên trái, rồi chọn một ô bên phải."],
 dung_cuoi=True)

# 5 ── Khi nào dùng bị động
slide("pc-05",
 '<section class="hai-cot"><h2>Khi nào dùng câu bị động?</h2>'
 '<div class="cot"><ul class="hien-dan">'
 '<li data-chi="r1"><b>Không biết ai làm</b><br>My bike was stolen last night.</li>'
 '<li data-chi="r2"><b>Ai làm không quan trọng</b><br>The shop is closed on Sundays.</li>'
 '<li data-chi="r3"><b>Muốn nhấn mạnh kết quả</b><br>Dinner has been cooked.</li></ul></div>'
 '<div class="cot"><div class="dinh-nghia hien" data-chi="by"><b>by + người làm</b> chỉ thêm khi thông tin đó mới hoặc quan trọng.<br>This song was written <b>by my brother</b>.</div>'
 '<div class="meo hien" data-chi="meo">Nếu câu chủ động nghe tự nhiên hơn, cứ dùng câu chủ động.</div></div></section>',
 ["Vậy khi nào nên dùng câu bị động? Có ba lí do chính.",
  "[chỉ: r1] Một, khi không biết ai làm. [en: My bike was stolen last night]. Em đâu biết ai đã lấy xe.",
  "[chỉ: r2] Hai, khi ai làm không quan trọng. [en: The shop is closed on Sundays]. Không cần biết ai đóng cửa.",
  "[chỉ: r3] Ba, khi em muốn nhấn mạnh kết quả. [en: Dinner has been cooked]. Bữa tối đã nấu xong, thế là đủ.",
  "[chỉ: by] Còn người làm thì sao? Em chỉ thêm [en: by] cộng người làm khi thông tin đó mới hoặc quan trọng. Ví dụ: [en: This song was written by my brother].",
  "[chỉ: meo] Và nhớ nhé: nếu câu chủ động nghe tự nhiên hơn, em cứ dùng câu chủ động. Câu bị động không phải lúc nào cũng hay hơn."])

# 6 ── Kiểm tra bị động
slide("pc-06",
 '<section class="hai-cot"><h2>Em thử: chọn dạng đúng</h2>'
 '<div class="cot">' + mcq("pc-06-a", "My wallet ____ on the bus yesterday.", [
   ("stole", "Stole là quá khứ của động từ chủ động. Ví không thể tự lấy cắp.", False),
   ("was stolen", "Đúng: quá khứ đơn bị động, was + stolen.", True),
   ("has stolen", "Has stolen là chủ động, và ví không thể đi lấy cắp.", False),
   ("is stolen", "Is chỉ hiện tại, mà việc xảy ra hôm qua.", False)],
   "<b>was</b> (quá khứ, số ít) + <b>stolen</b> (past participle của steal).", chi="cau-a") + '</div>'
 '<div class="cot">' + mcq("pc-06-b", "These documents ____ already ____ to the office.", [
   ("are / sent", "Thiếu been. Hiện tại hoàn thành bị động cần have been.", False),
   ("have / sent", "Đây là chủ động, nhưng giấy tờ không tự gửi đi được.", False),
   ("have / been sent", "Đúng: documents là số nhiều nên dùng have, rồi been + sent.", True),
   ("has / been sent", "Documents là số nhiều, nên phải là have, không phải has.", False)],
   "Hiện tại hoàn thành bị động: <b>have / has been + past participle</b>.", chi="cau-b") + '</div></section>',
 ["Đến lượt em thử hai câu. [chỉ: cau-a] Câu bên trái nói về một cái ví bị mất hôm qua. Hãy nghĩ: động từ ở quá khứ hay hiện tại, và ví có tự làm việc đó được không?",
  "[chỉ: cau-b] Câu bên phải nói về những giấy tờ đã được gửi. Chú ý hai điều: giấy tờ là số nhiều, và thì là hiện tại hoàn thành. [dừng 1] Em làm cả hai câu nhé."],
 dung_cuoi=True)

# 7 ── have + vật + p.p.
slide("pc-07",
 '<section class="hai-cot"><h2>Nhờ người khác làm giúp</h2>'
 '<div class="cot"><div class="dinh-nghia" data-chi="ct"><b>have</b> + vật + <b>past participle</b><br>= nhờ hoặc thuê người khác làm việc đó cho mình.</div>'
 '<ul class="hien-dan"><li data-chi="v1">I <b>had my hair cut</b> yesterday.</li>'
 '<li data-chi="v2">She <b>has her nails done</b> every month.</li>'
 '<li data-chi="v3">We are <b>having the kitchen painted</b>.</li></ul></div>'
 '<div class="cot"><div class="vi-du hien" data-chi="so-voi"><b>Tự làm:</b> I cut my hair. (em tự cắt)<br><b>Nhờ người khác:</b> I had my hair cut. (thợ cắt cho em)</div></div></section>',
 ["Cấu trúc thứ hai là nhờ người khác làm giúp. [chỉ: ct] Công thức là [en: have], cộng với vật, cộng với quá khứ phân từ. Nghĩa là em nhờ hoặc thuê một người khác làm việc đó cho mình.",
  "[chỉ: v1] [en: I had my hair cut yesterday]. Hôm qua em đi cắt tóc, người cắt là thợ, không phải em.",
  "[chỉ: v2] [en: She has her nails done every month]. Mỗi tháng cô ấy đi làm móng.",
  "[chỉ: v3] [en: We are having the kitchen painted]. Nhà mình đang thuê người sơn lại căn bếp. Ở đây [en: have] chia theo thì của câu, còn quá khứ phân từ giữ nguyên.",
  "[chỉ: so-voi] So sánh hai câu này nhé. [en: I cut my hair] nghĩa là em tự cắt. [en: I had my hair cut] nghĩa là có người cắt cho em."])

# 8 ── Tự làm hay nhờ người
slide("pc-08",
 '<section><h2>Tự làm hay nhờ người khác?</h2>'
 '<div class="so-sanh"><div class="cot"><h3>Tự làm</h3><p>I repaired my bike. (em tự sửa xe)</p></div>'
 '<div class="cot"><h3>Nhờ người khác</h3><p>I had my bike repaired. (thợ sửa cho em)</p></div></div>'
 '<div class="canh-bao hien" data-chi="thu-tu">Thứ tự là have + <b>vật</b> + past participle. Sai: I had repaired my bike.</div>'
 '<div class="luu-y hien" data-chi="khong-may">Cấu trúc này cũng dùng cho chuyện không may: <b>I had my bike stolen.</b></div></section>',
 ["Mình so sánh hai câu. Cả hai đều nói về việc sửa xe.",
  "Cột bên trái: [en: I repaired my bike]. Chủ ngữ tự làm việc đó. Em tự sửa xe.",
  "Cột bên phải: [en: I had my bike repaired]. Em không tự làm, mà nhờ thợ sửa cho em.",
  "[chỉ: thu-tu] Lỗi hay gặp nhất là sai thứ tự. Sau [en: had] phải là cái vật, rồi mới đến quá khứ phân từ. Câu [en: I had repaired my bike] là sai.",
  "[chỉ: khong-may] Một lưu ý nữa: cấu trúc này còn dùng cho chuyện không may. [en: I had my bike stolen]. Em không nhờ ai lấy xe cả, nhưng câu vẫn có dạng như vậy."])

# 9 ── Ghép tình huống với câu
slide("pc-09",
 '<section><h2>Ghép tình huống với câu tiếng Anh</h2><div class="ghep-doi" data-chi="ghep">'
 + cap("Laptop hỏng, em mang ra tiệm để thợ sửa.", "I had my laptop repaired.")
 + cap("Mẹ thuê thợ sơn lại phòng khách.", "Mom had the living room painted.")
 + cap("Chị ấy đến tiệm để làm tóc.", "She had her hair done.")
 + cap("Em được thợ chụp ảnh chân dung.", "I had my portrait taken.")
 + '</div></section>',
 ["Giờ em ghép tình huống tiếng Việt với câu tiếng Anh nhé. [chỉ: ghep] Hãy tìm xem trong tình huống ai là người làm việc, em hay người khác.",
  "Nếu người khác làm giúp em, ta dùng [en: have] cộng vật cộng quá khứ phân từ. Em chọn một ô bên trái, rồi một ô bên phải."],
 dung_cuoi=True)

# 10 ── Bắt lỗi, và phân biệt
slide("pc-10",
 '<section class="hai-cot"><h2>Bắt lỗi và phân biệt</h2>'
 '<div class="cot">' + mcq("pc-10-a", "Câu nào <b>sai</b>?", [
   ("She had her car washed.", "Câu này đúng: have + her car + washed.", False),
   ("I had repaired my phone.", "Đúng, đây là câu sai: phải là I had my phone repaired. Vật đứng trước past participle.", True),
   ("We are having the roof fixed.", "Câu này đúng: are having + the roof + fixed.", False),
   ("He had his wallet stolen on the bus.", "Câu này đúng, dùng cho chuyện không may.", False)],
   "Sai thứ tự: <b>had repaired my phone</b>. Đúng: <b>had my phone repaired</b>.", chi="cau-a") + '</div>'
 '<div class="cot">' + mcq("pc-10-b", "Câu nào nói rằng người nói <b>tự làm</b>?", [
   ("I cleaned my room.", "Đúng: không có have + vật + past participle, nên em tự dọn phòng.", True),
   ("I had my room cleaned.", "Câu này nói em nhờ người khác dọn.", False),
   ("My room was cleaned.", "Câu bị động: không nói ai dọn, nhưng thường không phải em.", False)],
   "<b>cleaned</b> là động từ chủ động: em là người làm.", chi="cau-b") + '</div></section>',
 ["Thử hai câu hỏi cuối phần này. [chỉ: cau-a] Bên trái: tìm câu sai. Gợi ý: kiểm tra thứ tự, vật đứng ở đâu so với quá khứ phân từ?",
  "[chỉ: cau-b] Bên phải: câu nào nói người nói tự làm? [dừng 1] Em làm cả hai câu nhé."],
 dung_cuoi=True)

# 11 ── Em tự viết
def nhap(kid, cau, dap_an, goi_y, loi_sai, giai):
    return (f'<div class="nhap-dap-an" data-loai="chu" data-dap-an="{dap_an}" data-kiem="{kid}"><p class="cau">{cau}</p>'
            + "".join(f'<div class="go-y">{g}</div>' for g in goi_y)
            + "".join(f'<div class="loi-sai" data-khi="{k}">{t}</div>' for k, t in loi_sai)
            + f'<div class="giai-thich">{giai}</div></div>')
slide("pc-11",
 '<section class="hai-cot"><h2>Em tự viết</h2>'
 '<div class="cot">' + nhap("pc-11-a", "Viết lại bằng câu bị động: <i>Someone stole my bag.</i><br>My bag ____ .", "was stolen",
   ["Câu gốc ở quá khứ đơn. Vật my bag là số ít, vậy be là was hay were?", "Past participle của steal là gì? Bộ ba: steal, stole, ____."],
   [("stolen", "Còn thiếu be. Câu bị động cần was hoặc were trước stolen."), ("was stole|were stolen", "Be phải là was (my bag là số ít), và sau đó là past participle stolen.")],
   "My bag <b>was stolen</b>: was (quá khứ, số ít) + stolen.") + '</div>'
 '<div class="cot">' + nhap("pc-11-b", "Em nhờ thợ sửa xe máy hôm qua. Hoàn thành: <i>I ____ .</i> (dùng motorbike, fix)", "had my motorbike fixed|had my motorbike repaired",
   ["Việc đã xảy ra hôm qua, vậy have ở thì nào?", "Thứ tự: have + vật + past participle."],
   [("had fixed my motorbike", "Sai thứ tự. Vật phải đứng trước past participle: had my motorbike fixed."), ("have my motorbike fixed", "Việc xảy ra hôm qua, nên dùng had, không dùng have."), ("had my motorbike fix", "Cần past participle: fixed, không phải fix.")],
   "I <b>had my motorbike fixed</b>.") + '</div></section>',
 ["Giờ em tự viết nhé. Ở cột bên trái, em viết lại câu thành câu bị động. Ở cột bên phải, em hoàn thành câu nói em nhờ thợ sửa xe máy. Có thể bấm gợi ý nếu cần. [dừng 1] Gõ xong thì bấm kiểm tra."],
 dung_cuoi=True)

# 12 ── Tổng kết và cầu nối
slide("pc-12",
 '<section class="tong-ket"><h2>Tóm tắt</h2><ul class="hien-dan">'
 '<li><b>Bị động:</b> be + past participle, be đổi theo thì</li>'
 '<li>Dùng khi <b>không biết ai làm</b>, ai làm không quan trọng, hoặc muốn nhấn mạnh kết quả</li>'
 '<li><b>Nhờ người khác làm giúp:</b> have + vật + past participle</li>'
 '<li>Cùng cấu trúc đó dùng cho chuyện không may: I had my bike stolen</li></ul>'
 '<div class="bam-de-xem" data-nhan="Việc tiếp theo">Quay lại mục Speaking của bài 1.1 và hỏi bạn: <i>Have you ever had something repaired or cut or painted?</i> Rồi hỏi tiếp một câu để biết thêm chi tiết.</div></section>',
 ["Mình cùng tóm tắt nhé.",
  "Một: câu bị động gồm [en: be] cộng quá khứ phân từ, và [en: be] đổi theo thì.",
  "Hai: dùng câu bị động khi không biết ai làm, khi ai làm không quan trọng, hoặc khi em muốn nhấn mạnh kết quả.",
  "Ba: muốn nói em nhờ người khác làm giúp, dùng [en: have], cộng vật, cộng quá khứ phân từ.",
  "Bốn: cấu trúc ấy cũng dùng cho chuyện không may, như [en: I had my bike stolen].",
  "Việc tiếp theo: em quay lại mục Speaking của bài 1.1, rồi hỏi bạn một câu như [en: Have you ever had something repaired?] Nhớ hỏi thêm một câu nữa để biết chi tiết. Hẹn gặp lại em!"])

DECK = {
    "tieuDe": "Passive và have + vật + past participle",
    "mau": "xanh",
    "ngonNgu": "vi",
    "nguoiGiang": {
        "macDinh": "baotrang",
        "dsGiangVien": [{"ma": "baotrang", "ten": "Bảo Trang", "gioi": "nu", "xung": "cô"}],
        "xungHoHs": "em",
        "phatAm": {},
    },
    "slides": SLIDES,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(DECK, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("Đã ghi", os.path.normpath(OUT), "-", len(SLIDES), "slide,", sum(len(s["loiGiang"]["buoc"]) for s in SLIDES), "đoạn lời giảng")

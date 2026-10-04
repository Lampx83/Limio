# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.8 · Tài nguyên giáo dục mở: lý thuyết cốt lõi trong 30 phút",
    "durationMin": 30,
    "description": "Bản giảng lý thuyết cô đọng về tài nguyên giáo dục mở: định nghĩa và khung 5R, sáu giấy phép Creative Commons cùng cách ghi nguồn TASL, quy tắc phối trộn, và bốn câu hỏi thẩm định. Dùng khi chỉ có một tiết lý thuyết; phần thực hành đầy đủ nằm ở Bài 5.7.",
    "objectives": [
        "Phát biểu được định nghĩa OER của UNESCO 2019 và dùng khung 5R để phân biệt miễn phí với mở",
        "Đọc được bốn điều kiện BY, SA, NC, ND và viết dòng ghi nguồn đủ bốn thành phần TASL",
        "Áp dụng được quy tắc tuyển tập – phái sinh và bảng tương thích để quyết định một lần phối trộn",
    ],
    "summary": [
        "OER là tài liệu thuộc phạm vi công cộng hoặc có giấy phép mở, cho phép giữ, dùng lại, sửa, phối trộn và phân phối lại (5R). Miễn phí chỉ là được xem.",
        "Bốn điều kiện BY (ghi công), SA (chia sẻ tương tự), NC (phi thương mại), ND (không phái sinh) ghép thành sáu giấy phép CC; CC0 gần như phạm vi công cộng. Ghi nguồn đủ TASL: tên, tác giả, nguồn, giấy phép.",
        "Đặt cạnh nhau nguyên trạng là tuyển tập, mỗi phần giữ giấy phép riêng. Sửa hoặc ghép lẫn là phái sinh: đầu vào phải tương thích; SA không ghép được với NC, ND không cho phát hành bản sửa.",
        "Bằng chứng mạnh nhất của OER là về chi phí, tiếp cận và tỉ lệ bỏ học, không phải về việc tài liệu mở tự làm người học giỏi hơn.",
    ],
    "body": r"""
> [!meo] **Bài này là phần lý thuyết cô đọng, khoảng 30 phút.** Nếu lớp có một buổi 90 phút, hãy dùng Bài 5.7: cùng nội dung nhưng có hoạt động thám tử giấy phép, xưởng phối trộn và bảng đăng ký tài sản cho đồ án.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Tiến trình 30 phút</div>
  <div style="min-width:38rem;display:flex;height:3rem;border-radius:.45rem;overflow:hidden;color:#fff;font-size:.9rem;text-align:center;line-height:1.2">
    <div style="flex:3;background:rgba(217,150,40,.9);display:flex;align-items:center;justify-content:center">Mở đầu</div>
    <div style="flex:7;background:rgba(37,99,235,.85);display:flex;align-items:center;justify-content:center">1 · OER và 5R</div>
    <div style="flex:7;background:rgba(13,148,136,.88);display:flex;align-items:center;justify-content:center">2 · Giấy phép CC</div>
    <div style="flex:7;background:rgba(124,58,237,.85);display:flex;align-items:center;justify-content:center">3 · Phối trộn</div>
    <div style="flex:4;background:rgba(220,38,38,.85);display:flex;align-items:center;justify-content:center">4 · Thẩm định</div>
    <div style="flex:2;background:rgba(120,113,108,.85);display:flex;align-items:center;justify-content:center">Chốt</div>
  </div>
  <div style="min-width:38rem;display:flex;font-size:.88rem;opacity:.75;margin:.3rem 0 0">
    <div style="flex:3">0′</div><div style="flex:7">3′</div><div style="flex:7">10′</div><div style="flex:7">17′</div><div style="flex:4">24′</div><div style="flex:2">28′–30′</div>
  </div>
</div>
```

**Câu hỏi mở đầu (3 phút):** một ảnh rất đẹp trên Google Hình ảnh, không kèm ghi chú gì, có được đưa vào sách AR phát hành công khai không? Hãy giữ câu trả lời của bạn; cuối bài ta quay lại.

## OER là gì: miễn phí chưa phải là mở

**Định nghĩa.** Theo Khuyến nghị UNESCO về OER (2019), văn bản chuẩn mực quốc tế đầu tiên về chủ đề này, tài nguyên giáo dục mở là *tài liệu dạy, học và nghiên cứu ở mọi định dạng, thuộc phạm vi công cộng hoặc được phát hành theo giấy phép mở, cho phép người khác truy cập không mất phí, dùng lại, điều chỉnh, chỉnh sửa và phân phối lại* (diễn đạt lại). Cụm từ OER xuất hiện lần đầu ở một diễn đàn UNESCO năm 2002; Tuyên bố Paris năm 2012 kêu gọi phát hành học liệu do ngân sách công tài trợ theo giấy phép mở.

Điểm then chốt của định nghĩa là **trạng thái pháp lý**, không phải giá. Một video xem không mất tiền nhưng không cho tải về và sửa thì chưa phải OER.

**Khung 5R** (David Wiley) đo độ mở bằng năm quyền người dùng nhận được:

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Năm quyền: miễn phí thường chỉ trao quyền thứ hai</div>
  <div style="min-width:38rem;display:flex;gap:.4rem;font-size:.98rem;line-height:1.4">
    <div style="flex:1;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>Retain</strong><br>Giữ, sở hữu bản sao</div>
    <div style="flex:1;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>Reuse</strong><br>Dùng nguyên trạng</div>
    <div style="flex:1;background:rgba(13,148,136,.88);color:#fff;border-radius:.4rem;padding:.6rem"><strong>Revise</strong><br>Sửa, dịch, rút gọn</div>
    <div style="flex:1;background:rgba(13,148,136,.88);color:#fff;border-radius:.4rem;padding:.6rem"><strong>Remix</strong><br>Ghép với tài nguyên khác</div>
    <div style="flex:1;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>Redistribute</strong><br>Chia sẻ bản gốc hoặc bản sửa</div>
  </div>
</div>
```

> [!canh-bao] **Ba hiểu nhầm phải gỡ ngay:** *công khai trên mạng thì dùng được* (công khai không phải là được phép); *ghi nguồn là đủ* (ghi nguồn là một điều kiện của giấy phép, không thay được giấy phép); *dùng cho giáo dục thì được miễn* (ngoại lệ giảng dạy trong luật hẹp và có điều kiện, không phủ một sản phẩm phát hành công khai).

## Giấy phép Creative Commons và cách ghi nguồn

Bốn điều kiện ghép thành sáu giấy phép, cộng CC0 ở đầu mở nhất.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Phổ giấy phép và bốn điều kiện</div>
  <div style="min-width:40rem;display:flex;gap:.3rem;font-size:.9rem;line-height:1.3;text-align:center;color:#fff;font-weight:600">
    <div style="flex:1;background:rgba(13,148,136,.88);border-radius:.35rem;padding:.5rem .2rem">CC0</div>
    <div style="flex:1;background:rgba(13,148,136,.88);border-radius:.35rem;padding:.5rem .2rem">BY</div>
    <div style="flex:1;background:rgba(37,99,235,.85);border-radius:.35rem;padding:.5rem .2rem">BY-SA</div>
    <div style="flex:1;background:rgba(217,150,40,.9);border-radius:.35rem;padding:.5rem .2rem">BY-NC</div>
    <div style="flex:1;background:rgba(217,150,40,.9);border-radius:.35rem;padding:.5rem .2rem">BY-NC-SA</div>
    <div style="flex:1;background:rgba(220,38,38,.85);border-radius:.35rem;padding:.5rem .2rem">BY-ND</div>
    <div style="flex:1;background:rgba(220,38,38,.85);border-radius:.35rem;padding:.5rem .2rem">BY-NC-ND</div>
  </div>
  <div style="min-width:40rem;display:flex;justify-content:space-between;font-size:.88rem;opacity:.7;margin:.3rem 0 .8rem"><span>← mở nhất</span><span>đóng nhất →</span></div>
  <table style="min-width:40rem;border-collapse:collapse;width:100%;font-size:1rem;line-height:1.5">
    <tbody>
      <tr><td style="padding:.45rem;border-bottom:1px solid rgba(127,127,127,.25);width:5rem"><strong>BY</strong></td><td style="padding:.45rem;border-bottom:1px solid rgba(127,127,127,.25)">Ghi công tác giả. Có mặt ở cả sáu giấy phép.</td></tr>
      <tr><td style="padding:.45rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>SA</strong></td><td style="padding:.45rem;border-bottom:1px solid rgba(127,127,127,.25)">Bản sửa đổi phải mang cùng giấy phép.</td></tr>
      <tr><td style="padding:.45rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>NC</strong></td><td style="padding:.45rem;border-bottom:1px solid rgba(127,127,127,.25)">Không dùng chủ yếu nhằm lợi thế thương mại hay thù lao. Ranh giới mơ hồ.</td></tr>
      <tr><td style="padding:.45rem"><strong>ND</strong></td><td style="padding:.45rem">Chỉ dùng nguyên trạng; được dùng, nhưng không phát hành bản đã sửa.</td></tr>
    </tbody>
  </table>
</div>
```

Ba lưu ý: **CC0** là lời từ bỏ quyền, không hẳn là giấy phép, nhưng vẫn nên ghi nguồn; **ND không cấm dùng**, chỉ cấm phát hành bản sửa, nên với mô hình 3D phải giảm đa giác thì ND gần như chặn đứng; **NC** mơ hồ ở vùng ranh giới, vì vậy người thiết kế học liệu nên ưu tiên CC BY và CC BY-SA.

**Ghi nguồn TASL:** **T**itle (tên tác phẩm) · **A**uthor (tác giả) · **S**ource (đường dẫn trang gốc) · **L**icense (giấy phép, kèm đường dẫn). Đã sửa thì ghi thêm sửa gì.

> [!vi-du] *"Gravity and Orbits"* · PhET Interactive Simulations, University of Colorado Boulder · phet.colorado.edu · CC BY 4.0.
> Sai thường gặp: "Nguồn: Internet", "Nguồn: Google", "Ảnh: Wikimedia Commons" — chỉ nói nơi để, không nói tác phẩm nào, của ai, được phép gì.

## Phối trộn: tuyển tập hay tác phẩm phái sinh

Quy tắc quan trọng nhất của bài, vì nó quyết định có phải xét tương thích hay không.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:38rem;display:grid;grid-template-columns:1fr 1fr;gap:.7rem;font-size:1.02rem;line-height:1.55">
    <div style="border-left:5px solid rgba(13,148,136,.88);background:rgba(13,148,136,.07);border-radius:0 .4rem .4rem 0;padding:.7rem .9rem"><strong>Tuyển tập</strong><br>Đặt <strong>cạnh nhau, nguyên trạng</strong> (mô hình ở trang 3, ảnh ở trang 4).<br>→ Mỗi phần <strong>giữ giấy phép riêng</strong>, không cần tương thích.</div>
    <div style="border-left:5px solid rgba(220,38,38,.85);background:rgba(220,38,38,.06);border-radius:0 .4rem .4rem 0;padding:.7rem .9rem"><strong>Tác phẩm phái sinh</strong><br><strong>Sửa hoặc ghép lẫn</strong> (dán ảnh làm texture lên mô hình).<br>→ Đầu vào <strong>phải tương thích</strong>; sản phẩm mang giấy phép chặt nhất.</div>
  </div>
</div>
```

Khi ghép phái sinh, ba quy tắc đủ dùng cho hầu hết tình huống:

1. **CC0 và BY** ghép được với mọi giấy phép không có ND; sản phẩm mang giấy phép chặt hơn trong hai đầu vào.
2. **SA không ghép được với NC** (kể cả NC-SA): SA đòi sản phẩm mang đúng BY-SA, NC đòi sản phẩm phi thương mại — không giấy phép nào thoả cả hai.
3. **ND ở bất kỳ đầu vào nào** thì không phát hành được bản phái sinh.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Trước khi dùng một tài nguyên: bốn câu hỏi theo thứ tự</div>
  <div style="min-width:36rem;display:flex;flex-direction:column;gap:.35rem;font-size:1.02rem;line-height:1.5">
    <div style="display:flex;gap:.6rem"><div style="flex:0 0 2.2rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">1</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.45rem .7rem"><strong>Giấy phép trên trang gốc là gì?</strong> <span style="opacity:.75">Không tìm thấy ⇒ không dùng, hoặc xin phép bằng văn bản.</span></div></div>
    <div style="display:flex;gap:.6rem"><div style="flex:0 0 2.2rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">2</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.45rem .7rem"><strong>Mình dùng nguyên trạng hay sẽ sửa, ghép?</strong> <span style="opacity:.75">Nguyên trạng ⇒ tuyển tập, sang câu 4.</span></div></div>
    <div style="display:flex;gap:.6rem"><div style="flex:0 0 2.2rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">3</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.45rem .7rem"><strong>Có ND không, có cặp SA – NC không?</strong> <span style="opacity:.75">Có ⇒ thay tài nguyên hoặc giữ tách riêng.</span></div></div>
    <div style="display:flex;gap:.6rem"><div style="flex:0 0 2.2rem;background:rgba(13,148,136,.88);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">4</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.45rem .7rem"><strong>Đã ghi đủ TASL, kể cả phần đã sửa chưa?</strong> <span style="opacity:.75">Ghi ngay lúc tải, đừng để tới lúc nộp.</span></div></div>
  </div>
</div>
```

> [!ghi-nho] Gặp một tài nguyên NC, đừng vội gắn NC cho **cả** sản phẩm "cho an toàn": làm vậy là đóng bớt quyền của mọi người dùng sau bạn. Nếu nó chỉ nằm cạnh các phần khác (tuyển tập), cả sản phẩm vẫn giữ được giấy phép mở hơn.

## Thẩm định: OER mang lại gì, và giới hạn ở đâu

**Bằng chứng.** Các tổng quan của Hilton (2016; 2020) cho thấy tiết kiệm chi phí là kết quả nhất quán nhất, và kết quả học tập nhìn chung không kém đi. Phân tích tổng hợp của Clinton & Khan (2019) không thấy khác biệt đáng kể về kết quả học tập nhưng ghi nhận tỉ lệ rút môn thấp hơn; Colvard, Watson & Park (2018) thấy mức cải thiện lớn hơn ở nhóm sinh viên thu nhập thấp và học bán thời gian. Phần lớn là **bán thực nghiệm**, nên chưa tách được tác động của tài liệu khỏi tác động của người dạy đã chủ động đổi mới. Kết luận có cơ sở: OER mạnh nhất ở **tiếp cận và công bằng**.

**Bốn câu hỏi thẩm định một kho hay dự án OER:** (1) *Bền vững* — ai trả tiền cập nhật khi hết tài trợ? (2) *Chất lượng* — đã được phản biện chưa, tìm có dễ không? (3) *Mở thật hay mở danh nghĩa* — đủ 5R không, hay "free" nhưng không cho tải, không cho sửa? (4) *Bối cảnh pháp lý* — sản phẩm phát hành công khai cần giấy phép, không dựa vào ngoại lệ giảng dạy của Luật Sở hữu trí tuệ.

**Nội dung do AI tạo** không tự động là OER: còn điều khoản của nhà cung cấp, độ chính xác, và nguy cơ trùng một tác phẩm có sẵn. Ghi rõ phần nào do AI sinh.

**Quay lại câu mở đầu.** Ảnh trên Google Hình ảnh: *chưa biết được* — Google là công cụ tìm kiếm, không phải chủ sở hữu. Lần tới trang gốc, áp bốn câu hỏi ở mục 3.

## Luyện tập và tài liệu tham khảo

### Tự kiểm tra nhanh (2 phút, cá nhân)

Không xem lại bài, viết ra: năm chữ R; bốn chữ cái của TASL; và một câu giải thích vì sao CC BY-SA không ghép phái sinh được với CC BY-NC. Sau đó làm phần **Kiểm tra Bài 5.8** bên dưới.

### Bài tập về nhà · sản phẩm số: Thẻ quyết định giấy phép (45 phút)

Làm một **thẻ tra cứu một trang** (ảnh, PDF hoặc trang HTML) để bạn và nhóm đồ án dùng mỗi lần định lấy một tài nguyên của người khác.

**Cách làm (gợi ý từng bước):**

1. Vẽ một sơ đồ quyết định bắt đầu từ câu "Giấy phép trên trang gốc là gì?", rẽ nhánh theo bốn câu hỏi ở mục 3, kết thúc ở một trong ba ô: *Dùng*, *Thay tài nguyên*, *Xin phép bằng văn bản*.
2. Thêm ở góc thẻ một bảng nhỏ sáu giấy phép CC kèm một dòng "được sửa và phát hành lại không?".
3. Thêm khuôn mẫu dòng TASL để điền.
4. Kiểm thẻ bằng ba tài nguyên thật bạn định dùng cho sách AR; ghi kết quả đi qua sơ đồ của từng tài nguyên dưới thẻ.

Công cụ gợi ý: Canva, Google Slides, hoặc một tệp HTML đơn giản.

**Chấm theo (10 điểm):** sơ đồ đi đúng thứ tự bốn câu hỏi và có đủ ba ô kết thúc (3đ) · phân biệt rõ nhánh tuyển tập với nhánh phái sinh, có quy tắc SA – NC và ND (3đ) · bảng giấy phép đúng (2đ) · ba tài nguyên thật được đưa qua sơ đồ cho kết quả đúng (2đ).

### Nguồn tham khảo

- UNESCO (2019). *Recommendation on Open Educational Resources (OER).* — [unesco.org](https://www.unesco.org/en/legal-affairs/recommendation-open-educational-resources-oer)
- Wiley, D. *Defining the "Open" in Open Content and Open Educational Resources.* — [opencontent.org](https://opencontent.org/definition/)
- Creative Commons. *About CC Licenses.* — [creativecommons.org](https://creativecommons.org/share-your-work/cclicenses/)
- Hilton, J. (2020). Open educational resources, student efficacy, and user perceptions: a synthesis of research published between 2015 and 2018. *Educational Technology Research and Development, 68*(3), 853–876.
- Clinton, V. & Khan, S. (2019). Efficacy of open textbook adoption on learning performance and course withdrawal rates: a meta-analysis. *AERA Open, 5*(3).
- Colvard, N. B., Watson, C. E. & Park, H. (2018). The impact of open educational resources on various student success metrics. *International Journal of Teaching and Learning in Higher Education, 30*(2), 262–276.
""",
    "quiz": {
        "title": "Kiểm tra Bài 5.8",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "oerc-dinh-nghia",
                "type": "mcq",
                "prompt": "Điểm then chốt trong định nghĩa OER của UNESCO 2019 là gì?",
                "explanation": "Định nghĩa dựa trên trạng thái pháp lý: phạm vi công cộng hoặc giấy phép mở cho dùng lại, sửa, phân phối lại. Giá bằng không chỉ là quyền được xem.",
                "points": 2,
                "options": [
                    {"label": "Thuộc phạm vi công cộng hoặc có giấy phép mở cho dùng lại, chỉnh sửa và phân phối lại", "isCorrect": True},
                    {"label": "Không thu phí người học", "isCorrect": False, "misconception": "cngdtt.free-equals-open"},
                    {"label": "Đăng công khai trên một nền tảng lớn", "isCorrect": False, "misconception": "cngdtt.free-equals-open"},
                    {"label": "Do một trường đại học uy tín biên soạn", "isCorrect": False},
                ],
            },
            {
                "key": "oerc-5r",
                "type": "ordering",
                "prompt": "Sắp xếp năm quyền của khung 5R theo đúng thứ tự Wiley trình bày:",
                "explanation": "Retain (giữ) → Reuse (dùng lại) → Revise (sửa) → Remix (phối trộn) → Redistribute (phân phối lại).",
                "points": 1,
                "sequence": ["Retain · Giữ", "Reuse · Dùng lại", "Revise · Sửa", "Remix · Phối trộn", "Redistribute · Phân phối lại"],
            },
            {
                "key": "oerc-dieu-kien",
                "type": "matching",
                "prompt": "Nối mỗi điều kiện của Creative Commons với ý nghĩa:",
                "explanation": "BY ghi công; SA giữ cùng giấy phép cho bản sửa; NC phi thương mại; ND chỉ dùng nguyên trạng.",
                "points": 2,
                "pairs": [
                    {"left": "BY", "right": "Phải ghi công tác giả"},
                    {"left": "SA", "right": "Bản sửa đổi mang cùng giấy phép"},
                    {"left": "NC", "right": "Không dùng chủ yếu nhằm lợi ích thương mại"},
                    {"left": "ND", "right": "Chỉ dùng nguyên trạng, không phát hành bản sửa"},
                ],
            },
            {
                "key": "oerc-nd",
                "type": "true_false",
                "prompt": "Giấy phép CC BY-ND cấm mọi việc dùng tài nguyên trong lớp học.",
                "explanation": "Sai. ND cho dùng nguyên trạng, kể cả trong giáo dục; nó chỉ cấm phát hành bản đã sửa.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "oerc-tasl",
                "type": "mcq",
                "prompt": "Dòng ghi nguồn nào đủ bốn thành phần TASL?",
                "explanation": "TASL cần tên tác phẩm, tác giả, nguồn (đường dẫn gốc) và giấy phép. Ba lựa chọn còn lại đều thiếu ít nhất hai thành phần.",
                "points": 2,
                "options": [
                    {"label": "\"Gravity and Orbits\" · PhET Interactive Simulations, University of Colorado Boulder · phet.colorado.edu · CC BY 4.0", "isCorrect": True},
                    {"label": "Nguồn: Wikimedia Commons", "isCorrect": False, "misconception": "cngdtt.attribution-replaces-license"},
                    {"label": "Mô phỏng PhET, CC BY", "isCorrect": False},
                    {"label": "Nguồn: Google Hình ảnh", "isCorrect": False, "misconception": "cngdtt.attribution-replaces-license"},
                ],
            },
            {
                "key": "oerc-tuyen-tap",
                "type": "mcq",
                "prompt": "Trang 2 đặt nguyên trạng một ảnh CC BY-NC, trang 5 đặt nguyên trạng một ảnh CC BY-SA. Có cần xét tương thích giấy phép giữa hai ảnh không?",
                "explanation": "Không. Đặt cạnh nhau nguyên trạng là tuyển tập; mỗi phần giữ giấy phép riêng và được ghi nguồn tại chỗ.",
                "points": 2,
                "options": [
                    {"label": "Không, đây là tuyển tập; mỗi ảnh giữ giấy phép riêng", "isCorrect": True},
                    {"label": "Có, và vì NC với SA xung khắc nên không được dùng cả hai", "isCorrect": False, "misconception": "cngdtt.collection-as-derivative"},
                    {"label": "Có, cả sản phẩm phải mang CC BY-NC-SA", "isCorrect": False, "misconception": "cngdtt.collection-as-derivative"},
                    {"label": "Không, vì dùng cho giáo dục", "isCorrect": False, "misconception": "cngdtt.education-exempts-license"},
                ],
            },
            {
                "key": "oerc-phai-sinh",
                "type": "mcq",
                "prompt": "Bạn sửa một ảnh CC BY rồi ghép lẫn với một sơ đồ CC BY-SA thành một hình mới. Hình mới mang giấy phép gì?",
                "explanation": "Ghép lẫn là phái sinh; SA đòi sản phẩm mang BY-SA, BY không cản điều đó.",
                "points": 2,
                "options": [
                    {"label": "CC BY-SA", "isCorrect": True},
                    {"label": "CC BY", "isCorrect": False},
                    {"label": "Tuỳ chọn, miễn ghi công cả hai", "isCorrect": False, "misconception": "cngdtt.attribution-replaces-license"},
                    {"label": "Không ghép được", "isCorrect": False},
                ],
            },
            {
                "key": "oerc-sa-nc",
                "type": "mcq",
                "prompt": "Vì sao một tài nguyên CC BY-SA không ghép phái sinh được với một tài nguyên CC BY-NC?",
                "explanation": "SA đòi sản phẩm mang đúng BY-SA (cho phép thương mại), NC đòi sản phẩm phi thương mại. Không giấy phép nào thoả cả hai điều kiện.",
                "points": 2,
                "options": [
                    {"label": "SA đòi sản phẩm mang đúng BY-SA, NC đòi phi thương mại; không giấy phép nào thoả cả hai", "isCorrect": True},
                    {"label": "Vì hai tác giả khác nhau", "isCorrect": False},
                    {"label": "Vì NC cấm mọi việc chỉnh sửa", "isCorrect": False},
                    {"label": "Thật ra ghép được, chỉ cần ghi công cả hai", "isCorrect": False, "misconception": "cngdtt.attribution-replaces-license"},
                ],
            },
            {
                "key": "oerc-bang-chung",
                "type": "mcq",
                "prompt": "Kết luận nào về OER được bằng chứng ủng hộ tốt nhất?",
                "explanation": "Chi phí giảm, học tập nhìn chung không kém, tỉ lệ rút môn thấp hơn. Thiết kế bán thực nghiệm không đủ để nói OER làm học giỏi hơn.",
                "points": 2,
                "options": [
                    {"label": "Giảm chi phí, học tập nhìn chung không kém, có dấu hiệu giảm tỉ lệ rút môn", "isCorrect": True},
                    {"label": "OER làm người học giỏi hơn rõ rệt vì nhiều trường dùng", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "OER kém chất lượng hơn giáo trình thương mại", "isCorrect": False},
                    {"label": "Chưa có nghiên cứu nào", "isCorrect": False},
                ],
            },
            {
                "key": "oerc-ngoai-le",
                "type": "true_false",
                "prompt": "Một cuốn sách AR phát hành công khai cho nhiều trường có thể dùng ảnh bất kỳ trên mạng nhờ ngoại lệ giảng dạy của Luật Sở hữu trí tuệ.",
                "explanation": "Sai. Ngoại lệ giảng dạy hẹp và có điều kiện; sản phẩm phát hành công khai cần tài nguyên có giấy phép phù hợp hoặc thư cho phép.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "cngdtt.education-exempts-license"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
        ],
    },
}

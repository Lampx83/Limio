# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 1.4 · Đọc bằng chứng hiệu quả: effect size và những cạm bẫy",
    "durationMin": 55,
    "description": "Cách đọc một con số hiệu quả cho đúng: effect size tính thế nào, vì sao ngưỡng quen thuộc gây hiểu sai trong giáo dục, và năm cạm bẫy đặc trưng của nghiên cứu công nghệ giáo dục.",
    "objectives": [
        "Tính và diễn giải được effect size dạng Cohen d cho một so sánh hai nhóm",
        "Chỉ ra được ba thông tin bắt buộc phải có để một effect size đọc được",
        "Phát hiện được ít nhất ba cạm bẫy trong một báo cáo hiệu quả do nhà cung cấp công bố",
    ],
    "summary": [
        "Effect size chuẩn hoá khác biệt giữa hai nhóm theo độ lệch chuẩn, nên so sánh được giữa các nghiên cứu — nhưng chỉ khi biết nhóm đối chứng làm gì, đo bằng bài nào và đo sau bao lâu.",
        "Ngưỡng 0,2 – 0,5 – 0,8 của Cohen đến từ tâm lý học thực nghiệm; trong các thử nghiệm giáo dục quy mô lớn đo bằng bài chuẩn hoá, 0,20 đã là hiệu quả lớn.",
        "Tổng hợp nghiên cứu như EEF hữu ích vì quy đổi ra tháng tiến bộ và kèm chi phí, độ tin cậy; các bảng xếp hạng gộp mọi meta-analysis thì cần đọc thận trọng.",
        "Năm cạm bẫy hay gặp: nhóm đối chứng không làm gì, bài kiểm tra do người bán soạn, nghiên cứu quá ngắn, mẫu quá nhỏ, và người tài trợ cũng là người đo.",
    ],
    "body": r"""
## Effect size: con số nói gì và không nói gì

Khi so sánh hai nhóm, khác biệt điểm trung bình một mình không đọc được: hơn 6 điểm trên thang 100 là nhiều hay ít còn tuỳ mức độ phân tán của điểm số. **Effect size** giải quyết đúng chỗ đó bằng cách chia khác biệt trung bình cho độ lệch chuẩn.

> [!ghi-nho] Cohen d = (điểm trung bình nhóm thực nghiệm − điểm trung bình nhóm đối chứng) ÷ độ lệch chuẩn gộp. Kết quả đọc là: hai nhóm cách nhau bao nhiêu phần độ lệch chuẩn.

Ví dụ: nhóm dùng phần mềm đạt trung bình 72, nhóm đối chứng 66, độ lệch chuẩn gộp 15. Khi đó d = (72 − 66) ÷ 15 = 0,4. Một biến thể thường gặp là **Hedges g**, giống d nhưng hiệu chỉnh cho mẫu nhỏ; với mẫu lớn hai chỉ số gần như trùng nhau.

Ngưỡng quen thuộc 0,2 nhỏ – 0,5 vừa – 0,8 lớn do Jacob Cohen đề xuất, và nó bị dùng sai gần như ở mọi nơi. Ngưỡng ấy đến từ tâm lý học thực nghiệm trong phòng thí nghiệm, không phải từ các can thiệp giáo dục ngoài đời thật. Matthew Kraft (2020) tổng hợp hàng trăm thử nghiệm ngẫu nhiên có đối chứng trong giáo dục và cho thấy: với thử nghiệm quy mô lớn, đo bằng bài kiểm tra chuẩn hoá, **hiệu quả từ 0,20 trở lên đã thuộc nhóm lớn**, còn phần lớn can thiệp thật rơi vào khoảng dưới 0,10.

| Khung diễn giải | Nhỏ | Vừa | Lớn | Dùng cho |
|---|---|---|---|---|
| Cohen (1988) | 0,2 | 0,5 | 0,8 | Nghiên cứu tâm lý trong phòng thí nghiệm |
| Kraft (2020) | dưới 0,05 | 0,05 – 0,20 | từ 0,20 | Can thiệp giáo dục quy mô lớn, đo bằng bài chuẩn hoá |

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cùng một con số, hai cách đọc</div>
  <div style="min-width:32rem;position:relative;height:2.2rem;background:linear-gradient(90deg,rgba(13,148,136,.25),rgba(217,150,40,.3),rgba(220,38,38,.3));border-radius:.4rem;border:1px solid rgba(127,127,127,.3)"></div>
  <div style="min-width:32rem;display:flex;font-size:.95rem;margin:.3rem 0 0">
    <div style="flex:1">0</div><div style="flex:1">0,2</div><div style="flex:1">0,4</div><div style="flex:1">0,6</div><div style="flex:1">0,8</div><div style="flex:0 0 2rem;text-align:right">1,0</div>
  </div>
  <div style="min-width:32rem;display:flex;gap:.4rem;margin:.8rem 0 0">
    <div style="flex:0 0 9rem;font-size:1rem;font-weight:600;padding:.45rem .5rem;background:rgba(120,113,108,.85);color:#fff;border-radius:.35rem">Thang Cohen</div>
    <div style="flex:1;display:flex;gap:.3rem;font-size:1rem">
      <div style="flex:2;padding:.45rem;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;text-align:center">nhỏ · 0,2</div>
      <div style="flex:3;padding:.45rem;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;text-align:center">vừa · 0,5</div>
      <div style="flex:3;padding:.45rem;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;text-align:center">lớn · 0,8</div>
    </div>
  </div>
  <div style="min-width:32rem;display:flex;gap:.4rem;margin:.35rem 0 0">
    <div style="flex:0 0 9rem;font-size:1rem;font-weight:600;padding:.45rem .5rem;background:rgba(13,148,136,.88);color:#fff;border-radius:.35rem">Thang Kraft</div>
    <div style="flex:1;display:flex;gap:.3rem;font-size:1rem">
      <div style="flex:1;padding:.45rem;background:rgba(13,148,136,.14);border:1px solid rgba(13,148,136,.4);border-radius:.35rem;text-align:center">nhỏ · &lt;0,05</div>
      <div style="flex:2;padding:.45rem;background:rgba(13,148,136,.2);border:1px solid rgba(13,148,136,.45);border-radius:.35rem;text-align:center">vừa · 0,05–0,20</div>
      <div style="flex:5;padding:.45rem;background:rgba(13,148,136,.3);border:1px solid rgba(13,148,136,.55);border-radius:.35rem;text-align:center">lớn · từ 0,20 trở lên</div>
    </div>
  </div>
  <div style="font-size:1rem;opacity:.7;margin:.6rem 0 0;line-height:1.6">Một can thiệp d = 0,25 là <em>nhỏ</em> theo Cohen nhưng <em>lớn</em> theo Kraft. Chọn nhầm thang thì hoặc bỏ qua thứ đang có tác dụng, hoặc tin vào con số bất thường mà không đi tìm nguyên nhân.</div>
</div>
```

Hệ quả rất thực tế: khi một sản phẩm công bố d = 0,8, phản xạ đúng **không** phải là ấn tượng, mà là đi tìm lý do khiến con số lớn bất thường — mẫu nhỏ, bài kiểm tra do chính họ soạn, hay nhóm đối chứng không được dạy gì tương đương. Ba nguyên nhân này giải thích phần lớn các con số đẹp.

> [!canh-bao] Một effect size không kèm ba thông tin sau thì chưa đọc được: **nhóm đối chứng làm gì**, **đo bằng bài kiểm tra nào**, và **đo sau bao lâu**. Thiếu bất kỳ mảnh nào, cùng một con số có thể nghĩa là rất mạnh hoặc gần như vô nghĩa.

## Tổng hợp nghiên cứu: dùng gì và cẩn thận với gì

Một nghiên cứu đơn lẻ hiếm khi đủ để ra quyết định. **Phân tích tổng hợp** gộp nhiều nghiên cứu về cùng một câu hỏi để ước lượng hiệu quả chung, và đó là dạng bằng chứng mạnh nhất mà người thẩm định thường tiếp cận được.

Bộ công cụ hữu ích nhất cho công việc thực tế là **Teaching and Learning Toolkit** của Education Endowment Foundation (Anh). Nó có ba đặc điểm đáng học hỏi: quy đổi hiệu quả thành **số tháng tiến bộ thêm** cho dễ hiểu, luôn kèm **chi phí ước tính**, và luôn kèm **mức độ tin cậy của bằng chứng**. Ba cột này gộp lại cho một câu trả lời dùng được: can thiệp này đáng bao nhiêu tiền để đổi lấy bao nhiêu tháng tiến bộ, và ta chắc chắn tới đâu.

Ở phía cần thận trọng là các bảng xếp hạng gộp mọi phân tích tổng hợp thành một danh sách xếp hạng — kiểu bảng của *Visible Learning*. Chúng phổ biến vì tiện trích dẫn, nhưng giới phương pháp luận đã chỉ ra vài vấn đề: gộp các phân tích tổng hợp có chất lượng rất khác nhau vào cùng một thang, trộn các kết quả đo khác loại, và bỏ qua khác biệt bối cảnh giữa các nghiên cứu gốc.

> [!meo] Cách dùng an toàn: lấy bảng xếp hạng làm **danh sách gợi ý cần tra tiếp**, không lấy làm kết luận. Thấy một can thiệp xếp hạng cao, hãy lần về hai hoặc ba nghiên cứu gốc và đọc phần mô tả nhóm đối chứng.

Còn một hiện tượng luôn phải tính tới: **thiên lệch công bố**. Nghiên cứu tìm ra kết quả tích cực dễ được đăng hơn nghiên cứu không tìm thấy khác biệt. Nghĩa là kho tài liệu công khai vốn đã nghiêng về phía tích cực trước khi bạn bắt đầu đọc — và với công nghệ giáo dục, nơi phần lớn nghiên cứu do bên có lợi ích thực hiện, độ nghiêng còn lớn hơn.

### Thiết kế nghiên cứu: từ RCT tới các thiết kế bán thực nghiệm

Effect size chỉ có nghĩa nhân quả khi thiết kế cho phép suy luận nhân quả. Bốn thiết kế bạn sẽ gặp thường xuyên, xếp theo sức mạnh suy luận giảm dần:

| Thiết kế | Nguyên lý | Giả định then chốt | Rủi ro điển hình trong nghiên cứu công nghệ giáo dục |
|---|---|---|---|
| Thử nghiệm ngẫu nhiên có đối chứng | Phân nhóm ngẫu nhiên nên hai nhóm tương đương cả ở biến không quan sát được | Ngẫu nhiên hoá được thực hiện đúng, không rơi rớt lệch giữa hai nhóm | Rơi rớt lệch: học sinh yếu bỏ nhóm dùng phần mềm nhiều hơn, làm nhóm ấy đẹp lên giả tạo |
| Khác biệt kép | So sánh mức thay đổi trước — sau giữa nhóm can thiệp và nhóm không | Hai nhóm có xu hướng song song nếu không có can thiệp | Trường tự nguyện áp dụng sớm vốn đã đang đi lên nhanh hơn |
| Hồi quy gián đoạn | So sánh hai bên một ngưỡng phân bổ cứng | Không ai thao túng được vị trí quanh ngưỡng | Ngưỡng mềm: hiệu trưởng linh động cho vài em qua ngưỡng |
| Ghép điểm xu hướng | Ghép cặp người tham gia với người không tham gia theo đặc điểm quan sát được | Không còn khác biệt hệ thống ở biến **không** quan sát được | Động lực của giáo viên tình nguyện là biến không quan sát được và rất mạnh |

Chuẩn được dùng rộng nhất để xếp hạng chất lượng bằng chứng là bộ tiêu chí của **What Works Clearinghouse** (Bộ Giáo dục Hoa Kỳ): một nghiên cứu đạt chuẩn không giới hạn, đạt chuẩn có giới hạn, hay không đạt chuẩn — tuỳ vào ngẫu nhiên hoá, tỉ lệ rơi rớt và mức tương đương ban đầu giữa hai nhóm. Khi đọc một tổng quan, hãy tìm xem tác giả có áp một bộ tiêu chí như vậy không; nếu tổng quan gộp mọi nghiên cứu tìm được vào cùng một trung bình, kết quả nói nhiều về kho tài liệu hơn là về can thiệp.

### Ngẫu nhiên hoá theo lớp: hệ số tương quan nội cụm và cỡ mẫu thật

Đây là chỗ nghiên cứu giáo dục khác hẳn nghiên cứu y sinh, và là lỗi thống kê phổ biến nhất trong khoá luận ngành ta. Khi bạn bốc thăm **theo lớp** chứ không theo từng học sinh, các học sinh trong cùng một lớp giống nhau hơn so với hai học sinh bất kỳ — cùng giáo viên, cùng bạn bè, cùng địa bàn tuyển sinh. Mức độ giống nhau ấy đo bằng **hệ số tương quan nội cụm** ρ, trong giáo dục thường vào khoảng 0,10 đến 0,25 ở cấp lớp và cấp trường.

Hệ quả là cỡ mẫu hiệu dụng nhỏ hơn nhiều so với số học sinh đếm được. Hệ số nhân — gọi là **hiệu ứng thiết kế** — bằng:

> [!ghi-nho] Hiệu ứng thiết kế = 1 + (m − 1) × ρ, với *m* là số học sinh mỗi lớp và ρ là hệ số tương quan nội cụm.

Lấy m = 40 và ρ = 0,15: hiệu ứng thiết kế bằng 1 + 39 × 0,15 ≈ 6,85. Nghĩa là 400 học sinh trong 10 lớp cho lượng thông tin thống kê tương đương khoảng **58 học sinh độc lập**. Một nghiên cứu bốc thăm 4 lớp rồi báo cáo p < 0,05 dựa trên n = 160 gần như chắc chắn đã tính sai sai số chuẩn, và kết luận của nó không đứng vững.

```html
<div style="margin:1.3rem 0;display:flex;flex-wrap:wrap;gap:.8rem;align-items:stretch">
  <div style="flex:1 1 12rem;padding:.9rem;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;text-align:center">
    <div style="font-size:2rem;font-weight:700;line-height:1.2">400</div>
    <div style="font-size:1rem;line-height:1.5;opacity:.8">học sinh đếm được<br>10 lớp × 40 em</div>
  </div>
  <div style="flex:0 0 auto;display:flex;align-items:center;font-size:1.6rem;opacity:.5">→</div>
  <div style="flex:1 1 12rem;padding:.9rem;background:rgba(217,150,40,.14);border:1px solid rgba(217,150,40,.45);border-radius:.5rem;text-align:center">
    <div style="font-size:1.5rem;font-weight:700;line-height:1.2">÷ 6,85</div>
    <div style="font-size:1rem;line-height:1.5;opacity:.85">hiệu ứng thiết kế<br>1 + (40−1) × 0,15</div>
  </div>
  <div style="flex:0 0 auto;display:flex;align-items:center;font-size:1.6rem;opacity:.5">→</div>
  <div style="flex:1 1 12rem;padding:.9rem;background:rgba(220,38,38,.14);border:2px solid rgba(220,38,38,.5);border-radius:.5rem;text-align:center">
    <div style="font-size:2rem;font-weight:700;line-height:1.2">≈ 58</div>
    <div style="font-size:1rem;line-height:1.5;opacity:.85">quan sát độc lập<br>lượng thông tin thật</div>
  </div>
</div>
```

Đi cùng khái niệm này là **hiệu quả nhỏ nhất phát hiện được**: với thiết kế và cỡ mẫu đã cho, hiệu quả phải lớn tới mức nào thì nghiên cứu mới có khả năng phát hiện. Nghiên cứu công nghệ giáo dục hay rơi vào cảnh trớ trêu: cỡ mẫu chỉ đủ phát hiện hiệu quả từ 0,40 trở lên, trong khi hiệu quả thật của phần lớn can thiệp nằm dưới 0,10 — nên kết quả *không có khác biệt* của nó không nói được gì, còn kết quả *có khác biệt* thì đáng ngờ.

### Độ trung thực triển khai và quan hệ liều lượng — đáp ứng

Câu hỏi cuối trước khi tin một kết quả: can thiệp có thật sự được thực hiện như mô tả không? **Độ trung thực triển khai** đo khoảng cách giữa thiết kế trên giấy và thực tế lớp học — bao nhiêu phần trăm giáo viên dùng đủ số buổi, dùng đúng quy trình, dùng đủ thời lượng. Một nghiên cứu báo cáo *không có tác dụng* mà không báo cáo độ trung thực thì ta không biết đang đọc kết luận về can thiệp hay về việc triển khai đã không xảy ra.

Đối trọng của nó là **quan hệ liều lượng — đáp ứng**: nếu can thiệp thật sự có tác dụng, nhóm dùng nhiều hơn phải tiến bộ nhiều hơn. Đây là bằng chứng hỗ trợ mạnh, nhưng cẩn thận với chiều ngược lại của quan hệ nhân quả — học sinh chăm chỉ vốn đã học tốt hơn cũng chính là nhóm dùng phần mềm nhiều nhất.

## Năm cạm bẫy đặc trưng của nghiên cứu công nghệ giáo dục

| # | Cạm bẫy | Dấu hiệu nhận biết | Hỏi gì |
|---|---|---|---|
| 1 | Nhóm đối chứng không được gì tương đương | Nhóm đối chứng học bình thường, còn nhóm thực nghiệm có thêm giờ luyện tập và phản hồi | Khác biệt đến từ công nghệ hay từ việc có thêm luyện tập? |
| 2 | Bài kiểm tra do chính người bán soạn | Kết quả đo bằng bài trong hệ thống, sát nội dung sản phẩm đã dạy | Có kết quả nào đo bằng bài chuẩn hoá độc lập không? |
| 3 | Nghiên cứu quá ngắn | Thử nghiệm bốn tới sáu tuần, công bố ngay sau khi kết thúc | Hiệu quả còn lại bao nhiêu sau một học kỳ? |
| 4 | Mẫu quá nhỏ | Hai lớp, vài chục học sinh, effect size lớn bất thường | Có nghiên cứu nhân rộng trên nhiều trường không? |
| 5 | Người tài trợ cũng là người đo | Báo cáo do công ty thực hiện hoặc do nhóm được công ty tài trợ | Ai thiết kế nghiên cứu, ai giữ dữ liệu, ai quyết định công bố? |

Hai cạm bẫy đầu đáng nói thêm. Về cạm bẫy 1: nếu nhóm thực nghiệm được thêm bốn mươi phút luyện tập có phản hồi mỗi tuần còn nhóm đối chứng thì không, ta đang đo tác dụng của bốn mươi phút luyện tập chứ không đo tác dụng của phần mềm. Muốn kết luận về công nghệ, nhóm đối chứng phải được **một hoạt động tương đương về thời lượng và cường độ**, chỉ khác ở công nghệ.

Về cạm bẫy 2: đây là chỗ chênh lệch có thể đo được. Các tổng quan lớn cho thấy nghiên cứu dùng bài kiểm tra do người nghiên cứu tự soạn cho effect size **cao hơn đáng kể** so với nghiên cứu dùng bài chuẩn hoá độc lập — không nhất thiết vì gian dối, mà vì bài tự soạn tự nhiên bám sát đúng những gì can thiệp đã dạy.

> [!vi-du] Một sản phẩm luyện từ vựng công bố d = 0,9. Đọc kỹ: thử nghiệm 5 tuần, hai lớp ở một trường, bài kiểm tra cuối là bài trong chính ứng dụng, nhóm đối chứng không có hoạt động luyện từ vựng nào thêm, nghiên cứu do phòng nghiên cứu của công ty thực hiện. Năm cạm bẫy đủ cả năm. Con số 0,9 không sai về mặt tính toán — nó chỉ không nói gì về việc sản phẩm có tác dụng ở trường của bạn hay không.

## Đọc một tuyên bố hiệu quả trong mười phút

Quy trình sáu bước dưới đây áp được cho gần như mọi tài liệu tiếp thị hoặc bài báo phổ thông về hiệu quả một sản phẩm giáo dục.

1. **Tìm con số gốc.** Bao nhiêu phần trăm, bao nhiêu điểm, hay effect size bao nhiêu — và trên bao nhiêu người học.
2. **Tìm nhóm đối chứng.** Họ làm gì trong thời gian đó? Không tìm thấy mô tả nhóm đối chứng là một phát hiện, không phải một thiếu sót của bạn.
3. **Tìm công cụ đo.** Bài kiểm tra do ai soạn, có phải bài chuẩn hoá độc lập không.
4. **Tìm thời lượng.** Bao nhiêu tuần, và đo ngay sau can thiệp hay có đo lại sau vài tháng.
5. **Tìm nguồn tài trợ và tác giả.** Ai trả tiền, ai thiết kế, ai công bố.
6. **Quy đổi sang quyết định.** Nếu mọi thứ đều đúng như công bố, hiệu quả này đổi lấy bao nhiêu tiền và bao nhiêu giờ công của giáo viên trong bối cảnh của bạn?

Bước 6 là bước hay bị bỏ nhất và cũng là bước biến việc đọc nghiên cứu thành việc ra quyết định. Một hiệu quả nhỏ nhưng chi phí gần bằng không, triển khai được ngay, vẫn đáng làm hơn một hiệu quả lớn đòi thiết bị mới và mười buổi tập huấn.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Tính effect size cho ba tình huống sau và diễn giải theo thang của Kraft: (a) 68 so với 65, độ lệch chuẩn 12; (b) 74 so với 66, độ lệch chuẩn 20; (c) 55 so với 54, độ lệch chuẩn 8. Ghi lại tình huống nào bạn cần thêm thông tin gì trước khi kết luận.

### Nhóm 3–4 người (30 phút)

Giáo viên phát cho mỗi nhóm một trang giới thiệu sản phẩm có công bố hiệu quả. Nhóm chạy đủ sáu bước đọc trong mười phút, rồi soạn năm câu hỏi gửi nhà cung cấp. Yêu cầu: mỗi câu hỏi phải nhắm vào một cạm bẫy cụ thể trong bảng năm cạm bẫy, và phải hỏi được bằng một câu lịch sự trong cuộc họp.

### Bài tập về nhà — sản phẩm số (90 phút)

Dựng một **máy tính effect size** bằng bảng tính hoặc một trang web nhỏ, dùng được cho người không học thống kê. Yêu cầu sản phẩm:

- Đầu vào: điểm trung bình hai nhóm, độ lệch chuẩn, cỡ mẫu mỗi nhóm.
- Đầu ra: Cohen d, Hedges g, và **một câu diễn giải bằng tiếng Việt** theo thang phù hợp với can thiệp giáo dục.
- Ba cảnh báo tự động: khi cỡ mẫu nhỏ, khi effect size lớn bất thường, và một ô nhắc người dùng điền ba thông tin bắt buộc (nhóm đối chứng làm gì, đo bằng bài nào, đo sau bao lâu) — không điền đủ thì công cụ không đưa ra diễn giải.

Nộp sản phẩm kèm ba ca kiểm thử: một nghiên cứu thật, một ca cỡ mẫu nhỏ, một ca thiếu thông tin bắt buộc.

**Cách làm (gợi ý từng bước):**

1. Viết công thức trước trên giấy: độ lệch chuẩn gộp, Cohen d, rồi hệ số hiệu chỉnh của Hedges g.
2. Dựng bằng bảng tính (hàm điều kiện là đủ) hoặc một trang HTML với vài ô nhập và một đoạn mã tính toán.
3. Diễn giải bằng câu tiếng Việt theo thang phù hợp với can thiệp giáo dục, không dùng thang phòng thí nghiệm.
4. Ba cảnh báo tự động: cỡ mẫu dưới ngưỡng bạn tự đặt (nêu rõ ngưỡng và lý do), giá trị lớn bất thường, và thiếu ba thông tin bắt buộc.
5. Kiểm bằng một ví dụ đã biết đáp án trước khi tin vào công cụ của chính mình.

**Chấm theo:** công thức đúng, kiểm được bằng ca thử (4đ) · diễn giải đúng thang và dễ hiểu với người không học thống kê (3đ) · ba cảnh báo hoạt động (2đ) · ba ca kiểm thử có ca thiếu thông tin (1đ).

### Nguồn tham khảo

- Kraft, M. A. (2020). Interpreting effect sizes of education interventions. *Educational Researcher*, 49(4), 241–253.
- Education Endowment Foundation. *Teaching and Learning Toolkit* — [educationendowmentfoundation.org.uk](https://educationendowmentfoundation.org.uk/education-evidence/teaching-learning-toolkit)
- Cheung, A. C. K., & Slavin, R. E. (2016). How methodological features affect effect sizes in education. *Educational Researcher*, 45(5), 283–292.
- Cohen, J. (1988). *Statistical Power Analysis for the Behavioral Sciences* (2nd ed.). Lawrence Erlbaum.
- Bergeron, P.-J., & Rivard, L. (2017). How to engage in pseudoscience with real data: A criticism of John Hattie's arguments. *McGill Journal of Education*, 52(1), 237–246.
- What Works Clearinghouse. *Procedures and Standards Handbook* — tiêu chí xếp hạng chất lượng bằng chứng của Bộ Giáo dục Hoa Kỳ.
- Hedges, L. V., & Hedberg, E. C. (2007). Intraclass correlation values for planning group-randomized trials in education. *Educational Evaluation and Policy Analysis*, 29(1), 60–87.
""",
    "quiz": {
        "title": "Kiểm tra Bài 1.4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "1.4-tinh-d",
                "type": "fill_in",
                "prompt": "Nhóm thực nghiệm đạt trung bình 72 điểm, nhóm đối chứng 66 điểm, độ lệch chuẩn gộp là 15. Effect size Cohen d bằng bao nhiêu? (Ghi số thập phân, ví dụ 0,25)",
                "explanation": "d = (72 − 66) ÷ 15 = 0,4. Theo thang của Kraft cho can thiệp giáo dục quy mô lớn, đây là mức rất lớn — đủ lớn để phải đi tìm lý do trước khi tin.",
                "points": 2,
                "answers": ["0,4", "0.4", "0,40", "0.40"],
            },
            {
                "key": "1.4-ba-thong-tin",
                "type": "mcq",
                "prompt": "Ba thông tin bắt buộc phải có để một effect size đọc được là gì?",
                "explanation": "Nhóm đối chứng làm gì, đo bằng bài kiểm tra nào, và đo sau bao lâu. Thiếu một trong ba, con số không diễn giải được.",
                "points": 2,
                "options": [
                    {"label": "Nhóm đối chứng làm gì, công cụ đo là bài nào, và khoảng cách thời gian tới lúc đo", "isCorrect": True},
                    {"label": "Tên tác giả, năm xuất bản, và tạp chí đăng bài", "isCorrect": False},
                    {"label": "Giá sản phẩm, số trường đang dùng, và đánh giá của người dùng", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Chỉ cần con số là đủ, vì effect size đã được chuẩn hoá", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                ],
            },
            {
                "key": "1.4-nguong-kraft",
                "type": "mcq",
                "prompt": "Vì sao không nên áp thang 0,2 – 0,5 – 0,8 của Cohen cho các thử nghiệm giáo dục quy mô lớn?",
                "explanation": "Thang của Cohen đến từ nghiên cứu tâm lý trong phòng thí nghiệm. Trong can thiệp giáo dục thực địa đo bằng bài chuẩn hoá, hiệu quả từ 0,20 đã thuộc nhóm lớn, và phần lớn can thiệp rơi dưới 0,10.",
                "points": 2,
                "options": [
                    {"label": "Vì trong can thiệp giáo dục thực địa, hiệu quả từ khoảng 0,20 đã là lớn — áp thang Cohen sẽ coi gần như mọi can thiệp là thất bại", "isCorrect": True},
                    {"label": "Vì thang của Cohen đã bị rút lại và không còn được dùng", "isCorrect": False},
                    {"label": "Vì trong giáo dục hiệu quả luôn lớn hơn trong tâm lý học", "isCorrect": False},
                    {"label": "Vì effect size không áp dụng được cho nghiên cứu giáo dục", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-doi-chung-tuong-duong",
                "type": "mcq",
                "prompt": "Nhóm thực nghiệm dùng phần mềm 40 phút mỗi tuần; nhóm đối chứng học bình thường, không có hoạt động bổ sung. Kết quả nhóm thực nghiệm cao hơn. Kết luận nào chặt chẽ?",
                "explanation": "Ta chỉ kết luận được rằng thêm 40 phút luyện tập có phản hồi thì tốt hơn không thêm gì. Muốn quy công cho phần mềm, nhóm đối chứng phải có hoạt động tương đương về thời lượng và cường độ.",
                "points": 2,
                "options": [
                    {"label": "Thiết kế này không tách được tác dụng của phần mềm khỏi tác dụng của việc có thêm thời gian luyện tập", "isCorrect": True},
                    {"label": "Phần mềm có hiệu quả rõ ràng", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Kết quả này chứng minh công nghệ luôn tốt hơn cách dạy truyền thống", "isCorrect": False, "misconception": "cngdtt.media-teaches"},
                    {"label": "Cần tăng thời lượng dùng phần mềm lên để hiệu quả rõ hơn", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-bai-tu-soan",
                "type": "true_false",
                "prompt": "Nghiên cứu dùng bài kiểm tra do chính nhóm phát triển sản phẩm soạn thường cho effect size cao hơn nghiên cứu dùng bài chuẩn hoá độc lập.",
                "explanation": "Đúng, và chênh lệch này đã được đo trong các tổng quan phương pháp luận. Bài tự soạn bám sát đúng nội dung can thiệp đã dạy, nên lợi thế nghiêng về nhóm thực nghiệm ngay từ khâu thiết kế công cụ đo.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-nam-cam-bay",
                "type": "matching",
                "prompt": "Ghép mỗi dấu hiệu trong một báo cáo hiệu quả với cạm bẫy tương ứng.",
                "explanation": "Nhận diện nhanh năm cạm bẫy là kỹ năng đọc cốt lõi: hầu hết báo cáo tiếp thị dính ít nhất hai trong số này.",
                "points": 3,
                "pairs": [
                    {"left": "Thử nghiệm kéo dài 5 tuần, công bố ngay khi kết thúc", "right": "Nghiên cứu quá ngắn, chưa loại được hiệu ứng mới lạ"},
                    {"left": "Kết quả đo bằng bài kiểm tra trong chính ứng dụng", "right": "Công cụ đo do bên có lợi ích soạn"},
                    {"left": "Hai lớp tại một trường, effect size 0,9", "right": "Mẫu quá nhỏ nên hiệu quả dễ bị phóng đại"},
                    {"left": "Báo cáo do phòng nghiên cứu của công ty thực hiện và công bố", "right": "Người tài trợ đồng thời là người đo"},
                ],
            },
            {
                "key": "1.4-eef-ba-cot",
                "type": "mcq",
                "prompt": "Bộ công cụ của Education Endowment Foundation đáng học ở chỗ nào khi trình bày bằng chứng?",
                "explanation": "Nó quy đổi hiệu quả thành số tháng tiến bộ, kèm chi phí ước tính và kèm mức độ tin cậy của bằng chứng — ba cột gộp lại mới đủ cho một quyết định.",
                "points": 2,
                "options": [
                    {"label": "Trình bày đồng thời hiệu quả quy ra tháng tiến bộ, chi phí, và mức độ tin cậy của bằng chứng", "isCorrect": True},
                    {"label": "Xếp hạng mọi can thiệp thành một danh sách từ cao xuống thấp", "isCorrect": False},
                    {"label": "Chỉ đưa các can thiệp có effect size trên 0,8", "isCorrect": False},
                    {"label": "Tổng hợp ý kiến chuyên gia thay cho nghiên cứu thực nghiệm", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-thien-lech-cong-bo",
                "type": "mcq",
                "prompt": "Thiên lệch công bố ảnh hưởng thế nào tới bức tranh bằng chứng về công nghệ giáo dục?",
                "explanation": "Nghiên cứu có kết quả tích cực dễ được đăng hơn, nên kho tài liệu công khai đã nghiêng về phía tích cực. Với lĩnh vực mà nhiều nghiên cứu do bên có lợi ích thực hiện, độ nghiêng còn lớn hơn.",
                "points": 2,
                "options": [
                    {"label": "Kho tài liệu công khai nghiêng về kết quả tích cực, nên hiệu quả trung bình thấy được thường cao hơn thực tế", "isCorrect": True},
                    {"label": "Không ảnh hưởng gì vì bình duyệt đã loại bỏ nghiên cứu kém", "isCorrect": False},
                    {"label": "Chỉ ảnh hưởng tới nghiên cứu y sinh, không ảnh hưởng tới giáo dục", "isCorrect": False},
                    {"label": "Làm cho các nghiên cứu tiêu cực được chú ý quá mức", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-bang-xep-hang",
                "type": "mcq",
                "prompt": "Cách dùng an toàn nhất với các bảng xếp hạng gộp nhiều phân tích tổng hợp thành một danh sách hiệu quả là gì?",
                "explanation": "Dùng làm danh sách gợi ý để tra tiếp, rồi lần về nghiên cứu gốc — vì các bảng này gộp những phân tích có chất lượng và bối cảnh rất khác nhau vào cùng một thang.",
                "points": 2,
                "options": [
                    {"label": "Coi là danh sách gợi ý cần tra tiếp, rồi đọc trực tiếp vài nghiên cứu gốc", "isCorrect": True},
                    {"label": "Coi là kết luận cuối cùng vì đã tổng hợp rất nhiều nghiên cứu", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Bỏ qua hoàn toàn vì mọi tổng hợp đều không đáng tin", "isCorrect": False},
                    {"label": "Chỉ dùng các mục xếp hạng cao nhất và không cần xem gì thêm", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-quyet-dinh",
                "type": "mcq",
                "prompt": "Bước cuối trong quy trình sáu bước — quy đổi sang quyết định — đòi hỏi cân nhắc điều gì?",
                "explanation": "Hiệu quả phải được đặt cạnh chi phí tiền bạc và giờ công của giáo viên trong bối cảnh cụ thể. Hiệu quả nhỏ mà gần như không tốn gì có thể đáng làm hơn hiệu quả lớn đòi đầu tư nặng.",
                "points": 2,
                "options": [
                    {"label": "Hiệu quả này đổi lấy bao nhiêu tiền và bao nhiêu giờ công của giáo viên trong bối cảnh của mình", "isCorrect": True},
                    {"label": "Sản phẩm này có phải công nghệ mới nhất hiện nay không", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Có bao nhiêu trường trong tỉnh đã mua sản phẩm", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Giao diện sản phẩm có hiện đại không", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-nguon-tai-tro",
                "type": "mcq",
                "prompt": "Nên xử lý thế nào với một báo cáo hiệu quả do chính nhà cung cấp thực hiện?",
                "explanation": "Không loại bỏ, nhưng đọc như một lập luận có lợi ích: xem ai thiết kế nghiên cứu, ai giữ dữ liệu, ai quyết định công bố, và tìm kết quả đo bằng công cụ độc lập.",
                "points": 2,
                "options": [
                    {"label": "Vẫn đọc, nhưng như một lập luận có lợi ích: kiểm ai thiết kế, ai giữ dữ liệu, ai quyết định công bố", "isCorrect": True},
                    {"label": "Chấp nhận vì công ty hiểu sản phẩm của họ nhất", "isCorrect": False, "misconception": "cngdtt.vendor-evidence"},
                    {"label": "Loại bỏ ngay lập tức, không cần đọc", "isCorrect": False},
                    {"label": "Chỉ cần kiểm tra xem báo cáo có trình bày đẹp và chuyên nghiệp không", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-viet-luan-phe-phan",
                "type": "essay",
                "prompt": "Tìm một tuyên bố hiệu quả của một sản phẩm công nghệ giáo dục đang bán tại Việt Nam. Viết 250–350 từ chạy đủ sáu bước đọc, chỉ ra ít nhất ba cạm bẫy hoặc ba chỗ thiếu thông tin, và kết luận bạn sẽ khuyến nghị gì cho một hiệu trưởng đang cân nhắc mua.",
                "points": 5,
            },
            {
                "key": "1.4-hieu-ung-thiet-ke",
                "type": "fill_in",
                "prompt": "Một nghiên cứu bốc thăm theo lớp, mỗi lớp 40 học sinh, hệ số tương quan nội cụm ρ = 0,15. Hiệu ứng thiết kế bằng bao nhiêu? (Làm tròn hai chữ số thập phân, ví dụ 3,25)",
                "explanation": "Hiệu ứng thiết kế = 1 + (m − 1) × ρ = 1 + 39 × 0,15 = 6,85. Nghĩa là 400 học sinh trong 10 lớp chỉ cho lượng thông tin thống kê tương đương khoảng 58 học sinh độc lập.",
                "points": 3,
                "answers": ["6,85", "6.85"],
            },
            {
                "key": "1.4-cum-sai-so",
                "type": "mcq",
                "prompt": "Một khoá luận bốc thăm 4 lớp (2 lớp thực nghiệm, 2 lớp đối chứng), tổng 160 học sinh, rồi kiểm định t trên 160 quan sát và báo cáo p < 0,05. Sai lầm ở đâu?",
                "explanation": "Đơn vị được bốc thăm là lớp chứ không phải học sinh. Bỏ qua tương quan nội cụm làm sai số chuẩn bị ước lượng thấp, khiến p nhỏ giả tạo — cỡ mẫu hiệu dụng gần với 4 hơn với 160.",
                "points": 3,
                "options": [
                    {"label": "Phân tích ở cấp học sinh trong khi ngẫu nhiên hoá ở cấp lớp, nên sai số chuẩn bị ước lượng quá thấp", "isCorrect": True},
                    {"label": "Cỡ mẫu 160 là quá lớn nên p luôn nhỏ", "isCorrect": False},
                    {"label": "Không có sai lầm nào nếu hai nhóm tương đương ban đầu", "isCorrect": False},
                    {"label": "Lỗi duy nhất là chưa hiệu chỉnh Hedges g cho mẫu nhỏ", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-fidelity",
                "type": "mcq",
                "prompt": "Một nghiên cứu kết luận phần mềm không có tác dụng, nhưng không báo cáo độ trung thực triển khai. Vì sao đây là thiếu sót nghiêm trọng?",
                "explanation": "Không có số liệu về mức độ can thiệp thật sự được thực hiện, ta không phân biệt được kết luận về can thiệp với kết luận về việc triển khai đã không xảy ra.",
                "points": 2,
                "options": [
                    {"label": "Không biết can thiệp có thật sự được thực hiện như thiết kế hay không, nên không diễn giải được kết quả âm tính", "isCorrect": True},
                    {"label": "Vì thiếu độ trung thực thì không tính được effect size", "isCorrect": False},
                    {"label": "Vì mọi nghiên cứu âm tính đều sai", "isCorrect": False},
                    {"label": "Không nghiêm trọng, vì kết quả âm tính luôn đáng tin hơn kết quả dương tính", "isCorrect": False},
                ],
            },
            {
                "key": "1.4-thiet-ke-suy-luan",
                "type": "matching",
                "prompt": "Ghép mỗi thiết kế nghiên cứu với giả định then chốt của nó.",
                "explanation": "Mỗi thiết kế mua quyền suy luận nhân quả bằng một giả định khác nhau; đọc nghiên cứu là kiểm xem giả định ấy có hợp lý trong bối cảnh cụ thể không.",
                "points": 3,
                "pairs": [
                    {"left": "Thử nghiệm ngẫu nhiên có đối chứng", "right": "Ngẫu nhiên hoá thực hiện đúng và không có rơi rớt lệch giữa hai nhóm"},
                    {"left": "Khác biệt kép", "right": "Hai nhóm có xu hướng thay đổi song song nếu không có can thiệp"},
                    {"left": "Hồi quy gián đoạn", "right": "Không ai thao túng được vị trí quanh ngưỡng phân bổ"},
                    {"left": "Ghép điểm xu hướng", "right": "Không còn khác biệt hệ thống ở các biến không quan sát được"},
                ],
            },
        ],
    },
}

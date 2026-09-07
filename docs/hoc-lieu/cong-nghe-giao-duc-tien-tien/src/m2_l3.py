# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2.3 · Trợ giảng AI và hệ dạy học thông minh",
    "durationMin": 55,
    "description": "Kiến trúc bốn thành phần của hệ dạy học thông minh, bằng chứng hiệu quả tích luỹ ba mươi năm, chỗ trợ giảng dựa trên mô hình ngôn ngữ mạnh và yếu, và sáu nguyên tắc thiết kế đối thoại dạy học.",
    "objectives": [
        "Mô tả được bốn thành phần của một hệ dạy học thông minh và vai trò từng thành phần",
        "So sánh được hiệu quả của gia sư người, hệ dạy học thông minh và trợ giảng dựa trên mô hình ngôn ngữ bằng số liệu",
        "Viết được chỉ dẫn hệ thống cho trợ giảng giữ được vật lộn hiệu quả thay vì đưa đáp án",
    ],
    "summary": [
        "Hệ dạy học thông minh cổ điển gồm mô hình miền, mô hình người học, mô hình dạy học và giao diện; sức mạnh của nó nằm ở việc bám từng bước giải chứ không chỉ chấm đáp án cuối.",
        "VanLehn (2011) cho thấy hệ dạy học thông minh đạt hiệu quả gần bằng gia sư người (0,76 so với 0,79), và cả hai đều thấp hơn con số hai độ lệch chuẩn thường được trích dẫn từ Bloom.",
        "Trợ giảng dựa trên mô hình ngôn ngữ mạnh ở đối thoại tự do và phủ được mọi môn, nhưng không có mô hình miền nên không biết người học sai ở bước nào nếu ta không thiết kế cho nó biết.",
        "Sáu nguyên tắc thiết kế: không đưa đáp án, chẩn đoán trước khi gợi ý, giữ vật lộn hiệu quả, giới hạn phạm vi, chống chiều lòng, và có đường chuyển tiếp sang giáo viên.",
    ],
    "body": r"""
## Kiến trúc cổ điển: bốn thành phần và ý nghĩa của từng cái

Trước khi có mô hình ngôn ngữ lớn, ngành đã có ba mươi năm nghiên cứu **hệ dạy học thông minh**. Kiến trúc chuẩn gồm bốn thành phần, và mỗi thành phần trả lời một câu hỏi khác nhau:

| Thành phần | Trả lời câu hỏi | Hiện thực điển hình |
|---|---|---|
| Mô hình miền | Nội dung này gồm những gì, giải bài này đi qua những bước nào | Tập luật giải, đồ thị kỹ năng, lời giải mẫu từng bước |
| Mô hình người học | Người học này đã nắm được gì, đang hổng gì | Ước lượng xác suất thành thạo từng kỹ năng, danh sách lỗi tư duy đang mắc |
| Mô hình dạy học | Bây giờ nên làm gì: gợi ý, hỏi lại, cho bài mới hay chuyển chủ đề | Luật chọn hành động dựa trên trạng thái người học |
| Giao diện | Người học và hệ thống trao đổi thế nào | Ô nhập từng bước giải, bảng vẽ, đối thoại |

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Vòng lặp của một hệ dạy học thông minh</div>
  <div style="min-width:34rem;display:flex;align-items:center;gap:.4rem">
    <div style="flex:1;padding:.7rem .6rem;background:rgba(217,150,40,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Giao diện</strong><br>người học nhập một bước giải</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Mô hình miền</strong><br>bước này có hợp lệ không, sai ở đâu</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Mô hình người học</strong><br>cập nhật xác suất thành thạo từng kỹ năng</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Mô hình dạy học</strong><br>gợi ý, hỏi lại hay cho bài mới</div>
  </div>
  <div style="min-width:34rem;text-align:center;font-size:1rem;opacity:.7;margin:.5rem 0 0">↺ vòng lặp chạy lại ở mỗi bước giải, không đợi tới đáp án cuối</div>
</div>
```

Hai kỹ thuật cốt lõi cần gọi đúng tên. **Bám vết lời giải** là việc hệ thống so từng bước người học làm với các bước hợp lệ trong mô hình miền, nhờ đó phản hồi ngay tại bước sai chứ không đợi tới đáp án cuối. **Bám vết tri thức** là việc liên tục cập nhật ước lượng xác suất người học đã thành thạo từng kỹ năng dựa trên chuỗi đúng sai — đây chính là nội dung Module 3 và cũng là thứ hệ thống của các bạn đang dùng để học học phần này vận hành bên trong.

> [!ghi-nho] Điểm mạnh quyết định của hệ dạy học thông minh không phải là nó biết đáp án, mà là nó biết **lời giải gồm những bước nào** — nên nó nói được *em sai ở bước quy đồng*, thay vì chỉ nói *sai rồi*.

## Bằng chứng ba mươi năm: những con số phải thuộc

Benjamin Bloom (1984) đặt ra bài toán nổi tiếng: học sinh được kèm một thầy một trò đạt kết quả cao hơn khoảng **hai độ lệch chuẩn** so với lớp học thông thường, và câu hỏi của ngành là làm sao đạt được mức đó ở quy mô lớn. Con số hai sigma này được trích dẫn khắp nơi, thường bị bỏ mất ba điều kiện đi kèm: nó đến từ một số ít nghiên cứu quy mô nhỏ, kèm học tập tới mức thành thạo, và đo trên bài kiểm tra do chính nhóm nghiên cứu soạn.

Hai phân tích tổng hợp sau đó cho bức tranh chắc chắn hơn:

| Nguồn | Đối tượng | Kết quả |
|---|---|---|
| VanLehn (2011) | So sánh gia sư người, hệ dạy học thông minh bám từng bước, và hệ chỉ phản hồi ở đáp án cuối | Gia sư người **d ≈ 0,79**; hệ dạy học thông minh **d ≈ 0,76**; khoảng cách giữa hai loại nhỏ hơn nhiều so với giả định trước đó |
| Kulik & Fletcher (2016) | 50 đánh giá về hệ dạy học thông minh | Hiệu quả trung vị **0,66** độ lệch chuẩn, tức nâng học sinh trung bình từ phân vị 50 lên khoảng phân vị 75 |

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Effect size — đặt cạnh nhau để thấy đâu là kỳ vọng thực tế</div>
  <div style="display:flex;flex-direction:column;gap:.35rem">
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem;line-height:1.4">Bloom (1984), kèm điều kiện hẹp</div><div style="flex:1"><div style="width:100%;background:rgba(120,113,108,.55);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem;border:1px dashed rgba(255,255,255,.5)">≈ 2,0 — trích dẫn nhiều, không phải chuẩn để so</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem;line-height:1.4">Gia sư người · VanLehn 2011</div><div style="flex:1"><div style="width:40%;background:rgba(13,148,136,.9);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">0,79</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem;line-height:1.4">Hệ dạy học thông minh · VanLehn 2011</div><div style="flex:1"><div style="width:38%;background:rgba(37,99,235,.9);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">0,76</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem;line-height:1.4">Hệ dạy học thông minh · Kulik &amp; Fletcher 2016</div><div style="flex:1"><div style="width:33%;background:rgba(124,58,237,.9);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">0,66 (trung vị)</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem;line-height:1.4">Phần lớn can thiệp giáo dục quy mô lớn</div><div style="flex:1"><div style="width:6%;min-width:5.5rem;background:rgba(217,150,40,.9);color:#fff;padding:.35rem .4rem;border-radius:.3rem;font-size:1rem">&lt; 0,10</div></div></div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Kỳ vọng thực tế cho một hệ tốt nằm quanh <strong>0,6 – 0,8</strong>, và ngay mức đó đã cao hơn hẳn phần lớn can thiệp giáo dục khác. Vẫn phải áp bộ cảnh báo ở Bài 1.4 lên từng con số.</div>
</div>
```

Ba kết luận nghề nghiệp rút ra. Thứ nhất, **con số hai sigma không phải chuẩn để so**; kỳ vọng thực tế cho một hệ tốt là quanh 0,6 – 0,8, và ngay cả mức đó cũng cao hơn hẳn phần lớn can thiệp giáo dục khác. Thứ hai, **cái tạo ra hiệu quả là phản hồi theo từng bước**, không phải mức độ tinh vi của công nghệ — hệ chỉ chấm đáp án cuối cho hiệu quả thấp hơn rõ rệt. Thứ ba, khi đọc những con số này, hãy áp đúng bộ cảnh báo ở Bài 1.4: phần lớn nghiên cứu gốc đo bằng bài của chính nhóm phát triển, trên thời gian ngắn.

## Trợ giảng dựa trên mô hình ngôn ngữ: đổi chác gì lấy gì

| | Hệ dạy học thông minh cổ điển | Trợ giảng dựa trên mô hình ngôn ngữ |
|---|---|---|
| Phủ nội dung | Hẹp: mỗi hệ tốn hàng trăm giờ chuyên gia cho một chủ đề | Rộng gần như mọi môn, dựng trong vài ngày |
| Hiểu bước giải | Có mô hình miền tường minh nên định vị được lỗi | **Không có mô hình miền**: đoán chỗ sai từ văn bản, đúng nhiều nhưng sai không báo trước |
| Đối thoại | Cứng, theo kịch bản | Tự nhiên, người học hỏi lại bằng lời của mình được |
| Độ tin cậy | Cao và ổn định trong phạm vi đã thiết kế | Không lặp lại, có thể bịa lời giải và bịa rất trôi chảy |
| Dữ liệu để cải tiến | Nhật ký từng bước, phân tích được | Nhật ký hội thoại, khó quy về kỹ năng nếu không thiết kế trước |

Cách đọc bảng này: hai loại không thay thế nhau mà **bù cho nhau**. Xu hướng thiết kế đang tỏ ra hợp lý nhất là dùng cấu trúc của hệ cổ điển — mô hình miền, mô hình người học, luật chọn hành động — và dùng mô hình ngôn ngữ cho phần nó mạnh: diễn đạt phản hồi bằng lời tự nhiên, đọc hiểu câu hỏi lộn xộn của người học, sinh biến thể của cùng một bài.

Một hướng ứng dụng nữa đang cho kết quả đáng chú ý trong nghiên cứu gần đây là **trợ giảng cho gia sư người** thay vì thay thế họ: mô hình gợi ý cho gia sư nên hỏi gì tiếp theo, và phần lợi ích lớn nhất rơi vào nhóm gia sư ít kinh nghiệm. Đây là mẫu hình đáng chú ý cho bối cảnh Việt Nam, nơi nút thắt là năng lực sư phạm của lực lượng đông đảo chứ không phải thiếu công cụ cho học sinh.

## Sáu nguyên tắc thiết kế đối thoại dạy học

Chỉ dẫn hệ thống của một trợ giảng là nơi sư phạm được viết thành mã. Sáu nguyên tắc dưới đây nên có mặt trong mọi trợ giảng học tập, và mỗi cái đều kiểm được bằng ca kiểm thử.

1. **Không đưa lời giải đầy đủ khi chưa cần.** Đưa đáp án lấy mất phần vật lộn tạo ra việc học. Thang gợi ý chuẩn: hỏi lại để chẩn đoán → gợi ý hướng → gợi ý bước cụ thể → làm mẫu một bước tương tự → chỉ khi người học đã cạn phương án mới đưa lời giải đầy đủ.
2. **Chẩn đoán trước khi gợi ý.** Câu đầu tiên của trợ giảng phải là câu tìm hiểu người học đang nghĩ gì: *em đã thử cách nào rồi*, *em hiểu đề bài yêu cầu gì*. Không có chẩn đoán thì gợi ý chỉ là đoán mò có văn phong tốt.
3. **Giữ vật lộn hiệu quả, cắt vật lộn vô ích.** Vật lộn với nội dung thì giữ; vật lộn với giao diện, với cách diễn đạt đề bài, với thao tác nhập liệu thì cắt bỏ hoàn toàn.
4. **Giới hạn phạm vi tường minh.** Trợ giảng phải biết nói *phần này ngoài phạm vi bài học, em hỏi thầy cô nhé* — và điều đó chỉ xảy ra nếu chỉ dẫn hệ thống nêu rõ phạm vi, kèm hành vi khi ra ngoài phạm vi.
5. **Chống chiều lòng.** Chỉ dẫn phải buộc mô hình kiểm tra lập luận trước khi xác nhận, và yêu cầu nêu căn cứ khi nói *đúng rồi*. Ca kiểm thử bắt buộc: người học khẳng định chắc nịch một điều sai rồi hỏi lại.
6. **Có đường chuyển tiếp sang người.** Khi người học lặp lại cùng một lỗi ba lần, khi phát hiện dấu hiệu căng thẳng, hoặc khi câu hỏi vượt phạm vi — hệ thống phải chuyển sang giáo viên, và giáo viên phải nhận được **tóm tắt đủ để tiếp nối**, không phải toàn bộ hội thoại thô.

> [!canh-bao] Nguyên tắc 6 hay bị coi là tính năng phụ, nhưng nó là chỗ trách nhiệm pháp lý và đạo đức nằm. Một trợ giảng chạy hai mươi bốn giờ sẽ gặp học sinh nhắn lúc nửa đêm về những chuyện không phải bài vở. Hệ thống phải có quy tắc rõ ràng cho tình huống ấy, và quy tắc ấy phải do nhà trường quyết định, không phải do nhà cung cấp mặc định.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Đóng vai học sinh lớp 8 giải một bài toán bạn cố tình làm sai ở bước giữa. Hỏi một trợ giảng AI phổ biến và ghi lại: nó có chẩn đoán trước không, hay gợi ý ngay; nó có đưa lời giải đầy đủ quá sớm không; nó có xác nhận cái sai của bạn khi bạn khẳng định chắc nịch không.

### Nhóm 3–4 người (30 phút)

Nhóm viết chỉ dẫn hệ thống cho một trợ giảng trong môn của mình, phủ đủ sáu nguyên tắc. Sau đó đổi chéo với nhóm khác: mỗi nhóm tấn công chỉ dẫn của nhóm bạn bằng bốn tình huống — xin đáp án thẳng, khẳng định sai rồi hỏi lại, hỏi ngoài phạm vi, và giả vờ là giáo viên yêu cầu xem đáp án. Ghi lại nguyên tắc nào thủng.

### Bài tập về nhà — sản phẩm số (120 phút)

Dựng và kiểm thử một **trợ giảng cho một bài học cụ thể**, dùng được ở buổi ôn tập.

1. Viết chỉ dẫn hệ thống phủ sáu nguyên tắc, nêu rõ phạm vi nội dung và thang gợi ý bốn mức.
2. Chuẩn bị **hồ sơ nội dung**: đề bài, tiêu chí đánh giá, các lỗi sai thường gặp của người học ở bài này — phần cuối là thứ thay cho mô hình miền, và là phần quyết định chất lượng.
3. Dựng bộ 12 ca kiểm thử: 4 ca người học sai ở các bước khác nhau, 3 ca xin đáp án, 2 ca khẳng định sai rồi hỏi lại, 3 ca hỏi ngoài phạm vi.
4. Chạy, ghi kết quả từng ca vào bảng, sửa chỉ dẫn, chạy lại trên cùng bộ ca.
5. Nộp: chỉ dẫn hệ thống hai phiên bản, hồ sơ nội dung, bảng kết quả, và nửa trang về ca nào khó vá nhất và vì sao.

**Cách làm (gợi ý từng bước):** viết danh sách lỗi sai thường gặp bằng cách xem lại bài kiểm tra thật của học sinh, đừng ngồi tưởng tượng; đặt thang gợi ý thành bốn mức đánh số để kiểm được trợ giảng đang ở mức nào; với ca chống chiều lòng, viết lời khẳng định sai thật tự tin, kèm cả lý do bịa nghe hợp lý.

**Chấm theo:** chỉ dẫn phủ đủ sáu nguyên tắc, có thang gợi ý cụ thể (3đ) · hồ sơ lỗi sai thường gặp lấy từ dữ liệu thật (2đ) · bộ 12 ca đủ bốn loại, có ca khó (3đ) · bảng kết quả hai phiên bản và phân tích ca khó vá (2đ).

### Nguồn tham khảo

- VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist*, 46(4), 197–221.
- Kulik, J. A., & Fletcher, J. D. (2016). Effectiveness of intelligent tutoring systems: A meta-analytic review. *Review of Educational Research*, 86(1), 42–78.
- Bloom, B. S. (1984). The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring. *Educational Researcher*, 13(6), 4–16.
- Anderson, J. R., Corbett, A. T., Koedinger, K. R., & Pelletier, R. (1995). Cognitive tutors: Lessons learned. *The Journal of the Learning Sciences*, 4(2), 167–207.
- Koedinger, K. R., & Aleven, V. (2007). Exploring the assistance dilemma in experiments with cognitive tutors. *Educational Psychology Review*, 19, 239–264.
""",
    "quiz": {
        "title": "Kiểm tra Bài 2.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "2.3-bon-thanh-phan",
                "type": "matching",
                "prompt": "Ghép mỗi thành phần của hệ dạy học thông minh với câu hỏi nó trả lời.",
                "explanation": "Bốn thành phần trả lời bốn câu hỏi khác nhau; thiếu mô hình miền thì hệ thống không định vị được lỗi ở bước nào.",
                "points": 3,
                "pairs": [
                    {"left": "Mô hình miền", "right": "Giải bài này đi qua những bước nào"},
                    {"left": "Mô hình người học", "right": "Người học này đã nắm được gì, đang hổng gì"},
                    {"left": "Mô hình dạy học", "right": "Bây giờ nên gợi ý, hỏi lại hay chuyển chủ đề"},
                    {"left": "Giao diện", "right": "Người học và hệ thống trao đổi với nhau thế nào"},
                ],
            },
            {
                "key": "2.3-bam-vet-loi-giai",
                "type": "mcq",
                "prompt": "Bám vết lời giải cho phép hệ dạy học thông minh làm được điều gì mà hệ chỉ chấm đáp án cuối không làm được?",
                "explanation": "So từng bước người học làm với các bước hợp lệ trong mô hình miền, nhờ đó phản hồi ngay tại bước sai thay vì đợi tới đáp án cuối.",
                "points": 2,
                "options": [
                    {"label": "Phản hồi ngay tại bước sai, nói rõ sai ở bước nào", "isCorrect": True},
                    {"label": "Chấm điểm nhanh hơn", "isCorrect": False},
                    {"label": "Sinh được nhiều đề bài hơn", "isCorrect": False},
                    {"label": "Trò chuyện bằng ngôn ngữ tự nhiên", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-vanlehn-so-lieu",
                "type": "mcq",
                "prompt": "Theo VanLehn (2011), quan hệ giữa hiệu quả của gia sư người và hệ dạy học thông minh là gì?",
                "explanation": "Gia sư người d ≈ 0,79 và hệ dạy học thông minh d ≈ 0,76 — khoảng cách nhỏ hơn nhiều so với giả định trước đó, và cả hai đều thấp hơn con số hai sigma thường được trích từ Bloom.",
                "points": 2,
                "options": [
                    {"label": "Gần bằng nhau: khoảng 0,79 so với 0,76", "isCorrect": True},
                    {"label": "Gia sư người cao hơn khoảng hai độ lệch chuẩn", "isCorrect": False},
                    {"label": "Hệ dạy học thông minh cao hơn hẳn vì kiên nhẫn hơn", "isCorrect": False},
                    {"label": "Không so sánh được vì hai loại đo bằng thang khác nhau", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-hai-sigma",
                "type": "mcq",
                "prompt": "Khi ai đó trích con số hai độ lệch chuẩn của Bloom để quảng bá một sản phẩm AI gia sư, phản biện chuyên môn đúng là gì?",
                "explanation": "Con số ấy đến từ một số ít nghiên cứu quy mô nhỏ, kèm điều kiện học tới mức thành thạo, đo bằng bài của chính nhóm nghiên cứu. Các phân tích tổng hợp sau đó cho mức 0,66 – 0,79.",
                "points": 2,
                "options": [
                    {"label": "Đó không phải chuẩn để so: các tổng hợp sau cho mức 0,66 – 0,79, và điều kiện nghiên cứu gốc rất hẹp", "isCorrect": True},
                    {"label": "Con số ấy đã bị rút lại nên không còn giá trị", "isCorrect": False},
                    {"label": "Con số ấy chỉ đúng với môn toán", "isCorrect": False},
                    {"label": "Không có phản biện nào: đó là nghiên cứu kinh điển nên đáng tin", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                ],
            },
            {
                "key": "2.3-yeu-diem-llm",
                "type": "mcq",
                "prompt": "Điểm yếu cấu trúc của trợ giảng dựa trên mô hình ngôn ngữ so với hệ dạy học thông minh cổ điển là gì?",
                "explanation": "Không có mô hình miền tường minh: nó đoán chỗ sai từ văn bản, đúng nhiều nhưng khi sai thì không có cơ chế báo trước. Cách bù là cung cấp hồ sơ nội dung và danh sách lỗi sai thường gặp.",
                "points": 2,
                "options": [
                    {"label": "Không có mô hình miền tường minh nên không định vị chắc chắn được lỗi ở bước nào", "isCorrect": True},
                    {"label": "Không trò chuyện được bằng ngôn ngữ tự nhiên", "isCorrect": False},
                    {"label": "Chỉ dùng được cho một môn học duy nhất", "isCorrect": False},
                    {"label": "Không thể sinh biến thể của cùng một bài tập", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-thang-goi-y",
                "type": "ordering",
                "prompt": "Sắp xếp thang gợi ý của một trợ giảng theo thứ tự nên áp dụng.",
                "explanation": "Chẩn đoán trước, rồi gợi ý từ mức khái quát tới cụ thể, làm mẫu bước tương tự, và chỉ đưa lời giải đầy đủ khi người học đã cạn phương án.",
                "points": 3,
                "sequence": [
                    "Hỏi lại để biết người học đang nghĩ gì và đã thử cách nào",
                    "Gợi ý hướng tiếp cận mà chưa nêu bước cụ thể",
                    "Gợi ý bước cụ thể tiếp theo",
                    "Làm mẫu một bước tương tự trên bài khác",
                    "Đưa lời giải đầy đủ khi người học đã cạn phương án",
                ],
            },
            {
                "key": "2.3-vat-lon-huu-ich",
                "type": "mcq",
                "prompt": "Loại vật lộn nào trợ giảng nên cắt bỏ hoàn toàn, và loại nào nên giữ?",
                "explanation": "Giữ vật lộn với nội dung — đó là chỗ việc học diễn ra. Cắt vật lộn với giao diện, cách diễn đạt đề bài và thao tác nhập liệu, vì chúng chỉ tiêu tải nhận thức mà không dạy gì.",
                "points": 2,
                "options": [
                    {"label": "Giữ vật lộn với nội dung; cắt vật lộn với giao diện, cách diễn đạt đề và thao tác nhập liệu", "isCorrect": True},
                    {"label": "Cắt mọi vật lộn để người học tiến nhanh nhất", "isCorrect": False, "misconception": "cngdtt.tutor-gives-answer"},
                    {"label": "Giữ mọi vật lộn vì khó khăn luôn tốt cho việc học", "isCorrect": False},
                    {"label": "Cắt vật lộn với nội dung khó, giữ phần thao tác để rèn tính kiên nhẫn", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-dua-dap-an",
                "type": "mcq",
                "prompt": "Một trợ giảng luôn giải xong bài trong một lượt và trình bày lời giải rất rõ ràng. Đánh giá đúng về mặt sư phạm là gì?",
                "explanation": "Với mục tiêu học tập, đưa đáp án ngay lấy mất phần vật lộn tạo ra việc học. Cần đo bằng việc người học tự làm được gì sau đó, không bằng tốc độ giải bài.",
                "points": 2,
                "options": [
                    {"label": "Đó là điểm yếu sư phạm: nó rút ngắn đúng phần vật lộn tạo ra việc học", "isCorrect": True},
                    {"label": "Đó là ưu điểm lớn nhất của trợ giảng AI", "isCorrect": False, "misconception": "cngdtt.tutor-gives-answer"},
                    {"label": "Không liên quan tới sư phạm, chỉ là vấn đề tốc độ", "isCorrect": False},
                    {"label": "Tốt cho học sinh yếu, hại cho học sinh giỏi", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-chuyen-tiep-nguoi",
                "type": "mcq",
                "prompt": "Trợ giảng nên chuyển tiếp sang giáo viên trong tình huống nào, và chuyển kèm gì?",
                "explanation": "Khi người học lặp cùng một lỗi nhiều lần, khi có dấu hiệu căng thẳng, hoặc khi câu hỏi vượt phạm vi — kèm tóm tắt đủ để giáo viên tiếp nối, không phải toàn bộ hội thoại thô.",
                "points": 2,
                "options": [
                    {"label": "Khi lặp lỗi nhiều lần, có dấu hiệu căng thẳng hoặc vượt phạm vi; kèm bản tóm tắt đủ để giáo viên tiếp nối", "isCorrect": True},
                    {"label": "Chỉ khi hệ thống gặp lỗi kỹ thuật", "isCorrect": False},
                    {"label": "Không cần chuyển tiếp nếu trợ giảng đủ tốt", "isCorrect": False},
                    {"label": "Chuyển toàn bộ nhật ký hội thoại cho giáo viên trong mọi trường hợp", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-bu-tru",
                "type": "mcq",
                "prompt": "Hướng thiết kế kết hợp đang tỏ ra hợp lý nhất hiện nay là gì?",
                "explanation": "Giữ cấu trúc của hệ cổ điển — mô hình miền, mô hình người học, luật chọn hành động — và dùng mô hình ngôn ngữ cho phần nó mạnh: diễn đạt phản hồi, đọc hiểu câu hỏi tự do, sinh biến thể bài tập.",
                "points": 2,
                "options": [
                    {"label": "Giữ mô hình miền và mô hình người học, dùng mô hình ngôn ngữ để diễn đạt và đọc hiểu", "isCorrect": True},
                    {"label": "Bỏ hẳn kiến trúc cũ vì mô hình ngôn ngữ đã đủ mạnh", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Chỉ dùng hệ cổ điển vì mô hình ngôn ngữ không đáng tin", "isCorrect": False},
                    {"label": "Dùng hai hệ song song và cho người học tự chọn", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-tro-giang-cho-gia-su",
                "type": "mcq",
                "prompt": "Mẫu hình dùng AI hỗ trợ gia sư người thay vì thay thế họ có ý nghĩa gì với bối cảnh Việt Nam?",
                "explanation": "Nút thắt ở Việt Nam là năng lực sư phạm của lực lượng đông đảo chứ không phải thiếu công cụ cho học sinh; và trong nghiên cứu, phần lợi ích lớn nhất rơi vào nhóm người dạy ít kinh nghiệm.",
                "points": 2,
                "options": [
                    {"label": "Nhắm đúng nút thắt là năng lực sư phạm của lực lượng đông đảo, và có lợi nhất cho người dạy ít kinh nghiệm", "isCorrect": True},
                    {"label": "Giảm chi phí thiết bị cho học sinh", "isCorrect": False},
                    {"label": "Cho phép bỏ bớt giáo viên trong lớp đông", "isCorrect": False},
                    {"label": "Không có ý nghĩa đặc biệt so với trợ giảng cho học sinh", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-ca-chong-chieu-long",
                "type": "true_false",
                "prompt": "Bộ ca kiểm thử của một trợ giảng bắt buộc phải có ca người học khẳng định chắc nịch một điều sai rồi hỏi lại.",
                "explanation": "Đúng. Xu hướng chiều lòng người hỏi là rủi ro có hệ thống, nên phải kiểm bằng ca chuyên biệt chứ không tin vào một câu dặn trong chỉ dẫn.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-ho-so-loi-sai",
                "type": "mcq",
                "prompt": "Trong đồ án dựng trợ giảng, vì sao danh sách lỗi sai thường gặp lại là phần quyết định chất lượng?",
                "explanation": "Nó thay cho mô hình miền mà mô hình ngôn ngữ không có: biết trước người học hay sai ở đâu thì trợ giảng chẩn đoán được thay vì đoán mò, và phải lấy từ bài làm thật chứ không tưởng tượng.",
                "points": 2,
                "options": [
                    {"label": "Vì nó thay cho mô hình miền, cho phép trợ giảng chẩn đoán thay vì đoán — và phải lấy từ bài làm thật", "isCorrect": True},
                    {"label": "Vì nó giúp mô hình trả lời nhanh hơn", "isCorrect": False},
                    {"label": "Vì hội đồng yêu cầu có phụ lục", "isCorrect": False},
                    {"label": "Vì nó thay thế được bộ ca kiểm thử", "isCorrect": False},
                ],
            },
            {
                "key": "2.3-viet-luan-tro-giang",
                "type": "essay",
                "prompt": "Viết 250–350 từ thiết kế chỉ dẫn hệ thống cho một trợ giảng trong môn bạn định dạy: nêu phạm vi, thang gợi ý, cách chống chiều lòng, và quy tắc chuyển tiếp sang giáo viên. Với mỗi nguyên tắc, nêu kèm một ca kiểm thử chứng minh nó hoạt động.",
                "points": 5,
            },
        ],
    },
}

# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 1.1 · Nghiên cứu khoa học là gì và đặt câu hỏi nghiên cứu thế nào",
    "durationMin": 60,
    "description": "Phân biệt NCKH với tổng hợp thông tin; dùng khung FINER để kiểm một câu hỏi nghiên cứu có khả thi và có giá trị không; thu hẹp một chủ đề rộng thành câu hỏi cụ thể, đo được.",
    "objectives": [
        "Phân biệt được nghiên cứu khoa học với tổng hợp/trình bày lại thông tin có sẵn qua ví dụ cụ thể",
        "Áp dụng được khung FINER để đánh giá một câu hỏi nghiên cứu có khả thi và có giá trị không",
        "Thu hẹp được một chủ đề rộng thành ít nhất ba câu hỏi nghiên cứu cụ thể, đo được",
        "Nhận diện được lỗi câu hỏi quá rộng, câu hỏi dạng có/không, và nhầm chủ đề với câu hỏi trong bài của người khác",
    ],
    "summary": [
        "NCKH tạo ra hoặc kiểm chứng một câu trả lời chưa có sẵn, bằng phương pháp người khác lặp lại và kiểm tra được; tổng hợp tài liệu chỉ là bước chuẩn bị, không phải sản phẩm cuối.",
        "Một câu hỏi nghiên cứu tốt phải khả thi, thú vị với người ngoài mình, có phần mới, đạo đức được và liên quan tới ai đó ngoài người hỏi — năm chữ đầu của FINER.",
        "Đề tài là vùng đất, câu hỏi nghiên cứu là một điểm cụ thể có thể trả lời bằng dữ liệu. Nhầm hai thứ này là lỗi phổ biến nhất ở người mới làm NCKH.",
        "Câu hỏi dạng có/không đóng cửa phân tích ngay từ đầu; câu hỏi mở bằng 'ở mức nào', 'khác nhau ra sao', 'qua cơ chế nào' mới tạo chỗ cho dữ liệu lên tiếng.",
    ],
    "splitSections": True,
    "body": r"""
Một đề bài trên lớp luôn có sẵn câu hỏi — thầy cô ra đề, bạn trả lời. Nghiên cứu khoa học đảo ngược thứ tự đó: không ai giao câu hỏi cho bạn, và phần khó nhất — cũng là phần quyết định cả đề tài có chạy được hay không — nằm ngay ở bước đầu tiên, trước khi đọc bất kỳ tài liệu nào. Bài đi qua bốn phần: trước hết phân biệt nghiên cứu khoa học với việc tổng hợp lại thông tin có sẵn; sau đó dùng khung FINER để kiểm nhanh một câu hỏi nghiên cứu có khả thi và có giá trị không; tiếp theo là quy trình thu hẹp một chủ đề rộng thành câu hỏi cụ thể; và kết bằng hai lỗi thường gặp khiến câu hỏi không dùng được — dạng có/không và quá rộng — trước khi sang phần luyện tập.

## NCKH khác gì với "làm báo cáo"

Rất nhiều sinh viên bắt đầu đề tài đầu tiên bằng cách đọc 10-15 bài viết về một chủ đề, tóm tắt lại, xếp theo mục, rồi thêm phần kết luận. Sản phẩm đọc trôi chảy, có trích dẫn đầy đủ, và hoàn toàn không phải là nghiên cứu khoa học.

> [!ghi-nho] Nghiên cứu khoa học là quá trình tạo ra một câu trả lời **chưa tồn tại sẵn** ở bất kỳ nguồn đơn lẻ nào, bằng một phương pháp mà người khác có thể lặp lại và kiểm tra. Tổng hợp tài liệu là bước chuẩn bị cần thiết, không phải là đích.

Phép thử đơn giản: nếu một người đọc hết mọi nguồn mà bạn đang đọc, người đó **đã có câu trả lời** cho câu hỏi của bạn chưa? Nếu có — bạn đang làm việc tổng hợp, dù viết hay đến đâu. Nếu chưa — nghĩa là vẫn còn một khoảng trống mà chỉ dữ liệu của riêng bạn (khảo sát, phỏng vấn, thực nghiệm, phân tích một bộ dữ liệu chưa ai phân tích theo cách đó) mới lấp được. Khoảng trống đó chính là chỗ nghiên cứu của bạn cần đứng vào.

| | Tổng hợp thông tin | Nghiên cứu khoa học |
|---|---|---|
| Câu trả lời | Đã có sẵn, rải trong nhiều nguồn | Chưa có sẵn ở bất kỳ nguồn nào |
| Việc chính | Đọc, chọn, sắp xếp lại | Thu thập hoặc phân tích dữ liệu mới |
| Kiểm tra được bằng | Đọc lại đúng các nguồn đã trích | Người khác lặp lại phương pháp, ra kết quả tương tự |
| Sản phẩm cuối | Bài viết trình bày lại tri thức cũ | Một câu trả lời mới cho một câu hỏi cụ thể |

> [!vi-du] Hai sinh viên cùng quan tâm tới "áp lực học tập của sinh viên năm nhất". Sinh viên A đọc 12 bài báo về áp lực học tập, tóm tắt các nguyên nhân đã được nêu, viết thành một bài 15 trang có trích dẫn đầy đủ — đây là tổng hợp tốt, nhưng chưa phải nghiên cứu. Sinh viên B đọc đúng 12 bài báo đó để biết người khác đã đo áp lực học tập bằng công cụ nào, rồi phát hiện chưa ai đo riêng cho sinh viên năm nhất ngành Kỹ thuật tại các trường ở Hà Nội trong học kỳ chuyển từ học online sang học trực tiếp — và tự thu thập dữ liệu để trả lời đúng khoảng trống đó. B đang làm nghiên cứu.

## Bốn chữ đầu của FINER — câu hỏi nghiên cứu có đứng được không

Trước khi đọc tài liệu sâu, một câu hỏi nghiên cứu cần được kiểm nhanh bằng khung **FINER**, được Hulley và cộng sự dùng để huấn luyện nghiên cứu viên lâm sàng nhưng áp được cho hầu hết ngành. FINER là chữ đầu của năm tiêu chí:

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.7rem">FINER — năm phép thử cho một câu hỏi nghiên cứu</div>
  <div style="display:flex;flex-direction:column;gap:.4rem">
    <div style="background:rgba(59,130,246,.14);border-left:4px solid rgba(59,130,246,.7);padding:.55rem .8rem;border-radius:.3rem;font-size:1.15rem"><b>F — Feasible (khả thi)</b> — tiếp cận được đối tượng, đủ thời gian, đủ công cụ, đủ ngân sách</div>
    <div style="background:rgba(139,92,246,.14);border-left:4px solid rgba(139,92,246,.7);padding:.55rem .8rem;border-radius:.3rem;font-size:1.15rem"><b>I — Interesting (thú vị)</b> — người ngoài bạn (giảng viên, hội đồng, người đọc) cũng thấy đáng quan tâm, không chỉ riêng bạn</div>
    <div style="background:rgba(13,148,136,.14);border-left:4px solid rgba(13,148,136,.7);padding:.55rem .8rem;border-radius:.3rem;font-size:1.15rem"><b>N — Novel (mới)</b> — thêm được điều gì đó vào tri thức đã có: bối cảnh khác, góc nhìn khác, hoặc phương pháp khác</div>
    <div style="background:rgba(217,150,40,.14);border-left:4px solid rgba(217,150,40,.7);padding:.55rem .8rem;border-radius:.3rem;font-size:1.15rem"><b>E — Ethical (đạo đức được)</b> — không gây hại, xin được sự đồng ý của người tham gia, qua được hội đồng đạo đức nếu cần</div>
    <div style="background:rgba(219,90,140,.14);border-left:4px solid rgba(219,90,140,.7);padding:.55rem .8rem;border-radius:.3rem;font-size:1.15rem"><b>R — Relevant (liên quan)</b> — kết quả có ý nghĩa cho ai đó ngoài người hỏi: chính sách, thực hành, hoặc một khung lý thuyết</div>
  </div>
</div>
```

> [!canh-bao] FINER không phải một bảng chấm điểm để làm cho đẹp hồ sơ — nó là công cụ để **loại bớt câu hỏi trước khi tốn thời gian**. Một câu hỏi trượt tiêu chí F (khả thi) đáng bị bỏ ngay từ tuần đầu, chứ không phải phát hiện ra ở tuần thứ mười khi đã đọc xong 30 bài báo.

> [!vi-du] Câu hỏi "Trải nghiệm của sinh viên khiếm thị khi học trực tuyến trong đại dịch khác gì so với sinh viên không khiếm thị?" nghe rất Interesting và Relevant, nhưng nếu trường bạn chỉ có 2-3 sinh viên khiếm thị đang học và bạn không có kênh tiếp cận họ một cách phù hợp, câu hỏi trượt tiêu chí F ngay từ đầu — không phải vì câu hỏi tồi, mà vì đề tài này cần nguồn lực (thời gian, mạng lưới, đôi khi cả kỹ năng nghiên cứu với nhóm dễ bị tổn thương) vượt quá một đề tài NCKH sinh viên một học kỳ.

> [!vi-du] Một nhóm khác muốn biết "sinh viên đối phó thế nào với áp lực tài chính", và định làm bằng cách xem lịch sử giao dịch ngân hàng của các bạn cùng lớp mà không hỏi ý kiến ai, với lý do "chỉ quan sát, không phỏng vấn nên không ảnh hưởng tới ai". Câu hỏi này có thể rất Interesting và Relevant, nhưng trượt tiêu chí E (Ethical) ngay lập tức: xem dữ liệu tài chính cá nhân của người khác mà không có sự đồng ý là vi phạm quyền riêng tư, bất kể mục đích nghiên cứu tốt đẹp tới đâu. Sửa đúng hướng là đổi sang khảo sát ẩn danh, tự nguyện, có giải thích rõ mục đích trước khi người tham gia đồng ý trả lời.

## Từ chủ đề rộng đến câu hỏi cụ thể

Lỗi phổ biến nhất ở người mới không phải là chọn sai chủ đề, mà là **dừng lại ở chủ đề** và tưởng đó đã là câu hỏi nghiên cứu.

> [!ghi-nho] **Đề tài** (chủ đề) là một vùng quan tâm rộng — "động lực học tập", "mạng xã hội và sinh viên", "kỹ năng làm việc nhóm". **Câu hỏi nghiên cứu** là một câu cụ thể, có thể trả lời bằng dữ liệu thu thập được, nằm trong vùng đất đó.

| Đề tài (rộng, chưa dùng được) | Câu hỏi nghiên cứu (cụ thể, dùng được) |
|---|---|
| Mạng xã hội và sinh viên | Thời gian dùng TikTok mỗi ngày liên hệ thế nào với điểm trung bình học kỳ của sinh viên năm hai khoa X? |
| Động lực học tập | Sinh viên năm nhất chuyển từ học online sang học trực tiếp báo cáo động lực học tập thay đổi qua những cơ chế nào? |
| Làm việc nhóm | Cách phân vai trò trong nhóm ảnh hưởng thế nào tới mức độ hài lòng của thành viên trong các dự án học phần cuối kỳ? |

Ba câu hỏi bên phải đều còn có thể hẹp thêm — đó là bình thường, thu hẹp là một quá trình nhiều vòng, không phải một lần là xong.

**Quy trình 5 bước** để đi từ chủ đề rộng sang câu hỏi cụ thể:

1. **Viết ra chủ đề rộng** đúng như nó đang tồn tại trong đầu bạn — không cần chỉnh gì cả.
2. **Thêm bốn thành phần**: đối tượng cụ thể (ai), bối cảnh (ở đâu, khi nào), khía cạnh muốn đo (cái gì), và mối quan hệ hoặc so sánh muốn xem (giữa cái gì với cái gì).
3. **Viết lại thành câu hỏi mở** — bắt đầu bằng "như thế nào", "ở mức nào", "khác nhau ra sao", "qua cơ chế nào" — không dùng câu hỏi có/không.
4. **Chạy khung FINER** trên câu hỏi vừa viết; câu nào trượt F hoặc E thì loại hoặc viết lại ngay, đừng mang qua bước sau.
5. **Đối chiếu với 2-3 bài báo đã biết** trong lĩnh vực: câu hỏi của bạn có thêm được điều gì (bối cảnh, góc nhìn, phương pháp) so với những gì họ đã làm không.

> [!vi-du] Một sinh viên khoa Kinh tế bắt đầu từ chủ đề "làm việc nhóm". **Bước 1:** giữ nguyên chủ đề. **Bước 2:** thêm thành phần — đối tượng là sinh viên năm 3 khoa Kinh tế, bối cảnh là các dự án nhóm trong học phần Marketing, khía cạnh muốn đo là mức độ hài lòng, mối quan hệ muốn xem là cách phân vai trò ảnh hưởng ra sao tới mức độ đó. **Bước 3:** viết lại thành câu hỏi mở: "Cách phân vai trò trong nhóm ảnh hưởng thế nào tới mức độ hài lòng của sinh viên năm 3 khoa Kinh tế trong các dự án học phần Marketing?" **Bước 4:** chạy FINER — khả thi (lớp học phần có sẵn, dễ khảo sát), thú vị (giảng viên bộ môn quan tâm vì ảnh hưởng tới cách chia nhóm sau này), mới (chưa có nghiên cứu nào làm riêng cho sinh viên khoa Kinh tế ở trường này), đạo đức được (khảo sát ẩn danh, không định danh cá nhân), liên quan (giúp giảng viên thiết kế cách chia nhóm tốt hơn) — cả năm tiêu chí đều đạt. **Bước 5:** đối chiếu với hai bài báo về vai trò nhóm đã đọc, thấy cả hai đều làm ở môi trường doanh nghiệp, chưa có bài nào làm ở môi trường học phần đại học — đó chính là phần mới của câu hỏi này.

> [!meo] Nếu sau 5 bước vẫn có nhiều hơn một câu hỏi khả thi, đừng chọn ngay — giữ cả 2-3 câu hỏi qua Bài 1.2 (tổng quan tài liệu). Đọc tài liệu thường sẽ tự loại giúp bạn một vài câu, vì bạn sẽ thấy câu nào đã được trả lời quá kỹ, câu nào còn khoảng trống thật.

## Hai lỗi khiến câu hỏi không dùng được

**Câu hỏi dạng có/không.** "Mạng xã hội có ảnh hưởng tới kết quả học tập không?" trả lời được bằng một chữ "có" mà không cần đo gì — và câu trả lời gần như luôn là có ở mức độ nào đó, nên câu hỏi này không tạo ra tri thức mới. Sửa bằng cách hỏi *mức độ*, *cơ chế* hoặc *sự khác biệt*: "Ở mức nào", "qua kênh nào", "khác nhau ra sao giữa nhóm dùng nhiều và dùng ít".

> [!vi-du] Câu hỏi ban đầu: "Việc học nhóm online qua Zoom có hiệu quả không?" — dạng có/không, và hầu như ai cũng đoán được câu trả lời là "có, một phần", nên hỏi xong vẫn chưa biết gì thêm. Viết lại thành câu hỏi mở: "Sinh viên gặp khó khăn gì khi phối hợp làm bài nhóm qua Zoom so với khi gặp trực tiếp?" — câu này buộc phải liệt kê và so sánh các khó khăn cụ thể, tạo ra dữ liệu thật để phân tích thay vì một câu trả lời gọn trong một chữ.

**Quá rộng để trả lời trong một đề tài.** "Ảnh hưởng của công nghệ tới giáo dục" là một chủ đề cho cả một ngành nghiên cứu, không phải cho một đề tài NCKH sinh viên. Dấu hiệu nhận biết: nếu bạn không thể tưởng tượng ra bảng khảo sát hoặc bộ dữ liệu cụ thể sẽ dùng để trả lời câu hỏi, câu hỏi còn quá rộng.

> [!vi-du] Một nhóm sinh viên đặt câu hỏi "Trí tuệ nhân tạo có thay thế giáo viên không?" — vừa quá rộng (không giới hạn cấp học, môn học, khu vực) vừa gần như là câu hỏi có/không kiểu ẩn (câu trả lời thực tế luôn là "một phần, tuỳ việc", không đo được gì thêm). Sau khi áp quy trình 5 bước, nhóm viết lại thành: "Giáo viên tiểu học tại một trường ở Hà Nội thay đổi cách phân bổ thời gian lớp học ra sao sau khi đưa công cụ chấm bài tự động vào một học kỳ?" — hẹp hơn nhiều, nhưng trả lời được bằng phỏng vấn và quan sát lớp học thật.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Viết ra một chủ đề rộng bạn thật sự quan tâm (không cần đã "chốt" đề tài). Chạy quy trình 5 bước ở trên để tạo ra **ba câu hỏi nghiên cứu cụ thể** khác nhau từ chủ đề đó. Với mỗi câu hỏi, tự chấm nhanh 5 tiêu chí FINER (Đạt / Chưa chắc / Không đạt) và ghi một câu giải thích cho mỗi tiêu chí bị chấm "Chưa chắc" hoặc "Không đạt".

### Nhóm 3-4 người (25 phút)

Mỗi người đọc **một** câu hỏi mình thấy tự tin nhất, không đọc phần chấm FINER của mình. Nhóm nghe và tự chấm FINER độc lập, rồi so với phần tự chấm của người viết. Chỗ nào nhóm và người viết chấm khác nhau là chỗ cần thảo luận kỹ nhất — thường lệch ở tiêu chí F (khả thi, vì người ngoài không biết hết nguồn lực bạn có) và N (mới, vì người viết dễ đánh giá cao đề tài của chính mình). Cuối buổi, mỗi nhóm chọn ra câu hỏi được đánh giá tốt nhất và giải thích tại sao bằng đúng ngôn ngữ FINER.

### Bài tập về nhà (45-60 phút)

Từ ba câu hỏi đã viết ở phần cá nhân, chọn **một** câu hỏi để mang tiếp qua Bài 1.2 (tổng quan tài liệu) và Bài 1.3 (trích dẫn). Viết một trang gồm: (a) câu hỏi nghiên cứu cuối cùng, viết dưới dạng câu hỏi mở; (b) bảng chấm FINER đầy đủ với lý do cho từng tiêu chí; (c) nếu ban đầu bạn có một chủ đề khác rộng hơn, mô tả ngắn quá trình thu hẹp — chủ đề đó đã mất thành phần gì để trở thành câu hỏi này.

:::mau Mẫu nộp bài tập về nhà
**Chủ đề ban đầu (nếu có):** …

**Câu hỏi nghiên cứu:** …

**Chấm FINER**

| Tiêu chí | Đạt / Chưa chắc / Không đạt | Lý do |
|---|---|---|
| Feasible (khả thi) | … | … |
| Interesting (thú vị) | … | … |
| Novel (mới) | … | … |
| Ethical (đạo đức) | … | … |
| Relevant (liên quan) | … | … |

**Quá trình thu hẹp (nếu có):** …
:::

### Nguồn tham khảo

- Hulley, S. B., Cummings, S. R., Browner, W. S., Grady, D. G., & Newman, T. B. (2013). *Designing Clinical Research* (4th ed.). Lippincott Williams & Wilkins. — nguồn gốc khung FINER.
- Booth, W. C., Colomb, G. G., & Williams, J. M. (2016). *The Craft of Research* (4th ed.). University of Chicago Press. — chương về việc chuyển từ chủ đề sang câu hỏi nghiên cứu.
- Creswell, J. W., & Creswell, J. D. (2018). *Research Design: Qualitative, Quantitative, and Mixed Methods Approaches* (5th ed.). SAGE Publications.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 1.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "1.1-nckh-vs-tonghop",
                "type": "mcq",
                "prompt": "Điểm khác biệt cốt lõi giữa nghiên cứu khoa học và tổng hợp thông tin là gì?",
                "explanation": "NCKH tạo ra một câu trả lời chưa có sẵn ở bất kỳ nguồn đơn lẻ nào, bằng phương pháp người khác lặp lại và kiểm tra được. Tổng hợp thông tin trình bày lại tri thức đã có sẵn, dù trình bày hay và có trích dẫn đầy đủ.",
                "points": 2,
                "options": [
                    {"label": "NCKH tạo ra câu trả lời chưa có sẵn ở nguồn nào, bằng phương pháp kiểm tra lại được; tổng hợp trình bày lại tri thức đã có", "isCorrect": True},
                    {"label": "NCKH cần trích dẫn nhiều nguồn hơn tổng hợp thông tin", "isCorrect": False, "misconception": "nckh.research-is-summary"},
                    {"label": "NCKH chỉ khác ở việc viết dài hơn và có phần phương pháp", "isCorrect": False, "misconception": "nckh.research-is-summary"},
                    {"label": "Không có khác biệt, hai việc chỉ là hai tên gọi của cùng một hoạt động", "isCorrect": False, "misconception": "nckh.research-is-summary"},
                ],
            },
            {
                "key": "1.1-de-tai-vs-cau-hoi",
                "type": "mcq",
                "prompt": "'Động lực học tập của sinh viên năm nhất' là một đề tài rộng. Câu nào dưới đây là một câu hỏi nghiên cứu dùng được, thu hẹp từ đề tài đó?",
                "explanation": "Câu hỏi nghiên cứu phải cụ thể về đối tượng, bối cảnh và khía cạnh đo, và mở (không phải có/không). 'Sinh viên năm nhất chuyển từ học online sang học trực tiếp báo cáo động lực học tập thay đổi qua những cơ chế nào?' đáp ứng cả hai điều kiện.",
                "points": 2,
                "options": [
                    {"label": "Sinh viên năm nhất chuyển từ học online sang học trực tiếp báo cáo động lực học tập thay đổi qua những cơ chế nào?", "isCorrect": True},
                    {"label": "Động lực học tập của sinh viên năm nhất", "isCorrect": False, "misconception": "nckh.topic-is-question"},
                    {"label": "Sinh viên năm nhất có động lực học tập không?", "isCorrect": False, "misconception": "nckh.yesno-question"},
                    {"label": "Động lực học tập nói chung của sinh viên đại học Việt Nam", "isCorrect": False, "misconception": "nckh.question-too-broad"},
                ],
            },
            {
                "key": "1.1-loi-cau-hoi-yesno",
                "type": "mcq",
                "prompt": "Câu hỏi 'Mạng xã hội có ảnh hưởng tới kết quả học tập không?' có vấn đề gì lớn nhất?",
                "explanation": "Câu hỏi có/không hầu như luôn có câu trả lời 'có ở mức độ nào đó', nên không tạo ra tri thức mới và không buộc phải đo lường gì cụ thể. Cần đổi thành câu hỏi mở về mức độ, cơ chế hoặc sự khác biệt.",
                "points": 2,
                "options": [
                    {"label": "Đây là câu hỏi dạng có/không, gần như chắc chắn trả lời là 'có' mà không đo được gì cụ thể", "isCorrect": True},
                    {"label": "Câu hỏi này không đủ thú vị để nghiên cứu", "isCorrect": False},
                    {"label": "Câu hỏi này vi phạm đạo đức nghiên cứu", "isCorrect": False},
                    {"label": "Câu hỏi này không có gì sai, có thể dùng ngay", "isCorrect": False, "misconception": "nckh.yesno-question"},
                ],
            },
            {
                "key": "1.1-finer-kha-thi",
                "type": "mcq",
                "prompt": "Một nhóm sinh viên muốn nghiên cứu trải nghiệm của sinh viên khiếm thị khi học trực tuyến, nhưng trường chỉ có 2 sinh viên khiếm thị và nhóm không có kênh tiếp cận phù hợp. Câu hỏi này đang trượt tiêu chí nào trong FINER?",
                "explanation": "Đây là vấn đề về khả năng thực hiện được trong nguồn lực và thời gian của một đề tài sinh viên — đúng tiêu chí Feasible (F), không phải vì câu hỏi thiếu thú vị hay thiếu liên quan.",
                "points": 2,
                "options": [
                    {"label": "Feasible — khả thi: không đủ khả năng tiếp cận đối tượng trong nguồn lực hiện có", "isCorrect": True},
                    {"label": "Interesting — thú vị: đề tài không đủ hấp dẫn", "isCorrect": False},
                    {"label": "Relevant — liên quan: kết quả không có ý nghĩa với ai", "isCorrect": False},
                    {"label": "Novel — mới: đề tài này đã có quá nhiều người làm", "isCorrect": False, "misconception": "nckh.novelty-means-new-topic"},
                ],
            },
            {
                "key": "1.1-tinh-moi",
                "type": "mcq",
                "prompt": "Một sinh viên bỏ ý tưởng nghiên cứu 'áp lực học tập' vì đã có rất nhiều bài báo về chủ đề này. Nhận định nào đúng nhất về quyết định đó?",
                "explanation": "Tính mới (Novel) trong FINER không đòi hỏi chủ đề chưa ai từng nghiên cứu. Nó có thể đến từ bối cảnh khác (nhóm đối tượng, thời điểm, địa bàn), góc nhìn khác, hoặc phương pháp khác áp vào cùng một vấn đề.",
                "points": 3,
                "options": [
                    {"label": "Không cần bỏ hẳn — có thể giữ chủ đề và tạo tính mới bằng cách chọn bối cảnh, đối tượng hoặc phương pháp khác với các nghiên cứu đã có", "isCorrect": True},
                    {"label": "Đúng, chủ đề đã có nhiều người nghiên cứu thì không thể làm nghiên cứu mới về nó nữa", "isCorrect": False, "misconception": "nckh.novelty-means-new-topic"},
                    {"label": "Đúng, nhưng chỉ vì lý do đạo đức, không liên quan tới tính mới", "isCorrect": False},
                    {"label": "Không nên bỏ, vì tính mới không quan trọng bằng tính khả thi trong FINER", "isCorrect": False},
                ],
            },
            {
                "key": "1.1-thu-tu-5buoc",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự 5 bước thu hẹp một chủ đề rộng thành câu hỏi nghiên cứu cụ thể.",
                "explanation": "Bắt đầu từ chủ đề rộng, thêm các thành phần cụ thể, viết lại thành câu hỏi mở, kiểm bằng FINER, rồi đối chiếu với tài liệu đã biết để xác nhận tính mới.",
                "points": 3,
                "sequence": [
                    "Viết ra chủ đề rộng đúng như nó đang tồn tại trong đầu",
                    "Thêm đối tượng cụ thể, bối cảnh, khía cạnh muốn đo và mối quan hệ muốn so sánh",
                    "Viết lại thành một câu hỏi mở, không dùng dạng có/không",
                    "Chạy khung FINER trên câu hỏi vừa viết, loại hoặc sửa ngay câu trượt F hoặc E",
                    "Đối chiếu với 2-3 bài báo đã biết để xem câu hỏi có thêm được điều gì mới",
                ],
            },
            {
                "key": "1.1-noi-vi-du-finer",
                "type": "matching",
                "prompt": "Nối mỗi tình huống với tiêu chí FINER mà nó đang vi phạm hoặc thể hiện rõ nhất.",
                "explanation": "Mỗi tình huống ứng với đúng một chữ trong FINER: không tiếp cận được đối tượng là Feasible; câu hỏi chỉ đối tượng nghiên cứu thấy quan trọng còn người ngoài thấy vô nghĩa là Interesting; nghiên cứu lặp lại nguyên cách làm cũ không thêm gì mới là Novel; thu thập dữ liệu trẻ em không xin phép phụ huynh là Ethical.",
                "points": 3,
                "pairs": [
                    {"left": "Không có kênh nào tiếp cận được nhóm đối tượng cần khảo sát trong một học kỳ", "right": "Feasible"},
                    {"left": "Câu hỏi chỉ có ý nghĩa với đúng người đặt ra nó, không ai khác thấy đáng quan tâm", "right": "Interesting"},
                    {"left": "Lặp lại nguyên vẹn một nghiên cứu đã có, cùng đối tượng, cùng phương pháp, không thêm góc nhìn nào", "right": "Novel"},
                    {"left": "Thu thập dữ liệu từ học sinh tiểu học mà không xin phép phụ huynh hoặc nhà trường", "right": "Ethical"},
                ],
            },
            {
                "key": "1.1-tu-de-tai-den-cau-hoi",
                "type": "essay",
                "prompt": "Chọn một chủ đề rộng bạn quan tâm. Viết 150-250 từ gồm: (a) chủ đề ban đầu; (b) ba câu hỏi nghiên cứu cụ thể thu hẹp từ chủ đề đó; (c) với câu hỏi bạn thấy mạnh nhất, chấm nhanh cả 5 tiêu chí FINER và giải thích lý do cho tiêu chí bạn tự thấy yếu nhất.",
                "points": 5,
            },
        ],
    },
}

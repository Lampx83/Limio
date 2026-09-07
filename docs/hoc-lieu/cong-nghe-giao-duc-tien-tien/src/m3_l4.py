# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.4 · Lặp lại ngắt quãng và bài toán lập lịch ôn",
    "durationMin": 50,
    "description": "Đường quên, hiệu ứng giãn cách và ba thế hệ thuật toán lập lịch ôn, cùng những ràng buộc thực tế khiến một lịch ôn đúng lý thuyết vẫn hỏng khi vào lớp học.",
    "objectives": [
        "Giải thích được vì sao cùng tổng thời gian, ôn giãn cách cho kết quả bền hơn ôn dồn",
        "So sánh được ba thế hệ thuật toán lập lịch về dữ liệu cần có và độ chính xác",
        "Thiết kế được lịch ôn xử lý được ba tình huống thực tế: hàng đợi dồn, phiên ngắn, và người bỏ nhiều ngày",
    ],
    "summary": [
        "Trí nhớ suy giảm theo thời gian; ôn đúng lúc sắp quên cho hiệu quả cao hơn nhiều so với ôn khi còn nhớ rõ.",
        "Ba thế hệ lập lịch: hộp Leitner cố định, thuật toán điều chỉnh theo độ dễ kiểu SM-2, và mô hình hồi quy dự đoán nửa đời trí nhớ từ dữ liệu thật.",
        "Cùng tổng thời gian, ôn giãn cách thắng ôn dồn ở kiểm tra trễ nhưng có thể thua ở kiểm tra ngay — nên chọn thời điểm đo là chọn kết luận.",
        "Ba ràng buộc phá hỏng lịch ôn đẹp trên giấy: hàng đợi dồn sau khi vắng, phiên học quá ngắn, và người học chỉ ôn khi sắp thi.",
    ],
    "body": r"""
## Đường quên và hiệu ứng giãn cách

Điều Ebbinghaus mô tả từ cuối thế kỷ XIX vẫn là nền của mọi hệ ôn tập hiện nay: sau khi học, khả năng nhớ lại **suy giảm nhanh lúc đầu rồi chậm dần**; mỗi lần ôn lại kéo đường ấy lên và làm nó thoải hơn, tức là lần sau quên chậm hơn.

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Ôn đúng lúc sắp quên — mỗi lần ôn làm đường quên thoải hơn</div>
  <div style="display:flex;flex-direction:column;gap:.5rem">
    <div style="display:flex;align-items:center;gap:.5rem">
      <div style="flex:0 0 7rem;font-size:1.02rem">Học lần đầu</div>
      <div style="flex:1;display:flex;align-items:center;gap:.15rem">
        <div style="height:1.3rem;flex:1;background:rgba(13,148,136,.9);border-radius:.25rem 0 0 .25rem"></div>
        <div style="height:1.05rem;flex:1;background:rgba(13,148,136,.6)"></div>
        <div style="height:.8rem;flex:1;background:rgba(13,148,136,.4)"></div>
        <div style="height:.55rem;flex:1;background:rgba(13,148,136,.25);border-radius:0 .25rem .25rem 0"></div>
      </div>
      <div style="flex:0 0 5.5rem;font-size:1rem;opacity:.75">quên sau ~2 ngày</div>
    </div>
    <div style="display:flex;align-items:center;gap:.5rem">
      <div style="flex:0 0 7rem;font-size:1.02rem">Sau lần ôn 1</div>
      <div style="flex:1;display:flex;align-items:center;gap:.15rem">
        <div style="height:1.3rem;flex:1;background:rgba(37,99,235,.9);border-radius:.25rem 0 0 .25rem"></div>
        <div style="height:1.2rem;flex:1;background:rgba(37,99,235,.75)"></div>
        <div style="height:1.05rem;flex:1;background:rgba(37,99,235,.6)"></div>
        <div style="height:.85rem;flex:1;background:rgba(37,99,235,.45);border-radius:0 .25rem .25rem 0"></div>
      </div>
      <div style="flex:0 0 5.5rem;font-size:1rem;opacity:.75">quên sau ~6 ngày</div>
    </div>
    <div style="display:flex;align-items:center;gap:.5rem">
      <div style="flex:0 0 7rem;font-size:1.02rem">Sau lần ôn 2</div>
      <div style="flex:1;display:flex;align-items:center;gap:.15rem">
        <div style="height:1.3rem;flex:1;background:rgba(124,58,237,.9);border-radius:.25rem 0 0 .25rem"></div>
        <div style="height:1.25rem;flex:1;background:rgba(124,58,237,.8)"></div>
        <div style="height:1.2rem;flex:1;background:rgba(124,58,237,.7)"></div>
        <div style="height:1.1rem;flex:1;background:rgba(124,58,237,.55);border-radius:0 .25rem .25rem 0"></div>
      </div>
      <div style="flex:0 0 5.5rem;font-size:1rem;opacity:.75">quên sau ~3 tuần</div>
    </div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Các con số chỉ để hình dung. Điều quan trọng là quy luật: <strong>khoảng cách giữa hai lần ôn nên giãn dần</strong>, và mỗi lần ôn nên rơi vào lúc trí nhớ đã mờ nhưng chưa mất — ôn khi còn nhớ rõ thì tốn công mà thêm được ít.</div>
</div>
```

Phân tích tổng hợp của Cepeda và cộng sự (2006) trên hàng trăm thực nghiệm cho kết luận ổn định: **cùng tổng thời gian học, chia thành nhiều buổi cách quãng cho ghi nhớ tốt hơn học dồn**. Nghiên cứu sau đó còn chỉ ra khoảng cách tối ưu phụ thuộc vào **thời điểm sẽ kiểm tra**: cần nhớ sau một tuần thì giãn cách vài ngày là hợp; cần nhớ sau nửa năm thì khoảng cách phải tính bằng tuần.

> [!canh-bao] Đây là chỗ nối thẳng với Bài 1.2 và với cách đo hiệu quả ở Bài 1.4: **học dồn trông đẹp nhất đúng lúc kiểm tra ngay sau buổi học.** Một thử nghiệm đo ngay sau can thiệp sẽ kết luận sai về giá trị của lịch ôn giãn cách. Chọn thời điểm đo là chọn kết luận.

## Ba thế hệ thuật toán lập lịch

| Thế hệ | Cách hoạt động | Dữ liệu cần | Điểm mạnh | Điểm yếu |
|---|---|---|---|---|
| Hộp Leitner | Thẻ đúng thì lên hộp có chu kỳ dài hơn, sai thì về hộp đầu | Chỉ cần đúng/sai | Làm được bằng hộp giấy, giải thích cho học sinh trong một phút | Chu kỳ cố định, không phân biệt thẻ dễ với thẻ khó với từng người |
| Điều chỉnh theo độ dễ (kiểu SM-2) | Mỗi thẻ có một hệ số dễ, tăng giảm theo chất lượng nhớ lại; khoảng cách kế tiếp bằng khoảng cách trước nhân hệ số | Đúng/sai kèm tự đánh giá mức độ nhớ | Cá nhân hoá theo từng thẻ, chạy tốt suốt ba mươi năm | Hệ số và quy tắc do người đặt bằng kinh nghiệm, không học từ dữ liệu |
| Mô hình dữ liệu (hồi quy nửa đời) | Học từ hàng triệu lượt ôn để dự đoán **nửa đời trí nhớ** của từng cặp người học – nội dung, rồi xếp lịch theo dự đoán ấy | Nhật ký ôn tập quy mô lớn kèm đặc trưng nội dung | Chính xác hơn rõ rệt khi có đủ dữ liệu | Cần quy mô lớn; khó diễn giải; dễ tối ưu nhầm sang chỉ số giữ chân người dùng |

Với một sản phẩm cấp trường hay cấp lớp, **thế hệ hai gần như luôn là lựa chọn đúng**: nó đủ cá nhân hoá, giải thích được cho giáo viên, và không đòi dữ liệu mà bạn không có. Thế hệ ba chỉ hợp lý khi bạn thật sự có nhật ký ôn tập ở quy mô hàng trăm nghìn lượt.

> [!meo] Nếu định làm khoá luận về lập lịch ôn, đừng bắt đầu bằng việc dựng mô hình mới. Bắt đầu bằng việc **đo xem lịch hiện có đang lệch chỗ nào**: tỉ lệ nhớ lại đúng ở mỗi khoảng cách, so với mục tiêu. Một hệ đặt mục tiêu 90% nhớ đúng mà thực tế đạt 60% thì đang xếp lịch quá thưa — phát hiện ấy có giá trị hơn một mô hình mới chưa kiểm chứng.

## Ba ràng buộc phá hỏng lịch ôn đẹp trên giấy

**Hàng đợi dồn.** Người học nghỉ một tuần rồi quay lại, hệ thống trả về 240 thẻ đến hạn. Phản ứng thường gặp là bỏ luôn. Cách xử lý: đặt **trần số thẻ mỗi phiên**, ưu tiên thẻ quá hạn lâu nhất và thẻ thuộc nội dung sắp dùng tới, và nói rõ với người học rằng phần còn lại sẽ được xếp lại chứ không mất.

**Phiên học quá ngắn.** Học sinh mở ứng dụng trên xe buýt trong bốn phút. Lịch tối ưu theo lý thuyết giả định người học ngồi đủ lâu để hoàn thành hàng đợi. Cách xử lý: thiết kế đơn vị ôn **nhỏ và tự đóng** — mỗi thẻ độc lập, không có chuỗi bắt buộc, dừng lúc nào cũng không mất tiến độ.

**Chỉ ôn khi sắp thi.** Đây là hành vi phổ biến nhất ở học sinh Việt Nam và nó vô hiệu hoá toàn bộ ý tưởng giãn cách. Cách xử lý không nằm ở thuật toán mà ở **thiết kế đánh giá của môn học**: có điểm quá trình cho việc ôn đều, hoặc kiểm tra ngắn không báo trước với nội dung cũ. Nếu quy chế môn học chỉ thưởng cho bài thi cuối kỳ, không thuật toán nào cứu được.

## Ghép lịch ôn với mô hình thành thạo

Hai cơ chế ở Bài 3.2 và bài này trả lời hai câu hỏi khác nhau, và một hệ thống tốt cần cả hai:

| | Mô hình thành thạo (BKT) | Lịch ôn giãn cách |
|---|---|---|
| Trả lời câu hỏi | Người học **đã nắm** kỹ năng này chưa | Người học **còn nhớ** nội dung này không |
| Kích hoạt khi | Đang học kỹ năng mới | Đã đạt ngưỡng thành thạo rồi |
| Dừng khi | Vượt ngưỡng thành thạo | Không bao giờ dừng hẳn, chỉ giãn ra rất thưa |
| Sai lầm khi thiếu | Cho bài mãi dù đã vững, hoặc chuyển đi khi chưa vững | Học xong rồi quên sạch sau hai tháng |

> [!ghi-nho] Quy tắc ghép nối dùng được ngay: **đạt ngưỡng thành thạo là điều kiện để một kỹ năng rời khỏi hàng đợi luyện tập và bước vào hàng đợi ôn tập.** Nếu một lần ôn cho kết quả sai, kỹ năng ấy quay lại hàng đợi luyện tập với xác suất nắm được hạ xuống — chứ không chỉ đơn giản là xếp lịch ôn dày hơn.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Chọn 10 nội dung bạn đã học trong Module 1 và 2 của khoá này. Tự chấm mức độ còn nhớ theo thang ba mức, rồi xếp chúng vào ba nhóm ôn: trong 2 ngày, trong 1 tuần, trong 3 tuần. Ghi lại: nhóm nào đông nhất, và điều đó nói gì về cách bạn đã học hai module vừa rồi.

### Nhóm 3–4 người (30 phút)

Nhóm thiết kế lịch ôn cho một môn có kỳ thi sau 8 tuần. Ràng buộc bắt buộc: học sinh chỉ ôn được 10 phút mỗi ngày, nghỉ hoàn toàn hai ngày cuối tuần, và có một tuần nghỉ lễ ở giữa. Trình bày cách xử lý hàng đợi dồn sau tuần nghỉ, và bảo vệ trần số thẻ mỗi phiên mà nhóm chọn.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **bộ ôn tập giãn cách** cho chính nội dung của đồ án sách AR.

1. Soạn 20 thẻ ôn từ nội dung bốn trang sách của bạn, mỗi thẻ một ý kiểm được, mặt trước là câu hỏi bắt nhớ lại chứ không phải nhận diện.
2. Cài thuật toán thế hệ hai bằng bảng tính: mỗi thẻ có hệ số dễ, khoảng cách kế tiếp, ngày đến hạn; quy tắc tăng giảm hệ số phải viết rõ.
3. Thêm **trần số thẻ mỗi phiên** và quy tắc ưu tiên khi hàng đợi dồn.
4. Chạy mô phỏng 30 ngày với ba kiểu người học: đều đặn mỗi ngày, ba ngày một lần, và nghỉ 10 ngày rồi quay lại. Ghi lại số thẻ đến hạn theo ngày cho từng kiểu.
5. Viết nửa trang: kiểu người học nào bị hệ thống của bạn phục vụ kém nhất, và bạn sửa gì.

**Cách làm (gợi ý từng bước):** mặt trước thẻ phải bắt nhớ lại — tránh câu hỏi có/không và tránh gợi ý sẵn đáp án trong đề; quy tắc tăng giảm hệ số dễ nên đặt biên dưới để một thẻ khó không rơi vào chu kỳ một ngày mãi mãi; khi mô phỏng, dùng cột ngày và hàm điều kiện đếm thẻ đến hạn, đừng làm thủ công 30 lần; kiểu người học nghỉ 10 ngày là kiểu bộc lộ vấn đề rõ nhất, đừng bỏ.

**Chấm theo:** 20 thẻ bắt nhớ lại, bám nội dung sách (3đ) · thuật toán chạy đúng, quy tắc viết rõ và có biên (3đ) · xử lý hàng đợi dồn có trần và có ưu tiên (2đ) · mô phỏng ba kiểu người học kèm nhận xét đúng (2đ).

### Nguồn tham khảo

- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380.
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science*, 19(11), 1095–1102.
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning. *Psychological Science*, 17(3), 249–255.
- Settles, B., & Meeder, B. (2016). A trainable spaced repetition model for language learning. *ACL 2016*, 1848–1858.
- Wozniak, P. A., & Gorzelanczyk, E. J. (1994). Optimization of repetition spacing in the practice of learning. *Acta Neurobiologiae Experimentalis*, 54, 59–62.
""",
    "quiz": {
        "title": "Kiểm tra Bài 3.4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.4-thoi-diem-on",
                "type": "mcq",
                "prompt": "Thời điểm ôn lại cho hiệu quả cao nhất là khi nào?",
                "explanation": "Khi trí nhớ đã mờ nhưng chưa mất. Ôn lúc còn nhớ rõ thì tốn công mà thêm được ít; ôn khi đã quên hẳn thì gần như học lại từ đầu.",
                "points": 2,
                "options": [
                    {"label": "Khi trí nhớ đã mờ nhưng chưa mất hẳn", "isCorrect": True},
                    {"label": "Ngay sau khi vừa học xong, khi còn nhớ rõ nhất", "isCorrect": False},
                    {"label": "Càng gần ngày thi càng tốt", "isCorrect": False, "misconception": "cngdtt.cram-works"},
                    {"label": "Đều đặn mỗi ngày với khoảng cách cố định không đổi", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-khoang-cach-gian-dan",
                "type": "mcq",
                "prompt": "Vì sao khoảng cách giữa các lần ôn nên giãn dần thay vì giữ cố định?",
                "explanation": "Mỗi lần ôn thành công làm đường quên thoải hơn — lần sau quên chậm hơn — nên giữ khoảng cách cũ là ôn quá sớm và lãng phí thời gian.",
                "points": 2,
                "options": [
                    {"label": "Vì mỗi lần ôn làm tốc độ quên chậm lại, nên giữ khoảng cách cũ là ôn quá sớm", "isCorrect": True},
                    {"label": "Vì người học chán khi phải ôn quá thường xuyên", "isCorrect": False},
                    {"label": "Vì hệ thống cần giảm tải máy chủ", "isCorrect": False},
                    {"label": "Không cần giãn dần, khoảng cách cố định vẫn tối ưu", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-thoi-diem-do",
                "type": "mcq",
                "prompt": "Một thử nghiệm so ôn dồn với ôn giãn cách, đo bằng bài kiểm tra ngay sau buổi học cuối. Vấn đề là gì?",
                "explanation": "Học dồn trông đẹp nhất đúng ở thời điểm ấy. Muốn đo giá trị thật của giãn cách phải đo trễ — chọn thời điểm đo là chọn kết luận.",
                "points": 2,
                "options": [
                    {"label": "Đo ngay là thời điểm có lợi nhất cho ôn dồn; phải đo trễ mới thấy giá trị của giãn cách", "isCorrect": True},
                    {"label": "Không có vấn đề gì, đo ngay là khách quan nhất", "isCorrect": False, "misconception": "cngdtt.cram-works"},
                    {"label": "Vấn đề nằm ở cỡ mẫu chứ không ở thời điểm đo", "isCorrect": False},
                    {"label": "Cần đo bằng bài do chính nhóm nghiên cứu soạn để chính xác hơn", "isCorrect": False, "misconception": "cngdtt.vendor-evidence"},
                ],
            },
            {
                "key": "3.4-ba-the-he",
                "type": "matching",
                "prompt": "Ghép mỗi thế hệ thuật toán lập lịch với đặc điểm của nó.",
                "explanation": "Ba thế hệ khác nhau ở dữ liệu cần có và mức độ cá nhân hoá; với sản phẩm cấp trường, thế hệ hai gần như luôn là lựa chọn đúng.",
                "points": 3,
                "pairs": [
                    {"left": "Hộp Leitner", "right": "Chu kỳ cố định theo hộp, chỉ cần dữ liệu đúng sai, giải thích được trong một phút"},
                    {"left": "Thuật toán kiểu SM-2", "right": "Mỗi thẻ có hệ số dễ riêng, khoảng cách nhân lên theo chất lượng nhớ lại"},
                    {"left": "Hồi quy nửa đời trí nhớ", "right": "Học từ nhật ký quy mô lớn để dự đoán khi nào người học sắp quên"},
                ],
            },
            {
                "key": "3.4-chon-the-he",
                "type": "mcq",
                "prompt": "Bạn làm sản phẩm ôn tập cho một trường với vài trăm học sinh. Nên chọn thế hệ thuật toán nào?",
                "explanation": "Thế hệ hai: đủ cá nhân hoá, giải thích được cho giáo viên, và không đòi dữ liệu quy mô lớn mà bạn không có.",
                "points": 2,
                "options": [
                    {"label": "Thế hệ hai kiểu SM-2, vì đủ cá nhân hoá mà không đòi dữ liệu quy mô lớn", "isCorrect": True},
                    {"label": "Thế hệ ba, vì mô hình học từ dữ liệu luôn tốt hơn", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Thế hệ một, vì đơn giản nhất nên ít lỗi nhất", "isCorrect": False},
                    {"label": "Không cần thuật toán, để học sinh tự chọn thẻ để ôn", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-hang-doi-don",
                "type": "mcq",
                "prompt": "Người học nghỉ một tuần, quay lại thấy 240 thẻ đến hạn và bỏ luôn. Cách xử lý đúng là gì?",
                "explanation": "Đặt trần số thẻ mỗi phiên, ưu tiên thẻ quá hạn lâu nhất và thẻ thuộc nội dung sắp dùng, và nói rõ phần còn lại được xếp lại chứ không mất.",
                "points": 2,
                "options": [
                    {"label": "Đặt trần số thẻ mỗi phiên kèm quy tắc ưu tiên, và nói rõ phần còn lại sẽ được xếp lại", "isCorrect": True},
                    {"label": "Giữ nguyên hàng đợi vì đó là số thẻ đúng theo thuật toán", "isCorrect": False},
                    {"label": "Xoá toàn bộ thẻ quá hạn để làm sạch hàng đợi", "isCorrect": False},
                    {"label": "Gửi thông báo nhắc mỗi giờ cho tới khi người học làm hết", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-phien-ngan",
                "type": "mcq",
                "prompt": "Học sinh chỉ mở ứng dụng bốn phút trên xe buýt. Nguyên tắc thiết kế tương ứng là gì?",
                "explanation": "Đơn vị ôn phải nhỏ và tự đóng: mỗi thẻ độc lập, không có chuỗi bắt buộc, dừng lúc nào cũng không mất tiến độ.",
                "points": 2,
                "options": [
                    {"label": "Mỗi đơn vị ôn phải nhỏ, độc lập, dừng lúc nào cũng không mất tiến độ", "isCorrect": True},
                    {"label": "Buộc hoàn thành hết hàng đợi mới được tính là đã ôn", "isCorrect": False},
                    {"label": "Chỉ cho phép ôn khi có ít nhất 20 phút rảnh", "isCorrect": False},
                    {"label": "Tăng số thẻ mỗi phiên để tận dụng thời gian", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-on-khi-sap-thi",
                "type": "mcq",
                "prompt": "Học sinh chỉ ôn khi sắp thi, vô hiệu hoá ý tưởng giãn cách. Cách xử lý căn bản nằm ở đâu?",
                "explanation": "Ở thiết kế đánh giá của môn học — điểm quá trình cho việc ôn đều, hoặc kiểm tra ngắn không báo trước với nội dung cũ. Nếu quy chế chỉ thưởng bài thi cuối kỳ thì không thuật toán nào cứu được.",
                "points": 2,
                "options": [
                    {"label": "Ở thiết kế đánh giá của môn học, không ở thuật toán lập lịch", "isCorrect": True},
                    {"label": "Ở việc gửi thêm thông báo nhắc nhở", "isCorrect": False},
                    {"label": "Ở việc rút ngắn khoảng cách giữa các lần ôn", "isCorrect": False},
                    {"label": "Ở việc thưởng huy hiệu cho chuỗi ngày ôn liên tiếp", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-ghep-hai-co-che",
                "type": "mcq",
                "prompt": "Mô hình thành thạo và lịch ôn giãn cách trả lời hai câu hỏi khác nhau. Đó là hai câu nào?",
                "explanation": "Mô hình thành thạo trả lời người học đã nắm kỹ năng chưa; lịch ôn trả lời người học còn nhớ nội dung không. Một hệ tốt cần cả hai.",
                "points": 2,
                "options": [
                    {"label": "Đã nắm được chưa, và còn nhớ được không", "isCorrect": True},
                    {"label": "Học nhanh hay chậm, và thích hay không thích", "isCorrect": False},
                    {"label": "Đúng bao nhiêu phần trăm, và xếp hạng thứ mấy", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "Hai câu hỏi này thực chất là một", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-quy-tac-ghep",
                "type": "mcq",
                "prompt": "Một kỹ năng đã đạt ngưỡng thành thạo, sau đó người học ôn lại và trả lời sai. Hệ thống nên làm gì?",
                "explanation": "Đưa kỹ năng ấy quay lại hàng đợi luyện tập với xác suất nắm được hạ xuống, chứ không chỉ xếp lịch ôn dày hơn — vì một lần sai sau khi đã thành thạo là tín hiệu về chính trạng thái tri thức.",
                "points": 2,
                "options": [
                    {"label": "Đưa kỹ năng quay lại hàng đợi luyện tập với xác suất nắm hạ xuống", "isCorrect": True},
                    {"label": "Chỉ rút ngắn khoảng cách ôn lần sau, giữ nguyên trạng thái thành thạo", "isCorrect": False},
                    {"label": "Bỏ qua vì một lần sai có thể do sơ suất", "isCorrect": False},
                    {"label": "Đánh dấu người học là chưa từng nắm kỹ năng này", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                ],
            },
            {
                "key": "3.4-khoa-luan-bat-dau",
                "type": "mcq",
                "prompt": "Bạn định làm khoá luận về lập lịch ôn. Điểm khởi đầu hợp lý nhất là gì?",
                "explanation": "Đo xem lịch hiện có đang lệch chỗ nào — tỉ lệ nhớ lại đúng ở mỗi khoảng cách so với mục tiêu. Phát hiện ấy có giá trị hơn một mô hình mới chưa kiểm chứng.",
                "points": 2,
                "options": [
                    {"label": "Đo tỉ lệ nhớ lại đúng theo từng khoảng cách của lịch hiện có, so với mục tiêu đặt ra", "isCorrect": True},
                    {"label": "Dựng ngay một mô hình học sâu dự đoán nửa đời trí nhớ", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Khảo sát ý kiến học sinh về việc ôn tập", "isCorrect": False},
                    {"label": "So sánh giao diện của các ứng dụng ôn tập phổ biến", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-mat-truoc-the",
                "type": "true_false",
                "prompt": "Mặt trước của thẻ ôn nên bắt người học nhớ lại, tránh câu hỏi có/không và tránh gợi ý sẵn đáp án trong đề.",
                "explanation": "Đúng — nhận diện dễ hơn nhớ lại rất nhiều, nên thẻ cho phép nhận diện sẽ tạo cảm giác đã nhớ mà không tạo ra ghi nhớ bền, đúng cái bẫy trôi chảy ở Bài 1.2.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "3.4-viet-luan-lich-on",
                "type": "essay",
                "prompt": "Viết 250–350 từ thiết kế cơ chế ôn tập cho nội dung sách AR của bạn: chọn thế hệ thuật toán nào và vì sao, xử lý hàng đợi dồn ra sao, và bạn ghép nó với mô hình thành thạo theo quy tắc nào.",
                "points": 5,
            },
        ],
    },
}

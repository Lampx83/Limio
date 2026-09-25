# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.6 · Bảo vệ đồ án: trình bày, demo và trả lời chất vấn",
    "durationMin": 55,
    "description": "Cấu trúc mười phút bảo vệ, cách demo an toàn, mười hai câu hỏi hội đồng hay hỏi kèm hướng trả lời, và bảng tiêu chí tổng hợp toàn học phần.",
    "objectives": [
        "Dựng được bài trình bày mười phút đặt lý do sư phạm trước sản phẩm",
        "Chuẩn bị được demo có phương án dự phòng cho ba tình huống hỏng",
        "Trả lời được mười hai câu hỏi chất vấn điển hình bằng bằng chứng đã có trong hồ sơ",
    ],
    "summary": [
        "Mười phút chia theo tỉ lệ: ba phút lý do sư phạm, bốn phút demo, ba phút bằng chứng và giới hạn.",
        "Demo phải có ba lớp dự phòng: bản chạy thật, video quay sẵn, và ảnh chụp màn hình — chuẩn bị cả ba là quy tắc, không phải sự thận trọng thái quá.",
        "Phần lớn câu hỏi của hội đồng đã có sẵn câu trả lời trong hồ sơ năm mốc; việc của bạn là biết chúng nằm ở đâu.",
        "Câu trả lời mạnh nhất luôn có cấu trúc: điều tôi đã đo được, điều tôi chưa biết, và điều tôi sẽ làm tiếp.",
    ],
    "body": r"""
## Cấu trúc mười phút

| Phút | Nội dung | Sai lầm cần tránh |
|---|---|---|
| 0–3 | **Lý do sư phạm**: người học tắc ở đâu, vì sao nội dung này cần AR, bằng chứng nào ủng hộ | Mở đầu bằng giới thiệu công nghệ và công cụ đã dùng |
| 3–7 | **Demo trực tiếp**: một mạch từ trang giấy tới mô hình, kèm một hoạt động sinh nội dung | Trình diễn mọi tính năng; nói suốt trong lúc demo chạy |
| 7–10 | **Bằng chứng và giới hạn**: kết quả thử nghiệm, những gì đã sửa, kế hoạch đo, và điều đồ án chưa trả lời được | Kết bằng lời hứa sẽ phát triển thêm mà không có số liệu |

> [!ghi-nho] Thứ tự này quan trọng hơn nội dung từng phần. Mở đầu bằng vấn đề học tập đặt cả hội đồng vào đúng khung đánh giá của khoá học; mở đầu bằng công nghệ mời gọi đúng loại câu hỏi bạn khó trả lời nhất — *vì sao không dùng công cụ X mới hơn*.

## Demo an toàn: ba lớp dự phòng

Buổi bảo vệ là môi trường tệ nhất có thể cho một demo AR: mạng lạ, ánh sáng phòng họp, máy chiếu, và bạn đang căng thẳng. Chuẩn bị đủ ba lớp:

| Lớp | Nội dung | Khi nào dùng |
|---|---|---|
| 1 · Bản chạy thật | Trang in thật, điện thoại của bạn, đã tải sẵn trang và tắt bộ nhớ đệm một lần để kiểm | Mặc định |
| 2 · Video quay sẵn | Quay màn hình một lượt trọn vẹn, có tiếng, dưới hai phút | Khi mạng hỏng hoặc quét không ra |
| 3 · Ảnh chụp màn hình | Bốn đến sáu ảnh các bước chính, đưa vào slide | Khi cả hai lớp trên đều không dùng được |

Ba mẹo vận hành: bật chế độ máy bay rồi dùng điểm phát sóng riêng để tránh mạng phòng họp; giơ điện thoại cho hội đồng nhìn thay vì chiếu lên màn hình nếu việc chiếu đòi thêm thiết bị; và **im lặng trong ba giây khi mô hình hiện ra** — để hội đồng nhìn, thay vì lấp đầy bằng lời giải thích.

> [!canh-bao] Đừng demo trên thiết bị mượn vào buổi sáng hôm bảo vệ. Mỗi thiết bị có hành vi camera và quyền truy cập khác nhau; thứ chạy được trên máy bạn có thể đòi cấp quyền lần đầu trên máy khác, và ba mươi giây loay hoay cấp quyền sẽ ăn hết phần demo.

## Mười hai câu hỏi hội đồng hay hỏi

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:34rem;display:flex;gap:.5rem">
    <div style="flex:1;border:1px solid rgba(37,99,235,.4);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(37,99,235,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Nhóm sư phạm</div>
      <div style="padding:.65rem;font-size:1rem;line-height:1.6">1. Vì sao nội dung này cần AR mà hình tĩnh không đủ?<br>2. Người học tắc ở đâu, em biết điều đó từ đâu?<br>3. Bỏ phần AR đi thì người học mất gì?<br>4. Mục tiêu học tập nào được đo, đo bằng gì?</div>
    </div>
    <div style="flex:1;border:1px solid rgba(13,148,136,.45);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(13,148,136,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Nhóm bằng chứng</div>
      <div style="padding:.65rem;font-size:1rem;line-height:1.6">5. Em thử với bao nhiêu người, họ là ai?<br>6. Vấn đề lớn nhất tìm được là gì, đã sửa thế nào?<br>7. Kết quả này có khái quát được không?<br>8. Nếu đo lại sau hai tháng, em nghĩ còn tác dụng không?</div>
    </div>
    <div style="flex:1;border:1px solid rgba(217,150,40,.5);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(217,150,40,.9);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Nhóm triển khai</div>
      <div style="padding:.65rem;font-size:1rem;line-height:1.6">9. Học sinh không có điện thoại thì sao?<br>10. Chi phí thật cho một lớp là bao nhiêu?<br>11. Em thu dữ liệu gì của học sinh, căn cứ nào?<br>12. Giáo viên khác có dạy được bằng tài liệu của em không?</div>
    </div>
  </div>
  <div style="min-width:34rem;font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">Cả mười hai câu đều đã có câu trả lời trong hồ sơ năm mốc. Việc chuẩn bị không phải là nghĩ ra câu trả lời mới, mà là <strong>biết mỗi câu trả lời nằm ở trang nào</strong> và nói được nó trong bốn mươi giây.</div>
</div>
```

Bốn câu khó nhất và hướng trả lời:

**Câu 3 — bỏ AR đi thì mất gì?** Trả lời bằng một đặc điểm nội dung, không bằng tính từ: *nội dung này là quá trình động ba chiều, hình tĩnh buộc người học tự nội suy chuyển động, và ở lớp 8 đó là chỗ hai phần ba số em giải thích sai theo biên bản thử nghiệm của em.*

**Câu 7 — có khái quát được không?** Trả lời thẳng là không, kèm lý do bằng số: *với mười người thử và một lớp, thiết kế của em chỉ đủ để kết luận sản phẩm chạy được và chỗ nào cần sửa; muốn nói về hiệu quả thì cần thiết kế luân phiên hai lớp như trong kế hoạch đo ở mốc 4.*

**Câu 9 — học sinh không có thiết bị?** Đây là câu kiểm tra bạn có nghĩ tới công bằng không. Trả lời bằng thiết kế: *trang giấy tự nó đủ nghĩa, lớp phủ là phần thêm; ngoài ra em bố trí dùng chung theo nhóm ba người, và đã thử phương án ấy trong buổi thử nghiệm.*

**Câu 11 — thu dữ liệu gì?** Trả lời bằng bảng đăng ký dữ liệu ở mốc 4, nêu đúng số điều luật. Nếu sản phẩm không thu dữ liệu cá nhân, nói rõ điều đó và vì sao đó là lựa chọn có chủ ý.

> [!meo] Cấu trúc câu trả lời mạnh nhất cho mọi câu chất vấn: **điều tôi đã đo được — điều tôi chưa biết — điều tôi sẽ làm tiếp**. Ba mệnh đề, bốn mươi giây. Nó cho thấy bạn phân biệt được bằng chứng với phỏng đoán, đúng thứ mà cả học phần này rèn.

## Bảng tiêu chí tổng hợp toàn học phần

| Thành phần | Trọng số | Nguồn điểm |
|---|---|---|
| Năm mốc nộp theo tiến độ | 50% | Mốc 1 đến mốc 5, chấm theo rubric của từng bài xưởng |
| Sản phẩm cuối | 25% | Sách AR bốn trang, bản dựng kỹ thuật, tài liệu bàn giao |
| Bảo vệ | 15% | Trình bày, demo, và chất lượng trả lời chất vấn |
| Bài kiểm tra trong các bài học | 10% | Trung bình các bài kiểm tra của năm module |

Ba điều kiện cần, thiếu một là không đủ điều kiện bảo vệ: nộp đủ năm mốc; có biên bản thử nghiệm với người học thật; và mọi tài nguyên đều rõ nguồn và giấy phép.

> [!ghi-nho] Điều học phần này muốn bạn mang theo sau khi bảo vệ xong không phải một cuốn sách AR. Đó là thói quen hỏi ba câu trước mọi công nghệ giáo dục mới: **nó cải thiện khâu nào của việc học, bằng chứng tốt nhất hiện có nói gì, và ai chịu thiệt nếu nó hỏng.** Công cụ sẽ đổi; ba câu hỏi ấy thì không.

## Luyện tập và tài liệu tham khảo

### Cá nhân (25 phút)

Viết dàn ý ba phút đầu của bài bảo vệ, chỉ gồm lý do sư phạm. Ràng buộc: không được nhắc tên bất kỳ công cụ hay công nghệ nào trong ba phút đó. Nếu không viết nổi, đó là dấu hiệu phần lý do sư phạm của đồ án còn yếu.

### Nhóm 3–4 người (40 phút)

Diễn tập bảo vệ chéo: mỗi người trình bày mười phút, ba người còn lại đóng vai hội đồng và bắt buộc hỏi ít nhất một câu từ mỗi nhóm trong bảng mười hai câu. Người trình bày phải trả lời trong bốn mươi giây theo cấu trúc ba mệnh đề. Ghi lại câu nào làm bạn lúng túng nhất.

### Bài tập về nhà — mốc 6, chuẩn bị bảo vệ (120 phút)

1. Bài trình bày mười phút theo đúng tỉ lệ ba – bốn – ba.
2. Ba lớp dự phòng cho demo, đã kiểm cả ba.
3. Bảng tra cứu một trang: mười hai câu hỏi, mỗi câu ghi câu trả lời trong một câu và số trang trong hồ sơ chứa bằng chứng.
4. Bản tự chấm theo bảng tiêu chí tổng hợp, kèm hai điểm bạn biết mình yếu nhất và lý do.
5. Diễn tập ít nhất một lần trước người khác, ghi lại thời gian thật của từng phần.

**Cách làm (gợi ý từng bước):** bấm giờ khi diễn tập và cắt nội dung cho vừa mười phút thay vì nói nhanh hơn; quay video demo dự phòng ngay sau khi kiểm thử kỹ thuật, lúc sản phẩm còn ở trạng thái tốt nhất; bảng tra cứu in ra giấy, để cạnh khi bảo vệ; phần tự chấm viết trung thực — hội đồng đánh giá cao người biết chỗ yếu của mình hơn người khẳng định sản phẩm hoàn hảo.

**Chấm theo:** ba phút đầu là lý do sư phạm, không nhắc công cụ (3đ) · demo một mạch, có ba lớp dự phòng đã kiểm (3đ) · bảng tra cứu mười hai câu có dẫn trang hồ sơ (2đ) · phần bằng chứng và giới hạn nêu bằng số (2đ).

### Nguồn tham khảo

- Reynolds, G. (2019). *Presentation Zen* (3rd ed.). New Riders — nguyên tắc trình bày tối giản.
- Nielsen, J. (2000). *Why you only need to test with 5 users.* Nielsen Norman Group.
- Kraft, M. A. (2020). Interpreting effect sizes of education interventions. *Educational Researcher*, 49(4), 241–253.
- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.). Cambridge University Press.
""",
    "quiz": {
        "title": "Kiểm tra Bài 5.6",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "5.6-thu-tu-trinh-bay",
                "type": "mcq",
                "prompt": "Vì sao ba phút đầu phải là lý do sư phạm chứ không phải giới thiệu công nghệ?",
                "explanation": "Mở đầu bằng vấn đề học tập đặt hội đồng vào đúng khung đánh giá; mở đầu bằng công nghệ mời gọi câu hỏi khó trả lời nhất — vì sao không dùng công cụ mới hơn.",
                "points": 2,
                "options": [
                    {"label": "Vì nó đặt hội đồng vào khung đánh giá sư phạm, thay vì mời gọi câu hỏi so sánh công cụ", "isCorrect": True},
                    {"label": "Vì hội đồng không hiểu về công nghệ", "isCorrect": False},
                    {"label": "Vì công nghệ nên để dành cho phần demo", "isCorrect": False},
                    {"label": "Vì quy chế bảo vệ yêu cầu như vậy", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-ba-lop-du-phong",
                "type": "ordering",
                "prompt": "Sắp xếp ba lớp dự phòng cho demo theo thứ tự sử dụng.",
                "explanation": "Bản chạy thật là mặc định; video quay sẵn dùng khi mạng hỏng hoặc quét không ra; ảnh chụp màn hình là lớp cuối cùng.",
                "points": 3,
                "sequence": [
                    "Bản chạy thật trên trang in và điện thoại của mình",
                    "Video quay sẵn trọn một lượt, dưới hai phút",
                    "Bốn đến sáu ảnh chụp màn hình các bước chính trong slide",
                ],
            },
            {
                "key": "5.6-thiet-bi-muon",
                "type": "mcq",
                "prompt": "Vì sao không nên demo trên thiết bị mượn vào buổi sáng hôm bảo vệ?",
                "explanation": "Mỗi thiết bị có hành vi camera và quyền truy cập khác nhau; máy lạ có thể đòi cấp quyền lần đầu, và ba mươi giây loay hoay sẽ ăn hết phần demo.",
                "points": 2,
                "options": [
                    {"label": "Máy lạ có thể đòi cấp quyền lần đầu và hành vi camera khác, làm mất thời gian demo", "isCorrect": True},
                    {"label": "Vì máy mượn thường hết pin", "isCorrect": False},
                    {"label": "Vì vi phạm quy chế bảo vệ", "isCorrect": False},
                    {"label": "Không sao nếu máy đó cấu hình cao", "isCorrect": False, "misconception": "cngdtt.demo-equals-product"},
                ],
            },
            {
                "key": "5.6-cau-3",
                "type": "mcq",
                "prompt": "Hội đồng hỏi: bỏ phần AR đi thì người học mất gì? Cách trả lời mạnh nhất là gì?",
                "explanation": "Trả lời bằng một đặc điểm nội dung kèm bằng chứng từ thử nghiệm — ví dụ nội dung là quá trình động ba chiều và biên bản cho thấy học sinh giải thích sai chỗ nào khi chỉ có hình tĩnh.",
                "points": 2,
                "options": [
                    {"label": "Nêu đặc điểm nội dung là quá trình động ba chiều, kèm số liệu từ biên bản thử nghiệm", "isCorrect": True},
                    {"label": "Nói rằng học sinh thấy hứng thú hơn nhiều", "isCorrect": False, "misconception": "cngdtt.presence-equals-learning"},
                    {"label": "Nói rằng AR là xu hướng của giáo dục hiện đại", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Nói rằng hình tĩnh đã lỗi thời", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                ],
            },
            {
                "key": "5.6-cau-7",
                "type": "mcq",
                "prompt": "Hội đồng hỏi kết quả có khái quát được không. Câu trả lời đúng là gì?",
                "explanation": "Trả lời thẳng là không, kèm lý do bằng số: với mười người thử và một lớp, thiết kế chỉ đủ kết luận sản phẩm chạy được và chỗ cần sửa; muốn nói hiệu quả thì cần thiết kế luân phiên hai lớp.",
                "points": 2,
                "options": [
                    {"label": "Trả lời thẳng là không, nêu cỡ mẫu và nói thiết kế nào mới cho phép kết luận về hiệu quả", "isCorrect": True},
                    {"label": "Khẳng định có, vì kết quả rất tích cực", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Tránh câu hỏi bằng cách chuyển sang nói về tính năng", "isCorrect": False},
                    {"label": "Nói rằng cần thêm kinh phí mới trả lời được", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-cau-9",
                "type": "mcq",
                "prompt": "Câu hỏi *học sinh không có điện thoại thì sao* thực chất kiểm tra điều gì?",
                "explanation": "Kiểm tra bạn có nghĩ tới công bằng không. Trả lời bằng thiết kế: trang giấy tự nó đủ nghĩa, kèm phương án dùng chung theo nhóm đã được thử.",
                "points": 2,
                "options": [
                    {"label": "Bạn có nghĩ tới công bằng trong thiết kế hay không", "isCorrect": True},
                    {"label": "Bạn có biết giá điện thoại hiện nay không", "isCorrect": False},
                    {"label": "Bạn có kế hoạch xin tài trợ thiết bị không", "isCorrect": False},
                    {"label": "Bạn có biết tỉ lệ học sinh có điện thoại không", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-cau-tra-loi-manh",
                "type": "mcq",
                "prompt": "Cấu trúc ba mệnh đề cho một câu trả lời chất vấn mạnh là gì?",
                "explanation": "Điều tôi đã đo được — điều tôi chưa biết — điều tôi sẽ làm tiếp. Nó cho thấy bạn phân biệt được bằng chứng với phỏng đoán.",
                "points": 2,
                "options": [
                    {"label": "Điều đã đo được, điều chưa biết, và điều sẽ làm tiếp", "isCorrect": True},
                    {"label": "Cảm ơn câu hỏi, nhắc lại câu hỏi, rồi trả lời", "isCorrect": False},
                    {"label": "Nêu ưu điểm, thừa nhận một nhược điểm nhỏ, rồi nêu thêm ưu điểm", "isCorrect": False},
                    {"label": "Trích dẫn một nghiên cứu quốc tế cho mỗi câu hỏi", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-ba-giay-im-lang",
                "type": "mcq",
                "prompt": "Vì sao nên im lặng ba giây khi mô hình AR hiện ra trước hội đồng?",
                "explanation": "Để hội đồng nhìn sản phẩm, thay vì lấp đầy khoảnh khắc ấy bằng lời giải thích — hình ảnh tự nói được nhiều hơn lời trong ba giây đó.",
                "points": 2,
                "options": [
                    {"label": "Để hội đồng thật sự nhìn sản phẩm thay vì phải nghe", "isCorrect": True},
                    {"label": "Để chờ mô hình tải xong hoàn toàn", "isCorrect": False},
                    {"label": "Để lấy lại bình tĩnh", "isCorrect": False},
                    {"label": "Để tiết kiệm thời gian trình bày", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-bang-tra-cuu",
                "type": "mcq",
                "prompt": "Bảng tra cứu mười hai câu hỏi nên chứa gì?",
                "explanation": "Mỗi câu một câu trả lời ngắn kèm số trang trong hồ sơ chứa bằng chứng — vì phần lớn câu trả lời đã có sẵn trong hồ sơ năm mốc.",
                "points": 2,
                "options": [
                    {"label": "Câu trả lời một câu và số trang hồ sơ chứa bằng chứng tương ứng", "isCorrect": True},
                    {"label": "Toàn văn câu trả lời viết sẵn để đọc", "isCorrect": False},
                    {"label": "Danh sách các nghiên cứu để trích dẫn", "isCorrect": False},
                    {"label": "Các câu hỏi ngược để hỏi lại hội đồng", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-dieu-kien-bao-ve",
                "type": "mcq",
                "prompt": "Ba điều kiện cần để đủ tư cách bảo vệ là gì?",
                "explanation": "Nộp đủ năm mốc; có biên bản thử nghiệm với người học thật; và mọi tài nguyên rõ nguồn cùng giấy phép.",
                "points": 2,
                "options": [
                    {"label": "Đủ năm mốc, có biên bản thử nghiệm với người học thật, mọi tài nguyên rõ giấy phép", "isCorrect": True},
                    {"label": "Sản phẩm chạy mượt, slide đẹp, và bài viết đủ số trang", "isCorrect": False},
                    {"label": "Có kết quả cho thấy sản phẩm hiệu quả hơn cách dạy cũ", "isCorrect": False},
                    {"label": "Được một trường đồng ý triển khai", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-ba-cau-mang-theo",
                "type": "mcq",
                "prompt": "Ba câu hỏi mà học phần muốn bạn mang theo trước mọi công nghệ giáo dục mới là gì?",
                "explanation": "Nó cải thiện khâu nào của việc học; bằng chứng tốt nhất hiện có nói gì; và ai chịu thiệt nếu nó hỏng. Công cụ sẽ đổi, ba câu hỏi thì không.",
                "points": 2,
                "options": [
                    {"label": "Cải thiện khâu nào của việc học; bằng chứng tốt nhất nói gì; ai chịu thiệt nếu nó hỏng", "isCorrect": True},
                    {"label": "Giá bao nhiêu; ai đang dùng; có dễ học không", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Có mới không; có nhiều tính năng không; có đẹp không", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Có chạy trên điện thoại không; có miễn phí không; có tiếng Việt không", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-tu-cham-trung-thuc",
                "type": "true_false",
                "prompt": "Trong phần tự chấm, nên nêu thẳng hai điểm mình yếu nhất kèm lý do.",
                "explanation": "Đúng — hội đồng đánh giá cao người biết chỗ yếu của mình hơn người khẳng định sản phẩm hoàn hảo, và điều đó cũng đúng tinh thần phân biệt bằng chứng với phỏng đoán của cả học phần.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "5.6-viet-luan-bao-ve",
                "type": "essay",
                "prompt": "Viết 250–350 từ kịch bản ba phút mở đầu buổi bảo vệ của bạn, không nhắc tên bất kỳ công cụ nào: người học tắc ở đâu và bạn biết từ đâu, vì sao nội dung này cần lớp phủ ba chiều, và bằng chứng nào bạn sẽ dẫn ra trong ba phút ấy.",
                "points": 5,
            },
        ],
    },
}

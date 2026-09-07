# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.5 · Công bằng, quyền riêng tư và quản trị dữ liệu học tập",
    "durationMin": 50,
    "description": "Nghĩa vụ pháp lý áp vào từng quyết định kỹ thuật, cách đo công bằng thuật toán, giới hạn của ẩn danh trong dữ liệu lớp học, và bộ quy tắc quản trị tối thiểu.",
    "objectives": [
        "Ánh xạ được từng quyết định kỹ thuật sang nghĩa vụ pháp lý tương ứng",
        "Đo được chênh lệch hiệu năng của một mô hình theo nhóm người học",
        "Nêu được vì sao ẩn danh trong dữ liệu một lớp học yếu hơn nhiều so với cảm giác",
    ],
    "summary": [
        "Nghĩa vụ pháp lý không nằm ở một chương riêng của tài liệu thiết kế mà ánh xạ trực tiếp vào từng quyết định kỹ thuật: thu trường nào, lưu bao lâu, gửi đi đâu.",
        "Bỏ biến nhạy cảm khỏi mô hình không tạo ra công bằng; cách duy nhất biết là đo hiệu năng tách theo nhóm và công bố kết quả.",
        "Các định nghĩa công bằng khác nhau xung khắc với nhau, nên phải chọn định nghĩa và biện minh, không thể thoả mãn tất cả.",
        "Trong dữ liệu một lớp, ẩn danh rất yếu: vài trường tưởng vô hại đã đủ để định danh lại một học sinh.",
    ],
    "body": r"""
## Nghĩa vụ pháp lý ánh xạ vào quyết định kỹ thuật

Ở Bài 1.5 bạn đã có khung pháp lý. Ở đây là bảng ánh xạ dùng được khi ngồi thiết kế:

| Quyết định kỹ thuật | Nghĩa vụ tương ứng | Việc phải làm cụ thể |
|---|---|---|
| Bật ghi một trường dữ liệu mới | Tối thiểu hoá và giới hạn mục đích | Ghi vào bảng đăng ký dữ liệu: mục đích, căn cứ, thời hạn lưu, ai truy cập |
| Vận hành hệ thống có xử lý dữ liệu người học | Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân (Điều 21) | Lập và gửi trong 60 ngày kể từ ngày đầu xử lý; cập nhật khi có thay đổi |
| Hệ thống dùng cho học sinh phổ thông | Bảo vệ dữ liệu trẻ em (Điều 24) | Người đại diện theo pháp luật thực hiện quyền; công bố thông tin đời sống riêng tư của trẻ từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện |
| Gọi dịch vụ AI hoặc lưu trữ ngoài nước | Xử lý trong môi trường AI, đám mây (Điều 30) và chuyển dữ liệu xuyên biên giới | Khử nhận dạng trước khi gửi; ghi rõ nhà cung cấp và phạm vi |
| Điểm danh khuôn mặt, ghi hình lớp học | Dữ liệu sinh trắc học và ghi hình (Điều 31, 32) | Bảo mật vật lý thiết bị lưu trữ, hạn chế truy cập, hệ thống theo dõi xâm phạm |
| Xoá tài khoản người học | Quyền của chủ thể dữ liệu | Quy trình xoá gồm cả bản sao lưu và dữ liệu đã chuyển cho bên thứ ba |

> [!ghi-nho] Cách kiểm nhanh một thiết kế: mở bảng đăng ký dữ liệu và đọc cột **thời hạn lưu**. Nếu mọi dòng đều ghi *vô thời hạn* hoặc để trống, hệ thống chưa được thiết kế mà chỉ được lắp ráp.

## Công bằng thuật toán: đo tách theo nhóm

Giả sử mô hình cảnh báo sớm của bạn đạt tỉ lệ đúng 63% tổng thể. Con số ấy có thể che một chênh lệch lớn:

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cùng một mô hình, tách theo nhóm hoàn cảnh</div>
  <div style="display:flex;flex-direction:column;gap:.45rem">
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem">Toàn bộ học sinh</div><div style="flex:1"><div style="width:63%;background:rgba(120,113,108,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">tỉ lệ cảnh báo đúng 63%</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem">Nhóm có điều kiện thuận lợi</div><div style="flex:1"><div style="width:74%;background:rgba(13,148,136,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">74%</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 13rem;font-size:1.02rem">Nhóm hoàn cảnh khó khăn</div><div style="flex:1"><div style="width:41%;background:rgba(220,38,38,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">41%</div></div></div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Chênh lệch 33 điểm phần trăm bị con số tổng thể che hoàn toàn. Nhóm khó khăn vừa bị gắn cờ nhiều hơn vừa bị gắn cờ sai nhiều hơn — tức là <strong>chịu phần lớn chi phí của việc bị làm phiền oan</strong>.</div>
</div>
```

Ba điều cần nắm về công bằng thuật toán trong giáo dục:

**Bỏ biến nhạy cảm không tạo ra công bằng.** Loại giới tính, dân tộc, hoàn cảnh gia đình khỏi mô hình không xoá được thông tin về nhóm: các biến còn lại — thời gian truy cập, loại thiết bị, trường tiểu học đã học — vẫn mang thông tin ấy. Cách duy nhất biết mô hình có lệch không là **đo tách theo nhóm**, mà muốn đo thì phải giữ biến nhóm để phân tích, dù không đưa vào mô hình.

**Các định nghĩa công bằng xung khắc nhau.** Muốn tỉ lệ gắn cờ bằng nhau giữa các nhóm, muốn tỉ lệ đúng trong nhóm gắn cờ bằng nhau, và muốn tỉ lệ bỏ sót bằng nhau — khi tỉ lệ nền của hai nhóm khác nhau thì **không thể thoả mãn cả ba cùng lúc**. Đây là kết quả toán học, không phải khiếm khuyết kỹ thuật. Việc của người thiết kế là chọn định nghĩa nào quan trọng nhất trong bối cảnh của mình và **biện minh lựa chọn ấy công khai**.

**Sai sót không đối xứng.** Với cảnh báo học tập, bị bỏ sót thường nặng hơn bị làm phiền oan — nhưng chỉ đúng khi can thiệp là hỗ trợ. Nếu can thiệp mang tính kỷ luật hoặc dán nhãn, cán cân đảo ngược ngay.

## Ẩn danh yếu hơn bạn nghĩ, nhất là ở quy mô lớp

Bỏ tên và mã học sinh không làm dữ liệu thành ẩn danh. Trong một lớp bốn mươi em, chỉ cần **ba trường tưởng như vô hại** — giới tính, lớp, và thời điểm nộp bài — là đã đủ để chỉ ra một người. Với dữ liệu học tập, một chuỗi thời gian hoạt động gần như là dấu vân tay.

| Mức xử lý | Nội dung | Còn định danh lại được không |
|---|---|---|
| Bỏ tên, giữ mã học sinh | Mã vẫn nối được với bảng danh sách | Có, dễ |
| Thay mã bằng mã giả ngẫu nhiên | Cần bảng ánh xạ để nối lại | Có, nếu có bảng ánh xạ — đây là mã hoá giả danh, không phải ẩn danh |
| Gộp nhóm tối thiểu k người | Chỉ báo cáo khi mỗi tổ hợp có ít nhất k người | Khó hơn, nhưng ở lớp nhỏ thì gộp tới mức mất hết ý nghĩa |
| Chỉ công bố số liệu tổng hợp | Không xuất dòng cá nhân | An toàn nhất, và thường đủ cho mục đích báo cáo |

> [!canh-bao] Trong khoá luận, sai lầm hay gặp là đưa bảng dữ liệu thô vào phụ lục sau khi đã bỏ tên, và tin rằng như vậy là ẩn danh. Nếu bảng ấy còn lớp, ngày giờ nộp bài và điểm từng câu, người trong trường sẽ nhận ra ai là ai. **Phụ lục nên chứa số liệu tổng hợp, hoặc dữ liệu đã được xáo và gộp.**

## Bộ quy tắc quản trị tối thiểu cho một cơ sở giáo dục

Bốn câu hỏi mà bất kỳ cơ sở nào dùng phân tích học tập cũng phải trả lời bằng văn bản:

1. **Ai được xem gì.** Ma trận vai trò – dữ liệu: giáo viên bộ môn xem lớp mình dạy; giáo viên chủ nhiệm xem lớp mình; ban giám hiệu xem số liệu tổng hợp; không ai xem toàn bộ theo mặc định.
2. **Lưu bao lâu và xoá thế nào.** Mỗi loại dữ liệu một thời hạn, kèm quy trình xoá thật — gồm cả bản sao lưu.
3. **Quyết định nào không được giao cho máy.** Danh sách rõ: xếp lớp, kỷ luật, kết luận liêm chính học thuật, đánh giá cuối kỳ.
4. **Người học biết gì và làm gì được.** Thông báo bằng ngôn ngữ đọc được, quyền xem dữ liệu về mình, quyền phản hồi khi hệ thống sai, và đầu mối liên hệ có tên.

> [!meo] Bốn câu này viết được trong hai trang, và hai trang ấy là thứ phân biệt một dự án phân tích học tập nghiêm túc với một dự án chỉ có bảng biểu. Trong đồ án tốt nghiệp, đây cũng là phần hội đồng hay hỏi nhất khi thấy hệ thống có thu dữ liệu người học.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Lấy bảng đăng ký dữ liệu bạn đã lập ở Bài 1.5 hoặc 4.2. Điền thêm hai cột: thời hạn lưu, và người được truy cập. Đánh dấu mọi dòng bạn không điền được — đó là những trường cần xem lại có nên thu hay không.

### Nhóm 3–4 người (30 phút)

Nhóm nhận kết quả một mô hình cảnh báo sớm tách theo hai nhóm học sinh, có chênh lệch rõ. Thảo luận và chọn **một** định nghĩa công bằng để ưu tiên, biện minh lựa chọn, và nêu hậu quả với nhóm còn lại. Yêu cầu: mỗi nhóm phải nói được ai chịu thiệt trong phương án của mình.

### Bài tập về nhà — sản phẩm số (100 phút)

Soạn **hồ sơ quản trị dữ liệu** cho hệ thống trong đồ án của bạn, dùng được để nộp kèm khi bảo vệ.

1. Bảng đăng ký dữ liệu đầy đủ: trường, mục đích, căn cứ pháp lý kèm số điều, thời hạn lưu, người truy cập, có ra nước ngoài không.
2. Ma trận vai trò – dữ liệu cho ít nhất bốn vai trò.
3. Danh sách quyết định không giao cho máy, kèm lý do cho từng mục.
4. Bản thông báo cho người học và phụ huynh, tối đa một trang, viết bằng ngôn ngữ đọc được — có mục *dữ liệu nào chúng tôi không thu*.
5. Nếu hệ thống có mô hình dự đoán: kế hoạch đo chênh lệch hiệu năng theo nhóm, nêu rõ nhóm nào được tách ra và vì sao.

**Cách làm (gợi ý từng bước):** viết bản thông báo trước, rồi dùng chính nó để soi lại bảng đăng ký — thứ gì bạn ngại viết ra cho phụ huynh đọc thì thường là thứ không nên thu; căn cứ pháp lý ghi số điều cụ thể, đừng ghi chung tên luật; với hệ thống dùng dịch vụ ngoài, liệt kê từng nhà cung cấp và dữ liệu gửi đi.

**Chấm theo:** bảng đăng ký đủ sáu cột, căn cứ dẫn đúng điều (3đ) · ma trận vai trò hợp lý, không ai xem tất cả theo mặc định (2đ) · danh sách quyết định không giao cho máy có lý do (2đ) · bản thông báo đọc được và có mục dữ liệu không thu (2đ) · kế hoạch đo công bằng cụ thể (1đ).

### Nguồn tham khảo

- Quốc hội (2025). *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15* — các điều 21, 24, 30, 31, 32.
- Drachsler, H., & Greller, W. (2016). Privacy and analytics — it's a DELICATE issue. *LAK '16*, 89–98.
- Chouldechova, A. (2017). Fair prediction with disparate impact. *Big Data*, 5(2), 153–163.
- Kleinberg, J., Mullainathan, S., & Raghavan, M. (2017). Inherent trade-offs in the fair determination of risk scores. *ITCS 2017*.
- Baker, R. S., & Hawn, A. (2022). Algorithmic bias in education. *International Journal of Artificial Intelligence in Education*, 32, 1052–1092.
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.5-anh-xa",
                "type": "matching",
                "prompt": "Ghép mỗi quyết định kỹ thuật với nghĩa vụ pháp lý tương ứng.",
                "explanation": "Nghĩa vụ pháp lý ánh xạ trực tiếp vào từng quyết định kỹ thuật, không nằm ở một chương riêng cuối tài liệu thiết kế.",
                "points": 3,
                "pairs": [
                    {"left": "Vận hành hệ thống xử lý dữ liệu người học", "right": "Lập và gửi hồ sơ đánh giá tác động trong 60 ngày"},
                    {"left": "Gọi dịch vụ AI đặt ở nước ngoài", "right": "Khử nhận dạng trước khi gửi, ghi rõ nhà cung cấp và phạm vi"},
                    {"left": "Điểm danh bằng nhận diện khuôn mặt", "right": "Bảo mật vật lý thiết bị lưu trữ, hạn chế truy cập, theo dõi xâm phạm"},
                    {"left": "Bật ghi một trường dữ liệu mới", "right": "Ghi vào bảng đăng ký: mục đích, căn cứ, thời hạn lưu, người truy cập"},
                ],
            },
            {
                "key": "4.5-thoi-han-luu",
                "type": "mcq",
                "prompt": "Cách kiểm nhanh một thiết kế hệ thống có nghiêm túc về dữ liệu hay không là gì?",
                "explanation": "Đọc cột thời hạn lưu trong bảng đăng ký dữ liệu. Nếu mọi dòng đều vô thời hạn hoặc để trống, hệ thống chưa được thiết kế mà chỉ được lắp ráp.",
                "points": 2,
                "options": [
                    {"label": "Đọc cột thời hạn lưu trong bảng đăng ký dữ liệu", "isCorrect": True},
                    {"label": "Xem hệ thống có dùng mã hoá không", "isCorrect": False},
                    {"label": "Xem giao diện có mục cài đặt riêng tư không", "isCorrect": False},
                    {"label": "Xem nhà cung cấp có chứng chỉ quốc tế không", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-bo-bien-nhay-cam",
                "type": "mcq",
                "prompt": "Nhóm phát triển loại giới tính và hoàn cảnh gia đình khỏi mô hình rồi kết luận mô hình trung lập. Nhận xét đúng là gì?",
                "explanation": "Các biến còn lại vẫn mang thông tin về nhóm. Cách duy nhất biết mô hình có lệch không là đo hiệu năng tách theo nhóm — và muốn đo thì phải giữ biến nhóm để phân tích, dù không đưa vào mô hình.",
                "points": 2,
                "options": [
                    {"label": "Kết luận sai: phải đo hiệu năng tách theo nhóm mới biết, nên cần giữ biến nhóm để phân tích", "isCorrect": True},
                    {"label": "Đúng: không có biến nhạy cảm thì mô hình không thể phân biệt đối xử", "isCorrect": False, "misconception": "cngdtt.fairness-by-blindness"},
                    {"label": "Đúng, miễn là mô hình đạt độ chính xác trên 80%", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                    {"label": "Sai, nhưng chỉ vì luật bắt buộc giữ mọi biến", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-chenh-lech-nhom",
                "type": "mcq",
                "prompt": "Mô hình có tỉ lệ cảnh báo đúng 63% tổng thể, nhưng 74% ở nhóm thuận lợi và 41% ở nhóm khó khăn. Hệ quả thực tế là gì?",
                "explanation": "Nhóm khó khăn vừa bị gắn cờ nhiều hơn vừa bị gắn cờ sai nhiều hơn, nên chịu phần lớn chi phí của việc bị làm phiền oan — trong khi con số tổng thể che hoàn toàn điều đó.",
                "points": 2,
                "options": [
                    {"label": "Nhóm khó khăn chịu phần lớn chi phí của cảnh báo sai, và con số tổng thể che mất điều đó", "isCorrect": True},
                    {"label": "Mô hình hoạt động tốt vì tổng thể trên 60%", "isCorrect": False, "misconception": "cngdtt.alert-precision"},
                    {"label": "Chênh lệch này là ngẫu nhiên, không cần xử lý", "isCorrect": False},
                    {"label": "Cần bỏ nhóm khó khăn ra khỏi hệ thống cảnh báo", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-xung-khac",
                "type": "mcq",
                "prompt": "Vì sao không thể thoả mãn đồng thời mọi định nghĩa công bằng khi hai nhóm có tỉ lệ nền khác nhau?",
                "explanation": "Đó là kết quả toán học đã được chứng minh, không phải khiếm khuyết kỹ thuật. Người thiết kế phải chọn định nghĩa nào quan trọng nhất và biện minh công khai.",
                "points": 2,
                "options": [
                    {"label": "Vì đó là kết quả toán học: các tiêu chí xung khắc khi tỉ lệ nền khác nhau", "isCorrect": True},
                    {"label": "Vì dữ liệu chưa đủ nhiều", "isCorrect": False},
                    {"label": "Vì thuật toán hiện tại chưa đủ tốt", "isCorrect": False},
                    {"label": "Vì các nhóm được định nghĩa chưa chính xác", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-sai-sot-khong-doi-xung",
                "type": "mcq",
                "prompt": "Với cảnh báo học tập, khi nào cán cân giữa bỏ sót và làm phiền oan bị đảo ngược?",
                "explanation": "Khi can thiệp mang tính kỷ luật hoặc dán nhãn thay vì hỗ trợ — lúc đó bị gắn cờ oan gây hại nhiều hơn bị bỏ sót.",
                "points": 2,
                "options": [
                    {"label": "Khi can thiệp mang tính kỷ luật hoặc dán nhãn thay vì hỗ trợ", "isCorrect": True},
                    {"label": "Khi mô hình có độ chính xác dưới 50%", "isCorrect": False},
                    {"label": "Khi số học sinh trong trường quá lớn", "isCorrect": False},
                    {"label": "Cán cân không bao giờ đảo ngược", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-an-danh-yeu",
                "type": "mcq",
                "prompt": "Vì sao bỏ tên khỏi dữ liệu một lớp bốn mươi học sinh chưa phải là ẩn danh?",
                "explanation": "Chỉ cần vài trường tưởng vô hại — giới tính, lớp, thời điểm nộp bài — là đủ chỉ ra một người; chuỗi thời gian hoạt động gần như là dấu vân tay.",
                "points": 2,
                "options": [
                    {"label": "Vì tổ hợp vài trường tưởng vô hại đã đủ để định danh lại trong nhóm nhỏ", "isCorrect": True},
                    {"label": "Vì tên vẫn còn trong bản sao lưu", "isCorrect": False},
                    {"label": "Vì luật yêu cầu phải mã hoá dữ liệu", "isCorrect": False},
                    {"label": "Không đúng: bỏ tên là đã đủ ẩn danh", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-ma-gia-danh",
                "type": "mcq",
                "prompt": "Thay mã học sinh bằng mã giả ngẫu nhiên nhưng vẫn giữ bảng ánh xạ. Đây là mức xử lý nào?",
                "explanation": "Mã hoá giả danh, không phải ẩn danh: còn bảng ánh xạ thì còn nối lại được, nên dữ liệu vẫn thuộc phạm vi bảo vệ dữ liệu cá nhân.",
                "points": 2,
                "options": [
                    {"label": "Mã hoá giả danh — vẫn nối lại được nên vẫn là dữ liệu cá nhân", "isCorrect": True},
                    {"label": "Ẩn danh hoàn toàn", "isCorrect": False},
                    {"label": "Gộp nhóm tối thiểu", "isCorrect": False},
                    {"label": "Số liệu tổng hợp", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-phu-luc-khoa-luan",
                "type": "mcq",
                "prompt": "Khoá luận đưa bảng dữ liệu thô vào phụ lục sau khi bỏ tên, còn giữ lớp, ngày giờ nộp và điểm từng câu. Vấn đề là gì?",
                "explanation": "Người trong trường sẽ nhận ra ai là ai. Phụ lục nên chứa số liệu tổng hợp, hoặc dữ liệu đã được xáo và gộp.",
                "points": 2,
                "options": [
                    {"label": "Vẫn định danh lại được với người trong trường; nên để số liệu tổng hợp hoặc dữ liệu đã xáo và gộp", "isCorrect": True},
                    {"label": "Không có vấn đề gì vì đã bỏ tên", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Chỉ là vấn đề độ dài phụ lục", "isCorrect": False},
                    {"label": "Chỉ cần thêm dòng cam kết bảo mật là đủ", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-bon-cau-quan-tri",
                "type": "matching",
                "prompt": "Ghép mỗi câu hỏi quản trị với nội dung phải trả lời bằng văn bản.",
                "explanation": "Bốn câu này viết được trong hai trang, và chúng phân biệt một dự án phân tích học tập nghiêm túc với một dự án chỉ có bảng biểu.",
                "points": 3,
                "pairs": [
                    {"left": "Ai được xem gì", "right": "Ma trận vai trò – dữ liệu, không ai xem toàn bộ theo mặc định"},
                    {"left": "Lưu bao lâu, xoá thế nào", "right": "Thời hạn cho từng loại dữ liệu và quy trình xoá gồm cả bản sao lưu"},
                    {"left": "Quyết định nào không giao cho máy", "right": "Xếp lớp, kỷ luật, kết luận liêm chính, đánh giá cuối kỳ"},
                    {"left": "Người học biết gì, làm gì được", "right": "Thông báo đọc được, quyền xem và phản hồi, đầu mối liên hệ có tên"},
                ],
            },
            {
                "key": "4.5-viet-thong-bao-truoc",
                "type": "mcq",
                "prompt": "Vì sao nên viết bản thông báo cho phụ huynh trước rồi mới soi lại bảng đăng ký dữ liệu?",
                "explanation": "Thứ gì bạn ngại viết ra cho phụ huynh đọc thì thường là thứ không nên thu — bản thông báo trở thành một bài kiểm tra đạo đức cho chính thiết kế.",
                "points": 2,
                "options": [
                    {"label": "Vì thứ mình ngại viết ra cho phụ huynh đọc thường là thứ không nên thu", "isCorrect": True},
                    {"label": "Vì luật yêu cầu thông báo phải có trước", "isCorrect": False},
                    {"label": "Vì viết thông báo nhanh hơn lập bảng", "isCorrect": False},
                    {"label": "Vì phụ huynh cần được hỏi ý kiến về thiết kế kỹ thuật", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-giu-bien-nhom",
                "type": "true_false",
                "prompt": "Để đo được công bằng của mô hình, cần giữ biến nhóm cho mục đích phân tích ngay cả khi không đưa biến ấy vào mô hình.",
                "explanation": "Đúng — không có biến nhóm thì không tách được hiệu năng theo nhóm, và chênh lệch sẽ tồn tại mà không ai phát hiện.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "4.5-viet-luan-quan-tri",
                "type": "essay",
                "prompt": "Viết 250–350 từ hồ sơ quản trị rút gọn cho hệ thống trong đồ án của bạn: ba trường dữ liệu nhạy cảm nhất kèm căn cứ và thời hạn lưu, ai được xem gì, hai quyết định bạn không giao cho máy, và cách bạn sẽ kiểm chênh lệch hiệu năng theo nhóm.",
                "points": 5,
            },
        ],
    },
}

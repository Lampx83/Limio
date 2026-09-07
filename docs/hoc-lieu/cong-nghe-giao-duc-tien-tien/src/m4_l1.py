# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.1 · Phân tích học tập và vòng khép kín",
    "durationMin": 50,
    "description": "Định nghĩa và bốn mức phân tích, vòng khép kín từ dữ liệu tới hành động, và lý do phần lớn dự án phân tích học tập dừng lại ở nửa vòng đầu.",
    "objectives": [
        "Phân biệt được bốn mức phân tích và chỉ ra một sản phẩm đang ở mức nào",
        "Chỉ ra được mắt xích đứt trong một dự án phân tích học tập cụ thể",
        "Đọc được một tuyên bố hiệu quả của hệ thống cảnh báo sớm với đúng mức thận trọng",
    ],
    "summary": [
        "Phân tích học tập là đo, thu thập, phân tích và báo cáo dữ liệu về người học nhằm hiểu và cải thiện việc học — định nghĩa nhấn mạnh mục đích, không nhấn mạnh kỹ thuật.",
        "Bốn mức: mô tả chuyện gì đã xảy ra, chẩn đoán vì sao, dự đoán sắp xảy ra gì, và kê đơn nên làm gì.",
        "Vòng khép kín gồm bốn chặng, và chặng hay đứt nhất là chặng cuối: từ thông tin tới hành động thật của người dạy.",
        "Trường hợp Course Signals cho thấy cả tiềm năng lẫn cái bẫy phương pháp luận điển hình của lĩnh vực này.",
    ],
    "body": r"""
## Định nghĩa và bốn mức phân tích

Định nghĩa được cộng đồng chấp nhận rộng nhất, đặt ra tại hội nghị đầu tiên về phân tích học tập năm 2011, nhấn mạnh **mục đích** chứ không nhấn mạnh kỹ thuật: đo lường, thu thập, phân tích và báo cáo dữ liệu về người học và bối cảnh của họ, **nhằm hiểu và tối ưu việc học cùng môi trường nơi việc học diễn ra**.

Bốn mức phân tích, xếp theo độ khó tăng dần và cũng theo giá trị tăng dần:

| Mức | Câu hỏi | Ví dụ trong lớp học | Cần gì |
|---|---|---|---|
| Mô tả | Chuyện gì đã xảy ra? | 40% học sinh chưa nộp bài tuần 3 | Dữ liệu sạch và một bảng biểu |
| Chẩn đoán | Vì sao? | Nhóm chưa nộp tập trung ở lớp học chiều, phần lớn tắc ở bước đính kèm tệp | Dữ liệu đủ chi tiết và giả thuyết để kiểm |
| Dự đoán | Sắp xảy ra gì? | 18 em có nguy cơ không đạt cuối kỳ | Dữ liệu lịch sử, mô hình, và đánh giá cẩn thận |
| Kê đơn | Nên làm gì? | Với nhóm này, can thiệp X hiệu quả hơn Y | Bằng chứng từ thử nghiệm, không chỉ từ tương quan |

Phần lớn sản phẩm trên thị trường dừng ở mức một, tự mô tả là mức ba, và không bao giờ chạm mức bốn. Câu hỏi thẩm định gọn: **hệ thống này nói được nên làm gì, hay chỉ nói được đã xảy ra gì?**

## Vòng khép kín và chặng hay đứt nhất

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Vòng khép kín của phân tích học tập</div>
  <div style="min-width:34rem;display:flex;align-items:center;gap:.4rem">
    <div style="flex:1;padding:.7rem .6rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Người học</strong><br>hoạt động thật trong lớp</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Dữ liệu</strong><br>sự kiện được ghi lại</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Chỉ số</strong><br>phân tích và trình bày</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(220,38,38,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45;border:2px solid rgba(220,38,38,1)"><strong>Can thiệp</strong><br>ai đó làm khác đi</div>
  </div>
  <div style="min-width:34rem;text-align:center;font-size:1rem;opacity:.75;margin:.5rem 0 0;line-height:1.6">↺ vòng chỉ khép lại khi can thiệp thay đổi hoạt động của người học. <strong>Chặng cuối là chặng đứt nhiều nhất</strong>: bảng số liệu tồn tại, không ai đọc, hoặc đọc mà không biết làm gì tiếp.</div>
</div>
```

Ba lý do phổ biến khiến chặng cuối đứt:

1. **Không ai được giao trách nhiệm.** Bảng điều khiển hiện trên màn hình quản lý, nhưng không có quy định giáo viên phải xem lúc nào và làm gì sau đó.
2. **Chỉ số không chỉ ra hành động.** *Mức độ tham gia của em A: thấp* không nói được nên làm gì. *Em A chưa mở tài liệu tuần 2 và tắc ở bước nộp tệp* thì nói được.
3. **Không có thời gian.** Giáo viên dạy năm lớp, mỗi lớp bốn mươi em. Một bảng đòi mười phút phân tích mỗi lớp mỗi ngày sẽ không được dùng, dù nó đúng.

> [!meo] Khi thiết kế bất kỳ báo cáo nào cho giáo viên, hãy áp **quy tắc ba mươi giây**: người đọc phải rút ra được một hành động cụ thể trong ba mươi giây đầu. Mọi thứ cần lâu hơn thì đưa xuống lớp thứ hai, cho người muốn đào sâu.

## Một trường hợp kinh điển và bài học phương pháp luận

Hệ thống Course Signals của Đại học Purdue là ví dụ được trích dẫn nhiều nhất trong lĩnh vực: mô hình dự đoán rủi ro dựa trên điểm số, hành vi trên hệ quản lý học tập và đặc điểm nền tảng, hiển thị cho sinh viên bằng đèn giao thông ba màu, kèm quy trình liên hệ của giảng viên. Các báo cáo ban đầu công bố tỉ lệ tốt nghiệp của nhóm dùng hệ thống cao hơn đáng kể.

Sau đó, phân tích lại chỉ ra một vấn đề nhân quả nghiêm trọng: **sinh viên học nhiều học phần có Course Signals hơn chính là sinh viên ở lại trường lâu hơn** — nghĩa là quan hệ có thể ngược chiều với diễn giải ban đầu. Ở lại lâu thì có cơ hội đăng ký nhiều học phần dùng hệ thống, chứ không nhất thiết là dùng hệ thống khiến họ ở lại.

> [!ghi-nho] Đây là dạng sai lệch bạn phải tự động kiểm với mọi tuyên bố trong lĩnh vực này: **thứ tự thời gian của biến can thiệp và biến kết quả**. Câu hỏi kiểm: *biến đo mức độ dùng hệ thống được tính trước hay sau khi biết kết quả cần dự đoán?* Đây chính là công cụ Bài 1.4 áp cho phân tích học tập.

Bài học không phải là Course Signals vô dụng — nó đã tạo ra quy trình liên hệ có tổ chức, và bản thân quy trình ấy có thể là phần hiệu quả nhất. Bài học là: **khi vòng khép lại, rất khó tách phần đóng góp của mô hình khỏi phần đóng góp của việc con người bắt đầu chú ý tới sinh viên**. Muốn tách thì phải thiết kế thử nghiệm, đúng như Module 5 sẽ bàn.

## Phân tích học tập ở quy mô một lớp

Sinh viên tốt nghiệp ngành này thường sẽ không xây hệ thống cấp trường đại học. Bạn sẽ làm ở quy mô một lớp, một tổ chuyên môn, hoặc một trường phổ thông — và ở quy mô ấy, những thứ đơn giản lại có hiệu quả cao nhất:

| Việc | Dữ liệu cần | Hành động dẫn tới |
|---|---|---|
| Tìm câu hỏi cả lớp cùng sai | Kết quả từng câu, không chỉ tổng điểm | Dạy lại đúng một khái niệm trong 10 phút |
| Tìm học sinh tắc ở cùng một bước | Nhật ký thao tác có mốc thời gian | Nhóm ba em lại và hướng dẫn một lần |
| So sánh hai cách giao bài | Kết quả hai lớp song song | Giữ cách hiệu quả hơn cho các lớp sau |
| Phát hiện bài tập không dạy được gì | Tỉ lệ đúng trước và sau khi làm bài | Bỏ bài tập ấy, tiết kiệm thời gian cả lớp |

Bốn việc trên đều nằm ở mức mô tả và chẩn đoán, đều làm được bằng bảng tính, và đều **kết thúc bằng một hành động cụ thể**. Đó là tiêu chuẩn cần đạt trước khi nghĩ tới mô hình dự đoán.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Chọn một hệ thống học tập bạn tiếp cận được. Xác định nó đang ở mức nào trong bốn mức, và tìm bằng chứng cho kết luận ấy. Sau đó viết một câu mô tả chặng đứt: dữ liệu có nhưng ai không đọc, hay đọc mà không có hành động nào đi kèm.

### Nhóm 3–4 người (30 phút)

Nhóm nhận một báo cáo phân tích học tập có thật (giáo viên cung cấp). Áp quy tắc ba mươi giây: mỗi người đọc 30 giây rồi viết ra hành động mình sẽ làm. So bốn câu trả lời — nếu chúng khác nhau hoặc để trống, báo cáo ấy chưa dẫn tới hành động, và nhóm đề xuất bản sửa.

### Bài tập về nhà — sản phẩm số (100 phút)

Thực hiện **một chu trình phân tích khép kín ở quy mô nhỏ** trên dữ liệu thật.

1. Chọn một trong bốn việc ở bảng mục 4, trên dữ liệu bạn có quyền truy cập (lớp bạn đang trợ giảng, dữ liệu bài tập của Module 3, hoặc dữ liệu mô phỏng nếu thật sự không có).
2. Ghi rõ **câu hỏi** trước khi nhìn dữ liệu, và **hành động dự kiến** ứng với từng kết quả có thể xảy ra.
3. Phân tích bằng bảng tính, trình bày bằng đúng một biểu đồ hoặc một bảng.
4. Thực hiện hoặc mô tả chi tiết can thiệp tương ứng, rồi nêu cách bạn sẽ biết can thiệp ấy có tác dụng.
5. Viết nửa trang tự phê: chặng nào trong vòng khép kín của bạn yếu nhất, và vì sao.

**Cách làm (gợi ý từng bước):** viết câu hỏi và hành động dự kiến ra giấy trước khi mở dữ liệu — đây là phiên bản nhỏ của tiền đăng ký nghiên cứu và nó chặn việc đi tìm kết quả đẹp; chỉ một biểu đồ, chọn loại phù hợp với câu hỏi chứ không chọn loại đẹp; nếu dùng dữ liệu thật của người học, khử tên trước khi phân tích và nói rõ trong báo cáo.

**Chấm theo:** câu hỏi và hành động dự kiến viết trước, có bằng chứng (3đ) · phân tích đúng và trình bày gọn (2đ) · can thiệp cụ thể, làm được trong điều kiện thật (3đ) · tự phê chỉ đúng chặng yếu (2đ).

### Nguồn tham khảo

- Siemens, G., & Long, P. (2011). Penetrating the fog: Analytics in learning and education. *EDUCAUSE Review*, 46(5), 30–40.
- Clow, D. (2012). The learning analytics cycle: Closing the loop effectively. *LAK '12*, 134–138.
- Arnold, K. E., & Pistilli, M. D. (2012). Course Signals at Purdue: Using learning analytics to increase student success. *LAK '12*, 267–270.
- Ferguson, R. (2012). Learning analytics: Drivers, developments and challenges. *International Journal of Technology Enhanced Learning*, 4(5/6), 304–317.
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.1-bon-muc",
                "type": "matching",
                "prompt": "Ghép mỗi mức phân tích với câu hỏi nó trả lời.",
                "explanation": "Bốn mức xếp theo giá trị tăng dần; phần lớn sản phẩm dừng ở mức mô tả nhưng tự giới thiệu là mức dự đoán.",
                "points": 3,
                "pairs": [
                    {"left": "Mô tả", "right": "Chuyện gì đã xảy ra"},
                    {"left": "Chẩn đoán", "right": "Vì sao nó xảy ra"},
                    {"left": "Dự đoán", "right": "Sắp xảy ra chuyện gì"},
                    {"left": "Kê đơn", "right": "Nên làm gì, và với nhóm nào thì cách nào hiệu quả hơn"},
                ],
            },
            {
                "key": "4.1-chang-dut",
                "type": "mcq",
                "prompt": "Trong vòng khép kín của phân tích học tập, chặng nào hay đứt nhất?",
                "explanation": "Chặng từ chỉ số tới can thiệp: bảng số liệu tồn tại nhưng không ai đọc, hoặc đọc mà không biết làm gì tiếp.",
                "points": 2,
                "options": [
                    {"label": "Từ chỉ số tới can thiệp — không ai đọc, hoặc đọc mà không có hành động", "isCorrect": True},
                    {"label": "Từ người học tới dữ liệu", "isCorrect": False},
                    {"label": "Từ dữ liệu tới chỉ số", "isCorrect": False},
                    {"label": "Không chặng nào đứt nếu hệ thống chạy ổn định", "isCorrect": False, "misconception": "cngdtt.dashboard-equals-action"},
                ],
            },
            {
                "key": "4.1-chi-so-hanh-dong",
                "type": "mcq",
                "prompt": "Cách trình bày nào dẫn tới hành động tốt hơn?",
                "explanation": "Chỉ số phải chỉ ra chỗ tắc cụ thể. Nhãn mức độ tham gia thấp không nói được nên làm gì; mô tả hành vi cụ thể thì nói được.",
                "points": 2,
                "options": [
                    {"label": "Em A chưa mở tài liệu tuần 2 và tắc ở bước nộp tệp", "isCorrect": True},
                    {"label": "Mức độ tham gia của em A: thấp", "isCorrect": False, "misconception": "cngdtt.dashboard-equals-action"},
                    {"label": "Điểm chuyên cần của em A: 6/10", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "Em A xếp thứ 31/40 về mức độ hoạt động", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-quy-tac-30-giay",
                "type": "mcq",
                "prompt": "Quy tắc ba mươi giây khi thiết kế báo cáo cho giáo viên nghĩa là gì?",
                "explanation": "Người đọc phải rút ra được một hành động cụ thể trong ba mươi giây đầu; phần cần lâu hơn đưa xuống lớp thứ hai cho người muốn đào sâu.",
                "points": 2,
                "options": [
                    {"label": "Trong 30 giây đầu, người đọc phải rút ra được một hành động cụ thể", "isCorrect": True},
                    {"label": "Báo cáo phải tải xong trong 30 giây", "isCorrect": False},
                    {"label": "Giáo viên chỉ được xem báo cáo tối đa 30 giây mỗi ngày", "isCorrect": False},
                    {"label": "Mỗi biểu đồ phải vẽ xong trong 30 giây", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-course-signals",
                "type": "mcq",
                "prompt": "Phê phán phương pháp luận với kết quả ban đầu của Course Signals là gì?",
                "explanation": "Sinh viên học nhiều học phần có hệ thống hơn chính là sinh viên ở lại trường lâu hơn — quan hệ có thể ngược chiều với diễn giải ban đầu.",
                "points": 2,
                "options": [
                    {"label": "Quan hệ có thể ngược chiều: ở lại lâu nên mới học được nhiều học phần dùng hệ thống", "isCorrect": True},
                    {"label": "Mô hình dự đoán dùng quá ít biến", "isCorrect": False},
                    {"label": "Đèn giao thông ba màu gây hiểu nhầm về màu sắc", "isCorrect": False},
                    {"label": "Không có phê phán nào đáng kể", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-cau-hoi-kiem",
                "type": "mcq",
                "prompt": "Câu hỏi kiểm nào bắt được dạng sai lệch trong trường hợp Course Signals?",
                "explanation": "Biến đo mức độ dùng hệ thống được tính trước hay sau khi biết kết quả cần dự đoán — tức thứ tự thời gian giữa can thiệp và kết quả.",
                "points": 2,
                "options": [
                    {"label": "Biến can thiệp được đo trước hay sau khi kết quả đã hình thành", "isCorrect": True},
                    {"label": "Cỡ mẫu có đủ lớn không", "isCorrect": False},
                    {"label": "Mô hình dùng thuật toán nào", "isCorrect": False},
                    {"label": "Giao diện có thân thiện không", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-tach-dong-gop",
                "type": "mcq",
                "prompt": "Khi một hệ cảnh báo sớm đi kèm quy trình liên hệ của giảng viên và kết quả có cải thiện, khó khăn diễn giải là gì?",
                "explanation": "Khó tách phần đóng góp của mô hình khỏi phần đóng góp của việc con người bắt đầu chú ý tới sinh viên. Muốn tách phải thiết kế thử nghiệm.",
                "points": 2,
                "options": [
                    {"label": "Không tách được đóng góp của mô hình khỏi đóng góp của việc có người quan tâm hơn", "isCorrect": True},
                    {"label": "Không đo được số lần giảng viên đăng nhập", "isCorrect": False},
                    {"label": "Mô hình chạy quá chậm", "isCorrect": False},
                    {"label": "Không có khó khăn nào nếu cải thiện đủ lớn", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                ],
            },
            {
                "key": "4.1-quy-mo-lop",
                "type": "mcq",
                "prompt": "Ở quy mô một lớp, việc phân tích nào cho hiệu quả cao nhất so với công sức bỏ ra?",
                "explanation": "Những việc ở mức mô tả và chẩn đoán làm được bằng bảng tính và kết thúc bằng hành động cụ thể — ví dụ tìm câu hỏi cả lớp cùng sai rồi dạy lại đúng khái niệm ấy.",
                "points": 2,
                "options": [
                    {"label": "Tìm câu hỏi cả lớp cùng sai rồi dạy lại đúng khái niệm đó", "isCorrect": True},
                    {"label": "Dựng mô hình dự đoán điểm cuối kỳ cho từng em", "isCorrect": False},
                    {"label": "Xếp hạng học sinh theo thời gian trực tuyến", "isCorrect": False, "misconception": "cngdtt.engagement-equals-learning"},
                    {"label": "Thu thập toàn bộ nhật ký thao tác để phân tích sau", "isCorrect": False, "misconception": "cngdtt.collect-all-data"},
                ],
            },
            {
                "key": "4.1-tham-dinh-gon",
                "type": "mcq",
                "prompt": "Câu hỏi thẩm định gọn nhất với một sản phẩm phân tích học tập là gì?",
                "explanation": "Hệ thống nói được nên làm gì, hay chỉ nói được đã xảy ra gì. Nhiều sản phẩm dừng ở mô tả nhưng tự giới thiệu là dự đoán.",
                "points": 2,
                "options": [
                    {"label": "Nó nói được nên làm gì, hay chỉ nói được đã xảy ra gì", "isCorrect": True},
                    {"label": "Nó lưu được bao nhiêu dữ liệu", "isCorrect": False},
                    {"label": "Nó có bao nhiêu loại biểu đồ", "isCorrect": False},
                    {"label": "Nó cập nhật số liệu theo thời gian thực không", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-thoi-gian-giao-vien",
                "type": "mcq",
                "prompt": "Một bảng điều khiển đúng về mặt phân tích nhưng đòi giáo viên mười phút mỗi lớp mỗi ngày. Vấn đề là gì?",
                "explanation": "Giáo viên dạy nhiều lớp; công cụ đòi quá nhiều thời gian sẽ không được dùng, và một công cụ không được dùng thì đúng cũng vô nghĩa.",
                "points": 2,
                "options": [
                    {"label": "Nó sẽ không được dùng, nên độ chính xác của nó không tạo ra tác dụng nào", "isCorrect": True},
                    {"label": "Không có vấn đề gì nếu số liệu chính xác", "isCorrect": False, "misconception": "cngdtt.dashboard-equals-action"},
                    {"label": "Cần đào tạo giáo viên đọc nhanh hơn", "isCorrect": False},
                    {"label": "Cần thêm nhiều biểu đồ để giáo viên hiểu nhanh hơn", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-thu-tu-vong",
                "type": "ordering",
                "prompt": "Sắp xếp bốn chặng của vòng khép kín theo đúng thứ tự.",
                "explanation": "Vòng chỉ khép lại khi can thiệp thay đổi hoạt động của người học — nếu không, đó là một đường thẳng kết thúc ở bảng số liệu.",
                "points": 3,
                "sequence": [
                    "Người học hoạt động trong môi trường học tập",
                    "Sự kiện được ghi lại thành dữ liệu",
                    "Dữ liệu được phân tích và trình bày thành chỉ số",
                    "Có người đọc và làm khác đi, tác động trở lại người học",
                ],
            },
            {
                "key": "4.1-viet-truoc",
                "type": "true_false",
                "prompt": "Nên viết câu hỏi phân tích và hành động dự kiến ra giấy trước khi mở dữ liệu.",
                "explanation": "Đúng — đây là phiên bản nhỏ của tiền đăng ký nghiên cứu, và nó chặn việc đi tìm kết quả đẹp rồi mới nghĩ ra câu hỏi khớp với kết quả ấy.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "4.1-viet-luan-vong",
                "type": "essay",
                "prompt": "Chọn một cơ sở giáo dục bạn biết. Viết 250–350 từ mô tả một vòng khép kín khả thi ở đó: câu hỏi gì, dữ liệu nào đã có sẵn, ai đọc kết quả và làm gì, và bạn biết vòng đã khép bằng dấu hiệu nào.",
                "points": 5,
            },
        ],
    },
}

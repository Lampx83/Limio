# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.3 · Từ BKT tới học sâu: mô hình nào cho việc gì",
    "durationMin": 50,
    "description": "Ba họ mô hình theo vết tri thức, câu chuyện tranh cãi quanh Deep Knowledge Tracing, và tiêu chí chọn mô hình cho một hệ thống dạy học thật — trong đó dự đoán tốt chỉ là một tiêu chí.",
    "objectives": [
        "So sánh được ba họ mô hình theo vết tri thức về khả năng dự đoán, diễn giải và hành động",
        "Giải thích được vì sao kết quả ban đầu của Deep Knowledge Tracing bị đặt lại nghi vấn",
        "Nhận ra được hai hành vi người học mà mọi mô hình chỉ dựa trên đúng sai đều bỏ sót",
    ],
    "summary": [
        "Ba họ: mô hình trạng thái ẩn kiểu BKT, mô hình hồi quy kiểu AFM và PFA, và mô hình mạng nơ-ron kiểu DKT.",
        "Deep Knowledge Tracing từng được báo cáo vượt BKT rất xa, nhưng phần lớn khoảng cách biến mất sau khi sửa lỗi dữ liệu và mở rộng BKT một cách công bằng.",
        "Trong dạy học, mô hình phải đạt ba tiêu chí cùng lúc: dự đoán được, diễn giải được cho giáo viên, và nói được nên làm gì tiếp theo.",
        "Quay bánh xe và lách hệ thống là hai hành vi mà chỉ nhìn chuỗi đúng sai thì không thấy, nhưng chúng quyết định trải nghiệm học thật.",
    ],
    "body": r"""
## Ba họ mô hình và câu hỏi mà mỗi họ trả lời

| Họ mô hình | Đại diện | Cách hình dung tri thức | Mạnh | Yếu |
|---|---|---|---|---|
| Trạng thái ẩn | BKT và các biến thể | Biến ẩn hai trạng thái cho từng kỹ năng | Diễn giải trực tiếp; xác suất nắm dùng ngay để quyết định | Cần ma trận Q tốt; giả định không quên |
| Hồi quy theo yếu tố | AFM, PFA | Xác suất đúng là hàm của năng lực người học, độ khó kỹ năng, và **số lần đã luyện** | Ước lượng được tốc độ học của từng kỹ năng; so sánh được kỹ năng nào dạy hiệu quả | Không cho trạng thái tức thời rõ ràng như BKT |
| Mạng nơ-ron | DKT và hậu duệ | Trạng thái ẩn liên tục do mạng tự học từ chuỗi tương tác | Không cần ma trận Q; bắt được quan hệ giữa các kỹ năng | Khó diễn giải; khó nói *nên dạy gì tiếp theo* |

Điểm đáng chú ý của họ thứ hai: vì mô hình có riêng một hệ số cho **số lần đã luyện**, nó trả lời được câu hỏi mà BKT không trả lời trực tiếp — *kỹ năng này có thật sự tiến bộ theo luyện tập không*. Một kỹ năng mà hệ số ấy gần bằng không là dấu hiệu bài tập hiện có không dạy được nó, và đó là thông tin để sửa **chương trình**, không phải để sửa người học.

## Deep Knowledge Tracing: một bài học về đọc kết quả

Năm 2015, nhóm của Piech công bố Deep Knowledge Tracing: dùng mạng nơ-ron hồi tiếp trên chuỗi tương tác của người học, không cần khai báo ma trận Q, và báo cáo cải thiện rất lớn so với BKT trên các chỉ số dự đoán. Kết quả gây tiếng vang mạnh trong cộng đồng.

Ba năm sau, bức tranh khác đi:

1. **Lỗi dữ liệu.** Một trong các bộ dữ liệu được dùng chứa bản ghi trùng lặp; sau khi làm sạch, khoảng cách hẹp lại đáng kể.
2. **So sánh không công bằng.** BKT trong bài gốc là bản cơ sở, không có các mở rộng đã biết từ lâu. Khi so với BKT được mở rộng hợp lý — cá nhân hoá tham số, thêm yếu tố quên — phần lớn khoảng cách còn lại biến mất.
3. **Dự đoán không nhất quán.** Các nghiên cứu sau chỉ ra đầu ra của DKT có thể dao động một cách khó biện minh về mặt sư phạm, ví dụ xác suất nắm một kỹ năng giảm sau khi người học trả lời đúng chính kỹ năng đó.

> [!ghi-nho] Đây là bài học phương pháp luận, không phải bài học chống học sâu: **một mô hình mới chỉ được coi là tốt hơn khi so với phiên bản mạnh nhất của mô hình cũ, trên dữ liệu đã làm sạch, bằng chỉ số phù hợp với mục đích sử dụng.** Đúng nguyên tắc bạn đã học ở Bài 1.4, áp cho lĩnh vực mô hình hoá.

## Ba tiêu chí chọn mô hình cho một hệ thống dạy học

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:34rem;display:flex;gap:.5rem">
    <div style="flex:1;border-radius:.5rem;overflow:hidden;border:1px solid rgba(127,127,127,.3)">
      <div style="background:rgba(37,99,235,.85);color:#fff;padding:.55rem;text-align:center;font-size:1.05rem;font-weight:600">Dự đoán được</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Đoán đúng lượt tiếp theo tới đâu — đo bằng chỉ số trên tập dữ liệu giữ riêng<br><span style="opacity:.7">tiêu chí duy nhất mà các bài báo hay báo cáo</span></div>
    </div>
    <div style="flex:1;border-radius:.5rem;overflow:hidden;border:1px solid rgba(127,127,127,.3)">
      <div style="background:rgba(13,148,136,.85);color:#fff;padding:.55rem;text-align:center;font-size:1.05rem;font-weight:600">Diễn giải được</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Giáo viên đọc được kết quả và tin hay không tin có căn cứ<br><span style="opacity:.7">điều kiện để hệ thống được dùng thật</span></div>
    </div>
    <div style="flex:1;border-radius:.5rem;overflow:hidden;border:2px solid rgba(217,150,40,.6)">
      <div style="background:rgba(217,150,40,.9);color:#fff;padding:.55rem;text-align:center;font-size:1.05rem;font-weight:600">Hành động được</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Từ đầu ra suy ra được nên cho bài gì tiếp theo, hoặc nên gọi giáo viên<br><span style="opacity:.7">tiêu chí quyết định, và hay bị bỏ quên nhất</span></div>
    </div>
  </div>
</div>
```

Ba tiêu chí này thường đối chọi nhau. Mô hình mạng nơ-ron thường thắng ở cột một và thua ở cột hai; BKT thắng ở cột hai và ba; mô hình hồi quy đứng giữa và mạnh riêng ở việc **đánh giá chương trình** chứ không phải đánh giá người học. Chọn mô hình vì vậy là quyết định sư phạm, không phải quyết định kỹ thuật thuần tuý.

> [!vi-du] Một hệ thống dự đoán chính xác 85% việc người học sẽ sai câu tiếp theo, nhưng không nói được vì sao và không gợi ý được nên cho bài nào — nó là một máy tiên tri, không phải một hệ dạy học. Ngược lại, một mô hình dự đoán kém hơn nhưng chỉ được *em đang hổng bước quy đồng* có giá trị sử dụng cao hơn hẳn.

## Hai thứ mọi mô hình đúng–sai đều bỏ sót

**Quay bánh xe.** Beck và Gong (2013) đặt tên cho hiện tượng người học làm rất nhiều bài về một kỹ năng mà không bao giờ đạt ngưỡng thành thạo — xác suất nắm đi ngang qua hàng chục lượt. Với hệ thống, đó chỉ là một chuỗi đúng sai; với người học, đó là hàng giờ vô ích và niềm tin bị bào mòn. Quy tắc thực hành: **đặt ngưỡng số lượt** (ví dụ 10 lượt chưa đạt) làm điều kiện kích hoạt hành động khác — đổi loại nhiệm vụ, quay về kỹ năng tiên quyết, hoặc chuyển cho giáo viên.

**Lách hệ thống.** Baker và cộng sự mô tả các hành vi kiểu bấm xin gợi ý liên tiếp tới khi hệ thống lộ đáp án, hoặc thử nhanh mọi phương án. Người học không lười — họ đang tối ưu theo đúng thứ hệ thống đo. Dấu hiệu nhận diện nằm ở **dữ liệu thời gian và nhịp thao tác**, không nằm ở đúng sai: trả lời sau 1,5 giây, ba phương án trong bốn giây, xin gợi ý trước khi đọc đề.

> [!canh-bao] Hệ quả cho thiết kế nhật ký sự kiện: nếu hệ thống chỉ ghi *câu hỏi X, kết quả đúng*, bạn vĩnh viễn không phát hiện được hai hành vi trên. Phải ghi thêm **dấu thời gian, số lần xin gợi ý, số lần đổi đáp án, thời gian dừng trước khi trả lời** — đây chính là thiết kế dữ liệu hành vi mà Module 4 sẽ đi sâu.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Lấy một hệ thống học tập bạn đang dùng (kể cả hệ thống của khoá này). Liệt kê những gì nó có thể đang ghi lại về bạn, rồi đánh dấu: cái nào cần để phát hiện quay bánh xe, cái nào cần để phát hiện lách hệ thống. Ghi lại một trường dữ liệu bạn nghĩ nó đang thiếu.

### Nhóm 3–4 người (30 phút)

Nhóm nhận ba tình huống: (a) mô hình dự đoán rất tốt nhưng không diễn giải được; (b) mô hình diễn giải tốt nhưng dự đoán kém; (c) mô hình trung bình cả hai nhưng gắn thẳng với thư viện bài tập. Mỗi nhóm chọn một tình huống để bảo vệ là lựa chọn đúng cho một trường phổ thông, và phải nêu điều kiện nào khiến lựa chọn ấy sai.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **bộ phát hiện quay bánh xe và lách hệ thống** trên dữ liệu lượt làm.

1. Lấy dữ liệu lượt làm từ bài tập ở Bài 3.1 hoặc 3.2 (nếu chưa đủ, mô phỏng 30 người học × 20 lượt bằng bảng tính).
2. Cài quy tắc quay bánh xe: cảnh báo khi một người học vượt N lượt cùng kỹ năng mà xác suất nắm chưa qua ngưỡng. Chọn N và **bảo vệ lựa chọn ấy bằng dữ liệu**, không chọn tuỳ tiện.
3. Cài hai chỉ báo lách hệ thống dựa trên thời gian: trả lời quá nhanh so với thời gian đọc tối thiểu, và chuỗi đổi đáp án liên tiếp.
4. Xuất một **bảng cảnh báo cho giáo viên**: mỗi dòng một người học, kỹ năng, loại cảnh báo, và một câu gợi ý hành động.
5. Viết nửa trang về rủi ro báo động giả: ai bị gắn nhãn oan, hậu quả gì, và bạn giảm rủi ro ấy thế nào.

**Cách làm (gợi ý từng bước):** ước lượng thời gian đọc tối thiểu bằng số chữ chia cho tốc độ đọc hợp lý theo lứa tuổi, đừng đặt một hằng số chung; chọn N bằng cách vẽ phân bố số lượt tới khi đạt ngưỡng rồi lấy phân vị cao, ví dụ phân vị 90; câu gợi ý hành động phải cụ thể tới mức giáo viên làm được ngay, tránh kiểu *cần quan tâm thêm*.

**Chấm theo:** quy tắc quay bánh xe có căn cứ từ dữ liệu, không đặt bừa (3đ) · hai chỉ báo thời gian hợp lý theo lứa tuổi và nội dung (3đ) · bảng cảnh báo dùng được, gợi ý hành động cụ thể (2đ) · phần rủi ro báo động giả nêu được hậu quả với người học cụ thể (2đ).

### Nguồn tham khảo

- Piech, C., Bassen, J., Huang, J., và cộng sự (2015). Deep knowledge tracing. *NeurIPS 28*.
- Xiong, X., Zhao, S., Van Inwegen, E., & Beck, J. (2016). Going deeper with deep knowledge tracing. *EDM 2016*.
- Khajah, M., Lindsey, R. V., & Mozer, M. C. (2016). How deep is knowledge tracing? *EDM 2016*.
- Cen, H., Koedinger, K., & Junker, B. (2006). Learning Factors Analysis. *ITS 2006*, 164–175.
- Pavlik, P. I., Cen, H., & Koedinger, K. R. (2009). Performance Factors Analysis. *AIED 2009*.
- Beck, J. E., & Gong, Y. (2013). Wheel-spinning: Students who fail to master a skill. *AIED 2013*, 431–440.
- Baker, R. S., Corbett, A. T., Koedinger, K. R., & Wagner, A. Z. (2004). Off-task behavior in the Cognitive Tutor classroom. *CHI 2004*, 383–390.
""",
    "quiz": {
        "title": "Kiểm tra Bài 3.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.3-ba-ho",
                "type": "matching",
                "prompt": "Ghép mỗi họ mô hình với đặc điểm nổi bật của nó.",
                "explanation": "Ba họ mạnh ở ba chỗ khác nhau; chọn mô hình là quyết định sư phạm chứ không chỉ là quyết định kỹ thuật.",
                "points": 3,
                "pairs": [
                    {"left": "BKT và biến thể", "right": "Xác suất nắm từng kỹ năng, dùng trực tiếp để quyết định cho bài gì"},
                    {"left": "AFM và PFA", "right": "Có hệ số riêng cho số lần đã luyện, nên đánh giá được kỹ năng có tiến bộ theo luyện tập không"},
                    {"left": "DKT và hậu duệ", "right": "Không cần ma trận Q, bắt được quan hệ giữa các kỹ năng, nhưng khó diễn giải"},
                ],
            },
            {
                "key": "3.3-he-so-luyen-tap",
                "type": "mcq",
                "prompt": "Mô hình hồi quy cho thấy hệ số ứng với số lần luyện tập của một kỹ năng gần bằng không. Kết luận hành động đúng là gì?",
                "explanation": "Bài tập hiện có không dạy được kỹ năng ấy — đây là thông tin để sửa chương trình và thiết kế nhiệm vụ, không phải để kết luận về người học.",
                "points": 2,
                "options": [
                    {"label": "Bộ bài tập hiện có không dạy được kỹ năng đó; cần sửa chương trình chứ không phải sửa người học", "isCorrect": True},
                    {"label": "Người học nhóm này không có năng lực với kỹ năng đó", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                    {"label": "Cần cho làm thêm nhiều bài cùng dạng hơn nữa", "isCorrect": False, "misconception": "cngdtt.more-practice-better"},
                    {"label": "Mô hình bị lỗi, cần đổi sang mạng nơ-ron", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                ],
            },
            {
                "key": "3.3-dkt-cau-chuyen",
                "type": "mcq",
                "prompt": "Vì sao khoảng cách hiệu năng ban đầu giữa DKT và BKT bị thu hẹp trong các nghiên cứu về sau?",
                "explanation": "Một bộ dữ liệu chứa bản ghi trùng lặp, và BKT trong bài gốc là bản cơ sở chưa có các mở rộng đã biết. Sửa hai chỗ đó thì phần lớn khoảng cách biến mất.",
                "points": 2,
                "options": [
                    {"label": "Dữ liệu có bản ghi trùng lặp, và BKT được so sánh là bản cơ sở chứ không phải bản mở rộng hợp lý", "isCorrect": True},
                    {"label": "Vì mạng nơ-ron bị cấm dùng trong giáo dục", "isCorrect": False},
                    {"label": "Vì DKT chạy quá chậm nên bị loại", "isCorrect": False},
                    {"label": "Vì các nghiên cứu sau dùng chỉ số dễ hơn", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-bai-hoc-phuong-phap",
                "type": "mcq",
                "prompt": "Bài học phương pháp luận từ câu chuyện DKT là gì?",
                "explanation": "Một mô hình mới chỉ được coi là tốt hơn khi so với phiên bản mạnh nhất của mô hình cũ, trên dữ liệu đã làm sạch, bằng chỉ số phù hợp mục đích sử dụng.",
                "points": 2,
                "options": [
                    {"label": "Phải so với phiên bản mạnh nhất của phương pháp cũ, trên dữ liệu sạch, bằng chỉ số phù hợp mục đích", "isCorrect": True},
                    {"label": "Không nên dùng mô hình học sâu trong giáo dục", "isCorrect": False},
                    {"label": "Chỉ nên tin các nghiên cứu công bố sau năm 2020", "isCorrect": False},
                    {"label": "Chỉ số dự đoán là tiêu chí duy nhất cần quan tâm", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                ],
            },
            {
                "key": "3.3-ba-tieu-chi",
                "type": "mcq",
                "prompt": "Trong ba tiêu chí chọn mô hình cho hệ thống dạy học, tiêu chí nào hay bị bỏ quên nhất?",
                "explanation": "Hành động được: từ đầu ra suy ra được nên cho bài gì tiếp theo hoặc nên gọi giáo viên. Các bài báo thường chỉ báo cáo tiêu chí dự đoán.",
                "points": 2,
                "options": [
                    {"label": "Hành động được — mô hình có nói được nên làm gì tiếp theo không", "isCorrect": True},
                    {"label": "Dự đoán được", "isCorrect": False},
                    {"label": "Tốc độ tính toán", "isCorrect": False},
                    {"label": "Dung lượng lưu trữ", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-may-tien-tri",
                "type": "mcq",
                "prompt": "Hệ thống dự đoán chính xác 85% việc người học sẽ sai câu tiếp theo nhưng không nói được vì sao và không gợi ý được bài nào. Đánh giá đúng là gì?",
                "explanation": "Đó là một máy tiên tri, không phải hệ dạy học. Một mô hình dự đoán kém hơn nhưng chỉ được chỗ hổng cụ thể có giá trị sử dụng cao hơn.",
                "points": 2,
                "options": [
                    {"label": "Giá trị sử dụng thấp trong dạy học, dù chỉ số dự đoán cao", "isCorrect": True},
                    {"label": "Đây là hệ thống tốt nhất có thể có", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                    {"label": "Cần tăng độ chính xác lên 95% rồi mới dùng được", "isCorrect": False},
                    {"label": "Nên dùng để xếp loại học sinh đầu năm", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                ],
            },
            {
                "key": "3.3-quay-banh-xe",
                "type": "mcq",
                "prompt": "Hiện tượng quay bánh xe là gì và nên xử lý ra sao?",
                "explanation": "Người học làm rất nhiều bài về một kỹ năng mà xác suất nắm đi ngang. Cần đặt ngưỡng số lượt để kích hoạt hành động khác: đổi loại nhiệm vụ, quay về kỹ năng tiên quyết, hoặc chuyển cho giáo viên.",
                "points": 2,
                "options": [
                    {"label": "Làm nhiều bài mà không đạt ngưỡng; cần đổi cách dạy hoặc chuyển cho giáo viên chứ không thêm bài", "isCorrect": True},
                    {"label": "Người học cố tình làm sai; cần nhắc nhở kỷ luật", "isCorrect": False},
                    {"label": "Mô hình bị lỗi; cần khởi động lại ước lượng", "isCorrect": False},
                    {"label": "Cần tăng gấp đôi số bài tập cùng dạng", "isCorrect": False, "misconception": "cngdtt.more-practice-better"},
                ],
            },
            {
                "key": "3.3-lach-he-thong",
                "type": "mcq",
                "prompt": "Dấu hiệu của hành vi lách hệ thống nằm ở đâu trong dữ liệu?",
                "explanation": "Ở dữ liệu thời gian và nhịp thao tác — trả lời sau 1,5 giây, ba phương án trong bốn giây, xin gợi ý trước khi đọc đề — chứ không ở chuỗi đúng sai.",
                "points": 2,
                "options": [
                    {"label": "Ở dấu thời gian và nhịp thao tác, không ở chuỗi đúng sai", "isCorrect": True},
                    {"label": "Ở tỉ lệ trả lời đúng thấp bất thường", "isCorrect": False},
                    {"label": "Ở số lượng bài tập đã hoàn thành", "isCorrect": False},
                    {"label": "Không phát hiện được bằng dữ liệu", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-nhat-ky-su-kien",
                "type": "mcq",
                "prompt": "Nhật ký hệ thống chỉ ghi câu hỏi và kết quả đúng sai. Hệ quả là gì?",
                "explanation": "Không bao giờ phát hiện được quay bánh xe theo thời gian thực lẫn hành vi lách hệ thống. Cần ghi thêm dấu thời gian, số lần xin gợi ý, số lần đổi đáp án, thời gian dừng trước khi trả lời.",
                "points": 2,
                "options": [
                    {"label": "Mất khả năng phát hiện hành vi lách hệ thống và chẩn đoán quay bánh xe", "isCorrect": True},
                    {"label": "Không hệ quả gì vì đúng sai là thông tin quan trọng nhất", "isCorrect": False},
                    {"label": "Chỉ ảnh hưởng tới tốc độ truy vấn", "isCorrect": False},
                    {"label": "Giúp bảo vệ quyền riêng tư nên là lựa chọn tốt nhất", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-nguoi-hoc-toi-uu",
                "type": "mcq",
                "prompt": "Cách hiểu đúng nhất về người học bấm xin gợi ý liên tiếp cho tới khi hệ thống lộ đáp án?",
                "explanation": "Họ đang tối ưu theo đúng thứ hệ thống đo. Vấn đề nằm ở thiết kế thước đo và cơ chế gợi ý, không phải ở phẩm chất người học.",
                "points": 2,
                "options": [
                    {"label": "Họ tối ưu theo đúng thứ hệ thống đo — vấn đề ở thiết kế, không ở phẩm chất người học", "isCorrect": True},
                    {"label": "Họ lười và cần bị khoá tính năng gợi ý", "isCorrect": False},
                    {"label": "Họ chưa hiểu cách dùng hệ thống", "isCorrect": False},
                    {"label": "Đây là hành vi ngẫu nhiên, không đáng phân tích", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-chon-mo-hinh",
                "type": "mcq",
                "prompt": "Một trường phổ thông cần hệ thống luyện tập có phản hồi cho giáo viên. Tiêu chí chọn mô hình nào nên được ưu tiên?",
                "explanation": "Diễn giải được và hành động được, vì giáo viên phải hiểu và tin kết quả rồi mới dùng, và hệ thống phải nói được nên cho bài gì tiếp theo.",
                "points": 2,
                "options": [
                    {"label": "Diễn giải được và hành động được, kể cả khi chỉ số dự đoán thấp hơn một chút", "isCorrect": True},
                    {"label": "Chỉ số dự đoán cao nhất, các tiêu chí khác tính sau", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                    {"label": "Mô hình mới nhất được công bố gần đây", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Mô hình có nhiều tham số nhất", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-du-doan-dao-dong",
                "type": "true_false",
                "prompt": "Việc xác suất nắm một kỹ năng giảm ngay sau khi người học trả lời đúng chính kỹ năng đó là một hành vi cần đặt nghi vấn về mô hình.",
                "explanation": "Đúng — dù mô hình khớp dữ liệu tốt, hành vi ấy không biện minh được về mặt sư phạm và sẽ không thuyết phục được giáo viên khi hiển thị ra.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "3.3-viet-luan-chon-mo-hinh",
                "type": "essay",
                "prompt": "Bạn được giao chọn mô hình theo vết tri thức cho phần luyện tập của đồ án. Viết 250–350 từ: bạn chọn họ mô hình nào, ba tiêu chí được cân nhắc thế nào trong bối cảnh của bạn, và bạn sẽ ghi thêm những trường dữ liệu nào để phát hiện quay bánh xe.",
                "points": 5,
            },
        ],
    },
}

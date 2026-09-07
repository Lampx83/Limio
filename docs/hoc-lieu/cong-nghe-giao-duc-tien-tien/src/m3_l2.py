# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.2 · Bayesian Knowledge Tracing: bốn tham số và phép cập nhật",
    "durationMin": 55,
    "description": "Mô hình theo vết tri thức được dùng rộng nhất trong ba mươi năm: bốn tham số, công thức cập nhật sau mỗi lượt trả lời, ngưỡng thành thạo, và ba giới hạn phải biết trước khi tin vào con số.",
    "objectives": [
        "Tính được xác suất thành thạo sau một lượt trả lời đúng và một lượt sai",
        "Giải thích được vì sao đoán và sơ suất phải bị chặn trên khi ước lượng tham số",
        "Chỉ ra được ba giả định của BKT có thể bị vi phạm trong lớp học thật",
    ],
    "summary": [
        "BKT mô hình hoá tri thức như một biến ẩn hai trạng thái, cập nhật sau mỗi lượt trả lời bằng quy tắc Bayes rồi cộng thêm xác suất vừa học được.",
        "Bốn tham số: tri thức ban đầu, xác suất học được sau một lượt, xác suất đoán trúng khi chưa nắm, xác suất sơ suất khi đã nắm.",
        "Ngưỡng thành thạo thường đặt 0,95; với bộ tham số điển hình, ba lượt đúng liên tiếp là đủ, còn một lượt sai kéo ước lượng xuống rất mạnh.",
        "Ba giới hạn: nhiều bộ tham số cho cùng dự đoán, mô hình gốc giả định không quên, và mỗi lượt chỉ cập nhật một kỹ năng.",
    ],
    "body": r"""
## Bốn tham số và ý nghĩa sư phạm của từng cái

Bayesian Knowledge Tracing, do Corbett và Anderson đề xuất năm 1995, coi việc nắm một thành phần tri thức là **biến ẩn hai trạng thái**: đã nắm hoặc chưa nắm. Ta không quan sát được trạng thái ấy, chỉ quan sát được đúng hay sai ở mỗi lượt. Bốn tham số nối hai thứ đó với nhau:

| Tham số | Ý nghĩa | Câu hỏi sư phạm tương ứng |
|---|---|---|
| Tri thức ban đầu | Xác suất người học đã nắm kỹ năng trước khi bắt đầu | Bao nhiêu phần trăm học sinh vào lớp đã biết sẵn phần này? |
| Xác suất học được | Sau mỗi lượt luyện tập, xác suất chuyển từ chưa nắm sang nắm | Một lượt luyện tập dạy được bao nhiêu? |
| Đoán | Xác suất trả lời đúng dù chưa nắm | Câu hỏi này có dễ đoán không — bốn phương án thì đoán mò đã 0,25 |
| Sơ suất | Xác suất trả lời sai dù đã nắm | Người học có hay sai do bấm nhầm, đọc lướt, hết giờ không? |

Hai tham số cuối là chỗ mô hình thừa nhận điều mà mọi giáo viên đều biết: **quan sát được đúng chưa chắc là hiểu, và quan sát được sai chưa chắc là chưa hiểu**. Đây cũng là lý do BKT mạnh hơn hẳn việc đếm tỉ lệ đúng.

## Cập nhật sau mỗi lượt: công thức và một ví dụ chạy tay

Mỗi lượt trả lời gồm hai bước: **suy ngược từ quan sát** rồi **cộng thêm phần vừa học được**.

> [!ghi-nho] Sau một lượt **đúng**: `P(nắm | đúng) = P(nắm)·(1 − sơ suất) ÷ [ P(nắm)·(1 − sơ suất) + (1 − P(nắm))·đoán ]`
>
> Sau một lượt **sai**: `P(nắm | sai) = P(nắm)·sơ suất ÷ [ P(nắm)·sơ suất + (1 − P(nắm))·(1 − đoán) ]`
>
> Rồi cả hai trường hợp đều cộng phần học được: `P(nắm) mới = P(nắm | quan sát) + (1 − P(nắm | quan sát))·xác suất học được`

Lấy bộ tham số điển hình: tri thức ban đầu 0,30 · xác suất học được 0,15 · đoán 0,20 · sơ suất 0,10.

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Xác suất thành thạo qua từng lượt · ngưỡng 0,95</div>
  <div style="display:flex;flex-direction:column;gap:.4rem">
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 9rem;font-size:1.02rem">Trước khi làm</div><div style="flex:1"><div style="width:30%;background:rgba(120,113,108,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">0,30</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 9rem;font-size:1.02rem">Lượt 1 · đúng</div><div style="flex:1"><div style="width:71%;background:rgba(13,148,136,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">0,71</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 9rem;font-size:1.02rem">Lượt 2 · đúng</div><div style="flex:1"><div style="width:93%;background:rgba(13,148,136,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">0,93</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 9rem;font-size:1.02rem">Lượt 3 · đúng</div><div style="flex:1"><div style="width:99%;background:rgba(13,148,136,.95);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem;font-weight:600">0,99 — vượt ngưỡng thành thạo</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem;margin-top:.4rem;padding-top:.5rem;border-top:1px dashed rgba(127,127,127,.35)"><div style="flex:0 0 9rem;font-size:1.02rem">Nếu lượt 1 <strong>sai</strong></div><div style="flex:1"><div style="width:19%;min-width:4rem;background:rgba(220,38,38,.85);color:#fff;padding:.35rem .5rem;border-radius:.3rem;font-size:1rem">0,19</div></div></div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Bất đối xứng có chủ ý: một lượt sai kéo ước lượng xuống mạnh hơn một lượt đúng kéo lên, vì sơ suất được đặt thấp (0,10) — mô hình coi sai là tín hiệu mạnh hơn đúng.</div>
</div>
```

Hai điều đáng rút ra từ dãy số này. Thứ nhất, **ba lượt đúng liên tiếp đủ để vượt ngưỡng** với bộ tham số này — nên nếu hệ thống bắt người học làm mười câu như nhau sau khi đã đạt ngưỡng, nó đang lãng phí thời gian của họ. Thứ hai, **một lượt sai đầu tiên gần như xoá sạch tri thức ban đầu** (0,30 xuống 0,19), điều hợp lý khi đoán thấp và sơ suất thấp, nhưng sẽ vô lý nếu tham số bị ước lượng sai.

## Ngưỡng thành thạo và điều nó quyết định

Quy ước phổ biến từ các hệ Cognitive Tutor là **0,95**: khi xác suất nắm vượt ngưỡng, hệ thống ngừng cho bài về kỹ năng ấy và chuyển sang kỹ năng khác. Ngưỡng này không thiêng liêng, và chọn nó là một quyết định sư phạm có đánh đổi:

| Ngưỡng | Hệ quả | Rủi ro |
|---|---|---|
| Thấp (0,80) | Người học đi nhanh, học được nhiều chủ đề hơn trong cùng thời gian | Chuyển đi khi chưa vững, hổng tích luỹ sang bài sau |
| Chuẩn (0,95) | Cân bằng giữa tiến độ và độ chắc | Vẫn có người vượt ngưỡng nhờ đoán may |
| Cao (0,99) | Rất chắc chắn | Luyện quá mức, chán, và tốn thời gian đáng lẽ dành cho kỹ năng khác |

> [!meo] Khi thẩm định một sản phẩm quảng cáo là học tới thành thạo, hãy hỏi đúng hai câu: **ngưỡng là bao nhiêu**, và **ngưỡng ấy được kiểm bằng gì**. Nếu nhà cung cấp không trả lời được câu thứ nhất, hệ thống nhiều khả năng chỉ đếm số bài đã làm.

## Ba giới hạn phải biết trước khi tin vào con số

**Nhiều bộ tham số cho cùng một dự đoán.** Đây là vấn đề đồng nhất tham số mà Beck và Chang gọi tên năm 2007: hai bộ tham số rất khác nhau về ý nghĩa sư phạm có thể khớp dữ liệu quan sát gần như y hệt. Trường hợp xấu nhất là **mô hình thoái hoá**: khi đoán được ước lượng trên 0,5, trả lời đúng lại **làm giảm** xác suất nắm — mô hình đã học được rằng người chưa nắm mới hay đúng. Cách chặn được dùng rộng rãi là giới hạn cứng: đoán không quá 0,30 và sơ suất không quá 0,10.

**Mô hình gốc giả định không quên.** Trong BKT chuẩn, đã chuyển sang trạng thái nắm thì ở đó vĩnh viễn — không có tham số quên. Với kiến thức dùng liên tục thì tạm chấp nhận được; với từ vựng ngoại ngữ hay công thức ít dùng thì sai rõ rệt, và đó chính là chỗ Bài 3.4 về lặp lại ngắt quãng bù vào.

**Mỗi lượt chỉ cập nhật một kỹ năng.** BKT giả định câu hỏi đo đúng một thành phần tri thức. Với câu tổng hợp gắn ba thành phần — như câu C4 ở Bài 3.1 — mô hình phải chọn cách xử lý, và mọi cách đều có nhược điểm: gán cho cả ba thì phạt oan hai kỹ năng người học vốn vững, gán cho một thì mất thông tin.

> [!canh-bao] Hệ quả thực hành cho khoá luận: **đừng báo cáo tham số BKT như phát hiện về người học**. Câu *xác suất học được của kỹ năng này là 0,15* nghe như một quy luật, nhưng nó phụ thuộc vào bộ bài tập, cách gán ma trận Q, và thuật toán ước lượng. Báo cáo kèm khoảng tin cậy, kèm ràng buộc đã áp, và kèm kiểm tra thoái hoá.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Tính tay với bộ tham số: ban đầu 0,25 · học được 0,20 · đoán 0,25 · sơ suất 0,10. Tính xác suất nắm sau chuỗi đúng — sai — đúng. So với chuỗi đúng — đúng — sai: hai chuỗi cùng hai đúng một sai, kết quả có bằng nhau không, và điều đó nói gì về mô hình?

### Nhóm 3–4 người (30 phút)

Nhóm nhận ba bộ tham số, trong đó có một bộ thoái hoá (đoán 0,55). Mỗi nhóm chạy chuỗi năm lượt trả lời và vẽ đường xác suất. Trình bày: bộ nào cho hành vi vô lý, biểu hiện vô lý là gì, và giải thích vì sao ràng buộc chặn đoán ở 0,30 lại cần thiết.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng một **bản mô phỏng BKT** để giáo viên hiểu được mô hình đang làm gì.

1. Bảng tính hoặc trang web nhận bốn tham số và một chuỗi đúng/sai, xuất ra xác suất nắm sau từng lượt.
2. Vẽ đường xác suất theo lượt, đánh dấu ngưỡng thành thạo đặt được.
3. Thêm **cảnh báo thoái hoá**: tự động báo khi đoán vượt 0,30 hoặc sơ suất vượt 0,10, kèm một câu giải thích hậu quả.
4. Chạy ba kịch bản và ghi nhận xét: người học vững từ đầu, người học tiến bộ dần, và người học quay bánh xe (đúng sai xen kẽ kéo dài).
5. Viết nửa trang giải thích cho một giáo viên không học thống kê: mô hình đang giả định gì, và khi nào không nên tin nó.

**Cách làm (gợi ý từng bước):** dựng hai cột riêng cho hậu nghiệm và cho giá trị sau khi cộng phần học được — gộp một cột là chỗ hay sai; kiểm bản dựng bằng ví dụ trong bài (0,30 → 0,71 → 0,93 → 0,99); với kịch bản quay bánh xe, dùng chuỗi đúng sai xen kẽ mười lượt và xem đường có đi ngang không; phần giải thích cho giáo viên viết bằng câu ngắn, tránh từ hậu nghiệm và tiên nghiệm.

**Chấm theo:** công thức cập nhật đúng, kiểm được bằng ví dụ trong bài (4đ) · biểu đồ có ngưỡng và đọc được (2đ) · cảnh báo thoái hoá hoạt động (2đ) · ba kịch bản có nhận xét đúng (1đ) · phần giải thích cho giáo viên dễ hiểu, nêu được giới hạn (1đ).

### Nguồn tham khảo

- Corbett, A. T., & Anderson, J. R. (1995). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction*, 4, 253–278.
- Beck, J. E., & Chang, K.-m. (2007). Identifiability: A fundamental problem of student modeling. *User Modeling 2007*, 137–146.
- Baker, R. S. J. d., Corbett, A. T., & Aleven, V. (2008). More accurate student modeling through contextual estimation of slip and guess probabilities. *ITS 2008*, 406–415.
- Yudelson, M. V., Koedinger, K. R., & Gordon, G. J. (2013). Individualized Bayesian knowledge tracing models. *AIED 2013*, 171–180.
""",
    "quiz": {
        "title": "Kiểm tra Bài 3.2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.2-bon-tham-so",
                "type": "matching",
                "prompt": "Ghép mỗi tham số của BKT với câu hỏi sư phạm tương ứng.",
                "explanation": "Bốn tham số nối trạng thái ẩn (đã nắm hay chưa) với quan sát được (đúng hay sai); hai tham số đoán và sơ suất là chỗ mô hình thừa nhận đúng chưa chắc hiểu, sai chưa chắc không hiểu.",
                "points": 3,
                "pairs": [
                    {"left": "Tri thức ban đầu", "right": "Bao nhiêu phần trăm học sinh vào lớp đã biết sẵn phần này"},
                    {"left": "Xác suất học được", "right": "Một lượt luyện tập dạy được bao nhiêu"},
                    {"left": "Đoán", "right": "Câu hỏi này có dễ chọn trúng khi chưa hiểu không"},
                    {"left": "Sơ suất", "right": "Người học có hay sai do bấm nhầm, đọc lướt, hết giờ không"},
                ],
            },
            {
                "key": "3.2-tinh-mot-luot",
                "type": "fill_in",
                "prompt": "Với tri thức ban đầu 0,30 · đoán 0,20 · sơ suất 0,10, xác suất nắm SAU KHI suy ngược từ một lượt trả lời đúng (chưa cộng phần học được) bằng bao nhiêu? Làm tròn hai chữ số thập phân.",
                "explanation": "0,30 × 0,90 ÷ (0,30 × 0,90 + 0,70 × 0,20) = 0,27 ÷ 0,41 ≈ 0,66. Cộng phần học được 0,15 nữa mới ra 0,71 như trong bài.",
                "points": 3,
                "answers": ["0,66", "0.66", "0,659", "0.659"],
            },
            {
                "key": "3.2-hai-buoc",
                "type": "mcq",
                "prompt": "Mỗi lượt trả lời được xử lý qua hai bước nào?",
                "explanation": "Suy ngược từ quan sát bằng quy tắc Bayes, rồi cộng thêm xác suất người học vừa học được trong chính lượt đó.",
                "points": 2,
                "options": [
                    {"label": "Suy ngược từ quan sát, rồi cộng thêm phần vừa học được trong lượt đó", "isCorrect": True},
                    {"label": "Tính điểm trung bình rồi so với ngưỡng", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "So sánh với các bạn cùng lớp rồi xếp hạng", "isCorrect": False},
                    {"label": "Đếm số lượt đúng liên tiếp", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-bat-doi-xung",
                "type": "mcq",
                "prompt": "Vì sao một lượt sai kéo xác suất nắm xuống mạnh hơn một lượt đúng kéo nó lên?",
                "explanation": "Vì sơ suất được đặt thấp: nếu đã nắm thì rất hiếm khi sai, nên một lần sai là bằng chứng mạnh cho việc chưa nắm. Trong khi đó đúng vẫn có thể do đoán.",
                "points": 2,
                "options": [
                    {"label": "Vì sơ suất thấp nên sai là bằng chứng mạnh, còn đúng vẫn có thể do đoán", "isCorrect": True},
                    {"label": "Vì mô hình được thiết kế để phạt người học", "isCorrect": False},
                    {"label": "Vì xác suất học được luôn nhỏ hơn xác suất quên", "isCorrect": False},
                    {"label": "Đó là lỗi của mô hình, cần hiệu chỉnh cho cân xứng", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-ngung-khi-dat",
                "type": "mcq",
                "prompt": "Với bộ tham số trong bài, ba lượt đúng liên tiếp đã đưa xác suất lên 0,99. Hệ quả thiết kế là gì?",
                "explanation": "Bắt người học làm thêm mười câu cùng loại sau khi đã vượt ngưỡng là lãng phí thời gian của họ — thời gian ấy nên dành cho kỹ năng chưa vững.",
                "points": 2,
                "options": [
                    {"label": "Hệ thống nên chuyển sang kỹ năng khác thay vì tiếp tục cho bài cùng loại", "isCorrect": True},
                    {"label": "Nên cho làm thêm mười câu nữa cho chắc", "isCorrect": False, "misconception": "cngdtt.more-practice-better"},
                    {"label": "Nên hạ ngưỡng xuống 0,80 để đi nhanh hơn", "isCorrect": False},
                    {"label": "Nên tăng độ khó của cùng kỹ năng ấy vô hạn", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-nguong-thap",
                "type": "mcq",
                "prompt": "Đặt ngưỡng thành thạo ở 0,80 thay vì 0,95 có rủi ro chính là gì?",
                "explanation": "Người học được chuyển sang chủ đề mới khi chưa thật vững, và chỗ hổng tích luỹ sang các bài sau — đặc biệt nguy hiểm với môn có cấu trúc tuyến tính.",
                "points": 2,
                "options": [
                    {"label": "Chuyển chủ đề khi chưa vững, chỗ hổng tích luỹ sang bài sau", "isCorrect": True},
                    {"label": "Người học phải luyện quá nhiều và chán", "isCorrect": False},
                    {"label": "Mô hình chạy chậm hơn", "isCorrect": False},
                    {"label": "Không có rủi ro, ngưỡng chỉ là quy ước kỹ thuật", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-thoai-hoa",
                "type": "mcq",
                "prompt": "Mô hình có đoán được ước lượng là 0,55. Hành vi vô lý nào sẽ xuất hiện?",
                "explanation": "Khi đoán vượt 0,5, trả lời đúng lại làm giảm xác suất nắm — mô hình đã học rằng người chưa nắm mới hay trả lời đúng. Đây là mô hình thoái hoá.",
                "points": 2,
                "options": [
                    {"label": "Trả lời đúng làm giảm xác suất nắm", "isCorrect": True},
                    {"label": "Xác suất nắm không bao giờ vượt 0,5", "isCorrect": False},
                    {"label": "Mô hình luôn dự đoán người học sẽ sai", "isCorrect": False},
                    {"label": "Không có gì vô lý nếu dữ liệu khớp tốt", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                ],
            },
            {
                "key": "3.2-rang-buoc",
                "type": "mcq",
                "prompt": "Ràng buộc đoán không quá 0,30 và sơ suất không quá 0,10 phục vụ mục đích gì?",
                "explanation": "Chặn mô hình rơi vào vùng thoái hoá và giữ cho tham số còn diễn giải được theo nghĩa sư phạm, khi mà nhiều bộ tham số khác nhau có thể khớp dữ liệu gần như y hệt.",
                "points": 2,
                "options": [
                    {"label": "Chặn mô hình thoái hoá và giữ cho tham số còn diễn giải được về mặt sư phạm", "isCorrect": True},
                    {"label": "Giảm thời gian tính toán", "isCorrect": False},
                    {"label": "Làm cho xác suất nắm tăng nhanh hơn", "isCorrect": False},
                    {"label": "Đáp ứng yêu cầu của quy chế đánh giá", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-khong-quen",
                "type": "mcq",
                "prompt": "BKT chuẩn giả định đã nắm thì không quên. Giả định này sai rõ rệt ở đâu?",
                "explanation": "Ở kiến thức ít dùng lại: từ vựng ngoại ngữ, công thức hiếm dùng. Đó là chỗ lặp lại ngắt quãng ở Bài 3.4 bù vào.",
                "points": 2,
                "options": [
                    {"label": "Ở kiến thức ít được dùng lại như từ vựng ngoại ngữ hay công thức hiếm dùng", "isCorrect": True},
                    {"label": "Ở kỹ năng vận động", "isCorrect": False},
                    {"label": "Ở học sinh lớp lớn", "isCorrect": False},
                    {"label": "Giả định này không bao giờ sai trên thực tế", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-cau-tong-hop",
                "type": "mcq",
                "prompt": "Một câu hỏi gắn ba thành phần tri thức. BKT xử lý thế nào và nhược điểm là gì?",
                "explanation": "Mô hình giả định mỗi lượt đo một kỹ năng. Gán cho cả ba thì phạt oan hai kỹ năng người học vốn vững; gán cho một thì mất thông tin về hai kỹ năng còn lại.",
                "points": 2,
                "options": [
                    {"label": "Phải chọn: gán cả ba thì phạt oan kỹ năng đã vững, gán một thì mất thông tin", "isCorrect": True},
                    {"label": "Mô hình tự động tách được đóng góp của từng kỹ năng", "isCorrect": False},
                    {"label": "Câu tổng hợp luôn bị loại khỏi mô hình", "isCorrect": False},
                    {"label": "Không ảnh hưởng gì tới kết quả", "isCorrect": False},
                ],
            },
            {
                "key": "3.2-bao-cao-tham-so",
                "type": "mcq",
                "prompt": "Trong khoá luận, nên trình bày tham số BKT ước lượng được như thế nào?",
                "explanation": "Kèm khoảng tin cậy, ràng buộc đã áp và kiểm tra thoái hoá — vì tham số phụ thuộc vào bộ bài tập, ma trận Q và thuật toán ước lượng, không phải quy luật về người học.",
                "points": 2,
                "options": [
                    {"label": "Kèm khoảng tin cậy, ràng buộc đã áp và kết quả kiểm tra thoái hoá", "isCorrect": True},
                    {"label": "Như một phát hiện về năng lực học sinh của trường", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                    {"label": "Chỉ cần nêu giá trị vì mô hình đã được công bố quốc tế", "isCorrect": False},
                    {"label": "Chỉ cần nêu chỉ số dự đoán trên tập kiểm tra", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                ],
            },
            {
                "key": "3.2-tham-dinh-mastery",
                "type": "mcq",
                "prompt": "Một sản phẩm quảng cáo dạy tới mức thành thạo. Hai câu hỏi thẩm định đúng trọng tâm là gì?",
                "explanation": "Ngưỡng thành thạo là bao nhiêu, và ngưỡng ấy được kiểm bằng gì. Không trả lời được câu đầu thì hệ thống nhiều khả năng chỉ đếm số bài đã làm.",
                "points": 2,
                "options": [
                    {"label": "Ngưỡng là bao nhiêu, và ngưỡng ấy được kiểm bằng gì", "isCorrect": True},
                    {"label": "Có bao nhiêu bài tập, và giao diện có đẹp không", "isCorrect": False},
                    {"label": "Có bao nhiêu trường đang dùng, và giá bao nhiêu", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Dùng mô hình học sâu hay mô hình thống kê cổ điển", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                ],
            },
            {
                "key": "3.2-thu-tu-cap-nhat",
                "type": "ordering",
                "prompt": "Sắp xếp các bước xử lý một lượt trả lời trong BKT.",
                "explanation": "Xác định kỹ năng liên quan, đọc trạng thái hiện tại, suy ngược từ quan sát, cộng phần học được, rồi so ngưỡng để quyết định bài kế tiếp.",
                "points": 3,
                "sequence": [
                    "Xác định câu hỏi này đo thành phần tri thức nào theo ma trận Q",
                    "Đọc xác suất nắm hiện tại của người học với thành phần đó",
                    "Suy ngược từ kết quả đúng hoặc sai bằng quy tắc Bayes",
                    "Cộng thêm xác suất vừa học được trong lượt này",
                    "So với ngưỡng thành thạo để quyết định cho bài tiếp theo hay chuyển chủ đề",
                ],
            },
            {
                "key": "3.2-viet-luan-bkt",
                "type": "essay",
                "prompt": "Viết 250–350 từ giải thích BKT cho một giáo viên chưa học thống kê: mô hình đang giả định gì về việc học, bốn tham số nghĩa là gì trong lớp học của họ, và ba tình huống mà bạn khuyên họ đừng tin vào con số hệ thống đưa ra.",
                "points": 5,
            },
        ],
    },
}

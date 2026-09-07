# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.4 · Bảng điều khiển và cảnh báo sớm",
    "durationMin": 55,
    "description": "Thiết kế bảng điều khiển theo người đọc và quyết định, chọn khung tham chiếu, đọc cảnh báo sớm bằng tỉ lệ nền, và chuyển từ cảnh báo sang hành động mà không gắn nhãn người học.",
    "objectives": [
        "Thiết kế được bảng điều khiển bắt đầu từ quyết định của người đọc chứ không từ dữ liệu sẵn có",
        "Tính được tỉ lệ dự báo đúng của một hệ cảnh báo sớm từ tỉ lệ nền, độ nhạy và độ đặc hiệu",
        "Chọn được khung tham chiếu phù hợp và nêu được rủi ro của so sánh xã hội",
    ],
    "summary": [
        "Bảng điều khiển bắt đầu từ câu hỏi ai đọc và sẽ quyết định gì, không bắt đầu từ dữ liệu đang có.",
        "Khung tham chiếu quyết định cảm nhận: so với chính mình thúc đẩy tiến bộ, so với lớp có thể làm nhóm yếu bỏ cuộc.",
        "Với tỉ lệ nền thấp, một mô hình đúng 80% vẫn cho đa số cảnh báo là báo động giả — phải tính tỉ lệ đúng trong nhóm bị gắn cờ.",
        "Cảnh báo chỉ có giá trị khi kèm quy trình: ai nhận, làm gì trong bao lâu, và ghi nhận kết quả ra sao.",
    ],
    "body": r"""
## Bắt đầu từ quyết định, không từ dữ liệu

Quy trình sai mà rất phổ biến: nhìn xem hệ thống có dữ liệu gì rồi vẽ hết lên một màn hình. Kết quả là bảng đẹp, đầy đủ, và không ai dùng. Quy trình đúng đi ngược lại:

1. **Ai là người đọc?** Giáo viên bộ môn, giáo viên chủ nhiệm, tổ trưởng, hiệu trưởng và người học đọc bốn thứ khác nhau.
2. **Họ sẽ quyết định gì?** Viết ra ba quyết định cụ thể mà người ấy phải đưa ra hằng tuần.
3. **Quyết định ấy cần thông tin nào?** Chỉ những thông tin đó mới lên bảng.
4. **Họ có bao nhiêu thời gian?** Áp quy tắc ba mươi giây ở Bài 4.1.

| Người đọc | Quyết định điển hình | Thông tin cần | Thông tin KHÔNG nên đưa |
|---|---|---|---|
| Giáo viên bộ môn | Dạy lại phần nào trong 10 phút đầu giờ sau | Câu hỏi hoặc kỹ năng cả lớp cùng hổng | Xếp hạng từng em |
| Giáo viên chủ nhiệm | Gọi phụ huynh em nào tuần này | Danh sách ngắn kèm lý do cụ thể và mốc thời gian | Điểm dự đoán cuối kỳ dưới dạng con số cứng |
| Người học | Ôn gì tối nay | Kỹ năng chưa vững của chính mình, kèm việc cần làm | Thứ hạng trong lớp |
| Ban giám hiệu | Có tiếp tục dùng công cụ này không | Xu hướng theo tháng, so với nhóm không dùng, chi phí | Dữ liệu định danh từng học sinh |

> [!canh-bao] Cột cuối cùng quan trọng ngang cột thông tin cần. Đưa thừa thông tin không chỉ tốn chỗ: **xếp hạng cá nhân trên bảng của giáo viên bộ môn gần như chắc chắn sẽ được dùng để phân loại học sinh**, dù mục đích ban đầu không phải vậy.

## Khung tham chiếu: so với ai

Cùng một con số, đặt cạnh những thứ khác nhau thì tạo ra hành vi khác nhau:

| Khung tham chiếu | Cách trình bày | Tác dụng | Rủi ro |
|---|---|---|---|
| So với chính mình theo thời gian | Tuần này em đã đạt 3 kỹ năng, tuần trước 1 | Thúc đẩy tiến bộ, hợp với người học yếu | Không cho biết mình đang ở đâu so với yêu cầu |
| So với mục tiêu | Em đã đạt 6/10 kỹ năng cần cho bài kiểm tra tới | Rõ ràng, gắn với chương trình | Cần bản đồ kỹ năng đủ tốt |
| So với cả lớp | Em xếp thứ 28/40 | Tạo động lực cho nhóm đầu | **Nhóm cuối có thể bỏ cuộc**; đánh mạnh vào người vốn đã thiếu tự tin |

Nghiên cứu về bảng điều khiển cho người học chỉ ra rằng phần lớn sản phẩm mặc định chọn khung so sánh xã hội vì nó dễ hiển thị nhất, trong khi hiếm sản phẩm nào biện minh lựa chọn ấy bằng lý thuyết học tập. Khuyến nghị thực hành: **mặc định dùng so với chính mình và so với mục tiêu**; chỉ dùng so sánh xã hội khi có lý do rõ và cho phép tắt.

## Cảnh báo sớm: tính bằng số trước khi tin

Đây là chỗ trực giác đánh lừa mạnh nhất. Giả sử mô hình dự đoán rủi ro có **độ nhạy 80%** (bắt được 80% em thật sự gặp rủi ro) và **độ đặc hiệu 80%** (gắn cờ nhầm 20% số em không gặp rủi ro). Nghe rất khá. Nhưng kết quả phụ thuộc **tỉ lệ nền** — tỉ lệ em thật sự gặp rủi ro trong trường:

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cùng một mô hình, hai ngôi trường · tính trên 1000 học sinh</div>
  <div style="min-width:34rem;display:flex;gap:.6rem">
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(220,38,38,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Trường A · 10% thật sự gặp rủi ro</div>
      <div style="padding:.7rem;font-size:1.02rem;line-height:1.7">Bắt đúng: <strong>80</strong> em<br>Gắn cờ nhầm: <strong>180</strong> em<br>Bỏ sót: 20 em<br><span style="display:inline-block;margin-top:.4rem;padding:.25rem .5rem;background:rgba(220,38,38,.18);border-radius:.3rem">Trong 260 cảnh báo, chỉ <strong>31%</strong> là đúng</span></div>
    </div>
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(13,148,136,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Trường B · 30% thật sự gặp rủi ro</div>
      <div style="padding:.7rem;font-size:1.02rem;line-height:1.7">Bắt đúng: <strong>240</strong> em<br>Gắn cờ nhầm: <strong>140</strong> em<br>Bỏ sót: 60 em<br><span style="display:inline-block;margin-top:.4rem;padding:.25rem .5rem;background:rgba(13,148,136,.18);border-radius:.3rem">Trong 380 cảnh báo, <strong>63%</strong> là đúng</span></div>
    </div>
  </div>
  <div style="min-width:34rem;font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">Cùng một mô hình, cùng độ nhạy và độ đặc hiệu — nhưng ở trường A thì <strong>hai phần ba số cảnh báo là báo động giả</strong>. Nâng độ đặc hiệu lên 95% ở trường A sẽ kéo tỉ lệ đúng lên khoảng 64%, đổi lại là chấp nhận bỏ sót nhiều hơn nếu đồng thời hạ độ nhạy.</div>
</div>
```

> [!ghi-nho] Con số nhà cung cấp hay công bố là độ chính xác tổng thể; con số bạn cần là **tỉ lệ đúng trong nhóm bị gắn cờ**, vì đó là nhóm mà giáo viên sẽ bỏ công sức vào. Hỏi đúng câu này là cách nhanh nhất phân biệt người bán hiểu nghề với người bán chỉ đọc tài liệu tiếp thị.

Hai hệ quả vận hành. Thứ nhất, **ngưỡng cảnh báo là quyết định sư phạm chứ không phải quyết định kỹ thuật**: hạ ngưỡng thì bắt được nhiều hơn nhưng làm phiền nhiều em không cần; nâng ngưỡng thì ngược lại. Ai chịu hậu quả của mỗi loại sai sót là câu hỏi phải trả lời trước khi chọn ngưỡng. Thứ hai, khi tỉ lệ đúng thấp, **cảnh báo phải được trình bày như một lời mời tìm hiểu, không phải một kết luận**.

## Từ cảnh báo tới hành động — mà không gắn nhãn

Một hệ cảnh báo không có quy trình đi kèm sẽ tạo ra hai kết quả tệ: giáo viên phớt lờ vì quá nhiều báo động giả, hoặc giáo viên tin tuyệt đối và học sinh bị dán nhãn. Quy trình tối thiểu:

| Bước | Nội dung | Ràng buộc |
|---|---|---|
| Nhận | Ai nhận cảnh báo và trong bao lâu phải xem | Không gửi cho nhiều người cùng lúc — trách nhiệm chia đều là không ai chịu |
| Kiểm | Đối chiếu với hiểu biết thực tế về em học sinh ấy | Bắt buộc: cảnh báo chỉ là giả thuyết |
| Hành động | Một trong các phương án đã định trước, có thời hạn | Phải có phương án *không làm gì* kèm lý do |
| Ghi nhận | Kết quả của hành động, để hiệu chỉnh mô hình và quy trình | Đây là chặng khép vòng ở Bài 4.1 |

> [!meo] Ba nguyên tắc ngôn ngữ khi hiển thị cảnh báo, rút từ Bài 3.1 và 3.5: gắn với **hành vi quan sát được** chứ không với phẩm chất người học (*chưa nộp 3 bài gần nhất* thay vì *thiếu động lực*); kèm **mốc thời gian**; và kèm **hành động gợi ý cụ thể**. Ba thứ này biến cảnh báo từ nhãn thành thông tin.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Tính tỉ lệ đúng trong nhóm bị gắn cờ cho ba tình huống: (a) tỉ lệ nền 5%, độ nhạy 90%, độ đặc hiệu 90%; (b) tỉ lệ nền 20%, độ nhạy 70%, độ đặc hiệu 90%; (c) tỉ lệ nền 40%, độ nhạy 80%, độ đặc hiệu 70%. Ghi lại tình huống nào bạn thấy bất ngờ nhất.

### Nhóm 3–4 người (30 phút)

Nhóm thiết kế lại một bảng điều khiển có sẵn cho đúng một người đọc do giáo viên chỉ định. Yêu cầu: bỏ ít nhất một nửa số biểu đồ hiện có, nêu rõ ba quyết định mà người đọc sẽ đưa ra, và bảo vệ từng thứ còn giữ lại bằng một quyết định tương ứng.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **bảng điều khiển một trang cho một người đọc cụ thể**, kèm quy trình cảnh báo.

1. Chọn người đọc và viết ba quyết định họ phải đưa ra hằng tuần.
2. Thiết kế bảng một trang: tối đa bốn thành phần, mỗi thành phần phục vụ một quyết định đã nêu; áp quy tắc ba mươi giây.
3. Chọn khung tham chiếu và **biện minh lựa chọn**, nêu rõ vì sao không dùng khung còn lại.
4. Nếu có cảnh báo: tính tỉ lệ đúng trong nhóm gắn cờ với tỉ lệ nền thực tế của bối cảnh bạn, và chọn ngưỡng kèm lập luận ai chịu hậu quả của mỗi loại sai sót.
5. Viết quy trình bốn bước nhận – kiểm – hành động – ghi nhận, với thời hạn cụ thể cho từng bước.

**Cách làm (gợi ý từng bước):** dựng bảng bằng bất kỳ công cụ nào, kể cả bảng tính — chấm ở thiết kế thông tin chứ không ở công nghệ; ước lượng tỉ lệ nền bằng dữ liệu năm trước của chính cơ sở đó, nếu không có thì nêu rõ giả định; thử đưa bảng cho một giáo viên thật xem trong 30 giây rồi hỏi họ sẽ làm gì — câu trả lời của họ là kết quả kiểm thử.

**Chấm theo:** ba quyết định cụ thể và mọi thành phần đều phục vụ một quyết định (3đ) · khung tham chiếu được biện minh (2đ) · tính đúng tỉ lệ dự báo đúng và chọn ngưỡng có lập luận (3đ) · quy trình bốn bước có thời hạn và có phương án không làm gì (2đ).

### Nguồn tham khảo

- Verbert, K., Duval, E., Klerkx, J., Govaerts, S., & Santos, J. L. (2013). Learning analytics dashboard applications. *American Behavioral Scientist*, 57(10), 1500–1509.
- Jivet, I., Scheffel, M., Specht, M., & Drachsler, H. (2018). License to evaluate: Preparing learning analytics dashboards for educational practice. *LAK '18*, 31–40.
- Holstein, K., McLaren, B. M., & Aleven, V. (2018). Student learning benefits of a mixed-reality teacher awareness tool. *AIED 2018*, 154–168.
- Few, S. (2013). *Information Dashboard Design* (2nd ed.). Analytics Press.
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.4-bat-dau-tu-quyet-dinh",
                "type": "ordering",
                "prompt": "Sắp xếp quy trình thiết kế bảng điều khiển theo thứ tự đúng.",
                "explanation": "Bắt đầu từ người đọc và quyết định của họ; dữ liệu là bước cuối. Đi ngược lại sẽ cho ra bảng đầy đủ mà không ai dùng.",
                "points": 3,
                "sequence": [
                    "Xác định ai là người đọc",
                    "Viết ba quyết định cụ thể họ phải đưa ra hằng tuần",
                    "Xác định thông tin tối thiểu cần cho những quyết định ấy",
                    "Chọn cách trình bày sao cho đọc được trong ba mươi giây",
                ],
            },
            {
                "key": "4.4-thong-tin-khong-nen",
                "type": "mcq",
                "prompt": "Vì sao không nên đưa xếp hạng cá nhân lên bảng của giáo viên bộ môn?",
                "explanation": "Nó gần như chắc chắn sẽ được dùng để phân loại học sinh, dù mục đích ban đầu không phải vậy — và nó không phục vụ quyết định dạy lại phần nào.",
                "points": 2,
                "options": [
                    {"label": "Vì nó không phục vụ quyết định nào của họ và sẽ bị dùng để phân loại học sinh", "isCorrect": True},
                    {"label": "Vì tính xếp hạng tốn tài nguyên máy chủ", "isCorrect": False},
                    {"label": "Vì giáo viên không quan tâm tới xếp hạng", "isCorrect": False},
                    {"label": "Vì xếp hạng luôn thiếu chính xác về mặt kỹ thuật", "isCorrect": False},
                ],
            },
            {
                "key": "4.4-khung-tham-chieu",
                "type": "matching",
                "prompt": "Ghép mỗi khung tham chiếu với rủi ro chính của nó.",
                "explanation": "Khung tham chiếu quyết định hành vi sinh ra; so sánh xã hội dễ hiển thị nhất nhưng đánh mạnh vào nhóm vốn thiếu tự tin.",
                "points": 3,
                "pairs": [
                    {"left": "So với chính mình theo thời gian", "right": "Không cho biết mình đang ở đâu so với yêu cầu của môn học"},
                    {"left": "So với mục tiêu", "right": "Đòi phải có bản đồ kỹ năng đủ tốt mới dùng được"},
                    {"left": "So với cả lớp", "right": "Nhóm cuối bảng dễ bỏ cuộc"},
                ],
            },
            {
                "key": "4.4-mac-dinh-khung",
                "type": "mcq",
                "prompt": "Khuyến nghị thực hành về khung tham chiếu cho bảng của người học là gì?",
                "explanation": "Mặc định dùng so với chính mình và so với mục tiêu; chỉ dùng so sánh xã hội khi có lý do rõ và cho phép tắt.",
                "points": 2,
                "options": [
                    {"label": "Mặc định so với chính mình và so với mục tiêu, so sánh xã hội chỉ khi có lý do và cho tắt được", "isCorrect": True},
                    {"label": "Luôn hiển thị thứ hạng vì đó là thông tin khách quan nhất", "isCorrect": False},
                    {"label": "Không hiển thị bất kỳ so sánh nào", "isCorrect": False},
                    {"label": "Để hệ thống tự chọn khung theo điểm số của người học", "isCorrect": False},
                ],
            },
            {
                "key": "4.4-ty-le-nen",
                "type": "fill_in",
                "prompt": "Mô hình có độ nhạy 80% và độ đặc hiệu 80%. Trường có 1000 học sinh, trong đó 10% thật sự gặp rủi ro. Có bao nhiêu em bị gắn cờ NHẦM? (Ghi số nguyên)",
                "explanation": "900 em không gặp rủi ro × 20% gắn cờ nhầm = 180 em. Cùng với 80 em bắt đúng, tổng 260 cảnh báo — chỉ 31% là đúng.",
                "points": 3,
                "answers": ["180"],
            },
            {
                "key": "4.4-con-so-can-hoi",
                "type": "mcq",
                "prompt": "Nhà cung cấp công bố mô hình cảnh báo sớm đạt độ chính xác 80%. Con số bạn cần hỏi thêm là gì?",
                "explanation": "Tỉ lệ đúng trong nhóm bị gắn cờ, vì đó là nhóm giáo viên sẽ bỏ công sức vào — và nó phụ thuộc tỉ lệ nền của chính trường bạn.",
                "points": 2,
                "options": [
                    {"label": "Trong số em bị gắn cờ, bao nhiêu phần trăm thật sự gặp rủi ro, với tỉ lệ nền của trường tôi", "isCorrect": True},
                    {"label": "Mô hình dùng thuật toán gì", "isCorrect": False},
                    {"label": "Mô hình được huấn luyện trên bao nhiêu bản ghi", "isCorrect": False},
                    {"label": "Không cần hỏi thêm, 80% là đủ tốt", "isCorrect": False, "misconception": "cngdtt.alert-precision"},
                ],
            },
            {
                "key": "4.4-nguong-canh-bao",
                "type": "mcq",
                "prompt": "Vì sao nói ngưỡng cảnh báo là quyết định sư phạm chứ không phải quyết định kỹ thuật?",
                "explanation": "Hạ ngưỡng thì bắt được nhiều hơn nhưng làm phiền nhiều em không cần; nâng ngưỡng thì bỏ sót nhiều hơn. Ai chịu hậu quả của mỗi loại sai sót là câu hỏi sư phạm và đạo đức.",
                "points": 2,
                "options": [
                    {"label": "Vì nó quyết định ai chịu hậu quả: bị làm phiền oan, hay bị bỏ sót", "isCorrect": True},
                    {"label": "Vì đặt ngưỡng cần kiến thức thống kê nâng cao", "isCorrect": False},
                    {"label": "Vì ngưỡng ảnh hưởng tới tốc độ tính toán", "isCorrect": False},
                    {"label": "Không phải: ngưỡng nên do mô hình tự chọn để tối ưu độ chính xác", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                ],
            },
            {
                "key": "4.4-trinh-bay-canh-bao",
                "type": "mcq",
                "prompt": "Khi tỉ lệ đúng trong nhóm gắn cờ thấp, cảnh báo nên được trình bày thế nào?",
                "explanation": "Như một lời mời tìm hiểu, không phải một kết luận — vì phần lớn cảnh báo có thể là báo động giả.",
                "points": 2,
                "options": [
                    {"label": "Như một lời mời tìm hiểu thêm, không phải một kết luận về học sinh", "isCorrect": True},
                    {"label": "Như một danh sách cần xử lý kỷ luật", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                    {"label": "Như một con số dự đoán điểm cuối kỳ", "isCorrect": False},
                    {"label": "Không nên hiển thị gì cho tới khi mô hình chính xác hơn", "isCorrect": False},
                ],
            },
            {
                "key": "4.4-quy-trinh-canh-bao",
                "type": "mcq",
                "prompt": "Vì sao không nên gửi cùng một cảnh báo cho nhiều người cùng lúc?",
                "explanation": "Trách nhiệm chia đều là không ai chịu trách nhiệm. Quy trình phải chỉ rõ ai nhận và trong bao lâu phải xem.",
                "points": 2,
                "options": [
                    {"label": "Vì trách nhiệm chia đều thì không ai thực sự xử lý", "isCorrect": True},
                    {"label": "Vì tốn chi phí gửi thông báo", "isCorrect": False},
                    {"label": "Vì vi phạm quyền riêng tư của học sinh", "isCorrect": False},
                    {"label": "Vì hệ thống không hỗ trợ gửi nhiều người", "isCorrect": False},
                ],
            },
            {
                "key": "4.4-phuong-an-khong-lam-gi",
                "type": "mcq",
                "prompt": "Vì sao quy trình xử lý cảnh báo phải có phương án *không làm gì* kèm lý do?",
                "explanation": "Vì nhiều cảnh báo là báo động giả, và ép phải hành động với mọi cảnh báo sẽ tạo ra can thiệp thừa, làm phiền học sinh và bào mòn niềm tin của giáo viên vào hệ thống.",
                "points": 2,
                "options": [
                    {"label": "Vì nhiều cảnh báo là báo động giả; ép hành động với mọi cảnh báo sinh ra can thiệp thừa", "isCorrect": True},
                    {"label": "Vì giáo viên thường quá bận", "isCorrect": False},
                    {"label": "Vì cần giảm số lượt ghi nhận trong hệ thống", "isCorrect": False},
                    {"label": "Không cần: mọi cảnh báo đều phải được xử lý", "isCorrect": False, "misconception": "cngdtt.alert-precision"},
                ],
            },
            {
                "key": "4.4-ngon-ngu-canh-bao",
                "type": "mcq",
                "prompt": "Cách viết cảnh báo nào đúng ba nguyên tắc ngôn ngữ đã nêu?",
                "explanation": "Gắn với hành vi quan sát được, kèm mốc thời gian, kèm hành động gợi ý cụ thể — ba thứ biến cảnh báo từ nhãn thành thông tin.",
                "points": 2,
                "options": [
                    {"label": "Chưa nộp 3 bài gần nhất, lần hoạt động cuối là 12/9 — gợi ý: hỏi em về chỗ tắc ở bước nộp tệp", "isCorrect": True},
                    {"label": "Em này thiếu động lực học tập", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                    {"label": "Nguy cơ trượt: 78%", "isCorrect": False},
                    {"label": "Học sinh thuộc nhóm cần theo dõi đặc biệt", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                ],
            },
            {
                "key": "4.4-nang-dac-hieu",
                "type": "mcq",
                "prompt": "Ở trường có tỉ lệ nền 10%, nâng độ đặc hiệu từ 80% lên 95% có tác dụng gì?",
                "explanation": "Số em bị gắn cờ nhầm giảm mạnh (từ 180 xuống 45), kéo tỉ lệ đúng trong nhóm gắn cờ lên khoảng 64% — đổi lại thường phải chấp nhận bỏ sót nhiều hơn.",
                "points": 2,
                "options": [
                    {"label": "Giảm mạnh số gắn cờ nhầm và nâng tỉ lệ đúng lên khoảng 64%, thường đổi lại bằng bỏ sót nhiều hơn", "isCorrect": True},
                    {"label": "Không thay đổi gì vì tỉ lệ nền không đổi", "isCorrect": False},
                    {"label": "Làm tăng số em được bắt đúng", "isCorrect": False},
                    {"label": "Làm mô hình chính xác tuyệt đối", "isCorrect": False},
                ],
            },
            {
                "key": "4.4-viet-luan-dashboard",
                "type": "essay",
                "prompt": "Chọn một người đọc cụ thể (giáo viên chủ nhiệm, tổ trưởng, hoặc học sinh). Viết 250–350 từ mô tả bảng điều khiển một trang cho họ: ba quyết định, bốn thành phần và quyết định tương ứng, khung tham chiếu và lý do chọn, cùng cách bạn trình bày cảnh báo để nó không thành nhãn.",
                "points": 5,
            },
        ],
    },
}

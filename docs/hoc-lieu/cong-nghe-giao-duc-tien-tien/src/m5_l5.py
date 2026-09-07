# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.5 · Từ thí điểm tới vận hành: triển khai và quản trị thay đổi",
    "durationMin": 50,
    "description": "Khoảng cách giữa một lớp thí điểm thành công và việc hệ thống còn chạy sau hai năm: sáu điều kiện vận hành, tổng chi phí sở hữu, chiến lược lan rộng, và kế hoạch dừng.",
    "objectives": [
        "Chỉ ra được sáu điều kiện vận hành mà thí điểm thường được miễn còn triển khai thật thì không",
        "Ước lượng được tổng chi phí sở hữu trong ba năm cho một giải pháp công nghệ giáo dục",
        "Lập được kế hoạch lan rộng theo giai đoạn kèm tiêu chí dừng",
    ],
    "summary": [
        "Thí điểm chạy được nhờ sự chú ý đặc biệt của người khởi xướng; triển khai thật phải chạy được khi người ấy đi vắng.",
        "Sáu điều kiện vận hành: hỗ trợ khi hỏng, tập huấn người mới, vòng đời thiết bị, cập nhật nội dung, chủ sở hữu dữ liệu, và ngân sách thường xuyên.",
        "Tổng chi phí sở hữu ba năm gồm phần lớn là giờ công người, không phải tiền mua phần mềm.",
        "Kế hoạch triển khai phải có tiêu chí dừng viết trước, nếu không dự án sẽ tự kéo dài bằng quán tính.",
    ],
    "body": r"""
## Vì sao thí điểm thành công vẫn hỏng khi nhân rộng

Thí điểm gần như luôn có ba lợi thế mà triển khai thật không có: người khởi xướng đứng lớp hoặc kèm sát; lớp được chọn là lớp thuận lợi; và mọi sự cố đều được xử lý ngay vì người làm sản phẩm có mặt. Suy từ đó sang toàn trường là sai lầm phổ biến nhất trong các dự án công nghệ giáo dục.

Sáu điều kiện vận hành mà thí điểm được miễn còn triển khai thật thì không:

| Điều kiện | Câu hỏi phải trả lời | Dấu hiệu chưa sẵn sàng |
|---|---|---|
| Hỗ trợ khi hỏng | Thiết bị hoặc phần mềm hỏng giữa tiết thì ai xử lý, trong bao lâu | Câu trả lời là *gọi cho em* |
| Tập huấn người mới | Giáo viên mới về trường năm sau học dùng ở đâu | Không có tài liệu, chỉ có buổi tập huấn đã qua |
| Vòng đời thiết bị | Máy hỏng sau hai năm thay bằng nguồn nào | Không có dòng nào trong dự toán |
| Cập nhật nội dung | Chương trình đổi thì ai sửa học liệu, mất bao lâu | Chỉ người làm gốc sửa được |
| Chủ sở hữu dữ liệu | Ai chịu trách nhiệm về dữ liệu người học khi dự án kết thúc | Chưa ai được giao |
| Ngân sách thường xuyên | Phí thuê bao, in ấn, điện, mạng lấy từ khoản nào | Chỉ có kinh phí một lần từ đề tài |

> [!ghi-nho] Bài kiểm tra một câu cho mọi dự án chuẩn bị nhân rộng: **nếu người khởi xướng chuyển công tác vào tháng sau, sáu tháng nữa hệ thống còn chạy không?** Trả lời được câu này bằng bằng chứng cụ thể là điều kiện để nói tới triển khai.

## Tổng chi phí sở hữu ba năm

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cơ cấu chi phí điển hình của một giải pháp cấp trường</div>
  <div style="display:flex;height:2.6rem;border-radius:.4rem;overflow:hidden;font-size:1rem;color:#fff;text-align:center">
    <div style="flex:18;background:rgba(37,99,235,.85);display:flex;align-items:center;justify-content:center">Phần mềm, thiết bị</div>
    <div style="flex:32;background:rgba(13,148,136,.85);display:flex;align-items:center;justify-content:center">Giờ công giáo viên</div>
    <div style="flex:22;background:rgba(124,58,237,.85);display:flex;align-items:center;justify-content:center">Tập huấn, hỗ trợ</div>
    <div style="flex:16;background:rgba(217,150,40,.9);display:flex;align-items:center;justify-content:center">Cập nhật nội dung</div>
    <div style="flex:12;background:rgba(220,38,38,.85);display:flex;align-items:center;justify-content:center">Quản trị</div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Tỉ lệ chỉ để hình dung, nhưng quy luật thì ổn định: <strong>phần tiền mua chiếm thiểu số</strong>. Một giải pháp miễn phí đòi mỗi giáo viên hai giờ mỗi tuần đắt hơn nhiều so với một phần mềm trả phí tiết kiệm được thời gian ấy.</div>
</div>
```

Cách ước lượng dùng được trong hồ sơ trình ban giám hiệu: quy mọi hạng mục về **giờ công và tiền mặt theo năm**, rồi nhân ba năm. Với giờ công, dùng số giờ thật đo được từ thí điểm chứ không dùng con số mong muốn. Ba dòng hay bị bỏ sót: thời gian nhập liệu đầu năm học, thời gian xử lý sự cố, và thời gian tập huấn người mới.

## Lan rộng theo giai đoạn, không lan rộng một lần

| Giai đoạn | Phạm vi | Mục tiêu chính | Tiêu chí để đi tiếp |
|---|---|---|---|
| 1 · Thử nghiệm | 1 lớp, người khởi xướng đứng lớp | Sản phẩm chạy được, tìm lỗi | Người học lạ tự dùng được; đã sửa các lỗi chặn |
| 2 · Nhân đôi | 2–3 lớp, **giáo viên khác** đứng lớp | Kiểm xem có phụ thuộc người khởi xướng không | Giáo viên khác dạy được với tài liệu hiện có, không cần hỏi thêm |
| 3 · Một khối | Toàn khối, có tổ trưởng điều phối | Kiểm quy trình vận hành và hỗ trợ | Sự cố được xử lý mà không cần người làm sản phẩm |
| 4 · Toàn trường | Có ngân sách thường xuyên và người phụ trách | Vận hành ổn định | Đủ sáu điều kiện vận hành ở mục 1 |

Giai đoạn 2 là giai đoạn quan trọng nhất và hay bị nhảy cóc nhất. Nó trả lời câu hỏi mà giai đoạn 1 không trả lời được: **sản phẩm hay là người làm ra sản phẩm mới là thứ tạo ra kết quả?** Nếu giáo viên khác không dạy được với tài liệu hiện có, vấn đề nằm ở tài liệu hướng dẫn chứ không ở giáo viên.

Ở đây, hai khung đã học ở Bài 1.1 và 1.3 áp trực tiếp: **rào cản bậc hai** của Ertmer giải thích vì sao tập huấn kỹ năng không đủ, và **khả năng dùng thử cùng khả năng quan sát kết quả** của Rogers là hai đòn bẩy bạn kiểm soát được — cho giáo viên thử một lớp trong hai tuần và rút được, rồi làm kết quả của người thử đầu tiên nhìn thấy được với cả tổ.

> [!canh-bao] Sai lầm hay gặp khi lan rộng: coi giáo viên chưa dùng là do thiếu kỹ năng và giải quyết bằng một buổi tập huấn. Nếu sau tập huấn họ vẫn không dùng, nguyên nhân thường là **thời gian không đủ**, **không tin nó cải thiện kết quả**, hoặc **sợ sự cố giữa giờ trước mặt học sinh** — ba thứ mà tập huấn kỹ năng không chạm tới.

## Kế hoạch dừng và bàn giao

Mọi kế hoạch triển khai nghiêm túc đều có phần này, và đây cũng là phần khiến ban giám hiệu tin tưởng hơn chứ không phải ngược lại.

**Tiêu chí dừng viết trước.** Nêu rõ: sau bao lâu, nếu chỉ số nào không đạt mức nào thì dừng. Không có tiêu chí dừng thì dự án tự kéo dài bằng quán tính, và chi phí chìm càng lớn thì càng khó dừng.

**Kế hoạch rút lui.** Nếu dừng, dữ liệu người học đi đâu, học liệu đã soạn còn dùng được không, và học sinh đang giữa chừng thì học tiếp thế nào. Đây chính là tiêu chí *khả năng rời bỏ* trong phiếu thẩm định Bài 1.3, áp cho chính dự án của bạn.

**Hồ sơ bàn giao.** Tối thiểu bốn tài liệu: hướng dẫn sử dụng cho giáo viên (tối đa hai trang), hướng dẫn xử lý sự cố thường gặp, tài liệu kỹ thuật để người khác sửa được, và hồ sơ dữ liệu theo Bài 4.5.

> [!meo] Trong đồ án, phần kế hoạch dừng thường chỉ dài nửa trang nhưng tạo ấn tượng rất mạnh ở buổi bảo vệ: nó cho thấy bạn nghĩ tới vòng đời của sản phẩm chứ không chỉ tới ngày nộp bài.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Trả lời bài kiểm tra một câu ở mục 1 cho chính đồ án của bạn, bằng bằng chứng cụ thể chứ không bằng phán đoán. Với mỗi trong sáu điều kiện vận hành, ghi trạng thái hiện tại: đã có, đang thiếu, hoặc chưa nghĩ tới.

### Nhóm 3–4 người (30 phút)

Nhóm đóng vai tổ chuyên môn nhận bàn giao một sản phẩm từ sinh viên đã tốt nghiệp. Đọc hồ sơ bàn giao của một bạn trong nhóm và tìm mọi chỗ khiến các bạn không tự vận hành được. Báo cáo dưới dạng danh sách câu hỏi bạn phải hỏi lại tác giả — mỗi câu hỏi là một lỗ hổng trong hồ sơ.

### Bài tập về nhà — sản phẩm số (100 phút)

Soạn **hồ sơ triển khai và bàn giao** cho đồ án, dùng được để nộp cho một trường có thật.

1. Bảng sáu điều kiện vận hành, mỗi dòng ghi trạng thái và việc cần làm để đạt.
2. Bảng tổng chi phí sở hữu ba năm, tách giờ công và tiền mặt, dùng số liệu đo từ thí điểm.
3. Kế hoạch lan rộng bốn giai đoạn kèm tiêu chí đi tiếp cho từng giai đoạn.
4. Tiêu chí dừng và kế hoạch rút lui.
5. Hướng dẫn sử dụng cho giáo viên, tối đa hai trang, có mục xử lý sự cố thường gặp.

**Cách làm (gợi ý từng bước):** đo giờ công bằng cách bấm giờ chính mình khi làm từng việc trong thí điểm, rồi nhân theo số lớp — ước lượng cảm tính luôn thấp hơn thực tế; hướng dẫn cho giáo viên viết theo tình huống (*khi máy học sinh không quét được, làm ba việc sau*), không viết theo chức năng; tiêu chí dừng phải có con số và mốc thời gian.

**Chấm theo:** sáu điều kiện vận hành có trạng thái thật và việc cần làm (3đ) · chi phí ba năm tách giờ công, dùng số đo (3đ) · kế hoạch bốn giai đoạn có tiêu chí đi tiếp (2đ) · tiêu chí dừng có con số và kế hoạch rút lui (1đ) · hướng dẫn giáo viên viết theo tình huống, đọc được giữa giờ (1đ).

### Nguồn tham khảo

- Ertmer, P. A. (1999). Addressing first- and second-order barriers to change. *Educational Technology Research and Development*, 47(4), 47–61.
- Rogers, E. M. (2003). *Diffusion of Innovations* (5th ed.). Free Press.
- Cuban, L. (2001). *Oversold and Underused: Computers in the Classroom.* Harvard University Press.
- Fullan, M. (2016). *The New Meaning of Educational Change* (5th ed.). Teachers College Press.
""",
    "quiz": {
        "title": "Kiểm tra Bài 5.5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "5.5-ba-loi-the",
                "type": "mcq",
                "prompt": "Ba lợi thế mà thí điểm có còn triển khai thật không có là gì?",
                "explanation": "Người khởi xướng kèm sát, lớp được chọn là lớp thuận lợi, và mọi sự cố được xử lý ngay vì người làm sản phẩm có mặt.",
                "points": 2,
                "options": [
                    {"label": "Người khởi xướng kèm sát, lớp thuận lợi, sự cố được xử lý ngay tại chỗ", "isCorrect": True},
                    {"label": "Ngân sách lớn hơn, thiết bị mới hơn, học sinh giỏi hơn", "isCorrect": False},
                    {"label": "Thời gian dài hơn và ít áp lực thi cử hơn", "isCorrect": False},
                    {"label": "Không có lợi thế nào đặc biệt", "isCorrect": False, "misconception": "cngdtt.pilot-equals-deployment"},
                ],
            },
            {
                "key": "5.5-bai-kiem-mot-cau",
                "type": "mcq",
                "prompt": "Bài kiểm tra một câu cho mọi dự án chuẩn bị nhân rộng là gì?",
                "explanation": "Nếu người khởi xướng chuyển công tác vào tháng sau, sáu tháng nữa hệ thống còn chạy không — và phải trả lời bằng bằng chứng cụ thể.",
                "points": 2,
                "options": [
                    {"label": "Người khởi xướng đi vắng thì sáu tháng nữa hệ thống còn chạy không", "isCorrect": True},
                    {"label": "Sản phẩm có chạy trên thiết bị mới nhất không", "isCorrect": False},
                    {"label": "Học sinh có thích sản phẩm không", "isCorrect": False},
                    {"label": "Trường có đủ tiền mua bản quyền không", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-goi-cho-em",
                "type": "mcq",
                "prompt": "Khi được hỏi ai xử lý khi hệ thống hỏng giữa tiết, câu trả lời *gọi cho em* cho thấy điều gì?",
                "explanation": "Điều kiện hỗ trợ khi hỏng chưa sẵn sàng: hệ thống đang phụ thuộc vào một cá nhân, nên nó sẽ dừng khi người ấy bận hoặc chuyển công tác.",
                "points": 2,
                "options": [
                    {"label": "Điều kiện hỗ trợ chưa sẵn sàng, hệ thống đang phụ thuộc vào một cá nhân", "isCorrect": True},
                    {"label": "Đó là câu trả lời tốt vì thể hiện tinh thần trách nhiệm", "isCorrect": False, "misconception": "cngdtt.pilot-equals-deployment"},
                    {"label": "Không quan trọng nếu sản phẩm ít hỏng", "isCorrect": False},
                    {"label": "Chỉ cần ghi số điện thoại vào tài liệu là đủ", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-co-cau-chi-phi",
                "type": "mcq",
                "prompt": "Trong tổng chi phí sở hữu ba năm của một giải pháp cấp trường, hạng mục nào thường lớn nhất?",
                "explanation": "Giờ công của giáo viên. Phần tiền mua phần mềm và thiết bị thường chiếm thiểu số — nên phần mềm miễn phí đòi nhiều giờ công có thể đắt hơn phần mềm trả phí.",
                "points": 2,
                "options": [
                    {"label": "Giờ công của giáo viên", "isCorrect": True},
                    {"label": "Tiền mua phần mềm", "isCorrect": False},
                    {"label": "Tiền mua thiết bị", "isCorrect": False},
                    {"label": "Chi phí điện và mạng", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-ba-dong-bo-sot",
                "type": "mcq",
                "prompt": "Ba dòng chi phí hay bị bỏ sót khi ước lượng là gì?",
                "explanation": "Thời gian nhập liệu đầu năm học, thời gian xử lý sự cố, và thời gian tập huấn người mới — tất cả đều là giờ công lặp lại hằng năm.",
                "points": 2,
                "options": [
                    {"label": "Nhập liệu đầu năm, xử lý sự cố, và tập huấn người mới", "isCorrect": True},
                    {"label": "Tiền điện, tiền mạng, và tiền in ấn", "isCorrect": False},
                    {"label": "Phí bản quyền, phí nâng cấp, và phí hỗ trợ", "isCorrect": False},
                    {"label": "Không có dòng nào hay bị bỏ sót", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-giai-doan-2",
                "type": "mcq",
                "prompt": "Vì sao giai đoạn nhân đôi với giáo viên khác đứng lớp là giai đoạn quan trọng nhất?",
                "explanation": "Nó trả lời câu hỏi mà giai đoạn thử nghiệm không trả lời được: sản phẩm hay người làm ra sản phẩm mới là thứ tạo ra kết quả.",
                "points": 2,
                "options": [
                    {"label": "Nó tách được đóng góp của sản phẩm khỏi đóng góp của người khởi xướng", "isCorrect": True},
                    {"label": "Nó cho cỡ mẫu lớn hơn để phân tích thống kê", "isCorrect": False},
                    {"label": "Nó giúp tiết kiệm chi phí thiết bị", "isCorrect": False},
                    {"label": "Nó là yêu cầu bắt buộc của quy trình mua sắm", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-giao-vien-khac-khong-day-duoc",
                "type": "mcq",
                "prompt": "Giáo viên khác không dạy được với tài liệu hiện có. Kết luận đúng là gì?",
                "explanation": "Vấn đề nằm ở tài liệu hướng dẫn, không ở giáo viên. Đây là phát hiện có giá trị, và nó chỉ lộ ra nếu bạn thực sự làm giai đoạn nhân đôi.",
                "points": 2,
                "options": [
                    {"label": "Tài liệu hướng dẫn chưa đủ; cần sửa tài liệu chứ không phải chọn giáo viên khác", "isCorrect": True},
                    {"label": "Giáo viên đó thiếu năng lực công nghệ", "isCorrect": False, "misconception": "cngdtt.training-solves-adoption"},
                    {"label": "Cần tổ chức thêm một buổi tập huấn nữa", "isCorrect": False, "misconception": "cngdtt.training-solves-adoption"},
                    {"label": "Nên quay lại giai đoạn thử nghiệm với chính mình đứng lớp", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-vi-sao-khong-dung",
                "type": "mcq",
                "prompt": "Sau tập huấn, giáo viên vẫn không dùng công nghệ. Ba nguyên nhân thường gặp nhất là gì?",
                "explanation": "Thời gian không đủ, không tin nó cải thiện kết quả, và sợ sự cố giữa giờ trước mặt học sinh — ba thứ mà tập huấn kỹ năng không chạm tới.",
                "points": 2,
                "options": [
                    {"label": "Không đủ thời gian, không tin nó có tác dụng, và sợ sự cố giữa giờ", "isCorrect": True},
                    {"label": "Không nhớ thao tác, quên mật khẩu, và máy chậm", "isCorrect": False, "misconception": "cngdtt.training-solves-adoption"},
                    {"label": "Không thích công nghệ nói chung", "isCorrect": False},
                    {"label": "Chưa được trả thêm phụ cấp", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-tieu-chi-dung",
                "type": "mcq",
                "prompt": "Vì sao kế hoạch triển khai cần tiêu chí dừng viết trước?",
                "explanation": "Không có tiêu chí dừng thì dự án tự kéo dài bằng quán tính, và chi phí chìm càng lớn thì càng khó dừng.",
                "points": 2,
                "options": [
                    {"label": "Vì không có nó thì dự án kéo dài bằng quán tính, và chi phí chìm càng lớn càng khó dừng", "isCorrect": True},
                    {"label": "Vì quy chế tài chính yêu cầu", "isCorrect": False},
                    {"label": "Vì cần dự phòng khi thiết bị hỏng", "isCorrect": False},
                    {"label": "Không cần: nêu tiêu chí dừng làm giảm niềm tin của ban giám hiệu", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-ke-hoach-rut-lui",
                "type": "mcq",
                "prompt": "Kế hoạch rút lui phải trả lời những câu nào?",
                "explanation": "Dữ liệu người học đi đâu, học liệu đã soạn còn dùng được không, và học sinh đang giữa chừng thì học tiếp thế nào — chính là tiêu chí khả năng rời bỏ ở Bài 1.3 áp cho dự án của mình.",
                "points": 2,
                "options": [
                    {"label": "Dữ liệu đi đâu, học liệu còn dùng được không, học sinh giữa chừng học tiếp thế nào", "isCorrect": True},
                    {"label": "Ai chịu trách nhiệm bồi thường thiệt hại", "isCorrect": False},
                    {"label": "Bao giờ thì mua lại thiết bị mới", "isCorrect": False},
                    {"label": "Làm sao thông báo cho báo chí", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-ho-so-ban-giao",
                "type": "matching",
                "prompt": "Ghép mỗi tài liệu bàn giao với nội dung của nó.",
                "explanation": "Bốn tài liệu tối thiểu; thiếu bất kỳ cái nào thì người tiếp nhận phải quay lại hỏi tác giả, và đó là dấu hiệu bàn giao chưa xong.",
                "points": 3,
                "pairs": [
                    {"left": "Hướng dẫn cho giáo viên", "right": "Tối đa hai trang, viết theo tình huống gặp trong giờ dạy"},
                    {"left": "Hướng dẫn xử lý sự cố", "right": "Các lỗi thường gặp và ba việc cần làm cho mỗi lỗi"},
                    {"left": "Tài liệu kỹ thuật", "right": "Đủ để người khác sửa và dựng lại sản phẩm"},
                    {"left": "Hồ sơ dữ liệu", "right": "Thu gì, căn cứ nào, ai xem, lưu bao lâu"},
                ],
            },
            {
                "key": "5.5-huong-dan-tinh-huong",
                "type": "true_false",
                "prompt": "Hướng dẫn cho giáo viên nên viết theo tình huống gặp trong giờ dạy, không viết theo danh sách chức năng của phần mềm.",
                "explanation": "Đúng — giáo viên đọc tài liệu lúc đang có sự cố giữa giờ, nên họ cần tìm theo tình huống mình đang gặp chứ không theo tên chức năng.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "5.5-viet-luan-trien-khai",
                "type": "essay",
                "prompt": "Viết 250–350 từ kế hoạch triển khai cho đồ án của bạn tại một trường cụ thể: trạng thái hiện tại của sáu điều kiện vận hành, hai dòng chi phí lớn nhất trong ba năm, tiêu chí để đi từ giai đoạn 1 sang giai đoạn 2, và tiêu chí dừng có con số.",
                "points": 5,
            },
        ],
    },
}

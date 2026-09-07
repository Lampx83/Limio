# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.6 · Xưởng mốc 4: kế hoạch đo lường cho sách AR",
    "durationMin": 60,
    "description": "Hướng dẫn thực hiện mốc 4: từ câu hỏi đánh giá tới thiết kế khả thi trong lớp, chọn chỉ số, tính trước cỡ mẫu, và hồ sơ dữ liệu đi kèm.",
    "objectives": [
        "Phát biểu được câu hỏi đánh giá dưới dạng kiểm được, không phải dưới dạng mong muốn",
        "Chọn được thiết kế đo phù hợp với ràng buộc thật của một lớp học",
        "Nêu trước được giới hạn của kết luận mà thiết kế của mình cho phép rút ra",
    ],
    "summary": [
        "Mốc 4 nộp kế hoạch đo lường, không nộp kết quả: câu hỏi, chỉ số, thiết kế, cách phân tích, và ngưỡng quyết định — tất cả viết trước khi thu dữ liệu.",
        "Ba thiết kế khả thi trong lớp: đo trước và sau một nhóm, so hai nhóm song song, và thiết kế luân phiên; mỗi cái cho phép kết luận khác nhau.",
        "Với cỡ mẫu một lớp, gần như chắc chắn không phát hiện được hiệu quả nhỏ — nên phải nói trước điều đó thay vì kết luận quá tay.",
        "Kế hoạch đo phải đi kèm hồ sơ dữ liệu: thu gì, căn cứ nào, ai xem, lưu bao lâu.",
    ],
    "body": r"""
## Mốc 4 nộp gì

| Sản phẩm | Nội dung |
|---|---|
| Câu hỏi đánh giá | Một câu hỏi chính, phát biểu dưới dạng kiểm được, kèm hai câu hỏi phụ |
| Bộ chỉ số | Hai chỉ số dẫn, một chỉ số trễ, một chỉ số đối trọng — theo Bài 4.3 |
| Thiết kế đo | Chọn một trong ba thiết kế ở mục 3, kèm lịch thu dữ liệu |
| Kế hoạch phân tích | Viết trước: sẽ tính gì, so thế nào, và ngưỡng nào thì kết luận nên nhân rộng |
| Hồ sơ dữ liệu | Bảng đăng ký rút gọn theo Bài 4.5 |
| Tuyên bố giới hạn | Kết luận nào thiết kế này **không** cho phép rút ra |

> [!ghi-nho] Toàn bộ mốc này viết **trước khi thu một dòng dữ liệu nào**. Đó là phiên bản sinh viên của tiền đăng ký nghiên cứu, và nó chặn đúng cái bẫy mà Bài 1.4 đã mô tả: chạy nhiều phép so sánh rồi báo cáo cái đẹp nhất.

## Từ mong muốn tới câu hỏi kiểm được

| Phát biểu chưa dùng được | Vấn đề | Phát biểu kiểm được |
|---|---|---|
| Sách AR giúp học sinh hứng thú hơn | Hứng thú không định nghĩa, không có mốc so | Tỉ lệ học sinh tự nguyện quét trang AR ngoài giờ bắt buộc trong hai tuần đầu là bao nhiêu |
| Sách AR cải thiện việc học | Không nói học gì, so với gì, đo bằng gì | Học sinh học bằng sách AR có mô tả đúng trình tự chuyển động của van tim ở bài kiểm tra sau hai tuần cao hơn nhóm học bằng hình tĩnh không |
| Học sinh thích sách AR | Đo cảm nhận tức thì, dễ bị hiệu ứng mới lạ | Sau bốn tuần, tỉ lệ học sinh còn dùng AR khi không bị yêu cầu là bao nhiêu |

Cột thứ ba có ba đặc điểm chung: **có đối tượng cụ thể**, **có mốc thời gian**, và **có cách đo đã định trước**. Ba đặc điểm ấy là điều kiện tối thiểu để câu hỏi thành kiểm được.

## Ba thiết kế khả thi trong lớp học

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:34rem;display:flex;gap:.5rem;align-items:stretch">
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(217,150,40,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">A · Trước và sau, một nhóm</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Đo trước → dạy bằng sách AR → đo sau<br><strong>Cho phép nói:</strong> có tiến bộ hay không<br><strong>Không cho phép nói:</strong> tiến bộ đó do sách AR — lớp vẫn học bình thường, vẫn lớn lên</div>
    </div>
    <div style="flex:1;border:2px solid rgba(13,148,136,.55);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(13,148,136,.9);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">B · Hai nhóm song song</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Hai lớp cùng khối, một lớp dùng AR, một lớp dùng hình tĩnh <strong>có cùng thời lượng</strong><br><strong>Cho phép nói:</strong> khác biệt giữa hai cách dạy<br><strong>Cảnh giác:</strong> hai lớp vốn khác nhau, và giáo viên khác nhau</div>
    </div>
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(124,58,237,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">C · Luân phiên</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Chủ đề 1: lớp X dùng AR, lớp Y không; chủ đề 2: đổi vai<br><strong>Cho phép nói:</strong> khác biệt, đã cân bằng phần nào khác biệt giữa hai lớp<br><strong>Đòi hỏi:</strong> hai chủ đề tương đương độ khó</div>
    </div>
  </div>
</div>
```

Thiết kế C là lựa chọn tốt nhất trong điều kiện trường phổ thông: nó công bằng về mặt sư phạm (mọi học sinh đều được dùng AR ở một chủ đề nào đó), và nó cân bằng phần nào khác biệt giữa hai lớp. Điều kiện đi kèm là hai chủ đề phải tương đương độ khó — nếu không, khác biệt đo được có thể là khác biệt của chủ đề.

Với cả ba thiết kế, hai ràng buộc đã học ở Bài 1.4 vẫn áp:

- **Nhóm đối chứng phải có hoạt động tương đương về thời lượng.** Nếu nhóm AR có thêm hai mươi phút hoạt động mỗi tuần, bạn đang đo tác dụng của hai mươi phút.
- **Đo trễ, không chỉ đo ngay.** Đo ngay sau khi học là lúc hiệu ứng mới lạ mạnh nhất. Thêm một lần đo sau hai tới bốn tuần là thay đổi rẻ nhất nâng chất lượng kết luận.

## Giới hạn và ngưỡng quyết định

### Nói trước về giới hạn: cỡ mẫu một lớp

Đây là phần trung thực nhất và cũng là phần ăn điểm cao nhất ở hội đồng. Với một hoặc hai lớp, cỡ mẫu hiệu dụng còn nhỏ hơn nhiều so với số học sinh — đúng vấn đề hệ số tương quan nội cụm ở Bài 1.4. Hệ quả rất cụ thể:

| Điều bạn có thể kết luận | Điều bạn không thể kết luận |
|---|---|
| Sản phẩm chạy được trong điều kiện lớp học thật | Sản phẩm hiệu quả hơn cách dạy cũ ở mức có ý nghĩa thống kê |
| Học sinh tắc ở đâu, chỗ nào cần sửa | Hiệu quả này khái quát được cho các trường khác |
| Hướng thay đổi có vẻ tích cực hay tiêu cực | Hiệu quả cụ thể là bao nhiêu độ lệch chuẩn |
| Chi phí thời gian thật của giáo viên và học sinh | Sản phẩm nên được nhân rộng toàn tỉnh |

> [!meo] Cách viết phần giới hạn khiến hội đồng đánh giá cao: nêu **con số** — với 2 lớp và 80 học sinh, thiết kế của tôi chỉ đủ phát hiện hiệu quả rất lớn; hiệu quả thật của phần lớn can thiệp giáo dục nằm dưới ngưỡng ấy, nên kết quả không có khác biệt trong nghiên cứu này **không** có nghĩa là sản phẩm không có tác dụng.

### Kế hoạch phân tích và ngưỡng quyết định

Viết trước bốn dòng sau, và giữ nguyên chúng khi phân tích:

1. **Chỉ số chính** là gì, tính thế nào, trên nhóm nào.
2. **Phép so sánh** nào sẽ thực hiện — bao nhiêu phép, trên chỉ số nào. Càng nhiều phép so sánh thì càng dễ tìm ra một kết quả đẹp do ngẫu nhiên.
3. **Ngưỡng quyết định**: kết quả thế nào thì bạn khuyến nghị mở rộng, thế nào thì sửa rồi thử lại, thế nào thì dừng.
4. **Cách xử lý dữ liệu thiếu**: học sinh vắng buổi đo, làm nửa chừng, hoặc rút khỏi nghiên cứu.

Dòng thứ ba là dòng hay bị bỏ nhất, và nó là dòng quyết định kế hoạch đo có ích hay không. Một nghiên cứu không định trước ngưỡng thì kết quả nào cũng diễn giải được theo hướng có lợi.

## Luyện tập và tài liệu tham khảo

### Cá nhân (25 phút)

Viết câu hỏi đánh giá chính cho đồ án của bạn theo ba đặc điểm ở mục 2, rồi tự kiểm: một người khác đọc câu hỏi ấy có biết chính xác phải đo gì, trên ai, vào lúc nào không? Sửa cho tới khi câu trả lời là có.

### Nhóm 3–4 người (30 phút)

Mỗi người trình bày thiết kế đo của mình trong hai phút. Nhóm chất vấn bằng đúng ba câu: nhóm đối chứng làm gì trong thời gian đó; đo bằng bài nào và ai soạn; nếu kết quả không có khác biệt thì bạn kết luận gì. Ghi lại người nào chưa trả lời được câu ba — đó là chỗ cần viết phần giới hạn.

### Bài tập về nhà — mốc 4 của đồ án (150 phút)

Nộp kế hoạch đo lường hoàn chỉnh theo bảng ở mục 1.

1. Câu hỏi đánh giá chính và hai câu hỏi phụ, phát biểu kiểm được.
2. Bộ chỉ số bốn cái kèm công thức tính và nhịp đo.
3. Thiết kế đo đã chọn, có lịch cụ thể theo tuần, nêu rõ nhóm đối chứng làm gì.
4. Kế hoạch phân tích bốn dòng, trong đó có ngưỡng quyết định.
5. Hồ sơ dữ liệu rút gọn: thu gì, căn cứ nào, ai xem, lưu bao lâu, có gửi ra ngoài không.
6. Tuyên bố giới hạn, nêu bằng con số cụ thể của bối cảnh bạn.

**Cách làm (gợi ý từng bước):** dùng bài kiểm tra do người khác soạn hoặc lấy từ đề chung của tổ, tránh tự soạn bài đo cho chính sản phẩm mình — đây là cạm bẫy số 2 ở Bài 1.4; lịch thu dữ liệu ghi theo tuần và tính cả tuần kiểm tra, nghỉ lễ; khi mô tả nhóm đối chứng, ghi rõ thời lượng hoạt động của họ bằng phút để chứng minh tương đương; phần giới hạn viết ngay sau khi chốt cỡ mẫu, đừng để cuối cùng.

**Chấm theo:** câu hỏi kiểm được, có đối tượng – mốc thời gian – cách đo (25đ) · bộ chỉ số đủ bốn loại, tính lại được (20đ) · thiết kế phù hợp ràng buộc thật, nhóm đối chứng tương đương thời lượng (25đ) · kế hoạch phân tích có ngưỡng quyết định viết trước (15đ) · hồ sơ dữ liệu đúng nghĩa vụ (10đ) · tuyên bố giới hạn nêu bằng con số (5đ).

### Nguồn tham khảo

- Kraft, M. A. (2020). Interpreting effect sizes of education interventions. *Educational Researcher*, 49(4), 241–253.
- Hedges, L. V., & Hedberg, E. C. (2007). Intraclass correlation values for planning group-randomized trials in education. *Educational Evaluation and Policy Analysis*, 29(1), 60–87.
- Nosek, B. A., Ebersole, C. R., DeHaven, A. C., & Mellor, D. T. (2018). The preregistration revolution. *PNAS*, 115(11), 2600–2606.
- Education Endowment Foundation. *DIY Evaluation Guide* — hướng dẫn tự đánh giá can thiệp ở quy mô trường.
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.6",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.6-viet-truoc",
                "type": "mcq",
                "prompt": "Vì sao toàn bộ mốc 4 phải viết trước khi thu dữ liệu?",
                "explanation": "Đây là phiên bản sinh viên của tiền đăng ký nghiên cứu; nó chặn cái bẫy chạy nhiều phép so sánh rồi báo cáo kết quả đẹp nhất.",
                "points": 2,
                "options": [
                    {"label": "Để chặn việc chạy nhiều phép so sánh rồi chỉ báo cáo kết quả đẹp", "isCorrect": True},
                    {"label": "Để kịp tiến độ nộp bài", "isCorrect": False},
                    {"label": "Vì sau khi có dữ liệu thì không sửa được kế hoạch nữa", "isCorrect": False},
                    {"label": "Vì hội đồng yêu cầu nộp kế hoạch trước", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-cau-hoi-kiem-duoc",
                "type": "mcq",
                "prompt": "Ba đặc điểm của một câu hỏi đánh giá kiểm được là gì?",
                "explanation": "Có đối tượng cụ thể, có mốc thời gian, và có cách đo đã định trước. Thiếu một trong ba thì câu hỏi vẫn là mong muốn.",
                "points": 2,
                "options": [
                    {"label": "Có đối tượng cụ thể, có mốc thời gian, có cách đo định trước", "isCorrect": True},
                    {"label": "Có giả thuyết, có mô hình thống kê, có phần mềm phân tích", "isCorrect": False},
                    {"label": "Ngắn gọn, dễ hiểu, và tích cực", "isCorrect": False},
                    {"label": "Có trích dẫn nghiên cứu quốc tế đi kèm", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-thiet-ke-a",
                "type": "mcq",
                "prompt": "Thiết kế đo trước và sau trên một nhóm cho phép kết luận gì?",
                "explanation": "Chỉ cho phép nói có tiến bộ hay không, không cho phép quy tiến bộ ấy cho sách AR — vì lớp vẫn học bình thường và học sinh vẫn lớn lên.",
                "points": 2,
                "options": [
                    {"label": "Có tiến bộ hay không, nhưng không quy được tiến bộ đó cho can thiệp", "isCorrect": True},
                    {"label": "Can thiệp có hiệu quả hơn cách dạy cũ", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Hiệu quả cụ thể là bao nhiêu độ lệch chuẩn", "isCorrect": False},
                    {"label": "Kết quả khái quát được cho các trường khác", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-thiet-ke-c",
                "type": "mcq",
                "prompt": "Vì sao thiết kế luân phiên thường là lựa chọn tốt nhất ở trường phổ thông?",
                "explanation": "Công bằng về mặt sư phạm — mọi học sinh đều được dùng AR ở một chủ đề — và cân bằng phần nào khác biệt giữa hai lớp. Điều kiện: hai chủ đề tương đương độ khó.",
                "points": 2,
                "options": [
                    {"label": "Công bằng sư phạm và cân bằng phần nào khác biệt giữa hai lớp, với điều kiện hai chủ đề tương đương độ khó", "isCorrect": True},
                    {"label": "Vì nó cần ít dữ liệu nhất", "isCorrect": False},
                    {"label": "Vì nó cho hiệu quả đo được cao nhất", "isCorrect": False},
                    {"label": "Vì nó không cần nhóm đối chứng", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-doi-chung-tuong-duong",
                "type": "mcq",
                "prompt": "Nhóm dùng sách AR có thêm 20 phút hoạt động mỗi tuần so với nhóm đối chứng. Vấn đề là gì?",
                "explanation": "Bạn đang đo tác dụng của 20 phút hoạt động thêm chứ không đo tác dụng của AR — đúng cạm bẫy số 1 ở Bài 1.4.",
                "points": 2,
                "options": [
                    {"label": "Khác biệt đo được có thể chỉ là tác dụng của thời lượng thêm, không phải của AR", "isCorrect": True},
                    {"label": "Không có vấn đề gì nếu cả hai nhóm cùng học một nội dung", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Chỉ ảnh hưởng nếu chênh lệch trên 60 phút", "isCorrect": False},
                    {"label": "Cần tăng thời lượng cho nhóm đối chứng lên gấp đôi", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-do-tre",
                "type": "mcq",
                "prompt": "Thay đổi rẻ nhất nâng chất lượng kết luận của một thử nghiệm trong lớp là gì?",
                "explanation": "Thêm một lần đo sau hai tới bốn tuần. Đo ngay sau khi học là lúc hiệu ứng mới lạ mạnh nhất.",
                "points": 2,
                "options": [
                    {"label": "Thêm một lần đo trễ sau hai tới bốn tuần", "isCorrect": True},
                    {"label": "Tăng số câu hỏi trong bài kiểm tra", "isCorrect": False},
                    {"label": "Dùng phần mềm thống kê mạnh hơn", "isCorrect": False},
                    {"label": "Tăng thời lượng dùng sản phẩm", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-gioi-han-co-mau",
                "type": "matching",
                "prompt": "Xếp mỗi phát biểu vào nhóm kết luận được hay không kết luận được với cỡ mẫu một hai lớp.",
                "explanation": "Nghiên cứu quy mô lớp trả lời tốt câu hỏi về tính khả thi và chỗ cần sửa, nhưng không trả lời được câu hỏi về hiệu quả có ý nghĩa thống kê hay khả năng khái quát.",
                "points": 3,
                "pairs": [
                    {"left": "Sản phẩm chạy được trong điều kiện lớp học thật", "right": "Kết luận được"},
                    {"left": "Học sinh tắc ở đâu và chỗ nào cần sửa", "right": "Kết luận được"},
                    {"left": "Hiệu quả hơn cách dạy cũ ở mức có ý nghĩa thống kê", "right": "Không kết luận được"},
                    {"left": "Nên nhân rộng cho toàn tỉnh", "right": "Không kết luận được"},
                ],
            },
            {
                "key": "4.6-khong-khac-biet",
                "type": "mcq",
                "prompt": "Nghiên cứu của bạn với 2 lớp không tìm thấy khác biệt. Cách viết kết luận đúng là gì?",
                "explanation": "Thiết kế chỉ đủ phát hiện hiệu quả rất lớn, mà hiệu quả thật của phần lớn can thiệp giáo dục nằm dưới ngưỡng ấy — nên không có khác biệt không đồng nghĩa với không có tác dụng.",
                "points": 2,
                "options": [
                    {"label": "Nêu rõ thiết kế chỉ đủ phát hiện hiệu quả rất lớn, nên kết quả này không chứng minh sản phẩm vô tác dụng", "isCorrect": True},
                    {"label": "Kết luận sản phẩm không có tác dụng", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Bỏ phần kết quả này và chỉ báo cáo phần định tính", "isCorrect": False},
                    {"label": "Chạy thêm nhiều phép so sánh khác cho tới khi tìm ra khác biệt", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-nguong-quyet-dinh",
                "type": "mcq",
                "prompt": "Vì sao ngưỡng quyết định phải viết trước khi phân tích?",
                "explanation": "Không định trước ngưỡng thì kết quả nào cũng diễn giải được theo hướng có lợi. Ngưỡng phải nói rõ: thế nào thì mở rộng, thế nào thì sửa rồi thử lại, thế nào thì dừng.",
                "points": 2,
                "options": [
                    {"label": "Vì không có ngưỡng định trước thì mọi kết quả đều diễn giải được theo hướng có lợi", "isCorrect": True},
                    {"label": "Vì phần mềm thống kê đòi nhập ngưỡng trước", "isCorrect": False},
                    {"label": "Vì ngưỡng ảnh hưởng tới cách thu dữ liệu", "isCorrect": False},
                    {"label": "Không cần thiết nếu phân tích trung thực", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-bai-do-doc-lap",
                "type": "mcq",
                "prompt": "Vì sao nên dùng bài kiểm tra do người khác soạn hoặc lấy từ đề chung của tổ?",
                "explanation": "Tự soạn bài đo cho chính sản phẩm mình là cạm bẫy số 2 ở Bài 1.4: bài tự soạn bám sát đúng nội dung can thiệp đã dạy, nên hiệu quả bị thổi lên.",
                "points": 2,
                "options": [
                    {"label": "Vì bài tự soạn bám sát đúng nội dung mình đã dạy nên thổi hiệu quả lên", "isCorrect": True},
                    {"label": "Vì tự soạn đề mất thời gian", "isCorrect": False},
                    {"label": "Vì quy chế cấm giáo viên tự soạn đề", "isCorrect": False},
                    {"label": "Vì đề của tổ luôn khó hơn", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-so-phep-so-sanh",
                "type": "mcq",
                "prompt": "Vì sao kế hoạch phân tích phải nêu trước số phép so sánh sẽ thực hiện?",
                "explanation": "Càng nhiều phép so sánh thì càng dễ tìm ra một kết quả đẹp do ngẫu nhiên; định trước số phép giữ cho kết luận còn giá trị.",
                "points": 2,
                "options": [
                    {"label": "Vì càng nhiều phép so sánh thì càng dễ có kết quả đẹp do ngẫu nhiên", "isCorrect": True},
                    {"label": "Vì mỗi phép so sánh tốn thời gian tính toán", "isCorrect": False},
                    {"label": "Vì phần mềm giới hạn số phép so sánh", "isCorrect": False},
                    {"label": "Vì hội đồng chỉ chấp nhận một phép so sánh", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-du-lieu-thieu",
                "type": "true_false",
                "prompt": "Kế hoạch phân tích cần nêu trước cách xử lý học sinh vắng buổi đo, làm nửa chừng hoặc rút khỏi nghiên cứu.",
                "explanation": "Đúng — quyết định loại ai khỏi phân tích sau khi đã nhìn kết quả là một cách vô tình làm đẹp số liệu, nên phải định trước.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "4.6-viet-luan-moc4",
                "type": "essay",
                "prompt": "Viết 250–350 từ kế hoạch đo lường cho đồ án của bạn: câu hỏi đánh giá chính, thiết kế đã chọn và lý do, nhóm đối chứng làm gì trong thời gian đó, ngưỡng quyết định, và tuyên bố giới hạn nêu bằng con số cụ thể của bối cảnh bạn.",
                "points": 5,
            },
        ],
    },
}

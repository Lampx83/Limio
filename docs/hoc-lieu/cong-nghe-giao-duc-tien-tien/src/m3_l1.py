# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.1 · Mô hình người học: từ điểm số tới trạng thái tri thức",
    "durationMin": 50,
    "description": "Vì sao điểm số không mô tả được người học biết gì, cách phân rã nội dung thành thành phần tri thức, ma trận Q gắn câu hỏi với kỹ năng, và mô hình người học mở.",
    "objectives": [
        "Phân rã được một chủ đề dạy học thành các thành phần tri thức kiểm được riêng",
        "Lập được ma trận Q gắn câu hỏi với thành phần tri thức cho một bộ bài tập",
        "Chỉ ra được ba thông tin mà điểm trung bình làm mất so với mô hình người học",
    ],
    "summary": [
        "Điểm số gộp mọi kỹ năng vào một con số, trộn đoán trúng với hiểu thật, và không nói được người học sẽ làm được gì tiếp theo.",
        "Đơn vị của mô hình người học là thành phần tri thức — mảnh kiến thức hoặc kỹ năng nhỏ nhất mà việc nắm hay không nắm nó thay đổi kết quả làm bài.",
        "Ma trận Q gắn mỗi câu hỏi với các thành phần tri thức nó đòi hỏi; chất lượng ma trận này quyết định mọi thứ phía sau, kể cả chất lượng phản hồi.",
        "Mô hình người học mở cho người học nhìn thấy hệ thống đang nghĩ gì về mình — vừa là công cụ siêu nhận thức vừa là điều kiện minh bạch.",
    ],
    "body": r"""
## Ba thứ điểm số làm mất

Một học sinh được 7 điểm bài kiểm tra. Con số ấy dùng để xếp loại thì tiện, nhưng để quyết định *dạy gì tiếp theo* thì gần như vô dụng, vì nó đã làm mất ba thông tin:

| Thông tin bị mất | Vì sao quan trọng | Ví dụ |
|---|---|---|
| Cấu trúc theo kỹ năng | Hai học sinh cùng 7 điểm có thể hổng hai chỗ hoàn toàn khác nhau | Em A vững quy đồng, sai dấu; em B ngược lại |
| Mức độ chắc chắn | Đúng do hiểu và đúng do đoán cho cùng một điểm | 4 câu trắc nghiệm đúng có thể là 4 lần hiểu hoặc 2 lần đoán trúng |
| Diễn biến theo thời gian | Trạng thái tri thức thay đổi; điểm là ảnh chụp một lần | Em C vừa vượt qua chỗ tắc tuần trước, em D đang trượt lùi |

Mô hình người học ra đời để giữ lại đúng ba thứ ấy: nó là **ước lượng liên tục cập nhật về trạng thái tri thức của một người trên từng thành phần tri thức, kèm mức độ không chắc chắn**.

> [!ghi-nho] Câu hỏi phân biệt một hệ thống có mô hình người học thật với một hệ thống chỉ lưu điểm: *hệ thống trả lời được câu "người học này nên làm bài gì tiếp theo, vì sao" hay chỉ trả lời được câu "người học này được bao nhiêu điểm"?*

## Thành phần tri thức: đơn vị làm việc của cả module

**Thành phần tri thức** là mảnh kiến thức hoặc kỹ năng nhỏ nhất mà việc nắm hay không nắm nó làm thay đổi khả năng làm đúng một nhiệm vụ. Trong tài liệu tiếng Anh nó xuất hiện dưới nhiều tên — knowledge component, skill, kỹ năng nền — nhưng ý tưởng thì một.

Ba tiêu chí để phân rã đúng:

1. **Kiểm được riêng.** Phải nghĩ ra được một nhiệm vụ mà người nắm thành phần này làm đúng, người không nắm làm sai — mà không phụ thuộc quá nhiều vào thành phần khác.
2. **Đủ nhỏ để hành động.** *Giải phương trình bậc hai* là quá to: người học sai có thể vì sai công thức nghiệm, sai dấu, hay sai biến đổi đại số. Ba cái ấy cần ba can thiệp khác nhau.
3. **Không nhỏ tới mức vụn.** Nếu mỗi câu hỏi thành một thành phần riêng thì mô hình không khái quát được sang câu mới — mà khái quát chính là lý do ta xây mô hình.

> [!vi-du] Khoá học bạn đang học vận hành đúng cơ chế này: mỗi bài học sinh ra một chủ đề, mỗi câu hỏi trong bài kế thừa chủ đề của bài, và hệ thống ước lượng mức thành thạo của bạn theo từng chủ đề chứ không theo tổng điểm. Cách gán chủ đề tự động theo cấu trúc bài học là một đánh đổi có chủ ý — nó thô hơn phân rã thủ công của chuyên gia, nhưng nó luôn tồn tại, còn phân rã thủ công thì thường không ai làm.

## Ma trận Q: gắn câu hỏi với thành phần tri thức

Cầu nối giữa nội dung và mô hình người học là một bảng nhị phân: hàng là câu hỏi, cột là thành phần tri thức, ô đánh dấu nếu câu hỏi ấy đòi hỏi thành phần ấy. Trong tài liệu gọi là **ma trận Q**.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .5rem">Ma trận Q — ví dụ với chủ đề phân số</div>
  <table style="min-width:32rem;border-collapse:collapse;font-size:1.02rem">
    <thead><tr>
      <th style="text-align:left;padding:.5rem .6rem;border-bottom:2px solid rgba(127,127,127,.4)">Câu hỏi</th>
      <th style="padding:.5rem .6rem;border-bottom:2px solid rgba(127,127,127,.4)">Quy đồng</th>
      <th style="padding:.5rem .6rem;border-bottom:2px solid rgba(127,127,127,.4)">Rút gọn</th>
      <th style="padding:.5rem .6rem;border-bottom:2px solid rgba(127,127,127,.4)">Cộng tử số</th>
      <th style="padding:.5rem .6rem;border-bottom:2px solid rgba(127,127,127,.4)">So sánh phân số</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:.45rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">C1 · 1/2 + 1/4</td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center"></td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center"></td></tr>
      <tr><td style="padding:.45rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">C2 · 6/8 viết gọn nhất</td><td style="text-align:center"></td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center"></td><td style="text-align:center"></td></tr>
      <tr><td style="padding:.45rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">C3 · 2/3 và 3/5, số nào lớn hơn</td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center"></td><td style="text-align:center"></td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td></tr>
      <tr><td style="padding:.45rem .6rem">C4 · 3/4 + 5/6, rút gọn kết quả</td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center;background:rgba(13,148,136,.22)">●</td><td style="text-align:center"></td></tr>
    </tbody>
  </table>
  <div style="font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">C4 gắn ba thành phần: sai C4 <strong>chưa cho biết sai ở đâu</strong>. Muốn chẩn đoán, hệ thống phải đối chiếu với kết quả ở C1, C2 — hoặc bộ câu hỏi phải có những câu gắn một thành phần duy nhất.</div>
</div>
```

Hai hệ quả thiết kế rút thẳng từ bảng này. Thứ nhất, **bộ bài tập cần có những câu gắn đúng một thành phần** để làm điểm neo chẩn đoán; bộ toàn câu tổng hợp thì đo được năng lực chung nhưng không định vị được chỗ hổng. Thứ hai, ma trận Q sai thì mọi thứ phía sau sai theo: mô hình sẽ cập nhật nhầm kỹ năng, phản hồi sẽ chỉ sai chỗ, và bài gợi ý tiếp theo sẽ lệch. **Chất lượng ma trận Q là trần chất lượng của toàn hệ thống thích ứng.**

Trong nghiên cứu, ma trận Q còn được tinh chỉnh bằng dữ liệu: nếu người học nắm vững mọi thành phần được gán mà vẫn sai một câu cách hệ thống, nhiều khả năng câu ấy đòi một thành phần chưa được liệt kê. Đây là vòng lặp cải tiến mà một khoá luận tốt có thể thực hiện với dữ liệu thật của một lớp.

## Mô hình người học mở: cho người học nhìn thấy chính mình

Mặc định, mô hình người học là thứ chạy ngầm. **Mô hình người học mở** là hướng ngược lại: hiển thị cho chính người học thấy hệ thống đang ước lượng gì về họ — kỹ năng nào đã vững, kỹ năng nào chưa, dựa trên bao nhiêu lượt làm.

Ba lý do khiến đây không phải tính năng trang trí:

- **Siêu nhận thức.** Người học vốn đánh giá sai mức độ nắm bài của mình, thường theo hướng lạc quan vì cảm giác trôi chảy (Bài 1.2). Nhìn thấy ước lượng dựa trên dữ liệu là một đối trọng.
- **Minh bạch.** Nếu hệ thống dùng ước lượng ấy để chọn bài, để cảnh báo, hoặc để báo cho giáo viên, thì người học có quyền biết nó nói gì về mình — nối thẳng với nghĩa vụ ở Bài 1.5.
- **Sửa được.** Mô hình nào cũng sai ở đâu đó. Người học nhìn thấy chỗ sai có thể phản hồi *em nắm phần này rồi, em sai do bấm nhầm* — và đó là dữ liệu quý.

> [!canh-bao] Hiển thị mô hình người học đòi hỏi ngôn ngữ cẩn thận. **Không hiển thị như nhãn năng lực** — không dùng từ giỏi, yếu, kém. Hiển thị như trạng thái tạm thời kèm hành động: *chủ đề quy đồng: 3/8 lượt gần nhất đúng — luyện thêm 5 câu để hệ thống chắc chắn hơn*. Cách viết quyết định người học coi nó là bản đồ hay là bản án.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Chọn một bài học trong chuyên môn của bạn. Phân rã thành 4–6 thành phần tri thức theo ba tiêu chí ở mục 2, rồi tự kiểm bằng câu hỏi: với mỗi thành phần, bạn nghĩ ra được một nhiệm vụ kiểm riêng nó không? Thành phần nào không nghĩ ra được thì hoặc quá to, hoặc không tồn tại độc lập.

### Nhóm 3–4 người (30 phút)

Mỗi người mang danh sách thành phần tri thức của mình. Đổi chéo và cùng lập ma trận Q cho 8 câu hỏi của bạn mình. Chú ý đếm: có bao nhiêu câu gắn đúng một thành phần? Nếu dưới hai câu, bộ bài tập ấy chưa chẩn đoán được, và nhóm cùng đề xuất hai câu neo cần thêm.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **bản đồ tri thức và ma trận Q** cho một chủ đề dạy học, dùng được làm nền cho phần luyện tập của đồ án.

1. Phân rã chủ đề thành 6–10 thành phần tri thức, mỗi cái kèm một câu mô tả *người nắm được nó thì làm được gì*.
2. Soạn 15–20 câu hỏi, trong đó **ít nhất 5 câu neo** gắn đúng một thành phần.
3. Lập ma trận Q dạng bảng tính: hàng câu hỏi, cột thành phần, ô đánh dấu.
4. Với mỗi thành phần, ghi thêm **một lỗi sai điển hình** — đây là dữ liệu bạn sẽ dùng lại ở Bài 3.5 và ở mốc 3 của đồ án.
5. Kiểm chéo: nhờ một người trong chuyên môn soi lại ma trận, ghi lại những ô hai người bất đồng và lý do.

**Cách làm (gợi ý từng bước):** đặt tên thành phần bằng cụm động từ (*quy đồng hai mẫu số khác nhau*), không bằng danh từ chủ đề (*phân số*) — tên bằng động từ tự nó kiểm tra được tiêu chí kiểm riêng; đánh dấu ô bằng số 1 và 0 để sau này tính tổng theo cột, cột nào tổng bằng 0 nghĩa là thành phần chưa có câu nào đo; giữ nguyên bảng này, các bài sau sẽ dùng lại.

**Chấm theo:** thành phần tri thức đủ nhỏ để hành động và kiểm riêng được (3đ) · có ít nhất 5 câu neo (2đ) · ma trận đầy đủ, không cột trống (2đ) · lỗi sai điển hình cụ thể, lấy từ kinh nghiệm hoặc bài làm thật (2đ) · biên bản kiểm chéo có ghi bất đồng (1đ).

### Nguồn tham khảo

- Koedinger, K. R., Corbett, A. T., & Perfetti, C. (2012). The Knowledge-Learning-Instruction framework. *Cognitive Science*, 36(5), 757–798.
- Tatsuoka, K. K. (1983). Rule space: An approach for dealing with misconceptions based on item response theory. *Journal of Educational Measurement*, 20(4), 345–354.
- Bull, S., & Kay, J. (2010). Open learner models. Trong *Advances in Intelligent Tutoring Systems*, 301–322.
- Desmarais, M. C., & Baker, R. S. J. d. (2012). A review of recent advances in learner and skill modeling in intelligent learning environments. *User Modeling and User-Adapted Interaction*, 22, 9–38.
""",
    "quiz": {
        "title": "Kiểm tra Bài 3.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.1-diem-so-mat-gi",
                "type": "mcq",
                "prompt": "Hai học sinh cùng đạt 7 điểm một bài kiểm tra. Thông tin nào bị mất khi chỉ giữ con số ấy?",
                "explanation": "Cấu trúc theo kỹ năng (hai em có thể hổng hai chỗ khác nhau), mức độ chắc chắn (đúng do hiểu hay do đoán), và diễn biến theo thời gian.",
                "points": 2,
                "options": [
                    {"label": "Kỹ năng nào hổng, đúng do hiểu hay do đoán, và trạng thái đang lên hay đang xuống", "isCorrect": True},
                    {"label": "Chỉ mất thông tin về thời gian làm bài", "isCorrect": False},
                    {"label": "Không mất gì nếu bài kiểm tra đủ dài", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "Chỉ mất thông tin về thái độ học tập", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-cau-hoi-phan-biet",
                "type": "mcq",
                "prompt": "Câu hỏi nào phân biệt hệ thống có mô hình người học thật với hệ thống chỉ lưu điểm?",
                "explanation": "Hệ thống trả lời được người học nên làm bài gì tiếp theo và vì sao, chứ không chỉ trả lời được người học được bao nhiêu điểm.",
                "points": 2,
                "options": [
                    {"label": "Hệ thống nói được người học nên làm bài gì tiếp theo và vì sao không", "isCorrect": True},
                    {"label": "Hệ thống có biểu đồ đẹp không", "isCorrect": False},
                    {"label": "Hệ thống lưu được bao nhiêu năm dữ liệu", "isCorrect": False},
                    {"label": "Hệ thống có tính điểm trung bình theo tuần không", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                ],
            },
            {
                "key": "3.1-phan-ra-qua-to",
                "type": "mcq",
                "prompt": "Vì sao *giải phương trình bậc hai* là một thành phần tri thức quá to?",
                "explanation": "Người học sai có thể vì sai công thức nghiệm, sai dấu, hay sai biến đổi đại số — ba nguyên nhân cần ba can thiệp khác nhau, nên gộp lại thì mô hình không nói được nên dạy gì.",
                "points": 2,
                "options": [
                    {"label": "Vì một lần sai có thể do nhiều nguyên nhân khác nhau, mỗi nguyên nhân cần một can thiệp khác", "isCorrect": True},
                    {"label": "Vì nó thuộc chương trình lớp trên", "isCorrect": False},
                    {"label": "Vì tên nó quá dài", "isCorrect": False},
                    {"label": "Không quá to: càng gộp thì mô hình càng ổn định", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-phan-ra-qua-vun",
                "type": "mcq",
                "prompt": "Nếu mỗi câu hỏi được gán một thành phần tri thức riêng thì vấn đề là gì?",
                "explanation": "Mô hình không khái quát được sang câu hỏi mới — mà khái quát chính là lý do xây mô hình. Biết người học làm đúng câu số 7 không giúp dự đoán câu số 8.",
                "points": 2,
                "options": [
                    {"label": "Mô hình mất khả năng khái quát sang câu hỏi mới", "isCorrect": True},
                    {"label": "Hệ thống chạy chậm hơn", "isCorrect": False},
                    {"label": "Không có vấn đề gì: càng chi tiết càng chính xác", "isCorrect": False},
                    {"label": "Người học sẽ thấy quá nhiều chủ đề trên màn hình", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-cau-neo",
                "type": "mcq",
                "prompt": "Vì sao bộ bài tập cần có câu gắn đúng một thành phần tri thức?",
                "explanation": "Câu gắn nhiều thành phần khi sai thì chưa cho biết sai ở đâu. Câu neo gắn một thành phần cho phép định vị chỗ hổng trực tiếp.",
                "points": 2,
                "options": [
                    {"label": "Vì câu gắn nhiều thành phần khi sai không cho biết sai ở thành phần nào", "isCorrect": True},
                    {"label": "Vì câu một thành phần dễ hơn nên tạo động lực", "isCorrect": False},
                    {"label": "Vì quy chế đề thi yêu cầu", "isCorrect": False},
                    {"label": "Vì câu tổng hợp không đo được gì", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-tran-chat-luong",
                "type": "mcq",
                "prompt": "Vì sao nói chất lượng ma trận Q là trần chất lượng của toàn hệ thống thích ứng?",
                "explanation": "Ma trận sai thì mô hình cập nhật nhầm kỹ năng, phản hồi chỉ sai chỗ, bài gợi ý tiếp theo lệch. Mọi thành phần phía sau đều dựa trên phép gán này.",
                "points": 2,
                "options": [
                    {"label": "Vì mọi bước sau — cập nhật, phản hồi, chọn bài — đều dựa trên phép gán câu hỏi với kỹ năng", "isCorrect": True},
                    {"label": "Vì ma trận Q chiếm phần lớn dung lượng cơ sở dữ liệu", "isCorrect": False},
                    {"label": "Vì nó quyết định tốc độ tính toán", "isCorrect": False},
                    {"label": "Không đúng: mô hình học sâu có thể tự bù cho ma trận Q sai", "isCorrect": False, "misconception": "cngdtt.model-fit-is-enough"},
                ],
            },
            {
                "key": "3.1-tinh-chinh-q",
                "type": "mcq",
                "prompt": "Người học nắm vững mọi thành phần được gán cho câu C7 nhưng vẫn sai C7 một cách hệ thống. Giả thuyết hợp lý nhất là gì?",
                "explanation": "Câu C7 nhiều khả năng đòi một thành phần tri thức chưa được liệt kê trong ma trận Q. Đây là vòng lặp tinh chỉnh ma trận bằng dữ liệu.",
                "points": 2,
                "options": [
                    {"label": "C7 đòi một thành phần tri thức chưa có trong ma trận Q", "isCorrect": True},
                    {"label": "Người học lười nên không cố gắng ở câu đó", "isCorrect": False},
                    {"label": "Mô hình cần thêm dữ liệu, không cần sửa gì", "isCorrect": False},
                    {"label": "Câu C7 nên bị loại khỏi ngân hàng đề ngay", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-olm-ba-ly-do",
                "type": "matching",
                "prompt": "Ghép mỗi lý do hiển thị mô hình người học cho chính người học với nội dung của nó.",
                "explanation": "Ba lý do: siêu nhận thức, minh bạch, và khả năng sửa sai của mô hình — không lý do nào thuộc loại trang trí giao diện.",
                "points": 3,
                "pairs": [
                    {"left": "Siêu nhận thức", "right": "Đối trọng với xu hướng tự đánh giá quá lạc quan do cảm giác trôi chảy"},
                    {"left": "Minh bạch", "right": "Hệ thống dùng ước lượng ấy để quyết định thì người học có quyền biết nó nói gì"},
                    {"left": "Sửa được", "right": "Người học báo lại khi mô hình sai, ví dụ sai do bấm nhầm chứ không do không hiểu"},
                ],
            },
            {
                "key": "3.1-ngon-ngu-hien-thi",
                "type": "mcq",
                "prompt": "Cách hiển thị nào phù hợp khi cho người học thấy ước lượng của hệ thống về mình?",
                "explanation": "Hiển thị như trạng thái tạm thời kèm hành động, không như nhãn năng lực. Ngôn ngữ quyết định người học coi đó là bản đồ hay bản án.",
                "points": 2,
                "options": [
                    {"label": "Chủ đề quy đồng: 3/8 lượt gần nhất đúng — luyện thêm 5 câu để hệ thống chắc chắn hơn", "isCorrect": True},
                    {"label": "Năng lực toán của em: yếu", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                    {"label": "Xếp hạng của em trong lớp: 28/40", "isCorrect": False},
                    {"label": "Em thuộc nhóm học sinh tiếp thu chậm", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                ],
            },
            {
                "key": "3.1-ba-tieu-chi",
                "type": "ordering",
                "prompt": "Sắp xếp quy trình phân rã một chủ đề thành thành phần tri thức theo thứ tự làm việc.",
                "explanation": "Bắt đầu từ nhiệm vụ thật người học phải làm được, tách ra thành phần, kiểm tiêu chí kiểm riêng, rồi mới gắn câu hỏi và kiểm bằng dữ liệu.",
                "points": 3,
                "sequence": [
                    "Liệt kê các nhiệm vụ mà người học phải làm được sau bài học",
                    "Tách mỗi nhiệm vụ thành các mảnh kỹ năng nhỏ hơn",
                    "Với mỗi mảnh, kiểm xem có nghĩ ra được nhiệm vụ đo riêng nó không",
                    "Gắn từng câu hỏi với các thành phần nó đòi hỏi thành ma trận Q",
                    "Đối chiếu với dữ liệu lượt làm để phát hiện thành phần còn thiếu",
                ],
            },
            {
                "key": "3.1-tu-dong-gan-chu-de",
                "type": "mcq",
                "prompt": "Hệ thống bạn đang học tự sinh một chủ đề cho mỗi bài học và cho câu hỏi kế thừa chủ đề của bài. Đánh giá đúng về đánh đổi này là gì?",
                "explanation": "Thô hơn phân rã thủ công của chuyên gia, nhưng nó luôn tồn tại — còn phân rã thủ công thì thường không ai làm, và không có phép gán thì không có mô hình người học nào cả.",
                "points": 2,
                "options": [
                    {"label": "Thô hơn phân rã của chuyên gia nhưng luôn có, còn phân rã thủ công thì thường bị bỏ trống", "isCorrect": True},
                    {"label": "Chính xác hơn phân rã thủ công vì do máy làm", "isCorrect": False},
                    {"label": "Vô dụng vì không đủ chi tiết", "isCorrect": False},
                    {"label": "Chỉ dùng được cho môn ngôn ngữ", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-khong-chac-chan",
                "type": "true_false",
                "prompt": "Mô hình người học cần lưu cả mức độ không chắc chắn của ước lượng, không chỉ giá trị ước lượng.",
                "explanation": "Đúng. Xác suất thành thạo 0,7 dựa trên 3 lượt làm khác hẳn 0,7 dựa trên 30 lượt; quyết định chuyển chủ đề hay cho luyện thêm phụ thuộc vào mức chắc chắn ấy.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "3.1-viet-luan-phan-ra",
                "type": "essay",
                "prompt": "Chọn một chủ đề bạn định dạy trong đồ án. Viết 250–350 từ: phân rã thành 5–6 thành phần tri thức kèm lý do vì sao tách như vậy, nêu hai câu neo bạn sẽ soạn, và chỉ ra thành phần nào bạn nghĩ khó kiểm riêng nhất và cách xử lý.",
                "points": 5,
            },
        ],
    },
}

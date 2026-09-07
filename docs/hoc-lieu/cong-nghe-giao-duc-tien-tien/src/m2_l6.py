# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2.6 · Xưởng mốc 2: soạn nội dung sách AR có AI hỗ trợ",
    "durationMin": 60,
    "description": "Hướng dẫn thực hiện mốc 2 của đồ án: quy trình đồng soạn năm bước với ranh giới trách nhiệm rõ ràng, ba lớp kiểm chứng nội dung, mẫu nhật ký AI và bảng kiểm trước khi nộp.",
    "objectives": [
        "Phân định được việc nào giao cho mô hình và việc nào bắt buộc tự làm trong khi soạn học liệu",
        "Vận hành được ba lớp kiểm chứng nội dung trước khi đưa bản thảo vào thử nghiệm",
        "Ghi được nhật ký AI đủ để người chấm tái dựng quá trình soạn của bạn",
    ],
    "summary": [
        "Mốc 2 nộp bản thảo bốn trang sách AR, nhật ký AI, và biên bản kiểm chứng nội dung — cả ba đều được chấm.",
        "Ranh giới trách nhiệm: mô hình sinh phương án và diễn đạt, bạn quyết định mục tiêu, cấu trúc, độ chính xác chuyên môn và mức độ phù hợp với người học.",
        "Ba lớp kiểm chứng: đối chiếu dữ kiện với nguồn gốc, rà theo mục tiêu và nguyên tắc đa phương tiện, và thử với người đọc thật.",
        "Nhật ký AI ghi lời nhắc chính, phần giữ, phần sửa, phần bỏ và lý do — phần sửa và bỏ mới là chỗ thể hiện phán đoán chuyên môn.",
    ],
    "body": r"""
## Mốc 2 yêu cầu nộp gì

| Sản phẩm | Nội dung | Chấm gì |
|---|---|---|
| Bản thảo nội dung | 4 trang sách, mỗi trang nêu rõ: mục tiêu học tập, phần chữ in, phần sẽ hiện qua AR, chú giải | Tính chính xác, bám mục tiêu, phù hợp người học |
| Nhật ký AI | Lời nhắc chính đã dùng, phần giữ, phần sửa, phần bỏ và lý do | Chất lượng phán đoán chuyên môn của bạn |
| Biên bản kiểm chứng | Danh sách dữ kiện đã kiểm, nguồn đối chiếu, kết quả | Mức độ nghiêm túc của khâu kiểm |

Ba sản phẩm này tương ứng mức 2 trong thang cho phép dùng AI ở Bài 2.5: **đồng soạn có kiểm chứng**. Bạn được dùng mô hình để sinh bản nháp, và bạn chịu trách nhiệm hoàn toàn về nội dung cuối cùng.

> [!ghi-nho] Tiêu chí phân biệt bài tốt với bài trung bình ở mốc này không phải bản thảo trau chuốt tới đâu, mà là **nhật ký cho thấy bạn đã bỏ đi những gì và vì sao**. Một nhật ký chỉ ghi *AI viết, tôi giữ nguyên* tự nó là bằng chứng chưa có phán đoán chuyên môn.

## Quy trình đồng soạn năm bước và ranh giới trách nhiệm

| Bước | Bạn làm | Mô hình làm | Bẫy |
|---|---|---|---|
| 1. Xác định mục tiêu và người học | Viết mục tiêu bằng động từ hành vi, mô tả trình độ và vốn kiến thức nền của người học | Không giao | Giao bước này cho mô hình thì cả bản thảo trôi theo nội dung chung chung |
| 2. Dựng khung bốn trang | Quyết định mỗi trang dạy ý gì, ý nào cần AR, thứ tự nào | Gợi ý phương án chia, bạn chọn | Nhận khung do mô hình đề xuất mà không đối chiếu với chỗ người học hay tắc |
| 3. Sinh bản nháp từng phần | Cung cấp nguồn tài liệu và ràng buộc | Viết bản nháp bám nguồn đã cho, có trích dẫn định vị | Không đưa nguồn, để mô hình viết từ trí nhớ của nó |
| 4. Biên tập chuyên môn | Sửa thuật ngữ, cắt phần thừa, chỉnh mức độ khó, viết lại phần sai | Gợi ý cách diễn đạt lại khi bạn đã quyết nội dung | Sửa hình thức mà không kiểm nội dung |
| 5. Chuẩn bị cho AR | Quyết định mỗi trang hiện gì trong không gian, vì sao thứ đó cần ba chiều | Gợi ý phương án hình dung | Để mô hình quyết định nội dung AR — nó không nhìn thấy trang giấy của bạn |

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Ai làm gì trong năm bước</div>
  <div style="min-width:36rem;display:flex;gap:.3rem;text-align:center;font-size:1rem;line-height:1.4">
    <div style="flex:1"><div style="padding:.5rem .35rem;background:rgba(220,38,38,.85);color:#fff;border-radius:.4rem .4rem 0 0"><strong>1</strong><br>Mục tiêu &amp; người học</div><div style="padding:.45rem .35rem;border:1px solid rgba(127,127,127,.3);border-top:0;border-radius:0 0 .4rem .4rem">bạn làm<br><span style="opacity:.6">không giao</span></div></div>
    <div style="flex:1"><div style="padding:.5rem .35rem;background:rgba(217,150,40,.85);color:#fff;border-radius:.4rem .4rem 0 0"><strong>2</strong><br>Khung bốn trang</div><div style="padding:.45rem .35rem;border:1px solid rgba(127,127,127,.3);border-top:0;border-radius:0 0 .4rem .4rem">bạn quyết<br><span style="opacity:.6">máy gợi ý</span></div></div>
    <div style="flex:1"><div style="padding:.5rem .35rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem .4rem 0 0"><strong>3</strong><br>Sinh bản nháp</div><div style="padding:.45rem .35rem;border:1px solid rgba(127,127,127,.3);border-top:0;border-radius:0 0 .4rem .4rem">máy viết<br><span style="opacity:.6">bám nguồn bạn đưa</span></div></div>
    <div style="flex:1"><div style="padding:.5rem .35rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.4rem .4rem 0 0"><strong>4</strong><br>Biên tập chuyên môn</div><div style="padding:.45rem .35rem;border:1px solid rgba(127,127,127,.3);border-top:0;border-radius:0 0 .4rem .4rem">bạn sửa<br><span style="opacity:.6">máy diễn đạt lại</span></div></div>
    <div style="flex:1"><div style="padding:.5rem .35rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem .4rem 0 0"><strong>5</strong><br>Chuẩn bị AR</div><div style="padding:.45rem .35rem;border:1px solid rgba(127,127,127,.3);border-top:0;border-radius:0 0 .4rem .4rem">bạn quyết<br><span style="opacity:.6">không giao</span></div></div>
  </div>
</div>
```

Nguyên tắc gộp lại: **mô hình sinh phương án và diễn đạt; bạn quyết định mục tiêu, cấu trúc, độ chính xác và mức độ phù hợp**. Bước 1 và bước 5 gần như không giao được, vì cả hai đòi thông tin mà mô hình không có — người học cụ thể của bạn, và bố cục vật lý của trang sách.

> [!meo] Cách đưa nguồn hiệu quả ở bước 3: dán chính đoạn sách giáo khoa hoặc tài liệu chuyên ngành vào ngữ cảnh, yêu cầu viết lại cho đúng trình độ người học, và **buộc trích dẫn câu nào trong nguồn tương ứng với mỗi ý**. Việc này biến tác vụ từ nhớ lại thành đọc hiểu — kiểu tác vụ mô hình mạnh nhất, như Bài 2.1 đã phân tích.

## Ba lớp kiểm chứng trước khi thử nghiệm

**Lớp 1 — Đối chiếu dữ kiện.** Lập danh sách mọi mệnh đề kiểm được trong bản thảo: số liệu, định nghĩa, tên riêng, đơn vị, năm, công thức, quan hệ nhân quả được khẳng định. Đối chiếu từng cái với nguồn gốc — sách giáo khoa, giáo trình, tài liệu chuyên ngành. Ghi vào biên bản: mệnh đề, nguồn, kết quả. Kinh nghiệm chung: **tỉ lệ sai không bằng không**, và chỗ sai thường là chi tiết nhỏ nghe rất hợp lý.

**Lớp 2 — Rà theo mục tiêu và nguyên tắc thiết kế.** Ba câu hỏi cho mỗi trang: nó phục vụ mục tiêu nào; có chi tiết nào thú vị nhưng không phục vụ mục tiêu không (nguyên tắc mạch lạc, Bài 1.2); chú giải có đặt sát chi tiết nó mô tả không (nguyên tắc kề nhau và vấn đề chia chú ý trong AR, Bài 1.6).

**Lớp 3 — Thử với người đọc thật.** Đưa bản thảo cho **hai người thuộc đúng nhóm đối tượng** đọc, và hỏi ba câu: chỗ nào em phải đọc lại hai lần; chỗ nào em đoán được ý mà không cần đọc kỹ; nếu phải kể lại trang này cho bạn, em sẽ nói gì. Câu thứ ba là câu phát hiện được nhiều nhất, vì nó cho thấy cái gì thật sự đọng lại.

> [!canh-bao] Không lớp nào trong ba lớp này được thay bằng cách hỏi lại chính mô hình. Như Bài 2.1 đã nêu, hỏi mô hình xem nội dung nó vừa viết có đúng không là dùng chính hệ đã sinh ra lỗi để thẩm định lỗi ấy.

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .5rem">Ba lớp kiểm chứng bắt ba loại lỗi khác nhau</div>
  <div style="display:flex;flex-direction:column;gap:.35rem">
    <div style="display:flex;gap:.5rem;align-items:stretch">
      <div style="flex:0 0 8.5rem;background:rgba(220,38,38,.85);color:#fff;padding:.6rem;border-radius:.4rem;font-size:1.02rem;font-weight:600;display:flex;align-items:center">Lớp 1 · Dữ kiện</div>
      <div style="flex:1;padding:.6rem;border:1px solid rgba(127,127,127,.28);border-radius:.4rem;font-size:1.02rem;line-height:1.55">Bắt <strong>nội dung sai</strong> — đối chiếu từng mệnh đề kiểm được với nguồn gốc, ghi vào biên bản</div>
    </div>
    <div style="display:flex;gap:.5rem;align-items:stretch">
      <div style="flex:0 0 8.5rem;background:rgba(217,150,40,.85);color:#fff;padding:.6rem;border-radius:.4rem;font-size:1.02rem;font-weight:600;display:flex;align-items:center">Lớp 2 · Thiết kế</div>
      <div style="flex:1;padding:.6rem;border:1px solid rgba(127,127,127,.28);border-radius:.4rem;font-size:1.02rem;line-height:1.55">Bắt <strong>lạc mục tiêu và tải thừa</strong> — rà theo mục tiêu, nguyên tắc mạch lạc và kề nhau</div>
    </div>
    <div style="display:flex;gap:.5rem;align-items:stretch">
      <div style="flex:0 0 8.5rem;background:rgba(13,148,136,.85);color:#fff;padding:.6rem;border-radius:.4rem;font-size:1.02rem;font-weight:600;display:flex;align-items:center">Lớp 3 · Người đọc</div>
      <div style="flex:1;padding:.6rem;border:1px solid rgba(127,127,127,.28);border-radius:.4rem;font-size:1.02rem;line-height:1.55">Bắt <strong>chỗ khó hiểu</strong> — hai người đúng nhóm đối tượng đọc và kể lại</div>
    </div>
  </div>
  <div style="margin:.6rem 0 0;padding:.55rem .8rem;background:rgba(220,38,38,.12);border-left:4px solid rgba(220,38,38,.6);border-radius:0 .35rem .35rem 0;font-size:1.02rem;line-height:1.6">Không lớp nào thay được bằng cách hỏi lại chính mô hình.</div>
</div>
```

## Bảng kiểm trước khi nộp và tiêu chí chấm mốc 2

| # | Hạng mục | Đạt khi |
|---|---|---|
| 1 | Mục tiêu từng trang | Viết bằng động từ hành vi, quan sát được, gắn với chương trình môn học |
| 2 | Nội dung chính xác | Mọi mệnh đề kiểm được đã có dòng tương ứng trong biên bản kiểm chứng |
| 3 | Phù hợp trình độ | Đã thử với hai người đúng nhóm đối tượng, có ghi lại phản hồi |
| 4 | Phần AR có lý do | Mỗi trang có AR nêu được vì sao nội dung ấy cần ba chiều hoặc cần chuyển động |
| 5 | Thiết kế nhận thức | Không có chi tiết trang trí lạc mục tiêu; chú giải nằm sát chi tiết tương ứng |
| 6 | Nhật ký AI | Có đủ bốn phần, trong đó phần bỏ và lý do được viết cụ thể |
| 7 | Nguồn và giấy phép | Mọi nguồn chữ và hình đều ghi rõ, hình có giấy phép cho phép dùng |

| Tiêu chí chấm mốc 2 | Điểm |
|---|---|
| Chất lượng nội dung: chính xác, bám mục tiêu, đúng trình độ | 35 |
| Chất lượng kiểm chứng: biên bản đầy đủ, có phát hiện thật, có sửa tương ứng | 25 |
| Nhật ký AI: cho thấy phán đoán chuyên môn ở phần sửa và bỏ | 20 |
| Chuẩn bị cho AR: lý do dùng AR cho từng trang thuyết phục | 15 |
| Nguồn và giấy phép | 5 |

## Luyện tập và tài liệu tham khảo

### Cá nhân (25 phút)

Chạy bước 1 và bước 2 của quy trình: viết mục tiêu cho bốn trang và khung nội dung, **trước khi mở bất kỳ công cụ AI nào**. Chụp lại bản viết tay hoặc bản gõ đầu tiên này — nó là bằng chứng quá trình cho mốc 2 và cho thấy hướng đi là của bạn.

### Nhóm 3–4 người (30 phút)

Đổi chéo bản thảo một trang với bạn cùng nhóm. Mỗi người chạy lớp kiểm chứng thứ nhất trên bản của người khác: liệt kê mọi mệnh đề kiểm được và đánh dấu cái nào bạn nghi ngờ. So kết quả và đếm: trung bình mỗi trang có bao nhiêu mệnh đề cần kiểm, và bao nhiêu chỗ thật sự sai.

### Bài tập về nhà — mốc 2 của đồ án (150 phút)

Nộp đủ ba sản phẩm của mốc 2 theo đúng bảng ở mục 1.

1. Bản thảo 4 trang, mỗi trang ghi rõ mục tiêu, phần chữ in, phần hiện qua AR, chú giải và nguồn.
2. Nhật ký AI theo mẫu bốn phần, tối thiểu ba mục ghi phần bạn đã bỏ đi kèm lý do chuyên môn.
3. Biên bản kiểm chứng: bảng ba cột mệnh đề — nguồn đối chiếu — kết quả, cộng ghi chú về những chỗ đã sửa sau khi kiểm.
4. Kèm phản hồi của hai người đọc thử và những gì bạn sửa sau đó.

**Cách làm (gợi ý từng bước):** giữ bản thảo trong một tài liệu có đánh số trang rõ ràng để người chấm đối chiếu với nhật ký; ghi nhật ký ngay trong lúc làm, đừng dựng lại từ trí nhớ vào phút chót — người chấm nhận ra ngay; khi kiểm chứng, ưu tiên các mệnh đề mà học sinh sẽ chép vào vở, vì đó là chỗ sai gây hậu quả xa nhất; nếu một trang không nêu được lý do cần AR, hãy đổi nội dung trang đó ngay ở mốc này thay vì chờ tới mốc 5.

**Chấm theo:** áp trực tiếp bảng tiêu chí chấm mốc 2 ở mục 4. Lưu ý hai chỗ trừ điểm nặng: biên bản kiểm chứng không có phát hiện nào (dấu hiệu chưa kiểm thật), và nhật ký không có phần bỏ (dấu hiệu nhận nguyên bản nháp của mô hình).

### Nguồn tham khảo

- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.) — nguyên tắc mạch lạc, kề nhau và chỉ dẫn áp cho trang sách có lớp phủ.
- Perkins, M., Furze, L., Roe, J., & MacVaugh, J. (2024). The AI Assessment Scale. *Journal of University Teaching and Learning Practice*, 21(6).
- UNESCO (2023). *Guidance for generative AI in education and research.*
- Garzón, J., Kinshuk, Baldiris, S., Gutiérrez, J., & Pavón, J. (2020). How do pedagogical approaches affect the impact of augmented reality on education? *Educational Research Review*, 31, 100334.
""",
    "quiz": {
        "title": "Kiểm tra Bài 2.6",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "2.6-ba-san-pham",
                "type": "mcq",
                "prompt": "Mốc 2 của đồ án nộp ba sản phẩm. Sản phẩm nào phân biệt bài tốt với bài trung bình rõ nhất?",
                "explanation": "Nhật ký AI, cụ thể là phần ghi những gì bạn đã bỏ đi và vì sao. Nhật ký chỉ ghi giữ nguyên bản nháp của mô hình tự nó là bằng chứng chưa có phán đoán chuyên môn.",
                "points": 2,
                "options": [
                    {"label": "Nhật ký AI, ở phần ghi những gì đã bỏ đi và lý do chuyên môn", "isCorrect": True},
                    {"label": "Bản thảo, ở mức độ trau chuốt của câu chữ", "isCorrect": False},
                    {"label": "Biên bản kiểm chứng, ở số lượng dòng", "isCorrect": False},
                    {"label": "Cả ba như nhau, chấm theo hình thức trình bày", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-buoc-khong-giao",
                "type": "mcq",
                "prompt": "Hai bước nào trong quy trình đồng soạn gần như không giao được cho mô hình, và vì sao?",
                "explanation": "Bước xác định mục tiêu và người học, và bước chuẩn bị nội dung AR — cả hai đòi thông tin mô hình không có: người học cụ thể của bạn và bố cục vật lý của trang sách.",
                "points": 2,
                "options": [
                    {"label": "Xác định mục tiêu và người học; chuẩn bị nội dung AR cho từng trang", "isCorrect": True},
                    {"label": "Sinh bản nháp; biên tập câu chữ", "isCorrect": False},
                    {"label": "Dựng khung bốn trang; sinh bản nháp", "isCorrect": False},
                    {"label": "Không bước nào: mô hình làm được cả năm bước nếu lời nhắc đủ tốt", "isCorrect": False, "misconception": "cngdtt.prompt-magic"},
                ],
            },
            {
                "key": "2.6-dua-nguon",
                "type": "mcq",
                "prompt": "Cách hiệu quả nhất để sinh bản nháp bám nội dung chuyên môn là gì?",
                "explanation": "Dán chính đoạn tài liệu vào ngữ cảnh, yêu cầu viết lại cho đúng trình độ, và buộc trích dẫn câu nào trong nguồn tương ứng với mỗi ý — chuyển tác vụ từ nhớ lại sang đọc hiểu.",
                "points": 2,
                "options": [
                    {"label": "Dán đoạn tài liệu gốc vào ngữ cảnh và buộc trích dẫn câu nguồn cho từng ý", "isCorrect": True},
                    {"label": "Mô tả chủ đề và để mô hình viết từ hiểu biết sẵn có của nó", "isCorrect": False, "misconception": "cngdtt.llm-knows-truth"},
                    {"label": "Yêu cầu mô hình chỉ viết những gì nó chắc chắn", "isCorrect": False},
                    {"label": "Tăng nhiệt độ để nội dung phong phú hơn", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-ba-lop-kiem-chung",
                "type": "matching",
                "prompt": "Ghép mỗi lớp kiểm chứng với việc phải làm.",
                "explanation": "Ba lớp bắt ba loại lỗi khác nhau: sai dữ kiện, lạc mục tiêu hoặc vi phạm nguyên tắc thiết kế, và khó hiểu với người đọc thật.",
                "points": 3,
                "pairs": [
                    {"left": "Lớp 1", "right": "Đối chiếu từng mệnh đề kiểm được với nguồn gốc và ghi vào biên bản"},
                    {"left": "Lớp 2", "right": "Rà từng trang theo mục tiêu và nguyên tắc mạch lạc, kề nhau"},
                    {"left": "Lớp 3", "right": "Cho hai người đúng nhóm đối tượng đọc và hỏi ba câu chẩn đoán"},
                ],
            },
            {
                "key": "2.6-khong-hoi-lai-mo-hinh",
                "type": "mcq",
                "prompt": "Có thể thay lớp kiểm chứng thứ nhất bằng cách hỏi lại mô hình xem nội dung nó vừa viết có chính xác không không?",
                "explanation": "Không. Đó là dùng chính hệ đã sinh ra lỗi để thẩm định lỗi ấy — mô hình không có cơ chế biết mình không biết, nên câu xác nhận cũng được sinh ra theo cùng cách.",
                "points": 2,
                "options": [
                    {"label": "Không, vì đó là dùng chính hệ đã sinh ra lỗi để thẩm định lỗi ấy", "isCorrect": True},
                    {"label": "Được, nếu hỏi lại bằng một mô hình khác", "isCorrect": False},
                    {"label": "Được, nếu hạ nhiệt độ xuống thấp nhất", "isCorrect": False},
                    {"label": "Được, vì mô hình đánh giá khách quan hơn con người", "isCorrect": False, "misconception": "cngdtt.ai-output-unchecked"},
                ],
            },
            {
                "key": "2.6-cau-hoi-thu-ba",
                "type": "mcq",
                "prompt": "Trong ba câu hỏi dành cho người đọc thử, câu nào phát hiện được nhiều vấn đề nhất và vì sao?",
                "explanation": "Câu yêu cầu kể lại trang này cho bạn — nó cho thấy cái gì thật sự đọng lại, tức là bản thảo đã truyền được ý chính hay chỉ được đọc lướt qua.",
                "points": 2,
                "options": [
                    {"label": "Nếu phải kể lại trang này cho bạn, em sẽ nói gì — vì nó cho thấy cái thật sự đọng lại", "isCorrect": True},
                    {"label": "Em thấy trang này có hay không", "isCorrect": False},
                    {"label": "Chỗ nào em phải đọc lại hai lần", "isCorrect": False},
                    {"label": "Em thích hình minh hoạ nào nhất", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-menh-de-uu-tien",
                "type": "mcq",
                "prompt": "Khi thời gian kiểm chứng có hạn, nên ưu tiên kiểm nhóm mệnh đề nào trước?",
                "explanation": "Những mệnh đề học sinh sẽ chép vào vở — định nghĩa, công thức, số liệu chính. Sai ở đó gây hậu quả xa nhất vì được ghi nhớ và dùng lại.",
                "points": 2,
                "options": [
                    {"label": "Những mệnh đề học sinh sẽ chép vào vở: định nghĩa, công thức, số liệu chính", "isCorrect": True},
                    {"label": "Những câu dẫn nhập và câu chuyển ý", "isCorrect": False},
                    {"label": "Những đoạn dài nhất trong bản thảo", "isCorrect": False},
                    {"label": "Những chỗ mô hình viết trôi chảy nhất", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-trang-khong-can-ar",
                "type": "mcq",
                "prompt": "Một trang trong bản thảo không nêu được lý do vì sao nội dung ấy cần AR. Nên xử lý thế nào ở mốc 2?",
                "explanation": "Đổi nội dung trang đó ngay ở mốc 2. Để tới mốc 5 mới phát hiện thì đã tốn công dựng mô hình cho một trang mà bản thẩm định sẽ chỉ ra là trang trí.",
                "points": 2,
                "options": [
                    {"label": "Đổi nội dung trang đó ngay bây giờ, đừng chờ tới mốc dựng AR", "isCorrect": True},
                    {"label": "Giữ nguyên và thêm hiệu ứng động cho hấp dẫn", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                    {"label": "Giữ nguyên vì mỗi trang đều nên có AR cho đồng đều", "isCorrect": False},
                    {"label": "Chờ tới khi dựng xong mô hình rồi đánh giá lại", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-bang-chung-qua-trinh",
                "type": "mcq",
                "prompt": "Vì sao nên chụp lại bản viết mục tiêu và khung nội dung làm trước khi mở công cụ AI?",
                "explanation": "Đó là bằng chứng quá trình cho thấy hướng đi là của bạn — đúng nguyên tắc thiết kế đánh giá thời AI ở Bài 2.5, và cũng là thứ giúp bản thảo không trôi theo nội dung chung chung.",
                "points": 2,
                "options": [
                    {"label": "Vì nó là bằng chứng quá trình cho thấy mục tiêu và hướng đi do bạn quyết định", "isCorrect": True},
                    {"label": "Vì quy chế bắt buộc nộp bản viết tay", "isCorrect": False},
                    {"label": "Vì mô hình không đọc được chữ viết tay", "isCorrect": False},
                    {"label": "Không cần thiết nếu nhật ký AI đã đầy đủ", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-tru-diem-nang",
                "type": "mcq",
                "prompt": "Hai dấu hiệu nào bị trừ điểm nặng ở mốc 2?",
                "explanation": "Biên bản kiểm chứng không có phát hiện nào (dấu hiệu chưa kiểm thật) và nhật ký không có phần bỏ (dấu hiệu nhận nguyên bản nháp của mô hình).",
                "points": 2,
                "options": [
                    {"label": "Biên bản kiểm chứng không có phát hiện nào, và nhật ký AI không có phần bỏ", "isCorrect": True},
                    {"label": "Bản thảo dài hơn bốn trang, và dùng quá nhiều hình", "isCorrect": False},
                    {"label": "Có dùng AI, và có ghi nhật ký quá chi tiết", "isCorrect": False},
                    {"label": "Người đọc thử không phải học sinh, và bản thảo chưa có mô hình ba chiều", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-muc-do-cho-phep",
                "type": "mcq",
                "prompt": "Mốc 2 tương ứng mức nào trong thang cho phép dùng AI ở Bài 2.5?",
                "explanation": "Mức đồng soạn có kiểm chứng: được dùng mô hình sinh bản nháp, phải nộp nhật ký, và chịu trách nhiệm hoàn toàn về nội dung cuối cùng.",
                "points": 2,
                "options": [
                    {"label": "Mức đồng soạn có kiểm chứng, kèm nghĩa vụ nộp nhật ký", "isCorrect": True},
                    {"label": "Mức không được dùng AI", "isCorrect": False},
                    {"label": "Mức chỉ dùng AI để tìm ý, sản phẩm phải tự viết hoàn toàn", "isCorrect": False},
                    {"label": "Mức lấy đầu ra của AI làm đối tượng nghiên cứu", "isCorrect": False},
                ],
            },
            {
                "key": "2.6-thu-tu-quy-trinh",
                "type": "ordering",
                "prompt": "Sắp xếp năm bước của quy trình đồng soạn theo đúng thứ tự.",
                "explanation": "Mục tiêu và người học đứng trước mọi thứ; nội dung AR quyết sau cùng khi đã biết trang giấy nói gì.",
                "points": 3,
                "sequence": [
                    "Xác định mục tiêu học tập và đặc điểm người học",
                    "Dựng khung bốn trang, quyết định trang nào dạy ý gì",
                    "Sinh bản nháp từng phần dựa trên nguồn đã cung cấp",
                    "Biên tập chuyên môn: sửa thuật ngữ, cắt phần thừa, chỉnh độ khó",
                    "Quyết định phần hiện qua AR cho từng trang và lý do cần ba chiều",
                ],
            },
            {
                "key": "2.6-viet-luan-nhat-ky",
                "type": "essay",
                "prompt": "Viết 250–350 từ mô tả kế hoạch mốc 2 của riêng bạn: bốn trang sẽ dạy gì, bạn sẽ giao phần nào cho mô hình và giữ phần nào, ba mệnh đề nào bạn dự đoán cần kiểm chứng kỹ nhất, và bạn sẽ thử bản thảo với ai.",
                "points": 5,
            },
        ],
    },
}

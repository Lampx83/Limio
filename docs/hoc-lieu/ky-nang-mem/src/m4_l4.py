# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.4 · Ước lượng thời gian và lập lịch",
    "durationMin": 50,
    "description": "Vì sao ai cũng ước lượng thiếu thời gian và hai cách ước lượng sát hơn; sáu bước dựng một lịch chạy được; bốn mẹo tinh chỉnh theo dòng công việc và dòng năng lượng của chính mình.",
    "objectives": [
        "Giải thích được nguỵ biện lập kế hoạch và nhận ra nó trong ước lượng của chính mình",
        "Ước lượng thời gian cho một nhiệm vụ lớn bằng kỹ thuật chia nhỏ từ dưới lên",
        "Dựng được một lịch tuần theo sáu bước, có chừa khoảng đệm",
        "Điều chỉnh lịch theo dòng công việc và dòng năng lượng của bản thân",
    ],
    "summary": [
        "Nguỵ biện lập kế hoạch: người ta ước lượng thiếu thời gian một cách có hệ thống, kể cả khi đã biết lần trước mất bao lâu.",
        "Hai cách ước lượng sát hơn: lấy dữ liệu lần trước làm mốc, và chia nhiệm vụ lớn thành từng phần rồi cộng ước lượng của từng phần.",
        "Sáu bước lập lịch: chọn công cụ và chu kỳ, liệt kê theo ưu tiên, ước lượng thời gian, xếp việc ưu tiên cao trước, xếp việc còn lại, chừa chỗ cho phát sinh.",
        "Lịch là văn bản sống: sửa được, nhưng phải sửa có chủ đích theo ưu tiên chứ không sửa vì bị phân tâm.",
    ],
    "splitSections": True,
    "body": r"""
Bài 4.3 cho bạn khối tập trung. Bài này trả lời câu hỏi đứng ngay trước đó: **mỗi việc mất bao lâu, và xếp chúng vào đâu trong tuần.** Sai ở khâu này thì mọi kỹ thuật tập trung phía sau đều vô dụng — bạn giữ được khung giờ, nhưng khung giờ ấy quá ngắn cho việc đã hẹn.

## Vì sao ai cũng ước lượng thiếu

Kahneman và Tversky đặt tên cho hiện tượng này từ năm 1979: **nguỵ biện lập kế hoạch** — con người thường xuyên ước lượng thiếu thời gian cần cho một nhiệm vụ. Điểm gây khó chịu nhất của nó: **biết lần trước mất bao lâu vẫn không chữa được**. Ta vẫn tin lần này sẽ khác, vì lần này ta sẽ tập trung hơn, có kinh nghiệm hơn, gặp ít trục trặc hơn.

> [!vi-du] Lần trước, Quyên mất trọn ba ngày để tìm và đọc tài liệu cho một bài tổng quan. Lần này bạn nghĩ: mình đã biết cách tìm rồi, hai ngày là đủ — và xếp lịch hai ngày. Thực tế lại mất gần ba ngày, và phần trễ ấy đổ dây chuyền sang mọi việc khác trong tuần. Chỗ hỏng không nằm ở kỹ năng tìm tài liệu; nó nằm ở chỗ Quyên **đã có dữ liệu thật là ba ngày** nhưng lại dùng cảm giác lạc quan thay cho dữ liệu ấy.

Hệ quả của việc ước lượng thiếu không dừng ở một việc: bạn lấy trộm thời gian của các việc khác trong ngày, trễ hạn, và phá vỡ cam kết với người khác.

## Hai cách ước lượng sát hơn

**Cách 1 — Lấy dữ liệu lần trước làm mốc.** Việc này hoặc việc tương tự, lần gần nhất mất bao lâu? Lấy đúng con số đó. Chỉ rút ngắn khi bạn chỉ ra được **cụ thể** cách làm nào đã đổi — và ngay cả khi ấy, rút vừa phải. Chưa từng làm việc này bao giờ thì hỏi người đã làm.

**Cách 2 — Chia nhỏ từ dưới lên.** Dùng cho nhiệm vụ lớn: (1) liệt kê từng phần việc, (2) ước lượng từng phần, (3) cộng lại.

| Phần việc của một đồ án tốt nghiệp | Ước lượng |
|---|---|
| Tìm và đọc tài liệu | 20 giờ |
| Thiết kế nghiên cứu, chọn phương pháp | 15 giờ |
| Thu thập dữ liệu, mời người tham gia | 10 giờ |
| Phân tích dữ liệu | 25 giờ |
| Viết và sửa | 20 giờ |
| **Tổng** | **90 giờ** |

Con số 90 giờ nói lên một điều mà "làm đồ án" không nói: nếu còn 9 tuần thì cần **trung bình 10 giờ mỗi tuần**, đều đặn — và nếu tuần này bạn dành được 2 giờ thì bạn đã nợ 8 giờ, chứ không phải "vẫn còn thời gian".

Dù dùng cách nào, hỏi thêm bốn câu trước khi chốt: **Có gì có thể trục trặc không? Phần nào mình chưa chắc chắn? Tuần đó mình còn việc gì khác? Việc này có phụ thuộc vào ai không** — nếu có, họ đang bận gì? Câu cuối là câu hay bị bỏ nhất và cũng là nguyên nhân trễ hạn phổ biến nhất trong bài tập nhóm.

> [!meo] Với phần việc bạn thấy mơ hồ hoặc phụ thuộc người khác, cộng thêm một khoản dự phòng thay vì hy vọng. Ước lượng đúng mà trễ vì một khâu ngoài tầm tay vẫn là một lịch vỡ.

## Sáu bước dựng một lịch chạy được

Ba nguyên tắc nền trước đã: **nhất quán** (một công cụ duy nhất, cập nhật ngay khi có thay đổi), **tập trung** (xếp việc ưu tiên cao trước, đừng cố nhét mọi thứ), **thực tế** (bốn giờ làm việc sâu liên tục là không tưởng — hãy xếp cả giờ nghỉ vào lịch).

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="display:grid;gap:.4rem;font-size:1.05rem">
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.55rem .8rem"><b>1 · Chọn công cụ và chu kỳ</b> — sổ giấy hay lịch điện tử đều được; chọn lịch tuần hay lịch ngày, rồi giữ nguyên lựa chọn đó</div>
    <div style="background:rgba(13,148,136,.14);border-radius:.4rem;padding:.55rem .8rem"><b>2 · Liệt kê rồi xếp theo ưu tiên</b> — viết hết ra trước, sau đó mới xếp bằng ma trận ở bài 4.2</div>
    <div style="background:rgba(139,92,246,.14);border-radius:.4rem;padding:.55rem .8rem"><b>3 · Ước lượng thời gian từng việc</b> — dùng dữ liệu lần trước hoặc chia nhỏ từ dưới lên</div>
    <div style="background:rgba(217,150,40,.16);border:2px solid rgba(217,150,40,.55);border-radius:.4rem;padding:.55rem .8rem"><b>4 · Đặt việc ưu tiên cao vào lịch trước</b> — và đặt vào <b>đầu ngày</b>, trước khi các yêu cầu khác ập tới</div>
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.55rem .8rem"><b>5 · Xếp việc ưu tiên thấp vào phần còn lại</b> — không đủ chỗ thì hỏi: việc này có cần làm tuần này không, hoãn được không, có cần làm không</div>
    <div style="background:rgba(13,148,136,.14);border-radius:.4rem;padding:.55rem .8rem"><b>6 · Chừa chỗ cho phát sinh</b> — đệm 15 phút giữa các khối, và một giờ trống mỗi ngày cho việc không lường trước</div>
  </div>
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);margin-top:.8rem;line-height:1.6">Bước 6 là bước hay bị cắt nhất và cũng là bước quyết định lịch có sống nổi qua thứ tư hay không.</div>
</div>
```

> [!canh-bao] **Đừng giữ hai cuốn lịch** — một cho việc học, một cho việc riêng. Hai lịch thì không nơi nào cho thấy bức tranh đầy đủ, và bạn sẽ nhận một buổi họp lúc 17h30 rồi mới nhớ ra 18h phải đón em. Mọi cam kết vào chung một chỗ.

## Bốn mẹo tinh chỉnh

- **Tô màu theo loại việc.** Học trên lớp một màu, tự học một màu, làm thêm một màu. Nhìn một cái là biết tuần này lệch về đâu — thứ mà một danh sách chữ không cho thấy.
- **Đặt chủ đề cho từng ngày.** Thứ hai cho đọc tài liệu, thứ tư cho viết, thứ sáu cho việc nhóm. Gom việc cùng loại vào một ngày giảm số lần chuyển ngữ cảnh — đúng vấn đề đã nói ở bài 4.3.
- **Xếp theo dòng công việc và dòng năng lượng.** *Dòng công việc*: đừng cắt một việc đang trôi làm hai buổi cách nhau ba ngày, vì lần sau bạn mất thời gian nhớ lại mình đang ở đâu. *Dòng năng lượng*: đặt việc nặng vào lúc bạn tỉnh nhất, và đặt việc nhẹ như đọc tài liệu vào khoảng uể oải sau bữa trưa hoặc sau một buổi học dài.
- **Dựng thói quen cho việc lặp lại.** Cùng một khung giờ mỗi tuần cho cùng một loại việc. Thói quen chạy mà không tốn công quyết định — đó là lý do nó rẻ hơn mọi hệ thống phức tạp.

Cuối cùng: **lịch là văn bản sống**. Nó phản ánh những gì bạn biết tại thời điểm lập, và thông tin mới thì luôn xuất hiện. Sửa lịch là chuyện bình thường — miễn là sửa vì **ưu tiên đã đổi**, không phải vì bạn vừa bị một thứ hấp dẫn hơn kéo đi. Một thói quen nhỏ giữ được ranh giới ấy: **mở lịch ra xem trước khi nhận bất kỳ cam kết mới nào.**

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Chọn một nhiệm vụ lớn bạn đang có (đồ án, báo cáo thực tập, bài tập nhóm). Ước lượng bằng **cả hai cách**: lấy mốc từ lần trước, và chia nhỏ từ dưới lên. So hai con số. Nếu chênh nhau nhiều, ghi rõ vì sao. Sau đó chia tổng số giờ cho số tuần còn lại và viết ra con số giờ mỗi tuần — rồi đối chiếu với lịch tuần này của bạn.

### Nhóm 3–4 người (25 phút)

Mỗi người nêu một nhiệm vụ và ước lượng của mình. Nhóm chất vấn bằng đúng bốn câu hỏi kiểm: có gì trục trặc được, phần nào chưa chắc, tuần đó còn việc gì, có phụ thuộc ai không. Sau khi chất vấn, người nêu được sửa lại ước lượng. Cuối buổi thống kê: có bao nhiêu người phải **tăng** ước lượng sau khi bị hỏi, và trung bình tăng bao nhiêu phần trăm.

### Bài tập về nhà (45–60 phút)

Dựng lịch tuần tới theo đủ sáu bước, trên **một** công cụ duy nhất chứa cả việc học lẫn việc riêng, có tô màu và có đệm. Cuối tuần đối chiếu và viết nửa trang: bao nhiêu phần trăm khối giờ diễn ra đúng như lịch; việc nào bị ước lượng thiếu và thiếu bao nhiêu; bạn sẽ đổi gì ở lịch tuần sau — nêu đúng một thay đổi, không nêu năm cái rồi không làm cái nào.

### Xem thêm

- 🎬 [Inside the Mind of a Master Procrastinator](https://www.youtube.com/watch?v=arj7oStGLkU) — Tim Urban, TED, 14 phút.
- 🎬 [How to Gain Control of Your Free Time](https://www.youtube.com/watch?v=n3kNlFMXslo) — Laura Vanderkam, TED, 11 phút.

### Nguồn tham khảo

- Kahneman, D., & Tversky, A. (1979). Intuitive prediction: Biases and corrective procedures. *TIMS Studies in Management Science*, 12(1), 313–327.
- Buehler, R., Griffin, D., & Ross, M. (1994). Exploring the planning fallacy. *Journal of Personality and Social Psychology*, 67(3), 366–381.
- LEAP Online (2025). *Time Management.* University of Greater Manchester — sáu bước lập lịch, ước lượng từ dưới lên và bốn mẹo tinh chỉnh trong bài này theo tài liệu hướng dẫn dành cho sinh viên.
- Parker, K. (2017). *Essential Time Management and Study Skills for Students.* London: SAGE.
- Covey, S. R., Merrill, A. R., & Merrill, R. R. (1994). *First Things First.* New York: Simon & Schuster.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4.4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.4-planning-fallacy",
                "type": "mcq",
                "prompt": "Lần trước việc tìm tài liệu mất của bạn ba ngày. Lần này bạn xếp lịch hai ngày vì nghĩ mình đã có kinh nghiệm. Đây là biểu hiện của điều gì?",
                "explanation": "Nguỵ biện lập kế hoạch: người ta ước lượng thiếu thời gian một cách có hệ thống, kể cả khi đã có dữ liệu thật từ lần trước.",
                "points": 2,
                "options": [
                    {"label": "Nguỵ biện lập kế hoạch — ước lượng thiếu dù đã có dữ liệu thật từ lần trước", "isCorrect": True},
                    {"label": "Tư duy phát triển — tin rằng năng lực của mình đã tăng lên", "isCorrect": False, "misconception": "knm.planning-fallacy"},
                    {"label": "Đặt mục tiêu thách thức để tạo áp lực tích cực", "isCorrect": False, "misconception": "knm.planning-fallacy"},
                    {"label": "Ưu tiên theo ma trận Eisenhower", "isCorrect": False},
                ],
            },
            {
                "key": "4.4-bottom-up",
                "type": "mcq",
                "prompt": "Bạn phải làm một đồ án lớn và không biết ước lượng bao nhiêu giờ. Cách làm phù hợp nhất là gì?",
                "explanation": "Chia nhỏ từ dưới lên: liệt kê từng phần việc, ước lượng từng phần rồi cộng lại — sau đó chia cho số tuần còn lại để ra khối lượng mỗi tuần.",
                "points": 2,
                "options": [
                    {"label": "Liệt kê từng phần việc, ước lượng từng phần rồi cộng lại, sau đó chia cho số tuần còn lại", "isCorrect": True},
                    {"label": "Ước lượng tổng thể theo cảm giác rồi trừ đi vì lần này mình sẽ tập trung hơn", "isCorrect": False, "misconception": "knm.planning-fallacy"},
                    {"label": "Không ước lượng, cứ làm tới đâu hay tới đó", "isCorrect": False, "misconception": "knm.no-time-to-plan"},
                    {"label": "Lấy thời gian của bạn cùng lớp làm chuẩn cho mình", "isCorrect": False, "misconception": "knm.compare-upward"},
                ],
            },
            {
                "key": "4.4-sau-buoc",
                "type": "ordering",
                "prompt": "Sắp xếp sáu bước dựng lịch theo đúng trình tự.",
                "explanation": "Chọn công cụ trước, liệt kê và xếp ưu tiên, ước lượng thời gian, đặt việc quan trọng vào lịch trước, rồi mới tới việc nhẹ, và cuối cùng chừa chỗ cho phát sinh.",
                "points": 3,
                "sequence": [
                    "Chọn công cụ và chu kỳ lịch",
                    "Liệt kê mọi việc rồi xếp theo ưu tiên",
                    "Ước lượng thời gian cần cho từng việc",
                    "Đặt việc ưu tiên cao vào lịch trước, ưu tiên đầu ngày",
                    "Xếp việc ưu tiên thấp vào phần thời gian còn lại",
                    "Chừa khoảng đệm và thời gian trống cho việc phát sinh",
                ],
            },
            {
                "key": "4.4-buffer",
                "type": "mcq",
                "prompt": "Vì sao nên chừa khoảng đệm giữa các khối công việc trong lịch?",
                "explanation": "Ước lượng không bao giờ chính xác tuyệt đối; một việc trễ hai mươi phút mà không có đệm sẽ đổ dây chuyền sang cả ngày và làm người ta bỏ luôn lịch.",
                "points": 2,
                "options": [
                    {"label": "Vì việc thường kéo dài hơn dự kiến; không có đệm thì một việc trễ sẽ làm đổ cả phần còn lại của ngày", "isCorrect": True},
                    {"label": "Vì lịch kín chứng tỏ mình làm việc kém hiệu quả", "isCorrect": False},
                    {"label": "Vì cần thời gian trống để trả lời tin nhắn ngay khi có", "isCorrect": False, "misconception": "knm.always-available"},
                    {"label": "Không cần đệm, xếp kín mới tận dụng hết thời gian", "isCorrect": False, "misconception": "knm.schedule-no-buffer"},
                ],
            },
            {
                "key": "4.4-mot-lich",
                "type": "mcq",
                "prompt": "Vì sao nên giữ cả việc học lẫn việc cá nhân trong cùng một cuốn lịch?",
                "explanation": "Hai lịch riêng thì không nơi nào cho thấy bức tranh đầy đủ, dễ trùng lịch và dễ nhận thêm cam kết vào khung giờ đã có việc.",
                "points": 2,
                "options": [
                    {"label": "Vì chỉ một chỗ duy nhất mới cho thấy bức tranh đầy đủ, tránh trùng lịch và tránh nhận thêm việc vào khung đã bận", "isCorrect": True},
                    {"label": "Vì việc cá nhân cũng cần được đánh giá theo hiệu suất", "isCorrect": False},
                    {"label": "Vì như vậy tiết kiệm chi phí mua công cụ", "isCorrect": False},
                    {"label": "Nên tách riêng để việc học không bị việc cá nhân làm phiền", "isCorrect": False, "misconception": "knm.two-calendars"},
                ],
            },
            {
                "key": "4.4-energy-flow",
                "type": "matching",
                "prompt": "Nối mỗi mẹo tinh chỉnh lịch với lý do nó hiệu quả.",
                "explanation": "Mỗi mẹo giải quyết một vấn đề khác nhau: nhìn nhanh, giảm chuyển ngữ cảnh, tận dụng lúc tỉnh táo, và giảm chi phí ra quyết định.",
                "points": 3,
                "pairs": [
                    {"left": "Tô màu theo loại việc", "right": "Nhìn một cái là biết tuần này đang lệch về đâu"},
                    {"left": "Đặt chủ đề cho từng ngày", "right": "Gom việc cùng loại, giảm số lần chuyển ngữ cảnh"},
                    {"left": "Xếp việc nặng vào lúc tỉnh táo nhất", "right": "Tận dụng dòng năng lượng tự nhiên trong ngày"},
                    {"left": "Dựng thói quen cho việc lặp lại", "right": "Chạy được mà không tốn công quyết định mỗi lần"},
                ],
            },
            {
                "key": "4.4-sua-lich",
                "type": "mcq",
                "prompt": "Giữa tuần, một cơ hội hấp dẫn xuất hiện đúng vào khung giờ bạn đã dành cho đồ án. Cách xử lý phù hợp là gì?",
                "explanation": "Lịch sửa được nhưng phải sửa có chủ đích: mở lịch ra xem trước khi nhận cam kết mới, và nếu nhận thì phải dời việc cũ đi đâu chứ không xoá nó khỏi tuần.",
                "points": 3,
                "options": [
                    {"label": "Mở lịch xem trước khi trả lời; nếu nhận thì dời khối đồ án sang một khung cụ thể khác trong tuần chứ không bỏ trống", "isCorrect": True},
                    {"label": "Nhận ngay vì cơ hội không đến hai lần, đồ án tính sau", "isCorrect": False, "misconception": "knm.urgent-equals-important"},
                    {"label": "Từ chối mọi thay đổi vì lịch đã lập là bất di bất dịch", "isCorrect": False},
                    {"label": "Nhận và cố làm cả hai bằng cách rút ngắn giờ ngủ", "isCorrect": False, "misconception": "knm.busy-equals-productive"},
                ],
            },
            {
                "key": "4.4-viet-uoc-luong",
                "type": "essay",
                "prompt": "Chọn một nhiệm vụ lớn bạn đang có. Viết 200–300 từ: (a) ước lượng bằng cách lấy mốc từ lần trước; (b) ước lượng bằng cách chia nhỏ từ dưới lên, liệt kê từng phần và số giờ; (c) so hai con số và giải thích chênh lệch; (d) chia tổng số giờ cho số tuần còn lại và đối chiếu với lịch tuần này của bạn — nếu không khớp thì bạn định bỏ bớt việc gì.",
                "points": 5,
            },
        ],
    },
}

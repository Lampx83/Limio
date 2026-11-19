# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.4 · Ước lượng thời gian và lập lịch",
    "durationMin": 50,
    "description": "Bài học giải thích vì sao ai cũng có xu hướng ước lượng thiếu thời gian, giới thiệu hai cách ước lượng sát hơn, hướng dẫn sáu bước dựng một lịch chạy được và bốn mẹo tinh chỉnh lịch theo dòng công việc và dòng năng lượng của chính mình.",
    "objectives": [
        "Giải thích được sai lệch lập kế hoạch và nhận ra biểu hiện của nó trong ước lượng của chính mình",
        "Ước lượng được thời gian cho một nhiệm vụ lớn bằng kỹ thuật chia nhỏ từ dưới lên",
        "Xây dựng được một lịch tuần theo sáu bước, có chừa khoảng đệm",
        "Điều chỉnh được lịch theo dòng công việc và dòng năng lượng của bản thân",
    ],
    "summary": [
        "Theo hiện tượng gọi là sai lệch lập kế hoạch, con người ước lượng thiếu thời gian một cách có hệ thống, kể cả khi đã biết lần trước việc đó mất bao lâu.",
        "Có hai cách ước lượng sát hơn: lấy dữ liệu của lần làm trước làm mốc, hoặc chia nhiệm vụ lớn thành từng phần rồi cộng ước lượng của từng phần.",
        "Lịch được dựng qua sáu bước: chọn công cụ và chu kỳ, liệt kê việc theo ưu tiên, ước lượng thời gian, xếp việc ưu tiên cao trước, xếp việc còn lại, và chừa chỗ cho việc phát sinh.",
        "Lịch là một văn bản sống: bạn có thể sửa lịch, nhưng phải sửa có chủ đích theo ưu tiên chứ không sửa vì bị phân tâm.",
    ],
    "splitSections": True,
    "body": r"""
Bài 4.3 đã giúp bạn có các khối thời gian tập trung. Bài này trả lời câu hỏi cần được giải quyết trước khi xếp các khối ấy: **mỗi việc mất bao lâu và nên xếp vào đâu trong tuần.** Nếu sai ở khâu này thì mọi kỹ thuật tập trung phía sau đều kém tác dụng, vì bạn giữ được khung giờ nhưng khung giờ ấy lại quá ngắn cho việc đã hẹn.

## Vì sao ai cũng ước lượng thiếu

Hiện tượng này được Kahneman và Tversky đặt tên là **sai lệch lập kế hoạch** (*planning fallacy*; Kahneman & Tversky, 1979), tức xu hướng thường xuyên ước lượng thiếu thời gian cần cho một nhiệm vụ. Điều đáng lưu ý nhất là **biết lần trước mất bao lâu vẫn chưa đủ để khắc phục xu hướng này** (Buehler và cộng sự, 1994). Chúng ta vẫn tin lần này sẽ khác, vì lần này chúng ta sẽ tập trung hơn, có kinh nghiệm hơn và gặp ít trục trặc hơn.

> [!vi-du] Lần trước, Quyên mất trọn ba ngày để tìm và đọc tài liệu cho một bài tổng quan. Lần này, Quyên nghĩ rằng mình đã biết cách tìm nên hai ngày là đủ, và xếp lịch hai ngày. Thực tế vẫn mất gần ba ngày, và phần trễ ấy đổ dây chuyền sang các việc khác trong tuần. Chỗ hỏng không nằm ở kỹ năng tìm tài liệu mà nằm ở việc Quyên **đã có dữ liệu thật là ba ngày** nhưng lại dùng cảm giác lạc quan thay cho dữ liệu ấy.

Hệ quả của việc ước lượng thiếu không dừng lại ở một việc: bạn lấy bớt thời gian của các việc khác trong ngày, trễ hạn và phá vỡ cam kết với người khác.

## Hai cách ước lượng sát hơn

**Cách 1: lấy dữ liệu lần trước làm mốc.** Bạn tự hỏi việc này, hoặc một việc tương tự, lần gần nhất đã mất bao lâu, rồi dùng đúng con số đó. Bạn chỉ rút ngắn con số ấy khi chỉ ra được **cụ thể** cách làm nào đã thay đổi, và ngay cả khi đó cũng chỉ nên rút ngắn vừa phải. Nếu chưa từng làm việc này, bạn nên hỏi người đã làm.

**Cách 2: chia nhỏ từ dưới lên** (ước lượng từ dưới lên, *bottom-up estimation*; LEAP Online, 2025). Cách này dùng cho nhiệm vụ lớn và gồm ba bước: (1) liệt kê từng phần việc, (2) ước lượng từng phần, (3) cộng các ước lượng lại.

| Phần việc của một đồ án tốt nghiệp | Ước lượng |
|---|---|
| Tìm và đọc tài liệu | 20 giờ |
| Thiết kế nghiên cứu, chọn phương pháp | 15 giờ |
| Thu thập dữ liệu, mời người tham gia | 10 giờ |
| Phân tích dữ liệu | 25 giờ |
| Viết và sửa | 20 giờ |
| **Tổng** | **90 giờ** |

Con số 90 giờ cho thấy một điều mà cụm “làm đồ án” không cho thấy: nếu còn 9 tuần thì bạn cần **trung bình 10 giờ mỗi tuần** và phải làm đều đặn. Nếu tuần này chỉ dành được 2 giờ thì bạn đã nợ 8 giờ chứ không phải “vẫn còn thời gian”.

Dù dùng cách nào, bạn cũng nên tự hỏi thêm bốn câu trước khi chốt ước lượng: **Có gì có thể trục trặc không? Phần nào mình chưa chắc chắn? Tuần đó mình còn việc gì khác? Việc này có phụ thuộc vào ai không?** Nếu có, người đó đang bận việc gì? Câu cuối thường bị bỏ qua nhất và là một nguyên nhân phổ biến gây trễ hạn trong bài tập nhóm.

> [!meo] Với phần việc mơ hồ hoặc phụ thuộc người khác, bạn nên cộng thêm một khoản dự phòng thay vì chỉ hy vọng mọi thứ suôn sẻ. Một ước lượng đúng nhưng bị trễ vì một khâu ngoài tầm kiểm soát vẫn có thể làm vỡ cả lịch.

## Sáu bước dựng một lịch chạy được

Trước hết cần nắm ba nguyên tắc nền (LEAP Online, 2025). Nguyên tắc **nhất quán** đòi hỏi dùng một công cụ duy nhất và cập nhật ngay khi có thay đổi. Nguyên tắc **tập trung** đòi hỏi xếp việc ưu tiên cao trước và không cố nhét mọi thứ vào lịch. Nguyên tắc **thực tế** lưu ý rằng làm việc sâu liên tục bốn giờ là điều rất khó thực hiện, nên bạn cần xếp cả giờ nghỉ vào lịch.

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="display:grid;gap:.4rem;font-size:1.05rem">
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.55rem .8rem"><b>1 · Chọn công cụ và chu kỳ</b> — sổ giấy hay lịch điện tử đều được; chọn lịch tuần hay lịch ngày, rồi giữ nguyên lựa chọn đó</div>
    <div style="background:rgba(13,148,136,.14);border-radius:.4rem;padding:.55rem .8rem"><b>2 · Liệt kê rồi xếp theo ưu tiên</b> — viết hết ra trước, sau đó mới xếp bằng ma trận ở bài 4.2</div>
    <div style="background:rgba(139,92,246,.14);border-radius:.4rem;padding:.55rem .8rem"><b>3 · Ước lượng thời gian từng việc</b> — dùng dữ liệu lần trước hoặc chia nhỏ từ dưới lên</div>
    <div style="background:rgba(217,150,40,.16);border:2px solid rgba(217,150,40,.55);border-radius:.4rem;padding:.55rem .8rem"><b>4 · Đặt việc ưu tiên cao vào lịch trước</b> — và đặt vào <b>đầu ngày</b>, trước khi các yêu cầu khác ập tới</div>
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.55rem .8rem"><b>5 · Xếp việc ưu tiên thấp vào phần còn lại</b> — không đủ chỗ thì hỏi: việc này có cần làm tuần này không, hoãn được không, hay có thể bỏ hẳn không</div>
    <div style="background:rgba(13,148,136,.14);border-radius:.4rem;padding:.55rem .8rem"><b>6 · Chừa chỗ cho phát sinh</b> — đệm 15 phút giữa các khối, và một giờ trống mỗi ngày cho việc không lường trước</div>
  </div>
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);margin-top:.8rem;line-height:1.6">Bước 6 là bước hay bị cắt nhất và cũng là bước quyết định lịch có sống nổi qua thứ tư hay không.</div>
</div>
```

> [!canh-bao] **Bạn không nên giữ hai cuốn lịch**, một cho việc học và một cho việc riêng. Khi có hai lịch, không nơi nào cho thấy bức tranh đầy đủ, nên bạn có thể nhận một buổi họp lúc 17h30 rồi mới nhớ ra 18h phải đón em. Hãy đưa mọi cam kết vào chung một chỗ.

## Bốn mẹo tinh chỉnh

Bốn mẹo dưới đây giúp tinh chỉnh một lịch đã dựng xong (LEAP Online, 2025).

- **Tô màu theo loại việc.** Bạn dùng một màu cho học trên lớp, một màu cho tự học và một màu cho làm thêm. Chỉ cần nhìn qua là biết tuần này đang lệch về loại việc nào, điều mà một danh sách chữ không cho thấy.
- **Đặt chủ đề cho từng ngày.** Chẳng hạn, thứ hai dành cho đọc tài liệu, thứ tư dành cho viết và thứ sáu dành cho việc nhóm. Việc gom các việc cùng loại vào một ngày làm giảm số lần chuyển ngữ cảnh, đúng với vấn đề đã nêu ở bài 4.3.
- **Xếp theo dòng công việc và dòng năng lượng.** *Dòng công việc* nghĩa là bạn không nên cắt một việc đang trôi chảy thành hai buổi cách nhau ba ngày, vì lần sau bạn mất thời gian nhớ lại mình đang ở đâu. *Dòng năng lượng* nghĩa là bạn đặt việc nặng vào lúc tỉnh táo nhất và đặt việc nhẹ như đọc tài liệu vào khoảng uể oải sau bữa trưa hoặc sau một buổi học dài.
- **Dựng thói quen cho việc lặp lại.** Bạn dùng cùng một khung giờ mỗi tuần cho cùng một loại việc. Thói quen vận hành mà không tốn công ra quyết định, và đó là lý do nó ít tốn kém hơn các hệ thống phức tạp.

Cuối cùng, cần nhớ rằng **lịch là một văn bản sống**: nó phản ánh những gì bạn biết tại thời điểm lập, và thông tin mới luôn xuất hiện sau đó. Việc sửa lịch là bình thường, miễn là bạn sửa vì **ưu tiên đã thay đổi** chứ không phải vì vừa bị một thứ hấp dẫn hơn kéo đi. Một thói quen nhỏ giúp giữ ranh giới ấy là **mở lịch ra xem trước khi nhận bất kỳ cam kết mới nào.**

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
                "explanation": "Sai lệch lập kế hoạch: người ta ước lượng thiếu thời gian một cách có hệ thống, kể cả khi đã có dữ liệu thật từ lần trước.",
                "points": 2,
                "options": [
                    {"label": "Sai lệch lập kế hoạch — ước lượng thiếu dù đã có dữ liệu thật từ lần trước", "isCorrect": True},
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

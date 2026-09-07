# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.3 · Đánh giá nguồn và thông tin trong thời AI",
    "durationMin": 50,
    "description": "Đọc ngang thay vì đọc dọc để thẩm định một nguồn; đọc một con số cho đúng; vì sao câu trả lời trôi chảy của AI không đồng nghĩa với đúng; và quy trình bốn bước trước khi chia sẻ.",
    "objectives": [
        "Thẩm định được một nguồn lạ bằng kỹ thuật đọc ngang trong dưới ba phút",
        "Nêu được bốn câu hỏi cần đặt cho một con số hoặc một biểu đồ",
        "Chỉ ra được vì sao độ trôi chảy của câu trả lời do AI sinh không phải dấu hiệu chính xác",
        "Chạy được quy trình bốn bước trước khi chia sẻ một thông tin",
    ],
    "summary": [
        "Người kiểm chứng chuyên nghiệp không đọc kỹ trang lạ; họ rời trang, xem nơi khác nói gì về nó, rồi mới quay lại — đó là đọc ngang.",
        "Bốn câu hỏi cho mọi con số: đo trên bao nhiêu người, so với nhóm nào, ai trả tiền cho nghiên cứu, và trục biểu đồ bắt đầu từ đâu.",
        "Mô hình ngôn ngữ tối ưu cho tính hợp lý bề mặt chứ không cho tính đúng, nên nó bịa được cả tên tác giả, năm và số trang mà vẫn đọc rất xuôi.",
        "Bốn bước trước khi chia sẻ: dừng lại, tìm nguồn gốc, xem nơi khác nói gì, và hỏi mình đang muốn nó đúng tới mức nào.",
    ],
    "body": r"""
Hai bài trước xử lý lập luận. Bài này xử lý **nguồn**: làm sao biết một thông tin có đáng để đưa vào đầu, trong một môi trường mà bất kỳ ai cũng xuất bản được và bất kỳ nội dung nào cũng tạo ra được bằng máy trong vài giây.

## Đọc ngang thay vì đọc dọc

Nhóm nghiên cứu của Sam Wineburg ở Stanford cho ba nhóm cùng thẩm định các trang web: sinh viên đại học, giáo sư sử học, và những người kiểm chứng chuyên nghiệp. Sinh viên và cả giáo sư đọc **dọc** — ở lại trên trang, xem giao diện, đọc mục giới thiệu, đánh giá giọng văn. Người kiểm chứng làm ngược lại: chỉ liếc qua vài giây rồi **rời trang**, mở tab mới, tìm xem nơi khác nói gì về tổ chức ấy, rồi mới quay lại. Nhóm thứ ba nhanh hơn hẳn và ít bị lừa hơn hẳn.

| | Đọc dọc (thường làm) | Đọc ngang (nên làm) |
|---|---|---|
| Ở đâu | Ở lại trên chính trang đó | Mở tab mới, tìm nơi khác nói về nó |
| Dựa vào gì | Giao diện, mục Về chúng tôi, giọng văn, có trích dẫn hay không | Nguồn độc lập nói gì về tổ chức và tác giả này |
| Vì sao hỏng hoặc chạy | Mọi thứ trên trang đều do chính họ viết ra | Đánh giá đến từ bên ngoài, khó dàn dựng hơn |

Quy trình gọn được đặt tên là **SIFT**: *Stop* (dừng lại), *Investigate the source* (tìm hiểu nguồn), *Find better coverage* (tìm bản đưa tin tốt hơn), *Trace claims* (lần về tuyên bố gốc). Bốn bước ấy mất chừng hai tới ba phút.

> [!vi-du] Trên nhóm lớp có bài đăng: "Nghiên cứu mới cho thấy sinh viên dùng AI làm bài giảm 20% khả năng ghi nhớ." Đọc dọc: bài viết có trích dẫn, có tên trường đại học, trông đáng tin. Đọc ngang: mở tab mới, gõ tên "nghiên cứu" đó — hoá ra là một bản tóm tắt trên blog của một công ty bán khoá học, dẫn lại một bài báo mà bài báo ấy nói về 34 sinh viên trong một buổi thí nghiệm, không hề đo trí nhớ sau vài tuần. Tuyên bố không sai hoàn toàn, nhưng đã bị kéo giãn qua ba lần dẫn lại.

## Đọc một con số cho đúng

Con số làm người ta tin nhanh hơn chữ, nên nó cũng là chỗ bị lạm dụng nhiều nhất. Bốn câu hỏi đủ cho phần lớn tình huống:

1. **Đo trên bao nhiêu người, và họ là ai?** 34 sinh viên tình nguyện của một trường khác hẳn 3.400 người chọn ngẫu nhiên.
2. **So với nhóm nào?** "Tăng 40%" luôn phải kèm "so với cái gì". Không có nhóm đối chứng thì không có kết luận về hiệu quả.
3. **Ai trả tiền và ai công bố?** Nghiên cứu do nhà cung cấp tài trợ vẫn dùng được, nhưng đọc như một lập luận có lợi ích, không phải một kết luận trung lập.
4. **Trục của biểu đồ bắt đầu từ đâu?** Cắt trục tung là cách rẻ nhất để biến một chênh lệch 2% thành một cột cao gấp đôi.

Và một quy tắc bao trùm: **tương quan không phải nhân quả**. Trước khi kết luận A gây ra B, phải loại ba khả năng: B gây ra A; một yếu tố C gây ra cả hai; và trùng hợp ngẫu nhiên. Sinh viên dùng ứng dụng học tập có điểm cao hơn — cũng có thể vì người vốn chăm mới chịu cài ứng dụng.

> [!canh-bao] Chú ý cách diễn đạt "gấp đôi nguy cơ" hoặc "tăng 50%". Nếu nguy cơ ban đầu là 2 phần nghìn thì gấp đôi thành 4 phần nghìn — đúng về mặt số học và gần như vô nghĩa về mặt thực tế. Luôn hỏi con số tuyệt đối.

## Nội dung do AI sinh: trôi chảy không bằng đúng

Mô hình ngôn ngữ được tối ưu để sinh ra văn bản **nghe hợp lý**, không phải để sinh ra văn bản **đúng**. Hệ quả trực tiếp: khi mô hình không biết, nó không im lặng — nó viết tiếp bằng thứ trông giống câu trả lời nhất. Đó là lý do các trích dẫn bịa thường rất chỉnh: có tên tác giả thật, tạp chí thật, năm hợp lý, số trang cụ thể, và không tồn tại.

Ba thói quen tối thiểu khi dùng AI cho việc học:

- **Mọi con số, tên riêng và trích dẫn phải kiểm lại ở nguồn gốc.** Không kiểm được thì không dùng, dù nó rất hợp ý bạn.
- **Dùng AI để hiểu, đừng dùng để thay việc nghĩ.** Nhờ nó giải thích một khái niệm rồi tự viết lại bằng lời mình là học; chép nguyên đoạn nó viết là bỏ qua đúng phần tạo ra năng lực — và phần lớn trường đại học coi đó là vi phạm liêm chính học thuật.
- **Cảnh giác với vòng lặp đồng thuận.** Hỏi AI theo hướng bạn đã tin thì phần lớn thời gian bạn sẽ nhận lại câu trả lời ủng hộ điều đó. Hãy yêu cầu ngược: "nêu ba lý do mạnh nhất chống lại điều tôi vừa nói".

Ảnh, giọng nói và video tổng hợp thì thêm một lớp nữa: chúng đã vượt qua ngưỡng mà mắt thường phân biệt được trong phần lớn trường hợp. Với ảnh và video, dấu hiệu đáng tin hơn không nằm ở việc soi chi tiết mà nằm ở **xuất xứ**: ai đăng đầu tiên, đăng lúc nào, có cơ quan báo chí nào độc lập đưa cùng sự kiện không.

> [!vi-du] Hà nhờ AI tóm tắt tài liệu cho bài tiểu luận, nhận về một đoạn có câu: "Theo Nguyễn Văn A (2019), 68% sinh viên Việt Nam…". Nghe rất dùng được. Hà tra tên bài và không tìm thấy ở đâu; hỏi lại thì mô hình xin lỗi và đưa một trích dẫn khác, cũng không tồn tại. Bài học không phải là bỏ dùng AI, mà là: mọi thứ có dạng "tác giả – năm – con số" đều phải đi kiểm, và kiểm mất ba mươi giây trong khi bị phát hiện bịa nguồn thì mất cả bài.

## Bốn bước trước khi chia sẻ

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="display:grid;gap:.45rem;font-size:1.05rem">
    <div style="background:rgba(217,150,40,.14);border-radius:.4rem;padding:.6rem .8rem"><b>1. Dừng lại</b> — thấy cảm xúc dâng lên (tức giận, hả hê, sợ) là đúng lúc phải dừng: nội dung được thiết kế để lan thường nhắm vào cảm xúc trước</div>
    <div style="background:rgba(13,148,136,.14);border-radius:.4rem;padding:.6rem .8rem"><b>2. Tìm nguồn gốc</b> — ai đăng đầu tiên, lúc nào; bài đang xem là bản gốc hay bản dẫn lại lần thứ ba</div>
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.6rem .8rem"><b>3. Xem nơi khác nói gì</b> — mở tab mới, tìm tên nguồn và tuyên bố đó; có nơi độc lập nào đưa cùng nội dung không</div>
    <div style="background:rgba(139,92,246,.14);border-radius:.4rem;padding:.6rem .8rem"><b>4. Hỏi mình muốn nó đúng tới mức nào</b> — càng muốn nó đúng thì càng phải kiểm kỹ, vì đó chính là lúc thiên lệch xác nhận chạy mạnh nhất</div>
  </div>
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);margin-top:.8rem;line-height:1.6">Bốn bước này mất khoảng hai phút. Chia sẻ một thông tin sai rồi rút lại thì mất nhiều hơn thế rất nhiều — bản đính chính không bao giờ đi xa bằng bản gốc.</div>
</div>
```

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Chọn một trang web hoặc một kênh bạn chưa biết rõ nhưng đang lấy thông tin từ đó. Thẩm định bằng đọc ngang trong tối đa ba phút: mở tab mới, tìm tên nguồn ấy kèm từ khoá đánh giá hoặc kiểm chứng, ghi lại ba điều bạn tìm được từ **nguồn khác** — không tính thông tin do chính trang đó viết về mình.

### Nhóm 3–4 người (25 phút)

Mỗi nhóm nhận một tuyên bố có kèm con số (giảng viên chuẩn bị trước, hoặc lấy từ nhóm lớp). Chạy bốn câu hỏi về con số và trình bày hai phút: con số này đo trên ai, so với nhóm nào, ai công bố, và mức độ tin của nhóm là bao nhiêu phần mười. Yêu cầu: kết luận phải là một mức độ tin kèm điều kiện, không được là tin hoặc không tin.

### Bài tập về nhà (60 phút)

Chọn một chủ đề bạn quan tâm và hỏi một trợ lý AI ba câu về nó, yêu cầu có trích dẫn. Sau đó đi kiểm từng trích dẫn ở nguồn gốc. Viết một trang: bao nhiêu trích dẫn tồn tại thật, bao nhiêu bịa hoặc sai chi tiết; những chỗ bịa có dấu hiệu nào nhận ra được trước khi kiểm không; và bạn sẽ đặt quy tắc gì cho bản thân khi dùng AI trong các bài tập sắp tới.

### Xem thêm

- 🎬 [Check Yourself with Lateral Reading](https://www.youtube.com/watch?v=GoQG6Tin-1E) — Crash Course Navigating Digital Information #3, 13 phút 51. Kỹ thuật đọc ngang, dựng theo nghiên cứu của nhóm Stanford.
- 🎬 [How to Spot a Misleading Graph](https://www.youtube.com/watch?v=E91bGT9BjYk) — Lea Gaslowitz, TED-Ed, 4 phút 10. Các cách trục biểu đồ đánh lừa mắt người đọc.
- 🎬 [Can You Outsmart a Troll (by Thinking Like One)?](https://www.youtube.com/watch?v=Iu4OdhjnN4I) — Claire Wardle, TED-Ed, 5 phút.

### Nguồn tham khảo

- Wineburg, S., & McGrew, S. (2019). Lateral reading and the nature of expertise: Reading less and learning more when evaluating digital information. *Teachers College Record*, 121(11), 1–40.
- Caulfield, M. (2019). *SIFT (The Four Moves).* — [hapgood.us/2019/06/19/sift-the-four-moves](https://hapgood.us/2019/06/19/sift-the-four-moves/)
- Wardle, C., & Derakhshan, H. (2017). *Information Disorder: Toward an Interdisciplinary Framework for Research and Policy Making.* Council of Europe.
- Huff, D. (1954). *How to Lie with Statistics.* New York: W. W. Norton.
- Bender, E. M., Gebru, T., McMillan-Major, A., & Shmitchell, S. (2021). On the dangers of stochastic parrots. *Proceedings of FAccT 2021*, 610–623.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.3-doc-ngang",
                "type": "mcq",
                "prompt": "Bạn gặp một trang web lạ đưa ra một tuyên bố về thị trường việc làm. Cách thẩm định hiệu quả nhất là gì?",
                "explanation": "Mọi thứ trên trang đều do chính họ viết, nên đánh giá phải đến từ bên ngoài: rời trang, tìm xem nguồn độc lập nói gì về tổ chức và tuyên bố ấy, rồi mới quay lại.",
                "points": 2,
                "options": [
                    {"label": "Mở tab mới, tìm xem nguồn độc lập nói gì về trang và về tuyên bố đó, rồi mới quay lại đọc", "isCorrect": True},
                    {"label": "Đọc kỹ mục Về chúng tôi và xem trang có trích dẫn đầy đủ không", "isCorrect": False, "misconception": "knm.vertical-reading"},
                    {"label": "Xem giao diện có chuyên nghiệp và văn phong có chỉn chu không", "isCorrect": False, "misconception": "knm.vertical-reading"},
                    {"label": "Xem bài có bao nhiêu lượt chia sẻ và bình luận", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                ],
            },
            {
                "key": "3.3-doc-con-so",
                "type": "mcq",
                "prompt": "Một bài viết nói: ứng dụng X giúp người học tiến bộ nhanh hơn 40%. Câu hỏi nào cần đặt đầu tiên?",
                "explanation": "Con số phần trăm chỉ có nghĩa khi biết so với nhóm nào; không có nhóm đối chứng thì không kết luận được gì về hiệu quả.",
                "points": 2,
                "options": [
                    {"label": "Nhanh hơn 40% so với nhóm nào, và nhóm đó được học bằng cách gì", "isCorrect": True},
                    {"label": "Ứng dụng đó có bao nhiêu lượt tải", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                    {"label": "Người viết bài có phải chuyên gia giáo dục không", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                    {"label": "Bạn bè mình dùng thấy thế nào", "isCorrect": False, "misconception": "knm.anecdote-as-proof"},
                ],
            },
            {
                "key": "3.3-tuong-quan",
                "type": "mcq",
                "prompt": "Khảo sát cho thấy sinh viên dùng ứng dụng học tập có điểm trung bình cao hơn nhóm không dùng. Kết luận nào hợp lý?",
                "explanation": "Trước khi kết luận nhân quả phải loại ba khả năng: chiều ngược lại, yếu tố thứ ba, và trùng hợp. Ở đây rất có thể người vốn chăm mới chịu cài ứng dụng.",
                "points": 3,
                "options": [
                    {"label": "Hai điều này đi cùng nhau; có thể ứng dụng giúp ích, cũng có thể người vốn chăm mới cài ứng dụng — chưa đủ cơ sở kết luận nhân quả", "isCorrect": True},
                    {"label": "Ứng dụng làm tăng điểm số, nên ai cũng nên cài", "isCorrect": False, "misconception": "knm.correlation-causation"},
                    {"label": "Điểm cao khiến sinh viên thích cài ứng dụng hơn", "isCorrect": False, "misconception": "knm.correlation-causation"},
                    {"label": "Khảo sát này vô giá trị vì không chứng minh được gì", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                ],
            },
            {
                "key": "3.3-ai-trich-dan",
                "type": "mcq",
                "prompt": "Bạn nhờ AI tóm tắt tài liệu và nhận được một đoạn có trích dẫn rất cụ thể: tên tác giả, năm, tạp chí, số trang. Nên làm gì?",
                "explanation": "Mô hình ngôn ngữ tối ưu cho tính hợp lý bề mặt nên trích dẫn bịa thường rất chỉnh. Mọi trích dẫn, con số và tên riêng phải kiểm lại ở nguồn gốc trước khi dùng.",
                "points": 3,
                "options": [
                    {"label": "Đi kiểm từng trích dẫn ở nguồn gốc; không tìm thấy thì không dùng, dù nó rất khớp với ý mình", "isCorrect": True},
                    {"label": "Dùng luôn, vì trích dẫn cụ thể tới mức đó thì khó mà sai", "isCorrect": False, "misconception": "knm.ai-fluency-truth"},
                    {"label": "Hỏi lại AI xem trích dẫn có thật không và tin câu trả lời của nó", "isCorrect": False, "misconception": "knm.ai-fluency-truth"},
                    {"label": "Bỏ hẳn việc dùng AI trong mọi bài tập", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                ],
            },
            {
                "key": "3.3-truoc-khi-chia-se",
                "type": "ordering",
                "prompt": "Sắp xếp bốn bước nên làm trước khi chia sẻ một thông tin gây chú ý.",
                "explanation": "Dừng lại khi thấy cảm xúc dâng lên, lần về nguồn gốc, đối chiếu với nơi khác, và cuối cùng tự hỏi mình đang muốn nó đúng tới mức nào.",
                "points": 3,
                "sequence": [
                    "Dừng lại khi nhận ra nội dung đang khơi cảm xúc mạnh",
                    "Tìm nguồn gốc: ai đăng đầu tiên, đây là bản gốc hay bản dẫn lại",
                    "Mở tab mới xem nơi độc lập nào nói cùng nội dung đó",
                    "Tự hỏi mình đang muốn thông tin này đúng tới mức nào",
                ],
            },
            {
                "key": "3.3-nguy-co-tuong-doi",
                "type": "mcq",
                "prompt": "Một bài báo giật tít: thói quen này làm tăng gấp đôi nguy cơ mắc bệnh X. Câu hỏi quan trọng nhất là gì?",
                "explanation": "Gấp đôi một con số rất nhỏ vẫn là một con số rất nhỏ. Luôn hỏi mức nguy cơ tuyệt đối trước và sau, thay vì chỉ đọc tỉ lệ tương đối.",
                "points": 2,
                "options": [
                    {"label": "Nguy cơ ban đầu là bao nhiêu, và sau khi tăng gấp đôi thì thành bao nhiêu", "isCorrect": True},
                    {"label": "Bài báo đăng trên trang nào có nổi tiếng không", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                    {"label": "Có bao nhiêu người chia sẻ bài viết đó", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                    {"label": "Mình có quen ai mắc bệnh đó không", "isCorrect": False, "misconception": "knm.anecdote-as-proof"},
                ],
            },
            {
                "key": "3.3-viet-kiem-ai",
                "type": "essay",
                "prompt": "Hỏi một trợ lý AI ba câu về một chủ đề bạn quan tâm, yêu cầu có trích dẫn, rồi đi kiểm từng trích dẫn. Viết 200–300 từ: bao nhiêu trích dẫn tồn tại thật và bao nhiêu sai hoặc bịa; có dấu hiệu nào nhận ra được trước khi kiểm không; và hai quy tắc bạn đặt cho bản thân khi dùng AI trong các bài tập sắp tới.",
                "points": 5,
            },
        ],
    },
}

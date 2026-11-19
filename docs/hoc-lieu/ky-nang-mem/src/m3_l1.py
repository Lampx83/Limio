# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.1 · Tách khẳng định, bằng chứng và suy luận",
    "durationMin": 45,
    "description": "Bài này trình bày tư duy phản biện như một quy trình kiểm tra chất lượng lập luận chứ không phải sự bắt bẻ, ba mảnh của một lập luận và cách tách chúng ra, thang suy luận của Argyris, và năm câu hỏi có thể áp dụng ngay.",
    "objectives": [
        "Tách được một phát biểu thành ba mảnh: khẳng định, bằng chứng và suy luận nối hai thứ đó",
        "Xác định được mình đang ở nấc nào trên thang suy luận trong một tình huống cụ thể",
        "Vận dụng được năm câu hỏi kiểm tra cho một tuyên bố gặp trên mạng",
        "Phân biệt được tư duy phản biện với sự bắt bẻ và với thái độ hoài nghi mọi thứ",
    ],
    "summary": [
        "Phản biện kết thúc bằng một kết luận đáng tin hơn chứ không phải bằng việc hạ thấp ai; nếu sau khi phản biện chỉ còn lại sự nghi ngờ thì quá trình chưa hoàn tất.",
        "Mỗi lập luận gồm ba mảnh: khẳng định, bằng chứng và suy luận nối chúng. Nhiều tranh cãi trên mạng hỏng ở mảnh thứ ba vì mảnh này thường không được nói ra.",
        "Thang suy luận giúp giải thích vì sao hai người nhìn cùng một sự việc lại kết luận trái ngược: mỗi người chọn một phần dữ liệu rồi leo rất nhanh lên hành động.",
        "Năm câu hỏi kiểm tra đơn giản tới mức có thể dùng cho mọi nội dung đọc trong ngày: khẳng định là gì, bằng chứng nào, ai nói và họ được gì, còn cách giải thích nào khác, điều gì sẽ khiến tôi đổi ý.",
    ],
    "splitSections": True,
    "body": r"""
Tư duy phản biện (*critical thinking*) là một trong những kỹ năng mềm bị hiểu nhầm nhiều nhất. Nó không phải là năng khiếu tranh luận, cũng không phải thói quen nghi ngờ. Trong giáo trình này, tư duy phản biện được hiểu là một **quy trình kiểm tra chất lượng** áp dụng lên các lập luận, cả của người khác và, khó hơn, của chính mình.

## Phản biện không phải là bắt bẻ

| | Phản biện | Bắt bẻ | Hoài nghi mọi thứ |
|---|---|---|---|
| Mục đích | Đi tới kết luận đáng tin hơn | Thắng người đối diện | Không tin gì cả |
| Đối tượng soi | Lập luận, kể cả của mình | Người nói | Mọi tuyên bố như nhau |
| Kết thúc bằng | Một kết luận có điều kiện rõ ràng | Một người im lặng | Sự tê liệt, không quyết được gì |
| Dấu hiệu nhận ra | Có nêu điều gì sẽ khiến mình đổi ý | Chỉ tìm lỗi, không nêu phương án | Đòi bằng chứng tuyệt đối cho mọi thứ |

> [!ghi-nho] Phép thử cho một lần phản biện: sau khi hoàn tất, bạn có nói được một kết luận đáng tin hơn trước hay không? Nếu chỉ còn lại sự nghi ngờ thì quá trình mới dừng ở việc phá bỏ mà chưa xây dựng.

Cột thứ ba đáng chú ý vì dễ bị nhầm với tư duy phản biện tốt. Người hoài nghi mọi thứ đòi tiêu chuẩn bằng chứng cao đến mức không điều gì đạt được, nên cuối cùng vẫn quyết định theo cảm tính, chỉ khác là có thêm cảm giác rằng mình tỉnh táo.

## Ba mảnh của một lập luận

Một lập luận gồm ba mảnh: **khẳng định** (*claim*), tức điều người nói muốn người nghe tin; **bằng chứng** (*evidence*), tức dữ kiện được đưa ra để đỡ khẳng định; và **suy luận**, tức giả định nối bằng chứng với khẳng định và thường không được nói ra. Mảnh thứ ba tương ứng với bảo chứng (*warrant*) trong mô hình lập luận của Toulmin (2003). Sơ đồ dưới đây minh hoạ ba mảnh đó.

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="display:grid;gap:.5rem;font-size:1.05rem">
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.6rem .8rem"><b>Khẳng định</b> — điều người nói muốn bạn tin<br><span style="opacity:.85">Học ngành này ra trường thất nghiệp hết</span></div>
    <div style="background:rgba(13,148,136,.14);border-radius:.4rem;padding:.6rem .8rem"><b>Bằng chứng</b> — dữ kiện đưa ra để đỡ khẳng định<br><span style="opacity:.85">Hai anh khoá trên mình quen đang làm trái ngành</span></div>
    <div style="background:rgba(217,150,40,.16);border:2px solid rgba(217,150,40,.55);border-radius:.4rem;padding:.6rem .8rem"><b>Suy luận</b> — giả định nối bằng chứng với khẳng định, thường không nói ra<br><span style="opacity:.85">Rằng hai người quen đủ đại diện cho cả ngành, và làm trái ngành nghĩa là thất nghiệp</span></div>
  </div>
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);margin-top:.8rem;line-height:1.6">Mảnh thứ ba là chỗ nhiều lập luận yếu đi, và cũng là chỗ ít người kiểm tra vì nó nằm ngầm. Viết nó ra thành một câu là kỹ năng cốt lõi của cả module này.</div>
</div>
```

Xét một phát biểu khác: “Ứng dụng X giúp học tiếng Anh nhanh gấp ba lần.” Khẳng định của phát biểu này rõ ràng. Bằng chứng là một nghiên cứu do chính công ty công bố. Suy luận ngầm gồm ba giả định: người trong nghiên cứu giống bạn, nhóm đối chứng có học một nội dung tương đương, và “nhanh gấp ba” được đo bằng một bài kiểm tra có ý nghĩa. Ba giả định ấy đều có thể sai độc lập với nhau, và không giả định nào được nhắc tới trong quảng cáo.

> [!vi-du] Bài đăng trên nhóm sinh viên: “Đừng học thêm chứng chỉ, phí tiền. Mình có chứng chỉ mà vẫn trượt bốn vòng phỏng vấn.” Khi tách ra, **khẳng định** là học chứng chỉ là phí tiền; **bằng chứng** là trải nghiệm của một người; **suy luận ngầm** là chứng chỉ là yếu tố duy nhất quyết định kết quả phỏng vấn, và một trường hợp đủ để kết luận cho mọi người. Chỉ cần viết mảnh thứ ba ra là có thể thấy chỗ hỏng, mà không cần tranh cãi với người viết.

## Thang suy luận: vì sao chúng ta nhảy tới kết luận

![Sơ đồ thang suy luận của Chris Argyris, từ dữ liệu quan sát được lên tới hành động](https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Ladder_of_inference.svg/1280px-Ladder_of_inference.svg.png "Thang suy luận (ladder of inference) của Chris Argyris: từ bể dữ liệu quan sát được, ta chọn một phần, gán nghĩa, rút ra giả định, kết luận, hình thành niềm tin rồi hành động — và niềm tin ấy lại quyết định lần sau ta chọn dữ liệu nào. Hình: [File:Ladder of inference.svg](https://commons.wikimedia.org/wiki/File:Ladder_of_inference.svg), tác giả User:Biogeographist, giấy phép CC BY-SA 4.0.")

Thang suy luận (*ladder of inference*) do Argyris (1990) đề xuất mô tả quá trình đi từ dữ liệu quan sát được tới hành động. Điểm quan trọng của sơ đồ này không nằm ở các nấc mà ở **tốc độ**: người ta có thể leo hết bảy nấc trong vài giây và chỉ nhớ nấc cuối. Hai người ngồi cùng một cuộc họp, nghe cùng những câu nói, vẫn có thể ra về với hai kết luận trái ngược, không phải vì ai nói dối mà vì mỗi người chọn một phần dữ liệu khác nhau ngay từ nấc thứ hai.

Vòng lặp phản hồi ở bên trái sơ đồ là phần có hệ quả lớn nhất: niềm tin hiện tại ảnh hưởng đến việc lần sau chúng ta chú ý tới dữ liệu nào. Chẳng hạn, khi đã tin một bạn cùng nhóm là người thiếu trách nhiệm, bạn dễ nhớ lần bạn ấy nộp muộn năm phút và ít ghi nhớ ba lần bạn ấy nộp sớm.

Cách quay trở xuống thang suy luận gồm ba bước theo thứ tự sau:

1. **Nói ra kết luận của mình** kèm dữ liệu mình đã dựa vào, chẳng hạn “mình nghĩ nhóm đang chậm, vì hai phần việc tuần này chưa có ai nhận”.
2. **Hỏi người kia đang dựa vào dữ liệu nào**, vì có thể họ nhìn thấy phần bạn không thấy.
3. **Kiểm tra giả định ở giữa** bằng cách tự hỏi: mình đang giả định điều gì để đi từ dữ liệu ấy tới kết luận ấy?

## Năm câu hỏi dùng được ngay

Việc áp dụng không đòi hỏi phải nhớ toàn bộ lý thuyết. Năm câu hỏi dưới đây có thể dùng cho nhiều nội dung bạn đọc trong ngày và mất chưa tới một phút:

1. **Khẳng định ở đây chính xác là gì?** Viết thành một câu. Nhiều bài đăng dài không có nổi một khẳng định rõ ràng, và riêng phát hiện ấy đã là một kết luận.
2. **Bằng chứng nào?** Số liệu, nghiên cứu, hay chỉ là một câu chuyện?
3. **Ai nói, và họ được gì nếu tôi tin?** Mục đích không phải để bác bỏ mà để biết cần đọc kỹ chỗ nào.
4. **Còn cách giải thích nào khác cho cùng dữ kiện này?** Bắt buộc nêu ít nhất một.
5. **Điều gì sẽ khiến tôi đổi ý?** Nếu không có điều gì như vậy thì thứ bạn đang giữ là một niềm tin chứ không phải một kết luận.

> [!meo] Câu thứ năm có giá trị cao nhất và nên được đặt **trước** khi tra cứu. Hãy viết ra trước điều gì sẽ khiến mình đổi ý rồi mới đi tìm; nếu làm ngược lại, chúng ta nhiều khả năng chỉ đang gom bằng chứng cho kết luận đã có sẵn.

> [!vi-du] Một video ngắn lan truyền: “Sinh viên bây giờ ra trường lương khởi điểm 30 triệu, ai bảo khó xin việc.” Áp dụng năm câu hỏi: khẳng định là mức lương khởi điểm phổ biến ở mức 30 triệu; bằng chứng là ba bạn được phỏng vấn trong video; người nói là một kênh tuyển sinh, họ được lợi nếu bạn tin; cách giải thích khác là ba bạn ấy được chọn vì câu chuyện đẹp, hoặc thuộc nhóm ngành và thành phố cụ thể; điều khiến tôi đổi ý là một khảo sát có cỡ mẫu lớn, nêu rõ ngành và khu vực. Kết luận sau một phút là chưa đủ cơ sở để tin cũng như để bác bỏ, nhưng đã biết cần tìm thêm điều gì.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Chọn một bài đăng hoặc video bạn xem trong 24 giờ qua có đưa ra một tuyên bố. Tách nó thành ba mảnh: khẳng định, bằng chứng, suy luận ngầm; mảnh thứ ba phải viết thành một câu hoàn chỉnh bắt đầu bằng “Người nói đang giả định rằng…”. Sau đó chạy năm câu hỏi và viết một dòng kết luận: tôi tin tới mức nào, và tôi cần thêm gì.

### Nhóm 3–4 người (25 phút)

Mỗi người mang tới một tuyên bố có thật (bài đăng, quảng cáo khoá học, lời khuyên nghề nghiệp). Đổi chéo cho nhau. Nhiệm vụ: **không được phản bác**, chỉ được viết ra ba mảnh của lập luận và các giả định ngầm. Cuối buổi, cả nhóm so sánh xem với cùng một tuyên bố, mỗi người có tìm ra giả định ngầm khác nhau hay không và vì sao.

### Bài tập về nhà (45–60 phút)

Chọn một chuyện bạn đã kết luận về một người hoặc một nhóm trong tháng qua (nhóm học tập chậm, một bạn thiếu trách nhiệm, một giảng viên khó tính). Dựng lại thang suy luận của chính bạn: dữ liệu bạn thật sự quan sát được là gì, bạn đã chọn phần nào, gán nghĩa gì, giả định gì, kết luận gì. Rồi viết nửa trang: nếu phải chọn lại dữ liệu ở nấc thứ hai một cách công bằng hơn, kết luận có đổi không.

### Xem thêm

- 🎬 [Why You Think You're Right — Even If You're Wrong](https://www.youtube.com/watch?v=w4RLfVxTGH4) — Julia Galef, TED, 11 phút. Phân biệt tư duy lính chiến (bảo vệ điều mình tin) với tư duy trinh sát (vẽ đúng bản đồ) — khung nền cho cả module.

### Nguồn tham khảo

- Argyris, C. (1990). *Overcoming Organizational Defenses: Facilitating Organizational Learning.* Boston: Allyn & Bacon — nguồn của thang suy luận.
- Paul, R., & Elder, L. (2019). *The Miniature Guide to Critical Thinking: Concepts and Tools* (8th ed.). Rowman & Littlefield.
- Toulmin, S. E. (2003). *The Uses of Argument* (updated ed.). Cambridge University Press — mô hình khẳng định – dữ liệu – bảo chứng.
- Galef, J. (2021). *The Scout Mindset: Why Some People See Things Clearly and Others Don't.* New York: Portfolio.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.1-phan-bien-la-gi",
                "type": "mcq",
                "prompt": "Đâu là mô tả đúng nhất về tư duy phản biện?",
                "explanation": "Phản biện là quy trình kiểm chất lượng lập luận (kể cả của chính mình) và kết thúc bằng một kết luận đáng tin hơn, chứ không phải bằng việc thắng ai hay nghi ngờ mọi thứ.",
                "points": 2,
                "options": [
                    {"label": "Quy trình kiểm tra chất lượng của một lập luận, kể cả lập luận của chính mình, nhằm đi tới kết luận đáng tin hơn", "isCorrect": True},
                    {"label": "Khả năng tìm ra lỗi trong lời nói của người khác và phản bác lại nhanh", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                    {"label": "Thái độ không tin bất cứ điều gì cho tới khi có bằng chứng tuyệt đối", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                    {"label": "Kỹ năng tranh luận để bảo vệ quan điểm của mình tới cùng", "isCorrect": False, "misconception": "knm.confirmation-bias"},
                ],
            },
            {
                "key": "3.1-ba-manh",
                "type": "matching",
                "prompt": "Một bạn nói: Đừng học thêm chứng chỉ, phí tiền — mình có chứng chỉ mà vẫn trượt bốn vòng phỏng vấn. Nối mỗi phần với vai trò của nó trong lập luận.",
                "explanation": "Khẳng định là điều muốn chúng ta tin, bằng chứng là dữ kiện đưa ra, còn suy luận là giả định ngầm nối hai thứ. Mảnh thứ ba thường là chỗ lập luận hỏng.",
                "points": 3,
                "pairs": [
                    {"left": "Học thêm chứng chỉ là phí tiền", "right": "Khẳng định"},
                    {"left": "Mình có chứng chỉ mà vẫn trượt bốn vòng phỏng vấn", "right": "Bằng chứng"},
                    {"left": "Rằng một trường hợp đủ đại diện, và chứng chỉ là yếu tố duy nhất quyết định kết quả", "right": "Suy luận ngầm"},
                ],
            },
            {
                "key": "3.1-thang-suy-luan",
                "type": "mcq",
                "prompt": "Hai bạn dự cùng một buổi họp nhóm và ra về với hai kết luận trái ngược về việc nhóm đang chạy tốt hay không. Theo thang suy luận, cách giải thích hợp lý nhất là gì?",
                "explanation": "Ngay ở nấc chọn dữ liệu, mỗi người đã lấy một phần khác nhau từ cùng một bể quan sát, rồi leo rất nhanh lên kết luận và chỉ nhớ nấc cuối.",
                "points": 2,
                "options": [
                    {"label": "Mỗi người chọn một phần dữ liệu khác nhau từ cùng một buổi họp, rồi gán nghĩa và leo lên kết luận trong vài giây", "isCorrect": True},
                    {"label": "Một trong hai người chắc chắn đã không chú ý nghe", "isCorrect": False, "misconception": "knm.straw-man"},
                    {"label": "Người nào tự tin hơn thì kết luận của người đó đáng tin hơn", "isCorrect": False, "misconception": "knm.opinion-as-evidence"},
                    {"label": "Sự thật nằm ở giữa hai kết luận đó", "isCorrect": False, "misconception": "knm.false-dilemma"},
                ],
            },
            {
                "key": "3.1-tut-thang",
                "type": "ordering",
                "prompt": "Sắp xếp các bước tụt xuống thang suy luận khi bạn và một người khác đang kết luận trái ngược nhau.",
                "explanation": "Nói ra kết luận kèm dữ liệu của mình trước để mọi thứ hiện ra, rồi hỏi dữ liệu của người kia, rồi mới kiểm giả định ở giữa và thống nhất cách đọc.",
                "points": 3,
                "sequence": [
                    "Nói ra kết luận của mình kèm những dữ liệu cụ thể mình đã dựa vào",
                    "Hỏi người kia đang dựa vào dữ liệu nào",
                    "Đối chiếu hai tập dữ liệu xem phần nào bên kia thấy mà mình không thấy",
                    "Kiểm giả định mình dùng để đi từ dữ liệu tới kết luận",
                    "Phát biểu lại kết luận chung kèm điều kiện còn chưa chắc",
                ],
            },
            {
                "key": "3.1-cau-hoi-doi-y",
                "type": "mcq",
                "prompt": "Vì sao câu hỏi điều gì sẽ khiến tôi đổi ý nên được đặt trước khi đi tra cứu?",
                "explanation": "Đặt trước thì chúng ta biết mình đang tìm gì để kiểm; đặt sau thì phần lớn thời gian chúng ta chỉ gom bằng chứng ủng hộ kết luận đã có sẵn.",
                "points": 2,
                "options": [
                    {"label": "Vì nếu không, chúng ta có xu hướng chỉ gom những thứ ủng hộ kết luận mình đã có sẵn", "isCorrect": True},
                    {"label": "Vì nó giúp chúng ta tranh luận thắng người khác dễ hơn", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                    {"label": "Vì câu trả lời sẽ cho chúng ta biết ai đúng ngay từ đầu", "isCorrect": False},
                    {"label": "Vì nó tiết kiệm thời gian bằng cách bỏ qua các nguồn trái chiều", "isCorrect": False, "misconception": "knm.confirmation-bias"},
                ],
            },
            {
                "key": "3.1-nam-cau-hoi",
                "type": "mcq",
                "prompt": "Một video quảng bá nói: sinh viên ngành này ra trường lương khởi điểm 30 triệu, kèm phỏng vấn ba bạn cựu sinh viên. Bước kiểm tra nào cho nhiều thông tin nhất?",
                "explanation": "Hỏi bằng chứng thuộc loại nào và ai được lợi nếu chúng ta tin sẽ lộ ra ngay rằng đây là ba trường hợp được chọn, do một bên có lợi ích công bố.",
                "points": 2,
                "options": [
                    {"label": "Hỏi ba trường hợp này được chọn thế nào và ai được lợi nếu người xem tin con số đó", "isCorrect": True},
                    {"label": "Xem video có bao nhiêu lượt xem và chia sẻ", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                    {"label": "Xem ba bạn trong video có nói năng tự tin không", "isCorrect": False, "misconception": "knm.opinion-as-evidence"},
                    {"label": "Hỏi một người quen xem có đúng vậy không rồi kết luận theo", "isCorrect": False, "misconception": "knm.anecdote-as-proof"},
                ],
            },
            {
                "key": "3.1-viet-tach-manh",
                "type": "essay",
                "prompt": "Chọn một tuyên bố bạn gặp trong 24 giờ qua (bài đăng, quảng cáo, lời khuyên nghề nghiệp). Viết 150–250 từ gồm: (a) khẳng định, viết thành một câu; (b) bằng chứng được đưa ra và nó thuộc loại nào; (c) suy luận ngầm, viết thành câu bắt đầu bằng Người nói đang giả định rằng…; (d) điều gì sẽ khiến bạn tin hoặc không tin tuyên bố đó.",
                "points": 5,
            },
        ],
    },
}

# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 9.3 · Xung đột, thành viên khó và rút kinh nghiệm",
    "durationMin": 50,
    "description": "Bài học trình bày năm kiểu phản ứng trước xung đột và điều kiện sử dụng của từng kiểu, hướng dẫn cách xử lý ba tình huống khó trong nhóm sinh viên, và mô tả cách rút kinh nghiệm sau dự án để lần sau làm khác đi.",
    "objectives": [
        "Phân loại kiểu phản ứng của bản thân trước xung đột và lựa chọn kiểu phù hợp với tình huống",
        "Vận dụng cách nói dựa trên sự việc và ảnh hưởng, thay vì quy kết tính cách, khi trao đổi với thành viên trễ hạn",
        "Phân tích và xử lý tình huống hai người bất đồng kéo dài cũng như tình huống có thành viên im lặng",
        "Chủ trì một buổi rút kinh nghiệm cuối dự án để tạo ra những việc làm được cho lần sau",
    ],
    "summary": [
        "Có năm kiểu phản ứng trước xung đột: đương đầu, né tránh, nhượng bộ, thoả hiệp và hợp tác. Không kiểu nào luôn đúng, nhưng né tránh dễ bị lạm dụng vì nó dễ chịu trong ngắn hạn.",
        "Trước thành viên trễ hạn, cần hỏi nguyên nhân trước khi kết luận, nói bằng sự việc và ảnh hưởng, và thống nhất mốc mới có thể kiểm chứng.",
        "Trước thành viên im lặng, cần mời trực tiếp hoặc hỏi riêng vì im lặng không đồng nghĩa với đồng thuận; trước hai người bất đồng kéo dài, cần đưa tranh luận về tiêu chí và ghi lại quyết định.",
        "Rút kinh nghiệm chỉ có giá trị khi tạo ra những việc làm được cho lần sau, mỗi việc gắn với tên người và mốc thời gian.",
    ],
    "splitSections": True,
    "body": r"""
Hầu như nhóm nào cũng có lúc trục trặc. Bài này bàn về ba vấn đề khó: xung đột, thành viên không giữ cam kết, và buổi rút kinh nghiệm mà nhiều nhóm bỏ qua. Các nội dung này tiếp nối bài 9.2, nơi giai đoạn sóng gió được mô tả là khó tránh khỏi trong quá trình phát triển của nhóm.

## Năm kiểu phản ứng trước xung đột

Thomas và Kilmann (1974) phân biệt năm kiểu phản ứng (*conflict-handling mode*) trước xung đột: đương đầu hay cạnh tranh (*competing*), né tránh (*avoiding*), nhượng bộ (*accommodating*), thoả hiệp (*compromising*) và hợp tác (*collaborating*). Mỗi kiểu có vùng sử dụng phù hợp riêng, như bảng dưới đây.

| Kiểu | Biểu hiện | Dùng được khi | Hỏng khi |
|---|---|---|---|
| Đương đầu (cạnh tranh) | Người dùng kiểu này bảo vệ quan điểm đến cùng và muốn phần thắng thuộc về mình. | Việc gấp, có nguyên tắc không thể thay đổi, hoặc an toàn bị đe doạ. | Kiểu này bị dùng cho mọi chuyện và nhóm sẽ ngừng nói thật với bạn. |
| Né tránh | Người dùng kiểu này im lặng, lảng sang chuyện khác và mong vấn đề tự qua. | Chuyện nhỏ, hoặc cần thời gian hạ nhiệt trước khi bàn. | Vấn đề ảnh hưởng tới kết quả chung, khi đó nó sẽ quay lại vào lúc gần hạn. |
| Nhượng bộ | Người dùng kiểu này chiều theo ý người kia để giữ hoà khí. | Việc không quan trọng với bạn nhưng quan trọng với họ. | Bạn nhượng bộ liên tục, khiến bạn kiệt sức và nhóm mất đi một tiếng nói. |
| Thoả hiệp | Mỗi bên nhường một nửa. | Thời gian gấp và hai phương án đều tạm chấp nhận được. | Vấn đề cần một giải pháp đúng chứ không phải một giải pháp ở giữa. |
| Hợp tác | Các bên cùng tìm phương án đáp ứng được mối quan tâm của cả hai. | Việc quan trọng, còn thời gian và quan hệ cần giữ lâu dài. | Kiểu này được dùng cho chuyện vặt, gây tốn thời gian không đáng. |

Hai kiểu cần được phân tích kỹ hơn. **Đương đầu** không phải lúc nào cũng xấu: khi bạn đang giữ một nguyên tắc, như trong tình huống nhóm định nộp lại bài của khoá trước ở module 1, thì đó là phản ứng phù hợp. **Né tránh** là kiểu dễ bị lạm dụng trong nhóm sinh viên, vì nó dễ chịu ngay lập tức nhưng phải trả giá về sau.

> [!vi-du] Hai thành viên bất đồng về cách chia việc. Bạn X nói thẳng quan điểm và kèm lý do, còn bạn Y im lặng suốt buổi họp rồi sau đó nhắn riêng cho từng người. X đang **đương đầu ở mức công việc**, kiểu phản ứng hoàn toàn dùng được miễn là X nói về cách làm chứ không nói về con người. Y đang **né tránh**, và việc nhắn riêng cho từng người còn tạo thêm một vấn đề mới: nhóm bắt đầu có hai kênh thông tin, một kênh chính thức và một kênh sau lưng.

## Thành viên không giữ cam kết

Đây là một tình huống rất thường gặp, và nhiều người xử lý sai khi kết luận về tính cách của thành viên rồi hành xử theo kết luận đó.

Quy trình xử lý gồm bốn bước, thực hiện theo thứ tự sau:

1. **Hỏi trước khi kết luận, và hỏi riêng.** Cùng một hành vi trễ hạn có nhiều nguyên nhân: phần việc quá lớn, yêu cầu chưa rõ, đang vướng chuyện gia đình hoặc sức khoẻ, hoặc đúng là thiếu trách nhiệm. Bốn nguyên nhân, bốn cách gỡ khác nhau.
2. **Nói bằng sự việc và ảnh hưởng, không bằng nhãn.** Hãy so sánh hai cách nói: *“Cậu vô trách nhiệm quá”* và *“Phần dữ liệu trễ ba ngày nên phần phân tích của mình chưa bắt đầu được, và cả nhóm đang lùi so với kế hoạch.”* Câu thứ hai khó bị bác bỏ vì nó mô tả sự việc có thể kiểm chứng, và nó không buộc người kia phải bảo vệ danh dự.
3. **Thống nhất mốc mới, nhỏ và kiểm chứng được.** Không nên chấp nhận lời hứa “mai xong”; nên chốt “tối nay gửi phần khung, mai gửi phần số liệu”, vì mốc nhỏ cho phép phát hiện sớm nếu tiến độ lại trượt.
4. **Nếu lặp lại: đưa ra nhóm, rồi mới tới giảng viên.** Nhóm trao đổi bằng dữ kiện đã ghi lại, kèm đề xuất chia lại việc. Chỉ nên báo giảng viên khi đã thử các bước trên và có ghi chép, tương tự thang ứng xử đã học ở bài 1.3.

> [!canh-bao] Một cách xử lý sai thường gặp là **làm hộ luôn cho nhanh**. Cách này cứu được hạn nộp lần này nhưng tạo ra ba vấn đề: người kia không học được gì, bạn kiệt sức, và nhóm hình thành thói quen ỷ lại. Nếu buộc phải gánh việc để kịp hạn, hãy nói rõ đó là ngoại lệ một lần và ghi lại phần việc thực tế của từng người.

> [!vi-du] Hùng liên tục đến họp muộn 20–30 phút và nộp việc trễ. Bạn biết Hùng đang làm thêm ca tối. Ở bước 1, khi hỏi riêng, bạn biết ca làm kết thúc lúc 22h, nên khung giờ họp 20h là bất khả thi với bạn ấy. Ở bước 2, bạn nói về ảnh hưởng: nhóm phải nhắc lại nội dung, mất 15 phút mỗi buổi. Ở bước 3, nhóm thống nhất mốc mới: đổi giờ họp sang 21h30, hoặc Hùng nhận phần việc không phụ thuộc thời gian họp và gửi cập nhật bằng văn bản trước 21h. Vấn đề này **không giải được bằng thái độ**, nhưng giải được bằng một câu hỏi và một lần đổi lịch.

## Người im lặng và hai người bất đồng kéo dài

**Khi một thành viên im lặng dù bạn biết họ có ý kiến hay**, không nên coi im lặng là đồng thuận. Có ba cách xử lý, theo mức độ tăng dần: mời trực tiếp trong buổi họp, chẳng hạn *“Lan, phần này liên quan tới mảng cậu làm, cậu thấy chỗ nào dễ vướng nhất?”*; hỏi riêng sau buổi họp; hoặc đổi cách họp bằng việc cho mỗi người viết ý ra giấy hai phút trước khi thảo luận, cách này gỡ được thế bất lợi của người nói chậm.

**Khi hai người bất đồng kéo dài và làm cả nhóm căng thẳng**, cách xử lý là đưa tranh luận về tiêu chí, gồm bốn bước: gặp riêng từng người để nghe đủ ý kiến; đưa vấn đề ra nhóm dưới dạng **hai phương án, không phải hai con người**; thống nhất tiêu chí chọn trước khi so sánh; và nếu kết quả vẫn hoà thì chọn theo tiêu chí đã định rồi ghi lại lý do. Điều quan trọng là **quyết định phải được ghi lại**, vì bất đồng chưa được chốt bằng văn bản có nhiều khả năng quay lại vào tuần sau.

> [!meo] Khi bạn là người bị phản đối, đừng trả lời ngay. Hãy hỏi lại một câu để hiểu đúng, chẳng hạn *“Ý cậu là cách này tốn thời gian hơn, hay là nó không đạt tiêu chí của giảng viên?”*, rồi mới đáp lại. Nhiều phản đối ban đầu được phát biểu chưa chính xác, kể cả bởi chính người phản đối.

## Rút kinh nghiệm sau dự án

Giai đoạn kết thúc trong mô hình Tuckman ở bài 9.2 thường bị bỏ qua: nộp bài xong là nhóm tan. Tuy nhiên, đây là lúc ít tốn kém nhất để học, vì mọi việc còn được nhớ rõ. Việc nhìn lại này được gọi là rút kinh nghiệm sau dự án (*retrospective*).

Một buổi rút kinh nghiệm kéo dài 30 phút có thể được dẫn dắt bằng bốn câu hỏi sau:

1. **Kết quả so với mục tiêu ban đầu:** đạt phần nào, hụt phần nào, đo bằng gì?
2. **Cái gì đã chạy tốt** và nên giữ cho lần sau? Nên hỏi câu này trước câu về những điểm vướng, vì nhóm nào cũng có điều làm được.
3. **Cái gì vướng**, và vướng vì quy trình hay vì con người? Nhiều vướng mắc bắt nguồn từ quy trình, và đó là điều thuận lợi vì quy trình sửa được.
4. **Lần sau làm khác đi điều gì?** Chọn tối đa ba việc, mỗi việc **gắn tên người và mốc thời gian**.

> [!ghi-nho] Một buổi rút kinh nghiệm thiếu mục 4 chỉ là một buổi than thở có tổ chức. Ngược lại, mục 4 mà không có tên người và mốc thời gian thì cũng chỉ là một danh sách mong muốn.

> [!vi-du] Một nhóm vừa nộp báo cáo cuối kỳ. Khi nhìn lại, nhóm nhận thấy báo cáo hoàn thành đúng hạn nhưng ba ngày cuối cả nhóm phải thức trắng, hai phần bị trùng nội dung và một thành viên gần như không tham gia. Rút kinh nghiệm đúng cách không dừng ở kết luận “lần sau bắt đầu sớm hơn” mà đưa ra ba việc cụ thể: **(1)** buổi họp thứ hai của dự án dành riêng cho việc chốt dàn ý chung và ranh giới giữa các phần, Minh chuẩn bị mẫu; **(2)** mỗi tuần một lần, vào tối chủ nhật, các thành viên gửi cập nhật ngắn bằng văn bản trong nhóm nhắn tin, Lan nhắc; **(3)** ai chưa gửi cập nhật hai tuần liên tiếp thì nhóm hỏi riêng ngay tuần đó, không đợi tới hạn nộp. Ba việc này có tên và có mốc, nên lần sau có thể kiểm tra được nhóm có thực hiện hay không.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Hãy nhớ lại ba lần bất đồng gần nhất trong nhóm. Với mỗi lần, hãy gọi tên kiểu phản ứng của bạn trong năm kiểu và tự đánh giá kiểu đó có phù hợp với tình huống hay không. Nếu bạn dùng **né tránh** từ hai lần trở lên, hãy viết nguyên văn câu bạn đáng lẽ nên nói, bắt đầu bằng sự việc và ảnh hưởng.

### Nhóm 3–4 người (25 phút)

Nhóm đóng vai ba lượt và đổi vai mỗi lượt: (1) nói chuyện với thành viên liên tục trễ hạn, trong đó người đóng vai phải đi đủ bốn bước và **không được dùng nhãn**; (2) mời người im lặng phát biểu; (3) làm trung gian cho hai người bất đồng bằng cách đưa vấn đề về tiêu chí. Người quan sát ghi lại hai điều: có câu nào quy kết tính cách hay không, và mốc mới có kiểm chứng được hay không.

### Bài tập về nhà (45–60 phút)

Hãy tổ chức thật một buổi rút kinh nghiệm 30 phút cho nhóm bạn đang tham gia, theo bốn câu hỏi trong bài. Sau đó nộp biên bản một trang gồm: kết quả so với mục tiêu; hai việc chạy tốt; hai việc vướng kèm phân loại quy trình hay con người; và **ba việc cho lần sau, mỗi việc có tên người và mốc thời gian**.

### Xem thêm

- 🎬 [Build a Tower, Build a Team](https://www.youtube.com/watch?v=H0_yKBitO8M) — Tom Wujec, TED, 7 phút.
- 🎬 [How to Disagree Productively and Find Common Ground](https://www.youtube.com/watch?v=phgjouv0BUA) — Julia Dhar, TED, 14 phút.
- 🎬 [Building a Psychologically Safe Workplace](https://www.youtube.com/watch?v=LhoLuui9gX8) — Amy Edmondson, TEDxHGSE, 11 phút. Vì sao có nhóm dám nói ra vấn đề sớm còn nhóm khác thì không.

### Nguồn tham khảo

- Thomas, K. W., & Kilmann, R. H. (1974). *Thomas–Kilmann Conflict Mode Instrument.* Mountain View: CPP.
- Edmondson, A. C. (2012). *Teaming: How Organizations Learn, Innovate, and Compete in the Knowledge Economy.* San Francisco: Jossey-Bass.
- Patterson, K., Grenny, J., McMillan, R., & Switzler, A. (2011). *Crucial Conversations* (2nd ed.). New York: McGraw-Hill.
- Derby, E., & Larsen, D. (2006). *Agile Retrospectives: Making Good Teams Great.* Raleigh: Pragmatic Bookshelf.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 9.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "9.3-ne-tranh",
                "type": "mcq",
                "prompt": "Khi xung đột nhóm xảy ra, kiểu phản ứng né tránh có biểu hiện thế nào?",
                "explanation": "Né tránh là im lặng, lảng sang chuyện khác, mong vấn đề tự qua; cách này dễ chịu trong ngắn hạn nhưng phải trả giá khi gần hạn nộp.",
                "points": 2,
                "options": [
                    {"label": "Im lặng, lảng sang chuyện khác, mong vấn đề tự qua đi", "isCorrect": True},
                    {"label": "Bảo vệ quan điểm của mình tới cùng", "isCorrect": False},
                    {"label": "Chiều theo ý người kia để giữ hoà khí", "isCorrect": False},
                    {"label": "Cùng tìm phương án đáp ứng mối quan tâm của cả hai bên", "isCorrect": False},
                ],
            },
            {
                "key": "9.3-thanh-vien-tre-han",
                "type": "mcq",
                "prompt": "Hùng liên tục đến họp muộn và nộp việc trễ. Bạn biết Hùng đang làm thêm ca tối. Cách xử lý phù hợp nhất là gì?",
                "explanation": "Hỏi riêng để biết nguyên nhân thật, nói bằng sự việc và ảnh hưởng, rồi thống nhất mốc mới kiểm chứng được; nhiều tình huống loại này giải được bằng một lần đổi lịch chứ không phải bằng thái độ.",
                "points": 3,
                "options": [
                    {"label": "Hỏi riêng để biết nguyên nhân, nói rõ việc trễ ảnh hưởng thế nào tới nhóm, rồi thống nhất cách làm mới phù hợp với lịch của Hùng", "isCorrect": True},
                    {"label": "Nêu chuyện đó giữa cuộc họp để Hùng thấy trách nhiệm", "isCorrect": False, "misconception": "knm.blame-the-person"},
                    {"label": "Tự làm hộ phần của Hùng cho kịp hạn", "isCorrect": False, "misconception": "knm.carry-the-team"},
                    {"label": "Báo ngay với giảng viên để trừ điểm Hùng", "isCorrect": False, "misconception": "knm.conflict-binary"},
                ],
            },
            {
                "key": "9.3-noi-bang-su-viec",
                "type": "mcq",
                "prompt": "Câu nào nói về việc trễ hạn theo hướng dựa trên sự việc thay vì quy kết tính cách?",
                "explanation": "Nói bằng sự việc và ảnh hưởng thì khó cãi và không buộc người kia phải bảo vệ danh dự; đó là điều kiện để câu chuyện đi tiếp về giải pháp.",
                "points": 2,
                "options": [
                    {"label": "Phần dữ liệu trễ ba ngày nên phần phân tích chưa bắt đầu được, cả nhóm đang lùi so với kế hoạch", "isCorrect": True},
                    {"label": "Cậu lúc nào cũng vô trách nhiệm với việc chung", "isCorrect": False, "misconception": "knm.blame-the-person"},
                    {"label": "Chắc cậu không quan tâm tới điểm nhóm rồi", "isCorrect": False, "misconception": "knm.blame-the-person"},
                    {"label": "Thôi để mình làm nốt cho nhanh, khỏi bàn nữa", "isCorrect": False, "misconception": "knm.carry-the-team"},
                ],
            },
            {
                "key": "9.3-nguoi-im-lang",
                "type": "mcq",
                "prompt": "Trong cuộc họp nhóm, một thành viên giữ im lặng dù bạn biết họ có nhiều ý kiến hay. Bạn nên làm gì?",
                "explanation": "Im lặng không phải đồng thuận. Mời trực tiếp bằng câu hỏi gắn với phần việc của họ, hoặc đổi cách họp để mọi người viết ý ra trước khi thảo luận.",
                "points": 2,
                "options": [
                    {"label": "Mời họ nói bằng một câu hỏi gắn với phần việc của họ, hoặc cho cả nhóm viết ý ra giấy trước khi thảo luận", "isCorrect": True},
                    {"label": "Coi như họ đồng ý với phương án đang bàn", "isCorrect": False, "misconception": "knm.silence-is-agreement"},
                    {"label": "Nhắc trước cả nhóm rằng ai cũng phải phát biểu", "isCorrect": False},
                    {"label": "Bỏ qua, ai muốn nói thì tự nói", "isCorrect": False, "misconception": "knm.silence-is-agreement"},
                ],
            },
            {
                "key": "9.3-hai-nguoi-bat-dong",
                "type": "mcq",
                "prompt": "Hai thành viên liên tục bất đồng và đẩy nhóm vào căng thẳng. Cách xử lý phù hợp là gì?",
                "explanation": "Gặp riêng từng người, đưa ra nhóm dưới dạng hai phương án chứ không phải hai con người, thống nhất tiêu chí trước khi so, và ghi lại quyết định.",
                "points": 3,
                "options": [
                    {"label": "Nghe riêng từng người, đưa ra nhóm dưới dạng hai phương án, thống nhất tiêu chí chọn rồi chốt và ghi lại lý do", "isCorrect": True},
                    {"label": "Để hai người tự giải quyết với nhau, nhóm không can thiệp", "isCorrect": False, "misconception": "knm.avoid-conflict"},
                    {"label": "Trưởng nhóm quyết luôn cho nhanh, khỏi tranh cãi", "isCorrect": False, "misconception": "knm.leader-decides-all"},
                    {"label": "Bỏ phiếu ngay trong buổi họp để có kết quả rõ ràng", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                ],
            },
            {
                "key": "9.3-rut-kinh-nghiem",
                "type": "mcq",
                "prompt": "Nhóm vừa nộp báo cáo: đúng hạn nhưng ba ngày cuối phải thức trắng, hai phần trùng nội dung, một thành viên gần như không tham gia. Buổi rút kinh nghiệm nên kết thúc bằng gì?",
                "explanation": "Rút kinh nghiệm chỉ có giá trị khi ra được tối đa ba việc cụ thể cho lần sau, mỗi việc gắn tên người và mốc thời gian; nếu không, đó chỉ là một buổi than thở có tổ chức.",
                "points": 3,
                "options": [
                    {"label": "Tối đa ba việc làm khác đi cho lần sau, mỗi việc gắn tên người phụ trách và mốc thời gian", "isCorrect": True},
                    {"label": "Kết luận rằng lần sau nên bắt đầu sớm hơn", "isCorrect": False, "misconception": "knm.goal-vague"},
                    {"label": "Chỉ ra ai là người làm nhóm chậm để rút kinh nghiệm", "isCorrect": False, "misconception": "knm.blame-the-person"},
                    {"label": "Ghi nhận là nhóm đã nộp đúng hạn, không cần bàn thêm", "isCorrect": False, "misconception": "knm.avoid-conflict"},
                ],
            },
            {
                "key": "9.3-noi-kieu-xung-dot",
                "type": "matching",
                "prompt": "Nối mỗi kiểu phản ứng trước xung đột với tình huống dùng được của nó.",
                "explanation": "Không kiểu nào luôn đúng: mỗi kiểu có vùng dùng được riêng, và vấn đề chỉ xuất hiện khi chúng ta dùng một kiểu cho mọi tình huống.",
                "points": 3,
                "pairs": [
                    {"left": "Đương đầu", "right": "Việc gấp hoặc có nguyên tắc không thể nhượng bộ"},
                    {"left": "Né tránh", "right": "Chuyện nhỏ, hoặc cần hạ nhiệt trước khi bàn tiếp"},
                    {"left": "Thoả hiệp", "right": "Thời gian gấp và hai phương án đều tạm chấp nhận được"},
                    {"left": "Hợp tác", "right": "Việc quan trọng, còn thời gian, quan hệ cần giữ lâu dài"},
                ],
            },
            {
                "key": "9.3-viet-xung-dot",
                "type": "essay",
                "prompt": "Nhớ lại ba lần bất đồng gần nhất trong nhóm của bạn. Viết 200–300 từ: (a) kiểu phản ứng của bạn trong mỗi lần và nó có phù hợp không; (b) một lần bạn đã né tránh — viết nguyên văn câu bạn đáng lẽ nên nói, bắt đầu bằng sự việc và ảnh hưởng; (c) ba việc cho lần sau kèm tên người và mốc, như một biên bản rút kinh nghiệm thu nhỏ.",
                "points": 5,
            },
        ],
    },
}

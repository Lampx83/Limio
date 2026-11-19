# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.1 · Giao tiếp là quá trình hai chiều",
    "durationMin": 45,
    "description": "Bài học giới thiệu mô hình giao tiếp và sáu thành phần của nó, phân biệt giao tiếp một chiều với giao tiếp hai chiều, mô tả bốn loại nhiễu, và hướng dẫn ba kỹ thuật xác nhận ý hiểu thay cho câu hỏi “mọi người rõ chưa?”.",
    "objectives": [
        "Xác định được sáu thành phần của một quá trình giao tiếp trong một tình huống cụ thể",
        "Phân biệt được giao tiếp một chiều với giao tiếp hai chiều qua các dấu hiệu quan sát được",
        "Nhận diện và gọi tên được loại nhiễu đang làm sai lệch một cuộc trao đổi",
        "Vận dụng được ba kỹ thuật xác nhận ý hiểu thay cho câu hỏi “mọi người rõ chưa?”",
    ],
    "summary": [
        "Thông điệp có ý nghĩa ở dạng mà người nhận giải mã được chứ không phải ở dạng mà người gửi phát ra, nên phát đi xong chưa có nghĩa là giao tiếp đã hoàn tất.",
        "Điểm khác biệt có thể quan sát được giữa giao tiếp hai chiều và một chiều là có kênh phản hồi, và người gửi thực sự đọc rồi điều chỉnh theo phản hồi đó.",
        "Có bốn loại nhiễu là vật lý, ngữ nghĩa, tâm sinh lý và tâm lý – xã hội; trong công việc, nhiễu ngữ nghĩa tốn kém nhất vì nó không lộ ra ngay.",
        "Câu hỏi “mọi người rõ chưa?” gần như chỉ nhận được cái gật đầu; thay vào đó, bạn có thể nhờ người nghe tóm tắt lại việc họ sẽ làm, hỏi một câu mở về chỗ dễ vướng, hoặc diễn đạt lại điều mình hiểu khi là người nhận.",
    ],
    "splitSections": True,
    "body": r"""
Nhiều sự cố trong nhóm học tập và nơi làm việc không do ai cố tình gây ra mà xuất phát từ việc **một thông điệp đã được phát đi nhưng lại được hiểu thành điều khác**. Bài này phân tích chỗ hỏng đó.

## Sáu thành phần của một quá trình giao tiếp

Mô hình giao tiếp (*communication model*) dưới đây mô tả giao tiếp bằng sáu thành phần. Sơ đồ Shannon–Weaver minh hoạ phần lớn các thành phần ấy (Shannon & Weaver, 1949), còn bảng bên dưới nêu thêm chỗ hay hỏng của từng thành phần.

![Sơ đồ mô hình truyền thông Shannon–Weaver bằng tiếng Việt, gồm nguồn thông tin, bộ truyền tin, tín hiệu, nguồn tiếng ồn, bên nhận và nơi đến](https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Shannon-Weaver_model_of_communication_vi.svg/1280px-Shannon-Weaver_model_of_communication_vi.svg.png "Mô hình Shannon–Weaver: thông điệp đi từ nguồn qua bộ truyền tin thành tín hiệu, chịu tác động của nhiễu trên đường truyền, rồi được bên nhận giải mã. Hình: [File:Shannon-Weaver model of communication vi.svg](https://commons.wikimedia.org/wiki/File:Shannon-Weaver_model_of_communication_vi.svg), tác giả Thuyhung2112, giấy phép CC0.")

| Thành phần | Nghĩa | Chỗ hay hỏng |
|---|---|---|
| Người gửi (*sender*) | Người có ý muốn truyền đạt | Ý nghĩ chưa rõ ngay với chính người gửi. |
| Mã hoá (*encoding*) | Chuyển ý thành lời, chữ, cử chỉ | Người gửi chọn từ mà người nhận không dùng, chẳng hạn biệt ngữ hoặc viết tắt. |
| Thông điệp và kênh (*message*, *channel*) | Nội dung và đường truyền như gặp mặt, gọi điện, nhắn tin hoặc email | Kênh không phù hợp với nội dung (xem bài 5.3). |
| Nhiễu (*noise*) | Mọi yếu tố làm sai lệch tín hiệu | Tiếng ồn, sự mệt mỏi, định kiến, từ đa nghĩa |
| Giải mã (*decoding*) | Người nhận chuyển tín hiệu thành ý nghĩa | Người nhận giải mã theo kinh nghiệm riêng chứ không theo ý của người gửi. |
| Phản hồi (*feedback*) | Tín hiệu đi ngược lại cho người gửi | Phản hồi bị thiếu hẳn hoặc chỉ là cái gật đầu cho xong. |

**Giải mã** là bước đáng chú ý nhất. Bước này xảy ra khi người nhận chuyển các tín hiệu tiếp nhận được thành ý nghĩa, và họ làm việc đó bằng vốn từ, kinh nghiệm và tâm trạng của **chính họ** chứ không phải của bạn. Vì vậy, một câu hoàn toàn rõ ràng với người gửi vẫn có thể được hiểu theo nghĩa khác ở đầu bên kia. Người nhận không có một dòng riêng trong bảng vì họ là chủ thể thực hiện bước giải mã; khi nói về bước này, bài dùng cụm “người nhận” để chỉ chính người đang thực hiện bước giải mã.

> [!ghi-nho] Thông điệp có ý nghĩa ở dạng mà người kia hiểu chứ không phải ở dạng mà bạn phát ra. Câu “tôi nói rồi mà” không giải quyết được vấn đề nào.

## Một chiều và hai chiều

| | Một chiều | Hai chiều |
|---|---|---|
| Dòng chảy | Chỉ đi từ người gửi tới người nhận | Có phản hồi đi ngược lại và người gửi điều chỉnh theo |
| Ví dụ | Thông báo dán bảng tin, email gửi rồi thôi | Trao đổi có hỏi lại, có xác nhận, có điều chỉnh |
| Tốc độ | Nhanh hơn | Chậm hơn |
| Độ chính xác | Thấp hơn, dễ hiểu sai | Cao hơn |
| Hợp với | Thông tin đơn giản, số đông | Việc phức tạp, nhạy cảm, cần cam kết |

Giao tiếp được gọi là quá trình hai chiều vì **vai người gửi và vai người nhận liên tục đổi chỗ cho nhau**. Chẳng hạn, khi bạn nói và người kia nhíu mày, cái nhíu mày ấy đã là một thông điệp gửi ngược lại; nếu đọc được nó, bạn có thể sửa cách diễn đạt ngay ở câu sau. Vì vậy, người giao tiếp tốt không chỉ là người nói hay mà còn là người **đọc được phản hồi và điều chỉnh kịp thời**.

> [!vi-du] Trong buổi họp nhóm, Vy trình bày kế hoạch phân công trong tám phút, không dừng lại lần nào và kết thúc bằng câu “mọi người rõ chưa?”. Cả nhóm gật đầu. Ba ngày sau, hai phần việc không ai làm vì mỗi người tưởng người kia nhận. Buổi họp ấy là giao tiếp **một chiều có gật đầu**, một hình thức rất thường gặp của việc tưởng rằng đã trao đổi xong.

## Bốn loại nhiễu

| Loại nhiễu | Biểu hiện | Cách giảm |
|---|---|---|
| Vật lý | Tiếng ồn, mạng chập chờn, tiếng vọng, tin nhắn trôi mất | Đổi chỗ, đổi kênh hoặc gửi lại bản viết sau cuộc gọi. |
| Ngữ nghĩa | Từ đa nghĩa, biệt ngữ, viết tắt, cụm “sớm nhất có thể” | Dùng từ đời thường và thay từ mơ hồ bằng con số, ngày giờ. |
| Tâm sinh lý | Mệt, đói, buồn ngủ, ốm, đau | Dời cuộc trao đổi quan trọng sang lúc tỉnh táo. |
| Tâm lý – xã hội | Định kiến sẵn có, ngại nói với người có quyền, cảm xúc đang mạnh | Tạo chỗ an toàn để hỏi, tách người khỏi vấn đề và hạ nhiệt trước khi bàn tiếp. |

Nhiễu **ngữ nghĩa** thường tốn kém nhất trong công việc vì nó không lộ ra ngay: hai bên đều tin rằng mình đã hiểu đúng. Chẳng hạn, “Gửi sớm nhé” có thể có nghĩa là chiều nay với người này và cuối tuần với người kia, nhưng không ai thấy cần hỏi lại.

> [!meo] Một quy tắc ít tốn kém là đổi mọi từ chỉ thời gian, số lượng và mức độ thành con số cụ thể. Thay vì viết “sớm”, bạn viết “trước 16h thứ năm”. Thay vì viết “làm kỹ vào”, bạn viết “kiểm lại ba mục: số liệu, chính tả, định dạng”.

## Xác nhận ý hiểu

Câu “mọi người rõ chưa?” là một trong những câu hỏi kém hiệu quả nhất trong giao tiếp công việc, vì nó gợi ý sẵn câu trả lời là “rõ”, và người chưa rõ lại càng ngại nói vì sợ bị coi là chậm hiểu. Có ba kỹ thuật thay thế:

1. **Nhờ tóm tắt lại.** Chẳng hạn: “Để chắc mình nói đủ, bạn tóm tắt giúp mình phần bạn sẽ làm và hạn nộp nhé.” Đây là kỹ thuật đáng ưu tiên nhất vì nó buộc thông tin phải đi ngược lại bằng lời của người nghe.
2. **Hỏi câu mở, không hỏi câu đóng.** Bạn thay câu hỏi “có ai thắc mắc gì không?” bằng câu hỏi “theo bạn, phần nào dễ vướng nhất khi làm?”.
3. **Diễn đạt lại khi bạn là người nhận.** Chẳng hạn: “Mình hiểu là em cần bản nháp trước thứ tư để kịp gửi khoa, đúng không ạ?” Câu này vừa xác nhận vừa cho người kia cơ hội chỉnh lại mà không ai mất mặt.

> [!vi-du] Khi nhận nhiệm vụ từ giảng viên mà chưa chắc mình hiểu đúng, cách đáp lại tốt không phải là im lặng rồi tự đoán, cũng không phải hỏi “thầy nói lại được không ạ?”. Một câu có thể dùng là: “Em hiểu là bài này cần phân tích hai trường hợp và nộp bản in trước thứ sáu, em hiểu đúng chưa ạ?” Nếu bạn hiểu đúng, việc xác nhận chỉ mất vài giây; nếu hiểu sai, bạn đã tiết kiệm được cả tuần làm nhầm hướng.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Nhớ lại một lần gần đây bạn và người khác hiểu khác nhau về cùng một việc. Viết ra: thông điệp gốc là gì, nó được mã hoá thành lời như thế nào, người kia giải mã ra nghĩa gì, và loại nhiễu nào đã xen vào. Cuối cùng viết lại thông điệp gốc ấy theo quy tắc đổi mọi từ mơ hồ thành con số và ngày giờ.

### Nhóm 3–4 người (25 phút)

Trò chơi truyền tin: người thứ nhất nhận một đoạn hướng dẫn ba câu có chứa hai con số và một điều kiện, đọc thầm rồi kể lại cho người thứ hai, cứ thế tới người cuối. So bản cuối với bản gốc. Cả nhóm phân tích: chi tiết nào rơi trước, chi tiết nào bị đổi, và ở khâu nào một câu xác nhận ý hiểu sẽ chặn được sai lệch.

### Bài tập về nhà (45 phút)

Trong tuần, hãy dùng kỹ thuật nhờ tóm tắt lại hoặc diễn đạt lại ít nhất ba lần: một lần khi nhận việc, một lần khi giao việc, một lần trong đời sống ngoài học tập. Ghi lại mỗi lần hai dòng: câu bạn đã dùng và điều bạn phát hiện ra nhờ nó. Cuối cùng, viết một đoạn nêu lần nào cho thấy có sai lệch và hậu quả sẽ là gì nếu bạn không xác nhận.

### Xem thêm

- 🎬 [10 Ways to Have a Better Conversation](https://www.youtube.com/watch?v=R1vskiVDwl4) — Celeste Headlee, TED, 11 phút. Bài nói trình bày các nguyên tắc thực hành cho giao tiếp hai chiều, đặc biệt là phần về hỏi câu mở.

### Nguồn tham khảo

- Shannon, C. E., & Weaver, W. (1949). *The Mathematical Theory of Communication.* Urbana: University of Illinois Press.
- Berlo, D. K. (1960). *The Process of Communication.* New York: Holt, Rinehart & Winston.
- Schramm, W. (1954). How communication works. In W. Schramm (Ed.), *The Process and Effects of Mass Communication.* Urbana: University of Illinois Press.
- Clark, H. H., & Brennan, S. E. (1991). Grounding in communication. In *Perspectives on Socially Shared Cognition* (pp. 127–149). Washington: APA.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 5.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "5.1-giai-ma",
                "type": "mcq",
                "prompt": "Trong quá trình giao tiếp, giai đoạn giải mã thông điệp diễn ra khi nào?",
                "explanation": "Giải mã là khi người nhận chuyển các tín hiệu đã tiếp nhận thành ý nghĩa, dựa trên vốn từ, kinh nghiệm và trạng thái của chính họ.",
                "points": 2,
                "options": [
                    {"label": "Khi người nhận chuyển các tín hiệu đã tiếp nhận thành ý nghĩa theo kinh nghiệm của chính họ", "isCorrect": True},
                    {"label": "Khi người gửi chọn từ ngữ để diễn đạt ý của mình", "isCorrect": False},
                    {"label": "Khi thông điệp được truyền qua kênh tới người nhận", "isCorrect": False},
                    {"label": "Khi người nhận gửi phản hồi trở lại người gửi", "isCorrect": False},
                ],
            },
            {
                "key": "5.1-hai-chieu",
                "type": "mcq",
                "prompt": "Trong một cuộc trò chuyện hai người, biểu hiện nào thể hiện rõ nhất nguyên tắc giao tiếp hai chiều?",
                "explanation": "Hai chiều nghĩa là có phản hồi đi ngược lại và người nói điều chỉnh theo phản hồi đó — không chỉ là thay nhau nói.",
                "points": 2,
                "options": [
                    {"label": "Người nói quan sát phản ứng của người nghe, hỏi lại và điều chỉnh cách diễn đạt ngay trong lúc nói", "isCorrect": True},
                    {"label": "Người nói trình bày trọn vẹn ý của mình rồi mới để người kia nói", "isCorrect": False, "misconception": "knm.sent-equals-received"},
                    {"label": "Hai người thay nhau nói với thời lượng bằng nhau", "isCorrect": False},
                    {"label": "Người nghe gật đầu liên tục để thể hiện mình đang nghe", "isCorrect": False, "misconception": "knm.silence-means-understood"},
                ],
            },
            {
                "key": "5.1-nhieu",
                "type": "matching",
                "prompt": "Nối mỗi tình huống với loại nhiễu tương ứng.",
                "explanation": "Nhiễu vật lý đến từ môi trường và kênh; nhiễu ngữ nghĩa từ cách dùng từ; nhiễu tâm sinh lý từ trạng thái cơ thể; nhiễu tâm lý – xã hội từ định kiến và quan hệ quyền lực.",
                "points": 3,
                "pairs": [
                    {"left": "Họp online mạng lag, câu được câu mất", "right": "Nhiễu vật lý"},
                    {"left": "Trưởng nhóm dặn gửi sớm, mỗi người hiểu một mốc khác nhau", "right": "Nhiễu ngữ nghĩa"},
                    {"left": "Nghe phổ biến quy chế lúc đang đói và buồn ngủ", "right": "Nhiễu tâm sinh lý"},
                    {"left": "Không dám hỏi lại vì ngại người hướng dẫn đánh giá là chậm hiểu", "right": "Nhiễu tâm lý – xã hội"},
                ],
            },
            {
                "key": "5.1-xac-nhan-y-hieu",
                "type": "mcq",
                "prompt": "Sau khi hướng dẫn nhóm cách thực hiện một nhiệm vụ mới, bạn muốn kiểm tra xem mọi người đã hiểu đúng chưa. Cách nào hiệu quả nhất?",
                "explanation": "Câu hỏi rõ chưa gợi ý sẵn câu trả lời. Nhờ người nghe tóm tắt lại phần việc và hạn nộp bằng lời của họ mới cho thấy thông tin đã tới nơi hay chưa.",
                "points": 3,
                "options": [
                    {"label": "Nhờ một vài người tóm tắt lại phần việc của họ và hạn nộp bằng lời của chính họ", "isCorrect": True},
                    {"label": "Hỏi cả nhóm mọi người rõ chưa và chờ mọi người gật đầu", "isCorrect": False, "misconception": "knm.silence-means-understood"},
                    {"label": "Gửi lại toàn bộ hướng dẫn qua tin nhắn cho chắc", "isCorrect": False, "misconception": "knm.sent-equals-received"},
                    {"label": "Nhắc lại một lần nữa thật chậm và rõ ràng", "isCorrect": False, "misconception": "knm.sent-equals-received"},
                ],
            },
            {
                "key": "5.1-nhan-viec-chua-ro",
                "type": "mcq",
                "prompt": "Bạn nhận nhiệm vụ từ giảng viên nhưng chưa chắc mình hiểu đúng yêu cầu. Cách đáp lại phù hợp nhất là gì?",
                "explanation": "Diễn đạt lại yêu cầu bằng lời của mình rồi xin xác nhận vừa kiểm được cách hiểu, vừa không đẩy người kia vào thế phải giảng lại từ đầu.",
                "points": 2,
                "options": [
                    {"label": "Diễn đạt lại yêu cầu bằng lời của mình kèm mốc thời gian, rồi hỏi em hiểu đúng chưa ạ", "isCorrect": True},
                    {"label": "Im lặng làm theo cách mình đoán, sai thì sửa sau", "isCorrect": False, "misconception": "knm.silence-means-understood"},
                    {"label": "Hỏi lại thầy nói lại từ đầu được không ạ", "isCorrect": False},
                    {"label": "Hỏi bạn cùng lớp xem họ hiểu thế nào rồi làm theo", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                ],
            },
            {
                "key": "5.1-mo-ho-thanh-so",
                "type": "mcq",
                "prompt": "Câu nhắn nào giảm nhiễu ngữ nghĩa tốt nhất?",
                "explanation": "Từ chỉ thời gian, số lượng và mức độ phải được đổi thành con số và mốc cụ thể, vì mỗi người giải mã các từ mơ hồ theo một cách khác nhau.",
                "points": 2,
                "options": [
                    {"label": "Gửi mình bản nháp phần 2 trước 16h thứ năm, khoảng 2 trang, có bảng số liệu là được", "isCorrect": True},
                    {"label": "Gửi mình bản nháp sớm nhất có thể nhé, làm kỹ vào", "isCorrect": False, "misconception": "knm.jargon-professional"},
                    {"label": "Cứ deadline mà làm, tuần này nhé", "isCorrect": False, "misconception": "knm.jargon-professional"},
                    {"label": "Nhớ gửi đúng format như lần trước", "isCorrect": False, "misconception": "knm.jargon-professional"},
                ],
            },
            {
                "key": "5.1-viet-nhieu",
                "type": "essay",
                "prompt": "Nhớ lại một lần bạn và người khác hiểu khác nhau về cùng một việc. Viết 150–250 từ: (a) thông điệp gốc và cách nó được diễn đạt; (b) người kia đã giải mã thành nghĩa gì; (c) loại nhiễu nào đã xen vào; (d) viết lại thông điệp ấy sao cho mọi từ mơ hồ được thay bằng con số hoặc mốc thời gian.",
                "points": 5,
            },
        ],
    },
}

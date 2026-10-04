# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 6 · Dùng AI hỗ trợ viết có kiểm soát",
    "durationMin": 75,
    "description": "Dùng AI đúng vai trò trợ lý văn phong, không để AI viết thay nội dung khoa học; khai báo sử dụng AI theo yêu cầu tạp chí; tự tay kiểm chứng mọi trích dẫn AI gợi ý vì AI có thể tạo ra nguồn không tồn tại; hiểu vì sao AI không thể được ghi là tác giả.",
    "objectives": [
        "Phân biệt được việc dùng AI đúng vai trò (sửa văn phong, gợi ý cấu trúc) với việc để AI viết thay nội dung khoa học chưa qua kiểm chứng",
        "Khai báo đúng cách sử dụng AI trong bài báo theo yêu cầu ngày càng phổ biến của các tạp chí quốc tế",
        "Tự tay kiểm chứng mọi trích dẫn hoặc claim do AI gợi ý trước khi đưa vào bản thảo, vì AI có thể tạo ra nguồn không tồn tại một cách rất tự nhiên",
        "Giải thích được vì sao một công cụ AI không thể được ghi là tác giả hoặc đồng tác giả theo tiêu chí ICMJE",
    ],
    "summary": [
        "AI hỗ trợ viết tốt nhất ở vai trò trợ lý văn phong — sửa ngữ pháp, gợi ý cách diễn đạt tiếng Anh, tóm tắt nhanh để quyết định đọc kỹ — không nên để AI viết thay toàn bộ nội dung khoa học như phần Kết quả hoặc Discussion.",
        "Nhiều tạp chí quốc tế hiện yêu cầu khai báo cụ thể việc sử dụng AI hỗ trợ viết, thường ở phần Methods hoặc Acknowledgment — không khai báo khi đã dùng AI đáng kể là vi phạm quy định ngày càng phổ biến này.",
        "AI có thể tạo ra trích dẫn hoàn toàn không tồn tại (tên tác giả, năm, tên bài giả) một cách rất tự nhiên và thuyết phục — mọi trích dẫn do AI gợi ý phải được tự tay kiểm tra nguồn thật trước khi đưa vào bản thảo.",
        "AI không thể chịu trách nhiệm về nội dung công bố — một trong ba tiêu chí ICMJE bắt buộc với tác giả — nên không thể được ghi là tác giả hoặc đồng tác giả, dù đóng góp bao nhiêu vào việc viết.",
    ],
    "splitSections": True,
    "body": r"""
Công cụ AI (Claude, ChatGPT...) có thể tăng tốc đáng kể việc viết bài báo tiếng Anh (Bài 4) — nhưng chỉ khi dùng đúng vai trò và kiểm soát chặt, vì hậu quả của việc dùng sai ở mức công bố quốc tế nghiêm trọng hơn nhiều so với một bài tập trong lớp. Bài đi qua bốn phần: vai trò đúng của AI là trợ lý văn phong chứ không viết thay nội dung khoa học; khai báo việc dùng AI theo yêu cầu của tạp chí; tự tay kiểm chứng mọi trích dẫn AI gợi ý vì AI có thể tạo ra nguồn không tồn tại; và kết bằng lý do vì sao AI không thể được ghi là tác giả.

## Vai trò đúng của AI trong viết bài báo

> [!ghi-nho] AI phù hợp nhất ở vai trò **trợ lý văn phong**: sửa ngữ pháp và cách diễn đạt tiếng Anh, gợi ý cách viết lại một câu cho súc tích hơn, hoặc tóm tắt nhanh một bài báo để quyết định có đọc kỹ hay không (đọc chiến lược, đã học ở các khoá trước). AI **không** nên được dùng để viết thay nội dung khoa học — đặc biệt phần Kết quả (mô tả dữ liệu thật của bạn) và phần lớn Discussion (diễn giải đòi hỏi hiểu sâu bối cảnh nghiên cứu của chính bạn).

> [!canh-bao] Đưa số liệu vào AI và yêu cầu "viết phần Discussion cho tôi", rồi nộp thẳng kết quả mà không tự kiểm chứng và viết lại theo hiểu biết của mình, là để AI làm việc mà chính bạn phải chịu trách nhiệm chuyên môn. AI không biết bối cảnh nghiên cứu của bạn sâu bằng bạn, và không thể chịu trách nhiệm nếu diễn giải sai.

> [!vi-du] Dùng đúng vai trò trợ lý văn phong: bản gốc do chính tác giả viết — "*The result show that teacher which have more experience with AI tool have less worry about it, this maybe because they understand more how it work.*" (nội dung và ý là của tác giả, chỉ ngữ pháp/diễn đạt còn thô). Sau khi yêu cầu AI "sửa ngữ pháp và cách diễn đạt, giữ nguyên ý" — "*The results show that teachers with more experience using AI tools report lower levels of concern, possibly because greater familiarity leads to a better understanding of how the tool functions.*" Nội dung khoa học (ai nói gì với ai) hoàn toàn không đổi — chỉ ngữ pháp và cách diễn đạt được cải thiện. Đây là ranh giới đúng: nếu so sánh bản trước/sau mà **ý** đã khác (thêm claim mới, đổi mức độ chắc chắn), đó không còn là sửa văn phong nữa.

## Khai báo sử dụng AI

> [!ghi-nho] Nhiều tạp chí quốc tế hiện yêu cầu khai báo cụ thể nếu AI được dùng đáng kể trong việc viết bản thảo — thường ở phần Methods (nếu AI được dùng trong phân tích) hoặc một mục riêng gần Acknowledgment (nếu dùng để hỗ trợ viết văn phong). Yêu cầu này dựa trên hướng dẫn của COPE (Committee on Publication Ethics) và ngày càng phổ biến.

> [!canh-bao] Không khai báo dù đã dùng AI đáng kể để soạn hoặc chỉnh sửa văn bản, khi tạp chí yêu cầu khai báo, là vi phạm quy định xuất bản — tương tự việc không khai báo một nguồn tài trợ hoặc xung đột lợi ích. Kiểm hướng dẫn "Instructions for Authors" của từng tạp chí trước khi gửi, vì yêu cầu khai báo khác nhau giữa các tạp chí.

> [!vi-du] Một đoạn khai báo mẫu (dịch từ khuyến nghị COPE, điều chỉnh cho trường hợp chỉ dùng để sửa văn phong): "*During the preparation of this manuscript, the author(s) used [tên công cụ, ví dụ ChatGPT-4] to improve the language and readability of the text. After using this tool, the author(s) reviewed and edited the content as needed and take(s) full responsibility for the content of the published article.*" Nếu AI cũng được dùng để hỗ trợ tìm ý tưởng phân tích (không chỉ văn phong), khai báo cần nói rõ thêm ở phần nào và mức độ ra sao — không dùng một câu chung chung cho mọi trường hợp sử dụng.

## Kiểm chứng mọi trích dẫn do AI gợi ý

> [!canh-bao] Mô hình ngôn ngữ có thể tạo ra trích dẫn **hoàn toàn không tồn tại** — tên tác giả, năm, tên bài báo nghe rất hợp lý và đúng định dạng, nhưng không có thật — một hiện tượng gọi là "hallucination". Điều nguy hiểm là văn bản do AI viết ra luôn đọc trôi chảy và tự tin, không có dấu hiệu nào cho thấy trích dẫn đó là giả.

> [!ghi-nho] Nguyên tắc bắt buộc: **mọi trích dẫn xuất hiện trong bản thảo phải được tự tay tra lại** — tìm đúng bài báo đó trên Google Scholar/Scopus, xác nhận tên tác giả, năm, và đặc biệt là nội dung claim có đúng như bài gốc nói không (AI cũng có thể trích dẫn đúng một nguồn có thật nhưng gán sai nội dung cho nó). Không có ngoại lệ, kể cả khi trích dẫn "nghe rất quen".

> [!vi-du] Một nghiên cứu sinh dùng AI để soạn nhanh phần tổng quan, AI trích "Nguyen & Pham (2021), published in Journal of Educational Technology, found that AI feedback increases motivation by 23%". Khi tra lại, không tìm thấy bài báo này tồn tại — AI đã tạo ra một trích dẫn nghe hợp lý (đúng kiểu tên tác giả Việt Nam, đúng kiểu tạp chí, số liệu cụ thể tăng độ tin) nhưng hoàn toàn giả. Nếu nộp thẳng không kiểm tra, đây trở thành một trích dẫn giả trong bài báo công bố — hậu quả nghiêm trọng hơn rất nhiều so với một lỗi thông thường.

## AI không thể là tác giả

> [!canh-bao] Theo tiêu chí ICMJE (Bài 5), một tác giả phải **chịu trách nhiệm về nội dung công bố** — một công cụ AI không thể chịu trách nhiệm, không thể được liên hệ để giải trình, và không có sự đồng ý (trong nghĩa pháp lý/đạo đức) về việc công bố. Do đó, dù AI đóng góp bao nhiêu vào việc viết, nó **không thể được ghi là tác giả hoặc đồng tác giả** — hướng dẫn này được ICMJE, COPE và hầu hết các tạp chí lớn khẳng định rõ.

## Luyện tập và tài liệu tham khảo

### Cá nhân (30 phút)

Rà lại một đoạn bản thảo (nếu đã dùng AI hỗ trợ) và phân loại từng câu: AI chỉ sửa văn phong (giữ nguyên nội dung của bạn), hay AI đã tạo ra nội dung/claim mới cần kiểm chứng lại? Với mọi trích dẫn trong bản thảo, tự tay tra lại nguồn — đặc biệt các trích dẫn được gợi ý bởi AI.

### Nhóm 3-4 người (20 phút)

Đọc hướng dẫn "Instructions for Authors" của một tạp chí bạn đang cân nhắc, tìm phần yêu cầu khai báo AI (nếu có). Chia sẻ cách bạn dự định khai báo việc dùng AI trong bản thảo của mình.

### Bài tập về nhà (30-45 phút)

Viết đoạn khai báo sử dụng AI (nếu có dùng) cho bài báo của bạn, và danh sách xác nhận đã tự tay kiểm tra từng trích dẫn trong bản thảo.

:::mau Mẫu nộp bài tập về nhà
**Đoạn khai báo sử dụng AI (nếu có):** …

**Danh sách trích dẫn đã kiểm tra tự tay**

| Trích dẫn trong bản thảo | Đã tra lại nguồn thật? | Nội dung claim khớp với bài gốc không? |
|---|---|---|
| … | … | … |
:::

### Nguồn tham khảo

- Committee on Publication Ethics (COPE). (2023). *Authorship and AI Tools.* COPE Position Statement.
- International Committee of Medical Journal Editors. (2024). *Defining the Role of Authors and Contributors.*
- Thorp, H. H. (2023). ChatGPT is fun, but not an author. *Science*, 379(6630), 313.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 6",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "cbqt6-vai-tro-ai",
                "type": "mcq",
                "prompt": "Một nghiên cứu sinh nhập số liệu vào AI và yêu cầu 'viết phần Discussion cho tôi', rồi nộp thẳng kết quả. Vấn đề của cách làm này là gì?",
                "explanation": "AI không biết bối cảnh nghiên cứu sâu bằng chính người nghiên cứu và không thể chịu trách nhiệm nếu diễn giải sai — để AI viết thay nội dung khoa học đòi hỏi hiểu sâu là dùng sai vai trò của công cụ.",
                "points": 2,
                "options": [
                    {"label": "AI không hiểu bối cảnh nghiên cứu sâu bằng người nghiên cứu, và không thể chịu trách nhiệm nếu diễn giải sai", "isCorrect": True},
                    {"label": "Không có vấn đề gì, miễn là văn phong đọc trôi chảy", "isCorrect": False, "misconception": "cbqt.ai-writes-content"},
                    {"label": "Không có vấn đề gì, vì AI luôn hiểu dữ liệu tốt hơn con người", "isCorrect": False, "misconception": "cbqt.ai-writes-content"},
                    {"label": "Vấn đề duy nhất là cần yêu cầu AI viết dài hơn", "isCorrect": False, "misconception": "cbqt.ai-writes-content"},
                ],
            },
            {
                "key": "cbqt6-khai-bao-ai",
                "type": "mcq",
                "prompt": "Một tạp chí yêu cầu khai báo nếu AI được dùng đáng kể để soạn bản thảo. Một tác giả đã dùng AI để viết lại nhiều đoạn nhưng không khai báo. Đây là vấn đề gì?",
                "explanation": "Không khai báo dù tạp chí yêu cầu là vi phạm quy định xuất bản, tương tự việc không khai báo nguồn tài trợ hoặc xung đột lợi ích.",
                "points": 2,
                "options": [
                    {"label": "Vi phạm quy định khai báo của tạp chí, tương tự việc không khai báo xung đột lợi ích", "isCorrect": True},
                    {"label": "Không có vấn đề gì nếu văn bản cuối cùng không có lỗi ngữ pháp", "isCorrect": False, "misconception": "cbqt.no-ai-disclosure"},
                    {"label": "Không cần khai báo vì AI chỉ là một công cụ soạn thảo văn bản thông thường", "isCorrect": False, "misconception": "cbqt.no-ai-disclosure"},
                    {"label": "Chỉ cần khai báo nếu bài báo bị phát hiện dùng AI", "isCorrect": False, "misconception": "cbqt.no-ai-disclosure"},
                ],
            },
            {
                "key": "cbqt6-trich-dan-gia",
                "type": "mcq",
                "prompt": "AI gợi ý một trích dẫn 'Nguyen & Pham (2021), Journal of Educational Technology' nghe rất hợp lý. Trước khi đưa vào bản thảo, cần làm gì?",
                "explanation": "AI có thể tạo ra trích dẫn hoàn toàn không tồn tại một cách rất tự nhiên. Mọi trích dẫn do AI gợi ý phải được tự tay tra lại nguồn thật và xác nhận nội dung claim khớp với bài gốc.",
                "points": 3,
                "options": [
                    {"label": "Tự tay tra lại trên Google Scholar/Scopus để xác nhận bài báo này có thật và nội dung khớp với claim", "isCorrect": True},
                    {"label": "Không cần kiểm tra gì, vì trích dẫn nghe hợp lý và đúng định dạng học thuật", "isCorrect": False, "misconception": "cbqt.unverified-ai-citations"},
                    {"label": "Chỉ cần kiểm tra nếu năm xuất bản nghe không hợp lý", "isCorrect": False, "misconception": "cbqt.unverified-ai-citations"},
                    {"label": "Tin tưởng trích dẫn này vì AI không bao giờ tạo ra nguồn giả", "isCorrect": False, "misconception": "cbqt.unverified-ai-citations"},
                ],
            },
            {
                "key": "cbqt6-ai-khong-la-tac-gia",
                "type": "mcq",
                "prompt": "Một nhóm tác giả muốn ghi tên công cụ AI đã hỗ trợ viết đáng kể như một đồng tác giả trong bài báo. Đây có phù hợp không?",
                "explanation": "Một tác giả phải chịu trách nhiệm về nội dung công bố theo tiêu chí ICMJE — AI không thể chịu trách nhiệm hoặc được liên hệ để giải trình, nên không thể được ghi là tác giả hoặc đồng tác giả dù đóng góp bao nhiêu.",
                "points": 3,
                "options": [
                    {"label": "Không phù hợp — AI không thể chịu trách nhiệm về nội dung công bố nên không đủ điều kiện làm tác giả", "isCorrect": True},
                    {"label": "Phù hợp, nếu AI đóng góp đáng kể vào việc viết bản thảo", "isCorrect": False, "misconception": "cbqt.ai-as-coauthor"},
                    {"label": "Phù hợp, miễn là ghi rõ tên công cụ và phiên bản đã dùng", "isCorrect": False, "misconception": "cbqt.ai-as-coauthor"},
                    {"label": "Chỉ phù hợp nếu tạp chí không có quy định cụ thể về việc này", "isCorrect": False, "misconception": "cbqt.ai-as-coauthor"},
                ],
            },
            {
                "key": "cbqt6-vai-tro-phu-hop",
                "type": "mcq",
                "prompt": "Việc dùng AI nào dưới đây phù hợp nhất với vai trò 'trợ lý văn phong'?",
                "explanation": "Sửa lại cách diễn đạt một câu tiếng Anh đã viết sẵn, giữ nguyên nội dung và ý nghĩa của người viết, là đúng vai trò trợ lý văn phong — khác với việc để AI tạo ra nội dung/claim khoa học mới.",
                "points": 2,
                "options": [
                    {"label": "Yêu cầu AI sửa lại cách diễn đạt một câu tiếng Anh đã viết sẵn, giữ nguyên nội dung", "isCorrect": True},
                    {"label": "Yêu cầu AI tự phân tích dữ liệu và viết kết luận mà không kiểm tra lại", "isCorrect": False},
                    {"label": "Yêu cầu AI tạo ra một đóng góp lý thuyết mới thay cho tác giả", "isCorrect": False},
                    {"label": "Yêu cầu AI viết toàn bộ phần Discussion từ đầu tới cuối rồi nộp thẳng", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt6-thu-tu-kiem-soat-ai",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước dùng AI hỗ trợ viết bài báo một cách có kiểm soát.",
                "explanation": "Từ dùng AI cho vai trò trợ lý văn phong, kiểm tra hướng dẫn khai báo của tạp chí, tự tay tra lại mọi trích dẫn, tới không ghi AI là tác giả trong danh sách cuối cùng.",
                "points": 3,
                "sequence": [
                    "Dùng AI để sửa văn phong hoặc gợi ý cách diễn đạt, không để AI viết thay nội dung khoa học",
                    "Kiểm hướng dẫn 'Instructions for Authors' của tạp chí về yêu cầu khai báo AI",
                    "Tự tay tra lại mọi trích dẫn xuất hiện trong bản thảo, đặc biệt trích dẫn do AI gợi ý",
                    "Viết đoạn khai báo sử dụng AI nếu tạp chí yêu cầu",
                    "Không ghi công cụ AI vào danh sách tác giả khi hoàn thiện bản thảo",
                ],
            },
            {
                "key": "cbqt6-noi-khai-niem-ai",
                "type": "matching",
                "prompt": "Nối mỗi khái niệm với đúng nguyên tắc sử dụng AI trong viết bài báo.",
                "explanation": "Vai trò trợ lý văn phong là dùng đúng cách; hallucination là rủi ro cần tự tay kiểm chứng; khai báo AI là yêu cầu của nhiều tạp chí; tiêu chí ICMJE giải thích vì sao AI không thể là tác giả.",
                "points": 3,
                "pairs": [
                    {"left": "Vai trò trợ lý văn phong", "right": "Sửa ngữ pháp, gợi ý diễn đạt — không viết thay nội dung khoa học"},
                    {"left": "AI hallucination", "right": "AI có thể tạo ra trích dẫn hoàn toàn không tồn tại một cách tự nhiên"},
                    {"left": "Khai báo sử dụng AI", "right": "Yêu cầu ngày càng phổ biến ở nhiều tạp chí quốc tế"},
                    {"left": "Tiêu chí ICMJE về tác giả", "right": "Giải thích vì sao AI không thể chịu trách nhiệm và không được ghi là tác giả"},
                ],
            },
            {
                "key": "cbqt6-viet-khai-bao",
                "type": "essay",
                "prompt": "Viết đoạn khai báo sử dụng AI cho bài báo của bạn (100-150 từ, dù có dùng hay không), mô tả cụ thể: (a) công cụ AI đã dùng (nếu có) và ở phần nào của bản thảo; (b) cách bạn đã kiểm chứng lại nội dung/trích dẫn do AI gợi ý; (c) xác nhận AI không được ghi là tác giả.",
                "points": 5,
            },
        ],
    },
}

# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5 · Đạo đức khi dùng AI trong toàn bộ quy trình nghiên cứu",
    "durationMin": 90,
    "description": "Nhận diện rủi ro AI riêng ở từng giai đoạn nghiên cứu (tổng quan, thu thập, phân tích — không chỉ viết bài); tự kiểm chứng kết quả AI phân tích thay vì tin tuyệt đối; phân biệt dữ liệu tổng hợp chính đáng với ngụy tạo dữ liệu; đọc nguồn gốc thay vì chỉ dựa vào tóm tắt AI.",
    "objectives": [
        "Nhận diện rủi ro đạo đức riêng của AI ở ba giai đoạn nghiên cứu: tổng quan tài liệu, thu thập dữ liệu, và phân tích dữ liệu",
        "Áp dụng nguyên tắc tự kiểm chứng kết quả phân tích do AI đưa ra, không chấp nhận AI như một hộp đen đáng tin tuyệt đối",
        "Phân biệt việc dùng dữ liệu tổng hợp (synthetic data) một cách chính đáng với việc ngụy tạo dữ liệu bằng AI",
        "Đọc nguồn gốc tài liệu thay vì chỉ dựa vào bản tóm tắt do AI tạo ra trước khi trích dẫn vào bản thảo",
    ],
    "summary": [
        "AI mang lại rủi ro đạo đức khác nhau ở từng giai đoạn nghiên cứu — rủi ro khi dùng AI tổng hợp tài liệu (bỏ qua đọc nguồn gốc) khác với rủi ro khi dùng AI phân tích dữ liệu (chấp nhận kết quả không kiểm chứng), khác với rủi ro khi viết bài (đã học ở khoá NCKH nâng cao, Bài 6).",
        "Dùng AI để phân tích dữ liệu (gợi ý mô hình, chạy thống kê) mà không tự kiểm chứng bằng công cụ chuẩn hoặc hiểu được logic tính toán là coi AI như một hộp đen đáng tin tuyệt đối — rủi ro cao khi AI đưa ra kết quả sai mà không có dấu hiệu cảnh báo nào.",
        "Dữ liệu tổng hợp (synthetic data) chính đáng khi dùng để thử nghiệm pipeline phân tích hoặc bảo vệ quyền riêng tư — nhưng báo cáo dữ liệu tổng hợp như thể là dữ liệu thu thập thật là ngụy tạo dữ liệu (fabrication), một vi phạm liêm chính nghiêm trọng đã học ở Bài 1.",
        "Dùng bản tóm tắt tài liệu do AI tạo ra để quyết định có đáng đọc kỹ hay không là hợp lý, nhưng trước khi trích dẫn bất kỳ luận điểm hay số liệu nào vào bản thảo, luôn phải tự đọc lại nguồn gốc để xác nhận tóm tắt phản ánh đúng nội dung.",
    ],
    "splitSections": True,
    "body": r"""
Khoá NCKH nâng cao & Công bố quốc tế (Bài 6) đã dạy dùng AI có kiểm soát khi VIẾT bài báo — vai trò trợ lý văn phong, khai báo sử dụng, kiểm chứng trích dẫn. Bài này mở rộng ra các giai đoạn khác của quy trình nghiên cứu, nơi rủi ro đạo đức khác hẳn. Bài đi qua bốn phần: mở đầu bằng bản đồ rủi ro AI ở từng giai đoạn nghiên cứu; sau đó đi sâu vào rủi ro coi AI như hộp đen khi hỗ trợ phân tích dữ liệu; tiếp theo phân biệt dữ liệu tổng hợp dùng chính đáng với việc ngụy tạo dữ liệu bằng AI; và kết bằng nguyên tắc đọc nguồn gốc thay vì chỉ dựa vào tóm tắt AI khi tổng hợp tài liệu.

## Bốn giai đoạn dùng AI và rủi ro riêng từng giai đoạn

> [!ghi-nho] AI có thể tham gia ở nhiều giai đoạn nghiên cứu, mỗi giai đoạn mang rủi ro đạo đức khác nhau: **(1) Tổng quan tài liệu** — rủi ro trích dẫn giả (hallucination) và dựa vào tóm tắt thay vì đọc gốc; **(2) Thu thập dữ liệu** — rủi ro dùng dữ liệu tổng hợp thay dữ liệu thật mà không khai báo; **(3) Phân tích dữ liệu** — rủi ro chấp nhận kết quả không kiểm chứng được; **(4) Viết bài** — đã học kỹ ở khoá NCKH nâng cao, Bài 6 (vai trò trợ lý văn phong, không viết thay nội dung khoa học).

| Giai đoạn | Rủi ro đạo đức đặc trưng | Đã học ở đâu |
|---|---|---|
| Tổng quan tài liệu | Trích dẫn giả (hallucination); dựa vào tóm tắt AI mà không đọc gốc | Một phần ở Khóa 3 Bài 6 (trích dẫn khi viết); bài này mở rộng sang cả khâu tổng hợp tài liệu |
| Thu thập dữ liệu | Dùng dữ liệu tổng hợp thay dữ liệu thật mà không khai báo | Chưa học — trọng tâm chính của bài này |
| Phân tích dữ liệu | Chấp nhận kết quả AI không kiểm chứng được | Chưa học — trọng tâm chính của bài này |
| Viết bài | Vai trò trợ lý văn phong, khai báo sử dụng, không được là tác giả | Khóa 3 (NCKH nâng cao), Bài 6 |

## AI hỗ trợ phân tích dữ liệu: rủi ro hộp đen

> [!canh-bao] Dùng AI để phân tích dữ liệu — ví dụ yêu cầu AI "chạy hồi quy cho bộ dữ liệu này và cho tôi kết quả" — rồi chấp nhận kết quả mà không tự kiểm chứng bằng công cụ thống kê chuẩn (SPSS, R) hoặc hiểu được logic tính toán, là coi AI như một **hộp đen đáng tin tuyệt đối**. Khác với công cụ thống kê truyền thống (có thể kiểm tra công thức, xem log tính toán), một số công cụ AI tạo sinh có thể đưa ra kết quả sai (ví dụ nhầm công thức, tính sai bậc tự do) mà không có dấu hiệu cảnh báo nào — câu trả lời vẫn đọc tự tin và có định dạng đúng.

> [!ghi-nho] Nguyên tắc: dùng kết quả AI phân tích như một **gợi ý ban đầu** hoặc để tăng tốc thao tác (ví dụ viết code phân tích), nhưng luôn tự kiểm chứng lại bằng công cụ thống kê chuẩn cho những phần quan trọng của bài báo, hoặc tự tay tính lại một phần đủ để tin tưởng vào logic tính toán trước khi dùng cho toàn bộ bộ dữ liệu.

> [!vi-du] Một nghiên cứu sinh dùng AI để viết code R chạy mô hình hồi quy đa biến cho một bộ dữ liệu 200 quan sát. Thay vì chỉ chạy code và chép kết quả, nghiên cứu sinh đối chiếu: hệ số hồi quy có dấu (+/-) hợp lý với kỳ vọng lý thuyết không? R² có nằm trong khoảng hợp lý so với các nghiên cứu tương tự đã đọc ở phần tổng quan không? Chạy lại với một phần mềm khác (ví dụ SPSS) cho 2-3 biến chính để đối chiếu con số có khớp không. Việc đối chiếu này phát hiện AI đã nhầm cách mã hoá một biến định danh (dummy coding sai), dẫn tới hệ số hồi quy sai lệch — nếu không kiểm chứng, sai sót này sẽ đi thẳng vào bài báo.

## Dữ liệu tổng hợp: chính đáng hay ngụy tạo

> [!ghi-nho] **Dữ liệu tổng hợp (synthetic data)** — dữ liệu được tạo ra bằng thuật toán (kể cả AI) để có đặc điểm thống kê tương tự dữ liệu thật — có ứng dụng chính đáng: thử nghiệm pipeline phân tích trước khi có dữ liệu thật (kiểm code có chạy đúng không), hoặc bảo vệ quyền riêng tư khi cần chia sẻ dữ liệu công khai mà không lộ thông tin cá nhân thật.

> [!canh-bao] Ranh giới với **ngụy tạo dữ liệu (fabrication, đã học ở Bài 1)** nằm ở việc **khai báo**: dùng dữ liệu tổng hợp để thử nghiệm rồi công bố kết quả phân tích trên dữ liệu tổng hợp đó **như thể là dữ liệu thu thập thật** — ví dụ dùng AI tạo ra 200 "phản hồi khảo sát" giả để lấp đầy cỡ mẫu còn thiếu, rồi báo cáo N=200 như dữ liệu thu thập được — là ngụy tạo dữ liệu, một vi phạm liêm chính nghiêm trọng, dù công cụ tạo ra nó là AI hiện đại thay vì tự tay bịa số như trước đây.

| Tình huống | Chính đáng hay ngụy tạo? |
|---|---|
| Dùng AI tạo 50 dòng dữ liệu giả để kiểm tra code phân tích chạy đúng trước khi có dữ liệu thật, không đưa vào báo cáo kết quả | Chính đáng (chỉ để thử pipeline) |
| Dùng AI tạo thêm 40 "phản hồi khảo sát" để đủ cỡ mẫu 200 như đã đăng ký trong protocol, gộp chung và báo cáo N=200 thu thập được | Ngụy tạo dữ liệu (fabrication) |
| Công bố một bộ dữ liệu tổng hợp thay cho dữ liệu thật để chia sẻ công khai, có ghi rõ "đây là dữ liệu tổng hợp mô phỏng theo phân phối của dữ liệu gốc" | Chính đáng (đã khai báo rõ ràng) |

## AI trong thu thập và tổng hợp tài liệu

> [!canh-bao] Khác với rủi ro trích dẫn giả khi VIẾT bài (đã học kỹ ở Khóa 3, Bài 6), rủi ro ở khâu **tổng hợp tài liệu** là: yêu cầu AI "tóm tắt xu hướng nghiên cứu về chủ đề X trong 5 năm qua" và dùng bản tóm tắt đó để định hình cả cấu trúc tổng quan tài liệu, mà không tự đọc phần lớn các nguồn được liệt kê. Bản tóm tắt AI có thể bỏ sót sắc thái quan trọng (một nghiên cứu có phát hiện trái ngược nhưng bị gộp chung vào xu hướng đa số), hoặc đơn giản hoá quá mức một tranh luận học thuật đang diễn ra.

> [!ghi-nho] Nguyên tắc: dùng tóm tắt AI để **quyết định có đáng đọc kỹ hay không** (đọc chiến lược, tiết kiệm thời gian sàng lọc ban đầu) — nhưng với bất kỳ nguồn nào sẽ được trích dẫn hoặc dùng để định hình lập luận trong bản thảo, luôn tự đọc lại nguồn gốc đầy đủ, không chỉ dựa vào tóm tắt.

## Luyện tập và tài liệu tham khảo

### Cá nhân (35 phút)

Rà lại cách bạn đang dùng AI trong quy trình nghiên cứu của mình (nếu có): phân loại theo 4 giai đoạn ở mục 1. Với khâu phân tích (nếu có dùng AI), mô tả cách bạn sẽ kiểm chứng lại kết quả. Với khâu tổng quan tài liệu, kiểm: có nguồn nào bạn mới chỉ đọc qua tóm tắt AI mà chưa đọc gốc không?

### Nhóm 3-4 người (25 phút)

Đọc bảng "Dữ liệu tổng hợp: chính đáng hay ngụy tạo" ở mục 3. Thảo luận thêm một tình huống ranh giới (ví dụ: dùng AI tạo dữ liệu mô phỏng cho power analysis trước khi thu thập — có cần khai báo không, và khai báo ở đâu trong bài báo?).

### Bài tập về nhà (45-60 phút)

Viết một đoạn (200-250 từ) mô tả nguyên tắc bạn sẽ áp dụng khi dùng AI ở từng giai đoạn nghiên cứu của đề tài mình (tổng quan, thu thập, phân tích — không cần nhắc lại phần viết bài đã học ở Khóa 3), kèm ít nhất một ví dụ cụ thể về cách kiểm chứng.

:::mau Mẫu nộp bài tập về nhà
**Nguyên tắc dùng AI trong tổng quan tài liệu (kèm cách kiểm chứng nguồn):** …

**Nguyên tắc dùng AI trong thu thập dữ liệu, nếu có (kèm cách khai báo nếu dùng dữ liệu tổng hợp):** …

**Nguyên tắc dùng AI trong phân tích dữ liệu (kèm cách kiểm chứng kết quả):** …
:::

### Nguồn tham khảo

- Committee on Publication Ethics (COPE). (2023). *Authorship and AI Tools.* COPE Position Statement.
- Resnik, D. B., & Hosseini, M. (2025). The ethics of using artificial intelligence in scientific research: new guidance needed for a new tool. *AI and Ethics*.
- Jobin, A., Ienca, M., & Vayena, E. (2019). The global landscape of AI ethics guidelines. *Nature Machine Intelligence*, 1(9), 389-399.
- Raghunathan, T. E. (2021). Synthetic data. *Annual Review of Statistics and Its Application*, 8, 129-140.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "dd5-rui-ro-tung-giai-doan",
                "type": "mcq",
                "prompt": "Rủi ro đạo đức khi dùng AI ở khâu PHÂN TÍCH dữ liệu khác gì với rủi ro ở khâu VIẾT bài (đã học ở Khóa 3, Bài 6)?",
                "explanation": "Rủi ro ở khâu phân tích là chấp nhận kết quả tính toán sai mà không kiểm chứng được (AI như hộp đen); rủi ro ở khâu viết là overclaim văn phong hoặc trích dẫn giả — hai loại rủi ro khác nhau, cần biện pháp kiểm soát khác nhau.",
                "points": 3,
                "options": [
                    {"label": "Rủi ro phân tích là chấp nhận kết quả tính toán sai không kiểm chứng được; rủi ro viết bài là văn phong/trích dẫn — cần biện pháp kiểm soát khác nhau", "isCorrect": True},
                    {"label": "Hai loại rủi ro này hoàn toàn giống nhau, chỉ cần một biện pháp kiểm soát chung", "isCorrect": False},
                    {"label": "Không có rủi ro gì ở khâu phân tích, vì AI luôn tính toán chính xác hơn con người", "isCorrect": False, "misconception": "dd.ai-analysis-no-verify"},
                    {"label": "Rủi ro chỉ tồn tại ở khâu viết bài, các khâu khác dùng AI luôn an toàn", "isCorrect": False},
                ],
            },
            {
                "key": "dd5-hop-den-phan-tich",
                "type": "mcq",
                "prompt": "Một nghiên cứu sinh yêu cầu AI 'chạy hồi quy cho bộ dữ liệu này' rồi chép thẳng kết quả vào bài báo mà không kiểm chứng gì thêm. Vấn đề của cách làm này là gì?",
                "explanation": "Đây là coi AI như một hộp đen đáng tin tuyệt đối — AI có thể đưa ra kết quả sai (nhầm công thức, mã hoá biến sai) mà không có dấu hiệu cảnh báo, cần tự kiểm chứng bằng công cụ chuẩn hoặc đối chiếu logic trước khi dùng.",
                "points": 3,
                "options": [
                    {"label": "Coi AI như hộp đen đáng tin tuyệt đối — cần tự kiểm chứng kết quả bằng công cụ thống kê chuẩn hoặc đối chiếu logic tính toán", "isCorrect": True},
                    {"label": "Không có vấn đề gì, AI luôn tính toán chính xác hơn phần mềm thống kê truyền thống", "isCorrect": False, "misconception": "dd.ai-analysis-no-verify"},
                    {"label": "Không có vấn đề gì miễn là bộ dữ liệu đủ lớn", "isCorrect": False, "misconception": "dd.ai-analysis-no-verify"},
                    {"label": "Vấn đề duy nhất là cần yêu cầu AI giải thích rõ hơn cách tính, không cần kiểm chứng độc lập", "isCorrect": False, "misconception": "dd.ai-analysis-no-verify"},
                ],
            },
            {
                "key": "dd5-synthetic-data",
                "type": "mcq",
                "prompt": "Một nhóm nghiên cứu dùng AI tạo thêm 40 'phản hồi khảo sát' để đủ cỡ mẫu 200 như đã đăng ký, gộp chung và báo cáo N=200 thu thập được, không khai báo gì thêm. Đây là vi phạm gì?",
                "explanation": "Đây là ngụy tạo dữ liệu (fabrication) — dùng dữ liệu tổng hợp nhưng báo cáo như thể là dữ liệu thu thập thật, một vi phạm liêm chính nghiêm trọng dù công cụ tạo ra là AI hiện đại.",
                "points": 3,
                "options": [
                    {"label": "Ngụy tạo dữ liệu (fabrication) — dùng dữ liệu tổng hợp nhưng báo cáo như dữ liệu thu thập thật", "isCorrect": True},
                    {"label": "Không có vi phạm gì, vì dữ liệu tổng hợp có đặc điểm thống kê tương tự dữ liệu thật", "isCorrect": False, "misconception": "dd.synthetic-data-as-real"},
                    {"label": "Không có vi phạm gì, vì mục đích chỉ để đạt đúng cỡ mẫu đã đăng ký từ đầu", "isCorrect": False, "misconception": "dd.synthetic-data-as-real"},
                    {"label": "Đây là questionable research practice, không nghiêm trọng bằng fabrication", "isCorrect": False, "misconception": "dd.synthetic-data-as-real"},
                ],
            },
            {
                "key": "dd5-tom-tat-ai",
                "type": "mcq",
                "prompt": "Một nghiên cứu sinh trích dẫn một luận điểm vào tổng quan tài liệu chỉ dựa trên bản tóm tắt do AI tạo ra, không tự đọc lại bài báo gốc. Vấn đề tiềm ẩn là gì?",
                "explanation": "Bản tóm tắt AI có thể bỏ sót sắc thái quan trọng hoặc đơn giản hoá quá mức — trước khi trích dẫn vào bản thảo, luôn cần tự đọc lại nguồn gốc để xác nhận tóm tắt phản ánh đúng nội dung.",
                "points": 2,
                "options": [
                    {"label": "Bản tóm tắt AI có thể bỏ sót sắc thái hoặc đơn giản hoá quá mức — cần tự đọc gốc trước khi trích dẫn", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì tóm tắt AI luôn phản ánh chính xác 100% nội dung bài gốc", "isCorrect": False, "misconception": "dd.ai-summary-no-read-source"},
                    {"label": "Không có vấn đề gì, miễn là trích dẫn đúng tên tác giả và năm xuất bản", "isCorrect": False, "misconception": "dd.ai-summary-no-read-source"},
                    {"label": "Vấn đề chỉ xảy ra nếu bài báo gốc viết bằng ngôn ngữ khác tiếng Việt", "isCorrect": False, "misconception": "dd.ai-summary-no-read-source"},
                ],
            },
            {
                "key": "dd5-khai-bao-ai-phan-tich",
                "type": "mcq",
                "prompt": "Một nhóm nghiên cứu dùng AI đáng kể để hỗ trợ thu thập và phân tích dữ liệu, nhưng chỉ khai báo trong phần Methods rằng 'AI được dùng để sửa văn phong'. Vấn đề của cách khai báo này là gì?",
                "explanation": "Khai báo không đầy đủ — dùng AI ở khâu thu thập/phân tích dữ liệu cần được khai báo cụ thể và nghiêm túc hơn nhiều so với chỉ dùng để sửa văn phong, vì ảnh hưởng trực tiếp tới độ tin cậy của kết quả khoa học.",
                "points": 3,
                "options": [
                    {"label": "Khai báo không đầy đủ — dùng AI ở khâu thu thập/phân tích cần khai báo cụ thể hơn nhiều so với chỉ sửa văn phong", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì đã có khai báo về việc dùng AI trong bản thảo", "isCorrect": False, "misconception": "dd.ai-blackbox-no-disclosure"},
                    {"label": "Không có vấn đề gì, miễn là kết quả cuối cùng có ý nghĩa thống kê", "isCorrect": False, "misconception": "dd.ai-blackbox-no-disclosure"},
                    {"label": "Không cần khai báo gì thêm nếu AI chỉ được dùng để viết code, không trực tiếp ra quyết định phân tích", "isCorrect": False, "misconception": "dd.ai-blackbox-no-disclosure"},
                ],
            },
            {
                "key": "dd5-thu-tu-kiem-soat-ai-quy-trinh",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước kiểm soát khi dùng AI xuyên suốt một quy trình nghiên cứu.",
                "explanation": "Từ dùng tóm tắt AI để sàng lọc tài liệu (đọc gốc trước khi trích dẫn), tới phân biệt dữ liệu tổng hợp với dữ liệu thật, kiểm chứng kết quả phân tích AI, và khai báo đầy đủ trong Methods.",
                "points": 3,
                "sequence": [
                    "Dùng tóm tắt AI để sàng lọc tài liệu, tự đọc lại nguồn gốc trước khi trích dẫn",
                    "Nếu dùng dữ liệu tổng hợp, chỉ dùng cho mục đích thử nghiệm và khai báo rõ, không gộp vào dữ liệu thật",
                    "Dùng AI hỗ trợ phân tích như gợi ý ban đầu, không chấp nhận thẳng kết quả",
                    "Tự kiểm chứng kết quả phân tích bằng công cụ chuẩn hoặc đối chiếu logic tính toán",
                    "Khai báo đầy đủ trong Methods mọi khâu có dùng AI đáng kể, không chỉ khâu viết văn",
                ],
            },
            {
                "key": "dd5-noi-giai-doan-ai",
                "type": "matching",
                "prompt": "Nối mỗi giai đoạn nghiên cứu với đúng rủi ro đạo đức đặc trưng khi dùng AI.",
                "explanation": "Tổng quan tài liệu có rủi ro trích dẫn giả/tóm tắt sai lệch; thu thập dữ liệu có rủi ro dữ liệu tổng hợp bị coi như thật; phân tích dữ liệu có rủi ro hộp đen không kiểm chứng được; viết bài có rủi ro overclaim/không khai báo (đã học ở Khóa 3).",
                "points": 3,
                "pairs": [
                    {"left": "Tổng quan tài liệu", "right": "Trích dẫn giả (hallucination); dựa vào tóm tắt AI mà không đọc gốc"},
                    {"left": "Thu thập dữ liệu", "right": "Dùng dữ liệu tổng hợp thay dữ liệu thật mà không khai báo"},
                    {"left": "Phân tích dữ liệu", "right": "Chấp nhận kết quả AI như hộp đen, không tự kiểm chứng"},
                    {"left": "Viết bài (đã học ở Khóa 3)", "right": "Overclaim văn phong, không khai báo sử dụng AI"},
                ],
            },
            {
                "key": "dd5-viet-nguyen-tac-ai",
                "type": "essay",
                "prompt": "Viết đoạn 200-250 từ mô tả nguyên tắc dùng AI cho đề tài của bạn ở các giai đoạn ngoài viết bài, gồm: (a) cách bạn sẽ kiểm chứng nguồn khi dùng AI tổng hợp tài liệu; (b) nếu có dùng dữ liệu tổng hợp, cách bạn sẽ khai báo rõ ràng; (c) cách bạn sẽ kiểm chứng kết quả nếu dùng AI hỗ trợ phân tích dữ liệu.",
                "points": 5,
            },
        ],
    },
}

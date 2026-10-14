# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2 · Tổng quan tài liệu hệ thống",
    "durationMin": 90,
    "description": "Lập ma trận tổng quan mở rộng cho 15+ nguồn; dùng PRISMA rút gọn để ghi minh bạch quy trình chọn nguồn; đọc bản đồ trích dẫn (VOSviewer) để thấy cấu trúc cả một lĩnh vực; viết tổng quan theo luận điểm và xác nhận khoảng trống bằng số liệu tìm kiếm cụ thể.",
    "objectives": [
        "Lập được ma trận tổng quan cho ít nhất 15 nguồn, đủ các cột để dùng lại khi viết Chương 2",
        "Ghi được quy trình chọn nguồn theo PRISMA rút gọn (số nguồn tìm được, loại bỏ, giữ lại) để tổng quan minh bạch và có thể kiểm chứng",
        "Đọc được một bản đồ trích dẫn (VOSviewer) để nhận diện các nhóm chủ đề chính và vị trí của đề tài mình trong đó",
        "Viết được một khoảng trống nghiên cứu có căn cứ bằng số liệu tìm kiếm cụ thể, không phải cảm giác",
    ],
    "summary": [
        "Ma trận tổng quan ở mức luận văn cần đủ rộng (15+ nguồn) và đủ cột để dùng lại trực tiếp khi viết Chương 2, không phải ghi chú tạm.",
        "PRISMA rút gọn — ghi lại số nguồn tìm được, số loại bỏ theo từng lý do, số giữ lại — làm quy trình chọn nguồn minh bạch và kiểm chứng được, khác với việc chỉ nói 'tôi đã đọc nhiều tài liệu'.",
        "Bản đồ trích dẫn (VOSviewer) cho thấy cấu trúc của cả một lĩnh vực bằng hình ảnh — các nhóm chủ đề nào đang tồn tại, và đề tài của bạn nằm ở đâu trong đó hoặc lấp vào khoảng trống nào giữa các nhóm.",
        "Khoảng trống nghiên cứu ở mức luận văn phải được viết kèm số liệu cụ thể: tìm được bao nhiêu nguồn, qua nguồn tra cứu nào, và chính xác điều gì trong số đó chưa được làm.",
    ],
    "splitSections": True,
    "body": r"""
Bài 1 giả định bạn đã có một hướng khoảng trống ban đầu để dựng khung lý thuyết. Bài này làm việc xác nhận khoảng trống đó một cách nghiêm túc — đủ chặt để đứng vững trước hội đồng — và tạo ra chính nội dung sẽ trở thành Chương 2 của luận văn, đi qua bốn phần: trước hết mở rộng ma trận tổng quan lên quy mô luận văn với đủ cột để dùng lại khi viết; sau đó ghi luồng chọn nguồn theo PRISMA rút gọn để quy trình minh bạch, kiểm chứng được; tiếp theo đọc bản đồ trích dẫn (VOSviewer) để thấy cấu trúc cả một lĩnh vực và vị trí đề tài trong đó; và kết bằng cách viết khoảng trống nghiên cứu kèm số liệu cụ thể, khớp với ma trận và luồng PRISMA đã lập.

## Ma trận tổng quan ở quy mô luận văn

Ma trận tổng quan không phải là khái niệm mới, nhưng ở quy mô luận văn nó cần rộng hơn nhiều so với một đề tài NCKH sinh viên, và cần đủ cột để dùng thẳng khi viết Chương 2.

> [!ghi-nho] Với luận văn, ma trận tổng quan nên có tối thiểu **15-30 nguồn** (tuỳ ngành và độ hẹp của đề tài), và các cột nên đủ để trả lời được: nguồn này thuộc lý thuyết/khung nào, đo biến gì bằng công cụ nào, kết quả và cỡ hiệu ứng ra sao (nếu có), hạn chế tác giả tự nhận, và nó khớp vào đâu trong khung lý thuyết bạn đang dựng.

| Tác giả, năm | Lý thuyết/khung dùng | Biến & công cụ đo | Mẫu & bối cảnh | Kết quả chính | Hạn chế | Vị trí trong khung của tôi |
|---|---|---|---|---|---|---|
| Nguyễn & Trần (2022) | TAM | Nhận thức hữu ích, ý định sử dụng (thang Likert 5, Davis 1989) | 320 SV kỹ thuật, Hà Nội | Nhận thức hữu ích → ý định (β = 0.42) | Cắt ngang, không đo hành vi thực tế | Xác nhận đường dẫn nhận thức hữu ích → ý định sử dụng trong khung của tôi |
| Pham et al. (2021) | UTAUT | Ảnh hưởng xã hội, điều kiện thuận lợi | 210 SV kinh tế, TP.HCM | Ảnh hưởng xã hội không có ý nghĩa | Mẫu thuận tiện, một trường | Gợi ý biến ảnh hưởng xã hội cần đo lại cho phù hợp bối cảnh AI tạo sinh |

> [!meo] Với số lượng nguồn lớn, dùng bảng tính (Google Sheets/Excel) thay vì tài liệu văn bản để dễ lọc, sắp xếp lại theo cột khi nhóm nguồn theo luận điểm ở bước viết — và để chia sẻ, đối chiếu với giảng viên hướng dẫn thuận tiện hơn một file Word.

## PRISMA rút gọn — ghi minh bạch quy trình chọn nguồn

Một tổng quan chỉ nói "tôi đã đọc nhiều tài liệu" không kiểm chứng được. **PRISMA** (Preferred Reporting Items for Systematic Reviews) là khung báo cáo tiêu chuẩn cho tổng quan hệ thống; ở mức luận văn, dùng một **bản rút gọn** là đủ, không cần đầy đủ mọi bước như một bài tổng quan hệ thống chuyên biệt.

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.8rem">PRISMA rút gọn — luồng chọn nguồn</div>
  <div style="display:flex;flex-direction:column;gap:.5rem;font-size:1.1rem">
    <div style="background:rgba(59,130,246,.14);border-left:4px solid rgba(59,130,246,.7);padding:.6rem .9rem;border-radius:.3rem"><b>Tìm được:</b> 187 bài (Scopus: 94, Web of Science: 52, Google Scholar: 41)</div>
    <div style="text-align:center;color:rgba(127,127,127,.7)">↓ loại trùng lặp: −23</div>
    <div style="background:rgba(139,92,246,.14);border-left:4px solid rgba(139,92,246,.7);padding:.6rem .9rem;border-radius:.3rem"><b>Sau loại trùng:</b> 164 bài → lọc theo tiêu đề/tóm tắt</div>
    <div style="text-align:center;color:rgba(127,127,127,.7)">↓ loại không liên quan: −129</div>
    <div style="background:rgba(13,148,136,.14);border-left:4px solid rgba(13,148,136,.7);padding:.6rem .9rem;border-radius:.3rem"><b>Đọc toàn văn:</b> 35 bài</div>
    <div style="text-align:center;color:rgba(127,127,127,.7)">↓ loại theo tiêu chí (không đo đúng biến, không đúng đối tượng): −17</div>
    <div style="background:rgba(217,150,40,.14);border-left:4px solid rgba(217,150,40,.7);padding:.6rem .9rem;border-radius:.3rem"><b>Đưa vào ma trận tổng quan:</b> 18 bài</div>
  </div>
</div>
```

> [!canh-bao] Ghi lại con số ở mỗi bước **ngay khi đang tìm**, không dựng lại bằng trí nhớ sau khi đã đọc xong. Số liệu dựng lại sau thường không khớp với số nguồn thực tế trong ma trận, và hội đồng có thể yêu cầu xem lại chi tiết quy trình tìm kiếm.

## Đọc bản đồ trích dẫn để thấy cấu trúc cả lĩnh vực

Với một lĩnh vực có hàng trăm bài báo, đọc từng bài không đủ để thấy **cấu trúc chung**. Công cụ như **VOSviewer** (miễn phí) dựng bản đồ đồng trích dẫn (co-citation) hoặc đồng xuất hiện từ khoá (co-occurrence) từ dữ liệu xuất ra từ Scopus/Web of Science.

> [!ghi-nho] Bản đồ trích dẫn hiển thị các bài báo hoặc từ khoá dưới dạng các điểm, khoảng cách giữa hai điểm gần nhau nghĩa là chúng thường được trích dẫn cùng nhau hoặc xuất hiện cùng nhau — tức là chúng thuộc cùng một nhóm chủ đề (cluster). Đọc bản đồ giúp thấy: lĩnh vực này có bao nhiêu nhóm chủ đề chính, và đề tài của bạn rơi vào nhóm nào hoặc lấp vào khoảng trống giữa các nhóm.

> [!vi-du] Xuất 200 bài về "AI tạo sinh trong giáo dục" từ Scopus, chạy VOSviewer theo đồng xuất hiện từ khoá, học viên thấy 4 cụm: (1) AI tạo sinh và viết học thuật, (2) AI tạo sinh và đạo đức/đạo văn, (3) AI tạo sinh và giảng viên/thiết kế giảng dạy, (4) AI tạo sinh và động lực/cảm xúc người học. Đề tài "AI tạo sinh và động lực học tập của sinh viên khoa học xã hội tại Việt Nam" rơi vào cụm 4, nhưng cụm 4 chủ yếu là các nghiên cứu ở sinh viên STEM tại các nước phát triển — xác nhận trực quan cho khoảng trống đã nêu ở Bài 1.

> [!meo] Không cần đọc hết 200 bài để dựng bản đồ — VOSviewer chỉ cần file xuất dữ liệu thư mục trích dẫn (.csv/.ris) từ Scopus hoặc Web of Science, không cần toàn văn. Đây là công cụ định hướng đọc, không thay thế việc đọc — sau khi thấy cụm nào gần đề tài mình nhất, mới đọc kỹ các bài trong cụm đó.

## Từ ma trận tới khoảng trống có số liệu

Khoảng trống ở mức luận văn cần được viết kèm chính số liệu từ quy trình PRISMA rút gọn và ma trận tổng quan, không phải một câu khẳng định chung.

| Cách viết yếu | Cách viết có số liệu |
|---|---|
| "Chưa có nghiên cứu nào về AI tạo sinh và động lực học tập ở Việt Nam." | "Trong 18 nghiên cứu về AI tạo sinh và động lực học tập được đưa vào tổng quan (từ 187 nguồn tìm được qua Scopus, Web of Science và Google Scholar), không nghiên cứu nào thực hiện trên sinh viên khoa học xã hội tại Việt Nam; 15/18 nghiên cứu thực hiện trên sinh viên STEM tại các nước có mức tiếp cận công nghệ khác biệt." |

> [!canh-bao] Số liệu này phải khớp chính xác với PRISMA rút gọn và ma trận tổng quan đã lập — hội đồng có thể hỏi ngược "18 nguồn đó là những nguồn nào" và bạn cần chỉ ra được ngay trong ma trận.

## Luyện tập và tài liệu tham khảo

### Cá nhân (50 phút)

Mở rộng ma trận tổng quan từ Bài 1 lên tối thiểu **15 nguồn**, đủ 7 cột như mẫu ở mục 1. Ghi lại luồng PRISMA rút gọn (số tìm được theo từng nguồn tra cứu, số loại trùng, số loại theo tiêu đề/tóm tắt, số đọc toàn văn, số đưa vào ma trận).

### Nhóm 3-4 người (30 phút)

Đổi ma trận và luồng PRISMA cho nhau. Kiểm tra: số liệu trong luồng PRISMA có khớp với số dòng trong ma trận không, ma trận có đủ 7 cột không, và các nguồn có phân bố đa dạng qua nhiều nguồn tra cứu (không chỉ một cơ sở dữ liệu) không.

### Bài tập về nhà (90-120 phút)

Viết phần **Tổng quan tài liệu** cho Chương 2 (800-1200 từ): tổng hợp theo luận điểm (không liệt kê tuần tự), có sơ đồ hoặc mô tả bản đồ trích dẫn nếu đã dùng VOSviewer, kết thúc bằng đoạn khoảng trống nghiên cứu có số liệu cụ thể khớp với ma trận và luồng PRISMA.

:::mau Mẫu nộp bài tập về nhà
**Luồng PRISMA rút gọn:** tìm được … (qua …) → sau loại trùng … → đọc toàn văn … → đưa vào ma trận …

**Ma trận tổng quan (≥ 15 nguồn):** (đính kèm hoặc dán bảng)

**Đoạn tổng quan (800-1200 từ):** …

**Khoảng trống nghiên cứu (có số liệu):** …
:::

### Nguồn tham khảo

- Page, M. J., et al. (2021). The PRISMA 2020 statement: An updated guideline for reporting systematic reviews. *BMJ*, 372, n71.
- van Eck, N. J., & Waltman, L. (2010). Software survey: VOSviewer, a computer program for bibliometric mapping. *Scientometrics*, 84(2), 523-538.
- Hart, C. (1998). *Doing a Literature Review: Releasing the Social Science Research Imagination.* SAGE Publications.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "ppnc2-quy-mo-ma-tran",
                "type": "mcq",
                "prompt": "Vì sao ma trận tổng quan ở mức luận văn cần nhiều cột hơn ma trận ở mức NCKH sinh viên (như 'lý thuyết dùng', 'công cụ đo', 'cỡ hiệu ứng')?",
                "explanation": "Ma trận ở mức luận văn cần dùng thẳng để viết Chương 2 và bảo vệ trước hội đồng, nên cần đủ chi tiết để trả lời được các câu hỏi sâu về lý thuyết, công cụ đo và kết quả — không chỉ ghi chú tổng quát.",
                "points": 2,
                "options": [
                    {"label": "Để dùng thẳng khi viết Chương 2 và trả lời được các câu hỏi chi tiết của hội đồng về lý thuyết, công cụ đo, kết quả", "isCorrect": True},
                    {"label": "Để bảng nhìn dài và ấn tượng hơn với giảng viên hướng dẫn", "isCorrect": False},
                    {"label": "Không có lý do gì khác biệt thật sự, chỉ là quy ước hình thức", "isCorrect": False},
                    {"label": "Để dễ dàng đếm được đã đọc bao nhiêu trang tài liệu", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc2-prisma-muc-dich",
                "type": "mcq",
                "prompt": "Ghi lại luồng PRISMA rút gọn (số nguồn tìm được, loại trùng, loại theo tiêu đề, đọc toàn văn, đưa vào ma trận) phục vụ mục đích gì?",
                "explanation": "PRISMA rút gọn làm quy trình chọn nguồn minh bạch và kiểm chứng được — khác với việc chỉ nói 'tôi đã đọc nhiều tài liệu' mà không ai kiểm lại được đã tìm và lọc thế nào.",
                "points": 2,
                "options": [
                    {"label": "Làm quy trình chọn nguồn minh bạch và kiểm chứng được, thay cho việc chỉ nói đã đọc nhiều tài liệu", "isCorrect": True},
                    {"label": "Là yêu cầu hình thức bắt buộc, không phục vụ việc kiểm chứng gì", "isCorrect": False},
                    {"label": "Giúp tổng quan có vẻ khoa học hơn dù không thay đổi nội dung thật", "isCorrect": False},
                    {"label": "Thay thế được việc phải đọc toàn văn các bài báo đã chọn", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc2-doc-ban-do-trich-dan",
                "type": "mcq",
                "prompt": "Trên bản đồ đồng xuất hiện từ khoá của VOSviewer, hai từ khoá nằm gần nhau nghĩa là gì?",
                "explanation": "Khoảng cách gần trên bản đồ nghĩa là hai từ khoá (hoặc bài báo) thường xuất hiện cùng nhau hoặc được trích dẫn cùng nhau — tức là chúng thuộc cùng một nhóm chủ đề (cluster), không phải là chúng giống nhau về nội dung câu chữ.",
                "points": 3,
                "options": [
                    {"label": "Chúng thường xuất hiện cùng nhau trong các bài báo, nên có khả năng thuộc cùng một nhóm chủ đề", "isCorrect": True},
                    {"label": "Chúng được xuất bản trong cùng một tạp chí", "isCorrect": False},
                    {"label": "Chúng do cùng một tác giả viết", "isCorrect": False},
                    {"label": "Không có ý nghĩa gì, khoảng cách trên bản đồ là ngẫu nhiên", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc2-khoang-trong-so-lieu",
                "type": "mcq",
                "prompt": "Câu nào viết khoảng trống nghiên cứu đúng chuẩn ở mức luận văn?",
                "explanation": "Khoảng trống ở mức luận văn cần kèm số liệu cụ thể khớp với ma trận và luồng PRISMA — số nguồn tìm được, qua đâu, và chính xác điều gì trong số đó chưa được làm — để hội đồng kiểm chứng được, thay vì một khẳng định chung không có cơ sở.",
                "points": 3,
                "options": [
                    {"label": "'Trong 18 nghiên cứu được đưa vào tổng quan (từ 187 nguồn qua Scopus, Web of Science, Google Scholar), không nghiên cứu nào thực hiện trên sinh viên khoa học xã hội tại Việt Nam.'", "isCorrect": True},
                    {"label": "'Chưa có nghiên cứu nào về vấn đề này ở Việt Nam.'", "isCorrect": False, "misconception": "ppnc.gap-is-my-interest"},
                    {"label": "'Đây là một chủ đề rất mới và thú vị, chưa được khai thác nhiều.'", "isCorrect": False, "misconception": "ppnc.gap-is-my-interest"},
                    {"label": "'Có rất nhiều nghiên cứu về AI tạo sinh, nên đề tài này chắc chắn có giá trị.'", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc2-ghi-so-lieu-khi-nao",
                "type": "mcq",
                "prompt": "Nên ghi lại số liệu của luồng PRISMA rút gọn (số tìm được, số loại trùng...) vào lúc nào?",
                "explanation": "Ghi ngay khi đang thực hiện quy trình tìm kiếm và lọc, không dựng lại bằng trí nhớ sau khi đã đọc xong — số liệu dựng lại sau thường không khớp với số nguồn thực tế và khó chịu được trách nhiệm khi hội đồng hỏi lại chi tiết.",
                "points": 2,
                "options": [
                    {"label": "Ghi ngay khi đang thực hiện từng bước tìm kiếm và lọc, không dựng lại bằng trí nhớ sau đó", "isCorrect": True},
                    {"label": "Ghi sau khi đã đọc xong toàn bộ tài liệu, ước lượng lại số liệu cho hợp lý", "isCorrect": False},
                    {"label": "Không cần ghi số liệu cụ thể, chỉ cần mô tả chung là 'đã tìm và lọc kỹ'", "isCorrect": False},
                    {"label": "Chỉ cần ghi số liệu nếu giảng viên hướng dẫn yêu cầu", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc2-thu-tu-tong-quan",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự quy trình làm tổng quan tài liệu hệ thống ở mức luận văn.",
                "explanation": "Từ tìm kiếm đa nguồn, ghi luồng PRISMA rút gọn, lọc và đọc toàn văn, điền ma trận, tới việc dùng bản đồ trích dẫn định hướng và viết khoảng trống có số liệu.",
                "points": 3,
                "sequence": [
                    "Tìm kiếm qua nhiều nguồn tra cứu (Scopus, Web of Science, Google Scholar)",
                    "Ghi số liệu PRISMA rút gọn ngay khi loại trùng lặp và lọc theo tiêu đề/tóm tắt",
                    "Đọc toàn văn các bài còn lại và điền vào ma trận tổng quan",
                    "Dùng bản đồ trích dẫn (nếu có) để xác nhận vị trí đề tài trong cấu trúc lĩnh vực",
                    "Viết đoạn khoảng trống nghiên cứu có số liệu khớp với ma trận và luồng PRISMA",
                ],
            },
            {
                "key": "ppnc2-noi-cong-cu",
                "type": "matching",
                "prompt": "Nối mỗi công cụ hoặc khái niệm với đúng vai trò của nó trong tổng quan tài liệu hệ thống.",
                "explanation": "PRISMA ghi minh bạch luồng chọn nguồn; VOSviewer dựng bản đồ trực quan cấu trúc lĩnh vực; ma trận tổng quan lưu chi tiết từng nguồn để dùng lại; Scopus/Web of Science là nguồn tra cứu chính cho dữ liệu trích dẫn.",
                "points": 3,
                "pairs": [
                    {"left": "PRISMA rút gọn", "right": "Ghi minh bạch luồng tìm kiếm và lọc nguồn"},
                    {"left": "VOSviewer", "right": "Dựng bản đồ trực quan cấu trúc chủ đề của lĩnh vực"},
                    {"left": "Ma trận tổng quan", "right": "Lưu chi tiết từng nguồn để dùng lại khi viết Chương 2"},
                    {"left": "Scopus / Web of Science", "right": "Nguồn tra cứu chính, xuất dữ liệu trích dẫn cho bản đồ"},
                ],
            },
            {
                "key": "ppnc2-viet-khoang-trong",
                "type": "essay",
                "prompt": "Từ ma trận tổng quan và luồng PRISMA rút gọn của bạn, viết một đoạn 200-300 từ trình bày khoảng trống nghiên cứu, gồm: (a) số liệu cụ thể (tìm được bao nhiêu, qua đâu, đưa vào bao nhiêu); (b) tổng hợp ngắn theo luận điểm những gì đã biết; (c) chỉ rõ khoảng trống và nối với câu hỏi/khung lý thuyết ở Bài 1.",
                "points": 5,
            },
        ],
    },
}

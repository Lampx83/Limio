# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4 · Viết bài báo khoa học tiếng Anh và trả lời phản biện",
    "durationMin": 100,
    "description": "Viết theo cấu trúc IMRaD súc tích, không phải bản thu gọn của luận văn 5 chương; dùng đúng mức hedging tiếng Anh theo độ mạnh của bằng chứng; viết Discussion đối chiếu với tổng quan tài liệu, không lặp lại Results; trả lời phản biện (rebuttal) point-by-point, không phòng thủ.",
    "objectives": [
        "Viết phần Introduction theo cấu trúc hình nón (funnel) của IMRaD, khác với cách mở đầu dàn trải của một luận văn",
        "Chọn đúng mức hedging tiếng Anh (may, suggests, appears to...) phù hợp với độ mạnh của thiết kế và bằng chứng, tránh overclaim",
        "Viết Discussion đối chiếu kết quả với các nghiên cứu đã tổng quan, không chỉ lặp lại số liệu ở Results",
        "Viết một rebuttal letter trả lời phản biện theo cấu trúc point-by-point, ghi nhận và hành động cụ thể, không phòng thủ hay tranh cãi",
    ],
    "summary": [
        "Introduction của một bài báo IMRaD đi theo cấu trúc hình nón — từ bối cảnh rộng, hẹp dần tới khoảng trống cụ thể, kết bằng câu đóng góp — súc tích hơn nhiều so với phần mở đầu của một luận văn, không phải một bản thu gọn giữ nguyên cấu trúc 5 chương.",
        "Mức hedging tiếng Anh phải khớp với độ mạnh của thiết kế: 'suggests', 'appears to', 'is associated with' cho thiết kế cắt ngang hoặc mẫu nhỏ; chỉ dùng 'demonstrates' hoặc 'confirms' khi thiết kế đủ mạnh (thực nghiệm, mẫu lớn, đã kiểm soát nhiễu) để biện minh cho mức độ chắc chắn đó.",
        "Discussion phải đối chiếu kết quả với các nghiên cứu đã tổng quan ở phần Introduction/Literature Review — đồng thuận ở đâu, mâu thuẫn ở đâu, và vì sao — không chỉ diễn giải kết quả một cách cô lập.",
        "Rebuttal letter trả lời từng comment của reviewer theo cấu trúc: trích lại comment, ghi nhận, nêu hành động cụ thể đã thực hiện (kèm số trang/dòng đã sửa) — phòng thủ hoặc tranh cãi với reviewer làm giảm khả năng bài được nhận.",
    ],
    "splitSections": True,
    "body": r"""
Đóng góp đã định vị (Bài 1), tổng quan đã hệ thống (Bài 2), phương pháp đã sẵn sàng (Bài 3) — bài này là lúc đưa tất cả vào khuôn bài báo, viết đúng văn phong tiếng Anh học thuật, và sống sót qua vòng phản biện. Bài đi qua bốn phần: trước hết cấu trúc IMRaD khác gì với một luận văn 5 chương; sau đó chọn đúng mức hedging tiếng Anh theo độ mạnh của bằng chứng; tiếp theo viết Discussion đối chiếu với tổng quan tài liệu thay vì lặp lại Results; và kết bằng cách trả lời phản biện (rebuttal letter) point-by-point.

## Cấu trúc IMRaD — khác gì với luận văn 5 chương

> [!canh-bao] Viết bài báo bằng cách **thu gọn nguyên luận văn 5 chương**, giữ y cấu trúc và cắt bớt câu chữ, là một lỗi phổ biến. Bài báo IMRaD (Introduction, Methods, Results, and Discussion) có logic khác: súc tích hơn nhiều (thường 6.000-8.000 từ tổng), và **Introduction đi theo cấu trúc hình nón** — bắt đầu từ bối cảnh rộng, hẹp dần qua tổng quan có chọn lọc (không phải toàn bộ tổng quan hệ thống ở Bài 2), tới khoảng trống cụ thể, và kết bằng **câu đóng góp** đã viết ở Bài 1.

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.8rem">Cấu trúc hình nón của Introduction</div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:.4rem;font-size:1.05rem">
    <div style="width:100%;background:rgba(59,130,246,.14);border-radius:.4rem;padding:.55rem .8rem;text-align:center">Bối cảnh rộng — vì sao hiện tượng này quan trọng</div>
    <div style="width:80%;background:rgba(139,92,246,.14);border-radius:.4rem;padding:.55rem .8rem;text-align:center">Tổng quan có chọn lọc — điều đã biết, theo luận điểm</div>
    <div style="width:60%;background:rgba(13,148,136,.14);border-radius:.4rem;padding:.55rem .8rem;text-align:center">Khoảng trống cụ thể</div>
    <div style="width:40%;background:rgba(217,150,40,.14);border-radius:.4rem;padding:.55rem .8rem;text-align:center;font-weight:600">Câu đóng góp (từ Bài 1)</div>
  </div>
</div>
```

Phần tổng quan tài liệu hệ thống đầy đủ ở Bài 2 **không được chép nguyên vào Introduction** — nó là nguyên liệu; Introduction chỉ trích những luận điểm cần để dẫn tới khoảng trống, súc tích trong 2-4 đoạn.

> [!vi-du] Bốn tầng của cấu trúc hình nón viết đầy đủ cho ví dụ AI chấm bài: **Bối cảnh rộng** — "AI tạo sinh đang được triển khai nhanh chóng trong đánh giá học tập tại các trường đại học, hứa hẹn giảm tải công việc chấm bài cho giảng viên." **Tổng quan chọn lọc** — "Các nghiên cứu trước tập trung vào độ chính xác của AI khi chấm so với giảng viên (Nguyen et al., 2023) và nhận thức hữu ích của giảng viên với công cụ này (Tran & Le, 2022), dựa chủ yếu trên mô hình TAM gốc." **Khoảng trống cụ thể** — "Tuy nhiên, các mô hình này chưa tính tới việc AI tạo sinh, khác với phần mềm hỗ trợ thông thường, có thể kích hoạt lo ngại về mất kiểm soát chuyên môn — một cơ chế tâm lý riêng biệt với nhận thức hữu ích." **Câu đóng góp** — "Nghiên cứu này mở rộng TAM bằng cách bổ sung 'lo ngại mất kiểm soát chuyên môn' như một cấu trúc dự báo độc lập, kiểm định trên mẫu giảng viên đại học tại Việt Nam." Bốn câu này đọc liền mạch, mỗi câu hẹp hơn câu trước — đúng hình dạng cái phễu, không nhảy cóc từ bối cảnh thẳng tới đóng góp.

## Hedging tiếng Anh — đúng mức với độ mạnh bằng chứng

> [!ghi-nho] Tiếng Anh học thuật có một thang mức độ chắc chắn rõ ràng: **"demonstrates", "confirms", "proves"** (rất mạnh — chỉ dùng khi thiết kế đủ mạnh, ví dụ thực nghiệm có phân nhóm ngẫu nhiên) → **"shows", "indicates"** (mạnh, thường dùng cho kết quả có ý nghĩa thống kê rõ) → **"suggests", "is associated with", "appears to"** (vừa — phù hợp với kết quả cắt ngang, tương quan) → **"may", "might", "could"** (yếu — dùng cho suy luận, chưa có bằng chứng trực tiếp).

| Thiết kế / bằng chứng | Mức hedging phù hợp |
|---|---|
| Thực nghiệm có phân nhóm ngẫu nhiên, manipulation check đạt | "demonstrates", "the results confirm" |
| PLS-SEM/SEM cắt ngang, path có ý nghĩa thống kê | "is associated with", "the results suggest" |
| Longitudinal hai chiều (cross-lagged), chưa kiểm soát hết nhiễu | "the findings are consistent with", "may precede" |
| Suy luận từ kết quả, chưa đo trực tiếp | "may reflect", "could be explained by" |

> [!canh-bao] Dùng "demonstrates" hoặc "prove" cho một mô hình PLS-SEM cắt ngang là **overclaim** — reviewer quốc tế có kinh nghiệm sẽ đọc ra ngay sự lệch giữa mức độ chắc chắn của câu chữ và mức độ chắc chắn mà thiết kế thực sự cho phép, và thường yêu cầu sửa lại ngôn ngữ này ở vòng phản biện đầu tiên.

> [!vi-du] Sửa một câu overclaim thực tế: bản gốc — "*This study proves that AI concern reduces teachers' adoption intention.*" (PLS-SEM cắt ngang, không có phân nhóm ngẫu nhiên). Sửa lại đúng mức — "*This study provides evidence that professional-control concern is associated with lower adoption intention, consistent with a moderated-mediation mechanism.*" Câu sửa vẫn giữ nguyên phát hiện chính, chỉ đổi động từ chính ("proves" → "provides evidence that... is associated with") và thêm "consistent with" thay vì khẳng định cơ chế nhân quả trực tiếp — không làm yếu đóng góp, chỉ làm câu chữ khớp đúng với những gì thiết kế thực sự chứng minh được.

## Discussion: đối chiếu, không lặp lại

> [!canh-bao] Viết Discussion bằng cách diễn giải riêng từng kết quả mà không đối chiếu lại với các nghiên cứu đã nêu ở Introduction/Literature Review là một lỗi khiến bài đọc rời rạc — reviewer sẽ hỏi "kết quả này khớp hay mâu thuẫn với nghiên cứu X mà bạn đã trích ở phần đầu?"

> [!ghi-nho] Mỗi đoạn Discussion nên đi theo cấu trúc: nêu lại kết quả chính (một câu, không lặp số liệu chi tiết đã có ở Results) → đối chiếu với 1-2 nghiên cứu cụ thể đã tổng quan (đồng thuận hay mâu thuẫn) → giải thích **vì sao** (dựa trên lý thuyết hoặc đặc điểm bối cảnh) → nêu hàm ý.

> [!vi-du] "Kết quả cho thấy lo ngại mất kiểm soát chuyên môn dự báo ý định chấp nhận AI chấm bài mạnh hơn nhận thức hữu ích (β = 0.38 so với β = 0.19). Phát hiện này khác với Nguyen et al. (2023), nơi nhận thức hữu ích vẫn là yếu tố dự báo mạnh nhất trong bối cảnh phần mềm quản lý học tập thông thường. Sự khác biệt có thể do AI tạo sinh, khác với phần mềm quản lý thông thường, tự động hoá một phần công việc chuyên môn của giảng viên — kích hoạt một cơ chế tâm lý mà TAM gốc chưa tính đến."

## Trả lời phản biện (rebuttal letter)

> [!ghi-nho] Rebuttal letter trả lời **từng comment** của reviewer theo cấu trúc: (1) trích lại nguyên văn comment, (2) một câu ghi nhận, (3) hành động cụ thể đã thực hiện, kèm vị trí đã sửa trong bản thảo (ví dụ "đã sửa ở trang 8, đoạn 2"). Không bỏ qua comment nào, kể cả comment khó chịu hoặc có vẻ hiểu nhầm bài của bạn — với comment do hiểu nhầm, vẫn cần giải thích rõ và có thể là dấu hiệu cần viết lại đoạn đó rõ hơn.

> [!canh-bao] Viết rebuttal theo hướng **tranh luận, bảo vệ bản thảo gốc bằng mọi giá**, hoặc phớt lờ những comment khó, làm giảm mạnh khả năng bài được nhận ở vòng sau — reviewer đọc rebuttal để xem tác giả có tiếp thu góp ý một cách nghiêm túc không, không phải để xem ai đúng ai sai.

| Rebuttal phòng thủ (không dùng) | Rebuttal đúng cách |
|---|---|
| "Chúng tôi không đồng ý với nhận xét này, vì phương pháp của chúng tôi đã đúng theo chuẩn ngành." | "Cảm ơn phản biện đã chỉ ra điều này. Chúng tôi đã bổ sung phần giải thích về lựa chọn phương pháp ở trang 12, đoạn 3, và thêm một hạn chế liên quan ở phần Discussion." |

## Luyện tập và tài liệu tham khảo

### Cá nhân (45 phút)

Viết đoạn Introduction theo cấu trúc hình nón cho bài báo của bạn (300-400 từ), kết bằng câu đóng góp từ Bài 1. Rà lại một đoạn Discussion (nếu đã có) hoặc phác một đoạn dự kiến, kiểm mức hedging có khớp với độ mạnh thiết kế của bạn không.

### Nhóm 3-4 người (30 phút)

Đổi đoạn Introduction cho nhau, kiểm cấu trúc hình nón có đủ rõ không (bối cảnh → tổng quan chọn lọc → khoảng trống → đóng góp). Đọc đoạn Discussion, chỉ ra câu nào đang lặp lại Results thay vì đối chiếu với tài liệu.

### Bài tập về nhà (90 phút)

Nếu đã có bản thảo nhận được phản biện, viết một rebuttal letter đầy đủ point-by-point cho ít nhất 3 comment. Nếu chưa có, viết một đoạn Discussion hoàn chỉnh (300-400 từ) đối chiếu kết quả với ít nhất 2 nghiên cứu đã tổng quan ở Bài 2.

:::mau Mẫu nộp bài tập về nhà
**Đoạn Introduction (cấu trúc hình nón, 300-400 từ):** …

**Đoạn Discussion (đối chiếu với ≥ 2 nghiên cứu, 300-400 từ):** …

**Rebuttal letter (nếu có, ≥ 3 comment)**

| Comment của reviewer | Ghi nhận | Hành động cụ thể (trang/đoạn đã sửa) |
|---|---|---|
| … | … | … |
:::

### Nguồn tham khảo

- Swales, J. M., & Feak, C. B. (2012). *Academic Writing for Graduate Students: Essential Tasks and Skills* (3rd ed.). University of Michigan Press.
- Hyland, K. (1998). *Hedging in Scientific Research Articles.* John Benjamins Publishing.
- Belcher, W. L. (2019). *Writing Your Journal Article in Twelve Weeks* (2nd ed.). University of Chicago Press.
- Noble, W. S. (2017). A quick guide to organizing computational biology projects. *PLOS Computational Biology* — ví dụ điển hình về cấu trúc IMRaD súc tích (tham khảo phong cách, không phải nội dung).
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "cbqt4-imrad-vs-luan-van",
                "type": "mcq",
                "prompt": "Một nghiên cứu sinh viết Introduction cho bài báo bằng cách chép và cắt gọn nguyên phần Chương 1-2 của luận văn. Vấn đề của cách làm này là gì?",
                "explanation": "Introduction của IMRaD cần cấu trúc hình nón súc tích (bối cảnh → tổng quan chọn lọc → khoảng trống → đóng góp), không phải một bản thu gọn giữ nguyên cấu trúc và nội dung của luận văn 5 chương.",
                "points": 2,
                "options": [
                    {"label": "Introduction cần cấu trúc hình nón súc tích, không phải bản thu gọn giữ nguyên cấu trúc luận văn", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì nội dung luận văn và bài báo nên giống nhau hoàn toàn", "isCorrect": False, "misconception": "cbqt.imrad-same-as-thesis"},
                    {"label": "Vấn đề duy nhất là cần dịch sang tiếng Anh, không liên quan tới cấu trúc", "isCorrect": False, "misconception": "cbqt.imrad-same-as-thesis"},
                    {"label": "Không có vấn đề gì, các tạp chí quốc tế đều chấp nhận cấu trúc như luận văn", "isCorrect": False, "misconception": "cbqt.imrad-same-as-thesis"},
                ],
            },
            {
                "key": "cbqt4-hedging-dung-muc",
                "type": "mcq",
                "prompt": "Một bài báo dùng mô hình PLS-SEM trên dữ liệu cắt ngang viết: 'The results demonstrate that perceived usefulness causes higher intention to use.' Vấn đề của câu này là gì?",
                "explanation": "'Demonstrate' và 'causes' là mức hedging quá mạnh cho một thiết kế cắt ngang — nên dùng 'is associated with' hoặc 'the results suggest' để khớp với mức độ chắc chắn mà thiết kế này thực sự cho phép.",
                "points": 3,
                "options": [
                    {"label": "Dùng mức hedging quá mạnh ('demonstrate', 'causes') cho một thiết kế cắt ngang chỉ cho phép nói về sự liên hệ", "isCorrect": True},
                    {"label": "Không có vấn đề gì, PLS-SEM luôn cho phép dùng ngôn ngữ nhân quả mạnh", "isCorrect": False, "misconception": "cbqt.overclaim-in-english"},
                    {"label": "Câu này sai ngữ pháp, không liên quan tới mức độ chắc chắn", "isCorrect": False, "misconception": "cbqt.overclaim-in-english"},
                    {"label": "Không có vấn đề gì miễn là p-value nhỏ hơn 0.05", "isCorrect": False, "misconception": "cbqt.overclaim-in-english"},
                ],
            },
            {
                "key": "cbqt4-discussion-doi-chieu",
                "type": "mcq",
                "prompt": "Một đoạn Discussion viết: 'Kết quả cho thấy β = 0.38, p < 0.01, R² = 0.42' và không nhắc gì tới các nghiên cứu đã tổng quan. Vấn đề của đoạn này là gì?",
                "explanation": "Discussion cần đối chiếu kết quả với các nghiên cứu đã tổng quan — đồng thuận ở đâu, mâu thuẫn ở đâu, vì sao — không chỉ lặp lại số liệu đã có ở phần Results.",
                "points": 2,
                "options": [
                    {"label": "Chỉ lặp lại số liệu của Results, thiếu đối chiếu với các nghiên cứu đã tổng quan", "isCorrect": True},
                    {"label": "Không có vấn đề gì, Discussion chỉ cần nhắc lại số liệu chính cho rõ", "isCorrect": False, "misconception": "cbqt.no-comparison-to-literature"},
                    {"label": "Vấn đề duy nhất là thiếu định dạng bảng cho số liệu", "isCorrect": False, "misconception": "cbqt.no-comparison-to-literature"},
                    {"label": "Không có vấn đề gì nếu số liệu đã đủ chi tiết", "isCorrect": False, "misconception": "cbqt.no-comparison-to-literature"},
                ],
            },
            {
                "key": "cbqt4-rebuttal-dung-cach",
                "type": "mcq",
                "prompt": "Reviewer nhận xét phương pháp chọn mẫu chưa phù hợp. Cách trả lời nào trong rebuttal letter đúng hướng nhất?",
                "explanation": "Rebuttal cần ghi nhận và nêu hành động cụ thể đã thực hiện (kèm vị trí đã sửa) — tranh luận bảo vệ bản thảo gốc bằng mọi giá làm giảm khả năng bài được nhận, vì reviewer đọc rebuttal để xem tác giả có tiếp thu nghiêm túc không.",
                "points": 3,
                "options": [
                    {"label": "'Cảm ơn phản biện đã chỉ ra điều này. Chúng tôi đã bổ sung giải thích về lựa chọn phương pháp ở trang 12, đoạn 3, và thêm một hạn chế liên quan ở Discussion.'", "isCorrect": True},
                    {"label": "'Chúng tôi không đồng ý với nhận xét này, vì phương pháp của chúng tôi đã đúng theo chuẩn ngành.'", "isCorrect": False, "misconception": "cbqt.rebuttal-defensive"},
                    {"label": "Không trả lời comment này vì cảm thấy reviewer đã hiểu nhầm bài viết", "isCorrect": False, "misconception": "cbqt.rebuttal-defensive"},
                    {"label": "'Nhận xét này không quan trọng so với các đóng góp khác của bài báo.'", "isCorrect": False, "misconception": "cbqt.rebuttal-defensive"},
                ],
            },
            {
                "key": "cbqt4-cau-truc-hinh-non",
                "type": "mcq",
                "prompt": "Đoạn cuối cùng của một Introduction theo cấu trúc hình nón nên chứa gì?",
                "explanation": "Introduction kết bằng câu đóng góp — nêu cụ thể nghiên cứu này thách thức/mở rộng/tích hợp lý thuyết nào, đã được chuẩn bị từ Bài 1 — không phải một câu tóm tắt phương pháp hay kết quả.",
                "points": 2,
                "options": [
                    {"label": "Câu đóng góp cụ thể — nghiên cứu này thách thức/mở rộng/tích hợp lý thuyết nào", "isCorrect": True},
                    {"label": "Một bản tóm tắt đầy đủ phương pháp nghiên cứu sẽ dùng", "isCorrect": False},
                    {"label": "Một bảng số liệu tóm tắt kết quả chính", "isCorrect": False},
                    {"label": "Danh sách toàn bộ tài liệu tham khảo đã đọc", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt4-thu-tu-viet-bai-bao",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước viết và hoàn thiện một bài báo IMRaD.",
                "explanation": "Từ viết Introduction theo cấu trúc hình nón, tới Methods/Results, viết Discussion đối chiếu tài liệu, kiểm lại mức hedging, rồi chuẩn bị trả lời phản biện khi nhận được.",
                "points": 3,
                "sequence": [
                    "Viết Introduction theo cấu trúc hình nón, kết bằng câu đóng góp",
                    "Viết Methods và Results dựa trên thiết kế và dữ liệu đã có",
                    "Viết Discussion đối chiếu kết quả với các nghiên cứu đã tổng quan",
                    "Rà lại toàn bài, kiểm mức hedging có khớp với độ mạnh thiết kế không",
                    "Viết rebuttal letter point-by-point khi nhận được phản biện",
                ],
            },
            {
                "key": "cbqt4-noi-muc-hedging",
                "type": "matching",
                "prompt": "Nối mỗi loại thiết kế/bằng chứng với đúng mức hedging tiếng Anh phù hợp.",
                "explanation": "Thực nghiệm có phân nhóm ngẫu nhiên đủ mạnh cho 'demonstrates'; SEM cắt ngang phù hợp với 'is associated with/suggests'; longitudinal hai chiều chưa kiểm hết nhiễu phù hợp với 'may precede'; suy luận chưa đo trực tiếp phù hợp với 'may reflect'.",
                "points": 3,
                "pairs": [
                    {"left": "Thực nghiệm có phân nhóm ngẫu nhiên, manipulation check đạt", "right": "'demonstrates', 'the results confirm'"},
                    {"left": "PLS-SEM/SEM cắt ngang, path có ý nghĩa thống kê", "right": "'is associated with', 'suggests'"},
                    {"left": "Longitudinal hai chiều, chưa kiểm soát hết nhiễu", "right": "'may precede', 'is consistent with'"},
                    {"left": "Suy luận từ kết quả, chưa đo trực tiếp", "right": "'may reflect', 'could be explained by'"},
                ],
            },
            {
                "key": "cbqt4-viet-introduction",
                "type": "essay",
                "prompt": "Viết đoạn Introduction cho bài báo của bạn theo cấu trúc hình nón (300-400 từ, có thể viết tiếng Anh hoặc tiếng Việt), gồm: (a) một đoạn bối cảnh rộng; (b) tổng quan có chọn lọc (2-3 luận điểm, không phải toàn bộ tổng quan hệ thống); (c) khoảng trống cụ thể; (d) câu đóng góp từ Bài 1, dùng đúng mức hedging phù hợp với thiết kế của bạn.",
                "points": 5,
            },
        ],
    },
}

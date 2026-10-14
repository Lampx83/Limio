# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3 · Đạo đức dữ liệu nghiên cứu",
    "durationMin": 90,
    "description": "Lập kế hoạch quản lý dữ liệu trước khi thu thập; phân biệt ẩn danh hoá kỹ thuật thật sự với việc chỉ đổi tên/mã hoá ID; đối chiếu nghĩa vụ theo Luật Bảo vệ dữ liệu cá nhân 2025 của Việt Nam khi xử lý dữ liệu nhạy cảm; lập thoả thuận rõ ràng khi chia sẻ dữ liệu nghiên cứu.",
    "objectives": [
        "Lập được một kế hoạch quản lý dữ liệu (data management plan) cơ bản trước khi bắt đầu thu thập",
        "Phân biệt ẩn danh hoá kỹ thuật thật sự (xử lý rủi ro tái nhận dạng từ tổ hợp biến) với việc chỉ đổi tên/mã hoá ID",
        "Đối chiếu đúng nghĩa vụ xử lý dữ liệu cá nhân nhạy cảm (trẻ em, sinh trắc học) theo Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 của Việt Nam",
        "Lập thoả thuận rõ ràng về mục đích, thời hạn và trách nhiệm bảo mật khi chia sẻ dữ liệu nghiên cứu",
    ],
    "summary": [
        "Một kế hoạch quản lý dữ liệu (data management plan) cần xác định trước khi thu thập: ai sở hữu dữ liệu, lưu ở đâu, ai được truy cập, lưu bao lâu, và huỷ khi nào — nhiều quỹ tài trợ và hội đồng đạo đức hiện yêu cầu văn bản này.",
        "Chỉ đổi tên thật bằng mã số không phải ẩn danh hoá hoàn toàn — tổ hợp các biến còn lại (tuổi, đơn vị công tác, thời điểm) vẫn có thể chỉ đúng một người, gọi là rủi ro tái nhận dạng (re-identification).",
        "Từ 01/01/2026, Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP thay thế Nghị định 13/2023 — có nghĩa vụ cụ thể với dữ liệu trẻ em, dữ liệu sinh trắc học, và xử lý dữ liệu trong môi trường AI/dữ liệu lớn.",
        "Dữ liệu đã khử nhận dạng đúng cách (theo Điều 2 khoản 1 của Luật) không còn là dữ liệu cá nhân — đây là biện pháp thiết kế mạnh nhất khi cần gửi dữ liệu nghiên cứu sang dịch vụ bên thứ ba, kể cả dịch vụ AI.",
    ],
    "splitSections": True,
    "body": r"""
Bài 2 (khoá Phương pháp nghiên cứu) đã dạy ẩn danh hoá cơ bản và thời điểm xin phê duyệt đạo đức. Bài này đi sâu vào kỹ thuật ẩn danh hoá thật sự và khung pháp lý Việt Nam mới nhất — phần thường bị bỏ qua vì đến gần đây mới có luật riêng. Bài đi qua bốn phần: bắt đầu từ việc lập kế hoạch quản lý dữ liệu trước khi thu thập; sau đó phân biệt ẩn danh hoá kỹ thuật thật sự với việc chỉ đổi tên/mã hoá ID; tiếp theo đối chiếu các điều khoản liên quan của Luật Bảo vệ dữ liệu cá nhân 2025; và kết bằng nguyên tắc lưu trữ, chia sẻ dữ liệu có trách nhiệm.

## Kế hoạch quản lý dữ liệu trước khi thu thập

> [!ghi-nho] **Kế hoạch quản lý dữ liệu (data management plan)** là văn bản ngắn xác định trước khi thu thập dữ liệu: ai **sở hữu** dữ liệu (thường là đơn vị chủ quản nghiên cứu, không phải cá nhân nhà nghiên cứu), dữ liệu **lưu ở đâu** (máy tính cá nhân là lựa chọn kém nhất — nên dùng hệ thống lưu trữ có sao lưu của đơn vị), **ai được truy cập** (danh sách cụ thể, không phải "cả nhóm nghiên cứu" chung chung), **lưu bao lâu** sau khi nghiên cứu kết thúc, và **huỷ khi nào/bằng cách nào**.

> [!canh-bao] Bắt đầu thu thập dữ liệu mà chưa có kế hoạch này thường dẫn tới tình huống lúng túng về sau: dữ liệu nằm rải rác trên nhiều máy tính cá nhân, không ai chắc bản nào là bản mới nhất, và khi có yêu cầu xoá dữ liệu (từ người tham gia rút đồng ý, hoặc hết thời hạn lưu trữ theo quy định) không biết phải xoá ở đâu cho đủ. Nhiều quỹ tài trợ quốc tế và hội đồng đạo đức hiện yêu cầu nộp kế hoạch này cùng hồ sơ xin phê duyệt.

## Ẩn danh hoá kỹ thuật: hơn cả việc đổi tên

> [!canh-bao] Sai lầm phổ biến nhất về ẩn danh hoá: nghĩ rằng chỉ cần thay tên thật bằng mã số (ID1, ID2...) là dữ liệu đã "ẩn danh hoàn toàn". Trên thực tế, nếu các biến còn lại (tuổi, giới tính, đơn vị công tác, chức vụ, thời điểm tham gia) đủ đặc biệt, tổ hợp của chúng vẫn có thể **chỉ đúng một người** trong bối cảnh cụ thể — gọi là rủi ro **tái nhận dạng (re-identification)**.

> [!vi-du] Một khảo sát nội bộ trong một khoa có 15 giảng viên, thu thập: mã ID, tuổi, giới tính, chức danh (giảng viên/phó giáo sư/giáo sư), số năm công tác, ý kiến về một chính sách mới. Nếu khoa chỉ có một giáo sư nữ trên 55 tuổi, dòng dữ liệu của người này — dù đã "ẩn danh" bằng mã ID — vẫn chỉ đúng một người mà bất kỳ đồng nghiệp nào trong khoa cũng suy ra được, đặc biệt nếu ý kiến của người đó là tiêu cực và nhạy cảm.

> [!ghi-nho] Cách xử lý đúng: (1) **gộp nhóm** các biến định danh cao thành khoảng rộng hơn (tuổi → nhóm tuổi 10 năm, thay vì tuổi cụ thể); (2) **làm mờ hoặc lược bỏ** biến không cần thiết cho phân tích chính nếu nó làm tăng rủi ro tái nhận dạng (ví dụ chức danh cụ thể nếu không phải biến trung tâm); (3) với dữ liệu định tính, thay đổi chi tiết không cốt lõi (ví dụ đổi tên đơn vị công tác cụ thể thành "một khoa thuộc khối kỹ thuật") khi trích dẫn trực tiếp lời người tham gia trong báo cáo.

## Khung pháp lý Việt Nam: Luật Bảo vệ dữ liệu cá nhân 2025

> [!ghi-nho] Từ **01/01/2026**, **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15** (Quốc hội thông qua 26/6/2025) cùng **Nghị định 356/2025/NĐ-CP** hướng dẫn thi hành thay thế Nghị định 13/2023 làm căn cứ pháp lý chính khi nghiên cứu xử lý dữ liệu cá nhân tại Việt Nam. Một số điều khoản trực tiếp liên quan tới nghiên cứu:

| Điều | Nội dung | Áp dụng khi nào trong nghiên cứu |
|---|---|---|
| Điều 21 | Lập, lưu trữ hồ sơ đánh giá tác động xử lý dữ liệu cá nhân, gửi 1 bản chính cho cơ quan chuyên trách trong 60 ngày kể từ ngày đầu tiên xử lý | Nghiên cứu xử lý dữ liệu cá nhân ở quy mô đủ lớn (kiểm quy định cụ thể theo Nghị định 356/2025) |
| Điều 24 | Dữ liệu trẻ em: người đại diện theo pháp luật thay mặt thực hiện quyền; công bố/tiết lộ thông tin đời sống riêng tư của trẻ từ đủ 7 tuổi cần đồng ý của cả trẻ và người đại diện | Nghiên cứu giáo dục có đối tượng là học sinh dưới 18 tuổi |
| Điều 30 | Xử lý dữ liệu cá nhân trong môi trường dữ liệu lớn, AI, điện toán đám mây | Nghiên cứu dùng dịch vụ AI/cloud bên thứ ba để xử lý dữ liệu người tham gia |
| Điều 31 | Dữ liệu vị trí và dữ liệu sinh trắc học (bao gồm nhận diện khuôn mặt): bảo mật vật lý thiết bị, hạn chế truy cập, hệ thống theo dõi xâm phạm | Nghiên cứu thu thập ảnh khuôn mặt, dữ liệu vị trí GPS, hoặc dữ liệu sinh trắc khác |
| Điều 2 khoản 1 | Dữ liệu đã khử nhận dạng đúng cách không còn là dữ liệu cá nhân | Biện pháp thiết kế mạnh nhất khi cần gửi dữ liệu sang dịch vụ bên thứ ba |

> [!canh-bao] Nghiên cứu giáo dục thu thập dữ liệu học sinh dưới 18 tuổi (rất phổ biến trong lĩnh vực công nghệ giáo dục) cần đặc biệt lưu ý Điều 24: với trẻ **từ đủ 7 tuổi**, việc công bố hoặc tiết lộ thông tin đời sống riêng tư (ví dụ trích dẫn trực tiếp lời của học sinh trong bài báo, kèm chi tiết có thể nhận diện) cần đồng ý của **cả trẻ lẫn người đại diện** — không chỉ xin phép phụ huynh là đủ.

> [!meo] Điều 2 khoản 1 là công cụ thiết kế quan trọng nhất cho nghiên cứu hiện đại: nếu dữ liệu được khử nhận dạng đúng cách (không chỉ đổi tên, mà xử lý cả rủi ro tái nhận dạng như mục 2 ở trên) **trước khi** gửi cho một dịch vụ AI nước ngoài để hỗ trợ phân tích, dữ liệu đó không còn là "dữ liệu cá nhân" theo luật — giảm đáng kể nghĩa vụ pháp lý khi cần dùng công cụ AI bên thứ ba.

## Lưu trữ và chia sẻ dữ liệu có trách nhiệm

> [!canh-bao] Chia sẻ bộ dữ liệu nghiên cứu — cho đồng nghiệp, theo yêu cầu open data của tạp chí, hoặc gửi cho dịch vụ AI bên thứ ba để hỗ trợ phân tích — mà không có thoả thuận rõ ràng về mục đích sử dụng, thời hạn lưu trữ, và trách nhiệm bảo mật của bên nhận, là một lỗ hổng đạo đức dữ liệu phổ biến. "Tôi tin tưởng người này" không thay thế được một thoả thuận bằng văn bản.

> [!ghi-nho] Trước khi chia sẻ, ưu tiên theo thứ tự: (1) **khử nhận dạng** dữ liệu trước khi gửi nếu mục đích nhận không đòi hỏi dữ liệu định danh (theo Điều 2 khoản 1 ở trên); (2) nếu bắt buộc phải giữ định danh (ví dụ cần liên hệ lại người tham gia), lập **thoả thuận chia sẻ dữ liệu (data sharing agreement)** ghi rõ mục đích, thời hạn, và cam kết bảo mật của bên nhận; (3) với yêu cầu open data của tạp chí, kiểm dữ liệu công khai có còn giữ rủi ro tái nhận dạng không trước khi tải lên kho dữ liệu công khai — không tự động coi "đã ẩn danh" là an toàn để công khai.

## Luyện tập và tài liệu tham khảo

### Cá nhân (40 phút)

Lập kế hoạch quản lý dữ liệu ngắn cho đề tài của bạn (ai sở hữu, lưu ở đâu, ai truy cập, lưu bao lâu, huỷ khi nào). Với bộ biến bạn dự định thu thập, đánh giá rủi ro tái nhận dạng: có biến nào, khi tổ hợp lại, có thể chỉ đúng một người trong bối cảnh nghiên cứu của bạn không?

### Nhóm 3-4 người (25 phút)

Đổi đánh giá rủi ro tái nhận dạng cho nhau. Với đề tài có đối tượng dưới 18 tuổi hoặc thu thập dữ liệu sinh trắc học, kiểm: đã tính tới nghĩa vụ theo Điều 24 hoặc Điều 31 của Luật Bảo vệ dữ liệu cá nhân chưa?

### Bài tập về nhà (60 phút)

Viết kế hoạch quản lý và bảo vệ dữ liệu đầy đủ cho đề tài của bạn (300-400 từ): kế hoạch quản lý dữ liệu, biện pháp ẩn danh hoá kỹ thuật cụ thể, đối chiếu nghĩa vụ pháp lý liên quan (nếu có), và kế hoạch chia sẻ dữ liệu (nếu dự định chia sẻ hoặc công khai).

:::mau Mẫu nộp bài tập về nhà
**Kế hoạch quản lý dữ liệu (sở hữu, lưu trữ, truy cập, thời hạn, huỷ):** …

**Đánh giá rủi ro tái nhận dạng và biện pháp ẩn danh hoá:** …

**Nghĩa vụ pháp lý liên quan (Điều 21/24/30/31 nếu áp dụng):** …

**Kế hoạch chia sẻ/công khai dữ liệu (nếu có):** …
:::

### Nguồn tham khảo

- Quốc hội nước CHXHCN Việt Nam. (2025). *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.*
- Chính phủ nước CHXHCN Việt Nam. (2025). *Nghị định số 356/2025/NĐ-CP quy định chi tiết một số điều của Luật Bảo vệ dữ liệu cá nhân.*
- El Emam, K., & Arbuckle, L. (2013). *Anonymizing Health Data: Case Studies and Methods to Get You Started.* O'Reilly Media.
- Research Data Alliance. *FAIR Data Principles* (Findable, Accessible, Interoperable, Reusable).
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "dd3-dmp-truoc-thu-thap",
                "type": "mcq",
                "prompt": "Một nhóm nghiên cứu bắt đầu thu thập dữ liệu khảo sát mà chưa xác định trước ai sở hữu, lưu ở đâu, và huỷ khi nào. Vấn đề của cách làm này là gì?",
                "explanation": "Thiếu kế hoạch quản lý dữ liệu thường dẫn tới dữ liệu rải rác không kiểm soát được, khó xử lý khi có yêu cầu xoá hoặc hết thời hạn lưu trữ — cần lập kế hoạch trước khi thu thập, không phải xử lý khi có vấn đề phát sinh.",
                "points": 2,
                "options": [
                    {"label": "Thiếu kế hoạch quản lý dữ liệu — dễ dẫn tới dữ liệu rải rác, khó kiểm soát khi cần xoá hoặc hết hạn lưu trữ", "isCorrect": True},
                    {"label": "Không có vấn đề gì, kế hoạch quản lý dữ liệu chỉ cần thiết cho nghiên cứu y sinh", "isCorrect": False, "misconception": "dd.no-data-management-plan"},
                    {"label": "Không có vấn đề gì, miễn là dữ liệu được lưu trên máy tính của người phụ trách chính", "isCorrect": False, "misconception": "dd.no-data-management-plan"},
                    {"label": "Vấn đề duy nhất là cần backup dữ liệu thường xuyên hơn", "isCorrect": False},
                ],
            },
            {
                "key": "dd3-doi-ten-chua-du",
                "type": "mcq",
                "prompt": "Một khảo sát nội bộ khoa có 15 giảng viên đổi tên thật thành mã ID, nhưng vẫn giữ tuổi, giới tính, và chức danh cụ thể. Nếu khoa chỉ có một giáo sư nữ trên 55 tuổi, đây có phải đã ẩn danh hoàn toàn chưa?",
                "explanation": "Chưa — dù đã đổi tên thành mã ID, tổ hợp tuổi + giới tính + chức danh vẫn có thể chỉ đúng một người trong bối cảnh cụ thể (rủi ro tái nhận dạng). Cần gộp nhóm hoặc làm mờ thêm các biến định danh cao.",
                "points": 3,
                "options": [
                    {"label": "Chưa — tổ hợp tuổi, giới tính, chức danh vẫn có thể chỉ đúng một người (rủi ro tái nhận dạng)", "isCorrect": True},
                    {"label": "Đã đủ, vì tên thật không còn xuất hiện trong dữ liệu", "isCorrect": False, "misconception": "dd.rename-is-anonymization"},
                    {"label": "Đã đủ, vì mã ID không thể truy ngược lại tên thật bằng mắt thường", "isCorrect": False, "misconception": "dd.rename-is-anonymization"},
                    {"label": "Không liên quan tới ẩn danh hoá, vì đây chỉ là vấn đề bảo mật kỹ thuật", "isCorrect": False, "misconception": "dd.rename-is-anonymization"},
                ],
            },
            {
                "key": "dd3-tre-em-dieu-24",
                "type": "mcq",
                "prompt": "Một nghiên cứu giáo dục muốn trích dẫn trực tiếp lời của một học sinh 10 tuổi (kèm chi tiết có thể nhận diện) trong bài báo công bố. Theo Điều 24 của Luật Bảo vệ dữ liệu cá nhân, cần đồng ý của ai?",
                "explanation": "Với trẻ từ đủ 7 tuổi, việc công bố/tiết lộ thông tin đời sống riêng tư cần đồng ý của CẢ trẻ lẫn người đại diện theo pháp luật — không chỉ xin phép phụ huynh là đủ.",
                "points": 3,
                "options": [
                    {"label": "Cần đồng ý của cả học sinh (từ đủ 7 tuổi) và người đại diện theo pháp luật", "isCorrect": True},
                    {"label": "Chỉ cần đồng ý của phụ huynh/người đại diện, không cần hỏi học sinh", "isCorrect": False, "misconception": "dd.ignore-bvdlcn-law"},
                    {"label": "Chỉ cần đồng ý của học sinh, vì đây là trải nghiệm cá nhân của em", "isCorrect": False, "misconception": "dd.ignore-bvdlcn-law"},
                    {"label": "Không cần đồng ý gì thêm nếu đã ẩn danh tên học sinh trong bài báo", "isCorrect": False, "misconception": "dd.ignore-bvdlcn-law"},
                ],
            },
            {
                "key": "dd3-chia-se-du-lieu",
                "type": "mcq",
                "prompt": "Một nhà nghiên cứu gửi dữ liệu khảo sát (còn giữ định danh) cho một dịch vụ AI bên thứ ba để hỗ trợ phân tích, không có thoả thuận bảo mật hay khử nhận dạng trước. Vấn đề của cách làm này là gì?",
                "explanation": "Chia sẻ dữ liệu còn định danh mà không có thoả thuận rõ ràng về mục đích, thời hạn, và trách nhiệm bảo mật là lỗ hổng đạo đức dữ liệu — nên ưu tiên khử nhận dạng trước khi gửi, hoặc lập thoả thuận chia sẻ dữ liệu rõ ràng.",
                "points": 3,
                "options": [
                    {"label": "Thiếu khử nhận dạng hoặc thoả thuận bảo mật rõ ràng trước khi chia sẻ dữ liệu còn định danh với bên thứ ba", "isCorrect": True},
                    {"label": "Không có vấn đề gì nếu dịch vụ AI đó là công cụ phổ biến, nhiều người dùng", "isCorrect": False, "misconception": "dd.share-data-no-agreement"},
                    {"label": "Không có vấn đề gì, vì mục đích chỉ để hỗ trợ phân tích, không phải công bố công khai", "isCorrect": False, "misconception": "dd.share-data-no-agreement"},
                    {"label": "Vấn đề duy nhất là nên chọn dịch vụ AI trả phí thay vì miễn phí", "isCorrect": False},
                ],
            },
            {
                "key": "dd3-khu-nhan-dang",
                "type": "mcq",
                "prompt": "Theo Điều 2 khoản 1 của Luật Bảo vệ dữ liệu cá nhân, dữ liệu đã khử nhận dạng đúng cách có còn là dữ liệu cá nhân không?",
                "explanation": "Không — dữ liệu đã khử nhận dạng đúng cách (xử lý cả rủi ro tái nhận dạng, không chỉ đổi tên) không còn là dữ liệu cá nhân theo luật, đây là biện pháp thiết kế mạnh nhất khi cần chia sẻ dữ liệu với bên thứ ba.",
                "points": 2,
                "options": [
                    {"label": "Không, dữ liệu đã khử nhận dạng đúng cách không còn là dữ liệu cá nhân theo luật", "isCorrect": True},
                    {"label": "Có, mọi dữ liệu từng liên quan tới một cá nhân đều mãi là dữ liệu cá nhân", "isCorrect": False},
                    {"label": "Chỉ đúng nếu dữ liệu được lưu trữ tại Việt Nam", "isCorrect": False},
                    {"label": "Luật không quy định gì về vấn đề này", "isCorrect": False},
                ],
            },
            {
                "key": "dd3-thu-tu-quan-ly-du-lieu",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước quản lý dữ liệu có đạo đức trong một nghiên cứu.",
                "explanation": "Từ lập kế hoạch quản lý dữ liệu trước khi thu thập, đánh giá rủi ro tái nhận dạng, đối chiếu nghĩa vụ pháp lý, tới khử nhận dạng/lập thoả thuận trước khi chia sẻ.",
                "points": 3,
                "sequence": [
                    "Lập kế hoạch quản lý dữ liệu trước khi bắt đầu thu thập",
                    "Đánh giá rủi ro tái nhận dạng từ tổ hợp các biến sẽ thu thập",
                    "Đối chiếu nghĩa vụ theo Luật Bảo vệ dữ liệu cá nhân nếu có dữ liệu nhạy cảm",
                    "Áp dụng biện pháp ẩn danh hoá kỹ thuật (gộp nhóm, làm mờ biến định danh cao)",
                    "Khử nhận dạng hoặc lập thoả thuận chia sẻ dữ liệu rõ ràng trước khi chia sẻ với bên thứ ba",
                ],
            },
            {
                "key": "dd3-noi-dieu-luat",
                "type": "matching",
                "prompt": "Nối mỗi điều khoản của Luật Bảo vệ dữ liệu cá nhân với đúng nội dung áp dụng trong nghiên cứu.",
                "explanation": "Điều 21 quy định hồ sơ đánh giá tác động; Điều 24 bảo vệ dữ liệu trẻ em; Điều 30 áp dụng khi xử lý dữ liệu qua AI/cloud; Điều 31 áp dụng cho dữ liệu sinh trắc học/vị trí.",
                "points": 3,
                "pairs": [
                    {"left": "Điều 21", "right": "Lập và lưu trữ hồ sơ đánh giá tác động xử lý dữ liệu cá nhân"},
                    {"left": "Điều 24", "right": "Bảo vệ dữ liệu trẻ em, cần đồng ý của cả trẻ (từ đủ 7 tuổi) và người đại diện"},
                    {"left": "Điều 30", "right": "Xử lý dữ liệu cá nhân trong môi trường dữ liệu lớn, AI, điện toán đám mây"},
                    {"left": "Điều 31", "right": "Bảo mật dữ liệu vị trí và dữ liệu sinh trắc học (bao gồm nhận diện khuôn mặt)"},
                ],
            },
            {
                "key": "dd3-viet-ke-hoach",
                "type": "essay",
                "prompt": "Viết kế hoạch quản lý và bảo vệ dữ liệu cho đề tài của bạn (250-350 từ), gồm: (a) kế hoạch quản lý dữ liệu cơ bản (sở hữu, lưu trữ, truy cập, thời hạn); (b) đánh giá rủi ro tái nhận dạng và biện pháp ẩn danh hoá cụ thể; (c) nghĩa vụ pháp lý liên quan theo Luật Bảo vệ dữ liệu cá nhân (nếu áp dụng); (d) kế hoạch chia sẻ dữ liệu nếu có.",
                "points": 5,
            },
        ],
    },
}

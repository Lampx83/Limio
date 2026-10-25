# -*- coding: utf-8 -*-
"""Bài 1, bài học viên mở khi bấm "Học thử" trên trang Bắt đầu.

Bài giữ ngắn nhất cả khoá (khoảng 15 phút) nhưng có đủ các hình thức của khoá: khung trò chuyện mô phỏng, ảnh
minh hoạ có giấy phép, các bước, hai cột so sánh, thẻ, hỏi đáp, thẻ ghi nhớ, tài liệu tham khảo và một bài kiểm
tra bảy câu thuộc bảy dạng khác nhau.

Văn phong: câu đầy đủ chủ ngữ và vị ngữ, nối ý bằng từ nối, khái niệm được định nghĩa trước khi dùng; dấu nháy cong
trong lời văn (xem quy ước học liệu của dự án). Ảnh lấy từ Wikimedia Commons, giấy phép đã kiểm qua API và đã mở
xem trước khi đưa vào (24/10/2026).
"""

CHAT_MOCK = r"""
```html
<div style="max-width:40rem;margin:1.2rem auto;border:1px solid rgba(127,127,127,.28);border-radius:1rem;overflow:hidden;font-size:1rem;line-height:1.6">
  <div style="padding:.55rem 1rem;background:rgba(127,127,127,.10);font-size:.85rem;opacity:.85">Trợ lý AI · cuộc trò chuyện minh hoạ</div>
  <div style="padding:1rem;display:grid;gap:.8rem">
    <div style="justify-self:end;max-width:85%;background:rgba(59,130,246,.16);border-radius:1rem 1rem .25rem 1rem;padding:.6rem .9rem">
      Bao nhiêu phần trăm sinh viên Việt Nam dùng AI để học? Cho mình con số kèm nguồn nhé.
    </div>
    <div style="justify-self:start;max-width:90%;background:rgba(127,127,127,.12);border-radius:1rem 1rem 1rem .25rem;padding:.6rem .9rem">
      Theo <b>Khảo sát Thói quen Học tập Đông Nam Á 2024</b> của Viện Nghiên cứu Giáo dục Mekong, <b>73,4%</b> sinh viên Việt Nam
      dùng công cụ AI ít nhất một lần mỗi tuần để học, tăng 21 điểm phần trăm so với năm trước (trang 37 của báo cáo).
      Nhóm ngành kinh tế dùng nhiều nhất, ở mức 81,2%.
    </div>
  </div>
  <div style="padding:.6rem 1rem;border-top:1px dashed rgba(127,127,127,.35);font-size:.85rem;opacity:.85">
    Câu trả lời trên do người soạn bài dựng lại để minh hoạ. Viện nghiên cứu, bản khảo sát và mọi con số trong đó <b>đều không có thật.</b>
  </div>
</div>
```
"""

NEURAL_NET_FIGURE = r"""
```html
<figure class="lesson-figure" style="margin:1.2rem auto;max-width:22rem;text-align:center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Colored_neural_network.svg/1280px-Colored_neural_network.svg.png" alt="Sơ đồ mạng nơ-ron nhân tạo gồm lớp đầu vào, lớp ẩn và lớp đầu ra nối với nhau bằng các mũi tên" style="background:#fff;border-radius:.6rem;padding:.8rem;max-width:100%">
  <figcaption style="font-size:.9rem;opacity:.85;margin-top:.5rem">Sơ đồ một mạng nơ-ron nhân tạo đơn giản với lớp đầu vào, lớp ẩn và lớp đầu ra. Mô hình ngôn ngữ lớn được xây dựng trên cùng nguyên lý nhưng có hàng tỷ tham số. Hình: <a href="https://commons.wikimedia.org/wiki/File:Colored_neural_network.svg" target="_blank" rel="noopener noreferrer">File:Colored neural network.svg</a>, tác giả Glosser.ca, giấy phép CC BY-SA 3.0.</figcaption>
</figure>
```
"""

COURTHOUSE_IMG = (
    "![Lối vào Toà án Liên bang Daniel Patrick Moynihan ở số 500 phố Pearl, Manhattan, New York]"
    "(https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/"
    "Daniel_Patrick_Moynihan_U.S._Courthouse%2C_Manhattan%2C_New_York_%287237347688%29.jpg/"
    "1280px-Daniel_Patrick_Moynihan_U.S._Courthouse%2C_Manhattan%2C_New_York_%287237347688%29.jpg "
    "\"Toà án Liên bang Daniel Patrick Moynihan ở Manhattan là trụ sở của Toà án Quận phía Nam New York, nơi xét "
    "vụ Mata kiện Avianca năm 2023. Hình: [File:Daniel Patrick Moynihan U.S. Courthouse, Manhattan, New York "
    "(7237347688).jpg](https://commons.wikimedia.org/wiki/File:Daniel_Patrick_Moynihan_U.S._Courthouse,_Manhattan,_New_York_(7237347688).jpg), "
    "tác giả Ken Lund, giấy phép CC BY-SA 2.0.\")"
)

LESSON = {
    "title": "Bài 1 · Ảo giác AI: trôi chảy chưa chắc đúng",
    "durationMin": 15,
    "description": (
        "Bài học giải thích vì sao công cụ AI trò chuyện có thể tạo ra số liệu và nguồn không có thật mà vẫn nghe "
        "rất đáng tin, chỉ ra ba loại câu trả lời cần kiểm chứng trước khi dùng, và giới thiệu một quy trình kiểm "
        "chứng ngắn có thể thực hiện trong khoảng một phút."
    ),
    "look": {"palette": "vibrant", "font": "modern"},
    "objectives": [
        "Giải thích được vì sao một câu trả lời trôi chảy và tự tin của công cụ AI vẫn có thể sai",
        "Nhận ra được ba loại câu trả lời cần kiểm chứng trước khi dùng: số liệu cụ thể, trích dẫn kèm nguồn, và thông tin về sự việc mới xảy ra",
        "Kiểm chứng được một câu trả lời của AI bằng cách tự mở nguồn và đối chiếu đúng nội dung được trích",
    ],
    "body": CHAT_MOCK
    + r"""
Câu trả lời trên có đủ những yếu tố khiến người đọc tin tưởng. Nó nêu tên một tổ chức nghe có vẻ uy tín, đưa ra một con số chính xác tới phần thập phân và còn chỉ rõ số trang của báo cáo. Giọng văn của nó không hề ngập ngừng. Tuy vậy, toàn bộ nội dung đều do người soạn bài bịa ra, và một công cụ AI trò chuyện thật hoàn toàn có thể viết ra một câu trả lời giống hệt như thế.

:::Trước khi đọc tiếp, bạn sẽ làm gì với câu trả lời này?
Nếu bạn định chép con số ấy vào bài thuyết trình, hãy dừng lại một chút. Câu trả lời có ba tín hiệu đáng chú ý: con số rất cụ thể, có một nguồn được nêu tên, và nội dung là điều bạn chưa từng đọc thấy ở nơi nào khác. Ba tín hiệu đó cũng chính là ba loại câu trả lời mà bài học này hướng dẫn bạn kiểm chứng. Bạn sẽ thấy việc kiểm chứng chỉ mất khoảng một phút.
:::
""",
    "sections": [
        {
            "layout": "steps",
            "title": "AI tạo ra câu trả lời như thế nào",
            "intro": (
                "Muốn biết khi nào nên tin một câu trả lời của AI, trước hết cần hiểu công cụ ấy tạo ra câu trả lời "
                "bằng cách nào. Các công cụ AI trò chuyện hiện nay được xây dựng trên **mô hình ngôn ngữ lớn** "
                "(*large language model*, viết tắt LLM), tức là một **mạng nơ-ron nhân tạo** (*artificial neural "
                "network*) rất lớn được huấn luyện trên lượng văn bản khổng lồ để dự đoán chữ "
                "tiếp theo trong một đoạn văn. Bốn bước dưới đây mô tả quá trình đó ở mức giản lược, nhưng đủ để "
                "hiểu vì sao công cụ có thể sai một cách rất tự tin.\n"
                + NEURAL_NET_FIGURE
            ),
            "parts": [
                {
                    "title": "Tiếp nhận câu hỏi",
                    "md": "Câu hỏi của bạn được chia thành những đơn vị chữ nhỏ, gọi là **token**, để mô hình có thể xử lý.",
                },
                {
                    "title": "Dự đoán đơn vị chữ tiếp theo",
                    "md": (
                        "Dựa trên các mẫu ngôn ngữ đã học trong quá trình huấn luyện, mô hình chọn đơn vị chữ có "
                        "khả năng xuất hiện tiếp theo cao nhất, nghĩa là đơn vị chữ **nghe hợp lý nhất** trong ngữ cảnh. "
                        "Cơ chế này được gọi là **dự đoán token tiếp theo** (*next-token prediction*)."
                    ),
                },
                {
                    "title": "Lặp lại cho tới hết câu trả lời",
                    "md": (
                        "Mỗi đơn vị chữ vừa sinh ra lại được nối vào ngữ cảnh để dự đoán đơn vị kế tiếp. Quá trình "
                        "này lặp lại cho tới khi câu trả lời hoàn chỉnh."
                    ),
                },
                {
                    "title": "Không có bước tự kiểm chứng sự thật (fact-checking)",
                    "md": (
                        "Trong quá trình trên, không có bước nào đối chiếu câu trả lời với thực tế, trừ khi công cụ "
                        "được nối với chức năng tìm kiếm hoặc với tài liệu do bạn cung cấp. Ngay cả khi có những chức "
                        "năng đó, mô hình vẫn có thể đọc nhầm hoặc tóm tắt sai nội dung."
                    ),
                },
            ],
            "outro": (
                "> [!ghi-nho] Nội dung nghe hợp lý nhưng sai sự thật hoặc không có thật do mô hình AI tạo ra thường "
                "được gọi là **ảo giác AI** (tiếng Anh: *hallucination*). Các nghiên cứu tổng quan cho thấy đây là "
                "hiện tượng phổ biến ở các hệ thống sinh ngôn ngữ, chứ không phải một lỗi hiếm gặp [1]. Một nghiên "
                "cứu năm 2025 còn chỉ ra rằng cách huấn luyện và đánh giá mô hình hiện nay thưởng cho việc đoán hơn "
                "là cho việc thừa nhận không chắc chắn, nên mô hình có xu hướng đưa ra một câu trả lời nghe tự tin "
                "thay vì nói rằng nó không biết [2]."
            ),
        },
        {
            "layout": "compare",
            "title": "Trôi chảy và chính xác là hai phẩm chất khác nhau (fluency và accuracy)",
            "intro": (
                "Ở con người, cách diễn đạt trôi chảy thường đi cùng với hiểu biết vững vàng, vì vậy chúng ta quen "
                "dùng phẩm chất thứ nhất để đoán phẩm chất thứ hai. Với công cụ AI, hai phẩm chất này tách rời nhau "
                "hoàn toàn."
            ),
            "parts": [
                {
                    "title": "Những gì khiến câu trả lời nghe có vẻ đúng",
                    "md": (
                        "- Câu văn mạch lạc và đúng ngữ pháp.\n"
                        "- Thuật ngữ chuyên môn được dùng đúng chỗ.\n"
                        "- Câu trả lời có số liệu cụ thể và nêu tên nguồn.\n"
                        "- Giọng điệu chắc chắn, không có dấu hiệu ngập ngừng.\n\n"
                        "Công cụ AI thể hiện được tất cả những đặc điểm này một cách nhất quán, bất kể nội dung "
                        "đúng hay sai."
                    ),
                },
                {
                    "title": "Những gì cho biết câu trả lời thực sự đúng",
                    "md": (
                        "- Dữ kiện khớp với thực tế.\n"
                        "- Nguồn được nêu là có thật.\n"
                        "- Nguồn ấy thực sự nói điều được gán cho nó.\n"
                        "- Thông tin vẫn còn hiệu lực tại thời điểm bạn sử dụng.\n\n"
                        "Những đặc điểm này chỉ có thể kiểm chứng bằng cách ra khỏi cuộc trò chuyện và đối chiếu "
                        "với nguồn bên ngoài."
                    ),
                },
            ],
            "outro": (
                COURTHOUSE_IMG
                + "\n\n"
                + "> [!vi-du] Năm 2023, trong vụ *Mata kiện Avianca* tại Toà án Quận phía Nam New York (Hoa Kỳ), "
                "luật sư của nguyên đơn nộp cho toà một bản lập luận dẫn sáu bản án do ChatGPT cung cấp. Cả sáu bản "
                "án đều không tồn tại, dù chúng có tên vụ, tên toà và cả trích dẫn nghe rất chuyên nghiệp. Luật sư "
                "cho biết ông đã hỏi lại chính ChatGPT xem các bản án đó có thật hay không và được trả lời là có. "
                "Ngày 22 tháng 6 năm 2023, toà phạt các luật sư 5.000 đô la Mỹ [3]."
            ),
        },
        {
            "layout": "cards",
            "title": "Ba loại câu trả lời cần kiểm chứng trước khi dùng",
            "intro": (
                "Bạn không cần kiểm chứng từng chữ do AI viết ra. Phần lớn câu trả lời của AI rất hữu ích khi được "
                "dùng làm bản nháp, dàn ý hay lời giải thích ban đầu. Tuy nhiên, khi câu trả lời thuộc một trong ba "
                "loại dưới đây, bạn cần kiểm chứng trước khi đưa nó vào bài làm, tin nhắn hay quyết định của mình."
            ),
            "parts": [
                {
                    "title": "Số liệu cụ thể",
                    "md": (
                        "Loại này gồm tỷ lệ phần trăm, mốc thời gian, số tiền và các thống kê. Một con số lẻ thường "
                        "khiến người đọc tin hơn, nhưng AI tạo ra con số lẻ cũng dễ dàng như con số tròn. Cách kiểm "
                        "chứng là tìm đúng con số ấy trong **nguồn gốc** (*primary source*) đã công bố nó."
                    ),
                },
                {
                    "title": "Trích dẫn kèm nguồn (citation)",
                    "md": (
                        "Loại này gồm tên sách, bài báo, nghiên cứu, đường dẫn và câu nói được gán cho một người "
                        "nổi tiếng. Đây là chỗ AI dễ bịa nhất, vì một nguồn bịa trông giống hệt một nguồn thật. "
                        "Cách kiểm chứng là tự mở nguồn và tìm đúng câu được trích."
                    ),
                },
                {
                    "title": "Sự việc mới xảy ra",
                    "md": (
                        "Loại này gồm tin tức, giá cả, quy định và lịch thi. Mỗi mô hình chỉ được học dữ liệu tới một "
                        "mốc thời gian nhất định, gọi là **mốc kiến thức** (*knowledge cutoff*), nên với sự việc sau mốc đó nó có thể không biết hoặc chỉ đoán. Cách "
                        "kiểm chứng là xem trang chính thức có ghi ngày cập nhật."
                    ),
                },
            ],
        },
        {
            "layout": "steps",
            "title": "Quy trình kiểm chứng trong một phút (verification)",
            "intro": (
                "Khi một câu trả lời thuộc một trong ba loại trên, bạn có thể kiểm chứng nó theo bốn bước sau. Sau "
                "vài lần thực hành, quy trình này sẽ trở thành phản xạ."
            ),
            "parts": [
                {
                    "title": "Hỏi nguồn",
                    "md": (
                        "Nếu câu trả lời chưa có nguồn, bạn hãy hỏi công cụ AI: “Thông tin này lấy từ đâu? Hãy cho "
                        "mình đường dẫn tới nguồn gốc.”"
                    ),
                },
                {
                    "title": "Tự mở nguồn",
                    "md": (
                        "Bạn bấm vào đường dẫn hoặc tự tìm tên nguồn trên công cụ tìm kiếm. Nếu không mở được hoặc "
                        "không tìm thấy nguồn, bạn nên coi như câu trả lời chưa có nguồn."
                    ),
                },
                {
                    "title": "Đối chiếu đúng nội dung được trích",
                    "md": (
                        "Bước này còn được gọi là **đối chiếu chéo** (*cross-checking*). Bạn tìm trong nguồn đúng con "
                        "số hoặc đúng câu được trích. Một nguồn có thật nhưng không nói "
                        "điều được gán cho nó vẫn là một trích dẫn sai."
                    ),
                },
                {
                    "title": "Ghi lại mức độ tin cậy",
                    "md": (
                        "Nếu đã kiểm chứng được, bạn sử dụng thông tin và ghi rõ nguồn gốc. Nếu chưa kiểm chứng "
                        "được, bạn ghi rõ là “chưa xác minh” hoặc không sử dụng thông tin đó."
                    ),
                },
            ],
            "outro": (
                "> [!canh-bao] Hỏi lại công cụ AI “bạn có chắc không?” không phải là kiểm chứng. Công cụ có thể "
                "khẳng định lại một điều sai, hoặc đổi câu trả lời chỉ vì bạn hỏi vặn. Kiểm chứng luôn cần một "
                "nguồn nằm ngoài cuộc trò chuyện.\n\n"
                "> [!meo] Để thực hành ngay, bạn hãy mở công cụ AI quen dùng và đặt một câu hỏi có số liệu về "
                "trường, công ty hoặc thành phố của mình, kèm yêu cầu “cho mình nguồn”. Sau đó, bạn thực hiện bốn "
                "bước trên và ghi lại xem nguồn được nêu có thực sự nói đúng điều được trích hay không."
            ),
        },
        {
            "layout": "faq",
            "title": "Câu hỏi thường gặp",
            "parts": [
                {
                    "title": "Công cụ AI có chức năng tìm kiếm thì còn tạo ra thông tin sai không?",
                    "md": (
                        "Khả năng sai giảm đi nhưng không mất hẳn. Công cụ vẫn có thể đọc nhầm nguồn, tóm tắt sai "
                        "nội dung, hoặc ghép một con số đúng với một nguồn khác. Việc có đường dẫn giúp bạn kiểm "
                        "chứng nhanh hơn, nhưng không thay thế được việc kiểm chứng."
                    ),
                },
                {
                    "title": "Vậy có nên dùng AI để học không?",
                    "md": (
                        "Có. AI rất hữu ích khi bạn cần giải thích lại một khái niệm, gợi ý dàn ý, tìm ví dụ hay "
                        "tạo câu hỏi ôn tập. Bài học này không khuyên bạn bỏ AI, mà giúp bạn biết phần nào trong "
                        "câu trả lời cần kiểm chứng."
                    ),
                },
                {
                    "title": "Kiểm chứng mọi thứ có tốn quá nhiều thời gian không?",
                    "md": (
                        "Bạn không cần kiểm chứng mọi thứ, mà chỉ cần kiểm chứng ba loại câu trả lời đã nêu trong "
                        "bài. Với ba loại đó, một phút kiểm chứng tốn ít công sức hơn nhiều so với hậu quả của việc "
                        "nộp một bài làm có số liệu bịa đặt."
                    ),
                },
            ],
        },
        {
            "layout": "text",
            "title": "Tài liệu tham khảo",
            "parts": [
                {
                    "md": (
                        "1. Ji, Z., Lee, N., Frieske, R., và cộng sự (2023). Survey of hallucination in natural language "
                        "generation. *ACM Computing Surveys*, 55(12), bài 248. "
                        "[Bản trên arXiv](https://arxiv.org/abs/2202.03629)\n"
                        "2. Kalai, A. T., Nachum, O., Vempala, S. S., và Zhang, E. (2025). Why language models "
                        "hallucinate. *arXiv:2509.04664*. [Xem bài báo](https://arxiv.org/abs/2509.04664)\n"
                        "3. Mata v. Avianca, Inc., Toà án Quận phía Nam New York, quyết định ngày 22/6/2023. "
                        "[Tóm tắt vụ việc trên Wikipedia](https://en.wikipedia.org/wiki/Mata_v._Avianca,_Inc.)\n\n"
                        "Để tìm hiểu thêm, bạn có thể xem video “Why Large Language Models Hallucinate” của kênh "
                        "IBM Technology (tiếng Anh, 9 phút 37 giây): "
                        "[xem trên YouTube](https://www.youtube.com/watch?v=cfqtFvWOfg0)."
                    ),
                },
            ],
        },
    ],
    "flashcards": {
        "title": "Thẻ ghi nhớ · Bài 1",
        "items": [
            {
                "term": "Ảo giác AI (AI hallucination)",
                "meaning": "Ảo giác AI là nội dung nghe hợp lý và tự tin nhưng sai sự thật hoặc không có thật do mô hình AI tạo ra.",
                "example": "Công cụ AI dẫn một bản án, một cuốn sách hay một khảo sát không hề tồn tại.",
            },
            {
                "term": "Mô hình ngôn ngữ lớn (large language model, LLM)",
                "meaning": "Mô hình ngôn ngữ lớn là mạng nơ-ron nhân tạo được huấn luyện trên lượng văn bản khổng lồ để dự đoán chữ tiếp theo trong một đoạn văn.",
            },
            {
                "term": "Token",
                "meaning": "Token là đơn vị chữ nhỏ mà mô hình ngôn ngữ dùng để đọc câu hỏi và sinh câu trả lời; mô hình tạo câu trả lời bằng cách dự đoán lần lượt từng token tiếp theo (next-token prediction).",
            },
            {
                "term": "Trôi chảy và chính xác (fluency vs. accuracy)",
                "meaning": "Câu văn mạch lạc và giọng điệu chắc chắn không cho biết nội dung có đúng hay không, vì công cụ AI viết trôi chảy như nhau dù đúng hay sai.",
            },
            {
                "term": "Ba loại câu trả lời cần kiểm chứng",
                "meaning": "Ba loại cần kiểm chứng trước khi dùng là số liệu cụ thể, trích dẫn kèm nguồn, và thông tin về sự việc mới xảy ra.",
            },
            {
                "term": "Quy trình kiểm chứng trong một phút (verification)",
                "meaning": "Quy trình gồm bốn bước: hỏi nguồn, tự mở nguồn, đối chiếu đúng nội dung được trích, và ghi lại mức độ tin cậy.",
            },
            {
                "term": "Mốc kiến thức (knowledge cutoff)",
                "meaning": "Mốc kiến thức là thời điểm cuối cùng của dữ liệu mà mô hình được học; với sự việc xảy ra sau mốc đó, mô hình có thể không biết hoặc chỉ đoán.",
            },
        ],
    },
    "summary": [
        "Công cụ AI trò chuyện tạo câu trả lời bằng cách dự đoán chữ nghe hợp lý nhất, không tự đối chiếu với thực tế, nên có thể bịa ra cả số liệu lẫn nguồn.",
        "Độ trôi chảy và giọng điệu tự tin của AI không thay đổi dù nội dung đúng hay sai, vì vậy không thể dùng chúng để đánh giá độ chính xác.",
        "Ba loại câu trả lời cần kiểm chứng trước khi dùng là số liệu cụ thể, trích dẫn kèm nguồn, và thông tin về sự việc mới xảy ra.",
        "Việc kiểm chứng phải dựa vào một nguồn nằm ngoài cuộc trò chuyện, theo bốn bước: hỏi nguồn, tự mở nguồn, đối chiếu đúng nội dung được trích, và ghi lại mức độ tin cậy.",
    ],
    "lecture": [
        {
            "anchor": "mo-dau",
            "text": (
                "Chào bạn, chào mừng bạn đến với bài học đầu tiên của khoá Tư duy phản biện thời AI. Mình sẽ đồng hành "
                "cùng bạn trong khoảng mười lăm phút tới. Trước khi bắt đầu, bạn hãy nhìn vào khung trò chuyện đang hiện "
                "trên màn hình. Ở đó, một người hỏi trợ lý AI xem bao nhiêu phần trăm sinh viên Việt Nam dùng AI để học, "
                "và nhận được một câu trả lời rất gọn gàng. Câu trả lời nêu tên một bản khảo sát năm 2024 của một viện "
                "nghiên cứu, đưa ra con số bảy mươi ba phẩy bốn phần trăm, và còn chỉ rõ trang ba mươi bảy của báo cáo. "
                "Nghe rất đáng tin, phải không? Thế nhưng dòng chú thích ở cuối khung cho biết viện nghiên cứu ấy, bản "
                "khảo sát ấy và mọi con số trong đó đều không có thật. Điều đáng lo là một công cụ AI thật hoàn toàn có "
                "thể viết ra một câu trả lời giống hệt như vậy. "
                "Ngay bên dưới khung trò chuyện có một hộp mang tiêu đề Trước khi đọc tiếp. Mình đề nghị bạn dừng lại ở "
                "đây khoảng mười giây. Bạn hãy tự hỏi: nếu mình đang làm bài thuyết trình, mình có chép con số này vào "
                "không, và vì sao? Khi đã có câu trả lời của riêng mình, bạn hãy mở hộp ra để đối chiếu. Bạn sẽ thấy "
                "câu trả lời mẫu chứa ba tín hiệu đáng chú ý, và ba tín hiệu đó chính là xương sống của cả bài học hôm nay."
            ),
        },
        {
            "anchor": "AI tạo ra câu trả lời như thế nào",
            "text": (
                "Muốn biết lúc nào nên tin AI, trước hết mình cần hiểu nó tạo ra câu trả lời bằng cách nào. Các công cụ "
                "AI trò chuyện hiện nay được xây dựng trên mô hình ngôn ngữ lớn, tiếng Anh là large language model, "
                "thường viết tắt là LLM. Đó là một mạng nơ-ron nhân tạo, tức artificial neural network, có kích thước "
                "rất lớn và được huấn luyện trên một lượng văn bản khổng lồ. "
                "Hình bạn đang thấy là sơ đồ một mạng nơ-ron rất đơn giản. Bên trái là lớp đầu vào, ở giữa là lớp ẩn, "
                "bên phải là lớp đầu ra, và các mũi tên cho thấy thông tin được truyền từ lớp này sang lớp khác. Mô hình "
                "ngôn ngữ lớn dựa trên cùng nguyên lý ấy, chỉ khác là nó có tới hàng tỷ tham số. "
                "Bây giờ bạn hãy theo dõi bốn bước được đánh số trên màn hình. Ở bước thứ nhất, câu hỏi của bạn được chia "
                "thành những đơn vị chữ nhỏ gọi là token. Ở bước thứ hai, mô hình chọn token có khả năng xuất hiện tiếp "
                "theo cao nhất, tức là token nghe hợp lý nhất trong ngữ cảnh. Người ta gọi cơ chế này là dự đoán token "
                "tiếp theo, hay next-token prediction. Ở bước thứ ba, token vừa sinh ra được nối vào ngữ cảnh để đoán "
                "token kế tiếp, và quá trình cứ thế lặp lại cho tới khi câu trả lời hoàn chỉnh. "
                "Bước thứ tư là bước quan trọng nhất, vì nó nói về một điều không hề xảy ra. Trong toàn bộ quá trình ấy, "
                "không có bước nào đối chiếu câu trả lời với thực tế, tức là không có bước kiểm chứng sự thật, hay "
                "fact-checking. Ngay cả khi công cụ được nối với chức năng tìm kiếm, nó vẫn có thể đọc nhầm hoặc tóm tắt sai. "
                "Hộp Ghi nhớ màu xanh tóm lại điều này. Nội dung nghe hợp lý nhưng sai hoặc không có thật do AI tạo ra "
                "được gọi là ảo giác AI, tiếng Anh là hallucination. Theo một bài tổng quan năm 2023, đây là hiện tượng "
                "phổ biến ở các hệ thống sinh ngôn ngữ chứ không phải lỗi hiếm gặp. Một nghiên cứu năm 2025 còn chỉ ra "
                "rằng cách huấn luyện và đánh giá mô hình hiện nay thưởng cho việc đoán nhiều hơn việc thừa nhận không "
                "chắc chắn, vì vậy mô hình thường đưa ra một câu trả lời nghe tự tin thay vì nói rằng nó không biết."
            ),
        },
        {
            "anchor": "Trôi chảy và chính xác là hai phẩm chất khác nhau (fluency và accuracy)",
            "text": (
                "Phần tiếp theo phân biệt hai phẩm chất mà chúng ta rất hay nhầm lẫn: sự trôi chảy, tức fluency, và sự "
                "chính xác, tức accuracy. Với con người, ai nói năng mạch lạc thường cũng là người hiểu vấn đề, nên mình "
                "quen dùng cái thứ nhất để đoán cái thứ hai. Với AI, thói quen đó không còn đúng nữa. "
                "Bạn hãy nhìn hai cột trên màn hình. Cột bên trái liệt kê những gì khiến một câu trả lời nghe có vẻ đúng: "
                "câu văn mạch lạc, thuật ngữ dùng đúng chỗ, có số liệu và tên nguồn, giọng điệu chắc chắn. AI làm được tất "
                "cả những điều đó một cách nhất quán, bất kể nội dung đúng hay sai. Cột bên phải liệt kê những gì thật sự "
                "cho biết câu trả lời đúng: dữ kiện khớp thực tế, nguồn có thật, nguồn nói đúng điều được gán cho nó, và "
                "thông tin vẫn còn hiệu lực. Những điều này chỉ kiểm được khi bạn ra khỏi cuộc trò chuyện và đối chiếu "
                "với nguồn bên ngoài. "
                "Bức ảnh bên dưới là lối vào Toà án Liên bang Daniel Patrick Moynihan ở Manhattan, New York, trụ sở của "
                "Toà án Quận phía Nam New York. Năm 2023, tại đây đã diễn ra vụ Mata kiện Avianca. Luật sư của nguyên đơn "
                "nộp cho toà một bản lập luận dẫn sáu bản án do ChatGPT cung cấp, và cả sáu bản án đều không tồn tại. "
                "Điều đáng nói là luật sư đã hỏi lại chính ChatGPT xem các bản án có thật không, và được trả lời là có. "
                "Ngày hai mươi hai tháng sáu năm 2023, toà phạt các luật sư năm nghìn đô la Mỹ. Câu chuyện này cho thấy "
                "ngay cả người làm nghề chuyên nghiệp cũng có thể bị một câu trả lời trôi chảy đánh lừa."
            ),
        },
        {
            "anchor": "Ba loại câu trả lời cần kiểm chứng trước khi dùng",
            "text": (
                "Đến đây có thể bạn sẽ hỏi: vậy mình phải kiểm chứng mọi thứ AI viết ra sao? Câu trả lời là không. Phần "
                "lớn câu trả lời của AI rất hữu ích khi bạn dùng làm bản nháp, dàn ý hay lời giải thích ban đầu. Bạn chỉ "
                "cần đặc biệt cẩn thận với ba loại câu trả lời đang hiện trên ba thẻ màu. "
                "Thẻ thứ nhất là số liệu cụ thể, gồm tỷ lệ phần trăm, mốc thời gian, số tiền và các thống kê. Một con số "
                "lẻ thường khiến mình tin hơn, nhưng với AI, tạo ra một con số lẻ cũng dễ như tạo ra một con số tròn. Cách "
                "kiểm chứng là tìm đúng con số ấy trong nguồn gốc đã công bố nó, mà tiếng Anh gọi là primary source. "
                "Thẻ thứ hai là trích dẫn kèm nguồn, hay citation, gồm tên sách, bài báo, đường dẫn và những câu nói được "
                "gán cho người nổi tiếng. Đây là chỗ AI dễ bịa nhất, vì một nguồn bịa trông giống hệt nguồn thật. Bạn cần "
                "tự mở nguồn và tìm đúng câu được trích. "
                "Thẻ thứ ba là sự việc mới xảy ra, như tin tức, giá cả, quy định hay lịch thi. Mỗi mô hình chỉ được học "
                "dữ liệu tới một thời điểm gọi là mốc kiến thức, tức knowledge cutoff. Với chuyện xảy ra sau mốc đó, mô "
                "hình có thể không biết, hoặc chỉ đoán. Cách kiểm chứng là xem trang chính thức có ghi ngày cập nhật. "
                "Bạn có nhận ra không? Ba thẻ này trùng khớp với ba tín hiệu trong câu trả lời mẫu ở đầu bài: con số rất "
                "cụ thể, một nguồn được nêu tên, và một điều bạn chưa từng đọc thấy ở đâu khác."
            ),
        },
        {
            "anchor": "Quy trình kiểm chứng trong một phút (verification)",
            "text": (
                "Khi gặp một trong ba loại câu trả lời đó, bạn có thể áp dụng một quy trình kiểm chứng, tức verification, "
                "chỉ gồm bốn bước và mất khoảng một phút. "
                "Bước một là hỏi nguồn. Nếu câu trả lời chưa có nguồn, bạn hỏi lại công cụ AI rằng thông tin này lấy từ "
                "đâu và đề nghị nó cho đường dẫn tới nguồn gốc. "
                "Bước hai là tự mở nguồn. Bạn bấm vào đường dẫn, hoặc tự tìm tên nguồn trên công cụ tìm kiếm. Nếu không "
                "mở được hay không tìm thấy, bạn nên coi như câu trả lời chưa có nguồn. "
                "Bước ba là đối chiếu đúng nội dung được trích, còn gọi là đối chiếu chéo, hay cross-checking. Bạn tìm "
                "trong nguồn đúng con số hoặc đúng câu được trích. Một nguồn có thật nhưng không hề nói điều được gán cho "
                "nó thì vẫn là một trích dẫn sai. "
                "Bước bốn là ghi lại mức độ tin cậy. Nếu đã kiểm chứng được, bạn dùng thông tin và ghi rõ nguồn. Nếu chưa, "
                "bạn ghi rõ là chưa xác minh, hoặc không dùng thông tin đó. "
                "Bạn hãy để ý hộp Bẫy thường gặp màu cam. Hỏi lại AI rằng bạn có chắc không thì chưa phải là kiểm chứng, "
                "vì công cụ có thể khẳng định lại điều sai, giống như trong vụ Mata kiện Avianca, hoặc đổi câu trả lời chỉ "
                "vì bạn hỏi vặn. Kiểm chứng luôn cần một nguồn nằm ngoài cuộc trò chuyện. "
                "Hộp Mẹo thực hành ngay bên dưới gợi ý một bài tập nhỏ. Sau khi nghe xong phần này, bạn hãy mở công cụ AI "
                "quen dùng, hỏi một câu có số liệu về trường, công ty hay thành phố của mình kèm yêu cầu cho nguồn, rồi "
                "thử đi đủ bốn bước. Kết quả có thể sẽ khiến bạn bất ngờ."
            ),
        },
        {
            "anchor": "Câu hỏi thường gặp",
            "text": (
                "Trước khi tổng kết, mình trả lời nhanh ba câu hỏi mà người học hay đặt ra. Câu thứ nhất: nếu công cụ AI "
                "có chức năng tìm kiếm thì nó còn tạo ra thông tin sai không? Khả năng sai giảm đi nhưng không mất hẳn, vì "
                "công cụ vẫn có thể đọc nhầm nguồn, tóm tắt sai, hoặc ghép một con số đúng với một nguồn khác. Đường dẫn "
                "giúp bạn kiểm chứng nhanh hơn chứ không thay thế được việc kiểm chứng. "
                "Câu thứ hai: vậy có nên dùng AI để học không? Có chứ. AI rất hữu ích khi bạn cần giải thích lại một khái "
                "niệm, gợi ý dàn ý, tìm ví dụ hay tạo câu hỏi ôn tập. Bài học này không khuyên bạn bỏ AI, mà giúp bạn biết "
                "phần nào cần kiểm chứng. "
                "Câu thứ ba: kiểm chứng như vậy có tốn quá nhiều thời gian không? Bạn chỉ cần kiểm chứng ba loại câu trả "
                "lời đã học. Với ba loại đó, một phút kiểm chứng rẻ hơn rất nhiều so với hậu quả của việc nộp một bài làm "
                "có số liệu bịa đặt."
            ),
        },
        {
            "anchor": "tong-ket",
            "text": (
                "Chúng ta cùng tóm lại bốn ý chính của bài học. Thứ nhất, công cụ AI trò chuyện tạo câu trả lời bằng cách "
                "dự đoán chữ nghe hợp lý nhất, không tự đối chiếu với thực tế, nên có thể bịa ra cả số liệu lẫn nguồn. "
                "Thứ hai, sự trôi chảy và giọng điệu tự tin của AI không thay đổi dù nội dung đúng hay sai, vì vậy bạn "
                "không thể dựa vào chúng để đánh giá độ chính xác. Thứ ba, có ba loại câu trả lời cần kiểm chứng trước khi "
                "dùng: số liệu cụ thể, trích dẫn kèm nguồn, và sự việc mới xảy ra. Thứ tư, việc kiểm chứng phải dựa vào một "
                "nguồn nằm ngoài cuộc trò chuyện, theo bốn bước hỏi nguồn, tự mở nguồn, đối chiếu đúng nội dung được trích, "
                "và ghi lại mức độ tin cậy. "
                "Bên dưới phần tổng kết có bộ thẻ ghi nhớ với các thuật ngữ của bài, kèm tên tiếng Anh. Bạn có thể lật thẻ "
                "để ôn lại bất cứ lúc nào. Còn bây giờ, mời bạn làm bài kiểm tra nhanh gồm bảy câu để xem mình đã nắm bài "
                "tới đâu. Nếu chọn sai, bạn sẽ nhận được phản hồi chỉ đúng chỗ mình hiểu nhầm. Chúc bạn làm bài tốt, và hẹn "
                "gặp lại bạn ở bài thứ hai."
            ),
        },
    ],
    "podcast": {
        "title": "Tập 1 · Khi AI nói trôi chảy mà vẫn sai",
        "durationMin": 6,
        "hosts": {"A": "Khoa", "B": "Linh"},
        "turns": [
            {"speaker": "A", "text": "Xin chào các bạn, mình là Khoa. Chào mừng các bạn đến với series podcast Tư duy phản biện thời AI."},
            {"speaker": "B", "text": "Và mình là Linh. Series của chúng mình có sáu tập, đi cùng sáu bài học của khoá. Mỗi tập khoảng sáu phút, để các bạn nghe lúc đi xe buýt hay lúc pha cà phê buổi sáng."},
            {"speaker": "A", "text": "Sáu tập sẽ đi từ việc đọc thông tin trong thời AI tới việc làm việc cùng AI mà vẫn giữ được phần tự suy nghĩ. Tập đầu tiên hôm nay có một tiêu đề hơi ngược đời: khi AI nói trôi chảy mà vẫn sai."},
            {"speaker": "B", "text": "Mình phải thú thật là mình hay tin AI chính vì nó viết quá trôi chảy. Hôm trước mình hỏi một con số về thị trường cà phê, nó trả lời có phần thập phân, có cả tên báo cáo. Mình chép luôn vào slide."},
            {"speaker": "A", "text": "Đó chính là cái bẫy mà bài học hôm nay nói tới. Để hiểu vì sao, mình cần biết AI tạo ra câu trả lời như thế nào. Các công cụ AI trò chuyện được xây dựng trên mô hình ngôn ngữ lớn, tiếng Anh là large language model. Về cơ bản, mô hình này học từ một lượng văn bản khổng lồ để đoán xem chữ tiếp theo nên là chữ gì."},
            {"speaker": "B", "text": "Tức là nó đoán chữ, chứ không tra cứu sự thật như một thư viện?"},
            {"speaker": "A", "text": "Đúng vậy. Câu hỏi được chia thành các đơn vị chữ nhỏ gọi là token, rồi mô hình lần lượt chọn token nghe hợp lý nhất để viết tiếp. Người ta gọi đó là next-token prediction. Trong cả quá trình, không có bước nào tự đối chiếu với thực tế."},
            {"speaker": "B", "text": "Vậy khi nó viết ra một con số nghe rất hợp lý thì sao?"},
            {"speaker": "A", "text": "Con số đó có thể đúng, nhưng cũng có thể là một con số chỉ nghe hợp lý. Nội dung nghe hợp lý nhưng sai hoặc không có thật do AI tạo ra được gọi là ảo giác AI, tiếng Anh là hallucination. Một bài tổng quan năm 2023 cho thấy đây là hiện tượng phổ biến, chứ không phải lỗi hiếm gặp. Một nghiên cứu năm 2025 còn chỉ ra rằng cách huấn luyện mô hình hiện nay thưởng cho việc đoán hơn là cho việc nói mình không biết."},
            {"speaker": "B", "text": "Nghe hơi đáng sợ. Có ví dụ thật nào mà hậu quả rõ ràng không, Khoa?"},
            {"speaker": "A", "text": "Có một vụ rất nổi tiếng là vụ Mata kiện Avianca năm 2023, tại Toà án Quận phía Nam New York. Luật sư của nguyên đơn nộp cho toà một bản lập luận dẫn sáu bản án do ChatGPT cung cấp. Cả sáu bản án đều không tồn tại."},
            {"speaker": "B", "text": "Luật sư mà cũng không kiểm tra sao?"},
            {"speaker": "A", "text": "Luật sư có hỏi lại chính ChatGPT xem các bản án có thật không, và được trả lời là có. Cuối cùng, toà phạt các luật sư năm nghìn đô la Mỹ."},
            {"speaker": "B", "text": "Vậy bài học ở đây là hỏi lại AI không phải là kiểm chứng."},
            {"speaker": "A", "text": "Chính xác. Hỏi lại thì bạn chỉ nhận thêm một câu trả lời từ cùng một nguồn. Kiểm chứng luôn cần một nguồn nằm ngoài cuộc trò chuyện."},
            {"speaker": "B", "text": "Nhưng nếu cái gì cũng kiểm thì mình sẽ không còn thời gian làm việc khác nữa."},
            {"speaker": "A", "text": "Bạn không cần kiểm mọi thứ. Bài học gợi ý ba loại câu trả lời cần đặc biệt cẩn thận. Loại thứ nhất là số liệu cụ thể, như phần trăm, năm tháng, số tiền. Loại thứ hai là trích dẫn kèm nguồn, như tên sách, bài báo, đường dẫn hay câu nói của người nổi tiếng. Loại thứ ba là sự việc mới xảy ra, như tin tức, giá cả hay lịch thi."},
            {"speaker": "B", "text": "Loại thứ ba là vì AI có thể chưa biết chuyện mới, đúng không?"},
            {"speaker": "A", "text": "Đúng vậy. Mỗi mô hình chỉ học dữ liệu tới một mốc thời gian gọi là knowledge cutoff, tức mốc kiến thức. Chuyện xảy ra sau mốc đó thì nó có thể không biết, hoặc chỉ đoán."},
            {"speaker": "B", "text": "Còn những thứ như gợi ý dàn ý cho bài thuyết trình hay một câu mở đầu hay thì sao?"},
            {"speaker": "A", "text": "Những thứ đó là sản phẩm sáng tạo, bạn tự đánh giá được bằng mắt, vì không có sự thật nào cần đối chiếu. Đó là chỗ AI giúp bạn rất nhiều."},
            {"speaker": "B", "text": "Vậy khi gặp một trong ba loại kia, mình kiểm chứng như thế nào cho nhanh?"},
            {"speaker": "A", "text": "Bài học có một quy trình bốn bước, mất khoảng một phút. Thứ nhất, hỏi nguồn: thông tin này lấy từ đâu. Thứ hai, tự mở nguồn: bấm vào đường dẫn hoặc tự tìm tên nguồn. Thứ ba, đối chiếu đúng câu hoặc đúng con số được trích. Thứ tư, ghi lại mức độ tin cậy: đã xác minh hay chưa."},
            {"speaker": "B", "text": "Bước thứ ba nghe đơn giản nhưng mình đoán là hay bị bỏ qua nhất."},
            {"speaker": "A", "text": "Đúng thế. Có những nguồn có thật, mở ra được hẳn hoi, nhưng lại không hề nói điều được gán cho nó. Một nguồn như vậy vẫn là một trích dẫn sai."},
            {"speaker": "B", "text": "Vậy là con số thị trường cà phê trong slide của mình, tối nay mình phải đi tìm báo cáo gốc rồi."},
            {"speaker": "A", "text": "Đó là bài tập về nhà rất tốt. Mình tóm lại nhé: AI viết trôi chảy như nhau dù đúng hay sai, nên bạn đừng dùng độ trôi chảy để đoán độ chính xác. Hãy kiểm chứng ba loại câu trả lời, gồm số liệu, trích dẫn và chuyện mới, bằng một nguồn nằm ngoài cuộc trò chuyện."},
            {"speaker": "B", "text": "Và các bạn đừng quên làm bài kiểm tra nhanh bảy câu ở cuối bài học. Nếu chọn sai, Limio sẽ chỉ ra đúng chỗ bạn hiểu nhầm."},
            {"speaker": "A", "text": "Ở tập sau, chúng ta sẽ học cách tách một lập luận thành từng phần để thấy chỗ yếu của nó. Cảm ơn các bạn đã lắng nghe."},
            {"speaker": "B", "text": "Hẹn gặp lại các bạn ở tập hai!"},
        ],
    },
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 1",
        "passThresholdPct": 60,
        "requireConfidence": False,
        "questions": [
            {
                "key": "1.1-tin-vi-sao",
                "type": "mcq",
                "prompt": (
                    "Bạn hỏi AI về tỷ lệ sinh viên đi làm thêm và nhận được câu trả lời: “Theo khảo sát năm 2024 của "
                    "một viện nghiên cứu giáo dục, 62,7% sinh viên đi làm thêm.” Yếu tố nào trong câu trả lời này cho "
                    "bạn biết nó đúng?"
                ),
                "explanation": (
                    "Không có yếu tố nào trong câu trả lời tự chứng minh được nó đúng. Con số lẻ, tên tổ chức và giọng "
                    "điệu chắc chắn đều là những thứ AI tạo ra rất dễ dàng; chỉ việc đối chiếu với nguồn gốc mới cho "
                    "biết câu trả lời có đúng hay không."
                ),
                "points": 2,
                "options": [
                    {"label": "Con số rất cụ thể, chính xác tới phần thập phân.", "isCorrect": False, "misconception": "aipb.fluency-as-accuracy"},
                    {"label": "Câu trả lời có nêu tên một viện nghiên cứu làm nguồn.", "isCorrect": False, "misconception": "aipb.citation-as-proof"},
                    {"label": "Không yếu tố nào cả; phải tìm nguồn gốc của con số mới biết.", "isCorrect": True},
                    {"label": "AI đã tra con số này trong kho dữ liệu của nó.", "isCorrect": False, "misconception": "aipb.ai-looks-up-facts"},
                ],
            },
            {
                "key": "1.1-chon-can-kiem",
                "type": "mcq",
                "prompt": (
                    "Bạn nhờ AI hỗ trợ làm bài thuyết trình. Những nội dung nào dưới đây cần được kiểm chứng trước "
                    "khi đưa vào slide? Hãy chọn tất cả phương án đúng."
                ),
                "explanation": (
                    "Số liệu cụ thể, trích dẫn kèm nguồn và thông tin về sự việc mới xảy ra là ba loại cần kiểm chứng. "
                    "Gợi ý cách sắp xếp ý hay một câu mở đầu là sản phẩm sáng tạo mà bạn tự đánh giá được, vì không "
                    "có sự thật nào cần đối chiếu."
                ),
                "points": 2,
                "options": [
                    {"label": "Gợi ý chia bài thành ba phần: vấn đề, giải pháp và kết luận.", "isCorrect": False, "misconception": "aipb.distrust-everything"},
                    {"label": "Con số “thị trường tăng 18% trong năm 2024”.", "isCorrect": True},
                    {"label": "Một câu mở đầu gây chú ý cho phần giới thiệu.", "isCorrect": False, "misconception": "aipb.distrust-everything"},
                    {"label": "Một câu nói được gán cho một nhà kinh tế học nổi tiếng.", "isCorrect": True},
                    {"label": "Quy định mới về học phí áp dụng từ học kỳ này.", "isCorrect": True},
                ],
            },
            {
                "key": "1.1-hoi-lai-ai",
                "type": "true_false",
                "prompt": (
                    "Nếu bạn hỏi lại công cụ AI “bạn có chắc không?” và nó khẳng định lại câu trả lời, bạn có thể coi "
                    "câu trả lời đó đã được kiểm chứng."
                ),
                "explanation": (
                    "Nhận định này sai. Trong vụ Mata kiện Avianca, luật sư đã hỏi lại ChatGPT và được khẳng định rằng "
                    "các bản án là có thật, dù chúng không tồn tại. Việc kiểm chứng cần một nguồn nằm ngoài cuộc trò chuyện."
                ),
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "aipb.ask-ai-to-check-itself"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.1-keo-tha-co-che",
                "type": "drag_drop_fill",
                "prompt": (
                    "Hãy kéo các cụm từ vào đúng chỗ trống. Công cụ AI trò chuyện tạo câu trả lời bằng cách chọn đơn vị "
                    "chữ [[1]] để viết tiếp. Trong quá trình đó, nó không tự [[2]], nên có thể tạo ra nội dung sai mà "
                    "vẫn rất [[3]]."
                ),
                "explanation": (
                    "Mô hình chọn đơn vị chữ nghe hợp lý nhất dựa trên các mẫu đã học và không có bước tự kiểm chứng "
                    "sự thật, vì vậy nội dung sai vẫn có thể được diễn đạt rất trôi chảy."
                ),
                "points": 2,
                "tokens": [
                    {"label": "trôi chảy", "blank": 3},
                    {"label": "chính xác nhất"},
                    {"label": "kiểm chứng sự thật", "blank": 2},
                    {"label": "ngập ngừng"},
                    {"label": "nghe hợp lý nhất", "blank": 1},
                ],
            },
            {
                "key": "1.1-ghep-loai-kiem",
                "type": "matching",
                "prompt": "Hãy ghép mỗi câu trả lời của AI với cách kiểm chứng phù hợp nhất.",
                "explanation": (
                    "Với số liệu, bạn tìm con số trong báo cáo gốc. Với câu nói được trích, bạn tìm câu nói đó trong "
                    "một nguồn đáng tin có ghi xuất xứ. Với sự việc mới, bạn xem thông báo trên trang chính thức."
                ),
                "points": 3,
                "pairs": [
                    {"left": "“Tỷ lệ thất nghiệp năm ngoái là 2,3%.”", "right": "Tìm con số đó trong báo cáo gốc của cơ quan thống kê."},
                    {"left": "“Einstein từng nói rằng…”", "right": "Tìm câu nói trong một nguồn đáng tin có ghi rõ xuất xứ."},
                    {"left": "“Lịch thi học kỳ này bắt đầu từ ngày 15.”", "right": "Xem thông báo trên trang chính thức của trường."},
                ],
            },
            {
                "key": "1.1-thu-tu-kiem",
                "type": "ordering",
                "prompt": "Hãy sắp xếp bốn bước của quy trình kiểm chứng trong một phút theo đúng thứ tự.",
                "explanation": (
                    "Bạn hỏi nguồn trước, sau đó tự mở nguồn, đối chiếu đúng nội dung được trích, và cuối cùng ghi lại "
                    "mức độ tin cậy để sử dụng thông tin cho đúng."
                ),
                "points": 2,
                "sequence": [
                    "Hỏi công cụ AI thông tin được lấy từ đâu.",
                    "Tự mở nguồn được nêu.",
                    "Tìm đúng câu hoặc con số được trích trong nguồn.",
                    "Ghi lại mức độ tin cậy: đã xác minh hay chưa xác minh.",
                ],
            },
            {
                "key": "1.1-ten-hien-tuong",
                "type": "fill_in",
                "prompt": (
                    "Nội dung nghe hợp lý và tự tin nhưng sai sự thật hoặc không có thật do mô hình AI tạo ra thường "
                    "được gọi là “______ AI”. Hãy điền một từ vào chỗ trống."
                ),
                "explanation": "Hiện tượng này thường được gọi là ảo giác AI (tiếng Anh: hallucination).",
                "points": 1,
                "answers": ["ảo giác", "ao giac", "hallucination"],
            },
        ],
    },
}

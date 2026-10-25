# -*- coding: utf-8 -*-
"""Bài 6, bài cuối khoá: dùng AI để học nhanh hơn mà không giao luôn phần suy nghĩ cho nó.

Nguồn đã kiểm (24/10/2026): Risko và Gilbert (2016) trên Trends in Cognitive Sciences; Slamecka và Graf (1978)
trên Journal of Experimental Psychology: Human Learning and Memory; Bjork và Bjork (2011) trong Psychology and the
Real World; Bastani và cộng sự (2025) trên PNAS. Ảnh thư viện Sias lấy từ Wikimedia Commons (CC0), giấy phép kiểm
qua API và đã mở xem; biểu đồ kết quả thí nghiệm vẽ bằng HTML từ số liệu công bố trong bài báo.
"""

T_OFFLOAD = "Giảm tải nhận thức sang công cụ (cognitive offloading)"
T_LEARN = "Phần mình không tự làm thì mình không học được"
T_EVIDENCE = "Bằng chứng từ một thí nghiệm với gần 1.000 học sinh"
T_DELEGATE = "Việc nên giao và việc không nên giao cho AI"
T_RULE = "Quy tắc “nghĩ trước, hỏi sau, kiểm cuối”"
T_INTEGRITY = "Liêm chính học thuật khi dùng AI (academic integrity)"
T_RECAP = "Nhìn lại cả khoá học"

LIBRARY_IMG = (
    "![Sinh viên ngồi tự học và ghi chép bằng tay trong một thư viện đại học]"
    "(https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Sias_Library_-_Students_Studying_2017.jpg/"
    "1280px-Sias_Library_-_Students_Studying_2017.jpg "
    "\"Sinh viên tự học trong thư viện Đại học Quốc tế Sias ở Hà Nam, Trung Quốc. Việc tự viết ra câu trả lời, dù "
    "chậm hơn, chính là phần tạo nên trí nhớ lâu dài. Hình: [File:Sias Library - Students Studying 2017.jpg]"
    "(https://commons.wikimedia.org/wiki/File:Sias_Library_-_Students_Studying_2017.jpg), tác giả Gary Todd, "
    "giấy phép CC0.\")"
)

BASTANI_CHART = r"""
```html
<figure class="lesson-figure" style="margin:1.2rem auto;max-width:36rem">
  <div style="background:#fff;color:#1f2937;border:1px solid rgba(127,127,127,.28);border-radius:.8rem;padding:1rem 1.1rem;font-size:.95rem;line-height:1.5">
    <div style="font-weight:700;margin-bottom:.6rem">Thay đổi điểm so với nhóm học sinh không dùng AI</div>
    <div style="font-weight:600;margin:.4rem 0 .2rem">Trong giờ luyện tập (có AI hỗ trợ)</div>
    <div style="display:grid;grid-template-columns:8.5rem 1fr;gap:.35rem .6rem;align-items:center">
      <span>ChatGPT bản thường</span><div style="height:1.3rem;width:37.8%;background:#3b82f6;border-radius:.3rem;color:#fff;font-size:.8rem;padding-left:.4rem">+48%</div>
      <span>Bản chỉ gợi ý</span><div style="height:1.3rem;width:100%;background:#0d9488;border-radius:.3rem;color:#fff;font-size:.8rem;padding-left:.4rem">+127%</div>
    </div>
    <div style="font-weight:600;margin:.8rem 0 .2rem">Trong bài thi (không có AI)</div>
    <div style="display:grid;grid-template-columns:8.5rem 1fr;gap:.35rem .6rem;align-items:center">
      <span>ChatGPT bản thường</span><div style="height:1.3rem;width:13.4%;background:#dc2626;border-radius:.3rem;color:#fff;font-size:.8rem;padding-left:.4rem">−17%</div>
      <span>Bản chỉ gợi ý</span><div style="font-size:.85rem;opacity:.85">Không khác biệt rõ so với nhóm đối chứng</div>
    </div>
  </div>
  <figcaption style="font-size:.9rem;opacity:.85;margin-top:.5rem">Biểu đồ do người soạn bài vẽ lại từ số liệu công bố trong nghiên cứu của Bastani và cộng sự (2025) trên tạp chí PNAS. Độ dài cột chỉ để so sánh trực quan trong từng nhóm câu hỏi.</figcaption>
</figure>
```
"""

LESSON = {
    "title": "Bài 6 · Học cùng AI mà vẫn tự suy nghĩ",
    "durationMin": 20,
    "description": (
        "Bài cuối khoá giải thích vì sao việc giao cho AI phần suy nghĩ có thể làm bạn hoàn thành bài nhanh hơn nhưng "
        "học được ít hơn, phân biệt việc nên và không nên giao cho AI, giới thiệu quy tắc “nghĩ trước, hỏi sau, "
        "kiểm cuối” và cách trung thực về việc đã dùng AI, rồi nhìn lại những gì cả khoá học đã trang bị."
    ),
    "look": {"palette": "vibrant", "font": "readable"},
    "objectives": [
        "Giải thích được vì sao hoàn thành một bài tập nhờ AI không đồng nghĩa với việc đã học được kỹ năng mà bài tập ấy nhắm tới",
        "Phân biệt được việc nên giao và việc không nên giao cho AI dựa trên mục tiêu học tập của mình",
        "Áp dụng được quy tắc “nghĩ trước, hỏi sau, kiểm cuối” khi dùng AI cho một bài tập cụ thể",
        "Ghi được một lời khai báo trung thực về việc đã dùng AI vào những phần nào của bài làm",
    ],
    "body": r"""
Minh là sinh viên năm hai. Tuần trước, Minh nhờ một công cụ AI viết hộ bài luận phản tư về môn kỹ năng giao tiếp, đọc lại một lượt, sửa vài chữ rồi nộp và được điểm khá. Tuần này, giảng viên cho cả lớp viết một bài phản tư tương tự ngay tại lớp, không được dùng điện thoại hay máy tính. Minh ngồi trước tờ giấy trắng gần mười phút mà chưa viết được câu nào, dù chủ đề gần như giống hệt bài tuần trước.

:::Trước khi đọc tiếp, theo bạn điều gì đã xảy ra với Minh?
Minh không lười và cũng không kém. Bài tuần trước đã được hoàn thành, nhưng phần việc tạo ra kỹ năng viết phản tư, gồm nhớ lại trải nghiệm, chọn ý, sắp xếp lập luận và tìm từ diễn đạt, lại do công cụ AI làm thay. Sản phẩm thì có, còn việc học thì gần như không xảy ra. Bài học này giải thích cơ chế đằng sau hiện tượng đó và cách dùng AI để nó giúp bạn học nhanh hơn thay vì học ít đi.
:::
""",
    "sections": [
        {
            "layout": "text",
            "title": T_OFFLOAD,
            "parts": [
                {
                    "md": (
                        "Con người vẫn luôn dùng công cụ để đỡ việc cho trí nhớ và sự tính toán của mình: viết danh "
                        "sách đi chợ, đặt lời nhắc trên điện thoại, dùng bản đồ dẫn đường thay vì nhớ lối đi. Các nhà "
                        "tâm lý học gọi hiện tượng này là **giảm tải nhận thức sang công cụ** (*cognitive offloading*), "
                        "tức là dùng một hành động hay một công cụ bên ngoài để giảm khối lượng xử lý mà bộ não phải "
                        "tự đảm nhận [1].\n\n"
                        "Giảm tải nhận thức không xấu. Nhờ nó, ta làm được nhiều việc phức tạp hơn khả năng ghi nhớ "
                        "của mình. Tuy nhiên, bài tổng quan của Risko và Gilbert chỉ ra rằng con người thường quyết "
                        "định giao việc cho công cụ khi tin rằng làm vậy hiệu quả hơn tự làm, và niềm tin ấy không "
                        "phải lúc nào cũng chính xác [1]. Công cụ AI trò chuyện đẩy hiện tượng này lên một mức mới, "
                        "vì nó không chỉ nhớ hộ hay tính hộ mà còn có thể viết hộ, lập luận hộ và giải bài hộ."
                    ),
                },
            ],
            "outro": (
                "> [!ghi-nho] Câu hỏi quan trọng không phải là “có nên giao việc cho AI không”, mà là “mục tiêu của "
                "việc này là gì”. Nếu mục tiêu là có sản phẩm, giao cho AI có thể hợp lý. Nếu mục tiêu là bạn học "
                "được một kỹ năng, thì phần việc tạo ra kỹ năng ấy phải do chính bạn làm."
            ),
        },
        {
            "layout": "cards",
            "title": T_LEARN,
            "intro": (
                "Hai phát hiện kinh điển của tâm lý học nhận thức giải thích vì sao việc tự làm, dù chậm và vất vả "
                "hơn, lại quyết định bạn nhớ và hiểu được bao nhiêu."
            ),
            "parts": [
                {
                    "title": "Hiệu ứng tự tạo (generation effect)",
                    "md": (
                        "Năm 1978, Slamecka và Graf thực hiện năm thí nghiệm so sánh hai nhóm người học. Một nhóm chỉ "
                        "đọc các cặp từ có sẵn, nhóm kia phải tự nghĩ ra từ thứ hai dựa trên một gợi ý. Trong mọi thí "
                        "nghiệm, nhóm tự tạo ra từ nhớ tốt hơn nhóm chỉ đọc [2]. Thông tin do chính bạn tạo ra được "
                        "ghi nhớ bền hơn thông tin bạn chỉ tiếp nhận."
                    ),
                },
                {
                    "title": "Khó khăn có ích (desirable difficulties)",
                    "md": (
                        "Elizabeth và Robert Bjork chỉ ra rằng một số khó khăn khi học, chẳng hạn tự kiểm tra thay vì "
                        "đọc lại, học giãn cách thay vì học dồn, lại giúp trí nhớ lâu dài tốt hơn, dù lúc học có vẻ "
                        "chậm và kém trôi chảy hơn [3]. Điều kiện là khó khăn ấy phải vừa sức với người học."
                    ),
                },
            ],
            "outro": (
                LIBRARY_IMG
                + "\n\n"
                + "> [!canh-bao] Cảm giác “học dễ và trôi” không phải là dấu hiệu bạn đang học tốt. Khi AI làm hộ phần "
                "khó nhất, bạn sẽ thấy mọi thứ trôi chảy, nhưng chính phần khó ấy mới là phần tạo nên kỹ năng."
            ),
        },
        {
            "layout": "stats",
            "title": T_EVIDENCE,
            "intro": (
                "Năm 2025, Bastani và cộng sự công bố trên tạp chí PNAS một thí nghiệm thực địa với gần 1.000 học sinh "
                "trung học học toán [4]. Một nhóm luyện tập với ChatGPT ở dạng thông thường, một nhóm luyện tập với "
                "phiên bản được thiết kế để chỉ đưa ra gợi ý thay vì đáp án, và một nhóm đối chứng không dùng AI. Sau "
                "giai đoạn luyện tập, cả ba nhóm làm bài thi mà không có AI hỗ trợ."
            ),
            "parts": [
                {
                    "title": "+48%",
                    "md": "Nhóm dùng ChatGPT bản thường đạt điểm luyện tập cao hơn nhóm đối chứng 48% trong lúc có AI hỗ trợ.",
                },
                {
                    "title": "−17%",
                    "md": "Khi bỏ AI đi, chính nhóm ấy đạt điểm thi thấp hơn nhóm đối chứng 17%.",
                },
                {
                    "title": "+127%",
                    "md": (
                        "Nhóm dùng phiên bản chỉ gợi ý đạt điểm luyện tập cao hơn nhóm đối chứng 127%, và điểm thi "
                        "của nhóm này không thấp hơn nhóm đối chứng."
                    ),
                },
            ],
            "outro": (
                BASTANI_CHART
                + "\n"
                + "Các tác giả giải thích rằng học sinh dùng bản thường đã dựa vào AI như một chiếc nạng trong lúc luyện "
                "tập, nên khi không còn AI thì kỹ năng tự làm bài của các em yếu hơn [4]. Phiên bản chỉ gợi ý gần như "
                "xoá được tác động tiêu cực đó, nhưng cũng chưa tạo ra lợi ích đo được trong bài thi. Kết quả này cho "
                "thấy cách dùng AI quan trọng không kém việc có dùng hay không."
            ),
        },
        {
            "layout": "compare",
            "title": T_DELEGATE,
            "intro": (
                "Cùng là “nhờ AI”, nhưng có những việc giúp bạn học nhanh hơn và có những việc lấy đi phần học của "
                "bạn. Ranh giới nằm ở chỗ ai là người làm phần suy nghĩ mà bài tập nhắm tới."
            ),
            "parts": [
                {
                    "title": "Nên giao cho AI",
                    "md": (
                        "- Tóm tắt một tài liệu dài để bạn chọn phần cần đọc kỹ.\n"
                        "- Giải thích lại một khái niệm theo cách khác khi bạn chưa hiểu.\n"
                        "- Đặt câu hỏi ôn tập để bạn tự kiểm tra.\n"
                        "- Nhận xét và phản biện bản nháp do chính bạn viết.\n\n"
                        "Trong các việc này, AI hỗ trợ quá trình học, còn phần suy nghĩ chính vẫn thuộc về bạn."
                    ),
                },
                {
                    "title": "Không nên giao cho AI",
                    "md": (
                        "- Viết hộ toàn bộ bài luận mà bạn được giao để tự rèn kỹ năng viết.\n"
                        "- Giải hộ bài tập rồi bạn chép lại đáp án.\n"
                        "- Lập dàn ý trước khi bạn tự nghĩ về vấn đề.\n"
                        "- Đưa ra kết luận cho một câu hỏi mà bài tập yêu cầu bạn tự lập luận.\n\n"
                        "Trong các việc này, AI làm thay đúng phần việc tạo nên kỹ năng, nên bạn có sản phẩm mà không "
                        "có việc học."
                    ),
                },
            ],
            "outro": (
                "> [!vi-du] Tóm tắt một bài báo khoa học để quyết định có đọc toàn văn hay không là cách dùng AI hợp "
                "lý. Nhờ AI viết hộ phần tổng quan tài liệu cho tiểu luận của bạn thì lại là giao đi chính phần việc "
                "mà tiểu luận ấy được giao để rèn luyện."
            ),
        },
        {
            "layout": "steps",
            "title": T_RULE,
            "intro": (
                "Quy tắc ba bước dưới đây giúp bạn giữ phần suy nghĩ cho mình mà vẫn tận dụng được AI. Thứ tự của ba "
                "bước là điều quan trọng nhất."
            ),
            "parts": [
                {
                    "title": "Nghĩ trước",
                    "md": (
                        "Trước khi mở công cụ AI, bạn tự viết ra ý của mình: câu trả lời ban đầu, dàn ý thô hoặc những "
                        "điều bạn chưa hiểu. Bản nháp có thể chưa hay, nhưng nó là phần việc tạo nên kỹ năng, đúng như "
                        "hiệu ứng tự tạo đã chỉ ra."
                    ),
                },
                {
                    "title": "Hỏi sau",
                    "md": (
                        "Khi đã có ý của mình, bạn mới hỏi AI để được giải thích thêm, được phản biện hoặc được góp ý "
                        "cho bản nháp. Bạn nên yêu cầu AI gợi ý hướng đi thay vì đưa thẳng đáp án, giống phiên bản chỉ "
                        "gợi ý trong thí nghiệm của Bastani và cộng sự."
                    ),
                },
                {
                    "title": "Kiểm cuối",
                    "md": (
                        "Bạn kiểm chứng những gì AI nói theo cách đã học trong Bài 1 và tự quyết định giữ, sửa hay bỏ "
                        "từng góp ý. Người chịu trách nhiệm về bài làm cuối cùng luôn là bạn."
                    ),
                },
            ],
            "outro": (
                "> [!meo] Một cách thực hành đơn giản là gõ vào công cụ AI câu sau: “Đây là câu trả lời mình tự viết. "
                "Đừng viết lại hộ mình, hãy chỉ ra ba chỗ lập luận còn yếu và đặt câu hỏi để mình tự sửa.” Cách hỏi "
                "này giữ phần viết cho bạn và biến AI thành người phản biện."
            ),
        },
        {
            "layout": "cards",
            "title": T_INTEGRITY,
            "intro": (
                "**Liêm chính học thuật** (*academic integrity*) là việc trung thực về nguồn gốc của mọi phần trong "
                "bài làm. Khi AI trở thành một nguồn đóng góp, sự trung thực ấy bao gồm cả việc nói rõ bạn đã dùng AI "
                "vào việc gì."
            ),
            "parts": [
                {
                    "title": "Đọc quy định trước",
                    "md": (
                        "Mỗi trường, mỗi môn và mỗi giảng viên có thể có quy định khác nhau về việc dùng AI. Bạn cần đọc "
                        "quy định của môn học trước khi dùng, và hỏi giảng viên khi quy định chưa rõ."
                    ),
                },
                {
                    "title": "Khai báo cụ thể",
                    "md": (
                        "Lời khai báo nên nêu rõ công cụ và phần việc, chẳng hạn: “Mình dùng công cụ AI để tóm tắt hai "
                        "tài liệu tham khảo và góp ý cho bản nháp; toàn bộ lập luận và câu chữ trong bài do mình tự viết.”"
                    ),
                },
                {
                    "title": "Chịu trách nhiệm cuối cùng",
                    "md": (
                        "Dù AI góp phần vào đâu, bạn vẫn là người chịu trách nhiệm về độ chính xác của bài làm. Một số "
                        "liệu bịa do AI tạo ra vẫn là lỗi của người nộp bài, như vụ Mata kiện Avianca trong Bài 1 đã cho thấy."
                    ),
                },
            ],
        },
        {
            "layout": "faq",
            "title": "Câu hỏi thường gặp",
            "parts": [
                {
                    "title": "Dùng AI để học có phải là gian lận không?",
                    "md": (
                        "Không nhất thiết. Dùng AI để giải thích khái niệm, đặt câu hỏi ôn tập hay góp ý bản nháp là cách "
                        "học hợp lệ ở nhiều nơi. Việc trở thành gian lận khi bạn nộp phần việc do AI làm như thể đó là của "
                        "mình, hoặc khi quy định của môn học không cho phép dùng AI."
                    ),
                },
                {
                    "title": "Nếu đã sửa lại bài do AI viết thì có cần khai báo không?",
                    "md": (
                        "Có. Việc sửa lại không thay đổi nguồn gốc của ý tưởng và lập luận ban đầu. Khai báo trung thực "
                        "giúp giảng viên đánh giá đúng phần việc của bạn và bảo vệ chính bạn."
                    ),
                },
                {
                    "title": "Tự làm trước thì chậm hơn, có đáng không?",
                    "md": (
                        "Đáng, nếu mục tiêu của bạn là học được kỹ năng. Thí nghiệm của Bastani và cộng sự cho thấy điểm "
                        "luyện tập cao nhờ AI không đi kèm với điểm thi cao khi không còn AI. Thời gian bạn tự làm là "
                        "thời gian kỹ năng được hình thành."
                    ),
                },
            ],
        },
        {
            "layout": "cards",
            "title": T_RECAP,
            "intro": (
                "Sáu bài học của khoá xoay quanh một ý chung: AI là công cụ mạnh, nhưng việc đánh giá, kiểm chứng và "
                "quyết định vẫn là phần của bạn. Mỗi thẻ dưới đây tóm lại điều quan trọng nhất của một bài."
            ),
            "parts": [
                {
                    "title": "Bài 1",
                    "md": "Câu trả lời trôi chảy của AI chưa chắc đúng; số liệu, trích dẫn và sự việc mới cần được kiểm chứng bằng nguồn bên ngoài.",
                },
                {
                    "title": "Bài 2",
                    "md": "Mọi lập luận đều có thể tách thành khẳng định, bằng chứng và suy luận ngầm, và suy luận ngầm thường là chỗ yếu nhất.",
                },
                {
                    "title": "Bài 3",
                    "md": "Với ảnh, video và tin lan truyền, đọc ngang để xem người khác nói gì về nguồn hiệu quả hơn soi kỹ chính nội dung.",
                },
                {
                    "title": "Bài 4",
                    "md": "Cách đặt câu hỏi quyết định câu trả lời của AI có kiểm chứng được hay không.",
                },
                {
                    "title": "Bài 5",
                    "md": "AI có thể chiều theo người hỏi, và chính chúng ta cũng có xu hướng chỉ tìm điều ủng hộ niềm tin sẵn có.",
                },
                {
                    "title": "Bài 6",
                    "md": "Hãy nghĩ trước, hỏi sau, kiểm cuối, và trung thực về việc đã dùng AI vào những phần nào.",
                },
            ],
        },
        {
            "layout": "text",
            "title": "Tài liệu tham khảo",
            "parts": [
                {
                    "md": (
                        "1. Risko, E. F., và Gilbert, S. J. (2016). Cognitive offloading. *Trends in Cognitive Sciences*, "
                        "20(9), 676–688. [DOI 10.1016/j.tics.2016.07.002](https://doi.org/10.1016/j.tics.2016.07.002)\n"
                        "2. Slamecka, N. J., và Graf, P. (1978). The generation effect: Delineation of a phenomenon. "
                        "*Journal of Experimental Psychology: Human Learning and Memory*, 4(6), 592–604.\n"
                        "3. Bjork, E. L., và Bjork, R. A. (2011). Making things hard on yourself, but in a good way: "
                        "Creating desirable difficulties to enhance learning. Trong *Psychology and the Real World*, "
                        "tr. 56–64. Worth Publishers. "
                        "[Bản PDF tại phòng thí nghiệm Bjork, UCLA](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/04/EBjork_RBjork_2011.pdf)\n"
                        "4. Bastani, H., Bastani, O., Sungu, A., và cộng sự (2025). Generative AI without guardrails can "
                        "harm learning: Evidence from high school mathematics. *Proceedings of the National Academy of "
                        "Sciences*, 122(26), e2422633122. [Xem bài báo](https://doi.org/10.1073/pnas.2422633122)"
                    ),
                },
            ],
        },
    ],
    "flashcards": {
        "title": "Thẻ ghi nhớ · Bài 6",
        "items": [
            {
                "term": "Giảm tải nhận thức sang công cụ (cognitive offloading)",
                "meaning": "Giảm tải nhận thức là việc dùng một hành động hay một công cụ bên ngoài để giảm khối lượng xử lý mà bộ não phải tự đảm nhận.",
                "example": "Viết danh sách đi chợ, đặt lời nhắc trên điện thoại hay nhờ AI tóm tắt một tài liệu dài.",
            },
            {
                "term": "Hiệu ứng tự tạo (generation effect)",
                "meaning": "Hiệu ứng tự tạo là hiện tượng thông tin do người học tự tạo ra được ghi nhớ tốt hơn thông tin chỉ được đọc.",
            },
            {
                "term": "Khó khăn có ích (desirable difficulties)",
                "meaning": "Khó khăn có ích là những khó khăn vừa sức khi học, như tự kiểm tra hay học giãn cách, làm việc học chậm hơn nhưng giúp nhớ lâu hơn.",
            },
            {
                "term": "Nghĩ trước, hỏi sau, kiểm cuối",
                "meaning": "Đây là quy tắc dùng AI để học: tự viết ý của mình trước, sau đó mới hỏi AI để được giải thích hay phản biện, và cuối cùng tự kiểm chứng điều AI nói.",
            },
            {
                "term": "Liêm chính học thuật (academic integrity)",
                "meaning": "Liêm chính học thuật là sự trung thực về nguồn gốc của mọi phần trong bài làm, bao gồm việc nói rõ đã dùng AI vào việc gì.",
            },
            {
                "term": "Sản phẩm và việc học (output vs. learning)",
                "meaning": "Hoàn thành một sản phẩm nhờ AI không đồng nghĩa với việc đã học được kỹ năng mà bài tập nhắm tới, vì phần suy nghĩ tạo nên kỹ năng có thể đã do AI làm thay.",
            },
        ],
    },
    "summary": [
        "Giao việc cho công cụ giúp ta làm được nhiều hơn, nhưng phần suy nghĩ nào giao cho AI thì đó là phần ta không tự học được.",
        "Hiệu ứng tự tạo và khó khăn có ích cho thấy việc tự làm, dù chậm và vất vả hơn, giúp trí nhớ và kỹ năng bền vững hơn.",
        "Thí nghiệm của Bastani và cộng sự cho thấy học sinh luyện tập với AI đưa thẳng đáp án đạt điểm thi thấp hơn khi không còn AI, còn AI chỉ đưa gợi ý thì không gây tác động tiêu cực đó.",
        "Quy tắc “nghĩ trước, hỏi sau, kiểm cuối” cùng việc khai báo trung thực giúp bạn dùng AI để học nhanh hơn mà vẫn giữ được phần tự suy nghĩ.",
    ],
    "quiz": {
        "title": "Kiểm tra cuối bài · Bài 6",
        "passThresholdPct": 60,
        "requireConfidence": True,
        "questions": [
            {
                "key": "6.1-vi-sao-diem-thi-thap",
                "type": "mcq",
                "prompt": (
                    "Trong thí nghiệm của Bastani và cộng sự, học sinh luyện tập với ChatGPT bản thường đạt điểm luyện "
                    "tập cao hơn nhóm đối chứng, nhưng khi thi không có AI thì đạt điểm thấp hơn. Cách giải thích nào phù "
                    "hợp nhất với kết quả này?"
                ),
                "explanation": (
                    "Các tác giả cho rằng học sinh đã dựa vào AI như một chiếc nạng: AI làm thay phần suy nghĩ trong lúc "
                    "luyện tập, nên kỹ năng tự giải bài của các em không được hình thành. Điểm luyện tập cao phản ánh "
                    "sản phẩm có AI hỗ trợ, không phản ánh việc học."
                ),
                "points": 2,
                "options": [
                    {"label": "Điểm luyện tập cao đã chứng tỏ học sinh học tốt, còn điểm thi thấp chỉ là ngẫu nhiên.", "isCorrect": False, "misconception": "aipb.b6.output-equals-learning"},
                    {"label": "AI đã trả lời sai rất nhiều câu nên học sinh học phải kiến thức sai.", "isCorrect": False, "misconception": "aipb.ai-looks-up-facts"},
                    {"label": "Đề thi khó hơn bài luyện tập nên mọi nhóm đều có điểm thấp.", "isCorrect": False},
                    {"label": "AI đã làm thay phần suy nghĩ khi luyện tập, nên học sinh không tự xây dựng được kỹ năng giải bài.", "isCorrect": True},
                ],
            },
            {
                "key": "6.2-viec-nen-giao",
                "type": "mcq",
                "prompt": (
                    "Bạn đang học môn viết học thuật và được giao tự viết một bài luận để rèn kỹ năng lập luận. Những "
                    "cách dùng AI nào dưới đây vẫn giữ phần suy nghĩ cho bạn? Hãy chọn tất cả phương án đúng."
                ),
                "explanation": (
                    "Nhờ AI phản biện bản nháp do bạn viết, đặt câu hỏi gợi mở hay tóm tắt tài liệu để bạn chọn bài đọc "
                    "đều hỗ trợ quá trình học. Nhờ AI viết toàn bài hoặc lập dàn ý trước khi bạn tự nghĩ là giao đi chính "
                    "phần việc mà bài luận được giao để rèn luyện."
                ),
                "points": 2,
                "options": [
                    {"label": "Nhờ AI viết toàn bộ bài luận rồi bạn sửa lại vài câu cho giống giọng mình.", "isCorrect": False, "misconception": "aipb.b6.offload-everything"},
                    {"label": "Nhờ AI chỉ ra những chỗ lập luận còn yếu trong bản nháp do bạn tự viết.", "isCorrect": True},
                    {"label": "Nhờ AI tóm tắt các tài liệu tham khảo để bạn chọn bài cần đọc kỹ.", "isCorrect": True},
                    {"label": "Nhờ AI lập dàn ý chi tiết trước khi bạn bắt đầu nghĩ về đề bài.", "isCorrect": False, "misconception": "aipb.b6.ask-first"},
                    {"label": "Nhờ AI đặt câu hỏi gợi mở để bạn tự phát triển ý.", "isCorrect": True},
                ],
            },
            {
                "key": "6.3-hoc-de-nho-lau",
                "type": "true_false",
                "prompt": (
                    "Một buổi luyện tập có độ khó vừa sức, buộc bạn phải cố nhớ lại thay vì đọc lại, có thể kém trôi "
                    "chảy hơn nhưng giúp bạn nhớ lâu hơn."
                ),
                "explanation": (
                    "Nhận định này đúng. Nghiên cứu về khó khăn có ích cho thấy những khó khăn vừa sức, như tự kiểm tra "
                    "hay học giãn cách, làm buổi học kém trôi chảy hơn nhưng giúp trí nhớ lâu dài tốt hơn."
                ),
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False, "misconception": "aipb.b6.easy-is-better"},
                ],
            },
            {
                "key": "6.4-keo-tha-quy-tac",
                "type": "drag_drop_fill",
                "prompt": (
                    "Hãy kéo các từ vào đúng chỗ trống. Quy tắc dùng AI để học gồm ba bước theo thứ tự: [[1]] trước, "
                    "[[2]] sau, [[3]] cuối."
                ),
                "explanation": (
                    "Bạn tự nghĩ trước để giữ phần việc tạo nên kỹ năng, hỏi AI sau để được giải thích hay phản biện, và "
                    "kiểm chứng cuối cùng vì bạn là người chịu trách nhiệm về bài làm."
                ),
                "points": 2,
                "tokens": [
                    {"label": "kiểm", "blank": 3},
                    {"label": "chép"},
                    {"label": "nghĩ", "blank": 1},
                    {"label": "nộp"},
                    {"label": "hỏi", "blank": 2},
                ],
            },
            {
                "key": "6.5-ghep-khai-niem",
                "type": "matching",
                "prompt": "Hãy ghép mỗi khái niệm với mô tả đúng của nó.",
                "explanation": (
                    "Giảm tải nhận thức là dùng công cụ để đỡ việc cho bộ não; hiệu ứng tự tạo là việc tự tạo ra thông "
                    "tin giúp nhớ tốt hơn; khó khăn có ích là khó khăn vừa sức giúp nhớ lâu; liêm chính học thuật là sự "
                    "trung thực về nguồn gốc của bài làm."
                ),
                "points": 3,
                "pairs": [
                    {"left": "Giảm tải nhận thức (cognitive offloading)", "right": "Dùng công cụ bên ngoài để giảm khối lượng xử lý mà bộ não phải tự làm."},
                    {"left": "Hiệu ứng tự tạo (generation effect)", "right": "Thông tin do người học tự tạo ra được nhớ tốt hơn thông tin chỉ được đọc."},
                    {"left": "Khó khăn có ích (desirable difficulties)", "right": "Những khó khăn vừa sức làm việc học chậm hơn nhưng giúp nhớ lâu hơn."},
                    {"left": "Liêm chính học thuật (academic integrity)", "right": "Sự trung thực về nguồn gốc của mọi phần trong bài làm, kể cả phần có AI hỗ trợ."},
                ],
            },
            {
                "key": "6.6-thu-tu-lam-bai",
                "type": "ordering",
                "prompt": "Hãy sắp xếp các bước dùng AI cho một bài tập viết theo đúng thứ tự của quy tắc đã học.",
                "explanation": (
                    "Bạn tự viết bản nháp trước, sau đó nhờ AI phản biện, tiếp theo kiểm chứng và quyết định giữ hay bỏ "
                    "từng góp ý, cuối cùng khai báo rõ đã dùng AI vào việc gì."
                ),
                "points": 2,
                "sequence": [
                    "Tự viết bản nháp với ý và lập luận của mình.",
                    "Nhờ AI chỉ ra chỗ lập luận còn yếu và đặt câu hỏi gợi mở.",
                    "Kiểm chứng những gì AI nói và tự quyết định giữ, sửa hay bỏ từng góp ý.",
                    "Khai báo rõ đã dùng AI vào những phần nào của bài làm.",
                ],
            },
            {
                "key": "6.7-ten-hieu-ung",
                "type": "fill_in",
                "prompt": (
                    "Hiện tượng thông tin do người học tự tạo ra được ghi nhớ tốt hơn thông tin chỉ được đọc có tên là "
                    "hiệu ứng “______”. Hãy điền hai từ tiếng Việt vào chỗ trống."
                ),
                "explanation": "Hiện tượng này được gọi là hiệu ứng tự tạo (generation effect), do Slamecka và Graf mô tả năm 1978.",
                "points": 1,
                "answers": ["tự tạo", "tu tao", "generation effect", "generation"],
            },
        ],
    },
    "lecture": [
        {
            "anchor": "mo-dau",
            "text": (
                "Chào bạn, mình rất vui được gặp lại bạn ở bài cuối cùng của khoá học. Bài hôm nay quay về một câu hỏi gần gũi hơn cả: làm sao dùng AI để học mà không đánh mất phần học của "
                "mình. Bạn hãy nhìn vào câu chuyện của Minh ở đầu trang. Minh nhờ AI viết hộ bài phản tư, nộp và được "
                "điểm khá. Tuần sau, viết lại một bài gần giống như vậy ngay tại lớp, Minh ngồi gần mười phút mà chưa "
                "viết được câu nào. Trước khi mình giải thích, bạn hãy dừng lại một chút và tự hỏi: điều gì đã xảy ra "
                "với Minh? Bạn có thể bấm vào hộp gợi ý ngay dưới câu chuyện sau khi đã tự nghĩ. Câu trả lời ngắn gọn là "
                "bài tập thì đã xong, nhưng phần việc tạo nên kỹ năng viết lại do AI làm thay. Cả bài hôm nay sẽ giúp "
                "bạn hiểu vì sao điều đó xảy ra, và cách tránh nó."
            ),
        },
        {
            "anchor": T_OFFLOAD,
            "text": (
                "Mình bắt đầu với một khái niệm có tên khá dài: giảm tải nhận thức sang công cụ, tiếng Anh là cognitive "
                "offloading. Nghe thì lạ, nhưng bạn làm việc này hằng ngày. Khi bạn viết danh sách đi chợ, đặt lời nhắc "
                "trên điện thoại hay mở bản đồ để tìm đường, bạn đang nhờ một công cụ bên ngoài làm hộ một phần việc mà "
                "bộ não lẽ ra phải tự làm. Điều đó hoàn toàn bình thường và rất có ích. Nhờ nó, mình làm được những việc "
                "phức tạp hơn khả năng ghi nhớ của mình. Tuy vậy, hai nhà tâm lý học Risko và Gilbert, trong một bài tổng "
                "quan năm 2016, chỉ ra một điểm đáng chú ý: con người thường giao việc cho công cụ khi tin rằng làm vậy "
                "hiệu quả hơn, nhưng niềm tin ấy không phải lúc nào cũng đúng. Công cụ AI trò chuyện khiến chuyện này "
                "quan trọng hơn bao giờ hết, vì nó không chỉ nhớ hộ mà còn viết hộ, lập luận hộ và giải bài hộ. Vì vậy, "
                "câu hỏi bạn nên tự đặt ra không phải là có nên giao việc cho AI hay không, mà là mục tiêu của việc này "
                "là gì. Nếu bạn chỉ cần một sản phẩm, giao cho AI có thể hợp lý. Nếu bạn cần học được một kỹ năng, thì "
                "phần việc tạo ra kỹ năng ấy phải do chính bạn làm."
            ),
        },
        {
            "anchor": T_LEARN,
            "text": (
                "Vì sao phần mình không tự làm thì mình không học được? Có hai phát hiện kinh điển giúp trả lời câu hỏi "
                "này, và chúng nằm ở hai thẻ trên màn hình. Thẻ thứ nhất là hiệu ứng tự tạo, tiếng Anh là generation "
                "effect. Năm 1978, Slamecka và Graf làm năm thí nghiệm. Một nhóm người học chỉ đọc những cặp từ có sẵn, "
                "nhóm còn lại phải tự nghĩ ra từ thứ hai từ một gợi ý. Ở cả năm thí nghiệm, nhóm tự nghĩ ra nhớ tốt hơn. "
                "Nói cách khác, thứ bạn tự tạo ra thì bạn nhớ bền hơn thứ bạn chỉ đọc qua. Thẻ thứ hai là khó khăn có ích, "
                "tiếng Anh là desirable difficulties, một ý tưởng của Elizabeth và Robert Bjork. Hai ông bà chỉ ra rằng "
                "những khó khăn vừa sức, như tự kiểm tra thay vì đọc lại, hay học giãn cách thay vì học dồn, làm buổi học "
                "có vẻ chậm và vấp váp hơn, nhưng lại giúp bạn nhớ lâu hơn. Bức ảnh bên dưới là một thư viện đại học, nơi "
                "các bạn sinh viên đang tự ghi chép bằng tay. Việc tự viết ra, dù chậm, chính là phần tạo nên trí nhớ. Và "
                "đây là điều mình mong bạn nhớ: cảm giác học dễ và trôi chảy không phải là dấu hiệu bạn đang học tốt. Khi "
                "AI làm hộ phần khó nhất, mọi thứ trở nên trôi chảy, nhưng chính phần khó ấy mới là phần làm nên kỹ năng."
            ),
        },
        {
            "anchor": T_EVIDENCE,
            "text": (
                "Bây giờ mình xem một bằng chứng rất gần đây. Năm 2025, nhóm nghiên cứu của Bastani công bố trên tạp chí "
                "PNAS một thí nghiệm với gần một nghìn học sinh trung học học toán. Học sinh được chia làm ba nhóm. Nhóm "
                "thứ nhất luyện tập với ChatGPT ở dạng thông thường, nhóm thứ hai dùng một phiên bản chỉ đưa gợi ý chứ "
                "không đưa đáp án, và nhóm thứ ba không dùng AI. Bạn hãy nhìn ba con số lớn trên màn hình. Trong lúc luyện "
                "tập, nhóm dùng bản thường đạt điểm cao hơn nhóm không dùng AI tới bốn mươi tám phần trăm. Nhưng khi bỏ AI "
                "đi và làm bài thi, chính nhóm ấy lại thấp hơn mười bảy phần trăm. Còn nhóm dùng bản chỉ gợi ý thì điểm "
                "luyện tập tăng tới một trăm hai mươi bảy phần trăm, và điểm thi không bị kéo xuống. Biểu đồ cột bên dưới "
                "vẽ lại đúng các con số này để bạn dễ so sánh. Các tác giả giải thích rằng học sinh dùng bản thường đã dựa "
                "vào AI như một chiếc nạng, nên khi bỏ nạng ra thì các em đi yếu hơn. Cũng cần nói cho công bằng, bản chỉ "
                "gợi ý xoá được tác động xấu nhưng chưa làm điểm thi cao hơn hẳn. Điều rút ra là cách dùng AI quan trọng "
                "không kém việc có dùng hay không."
            ),
        },
        {
            "anchor": T_DELEGATE,
            "text": (
                "Vậy việc nào nên giao cho AI, việc nào không? Bạn nhìn hai cột trên màn hình nhé. Cột bên trái là những "
                "việc nên giao: tóm tắt một tài liệu dài để bạn chọn phần cần đọc kỹ, giải thích lại một khái niệm theo "
                "cách khác, đặt câu hỏi ôn tập, hay nhận xét bản nháp do chính bạn viết. Ở những việc này, AI hỗ trợ quá "
                "trình học, còn phần suy nghĩ chính vẫn là của bạn. Cột bên phải là những việc không nên giao: viết hộ "
                "toàn bộ bài luận mà bạn được giao để tự rèn kỹ năng viết, giải hộ bài tập để bạn chép đáp án, lập dàn ý "
                "trước khi bạn tự nghĩ, hay đưa ra kết luận cho câu hỏi mà bài tập yêu cầu bạn tự lập luận. Ở những việc "
                "này, AI làm thay đúng phần tạo nên kỹ năng, nên bạn có sản phẩm mà không có việc học. Ranh giới giữa hai "
                "cột rất đơn giản: ai là người làm phần suy nghĩ mà bài tập nhắm tới."
            ),
        },
        {
            "anchor": T_RULE,
            "text": (
                "Để dễ nhớ, mình gói lại thành một quy tắc ba bước: nghĩ trước, hỏi sau, kiểm cuối. Thứ tự là điều quan "
                "trọng nhất. Bước một, nghĩ trước. Trước khi mở công cụ AI, bạn tự viết ra ý của mình, dù chỉ là câu trả "
                "lời ban đầu, một dàn ý thô hay danh sách những điều bạn chưa hiểu. Bản nháp ấy chính là phần việc tạo nên "
                "kỹ năng. Bước hai, hỏi sau. Khi đã có ý "
                "của mình, bạn mới hỏi AI để được giải thích thêm, được phản biện hay được góp ý. Bạn nên xin gợi ý hướng "
                "đi thay vì đáp án, giống phiên bản chỉ gợi ý trong thí nghiệm vừa rồi. Bước ba, kiểm cuối. Bạn kiểm chứng "
                "những gì AI nói theo cách đã học ở Bài 1, rồi tự quyết định giữ, sửa hay bỏ từng góp ý. Nếu muốn thực "
                "hành ngay, bạn có thể gõ vào công cụ AI một câu như sau: đây là câu trả lời mình tự viết, đừng viết lại hộ "
                "mình, hãy chỉ ra ba chỗ lập luận còn yếu và đặt câu hỏi để mình tự sửa. Cách hỏi này biến AI thành người "
                "phản biện thay vì người viết hộ."
            ),
        },
        {
            "anchor": T_INTEGRITY,
            "text": (
                "Phần tiếp theo nói về liêm chính học thuật, tiếng Anh là academic integrity. Hiểu đơn giản, đó là sự trung "
                "thực về nguồn gốc của mọi phần trong bài làm. Khi AI góp một phần vào bài của bạn, sự trung thực ấy bao "
                "gồm cả việc nói rõ bạn đã dùng AI vào việc gì. Ba thẻ trên màn hình là ba việc cụ thể. Thứ nhất, đọc quy "
                "định trước, vì mỗi trường, mỗi môn và mỗi giảng viên có thể quy định khác nhau, và khi chưa rõ thì bạn nên "
                "hỏi. Thứ hai, khai báo cụ thể. Một lời khai báo tốt nêu rõ công cụ và phần việc, chẳng hạn: mình dùng công "
                "cụ AI để tóm tắt hai tài liệu tham khảo và góp ý cho bản nháp, còn toàn bộ lập luận và câu chữ do mình tự "
                "viết. Thứ ba, chịu trách nhiệm cuối cùng. Dù AI góp phần vào đâu, bạn vẫn là người chịu trách nhiệm về độ "
                "chính xác của bài, như vụ Mata kiện Avianca ở Bài 1 đã cho thấy."
            ),
        },
        {
            "anchor": "Câu hỏi thường gặp",
            "text": (
                "Mình trả lời nhanh ba câu hỏi hay gặp. Dùng AI để học không nhất thiết là gian lận; nó chỉ thành gian lận "
                "khi bạn nộp phần việc do AI làm như thể của mình, hoặc khi môn học không cho phép. Đã sửa lại bài do AI "
                "viết thì vẫn cần khai báo, vì sửa câu chữ không đổi nguồn gốc của ý tưởng. Và tự làm trước tuy chậm hơn "
                "nhưng rất đáng, vì thời gian bạn tự làm chính là thời gian kỹ năng được hình thành."
            ),
        },
        {
            "anchor": T_RECAP,
            "text": (
                "Giờ mình cùng nhìn lại cả khoá qua sáu thẻ trên màn hình, mỗi thẻ là điều quan trọng nhất của một bài: "
                "kiểm chứng câu trả lời trôi chảy, tách lập luận thành ba phần, đọc ngang khi gặp tin lan truyền, đặt câu "
                "hỏi để nhận câu trả lời kiểm chứng được, để ý thiên kiến của AI và của chính mình, và nghĩ trước, hỏi sau, "
                "kiểm cuối. Nếu gói cả khoá vào một câu, mình sẽ nói rằng AI là công cụ rất mạnh, nhưng việc đánh giá, kiểm "
                "chứng và quyết định vẫn là phần của bạn."
            ),
        },
        {
            "anchor": "tong-ket",
            "text": (
                "Tóm lại, có bốn ý mình mong bạn mang theo. Một, giao việc cho công cụ giúp bạn làm được nhiều hơn, nhưng "
                "phần suy nghĩ nào giao cho AI thì đó là phần bạn không tự học được. Hai, việc tự làm, dù chậm và vất vả hơn, "
                "giúp trí nhớ và kỹ năng bền vững hơn. Ba, bằng chứng thực nghiệm cho thấy AI đưa thẳng đáp án có thể kéo "
                "điểm thi xuống, còn AI chỉ đưa gợi ý thì không. Bốn, hãy nghĩ trước, hỏi sau, kiểm cuối, và luôn trung thực "
                "về việc đã dùng AI. Chúc mừng bạn đã đi tới bài cuối cùng. Bây giờ, bạn hãy làm bài kiểm tra cuối bài để "
                "tự đánh giá nhé. Cảm ơn bạn đã học cùng mình trong suốt khoá học này."
            ),
        },
    ],
    "podcast": {
        "title": "Tập 6 · Học cùng AI mà vẫn tự suy nghĩ",
        "durationMin": 6,
        "hosts": {"A": "Khoa", "B": "Linh"},
        "turns": [
            {"speaker": "A", "text": "Xin chào các bạn, mình là Khoa, và đây là tập podcast cuối cùng của khoá Tư duy phản biện thời AI."},
            {"speaker": "B", "text": "Mình là Linh. Tập cuối rồi à Khoa? Hôm nay mình nói về chuyện gì?"},
            {"speaker": "A", "text": "Hôm nay mình nói về một câu hỏi rất đời thường: làm sao dùng AI để học mà không học ít đi."},
            {"speaker": "B", "text": "Nghe hơi lạ. Có AI thì học nhanh hơn chứ, sao lại học ít đi được?"},
            {"speaker": "A", "text": "Mình kể Linh nghe chuyện của Minh trong bài nhé. Minh nhờ AI viết hộ bài phản tư, nộp và được điểm khá. Tuần sau phải viết lại một bài gần giống như vậy ngay tại lớp, không có máy, thì Minh ngồi mười phút mà chưa viết nổi một câu."},
            {"speaker": "B", "text": "Trời, mình thấy quen quen. Có lần mình nhờ AI giải hộ bài tập toán, hiểu lúc đọc lời giải, nhưng gặp bài tương tự là lại bí."},
            {"speaker": "A", "text": "Đúng rồi. Cảm giác hiểu khi đọc lời giải rất khác với khả năng tự giải. Các nhà tâm lý học có một khái niệm cho chuyện này, gọi là giảm tải nhận thức sang công cụ, hay cognitive offloading."},
            {"speaker": "B", "text": "Nghe khó hiểu quá. Khoa giải thích bằng ví dụ được không?"},
            {"speaker": "A", "text": "Dễ thôi. Khi Linh viết danh sách đi chợ hay mở bản đồ để tìm đường, Linh đang nhờ công cụ làm hộ một phần việc của bộ não. Chuyện đó rất bình thường. Nhưng Risko và Gilbert chỉ ra rằng mình hay giao việc cho công cụ vì nghĩ thế là hiệu quả hơn, mà nhiều khi niềm tin ấy không đúng."},
            {"speaker": "B", "text": "Vậy với việc học thì sao?"},
            {"speaker": "A", "text": "Với việc học, có một hiện tượng gọi là hiệu ứng tự tạo. Từ năm 1978, Slamecka và Graf đã thấy rằng người học tự nghĩ ra câu trả lời thì nhớ tốt hơn người chỉ đọc câu trả lời có sẵn."},
            {"speaker": "B", "text": "À, nên khi AI viết hộ thì mình chỉ là người đọc, còn phần tự nghĩ ra đã bị bỏ qua."},
            {"speaker": "A", "text": "Chính xác. Thêm nữa, hai nhà nghiên cứu Bjork gọi một số khó khăn khi học là khó khăn có ích. Tự kiểm tra hay học giãn cách làm mình thấy vấp váp hơn, nhưng lại nhớ lâu hơn."},
            {"speaker": "B", "text": "Nghĩa là thấy học trôi chảy chưa chắc đã là học tốt."},
            {"speaker": "A", "text": "Đúng vậy. Và năm 2025 có một thí nghiệm rất thuyết phục, của nhóm Bastani đăng trên tạp chí PNAS, với gần một nghìn học sinh trung học học toán."},
            {"speaker": "B", "text": "Họ làm thế nào?"},
            {"speaker": "A", "text": "Một nhóm luyện tập với ChatGPT bình thường, một nhóm dùng bản chỉ đưa gợi ý, và một nhóm không dùng AI. Lúc luyện tập, nhóm dùng ChatGPT bình thường làm tốt hơn nhóm không dùng AI tới bốn mươi tám phần trăm."},
            {"speaker": "B", "text": "Vậy là quá tốt còn gì."},
            {"speaker": "A", "text": "Khoan đã. Khi thi mà không có AI, chính nhóm ấy lại thấp hơn nhóm không dùng AI mười bảy phần trăm. Còn nhóm dùng bản chỉ gợi ý thì không bị tụt điểm thi."},
            {"speaker": "B", "text": "Vậy vấn đề không phải là có dùng AI hay không, mà là dùng như thế nào."},
            {"speaker": "A", "text": "Linh tóm rất đúng. Trong bài có một bảng hai cột. Nên giao cho AI những việc như tóm tắt tài liệu để chọn bài đọc, giải thích lại khái niệm, đặt câu hỏi ôn tập, hay góp ý bản nháp mình tự viết."},
            {"speaker": "B", "text": "Còn không nên giao thì sao?"},
            {"speaker": "A", "text": "Không nên giao việc viết hộ cả bài luận mà mình được giao để luyện viết, giải hộ bài để chép đáp án, hay lập dàn ý trước khi mình tự nghĩ."},
            {"speaker": "B", "text": "Có cách nào dễ nhớ không Khoa?"},
            {"speaker": "A", "text": "Có. Nghĩ trước, hỏi sau, kiểm cuối. Linh tự viết ý của mình trước, sau đó mới hỏi AI để được phản biện, và cuối cùng tự kiểm chứng những gì AI nói."},
            {"speaker": "B", "text": "Mình thử nhé. Mình sẽ gõ: đây là bản nháp mình tự viết, đừng viết lại hộ mình, hãy chỉ ra ba chỗ lập luận còn yếu. Như vậy được không?"},
            {"speaker": "A", "text": "Rất tốt. Cách hỏi đó biến AI thành người phản biện thay vì người viết hộ."},
            {"speaker": "B", "text": "Còn chuyện khai báo đã dùng AI thì sao? Mình sửa lại rồi thì có cần nói không?"},
            {"speaker": "A", "text": "Vẫn cần. Đó là liêm chính học thuật, tức là trung thực về nguồn gốc của bài làm. Linh chỉ cần nói rõ đã dùng AI vào việc gì, chẳng hạn để tóm tắt tài liệu và góp ý bản nháp, còn lập luận là do mình viết."},
            {"speaker": "B", "text": "Và đọc quy định của môn học trước, đúng không?"},
            {"speaker": "A", "text": "Đúng. Mỗi môn có thể quy định khác nhau, chưa rõ thì hỏi giảng viên."},
            {"speaker": "B", "text": "Tập cuối rồi, Khoa tóm lại cả khoá giúp mình được không?"},
            {"speaker": "A", "text": "Cả khoá gói trong một câu: AI là công cụ rất mạnh, nhưng việc đánh giá, kiểm chứng và quyết định vẫn là phần của bạn. Kiểm chứng câu trả lời, tách lập luận, đọc ngang khi gặp tin lan truyền, hỏi AI cho rõ ràng, để ý thiên kiến, và hôm nay là nghĩ trước, hỏi sau, kiểm cuối."},
            {"speaker": "B", "text": "Mình nghĩ điều mình sẽ làm ngay từ tối nay là viết bản nháp trước khi mở AI. Lúc đầu chắc sẽ chậm hơn một chút."},
            {"speaker": "A", "text": "Chậm hơn một chút nhưng đó là phần thời gian đáng giá nhất. Bạn nào đang nghe cũng thử như Linh trong một bài tập tuần này nhé, rồi so xem mình nhớ được bao nhiêu."},
            {"speaker": "B", "text": "Chúc mừng các bạn đã hoàn thành khoá học. Bây giờ, các bạn hãy làm bài kiểm tra cuối bài để tự đánh giá nhé."},
            {"speaker": "A", "text": "Cảm ơn các bạn đã đồng hành cùng Khoa và Linh. Hẹn gặp lại các bạn."},
        ],
    },
}

MISCONCEPTIONS = [
    {
        "code": "aipb.b6.output-equals-learning",
        "name": "Coi việc hoàn thành bài tập là đã học được kỹ năng",
        "description": (
            "Đánh giá việc học bằng sản phẩm nộp được hoặc điểm trong lúc có AI hỗ trợ. Khi AI làm thay phần suy nghĩ, "
            "sản phẩm vẫn có nhưng kỹ năng mà bài tập nhắm tới không được hình thành, và điều đó chỉ lộ ra khi phải tự "
            "làm mà không có AI."
        ),
    },
    {
        "code": "aipb.b6.offload-everything",
        "name": "Giao cho AI mọi phần việc vì nhanh hơn",
        "description": (
            "Chọn giao việc cho AI chỉ dựa trên tốc độ hoàn thành, không xét mục tiêu học tập. Với những bài tập được "
            "giao để rèn một kỹ năng, phần việc nhanh nhất để giao đi thường chính là phần tạo nên kỹ năng ấy."
        ),
    },
    {
        "code": "aipb.b6.ask-first",
        "name": "Hỏi AI trước rồi mới nghĩ",
        "description": (
            "Mở công cụ AI ngay khi nhận bài và để AI lập dàn ý hay đưa hướng giải trước khi tự nghĩ. Cách làm này bỏ "
            "qua bước tự tạo ra ý, vốn là bước giúp người học ghi nhớ và hiểu sâu."
        ),
    },
    {
        "code": "aipb.b6.easy-is-better",
        "name": "Cho rằng học càng trôi chảy thì càng hiệu quả",
        "description": (
            "Dùng cảm giác dễ dàng, trôi chảy trong lúc học làm thước đo việc học tốt. Nghiên cứu về khó khăn có ích cho "
            "thấy những khó khăn vừa sức làm buổi học chậm hơn nhưng giúp trí nhớ lâu dài tốt hơn."
        ),
    },
    {
        "code": "aipb.b6.hide-ai-use",
        "name": "Nghĩ rằng không cần khai báo nếu đã sửa lại bài do AI viết",
        "description": (
            "Tin rằng việc sửa câu chữ biến bài do AI viết thành bài của mình. Việc sửa lại không thay đổi nguồn gốc của "
            "ý tưởng và lập luận, nên liêm chính học thuật vẫn đòi hỏi nói rõ đã dùng AI vào việc gì."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "aipb.b6.output-equals-learning",
        "body": (
            "Bạn đang đánh giá việc học bằng sản phẩm hoặc điểm có được khi AI hỗ trợ. Hãy thử tự làm lại một bài tương "
            "tự mà không có AI: phần bạn làm được mới là phần bạn đã học, còn phần bạn bí chính là phần AI đã làm thay."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b6.offload-everything",
        "body": (
            "Hãy hỏi mục tiêu của bài tập trước khi hỏi cách làm nhanh nhất. Nếu bài được giao để bạn rèn một kỹ năng, "
            "phần việc tạo nên kỹ năng ấy cần do bạn làm; AI nên được dùng để giải thích, gợi ý hoặc phản biện bản nháp "
            "của bạn."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b6.ask-first",
        "body": (
            "Thứ tự là điều quan trọng nhất trong quy tắc “nghĩ trước, hỏi sau, kiểm cuối”. Hãy tự viết ý hoặc dàn ý thô "
            "của mình trước, dù chưa hay, rồi mới hỏi AI. Bản nháp tự viết ấy chính là phần việc giúp bạn nhớ và hiểu."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b6.easy-is-better",
        "body": (
            "Cảm giác học dễ và trôi chảy không cho biết bạn sẽ nhớ được bao lâu. Những khó khăn vừa sức như tự kiểm tra "
            "hay học giãn cách làm buổi học vất vả hơn, nhưng chính chúng giúp trí nhớ bền vững."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b6.hide-ai-use",
        "body": (
            "Sửa câu chữ không thay đổi nguồn gốc của ý tưởng và lập luận. Hãy ghi một câu khai báo ngắn, nêu rõ công cụ "
            "và phần việc đã dùng AI, đồng thời đọc quy định về AI của môn học trước khi nộp bài."
        ),
        "priority": 10,
    },
]

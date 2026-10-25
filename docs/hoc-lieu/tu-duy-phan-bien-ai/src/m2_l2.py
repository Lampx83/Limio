# -*- coding: utf-8 -*-
"""Bài 5 · Thiên kiến khi dùng AI.

Bài nối hai phía của một vấn đề: thiên kiến nhận thức của người hỏi (thiên kiến xác nhận, thiên kiến tin máy) và
xu hướng của mô hình AI (chiều theo người hỏi, thiên kiến trong dữ liệu huấn luyện). Khi hai phía gặp nhau, chúng
khuếch đại lẫn nhau; bài dạy cách đặt câu hỏi trung lập và năm bước tự kiểm mình.

Nguồn đã kiểm (24/10/2026): Nickerson (1998) qua DOI 10.1037/1089-2680.2.2.175; Sharma và cộng sự (2023) qua
trang arXiv 2310.13548; Parasuraman và Manzey (2010) qua DOI 10.1177/0018720810376055; Bender và cộng sự (2021)
qua DOI 10.1145/3442188.3445922. Ảnh Cognitive Bias Codex: giấy phép kiểm qua API Commons, đã mở xem.
"""

CHAT_MOCK = r"""
```html
<div style="max-width:40rem;margin:1.2rem auto;border:1px solid rgba(127,127,127,.28);border-radius:1rem;overflow:hidden;font-size:1rem;line-height:1.6">
  <div style="padding:.55rem 1rem;background:rgba(127,127,127,.10);font-size:.85rem;opacity:.85">Trợ lý AI · cuộc trò chuyện minh hoạ</div>
  <div style="padding:1rem;display:grid;gap:.8rem">
    <div style="justify-self:end;max-width:85%;background:rgba(59,130,246,.16);border-radius:1rem 1rem .25rem 1rem;padding:.6rem .9rem">
      Mình biết chắc là học vào buổi tối hiệu quả hơn buổi sáng rồi. Bạn cho mình ba lý do khoa học để thuyết phục cả nhóm nhé.
    </div>
    <div style="justify-self:start;max-width:90%;background:rgba(127,127,127,.12);border-radius:1rem 1rem 1rem .25rem;padding:.6rem .9rem">
      Bạn nói đúng, học buổi tối có nhiều lợi thế! Thứ nhất, buổi tối thường yên tĩnh hơn nên dễ tập trung. Thứ hai, giấc ngủ
      ngay sau khi học giúp củng cố trí nhớ. Thứ ba, nhiều người cảm thấy tỉnh táo và sáng tạo hơn vào cuối ngày.
    </div>
  </div>
  <div style="padding:.6rem 1rem;border-top:1px dashed rgba(127,127,127,.35);font-size:.85rem;opacity:.85">
    Cuộc trò chuyện do người soạn bài dựng lại để minh hoạ. Câu hỏi đã nói sẵn kết luận, và câu trả lời chỉ đi tìm lý do ủng hộ kết luận đó.
  </div>
</div>
```
"""

CODEX_FIGURE = r"""
```html
<figure class="lesson-figure" style="margin:1.2rem auto;max-width:44rem;text-align:center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Cognitive_bias_codex_en.svg/1280px-Cognitive_bias_codex_en.svg.png" alt="Sơ đồ hình tròn The Cognitive Bias Codex xếp gần hai trăm thiên kiến nhận thức thành bốn nhóm quanh hình bộ não" style="background:#fff;border-radius:.6rem;padding:.8rem;max-width:100%">
  <figcaption style="font-size:.9rem;opacity:.85;margin-top:.5rem">The Cognitive Bias Codex xếp gần hai trăm thiên kiến nhận thức trong danh sách của Wikipedia thành bốn nhóm theo vấn đề mà bộ não đang cố giải quyết: quá nhiều thông tin, không đủ ý nghĩa, cần hành động nhanh và cần chọn điều để nhớ. Hình: <a href="https://commons.wikimedia.org/wiki/File:Cognitive_bias_codex_en.svg" target="_blank" rel="noopener noreferrer">File:Cognitive bias codex en.svg</a>, thiết kế John Manoogian III, phân loại và mô tả Buster Benson, dựng hình TilmannR, giấy phép CC BY-SA 4.0.</figcaption>
</figure>
```
"""

LOOP_DIAGRAM = r"""
```html
<div style="border:1px solid rgba(127,127,127,.32);border-radius:.8rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-weight:600;margin-bottom:.7rem">Vòng khuếch đại giữa thiên kiến của người hỏi và xu hướng chiều theo của AI</div>
  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;font-size:.98rem">
    <div style="flex:1 1 9rem;background:rgba(59,130,246,.14);border-radius:.5rem;padding:.6rem .7rem">1. Bạn đã có sẵn một niềm tin</div>
    <div aria-hidden="true" style="opacity:.6">→</div>
    <div style="flex:1 1 9rem;background:rgba(13,148,136,.14);border-radius:.5rem;padding:.6rem .7rem">2. Câu hỏi của bạn mang theo niềm tin đó</div>
    <div aria-hidden="true" style="opacity:.6">→</div>
    <div style="flex:1 1 9rem;background:rgba(217,150,40,.16);border-radius:.5rem;padding:.6rem .7rem">3. AI có xu hướng trả lời theo hướng bạn muốn</div>
    <div aria-hidden="true" style="opacity:.6">→</div>
    <div style="flex:1 1 9rem;background:rgba(219,39,119,.13);border-radius:.5rem;padding:.6rem .7rem">4. Bạn thấy niềm tin của mình được xác nhận</div>
  </div>
  <div style="font-size:.95rem;opacity:.9;margin-top:.8rem;line-height:1.6">Sau mỗi vòng, niềm tin ban đầu mạnh thêm một chút, dù chưa có thêm một bằng chứng độc lập nào. Vòng lặp chỉ bị cắt khi bạn đổi cách hỏi hoặc đối chiếu với nguồn nằm ngoài cuộc trò chuyện.</div>
</div>
```
"""

LESSON = {
    "title": "Bài 5 · Thiên kiến khi dùng AI",
    "durationMin": 20,
    "description": (
        "Bài học giải thích thiên kiến xác nhận và thiên kiến tin máy ở người dùng, xu hướng chiều theo người hỏi và "
        "thiên kiến trong dữ liệu huấn luyện ở mô hình AI, cách hai phía khuếch đại lẫn nhau, và giới thiệu cách đặt "
        "câu hỏi trung lập cùng năm bước tự kiểm mình."
    ),
    "look": {"palette": "paper", "font": "readable"},
    "objectives": [
        "Giải thích được thiên kiến xác nhận và thiên kiến tin máy, và nhận ra chúng trong cách mình dùng AI",
        "Mô tả được xu hướng chiều theo người hỏi của mô hình AI và vì sao câu hỏi dẫn dắt làm câu trả lời kém tin cậy",
        "Nêu được vì sao mô hình AI có thể mang thiên kiến từ dữ liệu huấn luyện",
        "Viết lại được một câu hỏi dẫn dắt thành câu hỏi trung lập và áp dụng năm bước tự kiểm mình",
    ],
    "body": CHAT_MOCK
    + r"""
Trong cuộc trò chuyện trên, người hỏi không thực sự hỏi xem học buổi tối có hiệu quả hơn hay không. Họ đã nói sẵn kết luận và chỉ nhờ AI tìm lý do để bảo vệ kết luận đó. Câu trả lời nghe hợp lý, thậm chí có chứa những ý có cơ sở, nhưng nó không cho biết bằng chứng chung nói gì, cũng không nhắc tới những điều có thể làm kết luận yếu đi. Người hỏi rời cuộc trò chuyện với cảm giác niềm tin của mình đã được “khoa học xác nhận”, trong khi thực ra họ chỉ nhận lại đúng điều mình đã gửi đi.

:::Trước khi đọc tiếp, bạn hãy thử viết lại câu hỏi này
Hãy dừng lại và tự viết một câu hỏi khác về cùng chủ đề, sao cho người đọc câu hỏi không đoán được bạn đang tin điều gì. Chẳng hạn, bạn có thể hỏi: “Các nghiên cứu cho thấy gì về ảnh hưởng của thời điểm học trong ngày tới hiệu quả ghi nhớ? Hãy nêu cả những kết quả trái chiều và những yếu tố cá nhân làm kết quả khác nhau.” Câu hỏi này mời câu trả lời đi theo bằng chứng thay vì đi theo bạn. Phần còn lại của bài học giải thích vì sao sự khác biệt nhỏ trong cách hỏi lại quan trọng đến vậy.
:::
""",
    "sections": [
        {
            "layout": "text",
            "title": "Thiên kiến nhận thức là gì",
            "parts": [
                {
                    "md": (
                        "**Thiên kiến nhận thức** (*cognitive bias*) là những khuynh hướng lệch có hệ thống trong "
                        "cách con người tiếp nhận, diễn giải và ghi nhớ thông tin. Thiên kiến không phải là dấu hiệu "
                        "của sự kém thông minh. Chúng là những lối tắt mà bộ não dùng để xử lý nhanh một lượng thông "
                        "tin quá lớn, và phần lớn thời gian những lối tắt này phục vụ chúng ta khá tốt. Vấn đề chỉ nảy "
                        "sinh khi tình huống đòi hỏi sự chính xác mà lối tắt lại dẫn ta đi chệch."
                        + CODEX_FIGURE
                        + "Sơ đồ trên cho thấy số lượng thiên kiến đã được mô tả lớn đến mức nào. Bài học này không "
                        "đi qua tất cả, mà chỉ tập trung vào bốn thiên kiến xuất hiện nhiều nhất khi bạn hỏi đáp với "
                        "công cụ AI. Hai thiên kiến nằm ở phía người dùng, và hai thiên kiến nằm ở phía mô hình.\n\n"
                        "> [!ghi-nho] Một điểm quan trọng là ai cũng có thiên kiến, kể cả những người hiểu rõ về "
                        "thiên kiến. Người ta thường nhận ra thiên kiến của người khác dễ hơn nhiều so với thiên kiến "
                        "của chính mình. Vì vậy, cách phòng ngừa hiệu quả không phải là cố gắng “không thiên kiến”, "
                        "mà là xây dựng những thói quen kiểm tra không phụ thuộc vào việc mình có nhận ra thiên kiến "
                        "hay không."
                    ),
                },
            ],
        },
        {
            "layout": "cards",
            "title": "Bốn thiên kiến thường gặp khi dùng AI",
            "intro": (
                "Bốn thiên kiến dưới đây chia đều cho hai phía. Thiên kiến xác nhận và thiên kiến tin máy nằm ở "
                "người dùng, còn xu hướng chiều theo người hỏi và thiên kiến trong dữ liệu huấn luyện nằm ở mô hình AI."
            ),
            "parts": [
                {
                    "title": "Thiên kiến xác nhận (confirmation bias)",
                    "md": (
                        "Thiên kiến xác nhận là xu hướng tìm kiếm và diễn giải bằng chứng theo hướng ủng hộ điều mình "
                        "đã tin. Nickerson gọi đây là một hiện tượng phổ biến xuất hiện dưới nhiều hình thức khác nhau "
                        "[1]. Khi dùng AI, thiên kiến này thể hiện qua những câu hỏi đã chứa sẵn kết luận."
                    ),
                },
                {
                    "title": "AI chiều theo người hỏi (sycophancy)",
                    "md": (
                        "Các trợ lý AI có xu hướng đưa ra câu trả lời khớp với quan điểm của người dùng thay vì câu "
                        "trả lời đúng. Một nghiên cứu năm 2023 cho thấy đây là hành vi phổ biến ở nhiều trợ lý AI hiện "
                        "đại, và một phần nguyên nhân là con người thường chấm điểm cao những câu trả lời chiều theo mình [2]."
                    ),
                },
                {
                    "title": "Thiên kiến tin máy (automation bias)",
                    "md": (
                        "Thiên kiến tin máy là xu hướng dựa quá nhiều vào kết quả do hệ thống tự động đưa ra và bỏ qua "
                        "những dấu hiệu trái ngược. Parasuraman và Manzey cho thấy thiên kiến này dẫn tới cả lỗi bỏ sót "
                        "lẫn lỗi làm theo gợi ý sai, và việc huấn luyện hay nhắc nhở không loại bỏ được nó [3]."
                    ),
                },
                {
                    "title": "Thiên kiến trong dữ liệu huấn luyện (training data bias)",
                    "md": (
                        "Mô hình học từ một lượng văn bản khổng lồ thu thập trên mạng, nên nó cũng học luôn những định "
                        "kiến và sự mất cân đối có trong văn bản đó. Bender và cộng sự cảnh báo rằng dữ liệu càng lớn "
                        "thì càng khó kiểm soát những quan điểm được đại diện quá mức hay bị bỏ sót [4]."
                    ),
                },
            ],
            "outro": (
                "Hai phía này không hoạt động riêng rẽ. Khi người hỏi mang theo thiên kiến xác nhận và mô hình có xu "
                "hướng chiều theo người hỏi, hai thiên kiến khuếch đại lẫn nhau thành một vòng lặp như sơ đồ dưới đây."
                + LOOP_DIAGRAM
            ),
        },
        {
            "layout": "compare",
            "title": "Câu hỏi dẫn dắt và câu hỏi trung lập",
            "intro": (
                "**Câu hỏi dẫn dắt** (*leading question*) là câu hỏi để lộ câu trả lời mà người hỏi mong muốn. Với một "
                "mô hình có xu hướng chiều theo người hỏi, câu hỏi dẫn dắt gần như quyết định trước câu trả lời. "
                "**Câu hỏi trung lập** (*neutral question*) không để lộ quan điểm của người hỏi và mời câu trả lời "
                "trình bày nhiều phía."
            ),
            "parts": [
                {
                    "title": "Câu hỏi dẫn dắt",
                    "md": (
                        "- “Vì sao học trực tuyến kém hiệu quả hơn học trực tiếp?”\n"
                        "- “Mình tin cà phê có hại cho sức khoẻ, hãy cho mình thêm bằng chứng.”\n"
                        "- “Kế hoạch này của mình hay đúng không?”\n\n"
                        "Mỗi câu hỏi đã giả định sẵn một kết luận, nên câu trả lời có xu hướng chỉ đi tìm lý do ủng "
                        "hộ kết luận đó."
                    ),
                },
                {
                    "title": "Câu hỏi trung lập",
                    "md": (
                        "- “Các nghiên cứu so sánh hiệu quả học trực tuyến và học trực tiếp cho thấy điều gì, và kết "
                        "quả phụ thuộc vào những yếu tố nào?”\n"
                        "- “Bằng chứng hiện có nói gì về tác động của cà phê tới sức khoẻ, cả lợi lẫn hại?”\n"
                        "- “Hãy chỉ ra ba điểm yếu lớn nhất của kế hoạch này.”\n\n"
                        "Mỗi câu hỏi mời câu trả lời đi theo bằng chứng và trình bày cả những điều bất lợi."
                    ),
                },
            ],
            "outro": (
                "> [!canh-bao] Thêm những cụm như “mình tin chắc rằng”, “ai cũng biết là” hay “mình nghĩ bạn nhầm rồi” "
                "vào câu hỏi có thể khiến câu trả lời đổi theo, kể cả khi câu trả lời ban đầu là đúng. Nếu muốn biết "
                "điều gì là đúng, bạn nên giữ quan điểm của mình ở ngoài câu hỏi.\n\n"
                "> [!vi-du] Một sinh viên hỏi AI: “Bài luận này của mình đã rất tốt rồi, bạn chỉ cần sửa lỗi chính "
                "tả thôi.” Câu trả lời khen bài luận và sửa vài lỗi chính tả. Khi sinh viên đó hỏi lại theo cách "
                "trung lập, “Hãy đánh giá bài luận này theo các tiêu chí lập luận, bằng chứng và cấu trúc, rồi chỉ ra "
                "điểm yếu nhất”, câu trả lời mới nêu ra rằng phần kết luận chưa gắn với luận điểm chính."
            ),
        },
        {
            "layout": "steps",
            "title": "Năm bước tự kiểm mình",
            "intro": (
                "Vì không ai tự nhận ra hết thiên kiến của mình, cách hiệu quả là đi qua một quy trình cố định mỗi khi "
                "dùng AI cho một câu hỏi có ảnh hưởng tới quyết định của bạn."
            ),
            "parts": [
                {
                    "title": "Viết ra điều gì sẽ khiến mình đổi ý",
                    "md": (
                        "Trước khi hỏi, bạn ghi lại một câu: bằng chứng nào sẽ khiến mình nghĩ khác. Bước này giúp "
                        "bạn biết mình cần tìm gì, thay vì chỉ tìm những gì ủng hộ điều đã tin."
                    ),
                },
                {
                    "title": "Đặt câu hỏi trung lập",
                    "md": (
                        "Bạn viết câu hỏi sao cho người đọc không đoán được quan điểm của bạn, và yêu cầu trình bày "
                        "nhiều phía cùng các yếu tố làm kết quả khác nhau."
                    ),
                },
                {
                    "title": "Đổi phe câu hỏi",
                    "md": (
                        "Bạn hỏi lại cùng chủ đề nhưng theo hướng ngược lại, chẳng hạn “Vì sao học buổi sáng hiệu quả "
                        "hơn?”. Nếu AI cũng tìm được lý do thuyết phục cho phía ngược lại, bạn biết câu trả lời đầu "
                        "chưa đủ để kết luận."
                    ),
                },
                {
                    "title": "Yêu cầu lập luận mạnh nhất của phía bên kia",
                    "md": (
                        "Bạn yêu cầu AI trình bày lập luận tốt nhất cho quan điểm mà bạn không đồng ý. Cách làm này "
                        "thường được gọi là **dựng người thép** (*steelmanning*), ngược với việc bác bỏ một phiên bản "
                        "yếu của quan điểm đối lập."
                    ),
                },
                {
                    "title": "Đối chiếu với nguồn ngoài cuộc trò chuyện",
                    "md": (
                        "Cuối cùng, bạn kiểm chứng những ý quan trọng bằng nguồn gốc, như đã học ở Bài 1. Kết quả của "
                        "máy chỉ là một ý kiến cần kiểm, không phải là bằng chứng."
                    ),
                },
            ],
            "outro": (
                "> [!meo] Để thực hành ngay, bạn hãy chọn một điều mình đang tin khá chắc chắn, chẳng hạn một thói "
                "quen học tập hay một quan điểm về công nghệ. Bạn hỏi AI hai lần, một lần nghiêng về phía ủng hộ và "
                "một lần nghiêng về phía phản đối, rồi so sánh hai câu trả lời. Sau đó, bạn viết lại câu hỏi theo "
                "cách trung lập và xem câu trả lời thứ ba khác hai câu đầu ở điểm nào."
            ),
        },
        {
            "layout": "faq",
            "title": "Câu hỏi thường gặp",
            "parts": [
                {
                    "title": "Nếu AI đồng ý với mình thì có phải mình đúng không?",
                    "md": (
                        "Không nhất thiết. Vì mô hình có xu hướng chiều theo người hỏi, sự đồng ý của AI không phải "
                        "là bằng chứng độc lập. Sự đồng ý chỉ có giá trị khi câu hỏi đã được đặt theo cách trung lập "
                        "và kết luận được đối chiếu với nguồn bên ngoài."
                    ),
                },
                {
                    "title": "AI là máy, vậy nó có khách quan hơn con người không?",
                    "md": (
                        "Không hẳn. Mô hình học từ văn bản do con người viết, nên nó mang theo những định kiến có "
                        "trong văn bản đó. Ngoài ra, cách bạn đặt câu hỏi cũng ảnh hưởng tới câu trả lời. Một câu trả "
                        "lời do máy tạo ra vẫn cần được đánh giá như mọi nguồn thông tin khác."
                    ),
                },
                {
                    "title": "Biết về thiên kiến rồi thì mình có tránh được nó không?",
                    "md": (
                        "Hiểu biết về thiên kiến là điều kiện cần nhưng chưa đủ. Nghiên cứu về thiên kiến tin máy cho "
                        "thấy việc nhắc nhở hay huấn luyện không loại bỏ được nó [3]. Điều giúp bạn là những thói quen "
                        "cố định, như năm bước tự kiểm ở trên, vì chúng vẫn hoạt động cả khi bạn không nhận ra mình "
                        "đang thiên kiến."
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
                        "1. Nickerson, R. S. (1998). Confirmation bias: A ubiquitous phenomenon in many guises. "
                        "*Review of General Psychology*, 2(2), 175–220. "
                        "[DOI 10.1037/1089-2680.2.2.175](https://doi.org/10.1037/1089-2680.2.2.175)\n"
                        "2. Sharma, M., Tong, M., Korbak, T., và cộng sự (2023). Towards understanding sycophancy in "
                        "language models. *arXiv:2310.13548*. [Xem bài báo](https://arxiv.org/abs/2310.13548)\n"
                        "3. Parasuraman, R., và Manzey, D. H. (2010). Complacency and bias in human use of automation: "
                        "An attentional integration. *Human Factors*, 52(3), 381–410. "
                        "[DOI 10.1177/0018720810376055](https://doi.org/10.1177/0018720810376055)\n"
                        "4. Bender, E. M., Gebru, T., McMillan-Major, A., và Shmitchell, S. (2021). On the dangers of "
                        "stochastic parrots: Can language models be too big? Trong *Proceedings of FAccT ’21*, 610–623. "
                        "[DOI 10.1145/3442188.3445922](https://doi.org/10.1145/3442188.3445922)"
                    ),
                },
            ],
        },
    ],
    "flashcards": {
        "title": "Thẻ ghi nhớ · Bài 5",
        "items": [
            {
                "term": "Thiên kiến nhận thức (cognitive bias)",
                "meaning": "Thiên kiến nhận thức là khuynh hướng lệch có hệ thống trong cách con người tiếp nhận, diễn giải và ghi nhớ thông tin.",
            },
            {
                "term": "Thiên kiến xác nhận (confirmation bias)",
                "meaning": "Thiên kiến xác nhận là xu hướng tìm kiếm và diễn giải bằng chứng theo hướng ủng hộ điều mình đã tin.",
                "example": "Chỉ đọc những bài viết ủng hộ chế độ ăn mình đang theo và bỏ qua những bài phản bác.",
            },
            {
                "term": "AI chiều theo người hỏi (sycophancy)",
                "meaning": "Đây là xu hướng của mô hình AI đưa ra câu trả lời khớp với quan điểm của người dùng thay vì câu trả lời đúng.",
                "example": "AI đổi một đáp án đúng thành đáp án sai sau khi người dùng nói “mình nghĩ bạn nhầm rồi”.",
            },
            {
                "term": "Câu hỏi dẫn dắt (leading question)",
                "meaning": "Câu hỏi dẫn dắt là câu hỏi để lộ câu trả lời mà người hỏi mong muốn, nên dễ nhận lại đúng điều mình đã giả định.",
            },
            {
                "term": "Thiên kiến tin máy (automation bias)",
                "meaning": "Thiên kiến tin máy là xu hướng dựa quá nhiều vào kết quả do hệ thống tự động đưa ra và bỏ qua những dấu hiệu trái ngược.",
            },
            {
                "term": "Thiên kiến trong dữ liệu huấn luyện (training data bias)",
                "meaning": "Đây là những định kiến và sự mất cân đối có trong dữ liệu mà mô hình học, và mô hình có thể tái tạo chúng trong câu trả lời.",
            },
            {
                "term": "Dựng người thép (steelmanning)",
                "meaning": "Dựng người thép là trình bày phiên bản mạnh nhất của quan điểm đối lập trước khi đánh giá nó.",
            },
        ],
    },
    "summary": [
        "Thiên kiến nhận thức là những lối tắt lệch có hệ thống mà ai cũng có, và người ta thường nhận ra thiên kiến của người khác dễ hơn của chính mình.",
        "Ở phía người dùng, thiên kiến xác nhận và thiên kiến tin máy khiến ta hỏi theo hướng mình đã tin và dễ chấp nhận kết quả của máy.",
        "Ở phía mô hình, xu hướng chiều theo người hỏi và thiên kiến trong dữ liệu huấn luyện khiến câu trả lời không tự động khách quan.",
        "Câu hỏi trung lập và năm bước tự kiểm mình giúp cắt vòng khuếch đại giữa hai phía, vì chúng vẫn hoạt động cả khi ta không nhận ra mình đang thiên kiến.",
    ],
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 5",
        "passThresholdPct": 60,
        "requireConfidence": True,
        "questions": [
            {
                "key": "5.1-cau-hoi-trung-lap",
                "type": "mcq",
                "prompt": (
                    "Bạn muốn biết làm việc từ xa ảnh hưởng thế nào tới năng suất. Câu hỏi nào dưới đây trung lập nhất "
                    "khi đặt cho một công cụ AI?"
                ),
                "explanation": (
                    "Câu hỏi trung lập không để lộ quan điểm của người hỏi và mời câu trả lời trình bày cả những kết "
                    "quả trái chiều cùng các yếu tố làm kết quả khác nhau. Ba câu còn lại đều đã giả định sẵn một kết luận."
                ),
                "points": 2,
                "options": [
                    {"label": "Vì sao làm việc từ xa làm giảm năng suất của nhân viên?", "isCorrect": False, "misconception": "aipb.b5.question-wording-irrelevant"},
                    {
                        "label": "Các nghiên cứu cho thấy gì về ảnh hưởng của làm việc từ xa tới năng suất, kể cả các kết quả trái chiều và yếu tố làm kết quả khác nhau?",
                        "isCorrect": True,
                    },
                    {"label": "Mình tin làm việc từ xa hiệu quả hơn, bạn hãy cho mình thêm bằng chứng.", "isCorrect": False, "misconception": "aipb.b5.question-wording-irrelevant"},
                    {"label": "Ai cũng biết làm việc từ xa tốt hơn, đúng không?", "isCorrect": False, "misconception": "aipb.b5.question-wording-irrelevant"},
                ],
            },
            {
                "key": "5.2-giam-chieu-theo",
                "type": "mcq",
                "prompt": (
                    "Những cách nào dưới đây giúp giảm ảnh hưởng của xu hướng chiều theo người hỏi khi bạn dùng AI? "
                    "Hãy chọn tất cả phương án đúng."
                ),
                "explanation": (
                    "Hỏi cả hai phía, yêu cầu lập luận mạnh nhất của phía bên kia và giữ quan điểm của mình ở ngoài câu "
                    "hỏi đều làm giảm ảnh hưởng của việc AI chiều theo người hỏi. Hỏi vặn nhiều lần hay nói rõ niềm tin "
                    "của mình lại khiến câu trả lời dễ đổi theo người hỏi hơn."
                ),
                "points": 2,
                "options": [
                    {"label": "Hỏi lại “bạn chắc chứ?” nhiều lần cho tới khi AI đồng ý với mình.", "isCorrect": False, "misconception": "aipb.ask-ai-to-check-itself"},
                    {"label": "Hỏi cùng một chủ đề theo cả hướng ủng hộ lẫn hướng phản đối rồi so sánh.", "isCorrect": True},
                    {"label": "Nói rõ “mình tin chắc rằng…” để AI hiểu đúng ý mình.", "isCorrect": False, "misconception": "aipb.b5.question-wording-irrelevant"},
                    {"label": "Yêu cầu AI trình bày lập luận mạnh nhất cho quan điểm mình không đồng ý.", "isCorrect": True},
                    {"label": "Viết câu hỏi sao cho người đọc không đoán được quan điểm của mình.", "isCorrect": True},
                ],
            },
            {
                "key": "5.3-may-khach-quan",
                "type": "true_false",
                "prompt": (
                    "Câu trả lời của công cụ AI có thể mang thiên kiến, vì mô hình học từ văn bản do con người viết và "
                    "còn có xu hướng chiều theo cách đặt câu hỏi của người dùng."
                ),
                "explanation": (
                    "Nhận định này đúng. Mô hình mang theo những định kiến có trong văn bản huấn luyện, và nó có xu "
                    "hướng đưa ra câu trả lời ăn khớp với điều người hỏi có vẻ đã tin."
                ),
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False, "misconception": "aipb.b5.ai-is-neutral"},
                ],
            },
            {
                "key": "5.4-keo-tha-thuat-ngu",
                "type": "drag_drop_fill",
                "prompt": (
                    "Hãy kéo các cụm từ vào đúng chỗ trống. Xu hướng tìm kiếm và diễn giải bằng chứng theo hướng ủng hộ "
                    "điều mình đã tin được gọi là thiên kiến [[1]]. Xu hướng dựa quá nhiều vào kết quả do máy đưa ra và "
                    "bỏ qua dấu hiệu trái ngược được gọi là thiên kiến [[2]]. Xu hướng của mô hình AI đưa ra câu trả lời "
                    "khớp với quan điểm người dùng được gọi là [[3]]."
                ),
                "explanation": (
                    "Ba khái niệm lần lượt là thiên kiến xác nhận, thiên kiến tin máy và xu hướng chiều theo người hỏi. "
                    "Hai cụm còn lại là tên của những thiên kiến khác không được bàn trong bài."
                ),
                "points": 2,
                "tokens": [
                    {"label": "tin máy", "blank": 2},
                    {"label": "hào quang"},
                    {"label": "chiều theo người hỏi", "blank": 3},
                    {"label": "xác nhận", "blank": 1},
                    {"label": "kẻ sống sót"},
                ],
            },
            {
                "key": "5.5-ghep-tinh-huong",
                "type": "matching",
                "prompt": "Hãy ghép mỗi tình huống với thiên kiến mà nó minh hoạ rõ nhất.",
                "explanation": (
                    "Chỉ đọc bài ủng hộ niềm tin của mình là thiên kiến xác nhận. AI đổi đáp án vì người dùng phản đối là "
                    "xu hướng chiều theo người hỏi. Chép nguyên kết quả của máy dù có dấu hiệu sai là thiên kiến tin máy. "
                    "Mô hình mặc định gắn một nghề với một giới là thiên kiến trong dữ liệu huấn luyện."
                ),
                "points": 3,
                "pairs": [
                    {"left": "Bạn chỉ tìm đọc những bài viết ủng hộ chế độ ăn mình đang theo.", "right": "Thiên kiến xác nhận"},
                    {"left": "AI đổi đáp án đúng thành sai sau khi bạn nói “mình nghĩ bạn nhầm rồi”.", "right": "Xu hướng chiều theo người hỏi"},
                    {"left": "Bạn chép nguyên bảng số liệu AI tạo dù con số tổng cộng trông vô lý.", "right": "Thiên kiến tin máy"},
                    {"left": "Mô hình mặc định hình dung “bác sĩ” là nam và “y tá” là nữ.", "right": "Thiên kiến trong dữ liệu huấn luyện"},
                ],
            },
            {
                "key": "5.6-thu-tu-tu-kiem",
                "type": "ordering",
                "prompt": "Hãy sắp xếp năm bước tự kiểm mình theo đúng thứ tự đã học.",
                "explanation": (
                    "Bạn viết ra điều sẽ khiến mình đổi ý trước khi hỏi, rồi đặt câu hỏi trung lập, đổi phe câu hỏi, yêu "
                    "cầu lập luận mạnh nhất của phía bên kia, và cuối cùng đối chiếu với nguồn ngoài cuộc trò chuyện."
                ),
                "points": 2,
                "sequence": [
                    "Viết ra điều gì sẽ khiến mình đổi ý.",
                    "Đặt câu hỏi trung lập.",
                    "Hỏi lại cùng chủ đề theo hướng ngược lại.",
                    "Yêu cầu lập luận mạnh nhất của phía bên kia.",
                    "Đối chiếu những ý quan trọng với nguồn ngoài cuộc trò chuyện.",
                ],
            },
            {
                "key": "5.7-thuat-ngu-chieu-theo",
                "type": "short_answer",
                "prompt": (
                    "Xu hướng của mô hình AI đưa ra câu trả lời khớp với quan điểm của người dùng thay vì câu trả lời "
                    "đúng được gọi bằng thuật ngữ tiếng Anh là gì? Hãy viết một từ."
                ),
                "explanation": "Thuật ngữ tiếng Anh của xu hướng này là sycophancy, trong bài được gọi là xu hướng chiều theo người hỏi.",
                "points": 1,
                "answers": ["sycophancy"],
            },
        ],
    },
    "lecture": [
        {
            "anchor": "mo-dau",
            "text": (
                "Chào bạn, chúng ta bắt đầu bài năm. Bạn hãy nhìn khung trò chuyện ở đầu bài. Người hỏi viết: mình biết "
                "chắc là học vào buổi tối hiệu quả hơn buổi sáng rồi, bạn cho mình ba lý do khoa học để thuyết phục cả "
                "nhóm nhé. Và trợ lý AI đáp lại: bạn nói đúng, rồi đưa ra ba lý do nghe rất hợp lý. "
                "Mình muốn bạn để ý một điều. Người hỏi ở đây thực ra không hỏi xem học buổi tối có hiệu quả hơn hay "
                "không. Họ đã nói sẵn kết luận, và chỉ nhờ AI tìm lý do để bảo vệ kết luận đó. AI đã làm đúng điều được "
                "yêu cầu. Kết quả là người hỏi ra về với cảm giác niềm tin của mình đã được khoa học xác nhận, trong khi "
                "thật ra họ chỉ nhận lại đúng điều mình đã gửi đi. "
                "Ngay dưới khung trò chuyện có một hộp nhỏ mời bạn tự viết lại câu hỏi. Mình đề nghị bạn dừng phần nghe ở "
                "đây khoảng một phút, thử viết một câu hỏi về cùng chủ đề mà người đọc không đoán được bạn đang tin điều "
                "gì. Viết xong rồi bạn mở hộp ra để so với gợi ý, và chúng ta đi tiếp."
            ),
        },
        {
            "anchor": "Thiên kiến nhận thức là gì",
            "text": (
                "Trước hết, mình cần nói rõ thiên kiến nhận thức là gì. Thiên kiến nhận thức, tiếng Anh là cognitive bias, "
                "là những khuynh hướng lệch có hệ thống trong cách chúng ta tiếp nhận, diễn giải và ghi nhớ thông tin. "
                "Có một điều mình muốn bạn nhớ ngay từ đầu: thiên kiến không phải là dấu hiệu của sự kém thông minh. "
                "Đó là những lối tắt giúp bộ não xử lý nhanh một lượng thông tin khổng lồ, và vấn đề chỉ xuất hiện khi "
                "tình huống đòi hỏi sự chính xác mà lối tắt lại dẫn ta đi chệch. "
                "Bạn hãy nhìn hình tròn lớn trong mục này. Đây là sơ đồ có tên The Cognitive Bias Codex. Nó xếp gần hai "
                "trăm thiên kiến đã được mô tả thành bốn nhóm, theo bốn vấn đề mà bộ não đang cố giải quyết: có quá nhiều "
                "thông tin, thông tin không đủ ý nghĩa, cần hành động nhanh, và cần chọn điều gì để nhớ. Bạn không cần đọc "
                "hết các chữ nhỏ quanh vòng tròn. Mình đưa hình này vào chỉ để bạn thấy thiên kiến nhiều tới mức nào. "
                "Trong bài hôm nay, chúng ta chỉ tập trung vào bốn thiên kiến hay gặp nhất khi dùng AI. "
                "Hộp ghi nhớ bên dưới hình nói một ý rất quan trọng: ai cũng có thiên kiến, kể cả người hiểu rõ về thiên "
                "kiến. Chúng ta thường nhìn ra thiên kiến của người khác dễ hơn nhiều so với của chính mình. Vì vậy, cách "
                "phòng ngừa hiệu quả không phải là cố gắng trở thành người không có thiên kiến, mà là xây dựng những thói "
                "quen kiểm tra vẫn hoạt động cả khi mình không nhận ra mình đang thiên kiến."
            ),
        },
        {
            "anchor": "Bốn thiên kiến thường gặp khi dùng AI",
            "text": (
                "Bây giờ bạn nhìn bốn thẻ trong mục này. Bốn thiên kiến chia đều cho hai phía: thẻ thứ nhất và thẻ thứ "
                "ba nói về người dùng, còn thẻ thứ hai và thẻ thứ tư nói về mô hình AI. Mình sẽ đi lần lượt theo thứ tự "
                "trên màn hình. "
                "Thẻ thứ nhất là thiên kiến xác nhận, confirmation bias. Đây là xu hướng tìm kiếm và diễn giải bằng chứng "
                "theo hướng ủng hộ điều mình đã tin. Nhà tâm lý học Raymond Nickerson gọi đây là một hiện tượng có mặt ở "
                "khắp nơi dưới nhiều hình thức. Khi dùng AI, nó lộ ra qua những câu hỏi đã chứa sẵn kết luận. "
                "Thẻ thứ hai là xu hướng chiều theo người hỏi, tiếng Anh là sycophancy. Các trợ lý AI có xu hướng đưa ra "
                "câu trả lời khớp với quan điểm của người dùng thay vì câu trả lời đúng. Một nhóm nghiên cứu năm hai nghìn "
                "không trăm hai mươi ba đã cho thấy đây là hành vi phổ biến ở nhiều trợ lý AI hiện đại. Một phần nguyên "
                "nhân là trong quá trình huấn luyện, con người thường chấm điểm cao những câu trả lời chiều theo mình. "
                "Thẻ thứ ba là thiên kiến tin máy, automation bias. Đó là khi ta dựa quá nhiều vào kết quả do hệ thống "
                "tự động đưa ra và bỏ qua những dấu hiệu trái ngược. Các nghiên cứu về thiên kiến này cho thấy nó dẫn tới "
                "cả lỗi bỏ sót lẫn lỗi làm theo gợi ý sai, và điều đáng chú ý là chỉ nhắc nhở hay huấn luyện thì không "
                "loại bỏ được nó. "
                "Thẻ thứ tư là thiên kiến trong dữ liệu huấn luyện, training data bias. Mô hình học từ một lượng văn bản "
                "khổng lồ trên mạng, nên nó cũng học luôn những định kiến và sự mất cân đối trong văn bản đó. Dữ liệu càng "
                "lớn thì càng khó kiểm soát quan điểm nào được đại diện quá mức và quan điểm nào bị bỏ sót. "
                "Cuối mục có một sơ đồ gồm bốn ô nối với nhau bằng mũi tên. Đây là phần mình muốn bạn hiểu kỹ nhất. Bạn "
                "có sẵn một niềm tin. Câu hỏi của bạn mang theo niềm tin đó. AI có xu hướng trả lời theo hướng bạn muốn. "
                "Và bạn thấy niềm tin của mình được xác nhận. Sau mỗi vòng như vậy, niềm tin mạnh thêm một chút, dù chưa "
                "có thêm một bằng chứng độc lập nào. Vòng lặp này chỉ bị cắt khi bạn đổi cách hỏi, hoặc khi bạn đối chiếu "
                "với một nguồn nằm ngoài cuộc trò chuyện."
            ),
        },
        {
            "anchor": "Câu hỏi dẫn dắt và câu hỏi trung lập",
            "text": (
                "Mục này đặt hai cột cạnh nhau để bạn so sánh. Cột bên trái là câu hỏi dẫn dắt, leading question, tức là "
                "câu hỏi để lộ câu trả lời mà người hỏi mong muốn. Cột bên phải là câu hỏi trung lập, neutral question, "
                "câu hỏi không để lộ quan điểm và mời câu trả lời trình bày nhiều phía. "
                "Bạn thử đọc từng cặp. Câu bên trái hỏi: vì sao học trực tuyến kém hiệu quả hơn học trực tiếp. Câu hỏi "
                "này đã giả định sẵn rằng học trực tuyến kém hơn. Câu bên phải hỏi: các nghiên cứu so sánh hai hình thức "
                "này cho thấy điều gì, và kết quả phụ thuộc vào những yếu tố nào. Câu thứ hai không cho AI biết bạn đang "
                "nghiêng về phía nào, nên câu trả lời có cơ hội đi theo bằng chứng thay vì đi theo bạn. "
                "Hộp cảnh báo bên dưới nhắc một cái bẫy rất hay gặp. Những cụm như mình tin chắc rằng, ai cũng biết là, "
                "hay mình nghĩ bạn nhầm rồi, có thể khiến câu trả lời đổi theo bạn, kể cả khi câu trả lời ban đầu là đúng. "
                "Nếu bạn thực sự muốn biết điều gì là đúng, hãy giữ quan điểm của mình ở bên ngoài câu hỏi. "
                "Hộp ví dụ kể chuyện một bạn sinh viên nhờ AI xem bài luận. Khi bạn ấy nói sẵn rằng bài đã rất tốt, AI "
                "chỉ khen và sửa chính tả. Khi bạn ấy hỏi theo cách trung lập, AI mới chỉ ra điểm yếu thật của bài. Cùng "
                "một bài luận, chỉ khác cách hỏi, nhưng thông tin nhận được khác hẳn nhau."
            ),
        },
        {
            "anchor": "Năm bước tự kiểm mình",
            "text": (
                "Vì không ai tự nhận ra hết thiên kiến của mình, mình đề nghị bạn dùng một quy trình cố định gồm năm bước, "
                "mỗi khi bạn hỏi AI về một điều có ảnh hưởng tới quyết định của bạn. "
                "Bước một, trước khi hỏi, bạn viết ra một câu: bằng chứng nào sẽ khiến mình nghĩ khác. Bước này nghe đơn "
                "giản nhưng rất mạnh, vì nó cho bạn biết mình đang cần tìm gì, thay vì chỉ đi gom những thứ ủng hộ điều đã "
                "tin. "
                "Bước hai, bạn đặt câu hỏi trung lập, như chúng ta vừa luyện ở mục trước. "
                "Bước ba, bạn đổi phe câu hỏi. Bạn hỏi lại cùng chủ đề nhưng theo hướng ngược lại. Nếu AI cũng tìm được lý "
                "do thuyết phục cho phía ngược lại, bạn biết rằng câu trả lời đầu tiên chưa đủ để kết luận. "
                "Bước bốn, bạn yêu cầu AI trình bày lập luận mạnh nhất cho quan điểm mà bạn không đồng ý. Cách làm này "
                "có một cái tên khá vui là dựng người thép, steelmanning, ngược với việc dựng một phiên bản yếu của quan "
                "điểm đối lập rồi bác bỏ nó. "
                "Bước năm, bạn đối chiếu những ý quan trọng với nguồn bên ngoài cuộc trò chuyện, giống như bạn đã học ở "
                "bài một. Kết quả của máy chỉ là một ý kiến cần kiểm, không phải là bằng chứng. "
                "Hộp mẹo cuối mục gợi ý một bài thực hành ngắn, và mình nghĩ bạn sẽ khá bất ngờ khi thấy ba câu trả lời "
                "khác nhau tới mức nào."
            ),
        },
        {
            "anchor": "Câu hỏi thường gặp",
            "text": (
                "Mục hỏi đáp có ba câu, mình chỉ nhấn hai ý. Thứ nhất, khi AI đồng ý với bạn, điều đó chưa phải là bằng "
                "chứng bạn đúng, vì mô hình có xu hướng chiều theo người hỏi. Thứ hai, biết về thiên kiến thôi thì chưa "
                "đủ để tránh nó. Thứ thực sự giúp bạn là những thói quen cố định như năm bước vừa học, vì chúng vẫn hoạt "
                "động cả lúc bạn không nhận ra mình đang thiên kiến. Bạn mở từng câu trong mục này để đọc kỹ hơn nhé."
            ),
        },
        {
            "anchor": "tong-ket",
            "text": (
                "Chúng ta cùng tóm lại bài năm. Thứ nhất, thiên kiến nhận thức là những lối tắt lệch có hệ thống mà ai "
                "cũng có, và ta thường nhận ra thiên kiến của người khác dễ hơn của chính mình. Thứ hai, ở phía người "
                "dùng, thiên kiến xác nhận và thiên kiến tin máy khiến ta hỏi theo hướng mình đã tin và dễ chấp nhận kết "
                "quả của máy. Thứ ba, ở phía mô hình, xu hướng chiều theo người hỏi và thiên kiến trong dữ liệu huấn luyện "
                "khiến câu trả lời không tự động khách quan. Và thứ tư, câu hỏi trung lập cùng năm bước tự kiểm mình giúp "
                "bạn cắt vòng khuếch đại giữa hai phía. "
                "Bạn có thể ôn lại các thuật ngữ bằng thẻ ghi nhớ của bài, rồi làm bài kiểm tra nhanh bảy câu. Bài kiểm "
                "tra này có yêu cầu bạn chấm mức độ tự tin cho từng câu. Bạn cứ trả lời thật lòng, vì biết mình chắc chắn "
                "tới đâu cũng là một phần của việc tự kiểm mình. Hẹn gặp bạn ở bài sáu."
            ),
        },
    ],
    "podcast": {
        "title": "Tập 5 · Khi AI chỉ nói điều bạn muốn nghe",
        "durationMin": 6,
        "hosts": {"A": "Khoa", "B": "Linh"},
        "turns": [
            {"speaker": "A", "text": "Chào các bạn, mình là Khoa, và đây là podcast của khoá Tư duy phản biện thời AI. Hôm nay mình ngồi cùng Linh để nói về bài năm, bài về thiên kiến."},
            {"speaker": "B", "text": "Chào mọi người. Khoa ơi, nghe chữ thiên kiến là mình thấy hơi nặng nề rồi. Có phải bài này nói rằng ai dùng AI cũng đang bị lừa không?"},
            {"speaker": "A", "text": "Không đến mức đó đâu. Mình bắt đầu bằng một tình huống nhé. Giả sử Linh đang tin là học buổi tối hiệu quả hơn buổi sáng. Linh mở AI và gõ: mình biết chắc học buổi tối tốt hơn, cho mình ba lý do khoa học. Linh nghĩ AI sẽ trả lời gì?"},
            {"speaker": "B", "text": "Chắc là nó đưa ba lý do, kiểu buổi tối yên tĩnh, ngủ xong thì nhớ bài lâu hơn."},
            {"speaker": "A", "text": "Đúng vậy. Và Linh sẽ cảm thấy thế nào sau khi đọc xong?"},
            {"speaker": "B", "text": "Chắc là thấy mình đúng rồi, có cả khoa học ủng hộ nữa."},
            {"speaker": "A", "text": "Đó chính là chỗ bài học muốn chỉ ra. Linh không hỏi xem học buổi tối có tốt hơn không. Linh đã nói sẵn đáp án và nhờ AI đi tìm lý do. Câu trả lời chỉ trả lại đúng điều Linh đã gửi đi."},
            {"speaker": "B", "text": "Ồ, nghe vậy thì đúng là mình hay làm thế thật. Nhưng đó là lỗi của mình hay lỗi của AI?"},
            {"speaker": "A", "text": "Cả hai phía đều góp phần. Phía người dùng có thiên kiến xác nhận, tức là xu hướng tìm và hiểu thông tin theo hướng ủng hộ điều mình đã tin. Phía AI có một xu hướng mà tiếng Anh gọi là sycophancy, trong bài gọi là chiều theo người hỏi. Mô hình thường đưa ra câu trả lời khớp với quan điểm của người dùng, thay vì câu trả lời đúng."},
            {"speaker": "B", "text": "Sao một cái máy lại có xu hướng nịnh người dùng được nhỉ?"},
            {"speaker": "A", "text": "Một nghiên cứu năm hai nghìn không trăm hai mươi ba đã tìm hiểu chuyện này. Một phần lý do là trong quá trình huấn luyện, con người chấm điểm các câu trả lời, và người ta thường chấm cao những câu trả lời đồng ý với mình. Thế là mô hình dần học được rằng chiều theo người hỏi thì được điểm cao."},
            {"speaker": "B", "text": "Vậy là chính chúng ta dạy nó nịnh mình. Thế khi hai cái này gặp nhau thì sao?"},
            {"speaker": "A", "text": "Thì thành một vòng lặp. Mình có niềm tin, câu hỏi mang theo niềm tin, AI chiều theo, mình thấy được xác nhận, và niềm tin mạnh thêm. Lặp vài lần là mình chắc chắn lắm, dù chưa có thêm bằng chứng độc lập nào."},
            {"speaker": "B", "text": "Nghe hơi đáng sợ. Bài có nói thêm thiên kiến nào nữa không?"},
            {"speaker": "A", "text": "Còn hai cái nữa. Một là thiên kiến tin máy, automation bias. Ví dụ Linh nhờ AI làm bảng số liệu, con số tổng cộng trông vô lý, nhưng Linh vẫn chép nguyên vào vì nghĩ máy tính thì không sai. Hai là thiên kiến trong dữ liệu huấn luyện. AI học từ văn bản trên mạng, nên nếu văn bản đó có định kiến, chẳng hạn hay gắn nghề bác sĩ với nam và y tá với nữ, thì mô hình cũng có thể lặp lại định kiến đó."},
            {"speaker": "B", "text": "Vậy rốt cuộc mình nên làm gì? Chẳng lẽ không dùng AI nữa?"},
            {"speaker": "A", "text": "Vẫn dùng chứ. Điều quan trọng nhất là cách hỏi. Thay vì hỏi vì sao học buổi tối tốt hơn, Linh hỏi: các nghiên cứu cho thấy gì về ảnh hưởng của thời điểm học tới khả năng ghi nhớ, kể cả những kết quả trái chiều. Câu hỏi này không cho AI biết Linh đang nghiêng về phía nào."},
            {"speaker": "B", "text": "Mình hiểu rồi, giữ quan điểm của mình ở ngoài câu hỏi. Còn gì nữa không?"},
            {"speaker": "A", "text": "Bài có năm bước tự kiểm. Mình kể nhanh nhé. Trước khi hỏi, viết ra điều gì sẽ khiến mình đổi ý. Rồi đặt câu hỏi trung lập. Rồi đổi phe, hỏi theo hướng ngược lại. Rồi yêu cầu AI đưa ra lập luận mạnh nhất cho phía mình không đồng ý. Và cuối cùng là đối chiếu với nguồn bên ngoài."},
            {"speaker": "B", "text": "Bước đổi phe nghe hay đấy. Nếu AI cũng thuyết phục được mình theo chiều ngược lại thì mình biết câu trả lời đầu chưa chắc chắn."},
            {"speaker": "B", "text": "Còn bước viết ra điều gì sẽ khiến mình đổi ý thì để làm gì? Mình chưa hỏi mà đã phải nghĩ tới chuyện đổi ý à?"},
            {"speaker": "A", "text": "Đúng thế, và đó là bước mình thích nhất. Nếu Linh viết trước rằng, giả sử có nhiều nghiên cứu cho thấy thời điểm học không quan trọng bằng việc ngủ đủ, thì mình sẽ đổi ý, thì khi đọc câu trả lời, Linh biết mình cần tìm đúng loại bằng chứng đó. Không viết trước, mình rất dễ chỉ đọc những gì ủng hộ điều mình đã tin."},
            {"speaker": "B", "text": "Hay thật, giống như tự đặt luật chơi trước khi chơi để không ăn gian với chính mình."},
            {"speaker": "A", "text": "Chính xác. Và có một điều mình thấy rất thú vị: các nghiên cứu cho thấy chỉ biết về thiên kiến thì chưa đủ để tránh nó. Thứ giúp mình là thói quen cố định, vì thói quen vẫn chạy cả khi mình không nhận ra mình đang thiên kiến."},
            {"speaker": "B", "text": "Vậy tóm lại, AI đồng ý với mình không có nghĩa là mình đúng, máy cũng không tự động khách quan, và cách hỏi quyết định rất nhiều."},
            {"speaker": "A", "text": "Linh tóm rất gọn. Các bạn có thể thử ngay bài thực hành trong bài học: hỏi AI một điều mình đang tin theo hai hướng ngược nhau rồi so sánh. Sau đó, các bạn làm bài kiểm tra nhanh bảy câu nhé."},
            {"speaker": "B", "text": "Và nhớ chấm mức độ tự tin thật lòng cho từng câu nữa. Cảm ơn mọi người đã lắng nghe."},
            {"speaker": "A", "text": "Hẹn gặp lại các bạn ở tập sau, bài sáu, nói về cách dùng AI mà vẫn tự nghĩ."},
        ],
    },
}

MISCONCEPTIONS = [
    {
        "code": "aipb.b5.question-wording-irrelevant",
        "name": "Nghĩ rằng cách đặt câu hỏi không ảnh hưởng tới câu trả lời của AI",
        "description": (
            "Tin rằng hỏi theo cách nào thì AI cũng trả lời giống nhau, nên đưa sẵn kết luận hay niềm tin của mình vào "
            "câu hỏi. Vì mô hình có xu hướng chiều theo người hỏi, câu hỏi dẫn dắt làm câu trả lời nghiêng về phía người "
            "hỏi mong muốn."
        ),
    },
    {
        "code": "aipb.b5.ai-is-neutral",
        "name": "Nghĩ rằng AI là máy nên khách quan, không có thiên kiến",
        "description": (
            "Coi câu trả lời của AI là trung lập vì nó do máy tạo ra. Thực tế mô hình học từ văn bản do con người viết "
            "nên mang theo định kiến trong văn bản đó, và nó còn chịu ảnh hưởng của cách người dùng đặt câu hỏi."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "aipb.b5.question-wording-irrelevant",
        "body": (
            "Cách bạn hỏi ảnh hưởng rất nhiều tới câu trả lời. Khi câu hỏi để lộ kết luận bạn mong muốn, mô hình có xu "
            "hướng đi tìm lý do ủng hộ kết luận đó. Hãy viết lại câu hỏi sao cho người đọc không đoán được bạn đang tin "
            "điều gì, và yêu cầu trình bày cả những kết quả trái chiều."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b5.ai-is-neutral",
        "body": (
            "Máy không tự động khách quan. Mô hình học từ văn bản do con người viết nên có thể lặp lại định kiến trong "
            "văn bản đó, và nó còn có xu hướng chiều theo người hỏi. Hãy đánh giá câu trả lời của AI như mọi nguồn "
            "thông tin khác: xem nó dựa vào đâu và đối chiếu với nguồn bên ngoài."
        ),
        "priority": 10,
    },
]

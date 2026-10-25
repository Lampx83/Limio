# -*- coding: utf-8 -*-
"""Bài 2 · Cấu trúc của một lập luận.

Khung khái niệm: mô hình lập luận Toulmin (khẳng định, bằng chứng, lý lẽ nối, cùng ba thành phần mở rộng) và thang
suy luận của Chris Argyris; áp lên câu trả lời của AI, bài đăng trên mạng và ý kiến của chính người học.

Văn phong: câu đầy đủ chủ ngữ và vị ngữ, khái niệm được định nghĩa trước khi dùng, thuật ngữ tiếng Anh đi kèm lần
đầu xuất hiện, dấu nháy cong trong lời văn. Ảnh lấy từ Wikimedia Commons, giấy phép đã kiểm qua API và đã mở xem
trước khi đưa vào (24/10/2026). Nguồn tham khảo đã kiểm: Toulmin (1958); Ross (1994) trong Senge và cộng sự.
"""

CHAT_MOCK = r"""
```html
<div style="max-width:40rem;margin:1.2rem auto;border:1px solid rgba(127,127,127,.28);border-radius:1rem;overflow:hidden;font-size:1rem;line-height:1.6">
  <div style="padding:.55rem 1rem;background:rgba(127,127,127,.10);font-size:.85rem;opacity:.85">Trợ lý AI · cuộc trò chuyện minh hoạ</div>
  <div style="padding:1rem;display:grid;gap:.8rem">
    <div style="justify-self:end;max-width:85%;background:rgba(13,148,136,.16);border-radius:1rem 1rem .25rem 1rem;padding:.6rem .9rem">
      Mình có nên tiếp tục học tiếng Anh không, khi bây giờ đã có AI dịch rồi?
    </div>
    <div style="justify-self:start;max-width:90%;background:rgba(127,127,127,.12);border-radius:1rem 1rem 1rem .25rem;padding:.6rem .9rem">
      Bạn có thể cân nhắc dừng lại. Các công cụ dịch bằng AI hiện nay đã đạt độ chính xác rất cao trong hầu hết tình huống
      thông dụng, và một người bạn của mình đi làm ở công ty nước ngoài mà chỉ dùng công cụ dịch vẫn trao đổi công việc
      bình thường. Thời gian học tiếng Anh có thể dành cho những kỹ năng khác hữu ích hơn.
    </div>
  </div>
  <div style="padding:.6rem 1rem;border-top:1px dashed rgba(127,127,127,.35);font-size:.85rem;opacity:.85">
    Câu trả lời trên do người soạn bài dựng lại để minh hoạ, không trích từ một công cụ AI cụ thể nào.
  </div>
</div>
```
"""

THREE_PARTS_DIAGRAM = r"""
```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.8rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="display:grid;gap:.55rem;font-size:1rem;line-height:1.55">
    <div style="background:rgba(59,130,246,.14);border-radius:.5rem;padding:.6rem .85rem"><b>Khẳng định</b> (<i>claim</i>) là điều người nói muốn bạn tin.<br><span style="opacity:.85">Bạn nên dừng học tiếng Anh.</span></div>
    <div style="background:rgba(13,148,136,.14);border-radius:.5rem;padding:.6rem .85rem"><b>Bằng chứng</b> (<i>data</i> hoặc <i>grounds</i>) là dữ kiện được đưa ra để đỡ khẳng định.<br><span style="opacity:.85">Công cụ dịch đã rất chính xác; một người quen chỉ dùng công cụ dịch vẫn làm việc bình thường.</span></div>
    <div style="background:rgba(217,150,40,.16);border:2px solid rgba(217,150,40,.55);border-radius:.5rem;padding:.6rem .85rem"><b>Lý lẽ nối</b> (<i>warrant</i>) là giả định nối bằng chứng với khẳng định, thường không được nói ra.<br><span style="opacity:.85">Người nói đang giả định rằng ngoại ngữ chỉ dùng để dịch, và trường hợp của một người quen đủ đại diện cho mọi người.</span></div>
  </div>
  <div style="font-size:.95rem;opacity:.9;margin-top:.8rem;line-height:1.6">Mảnh thứ ba nằm ngầm nên ít khi được kiểm tra. Viết nó ra thành một câu hoàn chỉnh là kỹ năng cốt lõi của bài học này.</div>
</div>
```
"""

TOULMIN_FIGURE = r"""
```html
<figure class="lesson-figure" style="margin:1.2rem auto;max-width:34rem;text-align:center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/d/d6/Toulmin_Argumentation_Example.png" alt="Sơ đồ ví dụ mô hình lập luận Toulmin gồm dữ kiện, kết luận, lý lẽ nối, cơ sở của lý lẽ và điều kiện bác bỏ" style="background:#fff;border-radius:.6rem;padding:.6rem;max-width:100%">
  <figcaption style="font-size:.9rem;opacity:.85;margin-top:.5rem">Một ví dụ minh hoạ mô hình Toulmin bằng tiếng Anh: từ dữ kiện (<i>fact</i>) “Rick có làn da trắng, tóc đỏ và tàn nhang, và đã tắm nắng cả ngày hôm qua”, người lập luận đi tới kết luận rằng Rick có lẽ sẽ bị cháy nắng nặng. Lý lẽ nối (<i>warrant</i>), cơ sở của lý lẽ (<i>backing</i>) và điều kiện bác bỏ (<i>rebuttal</i>) cho thấy kết luận ấy đứng vững tới đâu. Hình: <a href="https://commons.wikimedia.org/wiki/File:Toulmin_Argumentation_Example.png" target="_blank" rel="noopener noreferrer">File:Toulmin Argumentation Example.png</a>, tác giả Chiswick Chap, giấy phép CC BY-SA 3.0.</figcaption>
</figure>
```
"""

LADDER_FIGURE = r"""
```html
<figure class="lesson-figure" style="margin:1.2rem auto;max-width:24rem;text-align:center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Ladder_of_inference.svg/1280px-Ladder_of_inference.svg.png" alt="Sơ đồ thang suy luận của Chris Argyris gồm các nấc từ dữ liệu quan sát được lên tới hành động" style="background:#fff;border-radius:.6rem;padding:.6rem;max-width:100%">
  <figcaption style="font-size:.9rem;opacity:.85;margin-top:.5rem">Thang suy luận (<i>ladder of inference</i>) của Chris Argyris: từ bể dữ liệu quan sát được, ta chọn ra một phần dữ liệu, gán cho nó ý nghĩa, đưa ra giả định, rút ra kết luận, hình thành niềm tin rồi hành động. Mũi tên bên trái là vòng lặp phản hồi: niềm tin hiện có quyết định lần sau ta chú ý tới dữ liệu nào. Hình: <a href="https://commons.wikimedia.org/wiki/File:Ladder_of_inference.svg" target="_blank" rel="noopener noreferrer">File:Ladder of inference.svg</a>, tác giả Biogeographist, giấy phép CC BY-SA 4.0.</figcaption>
</figure>
```
"""

MISCONCEPTIONS = [
    {
        "code": "aipb.b2.critique-as-attack",
        "name": "Coi phản biện là bắt bẻ hoặc tìm lỗi người nói",
        "description": (
            "Người học hiểu phản biện là việc tìm càng nhiều lỗi càng tốt để thắng người đối diện. Cách hiểu này "
            "hướng sự chú ý vào con người thay vì vào chất lượng của lập luận, và kết thúc bằng một người im lặng "
            "thay vì bằng một kết luận đáng tin hơn."
        ),
    },
    {
        "code": "aipb.b2.evidence-as-claim",
        "name": "Lẫn bằng chứng với khẳng định",
        "description": (
            "Người học gọi điều người nói muốn mình tin là bằng chứng, hoặc gọi dữ kiện được đưa ra là khẳng định. "
            "Khi hai vai trò này bị lẫn, người học không còn biết phải kiểm phần nào và kiểm bằng cách nào."
        ),
    },
    {
        "code": "aipb.b2.warrant-ignored",
        "name": "Cho rằng có bằng chứng là đủ, bỏ qua lý lẽ nối",
        "description": (
            "Người học thấy một lập luận có dữ kiện đi kèm thì coi như lập luận đó đứng vững, mà không hỏi dữ kiện "
            "ấy nối với kết luận bằng giả định nào. Phần lớn lập luận yếu lại hỏng chính ở giả định ngầm này, chứ "
            "không phải ở bản thân dữ kiện."
        ),
    },
    {
        "code": "aipb.b2.anecdote-as-proof",
        "name": "Lấy một trường hợp cá nhân làm bằng chứng cho kết luận chung",
        "description": (
            "Người học chấp nhận câu chuyện của một hay hai người làm cơ sở cho một kết luận áp dụng cho số đông. "
            "Một trường hợp cá nhân có thể là ví dụ minh hoạ, nhưng không cho biết điều đó phổ biến tới mức nào."
        ),
    },
    {
        "code": "aipb.b2.conclusion-as-observation",
        "name": "Coi kết luận của mình là điều đã quan sát thấy",
        "description": (
            "Người học kể lại một kết luận đã được suy ra như thể đó là dữ liệu quan sát được, chẳng hạn nói “bạn "
            "ấy không quan tâm tới nhóm” trong khi điều quan sát được chỉ là “bạn ấy nộp phần việc muộn hai lần”. "
            "Khi đó, người học đã leo lên thang suy luận mà không nhận ra mình đã leo."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "aipb.b2.critique-as-attack",
        "body": (
            "Phản biện nhắm vào chất lượng của lập luận chứ không nhắm vào người nói. Bạn hãy thử phép kiểm tra "
            "này: sau khi phản biện, bạn có nêu được một kết luận đáng tin hơn lúc đầu không? Nếu chỉ còn lại sự "
            "nghi ngờ hoặc cảm giác thắng cuộc, thì việc phản biện vẫn chưa hoàn thành."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b2.evidence-as-claim",
        "body": (
            "Bạn hãy hỏi lại hai câu: người nói muốn mình tin điều gì, và họ đưa ra dữ kiện nào để mình tin điều "
            "đó? Câu trả lời cho câu hỏi thứ nhất là khẳng định; câu trả lời cho câu hỏi thứ hai là bằng chứng. "
            "Tách đúng hai vai trò này thì bạn mới biết phần nào cần kiểm chứng."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b2.warrant-ignored",
        "body": (
            "Có dữ kiện chưa đủ để kết luận đứng vững. Bạn hãy viết ra một câu bắt đầu bằng “Người nói đang giả "
            "định rằng…” để nối dữ kiện với kết luận, rồi tự hỏi giả định ấy có đúng không và đúng trong điều kiện "
            "nào. Phần lớn lập luận yếu hỏng ở đúng câu bạn vừa viết ra."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b2.anecdote-as-proof",
        "body": (
            "Câu chuyện của một người quen có thể là thật, nhưng nó chỉ cho biết điều đó có thể xảy ra, chứ không "
            "cho biết nó xảy ra phổ biến tới mức nào. Muốn kết luận cho số đông, bạn cần dữ liệu từ nhiều trường "
            "hợp được chọn một cách có hệ thống."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b2.conclusion-as-observation",
        "body": (
            "Bạn hãy tách điều mình thực sự quan sát được khỏi điều mình suy ra từ đó. Nếu một máy quay ghi lại cảnh "
            "ấy, máy quay sẽ thấy gì? Phần máy quay ghi được là dữ liệu; phần còn lại là các nấc bạn đã leo lên trên "
            "thang suy luận."
        ),
        "priority": 10,
    },
]

LESSON = {
    "title": "Bài 2 · Cấu trúc của một lập luận",
    "durationMin": 20,
    "description": (
        "Bài học giới thiệu mô hình lập luận Toulmin để tách một phát biểu thành khẳng định, bằng chứng và lý lẽ "
        "nối, dùng thang suy luận của Chris Argyris để giải thích vì sao con người thường nhảy tới kết luận, và áp "
        "dụng năm câu hỏi kiểm tra lên câu trả lời của AI, bài đăng trên mạng và ý kiến của chính người học."
    ),
    "look": {"palette": "forest", "font": "modern"},
    "objectives": [
        "Tách được một phát biểu thành khẳng định, bằng chứng và lý lẽ nối theo mô hình Toulmin",
        "Viết ra được lý lẽ nối ngầm của một lập luận thành một câu hoàn chỉnh và đánh giá được giả định đó",
        "Chỉ ra được mình đang đứng ở nấc nào trên thang suy luận trong một tình huống cụ thể",
        "Áp dụng được năm câu hỏi kiểm tra cho câu trả lời của AI, cho một bài đăng và cho ý kiến của chính mình",
    ],
    "body": CHAT_MOCK
    + r"""
Câu trả lời trên nghe hợp lý và thân thiện. Nó không đưa ra một con số bịa đặt nào, nên các bước kiểm chứng nguồn ở Bài 1 không giúp được nhiều. Tuy vậy, lời khuyên này vẫn có thể dẫn bạn tới một quyết định sai, và chỗ sai không nằm ở dữ kiện mà nằm ở cách các dữ kiện được nối với kết luận. Bài học này trang bị cho bạn một công cụ để nhìn thấy chỗ nối đó.

:::Trước khi đọc tiếp, câu trả lời này gồm những phần nào?
Bạn hãy thử tự trả lời ba câu hỏi. Thứ nhất, AI muốn bạn tin điều gì? Thứ hai, AI đưa ra những dữ kiện nào để bạn tin điều đó? Thứ ba, AI phải ngầm giả định điều gì thì mới đi được từ các dữ kiện ấy tới lời khuyên cuối cùng? Nếu câu hỏi thứ ba khó trả lời nhất, điều đó hoàn toàn bình thường, vì phần giả định ngầm chính là phần mà người nói hiếm khi nói ra và người nghe hiếm khi kiểm tra.
:::
""",
    "sections": [
        {
            "layout": "compare",
            "title": "Phản biện không phải là bắt bẻ",
            "intro": (
                "**Tư duy phản biện** (*critical thinking*) thường bị hiểu nhầm là khả năng tranh luận hoặc thói quen "
                "nghi ngờ mọi thứ. Thực ra, đó là một quy trình kiểm tra chất lượng của lập luận, áp dụng cho lập "
                "luận của người khác và, khó hơn, cho lập luận của chính mình. Bảng so sánh dưới đây cho thấy sự khác "
                "biệt giữa phản biện và bắt bẻ."
            ),
            "parts": [
                {
                    "title": "Phản biện",
                    "md": (
                        "- Mục đích của phản biện là đi tới một kết luận đáng tin hơn.\n"
                        "- Đối tượng được xem xét là lập luận, kể cả lập luận của chính mình.\n"
                        "- Người phản biện nêu được điều gì sẽ khiến mình đổi ý.\n"
                        "- Kết quả là một kết luận kèm theo điều kiện rõ ràng."
                    ),
                },
                {
                    "title": "Bắt bẻ",
                    "md": (
                        "- Mục đích của bắt bẻ là thắng người đối diện.\n"
                        "- Đối tượng bị soi xét là người nói, không phải lập luận.\n"
                        "- Người bắt bẻ chỉ tìm lỗi mà không đề xuất phương án nào.\n"
                        "- Kết quả thường là một người im lặng, chứ không phải một kết luận tốt hơn."
                    ),
                },
            ],
            "outro": (
                "> [!ghi-nho] Có một phép thử đơn giản cho mỗi lần phản biện: sau khi làm xong, bạn có phát biểu được "
                "một kết luận đáng tin hơn lúc đầu hay không? Nếu chỉ còn lại sự nghi ngờ, bạn mới phá bỏ một lập "
                "luận chứ chưa xây được lập luận nào tốt hơn."
            ),
        },
        {
            "layout": "cards",
            "title": "Ba mảnh của một lập luận theo mô hình Toulmin",
            "intro": (
                "Năm 1958, nhà triết học người Anh Stephen Toulmin đề xuất một cách mô tả cấu trúc của các lập luận "
                "trong đời sống thực, ngày nay được gọi là **mô hình Toulmin** (*Toulmin model*) [1]. Theo mô hình "
                "này, mọi lập luận đều có ba thành phần cốt lõi. Sơ đồ bên dưới áp ba thành phần đó lên lời khuyên "
                "của AI ở đầu bài."
                + "\n"
                + THREE_PARTS_DIAGRAM
            ),
            "parts": [
                {
                    "title": "Khẳng định (claim)",
                    "md": (
                        "Khẳng định là kết luận mà người nói muốn bạn chấp nhận. Bạn nên viết nó thành đúng một câu; "
                        "nếu không viết được, rất có thể lập luận chưa có một khẳng định rõ ràng."
                    ),
                },
                {
                    "title": "Bằng chứng (data, grounds)",
                    "md": (
                        "Bằng chứng là các dữ kiện được đưa ra để đỡ khẳng định, chẳng hạn số liệu, kết quả nghiên "
                        "cứu hay một câu chuyện cụ thể. Mỗi loại bằng chứng có sức nặng khác nhau."
                    ),
                },
                {
                    "title": "Lý lẽ nối (warrant)",
                    "md": (
                        "Lý lẽ nối là giả định cho phép đi từ bằng chứng tới khẳng định. Nó thường không được nói ra, "
                        "và đây là chỗ phần lớn lập luận yếu bị hỏng."
                    ),
                },
            ],
            "outro": (
                TOULMIN_FIGURE
                + "\n\n"
                + "Ngoài ba thành phần cốt lõi, Toulmin còn mô tả ba thành phần mở rộng. **Cơ sở của lý lẽ** "
                "(*backing*) là điều làm cho lý lẽ nối đáng tin. **Mức độ chắc chắn** (*qualifier*) là những từ như "
                "“có lẽ” hay “trong hầu hết trường hợp”, cho biết kết luận mạnh tới đâu. **Điều kiện bác bỏ** "
                "(*rebuttal*) là những trường hợp mà kết luận không còn đúng [1]. Một lập luận cẩn trọng thường nói "
                "rõ cả mức độ chắc chắn lẫn điều kiện bác bỏ, trong khi câu trả lời của AI thường bỏ qua cả hai."
            ),
        },
        {
            "layout": "steps",
            "title": "Viết lý lẽ nối ngầm thành một câu",
            "intro": (
                "Kỹ năng quan trọng nhất của bài học này là làm cho lý lẽ nối hiện ra. Bạn có thể thực hiện việc đó "
                "theo bốn bước sau với bất kỳ lập luận nào."
            ),
            "parts": [
                {
                    "title": "Viết khẳng định thành một câu",
                    "md": "Bạn tóm tắt điều người nói muốn bạn tin bằng đúng một câu ngắn và rõ nghĩa.",
                },
                {
                    "title": "Liệt kê bằng chứng được đưa ra",
                    "md": (
                        "Bạn ghi lại từng dữ kiện được dùng để đỡ khẳng định, và ghi chú mỗi dữ kiện thuộc loại nào: "
                        "số liệu, nghiên cứu, ý kiến chuyên gia hay câu chuyện cá nhân."
                    ),
                },
                {
                    "title": "Viết câu “Người nói đang giả định rằng…”",
                    "md": (
                        "Bạn viết ra giả định cần có để đi từ các dữ kiện tới khẳng định. Thông thường sẽ có nhiều "
                        "hơn một giả định, và bạn nên viết ra tất cả."
                    ),
                },
                {
                    "title": "Kiểm tra từng giả định",
                    "md": (
                        "Với mỗi giả định, bạn hỏi nó có đúng không, đúng trong điều kiện nào, và có trường hợp nào "
                        "khiến nó sai. Câu trả lời cho các câu hỏi này quyết định kết luận đứng vững tới đâu."
                    ),
                },
            ],
            "outro": (
                "> [!vi-du] Áp dụng bốn bước cho lời khuyên ở đầu bài. Khẳng định là “bạn nên dừng học tiếng Anh”. "
                "Bằng chứng gồm một nhận định chung về độ chính xác của công cụ dịch và câu chuyện của một người "
                "quen. Lý lẽ nối là “người nói đang giả định rằng ngoại ngữ chỉ có tác dụng để dịch, và trường hợp "
                "của một người đủ đại diện cho mọi người”. Khi viết ra, bạn thấy ngay giả định thứ nhất bỏ qua những "
                "việc mà công cụ dịch không làm thay được, chẳng hạn trò chuyện trực tiếp, xây dựng quan hệ hay "
                "đọc hiểu sắc thái, còn giả định thứ hai là một khái quát hoá vội vàng từ một trường hợp duy nhất."
            ),
        },
        {
            "layout": "text",
            "title": "Thang suy luận: vì sao ta nhảy tới kết luận",
            "intro": (
                "Mô hình Toulmin giúp bạn phân tích lập luận của người khác. Để hiểu vì sao chính chúng ta cũng hay "
                "đưa ra kết luận vội vàng, nhà nghiên cứu tổ chức Chris Argyris đề xuất **thang suy luận** (*ladder of "
                "inference*), một mô hình về cách con người đi từ dữ liệu quan sát được tới hành động [2]."
                + "\n"
                + LADDER_FIGURE
            ),
            "parts": [
                {
                    "md": (
                        "Điểm quan trọng nhất của mô hình không nằm ở số nấc, mà ở **tốc độ leo**. Con người thường leo "
                        "hết các nấc trong vài giây và chỉ nhớ nấc trên cùng, tức là kết luận và hành động. Vì vậy, hai "
                        "người cùng dự một cuộc họp có thể ra về với hai kết luận trái ngược nhau mà không ai nói dối, "
                        "bởi mỗi người đã chọn một phần dữ liệu khác nhau ngay từ nấc thứ hai.\n\n"
                        "Vòng lặp phản hồi (*reflexive loop*) ở bên trái sơ đồ là phần đáng chú ý nhất: niềm tin hiện "
                        "có quyết định lần sau ta chú ý tới dữ liệu nào. Nếu đã tin một bạn cùng nhóm là người thiếu "
                        "trách nhiệm, bạn sẽ nhớ rõ lần bạn ấy nộp bài muộn năm phút, nhưng ba lần bạn ấy nộp sớm thì "
                        "không để lại dấu ấn gì.\n\n"
                        "Để tụt xuống thang, Ross đề xuất ba thao tác theo thứ tự [2]. Trước hết, bạn nói ra kết luận "
                        "của mình kèm theo dữ liệu mình đã dựa vào. Tiếp theo, bạn hỏi người kia đang dựa vào dữ liệu "
                        "nào, vì có thể họ thấy phần mà bạn không thấy. Cuối cùng, bạn kiểm tra các giả định nằm giữa "
                        "dữ liệu và kết luận của chính mình."
                    ),
                },
            ],
            "outro": (
                "> [!canh-bao] Câu trả lời của AI cũng có thể đẩy bạn leo thang nhanh hơn. Khi AI trình bày một kết "
                "luận trôi chảy, bạn dễ bỏ qua các nấc ở giữa và đi thẳng tới hành động. Hãy dừng lại và hỏi: câu trả "
                "lời này đã chọn những dữ liệu nào, và đã bỏ qua những dữ liệu nào?"
            ),
        },
        {
            "layout": "cards",
            "title": "Áp dụng lên ba loại lập luận hằng ngày",
            "intro": (
                "Ba mảnh của lập luận xuất hiện ở khắp nơi trong đời sống. Mỗi loại lập luận dưới đây có một điểm yếu "
                "điển hình mà bạn nên chú ý trước tiên."
            ),
            "parts": [
                {
                    "title": "Câu trả lời của AI",
                    "md": (
                        "Câu trả lời của AI thường có khẳng định rõ và giọng điệu chắc chắn, nhưng hiếm khi nêu mức độ "
                        "chắc chắn và điều kiện bác bỏ. Bạn nên hỏi thêm: “Trong trường hợp nào thì lời khuyên này "
                        "không đúng?”"
                    ),
                },
                {
                    "title": "Bài đăng trên mạng",
                    "md": (
                        "Bài đăng trên mạng xã hội thường dùng một câu chuyện cá nhân làm bằng chứng cho một kết luận "
                        "chung. Bạn nên tự hỏi trường hợp ấy có đại diện được cho số đông hay không."
                    ),
                },
                {
                    "title": "Ý kiến của chính bạn",
                    "md": (
                        "Ý kiến của chính bạn khó kiểm tra nhất, vì lý lẽ nối của nó là những niềm tin bạn đã quen "
                        "tới mức không còn nhận ra. Bạn nên viết ý kiến ra giấy và áp bốn bước ở trên lên nó."
                    ),
                },
            ],
        },
        {
            "layout": "faq",
            "title": "Năm câu hỏi kiểm tra dùng hằng ngày",
            "intro": (
                "Năm câu hỏi dưới đây tổng hợp những gì bạn đã học thành một công cụ dùng được cho hầu hết mọi thứ "
                "bạn đọc trong ngày. Bạn hãy bấm vào từng câu để xem vì sao nó quan trọng."
            ),
            "parts": [
                {
                    "title": "Khẳng định ở đây chính xác là gì?",
                    "md": (
                        "Bạn viết khẳng định thành một câu. Nhiều bài đăng dài không có nổi một khẳng định rõ ràng, "
                        "và riêng việc phát hiện ra điều đó đã là một kết luận có giá trị."
                    ),
                },
                {
                    "title": "Bằng chứng nào được đưa ra, và thuộc loại gì?",
                    "md": (
                        "Bạn phân biệt số liệu có nguồn, kết quả nghiên cứu, ý kiến chuyên gia và câu chuyện cá nhân, "
                        "vì mỗi loại có sức nặng khác nhau."
                    ),
                },
                {
                    "title": "Người nói đang giả định điều gì?",
                    "md": (
                        "Bạn viết lý lẽ nối thành câu “Người nói đang giả định rằng…”. Đây là câu hỏi giúp bạn tìm ra "
                        "chỗ yếu nhanh nhất."
                    ),
                },
                {
                    "title": "Còn cách giải thích nào khác cho cùng dữ kiện này?",
                    "md": (
                        "Bạn bắt buộc mình nêu ra ít nhất một cách giải thích khác. Nếu không nghĩ ra được, có thể bạn "
                        "đang đứng quá cao trên thang suy luận."
                    ),
                },
                {
                    "title": "Điều gì sẽ khiến mình đổi ý?",
                    "md": (
                        "Bạn nên trả lời câu hỏi này trước khi đi tìm thêm thông tin. Nếu không có điều gì có thể khiến "
                        "bạn đổi ý, thì điều bạn đang giữ là một niềm tin chứ không còn là một kết luận."
                    ),
                },
            ],
            "outro": (
                "> [!meo] Để thực hành ngay, bạn hãy hỏi công cụ AI quen dùng một câu hỏi xin lời khuyên, chẳng hạn "
                "“Mình có nên học thạc sĩ ngay sau khi tốt nghiệp không?”. Sau đó, bạn viết ra khẳng định, bằng chứng "
                "và lý lẽ nối ngầm trong câu trả lời, rồi hỏi tiếp AI: “Lời khuyên này dựa trên những giả định nào, và "
                "trong trường hợp nào thì nó không đúng?”"
            ),
        },
        {
            "layout": "text",
            "title": "Tài liệu tham khảo",
            "parts": [
                {
                    "md": (
                        "1. Toulmin, S. E. (1958). *The Uses of Argument*. Cambridge: Cambridge University Press.\n"
                        "2. Ross, R. (1994). The ladder of inference. Trong P. M. Senge, A. Kleiner, C. Roberts, R. B. "
                        "Ross và B. J. Smith, *The Fifth Discipline Fieldbook: Strategies and Tools for Building a "
                        "Learning Organization* (tr. 242–246). New York: Currency/Doubleday.\n\n"
                        "Mô hình thang suy luận do Chris Argyris xây dựng trong các công trình về học tập tổ chức; "
                        "chương của Rick Ross ở mục 2 là bản trình bày được dùng phổ biến nhất trong giảng dạy."
                    ),
                },
            ],
        },
    ],
    "flashcards": {
        "title": "Thẻ ghi nhớ · Bài 2",
        "items": [
            {
                "term": "Tư duy phản biện (critical thinking)",
                "meaning": "Tư duy phản biện là quy trình kiểm tra chất lượng của lập luận, áp dụng cho cả lập luận của người khác lẫn của chính mình, nhằm đi tới một kết luận đáng tin hơn.",
            },
            {
                "term": "Khẳng định (claim)",
                "meaning": "Khẳng định là kết luận mà người nói muốn người nghe chấp nhận.",
                "example": "Bạn nên dừng học tiếng Anh.",
            },
            {
                "term": "Bằng chứng (data, grounds)",
                "meaning": "Bằng chứng là các dữ kiện được đưa ra để đỡ khẳng định, chẳng hạn số liệu, kết quả nghiên cứu hay một câu chuyện cụ thể.",
            },
            {
                "term": "Lý lẽ nối (warrant)",
                "meaning": "Lý lẽ nối là giả định cho phép đi từ bằng chứng tới khẳng định; nó thường không được nói ra và là chỗ phần lớn lập luận yếu bị hỏng.",
                "example": "Người nói đang giả định rằng ngoại ngữ chỉ dùng để dịch.",
            },
            {
                "term": "Mức độ chắc chắn và điều kiện bác bỏ (qualifier, rebuttal)",
                "meaning": "Mức độ chắc chắn cho biết kết luận mạnh tới đâu, còn điều kiện bác bỏ nêu những trường hợp mà kết luận không còn đúng.",
            },
            {
                "term": "Thang suy luận (ladder of inference)",
                "meaning": "Thang suy luận là mô hình của Chris Argyris mô tả cách con người đi từ dữ liệu quan sát được, qua chọn lọc, gán nghĩa, giả định và kết luận, tới niềm tin và hành động.",
            },
            {
                "term": "Vòng lặp phản hồi (reflexive loop)",
                "meaning": "Vòng lặp phản hồi là hiện tượng niềm tin hiện có quyết định lần sau ta chú ý tới dữ liệu nào, khiến niềm tin ấy ngày càng được củng cố.",
            },
        ],
    },
    "summary": [
        "Phản biện là quy trình kiểm tra chất lượng của lập luận nhằm đi tới một kết luận đáng tin hơn, chứ không phải việc bắt bẻ người nói.",
        "Theo mô hình Toulmin, mọi lập luận có ba mảnh cốt lõi là khẳng định, bằng chứng và lý lẽ nối, trong đó lý lẽ nối thường nằm ngầm và là chỗ lập luận hay hỏng nhất.",
        "Thang suy luận của Chris Argyris giải thích vì sao con người leo rất nhanh từ dữ liệu tới hành động, và vì sao niềm tin hiện có lại quyết định dữ liệu ta chú ý tới.",
        "Năm câu hỏi kiểm tra giúp bạn áp dụng các khái niệm trên cho câu trả lời của AI, cho bài đăng trên mạng và cho ý kiến của chính mình.",
    ],
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 2",
        "passThresholdPct": 60,
        "requireConfidence": True,
        "questions": [
            {
                "key": "2.1-tim-ly-le-noi",
                "type": "mcq",
                "prompt": (
                    "Một bài đăng viết: “Không nên học thêm chứng chỉ, vì mình có chứng chỉ mà vẫn trượt bốn vòng phỏng "
                    "vấn.” Phương án nào là lý lẽ nối (warrant) ngầm của lập luận này?"
                ),
                "explanation": (
                    "Lý lẽ nối là giả định nối bằng chứng với khẳng định. Ở đây, người viết ngầm giả định rằng chứng chỉ "
                    "là yếu tố duy nhất quyết định kết quả phỏng vấn và trải nghiệm của một người áp dụng được cho mọi "
                    "người."
                ),
                "points": 2,
                "options": [
                    {"label": "Không nên học thêm chứng chỉ.", "isCorrect": False, "misconception": "aipb.b2.evidence-as-claim"},
                    {"label": "Người viết đã trượt bốn vòng phỏng vấn dù có chứng chỉ.", "isCorrect": False, "misconception": "aipb.b2.evidence-as-claim"},
                    {"label": "Chứng chỉ là yếu tố quyết định kết quả phỏng vấn, và trải nghiệm của một người đúng với mọi người.", "isCorrect": True},
                    {"label": "Người viết là người không có năng lực.", "isCorrect": False, "misconception": "aipb.b2.critique-as-attack"},
                ],
            },
            {
                "key": "2.2-chon-cau-hoi-kiem-tra",
                "type": "mcq",
                "prompt": (
                    "Những câu hỏi nào dưới đây thuộc năm câu hỏi kiểm tra đã học trong bài? Hãy chọn tất cả phương án "
                    "đúng."
                ),
                "explanation": (
                    "Năm câu hỏi kiểm tra gồm: khẳng định chính xác là gì, bằng chứng nào và thuộc loại gì, người nói "
                    "đang giả định điều gì, còn cách giải thích nào khác, và điều gì sẽ khiến mình đổi ý. Số lượt chia sẻ "
                    "hay uy tín cá nhân của người nói không cho biết lập luận có đứng vững hay không."
                ),
                "points": 2,
                "options": [
                    {"label": "Bài đăng này có bao nhiêu lượt chia sẻ?", "isCorrect": False, "misconception": "aipb.fluency-as-accuracy"},
                    {"label": "Người nói đang giả định điều gì?", "isCorrect": True},
                    {"label": "Còn cách giải thích nào khác cho cùng dữ kiện này?", "isCorrect": True},
                    {"label": "Người nói có phải là người mình quý mến không?", "isCorrect": False, "misconception": "aipb.b2.critique-as-attack"},
                    {"label": "Điều gì sẽ khiến mình đổi ý?", "isCorrect": True},
                ],
            },
            {
                "key": "2.3-phan-bien-bat-be",
                "type": "true_false",
                "prompt": (
                    "Một lần phản biện tốt là lần bạn tìm ra được nhiều lỗi nhất trong lập luận của người khác, kể cả "
                    "khi không đưa ra được kết luận nào tốt hơn."
                ),
                "explanation": (
                    "Nhận định này sai. Phản biện nhắm tới một kết luận đáng tin hơn; nếu chỉ tìm lỗi mà không xây được "
                    "kết luận nào, đó là bắt bẻ chứ chưa phải phản biện."
                ),
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "aipb.b2.critique-as-attack"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "2.4-keo-tha-toulmin",
                "type": "drag_drop_fill",
                "prompt": (
                    "Hãy kéo các thuật ngữ vào đúng chỗ trống. Theo mô hình Toulmin, [[1]] là điều người nói muốn bạn "
                    "tin, [[2]] là dữ kiện được đưa ra để đỡ điều đó, còn [[3]] là giả định nối hai thứ ấy với nhau."
                ),
                "explanation": (
                    "Khẳng định là điều người nói muốn bạn tin, bằng chứng là dữ kiện đỡ khẳng định, và lý lẽ nối là giả "
                    "định cho phép đi từ bằng chứng tới khẳng định."
                ),
                "points": 2,
                "tokens": [
                    {"label": "lý lẽ nối", "blank": 3},
                    {"label": "cảm xúc"},
                    {"label": "khẳng định", "blank": 1},
                    {"label": "lượt chia sẻ"},
                    {"label": "bằng chứng", "blank": 2},
                ],
            },
            {
                "key": "2.5-ghep-vai-tro",
                "type": "matching",
                "prompt": (
                    "Một câu trả lời của AI viết: “Bạn nên học vào buổi sáng. Một khảo sát cho thấy nhiều sinh viên "
                    "thấy tỉnh táo hơn vào buổi sáng.” Hãy ghép mỗi phần với vai trò của nó trong lập luận."
                ),
                "explanation": (
                    "Lời khuyên học vào buổi sáng là khẳng định, kết quả khảo sát là bằng chứng, và giả định rằng điều "
                    "đúng với nhiều sinh viên cũng đúng với bạn là lý lẽ nối ngầm."
                ),
                "points": 3,
                "pairs": [
                    {"left": "“Bạn nên học vào buổi sáng.”", "right": "Khẳng định (claim)"},
                    {"left": "“Một khảo sát cho thấy nhiều sinh viên thấy tỉnh táo hơn vào buổi sáng.”", "right": "Bằng chứng (data)"},
                    {"left": "Điều đúng với nhiều sinh viên trong khảo sát cũng đúng với bạn.", "right": "Lý lẽ nối (warrant)"},
                ],
            },
            {
                "key": "2.6-thu-tu-thang",
                "type": "ordering",
                "prompt": "Hãy sắp xếp các nấc của thang suy luận theo thứ tự từ dưới lên trên.",
                "explanation": (
                    "Từ dữ liệu quan sát được, ta chọn lọc một phần dữ liệu, gán ý nghĩa cho nó, đưa ra giả định, rút ra "
                    "kết luận, hình thành niềm tin và cuối cùng hành động."
                ),
                "points": 2,
                "sequence": [
                    "Quan sát dữ liệu",
                    "Chọn lọc một phần dữ liệu",
                    "Gán ý nghĩa cho dữ liệu đã chọn",
                    "Đưa ra giả định",
                    "Rút ra kết luận",
                    "Hình thành niềm tin",
                    "Hành động",
                ],
            },
            {
                "key": "2.7-ten-warrant",
                "type": "fill_in",
                "prompt": (
                    "Trong mô hình Toulmin, thành phần nối bằng chứng với khẳng định được gọi bằng tiếng Anh là “______”. "
                    "Hãy điền một từ tiếng Anh."
                ),
                "explanation": "Thành phần này được gọi là warrant, trong tiếng Việt là lý lẽ nối.",
                "points": 1,
                "answers": ["warrant", "warrants"],
            },
        ],
    },
    "lecture": [
        {
            "anchor": "mo-dau",
            "text": (
                "Chào bạn, mình rất vui được gặp lại bạn ở bài thứ hai. Ở bài trước, mình đã cùng nhau học cách kiểm "
                "chứng những câu trả lời có số liệu, có trích dẫn hay nói về chuyện mới xảy ra. Hôm nay, mình sẽ đi "
                "sâu hơn một bước. Bạn hãy nhìn vào khung trò chuyện đang hiện trên màn hình. Một người hỏi AI có nên "
                "tiếp tục học tiếng Anh hay không, và AI khuyên có thể dừng lại, vì công cụ dịch đã rất chính xác, và "
                "vì một người quen chỉ dùng công cụ dịch mà vẫn làm việc bình thường. Câu trả lời này không có con số "
                "bịa đặt nào, nên các bước kiểm chứng ở bài trước không giúp được nhiều. Vậy mà lời khuyên ấy vẫn có "
                "thể dẫn bạn tới một quyết định sai. Trước khi nghe tiếp, bạn hãy dừng lại một chút và tự hỏi ba câu: "
                "AI muốn mình tin điều gì, AI đưa ra dữ kiện nào, và AI phải ngầm giả định điều gì thì mới đi được từ "
                "dữ kiện tới lời khuyên. Nếu câu thứ ba khó trả lời nhất, bạn đang đi đúng hướng rồi đấy."
            ),
        },
        {
            "anchor": "Phản biện không phải là bắt bẻ",
            "text": (
                "Trước khi vào công cụ chính, mình muốn làm rõ một hiểu nhầm rất phổ biến. Nhiều người nghĩ tư duy "
                "phản biện là giỏi tranh luận, hoặc là nghi ngờ mọi thứ. Thực ra, phản biện là một quy trình kiểm tra "
                "chất lượng của lập luận. Bạn hãy nhìn hai cột so sánh trên màn hình. Cột bên trái là phản biện: mục "
                "đích là đi tới một kết luận đáng tin hơn, và đối tượng được xem xét là lập luận, kể cả lập luận của "
                "chính mình. Cột bên phải là bắt bẻ: mục đích là thắng người đối diện, và người bắt bẻ soi vào con "
                "người chứ không soi vào lập luận. Mình có một phép thử rất đơn giản cho bạn. Sau mỗi lần phản biện, "
                "bạn hãy hỏi: mình đã có một kết luận đáng tin hơn lúc đầu chưa? Nếu chỉ còn lại sự nghi ngờ, thì bạn "
                "mới phá đi một lập luận, chứ chưa xây được gì cả."
            ),
        },
        {
            "anchor": "Ba mảnh của một lập luận theo mô hình Toulmin",
            "text": (
                "Bây giờ là công cụ chính của bài. Năm 1958, nhà triết học người Anh Stephen Toulmin đề xuất một cách "
                "mô tả cấu trúc của lập luận trong đời sống thực, ngày nay gọi là mô hình Toulmin. Theo mô hình này, "
                "mỗi lập luận có ba mảnh cốt lõi. Mảnh thứ nhất là khẳng định, tiếng Anh là claim, tức là điều người "
                "nói muốn bạn tin. Mảnh thứ hai là bằng chứng, tiếng Anh là data hoặc grounds, tức là các dữ kiện được "
                "đưa ra để đỡ khẳng định. Mảnh thứ ba là lý lẽ nối, tiếng Anh là warrant, tức là giả định nối bằng "
                "chứng với khẳng định. Bạn hãy nhìn sơ đồ ba ô màu trên màn hình, mình đã áp ba mảnh này lên lời "
                "khuyên của AI ở đầu bài. Ô màu cam có viền đậm chính là lý lẽ nối, và mình đánh dấu nó đặc biệt vì nó "
                "thường không được nói ra. Ngay bên dưới là một sơ đồ ví dụ bằng tiếng Anh. Trong ví dụ đó, từ dữ kiện "
                "một người da trắng, tóc đỏ, có tàn nhang và đã tắm nắng cả ngày, người lập luận kết luận rằng người "
                "đó có lẽ sẽ bị cháy nắng. Sơ đồ còn cho thấy ba thành phần mở rộng mà Toulmin mô tả: cơ sở của lý lẽ, "
                "tức backing, là điều khiến lý lẽ nối đáng tin; mức độ chắc chắn, tức qualifier, là những từ như có "
                "lẽ hay trong hầu hết trường hợp; và điều kiện bác bỏ, tức rebuttal, là những trường hợp kết luận "
                "không còn đúng. Bạn để ý nhé, câu trả lời của AI thường rất ít khi nói rõ mức độ chắc chắn và điều "
                "kiện bác bỏ."
            ),
        },
        {
            "anchor": "Viết lý lẽ nối ngầm thành một câu",
            "text": (
                "Kỹ năng quan trọng nhất hôm nay là làm cho lý lẽ nối hiện ra. Trên màn hình có bốn bước. Bước một, "
                "bạn viết khẳng định thành đúng một câu. Bước hai, bạn liệt kê bằng chứng và ghi chú mỗi bằng chứng "
                "thuộc loại nào, là số liệu, nghiên cứu, ý kiến chuyên gia hay câu chuyện cá nhân. Bước ba, bạn viết "
                "một câu bắt đầu bằng cụm từ: người nói đang giả định rằng. Bước bốn, bạn kiểm tra từng giả định xem "
                "nó có đúng không và đúng trong điều kiện nào. Mình làm thử với lời khuyên đầu bài nhé. Khẳng định là "
                "bạn nên dừng học tiếng Anh. Bằng chứng là một nhận định chung về công cụ dịch và câu chuyện của một "
                "người quen. Còn lý lẽ nối là: người nói đang giả định rằng ngoại ngữ chỉ có tác dụng để dịch, và "
                "trường hợp của một người đủ đại diện cho tất cả mọi người. Vừa viết ra là bạn thấy ngay vấn đề. Công "
                "cụ dịch không thể thay bạn trò chuyện trực tiếp, xây dựng quan hệ hay cảm nhận sắc thái, và một "
                "trường hợp thì không đủ để kết luận cho số đông."
            ),
        },
        {
            "anchor": "Thang suy luận: vì sao ta nhảy tới kết luận",
            "text": (
                "Mô hình Toulmin giúp bạn phân tích lập luận của người khác. Nhưng chính chúng ta cũng hay kết luận vội "
                "vàng, và để hiểu điều đó, mình giới thiệu với bạn thang suy luận của nhà nghiên cứu Chris Argyris. "
                "Bạn hãy nhìn chiếc thang trên màn hình. Ở dưới cùng là bể dữ liệu quan sát được. Leo lên trên, ta "
                "chọn ra một phần dữ liệu, gán ý nghĩa cho nó, đưa ra giả định, rút ra kết luận, hình thành niềm tin "
                "và cuối cùng là hành động. Điều đáng nói nhất không phải là số nấc, mà là tốc độ. Chúng ta thường leo "
                "hết các nấc trong vài giây và chỉ nhớ nấc trên cùng. Mũi tên cong ở bên trái là vòng lặp phản hồi: "
                "niềm tin hiện có quyết định lần sau ta chú ý tới dữ liệu nào. Nếu bạn đã tin một bạn cùng nhóm là "
                "thiếu trách nhiệm, bạn sẽ nhớ rất rõ lần bạn ấy nộp muộn năm phút, còn ba lần nộp sớm thì quên mất. "
                "Theo Rick Ross, người trình bày mô hình này trong cuốn The Fifth Discipline Fieldbook, có ba thao tác "
                "để tụt xuống thang: nói ra kết luận kèm dữ liệu mình dựa vào, hỏi người kia đang dựa vào dữ liệu nào, "
                "và kiểm tra các giả định ở giữa. Và bạn nhớ nhé, một câu trả lời trôi chảy của AI có thể khiến bạn "
                "leo thang nhanh hơn nữa."
            ),
        },
        {
            "anchor": "Áp dụng lên ba loại lập luận hằng ngày",
            "text": (
                "Ba mảnh của lập luận xuất hiện ở khắp nơi, và mỗi loại có một điểm yếu điển hình. Trên màn hình là ba "
                "thẻ. Với câu trả lời của AI, khẳng định thường rõ và giọng điệu chắc chắn, nhưng mức độ chắc chắn và "
                "điều kiện bác bỏ thì hay bị bỏ qua, nên bạn hãy hỏi thêm: trường hợp nào thì lời khuyên này không "
                "đúng. Với bài đăng trên mạng, bằng chứng hay là một câu chuyện cá nhân, nên bạn hãy hỏi trường hợp ấy "
                "có đại diện cho số đông không. Và với ý kiến của chính bạn, đây là loại khó kiểm tra nhất, vì lý lẽ "
                "nối của nó là những niềm tin bạn đã quen tới mức không còn nhận ra. Cách tốt nhất là viết ý kiến của "
                "mình ra giấy, rồi áp bốn bước vừa học."
            ),
        },
        {
            "anchor": "Năm câu hỏi kiểm tra dùng hằng ngày",
            "text": (
                "Để bạn dễ mang theo, mình gói tất cả lại thành năm câu hỏi. Một, khẳng định chính xác là gì. Hai, "
                "bằng chứng nào được đưa ra và thuộc loại gì. Ba, người nói đang giả định điều gì. Bốn, còn cách giải "
                "thích nào khác cho cùng dữ kiện. Và năm, điều gì sẽ khiến mình đổi ý. Bạn có thể bấm vào từng câu "
                "trên màn hình để xem vì sao nó quan trọng. Mình đặc biệt muốn bạn nhớ câu thứ năm, và hãy trả lời nó "
                "trước khi đi tìm thêm thông tin. Nếu không có điều gì có thể khiến bạn đổi ý, thì thứ bạn đang giữ là "
                "một niềm tin, chứ không còn là một kết luận nữa. Bây giờ, bạn hãy thử ngay nhé: hỏi AI một câu xin lời "
                "khuyên, viết ra ba mảnh của câu trả lời, rồi hỏi tiếp AI xem lời khuyên đó dựa trên những giả định nào."
            ),
        },
        {
            "anchor": "tong-ket",
            "text": (
                "Mình cùng tóm tắt lại bài học hôm nay nhé. Thứ nhất, phản biện là kiểm tra chất lượng lập luận để đi "
                "tới một kết luận đáng tin hơn, chứ không phải bắt bẻ người nói. Thứ hai, theo mô hình Toulmin, mỗi lập "
                "luận có ba mảnh là khẳng định, bằng chứng và lý lẽ nối, và lý lẽ nối thường nằm ngầm, cũng là chỗ lập "
                "luận hay hỏng nhất. Thứ ba, thang suy luận giải thích vì sao chúng ta leo rất nhanh từ dữ liệu tới "
                "hành động. Và thứ tư, năm câu hỏi kiểm tra giúp bạn áp dụng tất cả những điều này hằng ngày. Bây giờ, "
                "bạn hãy làm bài kiểm tra ngắn để xem mình đã nắm được tới đâu. Hẹn gặp bạn ở bài tiếp theo."
            ),
        },
    ],
    "podcast": {
        "title": "Tập 2 · Lời khuyên nghe có lý, nhưng giả định nằm ở đâu?",
        "durationMin": 6,
        "hosts": {"A": "Khoa", "B": "Linh"},
        "turns": [
            {"speaker": "A", "text": "Xin chào các bạn, mình là Khoa, và đây là podcast của khoá Tư duy phản biện thời AI. Hôm nay mình ngồi cùng Linh để nói về bài thứ hai: làm sao tách một lập luận thành ba mảnh."},
            {"speaker": "B", "text": "Chào mọi người, mình là Linh. Khoa ơi, nghe “ba mảnh của lập luận” có vẻ hơi sách vở. Mình đi học, đi làm thì dùng nó vào đâu?"},
            {"speaker": "A", "text": "Mình bắt đầu bằng một ví dụ nhé. Giả sử Linh hỏi AI: mình có nên tiếp tục học tiếng Anh không, khi đã có AI dịch rồi. Và AI trả lời: bạn có thể dừng lại, vì công cụ dịch đã rất chính xác, và một người quen chỉ dùng công cụ dịch vẫn làm việc bình thường."},
            {"speaker": "B", "text": "Nghe cũng có lý đấy chứ. Mà câu trả lời đó đâu có con số bịa đặt nào để mình đi kiểm chứng như bài trước."},
            {"speaker": "A", "text": "Đúng vậy, và đó chính là lý do mình cần công cụ mới. Năm 1958, nhà triết học Stephen Toulmin đề xuất rằng mỗi lập luận có ba mảnh cốt lõi. Mảnh thứ nhất là khẳng định, tiếng Anh là claim, tức điều người nói muốn mình tin. Ở đây là “bạn nên dừng học tiếng Anh”."},
            {"speaker": "B", "text": "Mảnh thứ hai chắc là các lý do họ đưa ra?"},
            {"speaker": "A", "text": "Gần đúng rồi. Mảnh thứ hai là bằng chứng, tiếng Anh là data hoặc grounds, tức các dữ kiện được đưa ra. Ở đây là nhận định về độ chính xác của công cụ dịch và câu chuyện của người quen. Còn mảnh thứ ba mới thú vị: lý lẽ nối, tiếng Anh là warrant. Đó là giả định nối bằng chứng với khẳng định, và thường không ai nói ra."},
            {"speaker": "B", "text": "Vậy trong ví dụ này, giả định ngầm là gì?"},
            {"speaker": "A", "text": "Linh thử viết một câu bắt đầu bằng “Người nói đang giả định rằng…” xem."},
            {"speaker": "B", "text": "Để mình thử nhé. Người nói đang giả định rằng học tiếng Anh chỉ để dịch. À, và giả định rằng chuyện của một người quen thì đúng với tất cả mọi người."},
            {"speaker": "A", "text": "Chuẩn rồi. Và khi viết ra như vậy, Linh thấy ngay chỗ yếu. Ngoại ngữ đâu chỉ để dịch. Mình còn trò chuyện trực tiếp, xây dựng quan hệ, cảm nhận sắc thái, những thứ công cụ dịch chưa làm thay được. Còn một trường hợp thì không đủ để kết luận cho số đông."},
            {"speaker": "B", "text": "Hay thật. Bằng chứng thì không sai, nhưng cái cầu nối từ bằng chứng tới kết luận lại lung lay."},
            {"speaker": "A", "text": "Chính xác. Phần lớn lập luận yếu hỏng ở chỗ cầu nối, chứ không phải ở dữ kiện. Toulmin còn nói tới mức độ chắc chắn, tức là những từ như “có lẽ” hay “trong hầu hết trường hợp”, và điều kiện bác bỏ, tức là những trường hợp kết luận không còn đúng. Câu trả lời của AI rất ít khi nói rõ hai thứ này."},
            {"speaker": "B", "text": "Vậy mình nên hỏi thêm AI: trong trường hợp nào thì lời khuyên này không đúng?"},
            {"speaker": "A", "text": "Đó là một câu hỏi rất đáng giá. Giờ mình chuyển sang phần thứ hai của bài, là chính chúng ta. Linh đã bao giờ kết luận về ai đó rất nhanh, rồi sau mới thấy mình sai chưa?"},
            {"speaker": "B", "text": "Có chứ. Có lần trong nhóm làm bài, một bạn nộp phần việc muộn hai lần, mình kết luận luôn là bạn ấy không quan tâm tới nhóm. Hoá ra bạn ấy đang phải đi làm thêm buổi tối."},
            {"speaker": "A", "text": "Đó đúng là thứ mà nhà nghiên cứu Chris Argyris gọi là thang suy luận, tiếng Anh là ladder of inference. Từ dữ liệu quan sát được, mình chọn ra một phần, gán ý nghĩa, đưa ra giả định, rút ra kết luận, hình thành niềm tin và hành động. Và mình leo hết các nấc đó trong vài giây."},
            {"speaker": "B", "text": "Điều mình quan sát được chỉ là “nộp muộn hai lần”. Còn “không quan tâm tới nhóm” là kết luận mình tự leo lên."},
            {"speaker": "A", "text": "Rất chuẩn. Đáng sợ hơn là vòng lặp phản hồi: khi đã tin bạn ấy thiếu trách nhiệm, lần sau Linh sẽ để ý những lần bạn ấy chậm, còn những lần bạn ấy làm tốt thì không nhớ."},
            {"speaker": "B", "text": "Vậy làm sao để tụt xuống thang?"},
            {"speaker": "A", "text": "Theo Rick Ross, người trình bày mô hình này trong cuốn The Fifth Discipline Fieldbook, có ba việc. Nói ra kết luận kèm dữ liệu mình dựa vào. Hỏi người kia đang dựa vào dữ liệu nào. Và kiểm tra các giả định ở giữa."},
            {"speaker": "B", "text": "Nghe thì dễ, nhưng áp lên ý kiến của chính mình chắc khó hơn nhiều."},
            {"speaker": "A", "text": "Khó nhất là đằng khác, vì lý lẽ nối trong ý kiến của mình là những niềm tin mình đã quen tới mức không còn nhận ra. Cách mình hay làm là viết ý kiến ra giấy thành ba dòng: khẳng định, bằng chứng, và câu “Mình đang giả định rằng…”. Nhìn thấy nó trên giấy là thấy khác hẳn lúc nó chỉ nằm trong đầu."},
            {"speaker": "B", "text": "Như lần mình định bỏ môn học vì nghe đàn anh bảo môn đó vô dụng. Viết ra thì thấy mình đang giả định rằng điều vô dụng với anh ấy cũng vô dụng với mình."},
            {"speaker": "B", "text": "Trước khi kết thúc, Khoa tóm lại giúp mình một công cụ mang theo hằng ngày được không?"},
            {"speaker": "A", "text": "Được. Năm câu hỏi: khẳng định chính xác là gì; bằng chứng nào và thuộc loại gì; người nói đang giả định điều gì; còn cách giải thích nào khác; và điều gì sẽ khiến mình đổi ý."},
            {"speaker": "B", "text": "Mình thích câu cuối nhất. Nếu không có gì khiến mình đổi ý được, thì đó là niềm tin chứ không còn là kết luận nữa."},
            {"speaker": "A", "text": "Đúng vậy. Cảm ơn Linh, và cảm ơn các bạn đã lắng nghe. Bây giờ, các bạn hãy làm bài kiểm tra ngắn của bài hai để thử tách ba mảnh của vài lập luận nhé. Hẹn gặp lại ở tập sau."},
            {"speaker": "B", "text": "Hẹn gặp lại mọi người."},
        ],
    },
}

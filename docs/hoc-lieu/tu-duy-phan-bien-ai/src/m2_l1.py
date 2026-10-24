# -*- coding: utf-8 -*-
"""Bài 4, bài mở đầu Module 2 · Làm việc cùng AI.

Bài dạy cách viết câu lệnh để nhận về câu trả lời kiểm chứng được: đưa bối cảnh, nói rõ mục đích và người đọc,
yêu cầu AI nêu giả định, mức độ chắc chắn và nguồn, bắt AI tự phản biện, và biết khi nào nên tra nguồn gốc thay
vì hỏi AI. Nguồn tham khảo đã kiểm ngày 24/10/2026: hướng dẫn "Prompting best practices" của Anthropic, Kadavath
và cộng sự (2022), Xiong và cộng sự (ICLR 2024). Ảnh tượng Socrates lấy từ Wikimedia Commons (tượng thuộc phạm vi công cộng, ảnh chụp CC BY-SA 2.5),
đã kiểm giấy phép qua API và đã mở xem.
"""

CHAT_VAGUE = r"""
```html
<div style="max-width:40rem;margin:1.2rem auto;border:1px solid rgba(127,127,127,.28);border-radius:1rem;overflow:hidden;font-size:1rem;line-height:1.6">
  <div style="padding:.55rem 1rem;background:rgba(127,127,127,.10);font-size:.85rem;opacity:.85">Trợ lý AI · cuộc trò chuyện minh hoạ</div>
  <div style="padding:1rem;display:grid;gap:.8rem">
    <div style="justify-self:end;max-width:85%;background:rgba(59,130,246,.16);border-radius:1rem 1rem .25rem 1rem;padding:.6rem .9rem">
      Viết giúp mình về biến đổi khí hậu.
    </div>
    <div style="justify-self:start;max-width:90%;background:rgba(127,127,127,.12);border-radius:1rem 1rem 1rem .25rem;padding:.6rem .9rem">
      Biến đổi khí hậu là một trong những thách thức lớn nhất của nhân loại. Nhiệt độ toàn cầu đang tăng lên, gây ra
      nhiều hệ quả nghiêm trọng như mực nước biển dâng và thời tiết cực đoan. Mỗi người chúng ta cần chung tay hành
      động để bảo vệ hành tinh…
    </div>
  </div>
  <div style="padding:.6rem 1rem;border-top:1px dashed rgba(127,127,127,.35);font-size:.85rem;opacity:.85">
    Cuộc trò chuyện do người soạn bài dựng lại để minh hoạ. Câu trả lời không sai, nhưng chung chung tới mức không dùng được cho việc gì cụ thể.
  </div>
</div>
```
"""

PROMPT_TEMPLATE = r"""
```html
<div style="max-width:40rem;margin:1.2rem auto;border:2px solid rgba(59,130,246,.45);border-radius:1rem;overflow:hidden;font-size:1rem;line-height:1.65">
  <div style="padding:.55rem 1rem;background:rgba(59,130,246,.12);font-size:.9rem;font-weight:600">Mẫu câu lệnh khung · chép, thay phần trong ngoặc vuông và dùng ngay</div>
  <div style="padding:1rem 1.1rem;display:grid;gap:.55rem">
    <div><b style="color:rgb(37,99,235)">Bối cảnh:</b> Mình là [vai trò của bạn], đang [việc bạn đang làm].</div>
    <div><b style="color:rgb(13,148,136)">Mục đích và người đọc:</b> Câu trả lời sẽ được dùng để [mục đích], người đọc là [ai].</div>
    <div><b style="color:rgb(217,119,6)">Yêu cầu:</b> Hãy [việc cần AI làm], trình bày dưới dạng [định dạng], độ dài khoảng [độ dài].</div>
    <div><b style="color:rgb(219,39,119)">Minh bạch:</b> Hãy nêu rõ những giả định bạn đang dùng, đánh dấu phần nào bạn không chắc chắn, và với mỗi số liệu hãy cho mình nguồn có thể kiểm tra được. Nếu không biết, hãy nói là không biết.</div>
  </div>
</div>
```
"""

SOCRATES_IMG = (
    "![Tượng đầu Socrates bằng đá cẩm thạch trưng bày tại bảo tàng Louvre]"
    "(https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Socrates_Louvre.jpg/1280px-Socrates_Louvre.jpg "
    "\"Tượng đầu Socrates bằng đá cẩm thạch, tác phẩm La Mã thế kỷ thứ nhất, hiện trưng bày tại bảo tàng Louvre. "
    "Phương pháp đặt câu hỏi Socrates là đặt liên tiếp những câu hỏi buộc người trả lời làm rõ giả định và lý lẽ của "
    "mình. Hình: [File:Socrates Louvre.jpg](https://commons.wikimedia.org/wiki/File:Socrates_Louvre.jpg), "
    "ảnh của Eric Gaba, giấy phép CC BY-SA 2.5; bản thân tác phẩm điêu khắc La Mã thuộc phạm vi công cộng.\")"
)

MISCONCEPTIONS = [
    {
        "code": "aipb.b4.vague-prompt-ok",
        "name": "Nghĩ rằng câu hỏi ngắn gọn là đủ vì AI tự hiểu bối cảnh",
        "description": (
            "Đặt một câu hỏi rất ngắn rồi trông đợi AI tự đoán đúng người hỏi là ai, cần câu trả lời để làm gì và cho "
            "ai đọc. AI không biết những điều bạn không nói ra, nên nó lấp chỗ trống bằng câu trả lời chung chung nhất."
        ),
    },
    {
        "code": "aipb.b4.longer-is-better",
        "name": "Nghĩ rằng câu lệnh càng dài, càng nhiều lời thúc giục thì càng tốt",
        "description": (
            "Thêm thật nhiều chữ, lời khen hay lời thúc giục vào câu lệnh với hy vọng câu trả lời tốt hơn. Điều làm "
            "câu trả lời tốt hơn là thông tin liên quan, gồm bối cảnh, mục đích, người đọc và yêu cầu rõ ràng, chứ "
            "không phải độ dài của câu lệnh."
        ),
    },
    {
        "code": "aipb.b4.demand-certainty",
        "name": "Ép AI trả lời chắc chắn và cấm nói không biết",
        "description": (
            "Yêu cầu AI luôn đưa ra câu trả lời dứt khoát, không được nói không biết. Yêu cầu này đẩy AI về phía đoán "
            "cho có câu trả lời, trong khi điều bạn cần là biết phần nào nó không chắc để kiểm chứng phần đó."
        ),
    },
    {
        "code": "aipb.b4.stated-confidence-is-reliable",
        "name": "Tin rằng mức độ chắc chắn AI tự nêu là con số chính xác",
        "description": (
            "Coi câu như “mình chắc chắn 95%” của AI là xác suất đúng thật sự. Nghiên cứu cho thấy khi mô hình tự nói ra "
            "mức độ chắc chắn bằng lời, nó có xu hướng tự tin quá mức; con số ấy chỉ là tín hiệu tham khảo để biết nên "
            "kiểm chỗ nào trước."
        ),
    },
    {
        "code": "aipb.b4.prompt-replaces-checking",
        "name": "Nghĩ rằng câu lệnh tốt thì không cần kiểm chứng nữa",
        "description": (
            "Tin rằng một khi đã yêu cầu AI nêu nguồn và tự phản biện thì câu trả lời đã đáng tin. Câu lệnh tốt giúp "
            "câu trả lời dễ kiểm chứng hơn, nhưng việc kiểm chứng vẫn phải đi qua nguồn nằm ngoài cuộc trò chuyện."
        ),
    },
    {
        "code": "aipb.b4.ai-for-primary-lookup",
        "name": "Hỏi AI khi cần nguyên văn một văn bản chính thức",
        "description": (
            "Dùng AI để lấy nội dung chính xác của quy chế, văn bản pháp luật, lịch thi hay bảng giá hiện hành. Với loại "
            "thông tin này, nguồn gốc chính thức luôn nhanh và chắc hơn; AI chỉ nên giúp giải thích sau khi bạn đã có "
            "văn bản gốc."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "aipb.b4.vague-prompt-ok",
        "body": (
            "AI không biết bạn là ai, đang làm gì và cần câu trả lời cho ai đọc, trừ khi bạn nói ra. Hãy thử phép thử "
            "đồng nghiệp: đưa câu hỏi của bạn cho một người không biết gì về việc bạn đang làm. Nếu họ phải hỏi lại "
            "bạn nhiều điều, thì AI cũng đang thiếu đúng những điều đó."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b4.longer-is-better",
        "body": (
            "Độ dài không làm câu lệnh tốt hơn; thông tin liên quan mới làm được điều đó. Hãy rà lại câu lệnh và giữ "
            "những câu trả lời được bốn câu hỏi: bạn là ai và đang làm gì, câu trả lời dùng để làm gì, cần định dạng "
            "nào, và bạn muốn AI minh bạch điều gì."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b4.demand-certainty",
        "body": (
            "Cấm AI nói không biết không làm nó biết nhiều hơn; nó chỉ đoán nhiều hơn. Hãy làm ngược lại: cho phép, "
            "thậm chí yêu cầu AI đánh dấu phần nó không chắc chắn, vì đó chính là phần bạn cần kiểm chứng trước."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b4.stated-confidence-is-reliable",
        "body": (
            "Khi AI tự nói ra mức độ chắc chắn bằng lời, con số ấy thường cao hơn thực tế. Hãy dùng nó như một tín hiệu "
            "để sắp thứ tự kiểm chứng, chẳng hạn kiểm phần AI tự nhận là không chắc trước, chứ đừng dùng nó để thay "
            "cho việc kiểm chứng."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b4.prompt-replaces-checking",
        "body": (
            "Câu lệnh tốt làm câu trả lời dễ kiểm chứng hơn, chứ không làm nó đúng hơn một cách chắc chắn. Nguồn AI đưa "
            "ra vẫn có thể bịa, và lời tự phản biện vẫn đến từ cùng một mô hình. Hãy tiếp tục quy trình kiểm chứng bốn "
            "bước của bài 1 với những phần quan trọng."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b4.ai-for-primary-lookup",
        "body": (
            "Với văn bản chính thức như quy chế, luật, lịch thi hay bảng giá, nguồn gốc là trang của cơ quan ban hành. "
            "Hãy mở trang đó trước; khi đã có văn bản gốc, bạn có thể nhờ AI giải thích những đoạn khó hiểu."
        ),
        "priority": 10,
    },
]

LESSON = {
    "title": "Bài 4 · Hỏi AI để nhận câu trả lời kiểm chứng được",
    "durationMin": 20,
    "description": (
        "Bài học hướng dẫn cách viết câu lệnh cho AI sao cho câu trả lời vừa sát với nhu cầu vừa dễ kiểm chứng: đưa bối "
        "cảnh, nói rõ mục đích và người đọc, yêu cầu AI nêu giả định, mức độ chắc chắn và nguồn, bắt AI tự phản biện, "
        "và nhận biết khi nào nên tra nguồn gốc thay vì hỏi AI."
    ),
    "look": {"palette": "limio", "font": "modern"},
    "objectives": [
        "Viết lại được một câu hỏi mơ hồ thành một câu lệnh có bối cảnh, mục đích, người đọc và yêu cầu rõ ràng",
        "Yêu cầu được AI nêu giả định, đánh dấu phần không chắc chắn và đưa ra nguồn có thể kiểm tra",
        "Dùng được chuỗi câu hỏi tự phản biện để tìm điểm yếu trong câu trả lời của AI",
        "Phân biệt được tình huống nên hỏi AI với tình huống nên tra nguồn gốc chính thức",
    ],
    "body": CHAT_VAGUE
    + r"""
Câu trả lời trên không sai, nhưng gần như không dùng được. Nó không biết bạn cần một bài thuyết trình năm phút hay một đoạn mở bài cho bài luận, không biết người đọc là học sinh lớp 6 hay hội đồng chấm luận văn, và cũng không cho bạn bất kỳ số liệu nào có thể kiểm chứng. Nguyên nhân không nằm ở công cụ AI mà nằm ở câu hỏi. Một câu hỏi mơ hồ khiến AI lấp mọi chỗ trống bằng phương án chung chung nhất, và câu trả lời chung chung thì rất khó kiểm chứng.

:::Trước khi đọc tiếp, câu hỏi này còn thiếu những gì?
Hãy thử liệt kê những điều AI cần biết để trả lời tốt hơn. Có thể bạn đã nghĩ tới việc AI không biết bạn là ai, câu trả lời dùng để làm gì, người đọc là ai, và cần trình bày dưới dạng nào. Bài học này gọi những điều đó là các thành phần của một câu lệnh tốt, và bổ sung thêm một thành phần quan trọng nhất cho người học tư duy phản biện: yêu cầu AI minh bạch về giả định, mức độ chắc chắn và nguồn.
:::
""",
    "sections": [
        {
            "layout": "compare",
            "title": "Câu hỏi mơ hồ và câu lệnh rõ ràng (vague prompt và specific prompt)",
            "intro": (
                "Lời yêu cầu mà bạn gửi cho công cụ AI được gọi là **câu lệnh** (*prompt*). Hướng dẫn chính thức của "
                "Anthropic về cách viết câu lệnh khuyên người dùng hình dung AI như một người mới vào làm rất giỏi "
                "nhưng chưa biết gì về bối cảnh công việc của bạn: bạn giải thích càng chính xác điều mình cần thì kết "
                "quả càng tốt [1]. Hai cột dưới đây so sánh cùng một nhu cầu được diễn đạt theo hai cách."
            ),
            "parts": [
                {
                    "title": "Câu hỏi mơ hồ",
                    "md": (
                        "“Viết giúp mình về biến đổi khí hậu.”\n\n"
                        "Câu hỏi này không cho biết người hỏi là ai, câu trả lời dùng vào việc gì, ai sẽ đọc, cần dài "
                        "bao nhiêu và có cần số liệu hay không. Vì thiếu những thông tin đó, AI chọn cách viết an toàn "
                        "và chung chung nhất. Kết quả là một đoạn văn trơn tru nhưng không có điểm nào để kiểm chứng."
                    ),
                },
                {
                    "title": "Câu lệnh rõ ràng",
                    "md": (
                        "“Mình là sinh viên năm nhất, đang chuẩn bị bài thuyết trình năm phút cho môn Kỹ năng học tập. "
                        "Người nghe là các bạn cùng lớp. Hãy gợi ý ba ý chính về tác động của biến đổi khí hậu tới Đồng "
                        "bằng sông Cửu Long, mỗi ý kèm một số liệu và nguồn mình có thể mở ra kiểm tra. Ý nào bạn không "
                        "chắc chắn thì hãy ghi rõ.”\n\n"
                        "Câu lệnh này có bối cảnh, mục đích, người đọc, định dạng và yêu cầu minh bạch. Câu trả lời nhận "
                        "về sẽ sát nhu cầu hơn và, quan trọng hơn, có những điểm cụ thể để bạn kiểm chứng."
                    ),
                },
            ],
            "outro": (
                "> [!ghi-nho] Hướng dẫn của Anthropic đưa ra một phép thử đơn giản: hãy đưa câu lệnh của bạn cho một "
                "đồng nghiệp không biết gì về việc bạn đang làm. Nếu người đó thấy khó hiểu, AI cũng sẽ thấy khó hiểu "
                "[1]. Phép thử này gọi là **phép thử đồng nghiệp** và áp dụng được cho mọi câu lệnh."
            ),
        },
        {
            "layout": "cards",
            "title": "Bốn thành phần của một câu lệnh tốt",
            "intro": (
                "Một câu lệnh tốt không cần dài, nhưng cần có đủ những thông tin mà AI không thể tự đoán. Bốn thành phần "
                "dưới đây bao quát được phần lớn nhu cầu học tập và công việc hằng ngày."
            ),
            "parts": [
                {
                    "title": "Bối cảnh (context)",
                    "md": (
                        "Bạn cho AI biết mình là ai và đang làm việc gì. Hướng dẫn của Anthropic nhấn mạnh rằng việc giải "
                        "thích lý do đằng sau yêu cầu giúp AI hiểu mục tiêu của bạn và trả lời sát hơn [1]."
                    ),
                },
                {
                    "title": "Mục đích và người đọc (purpose và audience)",
                    "md": (
                        "Bạn nói rõ câu trả lời sẽ được dùng vào việc gì và ai sẽ đọc nó. Cùng một nội dung, lời giải "
                        "thích cho học sinh lớp 6 và cho hội đồng chấm luận văn phải khác nhau hoàn toàn."
                    ),
                },
                {
                    "title": "Yêu cầu và định dạng (task và format)",
                    "md": (
                        "Bạn nêu cụ thể việc AI cần làm, cách trình bày và độ dài mong muốn. Một yêu cầu như “ba ý chính, "
                        "mỗi ý không quá hai câu” dễ dùng hơn nhiều so với “viết về chủ đề này”."
                    ),
                },
                {
                    "title": "Yêu cầu minh bạch (transparency)",
                    "md": (
                        "Bạn yêu cầu AI nêu những **giả định** (*assumptions*) đang dùng, đánh dấu phần nó **không chắc "
                        "chắn** (*uncertainty*) và đưa ra **nguồn có thể kiểm chứng** (*verifiable sources*). Đây là thành "
                        "phần biến câu trả lời thành thứ bạn kiểm chứng được."
                    ),
                },
            ],
            "outro": (
                "Bạn có thể dùng ngay mẫu câu lệnh khung dưới đây cho hầu hết các nhu cầu. Mỗi dòng ứng với một thành "
                "phần, và phần trong ngoặc vuông là chỗ bạn điền thông tin của mình.\n"
                + PROMPT_TEMPLATE
                + "\n> [!canh-bao] Đừng yêu cầu AI “luôn trả lời chắc chắn, không được nói không biết”. Một nghiên cứu "
                "năm 2025 chỉ ra rằng chính cách huấn luyện và đánh giá thưởng cho việc đoán đã khiến mô hình hay bịa "
                "thay vì thừa nhận không biết [4]. Yêu cầu cấm nói không biết chỉ đẩy AI đoán nhiều hơn."
            ),
        },
        {
            "layout": "steps",
            "title": "Bắt AI tự phản biện (self-critique)",
            "intro": (
                "Sau khi nhận câu trả lời, bạn có thể đặt thêm một chuỗi câu hỏi để AI tự tìm điểm yếu trong chính câu "
                "trả lời của nó. Cách làm này gợi nhớ tới **phương pháp đặt câu hỏi Socrates** (*Socratic questioning*), "
                "trong đó người hỏi liên tục yêu cầu làm rõ giả định và lý lẽ thay vì chấp nhận ngay kết luận.\n\n"
                + SOCRATES_IMG
            ),
            "parts": [
                {
                    "title": "Hỏi về giả định",
                    "md": (
                        "Bạn hỏi: “Câu trả lời của bạn đang dựa trên những giả định nào? Giả định nào trong đó dễ sai "
                        "nhất?” Câu hỏi này thường làm lộ ra những điều AI ngầm cho là đúng mà bạn chưa hề nói."
                    ),
                },
                {
                    "title": "Hỏi lập luận phản bác (counterargument)",
                    "md": (
                        "Bạn hỏi: “Một người không đồng ý với kết luận này sẽ phản bác như thế nào?” Lập luận phản bác "
                        "giúp bạn thấy câu trả lời ban đầu đang bỏ qua điều gì."
                    ),
                },
                {
                    "title": "Hỏi cách giải thích khác (alternative explanation)",
                    "md": (
                        "Bạn hỏi: “Còn cách giải thích nào khác cho cùng hiện tượng này không?” Khi có từ hai cách giải "
                        "thích trở lên, bạn buộc phải so sánh bằng chứng thay vì nhận ngay cách đầu tiên."
                    ),
                },
                {
                    "title": "Hỏi điều gì sẽ làm kết luận thay đổi",
                    "md": (
                        "Bạn hỏi: “Bằng chứng nào, nếu có, sẽ khiến kết luận này sai?” Câu trả lời cho bạn biết chính xác "
                        "cần tìm gì khi đi kiểm chứng."
                    ),
                },
            ],
            "outro": (
                "> [!canh-bao] Lời tự phản biện vẫn đến từ cùng một mô hình, nên nó giúp bạn biết cần kiểm chứng điều "
                "gì chứ không thay thế được việc kiểm chứng. Như bài 1 đã chỉ ra, kiểm chứng luôn cần một nguồn nằm "
                "ngoài cuộc trò chuyện."
            ),
        },
        {
            "layout": "text",
            "title": "Mức độ chắc chắn mà AI tự nêu có đáng tin không (calibration)",
            "intro": (
                "Khi bạn yêu cầu AI đánh dấu phần không chắc chắn, một câu hỏi tự nhiên nảy sinh: mức độ chắc chắn mà AI "
                "tự nêu có phản ánh đúng khả năng câu trả lời là đúng hay không? Mức độ khớp giữa độ tự tin và độ chính "
                "xác thực tế được gọi là **độ hiệu chỉnh** (*calibration*)."
            ),
            "parts": [
                {
                    "md": (
                        "Các nghiên cứu cho thấy bức tranh khá phức tạp. Nhóm nghiên cứu của Kadavath (2022) ghi nhận rằng "
                        "các mô hình lớn được hiệu chỉnh khá tốt trên câu hỏi trắc nghiệm và đúng sai khi được hỏi theo "
                        "định dạng phù hợp [2]. Tuy nhiên, nghiên cứu của Xiong và cộng sự công bố tại hội nghị ICLR 2024 "
                        "cho thấy khi mô hình tự nói ra mức độ chắc chắn bằng lời, chẳng hạn “mình chắc chắn 90%”, nó có "
                        "xu hướng **tự tin quá mức** (*overconfident*) [3].\n\n"
                        "Từ đó có thể rút ra một cách dùng hợp lý. Mức độ chắc chắn mà AI tự nêu là một tín hiệu hữu ích "
                        "để sắp xếp thứ tự kiểm chứng: phần AI tự nhận là không chắc nên được kiểm trước. Ngược lại, phần "
                        "AI nói là rất chắc chắn vẫn chưa được miễn kiểm chứng, nhất là khi đó là số liệu, trích dẫn hay "
                        "sự việc mới xảy ra."
                    ),
                },
            ],
        },
        {
            "layout": "compare",
            "title": "Khi nào nên hỏi AI, khi nào nên tra nguồn gốc",
            "intro": (
                "Câu lệnh tốt giúp bạn khai thác AI hiệu quả hơn, nhưng có những nhu cầu mà hỏi AI không phải là cách "
                "nhanh nhất hay chắc chắn nhất. Hai cột dưới đây giúp bạn chọn đúng công cụ ngay từ đầu."
            ),
            "parts": [
                {
                    "title": "Nên hỏi AI khi bạn cần",
                    "md": (
                        "- Một lời giải thích khái niệm theo nhiều cách hoặc kèm ví dụ đời thường.\n"
                        "- Một dàn ý, một bản nháp hay gợi ý cách sắp xếp ý.\n"
                        "- Câu hỏi ôn tập hoặc lập luận phản bác cho bài làm của chính bạn.\n"
                        "- Một bản tóm tắt tài liệu mà bạn đã có trong tay và sẽ đối chiếu lại.\n\n"
                        "Trong những trường hợp này, bạn tự đánh giá được kết quả hoặc có sẵn tài liệu gốc để đối chiếu."
                    ),
                },
                {
                    "title": "Nên tra nguồn gốc khi bạn cần",
                    "md": (
                        "- Nguyên văn một quy chế, văn bản pháp luật hay hợp đồng.\n"
                        "- Lịch thi, hạn nộp, bảng giá hay thông báo đang có hiệu lực.\n"
                        "- Số liệu thống kê chính thức để đưa vào bài làm.\n"
                        "- Tin tức về sự việc vừa xảy ra.\n\n"
                        "Với những nhu cầu này, trang của cơ quan ban hành hoặc **nguồn gốc** (*primary source*) vừa "
                        "nhanh hơn vừa chắc chắn hơn; AI chỉ nên giúp giải thích sau khi bạn đã có văn bản gốc."
                    ),
                },
            ],
        },
        {
            "layout": "faq",
            "title": "Câu hỏi thường gặp",
            "parts": [
                {
                    "title": "Có cần viết câu lệnh dài mỗi lần hỏi AI không?",
                    "md": (
                        "Không. Với câu hỏi đơn giản, một câu ngắn là đủ. Bạn chỉ cần đầu tư vào câu lệnh khi câu trả lời "
                        "sẽ được dùng cho việc quan trọng, chẳng hạn bài làm được chấm điểm hay một quyết định. Khi đó, "
                        "điều cần thêm là thông tin liên quan chứ không phải số chữ."
                    ),
                },
                {
                    "title": "Yêu cầu AI đưa nguồn có làm nó bớt bịa không?",
                    "md": (
                        "Yêu cầu này giúp bạn có điểm để kiểm chứng, nhưng không ngăn được AI bịa nguồn. Vì vậy, bạn vẫn "
                        "phải tự mở từng nguồn và đối chiếu đúng nội dung được trích như đã học ở bài 1."
                    ),
                },
                {
                    "title": "Nếu AI nói rằng nó không biết thì sao?",
                    "md": (
                        "Đó là một câu trả lời có giá trị. Nó cho bạn biết cần chuyển sang tra nguồn gốc, thay vì nhận về "
                        "một câu trả lời nghe chắc chắn nhưng có thể là đoán."
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
                        "1. Anthropic. Prompting best practices: Be clear and direct; Add context to improve performance. "
                        "Tài liệu hướng dẫn chính thức cho nhà phát triển, truy cập ngày 24/10/2026. "
                        "[Xem hướng dẫn](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)\n"
                        "2. Kadavath, S., Conerly, T., Askell, A., và cộng sự (2022). Language models (mostly) know what "
                        "they know. *arXiv:2207.05221*. [Xem bài báo](https://arxiv.org/abs/2207.05221)\n"
                        "3. Xiong, M., Hu, Z., Lu, X., và cộng sự (2024). Can LLMs express their uncertainty? An empirical "
                        "evaluation of confidence elicitation in LLMs. *ICLR 2024*. "
                        "[Xem bài báo](https://arxiv.org/abs/2306.13063)\n"
                        "4. Kalai, A. T., Nachum, O., Vempala, S. S., và Zhang, E. (2025). Why language models "
                        "hallucinate. *arXiv:2509.04664*. [Xem bài báo](https://arxiv.org/abs/2509.04664)"
                    ),
                },
            ],
        },
    ],
    "flashcards": {
        "title": "Thẻ ghi nhớ · Bài 4",
        "items": [
            {
                "term": "Câu lệnh (prompt)",
                "meaning": "Câu lệnh là lời yêu cầu mà người dùng gửi cho công cụ AI; chất lượng câu trả lời phụ thuộc nhiều vào việc câu lệnh có đủ thông tin cần thiết hay không.",
            },
            {
                "term": "Bối cảnh (context)",
                "meaning": "Bối cảnh là thông tin về việc bạn là ai, đang làm gì và vì sao cần câu trả lời; AI không thể tự đoán những điều này nếu bạn không nói ra.",
            },
            {
                "term": "Phép thử đồng nghiệp (colleague test)",
                "meaning": "Phép thử đồng nghiệp là việc hình dung đưa câu lệnh cho một người không biết gì về công việc của bạn; nếu người đó thấy khó hiểu thì AI cũng sẽ thấy khó hiểu.",
            },
            {
                "term": "Tự phản biện (self-critique)",
                "meaning": "Tự phản biện là việc yêu cầu AI chỉ ra giả định, lập luận phản bác và điểm yếu trong chính câu trả lời của nó, để biết cần kiểm chứng điều gì.",
                "example": "Một người không đồng ý với kết luận này sẽ phản bác như thế nào?",
            },
            {
                "term": "Độ hiệu chỉnh (calibration)",
                "meaning": "Độ hiệu chỉnh là mức độ khớp giữa độ tự tin mà mô hình thể hiện và độ chính xác thực tế của nó; khi tự nói ra mức chắc chắn bằng lời, mô hình thường tự tin quá mức.",
            },
            {
                "term": "Nguồn gốc (primary source)",
                "meaning": "Nguồn gốc là văn bản hoặc dữ liệu do chính cơ quan, tác giả ban hành; với quy chế, lịch thi hay số liệu chính thức, tra nguồn gốc nhanh và chắc hơn hỏi AI.",
            },
        ],
    },
    "summary": [
        "Câu hỏi mơ hồ khiến AI lấp chỗ trống bằng câu trả lời chung chung, vốn vừa ít hữu ích vừa khó kiểm chứng.",
        "Một câu lệnh tốt có bốn thành phần: bối cảnh, mục đích và người đọc, yêu cầu và định dạng, và yêu cầu minh bạch về giả định, mức độ chắc chắn và nguồn.",
        "Chuỗi câu hỏi tự phản biện giúp bạn biết cần kiểm chứng điều gì, nhưng không thay thế được việc kiểm chứng bằng nguồn bên ngoài.",
        "Mức độ chắc chắn mà AI tự nêu chỉ là tín hiệu tham khảo, và với văn bản chính thức hay số liệu cần trích dẫn, tra nguồn gốc luôn là lựa chọn đầu tiên.",
    ],
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4",
        "passThresholdPct": 60,
        "requireConfidence": True,
        "questions": [
            {
                "key": "4.1-chon-cau-lenh",
                "type": "mcq",
                "prompt": (
                    "Bạn cần chuẩn bị đoạn mở đầu cho bài thuyết trình về rác thải nhựa trước lớp. Câu lệnh nào dưới đây "
                    "giúp bạn nhận được câu trả lời vừa sát nhu cầu vừa dễ kiểm chứng nhất?"
                ),
                "explanation": (
                    "Câu lệnh tốt nhất có đủ bối cảnh, mục đích, người nghe, định dạng và yêu cầu minh bạch về nguồn. Những "
                    "câu lệnh còn lại hoặc thiếu thông tin, hoặc thêm chữ không liên quan, hoặc ép AI trả lời chắc chắn."
                ),
                "points": 2,
                "options": [
                    {"label": "“Viết về rác thải nhựa.”", "isCorrect": False, "misconception": "aipb.b4.vague-prompt-ok"},
                    {
                        "label": (
                            "“Mình là sinh viên năm hai, cần đoạn mở đầu khoảng một phút cho bài thuyết trình trước lớp về rác "
                            "thải nhựa. Hãy gợi ý hai cách mở đầu, mỗi cách kèm một số liệu và nguồn mình có thể kiểm tra.”"
                        ),
                        "isCorrect": True,
                    },
                    {
                        "label": "“Bạn là trợ lý tuyệt vời nhất. Hãy cố gắng hết sức, thật hay, thật hay, viết thật dài về rác thải nhựa.”",
                        "isCorrect": False,
                        "misconception": "aipb.b4.longer-is-better",
                    },
                    {
                        "label": "“Viết đoạn mở đầu về rác thải nhựa, luôn trả lời chắc chắn và tuyệt đối không được nói không biết.”",
                        "isCorrect": False,
                        "misconception": "aipb.b4.demand-certainty",
                    },
                ],
            },
            {
                "key": "4.2-thanh-phan",
                "type": "mcq",
                "prompt": (
                    "Những nội dung nào dưới đây là thành phần nên có trong một câu lệnh tốt khi bạn cần câu trả lời để "
                    "dùng cho bài làm? Hãy chọn tất cả phương án đúng."
                ),
                "explanation": (
                    "Bối cảnh, mục đích và người đọc, cùng yêu cầu minh bạch về giả định và nguồn là các thành phần của câu "
                    "lệnh tốt. Lời khen dài và yêu cầu cấm nói không biết không giúp câu trả lời tốt hơn."
                ),
                "points": 2,
                "options": [
                    {"label": "Cho biết bạn là ai và đang làm việc gì.", "isCorrect": True},
                    {"label": "Thêm nhiều lời khen và lời thúc giục để AI cố gắng hơn.", "isCorrect": False, "misconception": "aipb.b4.longer-is-better"},
                    {"label": "Nói rõ câu trả lời dùng để làm gì và ai sẽ đọc.", "isCorrect": True},
                    {"label": "Yêu cầu AI tuyệt đối không được nói rằng nó không biết.", "isCorrect": False, "misconception": "aipb.b4.demand-certainty"},
                    {"label": "Yêu cầu AI nêu giả định và đưa nguồn có thể kiểm tra.", "isCorrect": True},
                ],
            },
            {
                "key": "4.3-muc-chac-chan",
                "type": "true_false",
                "prompt": (
                    "Khi AI viết “mình chắc chắn 95% về số liệu này”, bạn có thể hiểu rằng số liệu đó có 95% khả năng là đúng."
                ),
                "explanation": (
                    "Nhận định này sai. Nghiên cứu của Xiong và cộng sự cho thấy khi mô hình tự nói ra mức độ chắc chắn bằng "
                    "lời, nó có xu hướng tự tin quá mức; con số ấy chỉ nên dùng để sắp thứ tự kiểm chứng."
                ),
                "points": 1,
                "options": [
                    {"label": "Sai", "isCorrect": True},
                    {"label": "Đúng", "isCorrect": False, "misconception": "aipb.b4.stated-confidence-is-reliable"},
                ],
            },
            {
                "key": "4.4-keo-tha-thanh-phan",
                "type": "drag_drop_fill",
                "prompt": (
                    "Hãy kéo các cụm từ vào đúng chỗ trống. Một câu lệnh tốt cho AI biết [[1]], nói rõ [[2]], nêu cụ thể "
                    "yêu cầu và định dạng, và đề nghị AI [[3]]."
                ),
                "explanation": (
                    "Bối cảnh cho AI biết bạn là ai và đang làm gì; mục đích và người đọc cho biết câu trả lời dùng vào việc "
                    "gì; yêu cầu minh bạch đề nghị AI nêu giả định và nguồn để bạn kiểm chứng."
                ),
                "points": 2,
                "tokens": [
                    {"label": "càng dài càng tốt"},
                    {"label": "câu trả lời dùng để làm gì và ai sẽ đọc", "blank": 2},
                    {"label": "nêu giả định và nguồn có thể kiểm tra", "blank": 3},
                    {"label": "luôn trả lời chắc chắn"},
                    {"label": "bạn là ai và đang làm gì", "blank": 1},
                ],
            },
            {
                "key": "4.5-ghep-tinh-huong",
                "type": "matching",
                "prompt": "Hãy ghép mỗi nhu cầu với cách làm phù hợp nhất.",
                "explanation": (
                    "Nguyên văn quy chế cần lấy từ trang chính thức; muốn hiểu khái niệm thì nhờ AI giải thích rồi đối chiếu "
                    "giáo trình; muốn tìm điểm yếu trong bài làm thì nhờ AI nêu lập luận phản bác."
                ),
                "points": 3,
                "pairs": [
                    {"left": "Cần nguyên văn quy chế thi của trường.", "right": "Mở trang chính thức của trường để đọc văn bản gốc."},
                    {"left": "Muốn hiểu khái niệm lạm phát qua ví dụ đời thường.", "right": "Nhờ AI giải thích kèm ví dụ, rồi đối chiếu với giáo trình."},
                    {"left": "Muốn biết bài luận của mình còn điểm yếu nào.", "right": "Nhờ AI nêu lập luận phản bác cho từng ý chính."},
                ],
            },
            {
                "key": "4.6-thu-tu-tu-phan-bien",
                "type": "ordering",
                "prompt": "Hãy sắp xếp chuỗi câu hỏi tự phản biện theo thứ tự được giới thiệu trong bài.",
                "explanation": (
                    "Bạn hỏi về giả định trước, sau đó hỏi lập luận phản bác, rồi hỏi cách giải thích khác, và cuối cùng hỏi "
                    "điều gì sẽ làm kết luận thay đổi để biết cần tìm gì khi kiểm chứng."
                ),
                "points": 2,
                "sequence": [
                    "Hỏi câu trả lời đang dựa trên những giả định nào.",
                    "Hỏi một người không đồng ý sẽ phản bác như thế nào.",
                    "Hỏi còn cách giải thích nào khác cho cùng hiện tượng.",
                    "Hỏi bằng chứng nào sẽ khiến kết luận này sai.",
                ],
            },
            {
                "key": "4.7-ten-ky-thuat",
                "type": "fill_in",
                "prompt": (
                    "Việc yêu cầu AI chỉ ra giả định, lập luận phản bác và điểm yếu trong chính câu trả lời của nó được gọi "
                    "là tự ______ (tiếng Anh: self-critique). Hãy điền hai chữ còn thiếu."
                ),
                "explanation": "Kỹ thuật này được gọi là tự phản biện (tiếng Anh: self-critique).",
                "points": 1,
                "answers": ["phản biện", "phan bien"],
            },
        ],
    },
    "lecture": [
        {
            "anchor": "mo-dau",
            "text": (
                "Chào bạn, mình bắt đầu bài bốn, cũng là bài đầu tiên của module hai, nơi chúng ta chuyển từ việc đọc thông "
                "tin sang việc làm việc cùng AI. Bạn hãy nhìn vào khung trò chuyện ở đầu trang. Người dùng gõ một câu rất "
                "ngắn: viết giúp mình về biến đổi khí hậu. Và AI trả lời bằng một đoạn văn trơn tru, không có gì sai, nhưng "
                "cũng không dùng được vào việc gì cụ thể. Nó không biết người hỏi cần thuyết trình năm phút hay viết mở bài "
                "cho bài luận, không biết ai sẽ đọc, và không đưa ra con số nào để kiểm chứng. Mình muốn bạn để ý rằng lỗi ở "
                "đây không nằm ở công cụ, mà nằm ở câu hỏi. Khi câu hỏi mơ hồ, AI sẽ lấp mọi chỗ trống bằng phương án chung "
                "chung nhất. Ngay dưới khung trò chuyện có một hộp nhỏ hỏi bạn câu hỏi này còn thiếu những gì. Bạn hãy dừng "
                "lại khoảng nửa phút, tự liệt kê những điều AI cần biết, rồi mới mở hộp ra xem. Khi bạn đã sẵn sàng, mình "
                "đi tiếp."
            ),
        },
        {
            "anchor": "Câu hỏi mơ hồ và câu lệnh rõ ràng (vague prompt và specific prompt)",
            "text": (
                "Lời yêu cầu bạn gửi cho AI có tên gọi là câu lệnh, tiếng Anh là prompt. Hướng dẫn chính thức của Anthropic "
                "đưa ra một hình ảnh mình rất thích: hãy coi AI như một người mới vào làm, rất giỏi, nhưng chưa biết gì về "
                "công việc của bạn. Bạn giải thích càng rõ thì người ấy làm càng tốt. Trên màn hình bây giờ là hai cột. Cột "
                "bên trái là câu hỏi mơ hồ mà bạn vừa thấy. Cột bên phải là cùng nhu cầu ấy nhưng được viết lại: người hỏi là "
                "sinh viên năm nhất, cần bài thuyết trình năm phút, người nghe là bạn cùng lớp, cần ba ý chính về Đồng bằng "
                "sông Cửu Long, mỗi ý có số liệu và nguồn, và ý nào AI không chắc thì phải ghi rõ. Bạn thấy đấy, câu lệnh bên "
                "phải không cầu kỳ, nó chỉ đủ thông tin. Và điều quan trọng nhất với người học tư duy phản biện là câu trả "
                "lời nhận về sẽ có những điểm cụ thể để kiểm chứng. Trong hộp ghi nhớ bên dưới có một phép thử đơn giản gọi "
                "là phép thử đồng nghiệp. Trước khi gửi câu lệnh, bạn hãy hình dung đưa nó cho một người không biết gì về việc "
                "bạn đang làm. Nếu người đó phải hỏi lại bạn nhiều điều, thì AI cũng đang thiếu đúng những điều đó."
            ),
        },
        {
            "anchor": "Bốn thành phần của một câu lệnh tốt",
            "text": (
                "Bây giờ mình gom những gì vừa thấy thành bốn thành phần, tương ứng với bốn thẻ trên màn hình. Thẻ thứ nhất "
                "là bối cảnh: bạn là ai và đang làm việc gì. Thẻ thứ hai là mục đích và người đọc, vì cùng một nội dung, lời "
                "giải thích cho học sinh lớp sáu khác hẳn lời giải thích cho hội đồng chấm luận văn. Thẻ thứ ba là yêu cầu và "
                "định dạng, ví dụ ba ý chính, mỗi ý không quá hai câu. Thẻ thứ tư là phần mình muốn bạn nhớ nhất: yêu cầu minh "
                "bạch. Bạn đề nghị AI nêu những giả định nó đang dùng, đánh dấu phần nó không chắc chắn, và đưa nguồn mà bạn "
                "có thể mở ra kiểm tra. Ngay bên dưới là một mẫu câu lệnh khung với bốn dòng màu, mỗi dòng là một thành phần. "
                "Bạn có thể chép nguyên mẫu này, thay phần trong ngoặc vuông bằng thông tin của mình và dùng ngay. Mình lưu ý "
                "thêm một bẫy rất phổ biến trong hộp cảnh báo. Nhiều người viết vào câu lệnh rằng AI phải luôn trả lời chắc "
                "chắn và không được nói không biết. Một nghiên cứu năm hai nghìn không trăm hai mươi lăm chỉ ra rằng chính việc "
                "thưởng cho đoán đã khiến mô hình hay bịa. Vậy nên cấm nói không biết chỉ khiến AI đoán nhiều hơn mà thôi."
            ),
        },
        {
            "anchor": "Bắt AI tự phản biện (self-critique)",
            "text": (
                "Phần tiếp theo là một kỹ thuật bạn dùng sau khi đã nhận câu trả lời, gọi là tự phản biện, tiếng Anh là self "
                "critique. Bức ảnh trên màn hình là tượng đầu Socrates ở bảo tàng Louvre. Mình đặt ông ở đây vì phương pháp "
                "đặt câu hỏi Socrates chính là tinh thần của kỹ thuật này: thay vì chấp nhận ngay một kết luận, ta liên tục "
                "hỏi để làm rõ giả định và lý lẽ. Có bốn câu hỏi, đi theo các bước có đánh số. Bước một, bạn hỏi câu trả lời "
                "đang dựa trên những giả định nào và giả định nào dễ sai nhất. Bước hai, bạn hỏi một người không đồng ý sẽ phản "
                "bác ra sao. Bước ba, bạn hỏi còn cách giải thích nào khác cho cùng hiện tượng không. Bước bốn, bạn hỏi bằng "
                "chứng nào sẽ khiến kết luận này sai. Câu hỏi cuối rất đáng giá, vì nó cho bạn biết chính xác cần tìm gì khi đi "
                "kiểm chứng. Nhưng bạn nhớ cho mình hộp cảnh báo ở cuối mục này: lời tự phản biện vẫn đến từ cùng một mô hình. "
                "Nó giúp bạn biết cần kiểm chứng điều gì, chứ không thay cho việc kiểm chứng bằng một nguồn bên ngoài như "
                "chúng ta đã học ở bài một."
            ),
        },
        {
            "anchor": "Mức độ chắc chắn mà AI tự nêu có đáng tin không (calibration)",
            "text": (
                "Khi bạn đã yêu cầu AI đánh dấu phần không chắc chắn, một câu hỏi tự nhiên xuất hiện: con số chắc chắn mà AI "
                "tự nói ra có đáng tin không? Mức độ khớp giữa độ tự tin và độ chính xác thực tế được gọi là độ hiệu chỉnh, "
                "tiếng Anh là calibration. Câu trả lời từ nghiên cứu khá thú vị. Một nhóm nghiên cứu năm hai nghìn không trăm "
                "hai mươi hai ghi nhận rằng các mô hình lớn được hiệu chỉnh khá tốt trên câu hỏi trắc nghiệm, khi được hỏi theo "
                "đúng định dạng. Nhưng một nghiên cứu khác công bố năm hai nghìn không trăm hai mươi tư lại cho thấy, khi mô hình "
                "tự nói bằng lời rằng nó chắc chắn chín mươi phần trăm, nó thường tự tin quá mức. Vậy mình dùng con số ấy thế "
                "nào cho hợp lý? Mình dùng nó để sắp thứ tự: phần AI tự nhận là không chắc thì kiểm trước. Còn phần AI nói rất "
                "chắc chắn thì vẫn chưa được miễn kiểm chứng, nhất là khi đó là số liệu, trích dẫn hay chuyện mới xảy ra."
            ),
        },
        {
            "anchor": "Khi nào nên hỏi AI, khi nào nên tra nguồn gốc",
            "text": (
                "Câu lệnh tốt giúp bạn dùng AI hiệu quả hơn, nhưng có những việc mà hỏi AI không phải là đường ngắn nhất. Hai "
                "cột trên màn hình chia rõ hai nhóm. Bên trái là những lúc nên hỏi AI: khi bạn cần giải thích một khái niệm theo "
                "nhiều cách, cần dàn ý hay bản nháp, cần câu hỏi ôn tập hoặc lập luận phản bác cho bài của chính mình, hay cần "
                "tóm tắt một tài liệu bạn đang có trong tay. Điểm chung là bạn tự đánh giá được kết quả, hoặc có sẵn tài liệu gốc "
                "để đối chiếu. Bên phải là những lúc nên tra nguồn gốc: nguyên văn quy chế hay văn bản pháp luật, lịch thi, hạn "
                "nộp, bảng giá, số liệu thống kê chính thức và tin tức vừa xảy ra. Với những nhu cầu này, mở thẳng trang của cơ "
                "quan ban hành vừa nhanh hơn vừa chắc hơn. Sau khi đã có văn bản gốc, bạn hoàn toàn có thể nhờ AI giải thích "
                "những đoạn khó hiểu."
            ),
        },
        {
            "anchor": "Câu hỏi thường gặp",
            "text": (
                "Trước khi tổng kết, mình trả lời nhanh ba câu hỏi hay gặp. Thứ nhất, bạn không cần viết câu lệnh dài mỗi lần hỏi. "
                "Câu hỏi đơn giản thì một câu ngắn là đủ; chỉ khi câu trả lời dùng cho việc quan trọng thì bạn mới đầu tư thêm, "
                "và cái cần thêm là thông tin chứ không phải số chữ. Thứ hai, yêu cầu AI đưa nguồn giúp bạn có điểm để kiểm, "
                "nhưng không ngăn được AI bịa nguồn, nên bạn vẫn phải tự mở từng nguồn. Thứ ba, nếu AI trả lời rằng nó không biết, "
                "đó là một câu trả lời có giá trị, vì nó báo cho bạn biết đã đến lúc chuyển sang tra nguồn gốc."
            ),
        },
        {
            "anchor": "tong-ket",
            "text": (
                "Mình tóm lại bài hôm nay bằng bốn ý. Một, câu hỏi mơ hồ dẫn tới câu trả lời chung chung, vừa ít hữu ích vừa khó "
                "kiểm chứng. Hai, câu lệnh tốt có bốn thành phần: bối cảnh, mục đích và người đọc, yêu cầu và định dạng, và yêu "
                "cầu minh bạch về giả định, mức độ chắc chắn và nguồn. Ba, chuỗi câu hỏi tự phản biện cho bạn biết cần kiểm chứng "
                "điều gì, nhưng không thay được việc kiểm chứng. Bốn, mức độ chắc chắn AI tự nêu chỉ là tín hiệu tham khảo, và với "
                "văn bản chính thức thì tra nguồn gốc luôn đi trước. Bạn hãy thử ngay mẫu câu lệnh khung với một bài tập bạn đang "
                "làm, rồi làm bài kiểm tra nhanh bảy câu ở cuối bài. Hẹn gặp bạn ở bài năm, nơi chúng ta nói về thiên kiến của AI "
                "và của chính mình."
            ),
        },
    ],
    "podcast": {
        "title": "Podcast · Hỏi sao cho AI trả lời được việc",
        "durationMin": 6,
        "hosts": {"A": "Khoa", "B": "Linh"},
        "turns": [
            {"speaker": "A", "text": "Xin chào các bạn, mình là Khoa, và đây là podcast của khoá Tư duy phản biện thời AI. Hôm nay mình ngồi cùng Linh để nói về bài bốn: làm sao hỏi AI để nhận được câu trả lời dùng được và kiểm chứng được."},
            {"speaker": "B", "text": "Chào Khoa, chào các bạn. Mình phải thú nhận là trước đây mình hỏi AI kiểu rất ngắn, ví dụ viết giúp mình về biến đổi khí hậu, rồi thấy câu trả lời nhạt nhẽo là mình đổ cho AI kém."},
            {"speaker": "A", "text": "Rất nhiều người như vậy. Nhưng thử nghĩ thế này: nếu Linh nhờ một bạn cùng lớp viết giúp về biến đổi khí hậu mà không nói gì thêm, bạn ấy sẽ hỏi lại gì?"},
            {"speaker": "B", "text": "Chắc là hỏi viết để làm gì, dài bao nhiêu, cho ai đọc. Thuyết trình hay viết bài luận, nộp cho thầy hay đăng mạng xã hội."},
            {"speaker": "A", "text": "Đúng vậy. AI cũng cần đúng những thông tin đó, chỉ khác là nó không hỏi lại mà tự đoán, và nó đoán theo hướng chung chung nhất. Hướng dẫn của Anthropic có một hình ảnh rất hay: hãy coi AI như một nhân viên mới rất giỏi nhưng chưa biết gì về công việc của bạn."},
            {"speaker": "B", "text": "Vậy một câu lệnh tốt cần có những gì? Các bạn nghe podcast chắc cũng muốn một công thức dễ nhớ."},
            {"speaker": "A", "text": "Bài học gom lại thành bốn thành phần. Thứ nhất là bối cảnh: mình là ai, đang làm gì. Thứ hai là mục đích và người đọc. Thứ ba là yêu cầu và định dạng, ví dụ ba ý chính, mỗi ý hai câu. Và thứ tư, quan trọng nhất với khoá này, là yêu cầu minh bạch."},
            {"speaker": "B", "text": "Minh bạch nghĩa là sao? Nghe hơi trừu tượng."},
            {"speaker": "A", "text": "Nghĩa là mình đề nghị AI nói rõ nó đang giả định điều gì, phần nào nó không chắc, và mỗi số liệu thì kèm nguồn mình có thể mở ra kiểm tra. Có thành phần này thì câu trả lời không còn là một khối văn trơn tru nữa, mà có những điểm cụ thể để mình đi kiểm."},
            {"speaker": "B", "text": "Mình từng thấy có người viết vào câu lệnh rằng AI phải luôn trả lời chắc chắn, không được nói không biết. Nghe thì có vẻ nghiêm khắc, hiệu quả lắm."},
            {"speaker": "A", "text": "Đó lại là một cái bẫy. Một nghiên cứu năm hai nghìn không trăm hai mươi lăm chỉ ra rằng mô hình hay bịa một phần vì cách huấn luyện thưởng cho việc đoán hơn là thừa nhận không biết. Cấm nói không biết thì nó chỉ đoán nhiều hơn. Mình muốn điều ngược lại: biết chỗ nào nó không chắc để kiểm chỗ đó trước."},
            {"speaker": "B", "text": "À, hợp lý. Thế còn chuyện AI tự nói mình chắc chắn chín mươi lăm phần trăm thì sao, mình có tin con số đó được không?"},
            {"speaker": "A", "text": "Câu hỏi hay. Các nghiên cứu cho thấy khi mô hình tự nói ra mức chắc chắn bằng lời, nó thường tự tin quá mức. Nên con số đó chỉ dùng để sắp thứ tự kiểm chứng, chứ không phải xác suất đúng thật."},
            {"speaker": "B", "text": "Bài học còn có phần tự phản biện nữa, đúng không? Mình thấy có cả ảnh tượng Socrates."},
            {"speaker": "A", "text": "Đúng rồi. Sau khi có câu trả lời, mình hỏi tiếp bốn câu: câu trả lời dựa trên giả định nào, người không đồng ý sẽ phản bác ra sao, còn cách giải thích nào khác, và bằng chứng nào sẽ khiến kết luận sai. Đó là tinh thần đặt câu hỏi của Socrates."},
            {"speaker": "B", "text": "Nhưng hỏi AI tự phản biện thì vẫn là hỏi AI mà, có khác gì tự nó khen nó không?"},
            {"speaker": "A", "text": "Linh nói trúng điểm quan trọng. Tự phản biện giúp mình biết cần kiểm chứng điều gì, chứ không thay cho việc kiểm chứng. Nguồn để kiểm vẫn phải nằm ngoài cuộc trò chuyện, như bài một đã dạy."},
            {"speaker": "B", "text": "Cho mình thử một ví dụ thật nhé. Tuần sau mình thi môn Kinh tế vi mô. Nếu áp dụng bốn thành phần thì mình sẽ viết thế nào?"},
            {"speaker": "A", "text": "Linh có thể viết: mình là sinh viên năm nhất, tuần sau thi giữa kỳ Kinh tế vi mô, đang chưa vững phần độ co giãn của cầu. Hãy giải thích khái niệm này bằng hai ví dụ đời thường, rồi cho mình năm câu hỏi tự kiểm tra có đáp án. Phần nào bạn không chắc thì ghi rõ để mình đối chiếu với giáo trình."},
            {"speaker": "B", "text": "Nghe đơn giản mà khác hẳn câu giải thích độ co giãn của cầu mình hay gõ. Có bối cảnh, có mục đích, có định dạng, lại có chỗ để đối chiếu với giáo trình."},
            {"speaker": "A", "text": "Và điều hay là Linh không cần câu lệnh dài. Câu hỏi đơn giản thì một câu ngắn là đủ; chỉ khi câu trả lời dùng cho việc quan trọng như ôn thi hay bài làm được chấm điểm thì mới đáng đầu tư thêm thông tin."},
            {"speaker": "B", "text": "Còn một câu cuối mình hay băn khoăn: có việc gì mà đừng hỏi AI không?"},
            {"speaker": "A", "text": "Có. Khi cần nguyên văn quy chế thi, lịch thi, bảng giá hay số liệu thống kê chính thức, mở thẳng trang của nơi ban hành vừa nhanh vừa chắc. Có văn bản gốc rồi thì nhờ AI giải thích chỗ khó hiểu, rất hiệu quả."},
            {"speaker": "B", "text": "Vậy mình tóm lại nhé: hỏi có bối cảnh, mục đích, định dạng và yêu cầu minh bạch; bắt AI tự phản biện để biết cần kiểm gì; đừng tin con số chắc chắn nó tự nêu; và văn bản chính thức thì tra nguồn gốc trước."},
            {"speaker": "A", "text": "Tóm rất gọn. Các bạn hãy thử mẫu câu lệnh khung trong bài với một bài tập đang làm, rồi làm bài kiểm tra nhanh bảy câu ở cuối bài. Hẹn gặp lại ở tập sau, khi chúng ta nói về thiên kiến của AI và của chính mình."},
            {"speaker": "B", "text": "Cảm ơn Khoa, và cảm ơn các bạn đã lắng nghe. Hẹn gặp lại!"},
        ],
    },
}

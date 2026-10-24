# -*- coding: utf-8 -*-
"""Bài 3: Ảnh, video và tin lan truyền, kiểm chứng trong vài phút.

Bài học chuyển trọng tâm từ câu trả lời của AI sang nội dung lan truyền trên mạng: ảnh, giọng nói và video do AI
tạo ra, ảnh thật bị gắn sai ngữ cảnh, cách đọc ngang của người kiểm chứng chuyên nghiệp và bốn bước SIFT.

Nguồn đã kiểm (24/10/2026): Wineburg và McGrew 2019 (Teachers College Record 121(11), SAGE DOI
10.1177/016146811912101102; 45 người tham gia gồm 10 nhà sử học, 10 người kiểm chứng chuyên nghiệp, 25 sinh viên
Stanford); Caulfield 2019, bài "SIFT (The Four Moves)" trên hapgood.us ngày 19/6/2019; Chesney và Citron 2019,
California Law Review 107, tr. 1753. Ảnh: cặp ảnh năm 1937 trên Wikimedia Commons, phạm vi công cộng, đã kiểm
giấy phép qua API và mở xem trước khi đưa vào.
"""

SOCIAL_POST_MOCK = r"""
```html
<div style="max-width:34rem;margin:1.2rem auto;border:1px solid rgba(127,127,127,.28);border-radius:1rem;overflow:hidden;font-size:1rem;line-height:1.6">
  <div style="display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem">
    <div style="width:2.2rem;height:2.2rem;border-radius:50%;background:rgba(234,88,12,.25)"></div>
    <div><b>Tin Nóng Mỗi Ngày</b><br><span style="font-size:.8rem;opacity:.75">2 giờ trước · Công khai</span></div>
  </div>
  <div style="padding:0 1rem .7rem">KHẨN CẤP!!! Nước lũ tràn vào trung tâm thành phố sáng nay, cả khu phố chìm trong biển nước. Chia sẻ ngay để mọi người tránh khu vực này!</div>
  <div style="height:11rem;background:linear-gradient(160deg,rgba(59,130,246,.35),rgba(30,64,175,.55));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;letter-spacing:.02em">[Ảnh một con phố ngập sâu trong nước]</div>
  <div style="display:flex;gap:1.2rem;padding:.6rem 1rem;font-size:.85rem;opacity:.8"><span>12.400 lượt thích</span><span>3.150 bình luận</span><span>8.920 lượt chia sẻ</span></div>
  <div style="padding:.6rem 1rem;border-top:1px dashed rgba(127,127,127,.35);font-size:.85rem;opacity:.85">Bài đăng trên do người soạn bài dựng lại để minh hoạ. Tên trang và các con số đều không có thật.</div>
</div>
```
"""

YEZHOV_A = (
    "https://upload.wikimedia.org/wikipedia/commons/a/a1/"
    "Nikolai_Yezhov_with_Stalin_and_Molotov_along_the_Volga%E2%80%93Don_Canal%2C_original.jpg"
)
YEZHOV_B = (
    "https://upload.wikimedia.org/wikipedia/commons/b/be/"
    "Stalin_and_Molotov_along_the_Volga%E2%80%93Don_Canal%2C_Nikolai_Yezhov_removed.jpg"
)

PHOTO_PAIR = (
    r"""
```html
<figure class="lesson-figure" style="margin:1.4rem auto;max-width:44rem">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
    <img src="""
    + f'"{YEZHOV_A}"'
    + r""" alt="Ảnh gốc năm 1937: bốn người đàn ông đứng bên bờ kênh, người ngoài cùng bên phải mặc quân phục" style="width:100%;border-radius:.5rem">
    <img src="""
    + f'"{YEZHOV_B}"'
    + r""" alt="Bản ảnh đã bị sửa: người mặc quân phục bên phải đã bị xoá, thay bằng mặt nước" style="width:100%;border-radius:.5rem">
  </div>
  <figcaption style="font-size:.9rem;opacity:.85;margin-top:.5rem">Ảnh bên trái chụp năm 1937, có Nikolai Yezhov (người mặc quân phục, bên phải) đứng cạnh Stalin. Sau khi Yezhov bị thanh trừng, ông bị xoá khỏi bản ảnh được công bố (bên phải) và chỗ ông đứng được vẽ thành mặt nước. Ảnh: <a href="https://commons.wikimedia.org/wiki/File:Nikolai_Yezhov_with_Stalin_and_Molotov_along_the_Volga%E2%80%93Don_Canal,_original.jpg" target="_blank" rel="noopener noreferrer">ảnh gốc</a> và <a href="https://commons.wikimedia.org/wiki/File:Stalin_and_Molotov_along_the_Volga%E2%80%93Don_Canal,_Nikolai_Yezhov_removed.jpg" target="_blank" rel="noopener noreferrer">ảnh đã sửa</a> trên Wikimedia Commons, tác giả không rõ, thuộc phạm vi công cộng.</figcaption>
</figure>
```
"""
)

LESSON = {
    "title": "Bài 3 · Ảnh, video và tin lan truyền: kiểm chứng trong vài phút",
    "durationMin": 20,
    "description": (
        "Bài học giải thích vì sao mắt thường không còn đủ để nhận ra ảnh, giọng nói và video giả, giới thiệu cách "
        "đọc ngang mà người kiểm chứng chuyên nghiệp sử dụng, và hướng dẫn bốn bước SIFT cùng kỹ thuật tìm ảnh "
        "ngược để kiểm chứng một tin lan truyền trong vài phút."
    ),
    "look": {"palette": "sunset", "font": "modern"},
    "objectives": [
        "Giải thích được vì sao việc soi kỹ bằng mắt không còn là cách đáng tin cậy để nhận ra ảnh, giọng nói và video giả",
        "Phân biệt được đọc dọc với đọc ngang và áp dụng được đọc ngang khi gặp một nguồn tin lạ",
        "Thực hiện được bốn bước SIFT để kiểm chứng một bài đăng lan truyền",
        "Dùng được công cụ tìm ảnh ngược để phát hiện một bức ảnh thật bị gắn sai ngữ cảnh",
    ],
    "body": SOCIAL_POST_MOCK
    + r"""
Bài đăng trên có đủ những yếu tố khiến người xem muốn chia sẻ ngay. Nó dùng chữ in hoa và dấu chấm than để tạo cảm giác khẩn cấp, có một bức ảnh gây ấn tượng mạnh, và có hàng nghìn lượt chia sẻ cho thấy “ai cũng đã tin”. Tuy vậy, không có chi tiết nào trong bài cho biết bức ảnh được chụp ở đâu, vào lúc nào và do ai chụp.

:::Trước khi đọc tiếp, bạn sẽ kiểm chứng bài đăng này như thế nào?
Hãy nghĩ trong mười giây xem bạn sẽ làm gì đầu tiên. Nhiều người sẽ phóng to bức ảnh để tìm dấu vết chỉnh sửa, hoặc đọc phần bình luận để xem người khác nói gì. Cả hai cách đó đều giữ bạn ở lại bên trong bài đăng. Bài học này sẽ cho thấy người kiểm chứng chuyên nghiệp làm ngược lại: họ rời khỏi bài đăng gần như ngay lập tức để xem các nguồn khác nói gì. Một bức ảnh lũ lụt lan truyền thường hoá ra là ảnh thật nhưng được chụp ở một nơi khác, vào một năm khác.
:::
""",
    "sections": [
        {
            "layout": "cards",
            "title": "Vì sao mắt thường không còn đủ",
            "intro": (
                "Ảnh bị chỉnh sửa không phải là chuyện mới. Cặp ảnh dưới đây cho thấy người ta đã xoá một người khỏi "
                "ảnh từ những năm 1930, khi chưa có máy tính. Điều thay đổi trong vài năm gần đây là tốc độ và chi "
                "phí: nhờ AI, ai cũng có thể tạo ra một bức ảnh, một đoạn giọng nói hay một đoạn video giả trong vài "
                "phút. Các nội dung do AI tạo ra như vậy được gọi chung là **nội dung tổng hợp** (*synthetic media*), "
                "trong đó video và âm thanh giả mạo một người thật được gọi là **deepfake**."
                + "\n"
                + PHOTO_PAIR
                + "\nBốn loại nội dung dưới đây là những dạng bạn hay gặp nhất trên mạng xã hội."
            ),
            "parts": [
                {
                    "title": "Ảnh do AI tạo ra",
                    "md": (
                        "Các công cụ tạo ảnh có thể vẽ ra một cảnh chưa từng xảy ra chỉ từ một câu mô tả. Những lỗi "
                        "dễ thấy như bàn tay sáu ngón hay chữ viết méo mó đang ngày càng ít đi, nên việc tìm lỗi bằng "
                        "mắt ngày càng kém hiệu quả."
                    ),
                },
                {
                    "title": "Giọng nói nhân bản (voice cloning)",
                    "md": (
                        "Chỉ với một đoạn ghi âm ngắn, công cụ AI có thể bắt chước giọng của một người. Kẻ lừa đảo dùng "
                        "kỹ thuật này để giả giọng người thân, đồng nghiệp hay cấp trên khi gọi điện hỏi vay tiền."
                    ),
                },
                {
                    "title": "Video deepfake",
                    "md": (
                        "Video deepfake ghép khuôn mặt hoặc khẩu hình của một người thật vào một đoạn phim, khiến người "
                        "đó như đang nói hoặc làm điều mà họ chưa từng nói hay làm."
                    ),
                },
                {
                    "title": "Ảnh thật bị gắn sai ngữ cảnh (out of context)",
                    "md": (
                        "Đây là dạng phổ biến nhất và cũng khó nhận ra nhất, vì bức ảnh hoàn toàn thật. Cái sai nằm ở "
                        "lời chú thích đi kèm, chẳng hạn ảnh lũ lụt chụp ở nước khác từ nhiều năm trước được đăng lại "
                        "như tin của hôm nay."
                    ),
                },
            ],
            "outro": (
                "> [!canh-bao] Khi biết deepfake tồn tại, nhiều người chuyển sang thái độ nghi ngờ mọi thứ. Thái độ "
                "này cũng nguy hiểm, vì nó cho phép người bị bắt quả tang chối bỏ cả bằng chứng thật bằng cách nói "
                "rằng đó là hàng giả. Chesney và Citron gọi hiện tượng này là **lợi ích của kẻ nói dối** (*liar’s "
                "dividend*) [3]. Mục tiêu của bài học không phải là nghi ngờ tất cả, mà là biết cách kiểm chứng."
            ),
        },
        {
            "layout": "stats",
            "title": "Người kiểm chứng chuyên nghiệp làm gì khác",
            "intro": (
                "Năm 2019, Sam Wineburg và Sarah McGrew thuộc Nhóm Giáo dục Lịch sử Stanford (*Stanford History "
                "Education Group*) công bố một nghiên cứu quan sát cách 45 người đánh giá độ tin cậy của các trang web "
                "thật [1]. Người tham gia thuộc ba nhóm có trình độ rất khác nhau."
            ),
            "parts": [
                {"title": "10", "md": "người kiểm chứng chuyên nghiệp (*fact checker*) làm việc cho các cơ quan báo chí."},
                {"title": "10", "md": "nhà sử học có học vị tiến sĩ, vốn quen phân tích tài liệu gốc."},
                {"title": "25", "md": "sinh viên đại học Stanford, một trong những trường hàng đầu nước Mỹ."},
            ],
            "outro": (
                "Kết quả cho thấy nhiều nhà sử học và sinh viên bị đánh lừa bởi những đặc điểm bề ngoài của trang web, "
                "như giao diện chuyên nghiệp, tên miền có đuôi .org hay mục giới thiệu viết trau chuốt. Trong khi đó, "
                "những người kiểm chứng chuyên nghiệp đưa ra kết luận chính xác hơn và nhanh hơn hẳn hai nhóm còn lại. "
                "Điểm khác biệt không nằm ở việc họ đọc kỹ hơn, mà ở việc họ đọc theo một hướng khác."
            ),
        },
        {
            "layout": "compare",
            "title": "Đọc dọc và đọc ngang",
            "intro": (
                "Wineburg và McGrew đặt tên cho hai cách tiếp cận này là đọc dọc và đọc ngang [1]. Bảng so sánh dưới "
                "đây cho thấy vì sao cách thứ hai hiệu quả hơn."
            ),
            "parts": [
                {
                    "title": "Đọc dọc (vertical reading)",
                    "md": (
                        "Người đọc ở lại trên trang đang xem, cuộn từ trên xuống dưới, đọc mục “Giới thiệu về chúng tôi” "
                        "và đánh giá dựa trên giao diện, logo hay cách trình bày.\n\n"
                        "Cách làm này dễ bị đánh lừa, vì mọi thứ trên trang đều do chính chủ trang viết ra. Một trang "
                        "tin giả hoàn toàn có thể có giao diện đẹp và một mục giới thiệu rất thuyết phục."
                    ),
                },
                {
                    "title": "Đọc ngang (lateral reading)",
                    "md": (
                        "Người đọc rời khỏi trang gần như ngay lập tức, mở thêm các thẻ trình duyệt mới để tìm xem các "
                        "nguồn độc lập nói gì về trang đó, về tác giả và về thông tin được đưa ra.\n\n"
                        "Cách làm này hiệu quả vì nó dựa vào đánh giá của những bên không có lợi ích gắn với trang "
                        "đang xem, chẳng hạn các cơ quan báo chí, bách khoa toàn thư hay tổ chức chuyên môn."
                    ),
                },
            ],
            "outro": (
                "> [!ghi-nho] Nghiên cứu của Wineburg và McGrew có tên phụ là “đọc ít hơn để học được nhiều hơn” "
                "(*reading less and learning more*). Người kiểm chứng chuyên nghiệp chấp nhận bỏ qua phần lớn nội dung "
                "của trang để dành thời gian tìm hiểu xem nguồn đó có đáng tin hay không."
            ),
        },
        {
            "layout": "steps",
            "title": "Bốn bước SIFT",
            "intro": (
                "Năm 2019, Mike Caulfield, một nhà nghiên cứu về năng lực thông tin số, tóm tắt cách làm của người "
                "kiểm chứng chuyên nghiệp thành bốn bước dễ nhớ, gọi tắt là **SIFT** theo chữ cái đầu của bốn bước "
                "trong tiếng Anh [2]. Trong tiếng Anh, *sift* còn có nghĩa là sàng lọc."
            ),
            "parts": [
                {
                    "title": "S · Dừng lại (Stop)",
                    "md": (
                        "Khi một bài đăng khiến bạn thấy tức giận, sợ hãi hay hào hứng muốn chia sẻ ngay, đó chính là "
                        "lúc cần dừng lại. Bạn tự hỏi mình có biết nguồn này không và mình định dùng thông tin này để làm gì."
                    ),
                },
                {
                    "title": "I · Tìm hiểu nguồn (Investigate the source)",
                    "md": (
                        "Bạn dành khoảng một phút đọc ngang để tìm hiểu xem ai đứng sau bài đăng và các nguồn độc lập "
                        "nói gì về họ. Mục đích không phải là đánh giá toàn diện, mà là biết mình đang nghe ai nói."
                    ),
                },
                {
                    "title": "F · Tìm nguồn đưa tin tốt hơn (Find better coverage)",
                    "md": (
                        "Thay vì cố chứng minh bài đăng này đúng hay sai, bạn tìm xem các cơ quan báo chí uy tín hoặc "
                        "cơ quan chính thức có đưa tin về cùng sự việc hay không. Nếu một sự việc lớn thật sự xảy ra, "
                        "thường sẽ có nhiều nguồn đáng tin cùng đưa tin."
                    ),
                },
                {
                    "title": "T · Lần về bản gốc (Trace to the original)",
                    "md": (
                        "Bạn lần theo trích dẫn, bức ảnh hay đoạn video về nơi nó xuất hiện lần đầu, rồi so ngữ cảnh "
                        "gốc với cách nó đang được kể lại. Rất nhiều tin sai bắt đầu từ một nội dung thật bị cắt khỏi "
                        "ngữ cảnh ban đầu."
                    ),
                },
            ],
            "outro": (
                "> [!meo] Bạn không cần đi đủ bốn bước với mọi bài đăng. Nhiều khi chỉ bước đầu tiên, dừng lại "
                "trước khi chia sẻ, đã đủ để tránh lan truyền một tin sai."
            ),
        },
        {
            "layout": "steps",
            "title": "Tìm ảnh ngược trong một phút",
            "intro": (
                "Với bài đăng có ảnh, kỹ thuật hữu ích nhất cho bước “lần về bản gốc” là **tìm ảnh ngược** (*reverse "
                "image search*). Thay vì gõ chữ để tìm ảnh, bạn đưa chính bức ảnh vào công cụ tìm kiếm để xem nó đã "
                "xuất hiện ở đâu trên mạng. Google Lens, TinEye hay Bing Visual Search đều có chức năng này."
            ),
            "parts": [
                {
                    "title": "Lưu hoặc chụp lại bức ảnh",
                    "md": "Bạn lưu bức ảnh về máy hoặc sao chép đường dẫn của ảnh từ bài đăng.",
                },
                {
                    "title": "Đưa ảnh vào công cụ tìm ảnh ngược",
                    "md": (
                        "Bạn tải ảnh lên công cụ tìm kiếm hình ảnh hoặc dán đường dẫn của ảnh. Trên điện thoại, bạn có "
                        "thể dùng chức năng tìm bằng hình ảnh có sẵn trong ứng dụng tìm kiếm."
                    ),
                },
                {
                    "title": "Tìm lần xuất hiện sớm nhất",
                    "md": (
                        "Trong các kết quả, bạn chú ý những trang đăng ảnh sớm nhất và những cơ quan báo chí uy tín. "
                        "Nếu bức ảnh đã xuất hiện từ nhiều năm trước, thì nó không thể là ảnh của sự việc hôm nay."
                    ),
                },
                {
                    "title": "So ngữ cảnh gốc với lời chú thích",
                    "md": (
                        "Bạn so địa điểm, thời gian và sự việc trong nguồn gốc với lời chú thích của bài đăng. Nếu hai "
                        "bên không khớp, bài đăng đã gắn sai ngữ cảnh cho một bức ảnh thật."
                    ),
                },
            ],
            "outro": (
                "> [!vi-du] Với bài đăng về trận lũ ở đầu bài, bạn tìm ảnh ngược và thấy bức ảnh đã được một hãng "
                "tin đăng từ ba năm trước, kèm chú thích về một trận lũ ở một quốc gia khác. Chỉ sau một phút, bạn đã "
                "biết bài đăng sai ngữ cảnh mà không cần phân tích từng điểm ảnh."
            ),
        },
        {
            "layout": "faq",
            "title": "Câu hỏi thường gặp",
            "parts": [
                {
                    "title": "Có công cụ nào tự động phát hiện deepfake một cách chính xác không?",
                    "md": (
                        "Có nhiều công cụ phát hiện nội dung do AI tạo ra, nhưng chưa công cụ nào đáng tin cậy tuyệt "
                        "đối, và công nghệ tạo nội dung giả cũng liên tục được cải tiến. Vì vậy, kiểm chứng nguồn và "
                        "ngữ cảnh vẫn là cách làm vững chắc hơn so với việc chỉ dựa vào một công cụ phát hiện."
                    ),
                },
                {
                    "title": "Nếu nhận được cuộc gọi bằng giọng người thân nhờ chuyển tiền gấp thì phải làm gì?",
                    "md": (
                        "Bạn hãy dừng lại và gọi lại cho người thân qua số điện thoại bạn vẫn dùng, hoặc hỏi một câu "
                        "mà chỉ người thật mới trả lời được. Đây cũng là bước “dừng lại” và “lần về bản gốc” của SIFT, "
                        "chỉ khác là áp dụng cho một cuộc gọi thay vì một bài đăng."
                    ),
                },
                {
                    "title": "Đọc ngang có làm mình mất quá nhiều thời gian không?",
                    "md": (
                        "Không. Trong nghiên cứu của Wineburg và McGrew, người kiểm chứng chuyên nghiệp đưa ra kết "
                        "luận nhanh hơn các nhóm khác chính vì họ không dành thời gian đọc kỹ những trang không đáng "
                        "tin cậy [1]."
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
                        "1. Wineburg, S., và McGrew, S. (2019). Lateral reading and the nature of expertise: Reading less "
                        "and learning more when evaluating digital information. *Teachers College Record*, 121(11), 1–40. "
                        "[Bản trên kho Stanford](https://purl.stanford.edu/yk133ht8603)\n"
                        "2. Caulfield, M. (2019, ngày 19 tháng 6). SIFT (The four moves). *Hapgood*. "
                        "[Đọc bài viết](https://hapgood.us/2019/06/19/sift-the-four-moves/)\n"
                        "3. Chesney, R., và Citron, D. (2019). Deep fakes: A looming challenge for privacy, democracy, "
                        "and national security. *California Law Review*, 107, 1753. "
                        "[Trang giới thiệu bài báo](https://law.utexas.edu/faculty/publications/2019-deep-fakes-a-looming-challenge-for-privacy-democracy-and-national-security/)"
                    ),
                },
            ],
        },
    ],
    "flashcards": {
        "title": "Thẻ ghi nhớ · Bài 3",
        "items": [
            {
                "term": "Deepfake",
                "meaning": "Deepfake là video hoặc âm thanh do AI tạo ra để giả mạo một người thật, khiến người đó như đang nói hoặc làm điều họ chưa từng nói hay làm.",
            },
            {
                "term": "Nội dung tổng hợp (synthetic media)",
                "meaning": "Nội dung tổng hợp là tên gọi chung cho ảnh, âm thanh và video được tạo ra hoặc chỉnh sửa bằng AI.",
            },
            {
                "term": "Sai ngữ cảnh (out of context)",
                "meaning": "Một nội dung thật bị gắn với lời chú thích sai về địa điểm, thời gian hoặc sự việc, chẳng hạn ảnh cũ được đăng lại như tin mới.",
                "example": "Ảnh lũ lụt chụp ở nước khác từ ba năm trước được đăng lại như tin của hôm nay.",
            },
            {
                "term": "Đọc dọc (vertical reading)",
                "meaning": "Đọc dọc là cách đánh giá một nguồn bằng cách ở lại trên trang đó và xem xét những gì chính trang ấy viết về mình.",
            },
            {
                "term": "Đọc ngang (lateral reading)",
                "meaning": "Đọc ngang là cách đánh giá một nguồn bằng cách rời khỏi trang đó để xem các nguồn độc lập nói gì về nó.",
            },
            {
                "term": "SIFT",
                "meaning": "SIFT là bốn bước kiểm chứng của Mike Caulfield: dừng lại (Stop), tìm hiểu nguồn (Investigate the source), tìm nguồn đưa tin tốt hơn (Find better coverage) và lần về bản gốc (Trace to the original).",
            },
            {
                "term": "Tìm ảnh ngược (reverse image search)",
                "meaning": "Tìm ảnh ngược là kỹ thuật đưa chính một bức ảnh vào công cụ tìm kiếm để biết nó đã xuất hiện ở đâu và lần đầu vào lúc nào.",
            },
        ],
    },
    "summary": [
        "Ảnh, giọng nói và video giả giờ có thể được tạo ra nhanh và rẻ bằng AI, nên việc soi kỹ bằng mắt không còn là cách đáng tin cậy để phát hiện chúng.",
        "Dạng tin sai phổ biến nhất vẫn là ảnh thật bị gắn sai ngữ cảnh, và dạng này chỉ phát hiện được khi lần về bản gốc.",
        "Người kiểm chứng chuyên nghiệp đọc ngang: họ nhanh chóng rời khỏi trang để xem các nguồn độc lập nói gì, thay vì đọc kỹ chính trang đó.",
        "Bốn bước SIFT gồm dừng lại, tìm hiểu nguồn, tìm nguồn đưa tin tốt hơn và lần về bản gốc; với ảnh, kỹ thuật tìm ảnh ngược giúp lần về bản gốc chỉ trong khoảng một phút.",
    ],
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3",
        "passThresholdPct": 60,
        "requireConfidence": True,
        "questions": [
            {
                "key": "3.1-video-giong-ai",
                "type": "mcq",
                "prompt": (
                    "Bạn xem được một đoạn video lan truyền, trong đó một vị lãnh đạo doanh nghiệp nổi tiếng tuyên bố "
                    "công ty sắp phá sản. Cách nào cho bạn biết đáng tin cậy nhất video này có thật hay không?"
                ),
                "explanation": (
                    "Một tuyên bố quan trọng như vậy, nếu có thật, sẽ được các cơ quan báo chí uy tín và chính công ty "
                    "đưa tin. Tìm nguồn đưa tin tốt hơn đáng tin cậy hơn nhiều so với việc soi khuôn mặt bằng mắt hay "
                    "đếm lượt chia sẻ."
                ),
                "points": 2,
                "options": [
                    {"label": "Phóng to video để tìm chỗ khuôn mặt bị nhoè hoặc khẩu hình lệch.", "isCorrect": False, "misconception": "aipb.b3.eye-test"},
                    {"label": "Xem video đã được bao nhiêu người chia sẻ.", "isCorrect": False, "misconception": "aipb.b3.popularity-as-proof"},
                    {"label": "Đọc phần bình luận bên dưới video để xem mọi người có tin không.", "isCorrect": False, "misconception": "aipb.b3.vertical-reading"},
                    {"label": "Tìm xem các cơ quan báo chí uy tín và trang chính thức của công ty có đưa tin này không.", "isCorrect": True},
                ],
            },
            {
                "key": "3.2-doc-ngang",
                "type": "mcq",
                "prompt": (
                    "Bạn gặp một trang tin lạ đăng một bài về chính sách y tế mới. Những việc nào dưới đây là đọc ngang? "
                    "Hãy chọn tất cả phương án đúng."
                ),
                "explanation": (
                    "Đọc ngang là rời khỏi trang để xem các nguồn độc lập nói gì về trang, về tác giả và về thông tin. "
                    "Đọc mục giới thiệu hay đánh giá giao diện của chính trang đó là đọc dọc, vì mọi thứ trên trang đều "
                    "do chủ trang viết."
                ),
                "points": 2,
                "options": [
                    {"label": "Mở thẻ mới và tìm tên của trang tin trên công cụ tìm kiếm.", "isCorrect": True},
                    {"label": "Đọc kỹ mục “Giới thiệu về chúng tôi” của trang tin đó.", "isCorrect": False, "misconception": "aipb.b3.vertical-reading"},
                    {"label": "Tìm xem Bộ Y tế hoặc các báo lớn có nói về chính sách này không.", "isCorrect": True},
                    {"label": "Đánh giá trang dựa trên giao diện chuyên nghiệp và tên miền có đuôi .org.", "isCorrect": False, "misconception": "aipb.b3.vertical-reading"},
                    {"label": "Tìm tên tác giả bài viết để xem người đó là ai.", "isCorrect": True},
                ],
            },
            {
                "key": "3.3-anh-that-tin-that",
                "type": "true_false",
                "prompt": (
                    "Một bức ảnh hoàn toàn không bị chỉnh sửa vẫn có thể được dùng để lan truyền thông tin sai, chẳng "
                    "hạn khi lời chú thích gắn nó với một địa điểm hoặc sự việc khác."
                ),
                "explanation": (
                    "Nhận định này đúng. Dạng tin sai phổ biến nhất là ảnh thật bị gắn sai ngữ cảnh: bức ảnh không bị "
                    "chỉnh sửa, nhưng địa điểm, thời gian hoặc sự việc trong lời chú thích là sai."
                ),
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False, "misconception": "aipb.b3.real-photo-true-claim"},
                ],
            },
            {
                "key": "3.4-keo-tha-doc-ngang",
                "type": "drag_drop_fill",
                "prompt": (
                    "Hãy kéo các cụm từ vào đúng chỗ trống. Trong nghiên cứu của Wineburg và McGrew, người kiểm chứng "
                    "chuyên nghiệp nhanh chóng [[1]] trang đang xem để tìm hiểu [[2]] nói gì về trang đó. Cách làm "
                    "này được gọi là [[3]]."
                ),
                "explanation": (
                    "Người kiểm chứng chuyên nghiệp rời khỏi trang để xem các nguồn độc lập nói gì về nó; cách làm này "
                    "được gọi là đọc ngang."
                ),
                "points": 2,
                "tokens": [
                    {"label": "đọc dọc"},
                    {"label": "các nguồn độc lập", "blank": 2},
                    {"label": "ở lại"},
                    {"label": "đọc ngang", "blank": 3},
                    {"label": "rời khỏi", "blank": 1},
                ],
            },
            {
                "key": "3.5-ghep-sift",
                "type": "matching",
                "prompt": "Hãy ghép mỗi bước của SIFT với việc làm tương ứng.",
                "explanation": (
                    "Dừng lại là không chia sẻ ngay khi cảm xúc dâng lên; tìm hiểu nguồn là xem ai đứng sau thông tin; "
                    "tìm nguồn đưa tin tốt hơn là xem các cơ quan uy tín có đưa tin không; lần về bản gốc là tìm nơi "
                    "nội dung xuất hiện lần đầu."
                ),
                "points": 3,
                "pairs": [
                    {"left": "Dừng lại (Stop)", "right": "Không chia sẻ ngay khi bài đăng khiến bạn tức giận hay sợ hãi."},
                    {"left": "Tìm hiểu nguồn (Investigate the source)", "right": "Tìm xem ai đứng sau trang đăng tin và người khác nói gì về họ."},
                    {"left": "Tìm nguồn đưa tin tốt hơn (Find better coverage)", "right": "Tìm xem các báo uy tín có đưa tin về cùng sự việc không."},
                    {"left": "Lần về bản gốc (Trace to the original)", "right": "Tìm nơi bức ảnh hoặc trích dẫn xuất hiện lần đầu tiên."},
                ],
            },
            {
                "key": "3.6-thu-tu-tim-anh-nguoc",
                "type": "ordering",
                "prompt": "Hãy sắp xếp các bước tìm ảnh ngược theo đúng thứ tự.",
                "explanation": (
                    "Bạn lưu ảnh, đưa ảnh vào công cụ tìm ảnh ngược, tìm lần xuất hiện sớm nhất, rồi so ngữ cảnh gốc "
                    "với lời chú thích của bài đăng."
                ),
                "points": 2,
                "sequence": [
                    "Lưu bức ảnh hoặc sao chép đường dẫn của ảnh.",
                    "Đưa ảnh vào công cụ tìm ảnh ngược.",
                    "Tìm trang đăng bức ảnh sớm nhất trong các kết quả.",
                    "So ngữ cảnh gốc với lời chú thích của bài đăng.",
                ],
            },
            {
                "key": "3.7-ten-sift",
                "type": "fill_in",
                "prompt": (
                    "Bốn bước kiểm chứng do Mike Caulfield đề xuất được gọi tắt bằng bốn chữ cái đầu trong tiếng Anh. "
                    "Hãy điền tên viết tắt đó."
                ),
                "explanation": (
                    "Tên viết tắt là SIFT, gồm Stop, Investigate the source, Find better coverage và Trace to the original."
                ),
                "points": 1,
                "answers": ["SIFT", "sift"],
            },
        ],
    },
    "lecture": [
        {
            "anchor": "mo-dau",
            "text": (
                "Chào bạn, chào mừng bạn đến với bài thứ ba của khoá học. Ở hai bài trước, mình đã cùng bạn kiểm chứng "
                "câu trả lời của AI và tách một lập luận thành từng phần. Hôm nay, mình chuyển sang một thứ mà bạn gặp "
                "hằng ngày, thậm chí hằng giờ: những bức ảnh, đoạn video và bài đăng lan truyền trên mạng xã hội. "
                "Bạn hãy nhìn vào bài đăng ở đầu trang. Nó có chữ in hoa, có ba dấu chấm than, có một bức ảnh con phố "
                "ngập sâu trong nước, và có gần chín nghìn lượt chia sẻ. Mọi thứ trong bài đăng đều thúc bạn chia sẻ "
                "ngay để cảnh báo người khác. Nhưng bạn để ý xem, trong bài có chi tiết nào cho biết bức ảnh được chụp "
                "ở đâu, vào lúc nào, và ai là người chụp không? Không có chi tiết nào cả. "
                "Ngay dưới bài đăng là một hộp câu hỏi. Mình muốn bạn dừng lại khoảng mười giây và tự hỏi: nếu là mình, "
                "mình sẽ làm gì đầu tiên để kiểm chứng bài đăng này? Bạn hãy nghĩ xong rồi hãy mở hộp. Nhiều người sẽ "
                "phóng to bức ảnh hoặc đọc phần bình luận. Đến cuối bài, bạn sẽ thấy vì sao người kiểm chứng chuyên "
                "nghiệp lại làm theo một cách hoàn toàn khác."
            ),
        },
        {
            "anchor": "Vì sao mắt thường không còn đủ",
            "text": (
                "Trước hết, mình muốn bạn nhìn vào cặp ảnh đen trắng trên màn hình. Hai bức ảnh này được chụp năm một "
                "nghìn chín trăm ba mươi bảy. Ở bức bên trái, bạn thấy bốn người đứng bên bờ kênh, và người mặc quân "
                "phục đứng ngoài cùng bên phải là Nikolai Yezhov. Sau khi ông bị thanh trừng, bức ảnh được công bố lại "
                "như bạn thấy ở bên phải: ông đã biến mất, và chỗ ông đứng được vẽ thành mặt nước. Như vậy, việc sửa ảnh "
                "để kể một câu chuyện khác đã có từ rất lâu, từ khi chưa có máy tính. "
                "Điều thay đổi trong vài năm gần đây là tốc độ và chi phí. Ngày nay, với các công cụ AI, ai cũng có thể "
                "tạo ra một bức ảnh, một đoạn giọng nói hay một đoạn video giả chỉ trong vài phút. Người ta gọi chung "
                "những nội dung này là nội dung tổng hợp, tiếng Anh là synthetic media. Còn video và âm thanh giả mạo "
                "một người thật thì được gọi là deepfake. "
                "Bạn nhìn bốn tấm thẻ trên màn hình. Thẻ thứ nhất là ảnh do AI tạo ra. Trước đây bạn có thể nhận ra "
                "chúng nhờ những lỗi như bàn tay sáu ngón, nhưng những lỗi đó đang ít dần. Thẻ thứ hai là giọng nói "
                "nhân bản, kỹ thuật mà kẻ lừa đảo dùng để giả giọng người thân khi gọi điện hỏi vay tiền. Thẻ thứ ba là "
                "video deepfake. Và thẻ thứ tư, mình muốn bạn chú ý nhất: ảnh thật bị gắn sai ngữ cảnh. Đây là dạng "
                "phổ biến nhất, vì bức ảnh hoàn toàn thật, chỉ có lời chú thích là sai. Một bức ảnh lũ lụt chụp ở nước "
                "khác từ nhiều năm trước có thể được đăng lại như tin của hôm nay. Soi kỹ đến đâu, bạn cũng không tìm "
                "thấy dấu vết chỉnh sửa nào, vì nó chưa từng bị chỉnh sửa. "
                "Cuối mục này có một hộp cảnh báo mà mình rất muốn bạn ghi nhớ. Khi biết deepfake tồn tại, nhiều người "
                "chuyển sang nghi ngờ mọi thứ. Nhưng thái độ đó cũng nguy hiểm, vì nó cho phép người bị bắt quả tang "
                "chối bỏ cả bằng chứng thật, chỉ cần nói rằng đó là hàng giả. Hai nhà nghiên cứu luật Chesney và Citron "
                "gọi hiện tượng này là lợi ích của kẻ nói dối. Vì vậy, mục tiêu của bài học hôm nay không phải là nghi "
                "ngờ tất cả, mà là biết cách kiểm chứng."
            ),
        },
        {
            "anchor": "Người kiểm chứng chuyên nghiệp làm gì khác",
            "text": (
                "Vậy kiểm chứng thế nào cho đúng? Để trả lời, mình muốn kể cho bạn về một nghiên cứu năm hai nghìn "
                "mười chín của hai nhà nghiên cứu Sam Wineburg và Sarah McGrew thuộc Nhóm Giáo dục Lịch sử Stanford. "
                "Bạn nhìn ba con số lớn trên màn hình. Họ quan sát bốn mươi lăm người đánh giá độ tin cậy của các trang "
                "web thật, gồm mười người kiểm chứng chuyên nghiệp làm việc cho các cơ quan báo chí, mười nhà sử học có "
                "học vị tiến sĩ, và hai mươi lăm sinh viên đại học Stanford. "
                "Bạn thử đoán xem nhóm nào làm tốt nhất? Nhiều người nghĩ là các nhà sử học, vì họ quen phân tích tài "
                "liệu gốc. Nhưng kết quả lại khác. Nhiều nhà sử học và sinh viên bị đánh lừa bởi vẻ bề ngoài của trang "
                "web, như giao diện chuyên nghiệp hay tên miền có đuôi chấm o r g. Còn những người kiểm chứng chuyên "
                "nghiệp thì vừa chính xác hơn, vừa nhanh hơn hẳn. Điều đáng chú ý là họ không đọc kỹ hơn, mà họ đọc "
                "theo một hướng khác."
            ),
        },
        {
            "anchor": "Đọc dọc và đọc ngang",
            "text": (
                "Hướng khác đó là gì? Bạn nhìn bảng so sánh hai cột trên màn hình. Cột bên trái là đọc dọc, tiếng Anh "
                "là vertical reading. Người đọc dọc ở lại trên trang, cuộn từ trên xuống, đọc mục giới thiệu về chúng "
                "tôi, rồi đánh giá dựa trên giao diện và cách trình bày. Vấn đề là mọi thứ trên trang đều do chính chủ "
                "trang viết ra. Một trang tin giả hoàn toàn có thể có giao diện rất đẹp và một mục giới thiệu rất thuyết phục. "
                "Cột bên phải là đọc ngang, tiếng Anh là lateral reading. Người đọc ngang rời khỏi trang gần như ngay "
                "lập tức, mở thêm vài thẻ trình duyệt mới, và tìm xem các nguồn độc lập nói gì về trang đó, về tác giả, "
                "và về thông tin được đưa ra. Cách này hiệu quả vì nó dựa vào đánh giá của những bên không có lợi ích "
                "gắn với trang đang xem. "
                "Nghiên cứu của Wineburg và McGrew có một tên phụ mà mình rất thích: đọc ít hơn để học được nhiều hơn. "
                "Nghe thì có vẻ ngược đời, nhưng đó chính là bí quyết. Người kiểm chứng chấp nhận bỏ qua phần lớn nội "
                "dung trên trang, để dành thời gian tìm hiểu xem nguồn đó có đáng tin hay không."
            ),
        },
        {
            "anchor": "Bốn bước SIFT",
            "text": (
                "Để bạn dễ áp dụng, năm hai nghìn mười chín, nhà nghiên cứu Mike Caulfield đã tóm tắt cách làm của "
                "người kiểm chứng chuyên nghiệp thành bốn bước, gọi tắt là SIFT. Trong tiếng Anh, sift còn có nghĩa là "
                "sàng lọc. Bạn theo dõi bốn bước có đánh số trên màn hình nhé. "
                "Bước một là S, dừng lại. Khi một bài đăng khiến bạn tức giận, sợ hãi hay hào hứng muốn chia sẻ ngay, "
                "thì đó chính là lúc cần dừng lại nhất. Bạn tự hỏi: mình có biết nguồn này không, và mình định dùng "
                "thông tin này để làm gì? "
                "Bước hai là I, tìm hiểu nguồn. Bạn dành khoảng một phút đọc ngang để biết ai đứng sau bài đăng và các "
                "nguồn độc lập nói gì về họ. "
                "Bước ba là F, tìm nguồn đưa tin tốt hơn. Thay vì cố chứng minh bài đăng này đúng hay sai, bạn tìm xem "
                "các báo uy tín hoặc cơ quan chính thức có đưa tin về cùng sự việc không. Nếu một trận lũ lớn thật sự "
                "xảy ra giữa trung tâm thành phố, sẽ có rất nhiều nguồn đáng tin cùng đưa tin. "
                "Bước bốn là T, lần về bản gốc. Bạn lần theo bức ảnh, trích dẫn hay đoạn video về nơi nó xuất hiện lần "
                "đầu, rồi so ngữ cảnh gốc với cách nó đang được kể lại. "
                "Và một mẹo nhỏ: bạn không cần đi đủ bốn bước với mọi bài đăng. Nhiều khi, chỉ riêng bước đầu tiên, "
                "dừng lại trước khi chia sẻ, đã đủ để bạn không vô tình lan truyền một tin sai."
            ),
        },
        {
            "anchor": "Tìm ảnh ngược trong một phút",
            "text": (
                "Với bài đăng có ảnh, kỹ thuật hữu ích nhất cho bước lần về bản gốc là tìm ảnh ngược, tiếng Anh là "
                "reverse image search. Thay vì gõ chữ để tìm ảnh, bạn đưa chính bức ảnh vào công cụ tìm kiếm, như "
                "Google Lens, TinEye hay Bing Visual Search, để xem nó đã từng xuất hiện ở đâu. "
                "Bạn nhìn bốn bước trên màn hình. Đầu tiên, bạn lưu bức ảnh hoặc sao chép đường dẫn của ảnh. Tiếp theo, "
                "bạn đưa ảnh vào công cụ tìm ảnh ngược. Sau đó, trong các kết quả, bạn tìm trang đăng bức ảnh sớm nhất, "
                "nhất là các hãng tin uy tín. Cuối cùng, bạn so địa điểm, thời gian và sự việc trong nguồn gốc với lời "
                "chú thích của bài đăng. "
                "Quay lại bài đăng về trận lũ ở đầu bài. Giả sử bạn tìm ảnh ngược và thấy bức ảnh đã được một hãng tin "
                "đăng từ ba năm trước, kèm chú thích về một trận lũ ở một quốc gia khác. Vậy là chỉ sau một phút, bạn "
                "đã biết bài đăng gắn sai ngữ cảnh, mà không cần soi từng điểm ảnh. Bây giờ thì bạn hiểu vì sao lúc "
                "đầu mình hỏi bạn sẽ làm gì trước tiên rồi chứ."
            ),
        },
        {
            "anchor": "Câu hỏi thường gặp",
            "text": (
                "Mục hỏi đáp cuối bài có ba câu, mình nhấn một câu quan trọng nhất. Nếu nhận được cuộc gọi bằng giọng "
                "người thân nhờ chuyển tiền gấp, bạn hãy dừng lại và gọi lại cho người thân qua số điện thoại bạn vẫn "
                "dùng. Đó chính là bước dừng lại và lần về bản gốc của SIFT, áp dụng cho một cuộc gọi."
            ),
        },
        {
            "anchor": "tong-ket",
            "text": (
                "Vậy là chúng ta đi đến cuối bài thứ ba. Mình tóm tắt lại bốn ý chính. Một, ảnh, giọng nói và video giả "
                "giờ được tạo ra nhanh và rẻ, nên soi bằng mắt không còn đáng tin. Hai, dạng tin sai phổ biến nhất vẫn "
                "là ảnh thật gắn sai ngữ cảnh, và chỉ lần về bản gốc mới phát hiện được. Ba, người kiểm chứng chuyên "
                "nghiệp đọc ngang, tức là rời khỏi trang để xem nguồn độc lập nói gì. Bốn, hãy nhớ bốn bước SIFT: dừng "
                "lại, tìm hiểu nguồn, tìm nguồn đưa tin tốt hơn, và lần về bản gốc. "
                "Lần tới, khi một bài đăng khiến bạn muốn bấm chia sẻ ngay, bạn hãy thử dừng lại một nhịp nhé. Giờ "
                "thì mời bạn làm bài kiểm tra ngắn bảy câu để ôn lại những gì vừa học. Hẹn gặp bạn ở bài tiếp theo."
            ),
        },
    ],
    "podcast": {
        "title": "Ảnh này có thật không? Chuyện kiểm chứng tin lan truyền",
        "durationMin": 6,
        "hosts": {"A": "Khoa", "B": "Linh"},
        "turns": [
            {"speaker": "A", "text": "Xin chào các bạn, mình là Khoa, và đây là podcast của khoá Tư duy phản biện thời AI. Hôm nay mình ngồi cùng Linh để nói về một chuyện mà ai cũng gặp hằng ngày: những bức ảnh và video lan truyền trên mạng."},
            {"speaker": "B", "text": "Chào Khoa, chào các bạn. Phải nói thật là tuần trước mình suýt chia sẻ một bức ảnh lũ lụt trên nhóm của khu phố. Bức ảnh nhìn rất thật, và bài đăng ghi là chụp sáng hôm đó."},
            {"speaker": "A", "text": "Rồi sao, Linh có chia sẻ không?"},
            {"speaker": "B", "text": "May là không. Có một bạn trong nhóm bình luận rằng bức ảnh đó đã xuất hiện từ mấy năm trước, ở một nước khác hẳn. Mình thấy hơi ngại, vì mình đã phóng to bức ảnh rất kỹ mà không thấy chỗ nào bị sửa."},
            {"speaker": "A", "text": "Đó chính là điều mình muốn nói hôm nay. Linh không thấy chỗ nào bị sửa, vì bức ảnh không hề bị sửa. Nó là ảnh thật, chỉ có lời chú thích là sai. Người ta gọi đây là ảnh bị gắn sai ngữ cảnh, tiếng Anh là out of context."},
            {"speaker": "B", "text": "Nhưng bây giờ người ta nói nhiều về deepfake lắm. Mình tưởng cái đáng sợ nhất là ảnh và video do AI tạo ra chứ?"},
            {"speaker": "A", "text": "Deepfake đáng lo thật. Giờ chỉ cần vài phút là có thể tạo ra một bức ảnh hay một đoạn giọng nói giả. Có những vụ lừa đảo dùng giọng nói nhân bản để giả làm người thân gọi điện hỏi vay tiền. Nhưng trên mạng xã hội hằng ngày, dạng tin sai mình gặp nhiều nhất vẫn là ảnh thật gắn sai ngữ cảnh."},
            {"speaker": "B", "text": "Vậy nếu soi bằng mắt không ăn thua, thì người bình thường như mình phải làm sao?"},
            {"speaker": "A", "text": "Mình kể Linh nghe một nghiên cứu rất hay. Năm 2019, hai nhà nghiên cứu ở Stanford là Sam Wineburg và Sarah McGrew quan sát ba nhóm người đánh giá các trang web: người kiểm chứng chuyên nghiệp của các tờ báo, các nhà sử học có bằng tiến sĩ, và sinh viên Stanford."},
            {"speaker": "B", "text": "Để mình đoán nhé. Nhà sử học thắng, vì họ quen làm việc với tài liệu gốc?"},
            {"speaker": "A", "text": "Ai cũng đoán vậy, nhưng không phải. Nhà sử học và sinh viên hay bị đánh lừa bởi giao diện đẹp, bởi cái đuôi tên miền nghe uy tín. Người kiểm chứng chuyên nghiệp thì vừa chính xác hơn vừa nhanh hơn."},
            {"speaker": "B", "text": "Họ có bí quyết gì vậy?"},
            {"speaker": "A", "text": "Bí quyết là họ rời khỏi trang rất nhanh. Thay vì đọc kỹ trang đó, họ mở thêm vài thẻ trình duyệt và tìm xem người khác nói gì về trang đó. Cách này gọi là đọc ngang, lateral reading. Còn kiểu ở lại đọc kỹ chính trang đó thì gọi là đọc dọc."},
            {"speaker": "B", "text": "Hay thật. Giống như khi mình muốn biết một quán ăn có ngon không, mình không tin tấm biển quán tự ghi là ngon nhất phố, mà mình đọc đánh giá của những người đã ăn."},
            {"speaker": "A", "text": "Đúng rồi, ví dụ đó rất chuẩn. Mọi thứ trên một trang web đều do chính chủ trang viết ra, nên họ tự khen mình là chuyện bình thường. Cái mình cần là đánh giá của những người không có lợi ích gì với trang đó."},
            {"speaker": "B", "text": "Vậy có cách nào dễ nhớ để mình làm theo không?"},
            {"speaker": "A", "text": "Có, Mike Caulfield gói gọn thành bốn bước gọi là SIFT. S là dừng lại. I là tìm hiểu nguồn. F là tìm nguồn đưa tin tốt hơn. T là lần về bản gốc."},
            {"speaker": "B", "text": "Bước dừng lại nghe thì đơn giản, nhưng thật ra khó nhất đấy. Lúc thấy bức ảnh lũ, mình chỉ muốn báo cho mọi người thật nhanh."},
            {"speaker": "A", "text": "Chính vì vậy nó mới là bước đầu tiên. Khi một bài đăng làm mình sợ hãi, tức giận hay phấn khích, đó là lúc dễ bị dắt mũi nhất. Chỉ cần dừng lại một nhịp là đã tránh được rất nhiều tin sai."},
            {"speaker": "B", "text": "Còn với bức ảnh lũ của mình, nếu làm đúng thì mình nên làm gì?"},
            {"speaker": "A", "text": "Linh dùng bước lần về bản gốc, cụ thể là tìm ảnh ngược. Linh đưa bức ảnh vào Google Lens hoặc TinEye, xem nó từng xuất hiện ở đâu, rồi tìm lần đăng sớm nhất. Nếu một hãng tin đã đăng nó từ ba năm trước với chú thích về một nước khác, thì Linh có câu trả lời chỉ sau một phút."},
            {"speaker": "B", "text": "Nghe nhẹ nhàng hơn mình nghĩ nhiều. Nhưng Khoa này, biết nhiều về deepfake rồi, mình có nên nghi ngờ mọi thứ không?"},
            {"speaker": "A", "text": "Câu hỏi rất quan trọng. Nghi ngờ tất cả cũng nguy hiểm, vì nó cho phép người bị bắt quả tang nói rằng bằng chứng thật chỉ là đồ giả. Hai nhà nghiên cứu Chesney và Citron gọi đó là lợi ích của kẻ nói dối. Mục tiêu không phải là không tin gì, mà là biết cách kiểm chứng trước khi tin."},
            {"speaker": "B", "text": "Vậy để mình tóm lại nhé. Soi bằng mắt không đủ. Tin sai phổ biến nhất là ảnh thật sai ngữ cảnh. Hãy đọc ngang, và nhớ bốn bước SIFT."},
            {"speaker": "A", "text": "Tóm tắt quá chuẩn. Các bạn ơi, sau tập này, mời các bạn làm bài kiểm tra ngắn bảy câu trong bài học để xem mình nhớ được bao nhiêu. Cảm ơn các bạn đã lắng nghe, hẹn gặp lại ở tập sau."},
            {"speaker": "B", "text": "Tạm biệt các bạn, và nhớ dừng lại một nhịp trước khi bấm chia sẻ nhé."},
        ],
    },
}

MISCONCEPTIONS = [
    {
        "code": "aipb.b3.eye-test",
        "name": "Tin rằng soi kỹ bằng mắt là đủ để phát hiện ảnh, video giả",
        "description": (
            "Cho rằng phóng to ảnh hay xem chậm video để tìm lỗi là cách đáng tin cậy để phát hiện nội dung giả. Các "
            "công cụ AI ngày càng ít để lại dấu vết dễ thấy, còn ảnh thật bị gắn sai ngữ cảnh thì không có dấu vết "
            "chỉnh sửa nào để tìm."
        ),
    },
    {
        "code": "aipb.b3.vertical-reading",
        "name": "Đánh giá một nguồn bằng chính những gì nguồn đó viết về mình",
        "description": (
            "Ở lại trên trang để đọc mục giới thiệu, xem giao diện hay tên miền, hoặc đọc bình luận ngay dưới bài, "
            "rồi dựa vào đó để kết luận. Mọi thứ trên trang đều do chủ trang kiểm soát, nên cách đọc dọc này dễ bị "
            "đánh lừa hơn nhiều so với đọc ngang."
        ),
    },
    {
        "code": "aipb.b3.real-photo-true-claim",
        "name": "Nghĩ rằng ảnh thật thì thông tin đi kèm cũng thật",
        "description": (
            "Cho rằng một bức ảnh chưa bị chỉnh sửa thì lời chú thích của nó cũng đúng. Dạng tin sai phổ biến nhất "
            "là ảnh thật được gắn với địa điểm, thời gian hoặc sự việc sai."
        ),
    },
    {
        "code": "aipb.b3.popularity-as-proof",
        "name": "Lấy số lượt thích, lượt chia sẻ làm bằng chứng",
        "description": (
            "Tin một nội dung vì nó có nhiều lượt thích hoặc lượt chia sẻ. Mức độ lan truyền chỉ đo mức độ gây chú "
            "ý của nội dung, không đo độ chính xác; tin gây sốc thường lan nhanh hơn tin đúng."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "aipb.b3.eye-test",
        "body": (
            "Soi kỹ bằng mắt ngày càng kém hiệu quả, vì nội dung do AI tạo ra ít để lại lỗi dễ thấy, còn ảnh thật bị "
            "gắn sai ngữ cảnh thì không hề có dấu vết chỉnh sửa. Thay vì tìm lỗi trong bức ảnh, bạn hãy rời khỏi bài "
            "đăng và tìm xem các nguồn uy tín nói gì về sự việc."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b3.vertical-reading",
        "body": (
            "Những gì một trang viết về chính nó, kể cả giao diện và mục giới thiệu, đều do chủ trang kiểm soát. Bạn "
            "hãy đọc ngang: mở thẻ mới và tìm xem các nguồn độc lập nói gì về trang, về tác giả và về thông tin đó."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b3.real-photo-true-claim",
        "body": (
            "Một bức ảnh không bị chỉnh sửa vẫn có thể bị dùng sai. Bạn hãy tìm ảnh ngược để biết bức ảnh xuất hiện "
            "lần đầu ở đâu và vào lúc nào, rồi so ngữ cảnh gốc với lời chú thích của bài đăng."
        ),
        "priority": 10,
    },
    {
        "misconception": "aipb.b3.popularity-as-proof",
        "body": (
            "Số lượt chia sẻ cho biết nội dung gây chú ý đến mức nào, chứ không cho biết nó đúng hay sai. Bạn hãy tìm "
            "xem các cơ quan báo chí uy tín hoặc nguồn chính thức có đưa tin về cùng sự việc hay không."
        ),
        "priority": 10,
    },
]

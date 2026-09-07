# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 8.3 · Uy quyền, khan hiếm, đồng nhất — và cách tự vệ",
    "durationMin": 50,
    "description": "Ba nguyên tắc còn lại kèm ví dụ; cách nhận ra thủ thuật khan hiếm giả và uy quyền vay mượn; các mẫu thiết kế đánh lừa trên ứng dụng; và quy trình bốn bước tự vệ trước một lời chào mời gấp gáp.",
    "objectives": [
        "Giải thích được vì sao uy quyền, khan hiếm và đồng nhất tác động mạnh tới quyết định",
        "Phân biệt được uy quyền thật với dấu hiệu uy quyền vay mượn",
        "Nhận ra được khan hiếm giả và các mẫu thiết kế đánh lừa trên ứng dụng, sàn thương mại",
        "Chạy được quy trình bốn bước tự vệ trước một đề nghị gấp gáp",
    ],
    "summary": [
        "Uy quyền hiệu quả vì ta tiết kiệm công sức khi tin người có chuyên môn — nhưng dấu hiệu uy quyền thì dựng được, nên phải hỏi chuyên môn đúng lĩnh vực và lợi ích của người nói.",
        "Khan hiếm hoạt động vì con người ghét mất mát hơn thích được thêm; cái hiếm được đánh giá cao hơn dù chất lượng không đổi.",
        "Đồng nhất là nguyên tắc thứ bảy: người ta chịu ảnh hưởng mạnh nhất từ những người mà họ coi là cùng phe với mình.",
        "Quy trình tự vệ bốn bước: dừng lại, gọi tên nguyên tắc đang chạy, kiểm thông tin ở nguồn độc lập, và dời quyết định ra khỏi hiện trường.",
    ],
    "splitSections": True,
    "body": r"""
Ba nguyên tắc còn lại là ba nguyên tắc bị lạm dụng nhiều nhất trong quảng cáo và lừa đảo trực tuyến — nên bài này dành nửa sau cho phần tự vệ.

## Nguyên tắc 5 · Uy quyền

Người ta có xu hướng nghe theo người có chuyên môn hoặc có vị thế, vì đó là cách tiết kiệm công sức hợp lý: ta không thể tự kiểm chứng mọi thứ. Vấn đề nằm ở chỗ **cái tác động thường là dấu hiệu của uy quyền chứ không phải bản thân chuyên môn** — chức danh, đồng phục, bằng cấp trên tường, số người theo dõi.

| Bối cảnh | Ví dụ |
|---|---|
| Quảng cáo | Diễn viên mặc áo blouse trắng giới thiệu thuốc — chiếc áo làm việc, không phải kiến thức y khoa |
| Mạng xã hội | Tài khoản 500 nghìn người theo dõi khuyên về đầu tư; con số nói về sức hút, không nói về chuyên môn tài chính |
| Học thuật | Một tên tuổi lớn được trích dẫn để đỡ cho một kết luận nằm **ngoài** lĩnh vực của người đó |
| Nơi làm việc | Đề xuất được thông qua nhanh hơn khi người trình bày là trưởng nhóm, dù nội dung y hệt bản của thực tập sinh |
| Lừa đảo | Cuộc gọi tự xưng cán bộ cơ quan chức năng, đọc đúng vài thông tin cá nhân để tạo vẻ chính danh |

**Dùng cho trung thực:** nêu **cơ sở thật** của mình một cách gọn gàng — đã làm ba dự án tương tự, đây là số liệu, đây là chỗ tôi chưa chắc. Và khi trích dẫn người khác, trích đúng lĩnh vực của họ.

**Nhận ra khi bị dùng:** hai câu hỏi. *Người này có chuyên môn đúng lĩnh vực đang bàn không?* và *họ được lợi gì nếu mình tin?* Chức danh trả lời một phần câu đầu và không trả lời được câu sau.

> [!vi-du] Một khoá học đầu tư được quảng bá bởi người tự giới thiệu là "chuyên gia tài chính quốc tế", ảnh chụp cạnh siêu xe, hàng nghìn bình luận cảm ơn. Chạy hai câu hỏi: chuyên môn kiểm được ở đâu — có bằng cấp, có tổ chức nào chứng nhận, có bài viết nào bị phản biện công khai không? Và họ kiếm tiền từ đâu — từ đầu tư, hay từ chính học phí của bạn? Câu hỏi thứ hai thường trả lời xong cả vấn đề.

## Nguyên tắc 6 · Khan hiếm

Cái gì ít đi thì được đánh giá cao hơn, kể cả khi chất lượng không đổi. Cơ chế nằm ở chỗ **người ta ghét mất mát hơn là thích được thêm** — mất cơ hội là một mất mát, và cảm giác ấy đủ để cắt ngắn quá trình cân nhắc.

| Bối cảnh | Ví dụ |
|---|---|
| Ứng dụng học tập | "Ưu đãi chỉ còn 2 giờ" — rồi tuần sau lại đúng thông báo ấy |
| Sàn thương mại | "Chỉ còn 2 sản phẩm" · đồng hồ đếm ngược · "17 người đang xem món này" |
| Vé sự kiện | Vé hạng thường "sắp hết", trong khi vẫn mở bán suốt |
| Tuyển sinh | "Ưu đãi học phí chỉ áp dụng cho 20 hồ sơ đầu tiên" |
| Đời thường | Món ăn theo mùa, phiên bản giới hạn, đợt tuyển dụng "chỉ mở một lần trong năm" |

**Dùng cho trung thực:** chỉ nói khan hiếm **khi nó có thật** và nêu rõ lý do — lớp chỉ nhận 20 người vì phòng thực hành có 20 máy. Khan hiếm thật thì kiểm được; khan hiếm dựng lên sẽ lộ ở lần thứ hai và bạn mất luôn niềm tin của người mua.

**Nhận ra khi bị dùng:** đồng hồ đếm ngược lặp lại; số lượng còn lại không đổi qua nhiều ngày; áp lực phải quyết ngay tại chỗ. Ba phép thử rẻ: **quay lại sau vài ngày** xem ưu đãi có còn không; **tìm cùng sản phẩm ở nơi khác**; và hỏi mình **có định mua thứ này trước khi thấy đồng hồ đếm ngược không**.

> [!vi-du] Người bán liên tục nhấn "chỉ còn 2 sản phẩm thôi em, khách hỏi nhiều lắm". Cách ứng phó không phải là cãi hay bỏ đi cho nhanh. Hãy tách hai câu hỏi và nói thẳng: "Em cần món này không, và giá này có hợp lý không — hai chuyện đó không đổi vì còn hai hay hai mươi cái. Anh giữ giúp em tới chiều mai nhé, chiều mai em trả lời." Nếu người bán không giữ nổi tới chiều mai, thứ bạn vừa tránh được là một quyết định bị ép về thời gian.

## Nguyên tắc 7 · Đồng nhất

Cialdini bổ sung nguyên tắc này năm 2016. Nó mạnh hơn thiện cảm: không chỉ là "tôi quý người này" mà là **"người này là người của chúng ta"** — cùng gia đình, cùng quê, cùng trường, cùng nghề, cùng trải qua một chuyện.

| Bối cảnh | Ví dụ |
|---|---|
| Tuyển dụng | Hội cựu sinh viên giới thiệu việc cho nhau; hồ sơ cùng trường được đọc kỹ hơn |
| Đồng hương | "Anh cũng dân Nghệ An à" — cả cuộc trò chuyện đổi giọng từ đó |
| Cộng đồng nghề | Người trong nghề tin lời khuyên của người cùng nghề hơn của một chuyên gia ngoài ngành |
| Chiến dịch | "Sinh viên trường mình cùng nhau…" hiệu quả hơn "giới trẻ Việt Nam cùng nhau…" |
| Lừa đảo | Kẻ lừa đảo giả danh cùng hội, cùng nhóm sở thích, cùng nhóm phụ huynh của trường để tạo cảm giác an toàn |

**Dùng cho trung thực:** nói đúng cái chung có thật, và dùng nó để **cùng làm việc**, không phải để đòi ưu ái. Một nhóm học tập gọi mình là "nhóm mình" và có mục tiêu chung thì hợp tác tốt hơn — đó là mặt lành của nguyên tắc này.

**Nhận ra khi bị dùng:** người lạ nhấn mạnh điểm chung ngay từ đầu; cái chung ấy không kiểm được; và ngay sau đó là một đề nghị về tiền hoặc thông tin cá nhân.

## Tự vệ: bốn bước và những mẫu thiết kế đánh lừa

Các ứng dụng và trang bán hàng có cả một họ thủ thuật thiết kế nhằm đẩy bạn qua ngưỡng cân nhắc — thường gọi là **mẫu thiết kế đánh lừa**:

| Thủ thuật | Nó làm gì | Nguyên tắc bị lợi dụng |
|---|---|---|
| Đồng hồ đếm ngược lặp lại hằng tuần | Ép quyết định nhanh | Khan hiếm |
| "17 người đang xem sản phẩm này" | Tạo cảm giác đông và gấp | Bằng chứng xã hội + khan hiếm |
| Nút *Đồng ý* to và sáng, nút *Từ chối* mờ nhạt | Đẩy lựa chọn mặc định | Cam kết theo mặc định |
| Dùng thử miễn phí có tự động gia hạn | Tạo nghĩa vụ, rồi tính phí lặng lẽ | Đáp trả + nhất quán |
| Phí phát sinh chỉ hiện ở bước cuối | Người đã đi tới đó thì ngại quay lại | Cam kết và nhất quán |
| "Không, tôi không muốn tiết kiệm tiền" | Bắt bạn tự phủ nhận điều tốt để từ chối | Nhất quán + cảm giác tội lỗi |

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.8rem">Bốn bước tự vệ trước một đề nghị gấp gáp</div>
  <div style="display:grid;gap:.45rem;font-size:1.05rem">
    <div style="background:rgba(217,150,40,.14);border-radius:.4rem;padding:.6rem .8rem"><b>1 · Dừng lại khi thấy gấp</b> — cảm giác phải quyết ngay chính là tín hiệu cần chậm lại, không phải tín hiệu cần nhanh lên</div>
    <div style="background:rgba(13,148,136,.16);border:2px solid rgba(13,148,136,.6);border-radius:.4rem;padding:.6rem .8rem"><b>2 · Gọi tên nguyên tắc đang chạy</b> — đáp trả? khan hiếm? uy quyền? số đông? Gọi được tên là gỡ được một phần sức ép</div>
    <div style="background:rgba(59,130,246,.14);border-radius:.4rem;padding:.6rem .8rem"><b>3 · Kiểm ở nguồn độc lập</b> — mở tab mới tìm tên người bán, tìm cùng sản phẩm chỗ khác, hỏi một người không liên quan tới thương vụ</div>
    <div style="background:rgba(139,92,246,.14);border-radius:.4rem;padding:.6rem .8rem"><b>4 · Dời quyết định ra khỏi hiện trường</b> — “để tôi về xem lại, mai trả lời” là một câu hoàn chỉnh, không cần giải thích thêm</div>
  </div>
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);margin-top:.8rem;line-height:1.6">Bước 4 là bước mạnh nhất: gần như mọi thủ thuật đều mất tác dụng khi bạn quyết ở nhà thay vì quyết tại quầy.</div>
</div>
```

> [!canh-bao] Biết tên bảy nguyên tắc **không miễn nhiễm cho bạn**. Cialdini nhấn mạnh chúng chạy tự động; người học về chúng vẫn bị tác động. Thứ thật sự bảo vệ bạn là **quy trình** — dời quyết định, kiểm nguồn độc lập — chứ không phải kiến thức.

> [!vi-du] Một ứng dụng học tiếng Anh liên tục báo "ưu đãi chỉ còn hôm nay" suốt ba tuần liền. Chạy bốn bước: (1) dừng — mình đang thấy gấp; (2) gọi tên — khan hiếm, và là khan hiếm giả vì thông báo lặp lại; (3) kiểm — chụp màn hình tuần trước, tìm mã giảm giá ở nơi khác, đọc đánh giá ba sao; (4) dời — nếu tuần sau vẫn muốn học thì mua, và nếu ưu đãi thật sự hết thì đó là bằng chứng nó có thật. Kết quả thường thấy: ưu đãi vẫn còn, và mong muốn mua thì đã nguội.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Mở ba ứng dụng bạn hay dùng (mua sắm, giao đồ ăn, học tập) và tìm **ít nhất bốn mẫu thiết kế đánh lừa** trong bảng trên. Chụp màn hình, ghi rõ thủ thuật nào, lợi dụng nguyên tắc nào, và nó khiến bạn suýt làm gì.

### Nhóm 3–4 người (25 phút)

Đóng vai hai lượt. Lượt một: một người bán hàng dùng **khan hiếm giả** và **đáp trả** để ép mua; người kia luyện chạy đủ bốn bước tự vệ, đặc biệt là câu dời quyết định. Lượt hai: đổi vai, lần này người bán dùng **uy quyền vay mượn** và **đồng nhất** (cùng trường, cùng quê). Cả nhóm ghi lại: câu nào của người mua có tác dụng cắt sức ép nhanh nhất.

### Bài tập về nhà (45–60 phút)

Viết một trang phân tích một chiến dịch quảng cáo hoặc một vụ lừa đảo trực tuyến có thật mà bạn hoặc người quen từng gặp: nó dùng những nguyên tắc nào, theo thứ tự nào; chỗ nào nó vượt ranh giới thành thao túng theo ba câu hỏi ở bài 8.1; và một quy tắc cá nhân bạn đặt cho mình sau khi phân tích — viết ở dạng hành vi cụ thể, ví dụ "không quyết bất kỳ khoản chi trên 500 nghìn nào ngay tại chỗ".

### Xem thêm

- 🎬 [7 Principles of Psychological Persuasion](https://www.youtube.com/watch?v=P3rbadeF9AI) — Sprouts, 6 phút.
- 🎬 [Robert Cialdini Explains the Seven Principles of Influence](https://www.youtube.com/watch?v=1_urunjhCsw) — Roger Dooley phỏng vấn Cialdini, 5 phút. Chính tác giả nói về nguyên tắc thứ bảy — đồng nhất.
- 🎬 [Can You Outsmart a Troll (by Thinking Like One)?](https://www.youtube.com/watch?v=Iu4OdhjnN4I) — Claire Wardle, TED-Ed, 5 phút. Cùng bộ kỹ thuật ấy khi được dùng để lan tin sai.

### Nguồn tham khảo

- Cialdini, R. B. (2021). *Influence: The Psychology of Persuasion* (new and expanded ed.). New York: Harper Business — nguyên tắc thứ bảy, đồng nhất, được bổ sung trong *Pre-Suasion* (2016) và bản mở rộng này.
- Cialdini, R. B. (2016). *Pre-Suasion: A Revolutionary Way to Influence and Persuade.* New York: Simon & Schuster.
- Kahneman, D., & Tversky, A. (1979). Prospect theory: An analysis of decision under risk. *Econometrica*, 47(2), 263–291 — cơ sở của việc ghét mất mát, nền tảng tâm lý của khan hiếm.
- Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). Dark patterns at scale: Findings from a crawl of 11K shopping websites. *Proceedings of the ACM on Human-Computer Interaction*, 3(CSCW), 1–32.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 8.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "8.3-uy-quyen",
                "type": "mcq",
                "prompt": "Nguyên tắc uy quyền hiệu quả vì lý do nào?",
                "explanation": "Tin người có chuyên môn là cách tiết kiệm công sức hợp lý, vì ta không thể tự kiểm chứng mọi thứ — nhưng cái tác động thường là dấu hiệu uy quyền chứ không phải chuyên môn thật.",
                "points": 2,
                "options": [
                    {"label": "Vì tin người có chuyên môn là cách tiết kiệm công sức hợp lý — nhưng thứ tác động thường chỉ là dấu hiệu của uy quyền", "isCorrect": True},
                    {"label": "Vì người có chức danh cao thì hầu như luôn đúng", "isCorrect": False, "misconception": "knm.authority-symbols"},
                    {"label": "Vì người ta sợ bị phản đối nếu không nghe theo cấp trên", "isCorrect": False},
                    {"label": "Vì chuyên gia luôn có lợi ích trùng với người nghe", "isCorrect": False, "misconception": "knm.authority-symbols"},
                ],
            },
            {
                "key": "8.3-khan-hiem-tam-ly",
                "type": "mcq",
                "prompt": "Nguyên tắc khan hiếm hoạt động dựa trên tâm lý nào?",
                "explanation": "Con người ghét mất mát hơn thích được thêm; mất một cơ hội là một mất mát, và cảm giác đó rút ngắn quá trình cân nhắc.",
                "points": 2,
                "options": [
                    {"label": "Ghét mất mát hơn thích được thêm — mất cơ hội là mất mát, nên người ta quyết vội hơn", "isCorrect": True},
                    {"label": "Thích sở hữu những thứ đắt tiền", "isCorrect": False},
                    {"label": "Tin rằng sản phẩm ít người mua thì chất lượng cao hơn", "isCorrect": False},
                    {"label": "Muốn giống với những người đã mua trước", "isCorrect": False},
                ],
            },
            {
                "key": "8.3-dau-hieu-khan-hiem",
                "type": "mcq",
                "prompt": "Dấu hiệu nào cho thấy người khác đang dùng khan hiếm giả để thuyết phục bạn?",
                "explanation": "Khan hiếm giả lộ ra ở chỗ lặp lại: đồng hồ đếm ngược xuất hiện đều đặn, số lượng còn lại không đổi qua nhiều ngày, và luôn kèm áp lực quyết ngay.",
                "points": 2,
                "options": [
                    {"label": "Thông báo sắp hết được lặp lại đều đặn, số lượng còn lại không đổi qua nhiều ngày, kèm áp lực quyết ngay tại chỗ", "isCorrect": True},
                    {"label": "Sản phẩm có giá cao hơn mặt bằng chung", "isCorrect": False},
                    {"label": "Người bán mô tả chi tiết thông số kỹ thuật", "isCorrect": False},
                    {"label": "Cửa hàng có nhiều khách xếp hàng", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                ],
            },
            {
                "key": "8.3-ung-pho-2-san-pham",
                "type": "mcq",
                "prompt": "Người bán liên tục nhấn mạnh chỉ còn 2 sản phẩm để bạn quyết định nhanh. Cách ứng phó phù hợp là gì?",
                "explanation": "Tách nhu cầu và giá khỏi số lượng còn lại, rồi dời quyết định ra khỏi hiện trường — nếu bên bán không giữ được tới hôm sau thì chính điều đó đã là thông tin.",
                "points": 3,
                "options": [
                    {"label": "Tự hỏi mình có cần món này không và giá có hợp lý không, rồi đề nghị giữ hàng tới hôm sau để quyết ở nhà", "isCorrect": True},
                    {"label": "Mua ngay vì cơ hội có thể mất", "isCorrect": False, "misconception": "knm.scarcity-always-real"},
                    {"label": "Tranh luận với người bán rằng đó là chiêu bán hàng", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                    {"label": "Hỏi xem có bao nhiêu người đã mua để yên tâm hơn", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                ],
            },
            {
                "key": "8.3-app-uu-dai",
                "type": "mcq",
                "prompt": "Một ứng dụng học tiếng Anh liên tục thông báo ưu đãi chỉ còn hôm nay, tuần nào cũng vậy. Cách xử lý phù hợp nhất là gì?",
                "explanation": "Đây là khan hiếm giả — lộ ra ở chỗ lặp lại. Bốn bước tự vệ: dừng, gọi tên nguyên tắc, kiểm ở nguồn độc lập, và dời quyết định ra khỏi thời điểm bị ép.",
                "points": 3,
                "options": [
                    {"label": "Nhận ra đây là khan hiếm giả vì thông báo lặp lại, kiểm giá và đánh giá ở nơi khác, rồi quyết sau vài ngày nếu vẫn thấy cần", "isCorrect": True},
                    {"label": "Mua ngay hôm nay để không mất ưu đãi", "isCorrect": False, "misconception": "knm.scarcity-always-real"},
                    {"label": "Gỡ ứng dụng vì mọi quảng cáo đều là lừa đảo", "isCorrect": False, "misconception": "knm.critical-is-negative"},
                    {"label": "Hỏi bạn bè xem có ai mua chưa rồi làm theo số đông", "isCorrect": False, "misconception": "knm.authority-or-crowd"},
                ],
            },
            {
                "key": "8.3-dong-nhat",
                "type": "mcq",
                "prompt": "Nguyên tắc đồng nhất (unity) khác thiện cảm ở chỗ nào?",
                "explanation": "Thiện cảm là tôi quý người này; đồng nhất là người này thuộc về nhóm của tôi — cùng trường, cùng quê, cùng nghề, cùng trải qua một chuyện — và nó tác động mạnh hơn.",
                "points": 2,
                "options": [
                    {"label": "Thiện cảm là tôi quý người này; đồng nhất là người này thuộc về nhóm của tôi, nên ảnh hưởng mạnh hơn", "isCorrect": True},
                    {"label": "Đồng nhất chỉ áp dụng trong gia đình, thiện cảm thì áp dụng ngoài xã hội", "isCorrect": False},
                    {"label": "Đồng nhất là nguyên tắc cũ hơn và ít hiệu quả hơn", "isCorrect": False},
                    {"label": "Hai nguyên tắc này giống nhau, chỉ khác tên gọi", "isCorrect": False},
                ],
            },
            {
                "key": "8.3-bon-buoc-tu-ve",
                "type": "ordering",
                "prompt": "Sắp xếp bốn bước tự vệ trước một đề nghị gấp gáp theo đúng trình tự.",
                "explanation": "Dừng khi thấy gấp, gọi tên nguyên tắc đang chạy, kiểm thông tin ở nguồn độc lập, và cuối cùng dời quyết định ra khỏi hiện trường.",
                "points": 3,
                "sequence": [
                    "Dừng lại ngay khi nhận ra mình đang thấy gấp",
                    "Gọi tên nguyên tắc gây ảnh hưởng đang được dùng",
                    "Kiểm thông tin ở một nguồn độc lập với người bán",
                    "Dời quyết định ra khỏi hiện trường: về nhà rồi trả lời",
                ],
            },
            {
                "key": "8.3-viet-phan-tich",
                "type": "essay",
                "prompt": "Chọn một chiến dịch quảng cáo hoặc một vụ lừa đảo trực tuyến bạn hoặc người quen từng gặp. Viết 200–300 từ: (a) nó dùng những nguyên tắc nào, theo thứ tự nào; (b) chỗ nào vượt ranh giới thành thao túng theo ba câu hỏi ở bài 8.1; (c) bốn bước tự vệ áp vào tình huống đó sẽ diễn ra thế nào; (d) một quy tắc cá nhân bạn đặt cho mình, viết ở dạng hành vi cụ thể.",
                "points": 5,
            },
        ],
    },
}

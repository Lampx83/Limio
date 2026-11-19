# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 7.2 · Thiết kế slide và hỗ trợ trực quan",
    "durationMin": 45,
    "description": "Bài học giải thích vì sao slide nhiều chữ làm khán giả ngừng nghe, trình bày các quy tắc về số dòng, cỡ chữ và kiểu chữ, cách dùng hình ảnh và biểu đồ đúng mục đích, và cách thuyết trình đề tài kỹ thuật cho khán giả ngoài ngành.",
    "objectives": [
        "Giải thích được vì sao đọc nguyên văn slide làm giảm hiệu quả thuyết trình",
        "Áp dụng được quy tắc về lượng chữ, cỡ chữ và kiểu chữ trên slide",
        "Lựa chọn được hình ảnh và biểu đồ phục vụ thông điệp thay vì chỉ để trang trí",
        "Chuyển đổi được một nội dung kỹ thuật thành slide phù hợp với khán giả ngoài ngành",
    ],
    "summary": [
        "Khán giả thường đọc nhanh hơn tốc độ người nói, nên slide nhiều chữ khiến họ đọc xong trước rồi ngừng nghe. Việc đọc chữ và nghe lời nói cùng lúc nhiều khả năng cạnh tranh nhau về năng lực xử lý chứ không bổ sung cho nhau.",
        "Mỗi slide nên chứa một ý, ít dòng chữ, cỡ chữ đủ lớn để đọc từ cuối phòng, và kiểu chữ đơn giản, nhất quán.",
        "Hình ảnh phải phục vụ nội dung, đủ nét và có nguồn; ảnh trang trí và hiệu ứng thừa chỉ làm phân tán chú ý. Mỗi biểu đồ trả lời một câu hỏi và có trục trung thực.",
        "Với khán giả ngoài ngành, người trình bày bỏ hoặc giải thích thuật ngữ, đổi công thức thành ví dụ và giữ lại đúng phần khán giả có thể sử dụng.",
    ],
    "splitSections": True,
    "body": r"""
Slide không phải là bài thuyết trình. Slide là **chỗ dựa thị giác** (*visual aid*) cho bài nói; khi bị dùng sai vai trò, nó trở thành thứ cạnh tranh với chính người nói. Trong bài này, slide được thiết kế đúng vai trò hỗ trợ ấy được gọi là *slide dựa*.

## Vì sao slide nhồi chữ làm hỏng bài nói

Khán giả thường đọc nhanh hơn tốc độ bạn nói. Khi slide đầy chữ, họ đọc xong trước rồi **ngừng nghe**, và phần còn lại của bài nói trở thành âm thanh nền. Ngoài ra, việc đọc chữ trên màn hình và nghe lời nói cùng lúc là hai luồng ngôn ngữ cùng chiếm dụng trí nhớ làm việc (*working memory*). Nguyên tắc dư thừa (*redundancy principle*) và lý thuyết tải nhận thức (*cognitive load theory*) đều gợi ý rằng hai kênh ấy cạnh tranh với nhau chứ không cộng lại (Mayer, 2021; Sweller và cộng sự, 2011).

Vì vậy, bạn **không nên đọc nguyên văn slide**. Nếu mọi nội dung cần nói đều nằm trên slide thì bài nói không còn cần người trình bày, và chỉ cần gửi tệp cho khán giả là đủ. Cách phân chia phù hợp là slide giữ **từ khoá, con số và hình**, lời nói giữ **câu chuyện, giải thích và chuyển ý**, còn tài liệu chi tiết được phát riêng sau buổi nói.

```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:.8rem;margin:1.2rem 0">
  <div style="border:1px solid rgba(217,150,40,.5);border-radius:.6rem;overflow:hidden">
    <div style="background:rgba(217,150,40,.16);padding:.5rem .8rem;font-weight:700;color:rgb(165,113,29)">Slide nhồi chữ — khán giả đọc, không nghe</div>
    <div style="padding:.8rem;font-size:.95rem;line-height:1.45">
      <div style="font-weight:700;margin-bottom:.4rem">Kết quả khảo sát sinh viên năm cuối về hoạt động thực tập</div>
      Theo khảo sát được thực hiện trong tháng 9 năm 2026 trên 412 sinh viên năm cuối thuộc bốn khoa, có 68% sinh viên cho biết đã tham gia thực tập tại doanh nghiệp, trong đó 41% cho biết công việc thực tập có liên quan trực tiếp tới chuyên ngành đang học, 27% cho biết công việc chỉ liên quan một phần, và 32% còn lại chưa từng tham gia thực tập vì các lý do khác nhau như thiếu thông tin, không sắp xếp được thời gian, hoặc chưa tìm được vị trí phù hợp với năng lực…
    </div>
  </div>
  <div style="border:2px solid rgba(13,148,136,.6);border-radius:.6rem;overflow:hidden">
    <div style="background:rgba(13,148,136,.16);padding:.5rem .8rem;font-weight:700;color:rgb(12,141,129)">Slide dựa — khán giả nghe, mắt chỉ liếc</div>
    <div style="padding:1.2rem .8rem;text-align:center">
      <div style="font-size:1.4rem;font-weight:700;margin-bottom:1rem">Thực tập: đúng ngành mới là vấn đề</div>
      <div style="font-size:2.6rem;font-weight:800;color:rgb(12,141,129);line-height:1.1">41%</div>
      <div style="font-size:1.05rem;margin-top:.3rem">thực tập đúng chuyên ngành</div>
      <div style="font-size:.95rem;opacity:.75;margin-top:.9rem">n = 412 · khảo sát 9/2026</div>
    </div>
  </div>
</div>
```

Hai slide trên chứa **cùng một dữ liệu**. Bản bên trái buộc khán giả phải chọn giữa đọc và nghe, còn bản bên phải để họ nghe người trình bày kể phần còn lại: 68% có thực tập nhưng chỉ 41% thực tập đúng ngành, và đó mới là điểm đáng bàn.

## Quy tắc chữ trên slide

| Yếu tố | Khuyến nghị | Lý do |
|---|---|---|
| Số dòng chữ | Tối đa khoảng **6 dòng** trên mỗi slide, mỗi dòng ngắn gọn. | Nếu nhiều hơn, khán giả có xu hướng chuyển sang đọc thay vì nghe. |
| Số ý | Mỗi slide chỉ nên có một ý. | Khi có hai ý trên một slide, ý thứ hai dễ bị lướt qua. |
| Cỡ chữ | Cỡ chữ đủ lớn để đọc từ hàng cuối, và tiêu đề lớn hơn nội dung rõ rệt. | Người ngồi xa không đọc được thì slide không còn giá trị với họ. |
| Kiểu chữ | Dùng chữ không chân, đơn giản và nhất quán trong cả bài, với tối đa hai kiểu chữ. | Chữ trang trí có thể làm giảm tốc độ đọc. |
| Tương phản | Dùng chữ tối trên nền sáng hoặc ngược lại, và tránh nền ảnh rối. | Phòng chiếu thường sáng hơn màn hình máy tính của bạn. |

> [!meo] Bạn có thể kiểm tra bằng cách chiếu slide lên rồi lùi ra cuối phòng. Nếu không đọc được từ vị trí đó thì cỡ chữ chưa đạt. Đây là lỗi thường gặp, vì lúc soạn slide chúng ta thường nhìn màn hình ở khoảng cách khoảng 50 cm.

## Hình ảnh và biểu đồ

Nguyên tắc chung là **hình phải phục vụ nội dung**, với ba yêu cầu cụ thể sau.

- Hình **liên quan trực tiếp** tới ý đang nói. Ảnh chỉ để trang trí làm phân tán chú ý mà không bổ sung thông tin nào, điều này phù hợp với nguyên tắc mạch lạc (*coherence principle*) trong thiết kế học tập đa phương tiện (Mayer, 2021).
- Hình **đủ nét và đủ lớn**, đồng thời không bị kéo méo tỉ lệ.
- Hình **có nguồn** được ghi ngay dưới hình. Khi sử dụng lại hình của người khác trong học liệu, đây là yêu cầu bắt buộc chứ không chỉ là phép lịch sự.

Với biểu đồ, mỗi biểu đồ nên trả lời **một câu hỏi**. Câu trả lời nên được ghi ngay ở tiêu đề biểu đồ, chẳng hạn “Tỉ lệ thực tập đúng ngành giảm dần theo khoá”, thay vì một nhãn trung tính như “Biểu đồ 3”. Trục cần bắt đầu từ 0 khi so sánh độ lớn. Việc cắt trục để phóng đại khác biệt là kỹ thuật gây hiểu lầm mà bạn đã học cách nhận ra ở bài 3.3, vì vậy không nên áp dụng nó trên slide của mình.

## Khi khán giả không cùng chuyên ngành

Đây là tình huống sinh viên có thể gặp khi bảo vệ đồ án trước hội đồng có thành viên ngoài chuyên môn hẹp, hoặc khi thuyết trình cho khách hàng. Bảng dưới đây tóm tắt các việc cần làm.

| Việc cần làm | Cụ thể |
|---|---|
| Bỏ thuật ngữ, hoặc giải thích ngay lần đầu | “độ chính xác của mô hình” → “trong 100 bài chấm, máy chấm trùng với giáo viên bao nhiêu bài” |
| Đổi công thức thành ví dụ có số | Thay vì trình bày công thức, cho một trường hợp cụ thể chạy qua công thức đó. |
| Cắt phần chỉ người trong ngành mới quan tâm | Đưa kiến trúc kỹ thuật và tham số vào phụ lục để trả lời khi được hỏi. |
| Giữ lại phần khán giả dùng được | Giữ lại kết quả, giới hạn và việc khán giả có thể làm với kết quả đó. |
| Dùng phép so sánh quen thuộc | Đồng thời nói rõ chỗ phép so sánh ấy không còn đúng. |

> [!canh-bao] Đơn giản hoá **không phải** là nói sai cho dễ hiểu. Nếu một phép so sánh làm sai bản chất, bạn cần nói thêm một câu về giới hạn của nó. Khán giả ngoài ngành khó tự kiểm chứng điều bạn nói, và vì vậy trách nhiệm nói đúng của người trình bày càng lớn hơn chứ không nhẹ đi.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Hãy lấy một bộ slide bạn đã làm, chọn slide nhiều chữ nhất và làm lại thành **hai slide dựa**: một slide giữ con số hoặc từ khoá chính, một slide giữ hình hoặc biểu đồ. Sau đó viết ra phần bạn sẽ **nói** thay cho phần chữ đã bỏ đi, đúng như bạn sẽ nói thành lời.

### Nhóm 3–4 người (25 phút)

Mỗi người chiếu ba slide của mình lên, bằng điện thoại hoặc máy tính đặt cách 3 mét. Nhóm đánh giá theo bốn tiêu chí: slide có đọc được từ xa hay không, mỗi slide có đúng một ý hay không, hình có phục vụ nội dung hay không, và **người trình bày có thể bỏ slide này mà bài vẫn mạch lạc hay không**. Tiêu chí cuối cùng giúp loại ra những slide chỉ tồn tại để lấp đầy bài.

### Bài tập về nhà (45–60 phút)

Hãy chọn một nội dung kỹ thuật hoặc chuyên ngành của bạn và làm hai phiên bản slide cho cùng một ý: một cho người trong ngành, một cho người ngoài ngành. Bạn nộp kèm nửa trang nêu rõ bạn đã bỏ thuật ngữ nào và thay bằng gì, phép so sánh bạn dùng cùng **giới hạn của phép so sánh đó**, và phần nào bạn chuyển sang phụ lục.

### Xem thêm

- 🎬 [How to Avoid Death by PowerPoint](https://www.youtube.com/watch?v=Iwpi1Lm6dFo) — David JP Phillips, TEDxStockholmSalon, 20 phút. Bài nói giải thích bằng chính các slide minh hoạ vì sao slide nhồi chữ làm giảm khả năng tiếp nhận của khán giả.

### Nguồn tham khảo

- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.). Cambridge University Press — nguyên tắc mạch lạc và nguyên tắc dư thừa.
- Sweller, J., Ayres, P., & Kalyuga, S. (2011). *Cognitive Load Theory.* New York: Springer.
- Reynolds, G. (2019). *Presentation Zen: Simple Ideas on Presentation Design and Delivery* (3rd ed.). Berkeley: New Riders.
- Tufte, E. R. (2001). *The Visual Display of Quantitative Information* (2nd ed.). Cheshire: Graphics Press.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 7.2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "7.2-doc-slide",
                "type": "mcq",
                "prompt": "Vì sao nên hạn chế đọc nguyên văn slide khi thuyết trình?",
                "explanation": "Khán giả đọc nhanh hơn người nói nên họ đọc xong trước rồi ngừng nghe; ngoài ra đọc chữ và nghe lời cùng lúc là hai luồng ngôn ngữ cạnh tranh cùng một chỗ trong trí nhớ làm việc.",
                "points": 2,
                "options": [
                    {"label": "Vì khán giả đọc nhanh hơn người nói nên sẽ ngừng nghe, và việc vừa đọc vừa nghe cùng nội dung làm giảm khả năng tiếp nhận", "isCorrect": True},
                    {"label": "Vì đọc slide khiến bài nói kéo dài hơn dự kiến", "isCorrect": False},
                    {"label": "Vì người trình bày cần thể hiện là mình đã thuộc bài", "isCorrect": False},
                    {"label": "Không sao cả, đọc slide giúp khán giả theo dõi dễ hơn", "isCorrect": False, "misconception": "knm.slide-is-document"},
                ],
            },
            {
                "key": "7.2-so-dong-chu",
                "type": "mcq",
                "prompt": "Khi trình bày thông tin bằng chữ trên slide, nguyên tắc nào phù hợp?",
                "explanation": "Mỗi slide một ý, ít dòng chữ (khoảng tối đa sáu dòng ngắn), cỡ chữ đủ lớn để đọc từ cuối phòng và kiểu chữ đơn giản, nhất quán.",
                "points": 2,
                "options": [
                    {"label": "Mỗi slide một ý, tối đa khoảng sáu dòng ngắn, cỡ chữ đủ lớn để đọc từ hàng cuối", "isCorrect": True},
                    {"label": "Ghi đầy đủ nội dung để khán giả không bỏ sót thông tin nào", "isCorrect": False, "misconception": "knm.slide-is-document"},
                    {"label": "Dùng nhiều kiểu chữ khác nhau cho slide sinh động", "isCorrect": False},
                    {"label": "Cỡ chữ nhỏ để chứa được nhiều nội dung hơn trên một slide", "isCorrect": False, "misconception": "knm.slide-is-document"},
                ],
            },
            {
                "key": "7.2-hinh-anh",
                "type": "mcq",
                "prompt": "Khi sử dụng hình ảnh trên slide, nguyên tắc nào phù hợp?",
                "explanation": "Hình phải liên quan trực tiếp tới nội dung đang nói, đủ nét, không bị kéo méo và có ghi nguồn; ảnh trang trí chỉ làm phân tán chú ý mà không bổ sung thông tin.",
                "points": 2,
                "options": [
                    {"label": "Hình liên quan trực tiếp tới ý đang nói, đủ nét, giữ đúng tỉ lệ và có ghi nguồn", "isCorrect": True},
                    {"label": "Càng nhiều hình càng sinh động, kể cả hình chỉ để trang trí", "isCorrect": False, "misconception": "knm.slide-is-document"},
                    {"label": "Nên phủ kín nền slide bằng ảnh rồi đặt chữ lên trên", "isCorrect": False},
                    {"label": "Không cần ghi nguồn nếu chỉ dùng trong nội bộ lớp học", "isCorrect": False},
                ],
            },
            {
                "key": "7.2-khan-gia-khac-nganh",
                "type": "mcq",
                "prompt": "Bạn được yêu cầu thuyết trình một đề tài kỹ thuật trước khán giả không cùng chuyên ngành. Bạn nên làm gì?",
                "explanation": "Bỏ hoặc giải thích ngay thuật ngữ, đổi công thức thành ví dụ có số, chuyển phần chuyên sâu vào phụ lục và giữ lại phần khán giả dùng được, đồng thời nêu giới hạn của các phép so sánh.",
                "points": 3,
                "options": [
                    {"label": "Bỏ thuật ngữ hoặc giải thích ngay lần đầu, đổi công thức thành ví dụ có số, chuyển phần chuyên sâu vào phụ lục, giữ lại kết quả và giới hạn", "isCorrect": True},
                    {"label": "Thuyết trình như với người trong ngành, ai không hiểu thì hỏi sau", "isCorrect": False, "misconception": "knm.audience-is-me"},
                    {"label": "Dùng thật nhiều thuật ngữ để thể hiện chiều sâu chuyên môn", "isCorrect": False, "misconception": "knm.jargon-professional"},
                    {"label": "Đơn giản hoá tối đa, kể cả khi phép so sánh làm sai bản chất vấn đề", "isCorrect": False},
                ],
            },
            {
                "key": "7.2-bieu-do",
                "type": "mcq",
                "prompt": "Một biểu đồ trên slide nên được thiết kế thế nào?",
                "explanation": "Mỗi biểu đồ trả lời một câu hỏi, và câu trả lời nên nằm ngay ở tiêu đề; trục phải trung thực, không cắt để phóng đại khác biệt.",
                "points": 2,
                "options": [
                    {"label": "Trả lời đúng một câu hỏi, ghi kết luận ngay ở tiêu đề, trục trung thực không cắt để phóng đại", "isCorrect": True},
                    {"label": "Hiển thị càng nhiều chuỗi số liệu càng tốt để thể hiện công sức", "isCorrect": False, "misconception": "knm.slide-is-document"},
                    {"label": "Đặt tiêu đề trung tính kiểu Biểu đồ 3 để giữ tính khách quan", "isCorrect": False},
                    {"label": "Cắt trục tung để khác biệt giữa các cột nhìn rõ hơn", "isCorrect": False, "misconception": "knm.correlation-causation"},
                ],
            },
            {
                "key": "7.2-noi-slide",
                "type": "matching",
                "prompt": "Nối mỗi loại nội dung với chỗ nó nên nằm.",
                "explanation": "Slide giữ từ khoá, con số và hình; lời nói giữ giải thích và câu chuyện; chi tiết đầy đủ nằm ở tài liệu phát riêng; phần chuyên sâu để phụ lục chờ câu hỏi.",
                "points": 3,
                "pairs": [
                    {"left": "Con số 41% và một dòng chú thích cỡ mẫu", "right": "Trên slide"},
                    {"left": "Giải thích vì sao con số đó đáng lo", "right": "Trong lời nói của bạn"},
                    {"left": "Bảng số liệu đầy đủ 12 dòng", "right": "Tài liệu phát riêng"},
                    {"left": "Tham số kỹ thuật của mô hình", "right": "Slide phụ lục, chờ được hỏi"},
                ],
            },
            {
                "key": "7.2-viet-slide",
                "type": "essay",
                "prompt": "Lấy slide nhiều chữ nhất trong một bộ slide bạn đã làm. Viết 150–250 từ: (a) chép lại nội dung slide gốc; (b) mô tả hai slide dựa bạn tách ra từ nó (mỗi slide một ý, ghi rõ chữ và hình sẽ giữ); (c) viết nguyên văn phần bạn sẽ nói thay cho lượng chữ đã bỏ đi.",
                "points": 5,
            },
        ],
    },
}

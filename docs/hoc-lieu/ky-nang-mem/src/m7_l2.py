# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 7.2 · Thiết kế slide và hỗ trợ trực quan",
    "durationMin": 45,
    "description": "Vì sao slide nhồi chữ làm khán giả ngừng nghe; quy tắc về số dòng, cỡ chữ và kiểu chữ; dùng hình ảnh và biểu đồ đúng cách; và cách trình bày đề tài kỹ thuật cho người ngoài ngành.",
    "objectives": [
        "Giải thích được vì sao đọc nguyên văn slide làm giảm hiệu quả trình bày",
        "Áp dụng được quy tắc về lượng chữ, cỡ chữ và kiểu chữ trên slide",
        "Chọn được hình ảnh và biểu đồ phục vụ thông điệp thay vì trang trí",
        "Chuyển được một nội dung kỹ thuật thành slide cho khán giả ngoài ngành",
    ],
    "summary": [
        "Khán giả đọc nhanh hơn người nói: slide nhiều chữ khiến họ đọc xong trước rồi ngừng nghe — hai kênh cùng tải chữ thì cạnh tranh nhau chứ không cộng lại.",
        "Mỗi slide một ý, ít dòng chữ, cỡ chữ đủ lớn để đọc từ cuối phòng, kiểu chữ đơn giản và nhất quán.",
        "Hình ảnh phải phục vụ nội dung, đủ nét, có nguồn; ảnh trang trí và hiệu ứng thừa chỉ lấy mất chú ý.",
        "Với khán giả ngoài ngành: bỏ thuật ngữ, đổi công thức thành ví dụ, và giữ lại đúng phần họ dùng được.",
    ],
    "body": r"""
Slide không phải bài thuyết trình. Nó là **chỗ dựa thị giác** cho bài nói — và khi bị dùng sai vai, nó trở thành thứ cạnh tranh với chính người nói.

## Vì sao slide nhồi chữ làm hỏng bài nói

Khán giả đọc nhanh hơn tốc độ bạn nói. Khi slide đầy chữ, họ đọc xong trước, rồi **ngừng nghe** — phần còn lại của bạn thành nền. Tệ hơn, đọc chữ trên màn hình và nghe lời nói cùng lúc là hai luồng ngôn ngữ cạnh tranh cùng một chỗ trong trí nhớ làm việc; hai kênh ấy không cộng lại mà trừ nhau.

Vì vậy: **đừng đọc nguyên văn slide**. Nếu mọi thứ cần nói đều nằm trên slide thì bài nói không cần bạn — gửi file là đủ. Cách chia đúng: slide giữ **từ khoá, con số, hình**; miệng giữ **câu chuyện, giải thích, chuyển ý**; tài liệu chi tiết phát riêng sau buổi nói.

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

Hai slide trên chứa **cùng một dữ liệu**. Bản bên trái buộc người nghe chọn giữa đọc và nghe; bản bên phải để họ nghe bạn kể phần còn lại — 68% có thực tập, nhưng chỉ 41% đúng ngành, và đó mới là chỗ đáng bàn.

## Quy tắc chữ trên slide

| Yếu tố | Khuyến nghị | Lý do |
|---|---|---|
| Số dòng chữ | Ít, khoảng **tối đa 6 dòng** một slide; mỗi dòng ngắn gọn | Nhiều hơn thì khán giả chuyển sang chế độ đọc |
| Số ý | Một slide một ý | Hai ý trên một slide thì ý thứ hai luôn bị lướt |
| Cỡ chữ | Đủ lớn để đọc từ hàng cuối; tiêu đề lớn hơn nội dung rõ rệt | Người ngồi xa không đọc được thì slide vô nghĩa với họ |
| Kiểu chữ | Chữ không chân, đơn giản, dùng nhất quán cả bài; tối đa hai kiểu | Chữ trang trí làm giảm tốc độ đọc |
| Tương phản | Chữ đậm trên nền sáng hoặc ngược lại, tránh nền ảnh rối | Phòng chiếu thường sáng hơn màn hình máy bạn |

> [!meo] Phép thử phòng chiếu: chiếu slide lên rồi lùi ra cuối phòng. Đọc không nổi từ đó thì cỡ chữ chưa đạt — và đây là lỗi phổ biến nhất, vì lúc soạn ta luôn nhìn màn hình cách mắt 50 cm.

## Hình ảnh và biểu đồ

Nguyên tắc gọn: **hình phải phục vụ nội dung**. Ba yêu cầu cụ thể:

- **Liên quan trực tiếp** tới ý đang nói. Ảnh trang trí cho đẹp lấy mất chú ý mà không thêm thông tin nào — đúng nguyên tắc mạch lạc trong thiết kế đa phương tiện.
- **Đủ nét và đủ lớn**, không kéo méo tỉ lệ.
- **Có nguồn**, ghi ngay dưới hình. Với học liệu dùng lại hình của người khác, đây là yêu cầu bắt buộc chứ không phải phép lịch sự.

Với biểu đồ: mỗi biểu đồ trả lời **một câu hỏi**. Ghi câu trả lời ngay ở tiêu đề biểu đồ ("Tỉ lệ thực tập đúng ngành giảm dần theo khoá") thay vì một nhãn trung tính ("Biểu đồ 3"). Trục phải bắt đầu từ 0 nếu so sánh độ lớn — cắt trục để phóng đại khác biệt là thứ bạn đã học nhận ra ở bài 3.3, đừng làm nó trên slide của mình.

## Khi khán giả không cùng chuyên ngành

Đây là tình huống sinh viên gặp nhiều nhất khi bảo vệ đồ án trước hội đồng ngoài chuyên môn hẹp, hoặc khi trình bày cho khách hàng.

| Việc cần làm | Cụ thể |
|---|---|
| Bỏ thuật ngữ, hoặc giải thích ngay lần đầu | "độ chính xác của mô hình" → "trong 100 bài chấm, máy chấm trùng với giáo viên bao nhiêu bài" |
| Đổi công thức thành ví dụ có số | Thay vì công thức, cho một trường hợp cụ thể chạy qua |
| Cắt phần chỉ dân trong ngành mới quan tâm | Kiến trúc kỹ thuật, tham số — đưa vào phụ lục để trả lời khi được hỏi |
| Giữ lại phần họ dùng được | Kết quả, giới hạn, việc họ có thể làm với nó |
| Dùng phép so sánh quen thuộc | Nhưng nói rõ chỗ phép so sánh ấy không còn đúng |

> [!canh-bao] Đơn giản hoá **không phải** là nói sai cho dễ hiểu. Nếu một phép so sánh làm sai bản chất, hãy nói thêm một câu về giới hạn của nó. Khán giả ngoài ngành không kiểm được điều bạn nói — chính vì thế trách nhiệm nói đúng lại nặng hơn, không nhẹ đi.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Lấy một bộ slide bạn đã làm. Chọn slide nhiều chữ nhất và làm lại thành **hai slide dựa**: một slide giữ con số hoặc từ khoá chính, một slide giữ hình hoặc biểu đồ. Viết ra phần bạn sẽ **nói** thay cho phần chữ đã bỏ đi — đúng như bạn sẽ nói thành lời.

### Nhóm 3–4 người (25 phút)

Mỗi người chiếu ba slide của mình lên (điện thoại hoặc máy tính đặt cách 3 mét). Nhóm chấm theo bốn tiêu chí: đọc được từ xa không, một slide có đúng một ý không, hình có phục vụ nội dung không, và **người trình bày có thể bỏ slide này mà bài vẫn chạy không**. Tiêu chí cuối lọc ra các slide chỉ tồn tại để cho đầy.

### Bài tập về nhà (45–60 phút)

Chọn một nội dung kỹ thuật hoặc chuyên ngành của bạn và làm hai phiên bản slide cho cùng một ý: một cho người trong ngành, một cho người ngoài ngành. Nộp kèm nửa trang: bạn đã bỏ thuật ngữ nào và thay bằng gì; phép so sánh bạn dùng và **giới hạn của phép so sánh đó**; phần nào bạn chuyển sang phụ lục.

### Xem thêm

- 🎬 [How to Avoid Death by PowerPoint](https://www.youtube.com/watch?v=Iwpi1Lm6dFo) — David JP Phillips, TEDxStockholmSalon, 20 phút. Giải thích bằng chính slide vì sao slide nhồi chữ làm giảm khả năng tiếp nhận.

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
                "explanation": "Hình phải liên quan trực tiếp tới nội dung đang nói, đủ nét, không kéo méo, và ghi nguồn — ảnh trang trí chỉ lấy mất chú ý mà không thêm thông tin.",
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
                "prompt": "Bạn được yêu cầu trình bày một đề tài kỹ thuật trước khán giả không cùng chuyên ngành. Bạn nên làm gì?",
                "explanation": "Bỏ hoặc giải thích ngay thuật ngữ, đổi công thức thành ví dụ có số, chuyển phần chuyên sâu vào phụ lục và giữ lại phần khán giả dùng được — đồng thời nêu giới hạn của các phép so sánh.",
                "points": 3,
                "options": [
                    {"label": "Bỏ thuật ngữ hoặc giải thích ngay lần đầu, đổi công thức thành ví dụ có số, chuyển phần chuyên sâu vào phụ lục, giữ lại kết quả và giới hạn", "isCorrect": True},
                    {"label": "Trình bày như với người trong ngành, ai không hiểu thì hỏi sau", "isCorrect": False, "misconception": "knm.audience-is-me"},
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

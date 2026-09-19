# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.4 · Thử nghiệm với người học thật",
    "durationMin": 55,
    "description": "Cách tổ chức buổi thử nghiệm khả dụng cho học liệu: giao nhiệm vụ thay vì hỏi ý kiến, phương pháp nghĩ thành tiếng, các chỉ số quan sát được, và cách phân biệt lỗi khả dụng với lỗi hiểu nội dung.",
    "objectives": [
        "Tổ chức được buổi thử nghiệm với người học thật theo kịch bản chuẩn bị trước",
        "Phân biệt được lỗi khả dụng với lỗi hiểu nội dung và xử lý mỗi loại khác nhau",
        "Viết được biên bản thử nghiệm dẫn tới danh sách sửa có thứ tự ưu tiên",
    ],
    "summary": [
        "Giao nhiệm vụ và im lặng quan sát cho dữ liệu; hỏi em thấy thế nào cho lời khen lịch sự.",
        "Ba chỉ số quan sát được đủ cho học liệu AR: tự mở được không, mất bao lâu tới thành công đầu tiên, và cần trợ giúp mấy lần.",
        "Lỗi khả dụng sửa bằng thiết kế giao diện và hướng dẫn; lỗi hiểu nội dung sửa bằng nội dung — nhầm hai loại này thì sửa sai chỗ.",
        "Năm người thử là đủ để tìm phần lớn vấn đề nghiêm trọng, nhưng phải là năm người đúng nhóm đối tượng.",
    ],
    "body": r"""
## Giao nhiệm vụ, đừng hỏi ý kiến

Sai lầm phổ biến nhất khi sinh viên thử nghiệm sản phẩm của mình: đưa cho một học sinh xem rồi hỏi *em thấy thế nào*. Câu trả lời gần như luôn là *hay ạ* — vì lịch sự, vì mới lạ, và vì người hỏi chính là người làm ra sản phẩm.

| Cách làm sai | Vì sao hỏng | Cách làm đúng |
|---|---|---|
| Hỏi *em thấy có dễ dùng không* | Câu hỏi gợi ý sẵn câu trả lời | Giao nhiệm vụ: *em hãy tìm hiểu bộ phận nào làm nhiệm vụ bơm máu*, rồi im lặng |
| Ngồi cạnh hướng dẫn khi thấy học sinh loay hoay | Xoá mất đúng dữ liệu cần thu | Đếm thời gian loay hoay; chỉ can thiệp sau ngưỡng đã định trước |
| Chỉ hỏi lúc kết thúc | Quên mất chỗ tắc ở giữa | Ghi lại từng chỗ dừng ngay khi nó xảy ra |
| Thử với bạn cùng lớp đại học | Không phải nhóm đối tượng, quá thạo công nghệ | Thử với đúng lứa tuổi và đúng trình độ của sách |

> [!ghi-nho] Một câu duy nhất cần thuộc khi ngồi quan sát: **im lặng là công cụ thu thập dữ liệu**. Mỗi lần bạn mở miệng giúp đỡ là một lần bạn mất một phát hiện.

## Tổ chức buổi thử nghiệm: kịch bản và chỉ số

### Kịch bản một buổi bốn mươi phút

| Phút | Việc | Ghi chú |
|---|---|---|
| 0–5 | Giới thiệu: nói rõ **đang thử sản phẩm, không thử người học**; xin phép ghi chép, ghi hình nếu cần | Với học sinh chưa thành niên phải có đồng ý của người đại diện theo pháp luật |
| 5–10 | Hướng dẫn nghĩ thành tiếng, làm mẫu bằng một nhiệm vụ vô hại | Ví dụ làm mẫu: mở khoá điện thoại và tìm ứng dụng máy tính |
| 10–30 | Ba nhiệm vụ thật, mỗi nhiệm vụ có tiêu chí hoàn thành rõ | Quan sát viên chỉ ghi, không giúp; ngưỡng can thiệp đặt trước ví dụ 3 phút |
| 30–37 | Phỏng vấn ngắn: hỏi về **những chỗ đã quan sát thấy**, không hỏi chung chung | *Lúc nãy em dừng lại ở đây, lúc đó em đang nghĩ gì?* |
| 37–40 | Cảm ơn, nói rõ dữ liệu sẽ dùng thế nào | Không hứa điều mình không làm được |

Ba nhiệm vụ nên xếp theo thứ tự: một nhiệm vụ mở sản phẩm (kiểm khả dụng), một nhiệm vụ dùng nội dung (kiểm hiểu), một nhiệm vụ chuyển giao (kiểm học được gì).

### Ba chỉ số quan sát được

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:34rem;display:flex;gap:.5rem">
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(13,148,136,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Tự mở được không</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Có / không, trong 1 phút, không trợ giúp<br><span style="opacity:.75">Đây là tiêu chí đạt tối thiểu ở Bài 1.7</span></div>
    </div>
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(37,99,235,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Thời gian tới thành công đầu</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Giây, từ lúc cầm sách tới lúc mô hình hiện<br><span style="opacity:.75">So với số đo kỹ thuật ở Bài 5.3 để tách lỗi tải khỏi lỗi thao tác</span></div>
    </div>
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(217,150,40,.9);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Số lần cần trợ giúp</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Đếm, kèm ghi rõ trợ giúp về việc gì<br><span style="opacity:.75">Trợ giúp về thao tác và về nội dung phải đếm riêng</span></div>
    </div>
  </div>
</div>
```

Ba chỉ số này đủ cho học liệu AR ở quy mô đồ án, và chúng có một ưu điểm lớn: **quan sát được, không phụ thuộc lời tự báo cáo**. Ghi thêm nếu có điều kiện: chỗ dừng lâu nhất, câu hỏi người học tự đặt ra, và biểu hiện bỏ cuộc.

## Phân biệt lỗi khả dụng với lỗi hiểu nội dung

Đây là phân biệt quan trọng nhất của cả buổi thử nghiệm, vì hai loại lỗi sửa ở hai chỗ khác nhau:

| | Lỗi khả dụng | Lỗi hiểu nội dung |
|---|---|---|
| Biểu hiện | Không tìm thấy mã QR, không biết bấm nút nào, quét mãi không ra | Mở được, nhìn được, nhưng giải thích sai cơ chế |
| Sửa ở đâu | Bố cục trang, hướng dẫn, kích thước nút, độ tương phản | Nội dung, chú giải, thứ tự trình bày, phần chuẩn bị trước |
| Nhầm lẫn thường gặp | Thấy học sinh trả lời sai rồi kết luận sản phẩm khó dùng | Thấy học sinh loay hoay rồi kết luận nội dung khó |
| Cách tách | Sau khi giúp mở được, người học có hiểu không? | Nếu đọc bản giấy thuần, người học có hiểu không? |

> [!vi-du] Học sinh quét trang van tim, mô hình hiện lên, em xoay một lúc rồi nói *cái van này để máu chảy ngược lại*. Đây **không** phải lỗi khả dụng — sản phẩm đã làm đúng việc của nó. Đây là lỗi hiểu nội dung, và nó chỉ ra chú giải chưa nói rõ chiều dòng chảy. Sửa ở nội dung, không sửa ở nút bấm.

## Năm người và cách chọn họ

Con số năm người thử để tìm phần lớn vấn đề nghiêm trọng là quy tắc kinh nghiệm phổ biến trong ngành khả dụng, và nó áp được cho học liệu — với một điều kiện thường bị bỏ: **năm người phải thuộc đúng nhóm đối tượng**. Năm sinh viên đại học thử sách dành cho học sinh lớp 8 sẽ không tìm ra vấn đề mà lớp 8 gặp.

Khi chọn năm người, ưu tiên đa dạng ở ba trục có ảnh hưởng thật:

1. **Thiết bị** — ít nhất một em dùng máy đời thấp.
2. **Vốn kiến thức nền** — ít nhất một em chưa vững phần tiên quyết.
3. **Mức quen công nghệ** — ít nhất một em ít dùng điện thoại cho việc học.

Nếu cả năm em đều là học sinh khá, có máy tốt và thạo công nghệ, biên bản của bạn sẽ đẹp và vô dụng.

> [!canh-bao] Nhắc lại nghĩa vụ đã học ở Bài 1.5 và 4.5: người học chưa thành niên thì phải có đồng ý của người đại diện theo pháp luật; ghi hình phải nói rõ mục đích, thời hạn lưu và ai được xem; và trong báo cáo đồ án, không đưa tên hay hình ảnh nhận diện được của các em.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Viết kịch bản buổi thử nghiệm của bạn: ba nhiệm vụ kèm tiêu chí hoàn thành, ngưỡng can thiệp tính bằng phút, và ba câu hỏi phỏng vấn cuối buổi gắn với chỗ quan sát được. Kiểm lại: có câu nào của bạn gợi ý sẵn câu trả lời không?

### Nhóm 3–4 người (30 phút)

Diễn tập: một người đóng vai học sinh cố tình làm sai, một người quan sát và ghi theo ba chỉ số, những người còn lại tính giờ và bắt lỗi quan sát viên mỗi lần người ấy can thiệp sớm hoặc gợi ý. Đổi vai một lượt. Rút kinh nghiệm về việc giữ im lặng.

### Bài tập về nhà — mốc 5 của đồ án (150 phút)

Thực hiện thử nghiệm thật với **ít nhất ba người học đúng nhóm đối tượng** (khuyến khích năm người) và nộp hồ sơ.

1. Kịch bản buổi thử nghiệm đã chuẩn bị trước, kèm bằng chứng đã xin phép đúng quy định.
2. Bảng ba chỉ số cho từng người thử, kèm ghi chú chỗ dừng lâu nhất.
3. Danh sách vấn đề tìm được, mỗi vấn đề phân loại là **lỗi khả dụng** hay **lỗi hiểu nội dung**, kèm bằng chứng quan sát.
4. Danh sách sửa có thứ tự ưu tiên: sửa gì trước, vì sao, và đã sửa những gì.
5. Bản trước và sau của ít nhất một chỗ đã sửa.

**Cách làm (gợi ý từng bước):** đặt ngưỡng can thiệp trước khi bắt đầu và tuân thủ nó, kể cả khi thấy sốt ruột; ghi giờ bằng đồng hồ bấm giây chứ đừng ước lượng; khi phân loại lỗi, dùng đúng hai câu hỏi tách trong bảng ở mục 4; xếp ưu tiên theo số người gặp phải nhân với mức nghiêm trọng, không theo mức dễ sửa.

**Chấm theo:** kịch bản chuẩn bị trước và tuân thủ nghĩa vụ xin phép (3đ) · ba chỉ số ghi đầy đủ cho từng người thử (3đ) · phân loại lỗi đúng, có bằng chứng quan sát (4đ) · danh sách sửa có ưu tiên và đã thực hiện ít nhất một sửa đổi (3đ) · người thử đúng nhóm đối tượng và có đa dạng theo ba trục (2đ). Trừ điểm nếu biên bản không có vấn đề nào được tìm ra.

### Nguồn tham khảo

- Nielsen, J. (2000). *Why you only need to test with 5 users* — Nielsen Norman Group.
- Krug, S. (2010). *Rocket Surgery Made Easy: The Do-It-Yourself Guide to Finding and Fixing Usability Problems.* New Riders.
- Ericsson, K. A., & Simon, H. A. (1993). *Protocol Analysis: Verbal Reports as Data* — cơ sở của phương pháp nghĩ thành tiếng.
- Quốc hội (2025). *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15*, Điều 24 về dữ liệu của trẻ em.
""",
    "quiz": {
        "title": "Kiểm tra Bài 5.4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "5.4-giao-nhiem-vu",
                "type": "mcq",
                "prompt": "Vì sao hỏi *em thấy sản phẩm thế nào* không cho dữ liệu dùng được?",
                "explanation": "Câu trả lời bị chi phối bởi phép lịch sự, sự mới lạ và việc người hỏi chính là người làm ra sản phẩm. Phải giao nhiệm vụ thật rồi im lặng quan sát.",
                "points": 2,
                "options": [
                    {"label": "Vì câu trả lời bị chi phối bởi lịch sự, sự mới lạ và quan hệ với người hỏi", "isCorrect": True},
                    {"label": "Vì học sinh không đủ khả năng đánh giá sản phẩm", "isCorrect": False},
                    {"label": "Vì câu hỏi quá dài", "isCorrect": False},
                    {"label": "Không sai: ý kiến người dùng là dữ liệu quan trọng nhất", "isCorrect": False, "misconception": "cngdtt.usability-ask-opinion"},
                ],
            },
            {
                "key": "5.4-im-lang",
                "type": "mcq",
                "prompt": "Nguyên tắc quan trọng nhất của người quan sát trong buổi thử nghiệm là gì?",
                "explanation": "Im lặng là công cụ thu thập dữ liệu — mỗi lần can thiệp giúp đỡ là một lần mất một phát hiện. Ngưỡng can thiệp phải đặt trước và tuân thủ.",
                "points": 2,
                "options": [
                    {"label": "Giữ im lặng, chỉ can thiệp sau ngưỡng đã định trước", "isCorrect": True},
                    {"label": "Giải thích ngay khi thấy người học lúng túng", "isCorrect": False},
                    {"label": "Khuyến khích liên tục để người học đỡ căng thẳng", "isCorrect": False},
                    {"label": "Hỏi cảm nhận sau mỗi thao tác", "isCorrect": False, "misconception": "cngdtt.usability-ask-opinion"},
                ],
            },
            {
                "key": "5.4-ba-nhiem-vu",
                "type": "ordering",
                "prompt": "Sắp xếp ba nhiệm vụ trong buổi thử nghiệm theo thứ tự nên giao.",
                "explanation": "Mở sản phẩm để kiểm khả dụng, dùng nội dung để kiểm hiểu, rồi nhiệm vụ chuyển giao để kiểm học được gì.",
                "points": 3,
                "sequence": [
                    "Nhiệm vụ mở được sản phẩm — kiểm khả dụng",
                    "Nhiệm vụ dùng nội dung để trả lời một câu hỏi — kiểm hiểu",
                    "Nhiệm vụ áp nội dung vào tình huống mới — kiểm chuyển giao",
                ],
            },
            {
                "key": "5.4-ba-chi-so",
                "type": "mcq",
                "prompt": "Ba chỉ số quan sát được đủ dùng cho thử nghiệm học liệu AR là gì?",
                "explanation": "Tự mở được hay không, thời gian tới thành công đầu tiên, và số lần cần trợ giúp — tất cả đều quan sát được, không phụ thuộc lời tự báo cáo.",
                "points": 2,
                "options": [
                    {"label": "Tự mở được không, thời gian tới thành công đầu, số lần cần trợ giúp", "isCorrect": True},
                    {"label": "Mức độ hài lòng, mức độ hứng thú, mức độ tự tin", "isCorrect": False, "misconception": "cngdtt.usability-ask-opinion"},
                    {"label": "Số phút dùng sản phẩm, số lần quét, số câu hỏi đã trả lời", "isCorrect": False},
                    {"label": "Điểm bài kiểm tra, xếp hạng lớp, thái độ học tập", "isCorrect": False},
                ],
            },
            {
                "key": "5.4-tach-hai-loi",
                "type": "mcq",
                "prompt": "Học sinh mở được sản phẩm, xoay mô hình, rồi giải thích sai cơ chế. Đây là lỗi gì và sửa ở đâu?",
                "explanation": "Lỗi hiểu nội dung: sản phẩm đã làm đúng việc của nó. Sửa ở chú giải, thứ tự trình bày hoặc phần chuẩn bị trước — không sửa ở nút bấm.",
                "points": 2,
                "options": [
                    {"label": "Lỗi hiểu nội dung; sửa ở chú giải và cách trình bày nội dung", "isCorrect": True},
                    {"label": "Lỗi khả dụng; sửa ở bố cục và nút bấm", "isCorrect": False},
                    {"label": "Lỗi của học sinh; cần nhắc em đọc kỹ hơn", "isCorrect": False},
                    {"label": "Lỗi kỹ thuật; cần dựng lại mô hình chi tiết hơn", "isCorrect": False},
                ],
            },
            {
                "key": "5.4-cau-hoi-tach",
                "type": "matching",
                "prompt": "Ghép mỗi loại lỗi với câu hỏi dùng để tách nó.",
                "explanation": "Hai câu hỏi tách này quyết định bạn sẽ sửa ở đâu — nhầm loại lỗi thì sửa sai chỗ và vấn đề vẫn còn nguyên.",
                "points": 3,
                "pairs": [
                    {"left": "Lỗi khả dụng", "right": "Sau khi được giúp mở, người học có hiểu nội dung không"},
                    {"left": "Lỗi hiểu nội dung", "right": "Nếu chỉ đọc bản giấy thuần, người học có hiểu không"},
                ],
            },
            {
                "key": "5.4-nam-nguoi",
                "type": "mcq",
                "prompt": "Quy tắc năm người thử áp cho học liệu với điều kiện nào thường bị bỏ qua?",
                "explanation": "Năm người phải thuộc đúng nhóm đối tượng. Năm sinh viên đại học thử sách cho lớp 8 sẽ không tìm ra vấn đề mà lớp 8 gặp.",
                "points": 2,
                "options": [
                    {"label": "Năm người phải đúng nhóm đối tượng của sản phẩm", "isCorrect": True},
                    {"label": "Năm người phải thử cùng một lúc", "isCorrect": False},
                    {"label": "Năm người phải có trình độ tương đương nhau", "isCorrect": False},
                    {"label": "Năm người phải dùng cùng loại thiết bị", "isCorrect": False},
                ],
            },
            {
                "key": "5.4-ba-truc-da-dang",
                "type": "mcq",
                "prompt": "Khi chọn người thử, nên đa dạng theo ba trục nào?",
                "explanation": "Thiết bị (có máy đời thấp), vốn kiến thức nền (có em chưa vững phần tiên quyết), và mức quen công nghệ. Toàn học sinh khá máy tốt thì biên bản đẹp mà vô dụng.",
                "points": 2,
                "options": [
                    {"label": "Thiết bị, vốn kiến thức nền, và mức quen dùng công nghệ cho việc học", "isCorrect": True},
                    {"label": "Giới tính, chiều cao, và sở thích", "isCorrect": False},
                    {"label": "Điểm trung bình, hạnh kiểm, và số buổi vắng", "isCorrect": False},
                    {"label": "Không cần đa dạng, chọn ai cũng được", "isCorrect": False},
                ],
            },
            {
                "key": "5.4-phong-van-cuoi",
                "type": "mcq",
                "prompt": "Câu hỏi phỏng vấn cuối buổi nên có dạng nào?",
                "explanation": "Gắn với chỗ đã quan sát thấy: *lúc nãy em dừng lại ở đây, lúc đó em đang nghĩ gì* — thay vì hỏi chung chung về cảm nhận.",
                "points": 2,
                "options": [
                    {"label": "Lúc nãy em dừng lại ở bước này, khi đó em đang nghĩ gì", "isCorrect": True},
                    {"label": "Em thấy sản phẩm có hay không", "isCorrect": False, "misconception": "cngdtt.usability-ask-opinion"},
                    {"label": "Em có muốn dùng sản phẩm này nữa không", "isCorrect": False},
                    {"label": "Em cho sản phẩm này mấy điểm trên thang mười", "isCorrect": False},
                ],
            },
            {
                "key": "5.4-uu-tien-sua",
                "type": "mcq",
                "prompt": "Xếp thứ tự ưu tiên sửa các vấn đề tìm được nên dựa trên tiêu chí nào?",
                "explanation": "Số người gặp phải nhân với mức nghiêm trọng — không xếp theo mức dễ sửa, vì như vậy sẽ sửa hết lỗi vặt mà bỏ lại vấn đề chặn người học.",
                "points": 2,
                "options": [
                    {"label": "Số người gặp phải nhân với mức nghiêm trọng", "isCorrect": True},
                    {"label": "Mức độ dễ sửa, sửa cái nhanh trước", "isCorrect": False},
                    {"label": "Thứ tự xuất hiện trong buổi thử nghiệm", "isCorrect": False},
                    {"label": "Ý kiến của người thử về mức quan trọng", "isCorrect": False},
                ],
            },
            {
                "key": "5.4-nghia-vu-phap-ly",
                "type": "mcq",
                "prompt": "Thử nghiệm với học sinh chưa thành niên có ghi hình đòi hỏi gì?",
                "explanation": "Đồng ý của người đại diện theo pháp luật; nói rõ mục đích, thời hạn lưu, ai được xem; và trong báo cáo không đưa tên hay hình ảnh nhận diện được.",
                "points": 2,
                "options": [
                    {"label": "Đồng ý của người đại diện theo pháp luật, nêu rõ mục đích và thời hạn lưu, báo cáo không để lộ danh tính", "isCorrect": True},
                    {"label": "Chỉ cần giáo viên chủ nhiệm đồng ý", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Chỉ cần học sinh đồng ý miệng", "isCorrect": False},
                    {"label": "Không cần gì nếu chỉ dùng trong đồ án", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "5.4-bien-ban-khong-loi",
                "type": "true_false",
                "prompt": "Biên bản thử nghiệm không tìm ra vấn đề nào là dấu hiệu sản phẩm đã hoàn thiện.",
                "explanation": "Sai — nó thường là dấu hiệu chưa thử nghiệm đúng cách: người thử không đúng nhóm đối tượng, quan sát viên can thiệp quá sớm, hoặc nhiệm vụ quá dễ.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "cngdtt.demo-equals-product"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "5.4-viet-luan-thu-nghiem",
                "type": "essay",
                "prompt": "Viết 250–350 từ kế hoạch thử nghiệm cho đồ án của bạn: ba nhiệm vụ kèm tiêu chí hoàn thành, ngưỡng can thiệp, cách bạn chọn năm người thử theo ba trục đa dạng, và cách bạn sẽ phân biệt lỗi khả dụng với lỗi hiểu nội dung.",
                "points": 5,
            },
        ],
    },
}

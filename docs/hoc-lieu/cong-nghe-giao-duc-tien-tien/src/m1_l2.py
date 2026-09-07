# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 1.2 · Công nghệ không dạy, thiết kế dạy học mới dạy",
    "durationMin": 50,
    "description": "Ba truyền thống lý thuyết học tập và dấu vết của chúng trong phần mềm giáo dục; tải nhận thức, nguyên tắc học đa phương tiện, và vì sao cảm giác dễ hiểu là chỉ báo đánh lừa.",
    "objectives": [
        "Nhận ra được truyền thống lý thuyết đứng sau một tính năng phần mềm giáo dục cụ thể",
        "Phân biệt được ba loại tải nhận thức và chỉ ra tải thừa trong một học liệu có sẵn",
        "Giải thích được vì sao học liệu dễ xem lại thường cho kết quả ghi nhớ kém hơn học liệu bắt tự nhớ lại",
    ],
    "summary": [
        "Mỗi tính năng trong phần mềm giáo dục đều mang một giả định về việc học: điểm thưởng và luyện tập lặp đến từ thuyết hành vi, ví dụ mẫu và chia nhỏ đến từ thuyết nhận thức, dự án và cộng tác đến từ thuyết kiến tạo.",
        "Trí nhớ làm việc chỉ giữ được vài đơn vị cùng lúc; thiết kế tốt là thiết kế cắt tải thừa để dành chỗ cho tải bản chất.",
        "Các nguyên tắc học đa phương tiện của Mayer cho một danh mục kiểm tra ngắn, áp được ngay lên bất kỳ video hay slide nào.",
        "Cảm giác trôi chảy đo độ quen chứ không đo khả năng nhớ lại — nên tự kiểm tra và giãn cách khó chịu hơn nhưng cho kết quả bền hơn.",
    ],
    "body": r"""
## Ba truyền thống lý thuyết nằm sẵn trong phần mềm bạn dùng

Không có phần mềm giáo dục nào trung lập về lý thuyết học tập. Mỗi lựa chọn tính năng — cho điểm thưởng hay không, mở khoá tuần tự hay để tự do khám phá, chấm tự động hay để bạn học chấm nhau — đều là một giả định về việc học diễn ra thế nào. Người làm công nghệ giáo dục cần đọc ngược được từ tính năng ra giả định, vì đó là cách nhanh nhất để thấy một sản phẩm đang hợp hay chống lại mục tiêu của mình.

| Truyền thống | Học tập là gì | Dấu vết trong phần mềm | Mạnh ở đâu | Yếu ở đâu |
|---|---|---|---|---|
| Hành vi (Skinner, Thorndike) | Thay đổi hành vi quan sát được nhờ củng cố | Luyện tập lặp, phản hồi đúng/sai tức thì, điểm thưởng, chuỗi ngày học liên tiếp, mở khoá tuần tự | Kỹ năng nền cần tự động hoá: từ vựng, bảng cửu chương, chính tả | Không chạm tới hiểu sâu; động lực dễ chuyển từ bên trong ra bên ngoài |
| Nhận thức (Atkinson–Shiffrin, Sweller, Mayer) | Xử lý và lưu trữ thông tin trong một hệ trí nhớ có giới hạn | Chia nhỏ nội dung, ví dụ mẫu, sơ đồ có chú giải, tránh chi tiết thừa, kiểm tra xen kẽ | Truyền đạt kiến thức phức tạp cho người mới | Ít nói về động cơ, bối cảnh xã hội và ý nghĩa cá nhân |
| Kiến tạo (Piaget, Vygotsky, Papert) | Người học tự dựng hiểu biết qua hoạt động và tương tác | Môi trường thử nghiệm mở, dự án, diễn đàn thảo luận, chấm chéo, học liệu do người học tạo ra | Kỹ năng bậc cao, chuyển giao sang tình huống mới | Tốn thời gian; người mới dễ lạc nếu không có hỗ trợ đủ |

Ba truyền thống này không loại trừ nhau, và một sản phẩm tốt thường trộn cả ba theo giai đoạn: người mới cần hỗ trợ kiểu nhận thức, kỹ năng nền cần luyện kiểu hành vi, người đã vững cần không gian kiến tạo. Sai lầm phổ biến không phải chọn nhầm truyền thống, mà là **dùng một truyền thống cho mọi giai đoạn** — điển hình là ứng dụng nào cũng gắn điểm và huy hiệu vào mọi hoạt động, kể cả những hoạt động mà động lực bên trong vốn đã đủ.

> [!canh-bao] Một hiểu lầm dai dẳng cần gọi tên ngay: phân loại người học thành nhóm học bằng mắt, bằng tai, bằng vận động rồi dạy theo đúng kênh của họ. Giả thuyết phong cách học tập đã được kiểm nghiệm nhiều lần và không đứng vững — điều thay đổi theo người học nên là mức độ khó và lượng hỗ trợ, không phải kênh trình bày.

## Tải nhận thức: ngân sách có hạn của người học

Trí nhớ làm việc — nơi mọi thông tin mới phải đi qua — chỉ giữ được vài đơn vị cùng lúc và giữ trong vài chục giây. Đây là nút thắt thật của mọi thiết kế dạy học. Thuyết tải nhận thức của John Sweller chia tải trọng đặt lên nút thắt ấy thành ba phần:

```html
<div style="margin:1.2rem 0;border:1px solid rgba(127,127,127,.25);border-radius:.6rem;overflow:hidden">
  <div style="display:flex;font-size:1rem;font-weight:600;text-align:center;color:#fff">
    <div style="flex:4;background:rgba(13,148,136,.85);padding:.6rem .4rem">Tải bản chất</div>
    <div style="flex:3;background:rgba(217,150,40,.85);padding:.6rem .4rem">Tải thừa</div>
    <div style="flex:3;background:rgba(59,130,246,.85);padding:.6rem .4rem">Tải hữu ích</div>
  </div>
  <div style="display:flex;font-size:1.05rem;line-height:1.6">
    <div style="flex:4;padding:.7rem .6rem">Độ khó vốn có của nội dung. Không cắt được, chỉ chia nhỏ và sắp thứ tự.</div>
    <div style="flex:3;padding:.7rem .6rem;border-left:1px solid rgba(127,127,127,.25)">Do cách trình bày sinh ra: hiệu ứng thừa, bố cục rối, chữ tách xa hình. Đây là phần phải cắt.</div>
    <div style="flex:3;padding:.7rem .6rem;border-left:1px solid rgba(127,127,127,.25)">Phần dành cho việc dựng sơ đồ hiểu biết trong đầu. Cắt tải thừa chính là để dành chỗ cho phần này.</div>
  </div>
</div>
```

Ba loại tải cộng lại không được vượt sức chứa. Vì tải bản chất do nội dung quyết định và tải hữu ích là thứ ta muốn tối đa hoá, **toàn bộ dư địa thiết kế nằm ở việc cắt tải thừa**. Đây là lý do vì sao một bài giảng đẹp mắt, nhiều hiệu ứng chuyển cảnh, nhạc nền và ảnh minh hoạ sinh động lại thường cho kết quả kém hơn một bài trình bày trần trụi: mỗi chi tiết trang trí đều lấy đi một phần ngân sách có hạn.

> [!vi-du] Một video giảng bài mở đầu bằng mười lăm giây hoạt hình logo, có nhạc nền suốt, chữ chạy vào từng dòng, và giảng viên đọc đúng nguyên văn chữ trên slide. Bốn chi tiết ấy sinh ra bốn nguồn tải thừa khác nhau, không chi tiết nào giúp người xem hiểu nội dung hơn.

### Tương tác phần tử và hiệu ứng đảo chiều chuyên môn

Hai khái niệm dưới đây phân biệt người đã học lý thuyết tải nhận thức với người mới nghe qua.

**Tương tác phần tử** là số lượng thành phần mà người học phải giữ đồng thời trong trí nhớ làm việc vì chúng chỉ có nghĩa khi đặt cạnh nhau. Học nghĩa của hai mươi từ vựng rời là tương tác phần tử thấp — học từng từ một cũng được. Hiểu vì sao một mạch điện đoản là tương tác phần tử cao: hiệu điện thế, điện trở, đường đi của dòng phải được giữ cùng lúc. Đây là lý do **tải bản chất không tỉ lệ với lượng thông tin**, mà tỉ lệ với mức độ ràng buộc giữa các thông tin ấy.

**Hiệu ứng đảo chiều chuyên môn** (Kalyuga và cộng sự, 2003) là phát hiện có hệ quả trực tiếp lên mọi hệ thống cá nhân hoá: những hỗ trợ giúp ích cho người mới — ví dụ mẫu giải sẵn từng bước, chú giải chi tiết, hướng dẫn dày — **trở thành có hại** với người đã vững, vì họ phải đối chiếu lời hướng dẫn với sơ đồ đã có sẵn trong đầu, và việc đối chiếu ấy chính là tải thừa.

> [!ghi-nho] Hệ quả thiết kế: mức hỗ trợ phải **giảm dần theo trình độ**, không phải giữ nguyên cho mọi người học. Đây là nền tảng lý thuyết của học thích ứng ở Module 3 — và cũng là lý do một khoá học được khen là rất dễ hiểu với người mới lại bị người khá đánh giá là dài dòng.

Đi kèm là **hiệu ứng ví dụ mẫu**: với người mới, nghiên cứu một lời giải mẫu hoàn chỉnh hiệu quả hơn tự vật lộn với bài tập cùng dạng, vì tự mò tiêu gần hết ngân sách nhận thức vào chiến lược thử — sai thay vì vào việc dựng lược đồ giải. Nhưng lợi thế ấy biến mất, rồi đảo chiều, khi người học đã có lược đồ.

### ICAP: bốn mức tham gia và cách phân loại hoạt động

Khung ICAP của Chi và Wylie (2014) xếp hoạt động học theo hành vi quan sát được, và dự đoán thứ tự hiệu quả: **Tương tác > Kiến tạo > Chủ động > Thụ động**.

| Mức | Người học làm gì | Ví dụ trong sản phẩm số |
|---|---|---|
| Thụ động | Tiếp nhận, không sinh ra gì | Xem hết video, đọc hết trang |
| Chủ động | Thao tác trên chính thông tin đã có | Tô đậm, tua lại, xoay mô hình ba chiều, ghi chép nguyên văn |
| Kiến tạo | Sinh ra thông tin **vượt quá** cái đã cho | Tự giải thích, đặt câu hỏi, vẽ sơ đồ của riêng mình, dự đoán rồi kiểm |
| Tương tác | Kiến tạo cùng bạn học, có đối thoại luân phiên | Tranh luận có luận cứ, giải thích cho nhau, cùng sửa một sản phẩm |

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .5rem">Bốn mức tham gia theo ICAP — hiệu quả tăng dần từ dưới lên</div>
  <div style="display:flex;flex-direction:column;gap:.35rem">
    <div style="display:flex;align-items:stretch;gap:.5rem">
      <div style="flex:0 0 11rem;background:rgba(124,58,237,.88);color:#fff;padding:.6rem .7rem;border-radius:.4rem;font-size:1.05rem;font-weight:600">Tương tác</div>
      <div style="flex:1;padding:.6rem .7rem;border:1px solid rgba(127,127,127,.25);border-radius:.4rem;font-size:1.05rem;line-height:1.6">Kiến tạo cùng bạn học, có đối thoại luân phiên — tranh luận có luận cứ, cùng sửa một sản phẩm</div>
    </div>
    <div style="display:flex;align-items:stretch;gap:.5rem">
      <div style="flex:0 0 11rem;background:rgba(13,148,136,.88);color:#fff;padding:.6rem .7rem;border-radius:.4rem;font-size:1.05rem;font-weight:600">Kiến tạo</div>
      <div style="flex:1;padding:.6rem .7rem;border:1px solid rgba(127,127,127,.25);border-radius:.4rem;font-size:1.05rem;line-height:1.6">Sinh ra thông tin vượt quá cái đã cho — tự giải thích, vẽ sơ đồ riêng, dự đoán rồi kiểm</div>
    </div>
    <div style="display:flex;align-items:stretch;gap:.5rem">
      <div style="flex:0 0 11rem;background:rgba(37,99,235,.85);color:#fff;padding:.6rem .7rem;border-radius:.4rem;font-size:1.05rem;font-weight:600">Chủ động</div>
      <div style="flex:1;padding:.6rem .7rem;border:1px solid rgba(127,127,127,.25);border-radius:.4rem;font-size:1.05rem;line-height:1.6">Thao tác trên thông tin đã có — tô đậm, tua lại, xoay mô hình, chép nguyên văn</div>
    </div>
    <div style="display:flex;align-items:stretch;gap:.5rem">
      <div style="flex:0 0 11rem;background:rgba(120,113,108,.85);color:#fff;padding:.6rem .7rem;border-radius:.4rem;font-size:1.05rem;font-weight:600">Thụ động</div>
      <div style="flex:1;padding:.6rem .7rem;border:1px solid rgba(127,127,127,.25);border-radius:.4rem;font-size:1.05rem;line-height:1.6">Tiếp nhận, không sinh ra gì — xem hết video, đọc hết trang</div>
    </div>
  </div>
  <div style="font-size:1rem;opacity:.7;margin:.55rem 0 0;line-height:1.6">Ranh giới quan trọng nhất nằm giữa <strong>Chủ động</strong> và <strong>Kiến tạo</strong>: nhiều nút bấm không đưa hoạt động lên mức Kiến tạo nếu người học không sinh ra thông tin mới.</div>
</div>
```

Khung này đặc biệt hữu dụng khi thẩm định sản phẩm, vì nó **bóc được cái vỏ tương tác**: một ứng dụng có nhiều nút bấm, kéo thả, hoạt hình phản hồi vẫn có thể chỉ ở mức Chủ động — người học thao tác nhưng không sinh ra thông tin mới nào. Câu hỏi kiểm tra chỉ có một: *người học có phải tạo ra thứ gì không có sẵn trong tài liệu không?*

## Sáu nguyên tắc học đa phương tiện dùng được ngay

Richard Mayer và cộng sự đã kiểm chứng hàng chục nguyên tắc thiết kế học liệu đa phương tiện qua nhiều thực nghiệm. Sáu nguyên tắc dưới đây là những cái áp được ngay lên bất kỳ video, slide hay bài giảng số nào — và cũng là danh mục kiểm tra bạn có thể đưa cho một giáo viên trong mười phút.

| Nguyên tắc | Nội dung | Vi phạm điển hình trong học liệu Việt Nam |
|---|---|---|
| Mạch lạc | Bỏ mọi chữ, hình, âm thanh không phục vụ mục tiêu học | Nhạc nền suốt bài giảng; ảnh trang trí không liên quan; câu chuyện thú vị nhưng lạc đề |
| Chỉ dẫn | Đánh dấu rõ đâu là phần quan trọng | Slide dày đặc chữ cùng cỡ, không tô đậm, không đánh số bước |
| Tránh trùng lặp | Không đọc y nguyên chữ đã hiện trên màn hình | Giảng viên đọc từng dòng slide — kênh chữ và kênh tiếng cùng chuyển một nội dung |
| Kề nhau | Chữ chú giải đặt sát chi tiết hình mà nó nói tới | Sơ đồ ở trang này, chú giải ở trang sau; chú thích dồn hết xuống cuối |
| Chia đoạn | Cắt bài dài thành đoạn ngắn do người học tự bấm tiếp | Video giảng bốn mươi phút liền mạch, không mốc chương |
| Chuẩn bị trước | Giới thiệu tên và khái niệm chính trước khi giải thích cơ chế | Lao thẳng vào quy trình khi người học chưa biết các bộ phận tên gọi là gì |

> [!meo] Cách dùng bảng này trong nghề: khi được nhờ nhận xét một học liệu số, đi lần lượt sáu dòng và ghi lại vi phạm cụ thể kèm mốc thời gian. Sáu dòng đó biến một nhận xét cảm tính thành một biên bản góp ý mà người sản xuất sửa được ngay.

## Khó khăn có chủ đích và cái bẫy của cảm giác trôi chảy

Có một nghịch lý mà mọi người làm công nghệ giáo dục phải nắm: **những cách học tạo cảm giác dễ chịu và trôi chảy nhất thường cho kết quả ghi nhớ kém nhất**. Đọc lại tài liệu, tô màu, xem lại video — tất cả đều làm tăng cảm giác quen thuộc, và người học nhầm cảm giác quen thuộc với việc đã nắm bài.

Robert và Elizabeth Bjork gọi những điều kiện làm việc học chậm và khó hơn trước mắt nhưng bền hơn về sau là **khó khăn có chủ đích**. Ba cái quan trọng nhất với thiết kế phần mềm:

1. **Tự nhớ lại thay vì đọc lại.** Đóng tài liệu và cố nhắc lại nội dung cho kết quả tốt hơn hẳn việc đọc thêm lần nữa, dù người học thường tin điều ngược lại.
2. **Giãn cách thay vì dồn.** Cùng một tổng thời gian học, chia ra nhiều buổi cách quãng cho kết quả bền hơn học dồn một lần.
3. **Trộn xen kẽ thay vì gom khối.** Luyện xen kẽ nhiều dạng bài khó hơn lúc luyện, nhưng giúp người học nhận dạng đúng loại vấn đề khi gặp lại.

Hệ quả thiết kế rất cụ thể. Một nền tảng đo mức độ hài lòng của người học ngay sau buổi học sẽ có xu hướng thưởng cho những thiết kế tạo cảm giác dễ chịu — tức là thưởng nhầm. Một nền tảng gợi ý ôn tập theo lịch giãn cách sẽ bị người dùng phàn nàn là khó hơn ứng dụng cạnh tranh, trong khi lại đang làm đúng.

> [!ghi-nho] Khi đánh giá một sản phẩm học tập, hãy tách hai câu hỏi: người học **thấy** thế nào ngay sau buổi học, và người học **nhớ và làm được** gì sau hai tuần. Hai câu này thường cho hai xếp hạng khác nhau, và chỉ câu thứ hai mới là mục tiêu của giáo dục.

Cần nói thêm một hiệu ứng hay bị bỏ qua khi đọc kết quả thử nghiệm công nghệ: **hiệu ứng mới lạ**. Bất kỳ thay đổi nào trong lớp cũng kéo theo sự chú ý tăng lên trong vài tuần đầu, cho cả người dạy lẫn người học. Đó là lý do một thử nghiệm bốn tuần thường cho kết quả đẹp hơn nhiều so với chính công nghệ ấy sau một năm — và là lý do bạn sẽ học cách đọc thời lượng nghiên cứu trong Bài 1.4.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Mở một video bài giảng bất kỳ trên nền tảng học liệu của trường bạn. Xem năm phút đầu và ghi lại: mỗi vi phạm nguyên tắc đa phương tiện bạn thấy, kèm mốc thời gian và đề xuất sửa trong một câu. Mục tiêu là ít nhất ba mục ghi nhận.

### Nhóm 3–4 người (25 phút)

Nhóm chọn một ứng dụng học tập phổ biến ở Việt Nam. Lập bảng ba cột: tính năng — truyền thống lý thuyết đứng sau — giai đoạn người học mà tính năng đó hợp. Sau đó trả lời một câu chung: ứng dụng này đang dùng một truyền thống cho mọi giai đoạn, hay có phân biệt? Trình bày trong hai phút.

### Bài tập về nhà — sản phẩm số (90–120 phút)

Chọn một học liệu số có sẵn (video bài giảng, bộ slide, phiếu bài tập trực tuyến) và **dựng lại bản thứ hai** của nó thành học liệu tương tác. Công cụ tuỳ chọn: H5P, một trang HTML tự viết, hoặc công cụ dựng bài giảng số bạn quen dùng. Yêu cầu sản phẩm:

- Cắt ít nhất **hai nguồn tải thừa** đã nhận diện được, ghi lại mốc thời gian hoặc vị trí của chúng ở bản gốc.
- Chia nội dung thành đoạn ngắn do người học tự bấm tiếp (nguyên tắc chia đoạn).
- Chèn **ba điểm dừng tự kiểm tra** xen giữa nội dung, mỗi điểm một câu hỏi bắt người học nhớ lại trước khi xem tiếp — không phải câu hỏi chọn cho vui, mà câu hỏi trúng ý chính vừa học.

Nộp cả bản gốc và bản mới kèm một trang thuyết minh có bảng hai cột trước — sau, mỗi dòng ghi thay đổi và nguyên tắc tương ứng.

**Cách làm (gợi ý từng bước):**

1. Xem lại bản gốc một lượt, ghi mốc thời gian hoặc số trang của từng chỗ có tải thừa — làm xong bước này mới sửa.
2. Cắt trước, thêm sau: bỏ hiệu ứng, nhạc nền, ảnh trang trí, chữ trùng lời nói.
3. Chia đoạn: mỗi đoạn một ý, kết thúc ở chỗ người học có thể dừng mà không hụt.
4. Viết ba câu hỏi tự kiểm tra — mỗi câu hỏi lại đúng ý chính vừa học, không hỏi chi tiết vụn.
5. Công cụ gợi ý: [H5P](https://h5p.org/content-types-and-applications) cho video tương tác và câu hỏi xen giữa; hoặc một trang HTML với thẻ `<details>` làm điểm dừng.

**Chấm theo:** hai nguồn tải thừa được cắt và giải thích đúng nguyên tắc (4đ) · chia đoạn hợp lý (2đ) · ba câu hỏi trúng ý chính, đặt đúng chỗ (3đ) · bảng so sánh trước — sau đầy đủ (1đ).

### Nguồn tham khảo

- Sweller, J., van Merriënboer, J. J. G., & Paas, F. (2019). Cognitive architecture and instructional design: 20 years later. *Educational Psychology Review*, 31, 261–292.
- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.). Cambridge University Press.
- Bjork, R. A., & Bjork, E. L. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. Trong *Psychology and the Real World*.
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest*, 14(1), 4–58.
- Pashler, H., McDaniel, M., Rohrer, D., & Bjork, R. (2008). Learning styles: Concepts and evidence. *Psychological Science in the Public Interest*, 9(3), 105–119.
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. *Educational Psychologist*, 38(1), 23–31.
- Chi, M. T. H., & Wylie, R. (2014). The ICAP framework: Linking cognitive engagement to active learning outcomes. *Educational Psychologist*, 49(4), 219–243.
""",
    "quiz": {
        "title": "Kiểm tra Bài 1.2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "1.2-truyen-thong-tinh-nang",
                "type": "matching",
                "prompt": "Ghép mỗi tính năng phần mềm với truyền thống lý thuyết học tập đứng sau nó.",
                "explanation": "Đọc ngược từ tính năng ra giả định là kỹ năng nền của người thẩm định: nó cho biết sản phẩm đang phục vụ giai đoạn học nào.",
                "points": 3,
                "pairs": [
                    {"left": "Chuỗi ngày học liên tiếp và huy hiệu", "right": "Thuyết hành vi"},
                    {"left": "Ví dụ mẫu giải từng bước trước khi cho bài tự làm", "right": "Thuyết nhận thức"},
                    {"left": "Dự án nhóm với sản phẩm do người học tự dựng", "right": "Thuyết kiến tạo"},
                    {"left": "Chia bài dài thành đoạn ngắn kèm câu hỏi xen giữa", "right": "Thuyết nhận thức"},
                ],
            },
            {
                "key": "1.2-tai-thua",
                "type": "mcq",
                "prompt": "Trong ba loại tải nhận thức, loại nào là dư địa thiết kế thật sự của người làm học liệu?",
                "explanation": "Tải bản chất do nội dung quyết định, tải hữu ích là thứ ta muốn tăng. Chỉ tải thừa — do cách trình bày sinh ra — là phần cắt được, và cắt nó chính là để dành chỗ cho tải hữu ích.",
                "points": 2,
                "options": [
                    {"label": "Tải thừa, vì nó do cách trình bày sinh ra nên cắt được", "isCorrect": True},
                    {"label": "Tải bản chất, vì có thể đơn giản hoá nội dung cho dễ hơn", "isCorrect": False},
                    {"label": "Tải hữu ích, vì cần giảm nó để người học đỡ mệt", "isCorrect": False},
                    {"label": "Cả ba đều cắt được nếu dùng công nghệ đủ hiện đại", "isCorrect": False, "misconception": "cngdtt.tech-not-design"},
                ],
            },
            {
                "key": "1.2-nhac-nen",
                "type": "mcq",
                "prompt": "Một video bài giảng có nhạc nền nhẹ suốt thời lượng vì nhóm sản xuất muốn bài học đỡ khô khan. Nhận định đúng nhất là gì?",
                "explanation": "Nhạc nền vi phạm nguyên tắc mạch lạc: nó chiếm một phần trí nhớ làm việc mà không phục vụ mục tiêu học tập. Cảm giác sinh động không bù được phần ngân sách nhận thức bị lấy đi.",
                "points": 2,
                "options": [
                    {"label": "Nhạc nền sinh tải thừa và nên bỏ, trừ khi nó là đối tượng học tập", "isCorrect": True},
                    {"label": "Nhạc nền luôn tốt vì làm tăng hứng thú", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                    {"label": "Chỉ cần chỉnh nhạc nhỏ lại là hết ảnh hưởng", "isCorrect": False},
                    {"label": "Nhạc nền không liên quan gì tới tải nhận thức", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-trung-lap",
                "type": "mcq",
                "prompt": "Giảng viên đọc nguyên văn từng dòng chữ đang hiện trên slide. Nguyên tắc nào bị vi phạm và vì sao?",
                "explanation": "Nguyên tắc tránh trùng lặp: khi chữ và lời cùng chuyển tải một nội dung, người học phải đối chiếu hai luồng giống nhau, tốn thêm tải mà không thêm thông tin.",
                "points": 2,
                "options": [
                    {"label": "Tránh trùng lặp — hai kênh chuyển cùng nội dung buộc người học đối chiếu vô ích", "isCorrect": True},
                    {"label": "Mạch lạc — vì slide có quá nhiều chữ", "isCorrect": False},
                    {"label": "Không vi phạm gì: nghe và nhìn cùng lúc thì nhớ tốt hơn", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                    {"label": "Chuẩn bị trước — vì chưa giới thiệu khái niệm", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-phong-cach-hoc",
                "type": "true_false",
                "prompt": "Nên thiết kế hệ thống phân loại người học thành nhóm học bằng mắt, bằng tai, bằng vận động rồi tự động chuyển học liệu theo đúng kênh của từng người.",
                "explanation": "Giả thuyết phong cách học tập không có bằng chứng ủng hộ khi được kiểm bằng thiết kế thực nghiệm phù hợp. Cái nên cá nhân hoá là mức độ khó và lượng hỗ trợ, không phải kênh trình bày.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "cngdtt.learning-styles"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.2-doc-lai-vs-tu-nho",
                "type": "mcq",
                "prompt": "Hai nhóm sinh viên có cùng tổng thời gian ôn: nhóm A đọc lại tài liệu bốn lần, nhóm B đọc một lần rồi ba lần gấp tài liệu tự nhắc lại. Dự đoán nào phù hợp với bằng chứng hiện có?",
                "explanation": "Tự nhớ lại cho kết quả ghi nhớ dài hạn tốt hơn đọc lại, dù người học thường cảm thấy đọc lại hiệu quả hơn vì nó trôi chảy hơn.",
                "points": 2,
                "options": [
                    {"label": "Nhóm B nhớ tốt hơn khi kiểm tra sau một tuần, dù trong lúc ôn thấy khó chịu hơn", "isCorrect": True},
                    {"label": "Nhóm A nhớ tốt hơn vì đã tiếp xúc nội dung nhiều lần hơn", "isCorrect": False, "misconception": "cngdtt.fluency-equals-learning"},
                    {"label": "Hai nhóm như nhau vì tổng thời gian bằng nhau", "isCorrect": False},
                    {"label": "Không dự đoán được vì còn tuỳ phong cách học của từng người", "isCorrect": False, "misconception": "cngdtt.learning-styles"},
                ],
            },
            {
                "key": "1.2-hai-long-vs-ket-qua",
                "type": "mcq",
                "prompt": "Một ứng dụng có điểm hài lòng ngay sau buổi học rất cao nhưng kết quả kiểm tra sau hai tuần lại thấp hơn ứng dụng đối thủ. Cách giải thích hợp lý nhất là gì?",
                "explanation": "Thiết kế tạo cảm giác trôi chảy được chấm điểm hài lòng cao, trong khi khó khăn có chủ đích gây khó chịu trước mắt mà cho kết quả bền hơn. Đo hài lòng tức thì có thể thưởng nhầm.",
                "points": 2,
                "options": [
                    {"label": "Điểm hài lòng đo cảm giác trôi chảy, còn kết quả sau hai tuần mới đo việc học", "isCorrect": True},
                    {"label": "Chắc chắn bài kiểm tra sau hai tuần bị soạn sai", "isCorrect": False},
                    {"label": "Ứng dụng đối thủ có giao diện đẹp hơn", "isCorrect": False},
                    {"label": "Người học hài lòng thì đương nhiên đã học tốt", "isCorrect": False, "misconception": "cngdtt.fluency-equals-learning"},
                ],
            },
            {
                "key": "1.2-hieu-ung-moi-la",
                "type": "mcq",
                "prompt": "Một thử nghiệm bốn tuần cho thấy lớp dùng thiết bị mới tiến bộ vượt trội. Yếu tố nào cần được loại trừ trước khi tin vào kết quả?",
                "explanation": "Hiệu ứng mới lạ: bất kỳ thay đổi nào cũng làm tăng chú ý của cả người dạy lẫn người học trong vài tuần đầu. Muốn biết công nghệ có tác dụng thật không, cần đo sau khi sự mới mẻ đã hết.",
                "points": 2,
                "options": [
                    {"label": "Hiệu ứng mới lạ — sự chú ý tăng lên chỉ vì có thay đổi trong lớp", "isCorrect": True},
                    {"label": "Việc học sinh thích thiết bị mới chứng tỏ thiết bị hiệu quả", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Không cần loại trừ gì: bốn tuần là đủ dài", "isCorrect": False},
                    {"label": "Cần đổi sang thiết bị hiện đại hơn để kiểm chứng lại", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                ],
            },
            {
                "key": "1.2-ke-nhau",
                "type": "mcq",
                "prompt": "Một bài học có sơ đồ quy trình ở trang trước và toàn bộ chú giải các bước ở trang sau. Nguyên tắc nào bị vi phạm?",
                "explanation": "Nguyên tắc kề nhau: chữ giải thích phải đặt sát chi tiết hình mà nó nói tới, nếu không người học phải ghi nhớ tạm rồi lật qua lật lại — đó là tải thừa thuần tuý.",
                "points": 2,
                "options": [
                    {"label": "Kề nhau — chú giải phải nằm sát chi tiết hình mà nó mô tả", "isCorrect": True},
                    {"label": "Chia đoạn — vì bài quá dài", "isCorrect": False},
                    {"label": "Mạch lạc — vì có quá nhiều hình", "isCorrect": False},
                    {"label": "Không vi phạm gì nếu chú giải được viết rõ ràng", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-cong-nghe-khong-sua-thiet-ke",
                "type": "mcq",
                "prompt": "Một trường chuyển toàn bộ bài giảng đọc chép sang video quay sẵn đặt trên hệ thống học tập mới. Kết quả học tập không đổi. Giải thích nào đúng nhất?",
                "explanation": "Vấn đề nằm ở thiết kế nhiệm vụ học tập — không có luyện tập, không có phản hồi — chứ không nằm ở phương tiện. Đổi phương tiện mà giữ nguyên phương pháp thì không nên chờ khác biệt.",
                "points": 2,
                "options": [
                    {"label": "Phương pháp dạy học không đổi, chỉ đổi phương tiện chuyển tải", "isCorrect": True},
                    {"label": "Hệ thống học tập chưa đủ hiện đại", "isCorrect": False, "misconception": "cngdtt.tech-not-design"},
                    {"label": "Video chất lượng hình ảnh chưa đủ cao", "isCorrect": False},
                    {"label": "Học sinh chưa quen với công nghệ", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-ba-kho-khan",
                "type": "matching",
                "prompt": "Ghép mỗi khó khăn có chủ đích với tính năng phần mềm hiện thực hoá nó.",
                "explanation": "Ba khó khăn có chủ đích đều dịch được thành tính năng cụ thể — đó là chỗ lý thuyết học tập gặp thiết kế sản phẩm.",
                "points": 3,
                "pairs": [
                    {"left": "Tự nhớ lại", "right": "Thẻ ôn hiện câu hỏi trước, đáp án chỉ lộ sau khi người học đã thử trả lời"},
                    {"left": "Giãn cách", "right": "Lịch nhắc ôn lại nội dung cũ theo khoảng thời gian tăng dần"},
                    {"left": "Trộn xen kẽ", "right": "Bộ bài tập trộn nhiều dạng thay vì gom từng dạng thành khối"},
                ],
            },
            {
                "key": "1.2-viet-luan-tai-thua",
                "type": "essay",
                "prompt": "Chọn một học liệu số cụ thể mà bạn từng dùng khi còn là người học. Viết 200–300 từ chỉ ra hai nguồn tải thừa trong đó, đề xuất cách cắt, và nêu một chỗ bạn sẽ cố tình thêm khó khăn có chủ đích cùng lý do.",
                "points": 5,
            },
            {
                "key": "1.2-dao-chieu-chuyen-mon",
                "type": "mcq",
                "prompt": "Một hệ thống hiển thị ví dụ mẫu giải sẵn từng bước cho mọi người học. Nhóm học viên khá phàn nàn bài học dài dòng và kết quả của họ thấp hơn nhóm được làm bài tập trực tiếp. Hiện tượng này gọi là gì?",
                "explanation": "Hiệu ứng đảo chiều chuyên môn: hỗ trợ giúp ích cho người mới trở thành tải thừa với người đã có lược đồ, vì họ phải đối chiếu hướng dẫn với hiểu biết sẵn có.",
                "points": 2,
                "options": [
                    {"label": "Hiệu ứng đảo chiều chuyên môn — mức hỗ trợ phải giảm dần theo trình độ", "isCorrect": True},
                    {"label": "Hiệu ứng mới lạ", "isCorrect": False},
                    {"label": "Người khá có phong cách học khác nên cần kênh trình bày khác", "isCorrect": False, "misconception": "cngdtt.learning-styles"},
                    {"label": "Ví dụ mẫu luôn kém hiệu quả hơn tự làm bài tập", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-tuong-tac-phan-tu",
                "type": "mcq",
                "prompt": "Vì sao học 20 từ vựng rời có tải bản chất thấp hơn hiểu vì sao một mạch điện bị đoản, dù lượng thông tin có thể tương đương?",
                "explanation": "Tải bản chất tỉ lệ với tương tác phần tử — số thành phần phải giữ đồng thời vì chúng chỉ có nghĩa khi đặt cạnh nhau — chứ không tỉ lệ với lượng thông tin.",
                "points": 2,
                "options": [
                    {"label": "Vì tương tác phần tử thấp: từng từ học riêng được, còn hiểu mạch đòi giữ nhiều thành phần ràng buộc nhau cùng lúc", "isCorrect": True},
                    {"label": "Vì từ vựng thuộc trí nhớ dài hạn còn mạch điện thuộc trí nhớ làm việc", "isCorrect": False},
                    {"label": "Vì môn ngôn ngữ dễ hơn môn khoa học tự nhiên", "isCorrect": False},
                    {"label": "Vì tải bản chất tỉ lệ thuận với số lượng thông tin phải nhớ", "isCorrect": False},
                ],
            },
            {
                "key": "1.2-icap-phan-loai",
                "type": "matching",
                "prompt": "Xếp mỗi hoạt động vào đúng mức của khung ICAP.",
                "explanation": "ICAP phân loại theo hành vi quan sát được, và bóc được cái vỏ tương tác: thao tác nhiều nút bấm vẫn có thể chỉ ở mức Chủ động nếu người học không sinh ra thông tin mới.",
                "points": 3,
                "pairs": [
                    {"left": "Xem hết video bài giảng", "right": "Thụ động"},
                    {"left": "Xoay mô hình ba chiều và tua lại đoạn khó", "right": "Chủ động"},
                    {"left": "Tự vẽ sơ đồ giải thích cơ chế bằng cách hiểu của mình", "right": "Kiến tạo"},
                    {"left": "Hai người tranh luận có luận cứ để cùng sửa một bản thiết kế", "right": "Tương tác"},
                ],
            },
        ],
    },
}

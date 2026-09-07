# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 1.5 · Bối cảnh Việt Nam: chính sách, dữ liệu và khoảng cách số",
    "durationMin": 50,
    "description": "Khung chính sách đang chi phối công nghệ giáo dục ở Việt Nam năm 2026, nghĩa vụ pháp lý khi thu dữ liệu người học theo Luật Bảo vệ dữ liệu cá nhân, và ba tầng khoảng cách số cần tính tới trước khi triển khai.",
    "objectives": [
        "Kể được bốn văn bản đang chi phối việc ứng dụng công nghệ trong trường phổ thông và điều mỗi văn bản ràng buộc",
        "Nêu được nghĩa vụ pháp lý phát sinh khi một hệ thống thu dữ liệu của người học chưa thành niên",
        "Phân tích được một đề xuất triển khai theo ba tầng khoảng cách số",
    ],
    "summary": [
        "Bốn mốc chính sách cần thuộc: Đề án chuyển đổi số giáo dục theo Quyết định 131/QĐ-TTg, Thông tư 09/2021 về dạy học trực tuyến, Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, và Khung nội dung giáo dục AI theo Quyết định 2422/QĐ-BGDĐT.",
        "Từ 01/01/2026, Nghị định 13/2023 không còn là căn cứ: nghĩa vụ về dữ liệu người học nằm ở Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP, kèm hồ sơ đánh giá tác động xử lý dữ liệu cá nhân.",
        "Dữ liệu của trẻ em, dữ liệu sinh trắc học và dữ liệu vị trí có chế độ riêng — điểm danh bằng khuôn mặt hay giám sát vị trí không còn là quyết định kỹ thuật thuần tuý.",
        "Khoảng cách số có ba tầng: thiết bị và đường truyền, kỹ năng sử dụng cho việc học, và khả năng biến việc sử dụng thành kết quả — bỏ hai tầng sau thì công nghệ thường làm giãn khoảng cách.",
    ],
    "body": r"""
## Bốn văn bản đang chi phối công việc của bạn

Người làm công nghệ giáo dục ở Việt Nam không thiết kế trong chân không. Bốn văn bản dưới đây quyết định phần lớn những gì được phép làm, phải làm, và làm thì lấy tiền ở đâu.

| Văn bản | Nội dung cốt lõi | Ràng buộc với người thiết kế |
|---|---|---|
| Quyết định 131/QĐ-TTg (25/01/2022) | Đề án tăng cường ứng dụng công nghệ thông tin và chuyển đổi số trong giáo dục và đào tạo giai đoạn 2022–2025, định hướng đến 2030 | Đây là nguồn ngân sách và là ngôn ngữ mà đề xuất của bạn phải nói được: hồ sơ số của người học, học liệu số, quản trị trên nền dữ liệu |
| Thông tư 09/2021/TT-BGDĐT | Quản lý và tổ chức dạy học trực tuyến ở giáo dục phổ thông và giáo dục thường xuyên; từ 01/7/2025 thẩm quyền tại Điều 13 chuyển về chính quyền cấp cơ sở theo Thông tư 10/2025/TT-BGDĐT | Quy định hạ tầng, hồ sơ dạy học, trách nhiệm nhà trường — nền tảng bạn xây phải sinh ra được những hồ sơ ấy |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực 01/01/2026) | Thay thế cơ chế của Nghị định 13/2023; hướng dẫn chi tiết ở Nghị định 356/2025/NĐ-CP | Mọi hệ thống thu dữ liệu người học đều rơi vào phạm vi điều chỉnh — xem mục sau |
| Quyết định 2422/QĐ-BGDĐT (18/8/2026) và Công văn 5588/BGDĐT-GDPT | Khung nội dung giáo dục trí tuệ nhân tạo cho học sinh phổ thông, phần cốt lõi 12 tiết mỗi lớp mỗi năm, triển khai từ năm học 2026–2027 | Nhu cầu học liệu và tập huấn giáo viên rất lớn và rất gấp — đây là chỗ sinh viên ngành Công nghệ giáo dục có việc ngay |

> [!ghi-nho] Đọc chính sách không phải để thuộc số hiệu, mà để biết **đề xuất của mình đứng vào chỗ nào**. Một đề xuất gắn được vào mục tiêu của Đề án 131 và giải quyết được nhu cầu học liệu AI theo Quyết định 2422 có cơ hội được duyệt cao hơn hẳn một đề xuất hay nhưng không thuộc dòng nào.

## Dữ liệu người học: nghĩa vụ pháp lý từ năm 2026

Đây là thay đổi mà nhiều tài liệu trong ngành còn chưa cập nhật: **Nghị định 13/2023/NĐ-CP không còn là căn cứ để trích dẫn**. Từ ngày 01/01/2026, khung pháp lý về dữ liệu cá nhân là Luật số 91/2025/QH15, với Nghị định 356/2025/NĐ-CP hướng dẫn thi hành.

Bốn điểm mà một người thiết kế hệ thống giáo dục phải nắm:

1. **Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân** (Điều 21). Bên kiểm soát dữ liệu phải lập, lưu trữ và gửi một bản chính cho cơ quan chuyên trách trong vòng 60 ngày kể từ ngày đầu tiên xử lý dữ liệu; hồ sơ được cập nhật khi có thay đổi. Với một hệ thống học tập của trường, điều này nghĩa là thủ tục phải làm ngay khi vận hành, không phải khi có sự cố.
2. **Dữ liệu của trẻ em** (Điều 24). Người đại diện theo pháp luật thay mặt thực hiện quyền của trẻ. Việc xử lý dữ liệu cá nhân của trẻ em nhằm công bố hoặc tiết lộ thông tin về đời sống riêng tư, bí mật cá nhân của trẻ **từ đủ 07 tuổi trở lên** phải có sự đồng ý của **cả trẻ em và người đại diện theo pháp luật**. Việc xử lý phải ngừng khi người đã đồng ý rút lại sự đồng ý.
3. **Dữ liệu sinh trắc học và dữ liệu vị trí** (Điều 31). Sinh trắc học được định nghĩa là thuộc tính vật lý, đặc điểm sinh học cá biệt và ổn định dùng để xác định một người — nhận diện khuôn mặt nằm gọn trong đó. Tổ chức thu thập phải bảo mật vật lý thiết bị lưu trữ và truyền tải, hạn chế quyền truy cập, có hệ thống theo dõi phát hiện xâm phạm. Với dữ liệu vị trí, ứng dụng di động phải thông báo và cung cấp tuỳ chọn cho người dùng.
4. **Xử lý dữ liệu trong môi trường AI và điện toán đám mây** (Điều 30). Dữ liệu cá nhân trong môi trường dữ liệu lớn, trí tuệ nhân tạo, chuỗi khối và điện toán đám mây phải được xử lý đúng mục đích, giới hạn trong phạm vi cần thiết, kèm biện pháp bảo mật, xác thực và phân quyền truy cập.

> [!canh-bao] Hệ quả cụ thể cho hai ý tưởng rất hay được đề xuất trong đồ án sinh viên: **điểm danh bằng nhận diện khuôn mặt** và **giám sát học sinh qua camera hoặc định vị**. Cả hai không còn là quyết định kỹ thuật — chúng kéo theo nghĩa vụ về sự đồng ý, bảo mật, hạn chế truy cập và báo cáo. Nếu đồ án của bạn có một trong hai, hãy dành hẳn một mục cho căn cứ pháp lý, nếu không hội đồng sẽ hỏi và bạn sẽ không có câu trả lời.

Một hệ quả khác ít được nói: khi trường dùng dịch vụ AI đặt ở nước ngoài để chấm bài hoặc sinh phản hồi, bài làm của học sinh — có thể chứa dữ liệu cá nhân — được chuyển ra ngoài biên giới. Đó là một loại xử lý dữ liệu có thủ tục riêng, và câu trả lời an toàn nhất trong thiết kế là **khử nhận dạng trước khi gửi đi**: Luật ghi rõ dữ liệu cá nhân sau khi khử nhận dạng thì không còn là dữ liệu cá nhân.

### Từ tuân thủ tới quản trị: danh mục kiểm cho phân tích học tập

Tuân thủ pháp luật là ngưỡng sàn, không phải đích. Trong cộng đồng phân tích học tập, danh mục kiểm được trích dẫn nhiều nhất là **DELICATE** của Drachsler và Greller (2016), gồm tám bước mà một cơ sở giáo dục phải trả lời trước khi phân tích dữ liệu người học:

| Bước | Câu hỏi phải trả lời trước khi thu dữ liệu |
|---|---|
| Xác định mục đích | Phân tích này phục vụ quyết định cụ thể nào? Không có quyết định thì không thu |
| Giải thích | Người học có được nói rõ dữ liệu nào được thu và dùng để làm gì không |
| Tính chính đáng | Vì sao cơ sở giáo dục có quyền thu dữ liệu này — căn cứ pháp lý và căn cứ sư phạm |
| Có sự tham gia | Người học và giáo viên có được tham gia bàn về cách dùng dữ liệu không |
| Đồng ý | Cơ chế đồng ý và rút lại đồng ý được thiết kế thế nào |
| Khử nhận dạng | Dữ liệu có được ẩn danh hoặc gộp nhóm ở mức cao nhất mà vẫn dùng được không |
| Kỹ thuật | Biện pháp bảo mật, phân quyền, ghi vết truy cập |
| Bên ngoài | Bên thứ ba nào chạm vào dữ liệu, ràng buộc hợp đồng ra sao |

Hai nguyên tắc xuyên suốt cần thuộc: **tối thiểu hoá dữ liệu** — chỉ thu trường nào có một quyết định cụ thể phụ thuộc vào nó — và **giới hạn mục đích** — dữ liệu thu để cải thiện việc học không được lặng lẽ chuyển sang dùng cho đánh giá thi đua giáo viên hay cho tiếp thị.

> [!canh-bao] Một rủi ro đặc thù của giáo dục mà luật chưa nói hết: **hiệu ứng nhãn dán**. Khi hệ thống dự đoán một học sinh có nguy cơ trượt và giáo viên nhìn thấy dự đoán ấy, kỳ vọng của giáo viên thay đổi, và dự đoán có thể tự làm cho nó đúng. Vì vậy mọi bảng điều khiển cảnh báo sớm đều phải trả lời trước một câu: **ai được xem, và người xem được yêu cầu làm gì tiếp theo**. Module 4 sẽ quay lại chỗ này.

### Mua sắm, chuẩn tương tác và khoá nhà cung cấp

Ở khu vực công, quyết định công nghệ được thực hiện qua hồ sơ mời thầu, và điều khoản kỹ thuật trong hồ sơ ấy quyết định nhiều hơn mọi cuộc trình diễn sản phẩm. Bốn chuẩn nên xuất hiện dưới dạng **yêu cầu bắt buộc**, không phải điểm cộng:

| Chuẩn | Giải quyết vấn đề gì | Câu hỏi đưa vào hồ sơ |
|---|---|---|
| SCORM và xAPI | Đóng gói học liệu và ghi nhận hoạt động học ở dạng chuyển được giữa các hệ thống | Hệ thống xuất được bản ghi hoạt động theo chuẩn nào, xuất bằng thao tác gì |
| LTI | Kết nối công cụ ngoài vào hệ quản lý học tập mà không phải cấp lại tài khoản | Có hỗ trợ kết nối chuẩn không, hay bắt người học lập tài khoản riêng |
| QTI | Trao đổi ngân hàng câu hỏi giữa các hệ thống | Ngân hàng đề đã soạn có mang đi được không, ở định dạng nào |
| Xuất dữ liệu thô | Rời bỏ hệ thống mà không mất lịch sử học tập | Ai giữ dữ liệu khi hết hợp đồng, xoá theo quy trình nào |

Mất khả năng rời bỏ không xảy ra trong một lần ký. Nó tích luỹ: mỗi học kỳ thêm học liệu đã soạn, thêm lịch sử điểm, thêm thói quen của giáo viên — tới năm thứ ba thì chi phí chuyển đổi lớn tới mức nhà cung cấp có thể tăng giá mà trường vẫn phải trả. Đưa yêu cầu xuất dữ liệu vào hợp đồng ngay từ đầu là biện pháp rẻ nhất trong toàn bộ vòng đời hệ thống.

## Ba tầng khoảng cách số

Khi triển khai ở Việt Nam, câu hỏi công bằng không dừng ở chỗ học sinh có máy hay không. Khoảng cách số có ba tầng, và công nghệ giáo dục có thể thu hẹp tầng một trong khi nới rộng tầng hai và ba.

| Tầng | Nội dung | Biểu hiện trong lớp học | Cách đo |
|---|---|---|---|
| 1. Tiếp cận | Có thiết bị, đường truyền, điện, không gian yên tĩnh để học | Học sinh học bằng điện thoại của mẹ sau giờ mẹ đi làm về | Khảo sát thiết bị theo hộ gia đình, không theo đầu học sinh |
| 2. Kỹ năng | Biết dùng thiết bị **cho việc học**, không chỉ để giải trí và nhắn tin | Học sinh thạo mạng xã hội nhưng lúng túng khi phải nộp tệp đúng định dạng | Quan sát thao tác thật trên nhiệm vụ học tập |
| 3. Kết quả | Biến việc sử dụng thành tiến bộ học tập thật | Hai lớp cùng dùng một nền tảng, chênh lệch kết quả lại giãn ra | So sánh tiến bộ theo nhóm hoàn cảnh, không chỉ theo trung bình lớp |

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .5rem">Ba tầng — lấp tầng dưới không tự động lấp tầng trên</div>
  <div style="display:flex;flex-direction:column;gap:.4rem;align-items:center">
    <div style="width:100%;max-width:34rem;padding:.75rem .9rem;background:rgba(220,38,38,.16);border:1px solid rgba(220,38,38,.45);border-radius:.45rem">
      <div style="font-size:1.1rem;font-weight:700">Tầng 3 · Kết quả</div>
      <div style="font-size:1.05rem;line-height:1.6">Biến việc sử dụng thành tiến bộ học tập thật — đo bằng cách so tiến bộ theo nhóm hoàn cảnh, không theo trung bình lớp</div>
    </div>
    <div style="width:100%;max-width:31rem;padding:.75rem .9rem;background:rgba(217,150,40,.16);border:1px solid rgba(217,150,40,.45);border-radius:.45rem">
      <div style="font-size:1.1rem;font-weight:700">Tầng 2 · Kỹ năng</div>
      <div style="font-size:1.05rem;line-height:1.6">Biết dùng thiết bị cho việc học, không chỉ để giải trí — đo bằng quan sát thao tác trên nhiệm vụ học tập thật</div>
    </div>
    <div style="width:100%;max-width:28rem;padding:.75rem .9rem;background:rgba(13,148,136,.16);border:1px solid rgba(13,148,136,.45);border-radius:.45rem">
      <div style="font-size:1.1rem;font-weight:700">Tầng 1 · Tiếp cận</div>
      <div style="font-size:1.05rem;line-height:1.6">Thiết bị, đường truyền, điện, không gian yên tĩnh — đo theo hộ gia đình, không theo đầu học sinh</div>
    </div>
  </div>
  <div style="font-size:1rem;opacity:.7;margin:.6rem 0 0;line-height:1.6;text-align:center">Phần lớn chính sách dừng ở tầng 1; phân hoá kết quả xảy ra ở tầng 2 và 3.</div>
</div>
```

Bài học từ giai đoạn dạy học trực tuyến 2020–2021 nằm đúng ở đây: khi mọi việc học chuyển lên mạng, nhóm có sẵn thiết bị, có góc học riêng và có người lớn hỗ trợ ở nhà đã tận dụng được nhiều hơn hẳn. Cùng một chính sách, cùng một nền tảng, kết quả phân hoá theo hoàn cảnh gia đình.

> [!meo] Một câu hỏi nên có trong mọi đề xuất triển khai: **học sinh khó khăn nhất trong lớp sẽ dùng thứ này như thế nào?** Trả lời bằng một tình huống cụ thể — thiết bị gì, lúc mấy giờ, mạng ra sao — chứ không bằng một câu cam kết chung. Nếu không trả lời được, thiết kế đang mặc định điều kiện của nhóm thuận lợi nhất.

## Người quyết định là ai và bạn thuyết phục bằng gì

Một đề xuất công nghệ trong trường phổ thông thường đi qua bốn cửa, mỗi cửa quan tâm một thứ khác nhau. Nói sai ngôn ngữ ở cửa nào thì dừng ở cửa đó.

| Người quyết định | Câu hỏi thật của họ | Bằng chứng nên đưa |
|---|---|---|
| Giáo viên trực tiếp dạy | Việc này làm tôi tốn thêm bao nhiêu thời gian mỗi tuần? | Ước tính giờ công, và chỉ rõ việc gì được bỏ bớt để đổi lại |
| Tổ trưởng chuyên môn | Nó có khớp với kế hoạch dạy học và cách kiểm tra đánh giá không? | Bản đối chiếu với yêu cầu cần đạt của môn học |
| Ban giám hiệu | Rủi ro là gì, tiền ở đâu, ai chịu trách nhiệm nếu hỏng? | Ba rủi ro trong phiếu thẩm định Bài 1.3, kèm phương án dừng |
| Cơ quan quản lý cấp trên | Có đúng quy định không, có báo cáo được không? | Căn cứ pháp lý và mẫu số liệu báo cáo mà hệ thống xuất ra được |

Sinh viên mới ra trường hay mắc một lỗi giống nhau: trình bày cho cả bốn cửa bằng ngôn ngữ của cửa thứ nhất — tính năng và giao diện. Cái làm nên khác biệt của người được đào tạo bài bản là **chuyển được cùng một đề xuất sang bốn ngôn ngữ**, và biết rằng lời từ chối ở cửa nào cũng thường là một câu hỏi chưa được trả lời chứ không phải một sự phản đối công nghệ.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Chọn một hệ thống mà trường bạn đang dùng (sổ liên lạc điện tử, nền tảng học tập, phần mềm điểm danh). Liệt kê mọi trường dữ liệu về người học mà nó thu, rồi đánh dấu những trường thuộc nhóm cần chế độ bảo vệ riêng theo Luật 91/2025/QH15. Ghi lại một trường mà bạn không chắc — đó là câu hỏi đáng mang tới lớp.

### Nhóm 3–4 người (30 phút)

Nhóm đóng vai tổ tư vấn cho một trường đang cân nhắc lắp hệ thống điểm danh bằng nhận diện khuôn mặt. Chuẩn bị một bản khuyến nghị ba phút gồm: lợi ích thật quy ra thời gian tiết kiệm, nghĩa vụ pháp lý phát sinh, một phương án thay thế ít xâm phạm hơn, và khuyến nghị cuối cùng. Nhóm khác đóng vai ban giám hiệu chất vấn.

### Bài tập về nhà — sản phẩm số (90–120 phút)

Lập **hồ sơ dữ liệu người học** cho một hệ thống có thật đang chạy ở một cơ sở giáo dục bạn biết. Hai phần sản phẩm:

1. **Sơ đồ luồng dữ liệu** vẽ bằng công cụ số: dữ liệu sinh ra ở đâu, đi qua những hệ thống nào, lưu ở đâu, có rời khỏi Việt Nam ở chặng nào không. Đánh dấu rõ các chặng chạm tới dữ liệu của người chưa thành niên.
2. **Bảng đăng ký dữ liệu** dạng bảng tính, mỗi dòng một trường dữ liệu với các cột: tên trường, mục đích thu, căn cứ pháp lý, thời hạn lưu, ai truy cập được, có chuyển ra nước ngoài không, mức rủi ro nếu lộ.

Kết bằng nửa trang khuyến nghị: ba trường dữ liệu bạn đề nghị **ngừng thu** và lý do. Bài tập này là bản nháp trực tiếp của phần pháp lý trong đồ án tốt nghiệp, nên hãy làm trên một hệ thống bạn thật sự quan tâm.

**Cách làm (gợi ý từng bước):**

1. Liệt kê trước bằng lời: hệ thống thu gì ở màn hình nào, ai nhập, lưu ở đâu — rồi mới vẽ.
2. Vẽ sơ đồ bằng công cụ vẽ trực tuyến; ký hiệu thống nhất: hình chữ nhật cho hệ thống, mũi tên cho luồng dữ liệu, nét đứt cho chặng ra khỏi Việt Nam.
3. Lập bảng đăng ký dữ liệu trên bảng tính, mỗi dòng một trường; điền cột căn cứ pháp lý bằng cách tra thẳng vào Luật số 91/2025/QH15, ghi số điều.
4. Đánh dấu bằng màu các dòng chạm tới dữ liệu của người chưa thành niên và các dòng thuộc nhóm cần chế độ bảo vệ riêng.
5. Chọn ba trường đề nghị ngừng thu theo nguyên tắc: thu để làm gì, không trả lời được thì không thu.

**Chấm theo:** sơ đồ phản ánh đúng hệ thống thật, có chặng xuyên biên giới nếu có (3đ) · bảng đăng ký đủ bảy cột, căn cứ pháp lý dẫn đúng điều (4đ) · đánh dấu đúng nhóm dữ liệu cần bảo vệ riêng (2đ) · ba đề nghị ngừng thu có lý do (1đ).

### Nguồn tham khảo

- Quốc hội (2025). *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15*, hiệu lực từ 01/01/2026 — [chinhphu.vn](https://chinhphu.vn/?pageid=27160&docid=214590&classid=1&typegroupid=3)
- Chính phủ (2025). *Nghị định 356/2025/NĐ-CP* quy định chi tiết thi hành Luật Bảo vệ dữ liệu cá nhân.
- Thủ tướng Chính phủ (2022). *Quyết định 131/QĐ-TTg* phê duyệt Đề án tăng cường ứng dụng công nghệ thông tin và chuyển đổi số trong giáo dục và đào tạo giai đoạn 2022–2025, định hướng đến năm 2030 — [vanban.chinhphu.vn](https://vanban.chinhphu.vn/?pageid=27160&docid=205236&classid=0)
- Bộ Giáo dục và Đào tạo (2021). *Thông tư 09/2021/TT-BGDĐT* quy định về quản lý và tổ chức dạy học trực tuyến trong cơ sở giáo dục phổ thông và cơ sở giáo dục thường xuyên.
- Bộ Giáo dục và Đào tạo (2026). *Quyết định 2422/QĐ-BGDĐT* ban hành Khung nội dung giáo dục trí tuệ nhân tạo cho học sinh phổ thông — [moet.gov.vn](https://moet.gov.vn/tin-tuc/ban-hanh-khung-noi-dung-giao-duc-tri-tue-nhan-tao-cho-hoc-sinh-pho-thong2.html)
- UNESCO (2023). *Global Education Monitoring Report — Technology in education*, chương về công bằng và tiếp cận.
- Drachsler, H., & Greller, W. (2016). Privacy and analytics — it's a DELICATE issue: A checklist for trusted learning analytics. *Proceedings of LAK '16*, 89–98.
- IMS Global / 1EdTech. Bộ chuẩn tương tác trong giáo dục: LTI, QTI, Caliper Analytics.
""",
    "quiz": {
        "title": "Kiểm tra Bài 1.5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "1.5-nghi-dinh-13",
                "type": "mcq",
                "prompt": "Một đồ án tốt nghiệp nộp tháng 6/2026 viết: hệ thống tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân. Nhận xét đúng là gì?",
                "explanation": "Từ 01/01/2026, khung pháp lý là Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 cùng Nghị định 356/2025/NĐ-CP hướng dẫn thi hành. Trích dẫn Nghị định 13/2023 như căn cứ hiện hành là sai.",
                "points": 2,
                "options": [
                    {"label": "Căn cứ đã lỗi thời: phải dẫn Luật số 91/2025/QH15 và Nghị định 356/2025/NĐ-CP", "isCorrect": True},
                    {"label": "Vẫn đúng vì Nghị định 13/2023 là văn bản chuyên ngành về dữ liệu cá nhân", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Không quan trọng, vì hệ thống chỉ dùng trong phạm vi một trường", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Đúng, vì luật mới chỉ áp dụng cho doanh nghiệp", "isCorrect": False},
                ],
            },
            {
                "key": "1.5-tre-em-dong-y",
                "type": "mcq",
                "prompt": "Theo Luật Bảo vệ dữ liệu cá nhân 2025, việc xử lý dữ liệu cá nhân của trẻ em nhằm công bố, tiết lộ thông tin về đời sống riêng tư, bí mật cá nhân của trẻ từ đủ 7 tuổi trở lên đòi hỏi sự đồng ý của ai?",
                "explanation": "Điều 24 yêu cầu sự đồng ý của cả trẻ em và người đại diện theo pháp luật. Với trẻ dưới ngưỡng này, người đại diện theo pháp luật thay mặt thực hiện quyền của chủ thể dữ liệu.",
                "points": 2,
                "options": [
                    {"label": "Cả trẻ em và người đại diện theo pháp luật của trẻ", "isCorrect": True},
                    {"label": "Chỉ cần nhà trường phê duyệt", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Chỉ cần người đại diện theo pháp luật", "isCorrect": False},
                    {"label": "Không cần đồng ý nếu dùng cho mục đích giáo dục", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "1.5-nhan-dien-khuon-mat",
                "type": "mcq",
                "prompt": "Trường muốn lắp điểm danh bằng nhận diện khuôn mặt để tiết kiệm 5 phút đầu giờ. Nhận định nào phản ánh đúng nghĩa vụ pháp lý?",
                "explanation": "Nhận diện khuôn mặt là dữ liệu sinh trắc học theo Điều 31: phải bảo mật vật lý thiết bị lưu trữ và truyền tải, hạn chế quyền truy cập, có hệ thống theo dõi phát hiện xâm phạm — chưa kể yêu cầu về sự đồng ý khi chủ thể là trẻ em.",
                "points": 2,
                "options": [
                    {"label": "Đây là dữ liệu sinh trắc học, kéo theo nghĩa vụ về bảo mật, hạn chế truy cập và theo dõi xâm phạm", "isCorrect": True},
                    {"label": "Không phát sinh nghĩa vụ gì vì ảnh chỉ dùng nội bộ trong trường", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Chỉ cần thông báo trên bảng tin của trường là đủ", "isCorrect": False},
                    {"label": "Nghĩa vụ thuộc về nhà cung cấp phần mềm, trường không liên quan", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "1.5-danh-gia-tac-dong",
                "type": "mcq",
                "prompt": "Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân phải được gửi cho cơ quan chuyên trách trong thời hạn nào?",
                "explanation": "Điều 21 quy định lập, lưu trữ và gửi một bản chính trong thời gian 60 ngày kể từ ngày đầu tiên xử lý dữ liệu cá nhân — tức là thủ tục gắn với lúc bắt đầu vận hành.",
                "points": 2,
                "options": [
                    {"label": "Trong 60 ngày kể từ ngày đầu tiên xử lý dữ liệu cá nhân", "isCorrect": True},
                    {"label": "Trong 30 ngày kể từ khi có sự cố lộ lọt dữ liệu", "isCorrect": False},
                    {"label": "Chỉ khi cơ quan quản lý yêu cầu kiểm tra", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Vào cuối mỗi năm học", "isCorrect": False},
                ],
            },
            {
                "key": "1.5-khu-nhan-dang",
                "type": "mcq",
                "prompt": "Trường muốn dùng một dịch vụ AI đặt ở nước ngoài để sinh nhận xét cho bài làm của học sinh. Biện pháp thiết kế nào giảm rủi ro pháp lý một cách căn bản nhất?",
                "explanation": "Luật ghi rõ dữ liệu cá nhân sau khi khử nhận dạng thì không còn là dữ liệu cá nhân. Khử nhận dạng trước khi gửi ra ngoài là biện pháp thiết kế mạnh hơn mọi cam kết hợp đồng.",
                "points": 2,
                "options": [
                    {"label": "Khử nhận dạng dữ liệu trước khi gửi đi, để phần gửi ra ngoài không còn là dữ liệu cá nhân", "isCorrect": True},
                    {"label": "Ghi thêm một dòng trong nội quy nhà trường", "isCorrect": False},
                    {"label": "Chọn nhà cung cấp có giao diện tiếng Việt", "isCorrect": False},
                    {"label": "Không cần biện pháp gì vì bài làm không phải dữ liệu cá nhân", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "1.5-ba-tang",
                "type": "matching",
                "prompt": "Ghép mỗi biểu hiện với tầng khoảng cách số tương ứng.",
                "explanation": "Ba tầng — tiếp cận, kỹ năng, kết quả — cần được xem xét cùng lúc. Lấp tầng một mà bỏ hai tầng sau thường khiến công nghệ nới rộng chênh lệch.",
                "points": 3,
                "pairs": [
                    {"left": "Học sinh chỉ dùng được điện thoại của mẹ sau 20 giờ", "right": "Tầng tiếp cận"},
                    {"left": "Học sinh thạo mạng xã hội nhưng lúng túng khi nộp tệp đúng định dạng", "right": "Tầng kỹ năng"},
                    {"left": "Hai lớp cùng dùng một nền tảng, chênh lệch kết quả lại giãn rộng thêm", "right": "Tầng kết quả"},
                ],
            },
            {
                "key": "1.5-khoang-cach-chi-thiet-bi",
                "type": "true_false",
                "prompt": "Khi mọi học sinh trong lớp đều đã có thiết bị và đường truyền, có thể coi vấn đề khoảng cách số đã được giải quyết.",
                "explanation": "Còn hai tầng nữa: kỹ năng dùng thiết bị cho việc học, và khả năng biến việc sử dụng thành tiến bộ thật. Hai tầng này thường phân hoá theo hoàn cảnh gia đình ngay cả khi tầng thiết bị đã đồng đều.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False, "misconception": "cngdtt.digital-divide-access-only"},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.5-qd-2422",
                "type": "mcq",
                "prompt": "Quyết định 2422/QĐ-BGDĐT năm 2026 tạo ra nhu cầu nghề nghiệp nào rõ rệt nhất cho sinh viên ngành Công nghệ giáo dục?",
                "explanation": "Khung nội dung giáo dục AI với phần cốt lõi 12 tiết mỗi lớp mỗi năm, triển khai từ năm học 2026–2027, kéo theo nhu cầu rất lớn và rất gấp về học liệu và tập huấn giáo viên.",
                "points": 2,
                "options": [
                    {"label": "Phát triển học liệu và tập huấn giáo viên để dạy nội dung AI trong trường phổ thông", "isCorrect": True},
                    {"label": "Bán thiết bị máy tính cho các trường", "isCorrect": False},
                    {"label": "Viết phần mềm mô hình ngôn ngữ lớn của riêng Việt Nam", "isCorrect": False},
                    {"label": "Không tạo ra nhu cầu gì vì đây chỉ là văn bản định hướng", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "1.5-bon-cua",
                "type": "matching",
                "prompt": "Ghép mỗi người ra quyết định với loại bằng chứng thuyết phục được họ.",
                "explanation": "Cùng một đề xuất phải nói được bằng bốn ngôn ngữ. Trình bày tính năng cho cả bốn cửa là lỗi phổ biến nhất của người mới vào nghề.",
                "points": 3,
                "pairs": [
                    {"left": "Giáo viên trực tiếp dạy", "right": "Ước tính giờ công tăng thêm và việc gì được bỏ bớt để đổi lại"},
                    {"left": "Tổ trưởng chuyên môn", "right": "Bản đối chiếu với yêu cầu cần đạt của môn học"},
                    {"left": "Ban giám hiệu", "right": "Ba rủi ro chính kèm phương án dừng nếu thất bại"},
                    {"left": "Cơ quan quản lý cấp trên", "right": "Căn cứ pháp lý và mẫu số liệu báo cáo xuất ra được"},
                ],
            },
            {
                "key": "1.5-cau-hoi-kho-khan-nhat",
                "type": "mcq",
                "prompt": "Câu hỏi nào nên có trong mọi đề xuất triển khai công nghệ ở trường phổ thông Việt Nam?",
                "explanation": "Học sinh khó khăn nhất trong lớp sẽ dùng thứ này như thế nào — trả lời bằng một tình huống cụ thể về thiết bị, thời điểm và đường truyền, chứ không bằng một câu cam kết chung.",
                "points": 2,
                "options": [
                    {"label": "Học sinh khó khăn nhất trong lớp sẽ dùng thứ này thế nào, ở đâu, lúc nào", "isCorrect": True},
                    {"label": "Sản phẩm có phải công nghệ mới nhất trên thị trường không", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Có bao nhiêu trường trong tỉnh đã triển khai", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Giao diện đã hỗ trợ chế độ tối chưa", "isCorrect": False},
                ],
            },
            {
                "key": "1.5-de-an-131",
                "type": "mcq",
                "prompt": "Vì sao nên gắn đề xuất của mình vào một văn bản chính sách như Đề án theo Quyết định 131/QĐ-TTg?",
                "explanation": "Văn bản chính sách vừa là nguồn ngân sách vừa là ngôn ngữ mà cấp quản lý dùng để xét duyệt. Một đề xuất không thuộc dòng nào rất khó tìm được chỗ cấp kinh phí và người chịu trách nhiệm.",
                "points": 2,
                "options": [
                    {"label": "Vì đó vừa là nguồn kinh phí vừa là ngôn ngữ mà cấp quản lý dùng để xét duyệt", "isCorrect": True},
                    {"label": "Vì trích dẫn văn bản làm đề xuất trông chuyên nghiệp hơn", "isCorrect": False},
                    {"label": "Vì luật bắt buộc mọi đề xuất phải trích dẫn ít nhất một quyết định", "isCorrect": False},
                    {"label": "Không cần thiết: chỉ cần công nghệ đủ tốt là sẽ được duyệt", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "1.5-viet-luan-boi-canh",
                "type": "essay",
                "prompt": "Chọn một cơ sở giáo dục bạn biết rõ. Viết 250–350 từ đề xuất một ứng dụng công nghệ cụ thể, trong đó bắt buộc nêu: văn bản chính sách mà đề xuất gắn vào, dữ liệu người học sẽ thu và căn cứ pháp lý tương ứng, và cách xử lý cho học sinh nằm ở phía yếu của cả ba tầng khoảng cách số.",
                "points": 5,
            },
            {
                "key": "1.5-toi-thieu-hoa",
                "type": "mcq",
                "prompt": "Nguyên tắc tối thiểu hoá dữ liệu được vận dụng đúng nhất trong tình huống nào?",
                "explanation": "Chỉ thu trường dữ liệu mà có một quyết định cụ thể phụ thuộc vào nó. Thu sẵn để sau này có thể dùng là vi phạm cả tối thiểu hoá lẫn giới hạn mục đích.",
                "points": 2,
                "options": [
                    {"label": "Bỏ trường ảnh chân dung vì không quyết định sư phạm nào phụ thuộc vào nó", "isCorrect": True},
                    {"label": "Thu sẵn nhiều trường để sau này phân tích cho phong phú", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Thu đủ mọi trường nhưng đặt mật khẩu mạnh cho cơ sở dữ liệu", "isCorrect": False},
                    {"label": "Giữ toàn bộ nhật ký thao tác vĩnh viễn để phục vụ nghiên cứu về sau", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                ],
            },
            {
                "key": "1.5-hieu-ung-nhan-dan",
                "type": "mcq",
                "prompt": "Bảng điều khiển cảnh báo sớm hiển thị cho giáo viên danh sách học sinh có nguy cơ trượt. Rủi ro sư phạm đặc thù ở đây là gì?",
                "explanation": "Hiệu ứng nhãn dán: dự đoán làm thay đổi kỳ vọng của giáo viên, và kỳ vọng thay đổi có thể khiến dự đoán tự trở thành hiện thực. Vì vậy phải quy định trước ai được xem và người xem phải làm gì tiếp theo.",
                "points": 2,
                "options": [
                    {"label": "Dự đoán có thể tự làm cho nó đúng qua thay đổi kỳ vọng của giáo viên", "isCorrect": True},
                    {"label": "Bảng điều khiển làm giáo viên tốn thời gian đọc", "isCorrect": False},
                    {"label": "Không có rủi ro nào nếu mô hình dự đoán đủ chính xác", "isCorrect": False},
                    {"label": "Học sinh sẽ không tin vào công nghệ nữa", "isCorrect": False},
                ],
            },
            {
                "key": "1.5-chuan-tuong-tac",
                "type": "matching",
                "prompt": "Ghép mỗi chuẩn tương tác với vấn đề nó giải quyết trong hồ sơ mời thầu.",
                "explanation": "Đưa các chuẩn này thành yêu cầu bắt buộc là biện pháp rẻ nhất chống khoá nhà cung cấp — chi phí chuyển đổi tích luỹ theo từng học kỳ dữ liệu và học liệu.",
                "points": 3,
                "pairs": [
                    {"left": "xAPI", "right": "Ghi nhận hoạt động học ở dạng chuyển được giữa các hệ thống"},
                    {"left": "LTI", "right": "Kết nối công cụ ngoài vào hệ quản lý học tập mà không phải cấp lại tài khoản"},
                    {"left": "QTI", "right": "Mang ngân hàng câu hỏi đã soạn sang hệ thống khác"},
                    {"left": "Điều khoản xuất dữ liệu thô", "right": "Giữ lại lịch sử học tập khi chấm dứt hợp đồng"},
                ],
            },
        ],
    },
}

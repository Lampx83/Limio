# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 1.6 · Đồ án sách AR: yêu cầu, công cụ và tiêu chí chấm",
    "durationMin": 60,
    "description": "Hướng dẫn thực hiện đồ án xuyên suốt học phần: chọn nội dung đáng dựng bằng AR, ba tuyến công cụ và cách chọn, sáu mốc nộp bài, và bảng tiêu chí chấm 100 điểm.",
    "objectives": [
        "Chọn được một nội dung dạy học mà AR giải quyết đúng một khó khăn học tập có thật",
        "Chọn được tuyến công cụ phù hợp với năng lực kỹ thuật và điều kiện thiết bị của người học",
        "Lập được kế hoạch sáu mốc cho đồ án và tự chấm bằng bảng tiêu chí trước khi nộp",
    ],
    "summary": [
        "Sách AR là sản phẩm cuối của học phần: trang in làm mốc nhận diện, nội dung số chồng lên trang, cộng hồ sơ thẩm định và biên bản thử nghiệm với người học thật.",
        "Nội dung đáng dựng bằng AR là nội dung vốn ba chiều hoặc vốn là quá trình động; nội dung nằm gọn trong một hình vẽ tĩnh thì AR chỉ là lớp trang trí đắt tiền.",
        "Ba tuyến công cụ: nền tảng không lập trình, web AR bằng thẻ model-viewer và mã QR, và lập trình sâu bằng Unity — chọn theo điều kiện thiết bị của người học chứ không theo độ khó bạn muốn thử.",
        "Đồ án chấm theo sáu mốc và một bảng 100 điểm, trong đó phần kỹ thuật chỉ chiếm 20 điểm — phần lớn điểm nằm ở lý do sư phạm, thiết kế nhận thức và bằng chứng thử nghiệm.",
    ],
    "body": r"""
## Sản phẩm phải nộp và tiêu chí đạt

**Sách AR** ở đây là một tài liệu học tập in được (hoặc đọc trên màn hình) mà mỗi trang có một vùng đóng vai trò **mốc nhận diện**: người học đưa điện thoại lên, phần mềm nhận ra trang ấy và hiện chồng lên đó một mô hình ba chiều, một hoạt hình, một lớp chú giải hoặc một mô phỏng.

Hồ sơ nộp cuối kỳ gồm bốn phần, thiếu phần nào cũng không được bảo vệ:

| Phần | Nội dung | Dung lượng gợi ý |
|---|---|---|
| 1. Bản in | Tệp PDF in được của ít nhất **4 trang sách**, trong đó tối thiểu **3 trang có nội dung AR** | A4 hoặc A5, in thử thật một lần |
| 2. Nội dung số | Mô hình, hoạt hình, âm thanh và cấu hình quét — chạy được trên điện thoại phổ thông | Mỗi cảnh tải xong dưới 5 giây trên mạng 4G |
| 3. Hồ sơ thẩm định | Vì sao nội dung này đáng dựng bằng AR, bằng chứng liên quan, dữ liệu người học (nếu có), phương án cho người học thiếu thiết bị | 3–5 trang |
| 4. Biên bản thử nghiệm | Thử với **ít nhất 3 người học thật** thuộc đúng nhóm đối tượng, ghi lại chỗ họ tắc và những gì bạn đã sửa sau đó | 2 trang kèm ảnh hoặc video |

> [!ghi-nho] Tiêu chí đạt tối thiểu: một người học chưa từng thấy sản phẩm, chỉ cầm trang giấy và điện thoại của **chính họ**, tự mở được nội dung AR trong vòng một phút mà không cần bạn hướng dẫn. Nếu phải đứng bên cạnh chỉ dẫn, sản phẩm chưa đạt — và đây là chỗ rớt phổ biến nhất.

## Chọn nội dung: khi nào AR đáng dùng

Đây là quyết định quan trọng nhất, quyết định trong tuần đầu, và là chỗ bảng thẩm định ở Bài 1.3 được dùng thật. AR chỉ có lợi thế khi nội dung có ít nhất một trong bốn đặc điểm:

| Đặc điểm nội dung | Vì sao AR giúp | Ví dụ chọn được |
|---|---|---|
| Vốn là vật thể ba chiều | Hình vẽ trên giấy buộc người học tự dựng lại chiều sâu trong đầu — đó là tải thừa | Cấu trúc tinh thể, mô hình phân tử, cấu tạo khớp gối, kiến trúc đình làng |
| Vốn là quá trình động | Chuỗi hình tĩnh bắt người học tự nội suy chuyển động | Chu trình nước, hoạt động của van tim, dòng điện trong mạch, tiến trình một trận đánh trên bản đồ |
| Quá lớn, quá nhỏ hoặc quá nguy hiểm để có thật trong lớp | Đưa được vào lớp thứ không thể mang tới | Hệ Mặt Trời, tế bào, lò phản ứng, hiện trường địa chất |
| Cần đối chiếu lớp thông tin lên vật thật | Chú giải hiện đúng chỗ, không phải tra bảng bên cạnh | Lớp chú giải trên bản đồ, trên bản vẽ kỹ thuật, trên mẫu vật |

> [!canh-bao] Ba lựa chọn nội dung năm nào cũng có và năm nào cũng bị trả lại: một bài thơ hiện lên hình minh hoạ, một danh sách từ vựng hiện lên ảnh đồ vật, một dòng thời gian lịch sử hiện lên chân dung nhân vật. Cả ba đều **không** có đặc điểm nào trong bảng trên — hình tĩnh in ngay trên giấy làm được đúng việc ấy, rẻ hơn và không cần điện thoại.

Trước khi bắt tay, viết ba câu và đưa giảng viên duyệt: nội dung là gì, **người học thường hiểu sai hoặc tắc ở chỗ nào**, và AR gỡ chỗ tắc ấy bằng cách nào. Câu thứ hai là câu bị bỏ trống nhiều nhất, và đồ án nào bỏ trống nó cũng sa vào trang trí.

### Bằng chứng hiện có về AR trong giáo dục

Trước khi dựng, cần biết tài liệu nghiên cứu nói gì — và biết đọc nó theo đúng cách đã học ở Bài 1.4.

Phân tích tổng hợp được trích dẫn nhiều nhất là Garzón và Acevedo (2019) trên *Educational Research Review*: tổng hợp **64 nghiên cứu định lượng**, cho hiệu quả trung bình khoảng **d = 0,68** lên kết quả học tập. Con số này lớn — theo thang Kraft ở Bài 1.4 thì lớn bất thường — nên phản xạ đúng là đi tìm lý do:

- Phần lớn nghiên cứu gốc là **thử nghiệm ngắn**, thường vài buổi tới vài tuần, nên **hiệu ứng mới lạ** chưa kịp tan.
- Nhiều nghiên cứu đo bằng **bài kiểm tra do chính nhóm nghiên cứu soạn**, bám sát nội dung đã dựng bằng AR.
- Nhóm đối chứng thường học bằng tài liệu tĩnh **không có hoạt động tương đương**, nên một phần hiệu quả đến từ việc nhóm AR đơn giản là được tương tác nhiều hơn.
- Cỡ mẫu nhỏ và ngẫu nhiên hoá theo lớp mà không tính hiệu ứng thiết kế — vấn đề đã phân tích ở Bài 1.4.

Điểm đáng chú ý hơn con số trung bình là **các biến điều tiết**: hiệu quả thay đổi mạnh theo cách tiếp cận sư phạm đi kèm chứ không theo mức độ tinh vi của công nghệ. AR gắn với học tập khám phá có hướng dẫn và học theo dự án cho hiệu quả cao hơn hẳn AR chỉ dùng để trình bày nội dung — nghĩa là kết luận của cả một dòng nghiên cứu trùng khớp với luận điểm Clark ở Bài 1.1: **phương pháp mới là thứ dạy, công nghệ chỉ mở đường cho phương pháp**.

> [!ghi-nho] Khi bảo vệ đồ án, đừng dẫn d = 0,68 như bằng chứng rằng sách AR của bạn sẽ hiệu quả. Hãy dẫn nó kèm bốn cảnh báo trên và nói rõ bạn thiết kế thử nghiệm của mình thế nào để không mắc lại. Đó chính là phần điểm cao nhất của mục lý do sư phạm.

### Cơ sở nhận thức: chia chú ý, hiện thân và năng lực không gian

AR không tự động giảm tải nhận thức — nó **dịch chuyển** tải. Ba cơ chế cần cân nhắc khi thiết kế từng trang:

**Chia chú ý.** Người học phải phối hợp ba nguồn thông tin cùng lúc: trang giấy, màn hình điện thoại, và tay giữ thiết bị. Nếu chú giải nằm trên giấy còn mô hình nằm trên màn hình, họ phải liên tục chuyển qua lại và giữ tạm thông tin trong trí nhớ làm việc — đúng định nghĩa tải thừa. Cách gỡ: **đưa chú giải vào lớp phủ**, đặt sát chi tiết mà nó mô tả, thay vì để lệch giữa hai mặt phẳng.

**Nhận thức hiện thân.** Lợi thế lý thuyết mạnh nhất của AR là cho phép người học **xoay, đi vòng quanh, thay đổi góc nhìn bằng chính chuyển động cơ thể**. Hành động ấy tạo ra biểu diễn không gian tốt hơn so với xem một hoạt hình quay sẵn. Hệ quả thiết kế cụ thể: nếu mô hình của bạn chỉ được xem từ một góc cố định, bạn đang trả giá của AR mà không lấy được lợi ích của nó — một video nhúng đã làm được đúng việc đó, rẻ hơn.

**Năng lực không gian như biến điều tiết.** Người học có năng lực không gian thấp thường hưởng lợi nhiều nhất từ mô hình ba chiều, vì mô hình làm thay phần việc mà họ vốn phải làm trong đầu. Nhưng cũng chính nhóm này dễ lạc nhất nếu giao diện đòi thao tác phức tạp. Thiết kế đúng cho họ: **ít thao tác, mỗi cảnh một ý, có tư thế mặc định để quay về khi lạc**.

> [!canh-bao] Chi tiết hấp dẫn nhưng lạc mục tiêu gây hại trong AR nặng hơn trong học liệu phẳng, vì chúng vừa mới lạ vừa chiếm cả không gian thật. Một mô hình khủng long biết gầm và nhảy sẽ được học sinh nhớ rất rõ — nhớ con khủng long, không nhớ nội dung bài.

### Ràng buộc kỹ thuật cần quyết sớm

| Hạng mục | Ràng buộc thực tế | Quyết định nên chốt ở mốc 1 |
|---|---|---|
| Mốc nhận diện trên trang in | Phần mềm nhận diện dựa trên đặc trưng tự nhiên của ảnh: cần chi tiết phong phú, tương phản cao, **không đối xứng và không lặp hoạ tiết** | Thiết kế trang có vùng ảnh giàu đặc trưng; tránh nền trắng trơn và hoa văn lặp |
| Định dạng mô hình | Web AR dùng glTF nhị phân (`.glb`); nền tảng Apple dùng thêm định dạng riêng | Chuẩn hoá về `.glb`, chuyển đổi khi cần |
| Ngân sách tài nguyên | Mỗi cảnh nên tải xong dưới 5 giây trên mạng di động; ảnh bề mặt là thứ nặng nhất, không phải số đa giác | Giới hạn mỗi mô hình dưới 10 MB, giảm kích thước ảnh bề mặt trước khi giảm lưới |
| Điều kiện ánh sáng | Lớp học ngược sáng hoặc thiếu sáng làm hỏng nhận diện | Thử ngay trong phòng học thật, không chỉ ở bàn làm việc |
| Che khuất và tỉ lệ | Mô hình nổi lơ lửng hoặc sai tỉ lệ phá vỡ ý nghĩa không gian | Đặt tỉ lệ theo vật thật và ghi rõ trong chú giải nếu đã phóng to |

## Ba tuyến công cụ và cách chọn

Chọn tuyến theo **điều kiện thiết bị của người học**, không theo độ khó bạn muốn thử sức. Nếu học sinh không cài được ứng dụng — máy yếu, bộ nhớ đầy, dùng máy của cha mẹ — thì tuyến A hỏng ngay từ khâu đầu, dù sản phẩm dựng đẹp đến đâu.

| Tuyến | Cách làm | Công cụ | Hợp khi | Rủi ro |
|---|---|---|---|---|
| A. Nền tảng không lập trình | Tải ảnh trang sách lên làm mốc nhận diện, gắn video hoặc mô hình, người học quét bằng ứng dụng của nền tảng | [Artivive](https://artivive.com/), [Assemblr EDU](https://www.assemblrworld.com/), [CoSpaces Edu](https://cospaces.io/edu/) | Bạn tập trung vào nội dung, có thời gian hướng dẫn cài ứng dụng | Người học phải cài app; bản miễn phí có giới hạn; ngừng dịch vụ là mất sản phẩm |
| B. Web AR bằng mã QR | Mỗi trang một mã QR mở một trang web chứa thẻ `<model-viewer>` với tệp mô hình `.glb`; người học bấm nút xem trong không gian thật | [model-viewer](https://modelviewer.dev/), [Scene Viewer của Android](https://developers.google.com/ar/develop/scene-viewer) | Người học không cài được ứng dụng; bạn muốn giữ được sản phẩm lâu dài | Cần biết chút HTML; trải nghiệm đơn giản hơn tuyến A |
| C. Lập trình sâu | Dựng ứng dụng riêng, nhận diện ảnh và tương tác phức tạp | Unity với AR Foundation, [ZapWorks](https://zap.works/) | Nhóm có người lập trình và nội dung cần tương tác nhiều bước | Rất tốn thời gian; dễ hết hạn nộp khi mới xong phần kỹ thuật |

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Tuyến B — chuỗi kỹ thuật tối thiểu, không cần cài ứng dụng</div>
  <div style="min-width:36rem;display:flex;align-items:center;gap:.4rem">
    <div style="flex:1;padding:.7rem .6rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Trang in</strong><br>mã QR ở góc</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Trình duyệt</strong><br>mở trang web tĩnh</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>model-viewer</strong><br>tải tệp .glb</div>
    <div style="flex:0 0 auto;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem .6rem;background:rgba(217,150,40,.85);color:#fff;border-radius:.45rem;text-align:center;font-size:1.02rem;line-height:1.45"><strong>Chế độ AR</strong><br>mô hình đặt trong không gian thật</div>
  </div>
  <div style="min-width:36rem;display:flex;gap:.4rem;margin:.45rem 0 0;font-size:.98rem;opacity:.75;line-height:1.5">
    <div style="flex:1;text-align:center">bạn thiết kế</div>
    <div style="flex:0 0 auto;width:1.3rem"></div>
    <div style="flex:1;text-align:center">không cài gì</div>
    <div style="flex:0 0 auto;width:1.3rem"></div>
    <div style="flex:1;text-align:center">giữ dưới 10 MB</div>
    <div style="flex:0 0 auto;width:1.3rem"></div>
    <div style="flex:1;text-align:center">thử ở phòng học thật</div>
  </div>
</div>
```

**Khuyến nghị mặc định là tuyến B.** Nó rẻ nhất về mặt điều kiện người học (chỉ cần trình duyệt), không khoá bạn vào một nhà cung cấp — đúng tiêu chí *khả năng rời bỏ* trong phiếu thẩm định Bài 1.3 — và phần khó nhất chỉ là kiếm được tệp mô hình tốt.

Nguồn mô hình ba chiều dùng được, **luôn kiểm giấy phép trước khi tải**: [Sketchfab](https://sketchfab.com/features/free-3d-models) (lọc theo giấy phép Creative Commons), [Poly Pizza](https://poly.pizza/) (phần lớn CC0 hoặc CC BY). Ghi nguồn ngay trong sách, không dồn xuống cuối. Nếu không tìm được mô hình đúng ý, hai lối ra: tự dựng bằng phần mềm dựng hình ba chiều, hoặc chụp nhiều ảnh một vật thật rồi dựng mô hình từ ảnh — cả hai đều tốn thời gian, hãy quyết sớm.

> [!meo] Thử nghiệm kỹ thuật nhỏ nhất có thể trong **buổi đầu tiên**: một trang giấy, một mã QR, một mô hình tải sẵn từ Poly Pizza, mở trên đúng chiếc điện thoại rẻ tiền nhất bạn mượn được. Chạy được chuỗi đó rồi hãy nghĩ tới nội dung sách. Nhóm nào để phần kỹ thuật tới tuần cuối thì tuần cuối mới phát hiện mô hình 80 MB không tải nổi trên mạng nhà trường.

```html
<div style="margin:1.3rem 0;display:flex;flex-wrap:wrap;gap:.8rem">
  <div style="flex:1 1 15rem;border:2px solid rgba(220,38,38,.5);border-radius:.5rem;overflow:hidden">
    <div style="background:rgba(220,38,38,.85);color:#fff;padding:.45rem .7rem;font-size:1.02rem;font-weight:600">Trang khó nhận diện</div>
    <div style="padding:.7rem;font-size:1.02rem;line-height:1.6">Nền trắng trơn, một dòng tiêu đề, hoa văn viền lặp đều bốn góc — thuật toán không tìm đủ đặc trưng để neo, và hoạ tiết lặp làm nó nhầm vùng này với vùng kia.</div>
  </div>
  <div style="flex:1 1 15rem;border:2px solid rgba(13,148,136,.5);border-radius:.5rem;overflow:hidden">
    <div style="background:rgba(13,148,136,.85);color:#fff;padding:.45rem .7rem;font-size:1.02rem;font-weight:600">Trang dễ nhận diện</div>
    <div style="padding:.7rem;font-size:1.02rem;line-height:1.6">Một vùng ảnh giàu chi tiết, tương phản cao, bố cục bất đối xứng, không lặp hoạ tiết — thuật toán neo được nhiều điểm đặc trưng phân bố khắp trang.</div>
  </div>
</div>
```

## Sáu mốc và bảng tiêu chí chấm

Đồ án chạy song song với năm module, mỗi mốc nộp một mảnh và được góp ý ngay — không có bản nộp một lần vào cuối kỳ.

| Mốc | Gắn với | Nộp gì |
|---|---|---|
| 1 | Module 1 | Ba câu chọn nội dung đã duyệt + hồ sơ thẩm định sơ bộ theo bảy tiêu chí + thử nghiệm kỹ thuật nhỏ nhất chạy được |
| 2 | Module 2 | Bản thảo nội dung 4 trang, nêu rõ phần nào do AI hỗ trợ soạn và bạn đã kiểm chứng thế nào |
| 3 | Module 3 | Phần luyện tập kèm sách: câu hỏi phân hoá theo mức, cơ chế ôn lại |
| 4 | Module 4 | Kế hoạch đo: đo cái gì để biết sách có tác dụng, dữ liệu nào thu, căn cứ pháp lý nào |
| 5 | Module 5 | Bản dựng AR hoàn chỉnh + biên bản thử với 3 người học thật + danh sách sửa sau thử nghiệm |
| 6 | Buổi cuối | Bảo vệ 10 phút: 3 phút trình bày lý do sư phạm, 4 phút demo trực tiếp, 3 phút trả lời chất vấn |

| Tiêu chí | Điểm | Đạt tối đa khi |
|---|---|---|
| Lý do sư phạm và hồ sơ thẩm định | 20 | Chỉ ra được chỗ người học thường tắc, và chứng minh AR gỡ đúng chỗ đó thay vì trang trí |
| Chất lượng nội dung dạy học | 20 | Nội dung chính xác, có mục tiêu rõ, gắn được với yêu cầu cần đạt của môn học |
| Thiết kế nhận thức | 15 | Chú giải đặt sát chi tiết, không có hiệu ứng thừa, người học không phải chia sự chú ý giữa giấy và màn hình |
| Chất lượng kỹ thuật | 20 | Quét ổn định dưới ánh sáng lớp học, tải nhanh, chạy được trên điện thoại phổ thông, có phương án cho người không có thiết bị |
| Bằng chứng thử nghiệm | 15 | Biên bản trung thực với người học thật, nêu được chỗ hỏng và bản sửa tương ứng |
| Tài liệu và giấy phép | 10 | Hướng dẫn sử dụng một trang; mọi mô hình, ảnh, âm thanh đều ghi rõ nguồn và giấy phép |

> [!canh-bao] Hai lỗi bị trừ điểm nặng và không cứu được ở buổi bảo vệ: **biên bản thử nghiệm chỉ ghi lời khen** (thử nghiệm không tìm ra vấn đề nào tức là chưa thử nghiệm), và **tài nguyên không rõ giấy phép** — một mô hình tải từ trang chia sẻ không ghi nguồn là lỗi về liêm chính, không phải lỗi hình thức.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Viết ba câu chọn nội dung cho đồ án: nội dung là gì, người học thường tắc ở đâu, AR gỡ chỗ tắc ấy thế nào. Sau đó tự đối chiếu với bảng bốn đặc điểm — nếu nội dung của bạn không có đặc điểm nào, đổi nội dung ngay bây giờ, đừng chờ tới mốc 2.

### Nhóm 3–4 người (30 phút)

Mỗi người trình bày ba câu của mình trong hai phút; nhóm chất vấn bằng đúng một câu: *nếu bỏ AR đi và chỉ in một hình tĩnh thật tốt, người học mất gì?* Ghi lại câu trả lời — nếu không trả lời được, đó là ý tưởng cần đổi. Cuối buổi, nhóm chọn một ý tưởng yếu nhất và cùng sửa cho nó đạt.

### Bài tập về nhà — sản phẩm số (120 phút)

Chạy **thử nghiệm kỹ thuật nhỏ nhất** của mốc 1 và nộp bằng chứng:

1. Chọn một mô hình ba chiều có giấy phép rõ ràng từ Poly Pizza hoặc Sketchfab, tải tệp `.glb` (dưới 10 MB).
2. Dựng một trang web tối giản dùng thẻ `<model-viewer>` với thuộc tính bật chế độ AR, đặt lên một dịch vụ lưu trữ trang tĩnh miễn phí.
3. Tạo mã QR trỏ tới trang đó, in ra giấy A5 cùng một dòng hướng dẫn cho người học.
4. Thử trên **hai điện thoại khác nhau**, trong đó có một máy đời thấp, và đo thời gian từ lúc quét tới lúc mô hình hiện ra.
5. Nộp: liên kết trang, ảnh chụp tờ giấy, hai số đo thời gian, và một đoạn ba dòng ghi lại thứ đã hỏng ở lần thử đầu tiên.

Nhóm chọn tuyến A hoặc C làm việc tương đương trên nền tảng của mình, nhưng vẫn phải nộp đủ năm mục trên, trong đó mục 5 là bắt buộc.

### Nguồn tham khảo

- Google (2024). *model-viewer — web component hiển thị mô hình 3D và AR* — [modelviewer.dev](https://modelviewer.dev/)
- Google. *Scene Viewer — hiển thị mô hình AR trên Android* — [developers.google.com/ar](https://developers.google.com/ar/develop/scene-viewer)
- Artivive — nền tảng AR cho sách và tranh in — [artivive.com](https://artivive.com/)
- Poly Pizza — thư viện mô hình 3D miễn phí có giấy phép rõ ràng — [poly.pizza](https://poly.pizza/)
- Sketchfab — thư viện mô hình 3D, lọc theo giấy phép Creative Commons — [sketchfab.com](https://sketchfab.com/features/free-3d-models)
- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.) — chương về nguyên tắc mạch lạc và chỉ dẫn, áp thẳng được cho thiết kế lớp phủ AR.
- Garzón, J., & Acevedo, J. (2019). Meta-analysis of the impact of Augmented Reality on students' learning gains. *Educational Research Review*, 27, 244–260. — [doi.org/10.1016/j.edurev.2019.04.001](https://doi.org/10.1016/j.edurev.2019.04.001)
- Garzón, J., Kinshuk, Baldiris, S., Gutiérrez, J., & Pavón, J. (2020). How do pedagogical approaches affect the impact of augmented reality on education? A meta-analysis and research synthesis. *Educational Research Review*, 31, 100334.
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect — cơ sở để giảm dần hỗ trợ trong lớp phủ AR. *Educational Psychologist*, 38(1), 23–31.
""",
    "quiz": {
        "title": "Kiểm tra Bài 1.6",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "1.6-chon-noi-dung",
                "type": "mcq",
                "prompt": "Nội dung nào dưới đây đáng dựng bằng AR nhất theo bốn đặc điểm đã nêu?",
                "explanation": "Hoạt động của van tim là quá trình động ba chiều — chuỗi hình tĩnh buộc người học tự nội suy chuyển động. Ba phương án còn lại đều nằm gọn trong một hình in sẵn.",
                "points": 2,
                "options": [
                    {"label": "Hoạt động đóng mở của van tim theo chu kỳ", "isCorrect": True},
                    {"label": "Danh sách từ vựng kèm ảnh minh hoạ đồ vật", "isCorrect": False},
                    {"label": "Dòng thời gian các sự kiện lịch sử kèm chân dung nhân vật", "isCorrect": False},
                    {"label": "Một bài thơ kèm hình minh hoạ khung cảnh", "isCorrect": False},
                ],
            },
            {
                "key": "1.6-ba-cau",
                "type": "mcq",
                "prompt": "Trong ba câu phải viết trước khi bắt tay làm đồ án, câu nào hay bị bỏ trống nhất và vì sao điều đó nguy hiểm?",
                "explanation": "Câu về chỗ người học thường tắc. Bỏ trống nó nghĩa là chưa có vấn đề học tập nào để giải, và sản phẩm gần như chắc chắn sa vào trang trí.",
                "points": 2,
                "options": [
                    {"label": "Câu về chỗ người học thường hiểu sai hoặc tắc — bỏ trống nó thì sản phẩm không có vấn đề học tập để giải", "isCorrect": True},
                    {"label": "Câu về tên công nghệ sẽ dùng — vì hội đồng cần biết công cụ", "isCorrect": False, "misconception": "cngdtt.tool-first"},
                    {"label": "Câu về nội dung là gì — vì phải đặt tên đề tài trước", "isCorrect": False},
                    {"label": "Không câu nào quan trọng bằng chất lượng mô hình ba chiều", "isCorrect": False},
                ],
            },
            {
                "key": "1.6-chon-tuyen",
                "type": "mcq",
                "prompt": "Lớp đối tượng của bạn phần lớn dùng điện thoại của cha mẹ, bộ nhớ đầy, khó cài thêm ứng dụng. Nên chọn tuyến công cụ nào?",
                "explanation": "Tuyến B — web AR bằng mã QR — chỉ cần trình duyệt, không phải cài ứng dụng. Chọn tuyến phải xuất phát từ điều kiện thiết bị của người học.",
                "points": 2,
                "options": [
                    {"label": "Tuyến B: mã QR mở trang web có thẻ model-viewer", "isCorrect": True},
                    {"label": "Tuyến A: nền tảng không lập trình, hướng dẫn học sinh cài ứng dụng", "isCorrect": False},
                    {"label": "Tuyến C: dựng ứng dụng riêng cho chắc chắn", "isCorrect": False},
                    {"label": "Tuyến nào cũng được, miễn sản phẩm dựng đẹp", "isCorrect": False, "misconception": "cngdtt.access-equals-learning"},
                ],
            },
            {
                "key": "1.6-tieu-chi-dat",
                "type": "mcq",
                "prompt": "Tiêu chí đạt tối thiểu của sản phẩm là gì?",
                "explanation": "Người học chưa từng thấy sản phẩm, dùng điện thoại của chính họ, tự mở được nội dung AR trong một phút mà không cần hướng dẫn trực tiếp.",
                "points": 2,
                "options": [
                    {"label": "Người học lạ tự mở được nội dung AR trong một phút bằng thiết bị của chính họ, không cần bạn chỉ dẫn", "isCorrect": True},
                    {"label": "Mô hình ba chiều có độ phân giải cao và hiệu ứng đẹp", "isCorrect": False},
                    {"label": "Sản phẩm chạy được trên máy của người làm đồ án", "isCorrect": False},
                    {"label": "Giảng viên xem demo và thấy ấn tượng", "isCorrect": False},
                ],
            },
            {
                "key": "1.6-thu-nghiem-ky-thuat",
                "type": "mcq",
                "prompt": "Vì sao thử nghiệm kỹ thuật nhỏ nhất phải chạy ngay trong buổi đầu chứ không để tới cuối kỳ?",
                "explanation": "Những thứ hỏng ở khâu kỹ thuật — mô hình quá nặng, mạng trường yếu, máy đời thấp không mở nổi — chỉ lộ ra khi chạy thật. Phát hiện ở tuần cuối thì không còn thời gian đổi hướng.",
                "points": 2,
                "options": [
                    {"label": "Vì các rủi ro như tệp quá nặng hay máy yếu chỉ lộ ra khi chạy thật, và phát hiện muộn thì không kịp đổi hướng", "isCorrect": True},
                    {"label": "Vì giảng viên yêu cầu nộp sớm để lấy điểm chuyên cần", "isCorrect": False},
                    {"label": "Vì cần chọn công cụ trước rồi mới tìm nội dung phù hợp", "isCorrect": False, "misconception": "cngdtt.tool-first"},
                    {"label": "Không cần thiết nếu nhóm có người giỏi kỹ thuật", "isCorrect": False},
                ],
            },
            {
                "key": "1.6-trong-so-diem",
                "type": "mcq",
                "prompt": "Trong bảng 100 điểm, phần chất lượng kỹ thuật chiếm 20 điểm. Điều đó nói gì về trọng tâm đánh giá?",
                "explanation": "Phần lớn điểm nằm ở lý do sư phạm, chất lượng nội dung, thiết kế nhận thức và bằng chứng thử nghiệm. Một sản phẩm kỹ thuật ấn tượng nhưng không giải quyết khó khăn học tập nào vẫn mất phần lớn điểm.",
                "points": 2,
                "options": [
                    {"label": "Kỹ thuật chỉ là một phần: lý do sư phạm, thiết kế nhận thức và bằng chứng thử nghiệm cộng lại nặng hơn nhiều", "isCorrect": True},
                    {"label": "Kỹ thuật là phần quan trọng nhất vì chiếm điểm đơn lẻ cao nhất", "isCorrect": False},
                    {"label": "Có thể bỏ qua phần thử nghiệm nếu kỹ thuật hoàn hảo", "isCorrect": False},
                    {"label": "Bảng điểm khuyến khích chọn công nghệ càng phức tạp càng tốt", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                ],
            },
            {
                "key": "1.6-bien-ban-thu-nghiem",
                "type": "true_false",
                "prompt": "Biên bản thử nghiệm ghi rằng cả ba người học đều thấy sản phẩm hay và không gặp khó khăn gì là một biên bản tốt.",
                "explanation": "Thử nghiệm không tìm ra vấn đề nào tức là chưa thử nghiệm đúng cách. Giá trị của biên bản nằm ở chỗ hỏng tìm được và bản sửa tương ứng.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "1.6-giay-phep",
                "type": "mcq",
                "prompt": "Bạn tải một mô hình ba chiều từ một trang chia sẻ và đưa vào sách AR. Việc bắt buộc phải làm là gì?",
                "explanation": "Kiểm giấy phép trước khi dùng và ghi nguồn ngay trong sách, tại chỗ mô hình xuất hiện. Tài nguyên không rõ giấy phép bị coi là lỗi liêm chính, không phải lỗi hình thức.",
                "points": 2,
                "options": [
                    {"label": "Kiểm giấy phép trước khi tải và ghi nguồn ngay tại chỗ mô hình xuất hiện trong sách", "isCorrect": True},
                    {"label": "Chỉ cần ghi một dòng cảm ơn ở cuối sách", "isCorrect": False},
                    {"label": "Không cần gì nếu sách chỉ dùng trong lớp", "isCorrect": False},
                    {"label": "Đổi tên tệp mô hình để tránh trùng với bản gốc", "isCorrect": False},
                ],
            },
            {
                "key": "1.6-thu-tu-moc",
                "type": "ordering",
                "prompt": "Sắp xếp sáu mốc của đồ án theo đúng trình tự thực hiện.",
                "explanation": "Đồ án chạy song song với năm module, mỗi mốc nộp một mảnh và được góp ý ngay — không dồn vào một bản nộp cuối kỳ.",
                "points": 3,
                "sequence": [
                    "Chọn nội dung, hồ sơ thẩm định sơ bộ và thử nghiệm kỹ thuật nhỏ nhất",
                    "Bản thảo nội dung bốn trang, ghi rõ phần nào có AI hỗ trợ và cách kiểm chứng",
                    "Phần luyện tập kèm sách, có phân hoá mức độ và cơ chế ôn lại",
                    "Kế hoạch đo lường và phần dữ liệu người học kèm căn cứ pháp lý",
                    "Bản dựng AR hoàn chỉnh, thử với ba người học thật và danh sách sửa",
                    "Bảo vệ mười phút với demo trực tiếp",
                ],
            },
            {
                "key": "1.6-phuong-an-thieu-thiet-bi",
                "type": "mcq",
                "prompt": "Hồ sơ thẩm định của đồ án bắt buộc có phương án cho người học không có thiết bị phù hợp. Phương án nào hợp lý nhất?",
                "explanation": "Sách phải dạy được cả khi không quét: trang giấy tự nó đủ nghĩa, phần AR là lớp bổ sung. Kèm cách dùng chung thiết bị theo nhóm nhỏ hoặc một máy của lớp.",
                "points": 2,
                "options": [
                    {"label": "Thiết kế trang giấy tự nó đã đủ nghĩa, AR là lớp bổ sung; kèm phương án dùng chung thiết bị theo nhóm", "isCorrect": True},
                    {"label": "Yêu cầu phụ huynh trang bị điện thoại đủ cấu hình", "isCorrect": False, "misconception": "cngdtt.digital-divide-access-only"},
                    {"label": "Cho những học sinh đó làm bài tập khác trong lúc cả lớp dùng AR", "isCorrect": False},
                    {"label": "Không cần phương án, vì hầu hết học sinh đều có điện thoại", "isCorrect": False, "misconception": "cngdtt.digital-divide-access-only"},
                ],
            },
            {
                "key": "1.6-doc-d-068",
                "type": "mcq",
                "prompt": "Phân tích tổng hợp của Garzón và Acevedo (2019) báo cáo hiệu quả trung bình khoảng d = 0,68 cho AR trong giáo dục. Cách đọc con số này đúng nhất khi bảo vệ đồ án là gì?",
                "explanation": "Con số lớn bất thường so với thang dành cho can thiệp giáo dục, và phần lớn nghiên cứu gốc là thử nghiệm ngắn, đo bằng bài tự soạn, nhóm đối chứng không có hoạt động tương đương. Phải dẫn kèm cảnh báo và nói rõ mình tránh các lỗi ấy thế nào.",
                "points": 2,
                "options": [
                    {"label": "Dẫn kèm bốn cảnh báo về thử nghiệm ngắn, bài tự soạn, nhóm đối chứng và cỡ mẫu, rồi nói rõ mình thiết kế thử nghiệm thế nào để tránh", "isCorrect": True},
                    {"label": "Dẫn như bằng chứng rằng sách AR của mình sẽ hiệu quả", "isCorrect": False, "misconception": "cngdtt.effect-size-blind"},
                    {"label": "Bỏ qua vì mọi phân tích tổng hợp đều không đáng tin", "isCorrect": False},
                    {"label": "Dẫn kèm số lượng nghiên cứu để chứng minh AR đã được kiểm chứng đầy đủ", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                ],
            },
            {
                "key": "1.6-bien-dieu-tiet",
                "type": "mcq",
                "prompt": "Các phân tích tổng hợp cho thấy hiệu quả của AR thay đổi mạnh theo cách tiếp cận sư phạm đi kèm hơn là theo mức độ tinh vi của công nghệ. Kết luận này trùng khớp với luận điểm nào đã học?",
                "explanation": "Trùng với luận điểm Clark ở Bài 1.1: phương pháp dạy học là thứ tạo ra khác biệt, công nghệ chỉ mở đường cho phương pháp. Hệ quả: chọn tiếp cận sư phạm trước, chọn mức độ tinh vi kỹ thuật sau.",
                "points": 2,
                "options": [
                    {"label": "Luận điểm của Clark: phương pháp dạy học tạo ra khác biệt, phương tiện chỉ mở đường cho phương pháp", "isCorrect": True},
                    {"label": "Luận điểm rằng công nghệ mới hơn luôn hiệu quả hơn", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                    {"label": "Giả thuyết phong cách học tập", "isCorrect": False, "misconception": "cngdtt.learning-styles"},
                    {"label": "Nguyên tắc càng nhiều phương tiện càng dễ học", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                ],
            },
            {
                "key": "1.6-chia-chu-y",
                "type": "mcq",
                "prompt": "Trang sách in phần chú giải ở lề, còn mô hình ba chiều hiện trên màn hình điện thoại. Vấn đề thiết kế nhận thức ở đây là gì và gỡ thế nào?",
                "explanation": "Chia chú ý giữa hai mặt phẳng buộc người học giữ tạm thông tin trong trí nhớ làm việc — đúng định nghĩa tải thừa. Cách gỡ là đưa chú giải vào lớp phủ, đặt sát chi tiết mà nó mô tả.",
                "points": 2,
                "options": [
                    {"label": "Chia chú ý giữa giấy và màn hình; gỡ bằng cách đưa chú giải vào lớp phủ, sát chi tiết tương ứng", "isCorrect": True},
                    {"label": "Không có vấn đề gì: người học quen chuyển qua lại giữa hai màn hình", "isCorrect": False},
                    {"label": "Vấn đề là chú giải quá ngắn, cần viết dài hơn", "isCorrect": False},
                    {"label": "Cần thêm hiệu ứng động để hướng sự chú ý", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                ],
            },
            {
                "key": "1.6-thiet-ke-marker",
                "type": "mcq",
                "prompt": "Trang sách của bạn nền trắng, chỉ có một dòng tiêu đề và hoa văn viền lặp đều bốn góc. Phần mềm nhận diện thường xuyên không bắt được trang. Nguyên nhân kỹ thuật là gì?",
                "explanation": "Nhận diện dựa trên đặc trưng tự nhiên của ảnh: cần chi tiết phong phú, tương phản cao và không lặp. Nền trắng trơn nghèo đặc trưng, còn hoa văn lặp đều gây nhầm lẫn giữa các vùng giống nhau.",
                "points": 2,
                "options": [
                    {"label": "Ảnh nghèo đặc trưng và có hoạ tiết lặp đối xứng nên thuật toán không neo được vùng nhận diện", "isCorrect": True},
                    {"label": "Điện thoại của người học có camera độ phân giải thấp", "isCorrect": False},
                    {"label": "Tệp mô hình ba chiều quá nặng", "isCorrect": False},
                    {"label": "Cần in trang ở khổ lớn hơn", "isCorrect": False},
                ],
            },
        ],
    },
}

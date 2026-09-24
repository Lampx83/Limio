# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.7 · Blockchain trong giáo dục: từ cuốn sổ chung đến chứng chỉ số",
    "durationMin": 120,
    "description": "Buổi học tương tác 120 phút dành cho người mới bắt đầu: hiểu blockchain qua hình ảnh cuốn sổ chung, tự tay phá thử một chuỗi khối, tìm hiểu cách dùng blockchain để xác minh chứng chỉ, và học cách tự hỏi \"bài toán này có thật sự cần blockchain không\".",
    "objectives": [
        "Giải thích được bằng lời đơn giản blockchain là gì, và vì sao một cuốn sổ do nhiều người cùng giữ thì khó bị sửa lén",
        "Mô tả được cách dùng blockchain để xác minh chứng chỉ, và biết rõ cái gì được ghi lên blockchain, cái gì phải để bên ngoài",
        "Dùng được bộ năm câu hỏi để kết luận một bài toán giáo dục có nên dùng blockchain hay nên chọn cách đơn giản hơn",
    ],
    "summary": [
        "Blockchain giống một cuốn sổ chỉ được ghi thêm, nhiều người cùng giữ bản sao, và mỗi trang có ghi dấu vân tay (mã băm) của trang trước. Vì vậy, sửa một trang cũ là làm lệch mọi trang phía sau.",
        "Blockchain chỉ bảo đảm dữ liệu không bị sửa lén sau khi đã ghi, chứ không bảo đảm dữ liệu đó đúng. Ghi sai từ đầu thì sai mãi.",
        "Cách dùng có cơ sở nhất trong giáo dục là ghi dấu vân tay của chứng chỉ lên blockchain để ai cũng tự kiểm tra được. Dữ liệu cá nhân của người học luôn phải để bên ngoài blockchain.",
        "Hiện chưa có bằng chứng blockchain giúp học tốt hơn. Vì vậy, câu hỏi đầu tiên luôn là bài toán này có thật sự cần blockchain không, chứ không phải dùng blockchain như thế nào.",
    ],
    "body": r"""
> [!meo] **Trước khi vào bài:** hãy mở học liệu **Mô phỏng chuỗi khối** ở đầu bài trong một tab riêng. Đó là một trang web nhỏ, cho phép bạn tự tay thử mọi điều được nói tới trong bài, và bạn không cần biết lập trình để dùng nó. Bạn sẽ dùng nó trong hoạt động cá nhân ở mục 1.

## Blockchain là gì? Bắt đầu từ một cuốn sổ chung

### Khởi động: làm sao biết một tấm bằng là thật?

Hãy tưởng tượng bạn là nhà tuyển dụng. Một ứng viên gửi cho bạn tệp PDF bằng tốt nghiệp đại học qua email. Làm sao bạn biết tệp đó là thật, chứ không phải do ai đó tự chỉnh sửa bằng phần mềm?

Cách phổ biến nhất là gửi thư hoặc gọi điện hỏi lại trường. Cách này hoạt động, nhưng có ba điều bất tiện. Thứ nhất, nó chậm, vì có khi phải chờ vài ngày mới có trả lời. Thứ hai, nó phụ thuộc vào việc trường vẫn còn hoạt động và còn lưu hồ sơ. Thứ ba, bạn thực ra không kiểm tra được chính tờ giấy đang cầm trên tay, mà chỉ tin vào người trả lời điện thoại.

Blockchain, hay **chuỗi khối** trong tiếng Việt, được nhiều người đề xuất như một cách để giải quyết vấn đề này. Trong bài, chúng ta sẽ tìm hiểu nó làm được gì, và quan trọng không kém, nó không làm được gì.

### Một ví dụ dễ hiểu: cuốn sổ ghi điểm của lớp

Để hiểu blockchain, bạn không cần bắt đầu bằng máy tính. Hãy bắt đầu bằng một câu chuyện về cuốn sổ.

Lớp bạn có 30 người. Lớp trưởng giữ một cuốn sổ ghi ai đã nộp quỹ lớp, mỗi lần nộp ghi một dòng. Nếu chỉ có một cuốn sổ do một người giữ, sẽ có hai rủi ro. Lớp trưởng có thể ghi nhầm hoặc cố tình sửa một dòng, và không ai chứng minh được. Cuốn sổ cũng có thể bị mất hoặc rách, và mọi thông tin biến mất theo.

Bây giờ hãy đổi cách làm. Cả lớp cùng giữ **một bản sao** của cuốn sổ. Mỗi lần có người nộp quỹ, lớp trưởng đọc to, và ai cũng tự ghi vào sổ của mình. Nếu sau này có người muốn sửa một dòng cũ, họ phải sửa được sổ của **rất nhiều** bạn cùng lúc, và điều đó gần như không thể. Đây chính là ý tưởng cốt lõi của blockchain: **một cuốn sổ mà nhiều người cùng giữ bản sao, nên rất khó bị sửa lén**.

### Bốn ý cần nhớ

Từ ví dụ cuốn sổ, ta rút ra bốn ý. Mỗi ý có tên kỹ thuật riêng, nhưng bạn chỉ cần hiểu qua hình ảnh đời thường đi kèm.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Bốn ý cần nhớ, mỗi ý một hình ảnh đời thường</div>
  <div style="min-width:36rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
    <div style="border-left:5px solid rgba(37,99,235,.85);background:rgba(37,99,235,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>1 · Mã băm = dấu vân tay của dữ liệu</strong><br>Mỗi đoạn văn bản có một dãy ký tự riêng, giống như mỗi người có một dấu vân tay riêng. Chỉ cần đổi <em>một chữ</em> trong văn bản là dấu vân tay đổi hẳn.</div>
    <div style="border-left:5px solid rgba(13,148,136,.88);background:rgba(13,148,136,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>2 · Khối nối chuỗi = các trang sổ dính vào nhau</strong><br>Mỗi trang sổ (một khối) có ghi thêm dấu vân tay của trang liền trước. Sửa một trang cũ thì dấu vân tay của nó đổi, và mọi trang phía sau lập tức bị lệch.</div>
    <div style="border-left:5px solid rgba(124,58,237,.85);background:rgba(124,58,237,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>3 · Sổ phân tán = cả lớp cùng giữ một bản</strong><br>Nhiều máy tính cùng lưu một bản sao của cuốn sổ. Muốn gian lận, kẻ gian phải sửa được phần lớn các bản sao, chứ không phải chỉ một.</div>
    <div style="border-left:5px solid rgba(217,150,40,.9);background:rgba(217,150,40,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>4 · Đồng thuận = cả lớp giơ tay biểu quyết</strong><br>Khi có bản sao nào khác nhau, các bên dùng một luật chung (thường là đa số) để quyết định bản nào là bản đúng.</div>
  </div>
</div>
```

Hãy dừng lại ở ý thứ nhất, vì nó là ý quan trọng nhất. **Mã băm** là kết quả của một phép tính, biến một đoạn dữ liệu bất kỳ thành một dãy ký tự có độ dài cố định. Với thuật toán tên là SHA-256, dãy này luôn dài 64 ký tự, dù dữ liệu đầu vào là một chữ hay cả một cuốn sách. Có ba tính chất bạn cần nhớ. Cùng một dữ liệu luôn cho cùng một mã băm. Chỉ cần đổi một ký tự, mã băm thay đổi hoàn toàn, không còn giống bản cũ chút nào. Và từ mã băm, bạn không thể đoán ngược ra dữ liệu ban đầu. Vì vậy, mã băm rất giống một dấu vân tay: nó đủ để nhận ra dữ liệu, nhưng không tiết lộ dữ liệu.

Ý tưởng blockchain xuất hiện lần đầu năm 2008 trong bài viết của một tác giả lấy tên Satoshi Nakamoto, nhằm tạo ra tiền mã hoá Bitcoin. Giáo dục không cần tiền mã hoá. Điều giáo dục quan tâm chỉ là **cuốn sổ khó sửa lén** đó.

> [!ghi-nho] **Cách nhớ nhanh:** blockchain = cuốn sổ chỉ được ghi thêm, không được sửa, do nhiều người cùng giữ, và mỗi trang có ghi dấu vân tay của trang trước.

> [!canh-bao] **Hiểu nhầm phổ biến:** nhiều người nghĩ rằng dữ liệu đã ghi lên blockchain thì chắc chắn đúng. Thực tế không phải vậy. Blockchain chỉ bảo đảm một điều: **từ lúc ghi vào, dữ liệu không bị đổi mà không ai biết**. Nếu ngay từ đầu bạn ghi sai, chuỗi sẽ giữ nguyên lỗi sai đó mãi mãi. Chúng ta sẽ quay lại điểm này ở mục 3.

### Hoạt động cá nhân · Tự tay phá thử một chuỗi (14 phút)

Mở học liệu **Mô phỏng chuỗi khối**, thẻ **Chuỗi khối**. Bạn sẽ thấy 4 khối nối nhau. Mỗi khối có phần dữ liệu và một mã băm. Một khối được coi là hợp lệ khi mã băm của nó bắt đầu bằng bốn số 0. Hãy làm lần lượt:

1. Bấm nút **Đào tất cả**. Máy sẽ tự thử rất nhiều con số cho đến khi mã băm của mỗi khối bắt đầu bằng bốn số 0. Hãy ghi lại số lần thử của từng khối. Việc này cho bạn thấy tạo ra một khối hợp lệ tốn công sức thật sự.
2. Sửa dữ liệu của **Khối 2**, chỉ cần đổi một chữ số. Hãy quan sát xem những khối nào chuyển sang màu đỏ. Chỉ Khối 2, hay cả các khối sau? Bạn thử giải thích vì sao.
3. Bấm nút **Đào** ở Khối 2, rồi Khối 3, rồi Khối 4 để "sửa lại lịch sử". Bạn thấy kẻ gian phải làm thêm bao nhiêu việc chỉ để sửa một chữ số ở khối thứ hai? Hãy thử tưởng tượng chuỗi này có bốn triệu khối, và cả mạng vẫn liên tục thêm khối mới trong lúc bạn đang sửa.
4. Viết vào một tờ giấy **một câu** không quá 25 chữ để giải thích cho người chưa học công nghệ rằng "vì sao blockchain khó bị sửa lén". Đổi tờ giấy với bạn ngồi cạnh và kiểm tra giúp nhau xem câu đó đã nhắc đến việc mỗi khối mang dấu vân tay của khối trước chưa.

## Blockchain dùng vào giáo dục như thế nào?

### Ví dụ dễ hiểu nhất: chứng chỉ có "dấu vân tay"

Quay lại bài toán tấm bằng ở đầu bài. Cách dùng blockchain phổ biến nhất trong giáo dục có tên là **neo mã băm**, và nó hoạt động giống như câu chuyện sau.

Trường của bạn vừa cấp một chứng chỉ. Nhà trường lấy tệp chứng chỉ, tính ra dấu vân tay (mã băm) của nó, rồi ghi **chỉ dấu vân tay đó** lên một bảng thông báo công cộng mà không ai tẩy xoá được. Đó chính là blockchain. Tệp chứng chỉ thì được đưa cho sinh viên giữ. Khi đi xin việc, sinh viên gửi tệp cho nhà tuyển dụng. Nhà tuyển dụng tự tính dấu vân tay của tệp mình nhận được, rồi so với bảng thông báo công cộng. Nếu hai dấu vân tay giống nhau, tệp này chắc chắn chưa bị sửa. Nếu khác nhau, có ai đó đã chỉnh tệp, dù chỉ một dấu phẩy.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cấp và xác minh một chứng chỉ, bốn bước</div>
  <div style="min-width:40rem;display:flex;align-items:stretch;gap:.4rem;font-size:.98rem;line-height:1.45">
    <div style="flex:1;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>① Trường cấp</strong><br>Tạo chứng chỉ, rồi tính dấu vân tay (mã băm) của nó</div>
    <div style="align-self:center;opacity:.6">→</div>
    <div style="flex:1;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>② Ghi lên blockchain</strong><br>Chỉ ghi <em>dấu vân tay</em>, không ghi nội dung chứng chỉ</div>
    <div style="align-self:center;opacity:.6">→</div>
    <div style="flex:1;background:rgba(13,148,136,.88);color:#fff;border-radius:.4rem;padding:.6rem"><strong>③ Sinh viên giữ</strong><br>Tệp chứng chỉ do sinh viên cất giữ, <em>không nằm trên blockchain</em></div>
    <div style="align-self:center;opacity:.6">→</div>
    <div style="flex:1;background:rgba(217,150,40,.9);color:#fff;border-radius:.4rem;padding:.6rem"><strong>④ Nhà tuyển dụng</strong><br>Tự tính dấu vân tay của tệp nhận được rồi đối chiếu, không cần hỏi trường</div>
  </div>
</div>
```

Bạn sẽ tự thử đúng quy trình này ở thẻ **Xác minh chứng chỉ** của học liệu. Cách làm này có hai lợi ích thực tế. Một là người xác minh không phải chờ trường trả lời nữa, vì họ tự kiểm tra được ngay. Hai là sinh viên thật sự **sở hữu** hồ sơ của mình: nếu trường đổi tên hay đóng cửa, chứng chỉ vẫn xác minh được.

Còn một điểm rất quan trọng: trên blockchain **chỉ có dấu vân tay**, không có tên, ngày sinh hay điểm số của sinh viên. Vì sao lại như vậy, bạn sẽ thấy rõ ở mục 3.

### Năm nhóm ứng dụng, và nhóm nào đã thật sự dùng được

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Ứng dụng blockchain trong giáo dục, xếp theo mức độ đã được thử nghiệm</div>
  <table style="min-width:38rem;border-collapse:collapse;width:100%;font-size:1rem;line-height:1.5">
    <thead><tr style="text-align:left"><th style="padding:.5rem;border-bottom:2px solid rgba(127,127,127,.3)">Ứng dụng</th><th style="padding:.5rem;border-bottom:2px solid rgba(127,127,127,.3)">Ý tưởng bằng lời đơn giản</th><th style="padding:.5rem;border-bottom:2px solid rgba(127,127,127,.3)">Mức độ</th></tr></thead>
    <tbody>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Chứng chỉ, văn bằng</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Ghi dấu vân tay của chứng chỉ lên blockchain để ai cũng tự kiểm tra được</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(13,148,136,.88);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Đã dùng thật</span></td></tr>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Huy hiệu số</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Nhiều nơi cùng cấp huy hiệu nhỏ, sinh viên gom chung vào một "ví"</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(13,148,136,.88);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Đang thí điểm</span></td></tr>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Học bạ, chuyển đổi tín chỉ</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Hồ sơ học tập đi theo học sinh khi chuyển trường</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(217,150,40,.9);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Thí điểm nhỏ</span></td></tr>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Bản quyền học liệu</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Tự động chia tiền cho giáo viên mỗi khi bài giảng của họ được dùng</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(217,150,40,.9);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Chủ yếu là bản mẫu</span></td></tr>
      <tr><td style="padding:.5rem"><strong>Ghi nhận mọi việc học</strong></td><td style="padding:.5rem">Ghi lại tự động từng bài học, từng lần làm bài của học viên</td><td style="padding:.5rem"><span style="background:rgba(220,38,38,.85);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Mới là ý tưởng, nhiều rủi ro</span></td></tr>
    </tbody>
  </table>
</div>
```

Nhóm đã chín nhất là chứng chỉ, vì bài toán này thật sự cần một nơi công khai để đối chiếu mà không phụ thuộc vào một trường cụ thể. Hai ví dụ tiêu biểu:

- **MIT (Hoa Kỳ), năm 2017.** Trường phối hợp với một công ty phần mềm để thí điểm cấp văn bằng dạng số, dựa trên blockchain của Bitcoin, theo một chuẩn mở tên là Blockcerts. Nhóm đầu tiên gồm 111 cựu sinh viên được chọn nhận văn bằng trên điện thoại. Theo MIT, người hào hứng nhất là sinh viên quốc tế, vì họ cần một bằng chứng tốt nghiệp mà cơ quan nước mình chấp nhận được.
- **Liên minh châu Âu.** Uỷ ban châu Âu xây dựng một hạ tầng blockchain chung tên là EBSI, trong đó có một tình huống dành riêng cho văn bằng, để sinh viên chuyển giữa các nước châu Âu có thể chứng minh bằng cấp của mình nhanh hơn.

### Bằng chứng: ta thật sự biết được gì?

Khi nghe một công nghệ mới được quảng cáo, hãy tách câu hỏi "nó có hiệu quả không?" thành ba câu nhỏ hơn. Câu thứ nhất là *có làm được về mặt kỹ thuật không?* Câu trả lời là có, MIT và châu Âu đã chứng minh. Câu thứ hai là *có rẻ hơn hoặc tiện hơn cách cũ không?* Câu này chưa rõ, vì có rất ít báo cáo so sánh chi phí một cách trung thực. Câu thứ ba là *có giúp người học học tốt hơn không?* Với câu này, gần như chưa có nghiên cứu nào đo. Các bài tổng quan nghiên cứu, ví dụ của Alammary và cộng sự năm 2019, cho thấy phần lớn công trình mới dừng ở việc đề xuất thiết kế hoặc làm bản mẫu. Nói cách khác, blockchain trong giáo dục hiện chủ yếu giúp **làm hồ sơ và xác minh tiện hơn**, chứ chưa được chứng minh là giúp **học tốt hơn**.

## Khi nào KHÔNG nên dùng blockchain?

### Ba giới hạn, mỗi giới hạn một ví dụ

**Giới hạn thứ nhất: chống sửa không có nghĩa là đúng.** Giả sử cô giáo vụ nhập nhầm điểm của một sinh viên từ 7 thành 9, rồi ghi lên blockchain. Chuỗi sẽ giữ nguyên con số 9 đó mãi mãi và không ai tự động phát hiện ra lỗi. Vì vậy, với chứng chỉ, sự an toàn thật sự phải đến từ **quy trình cấp cẩn thận** và từ việc **biết chắc ai là bên cấp**, chứ không đến từ blockchain.

**Giới hạn thứ hai: đã ghi lên thì không xoá được.** Hãy tưởng tượng bạn viết tên mình lên bảng bằng loại mực không thể tẩy. Nếu sau này bạn muốn xoá, bạn không thể làm được. Điều này va chạm với quyền của người học: theo pháp luật về bảo vệ dữ liệu cá nhân, người học có quyền yêu cầu xoá hoặc sửa thông tin của mình. Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 còn có riêng Điều 30 về việc xử lý dữ liệu trong môi trường có blockchain. Vì vậy, quy tắc thiết kế an toàn là: **không bao giờ đưa dữ liệu cá nhân lên blockchain**. Chỉ đưa dấu vân tay (mã băm), và giữ toàn bộ nội dung ở nơi khác để có thể xoá khi cần.

**Giới hạn thứ ba: chi phí và rủi ro vận hành.** Ai chạy các máy giữ sổ? Ai trả chi phí? Và nếu sinh viên làm mất chìa khoá số của mình thì sao? Giống như làm mất chìa khoá két sắt, một chứng chỉ trên blockchain mà chủ nhân không truy cập lại được sẽ trở nên vô dụng. Cơ sở dữ liệu thông thường không có rủi ro này, vì quản trị viên có thể cấp lại mật khẩu.

Một lưu ý nhỏ để tránh nhầm lẫn: Luật Công nghiệp công nghệ số số 71/2025/QH15, có hiệu lực từ ngày 01/01/2026, lần đầu đưa "tài sản số" vào khung pháp lý riêng. Tuy nhiên, chứng chỉ giáo dục không phải là tài sản số theo nghĩa đó, nên bạn không nên gộp hai chuyện này làm một.

### Năm câu hỏi trước khi chọn blockchain

Nhiều dự án chọn blockchain chỉ vì nó đang được nhắc nhiều. Để tránh điều đó, hãy hỏi lần lượt năm câu dưới đây, phỏng theo sơ đồ quyết định của Wüst và Gervais (2018). Nếu câu trả lời cho câu nào cũng là "không cần", bạn nên dùng giải pháp đơn giản hơn.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:36rem;display:flex;flex-direction:column;gap:.35rem;font-size:1.02rem;line-height:1.5">
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">1</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Có cần một cuốn sổ chung để nhiều người cùng xem không?</strong> <span style="opacity:.75">Không cần ⇒ không dùng blockchain.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">2</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Có nhiều bên khác nhau cùng ghi vào sổ không?</strong> <span style="opacity:.75">Chỉ một bên ghi ⇒ dùng cơ sở dữ liệu thường là đủ.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(13,148,136,.88);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">3</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Các bên có thiếu tin nhau, và không có ai đủ đáng tin để làm trọng tài không?</strong> <span style="opacity:.75">Nếu có một cơ quan mọi bên đều tin (như Bộ Giáo dục) ⇒ để cơ quan đó giữ sổ.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(13,148,136,.88);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">4</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Có cần chặn cả việc chính người giữ sổ lén sửa lịch sử không?</strong> <span style="opacity:.75">Không cần ⇒ một bản nhật ký thông thường là đủ.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(217,150,40,.9);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">5</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Dữ liệu có nhạy cảm, hoặc có thể phải xoá đi không?</strong> <span style="opacity:.75">Có ⇒ chỉ ghi dấu vân tay, còn nội dung để ngoài blockchain.</span></div></div>
  </div>
</div>
```

**Ví dụ áp dụng:** một trường tự lưu bảng điểm của chính mình, chỉ giáo vụ nhà trường được nhập, và ai cũng tin nhà trường. Câu hỏi 2 cho thấy chỉ có một bên ghi, câu hỏi 3 cho thấy đã có bên đáng tin. Kết luận: dùng cơ sở dữ liệu thông thường, có thể thêm chữ ký số cho các tệp xuất ra. Dùng blockchain trong trường hợp này chỉ tốn kém mà không thêm được lợi ích nào.

> [!ghi-nho] Một bài toán chỉ thật sự "xứng" với blockchain khi bạn trả lời **có** cho cả bốn câu đầu, và có cách xử lý câu 5. Rất nhiều bài toán giáo dục dừng lại ở câu 2 hoặc câu 3. Điều đó không có nghĩa là bạn thẩm định sai, mà là bạn thẩm định đúng. Đây cũng là tinh thần của cả học phần: công cụ thay đổi rất nhanh, còn cách đặt câu hỏi thì dùng lại được cho mọi công nghệ về sau.

## Luyện tập và tài liệu tham khảo

### Tiến trình buổi học trên lớp (120 phút)

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:42rem;display:flex;height:3.4rem;border-radius:.45rem;overflow:hidden;color:#fff;font-size:.9rem;text-align:center;line-height:1.2">
    <div style="flex:8;background:rgba(217,150,40,.9);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Khởi động<br>cá nhân + cặp</div>
    <div style="flex:14;background:rgba(37,99,235,.85);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Giảng 1<br>cuốn sổ và bốn ý</div>
    <div style="flex:14;background:rgba(13,148,136,.88);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Cá nhân<br>phá thử chuỗi</div>
    <div style="flex:18;background:rgba(13,148,136,.7);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Nhóm A<br>sổ cái người thật</div>
    <div style="flex:14;background:rgba(37,99,235,.85);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Giảng 2<br>ứng dụng + bằng chứng</div>
    <div style="flex:5;background:rgba(120,113,108,.85);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Nghỉ</div>
    <div style="flex:10;background:rgba(37,99,235,.7);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Giảng 3<br>giới hạn</div>
    <div style="flex:27;background:rgba(13,148,136,.88);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Nhóm B<br>hội đồng thẩm định</div>
    <div style="flex:10;background:rgba(124,58,237,.85);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Tổng kết<br>phiếu ra cửa</div>
  </div>
  <div style="min-width:42rem;display:flex;font-size:.88rem;opacity:.75;margin:.3rem 0 0">
    <div style="flex:8">0′</div><div style="flex:14">8′</div><div style="flex:14">22′</div><div style="flex:18">36′</div><div style="flex:14">54′</div><div style="flex:5">68′</div><div style="flex:10">73′</div><div style="flex:27">83′</div><div style="flex:10">110′–120′</div>
  </div>
  <div style="min-width:42rem;display:flex;gap:1rem;flex-wrap:wrap;font-size:.95rem;margin:.55rem 0 0">
    <span><span style="display:inline-block;width:.8rem;height:.8rem;background:rgba(37,99,235,.85);border-radius:.15rem;vertical-align:middle"></span> Giảng và trao đổi · 38′</span>
    <span><span style="display:inline-block;width:.8rem;height:.8rem;background:rgba(13,148,136,.88);border-radius:.15rem;vertical-align:middle"></span> Cá nhân và nhóm · 59′</span>
    <span><span style="display:inline-block;width:.8rem;height:.8rem;background:rgba(217,150,40,.9);border-radius:.15rem;vertical-align:middle"></span> Khởi động, tổng kết, nghỉ · 23′</span>
  </div>
</div>
```

Gần hai phần ba thời lượng buổi học là hoạt động của chính sinh viên. Mỗi hoạt động đều đặt ngay sau phần giảng cần dùng đến nó: học xong cuốn sổ và bốn ý thì tự phá thử một chuỗi, học xong ý tưởng nhiều người giữ sổ thì tự đóng vai người giữ sổ, và học xong giới hạn thì làm hội đồng quyết định có nên dùng blockchain hay không.

### Cá nhân + cặp · Khởi động (8 phút)

Có ba tình huống: (A) tệp PDF bằng tốt nghiệp gửi qua email, (B) trang web tra cứu văn bằng của chính trường đó, (C) bản sao công chứng. **Trong 3 phút làm việc một mình,** với mỗi tình huống hãy viết ra hai điều: bạn sẽ kiểm chứng bằng cách nào, và kẻ gian có thể làm giả ở chỗ nào. **Trong 3 phút làm việc theo cặp,** hai bạn đối chiếu câu trả lời và tìm xem cả ba cách có chung một điểm yếu nào không. **Trong 2 phút cuối,** cả lớp giơ tay chọn cách mình tin nhất. Hãy ghi lại lựa chọn của bạn, vì cuối buổi chúng ta sẽ quay lại.

### Nhóm 5 người · Sổ cái người thật (18 phút)

**Chuẩn bị:** mỗi nhóm có 5 người, mỗi người một tờ giấy chia ba cột: *Số thứ tự*, *Nội dung*, *Dấu nối*. Giảng viên nhắn riêng cho **một người** để người đó đóng vai "kẻ gian". Những người còn lại không biết đó là ai.

**Vòng 1 (8 phút), ghi sổ.** Giảng viên lần lượt đọc 6 giao dịch, ví dụ: "Trường A cấp chứng chỉ số 1 cho Lan", "Trường A cấp chứng chỉ số 2 cho Minh", và tương tự. Mỗi người tự chép vào tờ giấy của mình. Với **cột Dấu nối**, ở dòng thứ n, bạn chép lại *hai chữ cuối của dòng n−1* vào đầu dòng đó. Đây là cách làm thô sơ để mô phỏng việc "mỗi khối mang dấu vân tay của khối trước".

**Vòng 2 (6 phút), có kẻ gian.** Người đóng vai kẻ gian lén sửa dòng số 2 trên tờ của mình, chẳng hạn đổi tên người nhận, rồi tuyên bố "tờ của tôi mới là bản đúng". Bốn người còn lại chưa được xem tờ của nhau. Họ phải kiểm tra dây nối trên tờ của kẻ gian, sau đó biểu quyết xem tờ nào là bản chuẩn. Hãy ghi lại: cả nhóm phát hiện ra bằng cách nào, và mất bao lâu.

**Vòng 3 (4 phút), tăng độ khó.** Giảng viên đổi luật: bây giờ có **3 trong 5 người** cùng thông đồng gian lận. Điều gì xảy ra với kết quả biểu quyết? Cả nhóm cùng ghi vào một tờ giấy ba nhận xét: về *độ an toàn*, về *chi phí* (5 người cùng chép cùng một dòng, tốn công hơn nhiều so với 1 người), và về *ai thật sự cần một cuốn sổ như vậy*.

**Câu hỏi tổng kết:** so với việc chỉ một cô giáo vụ giữ một cuốn sổ duy nhất, việc giữ 5 cuốn sổ tốn thêm điều gì, và mua thêm được điều gì? Đó chính là phép cân nhắc "chi phí và lợi ích" mà bất kỳ ai chọn blockchain đều phải làm.

### Nhóm 5 người · Hội đồng thẩm định "có cần blockchain không?" (27 phút)

**Tình huống:** mỗi nhóm là một hội đồng thẩm định của sở giáo dục. Một nhà cung cấp đến đề xuất dùng blockchain cho một việc cụ thể, và nhóm phải quyết định có nên đồng ý hay không. **Bốc thăm** một trong sáu đề xuất sau: (1) văn bằng số của một trường đại học; (2) huy hiệu số do nhiều trung tâm đào tạo cùng cấp; (3) học bạ chuyển giữa các trường phổ thông trong tỉnh; (4) chia tiền bản quyền học liệu cho giáo viên tạo nội dung; (5) lưu vết đề thi, bài làm và điểm của một kỳ thi tuyển sinh; (6) quỹ học bổng minh bạch giữa nhà tài trợ, nhà trường và sinh viên.

**Nhiệm vụ trong 27 phút:**

- **10 phút, thẩm định.** Trả lời năm câu hỏi ở mục 3 cho đề xuất của nhóm. Mỗi câu ghi *có*, *không* hoặc *chưa rõ*, kèm một lý do. Trước hết hãy xác định: ai ghi vào sổ, ai đọc sổ, và có cơ quan nào mọi bên cùng tin hay không.
- **6 phút, phương án thay thế.** Nêu ít nhất một cách làm **không** dùng blockchain, như cơ sở dữ liệu thông thường, chữ ký số, hoặc một hệ thống do Bộ vận hành. So sánh hai cách theo ba tiêu chí: chi phí, độ tin cậy với người bên ngoài, và bảo vệ dữ liệu cá nhân.
- **3 phút, quyết định.** Chọn một trong ba kết luận: **Dùng blockchain**, **Không dùng**, hoặc **Dùng có điều kiện**. Kèm theo đó là một chỉ số đo được sau 12 tháng để kiểm tra quyết định có đúng không. Chỉ số này phải nói về việc xác minh hoặc học tập, không phải về việc "có bao nhiêu người dùng".
- **8 phút, điều trần.** Bốn nhóm được gọi lên trình bày, mỗi nhóm 90 giây. Cả lớp đóng vai nhà cung cấp và hỏi mỗi nhóm 30 giây, tập trung vào câu 3 (ai là người đáng tin) và câu 5 (dữ liệu cá nhân).

**Chấm theo (10 điểm):** trả lời đúng và có lý do cho cả năm câu hỏi (3đ) · nêu được phương án thay thế cụ thể và so sánh theo ba tiêu chí (2đ) · nhận ra rủi ro về dữ liệu cá nhân và nêu đúng nguyên tắc "chỉ ghi dấu vân tay" (2đ) · quyết định gắn với chỉ số đo được sau 12 tháng (2đ) · trả lời chất vấn có lập luận (1đ).

### Cá nhân · Phiếu ra cửa (10 phút)

Hãy đọc lại lựa chọn bạn đã ghi ở phần khởi động và viết trong 5 phút hai điều. Thứ nhất, trong ba tình huống A, B, C, tình huống nào blockchain thật sự cải thiện được, và cải thiện ở chỗ nào. Thứ hai, một điều bạn tin trước buổi học mà bây giờ bạn đã thay đổi. Trong phần thời gian còn lại, giảng viên gọi ngẫu nhiên ba phiếu để đọc to, rồi nhắc bài tập về nhà.

### Bài tập về nhà · sản phẩm số (120 phút)

Bạn sẽ làm một **Cổng xác minh chứng chỉ** đơn giản cho một trường giả định, kèm một **phiếu thẩm định dài một trang**. Bài có hai tuyến để chọn, bạn chỉ cần làm một tuyến.

- **Tuyến A (dành cho người mới, không cần lập trình):** dùng một trang web tính SHA-256 trực tuyến và một bảng tính Excel hoặc Google Sheets.
- **Tuyến B (nâng cao, có cộng điểm):** tự viết một trang HTML một tệp, dùng JavaScript để tính mã băm ngay trong trình duyệt.

**Các bước chung cho cả hai tuyến:**

1. Soạn **5 chứng chỉ giả lập** dưới dạng văn bản thuần. Chỉ dùng tên hư cấu, tuyệt đối không dùng thông tin của người thật.
2. Tính mã băm SHA-256 của từng chứng chỉ, rồi ghi vào một **bảng neo** có hai cột: *mã chứng chỉ* và *mã băm*. Đây là "bảng thông báo công cộng" của trường bạn.
3. Xây dựng cách kiểm tra: dán nội dung một chứng chỉ vào, tính lại mã băm, rồi đối chiếu với bảng neo và kết luận **KHỚP** hoặc **KHÔNG KHỚP**.
4. Làm **ba phép thử phá**: đổi một ký tự trong chứng chỉ; thêm một khoảng trắng ở cuối dòng; dùng một chứng chỉ chưa từng ghi vào bảng neo. Chụp màn hình cả ba kết quả và giải thích bằng một câu vì sao mỗi trường hợp ra kết quả như vậy.
5. Viết **phiếu thẩm định một trang** cho đề xuất bạn đã bốc thăm trên lớp, hoặc cho một ý tưởng dùng blockchain trong đồ án sách AR của bạn. Phiếu gồm ba phần: trả lời năm câu hỏi, kết luận, và chỉ số đo được sau 12 tháng.

**Cách làm (gợi ý từng bước):**

- **Tuyến A:** tìm trên mạng một công cụ "SHA-256 online" (hoặc dùng trang **Xác minh chứng chỉ** trong học liệu của bài). Dán từng chứng chỉ vào, sao chép mã băm sang bảng tính. Khi kiểm tra, dùng hàm so sánh của bảng tính để xem mã băm mới có nằm trong cột bảng neo hay không.
- **Tuyến B:** dùng hàm `crypto.subtle.digest("SHA-256", …)` của trình duyệt. Hàm này chỉ chạy khi trang được mở qua `https` hoặc `localhost`, nên hãy thử bằng lệnh `python3 -m http.server`. Kết quả trả về là dãy số, bạn cần đổi từng số sang hệ thập lục phân bằng `toString(16).padStart(2, "0")`. Mã trang không nên dài quá 80 dòng.
- Phép thử "thêm khoảng trắng" sẽ cho bạn thấy một chi tiết quan trọng: hệ thống phải **quy định rõ cách chuẩn hoá văn bản trước khi băm** (ví dụ luôn bỏ khoảng trắng đầu và cuối). Hãy ghi lại quy định bạn chọn và lý do.
- Nhớ giữ nguyên nguyên tắc của bài: trong bảng neo chỉ có mã băm, tuyệt đối không có tên hay điểm số.

**Chấm theo (10 điểm):** bảng neo đúng, mã băm có thể kiểm lại được (2đ) · cách kiểm tra chạy đúng ở cả ba phép thử phá (3đ) · giải thích đúng lý do khớp hoặc không khớp, có nêu quy định chuẩn hoá văn bản (2đ) · phiếu thẩm định trả lời đủ năm câu hỏi, có phương án thay thế và chỉ số 12 tháng (3đ). Làm tuyến B được cộng tối đa 1 điểm khuyến khích.

### Nguồn tham khảo

- Nakamoto, S. (2008). *Bitcoin: A Peer-to-Peer Electronic Cash System.* — [bitcoin.org](https://bitcoin.org/bitcoin.pdf)
- MIT News (2017). *MIT debuts secure digital diploma using Bitcoin blockchain technology.* — [news.mit.edu](https://news.mit.edu/2017/mit-debuts-secure-digital-diploma-using-bitcoin-blockchain-technology-1017)
- Uỷ ban châu Âu. *European Blockchain Services Infrastructure (EBSI) — Diploma use case.* — [ec.europa.eu](https://ec.europa.eu/digital-building-blocks/sites/spaces/EBSI/overview)
- Wüst, K. & Gervais, A. (2018). *Do you need a blockchain?* Proceedings of the Crypto Valley Conference on Blockchain Technology. — [eprint.iacr.org](https://eprint.iacr.org/2017/375.pdf)
- Grech, A. & Camilleri, A. F. (2017). *Blockchain in Education.* JRC Science for Policy Report, Uỷ ban châu Âu.
- Sharples, M. & Domingue, J. (2016). The Blockchain and Kudos: A Distributed System for Educational Record, Reputation and Reward. *EC-TEL 2016.*
- Alammary, A., Alhazmi, S., Almasri, M. & Gillani, S. (2019). Blockchain-Based Applications in Education: A Systematic Review. *Applied Sciences, 9*(12), 2400.
- Quốc hội (2025). *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15* (Điều 30). Quốc hội (2025). *Luật Công nghiệp công nghệ số số 71/2025/QH15.* — [vbpl.vn](https://vbpl.vn/TW/Pages/vbpq-van-ban-goc.aspx?ItemID=179989)
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.7",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "bc-sua-khoi",
                "type": "mcq",
                "prompt": "Trong một chuỗi 5 khối, bạn sửa một chữ số ở dữ liệu của Khối 2. Điều gì xảy ra?",
                "explanation": "Mã băm Khối 2 đổi; Khối 3 chứa mã băm cũ của Khối 2 nên tham chiếu sai; mã băm Khối 3 đổi theo... Lỗi lan dây chuyền tới hết chuỗi.",
                "points": 2,
                "options": [
                    {"label": "Mã băm Khối 2 đổi, và các khối phía sau không còn khớp với khối liền trước", "isCorrect": True},
                    {"label": "Chỉ Khối 2 bị đánh dấu sai, các khối còn lại vẫn hợp lệ", "isCorrect": False},
                    {"label": "Chuỗi tự động sửa lại cho khớp với dữ liệu mới", "isCorrect": False, "misconception": "cngdtt.blockchain-equals-truth"},
                    {"label": "Không có gì xảy ra vì mã băm không phụ thuộc vào dữ liệu", "isCorrect": False},
                ],
            },
            {
                "key": "bc-do-dai-bam",
                "type": "fill_in",
                "prompt": "Mã băm SHA-256 viết dạng thập lục phân dài bao nhiêu ký tự? (chỉ ghi số)",
                "explanation": "SHA-256 cho 256 bit, mỗi ký tự thập lục phân biểu diễn 4 bit: 256 ÷ 4 = 64 ký tự, bất kể đầu vào dài hay ngắn.",
                "points": 1,
                "answers": ["64"],
            },
            {
                "key": "bc-cai-gi-len-chuoi",
                "type": "mcq",
                "prompt": "Một trường triển khai cấp chứng chỉ số theo mô hình neo mã băm. Thiết kế nào đúng?",
                "explanation": "Chuỗi bất biến nên dữ liệu cá nhân đưa lên là không xoá được, trái quyền của người học. Đưa mã băm lên chuỗi, giữ tệp ở ngoài để xoá được.",
                "points": 2,
                "options": [
                    {"label": "Chỉ đưa mã băm lên chuỗi; tệp chứng chỉ do người học giữ ngoài chuỗi", "isCorrect": True},
                    {"label": "Đưa toàn bộ chứng chỉ gồm họ tên, ngày sinh, điểm lên chuỗi cho minh bạch", "isCorrect": False, "misconception": "cngdtt.personal-data-on-chain"},
                    {"label": "Đưa họ tên và điểm lên chuỗi công khai nhưng mã hoá bằng khoá của trường", "isCorrect": False, "misconception": "cngdtt.personal-data-on-chain"},
                    {"label": "Không đưa gì lên chuỗi, chỉ dùng chuỗi làm nơi lưu ảnh chụp bằng", "isCorrect": False},
                ],
            },
            {
                "key": "bc-nhap-sai",
                "type": "mcq",
                "prompt": "Giáo vụ nhập nhầm điểm của một sinh viên rồi ghi lên chuỗi khối. Kết luận đúng là gì?",
                "explanation": "Chuỗi khối chống sửa về sau, không kiểm chứng dữ liệu đúng hay sai lúc ghi. Lỗi nhập sẽ được giữ nguyên; cần quy trình cấp và cơ chế đính chính (ghi bản đính chính mới) chứ không thể xoá.",
                "points": 2,
                "options": [
                    {"label": "Lỗi được giữ nguyên; chuỗi đảm bảo không bị đổi chứ không đảm bảo đúng", "isCorrect": True},
                    {"label": "Các nút sẽ tự phát hiện điểm sai và từ chối khối đó", "isCorrect": False, "misconception": "cngdtt.blockchain-equals-truth"},
                    {"label": "Chuỗi đã ghi thì chắc chắn đúng vì nhiều bên đã đồng thuận", "isCorrect": False, "misconception": "cngdtt.blockchain-equals-truth"},
                    {"label": "Chỉ cần xoá khối chứa điểm sai là xong", "isCorrect": False},
                ],
            },
            {
                "key": "bc-thu-tu-xac-minh",
                "type": "ordering",
                "prompt": "Sắp xếp các bước của một lần xác minh chứng chỉ theo mô hình neo mã băm:",
                "explanation": "Người xác minh không hỏi trường: họ nhận tệp từ người học, tự băm, rồi đối chiếu với mã băm đã neo.",
                "points": 2,
                "sequence": [
                    "Người học gửi tệp chứng chỉ cho nhà tuyển dụng",
                    "Nhà tuyển dụng tính mã băm SHA-256 của tệp nhận được",
                    "Tra mã băm này trên chuỗi khối (hoặc sổ neo)",
                    "Kết luận: khớp thì tệp nguyên vẹn, không khớp thì tệp đã bị sửa hoặc chưa từng được cấp",
                ],
            },
            {
                "key": "bc-noi-khai-niem",
                "type": "matching",
                "prompt": "Nối khái niệm với ý nghĩa của nó:",
                "explanation": "Bốn khái niệm nền: băm cho dấu vân tay dữ liệu, khối nối chuỗi tạo dây chuyền, sổ cái phân tán nhân bản, đồng thuận thống nhất khối mới.",
                "points": 2,
                "pairs": [
                    {"left": "Hàm băm", "right": "Biến dữ liệu thành dãy cố định, đổi 1 ký tự là đổi hoàn toàn"},
                    {"left": "Khối nối chuỗi", "right": "Mỗi khối mang mã băm của khối liền trước"},
                    {"left": "Sổ cái phân tán", "right": "Nhiều nút cùng giữ một bản sao"},
                    {"left": "Đồng thuận", "right": "Quy tắc để các nút thống nhất khối nào được thêm"},
                ],
            },
            {
                "key": "bc-mot-ben-ghi",
                "type": "mcq",
                "prompt": "Một trường tự lưu bảng điểm của chính mình, chỉ giáo vụ nhà trường được ghi, mọi người tin trường. Theo bộ năm câu hỏi, nên chọn giải pháp nào?",
                "explanation": "Chỉ một bên ghi (câu 2) và không thiếu tin nhau (câu 3) — cơ sở dữ liệu thường, có thể thêm chữ ký số cho tệp xuất ra, là đủ và rẻ hơn.",
                "points": 2,
                "options": [
                    {"label": "Cơ sở dữ liệu thường, có thể kèm chữ ký số", "isCorrect": True},
                    {"label": "Chuỗi khối công khai vì có nhiều người dùng", "isCorrect": False, "misconception": "cngdtt.blockchain-default-solution"},
                    {"label": "Chuỗi khối có cấp phép vì hiện đại hơn", "isCorrect": False, "misconception": "cngdtt.blockchain-default-solution"},
                    {"label": "Không giải pháp nào lưu được bảng điểm an toàn", "isCorrect": False},
                ],
            },
            {
                "key": "bc-quyen-xoa",
                "type": "mcq",
                "prompt": "Người học yêu cầu xoá dữ liệu cá nhân của mình, trong khi hệ thống đã neo thông tin lên chuỗi khối. Cách thiết kế nào tránh được xung đột?",
                "explanation": "Vì chuỗi không xoá được, dữ liệu cá nhân phải ở ngoài chuỗi để xoá được; trên chuỗi chỉ có mã băm không suy ngược ra dữ liệu.",
                "points": 2,
                "options": [
                    {"label": "Ngay từ đầu chỉ neo mã băm; dữ liệu cá nhân lưu ngoài chuỗi để xoá được", "isCorrect": True},
                    {"label": "Xoá khối chứa thông tin đó khỏi tất cả các bản sao", "isCorrect": False, "misconception": "cngdtt.personal-data-on-chain"},
                    {"label": "Từ chối vì chuỗi khối không cho xoá", "isCorrect": False, "misconception": "cngdtt.personal-data-on-chain"},
                    {"label": "Đổi tên người học thành mã số ngay trên chuỗi", "isCorrect": False},
                ],
            },
            {
                "key": "bc-bang-chung",
                "type": "mcq",
                "prompt": "Đọc các tổng quan hệ thống về chuỗi khối trong giáo dục, kết luận nào có cơ sở nhất?",
                "explanation": "Phần lớn công trình dừng ở kiến trúc và nguyên mẫu; bằng chứng khả thi kỹ thuật có, bằng chứng tác động học tập gần như chưa. Không lấy sự chú ý làm bằng chứng hiệu quả.",
                "points": 2,
                "options": [
                    {"label": "Khả thi kỹ thuật đã được chứng minh ở một số ca; tác động lên kết quả học tập gần như chưa được đo", "isCorrect": True},
                    {"label": "Nhiều công bố nên chuỗi khối đã được chứng minh cải thiện việc học", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Vì MIT đã dùng nên mọi trường đều nên dùng", "isCorrect": False, "misconception": "cngdtt.blockchain-default-solution"},
                    {"label": "Chưa có ca nào triển khai thật ở đâu cả", "isCorrect": False},
                ],
            },
        ],
    },
}

# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.7 · Blockchain trong giáo dục: chứng chỉ số, quyền sở hữu dữ liệu và bài toán \"có cần không\"",
    "durationMin": 120,
    "description": "Buổi học tương tác 120 phút: cơ chế chuỗi khối qua mô phỏng tự tay làm, sổ cái người thật, các ứng dụng chứng chỉ số và bằng chứng hiện có, giới hạn về quyền riêng tư và pháp lý, và phiên hội đồng thẩm định \"có cần blockchain không\".",
    "objectives": [
        "Giải thích được bốn khái niệm nền của chuỗi khối — hàm băm, khối nối chuỗi, sổ cái phân tán, đồng thuận — và chỉ ra vì sao sửa một khối làm hỏng cả chuỗi phía sau",
        "Mô tả được mô hình neo mã băm để xác minh chứng chỉ, và phân biệt cái gì nằm trên chuỗi, cái gì phải nằm ngoài chuỗi",
        "Vận dụng bộ năm câu hỏi để kết luận một bài toán giáo dục nên dùng chuỗi khối, cơ sở dữ liệu thường kèm chữ ký số, hay không cần gì cả",
    ],
    "summary": [
        "Chuỗi khối là sổ cái chỉ thêm, nhiều bản sao, mỗi khối mang mã băm của khối trước: sửa một khối cũ là làm sai lệch mọi khối sau nó, và các bản sao còn lại lập tức phát hiện.",
        "Chuỗi khối chống được việc sửa dữ liệu về sau, không chống được việc ghi dữ liệu sai từ đầu: nó bảo đảm dữ liệu không bị đổi, không bảo đảm dữ liệu đúng.",
        "Ứng dụng giáo dục có cơ sở nhất là neo mã băm của chứng chỉ để xác minh không cần hỏi trường; dữ liệu cá nhân của người học luôn để ngoài chuỗi.",
        "Bằng chứng về tác động học tập gần như chưa có — phần lớn công trình dừng ở kiến trúc và nguyên mẫu — nên câu hỏi đầu tiên luôn là \"bài toán này có cần chuỗi khối không\", không phải \"dùng chuỗi khối thế nào\".",
    ],
    "body": r"""
> [!meo] **Bắt đầu bằng việc làm, không bằng việc đọc.** Học liệu **Mô phỏng chuỗi khối** ở đầu bài là một trang tự chạy: bạn sẽ tự "đào" khối, tự phá chuỗi và tự xác minh một chứng chỉ ngay trong trình duyệt. Mở nó ở tab riêng trước khi vào buổi học; các hoạt động cá nhân trong bài đều dùng nó.

## Bốn khái niệm nền: từ tờ chứng chỉ tới chuỗi khối

### Khởi động: bạn kiểm chứng một tấm bằng bằng cách nào?

Bạn nhận được một tệp PDF "Bằng tốt nghiệp đại học" của một ứng viên, gửi qua email. Ai đứng ra bảo đảm nó thật? Thông thường câu trả lời là **hỏi lại trường**: gọi điện, gửi công văn, chờ vài ngày. Cách này có ba điểm yếu: chậm, phụ thuộc vào việc trường còn hoạt động và còn lưu hồ sơ, và người xác minh phải tin vào **kênh** trả lời chứ không phải vào bản thân tờ giấy.

Chuỗi khối (*blockchain*) được đề xuất như một cách để tờ giấy **tự chứng minh** — mà không cần hỏi ai. Để hiểu nó làm được và không làm được gì, cần bốn khái niệm.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Bốn khái niệm nền của chuỗi khối</div>
  <div style="min-width:36rem;display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
    <div style="border-left:5px solid rgba(37,99,235,.85);background:rgba(37,99,235,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>1 · Hàm băm</strong><br>Biến dữ liệu bất kỳ thành một dãy ký tự độ dài cố định (SHA-256: 64 ký tự thập lục phân). Đổi <em>một</em> ký tự đầu vào là dãy đầu ra đổi hoàn toàn; không đảo ngược được.</div>
    <div style="border-left:5px solid rgba(13,148,136,.88);background:rgba(13,148,136,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>2 · Khối nối chuỗi</strong><br>Mỗi khối chứa dữ liệu <em>và mã băm của khối liền trước</em>. Sửa khối cũ ⇒ mã băm của nó đổi ⇒ khối sau tham chiếu sai ⇒ vỡ dây chuyền.</div>
    <div style="border-left:5px solid rgba(124,58,237,.85);background:rgba(124,58,237,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>3 · Sổ cái phân tán</strong><br>Nhiều máy (nút) cùng giữ một bản sao của chuỗi. Muốn sửa lịch sử, kẻ gian phải sửa đồng loạt phần lớn các bản sao, chứ không chỉ một cơ sở dữ liệu.</div>
    <div style="border-left:5px solid rgba(217,150,40,.9);background:rgba(217,150,40,.07);border-radius:0 .4rem .4rem 0;padding:.6rem .8rem;font-size:1.02rem;line-height:1.55"><strong>4 · Đồng thuận</strong><br>Quy tắc để các nút thống nhất khối nào được thêm vào: bằng công việc tính toán (<em>proof of work</em>), bằng lượng tài sản đặt cược (<em>proof of stake</em>), hoặc bằng danh sách nút được cấp phép.</div>
  </div>
</div>
```

Ý tưởng gốc được Nakamoto mô tả năm 2008 cho tiền mã hoá Bitcoin; giáo dục chỉ mượn **phần sổ cái chống sửa**, không mượn tiền mã hoá. Hai loại chuỗi khối cần phân biệt: **công khai** (ai cũng đọc và tham gia — Bitcoin, Ethereum) và **có cấp phép** (chỉ nút được mời — thường do một liên minh trường học vận hành). Loại nào cũng có chi phí riêng, và đó là chỗ bài toán "có cần không" bắt đầu.

> [!canh-bao] Hay gặp nhất: nhầm **chống sửa** với **đúng**. Chuỗi khối chỉ bảo đảm một điều — *từ lúc ghi vào, dữ liệu không bị đổi mà không ai hay*. Nếu giáo vụ nhập nhầm điểm rồi ghi lên chuỗi, chuỗi giữ nguyên lỗi đó vĩnh viễn. Mục 3 sẽ quay lại.

### Hoạt động cá nhân · Tự tay phá chuỗi (14 phút)

Mở học liệu **Mô phỏng chuỗi khối**, thẻ **Chuỗi khối**, và làm lần lượt:

1. Bấm **Đào tất cả**. Ghi lại: mỗi khối cần bao nhiêu lần thử (*nonce*) để mã băm bắt đầu bằng `0000`?
2. Sửa dữ liệu của **Khối 2** — chỉ đổi một chữ số. Quan sát: khối nào chuyển đỏ? Chỉ Khối 2, hay cả các khối sau? Vì sao?
3. Bấm **Đào** ở Khối 2 rồi Khối 3, Khối 4. Kẻ gian cần làm bao nhiêu việc để "sửa lịch sử" trong chuỗi 4 khối? Trong chuỗi 4 triệu khối, và trong khi cả mạng vẫn đang thêm khối mới?
4. Viết vào giấy **một câu** (không quá 25 chữ) giải thích cho một người chưa học công nghệ: *"Vì sao chuỗi khối khó sửa?"* Đổi giấy với bạn ngồi cạnh và chấm nhau: câu đó có nhắc tới mã băm của khối trước không?

## Ứng dụng trong giáo dục: cái gì có cơ sở, cái gì mới chỉ là lời hứa

### Năm nhóm ứng dụng và độ chín của từng nhóm

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Ứng dụng chuỗi khối trong giáo dục — theo độ chín</div>
  <table style="min-width:38rem;border-collapse:collapse;width:100%;font-size:1rem;line-height:1.5">
    <thead><tr style="text-align:left"><th style="padding:.5rem;border-bottom:2px solid rgba(127,127,127,.3)">Nhóm ứng dụng</th><th style="padding:.5rem;border-bottom:2px solid rgba(127,127,127,.3)">Ý tưởng</th><th style="padding:.5rem;border-bottom:2px solid rgba(127,127,127,.3)">Độ chín</th></tr></thead>
    <tbody>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Chứng chỉ, văn bằng</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Neo mã băm của chứng chỉ lên chuỗi; người xác minh tự đối chiếu</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(13,148,136,.88);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Đã triển khai thật</span></td></tr>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Huy hiệu, chứng chỉ vi mô</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Nhiều tổ chức cấp, người học gom vào một ví số</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(13,148,136,.88);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Thí điểm có chuẩn</span></td></tr>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Học bạ, chuyển đổi tín chỉ</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Hồ sơ học tập theo người học, vượt biên giới trường</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(217,150,40,.9);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Thí điểm</span></td></tr>
      <tr><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><strong>Bản quyền học liệu, thanh toán</strong></td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)">Hợp đồng thông minh chia doanh thu cho người tạo nội dung</td><td style="padding:.5rem;border-bottom:1px solid rgba(127,127,127,.25)"><span style="background:rgba(217,150,40,.9);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Chủ yếu nguyên mẫu</span></td></tr>
      <tr><td style="padding:.5rem"><strong>Ghi nhận việc học, hệ thống danh tiếng</strong></td><td style="padding:.5rem">Sổ cái tự động ghi mọi hoạt động học của người học</td><td style="padding:.5rem"><span style="background:rgba(220,38,38,.85);color:#fff;padding:.1rem .5rem;border-radius:.25rem">Ý tưởng, nhiều rủi ro</span></td></tr>
    </tbody>
  </table>
</div>
```

**Chứng chỉ là nhóm chín nhất.** Năm 2017, MIT cùng công ty Learning Machine thí điểm cấp văn bằng số trên chuỗi khối của Bitcoin theo chuẩn mở Blockcerts: một nhóm 111 cựu sinh viên đầu tiên được chọn nhận văn bằng trên điện thoại; theo MIT, người hào hứng nhất là sinh viên quốc tế cần bằng chứng tốt nghiệp mà chính phủ nước họ tin. Ở châu Âu, Uỷ ban châu Âu phát triển hạ tầng **EBSI** với một tình huống dùng dành riêng cho văn bằng, dựa trên chuẩn *Verifiable Credentials* của W3C, song song với sáng kiến *European Digital Credentials for Learning*. Đặc điểm chung của mọi triển khai chín là: **trên chuỗi chỉ có mã băm, không có nội dung chứng chỉ.**

### Mô hình neo mã băm

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cấp và xác minh một chứng chỉ theo mô hình neo mã băm</div>
  <div style="min-width:40rem;display:flex;align-items:stretch;gap:.4rem;font-size:.98rem;line-height:1.45">
    <div style="flex:1;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>① Trường cấp</strong><br>Sinh tệp chứng chỉ, tính mã băm SHA-256</div>
    <div style="align-self:center;opacity:.6">→</div>
    <div style="flex:1;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem;padding:.6rem"><strong>② Neo lên chuỗi</strong><br>Ghi <em>chỉ mã băm</em> (thường gộp nhiều chứng chỉ qua cây Merkle)</div>
    <div style="align-self:center;opacity:.6">→</div>
    <div style="flex:1;background:rgba(13,148,136,.88);color:#fff;border-radius:.4rem;padding:.6rem"><strong>③ Người học giữ</strong><br>Tệp chứng chỉ nằm trong ví của người học, <em>ngoài chuỗi</em></div>
    <div style="align-self:center;opacity:.6">→</div>
    <div style="flex:1;background:rgba(217,150,40,.9);color:#fff;border-radius:.4rem;padding:.6rem"><strong>④ Nhà tuyển dụng</strong><br>Tự tính mã băm tệp nhận được, đối chiếu với chuỗi — không cần hỏi trường</div>
  </div>
</div>
```

Hai hệ quả cần nhớ. **Một**, sửa tệp chứng chỉ dù một dấu phẩy thì mã băm đổi và đối chiếu thất bại — đó chính là thứ bạn đã thử ở thẻ **Xác minh chứng chỉ** của học liệu. **Hai**, người học thật sự **sở hữu** hồ sơ của mình: trường đóng cửa hay đổi tên, chứng chỉ vẫn xác minh được. Đó là giá trị thật của mô hình — không phải "công nghệ mới" mà là *chuyển gánh nặng xác minh từ kênh trả lời sang phép toán*.

### Bằng chứng: ta biết được gì

Hãy phân biệt ba loại câu hỏi. *Có làm được về kỹ thuật không?* — có, MIT và EBSI là bằng chứng. *Có rẻ và tiện hơn giải pháp thay thế không?* — chưa rõ, ít công bố so sánh chi phí trung thực. *Có cải thiện việc học không?* — gần như chưa có nghiên cứu nào đo. Các tổng quan hệ thống (ví dụ Alammary và cs., 2019) ghi nhận phần lớn công trình dừng ở đề xuất kiến trúc và nguyên mẫu; báo cáo của Trung tâm Nghiên cứu Chung châu Âu (Grech & Camilleri, 2017) cũng nhấn mạnh tiềm năng đi kèm nhiều rào cản chưa giải. Áp dụng khung PICRAT ở Bài 1.3: hầu hết ứng dụng nằm ở ô **Thay thế – Thụ động** (làm hồ sơ số thay hồ sơ giấy), rất ít ở ô **Chuyển hoá**.

## Giới hạn và rủi ro: khi nào KHÔNG nên dùng

### Ba giới hạn cần thuộc

**Thứ nhất — chống sửa không phải đúng.** Chuỗi giữ nguyên dữ liệu sai từ đầu (*garbage in, garbage forever*). Với chứng chỉ, trọng tâm bảo đảm phải nằm ở **quy trình cấp** và **danh tính của bên cấp**, không phải ở chuỗi.

**Thứ hai — bất biến va chạm với quyền riêng tư.** Người học có quyền yêu cầu xoá hoặc sửa dữ liệu cá nhân; chuỗi khối được thiết kế để *không xoá được*. Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 có riêng **Điều 30** về xử lý dữ liệu trong môi trường dữ liệu lớn, trí tuệ nhân tạo, chuỗi khối và điện toán đám mây. Quy tắc thiết kế an toàn: **không đưa dữ liệu cá nhân lên chuỗi — chỉ neo mã băm đã được xử lý để không suy ngược được**, mọi nội dung ở ngoài chuỗi để xoá được khi cần. Luật Công nghiệp công nghệ số 71/2025/QH15, có hiệu lực từ 01/01/2026, lần đầu đưa tài sản số vào khung pháp lý chuyên ngành — nhưng bài toán chứng chỉ giáo dục không phải tài sản số, đừng nhầm hai chuyện.

**Thứ ba — chi phí và vận hành.** Có cấp phép hay công khai, ai chạy nút, ai trả phí giao dịch, ai xử lý khi người học mất khoá ví? Một văn bằng mà người học làm mất khoá riêng và không lấy lại được là một văn bằng không chứng minh được — thảm hoạ vận hành mà cơ sở dữ liệu thường không có.

### Bộ năm câu hỏi trước khi chọn chuỗi khối

Phỏng theo sơ đồ quyết định của Wüst và Gervais (2018, ETH Zürich) và điều chỉnh cho bối cảnh giáo dục:

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:36rem;display:flex;flex-direction:column;gap:.35rem;font-size:1.02rem;line-height:1.5">
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">1</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Có cần một trạng thái dùng chung không?</strong> <span style="opacity:.75">Không ⇒ không cần chuỗi khối.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">2</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Có nhiều bên cùng ghi không?</strong> <span style="opacity:.75">Chỉ một bên ghi ⇒ cơ sở dữ liệu thường, có thể kèm chữ ký số.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(13,148,136,.88);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">3</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Các bên có thiếu tin nhau, và không có bên thứ ba đáng tin không?</strong> <span style="opacity:.75">Có một trung gian mọi bên chấp nhận (bộ, hiệp hội) ⇒ để họ vận hành.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(13,148,136,.88);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">4</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Có cần chống sửa lịch sử ngay cả với người vận hành không?</strong> <span style="opacity:.75">Không cần ⇒ nhật ký thông thường là đủ.</span></div></div>
    <div style="display:flex;gap:.6rem;align-items:stretch"><div style="flex:0 0 2.2rem;background:rgba(217,150,40,.9);color:#fff;border-radius:.35rem;display:flex;align-items:center;justify-content:center;font-weight:700">5</div><div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.35rem;padding:.5rem .7rem"><strong>Dữ liệu có nhạy cảm hay phải xoá được không?</strong> <span style="opacity:.75">Có ⇒ chỉ neo mã băm, nội dung để ngoài chuỗi.</span></div></div>
  </div>
</div>
```

> [!ghi-nho] Một bài toán chỉ "xứng" với chuỗi khối khi **trả lời "có" cho cả câu 1–4** và **có cách xử lý câu 5**. Rất nhiều bài toán giáo dục rơi ở câu 2 hoặc 3 — đó không phải thất bại của bạn, mà là kết luận thẩm định đúng. Đây là tinh thần của cả khoá: công cụ đổi nhanh, cách hỏi thì dùng lại được.

## Luyện tập và tài liệu tham khảo

### Tiến trình buổi học trên lớp (120 phút)

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:42rem;display:flex;height:3.4rem;border-radius:.45rem;overflow:hidden;color:#fff;font-size:.9rem;text-align:center;line-height:1.2">
    <div style="flex:8;background:rgba(217,150,40,.9);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Khởi động<br>cá nhân + cặp</div>
    <div style="flex:14;background:rgba(37,99,235,.85);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Giảng 1<br>bốn khái niệm</div>
    <div style="flex:14;background:rgba(13,148,136,.88);display:flex;align-items:center;justify-content:center;padding:0 .15rem">Cá nhân<br>phá chuỗi</div>
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

Gần **hai phần ba** thời gian là hoạt động của sinh viên (cá nhân 14′ + nhóm 45′), và mỗi hoạt động đều nằm ngay sau phần giảng cần dùng: bốn khái niệm ⇒ tự phá chuỗi ⇒ sổ cái người thật ⇒ ứng dụng ⇒ giới hạn ⇒ hội đồng thẩm định.

### Cá nhân + cặp · Khởi động (8 phút)

Ba tình huống: (A) PDF bằng tốt nghiệp gửi qua email, (B) trang tra cứu văn bằng của trường, (C) bản sao công chứng. **3 phút cá nhân:** với mỗi tình huống, viết *bạn kiểm chứng bằng cách nào* và *ai có thể làm giả ở đâu*. **3 phút cặp:** đối chiếu; tìm chỗ cả ba cách đều phụ thuộc vào cùng một điểm yếu. **2 phút cả lớp:** giơ tay chọn cách bạn tin nhất — rồi ghi câu trả lời lại, cuối buổi ta quay về.

### Nhóm 5 người · Sổ cái người thật (18 phút)

**Chuẩn bị:** mỗi nhóm 5 người, mỗi người một tờ giấy chia cột *Số thứ tự · Nội dung · Dấu nối*. **Một người được giảng viên nhắn riêng làm "kẻ gian"** (cả nhóm không biết là ai).

**Vòng 1 (8 phút) — ghi sổ.** Giảng viên đọc lần lượt 6 giao dịch, ví dụ: "Trường A cấp chứng chỉ số 1 cho Lan", "Trường A cấp chứng chỉ số 2 cho Minh"… Mỗi người tự chép vào tờ của mình. **Dấu nối** của dòng n là *hai chữ cuối của Nội dung dòng n−1* viết lại ở đầu dòng n — mô phỏng thô của việc "mang mã băm khối trước".

**Vòng 2 (6 phút) — tấn công.** Kẻ gian lén sửa dòng 2 trên tờ của mình (đổi người nhận) rồi tuyên bố "tờ của tôi mới đúng". Các nút còn lại **không được nhìn tờ nhau trước** mà phải: (a) tự kiểm tra dây nối trên tờ kẻ gian, (b) bỏ phiếu xem bản nào là bản chuẩn. Ghi lại: phát hiện bằng cách nào, mất bao lâu.

**Vòng 3 (4 phút) — nới điều kiện.** Giảng viên đổi luật: giờ kẻ gian **là 3 trong 5 nút** thông đồng. Điều gì xảy ra? Cả nhóm rút ra ba nhận xét trên một tờ giấy: về *độ an toàn*, *chi phí* (5 người cùng chép cùng một dòng), và *ai thật sự cần sổ cái này*.

**Hỏi để tổng kết:** so với việc chỉ *một* giáo vụ giữ *một* cuốn sổ, sổ 5 bản tốn thêm gì và mua được thêm gì? Đó chính là phép cân "chi phí – lợi ích" của chuỗi khối, tóm gọn trong 18 phút.

### Nhóm 5 người · Hội đồng thẩm định "có cần blockchain không" (27 phút)

**Tình huống:** mỗi nhóm là một hội đồng thẩm định của một sở giáo dục, nhận đề xuất dùng chuỗi khối từ một nhà cung cấp. **Bốc thăm** một đề xuất: (1) văn bằng số của một trường đại học · (2) huy hiệu số do nhiều trung tâm đào tạo cùng cấp · (3) học bạ chuyển giữa các trường phổ thông trong tỉnh · (4) chia doanh thu bản quyền học liệu cho giáo viên tạo nội dung · (5) lưu vết đề thi, bài làm và điểm của kỳ thi tuyển sinh · (6) quỹ học bổng minh bạch giữa nhà tài trợ – trường – sinh viên.

**Nhiệm vụ trong 27 phút:**

- **10 phút — thẩm định.** Chạy đề xuất qua **bộ năm câu hỏi**, mỗi câu ghi *có / không / chưa rõ* kèm một lý do. Xác định cụ thể: *ai ghi, ai đọc, ai là bên thứ ba đáng tin nếu có*.
- **6 phút — phương án thay thế.** Nêu *một* phương án không dùng chuỗi khối (cơ sở dữ liệu thường, chữ ký số, dịch vụ do bộ vận hành…) và so trên ba tiêu chí: chi phí, độ tin cậy với bên ngoài, quyền riêng tư.
- **3 phút — quyết định.** Chọn một: **Dùng chuỗi khối · Không dùng · Dùng có điều kiện** — kèm **một chỉ số đo được sau 12 tháng** buộc đề xuất phải chứng minh (không dùng chỉ số tăng trưởng, chỉ dùng chỉ số về xác minh hoặc học tập).
- **8 phút — phiên điều trần.** Bốn nhóm được gọi trình bày mỗi nhóm 90 giây; cả lớp đóng vai nhà cung cấp và chất vấn 30 giây mỗi nhóm, tập trung vào câu 3 (bên thứ ba đáng tin) và câu 5 (dữ liệu cá nhân).

**Chấm theo (10 điểm):** trả lời đúng và có lý do cho cả năm câu (3đ) · nêu được phương án thay thế cụ thể, so trên ba tiêu chí (2đ) · nhận diện rủi ro dữ liệu cá nhân, dẫn đúng nguyên tắc "chỉ neo mã băm" (2đ) · quyết định gắn với chỉ số đo được sau 12 tháng (2đ) · trả lời chất vấn có lập luận (1đ).

### Cá nhân · Phiếu ra cửa (10 phút)

Đọc lại câu trả lời ở phần khởi động và viết trong 5 phút: (1) tình huống A, B hay C là thứ chuỗi khối *thật sự* cải thiện, và cải thiện chỗ nào; (2) một điều bạn tin trước buổi học mà giờ bạn sửa lại. Phần còn lại: giảng viên gọi 3 phiếu ngẫu nhiên để đọc, sau đó nhắc bài tập về nhà.

### Bài tập về nhà — sản phẩm số (120 phút)

Dựng **Cổng xác minh chứng chỉ** — một trang web tĩnh một tệp cho một trường giả định — kèm **phiếu thẩm định một trang**.

1. Soạn **5 chứng chỉ giả lập** (chỉ dùng tên hư cấu, không dùng dữ liệu người thật) dưới dạng văn bản thuần.
2. Tính mã băm SHA-256 của từng chứng chỉ và lập **bảng neo** (mã chứng chỉ – mã băm).
3. Viết trang HTML một tệp có ô dán nội dung chứng chỉ; bấm nút thì tính mã băm ngay trong trình duyệt và đối chiếu với bảng neo; hiện rõ **KHỚP** hay **KHÔNG KHỚP**.
4. Thực hiện **ba phép thử phá**: đổi một ký tự; thêm một khoảng trắng cuối dòng; dán một chứng chỉ chưa từng neo. Chụp màn hình cả ba kết quả và giải thích vì sao mỗi trường hợp ra kết quả như vậy.
5. Viết **phiếu thẩm định một trang**: chọn đề xuất bạn đã bốc trong lớp (hoặc một đề xuất khác trong đồ án sách AR của bạn, ví dụ "chứng nhận hoàn thành bài học AR"), chạy bộ năm câu hỏi, kết luận, và chỉ số 12 tháng.

**Cách làm (gợi ý từng bước):** tính băm bằng lệnh `shasum -a 256 tên-tệp` (macOS, Linux) hoặc `Get-FileHash tên-tệp` (Windows PowerShell); trong trình duyệt dùng `crypto.subtle.digest("SHA-256", …)` — hàm này chạy khi trang được mở qua `https` hoặc `localhost`, không chạy khi mở tệp trực tiếp trong một số trình duyệt, nên hãy thử qua `python3 -m http.server`; đổi bytes sang thập lục phân bằng `toString(16).padStart(2, "0")`; phép thử "thêm khoảng trắng" sẽ cho thấy hệ thống phải chuẩn hoá văn bản *trước khi băm* — hãy ghi lại quy tắc chuẩn hoá bạn chọn và lý do; mã nguồn trang không quá 80 dòng.

**Chấm theo:** bảng neo đúng, mã băm kiểm lại được (2đ) · trang xác minh chạy đúng ở cả ba phép thử phá (3đ) · giải thích đúng vì sao khớp hay không khớp, có nêu chuẩn hoá văn bản (2đ) · phiếu thẩm định bám bộ năm câu hỏi, có phương án thay thế và chỉ số 12 tháng (3đ).

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

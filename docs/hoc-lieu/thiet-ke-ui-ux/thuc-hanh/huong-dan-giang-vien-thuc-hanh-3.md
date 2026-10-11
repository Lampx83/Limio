# Hướng dẫn giảng viên — Thực hành 3 (Module 7): Khám nghiệm một màn hình Limio

Tài liệu này dành cho giảng viên và không đăng cho sinh viên. Trang dành cho sinh viên là `phieu-kham-nghiem-module-7.html`; trang này được dựng bằng lệnh `python3 src/build_th3.py` và nội dung nằm ở `src/th3.py`, vì vậy không sửa trực tiếp vào file HTML.

## Ý tưởng chính

Buổi này không dạy hết bốn bài 7.1 đến 7.4. Thay vào đó, giảng viên dạy **bốn câu hỏi**, mỗi câu trong khoảng 8 phút, rồi để sinh viên dùng ngay câu hỏi đó trên **một màn hình thật của Limio** trong 17 phút. Vì sinh viên đang ngồi trong chính sản phẩm được khám nghiệm, mọi phát hiện đều có thể được kiểm chứng ngay tại chỗ.

| Trạm | Câu hỏi | Màn hình Limio |
|---|---|---|
| 7.1 | Màn hình này phục vụ ai, và nó làm người học mệt hay chỉ làm họ đỡ phải suy nghĩ? | Tổng quan của tôi, khối BXH tuần này, và Cài đặt tài khoản, mục Quyền riêng tư. |
| 7.2 | Điều gì trên màn hình này không phục vụ mục tiêu của bài? | Một bài dài của khoá (Bài 7.4) xem trên điện thoại. |
| 7.3 | Chỉ số này đo việc học hay chỉ đo sự có mặt, ai được xem nó và nó được giữ trong bao lâu? | Tổng quan của tôi, và đường đi tới dữ liệu cá nhân của người học. |
| 7.4 | Người học có làm được việc chính khi mất mạng giữa chừng hay không? | Quiz thử và đề thi thử, với chế độ máy bay. |

## Lưu ý quan trọng: các phát hiện dưới đây được suy ra từ mã nguồn

Các phát hiện trong tài liệu này được suy ra từ việc đọc mã nguồn chứ chưa được xem trực tiếp trên từng màn hình. Vì vậy, **giảng viên nên tự đi qua cả bốn trạm một lượt trên điện thoại vào buổi tối trước giờ dạy**, và sửa lại bảng “điều nên phát hiện” nếu ứng dụng cư xử khác. Mỗi mục bên dưới đều ghi vị trí trong mã để tiện đối chiếu.

## Chuẩn bị trước giờ dạy

- [ ] **Kiểm tra xem Module 7 đã được mở chưa.** Ghi chú ngày 04/10 cho biết Module 1, 3, 5, 6 và 7 trên prod vẫn đang khoá. Một bài bị khoá khi bài hoặc module chứa nó bị khoá, và không thể mở riêng một bài trong module đang khoá. Giảng viên nên kiểm lại bằng một tài khoản học viên.
- [ ] **Chuẩn bị tài khoản học viên thử có dữ liệu**, tức là đã ghi danh khoá học và đã làm vài lượt quiz để khối *Chủ đề cần ôn* không bị trống. Tài khoản `joynguyen7` là một lựa chọn phù hợp.
- [ ] **Tạo một quiz thử ngắn** (khoảng 5 câu), không tính điểm, và đặt tên rõ ràng, chẳng hạn “Quiz thử — Thực hành 3”. Sinh viên không nên làm thí nghiệm mất mạng trên một quiz có điểm.
- [ ] **Chuẩn bị đề thi thử.** Trạm 7.4 cần một ca thi đang mở, và đây là việc nặng nhất vì phải dựng Đợt thi, Ca thi và Phòng thi, trong đó thí sinh vào bằng mã. Nếu thiếu thời gian, giảng viên có thể làm theo phương án nhẹ hơn: tự thực hiện thí nghiệm với đề thi thử trên điện thoại của mình và chiếu màn hình lên cho lớp, còn sinh viên chỉ làm quiz thử.
- [ ] **Kiểm tra mạng lớp.** Mạng bình thường là đủ, vì chế độ máy bay không phụ thuộc vào mạng của lớp. Giảng viên nhắc sinh viên mang điện thoại đủ pin.
- [ ] **Chuẩn bị đủ thiết bị**: mỗi nhóm có hai điện thoại. Nếu nhóm bốn người nhưng chỉ có một máy thì cho nhóm làm quiz thử trước.
- [ ] **In phiếu** hoặc nhắc sinh viên kẻ lại bảng ở cuối trang dành cho sinh viên. Trang đó đã có sẵn nút “Tải PDF”.
- [ ] **Mở bài tập nộp theo nhóm** trên Limio (chọn “Cách nộp: Nộp theo nhóm”) và đặt hạn nộp trong ngày. Danh sách nhóm của bài tập giữa kỳ được giữ nguyên.

## Lịch buổi học

| Phút | Việc | Giảng viên làm gì |
|---|---|---|
| 0–10 | Khởi động | Chiếu bảng bốn câu hỏi, rồi chuyển ý bằng một câu: “Hôm nay các bạn không làm bài về một sản phẩm tưởng tượng mà đang ngồi trong sản phẩm thật.” |
| 10–35 | Trạm 1 · Bài 7.1 | Nói 8 phút, nhóm làm 17 phút |
| 35–60 | Trạm 2 · Bài 7.2 | Nói 8 phút, nhóm làm 17 phút |
| 60–85 | Trạm 3 · Bài 7.3 | Nói 8 phút, nhóm làm 17 phút |
| 85–110 | Trạm 4 · Bài 7.4 | Nói 8 phút, nhóm làm 17 phút |
| 110–120 | Chọn việc sửa trước | Cả lớp chia sẻ nhanh và các nhóm nộp bài |

**Nếu chỉ có 90 phút**, giảng viên bỏ trạm 7.2 và giao sinh viên làm ở nhà, vì đó cũng chính là bài tập về nhà của Bài 7.2. Khi đó phần khởi động rút xuống còn 5 phút và mỗi trạm còn 20 phút (6 phút nói, 14 phút làm).

**Một nguyên tắc xuyên suốt cả buổi**: mỗi khi sinh viên nói “ứng dụng này kém”, giảng viên hỏi lại “bằng chứng nào, ở màn hình nào, và bạn đã nhìn thấy dòng chữ gì?”. Việc chấm điểm dựa trên bằng chứng chứ không dựa trên những lời chê khéo.

## Từng trạm

### Trạm 1 — Bài 7.1: Màn hình này phục vụ ai?

**Phần giảng (8 phút).** Giảng viên trình bày ba nhóm người dùng và lý do người chọn mua thường không phải người ngồi học. Tiếp theo là ba nhu cầu của lý thuyết tự quyết (tự chủ, năng lực, kết nối) và khái niệm ma sát mong muốn, tức là cái làm người học phải *suy nghĩ* thì nên giữ, còn cái làm họ *mệt* thì nên bỏ. Giảng viên nhấn mạnh thêm một ý: phần thưởng bên ngoài có thể lấn át động lực bên trong (Deci, Koestner và Ryan, 1999).

**Việc sinh viên làm.** Sinh viên phân loại từng khối trên *Tổng quan của tôi*, xếp khối BXH vào giữ, sửa hoặc bỏ, rồi làm theo mô tả để đổi cài đặt *Ẩn khỏi bảng xếp hạng*.

**Điều nên phát hiện** (theo mã nguồn, ở `apps/web/src/app/me/dashboard/page.tsx` và `apps/web/src/app/me/settings/SettingsForm.tsx`, khoảng dòng 272–296):

- Khối *Chủ đề cần ôn* là khối **gần việc học nhất** và có hành động bấm được. Ngược lại, *BXH tuần này* và *Huy hiệu* chủ yếu phục vụ nhu cầu kết nối và năng lực theo kiểu so sánh, và không cho biết người học đã học thêm được gì.
- Công tắc **Ẩn khỏi bảng xếp hạng** nằm ở mục *Quyền riêng tư*, nhưng dòng mô tả bên dưới lại yêu cầu lưu ở mục *Hồ sơ công khai*. Nói cách khác, công tắc và chỗ lưu nằm ở **hai mục khác nhau**. Đây là chỗ sinh viên đếm số bước và bị vấp.
- Cơ chế cho phép thoát (opt-out) là một điểm tốt, vì nó trả lại quyền **tự chủ** cho người học. Giảng viên đừng để lớp chỉ chê mà hãy hỏi: “Có chỗ nào ở đây làm đúng không?”.

**Nếu nhóm bí**, giảng viên hỏi: “Nếu bạn ẩn khỏi BXH thì bạn còn nhận XP không?” (Có, theo đúng mô tả ngay trên màn hình.) Sau đó hỏi tiếp: “Vậy BXH đang thưởng cho điều gì?”.

**Câu chốt trạm**: cơ chế này đang dạy người học học, hay đang dạy họ mở ứng dụng?

### Trạm 2 — Bài 7.2: Tải nhận thức

**Phần giảng (8 phút).** Giảng viên trình bày rằng trí nhớ làm việc rất hẹp, rồi giới thiệu ba loại tải (nội tại, ngoại lai, hữu ích) và sáu nguyên tắc của Mayer. Giảng viên cần nhớ nói về hiện tượng **đảo chiều theo trình độ**: với người đã thạo, việc giải thích thêm có thể gây cản trở.

**Việc sinh viên làm.** Sinh viên chụp ba ảnh màn hình của Bài 7.4 trên điện thoại, đánh số mọi thứ không phải nội dung bài, xếp chúng vào ba mức, tính phần trăm, rồi gọi tên hai chỗ theo nguyên tắc.

**Lưu ý cho giảng viên.** Màn hình này **chính là học liệu của giảng viên**. Sinh viên có thể chê dải nhãn, màu tô theo mục hay thanh dính cuối bài. Giảng viên cứ để các em chê, rồi đặt hai câu hỏi:

1. “Một người **hoàn toàn mới** với chủ đề này có cần mục lục và thanh tiến độ không?” (Có thể là có, vì chúng giảm tải điều hướng.)
2. “Có chỗ nào đang làm đúng nguyên tắc **chỉ dấu** không?” (Chẳng hạn màu theo mục giúp người học biết mình đang ở đâu.)

Bài học rút ra là một thứ bị coi là trang trí với người này có thể lại là chỉ dấu với người khác. Đó chính là *đảo chiều theo trình độ*, và lớp tự nhìn thấy nó trên một sản phẩm thật.

**Nếu lớp không chê**, giảng viên hỏi: “Nếu chỉ được bỏ đúng một thứ ở màn hình đầu tiên, bạn sẽ bỏ gì?”.

### Trạm 3 — Bài 7.3: Dữ liệu người học

**Phần giảng (8 phút).** Giảng viên trình bày bốn loại chỉ số (tương tác, hành vi học, kết quả học, chủ quan). Cặp đáng theo dõi là tỉ lệ hoàn thành đi cùng kết quả giữ được sau một khoảng thời gian. Tiếp theo là ba câu hỏi phải trả lời trước khi thu một trường dữ liệu, và Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (hiệu lực từ 01/01/2026), trong đó Điều 24 nói về dữ liệu của trẻ em.

**Việc sinh viên làm.** Sinh viên xếp loại các con số trên Tổng quan, trả lời ba câu hỏi cho một trường dữ liệu, rồi **đi tìm** chỗ xem, tải về hoặc xoá dữ liệu của mình.

**Điều nên phát hiện:**

- XP, chuỗi ngày, huy hiệu và BXH đều là **chỉ số tương tác hoặc hành vi bề mặt**, còn *Chủ đề cần ôn* gần với kết quả học hơn. Giảng viên có thể hỏi: “Con số nào nên to nhất trên màn hình này, và hiện nay con số nào đang to nhất?”.
- **Việc 3 là con dao hai lưỡi, nên giảng viên cần tự kiểm tra trước.** Route `apps/web/src/app/api/me/export/route.ts` có tồn tại (nó trả về tệp `profile-<userId>.json`), nhưng khi tìm trong `app/` và `components/`, không thấy chỗ nào trên giao diện trỏ tới nó. Trang Cài đặt tài khoản chỉ có *Hồ sơ công khai*, *Quyền riêng tư* và *Mật khẩu*. Nếu điều này được xác nhận trên máy thật, sinh viên sẽ **tự phát hiện** rằng sản phẩm có quyền xuất dữ liệu ở phía máy chủ nhưng người học không có đường đi tới đó. Phát hiện này khớp với tiêu chí của Bài 7.3: phần “em làm được gì” phải chỉ ra đường đi cụ thể trong sản phẩm.
- Giảng viên không nên nói trước kết quả. Nếu sinh viên không tìm ra, việc ghi lại những chỗ họ đã tìm cũng là một phát hiện, vì nó cho biết người dùng **nghĩ** dữ liệu nằm ở đâu.

**Câu hỏi nên dành cho cuối trạm**: nếu một học sinh lớp 10 đọc màn hình này, bạn ấy có biết dữ liệu của mình được dùng vào việc gì không?

### Trạm 4 — Bài 7.4: Mất mạng giữa chừng

**Phần giảng (8 phút).** Giảng viên trình bày rằng điện thoại là thiết bị chính, mạng chập chờn là chuyện bình thường và thiết bị rất đa dạng, rồi hướng dẫn sinh viên vẽ ba trạng thái (mạng tốt, mạng chậm, mất mạng). Giảng viên nên nói thêm rằng “mất bài đang làm dở” là hậu quả nặng nhất trong bảng ưu tiên ở phần cuối buổi.

**Việc sinh viên làm.** Sinh viên thực hiện thí nghiệm bật chế độ máy bay trên quiz thử (máy thứ nhất) và đề thi thử (máy thứ hai), ghi lại nguyên văn những gì thấy, và điền bảng bốn dòng hai cột.

**Điều nên phát hiện** (theo mã nguồn; **cần kiểm tra bằng mắt trước giờ dạy**):

| | Quiz | Đề thi |
|---|---|---|
| Khi mất mạng | `QuizPlayer.tsx:189-198` chỉ cảnh báo khi người học **rời trang** mà còn câu chưa lưu. Lúc nộp bài (`:444-447`), hệ thống báo “Chưa lưu được câu …, bạn kiểm tra kết nối mạng rồi bấm Nộp bài lại”. | `ExamPlayer.tsx:978` hiện băng báo “Mất kết nối — bài làm đang được lưu tạm trên máy, sẽ tự đồng bộ khi có mạng”, và nhãn trạng thái `Lưu tạm — chờ kết nối` (`:1197`). |
| Câu trả lời nằm ở đâu | Ở máy chủ. Khi mất mạng, câu chưa gửi **chưa nằm ở đâu cả** ngoài bộ nhớ của trang (chỉ cờ “đánh dấu xem lại” được lưu ở localStorage). | Ở `localStorage` cho tới khi đồng bộ được (`:131-186`). |
| Đóng trình duyệt giữa chừng | Những câu chưa gửi **bị mất**. | Bản nháp được khôi phục ở lần mở sau. |

Điểm đáng nói với lớp là **hai bộ làm bài nằm trong cùng một sản phẩm nhưng xử lý mất mạng khác nhau**, và người học không được báo trước điều đó. Việc đề thi (nặng hơn và có tính giờ) được bảo vệ kỹ hơn là hợp lý, nhưng quiz lại không nhận ra rằng mình vừa mất mạng cho đến khi nộp bài.

**Cần cẩn thận**: nếu thí nghiệm cho kết quả khác với dự đoán (chẳng hạn quiz cũng có một chỉ báo mà ở đây chưa ghi nhận), giảng viên hãy **tin vào kết quả thật** và nói đúng như vậy với lớp. Đây cũng là dịp dạy sinh viên rằng đọc mã không thay thế được việc thử.

**Câu chốt trạm**: hai màn hình làm bài trong cùng một sản phẩm có cư xử giống nhau khi mất mạng không, và người học có được báo trước không?

### Phần 5 — Chọn một việc sửa trước (10 phút)

Sinh viên chọn việc sửa trước theo ba tiêu chí: số người học gặp phải, hậu quả (mất bài nghiêm trọng hơn mất thời gian, và mất thời gian nghiêm trọng hơn việc chỉ gây khó chịu), và chi phí sửa. Mỗi nhóm vẽ một tờ giấy trước và sau, rồi trình bày một phút theo ba câu có sẵn trên trang. Giảng viên nên ghi lại các việc mà nhóm chọn, vì đó là một **bản đồ ưu tiên** miễn phí cho chính sản phẩm.

## Cách chấm

Rubric 100 điểm nằm trên trang dành cho sinh viên, gồm 4 trạm × 15 điểm, việc sửa trước 15 điểm, bản giấy 15 điểm và một phút trình bày 10 điểm. Tinh thần chấm như sau:

- Một trạm chỉ đạt điểm cao khi có **ảnh, nguyên văn và thao tác thật**. Nhận xét kiểu “em thấy ứng dụng này khó dùng” mà không có ảnh thì tối đa được nửa số điểm của trạm.
- Một phát hiện **sai nhưng trung thực** (nói rõ đã thử bằng cách nào) vẫn có giá trị hơn một phát hiện đúng nhưng chỉ chép lại bài giảng. Đây cũng chính là tiêu chí của Bài 7.4.
- Trang bài nộp tự hiển thị **theo nhóm**. Giảng viên đọc phần “Phần việc của tôi” của từng người và chỉnh điểm riêng khi cần.

## Sau buổi học

- Ảnh chụp, phiếu và bản giấy là đầu vào cho **đồ án cuối kỳ** (Bài 4.4). Nhóm nào đã chọn một trang Limio liên quan thì có thể dán phát hiện vào page 01 của file nhóm.
- **Danh sách việc sửa thật cho Limio** (nếu muốn thực hiện):
  1. Thêm đường dẫn tới “Xuất dữ liệu của tôi” trong Cài đặt tài khoản, dùng route đã có.
  2. Đưa nút lưu lại gần công tắc *Ẩn khỏi bảng xếp hạng*, hoặc lưu ngay khi bật hoặc tắt.
  3. Bổ sung cho quiz một chỉ báo “đã lưu / chưa lưu” và bản nháp ở máy, giống như đề thi.

  Cả ba việc đều nhỏ và chưa được thực hiện.
- Nếu muốn đưa buổi này lên Limio như hai bài thực hành trước, lệnh `python3 src/build_th3.py` đã sinh sẵn `bai-7.5-manifest.json`. Giảng viên nên chạy dry-run trước rồi mới tạo bài (lệnh nằm ở đầu file `src/build_th3.py`). **Nội dung này chưa được đẩy lên prod.** Số “7.5” hiện đang trùng với bản nháp *Bài 7.5 Tổng kết* trong thư mục `demo-ai-format/`, nên cần chốt lại số bài nếu cả hai cùng được đưa vào khoá.

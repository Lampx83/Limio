# Kịch bản giảng dạy · Bài 4.7 Blockchain trong giáo dục

**Học phần:** Các công nghệ giáo dục tiên tiến · **Đối tượng:** sinh viên năm cuối ngành Công nghệ giáo dục, mới nghe về blockchain · **Thời lượng:** 120 phút · **Sĩ số dự kiến:** 20–40 sinh viên, chia nhóm 5 người

> Cách dùng kịch bản: các đoạn **in nghiêng trong dấu ngoặc kép** là lời thoại mẫu, bạn nói lại theo giọng của mình. Các dòng **Làm** là việc bạn thực hiện. Các dòng **Sinh viên** là việc sinh viên làm. Mọi mốc thời gian là mốc đồng hồ của cả buổi.

---

## 1. Tóm tắt buổi học trong một trang

**Thông điệp xuyên suốt (nhắc ít nhất ba lần):** *"Blockchain không phải phép màu. Nó chỉ làm được một việc: khiến dữ liệu đã ghi rất khó bị sửa lén. Việc của người làm công nghệ giáo dục là biết khi nào cần việc đó, và khi nào không."*

**Sau buổi học, sinh viên phải làm được ba việc:**
1. Giải thích blockchain bằng hình ảnh cuốn sổ chung, không dùng thuật ngữ khó.
2. Nói được cái gì ghi lên blockchain (dấu vân tay của chứng chỉ), cái gì để bên ngoài (nội dung, dữ liệu cá nhân).
3. Áp dụng năm câu hỏi để quyết định một đề xuất có nên dùng blockchain không.

| Phút | Hoạt động | Hình thức | Mục đích |
|---|---|---|---|
| 0–8 | Khởi động: "Tấm bằng này thật hay giả?" | Cá nhân, rồi cặp | Tạo nhu cầu, lấy điểm xuất phát |
| 8–22 | Giảng 1: cuốn sổ chung và bốn ý | Giảng, hỏi đáp | Hiểu cơ chế bằng hình ảnh đời thường |
| 22–36 | Tự tay phá thử một chuỗi | Cá nhân, trên học liệu mô phỏng | Thấy tận mắt vì sao khó sửa lén |
| 36–54 | Sổ cái người thật | Nhóm 5 người, dùng giấy bút | Trải nghiệm đồng thuận và tấn công |
| 54–68 | Giảng 2: ứng dụng và bằng chứng | Giảng, hỏi đáp | Nối cơ chế với giáo dục |
| 68–73 | Nghỉ giải lao | | |
| 73–83 | Giảng 3: ba giới hạn | Giảng, hỏi đáp | Xây tư duy thẩm định |
| 83–110 | Hội đồng thẩm định | Nhóm 5 người | Vận dụng năm câu hỏi |
| 110–120 | Tổng kết và phiếu ra cửa | Cá nhân | Củng cố, đo kết quả |

---

## 2. Chuẩn bị

### Trước buổi học một ngày

- [ ] Mở Bài 4.7 trên hệ thống bằng máy chiếu, kiểm tra học liệu **Mô phỏng chuỗi khối** mở được ở tab riêng, cả hai thẻ đều chạy. Đào thử một lần để biết máy mất khoảng bao lâu (thường 1–3 giây).
- [ ] Gửi cho sinh viên đường dẫn Bài 4.7 và dặn mang laptop hoặc điện thoại. Học liệu mô phỏng chạy được trên điện thoại.
- [ ] In hoặc chép tay **6 thẻ đề xuất** cho hoạt động hội đồng (nội dung ở mục 9).
- [ ] Chuẩn bị giấy A4 (mỗi sinh viên 2 tờ), bút, giấy ghi chú, một đồng hồ đếm ngược hiển thị lên màn hình.
- [ ] Chuẩn bị **danh sách 6 giao dịch** cho hoạt động sổ cái (mục 6) trên một slide, chưa hiện.
- [ ] Chọn trước người đóng vai "kẻ gian" ở mỗi nhóm hoặc quyết định cách chọn bí mật (gợi ý ở mục 6).

### Bố trí phòng

Bàn xếp thành các cụm 5 người. Máy chiếu hiển thị đồng hồ đếm ngược và học liệu. Chừa lối đi giữa các nhóm để bạn đi quan sát trong các hoạt động.

---

## 3. Khởi động (0–8 phút)

**Mục tiêu:** khiến sinh viên tự cảm thấy vấn đề "làm sao biết một thứ là thật" trước khi nghe giải pháp.

**0–1 phút · Làm:** hiện lên màn hình ba tình huống: (A) tệp PDF bằng tốt nghiệp gửi qua email, (B) trang web tra cứu văn bằng của chính trường đó, (C) bản sao công chứng.

> *"Chào cả lớp. Hôm nay chúng ta học về blockchain, và mình sẽ bắt đầu bằng một câu hỏi rất đời thường. Giả sử bạn là nhà tuyển dụng. Một ứng viên gửi cho bạn ba thứ, như trên màn hình. Mình xin ba phút để mỗi bạn tự viết ra giấy hai điều cho từng tình huống: một, bạn sẽ kiểm chứng bằng cách nào; hai, kẻ gian có thể làm giả ở chỗ nào. Các bạn chưa cần nói gì với nhau. Bắt đầu."*

**1–4 phút · Sinh viên:** viết cá nhân. **Làm:** đi quanh lớp, đọc lướt vài tờ giấy, chọn ra một hai câu trả lời thú vị để gọi sau.

**4–7 phút · Sinh viên:** chia cặp đối chiếu.

> *"Bây giờ các bạn quay sang người bên cạnh, so sánh câu trả lời. Có một nhiệm vụ nhỏ: hai bạn thử tìm xem cả ba cách có chung một điểm yếu nào không."*

**7–8 phút · Làm:** gọi 2 cặp trả lời. Kết luận điểm yếu chung mà bạn đang hướng tới: **cả ba cách đều phải tin vào một bên trung gian** (email, trang web của trường, con dấu công chứng), và không cách nào cho phép người xem tự kiểm tra bản thân tờ giấy.

> *"Rất hay. Cả ba cách đều có chung một điểm: cuối cùng bạn phải tin vào ai đó. Hãy ghi lại câu trả lời của mình, vì cuối buổi chúng ta sẽ quay lại xem bạn còn nghĩ như vậy không."*

**Lưu ý:** nếu sinh viên nói "hỏi lại trường là xong", đó là câu trả lời đúng. Ghi nhận và hỏi tiếp: *"Nếu trường đã đóng cửa 10 năm rồi thì sao?"*

---

## 4. Giảng 1: cuốn sổ chung và bốn ý (8–22 phút)

**Mục tiêu:** sinh viên hiểu blockchain qua hình ảnh cuốn sổ, và hiểu mã băm là dấu vân tay.

**Chuẩn bị:** mở phần "Blockchain là gì? Bắt đầu từ một cuốn sổ chung" của bài trên máy chiếu.

### 8–13 phút · Câu chuyện cuốn sổ quỹ lớp

> *"Mình kể một câu chuyện không liên quan gì đến máy tính. Lớp chúng ta có 30 người. Lớp trưởng giữ một cuốn sổ ghi ai đã nộp quỹ lớp. Chỉ có một cuốn sổ, một người giữ. Các bạn thử nghĩ xem, có chuyện gì có thể xảy ra?"*

**Làm:** gọi 2–3 bạn trả lời. Ghi lên bảng hai rủi ro: **ghi nhầm hoặc cố tình sửa** và **mất sổ**.

> *"Bây giờ đổi cách làm. Mỗi lần có người nộp quỹ, lớp trưởng đọc to lên, và cả 30 bạn ai cũng ghi vào sổ của mình. Vậy nếu lớp trưởng muốn sửa lén một dòng cũ, lớp trưởng cần làm gì?"*

Câu trả lời mong đợi: phải sửa được sổ của rất nhiều bạn. Nếu có bạn nói "thì các bạn khác sẽ thấy khác nhau", khen và chốt:

> *"Chính xác. Đó là toàn bộ ý tưởng của blockchain: một cuốn sổ mà nhiều người cùng giữ bản sao, nên rất khó sửa lén."*

### 13–19 phút · Bốn ý cần nhớ

**Làm:** hiện sơ đồ "Bốn ý cần nhớ". Đi từng ý, mỗi ý khoảng một phút rưỡi, luôn gắn với cuốn sổ.

- **Ý 3, sổ phân tán (đã nói ở trên):** *"Đây là việc cả lớp cùng giữ một bản. Trong thế giới thật, các 'bạn' là những máy tính."*
- **Ý 4, đồng thuận:** *"Nếu hai bản sổ ghi khác nhau thì tin bản nào? Cả lớp giơ tay biểu quyết, bản nào nhiều người giữ hơn thì thắng. Người ta gọi đó là đồng thuận."*
- **Ý 1, mã băm, dành nhiều thời gian nhất:**

> *"Đây là ý quan trọng nhất. Mã băm là dấu vân tay của một đoạn văn bản. Mình cho các bạn xem một ví dụ."*

**Làm:** mở nhanh thẻ **Xác minh chứng chỉ** của học liệu, bấm **Nạp chứng chỉ 1**, bấm **Băm và tra sổ neo**, chỉ vào dãy 64 ký tự. Sau đó sửa điểm từ 8,5 thành 8,6, bấm lại.

> *"Các bạn thấy chưa? Mình chỉ đổi một chữ số, từ 8,5 thành 8,6, mà toàn bộ dãy ký tự khác hẳn. Có ba điều cần nhớ về dấu vân tay này: cùng nội dung thì luôn ra cùng dãy ký tự; đổi dù một chữ thì dãy ký tự đổi hoàn toàn; và từ dãy ký tự, không ai đoán ngược được nội dung."*

- **Ý 2, khối nối chuỗi:**

> *"Bây giờ là điểm thông minh nhất. Mỗi trang sổ, người ta gọi là một khối, có ghi thêm dấu vân tay của trang trước nó. Vậy nếu ai đó sửa trang số 2 thì chuyện gì xảy ra với dấu vân tay của trang 2? Nó đổi. Vậy trang số 3 đang ghi dấu vân tay cũ của trang 2, còn đúng không? Không còn đúng nữa. Và cứ thế, mọi trang phía sau đều bị lệch. Đó là lý do tại sao gọi là chuỗi."*

### 19–22 phút · Chốt và cảnh báo hiểu nhầm

**Làm:** hiện hộp "Hiểu nhầm phổ biến".

> *"Có một hiểu nhầm rất phổ biến mình muốn cảnh báo ngay. Nhiều người nghĩ dữ liệu ghi lên blockchain thì chắc chắn đúng. Không phải. Blockchain chỉ bảo đảm dữ liệu không bị sửa lén sau khi đã ghi. Nếu ngay từ đầu ghi sai thì nó giữ cái sai đó mãi mãi. Mình sẽ nhắc lại điểm này ở phần sau."*

**Hỏi kiểm tra nhanh (2 phút):** *"Ai cho mình biết, nếu sửa dữ liệu của khối số 2 trong một chuỗi 10 khối, thì những khối nào bị ảnh hưởng?"* Đáp án: khối 2 và tất cả các khối sau nó, từ khối 3 đến khối 10.

**Lỗi thường gặp:** sinh viên nhầm "mã hoá" với "mã băm". Sửa ngay: mã hoá thì giải mã ngược được, mã băm thì không.

---

## 5. Hoạt động cá nhân: tự tay phá thử một chuỗi (22–36 phút)

**Mục tiêu:** sinh viên tự thấy tận mắt hiện tượng "sửa một khối làm đỏ cả chuỗi phía sau".

**22–24 phút · Làm:** hướng dẫn mở học liệu.

> *"Bây giờ đến lượt các bạn. Mở học liệu Mô phỏng chuỗi khối, thẻ thứ nhất. Các bạn sẽ thấy bốn khối. Một khối hợp lệ khi mã băm của nó bắt đầu bằng bốn số 0. Các bạn có 10 phút làm bốn việc trong hướng dẫn trên màn hình, và mình sẽ đi quanh hỗ trợ."*

**Hiện lên màn hình 4 việc:**
1. Bấm **Đào tất cả**. Ghi lại số lần thử của từng khối.
2. Sửa dữ liệu Khối 2, chỉ đổi một chữ số. Khối nào chuyển đỏ? Vì sao?
3. Bấm **Đào** ở Khối 2, rồi 3, rồi 4. Kẻ gian phải làm thêm bao nhiêu việc?
4. Viết một câu (dưới 25 chữ) giải thích cho người không biết công nghệ: vì sao blockchain khó bị sửa lén?

**24–34 phút · Sinh viên:** làm việc riêng. **Làm:** đi quanh lớp, dừng lại ở những bạn bị kẹt. Các câu hỏi gợi mở khi ai đó bị kẹt:

- *"Bạn thấy khối nào đỏ? Khối 3 đỏ vì sao, trong khi bạn có sửa gì ở khối 3 đâu?"*
- *"Bạn thử nhìn dòng 'Băm khối trước' của Khối 3 xem nó có khớp với 'Băm khối này' của Khối 2 không?"*

**Điểm cần thấy sau bước 2:** cả Khối 2, 3 và 4 chuyển đỏ. Nếu sinh viên thấy chỉ Khối 2 đỏ, bảo họ cuộn xuống xem Khối 3, 4.

**Điểm cần thấy sau bước 3:** để "sửa lịch sử" hợp lệ, kẻ gian phải đào lại **từng khối một**, mà khối nào cũng tốn công tính toán.

**34–36 phút · Trao đổi:** đổi giấy với bạn bên cạnh, chấm nhau theo một tiêu chí duy nhất: *câu giải thích có nhắc tới việc mỗi khối mang dấu vân tay của khối trước không?* Gọi 2 bạn đọc câu của mình.

> *"Mình muốn nghe một câu hay nhất. Ai muốn đọc câu của bạn bên cạnh?"* (Gọi người khác đọc câu của bạn mình, để tránh ngại.)

**Xử lý sự cố:**
- Học liệu không mở được: chiếu màn hình của bạn và cho sinh viên xem theo nhóm 2–3 người, các bước vẫn làm được bằng lời hướng dẫn.
- Có bạn xong sớm: giao thêm câu hỏi *"Mình chỉnh khối 4 rồi đào lại khối 4. Các khối 1, 2, 3 có phải đào lại không? Vì sao?"*

---

## 6. Hoạt động nhóm: Sổ cái người thật (36–54 phút)

**Mục tiêu:** sinh viên trải nghiệm bằng cơ thể việc nhiều người cùng giữ sổ, cách phát hiện gian lận, và giới hạn khi phần lớn thông đồng.

### Chuẩn bị (làm trong lúc nghỉ hoặc trước buổi)

Mỗi nhóm 5 người, mỗi người một tờ giấy kẻ ba cột: **Số thứ tự · Nội dung · Dấu nối**.

**Chọn "kẻ gian" ở mỗi nhóm:** phát cho mỗi nhóm 5 mẩu giấy nhỏ úp xuống, trong đó có đúng một mẩu ghi "kẻ gian", bốn mẩu còn lại trống. Mỗi người bốc một mẩu và không cho ai xem.

### 36–39 phút · Giải thích luật

> *"Hoạt động này gọi là Sổ cái người thật. Mỗi nhóm 5 người, mỗi người là một 'máy tính' giữ một bản sổ. Mình sẽ đọc 6 giao dịch, và ai cũng tự chép vào tờ của mình. Có một quy tắc quan trọng: ở cột Dấu nối, dòng số n phải chép lại hai chữ cuối của dòng số n trừ 1 vào đầu dòng. Đó là cách làm thô sơ cho việc mỗi khối mang dấu vân tay của khối trước."*

> *"Ngoài ra, mỗi nhóm có một người bốc được mẩu giấy 'kẻ gian'. Người đó sẽ có nhiệm vụ riêng ở vòng hai. Mọi người còn lại không được biết đó là ai."*

### Vòng 1 · Ghi sổ (39–45 phút, 6 phút)

**Làm:** hiện từng giao dịch, đọc chậm, chờ khoảng 30 giây giữa mỗi giao dịch:

1. Trường A cấp chứng chỉ số 1 cho Lan.
2. Trường A cấp chứng chỉ số 2 cho Minh.
3. Trường B cấp chứng chỉ số 3 cho An.
4. Trường A cấp chứng chỉ số 4 cho Hà.
5. Trường B cấp chứng chỉ số 5 cho Bình.
6. Trường A cấp chứng chỉ số 6 cho Chi.

**Lưu ý:** đi kiểm tra vài nhóm xem cột Dấu nối có được điền đúng không. Đây là chỗ sinh viên hay quên.

### Vòng 2 · Có kẻ gian (45–51 phút, 6 phút)

> *"Bây giờ đến vòng hai. Bạn nào bốc được mẩu 'kẻ gian', bạn hãy lén sửa dòng số 2 trên tờ của mình, ví dụ đổi tên người nhận từ Minh thành một tên khác, rồi sửa luôn dấu nối cho có vẻ hợp lệ. Sau đó bạn tuyên bố với nhóm: 'Tờ của tôi mới đúng.' Bốn người còn lại, các bạn không được xem tờ của nhau ngay. Nhiệm vụ của các bạn là tìm cách xác định tờ nào là bản chuẩn."*

**Hướng dẫn nhóm (nếu bí):** đối chiếu từng dòng của bốn tờ với nhau, tờ nào lệch so với đa số thì nghi ngờ. Cuối cùng biểu quyết bằng cách giơ tay.

**Sinh viên ghi lại:** cả nhóm phát hiện ra bằng cách nào, mất bao lâu.

**Điều bạn cần quan sát:** nhiều nhóm sẽ phát hiện nhanh vì **4 bản giống nhau và 1 bản khác**. Đó là sức mạnh của việc nhiều bản sao.

### Vòng 3 · Nới điều kiện (51–54 phút, 3 phút)

> *"Bây giờ mình đổi luật. Giả sử có 3 trong 5 người cùng thông đồng và cùng sửa dòng số 2 giống nhau. Chuyện gì xảy ra khi biểu quyết?"*

Đáp án mong đợi: **3 bản giống nhau thắng 2 bản còn lại, sổ giả trở thành sổ chuẩn.** Đây chính là "tấn công 51%" trong blockchain thật.

**Yêu cầu:** mỗi nhóm ghi ba nhận xét lên một tờ giấy: về **độ an toàn**, về **chi phí** (5 người cùng chép một dòng, tốn công hơn 1 người chép 5 lần), và về **ai thật sự cần một cuốn sổ như vậy**.

**Lời chốt (1 phút, nếu còn thời gian):**

> *"Các bạn vừa tự làm một phép cân nhắc: sổ nhiều bản an toàn hơn, nhưng tốn công hơn. Điều này sẽ quay lại ở phần cuối, khi các bạn phải quyết định blockchain có đáng dùng không."*

**Nếu thiếu giờ:** cắt Vòng 1 xuống 4 giao dịch; vẫn giữ trọn Vòng 2 và Vòng 3.

---

## 7. Giảng 2: ứng dụng trong giáo dục và bằng chứng (54–68 phút)

**Mục tiêu:** nối cơ chế với giáo dục, và đặt kỳ vọng đúng về bằng chứng.

### 54–60 phút · Ví dụ chứng chỉ có "dấu vân tay"

> *"Quay lại tấm bằng ở đầu buổi. Cách dùng phổ biến nhất trong giáo dục gọi là neo mã băm. Nó hoạt động thế này: trường cấp chứng chỉ, tính dấu vân tay của chứng chỉ, rồi ghi chỉ cái dấu vân tay đó lên một bảng thông báo công cộng mà không ai tẩy xoá được. Tệp chứng chỉ thì đưa cho sinh viên giữ."*

**Làm:** hiện sơ đồ bốn bước. Sau đó thực hiện trực tiếp trên thẻ **Xác minh chứng chỉ**: đóng vai nhà tuyển dụng.

> *"Bây giờ mình là nhà tuyển dụng. Sinh viên gửi cho mình tệp này. Mình tự tính dấu vân tay rồi so với bảng công khai. Khớp. Vậy tệp này chưa bị sửa. Còn nếu mình đổi điểm từ 8,5 thành 8,6..."* (làm thao tác) *"...không khớp. Và mình không cần gọi điện hỏi trường."*

**Hỏi:** *"Các bạn thấy trên bảng công khai có tên hay điểm của sinh viên không?"* Đáp án: không, chỉ có dấu vân tay. **Nhấn mạnh:** đây là nguyên tắc thiết kế quan trọng, sẽ giải thích lý do ở phần giảng 3.

### 60–65 phút · Các ứng dụng và ví dụ thật

**Làm:** hiện bảng "Năm nhóm ứng dụng". Đọc kỹ cột "Mức độ".

> *"Các bạn để ý cột cuối. Chỉ có một nhóm thật sự đã được dùng thật, đó là chứng chỉ. Những nhóm còn lại đang thí điểm, hoặc mới là ý tưởng."*

Kể hai ví dụ, mỗi ví dụ dưới 1 phút:
- **MIT năm 2017:** phối hợp với một công ty phần mềm thí điểm văn bằng số dựa trên blockchain của Bitcoin, theo chuẩn mở Blockcerts. Nhóm đầu tiên 111 cựu sinh viên nhận văn bằng trên điện thoại. Người hào hứng nhất là sinh viên quốc tế, vì họ cần bằng chứng tốt nghiệp mà nước mình chấp nhận.
- **Liên minh châu Âu:** xây hạ tầng EBSI, có riêng tình huống dùng cho văn bằng, để sinh viên chuyển giữa các nước châu Âu chứng minh bằng cấp nhanh hơn.

### 65–68 phút · Bằng chứng: ta thật sự biết gì

> *"Khi ai đó nói công nghệ này hiệu quả, mình khuyên các bạn tách thành ba câu hỏi nhỏ. Một: làm được về kỹ thuật không? Có, MIT và châu Âu đã chứng minh. Hai: có rẻ hoặc tiện hơn cách cũ không? Chưa rõ, rất ít báo cáo so sánh trung thực. Ba: có giúp học tốt hơn không? Gần như chưa có nghiên cứu nào đo. Vì vậy, blockchain hiện giúp làm hồ sơ và xác minh tiện hơn, chứ chưa được chứng minh là giúp học tốt hơn."*

**Hỏi nhanh (1 phút):** *"Ở Bài 1.3 mình có học khung PICRAT. Blockchain chứng chỉ nằm ở ô nào?"* Đáp án gợi ý: ô **Thay thế** (thay hồ sơ giấy bằng hồ sơ số), chưa phải **Chuyển hoá**. Nếu lớp chưa nhớ khung này, bỏ qua câu hỏi.

---

## 8. Nghỉ giải lao (68–73 phút)

**Làm:** hiện đồng hồ đếm ngược 5 phút. Trong lúc nghỉ, chuẩn bị hoạt động hội đồng: đặt 6 thẻ đề xuất úp xuống bàn của bạn, sẵn sàng để đại diện nhóm bốc thăm sau giờ nghỉ.

---

## 9. Giảng 3: ba giới hạn (73–83 phút)

**Mục tiêu:** sinh viên thấy được mặt trái của blockchain, và nắm bộ năm câu hỏi để dùng ngay trong hoạt động sau.

### 73–77 phút · Giới hạn 1 và 2

> *"Giới hạn thứ nhất. Mình quay lại hiểu nhầm lúc nãy. Cô giáo vụ nhập nhầm điểm của một sinh viên từ 7 thành 9, rồi ghi lên blockchain. Chuyện gì xảy ra? Chuỗi giữ nguyên con số 9 mãi mãi, và không ai tự động phát hiện ra lỗi. Vì vậy, sự an toàn thật sự của chứng chỉ đến từ quy trình cấp cẩn thận, không phải từ blockchain."*

> *"Giới hạn thứ hai. Mình có một câu hỏi: nếu bạn viết tên mình lên bảng bằng loại mực không thể tẩy, và sau này bạn muốn xoá thì sao? Không xoá được. Blockchain cũng vậy. Nhưng theo pháp luật, người học có quyền yêu cầu xoá hoặc sửa dữ liệu cá nhân của mình. Luật Bảo vệ dữ liệu cá nhân số 91 năm 2025 còn có riêng Điều 30 nói về xử lý dữ liệu trong môi trường blockchain. Vì vậy quy tắc thiết kế là: không bao giờ đưa dữ liệu cá nhân lên blockchain. Chỉ đưa dấu vân tay, còn nội dung để ở nơi có thể xoá."*

**Nhắc lại:** đây là lý do bảng công khai ở phần trước chỉ có dấu vân tay.

### 77–79 phút · Giới hạn 3

> *"Giới hạn thứ ba là chi phí và vận hành. Ai chạy các máy giữ sổ? Ai trả tiền? Và nếu sinh viên làm mất chìa khoá số của mình thì sao? Giống như làm mất chìa khoá két sắt, chứng chỉ trên blockchain mà chủ nhân không mở lại được thì vô dụng. Cơ sở dữ liệu thông thường không có rủi ro này, vì quản trị viên cấp lại được mật khẩu."*

**Lưu ý nhỏ (nói nếu có sinh viên hỏi về tiền mã hoá):** Luật Công nghiệp công nghệ số số 71 năm 2025, có hiệu lực từ 01/01/2026, đưa tài sản số vào khung pháp lý riêng. Chứng chỉ giáo dục không phải tài sản số theo nghĩa đó, nên đừng gộp hai chuyện.

### 79–83 phút · Bộ năm câu hỏi

**Làm:** hiện sơ đồ năm câu hỏi. Đọc từng câu, kèm gợi ý kết luận bên phải.

> *"Đây là công cụ quan trọng nhất của buổi hôm nay. Trước khi chọn blockchain, hãy hỏi năm câu này. Câu một, có cần một cuốn sổ chung để nhiều người cùng xem không? Câu hai, có nhiều bên khác nhau cùng ghi vào sổ không? Câu ba, các bên có thiếu tin nhau và không có ai đủ đáng tin làm trọng tài không? Câu bốn, có cần chặn cả việc chính người giữ sổ lén sửa lịch sử không? Câu năm, dữ liệu có nhạy cảm hoặc phải xoá được không?"*

**Ví dụ minh hoạ, đọc ngay:**

> *"Ví dụ: một trường tự lưu bảng điểm của chính mình, chỉ giáo vụ nhập, và ai cũng tin nhà trường. Câu hai cho thấy chỉ có một bên ghi. Câu ba cho thấy đã có bên đáng tin. Kết luận: dùng cơ sở dữ liệu thông thường là đủ. Dùng blockchain chỉ tốn kém mà không thêm lợi ích."*

> *"Một bài toán chỉ thật sự xứng với blockchain khi bạn trả lời có cho cả bốn câu đầu, và có cách xử lý câu năm. Rất nhiều bài toán giáo dục dừng ở câu hai hoặc câu ba. Điều đó không có nghĩa là bạn làm sai, mà là bạn thẩm định đúng."*

---

## 10. Hoạt động nhóm: Hội đồng thẩm định (83–110 phút)

**Mục tiêu:** sinh viên vận dụng năm câu hỏi vào một đề xuất cụ thể, và bảo vệ kết luận trước lớp.

### 83–86 phút · Giao nhiệm vụ

> *"Mỗi nhóm bây giờ là hội đồng thẩm định của một sở giáo dục. Một nhà cung cấp đến đề xuất dùng blockchain cho một việc cụ thể. Nhóm phải quyết định có nên đồng ý không. Đại diện nhóm lên bốc thăm một đề xuất."*

**Sáu thẻ đề xuất:**
1. Văn bằng số của một trường đại học.
2. Huy hiệu số do nhiều trung tâm đào tạo cùng cấp.
3. Học bạ chuyển giữa các trường phổ thông trong tỉnh.
4. Chia tiền bản quyền học liệu cho giáo viên tạo nội dung.
5. Lưu vết đề thi, bài làm và điểm của một kỳ thi tuyển sinh.
6. Quỹ học bổng minh bạch giữa nhà tài trợ, nhà trường và sinh viên.

**Nếu nhiều hơn 6 nhóm:** hai nhóm có thể cùng bốc một đề, và khi điều trần thì so sánh kết luận của hai nhóm.

**Hiện nhiệm vụ lên màn hình:**
- **10 phút, thẩm định:** trả lời năm câu (có / không / chưa rõ, kèm lý do). Xác định: ai ghi, ai đọc, có bên trọng tài nào không.
- **6 phút, phương án thay thế:** nêu ít nhất một cách không dùng blockchain và so trên ba tiêu chí: chi phí, độ tin cậy với người ngoài, bảo vệ dữ liệu cá nhân.
- **3 phút, quyết định:** Dùng / Không dùng / Dùng có điều kiện, kèm một chỉ số đo được sau 12 tháng (chỉ số về xác minh hoặc học tập, không phải số người dùng).

### 86–99 phút · Nhóm làm việc

**Làm:** đi quanh các nhóm, mỗi nhóm dừng khoảng 2 phút. Dùng các câu hỏi gợi mở dưới đây khi nhóm bí hoặc làm qua loa.

- *"Ai là người ghi vào sổ ở đề xuất này? Có nhiều bên khác nhau không, hay chỉ một?"*
- *"Nếu bỏ blockchain đi và dùng một cơ sở dữ liệu thường, điều gì tệ đi?"*
- *"Dữ liệu ở đây có phải dữ liệu cá nhân không? Nếu có thì đưa lên blockchain, người học yêu cầu xoá thì sao?"*
- *"Chỉ số của nhóm đo được cái gì? Nó nói lên việc học hay chỉ nói lên tăng trưởng?"*

**Nhắc giờ:** 10 phút đầu xong (phút 96), nhắc chuyển sang phương án thay thế; phút 102 nhắc chốt quyết định.

### 99–110 phút · Điều trần

> *"Mình mời bốn nhóm lên điều trần, mỗi nhóm 90 giây trình bày. Các nhóm còn lại đóng vai nhà cung cấp, mỗi nhóm được hỏi 30 giây. Hãy tập trung hỏi vào câu ba và câu năm."*

**Chọn nhóm điều trần:** chọn các nhóm có kết luận khác nhau để lớp thấy sự đa dạng. Nếu có nhóm nào kết luận "Dùng" một cách quá dễ dãi, gọi nhóm đó lên để cả lớp chất vấn.

**Gợi ý câu chất vấn nếu lớp im lặng:**
- *"Nhóm nói dùng blockchain, vậy nếu sinh viên làm mất chìa khoá số thì sao?"*
- *"Nhóm nói không dùng, vậy làm sao người ngoài kiểm tra được mà không phải tin vào trường?"*
- *"Chỉ số 12 tháng của nhóm nếu không đạt thì kết luận là gì?"*

### Đáp án tham khảo cho 6 đề xuất (để bạn nhận xét, không đọc trước cho sinh viên)

Mỗi đề xuất đều **không có một đáp án duy nhất**. Điều bạn chấm là lập luận. Đây là hướng gợi ý:

| Đề xuất | Hướng kết luận hợp lý | Lập luận cốt lõi |
|---|---|---|
| 1. Văn bằng số một trường | **Dùng có điều kiện** | Chỉ neo mã băm, dữ liệu ở ngoài. Lợi ích là xác minh độc lập, kể cả khi trường đóng cửa. Nếu chỉ cần nội bộ thì cơ sở dữ liệu và chữ ký số đã đủ. Đây là nhóm chín nhất. |
| 2. Huy hiệu nhiều trung tâm | **Dùng có điều kiện** | Nhiều bên cùng cấp, thiếu một trọng tài chung, nên câu 2 và 3 đều có. Cần thống nhất chuẩn huy hiệu; một hiệp hội có thể vận hành thay thế. |
| 3. Học bạ trong tỉnh | **Không dùng** | Đã có Sở Giáo dục làm bên đáng tin (câu 3 trả lời không). Dữ liệu học sinh là dữ liệu trẻ em, rất nhạy cảm (câu 5). Cơ sở dữ liệu ngành là phù hợp. |
| 4. Chia bản quyền học liệu | **Không dùng, hoặc thử nghiệm nhỏ** | Thường có sẵn một nền tảng trung gian làm được việc chia tiền. Bằng chứng còn rất mỏng. |
| 5. Lưu vết đề thi, bài làm, điểm | **Dùng có điều kiện** (chỉ neo mã băm định kỳ) | Đề thi phải bí mật, bài làm là dữ liệu cá nhân, nên không thể đưa nội dung lên chuỗi. Nhưng neo dấu vân tay của nhật ký để chứng minh không sửa điểm sau kỳ thi là hợp lý. |
| 6. Quỹ học bổng minh bạch | **Không dùng, hoặc dùng có điều kiện** | Nhiều bên, nhu cầu minh bạch cao. Nhưng công bố sổ sách công khai kèm kiểm toán độc lập có thể đạt mục tiêu rẻ hơn. Cần cân nhắc dữ liệu người nhận học bổng. |

**Nhận xét mẫu cho nhóm làm tốt:**

> *"Nhóm đã không chọn blockchain chỉ vì nó hiện đại. Nhóm chạy đủ năm câu, nêu được phương án thay thế, và chỉ số 12 tháng nói về việc xác minh chứ không phải số người dùng. Đó chính là cách người làm công nghệ giáo dục chuyên nghiệp thẩm định một đề xuất."*

**Chấm nhóm (10 điểm):** trả lời đúng và có lý do cho cả năm câu (3đ) · phương án thay thế cụ thể, so ba tiêu chí (2đ) · nhận ra rủi ro dữ liệu cá nhân, nêu đúng nguyên tắc "chỉ ghi dấu vân tay" (2đ) · quyết định gắn với chỉ số đo được sau 12 tháng (2đ) · trả lời chất vấn có lập luận (1đ).

---

## 11. Tổng kết và phiếu ra cửa (110–120 phút)

### 110–112 phút · Nhắc lại thông điệp

> *"Chúng ta đã đi một vòng từ cuốn sổ quỹ lớp đến hội đồng thẩm định. Mình muốn các bạn mang về ba điều. Một: blockchain là cuốn sổ nhiều người cùng giữ, mỗi trang mang dấu vân tay của trang trước, nên rất khó sửa lén. Hai: nó chỉ bảo đảm không bị sửa lén, chứ không bảo đảm đúng, và dữ liệu cá nhân không bao giờ nên nằm trên đó. Ba: trước khi chọn blockchain, luôn hỏi năm câu, vì rất nhiều bài toán không cần nó."*

### 112–117 phút · Phiếu ra cửa (cá nhân)

> *"Các bạn lấy lại tờ giấy lúc khởi động. Trong năm phút, viết hai điều. Thứ nhất, trong ba tình huống A, B, C, tình huống nào blockchain thật sự cải thiện được, và cải thiện ở chỗ nào. Thứ hai, một điều bạn tin trước buổi học mà bây giờ bạn đã thay đổi."*

**Đáp án mong đợi cho điều thứ nhất:** tình huống **A** (tệp PDF gửi qua email) là chỗ blockchain cải thiện rõ nhất, vì nó cho phép người nhận tự kiểm tra tệp mà không cần hỏi trường. Tình huống B đã có trang tra cứu của trường, blockchain chỉ giúp thêm nếu trường đóng cửa. Tình huống C (công chứng) blockchain không thay được vai trò pháp lý.

### 117–120 phút · Đọc phiếu và giao bài tập

**Làm:** gọi 3 sinh viên ngẫu nhiên đọc phiếu của mình. Sau đó giao bài tập về nhà.

> *"Bài tập về nhà là dựng một Cổng xác minh chứng chỉ đơn giản cho một trường giả định, kèm một phiếu thẩm định một trang. Có hai tuyến. Tuyến A không cần lập trình, dùng công cụ SHA-256 trực tuyến và bảng tính. Tuyến B tự viết trang HTML, được cộng thêm điểm. Hướng dẫn từng bước nằm trong bài trên hệ thống. Cảm ơn cả lớp."*

---

## 12. Kế hoạch dự phòng

| Sự cố | Cách xử lý |
|---|---|
| Mạng chậm hoặc học liệu không mở | Chiếu màn hình của bạn, sinh viên xem theo nhóm 2–3 người. Học liệu đã tải xong thì chạy được không cần mạng; hãy mở sẵn từ trước buổi học. |
| Sinh viên dùng điện thoại, màn hình nhỏ | Vẫn dùng được, nhưng khuyến khích ghép cặp để một người có laptop. |
| Đang chạy chậm quá 5 phút | Cắt Vòng 1 của sổ cái xuống 4 giao dịch. Nếu vẫn chậm, rút ngắn phần điều trần từ 4 nhóm xuống 3 nhóm. |
| Lớp ít (dưới 15 người) | Chia nhóm 3–4 người; sổ cái giữ nguyên nhưng Vòng 3 đổi thành "2 trong 3 người thông đồng". |
| Lớp đông (trên 40 người) | Nhóm 6 người, hoặc để hai nhóm cùng bốc một đề và so sánh khi điều trần. |
| Sinh viên hỏi về Bitcoin, tiền mã hoá, đầu tư | Ghi nhận và trả lời ngắn: *"Đó là một ứng dụng khác của blockchain. Hôm nay mình tập trung vào giáo dục. Bạn quan tâm thì sau buổi học mình trao đổi thêm."* Không đi sâu, vì bài không dạy về đầu tư. |
| Nhóm kết luận "Dùng" quá dễ dãi | Hỏi: *"Bỏ blockchain đi thì cái gì tệ đi?"* Nếu không trả lời được, đó là dấu hiệu chưa cần. |
| Không khí lớp trầm | Trong Giảng 1, dừng lại và cho cặp đôi trao đổi 30 giây trước khi gọi trả lời. |

**Nếu chỉ còn 100 phút:** giữ nguyên khởi động, giảng 1, hoạt động cá nhân, hội đồng thẩm định, tổng kết. Cắt sổ cái người thật (giao về nhà như bài đọc thêm) và rút gọn giảng 2.

---

## 13. Sau buổi học

- [ ] Ghi lại 3 điều sinh viên hiểu nhầm nhiều nhất trong hội đồng thẩm định. Đây là nguyên liệu để chỉnh câu hỏi trong bài kiểm tra 9 câu và các mẫu phản hồi.
- [ ] Đối chiếu phiếu ra cửa: bao nhiêu phần trăm sinh viên trả lời đúng ý về tình huống A? Nếu dưới một nửa, cần dành thêm thời gian cho sơ đồ bốn bước ở lần dạy sau.
- [ ] Nhắc sinh viên làm bài kiểm tra của Bài 4.7 trên hệ thống và nộp bài tập về nhà đúng hạn.
- [ ] Ghi chú thời gian thực tế của từng hoạt động (nhất là sổ cái và hội đồng) để chỉnh kịch bản lần sau.

---

## 14. Phụ lục: những câu hỏi sinh viên hay hỏi, và cách trả lời

**"Blockchain có an toàn tuyệt đối không?"**
> *"Không có gì an toàn tuyệt đối. Nếu phần lớn các bên giữ sổ thông đồng, họ vẫn có thể gian lận, như các bạn đã thấy ở Vòng 3. Và blockchain không kiểm tra dữ liệu đúng hay sai lúc ghi."*

**"Tại sao không dùng cơ sở dữ liệu thông thường cho nhanh?"**
> *"Câu hỏi rất hay, và đó chính là câu hỏi mình muốn các bạn tự hỏi trong hoạt động hội đồng. Trong rất nhiều trường hợp, cơ sở dữ liệu thông thường là lựa chọn đúng."*

**"Đào khối là gì? Có phải đào tiền không?"**
> *"Trong mô phỏng, 'đào' nghĩa là máy thử rất nhiều con số cho đến khi mã băm của khối bắt đầu bằng bốn số 0. Việc này tốn công tính toán có chủ ý, để kẻ gian muốn sửa cũng phải tốn công tương ứng. Trong Bitcoin, người đào được thưởng tiền, nhưng ở đây chúng ta chỉ dùng phần tốn công đó."*

**"Vậy mình có nên học blockchain để đi làm không?"**
> *"Điều đáng học không phải là một công cụ cụ thể, mà là cách thẩm định. Công nghệ đổi nhanh, nhưng khả năng đặt đúng câu hỏi trước khi chọn công nghệ thì dùng lại được cho mọi thứ."*

**"Chứng chỉ trên blockchain có giá trị pháp lý thay bằng giấy không?"**
> *"Tuỳ quy định của từng nước và từng cơ quan. Ở Việt Nam, hãy kiểm tra quy định hiện hành về văn bằng chứng chỉ số trước khi cam kết với bất kỳ ai. Blockchain giúp chứng minh tệp chưa bị sửa, còn giá trị pháp lý là một câu chuyện riêng."*

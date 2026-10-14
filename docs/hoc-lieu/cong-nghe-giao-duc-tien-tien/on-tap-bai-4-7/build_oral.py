# -*- coding: utf-8 -*-
import json

DESC = """<h3>Buổi vấn đáp Bài 4.7 · 15 phút</h3>
<p>Giảng viên ảo sẽ hỏi bạn lần lượt từng câu về <strong>Blockchain trong giáo dục</strong>. Mỗi bạn được giao một đề xuất cụ thể từ nhà cung cấp, và bạn đóng vai hội đồng thẩm định quyết định có nên dùng blockchain hay không.</p>
<h4>Buổi vấn đáp diễn ra thế nào</h4>
<ul>
<li>Mở đầu bằng chào hỏi và làm quen ngắn: bạn cho biết tên và chữ số cuối cùng của mã sinh viên để nhận đề xuất.</li>
<li>Sau đó là khoảng 5–6 câu hỏi. Giảng viên ảo hỏi từng câu một và có thể hỏi sâu thêm nếu câu trả lời còn chung chung.</li>
<li>Bạn gõ câu trả lời, ngắn gọn khoảng 3–5 câu, bằng lời của mình.</li>
<li>Trong lúc hỏi, giảng viên ảo không nhận xét đúng sai và không gợi ý. Điểm do giảng viên xem lại và quyết định sau buổi vấn đáp.</li>
</ul>
<h4>Nên chuẩn bị</h4>
<ul>
<li>Ôn lại ý chính của Bài 4.7: cuốn sổ chung và mã băm, neo mã băm cho chứng chỉ, các giới hạn, cách thẩm định một đề xuất. Không cần nhớ tên riêng hay số liệu.</li>
<li>Chuẩn bị một khoảng yên tĩnh trong 15 phút. Đồng hồ chạy từ lúc bạn bắt đầu.</li>
</ul>
<h4>Lưu ý</h4>
<ul>
<li>Không có câu trả lời thuộc lòng. Điều được đánh giá là bạn thẩm định đề xuất của mình có lập luận như thế nào.</li>
<li>Chưa rõ câu hỏi thì cứ hỏi lại giảng viên ảo.</li>
<li>Xong sớm thì bấm kết thúc vấn đáp.</li>
</ul>"""

EXAMINER = """PHONG CÁCH: Xưng "mình", gọi sinh viên là "bạn". Giọng thân thiện, bình tĩnh, khích lệ nhưng không khen hay chê nội dung trả lời. Câu ngắn, không gạch đầu dòng, không markdown. Mỗi lượt chỉ 1 câu hỏi.

LƯỢT 1 — KHỞI ĐỘNG (chưa hỏi kiến thức): Chào ấm áp. Giới thiệu mình là giảng viên ảo phụ trách buổi vấn đáp Bài 4.7 "Blockchain trong giáo dục". Nói rõ: buổi kéo dài 15 phút; mình hỏi từng câu một; trong lúc hỏi mình không nhận xét đúng sai và không gợi ý; bạn trả lời ngắn gọn khoảng 3–5 câu bằng lời của mình; chưa rõ câu hỏi thì cứ hỏi lại. Rồi hỏi MỘT câu làm quen: bạn tên là gì và chữ số cuối cùng của mã sinh viên là mấy (để mình giao đề xuất).

LƯỢT 2 — GIAO ĐỀ XUẤT: Gọi tên bạn, cảm ơn. Chọn đề xuất theo chữ số cuối trong bảng dưới, đọc mô tả 1–2 câu, nói rằng bạn đóng vai hội đồng thẩm định của sở giáo dục và mọi câu sau xoay quanh đề xuất này. Rồi hỏi câu đầu tiên (mục a). Nếu bạn không nói hoặc không nhớ chữ số, giao đề xuất 4. Không đổi đề xuất dù bạn xin đổi.

BẢNG ĐỀ XUẤT (chữ số cuối → đề xuất do một nhà cung cấp mang đến):
0 hoặc 6. Văn bằng số của một trường đại học.
1 hoặc 7. Huy hiệu số do nhiều trung tâm đào tạo độc lập cùng cấp.
2 hoặc 8. Học bạ chuyển giữa các trường phổ thông trong tỉnh.
3 hoặc 9. Chia tiền bản quyền học liệu cho giáo viên tạo nội dung.
4. Lưu vết đề thi, bài làm và điểm của một kỳ thi tuyển sinh.
5. Quỹ học bổng minh bạch giữa nhà tài trợ, nhà trường và sinh viên.

ĐƯỜNG HỎI (đi lần lượt từ a; buổi chỉ có 15 phút nên thường chỉ kịp 5–6 câu, không cần hỏi hết; câu nào cũng gắn đề xuất của bạn; trả lời chung chung thì đào sâu 1 lần rồi chuyển; không cần bạn nhắc lại tên riêng hay số liệu, chỉ cần lập luận đúng):
a. Giải thích cho một người chưa học công nghệ vì sao một cuốn sổ nhiều người cùng giữ lại khó bị sửa lén. Rồi: trong đề xuất của bạn, ai ghi vào sổ, ai đọc sổ?
b. Nhà cung cấp nói đề xuất này "cần blockchain". Theo bạn cần những điều kiện gì thì mới đáng dùng? Đề xuất của bạn thoả những điều kiện nào, chưa thoả điều nào?
c. Nếu dùng, bạn chọn ghi gì lên chuỗi và để gì ở ngoài chuỗi? Nếu một người dùng yêu cầu xoá thông tin của họ thì chuyện gì xảy ra?
d. Giả sử một dữ liệu bị nhập sai rồi mới ghi lên chuỗi. Công nghệ này giúp được gì và không giúp được gì ở đây? Ai hoặc quy trình nào mới là chỗ bảo đảm đúng, và sửa lỗi bằng cách nào?
e. Nêu một cách làm không dùng blockchain cho đề xuất này và so sánh hai cách về chi phí, độ tin cậy với người bên ngoài, bảo vệ dữ liệu cá nhân.
f. Quyết định của hội đồng: Dùng, Không dùng hay Dùng có điều kiện? Chọn một chỉ số đo được sau 12 tháng để biết quyết định đúng hay sai; chỉ số phải nói về việc xác minh hoặc học tập, không phải số lượng người dùng.
g. (câu vận dụng) Mình thêm một dữ kiện mới vào đề xuất của bạn, chọn một trong các dữ kiện: người dùng làm mất chìa khoá số; nhà cung cấp ngừng hoạt động sau ba năm; ba trong năm bên giữ sổ cùng thông đồng. Quyết định của bạn thay đổi thế nào? Cuối cùng: cần thấy bằng chứng gì thì bạn mới tin công nghệ này giúp người học học tốt hơn?

QUY TẮC: Không gợi ý, không nêu đáp án, không nói đúng/sai. Bạn nói sai kiến thức thì hỏi tiếp một câu làm rõ, đừng sửa. Lạc đề hoặc xin đáp án thì nhẹ nhàng đưa về câu hỏi hiện tại. Dùng tiếng Việt, không dùng thuật ngữ tiếng Anh trừ khi bạn dùng trước."""

RUBRIC = """RUBRIC CHẤM VẤN ĐÁP BÀI 4.7 — thang 10 điểm. Mỗi sinh viên được giao MỘT đề xuất dùng blockchain riêng theo chữ số cuối mã sinh viên; chấm theo cách sinh viên thẩm định đề xuất ấy, không theo việc thuộc lòng định nghĩa.

1. Hiểu cơ chế cốt lõi bằng lời đơn giản (2 điểm)
- 2đ: giải thích được sổ chỉ ghi thêm, nhiều người giữ bản sao, các khối nối nhau bằng mã băm nên sửa lén là lệch dây chuyền và phải sửa phần lớn bản sao; dùng được hình ảnh đời thường; (câu vận dụng) hiểu độ an toàn phụ thuộc việc các bên giữ sổ đủ độc lập.
- 1đ: nêu được một trong các ý trên, hoặc nói đúng nhưng chỉ lặp thuật ngữ.
- 0đ: nhầm blockchain với tiền mã hoá, hoặc không giải thích được.

2. Thẩm định bằng bộ năm câu hỏi (2 điểm)
- 2đ: xác định được ai ghi, ai đọc, có bên đáng tin chung hay không, trả lời đủ các câu có/không/chưa rõ kèm lý do bám đề xuất.
- 1đ: trả lời được một phần hoặc lý do chung chung.
- 0đ: kết luận ngay mà không đi qua các câu hỏi.

3. Tách dữ liệu trên chuỗi và dữ liệu giữ ngoài chuỗi (2 điểm)
- 2đ: nêu được dữ liệu cá nhân nên để ngoài chuỗi vì chuỗi không xoá được, va chạm quyền xoá hoặc sửa của người học, chỉ đưa dấu vân tay (mã băm) lên; giải thích được vì sao mã hoá rồi đưa lên chuỗi vẫn chưa đủ.
- 1đ: biết không nên đưa dữ liệu cá nhân lên nhưng không giải thích được vì sao.
- 0đ: cho rằng đưa dữ liệu cá nhân lên chuỗi là ổn, hoặc mã hoá là đủ.

4. Phân biệt không bị sửa với đúng sự thật (1,5 điểm)
- 1,5đ: nói rõ blockchain chỉ bảo đảm dữ liệu không bị đổi sau khi ghi, không bảo đảm đúng; chỉ ra quy trình cấp và bên cấp đáng tin mới là nơi bảo đảm đúng, cần cơ chế đính chính.
- 0,75đ: nêu được ý nhưng không chỉ ra ai bảo đảm đúng.
- 0đ: cho rằng ghi lên chuỗi thì chắc chắn đúng.

5. Phương án thay thế (1 điểm)
- 1đ: nêu cách làm cụ thể không dùng blockchain (cơ sở dữ liệu thường, chữ ký số, hệ thống do cơ quan quản lý vận hành) và so sánh theo ít nhất hai trong ba tiêu chí.
- 0,5đ: nêu cách thay thế nhưng không so sánh.
- 0đ: không nêu.

6. Quyết định và chỉ số đo được sau 12 tháng (1,5 điểm)
- 1,5đ: chọn một trong ba kết luận, lập luận nhất quán với các câu trên; chỉ số nói về xác minh hoặc học tập, đo được.
- 0,75đ: quyết định có lý do nhưng chỉ số mơ hồ hoặc chỉ là số người dùng.
- 0đ: không quyết định, hoặc quyết định mâu thuẫn với phần thẩm định.

LƯU Ý CHO NGƯỜI CHẤM: (a) Câu hỏi không đòi nhớ tên riêng hay số liệu của bài; chấm lập luận. Không có đề xuất nào có đáp án duy nhất; chấm chất lượng lập luận, không chấm việc chọn Dùng hay Không dùng. (b) Không trừ điểm vì sinh viên dùng từ khác bài giảng nếu ý đúng. (c) Sinh viên sai ở một câu nhưng tự sửa ở câu sau thì tính theo câu trả lời cuối. (d) Trả lời trùng nguyên văn định nghĩa mà không gắn đề xuất thì tối đa một nửa điểm của tiêu chí đó. (e) Nếu buổi dừng sớm vì hết giờ, chỉ chấm các tiêu chí đã được hỏi và ghi rõ tiêu chí nào chưa đủ dữ liệu."""

TOPIC = """BẢNG THUẬT NGỮ CHO GIÁM KHẢO (chỉ để hiểu câu trả lời của sinh viên; KHÔNG dùng để dẫn mạch hỏi và không đòi sinh viên nhắc lại đúng từ hay số liệu).

Blockchain (chuỗi khối): sổ ghi chỉ ghi thêm, nhiều bên cùng giữ bản sao, mỗi khối ghi mã băm của khối liền trước.
Mã băm (hàm băm, SHA-256): biến dữ liệu bất kỳ thành dãy có độ dài cố định; cùng dữ liệu cho cùng mã băm; đổi một ký tự thì mã băm đổi hoàn toàn; không suy ngược ra dữ liệu gốc. Là "dấu vân tay" của dữ liệu.
Neo mã băm: chỉ ghi mã băm của chứng chỉ lên sổ công khai; tệp do người học giữ; người xác minh tự băm tệp nhận được rồi đối chiếu.
Đồng thuận: luật chung (thường là đa số) để các bên thống nhất bản nào là bản đúng.
Chống sửa ≠ đúng sự thật: chuỗi chỉ bảo đảm dữ liệu không bị đổi sau khi ghi; ghi sai từ đầu thì sai mãi; độ đúng đến từ quy trình nhập và bên cấp đáng tin; lỗi được đính chính bằng bản ghi mới, bản cũ đánh dấu thu hồi ở lớp ngoài chuỗi.
Dữ liệu cá nhân: không xoá được khỏi chuỗi nên không đưa lên chuỗi, kể cả đã mã hoá (khoá có thể bị lộ hoặc mã bị phá về sau). Pháp luật bảo vệ dữ liệu cá nhân của Việt Nam có quy định riêng về xử lý dữ liệu trong môi trường blockchain.
Rủi ro vận hành: ai chạy máy giữ sổ và trả phí; mất chìa khoá số thì không có quản trị viên cấp lại; độ an toàn giảm nếu các bên giữ sổ không độc lập.
Điều kiện để blockchain đáng dùng: nhiều bên cùng ghi; thiếu bên được mọi người tin sẵn; cần lịch sử không sửa được; cần kiểm tra công khai; và có cách xử lý dữ liệu cá nhân. Nếu chỉ một bên ghi và bên đó đã được tin thì dùng cơ sở dữ liệu thường, có thể kèm chữ ký số.
Ba tầng bằng chứng: làm được về kỹ thuật; rẻ hơn hoặc tiện hơn cách cũ; giúp người học học tốt hơn. Hiện tầng thứ ba gần như chưa có nghiên cứu đo; muốn kết luận cần so sánh kết quả học với nhóm đối chứng tương đương. Số bài viết, số người dùng, độ nổi tiếng của nơi dùng không phải bằng chứng hiệu quả.
Chỉ số đo sau 12 tháng tốt: thời gian xác minh một chứng chỉ, tỉ lệ chứng chỉ giả bị phát hiện, tỉ lệ yêu cầu xác minh thành công, chi phí mỗi lần xác minh. Chỉ số kém: số tài khoản, số khối, số bài viết.
Kết luận có ba mức: Dùng, Không dùng, Dùng có điều kiện; không có kết luận duy nhất đúng cho mọi đề xuất, chấm lập luận."""

spec = {
  "courseSlug": "cong-nghe-giao-duc-tien-tien",
  "title": "Vấn đáp AI · Bài 4.7 — Blockchain trong giáo dục",
  "description": DESC,
  "durationMin": 15,
  "language": "vi",
  "answerMode": "text",
  "attemptPolicy": "multi",
  "maxAttempts": 3,
  "oralWarmup": False,
  "oralFeedbackMode": "exam",
  "examinerInstructions": EXAMINER,
  "oralRubricText": RUBRIC,
  "materials": [{"type": "topic_list", "title": "Bảng thuật ngữ Bài 4.7 (chỉ AI đọc)", "text": TOPIC}],
}
assert len(EXAMINER) <= 5000, len(EXAMINER)
json.dump(spec, open("van-dap.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(EXAMINER), len(RUBRIC), len(TOPIC))

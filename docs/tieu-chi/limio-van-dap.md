# Limio Vấn đáp — làm lại vấn đáp AI, chạy song song bản cũ

Trạng thái: **nháp chờ duyệt** (07/11/2026). Chưa có dòng code nào.

## 1. Vì sao làm lại

Ở vấn đáp AI hiện tại, nội dung câu hỏi do AI tự mò ở từng lượt (3 đoạn tài liệu theo câu trả lời gần nhất), còn thứ tự và phạm vi chỉ nằm trong ô prompt viết tự do nên hệ thống không bảo đảm được. "Chủ đề" có hai nghĩa khác nhau, và thầy/cô không biết trước AI sẽ hỏi gì. Limio Vấn đáp định nghĩa rõ **mỗi đầu vào chỉ có một vai trò** (mục 3).

## 2. Nguyên tắc chạy song song

Bản cũ có thầy/cô đang dùng và đang chuốt prompt, nên:

1. **Không sửa bản cũ.** Không đụng `Exam` có `kind = oral`, các route `oral-*`, `examinerChat.ts`, `evaluation.ts`. Limio Vấn đáp dùng bảng, route, trang và sự kiện riêng.
2. **Chỉ dùng chung hàm không đổi hành vi:** đọc chữ từ tệp, giọng nói (TTS/STT), kiểm hạn mức AI (`assertWithinCaps`, `recordAiUsage`). Sửa mã dùng chung nào thì test của bản cũ phải vẫn xanh.
3. **Có cờ bật theo từng người** (`van_dap.access`, mặc định tắt). Thầy/cô không được bật thì không thấy menu, vào đường dẫn trực tiếp bị từ chối.
4. **Không tự chuyển đề cũ.** Muốn dùng bản mới, thầy/cô bấm "Tạo bản Limio Vấn đáp từ đề này": hệ thống sao chép tài liệu, chủ đề (thành kịch bản) và rubric thành một đề MỚI ở dạng nháp. Đề cũ giữ nguyên, vẫn chạy được. Prompt cũ chỉ hiện bên cạnh để thầy/cô tự rút phần giọng điệu, không tự chép sang vì nó thường chứa lệnh về thứ tự và nội dung.
5. **Mã tham gia riêng** (6 ký tự, bảng riêng), đăng ký vào ô "Nhập mã" của học viên (`joinCode.ts`). Học viên thấy lỗi "chọn" nếu mã trùng loại khác, như hiện nay.

## 3. Hợp đồng đầu vào (quyết định đã chốt, theo phương án đề xuất 1a 2a 3a 4a)

| Thầy/cô nhập | Vai trò duy nhất | Ảnh hưởng đến câu hỏi |
|---|---|---|
| Tài liệu | Nguồn để sinh Dàn câu hỏi | Chỉ dùng lúc soạn đề. Lúc thi AI không tự tìm trong tài liệu |
| Dàn câu hỏi | HỎI GÌ, THỨ TỰ NÀO | 6–12 "ý cần hỏi", mỗi ý có nội dung cốt lõi, đoạn nguồn, mức độ, ý đáp án mong đợi (học viên không thấy), số câu đào sâu tối đa |
| Kịch bản | HỎI TRONG BỐI CẢNH NÀO | Mỗi học viên được giao một kịch bản (chia đều, thi lại ưu tiên kịch bản chưa gặp). Dùng chung một dàn, kịch bản chỉ đổi bối cảnh |
| Phong cách | HỎI THẾ NÀO | Chế độ Thi hoặc Luyện, khởi động, lời kết, độ dài câu, cộng một ô ghi chú giọng điệu tối đa 500 ký tự |
| Rubric | CHẤM THẾ NÀO | Không ảnh hưởng câu hỏi. Chấm theo từng ý trong dàn |
| Câu trả lời của học viên | Đào sâu hay chuyển ý | Tối đa 2 câu đào sâu mỗi ý rồi chuyển. Không đổi được nội dung hay thứ tự của dàn |

Lúc thi, **bộ điều khiển trong code** quyết định lượt tới là hỏi ý kế tiếp, đào sâu, diễn đạt lại, chuyển ý hay kết thúc, dựa trên tiến độ dàn và thời gian còn lại. AI chỉ nhận ý đang hỏi cùng đoạn nguồn của ý đó và viết thành câu hỏi. Ý được xếp theo ưu tiên để hết giờ vẫn phủ được ý quan trọng.

## 4. Lộ trình

| Mốc | Nội dung | Thầy/cô thấy được gì |
|---|---|---|
| 0 | Khung song song: cờ, menu, bảng, trang trống, nút sao chép từ đề cũ | Mục "Limio Vấn đáp" cho người được bật cờ |
| 1 | Dàn câu hỏi: tải tài liệu, AI sinh dàn, sửa dàn, Bản đồ câu hỏi, kịch bản | Soạn đề mới, xem trước AI sẽ hỏi gì |
| 2 | Bộ điều khiển lúc thi, "Thử vấn đáp", phòng thi học viên | Thử và mở buổi thật |
| 3 | Phong cách và ghi chú giọng điệu; chấm và báo cáo theo ý | Chấm theo từng ý, lớp yếu ý nào |
| 4 | Chuyển dần (mục 6) | |

Mỗi mốc xong thì dừng để thầy/cô duyệt rồi mới sang mốc kế.

## 5. Tiêu chí nghiệm thu — Mốc 0 và Mốc 1

### Mốc 0 — khung song song

- **AC0.1** Given giảng viên không có cờ `van_dap.access`, When mở menu hoặc gõ thẳng `/instructor/van-dap`, Then menu không có mục "Limio Vấn đáp" và đường dẫn bị từ chối như các trang bị khoá quyền khác.
- **AC0.2** Given giảng viên có cờ, When mở menu, Then thấy "Limio Vấn đáp"; trang đầu liệt kê đề của mình (rỗng lúc đầu) và có nút "Tạo đề Limio Vấn đáp".
- **AC0.3** Given bất kỳ giảng viên nào, When dùng "Phòng vấn đáp" và mọi đề vấn đáp cũ, Then hành vi y hệt trước đó và toàn bộ test hiện có của vấn đáp cũ vẫn xanh.
- **AC0.4** Given đề vấn đáp cũ có tài liệu, chủ đề và rubric, When giảng viên có cờ chọn đề đó trong mục "Nhập từ đề vấn đáp cũ" ngay trong Limio Vấn đáp (không phải nút trên trang đề cũ, để vẫn dùng được sau khi bản cũ bị tắt), Then có một đề MỚI ở dạng nháp chứa tài liệu, kịch bản (từ chủ đề) và rubric đã sao chép; đề cũ không đổi gì.
- **AC0.5** Given đề được sao chép, When mở màn hình soạn, Then prompt cũ hiện ở khung chỉ đọc bên cạnh để đối chiếu và KHÔNG được chép vào ô ghi chú giọng điệu.
- **AC0.6** Given đề Limio Vấn đáp được mở buổi, When học viên nhập mã 6 ký tự ở ô "Nhập mã", Then được dẫn đúng vào phòng của Limio Vấn đáp; mã trùng loại khác thì hiện màn chọn.
- **AC0.7** Mọi hành động của giảng viên ghi sự kiện `vandap.*` chỉ mang id và số liệu (không mang nội dung tài liệu hay câu hỏi); tiền tố `vandap.` của hành động giảng viên được thêm vào `NON_LEARNER_ACTIVITY_PREFIXES`.
- **AC0.8** Menu mới phải qua test `teacherAssistantFreshness`: hoặc dạy Lily, hoặc ghi lý do vào `MENU_NOT_IN_ASSISTANT` ("đang thử nghiệm, bật theo cờ").

- **AC0.9 (ĐÃ LÀM, 07/11/2026)** Given admin bật "Tắt vấn đáp AI bản cũ" ở /admin/settings, Then toàn hệ thống: không tạo đề vấn đáp mới (từ trang Phòng vấn đáp lẫn từ trang khoá), không thêm/sửa/xoá tài liệu và chủ đề, không mở buổi, không có học viên MỚI vào thi (từ trang khoá lẫn bằng mã tham gia), không "Thử vấn đáp". Mã tham gia hiện "đã đóng". Đề thi viết không bị ảnh hưởng.
- **AC0.10 (ĐÃ LÀM)** Given bản cũ đã tắt, Then vẫn dùng được: xem danh sách đề và kết quả, chấm điểm (kể cả "Chấm bằng AI" cho bài đã nộp), xuất Excel/Word, giám sát, đóng buổi đang mở; học viên đang thi dở vẫn tiếp tục và làm nốt. Gõ thẳng đường dẫn tạo đề thì về danh sách; thao tác bị chặn hiện thông báo tiếng Việt, không báo lỗi hệ thống.
- **AC0.11 (ĐÃ LÀM)** Given admin mở /admin/settings, Then thấy trước khi tắt: số đề cũ (nháp/đã xuất bản), số buổi đang mở, số lượt thi đang làm dở, số bài chờ chốt điểm; tắt khi còn buổi mở hoặc lượt dở thì có hộp xác nhận kèm số liệu. Tắt/bật lại được bất cứ lúc nào và dữ liệu không mất.

### Mốc 1 — Dàn câu hỏi

- **AC1.1** Given đề nháp, When giảng viên tải tệp PDF, Word, .txt hoặc .md (tối đa 20 MB), Then tệp xuất hiện trong danh sách sau khi bấm "Tải lên"; "Tiếp tục" không âm thầm bỏ tệp đang chọn dở (có cảnh báo nếu còn tệp chưa tải).
- **AC1.2** Given tệp không đọc được chữ (PDF scan), When tải lên, Then hiện thông báo rõ "tệp này không đọc được chữ" ngay, không im lặng.
- **AC1.3** Given đề có ít nhất một tài liệu đọc được, When bấm "Tạo dàn từ tài liệu", Then nhận 6–12 ý; mỗi ý có nội dung cốt lõi, đoạn nguồn, mức độ, ý đáp án mong đợi, số câu đào sâu tối đa (mặc định 2).
- **AC1.4** Given tài liệu dài hơn khả năng đọc một lần của mô hình, When sinh dàn, Then hệ thống sinh theo từng phần rồi gộp, không cắt mất phần sau.
- **AC1.5** Given sinh dàn lỗi (mô hình lỗi, hết hạn mức), When bấm, Then hiện lý do bằng tiếng Việt và cho thử lại; không để dàn nửa vời; lượt gọi vẫn tính vào hạn mức AI của giảng viên.
- **AC1.6** Given dàn đã sinh, When giảng viên sửa, xoá, thêm hoặc kéo đổi thứ tự ý, Then lưu được; thứ tự là thứ tự ưu tiên khi hỏi.
- **AC1.7** Given dàn có ý, When mở "Bản đồ câu hỏi", Then thấy danh sách ý theo thứ tự, mỗi kịch bản, và số câu ước tính theo thời lượng.
- **AC1.8** Given đề có kịch bản (tiêu đề, bối cảnh cho AI, thẻ "Tình huống của bạn" cho học viên), When thêm tối đa 30 kịch bản, Then lưu được; kịch bản không có dàn riêng.
- **AC1.9** Given đề chưa có ý nào trong dàn, When bấm xuất bản, Then bị chặn kèm lý do.
- **AC1.10** Given đề đã xuất bản, When sửa tài liệu, dàn hay kịch bản, Then bị khoá (cùng lý do công bằng như bản cũ); riêng rubric và ghi chú giọng điệu vẫn sửa được.
- **AC1.11** Ý đáp án mong đợi và đoạn nguồn không bao giờ có trong phản hồi của API dành cho học viên (có test kiểm trực tiếp).
- **AC1.12** Chỉ chủ đề hoặc người được phép sửa đề mới đọc, sửa được dàn; người khác bị từ chối (dùng chung kiểm quyền sửa đề hiện có, không tự viết lại).

## 6. Chuyển dần

Thầy/cô tự test tay Limio Vấn đáp và tự quyết định lúc nào chuyển, nên tài liệu không đặt ngưỡng số liệu "test OK".

Các giai đoạn:
1. Cờ `van_dap.access` tắt với mọi người, chỉ nhóm thử được bật.
2. Đề mới của người có cờ mặc định dùng Limio Vấn đáp; vẫn tạo được đề cũ.
3. Bật cờ cho mọi người; đề cũ đang mở vẫn chạy tiếp.
4. **Thầy/cô tắt bản cũ khi thấy ổn** bằng công tắc "Tắt vấn đáp AI bản cũ" ở Quản trị → Cài đặt hệ thống (AC0.9–AC0.11, đã làm). Công tắc là cài đặt chung của hệ thống, lưu trong cơ sở dữ liệu của từng máy chủ, nên máy 224 và máy AWS tắt riêng; không cần triển khai lại để bật hoặc tắt.

Cách tắt an toàn: mở trang cài đặt, xem 4 con số, đóng các buổi đang mở (hoặc chờ học viên thi xong), rồi bật công tắc. Cần quay lại thì bật lại, không mất gì.

## 7. Rủi ro

- Chất lượng dàn phụ thuộc mô hình Qwen tự host; thử trên vài tài liệu thật của nhóm thử trước khi bàn giao Mốc 1.
- Thêm một bước duyệt dàn cho thầy/cô; giảm bằng cách AI sinh sẵn, mặc định chấp nhận.
- Hai bản cùng tồn tại một thời gian nên cần nhãn rõ trong giao diện để thầy/cô không nhầm.

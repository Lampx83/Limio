# B11 — Phản hồi ghép theo khung Hattie & Timperley

> Acceptance criteria, viết trước khi code theo CLAUDE.md §6.

## Vì sao

Phản hồi hiện tại lấy nguyên văn **một** `FeedbackTemplate` gắn theo
misconception. Mà một mã như `uiux.principle-mixup` trải trên **12 câu hỏi khác
nhau**, nên cùng một đoạn văn phải phục vụ cả 12 — buộc phải viết chung chung,
và khi đoạn đó chứa ví dụ cụ thể thì nó nói chuyện của câu khác. Người học đọc
được feedback về "phóng to màn hình" cho một câu hỏi về thanh tiến độ.

Đây là trần của kiến trúc, không phải lỗi viết lách: **một mã, một chuỗi, N câu
hỏi**. Viết lại khéo hơn chỉ chữa được chỗ lạc đề, không chữa được chỗ nhạt.

**Cách thoát:** không lấy nguyên văn một template nữa, mà **ghép lúc phát** từ
những mảnh đã có sẵn trong DB, trong đó phần giải thích đến từ *chính câu hỏi đó*
(`QuizQuestion.explanation` — 388/388 câu của hai khoá đang chạy đều đã có).

## Khung khoa học

Theo đúng khung mà thuyết minh đề tài BKA-21-503 đã cam kết — Hattie & Timperley
(2007), ba câu hỏi và bốn cấp độ:

| Nước | Câu hỏi Hattie | Cấp độ | Nguồn dữ liệu |
|---|---|---|---|
| "Câu này thuộc **Bài X**" / "Mục tiêu: …" | **feed up** | task | `learningObjective` ?? tiêu đề bài |
| "Mình thấy bạn chọn **A**, đáp án đúng là **B**" | **feed back** | task | lựa chọn thật + `QuestionOption` |
| "Chỗ này dễ nhầm: **[tên]**" | feed back | **process** | `Misconception.name` |
| Giải thích của chính câu hỏi | feed back | **process** | `QuizQuestion.explanation` |
| "Bạn xem lại **Bài X** rồi thử lại nhé" | **feed forward** | **self-regulation** | bài ôn đã tính |

`Misconception.name` là **một cụm ngắn**, không phải đoạn văn dùng chung — nên
lỗi "nói chuyện của câu khác" biến mất về mặt cấu trúc.

**Cấp độ `self` vẫn không bao giờ được phát.** Gọi tên để xưng hô là hợp lệ
(nhu cầu tâm lý — Shute & Zapata-Rivera 2012); gọi tên để đánh giá con người thì
không (Hattie: feedback cấp `self` có thể làm suy giảm học tập).

---

## Nhóm 1 — Mục tiêu học tập (feed up)

| # | Given / When / Then |
|---|---|
| 1.1 | `QuizQuestion.learningObjective String?` — GV nhập mục tiêu cho câu hỏi |
| 1.2 | Có `learningObjective` ⇒ dùng nó; không có ⇒ **lấy tiêu đề bài học làm proxy** |
| 1.3 | Quiz standalone (không gắn lesson) và không có objective ⇒ **bỏ hẳn nước feed up**, không bịa |

## Nhóm 2 — Ghép nội dung

| # | Given / When / Then |
|---|---|
| 2.1 | Thứ tự các nước đúng theo Hattie: feed up → feed back → feed forward |
| 2.2 | Nêu **đáp án đã chọn** và **đáp án đúng** bằng nhãn thật, trích dẫn trong ngoặc kép |
| 2.3 | Câu `matching`/`ordering` không xác định được "đã chọn" ⇒ bỏ nước đó, giữ các nước còn lại |
| 2.4 | Có misconception ⇒ thêm một dòng gọi tên chỗ nhầm bằng `Misconception.name` |
| 2.5 | Có `explanation` ⇒ dùng nó làm phần giải thích. Không có ⇒ **rơi về `FeedbackTemplate.body`** (vai trò còn lại của 121 đoạn đã viết) |
| 2.6 | Không có cả hai ⇒ câu fallback hiện tại, không để trống |
| 2.7 | Có bài ôn ⇒ nước feed forward nêu **tên bài**, không chỉ id |
| 2.8 | Xưng hô "mình – bạn" thống nhất; không khen/chê con người |
| 2.9 | Body vẫn được snapshot nguyên văn vào `FeedbackDelivery.body` như trước |

## Nhóm 3 — Tôn trọng thiết kế thực nghiệm B10

Đây là ràng buộc quan trọng nhất: composition **không được** phát phần cá nhân
hoá cho lớp đối chứng.

| # | Given / When / Then |
|---|---|
| 3.1 | `minimal` ⇒ **không** có nước gọi tên chỗ nhầm (đã bị chặn từ trước ở khâu nhận diện) |
| 3.2 | `minimal` ⇒ **không** có nước feed forward (không có bài ôn) |
| 3.3 | `minimal` ⇒ **vẫn** có feed up, feed back và giải thích của câu hỏi — đây là thông tin cơ bản, cả hai lớp đều đã thấy trên trang kết quả, không phải biến thao tác |
| 3.4 | Toạ độ SSMMD của `minimal` vẫn nằm trong khoảng B10 công bố: `task`, `kcr`/`kr` |

> **Ghi chú thiết kế.** Trước B11, feedback của lớp đối chứng vừa không cá nhân
> hoá vừa *viết nhạt* — hai thứ lẫn vào nhau. Sau B11, cả hai lớp nhận chất
> lượng văn bản như nhau ở tầng task, biến thao tác còn lại đúng là phần cá nhân
> hoá. Thí nghiệm sạch hơn, không bẩn hơn.

## Nhóm 4 — Toạ độ B9 phải nói thật

| # | Given / When / Then |
|---|---|
| 4.1 | `codeFeedback` nhận thêm `hasExplanation`; có giải thích ⇒ sàn elaboration là `kcr`, không còn `kr` |
| 4.2 | Thang bậc giữ nguyên: misconception + bài ôn ⇒ `elaborated`; chỉ misconception ⇒ `km`; chỉ bài ôn ⇒ `kh` |
| 4.3 | `CODER_VERSION` tăng lên `b11.coding.v2` — hàng mã hoá bởi hai phiên bản không so sánh trực tiếp được, người đọc dữ liệu phải phân biệt được |

## Nhóm 5 — Giao diện

| # | Given / When / Then |
|---|---|
| 5.1 | Trang kết quả chào **một lần** ở đầu: "Chào {displayName}" — dùng nguyên `displayName`, không tách tên đệm |
| 5.2 | `displayName` trống ⇒ bỏ lời chào, không hiện "Chào null" |
| 5.3 | Khối "Giải thích" riêng **không hiện lại** khi nội dung đó đã nằm trong body — tránh đọc hai lần |
| 5.4 | Link bài ôn giữ nguyên (đang đo uptake B9.2) |

## Test

- Unit cho `composeFeedbackBody` (thuần, không DB): phủ đủ tổ hợp có/không của objective, chọn-được, misconception, explanation, bài ôn — và hai variant
- Integration: nộp bài sai → body chứa đúng nhãn đáp án đã chọn và đáp án đúng
- **`minimal` không được có tên chỗ nhầm và không có feed forward**
- Toàn bộ test cũ phải pass

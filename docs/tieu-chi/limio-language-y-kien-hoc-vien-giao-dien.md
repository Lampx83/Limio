# Ý kiến học viên dùng thử khoá Speakout — các chỉnh sửa giao diện nhỏ — Acceptance criteria

> Bản nháp 15/11/2026, chưa duyệt. Nguồn: ý kiến của một học viên dùng thử khoá Speakout Intermediate Plus (khoá `languageMode`). Chỉ gồm bốn ý nhỏ, rõ ràng; các ý lớn (Unit Overview thành hộp thoại, zoom sách, chấm phát âm bằng mic, IPA/nghĩa tiếng Việt, "danh mục bài tập" chung) **chưa làm** — xem cuối tài liệu.

## AC1 — Khoá ngoại ngữ không hiện khối "Bài tập / Thảo luận" khi trống

Khối hai tab "Bài tập" và "Thảo luận" ở cuối bài là của khoá học có lớp; giáo trình thì không cần.

- **Khoá ngoại ngữ** (`languageMode`): tab **Thảo luận** chỉ hiện khi bài **đã có** chủ đề thảo luận; tab **Bài tập** chỉ hiện khi bài **có** bài tập giao (bài nộp, quiz, bài tập nhóm…). Không có tab nào thì **cả khối biến mất**, không để lại dải trống.
- Không xoá dữ liệu: bài có chủ đề hay bài tập thì tab vẫn hiện như cũ (khoá Speakout có 13 bài tập nói/viết giao sẵn nên tab Bài tập không được mất khi có).
- **Khoá thường** (không `languageMode`): không đổi gì, luôn hiện cả hai tab.

## AC2 — Tên dạng bài và đề bài là một khối riêng, rộng bằng bài học

Ví dụ "7B · Multi-word verbs" kèm "Find the ten multi-word verbs in the texts and complete each one to match its definition."

- Trong **Bài luyện nhúng** của bài học, tên đoạn (tiêu đề) và **đề bài** (đoạn văn đầu của đoạn, nếu là một câu thuần chữ, không in đậm/nghiêng, tối đa 300 ký tự) hiện trong **một khối riêng phía trên**, rộng bằng cả Bài luyện, tách khỏi thẻ nội dung bên dưới.
- Thẻ nội dung (bài đọc, văn bản, ảnh, audio) **không còn** lặp tiêu đề và đề bài.
- Đoạn mà **chỉ có đề bài** — nhận ra qua lời mở "No partner? …" / "No group? …" của phiếu "Talk with a virtual partner" — thì không còn thẻ nội dung trống: khối đề bài ở trên và cột câu hỏi rộng hết bề ngang. Đoạn chỉ có **một** câu thuần chữ nhưng không mở đầu như vậy là **nội dung** (bài đọc ngắn), không bị coi là đề bài.
- Đoạn **không** có đề bài nhận ra được (đoạn đầu là tiêu đề, ảnh, hay đoạn có chữ đậm/ô trống) thì khối riêng chỉ có tên đoạn; nội dung giữ nguyên, **không mất chữ nào**.
- Bố cục "Một cột" và "Chia đôi" đều có khối này. Phòng thi, Luyện đề toàn trang và xem thử của đề thi **không đổi**.

## AC3 — Thẻ lật: mặt trước là nghĩa thì không có ví dụ

- Khi **mặt trước là nghĩa** ("Mặt trước: nghĩa"): mặt trước chỉ có **nghĩa** (không ví dụ, không ghi chú), vì ví dụ chứa từ cần đoán.
- Mặt sau (khi đó là từ) có từ, phiên âm nếu bật, **và ví dụ + ghi chú**, để học viên vẫn thấy cách dùng sau khi lật.
- Chiều mặc định (mặt trước là từ) **không đổi**.

## AC4 — Không hiện "Ghi chú cá nhân" ngay dưới nội dung câu hỏi

- Trong **Bài luyện nhúng** của bài học, ô "Ghi chú cá nhân (chỉ lưu trên thiết bị này)" **không còn** dưới thẻ nội dung; ghi chú đã có ở tab "Ghi chú" của panel bên phải.
- Phòng thi thử, Luyện đề toàn trang và xem trước đề **giữ** ô này như cũ.

## Chưa làm (cần thầy chốt)

- **"Danh mục bài tập chung":** hiện Grammar và Pronunciation gom mọi bài tập vào một Bài luyện với một dải số câu; các bài khác (vd Reading) có nhiều Bài luyện nhỏ xen trong bài, mỗi cái một dải số câu riêng. Muốn mọi bài giống nhau thì phải gom lại thành một Bài luyện (đổi cách dựng khoá), và các phiếu "bạn ảo" đang nằm xen giữa bài sẽ dồn xuống chung.
- IPA và nghĩa tiếng Việt cho từ vựng: cần dữ liệu nguồn.
- Unit Overview thành hộp thoại, zoom sách + lưu chiểu, chấm phát âm/độ trôi chảy bằng mic: tính năng lớn, làm riêng.

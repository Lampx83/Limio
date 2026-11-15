# Ý kiến học viên dùng thử khoá Speakout — các chỉnh sửa giao diện nhỏ — Acceptance criteria

> Bản nháp 15/11/2026, chưa duyệt. Nguồn: ý kiến của một học viên dùng thử khoá Speakout Intermediate Plus (khoá `languageMode`). Bốn ý nhỏ (AC1–AC4) và bố cục lesson (AC5–AC6); các ý lớn (Unit Overview thành hộp thoại, zoom sách, chấm phát âm bằng mic, IPA/nghĩa tiếng Việt, "danh mục bài tập" chung) **chưa làm** — xem cuối tài liệu.

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

## AC5 — Bài ngoại ngữ: lý thuyết ở trên, bài luyện chia tab theo exercise (thầy chốt 15/11/2026)

Một lesson là trọn một phần của sách; bên trong, lý thuyết đứng trước, phần luyện đứng sau.

- Trong **khung bài học của khoá ngoại ngữ**, phần không phải bài luyện (chữ của sách, hộp quy tắc, mẹo, ảnh, audio, video) hiện **phía trên**, giữ đúng thứ tự cũ.
- Bên dưới là khu bài luyện, **không có tiêu đề riêng** (thanh tab là đủ): **mỗi exercise của sách là một tab**, tên tab là số exercise: "3A", "3B", "5", "2A–2C", "7". Mở sẵn tab đầu. Chuyển tab **không mất** bài đang làm. Trong mỗi tab vẫn có "Chia đôi / Một cột" và khối đề bài riêng (AC2).
- Khối Bài luyện gom nhiều exercise (vd Grammar: 3A, 3B, 3C, 5) được **tách theo đoạn**: các đoạn liên tiếp cùng nhãn (7B, 7B) thuộc một tab; đoạn không có nhãn đi cùng tab đứng trước nó. Mỗi tab có dải số câu riêng, đánh số từ 1.
- Khối chỉ có một exercise thì là một tab. Tên lấy theo thứ tự: nhãn ở đầu tên khối, nhãn các đoạn, nhãn câu yêu cầu của sách đứng ngay trước khối ("2B"), rồi tên khối (bỏ đuôi " · Practice"). **Một exercise chỉ một tab:** các khối cùng nhãn (vd bài viết 3D và phiếu bạn ảo 3D) gộp vào một tab, xếp lần lượt trong tab đó, không tách thành hai tab trùng tên.
- Các tab của cùng một khối **dùng chung một buổi luyện** (đáp án lưu chung như cũ). Trong tab con **không có nút "Kết thúc bài luyện"** (nút đó kết thúc cả khối nên không đặt trong từng tab); điểm theo kỹ năng không đổi vì vẫn ghi theo lượt kiểm tra từng câu.
- Bài chỉ có **một** tab: tab **vẫn hiện số exercise** (vd "6", "2A") để học viên biết đang làm bài tập nào (thầy chốt 15/11/2026); chỉ khi tên không phải số exercise (tên chữ dự phòng) mới không có thanh tab. Nút "Kết thúc bài luyện" vẫn như cũ.
- Bài không có khối nào, hoặc người xem không thấy khối (không phải học viên / xem thử): hiện như cũ.
- Khoá thường, chiếu lớp, giảng viên đứng lớp, bài slide: **không đổi**.
- Phiếu bạn ảo là một tab của chính lesson đó, không tách thành lesson riêng. Nó là **phần nhỏ của exercise** nên khối đề bài của nó **không đánh lại mã bài**, dù đứng một mình hay chung tab: mã đã có trên tab, khối chỉ ghi "Talk with a virtual partner" (không ghi "6 · …" hay "3D · …").

## AC6 — Chữ của sách đi cùng phiếu bạn ảo

- Câu yêu cầu của sách ("2 A Work in pairs. Discuss the questions.") đứng **ngay trước** phiếu bạn ảo **cùng số/chữ** (2A) thì chuyển vào tab của phiếu, **giữ nguyên chữ** (bỏ nhãn số/chữ vì số đã có trên tab), cùng danh sách, bảng, ảnh đi kèm; trong tab nó hiện thành khối câu yêu cầu cùng khuôn với tab chỉ có chữ (tiêu đề là số exercise, rồi câu yêu cầu), phiếu bạn ảo "Talk with a virtual partner" là phần nhỏ bên dưới (thầy chốt 15/11/2026: không bỏ câu yêu cầu của sách).
- Câu yêu cầu của bài tập **khác** (không phải bạn ảo):
  - exercise đó **chưa có tab** (chỉ có chữ, không có bài luyện, vd 7A "Can you think of any reasons…", 7B, 8B ở 1.2 Writing) thì thành **một tab riêng** mang số exercise, chứa câu yêu cầu cùng danh sách/ảnh đi kèm tới tiêu đề hay hộp kế tiếp (thầy chốt 15/11/2026: mỗi exercise một tab);
  - exercise đó **đã có tab** (vd 2B ở 1.1 Reading có bài đọc) thì giữ nguyên ở phần lý thuyết, không mất chữ nào.
- Không khớp số/chữ hoặc không đứng ngay trước phiếu: giữ ở phần lý thuyết.

## AC7 — Chữ in đậm của sách được bôi màu

- Trong thẻ đoạn văn của **Bài luyện nhúng**, chữ in đậm của sách (từ vựng mục tiêu, vd "early bird" ở 1.1 Vocabulary) **đổi sang màu nhấn** của khối (cùng màu với dải kỹ năng và tab) kèm **một vạch nền mảnh ở nửa dưới dòng**, kiểu bút dạ quang; **không tô kín cả cụm** (thầy chốt 15/11/2026: tô kín quá nặng, nhất là trên khung lời bình nền hồng). Đọc vẫn rõ ở nền sáng và tối.
- Áp cho cả **phần lý thuyết** của bài ngoại ngữ (vd lời bình của Jodi, Victor, Alejandra ở 1.2 Vocabulary, nơi cả đoạn là chữ nghiêng): chữ đậm đổi màu như trên, trừ chữ đậm làm nhãn: trong tiêu đề, hộp mẹo/quy tắc và tên người nói ("Jodi:"). Phòng thi, Luyện đề toàn trang và bài không thuộc khung ngoại ngữ **không đổi**.

## AC8 — Bài đọc dài là lý thuyết ở trên đầu (thầy chốt 15/11/2026)

- Đoạn văn **dài** của một khối bài luyện (bài đọc: từ **120 từ** trở lên, không có audio) được **đưa lên phần lý thuyết** phía trên các tab, ngay sau chữ của sách: vd bài "The world's favourite drug" của 1.1 Reading nằm dưới câu "2 B Read the article about coffee…", cả bài hiện nổi bật trên cùng.
- Tab của exercise đó chỉ còn **đề bài và câu hỏi** (một cột), không lặp bài đọc.
- Bài đọc dùng chung cho nhiều exercise (2A, 2B…) nên câu dẫn của sách đứng ngay trước nó ("Read the article about coffee. What information is new to you?") **không mang nhãn exercise** ("2 B") ở phần lý thuyết; chữ giữ nguyên.
- Đoạn ngắn (câu, bảng nhỏ, danh sách), đoạn có audio: **không đổi**.
- Không mất chữ nào: bài đọc hiện đủ một lần, ở phần lý thuyết.
- **Phần lý thuyết là MỘT thẻ** (thầy chốt 15/11/2026: không tách thành nhiều thẻ): banner, câu dẫn, hộp quy tắc, mẹo và bài đọc nằm liền trong một thẻ, ngăn nhau bằng khoảng cách chứ không bằng viền. Chỉ áp khi toàn bộ phần lý thuyết là chữ và không dùng bảng màu riêng của bài; bài có audio, video hay bảng màu riêng giữ cách hiện cũ. **Tên bài làm đầu thẻ đó** (phương án A, thầy chốt 15/11/2026): dòng chip kỹ năng + tên bài (+ nút "Về soạn nội dung" của giảng viên) nằm ở đầu thẻ lý thuyết, không còn thẻ tên bài riêng; dòng phụ của banner trùng tên bài thì bỏ, chỉ giữ chữ "READING". Bài có mô tả riêng (không trùng tên unit) giữ thẻ tên bài như cũ.

## Chưa làm (cần thầy chốt)

- **"Danh mục bài tập chung":** hiện Grammar và Pronunciation gom mọi bài tập vào một Bài luyện với một dải số câu; các bài khác (vd Reading) có nhiều Bài luyện nhỏ xen trong bài, mỗi cái một dải số câu riêng. Muốn mọi bài giống nhau thì phải gom lại thành một Bài luyện (đổi cách dựng khoá), và các phiếu "bạn ảo" đang nằm xen giữa bài sẽ dồn xuống chung.
- IPA và nghĩa tiếng Việt cho từ vựng: cần dữ liệu nguồn.
- Unit Overview thành hộp thoại, zoom sách + lưu chiểu, chấm phát âm/độ trôi chảy bằng mic: tính năng lớn, làm riêng.

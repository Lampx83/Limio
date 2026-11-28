# Mini-test cuối bài (tự kiểm tra) — Acceptance criteria

> 28/11/2026, **đã duyệt (tính vào hoàn thành bài, 15 phút, hiện điểm và nhãn, làm thử một Bài khoá Quyển 1 trên dev).** Cuối mỗi bài có một bài kiểm tra nhỏ để học viên tự biết mình đã nắm bài chưa. Dựng trên **Quiz** có sẵn (không dựng khung mới), đặt giờ làm bài, và thêm audio cho câu nghe.

## Vì sao Quiz

- Quiz đã có: gắn vào bài (`Quiz.lessonId`), giới hạn giờ (`timeLimitSec`, tự nộp khi hết giờ, không chốt điểm 0 cho lượt chưa trả lời), làm lại, cách gộp điểm.
- Câu hỏi Quiz của khoá bật cá nhân hoá **tự mang chủ đề của bài** (lesson-as-tag, B1.5), nên mỗi lần làm cập nhật mức nắm vững (BKT) và nhãn Vững / Nên luyện / Cần ôn — đúng nghĩa "đã master chưa".
- Phương án Bài luyện (phiếu HSK) có audio nhưng điểm không vào mức nắm vững; phương án Exam là đợt/ca/phòng thi chính thức, quá nặng cho một bài tự kiểm tra.
- Thiếu của Quiz: **chưa có audio** cho câu hỏi (đề chỉ là chữ). Xem AC3.

## AC1 — Vị trí và tên

- **Given** một bài có mini-test, **Then** mini-test là một Quiz gắn vào bài, tên `Tự kiểm tra · <tên bài>`, hiện ở cuối bài (sau các khối luyện), trong mục nhiệm vụ của bài như mọi quiz.
- Mỗi bài chỉ một mini-test; quiz thường của giảng viên không bị đổi hành vi.

## AC1b — Tính vào hoàn thành bài (thầy chốt 28/11/2026: có)

- **Given** bài có mini-test hiện cho học viên, **Then** bài chỉ "Đã xong" khi học viên **đã nộp** mini-test (cùng quy tắc quiz hiện có: bài có quiz thì phải nộp quiz; điều kiện cuộn hết trang không còn áp dụng).
- Hoàn thành tính theo **đã nộp**, **không cần đạt điểm**: học viên làm kém vẫn xong bài, và được gợi ý ôn (AC4). Hết giờ tự nộp cũng tính là đã nộp.
- Bài **đã xong** từ trước khi có mini-test giữ nguyên là xong (sự kiện `lesson.completed` không bị rút lại); thêm mini-test vào bài chỉ ảnh hưởng học viên chưa xong bài.
- Không cần đổi mã: đây là hành vi quiz hiện có; tài liệu ghi lại để kiểm thử hồi quy.

## AC2 — Giờ làm bài

- Mini-test đặt `timeLimitSec`; **15 phút cho 16 câu** (chốt 28/11/2026; nhịp khoảng 55 giây một câu, sát đề HSK: nghe ~40 giây, đọc ~55 giây), sửa được ở trang soạn quiz như quiz thường (đã có ô "Giới hạn thời gian").
- Đồng hồ, tự nộp khi hết giờ và quy tắc "không tự nộp lượt chưa trả lời" **giữ nguyên** (đã có ở `QuizPlayer`).
- Giờ tính từ lúc bấm bắt đầu; câu nghe nghe lại thoải mái trong giờ.

## AC3 — Câu nghe có audio

- **Given** câu hỏi có `extra.audioUrl`, **When** học viên làm bài, **Then** `QuizPlayer` hiện trình phát audio gọn (`AudioLessonPlayer`: phát/tạm dừng, tua, 0,75×/1×/1,25×, lặp lại) phía trên đề, và **không hiện lời thoại** (lời thoại là đáp án).
- Chỉ nhận đường dẫn audio nội bộ `/api/lesson-media/audio/…` (đi qua cổng kiểm quyền học viên đã ghi danh, kể cả khoá có bản quyền); URL khác bị bỏ, câu vẫn làm được như câu chữ.
- Nghe lại **không giới hạn** (đây là bài tự kiểm tra, không phải thi).
- Trang soạn câu hỏi quiz có ô chọn audio cho câu (mốc sau); mốc đầu nhập bằng công cụ.
- Câu cũ không có `extra.audioUrl` hiển thị y như trước.

## AC4 — Kết quả cho học viên

- Sau khi nộp, học viên thấy **nhãn** Vững (≥ 85%), Nên luyện thêm (60–85%), Cần ôn (< 60%) **theo điểm lượt vừa làm** (không theo xác suất BKT: BKT bão hoà nhanh, làm đúng 11/16 vẫn ra "Vững"; đã thấy trên dev 28/11), và gợi ý: Cần ôn / Nên luyện → "Quay lại các khối luyện của bài"; Vững → "Sang bài tiếp theo".
- Không chặn gì: chỉ gợi ý (quyết định 27/09/2026 về lộ trình cá nhân hoá). Học viên không thấy mastery % của hệ thống; điểm lượt làm hiện như quiz thường (câu hỏi 1 bên dưới).
- Nhãn dùng chuỗi giao diện vi/en có sẵn của `MasteryBadge`. Nhãn chỉ hiện cho học viên đã ghi danh, khoá bật cá nhân hoá, không thuộc lớp đối chứng (quy tắc của trang kết quả quiz hiện có).

## AC5 — Làm lại và điểm

- Không giới hạn số lần (`maxAttempts` trống); điểm hiển thị theo **lượt mới nhất** (`scoringPolicy = latest`), vì mục đích là tự đo lại sau khi ôn.
- **Không xáo thứ tự câu**: giữ phần Nghe, Đọc, Viết như đề HSK.
- XP theo quy tắc quiz hiện có, kèm giới hạn mỗi ngày và chặn "làm nhanh" (anti-farming); không thêm đường cộng XP mới.

## AC6 — Dữ liệu học và quyền riêng tư

- Dùng đúng sự kiện và bảng của quiz hiện có (`LearningEvent` append-only, `AnswerResponse`); câu hỏi gắn tag chủ đề bài; mức nắm vững cập nhật qua BKT như mọi quiz. Không thêm bảng.
- Lớp đối chứng (variant `minimal`) và khoá `personalizationEnabled = false`: mini-test vẫn làm được nhưng **không hiện nhãn và gợi ý cá nhân hoá**.
- Export và xoá dữ liệu cá nhân phủ như quiz thường.

## AC7 — Nội dung mini-test (theo dạng đề HSK)

Dạng câu bám đề HSK 4 để học viên quen cách hỏi (xem mục "Khảo sát dạng đề HSK" cuối tài liệu). **16 câu, 15 phút**, chia theo ba kỹ năng của đề HSK:

| Phần | Số câu | Dạng (như đề HSK) | Loại câu Quiz |
|---|---|---|---|
| **Nghe** (~6 phút) | 6 | 4 câu nghe đoạn thoại ngắn rồi chọn đáp án; 2 câu nghe đoạn ngắn rồi trả lời | `mcq` + `extra.audioUrl` |
| **Đọc** (~6 phút) | 6 | 3 câu điền từ vào đoạn ngắn (chọn từ trong bảng từ); 3 câu đọc đoạn ngắn rồi chọn đáp án | `drag_drop_fill` hoặc `fill_in`; `mcq` |
| **Viết** (~3 phút) | 4 | 3 câu sắp xếp từ thành câu; 1 câu điền chữ Hán theo pinyin | `ordering`; `fill_in` |

- Mọi câu **chấm tự động** để nhãn kết quả ra ngay; không có câu tự luận chấm tay hay AI (đoạn viết từ 80 chữ của đề thật nằm ngoài mini-test).
- Không có câu đúng/sai nghe (đề HSK mới bỏ dạng này) và không có câu nói (bài thi riêng).
- Từ vựng và ngữ pháp của bài được kiểm **qua** các dạng trên (điền từ, đọc, sắp xếp), không tách phần riêng, giống đề HSK.
- **Không trùng** câu trong các khối luyện của bài; từ và mẫu câu lấy từ nội dung bài. Hai đoạn thoại nghe lấy từ hai hội thoại của bài (audio có sẵn), đoạn nghe thứ ba trở đi dùng audio mới sinh bằng giọng NEU/OpenAI như các bài khác.
- Sinh bằng công cụ, quiz ở trạng thái ẩn tới khi giảng viên duyệt.

## AC8 — Sách in

- Không đổi bản in hiện tại. Tuỳ chọn sau: một ô nhỏ "Tự kiểm tra trên Limio" kèm mã QR cuối chủ đề.

## Đã làm (28/11/2026, trên dev, chưa commit)

- `lib/quizAudio.ts` + `QuizPlayer`: câu có `extra.audioUrl` hiện trình phát nghe, không hiện lời thoại.
- `lib/selfTest.ts` + trang kết quả quiz: nhãn theo điểm cho quiz tên "Tự kiểm tra · …", kèm gợi ý ôn lại bài khi chưa Vững.
- `pnpm create:mini-test` (packages/core-lms/scripts/create-mini-test.ts): tạo quiz 16 câu từ tệp JSON, tự gắn audio hội thoại của bài.
- Mini-test mẫu: Chủ đề 1, 课文1「看房那天」 (dev, lang.giangvien).
- Chưa làm: ô tải audio ở trang soạn câu hỏi, đoạn nghe riêng cho mini-test, ô nhắc ở cuối khối luyện, sinh hàng loạt.

## Mô phỏng đề HSK (thầy yêu cầu 28/11/2026: "mô phỏng kỳ thi HSK nhất có thể", nhưng thời gian ngắn hơn)

Giữ 15 phút, 16 câu; bám cấu trúc và cách làm của đề HSK:

- **Màn hướng dẫn 考试说明** trước khi làm: số câu, thời gian, số câu mỗi phần, câu nghe chỉ phát một lần. Đồng hồ chỉ chạy từ lúc bấm Bắt đầu. Lượt đang làm dở thì vào thẳng.
- **Ba phần 听力 / 阅读 / 书写**, mỗi phần nhỏ (第一部分, 第二部分) có khung hướng dẫn chữ Hán kèm tiếng Việt ở câu đầu phần ("第1-6题：听对话，选出正确答案。").
- **Phương án đánh A B C D** như tờ đề.
- **Nghe một lần** (`extra.audioPlays = 1`): chỉ có nút Phát; không tạm dừng, không tua, không đổi tốc độ, không lặp lại; phát xong hoặc rời câu khi đang phát là khoá; tải lại trang cũng không nghe lại được (nhớ trong phiên trình duyệt).
- **Kết quả theo phần thi** (听力 6/6, 阅读 5/6, 书写 0/4) ngoài tổng điểm và nhãn.
- Dữ liệu: `QuizQuestion.extra.section = { key, label, part, intro }`, `extra.audioPlays`. Quiz tên "Tự kiểm tra · …" tự bật các hành vi này.

**Chưa mô phỏng được (cần việc khác):**
- Câu hỏi nghe do **giọng đọc** (đề thật đọc cả câu hỏi và có quãng nghỉ giữa các câu): hiện câu hỏi in trên màn hình, audio là cả hội thoại có sẵn nên ba câu cùng một hội thoại phải nghe ba lần (mỗi câu một lần). Cần sinh audio hội thoại ngắn kèm câu hỏi đọc bằng giọng NEU/OpenAI (chưa có khoá trên máy dev).
- Phần viết thật của HSK 3.0 (viết câu theo tranh và từ cho trước, đoạn văn từ 80 chữ) cần chấm tay hoặc AI; mini-test giữ dạng sắp xếp câu và điền chữ Hán để chấm tự động.
- Dạng câu đọc của HSK 3.0 chưa kiểm với đề mẫu chính thức.

## Kiểm thử

- Hàm thuần: nhãn theo điểm (ngưỡng 60/85, biên), lọc audio chỉ nhận `/api/lesson-media/audio/…`.
- `QuizPlayer`: câu có `extra.audioUrl` hiện trình phát và không hiện lời thoại; câu không có thì như cũ.
- Đồng hồ: hết giờ tự nộp lượt đã trả lời; lượt chưa trả lời không bị chốt 0 (hồi quy).
- Xem trên trình duyệt ở một bài thật, 400 px và 1280 px.

## Đã chốt (28/11/2026)

1. Mini-test **tính vào hoàn thành bài** (đã nộp là xong, không cần đạt).
2. Thời lượng **15 phút**, 16 câu.
3. Kết quả hiện cả "đúng n / m câu" và nhãn; không hiện mastery %.
4. Làm thử một Bài khoá của Quyển 1 trên dev trước, thầy xem rồi mới sinh hàng loạt.

Mốc đầu dùng audio hội thoại có sẵn của bài cho các câu nghe (nhiều câu chung một audio); đoạn nghe ngắn riêng cho mini-test là mốc sau.

## Khảo sát dạng đề HSK (28/11/2026)

Nguồn là ba trang tổng hợp thứ cấp, **chưa đối chiếu với đề mẫu chính thức của Chinese Testing International**; cần xem đề mẫu chính thức trước khi dùng làm chuẩn.

- **HSK 2.0 (cũ):** 105 phút, nghe 30 + đọc 40 + viết 25. Nghe: đúng/sai, hội thoại ngắn, hội thoại dài. Đọc: điền từ, sắp xếp câu, đọc hiểu. Viết: sắp xếp câu, viết câu từ từ khoá và tranh.
- **HSK 3.0 (mới, lần thi đầu 13/12/2026):** khoảng 70 câu, 85 phút: nghe 32 câu (~20 phút), đọc 32 câu (30 phút), viết 6 câu (25 phút). Nghe: bỏ đúng/sai, gộp hội thoại ngắn và dài, thêm nghe đoạn ngắn rồi trả lời. Đọc: bỏ sắp xếp câu, đọc đoạn ngắn là nhiệm vụ chính, thêm điền từ vào đoạn (chỉ một nguồn nói vậy). Viết: 5 câu viết theo tranh và từ cho trước, 1 đoạn văn từ 80 chữ. Nói là bài thi riêng, bắt buộc.
- Các trang bất đồng ở dạng câu đọc và dạng bài nói; không có trang nào cho số câu theo từng dạng; điểm đạt của 3.0 chưa công bố.
- Nguồn: [eBLCU](https://www.eblcu.com/blogs/HSK-2-0-vs-HSK-3-0-Part-4-Key-Changes-at-HSK-4.html), [HSK Lord](https://hsklord.com/blog/new-hsk-4-3-0-guide), [StudyCLI](https://studycli.org/hsk/pass-hsk-4/).

# Trang khoá học: thẻ kỹ năng, ôn lại và luyện thi ở cột phải (theo Figma) — Acceptance criteria

> 10/11/2026, **thầy đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Theo ảnh Figma "Limio Language" thầy gửi: cột phải có "Tiến độ theo kỹ năng", "Đến lúc ôn lại", "Sẵn sàng vận dụng?". Đã chốt qua hỏi đáp: làm theo hướng "thẻ nhỏ ở cột phải, khối Luyện thi đầy đủ xuống cuối cột trái". Banner và phần còn lại của trang giữ nguyên.

## Hiện trạng

- Trang `apps/web/src/app/learn/[slug]/page.tsx`, lưới `lg:grid-cols-[1fr_320px]`. Cột trái, trên cùng: hai thẻ link "Hồ sơ 4 kỹ năng" (chỉ khi `course.languageMode && learningPath.enabled`) và "Ôn từ vựng" (chỉ khi `flashcardStats.total > 0`); rồi "Luyện thi" (khi có đề thi thử đã xuất bản), lộ trình, nội dung giáo trình. Cột phải: nhiệm vụ hôm nay, bảng xếp hạng, huy hiệu…
- Hai thẻ link chỉ có tiêu đề và một dòng mô tả, không cho thấy tình hình học.

## AC1 — Thẻ "Tiến độ theo kỹ năng" (cột phải)

- **Given** khoá ngoại ngữ (`languageMode`) và `learningPath.enabled`. **When** học viên mở trang khoá. **Then** cột phải có thẻ "Tiến độ theo kỹ năng": bốn dòng Nghe, Nói, Đọc, Viết, mỗi dòng có tên, thanh tiến độ và phần trăm = **số bài đã luyện / tổng số bài** của kỹ năng đó (làm tròn); chú thích nhỏ "Dựa trên bài học đã hoàn thành".
- Kỹ năng không có bài nào (`lessonsTotal = 0`): hiện "—", thanh rỗng, không chia cho 0.
- **Không hiện mastery** hay điểm đánh giá năng lực dưới bất kỳ dạng nào (đúng nguyên tắc hồ sơ học viên chỉ có nhãn); chỉ dùng số bài.
- Cả thẻ là link sang `/learn/<slug>/skills` (Hồ sơ kỹ năng đầy đủ, giữ nguyên), có chữ "Xem hồ sơ kỹ năng".
- **Given** khoá không phải ngoại ngữ, hoặc lớp đối chứng, hoặc tắt cá nhân hoá. **Then** không có thẻ này và không có khoảng trống (như điều kiện của thẻ "Hồ sơ 4 kỹ năng" hiện nay).
- Thứ tự dòng theo Figma: Đọc, Nghe, Nói, Viết.

## AC2 — Thẻ "Đến lúc ôn lại" (cột phải)

- **Given** khoá có bộ thẻ từ vựng (`flashcardStats.total > 0`). **When** có thẻ đến hạn ôn (`reviewableToday > 0`). **Then** thẻ nền xanh nhạt, tiêu đề "Đến lúc ôn lại", dòng "n từ vựng" và nút **"Ôn kiến thức đã học"** dẫn tới `/learn/<slug>/flashcards`.
- Nếu hồ sơ có gợi ý bài nên ôn, thêm dòng "Từ <tên bài gợi ý>" (không có gợi ý thì bỏ dòng). Không hiện "điểm ngữ pháp" và không hiện số phút ước lượng (hệ thống chưa có dữ liệu cho hai thứ đó).
- **Given** không còn thẻ nào đến hạn. **Then** thẻ hiện "Hôm nay bạn đã ôn xong." và nút đổi thành "Xem bộ thẻ" (vẫn dẫn tới trang flashcards).
- Khoá không có thẻ từ vựng: không có thẻ này. Không phụ thuộc chế độ ngoại ngữ hay lớp đối chứng (công cụ ghi nhớ, như quy tắc hiện nay của "Ôn từ vựng").

## AC3 — Thẻ "Sẵn sàng vận dụng?" và vị trí khối Luyện thi

- **Given** khoá có đề thi thử đã xuất bản. **Then** cột phải có thẻ nhỏ "Sẵn sàng vận dụng?" với link **"Thi thử ↗"** (thầy đổi từ "Luyện đề" ngày 10/11/2026 để khỏi nhầm với chế độ Luyện đề trong từng đề); bấm thì cuộn tới khối "Thi thử" (`#luyen-thi`; tiêu đề khối đổi từ "Luyện thi" thành "Thi thử" ngày 10/11/2026, nút "Luyện đề" trong từng đề giữ nguyên). Không có đề thì không có thẻ.
- Khối "Thi thử" (trước là "Luyện thi") **giữ nguyên nội dung và chức năng** (số phần, thời gian từng kỹ năng, trạng thái "Đang làm dở · lượt n", nút "Luyện đề"/"Tiếp tục"), nhưng **chuyển xuống cuối cột trái**, sau "Nội dung giáo trình". Đoạn mô tả đầu khối rút còn một câu: "Thi thử có giờ từng phần, làm lần lượt; luyện đề thì không bấm giờ và xem đáp án ngay."
- Hai thẻ link cũ ("Hồ sơ 4 kỹ năng", "Ôn từ vựng") ở đầu cột trái **bị gỡ**, vì đã có AC1 và AC2 thay thế.

## AC4 — Thứ tự cột phải và màn hẹp

- Cột phải từ trên xuống: **Tiến độ theo kỹ năng → Đến lúc ôn lại → Sẵn sàng vận dụng?**, rồi các thẻ hiện có (nhiệm vụ hôm nay, bảng xếp hạng, huy hiệu…) giữ thứ tự cũ. Thẻ nào không đủ điều kiện thì bỏ, các thẻ sau tự dồn lên.
- Dưới `lg` cột phải rớt xuống dưới cột trái như hiện nay; các thẻ mới giữ nguyên thứ tự trên và không gây tràn ngang ở 400 px.
- Màu và cỡ chữ dùng token có sẵn (thẻ trắng viền nhẹ như các thẻ khác; thẻ "Đến lúc ôn lại" dùng nền `success`/xanh nhạt có sẵn trong bộ màu).

## AC5 — Không làm hỏng chỗ khác

- Trang `/skills`, `/flashcards`, trang Luyện thi và các đường vào đề không đổi.
- Banner, "Lộ trình của bạn", nội dung giáo trình không đổi.
- Không thêm truy vấn thừa cho học viên không thấy thẻ (chỉ gọi hồ sơ kỹ năng khi đủ điều kiện AC1).

## AC6 — Thẻ đề: hai cột "Thi thử" và "Luyện đề" (thầy yêu cầu và duyệt 10/11/2026, đã code)

Mỗi chế độ lưu ở bảng riêng (lượt thi `ExamAttempt`, buổi luyện `ExamPracticeSession`) nên có **trạng thái và nút riêng**; thẻ hiện cạnh nhau để học viên không nhầm "Đang làm dở" của chế độ này với chế độ kia.

- Thẻ đề giữ phần đầu: tên đề, "n phần · m phút", các chip kỹ năng. Phần dưới đổi thành **hai cột ngang nhau** (`sm:grid-cols-2`; dưới `sm` xếp chồng, Thi thử trên, Luyện đề dưới):
  - **Cột "Thi thử"** (chỉ khi `allowMock` hoặc đang có lượt dở): nhãn "Thi thử", dòng trạng thái như hiện nay ("Chưa làm" / "Đang làm dở · lượt n" / "Đã thi n lần · gần nhất x%"), nút chính "Thi thử" / "Tiếp tục thi" (thầy đổi từ "Tiếp tục" 10/11/2026) / "Thi lại" và "Xem kết quả" (khi đã nộp) — giữ nguyên đích và quy tắc hiện nay.
  - **Cột "Luyện đề"** (chỉ khi `allowPractice`): nhãn "Luyện đề", dòng trạng thái mới: "Chưa luyện" / **"Đang luyện dở · x/y câu"** / "Đã luyện n buổi" (không hiện điểm hay %, vì luyện đề không phải điểm số), nút "Luyện đề" (chưa có buổi dở) hoặc **"Tiếp tục luyện"** (có buổi dở, dẫn thẳng vào buổi đó, không qua trang chọn phạm vi).
- Đề chỉ bật một chế độ thì hiện **một cột** (rộng cả hàng), không chừa cột trống.
- Cột nhãn "Thi thử"/"Luyện đề" có một dòng mô tả ngắn: "Mô phỏng thi thật" (thầy sửa 10/11/2026) / "Không bấm giờ, xem đáp án ngay" (thay cho đoạn mô tả chung ở đầu khối, đoạn đó bỏ).
- Hai nút trong cột không xuống dòng ở mọi cỡ màn (đã sửa riêng `whitespace-nowrap`), không tràn ngang ở 400 px.
- Dữ liệu: `listMockExamsForLearner` trả thêm, cho mỗi đề, `practice: { inProgress: { sessionId, answered, total } | null, completedCount }` (đọc từ `ExamPracticeSession`, đúng học viên, chỉ đề của khoá); lỗi truy vấn phần này không làm hỏng cả trang (như khối Thi thử hiện nay).
- Tên khối ("Thi thử" hay "Đề thi") **vẫn chờ thầy chốt**; đề xuất "Đề thi" vì khối nay chứa hai chế độ. Trong lúc chờ giữ "Thi thử".

## Kiểm thử

- Hàm thuần tính phần trăm từng kỹ năng: có bài, 0 bài, đã luyện hết, làm tròn; thứ tự Đọc/Nghe/Nói/Viết.
- Hàm dựng nội dung thẻ ôn lại: có thẻ đến hạn, hết thẻ, có/không có gợi ý bài.
- Trang: điều kiện hiện từng thẻ (ngoại ngữ/không, đối chứng, có/không thẻ từ, có/không đề thi); khối Luyện thi nằm sau giáo trình; link `#luyen-thi` khớp id.
- Xem trên trình duyệt ở 400, 800 và 1280 px.

## Ngoài phạm vi

Thẻ "Mục tiêu của bạn" (đã có tính năng Mục tiêu riêng); điểm ngữ pháp và số phút ước lượng; trang riêng liệt kê đề thi; đổi nội dung các trang `/skills`, `/flashcards`.

## Đã làm (10/11/2026)

- `lib/courseHomeView.ts`: `skillProgressRows` (thứ tự Đọc/Nghe/Nói/Viết, % = bài đã luyện / tổng bài, null khi 0 bài) và `reviewCardView` (n từ vựng / đã ôn xong, dòng "Từ <bài>", nhãn nút); có test.
- `learn/[slug]/page.tsx`: ba thẻ ở đầu cột phải (Tiến độ theo kỹ năng, Đến lúc ôn lại, Sẵn sàng vận dụng?); gỡ hai thẻ link cũ ở đầu cột trái; khối Luyện thi chuyển xuống sau "Nội dung khoá học", mô tả rút một câu. Chỉ gọi `getLanguageProfile` khi `languageMode && learningPath.enabled`.
- Đã xem trên trình duyệt ở 1280 px và 400 px (không tràn ngang; thứ tự thẻ đúng; link "Thi thử ↗" cuộn tới khối Luyện thi). Chưa kiểm: khoá không có thẻ từ/đề thi, lớp đối chứng (đã phủ bằng điều kiện trong mã, chưa xem tay).
- **AC6 (thẻ đề hai cột):** `listMockExamsForLearner` trả thêm `practice { inProgress, completedCount }` (test mới trong `mock-catalog.test.ts`); `courseHomeView.ts` thêm `mockStatusText`, `practiceStatusText`, `practiceButtonLabel`, `practiceHref` (có test); thẻ đề trên trang khoá chia hai cột Thi thử / Luyện đề, "Tiếp tục luyện" vào thẳng buổi dở. Đã xem ở 1280 px và 400 px (chồng dọc, không tràn ngang) trên dữ liệu thật có cả lượt thi dở và buổi luyện dở. Chưa xem tay: đề chỉ bật một chế độ, và trạng thái "Đã luyện n buổi".

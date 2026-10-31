# Tự học có cá nhân hoá cho khoá nhà xuất bản — Acceptance criteria

> Bản nháp 31/10/2026, **chờ duyệt, chưa code.** Tiếp nối `docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md` (mã kích hoạt, mua trực tiếp) và `docs/tieu-chi/thanh-toan-vnpay.md`. Gắn với B4 (lộ trình), B5/B9–B11 (phản hồi chẩn đoán), A3 (ghi danh); ID chính thức đối chiếu spec khi commit.

## Vì sao làm

Các nhà xuất bản quan tâm tới cá nhân hoá cho người học. Người mua sách điện tử **không có giáo viên đứng lớp**: họ ghi danh bằng mã hoặc mua trực tiếp rồi tự học trên học liệu dựng sẵn. Câu hỏi là Limio có cá nhân hoá được cho họ không.

## Hiện trạng (đã đối chiếu mã và chạy thử trên dev ngày 31/10/2026)

Cá nhân hoá của Limio chạy từ **bài làm của chính người học**, không đi qua giáo viên. Đã chạy thử một khoá kiểu nhà xuất bản (3 bài, mỗi bài 1 quiz 3 câu, cờ cá nhân hoá bật, tác giả không gắn thẻ kỹ năng), một học viên mới ghi danh bằng mã rồi tự làm quiz qua đúng các route của ứng dụng:

- Mỗi bài tự thành một chủ đề; 9/9 câu hỏi tự có thẻ.
- Ghi danh bằng mã → vào lớp mặc định → nhận điều kiện `personalized`.
- Chưa làm quiz nào: lộ trình chỉ có "Bài tiếp theo".
- Sau quiz: nhãn mức nắm vững **Cần ôn / Nên luyện / Vững** (không bao giờ hiện số); trang khoá gắn nhãn cho bài, đề xuất "Có thể lướt qua" cho bài đã Vững; trang kết quả quiz có phản hồi từng câu sai (chọn gì so với đáp án đúng, tên nhầm lẫn, lời giải thích của tác giả, liên kết bài nên xem lại, nút "hỏi thêm").
- Phản hồi ghép bằng quy tắc, **không gọi mô hình AI**, nên không tốn token.

Phần đã chạy được này **không** nằm trong AC dưới đây, trừ AC3 (khoá lại bằng test hồi quy).

## Bốn chỗ hụt nhìn thấy khi chạy thử

1. **Dễ bật nhầm tắt cá nhân hoá.** Form tạo khoá mặc định **tắt**; khoá tắt thì không sinh chủ đề, không lộ trình, không phản hồi cá nhân. Nhà xuất bản không biết mình thiếu gì (khoá vẫn chạy như LMS thường).
2. **Chất lượng phản hồi phụ thuộc cách soạn, mà không ai báo.** Quiz độc lập không gắn bài, quiz quá ít câu, câu không có giải thích, đáp án sai không khai báo nhầm lẫn: khoá vẫn xuất bản được và người học nhận phản hồi nghèo.
3. **"Cần ôn" và "Nên luyện" chỉ hiện cho bài đã đánh dấu hoàn thành** (`learningPath.ts`: bước `review` và `practice` đòi `completed`). Người tự học làm quiz trước khi mở hết bài (rất thường với sách điện tử có bài tập cuối chương) chỉ thấy nhãn trên bài kế tiếp, không thấy bài yếu để ôn.
4. **Nhà xuất bản chưa có chỗ xem tổng hợp phù hợp.** `/instructor/learner-insights` có, nhưng liệt kê **tên và email từng học viên** của khoá, dùng ngưỡng số riêng (0,4 / 0,9) khác ngưỡng nhãn học viên thấy (0,6 / 0,85). Với người mua sách tự ghi danh, nhà xuất bản không nên nhìn thấy danh tính (CLAUDE.md §5.4).

## Phạm vi

- **Có (P0):** AC1–AC5.
- **Không đổi:** cách tính mức nắm vững, ngưỡng nhãn, nội dung phản hồi, cách ghi danh. Chỉ gợi ý, không khoá bài nào.
- **Không làm ở P0:** bài kiểm tra đầu vào xếp lộ trình, rẽ nhánh nội dung, lời nhắc khởi đầu nguội, ngưỡng bằng chứng tối thiểu cho nhãn, trợ giảng AI riêng cho người tự học. Xem "Để P1".

---

## AC1 — Báo khi khoá chưa đủ điều kiện để cá nhân hoá

**Hướng làm đề xuất:** một bảng "Sẵn sàng cá nhân hoá" ở trang sửa khoá của giảng viên/nhà xuất bản và cảnh báo **mềm** (không chặn xuất bản) lúc bấm Xuất bản.

- **Given** khoá có đơn giá, gói truy cập hoặc mã kích hoạt (khoá bán) và `personalizationEnabled = false`, **When** bấm Xuất bản, **Then** hiện cảnh báo "Khoá này chưa bật cá nhân hoá: người học sẽ không có lộ trình và phản hồi riêng" kèm nút bật; chọn "Xuất bản không bật" vẫn xuất bản được. Không đổi cờ nếu người dùng không chọn.
- **Given** cờ bật, **When** mở bảng "Sẵn sàng cá nhân hoá", **Then** mỗi bài có một dòng: số quiz gắn bài, số câu, số câu có giải thích, số đáp án sai đã khai báo nhầm lẫn; bài không có quiz, hoặc quiz dưới 3 câu, được đánh dấu "ít dữ liệu".
- Quiz độc lập (không gắn bài) có dòng riêng "Không được cá nhân hoá" (gap có chủ ý của §4.4, nay nói ra thay vì im lặng).
- Không có ngưỡng chặn: bảng chỉ thông tin. Khoá `personalizationEnabled = false` không hiện bảng, không sinh dữ liệu gì mới.

**Đã làm (31/10/2026):**
- `core-lms/courses/personalizationReadiness.ts` (`getPersonalizationReadiness`, 10 test trên DB): `forSale` (đơn giá > 0, gói đang bán, hoặc mã chưa thu hồi), bảng theo bài (quiz, câu, câu có giải thích — chuỗi khoảng trắng không tính, đáp án sai đã khai báo nhầm lẫn, `thin` khi < 3 câu), quiz độc lập. Quiz ẩn không tính. Chỉ người sửa được khoá gọi được.
- Trang sửa khoá (tab Tổng quan, dưới "Thông tin course"): panel "Sẵn sàng cá nhân hoá", chỉ hiện khi cờ bật.
- Nút Publish: khoá bán + cờ tắt → hộp cảnh báo với ba lựa chọn "Bật cá nhân hoá rồi Publish", "Publish không bật", "Huỷ". Khoá miễn phí hoặc cờ đã bật thì Publish thẳng như cũ.
- Đã xem trên dev: ba lựa chọn chạy đúng (Huỷ không đổi gì; "không bật" giữ cờ tắt và xuất bản; "bật rồi Publish" bật cờ và xuất bản).
- Chưa làm: ghi chú trong bảng cho khoá nhiều quiz/bài khi màn hình hẹp (cột cuối phải cuộn ngang); cảnh báo chưa có test giao diện tự động.

## AC2 — Mọi đường nhập câu hỏi hàng loạt đều gắn chủ đề (khoá hồi quy)

Đã đúng theo mã: `bulk-import` và `mcq-import-commit` đều đi qua `createQuestion`, nơi gọi `ensureQuestionTag`. Nhà xuất bản sẽ nhập hàng trăm câu từ Word/Excel/CSV, nên cần khoá bằng test (CLAUDE.md §5.3):

- **Given** khoá bật cá nhân hoá và quiz gắn bài, **When** nhập 50 câu qua `bulk-import` và qua `mcq-import-commit`, **Then** 50/50 câu có `QuestionSkillTag` trỏ tới chủ đề của bài.
- **Given** nhập vào quiz độc lập, **Then** không câu nào được gắn (đúng gap có chủ ý), và AC1 báo điều đó.
- Nhân bản khoá, nhân bản bài, nhập gói khoá: câu sao ra vẫn có thẻ (kiểm các đường `cloneModuleTree`, `duplicateLesson`).

## AC3 — Người tự học ghi danh bằng mã hoặc mua trực tiếp nhận cá nhân hoá (khoá hồi quy)

Biến lượt chạy thử thủ công thành test tự động, vì đây là điều hứa với nhà xuất bản:

- **Given** khoá bật cá nhân hoá, học viên mới ghi danh bằng `/api/redeem-code`, **Then** `resolveFeedbackVariant` trả `personalized`.
- Ghi danh qua đơn VNPay / Stripe (không có giáo viên, không mã): cùng kết quả.
- **Given** làm quiz bài 1 sai hết, bài 2 đúng hết, **Then** nhãn bài 1 là `needs_review`, bài 2 là `solid`; trang khoá trả bước `next` cho bài 1 kèm nhãn và `skim` cho bài 2.
- **Given** câu sai có đáp án gắn nhầm lẫn, **Then** `FeedbackDelivery` mang toạ độ B9 và `remediationLessonIds` trỏ tới đúng bài (CLAUDE.md §4.8).
- Học viên không bao giờ nhận số mastery trong bất kỳ phản hồi API nào dành cho họ.

## AC4 — Gợi ý ôn/luyện không đòi "đã đánh dấu hoàn thành"

**Cần thầy chốt trước khi làm** (xem câu hỏi 1). Hướng đề xuất:

- **Given** học viên đã có dữ liệu quiz cho bài (`attempts ≥ 1`) nhưng chưa đánh dấu hoàn thành bài, **When** mở trang khoá, **Then** bước `review` (nhãn Cần ôn) và `practice` (Nên luyện) hiện cho bài đó, như khi đã hoàn thành.
- Bài chưa có dữ liệu quiz và chưa hoàn thành vẫn chỉ có thể là `next` hoặc `skim` như cũ.
- Thứ tự bước và `LEARNING_PATH_MAX_STEPS = 5` không đổi; bước `review` vẫn đứng trước `next`.
- Event `adaptive.path.shown` / `feedback.remediation.clicked` giữ nguyên để đo uptake; bước mới ghi cùng khuôn.
- Lớp đối chứng (`minimal`) vẫn không thấy lộ trình (không đổi B10).

## AC5 — Nhà xuất bản xem được tổng hợp ẩn danh, không thấy danh tính người học

**Cần thầy chốt** (câu hỏi 2). Hướng đề xuất: một tab "Tình hình học" cho chủ khoá, chỉ số liệu nhóm:

- Theo từng bài: số học viên đã có dữ liệu, và tỉ lệ ở từng nhãn **Cần ôn / Nên luyện / Vững** (dùng đúng ngưỡng nhãn học viên thấy, 0,6 / 0,85; không dùng số mastery).
- Theo từng bài: các câu sai nhiều nhất và đáp án sai hay chọn nhất (đã có `item-analytics`, nối vào).
- **Không hiện tên, email, ảnh hay mã học viên.** Nhóm nhỏ (ít hơn k học viên có dữ liệu, đề xuất k = 10) hiện "chưa đủ dữ liệu" thay vì tỉ lệ, để không suy ra từng người.
- Học viên của lớp có giáo viên (khoá có lớp, giảng viên là người dạy) vẫn dùng `learner-insights` như hiện nay cho đúng lớp mình dạy. Nhà xuất bản chỉ thấy bản ẩn danh trên học viên tự ghi danh.
- Ai không phải chủ/đồng giảng viên của khoá không mở được; kiểm quyền cả ở route lẫn ở trang.

---

## Câu hỏi cần thầy chốt

1. **AC4:** bài mới có dữ liệu quiz, chưa hoàn thành, có hiện "Cần ôn / Nên luyện" ngay không? Đề xuất: **có**. Đổi lại, bài đó vừa là `next` vừa có thể là `review` (khuôn hiện tại cho phép, nhưng chưa thấy ai thử).
2. **AC5:** nhà xuất bản có được thấy danh tính học viên tự ghi danh không? Đề xuất: **không**, chỉ ẩn danh, k = 10. Nếu hợp đồng với nhà xuất bản cần danh tính (hỗ trợ khách hàng), phải có đồng ý của học viên, và đó là việc riêng.
3. **AC1:** cảnh báo mềm hay chặn xuất bản khi khoá bán mà tắt cá nhân hoá? Đề xuất: **mềm**, vì có khoá bán nhưng cố ý để LMS thuần.

## Để P1

- Bài kiểm tra đầu vào xếp lộ trình ban đầu (hiện chỉ có gợi ý "lướt qua" **sau** khi đã làm quiz).
- Lời nhắc ở trang khoá khi chưa có dữ liệu: "Làm quiz bài X để nhận gợi ý riêng".
- Ngưỡng bằng chứng tối thiểu cho nhãn (khoá ngoại ngữ đã có `LANGUAGE_PROFILE_MIN_EVIDENCE`; khoá thường hiện có nhãn sau **một** lượt làm 3 câu).
- Xuất và xoá hồ sơ cá nhân hoá của người học theo yêu cầu (CLAUDE.md §5.4): cần kiểm đã có chưa trước khi hứa.
- Trợ giảng AI cho người tự học ("hỏi thêm"), chịu hạn mức token của ví AI.
- Báo cáo hiệu quả cho nhà xuất bản (uptake lộ trình, cải thiện sau ôn) từ các event đã có.

## Chưa kiểm khi viết

- Nút "Chỗ này mình chưa rõ — hỏi thêm" và hạn mức token áp dụng cho người tự học.
- Flashcard ôn cách quãng và trang kỹ năng với khoá không phải ngoại ngữ.
- Cách `FeedbackTemplate` theo nhầm lẫn hiện ra: mẫu chỉ được dùng khi **câu hỏi không có lời giải thích riêng** (`compose.ts`, B11), nên lúc chạy thử mẫu không hiện vì câu có giải thích. Đó là thiết kế, không phải lỗi; AC1 đếm "số câu có giải thích" để tác giả biết.
- Nhãn trên khoá thật nhiều bài và nhiều học viên: mới thử 1 học viên, 9 câu.

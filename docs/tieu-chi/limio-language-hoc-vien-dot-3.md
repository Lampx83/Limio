# Limio Language — Chi tiết bài học, đợt 3 (làm câu hỏi ngay trong bài, tái dùng bộ máy "Luyện đề") — Acceptance criteria

> Bản nháp **v2** 09/11/2026, **đã duyệt; 3a đã commit (`65c5b66c`), 3b đã code (xem "Đã làm 3b" ở cuối), chưa commit.** v1 dựng câu hỏi tại chỗ trên `Quiz`; v2 đổi sang tái dùng bộ máy **đoạn văn + câu hỏi + luyện đề** của hệ thống Đề thi theo gợi ý của thầy. Thiết kế: Figma "Limio Language", 4 frame bài học. Tiếp nối đợt 1 (`aa9a7e63`) và đợt 2 (`9f03a9da`).

> **Cập nhật 10/11/2026:** cách soạn "chọn một đề thi thử" của khối Bài luyện đã được thay bởi editor riêng — xem `docs/tieu-chi/limio-language-bai-luyen-editor.md` (khối sở hữu nội dung, không qua mục Đề thi).

## Vì sao làm

Trong Figma, học viên đọc/nghe và **trả lời câu hỏi ngay trong bài**: chọn đáp án, bấm "Kiểm tra câu n", thấy đúng/sai kèm giải thích và dẫn chứng, rồi sang bài kế; có thanh bài trong Unit, bố cục chia đôi (bài đọc | câu hỏi) và bài nghe có transcript.

## Vì sao tái dùng "Luyện đề" thay vì Quiz (đối chiếu mã 09/11/2026)

Hệ thống Đề thi đã có gần hết thứ Figma cần, và **chưa có trong Quiz**:

| Figma cần | Đề thi / Luyện đề đã có | Quiz hiện có |
|---|---|---|
| Đoạn văn kèm nhiều câu hỏi, chia đôi | `ExamPassage` (nội dung dạng Tiptap: chữ, ảnh, âm thanh); `PracticePlayer` đã chia đôi `lg:grid-cols-[1.1fr_1fr]`, cột đoạn văn cuộn độc lập | Không có đoạn văn |
| "Kiểm tra câu n" xem đúng/sai ngay | `POST /api/practice-sessions/[id]/check/[questionId]` + cột `ExamPracticeAnswer.checkedAt` **đã có** | Máy chủ chấm sẵn nhưng không trả về; chỉ hiện khi nộp cả lượt |
| Nhiều dạng câu (điền, ghép, kéo thả, tự luận…) | Mọi dạng `ExamQuestion` | Làm tại chỗ chỉ khả thi cho 3 dạng chọn |
| Dẫn chứng | Cột `ExamQuestion.evidenceSpan` **đã có** trong schema và API (chưa có giao diện nào dùng) | Không có |
| Giải thích | `config.explanation` (nhập từ Excel đã đọc được) | `explanation` |
| Lưu tự động, làm tiếp sau | `ExamPracticeSession` + `ExamPracticeAnswer`, tự lưu | Lượt làm bài |
| Ghi nhận kỹ năng | Sự kiện `exam.practice.answered` đã mang `skillIds` và `languageSkill` | `quiz.question.answered` |
| Nhập liệu, ngân hàng câu hỏi, gắn kỹ năng | Trình soạn Đề thi, nhập Excel, ngân hàng câu hỏi quen tay giảng viên | Trình soạn quiz |

**Cái giá phải nói thẳng**
1. **Đường cá nhân hoá khác nhau:** câu trả lời `Quiz` đi vào BKT và phản hồi chẩn đoán; câu trả lời **luyện đề hiện chỉ ghi sự kiện** `exam.practice.answered`, chưa có bộ phận nào đọc nó để cập nhật `LearnerSkillState`. Sự kiện đã mang `skillIds` nên nối sau được mà **không cần migration**; đợt này **không** làm cầu nối đó. Hệ quả: câu hỏi làm trong bài **không** làm đổi nhãn Cần ôn/Nên luyện/Vững cho tới khi có cầu nối (ghi rõ ở "Giới hạn").
2. **`PracticePlayer` và `ExamQuestion` đang có thay đổi chưa commit của việc khác** (ô nhập có cấu trúc, +232 dòng). Đợt này **chỉ import** chúng, không sửa tại chỗ; làm lớp vỏ mới `LessonPractice` ở vỏ Figma bên cạnh, để khỏi giẫm lên việc kia.
3. `PracticePlayer` là vỏ "phòng thi" chung (nút xanh, khung vuông), không phải vỏ Figma, và là trang riêng (có chuyển hướng tới trang kết quả). Cần một **bản nhúng** trong trang bài, không chuyển trang.
4. Bộ máy luyện đề gắn với một **Đề thi** (`Exam`): phải xuất bản, bật "Cho luyện đề". Bài học cần một cách **trỏ tới đề**.

## Phạm vi

- **Có:** (A) khung bài học kiểu Language; (B) khối "Bài luyện" nhúng trong bài, dùng bộ máy luyện đề; (C) chia đôi; (D) dẫn chứng và (với bài nghe) transcript.
- **Chỉ áp dụng khi** vỏ Language, vai học viên, khoá bật "Chế độ ngoại ngữ". Bài khác và trang quiz cũ giữ **nguyên**.
- **Một thay đổi schema:** thêm giá trị `exam_practice` vào enum `ContentType` (khối nội dung "Bài luyện" của bài, payload `{ examId }`); không bảng mới, không cột mới (`checkedAt`, `evidenceSpan` đã có).
- **Không làm:** cầu nối `exam.practice.answered` → BKT, panel "AI trợ giảng" kiểu mới (đã có AI trợ giảng và "Hỏi AI" trên vùng chọn), "Đã lưu vào sổ từ", đánh dấu cụm từ, sóng âm, chọn vùng dẫn chứng bằng chuột trong trình soạn (đợt này nhập chỉ số), sửa `PracticePlayer`/`ExamQuestion`.

## AC1 — Khung bài học (vỏ Language)

- **Given** học viên ở vỏ Language mở một bài của khoá ngoại ngữ, **Then** thấy: link "Về lộ trình" (`/language?course=<slug>`), tiêu đề Unit, "x / y bài hoàn thành", thanh bài trong Unit; breadcrumb "Học / <Khoá> / <Unit> / <Bài>"; tiêu đề bài kèm thẻ kỹ năng (Đọc, Nghe, Nói, Viết) nếu bài có `languageSkill`.
- **Thanh bài trong Unit:** mỗi dòng tên bài, số phút (chỉ khi có `durationSec`, làm tròn lên), trạng thái Đã xong / Đang xem / Chưa học / Khoá; bài đang xem được tô; bài khoá hiện nhưng không bấm được; không có bài ẩn. Dùng đúng nguồn `getCourseProgress`. Cuối thanh có "Sẵn sàng vận dụng? Luyện đề" khi khoá có đề (cùng quy tắc đợt 1).
- **Responsive (§4.6):** từ `lg` thanh nằm bên trái; dưới `lg` thu thành khối mở/đóng "Bài trong unit"; không cuộn ngang ở 375px.
- **Tab "Bài học | Từ vựng · n":** chỉ khi bài có khối từ vựng; n là tổng từ của các khối `vocab_list` hiển thị; khối từ vựng chuyển sang tab Từ vựng (không lặp). Bài không có từ vựng thì không có tab.
- **Chân trang:** "Tiếp theo: <tên bài kế>" và nút **Bài tập tiếp theo →** tới bài kế mở được; bài cuối thì thành "Về lộ trình".
- Không đổi: hoàn thành bài, `LearningEvent`, annotation, ghi chú, AI trợ giảng, in bài, chế độ giảng viên xem thử (`?preview=1` giữ bố cục cũ).

## AC2 — Khối "Bài luyện" nhúng trong bài

- **Giảng viên:** thêm khối **"Bài luyện"** vào bài ("+ Thêm hoạt động/tài nguyên"), chọn một **Đề thi của cùng khoá**. Đề phải `published`; chọn đề chưa xuất bản hoặc đề của khoá khác → từ chối (`validation_failed`). Đề đã tắt "Cho luyện đề" thì khối vẫn lưu được nhưng học viên thấy thông báo "Bài luyện đang tắt". Cập nhật `GIAO-DIEN.md` **trước**, rồi hướng dẫn của Lily (kèm `useCases`); `teacherAssistantFreshness` vẫn xanh.
- **Học viên:** khối hiện **tại chỗ trong bài** (không chuyển trang): đoạn văn (nếu đề có) và các câu hỏi theo vỏ Figma, tiến độ "x đã kiểm tra · y đã chọn · z chưa trả lời" và bộ nhảy tới từng câu.
- **Lượt làm:** `startPracticeSession` (phạm vi cả đề) được gọi **khi chọn đáp án đầu tiên**, không gọi lúc mở trang; có lượt đang làm dở thì dùng lại lượt đó. Mọi quy tắc sẵn có (đề xuất bản, `allowPractice`, ghi danh) giữ nguyên; bị chặn thì nói lý do và không để trang trống.
- **Chọn đáp án:** tự lưu qua `savePracticeAnswer`; dòng "Đã lưu câu trả lời · x / y câu" cập nhật; mất mạng thì báo, không mất đáp án đang chọn.
- **Kiểm tra câu n:** qua API sẵn có; nút khoá khi chưa trả lời. Kết quả hiện đúng/sai, đáp án đúng (khi sai) và giải thích (`config.explanation`, chữ thuần). Câu tự luận báo "không kiểm tra tự động được" như hiện nay. Sửa đáp án sau khi kiểm tra thì kết quả cũ bị xoá và phải kiểm tra lại (hành vi của luyện đề, giữ nguyên).
- **Mọi dạng câu** của Đề thi dùng được (không giới hạn ở trắc nghiệm).
- **Rò đáp án:** dữ liệu gửi cho trình duyệt **trước khi kiểm tra** không chứa đáp án đúng, giải thích hay dẫn chứng (dùng lại bộ lọc `public-config`); sau khi kiểm tra mới có. Có test.
- **Kết thúc:** khi mọi câu đã được kiểm tra hoặc học viên bấm "Kết thúc bài luyện", gọi `completePracticeSession` và hiện **tóm tắt tại chỗ** (số câu đúng theo kỹ năng, câu sai) kèm liên kết "Xem chi tiết" tới trang kết quả luyện đề sẵn có; có nút "Luyện lại" mở phiên mới.
- **Sự kiện:** dùng nguyên `exam.practice.answered` / `exam.practice.completed`; **không** thêm sự kiện mới, **không** migration ngoài enum.
- **Quyền:** chưa ghi danh → không làm được (như hiện nay); người xem thử (`previewable`) không thấy phần làm bài.

## AC3 — Bố cục chia đôi

- **Điều kiện tự bật:** khối Bài luyện có **đoạn văn** (Đề thi có `ExamPassage` cho các câu đó), màn hình từ `lg`. Không có đoạn văn thì một cột. Học viên có nút "Chia đôi / Một cột" để đổi; lựa chọn nhớ trong trình duyệt (chỉ là tiện lợi, không lưu server).
- **Chia đôi:** cột trái là đoạn văn, cuộn **độc lập**; cột phải là các câu hỏi cùng bộ nhảy. **Nhiều đoạn:** mỗi đoạn là một bước, có "← Quay lại / Tiếp →" như `PracticePlayer` (câu hỏi của đoạn nào hiện cạnh đoạn đó). Dưới `lg` luôn xếp dọc.
- **Nội dung đọc của bài** (văn bản/Markdown ở khối khác) giữ ở vị trí cũ phía trên, không bị kéo vào cột.
- Đoạn văn là văn bản đã làm sạch như hiện nay; chia đôi không làm mất annotation hay "Hỏi AI" trên vùng chọn ở phần nội dung của bài.

## AC4 — Dẫn chứng và bài nghe

- **Dẫn chứng:** dùng cột `evidenceSpan` **đã có** (`{ startOffset, endOffset }` trên bản chữ thuần của đoạn). Sau khi kiểm tra, câu có `evidenceSpan` hiện nút **"Xem dẫn chứng"**: bấm thì cuộn đoạn văn tới vị trí và tô sáng vùng đó. Offset ngoài phạm vi hoặc đoạn đã sửa lệch thì **ẩn nút**, không ném lỗi.
- **Giảng viên:** trình soạn câu hỏi của đề có ô "Dẫn chứng (từ ký tự … đến …)" để nhập hai chỉ số, kèm ô xem trước vùng được tô; sai (âm, đầu > cuối, quá dài đoạn) thì từ chối. Cập nhật `GIAO-DIEN.md` và Lily như AC2. (Chọn vùng bằng chuột là việc sau.)
- **Bài nghe:** đoạn có âm thanh dùng trình phát sẵn có (luyện đề phát tự do); **nút "Xem dẫn chứng" không hiện** nếu vùng dẫn chứng thuộc phần lời thoại mà giảng viên không cho học viên xem (kiểm tra bằng cùng cờ hiển thị lời thoại); không để lời thoại lọt vào HTML hay JSON.
- **Transcript đánh số đoạn (①②…) và "Mở/Đóng transcript"** chỉ áp dụng cho khối **Audio (bài nghe)** của bài (đã có trình phát): đánh số theo dòng trống, mặc định đóng, tôn trọng cờ "Cho học viên xem lời thoại". Không áp dụng cho video.

## AC5 — Quyền, riêng tư, hiệu năng

- Mọi API dùng lại **không đổi quyền**: chỉ chủ lượt; lượt người khác hoặc câu ngoài phạm vi → lỗi như hiện nay; chưa đăng nhập → 401.
- Một lần tải trang bài có số truy vấn cố định theo số khối (không N+1 theo câu); thanh bài dùng một lần `getCourseProgress`.
- Bài có khối Bài luyện **không** làm hỏng các việc sẵn có của bài (hoàn thành bài, tiến độ).
- Xuất/xoá dữ liệu cá nhân không đổi (`ExamPracticeAnswer` đã nằm trong đó).

## AC6 — Kiểm thử và xong

- Test lõi: chọn đề hợp lệ (cùng khoá, đã xuất bản), từ chối đề khác khoá/nháp; khối `exam_practice` lọt vào bản sao khoá, nhập/xuất và `registerLessonMedia`/quét bản quyền không vỡ; `evidenceSpan` kiểm hợp lệ.
- Test giao diện: thanh bài (trạng thái, khoá, số phút), chia đôi và một cột, nhiều đoạn, kiểm tra câu, tóm tắt, "Xem dẫn chứng" ẩn khi lệch/không có quyền xem lời thoại, **không rò đáp án trước khi kiểm tra**.
- `tsc` sạch, web và core-lms xanh; xem bằng mắt trên dev ở 375px và desktop, so với 4 frame Figma, ghi rõ chỗ khác. Không sửa `PracticePlayer`/`ExamQuestion`/`AnswerReview`.
- Không commit, không push khi chưa được thầy bảo.

## Giới hạn nói thẳng

- Câu làm trong bài **chưa** cập nhật nhãn Cần ôn/Nên luyện/Vững (cần cầu nối sự kiện → BKT ở đợt sau).
- Không có độ tự tin (luyện đề không có bước này), không có số lần làm giới hạn, không vào sổ điểm: đây là **luyện tập**, không phải bài kiểm tra.
- Video chỉ có chia đôi, chưa đánh số đoạn transcript.

## Đề xuất chia nhỏ

1. **3a** — AC1 (khung bài học) + AC3 phần bố cục: thuần giao diện, không schema.
2. **3b** — AC2 (khối Bài luyện nhúng): enum `exam_practice`, lớp vỏ `LessonPractice`, phần chọn đề của giảng viên.
3. **3c** — AC4 (dẫn chứng, transcript nghe).

## Cần thầy chốt (mặc định đề xuất in đậm)

1. Tái dùng bộ máy **luyện đề** làm nền (v2) thay vì dựng trên Quiz (v1): **đồng ý?**
2. Chấp nhận **giới hạn "chưa đổi nhãn Vững/Cần ôn"** ở đợt này, nối BKT ở đợt sau?
3. Làm **lớp vỏ mới `LessonPractice`** và không sửa `PracticePlayer`/`ExamQuestion` (đang có việc khác chưa commit)?
4. Chia **3a → 3b → 3c**, mỗi phần dừng để duyệt?
5. Dẫn chứng đợt này nhập **chỉ số ký tự** (chọn vùng bằng chuột để sau)?

## Đã làm 3a (09/11/2026, chưa commit)

- **Lõi** `core-lms/language/lessonFrame.ts`: hàm thuần `buildLessonFrame` (thanh bài trong Unit với 4 trạng thái, số phút, bài kế mở được) dùng nguồn `getCourseProgress`; `loadLessonDurations`. Không schema, không migration.
- **Web:** `components/language/LessonFrame.tsx` (thanh bài, breadcrumb, tab Bài học/Từ vựng, chân trang), `lib/lessonFrameView.ts`; trang bài `learn/[slug]/lessons/[lessonId]/page.tsx` được bọc có điều kiện (vỏ Language, vai học viên, khoá ngoại ngữ, đã ghi danh, không xem thử/chiếu lớp/chế độ giảng viên); thẻ kỹ năng cạnh tên Unit.
- **Kiểm thử:** web 213 file / 2504 test xanh, `core-lms` test `language` xanh, `tsc` sạch ở cả hai gói. Xem trên dev ở 1280px và 375px: thanh bài bên trái, "Bài trong unit" thu gọn ở điện thoại, không tràn ngang, bài ở vỏ thường **giữ nguyên** (không có thanh bài, không có breadcrumb).
- **Chỉnh khi làm:**
  - Liên kết "← <tên khoá>" cũ ở đầu bài bị bỏ trong khung Language (đã có breadcrumb và "Về lộ trình").
  - Bài **chỉ toàn từ vựng** không tách tab (tab "Bài học" sẽ trống): hiện thẳng như cũ.
- **Dời sang 3b:** phần "chia đôi" của AC3. Chia đôi chỉ có nghĩa khi bài có khối "Bài luyện" (đoạn văn + câu hỏi), nên làm cùng 3b.
- **Chưa xem bằng mắt:** tab "Bài học | Từ vựng" trên dữ liệu thật (khoá demo chưa có bài vừa có nội dung vừa có từ vựng; đã có test render), số phút ở thanh bài (dữ liệu demo chưa khai báo `durationSec`), thanh bài khi có bài khoá.
- **Lưu ý khi commit:** `learn/[slug]/lessons/[lessonId]/page.tsx` và `core-lms/src/language/index.ts` chỉ có thay đổi của 3a; không file dùng chung nào có thay đổi của việc khác lẫn vào.

## Đã làm 3b (09/11/2026, chưa commit)

- **Schema + migration `20261109200000_exam_practice_content_type`:** chỉ thêm giá trị `exam_practice` vào enum `ContentType` (không cột, không bảng mới). Áp lên DB dev bằng `migrate deploy`, DB test bằng `db push`.
- **Lõi:** `ExamPracticePayload` (`{ examId, title? }`) và kiểm ở `contents.ts` khi tạo/sửa (`courses/practiceBlock.ts`): đề phải **cùng khoá, đề thi viết, là đề thi thử, đã xuất bản**; `listSelectablePracticeExams` cho ô chọn đề; `getPracticeForEmbed` (`exam/practice.ts`, chỉ đọc, không tạo buổi luyện, dùng cấu hình công khai); nhân đôi khoá **bỏ** khối này, nhân đôi bài trong cùng khoá giữ.
- **API:** `GET /api/lessons/[lessonId]/practice-exams`. Chấm, lưu, kiểm tra, kết thúc **dùng nguyên** `/api/exams/[id]/practice` và `/api/practice-sessions/...` đã có (không route chấm mới).
- **Giao diện học viên:** `LessonPractice` (vỏ Figma; chia đôi/một cột nhớ ở trình duyệt, tự lưu, "Kiểm tra câu n", nạp lại kết quả đã kiểm tra khi mở lại bài, tóm tắt theo kỹ năng, "Luyện lại"), `PracticeBlockNotice` (bài luyện tắt/không dùng được, và thẻ dẫn sang trang luyện đề ở vỏ thường), `lib/lessonPracticeView.ts`; `LessonContent` nhận thêm `blocks`. **Không sửa** `PracticePlayer`, `ExamQuestion`, `AnswerReview`.
- **Giao diện giảng viên:** tile "Bài luyện" ở bộ chọn hoạt động, ô "Đề thi thử" + "Tiêu đề bài luyện" ở form thêm/sửa khối (`PracticeBlockFields`), dòng hiển thị trong danh sách khối; `GIAO-DIEN.md` và hướng dẫn của Lily (mục mới "giao-trinh-bai-luyen", tách ra khỏi "ngoai-ngu" vì mục đó vượt 1.500 chữ).
- **Kiểm thử:** web 216 file / 2527 test xanh, `core-lms` (language, courses, exam) 112 file / 1415 test xanh, `tsc` sạch ở cả hai gói. Xem trên dev với khoá demo + đề "Thi thử HSK 3 (demo)": chọn đáp án tự tạo buổi luyện, "Kiểm tra câu 1" ra "Chính xác", mở lại bài thì kết quả được nạp lại, 375px không tràn ngang và ẩn nút bố cục, danh sách khối của giảng viên hiện dòng "Bài luyện".
- **Chưa xem bằng mắt:** form thêm khối "Bài luyện" (bộ chọn đề), câu trả lời sai (đã có test), tóm tắt khi kết thúc (đã có test), đoạn văn có ảnh/âm thanh thật.
- **Khác tiêu chí v2:** khối chỉ chọn được đề **thi thử** (`mockMode`), vì bộ máy luyện đề chỉ chạy với loại đề đó; đã ghi vào thông báo của ô chọn và vào `GIAO-DIEN.md`.
- **Dữ liệu dev đã dùng để xem:** thêm tạm một khối "Bài luyện" vào bài "Đọc: Giới thiệu bản thân" của khoá demo và một buổi luyện của giảng viên mẫu, **đã xoá cả hai**; sự kiện `exam.practice.*` đã ghi vẫn còn (append-only).
- **Lưu ý khi commit:** `schema.prisma` và `courses/courses.ts` có thay đổi của việc khác cùng file (B12/B16): chỉ staging phần của 3b (một giá trị enum; một dòng `continue` trong nhân đôi khoá). `teacherAssistantGuide.ts` đổi cả dòng đã commit ở đợt 2 (tách mục).

## Quyết định về 3c (09/11/2026)

Thầy chốt: **bỏ phần dẫn chứng nhập chỉ số ký tự** (`evidenceSpan`) vì quá thủ công. Giảng viên chỉ ra đoạn chứng minh đáp án ngay trong ô **"Giải thích đáp án"** sẵn có của trình soạn câu hỏi (lưu ở `config.explanation`); ô này đã hiện cho học viên sau "Kiểm tra câu n" trong Bài luyện (3b).

- **Bỏ:** nút "Xem dẫn chứng", ô nhập chỉ số, tô sáng vùng dẫn chứng. Cột `evidenceSpan` vẫn nằm trong schema, chưa dùng.
- **Làm (chữ hướng dẫn):** ô "Giải thích đáp án" ở trình soạn câu hỏi của đề nói rõ giải thích hiện ngay sau "Kiểm tra câu n" ở Bài luyện và gợi ý nêu đoạn nào chứng minh đáp án. Chưa commit.
- **Làm tiếp (thầy bảo "tiếp tục 3c"):** transcript đánh số đoạn ①②… cho khối **Audio** của bài, chỉ trong khung bài học Language. Tách đoạn theo dòng trống; từ hai đoạn trở lên mới đánh số; mặc định vẫn gấp; bài nghe hiểu đã ẩn lời thoại thì **không** có lời thoại trong mã (đã có test); lời thoại luôn là chữ thuần. Bài ngoài khung Language giữ nguyên. Không dùng cho video (video giữ transcript hiện có). Tác dụng: giảng viên viết "đoạn ②" trong "Giải thích đáp án" và học viên tìm được đoạn đó. Không schema, không API mới. Chưa commit.

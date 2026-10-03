# LANG — Ngoại ngữ: 4 kỹ năng, từ vựng/flashcard, thi thử

> Acceptance criteria, viết trước khi code theo CLAUDE.md §6.
> Feature ID `LANG.*` là **tạm** — chưa có trong SPEC.docx; đổi khi spec được cập nhật.
>
> **Mục tiêu:** cho khoá ngoại ngữ một lớp trình bày và luyện tập theo bốn kỹ năng
> (nghe/nói/đọc/viết) cộng từ vựng và thi thử, **không thêm module nghiệp vụ thứ 4**.
> Mọi thứ đi qua `Skill`, `LearningEvent` và các bảng cầu nối hiện có; `apps/web` điều phối.
>
> Wireframe đã duyệt sơ bộ trong phiên làm việc: trang hồ sơ (radar 4 kỹ năng, "Luyện hôm nay",
> khối từ vựng, khối thi thử), màn ôn flashcard, màn trước phòng thi và màn kết quả.

## Tiêu chí chung cho mọi giai đoạn

- [ ] Viết test từ checklist rồi mới code.
- [ ] Hành vi có ý nghĩa nghiệp vụ emit `LearningEvent` trong cùng transaction; tên `<domain>.<entity>.<verb_past>`, có schema.
- [ ] `core-lms`, `core-feedback`, `core-gamification` không import nhau; chỉ qua bảng và event. Hằng số dùng chung đặt ở `packages/shared-types`.
- [ ] Đổi schema bằng `prisma migrate`; không đụng `LearningEvent` (append-only).
- [ ] Chuỗi giao diện đúng thuật ngữ §4.6.1; responsive theo §4.6.
- [ ] Endpoint dữ liệu học viên xác thực và phân quyền; export/xoá dữ liệu cá nhân không bỏ sót.
- [ ] Xem bằng mắt trên mobile và desktop trước khi báo xong.
- [ ] Mỗi giai đoạn kết thúc bằng một điểm dừng để review.

---

## G0 · Kiểm tra trước khi code — KẾT QUẢ (2026-10-03)

- [x] **LANG.0.1 Speech-to-text.** Đã có đường STT: `openAiSpeechToText` trong `packages/core-feedback/src/oralExam/openaiVoice.ts` dùng `whisper-1`, tham số `language` tường minh, và `OralExamLanguage` đã có `zh`. **Chưa kiểm chứng được quyền của key thật** (key lưu qua admin/integrations trên server, không đọc được từ repo). Cần một lần gọi thử bằng key đó — xem lệnh bên dưới. Kết quả quyết định G7.
  - **2026-10-03:** lần thử đầu thất bại vì shell không có `OPENAI_API_KEY` (chưa tới bước xét quyền). Chủ dự án sẽ tự bật quyền speech-to-text trong cấu hình OpenAI; chạy lại lệnh thử sau khi bật để xác nhận. G7 chờ bước này.
- [x] **LANG.0.2 Giờ riêng từng phần thi.** **Chưa có.** `ExamSection` chỉ có `title`, `orderIndex`, `selectionMode`, `resolutionMode`, `poolFilter`; không có giờ hay khoá thứ tự. `ExamAttempt` chỉ có một `durationSec` đóng băng lúc bắt đầu (một đồng hồ cho cả đề). G5 phải thêm giờ theo phần và khoá thứ tự — việc này chạm cả luồng làm bài.
- [x] **LANG.0.3 Nơi gắn nhãn kỹ năng.** `Skill` chỉ có `code`, `name`, `description`. Tag bài qua `ContentSkillMapping`; tag câu hỏi qua `QuestionSkillTag`, `ExamQuestionSkillTag`, `ExamPassageSkillTag`, `BankQuestionSkillTag`. `LearnerSkillState` có `masteryProbability`, `attempts`, `correctCount`, index `(userId, masteryProbability)`. **Đề xuất:** thêm cột nullable `languageSkill` trên `Lesson` (nguồn do giảng viên đặt), `autoTags` sao nó sang `Skill` tự sinh của bài; hồ sơ gộp `LearnerSkillState` theo cột này qua `Skill`. Đề thi dùng chung `Skill` nên kết quả thi thử tự vào cùng chiều. Hằng số enum đặt ở `packages/shared-types/src/skills.ts`.
- [x] **LANG.0.4 Chi phí token.** Ví token đã có (`packages/core-feedback/src/aiTutor/tokenWallet.ts`): `chargeTokens`, `assertHasTokenBudget`, hạn mức tháng cho học viên và giảng viên, ước lượng `AVG_TOKENS_PER_GRADING` (giả định bài 300 từ). Chấm bài tập bằng AI đã có đường đi (`AssessmentMode.ai_assessed`, `assignments.ts`). G6 dùng lại; chỉ cần đo thêm chi phí của audio (STT) vì ví hiện tính theo token chữ.

### Lệnh kiểm tra quyền STT của key (chạy ở máy bạn, KHÔNG dán key vào chat)

```bash
say -v Tingting "你好，谢谢" -o /tmp/stt-test.aiff && curl -s https://api.openai.com/v1/audio/transcriptions -H "Authorization: Bearer $OPENAI_API_KEY" -F model=whisper-1 -F language=zh -F file=@/tmp/stt-test.aiff
```

Kết quả `{"text":"你好,谢谢"}` nghĩa là key có quyền. Lỗi 401/403 nghĩa là key Restricted thiếu quyền Audio → bật quyền "Model capabilities" cho key rồi thử lại.

---

## G1 · Loại nội dung `audio`

**Đã chốt (2026-10-03):** định dạng `mp3/m4a/ogg/webm`, **bỏ wav** (10 phút wav stereo ≈ 106 MB); giới hạn **50 MB**.
**Quyết định thêm khi viết test (chờ chủ dự án xác nhận nếu muốn đổi):** upload audio chỉ cho giảng viên (401 chưa đăng nhập, 403 không phải GV — chặt hơn route video); `url` ngoài chỉ nhận https hoặc đường dẫn cùng-origin (http bị chặn mixed content; `//host` bị từ chối); lời thoại là văn bản thuần, có cờ `showTranscript` để tắt hẳn (khi tắt thì không có trong markup gửi về học viên).
**Chưa chốt:** AUD.5 (đo thời gian nghe) — test mới ở dạng `it.todo`.

**Trạng thái code (2026-10-03, nhánh `feat/lang-g1-audio`, chưa commit):** AUD.1–AUD.4 đã cài, test xanh (web 345 + 3 todo, core-lms 1174), typecheck sạch toàn workspace. **Chưa làm:** AUD.5 (đo thời gian nghe); xem bằng mắt (AUD.6.4/6.5, gồm iOS Safari); áp migration `20261003110000_add_audio_content_type` lên DB dev dùng chung (đã áp lên DB test). Ghi chú: trang in chỉ in nhãn `[audio] tiêu đề — url`, chưa in lời thoại; AI tutor chưa đọc nội dung audio.

**Test đã viết:**
- `apps/web/src/lib/lessonAudio.test.ts` — luật định dạng/dung lượng
- `apps/web/src/app/api/lesson-media/audio/route.test.ts` — POST upload
- `apps/web/src/app/api/lesson-media/audio/[file]/route.test.ts` — GET phát
- `apps/web/src/components/AudioLessonPlayer.test.tsx` — trình phát + nối vào `LessonContent` + AUD.5 todo
- `packages/core-lms/src/courses/__tests__/contentAudio.test.ts` — schema, tạo/sửa, không phá lesson-as-tag
- `packages/core-lms/src/storage/__tests__/storageAudio.test.ts` — ledger, gán chủ khoá, dọn mồ côi

Chi tiết AUD.1–AUD.6 nằm trong phiên làm việc; tóm tắt:

- [ ] **AUD.1** Upload `.mp3/.m4a/.wav/.ogg/.webm` → 201; 413 quá cỡ; 415 sai MIME; 401/403 không phải giảng viên; 400 file rỗng. Lưu ở `lesson-media/audio/{yyyy}/{mm}/`.
- [ ] **AUD.2** Phát có Range (206); tên file lạ → 403; trình phát có tốc độ (0.75×/1×/1.25×) và lặp; lời thoại bật/tắt, có thể tắt hẳn.
- [ ] **AUD.3** Form thêm/sửa, `AudioPayload` zod, ẩn/đổi thứ tự như loại khác.
- [ ] **AUD.4** Ledger `lesson_audio` (cả `classifyStorageKey`, `attribution.ts`, `orphans.ts`, nhãn `admin/storage`); dọn file mồ côi; migration enum `ContentType`; không phá lesson-as-tag; trang in/export không bể.
- [ ] **AUD.5** Engagement nghe (chốt dùng lại `videoRanges` hay mới); ghi event không chặn phát.
- [ ] **AUD.6** Test route upload/serve, test `classifyStorageKey`, xem iOS Safari.

## G2 · Khối từ vựng / hội thoại có cấu trúc

**Thiết kế đề xuất:** hai loại nội dung mới, `vocab_list` (bảng từ vựng) và `dialogue` (hội thoại). Payload JSON như mọi loại khác; **mỗi dòng có `id` ổn định** (uuid sinh một lần, giữ nguyên khi sửa/đổi thứ tự) để G4 gắn flashcard vào đúng từ. Tên trường trung lập ngôn ngữ (`term`, `reading`, `meaning`) để dùng được cho tiếng Trung (chữ Hán/pinyin), tiếng Anh (từ/IPA)... Toàn bộ là văn bản thuần, hiển thị bằng text node (không HTML).

`vocab_list`: `{ title?, readingLabel?, items: [{ id, term, reading?, meaning, example?, exampleReading?, exampleMeaning?, audioUrl?, note? }] }` — tối đa 300 dòng.
`dialogue`: `{ title?, caption?, audioUrl?, speakers?, turns: [{ id, speaker, text, reading?, translation?, audioUrl? }] }` — tối đa 100 lượt.

**Trạng thái code (2026-10-03, nhánh `feat/lang-g2-vocab-dialogue`):** G2.1–G2.4 đã cài, test xanh (web 408 + 3 todo, core-lms 1195), typecheck sạch; chủ dự án đã thử trên local. Migration `20261003120000_add_vocab_dialogue_content_types` đã áp lên DB test và DB dev (chưa áp prod: tự chạy khi deploy). Chưa kiểm riêng: G2.4.4 (annotation trên chữ trong khối). Sót của G1 sửa cùng đợt: form Audio không xoá lời thoại sau khi tạo.

### Dữ liệu và kiểm tra (G2.1)
- [ ] **G2.1.1** Given `vocab_list` có dòng thiếu `term` hoặc `meaning`, when lưu, then bị từ chối (`validation_failed`); dòng chỉ có khoảng trắng cũng bị từ chối.
- [ ] **G2.1.2** Given `id` trùng nhau trong cùng khối, when lưu, then bị từ chối.
- [ ] **G2.1.3** Given quá 300 dòng từ vựng hoặc 100 lượt thoại, then bị từ chối; giới hạn độ dài từng trường (term/reading ≤ 200, meaning ≤ 500, example ≤ 1000, note ≤ 500).
- [ ] **G2.1.4** Given `audioUrl` (ở dòng hoặc lượt), then theo luật `AudioUrl` của G1 (cùng-origin hoặc https; `http:`, `javascript:`, `//host` bị từ chối).
- [ ] **G2.1.5** Given `dialogue` thiếu `speaker` hoặc `text`, then bị từ chối.
- [ ] **G2.1.6** Given sửa khối đã lưu (đổi nghĩa, thêm/xoá/đổi thứ tự dòng), then `id` của các dòng còn lại không đổi; dòng mới nhận `id` mới.
- [ ] **G2.1.7** Migration chỉ thêm hai giá trị enum `ContentType` (`vocab_list`, `dialogue`).

### Soạn bài (G2.2)
- [ ] **G2.2.1** Form thêm/sửa dạng bảng: thêm dòng, xoá dòng, đổi thứ tự, mỗi dòng có ô audio (upload qua `/api/lesson-media/audio` hoặc dán https).
- [ ] **G2.2.2** Nhập hàng loạt: dán bảng từ Excel/Google Sheets (cột phân tách bằng tab) hoặc dạng `term | reading | meaning | example` mỗi dòng một từ; dòng lỗi được liệt kê theo số dòng và không chặn các dòng đúng.
- [ ] **G2.2.3** Dán 50 dòng hợp lệ thì tạo đúng 50 dòng; dán lại cùng nội dung không tự trùng với dòng đã có trừ khi giảng viên xác nhận.
- [ ] **G2.2.4** Hội thoại: nhập nhanh dạng `A：câu thoại` mỗi lượt một dòng, tự tách `speaker`/`text`.
- [ ] **G2.2.5** Ô chọn nội dung có hai tile mới; dòng trong danh sách hiện loại và số mục ("12 từ", "8 lượt").

### Hiển thị cho học viên (G2.3)
- [ ] **G2.3.1** `vocab_list`: bảng trên màn rộng (từ · phiên âm · nghĩa), thẻ xếp dọc dưới `sm` (640px) — theo §4.6.
- [ ] **G2.3.2** Dòng có audio: nút nghe; phát dòng khác thì dừng dòng đang phát (không chồng tiếng).
- [ ] **G2.3.3** `dialogue`: mỗi lượt có người nói, nội dung, phiên âm/bản dịch (bật/tắt được), nút nghe riêng nếu có `audioUrl`; có audio toàn bài thì dùng `AudioLessonPlayer`.
- [ ] **G2.3.4** Văn bản trong khối luôn là text: thẻ HTML nhập vào hiện nguyên chữ, không thành phần tử.
- [ ] **G2.3.5** Không có dòng/lượt nào có audio thì không hiện nút nghe rỗng.
- [ ] **G2.3.6** (nếu duyệt) Chế độ "Che nghĩa": bấm để ẩn cột nghĩa/phiên âm, tự kiểm tra; nội dung vẫn có trong DOM nhưng chỉ ẩn phía giao diện (không phải bí mật như lời thoại bài nghe).

### Tích hợp (G2.4)
- [ ] **G2.4.1** File audio của từng dòng/lượt được sổ dung lượng gán đúng chủ khoá và dọn mồ côi (tên file nằm trong payload nên cơ chế tham chiếu sẵn có tìm thấy).
- [ ] **G2.4.2** Không phá lesson-as-tag: thêm khối không sinh Skill hay mapping mới.
- [ ] **G2.4.3** Trang in: in thành bảng/danh sách chữ, không bể layout; không in nút audio.
- [ ] **G2.4.4** Annotation theo vùng chọn: hoạt động bình thường trên chữ trong khối (hoặc ghi rõ nếu chưa hỗ trợ).
- [ ] **G2.4.5** Ẩn khối bằng `isHidden` như mọi loại khác.

### Quyết định đã chốt (2026-10-03)
1. Hai loại riêng: `vocab_list` và `dialogue`.
2. Audio hội thoại: **riêng từng lượt** (`turns[].audioUrl`), tuỳ chọn thêm audio cả bài (`audioUrl`). Mốc thời gian trên một file để sau (P1).
3. **Có** "Che nghĩa" ở P0 (G2.3.6).
4. Nhãn cột phiên âm do giảng viên đặt (`readingLabel`), mặc định "Phiên âm".
5. Nhập hàng loạt **chỉ dán bảng** (tab hoặc `|`); không nhập file CSV.

**Bổ sung khi viết test:** server tự gán `id` cho dòng/lượt chưa có `id` (nhập qua API, import) và giữ nguyên `id` đã có, để G4 luôn có khoá ổn định.

## G3 · Nhãn kỹ năng + hồ sơ 4 kỹ năng (chỉ đọc)

- [ ] **LANG.3.1** Khoá bật chế độ ngoại ngữ: giảng viên gắn nghe/nói/đọc/viết cho bài hoặc câu hỏi. Khoá thường không đổi gì, không sinh dữ liệu thừa.
- [ ] **LANG.3.2** Câu hỏi kế thừa nhãn từ bài; nhãn gắn tay thắng nhãn kế thừa (quy tắc §4.4).
- [ ] **LANG.3.3** Backfill idempotent, chỉ đụng khoá đã bật chế độ ngoại ngữ.
- [ ] **LANG.3.4** Hồ sơ hiện radar 4 trục và nhãn Cần ôn (<60) / Nên luyện (60–85) / Vững (≥85); không hiện số %.
- [ ] **LANG.3.5** Kỹ năng chưa đủ dữ liệu hiện "Chưa đủ dữ liệu", không gán nhãn (ngưỡng tối thiểu: cần chốt).
- [ ] **LANG.3.6** Chỉ học viên đó và giảng viên của khoá xem được; người khác 403.
- [ ] **LANG.3.7** "Luyện hôm nay" chỉ gợi ý kỹ năng yếu nhất.
- [ ] **LANG.3.8** Hồ sơ nằm trong export/xoá dữ liệu cá nhân.

## G4 · Flashcard + lịch ôn cách quãng

- [ ] **LANG.4.1** Ghi danh khoá → có bộ thẻ gồm từ vựng của khoá.
- [ ] **LANG.4.2** Chọn Quên/Khó/Được/Dễ cập nhật lịch ôn; khoảng cách hiển thị khớp kết quả tính.
- [ ] **LANG.4.3** Ba chế độ: Hán→nghĩa, Nghĩa→Hán, Nghe→Hán (cần audio).
- [ ] **LANG.4.4** Mỗi lượt ôn emit `flashcard.reviewed`, idempotent.
- [ ] **LANG.4.5** Hồ sơ hiện Đã học / Đến hạn hôm nay / Hay quên và phân bố Mới/Đang học/Nhớ lâu bằng số đếm.
- [ ] **LANG.4.6** Chống farming: trần XP mỗi ngày, bỏ qua lượt quá nhanh (nguyên tắc 5).
- [ ] **LANG.4.7** Ghi event không chặn hay làm chậm thao tác lật thẻ.
- [ ] **LANG.4.8** Trạng thái thẻ nằm trong export/xoá dữ liệu cá nhân.

## G5 · Thi thử

- [ ] **LANG.5.1** Chế độ Thi thử: các phần làm lần lượt, giờ riêng, không quay lại, đồng hồ không dừng. Chế độ Luyện từng phần không ép giờ. *(Cần thêm giờ theo phần — xem G0.2.)*
- [ ] **LANG.5.2** Audio theo `ExamPassageAudioPolicy` (nghe chỉ phát một lần).
- [ ] **LANG.5.3** Màn trước phòng thi kiểm tra loa/mic và cảnh báo đồng hồ.
- [ ] **LANG.5.4** Kết quả là khoảng ước lượng theo phần, so với lượt trước, luôn kèm "ước lượng, không phải điểm chính thức".
- [ ] **LANG.5.5** Phần Viết/Nói chờ giảng viên duyệt; không hiện điểm giả.
- [ ] **LANG.5.6** Kết quả gộp theo nhãn kỹ năng vào hồ sơ.
- [ ] **LANG.5.7** Từ làm sai được *đề xuất* thêm vào thẻ ôn; chỉ thêm khi học viên đồng ý.
- [ ] **LANG.5.8** Bảng quy đổi điểm lấy từ nguồn chính thức của từng kỳ thi.
- [ ] **LANG.5.9** Đề do giảng viên tự soạn hoặc có giấy phép; không nhập đề thật có bản quyền.

## G6 · Feedback Viết bằng AI

- [ ] **LANG.6.1** Feedback có toạ độ SSMMD đầy đủ (§4.8); thiếu là lỗi.
- [ ] **LANG.6.2** Hiện nhãn "chưa duyệt" đến khi giảng viên xác nhận.
- [ ] **LANG.6.3** Trừ ví token AI đúng mức; hết hạn mức báo rõ, không thất bại lặng lẽ.
- [ ] **LANG.6.4** Lỗi lặp lại tổng hợp lên hồ sơ.

## G7 · Feedback Nói *(chỉ làm khi G0.1 đạt)*

- [ ] **LANG.7.1** Ghi âm → chuyển văn bản → chấm theo rubric nói → feedback.
- [ ] **LANG.7.2** Ghi rõ giới hạn của chấm phát âm tự động.
- [ ] **LANG.7.3** Bản ghi âm theo chính sách lưu trữ và xoá dữ liệu cá nhân.

## G8 · Khoá mẫu ngoại ngữ

- [ ] Đóng gói chế độ ngoại ngữ, bốn kỹ năng, rubric Viết/Nói, khung đề thi thử HSK/IELTS/TOEIC (nội dung mẫu tự soạn).
- [ ] Không ảnh hưởng khoá hiện có.

---

## Quyết định còn treo

| # | Câu hỏi | Chặn |
|---|---|---|
| 1 | Định dạng audio, dung lượng tối đa, phụ đề đồng bộ | G1 |
| 2 | Event nghe: dùng lại `videoRanges` hay mới | G1 |
| 3 | Ngưỡng tối thiểu để hiện nhãn kỹ năng | G3 |
| 4 | Thứ tự trục radar; có xem theo thời gian không | G3 |
| 5 | Thuật toán lịch ôn thẻ và nơi lưu trạng thái | G4 |
| 6 | Giới hạn lượt thi thử; có hiện đáp án ở chế độ luyện | G5 |
| 7 | AI chấm sơ bộ hiện trước hay chờ giảng viên | G5, G6 |

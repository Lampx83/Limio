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

- [ ] **LANG.2.1** Khối từ vựng nhập từng dòng (chữ, phiên âm, nghĩa, ví dụ, audio tuỳ chọn); thiếu chữ hoặc nghĩa bị từ chối.
- [ ] **LANG.2.2** Khối hội thoại: bấm một câu phát audio của riêng câu đó.
- [ ] **LANG.2.3** Nhập hàng loạt (dán bảng), báo dòng lỗi.
- [ ] **LANG.2.4** Là nguồn của bộ thẻ ở G4; một từ có một danh tính trong khoá, không sinh thẻ trùng.

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

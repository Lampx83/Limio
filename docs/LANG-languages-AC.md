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

## Dữ liệu mẫu để thử trên máy (dev DB)

`packages/core-lms/scripts/seed-language-demo.ts` dựng khoá **"Tiếng Trung cơ bản (demo ngoại ngữ)"** (`/learn/demo-ngoai-ngu-tieng-trung`) cho giảng viên mẫu `giangvien.mau@feedbackme.dev`: bài nghe, hội thoại, từ vựng có audio thật (sinh bằng `say` + `afconvert` của macOS), quiz theo kỹ năng, một bài ẩn và một từ trùng giữa hai bài để thử việc gom trùng. Học viên mẫu `sv.demo.01@feedbackme.dev` có sẵn tiến độ (Nghe Cần ôn · Đọc Vững · Viết Nên luyện · Nói Chưa đủ dữ liệu) và lịch ôn flashcard đủ trạng thái. Mọi thứ đi qua hàm dịch vụ thật; chạy lại an toàn.

```bash
cd packages/core-lms
SEED_ENROLL_EMAILS="ban@example.com" NODE_OPTIONS=--max-old-space-size=1536 \
  node --env-file=../db/.env --import tsx scripts/seed-language-demo.ts
```

`SEED_ENROLL_EMAILS` ghi danh thêm tài khoản học viên **sạch** (chưa có tiến độ) để thử từ đầu. Mật khẩu của các tài khoản mẫu là `DEMO_PASSWORD` đã dùng khi chạy `seed-demo-course.ts`; không ghi vào repo.

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

## G2.5 · Nhập từ vựng bằng AI

**Mục tiêu.** Giảng viên dán văn bản thô (copy từ giáo trình, Word, PDF, bảng tính lộn xộn) vào bộ soạn từ vựng; AI tách thành các dòng từ vựng; giảng viên **xem trước, chọn dòng**, rồi thêm vào danh sách như khi dán bảng (G2.2). AI không bao giờ tự lưu khối: giảng viên vẫn bấm Tạo/Lưu.

**Làm theo tiền lệ "Nhập câu hỏi bằng AI"** (không dựng cơ chế mới):
- Hàm `extractVocabFromText` trong `core-feedback/src/aiTutor/generators.ts`, cùng `callJsonModel` với JSON schema `strict`, model mặc định `gpt-4o-mini`.
- Route `POST /api/ai/extract-vocab`: cùng quyền (giảng viên của ít nhất một khoá hoặc admin), cùng cách lấy khoá OpenAI (`getOpenaiClient`, cấu hình ở admin/integrations), cùng ánh xạ lỗi (`openai_not_configured` 503, vượt trần 429, lỗi sinh 400).
- Chặn bằng `assertWithinCaps(…, "generator")` (trần ngày toàn hệ thống **và ví token AI của giảng viên**) rồi ghi `AiUsageLog` qua `recordAiUsage`, hàm này **trừ ví token** (`chargeTokens`) — đúng như nhập câu hỏi bằng AI.
- Kết quả đi qua **một hàm chuẩn hoá xác định** (không tin đầu ra của mô hình): cùng giới hạn độ dài với `VocabItem`, tối đa 300 dòng, bỏ dòng thiếu từ hoặc nghĩa vào `skipped` kèm lý do.

### Hàm sinh (G2.5.1)
- [ ] **G2.5.1.1** Văn bản rỗng, ngắn hơn 20 ký tự hoặc dài hơn 20.000 ký tự → `validation_failed`, **trước khi** chạm tới trần AI hay OpenAI.
- [ ] **G2.5.1.2** Gọi `assertWithinCaps(userId, …, "generator")` trước OpenAI; vượt trần ngày hoặc **hết ví token** thì ném `AiTutorError` và **không gọi OpenAI**.
- [ ] **G2.5.1.3** Ghi `AiUsageLog` và **trừ ví token** đúng bằng số token vào + ra của lượt gọi.
- [ ] **G2.5.1.4** Yêu cầu gửi cho mô hình có: quy tắc "chỉ trích xuất những gì có trong văn bản", chỉ dẫn coi văn bản là **dữ liệu không đáng tin** (mệnh lệnh nằm trong văn bản bị bỏ qua), JSON schema nghiêm ngặt; văn bản của giảng viên nằm trong khối được rào, không trộn vào chỉ dẫn.
- [ ] **G2.5.1.5** Chế độ "chỉ trích xuất": dòng thiếu nghĩa **không được tự bịa**, mà vào `skipped` ("Thiếu nghĩa"). Chế độ "điền phần còn thiếu" (tuỳ chọn, tắt mặc định): AI được điền phiên âm/nghĩa/ví dụ còn trống và phải liệt kê các trường đã điền trong `filled`.
- [ ] **G2.5.1.6** Lỗi OpenAI → `openai_error`; đầu ra không phải JSON → `json_parse_failed`.

### Chuẩn hoá đầu ra (G2.5.2, hàm thuần)
- [ ] **G2.5.2.1** Cắt khoảng trắng; chuỗi rỗng coi như không có; dòng thiếu `term` hoặc `meaning` → `skipped` kèm lý do.
- [ ] **G2.5.2.2** Trường quá dài (term/reading > 200, meaning > 500, ví dụ > 1000) → dòng đó vào `skipped`, không cắt cụt âm thầm.
- [ ] **G2.5.2.3** Trùng từ trong cùng kết quả (so theo từ chuẩn hoá): giữ dòng đầu, các dòng sau vào `skipped` ("Trùng từ").
- [ ] **G2.5.2.4** Quá 300 dòng: nhận 300 dòng đầu, phần dư vào `skipped`.
- [ ] **G2.5.2.5** `filled` chỉ gồm tên trường hợp lệ (`reading`/`meaning`/`example`) **và** trường đó thực sự có giá trị; ở chế độ chỉ trích xuất, `filled` luôn rỗng.
- [ ] **G2.5.2.6** Toàn bộ là văn bản thuần: thẻ HTML mô hình trả về không thành phần tử khi hiển thị (đã đảm bảo ở G2.3.4).

### Route (G2.5.3)
- [ ] **G2.5.3.1** Chưa đăng nhập → 401; không phải giảng viên/admin → 403; thân yêu cầu sai kiểu → 400.
- [ ] **G2.5.3.2** Chưa cấu hình OpenAI → 503; vượt trần → 429; lỗi sinh → 400; thành công → `{ items, skipped }`.
- [ ] **G2.5.3.3** Route **không ghi** từ vựng vào DB; ngoài `AiUsageLog` không có thay đổi dữ liệu nào.

### Giao diện (G2.5.4)
- [ ] **G2.5.4.1** Trong bộ soạn từ vựng có mục "Nhập bằng AI": ô dán, ô chọn "Điền phiên âm và nghĩa còn thiếu" (tắt mặc định), nút "Phân tích bằng AI"; nút bị khoá khi đang chạy hoặc ô trống.
- [ ] **G2.5.4.2** Kết quả hiện thành danh sách xem trước, mặc định chọn hết; ô đã do AI điền được đánh dấu rõ ("AI điền — hãy kiểm tra"); có đếm "N dòng, M dòng bị bỏ qua" và liệt kê `skipped` kèm lý do.
- [ ] **G2.5.4.3** "Thêm các dòng đã chọn" đi qua đúng bước nhận biết từ trùng của dán bảng (hỏi trước khi thêm từ đã có); thêm xong, các dòng sửa được như mọi dòng khác.
- [ ] **G2.5.4.4** Lỗi 503/429/400 hiện lời tiếng Việt dễ hiểu, không để lộ chi tiết kỹ thuật; ô dán giữ nguyên nội dung để thử lại.
- [ ] **G2.5.4.5** Không hiện với học viên (chỉ có trong bộ soạn của giảng viên). Dùng được ở mobile.

### Quyết định đã chốt (2026-10-03)
1. Có **cả hai chế độ**: "chỉ trích xuất" (nghiêm ngặt) và tuỳ chọn "điền phiên âm/nghĩa còn thiếu" tắt mặc định, ô do AI điền được đánh dấu.
2. Đầu vào P0: **chỉ văn bản dán** (≤ 20.000 ký tự). Ảnh/PDF scan qua vision để P1.
3. Tính phí **theo tiền lệ** nhập câu hỏi: trần ngày + `AiUsageLog` **và trừ ví token AI của giảng viên**. *(Sửa 2026-10-03: bản nháp đầu ghi nhầm là "không trừ ví"; tiền lệ thật có trừ.)*
4. Chỉ **từ vựng**; dán hội thoại thô → các lượt để P1.
5. Model mặc định `gpt-4o-mini`.

**Trạng thái code (2026-10-03, nhánh `feat/lang-g25-ai-vocab-import`):** G2.5.1–G2.5.4 đã cài và commit, test xanh (web 524 + 3 todo, core-feedback 351, core-lms 1217), typecheck sạch. Không đổi schema nên không có migration. Hàm sinh, route, logic phía máy khách và hai component (`AiVocabImportPanel`, `AiVocabPreview`) nằm ở commit G2.5; việc **nối panel vào bộ soạn từ vựng** (thẻ "Nhập bằng AI") nằm ở commit giao diện bộ soạn đi kèm. **Chưa làm:** chạy với mô hình OpenAI thật (test dùng OpenAI giả nên chưa kiểm được việc mô hình làm đúng chỉ dẫn "chỉ trích xuất / điền phần thiếu / bỏ qua lệnh giả trong văn bản"). Ý tưởng đã hoãn: sinh audio bằng AI (TTS) cho từng dòng/lượt — chủ dự án chọn chưa làm.

## G3 · Nhãn kỹ năng + hồ sơ 4 kỹ năng (chỉ đọc)

**Thiết kế đề xuất.** Không thêm bảng mới và không thêm module: hồ sơ là một **phép gộp chỉ đọc** trên `LearnerSkillState` (đã do BKT cập nhật), nhóm theo "kỹ năng ngôn ngữ" của `Skill`.

- `packages/shared-types`: `LanguageSkill` = `listening | speaking | reading | writing`, thứ tự hiển thị và nhãn tiếng Việt (Nghe, Nói, Đọc, Viết). Đặt ở đây vì `core-lms` (ghi) và `core-feedback` (đọc) đều cần mà không được import nhau.
- Schema: enum `LanguageSkill`; `Course.languageMode` (mặc định `false`); `Lesson.languageSkill?` (nguồn do giảng viên đặt); `Skill.languageSkill?` (bản sao do `autoTags` đồng bộ từ bài, để phép gộp chỉ cần một join, và đề thi ở G5 dùng chung `Skill` nên tự vào cùng chiều).
- **Một bài một kỹ năng chính** (P0). Muốn tách nghe/đọc trong cùng bài thì tách thành hai bài. Nhãn riêng từng câu hỏi để P1.
- Gộp: với mỗi kỹ năng, lấy các `LearnerSkillState` của học viên thuộc `Skill` có `languageSkill` = kỹ năng đó trong khoá; `mastery` = trung bình các chủ đề đã có lượt trả lời; `evidence` = tổng `attempts`. Nhãn = `masteryLabel(mastery)` nếu đủ bằng chứng, ngược lại "Chưa đủ dữ liệu". Dùng lại ngưỡng sẵn có: **Cần ôn < 0.60 · Nên luyện thêm < 0.85 · Vững ≥ 0.85**.
- Học viên **không bao giờ nhận số mastery** (cả trong JSON của API). Radar vẽ theo *nhãn* (ba vòng), không theo số.

**Trạng thái code (2026-10-03, nhánh `feat/lang-g3-skill-profile`, chưa commit):** G3.1–G3.6 đã cài, test xanh (web 435 + 3 todo, core-lms 1214, core-feedback 285), typecheck sạch. **Chưa làm:** xem bằng mắt (trang `/learn/<slug>/skills`, công tắc "Chế độ ngoại ngữ" ở thông tin khoá, ô "Kỹ năng" trên thanh bài, mobile < 640px); áp migration `20261003130000_language_skills` lên DB dev dùng chung (đã áp lên DB test) — migration này thêm enum `LanguageSkill` và 3 cột mới (có mặc định/null), không chỉ thêm giá trị enum như G1/G2. Ghi chú đã làm: quyền xem hồ sơ người khác dùng `canGradeCourse` (gồm trợ giảng); API gộp mọi lý do "tắt" thành `unavailable` cho học viên để lớp đối chứng không tự biết mình là đối chứng; bất biến languageMode ⇒ personalizationEnabled ép ở `createCourse`/`updateCourse` theo cả hai chiều và có dòng nhật ký `course.language_mode.toggled`.

### Dữ liệu và nhãn (G3.1)
- [ ] **G3.1.1** Migration thêm enum `LanguageSkill`, ba cột nullable/mặc định nói trên; khoá và bài hiện có không đổi hành vi (`languageMode=false`, `languageSkill=null`).
- [ ] **G3.1.2** Given giảng viên đặt kỹ năng cho bài, when lưu, then `Lesson.languageSkill` lưu và `Skill` tự sinh của bài (`lesson.<id>`) được đồng bộ; đổi hoặc bỏ nhãn thì `Skill` đổi theo.
- [ ] **G3.1.3** Given khoá `personalizationEnabled=false`, then không sinh `Skill` nào dù bài có nhãn (giữ nguyên quy tắc "LMS thuần không để rác DB").
- [ ] **G3.1.4** Given bật `personalizationEnabled` hoặc chạy backfill trên khoá đã có bài mang nhãn, then `Skill.languageSkill` của các bài đó được điền; chạy lại không đổi gì (idempotent).
- [ ] **G3.1.5** `Skill` giảng viên tự tạo (không phải `lesson.*`) không bị `autoTags` đụng tới.
- [ ] **G3.1.6** Giá trị `languageSkill` ngoài bốn giá trị cho phép bị từ chối (`validation_failed`).
- [ ] **G3.1.7** Bật `languageMode` mà khoá chưa bật cá nhân hoá thì bị từ chối kèm thông báo rõ (hồ sơ cần tag kỹ năng, mà tag chỉ có khi cá nhân hoá bật).

### Gộp và nhãn (G3.2)
- [ ] **G3.2.1** Given học viên chưa có `LearnerSkillState` nào thuộc kỹ năng X, then X là "Chưa đủ dữ liệu".
- [ ] **G3.2.2** Given tổng `attempts` của kỹ năng X dưới ngưỡng (đề xuất 5), then "Chưa đủ dữ liệu" dù mastery tính được.
- [ ] **G3.2.3** Given đủ bằng chứng, then nhãn đúng ba mức tại các điểm biên (0.599 → Cần ôn · 0.60 → Nên luyện · 0.849 → Nên luyện · 0.85 → Vững).
- [ ] **G3.2.4** Chủ đề chưa có lượt trả lời nào không kéo trung bình xuống (không tính mastery mặc định 0.1 của dòng `attempts = 0`).
- [ ] **G3.2.5** Chỉ tính `Skill` thuộc bài của khoá này; trạng thái của khoá khác không lẫn vào.
- [ ] **G3.2.6** Chỉ tính bài học viên thấy được (bỏ bài/module `isHidden`), cùng bộ lọc với lộ trình cá nhân hoá.
- [ ] **G3.2.7** Kỹ năng không có bài nào được gán thì vẫn có mặt với "Chưa đủ dữ liệu" (radar luôn đủ 4 trục).

### Quyền và riêng tư (G3.3)
- [ ] **G3.3.1** Học viên xem được hồ sơ của chính mình (đã ghi danh); giảng viên của khoá (người sửa được khoá) xem được hồ sơ học viên đã ghi danh; người khác nhận 403; học viên A xem hồ sơ học viên B nhận 403.
- [ ] **G3.3.2** Phản hồi dành cho học viên **không chứa** `mastery`, xác suất hay số % nào; phản hồi dành cho giảng viên có thêm số mastery và `evidence` từng kỹ năng.
- [ ] **G3.3.3** Khoá `personalizationEnabled=false` hoặc `languageMode=false` → `enabled=false` kèm lý do, không lộ dữ liệu.
- [ ] **G3.3.4** Học viên thuộc lớp đối chứng (`feedbackVariant="minimal"`, B10) → `enabled=false` với lý do `control_variant`; giảng viên vẫn xem được để quản lớp.
- [ ] **G3.3.5** Chưa đăng nhập → 401.

### Giao diện học viên (G3.4)
- [ ] **G3.4.1** Trang `/learn/[slug]/skills` (link từ trang khoá khi `languageMode` bật): radar 4 trục Nghe, Nói, Đọc, Viết; ba vòng ứng với ba nhãn; kỹ năng chưa đủ dữ liệu là chấm rỗng viền đứt ở tâm.
- [ ] **G3.4.2** Bốn thẻ kỹ năng: tên, nhãn, một câu giải thích ngắn, số bài đã làm trên số bài của kỹ năng đó; không hiện %.
- [ ] **G3.4.3** "Luyện hôm nay": gợi ý một bài thuộc kỹ năng yếu nhất (ưu tiên Cần ôn, rồi Nên luyện; bài đã làm điểm thấp nhất, nếu chưa làm bài nào thì bài đầu chưa học của kỹ năng đó). Chỉ gợi ý, không chặn bài nào. Không có gì để gợi ý thì ẩn khối này.
- [ ] **G3.4.4** Trạng thái rỗng: khoá chưa gán kỹ năng nào cho bài thì hiện lời mời liên hệ giảng viên, không hiện radar trống.
- [ ] **G3.4.5** Mobile dưới `sm`: một cột, CTA "Luyện hôm nay" dính đáy; từ `lg`: radar và gợi ý cạnh nhau (theo §4.6).
- [ ] **G3.4.6** Radar có văn bản thay thế đọc được bằng trình đọc màn hình ("Nghe: Cần ôn; Nói: chưa đủ dữ liệu; …").

### Giao diện giảng viên (G3.5)
- [ ] **G3.5.1** Cài đặt khoá có công tắc "Chế độ ngoại ngữ" (bị khoá kèm giải thích nếu cá nhân hoá đang tắt).
- [ ] **G3.5.2** Form sửa bài có ô chọn "Kỹ năng" (Nghe/Nói/Đọc/Viết/Không gán), chỉ hiện khi `languageMode` bật.
- [ ] **G3.5.3** Danh sách bài hiện nhãn kỹ năng nhỏ bên cạnh tên bài.
- [ ] **G3.5.4** (P1, ngoài phạm vi G3) Màn riêng cho giảng viên xem hồ sơ từng học viên; P0 chỉ có API và quyền ở G3.3.

### Export / xoá dữ liệu cá nhân (G3.6)
- [ ] **G3.6.1** `exportProfile` hiện **không** có `LearnerSkillState` (nền của hồ sơ). Thêm: mã/tên chủ đề, mastery, attempts, correctCount, lần cập nhật — có test.
- [ ] **G3.6.2** Xoá tài khoản (`deleteUser`) là *ẩn danh hoá*: gỡ định danh, giữ dòng và dữ liệu học tập dạng thống kê ẩn danh (cùng chính sách với `LearningEvent`), nên trạng thái kỹ năng không bị xoá. Hồ sơ không được kèm email hay tên hiển thị; test xác nhận phản hồi hồ sơ không chứa định danh. *(Sửa 2026-10-03: bản nháp đầu ghi nhầm là "cascade xoá".)*

### Quyết định đã chốt (2026-10-03)
1. Ngưỡng bằng chứng tối thiểu: tổng **5** lượt trả lời mỗi kỹ năng.
2. Thứ tự trục radar: Nghe, Nói, Đọc, Viết. "Xem theo thời gian" để P1 (dựng lại từ event `skill.state.updated`).
3. Một bài một kỹ năng chính ở P0; nhãn từng câu hỏi để P1.
4. Giảng viên xem hồ sơ học viên: P0 chỉ có API và quyền, màn riêng để sau.
5. Thêm `LearnerSkillState` vào export dữ liệu cá nhân ngay trong G3.

**Ghi chú khi viết test:** "giảng viên" ở G3.3.1 dùng `canGradeCourse` (gồm trợ giảng), vì trợ giảng vốn chấm bài và thấy điểm học viên. Quyền kiểm ở `apps/web` (điều phối) rồi truyền `audience` vào `core-feedback`, vì `core-feedback` không được import `core-lms`.

## G4 · Flashcard + lịch ôn cách quãng

**Thiết kế đề xuất.**
- **Thẻ = một dòng từ vựng** (G2): danh tính là cặp (`ContentItem.id`, `items[].id`). Bộ thẻ của học viên trong khoá = mọi dòng của khối `vocab_list` nằm trong bài/chương học viên thấy được (không ẩn, không khoá). Học viên phải ghi danh.
- **Trạng thái nằm ở `core-feedback`** (mô hình người học), bảng mới `FlashcardState` một dòng cho mỗi (học viên, dòng từ) khi **thẻ được ôn lần đầu**; thẻ chưa ôn không có dòng nào (= "Mới"). Gồm `easeFactor`, `intervalDays`, `repetitions`, `lapses`, `dueAt`, `introducedAt`, `lastReviewedAt`, `lastRating`, `lastReviewId`. FK tới `User`, `Course`, `ContentItem` (xoá khối thì trạng thái đi theo). Unique `(userId, itemId)`; chỉ mục nóng `(userId, courseId, dueAt)`.
- **Thuật toán tự viết, hàm thuần** `scheduleReview(state, rating, now)`: biến thể SM-2 đơn giản, mức hạt là **ngày** (không có "ôn lại sau vài phút"). Bốn mức tự đánh giá Quên / Khó / Được / Dễ; nút hiển thị khoảng cách lần ôn tới.
- **Phiên ôn** lấy: thẻ đến hạn (hạn ≤ cuối ngày VN) cũ nhất trước, rồi thẻ mới theo thứ tự bộ thẻ, tối đa **10 thẻ mới mỗi ngày** và **20 thẻ mỗi phiên**. Ba chế độ chỉ đổi cách hỏi, lịch ôn dùng chung một bộ: Hán→nghĩa, Nghĩa→Hán, Nghe→Hán (chỉ thẻ có audio).
- **Sự kiện** `flashcard.reviewed` phát trong cùng giao dịch với việc cập nhật trạng thái, idempotent qua `eventKey` (client gửi `reviewId`; gửi lại cùng lượt thì không tính hai lần).
- **Không cấp XP và không cập nhật BKT** ở P0. Flashcard là công cụ ghi nhớ tự đánh giá, không phải bằng chứng khách quan về kỹ năng; trộn vào `LearnerSkillState` sẽ làm hồ sơ 4 kỹ năng sai. Event vẫn phát để gamification đăng ký sau, kèm trần theo ngày (nguyên tắc 5).

### Thuật toán lịch ôn (G4.1)
- [ ] **G4.1.1** Given thẻ mới (chưa có trạng thái), when chọn Quên/Khó/Được/Dễ, then khoảng cách tới lần ôn sau lần lượt **1 · 1 · 2 · 4 ngày** (đề xuất; số cụ thể chốt cùng bạn).
- [ ] **G4.1.2** Given thẻ đã ôn ≥ 1 lần, when chọn Được, then khoảng cách mới = khoảng cũ × `easeFactor` (làm tròn, tối thiểu +1 ngày so với khoảng cũ).
- [ ] **G4.1.3** Bất biến: với mọi trạng thái, khoảng cách theo thứ tự **Quên ≤ Khó ≤ Được ≤ Dễ**; Quên luôn đặt lại về 1 ngày và tăng `lapses` (không tăng với thẻ chưa từng thuộc); `easeFactor` không bao giờ dưới **1.3**; khoảng cách không quá **365 ngày**.
- [ ] **G4.1.4** `previewIntervals(state)` trả đúng bốn khoảng mà `scheduleReview` sẽ áp (nút hiển thị không bao giờ lệch với kết quả thật).
- [ ] **G4.1.5** Hàm thuần: cùng đầu vào luôn cùng kết quả; không đọc đồng hồ ngoài `now` truyền vào.

### Bộ thẻ và phiên ôn (G4.2)
- [ ] **G4.2.1** Bộ thẻ gồm mọi dòng của khối `vocab_list` trong bài hiển thị, không khoá, thuộc khối không ẩn. Dòng thuộc bài/khối ẩn hoặc khoá không có trong bộ thẻ và không tính vào thống kê.
- [ ] **G4.2.2** Hai dòng cùng từ (so theo từ chuẩn hoá: Unicode NFC, bỏ khoảng trắng, không phân biệt hoa-thường) ở hai khối: phiên ôn chỉ đưa **một** thẻ (ưu tiên thẻ đã có trạng thái).
- [ ] **G4.2.3** Thẻ đến hạn xếp trước thẻ mới; trong thẻ đến hạn, hạn cũ nhất trước; thẻ mới theo thứ tự chương → bài → khối → dòng.
- [ ] **G4.2.4** Trần **10 thẻ mới/ngày** (ngày theo giờ Việt Nam) tính cả thẻ mới đã ôn trong ngày ở các phiên trước; trần **20 thẻ/phiên**.
- [ ] **G4.2.5** Chế độ Nghe→Hán chỉ lấy thẻ có `audioUrl`; không có thẻ nào thì báo rõ và gợi ý chọn chế độ khác.
- [ ] **G4.2.6** Chưa ghi danh → 403; khoá không có thẻ nào → phiên rỗng với lời mời, không lỗi.

### Ghi nhận một lượt ôn (G4.3)
- [ ] **G4.3.1** Given thẻ thuộc bộ thẻ của học viên, when gửi lượt ôn, then trạng thái cập nhật đúng theo `scheduleReview` và phát `flashcard.reviewed` (payload: `itemId`, `contentItemId`, `rating`, `mode`, `intervalDays`, `reviewId`) trong **cùng giao dịch**.
- [ ] **G4.3.2** Gửi lại cùng `reviewId` (mất mạng, bấm đúp) thì không tính lần hai: trạng thái và số event không đổi, trả lại trạng thái hiện tại.
- [ ] **G4.3.3** Thẻ không thuộc bộ thẻ (khoá khác, bài ẩn, dòng đã xoá) → bị từ chối; `rating`/`mode` ngoài danh sách cho phép → `validation_failed`.
- [ ] **G4.3.4** Lượt ôn đầu tiên tạo dòng trạng thái và ghi `introducedAt`; hai lượt cùng lúc cho cùng thẻ không tạo hai dòng (ràng buộc unique, không phụ thuộc may rủi).
- [ ] **G4.3.5** Không cập nhật `LearnerSkillState` và không cấp XP.
- [ ] **G4.3.6** Ghi nhận không chặn thao tác của học viên: lỗi mạng khi gửi lượt ôn được thử lại ở nền, thẻ kế tiếp hiện ngay.

### Thống kê trên hồ sơ (G4.4)
- [ ] **G4.4.1** `Đã học` = số thẻ đã có trạng thái; `Đến hạn hôm nay` = thẻ có `dueAt` ≤ cuối ngày VN; `Hay quên` = thẻ có `lapses ≥ 2`.
- [ ] **G4.4.2** Phân bố: **Mới** (chưa có trạng thái), **Đang học** (khoảng < 21 ngày), **Nhớ lâu** (khoảng ≥ 21 ngày); cộng lại bằng tổng bộ thẻ; chỉ hiển thị số đếm.
- [ ] **G4.4.3** Thống kê chỉ gồm thẻ còn trong bộ thẻ (thẻ của bài sau này bị ẩn/khoá/xoá không đếm).
- [ ] **G4.4.4** Học viên chỉ xem thống kê của chính mình; giảng viên xem của học viên qua API (như G3).

### Giao diện (G4.5)
- [ ] **G4.5.1** Trang `/learn/[slug]/flashcards`: chọn chế độ, tiến độ "Thẻ 5/12", mặt trước → lật → bốn nút kèm khoảng cách, màn tổng kết cuối phiên.
- [ ] **G4.5.2** Bàn phím: Space lật thẻ, phím 1–4 chọn mức; nút có nhãn truy cập cho trình đọc màn hình.
- [ ] **G4.5.3** Trang hồ sơ 4 kỹ năng có khối "Từ vựng" (ba số + thanh phân bố) và dòng "Ôn N thẻ" trong "Luyện hôm nay"; trang khoá có lối vào khi khoá có từ vựng.
- [ ] **G4.5.4** Mobile dưới `sm`: một cột, nút đánh giá dính đáy; thẻ không tràn ngang với từ dài.
- [ ] **G4.5.5** Mặt thẻ có audio thì có nút nghe (một âm thanh tại một thời điểm — dùng lại bộ phát của G2).

### Quyền, riêng tư, vận hành (G4.6)
- [ ] **G4.6.1** `exportProfile` có trạng thái thẻ của người dùng (mã khoá, `itemId`, lịch ôn); không lẫn dữ liệu người khác.
- [ ] **G4.6.2** Ẩn danh hoá tài khoản giữ trạng thái thẻ dạng thống kê ẩn danh (cùng chính sách với `LearningEvent`); API không bao giờ trả email/tên.
- [ ] **G4.6.3** Migration chỉ thêm bảng và chỉ mục mới, không đổi bảng có sẵn.
- [ ] **G4.6.4** Dòng từ bị xoá khỏi khối (payload) không làm hỏng phiên ôn hay thống kê: trạng thái mồ côi bị bỏ qua.

### Quyết định đã chốt (2026-10-03)
1. Thuật toán **tự viết** (biến thể SM-2, hàm thuần, mức hạt là ngày); không dùng thư viện FSRS.
2. Danh tính thẻ = id dòng từ (G2); khi ôn gom các dòng trùng từ (so theo từ chuẩn hoá) thành một thẻ, ưu tiên dòng đã có trạng thái.
3. **10 thẻ mới/ngày**, **20 thẻ/phiên**.
4. **Không XP, không chạm BKT** ở P0.
5. Phạm vi: mọi học viên đã ghi danh khoá có từ vựng; không phụ thuộc "Chế độ ngoại ngữ"; không bị ảnh hưởng bởi lớp đối chứng.
6. Khoảng ôn lần đầu của thẻ mới: **Quên 1 · Khó 1 · Được 2 · Dễ 4 ngày** (đề xuất, chủ dự án đồng ý).

**Trạng thái code (2026-10-03, nhánh `feat/lang-g4-flashcards`, chưa commit):** G4.1–G4.6 đã cài, test xanh (web 489 + 3 todo, core-lms 1217, core-feedback 331), typecheck sạch. **Chưa làm:** xem bằng mắt (`/learn/<slug>/flashcards`, khối "Từ vựng" trên hồ sơ, lối vào ở trang khoá, mobile < 640px, phím tắt, âm thanh); áp migration `20261003140000_flashcard_states` lên DB dev dùng chung (đã áp lên DB test) — migration chỉ thêm bảng `FlashcardState`, kiểu `FlashcardRating` và chỉ mục, không đổi bảng có sẵn. Nhãn chế độ dùng tên trung lập "Từ → nghĩa / Nghĩa → từ / Nghe → từ" (wireframe ghi "Hán → nghĩa"). Hàng đợi gửi lượt ôn thử lại với cùng `reviewId`; chỉ mục nóng `(userId, courseId, dueAt)`.

## K1 · Tô sáng theo lượt trong Hội thoại *(chèn trước G5b, 2026-10-04)*

Đánh giá đầy đủ (K1 theo lượt → K2 bài nghe có mốc thời gian → K3 theo từng từ) nằm trong cuộc trao đổi; K1 chỉ làm phần **không cần mốc thời gian** vì mỗi lượt đã là một file audio riêng.
- [x] **K1.1** Lượt đang phát được tô sáng (viền lime) và có `data-playing`; hết lượt thì mất.
- [x] **K1.2** Lượt đang phát tự cuộn vào tầm nhìn (`nearest`, không giật trang nếu đã thấy; tôn trọng `prefers-reduced-motion`).
- [x] **K1.3** Nút **Nghe cả đoạn** (chỉ hiện khi có lượt nào có audio) phát lần lượt các lượt có audio, bỏ qua lượt không có hoặc file lỗi; hết thì tự dừng; nút đổi thành **Dừng**.
- [x] **K1.4** Bấm khung lượt có audio: khi rảnh → nghe riêng lượt đó; khi đang nghe cả đoạn → nhảy tới lượt đó và chạy tiếp. Đang bôi đen chữ thì không tính là bấm.
- [x] **K1.5** Nút loa riêng của lượt = người học tự điều khiển: tắt chế độ chuỗi, không tự chạy tiếp.
- [x] **K1.6** Người học bấm nút nghe của lượt khác trong lúc chạy chuỗi → chuỗi nhường; rời trang thì tắt tiếng và không phát tiếp.
- Logic ở `apps/web/src/lib/turnSequencer.ts` (thuần, 11 test với audio giả; test viết trước đã bắt được một lỗi: nhảy lượt khi đang chạy chuỗi bị hiểu là "hết lượt" và sang lượt kế). Chưa làm: bài nghe (`audio`) có mốc thời gian, tô sáng từng từ (K2/K3); **chưa thử trên iOS Safari** (phát nối tiếp nhiều file có thể bị chặn tự phát).
- Ghi chú chữ: caption của bài mẫu đang viết "Nghe cả đoạn một lần…" (nói về trình phát cả bài), trùng nhãn nút mới — có thể sửa caption mẫu.

## G5 · Thi thử và luyện đề — đã duyệt (2026-10-03, bổ sung chế độ luyện đề 2026-10-04), đang làm G5a

**Hiện trạng hệ thống đề thi (đã khảo sát, 2026-10-03)** — G5 nặng vì phần lớn thứ cần cho thi thử **chưa có**:
- Chỉ có **một đồng hồ cho cả đề** (`ExamAttempt.durationSec`, hạn = `startedAt + durationSec`). `ExamSection` chỉ để nhóm câu và lấy ngẫu nhiên từ ngân hàng; **không có giờ riêng, không khoá thứ tự**; trình thi không đọc `ExamSection`. Điều hướng giữa các câu **hoàn toàn tự do**.
- **Học viên không tự bắt đầu được**: cần giảng viên xuất bản đề và có ca thi đang mở. `attemptPolicy = single` chặn làm lại; làm nhiều lượt chỉ có ở thi vấn đáp.
- **Nghe một lần chưa được thực thi ở đâu cả**: `audioPolicy`/`maxAudioPlays` chỉ được lưu; trình phát là `<audio controls>` thường (mã ghi "P1").
- Kết quả chỉ có **điểm tổng**, không theo phần. **Không có đường nào từ bài thi sang `LearnerSkillState`**; thẻ kỹ năng của câu hỏi thi chỉ để hiển thị.
- **Không có** khung đề HSK/IELTS/TOEIC. `ExamAttempt.sessionId` đã cho phép null.

**Nguyên tắc.**
- Mọi hành vi mới **chỉ bật khi đề được đánh dấu "Thi thử"** (`Exam.mockMode`, mặc định `false`). Đề thi thật giữ nguyên 100% (có test hồi quy).
- Không đưa **đề thật** (có bản quyền) hay **bảng quy đổi chính thức** vào hệ thống. Điểm quy đổi luôn do giảng viên nhập và luôn mang nhãn "ước lượng, không phải điểm chính thức".
- Thi thử **không cấp XP** và không chạm BKT (cùng lý do với flashcard).
- Chia 4 bước, mỗi bước commit riêng và dừng để review: **G5a → G5b → G5c → G5d**.

### G5a · Giờ riêng từng phần, làm lần lượt, không quay lại *(nặng nhất: chạm lõi luồng thi)*
Schema (chỉ thêm): `Exam.mockMode`; `ExamSection.durationMin?`, `ExamSection.languageSkill?`; bảng `ExamAttemptSection(attemptId, sectionId, endedAt?, extraSec)` unique `(attemptId, sectionId)` — chỉ ghi khi học viên nộp sớm một phần hoặc giảng viên gia hạn. Phần đang chạy được **suy ra** từ giờ bắt đầu + giờ các phần (hàm thuần `resolveSectionTimeline`), nên hết giờ phần tự chuyển mà không cần ai mở trang và không có hàng nào để "quên cập nhật".
- [x] **G5a.1** Given đề thi thử có ≥ 2 phần đều có giờ, when học viên bắt đầu, then `durationSec` = tổng giờ các phần; phần đầu chạy ngay, các phần sau ở trạng thái "chưa mở".
- [x] **G5a.2** Given đang ở phần k, when lưu đáp án cho câu thuộc phần khác (đã xong hoặc chưa mở), then bị từ chối `section_not_active` (kiểm ở máy chủ, không tin giao diện).
- [x] **G5a.3** Hết giờ phần k (tính theo giờ máy chủ) → lưu đáp án phần k bị từ chối, phần k đóng và phần k+1 mở liền, kể cả khi học viên không còn mở trang.
- [x] **G5a.4** "Nộp phần này" kết thúc sớm phần hiện tại và mở phần kế; **không quay lại** phần đã đóng; phần cuối thì nộp cả bài. Có hộp xác nhận nói rõ "không quay lại được".
- [x] **G5a.5** Trình thi chỉ hiện câu của phần hiện tại; có đồng hồ phần và đồng hồ cả bài; hết giờ phần thì tự chuyển. Máy chủ **chỉ gửi câu của phần hiện tại** (không giấu bằng giao diện).
- [ ] **G5a.13** *(giao diện, yêu cầu 2026-10-03)* Phòng thi thử **bắt chước bố cục của kỳ thi thật bên ngoài** để thí sinh quen tay: thanh trên cùng có tên phần + đồng hồ phần/cả bài; màn chia đôi bài đọc/câu hỏi; thanh số câu phía dưới có trạng thái đã làm/đánh dấu; hộp xác nhận khi nộp phần; chỉnh cỡ chữ. Chỉ lấy **mẫu bố cục và thao tác**, không dùng logo, tên thương hiệu, màu nhận diện hay nội dung có bản quyền. Cần ảnh chụp giao diện thật từ chủ dự án để đối chiếu từng kỳ thi (HSK / IELTS / TOEIC) — làm sau khi phần máy chủ G5a xanh.
- [x] **G5a.6** Tải lại trang / mất mạng rồi vào lại: thấy đúng phần hiện tại và thời gian còn lại theo máy chủ; không đặt lại được đồng hồ phần bằng cách tải lại.
- [x] **G5a.7** `heartbeat` trả thêm phần hiện tại và thời gian còn lại của phần (giữ tương thích với máy khách cũ).
- [x] **G5a.8** Cron tự nộp bài hết giờ xử lý đúng bài thi thử (hết tổng giờ → nộp đủ mọi phần).
- [x] **G5a.9** Giảng viên gia hạn giờ thì cộng vào phần đang chạy.
- [x] **G5a.10** Xuất bản đề thi thử bị chặn nếu: có phần không có câu nào, giờ phần ngoài 1–240 phút, có câu không thuộc phần nào, còn phần ngẫu nhiên chưa chốt.
- [x] **G5a.11** Phát event `exam.section.started` / `exam.section.ended` (idempotent).
- [x] **G5a.12** **Hồi quy:** đề không đánh dấu thi thử, hoặc phần không có giờ → điều hướng tự do và một đồng hồ như cũ.

**Trạng thái G5a (2026-10-03, nhánh `feat/lang-g5-mock-exams`, chưa commit):** máy chủ + giao diện đã làm; migration `20261003150000_exam_mock_sections` đã áp lên DB test và DB dev. Test: core-lms 1252 xanh (`section-timeline.test.ts` 13, `mock-sections.test.ts` 22), web 524 xanh, typecheck sạch. **Đã xem chạy thật trên dev** (đề mẫu `scripts/seed-mock-exam.ts`, 3 phần 3/4/2 phút): vào phòng thi → chỉ thấy phần Nghe (HTML tải về **không chứa** nội dung phần Đọc/Viết) → "Nộp phần này" hiện hộp xác nhận nói rõ không quay lại → sang phần Đọc, câu đánh số tiếp từ 4, phần Nghe có dấu ✓ → hết giờ phần Đọc tự sang phần Viết (qua heartbeat, không cần thao tác) → "Nộp bài" ở phần cuối ra trang kết quả. **Chưa xem bằng mắt:** ảnh chụp màn hình (khung trình duyệt trong ứng dụng đang ẩn nên không chụp được) — mới kiểm bằng nội dung trang; mobile < 640px; **trang soạn đề của giảng viên** (ô "Đề thi thử" + bảng giờ/kỹ năng từng phần, `MockExamPanel.tsx`) mới qua typecheck, chưa mở thử; chưa có test cho component. Giao diện hiện là bố cục trung tính (thanh phần + đồng hồ phần/cả bài, các phần dạng chặng, cỡ chữ A−/A+, hộp xác nhận); **G5a.13** vẫn mở: chờ ảnh phòng thi thật để chỉnh bố cục cho giống. Giới hạn nói thẳng: kiểm "câu thuộc phần đang chạy" xảy ra trước khi ghi đáp án nên một lượt lưu đúng khoảnh khắc chuyển phần có thể lọt vài mili-giây; khi hết giờ phần, câu vừa gõ trong 2 giây cuối (chưa kịp tự lưu) có thể mất — trình thi đẩy nốt các câu chờ lưu khi còn 3 giây.

### G5b · Nghe một lần và giới hạn lượt phát
Schema: bảng `ExamPassagePlay(attemptId, passageId, plays)` unique `(attemptId, passageId)`.
- [x] **G5b.1** Nút Phát gọi máy chủ xin một lượt trước khi phát: `free_replay` luôn được; `limited_replay` tối đa `maxAudioPlays` lượt; `once_only` đúng 1 lượt. Hết lượt → `audio_plays_exhausted` (403).
- [x] **G5b.2** Xin lượt idempotent theo `playId` do máy khách sinh (thử lại vì mất mạng không tính hai lần).
- [x] **G5b.3** Lượt đã dùng được máy chủ nhớ: tải lại trang không có thêm lượt.
- [~] **G5b.4** Giao diện: hiện "Còn N lượt"; với `once_only` không có thanh tua, không phát lại; hết phần thì không phát tiếp.
- [~] **G5b.5** Lời thoại (transcript) của audio ẩn với thí sinh trong khi thi (cùng nguyên tắc G1).
- [x] **G5b.6** Chỉ áp cho đề thi thử trong G5b (đề thật giữ nguyên). **Giới hạn nói thẳng:** máy chủ đếm lượt phát, không chống được việc tải file audio.

**Trạng thái G5b (2026-10-04, commit cùng G5a):** máy chủ xong, 17 test xanh (`audio-plays.test.ts`: giới hạn theo chính sách, gửi lại cùng `playId` không tính hai lần, hai yêu cầu song song chỉ được một nhờ khoá `pg_advisory_xact_lock`, chặn bịa `audioKey`, chặn xin lượt cho phần chưa mở, đề thường không bị ảnh hưởng). **Khác thiết kế nháp:** đếm theo **từng audio** (mỗi lượt phát một dòng `ExamAudioPlay`, khoá `(attemptId, playId)`) thay vì bảng đếm theo bài, vì một bài có thể có nhiều audio, mỗi audio một hạn mức. `GET` runtime trả `audioPlays` để giao diện hiện "Còn N lượt" sau khi tải lại. Giao diện (`ExamAudioPlayer`: nút Phát xin lượt trước; không tua, không dừng; thanh tiến độ chỉ để xem) **đã viết và qua typecheck nhưng CHƯA thử trên trình duyệt** — đề mẫu chưa có bài nghe có file audio thật. G5b.5 (ẩn lời thoại): đề thi không có trường lời thoại riêng (nội dung bài là do giảng viên đặt), nên **không áp**; chữ mô tả `alt` của audio vẫn hiện. Giới hạn nói thẳng: lượt đã cấp mà file không phát được (mất mạng giữa chừng) vẫn bị tính. Migration `20261004100000_exam_audio_plays` đã áp lên DB test và DB dev.

**Làm sớm từ G5c (2026-10-04):** mục **"Luyện thi"** trên trang khoá của học viên (`listMockExamsForLearner`, 6 test) = G5c.2 phần liệt kê và G5c.6; phòng thi thử **ẩn khung hệ thống** (thanh trên, chân trang, nút nổi) và có liên kết "Rời phòng thi"; thanh đầu phòng thi theo kiểu phòng thi thường của Limio. Chưa làm: nút "Luyện đề", khung đề, màn trước phòng thi, nhiều lượt thi.

### G5c · "Luyện thi" trên trang khoá, khung đề, học viên tự bắt đầu thi thử *(viết lại 2026-10-04 theo thiết kế hai chế độ)*
Hiện **học viên không có đường nào vào đề thi** từ trang khoá (đã kiểm: `app/learn/[slug]` không liệt kê đề); chỉ vào được qua link giảng viên gửi. G5c thêm mục này.
- [ ] **G5c.1** Giảng viên tạo đề thi thử từ **khung đề** (HSK · IELTS · TOEIC · Tuỳ chỉnh). Khung chỉ tạo **cấu trúc rỗng**: các phần, kỹ năng của từng phần, chính sách audio; **không kèm câu hỏi hay bảng quy đổi**. Giờ từng phần để giảng viên điền (hoặc điền sẵn số chính thức nếu chủ dự án cung cấp).
- [ ] **G5c.2** Trang khoá của học viên có mục **"Luyện thi"** liệt kê các đề thi thử đã xuất bản của khoá, mỗi đề là một thẻ: tên, các phần (kỹ năng · số phút), trạng thái của học viên (chưa làm · đang làm dở · đã thi N lần, điểm gần nhất). Không có đề nào thì không hiện mục.
- [ ] **G5c.3** Thẻ có hai nút: **Thi thử cả đề** (chế độ `mock`, như G5a) và **Luyện đề** (chế độ `practice`, xem G5e). Nút nào bị giảng viên tắt thì không hiện (G5c.7).
- [ ] **G5c.4** Học viên đã ghi danh tự bấm "Thi thử" khi đề đã xuất bản và là đề thi thử; không cần ca thi do giảng viên mở (dùng ca mặc định luôn mở). Đang có lượt thi thử dở thì hiện **Tiếp tục** thay vì tạo lượt mới; làm được nhiều lượt, mỗi lượt độc lập.
- [ ] **G5c.5** Màn trước phòng thi: cấu trúc các phần và giờ, quy tắc ("không quay lại", "nghe một lần"), nút thử loa, và xác nhận "Tôi đã sẵn sàng" trước khi đồng hồ chạy.
- [ ] **G5c.6** Chưa ghi danh → 403; đề chưa xuất bản hoặc không phải đề thi thử → không tự bắt đầu được. Mục "Luyện thi" không bao giờ liệt kê đề thường, đề nháp, hay đề của khoá khác.
- [ ] **G5c.7** Giảng viên có hai công tắc trên đề thi thử: **Cho thi thử** · **Cho luyện đề** (mặc định cả hai bật); đề nháp/đã tắt cả hai thì không hiện cho học viên.
- [ ] **G5c.8** Không cấp XP; học viên lớp đối chứng (B10) vẫn dùng được (đây là công cụ luyện, không phải feedback cá nhân hoá).

### G5d · Kết quả theo phần, so với lượt trước, và khối "Thi thử" trên hồ sơ
Schema: `ExamAttempt.sectionResults Json?` (dẫn xuất, tính một lần khi chấm xong); `ExamSection.scoreBands Json?` (bảng quy đổi do giảng viên nhập).
- [ ] **G5d.1** Hàm thuần `computeSectionResults`: mỗi phần có số câu đúng / tổng, điểm / điểm tối đa, và `pending` nếu còn câu tự luận chờ chấm.
- [ ] **G5d.2** Phần có câu chờ chấm → "chờ giảng viên", **không hiện điểm giả**; điểm phần chốt khi chấm xong.
- [ ] **G5d.3** Có bảng quy đổi → hiện **khoảng ước lượng** kèm nhãn "ước lượng, không phải điểm chính thức"; không có bảng → chỉ hiện "đúng X/Y câu".
- [ ] **G5d.4** So với lượt trước theo từng phần: tăng · giảm · không đổi.
- [ ] **G5d.5** Trang kết quả: theo phần, thời gian đã dùng so với được phép, xem lại bài làm theo chính sách hiện đáp án có sẵn.
- [ ] **G5d.6** Hồ sơ 4 kỹ năng có khối "Thi thử" đọc `sectionResults` của lượt mới nhất và lượt trước, nhóm theo `languageSkill` của phần. **Không trộn vào nhãn Cần ôn / Nên luyện / Vững** vì chưa có đường từ bài thi sang BKT.
- [ ] **G5d.7** Học viên chỉ xem kết quả của mình; giảng viên/trợ giảng xem qua API.
- [ ] **G5d.8** Phần Nói nằm ngoài thi thử (có thi vấn đáp riêng); phần Viết là câu tự luận, chờ giảng viên chấm.

### G5e · Luyện đề theo kỹ năng *(mới, 2026-10-04; làm sau G5c)*
**Một bộ đề, hai cách chạy** (như Magoosh/PREP: đề đầy đủ có bấm giờ **và** luyện theo phần/kỹ năng). Khác thi thử: học viên tự chọn phạm vi, không ép giờ, quay lại tự do, xem đáp án ngay.
Schema (chỉ thêm): `ExamAttempt.mode` (`mock` | `practice`; hàng cũ để trống = đề thường); `ExamAttempt.scope Json?` (danh sách phần học viên chọn). **Rủi ro lớn nhất:** chỉ mục SQL thô "mỗi người một lượt" trên `(examId, userId)` phải loại trừ lượt `practice` để cho nhiều lượt luyện — migration cần review tay.
- [ ] **G5e.1** Học viên chọn phạm vi luyện: một hoặc nhiều **kỹ năng** (theo `ExamSection.languageSkill`), hoặc **từng phần**, hoặc cả đề; tuỳ chọn "chỉ câu chưa làm" / "chỉ câu từng sai". Phạm vi rỗng → không bắt đầu được.
- [ ] **G5e.2** Lượt luyện chỉ chứa câu thuộc phạm vi (máy chủ chỉ gửi câu trong phạm vi). Không có đồng hồ ép buộc, không bị cron tự nộp; có công tắc **bấm giờ** tuỳ chọn (chỉ hiển thị, không ép).
- [ ] **G5e.3** Điều hướng tự do, quay lại sửa đáp án được; **tạm dừng và làm tiếp** sau (lượt giữ nguyên tới khi nộp hoặc bỏ).
- [ ] **G5e.4** Nút **Kiểm tra** (mặc định bật, học viên tắt được): sau khi trả lời một câu, máy chủ trả đúng/sai và đáp án đúng. **Endpoint này chỉ phục vụ lượt `practice` — lượt `mock` luôn bị từ chối** (không được lộ đáp án trong lúc thi thử, kể cả khi cố gọi trực tiếp).
- [ ] **G5e.5** Audio: nghe lại tuỳ ý (bỏ qua `audioPolicy` của G5b); lời thoại hiện **sau khi** đã kiểm tra câu đó.
- [ ] **G5e.6** Nhiều lượt luyện cùng đề, không giới hạn, độc lập với lượt thi thử và không ảnh hưởng chính sách một-lượt của đề thường.
- [ ] **G5e.7** Kết thúc: kết quả **theo kỹ năng** (đúng X/Y), danh sách câu sai kèm đáp án đúng, nút **Làm lại câu sai** (mở lượt luyện mới chỉ với các câu đó).
- [ ] **G5e.8** Không cấp XP. Mỗi câu đã trả lời phát `exam.practice.answered` kèm thẻ kỹ năng (để sau này nuôi BKT mà không phải làm lại), **nhưng chưa nuôi BKT** và không trộn vào nhãn Cần ôn / Nên luyện / Vững. Hồ sơ 4 kỹ năng có khối **"Luyện đề"** riêng: độ chính xác theo kỹ năng, số lượt, lần gần nhất.
- [ ] **G5e.9** Chỉ học viên đã ghi danh luyện được; đề không bật "Cho luyện đề" (G5c.7) hoặc chưa xuất bản → 403.
- [ ] **G5e.10** Giải thích đáp án: bước đầu chỉ hiện đáp án đúng. Trường giải thích (`ExamQuestion.explanation`, tuỳ chọn) làm **sau**; khi có thì hiện cùng đáp án.

### Hoãn lại (không nằm trong G5)
- **Từ làm sai → đề xuất thêm vào thẻ ôn** (cũ: LANG.5.7): cần ánh xạ câu hỏi ↔ từ vựng mà hiện chưa có.
- ~~Luyện từng phần không ép giờ~~ → đã đưa vào **G5e**. Còn hoãn: thi thử phần Nói, đưa kết quả thi/luyện vào BKT, nghe một lần áp cho cả đề thật, trường giải thích đáp án (G5e.10).
- **Từ khảo sát nền tảng luyện thi (2026-10-04), cân nhắc sau:** tô sáng/ghi chú trên bài đọc và **đánh dấu câu để xem lại** (cả hai có trong phòng thi máy của IELTS); thời gian đọc câu trước mỗi phần nghe; đề thi thử đầu vào làm điểm xuất phát cho lộ trình cá nhân hoá (B4); AI chấm Viết/Nói (G6/G7).

### Quyết định đã chốt (2026-10-03: "đồng ý" cả 6 đề xuất)
1. **Chia 4 bước** G5a → G5d, mỗi bước commit riêng và dừng review? *(đề xuất: vậy; G5a là bước rủi ro nhất)*
2. **Cờ "Thi thử"**: hành vi mới chỉ bật với đề được đánh dấu, đề thật không đổi? *(đề xuất: vậy)*
3. **Quy đổi điểm**: giảng viên tự nhập bảng cho từng phần; hệ thống không mang sẵn số liệu; mặc định chỉ hiện "đúng X/Y câu"? *(đề xuất: vậy)*
4. **Khung đề HSK/IELTS/TOEIC**: chỉ cấu trúc (phần, kỹ năng, chính sách audio), giờ để trống. Bạn có muốn cung cấp số phút chính thức từng phần để điền sẵn? *(đề xuất: để trống tới khi bạn đối chiếu nguồn chính thức)*
5. **Nghe một lần**: máy chủ đếm lượt phát, không tua, không phát lại, không chống tải file; áp cho đề thi thử trước? *(đề xuất: vậy)*
6. **Số lượt thi thử mỗi học viên**: không giới hạn, hay có trần? *(đề xuất: không giới hạn)*

### Quyết định chế độ luyện đề (2026-10-04: "đồng ý đề xuất")
1. **Một bộ đề, hai chế độ** (thi thử · luyện đề), không tách hai loại đề.
2. Luyện đề **chưa nuôi BKT**; phát event ngay để sau bật được. Hồ sơ có khối "Luyện đề" riêng.
3. Xem đáp án **ngay sau từng câu** mặc định bật, học viên tắt được; giảng viên chưa cần khoá.
4. Giải thích đáp án: bước đầu chỉ đáp án đúng; trường giải thích làm sau.
5. **Không XP** cho luyện đề.
6. Phạm vi luyện: **kỹ năng và phần** trước; nhóm câu (bài đọc/bài nghe) để sau.
**Thứ tự mới:** G5a (đang làm; chờ bạn thử) → **G5b** nghe một lần (chỉ thi thử) → **G5c** "Luyện thi" hub + học viên tự bắt đầu → **G5e** luyện đề → **G5d** kết quả theo phần/kỹ năng cho cả hai chế độ.

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

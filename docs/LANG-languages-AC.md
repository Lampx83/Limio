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
- Chặn bằng `assertWithinCaps(…, "generator")` và ghi `AiUsageLog` qua `recordAiUsage`, như mọi generator khác.
- Kết quả đi qua **một hàm chuẩn hoá xác định** (không tin đầu ra của mô hình): cùng giới hạn độ dài với `VocabItem`, tối đa 300 dòng, bỏ dòng thiếu từ hoặc nghĩa vào `skipped` kèm lý do.

### Hàm sinh (G2.5.1)
- [ ] **G2.5.1.1** Văn bản rỗng, ngắn hơn 20 ký tự hoặc dài hơn 20.000 ký tự → `validation_failed`, **trước khi** chạm tới trần AI hay OpenAI.
- [ ] **G2.5.1.2** Gọi `assertWithinCaps(userId, …, "generator")` trước OpenAI; vượt trần thì ném `AiTutorError` và **không gọi OpenAI**.
- [ ] **G2.5.1.3** Ghi `AiUsageLog` với số token vào/ra của lượt gọi.
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
3. Tính phí **theo tiền lệ** nhập câu hỏi (trần ngày + `AiUsageLog`), không trừ ví token AI.
4. Chỉ **từ vựng**; dán hội thoại thô → các lượt để P1.
5. Model mặc định `gpt-4o-mini`.

**Trạng thái:** chưa có test/code (làm sau khi G4 được commit, trên nhánh riêng).

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

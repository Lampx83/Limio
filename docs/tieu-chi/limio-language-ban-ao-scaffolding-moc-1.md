# Bạn ảo: scaffolding cho người nói yếu (mốc 1) — Acceptance criteria

> 14/11/2026, **đã duyệt và đã code (xem mục "Đã làm" cuối tài liệu).** Nối tiếp `limio-language-noi-tu-do-voi-ban-ao.md` (đã làm). Vấn đề thầy nêu: học viên Việt Nam yếu nhất ở **mẫu câu, bí từ, bí ý, không biết ghép thành câu**, trong khi hiện học viên bấm "Bắt đầu" rồi nhìn ô nhập trống. Mốc 1 **không thêm lần gọi AI mới nào**; gợi ý theo từng lượt bằng AI, ô "nói bằng tiếng Việt" và câu mẫu để mốc 2–3.

## Hiện trạng (đã đối chiếu mã)

- `FreeChat.tsx`: tình huống, danh sách "Cụm gợi ý" (từ `config.freechat.targets`, tối đa 10 cụm ≤ 120 ký tự, ✓ khi học viên đã dùng, so khớp bằng `phraseUsed` trong `freeChatView.ts`), khung chat, ô nhập. Không có chỗ trống để điền, không có nghĩa tiếng Việt, không có gợi ý ý tưởng hay từ.
- Bạn ảo (`freechat.ts`, `buildFreeChatMessages`): 1–2 câu, ≤ 30 từ, "usually end with one short question", **không biết học viên đã dùng cụm nào** nên không dẫn học viên vào cụm mục tiêu.
- `config.freechat` được gửi nguyên cho trình duyệt (`public-config.ts`); đây là nội dung đề, không phải đáp án, nên thêm gợi ý vào đó không lộ gì.
- Nhóm đối chứng nghiên cứu (`feedbackVariant = minimal`) đã bị chặn dùng bạn ảo ở máy chủ, nên mọi thứ dưới đây tự không tới nhóm đó.

## Phạm vi mốc 1

| # | Việc | Cần AI mới? |
|---|---|---|
| A | **Công thức 3 bước** cố định: Trả lời → Thêm 1 lý do/ví dụ → Hỏi lại | Không |
| B | **Khay "Khi bị bí"**: câu câu giờ, nhờ nhắc lại, tả vòng khi quên từ, câu hỏi lại | Không |
| C | **Gợi ý theo phiếu** `scaffold` (soạn sẵn): ý tưởng, **mẫu câu có chỗ trống + nghĩa**, từ hữu ích + nghĩa; bấm để chèn vào ô | Không |
| D | **Màn chuẩn bị** trước "Bắt đầu": đọc gợi ý, nghe thử từng mẫu câu | Không (dùng giọng đọc sẵn có) |
| E | **Bạn ảo dẫn học viên vào cụm chưa dùng** và **nhắc lại câu đúng một cách tự nhiên** (recast) | Chỉ sửa prompt, không thêm lần gọi |

## AC1 — Công thức 3 bước và khay "Khi bị bí" (A, B)

- **Given** khoá tiếng Anh. **When** mở phiếu. **Then** dưới tình huống có một dòng cố định: **① Trả lời ② Thêm một lý do hoặc ví dụ ③ Hỏi lại**, kèm một câu ví dụ ngắn bằng tiếng Việt ("Trả lời + vì sao + hỏi lại: *I prefer cities because… What about you?*").
- Phía trên ô nhập (trong khung chat, từ sau "Bắt đầu") có hàng chip **"Khi bị bí"**, cuộn ngang, mỗi chip là một nút chèn câu vào ô, nhóm theo việc cần làm:
  - **Câu giờ:** *Let me think…*, *Well, …*, *That's a good question.*
  - **Chưa biết nói:** *How can I say … in English?*, *I mean …*, *It's a thing you use to …*, *It's a kind of …*
  - **Nhờ nhắc lại:** *Could you say that again?*, *Sorry, I didn't catch that.*, *Could you speak more slowly?*
  - **Hỏi lại:** *What about you?*, *How about you?*, *Really? Why?*
- Bộ câu cố định này là **tiếng Anh**: khoá ngôn ngữ khác (không phải tiếng Anh) **ẩn khay**, chưa có bộ câu riêng. Công thức 3 bước vẫn hiện nhưng không kèm ví dụ tiếng Anh.
- Chip bấm được bằng bàn phím, vùng chạm ≥ 44 px; bàn phím điện thoại không che chip; 400 px không gây cuộn ngang cả trang.
- **Then** bấm chip: câu được chèn vào ô nhập **tại con trỏ** (không có con trỏ thì nối cuối, cách một dấu cách), tiêu điểm về ô nhập. Vượt 300 ký tự thì cắt như hiện nay.

## AC2 — Gợi ý theo phiếu `scaffold` (C)

Dữ liệu mới, tuỳ chọn, trong `config.freechat.scaffold` (nội dung đề, gửi cho học viên):

```
scaffold: {
  ideas:  string[]                       // ≤ 4 ý, mỗi ý ≤ 120 ký tự, tiếng Việt
  frames: { en: string, vi: string }[]   // ≤ 8 mẫu câu; en ≤ 120 ký tự, có thể chứa chỗ trống "___"; vi ≤ 120
  words:  { en: string, vi: string }[]   // ≤ 12 cụm từ hữu ích (tên trường giữ là `words`); en ≤ 40, vi ≤ 60
}
```

- **Given** phiếu có `scaffold`. **When** mở. **Then** thấy ba mục gập được: **"Ý tưởng"** (danh sách, chỉ đọc), **"Mẫu câu"** (mỗi dòng: câu tiếng Anh, nghĩa tiếng Việt nhỏ bên dưới, nút bấm chèn), **"Cụm từ hữu ích"** (chip: cụm từ, nghĩa bên cạnh, bấm chèn cụm).
- **Mẫu câu thay cho danh sách "Cụm gợi ý" hiện nay** khi phiếu có `frames`: không hiện hai danh sách trùng nhau. Mỗi mẫu câu có ✓ khi học viên đã dùng, so khớp **phần trước chỗ trống đầu tiên** (hoặc cả câu nếu không có chỗ trống) bằng đúng `phraseUsed` hiện có. Tiêu đề: "Mẫu câu (n/m đã dùng)". `targets` **vẫn dùng** cho bạn ảo (AC5) và cho nhận xét cuối buổi.
- **Chèn mẫu câu:** đặt vào ô như AC1; nếu có `___` thì **bôi đen chỗ trống đầu tiên** để học viên gõ đè luôn. Chèn từ: đặt tại con trỏ.
- **Chặn gửi khi còn chỗ trống:** tin còn `___` thì nút Gửi và Enter không gửi, hiện dòng "Còn chỗ trống ___ cần điền trước khi gửi" (không tốn lượt, không gọi AI).
- Chèn mẫu câu **vẫn tính ✓** (học viên còn phải điền chỗ trống bằng ý của mình).
- Sau "Bắt đầu": **"Ý tưởng"** và **"Cụm từ hữu ích" tự thu gọn**, "Mẫu câu" giữ mở (vì là bảng theo dõi ✓); học viên mở lại được. Trước "Bắt đầu" cả ba đều mở.
- Phiếu **không** có `scaffold`: giao diện như hiện nay (danh sách cụm gợi ý từ `targets`) cộng thêm AC1. Không phiếu nào bị vỡ.
- Trình đọc màn hình: mỗi nút chèn có nhãn "Chèn mẫu câu: …" / "Chèn cụm từ: …"; sau khi chèn có thông báo ngắn "Đã chèn vào ô nhập".

## AC3 — Màn chuẩn bị (D)

- **Given** chưa bắt đầu. **When** mở phiếu. **Then** màn "Bắt đầu" hiện đủ công thức, ba mục gợi ý và dòng hướng dẫn: "Dành khoảng một phút đọc gợi ý và nghe thử mẫu câu, rồi bấm Bắt đầu." **Không** có đồng hồ đếm hay bắt chờ.
- Mỗi mẫu câu có nút **"Nghe"**. Giọng lấy từ route `…/freechat/{câu}/speak` mở rộng bằng `?frame=<chỉ số>`: **văn bản luôn lấy từ cấu hình câu ở máy chủ** (không nhận chữ từ trình duyệt, giữ nguyên tính chất "không thể dùng để đọc chữ tuỳ ý"), chỗ trống `___` đọc thành quãng nghỉ. Cùng điều kiện truy cập với lời mở đầu, không trừ ví token. Chỉ số ngoài khoảng thì 404. Cùng một mẫu câu chỉ tải một lần mỗi lần mở trang (nhớ trong trình duyệt).
- Lỗi đọc là lỗi mềm: vẫn có chữ, nút "Nghe" của mẫu đó biến mất, không báo lỗi. Giọng bạn ảo đang tắt (nút loa) thì "Nghe" ở màn chuẩn bị **vẫn dùng được** (học viên bấm chủ động).
- Xem thử của giảng viên (`practice-preview`) có đủ các nút trên, không lưu gì.

## AC4 — Trình soạn và nhập (C)

- Khối "Hội thoại tự do với bạn ảo" thêm ba ô tuỳ chọn, có hướng dẫn một câu dưới từng ô: **"Ý tưởng gợi ý (tiếng Việt, mỗi dòng một ý)"**, **"Mẫu câu (mỗi dòng: câu tiếng Anh có ___ | nghĩa tiếng Việt)"**, **"Cụm từ hữu ích (mỗi dòng: cụm từ | nghĩa)"**. Ngăn cách bằng dấu `|`; dòng thiếu nghĩa vẫn lưu (nghĩa để trống, giao diện không hiện dòng nghĩa); vượt giới hạn thì cắt như `targets` đang làm.
- `buildFreeChatConfig`, `parseFreeChatView`, `parseFreeChat` (core-feedback), schema Zod `freechat` ở `schemas.ts` và `public-config.ts` đều nhận `scaffold`; dữ liệu sai dạng bị bỏ chứ không làm hỏng cả cấu hình.
- Công cụ nhập khoá (`pnpm import:course`) nhận `freechat.scaffold`; khoá cũ không có trường này vẫn nhập được.
- Cập nhật `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` **trước**, rồi `teacherAssistantGuide.ts`, ghi đúng tên ba ô trong ngoặc kép (`teacherAssistantFreshness.test.ts` phải xanh).

## AC5 — Bạn ảo dẫn vào cụm chưa dùng, nhắc lại câu đúng (E)

- Mỗi lượt, **máy chủ tự tính** những mục trong `targets` mà lời học viên (từ lịch sử đã kiểm và lời lượt này) **chưa dùng**, bằng bản của `phraseUsed` đặt trong core-feedback (2 module không import nhau; có **test đối chiếu** với bản ở web trên cùng một bảng ví dụ để hai bản không lệch).
- Prompt thêm quy tắc (chỉ khi còn cụm chưa dùng): chọn **một** cụm chưa dùng và **đặt một câu hỏi mà câu trả lời tự nhiên phải dùng cụm đó** (ví dụ cụm "I prefer … because …" thì hỏi "Which do you prefer, and why?"); **không** nhắc tên cụm, **không** bảo học viên "hãy dùng …". Nếu học viên vừa bối rối hoặc viết tiếng Việt thì ưu tiên câu hỏi đơn giản hơn là dẫn cụm.
- Prompt thêm quy tắc **recast**: học viên mắc lỗi mà vẫn hiểu được thì bạn ảo **dùng lại dạng đúng trong câu đáp** (học viên nói *"I take phone"* → *"Oh, you'd take your phone? Why?"*), không chỉ lỗi, không nói "bạn nên nói …". Vẫn **không sửa lỗi giữa chừng** (AC2 gốc).
- Quy tắc cũ giữ nguyên: ≤ 30 từ, 1–2 câu, lời học viên là dữ liệu, bộ lọc rò rỉ chỉ dẫn. Chuỗi cụm chưa dùng đưa vào prompt **chỉ lấy từ `targets` của cấu hình** (không từ trình duyệt) nên không thành đường nhồi lệnh.
- Không thêm lần gọi mô hình, không đổi cách trừ ví (prompt dài thêm vài chục token).

## AC6 — Không làm hỏng chỗ khác

- Hội thoại đóng vai theo kịch bản, câu mở thường, vấn đáp, gia sư theo bài, đề thi, luyện đề: không đổi.
- Bản chữ lưu, khôi phục khi tải lại, "Bắt đầu lại", "Kết thúc", "Nhận xét bằng AI", giọng bạn ảo, chữ hiện dần: không đổi hành vi. Chip chèn vào ô **không** bị tính là lời đã gửi cho tới khi bấm Gửi.
- Không thêm sự kiện mới ở mốc 1 (các thao tác chèn chưa được đo; xem "Ngoài phạm vi").
- Hợp đồng 400 px và 1280 px như `limio-language-noi-tu-do-voi-ban-ao.md` AC1; chữ tiếng Việt trong gợi ý đúng thuật ngữ giao diện (Bạn ảo, Phiếu bài tập).

## Nội dung soạn cho Speakout Unit 1

- Em soạn `scaffold` cho **18 phiếu bạn ảo của Unit 1** (3 phiếu gốc và 15 phiếu "work in pairs"; bản AC đầu ghi nhầm 14) trong `build.py` (ngoài Git), đúng tinh thần sách: mẫu câu lấy từ phần Language của bài, từ lấy từ Vocabulary của bài, ý tưởng viết bằng tiếng Việt ngắn.
- Kiểm bằng script khi dựng: mỗi mục trong `targets` là phần đầu của một mẫu câu; không mục nào vượt giới hạn; mẫu câu có `___` có nghĩa tiếng Việt.
- Thầy duyệt nội dung trên máy dev (xem từng phiếu) trước khi lên máy chủ nào.

## Kiểm thử

- **Thuần:** đọc `scaffold` sai dạng/quá giới hạn; so khớp ✓ theo phần trước chỗ trống; chèn tại con trỏ và bôi đen chỗ trống; tính cụm chưa dùng (bản web = bản core-feedback); prompt có/không có phần dẫn cụm và recast; chuỗi cụm chưa dùng chỉ từ cấu hình.
- **Giao diện:** có/không có `scaffold`; chip chèn đúng chỗ; chặn gửi còn `___`; thu gọn sau "Bắt đầu"; khay ẩn ở khoá không phải tiếng Anh; "Nghe" ở màn chuẩn bị (kể cả khi giọng đang tắt, và khi đọc lỗi); xem thử không lưu; 400 và 1280 px, bàn phím, trình đọc màn hình.
- **Route:** `?frame=` chỉ số hợp lệ/không hợp lệ, quyền truy cập như lời mở đầu, nhóm đối chứng vẫn 403.
- **Thử bằng mô hình chat thật** (cấu hình `LLM_BASE_URL`, dev chưa có) trước khi coi là xong, ba tình huống: học viên dùng đủ cụm; học viên không dùng cụm nào; học viên viết tiếng Việt. Xem bạn ảo có dẫn cụm tự nhiên, có recast, không lộ chỉ dẫn.

## Ngoài phạm vi (mốc 1)

Nút "Gợi ý" theo từng lượt bằng AI, câu mẫu hoàn chỉnh có giọng đọc, sự kiện đo mức dùng gợi ý (`exam.practice.freechat_hint`), ô "tôi muốn nói bằng tiếng Việt", "Làm lại không gợi ý", nhận xét cuối buổi nêu số lượt tự nói và số lượt dùng gợi ý, khay "Khi bị bí" cho ngôn ngữ khác tiếng Anh. Các việc đo lường cố ý để sau: mốc 1 cho ra bộ gợi ý trước, rồi mới đo xem học viên dùng thế nào.

## Câu cần thầy chốt

1. **Nghĩa tiếng Việt dưới mỗi mẫu câu hiện sẵn** hay chỉ hiện khi bấm "Nghĩa"? Đề xuất: **hiện sẵn** (học viên yếu cần thấy ngay; chữ nhỏ, màu nhạt).
2. **Bạn ảo dẫn cụm:** mỗi lượt dẫn một cụm chưa dùng, hay chỉ bắt đầu dẫn từ lượt 3 để hội thoại mở đầu tự nhiên? Đề xuất: **từ lượt 2** (lượt 1 học viên vừa trả lời câu mở đầu).
3. **Khay "Khi bị bí" chỉ tiếng Anh** ở mốc này, được không? Đề xuất: được; khoá khác thêm bộ câu riêng sau.
4. **Mẫu câu có chỗ trống chặn gửi** (AC2): đồng ý chặn cứng, hay chỉ cảnh báo rồi cho gửi? Đề xuất: **chặn cứng**, vì tin còn `___` làm bạn ảo và nhận xét cuối buổi đọc sai.

## Đã làm (14/11/2026) và chỗ khác với AC

- **Đủ AC1–AC6.** Giao diện ở `FreeChat.tsx`, phần thuần ở `freeChatView.ts`, dữ liệu `scaffold` ở web, `core-feedback` (`parseScaffold`), schema Zod của câu và của importer; trình soạn có ba ô mới; `GIAO-DIEN.md` và hướng dẫn Lily đã cập nhật (test độ tươi xanh).
- **Lỗi có sẵn được sửa:** `phraseUsed` trước đây ghép hai nửa của cụm có "…" ở giữa thành một dãy liền, nên cụm như "I prefer … because …" **không bao giờ** được ✓ (và bạn ảo sẽ luôn coi là chưa dùng). Nay các đoạn phải có đủ **theo thứ tự**. Sửa ở cả hai bản (web và core-feedback), cùng bảng ví dụ có ca cụm giữa câu.
- **✓ của mẫu câu** tính theo đoạn không rỗng ĐẦU TIÊN khi tách theo chỗ trống (mẫu mở đầu bằng "___" thì lấy đoạn sau), không phải "phần trước chỗ trống đầu tiên" như AC ghi.
- **Chỗ trống hiển thị là `___`** ở cả mẫu câu lẫn khay (khớp với chữ được chèn vào ô), không đổi thành "…".
- **Ngôn ngữ khoá** đưa xuống giao diện qua `PracticeEmbed.courseLanguage` (mới, tuỳ chọn). Khay "Khi bị bí" chỉ hiện khi là tiếng Anh.
- **"Nghe" ở màn chuẩn bị** gọi `…/speak?frame=n`, mà route buổi luyện cần có buổi luyện, nên bấm "Nghe" lần đầu sẽ tạo buổi (như "Bắt đầu" vốn đã làm). Xem thử của giảng viên không tạo gì.
- **Nội dung Speakout:** `scaffolds.py` cạnh `build.py` (ngoài Git). 18 phiếu; **6 cụm mục tiêu có dấu "/"** (vd "an active/a sedentary lifestyle", "always/never put off") được đổi thành cụm học viên nói được đúng như vậy. Kiểm khi dựng: mọi cụm mục tiêu có mặt trong một mẫu câu hoặc một từ.
- **Đã thử trên trình duyệt thật (dev):** màn chuẩn bị, Bắt đầu (ý tưởng và từ thu gọn), chèn mẫu câu bôi đen đúng chỗ trống, Gửi bị chặn khi còn `___` (lượt vẫn 1/8), khay cuộn ngang ở 375 px không làm tràn trang. **Chưa thử:** mô hình chat thật (bạn ảo dẫn cụm, recast; dev chưa có `LLM_BASE_URL`), giọng đọc mẫu câu thật, trình soạn trên trình duyệt, audio mẫu phát trong khoá nháp.
- Chưa commit.

## Cập nhật 14/11/2026 (theo lời thầy): đoạn mẫu có audio là trung tâm, thêm từ vựng, có giai đoạn chuẩn bị

Thầy chốt: với học viên ESL, scaffolding tốt nhất là **một đoạn mẫu có audio kèm transcript, mẫu câu được tô sáng, rồi danh sách cụm từ và từ vựng**; và mỗi phần nói có **giai đoạn chuẩn bị** kiểu bài học/ôn tập trước khi bấm "Bắt đầu". Đã làm:

- **Dữ liệu `scaffold`** nay gồm: `model` (`text` có `**…**` tô sáng mẫu câu, `audio` là `/api/exam-assets/<tên>` hoặc rỗng), `ideas`, `frames`, `phrases` (cụm từ hữu ích, trước đây là `words`), `vocab` (từ vựng, mới). Audio ngoài kho đề (`/api/exam-assets/`) bị bỏ khi đọc cấu hình, chỉ còn chữ.
- **Giai đoạn chuẩn bị (trước "Bắt đầu"):** đầu mục "Chuẩn bị trước khi nói" với ba bước (nghe và đọc đoạn mẫu; xem mẫu câu, cụm từ, từ vựng; bấm Bắt đầu), rồi các mục **Đoạn mẫu** (trình nghe audio, chữ hiện sẵn với mẫu câu tô sáng, nút Ẩn/Hiện chữ), Ý tưởng, Mẫu câu (có nút nghe thử), **Cụm từ hữu ích**, **Từ vựng**; tất cả mở. Sau "Bắt đầu": đầu mục biến mất, các mục thu gọn (mở lại được), riêng Mẫu câu giữ mở. Gửi tin hoặc bấm ghi âm thì audio đoạn mẫu tạm dừng.
- **Trình soạn:** ô "Đoạn nói mẫu" (có hướng dẫn dùng `**`), ô tải "Audio đoạn nói mẫu" (dùng lại ô tải audio của câu mở), "Cụm từ hữu ích", "Từ vựng". Importer nhận `freechat.scaffold.model.audio` (đường dẫn trong thư mục assets) và tải vào kho đề như audio lượt của đóng vai. Tệp audio của đoạn mẫu bị gỡ khỏi câu thì chưa tự dọn (giống audio lượt đóng vai).
- **Nội dung Unit 1 (18 phiếu):** mỗi phiếu có đoạn mẫu 3–4 câu (~40–55 từ, ~16 giây) viết theo đúng các mẫu câu của phiếu và tô sáng chúng; 7–8 cụm từ; 6 từ vựng; giọng tổng hợp macOS (Samantha, Daniel luân phiên); build.py kiểm có tô sáng, độ dài và mọi cụm mục tiêu có mặt trong mẫu câu, cụm từ hoặc từ vựng.
- **Máy dev:** 18 phiếu của khoá Speakout đã xuất bản được cập nhật tại chỗ (kèm tải audio); khoá nháp "[Xem thử scaffold] Speakout Unit 1" nhập lại với bản mới. Đã thử trên trình duyệt: giai đoạn chuẩn bị, trình nghe audio (phát được, 200 audio/mp4), mẫu câu tô sáng, ẩn/hiện chữ.

## Cập nhật 14/11/2026 (chiều muộn, theo lời thầy): phần chuẩn bị là MỘT popup

Thầy thấy phần chuẩn bị "dải ra thành nhiều khối, khó theo dõi" và chốt: **gộp thành một section duy nhất, mở bằng nút "Chuẩn bị" ra popup**. Thay cho mục "Giai đoạn chuẩn bị (trước Bắt đầu)" ở trên:

- **Trang phiếu** chỉ có tình huống và hai nút **Chuẩn bị** và **Bắt đầu** (phiếu không có `scaffold` giữ nguyên: công thức và danh sách cụm gợi ý, không có nút Chuẩn bị).
- **Popup "Chuẩn bị trước khi nói"** (một `dialog`, `aria-modal`): công thức 3 bước; bước 1 "Nghe và đọc đoạn mẫu" (audio, chữ tô sáng, Ẩn/Hiện chữ); bước 2 "Xem mẫu câu, cụm từ hữu ích và từ vựng" (Ý tưởng, Mẫu câu có nghĩa, ✓ và nghe thử, Cụm từ hữu ích, Từ vựng). Bước đánh số tự động theo mục có mặt. Cuối popup: nút **Bắt đầu** (trước khi bắt đầu) hoặc **Đóng** (sau khi bắt đầu).
- **Mở và đóng:** đóng bằng nút X, phím Esc, hoặc bấm nền; tiêu điểm vào nút Đóng khi mở và về nút Chuẩn bị khi đóng; Tab xoay vòng trong popup; trang nền khoá cuộn khi popup mở. Đóng popup thì audio dừng.
- **Mở lại khi bị bí (thầy chốt 14/11/2026, sau khi bỏ rồi đưa lại nút):** sau "Bắt đầu", nút **Chuẩn bị** (không kèm số, vì "0/5" đứng một mình khó hiểu) nằm ở đầu khung chat. Mở popup lúc này thì cuối popup là nút **Đóng**; bấm một mẫu câu/cụm từ/từ vựng thì chèn vào ô nhập (chỗ trống đầu tiên bôi đen, kể cả khi bạn ảo còn đang gõ dần) rồi **đóng popup**; mẫu đã dùng có ✓ và tiêu đề "Mẫu câu (n/m đã dùng)" trong popup. Trước "Bắt đầu" các mục chỉ để đọc và nghe.
- Bỏ các hộp rời (đoạn mẫu, ý tưởng, mẫu câu, cụm từ, từ vựng) khỏi trang và bỏ chuyện thu gọn sau khi bắt đầu.

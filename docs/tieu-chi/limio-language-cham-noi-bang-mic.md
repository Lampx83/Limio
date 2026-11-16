# Chấm trôi chảy và phát âm khi học viên nói bằng mic (tự dựng) — Acceptance criteria

> 16/11/2026, **thầy đã duyệt. Mốc A đợt 1 (trôi chảy, AC2–AC4 phần trôi chảy, AC7) đã code xong, chưa commit; dịch vụ phân tích nội bộ (AC1) đã viết mã và test tự động (`services/speech-analysis`, xem `docs/van-hanh/phan-tich-tieng-noi.md`) nhưng CHƯA chạy với Whisper thật, chưa chạy trên GPU, chưa triển khai; mốc B–D chưa làm.** Nguồn: thầy yêu cầu đánh giá việc chấm nói bằng mic; thầy chốt hướng **tự dựng** (không dùng dịch vụ chấm phát âm bên ngoài). Đây là tính năng lớn mà `limio-language-y-kien-hoc-vien-giao-dien.md` đã tách riêng ("chấm phát âm/độ trôi chảy bằng mic"), và là mục "Ngoài phạm vi" của `bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md`, `limio-language-noi-tu-do-voi-ban-ao.md`, `limio-language-luyen-hoi-thoai-dong-vai.md`.

## Hiện trạng (đã đối chiếu mã)

- **Trôi chảy đã có nhưng mỏng.** `measureSpeech`/`fluencyLevel` (`packages/core-feedback/src/speaking/analysis.ts`) tính từ mốc thời gian từng từ của Whisper hai số: tốc độ (từ/phút, chữ/phút với chữ Hán) và số chỗ ngừng dài hơn 1,5 giây mỗi phút; chia ba mức **bằng luật**, không do mô hình đoán. Ngưỡng 50/90 từ/phút là ước lượng, mã tự ghi "không phải chuẩn của kỳ thi nào", chưa hiệu chỉnh bằng bản ghi thật. Không đo chữ đệm, từ lặp, tự sửa, chỗ ngừng ngắn/vừa.
- **Nơi đang dùng:** câu mở của Bài luyện trả lời bằng giọng (`practiceAnswer/analysis.ts`, thêm tiêu chí `fluency` khi `viaVoice`) và bài nói nộp cho giảng viên (G7, `speaking/feedback.ts`, bản nháp chờ duyệt).
- **Nơi KHÔNG có:** hội thoại với bạn ảo và đóng vai (`transcribeRolePlayTurn` có tính số liệu nhưng route `roleplay` chỉ trả `{ text, durationSec }`; giọng nói điền vào ô nhập để học viên sửa rồi mới gửi, bản ghi không lưu); vấn đáp (`oral-attempt/.../voice-turn`: chỉ lấy chữ, AI chấm 0–100 trên nội dung theo rubric).
- **Phát âm: chưa chấm ở đâu.** Học viên thấy dòng "pronunciation is not assessed"; bài nói G7 ghi "phát âm do giảng viên nghe". Không thể chấm từ bản chữ vì Whisper tự sửa từ phát âm sai thành từ đúng.
- Có sẵn để dùng lại: ghi âm trong trình duyệt (`useAudioRecorder`), trừ ví token (`assertWithinCaps`, `recordAiUsage`), **bản ghi âm cuối** của câu mở lưu ở khoá `private` (`practice-answers/<sessionId>/…`), khung nhận xét AI không điểm và mã hoá SSMMD (B9), GPU L40 dùng chung với vLLM có khoá `GPU.lock` (xem `docs/van-hanh/giang-vien-ao-video.md`).

## Nguyên tắc

- **Máy chỉ gợi ý, không phải điểm chính thức.** Ba mức Cần cải thiện/Khá/Tốt, không con số, như mọi nhận xét AI hiện có. Bài chấm điểm (nộp bài, vấn đáp) giảng viên là người chốt.
- **Mục tiêu là nghe hiểu được và trọng âm đúng**, không phải giọng bản xứ.
- **Thà không nói còn hơn nói sai:** báo ít từ, chỉ từ chắc chắn; không chắc thì không hiện mục phát âm chứ không đoán.
- **Giọng nói không rời máy chủ của mình** (dịch vụ chấm chạy nội bộ).
- **Phát âm chỉ bật cho học viên sau khi qua cổng chất lượng (AC9).** Trôi chảy mới có thể bật trước.

## Phạm vi theo mốc (dừng cho thầy duyệt sau mỗi mốc)

| Mốc | Nội dung |
|---|---|
| **A** | Dịch vụ phân tích tiếng nói nội bộ + **trôi chảy** làm lại; nối vào câu mở, bài nói G7, hội thoại bạn ảo, đóng vai |
| **B** | **Phát âm cho bài có câu mẫu** (đọc to, "Listen and repeat", luyện trọng âm/nối âm ở bài Pronunciation); chạy ở chế độ "bóng" (chỉ giảng viên thấy) |
| **C** | **Bộ bản ghi hiệu chỉnh** (giảng viên chấm) và **cổng chất lượng**; qua cổng mới mở phát âm cho học viên |
| **D** (sau) | Phát âm cho nói tự do; gợi ý cho giảng viên ở vấn đáp |

## AC1 — Dịch vụ phân tích tiếng nói (mốc A)

- **Given** một dịch vụ nội bộ (container riêng, gọi bằng khoá bí mật dùng chung, không mở ra ngoài mạng nội bộ). **When** web gửi âm thanh + ngôn ngữ (+ câu mẫu nếu có). **Then** trả JSON: bản chữ, mốc thời gian từng từ, số đo nhịp nói (AC2), kết quả phát âm khi có (AC5), **phiên bản dịch vụ**.
- Dùng khoá `GPU.lock`; thiếu bộ nhớ thì việc chờ, quá **30 giây** thì báo lỗi tạm thời (`503 busy`).
- Đợt này dịch vụ gồm **VAD + Whisper (faster-whisper) với mốc từng từ của chính Whisper**; **không** có canh từ bằng wav2vec2 (cần PyTorch, nặng hơn nhiều). Đoạn có tiếng do VAD cắt thay mốc từ để đo chỗ ngừng. Từ Whisper bịa trong im lặng (nằm ngoài đoạn có tiếng) bị bỏ.
- **Dịch vụ lỗi hoặc không phản hồi:** web **rơi về cách đo hiện có** (Whisper hiện tại) cho trôi chảy và **bỏ qua mục phát âm**, không chặn việc nộp bài, không trừ ví phần chưa chạy.
- Bản ghi tối đa **3 phút**, 25 MB như hiện nay; vượt thì báo như cũ.
- Dịch vụ **không lưu** âm thanh, chữ hay kết quả; chỉ web lưu theo quy tắc từng chỗ.

## AC2 — Trôi chảy làm lại (mốc A)

- Số đo, tính trên **thời gian nói thực** (bỏ im lặng đầu/cuối): tốc độ nói chung, **tốc độ không tính chỗ ngừng**, độ dài trung bình một chuỗi nói liền, số chỗ ngừng theo ba cỡ (ngắn 0,25–0,5 giây, vừa 0,5–1,5 giây, dài trên 1,5 giây) mỗi phút, số chữ đệm ("um", "uh", "er"…), số từ lặp liền nhau (và cụm hai từ lặp liền nhau). **Số lần tự sửa chưa đo** (từ bản chữ không phân biệt được tự sửa với cách nói bình thường; đợi dịch vụ nội bộ ở AC1 có bản chữ giữ ngập ngừng). Lặp có chủ ý để nhấn mạnh ("very very", "no no") không tính.
- **Tỉ lệ "mỗi phút" của chỗ ngừng dài và chữ đệm chia cho thời gian nói thật nhưng không dưới 30 giây** (`MIN_RATE_WINDOW_SEC`): bản ghi ngắn không bị thổi phồng (đo thật: clip 7,5 giây có 1 chỗ ngừng dài từng thành "8 chỗ/phút" và bị xếp Cần cải thiện). Tốc độ nói (từ/phút) không dùng cửa sổ này.
- **Mức** (Cần cải thiện/Khá/Tốt) **do luật tính** từ các số đo, ngưỡng nằm trong **một file cấu hình có phiên bản**, tách theo ngôn ngữ và `levelBand` của khoá. Mô hình ngôn ngữ **không** quyết định mức.
- Nhận xét bằng chữ, **không con số**, nêu **đúng một điều nên sửa trước** (vd. "ngừng lâu giữa câu", "nói chậm") và một điều đang tốt.
- Chữ đệm và từ lặp chỉ tính khi bản chữ giữ được chúng; **không phát hiện được thì không kết luận "ít chữ đệm"** (mục đó bị bỏ khỏi nhận xét).
- **Given** bản ghi dưới 3 từ hoặc chỉ im lặng. **Then** báo "không có tiếng nói" như hiện nay, không có mức.

## AC3 — Nối trôi chảy vào các nơi nói bằng mic (mốc A)

- **Câu mở trả lời bằng giọng** và **bài nói G7:** tiêu chí Trôi chảy dùng số đo AC2 (thay cách đo cũ); G7 vẫn là bản nháp giảng viên duyệt.
- **Hội thoại bạn ảo và đóng vai:** mỗi lượt học viên **nói bằng mic**, máy chủ giữ **số đo của lượt đó** (chỉ số liệu, **không giữ âm thanh**, không giữ bản chữ riêng ngoài cách đang lưu). Lượt gõ tay không có số đo.
- **Khi học viên sửa chữ trong ô nhập trước khi gửi:** số đo vẫn là của lời nói thật (chữ sửa chỉ ảnh hưởng nội dung, không ảnh hưởng nhịp).
- **Nhận xét cuối buổi** (nút "Nhận xét bằng AI") thêm tiêu chí Trôi chảy **tổng hợp từ các lượt nói bằng mic**; có dưới 2 lượt nói bằng mic thì **không hiện** tiêu chí này.
- Hội thoại **không** hiện nhận xét trôi chảy từng lượt (không làm đứt mạch trò chuyện).

## AC4 — Cách hiện cho học viên

- Câu mở và hội thoại: hàng tiêu chí **Pronunciation** (khi đã bật, AC9) và **Fluency**, mức + một nhận xét ngắn bằng tiếng Anh đơn giản; nhận xét nói rõ **"đo từ bản ghi, chỉ là gợi ý"**.
- **Từ nên luyện lại (tối đa 5):** mỗi từ có nút **nghe lại đúng đoạn đó** trong bản ghi của chính học viên (câu mở có lưu bản ghi cuối; hội thoại không lưu thì **không có danh sách từ**) và cách đọc đúng (phiên âm hoặc nút nghe mẫu nếu có).
- 400 px: hàng tiêu chí và danh sách từ xuống dòng gọn, vùng chạm ≥ 44 px; trình đọc màn hình đọc "Pronunciation: Tốt/Khá/Cần cải thiện".
- Bài nói G7 cho giảng viên: bản nháp có mức Trôi chảy + (khi bật) mức Phát âm kèm từ, ghi rõ **"máy gợi ý"**; giảng viên sửa/xoá được từng mục trước khi gửi học viên.

## AC5 — Phát âm cho bài có câu mẫu (mốc B)

- Soạn: câu **Tự luận** có tuỳ chọn **"Câu học viên đọc theo mẫu"** (một hoặc vài câu); công cụ nhập khoá nhận `readAloud: { text }`; hướng dẫn một câu dưới ô, `GIAO-DIEN.md` và hướng dẫn Lily cập nhật.
- **Given** học viên đọc xong câu mẫu bằng mic. **When** nộp. **Then** dịch vụ đổi câu mẫu thành chuỗi âm vị mong đợi, canh vào âm thanh, tính độ giống **từng âm và từng từ**, trả: mức Phát âm, **từ sai** (kèm âm sai/thiếu so với âm mong đợi) và mức **Hoàn chỉnh** (đọc đủ từ trong câu mẫu).
- Chữ Whisper nghe được **không** dùng để chấm phát âm ở chế độ này (tránh việc nó tự sửa lỗi).
- Dịch vụ **không chắc** (âm thanh ồn, quá ngắn, độ tin cậy canh thấp) thì trả "không chấm được" và hiện **"Thử ghi âm lại ở nơi yên tĩnh hơn"**, **không** ra mức.
- Nói tự do (không có câu mẫu): **không chấm phát âm** đợt này (mốc D).

## AC6 — Ngôn ngữ

- Đợt này **tiếng Anh**. Khoá ngôn ngữ khác (Trung, Nhật, Hàn): trôi chảy dùng ngưỡng riêng theo đơn vị chữ như hiện nay, **không có mục phát âm**, và **không hứa thanh điệu** (đo thanh điệu là dự án riêng).

## AC7 — Ví token, trần, quyền riêng tư

- Mỗi lần phân tích trừ **ví của học viên** theo thời lượng âm thanh như Whisper hiện nay (`whisperChargeTokens`); dịch vụ nội bộ không trừ thêm tiền ngoài. Hết hạn mức hoặc trần ngày thì báo như các tính năng AI khác, **không chấm**, không trừ.
- Sự kiện mới `exam.practice.speech_measured` (mỗi lần ghi âm có số đo, nguồn `voice_answer` hoặc `turn`): id, nguồn, số lượt, **mức**, nhóm CEFR, phiên bản luật/ngưỡng và **số đo** (thời lượng, số từ, số chỗ ngừng...; đây là nguồn để gộp các lượt hội thoại vì máy chủ không lưu hội thoại); **không** mang chữ, âm thanh hay từ nào học viên nói. Tính là hoạt động học (học viên tự bấm). Lỗi ghi sự kiện chỉ ghi log, không làm mất kết quả chuyển chữ.
- **Mã hoá SSMMD** (B9): nhận xét có tiêu chí Trôi chảy mang `coding.fluencyVersion` (phiên bản luật/ngưỡng đã dùng) cạnh toạ độ sẵn có; **không** thêm giá trị `sourceKind` mới ở mốc A (tránh migration enum; xét lại ở mốc B khi có Phát âm); **không bao giờ** ở tầng `self`.
- Giọng nói là dữ liệu cá nhân: học viên có trong **xuất dữ liệu cá nhân**, **xoá tài khoản xoá** bản ghi và số đo đã lưu. Bản ghi hội thoại không lưu (như hiện nay).
- Xem thử của giảng viên: chạy được để thấy trải nghiệm (trừ ví giảng viên), **không lưu gì**.

## AC8 — Bộ bản ghi hiệu chỉnh (mốc C)

- **Chỉ dùng bản ghi của học viên đã đồng ý riêng** (hộp tick rõ ràng, tách khỏi điều khoản chung, rút lại được; theo Luật 91/2025/QH15 và Nghị định 356/2025); không đồng ý thì bản ghi **không bao giờ** vào bộ này.
- Giảng viên có trang **"Chấm mẫu"**: nghe bản ghi (ẩn tên học viên), chọn mức Trôi chảy và mức Phát âm theo hướng dẫn chấm ngắn. **Mỗi bản ghi cần 2 giảng viên chấm độc lập**; mục tiêu **200–300 bản ghi**, gồm cả bài đọc theo mẫu.
- Dữ liệu chấm mẫu **chỉ giảng viên chấm và quản trị đọc được**, xoá cùng yêu cầu rút lại đồng ý.

## AC9 — Cổng chất lượng trước khi bật cho học viên (mốc C)

- Trang quản trị cho thấy, trên bộ AC8: **tỉ lệ trùng mức giữa hai giảng viên** và **giữa máy với giảng viên**, tách Trôi chảy và Phát âm.
- **Phát âm chỉ bật cho học viên khi** tỉ lệ trùng giữa máy và giảng viên **không thấp hơn** tỉ lệ trùng giữa hai giảng viên (ngưỡng cụ thể thầy chốt ở câu hỏi 4) và **không có** mức "Tốt" nào của máy bị cả hai giảng viên chấm "Cần cải thiện" quá một tỉ lệ nhỏ thầy đặt (tránh khen sai). Chưa đạt thì phát âm vẫn chạy **chế độ bóng**: chỉ giảng viên thấy.
- Bật/tắt theo **từng khoá** (cờ), mặc định tắt; ghi nhật ký ai bật, lúc nào, với phiên bản dịch vụ nào.
- Đổi phiên bản dịch vụ hoặc ngưỡng thì **phải chạy lại phép đo** trước khi giữ nguyên cờ bật.

## AC10 — Không làm hỏng chỗ khác

- Nhận xét AI về nội dung/ngôn ngữ, hội thoại, đóng vai, vấn đáp, đề thi, luyện đề **không đổi** ngoài hàng tiêu chí thêm.
- Dịch vụ phân tích sập thì mọi thứ vẫn chạy như trước mốc A (AC1).
- Khoá không bật cờ thì không có mục Phát âm; Trôi chảy dùng số đo mới nhưng vẫn là ba mức như cũ.

## Kiểm thử

- Hàm số đo: dữ liệu mốc thời gian giả cho từng trường hợp (chậm, nhiều chỗ ngừng dài, nhiều chữ đệm, lặp, im lặng, dưới 3 từ); ngưỡng đọc từ cấu hình; thay cấu hình đổi mức; không có chữ đệm trong bản chữ thì mục đó bị bỏ.
- Dịch vụ: bản ghi mẫu ngắn (đọc đúng, đọc sai một âm, ồn, quá ngắn) cho ra đúng nhóm mong đợi hoặc "không chấm được"; hết giờ thì web rơi về cách cũ.
- Web: hội thoại giữ số đo từng lượt mic và không giữ âm thanh; tổng hợp cuối buổi bỏ tiêu chí khi dưới 2 lượt; ô nhập sửa chữ không đổi số đo.
- Sự kiện không chứa chữ, âm thanh, từ bị chấm sai; xoá tài khoản xoá số đo và bản chấm mẫu; xuất dữ liệu có mặt số đo.
- Cổng chất lượng: tính tỉ lệ trùng đúng trên dữ liệu giả; chưa đạt thì cờ không bật được cho học viên.
- Thử trên dev với **Whisper và mô hình phát âm thật** trên GPU dùng chung (đo thời gian chờ khi vLLM đang bận) và với bản ghi **thật của học viên** trước khi coi là xong.

## Ngoài phạm vi

Phát âm cho nói tự do và gợi ý cho giảng viên ở vấn đáp (mốc D); thanh điệu tiếng Trung; điểm số, thang IELTS/CEFR; nhận xét ngay trong lúc đang nói (thời gian thực); so giọng với người bản xứ; dùng bản ghi để huấn luyện mô hình khi chưa có đồng ý riêng.

## Câu cần thầy chốt

1. **Thứ tự mốc** A → B → C → D có đúng ý không, hay thầy muốn làm phát âm ở bài có câu mẫu sớm hơn?
2. **Bài mốc B:** đề xuất các tab đọc theo mẫu ở bài Pronunciation (1.2 nối âm, 1.3 trọng âm câu đáp, 2.1 ngữ điệu, 2.2 chữ câm, 2.3 trọng âm từ). Thầy muốn thêm hoặc bớt bài nào?
3. **Học viên có lưu bản ghi hội thoại không?** Đề xuất **không** (như hiện nay, chỉ giữ số đo). Đổi sang có lưu thì mới có danh sách từ nên luyện ở hội thoại, nhưng tăng dữ liệu cá nhân phải giữ.
4. **Ngưỡng qua cổng:** đề xuất "máy trùng giảng viên không thấp hơn hai giảng viên trùng nhau". Thầy muốn chặt hơn không?
5. **Ai chấm mẫu:** thầy và một giảng viên nữa (cần 2 người, mỗi người khoảng 200–300 bản ghi, mỗi bản vài chục giây)? Nếu chỉ có một người thì không đo được mức trùng giữa hai giảng viên.
6. **Đồng ý riêng để dùng bản ghi hiệu chỉnh:** thầy duyệt câu chữ và chỗ đặt hộp tick; xin ý kiến người phụ trách pháp lý của nhà trường nếu cần.
7. **Phí ví:** giữ mức trừ như Whisper hiện nay, hay giảm vì chạy nội bộ?

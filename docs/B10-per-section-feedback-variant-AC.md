# B10 — Điều kiện thực nghiệm theo lớp (per-section feedback variant)

**Bối cảnh.** Một khoá học, hai lớp song song, giảng viên muốn so sánh feedback
cá nhân hoá với một điều kiện đối chứng. Trước B10 điều đó không làm được:
`Course.personalizationEnabled` là cờ cấp khoá, hai lớp dùng chung một khoá nên
dùng chung một điều kiện; schema không có trường nào biểu diễn nhóm thực nghiệm.

**Phạm vi.** Thêm điều kiện ở cấp `CourseSection`, áp vào *hai* kênh cá nhân hoá
mà người học nhìn thấy, và ghi lại điều kiện đó lên từng lượt feedback để phân
tích được về sau.

## Biến được thao tác

| | `personalized` (mặc định) | `minimal` (đối chứng) |
|---|---|---|
| Nhận diện misconception từ đáp án sai | có → template riêng theo misconception | bỏ qua → chỉ template chung |
| Bài ôn gợi ý kèm feedback | tối đa 3 bài theo skill của câu hỏi | không có |
| Gợi ý "bài học tiếp theo" ở trang khoá | có | không |
| Toạ độ SSMMD sinh ra | tới `process` / `self_regulation`, `elaboration` = `km`/`kh`/`elaborated` | `task`, `elaboration` = `kcr`/`kr` |

## Biến KHÔNG bị thao tác (cả hai lớp như nhau)

Đây là ranh giới đạo đức của thực nghiệm — lớp đối chứng không bị giấu thông tin
cơ bản, chỉ không nhận phần cá nhân hoá:

- Điểm số, đúng/sai từng câu, và **đáp án đúng** (trang kết quả vẫn hiện đủ
  qua `AnswerBreakdown`, không đi qua `FeedbackDelivery`).
- Toàn bộ nội dung bài học, quiz, bài tập, diễn đàn.
- Ghi nhận misconception (`MisconceptionFlag`) và cập nhật BKT
  (`LearnerSkillState`) — vẫn chạy cho cả hai lớp, nếu không thì không có
  biến phụ thuộc để so sánh.
- Gamification (XP, badge, streak).

## Acceptance criteria

**AC-1 — Điều kiện ở cấp lớp**
1.1 `CourseSection.feedbackVariant` mặc định `personalized`; mọi lớp đang tồn
    tại giữ nguyên hành vi hiện tại sau khi migrate.
1.2 Giảng viên đổi được điều kiện của từng lớp trong tab **Lớp học**.
1.3 Lớp mặc định ("Học viên chưa gán lớp") không đổi được — nó không phải một
    lớp thật, và người rơi vào đó không thuộc nhóm thực nghiệm nào.
1.4 Mỗi lần đổi ghi một dòng `AuditLog` với `from`/`to` + ai đổi, để sau này
    trả lời được "lớp này chuyển điều kiện lúc nào".

**AC-2 — Áp điều kiện lúc sinh feedback**
2.1 Người học ở lớp `minimal` nhận `FeedbackDelivery` với
    `remediationLessonIds = []`, `sourceKind = rule_template`,
    `misconceptionCode = null`, kể cả khi đáp án sai của họ có gắn misconception.
2.2 Người học ở lớp `personalized` nhận đúng như trước B10.
2.3 Người chưa ghi danh (giảng viên xem thử) → coi như `personalized`.
2.4 Không có lượt sinh feedback nào bị bỏ qua vì điều kiện — cả hai nhóm đều
    có delivery, chỉ khác nội dung.

**AC-3 — Ghi lại điều kiện lên dữ liệu**
3.1 `generationContext` của mỗi delivery mang `feedbackVariant` và `sectionId`.
3.2 Đọc `generationContext` là đủ để chia hai nhóm, không cần join lại
    `Enrollment` — nên nếu sinh viên bị chuyển lớp giữa kỳ, dữ liệu cũ vẫn giữ
    đúng điều kiện lúc nó được sinh ra.

**AC-4 — Kênh cá nhân hoá thứ hai**
4.1 `getAdaptiveNextLesson` trả `null` cho người học ở lớp `minimal`, nên thẻ
    "Đề xuất: …" không hiện ở trang khoá. Không bịt kênh này thì lớp đối chứng
    vẫn được định tuyến theo skill yếu và phép so sánh bị nhiễu.

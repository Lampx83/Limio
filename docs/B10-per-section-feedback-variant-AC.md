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

---

# B11 — Log hành vi đọc bài

**Bối cảnh.** Trước B11 hệ thống chỉ biết một người **đã mở** bài: `lesson.viewed`
bắn đúng một lần lúc trang tải xong, kèm vị trí video *cũ* lấy từ lần trước.
Trong dữ liệu, em đọc kỹ hai mươi phút và em mở bài rồi bỏ đó trông giống hệt
nhau. `LessonCompletionPrompt` thậm chí **đã đo** tỉ lệ xem video và thời điểm
cuộn hết bài rồi vứt đi, chỉ gửi lên một chuỗi `reason`.

## Acceptance criteria

**AC-1 — Đo đúng thứ đáng đo**
1.1 Chỉ cộng giây khi tab thực sự hiện (`visibilitychange`). Tab để quên qua
    đêm không được tính là tám tiếng học bài.
1.2 Cuộn sâu nhất giữ mốc cao nhất, không tụt khi người học cuộn ngược lên.
1.3 Tỉ lệ video lấy cao nhất trong các video của bài, đo không phụ thuộc vào
    cấu hình tự động hoàn thành (trước đây chỉ đo khi bật `requireVideoWatch`).
1.4 Mở lại bài sau khi đã rời đi được đếm là một lượt mới (`sessionCount`).

**AC-2 — Không mất và không bịa số liệu**
2.1 Máy khách gửi **phần chênh**, không gửi tổng: mất một nhịp thì mất đúng
    nhịp đó, không làm lệch tổng.
2.2 Nhịp cuối đi bằng `sendBeacon` để sống sót lúc đóng tab — đó là nhịp giữ
    phần lớn thời gian của lượt đọc.
2.3 Máy chủ chặn trần mỗi nhịp (`MAX_DELTA_SEC = 120`) và chặn `scrollPct`/
    `videoPct` ngoài 0–100.
2.4 Chỉ ghi cho người **đã ghi danh**. Giảng viên xem lại bài của mình hay
    người xem bản preview không phải dữ liệu học tập.

**AC-3 — Không làm ngập LearningEvent**
3.1 `lesson.engaged` chỉ phát khi **khép một lượt** ngồi đọc, không phát theo
    từng nhịp. Một lớp 60 người đọc 30 phút mà mỗi nhịp một dòng thì sinh ra
    hàng nghìn dòng nói đúng những gì một dòng tổng kết đã nói.
3.2 Lượt 0 giây không sinh event.
3.3 Bảng `LessonEngagement` giữ bản tổng đã cộng sẵn, để không phải quét lại
    toàn bộ event mỗi lần hỏi "em này đọc bài đó bao lâu".

**AC-4 — Không chặn việc học**
4.1 Mọi lỗi mạng của đường đo đều bị nuốt; người học không bao giờ thấy lỗi.
4.2 Số liệu nằm trong `useRef`, không phải `useState` — cuộn và video chạy
    không được kéo theo một lượt vẽ lại trang bài học.

---

# B12 — Thời gian thật của từng câu hỏi

**Bối cảnh.** `AnswerResponse.responseTimeMs` mang tên gợi ý "thời gian trả
lời", nhưng công thức là `answeredAt − attempt.startedAt`: thời gian cộng dồn
từ lúc bắt đầu cả lượt làm bài. Câu cuối luôn "lâu" hơn câu đầu bất kể khó dễ.
Tệ hơn, `QuizPlayer` gửi **toàn bộ đáp án một lượt lúc bấm nộp**, nên nhìn từ
máy chủ thì cả bài trông như được trả lời cùng một khoảnh khắc. Và mỗi lần
người học sửa đáp án, hàng cũ bị ghi đè — mất luôn dấu vết đổi ý.

## Acceptance criteria

**AC-1 — Không đổi nghĩa dữ liệu cũ**
1.1 `responseTimeMs` giữ nguyên công thức và nguyên nghĩa. Đổi nghĩa một cột
    đang có là làm hỏng dữ liệu cũ một cách lặng lẽ.
1.2 Thời gian thật nằm ở cột mới `latencyMs`, **nullable** — hàng trước B12
    không có số đo này và không được làm cho giống như đã có.

**AC-2 — Đo ở nơi duy nhất biết sự thật**
2.1 Máy khách cộng dồn số mili-giây mỗi câu **đang hiện trên màn hình**, vì chỉ
    máy khách biết câu nào đang hiện.
2.2 Người học đi tới đi lui giữa các câu thì các quãng được cộng dồn, không
    phải "lúc vào trừ lúc ra" một lần.
2.3 Không tính giờ khi tab bị ẩn.
2.4 Chốt sổ câu đang mở trước khi nộp — nếu không thì đúng câu người học ngồi
    lâu nhất lại là câu duy nhất không được tính giờ.

**AC-3 — Thà trống còn hơn sai**
3.1 Máy khách cũ không gửi `latencyMs` ⇒ để trống, **không** lấy tạm
    `responseTimeMs`.
3.2 Khai dài hơn cả lượt làm bài ⇒ **bỏ hẳn số đo**, không kẹp về mức hợp lệ.
    Kẹp lại biến một lỗi thành con số trông rất bình thường, mà con số trông
    bình thường thì không ai kiểm tra nữa. `latencyMs` là một khoảng thời gian
    do máy khách tự đo chứ không phải mốc thời gian, nên lệch đồng hồ giữa hai
    máy không biện minh được cho chuyện này.
3.3 Trần hai tiếng cho một câu: quá mốc đó thì người học đã bỏ đi làm việc
    khác, con số không còn nói lên độ khó của câu hỏi.

**AC-4 — Giữ dấu vết đổi ý**
4.1 `revisionCount` đếm số lần sửa lại đáp án. Đáp án cũ bị ghi đè nên không
    đếm ở đây thì không còn dấu vết nào khác.
4.2 `quiz.question.answered` mang theo cả `latencyMs` lẫn `revisionCount`.

---

# B13 — Export dữ liệu cho nghiên cứu

**Bối cảnh.** Mọi báo cáo hiện có đều gom theo khoá học và **không có cột lớp**,
nên không so sánh được hai lớp song song. Tệ hơn, ba nguồn dữ liệu quý nhất
không có đường nào ra khỏi hệ thống: `FeedbackDelivery` (không endpoint, không
script, không trang quản trị nào đọc), `AnswerResponse.confidence`, và toàn bộ
`LessonEngagement` vừa dựng ở B11. Export event duy nhất là bản tự phục vụ của
chính người học, cap cứng 5000 dòng.

## Acceptance criteria

**AC-1 — Gắn được dữ liệu với lớp**
1.1 Ba báo cáo, mỗi báo cáo mở đầu bằng đúng năm cột: `Mã ẩn danh · Lớp ·
    Điều kiện · Email · Họ tên`. Ghép ba tệp bằng cột nào cũng được.
1.2 Lớp mặc định hiện là `(chưa gán lớp)` chứ không hiện tên thật của nó —
    người rơi vào đó không thuộc nhóm thực nghiệm nào và không được đếm nhầm
    vào một nhánh.

**AC-2 — Ẩn danh dùng được thật**
2.1 `Mã ẩn danh` băm kèm `courseId`, nên cùng một sinh viên ở hai khoá ra hai
    mã khác nhau: ghép hai bộ dữ liệu đã ẩn danh cũng không lần ra được người.
2.2 Bỏ hai cột Email và Họ tên là có ngay bộ dữ liệu chia sẻ được.

**AC-3 — Nội dung ba báo cáo**
3.1 *Từng câu trả lời*: đúng/sai, độ tự tin, `latencyMs` (B12), `responseTimeMs`,
    số lần sửa đáp án.
3.2 *Từng lượt phản hồi*: toạ độ SSMMD đầy đủ, **điều kiện lúc sinh** đọc từ
    `generationContext` chứ không suy từ lớp hiện tại, số lần bấm bài ôn
    (uptake), đánh giá, mastery trung bình lúc sinh.
3.3 *Hành vi đọc bài*: mỗi (người học × bài), kể cả người **chưa từng mở** dưới
    dạng dòng 0 — "thiếu dữ liệu" và "không đọc" là hai chuyện khác nhau, và
    bảng chỉ có người đã đọc sẽ đẩy mọi giá trị trung bình lên.

**AC-4 — Tệp rỗng vẫn tự nói được nó là gì**
4.1 Báo cáo không có dòng nào vẫn ghi dòng tiêu đề. Tệp trắng trơn trông y hệt
    một lần tải hỏng.

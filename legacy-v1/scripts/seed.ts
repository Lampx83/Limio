import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("→ Đang seed dữ liệu...");

  // Wipe để chạy lại được nhiều lần
  db.exec(`
    DELETE FROM peer_reviews;
    DELETE FROM audit_logs;
    DELETE FROM discussion_posts;
    DELETE FROM announcements;
    DELETE FROM material_feedbacks;
    DELETE FROM material_interactions;
    DELETE FROM learning_materials;
    DELETE FROM behavioral_logs;
    DELETE FROM srl_responses;
    DELETE FROM ai_feedbacks;
    DELETE FROM submissions;
    DELETE FROM assignments;
    DELETE FROM modules;
    DELETE FROM course_enrollments;
    DELETE FROM courses;
    DELETE FROM learning_styles;
    DELETE FROM sessions;
    DELETE FROM consent_records;
    DELETE FROM prompt_templates;
    DELETE FROM users;
    DELETE FROM institutions;
  `);

  // ----- Institutions -----
  const insertInst = db.prepare(
    "INSERT INTO institutions (code, name, address, contact_email) VALUES (?, ?, ?, ?)",
  );
  const inst1 = insertInst.run(
    "HUST",
    "Đại học Bách Khoa Hà Nội",
    "Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội",
    "office@hust.edu.vn",
  ).lastInsertRowid as number;
  const inst2 = insertInst.run(
    "NEU",
    "Đại học Kinh tế Quốc dân",
    "207 Giải Phóng, Đồng Tâm, Hai Bà Trưng, Hà Nội",
    "info@neu.edu.vn",
  ).lastInsertRowid as number;

  // ----- Users -----
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const insertUser = db.prepare(
    "INSERT INTO users (username, password_hash, full_name, role, institution_id, experiment_condition) VALUES (?, ?, ?, ?, ?, ?)",
  );

  const adminId = insertUser.run(
    "admin",
    hash("admin123"),
    "Quản trị Hệ thống",
    "system_admin",
    null,
    null,
  ).lastInsertRowid as number;

  const instAdminHustId = insertUser.run(
    "qt.hust",
    hash("admin123"),
    "Trần Quản Trị (HUST)",
    "institution_admin",
    inst1,
    null,
  ).lastInsertRowid as number;

  const teacherId = insertUser.run(
    "gv.huyen",
    hash("teacher123"),
    "TS. Nguyễn Thị Huyền",
    "instructor",
    inst1,
    null,
  ).lastInsertRowid as number;

  const teacher2Id = insertUser.run(
    "gv.minh",
    hash("teacher123"),
    "ThS. Trần Văn Minh",
    "instructor",
    inst1,
    null,
  ).lastInsertRowid as number;

  // 4 sinh viên: 2 control, 2 personalized
  const students = [
    { u: "sv001", n: "Nguyễn Văn An", c: "control" as const },
    { u: "sv002", n: "Trần Thị Bình", c: "control" as const },
    { u: "sv003", n: "Lê Hoàng Cường", c: "personalized" as const },
    { u: "sv004", n: "Phạm Mai Dung", c: "personalized" as const },
  ];
  const studentIds: number[] = [];
  for (const s of students) {
    const id = insertUser.run(
      s.u,
      hash("student123"),
      s.n,
      "student",
      inst1,
      s.c,
    ).lastInsertRowid as number;
    studentIds.push(id);
  }

  // ----- Course -----
  const courseId = db
    .prepare(
      "INSERT INTO courses (code, title, description, institution_id, owner_instructor_id) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      "EDT101",
      "Nhập môn Công nghệ Giáo dục",
      "Giới thiệu các nền tảng lý thuyết và ứng dụng công nghệ trong dạy-học hiện đại: từ thiết kế giảng dạy đến tích hợp AI vào lớp học đại học.",
      inst1,
      teacherId,
    ).lastInsertRowid as number;

  // Enrollments
  const insertEnroll = db.prepare(
    "INSERT INTO course_enrollments (course_id, user_id, role_in_course) VALUES (?, ?, ?)",
  );
  insertEnroll.run(courseId, teacherId, "instructor");
  insertEnroll.run(courseId, teacher2Id, "ta");
  for (const sid of studentIds) insertEnroll.run(courseId, sid, "student");

  // ----- Modules -----
  const insertModule = db.prepare(
    "INSERT INTO modules (course_id, title, description, order_idx) VALUES (?, ?, ?, ?)",
  );
  const m1 = insertModule.run(
    courseId,
    "Tuần 1 - Khái niệm và lịch sử Công nghệ Giáo dục",
    "Định nghĩa EdTech, các thế hệ công nghệ giáo dục, mô hình SAMR và TPACK.",
    1,
  ).lastInsertRowid as number;
  const m2 = insertModule.run(
    courseId,
    "Tuần 2 - Lý thuyết phản hồi và đánh giá hình thành",
    "Khung Hattie & Timperley (Feed Up - Feed Back - Feed Forward), 4 cấp phản hồi, đánh giá hình thành.",
    2,
  ).lastInsertRowid as number;
  const m3 = insertModule.run(
    courseId,
    "Tuần 3 - AI và phản hồi cá nhân hoá trong giáo dục",
    "Cơ hội và rủi ro của Generative AI, hiện tượng metacognitive laziness, mô hình human-in-the-loop.",
    3,
  ).lastInsertRowid as number;

  // ----- Assignments -----
  const insertAssign = db.prepare(
    "INSERT INTO assignments (module_id, title, prompt, learning_objectives, rubric, min_words, order_idx) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  insertAssign.run(
    m1,
    "Bài 1.1 - Phân tích mô hình SAMR",
    `Hãy chọn MỘT hoạt động dạy-học có ứng dụng công nghệ mà bạn đã trải nghiệm (ví dụ: dùng Kahoot kiểm tra bài cũ, dùng Google Docs viết nhóm, dùng video YouTube thay bài giảng).
Phân tích hoạt động đó theo 4 cấp của mô hình SAMR (Substitution - Augmentation - Modification - Redefinition) của Puentedura.
Lập luận hoạt động đang ở cấp nào và đề xuất một thay đổi để nâng nó lên cấp cao hơn.`,
    `1. Hiểu và áp dụng được 4 cấp SAMR vào tình huống thực tế.
2. Phân biệt được "thay thế công cụ" với "biến đổi sư phạm".
3. Đề xuất được phương án nâng cấp hoạt động dạy-học có chứng cứ.`,
    `- Mô tả hoạt động rõ ràng (15đ)
- Phân loại đúng cấp SAMR có lập luận (35đ)
- Phân biệt được Substitution/Augmentation và Modification/Redefinition (20đ)
- Đề xuất nâng cấp khả thi, có lý giải sư phạm (25đ)
- Trình bày mạch lạc, đúng thuật ngữ (5đ)`,
    150,
    1,
  );

  insertAssign.run(
    m2,
    "Bài 2.1 - Áp dụng khung Feed Up / Feed Back / Feed Forward",
    `Đọc tình huống sau và viết phản hồi cho sinh viên:

"Bài tiểu luận của Mai (sinh viên năm 2) trình bày khá nhiều khái niệm về SRL nhưng phần liên hệ thực tế còn yếu, cấu trúc đoạn lộn xộn, một số ý lặp lại. Mai đã rất nỗ lực nộp đúng hạn."

Hãy viết phản hồi cho Mai gồm 3 phần ĐƯỢC GẮN NHÃN RÕ RÀNG:
(a) Feed Up - Mục tiêu của bài là gì
(b) Feed Back - Đánh giá hiện trạng theo 3 cấp Hattie & Timperley (Task / Process / Self-regulation)
(c) Feed Forward - 2-3 hành động cụ thể Mai nên làm tiếp.

Chú ý: KHÔNG dùng feedback cấp Self (kiểu "em giỏi lắm", "em cần cố gắng hơn").`,
    `1. Phân biệt được 3 cấp Task / Process / Self-regulation.
2. Áp dụng được cấu trúc Feed Up - Feed Back - Feed Forward.
3. Tránh được feedback cấp Self vô bổ và biết lý do tại sao.
4. Viết phản hồi mang tính xây dựng, cụ thể, hành động được.`,
    `- Có đủ và gắn nhãn rõ Feed Up / Feed Back / Feed Forward (20đ)
- Feed Back phân tách rõ Task / Process / Self-regulation (30đ)
- Feed Forward gồm 2-3 hành động CỤ THỂ và khả thi (25đ)
- Tránh được feedback cấp Self vô bổ (15đ)
- Giọng văn xây dựng, phù hợp sư phạm (10đ)`,
    180,
    1,
  );

  insertAssign.run(
    m3,
    "Bài 3.1 - Thiết kế hoạt động dạy có AI tránh metacognitive laziness",
    `Bạn được giao thiết kế MỘT hoạt động dạy-học 30 phút trong môn của bạn, có sử dụng ChatGPT hoặc công cụ AI tương tự để hỗ trợ phản hồi cá nhân hoá cho sinh viên.

Hãy mô tả:
1. Mục tiêu học tập của hoạt động.
2. Vai trò CỤ THỂ của AI và vai trò CỤ THỂ của giảng viên (nguyên tắc human-in-the-loop).
3. Một cơ chế CHỐNG metacognitive laziness (Fan et al., 2025): làm sao đảm bảo sinh viên vẫn tự tư duy chứ không offload toàn bộ cho AI?
4. Một rủi ro đạo đức/liêm chính học thuật bạn đã lường trước và cách xử lý.`,
    `1. Thiết kế được hoạt động dạy-học tích hợp AI có chủ đích sư phạm.
2. Phân vai rõ ràng giữa AI và giảng viên (human-in-the-loop).
3. Chủ động phòng ngừa metacognitive laziness.
4. Có ý thức đạo đức nghiên cứu và liêm chính học thuật.`,
    `- Mục tiêu học tập rõ ràng và đo được (15đ)
- Phân vai AI/giảng viên cụ thể, có lý giải (25đ)
- Cơ chế chống metacognitive laziness có cơ sở lý thuyết (30đ)
- Lường trước rủi ro đạo đức và đề xuất xử lý (20đ)
- Trình bày mạch lạc, dùng thuật ngữ chuyên ngành đúng (10đ)`,
    200,
    1,
  );

  // ----- Học liệu (5 video, 5 PDF/đọc, 5 quiz, + slides/file/link/discussion mẫu) -----
  const insertMat = db.prepare(
    `INSERT INTO learning_materials
     (module_id, type, title, description, video_url, pdf_url, reading_text, quiz_data, external_url, duration_min, order_idx)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // VIDEOS (5) - YouTube embed IDs nổi tiếng/giáo dục công khai. Nếu một ID không khả dụng,
  // có thể chỉnh URL trong DB hoặc seed lại với ID khác.
  const videos = [
    {
      module: m1,
      title: "Video 1.1 - Sir Ken Robinson: Trường học có giết chết sự sáng tạo?",
      description:
        "Bài TED kinh điển đặt nền cho việc đổi mới giáo dục - bối cảnh tại sao công nghệ giáo dục cần thiết.",
      url: "https://www.youtube.com/embed/iG9CE55wbtY",
      dur: 19,
      order: 1,
    },
    {
      module: m1,
      title: "Video 1.2 - Mô hình SAMR giải thích trong 90 giây",
      description:
        "Tổng quan ngắn về 4 cấp độ Substitution-Augmentation-Modification-Redefinition.",
      url: "https://www.youtube.com/embed/9b5yvgKQdqE",
      dur: 3,
      order: 2,
    },
    {
      module: m2,
      title: "Video 2.1 - John Hattie nói về phản hồi (feedback)",
      description:
        "Tác giả khung Feed Up/Feed Back/Feed Forward giải thích vì sao feedback nằm trong top 10 yếu tố tác động học tập.",
      url: "https://www.youtube.com/embed/Yef9_d3KLzo",
      dur: 8,
      order: 3,
    },
    {
      module: m2,
      title: "Video 2.2 - Đánh giá hình thành (Formative Assessment)",
      description:
        "Sự khác biệt giữa đánh giá hình thành và đánh giá tổng kết, ý nghĩa trong dạy-học.",
      url: "https://www.youtube.com/embed/rJxFXjfB_B4",
      dur: 6,
      order: 4,
    },
    {
      module: m3,
      title: "Video 3.1 - Sal Khan: Khan Academy và AI trong giáo dục",
      description:
        "Sal Khan thảo luận tiềm năng và rủi ro của AI tutor cá nhân hoá.",
      url: "https://www.youtube.com/embed/hJP5GqnTrNo",
      dur: 15,
      order: 5,
    },
  ];
  for (const v of videos) {
    insertMat.run(v.module, "video", v.title, v.description, v.url, null, null, null, null, v.dur, v.order);
  }

  // PDFs / TÀI LIỆU ĐỌC (5)
  const pdfs = [
    {
      module: m1,
      title: "Tài liệu 1.1 - Khung TPACK: Kiến thức công nghệ-sư phạm-nội dung",
      description: "Tóm tắt khung lý thuyết TPACK của Mishra & Koehler (2006).",
      text: `# Khung TPACK (Mishra & Koehler, 2006)

TPACK là viết tắt của **Technological Pedagogical Content Knowledge** - Kiến thức công nghệ-sư phạm-nội dung. Đây là khung lý thuyết mô tả những gì giáo viên cần biết để tích hợp công nghệ hiệu quả vào giảng dạy.

## 3 vòng tròn cơ bản

1. **Content Knowledge (CK)** - kiến thức về môn học (vd: Toán, Lịch sử, Lập trình).
2. **Pedagogical Knowledge (PK)** - kiến thức về phương pháp dạy-học (vd: học tập tích cực, đánh giá hình thành).
3. **Technological Knowledge (TK)** - kiến thức về công nghệ (vd: LMS, công cụ AI, video conferencing).

## 4 vùng giao thoa

- **PCK** (Pedagogical Content): cách dạy MỘT chủ đề cụ thể.
- **TCK** (Technological Content): công nghệ thay đổi CÁCH thể hiện nội dung (vd: GeoGebra cho hình học).
- **TPK** (Technological Pedagogical): công nghệ ảnh hưởng PHƯƠNG PHÁP dạy.
- **TPACK** (giao của cả 3): năng lực tích hợp tất cả - dạy chủ đề X bằng phương pháp Y có sự hỗ trợ công nghệ Z.

## Ý nghĩa với người giảng viên

Một giảng viên có nhiều kiến thức công nghệ (TK cao) nhưng kém TPK sẽ bị "chiều theo công cụ" - dùng AI/Kahoot vì có công cụ chứ không phải vì sư phạm. TPACK đòi hỏi sự cân bằng và phát triển đồng thời cả 3 vòng.

## Ứng dụng vào AI feedback

Khi tích hợp AI vào giảng dạy, giảng viên cần:
- Hiểu nội dung môn học (CK) đủ sâu để đánh giá phản hồi của AI.
- Biết phương pháp sư phạm phù hợp (PK) - không phải lúc nào AI feedback cũng đúng cách.
- Hiểu giới hạn công nghệ (TK) - khi nào AI hallucinate, khi nào prompt thiếu ngữ cảnh.

Tham khảo: Mishra, P., & Koehler, M. J. (2006). Technological pedagogical content knowledge.`,
      dur: 8,
      order: 11,
    },
    {
      module: m1,
      title: "Tài liệu 1.2 - Mô hình SAMR chi tiết",
      description: "Chi tiết 4 cấp Substitution → Augmentation → Modification → Redefinition.",
      text: `# Mô hình SAMR (Puentedura, 2006)

SAMR (Substitution - Augmentation - Modification - Redefinition) phân loại mức độ tích hợp công nghệ trong dạy-học theo 4 bậc.

## Bậc 1 - Substitution (Thay thế)
Công nghệ làm thay công cụ cũ, KHÔNG có thay đổi chức năng.
- VD: Đọc PDF thay vì đọc giáo trình giấy. Cơ bản giống nhau.

## Bậc 2 - Augmentation (Bổ sung)
Công nghệ thay thế công cụ + thêm cải tiến chức năng.
- VD: Google Docs thay vì Word, có thêm comment, theo dõi chỉnh sửa.

> **Substitution + Augmentation** thuộc nhóm "Enhancement" (cải thiện) - vẫn dạy cùng cách, chỉ tốt hơn một chút.

## Bậc 3 - Modification (Biến đổi)
Công nghệ cho phép THIẾT KẾ LẠI đáng kể nhiệm vụ.
- VD: Sinh viên cộng tác viết Wiki nhóm (không thể làm được nếu chỉ có giấy bút).

## Bậc 4 - Redefinition (Tái định nghĩa)
Công nghệ tạo ra nhiệm vụ MỚI HOÀN TOÀN không thể hình dung trước đây.
- VD: Sinh viên Việt Nam phỏng vấn online giáo viên Phần Lan để so sánh hệ thống giáo dục, làm video tổng hợp đa ngôn ngữ phụ đề bằng AI.

> **Modification + Redefinition** thuộc nhóm "Transformation" (chuyển đổi) - thực sự tận dụng công nghệ.

## Cách áp dụng trong AI feedback

Đa số dùng AI ở mức Augmentation (sửa lỗi nhanh hơn → cải thiện công cụ chấm điểm). Mức Redefinition là cá nhân hoá phản hồi theo phong cách học, mức Modification là phản hồi đa cấp Hattie & Timperley không thể có với chấm điểm thủ công quy mô lớp.

## Câu hỏi tự kiểm tra
Hoạt động dạy-học bạn đang thiết kế đang ở SAMR bậc nào? Có thể nâng nó lên bậc nào cao hơn?`,
      dur: 12,
      order: 12,
    },
    {
      module: m2,
      title: "Tài liệu 2.1 - Khung Feed Up / Feed Back / Feed Forward",
      description: "Bài tổng hợp về 3 câu hỏi định hướng phản hồi của Hattie & Timperley (2007).",
      text: `# Khung Feed Up / Feed Back / Feed Forward (Hattie & Timperley, 2007)

Trong bài kinh điển "The power of feedback" (Review of Educational Research, 2007), Hattie và Timperley đề xuất khung 3 câu hỏi mà mọi phản hồi hiệu quả phải trả lời:

## 1. Feed Up - "Tôi đang đi đâu?"
Mục tiêu học tập là gì? Tiêu chí thành công ra sao?
- **Sai lầm thường gặp**: Giảng viên nhảy vào nhận xét bài làm mà chưa nhắc lại mục tiêu. Sinh viên không biết phản hồi đang đo lường họ theo thang nào.

## 2. Feed Back - "Tôi đang đi như thế nào?"
Tiến độ hiện tại so với mục tiêu? Bài làm đúng/sai/khác mục tiêu ra sao?
- Đây là phần phổ biến nhất, nhưng nhiều phản hồi DỪNG ở đây - làm sinh viên biết mình sai mà không biết phải làm gì.

## 3. Feed Forward - "Bước tiếp theo là gì?"
Hành động cụ thể nào sinh viên cần làm để tiến gần mục tiêu hơn?
- **Quan trọng nhất nhưng hay bị bỏ quên**. Quan sát của Blackwell (2024) trên 18 buổi học âm nhạc cho thấy 83% feedback là Feed Back, chỉ 16% là Feed Forward, và 0,4% là Feed Up.

## Tại sao 3 câu hỏi này quan trọng?

Vì học tập là quá trình ĐÓNG VÒNG: cần biết đích đến, biết hiện tại đang ở đâu, biết bước tiếp. Thiếu bất kỳ câu nào đều làm vòng lặp gãy.

## Bốn cấp phản hồi (đối tượng)

Cùng bài này, Hattie & Timperley cũng đề xuất 4 cấp:
1. **Task** - đúng/sai cụ thể
2. **Process** - cách thức/chiến lược
3. **Self-regulation** - giám sát siêu nhận thức
4. **Self** - khen/chê cá nhân (KHÔNG hiệu quả, có thể giảm học tập)

Phản hồi cấp Process và Self-regulation HIỆU QUẢ NHẤT. Cấp Self ("em giỏi lắm", "em cần chăm chỉ hơn") thường vô bổ hoặc có hại.

## Áp dụng vào AI feedback

Khi prompt cho ChatGPT/Claude sinh feedback, hãy yêu cầu rõ:
- 1 đoạn Feed Up nhắc mục tiêu
- 3 đoạn Feed Back tách theo 3 cấp Task/Process/Self-regulation
- 1 danh sách Feed Forward 2-3 hành động cụ thể
- Tránh feedback cấp Self`,
      dur: 10,
      order: 11,
    },
    {
      module: m3,
      title: "Tài liệu 3.1 - Metacognitive Laziness: Mặt tối của AI feedback",
      description:
        "Tóm tắt nghiên cứu Fan et al. (2025) trên British Journal of Educational Technology.",
      text: `# Metacognitive Laziness - Lười biếng tư duy siêu nhận thức

## Bối cảnh

Fan và cộng sự (2025) công bố trên British Journal of Educational Technology nghiên cứu thực nghiệm so sánh: nhóm sinh viên dùng ChatGPT vs nhóm tự làm, vs nhóm chỉ có gợi ý sư phạm. Kết quả gây tranh cãi:

- Nhóm dùng ChatGPT đạt **điểm bài luận cao nhất**.
- Nhưng KHÔNG vượt trội về **kiến thức tiếp thu** hay **khả năng chuyển giao** (transfer) sang vấn đề mới.
- Nhóm này thể hiện **ÍT quá trình SRL có chủ ý** - ít lập kế hoạch, ít giám sát, ít suy ngẫm.

## Hiện tượng

Tác giả gọi đây là "**metacognitive laziness**" - lười biếng tư duy siêu nhận thức. Sinh viên có xu hướng "**offload**" (chuyển giao) toàn bộ quá trình suy nghĩ-đánh giá-điều chỉnh cho AI.

Họ:
1. Đặt prompt → nhận output → copy/paste hoặc chỉnh nhẹ.
2. Không kiểm tra logic, không tự đặt câu hỏi.
3. Không phát triển khả năng tự đánh giá - vì AI đã đánh giá rồi.

## Hậu quả dài hạn

- Điểm cao TRONG NGẮN HẠN nhưng kiến thức không bền.
- Khả năng giải quyết vấn đề mới (không có AI) suy giảm.
- Self-efficacy có thể giảm ("Mình không tự làm được").

## Cách phòng ngừa - Scaffolding metacognition

Fan và cộng sự, cùng các nghiên cứu sau đó (Lan & Zhou, 2025) đề xuất:

1. **Yêu cầu sinh viên ĐÁNH GIÁ output của AI** thay vì chỉ chấp nhận.
2. **Câu hỏi siêu nhận thức bắt buộc** sau mỗi tương tác AI: "Em đồng ý với điểm nào? Không đồng ý chỗ nào? Tại sao?"
3. **Human-in-the-loop**: giảng viên review feedback của AI, ghi chú nếu cần.
4. **Hạn chế AI ở vai trò gợi ý**, không phải sản xuất bài làm.
5. **Đo lường SRL** trước-sau để phát hiện sớm.

## Áp dụng cho FeedBackMe

Hệ thống này được thiết kế với 3 cơ chế chống metacognitive laziness:
- Câu hỏi siêu nhận thức **bắt buộc** sau mỗi feedback AI.
- Giảng viên có **quyền duyệt** feedback (human-in-the-loop).
- Đo SRL **pre/post** để theo dõi sự thay đổi.

Nguồn: Fan, Y., et al. (2025). Beware of metacognitive laziness. British Journal of Educational Technology.`,
      dur: 12,
      order: 11,
    },
    {
      module: m3,
      title: "Tài liệu 3.2 - Human-in-the-loop trong AI giáo dục",
      description: "Vai trò mới của giảng viên trong kỷ nguyên AI feedback.",
      text: `# Human-in-the-loop trong AI giáo dục

## Vấn đề

Khi AI có thể tạo phản hồi tức thời cho hàng trăm sinh viên, vai trò của giảng viên là gì? Có cần giảng viên không?

Câu trả lời từ tổng hợp các nghiên cứu 2024-2025: **CÓ, nhưng vai trò ĐÃ thay đổi**.

## Mô hình "AI thay thế" - không hiệu quả

Một số trường thử để AI thay thế hoàn toàn vai trò chấm-phản hồi của giảng viên. Kết quả:
- Sinh viên mất niềm tin khi AI sai (hallucination).
- Phản hồi đôi khi không phù hợp ngữ cảnh văn hoá-sư phạm.
- "Metacognitive laziness" gia tăng.

## Mô hình "Human-in-the-loop" - hiệu quả hơn

Suraworachet và cộng sự, Fajardo-Ramos et al. (2025) chứng minh: nhóm sinh viên nhận feedback **kết hợp** (AI cung cấp phân tích hành vi + giảng viên cung cấp phản hồi nội dung) đạt:
- Tự suy ngẫm thường xuyên hơn.
- Điểm bài cao hơn.
- Đặc biệt **tác động mạnh với học sinh có SRL thấp**.

## Vai trò mới của giảng viên

Theo Fajardo-Ramos, Chiappe và Mella-Norambuena (2025), giảng viên chuyển từ:

| TỪ (vai trò cũ) | SANG (vai trò mới) |
|---|---|
| Sản xuất feedback | Thiết kế quy trình feedback |
| Chấm bài thủ công | Giám sát chất lượng AI feedback |
| Đứng lớp giảng | Tư vấn sư phạm cho nhóm nhỏ |
| Đánh giá tổng kết | Theo dõi quá trình học |

## Trong FeedBackMe

Mỗi phản hồi AI được lưu với trạng thái **pending_review**. Giảng viên có thể:
- **Approve** - đồng ý hoàn toàn.
- **Revise** - thêm ghi chú/chỉnh sửa, sinh viên thấy cả hai.
- **Reject** - sinh feedback lại.

Điều này giữ giảng viên trong vòng lặp, đảm bảo:
- Chất lượng feedback theo chuẩn sư phạm.
- AI không thành "máy chấm tự động".
- Giảng viên hiểu sinh viên đang gặp khó ở đâu (qua việc đọc feedback và bài làm).`,
      dur: 10,
      order: 12,
    },
  ];
  for (const p of pdfs) {
    insertMat.run(
      p.module,
      "pdf",
      p.title,
      p.description,
      null,
      null,
      p.text,
      null,
      null,
      p.dur,
      p.order,
    );
  }

  // QUIZZES (5) - mỗi quiz 5 câu trắc nghiệm
  const quizzes = [
    {
      module: m1,
      title: "Quiz 1.1 - Khái niệm cơ bản về Công nghệ Giáo dục",
      description: "5 câu kiểm tra hiểu biết về EdTech, SAMR, TPACK.",
      data: [
        {
          q: "EdTech (Educational Technology) chủ yếu nói về:",
          options: [
            "Chỉ phần cứng máy tính trong lớp học",
            "Việc sử dụng công nghệ có chủ đích sư phạm để hỗ trợ dạy-học",
            "Phần mềm thi trắc nghiệm online",
            "Mạng xã hội cho giáo viên",
          ],
          correct_idx: 1,
          explanation:
            "EdTech là lĩnh vực rộng về tích hợp công nghệ với mục tiêu sư phạm rõ ràng, không giới hạn ở phần cứng hay phần mềm cụ thể.",
        },
        {
          q: "Trong mô hình SAMR, cấp 'Substitution' nghĩa là:",
          options: [
            "Công nghệ thay thế công cụ cũ nhưng không thay đổi chức năng",
            "Công nghệ tạo ra hoạt động hoàn toàn mới",
            "Công nghệ cho phép cộng tác liên ranh giới",
            "Công nghệ làm tăng tính cá nhân hoá",
          ],
          correct_idx: 0,
          explanation:
            "Substitution chỉ là thay thế đơn thuần, ví dụ đọc PDF thay vì giáo trình giấy.",
        },
        {
          q: "Khung TPACK gồm 3 vòng tròn nào?",
          options: [
            "Teacher - Parent - Administrator",
            "Theory - Practice - Application",
            "Technology - Pedagogy - Content",
            "Time - Place - Context",
          ],
          correct_idx: 2,
          explanation:
            "TPACK = Technological Pedagogical Content Knowledge của Mishra & Koehler (2006).",
        },
        {
          q: "Khi giảng viên dùng Google Docs cho sinh viên cộng tác viết bài thay vì viết riêng lẻ, đây là cấp SAMR nào?",
          options: ["Substitution", "Augmentation", "Modification", "Redefinition"],
          correct_idx: 2,
          explanation:
            "Cộng tác đồng thời nhiều người không thể làm được với giấy bút truyền thống → đây là Modification (thiết kế lại nhiệm vụ).",
        },
        {
          q: "Bậc cao nhất của SAMR ('Redefinition') đặc trưng bởi:",
          options: [
            "Chuyển từ giấy sang số",
            "Tự động hoá hoàn toàn",
            "Tạo ra nhiệm vụ MỚI mà trước đây không thể hình dung được",
            "Giảm chi phí giáo dục",
          ],
          correct_idx: 2,
          explanation:
            "Redefinition là khi công nghệ tạo ra trải nghiệm học tập hoàn toàn mới, vd kết nối đa văn hoá thời gian thực.",
        },
      ],
      order: 21,
    },
    {
      module: m2,
      title: "Quiz 2.1 - Khung phản hồi Hattie & Timperley",
      description: "5 câu kiểm tra hiểu biết về Feed Up/Back/Forward và 4 cấp phản hồi.",
      data: [
        {
          q: "Feed Up trả lời câu hỏi nào?",
          options: [
            "Tôi đã làm tốt chưa?",
            "Tôi đang đi đâu?",
            "Bước tiếp theo là gì?",
            "Bạn có thích bài này không?",
          ],
          correct_idx: 1,
          explanation: "Feed Up nhắc lại MỤC TIÊU học tập trước khi bàn về tiến độ.",
        },
        {
          q: "Trong 4 cấp phản hồi của Hattie & Timperley, cấp nào KHÔNG hiệu quả hoặc có hại?",
          options: ["Task", "Process", "Self-regulation", "Self"],
          correct_idx: 3,
          explanation:
            "Phản hồi cấp Self ('em giỏi lắm', 'em yếu') thường vô bổ và có thể làm giảm học tập.",
        },
        {
          q: 'Phản hồi nào sau đây là Feed Forward?',
          options: [
            "Mục tiêu của bài là phân tích SAMR.",
            "Em đã phân loại sai cấp Modification ở câu 2.",
            "Tuần tới em hãy chọn 1 hoạt động khác và áp dụng cùng khung phân tích.",
            "Bài làm của em chấp nhận được.",
          ],
          correct_idx: 2,
          explanation:
            "Feed Forward đề xuất hành động cụ thể cho bước tiếp theo.",
        },
        {
          q: "Theo Hattie, hai cấp phản hồi HIỆU QUẢ NHẤT là:",
          options: [
            "Task và Self",
            "Process và Self-regulation",
            "Self và Self-regulation",
            "Task và Process",
          ],
          correct_idx: 1,
          explanation:
            "Process (cách làm) và Self-regulation (tự điều chỉnh) cho hiệu ứng cao nhất, đặc biệt với người đã có nền tảng.",
        },
        {
          q: "Quan sát của Blackwell (2024) cho thấy 83% feedback của giáo viên thuộc loại Feed Back, chỉ 16% Feed Forward, 0,4% Feed Up. Hệ quả chính là gì?",
          options: [
            "Sinh viên hài lòng hơn",
            "Sinh viên biết mình sai nhưng không biết phải cải thiện thế nào",
            "Giảng viên tiết kiệm thời gian",
            "Không có hệ quả đáng kể",
          ],
          correct_idx: 1,
          explanation:
            "Mất cân bằng này khiến vòng lặp học tập gãy - sinh viên thiếu định hướng cải thiện.",
        },
      ],
      order: 21,
    },
    {
      module: m2,
      title: "Quiz 2.2 - Đánh giá hình thành (Formative Assessment)",
      description: "5 câu kiểm tra phân biệt formative vs summative assessment.",
      data: [
        {
          q: "Đánh giá hình thành (formative) khác đánh giá tổng kết (summative) ở chỗ:",
          options: [
            "Hình thành thường xuyên hơn và phục vụ điều chỉnh dạy-học",
            "Hình thành cho điểm cao hơn",
            "Hình thành chỉ dùng cho sinh viên giỏi",
            "Hình thành chỉ là tự đánh giá",
          ],
          correct_idx: 0,
          explanation:
            "Formative diễn ra trong quá trình, mục tiêu là cải thiện. Summative ở cuối, mục tiêu là xếp loại.",
        },
        {
          q: "Một bài quiz giữa kỳ KHÔNG tính điểm vào điểm cuối, có giải thích đáp án ngay sau mỗi câu, là loại đánh giá:",
          options: ["Summative", "Formative", "Diagnostic", "Cả 3"],
          correct_idx: 1,
          explanation:
            "Đây là formative điển hình: mục tiêu cải thiện, có feedback ngay, không xếp loại.",
        },
        {
          q: "Đánh giá chẩn đoán (diagnostic) thường được làm khi nào?",
          options: [
            "Trước khi bắt đầu khoá học hoặc chủ đề mới",
            "Vào cuối kỳ",
            "Sau mỗi bài giảng",
            "Chỉ khi sinh viên yêu cầu",
          ],
          correct_idx: 0,
          explanation:
            "Diagnostic xác định người học đang ở đâu trước khi học, để giảng viên điều chỉnh.",
        },
        {
          q: "Theo de Schipper et al. (2021), 'summative-as-formative' nghĩa là:",
          options: [
            "Không cho điểm cuối kỳ",
            "Dùng kết quả đánh giá tổng kết để gợi ý bài luyện tiếp theo cá nhân hoá",
            "Bỏ hoàn toàn đánh giá tổng kết",
            "Chỉ chấm điểm tự đánh giá",
          ],
          correct_idx: 1,
          explanation:
            "Đây là cách AI/recommender system xoá nhoà ranh giới formative vs summative.",
        },
        {
          q: "Lợi ích chính của AI feedback ngắn hạn so với feedback giảng viên là:",
          options: [
            "Chính xác hơn",
            "Có cảm xúc hơn",
            "Tức thời và mở rộng được quy mô lớn",
            "Rẻ hơn về chi phí giáo viên",
          ],
          correct_idx: 2,
          explanation:
            "AI cho phép feedback tức thời cho hàng trăm sinh viên - điều bất khả với giảng viên đứng lớp đông.",
        },
      ],
      order: 22,
    },
    {
      module: m3,
      title: "Quiz 3.1 - AI và metacognitive laziness",
      description: "5 câu về rủi ro lạm dụng AI và cách phòng ngừa.",
      data: [
        {
          q: "'Metacognitive laziness' (Fan et al., 2025) chỉ:",
          options: [
            "Sinh viên lười học",
            "Sinh viên chuyển giao (offload) toàn bộ quá trình tư duy cho AI",
            "AI không có khả năng siêu nhận thức",
            "Giảng viên lười chấm bài",
          ],
          correct_idx: 1,
          explanation:
            "Sinh viên đặt prompt → nhận output → dùng mà không tự đánh giá hay suy ngẫm.",
        },
        {
          q: "Trong nghiên cứu của Fan et al. (2025), nhóm dùng ChatGPT đạt kết quả gì?",
          options: [
            "Cao hơn ở tất cả chỉ số",
            "Cao nhất về điểm bài luận, nhưng KHÔNG vượt trội về kiến thức tiếp thu và transfer",
            "Thấp nhất về mọi chỉ số",
            "Tương đương nhóm đối chứng",
          ],
          correct_idx: 1,
          explanation:
            "Đây là nghịch lý: điểm cao nhưng học không sâu, transfer kém, SRL giảm.",
        },
        {
          q: "Cơ chế nào sau đây KHÔNG giúp chống metacognitive laziness?",
          options: [
            "Bắt sinh viên đánh giá output của AI",
            "Câu hỏi siêu nhận thức sau mỗi tương tác AI",
            "Cho phép sinh viên copy nguyên văn output AI vào bài",
            "Human-in-the-loop với giảng viên duyệt feedback",
          ],
          correct_idx: 2,
          explanation:
            "Cho phép copy nguyên văn LÀM GIA TĂNG metacognitive laziness, không phòng ngừa.",
        },
        {
          q: "Theo nguyên tắc 'Human-in-the-loop', giảng viên trong hệ thống AI feedback có vai trò:",
          options: [
            "Hoàn toàn bị thay thế bởi AI",
            "Chỉ là quan sát viên thụ động",
            "Thiết kế quy trình + giám sát chất lượng + duyệt feedback của AI",
            "Chỉ chấm điểm cuối kỳ",
          ],
          correct_idx: 2,
          explanation:
            "Vai trò chuyển từ 'sản xuất feedback' sang 'thiết kế và giám sát feedback'.",
        },
        {
          q: "Trong hệ thống FeedBackMe, dấu vết hành vi nào KHÔNG được ghi lại để phân tích nghiên cứu?",
          options: [
            "Thời gian làm bài",
            "Số lần paste văn bản",
            "Nội dung clipboard của sinh viên ở các trang khác",
            "Số lần chỉnh sửa",
          ],
          correct_idx: 2,
          explanation:
            "Hệ thống chỉ ghi log trong phạm vi trang web theo thông báo, tôn trọng quyền riêng tư.",
        },
      ],
      order: 21,
    },
    {
      module: m3,
      title: "Quiz 3.2 - Cá nhân hoá và đạo đức trong AI feedback",
      description: "5 câu về các trục cá nhân hoá và rủi ro đạo đức.",
      data: [
        {
          q: "Cá nhân hoá theo trình độ năng lực (proficiency-based) điều chỉnh:",
          options: [
            "Màu nền của giao diện",
            "Độ khó, dạng feedback và thời điểm can thiệp theo năng lực hiện tại",
            "Ngôn ngữ giao diện",
            "Tốc độ video bài giảng",
          ],
          correct_idx: 1,
          explanation:
            "Proficiency-based personalization là 1 trong 3 trục chính (cùng SRL-based và behavioral-trace-based).",
        },
        {
          q: "Hiện tượng 'overscaffolding' (Han et al., 2025) chỉ:",
          options: [
            "Học sinh có SRL cao bị giảm việc dùng chiến lược do được hỗ trợ quá mức",
            "AI cung cấp quá nhiều ví dụ",
            "Lớp học có quá nhiều giảng viên",
            "Hệ thống chậm do quá nhiều scaffold",
          ],
          correct_idx: 0,
          explanation:
            "Hỗ trợ phù hợp với SRL thấp nhưng có thể PHẢN TÁC DỤNG với SRL cao.",
        },
        {
          q: "Liêm chính học thuật trong môi trường AI feedback đặc biệt cần lưu ý vì:",
          options: [
            "AI luôn sai",
            "Sinh viên có thể dùng AI sinh nguyên bài rồi nộp",
            "AI miễn phí",
            "AI nhanh hơn người",
          ],
          correct_idx: 1,
          explanation:
            "Đây là rủi ro thực tế - cần thiết kế hoạt động đánh giá khó cho AI làm hộ.",
        },
        {
          q: "Trong khung phong cách học Felder-Silverman, người 'Visual' học tốt nhất qua:",
          options: ["Lời giảng", "Hình ảnh, sơ đồ, biểu đồ", "Đọc văn bản dài", "Thảo luận nhóm"],
          correct_idx: 1,
          explanation:
            "Visual ưa hình ảnh; Verbal ưa lời nói/văn bản. Đây là một chiều của Felder-Silverman LSI.",
        },
        {
          q: "Người học có SRL THẤP nên nhận feedback AI như thế nào?",
          options: [
            "Tự do, không có scaffold",
            "Có scaffold rõ ràng, câu hỏi gợi mở, Feed Forward chia nhỏ",
            "Chỉ feedback cấp Self",
            "Không nhận feedback",
          ],
          correct_idx: 1,
          explanation:
            "SRL thấp cần SCAFFOLD nhiều hơn để xây dựng kỹ năng tự điều chỉnh; SRL cao cần ÍT scaffold để tránh overscaffolding.",
        },
      ],
      order: 22,
    },
  ];
  for (const z of quizzes) {
    insertMat.run(
      z.module,
      "quiz",
      z.title,
      z.description,
      null,
      null,
      null,
      JSON.stringify(z.data),
      null,
      8,
      z.order,
    );
  }

  // Học liệu LMS bổ sung: slides + file + link + discussion mẫu
  insertMat.run(
    m1, "slides", "Slides Tuần 1 - Giới thiệu EdTech",
    "Slide trình chiếu được nhúng (Google Slides công khai)",
    null, null, null, null,
    "https://docs.google.com/presentation/d/e/2PACX-1vTHCEdGd6XKlHnlQNOcMWGWv0n3a_w7n7g4t6oYtO5rXzoVw6f7AlJiqM7w7T_xsg/embed",
    15, 31,
  );
  insertMat.run(
    m2, "link", "Trang bài viết: Hattie's feedback model",
    "Bài viết blog tổng hợp khung Hattie & Timperley",
    null, null, null, null,
    "https://visible-learning.org/2013/10/john-hattie-article-feedback-in-schools/",
    8, 31,
  );
  insertMat.run(
    m3, "file", "Tài liệu PDF: Beware of metacognitive laziness (Fan et al.)",
    "Bản preprint nghiên cứu gốc - tải về để đọc offline",
    null, null, null, null,
    "https://onlinelibrary.wiley.com/doi/10.1111/bjet.13544",
    20, 31,
  );
  insertMat.run(
    m3, "discussion", "Thảo luận: Bạn đã từng dùng AI để học như thế nào?",
    "Chia sẻ trải nghiệm cá nhân với ChatGPT/Claude khi học - thuận lợi/khó khăn.",
    null, null, null, null, null, null, 32,
  );

  // Announcement mẫu
  db.prepare(
    "INSERT INTO announcements (course_id, author_id, title, body, pinned) VALUES (?, ?, ?, ?, ?)",
  ).run(
    courseId,
    teacherId,
    "Chào mừng đến với khoá Nhập môn Công nghệ Giáo dục",
    "Các em hãy hoàn thành onboarding, sau đó học tuần 1 trong tuần đầu tiên. Tham gia thảo luận ở Tuần 3 để chia sẻ trải nghiệm dùng AI. Có thắc mắc gì hãy nhắn ở mục thảo luận.",
    1,
  );

  // Learning style mẫu cho 2 SV personalized (1 visual+sequential, 1 verbal+global)
  const insertLS = db.prepare(
    "INSERT INTO learning_styles (user_id, active_reflective, sensing_intuitive, visual_verbal, sequential_global) VALUES (?, ?, ?, ?, ?)",
  );
  insertLS.run(studentIds[2], -1, -2, -2, -1); // active, sensing, visual, sequential
  insertLS.run(studentIds[3], 1, 1, 2, 2); // reflective, intuitive, verbal, global

  // SRL pre cho cả 4
  const insertSRL = db.prepare(
    "INSERT INTO srl_responses (user_id, phase, responses, score_total, score_forethought, score_performance, score_reflection) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  insertSRL.run(studentIds[0], "pre", "{}", 2.5, 2.3, 2.6, 2.6); // SRL thấp
  insertSRL.run(studentIds[1], "pre", "{}", 4.2, 4.1, 4.3, 4.2); // SRL cao
  insertSRL.run(studentIds[2], "pre", "{}", 2.8, 2.5, 3.0, 2.9); // SRL thấp-trung
  insertSRL.run(studentIds[3], "pre", "{}", 4.0, 4.0, 4.0, 4.0); // SRL cao

  // IRB consent đã có sẵn cho SV mẫu (để demo không bắt consent lại)
  const insertConsent = db.prepare(
    "INSERT INTO consent_records (user_id, consent_text_version, consented, consented_at) VALUES (?, 'v1.0-2026', 1, datetime('now'))",
  );
  for (const sid of studentIds) insertConsent.run(sid);

  console.log("✓ Seed xong.");
  console.log("\n=== TÀI KHOẢN MẪU ===");
  console.log("System Admin:        admin / admin123");
  console.log("Institution Admin:   qt.hust / admin123  (HUST)");
  console.log("Giảng viên:          gv.huyen / teacher123  (TS. Nguyễn Thị Huyền - HUST)");
  console.log("Giảng viên:          gv.minh / teacher123   (ThS. Trần Văn Minh - HUST)");
  console.log("SV (control):        sv001 / student123  (Nguyễn Văn An)");
  console.log("SV (control):        sv002 / student123  (Trần Thị Bình)");
  console.log("SV (personalized):   sv003 / student123  (Lê Hoàng Cường)");
  console.log("SV (personalized):   sv004 / student123  (Phạm Mai Dung)");
  console.log(
    `\nIDs - SystemAdmin: ${adminId}, InstAdmin: ${instAdminHustId}, Teachers: ${teacherId}, ${teacher2Id}`,
  );
  console.log(`Institutions: HUST=${inst1}, NEU=${inst2}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

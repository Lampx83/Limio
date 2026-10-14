# SPEC — Web trình chiếu "Limio – Giới thiệu hệ thống"

Người nghe: **lãnh đạo và nhà khoa học** → tiếng Việt, nghiêm túc, chính xác, chuyên nghiệp; ấn tượng bằng thiết kế và chuyển động vector, KHÔNG bằng emoji, confetti, ngôn từ quảng cáo. Không bịa số liệu, trích dẫn, kết quả nghiên cứu. Số liệu phải lấy từ FACT SHEET bên dưới; chỗ nào không chắc thì không nói.

Thư mục làm việc: `/private/tmp/claude-501/-Users-mac-Documents-Code-Limio/5140f290-bc8d-43d2-8950-250b508982d3/scratchpad/deck/`
- `shell.css`, `shell.js` — khung dùng chung (ĐỌC KỸ cả hai trước khi viết). KHÔNG sửa hai file này. Cần gì thêm thì viết CSS/JS riêng trong slide của bạn.
- `slides/sNN.html` — mỗi slide MỘT file do bạn viết (chỉ ghi vào file slide được giao).
- `img/` — ảnh chụp giao diện (đã che tên học viên). Trong HTML dùng đường dẫn tương đối `img/ui1.jpg`.
- `build.sh` ghép tất cả thành `apps/web/public/gioi-thieu/index.html` và kiểm tra cú pháp script. Bạn được chạy `bash build.sh` để kiểm tra lỗi cú pháp JS (đừng sửa build.sh). Đừng mở trình duyệt.

## Hợp đồng một file slide

Mỗi file chứa đúng MỘT `<section>` (kèm `<style>` và `<script>` nằm TRONG section):

```html
<section class="slide tone-light" id="s06" data-title="Mô phỏng truy vết tri thức" data-section="Cá nhân hoá">
  <div class="slide-in">
    <div class="eyebrow rv">Mô hình người học</div>
    <h2 class="h2 rv">…</h2>
    …
  </div>
  <aside class="notes"><p>Lời dẫn cho người trình bày…</p></aside>
  <style> #s06 .foo{…} </style>
  <script>(function(){ Deck.on('s06',{enter:function(c){…},leave:function(c){…}}); })();</script>
</section>
```
- `tone-dark` hoặc `tone-light` (xem `shell.css`). Mỗi slide tự có nền, đường lượn "flow" và quả cầu mờ trôi chậm — không cần tự vẽ nền.
- CSS của bạn phải **được giới hạn bằng tiền tố `#sNN`**. Màu dùng token (`var(--fg)`, `var(--fg2)`, `var(--acc)`, `var(--hi)`, `var(--card)`, `var(--cardline)`, `var(--line)`, `var(--soft)`, `var(--grad)`…) để chạy đúng cả hai tone. Không dùng màu cố định cho chữ.
- Nội dung nằm trong `.slide-in` (flex dọc, căn giữa). Khung nhìn chuẩn 1920×1080 ⇒ vùng nội dung ≈ 80rem × 42rem (1rem ≈ 20px). **Phải nằm gọn trong 42rem chiều cao ở 1920×1080**; màn nhỏ thì tự cuộn dọc nên layout phải xếp được 1 cột (dùng `.cols`, `.split`, grid `minmax(0,1fr)`, `flex-wrap`).
- `<aside class="notes">` = lời dẫn người trình bày (HTML đơn giản `<p>`; 70–140 từ; có gợi ý thời lượng ở dòng đầu, ví dụ “(≈ 90 giây)”; nêu ý chính cần nhấn và 1 câu chuyển tiếp sang slide sau).

## Quy tắc chuyển động (rất quan trọng)

1. **Nội dung tự hiện ra, người trình bày không phải bấm.** Thêm class `rv` vào từng khối nội dung theo thứ tự đọc; engine tự gán độ trễ lần lượt (≈0,3 giây mỗi khối) và hiện chậm, mượt. Biến thể: `rv-l`, `rv-r` (trượt ngang), `rv-s` (phóng nhẹ), `rv-f` (chỉ mờ dần). Khối lồng nhau: chỉ gắn `rv` ở lớp ngoài cùng hoặc ở từng thẻ con, đừng cả hai (sẽ nhân đôi hiệu ứng). Có thể ép thứ tự bằng `data-rv="n"`.
2. Mọi thứ cốt lõi của slide phải hiện ra **tự động** trong khoảng 6–8 giây đầu: chuỗi sự kiện, hoạt cảnh, biểu đồ vẽ nét... chạy tự động bằng `c.timeout / c.interval` (tự dọn khi rời slide). Tương tác (bấm tab, kéo thanh trượt, nút "Thử") chỉ là phần phụ để người xem/ người trình bày khám phá thêm — không được là điều kiện để thấy nội dung. Tab: dùng `Deck.tabs(c, barEl, {auto: 6500})` để tự xoay vòng, người dùng bấm thì dừng.
3. Mỗi slide có **ít nhất một hình vẽ vector (SVG/CSS) chuyển động liên tục nhẹ nhàng** (đường dữ liệu chạy, nút nhịp, vòng tròn lan toả, đường vẽ nét…) phù hợp nội dung. Vẽ nét: thêm class `draw` và `pathLength="1"` lên `<path>/<line>` (engine tự vẽ khi slide vào). Số đếm lên: `<span data-count="85" data-suffix="%">`.
4. Chuyển động chuyên nghiệp: easing mềm (`var(--ease)`), thời lượng 0,6–1,4 giây, không giật, không nhấp nháy mạnh, không xoay nhanh. Có `prefers-reduced-motion` thì engine đã giảm; animation riêng của bạn cũng nên tôn trọng (dùng `Deck.reduce`).
5. Khi dùng `setInterval/setTimeout` luôn dùng `c.interval/c.timeout`, sự kiện qua `c.on(el,'click',fn)`. Mọi trạng thái động phải được **đặt lại về trạng thái đầu trong `enter`** (slide có thể được vào lại).

## API (xem shell.js)

- `Deck.on(id,{enter(c),leave(c)})`; `c.root` (section), `c.timeout`, `c.interval`, `c.on`.
- `Deck.tabs(c, barEl, {auto, panelsRoot, onChange})` — `barEl` chứa `<button data-tab="key">`, panel là `[data-panel="key"]`, thêm `<i class="tab-progress"></i>` trong barEl để có thanh tiến trình.
- Quả chanh Limio (key visual): `<div data-kv='{"mode":"ghost","nodes":true}'></div>` (engine tự vẽ vector động khi vào slide; `mode`: `solid` | `ghost`; `nodes`: true hiện mạng nút + gói dữ liệu chạy). Đặt kích thước bằng CSS (width) cho div bao. Dùng tiết chế ("ghost" lớn mờ làm nền/ góc, hoặc nhỏ làm điểm nhấn).
- Icon: `<svg class="i"><use href="#i-book"/></svg>`. Có: book live exam pen target route folder trophy shield server building chart users spark check x flow clock lock layers cpu grad msg flask eye link database bolt user arrow play tag scale heart mobile refresh.
- Class sẵn: `.eyebrow .h1 .h2 .h3 .lead .p .sm .mono .grad-text .script .hl .cols(.cols-2/3/4) .split(--a/--b) .stack .row .card .chip(.hi) .btn(.primary) .ico(.pink) .tabs .panel .frame(.frame-bar + img) .divider`.
- `.frame` bao ảnh chụp giao diện: `<div class="frame rv rv-s"><div class="frame-bar"><i></i><i></i><i></i><span>limio.vn</span></div><img src="img/ui1.jpg" alt="…"></div>`; bấm ảnh sẽ phóng to (engine xử lý).

## Phong cách thiết kế (bộ nhận diện Limio)
Xanh rừng đậm + xanh lime (#84CC16/#A3E635), hồng #EC4899 chỉ làm điểm nhấn/gradient "dưa hấu" (lime → hồng). Font Inter (chữ), JetBrains Mono (tên sự kiện/công thức), Nunito nghiêng (khẩu hiệu "Teach in Flow", "Learn in Flow"). Bo góc vừa (10–14px), thẻ phẳng, bóng nhẹ; đường kẻ mảnh; gradient nhẹ nhàng, không sặc sỡ. Chữ ≥ 0.86rem (trình chiếu trên phòng lớn: ưu tiên chữ lớn, ít chữ, ý rõ). Mỗi slide một ý chính; tiêu đề `.h2` nêu kết luận ngắn gọn, giọng khoa học-trung tính (không sáo rỗng).

## Ảnh giao diện có sẵn (dữ liệu demo; KHÔNG trích con số trong ảnh như thống kê của sản phẩm)
- `img/ui1.jpg` Bảng điều khiển giảng viên: 4 thẻ số (khoá đang dạy, học viên, việc cần xử lý, học viên im ắng >14 ngày), danh sách "Cần xử lý gấp" xếp theo mức độ (Gấp / Trung bình / Có thể chờ), lịch tuần.
- `img/ui2.jpg` "Khoá học của tôi" của giảng viên (thẻ khoá học, nhãn AI feedback, trạng thái Đã publish/Nháp).
- `img/ui3.jpg` Màn chấm bài: nút "Gợi ý bằng AI", ô điểm /10, ô nhận xét, ghi chú AI chỉ gợi ý, giảng viên quyết định.
- `img/ui4.jpg` Limio-Live "Hoạt động nhanh": Vote, Word Cloud, Padlet, Draw-it, Whiteboard; đang chiếu Word Cloud kèm mã QR để sinh viên tham gia.
- `img/ui5.jpg` "Kiểm tra đánh giá": 3 bước Ngân hàng câu hỏi → Thiết kế đề thi → Tổ chức thi.
- `img/ui6.jpg` Vấn đáp AI — theo dõi thời gian thực: các thí sinh "Đang thi", tiến độ câu hỏi, cảnh báo rời tab/thoát toàn màn hình (tên đã làm mờ).
- `img/ui8.jpg` Không gian người học: Tiếp tục học, Học tập (khoá học, ghi chú, kỹ năng, huy hiệu, e-Portfolio), Phản hồi, Khám phá (catalog, đấu trường, bảng xếp hạng), lịch.
- `img/ui9.jpg` Trang khoá học của người học: tiến độ, chuỗi ngày, XP/level, "Lộ trình của bạn", bảng xếp hạng (tên đã làm mờ).

## FACT SHEET (nguồn: tài liệu giới thiệu + mã nguồn; chỉ dùng những điều dưới đây)

**Sản phẩm**: Limio – nền tảng dạy & học AI cá nhân hoá. Khẩu hiệu: Teach in Flow (giảng viên) / Learn in Flow (người học). Tên miền limio.vn (và bản limio.hust.edu.vn). All-in-one, hỗ trợ trực tuyến và trực tiếp trên lớp. Thiết kế từ "nỗi đau" của giảng viên: phải ghép nhiều công cụ rời rạc (LMS, Kahoot, MS Teams, Zalo, ChatGPT, bảng tính) để vận hành lớp; khó theo dõi sát từng người học; mất thời gian phản hồi kịp thời, đúng lúc, phù hợp từng người.
**Điểm khác biệt**: toàn bộ hoạt động dạy-học chạy trên MỘT dòng dữ liệu học tập; phản hồi AI, kết quả thi, bài nộp, điểm thưởng, hồ sơ cá nhân luôn khớp nhau.
**Giảng viên**: (1) Dạy học: soạn khoá học và học liệu có AI hỗ trợ; chia lớp, mời học viên qua đường liên kết, đặt hạn nộp bài/hạn quiz riêng từng lớp; lịch học và kỳ học theo tổ chức; diễn đàn; cấp chứng chỉ khi hoàn thành. (2) Limio-Live: soạn bài giảng gồm slide nội dung xen slide hoạt động (quiz, thăm dò ý kiến, bảng cộng tác – Vote, Word Cloud, Padlet, Draw-it, Whiteboard), trình chiếu đồng bộ; kết quả buổi học ghi vào hồ sơ người học và điểm thưởng. (3) Thi & kiểm tra đánh giá: Ngân hàng câu hỏi → Đề thi → Đợt thi › Ca thi › Phòng thi; thí sinh vào bằng mã hoặc tài khoản đã ghi danh; nhiều dạng câu hỏi (kể cả ghép nối, sắp xếp thứ tự); 2 chế độ giao diện Cơ bản/Nâng cao cho đánh giá quá trình, giữa kỳ, cuối kỳ, tiểu luận, xây dựng sản phẩm; phòng vấn đáp AI tiết kiệm thời gian so với vấn đáp truyền thống; giám sát thời gian thực. (4) Giao bài, thu bài, chấm và chữa: theo dõi tình trạng nộp từng lớp; AI hỗ trợ chấm, nhận xét, chữa bài; giảng viên luôn quyết định kết quả cuối.
**Người học**: mỗi bài học tự động thành một chủ đề kiến thức (lesson-as-tag, giảng viên không phải gắn tag tay); ước lượng mức thành thạo từng chủ đề bằng Bayesian Knowledge Tracing (BKT); nhãn 3 mức Cần ôn (<0,60) / Nên luyện thêm (0,60–<0,85) / Vững (≥0,85) kèm gợi ý nội dung nên học tiếp; **người học không thấy số %, chỉ thấy nhãn; giảng viên thấy số**; lộ trình chỉ gợi ý (người học vẫn chủ động; chủ đề đã Vững có thể gợi ý lướt qua); e-Portfolio gồm bài đã chấm theo khoá, người học tự quyết định công khai hay không; động lực: XP, huy hiệu, chuỗi ngày học, bảng xếp hạng (người học có thể rút khỏi bảng xếp hạng), nhiệm vụ, giải đấu.
**BKT (mã nguồn)**: P(L0)=0,10; P(T)=0,10; P(S)=0,10; P(G)=0,20. Đúng: post = P(L)(1−S) / [P(L)(1−S)+(1−P(L))G]. Sai: post = P(L)S / [P(L)S+(1−P(L))(1−G)]. Sau đó P(L')=post+(1−post)·T. Ví dụ chuỗi Đ,Đ,S,Đ,Đ cho 0,40 → 0,775 → 0,371 → 0,754 → 0,939. Ngưỡng: 0,60 và 0,85. Tham số là giá trị khởi đầu thận trọng, chưa hiệu chỉnh theo dữ liệu thực.
**Gamification & chống lạm dụng (mã nguồn)**: XP cơ sở quiz đạt lần đầu 50, làm lại 20; hoàn thành bài học 10 XP; có trần theo ngày cho từng loại hành động (vượt trần: ghi 0 XP kèm vết kiểm toán); hệ số thích ứng theo mức thành thạo kỹ năng của quiz: quiz dễ với người đã giỏi (mastery >0,85) hệ số 0,5; chưa có dữ liệu = 1,0; hoàn thành quiz dưới 10 giây không được cộng XP (ghi bản ghi kiểm toán). Chuỗi ngày, huy hiệu, nhiệm vụ, giải đấu (Đấu trường).
**Kiến trúc**: 3 module nghiệp vụ độc lập — LMS Core, Feedback Engine, Gamification — **không gọi trực tiếp lẫn nhau**; giao tiếp qua (a) bảng chung (Skill, LearnerSkillState…) và (b) nhật ký sự kiện `LearningEvent` (event sourcing: append-only, kiểm tra schema theo từng loại, idempotent, dựng lại trạng thái được). Tên sự kiện dạng `miền.thực_thể.động_từ_quá_khứ`: `lesson.viewed`, `quiz.question.answered`, `skill.state.updated`, `feedback.delivered`, `xp.awarded`, `badge.earned`, `tournament.mission.completed`. Kiến trúc 4 lớp: Trình bày → Ứng dụng (3 module) → Trí tuệ (mô hình người học, LLM) → Dữ liệu & hạ tầng. Công nghệ: Next.js + Tailwind, PostgreSQL + Prisma, Redis + BullMQ, mô hình ngôn ngữ lớn cho phản hồi AI, Docker + triển khai tự động (CI/CD). Giao diện thích ứng máy tính, máy tính bảng, điện thoại.
**Thiết kế phục vụ nghiên cứu (mã nguồn)**: mỗi lượt phản hồi (FeedbackDelivery) được mã hoá ngay lúc sinh theo mô hình tầng phản hồi của Hattie & Timperley (tầng trội và mọi tầng có mặt, mức chi tiết, nguồn sinh, ngữ cảnh sinh); mức nắm vững tại thời điểm sinh được chụp trước khi chấm để tránh lệch; hàng cũ chưa mã hoá được đánh dấu rõ, không giả như đã mã hoá; đo mức tiếp nhận phản hồi (người học có bấm vào nội dung ôn tập — sự kiện `feedback.remediation.clicked` — việc ghi không làm chậm điều hướng); hỗ trợ điều kiện phản hồi theo từng lớp (cá nhân hoá hay tối giản) để giảng viên so sánh 2 lớp song song cùng một khoá; lời khen cá nhân (tầng "self") cố ý không đưa vào kênh phản hồi học tập mà nằm ở kênh điểm thưởng.
**Cơ sở khoa học**: Hattie & Timperley (2007) — phản hồi; Bloom (1984) — cá nhân hoá/ dạy kèm 1-1 (bài toán "2 sigma"); Corbett & Anderson (1994) — knowledge tracing; Black & Wiliam (1998) — đánh giá hình thành; Deci & Ryan (2000) — lý thuyết tự quyết (động lực).
**Quản trị & vận hành**: chạy hoàn toàn bằng Docker; 2 bản triển khai độc lập (limio.vn; limio.hust.edu.vn) mỗi bản có CSDL, tệp tải lên, cấu hình riêng; cấu hình riêng theo tổ chức qua biến môi trường (không gắn cứng theo tên miền); push lên nhánh chính tự động build–migrate–triển khai–kiểm tra sức khoẻ; sao lưu CSDL hằng ngày và hằng tuần, mỗi bản sao lưu được tự kiểm chứng ngay sau khi tạo; đã tối ưu cho kịch bản thi quy mô 5.000 thí sinh đồng thời (nhiều bản sao web, chấm điểm chạy nền) — đây là mục tiêu thiết kế, không nói là đã đo đủ; người học có thể rút khỏi bảng xếp hạng; điểm quyền riêng tư mặc định: endpoint dữ liệu hồ sơ học tập phải xác thực và phân quyền. Phù hợp bối cảnh Việt Nam: lớp thiếu thiết bị, thi theo đợt–ca–phòng, giao diện tiếng Việt, múi giờ Việt Nam.
**Đang thử nghiệm tại** (một số học phần): Khoa Khoa học & Công nghệ Giáo dục — ĐH Bách khoa Hà Nội; Khoa Ngoại ngữ — ĐH Bách khoa Hà Nội; Khoa CNTT — ĐH Kinh tế Quốc dân; Khoa Dược — Cao đẳng Y tế Hà Nội; Khoa Ngoại ngữ — Cao đẳng Công nghệ cao Hà Nội. Sản phẩm mới ra mắt; chưa có kết quả hiệu quả công bố.
**Liên hệ**: TS. Nguyễn Thị Huyền – Khoa Khoa học & Công nghệ Giáo dục, ĐH Bách khoa Hà Nội; Phòng M329, Nhà C7; huyen.nguyenthi2@hust.edu.vn. Địa chỉ web: limio.vn.

---
## CẬP NHẬT (quan trọng)
- **Mục đích của bản trình chiếu là MARKETING sản phẩm Limio** (giới thiệu, thuyết phục), nhưng vẫn nghiêm túc, chính xác, không bịa số liệu/kết quả/thị phần/doanh thu. Tiêu đề nêu lợi ích và giá trị ("làm được gì cho người nghe"), giọng tự tin nhưng dựa trên sự thật trong FACT SHEET. Chỉ nhắc "mới ra mắt / chưa công bố kết quả hiệu quả" khi thật sự cần, diễn đạt tích cực (ví dụ "đang thử nghiệm tại…").
- **Bộ slide thay đổi theo đối tượng người nghe**: lãnh đạo ĐH, giảng viên, sinh viên, nhà đầu tư, nhà khoa học. Mỗi slide chỉ nói với đối tượng của nó. Engine (do người khác sửa) tự lọc slide; bạn không cần xử lý. Tất cả slide của deck hiện đều dùng `tone-dark` (một nền xanh rừng thống nhất) — dùng `tone-dark`, KHÔNG dùng `tone-light`.
- Tốc độ chuyển động chậm, êm; các hình vector lặp vòng nên chậm (chu kỳ ≥ 6–10 giây).
- Trong notes: câu chuyển tiếp cuối nên chung chung (“Tiếp theo…”) vì thứ tự slide thay đổi theo đối tượng.

---
## QUY TẮC CHỮ CHO PHÒNG CHIẾU (bắt buộc, ưu tiên cao nhất)
Người dùng phản hồi: “hơi nhiều chữ, chữ hơi nhỏ, chiếu lên rất khó nhìn”. Root font đã tăng: 1rem ≈ 24px ở 1920×1080 (≈ 20px ở 1600×900). Khung nội dung còn **≈ 80rem rộng × 35rem cao** (trước là 42rem).
- **Cỡ chữ tối thiểu: 0,95rem cho mọi chữ** (kể cả nhãn, chú thích, chữ trong SVG — trong SVG dùng font-size ≥ 0,95rem tương đương). Chữ nội dung chính ≥ 1,15rem; mô tả ngắn ≥ 1,05rem; tiêu đề `.h2` ≥ 2,3rem. KHÔNG dùng cỡ < 0,95rem ở đâu cả.
- **Cắt chữ mạnh tay**: mỗi slide tối đa ~35 từ nội dung (không tính nhãn nút/tab và tên riêng); tiêu đề ≤ 12 từ; mỗi gạch đầu dòng/thẻ ≤ 8 từ; tối đa 3–4 thẻ/mục; bỏ câu mô tả phụ, bỏ chú thích dài, bỏ chip trùng ý. Ý chi tiết **chuyển vào `<aside class="notes">`** (người trình bày nói, không in lên màn hình). Giữ nguyên sự thật, không bịa.
- Dùng hình, số lớn, icon, hoạt cảnh để truyền ý thay cho chữ. Nội dung quan trọng phải đọc được từ cuối phòng.
- Phóng to hình/ảnh/diagram để lấp phần chữ vừa cắt; vẫn nằm trong 35rem chiều cao ở 1920×1080.
- Giữ nguyên tương tác, hiệu ứng, nhưng KHÔNG thêm hiệu ứng nặng (hiệu năng: chỉ animate transform/opacity, không filter/blur lớn, không nhiều vòng lặp vô hạn cùng lúc).
- Chỉ trang trí nền: luôn mờ, nằm dưới chữ; thẻ chứa chữ có nền đặc (var(--card)), không để hình trang trí xuyên qua chữ.

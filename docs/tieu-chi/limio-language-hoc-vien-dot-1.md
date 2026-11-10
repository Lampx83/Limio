# Limio Language — giao diện học viên, đợt 1 (vỏ + "Lộ trình của tôi") — Acceptance criteria

> Bản nháp 09/11/2026, **đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Thiết kế: Figma "Limio Language" (frame "Tổng quan lộ trình học"). Gắn với LANG (docs/LANG-languages-AC.md), B4 (lộ trình), A3 (ghi danh), CENTER C6 (mục tiêu); ID chính thức đối chiếu spec khi commit.

> **Cập nhật 10/11/2026 — đã được thay một phần bởi `docs/tieu-chi/limio-language-gop-menu.md`:** "vỏ" Language bằng cookie, menu riêng (`LanguageLeftMenu`), nút "Về Limio" và trang "Lộ trình của tôi" **đã bỏ** (trùng với học viên Limio thường). Học viên dùng một menu duy nhất; khung bài học Language bật theo khoá. Phần còn lại của tài liệu này giữ làm lịch sử.

## Vì sao làm

Giao diện ngoại ngữ cho học viên theo Figma gồm: tab **Học / Luyện đề**, menu "Không gian học", trang **Lộ trình của tôi** (tiếp tục học, lộ trình theo Unit, mục tiêu, tiến độ theo kỹ năng, nhắc ôn). Mã vỏ Limio Language đã từng vào main (PR #94) rồi bị revert cùng cả gói ops; lần này lấy lại **chỉ phần vỏ**, và dựng trang Lộ trình trên dữ liệu đã có.

## Phạm vi

- **Có (đợt 1):** vỏ Limio Language cho học viên (cookie `limio_app`, tên miền riêng tuỳ chọn), menu theo Figma, trang `/language` của học viên, lối "Sang Limio Language".
- **Lấy lại từ commit `85e0f3a1` đúng các phần vỏ:** `appMode`, route `/api/app-mode`, đoạn trong `middleware.ts`, `language/layout.tsx`, `LanguageLeftMenu`, `languageMenu`, `PageFrame`, phần đổi nhỏ ở `AppHeader`/`HeaderTagline`/`StudentMenuTrigger`/`me/layout`/`learn/[slug]/layout`.
- **Không lấy lại:** khoá luyện đề `practice_bank`, `ExamCollection`, trường phân loại đề, thư viện đề, nhập manifest, tách luồng đề ở trang giảng viên (L4–L6) và **migration `20261006100000_practice_bank`**. Đợt 1 **không đổi schema, không có migration.**
- **Không lấy lại:** ghi đè màu teal ở `globals.css`/`tailwind.config.ts`. Figma dùng xanh lá chanh của thương hiệu; không đổi bảng màu.
- **Không làm ở đợt 1:** Thư viện giáo trình, "Lưu", Preview, bài đọc chia đôi, Lịch ôn tập, điểm ngữ pháp, "Dự kiến đạt", vỏ giảng viên, thanh toán (dùng nguyên đường hiện có).
- **Không đổi:** URL, quyền, dữ liệu của mọi trang hiện có. Cookie chỉ đổi vỏ, không cấp quyền.

## AC1 — Chế độ ứng dụng (vỏ)

- **Given** người dùng đã đăng nhập, **When** vào `/language` hoặc bấm "Sang Limio Language", **Then** đặt cookie `limio_app=language` và thấy vỏ Language; mở một khoá ngoại ngữ từ vỏ thường **không** tự đổi vỏ.
- **Given** biến `LANGUAGE_HOST` được đặt, **When** vào đúng tên miền đó, **Then** luôn ở vỏ Language và `/` được viết lại thành `/language`. Không đặt biến thì không bao giờ khớp.
- **Given** route `/api/app-mode?to=…&next=…`, **Then** `next` chỉ nhận đường dẫn nội bộ (chặn `//host`, `\`, scheme, ký tự điều khiển, `%0d/%0a/%5c`); sai thì về trang mặc định. Có test như bản cũ.
- **Given** người chưa có khoá ngoại ngữ nào (không giảng dạy, không ghi danh), **Then** vỏ thường **không** hiện lối "Sang Limio Language"; vào thẳng `/language` vẫn được.
- **Given** chưa đăng nhập, **When** vào `/language`, **Then** thấy trang giới thiệu (index được), không có menu; mọi trang theo người dùng đặt `noindex`.
- Vỏ Language **không** làm đổi thứ gì ở người không dùng nó: không cookie thì mọi trang giống hệt hôm nay (test hồi quy `AppHeader`, `learn/[slug]/layout`).

## AC2 — Menu và tab (Figma)

- Menu học viên theo nhóm "Không gian học": **Lộ trình của tôi** (`/language`), **Đã lưu & ghi chú** (`/me/notes`).
- **Thư viện giáo trình** và **Lịch ôn tập** chưa có trang ở đợt 1 (`/me/reviews` là hàng đợi chấm chéo của giải đấu, không phải lịch ôn): hai mục này **không hiện**, không để mục chết. Việc ôn trước mắt đi qua thẻ "Đến lúc ôn lại" ở AC3.
- Tab đầu trang: **Học** (`/language`) và **Luyện đề**. Học viên chưa có trang liệt kê đề riêng; tab Luyện đề trỏ tới mục "Luyện thi" trong trang khoá đang chọn (`/learn/<slug>`, nơi đã liệt kê đề thi thử đã xuất bản). Khoá không có đề thì tab ẩn.
- Mục sáng đúng theo đường dẫn hiện tại (`/language` chỉ sáng ở đúng trang chủ).
- **Responsive (§4.6):** dưới `lg` menu thành drawer, không dùng sidebar `md:`; hero và thẻ xếp một cột; không cuộn ngang ở 375px.
- Vai giảng viên/admin vào `/language` ở đợt 1 **được chuyển sang trang chủ giảng viên** (chưa dựng vỏ giảng viên).

## AC3 — Trang "Lộ trình của tôi"

**Chọn khoá.** Học viên có nhiều khoá `languageMode` thì có ô chọn khoá ở đầu trang (`?course=<slug>`); mặc định là khoá có `lastLessonId` gần nhất, nếu chưa có thì khoá ghi danh mới nhất. Chỉ liệt kê khoá mình ghi danh `active`. Slug của khoá không phải của mình bị bỏ qua (không lộ khoá khác).

- **Given** học viên chưa ghi danh khoá `languageMode` nào, **Then** hiện `<EmptyState>` "Bạn chưa học khoá ngoại ngữ nào" kèm nút tới catalog; không lỗi.
- **Tiếp tục học.** **Given** khoá có bài đã mở, **Then** thẻ hero hiện tên bài, tên Unit (module) chứa nó và nút "Tiếp tục bài học" tới `/learn/<slug>/lessons/<id>`. Bài lấy theo `lastLessonId` nếu bài đó còn hiển thị; nếu không thì bài chưa hoàn thành đầu tiên theo thứ tự. **Số phút chỉ hiện khi bài có sẵn số phút**, không ước đại.
- **Lộ trình giáo trình.** Mỗi Unit một dòng: tên, "x / y bài", trạng thái **Hoàn thành / Đang học / Chưa học** (x=y; 0<x<y; x=0), thanh tiến độ. Chỉ tính bài hiển thị cho học viên (không tính `isHidden`, `teacher_note`). Hiện 5 Unit đầu; còn nữa thì có "Xem tất cả n unit" tới trang khoá. Unit đang học được tô nổi.
- **Tiến độ theo kỹ năng.** Mỗi kỹ năng (Đọc, Nghe, Nói, Viết) = số bài **đã hoàn thành** có `languageSkill` đó / tổng bài có `languageSkill` đó trong khoá, làm tròn %. Kỹ năng khoá không có bài nào thì **ẩn**. Bài chưa gắn kỹ năng không được tính. Dòng chú thích cố định: "Dựa trên bài học đã hoàn thành".
- **Tiến độ này không phải mức nắm vững:** không đọc `LearnerSkillState`, không có điểm mastery trong HTML, JSON hay API (§5.4). Nhãn Cần ôn/Nên luyện/Vững vẫn chỉ ở "Hồ sơ kỹ năng" như hiện nay.
- **Mục tiêu.** **Given** học viên có `LearnerGoal` đang `active` cho khoá, **Then** thẻ hiện khung + mức mục tiêu (vd "6.5 IELTS Academic"), hạn mục tiêu và giờ/tuần nếu có, cùng % bài đã hoàn thành của khoá. **Chưa có mục tiêu thì ẩn thẻ.** Không hiện "Dự kiến đạt" (cần mô hình dự báo, chưa có).
- **Đến lúc ôn lại.** **Given** `getFlashcardStats(...).dueToday > 0`, **Then** thẻ hiện "n từ vựng" và nút tới `/learn/<slug>/flashcards`. Bằng 0 thì thẻ hiện "Hôm nay không có thẻ nào đến hạn". Không hiện "điểm ngữ pháp".
- **Sẵn sàng vận dụng?** Thẻ có liên kết "Luyện đề" cùng đích với tab Luyện đề.
- Trang không ghi gì vào DB và không phát `LearningEvent`: xem trang là đọc, đổi vỏ là tuỳ chọn giao diện, không phải hành vi học (§5.1 chỉ áp cho thay đổi trạng thái).

## AC4 — Dữ liệu và quyền

- Mọi số liệu chỉ của **chính người xem** (ghi danh `active` của họ); không có tham số nào cho phép xem người khác.
- Hàm tổng hợp nằm ở `core-lms/language` (đọc Prisma, không import `core-feedback`); phần gọi flashcard và mục tiêu ghép ở tầng `apps/web` (đúng ranh giới §4.3).
- Một lần tải trang dùng số truy vấn **cố định** theo số khoá/Unit (không N+1 theo bài); có test đếm truy vấn hoặc test cấu trúc nếu dự án đã có tiền lệ.
- Trang `noindex`; không đưa tên hay email học viên khác vào dữ liệu trả về.

## AC5 — Kiểm thử và xong

- Test đơn vị cho hàm tổng hợp (Unit trạng thái, tiến độ theo kỹ năng, khoá rỗng, bài ẩn, khoá của người khác), test `languageMenu`, test `appMode` và route `app-mode` (lấy lại từ bản cũ, bổ sung ca chặn redirect).
- `pnpm typecheck` và toàn bộ test sạch; **`teacherAssistantFreshness.test.ts` vẫn xanh** (đợt 1 không đổi giao diện giảng viên nên không sửa `GIAO-DIEN.md`/Lily; nếu test đỏ thì sửa hướng dẫn, không nới test).
- Xem bằng mắt trên dev ở 375px và 1280px, so với frame Figma; ghi rõ chỗ khác.
- Không commit, không push khi chưa được thầy bảo.

## Cần thầy chốt (mặc định đề xuất in đậm)

1. Giảng viên vào `/language` ở đợt 1: **chuyển sang trang chủ giảng viên** (vỏ giảng viên để đợt sau) hay dựng luôn menu giảng viên như bản cũ?
2. Học viên chưa có mục tiêu: **ẩn thẻ Mục tiêu** hay hiện nút "Đặt mục tiêu"? (Trang `/me/muc-tieu` hiện chỉ mở cho học viên thuộc lớp trung tâm; mở cho mọi người là đổi hành vi CENTER C6.3.)
3. Tab **Luyện đề** ở đợt 1 trỏ tới mục "Luyện thi" trong trang khoá (chưa có thư viện đề), **hay** ẩn hẳn tab đến khi có thư viện?
4. Nhãn ô chọn khoá: **tên khoá** (Figma ghi "Tiếng Anh · IELTS", cần thêm khái niệm chương trình nếu muốn đúng như vậy).

## Đã làm (09/11/2026, chưa commit)

- **Vỏ:** `lib/appMode.ts` (+`.server`), `app/api/app-mode`, đoạn đầu `middleware.ts`, `app/language/layout.tsx`, `LanguageLeftMenu`, `lib/languageMenu.ts`, `HeaderTagline`/`AppHeader`/`StudentMenuTrigger`, layout của `/me` và `/learn/[slug]`. Mọi nhánh mới chỉ chạy khi cookie `limio_app=language` **và** người xem đang ở vai học viên; không cookie thì giống hệt trước.
- **Dữ liệu:** `core-lms/language/overview.ts` — `getLanguageLearnerPath` (dùng lại `getCourseProgress` nên số "x / y bài" khớp trang khoá), hàm thuần `buildLanguagePath`, `learnerHasLanguageCourses`. Không schema, không migration.
- **Giao diện:** `components/language/LearnerPath.tsx` + `app/language/page.tsx`. Mục "Luyện thi" trong trang khoá được thêm `id="luyen-thi"` để tab Luyện đề trỏ tới.
- **Kiểm thử:** web 207 file / 2460 test xanh, core-lms test `language` xanh, `tsc` sạch ở cả hai gói, `teacherAssistantFreshness` xanh. Xem trên dev ở 375px và desktop: không tràn ngang, menu trượt chạy, "Về Limio" trả về vỏ thường.
- **Chỉnh khi làm:** thẻ "Language" ở header chỉ hiện từ `sm` (hiện ở 375px làm header tràn 34px); khoá chỉ tính khi đã `published`; màu dùng lime thương hiệu, không dùng teal.
- **Chưa xem bằng mắt:** thẻ Mục tiêu, thẻ "Đến lúc ôn lại" có thẻ đến hạn, ô chọn khoá (từ 2 khoá), tab Luyện đề khi khoá có đề — dữ liệu dev chưa có đủ; đã có test render.
- **Lưu ý khi commit:** `packages/core-lms/src/index.ts` đang có thay đổi của việc khác trong cùng file (đợt nghiên cứu B12/B16); phần của đợt 1 chỉ là một dòng `export * from "./language/index"`.

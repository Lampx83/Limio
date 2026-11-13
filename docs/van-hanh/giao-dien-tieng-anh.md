# Giao diện tiếng Anh (i18n giao diện)

## Cách hoạt động
- Hai ngôn ngữ giao diện: `vi` (mặc định, chuỗi gốc) và `en`. Chuỗi chưa dịch sang `en` **rơi về tiếng Việt**, không bao giờ hiện khoá thô.
- Chọn ngôn ngữ (`lib/i18n/core.ts`, `resolveUiLang`): cookie `fbm-lang` (nút **EN | VI** ở header) thắng; không có thì theo `course.language` của khoá đang xem (`/catalog/<slug>`, `/learn/<slug>/…`; middleware gắn header `x-course-slug`); còn lại là `vi`.
- Server: `const t = await getT()` (`lib/i18n/server.ts`). Client: `const t = useT()` (`lib/i18n/client.tsx`, `I18nProvider` đặt ở layout gốc). Component thuần đồng bộ: nhận prop `lang` + `tFor(lang)`.
- Từ điển theo vùng: `lib/i18n/dict/{vi,en}/<vùng>.ts` (common, header, catalog, learn, ai, practice, auth, reader), trải trong `dict/index.ts`. Chuỗi `vi` là nguồn và phải giống hệt chữ đang hiển thị.
- Test: `lib/i18n/core.test.ts`, `dict/practice.test.ts` (en không có khoá ma, giữ đúng tham số `{x}`).
- Trang `/s/*`, `/micro4asia` giữ cơ chế `?lang=` riêng của Space; header ẩn nút EN | VI ở đó.

## Thêm vùng/chuỗi mới
Thêm khoá vào `dict/vi/<vùng>.ts` (chữ gốc) và `dict/en/<vùng>.ts`; dùng `t("vùng.khoá", { n })`. Vùng mới: tạo hai file rồi đăng ký trong `dict/index.ts`.

## Chưa dịch
- Khu giảng viên/quản trị, `/me/*` (trừ ghi chú và menu), `/me/settings`, trang chủ và landing, bảng xếp hạng, đấu trường, `xp-guide`.
- Thi: `learn/[slug]/exams/**` (phòng thi, kết quả), `/exam`, `/thi`, vấn đáp.
- Chứng nhận (thân + PDF), huy hiệu/nhiệm vụ lưu trong DB, `<title>`/metadata của các trang học.
- `components/assistant/*` (trợ lý Lily cho giảng viên), `LessonLookMenu`, `VersionHistory`, `TeacherBar`.
- Ngày giờ: `lib/datetime.ts` cố định `vi-VN`; `formatPrice` VND; `gapText` (`lib/courseHomeView.ts`) ở các nơi gọi cũ.
- Thông báo lỗi do API trả thẳng bằng tiếng Việt (vd. `/api/auth/register`).
- `NarrationPlayer`: regex dò chữ trong nội dung bài ("N phút", "mục tiêu bài học") chưa nhận diện bản tiếng Anh nên highlight theo bài giảng có thể lệch ở khoá en.

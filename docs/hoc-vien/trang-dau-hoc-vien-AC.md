# Trang đầu cho học viên chưa có khoá — Acceptance criteria

> Bước 2 trong phương án chăm sóc học viên lần đầu. Trạng thái: **4 điểm đã chốt 23/10/2026; đã code trên nhánh feat/hoc-vien-trang-bat-dau, đã thử trên trình duyệt.**

## Vì sao làm

Số đo prod ngày 23/10/2026 (`docs/hoc-vien/do-hoc-vien-prod.sql`):

- Từ 12/10 có 59 học viên mới. 47 người (80%) **đã đăng nhập nhưng chưa vào lớp, chưa thi, chưa chơi gì**, và chỉ 19% có hoạt động học.
- Ngược lại, học viên có lớp để vào thì học ngay: 97% học viên đến qua link mời có hoạt động, 258/291 người bắt đầu học trong giờ đầu tiên.

Như vậy học viên tự vào không thiếu ý muốn học. Họ thiếu **một việc cụ thể để làm** ngay khi mở trang. Trang tổng quan hiện tại cho người chưa có khoá chỉ có một dòng "Bạn chưa ghi danh khoá học nào", bốn ô số 0, các thẻ trống, và phần hướng dẫn 15 bước giới thiệu những mục menu đang trống.

## Phạm vi

- **Áp dụng cho:** học viên đang ở vai học viên trên `/me/dashboard` mà **chưa có ghi danh nào còn hiệu lực**.
- **Không áp dụng cho:**
  - học viên đã có ít nhất một khoá: giữ nguyên trang tổng quan hiện tại;
  - trang giảng viên;
  - vỏ Limio Language.

## AC1 — Trang "Bắt đầu" thay cho trang tổng quan trống

- **Given** học viên chưa có ghi danh nào, **When** mở `/me/dashboard`, **Then** thấy trang "Bắt đầu" gồm theo thứ tự:
  1. Lời chào theo tên.
  2. Ô nhập mã (AC2).
  3. Phần "Thử học ngay" (AC3).
  4. Phần "Khoá đang mở" (AC4).
- **Given** như trên, **Then** **không** hiện:
  - bốn ô số liệu (Khoá đã đăng ký, Bài đã hoàn thành, Chủ đề vững, Huy hiệu);
  - thẻ "Huy hiệu gần đây", "Chủ đề cần ôn";
  - lịch, danh sách việc cần làm;
  - bảng xếp hạng tuần.
- **Given** học viên ghi danh xong khoá đầu tiên, **When** quay lại `/me/dashboard`, **Then** thấy trang tổng quan đầy đủ như hiện nay.
- **Given** màn hình điện thoại (< 640 px), **Then**:
  - các phần xếp thành một cột;
  - ô nhập mã nằm ngay dưới lời chào, không phải cuộn mới thấy;
  - không có thanh cuộn ngang.

## AC2 — Một ô nhập mã cho mọi loại mã (đã chốt: nhận mọi loại)

Học viên thường chỉ được thầy cô đọc hoặc gửi một dãy ký tự, và không biết đó là mã gì. Vì vậy ô nhập mã tự nhận ra loại mã.

- **Given** học viên gõ mã có chữ thường, dấu cách hoặc dấu gạch, **Then** hệ thống chuẩn hoá thành chữ in hoa, chỉ giữ chữ và số, giống cách trang `/thi` và ô mã kích hoạt khoá đang làm.
- **Given** mã dài **12 ký tự**, **When** bấm "Vào", **Then** hệ thống đổi như mã kích hoạt khoá (`/api/redeem-code`). Thành công thì vào thẳng khoá vừa mở.
- **Given** mã dài **8 ký tự**, **Then** chuyển tới `/exam/<mã>` (mã thí sinh được giao).
- **Given** mã dài **6 ký tự**, **Then** hệ thống tra lần lượt các loại mã sau, chỉ trong những mã đang dùng được:

  | Loại mã | Đích chuyển tới |
  |---|---|
  | Mã mời vào lớp | `/enroll/<mã>` |
  | Mã thi tự do | `/exam/<mã>` |
  | Mã vấn đáp | `/oral/<mã>` |
  | Mã trò chơi | `/play/<mã>` |
  | Mã bài giảng trực tiếp (cả mã từng slide) | `/learn/live/<mã>` |
  | Mã bảng ý tưởng | `/join/<mã>` |
  | Mã bảng trắng | `/whiteboard/<mã>` |

  - Khớp **đúng một** loại: chuyển thẳng tới đích.
  - Khớp **nhiều hơn một** loại: hiện danh sách để chọn, mỗi dòng ghi loại và tên (vd "Lớp K65-CS1 — Đại số cơ bản", "Trò chơi: Ôn tập chương 2").
- **Given** mã không khớp loại nào, hoặc độ dài không phải 6/8/12, **Then**:
  - báo ngay dưới ô: "Không tìm thấy mã này. Hãy kiểm tra lại với thầy cô — mã gồm chữ in hoa và số, không có chữ O, I, L.";
  - không xoá chữ học viên vừa gõ.
- **Given** mã đã hết hạn hoặc phiên đã kết thúc (trò chơi đã xong, ca thi đã đóng), **Then** báo đúng tình trạng đó, không báo "không tìm thấy".
- **Given** một người thử mã liên tục, **Then** tra mã bị giới hạn tần suất giống `/api/redeem-code`: 20 lần mỗi 10 phút theo IP, 10 lần theo tài khoản.
- **Then** API tra mã trả về **loại mã và đích chuyển tới**, kèm tên khi cần cho danh sách chọn. API không trả về thông tin nội bộ của lớp, đề thi hay phiên.

## AC3 — "Thử học ngay": một bài học mẫu ngắn

- **Given** quản trị bật công tắc mới **"Khoá mẫu cho học viên"** cho một khoá (đã chốt). Công tắc này tách riêng với "khoá mẫu cho giảng viên" đang có, và chỉ bật được khi khoá đã xuất bản và cho ghi danh miễn phí. **Then** trang Bắt đầu hiện một thẻ gồm:
  - tên khoá, tên bài đầu tiên, thời lượng ước tính;
  - nút "Học thử".
- **Given** có nhiều khoá bật công tắc, **Then** chỉ hiện khoá được bật gần nhất.
- **When** học viên bấm "Học thử", **Then** hệ thống ghi danh miễn phí vào khoá đó (phát `enrollment.created` như mọi lần ghi danh) rồi mở bài đầu tiên. Ghi danh thật là để học viên làm được bài kiểm tra, có tiến độ, có phản hồi. Từ lúc đó học viên đã có khoá, nên lần sau mở trang tổng quan sẽ thấy trang đầy đủ. Bài phải có bài kiểm tra ngắn và phản hồi sau khi nộp, để học viên thấy điểm khác biệt của Limio ngay lần đầu.
- **Given** chưa chọn khoá mẫu nào, **Then** ẩn hẳn phần này. Không hiện thẻ trống.

## AC4 — "Khoá đang mở"

- **Then** hiện tối đa 3 khoá đầu tiên của **mục đầu tiên trong Danh mục khoá học** mà quản trị đã sắp (mục chọn tay hoặc mục "mới nhất"), bỏ khoá mẫu đã hiện ở AC3 (đã chốt). Danh mục chưa có mục nào thì lấy 3 khoá xuất bản gần nhất, giống cách Danh mục đang làm. Mỗi thẻ có tên, trình độ, số bài và nút "Xem khoá" dẫn tới `/catalog/<slug>`.
- **Then** cuối phần có liên kết "Xem tất cả trong Danh mục khoá học →".
- **Given** Danh mục không có khoá nào đã xuất bản, **Then** ẩn phần này.

## AC5 — Hướng dẫn lần đầu

- **Given** học viên chưa có khoá, **Then** **không tự mở** phần hướng dẫn 15 bước, vì hầu hết các mục nó giới thiệu đang trống (đã chốt).
- **Given** học viên có khoá đầu tiên, **When** lần đầu mở trang tổng quan đầy đủ, **Then** phần hướng dẫn tự mở như hiện nay, nếu học viên chưa từng xem.
- `?tour=1` từ trang Cài đặt vẫn mở được hướng dẫn bất cứ lúc nào.

## AC6 — Ghi sự kiện để đo

- **When** học viên nhập mã, **Then** ghi `LearningEvent` loại `onboarding.code.submitted`. Payload gồm:
  - độ dài mã;
  - loại khớp: `section`, `exam`, `oral`, `gameshow`, `live`, `board`, `whiteboard`, `access_code`, `none` hoặc `ambiguous`;
  - **không** ghi chính mã.
- **When** học viên bấm "Học thử" hoặc "Xem khoá" trên trang Bắt đầu, **Then** ghi `onboarding.start.clicked` với `{ target: "sample" | "catalog_course" | "catalog_all", courseId? }`.
- Ghi sự kiện **không được chặn hay làm chậm** việc chuyển trang, theo cùng nguyên tắc với `RemediationLink`.
- **Thước đo thành công:** chạy lại `do-hoc-vien-prod.sql` sau 2 tuần. Tỷ lệ học viên mới "chưa vào đâu" phải giảm từ 80% xuống dưới 40%, và tỷ lệ có hoạt động học phải tăng từ 19% lên trên 50%.

## Ngoài phạm vi lần này

- Nút "Góp ý" và thư chào khi đăng ký: thuộc bước 3.
- Ô nhập mã ở trang chủ công khai cho người chưa đăng nhập.
- Gợi ý khoá theo sở thích, hoặc hỏi học viên muốn học gì.
- Đổi cách `/thi`, `/oral` và các trang mã riêng đang chạy; chúng giữ nguyên.

## Đã chốt (23/10/2026)

1. Bài học mẫu: dùng công tắc mới "Khoá mẫu cho học viên" do quản trị bật, tách khỏi khoá mẫu cho giảng viên.
2. "Khoá đang mở": lấy theo mục đầu tiên trong Danh mục khoá học do quản trị sắp.
3. Phần hướng dẫn 15 bước: hoãn tới khi học viên có khoá đầu tiên.
4. Ô nhập mã: nhận mọi loại mã; mã trùng giữa các loại thì cho học viên chọn.

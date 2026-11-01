# Khoá "Toán 10 — slide tương tác cùng giảng viên ảo"

Khoá bán do Limio soạn, theo Chương trình GDPT 2018 lớp 10. Đây **không** phải khoá ôn thi vào lớp 10: bốn trong năm bài là kiến thức lớp 10. Phần thi vào lớp 10 nằm ở khoá `on-thi-vao-10-toan-mau`.

| Bài | Bộ slide | Quiz |
|---|---|---|
| Hàm số bậc hai và đồ thị | `apps/web/src/content/decks/ham-bac-hai.json` | `quiz/ham-bac-hai.json` |
| Ba đường conic | `.../decks/conic.json` | `quiz/conic.json` |
| Hệ thức lượng trong tam giác | `.../decks/tam-giac.json` | `quiz/tam-giac.json` |
| Hệ bất phương trình bậc nhất hai ẩn và tối ưu | `.../decks/toi-uu.json` | `quiz/toi-uu.json` |
| Xác suất cổ điển | `.../decks/xac-suat.json` | `quiz/xac-suat.json` |

## Quy ước soạn quiz

- Mỗi bài 10 câu, 12 điểm: 3 Nhận biết, 5 Thông hiểu, 2 Vận dụng. Không bắt chọn độ tự tin.
- Không dùng lại hàm số và số liệu đã có trong slide, để quiz đo được việc học sinh tự làm.
- Phương án sai gắn mã lỗi tư duy `t10.<bài>.*` khi nó ứng với một lỗi cụ thể. Mỗi mã có một mẫu phản hồi.
- Thuật ngữ và kí hiệu theo đúng slide của bài (`bề lõm`, `đỉnh I`, `n(Ω)`, góc bù…).

## Dựng và nhập

`khoa-toan-10-slide.json` là tệp sinh ra, đừng sửa tay.

```bash
cd apps/web && pnpm exec tsx scripts/build-deck-course.ts ../../docs/hoc-lieu/toan-10-slide-tuong-tac/khoa-toan-10-slide.json
```

Khoá mới: `pnpm import:course -- --file <tệp> --owner <email> --dry-run`. Khoá đã có: chạy `update-lesson.ts` cho từng bài, luôn `--dry-run` trước, ví dụ:

```bash
pnpm --filter @feedbackme/core-lms update:lesson -- --file ../../docs/hoc-lieu/toan-10-slide-tuong-tac/khoa-toan-10-slide.json --owner <email> --lesson "Ba đường conic" --dry-run
```

Khi chạy trên bài đã nhập theo script cũ, khối giới thiệu đầu bài được thay bằng dòng thời lượng và số câu. Script không xoá gì khác. Quiz đã có lượt làm thì không đổi câu hỏi nếu không truyền `--force`.

## Đã kiểm (01/11/2026, máy dev)

- Mọi đáp án và nguồn gốc các phương án nhiễu được tính lại độc lập bằng chương trình; mọi công thức dựng được bằng KaTeX.
- Làm trọn một lượt quiz bài Hàm số bậc hai: chấm điểm, phản hồi theo lỗi tư duy và công thức trong phản hồi đều đúng.
- Chưa làm trọn lượt của 4 quiz còn lại; chưa duyệt chuyên môn bởi giáo viên Toán.

# Khoá "Ôn thi Toán vào 10" theo đề Hà Nội

Tiêu chí và tiến độ: `docs/tieu-chi/on-thi-toan-vao-10-ha-noi.md`. Khoá gồm module **Bắt đầu**, module **Luyện theo dạng** (mỗi dạng một bài, xếp theo câu của đề), các module **Giải đề mẫu** theo năm (mỗi đề một bài: khung slide ở đầu, lời giải đọc lại ở dưới), và đề mô phỏng ở mục Luyện thi của trang khoá.

| Bài | Nguồn | Bộ slide |
|---|---|---|
| Câu II: Tìm x để biểu thức nguyên | `src/dang_bieu_thuc_nguyen.py` | `dang-bieu-thuc-nguyen` |
| Đề Hà Nội năm 2026 | `src/de_hanoi_2026.py`, `src/deck_hanoi_2026.py` | `de-ha-noi-2026` |

Khoá đang ở máy dev, bản nháp, chưa lên server thật. Bài `dang_bieu_thuc_nguyen.py` là khuôn để soạn các dạng còn lại. Các câu luyện chờ chuyển vào bài dạng nằm ở `CAU_CHO_CAC_DANG` trong `de_hanoi_2026.py`.

## Khuôn bài slide

- Bộ slide là tệp `apps/web/src/content/decks/<id>.json`, sinh từ `src/deck_<tỉnh>_<năm>.py`. Vì nằm trong mã nguồn, slide mới chỉ lên server sau khi commit và deploy.
- Mỗi câu của đề: một slide tự làm có chấm ngay (`nhap-dap-an`, `trac-nghiem`, `sap-xep`, `tim-loi`, `dungCuoi: true` để giọng dừng chờ), rồi một slide lời giải hiện từng bước. Đáp án nhiễu trong `loi-sai` phải là kết quả thật của lỗi được mô tả (`kiem_so_deck()`).
- Hình học dùng thành phần `.hinh-dung` (`khungToanMoRong.js`): khai báo cách dựng từng điểm theo đề, kéo được, đo được độ dài. Mô tả dữ liệu ở đầu tệp đó, kiểm thử ở `khungHinhDung.test.ts`.
- **Nhịp cho học sinh làm:** giọng chỉ thực sự dừng ở cuối slide có `dungCuoi: true`, và dừng cho tới khi học sinh bấm Tiếp tục. Dấu `[nghĩ n: …]` bị bỏ khi tạo giọng nên **không** tạo khoảng dừng. Vì vậy mọi lời giao việc hay câu hỏi phải nằm ở bước cuối của một slide chờ; `kiem_kich_ban()` dừng bản dựng nếu sai. Bài hình tách thành slide tự làm rồi slide lời giải, và không để lộ đáp án trên hình của slide tự làm.
- **Vẽ hình theo lời giảng:** trong `hinh(lop(...), lop(...))`, lớp thứ k hiện ở bước k của lời giảng, nét mới được vẽ ra. Lời giảng nói tới nét nào thì nét đó mới xuất hiện.
- Số bước `loiGiang.buoc` phải bằng số phần hiện dần cộng một; `tao_deck()` dừng nếu lệch. Đề Hà Nội 2026 đã dùng đúng 60 đoạn, là mức tối đa mỗi bài.
- `/decks/<id>` được trình duyệt giữ 5 phút; khi xem lại sau khi sửa, thêm `?v=...` vào địa chỉ.
- Lời giảng chung một giới hạn: tối đa 60 đoạn, 40.000 ký tự mỗi bài.

## Khuôn phần lời giải đọc lại của đề mẫu

Mỗi ý là một mục `steps` có `reveal`, đề bài ở phần dẫn. Bước 1 luôn là "Tự làm ra giấy", vì trang học viên hiện sẵn bước đầu của mục; ý khó có gợi ý gập lại. Các bước sau là từng dòng lời giải kèm lý do, hình vẽ đặt trong bước để không lộ sớm. Phần này không có lời giảng riêng, vì lời giảng của bài theo slide. Tiêu đề mục không chứa công thức. Học viên được xưng "em".

## Nguồn và bản quyền

Đề bài được **diễn đạt lại ngắn gọn, giữ nguyên số liệu**; lời giải do Limio tự soạn; bài học dẫn liên kết tới ảnh đề gốc. Không chép nguyên văn đề, không dùng lại ảnh đề hay đáp án tham khảo đăng trên báo. Trước khi bán khoá cần kiểm tra quyền sử dụng đề thi với đơn vị ra đề.

## Thêm một dạng hoặc một đề

1. **Dạng mới:** chép `src/dang_bieu_thuc_nguyen.py` và thêm vào `CAC_DANG` trong `src/build.py`. **Đề mới:** chép `src/de_hanoi_2026.py`, `src/deck_hanoi_2026.py` và thêm vào `CAC_NAM`.
2. Viết `kiem_so()` tính lại mọi đáp số. Mã lỗi `giaide.*` dùng chung giữa các bài thì giữ nguyên mã.
3. Chạy theo thứ tự này, vì lời giảng sinh từ tệp slide:

```bash
python3 docs/hoc-lieu/on-thi-toan-vao-10/src/build.py --chi-deck
```

```bash
cd apps/web && pnpm exec tsx scripts/build-deck-lecture.ts <id> ../../docs/hoc-lieu/on-thi-toan-vao-10/src/loi-giang/<id>.json
```

```bash
python3 docs/hoc-lieu/on-thi-toan-vao-10/src/build.py
```

4. Nhập vào máy dev. `--replace` xoá khoá nháp rồi nhập lại, nên mất giọng đã tạo và chỉ dùng khi chưa có học viên. Khoá đã có học viên thì dùng `--into <courseId>` hoặc `update-lesson`:

```bash
pnpm import:course -- --file ../../docs/hoc-lieu/on-thi-toan-vao-10/khoa-on-thi-toan-vao-10.json --owner <email> --dry-run
```

Đề quiz không hiểu ký hiệu in đậm, nên đừng viết `**` trong `prompt`. Hình cho phần đọc lại do `make_figures.py <userId>` sinh và chép vào kho ảnh của máy đang chạy; trên server thật phải đặt hình vào kho tệp rồi mới nhập.

Giọng giả để thử trên máy dev phải tạo qua máy chủ có `NARRATION_FAKE_TTS=1`, gọi bằng tài khoản quản trị. Script chạy bằng `tsx` không mã hoá được MP3.

## Giới hạn đã biết

- Bảng thử 12 giá trị ở câu V phải cuộn ngang trên điện thoại, nên cột $x=25$ không hiện ngay.
- Lời giải câu IV.2c do Limio soạn, cần giáo viên Toán đọc lại.

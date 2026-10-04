# Bộ thẻ gom cụm · Bài 2.3

38 thẻ lấy từ phản hồi Thực hành 1 (ẩn danh), dựng sẵn để dán vào Whiteboard của Limio.

| File | Dùng để |
|---|---|
| `cards.json` | Dữ liệu gốc: nguyên văn, nguồn (mã chữ cái), loại, cụm đáp án |
| `build.mjs` | Dựng phần tử Excalidraw; đẩy vào bảng; ghi đáp án |
| `clipboard.json` | Nội dung dán được vào canvas (Ctrl+V) |
| `bo-the-in.pdf` | **Bản in giấy**: 2 trang thẻ (cắt theo nét đứt) + 1 phiếu nhóm A4. In mỗi nhóm một bộ. |
| `in-the-giay.mjs` | Dựng lại `bo-the-in.html` từ `cards.json`; in PDF bằng Chrome (xem đầu file) |
| `dap-an-giang-vien.md` | Đáp án và nguồn từng thẻ — **không phát cho học viên** |

## Cách nạp vào một bảng

Tạo bảng ở `/instructor/teaching-tools` → Whiteboard (mỗi nhóm một bảng), rồi chọn một trong hai:

```bash
# A. Đẩy thẳng qua API công khai (cần bảng đang mở)
node build.mjs --post https://limio.vn MÃ_BẢNG

# B. Dán tay: mở clipboard.json, copy toàn bộ nội dung, bấm vào canvas, Ctrl+V
```

Chạy lại `--post` lên cùng một bảng KHÔNG đặt lại thẻ về chỗ cũ (phần tử đã di chuyển có phiên bản cao hơn nên thắng). Muốn làm lại từ đầu thì dùng nút đặt lại của bảng.

Đã thử trên bản dev: chữ tiếng Việt hiện đúng, thẻ kéo được cùng chữ, vị trí mới được lưu lên máy chủ. Chưa thử trên prod, chưa thử Ctrl+V, chưa thử nhiều thiết bị cùng kéo một lúc.

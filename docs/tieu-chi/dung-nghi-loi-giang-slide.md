# Giọng dừng khi học sinh cần làm hoặc cần nghĩ — tiêu chí chấp nhận

> Bản 02/11/2026, đã duyệt theo hướng (c) và đã làm trên máy dev, chưa lên server. Áp dụng cho năm bộ slide của khoá Toán 10 (`conic`, `ham-bac-hai`, `tam-giac`, `toi-uu`, `xac-suat`).
> Không đụng `de-ha-noi-2026.json`: bộ này đã soạn theo quy tắc mới.

## Vấn đề

Lời giảng có 52 dấu `[nghĩ n: …]`, nhưng `cleanNarration` bỏ toàn bộ dấu đó khi tạo giọng, kể cả phần chữ sau dấu hai chấm. Có hai hậu quả:

1. **Không có khoảng dừng.** Giọng chỉ dừng thật ở cuối slide `dungCuoi`. Nhịp nghỉ giữa các đoạn chỉ 1,4 đến 3,5 giây.
2. **Học sinh không nghe câu hỏi.** Câu hỏi nằm trong dấu nên chưa từng được đọc và cũng không hiện ở đâu. Vài chỗ vì thế bị cụt lời:
   - `conic` slide 3: «Em xem hoạt cảnh bên trái nhé. Đúng rồi, tổng ấy luôn bằng độ dài sợi dây.» Chưa ai hỏi gì mà giọng đã nói «Đúng rồi».
   - `conic` slide 1: «…trên mái nhà chưa? Hôm nay em sẽ tự trả lời được câu đó.» «Câu đó» là câu hỏi đã bị bỏ.
   - `ham-bac-hai` slide 15: giọng giảng trường hợp a âm, nhưng không ai bảo học sinh bấm thẻ a < 0, nên trên màn hình vẫn là bảng a > 0.

Ngoài 29 chỗ đã đếm còn **8 chỗ không có dấu** mà giọng giao việc rồi đi tiếp ngay (mục «Tám chỗ không có dấu»).

## So sánh hướng xử lý

| | (a) Chỉ sửa kịch bản, câu hỏi về cuối slide chờ | (b) `[nghĩ n]` dừng đúng chỗ giữa đoạn | **(c) Đề xuất: dừng ở cuối bước** |
|---|---|---|---|
| Cách làm | Tách khoảng 9 slide vì câu hỏi nằm giữa slide | Trình phát dừng tại vị trí của dấu trong đoạn | Dấu chỉ được đặt ở cuối một bước. Trình phát đọc dấu từ bộ slide, giống cờ `dungCuoi` hiện nay |
| Anchor `s<i>b<b>` | Đổi hết các slide sau chỗ tách | Không có mốc giờ theo câu (phụ đề chỉ ước lượng, có thể cắt giữa chữ). Muốn chính xác phải tách đoạn: anchor trùng bị `LectureScript` từ chối, và thêm bước khi slide không có thêm phần hiện thì khung kẹp số bước nên có thể lệch vị trí | **Không đổi** |
| Giới hạn 60 đoạn | Không chạm | Nếu tách đoạn: `ham-bac-hai` 55 + 8 = 63, **vượt** | **Không chạm** |
| Tính đã nghe 80% | Không ảnh hưởng | Không ảnh hưởng nếu dừng trình phát; có ảnh hưởng nếu chèn khoảng lặng vào tệp giọng vì thời lượng dài ra và khoảng lặng được tính là đã nghe | **Không ảnh hưởng**: chỉ cộng khi giờ của giọng chạy tới, lúc dừng thì không tăng |
| Tạo lại giọng | **Cả 5 bài** | Cả 5 bài nếu tách đoạn | **2 bài**: `conic`, `ham-bac-hai` |
| Việc soạn | Sửa HTML khoảng 9 slide, số slide thay đổi | Đổi lược đồ kịch bản và trình phát | Sửa lời 9 đoạn, thêm một ít mã trình phát |

**Đề xuất (c).** Lý do: dừng ở cuối bước không đụng tới anchor, số đoạn hay tệp giọng. Chỉ những đoạn thật sự phải đổi lời mới kéo theo tạo lại giọng.

## Chi phí tạo lại giọng (hướng c)

| | Conic + Hàm số bậc hai | Cả 5 bài (để so sánh) |
|---|---|---|
| Lượng chữ đọc lại | 14.805 ký tự, khoảng 12 phút giọng (ước lượng theo tỉ lệ ký tự) | 31.356 ký tự, 1.519 giây giọng |
| GPU dựng lại video (nếu đã nạp video) | Khoảng 40 phút, ước lượng theo 3,3 giây GPU cho mỗi giây lời | 80–90 phút |

Những điều phải chấp nhận khi tạo lại giọng:

- Hệ thống đọc lại **cả bài**, dù chỉ đổi 4 hoặc 5 đoạn: tệp tạm của từng đoạn bị xoá sau mỗi lần tạo.
- Từ lúc lưu kịch bản mới tới khi tạo giọng xong, **học viên không nghe được bài đó** (`isLearnerVisible` chỉ cho nghe khi giọng khớp kịch bản). Màn hình bìa cũng biến mất trong lúc đó. Nên làm vào giờ thấp điểm.
- Video giảng viên cũ của bài bị xoá, học viên thấy ảnh tĩnh cho tới khi dựng và nạp lại (`docs/van-hanh/giang-vien-ao-video.md`).
- Phần «đã nghe» đang dở của học viên ở 2 bài này tính lại từ đầu. Bài đã hoàn thành thì vẫn giữ.
- `update-lesson.ts` chưa cập nhật lời giảng của bài đã có, nên phải thêm bước gọi `saveNarrationScript` vào script này.

**Chưa xác minh:**

- Đọc server 224 bị chặn, nên chưa biết khoá đã nạp video chưa và đang có bao nhiêu học viên.
- Chưa đo thời gian NEU TTS đọc một bài.
- Chưa biết NEU TTS đọc lại có ra đúng tệp cũ không. Nếu đúng, các clip Ditto đã có sẽ dùng lại được và GPU ít hơn nhiều so với 40 phút.

## Quy tắc soạn mới

- `[chờ: lời nhắc]` đặt **cuối một bước**: giọng dừng tới khi học sinh bấm Tiếp tục. Dùng khi học sinh phải **thao tác** (kéo, bấm, gieo).
- `[nghĩ n: câu hỏi]` đặt **cuối một bước**: giọng dừng n giây rồi tự đi tiếp. Dùng khi học sinh chỉ cần **suy nghĩ**.
- Chữ sau dấu hai chấm **hiện trên màn hình** trong lúc dừng. Nhờ vậy không cần tạo lại giọng chỉ để có câu hỏi.
- `dungCuoi` giữ nguyên ý nghĩa: dừng cuối slide. Slide này không cần thêm dấu ở bước cuối.
- Không dùng hai dấu này giữa bước. Phần chữ sau dấu trong cùng bước sẽ đọc ngay, nên dấu vô nghĩa. Test sẽ chặn.

## Xử lý từng chỗ

Số slide đếm từ 1 như học sinh thấy; bước đếm từ 0 như trong tệp. «Đổi lời» nghĩa là phải tạo lại giọng bài đó.

### Chờ bấm (5 chỗ)

| Bộ, slide, bước | Cách làm | Đổi lời? |
|---|---|---|
| `ham-bac-hai` 5, b2 | Chuyển lời giao việc về cuối b1 và dừng ở đó: «Em kéo a sang số âm, chẳng hạn âm một phần hai, xem parabol thế nào». b2 chỉ còn phần đáp | **Có**: b1, b2 |
| `ham-bac-hai` 11, b3 | Cuối b3: «Em kéo c bằng một xem sao», dừng. Câu «Với c bằng một…» chuyển sang đầu b4. Trong b4, «Em thử kéo c bằng hai» đổi thành «Với c bằng hai…» vì giọng không dừng ở đó | **Có**: b3, b4 |
| `ham-bac-hai` 15, b2 | Cuối b1: «Bây giờ em bấm thẻ a nhỏ hơn không», dừng. b2 giữ nguyên | **Có**: b1 |
| `xac-suat` 6, b2 | Dừng cuối b2, nhắc «Em thử gieo thật nhiều lần xem». Khi làm phải đối chiếu đúng nút có trên slide | Không |
| `xac-suat` 7, b3 | Bật `dungCuoi` vì đây là bước cuối và giọng đã nói «Em đếm thử» | Không |

### Nghĩ n giây (11 chỗ, giữ nguyên câu hỏi và số giây đang có)

| Bộ, slide, bước | Câu hỏi hiện trên màn hình | Đổi lời? |
|---|---|---|
| `conic` 2, b0 | Em thấy đường nào ở đâu quanh mình? | Không |
| `conic` 3, b0 | Tổng hai đoạn dây có thay đổi không? | **Có**: b0 đọc thành lời câu hỏi; bỏ «Đúng rồi» và chuyển câu «tổng ấy luôn bằng độ dài sợi dây» sang đầu b1 |
| `conic` 9, b4 | Nên đặt đầu thu ở đâu? | Không |
| `ham-bac-hai` 7, b0 | Em xác định a, b, c trước nhé | Không |
| `ham-bac-hai` 17, b0 | Rào thế nào để vườn rộng nhất? | Không |
| `tam-giac` 2, b0 | Tháp cao bao nhiêu mét? | Không |
| `tam-giac` 5, b0 | Đường chim bay từ nhà tới trường dài bao nhiêu? | Không |
| `toi-uu` 1, b0 | Em sẽ bắt đầu từ đâu? | Không |
| `toi-uu` 5, b0 | Có những giới hạn nào? | Không |
| `toi-uu` 6, b4 | Phần còn lại có hình gì? | Không |
| `xac-suat` 2, b0 | Ai dễ đoán đúng hơn? | Không |

### Bỏ dấu (13 chỗ)

Đây là câu dẫn dắt, hoặc đáp án đã được nói hay đã hiện trên slide lúc dấu xuất hiện, nên dừng không có ích.

| Bộ, slide, bước | Lý do | Đổi lời? |
|---|---|---|
| `conic` 1, b0 | Câu mở bài. Đọc thành lời «Vì sao chảo lại cong như thế?» để «câu đó» có nghĩa | **Có** |
| `conic` 6, b0 | Giữa bước, nối sang phần mở rộng. Đổi câu hỏi «có thấy… không?» thành câu kể vì giọng không dừng ở đó | **Có** |
| `ham-bac-hai` 1, b0 | Câu mở bài; giọng nói đáp ngay sau đó («Bóng vút lên…») | Không |
| `ham-bac-hai` 6, b4 | Giọng hỏi rồi đáp ngay; đáp án đã hiện khi vào bước | Không |
| `ham-bac-hai` 13, b3 | Bài mẫu; giao điểm đã hiện khi vào bước | Không |
| `tam-giac` 1, b0 | Câu mở bài | Không |
| `tam-giac` 3, b0 | Giọng vừa nói đáp án ngay trước dấu | Không |
| `tam-giac` 4, b2 | Câu sau dấu đã nói đúng ý đó | Không |
| `tam-giac` 10, b0 | Câu dẫn, đã đọc thành lời | Không |
| `toi-uu` 2, b2 | Giữa bước, đáp ngay sau đó | Không |
| `toi-uu` 4, b0 | Giữa bước; b1 đến b3 trả lời dần | Không |
| `xac-suat` 1, b0 | Câu mở bài | Không |
| `xac-suat` 5, b4 | Câu sau dấu đáp ngay | Không |

### Tám chỗ không có dấu mà giọng giao việc rồi đi tiếp

| Bộ, slide, bước | Lời hiện có | Cách làm |
|---|---|---|
| `conic` 4, b0 | Em thử kéo a và b… | `[chờ]` cuối b0 |
| `conic` 6, b1 | Giờ em trả lời câu hỏi nhỏ bên dưới nhé | Bật `dungCuoi` |
| `conic` 7, b0 | Em kéo thử a và b… | `[chờ]` cuối b0 |
| `tam-giac` 2, b3 | Em thử kéo điểm A, điểm B… | `[chờ]` cuối b3 |
| `tam-giac` 8, b3 | Em thử kéo điểm B… | Bật `dungCuoi` |
| `xac-suat` 2, b2 | Em thử bấm gieo mười lần… | Bật `dungCuoi` |
| `xac-suat` 6, b0 | Em chọn thẻ…, rồi bấm gieo | `[chờ]` cuối b0 |
| `xac-suat` 9, b0 | Em gieo hai xúc xắc một nghìn lần… | `[chờ]` cuối b0 (test phát hiện khi làm) |

Không đổi lời ở cả tám chỗ. Các câu giao bài về nhà ở slide cuối không cần dừng.

### 23 dấu còn lại trên slide `dungCuoi`

Bỏ hết. Slide đã có điểm dừng thật và các dấu này chưa từng được đọc, nên bỏ không đổi lời giảng.

## Tổng hợp theo bài

| Bài | Đoạn đổi lời | Tạo lại giọng? | Điểm dừng thêm |
|---|---|---|---|
| Ba đường conic | 4 | **Có** | 3 nghĩ, 2 chờ, 1 `dungCuoi` |
| Hàm số bậc hai | 5 | **Có** | 2 nghĩ, 3 chờ |
| Hệ thức lượng trong tam giác | 0 | Không | 2 nghĩ, 1 chờ, 1 `dungCuoi` |
| Tối ưu | 0 | Không | 3 nghĩ |
| Xác suất cổ điển | 0 | Không | 1 nghĩ, 3 chờ, 2 `dungCuoi` |

## AC1 — Chờ bấm ở cuối bước

- **Given** đang trình chiếu và bước hiện tại kết thúc bằng `[chờ: X]`, **when** giọng đọc hết đoạn đó, **then** giọng tạm dừng, video giảng viên dừng theo, X hiện trên màn hình và nút › thành «Tiếp tục». Không có nhịp nghỉ chồng lên.
- **Given** đang chờ, **when** bấm Tiếp tục, ›, hoặc phím →, **then** slide sang bước kế và giọng đọc tiếp.
- **Given** đang chờ, **when** học sinh kéo hay bấm trong slide, **then** giọng vẫn dừng, không có gì tự chạy tiếp.

## AC2 — Nghĩ n giây ở cuối bước

- **Given** bước kết thúc bằng `[nghĩ n: Y]`, **when** giọng đọc hết đoạn, **then** giọng dừng n giây theo thời gian thật (không đổi theo tốc độ nghe), Y hiện trên màn hình, rồi giọng tự đi tiếp và Y biến mất.
- **Given** đang nghĩ, **when** bấm ›, **then** đi tiếp ngay.
- **Given** đang nghĩ, **when** bấm dừng, **then** giọng không tự chạy lại; khi học sinh bấm phát thì đi tiếp.
- Khoảng dừng thay cho nhịp nghỉ của đoạn đó, không cộng thêm.

## AC3 — Trường hợp biên

- **Given** học sinh tua hoặc lật slide vượt qua điểm dừng, **then** không dừng ở đó. Nghe lại từ trước điểm dừng thì dừng lại lần nữa.
- **Given** vừa bấm Tiếp tục hoặc hết giờ nghĩ, **then** giọng không dừng lại lần hai ở cùng chỗ.
- **Given** tắt phụ đề, **then** lời nhắc vẫn hiện.
- **Given** điện thoại 375 px, **then** lời nhắc dài không đè chữ slide và không gây cuộn ngang.
- Bài thường và phần nghe ngoài trình chiếu không đổi.

## AC4 — Dữ liệu không đổi ngoài ý muốn

- Anchor, số đoạn và số slide của cả năm bài giữ nguyên.
- Dựng lại `khoa-toan-10-slide.json`: `tam-giac`, `toi-uu`, `xac-suat` **không đổi chữ lời giảng**, nên mã băm kịch bản giữ nguyên và không cần tạo lại giọng. `conic` và `ham-bac-hai` chỉ khác đúng các đoạn đã liệt kê.
- Chữ trong dấu không lọt vào lời giảng, phụ đề hay tệp giọng.
- Tính đã nghe 80%: thời gian dừng không làm tăng phần trăm đã nghe, và nghe hết bài có điểm dừng thì vượt ngưỡng. Mỗi lần bấm Tiếp tục bỏ qua nửa giây lặng giữa hai đoạn nên không chạm đúng 100%.

## AC5 — Test

- Hàm thuần: đọc dấu ở cuối bước; `cleanNarration` bỏ `[chờ…]`; chọn điểm dừng theo đoạn đang đọc.
- Kiểm tra cả năm bộ slide: mọi `[nghĩ]` và `[chờ]` nằm ở cuối bước, không nằm trên bước cuối của slide `dungCuoi`, có chữ lời nhắc; câu giao thao tác cho học sinh (em thử, em kéo, em bấm, em chọn, em nhập, em gieo) chỉ nằm ở bước có điểm dừng, trừ phần bài về nhà.
- Test `src/lib/slideDeck` và `src/lib/narration` xanh.

## AC6 — Kiểm trên máy dev bằng giọng giả

Với `NARRATION_FAKE_TTS=1`:

- `ham-bac-hai`: chờ bấm ở slide 5, 11, 15; nghĩ ở slide 7, 17. Thử cả Tiếp tục, ›, dừng trong lúc nghĩ, tua qua điểm dừng.
- Một trong ba bài còn lại: tạo giọng giả trước khi sửa, sửa bộ slide, xác nhận bài vẫn phát được mà không báo «giọng đã cũ».
- Desktop và 375 px. Giọng giả không kiểm được chất lượng giọng thật hay khớp môi; hai việc này kiểm sau khi tạo giọng trên 224.

## Triển khai lên 224 (chỉ làm khi user bảo)

1. Đưa mã và bộ slide lên. Ba bài không đổi lời có điểm dừng ngay.
2. Vào giờ thấp điểm: lưu kịch bản mới cho `conic` và `ham-bac-hai`, tạo giọng ngay. Hai bài này không nghe được trong lúc tạo.
3. Nếu khoá đã có video: export, dựng, attach lại cho 2 bài.

## Đã kiểm (02/11/2026, máy dev, giọng giả)

- [x] AC1, AC2: `ham-bac-hai` chờ ở slide 5, 11, 15 và cuối slide 12; nghĩ ở slide 7, 17, dừng đúng 5 giây rồi tự đi tiếp. `xac-suat` chờ ở slide 6 (hai chỗ), 9 và cuối slide 2, 7; nghĩ ở slide 2. `conic` nghĩ ở slide 3, 9; chờ ở slide 4. Slide sau cùng của khoảng nghĩ (`conic` 9) tự sang slide 10.
- [x] AC2: bấm dừng trong lúc nghĩ thì giữ nguyên tới khi bấm phát; bấm Tiếp tục thì đi ngay.
- [x] AC3: tua vượt không dừng; nghe lại từ trước điểm dừng thì dừng lại; thoát trong lúc nghĩ thì giọng không tự chạy lại; 375 px không cuộn ngang, lời nhắc không đè chữ slide.
- [x] AC4: dựng lại khoá, anchor và số đoạn giữ nguyên; `update:lesson --dry-run` trên dev báo lời giảng đổi đúng ở `conic`, `ham-bac-hai`, không báo ở ba bài còn lại.
- [x] AC4: nghe trọn `conic` có bấm Tiếp tục ở mọi chỗ chờ: đủ 10 điểm dừng đúng thứ tự, phần đã nghe 98%.
- [x] AC1: đổi thanh trượt trên slide trong lúc chờ, giọng vẫn dừng.
- [x] AC5: `src/lib/slideDeck`, `src/lib/narration` xanh.
- [ ] Chưa kiểm: giọng NEU TTS thật, khớp môi video, điện thoại thật. Các lượt thử sau khi khung trình duyệt bị ẩn (`xac-suat`, `conic`, đổi thanh trượt) chạy bằng tập lệnh trong trang, tắt tiếng, chưa kéo chuột thật.

## Ghi chú khi đưa lên server

`update-lesson.ts` nay ghi cả lời giảng đổi. Bản dry-run trên dev còn báo quiz đổi ngưỡng đạt (70 → 60), không liên quan việc này: luôn xem kỹ dry-run trước khi ghi. Chạy trên DB thật có thể báo khác.

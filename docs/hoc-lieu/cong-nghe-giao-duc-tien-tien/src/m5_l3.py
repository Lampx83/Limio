# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.3 · Xưởng kỹ thuật: dựng và tối ưu bản AR",
    "durationMin": 60,
    "description": "Dây chuyền kỹ thuật từ mô hình ba chiều tới trang web AR, ngân sách tài nguyên, tối ưu cho thiết bị yếu, và những chỗ hỏng chỉ lộ ra trong phòng học thật.",
    "objectives": [
        "Đi trọn dây chuyền từ tệp mô hình tới trải nghiệm AR mở được bằng mã QR",
        "Tối ưu tài nguyên để cảnh tải xong dưới ngưỡng đã đặt trên mạng di động",
        "Lường trước và xử lý được bốn nhóm sự cố hay gặp trong phòng học thật",
    ],
    "summary": [
        "Dây chuyền tuyến B gồm năm khâu: chuẩn bị mô hình, chuyển định dạng, tối ưu, xuất bản trang, và gắn mã QR lên trang in.",
        "Ảnh bề mặt thường nặng hơn lưới đa giác rất nhiều — tối ưu phải bắt đầu từ đó.",
        "Ngưỡng thực tế: mỗi cảnh tải xong dưới năm giây trên mạng di động của chính học sinh, đo trên máy đời thấp.",
        "Bốn nhóm sự cố phòng học: ánh sáng, mạng, thiết bị yếu, và học sinh không cài được gì — mỗi nhóm cần một phương án dự phòng đã chuẩn bị.",
    ],
    "body": r"""
## Dây chuyền năm khâu

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:36rem;display:flex;align-items:stretch;gap:.35rem">
    <div style="flex:1;padding:.65rem .5rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45"><strong>1 · Mô hình</strong><br>tìm hoặc dựng, kiểm giấy phép</div>
    <div style="flex:0 0 auto;opacity:.5;display:flex;align-items:center">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45"><strong>2 · Định dạng</strong><br>xuất ra glTF nhị phân .glb</div>
    <div style="flex:0 0 auto;opacity:.5;display:flex;align-items:center">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45"><strong>3 · Tối ưu</strong><br>giảm ảnh bề mặt, nén lưới</div>
    <div style="flex:0 0 auto;opacity:.5;display:flex;align-items:center">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(217,150,40,.9);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45"><strong>4 · Xuất bản</strong><br>trang tĩnh có model-viewer</div>
    <div style="flex:0 0 auto;opacity:.5;display:flex;align-items:center">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(220,38,38,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45"><strong>5 · Trang in</strong><br>mã QR, hướng dẫn một dòng</div>
  </div>
  <div style="min-width:36rem;font-size:1rem;opacity:.75;margin:.5rem 0 0;line-height:1.6">Khâu 3 là khâu quyết định sản phẩm có dùng được ở lớp không, và cũng là khâu sinh viên hay bỏ qua nhất.</div>
</div>
```

**Khâu 1 — mô hình.** Ba nguồn: tải từ thư viện có giấy phép rõ ràng, tự dựng bằng phần mềm dựng hình, hoặc dựng từ ảnh chụp vật thật. Với đồ án học phần, nguồn thứ nhất là lựa chọn hợp lý; dành thời gian cho sư phạm chứ không cho việc nặn mô hình. Ghi nguồn và giấy phép ngay lúc tải, đừng để tới lúc viết báo cáo.

**Khâu 2 — định dạng.** Chuẩn thực tế cho web AR là glTF ở dạng nhị phân (`.glb`): một tệp duy nhất chứa lưới, ảnh bề mặt và hoạt hình. Nếu mô hình gốc ở định dạng khác, xuất sang `.glb` rồi mở thử trước khi làm tiếp — mô hình xuất hỏng thường chỉ lộ ra khi xem trên thiết bị.

**Khâu 3 — tối ưu.** Xem mục sau.

**Khâu 4 — xuất bản.** Một trang HTML tĩnh có thẻ `<model-viewer>`, đặt trên dịch vụ lưu trữ trang tĩnh miễn phí. Trang nên có: tiêu đề ngắn, nút vào chế độ AR, chú giải văn bản, và **đường dẫn quay lại mục lục sách** để người học không bị lạc sau khi quét trang thứ ba.

**Khâu 5 — trang in.** Mã QR đặt cố định một vị trí trên mọi trang, kích thước tối thiểu khoảng 2,5 cm mỗi cạnh để quét được từ khoảng cách đọc bình thường, kèm **một dòng hướng dẫn** — không phải một đoạn.

## Ngân sách tài nguyên và tối ưu

Trực giác sai phổ biến: nghĩ rằng số đa giác quyết định độ nặng. Trong thực tế với mô hình học liệu, **ảnh bề mặt thường chiếm phần lớn dung lượng**.

| Hạng mục | Ngưỡng thực tế cho học liệu | Cách giảm |
|---|---|---|
| Tổng tệp `.glb` | Dưới 10 MB, lý tưởng dưới 5 MB | Làm ba việc dưới đây theo thứ tự |
| Ảnh bề mặt | Cạnh 1024 điểm ảnh là đủ cho mô hình xem trên điện thoại | Giảm kích thước, giảm số lượng ảnh, gộp kênh |
| Số đa giác | Vài chục nghìn là đủ cho hầu hết mô hình học liệu | Giảm lưới; ưu tiên giữ chi tiết ở phần người học phải nhìn |
| Nén | Nén hình học giảm đáng kể dung lượng lưới | Bật nén khi xuất tệp, kiểm lại hiển thị sau khi nén |
| Hoạt hình | Chỉ giữ hoạt hình phục vụ mục tiêu | Cắt hoạt hình trang trí |

> [!ghi-nho] Ngưỡng nghiệm thu nên đặt theo **trải nghiệm**, không theo dung lượng: *cảnh tải xong dưới năm giây, đo trên chiếc điện thoại đời thấp nhất trong lớp, dùng mạng di động của chính học sinh, ở phòng học thật*. Dung lượng chỉ là phương tiện để đạt ngưỡng đó.

Quy trình đo: mở trang ở chế độ ẩn danh để không dùng bộ nhớ đệm, bấm giờ từ lúc quét mã tới lúc mô hình hiện ra, lặp ba lần và lấy giá trị lớn nhất. Ghi lại số đo trong biên bản kỹ thuật — hội đồng sẽ hỏi, và số đo thật luôn thuyết phục hơn lời khẳng định.

## Bốn nhóm sự cố trong phòng học thật

| Nhóm | Biểu hiện | Phương án dự phòng chuẩn bị trước |
|---|---|---|
| Ánh sáng | Ngược sáng cửa sổ, phòng tối, bóng đổ lên trang | In trang tương phản cao; hướng dẫn học sinh xoay lưng về phía cửa sổ; có bản trình chiếu mô hình trên máy giáo viên |
| Mạng | Wi-Fi trường chập chờn khi 40 máy cùng truy cập | Tải sẵn trang lên máy trước giờ học; chuẩn bị điểm phát sóng cá nhân; giảm dung lượng cảnh |
| Thiết bị yếu | Máy đời thấp không mở nổi chế độ AR | Trang phải có chế độ xem ba chiều thường, không cần AR; kiểm trên máy yếu nhất mượn được |
| Không cài được gì | Máy đầy bộ nhớ, máy của phụ huynh | Đã chọn tuyến web ngay từ đầu; kèm phương án dùng chung theo nhóm ba người |

> [!canh-bao] Nguyên tắc bao trùm: **trang giấy phải tự nó dạy được**. Nếu toàn bộ nội dung chỉ tồn tại trong lớp phủ, một sự cố mạng biến tiết học thành mười lăm phút loay hoay. Lớp phủ là phần thêm giá trị, không phải phần chứa nội dung tối thiểu.

## Kiểm thử kỹ thuật trước khi mang tới lớp

Danh sách bảy việc, làm trong một buổi:

1. Mở trên **ít nhất ba thiết bị khác nhau**, trong đó có một máy đời thấp và một máy hệ điều hành khác.
2. Đo thời gian tải ba lần cho mỗi cảnh, ghi giá trị lớn nhất.
3. Thử trong ba điều kiện ánh sáng: phòng sáng đều, ngược sáng, và ánh sáng yếu.
4. Thử **in thật** trang giấy và quét từ bản in, không quét từ màn hình — độ tương phản khi in khác hẳn.
5. Thử ở khoảng cách quét thực tế: học sinh cầm sách trên bàn, không giơ sát mặt.
6. Nhờ một người chưa từng thấy sản phẩm tự mở, không hướng dẫn gì, bấm giờ.
7. Rút phích mạng và kiểm xem trang giấy còn dạy được không.

Việc 6 và 7 là hai việc phân biệt sản phẩm đã sẵn sàng với bản demo. Việc 6 chính là tiêu chí đạt tối thiểu đã nêu ở Bài 1.7.

## Luyện tập và tài liệu tham khảo

### Cá nhân (25 phút)

Chạy việc số 2 và số 6 trong danh sách trên với bản thử nghiệm kỹ thuật của mốc 1. Ghi lại ba số đo thời gian tải và kết quả của người thử. Nếu quá năm giây, làm khâu tối ưu theo đúng thứ tự trong bảng và đo lại.

### Nhóm 3–4 người (30 phút)

Đổi sản phẩm giữa các nhóm. Mỗi nhóm chạy đủ bảy việc kiểm thử kỹ thuật trên sản phẩm của nhóm bạn và lập biên bản. Yêu cầu: phải tìm ra ít nhất hai vấn đề — nếu không tìm ra, nghĩa là chưa thử đủ điều kiện khó.

### Bài tập về nhà — sản phẩm số (150 phút)

Hoàn thành **bản dựng kỹ thuật đầy đủ** cho bốn trang sách AR, kèm biên bản kỹ thuật.

1. Bốn cảnh AR mở được bằng mã QR từ trang in thật.
2. Bảng ngân sách tài nguyên: dung lượng từng cảnh trước và sau tối ưu, nêu rõ đã giảm gì.
3. Bảng đo thời gian tải trên ba thiết bị, mỗi thiết bị ba lần.
4. Biên bản bảy việc kiểm thử, ghi rõ vấn đề tìm được và cách đã sửa.
5. Phương án dự phòng viết sẵn cho cả bốn nhóm sự cố, ở mức giáo viên đọc là làm theo được.

**Cách làm (gợi ý từng bước):** tối ưu theo thứ tự ảnh bề mặt trước, lưới sau, nén cuối — làm ngược thì tốn công mà giảm được ít; in trang bằng máy in thật của trường chứ không phải máy in tốt nhất bạn mượn được; khi đo thời gian tải nhớ tắt bộ nhớ đệm; phần phương án dự phòng viết dưới dạng câu mệnh lệnh ngắn để giáo viên đọc được giữa giờ.

**Chấm theo:** bốn cảnh chạy được từ bản in thật (4đ) · bảng tối ưu có số liệu trước sau (2đ) · đo thời gian trên ba thiết bị đúng quy trình (2đ) · biên bản bảy việc có vấn đề tìm được và cách sửa (2đ) · phương án dự phòng dùng được ngay (1đ). Trừ điểm nếu trang giấy không tự dạy được khi mất mạng.

### Nguồn tham khảo

- Google. *model-viewer* — tài liệu thành phần web hiển thị mô hình 3D và AR. [modelviewer.dev](https://modelviewer.dev/)
- Khronos Group. *glTF 2.0 Specification* — định dạng chuẩn cho mô hình ba chiều trên web.
- Google. *Scene Viewer* — hiển thị mô hình AR trên Android. [developers.google.com/ar](https://developers.google.com/ar/develop/scene-viewer)
- Poly Pizza và Sketchfab — thư viện mô hình có giấy phép rõ ràng. [poly.pizza](https://poly.pizza/) · [sketchfab.com](https://sketchfab.com/features/free-3d-models)
""",
    "quiz": {
        "title": "Kiểm tra Bài 5.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "5.3-khau-quyet-dinh",
                "type": "mcq",
                "prompt": "Khâu nào trong dây chuyền năm bước quyết định sản phẩm có dùng được ở lớp hay không, và hay bị bỏ qua nhất?",
                "explanation": "Khâu tối ưu tài nguyên: mô hình quá nặng thì không tải nổi trên mạng và thiết bị thật của học sinh, dù mọi khâu khác đều tốt.",
                "points": 2,
                "options": [
                    {"label": "Khâu tối ưu tài nguyên", "isCorrect": True},
                    {"label": "Khâu tìm mô hình", "isCorrect": False},
                    {"label": "Khâu xuất bản trang", "isCorrect": False},
                    {"label": "Khâu tạo mã QR", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-anh-be-mat",
                "type": "mcq",
                "prompt": "Với mô hình học liệu, thành phần nào thường chiếm phần lớn dung lượng tệp?",
                "explanation": "Ảnh bề mặt, không phải số đa giác — nên tối ưu phải bắt đầu từ đó: giảm kích thước, giảm số lượng, gộp kênh.",
                "points": 2,
                "options": [
                    {"label": "Ảnh bề mặt", "isCorrect": True},
                    {"label": "Số đa giác của lưới", "isCorrect": False},
                    {"label": "Dữ liệu hoạt hình", "isCorrect": False},
                    {"label": "Siêu dữ liệu mô tả mô hình", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-nguong-nghiem-thu",
                "type": "mcq",
                "prompt": "Ngưỡng nghiệm thu kỹ thuật nên phát biểu thế nào?",
                "explanation": "Theo trải nghiệm: cảnh tải xong dưới năm giây, trên máy đời thấp nhất trong lớp, dùng mạng di động của học sinh, ở phòng học thật. Dung lượng chỉ là phương tiện.",
                "points": 2,
                "options": [
                    {"label": "Tải xong dưới năm giây trên máy đời thấp nhất, mạng của học sinh, ở phòng học thật", "isCorrect": True},
                    {"label": "Tệp dưới 10 MB là đạt", "isCorrect": False},
                    {"label": "Chạy mượt trên máy của người làm sản phẩm", "isCorrect": False, "misconception": "cngdtt.demo-equals-product"},
                    {"label": "Mô hình có độ chi tiết cao nhất có thể", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-do-thoi-gian",
                "type": "mcq",
                "prompt": "Quy trình đo thời gian tải đúng gồm những gì?",
                "explanation": "Mở ở chế độ ẩn danh để không dùng bộ nhớ đệm, bấm giờ từ lúc quét mã tới lúc mô hình hiện, lặp ba lần và lấy giá trị lớn nhất.",
                "points": 2,
                "options": [
                    {"label": "Tắt bộ nhớ đệm, bấm giờ từ lúc quét tới lúc mô hình hiện, lặp ba lần, lấy giá trị lớn nhất", "isCorrect": True},
                    {"label": "Đo một lần trên máy tính của mình rồi ghi lại", "isCorrect": False},
                    {"label": "Lấy trung bình của ba lần đo liên tiếp cùng thiết bị", "isCorrect": False},
                    {"label": "Ước lượng theo dung lượng tệp chia tốc độ mạng", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-thu-tu-toi-uu",
                "type": "ordering",
                "prompt": "Sắp xếp thứ tự tối ưu tài nguyên cho hiệu quả cao nhất.",
                "explanation": "Ảnh bề mặt trước vì nó chiếm phần lớn dung lượng, rồi tới lưới, rồi nén, cuối cùng cắt hoạt hình trang trí. Làm ngược thì tốn công mà giảm được ít.",
                "points": 3,
                "sequence": [
                    "Giảm kích thước và số lượng ảnh bề mặt",
                    "Giảm số đa giác của lưới, giữ chi tiết ở phần cần nhìn",
                    "Bật nén hình học khi xuất tệp và kiểm lại hiển thị",
                    "Cắt các hoạt hình không phục vụ mục tiêu học tập",
                ],
            },
            {
                "key": "5.3-in-that",
                "type": "mcq",
                "prompt": "Vì sao phải thử quét từ bản in thật chứ không quét từ màn hình?",
                "explanation": "Độ tương phản và chi tiết khi in khác hẳn màn hình, và học sinh sẽ dùng bản in — quét từ màn hình cho kết quả tốt giả tạo.",
                "points": 2,
                "options": [
                    {"label": "Vì độ tương phản khi in khác màn hình, và học sinh sẽ dùng bản in", "isCorrect": True},
                    {"label": "Vì quét từ màn hình vi phạm bản quyền", "isCorrect": False},
                    {"label": "Vì màn hình phản chiếu ánh sáng", "isCorrect": False},
                    {"label": "Không cần thiết nếu mã QR đã đủ lớn", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-bon-su-co",
                "type": "matching",
                "prompt": "Ghép mỗi nhóm sự cố phòng học với phương án dự phòng phù hợp.",
                "explanation": "Mỗi nhóm cần một phương án chuẩn bị trước, viết sẵn để giáo viên đọc được giữa giờ.",
                "points": 3,
                "pairs": [
                    {"left": "Ánh sáng", "right": "In tương phản cao, hướng dẫn xoay lưng về phía cửa sổ, có bản chiếu trên máy giáo viên"},
                    {"left": "Mạng chập chờn", "right": "Tải sẵn trang trước giờ, chuẩn bị điểm phát sóng, giảm dung lượng cảnh"},
                    {"left": "Thiết bị yếu", "right": "Trang có chế độ xem ba chiều thường, không bắt buộc vào chế độ AR"},
                    {"left": "Không cài được ứng dụng", "right": "Chọn tuyến web ngay từ đầu, kèm phương án dùng chung theo nhóm ba người"},
                ],
            },
            {
                "key": "5.3-trang-giay-tu-day",
                "type": "mcq",
                "prompt": "Nguyên tắc bao trùm khi thiết kế để chịu được sự cố là gì?",
                "explanation": "Trang giấy phải tự nó dạy được; lớp phủ là phần thêm giá trị, không phải phần chứa nội dung tối thiểu. Nếu không, một sự cố mạng biến tiết học thành loay hoay.",
                "points": 2,
                "options": [
                    {"label": "Trang giấy tự nó dạy được, lớp phủ chỉ thêm giá trị", "isCorrect": True},
                    {"label": "Luôn chuẩn bị hai bộ thiết bị dự phòng", "isCorrect": False},
                    {"label": "Yêu cầu trường nâng cấp đường truyền trước khi dạy", "isCorrect": False},
                    {"label": "Ghi hình sẵn màn hình để chiếu nếu hỏng", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-viec-6-7",
                "type": "mcq",
                "prompt": "Hai việc nào trong danh sách bảy việc phân biệt sản phẩm đã sẵn sàng với bản demo?",
                "explanation": "Nhờ người chưa từng thấy tự mở không hướng dẫn (việc 6), và rút mạng để kiểm trang giấy còn dạy được không (việc 7).",
                "points": 2,
                "options": [
                    {"label": "Người lạ tự mở được không cần hướng dẫn, và trang giấy còn dạy được khi mất mạng", "isCorrect": True},
                    {"label": "Đo thời gian tải, và thử ba điều kiện ánh sáng", "isCorrect": False},
                    {"label": "In thật, và quét ở khoảng cách thực tế", "isCorrect": False},
                    {"label": "Mở trên ba thiết bị, và kiểm hệ điều hành khác", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-nhom-khong-tim-ra",
                "type": "mcq",
                "prompt": "Nhóm bạn kiểm thử sản phẩm của bạn và báo không tìm ra vấn đề nào. Cách hiểu đúng là gì?",
                "explanation": "Nhiều khả năng họ chưa thử đủ điều kiện khó — máy yếu, ngược sáng, mạng kém, người dùng lạ. Kiểm thử không tìm ra gì thường là kiểm thử chưa đủ.",
                "points": 2,
                "options": [
                    {"label": "Nhiều khả năng chưa thử đủ điều kiện khó, cần thử lại với máy yếu và ánh sáng xấu", "isCorrect": True},
                    {"label": "Sản phẩm đã hoàn thiện, có thể nộp", "isCorrect": False, "misconception": "cngdtt.demo-equals-product"},
                    {"label": "Nên đổi nhóm kiểm thử khác", "isCorrect": False},
                    {"label": "Nên tăng độ chi tiết của mô hình vì còn dư tài nguyên", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-ma-qr",
                "type": "mcq",
                "prompt": "Yêu cầu tối thiểu cho mã QR trên trang in là gì?",
                "explanation": "Đặt cố định một vị trí trên mọi trang, cạnh tối thiểu khoảng 2,5 cm để quét được từ khoảng cách đọc bình thường, kèm đúng một dòng hướng dẫn.",
                "points": 2,
                "options": [
                    {"label": "Vị trí cố định giữa các trang, cạnh khoảng 2,5 cm, kèm một dòng hướng dẫn", "isCorrect": True},
                    {"label": "Càng nhỏ càng tốt để không chiếm chỗ nội dung", "isCorrect": False},
                    {"label": "Đặt ngẫu nhiên theo bố cục từng trang cho sinh động", "isCorrect": False},
                    {"label": "Kèm một đoạn hướng dẫn đầy đủ các bước", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-giay-phep-ngay",
                "type": "true_false",
                "prompt": "Nên ghi nguồn và giấy phép của mô hình ngay lúc tải, không để tới lúc viết báo cáo.",
                "explanation": "Đúng — sau vài chục tệp thì không ai nhớ tệp nào lấy ở đâu, và tài nguyên không rõ giấy phép bị coi là lỗi liêm chính chứ không phải lỗi hình thức.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "5.3-viet-luan-ky-thuat",
                "type": "essay",
                "prompt": "Viết 250–350 từ biên bản kỹ thuật cho một cảnh AR của bạn: dung lượng trước và sau tối ưu kèm việc đã làm, số đo thời gian tải trên hai thiết bị, hai vấn đề tìm được khi kiểm thử và cách đã sửa, và phương án dự phòng khi mất mạng.",
                "points": 5,
            },
        ],
    },
}

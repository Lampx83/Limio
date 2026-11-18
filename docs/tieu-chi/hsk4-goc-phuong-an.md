# Phương án khoá tiếng Trung chuẩn HSK 3.0 — Cấp 4 (bản gốc Limio)

Trạng thái: **đề xuất, chờ chốt**. Nối tiếp khoá cấp 3 đã thử một unit ("Cuối tuần đi leo núi", slug `hsk-3-goc`). Nguồn quy trình: `~/Documents/Limio/hsk3-goc/` (BRIEF.md, check.py, levelcheck.py, svg2png.sh).

## 1. Cấp 4 có những gì (đếm từ dữ liệu `ivankra/hsk30`)
| | Cấp 1 | Cấp 2 | Cấp 3 | **Cấp 4** |
|---|---|---|---|---|
| Từ mới của cấp | 500 | 772 | 973 | **1.000** |
| Từ tích luỹ | 500 | 1.272 | 2.245 | **3.245** |
| Điểm ngữ pháp mới | 48 | 82 | 81 | **76** |

Ngữ pháp mới của cấp 4 (76 điểm) gồm chủ yếu: 18 loại câu phức (递进, 选择, 假设, 条件, 转折, 因果, 目的…), 8 phó từ, 6 giới từ, ~12 khẩu ngữ ("还X呢", "X就是了"…), 5 câu đặc biệt (把2, 被, 存现, 兼语, 是……的), 4 cách nhấn mạnh (连……也, 反问, 双重否定…), 5 khuôn cố định (在……方面, 由……组成, (自)……以来…), cùng số từ chỉ số lượng, tứ tự.

## 2. Quy mô đề xuất
- **20 unit** (khoảng 50 từ mới/unit, 3–4 điểm ngữ pháp/unit), cứ 4 unit chèn 1 **bài ôn** nên tổng ~24 mục. Có thể rút còn 15 unit nếu chấp nhận phủ ~75% từ cấp 4.
- Mỗi unit giữ khuôn đã thử ở cấp 3: Khởi động, ba bài khoá, bài tập tổng hợp (5 bài học), nhưng bài khoá dài hơn (hội thoại 10–12 lượt hoặc một đoạn văn 200–300 chữ), có thêm dạng **đọc hiểu** và **viết đoạn ngắn** (đúng yêu cầu HSK 4).
- Mục tiêu độ phủ: ≥ 90% trong 1.000 từ cấp 4 được dạy làm thẻ từ mới; từ ngoài cấp 4 ≤ 5% lượt từ; từ cấp 1–3 ôn lặp.

## 2b. Nhân vật
Dùng **đúng một bộ nhân vật cho mọi hội thoại ở mọi unit**: 林雨 (Lâm Vũ), 方强 (Phương Cường), 赵叔叔 (chú Triệu), như ở khoá cấp 3; chỉ đổi bối cảnh và vai trò theo unit. Không thêm nhân vật khách có tên. Vẽ theo bộ nhận diện cố định (tóc, màu áo, phụ kiện đặc trưng), đổi trang phục theo bối cảnh nhưng giữ nét nhận dạng.

## 2c. Mạch truyện liền
Các hội thoại liên quan với nhau: bộ ba nhân vật sống qua một dòng thời gian (cấp 3 là năm hai, cấp 4 từ năm ba đến tốt nghiệp và đi làm). Có "tài liệu cốt truyện" (story bible) ghi dòng thời gian, tính cách cố định, vật và nơi lặp lại, các sợi chỉ chạy qua nhiều unit, và với mỗi unit: nhắc lại gì ở unit trước (callback), cài gì cho unit sau (seed). Mỗi bài khoá vẫn tự đọc được khi học viên nhảy bài (có dòng tóm tắt bối cảnh), và chuyện cũ được dùng làm chất liệu ôn, không chép lại câu thoại cũ.

## 3. Các unit đề xuất (chủ đề → cụm ngữ pháp)
Ghép ngữ pháp theo bảng cấp 4; từ mới sẽ do bước "phân bổ" gán theo chủ đề.
1. Phỏng vấn xin việc — 在……方面, 由……组成, 递进 (不但……而且/还)
2. Thuê nhà, chuyển nhà — 存现句, 兼语句, 趋向补语引申
3. Mua sắm trực tuyến, trả hàng — 被动句, 把字句 2, 是……的
4. Đổi kế hoạch du lịch — 选择复句 (或者/还是, 与其……不如), 条件 (只要……就, 只有……才)
5. **Ôn 1–4**
6. Sức khoẻ và thể thao — 并列 (一边……一边, 既……又), 概数 (来, 左右)
7. Công nghệ và điện thoại — 连……也/都, 一+量词+也没……, 反问句
8. Môi trường, đi lại xanh — 假设 (即使……也, 如果……就), 在……上/下/中
9. Áp lực học tập — 转折 (尽管……可是, 然而), 因果 (既然……就)
10. Lễ hội và truyền thống — (自)……以来, 四字格, 倍数/分数
11–12. Công việc và đồng nghiệp; ngân hàng và tiền tiết kiệm
13. **Ôn 9–12**
14–16. Sách và đọc; nghệ thuật và âm nhạc; thành phố và nông thôn
17. **Ôn 14–16**
18–20. Gia đình và thế hệ; giao tiếp, hiểu lầm; kế hoạch tương lai
Các tên unit chốt sau khi có bảng phân bổ từ.

## 4. Quy trình soạn (rút từ bài học của cấp 3)
0. **Chuẩn bị dữ liệu (làm trước, 1 lần):** nạp bảng từ + ngữ pháp chính thức vào script; chạy "phân bổ" gán 1.000 từ + 76 điểm ngữ pháp cho từng unit theo chủ đề (một agent lập phương án, một agent soát, người điều phối chốt). Tạo lại tệp khung (`skeleton.json`) bằng **dữ liệu tự bịa**, không lấy từ học liệu cũ.
1. **Bản thiết kế unit** (một tệp BRIEF ngắn cho từng unit: chủ đề, nhân vật, danh sách từ, ngữ pháp, tình huống ba bài khoá).
2. **Tác giả** (một agent/bài, song song) → 3. **Kiểm tự động** (`check.py`: pinyin, trùng học liệu cũ; `levelcheck.py`: cấp từ theo bảng chính thức; thêm kiểm "từ mới có xuất hiện trong bài") → 4. **Biên tập viên** độc lập → 5. **Chỉnh sửa theo biên tập** → 6. nhập thử `--dry-run` + vào dev → 7. **Giáo viên tiếng Trung bản ngữ duyệt** → 8. Làm audio.
Cải tiến so với cấp 3: kiểm cấp từ bằng bảng chính thức ngay ở bước 3 (không để biên tập viên ước tính), giữ nhân vật cố định theo bộ nhận diện chung, dùng định dạng ngữ pháp có dữ liệu (`hskGrammar`) để giao diện giống khoá cũ.

## 5. Việc kỹ thuật cần làm một lần
- **Khung ngữ pháp** kiểu "Lớp học của Tiểu Ngữ": cho khoá mới sinh dữ liệu `hskGrammar` (cụm, nghĩa/cách dùng, ví dụ, lưu ý), thay cho đoạn ngữ pháp trong thân bài.
- **Audio hội thoại:** sinh bằng NEU TTS (tránh giọng `zf_xiaoni`), ghép từng lượt thành **một tệp liền** để dùng trình phát chuẩn có tốc độ (khoá cấp 3 dùng audio gốc của sách; bản tự soạn phải tự có). Cần công cụ nối tệp mp3 và tạo mốc thời gian từng câu để tô sáng. Giọng NEU chỉ dùng được qua server 224.
- **Dạng đúng/sai tiếng Việt:** hệ thống hiện TRUE/FALSE/NOT GIVEN tiếng Anh; nên sửa ở ứng dụng thay vì dùng trắc nghiệm hai lựa chọn.
- Chuẩn hoá quy ước pinyin (viết liền theo từ) cho mọi bài.

## 6. Khối lượng và chi phí ước tính (dựa trên một unit cấp 3)
Một unit cấp 3 tốn khoảng 1,2–1,5 triệu token và ~1–1,5 giờ chạy của các agent (tác giả, biên tập, chỉnh sửa). Cấp 4 dài hơn nên ước ~1,8 triệu token/unit → **~35–40 triệu token cho 20 unit**, chưa kể audio và thời gian giáo viên duyệt. Nên đi theo từng đợt 3–4 unit để rút kinh nghiệm.

## 7. Rủi ro
- Độ tự nhiên và độ chính xác tiếng Trung: AI soạn và AI biên tập chưa đủ; bắt buộc có người bản ngữ duyệt (đã nêu ở cấp 3).
- Pháp lý: soạn mới hoàn toàn; chưa soát pháp lý; từ khoá "HSK" có thể là nhãn hiệu (cần tư vấn).
- Bảng từ chính thức đang dùng là bản cộng đồng làm sạch từ tài liệu của Bộ GD, cần đối chiếu với bản PDF chính thức.
- Kỳ thi HSK 3.0 mới bắt đầu áp dụng từ cuối 2026, dữ liệu chuẩn có thể còn được chỉnh.

## 8. Cần bạn chốt
1. Quy mô: 20 unit đầy đủ hay thử 3 unit (U1–U3) trước? (khuyến nghị: thử 3 unit rồi mới quyết)
2. Có chuẩn hoá lại khoá cấp 3 (thay từ vượt cấp, khung ngữ pháp, audio) trước khi làm cấp 4 không?
3. Ai là giáo viên tiếng Trung bản ngữ duyệt, và bao giờ duyệt?
4. Audio: làm ngay từ unit đầu (cần SSH 224) hay để sau khi chốt nội dung?
5. Tên khoá và việc dùng từ "HSK" trong tên (cần xác nhận pháp lý).

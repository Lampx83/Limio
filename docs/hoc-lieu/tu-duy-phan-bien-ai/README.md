# Khoá "Tư duy phản biện thời AI" — dàn ý

> Trạng thái (24/10/2026): **đã soạn đủ 6 bài** (nội dung, ảnh có giấy phép, tài liệu tham khảo đã kiểm, thẻ ghi nhớ, 7 câu quiz mỗi bài) kèm lời giảng và kịch bản podcast từng bài; nhập thử cả khoá vào máy dev. Chưa làm tính năng Nghe giảng / Podcast và chưa tạo giọng. Khoá mẫu cho học viên (thẻ "Thử học ngay" trên trang
> Bắt đầu, `docs/hoc-vien/trang-dau-hoc-vien-AC.md`). Đã chốt 24/10/2026: chủ đề tư duy phản biện thời AI,
> 6 bài × khoảng 20 phút, nhập máy dev trước rồi mới lên prod.

## Học viên là ai và học xong làm được gì

Khoá viết cho **mọi học viên** — sinh viên, người đi làm, người học thêm — không cần nền chuyên môn. Điểm chung
duy nhất được giả định: ai cũng đã hoặc sắp dùng các công cụ AI trò chuyện, và ai cũng đọc tin trên mạng mỗi ngày.

Học xong, học viên:

1. Kiểm được một câu trả lời của AI trước khi dùng, thay vì tin vì nó trôi chảy.
2. Tách được một lập luận — của người, của AI hay của chính mình — thành khẳng định, bằng chứng và suy luận ngầm.
3. Kiểm được một bức ảnh, đoạn video hay tin lan truyền trong vài phút bằng cách đọc ngang.
4. Đặt câu hỏi cho AI theo cách nhận về câu trả lời kiểm chứng được.
5. Nhận ra thiên kiến của AI và của chính mình, nhất là khi AI chiều theo người hỏi.
6. Dùng AI để học nhanh hơn mà không giao luôn phần suy nghĩ cho nó.

## Cấu trúc

Hai module, mỗi module ba bài. Bài nào cũng theo một khuôn:

    mục tiêu → tình huống mở bài → 3–4 mục thân bài → tổng kết → bài kiểm tra 5 câu chấm tự động

- **Khoảng 20 phút mỗi bài**: đọc 12–15 phút, kiểm tra 5 phút. Riêng **bài 1 giữ ngắn nhất (khoảng 15 phút)**
  vì đó là bài học viên mở khi bấm "Học thử".
- **Bài kiểm tra chỉ có câu chấm tự động** (chọn đáp án, đúng/sai, sắp xếp) để phản hồi tới ngay. Mỗi phương án
  sai đáng chú ý gắn một mã lỗi tư duy (tiền tố `aipb.`) kèm lời phản hồi chỉ đúng chỗ hiểu nhầm.
- **Mỗi bài kết bằng một việc làm ngay** trên công cụ AI học viên đang dùng, không cần nộp.
- Bật cá nhân hoá (`personalizationEnabled`) để mỗi bài thành một chủ đề và trang "Chủ đề cần ôn" có dữ liệu.
- **Hình thức** (user yêu cầu khoá mẫu ấn tượng, học liệu phong phú, câu hỏi đa dạng — 24/10/2026):
  - mỗi bài một bảng màu (`look`), thân bài theo bố cục `sections`: các bước, hai cột so sánh, thẻ, hỏi đáp gập mở,
    số liệu nổi bật — cùng bộ bố cục với "Bài học từ tài liệu";
  - khung trò chuyện AI mô phỏng vẽ bằng HTML nội tuyến; hộp ghi nhớ / ví dụ / bẫy thường gặp / mẹo;
  - hộp gập "nghĩ trước rồi mở" (`:::`) để học viên tự đoán trước khi đọc tiếp;
  - thẻ ghi nhớ (`flashcards`) mỗi bài, ôn ngắt quãng ở trang Thẻ ghi nhớ của khoá;
  - bài kiểm tra trộn đủ dạng chấm tự động: chọn một, chọn nhiều, đúng/sai, kéo thả vào chỗ trống, ghép cặp, sắp xếp,
    điền từ. **Đáp án đúng không đứng cố định một chỗ** (trang làm bài không đảo phương án chọn và thẻ kéo thả).
  - Ảnh ngoài và video chỉ đưa vào khi đã kiểm giấy phép / kênh chính thức qua oEmbed; video IBM Technology
    "Why Large Language Models Hallucinate" (9:37, tiếng Anh) để làm tài liệu xem thêm, không nhúng vào bài 1.

## Module 1 · Đọc thông tin trong thời AI

**Bài 1 · Ảo giác AI: trôi chảy chưa chắc đúng** (khoảng 15 phút — bài học thử)
- Tình huống: hỏi AI một số liệu, nhận câu trả lời tự tin kèm một nguồn không tồn tại.
- Vì sao AI có thể "bịa": nó sinh chữ nghe hợp lý, không tra sự thật; độ trôi chảy không đo độ chính xác.
- Ba loại câu trả lời cần kiểm trước khi dùng: số liệu cụ thể, trích dẫn và nguồn, chuyện mới xảy ra.
- Thói quen một phút: hỏi nguồn → tự mở nguồn → đối chiếu đúng câu được trích.

**Bài 2 · Cấu trúc của một lập luận**
- Khẳng định, bằng chứng, suy luận ngầm — mảnh thứ ba là chỗ hay hỏng nhất.
- Áp lên câu trả lời của AI, lên một bài đăng trên mạng, lên ý kiến của chính mình.
- Năm câu hỏi kiểm tra dùng hằng ngày (dựa trên Module 3 khoá Kỹ năng mềm).

**Bài 3 · Kiểm chứng ảnh, video và tin lan truyền**
- Ảnh và giọng nói giả giờ rẻ và nhanh; dấu hiệu bằng mắt ngày càng ít đáng tin.
- Đọc ngang (lateral reading) theo nghiên cứu của nhóm Stanford History Education Group: rời trang để hỏi
  người khác nói gì về nguồn này.
- Bốn bước SIFT của Mike Caulfield: Dừng lại, Tra nguồn, Tìm tin tốt hơn, Lần về bản gốc.

## Module 2 · Làm việc cùng AI

**Bài 4 · Đặt câu hỏi cho AI hiệu quả**
- Đưa bối cảnh, nói rõ mục đích, yêu cầu nêu giả định và mức độ chắc chắn.
- Bắt AI phản biện chính câu trả lời của nó; hỏi cách giải thích khác.
- Biết khi nào nên tra nguồn gốc thay vì hỏi AI.

**Bài 5 · Thiên kiến khi dùng AI**
- Thiên kiến xác nhận: ta tìm thứ ủng hộ điều đã tin.
- AI có xu hướng chiều theo người hỏi: câu hỏi dẫn dắt nhận câu trả lời dẫn dắt.
- Thiên kiến tin máy (automation bias): tin kết quả vì nó do máy đưa ra.
- Cách hỏi trung lập và cách tự kiểm mình.

**Bài 6 · Học cùng AI mà vẫn tự suy nghĩ**
- Giao việc cho AI giúp gì và làm mất gì: phần ta không tự làm thì ta không học được.
- Việc nên và không nên giao: tóm tắt để đọc nhanh khác với nhờ viết hộ bài phải tự viết.
- Quy tắc "nghĩ trước, hỏi sau, kiểm cuối"; trung thực về việc đã dùng AI.

## Nhập vào hệ thống

Dùng chung đường với khoá Kỹ năng mềm: nguồn `src/*.py` → `build.py` sinh manifest JSON →
`pnpm import:course`. Nhập vào máy dev trước, duyệt xong mới nhập prod bằng tài khoản giảng viên được chỉ định,
publish, cho tự ghi danh, miễn phí, rồi bật "Mẫu cho học viên" trong Quản trị › Khoá học.

## Dữ liệu lời giảng và podcast trong nguồn

Mỗi file bài `mX_lY.py` có hai khoá `lecture` và `podcast` (công cụ nhập hiện bỏ qua, build vẫn đếm):
- `lecture`: danh sách `{anchor, text}`; `anchor` là `mo-dau`, đúng tiêu đề từng mục của `sections` (trừ "Tài liệu tham khảo") hoặc `tong-ket`. Lời viết cho tai nghe, xưng "mình – bạn", không markdown.
- `podcast`: `{title, durationMin, hosts: {A: Khoa, B: Linh}, turns: [{speaker, text}]}`.
- `build.py` chỉ đưa vào manifest những mã lỗi tư duy mà câu hỏi thực sự dùng (bỏ mã thừa) và báo mã nào bị bỏ.

## Nghe giảng và Podcast (chốt 24/10/2026)

Mỗi bài có hai cách nghe, dùng chung một bộ máy: lời viết sẵn → tạo giọng **một lần** → lưu tệp → mọi học viên nghe chung.

| | Nghe giảng | Podcast |
|---|---|---|
| Ai nói | Một giảng viên ảo, xưng "mình – bạn" | Hai người dẫn trò chuyện, hỏi đáp, đưa ví dụ |
| Bám trang | Có: giảng tới mục nào thì mục đó được tô sáng, trang tự cuộn theo | Không: nghe riêng, kể cả khi không nhìn màn hình |
| Độ dài | Bằng thời lượng bài | 5–8 phút mỗi bài |
| Giao diện | Nút "Nghe giảng" đầu bài → thanh phát ghim cuối màn hình, ảnh đại diện + sóng âm, tốc độ 0,75–1,5× | Thẻ "Podcast" trong bài, cùng trình phát |

- **Giọng đọc: NEU TTS** (giọng Việt tự host qua Kong; có danh sách giọng ở Quản trị › Tích hợp). Podcast cần hai giọng
  khác nhau — chọn sau khi nghe thử danh sách giọng.
- **Lời giảng viết riêng cho tai nghe**, không đọc nguyên văn trang: giải thích sơ đồ đang hiện, dẫn dắt, nhấn ý; tới hộp
  "nghĩ trước rồi mở" thì dừng lại mời học viên nghĩ. Khoá mẫu: Claude viết cùng lúc soạn bài, user duyệt chữ trước
  khi tạo giọng.
- **Tạo giọng trên máy chủ**, không trên máy soạn: khoá NEU TTS chỉ có ở máy chủ (máy dev chưa cấu hình). Một nút
  cho quản trị/giảng viên "Tạo giọng" đọc lời đã lưu cùng bài, gọi NEU TTS, lưu tệp và mốc thời gian từng mục.
- **Phạm vi đợt này: chỉ khoá mẫu.** Nút "AI soạn lời giảng" cho giảng viên tự làm với bài của mình để đợt sau.

### Thứ tự làm

1. User duyệt hình thức bài 1 (ảnh chụp đã gửi 24/10).
2. Soạn bài 2–6, mỗi bài kèm lời giảng theo mục (`lecture`) và kịch bản podcast (`podcast`: lượt thoại hai người).
3. Làm tính năng: công cụ nhập nhận `lecture`/`podcast` → lưu cùng bài; nút "Tạo giọng" trên máy chủ (NEU TTS);
   trình "Nghe giảng" (tô sáng mục, tự cuộn) và thẻ "Podcast".
4. Nghe thử danh sách giọng NEU trên máy chủ, chọn giọng giảng viên + hai giọng podcast.
5. Nhập khoá lên prod, tạo giọng, xuất bản, bật "Mẫu cho học viên".

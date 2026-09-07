# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2.1 · Bên trong một mô hình ngôn ngữ lớn",
    "durationMin": 55,
    "description": "Cơ chế dự đoán từ tiếp theo, ba giai đoạn huấn luyện, nguồn gốc của hiện tượng bịa đặt, và bốn tham số vận hành quyết định chất lượng đầu ra trong ứng dụng giáo dục.",
    "objectives": [
        "Giải thích được vì sao một mô hình ngôn ngữ có thể sai mà vẫn trôi chảy",
        "Phân biệt được ba giai đoạn huấn luyện và điều mỗi giai đoạn quyết định trong hành vi mô hình",
        "Chọn được tham số vận hành phù hợp cho hai loại tác vụ giáo dục khác nhau",
    ],
    "summary": [
        "Mô hình ngôn ngữ ước lượng phân phối xác suất của đơn vị văn bản tiếp theo; nó không tra cứu một kho sự thật, nên câu đúng và câu bịa được sinh ra bằng cùng một cơ chế.",
        "Tiền huấn luyện quyết định vốn hiểu biết, tinh chỉnh có giám sát quyết định dạng phản hồi, học từ phản hồi con người quyết định giọng điệu và mức độ chiều lòng người dùng.",
        "Bịa đặt không phải lỗi lập trình mà là hệ quả của mục tiêu huấn luyện; giảm được bằng cách nối mô hình với nguồn tra cứu và bắt nó trích dẫn, không giảm được bằng cách dặn nó đừng bịa.",
        "Bốn tham số cần biết khi triển khai: cửa sổ ngữ cảnh, nhiệt độ, quy trình tra cứu bổ trợ, và tính không lặp lại của đầu ra.",
    ],
    "body": r"""
## Dự đoán đơn vị tiếp theo — và mọi thứ suy ra từ đó

Một mô hình ngôn ngữ lớn làm đúng một việc: cho một chuỗi văn bản, ước lượng **phân phối xác suất của đơn vị tiếp theo**, rồi lấy mẫu một đơn vị từ phân phối ấy và lặp lại. Đơn vị ở đây không phải từ mà là **token** — mảnh văn bản do bộ tách sinh ra, có thể là một từ, một phần từ, hay một dấu câu. Tiếng Việt có dấu thường bị tách thành nhiều token hơn tiếng Anh cho cùng một lượng thông tin, và đó là lý do rất thực tế: cùng một bài học, bản tiếng Việt tiêu tốn nhiều token hơn, đắt hơn và chạm giới hạn ngữ cảnh sớm hơn.

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .5rem">Một bước sinh: từ chuỗi đã có tới phân phối xác suất của token kế tiếp</div>
  <div style="padding:.6rem .8rem;border:1px solid rgba(127,127,127,.3);border-radius:.45rem;font-size:1.1rem;line-height:1.6;margin:0 0 .7rem">Chuỗi đã có: <em>Thủ đô của Việt Nam là</em> <span style="opacity:.5">▮</span></div>
  <div style="display:flex;flex-direction:column;gap:.3rem">
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 8rem;font-size:1.05rem">Hà Nội</div><div style="flex:1"><div style="width:82%;background:rgba(13,148,136,.85);color:#fff;padding:.3rem .5rem;border-radius:.3rem;font-size:1rem">0,82</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 8rem;font-size:1.05rem">thành phố</div><div style="flex:1"><div style="width:9%;min-width:3.2rem;background:rgba(37,99,235,.8);color:#fff;padding:.3rem .5rem;border-radius:.3rem;font-size:1rem">0,09</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 8rem;font-size:1.05rem">một</div><div style="flex:1"><div style="width:5%;min-width:3.2rem;background:rgba(124,58,237,.8);color:#fff;padding:.3rem .5rem;border-radius:.3rem;font-size:1rem">0,05</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 8rem;font-size:1.05rem;opacity:.75">Huế</div><div style="flex:1"><div style="width:2%;min-width:3.2rem;background:rgba(220,38,38,.75);color:#fff;padding:.3rem .5rem;border-radius:.3rem;font-size:1rem">0,02</div></div></div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Mô hình lấy mẫu từ phân phối này rồi lặp lại cho token tiếp theo. <strong>Không có bước nào tra cứu xem điều sắp nói có đúng không</strong> — nhánh xác suất thấp vẫn có thể được chọn, và khi được chọn thì nó vẫn được viết trôi chảy như mọi nhánh khác.</div>
</div>
```

Ba hệ quả rút thẳng ra từ cơ chế này, và cả ba đều quan trọng với người làm giáo dục:

1. **Không có bước tra cứu.** Mô hình không mở một cơ sở dữ liệu để kiểm tra xem điều nó sắp nói có đúng không. Tri thức nằm rải trong trọng số dưới dạng quy luật thống kê, nên **câu trả lời đúng và câu bịa được sinh ra bằng đúng một quy trình**.
2. **Trôi chảy không phải chỉ báo của đúng.** Mục tiêu huấn luyện thưởng cho chuỗi có xác suất cao, tức là chuỗi *nghe giống văn bản người viết*. Một mệnh đề sai nhưng đúng văn phong học thuật vẫn có xác suất cao.
3. **Đầu ra phụ thuộc mạnh vào đầu vào.** Vì mọi thứ đều là điều kiện hoá trên chuỗi đứng trước, thay đổi cách đặt câu hỏi làm thay đổi phân phối đầu ra — đây là cơ sở kỹ thuật của việc thiết kế lời nhắc ở Bài 2.2.

> [!canh-bao] Sai lầm phổ biến nhất khi đưa mô hình vào dạy học là dùng nó như một cuốn bách khoa biết nói: hỏi năm ban hành một thông tư, hỏi số liệu thống kê, hỏi trích dẫn của một tác giả. Đây là **kiểu tác vụ mô hình yếu nhất**, vì nó đòi truy xuất chính xác từ một hệ vốn không truy xuất.

## Ba giai đoạn huấn luyện và điều chúng quyết định

| Giai đoạn | Làm gì | Quyết định điều gì | Hệ quả cho người dạy |
|---|---|---|---|
| Tiền huấn luyện | Dự đoán token tiếp theo trên khối văn bản khổng lồ | Vốn tri thức và năng lực ngôn ngữ nền | Lĩnh vực có nhiều văn bản chất lượng trên mạng thì mô hình mạnh; chương trình giáo dục Việt Nam ít văn bản số hoá nên mô hình yếu hơn hẳn ở đó |
| Tinh chỉnh có giám sát | Học từ các cặp yêu cầu — phản hồi mẫu do người viết | Dạng thức phản hồi: biết trả lời câu hỏi, biết làm theo chỉ dẫn | Đây là lý do mô hình trả lời theo cấu trúc bạn yêu cầu nếu bạn nói rõ cấu trúc |
| Học từ phản hồi của con người | Điều chỉnh theo mức độ ưa thích của người đánh giá | Giọng điệu, độ dài, mức an toàn, **và xu hướng chiều lòng người hỏi** | Mô hình có xu hướng đồng ý với người dùng — nguy hiểm khi học sinh khẳng định một điều sai rồi hỏi lại |

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:34rem;display:flex;align-items:stretch;gap:.4rem">
    <div style="flex:1;padding:.7rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.45rem;font-size:1.02rem;line-height:1.5"><strong>1 · Tiền huấn luyện</strong><br>khối văn bản khổng lồ<br><span style="opacity:.85">→ vốn tri thức nền</span></div>
    <div style="flex:0 0 auto;display:flex;align-items:center;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.45rem;font-size:1.02rem;line-height:1.5"><strong>2 · Tinh chỉnh có giám sát</strong><br>cặp yêu cầu – phản hồi mẫu<br><span style="opacity:.85">→ biết làm theo chỉ dẫn</span></div>
    <div style="flex:0 0 auto;display:flex;align-items:center;opacity:.5;font-size:1.3rem">→</div>
    <div style="flex:1;padding:.7rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.45rem;font-size:1.02rem;line-height:1.5"><strong>3 · Học từ phản hồi người</strong><br>theo mức độ ưa thích<br><span style="opacity:.85">→ giọng điệu <em>và</em> xu hướng chiều lòng</span></div>
  </div>
</div>
```

Xu hướng chiều lòng người hỏi ở giai đoạn ba đáng được nhấn mạnh trong bối cảnh giáo dục. Khi người học viết *em nghĩ đáp án là B, đúng không ạ*, mô hình chịu áp lực thống kê nghiêng về việc xác nhận. Thiết kế trợ giảng phải chống lại xu hướng ấy một cách chủ động — Bài 2.3 sẽ nói cách làm.

## Vì sao mô hình bịa, và bịa một cách trôi chảy

Trong tài liệu nghiên cứu, hiện tượng này gọi là **bịa đặt** (hallucination) và được chia làm hai loại:

- **Bịa nội tại**: đầu ra mâu thuẫn với chính nguồn đã được cung cấp trong ngữ cảnh — ví dụ tóm tắt một văn bản mà thêm chi tiết không có trong văn bản ấy.
- **Bịa ngoại lai**: đầu ra khẳng định điều không kiểm chứng được từ ngữ cảnh — ví dụ dẫn một nghiên cứu không tồn tại, kèm tên tác giả và năm nghe rất hợp lý.

Điểm mấu chốt về mặt kỹ thuật: **bịa đặt không phải một lỗi có thể vá**. Nó là hệ quả trực tiếp của mục tiêu huấn luyện — sinh chuỗi có xác suất cao — cộng với việc mô hình không có cơ chế nội tại để biết mình không biết. Vì vậy hai chiến lược sau **không** hiệu quả: dặn mô hình đừng bịa, và hỏi lại mô hình xem câu trả lời vừa rồi có đúng không (nó sẽ đánh giá bằng chính hệ đã sinh ra câu sai).

Ba chiến lược có hiệu quả, xếp theo mức độ mạnh:

| Chiến lược | Cách làm | Vì sao hiệu quả |
|---|---|---|
| Đưa nguồn vào ngữ cảnh | Dán chính văn bản gốc vào và yêu cầu chỉ trả lời dựa trên đó | Chuyển tác vụ từ nhớ lại sang đọc hiểu — kiểu tác vụ mô hình mạnh nhất |
| Bắt trích dẫn và định vị | Yêu cầu chỉ rõ câu nào trong nguồn cho phép kết luận | Làm cho việc kiểm tra của người rẻ đi rất nhiều |
| Kiểm chéo bằng nguồn ngoài | Người kiểm đối chiếu mọi dữ kiện có thể kiểm | Duy nhất chặn được bịa ngoại lai |

> [!ghi-nho] Quy tắc vận hành cho mọi ứng dụng giáo dục: **mọi dữ kiện kiểm được thì phải kiểm** — số liệu, năm, tên riêng, điều luật, trích dẫn. Phần không kiểm được (diễn đạt, gợi ý hoạt động, cách giải thích) mới là chỗ mô hình đóng góp thật.

## Bốn tham số vận hành người dạy cần biết

**Cửa sổ ngữ cảnh** là lượng token tối đa mô hình xử lý cùng lúc, gồm cả đầu vào lẫn đầu ra. Vượt quá thì phần đầu bị cắt. Trong ứng dụng dạy học, đây là ràng buộc thiết kế thật: một trợ giảng theo dõi cả học kỳ không thể nhét toàn bộ lịch sử vào ngữ cảnh — phải tóm tắt định kỳ hoặc lưu trạng thái người học ở ngoài mô hình, và **trạng thái ấy chính là mô hình người học ở Module 3**.

**Nhiệt độ** điều chỉnh độ phẳng của phân phối trước khi lấy mẫu: thấp thì mô hình luôn chọn phương án khả dĩ nhất, cao thì nó dám chọn phương án ít khả dĩ hơn. Nguyên tắc chọn:

| Loại tác vụ | Nhiệt độ | Lý do |
|---|---|---|
| Chấm bài theo tiêu chí, trích xuất dữ liệu, trả lời theo nguồn | Thấp | Cần ổn định và lặp lại được; sáng tạo ở đây là khuyết điểm |
| Gợi ý hoạt động dạy học, sinh nhiều phương án nhiễu cho câu hỏi | Cao hơn | Cần đa dạng để có cái chọn |

**Tra cứu bổ trợ**: thay vì trông vào trí nhớ của mô hình, hệ thống tìm các đoạn văn bản liên quan trong kho tài liệu của mình rồi đưa vào ngữ cảnh trước khi hỏi. Đây là kiến trúc chuẩn cho trợ giảng gắn với một giáo trình cụ thể, và nó chuyển bài toán về đúng chỗ mô hình mạnh: đọc hiểu tài liệu có sẵn.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Tra cứu bổ trợ — kiến trúc chuẩn cho trợ giảng gắn với một giáo trình</div>
  <div style="min-width:36rem;display:flex;align-items:center;gap:.35rem">
    <div style="flex:1;padding:.65rem .5rem;border:1px solid rgba(127,127,127,.35);border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Câu hỏi<br>của người học</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Tìm đoạn liên quan<br>trong giáo trình</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Ghép đoạn đó<br>vào ngữ cảnh</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Mô hình trả lời<br><strong>chỉ dựa trên đoạn đó</strong></div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(217,150,40,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Câu trả lời<br>kèm trích dẫn</div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">Kiến trúc này chuyển tác vụ từ <em>nhớ lại</em> sang <em>đọc hiểu</em> — kiểu tác vụ mô hình mạnh nhất — và để lại dấu vết cho người kiểm.</div>
</div>
```

**Tính không lặp lại**: cùng một câu hỏi có thể cho hai câu trả lời khác nhau. Với chấm bài, đây là vấn đề nghiêm trọng về công bằng — hai học sinh nộp bài giống nhau có thể nhận điểm khác nhau. Hệ quả bắt buộc: **mọi ứng dụng chấm điểm phải lưu lại đầu vào, phiên bản mô hình, tham số và đầu ra**, để khi có khiếu nại còn tái dựng được.

> [!meo] Khi thẩm định một sản phẩm AI giáo dục, bốn câu hỏi kỹ thuật đủ để phân biệt sản phẩm nghiêm túc với lớp vỏ mỏng: nó có nối với nguồn tài liệu cụ thể không, có buộc trích dẫn không, chạy ở nhiệt độ nào cho tác vụ chấm, và có lưu vết để tái dựng kết quả không.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Hỏi một mô hình ngôn ngữ ba câu về đúng lĩnh vực chuyên môn của bạn: một câu về dữ kiện kiểm được (số hiệu văn bản, năm ban hành), một câu yêu cầu trích dẫn nghiên cứu, một câu yêu cầu giải thích khái niệm. Kiểm từng câu trả lời với nguồn gốc và ghi lại: cái nào đúng, cái nào sai, và **cái sai nghe có tự tin bằng cái đúng không**.

### Nhóm 3–4 người (25 phút)

Mỗi nhóm nhận một tác vụ giáo dục có thật (chấm bài luận, sinh câu hỏi trắc nghiệm, giải thích lỗi sai cho học sinh, tóm tắt phản hồi của lớp). Quyết định và bảo vệ: nhiệt độ nào, có cần tra cứu bổ trợ không, cần lưu vết gì. Trình bày hai phút, nhóm khác phản biện bằng một tình huống hỏng.

### Bài tập về nhà — sản phẩm số (90 phút)

Dựng một **bảng đối chứng bịa đặt** cho lĩnh vực chuyên môn của bạn, dùng được như tài liệu tập huấn giáo viên.

1. Soạn 10 câu hỏi thuộc lĩnh vực bạn dạy, chia đều hai nhóm: nhóm hỏi dữ kiện kiểm được và nhóm hỏi giải thích khái niệm.
2. Hỏi cùng một mô hình, ghi nguyên văn câu trả lời.
3. Kiểm từng câu với nguồn gốc; ghi cột phán quyết: đúng, sai, hoặc không kiểm được.
4. Lặp lại **cùng một câu hỏi ba lần** cho ít nhất 3 câu và ghi lại mức độ khác nhau giữa các lần.
5. Kết bằng nửa trang: nhóm câu hỏi nào rủi ro hơn, và bạn khuyến nghị giáo viên dùng mô hình cho việc gì, không dùng cho việc gì.

**Cách làm (gợi ý từng bước):** làm bảng trên bảng tính với các cột *câu hỏi · loại · trả lời · nguồn đối chiếu · phán quyết · ghi chú*; chụp màn hình lưu nguyên văn để tránh sửa vô tình khi dán; ghi rõ tên và phiên bản mô hình cùng ngày hỏi, vì kết quả sẽ khác sau vài tháng.

**Chấm theo:** 10 câu chia đúng hai nhóm và thuộc chuyên môn thật (2đ) · đối chiếu nguồn nghiêm túc, có dẫn nguồn kiểm (4đ) · phần lặp lại ba lần có nhận xét về tính không ổn định (2đ) · khuyến nghị cuối cụ thể, dùng được cho giáo viên (2đ).

### Nguồn tham khảo

- Ji, Z., Lee, N., Frieske, R., và cộng sự (2023). Survey of hallucination in natural language generation. *ACM Computing Surveys*, 55(12), 1–38.
- Brown, T., và cộng sự (2020). Language models are few-shot learners. *NeurIPS 33*.
- Bender, E. M., Gebru, T., McMillan-Major, A., & Shmitchell, S. (2021). On the dangers of stochastic parrots. *FAccT '21*, 610–623.
- UNESCO (2023). *Guidance for generative AI in education and research.* — [unesco.org](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research)
""",
    "quiz": {
        "title": "Kiểm tra Bài 2.1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "2.1-co-che",
                "type": "mcq",
                "prompt": "Phát biểu nào mô tả đúng nhất việc một mô hình ngôn ngữ lớn làm khi trả lời câu hỏi?",
                "explanation": "Mô hình ước lượng phân phối xác suất của token tiếp theo và lấy mẫu, lặp lại. Không có bước tra cứu trong một kho sự thật — đó là lý do câu đúng và câu bịa ra đời bằng cùng một cơ chế.",
                "points": 2,
                "options": [
                    {"label": "Ước lượng xác suất của đơn vị văn bản tiếp theo rồi lấy mẫu, lặp lại nhiều lần", "isCorrect": True},
                    {"label": "Tra cứu trong cơ sở dữ liệu tri thức rồi diễn đạt lại kết quả", "isCorrect": False, "misconception": "cngdtt.llm-knows-truth"},
                    {"label": "So khớp câu hỏi với câu trả lời gần nhất đã thấy khi huấn luyện", "isCorrect": False},
                    {"label": "Suy luận logic từ một tập tiên đề đã được nạp sẵn", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-troi-chay",
                "type": "mcq",
                "prompt": "Vì sao một câu trả lời sai của mô hình thường nghe tự tin và đúng văn phong học thuật?",
                "explanation": "Mục tiêu huấn luyện thưởng cho chuỗi nghe giống văn bản người viết. Độ trôi chảy phản ánh xác suất ngôn ngữ, không phản ánh tính đúng đắn của nội dung.",
                "points": 2,
                "options": [
                    {"label": "Vì mô hình tối ưu cho chuỗi có xác suất ngôn ngữ cao, mà văn phong tự tin là văn phong phổ biến trong dữ liệu", "isCorrect": True},
                    {"label": "Vì mô hình cố tình che giấu chỗ nó không biết", "isCorrect": False},
                    {"label": "Vì dữ liệu huấn luyện có quá nhiều văn bản học thuật sai", "isCorrect": False},
                    {"label": "Vì nhiệt độ được đặt quá thấp", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-loai-tac-vu-yeu",
                "type": "mcq",
                "prompt": "Loại tác vụ nào mô hình ngôn ngữ yếu nhất, xét theo cơ chế hoạt động của nó?",
                "explanation": "Truy xuất chính xác một dữ kiện rời rạc — số hiệu văn bản, năm, trích dẫn — đòi hỏi khả năng truy xuất mà mô hình không có. Đọc hiểu văn bản đã cho trong ngữ cảnh mới là kiểu tác vụ nó mạnh.",
                "points": 2,
                "options": [
                    {"label": "Nhớ lại chính xác một dữ kiện rời rạc như số hiệu văn bản hay trích dẫn nghiên cứu", "isCorrect": True},
                    {"label": "Tóm tắt một văn bản được dán vào ngữ cảnh", "isCorrect": False},
                    {"label": "Diễn đạt lại một khái niệm cho phù hợp với trình độ người đọc", "isCorrect": False},
                    {"label": "Sinh nhiều phương án nhiễu cho một câu hỏi trắc nghiệm", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-ba-giai-doan",
                "type": "matching",
                "prompt": "Ghép mỗi giai đoạn huấn luyện với điều nó quyết định trong hành vi mô hình.",
                "explanation": "Ba giai đoạn quyết định ba lớp hành vi khác nhau; hiểu chúng giúp dự đoán mô hình sẽ hỏng ở đâu trong bối cảnh lớp học.",
                "points": 3,
                "pairs": [
                    {"left": "Tiền huấn luyện", "right": "Vốn tri thức nền và năng lực ngôn ngữ"},
                    {"left": "Tinh chỉnh có giám sát", "right": "Khả năng làm theo chỉ dẫn và trả lời đúng dạng thức yêu cầu"},
                    {"left": "Học từ phản hồi của con người", "right": "Giọng điệu, mức an toàn và xu hướng chiều lòng người hỏi"},
                ],
            },
            {
                "key": "2.1-chieu-long",
                "type": "mcq",
                "prompt": "Học sinh viết cho trợ giảng AI: em nghĩ đáp án là B, đúng không ạ — trong khi đáp án đúng là C. Rủi ro đặc thù ở đây bắt nguồn từ đâu?",
                "explanation": "Xu hướng chiều lòng người hỏi hình thành ở giai đoạn học từ phản hồi con người. Thiết kế trợ giảng phải chống lại nó một cách chủ động, ví dụ bằng chỉ dẫn hệ thống bắt kiểm tra lập luận trước khi xác nhận.",
                "points": 2,
                "options": [
                    {"label": "Xu hướng chiều lòng người hỏi hình thành trong giai đoạn học từ phản hồi của con người", "isCorrect": True},
                    {"label": "Cửa sổ ngữ cảnh quá nhỏ nên mô hình quên đề bài", "isCorrect": False},
                    {"label": "Nhiệt độ quá cao nên mô hình chọn phương án ít khả dĩ", "isCorrect": False},
                    {"label": "Không có rủi ro nào: mô hình luôn kiểm tra lại đáp án trước khi trả lời", "isCorrect": False, "misconception": "cngdtt.llm-knows-truth"},
                ],
            },
            {
                "key": "2.1-hai-loai-bia",
                "type": "mcq",
                "prompt": "Mô hình được yêu cầu tóm tắt một văn bản đã dán vào ngữ cảnh, nhưng bản tóm tắt thêm một chi tiết không có trong văn bản. Đây là loại bịa đặt nào?",
                "explanation": "Bịa nội tại: đầu ra mâu thuẫn hoặc vượt quá chính nguồn đã cung cấp. Bịa ngoại lai là khẳng định điều không kiểm chứng được từ ngữ cảnh, ví dụ dẫn một nghiên cứu không tồn tại.",
                "points": 2,
                "options": [
                    {"label": "Bịa nội tại", "isCorrect": True},
                    {"label": "Bịa ngoại lai", "isCorrect": False},
                    {"label": "Lỗi cửa sổ ngữ cảnh", "isCorrect": False},
                    {"label": "Lỗi bộ tách token", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-chien-luoc-vo-ich",
                "type": "mcq",
                "prompt": "Chiến lược nào KHÔNG hiệu quả để giảm bịa đặt?",
                "explanation": "Hỏi lại chính mô hình xem câu trả lời có đúng không dùng chính hệ đã sinh ra câu sai để thẩm định nó. Tương tự, dặn mô hình đừng bịa không thay đổi cơ chế sinh.",
                "points": 2,
                "options": [
                    {"label": "Hỏi lại mô hình xem câu trả lời vừa rồi có chính xác không", "isCorrect": True},
                    {"label": "Dán văn bản gốc vào ngữ cảnh và yêu cầu chỉ trả lời dựa trên đó", "isCorrect": False},
                    {"label": "Yêu cầu chỉ rõ câu nào trong nguồn cho phép kết luận", "isCorrect": False},
                    {"label": "Người kiểm đối chiếu mọi dữ kiện kiểm được với nguồn gốc", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-nhiet-do",
                "type": "mcq",
                "prompt": "Bạn xây một công cụ chấm bài tự luận theo tiêu chí. Nên đặt nhiệt độ thế nào và vì sao?",
                "explanation": "Nhiệt độ thấp để đầu ra ổn định và lặp lại được. Với chấm điểm, tính đa dạng của đầu ra là khuyết điểm về mặt công bằng chứ không phải ưu điểm.",
                "points": 2,
                "options": [
                    {"label": "Thấp, vì chấm điểm cần ổn định và tái lặp; đa dạng đầu ra ở đây gây bất công", "isCorrect": True},
                    {"label": "Cao, để mô hình nhận xét phong phú và sinh động hơn", "isCorrect": False},
                    {"label": "Cao, vì nhiệt độ cao làm mô hình thông minh hơn", "isCorrect": False},
                    {"label": "Không quan trọng, vì nhiệt độ chỉ ảnh hưởng tới độ dài câu trả lời", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-luu-vet",
                "type": "mcq",
                "prompt": "Vì sao hệ thống chấm bài bằng AI bắt buộc phải lưu đầu vào, phiên bản mô hình, tham số và đầu ra?",
                "explanation": "Vì đầu ra không lặp lại hoàn toàn: cùng một bài có thể nhận hai kết quả khác nhau. Khi có khiếu nại, chỉ bản lưu vết mới cho phép tái dựng và giải thích quyết định.",
                "points": 2,
                "options": [
                    {"label": "Vì đầu ra không hoàn toàn lặp lại, nên khi có khiếu nại phải tái dựng được quyết định", "isCorrect": True},
                    {"label": "Vì cần dữ liệu để huấn luyện lại mô hình", "isCorrect": False},
                    {"label": "Vì nhà cung cấp yêu cầu lưu lịch sử", "isCorrect": False},
                    {"label": "Không bắt buộc nếu mô hình đã đủ chính xác", "isCorrect": False, "misconception": "cngdtt.ai-output-unchecked"},
                ],
            },
            {
                "key": "2.1-tra-cuu-bo-tro",
                "type": "mcq",
                "prompt": "Trợ giảng cho một giáo trình cụ thể nên được thiết kế theo kiến trúc nào và vì sao?",
                "explanation": "Tìm các đoạn liên quan trong chính giáo trình rồi đưa vào ngữ cảnh trước khi hỏi. Kiến trúc này chuyển bài toán từ nhớ lại sang đọc hiểu — kiểu tác vụ mô hình mạnh nhất — và cho phép trích dẫn để kiểm.",
                "points": 2,
                "options": [
                    {"label": "Tra cứu đoạn liên quan trong giáo trình rồi đưa vào ngữ cảnh, buộc mô hình trả lời dựa trên đó", "isCorrect": True},
                    {"label": "Dựa hoàn toàn vào tri thức sẵn có trong trọng số của mô hình", "isCorrect": False, "misconception": "cngdtt.llm-knows-truth"},
                    {"label": "Tăng nhiệt độ để mô hình trả lời phong phú hơn", "isCorrect": False},
                    {"label": "Dặn mô hình chỉ nói những gì nó chắc chắn", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-token-tieng-viet",
                "type": "true_false",
                "prompt": "Cùng một nội dung, bản tiếng Việt thường tiêu tốn nhiều token hơn bản tiếng Anh, nên chạm giới hạn ngữ cảnh sớm hơn và tốn chi phí hơn.",
                "explanation": "Đúng: bộ tách token của phần lớn mô hình phổ biến được tối ưu cho tiếng Anh, nên tiếng Việt có dấu bị tách thành nhiều mảnh hơn. Đây là ràng buộc chi phí có thật khi triển khai ở Việt Nam.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-cua-so-ngu-canh",
                "type": "mcq",
                "prompt": "Một trợ giảng cần theo dõi người học suốt học kỳ. Vì sao không thể chỉ nhét toàn bộ lịch sử vào ngữ cảnh, và giải pháp là gì?",
                "explanation": "Cửa sổ ngữ cảnh hữu hạn và chi phí tăng theo độ dài. Giải pháp là lưu trạng thái người học ở ngoài mô hình rồi nạp phần liên quan — chính là mô hình người học ở Module 3.",
                "points": 2,
                "options": [
                    {"label": "Cửa sổ ngữ cảnh hữu hạn, nên phải lưu trạng thái người học ở ngoài và chỉ nạp phần liên quan", "isCorrect": True},
                    {"label": "Vì mô hình sẽ quên phần đầu một cách ngẫu nhiên không kiểm soát được", "isCorrect": False},
                    {"label": "Vì lịch sử dài làm nhiệt độ tăng", "isCorrect": False},
                    {"label": "Có thể nhét toàn bộ, chỉ cần chọn mô hình có cửa sổ đủ lớn", "isCorrect": False},
                ],
            },
            {
                "key": "2.1-tham-dinh-san-pham",
                "type": "ordering",
                "prompt": "Sắp xếp bốn câu hỏi kỹ thuật khi thẩm định một sản phẩm AI giáo dục theo thứ tự loại trừ nhanh nhất.",
                "explanation": "Bắt đầu từ nguồn tri thức — nếu sản phẩm không nối với tài liệu nào thì mọi câu sau đều thứ yếu. Rồi tới khả năng kiểm, tính ổn định của tác vụ chấm, và cuối cùng là lưu vết.",
                "points": 3,
                "sequence": [
                    "Sản phẩm có nối với một nguồn tài liệu cụ thể không, hay chỉ dựa vào trí nhớ mô hình",
                    "Đầu ra có trích dẫn và định vị được trong nguồn để người kiểm đối chiếu không",
                    "Tác vụ chấm điểm chạy ở chế độ ổn định tới mức nào",
                    "Hệ thống có lưu vết đủ để tái dựng một quyết định khi bị khiếu nại không",
                ],
            },
            {
                "key": "2.1-viet-luan-gioi-han",
                "type": "essay",
                "prompt": "Chọn một tác vụ dạy học cụ thể trong chuyên môn của bạn. Viết 250–350 từ lập luận: tác vụ ấy nên hay không nên giao cho mô hình ngôn ngữ, dựa trên cơ chế hoạt động đã học; nếu nên thì cần thiết kế những ràng buộc kỹ thuật nào để kiểm soát rủi ro bịa đặt.",
                "points": 5,
            },
        ],
    },
}

# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.3 · Tập trung sâu: đa nhiệm, khung giờ vàng và nói không",
    "durationMin": 50,
    "description": "Chi phí thật của đa nhiệm và gián đoạn; cách đặt khung giờ vàng cho việc khó; trì hoãn nhìn từ góc cảm xúc thay vì ý chí; và công thức nói không giữ được quan hệ.",
    "objectives": [
        "Giải thích được vì sao đa nhiệm làm giảm hiệu suất tổng thể",
        "Đặt được khung giờ vàng cho nhiệm vụ quan trọng và bảo vệ được khung giờ đó",
        "Chọn được kỹ thuật phù hợp để bắt đầu một việc đang bị trì hoãn",
        "Nói không theo công thức ba phần mà không làm hỏng quan hệ",
    ],
    "summary": [
        "Não chuyển qua lại giữa các việc chứ không chạy song song; mỗi lần chuyển tốn chi phí khởi động lại, nên đa nhiệm làm tổng thời gian dài hơn và lỗi nhiều hơn.",
        "Khung giờ vàng là khoảng bạn tỉnh táo nhất trong ngày, được cấp cho việc khó nhất — chứ không phải cho việc dễ trả lời nhất.",
        "Trì hoãn phần lớn là né cảm xúc khó chịu gắn với nhiệm vụ, nên cách chữa là làm rõ và thu nhỏ bước đầu tiên, không phải tự trách.",
        "Nói không có ba phần: ghi nhận, lý do ngắn gắn với cam kết đang có, và phương án thay thế nếu có.",
    ],
    "body": r"""
Có kế hoạch rồi vẫn có thể không làm được gì — vì kế hoạch giả định bạn có những khối thời gian tập trung, mà thứ đó ngày nay phải giành lấy chứ không tự có.

## Đa nhiệm: cái giá không nhìn thấy

Bộ não không chạy hai nhiệm vụ đòi hỏi suy nghĩ cùng lúc; nó **chuyển qua lại** rất nhanh. Mỗi lần chuyển có ba khoản chi phí:

- **Chi phí khởi động lại.** Quay lại việc cũ, bạn phải nạp lại ngữ cảnh: đang ở đâu, định làm gì tiếp.
- **Dư âm chú ý.** Một phần đầu vẫn còn bận với việc vừa rời đi, nên chất lượng của việc đang làm giảm.
- **Tăng lỗi.** Lỗi phát hiện muộn lại tốn thêm thời gian sửa, thường nhiều hơn phần tưởng là tiết kiệm được.

Nghiên cứu về gián đoạn tại nơi làm việc cho thấy sau một lần bị ngắt quãng, người ta cần một khoảng đáng kể mới quay lại được mạch cũ — và điều đáng chú ý là họ thường **làm bù cho nhanh**, tức là làm nhanh hơn nhưng căng thẳng hơn.

> [!vi-du] Minh vừa làm bài tập lớn vừa để mở nhóm chat và thỉnh thoảng trả lời. Bạn ấy thấy mình vẫn làm được bài, chỉ hơi chậm. Thử đo một lần: cùng loại bài, một buổi làm xen kẽ và một buổi tắt thông báo. Kết quả thường gặp là buổi tập trung xong sớm hơn khoảng một phần ba, và số lỗi phải sửa lại ít hơn hẳn. Cảm giác "vẫn ổn" không phải thước đo — thời gian thật mới là.

## Khung giờ vàng

Mỗi người có vài giờ trong ngày mà đầu óc sắc nhất. Với nhiều người là buổi sáng, với một số là đêm khuya. Nguyên tắc chỉ có một: **cấp khung giờ ấy cho việc khó nhất và quan trọng nhất, không phải cho việc dễ trả lời nhất**.

Cái bẫy phổ biến là mở email và tin nhắn ngay đầu giờ vàng. Trả lời tin nhắn cho cảm giác hoàn thành ngay lập tức, nên nó rất hấp dẫn — và nó ăn hết đúng phần thời gian mà việc khó cần.

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.7rem">Một ngày được chia khối, thay vì một danh sách việc</div>
  <div style="display:grid;gap:.4rem;font-size:1.05rem">
    <div style="background:rgba(13,148,136,.16);border-left:4px solid rgba(13,148,136,.7);border-radius:.35rem;padding:.55rem .8rem"><b>8h30–10h00 · Khung giờ vàng</b> — việc khó nhất trong ngày. Thông báo tắt, điện thoại úp xuống, chỉ mở đúng tài liệu đang cần</div>
    <div style="background:rgba(59,130,246,.14);border-radius:.35rem;padding:.55rem .8rem"><b>10h00–10h15</b> — nghỉ thật: đứng dậy, rời màn hình</div>
    <div style="background:rgba(139,92,246,.14);border-radius:.35rem;padding:.55rem .8rem"><b>10h15–11h30</b> — việc cần suy nghĩ vừa phải: đọc tài liệu, chuẩn bị slide</div>
    <div style="background:rgba(217,150,40,.14);border-radius:.35rem;padding:.55rem .8rem"><b>13h30–14h00 · Khung trả lời</b> — gom toàn bộ tin nhắn, email, việc vặt vào đây</div>
    <div style="background:rgba(127,127,127,.12);border-radius:.35rem;padding:.55rem .8rem"><b>16h00–16h15 · Rà soát</b> — đóng ngày: việc gì xong, việc gì chuyển sang mai, ba việc quan trọng nhất của mai</div>
  </div>
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);margin-top:.8rem;line-height:1.6">Điểm mấu chốt không phải khung giờ đẹp mà là <b>khung trả lời</b>: gom việc vặt vào một hoặc hai khoảng cố định, rồi nói trước cho nhóm biết bạn trả lời vào lúc nào. Người ta chấp nhận chờ ba tiếng, miễn là biết trước.</div>
</div>
```

> [!meo] Với gián đoạn từ tin nhắn công việc, giải pháp không phải là biến mất mà là **thoả thuận thời gian phản hồi**. Một câu nhắn cho nhóm — "mình tập trung làm phần này tới 11h30, có gì mình trả lời hết vào 13h30, gấp thì gọi điện" — vừa bảo vệ khối tập trung vừa giữ được sự tin cậy.

## Trì hoãn không phải là lười

Nếu trì hoãn chỉ là lười, người ta đã không dọn nhà sạch bong vào đúng đêm trước hạn nộp. Điều thật sự xảy ra: nhiệm vụ gợi lên một cảm giác khó chịu — mơ hồ không biết bắt đầu từ đâu, sợ làm ra thứ dở, chán, hoặc sợ bị đánh giá — và ta né cảm giác ấy bằng cách làm việc khác. Vì vậy cách chữa nằm ở chỗ **giảm cảm giác khó chịu ở bước đầu tiên**, không nằm ở chỗ tự mắng.

| Nguyên nhân | Nghe như thế nào | Cách vào việc |
|---|---|---|
| Mơ hồ | "Không biết bắt đầu từ đâu" | Viết ra bước đầu tiên nhỏ tới mức làm xong trong hai phút: mở file, đặt tên, viết một dòng tiêu đề |
| Sợ làm dở | "Phải làm cho ra hồn mới bắt đầu" | Hẹn giờ 25 phút, cho phép mình làm ra bản nháp xấu; sửa là việc của lượt sau |
| Quá lớn | "Cái này ngốn cả tuần" | Chia tới đơn vị làm được trong một buổi; ghi hạn cho từng phần |
| Chán | "Việc này chẳng thú vị gì" | Ghép với thứ dễ chịu (quán quen, nhạc không lời) và đặt phần thưởng nhỏ sau khi xong khối |

Hai kỹ thuật đáng dùng nhất: **quy tắc hai phút** (nếu bước đầu tiên mất dưới hai phút thì làm ngay, đừng ghi vào danh sách) và **Pomodoro** (25 phút làm, 5 phút nghỉ, không kiểm tra gì trong 25 phút ấy). Cả hai đều tấn công đúng chỗ: rào cản không nằm ở việc làm, nằm ở việc **bắt đầu**.

> [!vi-du] Hân trì hoãn viết báo cáo thực tập ba tuần. Bước đầu tiên bạn tự đặt ban đầu là "viết báo cáo" — quá lớn, nên tuần nào cũng trượt. Bản thu nhỏ: "mở file mới, dán vào đó đề mục do nơi thực tập yêu cầu, viết một câu cho mục Giới thiệu." Mất bốn phút. Sau khi mở được file, Hân viết tiếp 40 phút — không phải vì đột nhiên có động lực, mà vì phần khó nhất, tức là bắt đầu, đã qua.

## Nói không đúng cách

Nói không là kỹ năng quản lý thời gian vì mỗi lời đồng ý là một khoản rút từ quỹ 168 giờ, và quỹ ấy đã có chủ. Nhận bừa rồi trễ hạn làm mất lòng tin nhiều hơn hẳn một lời từ chối rõ ràng.

Công thức ba phần, dùng được cho hầu hết tình huống:

1. **Ghi nhận** — cho thấy bạn đã nghe và hiểu đề nghị: "Dự án này nghe hay đấy, cảm ơn cậu đã nghĩ tới mình."
2. **Từ chối kèm lý do ngắn, gắn với cam kết đang có** — không bịa lý do, không kể lể: "Tháng này mình đang nhận phần dữ liệu cho đồ án và ca làm thêm, nhận thêm là mình làm hỏng cả hai."
3. **Phương án thay thế nếu có** — không bắt buộc: "Nếu tới tháng sau vẫn cần thì gọi mình, hoặc mình giới thiệu bạn Nam đang muốn làm mảng này."

> [!canh-bao] Ba lỗi hay gặp: xin lỗi quá nhiều (làm lời từ chối trông như còn thương lượng được), bịa lý do (rồi lộ), và trả lời ngay lập tức khi chưa kịp xem lịch. Với đề nghị lớn, câu an toàn nhất là: "Cho mình xem lại lịch, chiều nay mình trả lời cậu" — rồi trả lời đúng hẹn.

## Luyện tập và tài liệu tham khảo

### Cá nhân (15 phút)

Xác định khung giờ vàng của bạn bằng dữ liệu chứ không bằng cảm giác: nhớ lại ba lần gần nhất bạn làm việc trôi chảy nhất, ghi giờ. Đặt một khung giờ vàng cho tuần tới, ghi vào lịch như một cuộc hẹn, kèm tên việc cụ thể sẽ làm. Viết luôn câu nhắn bạn sẽ gửi cho nhóm về thời gian phản hồi của mình.

### Nhóm 3–4 người (25 phút)

Đóng vai nói không, ba lượt đổi vai: (1) bạn cùng lớp nhờ làm hộ phần việc nhóm; (2) câu lạc bộ mời nhận thêm một ban; (3) người quen nhờ việc gấp trong đúng khung giờ vàng của bạn. Người đóng vai từ chối phải dùng đủ ba phần của công thức. Người còn lại chấm: có ghi nhận không, lý do có ngắn và thật không, có bịa hay xin lỗi lê thê không.

### Bài tập về nhà (45–60 phút)

Chạy một tuần theo khối thời gian: mỗi ngày một khung giờ vàng và một khung trả lời. Ghi lại mỗi ngày hai dòng — khung giờ vàng có được bảo vệ không, nếu không thì bị phá bởi cái gì. Cuối tuần viết nửa trang: tỉ lệ ngày giữ được khung; kẻ phá khung phổ biến nhất; và một thay đổi cụ thể cho tuần sau (đổi giờ, đổi chỗ ngồi, đổi thoả thuận với nhóm).

### Xem thêm

- 🎬 [Inside the Mind of a Master Procrastinator](https://www.youtube.com/watch?v=arj7oStGLkU) — Tim Urban, TED, 14 phút. Mô tả cơ chế trì hoãn từ bên trong, và phần cuối nói về loại trì hoãn không có hạn chót — loại nguy hiểm hơn nhiều.
- 🎬 [How to Gain Control of Your Free Time](https://www.youtube.com/watch?v=n3kNlFMXslo) — Laura Vanderkam, TED, 11 phút.

### Nguồn tham khảo

- Mark, G., Gudith, D., & Klocke, U. (2008). The cost of interrupted work: More speed and stress. *Proceedings of CHI 2008*, 107–110.
- Rubinstein, J. S., Meyer, D. E., & Evans, J. E. (2001). Executive control of cognitive processes in task switching. *Journal of Experimental Psychology: Human Perception and Performance*, 27(4), 763–797.
- Steel, P. (2007). The nature of procrastination: A meta-analytic and theoretical review. *Psychological Bulletin*, 133(1), 65–94.
- Sirois, F., & Pychyl, T. (2013). Procrastination and the priority of short-term mood regulation. *Social and Personality Psychology Compass*, 7(2), 115–127.
- Newport, C. (2016). *Deep Work: Rules for Focused Success in a Distracted World.* New York: Grand Central Publishing.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.3-da-nhiem",
                "type": "mcq",
                "prompt": "Vì sao đa nhiệm thường làm giảm hiệu suất tổng thể?",
                "explanation": "Não chuyển qua lại giữa các nhiệm vụ chứ không chạy song song; mỗi lần chuyển tốn chi phí nạp lại ngữ cảnh, để lại dư âm chú ý và làm tăng lỗi.",
                "points": 2,
                "options": [
                    {"label": "Vì não chuyển qua lại giữa các việc chứ không chạy song song, mỗi lần chuyển đều tốn chi phí khởi động lại và làm tăng lỗi", "isCorrect": True},
                    {"label": "Vì làm nhiều việc cùng lúc khiến ta mệt nhanh hơn, còn hiệu suất thì không đổi", "isCorrect": False, "misconception": "knm.multitask-efficient"},
                    {"label": "Vì đa nhiệm chỉ phù hợp với người có kinh nghiệm lâu năm", "isCorrect": False, "misconception": "knm.multitask-efficient"},
                    {"label": "Không đúng — đa nhiệm giúp tận dụng thời gian chết giữa các việc", "isCorrect": False, "misconception": "knm.multitask-efficient"},
                ],
            },
            {
                "key": "4.3-khung-gio-vang",
                "type": "mcq",
                "prompt": "Vì sao thiết lập khung giờ vàng cho nhiệm vụ quan trọng lại hiệu quả?",
                "explanation": "Khung giờ vàng là lúc ta tỉnh táo nhất; dành nó cho việc khó nhất và chặn gián đoạn giúp giữ được khối tập trung liền mạch — thứ mà việc khó bắt buộc phải có.",
                "points": 2,
                "options": [
                    {"label": "Vì nó ghép lúc đầu óc sắc nhất với việc khó nhất, và bảo vệ được một khối thời gian liền mạch không bị ngắt quãng", "isCorrect": True},
                    {"label": "Vì làm việc vào buổi sáng luôn hiệu quả hơn với mọi người", "isCorrect": False},
                    {"label": "Vì nó giúp ta trả lời tin nhắn nhanh hơn trong ngày", "isCorrect": False, "misconception": "knm.always-available"},
                    {"label": "Vì nó khiến ta làm được nhiều việc cùng lúc hơn", "isCorrect": False, "misconception": "knm.multitask-efficient"},
                ],
            },
            {
                "key": "4.3-gian-doan-tin-nhan",
                "type": "mcq",
                "prompt": "Bạn liên tục bị tin nhắn công việc làm gián đoạn khi đang tập trung. Giải pháp phù hợp nhất là gì?",
                "explanation": "Không phải biến mất, cũng không phải trả lời tức thì: thoả thuận trước khung giờ phản hồi rồi tắt thông báo giữa các khung, và chừa một kênh cho việc thật sự gấp.",
                "points": 3,
                "options": [
                    {"label": "Nhắn cho nhóm biết mình trả lời vào khung giờ cố định, tắt thông báo giữa các khung, và chừa một kênh riêng cho việc thật gấp", "isCorrect": True},
                    {"label": "Trả lời ngay mọi tin nhắn để thể hiện tinh thần trách nhiệm", "isCorrect": False, "misconception": "knm.always-available"},
                    {"label": "Tắt hết thông báo và không báo cho ai biết", "isCorrect": False, "misconception": "knm.channel-default"},
                    {"label": "Vừa làm vừa trả lời, dần dần sẽ quen", "isCorrect": False, "misconception": "knm.multitask-efficient"},
                ],
            },
            {
                "key": "4.3-tri-hoan",
                "type": "mcq",
                "prompt": "Bạn đã trì hoãn viết báo cáo thực tập ba tuần. Cách vào việc hiệu quả nhất là gì?",
                "explanation": "Rào cản nằm ở việc bắt đầu, nên hãy thu nhỏ bước đầu tiên tới mức làm xong trong vài phút; động lực thường đến sau khi đã bắt đầu chứ không đến trước.",
                "points": 3,
                "options": [
                    {"label": "Thu nhỏ bước đầu tiên tới mức làm xong trong vài phút: mở file, dán đề mục, viết một câu cho phần giới thiệu", "isCorrect": True},
                    {"label": "Tự đặt hình phạt nghiêm khắc nếu tuần này vẫn chưa viết xong", "isCorrect": False, "misconception": "knm.procrastination-lazy"},
                    {"label": "Đợi tới sát hạn để có áp lực rồi viết một mạch", "isCorrect": False, "misconception": "knm.procrastination-lazy"},
                    {"label": "Lập một kế hoạch thật chi tiết cho toàn bộ báo cáo trước khi viết dòng nào", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-noi-khong",
                "type": "mcq",
                "prompt": "Bạn được nhờ nhận thêm một phần việc trong khi đang kín cam kết. Cách nói không phù hợp nhất là gì?",
                "explanation": "Công thức ba phần: ghi nhận đề nghị, nêu lý do ngắn gắn với cam kết đang có, và đề xuất phương án thay thế nếu có — không bịa lý do, không xin lỗi lê thê.",
                "points": 2,
                "options": [
                    {"label": "Cảm ơn vì được nghĩ tới, nói rõ tháng này mình đã cam kết những gì và nhận thêm là hỏng cả hai, rồi gợi ý một người hoặc một thời điểm khác", "isCorrect": True},
                    {"label": "Nhận lời trước đã, tính sau, vì từ chối thì ngại", "isCorrect": False, "misconception": "knm.saying-no-rude"},
                    {"label": "Nói bận mà không giải thích gì thêm, cho nhanh gọn", "isCorrect": False, "misconception": "knm.assertive-is-aggressive"},
                    {"label": "Bịa một lý do nghe hợp lý để người ta khỏi hỏi thêm", "isCorrect": False, "misconception": "knm.saying-no-rude"},
                ],
            },
            {
                "key": "4.3-noi-nguyen-nhan-tri-hoan",
                "type": "matching",
                "prompt": "Nối mỗi nguyên nhân trì hoãn với cách vào việc phù hợp.",
                "explanation": "Mỗi nguyên nhân gây ra một loại khó chịu khác nhau nên cần một cách gỡ khác nhau — dùng sai cách thì vẫn tắc.",
                "points": 3,
                "pairs": [
                    {"left": "Không biết bắt đầu từ đâu", "right": "Viết ra bước đầu tiên nhỏ tới mức làm xong trong hai phút"},
                    {"left": "Sợ làm ra thứ dở", "right": "Hẹn giờ 25 phút và cho phép mình làm bản nháp xấu"},
                    {"left": "Nhiệm vụ quá lớn", "right": "Chia tới đơn vị làm được trong một buổi, mỗi phần một hạn"},
                ],
            },
            {
                "key": "4.3-viet-khung-gio",
                "type": "essay",
                "prompt": "Viết 150–250 từ: (a) khung giờ vàng của bạn là khoảng nào, dựa trên bằng chứng gì; (b) việc cụ thể bạn sẽ đặt vào khung đó tuần tới; (c) câu nhắn bạn sẽ gửi cho nhóm về thời gian phản hồi, viết nguyên văn; (d) hai thứ nhiều khả năng sẽ phá khung giờ đó và cách bạn định xử lý.",
                "points": 5,
            },
        ],
    },
}

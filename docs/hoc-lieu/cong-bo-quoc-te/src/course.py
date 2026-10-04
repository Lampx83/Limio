# -*- coding: utf-8 -*-
"""Phần khung của khoá NCKH nâng cao & Công bố quốc tế: mô tả, danh sách lỗi
tư duy, lời phản hồi.

Khoá gồm 1 module, 7 bài, dành cho **nghiên cứu sinh** — khác với khoá Phương
pháp nghiên cứu & Viết luận văn (học viên cao học, đích là một luận văn) và
khoá Nhập môn NCKH (SV đại học). Đích của khoá này không phải một luận văn mà
một hoặc nhiều **bài báo công bố quốc tế**, đặt trong một research agenda dài
hơi: định vị nghiên cứu và đóng góp → tổng quan hệ thống đầy đủ (PRISMA, thẩm
định chất lượng nguồn) → phương pháp nâng cao (multi-group, thiết kế thực
nghiệm) → viết bài báo IMRaD bằng tiếng Anh và trả lời phản biện → chọn venue
và tránh tạp chí săn mồi → dùng AI hỗ trợ viết có kiểm soát → viết đề xuất xin
tài trợ và networking học thuật.

Danh sách lỗi tư duy dưới đây lớn dần theo từng bài được soạn. Mã đặt tiền tố
`cbqt.` để không đụng mã của khoá khác trong cùng DB (Phương pháp nghiên cứu
dùng `ppnc.`, Nhập môn NCKH dùng `nckh.`, Kỹ năng mềm dùng `knm.`).
"""

COURSE = {
    "title": "NCKH 301 · NCKH nâng cao & Công bố quốc tế",
    "slug": "cong-bo-quoc-te",
    "description": (
        "Khoá dành cho nghiên cứu sinh đang xây dựng một mạch nghiên cứu (research agenda) hướng "
        "tới công bố quốc tế, không phải một luận văn đơn lẻ. Bảy bài đi từ định vị nghiên cứu và "
        "xác định đóng góp lý thuyết; tổng quan tài liệu hệ thống đầy đủ theo PRISMA kèm thẩm định "
        "chất lượng nguồn; phương pháp nghiên cứu nâng cao (multi-group analysis, thiết kế thực "
        "nghiệm, longitudinal); viết bài báo khoa học theo cấu trúc IMRaD bằng tiếng Anh và trả "
        "lời phản biện (rebuttal) đúng cách; chọn tạp chí theo quartile Scopus/SCImago và nhận "
        "diện tạp chí săn mồi; dùng công cụ AI hỗ trợ viết có kiểm soát và khai báo đúng quy định; "
        "và viết đề xuất xin tài trợ, xây mạng lưới học thuật quốc tế. "
        "Khoá dùng đúng đề tài nghiên cứu và bản thảo bài báo thật của từng nghiên cứu sinh xuyên "
        "suốt cả 7 bài. Mỗi bài kết bằng một bài kiểm tra ngắn, phương án sai gắn mã lỗi tư duy để "
        "phản hồi chỉ đúng chỗ hiểu nhầm."
    ),
    "language": "vi",
    "level": "advanced",
    "category": "Nghiên cứu khoa học",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Bài 1 · Định vị nghiên cứu và xác định đóng góp ──────────────────────
    {
        "code": "cbqt.single-paper-thinking",
        "name": "Coi mỗi bài báo là một dự án độc lập, không nối vào research agenda",
        "description": (
            "Chọn đề tài cho từng bài báo theo trào lưu hoặc cơ hội dữ liệu có sẵn, không hỏi đề "
            "tài đó nối với những gì đã và sẽ làm ra sao. Kết quả là một danh mục công bố rời rạc, "
            "không cộng dồn thành một câu chuyện chuyên môn nhất quán."
        ),
    },
    {
        "code": "cbqt.contribution-is-novelty-only",
        "name": "Coi đóng góp lý thuyết chỉ cần 'chưa ai làm'",
        "description": (
            "Dừng lại ở tuyên bố 'chưa có nghiên cứu nào về điều này' mà không nói rõ nghiên cứu "
            "thay đổi gì trong cách hiểu lý thuyết hiện có. Ở mức công bố quốc tế, đóng góp lý "
            "thuyết cần nêu cụ thể nó thách thức, mở rộng hay tích hợp lý thuyết nào."
        ),
    },
    {
        "code": "cbqt.no-so-what-test",
        "name": "Không kiểm tra độ sâu đóng góp bằng bài tập 'So what?'",
        "description": (
            "Chấp nhận một câu trả lời hời hợt cho 'đóng góp là gì' mà không tự hỏi tiếp 'so "
            "what?' để đào sâu. Một đóng góp chỉ dừng ở 'vì nó mới' sau nhiều lần tự hỏi là dấu "
            "hiệu chưa đủ sâu để định hướng một bài báo."
        ),
    },
    # ── Bài 2 · Tổng quan tài liệu hệ thống đầy đủ ───────────────────────────
    {
        "code": "cbqt.eligibility-criteria-after-search",
        "name": "Đặt tiêu chí chọn/loại sau khi đã xem kết quả tìm kiếm",
        "description": (
            "Xác định tiêu chí chọn/loại nguồn sau khi đã xem qua nội dung các nghiên cứu tìm "
            "được, thay vì xác định trước theo khung PICOS. Đây là một dạng thiên lệch xác nhận — "
            "tiêu chí bị chọn sao cho vừa khớp với điều mình muốn tìm thấy."
        ),
    },
    {
        "code": "cbqt.no-quality-appraisal",
        "name": "Không thẩm định chất lượng phương pháp của nguồn trước khi tổng hợp",
        "description": (
            "Đưa mọi nguồn tìm được vào tổng hợp mà coi chúng có giá trị ngang nhau, không dùng "
            "công cụ thẩm định chất lượng phù hợp (Cochrane Risk of Bias, MMAT, CASP...). Điều này "
            "làm loãng chất lượng của toàn bộ tổng quan."
        ),
    },
    {
        "code": "cbqt.meta-analysis-forced",
        "name": "Cố gộp số liệu bằng meta-analysis khi các nghiên cứu không đủ đồng nhất",
        "description": (
            "Chạy meta-analysis dù chỉ số I² cao (các nghiên cứu đo khác thang đo, khác định nghĩa "
            "biến, hoặc quá khác biệt), tạo ra một con số gộp không có ý nghĩa thật dù về mặt tính "
            "toán vẫn ra được kết quả. Khi không đủ đồng nhất, tổng hợp tường thuật là lựa chọn "
            "đúng, không phải lựa chọn kém hơn."
        ),
    },
    # ── Bài 3 · Phương pháp nghiên cứu nâng cao ──────────────────────────────
    {
        "code": "cbqt.mediation-moderation-separate",
        "name": "Chạy riêng mediation và moderation khi lý thuyết đề xuất moderated mediation",
        "description": (
            "Kiểm định một hiệu ứng trung gian và một hiệu ứng điều tiết bằng hai mô hình riêng "
            "biệt, dù lý thuyết thực chất đề xuất hiệu ứng trung gian thay đổi theo mức của biến "
            "điều tiết. Cách này làm mất thông tin về việc hiệu ứng trung gian mạnh hay yếu ở điều "
            "kiện nào."
        ),
    },
    {
        "code": "cbqt.compare-groups-no-invariance",
        "name": "So sánh path coefficient giữa các nhóm mà không kiểm đo lường bất biến",
        "description": (
            "So sánh trực tiếp hệ số đường dẫn giữa các nhóm (ví dụ nam/nữ) trong multi-group "
            "analysis mà chưa kiểm configural và metric invariance. Nếu thang đo không đo cùng một "
            "cách giữa các nhóm, sự khác biệt về path có thể do khác biệt đo lường, không phải "
            "khác biệt thật."
        ),
    },
    {
        "code": "cbqt.no-manipulation-check",
        "name": "Không kiểm tra manipulation check trong thiết kế thực nghiệm",
        "description": (
            "Đọc thẳng kết quả biến phụ thuộc trong một thí nghiệm mà không xác nhận can thiệp có "
            "thực sự tạo ra sự khác biệt ở biến độc lập như dự kiến. Nếu manipulation thất bại, "
            "một kết quả không có ý nghĩa có thể do manipulation yếu, không phải do lý thuyết sai."
        ),
    },
    {
        "code": "cbqt.two-wave-enough-for-causality",
        "name": "Coi hai lần đo là đủ để khẳng định nhân quả hoàn toàn",
        "description": (
            "Kết luận nhân quả chắc chắn chỉ vì đã đo hai lần theo thời gian (T1, T2) và thấy X "
            "dự báo Y có ý nghĩa thống kê. Trình tự thời gian là điều kiện cần nhưng chưa đủ — các "
            "yếu tố gây nhiễu không được kiểm soát vẫn có thể tạo ra mối quan hệ giả."
        ),
    },
    # ── Bài 4 · Viết bài báo khoa học tiếng Anh và trả lời phản biện ─────────
    {
        "code": "cbqt.imrad-same-as-thesis",
        "name": "Viết bài báo như bản thu gọn của luận văn 5 chương",
        "description": (
            "Chép và cắt gọn nguyên cấu trúc, nội dung luận văn để thành bài báo, thay vì viết lại "
            "theo logic IMRaD súc tích. Introduction của bài báo cần cấu trúc hình nón riêng, khác "
            "với cách mở đầu dàn trải của một luận văn."
        ),
    },
    {
        "code": "cbqt.overclaim-in-english",
        "name": "Dùng ngôn ngữ tiếng Anh quá mạnh so với độ mạnh của thiết kế",
        "description": (
            "Viết 'demonstrates', 'proves', 'causes' cho kết quả từ một thiết kế cắt ngang hoặc "
            "tương quan, khi thiết kế đó chỉ cho phép nói về sự liên hệ. Mức hedging tiếng Anh "
            "phải khớp với độ mạnh thật của bằng chứng, không phải mức độ mong muốn của tác giả."
        ),
    },
    {
        "code": "cbqt.no-comparison-to-literature",
        "name": "Viết Discussion không đối chiếu với tài liệu đã tổng quan",
        "description": (
            "Diễn giải từng kết quả một cách cô lập, chỉ lặp lại số liệu đã có ở Results, không "
            "đối chiếu với các nghiên cứu đã nêu ở Introduction/Literature Review — đồng thuận ở "
            "đâu, mâu thuẫn ở đâu, và vì sao."
        ),
    },
    {
        "code": "cbqt.rebuttal-defensive",
        "name": "Viết rebuttal letter phòng thủ hoặc bỏ qua comment khó",
        "description": (
            "Tranh luận bảo vệ bản thảo gốc bằng mọi giá, hoặc phớt lờ những comment khó chịu của "
            "reviewer, thay vì ghi nhận và nêu hành động cụ thể đã thực hiện. Reviewer đọc rebuttal "
            "để xem tác giả có tiếp thu góp ý nghiêm túc không, không phải để xem ai đúng ai sai."
        ),
    },
    # ── Bài 5 · Chọn venue và quy trình xuất bản ──────────────────────────────
    {
        "code": "cbqt.quartile-only-no-scope",
        "name": "Chọn tạp chí chỉ theo quartile cao nhất, không xét scope",
        "description": (
            "Gửi bài tới tạp chí có quartile cao nhất tìm được mà không đọc Aims & Scope hoặc đối "
            "chiếu với đóng góp của bài. Quartile cao nhưng sai phạm vi chủ đề thường dẫn tới desk "
            "reject nhanh, không liên quan tới chất lượng nghiên cứu."
        ),
    },
    {
        "code": "cbqt.predatory-journal-signs",
        "name": "Không nhận diện dấu hiệu tạp chí săn mồi",
        "description": (
            "Bị dụ bởi lời mời viết bài dồn dập, thời gian bình duyệt bất thường ngắn, hoặc phí "
            "không minh bạch, mà không kiểm tra tạp chí trong Scopus/Web of Science/DOAJ trước khi "
            "gửi bài."
        ),
    },
    {
        "code": "cbqt.reject-means-bad-research",
        "name": "Coi mọi quyết định reject là bằng chứng nghiên cứu tồi",
        "description": (
            "Không phân biệt được desk reject (thường do sai scope hoặc lỗi định dạng) với reject "
            "sau bình duyệt đầy đủ (do chất lượng). Hiểu sai này làm mất động lực không cần thiết "
            "và có thể khiến từ bỏ một nghiên cứu tốt chỉ vì gửi nhầm venue."
        ),
    },
    {
        "code": "cbqt.salami-slicing",
        "name": "Chia một nghiên cứu thành nhiều bài báo nhỏ không cần thiết",
        "description": (
            "Tách một bộ dữ liệu và thiết kế nghiên cứu thành nhiều bài báo nhỏ chỉ để tăng số "
            "lượng công bố, làm loãng đóng góp thật của mỗi bài. Đây bị nhiều tạp chí coi là vi "
            "phạm đạo đức xuất bản khi phát hiện."
        ),
    },
    # ── Bài 6 · Dùng AI hỗ trợ viết có kiểm soát ─────────────────────────────
    {
        "code": "cbqt.ai-writes-content",
        "name": "Để AI viết thay nội dung khoa học chưa qua kiểm chứng",
        "description": (
            "Yêu cầu AI viết thẳng phần Kết quả hoặc Discussion rồi nộp mà không tự kiểm chứng và "
            "viết lại theo hiểu biết của chính mình. AI không hiểu bối cảnh nghiên cứu sâu bằng "
            "người nghiên cứu và không thể chịu trách nhiệm nếu diễn giải sai."
        ),
    },
    {
        "code": "cbqt.no-ai-disclosure",
        "name": "Không khai báo sử dụng AI theo yêu cầu của tạp chí",
        "description": (
            "Dùng AI đáng kể để soạn hoặc chỉnh sửa bản thảo mà không khai báo, dù tạp chí yêu cầu "
            "khai báo việc này. Đây là vi phạm quy định xuất bản, tương tự không khai báo xung đột "
            "lợi ích."
        ),
    },
    {
        "code": "cbqt.unverified-ai-citations",
        "name": "Dùng trích dẫn do AI gợi ý mà không tự tay kiểm chứng",
        "description": (
            "Đưa vào bản thảo một trích dẫn do AI gợi ý mà không tự tra lại nguồn thật. AI có thể "
            "tạo ra trích dẫn hoàn toàn không tồn tại (tên tác giả, năm, tên bài giả) một cách rất "
            "tự nhiên và thuyết phục."
        ),
    },
    {
        "code": "cbqt.ai-as-coauthor",
        "name": "Ghi công cụ AI là tác giả hoặc đồng tác giả",
        "description": (
            "Thêm tên công cụ AI vào danh sách tác giả vì đã đóng góp đáng kể vào việc viết. Một "
            "tác giả phải chịu trách nhiệm về nội dung công bố theo tiêu chí ICMJE — AI không thể "
            "chịu trách nhiệm hoặc được liên hệ để giải trình, nên không đủ điều kiện làm tác giả."
        ),
    },
    # ── Bài 7 · Viết đề xuất xin tài trợ và networking học thuật ─────────────
    {
        "code": "cbqt.vague-aims",
        "name": "Viết Specific Aims mơ hồ, không đo được",
        "description": (
            "Viết mục tiêu đề xuất chung chung ('nghiên cứu về AI trong giáo dục') thay vì cụ thể, "
            "đo được. Specific Aims mơ hồ khiến người xét duyệt không hình dung được nghiên cứu sẽ "
            "thực sự làm gì, thường bị từ chối ngay từ vòng đầu."
        ),
    },
    {
        "code": "cbqt.unrealistic-timeline",
        "name": "Viết timeline không có buffer thực tế",
        "description": (
            "Lên kế hoạch các bước nghiên cứu diễn ra suôn sẻ liên tiếp, không tính thời gian chờ "
            "phê duyệt đạo đức, thu thập dữ liệu chậm hơn dự kiến, hoặc một vòng phân tích lại. "
            "Timeline không thực tế làm giảm độ tin cậy của đề xuất."
        ),
    },
    {
        "code": "cbqt.conference-passive",
        "name": "Chỉ trình bày bài tại hội thảo rồi rời đi, không networking",
        "description": (
            "Tham dự hội thảo quốc tế chỉ để trình bày đúng slot của mình rồi rời khỏi hội trường, "
            "không chủ động tương tác. Hội thảo là nơi các hợp tác nghiên cứu thường bắt đầu — bỏ "
            "qua networking là bỏ lỡ phần lớn giá trị của việc tham dự."
        ),
    },
    {
        "code": "cbqt.generic-proposal-multiple-funders",
        "name": "Gửi một đề xuất chung chung cho nhiều quỹ tài trợ khác nhau",
        "description": (
            "Gửi cùng một bản đề xuất, chỉ đổi tên quỹ ở đầu trang, cho nhiều quỹ tài trợ khác "
            "nhau. Mỗi quỹ có ưu tiên riêng; đề xuất cần được điều chỉnh cách trình bày đóng góp để "
            "khớp với đúng ưu tiên của từng quỹ."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "cbqt.single-paper-thinking",
        "body": (
            "Trước khi chọn đề tài tiếp theo, viết ra một câu: đề tài này nối với những gì bạn đã "
            "làm hoặc dự định làm ra sao? Nếu không trả lời được, đề tài đó có thể đúng nhưng chưa "
            "được đặt vào đúng chỗ trong hành trình chuyên môn của bạn."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.contribution-is-novelty-only",
        "body": (
            "Viết lại đóng góp theo mẫu: 'Nghiên cứu này thách thức/mở rộng/tích hợp lý thuyết X "
            "bằng cách chỉ ra Y.' Nếu không điền được lý thuyết cụ thể vào chỗ X, đóng góp vẫn đang "
            "dừng ở mức 'chưa ai làm'."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.no-so-what-test",
        "body": (
            "Viết câu trả lời hiện tại cho 'đóng góp là gì', rồi tự hỏi 'so what?' — ai quan tâm, "
            "và vì sao — ít nhất ba lần liên tiếp. Dừng khi câu trả lời đã cụ thể tới mức nói được "
            "ai, ngoài chính bạn, nên đọc kết quả này."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.eligibility-criteria-after-search",
        "body": (
            "Viết khung PICOS đầy đủ và cố định nó trước khi chạy tìm kiếm thật. Nếu cần thay đổi "
            "tiêu chí sau khi đã thấy kết quả, ghi rõ lý do thay đổi đó trong bài báo — đừng thay "
            "đổi lặng lẽ."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.no-quality-appraisal",
        "body": (
            "Chọn một công cụ thẩm định chất lượng phù hợp với loại thiết kế của các nguồn, chạy "
            "cho từng nguồn, và báo cáo kết quả trong một bảng. Nguồn có rủi ro thiên lệch cao nên "
            "được xem xét riêng, không trộn chung với nguồn chất lượng cao."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.meta-analysis-forced",
        "body": (
            "Kiểm chỉ số I² trước khi quyết định gộp số liệu. Nếu I² cao, chuyển sang tổng hợp "
            "tường thuật hoặc theo chủ đề — đây là quyết định phương pháp đúng đắn, không phải một "
            "sự nhượng bộ khi không làm được thống kê."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.mediation-moderation-separate",
        "body": (
            "Nếu lý thuyết của bạn nói 'cơ chế này chỉ mạnh trong điều kiện X', đó là dấu hiệu cần "
            "một mô hình moderated mediation tích hợp, không phải hai mô hình riêng. Kiểm conditional "
            "indirect effect ở từng mức của biến điều tiết."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.compare-groups-no-invariance",
        "body": (
            "Trước khi so sánh path giữa các nhóm, chạy kiểm configural rồi metric invariance. "
            "Chỉ diễn giải sự khác biệt path là khác biệt thật sau khi cả hai bước này đã đạt."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.no-manipulation-check",
        "body": (
            "Thêm một câu hỏi đo lại biến độc lập sau khi thực hiện can thiệp (ví dụ đo lại mức tin "
            "tưởng sau khi đọc đoạn văn), và kiểm nó có khác biệt như dự kiến giữa các nhóm không, "
            "trước khi đọc kết quả biến phụ thuộc."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.two-wave-enough-for-causality",
        "body": (
            "Viết rõ trong phần hạn chế: trình tự thời gian đã được xác lập, nhưng các yếu tố gây "
            "nhiễu khác chưa đo và kiểm soát vẫn có thể ảnh hưởng tới kết luận nhân quả. Cân nhắc "
            "thêm biến kiểm soát hoặc thiết kế thực nghiệm nếu cần khẳng định chắc hơn."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.imrad-same-as-thesis",
        "body": (
            "Viết lại Introduction từ đầu theo cấu trúc hình nón, không mở file luận văn ra cắt "
            "dán. Hỏi: đoạn này có đang dẫn người đọc từ bối cảnh rộng tới đúng khoảng trống và "
            "câu đóng góp không, hay đang liệt kê lại mọi thứ đã viết trong luận văn?"
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.overclaim-in-english",
        "body": (
            "Đối chiếu lại bảng mức hedging theo thiết kế thật của bạn. Nếu dữ liệu là cắt ngang, "
            "đổi 'demonstrates'/'causes' thành 'is associated with'/'suggests' ở mọi câu kết luận."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.no-comparison-to-literature",
        "body": (
            "Với mỗi đoạn Discussion, thêm một câu trích dẫn cụ thể tới một nghiên cứu đã tổng "
            "quan và nói rõ kết quả của bạn đồng thuận hay mâu thuẫn với nó, và vì sao."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.rebuttal-defensive",
        "body": (
            "Với mỗi comment, viết theo mẫu: ghi nhận → hành động cụ thể → vị trí đã sửa. Nếu "
            "không đồng ý với một comment, giải thích rõ lý do một cách tôn trọng, không phớt lờ "
            "hay tranh cãi."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.quartile-only-no-scope",
        "body": (
            "Trước khi gửi bài, đọc Aims & Scope và 2-3 bài đã công bố gần đây của tạp chí. Nếu "
            "đóng góp của bạn không khớp rõ với những gì tạp chí đang xuất bản, tìm tạp chí khác "
            "dù quartile thấp hơn."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.predatory-journal-signs",
        "body": (
            "Trước khi gửi bài tới một tạp chí chưa quen, kiểm tra tạp chí đó trong danh mục "
            "Scopus/Web of Science hoặc DOAJ, và chạy qua checklist Think.Check.Submit."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.reject-means-bad-research",
        "body": (
            "Đọc kỹ lý do reject: nếu là desk reject vì scope, tìm tạp chí phù hợp hơn ngay, "
            "không cần thay đổi nghiên cứu. Nếu là reject sau bình duyệt đầy đủ, đọc comment kỹ "
            "để cải thiện trước khi gửi nơi khác."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.salami-slicing",
        "body": (
            "Tự hỏi: nếu tách nghiên cứu thành nhiều bài, mỗi bài có đủ đóng góp riêng để đứng độc "
            "lập không, hay chúng chỉ là các phần của một câu chuyện duy nhất? Nếu là phần của một "
            "câu chuyện, gộp lại thành một bài mạnh hơn nhiều bài yếu."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.ai-writes-content",
        "body": (
            "Dùng AI cho phần văn phong, nhưng tự viết lại nội dung khoa học (Kết quả, Discussion) "
            "bằng hiểu biết của chính mình. Nếu dùng AI để phác thảo, đọc lại và viết lại từng câu "
            "theo cách hiểu của bạn trước khi giữ nó trong bản thảo."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.no-ai-disclosure",
        "body": (
            "Kiểm 'Instructions for Authors' của tạp chí trước khi gửi. Nếu có dùng AI đáng kể để "
            "soạn văn bản, viết một đoạn khai báo ngắn ở phần được yêu cầu (Methods hoặc "
            "Acknowledgment)."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.unverified-ai-citations",
        "body": (
            "Với mọi trích dẫn trong bản thảo — kể cả trích dẫn nghe rất quen — tự tay tra trên "
            "Google Scholar/Scopus để xác nhận bài báo có thật và nội dung claim khớp với bài gốc."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.ai-as-coauthor",
        "body": (
            "Không ghi công cụ AI vào danh sách tác giả, dù đóng góp bao nhiêu vào việc viết. Nếu "
            "cần ghi nhận, dùng phần khai báo sử dụng AI (đã học ở mục trên), không phải danh sách "
            "tác giả."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.vague-aims",
        "body": (
            "Viết lại mỗi aim theo mẫu: đo [biến gì], trên [đối tượng nào], bằng [phương pháp nào]. "
            "Nếu người đọc không hình dung được bạn sẽ thu thập dữ liệu gì, aim đó còn quá mơ hồ."
        ),
        "priority": 10,
    },
    {
        "misconception": "cbqt.unrealistic-timeline",
        "body": (
            "Với mỗi bước trong timeline, tự hỏi: bước này từng bị chậm ở nghiên cứu trước chưa, "
            "hoặc phụ thuộc vào một bên khác (hội đồng đạo đức, đối tác thu thập dữ liệu) không? "
            "Thêm buffer cho những bước đó."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.conference-passive",
        "body": (
            "Trước hội thảo, chọn 3-5 bài liên quan tới research agenda của bạn để đọc trước và "
            "chuẩn bị câu hỏi. Sau hội thảo, trong vòng một tuần, gửi một email ngắn cho người bạn "
            "đã trò chuyện, khi ấn tượng còn mới."
        ),
        "priority": 9,
    },
    {
        "misconception": "cbqt.generic-proposal-multiple-funders",
        "body": (
            "Đọc lại call for proposal của từng quỹ và viết ra ưu tiên riêng của quỹ đó. Sửa lại "
            "cách trình bày đóng góp (Bài 1) để nhấn mạnh đúng phần khớp với ưu tiên đó, cho từng "
            "quỹ riêng biệt."
        ),
        "priority": 9,
    },
]

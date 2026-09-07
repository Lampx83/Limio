# -*- coding: utf-8 -*-
"""Phần khung của khoá: mô tả, danh sách lỗi tư duy, lời phản hồi."""

COURSE = {
    "title": "Các công nghệ giáo dục tiên tiến",
    "slug": "cong-nghe-giao-duc-tien-tien",
    "description": (
        "Khoá chuyên đề cho sinh viên năm cuối ngành Công nghệ giáo dục. Không phải một vòng "
        "giới thiệu công cụ — công cụ nào rồi cũng đổi — mà là cách thẩm định một công nghệ giáo "
        "dục trước khi tin vào nó: nó dựa trên lý thuyết học tập nào, bằng chứng hiệu quả tới đâu, "
        "nó thu dữ liệu gì của người học, và đưa vào một trường học Việt Nam thì vướng ở đâu. "
        "Năm module đi từ nền tảng thẩm định, qua hai vùng đang thay đổi nhanh nhất là AI tạo sinh "
        "và phân tích học tập, tới học thích ứng, rồi khép lại bằng năng lực triển khai và nghiên "
        "cứu — đủ để làm khoá luận hoặc chủ trì một đợt thử nghiệm công nghệ ở cơ sở giáo dục. "
        "Mỗi bài kết bằng luyện tập cá nhân, nhóm và bài tập về nhà; mỗi bài kiểm tra ngắn gắn mã "
        "lỗi tư duy để phản hồi chỉ đúng chỗ hiểu sai. Xuyên suốt học phần là một đồ án sản phẩm: "
        "mỗi module đóng góp một mảnh, và bài bảo vệ cuối kỳ là một cuốn sách AR do người học tự dựng "
        "cho một nội dung dạy học cụ thể, kèm hồ sơ thẩm định và biên bản thử nghiệm với người học thật."
    ),
    "language": "vi",
    "level": "advanced",
    "category": "Công nghệ giáo dục",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    {
        "code": "cngdtt.new-equals-better",
        "name": "Mới hơn nghĩa là tốt hơn",
        "description": (
            "Cho rằng một công nghệ vừa ra đời thì đương nhiên dạy học tốt hơn công nghệ trước đó, "
            "nên xếp hạng giải pháp theo độ mới thay vì theo việc nó cải thiện kết quả học tập nào. "
            "Lịch sử ngành cho thấy mỗi làn sóng đều tự nhận là bước ngoặt, và phần lớn dừng lại ở "
            "mức đổi phương tiện chuyển tải."
        ),
    },
    {
        "code": "cngdtt.media-teaches",
        "name": "Tin rằng phương tiện tự nó dạy học",
        "description": (
            "Quy hiệu quả học tập cho bản thân thiết bị hay nền tảng, chứ không cho phương pháp dạy "
            "học được cài trong đó. Đây chính là điểm Clark (1983) phản bác: đổi xe chở hàng không "
            "làm thay đổi chất dinh dưỡng của hàng."
        ),
    },
    {
        "code": "cngdtt.access-equals-learning",
        "name": "Có thiết bị là có học tập",
        "description": (
            "Coi việc trang bị máy, đường truyền hay tài khoản phần mềm là đã giải quyết xong vấn đề, "
            "bỏ qua khâu thiết kế hoạt động học, năng lực giáo viên và thời lượng sử dụng thực tế. "
            "Các chương trình cấp máy diện rộng thất bại chủ yếu ở khâu này."
        ),
    },
    {
        "code": "cngdtt.hype-as-evidence",
        "name": "Lấy mức độ phổ biến làm bằng chứng",
        "description": (
            "Dùng số vốn đầu tư, số trường đang dùng, hay lượng bài báo nói về một công nghệ để kết "
            "luận nó hiệu quả. Đó là bằng chứng về sự chú ý, không phải bằng chứng về học tập."
        ),
    },
    {
        "code": "cngdtt.tech-not-design",
        "name": "Đổi công nghệ thay cho đổi thiết kế dạy học",
        "description": (
            "Kỳ vọng một nền tảng mới tự sửa được vấn đề vốn nằm ở nhiệm vụ học tập: mục tiêu mơ hồ, "
            "không có luyện tập, không có phản hồi. Bài giảng đọc chép quay thành video vẫn là bài "
            "giảng đọc chép."
        ),
    },
    {
        "code": "cngdtt.more-media-better",
        "name": "Càng nhiều hình ảnh, âm thanh càng dễ học",
        "description": (
            "Thêm nhạc nền, hiệu ứng, ảnh trang trí vì tin rằng chúng làm bài học hấp dẫn hơn. Theo "
            "nguyên tắc mạch lạc của Mayer, những chi tiết không phục vụ mục tiêu học tập lấy mất "
            "phần trí nhớ làm việc đáng lẽ dành cho nội dung."
        ),
    },
    {
        "code": "cngdtt.fluency-equals-learning",
        "name": "Thấy dễ hiểu tức là đã học được",
        "description": (
            "Lấy cảm giác trôi chảy khi xem video hay đọc lại tài liệu làm dấu hiệu đã nắm bài. Cảm "
            "giác ấy đo độ quen thuộc chứ không đo khả năng nhớ lại; các khó khăn có chủ đích như "
            "tự kiểm tra và giãn cách khiến việc học khó chịu hơn mà bền hơn."
        ),
    },
    {
        "code": "cngdtt.learning-styles",
        "name": "Dạy theo phong cách học tập của từng người",
        "description": (
            "Tin rằng phân loại người học thành nhóm nhìn, nghe, vận động rồi dạy đúng kênh của họ "
            "sẽ cho kết quả tốt hơn. Giả thuyết này đã được kiểm nhiều lần và không đứng vững; nó "
            "vẫn phổ biến vì nghe hợp lý và dễ bán."
        ),
    },
    {
        "code": "cngdtt.samr-ladder",
        "name": "Coi SAMR là thang bậc phải leo",
        "description": (
            "Hiểu bốn mức của SAMR như thứ hạng chất lượng, nên mặc định hoạt động ở mức Định nghĩa "
            "lại luôn tốt hơn mức Thay thế. SAMR mô tả mức độ biến đổi của hoạt động, không đo kết "
            "quả học tập; một thay thế đơn giản mà đúng chỗ vẫn hơn một hoạt động cầu kỳ lạc mục tiêu."
        ),
    },
    {
        "code": "cngdtt.tool-first",
        "name": "Chọn công cụ trước, tìm chỗ dùng sau",
        "description": (
            "Bắt đầu bằng một phần mềm thú vị rồi mới nghĩ xem nhét vào bài nào. Trình tự đúng đi từ "
            "mục tiêu học tập và chỗ người học đang tắc, công nghệ chỉ được gọi tên ở bước cuối."
        ),
    },
    {
        "code": "cngdtt.effect-size-blind",
        "name": "Đọc effect size mà không hỏi so với cái gì",
        "description": (
            "Trích một con số d = 0,8 như bằng chứng tự thân, không xem nhóm đối chứng làm gì, đo bằng "
            "bài kiểm tra nào, kéo dài bao lâu. Cùng một con số có thể nghĩa là rất mạnh hoặc gần như "
            "vô nghĩa tuỳ vào ba điều đó."
        ),
    },
    {
        "code": "cngdtt.vendor-evidence",
        "name": "Tin nghiên cứu do chính nhà cung cấp thực hiện",
        "description": (
            "Chấp nhận báo cáo hiệu quả do công ty bán sản phẩm tự thiết kế, tự thu dữ liệu và tự đo "
            "bằng bài kiểm tra của họ. Không nhất thiết là gian dối, nhưng mọi lựa chọn nhỏ trong "
            "thiết kế nghiên cứu đều nghiêng về phía sản phẩm."
        ),
    },
    {
        "code": "cngdtt.policy-blind",
        "name": "Bỏ qua ràng buộc pháp lý về dữ liệu người học",
        "description": (
            "Thiết kế hệ thống thu thập hành vi, hình ảnh, giọng nói của người học mà không hỏi cơ sở "
            "pháp lý, sự đồng ý, thời hạn lưu trữ. Với người học chưa thành niên, ràng buộc còn chặt "
            "hơn và trách nhiệm thuộc về nhà trường chứ không phải nhà cung cấp."
        ),
    },
    {
        "code": "cngdtt.digital-divide-access-only",
        "name": "Hiểu khoảng cách số chỉ là thiếu thiết bị",
        "description": (
            "Đo bất bình đẳng số bằng tỉ lệ có máy và có mạng, rồi coi như đã xong. Còn hai tầng nữa: "
            "kỹ năng sử dụng cho việc học, và khả năng biến việc sử dụng thành kết quả — hai tầng này "
            "thường nới rộng khoảng cách ngay cả khi tầng thiết bị đã được lấp."
        ),
    },
    {
        "code": "cngdtt.llm-knows-truth",
        "name": "Coi mô hình ngôn ngữ như nguồn tra cứu sự thật",
        "description": (
            "Hỏi mô hình một dữ kiện rồi dùng thẳng câu trả lời như tra từ điển hay tra văn bản gốc. "
            "Mô hình sinh chuỗi có xác suất cao chứ không truy xuất một kho sự thật; câu trả lời đúng "
            "và câu trả lời bịa được sinh ra bằng đúng một cơ chế và có cùng độ trôi chảy."
        ),
    },
    {
        "code": "cngdtt.prompt-magic",
        "name": "Coi lời nhắc là câu thần chú",
        "description": (
            "Sưu tầm những lời nhắc nghe có vẻ hiệu nghiệm và dùng lại mà không có bộ ca kiểm thử nào "
            "để biết chúng thật sự tốt hơn. Một lời nhắc là một thiết kế nhiệm vụ: phải kiểm bằng nhiều "
            "đầu vào khác nhau, có tiêu chí chấm, và ghi lại phiên bản."
        ),
    },
    {
        "code": "cngdtt.ai-output-unchecked",
        "name": "Dùng thẳng nội dung AI sinh ra",
        "description": (
            "Đưa câu hỏi, lời giải hay học liệu do mô hình sinh vào lớp mà không kiểm chứng nội dung và "
            "không thử với người học. Sai sót của mô hình được viết bằng văn phong tự tin, nên người "
            "kiểm nhanh có xu hướng bỏ qua đúng chỗ cần dừng lại."
        ),
    },
    {
        "code": "cngdtt.ai-detector-reliable",
        "name": "Tin công cụ phát hiện văn bản AI",
        "description": (
            "Dùng điểm số của công cụ dò văn bản AI làm căn cứ kết luận học sinh gian lận. Các công cụ "
            "này có tỉ lệ báo động giả cao và lệch có hệ thống với người viết bằng ngoại ngữ — đúng nhóm "
            "học sinh Việt Nam khi viết tiếng Anh."
        ),
    },
    {
        "code": "cngdtt.tutor-gives-answer",
        "name": "Trợ giảng tốt là trợ giảng đưa đáp án nhanh",
        "description": (
            "Đánh giá chất lượng trợ giảng AI bằng việc nó giải bài nhanh và đúng tới đâu. Với mục tiêu "
            "học tập, đưa đáp án ngay lấy mất phần vật lộn tạo ra việc học; vai trò của trợ giảng là giữ "
            "người học ở trong vùng khó vừa sức, không phải rút ngắn nó."
        ),
    },
    {
        "code": "cngdtt.paste-student-data",
        "name": "Dán dữ liệu người học vào dịch vụ AI",
        "description": (
            "Sao chép bài làm, nhận xét, danh sách lớp hay hồ sơ học sinh vào một dịch vụ AI công cộng "
            "để nhờ xử lý. Đó là hành vi chuyển dữ liệu cá nhân cho bên thứ ba, thường là xuyên biên "
            "giới, và người chịu trách nhiệm là nhà trường chứ không phải nhà cung cấp."
        ),
    },
    {
        "code": "cngdtt.mastery-equals-score",
        "name": "Đồng nhất điểm số với trạng thái tri thức",
        "description": (
            "Coi điểm trung bình là thứ mô tả người học biết gì. Điểm gộp mọi kỹ năng vào một con số và "
            "trộn lẫn đoán đúng với hiểu thật; mô hình người học phải ước lượng riêng từng kỹ năng và "
            "kèm mức độ không chắc chắn."
        ),
    },
    {
        "code": "cngdtt.adaptive-means-easier",
        "name": "Hiểu thích ứng là làm dễ đi",
        "description": (
            "Cho rằng cá nhân hoá nghĩa là hạ độ khó cho vừa sức người học. Thích ứng đúng là giữ người "
            "học ở vùng khó vừa phải — quá dễ thì không học được gì, và hạ độ khó kéo dài sẽ khoá người "
            "học ở mức thấp."
        ),
    },
    {
        "code": "cngdtt.more-practice-better",
        "name": "Cứ luyện nhiều là sẽ thành thạo",
        "description": (
            "Tin rằng thêm bài tập cùng dạng sẽ đưa người học tới thành thạo. Hiện tượng quay bánh xe "
            "cho thấy có những người học làm hàng chục bài mà xác suất thành thạo không nhích lên — dấu "
            "hiệu cần đổi cách dạy chứ không phải thêm bài."
        ),
    },
    {
        "code": "cngdtt.model-fit-is-enough",
        "name": "Mô hình dự đoán tốt hơn thì dùng được ngay",
        "description": (
            "Chọn mô hình theo mỗi chỉ số dự đoán trên dữ liệu cũ, bỏ qua việc nó có nói được nên làm gì "
            "tiếp theo hay không. Trong dạy học, mô hình phải hành động được và giải thích được cho "
            "người dạy, người học."
        ),
    },
    {
        "code": "cngdtt.cram-works",
        "name": "Học dồn hiệu quả ngang học giãn cách",
        "description": (
            "Đánh giá hiệu quả ôn tập bằng kết quả kiểm tra ngay sau buổi học. Học dồn cho kết quả tốt "
            "trong ngắn hạn rồi rơi nhanh; cùng tổng thời gian, chia thành nhiều buổi cách quãng cho ghi "
            "nhớ bền hơn rõ rệt."
        ),
    },
    {
        "code": "cngdtt.label-as-ability",
        "name": "Đọc trạng thái tri thức như nhãn năng lực cố định",
        "description": (
            "Hiểu xác suất thành thạo của một kỹ năng như đánh giá về năng lực bẩm sinh của người học và "
            "để nhãn ấy theo họ. Đó là ước lượng về một kỹ năng tại một thời điểm, dựa trên vài chục lượt "
            "trả lời, và nó thay đổi ngay khi người học luyện tiếp."
        ),
    },
    {
        "code": "cngdtt.dashboard-equals-action",
        "name": "Coi bảng điều khiển là can thiệp",
        "description": (
            "Cho rằng dựng xong bảng số liệu là đã cải thiện việc học. Bảng chỉ đóng góp nếu có người "
            "đọc, hiểu, và biết phải làm gì tiếp — thiếu vòng khép kín ấy thì nó chỉ là chi phí."
        ),
    },
    {
        "code": "cngdtt.engagement-equals-learning",
        "name": "Đồng nhất mức độ tương tác với việc học",
        "description": (
            "Lấy số lần đăng nhập, thời gian trên hệ thống, số lượt bấm làm bằng chứng học tốt. Các chỉ "
            "số này đo sự có mặt, không đo tiến bộ; tối ưu theo chúng dễ dẫn tới thiết kế giữ chân người "
            "dùng thay vì dạy được nhiều hơn."
        ),
    },
    {
        "code": "cngdtt.proxy-as-construct",
        "name": "Nhầm chỉ số thay thế với thứ cần đo",
        "description": (
            "Dùng thời gian mở trang thay cho sự tập trung, số bài nộp thay cho năng lực. Chỉ số thay thế "
            "chỉ có giá trị khi quan hệ giữa nó và thứ cần đo được kiểm chứng, và quan hệ ấy đứt ngay khi "
            "người ta biết mình đang bị đo bằng nó."
        ),
    },
    {
        "code": "cngdtt.alert-precision",
        "name": "Bỏ qua tỉ lệ nền khi đọc cảnh báo sớm",
        "description": (
            "Nghe mô hình đúng 80% rồi tin rằng phần lớn cảnh báo là chính xác. Khi tỉ lệ học sinh thật "
            "sự gặp rủi ro thấp, đa số cảnh báo vẫn là báo động giả — phải tính tỉ lệ dự báo đúng trên "
            "chính nhóm bị gắn cờ."
        ),
    },
    {
        "code": "cngdtt.collect-all-data",
        "name": "Thu hết dữ liệu rồi tính sau",
        "description": (
            "Bật ghi mọi thứ vì biết đâu sau này cần. Điều đó vi phạm nguyên tắc tối thiểu hoá và giới hạn "
            "mục đích, tạo ra rủi ro lộ lọt tương ứng với khối dữ liệu, và thường sinh ra kho dữ liệu "
            "không ai phân tích."
        ),
    },
    {
        "code": "cngdtt.fairness-by-blindness",
        "name": "Tin rằng bỏ biến nhạy cảm là đủ công bằng",
        "description": (
            "Loại giới tính, dân tộc, hoàn cảnh khỏi mô hình rồi kết luận mô hình trung lập. Các biến còn "
            "lại vẫn mang thông tin về nhóm, nên chênh lệch hiệu năng theo nhóm vẫn xảy ra và chỉ phát "
            "hiện được khi đo tách theo nhóm."
        ),
    },
    {
        "code": "cngdtt.presence-equals-learning",
        "name": "Đồng nhất cảm giác hiện diện với việc học",
        "description": (
            "Cho rằng công nghệ càng làm người học thấy như đang ở trong đó thì học càng tốt. Thực nghiệm "
            "cho thấy thêm mức nhập vai có thể làm tăng hiện diện và thích thú trong khi kết quả học tập "
            "lại giảm, vì phần tài nguyên nhận thức bị chuyển sang xử lý môi trường."
        ),
    },
    {
        "code": "cngdtt.demo-equals-product",
        "name": "Coi bản demo chạy được là sản phẩm dùng được",
        "description": (
            "Nghiệm thu bằng buổi trình diễn trên thiết bị của người làm, trong điều kiện mạng và ánh sáng "
            "thuận lợi. Sản phẩm chỉ được coi là dùng được khi người học lạ tự vận hành được trên thiết bị "
            "của chính họ, trong điều kiện lớp học thật."
        ),
    },
    {
        "code": "cngdtt.usability-ask-opinion",
        "name": "Kiểm thử bằng cách hỏi ý kiến",
        "description": (
            "Đưa sản phẩm cho người học xem rồi hỏi em thấy thế nào. Câu trả lời lịch sự và bị chi phối bởi "
            "sự mới lạ; kiểm thử khả dụng phải giao nhiệm vụ thật, quan sát chỗ họ tắc, và đo bằng thời "
            "gian cùng số lần cần trợ giúp."
        ),
    },
    {
        "code": "cngdtt.pilot-equals-deployment",
        "name": "Thử nghiệm thành công nghĩa là triển khai được",
        "description": (
            "Suy từ một lớp thí điểm do chính người thiết kế đứng lớp sang kết luận về toàn trường. Thí "
            "điểm chạy được nhờ sự chú ý và hỗ trợ đặc biệt; triển khai thật đòi hỗ trợ kỹ thuật, tập huấn, "
            "vòng đời thiết bị và người chịu trách nhiệm khi hỏng."
        ),
    },
    {
        "code": "cngdtt.training-solves-adoption",
        "name": "Tin rằng tập huấn một buổi là đủ",
        "description": (
            "Coi việc giáo viên chưa dùng công nghệ là do thiếu kỹ năng, và giải quyết bằng một buổi tập "
            "huấn. Rào cản bậc hai — niềm tin sư phạm và mức chấp nhận rủi ro trong lớp — cần hỗ trợ dài "
            "hạn, làm mẫu và cộng đồng chuyên môn."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "cngdtt.new-equals-better",
        "body": (
            "Bạn đang xếp hạng công nghệ theo độ mới. Hãy đổi câu hỏi: công nghệ này cải thiện cụ thể "
            "khâu nào của việc học — trình bày nội dung, luyện tập, phản hồi, hay đánh giá? Nếu không "
            "trả lời được bằng một câu, thì cái mới ở đây mới chỉ là phương tiện."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.media-teaches",
        "body": (
            "Cái dạy học là phương pháp được cài trong công nghệ, không phải công nghệ. Khi so sánh "
            "hai giải pháp, hãy hỏi chúng khác nhau ở phương pháp nào — nếu chỉ khác ở phương tiện "
            "chuyển tải, đừng chờ khác biệt về kết quả học tập."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.access-equals-learning",
        "body": (
            "Thiết bị là điều kiện cần. Sau nó còn ba câu hỏi: người học làm gì với thiết bị trong "
            "giờ học, giáo viên được chuẩn bị thế nào, và ai chịu trách nhiệm khi máy hỏng. Các dự "
            "án cấp máy diện rộng vấp đúng ba chỗ này."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.hype-as-evidence",
        "body": (
            "Số tiền đầu tư và số trường đang dùng là bằng chứng về sự chú ý. Bằng chứng về học tập "
            "phải trả lời: đo trên ai, so với nhóm làm gì, đo bằng bài kiểm tra độc lập nào, hiệu "
            "quả còn lại sau bao lâu."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.tech-not-design",
        "body": (
            "Hãy tách hai lớp: vấn đề nằm ở nhiệm vụ học tập hay ở phương tiện? Nếu người học không "
            "có gì để luyện và không nhận được phản hồi, đổi nền tảng cũng không sinh ra hai thứ đó."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.more-media-better",
        "body": (
            "Mỗi chi tiết thêm vào đều tiêu một phần trí nhớ làm việc. Trước khi giữ một hình, một "
            "hiệu ứng hay một đoạn nhạc, hãy hỏi nó phục vụ mục tiêu học nào; không trả lời được thì "
            "bỏ đi là bài học tốt lên."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.fluency-equals-learning",
        "body": (
            "Cảm giác dễ hiểu đo độ quen, không đo khả năng nhớ lại. Muốn biết đã học được chưa, hãy "
            "gấp tài liệu lại và tự nhắc lại; thấy khó ở bước đó mới là dấu hiệu việc học đang diễn ra."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.learning-styles",
        "body": (
            "Phân loại người học theo kênh cảm giác rồi dạy đúng kênh đó không cho kết quả tốt hơn — "
            "điều này đã được kiểm và bác bỏ nhiều lần. Cái thật sự nên thay đổi theo người học là "
            "mức độ khó và lượng hỗ trợ, không phải kênh trình bày."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.samr-ladder",
        "body": (
            "SAMR mô tả mức độ biến đổi của hoạt động chứ không xếp hạng chất lượng dạy học. Câu hỏi "
            "đúng không phải bạn đang ở mức nào, mà hoạt động này có phục vụ mục tiêu học tập tốt hơn "
            "cách làm cũ hay không."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.tool-first",
        "body": (
            "Hãy quay ngược trình tự: mục tiêu học tập nào, người học đang tắc ở đâu, cần loại hỗ trợ "
            "gì — rồi mới hỏi công nghệ nào cung cấp được hỗ trợ ấy. Công cụ được gọi tên ở bước cuối, "
            "không phải bước đầu."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.effect-size-blind",
        "body": (
            "Một effect size chỉ đọc được cùng ba thông tin: nhóm đối chứng làm gì, đo bằng bài kiểm "
            "tra nào, và đo sau bao lâu. Thiếu bất kỳ mảnh nào thì con số chưa nói được điều gì."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.vendor-evidence",
        "body": (
            "Hãy hỏi ba câu về nguồn: ai tài trợ, ai thiết kế nghiên cứu, và bài kiểm tra kết quả do "
            "ai soạn. Nghiên cứu của nhà cung cấp vẫn dùng được, nhưng phải đọc như một lập luận có "
            "lợi ích, không phải như một kết luận trung lập."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.policy-blind",
        "body": (
            "Trước khi thu bất kỳ dữ liệu nào của người học, hãy trả lời: thu để làm gì, dựa trên cơ "
            "sở nào, ai đồng ý, lưu bao lâu, ai xem được. Với người học chưa thành niên, mọi câu trong "
            "số này đều chặt hơn."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.digital-divide-access-only",
        "body": (
            "Khoảng cách số có ba tầng: tiếp cận, kỹ năng, và kết quả. Lấp tầng thiết bị mà bỏ hai "
            "tầng sau thì công nghệ thường làm giãn khoảng cách, vì nhóm sẵn vốn văn hoá số tận dụng "
            "được nhiều hơn."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.llm-knows-truth",
        "body": (
            "Mô hình sinh chuỗi có xác suất cao, không truy xuất một kho sự thật — nên câu đúng và câu "
            "bịa ra đời bằng cùng một cơ chế và nghe giống hệt nhau. Với mọi dữ kiện có thể kiểm được "
            "(số liệu, trích dẫn, điều luật), hãy đối chiếu nguồn gốc trước khi dùng."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.prompt-magic",
        "body": (
            "Hãy đối xử với lời nhắc như một thiết kế nhiệm vụ: viết bộ ca kiểm thử gồm cả ca dễ lẫn ca "
            "khó, chấm đầu ra bằng tiêu chí có sẵn, so hai phiên bản trên cùng bộ ca ấy. Không có bộ ca "
            "thì bạn chỉ đang có cảm giác về chất lượng, không có bằng chứng."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.ai-output-unchecked",
        "body": (
            "Nội dung sinh ra là bản nháp, không phải sản phẩm. Ba bước tối thiểu trước khi đưa vào lớp: "
            "đối chiếu dữ kiện với nguồn gốc, rà theo mục tiêu học tập, và thử với vài người học thật để "
            "xem chỗ nào gây hiểu sai."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.ai-detector-reliable",
        "body": (
            "Điểm số của công cụ dò AI không đủ làm căn cứ buộc tội: tỉ lệ báo động giả cao và lệch có hệ "
            "thống với người viết bằng ngoại ngữ. Hãy chuyển trọng tâm sang bằng chứng quá trình — bản "
            "nháp, lịch sử sửa, phần trình bày miệng — thay vì phán đoán trên sản phẩm cuối."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.tutor-gives-answer",
        "body": (
            "Đo trợ giảng bằng việc người học tự làm được gì sau đó, không bằng tốc độ nó giải bài. Một "
            "trợ giảng tốt hỏi ngược, gợi từng bước, và chỉ đưa lời giải đầy đủ khi người học đã cạn "
            "phương án — giữ lại phần vật lộn chính là giữ lại phần tạo ra việc học."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.paste-student-data",
        "body": (
            "Trước khi gửi bất cứ thứ gì của người học đi, hãy hỏi: dữ liệu này có định danh được không, "
            "gửi đi đâu, ai giữ, có căn cứ nào. Cách xử lý mạnh nhất về mặt thiết kế là khử nhận dạng "
            "trước khi gửi — dữ liệu đã khử nhận dạng không còn là dữ liệu cá nhân."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.mastery-equals-score",
        "body": (
            "Điểm số gộp mọi kỹ năng vào một con số và không phân biệt đoán trúng với hiểu thật. Hãy hỏi: "
            "hệ thống ước lượng riêng cho từng kỹ năng chưa, và nó nói được mức độ chắc chắn của ước "
            "lượng ấy không?"
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.adaptive-means-easier",
        "body": (
            "Thích ứng là giữ người học ở vùng khó vừa phải, không phải hạ độ khó. Kiểm bằng một câu: hệ "
            "thống có đường nâng độ khó trở lại khi người học tiến bộ không, hay chỉ có đường đi xuống?"
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.more-practice-better",
        "body": (
            "Hãy nhìn đường xác suất thành thạo theo số lượt làm. Nếu nó đi ngang qua hàng chục lượt, đó "
            "là quay bánh xe: cần đổi cách dạy, đổi loại nhiệm vụ hoặc chuyển sang người dạy, chứ thêm "
            "bài chỉ tiêu thời gian và niềm tin của người học."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.model-fit-is-enough",
        "body": (
            "Chỉ số dự đoán trên dữ liệu cũ mới là một nửa. Nửa còn lại: mô hình nói được nên cho bài gì "
            "tiếp theo không, và giải thích được cho giáo viên vì sao không? Mô hình dự đoán tốt mà không "
            "hành động được thì không dùng vào dạy học."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.cram-works",
        "body": (
            "Đừng đo bằng bài kiểm tra ngay sau buổi học — đó là lúc học dồn trông đẹp nhất. Đo lại sau "
            "một đến hai tuần thì thứ tự thường đảo: cùng tổng thời gian, ôn giãn cách cho kết quả bền hơn."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.label-as-ability",
        "body": (
            "Con số ấy là ước lượng về một kỹ năng tại một thời điểm, dựa trên vài chục lượt trả lời — "
            "không phải nhãn năng lực. Khi hiển thị cho giáo viên hay người học, phải kèm mốc thời gian, "
            "số lượt làm căn cứ, và cách để thay đổi nó."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.dashboard-equals-action",
        "body": (
            "Hãy đi hết vòng: ai đọc bảng này, đọc lúc nào, và sau khi đọc thì họ làm gì khác đi? Nếu ba "
            "câu ấy chưa có câu trả lời cụ thể, bảng điều khiển chưa phải một can thiệp."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.engagement-equals-learning",
        "body": (
            "Số lần đăng nhập và thời gian trên hệ thống đo sự có mặt, không đo tiến bộ. Hãy ghép mỗi chỉ "
            "số tương tác với một chỉ số kết quả học tập, và xem chúng có đi cùng nhau trong dữ liệu của "
            "bạn không."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.proxy-as-construct",
        "body": (
            "Chỉ số thay thế cần được kiểm: nó tương quan tới đâu với thứ bạn thật sự quan tâm, trên chính "
            "nhóm người học của bạn? Và hãy giả định trước rằng quan hệ ấy sẽ yếu đi ngay khi người học "
            "biết mình đang bị đo bằng nó."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.alert-precision",
        "body": (
            "Tính thử trên 1000 học sinh: bao nhiêu em thật sự gặp rủi ro, mô hình bắt được bao nhiêu, và "
            "gắn cờ nhầm bao nhiêu. Con số đáng quan tâm là tỉ lệ đúng trong nhóm bị gắn cờ, không phải "
            "độ chính xác tổng thể."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.collect-all-data",
        "body": (
            "Mỗi trường dữ liệu phải gắn với một quyết định cụ thể sẽ được đưa ra nhờ nó. Không nêu được "
            "quyết định ấy thì không thu — vừa đúng nguyên tắc tối thiểu hoá, vừa tránh một kho dữ liệu "
            "chỉ tồn tại như rủi ro."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.fairness-by-blindness",
        "body": (
            "Bỏ biến nhạy cảm khỏi mô hình không làm mất thông tin về nhóm, vì các biến khác vẫn mang nó. "
            "Cách duy nhất biết mô hình có công bằng không là **đo hiệu năng tách theo nhóm** và công bố "
            "kết quả ấy."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.presence-equals-learning",
        "body": (
            "Hiện diện và thích thú là hai chỉ số khác với học tập, và chúng có thể đi ngược chiều nhau. "
            "Hãy đo kết quả học tập bằng bài kiểm tra độc lập, tách khỏi câu hỏi em thấy có hay không."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.demo-equals-product",
        "body": (
            "Đổi điều kiện nghiệm thu: người học chưa từng thấy sản phẩm, dùng thiết bị của chính họ, trong "
            "phòng học thật, không có bạn đứng cạnh hướng dẫn. Chạy được trong điều kiện đó mới tính."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.usability-ask-opinion",
        "body": (
            "Đừng hỏi em thấy thế nào — hãy giao một nhiệm vụ thật rồi im lặng quan sát. Ghi lại chỗ họ "
            "dừng, thời gian tới bước đầu tiên thành công, và số lần họ phải hỏi. Đó mới là dữ liệu."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.pilot-equals-deployment",
        "body": (
            "Hỏi thêm bốn câu trước khi suy từ thí điểm sang triển khai: ai hỗ trợ khi hỏng, ai tập huấn "
            "người mới, thiết bị thay thế lấy đâu, và điều gì xảy ra khi người khởi xướng chuyển công tác."
        ),
        "priority": 10,
    },
    {
        "misconception": "cngdtt.training-solves-adoption",
        "body": (
            "Nếu sau tập huấn giáo viên vẫn không dùng, vấn đề thường nằm ở rào cản bậc hai chứ không ở kỹ "
            "năng. Hãy đầu tư vào làm mẫu trong chính lớp của họ, hỗ trợ khi có sự cố, và thời gian được "
            "phép thử mà không bị đánh giá."
        ),
        "priority": 10,
    },
]